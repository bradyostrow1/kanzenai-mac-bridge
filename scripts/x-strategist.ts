/**
 * Bot 11 · X STRATEGIST — the meta-bot that tunes the other X bots.
 *
 * What it does (daily):
 *   1. Scan the named-operator timelines (reuses lib/x-strategy.ts operators
 *      list). Collect each tweet's age + public_metrics. Reads only — never
 *      the paid twitter.v2.search endpoint.
 *   2. Ask Claude to extract patterns: which formats (thread/single/list/
 *      question) earn the most public-metric weight, what topics are gaining,
 *      what hours posted, which operator surface earns the highest CTR-proxy
 *      (impression_count vs reply_count).
 *   3. Propose a new x-strategy.json based on the patterns. Hard rails in
 *      lib/x-strategy.ts MUST pass before the proposal is even considered.
 *   4. APPLY (or DRY-RUN): snapshot the previous live config to
 *      .audit/x-strategy-versions/, write the new one, append a row to
 *      config/x-strategy-changelog.jsonl, ping Telegram one line.
 *
 * Hard rails it cannot cross (enforced in lib/x-strategy.ts validate()):
 *   - NICHE LOCK (must reference real-estate/AI-tools/productivity)
 *   - VOICE LOCK (no Brady/personal/edgy persona)
 *   - NO RAGE-BAIT (no politics/drama/outrage/cancel terms)
 *   - MONEY METRIC (this script's Claude prompt explicitly optimizes for
 *     followers + profile clicks + link clicks, NEVER raw likes/RT)
 *   - SPAM-SAFE (aborts if .audit/x-reply-hunter-stop.txt exists)
 *
 * Freeze: if config.frozen === true, exits without changing anything.
 * Undo: scripts/x-strategy-undo.ts restores the most recent versioned snapshot.
 *
 * Usage:
 *   npx tsx scripts/x-strategist.ts             # dry-run preview (default)
 *   npx tsx scripts/x-strategist.ts --live      # actually update the config
 */
import { TwitterApi, ApiResponseError } from "twitter-api-v2";
import { promises as fs } from "node:fs";
import { existsSync, readFileSync, mkdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { loadStrategy, validate, X_STRATEGY_PATHS, type XStrategy } from "../lib/x-strategy.js";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
const STOP_MARKER = join(AUDIT_DIR, "x-reply-hunter-stop.txt"); // shared with Bots 4 + 5
const DAY = new Date().toISOString().slice(0, 10);
const RUN_LOG = join(AUDIT_DIR, `x-strategist-${DAY}.log`);

if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
if (!existsSync(X_STRATEGY_PATHS.versionsDir)) mkdirSync(X_STRATEGY_PATHS.versionsDir, { recursive: true });

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

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try { appendFileSync(RUN_LOG, line + "\n"); } catch {}
}

const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

type Scan = {
  operator: string;
  tweets: Array<{
    id: string;
    text: string;
    created_at: string;
    impressions: number;
    likes: number;
    replies: number;
    retweets: number;
    quotes: number;
  }>;
};

async function scanOperators(operators: string[]): Promise<Scan[]> {
  const scans: Scan[] = [];
  for (const username of operators) {
    try {
      const user = await twitter.v2.userByUsername(username);
      const id = user.data?.id;
      if (!id) continue;
      const timeline = await twitter.v2.userTimeline(id, {
        max_results: 10,
        "tweet.fields": ["created_at", "public_metrics"],
        exclude: ["replies", "retweets"],
      });
      const tweets = (timeline.data?.data ?? []).map((t) => ({
        id: t.id,
        text: t.text,
        created_at: t.created_at!,
        impressions: (t.public_metrics as any)?.impression_count ?? 0,
        likes: t.public_metrics?.like_count ?? 0,
        replies: t.public_metrics?.reply_count ?? 0,
        retweets: t.public_metrics?.retweet_count ?? 0,
        quotes: t.public_metrics?.quote_count ?? 0,
      }));
      scans.push({ operator: username, tweets });
    } catch (e: any) {
      if (e instanceof ApiResponseError && [401, 403, 429].includes(e.code)) {
        // shared back-off
        await fs.writeFile(STOP_MARKER, `${new Date().toISOString()}\nstrategist scan HTTP ${e.code}\n`);
        log(`STOP — wrote ${STOP_MARKER} during @${username}: HTTP ${e.code}`);
        throw e;
      }
      log(`  · @${username} scan error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  return scans;
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;

type Proposal = {
  preferred_post_hours_local: number[];
  thread_vs_single_ratio: number;
  topic_emphasis: string;
  last_scan_summary: NonNullable<XStrategy["last_scan_summary"]>;
  reasoning: string;
};

async function askClaudeForProposal(current: XStrategy, scans: Scan[]): Promise<Proposal | null> {
  // Compact the scan to keep tokens reasonable.
  const compact = scans.flatMap((s) =>
    s.tweets.map((t) => ({
      op: s.operator,
      hour_utc: new Date(t.created_at).getUTCHours(),
      reply_to_impr: t.impressions ? +(t.replies / t.impressions * 1000).toFixed(2) : 0,
      replies: t.replies,
      retweets: t.retweets,
      impressions: t.impressions,
      text_excerpt: t.text.slice(0, 180).replace(/\n/g, " "),
    }))
  );

  const system = `You are the X growth strategist for KanzenAI, a faceless editorial site about real-estate-tech and AI tools for agents. Your one job: propose tuning the strategy config so the OTHER bots ride what's actually working in the niche this week.

NON-NEGOTIABLE RULES — failing any means output exactly: ABORT
  1. NICHE LOCK: stay inside real-estate-tech / AI-tools / agent-productivity.
  2. VOICE LOCK: faceless "KanzenAI Team" voice. Never propose anything edgy / personal / hot-take / Brady-as-a-character.
  3. NO RAGE-BAIT: never recommend politics, drama, outrage, controversy, hot-take formats — even if trending.
  4. MONEY METRIC: optimize for followers + profile clicks + ARTICLE LINK CLICKS. Raw likes / RT vanity is worthless. Replies and impressions are proxies for what drives a profile click (the goal).
  5. SPAM-SAFE: never recommend tactics that look like spam to X (mass-tag, identical-replies, follow-burst, hashtag-stuffing).

OUTPUT: strict JSON, no prose, no markdown fences. Shape:
{
  "preferred_post_hours_local": [<2-4 ints in 0..23 — best hours US Eastern (UTC-5) to post>],
  "thread_vs_single_ratio": <0..1 float — share of posts that should be threads>,
  "topic_emphasis": "<1-2 sentence steer for the topic-picker bot. MUST contain at least one of: 'real estate', 'realtor', 'agent', 'ai', 'tools', 'productivity'. Max 240 chars. Empty string '' is allowed if no clear signal.>",
  "trending_formats": [<2-4 short strings describing formats getting traction, e.g. "pricing-reveal-single", "tool-teardown-thread">],
  "trending_topics": [<2-4 short topic strings inside the niche>],
  "operator_engagement_top3": [<top 3 operator usernames from the scan by replies-per-impression>],
  "reasoning": "<2-3 sentences explaining the most important change you propose and WHY based on the scan>"
}`;

  const user = `CURRENT live strategy:
${JSON.stringify({
    preferred_post_hours_local: current.preferred_post_hours_local,
    thread_vs_single_ratio: current.thread_vs_single_ratio,
    topic_emphasis: current.topic_emphasis,
  }, null, 2)}

SCAN (most recent ~10 posts per operator, ${compact.length} total):
${JSON.stringify(compact, null, 1).slice(0, 14_000)}

Propose tuning. ABORT if the scan doesn't justify any change (drift on noise is worse than steady defaults).`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) { log(`Claude HTTP ${r.status}`); return null; }
  const j: any = await r.json();
  const text: string = (j.content?.[0]?.text ?? "").trim();
  if (!text || text === "ABORT" || text.startsWith("ABORT")) {
    log("Claude returned ABORT — no proposal this cycle");
    return null;
  }
  // Extract JSON
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1) { log(`Claude returned non-JSON: ${text.slice(0, 200)}`); return null; }
  try {
    const obj = JSON.parse(candidate.slice(start, end + 1));
    return {
      preferred_post_hours_local: obj.preferred_post_hours_local,
      thread_vs_single_ratio: obj.thread_vs_single_ratio,
      topic_emphasis: obj.topic_emphasis ?? "",
      last_scan_summary: {
        ts: new Date().toISOString(),
        trending_formats: obj.trending_formats ?? [],
        trending_topics: obj.trending_topics ?? [],
        operator_engagement_top3: obj.operator_engagement_top3 ?? [],
      },
      reasoning: obj.reasoning ?? "",
    };
  } catch (e: any) {
    log(`Claude JSON parse failed: ${e.message}`);
    return null;
  }
}

type Change = { key: string; before: any; after: any };

function diff(a: XStrategy, b: XStrategy): Change[] {
  const keys: (keyof XStrategy)[] = [
    "preferred_post_hours_local",
    "thread_vs_single_ratio",
    "topic_emphasis",
  ];
  const out: Change[] = [];
  for (const k of keys) {
    const before = JSON.stringify(a[k]);
    const after = JSON.stringify(b[k]);
    if (before !== after) out.push({ key: k, before: a[k], after: b[k] });
  }
  return out;
}

async function pingTelegram(line: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_HOME_CHANNEL;
  if (!token || !chat) { log("telegram: no creds, skip"); return; }
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: line }),
    });
    log("telegram: sent");
  } catch (e: any) {
    log(`telegram: ${e.message}`);
  }
}

async function snapshotPrevious(prev: XStrategy): Promise<string> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(X_STRATEGY_PATHS.versionsDir, `${ts}.json`);
  await fs.writeFile(dest, JSON.stringify(prev, null, 2));
  return dest;
}

async function applyAndLog(prev: XStrategy, next: XStrategy, changes: Change[], proposal: Proposal): Promise<void> {
  const snap = await snapshotPrevious(prev);
  await fs.writeFile(X_STRATEGY_PATHS.live, JSON.stringify(next, null, 2));
  for (const c of changes) {
    appendFileSync(X_STRATEGY_PATHS.changelog, JSON.stringify({
      ts: next.updated_at,
      key: c.key,
      before: c.before,
      after: c.after,
      reasoning: proposal.reasoning,
      snapshot: snap,
    }) + "\n");
  }
  log(`applied: ${changes.length} change(s). snapshot=${snap}`);
}

function summaryLine(changes: Change[], proposal: Proposal): string {
  const parts: string[] = [];
  for (const c of changes) {
    if (c.key === "preferred_post_hours_local") {
      parts.push(`hours → ${JSON.stringify(c.after)}`);
    } else if (c.key === "thread_vs_single_ratio") {
      parts.push(`thread-ratio → ${c.after}`);
    } else if (c.key === "topic_emphasis") {
      const t = String(c.after).slice(0, 60);
      parts.push(`topic → "${t}${String(c.after).length > 60 ? "…" : ""}"`);
    }
  }
  const formats = proposal.last_scan_summary.trending_formats.slice(0, 2).join(", ");
  return `📊 X Strategist: ${parts.join(" · ")}${formats ? ` (trending: ${formats})` : ""}. Undo: npm run x-strategy:undo`;
}

async function main() {
  log(`─── x-strategist starting (${LIVE ? "LIVE" : "DRY-RUN"}) ───`);

  if (existsSync(STOP_MARKER)) {
    const txt = (await fs.readFile(STOP_MARKER, "utf8")).trim();
    log(`abort: shared stop-marker present: ${txt}`);
    return;
  }

  const current = loadStrategy();
  if (current.frozen) {
    log("config.frozen === true — exiting without changes");
    return;
  }

  let scans: Scan[];
  try { scans = await scanOperators(current.operators); }
  catch { return; }
  const totalTweets = scans.reduce((n, s) => n + s.tweets.length, 0);
  log(`scanned ${scans.length} operators, ${totalTweets} tweets`);

  if (totalTweets < 10) {
    log("too few tweets for a meaningful update — skipping");
    return;
  }

  const proposal = await askClaudeForProposal(current, scans);
  if (!proposal) { log("no proposal — done"); return; }

  // Build proposed next config + validate against the hard rails.
  const next: XStrategy = {
    ...current,
    preferred_post_hours_local: proposal.preferred_post_hours_local ?? current.preferred_post_hours_local,
    thread_vs_single_ratio: proposal.thread_vs_single_ratio ?? current.thread_vs_single_ratio,
    topic_emphasis: proposal.topic_emphasis ?? current.topic_emphasis,
    last_scan_summary: proposal.last_scan_summary,
    updated_at: new Date().toISOString(),
    updated_by: LIVE ? "x-strategist" : "x-strategist-dryrun",
  };

  try { validate(next); }
  catch (e: any) {
    log(`PROPOSAL REJECTED by hard rails: ${e.message}`);
    return;
  }

  const changes = diff(current, next);
  if (!changes.length) { log("nothing changed — done (silent: no Telegram ping)"); return; }

  log(`PROPOSED ${changes.length} change(s):`);
  for (const c of changes) log(`  · ${c.key}: ${JSON.stringify(c.before)} → ${JSON.stringify(c.after)}`);
  log(`  reasoning: ${proposal.reasoning}`);

  if (!LIVE) {
    log("dry-run — not writing config. Re-run with --live to apply.");
    return;
  }

  await applyAndLog(current, next, changes, proposal);
  await pingTelegram(summaryLine(changes, proposal));
  log("─── done ───");
}

main().catch((e) => { log(`FATAL ${e?.stack || e}`); process.exit(1); });
