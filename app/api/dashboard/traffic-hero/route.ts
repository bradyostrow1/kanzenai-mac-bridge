import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT = join(ROOT, ".audit");
const METRICS_PATH = join(AUDIT, "x-metrics.json");

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "dev only" }, { status: 404 });
  }
  return null;
}

function dayKey(d: Date): string {
  return `kanzenai-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function readCounter(key: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.counterapi.dev/v1/kanzenai/${key}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(2500),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return typeof data.count === "number" ? data.count : null;
  } catch {
    return null;
  }
}

async function readJsonLines(path: string): Promise<Array<Record<string, unknown>>> {
  if (!existsSync(path)) return [];
  const text = await readFile(path, "utf8");
  return text.split("\n").filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter((x): x is Record<string, unknown> => !!x);
}

function localYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function withinDays(iso: string, days: number): boolean {
  const ms = Date.now() - Date.parse(iso);
  return ms <= days * 24 * 60 * 60 * 1000;
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;

  // ─── Web: counterapi.dev — today, last 7 days series, all-time ──
  const today = new Date();
  const dayKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dayKeys.push(dayKey(d));
  }
  const [todayCount, totalCount, ...prev6] = await Promise.all([
    readCounter(dayKeys[0]),
    readCounter("kanzenai-total"),
    ...dayKeys.slice(1).map(readCounter),
  ]);
  const series = [todayCount, ...prev6].map((n) => n ?? 0);
  const last7Total = series.reduce((a, b) => a + b, 0);

  // ─── X: post counts from logs (free, no API call) + last-known metrics ──
  const posts = await readJsonLines(join(AUDIT, "x-posts.log"));
  const replies = await readJsonLines(join(AUDIT, "x-replies-posted.log"));
  const threads = await readJsonLines(join(AUDIT, "x-threads-posted.log"));

  // Author diversity pacing: next auto-post is gated until the configured
  // minutes after the last post. Defaults match scripts/post-to-x.ts.
  const MIN_GAP_MIN = Number(process.env.X_POST_MIN_GAP_MIN ?? 120);
  let lastPostTs: string | null = null;
  for (let i = posts.length - 1; i >= 0; i--) {
    if (typeof posts[i].ts === "string") { lastPostTs = posts[i].ts as string; break; }
  }
  const nextEligibleAt = lastPostTs
    ? new Date(Date.parse(lastPostTs) + MIN_GAP_MIN * 60_000).toISOString()
    : null;

  const postsToday = posts.filter((e) => typeof e.ts === "string" && localYMD(new Date(e.ts as string)) === localYMD(new Date())).length;
  const postsLast7d = posts.filter((e) => typeof e.ts === "string" && withinDays(e.ts as string, 7)).length;
  const repliesToday = replies.filter((e) => typeof e.ts === "string" && localYMD(new Date(e.ts as string)) === localYMD(new Date())).length;
  const repliesLast7d = replies.filter((e) => typeof e.ts === "string" && withinDays(e.ts as string, 7)).length;
  const threadsLast7d = threads.filter((e) => typeof e.ts === "string" && withinDays(e.ts as string, 7)).length;

  // ─── X impressions: only available if x-analytics has run recently ──
  let xImpressions: number | null = null;
  let xLikes: number | null = null;
  let xMetricsAt: string | null = null;
  if (existsSync(METRICS_PATH)) {
    try {
      const items: Array<{ impressions?: number | null; likes?: number; fetchedAt?: string }> = JSON.parse(await readFile(METRICS_PATH, "utf8"));
      xImpressions = items.reduce((n, m) => n + (m.impressions ?? 0), 0);
      xLikes = items.reduce((n, m) => n + (m.likes ?? 0), 0);
      xMetricsAt = items[0]?.fetchedAt ?? null;
    } catch { /* ignore */ }
  }

  return NextResponse.json({
    web: {
      today: todayCount ?? 0,
      last7Days: last7Total,
      allTime: totalCount ?? 0,
      series, // index 0 = today, 6 = 6 days ago
      source: "counterapi.dev",
    },
    x: {
      postsToday,
      postsLast7d,
      repliesToday,
      repliesLast7d,
      threadsLast7d,
      impressions: xImpressions, // null = analytics not run lately
      likes: xLikes,
      metricsFetchedAt: xMetricsAt,
      lastPostAt: lastPostTs,
      nextEligibleAt,
      minGapMinutes: MIN_GAP_MIN,
    },
    fetchedAt: new Date().toISOString(),
  });
}
