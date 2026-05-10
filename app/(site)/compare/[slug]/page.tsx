import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getComparison, listComparisons } from "@/lib/articles";
import { comparisonSchema, breadcrumbSchema, jsonLdScript } from "@/lib/jsonld";

export function generateStaticParams() {
  return listComparisons().map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const c = getComparison(params.slug);
  if (!c) return {};
  return {
    title: `${c.title} · KanzenAI`,
    description: c.description,
    alternates: { canonical: `https://kanzenai.com/compare/${c.slug}` },
    openGraph: {
      type: "article",
      url: `https://kanzenai.com/compare/${c.slug}`,
      title: c.title,
      description: c.description,
      publishedTime: c.publishedAt,
      modifiedTime: c.updatedAt,
      images: c.headerImage ? [`https://kanzenai.com${c.headerImage}`] : [],
    },
  };
}

export default function ComparePage({ params }: { params: { slug: string } }) {
  const c = getComparison(params.slug);
  if (!c) notFound();
  const a = c.contenders[0];
  const b = c.contenders[1];
  const cmpLd = comparisonSchema(c);
  const breadcrumbLd = breadcrumbSchema([
    { name: "Home", url: "https://kanzenai.com/" },
    { name: "Compare", url: "https://kanzenai.com/compare" },
    { name: c.title, url: `https://kanzenai.com/compare/${c.slug}` },
  ]);

  return (
    <main className="max-w-4xl mx-auto px-5 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(cmpLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }} />
      <Link href="/" className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink-0 text-[13px]">
        <ArrowLeft className="w-3.5 h-3.5" />
        All comparisons
      </Link>

      <div className="mt-6 text-[12px] uppercase tracking-[0.14em] text-accent font-bold">
        Head-to-Head
      </div>
      <h1 className="mt-2 text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
        {c.title}
      </h1>
      <p className="mt-4 text-lg text-ink-1 leading-relaxed">{c.description}</p>

      {c.headerImage && (
        <img
          src={c.headerImage}
          alt=""
          className="mt-8 w-full h-[280px] sm:h-[400px] object-cover rounded-md"
        />
      )}

      <p className="mt-8 text-ink-0 leading-relaxed text-lg">{c.intro}</p>

      {/* Side-by-side cards */}
      <div className="mt-10 grid sm:grid-cols-2 gap-5">
        {[a, b].map((x, i) => (
          <div key={x.name} className="border border-bg-2 rounded-xl p-6 bg-white">
            <div className="text-[11px] uppercase tracking-[0.14em] text-warm font-bold">
              {"★".repeat(Math.round(x.rating))}{"☆".repeat(5 - Math.round(x.rating))} {x.rating.toFixed(1)}/5
            </div>
            <h2 className="text-2xl font-bold mt-1">{x.name}</h2>
            <div className="mt-1 text-ink-2 text-[14px]">From {x.startingPrice}</div>
            <div className="mt-3 text-[13px] text-ink-1"><strong className="text-ink-0">Best for:</strong> {x.bestFor}</div>
            <div className="mt-5">
              <a href={x.affiliateUrl} target="_blank" rel="noopener sponsored" className="cta-link w-full justify-center">
                Try {x.name} free
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="mt-5">
              <div className="text-[12px] uppercase tracking-[0.14em] text-emerald-700 font-bold">Pros</div>
              <ul className="mt-2 space-y-1">
                {x.pros.map((p, j) => (
                  <li key={j} className="text-[14px] text-ink-1 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold mt-0.5">+</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4">
              <div className="text-[12px] uppercase tracking-[0.14em] text-amber-700 font-bold">Cons</div>
              <ul className="mt-2 space-y-1">
                {x.cons.map((p, j) => (
                  <li key={j} className="text-[14px] text-ink-1 flex items-start gap-2">
                    <span className="text-amber-600 font-bold mt-0.5">−</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Verdict */}
      <div className="mt-10 bg-bg-1 border-l-4 border-accent rounded-r-lg p-6">
        <div className="text-[11px] uppercase tracking-[0.14em] text-accent font-bold">
          Our verdict
        </div>
        <p className="mt-2 text-lg text-ink-0 leading-relaxed">{c.verdict}</p>
      </div>

      {/* Affiliate disclosure */}
      <div className="mt-12 text-[12px] text-ink-2 border-t border-bg-2 pt-5 leading-relaxed">
        <strong className="text-ink-0">Affiliate disclosure:</strong> Both links above are
        affiliate links. If you sign up through them, we earn a small commission at no extra
        cost to you. Our scoring is the same regardless of commission size.
      </div>
    </main>
  );
}
