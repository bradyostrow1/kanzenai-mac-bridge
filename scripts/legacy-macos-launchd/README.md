# Legacy macOS launchd plists (archived 2026-05-22)

These 12 launchd `.plist` files were the original Mac-only cron mechanism for
KanzenAI before the migration to a single cross-platform Node scheduler.

**They are not used anywhere.** The current source of truth is
`scripts/scheduler.ts`, which runs all jobs in one persistent `node-cron`
process and works on macOS, Windows, and Linux.

Kept here only as a reference if we ever need to recover an exact schedule
or argv string for a historical job. Do not install them.

If you need to re-enable a Mac launchd job for some reason, install just
`com.kanzenai.scheduler.plist` — it boots `scripts/scheduler.ts`, which
dispatches everything. You never need the per-job plists.
