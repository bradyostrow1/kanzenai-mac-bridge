// ── scoring.ts ───────────────────────────────────────────────────────────────
import { ProgramScoreBreakdown, MonetizationProgram } from "./schema";

export function computeProgramScore(b: ProgramScoreBreakdown): number {
  return b.revenue_potential + b.audience_fit + b.product_pain_fit + b.trust_quality +
    b.approval_accessibility + b.free_to_join_value + b.content_fit +
    b.tracking_clarity + b.compliance_safety;
}
export const classifyScore  = (s: number) => s >= 90 ? "PRIORITY" : s >= 80 ? "HIGH PRIORITY" : s >= 70 ? "USEFUL" : s >= 60 ? "WATCHLIST" : "REJECT";
export const shouldAccept   = (s: number) => s >= 70;
export const rankPrograms   = (p: MonetizationProgram[]) => [...p].sort((a, b) => b.program_score - a.program_score);
export const computeAvgScore = (scores: number[]) => scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
export const shouldTrigger   = (scores: number[]) => scores.length >= 3 && scores.slice(-3).every(s => s < 70);
