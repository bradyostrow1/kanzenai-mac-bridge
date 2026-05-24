import { CommunityIntelligenceReport } from "./schema";
import { logger } from "../../lib/logger";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

export async function sendCommunityDiscordReport(r: CommunityIntelligenceReport): Promise<void> {
  if (!WEBHOOK) { logger.warn("BOT-14", "No Discord webhook — skipping"); return; }
  const s = r.summary;
  const top3 = r.community_insights.slice(0, 3).map((i, idx) =>
    `${idx + 1}. **${i.insight_title}** — ${i.insight_score}/100 [${i.insight_type}] | ${i.source_platform}`
  ).join("\n");
  const topQ = r.community_questions.slice(0, 3).map((q, i) => `${i + 1}. ${q.question}`).join("\n");
  const topO = r.community_content_opportunities.slice(0, 3).map((o, i) => `${i + 1}. **${o.opportunity}** → ${o.recommended_asset_type}`).join("\n");
  const content = [
    `## 👥 HERMES BOT-14 — COMMUNITY INTELLIGENCE REPORT`,
    `**Niche:** ${r.input_source.validated_niche} | **Sources Checked:** ${s.community_sources_checked}`,
    `**Insights:** ${s.insights_extracted} | **High-Value:** ${s.high_value_insights} | **Budget:** $${r.budget_context.budget_remaining}`,
    ``,
    `### 💰 Top Insight: **${s.top_insight}** (${s.top_insight_score}/100)`,
    `**Money Path:** ${s.money_path}`,
    `**Free Research:** ${s.free_research_plan}`,
    `**Highest-ROI Action:** ${s.highest_roi_action}`,
    ``, `### 📊 Top Insights`, top3,
    topQ ? `### ❓ Top Questions\n${topQ}` : "",
    topO ? `### 📝 Content Opportunities\n${topO}` : "",
    ``, `### ⚡ Hermes Command`, `> ${s.hermes_instruction}`,
  ].filter(Boolean).join("\n");
  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.success("BOT-14", "Discord report sent");
  } catch (e) { logger.error("BOT-14", `Discord failed: ${e}`); }
}

export function printCommunityReport(r: CommunityIntelligenceReport): void {
  const C = { r: "\x1b[0m", b: "\x1b[1m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", gr: "\x1b[90m", w: "\x1b[97m", m: "\x1b[35m", red: "\x1b[31m" };
  const s = r.summary;
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.w}  👥 HERMES BOT-14 — COMMUNITY INTELLIGENCE ENGINE${C.r}`);
  console.log(`${C.gr}  Niche: ${r.input_source.validated_niche} | Run: ${r.run_date}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`\n  Sources: ${C.g}${s.community_sources_checked}${C.r} | Discussions: ${C.g}${s.raw_discussions_found}${C.r} | High-value: ${C.g}${s.high_value_insights}${C.r}`);
  console.log(`  ${C.b}${C.g}TOP:${C.r}      ${s.top_insight} (${s.top_insight_score}/100)`);
  console.log(`  ${C.b}${C.m}MONEY:${C.r}    ${s.money_path}`);
  console.log(`  ${C.b}FREE:${C.r}     ${s.free_research_plan}`);
  r.community_insights.slice(0, 4).forEach((i, idx) => {
    const col = i.insight_score >= 90 ? C.g : i.insight_score >= 80 ? C.c : C.y;
    const risk = i.risk_notes.privacy_risk === "high" ? ` ${C.red}[PRIVACY RISK]${C.r}` : "";
    console.log(`\n  ${idx + 1}. ${C.b}${i.insight_title}${C.r} — ${col}${i.insight_score}/100${C.r} [${i.insight_type}]${risk}`);
    console.log(`     Source: ${i.source_platform} | Strength: ${i.evidence?.[0]?.evidence_strength || "??"}`);
    if (i.voice_of_customer.phrases_to_use.length) console.log(`     ${C.gr}VOC: "${i.voice_of_customer.phrases_to_use[0]}"${C.r}`);
  });
  if (r.community_questions.length) {
    console.log(`\n  ${C.b}TOP QUESTIONS:${C.r}`);
    r.community_questions.slice(0, 3).forEach(q => console.log(`    ❓ ${C.y}${q.question}${C.r}`));
  }
  if (r.community_distribution_opportunities.length) {
    console.log(`\n  ${C.b}DISTRIBUTION OPPs:${C.r}`);
    r.community_distribution_opportunities.slice(0, 2).forEach(o => console.log(`    📡 ${o.community_or_platform} [spam:${o.spam_risk}]: ${o.safe_distribution_approach}`));
  }
  const queued = r.handoff_tasks.filter(h => h.status === "queued_unbuilt_bot");
  if (queued.length) { console.log(`\n  ${C.b}QUEUED:${C.r}`); queued.slice(0, 4).forEach(h => console.log(`    ${C.y}⏳ ${h.target_bot}${C.r}: ${h.task}`)); }
  console.log(`  ${C.b}MEMORY:${C.r} ${r.memory_updates.length} items saved`);
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.g}  ⚡ FINAL COMMAND: ${s.hermes_instruction}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}\n`);
}
