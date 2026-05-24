// __DEFENSIVE_DEFAULTS_PATCHED__
import { llm, parseJSON } from "../../lib/llm";
import { getBotStrategy } from "../../lib/bot-llm-config";
import { logger } from "../../lib/logger";
import { writeJSON } from "../../lib/storage";
import { today } from "../../lib/date";

import { COMMUNITY_INTELLIGENCE_SYSTEM_PROMPT, buildCommunityIntelPrompt } from "./prompt";
import { CommunityIntelligenceReport } from "./schema";
import { rankInsights, computeAvgScore, shouldTrigger, shouldAccept } from "./scoring";
import { loadMemory, saveMemory, updateMemory, getAvgScore, saveInsightToMemoryBot, appendRun } from "./memory";
import { fetchAllCommunityDiscussions, formatDiscussionsForPrompt, countTotalDiscussions } from "./adapters";
import { sendCommunityDiscordReport, printCommunityReport } from "./report";
import { getContext } from "../bot-21-memory-bot/index";
import { canRunBot } from "../../hermes/hermes/bot-registry";

const BOT_ID = "BOT-14";

export interface CommunityIntelInput {
  validated_niche:     string;
  target_audience:     string;
  keywords:            string[];
  tools_or_products:   string[];
  assets_to_validate:  string[];
  research_question:   string;
  mission_id:          string;
  from_bots?:          string[];
}

export async function runCommunityIntelligenceEngine(input: CommunityIntelInput): Promise<CommunityIntelligenceReport | null> {
  logger.info(BOT_ID, `Community Intelligence Engine starting for: "${input.validated_niche}"`);

  const __strategy = getBotStrategy("BOT-14");
  const memory   = loadMemory();
  const avgScore = getAvgScore(memory);
  const cycleNum = memory.total_runs + 1;

  let memoryContext = "No prior community data.";
  try {
    const ctx = getContext(BOT_ID, `community: ${input.validated_niche}`);
    if (ctx.relevant_memories.length > 0) {
      memoryContext = [
        `Known sources: ${memory.known_sources.join(", ") || "none yet"}`,
        `Tracked questions: ${memory.tracked_questions.slice(-5).join("; ") || "none"}`,
        `High-value insights: ${memory.high_value_insights.slice(-5).join("; ") || "none"}`,
        `Warnings: ${ctx.warnings.join("; ") || "none"}`,
      ].join("\n");
    }
  } catch (e) { logger.warn(BOT_ID, `Memory unavailable: ${e}`); }

  // Fetch public community discussions
  logger.info(BOT_ID, "Fetching public community discussions...");
  const discussions  = await fetchAllCommunityDiscussions(input.validated_niche, input.target_audience);
  const totalFound   = countTotalDiscussions(discussions);
  const discussionData = formatDiscussionsForPrompt(discussions);

  logger.info(BOT_ID, `Found ${totalFound} public discussions. Calling Claude...`);
  let rawOutput = "";
  try {
    const response = await llm({
      system: COMMUNITY_INTELLIGENCE_SYSTEM_PROMPT,
      user: buildCommunityIntelPrompt(
        input.validated_niche, input.target_audience, input.keywords,
        input.tools_or_products, input.assets_to_validate, input.research_question,
        discussionData, memoryContext, avgScore, cycleNum
      ),
      provider: __strategy.primary,
      model: __strategy.model ?? "claude-opus-4-5",
      max_tokens: 16000,
      fallbacks: __strategy.fallbacks,
    });
    rawOutput = response.text;
  } catch (e) { logger.error(BOT_ID, `Claude API error: ${e}`); return null; }

  let report: CommunityIntelligenceReport | null = null;
  try {
    const start = rawOutput.indexOf("{"); const end = rawOutput.lastIndexOf("}");
    if (start !== -1 && end !== -1) report = JSON.parse(rawOutput.slice(start, end + 1));
  } catch (e) { logger.error(BOT_ID, `JSON parse failed: ${e}`); return null; }

  if (!report) { logger.error(BOT_ID, "No valid report"); return null; }

  // Normalize
  report.bot = "BOT-14"; report.agent_name = "Community Intelligence Engine";
  report.reports_to = "HERMES-00"; report.run_date = today();
  report.business_model = "multi-model automated online business system";
  report.free_first_rule_active = true;
  report.budget_context = { potential_budget_total: 250, budget_used: 0, budget_remaining: 250, paid_tools_recommended: [], free_alternatives_available: ["Reddit search (free)", "Google operators (free)", "Public app reviews (free)"], spend_approval_required_from: "HERMES-00" };
  report.input_source = { from_bots: input.from_bots ?? ["BOT-01","BOT-02","BOT-03","BOT-04","BOT-05","BOT-06","BOT-07","BOT-08","BOT-09","BOT-10","BOT-11","BOT-12","BOT-13","BOT-21"], mission_id: input.mission_id, validated_niche: input.validated_niche, target_audience: input.target_audience, keywords: input.keywords, tools_or_products: input.tools_or_products, assets_to_validate: input.assets_to_validate, research_question: input.research_question };

  // Rank + tag
  report.community_insights = rankInsights(report.community_insights ?? []);
  report.handoff_tasks = (report.handoff_tasks ?? []).map(h => ({ ...h, status: canRunBot(h.target_bot) ? "ready" : "queued_unbuilt_bot", queued_reason: !canRunBot(h.target_bot) ? `${h.target_bot} not built yet` : undefined }));

  const highValue = report.community_insights.filter(i => shouldAccept(i.insight_score));
  if (!report.summary) report.summary = {} as any;
  report.summary.community_sources_checked  = discussions.length;
  report.summary.raw_discussions_found      = totalFound;
  report.summary.insights_extracted         = report.community_insights.length;
  report.summary.high_value_insights        = highValue.length;
  report.summary.rejected_or_risky_insights = report.rejected_or_risky_insights?.length ?? 0;
  if (report.community_insights.length > 0) {
    report.summary.top_insight       = report.community_insights[0].insight_title;
    report.summary.top_insight_score = report.community_insights[0].insight_score;
    report.summary.free_research_plan = report.community_insights[0].free_first_plan.recommended_free_methods.slice(0, 2).join(", ") || "Reddit search + app reviews";
  }

  const cycleScore = computeAvgScore(highValue.map(i => i.insight_score));
  highValue.slice(0, 5).forEach(saveInsightToMemoryBot);
  const updatedMemory = updateMemory(memory, report.community_insights, report.community_content_opportunities ?? [], cycleScore);
  saveMemory(updatedMemory);
  appendRun(cycleNum, input.validated_niche, cycleScore, highValue.length);

  if (shouldTrigger([...memory.avg_scores, cycleScore])) logger.warn(BOT_ID, "3 low cycles — flagging for prompt rewrite");

  writeJSON("community-intelligence-last-report.json", report);
  printCommunityReport(report);
  await sendCommunityDiscordReport(report);

  logger.success(BOT_ID, `Cycle #${cycleNum} complete — ${highValue.length} high-value community insights`);
  return report;
}
