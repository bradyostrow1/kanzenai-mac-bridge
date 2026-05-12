/**
 * KanzenAI X reply finder — SEARCH MODE.
 *
 * Instead of polling specific target accounts, this uses X v2 search to find
 * recent tweets from ANYONE that mention real-estate-tech tools. Filters out
 * spam, low-quality accounts, and old tweets. Drafts replies via Claude.
 *
 * Usage:
 *   npx tsx scripts/find-x-replies-search.ts                 # default config
 *   npx tsx scripts/find-x-replies-search.ts --max 30        # find up to 30 candidates
 *   npx tsx scripts/find-x-replies-search.ts --min-followers 500  # author follower threshold
 *   npx tsx scripts/find-x-replies-search.ts --dry-run
 */
import { TwitterApi } from "twitter-api-v2";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const QUEUE_PATH = join(AUDIT_DIR, "x-reply-queue.json");
const POSTED_PATH = join(AUDIT_DIR, "x-replies-posted.log");

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
const MAX_RESULTS = typeof args["max"] === "string" ? Number(args["max"]) : 20;
const MIN_FOLLOWERS = typeof args["min-followers"] === "string" ? Number(args["min-followers"]) : 100;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

// Search queries — each finds a specific kind of tool-tweet
const SEARCH_QUERIES = [
  '("Follow Up Boss" OR "kvCORE" OR "Lofty" OR "Sierra Interactive" OR "Real Geeks") -is:retweet -is:reply lang:en',
  '("BombBomb" OR "Dubb" OR Vidyard) "real estate" -is:retweet -is:reply lang:en',
  '("Vulcan7" OR "RedX" OR "Mojo Dialer" OR "PhoneBurner") -is:retweet -is:reply lang:en',
  '"best CRM" "real estate" -is:retweet -is:reply lang:en',
  '"real estate tech stack" -is:retweet -is:reply lang:en',
  '"AI for agents" "real estate" -is:retweet -is:reply lang:en',
  '"lead gen" "real estate" "tool" -is:retweet -is:reply lang:en',
];

type QueuedReply = {
  id: string;
  targetUser: string;
  tweetId: string;
  tweetText: string;
  tweetUrl: string;
  tweetCreatedAt: string;
  matchedKeywords: string[];
  replyText: string;
  draftedAt: string;
  status: "pending" | "posted" | "discarded";
  sourceArticleSlug?: string;
};

async function loadQueue(): Promise<QueuedReply[]> {
  if (!existsSync(QUEUE_PATH)) return [];
  try { return JSON.parse(await readFile(QUEUE_PATH, "utf8")); } catch { return []; }
}
async function saveQueue(items: QueuedReply[]) {
  await writeFile(QUEUE_PATH, JSON.stringify(items, null, 2));
}
async function alreadySeen(tweetId: string): Promise<boolean> {
  const q = await loadQueue();
  if (q.some((i) => i.tweetId === tweetId)) return true;
  if (existsSync(POSTED_PATH)) {
    const log = await readFile(POSTED_PATH, "utf8");
    if (log.includes(`"tweetId":"${tweetId}"`)) return true;
  }
  return false;
}

// Article corpus loader (reused from find-x-replies.ts)
type ArticleSummary = { slug: string; title: string; category?: string; tldr?: string; products: Array<{ name: string; price: string }> };
let corpusCache: ArticleSummary[] | null = null;
async function loadCorpus(): Promise<ArticleSummary[]> {
  if (corpusCache) return corpusCache;
  const { readdir } = await import("node:fs/promises");
  const out: ArticleSummary[] = [];
  for (const dir of [ARTICLES_DIR, COMPARISONS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const json = JSON.parse(await readFile(join(dir, f), "utf8"));
        out.push({
          slug: json.slug, title: json.title, category: json.category, tldr: json.tldr,
          products: (json.body ?? [])
            .filter((b: { type: string; name?: string; price?: string }) => b.type === "product" && b.name && b.price)
            .map((b: { name: string; price: string }) => ({ name: b.name, price: b.price })),
        });
      } catch {}
    }
  }
  corpusCache = out;
  return out;
}

const REPLY_SYSTEM = `You are the X reply ghostwriter for KanzenAI — an independent affiliate review site for real estate agents.

Someone has just posted a tweet that mentions a real-estate tech tool you've researched. Write a SUBSTANTIVE reply under 250 chars that adds a specific data point.

Voice:
- Lead with a $ amount, %, or concrete fact
- Zero sycophancy ("great point!", "love this!") → auto-fail
- No hashtags. No emojis (→ ok)
- Short. Conversational. Peer-to-peer, not marketer.
- One specific claim per reply
- Mild disagreement OK if your data contradicts theirs
- DO NOT include kanzenai.com URL in the reply body
- Sound like a human researcher, not a brand account

Examples of GOOD:
- "Tested this. Follow Up Boss is $69/mo Grow but adding calling is +$39/user. Real solo cost is ~$108/mo."
- "BombBomb's $36 is annual. Monthly is $42. And Salesforce isn't in Core — only Copilot at $56."
- "Vulcan7 doesn't publish but agent threads put it at $499/mo. RedX bundles 5 leads + dialer for $199."

When you decide whether to reply:
- If the tweet directly mentions a tool in your articles → ALWAYS reply with a data point
- If the tweet is about real estate workflow / agent productivity / lead gen / CRMs broadly → reply if you have ANY relevant pricing/feature data
- ONLY skip (output "SKIP") if the tweet is clearly off-topic (politics, sports, jokes, unrelated to real estate or sales tech)

Output ONLY the reply text (or "SKIP"). No quotes, no preamble.`;

async function draftReply(tweetText: string, username: string, corpus: ArticleSummary[]): Promise<{ reply: string; slug?: string } | null> {
  // Pick relevant articles by keyword overlap
  const lower = tweetText.toLowerCase();
  const scored = corpus.map((a) => {
    const blob = JSON.stringify(a).toLowerCase();
    let score = 0;
    for (const word of lower.split(/\W+/).filter((w) => w.length > 3)) {
      if (blob.includes(word)) score++;
    }
    return { article: a, score };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (scored.length === 0) return null;

  const articleContext = scored.map((x) => {
    const prods = x.article.products.slice(0, 6).map((p) => `  - ${p.name}: ${p.price}`).join("\n");
    return `Article: ${x.article.title}\nTLDR: ${x.article.tldr ?? "—"}\nProducts:\n${prods}`;
  }).join("\n\n---\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 300,
      system: REPLY_SYSTEM,
      messages: [{ role: "user", content: `Tweet from @${username}:\n"${tweetText}"\n\nRelevant KanzenAI research:\n${articleContext}\n\nWrite the reply (or output "SKIP" if not a good fit).` }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}`);
  const data = await resp.json();
  let reply: string = (data.content?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");
  if (reply === "SKIP" || reply.toLowerCase().startsWith("skip")) return null;
  const lo = reply.toLowerCase();
  if (lo.includes("great point") || lo.includes("love this") || lo.includes("check out kanzenai") || reply.startsWith("@") || reply.length === 0) return null;
  if (reply.length > 270) reply = reply.slice(0, 267) + "…";
  return { reply, slug: scored[0].article.slug };
}

async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });
  const corpus = await loadCorpus();
  let totalAdded = 0;
  const seenAuthors = new Set<string>();

  for (const query of SEARCH_QUERIES) {
    if (totalAdded >= MAX_RESULTS) break;
    console.log(`\n→ Search: ${query}`);
    let result;
    try {
      result = await twitter.v2.search(query, {
        max_results: 20,
        "tweet.fields": ["created_at", "author_id", "public_metrics", "lang"],
        "user.fields": ["username", "public_metrics", "name"],
        expansions: ["author_id"],
      });
    } catch (e) {
      console.log(`  ✗ ${(e as Error).message}`);
      continue;
    }
    const tweets = result.data?.data ?? [];
    const users = new Map<string, { username: string; followers: number; name: string }>();
    for (const u of result.includes?.users ?? []) {
      users.set(u.id, { username: u.username, followers: u.public_metrics?.followers_count ?? 0, name: u.name });
    }
    console.log(`  · ${tweets.length} candidates`);

    for (const t of tweets) {
      if (totalAdded >= MAX_RESULTS) break;
      if (!t.author_id) continue;
      const author = users.get(t.author_id);
      if (!author) continue;
      if (author.followers < MIN_FOLLOWERS) continue;
      if (seenAuthors.has(author.username)) continue; // 1 reply per author per run
      if (await alreadySeen(t.id)) continue;
      if (author.username.toLowerCase() === "kanzenofficial") continue; // don't reply to ourselves

      try {
        const drafted = await draftReply(t.text, author.username, corpus);
        if (!drafted) { console.log(`    · skip @${author.username} (Claude skipped)`); continue; }

        const item: QueuedReply = {
          id: `${author.username}-${t.id}`,
          targetUser: author.username,
          tweetId: t.id,
          tweetText: t.text,
          tweetUrl: `https://x.com/${author.username}/status/${t.id}`,
          tweetCreatedAt: t.created_at ?? new Date().toISOString(),
          matchedKeywords: [query.split(" ")[0].replace(/[()"]/g, "")],
          replyText: drafted.reply,
          draftedAt: new Date().toISOString(),
          status: "pending",
          sourceArticleSlug: drafted.slug,
        };

        console.log(`    ✓ @${author.username} (${author.followers.toLocaleString()} followers)`);
        console.log(`      "${t.text.slice(0, 80)}..."`);
        console.log(`      reply: ${drafted.reply.slice(0, 100)}...`);

        if (!DRY_RUN) {
          const q = await loadQueue();
          q.unshift(item);
          await saveQueue(q);
        }
        seenAuthors.add(author.username);
        totalAdded++;
      } catch (e) {
        console.log(`    ✗ Draft failed for @${author.username}: ${(e as Error).message}`);
      }
    }

    // small delay between queries to be polite
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\n→ Added ${totalAdded} new reply draft(s) to queue${DRY_RUN ? " (dry-run)" : ""}`);
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err.message);
  process.exit(1);
});
