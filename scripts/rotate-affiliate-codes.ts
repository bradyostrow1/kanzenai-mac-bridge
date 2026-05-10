#!/usr/bin/env tsx
/**
 * Reads affiliate-codes.json (gitignored) and rotates the matching entries
 * in lib/affiliates.ts to status="live" with the real tracking URL.
 *
 * affiliate-codes.json format (one entry per vendor as their codes come back):
 * {
 *   "follow-up-boss": "https://www.followupboss.com/?via=brady-2026",
 *   "real-geeks":     "https://realgeeks.partnerstack.com/abc123",
 *   ...
 * }
 *
 * Run:
 *   npm run rotate
 *
 * Idempotent — re-running with the same file is a no-op.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const CODES_FILE = join(ROOT, "affiliate-codes.json");
const AFFILIATES_FILE = join(ROOT, "lib", "affiliates.ts");

function main() {
  if (!existsSync(CODES_FILE)) {
    console.log(`\nNo ${CODES_FILE} yet. Create it like:\n`);
    console.log(`{
  "follow-up-boss": "https://followupboss.partnerlinks.io/abc123",
  "real-geeks":     "https://realgeeks.com/?ref=YOUR_ID"
}\n`);
    console.log("Then re-run: npm run rotate\n");
    return;
  }

  const codes: Record<string, string> = JSON.parse(readFileSync(CODES_FILE, "utf8"));
  const slugs = Object.keys(codes);
  if (slugs.length === 0) {
    console.log("affiliate-codes.json is empty.");
    return;
  }

  let source = readFileSync(AFFILIATES_FILE, "utf8");
  let touched = 0;
  let alreadyLive = 0;
  const missing: string[] = [];

  for (const slug of slugs) {
    const realUrl = codes[slug];
    if (!realUrl || typeof realUrl !== "string") {
      console.log(`  ⚠ skipping "${slug}" — value is empty or not a string`);
      continue;
    }

    // Match the vendor block: "slug": { url: "...", name: "...", status: "..." ...
    const blockRegex = new RegExp(
      `("${escapeRegex(slug)}":\\s*\\{[^}]*?url:\\s*)"[^"]*"([^}]*?status:\\s*)"[^"]*"`,
      "s",
    );
    const match = source.match(blockRegex);
    if (!match) {
      missing.push(slug);
      continue;
    }

    const before = source;
    source = source.replace(blockRegex, `$1"${realUrl}"$2"live"`);
    if (source === before) {
      alreadyLive++;
    } else {
      touched++;
      console.log(`  ✓ ${slug} → ${realUrl.slice(0, 60)}${realUrl.length > 60 ? "…" : ""}`);
    }
  }

  if (touched > 0) {
    writeFileSync(AFFILIATES_FILE, source);
  }

  console.log(`\n${"─".repeat(50)}`);
  console.log(`  ${touched} vendor(s) rotated to live`);
  if (alreadyLive > 0) console.log(`  ${alreadyLive} already live (no-op)`);
  if (missing.length > 0) {
    console.log(`  ⚠ ${missing.length} unknown slug(s) — not in lib/affiliates.ts:`);
    for (const m of missing) console.log(`    · ${m}`);
  }
  console.log(`${"─".repeat(50)}\n`);

  if (touched > 0) {
    console.log(`Next: git add lib/affiliates.ts && git commit -m "rotate ${touched} affiliate codes" && npx vercel deploy --prod --yes\n`);
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main();
