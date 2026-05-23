/**
 * KanzenAI cross-platform scheduler.
 *
 * One persistent Node process replaces all 11 launchd plists. Works identically
 * on macOS, Windows, and Linux (WSL). Each job runs in a spawned child process
 * so a crash in one bot doesn't take down the others.
 *
 * Install:
 *   - macOS: copy scripts/com.kanzenai.scheduler.plist to ~/Library/LaunchAgents/
 *            then `launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.kanzenai.scheduler.plist`
 *            This is the ONLY plist you need — it runs this scheduler which dispatches everything.
 *   - Windows: run `pwsh -File scripts/install-scheduler-windows.ps1` (registers a Task Scheduler entry that starts this on login)
 *
 * Manual run (any OS):
 *   npm run scheduler
 *
 * Logs: .audit/scheduler.log + each job writes its own .audit/<name>-YYYY-MM-DD.log
 */
import cron from "node-cron";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import chokidar from "chokidar";

const ROOT = process.cwd();
const AUDIT_DIR = join(ROOT, ".audit");
if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
const SCHED_LOG = join(AUDIT_DIR, "scheduler.log");

// Load .env.local so child processes inherit secrets.
function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (v && !process.env[k]) process.env[k] = v;
  }
}
loadEnv();

function ts(): string {
  return new Date().toISOString();
}

function log(line: string) {
  const stamped = `[${ts()}] ${line}`;
  console.log(stamped);
  try { appendFileSync(SCHED_LOG, stamped + "\n"); } catch { /* ignore */ }
}

/**
 * Run an npm script. Inherits env, captures stdout/stderr to a per-job log
 * file under .audit/. Returns a promise that resolves on exit (never rejects —
 * a non-zero exit is logged, not thrown, so one failing job doesn't kill the
 * scheduler).
 */
function runJob(name: string, npmScript: string, extraArgs: string[] = []): Promise<void> {
  return new Promise((resolve) => {
    const dateStr = ts().slice(0, 10);
    const jobLog = join(AUDIT_DIR, `${name}-${dateStr}.log`);
    log(`▶ ${name} starting`);
    appendFileSync(jobLog, `\n=== ${ts()} ===\n`);

    const isWindows = process.platform === "win32";
    const npmCmd = isWindows ? "npm.cmd" : "npm";
    const args = ["run", npmScript, ...(extraArgs.length ? ["--", ...extraArgs] : [])];

    const child = spawn(npmCmd, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: isWindows, // npm.cmd needs shell on Windows
    });
    child.stdout?.on("data", (d) => { try { appendFileSync(jobLog, d); } catch {} });
    child.stderr?.on("data", (d) => { try { appendFileSync(jobLog, d); } catch {} });
    child.on("exit", (code) => {
      log(`■ ${name} exited code=${code}`);
      resolve();
    });
    child.on("error", (e) => {
      log(`✗ ${name} spawn error: ${e.message}`);
      resolve();
    });
  });
}

// ─── Job definitions ─────────────────────────────────────────────────────
// All times are LOCAL to the host machine (node-cron default).
// node-cron format: minute hour day-of-month month day-of-week
type Job = { name: string; cron: string; npmScript: string; description: string };

const JOBS: Job[] = [
  // 8 AM — write 3 articles + post first via post-to-x (chained inside `auto-write`)
  { name: "daily-article", cron: "0 8 * * *", npmScript: "auto-write", description: "Writes 3 articles via Claude + posts first to X" },

  // 11 AM — daily 5-tweet thread
  { name: "x-thread", cron: "0 11 * * *", npmScript: "post-x-thread", description: "5-tweet thread on most threadworthy article" },

  // Every hour at :05 — self-paces remaining posts through the day
  { name: "x-post-drain", cron: "5 * * * *", npmScript: "post-to-x", description: "Posts up to 1 article tweet, gap-gated to 120 min" },

  // 7 AM — daily 11-check audit
  { name: "audit", cron: "0 7 * * *", npmScript: "audit", description: "11-check daily audit" },

  // DISABLED 2026-05-22 — auto-reply burns paid twitter.v2.search every 15 min and the
  // bio-match niche filter rejects ~100% of candidates, so $0 ROI for real spend.
  // Re-enable only after rebuilding the prospect selection (see scripts/auto-reply.ts
  // TODO at top of file) so it actually finds posts worth replying to.
  // { name: "auto-reply", cron: "*/15 * * * *", npmScript: "auto-reply", description: "Auto-reply hunter (caps: 10/day, 1/target)" },

  // Tuesday 10 AM — weekly boilerplate promo tweet
  { name: "boilerplate-promo", cron: "0 10 * * 2", npmScript: "post-boilerplate-promo", description: "Weekly boilerplate sales tweet" },

  // 6 AM — followups to vendors >=7d old without response
  { name: "followups", cron: "0 6 * * *", npmScript: "followups", description: "Vendor outreach follow-ups" },

  // 4 PM — vendor-approval-tracker: polls each affiliate network's API, detects new approvals,
  // auto-updates lib/affiliates.ts (placeholder -> live + real tracked URL). Skips networks
  // without credentials in .env.local. Telegram alert on changes.
  { name: "vendor-approval-tracker", cron: "0 16 * * *", npmScript: "vendor-approval-tracker", description: "Polls PartnerStack/Awin/ShareASale/Impact/CJ/Refersion for newly-approved affiliate programs" },

  // 5 AM — affiliate-link-guard: HEAD-checks every live affiliate URL.
  // After N consecutive failures, Telegram alert so Brady can decide
  // whether the vendor dropped him or the URL format changed.
  { name: "affiliate-link-guard", cron: "0 5 * * *", npmScript: "affiliate-link-guard", description: "Daily health-check on every live affiliate link" },
];

// Continuous watcher — replaces auto-deploy-watcher.sh with chokidar (cross-platform).
function startAutoDeployWatcher() {
  const watched = [
    join(ROOT, "content/articles"),
    join(ROOT, "content/comparisons"),
    join(ROOT, "lib"),
  ];
  let deployTimer: NodeJS.Timeout | null = null;
  const DEBOUNCE_MS = 2 * 60 * 1000; // 2 min after last change

  const watcher = chokidar.watch(watched, { ignoreInitial: true, persistent: true });
  watcher.on("all", (event, path) => {
    log(`◷ watcher: ${event} ${path}`);
    if (deployTimer) clearTimeout(deployTimer);
    deployTimer = setTimeout(async () => {
      log(`▶ auto-deploy triggered after 2min quiet period`);
      await runJob("auto-deploy", "vercel-deploy");
    }, DEBOUNCE_MS);
  });
  log(`◉ auto-deploy watcher armed on ${watched.length} paths (2 min debounce)`);
}

// ─── Boot ────────────────────────────────────────────────────────────────
log(`╔═══ KanzenAI scheduler starting (PID ${process.pid}) on ${process.platform} ═══╗`);

for (const job of JOBS) {
  if (!cron.validate(job.cron)) {
    log(`✗ invalid cron pattern "${job.cron}" for ${job.name} — skipping`);
    continue;
  }
  cron.schedule(job.cron, () => { void runJob(job.name, job.npmScript); });
  log(`  • ${job.name.padEnd(20)} "${job.cron}"  ${job.description}`);
}

// Continuous file watcher (replaces auto-deploy-watcher.sh)
if (process.env.KANZENAI_DISABLE_DEPLOY_WATCHER !== "1") {
  startAutoDeployWatcher();
}

log(`╚═══ ${JOBS.length} jobs scheduled. Scheduler is live. ═══╝`);

// Graceful shutdown
process.on("SIGINT", () => {
  log("Received SIGINT — shutting down scheduler");
  process.exit(0);
});
process.on("SIGTERM", () => {
  log("Received SIGTERM — shutting down scheduler");
  process.exit(0);
});

// Keep the process alive
setInterval(() => { /* heartbeat */ }, 60_000);
