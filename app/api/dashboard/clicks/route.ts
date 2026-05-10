import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;

  const path = join(process.cwd(), ".audit", "clicks.log");
  if (!existsSync(path)) {
    return NextResponse.json({
      total: 0,
      byVendor: [],
      byArticle: [],
      recent: [],
      installed: false,
    });
  }

  const text = await readFile(path, "utf8");
  const lines = text.trim().split("\n").filter(Boolean);
  const events: Array<{
    ts: string;
    vendor: string;
    name: string;
    status: string;
    referrer: string;
    article: string | null;
    ip: string;
  }> = [];

  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }

  // Aggregate by vendor
  const vendorCounts = new Map<string, { name: string; clicks: number; uniqueIps: Set<string> }>();
  const articleCounts = new Map<string, number>();
  for (const e of events) {
    const v = vendorCounts.get(e.vendor) ?? { name: e.name, clicks: 0, uniqueIps: new Set() };
    v.clicks++;
    if (e.ip) v.uniqueIps.add(e.ip);
    vendorCounts.set(e.vendor, v);

    if (e.article) {
      articleCounts.set(e.article, (articleCounts.get(e.article) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    total: events.length,
    installed: true,
    byVendor: [...vendorCounts.entries()]
      .map(([slug, v]) => ({
        slug,
        name: v.name,
        clicks: v.clicks,
        uniqueVisitors: v.uniqueIps.size,
      }))
      .sort((a, b) => b.clicks - a.clicks),
    byArticle: [...articleCounts.entries()]
      .map(([article, clicks]) => ({ article, clicks }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 20),
    recent: events.slice(-20).reverse().map((e) => ({
      ts: e.ts,
      vendor: e.vendor,
      name: e.name,
      article: e.article,
    })),
  });
}
