#!/usr/bin/env tsx
/**
 * Detects duplicate headerImage values across all articles + comparisons
 * and reassigns dupes to unused images from the available pool.
 *
 * Run: node --import tsx scripts/dedup-images.ts
 *
 * The available pool is read from public/articles/. Articles already using
 * a unique image are left alone. The first article using a duplicated image
 * keeps it; subsequent ones get reassigned in publish-date order (newer
 * articles get the rotation pressure).
 */
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const PUBLIC_IMAGES_DIR = join(ROOT, "public", "articles");

async function loadDir(dir: string) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map(async (file) => {
      const path = join(dir, file);
      const json = JSON.parse(await readFile(path, "utf8"));
      return { dir, file, path, json };
    }),
  );
}

async function main() {
  const articles = await loadDir(ARTICLES_DIR);
  const comparisons = await loadDir(COMPARISONS_DIR);
  const all = [...articles, ...comparisons];

  // Sort by publish date (older keeps image, newer reassigned)
  all.sort((a, b) => Date.parse(a.json.publishedAt ?? "") - Date.parse(b.json.publishedAt ?? ""));

  const availableImages = (await readdir(PUBLIC_IMAGES_DIR))
    .filter((f) => f.endsWith(".jpg") || f.endsWith(".jpeg") || f.endsWith(".png"))
    .map((f) => `/articles/${f}`);

  const used = new Set<string>();
  const fixes: Array<{ file: string; from: string; to: string }> = [];

  for (const item of all) {
    const current = item.json.headerImage;
    if (!current) continue;

    if (!used.has(current)) {
      used.add(current);
      continue;
    }

    // Duplicate — find an unused image
    const next = availableImages.find((p) => !used.has(p));
    if (!next) {
      console.log(`⚠ no unused images left for ${item.file} — stays on ${current}`);
      continue;
    }

    item.json.headerImage = next;
    used.add(next);
    await writeFile(item.path, JSON.stringify(item.json, null, 2) + "\n");
    fixes.push({ file: item.file, from: current, to: next });
  }

  if (fixes.length === 0) {
    console.log("✓ No duplicate images found.");
  } else {
    console.log(`✓ Reassigned ${fixes.length} duplicate(s):`);
    for (const f of fixes) console.log(`  ${f.file}\n    ${f.from} → ${f.to}`);
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
