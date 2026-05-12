import { NextResponse } from "next/server";

type JobStatus = "running" | "done" | "failed" | "killed";
type JobType = "daily-articles" | "audit" | "followups" | "deploy";

type Job = {
  id: string;
  type: JobType;
  cmd: string;
  args: string[];
  status: JobStatus;
  startedAt: number;
  endedAt: number | null;
  exitCode: number | null;
  log: string;
  proc: import("node:child_process").ChildProcess | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __kanzenaiJobs: Map<string, Job> | undefined;
}
const JOBS: Map<string, Job> = (globalThis.__kanzenaiJobs ??= new Map());

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

// Parse progress markers from log to derive a structured view
function parseProgress(log: string): {
  currentArticle: number | null;
  totalArticles: number | null;
  currentStep: string;
  topics: Array<{ index: number; topic?: string; products?: string; status: "pending" | "running" | "done" | "failed" }>;
  written: number;
  failed: number;
} {
  // Header: "Target: 3 articles"
  const targetMatch = log.match(/Target:\s*(\d+)\s+article/);
  const totalArticles = targetMatch ? Number(targetMatch[1]) : null;

  // Article boundaries: "Article N of M"
  const articleMarkers = [...log.matchAll(/Article\s+(\d+)\s+of\s+(\d+)/g)];
  const currentArticle = articleMarkers.length > 0 ? Number(articleMarkers[articleMarkers.length - 1][1]) : null;

  // Topic/products per article — captured between consecutive "Article N of M" headers
  const topics: Array<{ index: number; topic?: string; products?: string; status: "pending" | "running" | "done" | "failed" }> = [];
  if (totalArticles) {
    for (let i = 1; i <= totalArticles; i++) {
      const startRe = new RegExp(`Article\\s+${i}\\s+of\\s+${totalArticles}`);
      const startMatch = log.match(startRe);
      if (!startMatch) {
        topics.push({ index: i, status: "pending" });
        continue;
      }
      const startIdx = startMatch.index! + startMatch[0].length;
      const nextRe = new RegExp(`Article\\s+${i + 1}\\s+of\\s+${totalArticles}`);
      const nextMatch = log.slice(startIdx).match(nextRe);
      const slice = nextMatch ? log.slice(startIdx, startIdx + nextMatch.index!) : log.slice(startIdx);

      const topicMatch = slice.match(/Topic:\s*(.+)/);
      const productsMatch = slice.match(/Products:\s*(.+)/);
      const wroteMatch = slice.match(/Wrote\s+.+\/[\w-]+\.json/);
      const failedMatch = slice.match(/Article\s+\d+\s+failed/);

      let status: "pending" | "running" | "done" | "failed" = "running";
      if (wroteMatch) status = "done";
      else if (failedMatch) status = "failed";
      else if (!nextMatch && i < totalArticles) status = "running";
      else if (nextMatch) status = "running"; // shouldn't happen, but safe

      topics.push({
        index: i,
        topic: topicMatch?.[1]?.trim().slice(0, 120),
        products: productsMatch?.[1]?.trim().slice(0, 120),
        status,
      });
    }
  }

  // Latest step text — last meaningful "→" line
  const stepLines = log.split("\n").filter((l) => l.includes("→") || l.startsWith("✓") || l.startsWith("✗"));
  const currentStep = stepLines.length > 0 ? stepLines[stepLines.length - 1].trim() : "starting…";

  // Final summary
  const summary = log.match(/(\d+)\s+written\s*·\s*(\d+)\s+failed/);
  const written = summary ? Number(summary[1]) : topics.filter((t) => t.status === "done").length;
  const failed = summary ? Number(summary[2]) : topics.filter((t) => t.status === "failed").length;

  return { currentArticle, totalArticles, currentStep, topics, written, failed };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = devGuard();
  if (guard) return guard;
  const job = JOBS.get(params.id);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });

  const tailBytes = 30_000;
  const log = job.log.length > tailBytes ? job.log.slice(-tailBytes) : job.log;

  return NextResponse.json({
    id: job.id,
    type: job.type,
    status: job.status,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    exitCode: job.exitCode,
    durationMs: (job.endedAt ?? Date.now()) - job.startedAt,
    log,
    progress: parseProgress(job.log),
  });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = devGuard();
  if (guard) return guard;
  const job = JOBS.get(params.id);
  if (!job) return NextResponse.json({ error: "job not found" }, { status: 404 });
  if (job.proc && job.status === "running") {
    job.proc.kill("SIGTERM");
    setTimeout(() => job.proc?.kill("SIGKILL"), 3_000);
    job.status = "killed";
    job.endedAt = Date.now();
  }
  return NextResponse.json({ ok: true, status: job.status });
}
