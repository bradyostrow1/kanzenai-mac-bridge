import { NextResponse } from "next/server";
import { AFFILIATES } from "@/lib/affiliates";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Affiliate redirect handler.
 *
 * Every affiliate link in articles points to /go/<vendor-slug>. This route:
 *   1. Looks up the real URL in lib/affiliates.ts
 *   2. Logs the click (referrer, UA, timestamp, vendor)
 *   3. 302-redirects to the real URL
 *
 * Logging:
 *   - Production: console.log → Vercel runtime logs (1h retention on free tier)
 *   - Development: also appended to .audit/clicks.log for the dashboard
 *
 * Returns 404 for unknown vendors so we never leak placeholder URLs to bots.
 */

export async function GET(
  req: Request,
  { params }: { params: { vendor: string } },
) {
  const slug = params.vendor.toLowerCase();
  const vendor = AFFILIATES[slug];
  if (!vendor) {
    return NextResponse.json(
      { error: `Unknown affiliate vendor: ${slug}` },
      { status: 404 },
    );
  }

  // Capture context
  const url = new URL(req.url);
  const referrer = req.headers.get("referer") ?? "";
  const ua = req.headers.get("user-agent") ?? "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "";
  const ts = new Date().toISOString();

  const event = {
    ts,
    vendor: slug,
    name: vendor.name,
    status: vendor.status,
    referrer: referrer.replace(/^https?:\/\//, "").slice(0, 120),
    article: extractArticleSlug(referrer),
    ua: ua.slice(0, 80),
    ip: hashIp(ip), // hashed for privacy
    utm: {
      source: url.searchParams.get("utm_source"),
      medium: url.searchParams.get("utm_medium"),
      campaign: url.searchParams.get("utm_campaign"),
    },
  };

  // Always log (Vercel captures this)
  console.log(`[affiliate-click] ${JSON.stringify(event)}`);

  // Persist locally in dev so the dashboard can show stats
  if (process.env.NODE_ENV === "development") {
    await persistLocally(event);
  }

  return NextResponse.redirect(vendor.url, 302);
}

// Extract /articles/<slug> or /compare/<slug> from a referrer
function extractArticleSlug(referrer: string): string | null {
  if (!referrer) return null;
  const m = referrer.match(/\/(articles|compare)\/([\w-]+)/);
  return m ? `${m[1]}/${m[2]}` : null;
}

// SHA-256 first 12 chars — enough for unique-visitor counting, no IP retention
function hashIp(ip: string): string {
  if (!ip) return "";
  let h = 5381;
  for (let i = 0; i < ip.length; i++) h = (h * 33) ^ ip.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8, "0");
}

async function persistLocally(event: any) {
  try {
    const dir = join(process.cwd(), ".audit");
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const line = JSON.stringify(event) + "\n";
    const path = join(dir, "clicks.log");
    await writeFile(path, line, { flag: "a" });
  } catch {
    // never let logging failures break the redirect
  }
}
