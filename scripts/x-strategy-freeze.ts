/**
 * Lock or unlock the x-strategy config so Bot 11 stops auto-updating it.
 *
 * Usage:
 *   npm run x-strategy:freeze            # lock
 *   npm run x-strategy:freeze -- --off   # unlock
 */
import { promises as fs } from "node:fs";
import { loadStrategy, X_STRATEGY_PATHS, validate } from "../lib/x-strategy.js";

async function main() {
  const off = process.argv.includes("--off");
  const current = loadStrategy();
  const next = {
    ...current,
    frozen: !off,
    updated_at: new Date().toISOString(),
    updated_by: off ? "x-strategy-freeze:unlock" : "x-strategy-freeze:lock",
  };
  validate(next);
  await fs.writeFile(X_STRATEGY_PATHS.live, JSON.stringify(next, null, 2));
  console.log(`✓ config.frozen = ${next.frozen}`);
  console.log(off
    ? "  Bot 11 will resume auto-updates on its next run."
    : "  Bot 11 will skip its run until you unlock with --off.");
}

main().catch((e) => { console.error("FATAL:", e?.message ?? e); process.exit(1); });
