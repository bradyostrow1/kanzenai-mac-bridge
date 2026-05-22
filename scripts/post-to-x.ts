/**
 * KanzenAI → X (Twitter) auto-poster.
 *
 * For each article published TODAY that hasn't been tweeted yet:
 *   1. Asks Claude to write a perfect X post in the KanzenAI brand voice
 *      (pricing-reveal / comparison / contrarian).
 *   2. Posts to X via OAuth 1.0a → POST /2/tweets endpoint.
 *   3. Logs to .audit/x-posts.log so we never re-tweet the same article.
 *
 * Usage:
 *   npx tsx scripts/post-to-x.ts                 # process all today's unposted articles
 *   npx tsx scripts/post-to-x.ts --slug <slug>   # post a specific article
 *   npx tsx scripts/post-to-x.ts --dry-run       # generate tweet text, don't post
 *   npx tsx scripts/post-to-x.ts --backlog 5     # also include last N days
 *
 * Designed to be called from the daily-auto-write job after articles publish.
 */
import { TwitterApi } from "twitter-api-v2";
import { readdir, readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const LOG_PATH = join(AUDIT_DIR, "x-posts.log");
const QUEUE_PATH = join(AUDIT_DIR, "x-queue.json");
const SITE_URL = "https://kanzenai.com";

// ─── env loader ────────────────────────────────────────────────────────────
function loadEnv() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
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

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const X_CONSUMER_KEY = process.env.X_CONSUMER_KEY;
const X_CONSUMER_SECRET = process.env.X_CONSUMER_SECRET;
const X_ACCESS_TOKEN = process.env.X_ACCESS_TOKEN;
const X_ACCESS_TOKEN_SECRET = process.env.X_ACCESS_TOKEN_SECRET;

if (!ANTHROPIC_KEY || !X_CONSUMER_KEY || !X_CONSUMER_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.error("✗ Missing env vars. Need ANTHROPIC_API_KEY + X_CONSUMER_KEY/SECRET + X_ACCESS_TOKEN/SECRET in .env.local");
  process.exit(1);
}

// ─── arg parsing ───────────────────────────────────────────────────────────
function parseArgs() {
  const a: Record<string, string | boolean> = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      a[flag.slice(2)] = true;
    } else {
      a[flag.slice(2)] = next;
      i++;
    }
  }
  return a;
}
const args = parseArgs();
const DRY_RUN = args["dry-run"] === true;
const QUEUE_ONLY = args["queue"] === true || process.env.X_QUEUE_ONLY === "1"; // queue instead of posting
const BACKLOG_DAYS = typeof args["backlog"] === "string" ? Number(args["backlog"]) : 0;
const SLUG_FILTER = typeof args["slug"] === "string" ? args["slug"] : null;
// X For You algorithm: author diversity scorer attenuates repeated authors with
// `decay^position`. Posting back-to-back tanks the 2nd and 3rd post's reach.
// We pace at least MIN_GAP_MINUTES apart and cap each invocation at --limit
// candidates (default 1). Cron the script every 30-60 min and it self-paces.
const MIN_GAP_MINUTES = Number(process.env.X_POST_MIN_GAP_MIN ?? args["min-gap"] ?? 120);
const LIMIT = typeof args["limit"] === "string" ? Math.max(1, Number(args["limit"])) : 1;
const SKIP_GAP = args["skip-gap"] === true || args["force"] === true; // override pacing
// Minimum banger-screen score required before posting. Drafts below get
// regenerated up to BANGER_RETRIES times before falling back to best-effort.
const BANGER_MIN = Number(process.env.X_BANGER_MIN ?? 0.55);
const BANGER_RETRIES = Number(process.env.X_BANGER_RETRIES ?? 2); // 1 initial + 2 retries = 3 attempts

// ─── article loader ────────────────────────────────────────────────────────
type Article = {
  slug: string;
  title: string;
  description?: string;
  tldr?: string;
  category?: string;
  publishedAt: string;
  headerImage?: string;
  body?: Array<{ type: string; name?: string; price?: string }>;
};

async function loadArticles(): Promise<Array<Article & { url: string }>> {
  const out: Array<Article & { url: string }> = [];
  for (const [dir, prefix] of [
    [ARTICLES_DIR, "/articles"],
    [COMPARISONS_DIR, "/compare"],
  ] as const) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const json = JSON.parse(await readFile(join(dir, f), "utf8")) as Article;
        if (!json.slug || !json.title) continue;
        out.push({ ...json, url: `${SITE_URL}${prefix}/${json.slug}` });
      } catch {
        /* skip */
      }
    }
  }
  return out;
}

async function alreadyPosted(slug: string): Promise<boolean> {
  if (!existsSync(LOG_PATH)) return false;
  const log = await readFile(LOG_PATH, "utf8");
  return log.split("\n").some((line) => {
    try {
      const o = JSON.parse(line);
      return o.slug === slug;
    } catch {
      return false;
    }
  });
}

type QueueItem = {
  slug: string;
  title: string;
  url: string;
  category?: string;
  tweetText: string;
  replyText: string;
  generatedAt: string;
  status: "pending" | "copied" | "posted" | "discarded";
};

async function loadQueue(): Promise<QueueItem[]> {
  if (!existsSync(QUEUE_PATH)) return [];
  try {
    return JSON.parse(await readFile(QUEUE_PATH, "utf8")) as QueueItem[];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueueItem[]) {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(QUEUE_PATH, JSON.stringify(items, null, 2));
}

async function alreadyQueued(slug: string): Promise<boolean> {
  const q = await loadQueue();
  return q.some((i) => i.slug === slug && i.status !== "discarded");
}

// ─── Claude tweet writer ───────────────────────────────────────────────────
const SYSTEM_TWEET_PROMPT = `You are the X (Twitter) ghostwriter for KanzenAI (kanzenai.com) — an independent affiliate review site for working real estate agents.

Your job: turn an article into ONE perfect X post under 250 characters (leaves room for the URL).

The KanzenAI voice on X:
- Numbers-first hook. Open with a specific dollar amount, percentage, or product name.
- Short lines. One thought per line. Use line breaks aggressively.
- No hashtags. No emojis (except → arrows or ✓/✗ marks when listing).
- No "follow for more," no "drop a 🔥," no engagement bait.
- Contrarian / data-driven / pricing-reveal angle — never "check out my new post" energy.
- Match the archetype of Marc Louvion, levelsio, Pieter Levels — build-in-public + concrete numbers.

Pick the BEST angle from these templates based on the article content:

TEMPLATE A — Pricing Reveal:
"[Category] pricing in 2026 — actual numbers, not 'starting at' garbage:

→ Tool A: $X/mo
→ Tool B: $Y/mo
→ Tool C: contact sales (~$Z/mo)

[Sharp one-line conclusion]."

TEMPLATE B — Head-to-Head:
"[Tool A] vs [Tool B] for real estate:

[Tool A] [tier]: $X
[Tool B] [tier]: $Y

For half the price, [B] gives:
✓ feature
✓ feature

[A]'s edge: [feature]

[Sharp take]."

TEMPLATE C — Contrarian Hot Take:
"[Contrarian claim]. Every time.

Tested across [category]. Pattern holds:
• Tool A — $X
• Tool B — $Y

[Conclusion]."

TEMPLATE D — Call-Out:
"Spent [N] hours researching [category].

[Surprising fact #1].
[Surprising fact #2].

[One-line punchline]."

CRITICAL RULES:
- Output ONLY the tweet text. Do NOT include the article URL — it gets appended by the script as a reply.
- Stay under 250 chars (NOT 280 — gives a buffer for cleanup).
- Use only data that is actually present in the article. No fabrication.
- Never quote prices that aren't in the article body.
- No "thread 🧵" intros — this is a single tweet.`;

async function craftTweet(article: Article & { url: string }): Promise<string> {
  const productLines = (article.body ?? [])
    .filter((b) => b.type === "product" && b.name && b.price)
    .map((b) => `- ${b.name}: ${b.price}`)
    .slice(0, 8)
    .join("\n");

  const userPrompt = `Article: ${article.title}
Category: ${article.category ?? "—"}

TLDR: ${article.tldr ?? article.description ?? ""}

Products covered:
${productLines || "(none extracted)"}

Write the perfect X post for this article. Output the tweet text only, no preamble.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 400,
      system: SYSTEM_TWEET_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    throw new Error(`Anthropic ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json();
  const text: string = (data.content?.[0]?.text ?? "").trim();
  // Strip any wrapping quotes Claude sometimes adds
  return text.replace(/^["']|["']$/g, "").trim();
}

// ─── Banger screener (mirrors X's banger_initial_screen.py classifier) ────
// X scores every post 0.0-1.0 via a VLM. Score >= 0.4 clears the screen and
// is eligible for Phoenix retrieval (out-of-network discovery). We screen
// drafts BEFORE posting so we never burn a tweet on slop.
const BANGER_SYSTEM = `You are X's banger_initial_screen classifier — a VLM that rates every post 0.0-1.0 on quality. The For-You algorithm uses your score to decide if a post is eligible for out-of-network discovery (Phoenix Retrieval). Posts below 0.4 get filtered.

HIGH score (>=0.7):
- Concrete data: specific prices, percentages, named products, hard numbers
- Strong first-50-character hook that stops the scroll
- Drives dwell time — reader has to pause to digest the contrast/list/data
- Insight, not announcement
- Format invites engagement (specific contrast, contrarian claim, list with surprise)
- Reads like the target audience's existing content patterns

LOW score (<0.4):
- Generic phrasing ("check this out", "I made a thing", "thoughts?")
- Engagement bait ("RT if you agree", "drop a 🔥")
- No specific numbers or named entities
- Sycophantic / promotional / corporate tone
- One-liner with no payoff
- AI-generated slop tells: "delve", "in conclusion", "elevate", "navigate the landscape"
- Just hashtags or hot-take with no evidence

Output ONLY this JSON. No preamble, no explanation outside the JSON:
{"score": 0.0-1.0, "reasoning": "one short sentence on why"}`;

async function screenBanger(text: string): Promise<{ score: number; reasoning: string }> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 250,
        system: BANGER_SYSTEM,
        messages: [{ role: "user", content: `Post:\n\n${text}` }],
      }),
    });
    if (!resp.ok) {
      return { score: 0.5, reasoning: `screener HTTP ${resp.status} — defaulting to 0.5` };
    }
    const data = await resp.json();
    const raw: string = (data.content?.[0]?.text ?? "").trim();
    const match = raw.match(/\{[^}]+\}/);
    if (!match) return { score: 0.5, reasoning: "no JSON in screener output" };
    const parsed = JSON.parse(match[0]);
    const score = Math.max(0, Math.min(1, Number(parsed.score) || 0.5));
    return { score, reasoning: String(parsed.reasoning ?? "") };
  } catch (e) {
    return { score: 0.5, reasoning: `screener error: ${(e as Error).message}` };
  }
}

async function craftTweetWithScreening(
  article: Article & { url: string },
): Promise<{ text: string; score: number; reasoning: string; attempts: number }> {
  let best = { text: "", score: -1, reasoning: "" };
  const totalAttempts = 1 + BANGER_RETRIES;
  for (let i = 0; i < totalAttempts; i++) {
    const text = await craftTweet(article);
    const { score, reasoning } = await screenBanger(text);
    console.log(`  · Draft ${i + 1}/${totalAttempts}: banger=${score.toFixed(2)} — ${reasoning}`);
    if (score > best.score) best = { text, score, reasoning };
    if (score >= BANGER_MIN) return { ...best, attempts: i + 1 };
  }
  console.log(`  ⚠ No draft cleared ${BANGER_MIN}. Posting best (${best.score.toFixed(2)}).`);
  return { ...best, attempts: totalAttempts };
}

// ─── X client (twitter-api-v2 library, OAuth 1.0a User Context) ────────────
const twitter = new TwitterApi({
  appKey: X_CONSUMER_KEY!,
  appSecret: X_CONSUMER_SECRET!,
  accessToken: X_ACCESS_TOKEN!,
  accessSecret: X_ACCESS_TOKEN_SECRET!,
});

// Upload a hero image and return the media_id, or null if upload fails. Best-effort —
// a failed media upload should never block the post.
async function uploadHero(headerImage?: string): Promise<string | null> {
  if (!headerImage) return null;
  try {
    const absolute = join(ROOT, "public", headerImage.replace(/^\//, ""));
    if (!existsSync(absolute)) {
      console.log(`  · No hero on disk at ${absolute} — posting text-only`);
      return null;
    }
    const id = await twitter.v1.uploadMedia(absolute);
    console.log(`  · Hero uploaded (media_id ${id})`);
    return id;
  } catch (e) {
    console.log(`  · Hero upload failed (${(e as Error).message}) — posting text-only`);
    return null;
  }
}

async function postTweet(
  text: string,
  replyToId?: string,
  mediaId?: string | null,
): Promise<{ id: string; text: string }> {
  const opts: Record<string, unknown> = {};
  if (replyToId) opts.reply = { in_reply_to_tweet_id: replyToId };
  if (mediaId) opts.media = { media_ids: [mediaId] };
  const r = await twitter.v2.tweet(text, opts);
  return { id: r.data.id, text: r.data.text };
}

// Read the timestamp of the most recent successful auto-post so we can self-pace.
async function lastPostMs(): Promise<number> {
  if (!existsSync(LOG_PATH)) return 0;
  try {
    const lines = (await readFile(LOG_PATH, "utf8")).split("\n").filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const o = JSON.parse(lines[i]);
        if (typeof o.ts === "string") return Date.parse(o.ts);
      } catch { /* skip */ }
    }
  } catch { /* ignore */ }
  return 0;
}

// ─── selection logic ───────────────────────────────────────────────────────
function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shouldConsider(article: Article, today: string, backlogCutoff: number): boolean {
  if (!article.publishedAt) return false;
  if (article.publishedAt === today) return true;
  if (backlogCutoff > 0) {
    const t = Date.parse(article.publishedAt);
    return !isNaN(t) && t >= backlogCutoff;
  }
  return false;
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });

  const all = await loadArticles();
  const today = localDateString();
  const backlogCutoff = BACKLOG_DAYS > 0 ? Date.now() - BACKLOG_DAYS * 24 * 60 * 60 * 1000 : 0;

  let candidates: Array<Article & { url: string }>;
  if (SLUG_FILTER) {
    candidates = all.filter((a) => a.slug === SLUG_FILTER);
    if (candidates.length === 0) {
      console.error(`✗ No article found with slug "${SLUG_FILTER}"`);
      process.exit(1);
    }
  } else {
    candidates = all.filter((a) => shouldConsider(a, today, backlogCutoff));
  }

  if (candidates.length === 0) {
    console.log("→ No articles today to post. Exiting.");
    return;
  }

  console.log(`→ ${candidates.length} candidate(s) for X posting`);

  // ─── Pacing gate: enforce MIN_GAP_MINUTES between author auto-posts ──
  // The For-You algorithm's author_diversity_scorer multiplies the 2nd+ post
  // from the same author by `decay^position`, so back-to-back posting tanks
  // discovery reach. We skip this run if the previous auto-post was too recent
  // (unless --skip-gap is passed). DRY_RUN/QUEUE_ONLY bypass since neither
  // actually hits X.
  if (!DRY_RUN && !QUEUE_ONLY && !SKIP_GAP && !SLUG_FILTER) {
    const last = await lastPostMs();
    if (last > 0) {
      const gapMin = (Date.now() - last) / 60_000;
      if (gapMin < MIN_GAP_MINUTES) {
        const waitMin = Math.ceil(MIN_GAP_MINUTES - gapMin);
        console.log(`→ Last post was ${Math.round(gapMin)}m ago — algorithm-friendly gap is ${MIN_GAP_MINUTES}m. Wait ${waitMin}m. Re-run later (or pass --skip-gap to override).`);
        return;
      }
    }
  }

  let postedCount = 0;
  for (const article of candidates) {
    if (postedCount >= LIMIT) {
      console.log(`→ Hit per-run limit (${LIMIT}). Remaining candidates wait until next run.`);
      break;
    }
    if (QUEUE_ONLY) {
      if (await alreadyQueued(article.slug)) {
        console.log(`  · skip ${article.slug} (already in queue)`);
        continue;
      }
    } else if (await alreadyPosted(article.slug)) {
      console.log(`  · skip ${article.slug} (already posted)`);
      continue;
    }

    console.log(`\n→ ${article.slug}`);
    let tweetText: string;
    let bangerScore = -1;
    let bangerReasoning = "";
    let bangerAttempts = 0;
    try {
      const screened = await craftTweetWithScreening(article);
      tweetText = screened.text;
      bangerScore = screened.score;
      bangerReasoning = screened.reasoning;
      bangerAttempts = screened.attempts;
    } catch (e) {
      console.error(`  ✗ Claude tweet failed: ${(e as Error).message}`);
      continue;
    }

    if (tweetText.length > 270) {
      console.log(`  ⚠ Tweet ${tweetText.length} chars > 270, truncating`);
      tweetText = tweetText.slice(0, 267) + "…";
    }

    const replyText = `Full breakdown → ${article.url}`;

    console.log("─── Tweet preview ───");
    console.log(tweetText);
    console.log("─── Reply preview ───");
    console.log(replyText);
    console.log("─────────────────────");

    if (DRY_RUN) {
      console.log("  · DRY RUN — not saving");
      continue;
    }

    if (QUEUE_ONLY) {
      const q = await loadQueue();
      q.unshift({
        slug: article.slug,
        title: article.title,
        url: article.url,
        category: article.category,
        tweetText,
        replyText,
        generatedAt: new Date().toISOString(),
        status: "pending",
      });
      await saveQueue(q);
      console.log(`  ✓ Queued for manual posting (dashboard)`);
      continue;
    }

    try {
      // Upload the article's hero image — algorithm weighs photo_expand.
      const heroMediaId = await uploadHero(article.headerImage);

      const main = await postTweet(tweetText, undefined, heroMediaId);
      console.log(`  ✓ Main tweet posted: https://x.com/i/web/status/${main.id}${heroMediaId ? " (+ hero image)" : ""}`);
      const reply = await postTweet(replyText, main.id);
      console.log(`  ✓ Reply (link) posted: https://x.com/i/web/status/${reply.id}`);

      // NOTE: The immediate "boilerplate promo" 3rd reply was REMOVED. Posting
      // a 3rd tweet from the same author seconds after the main tweet triggers
      // the author_diversity_scorer's decay (multiplier ~ decay^2), tanking
      // reach of the main tweet. Run the standalone scripts/post-boilerplate-promo.ts
      // weekly instead.

      await appendFile(
        LOG_PATH,
        JSON.stringify({
          ts: new Date().toISOString(),
          slug: article.slug,
          tweetId: main.id,
          replyId: reply.id,
          mediaId: heroMediaId,
          bangerScore,
          bangerReasoning,
          bangerAttempts,
          text: tweetText,
        }) + "\n",
      );
      postedCount++;
    } catch (e) {
      console.error(`  ✗ X post failed: ${(e as Error).message} — falling back to queue`);
      const q = await loadQueue();
      q.unshift({
        slug: article.slug,
        title: article.title,
        url: article.url,
        category: article.category,
        tweetText,
        replyText,
        generatedAt: new Date().toISOString(),
        status: "pending",
      });
      await saveQueue(q);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err.message);
  process.exit(1);
});
