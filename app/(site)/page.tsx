import Link from "next/link";
import { ArrowRight, Clock, ArrowUpRight } from "lucide-react";
import { listArticles, listComparisons } from "@/lib/articles";
import { EmailSignup } from "@/components/EmailSignup";
import { ORG_SCHEMA, articleListSchema, jsonLdScript } from "@/lib/jsonld";

export default function Home() {
  const articles = listArticles();
  const comparisons = listComparisons();
  const featured = articles[0];
  const rest = articles.slice(1, 7);

  return (
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ORG_SCHEMA) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleListSchema(articles)) }} />
      {/* HERO */}
      <section className="bg-bg-0">
        <div className="max-w-[1400px] mx-auto px-8 pt-4 pb-12">
          <h1 className="display text-[88px] sm:text-[140px] leading-[0.92] text-ink-0">
            The Complete<br />Real Estate Brief
          </h1>

          {/* Hero video block with overlay copy */}
          <div className="relative mt-10 rounded-md overflow-hidden bg-ink-0">
            <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-[60vh] min-h-[440px] object-cover"
            >
              <source src="/backdrop.mp4" type="video/mp4" />
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

            {/* Bottom-left overlay copy */}
            <div className="absolute bottom-8 left-8 right-8 sm:left-12 sm:bottom-12 max-w-2xl">
              <div className="text-[11px] uppercase tracking-[0.22em] text-bg-0/90 font-semibold">
                完全 · KANZENAI · For working real estate agents
              </div>
              <p className="mt-3 text-bg-0 text-xl sm:text-2xl font-serif leading-snug">
                Honest reviews of CRMs, AI assistants, and lead-gen tools — tested by us, written for agents who close deals.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/articles" className="cta-link">
                  Read the reviews <ArrowRight className="w-4 h-4" />
                </Link>
                <Link href="/compare" className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-bg-0/30 text-bg-0 text-[14px] font-semibold hover:bg-bg-0/10 transition">
                  Head-to-head
                </Link>
              </div>
            </div>
          </div>

          {/* Quick stats strip */}
          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink-1">
            <span>{articles.length} reviews</span>
            <span>·</span>
            <span>{comparisons.length} head-to-head comparisons</span>
            <span>·</span>
            <span>Updated weekly</span>
            <span>·</span>
            <span>Vendor-neutral</span>
          </div>
        </div>
      </section>

      {/* FEATURED */}
      {featured && (
        <section className="bg-bg-1">
          <div className="max-w-[1400px] mx-auto px-8 py-20">
            <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
              Most read this week
            </div>
            <Link href={`/articles/${featured.slug}`} className="block mt-3 group">
              <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-end">
                <div className="max-w-5xl">
                  <h2 className="display text-[56px] sm:text-[84px] leading-[0.95] text-ink-0 group-hover:text-ink-1 transition-colors">
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
                    className="w-full h-[280px] lg:h-[420px] object-cover rounded-md grayscale-[0.15] group-hover:grayscale-0 transition-all"
                  />
                )}
              </div>
            </Link>
          </div>
        </section>
      )}

      {/* LATEST */}
      <section className="max-w-[1400px] mx-auto px-8 py-20">
        <div className="flex items-end justify-between mb-10 border-b border-rule pb-4">
          <h2 className="display text-4xl text-ink-0">Latest reviews</h2>
          <Link href="/articles" className="text-[14px] text-ink-0 font-semibold hover:opacity-60 inline-flex items-center gap-1">
            All reviews <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {rest.length === 0 ? (
          <div className="text-ink-2 text-sm border border-dashed border-rule rounded p-12 text-center">
            New articles publishing daily — bots draft 3/day on a fresh keyword cluster.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
            {rest.map((a) => (
              <Link
                key={a.slug}
                href={`/articles/${a.slug}`}
                className="group block"
              >
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
                  {a.readMinutes} min · {new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* COMPARISONS */}
      {comparisons.length > 0 && (
        <section className="bg-bg-1">
          <div className="max-w-[1400px] mx-auto px-8 py-20">
            <div className="border-b border-rule pb-4 mb-10">
              <h2 className="display text-4xl text-ink-0">Head-to-Head</h2>
              <p className="text-ink-2 mt-2 text-[15px]">When you've narrowed it to two — see who actually wins.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              {comparisons.slice(0, 4).map((c) => (
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

      {/* NEWSLETTER */}
      <section className="bg-bg-1 border-y border-rule">
        <div className="max-w-[1400px] mx-auto px-8 py-24">
          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
                毎週日曜 · Every Sunday
              </div>
              <h2 className="display text-[44px] sm:text-[64px] leading-[0.95] text-ink-0 mt-3">
                One review.<br />Every Sunday.<br />Nothing else.
              </h2>
              <p className="mt-5 text-ink-1 text-lg font-serif italic max-w-xl">
                We send a single, deeply-tested review to your inbox every Sunday morning. No promo blasts. No funnel sequences. Unsubscribe with one click.
              </p>
            </div>
            <div className="lg:justify-self-end w-full max-w-xl">
              <EmailSignup source="homepage-footer" />
              <p className="mt-4 text-[12px] text-ink-3 leading-relaxed">
                Free forever. We never sell or share your email. Read our{" "}
                <Link href="/privacy" className="underline hover:text-ink-0">privacy policy</Link>.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section className="max-w-[1400px] mx-auto px-8 py-32 text-center">
        <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
          編集独立 · Editorial independence
        </div>
        <h2 className="display text-5xl sm:text-7xl text-ink-0 mt-4 max-w-4xl mx-auto">
          No paid placements. No fluff.
        </h2>
        <p className="mt-6 text-ink-1 max-w-2xl mx-auto leading-relaxed font-serif italic text-xl">
          We earn commission only when you sign up through our links — and we don't take vendor money to bump scores. Same review process whether the affiliate pays $20 or $300.
        </p>
        <Link
          href="/disclosure"
          className="mt-6 inline-flex items-center gap-1 text-ink-0 font-semibold hover:opacity-60 text-[14px]"
        >
          Read our full disclosure <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </section>
    </main>
  );
}
