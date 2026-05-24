import { readJSON, writeJSON } from "../../lib/storage";
import { AffiliateMemoryStore, MonetizationProgram, LinkPlacementItem } from "./schema";
import { today } from "../../lib/date";
import { computeAvgScore } from "./scoring";
import { write } from "../bot-21-memory-bot/index";

const MEMORY_FILE = "affiliate-partnership-memory.json";
const RUNS_FILE   = "affiliate-partnership-runs.json";
const PROGRAMS_F  = "affiliate-programs.json";
const PARTNER_F   = "partner-programs.json";
const REFERRAL_F  = "referral-programs.json";
const LINKMAP_F   = "affiliate-link-map.json";
const MONMAP_F    = "monetization-map.json";
const APPLIST_F   = "application-priority-list.json";
const DISC_F      = "disclosure-requirements.json";

const DEFAULT: AffiliateMemoryStore = {
  last_run: "", total_runs: 0, known_programs: [],
  applied_programs: [], rejected_programs: [], avg_scores: [], prompt_version: 1,
};

export function loadMemory(): AffiliateMemoryStore { return readJSON<AffiliateMemoryStore>(MEMORY_FILE, DEFAULT); }
export function saveMemory(m: AffiliateMemoryStore): void { writeJSON(MEMORY_FILE, m); }

export function updateMemory(m: AffiliateMemoryStore, programs: MonetizationProgram[], linkMap: LinkPlacementItem[], score: number): AffiliateMemoryStore {
  const u = { ...m }; u.last_run = today(); u.total_runs++; u.avg_scores.push(score);
  if (u.avg_scores.length > 20) u.avg_scores = u.avg_scores.slice(-20);

  for (const p of programs) {
    if (!u.known_programs.includes(p.program_name)) u.known_programs.push(p.program_name);
    if (p.memory_log.status === "reject" && !u.rejected_programs.includes(p.program_name)) u.rejected_programs.push(p.program_name);
  }
  if (u.known_programs.length > 300) u.known_programs = u.known_programs.slice(-300);

  // Separate by type for easier lookup
  const affiliates = programs.filter(p => p.program_type.includes("affiliate"));
  const partners   = programs.filter(p => p.program_type.includes("partner") || p.program_type === "direct_brand_partner");
  const referrals  = programs.filter(p => p.program_type.includes("referral") || p.program_type.includes("sponsorship"));

  writeJSON(PROGRAMS_F, { programs: affiliates, updated: today() });
  if (partners.length)  writeJSON(PARTNER_F,  { programs: partners,  updated: today() });
  if (referrals.length) writeJSON(REFERRAL_F, { programs: referrals, updated: today() });
  if (linkMap.length)   writeJSON(LINKMAP_F,  { links: linkMap, updated: today() });

  const monetizationMap = programs.map(p => ({ id: p.program_id, name: p.program_name, assets: p.asset_mapping.best_assets_to_use, ctas: p.asset_mapping.recommended_ctas }));
  writeJSON(MONMAP_F, { map: monetizationMap, updated: today() });

  const disclosures = programs.map(p => ({ program: p.program_name, text: p.disclosure_plan.recommended_disclosure_text, placement: p.disclosure_plan.placement_notes }));
  writeJSON(DISC_F, { disclosures, updated: today() });

  return u;
}

export function getAvgScore(m: AffiliateMemoryStore): number { return computeAvgScore(m.avg_scores.slice(-10)); }

export function saveProgramToMemoryBot(p: MonetizationProgram): void {
  try {
    write({
      category: "Affiliate Memory" as any,
      title: p.program_name,
      content: `Type:${p.program_type} | Score:${p.program_score} | Free:${p.free_to_join} | Verified:${p.verification_status} | Trust:${p.trust_check.trust_level} | Revenue:${p.money_analysis.why_this_can_generate_revenue}`,
      source_bot: "BOT-16",
      source_reference: p.website_or_reference,
      related_keywords: p.memory_log.related_keywords,
      related_entities: [p.program_type, p.product_or_company],
    });
  } catch (e) { /* Memory unavailable */ }
}

export function appendRun(cycle: number, niche: string, score: number, programs: number): void {
  const runs = readJSON<{ runs: object[] }>(RUNS_FILE, { runs: [] });
  runs.runs.push({ cycle, date: today(), niche, score, programs });
  if (runs.runs.length > 100) runs.runs = runs.runs.slice(-100);
  writeJSON(RUNS_FILE, runs);
}
