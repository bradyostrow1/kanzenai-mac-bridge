// __DEFENSIVE_DEFAULTS_PATCHED__
import { llm, parseJSON } from "../../lib/llm";
import { getBotStrategy } from "../../lib/bot-llm-config";
import { logger } from "../../lib/logger";
import { writeJSON } from "../../lib/storage";
import { today } from "../../lib/date";

import { CONTENT_MULTIPLIER_SYSTEM_PROMPT, buildMultiplierPrompt } from "./prompt";
import { ContentMultiplierReport } from "./schema";
import { rankAssets, computeAvgScore, shouldTriggerImprovement, shouldAccept } from "./scoring";
import { loadMemory, saveMemory, updateMemory, getAvgScore, saveAssetToMemoryBot, appendRun } from "./memory";
import { sendMultiplierDiscordReport, printMultiplierReport } from "./report";
import { getContext } from "../bot-21-memory-bot/index";
import { canRunBot } from "../../hermes/hermes/bot-registry";

const BOT_ID = "BOT-11";

export interface ContentMultiplierInput {
  validated_niche:      string;
  target_audience:      string;
  source_asset_id:      string;
  source_asset_title:   string;
  source_asset_type:    string;
  source_asset_summary: string;
  primary_cta:          string;
  money_path:           string;
  pain_clusters:        string[];
  mission_id:           string;
  from_bots?:           string[];
}

export async function runContentMultiplierEngine(input: ContentMultiplierInput): Promise<ContentMultiplierReport | null> {
  logger.info(BOT_ID, `Content Multiplier Engine starting — source: "${input.source_asset_title}"`);

  const __strategy = getBotStrategy("BOT-11");
  const memory   = loadMemory();
  const avgScore = getAvgScore(memory);
  const cycleNum = memory.total_runs + 1;

  let memoryContext = "No prior distribution data.";
  try {
    const ctx = getContext(BOT_ID, `content distribution: ${input.validated_niche}`);
    if (ctx.relevant_memories.length > 0) {
      memoryContext = [
        `Best platforms so far: ${memory.best_platforms.join(", ") || "none yet"}`,
        `Existing assets (avoid duplicating): ${memory.all_assets.slice(-10).join(", ") || "none"}`,
        `Warnings: ${ctx.warnings.join("; ") || "none"}`,
      ].join("\n");
    }
  } catch (e) { logger.warn(BOT_ID, `Memory unavailable: ${e}`); }

  logger.info(BOT_ID, "Calling Claude — multiplying content...");
  let rawOutput = "";
  try {
    const response = await llm({
      system: CONTENT_MULTIPLIER_SYSTEM_PROMPT,
      user: buildMultiplierPrompt(
        input.source_asset_title, input.source_asset_type, input.source_asset_summary,
        input.validated_niche, input.target_audience, input.primary_cta,
        input.money_path, input.pain_clusters, memoryContext, avgScore, cycleNum
      ),
      provider: __strategy.primary,
      model: __strategy.model ?? "claude-opus-4-5",
      max_tokens: 16000,
      fallbacks: __strategy.fallbacks,
    });
    rawOutput = response.text;
  } catch (e) { logger.error(BOT_ID, `Claude API error: ${e}`); return null; }

  let report: ContentMultiplierReport | null = null;
  try {
    const start = rawOutput.indexOf("{"); const end = rawOutput.lastIndexOf("}");
    if (start !== -1 && end !== -1) report = JSON.parse(rawOutput.slice(start, end + 1));
  } catch (e) { logger.error(BOT_ID, `JSON parse failed: ${e}`); return null; }

  if (!report) { logger.error(BOT_ID, "No valid report"); return null; }

  // Normalize
  report.bot = "BOT-11"; report.agent_name = "Content Multiplier Engine";
  report.reports_to = "HERMES-00"; report.run_date = today();
  report.business_model = "multi-model automated online business system";
  report.free_first_rule_active = true;
  report.budget_context = { potential_budget_total: 250, budget_used: 0, budget_remaining: 250, paid_tools_recommended: [], free_alternatives_available: ["Buffer free", "Meta Business Suite free", "Notion calendar"], spend_approval_required_from: "HERMES-00" };
  report.input_source = { from_bots: input.from_bots ?? ["BOT-01","BOT-03","BOT-05","BOT-06","BOT-07","BOT-08","BOT-09","BOT-10","BOT-21"], mission_id: input.mission_id, source_asset_id: input.source_asset_id, source_asset_title: input.source_asset_title, source_asset_type: input.source_asset_type, validated_niche: input.validated_niche, target_audience: input.target_audience, money_path: input.money_path, primary_cta: input.primary_cta };

  // Rank + tag handoffs
  report.repurposed_assets = rankAssets(report.repurposed_assets ?? []);
  report.handoff_tasks = (report.handoff_tasks ?? []).map((h) => ({ ...h, status: canRunBot(h.target_bot) ? "ready" : "queued_unbuilt_bot", queued_reason: !canRunBot(h.target_bot) ? `${h.target_bot} not built yet` : undefined }));

  const highValue = report.repurposed_assets.filter(a => shouldAccept(a.asset_score));
  if (!report.summary) report.summary = {} as any;
  report.summary.repurposed_assets_created  = report.repurposed_assets.length;
  report.summary.high_quality_assets        = highValue.length;
  report.summary.assets_rejected_or_revised = report.rejected_or_revision_needed?.length ?? 0;
  if (report.repurposed_assets.length > 0) {
    report.summary.top_asset_title  = report.repurposed_assets[0].asset_title;
    report.summary.top_asset_score  = report.repurposed_assets[0].asset_score;
    report.summary.best_platform    = report.repurposed_assets[0].platform;
  }

  const cycleScore = computeAvgScore(highValue.map(a => a.asset_score));

  highValue.slice(0, 5).forEach(saveAssetToMemoryBot);
  const updatedMemory = updateMemory(memory, report.repurposed_assets, report.hook_bank ?? [], report.cta_bank ?? [], cycleScore);
  saveMemory(updatedMemory);
  appendRun(cycleNum, input.source_asset_title, cycleScore, highValue.length);

  if (shouldTriggerImprovement([...memory.avg_scores, cycleScore])) logger.warn(BOT_ID, "3 low cycles — flagging for prompt rewrite");

  writeJSON("content-multiplier-last-report.json", report);
  printMultiplierReport(report);
  await sendMultiplierDiscordReport(report);

  logger.success(BOT_ID, `Cycle #${cycleNum} complete — ${highValue.length} high-quality assets`);
  return report;
}
