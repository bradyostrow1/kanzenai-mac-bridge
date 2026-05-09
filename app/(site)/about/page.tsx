import Link from "next/link";

export const metadata = {
  title: "About · KanzenAI",
  description: "Why we built KanzenAI — and how we test, score, and choose what makes the cut.",
};

export default function About() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16">
      <Link href="/" className="text-[13px] text-ink-2 hover:text-ink-0">← Home</Link>

      <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
        編集について · About the editorial
      </div>
      <h1 className="display text-[56px] sm:text-[80px] leading-[0.95] text-ink-0 mt-3">
        About KanzenAI
      </h1>

      <div className="prose prose-lg max-w-none mt-8 prose-headings:tracking-tight prose-h2:text-2xl prose-h2:mt-12 prose-p:text-ink-0 prose-p:leading-relaxed prose-strong:text-ink-0">
        <p className="text-xl font-serif italic text-ink-1">
          KanzenAI (完全 — "complete") is the intelligence brief for working real estate agents. We test the tools, write the reviews, and earn commission only when you sign up — at no cost to you.
        </p>

        <h2>What we are</h2>
        <p>
          An independent review desk for the software that real estate agents touch every day —
          CRMs, AI assistants, lead-gen platforms, transaction tools. We don't take vendor money
          to bump scores. We don't run sponsored reviews. We don't pretend tools we haven't used
          are good.
        </p>

        <h2>How we test</h2>
        <p>
          Every review runs through working agents. Each tool gets at least 4 weeks of real lead
          flow — same Zillow inquiries, same Facebook leads, same MLS data — and we measure:
        </p>
        <ul>
          <li>Time from lead-source webhook to first agent touch</li>
          <li>Drip sequence reliability (does the system actually fire on day 3, 7, 14?)</li>
          <li>Mobile app speed at 9pm when an offer just came in</li>
          <li>Integration depth — MLS, IDX, dialers, transaction tools</li>
          <li>Team handoffs — agent → ISA → coordinator without dropping anything</li>
        </ul>

        <h2>How we make money</h2>
        <p>
          Affiliate commissions. When you sign up for a tool through our links, the vendor pays us
          a referral fee. The fee size doesn't influence the score — Follow Up Boss pays $200,
          Lofty pays $300, BombBomb pays $30, and we'd recommend the same picks if every commission
          was identical.
        </p>
        <p>
          If you want the longer version of how we handle conflicts and scoring, read our{" "}
          <Link href="/disclosure" className="underline">full affiliate disclosure</Link>.
        </p>

        <h2>What we won't do</h2>
        <ul>
          <li>Take vendor money to write a positive review</li>
          <li>Score a tool we haven't actually run leads through</li>
          <li>Recommend something we wouldn't use ourselves</li>
          <li>Bury negative findings to protect a commission</li>
        </ul>

        <h2>Reach us</h2>
        <p>
          Email <a href="mailto:hello@kanzenai.com" className="underline">hello@kanzenai.com</a>{" "}
          for tips, corrections, or to suggest a tool we should test.
        </p>
      </div>
    </main>
  );
}
