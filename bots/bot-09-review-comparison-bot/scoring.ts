import { PageScoreBreakdown, BuyerIntentPage } from "./schema";

export function computePageScore(b: PageScoreBreakdown): number {
  return (
    b.buyer_intent_strength + b.affiliate_revenue_potential +
    b.audience_pain_match + b.product_fit + b.trust_evidence_safety +
    b.free_first_value + b.differentiation + b.seo_fit + b.execution_readiness
  );
}

export function classifyPageScore(score: number): string {
  if (score >= 90) return "READY FOR PUBLISHING";
  if (score >= 80) return "STRONG BUYER-INTENT PAGE";
  if (score >= 70) return "USABLE — NEEDS REVIEW";
  if (score >= 60) return "WEAK — REVISE";
  return "REJECT";
}

export function shouldAcceptPage(score: number): boolean { return score >= 70; }
export function shouldRejectPage(score: number):  boolean { return score < 60; }

export function rankPages(pages: BuyerIntentPage[]): BuyerIntentPage[] {
  return [...pages].sort((a, b) => b.page_score - a.page_score);
}

export function computeAvgScore(scores: number[]): number {
  if (!scores.length) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

export function shouldTriggerImprovement(scores: number[]): boolean {
  if (scores.length < 3) return false;
  return scores.slice(-3).every((s) => s < 70);
}

export function checkFreeFirstCompliance(page: BuyerIntentPage): boolean {
  return page.free_first_analysis.free_options_included &&
    !!page.free_first_analysis.best_free_option;
}

export function checkBudgetProtection(page: BuyerIntentPage): boolean {
  return !page.free_first_analysis.budget_use_recommended ||
    page.free_first_analysis.requires_hermes_approval;
}
