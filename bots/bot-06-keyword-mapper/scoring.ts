import { KeywordScoreBreakdown, KeywordCluster } from "./schema";

export function computeKeywordScore(b: KeywordScoreBreakdown): number {
  return (
    b.buyer_intent + b.monetization_potential + b.audience_fit +
    b.pain_fit + b.content_potential + b.affiliate_potential +
    b.digital_product_potential + b.execution_fit
  );
}

export function classifyKeywordScore(score: number): string {
  if (score >= 90) return "PUBLISH IMMEDIATELY";
  if (score >= 80) return "HIGH PRIORITY";
  if (score >= 70) return "SUPPORTING KEYWORD";
  if (score >= 60) return "MONITOR";
  return "REJECT";
}

export function shouldAcceptCluster(score: number): boolean { return score >= 70; }
export function shouldRejectCluster(score: number):  boolean { return score < 60; }

export function rankClusters(clusters: KeywordCluster[]): KeywordCluster[] {
  return [...clusters].sort((a, b) => b.cluster_score - a.cluster_score);
}

export function computeAvgScore(scores: number[]): number {
  if (!scores.length) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function shouldTriggerImprovement(scores: number[]): boolean {
  if (scores.length < 3) return false;
  return scores.slice(-3).every((s) => s < 70);
}
