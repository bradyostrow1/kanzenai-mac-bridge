"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, FileText, GitCompare, AlertTriangle, RotateCw, Bot, ExternalLink, Play, Settings2 } from "lucide-react";
import { ChatPanel } from "./ChatPanel";

type Stats = {
  articles: {
    count: number;
    totalWords: number;
    list: Array<{
      slug: string;
      title: string;
      category: string;
      publishedAt: string;
      readMinutes: number;
      headerImage?: string;
    }>;
  };
  comparisons: {
    count: number;
    list: Array<{ slug: string; title: string; publishedAt: string }>;
  };
  affiliate: { placeholderLinks: number };
  audit: { when: string | null; size: number; latest: string | null };
  production: { url: string; ok: boolean; ms: number; status: number };
};

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - Date.parse(iso);
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/dashboard/stats", { cache: "no-store" });
      const data = await r.json();
      setStats(data);
      setLastSync(new Date());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30_000);
    return () => clearInterval(t);
  }, [loadStats]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f0eee9] font-sans">
      {/* TOP BAR */}
      <header className="border-b border-[#1f1f1f] sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-10">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="font-semibold tracking-tight text-[15px]">KanzenAI Control</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#525252]">制御室 · localhost</div>
            </div>
            <StatusPill stats={stats} />
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            {lastSync && <span className="text-[#525252]">synced {timeAgo(lastSync.toISOString())}</span>}
            <button
              onClick={loadStats}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#262626] hover:border-[#525252] disabled:opacity-50 transition text-[12px]"
            >
              <RotateCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6">
        {/* TOP METRICS STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard
            icon={<Activity className="w-3.5 h-3.5" />}
            label="Production"
            value={stats?.production.ok ? "Live" : stats ? "Down" : "—"}
            sub={stats ? `${stats.production.ms}ms · ${stats.production.status}` : "checking…"}
            tone={stats?.production.ok ? "ok" : stats ? "err" : "neutral"}
            pulse={stats?.production.ok}
          />
          <MetricCard
            icon={<FileText className="w-3.5 h-3.5" />}
            label="Articles"
            value={stats ? stats.articles.count.toString() : "—"}
            sub={stats ? `${stats.articles.totalWords.toLocaleString()} words` : ""}
          />
          <MetricCard
            icon={<GitCompare className="w-3.5 h-3.5" />}
            label="Comparisons"
            value={stats ? stats.comparisons.count.toString() : "—"}
            sub="head-to-head"
          />
          <MetricCard
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label="Open issues"
            value={stats ? stats.affiliate.placeholderLinks.toString() : "—"}
            sub="placeholder affiliate links"
            tone={stats && stats.affiliate.placeholderLinks > 0 ? "warn" : "neutral"}
          />
        </div>

        {/* MAIN: chat (left) + side rail (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 mb-6">
          {/* CHAT PANEL */}
          <section className="border border-[#1f1f1f] bg-[#0d0d0d] h-[640px] flex flex-col">
            <ChatPanel onActionComplete={loadStats} />
          </section>

          {/* SIDE RAIL */}
          <aside className="space-y-3">
            <Panel
              icon={<Bot className="w-3.5 h-3.5" />}
              title="Bots"
              right={<span className="text-[#525252]">launchd</span>}
            >
              <BotRow
                name="Audit"
                schedule="daily 7 AM"
                active={!!stats?.audit.when}
                detail={stats?.audit.when ? `last: ${timeAgo(stats.audit.when)}` : "not installed"}
              />
              <BotRow name="Article writer" schedule="on-demand" active detail="ready" />
              <BotRow name="Health check" schedule="every 15m" active={false} detail="not installed" />
              <BotRow name="Chat orchestrator" schedule="on-demand" active detail="Kanzen ←" />
            </Panel>

            <Panel
              icon={<Play className="w-3.5 h-3.5" />}
              title="Quick actions"
            >
              <QuickLink href="https://kanzenai.com" target="_blank">
                Open kanzenai.com
              </QuickLink>
              <QuickLink href="https://vercel.com/bradyostrow1s-projects/kanzenai" target="_blank">
                Vercel project
              </QuickLink>
              <QuickLink href="https://search.google.com/search-console" target="_blank">
                Search Console
              </QuickLink>
              <QuickLink href="/articles" target="_blank">
                Browse live articles
              </QuickLink>
            </Panel>

            <Panel
              icon={<Settings2 className="w-3.5 h-3.5" />}
              title="Install daily bots"
              collapsed
            >
              <div className="text-[11px] text-[#a3a3a3] leading-relaxed">
                One-time setup to run audits + health checks 24/7:
              </div>
              <pre className="mt-2 p-2 bg-[#0a0a0a] border border-[#262626] text-[10px] text-[#f0eee9] overflow-x-auto leading-relaxed">
{`cp scripts/com.kanzenai.audit.plist \\
   ~/Library/LaunchAgents/
cp scripts/com.kanzenai.healthcheck.plist \\
   ~/Library/LaunchAgents/
launchctl load -w \\
  ~/Library/LaunchAgents/com.kanzenai.audit.plist
launchctl load -w \\
  ~/Library/LaunchAgents/com.kanzenai.healthcheck.plist`}
              </pre>
            </Panel>
          </aside>
        </div>

        {/* CONTENT GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 border border-[#1f1f1f] bg-[#0d0d0d]">
            <PanelHeader title={`Articles · ${stats?.articles.count ?? "—"}`} />
            <div className="divide-y divide-[#1f1f1f]">
              {stats?.articles.list.slice(0, 8).map((a) => (
                <a
                  key={a.slug}
                  href={`/articles/${a.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 px-4 py-3 hover:bg-[#171717] transition group"
                >
                  {a.headerImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.headerImage} alt="" className="w-10 h-10 object-cover rounded-sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[#f0eee9] truncate text-[13px] group-hover:text-white">
                      {a.title}
                    </div>
                    <div className="text-[10px] text-[#525252] uppercase tracking-wider mt-0.5">
                      {a.category} · {a.readMinutes} min · {a.publishedAt}
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-[#525252] group-hover:text-[#f0eee9]" />
                </a>
              ))}
            </div>
          </div>
          <div className="border border-[#1f1f1f] bg-[#0d0d0d]">
            <PanelHeader title={`Comparisons · ${stats?.comparisons.count ?? "—"}`} />
            <div className="divide-y divide-[#1f1f1f]">
              {stats?.comparisons.list.map((c) => (
                <a
                  key={c.slug}
                  href={`/compare/${c.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="block px-4 py-3 hover:bg-[#171717] transition group"
                >
                  <div className="text-[#f0eee9] text-[13px] group-hover:text-white">{c.title}</div>
                  <div className="text-[10px] text-[#525252] uppercase tracking-wider mt-0.5">
                    {c.publishedAt}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 text-[10px] text-[#3d3d3d] text-center uppercase tracking-[0.2em]">
          Refreshes every 30s · Localhost only · Production returns 404
        </div>
      </main>
    </div>
  );
}

function StatusPill({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[#525252]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#525252]" />
        loading
      </div>
    );
  }
  const ok = stats.production.ok;
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
      <span className="relative flex h-1.5 w-1.5">
        {ok && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      </span>
      <span className={ok ? "text-emerald-300" : "text-red-300"}>
        {ok ? "All systems live" : "Production DOWN"}
      </span>
      <span className="text-[#525252]">·</span>
      <span className="text-[#a3a3a3]">{stats.articles.count} articles</span>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone,
  pulse,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "err" | "neutral";
  pulse?: boolean;
}) {
  const valueColor =
    tone === "ok" ? "text-emerald-300" : tone === "warn" ? "text-amber-300" : tone === "err" ? "text-red-300" : "text-[#f0eee9]";
  return (
    <div className="border border-[#1f1f1f] bg-[#0d0d0d] px-4 py-3 hover:border-[#262626] transition">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#525252]">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
        )}
      </div>
      <div className={`text-2xl font-semibold mt-1 tracking-tight ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-[#525252] mt-0.5">{sub}</div>}
    </div>
  );
}

function Panel({
  icon,
  title,
  right,
  children,
  collapsed,
}: {
  icon?: React.ReactNode;
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <details className="border border-[#1f1f1f] bg-[#0d0d0d]">
        <summary className="px-4 py-2.5 cursor-pointer flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3] hover:text-[#f0eee9]">
          <span className="flex items-center gap-1.5">
            {icon}
            {title}
          </span>
          {right}
        </summary>
        <div className="px-4 pb-4">{children}</div>
      </details>
    );
  }
  return (
    <div className="border border-[#1f1f1f] bg-[#0d0d0d]">
      <PanelHeader icon={icon} title={title} right={right} />
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function PanelHeader({ icon, title, right }: { icon?: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 border-b border-[#1f1f1f] flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3]">
      <span className="flex items-center gap-1.5">
        {icon}
        {title}
      </span>
      {right}
    </div>
  );
}

function BotRow({ name, schedule, active, detail }: { name: string; schedule: string; active: boolean; detail: string }) {
  return (
    <div className="flex items-center gap-2 py-2 border-b border-[#1f1f1f] last:border-b-0">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-[#525252]"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[#f0eee9] text-[12px]">{name}</div>
        <div className="text-[10px] text-[#525252]">{detail}</div>
      </div>
      <div className="text-[10px] text-[#525252]">{schedule}</div>
    </div>
  );
}

function QuickLink({ href, target, children }: { href: string; target?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={target}
      rel="noopener"
      className="flex items-center justify-between py-1.5 text-[12px] text-[#f0eee9] hover:text-white border-b border-[#1f1f1f] last:border-b-0 group"
    >
      <span>{children}</span>
      <ExternalLink className="w-3 h-3 text-[#525252] group-hover:text-[#f0eee9] transition" />
    </a>
  );
}
