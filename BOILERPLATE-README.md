# AffiliateAI Boilerplate

The Next.js stack that powers [KanzenAI](https://kanzenai.com).

Auto-writes review articles via Claude. Auto-tweets on X. Captures emails into Resend. All managed from a localhost dashboard.

---

## What you're getting

- **Next.js 14 site** with article pages, comparison pages, homepage, lead-magnet page, sales page template
- **9 cron-driven scripts** that automate publishing
- **Localhost dashboard** at `/dashboard` for orchestration + live metrics
- **Audit bot** with 11 quality checks
- **Email capture + Resend welcome flow**

Live demo: https://kanzenai.com

---

## 10-minute deploy

### 1. Install

```bash
unzip affiliateai-boilerplate.zip
cd kanzenai
npm install
```

### 2. Create your keys

You need 5 API keys (all have free tiers):

| Service | What it does | Get it at |
|---|---|---|
| Anthropic | Writes articles | console.anthropic.com |
| Pexels | Hero images | pexels.com/api |
| Resend | Email + welcome | resend.com |
| Vercel | Hosting | vercel.com |
| X Developer | Auto-tweet | developer.x.com (Pay-Per-Use, ~$5 lasts 1-2 weeks) |

### 3. Copy `.env.example` to `.env.local` and fill in your keys

```bash
cp .env.example .env.local
# Edit .env.local with your keys
```

Required keys:
- `ANTHROPIC_API_KEY` — required for writer + chat + thread generation
- `PEXELS_API_KEY` — required for auto hero images
- `RESEND_API_KEY` + `RESEND_AUDIENCE_ID` + `RESEND_FROM` — email
- `X_CONSUMER_KEY` + `X_CONSUMER_SECRET` + `X_ACCESS_TOKEN` + `X_ACCESS_TOKEN_SECRET` — auto-tweet
- `X_BEARER_TOKEN` — only needed for some read endpoints

### 4. Customize for your niche

The boilerplate is hard-coded for real estate as the example. Search-and-replace these strings:

- `KanzenAI` → your brand name
- `kanzenai.com` → your domain
- `real estate agents` → your audience
- `lib/affiliates.ts` → your vendor list

The writer's system prompt is in `scripts/write-article.ts` and `scripts/daily-auto-write.ts`. Adapt to your niche.

### 5. Run the dev server

```bash
npm run dev
# → http://localhost:5050
# → http://localhost:5050/dashboard
```

### 6. Deploy to Vercel

```bash
npx vercel deploy --prod --yes
```

### 7. Install the cron jobs (macOS)

```bash
cp scripts/com.kanzenai.*.plist ~/Library/LaunchAgents/
for f in ~/Library/LaunchAgents/com.kanzenai.*.plist; do
  launchctl bootstrap "gui/$(id -u)" "$f"
done
```

That's it. Articles will auto-publish at 8 AM tomorrow.

---

## How it works

### Writer (`scripts/daily-auto-write.ts`)
1. Reads existing article slugs to identify coverage gaps
2. Asks Claude to suggest the next-best topic
3. Calls `write-article.ts` which:
   - Researches the products via Claude (with web context)
   - Generates a 1500-2500 word article with TLDR, body, products
   - Fetches a thematically-relevant Pexels image
   - Saves to `content/articles/<slug>.json`
4. Auto-deploy watcher commits + pushes within 2 min

Cost: ~$0.15/article in Claude API. ~$0.45/day at 3 articles.

### X Tweet bot (`scripts/post-to-x.ts`)
- Picks today's unposted articles
- Asks Claude to write a tweet in pricing-reveal / comparison / contrarian voice
- Posts main tweet + link reply + optional boilerplate-promo reply

Cost: ~$0.0003 per article (1 main + 1 reply + 1 optional promo).

### X Thread bot (`scripts/post-x-thread.ts`)
- Picks the most threadworthy un-threaded article (highest product count, most recent)
- Generates a 5-tweet thread via Claude
- Posts the chain with the URL appended to tweet 5

### Optional: X auto-reply (`scripts/auto-reply.ts`)
**Leave this off until you have organic momentum.** It's expensive ($1-5/day in search credits) and X auto-suspends new accounts replying rapidly to big accounts.

### Audit bot (`scripts/audit.ts`)
11 checks: duplicate hero images, near-duplicate titles, missing schema, thin content, placeholder URLs, downtime, etc. Fail = exit 1.

### Dashboard (`/dashboard` on localhost)
- 4 hero tiles (revenue signals)
- 4 operational tiles
- Live activity timeline
- Bot system status
- Live job runner (manual fire any bot)
- X command center (history, reply queue, paste-tweet-URL drafter)
- Chat with Kanzen (orchestrates everything in plain English)

---

## What I learned the hard way

### X "Pay Per Use" is a trap if you turn on the wrong bots

- **Posting tweets:** ~$0.0001 each. Essentially free.
- **Threads:** ~$0.0005 (5 tweets).
- **Search-based auto-reply / auto-discovery:** $1-5/day. Will drain $5 in hours.
- **User lookup for following lists:** Requires Basic tier ($200/mo).

Default config has the cheap bots ON and the expensive bots OFF. Don't enable `auto-reply.ts` or `x-monitor.ts` until you can spare $20-50/month for X credits.

### The /following endpoint is gated

You can't discover who the big accounts follow without Basic tier. The included `x-follow-network.ts` script has a curated-list fallback (manual selection of important accounts).

### Vercel Web Analytics has upgrade prompts

I replaced it with a free `counterapi.dev` integration. See `components/VisitorBeacon.tsx` and `app/api/track-view/route.ts`. Anonymous, free, no signup.

### Email capture > pageview tracking

Pageview counts are vanity. Email subscribers compound. The boilerplate captures emails on every article page + homepage + /resources/tool-stack lead magnet page.

### Affiliate codes take weeks

The /go/<vendor> redirect tracking is built in. But you have to manually apply to each affiliate program (PartnerStack, ShareASale, Impact, direct vendor portals). Most take 5-30 days to approve. Apply to 30+ programs to stack revenue paths.

---

## Folder structure

```
app/
  (site)/              ← Public site (articles, comparisons, homepage)
    articles/[slug]/   ← Individual article page
    boilerplate/       ← This sales page (delete or rebrand)
    resources/         ← Lead magnet page
  api/
    dashboard/         ← Localhost dashboard endpoints
    subscribe/         ← Email capture
    track-view/        ← Visitor beacon
  dashboard/           ← Localhost dashboard UI (dev-only)
  go/[vendor]/         ← Affiliate redirect tracking
components/            ← Shared React components
content/
  articles/            ← Article JSON files (created by writer)
  comparisons/         ← Comparison JSON files
lib/                   ← Affiliate registry, X targets, article helpers
scripts/               ← All cron-driven automation
.audit/                ← Bot logs (gitignored — created at runtime)
```

---

## Refund policy

7-day refund if it doesn't deploy clean. Email me at hello@kanzenai.com.

---

## Updates

You'll get notified via Gumroad when the codebase ships a new feature. Lifetime updates.

---

Built by Brady Ostrow. Questions: hello@kanzenai.com or @KanzenOfficial on X.
