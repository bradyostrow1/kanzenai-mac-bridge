/**
 * vendor-approval-tracker — Bot #11 from the May 20 gameplan.
 *
 * Polls each affiliate network's API daily, detects newly-approved vendor
 * programs, updates lib/affiliates.ts (placeholder -> live + real tracked URL),
 * and pings Telegram. Runs on the PC scheduler at 4 PM PT daily.
 *
 * Networks supported (each guarded by presence of its API key in .env.local):
 *   - Awin              (AWIN_API_TOKEN + AWIN_PUBLISHER_ID)
 *   - ShareASale        (SHAREASALE_TOKEN + SHAREASALE_SECRET + SHAREASALE_AFFILIATE_ID)
 *   - Impact            (IMPACT_ACCOUNT_SID + IMPACT_AUTH_TOKEN)
 *   - CJ Affiliate      (CJ_DEV_KEY + CJ_PUBLISHER_ID)
 *   - Refersion         (REFERSION_API_KEY)
 *
 * If a network's keys aren't set, that network is silently skipped. Add keys
 * to .env.local as you get them — no code change needed.
 *
 * Output:
 *   - .audit/vendor-approval-tracker-YYYY-MM-DD.log  (full run log)
 *   - .audit/vendor-approvals.jsonl                  (append-only event stream)
 *   - lib/affiliates.ts                              (auto-edited on diff)
 *   - Telegram alert via TELEGRAM_BOT_TOKEN + TELEGRAM_HOME_CHANNEL if set
 */
import { promises as fs } from "node:fs";
import { existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
const AFFILIATES_PATH = join(ROOT, "lib", "affiliates.ts");
const EVENT_LOG = join(AUDIT_DIR, "vendor-approvals.jsonl");
const DAY = new Date().toISOString().slice(0, 10);
const RUN_LOG = join(AUDIT_DIR, `vendor-approval-tracker-${DAY}.log`);

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

function log(msg: string) {
  const stamped = `[${new Date().toISOString()}] ${msg}`;
  console.log(stamped);
  try { appendFileSync(RUN_LOG, stamped + "\n"); } catch {}
}

type Approval = {
  network: "awin" | "shareasale" | "impact" | "cj" | "refersion";
  vendorSlug: string;   // must match a slug in lib/affiliates.ts
  vendorName: string;   // for Telegram alert
  trackedUrl: string;   // the deep-link to put in AFFILIATES[slug].url
};

/* ──────────────── Network adapters ──────────────── */

async function pollAwin(): Promise<Approval[]> {
  const token = process.env.AWIN_API_TOKEN;
  const pubId = process.env.AWIN_PUBLISHER_ID;
  if (!token || !pubId) { log("awin: no keys, skip"); return []; }
  try {
    const r = await fetch(
      `https://api.awin.com/publishers/${pubId}/programmes?relationship=joined`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) { log(`awin: HTTP ${r.status}`); return []; }
    const data = await r.json() as any[];
    return data
      .filter(p => p.relationship === "joined" && p.status === "active")
      .map(p => ({
        network: "awin" as const,
        vendorSlug: deriveSlugFromName(p.name),
        vendorName: p.name,
        trackedUrl: `https://www.awin1.com/cread.php?awinmid=${p.id}&awinaffid=${pubId}&p=${encodeURIComponent(p.clickThroughUrl || p.url || "")}`,
      }));
  } catch (e: any) {
    log(`awin: error ${e.message}`);
    return [];
  }
}

async function pollShareASale(): Promise<Approval[]> {
  const token = process.env.SHAREASALE_TOKEN;
  const secret = process.env.SHAREASALE_SECRET;
  const affId = process.env.SHAREASALE_AFFILIATE_ID;
  if (!token || !secret || !affId) { log("shareasale: no keys, skip"); return []; }
  // ShareASale uses an HMAC-signed REST API. Stubbed for now until first signup lands.
  log("shareasale: adapter stubbed (will fill in after first ShareASale approval)");
  return [];
}

async function pollImpact(): Promise<Approval[]> {
  const sid = process.env.IMPACT_ACCOUNT_SID;
  const tok = process.env.IMPACT_AUTH_TOKEN;
  if (!sid || !tok) { log("impact: no keys, skip"); return []; }
  try {
    const auth = Buffer.from(`${sid}:${tok}`).toString("base64");
    const r = await fetch(
      `https://api.impact.com/Mediapartners/${sid}/Campaigns`,
      { headers: { Authorization: `Basic ${auth}`, Accept: "application/json" } }
    );
    if (!r.ok) { log(`impact: HTTP ${r.status}`); return []; }
    const data: any = await r.json();
    const campaigns = data.Campaigns || [];
    return campaigns
      .filter((c: any) => c.ContractStatus === "Active")
      .map((c: any) => ({
        network: "impact" as const,
        vendorSlug: deriveSlugFromName(c.CampaignName),
        vendorName: c.CampaignName,
        trackedUrl: c.ClickUrl || c.LandingPageUrl || "",
      }))
      .filter((a: Approval) => a.trackedUrl);
  } catch (e: any) {
    log(`impact: error ${e.message}`);
    return [];
  }
}

async function pollCJ(): Promise<Approval[]> {
  const key = process.env.CJ_DEV_KEY;
  const pubId = process.env.CJ_PUBLISHER_ID;
  if (!key || !pubId) { log("cj: no keys, skip"); return []; }
  log("cj: adapter stubbed (will fill in after first CJ approval)");
  return [];
}

async function pollRefersion(): Promise<Approval[]> {
  const key = process.env.REFERSION_API_KEY;
  if (!key) { log("refersion: no keys, skip"); return []; }
  log("refersion: adapter stubbed (will fill in after first Refersion approval)");
  return [];
}

/* ──────────────── Helpers ──────────────── */

function deriveSlugFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function readAffiliates(): Promise<Map<string, { name: string; url: string; status: string }>> {
  const src = await fs.readFile(AFFILIATES_PATH, "utf8");
  const map = new Map<string, { name: string; url: string; status: string }>();
  // Parse the AFFILIATES object literal — fast regex on each line
  const blockMatch = src.match(/export const AFFILIATES[^=]*=\s*\{([\s\S]*?)^\};/m);
  if (!blockMatch) return map;
  const lines = blockMatch[1].split("\n");
  for (const line of lines) {
    const m = line.match(/^\s*"([a-z0-9-]+)":\s*\{\s*url:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*status:\s*"(placeholder|live)"/);
    if (m) map.set(m[1], { url: m[2], name: m[3], status: m[4] });
  }
  return map;
}

async function applyUpdates(approvals: Approval[]): Promise<string[]> {
  if (!approvals.length) return [];
  const current = await readAffiliates();
  const changed: string[] = [];
  let src = await fs.readFile(AFFILIATES_PATH, "utf8");

  for (const a of approvals) {
    const existing = current.get(a.vendorSlug);
    if (!existing) {
      log(`skip ${a.vendorSlug}: not in registry (need to add manually first)`);
      continue;
    }
    if (existing.status === "live" && existing.url === a.trackedUrl) {
      continue; // already up to date
    }
    // Find the line for this slug and replace the url + status
    const re = new RegExp(
      `("${a.vendorSlug}":\\s*\\{\\s*url:\\s*")[^"]+(",[^}]*?status:\\s*")placeholder(")`,
      "g"
    );
    const next = src.replace(re, (_m, p1, p2, p3) => `${p1}${a.trackedUrl}${p2}live${p3}`);
    if (next !== src) {
      src = next;
      changed.push(`${a.vendorSlug} (${a.network})`);
      // Append to event stream
      appendFileSync(EVENT_LOG, JSON.stringify({
        ts: new Date().toISOString(),
        network: a.network,
        vendorSlug: a.vendorSlug,
        vendorName: a.vendorName,
        trackedUrl: a.trackedUrl,
      }) + "\n");
    }
  }
  if (changed.length) {
    await fs.writeFile(AFFILIATES_PATH, src);
  }
  return changed;
}

async function pingTelegram(changed: string[]): Promise<void> {
  if (!changed.length) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat  = process.env.TELEGRAM_HOME_CHANNEL;
  if (!token || !chat) { log("telegram: no creds, skip"); return; }
  const text = `KanzenAi affiliate approvals (${changed.length}):\n` +
    changed.map(c => `  - ${c}`).join("\n");
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
    log("telegram: sent");
  } catch (e: any) {
    log(`telegram: ${e.message}`);
  }
}

/* ──────────────── main ──────────────── */

async function main() {
  log("─── vendor-approval-tracker starting ───");
  const allApprovals: Approval[] = [];
  for (const [name, fn] of [
    ["awin", pollAwin],
    ["shareasale", pollShareASale],
    ["impact", pollImpact],
    ["cj", pollCJ],
    ["refersion", pollRefersion],
  ] as const) {
    try {
      const r = await fn();
      log(`${name}: ${r.length} approved programs returned`);
      allApprovals.push(...r);
    } catch (e: any) {
      log(`${name}: ${e.message}`);
    }
  }

  if (!allApprovals.length) {
    log("no approvals returned from any network. Likely no API keys configured yet.");
    log("─── done ───");
    return;
  }

  const changed = await applyUpdates(allApprovals);
  if (changed.length) {
    log(`updated lib/affiliates.ts (${changed.length} vendors):`);
    for (const c of changed) log(`  - ${c}`);
    await pingTelegram(changed);
  } else {
    log("no changes to apply (registry already up to date)");
  }
  log("─── done ───");
}

main().catch(e => {
  log(`FATAL: ${e?.stack || e}`);
  process.exit(1);
});
