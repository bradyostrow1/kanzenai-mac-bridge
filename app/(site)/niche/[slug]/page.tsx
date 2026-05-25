import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, ArrowUpRight } from "lucide-react";
import {
  nicheBySlug,
  listArticlesByNiche,
  listComparisonsByNiche,
  NICHES,
  type NicheSlug,
} from "@/lib/articles";

export function generateStaticParams() {
  return NICHES.map((n) => ({ slug: n.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const niche = nicheBySlug(params.slug);
  if (!niche) return { title: "Not found · KanzenAI" };
  return {
    title: `${niche.name} · KanzenAI`,
    description: niche.description,
  };
}

export default function NichePage({ params }: { params: { slug: string } }) {
  const niche = nicheBySlug(params.slug);
  if (!niche) notFound();
  const articles = listArticlesByNiche(niche.slug as NicheSlug);
  const comparisons = listComparisonsByNiche(niche.slug as NicheSlug);
  const featured = articles[0];
  const rest = articles.slice(1);

  return (
    <main>
      {/* HERO */}
      <section className="bg-bg-0">
        <div className="max-w-[1400px] mx-auto px-8 pt-4 pb-12">
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
            ニッチ · NICHE
          </div>
          <h1 className="display text-[56px] sm:text-[96px] leading-[0.92] text-ink-0 mt-2">
            {niche.name}
          </h1>
          <p className="mt-5 max-w-2xl text-ink-1 text-lg font-serif italic">
            {niche.tagline}.
          </p>
          <p className="mt-3 max-w-2xl text-ink-2 text-[15px] leading-relaxed">
            {niche.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-2">
            <span>{articles.length} reviews</span>
            {comparisons.length > 0 && (
              <>
                <span>·</span>
                <span>{comparisons.length} head-to-head comparisons</span>
              </>
            )}
          </div>
        </div>
      </section>

      {articles.length === 0 ? (
        <section className="max-w-[1400px] mx-auto px-8 py-20">
          <div className="text-ink-2 text-sm border border-dashed border-rule rounded p-12 text-center">
            New reviews publishing under {niche.name} soon. Check back tomorrow.
          </div>
        </section>
      ) : (
        <>
          {/* FEATURED */}
          {featured && (
            <section className="bg-bg-1">
              <div className="max-w-[1400px] mx-auto px-8 py-20">
                <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
                  Most recent in {niche.name}
                </div>
                <Link href={`/articles/${featured.slug}`} className="block mt-3 group">
                  <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-end">
                    <div className="max-w-5xl">
                      <h2 className="display text-[44px] sm:text-[72px] leading-[0.95] text-ink-0 group-hover:text-ink-1 transition-colors">
                        {featured.title}
                      </h2>
                      <p className="mt-5 text-xl text-ink-1 max-w-2xl leading-relaxed font-serif italic">
                        {featured.description}
                      </p>
                      <div className="mt-5 flex items-center gap-4 text-[13px] text-ink-2">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {featured.readMinutes} min read
                        </span>
                        <span>·</span>
                        <span>{featured.category}</span>
                        <span className="inline-flex items-center gap-1 text-ink-0 font-semibold">
                          Read review
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                    {featured.headerImage && (
                      <img
                        src={featured.headerImage}
                        alt=""
                        className="w-full h-[260px] lg:h-[380px] object-cover rounded-md grayscale-[0.15] group-hover:grayscale-0 transition-all"
                      />
                    )}
                  </div>
                </Link>
              </div>
            </section>
          )}

          {/* REST */}
          {rest.length > 0 && (
            <section className="max-w-[1400px] mx-auto px-8 py-20">
              <div className="flex items-end justify-between mb-10 border-b border-rule pb-4">
                <h2 className="display text-4xl text-ink-0">All {niche.name} reviews</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                {rest.map((a) => (
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
                    <h3 className="display text-2xl text-ink-0 group-hover:text-ink-1 leading-snug mt-2">
                      {a.title}
                    </h3>
                    <p className="mt-3 text-[14px] text-ink-1 line-clamp-3 leading-relaxed">
                      {a.description}
                    </p>
                    <div className="mt-3 text-[12px] text-ink-3 inline-flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {a.readMinutes} min ·{" "}
                      {new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* COMPARISONS */}
          {comparisons.length > 0 && (
            <section className="bg-bg-1">
              <div className="max-w-[1400px] mx-auto px-8 py-20">
                <div className="border-b border-rule pb-4 mb-10">
                  <h2 className="display text-4xl text-ink-0">Head-to-Head · {niche.name}</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  {comparisons.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/compare/${c.slug}`}
                      className="block bg-bg-0 border border-rule rounded-md p-7 hover:border-ink-0 transition-colors group"
                    >
                      <h3 className="display text-2xl text-ink-0 leading-snug">{c.title}</h3>
                      <p className="mt-3 text-[14px] text-ink-1 line-clamp-2">{c.description}</p>
                      <div className="mt-4 text-ink-0 text-[13px] font-semibold inline-flex items-center gap-1">
                        See the comparison <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Browse other niches */}
      <section className="border-t border-rule">
        <div className="max-w-[1400px] mx-auto px-8 py-16">
          <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold mb-4">
            他のニッチ · OTHER NICHES
          </div>
          <div className="flex flex-wrap gap-3">
            {NICHES.filter((n) => n.slug !== params.slug).map((n) => (
              <Link
                key={n.slug}
                href={`/niche/${n.slug}`}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-rule hover:border-ink-0 text-ink-0 text-[14px] font-semibold transition"
              >
                {n.name} <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
