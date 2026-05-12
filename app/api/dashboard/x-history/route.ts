import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const METRICS_PATH = join(ROOT, ".audit", "x-metrics.json");

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

type Metric = {
  tweetId: string;
  text: string;
  postedAt: string;
  kind: "auto-post" | "reply" | "manual";
  slug?: string;
  targetUser?: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number | null;
  profileClicks: number | null;
  urlClicks: number | null;
  fetchedAt: string;
};

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;
  if (!existsSync(METRICS_PATH)) {
    return NextResponse.json({ items: [], totals: null, fetchedAt: null });
  }
  const items: Metric[] = JSON.parse(await readFile(METRICS_PATH, "utf8"));
  const totals = items.reduce(
    (acc, m) => {
      acc.impressions += m.impressions ?? 0;
      acc.likes += m.likes;
      acc.replies += m.replies;
      acc.retweets += m.retweets;
      acc.urlClicks += m.urlClicks ?? 0;
      acc.profileClicks += m.profileClicks ?? 0;
      return acc;
    },
    { impressions: 0, likes: 0, replies: 0, retweets: 0, urlClicks: 0, profileClicks: 0 },
  );
  return NextResponse.json({
    items,
    totals,
    fetchedAt: items[0]?.fetchedAt ?? null,
    count: items.length,
  });
}
