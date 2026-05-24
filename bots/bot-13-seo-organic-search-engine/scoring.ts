// ── scoring.ts ───────────────────────────────────────────────────────────────
import { SEOScoreBreakdown, SEOPlan } from "./schema";

export function computeSEOScore(b: SEOScoreBreakdown): number {
  return b.search_intent_match + b.revenue_potential + b.keyword_fit +
    b.internal_link_value + b.topical_authority_value + b.human_first_quality +
    b.trust_compliance_safety + b.free_tracking_fit + b.execution_readiness;
}
export const classifyScore  = (s: number) => s >= 90 ? "READY" : s >= 80 ? "STRONG" : s >= 70 ? "USABLE" : s >= 60 ? "WEAK" : "REJECT";
export const shouldAccept   = (s: number) => s >= 70;
export const rankPlans      = (plans: SEOPlan[]) => [...plans].sort((a, b) => b.plan_score - a.plan_score);
export const computeAvgScore = (scores: number[]) => scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
export const shouldTrigger   = (scores: number[]) => scores.length >= 3 && scores.slice(-3).every(s => s < 70);
