import { logger } from "../../lib/logger";

export interface RawKeywordData {
  platform: string;
  mode:     "live" | "mock";
  items: Array<{
    keyword:       string;
    intent:        string;
    pattern_type:  string;
    evidence:      string;
    related:       string[];
  }>;
}

const DEV_MODE = process.env.KEYWORD_MAPPER_DEV_MODE !== "false";

function mockAutocomplete(niche: string): RawKeywordData {
  return {
    platform: "Google Autocomplete Patterns", mode: "mock", items: [
      { keyword: "best CRM for real estate agents", intent: "Choose Software", pattern_type: "Best-Tools Keyword", evidence: "High-frequency autocomplete pattern", related: ["real estate CRM comparison", "CRM for realtors", "real estate agent software"] },
      { keyword: "AI tools for real estate investors", intent: "Find Tool", pattern_type: "Tool Category Keyword", evidence: "Rising search pattern — AI + real estate", related: ["AI for property analysis", "real estate AI automation", "property management AI"] },
      { keyword: "construction project management software alternatives", intent: "Find Alternative", pattern_type: "Alternative Keyword", evidence: "Strong alternative-page pattern", related: ["Procore alternatives", "best construction software", "BuilderTrend vs Procore"] },
      { keyword: "local business automation tools", intent: "Find Tool", pattern_type: "Tool Category Keyword", evidence: "High volume intent cluster", related: ["small business automation", "automate local business", "tools to automate service business"] },
      { keyword: "best AI tools for small business 2025", intent: "Buy", pattern_type: "Buyer-Intent Keyword", evidence: "Strong buyer intent — year + best + category", related: ["top AI business tools", "AI tools for entrepreneurs", "small business AI software"] },
    ],
  };
}

function mockPeopleAlsoAsk(niche: string): RawKeywordData {
  return {
    platform: "People Also Ask Patterns", mode: "mock", items: [
      { keyword: "what is the best CRM for real estate agents", intent: "Choose Software", pattern_type: "Buyer-Intent Keyword", evidence: "Recurring PAA pattern in real estate SERPs", related: ["CRM for real estate review", "real estate CRM pricing"] },
      { keyword: "how to automate real estate follow up", intent: "Understand Workflow", pattern_type: "Problem-Solution Keyword", evidence: "High-frequency question pattern", related: ["real estate automation tools", "follow up automation CRM"] },
      { keyword: "what software do construction companies use", intent: "Find Tool", pattern_type: "Tool Category Keyword", evidence: "PAA in construction search results", related: ["construction management software", "builder software review"] },
      { keyword: "how to automate invoicing for local business", intent: "Solve Problem", pattern_type: "Problem-Solution Keyword", evidence: "PAA pattern in local business queries", related: ["invoicing software for small business", "auto invoicing tools"] },
    ],
  };
}

function mockComparisonPatterns(niche: string): RawKeywordData {
  return {
    platform: "Comparison Keyword Patterns", mode: "mock", items: [
      { keyword: "Follow Up Boss vs HubSpot for real estate", intent: "Compare", pattern_type: "Comparison Keyword", evidence: "Clear VS-page opportunity, both tools have affiliate programs", related: ["Follow Up Boss review", "HubSpot real estate", "real estate CRM comparison"] },
      { keyword: "monday.com vs ClickUp for agencies", intent: "Compare", pattern_type: "Comparison Keyword", evidence: "High search intent VS page", related: ["best project management for agencies", "ClickUp review", "monday.com alternatives"] },
      { keyword: "Jobber vs Housecall Pro", intent: "Compare", pattern_type: "Comparison Keyword", evidence: "Both have affiliate programs, active comparison searches", related: ["field service software comparison", "Jobber review", "Housecall Pro review"] },
    ],
  };
}

function mockTemplateKeywords(niche: string): RawKeywordData {
  return {
    platform: "Template & Product Keyword Patterns", mode: "mock", items: [
      { keyword: "real estate agent AI prompt pack", intent: "Buy", pattern_type: "Prompt Pack Keyword", evidence: "Gumroad product selling 340+ units validates demand", related: ["AI prompts for realtors", "real estate ChatGPT prompts", "real estate AI templates"] },
      { keyword: "construction project SOP template", intent: "Get Template", pattern_type: "Template Keyword", evidence: "Strong demand signal from Gumroad sales data", related: ["construction workflow template", "builder SOP kit", "project management checklist construction"] },
      { keyword: "local business operations checklist", intent: "Get Checklist", pattern_type: "Checklist Keyword", evidence: "High demand, low-competition niche", related: ["small business checklist free", "operations checklist template", "business workflow checklist"] },
      { keyword: "AI tools for real estate spreadsheet", intent: "Get Template", pattern_type: "Calculator Keyword", evidence: "Product gap — no strong existing solution", related: ["real estate calculator Excel", "property ROI calculator", "real estate spreadsheet template"] },
    ],
  };
}

function mockRedditSearchPhrases(niche: string): RawKeywordData {
  return {
    platform: "Reddit Search Phrase Patterns", mode: "mock", items: [
      { keyword: "best tools small business reddit", intent: "Find Tool", pattern_type: "Best-Tools Keyword", evidence: "Common Reddit search pattern", related: ["software recommendations small business", "reddit recommended CRM"] },
      { keyword: "AI tools for contractors reddit", intent: "Find Tool", pattern_type: "Tool Category Keyword", evidence: "r/Construction and r/smallbusiness queries", related: ["construction software reddit", "best apps for contractors"] },
    ],
  };
}

export async function fetchAllKeywordSources(niche: string): Promise<RawKeywordData[]> {
  logger.info("BOT-06", `Fetching keyword data for: "${niche}" [${DEV_MODE ? "MOCK" : "LIVE"} mode]`);
  if (DEV_MODE) {
    return [
      mockAutocomplete(niche),
      mockPeopleAlsoAsk(niche),
      mockComparisonPatterns(niche),
      mockTemplateKeywords(niche),
      mockRedditSearchPhrases(niche),
    ];
  }
  return [mockAutocomplete(niche)]; // Live stubs — connect SEO API here
}

export function formatKeywordsForPrompt(sources: RawKeywordData[]): string {
  return sources.map((s) => {
    const items = s.items.map((i) =>
      `  - "${i.keyword}" | Intent: ${i.intent} | Type: ${i.pattern_type}\n    Evidence: ${i.evidence}\n    Related: ${i.related.join(", ")}`
    ).join("\n");
    return `[${s.platform}${s.mode === "mock" ? " — MOCK/DEV MODE" : ""}]\n${items}`;
  }).join("\n\n");
}
