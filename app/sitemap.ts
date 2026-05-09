import type { MetadataRoute } from "next";
import { listArticles, listComparisons } from "@/lib/articles";

const SITE = "https://kanzenai.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const articles = listArticles();
  const comparisons = listComparisons();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE}/articles`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE}/compare`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/disclosure`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/privacy`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${SITE}/category/crm`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/category/lead-gen`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/category/ai-tools`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/category/marketing`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/category/scheduling`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/category/phone-calls`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE}/category/invoicing`, changeFrequency: "weekly", priority: 0.7 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${SITE}/articles/${a.slug}`,
    lastModified: a.updatedAt ?? a.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  const comparisonRoutes: MetadataRoute.Sitemap = comparisons.map((c) => ({
    url: `${SITE}/compare/${c.slug}`,
    lastModified: c.updatedAt ?? c.publishedAt,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes, ...comparisonRoutes];
}
