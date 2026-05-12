import { NextResponse } from "next/server";

/**
 * Visitor beacon endpoint. Fires when someone loads kanzenai.com.
 *
 * Storage: hits counterapi.dev (free, anonymous, no signup) for two counters:
 *   - kanzenai-{YYYY-MM-DD}   — today's count
 *   - kanzenai-total          — lifetime count
 *
 * The localhost dashboard reads these via /api/dashboard/visitors.
 * If counterapi.dev is down, this is a silent no-op — no user impact.
 */

export const runtime = "edge";

function todayKey(): string {
  const d = new Date();
  return `kanzenai-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function bump(key: string): Promise<void> {
  try {
    await fetch(`https://api.counterapi.dev/v1/kanzenai/${key}/up`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* swallow */
  }
}

export async function POST(req: Request) {
  // Read body but don't require it — we don't need path/ref for the basic counter
  try { await req.json(); } catch { /* ok */ }

  // Bump both counters in parallel
  await Promise.all([bump(todayKey()), bump("kanzenai-total")]);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ method: "POST only" }, { status: 405 });
}
