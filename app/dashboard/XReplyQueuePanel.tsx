"use client";

import { useEffect, useState } from "react";
import { Send, Trash2, ExternalLink, MessageCircle, RefreshCw, Loader2, Edit3, Link as LinkIcon, Plus } from "lucide-react";

type QueuedReply = {
  id: string;
  targetUser: string;
  tweetId: string;
  tweetText: string;
  tweetUrl: string;
  tweetCreatedAt: string;
  matchedKeywords: string[];
  replyText: string;
  draftedAt: string;
  status: "pending" | "posted" | "discarded";
  postedAt?: string;
  postedTweetId?: string;
  sourceArticleSlug?: string;
};

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function XReplyQueuePanel() {
  const [items, setItems] = useState<QueuedReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasting, setPasting] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/dashboard/x-reply-queue", { cache: "no-store" });
      const data = await r.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); const t = setInterval(load, 20_000); return () => clearInterval(t); }, []);

  async function draftFromUrl() {
    if (!pasteUrl.trim()) return;
    setPasting(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/x-draft-from-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: pasteUrl.trim() }),
      });
      const data = await r.json();
      if (!r.ok) setError(data.error ?? `HTTP ${r.status}`);
      else { setPasteUrl(""); load(); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPasting(false);
    }
  }

  async function act(id: string, action: "post" | "discard" | "edit", replyText?: string) {
    setBusyId(id);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/x-reply-queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, replyText }),
      });
      const data = await r.json();
      if (!r.ok) setError(data.error ?? `HTTP ${r.status}`);
      else if (action === "edit") setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
      load();
    }
  }

  const visible = items.filter((i) => showAll || i.status === "pending");
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <section className="border border-[#1f1f1f] bg-[#0d0d0d] mb-6">
      <div className="px-4 py-2.5 border-b border-[#1f1f1f] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3]">
          <MessageCircle className="w-3.5 h-3.5" />
          X reply queue
          {pendingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-900 text-[10px]">
              {pendingCount} pending
            </span>
          )}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-[#525252]">
          <button onClick={() => setShowAll((v) => !v)} className="hover:text-[#f0eee9] transition uppercase tracking-[0.18em]">
            {showAll ? "pending only" : "show all"}
          </button>
          <button onClick={load} className="hover:text-[#f0eee9] transition flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            refresh
          </button>
        </div>
      </div>

      {/* Paste-URL drafter */}
      <div className="px-4 py-3 border-b border-[#1f1f1f] bg-[#0a0a0a]">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#525252] mb-2">
          Draft a reply from any tweet URL
        </div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <LinkIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#525252]" />
            <input
              value={pasteUrl}
              onChange={(e) => setPasteUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && draftFromUrl()}
              placeholder="https://x.com/someone/status/123…"
              disabled={pasting}
              className="w-full bg-[#0d0d0d] border border-[#262626] focus:border-emerald-700 pl-8 pr-3 py-2 text-[12.5px] text-[#f0eee9] placeholder:text-[#525252] outline-none disabled:opacity-50"
            />
          </div>
          <button
            onClick={draftFromUrl}
            disabled={pasting || !pasteUrl.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-emerald-700 bg-emerald-950/30 hover:bg-emerald-950 text-emerald-300 text-[12px] transition disabled:opacity-50"
          >
            {pasting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            draft reply
          </button>
        </div>
        <div className="mt-1.5 text-[10px] text-[#525252]">
          Paste any tweet URL — Claude pulls relevant data from your articles and drafts a reply you can approve below.
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 border-b border-red-900/40 bg-red-950/20 text-red-300 text-[12px]">{error}</div>
      )}

      {loading ? (
        <div className="p-6 text-[12px] text-[#525252]">loading queue…</div>
      ) : visible.length === 0 ? (
        <div className="p-6 text-[12px] text-[#525252]">
          No reply drafts. Monitor runs every 30 min — when target accounts post about CRMs, dialers, AI tools, etc., drafts appear here.
        </div>
      ) : (
        <div className="divide-y divide-[#1f1f1f]">
          {visible.map((item) => {
            const isBusy = busyId === item.id;
            const isEditing = editing === item.id;
            return (
              <div key={item.id} className={`p-4 ${item.status === "posted" ? "opacity-50" : item.status === "discarded" ? "opacity-30" : ""}`}>
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[11px]">
                    <a
                      href={`https://x.com/${item.targetUser}`}
                      target="_blank"
                      rel="noopener"
                      className="text-emerald-300 hover:text-emerald-200 font-medium"
                    >
                      @{item.targetUser}
                    </a>
                    <span className="text-[#525252]">·</span>
                    <span className="text-[#a3a3a3]">{timeAgo(item.tweetCreatedAt)}</span>
                    <span className="text-[#525252]">·</span>
                    <span className="text-[10px] text-[#525252] uppercase tracking-[0.12em]">
                      {item.matchedKeywords.slice(0, 3).join(", ")}
                    </span>
                  </div>
                  <span className={`text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 border ${
                    item.status === "pending" ? "border-emerald-800 text-emerald-300"
                    : item.status === "posted" ? "border-[#262626] text-[#525252]"
                    : "border-red-900 text-red-400"
                  }`}>{item.status}</span>
                </div>

                {/* Original tweet */}
                <div className="mb-3 border-l-2 border-[#262626] pl-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#525252] mb-1 flex items-center justify-between">
                    <span>Original tweet</span>
                    <a href={item.tweetUrl} target="_blank" rel="noopener" className="hover:text-[#f0eee9] flex items-center gap-1">
                      view on x <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-[12.5px] text-[#a3a3a3] leading-relaxed whitespace-pre-wrap">{item.tweetText}</div>
                </div>

                {/* Reply draft (editable) */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[#525252] mb-1 flex items-center justify-between">
                    <span>Your draft reply ({(isEditing ? draft : item.replyText).length} chars)</span>
                    {!isEditing && item.status === "pending" && (
                      <button
                        onClick={() => { setEditing(item.id); setDraft(item.replyText); }}
                        className="text-[#a3a3a3] hover:text-[#f0eee9] flex items-center gap-1"
                      >
                        <Edit3 className="w-3 h-3" /> edit
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <div>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value.slice(0, 270))}
                        rows={4}
                        className="w-full bg-[#0a0a0a] border border-[#525252] focus:border-emerald-700 p-2 text-[12.5px] text-[#f0eee9] outline-none resize-y"
                      />
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => act(item.id, "edit", draft)}
                          disabled={isBusy}
                          className="text-[11px] px-3 py-1 border border-emerald-700 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950 disabled:opacity-50"
                        >
                          save edit
                        </button>
                        <button onClick={() => setEditing(null)} className="text-[11px] px-3 py-1 border border-[#262626] text-[#a3a3a3] hover:border-[#525252]">
                          cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <pre className="text-[13px] text-[#f0eee9] font-sans whitespace-pre-wrap leading-relaxed bg-[#0a0a0a] border border-[#1f1f1f] p-3">{item.replyText}</pre>
                  )}
                </div>

                {/* Posted result */}
                {item.status === "posted" && item.postedTweetId && (
                  <div className="mb-3 text-[11px] text-emerald-300">
                    ✓ Posted {item.postedAt && timeAgo(item.postedAt)} —{" "}
                    <a href={`https://x.com/i/web/status/${item.postedTweetId}`} target="_blank" rel="noopener" className="underline">
                      view your reply
                    </a>
                  </div>
                )}

                {/* Actions */}
                {item.status === "pending" && !isEditing && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => act(item.id, "post")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-emerald-700 bg-emerald-950/30 hover:bg-emerald-950 text-emerald-300 text-[12px] transition disabled:opacity-50"
                    >
                      {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      post reply
                    </button>
                    <button
                      onClick={() => act(item.id, "discard")}
                      disabled={isBusy}
                      className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-[#262626] hover:border-red-700 hover:text-red-300 text-[#a3a3a3] text-[11px] transition disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      discard
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
