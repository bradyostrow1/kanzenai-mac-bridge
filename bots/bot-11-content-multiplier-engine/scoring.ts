// ── scoring.ts ───────────────────────────────────────────────────────────────
import { MultiplierScoreBreakdown, RepurposedAsset } from "./schema";

export function computeMultiplierScore(b: MultiplierScoreBreakdown): number {
  return b.revenue_potential + b.platform_fit + b.audience_pain_match +
    b.hook_strength + b.clarity + b.cta_strength + b.repurpose_efficiency +
    b.trust_compliance_safety + b.free_traffic_potential + b.execution_readiness;
}

export function classifyScore(score: number): string {
  if (score >= 90) return "READY FOR DISTRIBUTION";
  if (score >= 80) return "STRONG — MINOR EDITS";
  if (score >= 70) return "USABLE — NEEDS REVIEW";
  if (score >= 60) return "WEAK — REVISE";
  return "REJECT";
}

export const shouldAccept = (s: number) => s >= 70;
export const shouldReject = (s: number) => s < 60;

export function rankAssets(assets: RepurposedAsset[]): RepurposedAsset[] {
  return [...assets].sort((a, b) => b.asset_score - a.asset_score);
}

export function computeAvgScore(scores: number[]): number {
  if (!scores.length) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function shouldTriggerImprovement(scores: number[]): boolean {
  return scores.length >= 3 && scores.slice(-3).every(s => s < 70);
}
