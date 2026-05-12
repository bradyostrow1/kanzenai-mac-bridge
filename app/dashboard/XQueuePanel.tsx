"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Trash2, ExternalLink, Twitter, RefreshCw } from "lucide-react";

type QueueItem = {
  slug: string;
  title: string;
  url: string;
  category?: string;
  tweetText: string;
  replyText: string;
  generatedAt: string;
  status: "pending" | "copied" | "posted" | "discarded";
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

export function XQueuePanel() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDiscarded, setShowDiscarded] = useState(false);

  async function load() {
    try {
      const r = await fetch("/api/dashboard/x-queue", { cache: "no-store" });
      const data = await r.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  async function updateStatus(slug: string, status: QueueItem["status"]) {
    await fetch("/api/dashboard/x-queue", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, status }),
    });
    load();
  }

  async function copy(text: string, key: string, status: QueueItem["status"] = "copied") {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
    if (status) {
      const item = items.find((i) => `${i.slug}-tweet` === key || `${i.slug}-reply` === key);
      if (item && item.status === "pending") updateStatus(item.slug, "copied");
    }
  }

  const visible = items.filter((i) => showDiscarded || i.status !== "discarded");
  const pendingCount = items.filter((i) => i.status === "pending").length;

  return (
    <section className="border border-rule bg-bg-1 mb-6">
      <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
          <Twitter className="w-3.5 h-3.5" />
          X tweet queue
          {pendingCount > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px]">
              {pendingCount} pending
            </span>
          )}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-ink-3">
          <button
            onClick={() => setShowDiscarded((v) => !v)}
            className="hover:text-ink-0 transition uppercase tracking-[0.18em]"
          >
            {showDiscarded ? "hide discarded" : "show discarded"}
          </button>
          <button onClick={load} className="hover:text-ink-0 transition flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />
            refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-[12px] text-ink-3">loading queue…</div>
      ) : visible.length === 0 ? (
        <div className="p-6 text-[12px] text-ink-3">
          No tweets queued. Run <code className="text-amber-800">X_QUEUE_ONLY=1 npm run post-to-x -- --backlog 2</code> to seed.
        </div>
      ) : (
        <div className="divide-y divide-rule">
          {visible.map((item) => {
            const isCopiedMain = copied === `${item.slug}-tweet`;
            const isCopiedReply = copied === `${item.slug}-reply`;
            return (
              <div
                key={item.slug}
                className={`p-4 ${
                  item.status === "posted"
                    ? "opacity-50"
                    : item.status === "discarded"
                      ? "opacity-30"
                      : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-ink-3 mb-1">
                      {item.category ?? "—"} · {timeAgo(item.generatedAt)}
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener"
                      className="text-ink-0 hover:text-ink-0 text-[13px] truncate block"
                    >
                      {item.title}
                      <ExternalLink className="inline w-3 h-3 ml-1 align-baseline text-ink-3" />
                    </a>
                  </div>
                  <span
                    className={`text-[10px] uppercase tracking-[0.18em] px-2 py-0.5 border ${
                      item.status === "pending"
                        ? "border-emerald-600 text-emerald-800"
                        : item.status === "copied"
                          ? "border-amber-600 text-amber-800"
                          : item.status === "posted"
                            ? "border-rule text-ink-3"
                            : "border-red-300 text-red-700"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>

                {/* Main tweet */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-1 flex justify-between">
                    <span>Tweet ({item.tweetText.length} chars)</span>
                  </div>
                  <pre className="text-[12.5px] text-ink-0 font-sans whitespace-pre-wrap leading-relaxed bg-bg-0 border border-rule p-3">
                    {item.tweetText}
                  </pre>
                  <button
                    onClick={() => copy(item.tweetText, `${item.slug}-tweet`)}
                    className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 border border-rule hover:border-ink-2 text-[11px] text-ink-0 transition"
                  >
                    {isCopiedMain ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                    {isCopiedMain ? "copied" : "copy tweet"}
                  </button>
                </div>

                {/* Reply tweet */}
                <div className="mb-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-1">
                    Reply (post this AS A REPLY to your own tweet)
                  </div>
                  <pre className="text-[12px] text-ink-2 font-sans whitespace-pre-wrap leading-relaxed bg-bg-0 border border-rule p-2">
                    {item.replyText}
                  </pre>
                  <button
                    onClick={() => copy(item.replyText, `${item.slug}-reply`)}
                    className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 border border-rule hover:border-ink-2 text-[11px] text-ink-0 transition"
                  >
                    {isCopiedReply ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                    {isCopiedReply ? "copied" : "copy reply"}
                  </button>
                </div>

                {/* Status controls */}
                <div className="flex gap-2 text-[11px]">
                  <a
                    href="https://x.com/compose/post"
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-rule hover:border-emerald-600 hover:bg-emerald-50 text-ink-0 transition"
                  >
                    open x.com compose ↗
                  </a>
                  {item.status !== "posted" && (
                    <button
                      onClick={() => updateStatus(item.slug, "posted")}
                      className="px-2.5 py-1 border border-rule hover:border-emerald-600 text-emerald-700 transition"
                    >
                      mark posted
                    </button>
                  )}
                  {item.status !== "discarded" && (
                    <button
                      onClick={() => updateStatus(item.slug, "discarded")}
                      className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 border border-rule hover:border-red-600 hover:text-red-800 text-ink-2 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      discard
                    </button>
                  )}
                  {item.status === "discarded" && (
                    <button
                      onClick={() => updateStatus(item.slug, "pending")}
                      className="ml-auto px-2.5 py-1 border border-rule hover:border-emerald-600 text-emerald-700 transition"
                    >
                      restore
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
