#!/usr/bin/env tsx
/**
 * Picks the next-best article topic and writes it. Designed to run daily via
 * launchd at 8 AM. Picks a topic that:
 *   - Doesn't duplicate any existing article
 *   - Fills a sparse category if any exist
 *   - Targets a real-estate-tech keyword agents actually search for
 *
 * Then it runs the existing write-article.ts pipeline.
 *
 * The auto-deploy-watcher (separately installed) picks up the new JSON file
 * 2-3 minutes later and ships it to production.
 *
 * Run manually:
 *   npm run auto-write
 *
 * Schedule daily: install com.kanzenai.daily-article.plist
 */

import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

// ─── Env loader ─────────────────────────────────────────────────────────────
function loadEnv() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (v && !process.env[k]) process.env[k] = v;
  }
}
loadEnv();

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.KANZENAI_MODEL ?? "claude-sonnet-4-5-20250929";
const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");

if (!ANTHROPIC_KEY) {
  console.error("✗ ANTHROPIC_API_KEY missing in .env.local");
  process.exit(1);
}

// ─── Pull existing topics + product coverage ────────────────────────────────
async function existingCoverage(): Promise<string> {
  if (!existsSync(ARTICLES_DIR)) return "(no articles yet)";
  const files = (await readdir(ARTICLES_DIR)).filter((f) => f.endsWith(".json"));
  const lines: string[] = [];
  for (const f of files) {
    const j = JSON.parse(await readFile(join(ARTICLES_DIR, f), "utf8"));
    const products = (j.affiliateProducts ?? []).map((p: any) => p.name).join(", ");
    lines.push(`  · ${j.category ?? "?"} · ${j.title} (covers: ${products})`);
  }
  return lines.join("\n");
}

// ─── Ask Claude for next topic ──────────────────────────────────────────────
type Suggestion = {
  topic: string;
  products: string[];
  category: string;
  slug: string;
  rationale: string;
};

async function suggestTopic(coverage: string): Promise<Suggestion> {
  const system = `You suggest the next article for KanzenAI, an affiliate review site for working real estate agents. Pick a topic that:
1. Does NOT duplicate any topic already covered (titles given below)
2. Targets a real keyword real-estate agents would search (transactional intent preferred — "best X for Y", "X vs Y")
3. Fills a sparse category if possible. Categories: CRM, Lead Gen, AI Tools, Marketing, Phone & Calls, Scheduling, Invoicing, Inventory.
4. Names 3-5 REAL products that exist in the real-estate-tech space (no fictional products)
5. Uses a distinctive, non-boilerplate title (not "Best X for Real Estate Agents in 2026" — instead something like "Real Estate Y in 2026: A vs B vs C", or "The Guide to X for Working Agents", etc.)

Output STRICT JSON with this shape, no prose, no markdown fences:
{
  "topic": "string — full article title",
  "products": ["array", "of", "real", "product", "names"],
  "category": "exactly one of: CRM, Lead Gen, AI Tools, Marketing, Phone & Calls, Scheduling, Invoicing, Inventory",
  "slug": "lowercase-hyphenated-slug-no-special-chars",
  "rationale": "1 sentence why this fills a gap"
}`;

  const user = `Articles already published on KanzenAI:\n\n${coverage}\n\nSuggest the next one.`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Claude API ${r.status}: ${err.slice(0, 300)}`);
  }
  const data: { content: Array<{ type: string; text: string }> } = await r.json();
  const raw = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Extract JSON
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1) throw new Error("No JSON in Claude's response: " + raw.slice(0, 200));
  return JSON.parse(candidate.slice(start, end + 1));
}

// ─── Run the writer ─────────────────────────────────────────────────────────
async function runWriter(s: Suggestion): Promise<void> {
  const args = [
    "run",
    "write",
    "--",
    "--topic",
    s.topic,
    "--products",
    s.products.join(","),
    "--category",
    s.category,
    "--slug",
    s.slug,
  ];
  console.log(`\n→ Running: npm ${args.join(" ")}\n`);

  return new Promise((resolve, reject) => {
    const proc = spawn("npm", args, { cwd: ROOT, stdio: "inherit", env: process.env });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`writer exited ${code}`));
    });
    proc.on("error", reject);
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`KanzenAI daily auto-write — ${new Date().toISOString()}\n`);

  console.log("→ Reading existing coverage...");
  const coverage = await existingCoverage();
  console.log(`  ${coverage.split("\n").length} articles\n`);

  console.log("→ Asking Claude for the next topic...");
  const suggestion = await suggestTopic(coverage);
  console.log(`\n  Topic: ${suggestion.topic}`);
  console.log(`  Products: ${suggestion.products.join(", ")}`);
  console.log(`  Category: ${suggestion.category}`);
  console.log(`  Slug: ${suggestion.slug}`);
  console.log(`  Why: ${suggestion.rationale}\n`);

  await runWriter(suggestion);
  console.log(`\n✓ Done. Auto-deploy watcher will ship it within 2-3 min.\n`);
}

main().catch((err) => {
  console.error("\n✗ Daily auto-write failed:", err.message);
  process.exit(1);
});
