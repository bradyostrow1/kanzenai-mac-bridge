// __DEFENSIVE_DEFAULTS_PATCHED__
import { llm, parseJSON } from "../../lib/llm";
import { getBotStrategy } from "../../lib/bot-llm-config";
import { logger } from "../../lib/logger";
import { writeJSON } from "../../lib/storage";
import { today } from "../../lib/date";

import { KEYWORD_MAPPER_SYSTEM_PROMPT, buildKeywordScanPrompt } from "./prompt";
import { KeywordMapperReport } from "./schema";
import { fetchAllKeywordSources, formatKeywordsForPrompt } from "./adapters";
import { rankClusters, computeAvgScore, shouldTriggerImprovement, shouldAcceptCluster } from "./scoring";
import { loadMemory, saveMemory, updateMemory, getAvgScore, getPastKeywords, saveClusterToMemoryBot, appendRun } from "./memory";
import { sendKeywordDiscordReport, printKeywordReport } from "./report";
import { getContext } from "../bot-21-memory-bot/index";
import { canRunBot } from "../../hermes/hermes/bot-registry";

const BOT_ID = "BOT-06";

export interface KeywordMapperInput {
  validated_niche:          string;
  niche_score:              number;
  target_audience:          string;
  top_pain_clusters:        string[];
  top_product_opportunities: string[];
  mission_id:               string;
  from_bots?:               string[];
}

export async function runKeywordMapper(input: KeywordMapperInput): Promise<KeywordMapperReport | null> {
  logger.info(BOT_ID, `Keyword Mapper starting for niche: "${input.validated_niche}"`);

  const __strategy = getBotStrategy("BOT-06");
  const memory   = loadMemory();
  const avgScore = getAvgScore(memory);
  const cycleNum = memory.total_runs + 1;

  // 1. Memory context from BOT-21
  let memoryContext = "No prior memory.";
  try {
    const ctx = getContext(BOT_ID, `keywords SEO: ${input.validated_niche}`);
    if (ctx.relevant_memories.length > 0) {
      memoryContext = [
        `Known keywords: ${ctx.known_winners.join(", ") || "none"}`,
        `Failed keywords: ${ctx.known_failures.join(", ") || "none"}`,
        `Past keywords (avoid repeating): ${getPastKeywords(memory).slice(-20).join(", ") || "none"}`,
        `Warnings: ${ctx.warnings.join("; ") || "none"}`,
      ].join("\n");
    }
  } catch (e) {
    logger.warn(BOT_ID, `Memory context unavailable: ${e}`);
  }

  // 2. Fetch keyword sources
  logger.info(BOT_ID, "Fetching keyword source data...");
  const sources    = await fetchAllKeywordSources(input.validated_niche);
  const sourceData = formatKeywordsForPrompt(sources);

  // 3. Call Claude
  logger.info(BOT_ID, "Calling Claude — building keyword map...");
  let rawOutput = "";
  try {
    const response = await llm({
      system: KEYWORD_MAPPER_SYSTEM_PROMPT,
      user: buildKeywordScanPrompt(
          input.validated_niche, input.target_audience,
          input.top_pain_clusters, input.top_product_opportunities,
          sourceData, memoryContext, avgScore, cycleNum
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

  // 4. Parse
  let report: KeywordMapperReport | null = null;
  try {
    const start = rawOutput.indexOf("{");
    const end   = rawOutput.lastIndexOf("}");
    if (start !== -1 && end !== -1) report = JSON.parse(rawOutput.slice(start, end + 1));
  } catch (e) {
    logger.error(BOT_ID, `JSON parse failed: ${e}`);
    return null;
  }

  if (!report) { logger.error(BOT_ID, "No valid report produced"); return null; }

  // 5. Normalize
  report.bot           = "BOT-06";
  report.agent_name    = "Keyword Mapper";
  report.reports_to    = "HERMES-00";
  report.run_date      = today();
  report.business_model = "niche media + affiliate + digital products";
  report.input_source  = {
    from_bots: input.from_bots ?? ["BOT-02", "BOT-03", "BOT-05", "BOT-21"],
    validated_niche: input.validated_niche,
    niche_score: input.niche_score,
    target_audience: input.target_audience,
    top_pain_clusters: input.top_pain_clusters,
    top_product_opportunities: input.top_product_opportunities,
    mission_id: input.mission_id,
  };

  // 6. Rank + tag handoffs
  report.top_keyword_clusters = rankClusters(report.top_keyword_clusters ?? []);
  report.handoff_tasks = (report.handoff_tasks ?? []).map((h) => ({
    ...h,
    status:        canRunBot(h.target_bot) ? "ready" : "queued_unbuilt_bot",
    queued_reason: !canRunBot(h.target_bot) ? `${h.target_bot} not built yet — queued` : undefined,
  }));

  // 7. Update summary
  const highValue = report.top_keyword_clusters.filter((c) => shouldAcceptCluster(c.cluster_score));
  if (!report.summary) report.summary = {} as any;
  report.summary.keyword_sources_scanned  = sources.length;
  report.summary.raw_keywords_found       = sources.reduce((acc, s) => acc + s.items.length, 0);
  report.summary.keywords_normalized      = report.top_keyword_clusters.length;
  report.summary.keyword_clusters_created = report.top_keyword_clusters.length;
  report.summary.high_value_clusters      = highValue.length;
  report.summary.rejected_keywords        = report.rejected_keywords?.length ?? 0;

  if (report.top_keyword_clusters.length > 0) {
    report.summary.top_keyword_cluster = report.top_keyword_clusters[0].cluster_name;
    report.summary.top_cluster_score   = report.top_keyword_clusters[0].cluster_score;
  }

  const cycleScore = computeAvgScore(highValue.map((c) => c.cluster_score));

  // 8. Save to BOT-21
  logger.info(BOT_ID, "Saving keyword clusters to BOT-21 memory...");
  highValue.slice(0, 8).forEach(saveClusterToMemoryBot);

  // 9. Persist SEO money map
  writeJSON("seo-money-map.json", {
    niche: input.validated_niche,
    updated: today(),
    top_clusters: highValue.slice(0, 10).map((c) => ({ keyword: c.primary_keyword, score: c.cluster_score, intent: c.search_intent, money_goal: c.recommended_content_asset.money_goal })),
    publishing_priority: report.publishing_priority_order.slice(0, 10),
    topical_map: report.topical_map,
  });

  // 10. Update local memory
  const updatedMemory = updateMemory(memory, report.top_keyword_clusters, cycleScore);
  saveMemory(updatedMemory);
  appendRun(cycleNum, input.validated_niche, cycleScore, highValue.length);

  if (shouldTriggerImprovement([...memory.avg_scores, cycleScore])) {
    logger.warn(BOT_ID, "3 consecutive low-score cycles — flagging for prompt rewrite");
  }

  writeJSON("keyword-mapper-last-report.json", report);
  printKeywordReport(report);
  await sendKeywordDiscordReport(report);

  logger.success(BOT_ID, `Cycle #${cycleNum} complete — ${highValue.length} high-value clusters, ${report.publishing_priority_order?.length ?? 0} publishing priorities`);
  return report;
}
