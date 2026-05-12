import { NextResponse } from "next/server";
import { readFile, writeFile, appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { TwitterApi } from "twitter-api-v2";

const ROOT = process.cwd();
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
  postedAt?: string;
  postedTweetId?: string;
  sourceArticleSlug?: string;
};

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

async function load(): Promise<QueuedReply[]> {
  if (!existsSync(QUEUE_PATH)) return [];
  try { return JSON.parse(await readFile(QUEUE_PATH, "utf8")); } catch { return []; }
}
async function save(items: QueuedReply[]) {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });
  await writeFile(QUEUE_PATH, JSON.stringify(items, null, 2));
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;
  return NextResponse.json({ items: await load() });
}

// PATCH: update status, edit replyText, OR post to X.
export async function PATCH(req: Request) {
  const guard = devGuard();
  if (guard) return guard;
  const body = await req.json();
  const { id, action, replyText } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const items = await load();
  const item = items.find((i) => i.id === id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "edit" && typeof replyText === "string") {
    item.replyText = replyText.slice(0, 270);
    await save(items);
    return NextResponse.json({ ok: true, item });
  }

  if (action === "discard") {
    item.status = "discarded";
    await save(items);
    return NextResponse.json({ ok: true, item });
  }

  if (action === "post") {
    if (item.status === "posted") {
      return NextResponse.json({ error: "already posted" }, { status: 400 });
    }
    try {
      const twitter = new TwitterApi({
        appKey: process.env.X_CONSUMER_KEY!,
        appSecret: process.env.X_CONSUMER_SECRET!,
        accessToken: process.env.X_ACCESS_TOKEN!,
        accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
      });
      const text = (typeof replyText === "string" ? replyText : item.replyText).slice(0, 270);
      const r = await twitter.v2.tweet(text, { reply: { in_reply_to_tweet_id: item.tweetId } });
      item.status = "posted";
      item.postedAt = new Date().toISOString();
      item.postedTweetId = r.data.id;
      item.replyText = text;
      await save(items);
      await appendFile(
        POSTED_PATH,
        JSON.stringify({
          ts: item.postedAt,
          tweetId: item.tweetId,
          targetUser: item.targetUser,
          postedTweetId: r.data.id,
          text,
        }) + "\n",
      );
      return NextResponse.json({ ok: true, item, postedUrl: `https://x.com/i/web/status/${r.data.id}` });
    } catch (e) {
      const msg = (e as Error).message;
      return NextResponse.json({ error: `Post failed: ${msg}` }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
