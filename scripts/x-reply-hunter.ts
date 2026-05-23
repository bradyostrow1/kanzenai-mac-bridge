/**
 * Bot 4 · X REPLY HUNTER — replaces the legacy scripts/auto-reply.ts.
 *
 * Why this rebuild exists: the old auto-reply burned paid `twitter.v2.search`
 * every 15 minutes and posted ~0 replies because the bio-match filter rejected
 * almost every candidate. See `scripts/auto-reply.ts` REBUILD PLAN header.
 *
 * RULES — DO NOT SOFTEN WITHOUT BRADY:
 *   1. NO `twitter.v2.search` (that endpoint costs real $). Read user
 *      timelines from a NAMED OPERATOR list instead — every candidate is
 *      already pre-qualified, and reads are cheap.
 *   2. HUMAN PACE. Hard cap: 1 reply per run, no reply if last was <90 min
 *      ago, no reply to the same target more than once per UTC day,
 *      max 8 replies per UTC day, never reply to posts > 90 min old.
 *   3. Value-first drafts. Claude must produce a substantive reply (no
 *      "great post!", no hashtag-stuff, no @-stuff). If Claude SKIPs, we SKIP.
 *   4. Cap Claude calls per cycle at 5 — even if 20 candidates qualify.
 *      The bot is allowed to walk away.
 *   5. DRY-RUN BY DEFAULT. Posting requires --live.
 *      Even with --live, the X account-protection back-off (below) can override.
 *   6. ACCOUNT-PROTECTION BACK-OFF: if the X API returns 429 (rate-limited)
 *      or 401/403 (token issue) during any read, stop the run immediately
 *      and write a stop-marker to .audit/x-reply-hunter-stop.txt. Subsequent
 *      runs read the marker and refuse to post until Brady deletes it.
 *      This is the "X flags us → back off" rule from the directive.
 *
 * Usage:
 *   npx tsx scripts/x-reply-hunter.ts             # dry-run preview (default)
 *   npx tsx scripts/x-reply-hunter.ts --live      # actually post (one reply max)
 *
 * Schedule (when Brady enables it): every 60 minutes is plenty.
 */
import { TwitterApi, ApiResponseError } from "twitter-api-v2";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { loadStrategy } from "../lib/x-strategy.js";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const POSTED_LOG = join(AUDIT_DIR, "x-reply-hunter-posted.log");
const STOP_MARKER = join(AUDIT_DIR, "x-reply-hunter-stop.txt");
const DAY = new Date().toISOString().slice(0, 10);
const RUN_LOG = join(AUDIT_DIR, `x-reply-hunter-${DAY}.log`);

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

// ─── Caps — hard limits, enforced before any post ─────────────────
const CAPS = {
  maxRepliesPerDay: 8,
  minMinutesBetweenReplies: 90,
  maxTweetAgeMinutes: 90,
  maxClaudeDraftsPerRun: 5,
  maxRepliesPerRun: 1,            // human-pace: one drop at a time
  perTimelineMaxRecent: 5,        // pull only the 5 most recent posts per operator
} as const;

// Named-operator list + niche keywords come from config/x-strategy.json
// (managed by Bot 11 · X Strategist). Hard rails in lib/x-strategy.ts make
// sure a malformed config can never break this bot.
const STRATEGY = loadStrategy();
const OPERATORS: string[] = STRATEGY.operators;
const NICHE_KEYWORDS: string[] = STRATEGY.niche_keywords;

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

type PostedEntry = {
  ts: string;
  tweetId: string;
  targetUser: string;
  postedTweetId: string;
  text: string;
};

async function readPosted(): Promise<PostedEntry[]> {
  if (!existsSync(POSTED_LOG)) return [];
  const text = await readFile(POSTED_LOG, "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l) as PostedEntry; } catch { return null; } })
    .filter((x): x is PostedEntry => x !== null);
}

function todayUtc(d: string): boolean {
  return d.slice(0, 10) === DAY;
}

function repliedToTargetToday(posted: PostedEntry[], username: string): boolean {
  return posted.some((p) => todayUtc(p.ts) && p.targetUser.toLowerCase() === username.toLowerCase());
}

function alreadyReplied(posted: PostedEntry[], tweetId: string): boolean {
  return posted.some((p) => p.tweetId === tweetId);
}

function recentRepliesCount(posted: PostedEntry[]): number {
  return posted.filter((p) => todayUtc(p.ts)).length;
}

function minutesSinceLastReply(posted: PostedEntry[]): number {
  const today = posted.filter((p) => todayUtc(p.ts));
  if (!today.length) return Infinity;
  const last = today[today.length - 1];
  return (Date.now() - Date.parse(last.ts)) / 60_000;
}

async function loadCorpus(): Promise<string> {
  // Compact corpus: titles + first 300 chars of each article. Enough for Claude
  // to pull a real data point without blowing the context window.
  async function pluck(dir: string): Promise<string[]> {
    if (!existsSync(dir)) return [];
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(dir);
    const out: string[] = [];
    for (const f of files.filter((x) => x.endsWith(".json"))) {
      try {
        const j = JSON.parse(await readFile(join(dir, f), "utf8"));
        const body = (j.sections ?? []).map((s: any) => s.text ?? "").join(" ").slice(0, 300);
        out.push(`# ${j.title}\n${j.description ?? ""}\n${body}`);
      } catch {}
    }
    return out;
  }
  const arts = await pluck(ARTICLES_DIR);
  const comps = await pluck(COMPARISONS_DIR);
  return [...arts, ...comps].join("\n\n");
}

/** Touches the X "me" endpoint cheaply. If 429/401/403, set the stop-marker
 *  so all subsequent runs short-circuit until Brady clears it. */
async function preflight(): Promise<{ ok: boolean; reason?: string }> {
  if (existsSync(STOP_MARKER)) {
    const txt = (await readFile(STOP_MARKER, "utf8")).trim();
    return { ok: false, reason: `stop-marker present: ${txt}` };
  }
  try {
    await twitter.v2.me({ "user.fields": ["id"] });
    return { ok: true };
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

type Candidate = {
  tweetId: string;
  username: string;
  text: string;
  createdAt: string;
};

async function pullCandidates(): Promise<Candidate[]> {
  const cutoff = Date.now() - CAPS.maxTweetAgeMinutes * 60_000;
  const candidates: Candidate[] = [];
  for (const username of OPERATORS) {
    try {
      const user = await twitter.v2.userByUsername(username);
      const id = user.data?.id;
      if (!id) continue;
      const timeline = await twitter.v2.userTimeline(id, {
        max_results: CAPS.perTimelineMaxRecent,
        "tweet.fields": ["created_at", "public_metrics"],
        exclude: ["replies", "retweets"],
      });
      for (const t of timeline.data?.data ?? []) {
        if (!t.created_at) continue;
        if (Date.parse(t.created_at) < cutoff) continue;
        const text = t.text.toLowerCase();
        if (!NICHE_KEYWORDS.some((kw) => text.includes(kw))) continue;
        candidates.push({
          tweetId: t.id,
          username,
          text: t.text,
          createdAt: t.created_at,
        });
      }
    } catch (e: any) {
      // 429 or 401 should hard-stop the whole run via preflight; non-fatal errors
      // for a single operator just skip them.
      if (e instanceof ApiResponseError && [401, 403, 429].includes(e.code)) {
        await writeFile(STOP_MARKER, `${new Date().toISOString()}\ntimeline ${username} HTTP ${e.code}\n`);
        log(`STOP — wrote ${STOP_MARKER} during @${username}: HTTP ${e.code}`);
        throw e;
      }
      log(`  · @${username} timeline error: ${e.message}`);
    }
    // gentle pace between user lookups
    await new Promise((r) => setTimeout(r, 600));
  }
  return candidates;
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

async function draftReply(c: Candidate, corpus: string): Promise<string | null> {
  const system = `You are a senior real-estate-tech operator writing replies on X as @KanzenOfficial. Strict rules:
- Reply must add a specific, useful data point or a pointed counter-take.
- Sound like a peer founder/operator, NOT a brand account. Lowercase ok.
- Under 250 characters.
- Never start with @, never use hashtags, never say "great post" / "interesting take".
- If you cannot say something genuinely substantive in 250 chars, output exactly: SKIP`;
  const userMsg = `Tweet from @${c.username}:
"${c.text}"

KanzenAI research notes (use a real data point if relevant, otherwise SKIP):
${corpus.slice(0, 6000)}

Reply or SKIP.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      system,
      messages: [{ role: "user", content: userMsg }],
    }),
  });
  if (!r.ok) { log(`  · Claude HTTP ${r.status}`); return null; }
  const j: any = await r.json();
  const text = (j.content?.[0]?.text ?? "").trim();
  if (!text || text === "SKIP" || text.startsWith("@") || text.includes("#") || text.length > 280) return null;
  return text;
}

async function postReply(c: Candidate, text: string): Promise<string | null> {
  try {
    const r = await twitter.v2.tweet(text, { reply: { in_reply_to_tweet_id: c.tweetId } });
    return r.data.id;
  } catch (e: any) {
    if (e instanceof ApiResponseError && [401, 403, 429].includes(e.code)) {
      await writeFile(STOP_MARKER, `${new Date().toISOString()}\npost HTTP ${e.code}\n`);
      log(`STOP — wrote ${STOP_MARKER} on post: HTTP ${e.code}`);
    }
    log(`  ✗ post failed: ${e.message}`);
    return null;
  }
}

async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });
  log(`─── x-reply-hunter starting (${LIVE ? "LIVE" : "DRY-RUN"}) ───`);

  const pre = await preflight();
  if (!pre.ok) { log(`abort: ${pre.reason}`); return; }

  const posted = await readPosted();
  if (recentRepliesCount(posted) >= CAPS.maxRepliesPerDay) {
    log(`cap: already replied ${CAPS.maxRepliesPerDay}× today — done`);
    return;
  }
  const sinceLast = minutesSinceLastReply(posted);
  if (sinceLast < CAPS.minMinutesBetweenReplies) {
    log(`cap: last reply ${sinceLast.toFixed(0)}min ago (min ${CAPS.minMinutesBetweenReplies}) — done`);
    return;
  }

  let candidates: Candidate[];
  try { candidates = await pullCandidates(); }
  catch { return; }
  log(`candidates: ${candidates.length}`);

  // Filter: not already replied, not target-used today
  const fresh = candidates.filter((c) => !alreadyReplied(posted, c.tweetId) && !repliedToTargetToday(posted, c.username));
  log(`fresh after de-dupe: ${fresh.length}`);
  if (!fresh.length) { log("nothing fresh — done"); return; }

  const corpus = await loadCorpus();
  let drafts = 0;
  let replied = 0;

  for (const c of fresh) {
    if (drafts >= CAPS.maxClaudeDraftsPerRun) { log(`cap: hit ${drafts} drafts — stopping`); break; }
    if (replied >= CAPS.maxRepliesPerRun) break;
    drafts++;
    log(`  → drafting reply to @${c.username} t:${c.tweetId}`);
    const draft = await draftReply(c, corpus);
    if (!draft) { log(`    · SKIP (no substantive draft)`); continue; }

    log(`    · draft (${draft.length} chars): ${draft}`);

    if (!LIVE) { log(`    · dry-run — not posted`); continue; }

    const postedId = await postReply(c, draft);
    if (!postedId) break; // probably stop-marker now set
    await appendFile(POSTED_LOG, JSON.stringify({
      ts: new Date().toISOString(),
      tweetId: c.tweetId,
      targetUser: c.username,
      postedTweetId: postedId,
      text: draft,
    } satisfies PostedEntry) + "\n");
    log(`    ✓ posted https://x.com/i/web/status/${postedId}`);
    replied++;
  }

  log(`─── done (drafts=${drafts}, replied=${replied}) ───`);
}

main().catch((e) => { log(`FATAL ${e?.stack || e}`); process.exit(1); });
