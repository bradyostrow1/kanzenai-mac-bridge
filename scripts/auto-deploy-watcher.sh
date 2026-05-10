#!/bin/bash
# KanzenAI auto-deploy watcher
#
# Run by launchd every 2 minutes. Checks if there are uncommitted changes in
# content/, lib/, components/, or app/. If yes, waits ~90s to make sure the
# user is done editing, then commits + deploys.
#
# Logs to ~/Code/kanzenai/.audit/auto-deploy.log
#
# Install:
#   cp scripts/com.kanzenai.auto-deploy.plist ~/Library/LaunchAgents/
#   launchctl load -w ~/Library/LaunchAgents/com.kanzenai.auto-deploy.plist

set -euo pipefail

REPO="$HOME/Code/kanzenai"
LOG_DIR="$REPO/.audit"
LOG="$LOG_DIR/auto-deploy.log"
LOCK="$LOG_DIR/auto-deploy.lock"
DEBOUNCE_SECONDS=90

mkdir -p "$LOG_DIR"

log() {
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $*" >> "$LOG"
}

# Skip if a previous run is still in progress
if [ -f "$LOCK" ]; then
  pid=$(cat "$LOCK" 2>/dev/null || echo "")
  if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    log "another instance running (pid=$pid), skipping"
    exit 0
  else
    rm -f "$LOCK"
  fi
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

cd "$REPO" || { log "cannot cd to $REPO"; exit 1; }

# Only watch these paths — ignore audit logs, .next, etc.
WATCH_PATHS="content lib components app scripts"

# Are there uncommitted or unpushed changes in watched paths?
changes=$(git status --porcelain $WATCH_PATHS 2>/dev/null | grep -v '\.bak$' || true)
if [ -z "$changes" ]; then
  log "no changes"
  exit 0
fi

log "changes detected, debouncing ${DEBOUNCE_SECONDS}s..."
sleep $DEBOUNCE_SECONDS

# Re-check after debounce — if changes have changed during the wait, user is still editing
changes2=$(git status --porcelain $WATCH_PATHS 2>/dev/null | grep -v '\.bak$' || true)
if [ "$changes" != "$changes2" ]; then
  log "changes shifted during debounce, will retry next tick"
  exit 0
fi

# Stage + commit
log "committing $(echo "$changes" | wc -l | tr -d ' ') file(s)"
git add $WATCH_PATHS 2>>"$LOG"

# Generate commit message from filenames
files=$(echo "$changes" | awk '{print $2}' | xargs -n1 basename | head -3 | tr '\n' ' ')
msg="Auto: update $files($(echo "$changes" | wc -l | tr -d ' ') files)"

git -c user.email="bradyostroww@gmail.com" -c user.name="Brady Ostrow" \
    commit -q -m "$msg

Auto-committed by auto-deploy-watcher" 2>>"$LOG" || {
  log "commit failed (probably no staged changes), aborting"
  exit 1
}

log "deploying to vercel..."
deploy_out=$(npx vercel deploy --prod --yes 2>&1 || echo "FAILED")
prod_url=$(echo "$deploy_out" | grep -oE 'https://kanzenai-[a-z0-9-]+\.vercel\.app' | head -1)

if echo "$deploy_out" | grep -q "FAILED"; then
  log "deploy FAILED: $deploy_out" | head -5
  exit 1
fi

log "deployed: ${prod_url:-(no url captured)}"
log "live: https://kanzenai.com"
exit 0
