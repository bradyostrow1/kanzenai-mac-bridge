/**
 * Image library used by Bot 1 (Writer), Bot 12 (Image Producer, when built),
 * and any other bot that needs an article hero or inline image.
 *
 * v0: Pexels-only, mirrors the historical writer behavior. The ImageAdapter
 * interface is in place so an owned image-gen tool (Nano Banana / fal /
 * Replicate / etc.) can slot in front of Pexels with zero call-site changes.
 *
 * See scripts/specs/bot-12-image-producer.md for the v1 plan.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Source of one hero / inline image. Adapters try in chain order. */
export interface ImageAdapter {
  /** Human-readable name for logs ("pexels", "nano-banana", "pool", ...) */
  name: string;
  /** True if this adapter has the keys / state it needs to run. */
  available(): boolean;
  /** Produce ONE image. Resolves to null on no-result so the chain continues. */
  fetch(brief: ImageBrief): Promise<ImageResult | null>;
}

export type ImageBrief = {
  /** Article slug — used to name the saved file. */
  slug: string;
  /** Full article title — primary signal for search/generation. */
  title: string;
  /** Optional category hint (e.g. "CRM", "Lead Gen"). */
  category?: string;
  /** Optional vendor/product names to bias the search toward. */
  keywords?: string[];
};

export type ImageResult = {
  /** Public web path (e.g. "/articles/<slug>-hero.jpg"). */
  publicPath: string;
  /** Attribution string for `imageCredit` (e.g. "Pexels · Jane Photographer"). */
  credit?: string;
  /** Which adapter produced this image, for logging. */
  source: string;
};

const PUBLIC_IMG_DIR = join(process.cwd(), "public", "articles");
const ARTICLES_DIR = join(process.cwd(), "content", "articles");
const COMPARISONS_DIR = join(process.cwd(), "content", "comparisons");

/** Build a compact Pexels search query from an article brief. */
export function deriveQuery(brief: ImageBrief): string {
  return brief.title
    .replace(/\b(20\d\d|in|for|the|best|vs|and|or|with|a|an|of)\b/gi, " ")
    .replace(/[^a-zA-Z ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(" ")
    .trim() || "modern workspace laptop";
}

/** Set of hero filenames already in use by other articles or comparisons.
 *  Excludes the brief's own slug so a regenerate doesn't see its own old hero. */
export function usedHeroes(brief: ImageBrief): Set<string> {
  const used = new Set<string>();
  for (const dir of [ARTICLES_DIR, COMPARISONS_DIR]) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json") || file === `${brief.slug}.json`) continue;
      try {
        const other = JSON.parse(readFileSync(join(dir, file), "utf8")) as { headerImage?: string };
        const name = other.headerImage?.split("/").pop();
        if (name) used.add(name);
      } catch { /* skip malformed */ }
    }
  }
  return used;
}

// ─── Adapter 1 · Pexels ────────────────────────────────────────────
export const pexelsAdapter: ImageAdapter = {
  name: "pexels",
  available() { return Boolean(process.env.PEXELS_API_KEY); },
  async fetch(brief) {
    const key = process.env.PEXELS_API_KEY;
    if (!key) return null;
    const query = deriveQuery(brief);
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
      { headers: { Authorization: key } },
    );
    if (!r.ok) return null;
    const data = (await r.json()) as {
      photos?: Array<{ id: number; src: { large: string; large2x?: string }; photographer?: string }>;
    };
    const photos = (data.photos ?? []).filter((p) => p?.id && p?.src?.large);
    if (!photos.length) return null;
    const pick = photos[Math.floor(Math.random() * Math.min(photos.length, 8))];
    const url = pick.src.large2x ?? pick.src.large;
    const imgResp = await fetch(url);
    if (!imgResp.ok) return null;
    const buf = Buffer.from(await imgResp.arrayBuffer());
    const heroName = `${brief.slug}-hero.jpg`;
    writeFileSync(join(PUBLIC_IMG_DIR, heroName), buf);
    return {
      publicPath: `/articles/${heroName}`,
      credit: pick.photographer ? `Pexels · ${pick.photographer}` : "Pexels",
      source: "pexels",
    };
  },
};

// ─── Adapter 2 · Existing on-disk pool ─────────────────────────────
/** Pick an unused image from the on-disk pool. Last-resort fallback when
 *  Pexels + any owned adapter all fail. Returns null only if the pool is
 *  exhausted (every image is already a hero somewhere). */
export const poolAdapter: ImageAdapter = {
  name: "pool",
  available() { return existsSync(PUBLIC_IMG_DIR); },
  async fetch(brief) {
    const allImgs = readdirSync(PUBLIC_IMG_DIR).filter((f) => f.endsWith(".jpg"));
    const used = usedHeroes(brief);
    const free = allImgs.filter((f) => !used.has(f));
    if (!free.length) return null;
    const pick = free[Math.floor(Math.random() * free.length)];
    return {
      publicPath: `/articles/${pick}`,
      source: "pool",
    };
  },
};

// ─── Adapter chain ─────────────────────────────────────────────────
/** Default chain — owned adapters (when wired) get prepended to this. */
export const DEFAULT_ADAPTER_CHAIN: ImageAdapter[] = [pexelsAdapter, poolAdapter];

/**
 * Run the adapter chain in order. Returns the first non-null result, or null
 * if every adapter declined. Logs the chosen source name.
 */
export async function generateHero(brief: ImageBrief, chain: ImageAdapter[] = DEFAULT_ADAPTER_CHAIN): Promise<ImageResult | null> {
  for (const adapter of chain) {
    if (!adapter.available()) continue;
    try {
      const result = await adapter.fetch(brief);
      if (result) {
        // eslint-disable-next-line no-console
        console.log(`  ✓ hero via ${result.source}: ${result.publicPath}${result.credit ? ` (${result.credit})` : ""}`);
        return result;
      }
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.log(`  · ${adapter.name} adapter error: ${e.message ?? e}`);
    }
  }
  return null;
}
