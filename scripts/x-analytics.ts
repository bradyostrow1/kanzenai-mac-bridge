/**
 * KanzenAI X analytics fetcher.
 *
 * Reads every tweet ID we've posted (x-posts.log + x-replies-posted.log)
 * and pulls fresh public + non-public metrics in batches from X API v2.
 * Saves to .audit/x-metrics.json for the dashboard to display.
 *
 * Cost: 1 API call per batch of 100 tweets. ~$0.0001 per run on pay-per-use.
 *
 * Usage:
 *   npx tsx scripts/x-analytics.ts
 */
import { TwitterApi } from "twitter-api-v2";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
const POSTS_LOG = join(AUDIT_DIR, "x-posts.log");
const REPLIES_LOG = join(AUDIT_DIR, "x-replies-posted.log");
const METRICS_PATH = join(AUDIT_DIR, "x-metrics.json");

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

const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

type LoggedTweet = {
  ts: string;
  tweetId: string;
  text?: string;
  slug?: string;
  replyId?: string;
  targetUser?: string;
  postedTweetId?: string;
};

async function loadLog(path: string): Promise<LoggedTweet[]> {
  if (!existsSync(path)) return [];
  const text = await readFile(path, "utf8");
  return text
    .split("\n")
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((x): x is LoggedTweet => !!x);
}

type Metric = {
  tweetId: string;
  text: string;
  postedAt: string;
  kind: "auto-post" | "reply" | "manual";
  // Link back to article if it was an auto-post
  slug?: string;
  // For replies, the target account
  targetUser?: string;
  // Metrics
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number | null; // non-public, only for own tweets via user context
  profileClicks: number | null;
  urlClicks: number | null;
  fetchedAt: string;
};

async function main() {
  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });

  const posts = await loadLog(POSTS_LOG);
  const replies = await loadLog(REPLIES_LOG);

  // Build the master list of tweet IDs (both main posts + their reply links + reply-to-targets)
  const tweets: Record<string, Omit<Metric, "likes" | "retweets" | "replies" | "quotes" | "impressions" | "profileClicks" | "urlClicks" | "fetchedAt">> = {};

  for (const p of posts) {
    if (p.tweetId) {
      tweets[p.tweetId] = {
        tweetId: p.tweetId,
        text: p.text ?? "",
        postedAt: p.ts,
        kind: "auto-post",
        slug: p.slug,
      };
    }
    if (p.replyId) {
      tweets[p.replyId] = {
        tweetId: p.replyId,
        text: "(link reply)",
        postedAt: p.ts,
        kind: "auto-post",
        slug: p.slug,
      };
    }
  }
  for (const r of replies) {
    const id = r.postedTweetId ?? r.tweetId;
    if (!id) continue;
    tweets[id] = {
      tweetId: id,
      text: r.text ?? "",
      postedAt: r.ts,
      kind: "reply",
      targetUser: r.targetUser,
    };
  }

  const ids = Object.keys(tweets);
  if (ids.length === 0) {
    console.log("→ No tweets logged yet. Run after posting at least one.");
    await writeFile(METRICS_PATH, JSON.stringify([], null, 2));
    return;
  }

  console.log(`→ Fetching metrics for ${ids.length} tweet(s) (batched 100/req)...`);

  const out: Metric[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    try {
      const resp = await twitter.v2.tweets(batch, {
        "tweet.fields": ["public_metrics", "non_public_metrics", "created_at"],
      });
      for (const t of resp.data ?? []) {
        const meta = tweets[t.id];
        if (!meta) continue;
        const pm = t.public_metrics ?? { like_count: 0, retweet_count: 0, reply_count: 0, quote_count: 0 };
        const npm = (t as { non_public_metrics?: { impression_count?: number; user_profile_clicks?: number; url_link_clicks?: number } }).non_public_metrics ?? {};
        out.push({
          ...meta,
          likes: pm.like_count ?? 0,
          retweets: pm.retweet_count ?? 0,
          replies: pm.reply_count ?? 0,
          quotes: pm.quote_count ?? 0,
          impressions: npm.impression_count ?? null,
          profileClicks: npm.user_profile_clicks ?? null,
          urlClicks: npm.url_link_clicks ?? null,
          fetchedAt: new Date().toISOString(),
        });
      }
      // For any tweet IDs that came back missing (deleted, etc.), still record a row with zeros
      const returnedIds = new Set((resp.data ?? []).map((t) => t.id));
      for (const id of batch) {
        if (!returnedIds.has(id)) {
          out.push({
            ...tweets[id],
            likes: 0, retweets: 0, replies: 0, quotes: 0,
            impressions: null, profileClicks: null, urlClicks: null,
            fetchedAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.error(`✗ Batch fetch failed: ${(e as Error).message}`);
    }
  }

  out.sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  await writeFile(METRICS_PATH, JSON.stringify(out, null, 2));

  const totalImpressions = out.reduce((s, m) => s + (m.impressions ?? 0), 0);
  const totalLikes = out.reduce((s, m) => s + m.likes, 0);
  const totalClicks = out.reduce((s, m) => s + (m.urlClicks ?? 0), 0);
  console.log(`✓ Wrote ${out.length} metric rows`);
  console.log(`  Totals: ${totalImpressions} impressions · ${totalLikes} likes · ${totalClicks} URL clicks`);
}

main().catch((err) => {
  console.error("\n✗ Fatal:", err.message);
  process.exit(1);
});
