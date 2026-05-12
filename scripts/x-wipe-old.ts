/**
 * One-time: fetch every tweet on @KanzenOfficial, identify ones NOT created by
 * the KanzenAI bot (i.e., old Tottenham content), and delete them.
 *
 * Usage:
 *   npx tsx scripts/x-wipe-old.ts           # dry-run, lists what would be deleted
 *   npx tsx scripts/x-wipe-old.ts --confirm # actually delete
 */
import { TwitterApi } from "twitter-api-v2";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

const ROOT = "/Users/bradyostrow/Code/kanzenai";
const POSTS_LOG = join(ROOT, ".audit", "x-posts.log");
const REPLIES_LOG = join(ROOT, ".audit", "x-replies-posted.log");

function loadEnv() {
  const p = join(ROOT, ".env.local");
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}
loadEnv();

const CONFIRM = process.argv.includes("--confirm");

const twitter = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY!,
  appSecret: process.env.X_CONSUMER_SECRET!,
  accessToken: process.env.X_ACCESS_TOKEN!,
  accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
});

async function loadKanzenIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const path of [POSTS_LOG, REPLIES_LOG]) {
    if (!existsSync(path)) continue;
    const text = await readFile(path, "utf8");
    for (const line of text.split("\n")) {
      try {
        const o = JSON.parse(line);
        if (o.tweetId) ids.add(o.tweetId);
        if (o.replyId) ids.add(o.replyId);
        if (o.postedTweetId) ids.add(o.postedTweetId);
      } catch {}
    }
  }
  return ids;
}

async function main() {
  const myUserId = process.env.X_ACCESS_TOKEN!.split("-")[0]; // e.g., "1931531161655971841"
  const kanzenIds = await loadKanzenIds();
  console.log(`→ ${kanzenIds.size} known KanzenAI tweet IDs (these will be PRESERVED)`);

  console.log(`→ Pulling timeline for user ${myUserId}...`);
  const all: Array<{ id: string; text: string; created_at?: string }> = [];

  // Paginate through user's recent tweets (free tier allows last ~3200)
  let paginationToken: string | undefined;
  let pageCount = 0;
  while (pageCount < 10) {
    pageCount++;
    const params: Record<string, string | number> = {
      max_results: 100,
      "tweet.fields": "created_at",
    };
    if (paginationToken) params.pagination_token = paginationToken;
    let resp;
    try {
      resp = await twitter.v2.userTimeline(myUserId, {
        max_results: 100,
        "tweet.fields": ["created_at"],
        pagination_token: paginationToken,
      });
    } catch (e) {
      console.error(`✗ Timeline fetch failed: ${(e as Error).message}`);
      break;
    }
    const batch = resp.data?.data ?? [];
    all.push(...batch);
    paginationToken = resp.meta?.next_token;
    console.log(`  · page ${pageCount}: ${batch.length} tweets (total ${all.length})`);
    if (!paginationToken || batch.length === 0) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  // Also preserve anything that mentions kanzenai.com or "KanzenAI" in text
  // (catches one-off manual posts not in the auto-post log)
  const toDelete = all.filter((t) => {
    if (kanzenIds.has(t.id)) return false;
    const lower = t.text.toLowerCase();
    if (lower.includes("kanzenai") || lower.includes("kanzen ai")) return false;
    return true;
  });
  console.log(`\n→ ${all.length} total tweets · ${kanzenIds.size} will be preserved · ${toDelete.length} to delete\n`);

  if (toDelete.length === 0) {
    console.log("✓ Nothing to delete. Profile is clean.");
    return;
  }

  console.log("PREVIEW (first 10):");
  for (const t of toDelete.slice(0, 10)) {
    console.log(`  · ${t.id} (${t.created_at?.slice(0, 10) ?? "?"}) — ${t.text.slice(0, 100).replace(/\n/g, " ")}`);
  }
  if (toDelete.length > 10) console.log(`  · ... and ${toDelete.length - 10} more`);

  if (!CONFIRM) {
    console.log(`\nDRY RUN. Add --confirm to actually delete.`);
    return;
  }

  console.log(`\n→ Deleting ${toDelete.length} tweet(s)...`);
  let deleted = 0;
  let failed = 0;
  for (const t of toDelete) {
    try {
      await twitter.v2.deleteTweet(t.id);
      deleted++;
      if (deleted % 10 === 0) console.log(`  · ${deleted}/${toDelete.length} deleted...`);
      // Be polite to the API — small gap between deletes
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      failed++;
      console.log(`  ✗ ${t.id}: ${(e as Error).message}`);
    }
  }
  console.log(`\n✓ Deleted ${deleted}, failed ${failed}.`);
}

main().catch((err) => { console.error("\n✗ Fatal:", err.message); process.exit(1); });
