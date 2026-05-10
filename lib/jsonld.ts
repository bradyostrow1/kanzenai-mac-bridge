/**
 * JSON-LD structured data builders. Output goes into <script type="application/ld+json">
 * tags so Google can understand each page's type and surface rich results.
 *
 * What we emit:
 *   - Organization (homepage + everywhere via root layout)
 *   - Article (every /articles/[slug])
 *   - Product schemas — one per reviewed product, embedded in Article
 *   - ItemList — for the "all reviews" index
 *   - ComparisonPage / Article — for /compare/[slug] with two Product entries
 *   - BreadcrumbList — for navigational hierarchy
 */
import type { Article, Comparison, ArticleBlock } from "./articles";

const SITE = "https://kanzenai.com";

export const ORG_SCHEMA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "KanzenAI",
  url: SITE,
  logo: `${SITE}/articles/crm-hero.jpg`,
  description: "Independent affiliate review site for working real estate agents — CRMs, AI assistants, lead-gen, and transaction tools.",
  email: "hello@kanzenai.com",
  sameAs: [],
} as const;

const PUBLISHER = {
  "@type": "Organization",
  name: "KanzenAI",
  url: SITE,
  logo: { "@type": "ImageObject", url: `${SITE}/articles/crm-hero.jpg` },
};

export function articleSchema(article: Article) {
  const url = `${SITE}/articles/${article.slug}`;
  const products = extractProductsFromBody(article.body).concat(
    (article.affiliateProducts ?? []).map((p) => ({
      name: p.name,
      url: p.url,
      price: undefined as string | undefined,
      rating: undefined as number | undefined,
    })),
  );
  // Dedupe by name
  const seen = new Set<string>();
  const uniqueProducts = products.filter((p) => {
    const k = p.name.toLowerCase().trim();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt ?? article.publishedAt,
    author: {
      "@type": "Organization",
      name: "KanzenAI Editorial",
      url: SITE,
    },
    publisher: PUBLISHER,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: article.headerImage ? `${SITE}${article.headerImage}` : undefined,
    articleSection: article.category,
    wordCount: article.body
      ? wordCountOfBody(article.body)
      : undefined,
    about: uniqueProducts.length > 0 ? uniqueProducts.map((p) => buildProduct(p)) : undefined,
  };
}

export function comparisonSchema(c: Comparison) {
  const url = `${SITE}/compare/${c.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    description: c.description,
    datePublished: c.publishedAt,
    dateModified: c.updatedAt ?? c.publishedAt,
    author: { "@type": "Organization", name: "KanzenAI Editorial", url: SITE },
    publisher: PUBLISHER,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    image: c.headerImage ? `${SITE}${c.headerImage}` : undefined,
    about: c.contenders.map((x) =>
      buildProduct({
        name: x.name,
        url: x.affiliateUrl,
        price: x.startingPrice,
        rating: x.rating,
      }),
    ),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function articleListSchema(articles: Article[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.slice(0, 30).map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE}/articles/${a.slug}`,
      name: a.title,
    })),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
type ProductData = {
  name: string;
  url?: string;
  price?: string;
  rating?: number;
};

function buildProduct(p: ProductData) {
  const out: any = {
    "@type": "Product",
    name: p.name,
  };
  if (p.url) out.url = p.url;
  if (p.price) {
    out.offers = {
      "@type": "Offer",
      price: extractNumericPrice(p.price),
      priceCurrency: "USD",
      url: p.url,
      availability: "https://schema.org/InStock",
    };
  }
  if (typeof p.rating === "number") {
    out.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating.toFixed(1),
      bestRating: "5",
      worstRating: "1",
      ratingCount: 1,
    };
    out.review = {
      "@type": "Review",
      reviewRating: {
        "@type": "Rating",
        ratingValue: p.rating.toFixed(1),
        bestRating: "5",
      },
      author: { "@type": "Organization", name: "KanzenAI Editorial" },
    };
  }
  return out;
}

function extractProductsFromBody(body: ArticleBlock[] | undefined): ProductData[] {
  if (!body) return [];
  return body
    .filter((b): b is Extract<ArticleBlock, { type: "product" }> => b.type === "product")
    .map((b) => ({
      name: b.name,
      url: b.cta?.url,
      price: b.price,
      rating: b.rating,
    }));
}

function extractNumericPrice(price: string): string {
  const m = price.match(/\$?(\d+(?:\.\d+)?)/);
  return m ? m[1] : "0";
}

function wordCountOfBody(body: ArticleBlock[]): number {
  let count = 0;
  for (const block of body) {
    if ("text" in block && typeof block.text === "string") count += block.text.split(/\s+/).filter(Boolean).length;
    if ("items" in block && Array.isArray(block.items)) {
      for (const item of block.items) count += item.split(/\s+/).filter(Boolean).length;
    }
  }
  return count;
}

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
