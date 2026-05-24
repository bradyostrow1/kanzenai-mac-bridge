import { readJSON, writeJSON } from "../../lib/storage";
import { MultiplierMemoryStore, RepurposedAsset, HookEntry, CTAEntry } from "./schema";
import { today } from "../../lib/date";
import { computeAvgScore } from "./scoring";
import { write } from "../bot-21-memory-bot/index";

const MEMORY_FILE   = "content-multiplier-memory.json";
const RUNS_FILE     = "content-multiplier-runs.json";
const ASSETS_FILE   = "repurposed-assets.json";
const HOOKS_FILE    = "hook-bank.json";
const CTAS_FILE     = "cta-bank.json";
const CAL_FILE      = "platform-content-calendar.json";
const DIST_FILE     = "free-distribution-plan.json";

const DEFAULT: MultiplierMemoryStore = {
  last_run: "", total_runs: 0, all_assets: [],
  top_hooks: [], best_platforms: [], avg_scores: [], prompt_version: 1,
};

export function loadMemory(): MultiplierMemoryStore { return readJSON<MultiplierMemoryStore>(MEMORY_FILE, DEFAULT); }
export function saveMemory(m: MultiplierMemoryStore): void { writeJSON(MEMORY_FILE, m); }

export function updateMemory(m: MultiplierMemoryStore, assets: RepurposedAsset[], hooks: HookEntry[], ctas: CTAEntry[], cycleScore: number): MultiplierMemoryStore {
  const u = { ...m };
  u.last_run = today();
  u.total_runs += 1;
  u.avg_scores.push(cycleScore);
  if (u.avg_scores.length > 20) u.avg_scores = u.avg_scores.slice(-20);

  for (const a of assets) {
    if (!u.all_assets.includes(a.asset_title)) u.all_assets.push(a.asset_title);
    if (a.asset_score >= 80) {
      if (!u.best_platforms.includes(a.platform)) u.best_platforms.push(a.platform);
    }
  }
  if (u.all_assets.length > 500) u.all_assets = u.all_assets.slice(-500);

  // Accumulate hook and CTA banks
  const existingHooks = readJSON<{ hooks: HookEntry[] }>(HOOKS_FILE, { hooks: [] });
  const allHooks = [...existingHooks.hooks, ...hooks].slice(-100);
  writeJSON(HOOKS_FILE, { hooks: allHooks, updated: today() });

  const existingCTAs = readJSON<{ ctas: CTAEntry[] }>(CTAS_FILE, { ctas: [] });
  const allCTAs = [...existingCTAs.ctas, ...ctas].slice(-100);
  writeJSON(CTAS_FILE, { ctas: allCTAs, updated: today() });

  writeJSON(ASSETS_FILE, { assets: assets.filter(a => a.asset_score >= 70), updated: today() });
  return u;
}

export function getAvgScore(m: MultiplierMemoryStore): number { return computeAvgScore(m.avg_scores.slice(-10)); }

export function saveAssetToMemoryBot(asset: RepurposedAsset): void {
  try {
    write({
      category: "Content Memory",
      title: asset.asset_title,
      content: `Platform:${asset.platform} | Type:${asset.asset_type} | Score:${asset.asset_score} | Hook:"${asset.content.hook?.slice(0, 80)}"`,
      source_bot: "BOT-11",
      source_reference: "Content Multiplier Engine",
      related_keywords: asset.memory_log.related_keywords,
      related_entities: [asset.asset_type, asset.platform],
    });
  } catch (e) { /* Memory bot unavailable */ }
}

export function appendRun(cycle: number, sourceTitle: string, score: number, assets: number): void {
  const runs = readJSON<{ runs: object[] }>(RUNS_FILE, { runs: [] });
  runs.runs.push({ cycle, date: today(), sourceTitle, score, assets });
  if (runs.runs.length > 100) runs.runs = runs.runs.slice(-100);
  writeJSON(RUNS_FILE, runs);
}
