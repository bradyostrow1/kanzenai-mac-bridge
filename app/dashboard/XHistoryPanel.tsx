"use client";

import { useEffect, useState } from "react";
import { Twitter, ExternalLink, RefreshCw, Eye, Heart, MessageCircle, Repeat2, MousePointerClick, User, Sparkles, Loader2 } from "lucide-react";

type Metric = {
  tweetId: string;
  text: string;
  postedAt: string;
  kind: "auto-post" | "reply" | "manual";
  slug?: string;
  targetUser?: string;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  impressions: number | null;
  profileClicks: number | null;
  urlClicks: number | null;
  fetchedAt: string;
};

type Totals = {
  impressions: number;
  likes: number;
  replies: number;
  retweets: number;
  urlClicks: number;
  profileClicks: number;
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

export function XHistoryPanel() {
  const [items, setItems] = useState<Metric[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insights, setInsights] = useState<string | null>(null);
  const [insightsAt, setInsightsAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"recent" | "impressions" | "likes" | "clicks">("recent");

  async function load() {
    try {
      const r = await fetch("/api/dashboard/x-history", { cache: "no-store" });
      const data = await r.json();
      setItems(data.items ?? []);
      setTotals(data.totals);
      setFetchedAt(data.fetchedAt);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, []);

  async function refreshMetrics() {
    setRefreshing(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "x-analytics" }),
      });
      if (!r.ok) {
        const data = await r.json();
        setError(data.error ?? `HTTP ${r.status}`);
      }
      // Poll the job briefly
      await new Promise((res) => setTimeout(res, 3000));
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  async function runInsights() {
    setInsightsLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/dashboard/x-insights", { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) setError(data.error ?? `HTTP ${r.status}`);
      else { setInsights(data.report); setInsightsAt(data.generatedAt); }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInsightsLoading(false);
    }
  }

  const sorted = [...items].sort((a, b) => {
    if (sort === "impressions") return (b.impressions ?? 0) - (a.impressions ?? 0);
    if (sort === "likes") return b.likes - a.likes;
    if (sort === "clicks") return (b.urlClicks ?? 0) - (a.urlClicks ?? 0);
    return Date.parse(b.postedAt) - Date.parse(a.postedAt);
  });

  return (
    <section className="border border-rule bg-bg-1 mb-6">
      <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
          <Twitter className="w-3.5 h-3.5" />
          X history & analytics
          {items.length > 0 && (
            <span className="ml-2 text-[10px] text-ink-3">{items.length} tweets · synced {fetchedAt ? timeAgo(fetchedAt) : "never"}</span>
          )}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-ink-3">
          <button
            onClick={runInsights}
            disabled={insightsLoading || items.length === 0}
            className="hover:text-ink-0 transition flex items-center gap-1 uppercase tracking-[0.18em] disabled:opacity-50"
          >
            {insightsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            run analyst
          </button>
          <button
            onClick={refreshMetrics}
            disabled={refreshing}
            className="hover:text-ink-0 transition flex items-center gap-1 disabled:opacity-50"
          >
            {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            fetch fresh
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 border-b border-red-300/40 bg-red-50 text-red-800 text-[12px]">{error}</div>
      )}

      {/* Totals strip */}
      {totals && (
        <div className="grid grid-cols-3 lg:grid-cols-6 divide-y lg:divide-y-0 lg:divide-x divide-rule border-b border-rule">
          <Tot icon={<Eye className="w-3 h-3" />} label="impressions" value={totals.impressions} />
          <Tot icon={<Heart className="w-3 h-3" />} label="likes" value={totals.likes} />
          <Tot icon={<MessageCircle className="w-3 h-3" />} label="replies" value={totals.replies} />
          <Tot icon={<Repeat2 className="w-3 h-3" />} label="retweets" value={totals.retweets} />
          <Tot icon={<MousePointerClick className="w-3 h-3" />} label="url clicks" value={totals.urlClicks} />
          <Tot icon={<User className="w-3 h-3" />} label="profile clicks" value={totals.profileClicks} />
        </div>
      )}

      {/* Insights */}
      {insights && (
        <div className="px-4 py-4 border-b border-rule bg-bg-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.18em] text-amber-800">Claude analyst report</span>
            {insightsAt && <span className="text-[10px] text-ink-3">{timeAgo(insightsAt)}</span>}
          </div>
          <div className="text-[12.5px] text-ink-0 leading-relaxed">
            <MarkdownLite text={insights} />
          </div>
        </div>
      )}

      {/* Sort tabs */}
      {items.length > 0 && (
        <div className="px-4 py-2 border-b border-rule flex items-center gap-2 text-[10px]">
          <span className="text-ink-3 uppercase tracking-[0.18em] mr-2">sort:</span>
          {(["recent", "impressions", "likes", "clicks"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2 py-0.5 transition ${sort === s ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "text-ink-2 hover:text-ink-0 border border-transparent"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Tweet rows */}
      {loading ? (
        <div className="p-6 text-[12px] text-ink-3">loading…</div>
      ) : items.length === 0 ? (
        <div className="p-6 text-[12px] text-ink-3">
          No tweets yet. Posts auto-appear after the daily-article job runs (8 AM) or you post manually.
        </div>
      ) : (
        <div className="divide-y divide-rule">
          {sorted.map((m) => (
            <div key={m.tweetId} className="px-4 py-3 hover:bg-bg-2 transition">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-ink-3 mb-1">
                    <span className={m.kind === "auto-post" ? "text-emerald-700" : m.kind === "reply" ? "text-amber-800" : "text-ink-2"}>
                      {m.kind}{m.targetUser ? ` → @${m.targetUser}` : ""}
                    </span>
                    <span>·</span>
                    <span>{timeAgo(m.postedAt)}</span>
                    <a
                      href={`https://x.com/i/web/status/${m.tweetId}`}
                      target="_blank"
                      rel="noopener"
                      className="ml-auto flex items-center gap-1 hover:text-ink-0 normal-case tracking-normal"
                    >
                      view <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-[12.5px] text-ink-0 leading-relaxed whitespace-pre-wrap line-clamp-3">{m.text || "(no text)"}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] text-ink-2">
                <Stat icon={<Eye className="w-3 h-3" />} value={m.impressions ?? "—"} />
                <Stat icon={<Heart className="w-3 h-3" />} value={m.likes} />
                <Stat icon={<MessageCircle className="w-3 h-3" />} value={m.replies} />
                <Stat icon={<Repeat2 className="w-3 h-3" />} value={m.retweets} />
                <Stat icon={<MousePointerClick className="w-3 h-3" />} value={m.urlClicks ?? "—"} />
                <Stat icon={<User className="w-3 h-3" />} value={m.profileClicks ?? "—"} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Tot({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="px-4 py-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.18em] text-ink-3">
        {icon}
        {label}
      </div>
      <div className="text-[18px] font-semibold text-ink-0 mt-0.5 tracking-tight">{value.toLocaleString()}</div>
    </div>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number | string }) {
  return (
    <span className="flex items-center gap-1">
      {icon}
      {typeof value === "number" ? value.toLocaleString() : value}
    </span>
  );
}

function MarkdownLite({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("## ")) return (
          <div key={i} className="text-[11px] uppercase tracking-[0.18em] text-amber-800 mt-3 mb-1 first:mt-0">{trimmed.slice(3)}</div>
        );
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) return (
          <div key={i} className="ml-3"><span className="text-ink-3 mr-2">•</span>{trimmed.slice(2)}</div>
        );
        if (trimmed === "") return <div key={i} className="h-1.5" />;
        return <div key={i}>{trimmed}</div>;
      })}
    </>
  );
}
