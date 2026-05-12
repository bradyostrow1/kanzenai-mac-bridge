import { NextResponse } from "next/server";
import { spawn, ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";

export const maxDuration = 800;

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
  proc: ChildProcess | null;
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

function jobSpec(type: JobType, opts: { count?: number }): { cmd: string; args: string[] } {
  switch (type) {
    case "daily-articles":
      return { cmd: "npm", args: ["run", "auto-write", "--", "--count", String(opts.count ?? 3)] };
    case "audit":
      return { cmd: "npm", args: ["run", "audit"] };
    case "followups":
      return { cmd: "npm", args: ["run", "followups"] };
    case "deploy":
      return { cmd: "npx", args: ["vercel", "deploy", "--prod", "--yes"] };
  }
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export async function POST(req: Request) {
  const guard = devGuard();
  if (guard) return guard;

  const body = await req.json().catch(() => ({}));
  const type: JobType = body.type;
  if (!["daily-articles", "audit", "followups", "deploy"].includes(type)) {
    return NextResponse.json({ error: "type must be daily-articles | audit | followups | deploy" }, { status: 400 });
  }

  // Reject if a job of the same type is already running
  for (const j of JOBS.values()) {
    if (j.type === type && j.status === "running") {
      return NextResponse.json({ error: `${type} already running`, jobId: j.id }, { status: 409 });
    }
  }

  const { cmd, args } = jobSpec(type, { count: body.count });
  const id = randomBytes(6).toString("hex");

  const proc = spawn(cmd, args, {
    cwd: process.cwd(),
    env: process.env,
  });

  const job: Job = {
    id,
    type,
    cmd,
    args,
    status: "running",
    startedAt: Date.now(),
    endedAt: null,
    exitCode: null,
    log: "",
    proc,
  };
  JOBS.set(id, job);

  proc.stdout.on("data", (d) => {
    job.log += stripAnsi(d.toString());
    // Cap log buffer to ~200KB to avoid memory blow-up
    if (job.log.length > 200_000) job.log = job.log.slice(-180_000);
  });
  proc.stderr.on("data", (d) => {
    job.log += stripAnsi(d.toString());
    if (job.log.length > 200_000) job.log = job.log.slice(-180_000);
  });
  proc.on("close", (code) => {
    job.status = code === 0 ? "done" : "failed";
    job.exitCode = code;
    job.endedAt = Date.now();
    job.proc = null;
  });
  proc.on("error", (e) => {
    job.status = "failed";
    job.log += `\n[spawn error] ${e.message}\n`;
    job.endedAt = Date.now();
    job.proc = null;
  });

  return NextResponse.json({ jobId: id, type, startedAt: job.startedAt });
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;
  const list = [...JOBS.values()]
    .map(({ proc: _proc, log, ...rest }) => ({ ...rest, logBytes: log.length }))
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 20);
  return NextResponse.json({ jobs: list });
}
