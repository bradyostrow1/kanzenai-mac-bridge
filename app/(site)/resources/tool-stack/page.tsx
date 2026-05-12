import Link from "next/link";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

export const metadata = {
  title: "The 2026 Real Estate Tool Stack — KanzenAI",
  description: "One-page pricing breakdown of every CRM, dialer, AI tool, lead-gen platform, and software agents actually use in 2026.",
  robots: { index: false, follow: false }, // gated content — not for SEO indexing
};

type Article = {
  slug: string;
  title: string;
  category?: string;
  publishedAt?: string;
  body?: Array<{ type: string; name?: string; price?: string; cta?: { url?: string } }>;
};

async function loadArticles(): Promise<Article[]> {
  const dir = join(process.cwd(), "content", "articles");
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const out: Article[] = [];
  for (const f of files) {
    try { out.push(JSON.parse(await readFile(join(dir, f), "utf8"))); } catch {}
  }
  return out;
}

type ToolRow = { name: string; price: string; vendorUrl?: string; articleSlug: string; articleTitle: string };

function extractTools(articles: Article[]): Map<string, ToolRow[]> {
  const byCategory = new Map<string, ToolRow[]>();
  for (const a of articles) {
    const cat = a.category ?? "Other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    for (const block of a.body ?? []) {
      if (block.type !== "product" || !block.name || !block.price) continue;
      byCategory.get(cat)!.push({
        name: block.name,
        price: block.price,
        vendorUrl: block.cta?.url,
        articleSlug: a.slug,
        articleTitle: a.title,
      });
    }
  }
  // Dedupe by tool name within each category, keep first occurrence
  for (const [cat, rows] of byCategory) {
    const seen = new Set<string>();
    byCategory.set(cat, rows.filter((r) => {
      const key = r.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }));
  }
  return byCategory;
}

export default async function ToolStackPage() {
  const articles = await loadArticles();
  const byCategory = extractTools(articles);
  // Order categories logically
  const categoryOrder = [
    "CRM",
    "Lead Gen",
    "AI Tools",
    "Phone & Calls",
    "Marketing",
    "Scheduling",
    "Invoicing",
    "Inventory",
    "Other",
  ];
  const orderedCats = categoryOrder.filter((c) => byCategory.has(c));
  const today = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-bg-0 text-ink-0">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="border-b border-rule pb-8 mb-10">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 mb-3">
            KANZENAI · MEMBERS RESOURCE
          </div>
          <h1 className="display text-4xl sm:text-5xl leading-tight mb-3">The 2026 Real Estate Tool Stack</h1>
          <p className="text-ink-2 text-[16px] leading-relaxed max-w-2xl">
            Every CRM, dialer, AI assistant, and lead-gen platform working agents are actually using — with the pricing vendors hide behind "Contact Sales." Updated {today}.
          </p>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-12">
          <Stat label="Tools tracked" value={[...byCategory.values()].reduce((s, r) => s + r.length, 0).toString()} />
          <Stat label="Categories" value={orderedCats.length.toString()} />
          <Stat label="Articles" value={articles.length.toString()} />
        </div>

        {/* By-category tables */}
        {orderedCats.map((cat) => {
          const rows = byCategory.get(cat) ?? [];
          return (
            <section key={cat} className="mb-14">
              <h2 className="display text-2xl mb-1">{cat}</h2>
              <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3 mb-4">
                {rows.length} tool{rows.length === 1 ? "" : "s"}
              </div>
              <div className="border border-rule overflow-hidden">
                <table className="w-full text-[14px]">
                  <thead className="bg-bg-1 border-b border-rule">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-semibold w-1/4">Tool</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Pricing</th>
                      <th className="text-right px-4 py-2.5 font-semibold w-32">Review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rule">
                    {rows.map((r, i) => (
                      <tr key={i} className="hover:bg-bg-1 transition">
                        <td className="px-4 py-3 align-top">
                          {r.vendorUrl ? (
                            <a href={r.vendorUrl} target="_blank" rel="noopener sponsored" className="font-semibold hover:text-warm transition">
                              {r.name} <span className="text-ink-3">↗</span>
                            </a>
                          ) : (
                            <span className="font-semibold">{r.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-ink-2">{r.price}</td>
                        <td className="px-4 py-3 align-top text-right">
                          <Link href={`/articles/${r.articleSlug}`} className="text-[12px] underline text-ink-2 hover:text-ink-0">
                            full review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {/* Footer */}
        <div className="border-t border-rule pt-8 mt-12">
          <h3 className="display text-xl mb-2">A note on affiliate links</h3>
          <p className="text-ink-2 text-[14px] leading-relaxed mb-6">
            When you click through to a tool from this page, I may earn a commission if you sign up. It doesn't change the review or the pricing you see. Every tool here was researched against the vendor's published materials — no fabricated tests, no paid placement.
          </p>
          <p className="text-ink-3 text-[12px]">— Brady · KanzenAI</p>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-rule bg-bg-1 px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-1">{label}</div>
      <div className="display text-3xl leading-none">{value}</div>
    </div>
  );
}
