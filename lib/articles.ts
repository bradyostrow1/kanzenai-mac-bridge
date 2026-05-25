/**
 * Loads articles from JSON files in content/articles/. Bots write these
 * files; the site reads them. Adding a new article = bot writes a new
 * .json file. No code changes, no rebuild step (Next.js dynamic routes
 * pick it up).
 */
import fs from "node:fs";
import path from "node:path";

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");
const COMPARISONS_DIR = path.join(process.cwd(), "content", "comparisons");

export type Article = {
  slug: string;
  title: string;
  description: string;
  category: string;
  /**
   * Vertical the article serves. Articles without an explicit niche default to
   * "real-estate" (the legacy publishing history before the 2026-05-24 pivot).
   * New content from daily-auto-write should set "ai-tools" (the broader
   * solopreneur/creator/small-business audience).
   */
  niche?: NicheSlug;
  publishedAt: string; // ISO date
  updatedAt: string;
  readMinutes: number;
  tldr: string;
  body: ArticleBlock[];
  affiliateProducts?: AffiliateProduct[];
  headerImage?: string; // path to hero image, e.g. /articles/crm-hero.jpg
  imageCredit?: string; // photographer attribution
};

export type ArticleBlock =
  | { type: "h2"; text: string; id?: string }
  | { type: "h3"; text: string; id?: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "quote"; text: string; cite?: string }
  | { type: "callout"; variant: "tip" | "warn" | "info"; title?: string; text: string }
  | { type: "cta"; label: string; url: string; affiliate?: string }
  | { type: "product"; name: string; price: string; rating: number; pros: string[]; cons: string[]; cta: { label: string; url: string; affiliate?: string } };

export type AffiliateProduct = {
  name: string;
  url: string; // already-tagged affiliate link
  commission: string; // e.g. "$75/signup"
};

export type Comparison = {
  slug: string;
  title: string;
  description: string;
  /** See Article.niche — same defaulting rule. */
  niche?: NicheSlug;
  publishedAt: string;
  updatedAt: string;
  contenders: ComparisonContender[];
  intro: string;
  verdict: string;
  headerImage?: string;
};

// ─── Niches ─────────────────────────────────────────────────────────────────
export type NicheSlug = "real-estate" | "ai-tools";

export const NICHES: { slug: NicheSlug; name: string; description: string; tagline: string }[] = [
  {
    slug: "ai-tools",
    name: "AI Tools",
    description: "Reviews and comparisons of AI software, productivity tools, automation platforms, and the SaaS stack that runs lean operations — for solopreneurs, creators, and small businesses.",
    tagline: "For people who pick their own stack",
  },
  {
    slug: "real-estate",
    name: "Real Estate",
    description: "Reviews and comparisons of CRMs, dialers, lead-gen platforms, AI assistants, and transaction tools for working real estate agents.",
    tagline: "For working real estate agents",
  },
];

/** Default niche when an article lacks an explicit one. Existing 30 articles. */
const DEFAULT_NICHE: NicheSlug = "real-estate";

export function nicheOf(article: Pick<Article, "niche">): NicheSlug {
  return article.niche ?? DEFAULT_NICHE;
}

export function nicheBySlug(slug: string): (typeof NICHES)[number] | undefined {
  return NICHES.find((n) => n.slug === slug);
}

export function listArticlesByNiche(slug: NicheSlug): Article[] {
  return listArticles().filter((a) => nicheOf(a) === slug);
}

export function listComparisonsByNiche(slug: NicheSlug): Comparison[] {
  return listComparisons().filter((c) => nicheOf(c) === slug);
}

/** Returns niches that have at least one article or comparison published. */
export function activeNiches(): typeof NICHES {
  const articles = listArticles();
  const comparisons = listComparisons();
  const used = new Set<NicheSlug>();
  for (const a of articles) used.add(nicheOf(a));
  for (const c of comparisons) used.add(nicheOf(c));
  return NICHES.filter((n) => used.has(n.slug));
}

export type ComparisonContender = {
  name: string;
  affiliateUrl: string;
  startingPrice: string;
  rating: number;
  bestFor: string;
  pros: string[];
  cons: string[];
};

function safeReadDir(dir: string): string[] {
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
}

export function listArticles(): Article[] {
  return safeReadDir(ARTICLES_DIR)
    .map((f): Article | null => {
      try {
        return JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, f), "utf-8"));
      } catch {
        return null;
      }
    })
    .filter((a): a is Article => !!a)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function getArticle(slug: string): Article | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(ARTICLES_DIR, `${slug}.json`), "utf-8"));
  } catch {
    return null;
  }
}

export function listComparisons(): Comparison[] {
  return safeReadDir(COMPARISONS_DIR)
    .map((f): Comparison | null => {
      try {
        return JSON.parse(fs.readFileSync(path.join(COMPARISONS_DIR, f), "utf-8"));
      } catch {
        return null;
      }
    })
    .filter((c): c is Comparison => !!c)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}

export function getComparison(slug: string): Comparison | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(COMPARISONS_DIR, `${slug}.json`), "utf-8"));
  } catch {
    return null;
  }
}

export const CATEGORIES = [
  "Scheduling",
  "CRM",
  "Phone & Calls",
  "Invoicing",
  "Marketing",
  "Inventory",
] as const;

export function categorySlug(category: string): string {
  return category
    .toLowerCase()
    .replace(/\s+&\s+/g, "-")
    .replace(/\s+/g, "-");
}

/**
 * Pick N articles related to the given article. Strategy:
 *   1. Same category, sorted by recency.
 *   2. If fewer than N, fill from other recent articles.
 *   3. Always exclude the source article itself.
 */
export function relatedArticles(source: Article, n = 3): Article[] {
  const all = listArticles().filter((a) => a.slug !== source.slug);
  const sameCategory = all.filter((a) => a.category === source.category);
  if (sameCategory.length >= n) return sameCategory.slice(0, n);
  const others = all.filter((a) => a.category !== source.category);
  return [...sameCategory, ...others].slice(0, n);
}

/**
 * Pick N comparisons + N articles related to a comparison. Articles are matched
 * by checking if any contender's name is referenced in their content/products.
 */
export function relatedToComparison(
  source: Comparison,
  n = 3,
): { comparisons: Comparison[]; articles: Article[] } {
  const otherComparisons = listComparisons()
    .filter((c) => c.slug !== source.slug)
    .slice(0, n);

  const productNames = source.contenders.map((c) => c.name.toLowerCase());
  const matchedArticles = listArticles().filter((a) => {
    const text = JSON.stringify(a).toLowerCase();
    return productNames.some((name) => text.includes(name));
  });
  return { comparisons: otherComparisons, articles: matchedArticles.slice(0, n) };
}
