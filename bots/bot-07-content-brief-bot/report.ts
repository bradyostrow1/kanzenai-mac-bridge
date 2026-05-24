import { ContentBriefReport } from "./schema";
import { logger } from "../../lib/logger";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

export async function sendBriefDiscordReport(r: ContentBriefReport): Promise<void> {
  if (!WEBHOOK) { logger.warn("BOT-07", "No Discord webhook — skipping"); return; }

  const s = r.summary;
  const top5 = r.content_briefs.slice(0, 5).map((b, i) =>
    `${i + 1}. **${b.title}** — ${b.brief_score}/100 [${b.content_type}] | "${b.primary_keyword}"`
  ).join("\n");
  const priority = r.publishing_priority_order.slice(0, 3).map((p) =>
    `${p.rank}. ${p.title} → ${p.money_goal}`
  ).join("\n");

  const content = [
    `## 📝 HERMES BOT-07 — CONTENT BRIEF REPORT`,
    `**Run Date:** ${r.run_date} | **Niche:** ${r.input_source.validated_niche}`,
    `**Briefs Created:** ${s.briefs_created} | **High-Priority:** ${s.high_priority_briefs} | **Rejected:** ${s.rejected_briefs}`,
    ``,
    `### 💰 Top Brief`,
    `**${s.top_brief_title}** — Score: ${s.top_brief_score}/100`,
    `**Money Path:** ${s.money_path}`,
    `**Highest-ROI Action:** ${s.highest_roi_action}`,
    ``,
    `### 📊 Top 5 Briefs`, top5,
    `### 📋 Publishing Priority`, priority || "None",
    ``,
    `### ⚡ Hermes Command`,
    `> ${s.hermes_instruction}`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.success("BOT-07", "Discord report sent");
  } catch (e) { logger.error("BOT-07", `Discord failed: ${e}`); }
}

export function printBriefReport(r: ContentBriefReport): void {
  const C = { r: "\x1b[0m", b: "\x1b[1m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", gr: "\x1b[90m", w: "\x1b[97m", m: "\x1b[35m" };
  const s = r.summary;

  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.w}  📝 HERMES BOT-07 — CONTENT BRIEF BOT${C.r}`);
  console.log(`${C.gr}  Niche: ${r.input_source.validated_niche} | Run: ${r.run_date}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}`);

  console.log(`\n  Briefs: ${C.g}${s.briefs_created}${C.r} created | ${C.g}${s.high_priority_briefs}${C.r} high-priority | ${s.rejected_briefs} rejected`);
  console.log(`\n  ${C.b}${C.g}TOP BRIEF:${C.r}    ${s.top_brief_title} (${s.top_brief_score}/100)`);
  console.log(`  ${C.b}${C.m}MONEY PATH:${C.r}   ${s.money_path}`);
  console.log(`  ${C.b}BEST ACTION:${C.r}  ${s.highest_roi_action}`);

  console.log(`\n  ${C.b}CONTENT BRIEFS:${C.r}`);
  r.content_briefs.slice(0, 5).forEach((b, i) => {
    const col = b.brief_score >= 90 ? C.g : b.brief_score >= 80 ? C.c : C.y;
    console.log(`    ${i + 1}. ${C.b}${b.title}${C.r} — ${col}${b.brief_score}/100${C.r} [${b.content_type}]`);
    console.log(`       "${b.primary_keyword}" | ${b.search_intent}`);
    console.log(`       ${C.gr}Affiliate: ${b.affiliate_plan.affiliate_products_to_include.slice(0, 2).join(", ") || "none"} | Product CTA: ${b.digital_product_cta.recommended_product || "none"}${C.r}`);
  });

  console.log(`\n  ${C.b}PUBLISHING PRIORITY:${C.r}`);
  r.publishing_priority_order.slice(0, 5).forEach((p) => {
    const col = p.priority === "urgent" ? C.g : p.priority === "high" ? C.c : C.y;
    console.log(`    ${p.rank}. ${col}${p.title}${C.r} → ${p.money_goal} [${p.handoff_bot}]`);
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
