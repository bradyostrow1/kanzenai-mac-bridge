import { BriefScoreBreakdown, ContentBrief } from "./schema";

export function computeBriefScore(b: BriefScoreBreakdown): number {
  return (
    b.buyer_intent + b.revenue_potential + b.audience_pain_match +
    b.keyword_fit + b.product_affiliate_fit + b.digital_product_fit +
    b.execution_clarity + b.risk_safety
  );
}

export function classifyBriefScore(score: number): string {
  if (score >= 90) return "WRITE IMMEDIATELY";
  if (score >= 80) return "HIGH PRIORITY";
  if (score >= 70) return "USEFUL SUPPORTING";
  if (score >= 60) return "SAVE FOR LATER";
  return "REJECT";
}

export function shouldAcceptBrief(score: number): boolean { return score >= 70; }
export function shouldRejectBrief(score: number):  boolean { return score < 60; }

export function rankBriefs(briefs: ContentBrief[]): ContentBrief[] {
  return [...briefs].sort((a, b) => b.brief_score - a.brief_score);
}

export function computeAvgScore(scores: number[]): number {
  if (!scores.length) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function shouldTriggerImprovement(scores: number[]): boolean {
  if (scores.length < 3) return false;
  return scores.slice(-3).every((s) => s < 70);
}
