import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink } from "lucide-react";
import { getArticle, listArticles, relatedArticles, type Article, type ArticleBlock } from "@/lib/articles";
import { articleSchema, breadcrumbSchema, jsonLdScript } from "@/lib/jsonld";
import { RelatedArticles } from "@/components/RelatedArticles";

export function generateStaticParams() {
  return listArticles().map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const article = getArticle(params.slug);
  if (!article) return {};
  return {
    title: `${article.title} · KanzenAI`,
    description: article.description,
    alternates: { canonical: `https://kanzenai.com/articles/${article.slug}` },
    openGraph: {
      type: "article",
      url: `https://kanzenai.com/articles/${article.slug}`,
      title: article.title,
      description: article.description,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      images: article.headerImage ? [`https://kanzenai.com${article.headerImage}`] : [],
    },
  };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const article = getArticle(params.slug);
  if (!article) notFound();
  const articleLd = articleSchema(article);
  const breadcrumbLd = breadcrumbSchema([
    { name: "Home", url: "https://kanzenai.com/" },
    { name: "Reviews", url: "https://kanzenai.com/articles" },
    { name: article.title, url: `https://kanzenai.com/articles/${article.slug}` },
  ]);
  return (
    <main className="max-w-3xl mx-auto px-5 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(articleLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbLd) }}
      />
      <Link href="/" className="inline-flex items-center gap-1.5 text-ink-2 hover:text-ink-0 text-[13px]">
        <ArrowLeft className="w-3.5 h-3.5" />
        All reviews
      </Link>

      <div className="mt-6 text-[12px] uppercase tracking-[0.14em] text-accent font-bold">
        {article.category}
      </div>
      <h1 className="mt-2 text-4xl sm:text-5xl font-bold leading-tight tracking-tight">
        {article.title}
      </h1>
      <p className="mt-4 text-lg text-ink-1 leading-relaxed">{article.description}</p>

      <div className="mt-5 flex items-center gap-4 text-[13px] text-ink-2 border-b border-bg-2 pb-5">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {article.readMinutes} min read
        </span>
        <span>·</span>
        <span>Published {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
        {article.updatedAt && article.updatedAt !== article.publishedAt && (
          <>
            <span>·</span>
            <span>Updated {new Date(article.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</span>
          </>
        )}
      </div>

      {/* Hero image */}
      {article.headerImage && (
        <figure className="mt-8 -mx-5 sm:mx-0">
          <img
            src={article.headerImage}
            alt=""
            className="w-full h-[320px] sm:h-[460px] object-cover sm:rounded-md"
          />
          {article.imageCredit && (
            <figcaption className="mt-2 px-5 sm:px-0 text-[11px] uppercase tracking-[0.18em] text-ink-3">
              Photo · {article.imageCredit}
            </figcaption>
          )}
        </figure>
      )}

      {/* TL;DR */}
      <div className="mt-8 bg-bg-1 border-l-4 border-accent rounded-r-lg p-5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-accent font-bold">TL;DR</div>
        <p className="mt-2 text-ink-0 leading-relaxed">{article.tldr}</p>
      </div>

      {/* Body */}
      <article className="mt-10 prose prose-lg max-w-none prose-headings:tracking-tight prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-p:text-ink-0 prose-p:leading-relaxed prose-li:text-ink-0 prose-strong:text-ink-0">
        {article.body.map((block, i) => renderBlock(block, i))}
      </article>

      {/* Related articles */}
      <RelatedArticles
        articles={relatedArticles(article, 3)}
        heading="Keep reading"
        subheading={`More ${article.category.toLowerCase()} reviews and tools we've tested.`}
      />

      {/* Affiliate disclosure footer */}
      <div className="mt-12 text-[12px] text-ink-2 border-t border-bg-2 pt-5 leading-relaxed">
        <strong className="text-ink-0">Affiliate disclosure:</strong> Some links above are
        affiliate links. If you sign up through them, we earn a commission at no extra cost to
        you. We only recommend tools we'd use ourselves.
      </div>
    </main>
  );
}

function renderBlock(block: ArticleBlock, i: number) {
  switch (block.type) {
    case "h2":
      return <h2 key={i} id={block.id}>{block.text}</h2>;
    case "h3":
      return <h3 key={i} id={block.id}>{block.text}</h3>;
    case "p":
      return <p key={i}>{block.text}</p>;
    case "ul":
      return <ul key={i}>{block.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
    case "ol":
      return <ol key={i}>{block.items.map((it, j) => <li key={j}>{it}</li>)}</ol>;
    case "quote":
      return (
        <blockquote key={i}>
          {block.text}
          {block.cite && <cite className="block text-ink-2 not-italic mt-2">— {block.cite}</cite>}
        </blockquote>
      );
    case "callout":
      return (
        <div key={i} className={`my-6 p-4 rounded-lg border-l-4 ${
          block.variant === "tip" ? "bg-emerald-50 border-emerald-500" :
          block.variant === "warn" ? "bg-amber-50 border-amber-500" :
          "bg-blue-50 border-blue-500"
        }`}>
          {block.title && <div className="font-bold text-ink-0">{block.title}</div>}
          <div className="text-ink-1">{block.text}</div>
        </div>
      );
    case "cta":
      return (
        <div key={i} className="my-6">
          <a href={block.url} target="_blank" rel="noopener sponsored" className="cta-link">
            {block.label}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      );
    case "product":
      return (
        <div key={i} className="my-8 border border-bg-2 rounded-xl p-6 not-prose">
          <div className="flex items-start justify-between gap-4">
            <div>
              {typeof block.rating === "number" && block.rating > 0 && (
                <div className="text-[11px] uppercase tracking-[0.14em] text-warm font-bold">
                  {"★".repeat(Math.round(block.rating))}{"☆".repeat(5 - Math.round(block.rating))} {block.rating.toFixed(1)}/5
                </div>
              )}
              <h3 className="text-xl font-bold mt-1">{block.name}</h3>
              <div className="text-ink-2 text-[14px] mt-1">{block.price}</div>
            </div>
            <a href={block.cta.url} target="_blank" rel="noopener sponsored" className="cta-link whitespace-nowrap">
              {block.cta.label}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <div className="mt-4 grid sm:grid-cols-2 gap-4">
            <div>
              <div className="text-[12px] uppercase tracking-[0.14em] text-emerald-700 font-bold">Pros</div>
              <ul className="mt-2 space-y-1">
                {block.pros.map((p, j) => (
                  <li key={j} className="text-[14px] text-ink-1 flex items-start gap-2">
                    <span className="text-emerald-600 font-bold">+</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[12px] uppercase tracking-[0.14em] text-amber-700 font-bold">Cons</div>
              <ul className="mt-2 space-y-1">
                {block.cons.map((c, j) => (
                  <li key={j} className="text-[14px] text-ink-1 flex items-start gap-2">
                    <span className="text-amber-600 font-bold">−</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
  }
}
