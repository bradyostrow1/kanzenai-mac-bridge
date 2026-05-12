import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const dynamic = "force-static";
export const revalidate = 300; // refresh every 5 min when hit

const SITE_URL = "https://kanzenai.com";
const ARTICLES_DIR = join(process.cwd(), "content", "articles");
const COMPARISONS_DIR = join(process.cwd(), "content", "comparisons");

type Article = {
  slug: string;
  title: string;
  description?: string;
  publishedAt: string;
  category?: string;
  tldr?: string;
  headerImage?: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function loadDir(dir: string, prefix: string): Promise<Array<Article & { url: string }>> {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const items: Array<Article & { url: string }> = [];
  for (const f of files) {
    try {
      const json = JSON.parse(await readFile(join(dir, f), "utf8")) as Article;
      if (!json.slug || !json.title) continue;
      items.push({
        ...json,
        url: `${SITE_URL}${prefix}/${json.slug}`,
      });
    } catch {
      /* skip malformed */
    }
  }
  return items;
}

export async function GET() {
  const [articles, comparisons] = await Promise.all([
    loadDir(ARTICLES_DIR, "/articles"),
    loadDir(COMPARISONS_DIR, "/compare"),
  ]);

  const items = [...articles, ...comparisons]
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
    .slice(0, 50);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>KanzenAI — Real Estate Agent Tool Reviews</title>
    <link>${SITE_URL}</link>
    <description>Honest, pricing-first reviews of CRMs, AI tools, dialers, and software for working real estate agents.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items
  .map((item) => {
    const pubDate = item.publishedAt ? new Date(item.publishedAt).toUTCString() : new Date().toUTCString();
    const description = item.tldr ?? item.description ?? "";
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${item.url}</link>
      <guid isPermaLink="true">${item.url}</guid>
      <description>${escapeXml(description)}</description>
      <pubDate>${pubDate}</pubDate>
      ${item.category ? `<category>${escapeXml(item.category)}</category>` : ""}
      ${item.headerImage ? `<enclosure url="${SITE_URL}${item.headerImage}" type="image/jpeg"/>` : ""}
    </item>`;
  })
  .join("\n")}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
