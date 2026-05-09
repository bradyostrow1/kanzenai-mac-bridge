import Link from "next/link";

export const metadata = {
  title: "Affiliate disclosure · KanzenAI",
  description: "How KanzenAI makes money, what it means for you, and what we won't do.",
};

export default function Disclosure() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16">
      <Link href="/" className="text-[13px] text-ink-2 hover:text-ink-0">← Home</Link>

      <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
        透明性 · Full transparency
      </div>
      <h1 className="display text-[56px] sm:text-[80px] leading-[0.95] text-ink-0 mt-3">
        Affiliate disclosure
      </h1>

      <div className="prose prose-lg max-w-none mt-8 prose-headings:tracking-tight prose-h2:text-2xl prose-h2:mt-12 prose-p:text-ink-0 prose-p:leading-relaxed prose-strong:text-ink-0">
        <p className="text-xl font-serif italic text-ink-1">
          The short version: links on this site that point to vendors are affiliate links. If you sign up through them, we get paid. You don't pay a cent more. The commission size doesn't influence our scoring.
        </p>

        <h2>FTC compliance</h2>
        <p>
          KanzenAI participates in affiliate programs operated by the vendors we review (Follow Up
          Boss, Lofty, kvCORE, Real Geeks, BombBomb, Otter.ai, Spaceflow, Claude, ChatGPT, and
          others). When you click a link to one of these vendors and complete a signup, we receive
          a referral commission. This is disclosed at the bottom of every article and comparison
          page in compliance with FTC 16 CFR Part 255.
        </p>

        <h2>How commissions work</h2>
        <ul>
          <li><strong>You pay nothing extra.</strong> Vendor pricing is identical whether you click our link or go direct.</li>
          <li><strong>Commission size varies.</strong> Some vendors pay $30 one-time. Others pay $300 per signup or recurring monthly.</li>
          <li><strong>It does not affect our scoring.</strong> We've recommended $20/mo tools over $1,200/mo tools in the same category. We've also panned high-commission products.</li>
        </ul>

        <h2>What we don't do</h2>
        <ul>
          <li>Take direct payment from vendors to publish a review</li>
          <li>Allow vendors to edit, preview, or veto our reviews before publication</li>
          <li>Adjust scoring or rankings based on commission tier</li>
          <li>Run sponsored content disguised as independent reviews</li>
          <li>Recommend products we haven't actually tested with real workflow</li>
        </ul>

        <h2>How we handle conflicts</h2>
        <p>
          If a vendor offers a higher commission tier or exclusive partnership, we either decline
          or disclose it explicitly within the article. If a vendor pulls their affiliate program,
          we leave the review live and remove the broken links — we don't unpublish negative
          coverage.
        </p>

        <h2>Editorial independence</h2>
        <p>
          Every article is written and reviewed by our editorial team. No vendor sees a review
          before publication. Corrections are made openly with a "Updated" date stamp; we don't
          memory-hole mistakes.
        </p>

        <h2>Questions</h2>
        <p>
          Email <a href="mailto:hello@kanzenai.com" className="underline">hello@kanzenai.com</a>{" "}
          if you have questions about a specific affiliate relationship or want documentation of a
          commission rate. We'll share what we can.
        </p>
      </div>
    </main>
  );
}
