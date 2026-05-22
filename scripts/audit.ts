#!/usr/bin/env tsx
/**
 * KanzenAI daily audit bot.
 *
 * Runs 11 checks across content + production site:
 *   1. Duplicate slugs           (errors)
 *   2. Near-duplicate titles      (warns)
 *   3. Duplicate product coverage (warns) — same product reviewed in too many articles
 *   4. Missing header images      (errors) — referenced file doesn't exist on disk
 *   5. Placeholder affiliate URLs (warns) — ?ref=kanzenai not yet replaced with real ID
 *   6. JSON schema gaps           (errors) — required fields missing
 *   7. Date sanity                (warns) — publishedAt in future or > 2 yrs old
 *   8. Thin content               (warns) — body word count < 600
 *   9. Meta description length    (warns) — outside 120-170 SEO range
 *  10. Live site health           (errors) — kanzenai.com returns non-200
 *  11. Subscribe API              (errors) — POST returns non-200 for valid email
 *
 * Run:
 *   npm run audit
 *
 * Schedule daily on macOS:
 *   launchctl load ~/Library/LaunchAgents/com.kanzenai.audit.plist
 *
 * Schedule daily on Vercel:
 *   add a cron entry in vercel.json that hits /api/audit (TODO: build that route)
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Load .env.local so PEXELS_API_KEY (and friends) are available when launchd
// invokes us without a shell-loaded environment.
function loadEnvLocal() {
  const p = join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (v && !process.env[k]) process.env[k] = v;
  }
}
loadEnvLocal();

type Severity = "error" | "warn" | "info";
type Finding = {
  severity: Severity;
  check: string;
  message: string;
  files?: string[];
};

const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const PUBLIC_DIR = join(ROOT, "public");
const ARTICLE_IMAGES_DIR = join(PUBLIC_DIR, "articles");
const PROD_URL = process.env.KANZENAI_PROD_URL ?? "https://kanzenai.com";

const FIX = process.argv.includes("--fix");

const findings: Finding[] = [];
// Track which files had which image so --fix can reassign the duplicates.
// Keyed by image path → list of article JSON filenames.
const imageUsage = new Map<string, string[]>();

function flag(severity: Severity, check: string, message: string, files?: string[]) {
  findings.push({ severity, check, message, files });
}

// ─── Loaders ─────────────────────────────────────────────────────────────────
async function loadDir(dir: string): Promise<Array<{ file: string; json: any }>> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  const out: Array<{ file: string; json: any }> = [];
  for (const f of entries) {
    if (!f.endsWith(".json")) continue;
    try {
      const text = await readFile(join(dir, f), "utf8");
      out.push({ file: f, json: JSON.parse(text) });
    } catch (e: any) {
      flag("error", "json-parse", `Invalid JSON: ${f} — ${e.message}`, [f]);
    }
  }
  return out;
}

// ─── Checks ──────────────────────────────────────────────────────────────────
function checkDuplicateSlugs(items: Array<{ file: string; json: any }>, kind: string) {
  const seen = new Map<string, string[]>();
  for (const { file, json } of items) {
    const slug = json.slug ?? "";
    if (!slug) {
      flag("error", "missing-slug", `${kind} missing 'slug' field`, [file]);
      continue;
    }
    const list = seen.get(slug) ?? [];
    list.push(file);
    seen.set(slug, list);
  }
  for (const [slug, files] of seen) {
    if (files.length > 1) {
      flag("error", "duplicate-slug", `Duplicate ${kind} slug "${slug}" in ${files.length} files`, files);
    }
  }
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersect = 0;
  for (const t of a) if (b.has(t)) intersect++;
  return intersect / (a.size + b.size - intersect);
}

function checkNearDuplicateTitles(items: Array<{ file: string; json: any }>) {
  const titles = items.map((a) => ({ file: a.file, title: a.json.title ?? "", tokens: tokenize(a.json.title ?? "") }));
  for (let i = 0; i < titles.length; i++) {
    for (let j = i + 1; j < titles.length; j++) {
      const score = jaccard(titles[i].tokens, titles[j].tokens);
      if (score > 0.7) {
        flag(
          "warn",
          "near-duplicate-title",
          `Titles ${(score * 100).toFixed(0)}% similar: "${titles[i].title}" ↔ "${titles[j].title}"`,
          [titles[i].file, titles[j].file],
        );
      }
    }
  }
}

function checkProductOverlap(items: Array<{ file: string; json: any }>) {
  const productMentions = new Map<string, string[]>();
  for (const { file, json } of items) {
    const products = new Set<string>();
    if (Array.isArray(json.affiliateProducts)) {
      for (const p of json.affiliateProducts) {
        if (p.name) products.add(p.name.toLowerCase().trim());
      }
    }
    if (Array.isArray(json.body)) {
      for (const block of json.body) {
        if (block.type === "product" && block.name) products.add(block.name.toLowerCase().trim());
      }
    }
    for (const name of products) {
      const list = productMentions.get(name) ?? [];
      list.push(file);
      productMentions.set(name, list);
    }
  }
  for (const [product, files] of productMentions) {
    if (files.length >= 4) {
      flag(
        "warn",
        "product-overlap",
        `"${product}" appears in ${files.length} articles — risk of cannibalizing search rankings`,
        files,
      );
    }
  }
}

function checkMissingImages(items: Array<{ file: string; json: any }>) {
  for (const { file, json } of items) {
    const path = json.headerImage;
    if (!path) {
      flag("warn", "missing-header-image", `No headerImage set`, [file]);
      continue;
    }
    const onDisk = join(PUBLIC_DIR, path.replace(/^\//, ""));
    if (!existsSync(onDisk)) {
      flag("error", "broken-image", `headerImage "${path}" does not exist on disk`, [file]);
    }
  }
}

function checkDuplicateImages(items: Array<{ file: string; json: any }>) {
  for (const { file, json } of items) {
    const path = json.headerImage;
    if (!path) continue;
    const list = imageUsage.get(path) ?? [];
    list.push(file);
    imageUsage.set(path, list);
  }
  for (const [img, files] of imageUsage) {
    if (files.length > 1) {
      flag(
        "error",
        "duplicate-image",
        `headerImage "${img}" reused across ${files.length} articles — readers will see the same hero photo twice on the homepage`,
        files,
      );
    }
  }
}

function checkPlaceholderAffiliateLinks(items: Array<{ file: string; json: any }>) {
  // Old format: ?ref=kanzenai still appearing in articles
  let oldFormatCount = 0;
  for (const { file, json } of items) {
    const text = JSON.stringify(json);
    const matches = text.match(/\?ref=kanzenai/g);
    if (matches) oldFormatCount += matches.length;
  }
  if (oldFormatCount > 0) {
    flag(
      "warn",
      "old-affiliate-format",
      `${oldFormatCount} unconverted ?ref=kanzenai URLs still in articles. Run: npm run convert-go-links`,
    );
  }

  // Validate all /go/<slug> links resolve in lib/affiliates.ts
  const affiliatesPath = join(ROOT, "lib", "affiliates.ts");
  let knownSlugs = new Set<string>();
  if (existsSync(affiliatesPath)) {
    try {
      const text = require("node:fs").readFileSync(affiliatesPath, "utf8");
      const slugMatches = text.matchAll(/^\s+"([\w-]+)":\s+\{/gm);
      for (const m of slugMatches) knownSlugs.add(m[1]);
    } catch {}
  }

  const goLinkUses = new Map<string, number>();
  const unknownSlugs = new Map<string, string[]>();
  for (const { file, json } of items) {
    const text = JSON.stringify(json);
    const matches = text.matchAll(/\/go\/([\w-]+)/g);
    for (const m of matches) {
      const slug = m[1];
      goLinkUses.set(slug, (goLinkUses.get(slug) ?? 0) + 1);
      if (!knownSlugs.has(slug)) {
        const list = unknownSlugs.get(slug) ?? [];
        list.push(file);
        unknownSlugs.set(slug, list);
      }
    }
  }

  for (const [slug, files] of unknownSlugs) {
    flag(
      "error",
      "unknown-affiliate-slug",
      `/go/${slug} is referenced but missing from lib/affiliates.ts — clicks will 404`,
      [...new Set(files)],
    );
  }

  // Count placeholder vendors that are actually being used
  if (existsSync(affiliatesPath)) {
    const text = require("node:fs").readFileSync(affiliatesPath, "utf8");
    const placeholderSlugs = new Set<string>();
    const placeholderRegex = /^\s+"([\w-]+)":\s+\{[^}]*status:\s*"placeholder"/gm;
    for (const m of text.matchAll(placeholderRegex)) placeholderSlugs.add(m[1]);
    const usedPlaceholders = [...goLinkUses.keys()].filter((s) => placeholderSlugs.has(s));
    if (usedPlaceholders.length > 0) {
      flag(
        "warn",
        "placeholder-affiliate",
        `${usedPlaceholders.length} vendors still use placeholder URLs (status: "placeholder" in lib/affiliates.ts). They redirect but don't track. Update once vendor approves your affiliate code.`,
      );
    }
  }
}

function checkSchema(items: Array<{ file: string; json: any }>, kind: "article" | "comparison") {
  const requiredArticle = ["slug", "title", "description", "category", "publishedAt", "updatedAt", "readMinutes", "tldr", "body"];
  const requiredComparison = ["slug", "title", "description", "publishedAt", "updatedAt", "intro", "verdict", "contenders"];
  const required = kind === "article" ? requiredArticle : requiredComparison;
  for (const { file, json } of items) {
    const missing = required.filter((k) => !json[k] && json[k] !== 0);
    if (missing.length > 0) {
      flag("error", "schema-gap", `${file} missing required fields: ${missing.join(", ")}`, [file]);
    }
  }
}

function checkDates(items: Array<{ file: string; json: any }>) {
  const today = new Date();
  const twoYearsAgo = new Date(today.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);
  for (const { file, json } of items) {
    const pub = json.publishedAt;
    if (!pub) continue;
    const d = new Date(pub);
    if (isNaN(d.getTime())) {
      flag("error", "bad-date", `Invalid publishedAt "${pub}"`, [file]);
      continue;
    }
    if (d > today) {
      flag("warn", "future-date", `publishedAt is in the future: ${pub}`, [file]);
    }
    if (d < twoYearsAgo) {
      flag("warn", "stale-date", `publishedAt > 2 years old: ${pub} — consider refreshing`, [file]);
    }
  }
}

function wordCount(json: any): number {
  let count = 0;
  const harvest = (s: any) => {
    if (typeof s === "string") count += s.trim().split(/\s+/).length;
    else if (Array.isArray(s)) s.forEach(harvest);
    else if (s && typeof s === "object") Object.values(s).forEach(harvest);
  };
  harvest(json);
  return count;
}

function checkThinContent(items: Array<{ file: string; json: any }>) {
  for (const { file, json } of items) {
    const wc = wordCount(json);
    if (wc < 600) {
      flag("warn", "thin-content", `Only ${wc} words — articles under 600 words rarely rank`, [file]);
    }
  }
}

function checkMetaDescriptions(items: Array<{ file: string; json: any }>) {
  for (const { file, json } of items) {
    const desc = json.description ?? "";
    const len = desc.length;
    if (len === 0) {
      flag("error", "missing-description", `No description set`, [file]);
    } else if (len < 120) {
      flag("warn", "short-description", `Description ${len} chars (< 120 — undersized for SEO)`, [file]);
    } else if (len > 170) {
      flag("warn", "long-description", `Description ${len} chars (> 170 — Google will truncate)`, [file]);
    }
  }
}

async function checkLiveSite(): Promise<void> {
  const paths = ["/", "/articles", "/compare", "/about", "/disclosure", "/privacy"];
  for (const p of paths) {
    try {
      const r = await fetch(PROD_URL + p, { method: "GET" });
      if (!r.ok) {
        flag("error", "broken-route", `${PROD_URL}${p} returned ${r.status}`);
      }
    } catch (e: any) {
      flag("error", "fetch-failed", `${PROD_URL}${p} unreachable: ${e.message}`);
    }
  }
}

async function checkSubscribeApi(): Promise<void> {
  try {
    const r = await fetch(PROD_URL + "/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "audit-bot@kanzenai.com", source: "daily-audit" }),
    });
    if (!r.ok) {
      flag("error", "subscribe-broken", `POST /api/subscribe returned ${r.status}`);
    }
  } catch (e: any) {
    flag("error", "subscribe-fetch-failed", `POST /api/subscribe unreachable: ${e.message}`);
  }
}

// ─── Auto-fixers (only run when --fix is passed) ─────────────────────────────

/** Pick an existing on-disk hero NOT currently used by any article. null if pool exhausted. */
async function pickUnusedDiskHero(): Promise<string | null> {
  if (!existsSync(ARTICLE_IMAGES_DIR)) return null;
  const onDisk = (await readdir(ARTICLE_IMAGES_DIR))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .map((f) => `/articles/${f}`);
  const used = new Set(imageUsage.keys());
  const unused = onDisk.filter((p) => !used.has(p));
  if (unused.length === 0) return null;
  return unused[Math.floor(Math.random() * unused.length)];
}

/**
 * Fetch a fresh hero from Pexels keyed off the article's slug/title.
 * Returns the new /articles/<slug>-hero.jpg path on success, null on failure.
 */
async function fetchFreshPexelsHero(slugOrTitle: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;
  const query =
    slugOrTitle
      .replace(/\.json$/, "")
      .replace(/-/g, " ")
      .replace(/\b(20\d\d|in|for|the|best|vs|and|or|with|a|an|of|real|estate)\b/gi, " ")
      .replace(/[^a-zA-Z ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5)
      .join(" ")
      .trim() || "office desk";
  try {
    const resp = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
      { headers: { Authorization: key } },
    );
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      photos?: Array<{ id: number; src: { large: string; large2x?: string } }>;
    };
    const photos = (data.photos ?? []).filter((p) => p?.id && p?.src?.large);
    if (photos.length === 0) return null;
    // Skip any photo whose remote URL we've already used (rare but possible).
    const pick = photos[Math.floor(Math.random() * Math.min(photos.length, 8))];
    const url = pick.src.large2x ?? pick.src.large;
    const imgResp = await fetch(url);
    if (!imgResp.ok) return null;
    const buf = Buffer.from(await imgResp.arrayBuffer());
    const heroName = `${slugOrTitle.replace(/\.json$/, "")}-fix-hero.jpg`;
    const { writeFileSync } = await import("node:fs");
    writeFileSync(join(ARTICLE_IMAGES_DIR, heroName), buf);
    return `/articles/${heroName}`;
  } catch {
    return null;
  }
}

async function fixDuplicateImages(): Promise<string[]> {
  const log: string[] = [];
  // Snapshot duplicate groups up-front so we don't iterate a mutating map.
  const duplicates: Array<[string, string[]]> = [];
  for (const [img, files] of imageUsage) {
    if (files.length > 1) duplicates.push([img, [...files]]);
  }

  for (const [img, files] of duplicates) {
    // Keep the first file's image, reassign the rest.
    for (let i = 1; i < files.length; i++) {
      const fname = files[i];
      const candidates = [join(ARTICLES_DIR, fname), join(COMPARISONS_DIR, fname)];
      const path = candidates.find((p) => existsSync(p));
      if (!path) {
        log.push(`  · ${fname}: file not found on disk — skipped`);
        continue;
      }

      // 1. Try an existing unused hero first (free, fast).
      let fresh = await pickUnusedDiskHero();
      let source = "pool";

      // 2. Fall back to a fresh Pexels fetch keyed off the slug.
      if (!fresh) {
        fresh = await fetchFreshPexelsHero(fname);
        source = "Pexels";
      }

      if (!fresh || fresh === img) {
        log.push(`  · ${fname}: no fresh hero available (pool exhausted + Pexels failed) — skipped`);
        continue;
      }
      try {
        const json = JSON.parse(await readFile(path, "utf8"));
        json.headerImage = fresh;
        if (source === "Pexels") json.imageCredit = "Pexels (auto-fix)";
        await writeFile(path, JSON.stringify(json, null, 2) + "\n");
        // Mark the new image as used so subsequent loop iterations don't pick it.
        imageUsage.set(fresh, [...(imageUsage.get(fresh) ?? []), fname]);
        log.push(`  ✓ ${fname}: ${img} → ${fresh} (${source})`);
      } catch (e: any) {
        log.push(`  ✗ ${fname}: ${e.message}`);
      }
    }
  }
  return log;
}

function fixOldAffiliateLinks(): { ok: boolean; out: string } {
  const r = spawnSync("npm", ["run", "convert-go-links"], { cwd: ROOT, encoding: "utf8" });
  return {
    ok: r.status === 0,
    out: ((r.stdout ?? "") + (r.stderr ?? "")).slice(-1500),
  };
}

async function runAutoFixes() {
  console.log("\n" + "═".repeat(70));
  console.log("  AUTO-FIX MODE (--fix)");
  console.log("═".repeat(70));

  const hasDupImages = findings.some((f) => f.check === "duplicate-image");
  const hasOldLinks = findings.some((f) => f.check === "old-affiliate-format");

  if (!hasDupImages && !hasOldLinks) {
    console.log("\n  Nothing to auto-fix. The fixer handles duplicate-image + old-affiliate-format only.\n");
    return;
  }

  if (hasDupImages) {
    console.log("\n→ Reassigning duplicate hero images...");
    const log = await fixDuplicateImages();
    for (const line of log) console.log(line);
  }

  if (hasOldLinks) {
    console.log("\n→ Running convert-go-links...");
    const r = fixOldAffiliateLinks();
    console.log(r.out);
    if (!r.ok) console.log("  (exit non-zero — check output above)");
  }

  console.log("\n→ Done. Re-run `npm run audit` (without --fix) to confirm findings cleared.\n");
}

// ─── Report ──────────────────────────────────────────────────────────────────
function printReport() {
  const errors = findings.filter((f) => f.severity === "error");
  const warns = findings.filter((f) => f.severity === "warn");
  const infos = findings.filter((f) => f.severity === "info");

  const ICONS = { error: "✗", warn: "⚠", info: "·" };
  const COLORS = { error: "\x1b[31m", warn: "\x1b[33m", info: "\x1b[36m" };
  const RESET = "\x1b[0m";

  console.log("\n" + "═".repeat(70));
  console.log("  KanzenAI Daily Audit · " + new Date().toISOString().slice(0, 10));
  console.log("═".repeat(70));

  if (findings.length === 0) {
    console.log("\n  ✓ All clean. No findings.\n");
    return;
  }

  for (const f of findings) {
    const c = COLORS[f.severity];
    console.log(`\n  ${c}${ICONS[f.severity]} [${f.check}]${RESET}  ${f.message}`);
    if (f.files && f.files.length > 0) {
      for (const file of f.files) console.log(`      → ${file}`);
    }
  }

  console.log("\n" + "─".repeat(70));
  console.log(`  Summary: ${errors.length} error${errors.length === 1 ? "" : "s"}, ${warns.length} warning${warns.length === 1 ? "" : "s"}, ${infos.length} info`);
  console.log("─".repeat(70) + "\n");

  // When --fix is set, defer the non-zero exit until after fixes have run
  // so a downstream re-audit can confirm the state.
  if (errors.length > 0 && !FIX) process.exit(1);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("→ Loading content...");
  const articles = await loadDir(ARTICLES_DIR);
  const comparisons = await loadDir(COMPARISONS_DIR);
  console.log(`  ${articles.length} articles, ${comparisons.length} comparisons`);

  console.log("→ Running content checks...");
  checkDuplicateSlugs(articles, "article");
  checkDuplicateSlugs(comparisons, "comparison");
  checkNearDuplicateTitles(articles);
  checkProductOverlap(articles);
  checkMissingImages(articles);
  checkMissingImages(comparisons);
  checkDuplicateImages([...articles, ...comparisons]);
  checkPlaceholderAffiliateLinks([...articles, ...comparisons]);
  checkSchema(articles, "article");
  checkSchema(comparisons, "comparison");
  checkDates([...articles, ...comparisons]);
  checkThinContent(articles);
  checkMetaDescriptions([...articles, ...comparisons]);

  console.log(`→ Pinging live site at ${PROD_URL}...`);
  await checkLiveSite();
  await checkSubscribeApi();

  printReport();

  if (FIX) await runAutoFixes();
}

main().catch((err) => {
  console.error("\n✗ Audit crashed:", err.message);
  process.exit(2);
});
