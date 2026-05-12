import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { TwitterApi } from "twitter-api-v2";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");

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
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  return null;
}

function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Cache for slow / expensive lookups (X user + Resend audience) — 5 min TTL
const CACHE: Record<string, { value: unknown; expires: number }> = {};
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = CACHE[key];
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  CACHE[key] = { value, expires: Date.now() + ttlMs };
  return value;
}

async function getEmailSubscribers(): Promise<{ total: number; ok: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!key || !audienceId) return { total: 0, ok: false };
  try {
    return await cached(`resend-${audienceId}`, 5 * 60_000, async () => {
      const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(4000),
      });
      if (!r.ok) return { total: 0, ok: false };
      const data = await r.json();
      const list = Array.isArray(data?.data?.data) ? data.data.data : Array.isArray(data?.data) ? data.data : [];
      return { total: list.length, ok: true };
    });
  } catch {
    return { total: 0, ok: false };
  }
}

async function getXFollowers(): Promise<{ followers: number; following: number; tweets: number; ok: boolean }> {
  const ck = process.env.X_CONSUMER_KEY;
  const cs = process.env.X_CONSUMER_SECRET;
  const at = process.env.X_ACCESS_TOKEN;
  const ats = process.env.X_ACCESS_TOKEN_SECRET;
  if (!ck || !cs || !at || !ats) return { followers: 0, following: 0, tweets: 0, ok: false };
  try {
    return await cached("x-followers", 10 * 60_000, async () => {
      const twitter = new TwitterApi({ appKey: ck, appSecret: cs, accessToken: at, accessSecret: ats });
      const r = await twitter.v2.userByUsername("KanzenOfficial", { "user.fields": ["public_metrics"] });
      const m = r.data?.public_metrics;
      return {
        followers: m?.followers_count ?? 0,
        following: m?.following_count ?? 0,
        tweets: m?.tweet_count ?? 0,
        ok: true,
      };
    });
  } catch {
    return { followers: 0, following: 0, tweets: 0, ok: false };
  }
}

async function getAffiliateClicks(): Promise<{ today: number; total: number }> {
  const path = join(AUDIT_DIR, "clicks.log");
  if (!existsSync(path)) return { today: 0, total: 0 };
  try {
    const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
    const today = localDate();
    let todayCount = 0;
    for (const l of lines) {
      try {
        const o = JSON.parse(l);
        if (o.ts && new Date(o.ts).toISOString().startsWith(today)) todayCount++;
      } catch {}
    }
    return { today: todayCount, total: lines.length };
  } catch {
    return { today: 0, total: 0 };
  }
}

async function getXImpressions(): Promise<{ today: number; total: number; bestTweet?: { text: string; impressions: number; tweetId: string } }> {
  const path = join(AUDIT_DIR, "x-metrics.json");
  if (!existsSync(path)) return { today: 0, total: 0 };
  try {
    const items: Array<{ text: string; tweetId: string; postedAt: string; impressions: number | null }> = JSON.parse(await readFile(path, "utf8"));
    const today = localDate();
    let todayImp = 0;
    let totalImp = 0;
    let best: { text: string; impressions: number; tweetId: string } | undefined;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60_000;
    for (const m of items) {
      const imp = m.impressions ?? 0;
      totalImp += imp;
      if (m.postedAt?.startsWith(today)) todayImp += imp;
      if (Date.parse(m.postedAt ?? "") >= sevenDaysAgo) {
        if (!best || imp > best.impressions) {
          best = { text: m.text.slice(0, 140), impressions: imp, tweetId: m.tweetId };
        }
      }
    }
    return { today: todayImp, total: totalImp, bestTweet: best };
  } catch {
    return { today: 0, total: 0 };
  }
}

async function getXReplyQueueCount(): Promise<number> {
  const path = join(AUDIT_DIR, "x-reply-queue.json");
  if (!existsSync(path)) return 0;
  try {
    const items: Array<{ status: string }> = JSON.parse(await readFile(path, "utf8"));
    return items.filter((i) => i.status === "pending").length;
  } catch {
    return 0;
  }
}

async function getTweetCount(): Promise<{ today: number; week: number }> {
  const today = localDate();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60_000;
  const counts = { today: 0, week: 0 };
  for (const name of ["x-posts.log", "x-replies-posted.log", "x-threads-posted.log"]) {
    const path = join(AUDIT_DIR, name);
    if (!existsSync(path)) continue;
    try {
      const lines = (await readFile(path, "utf8")).split("\n").filter(Boolean);
      for (const l of lines) {
        try {
          const o = JSON.parse(l);
          if (o.ts) {
            if (o.ts.startsWith(today)) counts.today++;
            if (Date.parse(o.ts) >= weekAgo) counts.week++;
          }
        } catch {}
      }
    } catch {}
  }
  return counts;
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;

  const [emails, x, clicks, impressions, replyQueue, tweetCount] = await Promise.all([
    getEmailSubscribers(),
    getXFollowers(),
    getAffiliateClicks(),
    getXImpressions(),
    getXReplyQueueCount(),
    getTweetCount(),
  ]);

  return NextResponse.json({
    email: emails,
    x,
    clicks,
    impressions,
    replyQueue,
    tweetCount,
    fetchedAt: new Date().toISOString(),
  });
}
