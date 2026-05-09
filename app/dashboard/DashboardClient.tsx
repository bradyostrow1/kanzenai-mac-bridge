"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

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
  const [auditOutput, setAuditOutput] = useState<string | null>(null);
  const [auditRunning, setAuditRunning] = useState(false);
  const [writeOpen, setWriteOpen] = useState(false);

  const loadStats = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await fetch("/api/dashboard/stats", { cache: "no-store" });
      const data = await r.json();
      setStats(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const t = setInterval(loadStats, 30_000); // auto-refresh every 30s
    return () => clearInterval(t);
  }, [loadStats]);

  async function runAudit() {
    setAuditRunning(true);
    setAuditOutput("Running audit...\n");
    try {
      const r = await fetch("/api/dashboard/audit", { method: "POST" });
      const data = await r.json();
      setAuditOutput(data.output ?? data.stderr ?? "(no output)");
    } catch (e) {
      setAuditOutput(`Error: ${e}`);
    } finally {
      setAuditRunning(false);
      loadStats();
    }
  }

  if (!stats) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-[#f0eee9] p-8 font-mono">
        <div className="text-sm opacity-60">loading...</div>
      </main>
    );
  }

  const prodOk = stats.production.ok;
  const auditWhen = stats.audit.when;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#f0eee9] p-6 sm:p-10 font-mono text-[13px]">
      <div className="max-w-[1400px] mx-auto">
        {/* HEADER */}
        <div className="flex items-baseline justify-between mb-8 border-b border-[#262626] pb-4">
          <div>
            <h1 className="text-3xl tracking-tight font-bold">KanzenAI Control</h1>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] mt-1">
              制御室 · Operations dashboard · localhost only
            </div>
          </div>
          <button
            onClick={loadStats}
            disabled={refreshing}
            className="px-4 py-2 border border-[#262626] hover:border-[#525252] disabled:opacity-50 transition"
          >
            {refreshing ? "refreshing…" : "↻ refresh"}
          </button>
        </div>

        {/* TOP ROW METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card label="Production" value={prodOk ? "● LIVE" : "● DOWN"} subtitle={`${stats.production.ms}ms · ${stats.production.status}`} accent={prodOk ? "ok" : "err"} />
          <Card label="Articles" value={stats.articles.count.toString()} subtitle={`${stats.articles.totalWords.toLocaleString()} words`} />
          <Card label="Comparisons" value={stats.comparisons.count.toString()} subtitle="head-to-head reviews" />
          <Card label="Placeholder links" value={stats.affiliate.placeholderLinks.toString()} subtitle="?ref=kanzenai (need real codes)" accent={stats.affiliate.placeholderLinks > 0 ? "warn" : "ok"} />
        </div>

        {/* AUDIT + BOTS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Panel title="Audit bot" right={<span className="text-[#a3a3a3]">last run · {timeAgo(auditWhen)}</span>}>
            <div className="text-[#a3a3a3] mb-3">
              {auditWhen
                ? `Latest log: ${stats.audit.latest} (${(stats.audit.size / 1024).toFixed(1)}KB)`
                : "No audit runs yet. Click below to run for the first time."}
            </div>
            <div className="flex gap-2">
              <button
                onClick={runAudit}
                disabled={auditRunning}
                className="px-4 py-2 bg-[#f0eee9] text-[#0a0a0a] hover:bg-white disabled:opacity-50 transition font-semibold"
              >
                {auditRunning ? "running…" : "▶ run audit now"}
              </button>
              <button
                onClick={() => setAuditOutput(null)}
                className="px-4 py-2 border border-[#262626] hover:border-[#525252] transition"
                disabled={!auditOutput}
              >
                clear
              </button>
            </div>
            {auditOutput && (
              <pre className="mt-4 p-3 bg-[#171717] border border-[#262626] text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {auditOutput}
              </pre>
            )}
          </Panel>

          <Panel title="Bots & schedules" right={<span className="text-[#a3a3a3]">launchd</span>}>
            <BotRow
              name="Audit bot"
              schedule="daily @ 7:00 AM"
              status={auditWhen ? "active" : "not-installed"}
              detail={auditWhen ? `last: ${timeAgo(auditWhen)}` : "install plist to activate"}
            />
            <BotRow
              name="Article writer"
              schedule="on-demand"
              status="active"
              detail="run from quick actions →"
            />
            <BotRow
              name="Health check"
              schedule="every 15 min"
              status="not-installed"
              detail="install com.kanzenai.healthcheck.plist"
            />
            <div className="mt-4 pt-4 border-t border-[#262626] text-[11px] text-[#a3a3a3] leading-relaxed">
              To install daily auto-runs:
              <br />
              <code className="text-[#f0eee9]">cp scripts/com.kanzenai.audit.plist ~/Library/LaunchAgents/</code>
              <br />
              <code className="text-[#f0eee9]">launchctl load -w ~/Library/LaunchAgents/com.kanzenai.audit.plist</code>
            </div>
          </Panel>
        </div>

        {/* QUICK ACTIONS */}
        <div className="mb-8">
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => setWriteOpen(true)}
                className="p-4 border border-[#262626] hover:border-[#f0eee9] hover:bg-[#171717] text-left transition"
              >
                <div className="text-[#f0eee9] font-semibold mb-1">+ write article</div>
                <div className="text-[11px] text-[#a3a3a3]">via Claude bot · ~$0.15</div>
              </button>
              <a
                href="https://kanzenai.com"
                target="_blank"
                rel="noopener"
                className="p-4 border border-[#262626] hover:border-[#f0eee9] hover:bg-[#171717] transition block"
              >
                <div className="text-[#f0eee9] font-semibold mb-1">↗ open kanzenai.com</div>
                <div className="text-[11px] text-[#a3a3a3]">production site</div>
              </a>
              <a
                href="https://vercel.com/bradyostrow1s-projects/kanzenai"
                target="_blank"
                rel="noopener"
                className="p-4 border border-[#262626] hover:border-[#f0eee9] hover:bg-[#171717] transition block"
              >
                <div className="text-[#f0eee9] font-semibold mb-1">↗ Vercel project</div>
                <div className="text-[11px] text-[#a3a3a3]">deploys, logs, env</div>
              </a>
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noopener"
                className="p-4 border border-[#262626] hover:border-[#f0eee9] hover:bg-[#171717] transition block"
              >
                <div className="text-[#f0eee9] font-semibold mb-1">↗ Search Console</div>
                <div className="text-[11px] text-[#a3a3a3]">indexing, search analytics</div>
              </a>
            </div>
          </Panel>
        </div>

        {/* CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Panel title={`Articles · ${stats.articles.count}`}>
              <div className="divide-y divide-[#262626]">
                {stats.articles.list.map((a) => (
                  <a
                    key={a.slug}
                    href={`/articles/${a.slug}`}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-4 py-3 hover:bg-[#171717] -mx-2 px-2 transition"
                  >
                    {a.headerImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.headerImage} alt="" className="w-12 h-12 object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-[#f0eee9] truncate">{a.title}</div>
                      <div className="text-[11px] text-[#a3a3a3] mt-0.5">
                        {a.category} · {a.readMinutes} min · {a.publishedAt}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Panel>
          </div>

          <Panel title={`Comparisons · ${stats.comparisons.count}`}>
            <div className="divide-y divide-[#262626]">
              {stats.comparisons.list.map((c) => (
                <a
                  key={c.slug}
                  href={`/compare/${c.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="block py-3 hover:bg-[#171717] -mx-2 px-2 transition"
                >
                  <div className="text-[#f0eee9]">{c.title}</div>
                  <div className="text-[11px] text-[#a3a3a3] mt-0.5">{c.publishedAt}</div>
                </a>
              ))}
            </div>
          </Panel>
        </div>

        {writeOpen && <WriteArticleModal onClose={() => setWriteOpen(false)} onComplete={loadStats} />}

        <div className="mt-12 text-[11px] text-[#525252] text-center">
          KanzenAI Control · refreshes every 30s · localhost only · never deploys to production
        </div>
      </div>
    </main>
  );
}

function Card({ label, value, subtitle, accent }: { label: string; value: string; subtitle?: string; accent?: "ok" | "warn" | "err" }) {
  const color = accent === "ok" ? "text-emerald-400" : accent === "warn" ? "text-amber-400" : accent === "err" ? "text-red-400" : "text-[#f0eee9]";
  return (
    <div className="border border-[#262626] p-4">
      <div className="text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3]">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
      {subtitle && <div className="text-[11px] text-[#a3a3a3] mt-1">{subtitle}</div>}
    </div>
  );
}

function Panel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-[#262626]">
      <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] font-semibold">{title}</div>
        {right && <div className="text-[11px]">{right}</div>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function BotRow({ name, schedule, status, detail }: { name: string; schedule: string; status: "active" | "not-installed"; detail: string }) {
  const dot = status === "active" ? "bg-emerald-400" : "bg-[#525252]";
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#262626] last:border-b-0">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[#f0eee9]">{name}</div>
        <div className="text-[11px] text-[#a3a3a3]">{detail}</div>
      </div>
      <div className="text-[11px] text-[#a3a3a3]">{schedule}</div>
    </div>
  );
}

function WriteArticleModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [topic, setTopic] = useState("");
  const [products, setProducts] = useState("");
  const [category, setCategory] = useState("");
  const [slug, setSlug] = useState("");
  const [mode, setMode] = useState<"review" | "compare">("review");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setRunning(true);
    setOutput("Researching products and calling Claude... (~30-60s)\n");
    try {
      const r = await fetch("/api/dashboard/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, products, category, slug: slug || undefined, mode }),
      });
      const data = await r.json();
      setOutput(data.output || data.stderr || "(no output)");
      if (data.exitCode === 0) onComplete();
    } catch (e) {
      setOutput(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-[#0a0a0a] border border-[#262626] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-3 border-b border-[#262626] flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] font-semibold">+ Write article</div>
          <button onClick={onClose} className="text-[#a3a3a3] hover:text-[#f0eee9]">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] block mb-1">Mode</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMode("review")} className={`px-3 py-2 border ${mode === "review" ? "bg-[#f0eee9] text-[#0a0a0a] border-[#f0eee9]" : "border-[#262626]"}`}>round-up review</button>
              <button type="button" onClick={() => setMode("compare")} className={`px-3 py-2 border ${mode === "compare" ? "bg-[#f0eee9] text-[#0a0a0a] border-[#f0eee9]" : "border-[#262626]"}`}>head-to-head</button>
            </div>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] block mb-1">Topic</label>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} required placeholder="e.g. Best CRM for real estate brokerages 2026" className="w-full bg-[#171717] border border-[#262626] focus:border-[#f0eee9] px-3 py-2 outline-none" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] block mb-1">Products (comma-separated)</label>
            <input value={products} onChange={(e) => setProducts(e.target.value)} required placeholder="e.g. Follow Up Boss, Lofty, kvCORE" className="w-full bg-[#171717] border border-[#262626] focus:border-[#f0eee9] px-3 py-2 outline-none" />
          </div>
          {mode === "review" && (
            <div>
              <label className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] block mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-[#171717] border border-[#262626] focus:border-[#f0eee9] px-3 py-2 outline-none">
                <option value="">(no category)</option>
                <option value="CRM">CRM</option>
                <option value="Lead Gen">Lead Gen</option>
                <option value="AI Tools">AI Tools</option>
                <option value="Marketing">Marketing</option>
                <option value="Phone & Calls">Phone & Calls</option>
                <option value="Scheduling">Scheduling</option>
                <option value="Invoicing">Invoicing</option>
                <option value="Inventory">Inventory</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3] block mb-1">Slug (optional)</label>
            <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated from topic" className="w-full bg-[#171717] border border-[#262626] focus:border-[#f0eee9] px-3 py-2 outline-none" />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={running} className="px-4 py-2 bg-[#f0eee9] text-[#0a0a0a] hover:bg-white disabled:opacity-50 font-semibold">
              {running ? "writing… (~30-60s)" : "▶ write"}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 border border-[#262626] hover:border-[#525252]">cancel</button>
          </div>
          {output && (
            <pre className="p-3 bg-[#171717] border border-[#262626] text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto">
              {output}
            </pre>
          )}
        </form>
      </div>
    </div>
  );
}
