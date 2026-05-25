import Link from "next/link";

export const metadata = {
  title: "Privacy policy · KanzenAI",
  description: "What KanzenAI collects, what we don't, and how to reach us about your data.",
};

export default function Privacy() {
  return (
    <main className="max-w-3xl mx-auto px-5 py-16">
      <Link href="/" className="text-[13px] text-ink-2 hover:text-ink-0">← Home</Link>

      <div className="mt-6 text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold">
        個人情報 · Privacy
      </div>
      <h1 className="display text-[56px] sm:text-[80px] leading-[0.95] text-ink-0 mt-3">
        Privacy policy
      </h1>
      <p className="mt-3 text-ink-2 text-[13px]">Last updated: May 9, 2026</p>

      <div className="prose prose-lg max-w-none mt-8 prose-headings:tracking-tight prose-h2:text-2xl prose-h2:mt-12 prose-p:text-ink-0 prose-p:leading-relaxed prose-strong:text-ink-0">
        <p className="text-xl font-serif italic text-ink-1">
          We collect as little as possible, sell nothing, and tell you exactly what happens when you click an affiliate link.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Anonymous analytics</strong> — pages viewed, country-level location, referrer, device type. We use this to understand which articles people read. No personal identification.
          </li>
          <li>
            <strong>Email, when you give it to us</strong> — only if you subscribe to our newsletter. Used to send you new reviews. Never sold or shared.
          </li>
          <li>
            <strong>Affiliate click data</strong> — when you click an affiliate link, the vendor (e.g. Follow Up Boss) is told the click came from us, so we get credit for the referral. The vendor handles your data per their privacy policy from that point forward.
          </li>
        </ul>

        <h2>What we don't collect</h2>
        <ul>
          <li>Names, addresses, phone numbers (unless you email us first)</li>
          <li>Professional license numbers, account IDs, or any business-credential data</li>
          <li>Payment info — we never take payments directly</li>
          <li>Behavior tracking across other sites</li>
        </ul>

        <h2>Cookies</h2>
        <p>
          We use cookies for two things: (1) anonymous analytics, and (2) attributing affiliate
          clicks. You can disable cookies in your browser; the site will still work, but vendors
          may not credit us for referrals (which doesn't affect you, only us).
        </p>

        <h2>Third parties</h2>
        <p>
          We use a small number of third-party services that may receive request data:
        </p>
        <ul>
          <li>Hosting — Vercel</li>
          <li>Analytics — privacy-respecting (no fingerprinting, no cross-site tracking)</li>
          <li>Email — when you subscribe to our newsletter</li>
        </ul>

        <h2>Your rights</h2>
        <p>
          If you've given us your email and want it deleted, email{" "}
          <a href="mailto:hello@kanzenai.com" className="underline">hello@kanzenai.com</a>{" "}
          with the subject "Delete my data" and we'll remove it within 7 days. We comply with GDPR
          and CCPA data-subject access requests.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If this policy changes materially, we'll update the date at the top and note what
          changed. We won't quietly weaken your privacy.
        </p>
      </div>
    </main>
  );
}
