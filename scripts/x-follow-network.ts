/**
 * KanzenAI X curated follow bot.
 *
 * The X "who-do-they-follow" endpoint requires Basic tier ($200/mo) which we
 * don't have on Pay-Per-Use. So instead: a curated list of known important
 * real-estate-tech accounts. Verifies each exists + meets the follower floor,
 * then follows them on @KanzenOfficial.
 *
 * Default is dry-run preview. Add --confirm to actually follow.
 *
 * Usage:
 *   npx tsx scripts/x-follow-network.ts            # preview the list
 *   npx tsx scripts/x-follow-network.ts --confirm  # actually follow them
 */
import { TwitterApi } from "twitter-api-v2";
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
const FOLLOWS_LOG = join(AUDIT_DIR, "x-follows.log");

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

const CONFIRM = process.argv.includes("--confirm");
const MIN_FOLLOWERS = 5_000;

const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

// Curated list of important real-estate-tech / agent-influencer accounts.
// Mix of: industry analysts, coaches, brokerage execs, tech founders, publications.
// Intentionally small — quality > quantity for a brand-new account.
const CURATED_FOLLOWS: Array<{ username: string; reason: string }> = [
  // Industry analysts / strategists
  { username: "MikeDelPrete", reason: "RE tech analyst, writes about CRM/brokerage trends" },
  { username: "RobHahnNotorious", reason: "RE strategy commentator, ex-1000Watt" },
  { username: "BradInman", reason: "Founder of Inman News" },

  // Brokerage / industry execs
  { username: "SpencerRascoff", reason: "Zillow co-founder" },
  { username: "glennsanford", reason: "Founder of eXp Realty" },

  // Agent influencers + coaches (different from target list)
  { username: "matt_laricy", reason: "Chicago top-producer, agent advice" },
  { username: "kevinwardnow", reason: "Real Estate coaching, scripts" },
  { username: "TheMikeFerry", reason: "OG real estate coach" },

  // Real-estate tech founders
  { username: "FollowUpBoss", reason: "FUB official — vendor relationship" },
  { username: "Lofty", reason: "Lofty AI (formerly Chime) — vendor relationship" },
];

async function getMyUserId(): Promise<string> {
  return process.env.X_ACCESS_TOKEN!.split("-")[0];
}

async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });
  const myId = await getMyUserId();

  console.log(`→ Verifying ${CURATED_FOLLOWS.length} curated accounts...\n`);

  const valid: Array<{ username: string; id: string; followers: number; reason: string; name: string; bio: string }> = [];
  const skipped: Array<{ username: string; reason: string }> = [];

  for (const entry of CURATED_FOLLOWS) {
    try {
      const r = await twitter.v2.userByUsername(entry.username, {
        "user.fields": ["public_metrics", "description"],
      });
      if (!r.data?.id) {
        skipped.push({ username: entry.username, reason: "account not found" });
        continue;
      }
      const followers = r.data.public_metrics?.followers_count ?? 0;
      if (followers < MIN_FOLLOWERS) {
        skipped.push({ username: entry.username, reason: `only ${followers.toLocaleString()} followers (min ${MIN_FOLLOWERS.toLocaleString()})` });
        continue;
      }
      valid.push({
        username: entry.username,
        id: r.data.id,
        followers,
        reason: entry.reason,
        name: r.data.name,
        bio: r.data.description ?? "",
      });
    } catch (e) {
      skipped.push({ username: entry.username, reason: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`→ ${valid.length} valid · ${skipped.length} skipped\n`);

  if (skipped.length > 0) {
    console.log("Skipped:");
    for (const s of skipped) console.log(`  · @${s.username} — ${s.reason}`);
    console.log();
  }

  console.log("To follow:");
  for (const v of valid) {
    console.log(`  · @${v.username} (${v.name}) — ${v.followers.toLocaleString()} followers`);
    console.log(`      Why: ${v.reason}`);
    console.log(`      Bio: ${v.bio.slice(0, 100).replace(/\n/g, " ")}${v.bio.length > 100 ? "…" : ""}`);
    console.log();
  }

  if (!CONFIRM) {
    console.log("DRY RUN. Re-run with --confirm to actually follow these accounts.");
    return;
  }

  console.log(`→ Following ${valid.length} accounts...\n`);
  let success = 0;
  let failed = 0;
  for (const v of valid) {
    try {
      await twitter.v2.follow(myId, v.id);
      console.log(`  ✓ Followed @${v.username}`);
      await appendFile(FOLLOWS_LOG, JSON.stringify({
        ts: new Date().toISOString(),
        followedId: v.id,
        username: v.username,
        followers: v.followers,
        reason: v.reason,
      }) + "\n");
      success++;
      // Spread between follows so it doesn't look bot-burst
      await new Promise((r) => setTimeout(r, 3000));
    } catch (e) {
      failed++;
      console.log(`  ✗ @${v.username}: ${(e as Error).message}`);
    }
  }
  console.log(`\n✓ Followed ${success}, failed ${failed}.`);
}

main().catch((err) => { console.error("\n✗ Fatal:", err.message); process.exit(1); });
