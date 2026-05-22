# Awin signup (finish what's already partial)

**URL:** https://ui.awin.com/affiliate-signup
**Status from gameplan:** partial — needs $5 deposit, Content / Comparison & Review category
**Why first:** Awin has Bench, BombBomb, Otter.ai, Constant Contact, ConvertKit, and more of our vendors all under one network. One signup unlocks several at once.
**Time:** 10 min

## Form fill — exact answers

| Field | Answer |
|---|---|
| Website URL | https://kanzenai.com |
| Promotion type | Content / Comparison & Review |
| Country | United States |
| Currency | USD |
| Tax/business | Sole proprietor / your legal name |
| Description (~150 chars) | "Vendor-neutral editorial review hub covering AI and SaaS tools for working real estate agents. Daily new reviews, transparent pricing, automated publishing." |
| Promotion methods | Content marketing, comparison reviews, email newsletter, X/Twitter |
| Monthly traffic estimate | 200–500 (truthful for now) |
| Niche | Real estate professionals / property tech |

## $5 deposit
Pay with the same card you use for Anthropic / Pexels / X spend. The $5 is refunded against your first commission.

## After approval — programs to immediately request inside Awin
Once Awin approves the publisher account, search and apply to these programs (each gives an approval back inside the platform, separate from the network approval):
- Bench (bookkeeping) — $100/signup
- ConvertKit / Kit (email marketing) — 30% recurring
- BombBomb (video email)
- Otter.ai (transcripts)
- Constant Contact (email)
- Mailchimp (email)
- Calendly (scheduling)
- Acuity Scheduling
- (Search "real estate" in their marketplace — surfaces 15–30 more)

## Update lib/affiliates.ts once approved
For each approved program, Awin gives you a deep-link generator. Replace the `?ref=kanzenai` URL with their tracked URL:

```ts
// Before
"bench": { url: "https://bench.co/?ref=kanzenai", ..., status: "placeholder" }
// After
"bench": { url: "https://www.awin1.com/cread.php?awinmid=XXXXX&awinaffid=YYYYY&clickref=&p=https%3A%2F%2Fbench.co", ..., status: "live" }
```

Tell me the moment you have your Awin publisher ID (the `awinaffid`) — I'll write the vendor-approval-tracker bot to auto-update statuses from Awin's reporting API.
