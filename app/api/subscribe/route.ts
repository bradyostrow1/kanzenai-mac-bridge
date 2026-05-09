import { NextResponse } from "next/server";

/**
 * Newsletter subscribe endpoint.
 *
 * Currently logs the email to the Vercel runtime log. Once Brady picks a
 * provider, swap the body of forwardToProvider() — everything else stays.
 *
 * Recommended providers (free tier covers first 1k+ subs):
 *   - Resend  (RESEND_API_KEY)            → transactional + audiences
 *   - Beehiiv (BEEHIIV_API_KEY + PUB_ID)  → built for newsletters
 *   - ConvertKit (CONVERTKIT_API_KEY)     → strongest automation tooling
 */

export async function POST(req: Request) {
  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ ok: false, error: "Invalid email" }, { status: 400 });
  }

  try {
    await forwardToProvider(email, body.source);
  } catch (err) {
    console.error("[subscribe] provider error:", err);
    return NextResponse.json({ ok: false, error: "Subscribe failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

async function forwardToProvider(email: string, source?: string): Promise<void> {
  const stamp = new Date().toISOString();
  console.log(`[subscribe] ${stamp} ${email} (source=${source ?? "unknown"})`);

  // ─── Resend Audiences ─────────────────────────────────────────
  // const key = process.env.RESEND_API_KEY;
  // const audienceId = process.env.RESEND_AUDIENCE_ID;
  // if (key && audienceId) {
  //   const r = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  //     body: JSON.stringify({ email, unsubscribed: false }),
  //   });
  //   if (!r.ok && r.status !== 409) throw new Error(`Resend ${r.status}`);
  //   return;
  // }

  // ─── Beehiiv ──────────────────────────────────────────────────
  // const bKey = process.env.BEEHIIV_API_KEY;
  // const pubId = process.env.BEEHIIV_PUBLICATION_ID;
  // if (bKey && pubId) {
  //   const r = await fetch(`https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`, {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${bKey}`, "Content-Type": "application/json" },
  //     body: JSON.stringify({ email, reactivate_existing: true, send_welcome_email: true }),
  //   });
  //   if (!r.ok) throw new Error(`Beehiiv ${r.status}`);
  //   return;
  // }
}
