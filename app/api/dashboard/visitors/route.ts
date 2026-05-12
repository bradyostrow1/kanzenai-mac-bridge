import { NextResponse } from "next/server";

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

function todayKey(): string {
  const d = new Date();
  return `kanzenai-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

async function read(key: string): Promise<number | null> {
  try {
    const r = await fetch(`https://api.counterapi.dev/v1/kanzenai/${key}`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return typeof data.count === "number" ? data.count : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;

  const [today, total] = await Promise.all([read(todayKey()), read("kanzenai-total")]);

  return NextResponse.json({
    today: today ?? 0,
    total: total ?? 0,
    source: "counterapi.dev (free)",
    fetchedAt: new Date().toISOString(),
  });
}
