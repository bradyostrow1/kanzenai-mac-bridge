#!/usr/bin/env tsx
/**
 * Sweep replace placeholder affiliate URLs with real tracking URLs.
 *
 * Usage: edit the AFFILIATE_LINKS map below with the real URLs each
 * vendor gives you, then run:
 *
 *   npm run swap-links
 *
 * The script walks every article and comparison JSON, finds any URL
 * matching a known vendor pattern, and replaces it with the real
 * affiliate URL. Saves a backup of each modified file as `*.bak`
 * (gitignored) in case you need to revert.
 *
 * Vendors with no entry below are left untouched.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

// ─── Edit this map ───────────────────────────────────────────────────────────
// Key = the host portion of the placeholder URL (e.g. "www.followupboss.com")
// Value = the full real affiliate URL the vendor gave you
//
// Examples:
//   "www.followupboss.com": "https://followupboss.partnerlinks.io/abc123",
//   "bombbomb.com":         "https://www.shareasale.com/r.cfm?b=12345&u=99999&m=...",
//
// Lines starting with "//" are comments — uncomment when you have the URL.

const AFFILIATE_LINKS: Record<string, string> = {
  // CRMs
  // "www.followupboss.com":      "https://...",
  // "lofty.com":                 "https://...",
  // "www.insiderealestate.com":  "https://...",     // kvCORE

  // Lead-gen / IDX
  // "www.realgeeks.com":         "https://...",
  // "www.sierrainteractive.com": "https://...",
  // "placester.com":             "https://...",
  // "www.idxbroker.com":         "https://...",

  // Dialers
  // "www.mojosells.com":         "https://...",
  // "www.vulcan7.com":           "https://...",
  // "www.theredx.com":           "https://...",
  // "www.phoneburner.com":       "https://...",
  // "www.espressoagent.com":     "https://...",

  // Transaction management
  // "www.dotloop.com":           "https://...",
  // "skyslope.com":              "https://...",
  // "www.brokermint.com":        "https://...",
  // "www.paperlesspipeline.com": "https://...",

  // AI / video / tools
  // "bombbomb.com":              "https://...",
  // "otter.ai":                  "https://...",
  // "spaceflow.io":              "https://...",
  // "claude.com":                "https://...",
  // "openai.com":                "https://...",
};

// ─── Implementation ──────────────────────────────────────────────────────────
const ARTICLES_DIR = join(process.cwd(), "content", "articles");
const COMPARISONS_DIR = join(process.cwd(), "content", "comparisons");

async function processDir(dir: string): Promise<{ touched: number; replacements: number }> {
  if (!existsSync(dir)) return { touched: 0, replacements: 0 };
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  let touched = 0;
  let replacements = 0;

  for (const file of files) {
    const path = join(dir, file);
    let text = await readFile(path, "utf8");
    const original = text;

    for (const [host, realUrl] of Object.entries(AFFILIATE_LINKS)) {
      const escaped = host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`https?://${escaped}/?(\\?ref=kanzenai)?[^"\\s]*`, "g");
      text = text.replace(re, (match) => {
        replacements++;
        return realUrl;
      });
    }

    if (text !== original) {
      await writeFile(`${path}.bak`, original);
      await writeFile(path, text);
      touched++;
      console.log(`  ✓ ${file}`);
    }
  }
  return { touched, replacements };
}

async function main() {
  const entries = Object.keys(AFFILIATE_LINKS).filter(
    (k) => !AFFILIATE_LINKS[k].startsWith("//"),
  );
  if (entries.length === 0) {
    console.log("\n  Nothing to do. Edit scripts/swap-affiliate-links.ts and");
    console.log("  uncomment the vendors whose real affiliate URLs you have.\n");
    return;
  }

  console.log(`\n→ Replacing URLs for ${entries.length} vendor(s):`);
  for (const k of entries) console.log(`    · ${k} → ${AFFILIATE_LINKS[k].slice(0, 60)}${AFFILIATE_LINKS[k].length > 60 ? "…" : ""}`);

  console.log("\n→ Articles:");
  const a = await processDir(ARTICLES_DIR);
  console.log("\n→ Comparisons:");
  const c = await processDir(COMPARISONS_DIR);

  console.log("\n" + "─".repeat(50));
  console.log(`  ${a.touched + c.touched} files modified, ${a.replacements + c.replacements} URL replacements`);
  console.log("  Backups saved as *.json.bak (gitignored)");
  console.log("─".repeat(50) + "\n");
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
