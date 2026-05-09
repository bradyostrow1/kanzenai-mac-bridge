import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const maxDuration = 120;

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

export async function POST() {
  const guard = devGuard();
  if (guard) return guard;

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn("npm", ["run", "audit"], {
      cwd: process.cwd(),
      env: process.env,
    });

    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      // Strip ANSI color codes for browser display
      const stripped = out.replace(/\x1b\[[0-9;]*m/g, "");
      resolve(
        NextResponse.json({
          exitCode: code,
          output: stripped,
          stderr: err,
          ranAt: new Date().toISOString(),
        }),
      );
    });
    proc.on("error", (e) => {
      resolve(NextResponse.json({ exitCode: -1, error: e.message }, { status: 500 }));
    });
  });
}
