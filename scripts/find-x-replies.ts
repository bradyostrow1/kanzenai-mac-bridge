/**
 * KanzenAI X reply monitor.
 *
 * 1. Polls TARGET_ACCOUNTS for tweets in the last few hours.
 * 2. Filters for tweets that mention real-estate-tech keywords.
 * 3. Skips ones we've already drafted/posted replies to.
 * 4. Asks Claude to draft a substantive reply using data from kanzenai.com.
 * 5. Queues the draft to .audit/x-reply-queue.json for dashboard approval.
 *
 * Designed to run every 30 minutes via launchd. Safety caps in lib/x-targets.ts
 * prevent the account from getting suspended.
 *
 * Usage:
 *   npx tsx scripts/find-x-replies.ts             # poll all targets
 *   npx tsx scripts/find-x-replies.ts --user X    # poll just one target
 *   npx tsx scripts/find-x-replies.ts --dry-run   # find matches, draft, don't queue
 */
import { TwitterApi } from "twitter-api-v2";
import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { TARGET_ACCOUNTS, REPLY_KEYWORDS, SAFETY_CAPS } from "../lib/x-targets";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const QUEUE_PATH = join(AUDIT_DIR, "x-reply-queue.json");
const POSTED_PATH = join(AUDIT_DIR, "x-replies-posted.log");
const USER_ID_CACHE = join(AUDIT_DIR, "x-user-ids.json");

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
const SINGLE_USER = typeof args["user"] === "string" ? args["user"] : null;
const LOOKBACK_HOURS_OVERRIDE = typeof args["hours"] === "string" ? Number(args["hours"]) : null;
const MAX_PER_USER_OVERRIDE = typeof args["per-user"] === "string" ? Number(args["per-user"]) : null;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

// ─── Queue persistence ─────────────────────────────────────────────────────
type QueuedReply = {
  id: string; // composite: targetUser + tweetId
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

// ─── User ID resolution (cached) ───────────────────────────────────────────
async function getUserIds(): Promise<Record<string, string>> {
  let cache: Record<string, string> = {};
  if (existsSync(USER_ID_CACHE)) {
    try { cache = JSON.parse(await readFile(USER_ID_CACHE, "utf8")); } catch {}
  }
  const missing = TARGET_ACCOUNTS.filter((u) => !cache[u.toLowerCase()]);
  if (missing.length === 0) return cache;

  console.log(`→ Resolving ${missing.length} new user ID(s)...`);
  for (const username of missing) {
    try {
      const r = await twitter.v2.userByUsername(username);
      if (r.data?.id) {
        cache[username.toLowerCase()] = r.data.id;
        console.log(`  ✓ @${username} → ${r.data.id}`);
      } else {
        console.log(`  ✗ @${username} not found`);
      }
    } catch (e) {
      console.log(`  ✗ @${username}: ${(e as Error).message}`);
    }
  }
  await writeFile(USER_ID_CACHE, JSON.stringify(cache, null, 2));
  return cache;
}

// ─── Article corpus loader (for Claude context) ────────────────────────────
type ArticleSummary = {
  slug: string;
  title: string;
  category?: string;
  tldr?: string;
  products: Array<{ name: string; price: string }>;
};

let articleCorpusCache: ArticleSummary[] | null = null;
async function loadArticleCorpus(): Promise<ArticleSummary[]> {
  if (articleCorpusCache) return articleCorpusCache;
  const out: ArticleSummary[] = [];
  for (const dir of [ARTICLES_DIR, COMPARISONS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const json = JSON.parse(await readFile(join(dir, f), "utf8"));
        out.push({
          slug: json.slug,
          title: json.title,
          category: json.category,
          tldr: json.tldr,
          products: (json.body ?? [])
            .filter((b: { type: string; name?: string; price?: string }) => b.type === "product" && b.name && b.price)
            .map((b: { name: string; price: string }) => ({ name: b.name, price: b.price })),
        });
      } catch { /* skip */ }
    }
  }
  articleCorpusCache = out;
  return out;
}

// ─── Keyword matching ──────────────────────────────────────────────────────
function findMatchedKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return REPLY_KEYWORDS.filter((kw) => lower.includes(kw.toLowerCase()));
}

// ─── Claude reply drafter ──────────────────────────────────────────────────
const REPLY_SYSTEM = `You are the X reply ghostwriter for KanzenAI — an independent affiliate review site for working real estate agents.

A bigger account has just posted a tweet that mentions a real-estate tech tool you've researched. Your job: write a SUBSTANTIVE reply that adds a specific data point from KanzenAI's research, in 240 characters or less.

Reply voice rules:
- Lead with a specific dollar amount, percentage, or concrete fact.
- ZERO sycophancy. No "great point!" or "love this!"
- No hashtags. No emojis (except → for lists).
- Short. Conversational. Like a peer adding value, not a marketer.
- One specific claim per reply.
- It's fine to mildly disagree if your data contradicts theirs — adds credibility.
- DO NOT include the kanzenai.com URL in the reply itself. Just the data point.
- Sound like a human real estate agent / researcher, not a brand account.

Examples of good reply patterns:
- "Tested this — Follow Up Boss is $69/mo Grow but adding calling is +$39/user. Real cost for solo is ~$108/mo, not $69."
- "BombBomb's $36/mo is the annual price. Monthly billing is $42. And Salesforce integration isn't in Core — only Copilot at $56."
- "Vulcan7 doesn't publish pricing but it's $499/mo based on agent forum threads. RedX bundles 5 lead types for $199 if you want the math."
- "If the broker covers kvCORE you're fine. Standalone it's $499/mo which is brutal for a solo."

Output ONLY the reply text. No quotes, no preamble, no "Reply:".`;

async function draftReply(
  tweetText: string,
  authorUsername: string,
  matchedKeywords: string[],
  corpus: ArticleSummary[],
): Promise<{ reply: string; sourceArticleSlug?: string } | null> {
  // Pick the article(s) most likely to have relevant data
  const relevant = corpus
    .map((a) => {
      const blob = JSON.stringify(a).toLowerCase();
      const score = matchedKeywords.reduce((s, kw) => s + (blob.includes(kw.toLowerCase()) ? 1 : 0), 0);
      return { article: a, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.article);

  if (relevant.length === 0) return null;

  const articleContext = relevant
    .map((a) => {
      const prods = a.products.slice(0, 6).map((p) => `  - ${p.name}: ${p.price}`).join("\n");
      return `Article: ${a.title}\nTLDR: ${a.tldr ?? "—"}\nProducts:\n${prods}`;
    })
    .join("\n\n---\n\n");

  const userPrompt = `Tweet from @${authorUsername}:
"${tweetText}"

Matched keywords: ${matchedKeywords.join(", ")}

Relevant KanzenAI research:
${articleContext}

Write the reply.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 300,
      system: REPLY_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
  const data = await resp.json();
  let reply: string = (data.content?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");

  // Refuse drafts that smell off-brand
  const lower = reply.toLowerCase();
  if (
    lower.includes("great point") ||
    lower.includes("love this") ||
    lower.includes("check out kanzenai") ||
    lower.startsWith("@") ||
    reply.length === 0 ||
    reply.length > 270
  ) {
    if (reply.length > 270) reply = reply.slice(0, 267) + "…";
    else return null;
  }

  return { reply, sourceArticleSlug: relevant[0].slug };
}

// ─── Main poll loop ────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });

  const userIds = await getUserIds();
  const targets = SINGLE_USER ? [SINGLE_USER] : TARGET_ACCOUNTS;

  const hours = LOOKBACK_HOURS_OVERRIDE ?? SAFETY_CAPS.maxTweetAgeHours;
  const maxAgeMs = hours * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;
  const maxPerUser = MAX_PER_USER_OVERRIDE ?? 1;

  const corpus = await loadArticleCorpus();
  console.log(`→ Polling ${targets.length} target(s), looking for tweets in last ${hours}h (max ${maxPerUser}/user)\n`);

  let newDrafts = 0;
  for (const username of targets) {
    const userId = userIds[username.toLowerCase()];
    if (!userId) { console.log(`  · skip @${username} (no user ID)`); continue; }

    let tweets: Array<{ id: string; text: string; created_at?: string }>;
    try {
      const resp = await twitter.v2.userTimeline(userId, {
        max_results: 10,
        "tweet.fields": ["created_at", "text"],
        exclude: ["retweets", "replies"],
      });
      tweets = resp.data?.data ?? [];
    } catch (e) {
      console.log(`  ✗ @${username}: ${(e as Error).message}`);
      continue;
    }

    let matchesForUser = 0;
    for (const t of tweets) {
      if (t.created_at && Date.parse(t.created_at) < cutoff) continue;

      const matched = findMatchedKeywords(t.text);
      if (matched.length === 0) continue;
      if (await alreadySeen(t.id)) continue;

      console.log(`  ✓ @${username} match: "${t.text.slice(0, 80)}…" (kw: ${matched.slice(0, 3).join(", ")})`);

      try {
        const drafted = await draftReply(t.text, username, matched, corpus);
        if (!drafted) { console.log(`    · Claude declined (off-brand)`); continue; }

        const tweetUrl = `https://x.com/${username}/status/${t.id}`;
        const item: QueuedReply = {
          id: `${username}-${t.id}`,
          targetUser: username,
          tweetId: t.id,
          tweetText: t.text,
          tweetUrl,
          tweetCreatedAt: t.created_at ?? new Date().toISOString(),
          matchedKeywords: matched,
          replyText: drafted.reply,
          draftedAt: new Date().toISOString(),
          status: "pending",
          sourceArticleSlug: drafted.sourceArticleSlug,
        };

        console.log(`    Reply draft: ${drafted.reply.slice(0, 100)}…`);

        if (!DRY_RUN) {
          const q = await loadQueue();
          q.unshift(item);
          await saveQueue(q);
        }
        newDrafts++;
        matchesForUser++;
      } catch (e) {
        console.log(`    ✗ Draft failed: ${(e as Error).message}`);
      }

      if (matchesForUser >= maxPerUser) break;
    }

    // Brief delay between targets to be polite to the API
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n→ ${newDrafts} new reply draft(s) added to queue${DRY_RUN ? " (dry-run, not saved)" : ""}`);
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err.message);
  process.exit(1);
});
