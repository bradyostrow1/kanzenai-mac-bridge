import { ContentMultiplierReport } from "./schema";
import { logger } from "../../lib/logger";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

export async function sendMultiplierDiscordReport(r: ContentMultiplierReport): Promise<void> {
  if (!WEBHOOK) { logger.warn("BOT-11", "No Discord webhook — skipping"); return; }
  const s = r.summary;
  const top5 = r.repurposed_assets.slice(0, 5).map((a, i) =>
    `${i + 1}. **${a.asset_title}** — ${a.asset_score}/100 [${a.platform}]`
  ).join("\n");
  const hooks = r.hook_bank.slice(0, 3).map((h, i) => `${i + 1}. "${h.hook}" [${h.platform}]`).join("\n");
  const content = [
    `## 🔁 HERMES BOT-11 — CONTENT MULTIPLIER REPORT`,
    `**Source:** ${r.input_source.source_asset_title} | **Niche:** ${r.input_source.validated_niche}`,
    `**Created:** ${s.repurposed_assets_created} | **High-Quality:** ${s.high_quality_assets} | **Budget:** $${r.budget_context.budget_remaining} remaining`,
    ``,
    `### 💰 Top Asset: ${s.top_asset_title} (${s.top_asset_score}/100)`,
    `**Best Platform:** ${s.best_platform} | **Money Path:** ${s.money_path}`,
    `**Free Plan:** ${s.free_distribution_plan}`,
    `**Highest-ROI Action:** ${s.highest_roi_action}`,
    ``, `### 📊 Top Assets`, top5,
    hooks ? `### 🎣 Best Hooks\n${hooks}` : "",
    ``, `### ⚡ Hermes Command`, `> ${s.hermes_instruction}`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.success("BOT-11", "Discord report sent");
  } catch (e) { logger.error("BOT-11", `Discord failed: ${e}`); }
}

export function printMultiplierReport(r: ContentMultiplierReport): void {
  const C = { r: "\x1b[0m", b: "\x1b[1m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", gr: "\x1b[90m", w: "\x1b[97m", m: "\x1b[35m" };
  const s = r.summary;
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.w}  🔁 HERMES BOT-11 — CONTENT MULTIPLIER ENGINE${C.r}`);
  console.log(`${C.gr}  Source: "${r.input_source.source_asset_title}" | Run: ${r.run_date}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`\n  Created: ${C.g}${s.repurposed_assets_created}${C.r} | High-quality: ${C.g}${s.high_quality_assets}${C.r} | Budget: $${r.budget_context.budget_remaining}`);
  console.log(`  ${C.b}${C.g}TOP:${C.r}       ${s.top_asset_title} (${s.top_asset_score}/100) [${s.best_platform}]`);
  console.log(`  ${C.b}${C.m}MONEY:${C.r}     ${s.money_path}`);
  console.log(`  ${C.b}FREE:${C.r}      ${s.free_distribution_plan}`);
  r.repurposed_assets.slice(0, 5).forEach((a, i) => {
    const col = a.asset_score >= 90 ? C.g : a.asset_score >= 80 ? C.c : C.y;
    console.log(`    ${i + 1}. ${C.b}${a.asset_title}${C.r} — ${col}${a.asset_score}/100${C.r} [${a.platform}]`);
    if (a.content.hook) console.log(`       Hook: "${a.content.hook.slice(0, 60)}..."`);
  });
  if (r.hook_bank.length > 0) {
    console.log(`\n  ${C.b}HOOK BANK (${r.hook_bank.length}):${C.r}`);
    r.hook_bank.slice(0, 3).forEach((h) => console.log(`    "${C.y}${h.hook}${C.r}" [${h.platform}]`));
  }
  const queued = r.handoff_tasks.filter((h) => h.status === "queued_unbuilt_bot");
  if (queued.length) { console.log(`\n  ${C.b}QUEUED:${C.r}`); queued.slice(0, 4).forEach((h) => console.log(`    ${C.y}⏳ ${h.target_bot}${C.r}: ${h.task}`)); }
  console.log(`  ${C.b}MEMORY:${C.r} ${r.memory_updates.length} items saved`);
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.g}  ⚡ FINAL COMMAND: ${s.hermes_instruction}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}\n`);
}
