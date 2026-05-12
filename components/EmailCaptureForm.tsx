"use client";

import { useState } from "react";

/**
 * Drop-in newsletter signup. Sends to /api/subscribe which adds to Resend
 * audience + fires the welcome email with the resource link.
 *
 * Variants:
 *   compact  - inline form, single line (use inside article body)
 *   stack    - vertical, larger heading (use on landing pages, /resources/*)
 */
export function EmailCaptureForm({
  variant = "compact",
  source,
  headline,
  sub,
}: {
  variant?: "compact" | "stack";
  source?: string;
  headline?: string;
  sub?: string;
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "ok" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);
    try {
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: source ?? "unknown" }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setStatus("error");
        setError(data.error ?? `HTTP ${r.status}`);
        return;
      }
      setStatus("ok");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed");
    }
  }

  if (status === "ok") {
    return (
      <div className={variant === "stack" ? "border border-ink-0 bg-bg-1 p-6" : "border border-ink-0 bg-bg-1 p-4"}>
        <div className="text-[11px] uppercase tracking-[0.18em] text-ink-2 mb-1">✓ You're in</div>
        <div className="text-ink-0 text-[15px]">
          Check your inbox — link to the 2026 Real Estate Tool Stack is on its way.
        </div>
      </div>
    );
  }

  const isStack = variant === "stack";
  return (
    <div className={isStack ? "border border-rule bg-bg-1 p-6 sm:p-8" : "border border-rule bg-bg-1 p-5"}>
      {(headline || isStack) && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 mb-1">FREE · NO SPAM</div>
          <h3 className={isStack ? "display text-2xl leading-tight" : "font-bold text-[17px] leading-tight"}>
            {headline ?? "Get the 2026 Real Estate Tool Stack — free"}
          </h3>
        </div>
      )}
      <p className="text-ink-2 text-[14px] mb-4">
        {sub ?? "One-page pricing breakdown of every CRM, dialer, AI tool, and lead-gen platform agents actually use. Updated monthly."}
      </p>
      <form onSubmit={submit} className={isStack ? "flex flex-col sm:flex-row gap-2" : "flex gap-2"}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={status === "submitting"}
          className="flex-1 bg-bg-0 border border-rule focus:border-ink-0 px-3 py-2.5 text-[14px] text-ink-0 outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="bg-ink-0 text-bg-0 px-5 py-2.5 text-[13px] font-semibold uppercase tracking-[0.1em] hover:bg-warm transition disabled:opacity-50"
        >
          {status === "submitting" ? "sending…" : "send it"}
        </button>
      </form>
      {error && <div className="mt-2 text-[12px] text-red-700">{error}</div>}
      <div className="mt-3 text-[11px] text-ink-3">
        1 honest email per week. Unsubscribe any time.
      </div>
    </div>
  );
}
