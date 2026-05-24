import { readJSON, writeJSON } from "../../lib/storage";
import { ReviewMemoryStore, BuyerIntentPage } from "./schema";
import { today } from "../../lib/date";
import { computeAvgScore } from "./scoring";
import { write } from "../bot-21-memory-bot/index";

const MEMORY_FILE     = "review-comparison-memory.json";
const RUNS_FILE       = "review-comparison-runs.json";
const REVIEW_FILE     = "review-pages.json";
const COMPARISON_FILE = "comparison-pages.json";
const ALT_FILE        = "alternatives-pages.json";
const BEST_FILE       = "best-tools-pages.json";
const RANKINGS_FILE   = "product-rankings.json";
const FREE_FILE       = "free-tool-rankings.json";

const DEFAULT: ReviewMemoryStore = {
  last_run: "", total_runs: 0, all_pages: [],
  approved_pages: [], rejected_pages: [], avg_scores: [], prompt_version: 1,
};

export function loadMemory(): ReviewMemoryStore {
  return readJSON<ReviewMemoryStore>(MEMORY_FILE, DEFAULT);
}

export function saveMemory(m: ReviewMemoryStore): void {
  writeJSON(MEMORY_FILE, m);
}

export function updateMemory(m: ReviewMemoryStore, pages: BuyerIntentPage[], cycleScore: number): ReviewMemoryStore {
  const u = { ...m };
  u.last_run = today();
  u.total_runs += 1;
  u.avg_scores.push(cycleScore);
  if (u.avg_scores.length > 20) u.avg_scores = u.avg_scores.slice(-20);

  for (const p of pages) {
    if (!u.all_pages.includes(p.page_title)) u.all_pages.push(p.page_title);
    if (p.page_score >= 80 && !u.approved_pages.includes(p.page_title)) u.approved_pages.push(p.page_title);
  }
  if (u.all_pages.length > 300) u.all_pages = u.all_pages.slice(-300);

  // Persist by type
  const reviews     = pages.filter((p) => p.page_type === "single_review");
  const comparisons = pages.filter((p) => p.page_type === "comparison" || p.page_type === "multi_tool_comparison");
  const alts        = pages.filter((p) => p.page_type === "alternatives" || p.page_type === "free_alternative" || p.page_type === "cheaper_alternative");
  const best        = pages.filter((p) => p.page_type === "best_tools" || p.page_type === "best_free_tools" || p.page_type === "best_for_x");
  const free        = pages.filter((p) => p.free_first_analysis?.free_options_included);

  if (reviews.length)     writeJSON(REVIEW_FILE,     { pages: reviews,     updated: today() });
  if (comparisons.length) writeJSON(COMPARISON_FILE, { pages: comparisons, updated: today() });
  if (alts.length)        writeJSON(ALT_FILE,        { pages: alts,        updated: today() });
  if (best.length)        writeJSON(BEST_FILE,       { pages: best,        updated: today() });
  if (free.length)        writeJSON(FREE_FILE,       { pages: free,        updated: today() });

  return u;
}

export function getAvgScore(m: ReviewMemoryStore): number {
  return computeAvgScore(m.avg_scores.slice(-10));
}

export function savePageToMemoryBot(page: BuyerIntentPage): void {
  try {
    write({
      category: "Content Memory",
      title: page.page_title,
      content: `Type:${page.page_type} | Score:${page.page_score} | Keyword:"${page.primary_keyword}" | Free:${page.free_first_analysis.best_free_option || "none"} | Money:${page.money_analysis.why_this_can_generate_revenue}`,
      source_bot: "BOT-09",
      source_reference: "Review & Comparison Bot",
      related_keywords: page.secondary_keywords,
      related_entities: [page.page_type, ...page.memory_log.related_tools],
    });
  } catch (e) { /* Memory bot unavailable — continue */ }
}

export function appendRun(cycle: number, niche: string, score: number, pages: number): void {
  const runs = readJSON<{ runs: object[] }>(RUNS_FILE, { runs: [] });
  runs.runs.push({ cycle, date: today(), niche, score, pages });
  if (runs.runs.length > 100) runs.runs = runs.runs.slice(-100);
  writeJSON(RUNS_FILE, runs);
}
