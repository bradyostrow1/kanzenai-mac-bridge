import { NextResponse } from "next/server";
import { spawn } from "node:child_process";

export const maxDuration = 300;

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

type WriteRequest = {
  topic: string;
  products: string;
  category?: string;
  slug?: string;
  mode?: "review" | "compare";
};

export async function POST(req: Request) {
  const guard = devGuard();
  if (guard) return guard;

  let body: WriteRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.topic || !body.products) {
    return NextResponse.json({ error: "topic and products required" }, { status: 400 });
  }

  const args = ["run", "write", "--", "--topic", body.topic, "--products", body.products];
  if (body.category) args.push("--category", body.category);
  if (body.slug) args.push("--slug", body.slug);
  if (body.mode === "compare") args.push("--mode", "compare");

  return new Promise<NextResponse>((resolve) => {
    const proc = spawn("npm", args, { cwd: process.cwd(), env: process.env });

    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("close", (code) => {
      resolve(
        NextResponse.json({
          exitCode: code,
          output: out,
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
