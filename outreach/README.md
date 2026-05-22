# KanzenAi affiliate blitz — action sheet

**Generated 2026-05-22 by Hermes/PC Claude.** Single source of truth for unblocking KanzenAi revenue.

> Voice rule for every outreach send: **"The KanzenAI Editorial Team"** — never "I" or "Brady." Customer-voice "I" inside quoted testimonials is fine. Sign-off: `— The KanzenAI Editorial Team · hello@kanzenai.com`

---

## Today's revenue path (in order)

### Step 1 — SHIP Gumroad (Engine 1, $149/sale, no approval needed)
**Impact:** Live link on kanzenai.com/boilerplate is already pointing at `gumroad.com/l/icchv` (deployed 2026-05-22). Slug only resolves if the listing is **published**. Right now it's still a draft.

→ See [GUMROAD.md](./GUMROAD.md). 5 minutes of clicks. **First dollar lives here.**

### Step 2 — APPLY to 8 Tier-1 affiliate programs (Engine 2, $200–$300/signup)
All 8 require an outreach email (no public self-serve form). Drafts are pre-written + personalized.

| Vendor | Commission | Outreach to | Status |
|---|---|---|---|
| Sierra Interactive | $300/signup | partners@sierrainteractive.com | [draft](./tier-1/sierra-interactive.md) |
| kvCORE (Inside RE) | $250/signup | partners@insiderealestate.com | [draft](./tier-1/kvcore.md) |
| Follow Up Boss | $200/signup | partners@followupboss.com | [draft](./tier-1/follow-up-boss.md) |
| Real Geeks | $200/signup | affiliates@realgeeks.com | [draft](./tier-1/real-geeks.md) |
| SkySlope | $200/signup | partnerships@skyslope.com | [draft](./tier-1/skyslope.md) |
| ActiveCampaign | 30% recurring | partners.activecampaign.com (form) | [draft](./tier-1/activecampaign.md) |
| PhoneBurner | 25% recurring | affiliates@phoneburner.com | [draft](./tier-1/phoneburner.md) |
| IDX Broker | 20% recurring | affiliate@idxbroker.com | [draft](./tier-1/idx-broker.md) |

→ Open each `.md` in tier-1/, copy the email body, send from `hello@kanzenai.com`. ~15 min total.
**Reply window:** 7–30 days typical. Set a 7-day follow-up calendar event after sending.

### Step 3 — SIGN UP for self-serve affiliate networks (parallel, no waiting)
Each network gives you access to 100s–1000s of vendors at once. Sign up while you wait for the Tier-1 emails to land.

| Network | URL | Why | Time |
|---|---|---|---|
| Awin | https://ui.awin.com/affiliate-signup | Content/Comparison & Review category, $5 deposit. Has Bench, BombBomb, Otter.ai, Constant Contact, more. | 10 min |
| ShareASale | https://www.shareasale.com/join.cfm | Calendly, ConvertKit, Mailchimp partner programs. | 10 min |
| Impact | https://app.impact.com/secure/signup-publishers | Constellation Software brands (Market Leader), many CRM tools. | 10 min |
| CJ Affiliate | https://signup.cj.com/member/signup/publisher/ | Larger SaaS — HubSpot, Constant Contact, others. | 10 min |
| Refersion | https://www.refersion.com/sign-up-affiliate | Many DTC SaaS run their affiliate programs here. | 5 min |
| FlexOffers | https://publishers.flexoffers.com/Account/Signup | Catch-all aggregator, decent backfill. | 5 min |

→ See [networks/](./networks/) — one file per network with exact form-fill copy.

### Step 4 — DIRECT vendor affiliate signups (zero outreach, browser only)
30+ of our 71 vendors have a public `/affiliates` or `/partners` page with a self-serve form. Open each, fill out, done.

→ See [direct-programs.md](./direct-programs.md).

---

## What Hermes is doing in parallel (while you click)

- `auto-reply` X bot continues every 15 min on PC scheduler
- `daily-auto-write` will fire 8 AM tomorrow PT, writing 3 new articles
- `auto-deploy-watcher` will push each new article to Vercel within 2 min of write
- `audit` will run 7 AM tomorrow PT — should report 0 unconverted URLs now that 11 vendors are added
- **Next bot to build** (vendor-approval-tracker) will poll every affiliate network's publisher dashboard daily and update `lib/affiliates.ts` `status: "live"` automatically when a code is approved. I'll write this after you've started 2+ applications.

---

## Daily KPI to hit while waiting on approvals

| Metric | Today | Day 7 target | Day 30 target |
|---|---|---|---|
| Tier-1 emails sent | 0 | 8/8 | 8 sent + first follow-up |
| Network signups complete | 0 | 6/6 | 6 + all relevant programs requested inside each |
| Direct signups complete | 0 | 15 | 30 |
| Approvals back | 0 | 1+ | 4+ |
| Gumroad sales | 0 | 1–2 | 5–10 |

When you finish each step, tell me — I'll mark the task and reload the next focus area.
