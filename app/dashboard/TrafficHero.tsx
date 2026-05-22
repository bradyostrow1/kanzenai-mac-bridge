"use client";

import { useEffect, useState } from "react";
import { Globe, Twitter, Eye, Heart, MessageSquare, GitBranch, ExternalLink } from "lucide-react";

type Resp = {
  web: { today: number; last7Days: number; allTime: number; series: number[]; source: string };
  x: {
    postsToday: number; postsLast7d: number;
    repliesToday: number; repliesLast7d: number;
    threadsLast7d: number;
    impressions: number | null; likes: number | null;
    metricsFetchedAt: string | null;
    lastPostAt: string | null;
    nextEligibleAt: string | null;
    minGapMinutes: number;
  };
  fetchedAt: string;
};

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return n.toLocaleString();
}

function timeAgo(iso: string): string {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

export function TrafficHero() {
  const [data, setData] = useState<Resp | null>(null);

  async function load() {
    try {
      const r = await fetch("/api/dashboard/traffic-hero", { cache: "no-store" });
      setData(await r.json());
    } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
      {/* WEB */}
      <div className="border border-rule bg-bg-1">
        <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
            <Globe className="w-3.5 h-3.5" />
            Web traffic
          </span>
          <a
            href="https://vercel.com/brady-ostrows-projects/kanzenai/analytics"
            target="_blank"
            rel="noopener"
            className="text-[10px] text-ink-3 hover:text-ink-0 uppercase tracking-[0.18em] flex items-center gap-1"
          >
            Vercel detail <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="grid grid-cols-3 divide-x divide-rule">
          <BigTile label="Today" value={fmt(data?.web.today)} />
          <BigTile label="Last 7d" value={fmt(data?.web.last7Days)} />
          <BigTile label="All time" value={fmt(data?.web.allTime)} />
        </div>
        {data && data.web.series.length > 0 && (
          <div className="px-4 py-3 border-t border-rule">
            <div className="text-[9px] uppercase tracking-[0.18em] text-ink-3 mb-1.5">7-day trend</div>
            <Sparkline series={data.web.series.slice().reverse()} />
          </div>
        )}
      </div>

      {/* X */}
      <div className="border border-rule bg-bg-1">
        <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
            <Twitter className="w-3.5 h-3.5" />
            X · @KanzenOfficial
          </span>
          <span className="text-[10px] text-ink-3">
            {data?.x.metricsFetchedAt
              ? `impressions synced ${timeAgo(data.x.metricsFetchedAt)}`
              : "impressions need x-analytics run"}
          </span>
        </div>
        <div className="grid grid-cols-3 divide-x divide-rule">
          <BigTile
            label="Posts today"
            value={fmt(data?.x.postsToday)}
            sub={data && data.x.repliesToday > 0 ? `+${data.x.repliesToday} replies` : undefined}
          />
          <BigTile
            label="Posts 7d"
            value={fmt(data?.x.postsLast7d)}
            sub={
              data && (data.x.threadsLast7d > 0 || data.x.repliesLast7d > 0)
                ? `+${data.x.threadsLast7d} thrd · ${data.x.repliesLast7d} repl`
                : undefined
            }
          />
          <BigTile
            label="Impressions"
            value={fmt(data?.x.impressions)}
            sub={data?.x.likes != null ? `${fmt(data.x.likes)} likes` : undefined}
          />
        </div>
        {/* Pacing gate readout — author_diversity_scorer compliance */}
        {data && data.x.lastPostAt && (
          <NextPostBar
            lastPostAt={data.x.lastPostAt}
            nextEligibleAt={data.x.nextEligibleAt}
            minGapMinutes={data.x.minGapMinutes}
          />
        )}
      </div>
    </section>
  );
}

function NextPostBar({ lastPostAt, nextEligibleAt, minGapMinutes }: { lastPostAt: string; nextEligibleAt: string | null; minGapMinutes: number }) {
  if (!nextEligibleAt) return null;
  const eligibleMs = Date.parse(nextEligibleAt);
  const now = Date.now();
  const ready = now >= eligibleMs;
  const sinceLastMin = Math.max(0, Math.round((now - Date.parse(lastPostAt)) / 60_000));
  const remainingMin = Math.max(0, Math.round((eligibleMs - now) / 60_000));
  const progress = Math.min(1, sinceLastMin / minGapMinutes);
  return (
    <div className="px-4 py-2.5 border-t border-rule">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] mb-1.5">
        <span className="text-ink-3">Author-diversity gate · {minGapMinutes}m</span>
        <span className={ready ? "text-emerald-700" : "text-amber-800"}>
          {ready ? "ready to post" : `${remainingMin}m to go`}
        </span>
      </div>
      <div className="h-1 bg-bg-2 overflow-hidden">
        <div
          className={`h-full transition-all ${ready ? "bg-emerald-600" : "bg-amber-600"}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

function BigTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="px-4 py-4">
      <div className="text-[9px] uppercase tracking-[0.18em] text-ink-3 mb-1">{label}</div>
      <div className="display text-[34px] leading-none text-ink-0 tracking-tight">{value}</div>
      {sub && <div className="text-[10.5px] text-ink-3 mt-1">{sub}</div>}
    </div>
  );
}

function Sparkline({ series }: { series: number[] }) {
  // series: oldest → newest (left to right)
  if (series.length < 2) return <div className="text-[10px] text-ink-3">not enough data</div>;
  const max = Math.max(...series, 1);
  const w = 100;
  const h = 24;
  const step = w / (series.length - 1);
  const pts = series.map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * h).toFixed(2)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="text-ink-1"
        points={pts}
      />
      {series.map((v, i) => (
        <circle
          key={i}
          cx={(i * step).toFixed(2)}
          cy={(h - (v / max) * h).toFixed(2)}
          r="1.5"
          className="fill-ink-0"
        />
      ))}
    </svg>
  );
}
