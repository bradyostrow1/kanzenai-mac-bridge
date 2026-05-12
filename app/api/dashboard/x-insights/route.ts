import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
const METRICS_PATH = join(AUDIT_DIR, "x-metrics.json");
const CACHE_PATH = join(AUDIT_DIR, "x-insights.json");

function loadEnv() {
  const p = join(ROOT, ".env.local");
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
loadEnv();

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are the X analytics analyst for KanzenAI — an affiliate review site for real estate agents.

Given recent tweets + their metrics (impressions, likes, URL clicks, profile clicks), you write a SHORT report that helps the founder figure out what's working.

Structure your output as 3 short sections:

## What's working
1-3 bullets. Specific tweets that outperformed (e.g., "Pricing-reveal posts get 4× more impressions than build-in-public posts").

## What's not
1-3 bullets. Specific patterns that underperform.

## Next 3 tweets to write
Specific, actionable. Build off what worked. Reference real data from the analytics you saw.

RULES:
- Be ruthless and specific. Cite actual numbers.
- No "great job, keep posting!" filler.
- If sample size is tiny (<5 tweets) say so explicitly and offer hypothesis only.
- 250 words max for the whole report.
- Use simple markdown (## headers, - bullets).`;

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;
  if (!ANTHROPIC_KEY) return NextResponse.json({ error: "ANTHROPIC_API_KEY missing" }, { status: 500 });
  if (!existsSync(METRICS_PATH)) {
    return NextResponse.json({ error: "No metrics yet — run npm run x-analytics first" }, { status: 400 });
  }

  // Cached if fresh (< 1h old)
  if (existsSync(CACHE_PATH)) {
    try {
      const cached = JSON.parse(await readFile(CACHE_PATH, "utf8"));
      if (cached.generatedAt && Date.now() - Date.parse(cached.generatedAt) < 60 * 60 * 1000) {
        return NextResponse.json({ ...cached, cached: true });
      }
    } catch { /* fall through and regenerate */ }
  }

  const metrics = JSON.parse(await readFile(METRICS_PATH, "utf8"));
  if (metrics.length === 0) {
    return NextResponse.json({ error: "No tweets to analyze" }, { status: 400 });
  }

  // Trim to top + bottom + recent (so Claude focuses on signal)
  const sortedByImp = [...metrics].sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0));
  const top = sortedByImp.slice(0, 5);
  const bottom = sortedByImp.slice(-3);
  const recent = [...metrics].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt)).slice(0, 5);
  const sample = [...new Map([...top, ...bottom, ...recent].map((m) => [m.tweetId, m])).values()];

  const userPrompt = `Total tweets in dataset: ${metrics.length}

Sample of tweets with metrics:
${sample.map((m) => `[${m.kind}${m.targetUser ? ` to @${m.targetUser}` : ""}] posted ${m.postedAt}
Text: ${m.text.slice(0, 200)}
→ ${m.impressions ?? "?"} impressions · ${m.likes} likes · ${m.replies} replies · ${m.retweets} RTs · ${m.urlClicks ?? "?"} url clicks · ${m.profileClicks ?? "?"} profile clicks
`).join("\n")}

Write the report.`;

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    return NextResponse.json({ error: `Anthropic ${resp.status}: ${txt.slice(0, 300)}` }, { status: 500 });
  }
  const data = await resp.json();
  const text: string = (data.content?.[0]?.text ?? "").trim();

  if (!existsSync(AUDIT_DIR)) await mkdir(AUDIT_DIR, { recursive: true });
  const out = {
    report: text,
    generatedAt: new Date().toISOString(),
    sampleSize: metrics.length,
  };
  await writeFile(CACHE_PATH, JSON.stringify(out, null, 2));

  return NextResponse.json({ ...out, cached: false });
}
