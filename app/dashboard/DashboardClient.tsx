"use client";

import { useEffect, useState, useCallback } from "react";
import { Activity, FileText, GitCompare, AlertTriangle, RotateCw, Bot, ExternalLink, Play, Settings2, Shield, Edit3, Heart, MessageSquare, ArrowDown, MousePointerClick, User, ChevronDown, ChevronRight, Eye, Repeat2, Send, GitBranch, Mail, Sparkles, Twitter } from "lucide-react";
import { ChatPanel } from "./ChatPanel";
import { OutreachPanel } from "./OutreachPanel";
import { ClickChart } from "./ClickChart";
import { LiveJobPanel } from "./LiveJobPanel";
import { DetailModal } from "./DetailModal";
import { XQueuePanel } from "./XQueuePanel";
import { XReplyQueuePanel } from "./XReplyQueuePanel";
import { XHistoryPanel } from "./XHistoryPanel";
import { XTodayPanel } from "./XTodayPanel";
import { TrafficHero } from "./TrafficHero";

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
    categoryBreakdown: Record<string, number>;
  };
  comparisons: {
    count: number;
    list: Array<{ slug: string; title: string; publishedAt: string }>;
  };
  affiliate: {
    placeholderLinks: number;
    placeholderVendors: Array<{ slug: string; name: string; commission: string }>;
  };
  audit: { when: string | null; size: number; latest: string | null; errors: number; warnings: number };
  health: { installed: boolean; totalChecks: number; uptime: number; avgMs: number; lastCheck: string | null; lastStatus: number | null };
  writer: {
    lastWritten: string | null;
    lastSlug: string | null;
    totalCount: number;
    writtenToday: number;
    writtenThisWeek: number;
    todaySlugs: string[];
  };
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

type DetailKey = "today" | "production" | "articles" | "comparisons" | "issues" | null;

type KeyMetrics = {
  email: { total: number; ok: boolean };
  x: { followers: number; following: number; tweets: number; ok: boolean };
  clicks: { today: number; total: number };
  impressions: { today: number; total: number; bestTweet?: { text: string; impressions: number; tweetId: string } };
  replyQueue: number;
  tweetCount: { today: number; week: number };
};

type ActivityEvent = {
  ts: string;
  kind: "tweet" | "reply" | "thread" | "click" | "subscribe" | "audit" | "deploy";
  text: string;
  href?: string;
  meta?: string;
};

export function DashboardClient() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [detail, setDetail] = useState<DetailKey>(null);
  const [visitors, setVisitors] = useState<{ today: number; total: number } | null>(null);
  const [keyMetrics, setKeyMetrics] = useState<KeyMetrics | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

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

  useEffect(() => {
    async function loadVisitors() {
      try {
        const r = await fetch("/api/dashboard/visitors", { cache: "no-store" });
        if (r.ok) setVisitors(await r.json());
      } catch { /* offline ok */ }
    }
    loadVisitors();
    const t = setInterval(loadVisitors, 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    async function loadKey() {
      try {
        const r = await fetch("/api/dashboard/key-metrics", { cache: "no-store" });
        if (r.ok) setKeyMetrics(await r.json());
      } catch { /* ok */ }
    }
    async function loadActivity() {
      try {
        const r = await fetch("/api/dashboard/activity", { cache: "no-store" });
        if (r.ok) {
          const d = await r.json();
          setActivity(d.items ?? []);
        }
      } catch { /* ok */ }
    }
    loadKey();
    loadActivity();
    const t1 = setInterval(loadKey, 60_000);
    const t2 = setInterval(loadActivity, 30_000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <div className="min-h-screen bg-bg-0 text-ink-0 font-sans">
      {/* MASTHEAD — big wordmark, links to live site */}
      <div className="border-b border-rule bg-bg-0">
        <div className="max-w-[1600px] mx-auto px-8 pt-10 pb-8 flex items-end justify-between gap-6 flex-wrap">
          <div className="flex items-center gap-5">
            {/* Enso mark */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a
              href="https://kanzenai.com"
              target="_blank"
              rel="noopener"
              className="shrink-0 hover:opacity-80 transition"
              title="Open kanzenai.com"
            >
              <img src="/logo-mark.svg" alt="" className="w-16 h-16" />
            </a>
            <div>
              <a
                href="https://kanzenai.com"
                target="_blank"
                rel="noopener"
                className="display block text-[64px] sm:text-[88px] leading-none tracking-tighter text-ink-0 hover:text-ink-1 transition"
              >
                KanzenAI
              </a>
              <div className="mt-2 text-[10px] uppercase tracking-[0.28em] text-ink-2">
                完全 · CONTROL ROOM · LOCALHOST
              </div>
            </div>
          </div>
          <div className="flex items-end gap-4 flex-wrap">
            <StatusPill stats={stats} />
            {lastSync && (
              <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
                synced {timeAgo(lastSync.toISOString())}
              </span>
            )}
            <a
              href="https://x.com/KanzenOfficial"
              target="_blank"
              rel="noopener"
              title="Open @KanzenOfficial on X"
              className="inline-flex items-center justify-center w-9 h-9 bg-ink-0 hover:bg-ink-1 text-bg-0 transition"
            >
              {/* X logo (the real letter-shape, not the bird) */}
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <button
              onClick={loadStats}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rule hover:border-ink-0 hover:bg-bg-1 disabled:opacity-50 transition text-[11px] uppercase tracking-[0.14em] text-ink-0"
            >
              <RotateCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              refresh
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto p-6">
        {/* ALWAYS-ON TRAFFIC STRIP — web (counterapi) + X (logs + analytics) */}
        <TrafficHero />

        {/* HERO METRICS — the 4 numbers that touch revenue */}
        <SectionLabel>Today's signals</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <HeroCard
            icon={<MessageSquare className="w-4 h-4" />}
            label="Email subscribers"
            value={keyMetrics ? keyMetrics.email.total.toLocaleString() : "—"}
            sub="compounding asset"
            tone={keyMetrics && keyMetrics.email.total > 0 ? "ok" : "neutral"}
          />
          <HeroCard
            icon={<User className="w-4 h-4" />}
            label="X followers"
            value={keyMetrics ? keyMetrics.x.followers.toLocaleString() : "—"}
            sub={keyMetrics ? `@KanzenOfficial · ${keyMetrics.x.tweets} tweets` : "loading…"}
            tone={keyMetrics && keyMetrics.x.followers > 0 ? "ok" : "neutral"}
            onClick={() => window.open("https://x.com/KanzenOfficial", "_blank")}
          />
          <HeroCard
            icon={<Activity className="w-4 h-4" />}
            label="Visitors today"
            value={visitors ? visitors.today.toLocaleString() : "—"}
            sub={visitors ? `${visitors.total.toLocaleString()} lifetime` : "loading…"}
            tone={visitors && visitors.today > 0 ? "ok" : "neutral"}
            pulse={visitors ? visitors.today > 0 : false}
          />
          <HeroCard
            icon={<MousePointerClick className="w-4 h-4" />}
            label="Affiliate clicks today"
            value={keyMetrics ? keyMetrics.clicks.today.toLocaleString() : "—"}
            sub={keyMetrics ? `${keyMetrics.clicks.total.toLocaleString()} all-time` : "loading…"}
            tone={keyMetrics && keyMetrics.clicks.today > 0 ? "ok" : "neutral"}
            pulse={keyMetrics ? keyMetrics.clicks.today > 0 : false}
          />
        </div>

        {/* SECONDARY METRICS — operational status */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <MetricCard
            icon={<Edit3 className="w-3.5 h-3.5" />}
            label="Posted today"
            value={stats ? stats.writer.writtenToday.toString() : "—"}
            sub={keyMetrics ? `${keyMetrics.tweetCount.today} tweets · ${keyMetrics.tweetCount.week} this week` : "—"}
            tone={stats && stats.writer.writtenToday > 0 ? "ok" : "neutral"}
            onClick={() => setDetail("today")}
          />
          <MetricCard
            icon={<Eye className="w-3.5 h-3.5" />}
            label="X impressions (24h)"
            value={keyMetrics ? keyMetrics.impressions.today.toLocaleString() : "—"}
            sub={keyMetrics ? `${keyMetrics.impressions.total.toLocaleString()} total · ${keyMetrics.replyQueue} reply drafts` : "—"}
            tone={keyMetrics && keyMetrics.impressions.today > 0 ? "ok" : "neutral"}
          />
          <MetricCard
            icon={<Activity className="w-3.5 h-3.5" />}
            label="Production"
            value={stats?.production.ok ? "Live" : stats ? "Down" : "—"}
            sub={stats ? `${stats.production.ms}ms · HTTP ${stats.production.status}` : "checking…"}
            tone={stats?.production.ok ? "ok" : stats ? "err" : "neutral"}
            pulse={stats?.production.ok}
            onClick={() => setDetail("production")}
          />
          <MetricCard
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            label="Open issues"
            value={stats ? stats.affiliate.placeholderLinks.toString() : "—"}
            sub={stats ? `${stats.articles.count + stats.comparisons.count} articles · ${stats.articles.totalWords.toLocaleString()} words` : ""}
            tone={stats && stats.affiliate.placeholderLinks > 0 ? "warn" : "neutral"}
            onClick={() => setDetail("issues")}
          />
        </div>

        {/* TODAY'S ACTIVITY TIMELINE */}
        <ActivityTimeline events={activity} />

        {/* DETAIL MODAL — switches content by `detail` key */}
        {detail && stats && (
          <DetailModal
            title={DETAIL_TITLES[detail]}
            subtitle={detailSubtitle(detail, stats)}
            onClose={() => setDetail(null)}
          >
            {renderDetail(detail, stats)}
          </DetailModal>
        )}

        {/* OPERATIONS — bot cron status + manual job runner */}
        <SectionLabel>Operations</SectionLabel>
        <BotSystemPanel stats={stats} />
        <LiveJobPanel onJobComplete={loadStats} />

        {/* X COMMAND CENTER */}
        <SectionLabel>X · @KanzenOfficial</SectionLabel>
        <XTodayPanel />
        <XHistoryPanel />
        <XReplyQueuePanel />
        <CollapsibleSection title="X tweet queue (article-driven posts)" defaultOpen={false}>
          <XQueuePanel />
        </CollapsibleSection>

        {/* CHAT */}
        <SectionLabel>Chat with Kanzen</SectionLabel>
        <section className="border border-rule bg-bg-1 h-[640px] flex flex-col mb-6">
          <ChatPanel onActionComplete={loadStats} />
        </section>

        {/* GROWTH — collapsed by default */}
        <SectionLabel>Growth (click for detail)</SectionLabel>
        <CollapsibleSection title="Affiliate click chart" defaultOpen={false}>
          <ClickChart />
        </CollapsibleSection>
        <CollapsibleSection title="Vendor outreach status" defaultOpen={false}>
          <OutreachPanel />
        </CollapsibleSection>

        {/* QUICK LINKS — small footer-style row */}
        <div className="flex flex-wrap gap-2 mt-6 mb-2 text-[11px]">
          <QuickPill href="https://kanzenai.com">Open kanzenai.com ↗</QuickPill>
          <QuickPill href="https://x.com/KanzenOfficial">@KanzenOfficial ↗</QuickPill>
          <QuickPill href="https://vercel.com/bradyostrow1s-projects/kanzenai">Vercel project ↗</QuickPill>
          <QuickPill href="https://vercel.com/bradyostrow1s-projects/kanzenai/analytics">Vercel analytics ↗</QuickPill>
          <QuickPill href="https://search.google.com/search-console">Search Console ↗</QuickPill>
        </div>

        <div className="mt-10 text-[10px] text-ink-3 text-center uppercase tracking-[0.2em]">
          Refreshes every 30s · Localhost only · Production returns 404
        </div>
      </main>
    </div>
  );
}

type ClickStats = {
  total: number;
  installed: boolean;
  byVendor: Array<{ slug: string; name: string; clicks: number; uniqueVisitors: number }>;
};

function BotSystemPanel({ stats }: { stats: Stats | null }) {
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditFlash, setAuditFlash] = useState<string | null>(null);
  const [clicks, setClicks] = useState<ClickStats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/clicks")
      .then((r) => r.json())
      .then(setClicks)
      .catch(() => {});
  }, []);

  async function runAuditNow() {
    setAuditRunning(true);
    setAuditFlash(null);
    try {
      const r = await fetch("/api/dashboard/audit", { method: "POST" });
      const data = await r.json();
      const m = (data.output ?? "").match(/Summary:\s*(\d+)\s+errors?,\s*(\d+)\s+warnings?/i);
      setAuditFlash(m ? `${m[1]} errors, ${m[2]} warnings` : "audit complete");
    } catch (e: any) {
      setAuditFlash(`failed: ${e.message}`);
    } finally {
      setAuditRunning(false);
      setTimeout(() => setAuditFlash(null), 8000);
    }
  }

  const audit = stats?.audit;
  const health = stats?.health;
  const writer = stats?.writer;

  return (
    <section className="border border-rule bg-bg-1 mb-6">
      <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
          <Bot className="w-3.5 h-3.5" />
          Bot System
        </span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
          {[audit?.when, writer?.lastWritten, health?.installed].filter(Boolean).length} of 4 active
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-rule">
        {/* AUDIT BOT */}
        <BotCard
          icon={<Shield className="w-4 h-4" />}
          name="Audit"
          schedule="daily 7 AM · launchd"
          active={!!audit?.when}
          status={audit?.when ? "ready" : "not installed"}
          metric={
            audit?.when ? (
              <div className="flex items-baseline gap-3">
                <span className={`text-2xl font-semibold tracking-tight ${audit.errors > 0 ? "text-red-800" : audit.warnings > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                  {audit.errors}
                </span>
                <span className="text-[11px] text-ink-3">errors</span>
                <span className="text-2xl font-semibold tracking-tight text-amber-800/80">{audit.warnings}</span>
                <span className="text-[11px] text-ink-3">warnings</span>
              </div>
            ) : (
              <div className="text-ink-3 text-[12px]">Run once to see findings</div>
            )
          }
          subtitle={audit?.when ? `last run · ${timeAgo(audit.when)}` : "no runs yet"}
          action={
            <button
              onClick={runAuditNow}
              disabled={auditRunning}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-rule hover:border-ink-2 disabled:opacity-50 transition text-[11px]"
            >
              {auditRunning ? <Loader className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
              {auditRunning ? "running…" : "run now"}
            </button>
          }
          flash={auditFlash}
        />

        {/* ARTICLE WRITER */}
        <BotCard
          icon={<Edit3 className="w-4 h-4" />}
          name="Article writer"
          schedule="on-demand · ~$0.15"
          active
          status="ready"
          metric={
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-ink-0">{writer?.totalCount ?? "—"}</span>
              <span className="text-[11px] text-ink-3">articles total</span>
            </div>
          }
          subtitle={
            writer?.lastWritten
              ? `last · ${timeAgo(writer.lastWritten)} · ${writer.lastSlug?.slice(0, 28) ?? ""}…`
              : "no articles yet"
          }
          action={
            <a
              href="#chat"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector("textarea")?.focus();
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-rule hover:border-ink-2 transition text-[11px]"
            >
              <MessageSquare className="w-3 h-3" />
              tell Kanzen
            </a>
          }
        />

        {/* HEALTH CHECK */}
        <BotCard
          icon={<Heart className="w-4 h-4" />}
          name="Health check"
          schedule="every 15m · launchd"
          active={!!health?.installed && (health?.totalChecks ?? 0) > 0}
          status={health?.installed ? "ready" : "not installed"}
          metric={
            health?.installed && health.totalChecks > 0 ? (
              <div className="flex items-baseline gap-3">
                <span className={`text-2xl font-semibold tracking-tight ${health.uptime >= 99 ? "text-emerald-800" : health.uptime >= 95 ? "text-amber-800" : "text-red-800"}`}>
                  {health.uptime}%
                </span>
                <span className="text-[11px] text-ink-3">uptime</span>
                <span className="text-[12px] text-ink-2">{health.avgMs}ms avg</span>
              </div>
            ) : (
              <div className="text-ink-3 text-[12px]">install plist to start</div>
            )
          }
          subtitle={
            health?.installed
              ? `${health.totalChecks} checks · last ${timeAgo(health.lastCheck)}`
              : "see install panel →"
          }
        />

        {/* CLICK TRACKER */}
        <BotCard
          icon={<MousePointerClick className="w-4 h-4" />}
          name="Click tracker"
          schedule="passive · /go/<vendor>"
          active={(clicks?.total ?? 0) > 0}
          status={clicks ? `${clicks.total} clicks` : "loading"}
          metric={
            clicks && clicks.total > 0 ? (
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-semibold tracking-tight text-ink-0">{clicks.total}</span>
                <span className="text-[11px] text-ink-3">clicks tracked</span>
              </div>
            ) : (
              <div className="text-ink-3 text-[12px]">no clicks yet</div>
            )
          }
          subtitle={
            clicks && clicks.byVendor.length > 0
              ? `top: ${clicks.byVendor[0].name} · ${clicks.byVendor[0].clicks} clicks`
              : "redirects via /go/<slug> route"
          }
        />

        {/* KANZEN ORCHESTRATOR */}
        <BotCard
          icon={<MessageSquare className="w-4 h-4" />}
          name="Kanzen"
          schedule="chat-driven · Sonnet 4.5"
          active
          status="ready"
          metric={
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-semibold tracking-tight text-ink-0">6</span>
              <span className="text-[11px] text-ink-3">tools wired</span>
            </div>
          }
          subtitle="orchestrates the other 3 bots"
          action={
            <a
              href="#chat"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector("textarea")?.focus();
                window.scrollBy({ top: 200, behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-emerald-600 hover:border-emerald-600 text-emerald-800 transition text-[11px]"
            >
              <ArrowDown className="w-3 h-3" />
              chat with Kanzen
            </a>
          }
        />
      </div>
    </section>
  );
}

function BotCard({
  icon,
  name,
  schedule,
  active,
  status,
  metric,
  subtitle,
  action,
  flash,
}: {
  icon: React.ReactNode;
  name: string;
  schedule: string;
  active: boolean;
  status: string;
  metric?: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  flash?: string | null;
}) {
  return (
    <div className="p-4 hover:bg-bg-2 transition flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={active ? "text-ink-0" : "text-ink-3"}>{icon}</span>
          <div>
            <div className="text-ink-0 text-[13px] font-semibold flex items-center gap-1.5">
              {name}
              <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-700" : "bg-[#525252]"}`} />
            </div>
            <div className="text-[10px] text-ink-3 uppercase tracking-wider mt-0.5">{schedule}</div>
          </div>
        </div>
      </div>
      <div className="flex-1">
        {metric && <div className="mb-2">{metric}</div>}
        {subtitle && <div className="text-[11px] text-ink-3">{subtitle}</div>}
      </div>
      {(action || flash) && (
        <div className="mt-3 flex items-center justify-between gap-2">
          {action}
          {flash && (
            <span className="text-[11px] text-emerald-800 animate-pulse">{flash}</span>
          )}
        </div>
      )}
    </div>
  );
}

function Loader({ className }: { className?: string }) {
  return <RotateCw className={className} />;
}

function StatusPill({ stats }: { stats: Stats | null }) {
  if (!stats) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-ink-3">
        <span className="w-1.5 h-1.5 rounded-full bg-[#525252]" />
        loading
      </div>
    );
  }
  const ok = stats.production.ok;
  return (
    <div className="hidden sm:flex items-center gap-1.5 text-[11px]">
      <span className="relative flex h-1.5 w-1.5">
        {ok && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-700 opacity-75 animate-ping" />}
        <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${ok ? "bg-emerald-700" : "bg-red-700"}`} />
      </span>
      <span className={ok ? "text-emerald-800" : "text-red-800"}>
        {ok ? "All systems live" : "Production DOWN"}
      </span>
      <span className="text-ink-3">·</span>
      <span className="text-ink-2">{stats.articles.count} articles</span>
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
  onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "err" | "neutral";
  pulse?: boolean;
  onClick?: () => void;
}) {
  const valueColor =
    tone === "ok" ? "text-emerald-800" : tone === "warn" ? "text-amber-800" : tone === "err" ? "text-red-800" : "text-ink-0";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`text-left w-full border border-rule bg-bg-1 px-4 py-3 transition ${
        onClick ? "hover:border-ink-2 hover:bg-bg-2 cursor-pointer" : "hover:border-rule"
      }`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink-3">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {pulse && (
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-700 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-700" />
          </span>
        )}
      </div>
      <div className={`text-2xl font-semibold mt-1 tracking-tight ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-3 mt-0.5">{sub}</div>}
      {onClick && <div className="text-[9px] text-ink-3 mt-2 uppercase tracking-[0.18em]">click for detail →</div>}
    </Tag>
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
      <details className="border border-rule bg-bg-1">
        <summary className="px-4 py-2.5 cursor-pointer flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink-2 hover:text-ink-0">
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
    <div className="border border-rule bg-bg-1">
      <PanelHeader icon={icon} title={title} right={right} />
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function PanelHeader({ icon, title, right }: { icon?: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink-2">
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
    <div className="flex items-center gap-2 py-2 border-b border-rule last:border-b-0">
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-emerald-700" : "bg-[#525252]"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-ink-0 text-[12px]">{name}</div>
        <div className="text-[10px] text-ink-3">{detail}</div>
      </div>
      <div className="text-[10px] text-ink-3">{schedule}</div>
    </div>
  );
}

function HeroCard({
  icon, label, value, sub, tone, pulse, onClick,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "warn" | "err" | "neutral";
  pulse?: boolean;
  onClick?: () => void;
}) {
  const accent =
    tone === "ok" ? "from-emerald-100 to-transparent border-emerald-300/40" :
    tone === "warn" ? "from-amber-100 to-transparent border-amber-300/40" :
    tone === "err" ? "from-red-100 to-transparent border-red-300/40" :
    "from-bg-1 to-transparent border-rule";
  const valueColor =
    tone === "ok" ? "text-emerald-800" :
    tone === "warn" ? "text-amber-800" :
    tone === "err" ? "text-red-800" :
    "text-ink-0";
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`text-left w-full bg-gradient-to-br ${accent} border bg-bg-1 px-5 py-5 transition ${
        onClick ? "hover:border-ink-2 hover:bg-bg-2 cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-ink-2">
        <span className="flex items-center gap-1.5">
          {icon}
          {label}
        </span>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-700 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-700" />
          </span>
        )}
      </div>
      <div className={`text-[42px] font-semibold mt-2 tracking-tighter leading-none ${valueColor}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-3 mt-2">{sub}</div>}
    </Tag>
  );
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  if (events.length === 0) {
    return (
      <section className="border border-rule bg-bg-1 mb-6 p-5">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3">No activity yet — bots fire at 8 AM</div>
      </section>
    );
  }
  const visible = expanded ? events : events.slice(0, 8);
  return (
    <section className="border border-rule bg-bg-1 mb-6">
      <div className="px-5 py-3 border-b border-rule flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
          <Sparkles className="w-3.5 h-3.5" />
          Live activity
          <span className="ml-2 text-[10px] text-ink-3 normal-case tracking-normal">{events.length} events · refreshes every 30s</span>
        </span>
        {events.length > 8 && (
          <button onClick={() => setExpanded((v) => !v)} className="text-[10px] uppercase tracking-[0.18em] text-ink-3 hover:text-ink-0">
            {expanded ? "show recent" : `show all ${events.length}`}
          </button>
        )}
      </div>
      <ul className="divide-y divide-rule">
        {visible.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="px-5 py-2.5 flex items-center gap-3 text-[12.5px] hover:bg-bg-2 transition">
            <ActivityIcon kind={e.kind} />
            <div className="flex-1 min-w-0">
              <div className="text-ink-0 truncate">{e.text}</div>
              {e.meta && <div className="text-[10px] text-ink-3 uppercase tracking-[0.14em] mt-0.5">{e.meta}</div>}
            </div>
            <span className="text-[10px] text-ink-3 uppercase tracking-[0.12em] tabular-nums">{timeAgo(e.ts)}</span>
            {e.href && (
              <a href={e.href} target="_blank" rel="noopener" className="text-ink-3 hover:text-ink-0">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ActivityIcon({ kind }: { kind: ActivityEvent["kind"] }) {
  const cls = "w-3.5 h-3.5 shrink-0";
  switch (kind) {
    case "tweet":     return <Send className={`${cls} text-emerald-700`} />;
    case "reply":     return <MessageSquare className={`${cls} text-amber-800`} />;
    case "thread":    return <GitBranch className={`${cls} text-emerald-800`} />;
    case "click":     return <MousePointerClick className={`${cls} text-purple-300`} />;
    case "subscribe": return <Mail className={`${cls} text-blue-300`} />;
    case "audit":     return <Shield className={`${cls} text-amber-800`} />;
    case "deploy":    return <Repeat2 className={`${cls} text-emerald-700`} />;
    default:          return <Activity className={cls} />;
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.22em] text-ink-3 mb-2 mt-6 first:mt-0">
      {children}
    </div>
  );
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border border-rule bg-bg-1 hover:bg-bg-2 text-[11px] uppercase tracking-[0.18em] text-ink-2 hover:text-ink-0 transition"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {title}
      </button>
      {open && <div className="mt-0">{children}</div>}
    </div>
  );
}

function QuickPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="px-2.5 py-1 border border-rule hover:border-ink-2 text-ink-2 hover:text-ink-0 transition"
    >
      {children}
    </a>
  );
}

function QuickLink({ href, target, children }: { href: string; target?: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={target}
      rel="noopener"
      className="flex items-center justify-between py-1.5 text-[12px] text-ink-0 hover:text-ink-0 border-b border-rule last:border-b-0 group"
    >
      <span>{children}</span>
      <ExternalLink className="w-3 h-3 text-ink-3 group-hover:text-ink-0 transition" />
    </a>
  );
}

// ─── Detail modal content ──────────────────────────────────────────────────
const DETAIL_TITLES: Record<NonNullable<DetailKey>, string> = {
  today: "Posted today",
  production: "Production health",
  articles: "All articles",
  comparisons: "All comparisons",
  issues: "Open issues",
};

function detailSubtitle(key: NonNullable<DetailKey>, s: Stats): string {
  switch (key) {
    case "today":
      return `${s.writer.writtenToday} article${s.writer.writtenToday === 1 ? "" : "s"} published today · ${s.writer.writtenThisWeek} this week`;
    case "production":
      return `${s.production.url} · ${s.production.ok ? "Live" : "Down"} · ${s.production.status} · ${s.production.ms}ms`;
    case "articles":
      return `${s.articles.count} total · ${s.articles.totalWords.toLocaleString()} words`;
    case "comparisons":
      return `${s.comparisons.count} head-to-head pages`;
    case "issues":
      return `${s.affiliate.placeholderLinks} placeholder links across ${s.affiliate.placeholderVendors.length} vendors`;
  }
}

function renderDetail(key: NonNullable<DetailKey>, s: Stats): React.ReactNode {
  if (key === "today") {
    if (s.writer.writtenToday === 0) {
      return (
        <div className="text-[13px] text-ink-2">
          Nothing posted yet today. The daily bot fires at 8 AM via launchd, or fire it now from the Live job panel.
        </div>
      );
    }
    return (
      <ul className="divide-y divide-rule">
        {s.writer.todaySlugs.map((slug) => {
          const meta = s.articles.list.find((a) => a.slug === slug);
          return (
            <li key={slug}>
              <a
                href={`/articles/${slug}`}
                target="_blank"
                rel="noopener"
                className="flex items-center gap-3 py-2.5 hover:bg-bg-2 px-2 -mx-2 group"
              >
                {meta?.headerImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={meta.headerImage} alt="" className="w-12 h-12 object-cover rounded-sm" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-ink-0 text-[13px] truncate group-hover:text-ink-0">
                    {meta?.title ?? slug}
                  </div>
                  <div className="text-[10px] text-ink-3 uppercase tracking-wider mt-0.5">
                    {meta?.category ?? "—"} · {meta?.readMinutes ?? "—"} min · {meta?.publishedAt ?? "—"}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-ink-3 group-hover:text-ink-0" />
              </a>
            </li>
          );
        })}
      </ul>
    );
  }

  if (key === "production") {
    return (
      <div className="space-y-3 text-[13px]">
        <DetailRow label="URL" value={
          <a href={s.production.url} target="_blank" rel="noopener" className="text-emerald-800 hover:text-emerald-200 underline">
            {s.production.url}
          </a>
        } />
        <DetailRow label="Status" value={s.production.ok ? "Live · HTTP 200" : `Down · HTTP ${s.production.status}`} tone={s.production.ok ? "ok" : "err"} />
        <DetailRow label="Response time" value={`${s.production.ms} ms`} />
        <DetailRow label="Health checks" value={s.health.installed ? `${s.health.totalChecks} total · ${s.health.uptime}% uptime · avg ${s.health.avgMs}ms` : "Not installed"} />
        <DetailRow label="Last check" value={s.health.lastCheck ? `${timeAgo(s.health.lastCheck)} · HTTP ${s.health.lastStatus ?? "—"}` : "never"} />
        <div className="pt-3 border-t border-rule flex gap-2">
          <a
            href="https://vercel.com/bradyostrow1s-projects/kanzenai"
            target="_blank"
            rel="noopener"
            className="text-[11px] px-3 py-1.5 border border-rule hover:border-ink-2 text-ink-0 transition"
          >
            Vercel dashboard ↗
          </a>
          <a
            href={s.production.url}
            target="_blank"
            rel="noopener"
            className="text-[11px] px-3 py-1.5 border border-rule hover:border-ink-2 text-ink-0 transition"
          >
            Open live site ↗
          </a>
        </div>
      </div>
    );
  }

  if (key === "articles") {
    const cats = Object.entries(s.articles.categoryBreakdown).sort((a, b) => b[1] - a[1]);
    return (
      <div className="space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-2">By category</div>
          <div className="flex flex-wrap gap-1.5">
            {cats.map(([cat, n]) => (
              <span key={cat} className="text-[11px] px-2 py-1 border border-rule bg-bg-0 text-ink-0">
                {cat} <span className="text-ink-2 ml-1">· {n}</span>
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-ink-3 mb-2">All articles · newest first</div>
          <ul className="divide-y divide-rule">
            {s.articles.list.map((a) => (
              <li key={a.slug}>
                <a
                  href={`/articles/${a.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="flex items-center gap-3 py-2 hover:bg-bg-2 px-2 -mx-2 group"
                >
                  {a.headerImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.headerImage} alt="" className="w-10 h-10 object-cover rounded-sm" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-ink-0 text-[12px] truncate group-hover:text-ink-0">{a.title}</div>
                    <div className="text-[10px] text-ink-3 uppercase tracking-wider mt-0.5">
                      {a.category} · {a.readMinutes} min · {a.publishedAt}
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-ink-3 group-hover:text-ink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (key === "comparisons") {
    return (
      <ul className="divide-y divide-rule">
        {s.comparisons.list.map((c) => (
          <li key={c.slug}>
            <a
              href={`/compare/${c.slug}`}
              target="_blank"
              rel="noopener"
              className="block py-2.5 hover:bg-bg-2 px-2 -mx-2 group"
            >
              <div className="text-ink-0 text-[13px] group-hover:text-ink-0">{c.title}</div>
              <div className="text-[10px] text-ink-3 uppercase tracking-wider mt-0.5">{c.publishedAt}</div>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (key === "issues") {
    return (
      <div className="space-y-4">
        <div className="text-[13px] text-ink-2 leading-relaxed">
          These vendors have placeholder affiliate URLs. They redirect to vendor sites but don&apos;t track clicks back to a real affiliate code. Cleared one at a time as each vendor approves your partner application.
        </div>
        <ul className="divide-y divide-rule border border-rule">
          {s.affiliate.placeholderVendors.map((v) => (
            <li key={v.slug} className="flex items-center gap-3 px-3 py-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-700 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-ink-0 text-[13px] truncate">{v.name}</div>
                <code className="text-[10px] text-ink-3">{v.slug}</code>
              </div>
              <span className="text-[11px] text-ink-2">{v.commission}</span>
            </li>
          ))}
        </ul>
        <div className="text-[11px] text-ink-3 uppercase tracking-[0.18em]">
          Paste codes into <code className="text-amber-800">affiliate-codes.json</code> then run <code className="text-amber-800">npm run rotate</code>.
        </div>
      </div>
    );
  }

  return null;
}

function DetailRow({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "err" }) {
  const color = tone === "ok" ? "text-emerald-800" : tone === "err" ? "text-red-800" : "text-ink-0";
  return (
    <div className="flex items-baseline gap-3">
      <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3 w-32 shrink-0">{label}</span>
      <span className={`text-[13px] ${color}`}>{value}</span>
    </div>
  );
}
