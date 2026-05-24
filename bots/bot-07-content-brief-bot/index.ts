// __DEFENSIVE_DEFAULTS_PATCHED__
import { llm, parseJSON } from "../../lib/llm";
import { getBotStrategy } from "../../lib/bot-llm-config";
import { logger } from "../../lib/logger";
import { writeJSON } from "../../lib/storage";
import { today } from "../../lib/date";

import { CONTENT_BRIEF_SYSTEM_PROMPT, buildBriefPrompt } from "./prompt";
import { ContentBriefReport, ContentBrief } from "./schema";
import { rankBriefs, computeAvgScore, shouldTriggerImprovement, shouldAcceptBrief } from "./scoring";
import { loadMemory, saveMemory, updateMemory, getAvgScore, saveBriefToMemoryBot, appendRun } from "./memory";
import { sendBriefDiscordReport, printBriefReport } from "./report";
import { getContext } from "../bot-21-memory-bot/index";
import { canRunBot } from "../../hermes/hermes/bot-registry";

const BOT_ID = "BOT-07";

export interface ContentBriefInput {
  validated_niche:          string;
  target_audience:          string;
  top_pain_clusters:        string[];
  top_product_opportunities: string[];
  top_keyword_clusters:     string[];
  mission_id:               string;
  from_bots?:               string[];
}

export async function runContentBriefBot(input: ContentBriefInput): Promise<ContentBriefReport | null> {
  logger.info(BOT_ID, `Content Brief Bot starting for niche: "${input.validated_niche}"`);

  const __strategy = getBotStrategy("BOT-07");
  const memory   = loadMemory();
  const avgScore = getAvgScore(memory);
  const cycleNum = memory.total_runs + 1;

  // 1. Memory context from BOT-21
  let memoryContext = "No prior memory.";
  try {
    const ctx = getContext(BOT_ID, `content briefs: ${input.validated_niche}`);
    if (ctx.relevant_memories.length > 0) {
      memoryContext = [
        `Existing briefs (avoid duplicate): ${memory.all_briefs.slice(-20).join(", ") || "none"}`,
        `Known winners: ${ctx.known_winners.join(", ") || "none"}`,
        `Warnings: ${ctx.warnings.join("; ") || "none"}`,
      ].join("\n");
    }
  } catch (e) {
    logger.warn(BOT_ID, `Memory context unavailable: ${e}`);
  }

  // 2. Call Claude
  logger.info(BOT_ID, "Calling Claude — creating content briefs...");
  let rawOutput = "";
  try {
    const response = await llm({
      system: CONTENT_BRIEF_SYSTEM_PROMPT,
      user: buildBriefPrompt(
          input.validated_niche, input.target_audience,
          input.top_pain_clusters, input.top_product_opportunities,
          input.top_keyword_clusters, memoryContext, avgScore, cycleNum
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
  let report: ContentBriefReport | null = null;
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
  report.bot           = "BOT-07";
  report.agent_name    = "Content Brief Bot";
  report.reports_to    = "HERMES-00";
  report.run_date      = today();
  report.business_model = "niche media + affiliate + digital products";
  report.input_source  = {
    from_bots: input.from_bots ?? ["BOT-02", "BOT-03", "BOT-05", "BOT-06", "BOT-21"],
    validated_niche: input.validated_niche,
    target_audience: input.target_audience,
    top_pain_clusters: input.top_pain_clusters,
    top_product_opportunities: input.top_product_opportunities,
    top_keyword_clusters: input.top_keyword_clusters,
    mission_id: input.mission_id,
  };

  // 5. Rank + tag handoffs
  report.content_briefs = rankBriefs(report.content_briefs ?? []);
  report.handoff_tasks  = (report.handoff_tasks ?? []).map((h) => ({
    ...h,
    status:        canRunBot(h.target_bot) ? "ready" : "queued_unbuilt_bot",
    queued_reason: !canRunBot(h.target_bot) ? `${h.target_bot} not built yet — queued` : undefined,
  }));

  // 6. Update summary
  const highValue = report.content_briefs.filter((b) => shouldAcceptBrief(b.brief_score));
  if (!report.summary) report.summary = {} as any;
  report.summary.briefs_created       = report.content_briefs.length;
  report.summary.high_priority_briefs = highValue.length;
  report.summary.rejected_briefs      = report.rejected_briefs?.length ?? 0;

  if (report.content_briefs.length > 0) {
    report.summary.top_brief_title = report.content_briefs[0].title;
    report.summary.top_brief_score = report.content_briefs[0].brief_score;
  }

  const cycleScore = computeAvgScore(highValue.map((b) => b.brief_score));

  // 7. Save to BOT-21
  logger.info(BOT_ID, "Saving briefs to BOT-21 memory...");
  highValue.slice(0, 8).forEach(saveBriefToMemoryBot);

  // 8. Persist priority order
  writeJSON("content-priority.json", {
    niche: input.validated_niche,
    updated: today(),
    priority: report.publishing_priority_order ?? [],
    top_briefs: highValue.slice(0, 5).map((b) => ({ id: b.brief_id, title: b.title, score: b.brief_score, keyword: b.primary_keyword, type: b.content_type })),
  });

  // 9. Update local memory
  const updatedMemory = updateMemory(memory, report.content_briefs, cycleScore);
  saveMemory(updatedMemory);
  appendRun(cycleNum, input.validated_niche, cycleScore, highValue.length);

  if (shouldTriggerImprovement([...memory.avg_scores, cycleScore])) {
    logger.warn(BOT_ID, "3 consecutive low-score cycles — flagging for prompt rewrite");
  }

  writeJSON("content-brief-last-report.json", report);
  printBriefReport(report);
  await sendBriefDiscordReport(report);

  logger.success(BOT_ID, `Cycle #${cycleNum} complete — ${highValue.length} high-priority briefs`);
  return report;
}
