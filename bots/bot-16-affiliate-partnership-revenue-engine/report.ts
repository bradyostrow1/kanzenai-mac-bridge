import { AffiliatePartnershipReport } from "./schema";
import { logger } from "../../lib/logger";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

export async function sendAffiliateDiscordReport(r: AffiliatePartnershipReport): Promise<void> {
  if (!WEBHOOK) { logger.warn("BOT-16", "No Discord webhook — skipping"); return; }
  const s = r.summary;
  const top3 = r.monetization_programs.slice(0, 3).map((p, i) =>
    `${i + 1}. **${p.program_name}** — ${p.program_score}/100 [${p.free_to_join === "yes" ? "🆓 FREE" : "💰 Paid"}] | ${p.verification_status}`
  ).join("\n");
  const priority = r.application_priority_order.slice(0, 3).map((a, i) => `${i + 1}. ${a.program_name} [${a.free_to_join}] → ${a.expected_money_path}`).join("\n");
  const discRisks = r.monetization_programs.filter(p => p.disclosure_plan.risk_if_not_disclosed).slice(0, 3).map((p, i) => `${i + 1}. ${p.program_name}: ${p.disclosure_plan.risk_if_not_disclosed}`).join("\n");
  const content = [
    `## 💰 HERMES BOT-16 — AFFILIATE & PARTNERSHIP REVENUE REPORT`,
    `**Niche:** ${r.input_source.validated_niche} | **Programs:** ${s.programs_evaluated} | **High-Value:** ${s.high_value_programs}`,
    `**Budget:** $${r.budget_context.budget_remaining} | **Budget Needed:** ${s.budget_use_recommended ? "⚠️ Yes — needs HERMES-00 approval" : "✅ Free-first"}`,
    ``,
    `### 💰 Top Program: **${s.top_program}** (${s.top_program_score}/100)`,
    `**Best Free-to-Join:** ${s.best_free_to_join_program}`,
    `**Money Path:** ${s.money_path}`,
    `**Highest-ROI Action:** ${s.highest_roi_action}`,
    ``, `### 📊 Top Programs`, top3,
    priority ? `### 🎯 Application Priority\n${priority}` : "",
    discRisks ? `### ⚠️ Disclosure/Risk Notes\n${discRisks}` : "",
    ``, `### ⚡ Hermes Command`, `> ${s.hermes_instruction}`,
  ].filter(Boolean).join("\n");
  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.success("BOT-16", "Discord report sent");
  } catch (e) { logger.error("BOT-16", `Discord failed: ${e}`); }
}

export function printAffiliateReport(r: AffiliatePartnershipReport): void {
  const C = { r: "\x1b[0m", b: "\x1b[1m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", gr: "\x1b[90m", w: "\x1b[97m", m: "\x1b[35m", red: "\x1b[31m" };
  const s = r.summary;
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.w}  💰 HERMES BOT-16 — AFFILIATE & PARTNERSHIP REVENUE ENGINE${C.r}`);
  console.log(`${C.gr}  Niche: ${r.input_source.validated_niche} | Run: ${r.run_date}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`\n  Programs: ${C.g}${s.programs_evaluated}${C.r} | High-value: ${C.g}${s.high_value_programs}${C.r} | Budget: $${r.budget_context.budget_remaining}`);
  console.log(`  ${C.b}TOP:${C.r}      ${s.top_program} (${s.top_program_score}/100)`);
  console.log(`  ${C.b}FREE BEST:${C.r} ${s.best_free_to_join_program}`);
  console.log(`  ${C.b}MONEY:${C.r}    ${s.money_path}`);
  r.monetization_programs.slice(0, 4).forEach((p, i) => {
    const col = p.program_score >= 90 ? C.g : p.program_score >= 80 ? C.c : C.y;
    const freeTag = p.free_to_join === "yes" ? `${C.g}[FREE]${C.r}` : p.free_to_join === "no" ? `${C.red}[PAID]${C.r}` : `${C.y}[?]${C.r}`;
    const verifyTag = p.verification_status === "verified" ? `${C.g}✓${C.r}` : `${C.y}⚠ needs verify${C.r}`;
    console.log(`\n  ${i + 1}. ${C.b}${p.program_name}${C.r} — ${col}${p.program_score}/100${C.r} ${freeTag} ${verifyTag}`);
    console.log(`     ${C.gr}Trust: ${p.trust_check.trust_level} | Commission: ${p.program_details.commission_or_payout_notes}${C.r}`);
    if (p.trust_check.trust_level === "low") console.log(`     ${C.red}⚠ LOW TRUST — check before promoting${C.r}`);
  });
  if (r.application_priority_order.length) {
    console.log(`\n  ${C.b}APPLY FIRST:${C.r}`);
    r.application_priority_order.slice(0, 3).forEach(a => console.log(`    ${C.g}${a.rank}. ${a.program_name}${C.r} [${a.free_to_join}] → ${a.expected_money_path}`));
  }
  const queued = r.handoff_tasks.filter(h => h.status === "queued_unbuilt_bot");
  if (queued.length) { console.log(`\n  ${C.b}QUEUED:${C.r}`); queued.slice(0, 4).forEach(h => console.log(`    ${C.y}⏳ ${h.target_bot}${C.r}: ${h.task}`)); }
  console.log(`  ${C.b}MEMORY:${C.r} ${r.memory_updates.length} items saved`);
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.g}  ⚡ FINAL COMMAND: ${s.hermes_instruction}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}\n`);
}
