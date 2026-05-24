export type ProgramType =
  | "saas_affiliate" | "ai_tool_affiliate" | "crm_affiliate" | "automation_tool_affiliate"
  | "marketplace_affiliate" | "software_referral" | "newsletter_sponsor"
  | "direct_brand_partner" | "creator_referral" | "template_marketplace"
  | "gumroad_referral" | "course_affiliate" | "hosting_domain_affiliate"
  | "no_code_tool_affiliate" | "productivity_tool_affiliate" | "real_estate_tool_affiliate"
  | "construction_tool_affiliate" | "local_business_tool_affiliate"
  | "free_tool_paid_upgrade_affiliate" | "app_marketplace_partner"
  | "chrome_extension_partner" | "wordpress_plugin_affiliate"
  | "shopify_app_affiliate" | "digital_product_cross_promo" | "sponsorship_lead";

export type VerificationStatus = "verified" | "needs_verification" | "unknown";
export type FreeToJoin         = "yes" | "no" | "unknown";
export type TrustLevel         = "low" | "medium" | "high";
export type MemoryStatus       = "save" | "apply_after_approval" | "watchlist" | "reject";
export type Priority           = "low" | "medium" | "high" | "urgent";
export type HandoffStatus      = "ready" | "queued_unbuilt_bot";
export type MemoryCategory     = "Affiliate Memory" | "Partnership Memory" | "Product Memory" | "Content Memory" | "Revenue Memory" | "Risk Memory" | "Budget Memory";

export interface ProgramScoreBreakdown {
  revenue_potential:      number; // 0-20
  audience_fit:           number; // 0-15
  product_pain_fit:       number; // 0-15
  trust_quality:          number; // 0-15
  approval_accessibility: number; // 0-10
  free_to_join_value:     number; // 0-10
  content_fit:            number; // 0-5
  tracking_clarity:       number; // 0-5
  compliance_safety:      number; // 0-5
}

export interface MonetizationProgram {
  program_id:          string;
  program_name:        string;
  program_type:        ProgramType;
  product_or_company:  string;
  website_or_reference: string;
  verification_status: VerificationStatus;
  free_to_join:        FreeToJoin;
  requires_approval:   boolean;
  program_score:       number;
  confidence:          number;
  score_breakdown:     ProgramScoreBreakdown;
  program_details: {
    what_it_monetizes:          string;
    target_customer:            string;
    audience_pain_solved:       string;
    commission_or_payout_notes: string;
    cookie_or_tracking_notes:   string;
    approval_requirements:      string;
    payment_notes:              string;
    limitations:                string[];
    data_needs_verification:    string[];
  };
  money_analysis: {
    affiliate_click_path:         string;
    newsletter_recommendation_path: string;
    review_comparison_path:       string;
    digital_product_funnel_path:  string;
    sponsor_or_partner_path:      string;
    why_this_can_generate_revenue: string;
  };
  asset_mapping: {
    best_assets_to_use:               string[];
    recommended_page_types:           string[];
    recommended_newsletter_placements: string[];
    recommended_social_placements:    string[];
    recommended_ctas:                 string[];
  };
  disclosure_plan: {
    affiliate_disclosure_needed:  boolean;
    recommended_disclosure_text:  string;
    placement_notes:              string[];
    risk_if_not_disclosed:        string;
  };
  tracking_plan: {
    tracking_method:    string;
    utm_needed:         boolean;
    metrics_to_track:   string[];
    free_tracking_tools: string[];
    success_threshold:  string;
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
  trust_check: {
    trust_level:          TrustLevel;
    quality_notes:        string;
    reasons_to_be_careful: string[];
    do_not_claim:         string[];
    needs_human_review:   boolean;
  };
  recommended_next_action: string;
  handoff:  string[];
  memory_log: {
    status:            MemoryStatus;
    priority:          Priority;
    reason_saved:      string;
    related_assets:    string[];
    related_products:  string[];
    related_keywords:  string[];
    date_created:      string;
  };
}

export interface ApplicationPriorityItem {
  rank:                 number;
  program_id:           string;
  program_name:         string;
  reason_ranked_here:   string;
  free_to_join:         FreeToJoin;
  expected_money_path:  string;
  approval_required:    boolean;
  priority:             Priority;
}

export interface LinkPlacementItem {
  asset_id:             string;
  asset_title:          string;
  program_id:           string;
  recommended_placement: string;
  cta:                  string;
  disclosure_required:  boolean;
  priority:             Priority;
}

export interface AffiliatePartnershipReport {
  bot:            "BOT-16";
  agent_name:     "Affiliate & Partnership Revenue Engine";
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
    products_or_tools:   string[];
    assets_to_monetize:  string[];
    money_path:          string;
  };
  summary: {
    programs_evaluated:               number;
    high_value_programs:              number;
    programs_rejected_or_watchlisted: number;
    top_program:                      string;
    top_program_score:                number;
    best_free_to_join_program:        string;
    money_path:                       string;
    highest_roi_action:               string;
    budget_use_recommended:           boolean;
    hermes_instruction:               string;
  };
  monetization_programs:            MonetizationProgram[];
  application_priority_order:       ApplicationPriorityItem[];
  link_placement_map:               LinkPlacementItem[];
  rejected_or_watchlisted_programs: Array<{ program_name: string; reason: string; fix_or_verification_needed: string }>;
  handoff_tasks: Array<{ target_bot: string; task: string; required_output: string; priority: Priority; status: HandoffStatus; queued_reason?: string }>;
  memory_updates: Array<{ category: MemoryCategory; title: string; content: string; priority: string; reason_saved: string }>;
  bot_notes: {
    strongest_affiliate_pattern:     string;
    weakest_affiliate_pattern:       string;
    best_free_to_join_opportunity:   string;
    best_program_to_apply_for_first: string;
    free_first_notes:                string;
    recommended_next_affiliate_focus: string;
    recommended_prompt_improvements: string[];
  };
}

export interface AffiliateMemoryStore {
  last_run:          string;
  total_runs:        number;
  known_programs:    string[];
  applied_programs:  string[];
  rejected_programs: string[];
  avg_scores:        number[];
  prompt_version:    number;
}
