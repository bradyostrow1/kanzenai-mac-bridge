# Bot 9 · META POSTER — spec

**Status:** ⬜ SPECCED, NOT BUILT.
**Activate when:** Bot 8 has produced at least 1 weekly batch AND ≥1
affiliate program is earning. Until then, this bot does not exist as
running code.

This is **the media buyer**. It spends real money. It is the highest-risk
bot in the roster. The kill-switch chain below is non-negotiable.

---

## What it does

Takes Bot 8's `brief.json` + asset folder, creates a Meta Ads campaign +
ad set + ad with the supplied creative, sets a daily budget, monitors
performance, and reports back. Pauses underperforming sets automatically;
proposes budget shifts to Brady via the money chain.

## Inputs

- The folder Bot 8 wrote: `.audit/ad-creative/<slug>/<date>/`.
- Brady's approved budget envelope for the week (set via env var or
  hand-written manifest — see "Money chain" below).
- Existing Meta ad account history (read-only) for context.

## Outputs

- Live Meta campaign(s) running against `kanzenai.com/articles/<slug>` with
  proper UTM tagging that the `/go/<vendor>` redirect already captures.
- `.audit/meta-poster/<YYYY-MM-DD>.log` — every API call, every spend event.
- `money_ledger` writes: `business=kanzenai, direction=out,
  category=meta-ads, sub=<campaign-id>` for every spend tick.

## Stack + keys (none present yet — get when ready)

- `META_ACCESS_TOKEN` — long-lived system-user token from Meta Business Suite
- `META_AD_ACCOUNT_ID` — `act_<numeric>`
- `META_APP_ID` + `META_APP_SECRET` — for token refresh
- `META_PAGE_ID` — the page ads run from
- `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` — same shared 808 ledger Bot 6 writes to
- `TELEGRAM_BOT_TOKEN` + `TELEGRAM_HOME_CHANNEL` — for the money-chain pings

## Schedule

- **Hourly** — performance pull (free), pause any ad set above the proposed
  CPA ceiling. Auto-allowed (read + pause are safe).
- **Daily 9 AM ET** — budget proposal: bot scores the past 24h of each
  campaign on the 7-category rubric (see Money Chain) and emits a proposal:
  `{ campaign_id, current_budget, proposed_budget, reason }`.
- **Sunday 8 AM ET** — campaign creation: if Bot 8's new weekly batch is on
  disk AND a campaign slot is open, propose new campaign + assets to CFO.

## Money chain (THE PART THAT MATTERS)

Every spend action — new campaign, budget increase, even unpausing a paused
ad set — goes through this chain. NOTHING auto-spends.

```
Bot 9 (this bot) — proposes
   ↓ writes proposal to .audit/meta-proposals/<id>.json
   ↓ pings: money_ledger.proposed (no spend yet)
CFO bot — scores proposal
   ↓ 7-category rubric (TBD: ROAS, CPA vs target, audience saturation,
      creative freshness, budget utilization, business-level cash runway,
      week-over-week trend)
   ↓ proposals that score < threshold → auto-reject + Telegram log
   ↓ proposals that score ≥ threshold → forward to Brady
Brady — final GO
   ↓ Telegram message: "CFO approved $X for Y. Reply YES to fire."
   ↓ Brady taps YES (or anything not-YES = decline)
Bot 9 — executes
   ↓ calls Meta API with the approved budget
   ↓ writes money_ledger.committed
   ↓ confirms back to Telegram with campaign_id + ad-manager link
```

**Pause/throttle is asymmetric.** Stopping spend is auto-allowed (it's a
safety, not a spend). Increasing or starting spend is gated.

## Kill-switches

1. **Per-campaign daily cap** — env var `META_CAMPAIGN_DAILY_USD_MAX`. Bot
   never proposes above this.
2. **Account daily cap** — `META_ACCOUNT_DAILY_USD_MAX`. Sum of all
   proposed budgets in 24h cannot exceed this.
3. **Account weekly cap** — `META_ACCOUNT_WEEKLY_USD_MAX`. Same.
4. **CFO unreachable → spend halts.** If the CFO bot does not respond to a
   proposal within 10 minutes, the proposal is dropped, not auto-approved.
5. **Stop-marker file** — `.audit/meta-poster-stop.txt`. Presence pauses all
   campaigns + halts new proposals until cleared. Brady (or any other bot)
   can drop the file to brake.
6. **Affiliate-link-guard tie-in** — if any of the campaign's destination
   vendors get flagged failing by Bot 7 (affiliate-link-guard), Bot 9
   auto-pauses that campaign and pings Brady. Never spend driving traffic
   to a dead link.

## Approval gate summary

✅ Performance pull, ad-set pause, kill-switch trigger — AUTO
🟡 Budget increase < $10/day — CFO auto-approves if rubric clears
🔴 Budget increase ≥ $10/day, new campaigns, unpause — CFO scores → Brady

## Build checklist (when ready)

- [ ] Wait for Bot 6 first commission write to `money_ledger`
- [ ] Wait for Bot 8 to ship its first batch
- [ ] Decide ledger destination (shared 808 Supabase vs Kanzen-local)
- [ ] Get Meta system-user token + ad account + page
- [ ] Build proposal writer (just JSON to disk + Telegram)
- [ ] Build CFO scoring rubric (this is its own design conversation)
- [ ] Build Brady's tap-to-confirm flow (Telegram inline button or numeric reply)
- [ ] Build execution layer (Meta Marketing API wrapper)
- [ ] Hourly performance pull
- [ ] Wire into scheduler with the right schedule + caps
- [ ] Tabletop a fake spend with $1/day proposal to validate the whole chain

## Risk

**Maximum.** This is the only Kanzen bot that can lose Brady real money in a
single mistake. The chain above is what makes it safe; do not ship a version
that skips any link in it. If we have to choose between "ship faster" and
"safer chain", choose chain every time.
