import { readJSON, writeJSON } from "../../lib/storage";
import { CommunityMemoryStore, CommunityInsight, CommunityContentOpportunity, CommunityDistributionOpportunity } from "./schema";
import { today } from "../../lib/date";
import { computeAvgScore } from "./scoring";
import { write } from "../bot-21-memory-bot/index";

const MEMORY_FILE = "community-intelligence-memory.json";
const RUNS_FILE   = "community-intelligence-runs.json";
const INSIGHTS_F  = "community-insights.json";
const SOURCES_F   = "community-sources.json";
const RULES_F     = "community-rules.json";
const OPPS_F      = "community-opportunities.json";
const SIGNALS_F   = "public-discussion-signals.json";

const DEFAULT: CommunityMemoryStore = {
  last_run: "", total_runs: 0, known_sources: [], tracked_questions: [],
  tracked_pains: [], high_value_insights: [], avg_scores: [], prompt_version: 1,
};

export function loadMemory(): CommunityMemoryStore { return readJSON<CommunityMemoryStore>(MEMORY_FILE, DEFAULT); }
export function saveMemory(m: CommunityMemoryStore): void { writeJSON(MEMORY_FILE, m); }

export function updateMemory(m: CommunityMemoryStore, insights: CommunityInsight[], opps: CommunityContentOpportunity[], score: number): CommunityMemoryStore {
  const u = { ...m }; u.last_run = today(); u.total_runs++; u.avg_scores.push(score);
  if (u.avg_scores.length > 20) u.avg_scores = u.avg_scores.slice(-20);

  for (const i of insights) {
    if (!u.known_sources.includes(i.source_platform)) u.known_sources.push(i.source_platform);
    if (i.insight_score >= 80 && !u.high_value_insights.includes(i.insight_title)) u.high_value_insights.push(i.insight_title);
    i.voice_of_customer.common_questions.forEach(q => { if (!u.tracked_questions.includes(q)) u.tracked_questions.push(q); });
    if ((i.insight_type === "Pain Signal" || i.insight_type === "Product Complaint") && !u.tracked_pains.includes(i.insight_title)) u.tracked_pains.push(i.insight_title);
  }
  if (u.high_value_insights.length > 100) u.high_value_insights = u.high_value_insights.slice(-100);
  if (u.tracked_questions.length > 200) u.tracked_questions = u.tracked_questions.slice(-200);

  writeJSON(INSIGHTS_F, { insights: insights.filter(i => i.insight_score >= 70), updated: today() });
  if (opps.length) writeJSON(OPPS_F, { opportunities: opps, updated: today() });

  const signals = insights.map(i => ({ id: i.insight_id, type: i.insight_type, title: i.insight_title, score: i.insight_score, voc: i.voice_of_customer.phrases_to_use }));
  writeJSON(SIGNALS_F, { signals, updated: today() });

  return u;
}

export function getAvgScore(m: CommunityMemoryStore): number { return computeAvgScore(m.avg_scores.slice(-10)); }

export function saveInsightToMemoryBot(insight: CommunityInsight): void {
  try {
    write({
      category: "Community Memory" as any,
      title: insight.insight_title,
      content: `Type:${insight.insight_type} | Score:${insight.insight_score} | Source:${insight.source_platform} | VOC:${insight.voice_of_customer.phrases_to_use.slice(0, 2).join("; ")}`,
      source_bot: "BOT-14",
      source_reference: insight.source_reference,
      related_keywords: insight.related_keywords,
      related_entities: [insight.insight_type, insight.source_platform],
    });
  } catch (e) { /* Memory unavailable */ }
}

export function appendRun(cycle: number, niche: string, score: number, insights: number): void {
  const runs = readJSON<{ runs: object[] }>(RUNS_FILE, { runs: [] });
  runs.runs.push({ cycle, date: today(), niche, score, insights });
  if (runs.runs.length > 100) runs.runs = runs.runs.slice(-100);
  writeJSON(RUNS_FILE, runs);
}
