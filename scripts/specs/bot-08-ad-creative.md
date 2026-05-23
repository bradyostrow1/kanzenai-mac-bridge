# Bot 8 · AD CREATIVE — spec

**Status:** ⬜ SPECCED, NOT BUILT.
**Activate when:** ≥1 affiliate program is `status: "live"` in
`lib/affiliates.ts` AND it has shown ≥1 confirmed commission in
`money_ledger`. Don't generate creative for $0 funnels.

---

## What it does

Generates Meta ad creative — both copy variants and image variants — for the
articles that are already converting on Kanzen. The output is a folder of
ready-to-import assets that Bot 9 (Meta Poster) consumes.

It is the **creative shop**, not the media buyer. It never touches Meta's API
or spends money.

## Inputs

1. **Top-performing articles** — pulled from `/api/dashboard/clicks` (existing
   route) and the `vendor-approval-tracker` event log. "Top" = highest
   click-through to a `status: "live"` vendor in the past 14 days.
2. **Brand voice rules** — pulled from `app/(site)/page.tsx` taglines + the
   article's own headline/lede. Keep voice consistent.
3. **Image style** — Brady's owned image gen first (Nano Banana etc. — check
   what's in MEMORY.md before spinning anything up). Pexels API as fallback
   for stock-style hero images. Never fall through to a paid model without
   the CFO bot approving the spend.

## Output

`.audit/ad-creative/<article-slug>/<YYYY-MM-DD>/`
```
hook-1.txt          ← copy variant 1 (≤125 chars, primary text)
hook-2.txt          ← copy variant 2
hook-3.txt          ← copy variant 3
headline-1.txt      ← headline variant 1 (≤40 chars)
headline-2.txt
description-1.txt   ← description variant (≤30 chars)
image-1.jpg         ← 1200×628 (Meta single-image feed)
image-2.jpg         ← 1080×1080 (square)
image-3.jpg         ← 1080×1920 (story/reel)
brief.json          ← target article URL, UTM params, vendor, audience, est. CTR floor
```

## Stack + keys

- `ANTHROPIC_API_KEY` (copy generation — already present)
- `PEXELS_API_KEY` (stock fallback — already present)
- Owned image gen TBD — Brady to confirm which (Nano Banana / fal.ai / etc.)
  before this gets built. NO new subscription spend without CFO approval.

## Schedule

Once enabled: 1× per week (e.g. Sundays at 8 AM ET). Picks the top 3 articles
by 14-day click-through-to-live. Generates 3 copy + 3 image variants each.
Total per run: ~9 ad units. Cost target: < $0.50/week in Claude tokens.

## Approval gate

✅ Creative generation is FREE (Claude tokens, owned image gen). Auto-runs.
🔴 Asset PUBLISHING (handing to Bot 9) is the spend gate. Bot 8 only writes
files to disk; Bot 9 is where the money chain kicks in.

## Money chain

Bot 8 has no money path of its own. It writes files. Earnings come from clicks
on the link the creative drives to, which already flows through:
`/go/<vendor>` redirect → network attribution → `vendor-approval-tracker`
earnings poll → `money_ledger` (Brady's decision pending: shared 808 Supabase
or Kanzen-local).

## Build checklist (when ready)

- [ ] Pull top-3 articles by 14-day CTR-to-live from clicks route
- [ ] Build Claude prompt: brand voice + article context + 3 copy frames
      (hook-curiosity, pricing-reveal, comparison-loser)
- [ ] Image gen wrapper that prefers owned tool, falls back to Pexels
- [ ] Write outputs to disk; emit a manifest `brief.json` per article
- [ ] Telegram alert when a week's batch is ready for Bot 9 to consume
- [ ] Wire into `scheduler.ts` as a weekly job; DO NOT auto-enable
- [ ] Document in this file how to flip from disabled → enabled

## Risk

Low. This bot is pure CPU + tokens + disk. The only failure mode is
generating bad creative — caught by Brady reviewing the manifest before
Bot 9 ever sees it.
