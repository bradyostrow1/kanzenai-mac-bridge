import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { listComparisons } from "@/lib/articles";

export const metadata = {
  title: "Head-to-head comparisons · KanzenAI",
  description: "When you've narrowed it down to two tools — see which one actually wins for working real estate agents.",
};

export default function CompareIndex() {
  const comparisons = listComparisons();
  return (
    <main className="max-w-[1400px] mx-auto px-8 py-16">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
        対決 · Head-to-head
      </div>
      <h1 className="display text-[64px] sm:text-[96px] leading-[0.95] text-ink-0 mt-3">
        Compare
      </h1>
      <p className="mt-5 max-w-2xl text-ink-1 text-lg font-serif italic">
        Two tools. One workflow. We ran both, and one of them wins. Here's our honest verdict on each.
      </p>

      <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-8">
        {comparisons.map((c) => (
          <Link
            key={c.slug}
            href={`/compare/${c.slug}`}
            className="block bg-bg-1 border border-rule rounded-md overflow-hidden hover:border-ink-0 transition-colors group"
          >
            {c.headerImage && (
              <div className="aspect-[16/9] overflow-hidden bg-bg-2">
                <img
                  src={c.headerImage}
                  alt=""
                  className="w-full h-full object-cover grayscale-[0.15] group-hover:grayscale-0 group-hover:scale-[1.02] transition-all duration-500"
                />
              </div>
            )}
            <div className="p-7">
              <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
                {c.contenders.map((x) => x.name).join(" vs ")}
              </div>
              <h2 className="display text-2xl text-ink-0 leading-snug mt-2">{c.title}</h2>
              <p className="mt-3 text-[14px] text-ink-1 line-clamp-2">{c.description}</p>
              <div className="mt-4 text-ink-0 text-[13px] font-semibold inline-flex items-center gap-1">
                See the comparison <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {comparisons.length === 0 && (
        <div className="mt-10 text-ink-2 text-sm border border-dashed border-rule rounded p-12 text-center">
          New head-to-head comparisons publishing weekly.
        </div>
      )}
    </main>
  );
}
