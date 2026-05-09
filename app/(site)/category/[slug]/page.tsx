import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { listArticles } from "@/lib/articles";

const CATEGORY_MAP: Record<string, { label: string; tagline: string; jp: string }> = {
  crm: {
    label: "CRM",
    tagline: "Don't lose the lead. The systems we trust to route, drip, and convert without babysitting.",
    jp: "顧客管理 · CRM",
  },
  "lead-gen": {
    label: "Lead Gen",
    tagline: "Cost-per-closed-deal — not cost-per-inquiry. The lead sources that actually pay back.",
    jp: "見込み客 · Lead generation",
  },
  "ai-tools": {
    label: "AI Tools",
    tagline: "The AI stack working agents actually use day-to-day — comps, drafts, transcripts, prep.",
    jp: "人工知能 · AI tools",
  },
  scheduling: { label: "Scheduling", tagline: "Showing logistics, calendar systems, and route planning.", jp: "予定管理 · Scheduling" },
  "phone-calls": { label: "Phone & Calls", tagline: "Dialers, ISA platforms, and call tracking.", jp: "電話 · Phone & calls" },
  invoicing: { label: "Invoicing", tagline: "Closing-day docs, commissions, and bookkeeping.", jp: "請求 · Invoicing" },
  marketing: { label: "Marketing", tagline: "Brand, social, and listing-launch playbooks.", jp: "マーケティング · Marketing" },
  inventory: { label: "Inventory", tagline: "Listing inventory, stock, and supply tooling.", jp: "在庫 · Inventory" },
};

export function generateStaticParams() {
  return Object.keys(CATEGORY_MAP).map((slug) => ({ slug }));
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const meta = CATEGORY_MAP[params.slug];
  if (!meta) notFound();

  const articles = listArticles().filter(
    (a) => a.category.toLowerCase().replace(/\s+&\s+/g, "-").replace(/\s+/g, "-") === params.slug,
  );

  return (
    <main className="max-w-[1400px] mx-auto px-8 py-16">
      <Link href="/" className="text-[13px] text-ink-2 hover:text-ink-0">← Home</Link>

      <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
        {meta.jp}
      </div>
      <h1 className="display text-[64px] sm:text-[96px] leading-[0.95] text-ink-0 mt-3">
        {meta.label}
      </h1>
      <p className="mt-5 max-w-2xl text-ink-1 text-lg font-serif italic">{meta.tagline}</p>

      {articles.length === 0 ? (
        <div className="mt-14 text-ink-2 text-sm border border-dashed border-rule rounded p-12 text-center">
          No reviews in this category yet — bots are drafting now. Check back this week.
        </div>
      ) : (
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {articles.map((a) => (
            <Link key={a.slug} href={`/articles/${a.slug}`} className="group block">
              {a.headerImage && (
                <div className="aspect-[16/10] mb-4 overflow-hidden rounded-md bg-bg-2">
                  <img
                    src={a.headerImage}
                    alt=""
                    className="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 group-hover:scale-[1.02] transition-all duration-500"
                  />
                </div>
              )}
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
                {a.category}
              </div>
              <h2 className="display text-2xl text-ink-0 group-hover:text-ink-1 leading-snug mt-2">
                {a.title}
              </h2>
              <p className="mt-3 text-[14px] text-ink-1 line-clamp-3 leading-relaxed">
                {a.description}
              </p>
              <div className="mt-3 text-[12px] text-ink-3 inline-flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                {a.readMinutes} min · {new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
