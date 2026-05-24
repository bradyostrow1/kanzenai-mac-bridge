import { readJSON, writeJSON } from "../../lib/storage";
import { SEOMemoryStore, SEOPlan, OrganicGrowthOpportunity } from "./schema";
import { today } from "../../lib/date";
import { computeAvgScore } from "./scoring";
import { write } from "../bot-21-memory-bot/index";

const MEMORY_FILE   = "seo-organic-memory.json";
const RUNS_FILE     = "seo-organic-runs.json";
const PLANS_FILE    = "seo-optimization-plans.json";
const LINKS_FILE    = "internal-link-map.json";
const TAUTH_FILE    = "topical-authority-map.json";
const REFRESH_FILE  = "content-refresh-plan.json";
const GROWTH_FILE   = "organic-growth-plan.json";
const TRACK_FILE    = "seo-tracking-plan.json";

const DEFAULT: SEOMemoryStore = {
  last_run: "", total_runs: 0, all_plans: [], optimized_slugs: [],
  topical_clusters: [], internal_link_targets: [], avg_scores: [], prompt_version: 1,
};

export function loadMemory(): SEOMemoryStore { return readJSON<SEOMemoryStore>(MEMORY_FILE, DEFAULT); }
export function saveMemory(m: SEOMemoryStore): void { writeJSON(MEMORY_FILE, m); }

export function updateMemory(m: SEOMemoryStore, plans: SEOPlan[], opps: OrganicGrowthOpportunity[], score: number): SEOMemoryStore {
  const u = { ...m }; u.last_run = today(); u.total_runs++; u.avg_scores.push(score);
  if (u.avg_scores.length > 20) u.avg_scores = u.avg_scores.slice(-20);

  for (const p of plans) {
    if (!u.all_plans.includes(p.asset_title)) u.all_plans.push(p.asset_title);
    if (p.metadata.slug && !u.optimized_slugs.includes(p.metadata.slug)) u.optimized_slugs.push(p.metadata.slug);
    if (p.topical_authority_plan.pillar_topic && !u.topical_clusters.includes(p.topical_authority_plan.pillar_topic)) u.topical_clusters.push(p.topical_authority_plan.pillar_topic);
    p.internal_link_plan.priority_internal_links?.forEach(l => { if (!u.internal_link_targets.includes(l)) u.internal_link_targets.push(l); });
  }
  if (u.all_plans.length > 300) u.all_plans = u.all_plans.slice(-300);

  writeJSON(PLANS_FILE, { plans: plans.filter(p => p.plan_score >= 70), updated: today() });
  const linkMap = plans.flatMap(p => p.internal_link_plan.priority_internal_links.map(l => ({ from: p.asset_title, to: l })));
  if (linkMap.length) writeJSON(LINKS_FILE, { links: linkMap, updated: today() });
  const authMaps = plans.map(p => ({ asset: p.asset_title, pillar: p.topical_authority_plan.pillar_topic, cluster: p.topical_authority_plan.related_clusters, next: p.topical_authority_plan.next_cluster_to_build }));
  writeJSON(TAUTH_FILE, { maps: authMaps, updated: today() });
  const refreshItems = plans.filter(p => p.refresh_plan.refresh_needed);
  if (refreshItems.length) writeJSON(REFRESH_FILE, { items: refreshItems.map(p => ({ asset: p.asset_title, freq: p.refresh_plan.refresh_frequency, what: p.refresh_plan.what_to_update })), updated: today() });
  if (opps.length) writeJSON(GROWTH_FILE, { opportunities: opps, updated: today() });
  writeJSON(TRACK_FILE, { tracking: plans.map(p => ({ asset: p.asset_title, ...p.tracking_plan })), updated: today() });

  return u;
}

export function getAvgScore(m: SEOMemoryStore): number { return computeAvgScore(m.avg_scores.slice(-10)); }

export function savePlanToMemoryBot(plan: SEOPlan): void {
  try {
    write({
      category: "SEO Memory" as any,
      title: plan.asset_title,
      content: `Keyword:"${plan.primary_keyword}" | Intent:${plan.search_intent} | Score:${plan.plan_score} | Slug:${plan.metadata.slug} | Pillar:${plan.topical_authority_plan.pillar_topic}`,
      source_bot: "BOT-13",
      source_reference: "SEO & Organic Search Engine",
      related_keywords: plan.secondary_keywords,
      related_entities: [plan.asset_type, plan.search_intent],
    });
  } catch (e) { /* Memory unavailable */ }
}

export function appendRun(cycle: number, assetTitle: string, score: number, plans: number): void {
  const runs = readJSON<{ runs: object[] }>(RUNS_FILE, { runs: [] });
  runs.runs.push({ cycle, date: today(), assetTitle, score, plans });
  if (runs.runs.length > 100) runs.runs = runs.runs.slice(-100);
  writeJSON(RUNS_FILE, runs);
}
