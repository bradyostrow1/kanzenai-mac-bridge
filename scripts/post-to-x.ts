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
import { createHmac, randomBytes } from "node:crypto";
import { readdir, readFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const LOG_PATH = join(AUDIT_DIR, "x-posts.log");
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
const BACKLOG_DAYS = typeof args["backlog"] === "string" ? Number(args["backlog"]) : 0;
const SLUG_FILTER = typeof args["slug"] === "string" ? args["slug"] : null;

// ─── article loader ────────────────────────────────────────────────────────
type Article = {
  slug: string;
  title: string;
  description?: string;
  tldr?: string;
  category?: string;
  publishedAt: string;
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

// ─── OAuth 1.0a signing ────────────────────────────────────────────────────
function percentEncode(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthHeader(method: string, url: string, params: Record<string, string> = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: X_CONSUMER_KEY!,
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN!,
    oauth_version: "1.0",
  };

  const allParams = { ...oauth, ...params };
  const paramStr = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join("&");

  const signatureBase = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramStr)}`;
  const signingKey = `${percentEncode(X_CONSUMER_SECRET!)}&${percentEncode(X_ACCESS_TOKEN_SECRET!)}`;
  const signature = createHmac("sha1", signingKey).update(signatureBase).digest("base64");

  oauth.oauth_signature = signature;

  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`)
      .join(", ")
  );
}

async function postTweet(text: string, replyToId?: string): Promise<{ id: string; text: string }> {
  const url = "https://api.twitter.com/2/tweets";
  const body: { text: string; reply?: { in_reply_to_tweet_id: string } } = { text };
  if (replyToId) body.reply = { in_reply_to_tweet_id: replyToId };

  const auth = oauthHeader("POST", url);
  const resp = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`X API ${resp.status}: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return { id: data.data.id, text: data.data.text };
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

  for (const article of candidates) {
    if (await alreadyPosted(article.slug)) {
      console.log(`  · skip ${article.slug} (already posted)`);
      continue;
    }

    console.log(`\n→ ${article.slug}`);
    let tweetText: string;
    try {
      tweetText = await craftTweet(article);
    } catch (e) {
      console.error(`  ✗ Claude tweet failed: ${(e as Error).message}`);
      continue;
    }

    if (tweetText.length > 270) {
      console.log(`  ⚠ Tweet ${tweetText.length} chars > 270, truncating`);
      tweetText = tweetText.slice(0, 267) + "…";
    }

    console.log("─── Tweet preview ───");
    console.log(tweetText);
    console.log("─── Reply preview ───");
    console.log(`Full breakdown → ${article.url}`);
    console.log("─────────────────────");

    if (DRY_RUN) {
      console.log("  · DRY RUN — not posting");
      continue;
    }

    try {
      const main = await postTweet(tweetText);
      console.log(`  ✓ Main tweet posted: https://x.com/i/web/status/${main.id}`);
      // Reply with the link
      const reply = await postTweet(`Full breakdown → ${article.url}`, main.id);
      console.log(`  ✓ Reply (link) posted: https://x.com/i/web/status/${reply.id}`);

      await appendFile(
        LOG_PATH,
        JSON.stringify({
          ts: new Date().toISOString(),
          slug: article.slug,
          tweetId: main.id,
          replyId: reply.id,
          text: tweetText,
        }) + "\n",
      );
    } catch (e) {
      console.error(`  ✗ X post failed: ${(e as Error).message}`);
    }

    // Brief gap between articles so we don't hammer the API
    await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err.message);
  process.exit(1);
});
