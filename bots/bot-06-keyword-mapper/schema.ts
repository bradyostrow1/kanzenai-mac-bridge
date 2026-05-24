export type KeywordType =
  | "Informational Keyword" | "Buyer-Intent Keyword" | "Commercial Keyword"
  | "Affiliate Keyword" | "Review Keyword" | "Comparison Keyword"
  | "Alternative Keyword" | "Best-Tools Keyword" | "Pricing Keyword"
  | "Use-Case Keyword" | "Problem-Solution Keyword" | "Template Keyword"
  | "Prompt Pack Keyword" | "Calculator Keyword" | "Checklist Keyword"
  | "Newsletter Keyword" | "Pain-Point Keyword" | "Tool Category Keyword"
  | "Local Business Keyword" | "SaaS Keyword" | "Long-Tail Keyword";

export type SearchIntent =
  | "Learn" | "Compare" | "Buy" | "Solve Problem" | "Find Tool"
  | "Find Alternative" | "Check Pricing" | "Get Template" | "Get Checklist"
  | "Get Prompt" | "Get Calculator" | "Understand Workflow"
  | "Choose Software" | "Subscribe / Follow";

export type ContentType    = "guide" | "review" | "comparison" | "alternatives" | "best-tools" | "pricing" | "tutorial" | "checklist" | "template-page" | "newsletter" | "short-form";
export type MoneyGoal      = "affiliate_click" | "email_signup" | "digital_product_sale" | "trust_building" | "sponsor_value";
export type Priority       = "low" | "medium" | "high" | "urgent";
export type EvidenceStrength = "weak" | "moderate" | "strong";
export type MemoryStatus   = "save" | "watchlist" | "reject";
export type HandoffStatus  = "ready" | "queued_unbuilt_bot";
export type PageType       = "review" | "comparison" | "alternatives" | "best-tools" | "pricing" | "use-case";
export type MemoryCategory = "Keyword Memory" | "Content Memory" | "Affiliate Memory" | "Digital Product Memory" | "SEO Memory";

export interface KeywordScoreBreakdown {
  buyer_intent:            number; // 0-20
  monetization_potential:  number; // 0-20
  audience_fit:            number; // 0-15
  pain_fit:                number; // 0-10
  content_potential:       number; // 0-10
  affiliate_potential:     number; // 0-10
  digital_product_potential: number; // 0-10
  execution_fit:           number; // 0-5
}

export interface KeywordEvidence {
  platform:         string;
  url_or_reference: string;
  evidence_summary: string;
  evidence_strength: EvidenceStrength;
}

export interface MoneyAnalysis {
  traffic_path:                  string;
  affiliate_click_path:          string;
  digital_product_path:          string;
  newsletter_path:               string;
  sponsor_path:                  string;
  why_this_can_generate_revenue: string;
}

export interface ContentAsset {
  content_type:        ContentType;
  title:               string;
  angle:               string;
  target_keyword:      string;
  supporting_keywords: string[];
  money_goal:          MoneyGoal;
  priority:            Priority;
}

export interface KeywordCluster {
  cluster_name:       string;
  cluster_type:       KeywordType;
  primary_keyword:    string;
  secondary_keywords: string[];
  search_intent:      SearchIntent;
  audience_fit:       string;
  pain_fit:           string;
  related_tools:      string[];
  related_pains:      string[];
  cluster_score:      number;
  confidence:         number;
  score_breakdown:    KeywordScoreBreakdown;
  evidence:           KeywordEvidence[];
  money_analysis:     MoneyAnalysis;
  recommended_content_asset:        ContentAsset;
  recommended_internal_links:       string[];
  recommended_affiliate_angle:      string;
  recommended_digital_product_angle: string;
  recommended_newsletter_angle:     string;
  content_brief_notes:              string;
  next_action:                      string;
  handoff:                          string[];
  memory_log: {
    status:           MemoryStatus;
    priority:         Priority;
    reason_saved:     string;
    related_keywords: string[];
    related_pains:    string[];
    related_tools:    string[];
    date_found:       string;
  };
}

export interface PillarPage {
  pillar_title:         string;
  primary_keyword:      string;
  purpose:              string;
  money_goal:           string;
  supporting_clusters:  string[];
}

export interface SupportingArticle {
  title:           string;
  primary_keyword: string;
  supports_pillar: string;
  search_intent:   string;
  priority:        Priority;
}

export interface BuyerIntentPage {
  page_title:      string;
  page_type:       PageType;
  primary_keyword: string;
  money_goal:      string;
  priority:        Priority;
}

export interface TopicalMap {
  main_topic:          string;
  pillar_pages:        PillarPage[];
  supporting_articles: SupportingArticle[];
  buyer_intent_pages:  BuyerIntentPage[];
}

export interface PublishingPriorityItem {
  rank:              number;
  content_title:     string;
  primary_keyword:   string;
  content_type:      string;
  reason_ranked_here: string;
  money_goal:        string;
  handoff_bot:       string;
  priority:          Priority;
}

export interface KeywordMapperReport {
  bot:            "BOT-06";
  agent_name:     "Keyword Mapper";
  reports_to:     "HERMES-00";
  run_date:       string;
  business_model: string;
  input_source: {
    from_bots:               string[];
    validated_niche:         string;
    niche_score:             number;
    target_audience:         string;
    top_pain_clusters:       string[];
    top_product_opportunities: string[];
    mission_id:              string;
  };
  summary: {
    keyword_sources_scanned:   number;
    raw_keywords_found:        number;
    keywords_normalized:       number;
    keyword_clusters_created:  number;
    high_value_clusters:       number;
    rejected_keywords:         number;
    top_keyword_cluster:       string;
    top_cluster_score:         number;
    money_path:                string;
    highest_roi_content_asset: string;
    publishing_priority:       string;
    hermes_instruction:        string;
  };
  top_keyword_clusters:     KeywordCluster[];
  topical_map:              TopicalMap;
  publishing_priority_order: PublishingPriorityItem[];
  keyword_watchlist: Array<{ keyword: string; reason_watchlisted: string; what_to_check_next: string }>;
  rejected_keywords: Array<{ keyword: string; reason_rejected: string; missing_requirement: string }>;
  handoff_tasks: Array<{ target_bot: string; task: string; required_output: string; priority: Priority; status: HandoffStatus; queued_reason?: string }>;
  memory_updates: Array<{ category: MemoryCategory; title: string; content: string; priority: string; reason_saved: string }>;
  bot_notes: {
    strongest_keyword_pattern:      string;
    weakest_keyword_pattern:        string;
    best_source_quality:            string[];
    worst_source_quality:           string[];
    recommended_next_keyword_focus: string;
    recommended_prompt_improvements: string[];
  };
}

export interface KeywordMemoryStore {
  last_run:          string;
  total_runs:        number;
  all_keywords:      string[];
  top_clusters:      string[];
  rejected_keywords: string[];
  avg_scores:        number[];
  prompt_version:    number;
}
