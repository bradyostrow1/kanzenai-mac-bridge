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

// ─── X client (twitter-api-v2 library, OAuth 1.0a User Context) ────────────
const twitter = new TwitterApi({
  appKey: X_CONSUMER_KEY!,
  appSecret: X_CONSUMER_SECRET!,
  accessToken: X_ACCESS_TOKEN!,
  accessSecret: X_ACCESS_TOKEN_SECRET!,
});

async function postTweet(text: string, replyToId?: string): Promise<{ id: string; text: string }> {
  const opts = replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : {};
  const r = await twitter.v2.tweet(text, opts);
  return { id: r.data.id, text: r.data.text };
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
      const main = await postTweet(tweetText);
      console.log(`  ✓ Main tweet posted: https://x.com/i/web/status/${main.id}`);
      const reply = await postTweet(replyText, main.id);
      console.log(`  ✓ Reply (link) posted: https://x.com/i/web/status/${reply.id}`);

      // Optional boilerplate promo as a 3rd reply (env-gated to control frequency)
      let promoId: string | undefined;
      if (process.env.BOILERPLATE_PROMO === "1") {
        try {
          const promoVariants = [
            "btw — this whole stack is what I'm selling at kanzenai.com/boilerplate. Next.js + Claude auto-writer + X bots + dashboard. $149, deploys in 10 min.",
            "this site auto-published itself. The boilerplate I built it on is $149 → kanzenai.com/boilerplate",
            "stack that auto-publishes this: Next.js + Claude + Pexels + X bots + dashboard. Selling it for $149 if you want to skip the build → kanzenai.com/boilerplate",
          ];
          const promo = promoVariants[Math.floor(Math.random() * promoVariants.length)];
          const promoTweet = await postTweet(promo, reply.id);
          promoId = promoTweet.id;
          console.log(`  ✓ Boilerplate promo posted: https://x.com/i/web/status/${promoId}`);
        } catch (e) {
          console.log(`  · Promo skipped: ${(e as Error).message}`);
        }
      }

      await appendFile(
        LOG_PATH,
        JSON.stringify({
          ts: new Date().toISOString(),
          slug: article.slug,
          tweetId: main.id,
          replyId: reply.id,
          promoId,
          text: tweetText,
        }) + "\n",
      );
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
