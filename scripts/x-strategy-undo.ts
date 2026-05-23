/**
 * Restore the most recent x-strategy snapshot.
 *
 * Usage:
 *   npm run x-strategy:undo            # restore the latest snapshot
 *   npm run x-strategy:undo -- --list  # list available snapshots
 *   npm run x-strategy:undo -- --file <basename>  # restore a specific one
 */
import { promises as fs } from "node:fs";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { X_STRATEGY_PATHS, validate, type XStrategy } from "../lib/x-strategy.js";

function listSnapshots(): string[] {
  if (!existsSync(X_STRATEGY_PATHS.versionsDir)) return [];
  return readdirSync(X_STRATEGY_PATHS.versionsDir)
    .filter((f) => f.endsWith(".json"))
    .sort(); // ISO timestamps sort lexically = chronologically
}

async function main() {
  const args = process.argv.slice(2);
  const snapshots = listSnapshots();

  if (args.includes("--list")) {
    console.log(`${snapshots.length} snapshot(s) in ${X_STRATEGY_PATHS.versionsDir}:`);
    for (const s of snapshots) console.log(`  - ${s}`);
    return;
  }

  if (snapshots.length === 0) {
    console.error("No snapshots to restore from. The strategist hasn't made a live change yet.");
    process.exit(1);
  }

  const fileIdx = args.indexOf("--file");
  const target = fileIdx >= 0 && args[fileIdx + 1]
    ? args[fileIdx + 1]
    : snapshots[snapshots.length - 1]; // most recent
  const src = join(X_STRATEGY_PATHS.versionsDir, target);
  if (!existsSync(src)) {
    console.error(`Snapshot not found: ${src}`);
    process.exit(1);
  }

  const raw = await fs.readFile(src, "utf8");
  const parsed = JSON.parse(raw) as XStrategy;
  validate(parsed); // refuse to restore something that itself violates rails
  parsed.updated_at = new Date().toISOString();
  parsed.updated_by = "x-strategy-undo";

  await fs.writeFile(X_STRATEGY_PATHS.live, JSON.stringify(parsed, null, 2));
  console.log(`✓ Restored ${target} → ${X_STRATEGY_PATHS.live}`);
  console.log("  Bots will pick up the previous config on their next run.");
}

main().catch((e) => { console.error("FATAL:", e?.message ?? e); process.exit(1); });
