import Link from "next/link";
import { Clock, ArrowUpRight } from "lucide-react";
import type { Article, Comparison } from "@/lib/articles";

export function RelatedArticles({
  articles,
  heading = "Keep reading",
  subheading,
}: {
  articles: Article[];
  heading?: string;
  subheading?: string;
}) {
  if (articles.length === 0) return null;

  return (
    <section className="mt-16 pt-10 border-t border-rule">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
            {heading}
          </div>
          {subheading && <div className="mt-1 text-[14px] text-ink-1">{subheading}</div>}
        </div>
        <Link
          href="/articles"
          className="text-[13px] text-ink-0 hover:opacity-60 inline-flex items-center gap-1"
        >
          All reviews <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {articles.map((a) => (
          <Link
            key={a.slug}
            href={`/articles/${a.slug}`}
            className="group block"
          >
            {a.headerImage && (
              <div className="aspect-[16/10] mb-3 overflow-hidden rounded-md bg-bg-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
            <h3 className="display text-xl text-ink-0 group-hover:text-ink-1 leading-snug mt-1.5">
              {a.title}
            </h3>
            <div className="mt-2 text-[11px] text-ink-3 inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3" />
              {a.readMinutes} min · {new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function RelatedComparisons({
  comparisons,
  heading = "Other head-to-heads",
}: {
  comparisons: Comparison[];
  heading?: string;
}) {
  if (comparisons.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-rule">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold mb-5">
        {heading}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {comparisons.map((c) => (
          <Link
            key={c.slug}
            href={`/compare/${c.slug}`}
            className="block bg-bg-1 border border-rule rounded-md p-5 hover:border-ink-0 transition-colors group"
          >
            <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
              {c.contenders.map((x) => x.name).join(" vs ")}
            </div>
            <h3 className="display text-lg text-ink-0 leading-snug mt-1.5">{c.title}</h3>
            <div className="mt-3 text-[12px] text-ink-0 font-semibold inline-flex items-center gap-1">
              See the comparison <ArrowUpRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
