import { readJSON, writeJSON } from "../../lib/storage";
import { ContentBriefMemoryStore, ContentBrief } from "./schema";
import { today } from "../../lib/date";
import { computeAvgScore } from "./scoring";
import { write } from "../bot-21-memory-bot/index";

const MEMORY_FILE   = "content-brief-memory.json";
const RUNS_FILE     = "content-brief-runs.json";
const BRIEFS_FILE   = "content-briefs.json";
const PRIORITY_FILE = "content-priority.json";

const DEFAULT: ContentBriefMemoryStore = {
  last_run: "", total_runs: 0, all_briefs: [],
  published_briefs: [], rejected_briefs: [], avg_scores: [], prompt_version: 1,
};

export function loadMemory(): ContentBriefMemoryStore {
  return readJSON<ContentBriefMemoryStore>(MEMORY_FILE, DEFAULT);
}

export function saveMemory(m: ContentBriefMemoryStore): void {
  writeJSON(MEMORY_FILE, m);
}

export function updateMemory(m: ContentBriefMemoryStore, briefs: ContentBrief[], cycleScore: number): ContentBriefMemoryStore {
  const u = { ...m };
  u.last_run = today();
  u.total_runs += 1;
  u.avg_scores.push(cycleScore);
  if (u.avg_scores.length > 20) u.avg_scores = u.avg_scores.slice(-20);

  for (const b of briefs) {
    if (!u.all_briefs.includes(b.title)) u.all_briefs.push(b.title);
  }
  if (u.all_briefs.length > 200) u.all_briefs = u.all_briefs.slice(-200);

  // Persist approved briefs and priority order
  writeJSON(BRIEFS_FILE, { briefs: briefs.filter((b) => b.brief_score >= 70), updated: today() });

  return u;
}

export function getAvgScore(m: ContentBriefMemoryStore): number {
  return computeAvgScore(m.avg_scores.slice(-10));
}

export function saveBriefToMemoryBot(brief: ContentBrief): void {
  try {
    write({
      category: "Content Memory",
      title: brief.title,
      content: `Score:${brief.brief_score} | Type:${brief.content_type} | Keyword:"${brief.primary_keyword}" | Money:${brief.money_analysis.why_this_can_generate_revenue}`,
      source_bot: "BOT-07",
      source_reference: "Content Brief Bot",
      related_keywords: brief.secondary_keywords,
      related_entities: [brief.content_type, brief.search_intent],
    });
  } catch (e) { /* Memory bot unavailable — continue */ }
}

export function appendRun(cycle: number, niche: string, score: number, briefs: number): void {
  const runs = readJSON<{ runs: object[] }>(RUNS_FILE, { runs: [] });
  runs.runs.push({ cycle, date: today(), niche, score, briefs });
  if (runs.runs.length > 100) runs.runs = runs.runs.slice(-100);
  writeJSON(RUNS_FILE, runs);
}
