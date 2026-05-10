/**
 * Vendor outreach email templates.
 *
 * The dashboard outreach feature reads these and lets Brady send each one
 * (after review) via Resend. Status is tracked locally in .audit/outreach.log
 * so we know which vendors have been emailed, when, and the response.
 */

export type OutreachEmail = {
  /** Stable id used for status tracking */
  id: string;
  /** Vendor / company name */
  vendor: string;
  /** Affiliate slug from lib/affiliates.ts (for cross-reference) */
  affiliateSlug: string;
  /** Recipient email */
  to: string;
  /** Subject line */
  subject: string;
  /** Plain-text body — supports {{var}} substitution before send */
  body: string;
  /** Approximate commission, for the dashboard */
  commission: string;
  /** Priority: 1 = send first */
  priority: number;
};

export const OUTREACH_EMAILS: OutreachEmail[] = [
  {
    id: "real-geeks-2026-05",
    vendor: "Real Geeks",
    affiliateSlug: "real-geeks",
    to: "partnerships@realgeeks.com",
    subject: "KanzenAI — affiliate partnership inquiry",
    body: `Hi Real Geeks team,

I run KanzenAI (https://kanzenai.com) — an independent
review site covering tools real estate agents actually use:
CRMs, IDX websites, lead-gen, and AI assistants.

We've already published a review of Real Geeks in our IDX
roundup (kanzenai.com/articles/best-idx-websites-real-estate-agents-2026)
and a feature in our lead-gen analysis — Real Geeks ranks as
our #2 best price-to-performance pick.

Could you point me to your affiliate program signup, or let me
know who handles partnerships? Happy to share traffic data,
audience info, or anything else helpful.

Thanks,
Brady Ostrow
KanzenAI Editorial
hello@kanzenai.com
https://kanzenai.com`,
    commission: "$200/signup",
    priority: 1,
  },
  {
    id: "follow-up-boss-2026-05",
    vendor: "Follow Up Boss",
    affiliateSlug: "follow-up-boss",
    to: "sales@followupboss.com",
    subject: "KanzenAI affiliate / partner program access",
    body: `Hi Follow Up Boss team,

I run KanzenAI (https://kanzenai.com), an independent
review site for working real estate agents. Follow Up Boss is
featured prominently across our content — it's our top pick
for solo agents and small teams in our CRM roundup.

Reviews already published:
• kanzenai.com/articles/best-crm-real-estate-agents-2026
• kanzenai.com/compare/follow-up-boss-vs-lofty
• Mentioned in 4 other articles as the recommended CRM

I'd like to apply to your affiliate or partner program so my
links can attribute correctly. Could you point me to the
right signup, or let me know who handles new partner
applications?

Thanks,
Brady Ostrow
KanzenAI Editorial
hello@kanzenai.com
https://kanzenai.com`,
    commission: "$200/signup",
    priority: 2,
  },
  {
    id: "bombbomb-2026-05",
    vendor: "BombBomb",
    affiliateSlug: "bombbomb",
    to: "partners@bombbomb.com",
    subject: "KanzenAI affiliate inquiry — BombBomb",
    body: `Hi BombBomb team,

I run KanzenAI (https://kanzenai.com) — independent
reviews of tools for working real estate agents. BombBomb is
recommended in two of our articles (lead-gen + AI workflow
stack) as our pick for video email.

Could you point me to your affiliate or referral program
signup? I'd like to make sure my links attribute properly.

Thanks,
Brady Ostrow
KanzenAI Editorial
hello@kanzenai.com
https://kanzenai.com`,
    commission: "$30/signup",
    priority: 3,
  },
  {
    id: "vulcan7-2026-05",
    vendor: "Vulcan7",
    affiliateSlug: "vulcan7",
    to: "info@vulcan7.com",
    subject: "KanzenAI partnership inquiry — Vulcan7",
    body: `Hi Vulcan7 team,

I run KanzenAI (https://kanzenai.com) — independent
review site for working real estate agents. Vulcan7 is our #1
recommended dialer for expired-listing and FSBO prospectors:

• kanzenai.com/articles/best-dialers-real-estate-agents-2026
• kanzenai.com/compare/mojo-vs-vulcan7

I'd like to apply to your affiliate or referral program. Who
handles partner applications, and what's the best way to
sign up?

Thanks,
Brady Ostrow
KanzenAI Editorial
hello@kanzenai.com
https://kanzenai.com`,
    commission: "$75/signup",
    priority: 4,
  },
];
