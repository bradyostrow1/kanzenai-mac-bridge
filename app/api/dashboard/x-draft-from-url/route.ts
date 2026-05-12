import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { TwitterApi } from "twitter-api-v2";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const QUEUE_PATH = join(AUDIT_DIR, "x-reply-queue.json");

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

function devGuard() {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "dev only" }, { status: 404 });
  return null;
}

const REPLY_SYSTEM = `You are the X reply ghostwriter for KanzenAI — an independent affiliate review site for working real estate agents.

A user is going to give you a tweet. Write a substantive reply under 250 chars that adds a specific data point from KanzenAI's research.

VOICE:
- Lead with $ amount, percent, or concrete fact
- ZERO sycophancy ("great point!", "love this!") → auto-fail
- No hashtags. No emojis (→ ok)
- Short. Conversational. Peer not marketer.
- One specific claim per reply
- Mild disagreement OK if data contradicts
- DO NOT include the kanzenai.com URL in the reply
- Sound like a real estate agent / researcher peer, not a brand account

If the tweet is genuinely off-topic (not about real estate, sales tech, agent productivity, or anything in your article corpus), output the single word "SKIP".

Output ONLY the reply text. No quotes, no preamble.`;

function parseTweetUrl(url: string): { username: string; tweetId: string } | null {
  const m = url.match(/(?:x|twitter)\.com\/([^/?]+)\/status\/(\d+)/);
  if (!m) return null;
  return { username: m[1], tweetId: m[2] };
}

async function loadCorpus() {
  const out: Array<{ slug: string; title: string; tldr?: string; products: Array<{ name: string; price: string }> }> = [];
  for (const dir of [ARTICLES_DIR, COMPARISONS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const json = JSON.parse(await readFile(join(dir, f), "utf8"));
        out.push({
          slug: json.slug, title: json.title, tldr: json.tldr,
          products: (json.body ?? [])
            .filter((b: { type: string; name?: string; price?: string }) => b.type === "product" && b.name && b.price)
            .map((b: { name: string; price: string }) => ({ name: b.name, price: b.price })),
        });
      } catch {}
    }
  }
  return out;
}

export async function POST(req: Request) {
  const guard = devGuard();
  if (guard) return guard;

  const body = await req.json().catch(() => ({}));
  const url: string = body.url ?? "";
  const parsed = parseTweetUrl(url);
  if (!parsed) return NextResponse.json({ error: "Bad tweet URL. Expected x.com/<user>/status/<id>" }, { status: 400 });

  const twitter = new TwitterApi({
    appKey: process.env.X_CONSUMER_KEY!,
    appSecret: process.env.X_CONSUMER_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });

  // 1) Fetch the tweet
  let tweet;
  try {
    const r = await twitter.v2.singleTweet(parsed.tweetId, { "tweet.fields": ["created_at", "text", "author_id"] });
    tweet = r.data;
    if (!tweet) return NextResponse.json({ error: "Tweet not found" }, { status: 404 });
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 500 });
  }

  // 2) Draft reply via Claude
  const corpus = await loadCorpus();
  // Score articles by token overlap
  const lower = tweet.text.toLowerCase();
  const scored = corpus.map((a) => {
    const blob = JSON.stringify(a).toLowerCase();
    let s = 0;
    for (const w of lower.split(/\W+/).filter((w) => w.length > 3)) if (blob.includes(w)) s++;
    return { article: a, score: s };
  }).sort((a, b) => b.score - a.score).slice(0, 3);

  const ctx = scored.map((x) => {
    const prods = x.article.products.slice(0, 6).map((p) => `  - ${p.name}: ${p.price}`).join("\n");
    return `Article: ${x.article.title}\nTLDR: ${x.article.tldr ?? "—"}\nProducts:\n${prods}`;
  }).join("\n\n---\n\n");

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 350,
      system: REPLY_SYSTEM,
      messages: [{ role: "user", content: `Tweet from @${parsed.username}:\n"${tweet.text}"\n\nKanzenAI research context:\n${ctx || "(no closely matched articles — use general voice)"}\n\nWrite the reply.` }],
    }),
  });
  if (!resp.ok) return NextResponse.json({ error: `Anthropic ${resp.status}` }, { status: 500 });
  const data = await resp.json();
  let reply: string = (data.content?.[0]?.text ?? "").trim().replace(/^["']|["']$/g, "");
  if (reply === "SKIP" || reply.toLowerCase().startsWith("skip")) {
    return NextResponse.json({ error: "Claude judged this off-topic. Try a different tweet." }, { status: 400 });
  }
  if (reply.length > 270) reply = reply.slice(0, 267) + "…";

  // 3) Add to queue
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });
  let queue: Array<{ id: string; tweetId: string }> = [];
  if (existsSync(QUEUE_PATH)) {
    try { queue = JSON.parse(await readFile(QUEUE_PATH, "utf8")); } catch {}
  }
  const id = `${parsed.username}-${parsed.tweetId}`;
  if (queue.some((q) => q.id === id)) {
    return NextResponse.json({ error: "Already in queue" }, { status: 400 });
  }
  const item = {
    id,
    targetUser: parsed.username,
    tweetId: parsed.tweetId,
    tweetText: tweet.text,
    tweetUrl: `https://x.com/${parsed.username}/status/${parsed.tweetId}`,
    tweetCreatedAt: tweet.created_at ?? new Date().toISOString(),
    matchedKeywords: ["manual-paste"],
    replyText: reply,
    draftedAt: new Date().toISOString(),
    status: "pending" as const,
    sourceArticleSlug: scored[0]?.article.slug,
  };
  queue.unshift(item);
  await writeFile(QUEUE_PATH, JSON.stringify(queue, null, 2));

  return NextResponse.json({ ok: true, item });
}
