import Link from "next/link";
import { Clock, ArrowUpRight } from "lucide-react";
import { listArticles } from "@/lib/articles";

export const metadata = {
  title: "All reviews · KanzenAI",
  description: "Every honest review we've published — AI software, productivity tools, automation platforms, and the SaaS solopreneurs and creators actually use.",
};

export default function ArticlesIndex() {
  const articles = listArticles();
  return (
    <main className="max-w-[1400px] mx-auto px-8 py-16">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
        全レビュー · The full review index
      </div>
      <h1 className="display text-[64px] sm:text-[96px] leading-[0.95] text-ink-0 mt-3">
        All reviews
      </h1>
      <p className="mt-5 max-w-2xl text-ink-1 text-lg font-serif italic">
        Every tool we've put through six weeks of real-world workflow. Sorted newest first.
      </p>

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

      {articles.length === 0 && (
        <div className="mt-10 text-ink-2 text-sm border border-dashed border-rule rounded p-12 text-center">
          New reviews publishing daily. Check back tomorrow.
        </div>
      )}
    </main>
  );
}
