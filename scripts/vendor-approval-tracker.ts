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
  network: "awin" | "shareasale" | "impact" | "cj" | "refersion" | "partnerstack";
  vendorSlug: string;   // matches an existing slug in lib/affiliates.ts (or auto-added if not)
  vendorName: string;   // for Telegram alert + auto-add
  trackedUrl: string;   // the deep-link to put in AFFILIATES[slug].url
  commission?: string;  // human-readable, surfaces in registry on auto-add
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

// PartnerStack — most of the AI-tool-shopper programs Brady is applying to
// (Copy.ai, Writesonic, Rytr, Kit/ConvertKit) run on PartnerStack.
// API docs: https://api.partnerstack.com/docs (header `X-PARTNER-Key`).
async function pollPartnerStack(): Promise<Approval[]> {
  const key = process.env.PARTNERSTACK_API_KEY;
  if (!key) { log("partnerstack: no keys, skip"); return []; }
  try {
    const r = await fetch("https://api.partnerstack.com/v2/partnerships", {
      headers: { "X-PARTNER-Key": key, Accept: "application/json" },
    });
    if (!r.ok) { log(`partnerstack: HTTP ${r.status}`); return []; }
    const data: any = await r.json();
    const partnerships = data.data || data.partnerships || [];
    return partnerships
      .filter((p: any) => (p.status || "").toLowerCase() === "approved")
      .map((p: any) => {
        const programName = p.program?.name || p.program_name || p.name || "";
        const trackedUrl = p.tracking_link
          ?? p.partner_link
          ?? p.referral_link
          ?? p.links?.[0]?.url
          ?? "";
        return {
          network: "partnerstack" as const,
          vendorSlug: deriveSlugFromName(programName),
          vendorName: programName,
          trackedUrl,
          commission: p.program?.default_commission_description || undefined,
        };
      })
      .filter((a: Approval) => a.vendorSlug && a.trackedUrl);
  } catch (e: any) {
    log(`partnerstack: error ${e.message}`);
    return [];
  }
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

/**
 * Insert a brand-new vendor entry just before the closing `};` of the
 * AFFILIATES object literal. Preserves formatting so future regex parsing
 * + future autoflips keep working. Network-source noted in a trailing comment.
 */
function insertNewVendor(src: string, a: Approval): string {
  const safeName = a.vendorName.replace(/"/g, '\\"');
  const safeUrl = a.trackedUrl.replace(/"/g, '\\"');
  const commission = a.commission
    ? `, commission: "${a.commission.replace(/"/g, '\\"')}"`
    : "";
  const newEntry =
    `\n  // Auto-added ${new Date().toISOString().slice(0, 10)} on ${a.network} approval\n` +
    `  "${a.vendorSlug}":${" ".repeat(Math.max(1, 22 - a.vendorSlug.length))}` +
    `{ url: "${safeUrl}", name: "${safeName}", status: "live"${commission} },\n`;
  // Insert before the LAST `};` that closes AFFILIATES (the file may have other
  // object literals later, so we anchor on the AFFILIATES block boundary).
  const blockRe = /(export const AFFILIATES[^=]*=\s*\{[\s\S]*?)(^\};)/m;
  return src.replace(blockRe, (_m, body, close) => `${body}${newEntry}${close}`);
}

async function applyUpdates(approvals: Approval[]): Promise<{ flipped: string[]; added: string[] }> {
  if (!approvals.length) return { flipped: [], added: [] };
  const current = await readAffiliates();
  const flipped: string[] = [];
  const added: string[] = [];
  let src = await fs.readFile(AFFILIATES_PATH, "utf8");

  for (const a of approvals) {
    const existing = current.get(a.vendorSlug);

    if (!existing) {
      // Auto-add: registry edit is low-risk per directive's approval gates.
      // The vendor was approved on a real network — keep the entry rather than
      // silently dropping it.
      src = insertNewVendor(src, a);
      added.push(`${a.vendorSlug} (${a.network})`);
      appendFileSync(EVENT_LOG, JSON.stringify({
        ts: new Date().toISOString(),
        event: "added",
        network: a.network,
        vendorSlug: a.vendorSlug,
        vendorName: a.vendorName,
        trackedUrl: a.trackedUrl,
      }) + "\n");
      continue;
    }

    if (existing.status === "live" && existing.url === a.trackedUrl) {
      continue; // already up to date
    }

    // Flip existing placeholder → live, updating URL to the real tracked link.
    const re = new RegExp(
      `("${a.vendorSlug}":\\s*\\{\\s*url:\\s*")[^"]+(",[^}]*?status:\\s*")placeholder(")`,
      "g"
    );
    const next = src.replace(re, (_m, p1, p2, p3) => `${p1}${a.trackedUrl}${p2}live${p3}`);
    if (next !== src) {
      src = next;
      flipped.push(`${a.vendorSlug} (${a.network})`);
      appendFileSync(EVENT_LOG, JSON.stringify({
        ts: new Date().toISOString(),
        event: "flipped",
        network: a.network,
        vendorSlug: a.vendorSlug,
        vendorName: a.vendorName,
        trackedUrl: a.trackedUrl,
      }) + "\n");
    }
  }
  if (flipped.length || added.length) {
    await fs.writeFile(AFFILIATES_PATH, src);
  }
  return { flipped, added };
}

async function pingTelegram(flipped: string[], added: string[]): Promise<void> {
  if (!flipped.length && !added.length) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat  = process.env.TELEGRAM_HOME_CHANNEL;
  if (!token || !chat) { log("telegram: no creds, skip"); return; }
  const lines: string[] = ["💰 KanzenAI affiliate approvals:"];
  if (added.length) {
    lines.push("", "NEW vendors added (auto-live):");
    for (const v of added) lines.push(`  + ${v}`);
  }
  if (flipped.length) {
    lines.push("", "Flipped placeholder → live:");
    for (const v of flipped) lines.push(`  ✓ ${v}`);
  }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: lines.join("\n") }),
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
    ["partnerstack", pollPartnerStack],
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

  const { flipped, added } = await applyUpdates(allApprovals);
  if (flipped.length || added.length) {
    log(`updated lib/affiliates.ts: ${flipped.length} flipped, ${added.length} added`);
    for (const c of added) log(`  + ${c} (new)`);
    for (const c of flipped) log(`  ✓ ${c}`);
    await pingTelegram(flipped, added);
  } else {
    log("no changes to apply (registry already up to date)");
  }
  log("─── done ───");
}

main().catch(e => {
  log(`FATAL: ${e?.stack || e}`);
  process.exit(1);
});
