import { logger } from "../../lib/logger";

export interface RawDiscussion {
  platform:        string;
  source_name:     string;
  mode:            "live" | "mock";
  discussions: Array<{
    id:              string;
    platform:        string;
    source:          string;
    content:         string;
    pain_signal:     string;
    frequency_note:  string;
    audience:        string;
    related_tools:   string[];
    evidence_strength: "weak" | "moderate" | "strong";
  }>;
}

const DEV_MODE = process.env.COMMUNITY_INTEL_DEV_MODE !== "false";

function mockRedditDiscussions(niche: string): RawDiscussion {
  return {
    platform: "Reddit", source_name: "r/realestate + r/realtors + r/RealEstateTechnology",
    mode: "mock", discussions: [
      { id: "r1", platform: "Reddit", source: "r/realtors", content: "What CRM do you actually use and would recommend to a new agent? I've tried Follow Up Boss but $69/month feels steep when I only have 10 leads", pain_signal: "Pricing concern — CRM too expensive for new/small agents", frequency_note: "Appears in 3+ threads monthly", audience: "New real estate agents", related_tools: ["Follow Up Boss", "HubSpot"], evidence_strength: "strong" },
      { id: "r2", platform: "Reddit", source: "r/RealEstateTechnology", content: "Is there a free CRM that actually works for real estate? I keep seeing people recommend HubSpot free tier but it seems confusing", pain_signal: "Free alternative request for real estate CRM", frequency_note: "Weekly question in community", audience: "Solo real estate agents", related_tools: ["HubSpot", "Notion", "Airtable"], evidence_strength: "strong" },
      { id: "r3", platform: "Reddit", source: "r/realestate", content: "Anyone use AI tools for follow-up? I'm drowning in leads and can't keep up manually", pain_signal: "Workflow automation pain — manual follow-up overwhelm", frequency_note: "Repeated monthly, increasing frequency", audience: "Busy real estate agents", related_tools: ["Follow Up Boss", "ChatGPT"], evidence_strength: "moderate" },
      { id: "r4", platform: "Reddit", source: "r/realtors", content: "Switched from Follow Up Boss to a free Notion template. Saved $800/year. AMA", pain_signal: "Tool switching signal — cost driver. Free alternative success story", frequency_note: "High engagement thread — 47 comments", audience: "Cost-conscious real estate agents", related_tools: ["Follow Up Boss", "Notion"], evidence_strength: "strong" },
    ],
  };
}

function mockProductHuntDiscussions(niche: string): RawDiscussion {
  return {
    platform: "Product Hunt", source_name: "Product Hunt AI + Real Estate categories",
    mode: "mock", discussions: [
      { id: "ph1", platform: "Product Hunt", source: "AI Tools category", content: "Why is there no good AI tool specifically built for real estate prospecting? Everything is either too generic or too expensive", pain_signal: "Market gap — no AI tool specifically for real estate prospecting", frequency_note: "3 similar comments on 2 related products", audience: "Real estate professionals", related_tools: ["General AI tools"], evidence_strength: "moderate" },
    ],
  };
}

function mockAppReviewDiscussions(niche: string): RawDiscussion {
  return {
    platform: "App Reviews", source_name: "Follow Up Boss + HubSpot app reviews (public)",
    mode: "mock", discussions: [
      { id: "ar1", platform: "App Review", source: "Follow Up Boss - App Store", content: "Great tool but way too expensive for solo agents. Need a cheaper version for people just starting out", pain_signal: "Pricing concern — no affordable tier for solo operators", frequency_note: "Common theme in 1-star and 2-star reviews", audience: "Solo real estate agents", related_tools: ["Follow Up Boss"], evidence_strength: "strong" },
      { id: "ar2", platform: "App Review", source: "HubSpot - G2 public review", content: "Too complicated for real estate. The free plan is good but you need to spend 10 hours setting it up", pain_signal: "Setup complexity — not real-estate-native", frequency_note: "Appears in 15+ public reviews", audience: "Real estate agents new to CRMs", related_tools: ["HubSpot"], evidence_strength: "strong" },
    ],
  };
}

function mockYouTubeDiscussions(niche: string): RawDiscussion {
  return {
    platform: "YouTube Comments", source_name: "Real estate agent channel public comments",
    mode: "mock", discussions: [
      { id: "yt1", platform: "YouTube", source: "Public comments - real estate channel", content: "Can you do a video comparing all the CRM options? I've watched 10 videos and still can't decide", pain_signal: "Decision paralysis — too many options, no clear comparison", frequency_note: "Similar requests on 4 videos", audience: "Real estate agents researching tools", related_tools: ["Multiple CRMs"], evidence_strength: "moderate" },
    ],
  };
}

function mockForumDiscussions(niche: string): RawDiscussion {
  return {
    platform: "Public Forums", source_name: "Indie Hackers + BiggerPockets public discussions",
    mode: "mock", discussions: [
      { id: "f1", platform: "Forum", source: "BiggerPockets Forums - public", content: "What does a complete AI tool stack look like for a real estate investor in 2024? Looking for automation tools that don't cost $500/month", pain_signal: "Tool stack confusion — no clear affordable AI stack for real estate investors", frequency_note: "Thread has 28 replies, similar questions weekly", audience: "Real estate investors", related_tools: ["Various AI tools"], evidence_strength: "strong" },
    ],
  };
}

export async function fetchAllCommunityDiscussions(niche: string, audience: string): Promise<RawDiscussion[]> {
  logger.info("BOT-14", `Fetching community discussions for: "${niche}" [${DEV_MODE ? "MOCK" : "LIVE"} mode]`);
  if (DEV_MODE) {
    return [
      mockRedditDiscussions(niche),
      mockProductHuntDiscussions(niche),
      mockAppReviewDiscussions(niche),
      mockYouTubeDiscussions(niche),
      mockForumDiscussions(niche),
    ];
  }
  return [mockRedditDiscussions(niche)]; // Live stubs — connect social search APIs here
}

export function formatDiscussionsForPrompt(discussions: RawDiscussion[]): string {
  return discussions.map(d => {
    const items = d.discussions.map(i =>
      `  [${i.platform}/${i.source}${d.mode === "mock" ? " — MOCK/DEV" : ""}]\n  Pain: ${i.pain_signal}\n  Frequency: ${i.frequency_note}\n  Audience: ${i.audience}\n  Related tools: ${i.related_tools.join(", ")}\n  Strength: ${i.evidence_strength}`
    ).join("\n\n");
    return `=== ${d.platform}: ${d.source_name} ===\n${items}`;
  }).join("\n\n");
}

export function countTotalDiscussions(discussions: RawDiscussion[]): number {
  return discussions.reduce((sum, d) => sum + d.discussions.length, 0);
}
