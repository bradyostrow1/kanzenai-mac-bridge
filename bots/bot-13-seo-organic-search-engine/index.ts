// __DEFENSIVE_DEFAULTS_PATCHED__
import { llm, parseJSON } from "../../lib/llm";
import { getBotStrategy } from "../../lib/bot-llm-config";
import { logger } from "../../lib/logger";
import { writeJSON } from "../../lib/storage";
import { today } from "../../lib/date";

import { SEO_ORGANIC_SYSTEM_PROMPT, buildSEOPrompt } from "./prompt";
import { SEOOrganicReport } from "./schema";
import { rankPlans, computeAvgScore, shouldTrigger, shouldAccept } from "./scoring";
import { loadMemory, saveMemory, updateMemory, getAvgScore, savePlanToMemoryBot, appendRun } from "./memory";
import { sendSEODiscordReport, printSEOReport } from "./report";
import { getContext } from "../bot-21-memory-bot/index";
import { canRunBot } from "../../hermes/hermes/bot-registry";

const BOT_ID = "BOT-13";

export interface SEOOrganicInput {
  validated_niche:         string;
  target_audience:         string;
  source_asset_id:         string;
  source_asset_title:      string;
  source_asset_type:       string;
  source_asset_summary:    string;
  primary_keyword:         string;
  money_path:              string;
  related_keywords:        string[];
  competitor_gaps:         string[];
  existing_internal_pages: string[];
  mission_id:              string;
  from_bots?:              string[];
}

export async function runSEOOrganicEngine(input: SEOOrganicInput): Promise<SEOOrganicReport | null> {
  logger.info(BOT_ID, `SEO & Organic Search Engine starting — "${input.primary_keyword}"`);

  const __strategy = getBotStrategy("BOT-13");
  const memory   = loadMemory();
  const avgScore = getAvgScore(memory);
  const cycleNum = memory.total_runs + 1;

  let memoryContext = "No prior SEO data.";
  try {
    const ctx = getContext(BOT_ID, `SEO: ${input.validated_niche} ${input.primary_keyword}`);
    if (ctx.relevant_memories.length > 0) {
      memoryContext = [
        `Existing slugs (avoid duplicating): ${memory.optimized_slugs.slice(-10).join(", ") || "none"}`,
        `Topical clusters built: ${memory.topical_clusters.join(", ") || "none yet"}`,
        `Internal link targets: ${memory.internal_link_targets.slice(-10).join(", ") || "none yet"}`,
        `Warnings: ${ctx.warnings.join("; ") || "none"}`,
      ].join("\n");
    }
  } catch (e) { logger.warn(BOT_ID, `Memory unavailable: ${e}`); }

  logger.info(BOT_ID, "Calling Claude — building SEO plan...");
  let rawOutput = "";
  try {
    const response = await llm({
      system: SEO_ORGANIC_SYSTEM_PROMPT,
      user: buildSEOPrompt(
        input.source_asset_title, input.source_asset_type, input.source_asset_summary,
        input.primary_keyword, input.validated_niche, input.target_audience,
        input.money_path, input.related_keywords, input.competitor_gaps,
        input.existing_internal_pages, memoryContext, avgScore, cycleNum
      ),
      provider: __strategy.primary,
      model: __strategy.model ?? "claude-opus-4-5",
      max_tokens: 16000,
      fallbacks: __strategy.fallbacks,
    });
    rawOutput = response.text;
  } catch (e) { logger.error(BOT_ID, `Claude API error: ${e}`); return null; }

  let report: SEOOrganicReport | null = null;
  try {
    const start = rawOutput.indexOf("{"); const end = rawOutput.lastIndexOf("}");
    if (start !== -1 && end !== -1) report = JSON.parse(rawOutput.slice(start, end + 1));
  } catch (e) { logger.error(BOT_ID, `JSON parse failed: ${e}`); return null; }

  if (!report) { logger.error(BOT_ID, "No valid report"); return null; }

  // Normalize
  report.bot = "BOT-13"; report.agent_name = "SEO & Organic Search Engine";
  report.reports_to = "HERMES-00"; report.run_date = today();
  report.business_model = "multi-model automated online business system";
  report.free_first_rule_active = true;
  report.budget_context = { potential_budget_total: 250, budget_used: 0, budget_remaining: 250, paid_tools_recommended: [], free_alternatives_available: ["Google Search Console (free)", "Google Trends (free)", "Google Sheets tracking", "Free schema generators"], spend_approval_required_from: "HERMES-00" };
  report.input_source = { from_bots: input.from_bots ?? ["BOT-01","BOT-03","BOT-04","BOT-05","BOT-06","BOT-07","BOT-08","BOT-09","BOT-12","BOT-21"], mission_id: input.mission_id, source_asset_id: input.source_asset_id, source_asset_title: input.source_asset_title, source_asset_type: input.source_asset_type, validated_niche: input.validated_niche, target_audience: input.target_audience, primary_keyword: input.primary_keyword, search_intent: "", money_path: input.money_path };

  // Rank + tag handoffs
  report.seo_plans = rankPlans(report.seo_plans ?? []);
  if (!report.input_source) report.input_source = {} as any;
  if (report.seo_plans.length > 0) report.input_source.search_intent = report.seo_plans[0].search_intent;
  report.handoff_tasks = (report.handoff_tasks ?? []).map(h => ({ ...h, status: canRunBot(h.target_bot) ? "ready" : "queued_unbuilt_bot", queued_reason: !canRunBot(h.target_bot) ? `${h.target_bot} not built yet` : undefined }));

  const highValue = report.seo_plans.filter(p => shouldAccept(p.plan_score));
  if (!report.summary) report.summary = {} as any;
  report.summary.seo_plans_created         = report.seo_plans.length;
  report.summary.high_quality_plans        = highValue.length;
  report.summary.plans_rejected_or_revised = report.rejected_or_revision_needed?.length ?? 0;
  if (report.seo_plans.length > 0) {
    report.summary.top_asset     = report.seo_plans[0].asset_title;
    report.summary.top_plan_score = report.seo_plans[0].plan_score;
    report.summary.free_seo_plan  = report.seo_plans[0].free_first_plan.recommended_free_tools.slice(0, 2).join(", ") || "Google Search Console + Sheets";
  }

  const cycleScore = computeAvgScore(highValue.map(p => p.plan_score));
  highValue.slice(0, 5).forEach(savePlanToMemoryBot);
  const updatedMemory = updateMemory(memory, report.seo_plans, report.organic_growth_opportunities ?? [], cycleScore);
  saveMemory(updatedMemory);
  appendRun(cycleNum, input.source_asset_title, cycleScore, highValue.length);

  if (shouldTrigger([...memory.avg_scores, cycleScore])) logger.warn(BOT_ID, "3 low cycles — flagging for prompt rewrite");

  writeJSON("seo-organic-last-report.json", report);
  printSEOReport(report);
  await sendSEODiscordReport(report);

  logger.success(BOT_ID, `Cycle #${cycleNum} complete — ${highValue.length} high-quality SEO plans`);
  return report;
}
