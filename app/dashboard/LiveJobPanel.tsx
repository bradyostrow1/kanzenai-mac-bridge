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
    <section className="border border-rule bg-bg-1 mb-6">
      <div className="px-4 py-2.5 border-b border-rule flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-2">
          <Radio className="w-3.5 h-3.5" />
          Live job
        </span>
        {job && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-ink-3">
            {job.type} · {job.status} · {elapsed}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-rule">
        {ACTIONS.map((a) => {
          const isStarting = starting === a.type;
          const isRunning = running && job?.type === a.type;
          return (
            <button
              key={a.type}
              onClick={() => start(a.type)}
              disabled={isStarting || running}
              className="text-left p-4 hover:bg-bg-2 disabled:opacity-50 disabled:cursor-not-allowed transition group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-ink-0 text-[13px] font-medium">{a.label}</span>
                {isRunning ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                ) : isStarting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-ink-2" />
                ) : (
                  <Play className="w-3 h-3 text-ink-3 group-hover:text-ink-2" />
                )}
              </div>
              <div className="text-[11px] text-ink-2 leading-snug mb-1">{a.hint}</div>
              <div className="text-[10px] uppercase tracking-[0.12em] text-ink-3">{a.estimate}</div>
            </button>
          );
        })}
      </div>

      {/* Daily article count selector */}
      <div className="px-4 py-2 border-t border-rule flex items-center gap-3 text-[11px]">
        <span className="text-ink-3">daily articles count:</span>
        {[1, 3, 5, 10].map((n) => (
          <button
            key={n}
            onClick={() => setCount(n)}
            disabled={running}
            className={`px-2 py-0.5 border transition ${
              count === n
                ? "border-emerald-600 bg-emerald-100 text-emerald-800"
                : "border-rule text-ink-2 hover:border-ink-2"
            } disabled:opacity-40`}
          >
            {n}
          </button>
        ))}
        <span className="text-ink-3 ml-auto">{count === 1 ? "$0.15" : `~$${(count * 0.15).toFixed(2)}`} est.</span>
      </div>

      {error && (
        <div className="px-4 py-2 border-t border-red-300/40 bg-red-50 text-red-800 text-[12px]">{error}</div>
      )}

      {/* Live progress view */}
      {job && (
        <div className="border-t border-rule">
          {/* Progress bar for daily-articles */}
          {job.type === "daily-articles" && job.progress.totalArticles && (
            <div className="px-4 py-3 border-b border-rule">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[11px] uppercase tracking-[0.18em] text-ink-2">
                  {job.progress.written + job.progress.failed} of {job.progress.totalArticles} complete
                </div>
                <div className="text-[10px] text-ink-3">{progressPct}%</div>
              </div>
              <div className="h-1.5 bg-bg-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-700 ${
                    job.status === "failed" ? "bg-red-500" : job.status === "done" ? "bg-emerald-500" : "bg-emerald-700"
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
                      ? "border-emerald-600/60 bg-emerald-50"
                      : t.status === "done"
                        ? "border-rule bg-bg-2"
                        : t.status === "failed"
                          ? "border-red-300/50 bg-red-50"
                          : "border-rule bg-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-ink-3 font-mono w-6">#{t.index}</span>
                    {t.status === "running" && <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />}
                    {t.status === "done" && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
                    {t.status === "failed" && <XCircle className="w-3 h-3 text-red-700" />}
                    {t.status === "pending" && <div className="w-3 h-3 border border-rule rounded-full" />}
                    <span
                      className={`flex-1 ${
                        t.status === "pending" ? "text-ink-3" : "text-ink-0"
                      } leading-tight`}
                    >
                      {t.topic ?? <span className="italic text-ink-3">awaiting topic from Claude…</span>}
                    </span>
                  </div>
                  {t.products && (
                    <div className="text-[10px] text-ink-2 mt-1 ml-8 truncate">{t.products}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Current step ticker */}
          {running && (
            <div className="px-4 py-2 border-t border-rule flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
              <span className="text-[12px] text-ink-2 font-mono truncate">{job.progress.currentStep}</span>
              <button
                onClick={stop}
                className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 border border-rule hover:border-red-600 text-[10px] text-ink-2 hover:text-red-800 transition"
              >
                <Square className="w-2.5 h-2.5" />
                stop
              </button>
            </div>
          )}

          {/* Raw log toggle */}
          <div className="border-t border-rule">
            <button
              onClick={() => setShowRawLog((v) => !v)}
              className="w-full px-4 py-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-3 hover:text-ink-2 hover:bg-bg-2 transition"
            >
              {showRawLog ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              raw log ({job.log.length.toLocaleString()} bytes)
            </button>
            {showRawLog && (
              <pre
                ref={logRef}
                className="px-4 pb-3 text-[11px] text-ink-2 font-mono whitespace-pre-wrap overflow-y-auto max-h-[400px] bg-[#070707]"
              >
                {job.log || <span className="text-ink-3 italic">waiting for output…</span>}
              </pre>
            )}
          </div>

          {/* Final state */}
          {!running && job.status !== "running" && (
            <div
              className={`px-4 py-2 border-t text-[12px] flex items-center gap-2 ${
                job.status === "done"
                  ? "border-emerald-300/40 bg-emerald-50 text-emerald-800"
                  : "border-red-300/40 bg-red-50 text-red-800"
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
                <span className="ml-auto text-[11px] text-ink-2">
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
