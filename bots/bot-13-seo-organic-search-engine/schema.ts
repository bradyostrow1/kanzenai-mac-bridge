export type SEOAssetType =
  | "seo_article" | "affiliate_review" | "comparison_page" | "alternatives_page"
  | "best_tools_page" | "pricing_page" | "use_case_page" | "newsletter_archive"
  | "digital_product_page" | "landing_page" | "directory_page" | "template_page"
  | "prompt_pack_page" | "calculator_page" | "checklist_page";

export type SearchIntent =
  | "Learn" | "Compare" | "Buy" | "Solve Problem" | "Find Tool"
  | "Find Alternative" | "Check Pricing" | "Get Template" | "Get Checklist"
  | "Get Prompt" | "Get Calculator" | "Understand Workflow"
  | "Choose Software" | "Subscribe / Follow";

export type RefreshFrequency  = "none" | "monthly" | "quarterly" | "biannual" | "annual";
export type GrowthOpportunity = "internal_linking" | "content_refresh" | "topical_cluster" | "buyer_intent_page" | "digital_product_page" | "affiliate_page" | "directory_page" | "newsletter_archive" | "free_tool_page";
export type RiskLevel         = "low" | "medium" | "high";
export type Priority          = "low" | "medium" | "high" | "urgent";
export type MemoryStatus      = "save" | "needs_review" | "reject";
export type HandoffStatus     = "ready" | "queued_unbuilt_bot";
export type MemoryCategory    = "SEO Memory" | "Organic Search Memory" | "Content Memory" | "Affiliate Memory" | "Digital Product Memory" | "Budget Memory";

export interface SEOScoreBreakdown {
  search_intent_match:     number; // 0-20
  revenue_potential:       number; // 0-15
  keyword_fit:             number; // 0-15
  internal_link_value:     number; // 0-10
  topical_authority_value: number; // 0-10
  human_first_quality:     number; // 0-10
  trust_compliance_safety: number; // 0-10
  free_tracking_fit:       number; // 0-5
  execution_readiness:     number; // 0-5
}

export interface SEOPlan {
  plan_id:             string;
  source_asset_id:     string;
  asset_title:         string;
  asset_type:          SEOAssetType;
  primary_keyword:     string;
  secondary_keywords:  string[];
  search_intent:       SearchIntent;
  plan_score:          number;
  confidence:          number;
  score_breakdown:     SEOScoreBreakdown;
  money_analysis: {
    traffic_path:                  string;
    affiliate_click_path:          string;
    email_signup_path:             string;
    digital_product_path:          string;
    sponsor_path:                  string;
    conversion_path:               string;
    why_this_can_generate_revenue: string;
  };
  free_first_plan: {
    can_execute_free:             boolean;
    recommended_free_tools:       string[];
    paid_tools_needed_now:        boolean;
    paid_tools_recommended_later: string[];
    upgrade_trigger:              string;
    budget_use_recommended:       boolean;
    budget_reason:                string;
  };
  metadata: {
    meta_title_options:           string[];
    recommended_meta_title:       string;
    meta_description_options:     string[];
    recommended_meta_description: string;
    slug:                         string;
    title_tag_notes:              string;
  };
  content_structure: {
    recommended_h1:                     string;
    recommended_h2s:                    string[];
    faq_questions:                      string[];
    missing_sections:                   string[];
    sections_to_improve:                string[];
    search_intent_alignment_notes:      string;
  };
  internal_link_plan: {
    links_to_add_from_this_asset: string[];
    links_to_add_to_this_asset:   string[];
    anchor_text_suggestions:      string[];
    priority_internal_links:      string[];
  };
  schema_plan: {
    schema_types_recommended: string[];
    schema_notes:             string;
    implementation_notes:     string;
  };
  trust_and_evidence_plan: {
    claims_to_verify:               string[];
    sources_needed:                 string[];
    affiliate_disclosure_needed:    boolean;
    author_or_transparency_notes:   string;
    do_not_claim:                   string[];
  };
  topical_authority_plan: {
    pillar_topic:                string;
    supporting_articles_needed:  string[];
    related_clusters:            string[];
    next_cluster_to_build:       string;
  };
  refresh_plan: {
    refresh_needed:    boolean;
    refresh_frequency: RefreshFrequency;
    what_to_update:    string[];
    trigger_for_refresh: string;
  };
  tracking_plan: {
    tracking_method:    string;
    metrics_to_track:   string[];
    success_threshold:  string;
    free_tracking_tools: string[];
    what_to_learn:      string;
  };
  quality_check: {
    thin_content_risk:      RiskLevel;
    keyword_stuffing_risk:  RiskLevel;
    cannibalization_risk:   RiskLevel;
    unsupported_claims:     string[];
    needs_human_review:     boolean;
    revision_notes:         string[];
  };
  risk_notes: {
    risk_level:        RiskLevel;
    search_spam_risk:  RiskLevel;
    claims_to_verify:  string[];
    send_to_risk_bot:  boolean;
  };
  next_action: string;
  handoff:     string[];
  memory_log: {
    status:            MemoryStatus;
    priority:          Priority;
    reason_saved:      string;
    related_assets:    string[];
    related_keywords:  string[];
    date_created:      string;
  };
}

export interface OrganicGrowthOpportunity {
  opportunity:      string;
  opportunity_type: GrowthOpportunity;
  why_it_matters:   string;
  money_path:       string;
  priority:         Priority;
}

export interface SEOOrganicReport {
  bot:            "BOT-13";
  agent_name:     "SEO & Organic Search Engine";
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
    from_bots:          string[];
    mission_id:         string;
    source_asset_id:    string;
    source_asset_title: string;
    source_asset_type:  string;
    validated_niche:    string;
    target_audience:    string;
    primary_keyword:    string;
    search_intent:      string;
    money_path:         string;
  };
  summary: {
    seo_plans_created:          number;
    high_quality_plans:         number;
    plans_rejected_or_revised:  number;
    top_asset:                  string;
    top_plan_score:             number;
    money_path:                 string;
    highest_roi_action:         string;
    free_seo_plan:              string;
    hermes_instruction:         string;
  };
  seo_plans:                    SEOPlan[];
  organic_growth_opportunities: OrganicGrowthOpportunity[];
  rejected_or_revision_needed:  Array<{ plan_title: string; reason: string; fix_required: string }>;
  handoff_tasks: Array<{ target_bot: string; task: string; required_output: string; priority: Priority; status: HandoffStatus; queued_reason?: string }>;
  memory_updates: Array<{ category: MemoryCategory; title: string; content: string; priority: string; reason_saved: string }>;
  bot_notes: {
    strongest_seo_pattern:           string;
    weakest_seo_pattern:             string;
    best_organic_growth_opportunity: string;
    free_first_notes:                string;
    recommended_next_seo_focus:      string;
    recommended_prompt_improvements: string[];
  };
}

export interface SEOMemoryStore {
  last_run:              string;
  total_runs:            number;
  all_plans:             string[];
  optimized_slugs:       string[];
  topical_clusters:      string[];
  internal_link_targets: string[];
  avg_scores:            number[];
  prompt_version:        number;
}
