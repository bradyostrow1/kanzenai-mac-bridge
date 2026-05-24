import { ReviewComparisonReport } from "./schema";
import { logger } from "../../lib/logger";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

export async function sendReviewDiscordReport(r: ReviewComparisonReport): Promise<void> {
  if (!WEBHOOK) { logger.warn("BOT-09", "No Discord webhook — skipping"); return; }

  const s = r.summary;
  const top3 = r.buyer_intent_pages.slice(0, 3).map((p, i) =>
    `${i + 1}. **${p.page_title}** — ${p.page_score}/100 [${p.page_type}] | "${p.primary_keyword}"`
  ).join("\n");
  const topPage    = r.buyer_intent_pages[0];
  const freeTools  = r.buyer_intent_pages.flatMap((p) => p.free_first_analysis?.best_free_option ? [p.free_first_analysis.best_free_option] : []).slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join("\n");
  const trustNotes = r.buyer_intent_pages.flatMap((p) => p.trust_and_evidence_plan?.do_not_claim ?? []).slice(0, 3).map((n, i) => `${i + 1}. ${n}`).join("\n");

  const content = [
    `## 🛒 HERMES BOT-09 — REVIEW & COMPARISON REPORT`,
    `**Run Date:** ${r.run_date} | **Niche:** ${r.input_source.validated_niche}`,
    `**Pages Created:** ${s.pages_created} | **High-Value:** ${s.high_value_pages} | **Revised/Rejected:** ${s.pages_rejected_or_revised}`,
    `**Free-First Active:** ✅ | **Budget Remaining:** $${r.budget_context.budget_remaining}`,
    ``,
    `### 💰 Top Page`,
    `**${s.top_page_title}** — Score: ${s.top_page_score}/100`,
    `**Money Path:** ${s.money_path}`,
    `**Free-First Angle:** ${s.free_first_angle}`,
    `**Budget Use:** ${s.budget_use_recommended ? "⚠️ Needs HERMES-00 approval" : "✅ Free-first — no spend needed"}`,
    `**Highest-ROI Action:** ${s.highest_roi_action}`,
    topPage ? `\n**Rankings:**\n${topPage.recommended_rankings?.slice(0, 3).map((r, i) => `${i + 1}. ${r.product_or_tool} [${r.pricing_type}] — ${r.best_for}`).join("\n") || ""}` : "",
    ``,
    `### 📊 Top Pages`, top3,
    freeTools ? `### 🆓 Free Tools Featured\n${freeTools}` : "",
    trustNotes ? `### ⚠️ Trust/Risk Notes\n${trustNotes}` : "",
    ``,
    `### ⚡ Hermes Command`,
    `> ${s.hermes_instruction}`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.success("BOT-09", "Discord report sent");
  } catch (e) { logger.error("BOT-09", `Discord failed: ${e}`); }
}

export function printReviewReport(r: ReviewComparisonReport): void {
  const C = { r: "\x1b[0m", b: "\x1b[1m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", gr: "\x1b[90m", w: "\x1b[97m", m: "\x1b[35m", red: "\x1b[31m" };
  const s = r.summary;

  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.w}  🛒 HERMES BOT-09 — REVIEW & COMPARISON BOT${C.r}`);
  console.log(`${C.gr}  Niche: ${r.input_source.validated_niche} | Run: ${r.run_date}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}`);

  console.log(`\n  Created: ${C.g}${s.pages_created}${C.r} | High-value: ${C.g}${s.high_value_pages}${C.r} | Revised/Rejected: ${C.y}${s.pages_rejected_or_revised}${C.r} | Budget remaining: $${r.budget_context.budget_remaining}`);
  console.log(`  ${C.b}${C.g}TOP PAGE:${C.r}      ${s.top_page_title} (${s.top_page_score}/100)`);
  console.log(`  ${C.b}${C.m}MONEY PATH:${C.r}    ${s.money_path}`);
  console.log(`  ${C.b}FREE-FIRST:${C.r}    ${s.free_first_angle}`);
  console.log(`  ${C.b}BUDGET:${C.r}        ${s.budget_use_recommended ? C.red + "⚠ NEEDS HERMES-00 APPROVAL" : C.g + "✓ FREE-FIRST — NO SPEND"}${C.r}`);

  r.buyer_intent_pages.slice(0, 3).forEach((p, i) => {
    const col = p.page_score >= 90 ? C.g : p.page_score >= 80 ? C.c : C.y;
    console.log(`\n  ${i + 1}. ${C.b}${p.page_title}${C.r} — ${col}${p.page_score}/100${C.r} [${p.page_type}]`);
    console.log(`     "${p.primary_keyword}" | ${p.search_intent}`);
    console.log(`     Free best: ${C.g}${p.free_first_analysis?.best_free_option || "none"}${C.r} | Paid best: ${p.free_first_analysis?.best_paid_option_if_justified || "none"}`);
    if (p.quality_check?.fake_review_risk === "high") console.log(`     ${C.red}⚠ HIGH FAKE REVIEW RISK — send to BOT-24${C.r}`);
  });

  const queued = r.handoff_tasks.filter((h) => h.status === "queued_unbuilt_bot");
  if (queued.length > 0) {
    console.log(`\n  ${C.b}QUEUED BOTS:${C.r}`);
    queued.slice(0, 4).forEach((h) => console.log(`    ${C.y}⏳ ${h.target_bot}${C.r}: ${h.task}`));
  }

  console.log(`  ${C.b}MEMORY:${C.r} ${r.memory_updates.length} items saved`);
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.g}  ⚡ FINAL COMMAND: ${s.hermes_instruction}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}\n`);
}
