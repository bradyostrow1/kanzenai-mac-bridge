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

async function lastAuditRun(): Promise<{ when: string | null; size: number; latest: string | null }> {
  if (!existsSync(AUDIT_DIR)) return { when: null, size: 0, latest: null };
  const files = (await readdir(AUDIT_DIR))
    .filter((f) => f.startsWith("audit-") && f.endsWith(".log"))
    .sort()
    .reverse();
  if (files.length === 0) return { when: null, size: 0, latest: null };
  const latest = files[0];
  const stats = await stat(join(AUDIT_DIR, latest));
  return { when: stats.mtime.toISOString(), size: stats.size, latest };
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

  const [articles, comparisons, audit, prod] = await Promise.all([
    loadJsonDir(ARTICLES_DIR),
    loadJsonDir(COMPARISONS_DIR),
    lastAuditRun(),
    pingProduction(),
  ]);

  const totalWords = articles.reduce((sum, a) => sum + wordCount(a.json), 0);
  const placeholderLinks = [...articles, ...comparisons].reduce((sum, a) => {
    const matches = JSON.stringify(a.json).match(/\?ref=kanzenai/g);
    return sum + (matches?.length ?? 0);
  }, 0);

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
    },
    comparisons: {
      count: comparisons.length,
      list: comparisonSummaries,
    },
    affiliate: {
      placeholderLinks,
    },
    audit,
    production: {
      url: PROD_URL,
      ...prod,
    },
  });
}
