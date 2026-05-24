// ── scoring.ts ───────────────────────────────────────────────────────────────
import { InsightScoreBreakdown, CommunityInsight } from "./schema";

export function computeInsightScore(b: InsightScoreBreakdown): number {
  return b.frequency_repetition + b.audience_fit + b.pain_severity +
    b.monetization_potential + b.content_potential +
    b.affiliate_digital_product_fit + b.source_quality +
    b.free_traffic_potential + b.compliance_safety;
}

export const classifyScore  = (s: number) => s >= 90 ? "ACT IMMEDIATELY" : s >= 80 ? "STRONG SIGNAL" : s >= 70 ? "USEFUL SIGNAL" : s >= 60 ? "WATCHLIST" : "REJECT";
export const shouldAccept   = (s: number) => s >= 70;
export const rankInsights   = (i: CommunityInsight[]) => [...i].sort((a, b) => b.insight_score - a.insight_score);
export const computeAvgScore = (scores: number[]) => scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
export const shouldTrigger   = (scores: number[]) => scores.length >= 3 && scores.slice(-3).every(s => s < 70);
