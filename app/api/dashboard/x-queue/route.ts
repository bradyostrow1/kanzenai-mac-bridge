import { NextResponse } from "next/server";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const ROOT = process.cwd();
const QUEUE_PATH = join(ROOT, ".audit", "x-queue.json");

type QueueItem = {
  slug: string;
  title: string;
  url: string;
  category?: string;
  tweetText: string;
  replyText: string;
  generatedAt: string;
  status: "pending" | "copied" | "posted" | "discarded";
};

function devGuard() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Dashboard is dev-only" }, { status: 404 });
  }
  return null;
}

async function load(): Promise<QueueItem[]> {
  if (!existsSync(QUEUE_PATH)) return [];
  try {
    return JSON.parse(await readFile(QUEUE_PATH, "utf8"));
  } catch {
    return [];
  }
}

async function save(items: QueueItem[]) {
  await writeFile(QUEUE_PATH, JSON.stringify(items, null, 2));
}

export async function GET() {
  const guard = devGuard();
  if (guard) return guard;
  const items = await load();
  return NextResponse.json({ items });
}

export async function PATCH(req: Request) {
  const guard = devGuard();
  if (guard) return guard;
  const body = await req.json();
  const { slug, status } = body;
  if (!slug || !["pending", "copied", "posted", "discarded"].includes(status)) {
    return NextResponse.json({ error: "slug + valid status required" }, { status: 400 });
  }
  const items = await load();
  const item = items.find((i) => i.slug === slug);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  item.status = status;
  await save(items);
  return NextResponse.json({ ok: true, item });
}
