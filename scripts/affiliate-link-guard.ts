/**
 * affiliate-link-guard — honesty check for live affiliate links.
 *
 * Daily HEAD-checks every vendor in lib/affiliates.ts whose status is "live".
 * If a link 4xx/5xx's for N consecutive runs, alert Telegram so Brady can
 * decide whether to flip it back to "placeholder" (program dropped him) or
 * fix the URL (network changed the deeplink format).
 *
 * Does NOT auto-revert — link drops are usually a relationship event Brady
 * needs to see, not a silent registry rewrite.
 *
 * Output:
 *   .audit/affiliate-link-guard-YYYY-MM-DD.log
 *   .audit/affiliate-link-health.json    (rolling state — consec-fail counters)
 *
 * Schedule: daily 5 AM via scheduler.ts (before the 7 AM audit job).
 */
import { promises as fs } from "node:fs";
import { existsSync, appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
const AFFILIATES_PATH = join(ROOT, "lib", "affiliates.ts");
const STATE_PATH = join(AUDIT_DIR, "affiliate-link-health.json");
const DAY = new Date().toISOString().slice(0, 10);
const RUN_LOG = join(AUDIT_DIR, `affiliate-link-guard-${DAY}.log`);

const ALERT_AFTER_CONSEC_FAILS = 3; // 3 days of failures before Telegram fires
const REQUEST_TIMEOUT_MS = 10_000;
const CONCURRENCY = 5;

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });

function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
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

function log(msg: string) {
  const stamped = `[${new Date().toISOString()}] ${msg}`;
  console.log(stamped);
  try { appendFileSync(RUN_LOG, stamped + "\n"); } catch {}
}

type Vendor = { slug: string; name: string; url: string };

async function readLiveVendors(): Promise<Vendor[]> {
  const src = await fs.readFile(AFFILIATES_PATH, "utf8");
  const blockMatch = src.match(/export const AFFILIATES[^=]*=\s*\{([\s\S]*?)^\};/m);
  if (!blockMatch) return [];
  const out: Vendor[] = [];
  for (const line of blockMatch[1].split("\n")) {
    const m = line.match(/^\s*"([a-z0-9-]+)":\s*\{\s*url:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*status:\s*"live"/);
    if (m) out.push({ slug: m[1], url: m[2], name: m[3] });
  }
  return out;
}

type HealthState = Record<string, { consecFails: number; lastStatus: number | null; lastChecked: string }>;

async function readState(): Promise<HealthState> {
  if (!existsSync(STATE_PATH)) return {};
  try { return JSON.parse(await fs.readFile(STATE_PATH, "utf8")); } catch { return {}; }
}

async function check(v: Vendor): Promise<{ slug: string; ok: boolean; status: number | null }> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    // HEAD first — many CDNs return 405 for HEAD, so fall back to GET.
    let r = await fetch(v.url, { method: "HEAD", redirect: "follow", signal: ctl.signal });
    if (r.status === 405 || r.status === 403) {
      r = await fetch(v.url, { method: "GET", redirect: "follow", signal: ctl.signal });
    }
    return { slug: v.slug, ok: r.ok || r.status === 405, status: r.status };
  } catch (e: any) {
    return { slug: v.slug, ok: false, status: null };
  } finally {
    clearTimeout(t);
  }
}

async function runPool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

async function pingTelegram(failing: { slug: string; name: string; status: number | null; consec: number }[]): Promise<void> {
  if (!failing.length) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_HOME_CHANNEL;
  if (!token || !chat) { log("telegram: no creds, skip"); return; }
  const lines = [`⚠️ KanzenAI link-guard — ${failing.length} live affiliate(s) failing for ${ALERT_AFTER_CONSEC_FAILS}+ days:`];
  for (const f of failing) {
    lines.push(`  - ${f.name} (${f.slug}) — last status ${f.status ?? "timeout"} × ${f.consec} runs`);
  }
  lines.push("", "Decide: flip to placeholder, or fix the URL in lib/affiliates.ts.");
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: lines.join("\n") }),
    });
    log("telegram: alerted");
  } catch (e: any) {
    log(`telegram: ${e.message}`);
  }
}

async function main() {
  log("─── affiliate-link-guard starting ───");
  const vendors = await readLiveVendors();
  log(`live vendors to check: ${vendors.length}`);
  if (!vendors.length) { log("─── done (nothing to check) ───"); return; }

  const state = await readState();
  const results = await runPool(vendors, CONCURRENCY, check);

  const alertList: { slug: string; name: string; status: number | null; consec: number }[] = [];
  for (const r of results) {
    const prev = state[r.slug] ?? { consecFails: 0, lastStatus: null, lastChecked: "" };
    const consec = r.ok ? 0 : prev.consecFails + 1;
    state[r.slug] = {
      consecFails: consec,
      lastStatus: r.status,
      lastChecked: new Date().toISOString(),
    };
    if (consec >= ALERT_AFTER_CONSEC_FAILS) {
      const v = vendors.find(x => x.slug === r.slug)!;
      alertList.push({ slug: r.slug, name: v.name, status: r.status, consec });
    }
  }

  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2));

  const failing = results.filter(r => !r.ok).length;
  log(`results: ${vendors.length - failing} ok, ${failing} failed, ${alertList.length} hit alert threshold`);
  await pingTelegram(alertList);
  log("─── done ───");
}

main().catch(e => {
  log(`FATAL: ${e?.stack || e}`);
  process.exit(1);
});
