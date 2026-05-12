"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Loader2, CheckCircle2, XCircle, Radio, ChevronDown, ChevronRight } from "lucide-react";

type JobType = "daily-articles" | "audit" | "followups" | "deploy" | "x-analytics" | "x-monitor";
type JobStatus = "running" | "done" | "failed" | "killed";

type Topic = {
  index: number;
  topic?: string;
  products?: string;
  status: "pending" | "running" | "done" | "failed";
};

type JobDetail = {
  id: string;
  type: JobType;
  status: JobStatus;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  durationMs: number;
  log: string;
  progress: {
    currentArticle: number | null;
    totalArticles: number | null;
    currentStep: string;
    topics: Topic[];
    written: number;
    failed: number;
  };
};

const ACTIONS: Array<{ type: JobType; label: string; hint: string; estimate: string }> = [
  { type: "daily-articles", label: "Daily articles", hint: "Auto-write 3 articles + auto-tweet each", estimate: "~3-5 min" },
  { type: "audit", label: "Audit", hint: "11 site checks: content + production", estimate: "~10s" },
  { type: "followups", label: "Vendor follow-ups", hint: "Chase outreach emails >= 7 days old", estimate: "~5s" },
  { type: "deploy", label: "Deploy", hint: "Push current state live to kanzenai.com", estimate: "~45s" },
  { type: "x-monitor", label: "X reply monitor", hint: "Poll target accounts, draft replies to queue", estimate: "~30s" },
  { type: "x-analytics", label: "X analytics", hint: "Refresh impressions/likes/clicks for all tweets", estimate: "~5s" },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}

export function LiveJobPanel({ onJobComplete }: { onJobComplete?: () => void }) {
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [starting, setStarting] = useState<JobType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawLog, setShowRawLog] = useState(false);
  const [count, setCount] = useState(3);
  const logRef = useRef<HTMLPreElement>(null);
  const completedRef = useRef<Set<string>>(new Set());

  // Resume any running job after refresh
  useEffect(() => {
    fetch("/api/dashboard/jobs")
      .then((r) => r.json())
      .then((data) => {
        const running = (data.jobs ?? []).find((j: { status: string }) => j.status === "running");
        if (running) setActiveJobId(running.id);
      })
      .catch(() => {});
  }, []);

  // Poll active job
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    let pollCount = 0;

    async function tick() {
      try {
        const r = await fetch(`/api/dashboard/jobs/${activeJobId}`, { cache: "no-store" });
        if (!r.ok) return;
        const data: JobDetail = await r.json();
        if (cancelled) return;
        setJob(data);
        if (data.status !== "running") {
          // Fire onJobComplete once per job finish
          if (!completedRef.current.has(data.id)) {
            completedRef.current.add(data.id);
            onJobComplete?.();
          }
          return;
        }
      } catch {}
      pollCount++;
      // Faster polling early, slower as job runs
      const delay = pollCount < 10 ? 800 : pollCount < 30 ? 1500 : 2500;
      if (!cancelled) setTimeout(tick, delay);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [activeJobId, onJobComplete]);

  // Auto-scroll raw log
  useEffect(() => {
    if (showRawLog && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [job?.log, showRawLog]);

  const start = useCallback(
    async (type: JobType) => {
      setStarting(type);
      setError(null);
      try {
        const body: { type: JobType; count?: number } = { type };
        if (type === "daily-articles") body.count = count;
        const r = await fetch("/api/dashboard/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await r.json();
        if (!r.ok) {
          setError(data.error ?? `HTTP ${r.status}`);
          if (data.jobId) setActiveJobId(data.jobId);
          return;
        }
        setActiveJobId(data.jobId);
        setJob(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setStarting(null);
      }
    },
    [count],
  );

  const stop = useCallback(async () => {
    if (!activeJobId) return;
    await fetch(`/api/dashboard/jobs/${activeJobId}`, { method: "DELETE" });
  }, [activeJobId]);

  const running = job?.status === "running";
  const elapsed = job ? formatDuration(job.durationMs) : "";

  const progressPct = useMemo(() => {
    if (!job?.progress.totalArticles || job.progress.totalArticles === 0) return 0;
    const done = job.progress.written + job.progress.failed;
    const inProgressFraction = job.progress.topics.find((t) => t.status === "running") ? 0.5 : 0;
    return Math.round(((done + inProgressFraction) / job.progress.totalArticles) * 100);
  }, [job]);

  return (
    <section className="border border-[#1f1f1f] bg-[#0d0d0d] mb-6">
      <div className="px-4 py-2.5 border-b border-[#1f1f1f] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#a3a3a3]">
          <Radio className="w-3.5 h-3.5" />
          Live job
        </span>
        {job && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-[#525252]">
            {job.type} · {job.status} · {elapsed}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#1f1f1f]">
        {ACTIONS.map((a) => {
          const isStarting = starting === a.type;
          const isRunning = running && job?.type === a.type;
          return (
            <button
              key={a.type}
              onClick={() => start(a.type)}
              disabled={isStarting || running}
              className="text-left p-4 hover:bg-[#0f0f0f] disabled:opacity-50 disabled:cursor-not-allowed transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[#f0eee9] text-[13px] font-medium">{a.label}</span>
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : isStarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#a3a3a3]" />
                ) : (
                  <Play className="w-3 h-3 text-[#525252] group-hover:text-[#a3a3a3]" />
                )}
              </div>
              <div className="text-[11px] text-[#a3a3a3] leading-snug mb-1">{a.hint}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#525252]">{a.estimate}</div>
            </button>
          );
        })}
      </div>

      {/* Daily article count selector */}
      <div className="px-4 py-2 border-t border-[#1f1f1f] flex items-center gap-3 text-[11px]">
        <span className="text-[#525252]">daily articles count:</span>
        {[1, 3, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            disabled={running}
            className={`px-2 py-0.5 border transition ${
              count === n
                ? "border-emerald-700 bg-emerald-950 text-emerald-300"
                : "border-[#262626] text-[#a3a3a3] hover:border-[#525252]"
            } disabled:opacity-40`}
          >
            {n}
          </button>
        ))}
        <span className="text-[#525252] ml-auto">{count === 1 ? "$0.15" : `~$${(count * 0.15).toFixed(2)}`} est.</span>
      </div>

      {error && (
        <div className="px-4 py-2 border-t border-red-900/40 bg-red-950/20 text-red-300 text-[12px]">{error}</div>
      )}

      {/* Live progress view */}
      {job && (
        <div className="border-t border-[#1f1f1f]">
          {/* Progress bar for daily-articles */}
          {job.type === "daily-articles" && job.progress.totalArticles && (
            <div className="px-4 py-3 border-b border-[#1f1f1f]">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-[#a3a3a3]">
                  {job.progress.written + job.progress.failed} of {job.progress.totalArticles} complete
                </div>
                <div className="text-[10px] text-[#525252]">{progressPct}%</div>
              </div>
              <div className="h-1.5 bg-[#171717] overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    job.status === "failed" ? "bg-red-500" : job.status === "done" ? "bg-emerald-500" : "bg-emerald-600"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Per-article cards */}
          {job.type === "daily-articles" && job.progress.topics.length > 0 && (
            <div className="px-4 py-3 space-y-2">
              {job.progress.topics.map((t) => (
                <div
                  key={t.index}
                  className={`border px-3 py-2 ${
                    t.status === "running"
                      ? "border-emerald-700/60 bg-emerald-950/20"
                      : t.status === "done"
                        ? "border-[#262626] bg-[#0f0f0f]"
                        : t.status === "failed"
                          ? "border-red-900/50 bg-red-950/20"
                          : "border-[#1f1f1f] bg-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-[#525252] font-mono w-6">#{t.index}</span>
                    {t.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />}
                    {t.status === "done" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {t.status === "failed" && <XCircle className="w-3 h-3 text-red-400" />}
                    {t.status === "pending" && <div className="w-3 h-3 border border-[#262626] rounded-full" />}
                    <span
                      className={`flex-1 ${
                        t.status === "pending" ? "text-[#525252]" : "text-[#f0eee9]"
                      } leading-tight`}
                    >
                      {t.topic ?? <span className="italic text-[#525252]">awaiting topic from Claude…</span>}
                    </span>
                  </div>
                  {t.products && (
                    <div className="text-[10px] text-[#a3a3a3] mt-1 ml-8 truncate">{t.products}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Current step ticker */}
          {running && (
            <div className="px-4 py-2 border-t border-[#1f1f1f] flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
              <span className="text-[12px] text-[#a3a3a3] font-mono truncate">{job.progress.currentStep}</span>
              <button
                onClick={stop}
                className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 border border-[#262626] hover:border-red-700 text-[10px] text-[#a3a3a3] hover:text-red-300 transition"
              >
                <Square className="w-2.5 h-2.5" />
                stop
              </button>
            </div>
          )}

          {/* Raw log toggle */}
          <div className="border-t border-[#1f1f1f]">
            <button
              onClick={() => setShowRawLog((v) => !v)}
              className="w-full px-4 py-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-[#525252] hover:text-[#a3a3a3] hover:bg-[#0f0f0f] transition"
            >
              {showRawLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              raw log ({job.log.length.toLocaleString()} bytes)
            </button>
            {showRawLog && (
              <pre
                ref={logRef}
                className="px-4 pb-3 text-[11px] text-[#a3a3a3] font-mono whitespace-pre-wrap overflow-y-auto max-h-[400px] bg-[#070707]"
              >
                {job.log || <span className="text-[#525252] italic">waiting for output…</span>}
              </pre>
            )}
          </div>

          {/* Final state */}
          {!running && job.status !== "running" && (
            <div
              className={`px-4 py-2 border-t text-[12px] flex items-center gap-2 ${
                job.status === "done"
                  ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-300"
                  : "border-red-900/40 bg-red-950/20 text-red-300"
              }`}
            >
              {job.status === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              <span>
                {job.status === "done"
                  ? `Done in ${elapsed}.`
                  : `${job.status === "killed" ? "Killed" : "Failed"} after ${elapsed} (exit ${job.exitCode ?? "—"}).`}
              </span>
              {job.type === "daily-articles" && (
                <span className="ml-auto text-[11px] text-[#a3a3a3]">
                  {job.progress.written} written · {job.progress.failed} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
