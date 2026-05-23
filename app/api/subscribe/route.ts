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

  const key = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  const fromAddr = process.env.RESEND_FROM ?? "hello@kanzenai.com";
  if (!key || !audienceId) {
    console.warn("[subscribe] RESEND_API_KEY or RESEND_AUDIENCE_ID missing — logging only");
    return;
  }

  // 1) Add to Resend audience (409 = already exists, fine)
  const addResp = await fetch(`https://api.resend.com/audiences/${audienceId}/contacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, unsubscribed: false }),
  });
  if (!addResp.ok && addResp.status !== 409) {
    const txt = await addResp.text();
    throw new Error(`Resend audience add failed (${addResp.status}): ${txt.slice(0, 200)}`);
  }
  const alreadyExists = addResp.status === 409;

  // 2) Send the welcome email with the resource link (skip if already subscribed)
  if (alreadyExists) return;

  const mailResp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `KanzenAI <${fromAddr}>`,
      to: [email],
      subject: "Your real estate tool stack — inside",
      html: welcomeEmailHtml(source),
      text: welcomeEmailText(source),
      headers: {
        "List-Unsubscribe": `<mailto:${fromAddr}?subject=unsubscribe>`,
      },
    }),
  });
  if (!mailResp.ok) {
    const txt = await mailResp.text();
    // Don't fail the user's signup over a mail-delivery hiccup; log only.
    console.error(`[subscribe] welcome mail failed (${mailResp.status}): ${txt.slice(0, 200)}`);
  }
}

function welcomeEmailHtml(source?: string): string {
  const safeSource = (source ?? "homepage").replace(/[<>&"']/g, "");
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:-apple-system,Helvetica,Arial,sans-serif;background:#f0eee9;color:#0a0a0a;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-family:'Playfair Display',Georgia,serif;font-weight:800;font-size:36px;letter-spacing:-1px;">KanzenAI</div>
      <div style="font-size:11px;letter-spacing:4px;color:#525252;margin-top:8px;">HONEST REVIEWS · REAL ESTATE AGENT TOOL STACK</div>
    </div>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px;">You're in. Here's the link we promised:</p>
    <div style="margin:20px 0;text-align:center;">
      <a href="https://kanzenai.com/resources/tool-stack?ref=welcome" style="display:inline-block;background:#0a0a0a;color:#f0eee9;text-decoration:none;padding:14px 28px;font-weight:600;font-size:14px;letter-spacing:0.5px;">→ Open the 2026 Real Estate Tool Stack</a>
    </div>
    <p style="font-size:15px;line-height:1.6;margin:24px 0 16px;">It's a one-page breakdown of every CRM, dialer, AI tool, and lead-gen platform agents are actually using in 2026 — with the pricing they hide.</p>
    <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">A few things to know:</p>
    <ul style="font-size:15px;line-height:1.7;padding-left:20px;margin:0 0 24px;">
      <li>We review every tool ourselves before listing it. No vendor pays for placement.</li>
      <li>When you click a tool's link from our site, we may earn a commission. It doesn't change the review.</li>
      <li>We'll send 1 honest email per week. Pricing changes, new tool launches, agent-stack breakdowns. That's it.</li>
    </ul>
    <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">Reply to this email if you want us to dig into a specific tool. We read every reply.</p>
    <p style="font-size:15px;line-height:1.6;margin:24px 0 0;">— The KanzenAI Editorial Team</p>
    <hr style="border:none;border-top:1px solid #d0cec9;margin:40px 0 16px;" />
    <p style="font-size:11px;color:#525252;margin:0;">Sent because you signed up at kanzenai.com (${safeSource}). Reply with "unsubscribe" to opt out.</p>
  </div>
</body></html>`;
}

function welcomeEmailText(source?: string): string {
  return `You're in. Here's the link we promised:

→ The 2026 Real Estate Tool Stack
https://kanzenai.com/resources/tool-stack?ref=welcome

A one-page breakdown of every CRM, dialer, AI tool, and lead-gen platform agents are actually using in 2026 — with the pricing they hide.

A few things to know:
- We review every tool ourselves before listing it. No vendor pays for placement.
- When you click a tool's link from our site, we may earn a commission. It doesn't change the review.
- We'll send 1 honest email per week. Pricing changes, new tool launches, agent-stack breakdowns. That's it.

Reply to this email if you want us to dig into a specific tool. We read every reply.

— The KanzenAI Editorial Team

---
Sent because you signed up at kanzenai.com (source: ${source ?? "homepage"}). Reply with "unsubscribe" to opt out.`;
}
