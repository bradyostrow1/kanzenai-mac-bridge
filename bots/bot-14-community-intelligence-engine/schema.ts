export type InsightType =
  | "Pain Signal" | "Repeated Question" | "Complaint" | "Objection"
  | "Buying Trigger" | "Product Complaint" | "Tool Request" | "Alternative Request"
  | "Feature Request" | "Pricing Concern" | "Trust Concern" | "Workflow Problem"
  | "Beginner Confusion" | "Advanced User Need" | "Content Gap" | "Digital Product Gap"
  | "Affiliate Opportunity" | "Newsletter Topic" | "Review/Comparison Opportunity"
  | "Free Traffic Opportunity" | "Community Rule / Risk Signal"
  | "Trend Validation Signal" | "Rejected Noise";

export type SourceType       = "subreddit" | "forum" | "comments" | "reviews" | "public_social" | "q_and_a" | "product_community" | "newsletter_comments" | "app_reviews" | "marketplace_reviews";
export type EvidenceStrength = "weak" | "moderate" | "strong";
export type DistribAnswer    = "yes" | "no" | "maybe" | "unknown";
export type ContentAssetType = "article" | "comparison_page" | "newsletter" | "short_form" | "digital_product" | "lead_magnet" | "tutorial" | "faq" | "review_page";
export type RiskLevel        = "low" | "medium" | "high";
export type Priority         = "low" | "medium" | "high" | "urgent";
export type MemoryStatus     = "save" | "needs_review" | "watchlist" | "reject";
export type HandoffStatus    = "ready" | "queued_unbuilt_bot";
export type MemoryCategory   = "Community Memory" | "Audience Memory" | "Content Memory" | "Product Memory" | "Affiliate Memory" | "Distribution Memory" | "Risk Memory" | "Budget Memory";

export interface InsightScoreBreakdown {
  frequency_repetition:         number; // 0-15
  audience_fit:                 number; // 0-15
  pain_severity:                number; // 0-15
  monetization_potential:       number; // 0-15
  content_potential:            number; // 0-10
  affiliate_digital_product_fit: number; // 0-10
  source_quality:               number; // 0-10
  free_traffic_potential:       number; // 0-5
  compliance_safety:            number; // 0-5
}

export interface InsightEvidence {
  platform:                   string;
  url_or_reference:           string;
  summary:                    string;
  exact_phrase_if_safe_and_public: string;
  evidence_strength:          EvidenceStrength;
}

export interface CommunityInsight {
  insight_id:      string;
  insight_title:   string;
  insight_type:    InsightType;
  source_platform: string;
  source_reference: string;
  public_source:   boolean;
  target_audience: string;
  related_niche:   string;
  related_keywords: string[];
  related_tools:   string[];
  insight_score:   number;
  confidence:      number;
  score_breakdown: InsightScoreBreakdown;
  evidence:        InsightEvidence[];
  voice_of_customer: {
    phrases_to_use:    string[];
    common_questions:  string[];
    emotional_words:   string[];
    objections:        string[];
    desired_outcomes:  string[];
  };
  money_analysis: {
    traffic_path:                  string;
    affiliate_click_path:          string;
    email_signup_path:             string;
    digital_product_path:          string;
    sponsor_path:                  string;
    conversion_path:               string;
    why_this_can_generate_revenue: string;
  };
  recommended_assets: {
    content_idea:              string;
    newsletter_idea:           string;
    review_or_comparison_idea: string;
    digital_product_idea:      string;
    affiliate_angle:           string;
    social_post_angle:         string;
  };
  community_distribution_opportunity: {
    can_distribute_here:  DistribAnswer;
    distribution_method:  string;
    rules_to_check:       string[];
    spam_risk:            RiskLevel;
    recommended_approach: string;
  };
  free_first_plan: {
    can_research_free:            boolean;
    recommended_free_methods:     string[];
    paid_tools_needed_now:        boolean;
    paid_tools_recommended_later: string[];
    upgrade_trigger:              string;
    budget_use_recommended:       boolean;
    budget_reason:                string;
  };
  risk_notes: {
    privacy_risk:          RiskLevel;
    platform_policy_risk:  RiskLevel;
    sensitive_data_risk:   RiskLevel;
    spam_risk:             RiskLevel;
    send_to_risk_bot:      boolean;
  };
  next_action: string;
  handoff:     string[];
  memory_log: {
    status:               MemoryStatus;
    priority:             Priority;
    reason_saved:         string;
    related_communities:  string[];
    related_keywords:     string[];
    date_created:         string;
  };
}

export interface CommunitySource {
  source_name:          string;
  platform:             string;
  source_type:          SourceType;
  publicly_accessible:  boolean;
  relevance_score:      number;
  quality_notes:        string;
  rules_or_limitations: string[];
  safe_to_monitor:      DistribAnswer;
}

export interface CommunityQuestion {
  question:                     string;
  frequency_note:               string;
  content_asset_recommendation: string;
  money_path:                   string;
  priority:                     Priority;
}

export interface CommunityContentOpportunity {
  opportunity:           string;
  source_signal:         string;
  recommended_asset_type: ContentAssetType;
  why_it_matters:        string;
  money_path:            string;
  priority:              Priority;
}

export interface CommunityDistributionOpportunity {
  community_or_platform:       string;
  asset_to_share:              string;
  safe_distribution_approach:  string;
  rules_to_check:              string[];
  spam_risk:                   RiskLevel;
  priority:                    Priority;
}

export interface CommunityIntelligenceReport {
  bot:            "BOT-14";
  agent_name:     "Community Intelligence Engine";
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
    keywords:            string[];
    tools_or_products:   string[];
    assets_to_validate:  string[];
    research_question:   string;
  };
  summary: {
    community_sources_checked:   number;
    raw_discussions_found:       number;
    insights_extracted:          number;
    high_value_insights:         number;
    rejected_or_risky_insights:  number;
    top_insight:                 string;
    top_insight_score:           number;
    money_path:                  string;
    highest_roi_action:          string;
    free_research_plan:          string;
    hermes_instruction:          string;
  };
  community_insights:                CommunityInsight[];
  community_sources:                 CommunitySource[];
  community_questions:               CommunityQuestion[];
  community_content_opportunities:   CommunityContentOpportunity[];
  community_distribution_opportunities: CommunityDistributionOpportunity[];
  rejected_or_risky_insights:        Array<{ insight: string; reason: string; risk_or_missing_requirement: string }>;
  handoff_tasks: Array<{ target_bot: string; task: string; required_output: string; priority: Priority; status: HandoffStatus; queued_reason?: string }>;
  memory_updates: Array<{ category: MemoryCategory; title: string; content: string; priority: string; reason_saved: string }>;
  bot_notes: {
    strongest_community_pattern:     string;
    weakest_community_pattern:       string;
    best_public_source:              string;
    best_free_traffic_opportunity:   string;
    free_first_notes:                string;
    recommended_next_community_focus: string;
    recommended_prompt_improvements: string[];
  };
}

export interface CommunityMemoryStore {
  last_run:           string;
  total_runs:         number;
  known_sources:      string[];
  tracked_questions:  string[];
  tracked_pains:      string[];
  high_value_insights: string[];
  avg_scores:         number[];
  prompt_version:     number;
}
