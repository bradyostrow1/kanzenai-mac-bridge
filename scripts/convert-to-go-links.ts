#!/usr/bin/env tsx
/**
 * One-time migration: replace every direct vendor URL in articles + comparisons
 * with the canonical /go/<slug> format defined in lib/affiliates.ts.
 *
 * Idempotent — safe to run multiple times. Leaves anything not matched alone.
 *
 * Run: npm run convert-go-links
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { AFFILIATES } from "../lib/affiliates";

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");

// Manual alias map for vendors whose article URLs use a different host
// than what's in lib/affiliates.ts. Add new entries here when audit complains.
const HOST_ALIASES: Record<string, string> = {
  // alternate hosts → canonical slug
  "www.lofty.com": "lofty",
  "kvcore.com": "kvcore",
  "www.kvcore.com": "kvcore",
  "chat.openai.com": "openai",
  "www.openai.com": "openai",
  "www.anthropic.com": "claude",
  "anthropic.com": "claude",
  "www.spaceflow.io": "spaceflow",
  "www.quickbooks.com": "quickbooks",
  "www.redx.com": "redx",
  "redx.com": "redx",
  "www.openhomepro.com": "open-home-pro",
  "activecampaign.com": "activecampaign",
  "vyralmarketing.com": "vyral-marketing",
  "www.skyslope.com": "skyslope",
  "www.bombbomb.com": "bombbomb",
  "www.listingai.com": "listing-ai",
  "listingai.com": "listing-ai",
  "www.placester.com": "placester",
  "www.dotloop.com": "dotloop",
  "www.brokermint.com": "brokermint",
  "www.paperlesspipeline.com": "paperless-pipeline",
  "www.theredx.com": "redx",
  "www.followupboss.com": "follow-up-boss",
  "lofty.com": "lofty",
  "smithai.com": "smith-ai",
  "www.smithai.com": "smith-ai",
  "www.vhtstudios.com": "vht-studios",
  "vhtstudios.com": "vht-studios",
  "www.supraekey.com": "supra-ekey",
  "supraekey.com": "supra-ekey",
  "calendar.google.com": "google-calendar",
};

function rootDomain(host: string): string {
  return host.replace(/^www\./, "");
}

function findSlugForHost(host: string): string | null {
  // 1. Exact alias match
  if (HOST_ALIASES[host]) return HOST_ALIASES[host];
  // 2. Iterate AFFILIATES and compare by root domain
  const target = rootDomain(host);
  for (const [slug, vendor] of Object.entries(AFFILIATES)) {
    try {
      const vendorHost = new URL(vendor.url).host;
      if (rootDomain(vendorHost) === target) return slug;
    } catch {}
  }
  return null;
}

async function processDir(dir: string): Promise<{ touched: number; replacements: number; unmatched: string[] }> {
  if (!existsSync(dir)) return { touched: 0, replacements: 0, unmatched: [] };
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  let touched = 0;
  let totalReplacements = 0;
  const unmatched: string[] = [];

  for (const file of files) {
    const path = join(dir, file);
    let text = await readFile(path, "utf8");
    const original = text;
    let replacements = 0;

    // Find every URL pattern in the JSON string and try to convert it
    text = text.replace(/"https?:\/\/([^/"\s]+)[^"\s]*"/g, (match, host) => {
      const slug = findSlugForHost(host);
      if (slug) {
        replacements++;
        return `"/go/${slug}"`;
      }
      // Track unmatched
      if (match.includes("?ref=kanzenai")) unmatched.push(`${file}: ${host}`);
      return match;
    });

    if (text !== original) {
      await writeFile(path, text);
      touched++;
      totalReplacements += replacements;
      console.log(`  ✓ ${file} · ${replacements} replacements`);
    }
  }
  return { touched, replacements: totalReplacements, unmatched };
}

async function main() {
  console.log(`\n→ Converting affiliate URLs to /go/ format using ${Object.keys(AFFILIATES).length} known vendors\n`);
  console.log("Articles:");
  const a = await processDir(ARTICLES_DIR);
  console.log("\nComparisons:");
  const c = await processDir(COMPARISONS_DIR);

  console.log(
    `\n${"─".repeat(50)}\n  ${a.touched + c.touched} files modified · ${a.replacements + c.replacements} URLs converted\n${"─".repeat(50)}\n`,
  );

  const allUnmatched = [...a.unmatched, ...c.unmatched];
  if (allUnmatched.length > 0) {
    console.log(`⚠ ${allUnmatched.length} URLs left unconverted (no vendor match):`);
    for (const u of allUnmatched.slice(0, 20)) console.log(`    ${u}`);
    console.log("\nAdd these hosts to HOST_ALIASES in this script, then re-run.\n");
  }
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
