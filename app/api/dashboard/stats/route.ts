import { NextResponse } from "next/server";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");
const PROD_URL = "https://kanzenai.com";

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

async function loadJsonDir(dir: string) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map(async (file) => {
      const text = await readFile(join(dir, file), "utf8");
      try {
        return { file, json: JSON.parse(text) };
      } catch {
        return null;
      }
    }),
  ).then((r) => r.filter((x): x is { file: string; json: any } => !!x));
}

function wordCount(json: any): number {
  let count = 0;
  const harvest = (s: any) => {
    if (typeof s === "string") count += s.trim().split(/\s+/).filter(Boolean).length;
    else if (Array.isArray(s)) s.forEach(harvest);
    else if (s && typeof s === "object") Object.values(s).forEach(harvest);
  };
  harvest(json);
  return count;
}

async function lastAuditRun(): Promise<{
  when: string | null;
  size: number;
  latest: string | null;
  errors: number;
  warnings: number;
}> {
  if (!existsSync(AUDIT_DIR)) return { when: null, size: 0, latest: null, errors: 0, warnings: 0 };
  const files = (await readdir(AUDIT_DIR))
    .filter((f) => f.startsWith("audit-") && f.endsWith(".log"))
    .sort()
    .reverse();
  if (files.length === 0) return { when: null, size: 0, latest: null, errors: 0, warnings: 0 };
  const latest = files[0];
  const fpath = join(AUDIT_DIR, latest);
  const stats = await stat(fpath);
  const text = await readFile(fpath, "utf8");
  // Match either "  Summary: X errors, Y warnings" or strip-ANSI then match
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, "");
  const m = stripped.match(/Summary:\s*(\d+)\s+errors?,\s*(\d+)\s+warnings?/i);
  return {
    when: stats.mtime.toISOString(),
    size: stats.size,
    latest,
    errors: m ? parseInt(m[1], 10) : 0,
    warnings: m ? parseInt(m[2], 10) : 0,
  };
}

async function healthStats(): Promise<{
  installed: boolean;
  totalChecks: number;
  uptime: number;
  avgMs: number;
  lastCheck: string | null;
  lastStatus: number | null;
}> {
  const path = join(AUDIT_DIR, "health.log");
  if (!existsSync(path)) {
    return { installed: false, totalChecks: 0, uptime: 100, avgMs: 0, lastCheck: null, lastStatus: null };
  }
  const text = await readFile(path, "utf8");
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) {
    return { installed: true, totalChecks: 0, uptime: 100, avgMs: 0, lastCheck: null, lastStatus: null };
  }
  let okCount = 0;
  let totalMs = 0;
  let msCount = 0;
  let lastStatus: number | null = null;
  let lastCheck: string | null = null;
  // Format: "2026-05-09T17:00:00Z 200 0.245s"
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    const ts = parts[0];
    const code = parseInt(parts[1], 10);
    const ms = parts[2] ? parseFloat(parts[2]) * 1000 : NaN;
    if (!isNaN(code)) {
      if (code >= 200 && code < 400) okCount++;
      lastStatus = code;
    }
    if (!isNaN(ms)) {
      totalMs += ms;
      msCount++;
    }
    lastCheck = ts;
  }
  return {
    installed: true,
    totalChecks: lines.length,
    uptime: Math.round((okCount / lines.length) * 1000) / 10,
    avgMs: msCount > 0 ? Math.round(totalMs / msCount) : 0,
    lastCheck,
    lastStatus,
  };
}

async function articleWriterStats(): Promise<{
  lastWritten: string | null;
  lastSlug: string | null;
  totalCount: number;
  writtenToday: number;
  writtenThisWeek: number;
  todaySlugs: string[];
}> {
  const articles = await loadJsonDir(ARTICLES_DIR);
  // Use LOCAL date, not UTC — otherwise evening hours on the East Coast roll the
  // "today" boundary forward and articles dated today look like yesterday's.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  let writtenToday = 0;
  let writtenThisWeek = 0;
  const todaySlugs: string[] = [];

  for (const { json } of articles) {
    const pub = typeof json.publishedAt === "string" ? json.publishedAt : null;
    if (pub === today) {
      writtenToday++;
      if (json.slug) todaySlugs.push(json.slug);
    }
    if (pub) {
      const t = Date.parse(pub);
      if (!isNaN(t) && t >= sevenDaysAgo) writtenThisWeek++;
    }
  }

  let latest: { slug: string; mtime: Date } | null = null;
  if (existsSync(ARTICLES_DIR)) {
    const files = (await readdir(ARTICLES_DIR)).filter((f) => f.endsWith(".json"));
    for (const f of files) {
      const s = await stat(join(ARTICLES_DIR, f));
      if (!latest || s.mtime > latest.mtime) {
        latest = { slug: f.replace(/\.json$/, ""), mtime: s.mtime };
      }
    }
  }
  return {
    lastWritten: latest?.mtime.toISOString() ?? null,
    lastSlug: latest?.slug ?? null,
    totalCount: articles.length,
    writtenToday,
    writtenThisWeek,
    todaySlugs,
  };
}

async function pingProduction(): Promise<{ ok: boolean; ms: number; status: number }> {
  const start = Date.now();
  try {
    const r = await fetch(PROD_URL, { method: "HEAD" });
    return { ok: r.ok, ms: Date.now() - start, status: r.status };
  } catch {
    return { ok: false, ms: Date.now() - start, status: 0 };
  }
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;

  const [articles, comparisons, audit, prod, health, writer] = await Promise.all([
    loadJsonDir(ARTICLES_DIR),
    loadJsonDir(COMPARISONS_DIR),
    lastAuditRun(),
    pingProduction(),
    healthStats(),
    articleWriterStats(),
  ]);

  const totalWords = articles.reduce((sum, a) => sum + wordCount(a.json), 0);
  const placeholderLinks = [...articles, ...comparisons].reduce((sum, a) => {
    const matches = JSON.stringify(a.json).match(/\?ref=kanzenai/g);
    return sum + (matches?.length ?? 0);
  }, 0);

  // Enumerate placeholder vendors from lib/affiliates.ts for the issues detail view
  const placeholderVendors: Array<{ slug: string; name: string; commission: string }> = [];
  try {
    const affiliatesPath = join(ROOT, "lib", "affiliates.ts");
    if (existsSync(affiliatesPath)) {
      const src = await readFile(affiliatesPath, "utf8");
      const entryRe = /"([\w-]+)":\s*\{\s*url:\s*"[^"]+",\s*name:\s*"([^"]+)",\s*status:\s*"placeholder",\s*commission:\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = entryRe.exec(src)) !== null) {
        placeholderVendors.push({ slug: m[1], name: m[2], commission: m[3] });
      }
    }
  } catch { /* fail soft */ }

  // Category breakdown
  const categoryBreakdown: Record<string, number> = {};
  for (const a of articles) {
    const c = (a.json.category ?? "Uncategorized") as string;
    categoryBreakdown[c] = (categoryBreakdown[c] ?? 0) + 1;
  }

  const articleSummaries = articles
    .map((a) => ({
      slug: a.json.slug,
      title: a.json.title,
      category: a.json.category,
      publishedAt: a.json.publishedAt,
      readMinutes: a.json.readMinutes,
      headerImage: a.json.headerImage,
    }))
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""));

  const comparisonSummaries = comparisons.map((c) => ({
    slug: c.json.slug,
    title: c.json.title,
    publishedAt: c.json.publishedAt,
  }));

  return NextResponse.json({
    articles: {
      count: articles.length,
      totalWords,
      list: articleSummaries,
      categoryBreakdown,
    },
    comparisons: {
      count: comparisons.length,
      list: comparisonSummaries,
    },
    affiliate: {
      placeholderLinks,
      placeholderVendors,
    },
    audit,
    health,
    writer,
    production: {
      url: PROD_URL,
      ...prod,
    },
  });
}
