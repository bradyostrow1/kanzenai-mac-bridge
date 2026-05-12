import { TwitterApi } from "twitter-api-v2";
import { readFileSync } from "node:fs";

for (const line of readFileSync("/Users/bradyostrow/Code/kanzenai/.env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
}

async function main() {
  const client = new TwitterApi({
    appKey: process.env.X_CONSUMER_KEY!,
    appSecret: process.env.X_CONSUMER_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_TOKEN_SECRET!,
  });

  try {
    const tweet = await client.v2.tweet("KanzenAI launching: honest, pricing-first reviews of every tool real estate agents actually use. No fake test counts. kanzenai.com");
    console.log("✓ Tweet posted:", tweet.data.id, "→ https://x.com/i/web/status/" + tweet.data.id);
  } catch (e: any) {
    console.error("✗", e.code, e.message);
    if (e.data) console.error("  data:", JSON.stringify(e.data).slice(0, 500));
  }
}
main();
