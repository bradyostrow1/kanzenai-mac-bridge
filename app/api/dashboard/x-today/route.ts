import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT = join(ROOT, ".audit");

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  return null;
}

async function readJsonLines<T = Record<string, unknown>>(path: string): Promise<T[]> {
  if (!existsSync(path)) return [];
  const text = await readFile(path, "utf8");
  return text.split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l) as T; } catch { return null; }
  }).filter((x): x is T => !!x);
}

function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isToday(iso: string): boolean {
  return localYMD(new Date(iso)) === localYMD(new Date());
}

type PostLog = { ts: string; slug?: string; tweetId: string; replyId?: string; promoId?: string; text: string };
type ReplyLog = { ts: string; targetUser?: string; targetTweetId?: string; postedTweetId: string; text: string; authorFollowers?: number };
type ThreadLog = { ts: string; slug: string; title: string; rootTweetId: string; allTweetIds: string[]; tweetTexts: string[] };

type TodayItem =
  | { kind: "post"; ts: string; slug?: string; mainId: string; linkReplyId?: string; promoId?: string; text: string }
  | { kind: "reply"; ts: string; targetUser?: string; targetTweetId?: string; tweetId: string; text: string; authorFollowers?: number }
  | { kind: "thread"; ts: string; slug: string; title: string; rootTweetId: string; tweetIds: string[]; texts: string[] };

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;

  const posts = (await readJsonLines<PostLog>(join(AUDIT, "x-posts.log"))).filter((e) => e.ts && isToday(e.ts));
  const replies = (await readJsonLines<ReplyLog>(join(AUDIT, "x-replies-posted.log"))).filter((e) => e.ts && isToday(e.ts));
  const threads = (await readJsonLines<ThreadLog>(join(AUDIT, "x-threads-posted.log"))).filter((e) => e.ts && isToday(e.ts));

  const items: TodayItem[] = [
    ...posts.map((e): TodayItem => ({
      kind: "post", ts: e.ts, slug: e.slug, mainId: e.tweetId,
      linkReplyId: e.replyId, promoId: e.promoId, text: e.text,
    })),
    ...replies.map((e): TodayItem => ({
      kind: "reply", ts: e.ts, targetUser: e.targetUser, targetTweetId: e.targetTweetId,
      tweetId: e.postedTweetId, text: e.text, authorFollowers: e.authorFollowers,
    })),
    ...threads.map((e): TodayItem => ({
      kind: "thread", ts: e.ts, slug: e.slug, title: e.title,
      rootTweetId: e.rootTweetId, tweetIds: e.allTweetIds, texts: e.tweetTexts,
    })),
  ].sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));

  const totals = {
    posts: posts.length,
    replies: replies.length,
    threads: threads.length,
    // each post = 1 main + (1 if linkReply) + (1 if promo); thread = N; reply = 1
    totalTweets:
      posts.reduce((n, e) => n + 1 + (e.replyId ? 1 : 0) + (e.promoId ? 1 : 0), 0) +
      replies.length +
      threads.reduce((n, e) => n + (e.allTweetIds?.length ?? 0), 0),
  };

  return NextResponse.json({ items, totals, fetchedAt: new Date().toISOString() });
}
