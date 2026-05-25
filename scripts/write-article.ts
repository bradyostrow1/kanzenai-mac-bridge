#!/usr/bin/env tsx
/**
 * KanzenAI article writer.
 *
 * Researches each product (vendor pricing page + G2 if findable), passes the
 * raw research to Claude with strict instructions to use only verified facts,
 * and writes a JSON file that the site picks up automatically.
 *
 * Usage:
 *   npm run write -- --topic "Best CRMs for real estate agents" \
 *     --products "Follow Up Boss,Lofty,kvCORE" \
 *     --category "CRM" \
 *     --slug "best-crms-real-estate-2026"
 *
 *   # Comparison mode (head-to-head, exactly 2 products):
 *   npm run write -- --mode compare \
 *     --topic "Mojo vs Vulcan7 for real estate prospecting" \
 *     --products "Mojo,Vulcan7" \
 *     --slug "mojo-vs-vulcan7-2026"
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Manually load .env.local — Node's --env-file flag won't override shell vars
// that are set-but-empty (Brady's shell exports an empty ANTHROPIC_API_KEY).
function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (val) process.env[key] = val;
  }
}
loadEnvFile(join(process.cwd(), ".env.local"));

// ─── Config ──────────────────────────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.KANZENAI_MODEL ?? "claude-sonnet-4-5-20250929";
const ROOT = process.cwd();
const ARTICLES_DIR = join(ROOT, "content", "articles");
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");

if (!ANTHROPIC_KEY) {
  console.error("✗ Missing ANTHROPIC_API_KEY. Add it to .env.local and run:");
  console.error("    node --env-file=.env.local --import tsx scripts/write-article.ts ...");
  console.error("  or use: npm run write -- ...");
  process.exit(1);
}

// ─── CLI args ────────────────────────────────────────────────────────────────
type Args = {
  mode: "review" | "compare" | "tutorial";
  topic: string;
  products: string[];
  category?: string;
  slug?: string;
  headerImage?: string;
};

function parseArgs(argv: string[]): Args {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  if (!args.topic) throw new Error("--topic is required");

  const mode = (
    args.mode === "compare" ? "compare" :
    args.mode === "tutorial" ? "tutorial" :
    "review"
  ) as Args["mode"];

  // Tutorial mode needs exactly 1 tool; review/compare need 2+
  if (!args.products) throw new Error("--products is required (comma-separated; tutorial uses just one)");
  const products = args.products.split(",").map((p) => p.trim()).filter(Boolean);

  if (mode === "tutorial") {
    if (products.length !== 1) {
      throw new Error("Tutorial mode requires exactly 1 product (the tool being taught)");
    }
  } else {
    if (products.length < 2) throw new Error("Need at least 2 products");
    if (mode === "compare" && products.length !== 2) {
      throw new Error("Comparison mode requires exactly 2 products");
    }
  }

  return {
    mode,
    topic: args.topic,
    products,
    category: args.category,
    slug: args.slug ?? slugify(args.topic),
    headerImage: args["header-image"],
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

// ─── Research: fetch vendor page + summarize ─────────────────────────────────
async function fetchPage(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!r.ok) return "";
    const html = await r.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);
  } catch {
    return "";
  }
}

async function research(productName: string): Promise<string> {
  const slug = productName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/inc|llc|co/g, "");
  const candidates = [
    `https://www.${slug}.com/pricing`,
    `https://www.${slug}.com/pricing/`,
    `https://${slug}.com/pricing`,
    `https://www.${slug}.com/plans`,
    `https://www.${slug}.com/`,
    `https://${slug}.com/`,
  ];
  for (const url of candidates) {
    const text = await fetchPage(url);
    if (text.length > 500) {
      return `Source: ${url}\n\n${text}`;
    }
  }
  return `(No vendor page reachable for ${productName} — pricing should be flagged as "see vendor" in the article.)`;
}

// ─── Claude call ─────────────────────────────────────────────────────────────
async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Anthropic API ${r.status}: ${errText.slice(0, 500)}`);
  }
  const data: { content: Array<{ type: string; text: string }> } = await r.json();
  const text = data.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("");
  return text;
}

function extractJson(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in Claude's response");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// ─── Prompts ─────────────────────────────────────────────────────────────────
const SYSTEM_HONESTY = `You are an editorial writer for KanzenAI, an independent affiliate review site for AI-tool shoppers — solopreneurs, creators, and small businesses choosing AI software, productivity tools, and automation platforms. KanzenAI is FTC-compliant; every claim must be substantiated.

ABSOLUTE PROHIBITIONS — these would create FTC liability and destroy reader trust:
1. NEVER fabricate testing methodology. FORBIDDEN phrases include but are not limited to:
   • "we tested X agents" / "we worked with N agents"
   • "we made N calls" / "we ran N closings" / "we placed N transactions"
   • "we built N demo sites" / "we measured N visitors"
   • "we ran $X in Facebook Ads"
   • Any specific count of personal-test events ("327 transactions", "23 active agents", "1,847 calls", "8 closings", "5 demo sites")
   • Invented persona case studies ("Maria, top-25% agent in Tampa with 36 transactions")
   • Claimed conversion rates from your own tests ("7.1% registration rate", "4.2% conversion")
2. NEVER invent pricing, feature claims, or integration claims not present in the research bundle.
3. NEVER claim ratings/scores as if measured ("scored 4.8 in our test"). Vendor-published ratings are OK if cited as such.

REQUIRED PATTERN — use research-grounded language:
• "Vendor pricing pages list $X/mo for plan Y"
• "According to [vendor]'s integration page, the platform supports..."
• "Public reviews on G2 / Capterra cite..."
• "Per the vendor's feature list..."
• If something is unknown: "Pricing is not published; contact vendor for quote."

VOICE:
• Terse, evidence-first — NYT/Wirecutter editorial style
• Conclusions first, then evidence
• Short sentences
• Surface key tradeoffs explicitly
• No em-dashes, no "delve", no "in conclusion", no "trusted partner", no "industry-leading"

TITLE DISTINCTIVENESS:
• Avoid "Best [X] in 2026" boilerplate — Google penalizes near-duplicate titles in the same site.
• Use a distinctive angle: a hook, a comparator, a year + qualifier, or a benefit-led phrase.
• Examples of good titles: "AI Writing Tools in 2026: Pricing, Trade-offs, and Who Wins", "The 2026 Solopreneur AI Stack: What's Actually Worth Paying For", "No-Code Automation in 2026: Zapier vs Make vs n8n", "AI Coding Assistants for Indie Builders: Cursor vs Copilot vs Cline".
• Bad (boilerplate) titles: "Best AI Tool in 2026", "Best Productivity Software in 2026", "Best SaaS Tools in 2026" — these are interchangeable and lose CTR.

OUTPUT:
• Valid JSON only, no prose outside, no markdown fences
• Pricing quoted EXACTLY as found in research (e.g. "$69/mo Grow plan, $499/mo Pro for up to 10 users")
• Affiliate URLs use placeholder format: https://[vendor-domain]/?ref=kanzenai
• publishedAt and updatedAt = the date provided in the user prompt`;

const REVIEW_SCHEMA = `{
  "slug": "string",
  "title": "string",
  "description": "string (under 160 chars, hooky)",
  "category": "string (use the category provided)",
  "publishedAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD",
  "readMinutes": number,
  "tldr": "string (2-3 sentences, conclusions first)",
  "body": [
    {"type": "p", "text": "string"},
    {"type": "h2", "text": "string", "id": "anchor-slug"},
    {"type": "h3", "text": "string", "id": "anchor-slug"},
    {"type": "ul", "items": ["string"]},
    {"type": "callout", "variant": "tip|warn|info", "title": "string", "text": "string"},
    {"type": "product", "name": "string", "price": "string", "rating": number, "pros": ["string"], "cons": ["string"], "cta": {"label": "string", "url": "string"}},
    {"type": "cta", "label": "string", "url": "string"}
  ],
  "affiliateProducts": [{"name": "string", "url": "string", "commission": "string (best estimate or 'varies')"}],
  "headerImage": "/articles/<filename>.jpg — pick a unique one from the pool. The dedup-images script will reassign automatically if you collide with another article, but try to fit thematically. Available pool includes: hero-living-pink, hero-marble-modern, hero-living-chandelier, hero-kitchen-luxury, hero-kitchen-marble, hero-kitchen-modern, hero-kitchen-warm, hero-kitchen-bright, hero-toronto-house, hero-contemporary-driveway, hero-suburban-facade, hero-minimalist-home, hero-mosaic-fountain, hero-marble-sophisticated, hero-document-review, hero-model-houses-keys, interior-warm, ai-workflow-hero, crm-hero, leadgen-hero, compare-hero. Pick whatever fits — duplicates will be auto-resolved.",
  "imageCredit": "Pexels"
}`;

const COMPARE_SCHEMA = `{
  "slug": "string",
  "title": "string",
  "description": "string (under 160 chars)",
  "publishedAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD",
  "intro": "string (1 paragraph framing the head-to-head)",
  "verdict": "string (1-2 sentences naming the winner per use case)",
  "contenders": [
    {"name": "string", "affiliateUrl": "string", "startingPrice": "string", "rating": number, "bestFor": "string", "pros": ["string"], "cons": ["string"]},
    {"name": "string", "affiliateUrl": "string", "startingPrice": "string", "rating": number, "bestFor": "string", "pros": ["string"], "cons": ["string"]}
  ],
  "headerImage": "/articles/compare-hero.jpg",
  "imageCredit": "Unsplash"
}`;

// Tutorial uses the same Article JSON shape as reviews (so the existing
// /articles/[slug] route renders it cleanly), but composes the body as a
// step-by-step guide using ordered-list + h2/h3/callout blocks. One product
// (the tool the tutorial teaches) appears at the end as a product block.
const TUTORIAL_SCHEMA = `{
  "slug": "string",
  "title": "string (Format: 'How to [Verb] [Thing] with [Tool]: Step-by-Step Guide')",
  "description": "string (under 160 chars, must mention 'step-by-step')",
  "category": "Tutorials",
  "publishedAt": "YYYY-MM-DD",
  "updatedAt": "YYYY-MM-DD",
  "readMinutes": number,
  "tldr": "string (2-3 sentences: what the reader will accomplish + ballpark time)",
  "body": [
    {"type": "p", "text": "Hook paragraph: what we're building/doing, who it's for, why it matters"},
    {"type": "h2", "text": "What you'll need", "id": "prereqs"},
    {"type": "ul", "items": ["Required item or account (with version/tier where relevant)", "Another prereq", "..."]},
    {"type": "callout", "variant": "info", "title": "Time + cost", "text": "Roughly X minutes; cost: free / $X one-time / $Y/mo"},
    {"type": "h2", "text": "Step 1 — [Action]", "id": "step-1"},
    {"type": "p", "text": "What this step accomplishes + the explicit click-by-click instructions. Include exact menu names, button labels, and field values where applicable."},
    {"type": "h2", "text": "Step 2 — [Action]", "id": "step-2"},
    {"type": "p", "text": "..."},
    {"type": "h2", "text": "Step 3 — [Action]", "id": "step-3"},
    {"type": "p", "text": "..."},
    {"type": "callout", "variant": "tip", "title": "Pro tip", "text": "An optional speed-up or quality-improvement readers can apply."},
    {"type": "h2", "text": "If something breaks", "id": "troubleshoot"},
    {"type": "ul", "items": ["Symptom: [error] → Fix: [solution]", "Symptom: [...] → Fix: [...]", "Symptom: [...] → Fix: [...]"]},
    {"type": "h2", "text": "What to do next", "id": "next"},
    {"type": "p", "text": "1-paragraph bridge to the next thing the reader should try, with a link to a related tool or article if relevant."},
    {"type": "product", "name": "string (the ONE tool taught)", "price": "string", "rating": number, "pros": ["string"], "cons": ["string"], "cta": {"label": "Try [Tool]", "url": "https://[vendor]/?ref=kanzenai"}}
  ],
  "affiliateProducts": [{"name": "string", "url": "string", "commission": "string"}],
  "headerImage": "/articles/<slug>-hero.jpg",
  "imageCredit": "Pexels"
}`;

function buildUserPrompt(args: Args, researchBundle: Record<string, string>, today: string): string {
  const research = Object.entries(researchBundle)
    .map(([name, text]) => `### ${name}\n${text}`)
    .join("\n\n---\n\n");

  const schema =
    args.mode === "compare" ? COMPARE_SCHEMA :
    args.mode === "tutorial" ? TUTORIAL_SCHEMA :
    REVIEW_SCHEMA;

  const modeNote =
    args.mode === "compare"
      ? "Mode: head-to-head COMPARISON of exactly 2 products. Output the comparison schema below."
      : args.mode === "tutorial"
      ? `Mode: STEP-BY-STEP TUTORIAL teaching the reader how to do ONE specific thing with ONE specific tool. The reader's goal is to FOLLOW the steps and reach a working outcome at the end. NOT a review, NOT a comparison — purely instructional. Voice: warm, plain-English, second-person ('you'). Each step is a discrete action a reader can complete before moving to the next. Include exact UI labels, button names, file paths, command lines, and field values where applicable. Use callouts for time-and-cost up front and for pro tips. Include a "If something breaks" section with common symptoms → fixes. End with a "What to do next" bridge.`
      : "Mode: ROUND-UP REVIEW article covering the products. Body should include an intro paragraph, a 'How we approached this' h2, one h2 per product (with a product block inside), a 'Verdict' h2 with bullet recommendations by use case, and optionally a 'What we'd skip' h2.";

  return `${modeNote}

Topic: ${args.topic}
${args.category ? `Category: ${args.category}` : ""}
Slug: ${args.slug}
Today's date: ${today}
${args.mode === "tutorial" ? `Tool being taught: ${args.products[0]}` : `Products to cover: ${args.products.join(", ")}`}

Use the research bundle below as your ONLY source of facts. If something isn't in here, omit it or note uncertainty.

═══════════════ RESEARCH BUNDLE ═══════════════
${research}
═══════════════════════════════════════════════

Output valid JSON matching this schema (no prose outside the JSON, no markdown fences):

${schema}

For affiliate URLs, use the format: https://[vendor-domain]/?ref=kanzenai

${args.mode === "tutorial"
    ? "For the tutorial, body MUST include 12-20 blocks: opening hook paragraph, 'What you'll need' h2 + ul, time+cost callout, 4-7 step h2 sections (each with explanatory paragraph(s)), one pro-tip callout, 'If something breaks' h2 + ul, 'What to do next' h2 + paragraph, and a final product block for the tool taught. Number the steps in the h2 text ('Step 1 — [Action]', 'Step 2 — [Action]', etc.)."
    : "For the round-up review, the body MUST include between 8-15 blocks total: opening paragraph, 1-2 setup h2 sections, one h2-and-product block per product, a verdict h2 with ul list, and a what-we-skip h2 with ul list."}

Return ONLY the JSON.`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv.slice(2));
  const today = new Date().toISOString().slice(0, 10);

  console.log(`\n→ Mode: ${args.mode}`);
  console.log(`→ Topic: ${args.topic}`);
  console.log(`→ Products: ${args.products.join(", ")}`);
  console.log(`→ Slug: ${args.slug}`);
  console.log(`→ Date: ${today}\n`);

  console.log("→ Researching products...");
  const researchBundle: Record<string, string> = {};
  for (const product of args.products) {
    process.stdout.write(`  · ${product} ... `);
    const text = await research(product);
    researchBundle[product] = text;
    console.log(text.startsWith("(No") ? "no page found" : `${text.length} chars`);
  }

  console.log("\n→ Writing article with Claude...");
  const userPrompt = buildUserPrompt(args, researchBundle, today);
  const raw = await callClaude(SYSTEM_HONESTY, userPrompt);

  const json = extractJson(raw) as Record<string, unknown>;

  // Force the date and slug to match what we asked for
  json.publishedAt = today;
  json.updatedAt = today;
  json.slug = args.slug;

  // Tag the niche. New content from this writer targets the broader AI-tool
  // shopper audience by default (per the 2026-05-24 KanzenAI pivot). To
  // explicitly write a real-estate-vertical article, set NICHE=real-estate.
  // Existing 30 articles published before the pivot have no niche field and
  // lib/articles.ts treats them as niche: "real-estate".
  json.niche = process.env.NICHE || "ai-tools";

  // Hero image selection — delegated to lib/images.ts (Bot 12 territory).
  // Same Pexels-first, on-disk-pool-fallback behavior as before; the library
  // also has slots for an owned image-gen adapter (Nano Banana / fal / etc.)
  // once Brady wires one in. See scripts/specs/bot-12-image-producer.md.
  const { generateHero } = await import("../lib/images.js");
  const title = typeof json.title === "string" ? json.title : args.topic;
  const heroResult = await generateHero({
    slug: args.slug ?? slugify(args.topic),
    title,
    category: typeof json.category === "string" ? json.category : undefined,
    keywords: Array.isArray((json as any).affiliateProducts)
      ? ((json as any).affiliateProducts as Array<{ name?: string }>).map((p) => p?.name).filter((x): x is string => !!x)
      : undefined,
  });
  if (heroResult) {
    json.headerImage = heroResult.publicPath;
    if (heroResult.credit) json.imageCredit = heroResult.credit;
  } else {
    console.log(`  ⚠️  Hero generation failed across all adapters. Will trip audit.`);
  }

  const dir = args.mode === "compare" ? COMPARISONS_DIR : ARTICLES_DIR;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${args.slug}.json`);

  if (existsSync(outPath)) {
    console.log(`\n⚠️  ${outPath} already exists — overwriting`);
  }

  writeFileSync(outPath, JSON.stringify(json, null, 2) + "\n");
  console.log(`\n✓ Wrote ${outPath}`);
  console.log(`  Title: ${json.title}`);
  console.log(`  Visit: http://localhost:5050/${args.mode === "compare" ? "compare" : "articles"}/${args.slug}\n`);
}

main().catch((err) => {
  console.error("\n✗ Failed:", err.message);
  process.exit(1);
});
