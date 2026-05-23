#!/usr/bin/env bash
# Install KanzenAI scheduler on the Hermes VPS.
#
# This script is idempotent — safe to re-run. It does NOT touch secrets.
# Brady pastes secrets into /opt/kanzen/.env.local himself after this runs.
#
# Run on the VPS as the brady user:
#   bash scripts/vps/install.sh
#
# Or remotely from your laptop:
#   ssh hermes-vps "bash -s" < scripts/vps/install.sh

set -euo pipefail

REPO_URL="https://github.com/bradyostrow1/kanzenai-mac-bridge.git"
INSTALL_DIR="/opt/kanzen"
SERVICE_NAME="kanzen-scheduler"
LOG_FILE="/var/log/${SERVICE_NAME}.log"
USER_NAME="${SUDO_USER:-${USER}}"
GROUP_NAME="$(id -gn "$USER_NAME")"

say() { printf "\033[1;36m[kanzen-install]\033[0m %s\n" "$*"; }

# ── 1. Clone or update the repo ──────────────────────────────────
if [ ! -d "$INSTALL_DIR/.git" ]; then
  say "cloning $REPO_URL → $INSTALL_DIR"
  sudo mkdir -p "$INSTALL_DIR"
  sudo chown "$USER_NAME:$GROUP_NAME" "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  say "repo already cloned — pulling latest"
  git -C "$INSTALL_DIR" fetch origin
  git -C "$INSTALL_DIR" checkout main
  git -C "$INSTALL_DIR" pull --ff-only origin main
fi

# ── 2. Install npm dependencies ──────────────────────────────────
say "npm install (production)"
cd "$INSTALL_DIR"
npm install --omit=dev --no-audit --no-fund

# ── 3. Stage .env.local if it doesn't exist (do not overwrite) ──
if [ ! -f "$INSTALL_DIR/.env.local" ]; then
  say "creating empty $INSTALL_DIR/.env.local from template — Brady must paste secrets next"
  cp "$INSTALL_DIR/scripts/vps/env.local.template" "$INSTALL_DIR/.env.local"
  chmod 600 "$INSTALL_DIR/.env.local"
else
  say ".env.local already exists — leaving it alone"
fi

# ── 4. Install systemd unit ──────────────────────────────────────
say "installing systemd unit"
sudo cp "$INSTALL_DIR/scripts/vps/kanzen-scheduler.service" \
        "/etc/systemd/system/${SERVICE_NAME}.service"

# Adjust User= / Group= in the unit to match the installer
sudo sed -i \
  -e "s/^User=brady$/User=${USER_NAME}/" \
  -e "s/^Group=brady$/Group=${GROUP_NAME}/" \
  "/etc/systemd/system/${SERVICE_NAME}.service"

# ── 5. Log file with correct ownership (StandardOutput=append needs it) ──
sudo touch "$LOG_FILE"
sudo chown "$USER_NAME:$GROUP_NAME" "$LOG_FILE"

# ── 6. Reload systemd ────────────────────────────────────────────
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME.service"

# ── 7. Final hint — but DO NOT start yet ─────────────────────────
cat <<EOF

✅ Install staged. Service is enabled but NOT started.

Next steps (Brady):
  1. Edit /opt/kanzen/.env.local with the ROTATED secrets:
       \$EDITOR /opt/kanzen/.env.local
     Required slots: ANTHROPIC_API_KEY, RESEND_API_KEY, PEXELS_API_KEY,
     and all 7 X_* tokens. RESEND_AUDIENCE_ID + RESEND_FROM are
     pre-filled from production.
  2. Verify file permissions stay tight:
       chmod 600 /opt/kanzen/.env.local
  3. Start the service:
       sudo systemctl start ${SERVICE_NAME}
  4. Tail the logs to confirm it boots and schedules 7 jobs:
       sudo journalctl -fu ${SERVICE_NAME}
       tail -f /opt/kanzen/.audit/scheduler.log

Once it's confirmed running:
  - Disable the Windows Task Scheduler entry on the PC:
       schtasks /End /TN "KanzenAI Scheduler"
       schtasks /Change /TN "KanzenAI Scheduler" /DISABLE
    (Keep the PC repo around for editing — VPS is now the runtime.)
EOF
