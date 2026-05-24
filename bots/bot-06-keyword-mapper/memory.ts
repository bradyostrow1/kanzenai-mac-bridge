import { readJSON, writeJSON } from "../../lib/storage";
import { KeywordMemoryStore, KeywordCluster } from "./schema";
import { today } from "../../lib/date";
import { computeAvgScore } from "./scoring";
import { write } from "../bot-21-memory-bot/index";

const MEMORY_FILE   = "keyword-mapper-memory.json";
const RUNS_FILE     = "keyword-mapper-runs.json";
const CLUSTERS_FILE = "keyword-clusters.json";
const TMAP_FILE     = "topical-maps.json";
const BUYER_FILE    = "buyer-intent-keywords.json";
const MONEY_FILE    = "seo-money-map.json";

const DEFAULT: KeywordMemoryStore = {
  last_run: "", total_runs: 0, all_keywords: [],
  top_clusters: [], rejected_keywords: [], avg_scores: [], prompt_version: 1,
};

export function loadMemory(): KeywordMemoryStore {
  return readJSON<KeywordMemoryStore>(MEMORY_FILE, DEFAULT);
}

export function saveMemory(m: KeywordMemoryStore): void {
  writeJSON(MEMORY_FILE, m);
}

export function updateMemory(m: KeywordMemoryStore, clusters: KeywordCluster[], cycleScore: number): KeywordMemoryStore {
  const u = { ...m };
  u.last_run = today();
  u.total_runs += 1;
  u.avg_scores.push(cycleScore);
  if (u.avg_scores.length > 20) u.avg_scores = u.avg_scores.slice(-20);

  for (const c of clusters) {
    if (!u.all_keywords.includes(c.primary_keyword)) u.all_keywords.push(c.primary_keyword);
    if (c.cluster_score >= 80 && !u.top_clusters.includes(c.cluster_name)) u.top_clusters.push(c.cluster_name);
  }
  if (u.all_keywords.length > 500) u.all_keywords = u.all_keywords.slice(-500);

  // Persist top clusters, buyer-intent keywords
  writeJSON(CLUSTERS_FILE, { clusters: clusters.filter((c) => c.cluster_score >= 70), updated: today() });
  const buyerIntent = clusters.filter((c) => c.search_intent === "Buy" || c.search_intent === "Compare" || c.search_intent === "Find Alternative");
  writeJSON(BUYER_FILE, { keywords: buyerIntent.map((c) => ({ keyword: c.primary_keyword, score: c.cluster_score, money_goal: c.recommended_content_asset.money_goal })), updated: today() });

  return u;
}

export function getAvgScore(m: KeywordMemoryStore): number {
  return computeAvgScore(m.avg_scores.slice(-10));
}

export function getPastKeywords(m: KeywordMemoryStore): string[] {
  return m.all_keywords;
}

export function saveClusterToMemoryBot(cluster: KeywordCluster): void {
  try {
    write({
      category: "Keyword Memory",
      title: cluster.primary_keyword,
      content: `Cluster: ${cluster.cluster_name} | Score:${cluster.cluster_score} | Intent:${cluster.search_intent} | Money:${cluster.money_analysis.why_this_can_generate_revenue}`,
      source_bot: "BOT-06",
      source_reference: "Keyword Mapper",
      related_keywords: cluster.secondary_keywords,
      related_entities: [cluster.cluster_type, ...cluster.related_tools],
    });
  } catch (e) { /* Memory bot unavailable — continue */ }
}

export function appendRun(cycle: number, niche: string, score: number, clusters: number): void {
  const runs = readJSON<{ runs: object[] }>(RUNS_FILE, { runs: [] });
  runs.runs.push({ cycle, date: today(), niche, score, clusters });
  if (runs.runs.length > 100) runs.runs = runs.runs.slice(-100);
  writeJSON(RUNS_FILE, runs);
}
