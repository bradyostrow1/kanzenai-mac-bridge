/**
 * Bot 5 · X ENGAGEMENT — quiet compounding reach beyond replies.
 *
 * What it does:
 *   1. LIKES — likes the most recent on-topic post from each named operator
 *      (small daily drip, never bursts). Likes are visible in the operator's
 *      notifications and tend to drive a return-look + sometimes a follow-back.
 *   2. FOLLOWS — slowly follows one new account per run from a curated extras
 *      pool (operators + vendor accounts), capped at 5 follows/day total.
 *
 * Same restraint rules as Bot 4 (x-reply-hunter):
 *   - Reuses the same .audit/x-reply-hunter-stop.txt stop-marker — if either
 *     bot trips it, BOTH back off until Brady clears it.
 *   - Dry-run by default. Posting requires --live.
 *   - Hard caps; no firehose patterns.
 *
 * Usage:
 *   npx tsx scripts/x-engagement.ts             # dry-run preview
 *   npx tsx scripts/x-engagement.ts --live      # actually like + follow
 *
 * Schedule (when Brady enables it): twice daily is plenty. 10 AM + 4 PM ET.
 */
import { TwitterApi, ApiResponseError } from "twitter-api-v2";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
const LIKES_LOG = join(AUDIT_DIR, "x-engagement-likes.log");
const FOLLOWS_LOG = join(AUDIT_DIR, "x-engagement-follows.log");
const STOP_MARKER = join(AUDIT_DIR, "x-reply-hunter-stop.txt"); // shared with Bot 4
const DAY = new Date().toISOString().slice(0, 10);
const RUN_LOG = join(AUDIT_DIR, `x-engagement-${DAY}.log`);

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

const LIVE = process.argv.includes("--live");

const CAPS = {
  likesPerRun: 5,
  followsPerRun: 1,
  followsPerDay: 5,
  perPairSpacingMs: 4500,   // ~4.5s between actions — un-bot-burst
  perTimelineMaxRecent: 3,  // only peek at 3 most recent posts per operator
} as const;

// Same curated operators as Bot 4 — keep these synchronized by hand.
const OPERATORS: string[] = [
  "MikeDelPrete", "RobHahnNotorious", "BradInman",
  "SpencerRascoff", "glennsanford",
  "kevinwardnow", "TheMikeFerry",
  "FollowUpBoss", "Lofty",
];

// Wider list of accounts that are good follow targets but NOT necessarily
// in the active-engagement loop. Drip-followed at most followsPerDay.
const FOLLOW_POOL: string[] = [
  "matt_laricy",        // top-producer Chicago
  "TomFerry",           // RE coaching
  "EmilGirov",          // RE-tech / brokerage exec
  "InmanNews",          // industry publication
  "GaryKeller",         // Keller Williams founder
  "homelight",          // RE-tech brand
  "Compass",            // brokerage
  "ZillowGroup",        // platform
  "realtorcom",         // platform
  // Expand over time, never past ~50.
];

const NICHE_KEYWORDS = [
  "real estate", "realtor", "brokerage", "crm", "lead",
  "ai", "agent tech", "listing", "dialer", "buyer", "seller",
];

const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFile(RUN_LOG, line + "\n").catch(() => {});
}

async function preflight(): Promise<{ ok: boolean; me?: string; reason?: string }> {
  if (existsSync(STOP_MARKER)) {
    const txt = (await readFile(STOP_MARKER, "utf8")).trim();
    return { ok: false, reason: `shared stop-marker present: ${txt}` };
  }
  try {
    const me = await twitter.v2.me({ "user.fields": ["id"] });
    return { ok: true, me: me.data.id };
  } catch (e: any) {
    if (e instanceof ApiResponseError && [401, 403, 429].includes(e.code)) {
      const msg = `preflight HTTP ${e.code}: ${e.data?.title ?? e.message}`;
      await writeFile(STOP_MARKER, `${new Date().toISOString()}\n${msg}\n`);
      log(`STOP — wrote ${STOP_MARKER}: ${msg}`);
      return { ok: false, reason: msg };
    }
    return { ok: false, reason: `preflight error: ${e.message}` };
  }
}

async function alreadyLikedToday(tweetId: string): Promise<boolean> {
  if (!existsSync(LIKES_LOG)) return false;
  const text = await readFile(LIKES_LOG, "utf8");
  return text.split("\n").some((l) => {
    if (!l) return false;
    try { const j = JSON.parse(l); return j.tweetId === tweetId; } catch { return false; }
  });
}

async function followsToday(): Promise<Set<string>> {
  if (!existsSync(FOLLOWS_LOG)) return new Set();
  const text = await readFile(FOLLOWS_LOG, "utf8");
  const out = new Set<string>();
  for (const l of text.split("\n")) {
    if (!l) continue;
    try {
      const j = JSON.parse(l);
      if (j.ts?.slice(0, 10) === DAY) out.add(String(j.username).toLowerCase());
    } catch {}
  }
  return out;
}

async function allTimeFollows(): Promise<Set<string>> {
  if (!existsSync(FOLLOWS_LOG)) return new Set();
  const text = await readFile(FOLLOWS_LOG, "utf8");
  const out = new Set<string>();
  for (const l of text.split("\n")) {
    if (!l) continue;
    try { const j = JSON.parse(l); out.add(String(j.username).toLowerCase()); } catch {}
  }
  return out;
}

async function runLikes(): Promise<number> {
  let liked = 0;
  for (const username of OPERATORS) {
    if (liked >= CAPS.likesPerRun) break;
    try {
      const user = await twitter.v2.userByUsername(username);
      const id = user.data?.id;
      if (!id) continue;
      const timeline = await twitter.v2.userTimeline(id, {
        max_results: CAPS.perTimelineMaxRecent,
        "tweet.fields": ["created_at"],
        exclude: ["replies", "retweets"],
      });
      for (const t of timeline.data?.data ?? []) {
        if (liked >= CAPS.likesPerRun) break;
        const text = t.text.toLowerCase();
        if (!NICHE_KEYWORDS.some((kw) => text.includes(kw))) continue;
        if (await alreadyLikedToday(t.id)) continue;
        log(`  ♥ like → @${username} t:${t.id} "${t.text.slice(0, 80)}…"`);
        if (LIVE) {
          try {
            await twitter.v2.like(await twitter.v2.me().then((r) => r.data.id), t.id);
            await appendFile(LIKES_LOG, JSON.stringify({
              ts: new Date().toISOString(),
              tweetId: t.id,
              username,
            }) + "\n");
            liked++;
          } catch (e: any) {
            log(`    ✗ like failed: ${e.message}`);
            if (e instanceof ApiResponseError && [401, 403, 429].includes(e.code)) {
              await writeFile(STOP_MARKER, `${new Date().toISOString()}\nlike HTTP ${e.code}\n`);
              return liked;
            }
          }
        } else {
          liked++;
        }
        await new Promise((r) => setTimeout(r, CAPS.perPairSpacingMs));
        break; // 1 like per operator per run — keeps pattern un-bot-burst
      }
    } catch (e: any) {
      log(`  · @${username} likes error: ${e.message}`);
      if (e instanceof ApiResponseError && [401, 403, 429].includes(e.code)) {
        await writeFile(STOP_MARKER, `${new Date().toISOString()}\nlike timeline HTTP ${e.code}\n`);
        return liked;
      }
    }
    await new Promise((r) => setTimeout(r, CAPS.perPairSpacingMs));
  }
  return liked;
}

async function runFollows(myId: string): Promise<number> {
  const today = await followsToday();
  const ever = await allTimeFollows();
  if (today.size >= CAPS.followsPerDay) {
    log(`cap: already followed ${today.size}× today`);
    return 0;
  }
  const remaining = CAPS.followsPerDay - today.size;
  let followed = 0;
  for (const username of FOLLOW_POOL) {
    if (followed >= CAPS.followsPerRun || followed >= remaining) break;
    if (ever.has(username.toLowerCase())) continue;
    try {
      const user = await twitter.v2.userByUsername(username);
      const id = user.data?.id;
      if (!id) continue;
      log(`  + follow → @${username}`);
      if (LIVE) {
        await twitter.v2.follow(myId, id);
        await appendFile(FOLLOWS_LOG, JSON.stringify({
          ts: new Date().toISOString(),
          username,
          followedId: id,
        }) + "\n");
      }
      followed++;
      await new Promise((r) => setTimeout(r, CAPS.perPairSpacingMs));
    } catch (e: any) {
      log(`    ✗ follow @${username}: ${e.message}`);
      if (e instanceof ApiResponseError && [401, 403, 429].includes(e.code)) {
        await writeFile(STOP_MARKER, `${new Date().toISOString()}\nfollow HTTP ${e.code}\n`);
        return followed;
      }
    }
  }
  return followed;
}

async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });
  log(`─── x-engagement starting (${LIVE ? "LIVE" : "DRY-RUN"}) ───`);
  const pre = await preflight();
  if (!pre.ok) { log(`abort: ${pre.reason}`); return; }

  const liked = await runLikes();
  const followed = await runFollows(pre.me!);

  log(`─── done (likes=${liked}, follows=${followed}) ───`);
}

main().catch((e) => { log(`FATAL ${e?.stack || e}`); process.exit(1); });
