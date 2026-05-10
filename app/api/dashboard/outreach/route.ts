import { NextResponse } from "next/server";
import { OUTREACH_EMAILS } from "@/lib/outreach";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const maxDuration = 60;

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

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

type SentRecord = { id: string; sentAt: string; resendId?: string; error?: string };

async function readSent(): Promise<Record<string, SentRecord>> {
  if (!existsSync(OUTREACH_LOG)) return {};
  const text = await readFile(OUTREACH_LOG, "utf8");
  const out: Record<string, SentRecord> = {};
  for (const line of text.trim().split("\n").filter(Boolean)) {
    try {
      const r: SentRecord = JSON.parse(line);
      out[r.id] = r;
    } catch {}
  }
  return out;
}

async function appendSent(record: SentRecord) {
  const dir = join(ROOT, ".audit");
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  await writeFile(OUTREACH_LOG, JSON.stringify(record) + "\n", { flag: "a" });
}

// GET /api/dashboard/outreach — list emails + send status
export async function GET() {
  const guard = devGuard();
  if (guard) return guard;
  const sent = await readSent();
  return NextResponse.json({
    emails: OUTREACH_EMAILS.map((e) => ({ ...e, sent: sent[e.id] ?? null })),
    resendConfigured: !!process.env.RESEND_API_KEY,
    fromAddress: process.env.RESEND_FROM ?? "hello@kanzenai.com",
  });
}

// POST /api/dashboard/outreach — body { id: string }
export async function POST(req: Request) {
  const guard = devGuard();
  if (guard) return guard;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "RESEND_API_KEY not in .env.local. Sign up at resend.com, verify kanzenai.com domain, then paste your API key." },
      { status: 500 },
    );
  }

  const fromAddress = process.env.RESEND_FROM ?? "hello@kanzenai.com";
  const body = await req.json();
  const id: string = body.id;
  const email = OUTREACH_EMAILS.find((e) => e.id === id);
  if (!email) {
    return NextResponse.json({ error: `No email with id "${id}"` }, { status: 400 });
  }

  // Check if already sent
  const sent = await readSent();
  if (sent[id]) {
    return NextResponse.json({ error: `Already sent at ${sent[id].sentAt}` }, { status: 409 });
  }

  // Send via Resend
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Brady Ostrow <${fromAddress}>`,
        to: [email.to],
        reply_to: "bradyostroww@gmail.com",
        subject: email.subject,
        text: email.body,
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      const record: SentRecord = { id, sentAt: new Date().toISOString(), error: JSON.stringify(data) };
      await appendSent(record);
      return NextResponse.json({ ok: false, error: data, status: r.status }, { status: r.status });
    }
    const record: SentRecord = { id, sentAt: new Date().toISOString(), resendId: data.id };
    await appendSent(record);
    return NextResponse.json({ ok: true, resendId: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
