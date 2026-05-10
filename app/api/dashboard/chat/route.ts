import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

export const maxDuration = 600;

// ─── env loader (same trick as scripts/write-article.ts) ────────────────────
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
const COMPARISONS_DIR = join(ROOT, "content", "comparisons");
const AUDIT_DIR = join(ROOT, ".audit");

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

// ─── Persona ────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Kanzen, the operations bot for KanzenAI — Brady Ostrow's affiliate review site for real estate agents at https://kanzenai.com.

You manage:
- Article writing pipeline (Claude-powered, ~$0.15/article, takes 30-60s)
- Daily audit (11 checks across content + production)
- Production health monitoring (kanzenai.com on Vercel)
- Deployment to Vercel

When Brady asks something, decide which tool(s) to call, execute, then report. Be terse — match Brady's style.

VOICE:
- Conclusions first, then evidence
- Short sentences
- No emojis unless he uses them first
- No "happy to help" or "I'd be glad to" filler
- State what you did, what happened, what's next
- If something failed, say exactly what failed

WHEN TO USE TOOLS:
- "run audit", "any issues", "is the site clean" → run_audit
- "stats", "how's the site doing" → get_site_stats
- "write [topic]", "new article on X", "make me one about Y" → write_article (clarify if vague)
- "deploy", "push live", "ship it" → deploy_to_production (only after content changes)
- Recent uptime/health questions → read_recent_audit

CLARIFICATION:
If Brady asks for an article without specifying products, ask which products he wants covered. Don't invent products. Suggest 3-5 candidates from the real-estate-tech space if he wants ideas.

DEPLOY DISCIPLINE:
Don't deploy unless he explicitly asks OR he just wrote new content and asks to ship it. Auto-deploys on every change burn build minutes.`;

// ─── Tool definitions sent to Claude ────────────────────────────────────────
const TOOLS = [
  {
    name: "get_site_stats",
    description: "Get current state of KanzenAI: article count, total words, comparison count, audit status, production health, placeholder affiliate links remaining. Use when Brady asks 'how's the site' or wants an overview.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "run_audit",
    description: "Run the full daily audit: 11 checks (duplicate slugs, near-duplicate titles, product overlap, missing/duplicate images, schema gaps, dates, thin content, meta descriptions, live site routes, subscribe API, placeholder URLs). Returns findings grouped by severity. Takes ~5-10s.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "write_article",
    description: "Generate a new article using Claude + web research. Cost ~$0.15. Takes 30-60s. Outputs JSON file the live site picks up. Two modes: 'review' (round-up of N products) or 'compare' (head-to-head, exactly 2 products).",
    input_schema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Article topic, e.g. 'Best CRMs for real estate teams in 2026'" },
        products: { type: "string", description: "Comma-separated product names, e.g. 'Follow Up Boss,Lofty,kvCORE'" },
        category: {
          type: "string",
          enum: ["CRM", "Lead Gen", "AI Tools", "Marketing", "Phone & Calls", "Scheduling", "Invoicing", "Inventory"],
          description: "Category for the article (review mode only)",
        },
        mode: {
          type: "string",
          enum: ["review", "compare"],
          description: "review = roundup (3-5 products), compare = head-to-head (exactly 2 products)",
        },
        slug: { type: "string", description: "Optional URL slug; auto-generated if omitted" },
      },
      required: ["topic", "products"],
    },
  },
  {
    name: "deploy_to_production",
    description: "Deploy current state to kanzenai.com via Vercel. ~30-45s. Only call when Brady explicitly asks to deploy, or right after writing new content if he confirms.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_recent_audit",
    description: "Read the most recent audit log file from .audit/. Use when Brady asks about past audit results.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "read_health_log",
    description: "Read the last N entries from the health check log (.audit/health.log). Use when Brady asks about uptime, recent outages, response times.",
    input_schema: {
      type: "object",
      properties: {
        lines: { type: "number", description: "Number of recent log lines to return (default 50)" },
      },
      required: [],
    },
  },
  {
    name: "read_clicks",
    description: "Read affiliate click tracking data (from /go/<vendor> redirects). Returns total clicks, top vendors by click count, top articles driving clicks, and recent click events. Use when Brady asks 'what's getting clicked', 'which products are popular', 'click stats', 'affiliate performance'.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
] as const;

// ─── Tool implementations ───────────────────────────────────────────────────
type ToolName = (typeof TOOLS)[number]["name"];

async function execTool(name: ToolName, input: any): Promise<string> {
  switch (name) {
    case "get_site_stats":
      return await toolGetStats();
    case "run_audit":
      return await toolRunAudit();
    case "write_article":
      return await toolWriteArticle(input);
    case "deploy_to_production":
      return await toolDeploy();
    case "read_recent_audit":
      return await toolReadAudit();
    case "read_health_log":
      return await toolReadHealth(input?.lines ?? 50);
    case "read_clicks":
      return await toolReadClicks();
    default:
      return `Unknown tool: ${name}`;
  }
}

async function loadJsonDir(dir: string) {
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  return Promise.all(
    files.map(async (f) => {
      try {
        return JSON.parse(await readFile(join(dir, f), "utf8"));
      } catch {
        return null;
      }
    }),
  ).then((r) => r.filter(Boolean));
}

function wordCount(json: any): number {
  let n = 0;
  const walk = (s: any) => {
    if (typeof s === "string") n += s.trim().split(/\s+/).filter(Boolean).length;
    else if (Array.isArray(s)) s.forEach(walk);
    else if (s && typeof s === "object") Object.values(s).forEach(walk);
  };
  walk(json);
  return n;
}

async function toolGetStats(): Promise<string> {
  const articles = await loadJsonDir(ARTICLES_DIR);
  const comparisons = await loadJsonDir(COMPARISONS_DIR);
  const totalWords = articles.reduce((s, a) => s + wordCount(a), 0);
  const placeholders = [...articles, ...comparisons].reduce((s, a) => {
    const m = JSON.stringify(a).match(/\?ref=kanzenai/g);
    return s + (m?.length ?? 0);
  }, 0);

  let prodLine = "production: unknown";
  try {
    const start = Date.now();
    const r = await fetch("https://kanzenai.com", { method: "HEAD" });
    prodLine = `production: ${r.ok ? "live" : "DOWN"} · ${r.status} · ${Date.now() - start}ms`;
  } catch (e: any) {
    prodLine = `production: UNREACHABLE (${e.message})`;
  }

  const recent = articles
    .map((a) => ({ slug: a.slug, title: a.title, publishedAt: a.publishedAt }))
    .sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? ""))
    .slice(0, 5);

  return `Articles: ${articles.length} (${totalWords.toLocaleString()} words total)
Comparisons: ${comparisons.length}
Placeholder affiliate URLs: ${placeholders} (still using ?ref=kanzenai — need real codes)
${prodLine}

Most recent articles:
${recent.map((r) => `  · ${r.title} (${r.publishedAt})`).join("\n")}`;
}

async function spawnAndCapture(cmd: string, args: string[], timeoutMs = 600_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { cwd: ROOT, env: process.env });
    let out = "";
    let err = "";
    const timer = setTimeout(() => proc.kill("SIGKILL"), timeoutMs);
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out, err });
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: e.message });
    });
  });
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

async function toolRunAudit(): Promise<string> {
  const r = await spawnAndCapture("npm", ["run", "audit"], 60_000);
  return `Exit code: ${r.code}\n\n${stripAnsi(r.out).slice(-3000)}`;
}

async function toolWriteArticle(input: any): Promise<string> {
  const { topic, products, category, mode, slug } = input ?? {};
  if (!topic || !products) return "Error: 'topic' and 'products' are required.";
  const args = ["run", "write", "--", "--topic", topic, "--products", products];
  if (category) args.push("--category", category);
  if (slug) args.push("--slug", slug);
  if (mode === "compare") args.push("--mode", "compare");

  const r = await spawnAndCapture("npm", args, 300_000);
  if (r.code === 0) {
    const slugMatch = r.out.match(/Wrote .+\/([\w-]+)\.json/);
    return `Article written successfully.\n\n${r.out.slice(-1500)}\n\nSlug: ${slugMatch?.[1] ?? "(unknown)"}\nNot deployed yet — call deploy_to_production if Brady wants it live.`;
  }
  return `Article generation FAILED (exit ${r.code}):\n${r.err.slice(-1500)}\n${r.out.slice(-1500)}`;
}

async function toolDeploy(): Promise<string> {
  const r = await spawnAndCapture("npx", ["vercel", "deploy", "--prod", "--yes"], 300_000);
  if (r.code === 0) {
    const urlMatch = r.out.match(/https:\/\/kanzenai-[\w-]+\.vercel\.app/);
    return `Deployed.\n${urlMatch ? `Preview URL: ${urlMatch[0]}` : ""}\nLive at https://kanzenai.com`;
  }
  return `Deploy FAILED (exit ${r.code}):\n${r.err.slice(-1500)}`;
}

async function toolReadAudit(): Promise<string> {
  if (!existsSync(AUDIT_DIR)) return "No audit logs yet. Run audit first.";
  const files = (await readdir(AUDIT_DIR)).filter((f) => f.startsWith("audit-") && f.endsWith(".log")).sort().reverse();
  if (files.length === 0) return "No audit logs yet. Run audit first.";
  const text = await readFile(join(AUDIT_DIR, files[0]), "utf8");
  return `Latest audit log: ${files[0]}\n\n${stripAnsi(text).slice(-3000)}`;
}

async function toolReadClicks(): Promise<string> {
  const path = join(AUDIT_DIR, "clicks.log");
  if (!existsSync(path)) return "No click data yet. The /go/<vendor> redirects log here, but only after someone actually clicks an affiliate link on the site.";
  const text = await readFile(path, "utf8");
  const lines = text.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return "Click log file exists but is empty.";

  const events = lines.map((l) => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  const byVendor = new Map<string, { name: string; count: number }>();
  const byArticle = new Map<string, number>();
  for (const e of events) {
    const v = byVendor.get(e.vendor) ?? { name: e.name, count: 0 };
    v.count++;
    byVendor.set(e.vendor, v);
    if (e.article) byArticle.set(e.article, (byArticle.get(e.article) ?? 0) + 1);
  }

  const topVendors = [...byVendor.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
  const topArticles = [...byArticle.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return `Total clicks: ${events.length}

Top vendors:
${topVendors.map(([slug, v]) => `  ${v.count.toString().padStart(4)} · ${v.name} (${slug})`).join("\n")}

Top articles driving clicks:
${topArticles.length > 0 ? topArticles.map(([a, n]) => `  ${n.toString().padStart(4)} · /${a}`).join("\n") : "  (none yet)"}

Most recent: ${events[events.length - 1]?.ts}`;
}

async function toolReadHealth(lines: number): Promise<string> {
  const path = join(AUDIT_DIR, "health.log");
  if (!existsSync(path)) return "No health log yet. Install com.kanzenai.healthcheck.plist to start uptime monitoring.";
  const text = await readFile(path, "utf8");
  const all = text.trim().split("\n");
  const recent = all.slice(-Math.max(1, Math.min(lines, 200)));
  return `Last ${recent.length} health checks (of ${all.length} total):\n${recent.join("\n")}`;
}

// ─── Anthropic call loop ────────────────────────────────────────────────────
type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string };

type Message = { role: "user" | "assistant"; content: string | ContentBlock[] };

async function callClaude(messages: Message[]): Promise<{ content: ContentBlock[]; stop_reason: string }> {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Anthropic ${r.status}: ${t.slice(0, 500)}`);
  }
  return r.json();
}

export async function POST(req: Request) {
  const guard = devGuard();
  if (guard) return guard;
  if (!ANTHROPIC_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set in .env.local" }, { status: 500 });
  }

  const body = await req.json();
  const incoming: Message[] = body.messages ?? [];
  if (incoming.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  const messages = [...incoming];
  const newMessages: Message[] = [];
  const toolEvents: Array<{ name: string; input: any; output: string; ms: number }> = [];

  // Loop: call Claude, execute any tools, repeat until end_turn
  for (let step = 0; step < 8; step++) {
    const resp = await callClaude(messages);
    const assistantMsg: Message = { role: "assistant", content: resp.content };
    messages.push(assistantMsg);
    newMessages.push(assistantMsg);

    if (resp.stop_reason === "end_turn" || resp.stop_reason === "stop_sequence") break;

    if (resp.stop_reason === "tool_use") {
      const toolUses = resp.content.filter((c): c is Extract<ContentBlock, { type: "tool_use" }> => c.type === "tool_use");
      const toolResults: ContentBlock[] = [];
      for (const tool of toolUses) {
        const start = Date.now();
        const output = await execTool(tool.name as ToolName, tool.input);
        toolEvents.push({ name: tool.name, input: tool.input, output, ms: Date.now() - start });
        toolResults.push({
          type: "tool_result",
          tool_use_id: tool.id,
          content: output,
        });
      }
      const userMsg: Message = { role: "user", content: toolResults };
      messages.push(userMsg);
      newMessages.push(userMsg);
      continue;
    }

    break;
  }

  return NextResponse.json({ messages: newMessages, toolEvents });
}
