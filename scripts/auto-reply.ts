/**
 * KanzenAI auto-reply bot.
 *
 * Searches X for brand-new posts from 10k+ follower accounts in the real
 * estate / agent tech niche, drafts a substantive reply via Claude, and
 * posts it immediately if Claude judges it on-brand.
 *
 * Safety rails (hard-coded — don't bypass):
 *   - Max 10 auto-replies per UTC day
 *   - Max 1 reply per target user per UTC day
 *   - Min 30 min between auto-replies
 *   - Only replies to posts < 60 min old (looks human, max reach window)
 *   - Min 10k followers on the target account
 *   - Claude must produce a substantive reply (no sycophancy / hashtag / @ start)
 *
 * Usage:
 *   npx tsx scripts/auto-reply.ts            # live, will post
 *   npx tsx scripts/auto-reply.ts --dry-run  # find + draft, don't post
 *
 * Designed to run every 15 minutes via launchd. Most runs will post 0-1 replies.
 */
import { TwitterApi } from "twitter-api-v2";
import { readFile, writeFile, appendFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const POSTED_LOG = join(AUDIT_DIR, "x-replies-posted.log");

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

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Safety caps ────────────────────────────────────────────────────────────
const CAPS = {
  maxRepliesPerDay: 10,
  maxRepliesPerTargetPerDay: 1,
  minMinutesBetweenReplies: 30,
  maxTweetAgeMinutes: 60,
  minFollowers: 10_000,
};

// ─── X queries — niche, broad enough to find fresh posts ────────────────────
const QUERIES = [
  '("Follow Up Boss" OR "kvCORE" OR "Lofty" OR "Real Geeks" OR "Sierra Interactive") -is:retweet -is:reply lang:en',
  '("BombBomb" OR "Dubb") "real estate" -is:retweet -is:reply lang:en',
  '("Vulcan7" OR "RedX" OR "Mojo Dialer" OR "PhoneBurner") -is:retweet -is:reply lang:en',
  '"real estate CRM" -is:retweet -is:reply lang:en',
  '"real estate AI" -is:retweet -is:reply lang:en',
  '"realtor tech" -is:retweet -is:reply lang:en',
  '"agent tools" "real estate" -is:retweet -is:reply lang:en',
];

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!;
const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

// ─── State helpers ──────────────────────────────────────────────────────────
type PostedEntry = {
  ts: string;
  tweetId: string;
  targetUser: string;
  postedTweetId: string;
  text: string;
  authorFollowers?: number;
};

async function readPosted(): Promise<PostedEntry[]> {
  if (!existsSync(POSTED_LOG)) return [];
  const text = await readFile(POSTED_LOG, "utf8");
  return text.split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l) as PostedEntry; } catch { return null; } }).filter((x): x is PostedEntry => !!x);
}

function todayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function canReplyNow(): Promise<{ allowed: boolean; reason?: string }> {
  const posted = await readPosted();
  const today = todayKey();
  const todayPosts = posted.filter((p) => p.ts.startsWith(today));
  if (todayPosts.length >= CAPS.maxRepliesPerDay) {
    return { allowed: false, reason: `Daily cap reached (${CAPS.maxRepliesPerDay})` };
  }
  // Min time gap
  const latest = posted.reduce<number>((acc, p) => Math.max(acc, Date.parse(p.ts)), 0);
  if (latest > 0) {
    const minutesSince = (Date.now() - latest) / 60_000;
    if (minutesSince < CAPS.minMinutesBetweenReplies) {
      return { allowed: false, reason: `Last reply was ${Math.round(minutesSince)}min ago (need ${CAPS.minMinutesBetweenReplies}min)` };
    }
  }
  return { allowed: true };
}

function targetUsedToday(posted: PostedEntry[], username: string): boolean {
  const today = todayKey();
  return posted.some((p) => p.ts.startsWith(today) && p.targetUser.toLowerCase() === username.toLowerCase());
}

function alreadyReplied(posted: PostedEntry[], tweetId: string): boolean {
  return posted.some((p) => p.tweetId === tweetId);
}

// ─── Article corpus (re-used) ───────────────────────────────────────────────
type ArticleSummary = { slug: string; title: string; category?: string; tldr?: string; products: Array<{ name: string; price: string }> };
let corpusCache: ArticleSummary[] | null = null;
async function loadCorpus(): Promise<ArticleSummary[]> {
  if (corpusCache) return corpusCache;
  const out: ArticleSummary[] = [];
  for (const dir of [ARTICLES_DIR, COMPARISONS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const j = JSON.parse(await readFile(join(dir, f), "utf8"));
        out.push({
          slug: j.slug, title: j.title, category: j.category, tldr: j.tldr,
          products: (j.body ?? [])
            .filter((b: { type: string; name?: string; price?: string }) => b.type === "product" && b.name && b.price)
            .map((b: { name: string; price: string }) => ({ name: b.name, price: b.price })),
        });
      } catch {}
    }
  }
  corpusCache = out;
  return out;
}

// ─── Claude reply drafter ───────────────────────────────────────────────────
const SYSTEM = `You are the X reply ghostwriter for KanzenAI — independent affiliate review site for real estate agents.

A 10k+ follower account just posted a tweet that touches a real-estate tech topic you've researched. Write a substantive reply under 250 chars that adds a specific data point.

VOICE (HARD RULES — failure = auto-suspension):
- Lead with a $ amount, percent, or specific tool name
- ZERO sycophancy ("great point!", "love this!", "💯") → instant SKIP
- No hashtags. No emojis (→ ✓ ✗ ok)
- One specific claim per reply
- Sound like a peer real estate operator / researcher, not a brand account
- Mild disagreement is fine if your data contradicts theirs — builds credibility
- DO NOT include the kanzenai.com URL in the reply body
- DO NOT start with @ (kills the reply's reach in non-followers' feeds)

OUTPUT RULES:
- If the tweet is genuinely off-topic OR you have no specific data point to add, output exactly: SKIP
- Otherwise output ONLY the reply text. No quotes, no preamble, no "Here's my reply:"`;

async function draftReply(tweetText: string, username: string, corpus: ArticleSummary[]): Promise<string | null> {
  const lower = tweetText.toLowerCase();
  const scored = corpus.map((a) => {
    const blob = JSON.stringify(a).toLowerCase();
    let s = 0;
    for (const w of lower.split(/\W+/).filter((w) => w.length > 3)) if (blob.includes(w)) s++;
    return { article: a, score: s };
  }).sort((a, b) => b.score - a.score).slice(0, 3);
  if (scored[0]?.score === 0) return null;

  const ctx = scored.map((x) => {
    const prods = x.article.products.slice(0, 6).map((p) => `  - ${p.name}: ${p.price}`).join("\n");
    return `Article: ${x.article.title}\nTLDR: ${x.article.tldr ?? "—"}\nProducts:\n${prods}`;
  }).join("\n\n---\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: "user", content: `Tweet from @${username} (10k+ followers):\n"${tweetText}"\n\nKanzenAI research:\n${ctx}\n\nWrite reply or SKIP.` }],
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  let reply = (data.content?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");
  if (reply === "SKIP" || reply.toLowerCase().startsWith("skip")) return null;
  // Guardrails
  const lo = reply.toLowerCase();
  if (lo.includes("great point") || lo.includes("love this") || lo.includes("check out kanzenai") || lo.includes("kanzenai.com")) return null;
  if (reply.startsWith("@")) return null;
  if (reply.length === 0) return null;
  if (reply.length > 270) reply = reply.slice(0, 267) + "…";
  return reply;
}

// ─── Main loop ──────────────────────────────────────────────────────────────
async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });

  const gate = await canReplyNow();
  if (!gate.allowed) {
    console.log(`→ Auto-reply skipped: ${gate.reason}`);
    return;
  }

  const posted = await readPosted();
  const corpus = await loadCorpus();
  const cutoff = Date.now() - CAPS.maxTweetAgeMinutes * 60_000;

  console.log(`→ Hunting fresh posts (≤${CAPS.maxTweetAgeMinutes}min old) from ${CAPS.minFollowers.toLocaleString()}+ follower accounts...`);

  for (const query of QUERIES) {
    let result;
    try {
      result = await twitter.v2.search(query, {
        max_results: 20,
        "tweet.fields": ["created_at", "author_id", "public_metrics"],
        "user.fields": ["username", "public_metrics", "name", "description"],
        expansions: ["author_id"],
      });
    } catch (e) {
      console.log(`  ✗ Search failed: ${(e as Error).message}`);
      continue;
    }

    const users = new Map<string, { username: string; followers: number; bio: string }>();
    for (const u of result.includes?.users ?? []) {
      users.set(u.id, { username: u.username, followers: u.public_metrics?.followers_count ?? 0, bio: u.description ?? "" });
    }

    for (const t of result.data?.data ?? []) {
      if (!t.author_id || !t.created_at) continue;
      if (Date.parse(t.created_at) < cutoff) continue;
      const author = users.get(t.author_id);
      if (!author) continue;
      if (author.followers < CAPS.minFollowers) continue;
      if (author.username.toLowerCase() === "kanzenofficial") continue;
      if (alreadyReplied(posted, t.id)) continue;
      if (targetUsedToday(posted, author.username)) continue;

      // Soft niche filter: bio should sound like real estate / agent / coach
      const bio = author.bio.toLowerCase();
      const inNiche = ["real estate", "realtor", "broker", "agent", "property", "homes", "housing"].some((kw) => bio.includes(kw));
      if (!inNiche) {
        console.log(`  · skip @${author.username} — bio doesn't read as real estate niche`);
        continue;
      }

      console.log(`\n  → MATCH @${author.username} (${author.followers.toLocaleString()} followers)`);
      console.log(`    "${t.text.slice(0, 120).replace(/\n/g, " ")}..."`);

      const reply = await draftReply(t.text, author.username, corpus);
      if (!reply) { console.log(`    · Claude SKIP (no specific data point to add)`); continue; }

      console.log(`    Reply: ${reply.slice(0, 150)}...`);

      if (DRY_RUN) {
        console.log(`    · DRY RUN — not posting`);
        return; // exit on first match so dry-run is fast
      }

      try {
        const r = await twitter.v2.tweet(reply, { reply: { in_reply_to_tweet_id: t.id } });
        console.log(`    ✓ POSTED → https://x.com/i/web/status/${r.data.id}`);
        await appendFile(POSTED_LOG, JSON.stringify({
          ts: new Date().toISOString(),
          tweetId: t.id,
          targetUser: author.username,
          postedTweetId: r.data.id,
          text: reply,
          authorFollowers: author.followers,
        }) + "\n");
        return; // ONE auto-reply per run, max — preserve velocity cap
      } catch (e) {
        console.log(`    ✗ Post failed: ${(e as Error).message}`);
        // Continue to next candidate — don't burn the whole run on a single API hiccup
      }
    }
  }

  console.log(`→ No qualifying matches this run.`);
}

main().catch((err) => { console.error("\n✗ Fatal:", err.message); process.exit(1); });
