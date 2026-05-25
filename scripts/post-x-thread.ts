/**
 * KanzenAI X thread generator.
 *
 * Picks one un-threaded article, asks Claude to write a 5-tweet thread, and
 * posts it as a chained reply sequence on @KanzenOfficial.
 *
 * Threads outperform single tweets 3-5x on follower acquisition because:
 *   - Algorithm boosts threads (keeps users in-app)
 *   - Final tweet's link gets more clicks (vs. link-in-reply)
 *   - Each individual tweet can be liked/shared (compounding reach)
 *
 * Usage:
 *   npx tsx scripts/post-x-thread.ts              # auto-pick, post live
 *   npx tsx scripts/post-x-thread.ts --slug X     # use specific article
 *   npx tsx scripts/post-x-thread.ts --dry-run    # generate + preview, no post
 */
import { TwitterApi } from "twitter-api-v2";
import { readFile, writeFile, appendFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const THREADS_LOG = join(AUDIT_DIR, "x-threads-posted.log");
const SITE_URL = "https://kanzenai.com";

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

const args: Record<string, string | boolean> = {};
{
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) args[flag.slice(2)] = true;
    else { args[flag.slice(2)] = next; i++; }
  }
}
const DRY_RUN = args["dry-run"] === true;
const SLUG = typeof args["slug"] === "string" ? args["slug"] : null;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

// ─── Article corpus ─────────────────────────────────────────────────────────
type Article = {
  slug: string;
  title: string;
  category?: string;
  tldr?: string;
  publishedAt: string;
  body?: Array<{ type: string; name?: string; price?: string; pros?: string[]; cons?: string[] }>;
};

async function loadArticles(): Promise<Article[]> {
  const out: Article[] = [];
  for (const dir of [ARTICLES_DIR, COMPARISONS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        out.push(JSON.parse(await readFile(join(dir, f), "utf8")));
      } catch { /* skip malformed */ }
    }
  }
  return out;
}

async function alreadyThreaded(slug: string): Promise<boolean> {
  if (!existsSync(THREADS_LOG)) return false;
  const log = await readFile(THREADS_LOG, "utf8");
  return log.split("\n").some((line) => {
    try { return JSON.parse(line).slug === slug; } catch { return false; }
  });
}

// Pick the most "thread-worthy" article: highest product count (most data points),
// not already threaded, recent first.
async function pickArticle(): Promise<Article | null> {
  const all = await loadArticles();
  const candidates: Array<{ article: Article; score: number }> = [];
  for (const a of all) {
    if (!a.slug) continue;
    if (await alreadyThreaded(a.slug)) continue;
    const productCount = (a.body ?? []).filter((b) => b.type === "product" && b.name && b.price).length;
    // Want at least 3 products for a 5-tweet thread to work
    if (productCount < 3) continue;
    const ageDays = Math.max(1, (Date.now() - Date.parse(a.publishedAt ?? "")) / (1000 * 60 * 60 * 24));
    // Score: product richness × recency boost
    const score = productCount * (1 / Math.sqrt(ageDays));
    candidates.push({ article: a, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.article ?? null;
}

// ─── Banger screener (mirrors X For-You banger_initial_screen.py) ────────
// Score 0.0-1.0 — Phoenix Retrieval filters posts below 0.4. We score the
// HOOK tweet (tweet #1) since the first post in a thread is what gets indexed
// for out-of-network discovery.
const BANGER_MIN = Number(process.env.X_BANGER_MIN ?? 0.55);

const BANGER_SYSTEM = `You are X's banger_initial_screen classifier — rate the post 0.0-1.0. Score >=0.4 clears the screen and is eligible for out-of-network discovery (Phoenix Retrieval).

HIGH (>=0.7): specific data, named products, strong first-50-character hook, contrarian/list/contrast format, drives dwell time, looks like the audience's existing content.
LOW (<0.4): generic phrasing, engagement bait, no specific numbers, sycophantic tone, AI-slop tells ("delve", "in conclusion"), one-liner with no payoff.

Output ONLY this JSON: {"score": 0.0-1.0, "reasoning": "one sentence"}`;

async function screenBanger(text: string): Promise<{ score: number; reasoning: string }> {
  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 250,
        system: BANGER_SYSTEM,
        messages: [{ role: "user", content: `Post:\n\n${text}` }],
      }),
    });
    if (!resp.ok) return { score: 0.5, reasoning: `screener HTTP ${resp.status}` };
    const data = await resp.json();
    const raw: string = (data.content?.[0]?.text ?? "").trim();
    const match = raw.match(/\{[^}]+\}/);
    if (!match) return { score: 0.5, reasoning: "no JSON" };
    const parsed = JSON.parse(match[0]);
    const score = Math.max(0, Math.min(1, Number(parsed.score) || 0.5));
    return { score, reasoning: String(parsed.reasoning ?? "") };
  } catch (e) {
    return { score: 0.5, reasoning: `screener error: ${(e as Error).message}` };
  }
}

// ─── Claude thread drafter ─────────────────────────────────────────────────
const SYSTEM = `You are the X thread ghostwriter for KanzenAI — an independent affiliate review site for AI-tool shoppers: solopreneurs, creators, and small businesses choosing AI software, productivity tools, and automation platforms.

You write 5-tweet threads from a single article. Each tweet is a separate post in a chain.

VOICE RULES:
- Tweet 1 (hook): Stops scroll. Number, contradiction, or specific reveal. No "🧵" emoji.
- Tweets 2-4 (body): One specific data point per tweet. Tool name + price + 1 trade-off.
- Tweet 5 (close): Synthesizes the takeaway + final line. The script will append the article URL — do NOT include it.
- NO sycophancy ("you might love", "you'll be surprised")
- NO hashtags, NO emojis (→ ✓ ✗ ok)
- Each tweet must stand alone but flow as a thread
- Each tweet under 270 characters

OUTPUT FORMAT — EXACTLY:
TWEET 1: <text>
TWEET 2: <text>
TWEET 3: <text>
TWEET 4: <text>
TWEET 5: <text>

No preamble. No "Here's your thread:". Just the 5 tweets in that exact format.`;

async function draftThread(article: Article): Promise<string[]> {
  const products = (article.body ?? [])
    .filter((b) => b.type === "product" && b.name && b.price)
    .slice(0, 6)
    .map((b) => `${b.name}: ${b.price}${b.pros?.length ? ` (pros: ${b.pros.slice(0, 2).join("; ")})` : ""}${b.cons?.length ? ` (cons: ${b.cons.slice(0, 2).join("; ")})` : ""}`)
    .join("\n");

  const userPrompt = `Article: ${article.title}
Category: ${article.category ?? "—"}

TLDR: ${article.tldr ?? ""}

Products:
${products}

Write the 5-tweet thread.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1500,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  const raw: string = (data.content?.[0]?.text ?? "").trim();

  // Parse "TWEET N: ..." lines
  const tweets: string[] = [];
  const lines = raw.split("\n");
  let current = "";
  for (const line of lines) {
    const m = line.match(/^TWEET\s+\d+:\s*(.*)$/i);
    if (m) {
      if (current) tweets.push(current.trim());
      current = m[1];
    } else if (current) {
      current += "\n" + line;
    }
  }
  if (current) tweets.push(current.trim());

  if (tweets.length !== 5) {
    throw new Error(`Expected 5 tweets, got ${tweets.length}. Raw: ${raw.slice(0, 300)}`);
  }

  // Hard-cap each tweet length
  return tweets.map((t) => (t.length > 270 ? t.slice(0, 267) + "…" : t));
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });

  let article: Article | null;
  if (SLUG) {
    const all = await loadArticles();
    article = all.find((a) => a.slug === SLUG) ?? null;
    if (!article) {
      console.error(`✗ No article with slug "${SLUG}"`);
      process.exit(1);
    }
  } else {
    article = await pickArticle();
    if (!article) {
      console.log("→ No threadworthy articles available (all done or too thin). Exiting.");
      return;
    }
  }

  console.log(`→ Article: ${article.title}`);
  console.log(`  slug: ${article.slug}\n`);

  // Up to 3 attempts to clear the banger screen on tweet #1 (the hook —
  // that's what Phoenix Retrieval indexes for out-of-network discovery).
  console.log("→ Drafting 5-tweet thread via Claude (with banger screening)...");
  let tweets: string[] = [];
  let bangerScore = -1;
  let bangerReasoning = "";
  let bangerAttempts = 0;
  for (let i = 0; i < 3; i++) {
    bangerAttempts = i + 1;
    const draft = await draftThread(article);
    const screen = await screenBanger(draft[0]);
    console.log(`  · Draft ${i + 1}/3: hook banger=${screen.score.toFixed(2)} — ${screen.reasoning}`);
    if (screen.score > bangerScore) {
      tweets = draft;
      bangerScore = screen.score;
      bangerReasoning = screen.reasoning;
    }
    if (screen.score >= BANGER_MIN) break;
  }
  if (bangerScore < BANGER_MIN) {
    console.log(`  ⚠ No hook cleared ${BANGER_MIN}. Posting best (${bangerScore.toFixed(2)}).`);
  }

  console.log("\n─── Thread preview ───");
  tweets.forEach((t, i) => {
    console.log(`\n[${i + 1}/5] (${t.length} chars)`);
    console.log(t);
  });
  const url = `${SITE_URL}/${article.body !== undefined && (article as { body: unknown }).body ? "articles" : "compare"}/${article.slug}`;
  console.log(`\n[Final URL will be appended to tweet 5]: ${url}`);
  console.log("──────────────────────");

  if (DRY_RUN) {
    console.log("\n· DRY RUN — not posting");
    return;
  }

  // Append URL to final tweet (or post as 6th tweet if it'd overflow)
  const finalWithUrl = `${tweets[4]}\n\n${url}`;
  if (finalWithUrl.length <= 280) {
    tweets[4] = finalWithUrl;
  }

  // Upload hero image — only attached to tweet 1. Algorithm weighs
  // photo_expand, and the root tweet is what Phoenix Retrieval indexes.
  let heroMediaId: string | null = null;
  const heroPath = (article as Article & { headerImage?: string }).headerImage;
  if (heroPath) {
    try {
      const absolute = join(ROOT, "public", heroPath.replace(/^\//, ""));
      if (existsSync(absolute)) {
        heroMediaId = await twitter.v1.uploadMedia(absolute);
        console.log(`→ Hero uploaded (media_id ${heroMediaId})`);
      }
    } catch (e) {
      console.log(`→ Hero upload failed: ${(e as Error).message} — text-only thread`);
    }
  }

  console.log("\n→ Posting thread...");
  const postedIds: string[] = [];
  let inReplyTo: string | undefined;

  for (let i = 0; i < tweets.length; i++) {
    try {
      const opts: Record<string, unknown> = {};
      if (inReplyTo) opts.reply = { in_reply_to_tweet_id: inReplyTo };
      if (i === 0 && heroMediaId) opts.media = { media_ids: [heroMediaId] };
      const r = await twitter.v2.tweet(tweets[i], opts);
      postedIds.push(r.data.id);
      inReplyTo = r.data.id;
      console.log(`  ✓ [${i + 1}/5] posted → https://x.com/i/web/status/${r.data.id}`);
      // Tiny gap so the chain renders right in clients
      if (i < tweets.length - 1) await new Promise((res) => setTimeout(res, 1500));
    } catch (e) {
      console.error(`  ✗ [${i + 1}/5] failed: ${(e as Error).message}`);
      console.error(`    Thread aborted mid-chain. Posted so far: ${postedIds.join(", ")}`);
      // If we got the URL on tweet 5 but failed earlier, post a salvage reply with the link
      if (postedIds.length > 0 && i < 4) {
        try {
          await twitter.v2.tweet(`Full breakdown → ${url}`, { reply: { in_reply_to_tweet_id: postedIds[postedIds.length - 1] } });
        } catch {}
      }
      throw e;
    }
  }

  // The immediate boilerplate-promo reply was REMOVED — author_diversity_scorer
  // penalizes a 6th tweet from the same author seconds after the thread.
  // scripts/post-boilerplate-promo.ts runs weekly as a standalone post.

  // Log success
  await appendFile(THREADS_LOG, JSON.stringify({
    ts: new Date().toISOString(),
    slug: article.slug,
    title: article.title,
    rootTweetId: postedIds[0],
    allTweetIds: postedIds,
    tweetTexts: tweets,
    bangerScore,
    bangerReasoning,
    bangerAttempts,
  }) + "\n");

  console.log(`\n✓ Thread posted (5 tweets, root: https://x.com/i/web/status/${postedIds[0]})`);
}

main().catch((err) => { console.error("\n✗ Fatal:", err.message); process.exit(1); });
