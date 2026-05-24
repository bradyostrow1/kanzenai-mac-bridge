export type PageType =
  | "single_review" | "comparison" | "alternatives" | "best_tools"
  | "pricing" | "use_case" | "buyer_guide" | "feature_table"
  | "best_for_x" | "cheaper_alternative" | "free_alternative"
  | "multi_tool_comparison" | "is_it_worth_it" | "best_free_tools"
  | "free_vs_paid" | "best_under_budget" | "no_cost_stack";

export type SearchIntent  = "Compare" | "Buy" | "Find Tool" | "Find Alternative" | "Check Pricing" | "Choose Software" | "Solve Problem";
export type BuyingStage   = "early_research" | "comparing_options" | "ready_to_buy" | "switching_tools";
export type PricingType   = "free" | "freemium" | "paid" | "unknown";
export type FreePlan      = "yes" | "no" | "unknown";
export type AffiliateStatus = "confirmed" | "possible" | "unknown" | "none";
export type Weight        = "low" | "medium" | "high";
export type Priority      = "low" | "medium" | "high" | "urgent";
export type RiskLevel     = "low" | "medium" | "high";
export type MemoryStatus  = "save" | "needs_review" | "reject";
export type HandoffStatus = "ready" | "queued_unbuilt_bot";
export type MemoryCategory = "Content Memory" | "Affiliate Memory" | "Product Memory" | "SEO Memory" | "Risk Memory" | "Budget Memory";

export interface PageScoreBreakdown {
  buyer_intent_strength:     number; // 0-20
  affiliate_revenue_potential: number; // 0-20
  audience_pain_match:       number; // 0-15
  product_fit:               number; // 0-15
  trust_evidence_safety:     number; // 0-10
  free_first_value:          number; // 0-5
  differentiation:           number; // 0-5
  seo_fit:                   number; // 0-5
  execution_readiness:       number; // 0-5
}

export interface ProductRanking {
  rank:                       number;
  product_or_tool:            string;
  pricing_type:               PricingType;
  free_plan_available:        FreePlan;
  free_alternative_available: FreePlan;
  best_for:                   string;
  why_ranked_here:            string;
  strengths:                  string[];
  limitations:                string[];
  ideal_user:                 string;
  not_ideal_for:              string;
  affiliate_status:           AffiliateStatus;
  cta_angle:                  string;
  upgrade_trigger:            string;
  budget_impact:              string;
}

export interface PageSection {
  heading:          string;
  content:          string;
  purpose:          string;
  monetization_note: string;
}

export interface PageContent {
  headline:          string;
  intro:             string;
  quick_answer:      string;
  comparison_table:  string[];
  main_sections:     PageSection[];
  free_vs_paid_section: string;
  pros_and_cons:     string[];
  final_recommendation: string;
  cta:               string;
  faq:               string[];
}

export interface BuyerIntentPage {
  page_id:           string;
  page_title:        string;
  page_type:         PageType;
  primary_keyword:   string;
  secondary_keywords: string[];
  search_intent:     SearchIntent;
  target_reader: {
    audience:                  string;
    reader_problem:            string;
    buying_stage:              BuyingStage;
    decision_they_need_to_make: string;
  };
  page_score:        number;
  confidence:        number;
  score_breakdown:   PageScoreBreakdown;
  money_analysis: {
    traffic_path:             string;
    affiliate_click_path:     string;
    email_signup_path:        string;
    digital_product_path:     string;
    sponsor_path:             string;
    conversion_path:          string;
    why_this_can_generate_revenue: string;
  };
  free_first_analysis: {
    free_options_included:           boolean;
    best_free_option:                string;
    best_free_tier_option:           string;
    best_paid_option_if_justified:   string;
    when_free_is_enough:             string;
    when_to_upgrade:                 string;
    budget_use_recommended:          boolean;
    budget_reason:                   string;
    requires_hermes_approval:        boolean;
  };
  ranking_criteria:      Array<{ criterion: string; why_it_matters: string; weight: Weight }>;
  recommended_rankings:  ProductRanking[];
  page_content:          PageContent;
  affiliate_plan: {
    affiliate_products_mentioned: string[];
    disclosure_text:              string;
    cta_placements:               string[];
    avoid_overpromotion_notes:    string;
    risk_notes:                   string;
  };
  trust_and_evidence_plan: {
    claims_to_verify:         string[];
    sources_needed:           string[];
    first_hand_testing_needed: boolean;
    do_not_claim:             string[];
    transparency_notes:       string;
  };
  seo_plan: {
    meta_title:             string;
    meta_description:       string;
    slug:                   string;
    internal_links:         string[];
    external_evidence_needed: string[];
    schema_suggestions:     string[];
  };
  quality_check: {
    fake_review_risk:      RiskLevel;
    unsupported_claims:    string[];
    generic_ai_risk:       RiskLevel;
    paid_tool_bias_risk:   RiskLevel;
    needs_human_review:    boolean;
    revision_notes:        string[];
  };
  risk_notes: {
    risk_level:                 RiskLevel;
    affiliate_disclosure_needed: boolean;
    claims_to_verify:           string[];
    send_to_risk_bot:           boolean;
  };
  next_action: string;
  handoff:     string[];
  memory_log: {
    status:           MemoryStatus;
    priority:         Priority;
    reason_saved:     string;
    related_keywords: string[];
    related_pains:    string[];
    related_tools:    string[];
    date_created:     string;
  };
}

export interface ReviewComparisonReport {
  bot:            "BOT-09";
  agent_name:     "Review & Comparison Bot";
  reports_to:     "HERMES-00";
  run_date:       string;
  business_model: string;
  free_first_rule_active: boolean;
  budget_context: {
    potential_budget_total:    number;
    budget_used:               number;
    budget_remaining:          number;
    paid_tools_recommended:    string[];
    free_alternatives_available: string[];
    spend_approval_required_from: string;
  };
  input_source: {
    from_bots:           string[];
    mission_id:          string;
    validated_niche:     string;
    target_audience:     string;
    page_type_requested: string;
    primary_keyword:     string;
    products_or_tools:   string[];
  };
  summary: {
    pages_created:              number;
    high_value_pages:           number;
    pages_rejected_or_revised:  number;
    top_page_title:             string;
    top_page_score:             number;
    money_path:                 string;
    free_first_angle:           string;
    budget_use_recommended:     boolean;
    highest_roi_action:         string;
    hermes_instruction:         string;
  };
  buyer_intent_pages:          BuyerIntentPage[];
  rejected_or_revision_needed: Array<{ page_title: string; reason: string; fix_required: string }>;
  handoff_tasks: Array<{ target_bot: string; task: string; required_output: string; priority: Priority; status: HandoffStatus; queued_reason?: string }>;
  memory_updates: Array<{ category: MemoryCategory; title: string; content: string; priority: string; reason_saved: string }>;
  bot_notes: {
    strongest_page_pattern:             string;
    weakest_page_pattern:               string;
    best_free_first_opportunity:        string;
    recommended_next_buyer_intent_page: string;
    recommended_prompt_improvements:    string[];
  };
}

export interface ReviewMemoryStore {
  last_run:       string;
  total_runs:     number;
  all_pages:      string[];
  approved_pages: string[];
  rejected_pages: string[];
  avg_scores:     number[];
  prompt_version: number;
}
