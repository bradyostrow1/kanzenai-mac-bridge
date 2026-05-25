/**
 * Target accounts + keyword filters for the X auto-reply bot.
 *
 * The monitor checks these accounts every 30 minutes for new tweets matching
 * keywords. When a match is found, Claude drafts a substantive reply using
 * data from kanzenai.com articles, and queues it for your one-click approval.
 *
 * Adding accounts: include the X username (no @). Try to pick AI-tool operators,
 * indie hackers, creator-economy voices, and the official accounts of the
 * SaaS products KanzenAI reviews.
 */
export const TARGET_ACCOUNTS: string[] = [
  "AnthropicAI",      // Claude / Anthropic
  "OpenAI",           // GPT
  "sama",             // Sam Altman
  "karpathy",         // Andrej Karpathy
  "goodside",         // Riley Goodside (prompt eng)
  "swyx",             // AI dev voice
  "levelsio",         // Pieter Levels — solopreneur / indie hacker
  "marckohlbrugge",   // BetaList — indie launches
  "NotionHQ",         // Notion
  "cursor_ai",        // Cursor AI editor
];

/**
 * Keywords/products from kanzenai.com that, when mentioned in a target
 * account's tweet, signal we have a substantive reply ready.
 */
export const REPLY_KEYWORDS: string[] = [
  // AI models / platforms
  "Claude",
  "ChatGPT",
  "GPT-4",
  "GPT-5",
  "Anthropic",
  "OpenAI",
  "LLM",
  "prompt engineering",
  // AI writing
  "Jasper",
  "Copy.ai",
  "Writesonic",
  "AI writing",
  // AI image / video / voice
  "Midjourney",
  "ElevenLabs",
  "Descript",
  "Pictory",
  "Synthesia",
  "Runway",
  "AI voice",
  "AI video",
  // AI coding
  "Cursor",
  "Copilot",
  "Cline",
  "AI coding",
  // Productivity / SaaS
  "Notion",
  "Linear",
  "Airtable",
  "ClickUp",
  "monday",
  "Calendly",
  "Loom",
  // Automation / no-code
  "Zapier",
  "Make",
  "n8n",
  "no-code",
  "automation",
  "workflow",
  // Email / creator
  "ConvertKit",
  "Beehiiv",
  "Substack",
  "newsletter",
  // Design
  "Figma",
  "Framer",
  "Webflow",
  // Deployment
  "Vercel",
  "Netlify",
  // General-interest categories
  "AI tools",
  "AI stack",
  "tool stack",
  "tech stack",
  "solopreneur",
  "indie hacker",
  "creator economy",
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
