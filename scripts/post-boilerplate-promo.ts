/**
 * Standalone weekly boilerplate promo. Runs once a week (Tuesday 10 AM via
 * launchd) and posts a single fresh tweet promoting kanzenai.com/boilerplate.
 *
 * Replaces the old "3rd-reply promo" inside post-to-x.ts and post-x-thread.ts,
 * which was tanking the main post's reach via author_diversity_scorer decay.
 *
 * Usage:
 *   npx tsx scripts/post-boilerplate-promo.ts          # post live
 *   npx tsx scripts/post-boilerplate-promo.ts --dry    # preview
 */
import { TwitterApi } from "twitter-api-v2";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT = join(ROOT, ".audit");
const LOG_PATH = join(AUDIT, "boilerplate-promos.log");

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

const DRY = process.argv.includes("--dry") || process.argv.includes("--dry-run");

const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

// Rotate through several variants so the weekly promo doesn't read as a
// canned ad. Each variant focuses on a different angle (proof, stack, price).
const VARIANTS = [
  `KanzenAI publishes 3 articles a day, auto-tweets them, runs a daily X thread, and captures emails — all from one codebase I built. Selling it as a boilerplate.\n\n$149 → kanzenai.com/boilerplate`,
  `The Next.js + Claude stack behind kanzenai.com is now a boilerplate.\n\n9 cron jobs, 11-check audit bot, X auto-poster, email capture, localhost dashboard.\n\n$149, one-time, lifetime updates → kanzenai.com/boilerplate`,
  `Tried to find a "publish + market itself" stack and there wasn't one. Built it for KanzenAI, now selling the codebase.\n\nClaude writes the articles. The X bots tweet them. The dashboard runs the show.\n\n$149 → kanzenai.com/boilerplate`,
  `What it does:\n→ Auto-writes 3 affiliate review articles/day\n→ Auto-tweets each one\n→ Daily 5-tweet thread\n→ Email capture + welcome\n→ Dashboard with chat orchestration\n\n$149 → kanzenai.com/boilerplate`,
];

async function main() {
  if (!existsSync(AUDIT)) await mkdir(AUDIT, { recursive: true });
  const text = VARIANTS[Math.floor(Math.random() * VARIANTS.length)];
  console.log("─── Boilerplate promo preview ───");
  console.log(text);
  console.log("─────────────────────────────────");
  if (DRY) {
    console.log("· DRY — not posting");
    return;
  }
  const r = await twitter.v2.tweet(text);
  console.log(`✓ Posted: https://x.com/i/web/status/${r.data.id}`);
  await appendFile(LOG_PATH, JSON.stringify({
    ts: new Date().toISOString(),
    tweetId: r.data.id,
    text,
  }) + "\n");
}

main().catch((e) => { console.error("✗ Fatal:", e.message); process.exit(1); });
