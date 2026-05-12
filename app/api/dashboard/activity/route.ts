import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  return null;
}

type Event = {
  ts: string;
  kind: "tweet" | "reply" | "thread" | "click" | "subscribe" | "audit" | "deploy";
  text: string;
  href?: string;
  meta?: string;
};

async function readJsonLines(path: string): Promise<Array<Record<string, unknown>>> {
  if (!existsSync(path)) return [];
  const text = await readFile(path, "utf8");
  return text.split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter((x): x is Record<string, unknown> => !!x);
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;

  const events: Event[] = [];

  // Tweets (auto-post)
  for (const e of await readJsonLines(join(AUDIT_DIR, "x-posts.log"))) {
    if (typeof e.ts !== "string") continue;
    const slug = typeof e.slug === "string" ? e.slug : "";
    events.push({
      ts: e.ts,
      kind: "tweet",
      text: `Auto-tweeted article: ${slug.replace(/-/g, " ").slice(0, 80)}`,
      href: typeof e.tweetId === "string" ? `https://x.com/i/web/status/${e.tweetId}` : undefined,
    });
  }

  // Replies (auto)
  for (const e of await readJsonLines(join(AUDIT_DIR, "x-replies-posted.log"))) {
    if (typeof e.ts !== "string") continue;
    const target = typeof e.targetUser === "string" ? e.targetUser : "?";
    const followers = typeof e.authorFollowers === "number" ? e.authorFollowers.toLocaleString() : "—";
    events.push({
      ts: e.ts,
      kind: "reply",
      text: `Replied to @${target}`,
      meta: `${followers} followers`,
      href: typeof e.postedTweetId === "string" ? `https://x.com/i/web/status/${e.postedTweetId}` : undefined,
    });
  }

  // Threads
  for (const e of await readJsonLines(join(AUDIT_DIR, "x-threads-posted.log"))) {
    if (typeof e.ts !== "string") continue;
    const title = typeof e.title === "string" ? e.title : "(untitled)";
    events.push({
      ts: e.ts,
      kind: "thread",
      text: `Posted 5-tweet thread: ${title.slice(0, 70)}`,
      href: typeof e.rootTweetId === "string" ? `https://x.com/i/web/status/${e.rootTweetId}` : undefined,
    });
  }

  // Clicks (affiliate)
  for (const e of await readJsonLines(join(AUDIT_DIR, "clicks.log"))) {
    if (typeof e.ts !== "string") continue;
    const vendor = typeof e.name === "string" ? e.name : typeof e.vendor === "string" ? e.vendor : "vendor";
    const article = typeof e.article === "string" ? ` from /${e.article}` : "";
    events.push({
      ts: e.ts,
      kind: "click",
      text: `Affiliate click → ${vendor}${article}`,
    });
  }

  // Sort newest first, cap to 100
  events.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));

  return NextResponse.json({
    items: events.slice(0, 100),
    fetchedAt: new Date().toISOString(),
    totalEvents: events.length,
  });
}
