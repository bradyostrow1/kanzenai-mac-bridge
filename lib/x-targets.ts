/**
 * Target accounts + keyword filters for the X auto-reply bot.
 *
 * The monitor checks these accounts every 30 minutes for new tweets matching
 * keywords. When a match is found, Claude drafts a substantive reply using
 * data from kanzenai.com articles, and queues it for your one-click approval.
 *
 * Adding accounts: include the X username (no @). Try to pick real-estate
 * coaches, agent influencers, brokerage execs, and industry publications.
 */
export const TARGET_ACCOUNTS: string[] = [
  "RickyCarruth", // RE coach, posts daily about agent struggles + tools
  "TomFerry", // biggest RE coach on X
  "RyanSerhant", // top NYC agent, large following
  "HousingWire", // industry news
  "Inman", // industry publication
  "BarbaraCorcoran", // RE celebrity
  "LabCoatAgents", // huge RE agent community
  "RealEstateCake", // tech-focused RE commentary
  "RealEstateGood", // agent-tools coverage
];

/**
 * Keywords/products from kanzenai.com that, when mentioned in a target
 * account's tweet, signal we have a substantive reply ready.
 */
export const REPLY_KEYWORDS: string[] = [
  // CRM
  "CRM",
  "Follow Up Boss",
  "FUB",
  "kvCORE",
  "Lofty",
  "Chime",
  "Sierra Interactive",
  "Real Geeks",
  // Dialers
  "Vulcan7",
  "Mojo Dialer",
  "RedX",
  "PhoneBurner",
  "Espresso Agent",
  "cold call",
  // Video / messaging
  "BombBomb",
  "Loom",
  "Dubb",
  "Vidyard",
  "video email",
  // AI tools
  "AI assistant",
  "AI for agents",
  "Structurely",
  "AI lead",
  // ISA / outsourcing
  "ISA",
  "Smith.ai",
  "Verse.io",
  "Ylopo",
  // Misc agent tools
  "Dotloop",
  "DocuSign",
  "SkySlope",
  "QuickBooks",
  "Realtyzam",
  "ProspectsPLUS",
  "Handwrytten",
  // General-interest categories
  "lead gen",
  "real estate tech",
  "agent tools",
  "agent stack",
  "tech stack",
];

/**
 * Caps so we don't get @KanzenOfficial suspended.
 * X auto-suspends fresh accounts that reply too fast to multiple big accounts.
 */
export const SAFETY_CAPS = {
  maxRepliesPerDay: 8,
  maxRepliesPerTargetPerWeek: 2,
  maxRepliesPerTargetPerDay: 1,
  minMinutesBetweenReplies: 25,
  // Only reply to tweets less than this many hours old (replying to stale
  // tweets looks bot-like and gets less reach)
  maxTweetAgeHours: 4,
};
