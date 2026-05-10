#!/usr/bin/env tsx
/**
 * Reads .audit/outreach.log, finds vendor outreach emails sent ≥ 7 days ago
 * that haven't received a follow-up yet, and sends one polite nudge.
 *
 * Mark a vendor as "responded" by adding a line like:
 *   {"id":"<email-id>","respondedAt":"2026-05-20T..."}
 * to .audit/outreach-responses.log — those are skipped automatically.
 *
 * Cost: $0 (Resend free tier).
 *
 * Run manually: npm run followups
 * Schedule: install com.kanzenai.followups.plist (runs daily 9 AM)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OUTREACH_EMAILS } from "../lib/outreach";

// ─── Env loader ─────────────────────────────────────────────────────────────
function loadEnv() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (v && !process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const ROOT = process.cwd();
const OUTREACH_LOG = join(ROOT, ".audit", "outreach.log");
const RESPONSES_LOG = join(ROOT, ".audit", "outreach-responses.log");
const FOLLOWUPS_LOG = join(ROOT, ".audit", "outreach-followups.log");
const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM ?? "hello@kanzenai.com";
const FOLLOWUP_DELAY_DAYS = 7;
const MAX_FOLLOWUPS_PER_EMAIL = 1;

if (!RESEND_KEY) {
  console.error("✗ RESEND_API_KEY missing in .env.local. Skipping follow-ups.");
  process.exit(0);
}

type SentRecord = { id: string; sentAt: string; resendId?: string; error?: string };
type ResponseRecord = { id: string; respondedAt: string };
type FollowupRecord = { id: string; followupAt: string; resendId?: string; error?: string };

async function readJsonLog<T>(path: string): Promise<T[]> {
  if (!existsSync(path)) return [];
  const text = await readFile(path, "utf8");
  const out: T[] = [];
  for (const line of text.trim().split("\n").filter(Boolean)) {
    try {
      out.push(JSON.parse(line));
    } catch {}
  }
  return out;
}

async function appendLog(path: string, record: any) {
  const dir = join(ROOT, ".audit");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(path, JSON.stringify(record) + "\n", { flag: "a" });
}

function buildFollowupBody(vendor: string, articles: number, daysSince: number): string {
  return `Hi ${vendor} team,

Quick follow-up on the partnership inquiry I sent ${daysSince} days ago. I run KanzenAI (https://kanzenai.com) — an independent affiliate review site for working real estate agents.

KanzenAI now has ${articles} published reviews and is starting to drive search traffic. ${vendor} is recommended in our coverage; I'd like to make sure my links attribute correctly when readers sign up.

If there's a better contact for partner applications, happy to be redirected. Even a "use this signup link" reply would be helpful.

Thanks,
Brady Ostrow
KanzenAI Editorial
hello@kanzenai.com
https://kanzenai.com`;
}

async function articleCount(): Promise<number> {
  const dir = join(ROOT, "content", "articles");
  if (!existsSync(dir)) return 0;
  const files = (await readFile(join(dir, ".."), "utf8").catch(() => "")) as any;
  // simpler: just count files via fs.readdir
  const fs = await import("node:fs/promises");
  return (await fs.readdir(dir)).filter((f: string) => f.endsWith(".json")).length;
}

async function main() {
  console.log(`KanzenAI follow-up bot — ${new Date().toISOString()}\n`);

  const sent: SentRecord[] = await readJsonLog(OUTREACH_LOG);
  const responded: ResponseRecord[] = await readJsonLog(RESPONSES_LOG);
  const followups: FollowupRecord[] = await readJsonLog(FOLLOWUPS_LOG);

  const respondedIds = new Set(responded.map((r) => r.id));
  const followupCounts = new Map<string, number>();
  for (const f of followups) {
    followupCounts.set(f.id, (followupCounts.get(f.id) ?? 0) + 1);
  }

  const now = Date.now();
  const cutoff = now - FOLLOWUP_DELAY_DAYS * 24 * 60 * 60 * 1000;
  const articles = await articleCount();

  let sentNow = 0;
  let skipped = 0;

  for (const s of sent) {
    if (s.error) {
      skipped++;
      continue;
    }
    if (respondedIds.has(s.id)) {
      console.log(`  · skipping ${s.id} — vendor responded`);
      skipped++;
      continue;
    }
    if ((followupCounts.get(s.id) ?? 0) >= MAX_FOLLOWUPS_PER_EMAIL) {
      console.log(`  · skipping ${s.id} — already followed up`);
      skipped++;
      continue;
    }
    const sentAt = Date.parse(s.sentAt);
    if (sentAt > cutoff) {
      const daysAgo = Math.floor((now - sentAt) / (24 * 60 * 60 * 1000));
      console.log(`  · skipping ${s.id} — only ${daysAgo} days old (need ≥ ${FOLLOWUP_DELAY_DAYS})`);
      skipped++;
      continue;
    }

    const email = OUTREACH_EMAILS.find((e) => e.id === s.id);
    if (!email) {
      console.log(`  · skipping ${s.id} — original email config missing`);
      skipped++;
      continue;
    }

    const daysSince = Math.floor((now - sentAt) / (24 * 60 * 60 * 1000));
    console.log(`  → following up ${email.vendor} (${daysSince}d since first contact)`);

    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Brady Ostrow <${FROM_ADDRESS}>`,
          to: [email.to],
          reply_to: "bradyostroww@gmail.com",
          subject: `Re: ${email.subject}`,
          text: buildFollowupBody(email.vendor, articles, daysSince),
        }),
      });
      const data = await r.json();
      if (!r.ok) {
        await appendLog(FOLLOWUPS_LOG, { id: s.id, followupAt: new Date().toISOString(), error: JSON.stringify(data) });
        console.log(`    ✗ failed: ${JSON.stringify(data).slice(0, 150)}`);
      } else {
        await appendLog(FOLLOWUPS_LOG, { id: s.id, followupAt: new Date().toISOString(), resendId: data.id });
        console.log(`    ✓ sent (resend id: ${data.id})`);
        sentNow++;
      }
    } catch (e: any) {
      await appendLog(FOLLOWUPS_LOG, { id: s.id, followupAt: new Date().toISOString(), error: e.message });
      console.log(`    ✗ error: ${e.message}`);
    }
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${sentNow} follow-up(s) sent · ${skipped} skipped`);
  console.log(`${"─".repeat(50)}\n`);

  if (sentNow === 0 && skipped === 0) {
    console.log("No outreach emails on file yet. Once you send the 4 vendor emails from the dashboard, this bot will follow up after 7 days.\n");
  }
}

main().catch((err) => {
  console.error("\n✗ Follow-up bot failed:", err.message);
  process.exit(1);
});
