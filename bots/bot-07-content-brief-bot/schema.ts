export type ContentType =
  | "guide" | "tutorial" | "review" | "comparison" | "alternatives"
  | "best-tools" | "pricing" | "use-case" | "checklist" | "template-page"
  | "prompt-pack-page" | "calculator-page" | "newsletter" | "short-form" | "FAQ";

export type SearchIntent =
  | "Learn" | "Compare" | "Buy" | "Solve Problem" | "Find Tool"
  | "Find Alternative" | "Check Pricing" | "Get Template" | "Get Checklist"
  | "Get Prompt" | "Get Calculator" | "Understand Workflow"
  | "Choose Software" | "Subscribe / Follow";

export type SkillLevel    = "beginner" | "intermediate" | "advanced" | "mixed";
export type Priority      = "low" | "medium" | "high" | "urgent";
export type RiskLevel     = "low" | "medium" | "high";
export type MemoryStatus  = "save" | "watchlist" | "reject";
export type HandoffStatus = "ready" | "queued_unbuilt_bot";
export type MoneyGoal     = "affiliate_click" | "email_signup" | "digital_product_sale" | "trust_building" | "sponsor_value";
export type MemoryCategory = "Content Memory" | "Keyword Memory" | "Affiliate Memory" | "Digital Product Memory";

export interface BriefScoreBreakdown {
  buyer_intent:        number; // 0-20
  revenue_potential:   number; // 0-20
  audience_pain_match: number; // 0-15
  keyword_fit:         number; // 0-15
  product_affiliate_fit: number; // 0-10
  digital_product_fit: number; // 0-10
  execution_clarity:   number; // 0-5
  risk_safety:         number; // 0-5
}

export interface OutlineSection {
  section_heading:          string;
  section_goal:             string;
  points_to_cover:          string[];
  reader_question_answered: string;
  monetization_note:        string;
}

export interface EvidenceRequirement {
  claim_or_section:   string;
  required_source_type: string;
  why_needed:         string;
}

export interface AffiliatePlan {
  affiliate_products_to_include: string[];
  placement_notes:               string[];
  disclosure_needed:             boolean;
  avoid_overpromotion:           boolean;
}

export interface DigitalProductCTA {
  recommended_product: string;
  cta_angle:          string;
  placement:          string;
  why_it_fits:        string;
}

export interface NewsletterCapture {
  lead_magnet_angle: string;
  email_capture_cta: string;
  placement:         string;
}

export interface SEOPlan {
  meta_title:          string;
  meta_description:    string;
  slug:                string;
  suggested_faqs:      string[];
  internal_links_to_add: string[];
  schema_suggestions:  string[];
}

export interface WriterInstructions {
  tone:               string;
  style_rules:        string[];
  quality_bar:        string;
  examples_to_avoid:  string[];
  final_reader_takeaway: string;
}

export interface RiskNotes {
  risk_level:       RiskLevel;
  claims_to_verify: string[];
  compliance_notes: string;
  send_to_risk_bot: boolean;
}

export interface ContentBrief {
  brief_id:           string;
  title:              string;
  content_type:       ContentType;
  primary_keyword:    string;
  secondary_keywords: string[];
  search_intent:      SearchIntent;
  target_reader: {
    audience:         string;
    skill_level:      SkillLevel;
    reader_problem:   string;
    reader_goal:      string;
    why_they_would_care: string;
  };
  brief_score:        number;
  confidence:         number;
  score_breakdown:    BriefScoreBreakdown;
  money_analysis: {
    traffic_path:             string;
    affiliate_click_path:     string;
    email_signup_path:        string;
    digital_product_path:     string;
    sponsor_path:             string;
    why_this_can_generate_revenue: string;
  };
  recommended_angle:  string;
  content_promise:    string;
  outline:            OutlineSection[];
  must_include:       string[];
  must_not_include:   string[];
  evidence_requirements: EvidenceRequirement[];
  affiliate_plan:     AffiliatePlan;
  digital_product_cta: DigitalProductCTA;
  newsletter_capture: NewsletterCapture;
  seo_plan:           SEOPlan;
  writer_instructions: WriterInstructions;
  risk_notes:         RiskNotes;
  next_action:        string;
  handoff:            string[];
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

export interface PublishingPriorityItem {
  rank:              number;
  brief_id:          string;
  title:             string;
  reason_ranked_here: string;
  money_goal:        string;
  handoff_bot:       string;
  priority:          Priority;
}

export interface ContentBriefReport {
  bot:            "BOT-07";
  agent_name:     "Content Brief Bot";
  reports_to:     "HERMES-00";
  run_date:       string;
  business_model: string;
  input_source: {
    from_bots:               string[];
    validated_niche:         string;
    target_audience:         string;
    top_pain_clusters:       string[];
    top_product_opportunities: string[];
    top_keyword_clusters:    string[];
    mission_id:              string;
  };
  summary: {
    briefs_created:       number;
    high_priority_briefs: number;
    rejected_briefs:      number;
    top_brief_title:      string;
    top_brief_score:      number;
    money_path:           string;
    highest_roi_action:   string;
    hermes_instruction:   string;
  };
  content_briefs:          ContentBrief[];
  publishing_priority_order: PublishingPriorityItem[];
  rejected_briefs: Array<{ title: string; reason_rejected: string; missing_requirement: string }>;
  handoff_tasks: Array<{ target_bot: string; task: string; required_output: string; priority: Priority; status: HandoffStatus; queued_reason?: string }>;
  memory_updates: Array<{ category: MemoryCategory; title: string; content: string; priority: string; reason_saved: string }>;
  bot_notes: {
    strongest_brief_pattern:       string;
    weakest_brief_pattern:         string;
    recommended_next_content_focus: string;
    recommended_prompt_improvements: string[];
  };
}

export interface ContentBriefMemoryStore {
  last_run:         string;
  total_runs:       number;
  all_briefs:       string[];
  published_briefs: string[];
  rejected_briefs:  string[];
  avg_scores:       number[];
  prompt_version:   number;
}
