# KanzenAI VPS deployment

Files for moving the cron runtime off the PC (Windows Task Scheduler, AtLogOn
trigger, dies on logout) onto the Hermes VPS (always-on, systemd, same
infrastructure every other Hermes bot uses).

## Files

- **`kanzen-scheduler.service`** — systemd unit for the single node-cron
  process at `scripts/scheduler.ts`. Models the existing `hermes-api.service`
  pattern: `Type=simple`, `Restart=always`, logs to `/var/log/`.
- **`env.local.template`** — env file with named slots only, no values.
  Brady pastes rotated secrets into `/opt/kanzen/.env.local` himself.
- **`install.sh`** — idempotent installer. Clones repo to `/opt/kanzen`,
  runs `npm install`, copies the systemd unit, **enables but does not start**.
  Brady starts manually after pasting secrets.

## Why this exists

Audit on 2026-05-22 found:
- Windows Task Scheduler trigger = `AtLogOn` only.
- Ctrl+C in the morning killed the scheduler and nothing restarted it.
- `daily-article` (8 AM), `audit` (7 AM), `followups` (6 AM), and `x-thread`
  (11 AM) all silently missed.

Moving to the VPS solves all of that: it's the same box every other Hermes
bot already runs on, it's always on, systemd restarts crashed processes
automatically.

## Why /opt/kanzen and not /opt/hermes-army/kanzen

KanzenAI is its own business, not a Hermes bot. Keep it at a sibling path
(`/opt/kanzen`) so the namespacing matches the org chart and the Hermes Army
folder stays clean. Same VPS, different tenant.

## Deploy order

1. SSH to the VPS, run `bash scripts/vps/install.sh` (or pipe it remotely:
   `ssh hermes-vps "bash -s" < scripts/vps/install.sh`).
2. Brady edits `/opt/kanzen/.env.local` and pastes the **rotated** secrets.
3. `sudo systemctl start kanzen-scheduler`
4. Tail `sudo journalctl -fu kanzen-scheduler` — confirm "7 jobs scheduled.
   Scheduler is live."
5. After 24 h, verify each job logged at least one run via
   `ls -la /opt/kanzen/.audit/`.
6. Disable the Windows task on the PC to avoid double-running:
   `schtasks /Change /TN "KanzenAI Scheduler" /DISABLE`

## Don't forget

- The PC repo stays the editor's working copy. VPS is runtime only.
- Pushing to `main` → next VPS `git pull` picks up the change. We don't yet
  have a webhook to auto-deploy on push; the `auto-deploy` watcher inside
  `scheduler.ts` covers content/article writes that fire `vercel-deploy`,
  but it does NOT pull new bot code from GitHub. Update bot code by
  SSHing in and running `git -C /opt/kanzen pull && sudo systemctl restart
  kanzen-scheduler`.
