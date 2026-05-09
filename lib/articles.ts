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
  publishedAt: string;
  updatedAt: string;
  contenders: ComparisonContender[];
  intro: string;
  verdict: string;
  headerImage?: string;
};

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
