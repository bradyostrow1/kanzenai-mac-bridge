import { KeywordMapperReport } from "./schema";
import { logger } from "../../lib/logger";

const WEBHOOK = process.env.DISCORD_WEBHOOK_URL ?? "";

export async function sendKeywordDiscordReport(r: KeywordMapperReport): Promise<void> {
  if (!WEBHOOK) { logger.warn("BOT-06", "No Discord webhook — skipping"); return; }

  const s = r.summary;
  const top5 = r.top_keyword_clusters.slice(0, 5).map((c, i) =>
    `${i + 1}. **${c.cluster_name}** — ${c.cluster_score}/100 | "${c.primary_keyword}" (${c.search_intent})`
  ).join("\n");
  const buyerPages = r.topical_map.buyer_intent_pages.slice(0, 3).map((p, i) =>
    `${i + 1}. ${p.page_title} [${p.page_type}]`
  ).join("\n");
  const priority = r.publishing_priority_order.slice(0, 5).map((p) =>
    `${p.rank}. ${p.content_title} → ${p.money_goal}`
  ).join("\n");

  const content = [
    `## 🗺 HERMES BOT-06 — KEYWORD MAPPER REPORT`,
    `**Run Date:** ${r.run_date} | **Niche:** ${r.input_source.validated_niche}`,
    `**Sources:** ${s.keyword_sources_scanned} | **Raw Keywords:** ${s.raw_keywords_found} | **Clusters:** ${s.keyword_clusters_created} | **High-Value:** ${s.high_value_clusters} | **Rejected:** ${s.rejected_keywords}`,
    ``,
    `### 💰 Top Keyword Cluster`,
    `**${s.top_keyword_cluster}** — Score: ${s.top_cluster_score}/100`,
    `**Money Path:** ${s.money_path}`,
    `**Best Content Asset:** ${s.highest_roi_content_asset}`,
    ``,
    `### 📊 Top 5 Keyword Clusters`, top5,
    `### 🛒 Top Buyer-Intent Pages`, buyerPages || "None",
    `### 📋 Publishing Priority`, priority || "None",
    ``,
    `### ⚡ Hermes Command`,
    `> ${s.hermes_instruction}`,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    logger.success("BOT-06", "Discord report sent");
  } catch (e) { logger.error("BOT-06", `Discord failed: ${e}`); }
}

export function printKeywordReport(r: KeywordMapperReport): void {
  const C = { r: "\x1b[0m", b: "\x1b[1m", c: "\x1b[36m", g: "\x1b[32m", y: "\x1b[33m", gr: "\x1b[90m", w: "\x1b[97m", m: "\x1b[35m" };
  const s = r.summary;

  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.w}  🗺 HERMES BOT-06 — KEYWORD MAPPER${C.r}`);
  console.log(`${C.gr}  Niche: ${r.input_source.validated_niche} | Run: ${r.run_date}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}`);

  console.log(`\n  Sources: ${s.keyword_sources_scanned} | Raw: ${s.raw_keywords_found} | Clusters: ${s.keyword_clusters_created} | High-value: ${C.g}${s.high_value_clusters}${C.r} | Rejected: ${s.rejected_keywords}`);
  console.log(`\n  ${C.b}${C.g}TOP CLUSTER:${C.r}   ${s.top_keyword_cluster} (${s.top_cluster_score}/100)`);
  console.log(`  ${C.b}${C.m}MONEY PATH:${C.r}    ${s.money_path}`);
  console.log(`  ${C.b}BEST ASSET:${C.r}    ${s.highest_roi_content_asset}`);

  console.log(`\n  ${C.b}TOP KEYWORD CLUSTERS:${C.r}`);
  r.top_keyword_clusters.slice(0, 5).forEach((c, i) => {
    const col = c.cluster_score >= 90 ? C.g : c.cluster_score >= 80 ? C.c : C.y;
    console.log(`    ${i + 1}. ${C.b}${c.cluster_name}${C.r} — ${col}${c.cluster_score}/100${C.r}`);
    console.log(`       "${c.primary_keyword}" | ${c.search_intent}`);
  });

  console.log(`\n  ${C.b}PUBLISHING PRIORITY:${C.r}`);
  r.publishing_priority_order.slice(0, 5).forEach((p) => {
    const col = p.priority === "urgent" ? C.g : p.priority === "high" ? C.c : C.y;
    console.log(`    ${p.rank}. ${col}${p.content_title}${C.r} → ${p.money_goal}`);
  });

  const queued = r.handoff_tasks.filter((h) => h.status === "queued_unbuilt_bot");
  if (queued.length > 0) {
    console.log(`\n  ${C.b}QUEUED NEXT BOTS:${C.r}`);
    queued.slice(0, 4).forEach((h) => console.log(`    ${C.y}⏳ ${h.target_bot}${C.r}: ${h.task}`));
  }

  console.log(`  ${C.b}MEMORY UPDATES:${C.r} ${r.memory_updates.length} items saved`);
  console.log(`\n${C.b}${C.c}${"━".repeat(70)}${C.r}`);
  console.log(`${C.b}${C.g}  ⚡ FINAL COMMAND: ${s.hermes_instruction}${C.r}`);
  console.log(`${C.b}${C.c}${"━".repeat(70)}${C.r}\n`);
}
