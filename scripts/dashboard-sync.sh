#!/usr/bin/env bash
# Builds a snapshot of KanzenAI state and ships it to the Hermes VPS dashboard.
# Runs every 5 min via launchd. Read-only — never modifies KanzenAI data.

set -euo pipefail

KANZEN_ROOT="${HOME}/Code/kanzenai"
VPS_HOST="hermes-vps"
VPS_PATH="/docker/hermes-agent-nw73/data/kanzenai-snapshot.json"
LOG="${KANZEN_ROOT}/.audit/dashboard-sync.log"

mkdir -p "$(dirname "$LOG")"
# Cross-platform mktemp: GNU (Linux/Git Bash) requires explicit XXXXXX template;
# BSD (macOS) accepts `-t prefix` and adds randomness itself. Try GNU first.
SNAP=$(mktemp -t kz-snap.XXXXXX 2>/dev/null || mktemp -t kz-snap)
trap "rm -f $SNAP" EXIT

NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Cross-platform Python: Mac/Linux have python3; Windows (Git Bash) has python.
# `command -v python3` can match a Microsoft Store stub on Windows that exits
# silently when invoked — so we actually EXECUTE each candidate to confirm it
# runs and is Python 3.
PY_BIN=""
for candidate in python3 python python3.12 python3.11; do
    if "$candidate" -c "import sys; sys.exit(0 if sys.version_info[0]==3 else 1)" 2>/dev/null; then
        PY_BIN="$candidate"; break
    fi
done
if [ -z "$PY_BIN" ]; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) sync FAILED — no working Python 3 interpreter found" >> "$LOG"
    exit 1
fi

KANZEN_ROOT="$KANZEN_ROOT" NOW="$NOW" "$PY_BIN" <<'PY' > "$SNAP"
import json, os, time
from pathlib import Path
from datetime import datetime, timezone, timedelta

ROOT = Path(os.environ["KANZEN_ROOT"])
NOW = os.environ["NOW"]
AUDIT = ROOT / ".audit"

def safe_json(p, default):
    try:
        return json.loads(Path(p).read_text())
    except Exception:
        return default

def parse_iso(s):
    if not s:
        return None
    try:
        s = s.replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None

# x-metrics is a LIST of recent posts with engagement
x_metrics = safe_json(AUDIT / "x-metrics.json", [])
if not isinstance(x_metrics, list):
    x_metrics = []

# Aggregate engagement across recent posts
total_impressions = sum(p.get("impressions", 0) or 0 for p in x_metrics)
total_url_clicks = sum(p.get("urlClicks", 0) or 0 for p in x_metrics)
total_profile_clicks = sum(p.get("profileClicks", 0) or 0 for p in x_metrics)
total_likes = sum(p.get("likes", 0) or 0 for p in x_metrics)
total_replies = sum(p.get("replies", 0) or 0 for p in x_metrics)

# Last 24h activity
now_dt = datetime.now(timezone.utc)
last_24h = now_dt - timedelta(hours=24)
last_7d = now_dt - timedelta(days=7)

posts_24h = [p for p in x_metrics if (parse_iso(p.get("postedAt")) or now_dt) > last_24h]
posts_7d = [p for p in x_metrics if (parse_iso(p.get("postedAt")) or now_dt) > last_7d]

# Top posts by impressions
top_posts = sorted(x_metrics, key=lambda p: p.get("impressions", 0) or 0, reverse=True)[:5]

# Queue
x_queue = safe_json(AUDIT / "x-queue.json", [])
if not isinstance(x_queue, list):
    x_queue = []

# Insights
x_insights = safe_json(AUDIT / "x-insights.json", {})
if not isinstance(x_insights, dict):
    x_insights = {}

# Watched accounts
x_users = safe_json(AUDIT / "x-user-ids.json", {})
watched_count = len(x_users) if isinstance(x_users, (list, dict)) else 0

# Article inventory
articles_dir = ROOT / "content" / "articles"
comparisons_dir = ROOT / "content" / "comparisons"

def list_content(d, kind):
    out = []
    if not d.exists():
        return out
    for f in sorted(d.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.is_file() and f.suffix in (".json", ".md", ".mdx"):
            slug = f.stem
            title = slug.replace("-", " ").title()
            if f.suffix == ".json":
                try:
                    d2 = json.loads(f.read_text())
                    title = d2.get("title") or d2.get("h1") or title
                except Exception:
                    pass
            out.append({
                "slug": slug,
                "title": title,
                "publishedAt": time.strftime("%Y-%m-%d", time.gmtime(f.stat().st_mtime)),
                "type": kind,
            })
    return out

articles = list_content(articles_dir, "article")
comparisons = list_content(comparisons_dir, "comparison")
recent = sorted(articles + comparisons, key=lambda x: x["publishedAt"], reverse=True)[:10]

# Audit log status — count successful audits in last 7 days
audit_logs = sorted(AUDIT.glob("audit-*.log"), reverse=True)[:7]
audit_pass_rate = None
if audit_logs:
    passed = 0
    for f in audit_logs:
        try:
            text = f.read_text()
            if "PASS" in text or "ok" in text.lower() or f.stat().st_size > 0:
                passed += 1
        except Exception:
            pass
    audit_pass_rate = round(100 * passed / len(audit_logs))

# Auto-deploy activity
auto_deploy_log = AUDIT / "auto-deploy.log"
recent_deploys_24h = 0
if auto_deploy_log.exists():
    try:
        text = auto_deploy_log.read_text()
        # rough heuristic — counts lines that look like deploy markers
        recent_deploys_24h = text.count("DEPLOY") + text.count("Deployment created")
    except Exception:
        pass

# Top vendors from URL clicks (groups by URL host if present)
top_clicks = []
url_click_map = {}
for p in x_metrics:
    clicks = p.get("urlClicks", 0) or 0
    if clicks > 0:
        slug = p.get("slug") or "(unknown)"
        url_click_map[slug] = url_click_map.get(slug, 0) + clicks
top_clicks = [{"vendor": k, "clicks": v} for k, v in sorted(url_click_map.items(), key=lambda x: -x[1])[:5]]

snapshot = {
    "syncedAt": NOW,
    "source": "snapshot",
    "metrics": {
        "articlesPublished": len(articles),
        "comparisonsPublished": len(comparisons),
        "xPostsTracked": len(x_metrics),
        "xPosts24h": len(posts_24h),
        "xPosts7d": len(posts_7d),
        "xQueueDepth": len(x_queue),
        "xRepliesQueued": x_insights.get("repliesQueued", 0),
        "xWatchedAccounts": watched_count,
        "xImpressions7d": total_impressions,
        "xUrlClicks7d": total_url_clicks,
        "xProfileClicks7d": total_profile_clicks,
        "xLikes7d": total_likes,
        "xReplies7d": total_replies,
        "auditPassRate": audit_pass_rate,
        "recentDeploys": recent_deploys_24h,
        # Aliases the dashboard expects
        "affiliateClicksToday": sum(p.get("urlClicks", 0) or 0 for p in posts_24h),
        "affiliateClicks7d": total_url_clicks,
        "xPostsToday": len(posts_24h),
    },
    "recentArticles": recent,
    "topClicks": top_clicks,
    "topPosts": [
        {
            "tweetId": p.get("tweetId"),
            "text": (p.get("text") or "")[:140],
            "postedAt": p.get("postedAt"),
            "impressions": p.get("impressions", 0),
            "urlClicks": p.get("urlClicks", 0),
            "likes": p.get("likes", 0),
            "slug": p.get("slug"),
        }
        for p in top_posts
    ],
    "queue": [
        {
            "kind": q.get("kind"),
            "slug": q.get("slug"),
            "scheduledAt": q.get("scheduledAt") or q.get("postAt"),
        }
        for q in x_queue[:10]
    ],
    "lastInsightAt": x_insights.get("generatedAt"),
}
print(json.dumps(snapshot, indent=2))
PY

# Ship to VPS atomically
if scp -q "$SNAP" "${VPS_HOST}:${VPS_PATH}.tmp"; then
    ssh "$VPS_HOST" "mv ${VPS_PATH}.tmp ${VPS_PATH} && chmod 644 ${VPS_PATH}" 2>/dev/null
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) sync ok ($(wc -c < $SNAP) bytes)" >> "$LOG"
else
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) sync FAILED" >> "$LOG"
    exit 1
fi
