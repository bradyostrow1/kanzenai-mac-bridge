"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

export function EmailSignup({ source }: { source: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError("");
    try {
      const r = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setError(data.error ?? "Something went wrong");
        setState("error");
        return;
      }
      setState("success");
    } catch {
      setError("Network error — try again");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="inline-flex items-center gap-2 text-ink-0">
        <Check className="w-4 h-4" />
        <span className="text-[14px] font-semibold">You're on the list. New review every Sunday.</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl">
      <input
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        disabled={state === "loading"}
        className="flex-1 px-5 py-3 rounded-full border border-rule bg-bg-0 text-ink-0 placeholder:text-ink-3 text-[15px] focus:outline-none focus:border-ink-0 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={state === "loading"}
        className="cta-link justify-center sm:whitespace-nowrap disabled:opacity-60"
      >
        {state === "loading" ? "Subscribing…" : "Get the brief"}
        <ArrowRight className="w-4 h-4" />
      </button>
      {state === "error" && (
        <div className="sm:absolute sm:mt-14 text-[12px] text-amber-700">{error}</div>
      )}
    </form>
  );
}
