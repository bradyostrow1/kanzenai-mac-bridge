import { SEOOrganicReport } from "./schema";
import { logger } from "../../lib/logger";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

export async function sendSEODiscordReport(r: SEOOrganicReport): Promise<void> {
  if (!WEBHOOK) { logger.warn("BOT-13", "No Discord webhook — skipping"); return; }
  const s = r.summary;
  const topPlan = r.seo_plans[0];
  const top3 = r.seo_plans.slice(0, 3).map((p, i) =>
    `${i + 1}. **${p.asset_title}** — ${p.plan_score}/100 | "${p.primary_keyword}" [${p.search_intent}]`
  ).join("\n");
  const internalLinks = topPlan?.internal_link_plan.priority_internal_links.slice(0, 3).map((l, i) => `${i + 1}. ${l}`).join("\n") || "None";
  const opps = r.organic_growth_opportunities.slice(0, 3).map((o, i) => `${i + 1}. **${o.opportunity}** [${o.opportunity_type}] — ${o.priority}`).join("\n");
  const content = [
    `## 🔍 HERMES BOT-13 — SEO & ORGANIC SEARCH REPORT`,
    `**Source:** ${r.input_source.source_asset_title} | **Niche:** ${r.input_source.validated_niche}`,
    `**Plans:** ${s.seo_plans_created} | **High-Quality:** ${s.high_quality_plans} | **Budget:** $${r.budget_context.budget_remaining}`,
    ``,
    `### 💰 Top SEO Plan: **${s.top_asset}** (${s.top_plan_score}/100)`,
    `**Keyword:** "${r.input_source.primary_keyword}" | **Intent:** ${r.input_source.search_intent}`,
    `**Money Path:** ${s.money_path}`,
    `**Free SEO Plan:** ${s.free_seo_plan}`,
    topPlan ? `**Meta Title:** ${topPlan.metadata.recommended_meta_title}` : "",
    topPlan ? `**Slug:** /${topPlan.metadata.slug}` : "",
    ``, `### 📊 Top Plans`, top3,
    `### 🔗 Priority Internal Links\n${internalLinks}`,
    opps ? `### 📈 Organic Growth Opportunities\n${opps}` : "",
    ``, `### ⚡ Hermes Command`, `> ${s.hermes_instruction}`,
  ].filter(Boolean).join("\n");
  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.success("BOT-13", "Discord report sent");
  } catch (e) { logger.error("BOT-13", `Discord failed: ${e}`); }
}

export function printSEOReport(r: SEOOrganicReport): void {
  const C = { r: "\x1b[0m", b: "\x1b[1m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", gr: "\x1b[90m", w: "\x1b[97m", m: "\x1b[35m", red: "\x1b[31m" };
  const s = r.summary;
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.w}  🔍 HERMES BOT-13 — SEO & ORGANIC SEARCH ENGINE${C.r}`);
  console.log(`${C.gr}  Asset: "${r.input_source.source_asset_title}" | Run: ${r.run_date}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`\n  Plans: ${C.g}${s.seo_plans_created}${C.r} | High-quality: ${C.g}${s.high_quality_plans}${C.r} | Budget: $${r.budget_context.budget_remaining}`);
  console.log(`  ${C.b}${C.g}TOP:${C.r}      ${s.top_asset} (${s.top_plan_score}/100)`);
  console.log(`  ${C.b}${C.m}KEYWORD:${C.r}  "${r.input_source.primary_keyword}" | ${r.input_source.search_intent}`);
  console.log(`  ${C.b}MONEY:${C.r}    ${s.money_path}`);
  console.log(`  ${C.b}FREE SEO:${C.r} ${s.free_seo_plan}`);
  r.seo_plans.slice(0, 3).forEach((p, i) => {
    const col = p.plan_score >= 90 ? C.g : p.plan_score >= 80 ? C.c : C.y;
    console.log(`\n  ${i + 1}. ${C.b}${p.asset_title}${C.r} — ${col}${p.plan_score}/100${C.r}`);
    console.log(`     Title: "${p.metadata.recommended_meta_title}"`);
    console.log(`     Slug: /${p.metadata.slug}`);
    console.log(`     ${C.gr}Schema: ${p.schema_plan.schema_types_recommended.join(", ")}${C.r}`);
    if (p.quality_check.cannibalization_risk === "high") console.log(`     ${C.red}⚠ CANNIBALIZATION RISK${C.r}`);
  });
  if (r.organic_growth_opportunities.length) {
    console.log(`\n  ${C.b}GROWTH OPPORTUNITIES:${C.r}`);
    r.organic_growth_opportunities.slice(0, 3).forEach(o => console.log(`    📈 ${C.y}${o.opportunity}${C.r} [${o.opportunity_type}] — ${o.priority}`));
  }
  const queued = r.handoff_tasks.filter(h => h.status === "queued_unbuilt_bot");
  if (queued.length) { console.log(`\n  ${C.b}QUEUED:${C.r}`); queued.slice(0, 4).forEach(h => console.log(`    ${C.y}⏳ ${h.target_bot}${C.r}: ${h.task}`)); }
  console.log(`  ${C.b}MEMORY:${C.r} ${r.memory_updates.length} items saved`);
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.g}  ⚡ FINAL COMMAND: ${s.hermes_instruction}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}\n`);
}
