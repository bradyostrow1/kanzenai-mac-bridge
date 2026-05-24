// __DEFENSIVE_DEFAULTS_PATCHED__
import { llm, parseJSON } from "../../lib/llm";
import { getBotStrategy } from "../../lib/bot-llm-config";
import { logger } from "../../lib/logger";
import { writeJSON } from "../../lib/storage";
import { today } from "../../lib/date";

import { REVIEW_COMPARISON_SYSTEM_PROMPT, buildReviewPrompt } from "./prompt";
import { ReviewComparisonReport, BuyerIntentPage, PageType } from "./schema";
import { rankPages, computeAvgScore, shouldTriggerImprovement, shouldAcceptPage, checkFreeFirstCompliance, checkBudgetProtection } from "./scoring";
import { loadMemory, saveMemory, updateMemory, getAvgScore, savePageToMemoryBot, appendRun } from "./memory";
import { sendReviewDiscordReport, printReviewReport } from "./report";
import { getContext } from "../bot-21-memory-bot/index";
import { canRunBot } from "../../hermes/hermes/bot-registry";

const BOT_ID = "BOT-09";

export interface ReviewComparisonInput {
  validated_niche:     string;
  target_audience:     string;
  page_type_requested: PageType;
  primary_keyword:     string;
  reader_problem:      string;
  products_to_review:  string[];
  pain_clusters:       string[];
  competitor_gaps:     string[];
  mission_id:          string;
  from_bots?:          string[];
}

export async function runReviewComparisonBot(input: ReviewComparisonInput): Promise<ReviewComparisonReport | null> {
  logger.info(BOT_ID, `Review & Comparison Bot starting — type: ${input.page_type_requested} | "${input.primary_keyword}"`);

  const __strategy = getBotStrategy("BOT-09");
  const memory   = loadMemory();
  const avgScore = getAvgScore(memory);
  const cycleNum = memory.total_runs + 1;

  // 1. Memory context from BOT-21
  let memoryContext = "No prior memory.";
  try {
    const ctx = getContext(BOT_ID, `review comparison: ${input.validated_niche} ${input.primary_keyword}`);
    if (ctx.relevant_memories.length > 0) {
      memoryContext = [
        `Existing pages (avoid duplicating): ${memory.all_pages.slice(-10).join(", ") || "none"}`,
        `Known winners: ${ctx.known_winners.join(", ") || "none"}`,
        `Warnings: ${ctx.warnings.join("; ") || "none"}`,
      ].join("\n");
    }
  } catch (e) {
    logger.warn(BOT_ID, `Memory context unavailable: ${e}`);
  }

  // 2. Call Claude
  logger.info(BOT_ID, `Calling Claude — building ${input.page_type_requested} page...`);
  let rawOutput = "";
  try {
    const response = await llm({
      system: REVIEW_COMPARISON_SYSTEM_PROMPT,
      user: buildReviewPrompt(
          input.page_type_requested, input.primary_keyword,
          input.target_audience, input.reader_problem,
          input.products_to_review, input.pain_clusters,
          input.competitor_gaps, memoryContext, avgScore, cycleNum
        ),
      provider: __strategy.primary,
      model: __strategy.model ?? "claude-opus-4-5",
      max_tokens: 16000,
      fallbacks: __strategy.fallbacks,
    });
    rawOutput = response.text;
  } catch (e) {
    logger.error(BOT_ID, `Claude API error: ${e}`);
    return null;
  }

  // 3. Parse
  let report: ReviewComparisonReport | null = null;
  try {
    const start = rawOutput.indexOf("{");
    const end   = rawOutput.lastIndexOf("}");
    if (start !== -1 && end !== -1) report = JSON.parse(rawOutput.slice(start, end + 1));
  } catch (e) {
    logger.error(BOT_ID, `JSON parse failed: ${e}`);
    return null;
  }

  if (!report) { logger.error(BOT_ID, "No valid report produced"); return null; }

  // 4. Normalize
  report.bot                 = "BOT-09";
  report.agent_name          = "Review & Comparison Bot";
  report.reports_to          = "HERMES-00";
  report.run_date            = today();
  report.business_model      = "multi-model automated online business system";
  report.free_first_rule_active = true;
  report.budget_context = {
    potential_budget_total: 250,
    budget_used: 0,
    budget_remaining: 250,
    paid_tools_recommended: report.buyer_intent_pages?.flatMap((p) => p.free_first_analysis?.budget_use_recommended ? [p.free_first_analysis.best_paid_option_if_justified] : []).filter(Boolean) ?? [],
    free_alternatives_available: report.buyer_intent_pages?.flatMap((p) => p.free_first_analysis?.best_free_option ? [p.free_first_analysis.best_free_option] : []) ?? [],
    spend_approval_required_from: "HERMES-00",
  };
  report.input_source = {
    from_bots: input.from_bots ?? ["BOT-03", "BOT-04", "BOT-05", "BOT-06", "BOT-07", "BOT-08", "BOT-21"],
    mission_id: input.mission_id,
    validated_niche: input.validated_niche,
    target_audience: input.target_audience,
    page_type_requested: input.page_type_requested,
    primary_keyword: input.primary_keyword,
    products_or_tools: input.products_to_review,
  };

  // 5. Validate free-first + budget compliance
  report.buyer_intent_pages = rankPages(report.buyer_intent_pages ?? []);
  for (const page of report.buyer_intent_pages) {
    if (!checkFreeFirstCompliance(page)) {
      logger.warn(BOT_ID, `Free-first compliance issue on: "${page.page_title}" — no free option included`);
    }
    if (!checkBudgetProtection(page)) {
      logger.warn(BOT_ID, `Budget protection issue on: "${page.page_title}" — paid recommendation without HERMES-00 flag`);
      page.free_first_analysis.requires_hermes_approval = true;
    }
  }

  // 6. Tag handoffs
  report.handoff_tasks = (report.handoff_tasks ?? []).map((h) => ({
    ...h,
    status:        canRunBot(h.target_bot) ? "ready" : "queued_unbuilt_bot",
    queued_reason: !canRunBot(h.target_bot) ? `${h.target_bot} not built yet — queued` : undefined,
  }));

  // 7. Update summary
  const highValue = report.buyer_intent_pages.filter((p) => shouldAcceptPage(p.page_score));
  if (!report.summary) report.summary = {} as any;
  report.summary.pages_created             = report.buyer_intent_pages.length;
  report.summary.high_value_pages          = highValue.length;
  report.summary.pages_rejected_or_revised = report.rejected_or_revision_needed?.length ?? 0;
  report.summary.budget_use_recommended    = report.budget_context.paid_tools_recommended.length > 0;

  if (report.buyer_intent_pages.length > 0) {
    report.summary.top_page_title = report.buyer_intent_pages[0].page_title;
    report.summary.top_page_score = report.buyer_intent_pages[0].page_score;
    report.summary.free_first_angle = report.buyer_intent_pages[0].free_first_analysis?.best_free_option
      ? `Best free: ${report.buyer_intent_pages[0].free_first_analysis.best_free_option}`
      : "Free-first analysis included";
  }

  const cycleScore = computeAvgScore(highValue.map((p) => p.page_score));

  // 8. Save to BOT-21
  logger.info(BOT_ID, "Saving pages to BOT-21 memory...");
  highValue.slice(0, 5).forEach(savePageToMemoryBot);

  // 9. Update local memory
  const updatedMemory = updateMemory(memory, report.buyer_intent_pages, cycleScore);
  saveMemory(updatedMemory);
  appendRun(cycleNum, input.validated_niche, cycleScore, highValue.length);

  if (shouldTriggerImprovement([...memory.avg_scores, cycleScore])) {
    logger.warn(BOT_ID, "3 consecutive low-score cycles — flagging for prompt rewrite");
  }

  writeJSON("review-comparison-last-report.json", report);
  printReviewReport(report);
  await sendReviewDiscordReport(report);

  logger.success(BOT_ID, `Cycle #${cycleNum} complete — ${highValue.length} high-value pages`);
  return report;
}
