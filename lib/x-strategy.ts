/**
 * X strategy config loader + hard-rail validator.
 *
 * Shared by Bot 1 (Writer), Bot 3 (Poster), Bot 4 (Reply Hunter), Bot 5
 * (Engagement), and written by Bot 11 (X Strategist).
 *
 * The HARD RAILS in validate() are walls — Bot 11 cannot cross them even in
 * full-auto mode. They're checked on every load (so a malformed config from
 * disk fails immediately rather than poisoning a downstream bot).
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

export type XStrategy = {
  schema_version: number;
  updated_at: string;
  updated_by: string;
  frozen: boolean;

  operators: string[];
  follow_pool: string[];
  niche_keywords: string[];

  preferred_post_hours_local: number[];
  thread_vs_single_ratio: number;

  topic_emphasis: string;

  last_scan_summary: null | {
    ts: string;
    trending_formats: string[];
    trending_topics: string[];
    operator_engagement_top3: string[];
  };
};

const CONFIG_PATH = join(process.cwd(), "config", "x-strategy.json");
const DEFAULTS_PATH = join(process.cwd(), "config", "x-strategy.default.json");

// ─── HARD RAILS (non-negotiable) ──────────────────────────────────
// These mirror the directive's "5 walls" — every load checks them, so even
// if Bot 11 misbehaves the worst it can do is fail validation on the next
// read and the bots fall back to defaults.

const NICHE_LOCK_KEYWORDS = [
  "real estate", "realtor", "brokerage", "agent",
  "ai", "tools", "productivity", "saas",
];

const VOICE_LOCK_BANNED = [
  // persona / first-person markers
  "brady ostrow", "i'm brady", "personally i", "my take",
  "from me", "—brady", "- brady", "edgy", "controversial",
];

const RAGE_BAIT_BANNED = [
  "politics", "political", "trump", "biden", "election",
  "drama", "outrage", "outraged", "controversy", "controversial",
  "hot take", "rage", "cancel culture", "woke",
];

/** Throws if the config violates any of the 5 hard rails. */
export function validate(c: XStrategy): void {
  // Wall 1 — NICHE LOCK
  if (c.topic_emphasis) {
    const lower = c.topic_emphasis.toLowerCase();
    if (!NICHE_LOCK_KEYWORDS.some((k) => lower.includes(k))) {
      throw new Error(
        `[x-strategy] HARD RAIL: topic_emphasis must reference the niche ` +
        `(real-estate / AI-tools / productivity). Got: "${c.topic_emphasis.slice(0, 80)}"`
      );
    }
  }
  // Wall 2 — VOICE LOCK
  const voiceCheck = c.topic_emphasis.toLowerCase();
  for (const banned of VOICE_LOCK_BANNED) {
    if (voiceCheck.includes(banned)) {
      throw new Error(`[x-strategy] HARD RAIL: VOICE LOCK violated — banned phrase "${banned}"`);
    }
  }
  // Wall 3 — NO RAGE-BAIT
  const rageCheck = `${c.topic_emphasis}`.toLowerCase();
  for (const banned of RAGE_BAIT_BANNED) {
    if (rageCheck.includes(banned)) {
      throw new Error(`[x-strategy] HARD RAIL: RAGE-BAIT detected — phrase "${banned}"`);
    }
  }
  // Wall 4 — MONEY METRIC is enforced in the strategist's Claude prompt
  // (it's instructed to optimize for followers + profile clicks + link clicks,
  // never likes/RT vanity). Nothing to check on the config itself.
  //
  // Wall 5 — SPAM-SAFE is enforced via the shared stop-marker check inside
  // the strategist runner (lib has no fs check here).

  // Structural sanity
  if (!Array.isArray(c.operators) || c.operators.length === 0)
    throw new Error("[x-strategy] operators must be a non-empty array");
  if (c.operators.length > 60)
    throw new Error("[x-strategy] operators capped at 60 — curated > exhaustive");
  if (!Array.isArray(c.follow_pool))
    throw new Error("[x-strategy] follow_pool must be an array");
  if (c.follow_pool.length > 80)
    throw new Error("[x-strategy] follow_pool capped at 80");
  if (!Array.isArray(c.niche_keywords) || c.niche_keywords.length === 0)
    throw new Error("[x-strategy] niche_keywords must be a non-empty array");
  if (!Array.isArray(c.preferred_post_hours_local) || !c.preferred_post_hours_local.every((h) => Number.isInteger(h) && h >= 0 && h < 24))
    throw new Error("[x-strategy] preferred_post_hours_local must be array of ints 0–23");
  if (!Number.isFinite(c.thread_vs_single_ratio) || c.thread_vs_single_ratio < 0 || c.thread_vs_single_ratio > 1)
    throw new Error("[x-strategy] thread_vs_single_ratio must be 0..1");
}

/** Read + validate the live config. Falls back to defaults if the live file
 *  is missing or fails validation (logs a warning to stderr in that case). */
export function loadStrategy(): XStrategy {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, "utf8");
  } catch {
    raw = readFileSync(DEFAULTS_PATH, "utf8");
  }
  let parsed: XStrategy;
  try {
    parsed = JSON.parse(raw) as XStrategy;
    validate(parsed);
  } catch (e: any) {
    console.warn(`[x-strategy] live config invalid (${e.message}) — falling back to defaults`);
    parsed = JSON.parse(readFileSync(DEFAULTS_PATH, "utf8")) as XStrategy;
    validate(parsed);
  }
  return parsed;
}

/** Has the live config been touched since the given epoch ms? Useful for
 *  bots that cache loadStrategy() at startup but want to reload on change. */
export function configMtimeMs(): number {
  if (!existsSync(CONFIG_PATH)) return 0;
  return statSync(CONFIG_PATH).mtimeMs;
}

export const X_STRATEGY_PATHS = {
  live: CONFIG_PATH,
  defaults: DEFAULTS_PATH,
  changelog: join(process.cwd(), "config", "x-strategy-changelog.jsonl"),
  versionsDir: join(process.cwd(), ".audit", "x-strategy-versions"),
};
