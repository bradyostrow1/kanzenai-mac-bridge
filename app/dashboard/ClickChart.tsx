"use client";

import { useEffect, useState } from "react";
import { TrendingUp, MousePointerClick } from "lucide-react";

type ClickStats = {
  total: number;
  installed: boolean;
  byVendor: Array<{ slug: string; name: string; clicks: number; uniqueVisitors: number }>;
  byArticle: Array<{ article: string; clicks: number }>;
  timeSeries: Array<{ date: string; clicks: number }>;
};

export function ClickChart() {
  const [data, setData] = useState<ClickStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/clicks")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) {
    return (
      <div className="border border-rule bg-bg-1 mb-6 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
        <span className="flex items-center gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5" />
          Click performance · loading
        </span>
      </div>
    );
  }

  if (data.total === 0) {
    return (
      <section className="border border-rule bg-bg-1 mb-6">
        <div className="px-4 py-2.5 border-b border-rule text-[10px] uppercase tracking-[0.18em] text-ink-2 flex items-center gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5" />
          Click performance
        </div>
        <div className="p-6 text-center text-ink-3 text-[13px]">
          No clicks yet. Once your articles get traffic, you'll see top vendors, top articles, and 14-day trend here.
        </div>
      </section>
    );
  }

  const max = Math.max(1, ...data.timeSeries.map((d) => d.clicks));
  const todayCount = data.timeSeries[data.timeSeries.length - 1]?.clicks ?? 0;
  const yesterdayCount = data.timeSeries[data.timeSeries.length - 2]?.clicks ?? 0;
  const last7 = data.timeSeries.slice(-7).reduce((s, d) => s + d.clicks, 0);
  const prev7 = data.timeSeries.slice(-14, -7).reduce((s, d) => s + d.clicks, 0);
  const trend = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0;

  return (
    <section className="border border-rule bg-bg-1 mb-6">
      <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
          <MousePointerClick className="w-3.5 h-3.5" />
          Click performance
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
          {data.total} all-time clicks
        </span>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-3 divide-x divide-rule border-b border-rule">
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Today</div>
          <div className="text-2xl font-semibold tracking-tight text-ink-0 mt-0.5">{todayCount}</div>
          <div className="text-[10px] text-ink-3 mt-0.5">vs {yesterdayCount} yesterday</div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Last 7 days</div>
          <div className="text-2xl font-semibold tracking-tight text-ink-0 mt-0.5">{last7}</div>
          <div className={`text-[10px] mt-0.5 inline-flex items-center gap-1 ${trend >= 0 ? "text-emerald-800" : "text-red-800"}`}>
            <TrendingUp className={`w-3 h-3 ${trend < 0 ? "rotate-180" : ""}`} />
            {trend >= 0 ? "+" : ""}
            {trend.toFixed(0)}% vs prior week
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3">Top vendor</div>
          <div className="text-[15px] font-semibold tracking-tight text-ink-0 mt-0.5 truncate">
            {data.byVendor[0]?.name ?? "—"}
          </div>
          <div className="text-[10px] text-ink-3 mt-0.5">
            {data.byVendor[0]?.clicks ?? 0} clicks · {data.byVendor[0]?.uniqueVisitors ?? 0} unique
          </div>
        </div>
      </div>

      {/* Time series sparkline */}
      <div className="px-4 py-4 border-b border-rule">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-2">14-day trend</div>
        <div className="flex items-end gap-1 h-20">
          {data.timeSeries.map((d, i) => {
            const h = Math.round((d.clicks / max) * 100);
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.clicks} clicks`}
                className="flex-1 flex flex-col justify-end items-center group cursor-default"
              >
                <div
                  className={`w-full transition-all ${i === data.timeSeries.length - 1 ? "bg-emerald-700" : "bg-[#525252] group-hover:bg-[#a3a3a3]"}`}
                  style={{ height: `${Math.max(2, h)}%` }}
                />
                {i % 2 === 0 && (
                  <div className="text-[9px] text-ink-3 mt-1">
                    {d.date.slice(5)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Two-column: top vendors + top articles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-rule">
        <div className="p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-3">
            Top vendors by clicks
          </div>
          <div className="space-y-1.5">
            {data.byVendor.slice(0, 5).map((v) => {
              const w = Math.round((v.clicks / data.byVendor[0].clicks) * 100);
              return (
                <div key={v.slug} className="text-[12px]">
                  <div className="flex items-baseline justify-between mb-0.5">
                    <span className="text-ink-0 truncate">{v.name}</span>
                    <span className="text-ink-2 tabular-nums">{v.clicks}</span>
                  </div>
                  <div className="h-1.5 bg-bg-2">
                    <div className="h-full bg-emerald-700/70" style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-3">
            Top source articles
          </div>
          <div className="space-y-1.5">
            {data.byArticle.length === 0 ? (
              <div className="text-ink-3 text-[12px]">No article-attributed clicks yet</div>
            ) : (
              data.byArticle.slice(0, 5).map((a) => {
                const w = Math.round((a.clicks / data.byArticle[0].clicks) * 100);
                const slug = a.article.split("/").pop() ?? a.article;
                return (
                  <div key={a.article} className="text-[12px]">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-ink-0 truncate">/{slug}</span>
                      <span className="text-ink-2 tabular-nums">{a.clicks}</span>
                    </div>
                    <div className="h-1.5 bg-bg-2">
                      <div className="h-full bg-amber-700/70" style={{ width: `${w}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
