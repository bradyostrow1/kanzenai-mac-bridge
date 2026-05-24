export type RepurposeAssetType =
  | "x_post" | "x_thread" | "linkedin_post" | "linkedin_carousel"
  | "tiktok_script" | "instagram_reel_script" | "youtube_shorts_script"
  | "faceless_youtube_outline" | "pinterest_pin" | "reddit_answer"
  | "community_answer" | "newsletter_teaser" | "email_snippet"
  | "lead_magnet_promo" | "affiliate_promo" | "digital_product_promo"
  | "tool_of_week" | "problem_solution_post" | "hook_bank" | "cta_bank"
  | "quote_card" | "carousel_copy" | "mistake_to_avoid" | "best_free_tools_post"
  | "build_this_weekend" | "before_after_workflow" | "x_vs_y_post"
  | "free_alternative_post" | "checklist_post" | "mini_guide_post"
  | "content_calendar_batch" | "repurpose_bundle";

export type PostGoal = "traffic" | "affiliate_click" | "email_signup" | "digital_product_sale" | "trust_building" | "sponsor_value" | "community_engagement";
export type RiskLevel     = "low" | "medium" | "high";
export type Priority      = "low" | "medium" | "high" | "urgent";
export type MemoryStatus  = "save" | "needs_review" | "reject";
export type HandoffStatus = "ready" | "queued_unbuilt_bot";
export type MemoryCategory = "Content Memory" | "Distribution Memory" | "Audience Memory" | "Affiliate Memory" | "Digital Product Memory" | "Platform Memory" | "Budget Memory";

export interface MultiplierScoreBreakdown {
  revenue_potential:      number; // 0-20
  platform_fit:           number; // 0-15
  audience_pain_match:    number; // 0-15
  hook_strength:          number; // 0-10
  clarity:                number; // 0-10
  cta_strength:           number; // 0-10
  repurpose_efficiency:   number; // 0-5
  trust_compliance_safety: number; // 0-5
  free_traffic_potential: number; // 0-5
  execution_readiness:    number; // 0-5
}

export interface VideoScript {
  opening_hook:   string;
  scene_notes:    string[];
  voiceover:      string;
  on_screen_text: string[];
  closing_cta:    string;
}

export interface RepurposeContent {
  hook:              string;
  body:              string;
  cta:               string;
  caption:           string;
  hashtags_or_tags:  string[];
  carousel_slides:   string[];
  video_script:      VideoScript;
  thread_posts:      string[];
  community_answer:  string;
}

export interface RepurposedAsset {
  asset_id:                    string;
  source_asset_id:             string;
  asset_title:                 string;
  asset_type:                  RepurposeAssetType;
  platform:                    string;
  target_audience:             string;
  reader_or_viewer_problem:    string;
  reader_or_viewer_next_action: string;
  asset_score:                 number;
  confidence:                  number;
  score_breakdown:             MultiplierScoreBreakdown;
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
  content:        RepurposeContent;
  platform_notes: {
    platform_fit_reason:         string;
    posting_notes:               string;
    community_rules_to_check:    string[];
    best_time_to_test:           string;
    repurpose_variations:        string[];
  };
  affiliate_plan: {
    affiliate_products_mentioned: string[];
    disclosure_needed:            boolean;
    disclosure_note:              string;
    avoid_overpromotion_notes:    string;
  };
  digital_product_plan: {
    related_product: string;
    cta_angle:       string;
    placement:       string;
  };
  quality_check: {
    generic_ai_risk:       RiskLevel;
    spam_risk:             RiskLevel;
    unsupported_claims:    string[];
    platform_policy_risk:  RiskLevel;
    needs_human_review:    boolean;
    revision_notes:        string[];
  };
  risk_notes: {
    risk_level:                          RiskLevel;
    affiliate_disclosure_needed:         boolean;
    permission_or_community_rules_needed: boolean;
    claims_to_verify:                    string[];
    send_to_risk_bot:                    boolean;
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

export interface ContentCalendarItem {
  date_or_day: string;
  platform:    string;
  asset_id:    string;
  post_goal:   PostGoal;
  priority:    Priority;
}

export interface HookEntry {
  hook:           string;
  platform:       string;
  best_for:       string;
  reason_it_works: string;
}

export interface CTAEntry {
  cta:           string;
  goal:          PostGoal;
  best_platform: string;
  notes:         string;
}

export interface ContentMultiplierReport {
  bot:            "BOT-11";
  agent_name:     "Content Multiplier Engine";
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
    money_path:         string;
    primary_cta:        string;
  };
  summary: {
    repurposed_assets_created:  number;
    high_quality_assets:        number;
    assets_rejected_or_revised: number;
    top_asset_title:            string;
    top_asset_score:            number;
    best_platform:              string;
    money_path:                 string;
    highest_roi_action:         string;
    free_distribution_plan:     string;
    hermes_instruction:         string;
  };
  repurposed_assets:            RepurposedAsset[];
  content_calendar_suggestions: ContentCalendarItem[];
  hook_bank:                    HookEntry[];
  cta_bank:                     CTAEntry[];
  rejected_or_revision_needed:  Array<{ asset_title: string; reason: string; fix_required: string }>;
  handoff_tasks: Array<{ target_bot: string; task: string; required_output: string; priority: Priority; status: HandoffStatus; queued_reason?: string }>;
  memory_updates: Array<{ category: MemoryCategory; title: string; content: string; priority: string; reason_saved: string }>;
  bot_notes: {
    strongest_repurpose_pattern:     string;
    weakest_repurpose_pattern:       string;
    best_platform_opportunity:       string;
    free_first_notes:                string;
    recommended_next_multiplier_focus: string;
    recommended_prompt_improvements: string[];
  };
}

export interface MultiplierMemoryStore {
  last_run:       string;
  total_runs:     number;
  all_assets:     string[];
  top_hooks:      string[];
  best_platforms: string[];
  avg_scores:     number[];
  prompt_version: number;
}
