"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, Send, Check, AlertCircle, Loader2, ExternalLink } from "lucide-react";

type Email = {
  id: string;
  vendor: string;
  affiliateSlug: string;
  to: string;
  subject: string;
  body: string;
  commission: string;
  priority: number;
  sent: { id: string; sentAt: string; resendId?: string; error?: string } | null;
};

type State = {
  emails: Email[];
  resendConfigured: boolean;
  fromAddress: string;
};

export function OutreachPanel() {
  const [state, setState] = useState<State | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/dashboard/outreach", { cache: "no-store" });
      const data = await r.json();
      setState(data);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(id: string) {
    if (!confirm(`Send the outreach email to ${state?.emails.find((e) => e.id === id)?.vendor}?`)) {
      return;
    }
    setSending(id);
    setErrors((e) => ({ ...e, [id]: "" }));
    try {
      const r = await fetch("/api/dashboard/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) {
        setErrors((e) => ({ ...e, [id]: typeof data.error === "string" ? data.error : JSON.stringify(data.error) }));
      }
    } catch (e: any) {
      setErrors((er) => ({ ...er, [id]: e.message }));
    } finally {
      setSending(null);
      load();
    }
  }

  if (!state) {
    return (
      <div className="border border-[#1f1f1f] bg-[#0d0d0d] mb-6">
        <div className="px-4 py-2.5 border-b border-[#1f1f1f] text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3] flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" />
          Vendor outreach
        </div>
        <div className="p-4 text-[#525252] text-[13px]">Loading…</div>
      </div>
    );
  }

  const sentCount = state.emails.filter((e) => e.sent && !e.sent.error).length;
  const totalCount = state.emails.length;

  return (
    <section className="border border-[#1f1f1f] bg-[#0d0d0d] mb-6">
      <div className="px-4 py-2.5 border-b border-[#1f1f1f] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3]">
          <Mail className="w-3.5 h-3.5" />
          Vendor outreach
        </span>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-[#525252]">
          {state.resendConfigured ? (
            <span className="text-emerald-300">Resend connected · from {state.fromAddress}</span>
          ) : (
            <span className="text-amber-300">⚠ Resend not configured — add RESEND_API_KEY to .env.local</span>
          )}
          <span>{sentCount} of {totalCount} sent</span>
        </div>
      </div>

      <div className="divide-y divide-[#1f1f1f]">
        {state.emails.map((e) => {
          const isExpanded = expanded === e.id;
          const isSending = sending === e.id;
          const sent = e.sent && !e.sent.error;
          const failed = e.sent && e.sent.error;

          return (
            <div key={e.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${sent ? "bg-emerald-400" : failed ? "bg-red-400" : "bg-[#525252]"}`} />
                    <span className="text-[#f0eee9] font-semibold text-[13px]">{e.vendor}</span>
                    <span className="text-[10px] text-[#525252] uppercase tracking-wider">
                      {e.commission}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#a3a3a3] mb-1">
                    To: <code className="text-[#f0eee9]">{e.to}</code>
                  </div>
                  <div className="text-[11px] text-[#525252]">{e.subject}</div>
                  {sent && (
                    <div className="mt-2 text-[10px] text-emerald-400 inline-flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Sent {new Date(e.sent!.sentAt).toLocaleString()}
                      {e.sent!.resendId && ` · ${e.sent!.resendId.slice(0, 12)}…`}
                    </div>
                  )}
                  {failed && (
                    <div className="mt-2 text-[10px] text-red-400 inline-flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 mt-0.5" />
                      <span>Send failed — {e.sent!.error?.slice(0, 200)}</span>
                    </div>
                  )}
                  {errors[e.id] && (
                    <div className="mt-2 text-[10px] text-red-400 inline-flex items-start gap-1">
                      <AlertCircle className="w-3 h-3 mt-0.5" />
                      <span>{errors[e.id].slice(0, 300)}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  <button
                    onClick={() => setExpanded(isExpanded ? null : e.id)}
                    className="px-2.5 py-1 border border-[#262626] hover:border-[#525252] transition text-[11px]"
                  >
                    {isExpanded ? "hide draft" : "preview draft"}
                  </button>
                  <button
                    onClick={() => send(e.id)}
                    disabled={isSending || sent || !state.resendConfigured}
                    className="px-3 py-1 bg-[#f0eee9] text-[#0a0a0a] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition text-[11px] inline-flex items-center gap-1.5 font-semibold"
                  >
                    {isSending ? (
                      <><Loader2 className="w-3 h-3 animate-spin" /> sending…</>
                    ) : sent ? (
                      <><Check className="w-3 h-3" /> sent</>
                    ) : (
                      <><Send className="w-3 h-3" /> send</>
                    )}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 p-3 bg-[#171717] border border-[#262626] text-[11px] text-[#f0eee9] whitespace-pre-wrap leading-relaxed">
                  {e.body}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!state.resendConfigured && (
        <div className="px-4 py-3 border-t border-[#1f1f1f] bg-amber-950/20 text-[11px] text-amber-200 leading-relaxed">
          <strong className="text-amber-100">To enable sending:</strong> Sign up at{" "}
          <a href="https://resend.com" target="_blank" rel="noopener" className="underline inline-flex items-center gap-0.5">
            resend.com <ExternalLink className="w-2.5 h-2.5" />
          </a>{" "}
          → verify kanzenai.com domain → create API key → paste it as <code className="bg-amber-950 px-1">RESEND_API_KEY</code> in <code className="bg-amber-950 px-1">.env.local</code>. Restart dev server. Free tier: 3k emails/mo.
        </div>
      )}
    </section>
  );
}
