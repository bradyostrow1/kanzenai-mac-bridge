# Direct vendor affiliate signups — browser only

Vendors from `lib/affiliates.ts` that have a public self-serve affiliate signup page. Open each URL, fill the form, done. No outreach needed.

**Order them by commission potential.** Hit the top 6 first (15-min total).

---

## Tier A — best commission / fastest approval

| Vendor | Slug | Affiliate URL | Commission | Network |
|---|---|---|---|---|
| **Bench** | bench | https://bench.co/partners | $100/signup | Direct |
| **Smith.ai** | smith-ai | https://smith.ai/affiliates | $100/signup | Direct |
| **Constant Contact** | constant-contact | https://www.constantcontact.com/affiliate-program | $5/lead + $105/sale | Direct |
| **ActiveCampaign** | activecampaign | (see tier-1/activecampaign.md — primary outreach) | 30% recurring | Direct |
| **Calendly** | calendly | https://calendly.com/partners | varies | Direct/Impact |
| **BoxBrownie** | boxbrownie | https://www.boxbrownie.com/affiliate-program | 20% | Direct |

## Tier B — apply via Awin once you're approved there

These run their programs INSIDE Awin's marketplace. Apply to them only after Awin approves your publisher account (see networks/awin.md).

| Vendor | Slug | Network search term | Commission |
|---|---|---|---|
| BombBomb | bombbomb | "BombBomb" | varies |
| Otter.ai | otter | "Otter" | varies |
| Mailchimp | mailchimp | "Mailchimp" (may be removed) | varies |
| ConvertKit / Kit | (n/a, not in registry) | "Kit" or "ConvertKit" | 30% recurring |

## Tier C — apply via ShareASale once approved there

| Vendor | Slug | Network search term | Commission |
|---|---|---|---|
| ShowingTime | showingtime | "ShowingTime" | varies |
| Other CRM tools | various | "CRM real estate" | varies |

## Tier D — apply via Impact once approved there

| Vendor | Slug | Network search term | Commission |
|---|---|---|---|
| Market Leader | marketleader | "Market Leader" (Constellation) | varies |
| Brivity | brivity | "Brivity" | $150/signup |

## Tier E — productivity adjacent (smaller commission but easy approval)

| Vendor | Slug | URL | Commission |
|---|---|---|---|
| QuickBooks | quickbooks | https://quickbooks.intuit.com/partners/ | varies |
| Xero | xero | https://www.xero.com/us/partner-programs/ | varies |
| Otter.ai (direct) | otter | https://otter.ai/affiliate | $30/paid signup |

## Tier F — likely requires email (build Tier-2 outreach later)

These don't have public affiliate forms. They're worth a Round-2 outreach campaign once Tier-1 approvals start landing — having one approved affiliate gives more credibility for the next pitch.

- Lofty
- Wise Agent
- LionDesk
- Mojo Selling Solutions
- Vulcan7
- RedX
- Dotloop
- Brokermint
- Paperless Pipeline
- Placester
- Aryeo
- Cloud CMA
- HouseCanary
- Remine
- HomeSpotter
- Homesnap
- Rela
- Realync
- VHT Studios
- ShowMojo
- Curb Hero
- Open Home Pro
- Spacio
- Block Party
- Espresso Agent
- Structurely
- Verse.io
- Ylopo
- Conversion Monster
- Agentology
- Vyral Marketing

## No public affiliate program (skip)

- Claude (Anthropic) — no public affiliate program
- OpenAI / ChatGPT — no public affiliate program
- Zillow Premier Agent — direct lead-buy, not affiliate
- Google Calendar — free product
- SentriLock — controlled by REALTORS associations
- SUPRA eKey — controlled by associations

## Once you have ANY publisher ID

Send me the ID + network and I'll wire the URL into `lib/affiliates.ts` and update `status: "live"` so the next deploy ships real tracked links. Then I'll build `vendor-approval-tracker` (Bot #11 from gameplan) which polls each network daily and updates statuses automatically — closing the loop without you having to touch the registry every time an approval lands.
