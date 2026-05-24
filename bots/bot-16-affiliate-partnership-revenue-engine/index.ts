// __DEFENSIVE_DEFAULTS_PATCHED__
import { llm, parseJSON } from "../../lib/llm";
import { getBotStrategy } from "../../lib/bot-llm-config";
import { logger } from "../../lib/logger";
import { writeJSON } from "../../lib/storage";
import { today } from "../../lib/date";

import { AFFILIATE_PARTNERSHIP_SYSTEM_PROMPT, buildAffiliatePrompt } from "./prompt";
import { AffiliatePartnershipReport } from "./schema";
import { rankPrograms, computeAvgScore, shouldTrigger, shouldAccept } from "./scoring";
import { loadMemory, saveMemory, updateMemory, getAvgScore, saveProgramToMemoryBot, appendRun } from "./memory";
import { sendAffiliateDiscordReport, printAffiliateReport } from "./report";
import { getContext } from "../bot-21-memory-bot/index";
import { canRunBot } from "../../hermes/hermes/bot-registry";

const BOT_ID = "BOT-16";

export interface AffiliatePartnershipInput {
  validated_niche:              string;
  target_audience:              string;
  products_or_tools:            string[];
  assets_to_monetize:           string[];
  competitor_affiliate_signals: string[];
  money_path:                   string;
  mission_id:                   string;
  from_bots?:                   string[];
}

export async function runAffiliatePartnershipEngine(input: AffiliatePartnershipInput): Promise<AffiliatePartnershipReport | null> {
  logger.info(BOT_ID, `Affiliate & Partnership Engine starting for: "${input.validated_niche}"`);

  const __strategy = getBotStrategy("BOT-16");
  const memory   = loadMemory();
  const avgScore = getAvgScore(memory);
  const cycleNum = memory.total_runs + 1;

  let memoryContext = "No prior affiliate data.";
  try {
    const ctx = getContext(BOT_ID, `affiliate programs: ${input.validated_niche}`);
    if (ctx.relevant_memories.length > 0) {
      memoryContext = [
        `Known programs: ${memory.known_programs.slice(-15).join(", ") || "none yet"}`,
        `Applied programs: ${memory.applied_programs.join(", ") || "none"}`,
        `Rejected programs: ${memory.rejected_programs.join(", ") || "none"}`,
        `Warnings: ${ctx.warnings.join("; ") || "none"}`,
      ].join("\n");
    }
  } catch (e) { logger.warn(BOT_ID, `Memory unavailable: ${e}`); }

  logger.info(BOT_ID, "Calling Claude — evaluating affiliate programs...");
  let rawOutput = "";
  try {
    const response = await llm({
      system: AFFILIATE_PARTNERSHIP_SYSTEM_PROMPT,
      user: buildAffiliatePrompt(
        input.validated_niche, input.target_audience,
        input.products_or_tools, input.assets_to_monetize,
        input.competitor_affiliate_signals, memoryContext, avgScore, cycleNum
      ),
      provider: __strategy.primary,
      model: __strategy.model ?? "claude-opus-4-5",
      max_tokens: 16000,
      fallbacks: __strategy.fallbacks,
    });
    rawOutput = response.text;
  } catch (e) { logger.error(BOT_ID, `Claude API error: ${e}`); return null; }

  let report: AffiliatePartnershipReport | null = null;
  try {
    const start = rawOutput.indexOf("{"); const end = rawOutput.lastIndexOf("}");
    if (start !== -1 && end !== -1) report = JSON.parse(rawOutput.slice(start, end + 1));
  } catch (e) { logger.error(BOT_ID, `JSON parse failed: ${e}`); return null; }

  if (!report) { logger.error(BOT_ID, "No valid report"); return null; }

  // Normalize
  report.bot = "BOT-16"; report.agent_name = "Affiliate & Partnership Revenue Engine";
  report.reports_to = "HERMES-00"; report.run_date = today();
  report.business_model = "multi-model automated online business system";
  report.free_first_rule_active = true;
  report.budget_context = { potential_budget_total: 250, budget_used: 0, budget_remaining: 250, paid_tools_recommended: [], free_alternatives_available: ["Google Sheets tracking (free)", "Direct affiliate dashboards (free)", "Manual UTM tags (free)"], spend_approval_required_from: "HERMES-00" };
  report.input_source = { from_bots: input.from_bots ?? ["BOT-02","BOT-03","BOT-04","BOT-05","BOT-06","BOT-08","BOT-09","BOT-10","BOT-15","BOT-21"], mission_id: input.mission_id, validated_niche: input.validated_niche, target_audience: input.target_audience, products_or_tools: input.products_or_tools, assets_to_monetize: input.assets_to_monetize, money_path: input.money_path };

  // Rank + tag handoffs
  report.monetization_programs = rankPrograms(report.monetization_programs ?? []);
  report.handoff_tasks = (report.handoff_tasks ?? []).map(h => ({ ...h, status: canRunBot(h.target_bot) ? "ready" : "queued_unbuilt_bot", queued_reason: !canRunBot(h.target_bot) ? `${h.target_bot} not built yet` : undefined }));

  const highValue = report.monetization_programs.filter(p => shouldAccept(p.program_score));
  const freeToJoin = report.monetization_programs.filter(p => p.free_to_join === "yes" && shouldAccept(p.program_score));
  if (!report.summary) report.summary = {} as any;
  report.summary.programs_evaluated               = report.monetization_programs.length;
  report.summary.high_value_programs              = highValue.length;
  report.summary.programs_rejected_or_watchlisted = report.rejected_or_watchlisted_programs?.length ?? 0;
  report.summary.budget_use_recommended           = report.monetization_programs.some(p => p.free_first_plan.budget_use_recommended);
  if (report.monetization_programs.length > 0) {
    report.summary.top_program       = report.monetization_programs[0].program_name;
    report.summary.top_program_score = report.monetization_programs[0].program_score;
    report.summary.best_free_to_join_program = freeToJoin[0]?.program_name ?? "None identified — all require verification";
  }

  const cycleScore = computeAvgScore(highValue.map(p => p.program_score));
  highValue.slice(0, 5).forEach(saveProgramToMemoryBot);

  // Write application priority list
  writeJSON("application-priority-list.json", { priority: report.application_priority_order, updated: today() });

  const updatedMemory = updateMemory(memory, report.monetization_programs, report.link_placement_map ?? [], cycleScore);
  saveMemory(updatedMemory);
  appendRun(cycleNum, input.validated_niche, cycleScore, highValue.length);

  if (shouldTrigger([...memory.avg_scores, cycleScore])) logger.warn(BOT_ID, "3 low cycles — flagging for prompt rewrite");

  writeJSON("affiliate-partnership-last-report.json", report);
  printAffiliateReport(report);
  await sendAffiliateDiscordReport(report);

  logger.success(BOT_ID, `Cycle #${cycleNum} — ${highValue.length} programs, ${freeToJoin.length} free-to-join`);
  return report;
}
