#!/usr/bin/env tsx
/**
 * Picks the next-best article topic(s) and writes them. Designed to run daily
 * via launchd at 8 AM. Each topic:
 *   - Doesn't duplicate any existing article (or any topic picked earlier in
 *     this same run — the script re-reads the directory between iterations)
 *   - Fills a sparse category if any exist
 *   - Targets a real-estate-tech keyword agents actually search for
 *
 * Default count: 3 articles per run (set KANZENAI_DAILY_COUNT env var to override).
 * Cost: ~$0.15 per article = ~$0.45 default daily run.
 *
 * The auto-deploy-watcher (separately installed) picks up the new JSON files
 * 2-3 minutes after the last write and ships them to production.
 *
 * Run manually:
 *   npm run auto-write           # 3 articles
 *   COUNT=1 npm run auto-write   # just one
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
  // Bot 11 · X Strategist may have a topic-emphasis steer in the live config.
  // Loaded lazily so a bad config never breaks the writer's main path.
  let emphasis = "";
  try {
    const { loadStrategy } = await import("../lib/x-strategy.js");
    emphasis = loadStrategy().topic_emphasis;
  } catch (e: any) {
    console.warn(`[daily-auto-write] strategy load failed (${e.message}) — no emphasis`);
  }

  const emphasisSection = emphasis
    ? `\n\nSTRATEGY EMPHASIS (from Bot 11, treat as a soft steer — don't break the other rules to satisfy it): ${emphasis}`
    : "";

  const system = `You suggest the next article for KanzenAI, an affiliate review site for AI-tool shoppers — solopreneurs, creators, and small businesses choosing AI software, productivity tools, and automation platforms. Pick a topic that:
1. Does NOT duplicate any topic already covered (titles given below)
2. Targets a real keyword that solopreneurs, creators, freelancers, indie hackers, or small-business owners would search (transactional intent preferred — "best X for Y", "X vs Y", "AI tool for Z")
3. Fills a sparse category if possible. Categories: AI Writing, AI Image/Video, AI Voice, AI Coding, Productivity, Automation, CRM, Marketing, Email, Scheduling, Analytics, No-Code, Content, Finance.
4. Names 3-5 REAL products that exist in the AI-tools / SaaS space (no fictional products). Examples to draw from: ChatGPT, Claude, Notion, Linear, Figma, Cursor, Webflow, ConvertKit, Zapier, Make, Loom, Descript, ElevenLabs, Gamma, Jasper, Copy.ai, Writesonic, Pictory, Synthesia, ClickUp, monday, Airtable, Calendly, Beehiiv, Manychat, etc. (Real-estate vertical tools are also OK if the topic naturally calls for them — but the default audience is the broader AI-tool shopper.)
5. Uses a distinctive, non-boilerplate title (not "Best X in 2026" — instead something like "X for Solopreneurs in 2026: A vs B vs C", "The Guide to X for Indie Builders", or "X for Creators Who Actually Ship", etc.)${emphasisSection}

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
// Calls write-article.ts via `node --import tsx` directly. Avoids the npm
// indirection so spawn works cleanly on Windows (npm shims as npm.cmd which
// makes spawn brittle without shell:true, and shell:true mangles args with
// spaces). Direct node spawn handles arg arrays correctly on all platforms.
async function runWriter(s: Suggestion): Promise<void> {
  const writerPath = join(ROOT, "scripts", "write-article.ts");
  const args = [
    "--env-file=.env.local",
    "--import",
    "tsx",
    writerPath,
    "--topic",
    s.topic,
    "--products",
    s.products.join(","),
    "--category",
    s.category,
    "--slug",
    s.slug,
  ];
  console.log(`\n→ Running: node ${args.slice(0, 4).join(" ")} [+ writer args]\n`);

  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, args, { cwd: ROOT, stdio: "inherit", env: process.env });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`writer exited ${code}`));
    });
    proc.on("error", reject);
  });
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const argCount = parseInt(
    process.argv.find((a) => a.startsWith("--count="))?.split("=")[1] ??
      process.env.COUNT ??
      process.env.KANZENAI_DAILY_COUNT ??
      "3",
    10,
  );
  const count = Math.max(1, Math.min(10, isNaN(argCount) ? 3 : argCount));

  console.log(`KanzenAI daily auto-write — ${new Date().toISOString()}`);
  console.log(`Target: ${count} article${count === 1 ? "" : "s"}\n`);

  let written = 0;
  let failed = 0;

  for (let i = 1; i <= count; i++) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  Article ${i} of ${count}`);
    console.log(`${"═".repeat(60)}\n`);

    try {
      console.log("→ Reading existing coverage (re-read each iteration)...");
      const coverage = await existingCoverage();
      console.log(`  ${coverage.split("\n").length} articles currently\n`);

      console.log("→ Asking Claude for the next topic...");
      const suggestion = await suggestTopic(coverage);
      console.log(`\n  Topic: ${suggestion.topic}`);
      console.log(`  Products: ${suggestion.products.join(", ")}`);
      console.log(`  Category: ${suggestion.category}`);
      console.log(`  Slug: ${suggestion.slug}`);
      console.log(`  Why: ${suggestion.rationale}\n`);

      await runWriter(suggestion);
      written++;
    } catch (err: any) {
      console.error(`\n✗ Article ${i} failed: ${err.message}`);
      failed++;
      // Continue with next article instead of aborting the whole run
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${written} written · ${failed} failed (of ${count} planned)`);
  console.log(`  Auto-deploy watcher will ship them within 2-3 min`);
  console.log(`${"─".repeat(60)}\n`);

  if (failed > 0 && written === 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n✗ Daily auto-write failed:", err.message);
  process.exit(1);
});
