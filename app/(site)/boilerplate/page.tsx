import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "AffiliateAI Boilerplate — the Next.js stack that auto-runs KanzenAI",
  description: "The exact Next.js + Claude + Vercel codebase that powers KanzenAI. Auto-writes articles, auto-tweets, auto-replies. Deploy in 10 minutes for $149.",
};

export default function BoilerplatePage() {
  return (
    <main className="min-h-screen bg-bg-0 text-ink-0">
      {/* HERO */}
      <section className="border-b border-rule">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 mb-4">
            完全 · ONE-TIME PURCHASE · $149
          </div>
          <h1 className="display text-5xl sm:text-7xl leading-[0.95] mb-6">
            The Next.js stack<br />that built KanzenAI.
          </h1>
          <p className="text-ink-1 text-xl leading-relaxed font-serif italic max-w-2xl mb-8">
            22 articles auto-published. 5 tweets/day. Email capture + welcome series. Dashboard with live bot orchestration. Built in days, not months. Ship yours this weekend.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="https://gumroad.com/l/icchv"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center gap-2 bg-ink-0 text-bg-0 px-7 py-4 text-[14px] font-semibold uppercase tracking-[0.12em] hover:bg-ink-1 transition"
            >
              Buy on Gumroad — $149
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="#whats-inside" className="inline-flex items-center justify-center gap-2 border border-ink-0 px-7 py-4 text-[14px] font-semibold uppercase tracking-[0.12em] hover:bg-bg-1 transition">
              See what's inside
            </a>
          </div>
          <div className="mt-8 text-[12px] text-ink-2">
            Pays for itself with one affiliate signup. Lifetime updates. Refund within 7 days if it doesn't ship.
          </div>
        </div>
      </section>

      {/* WHAT'S INSIDE */}
      <section id="whats-inside" className="border-b border-rule">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 mb-4">中身 · WHAT'S INSIDE</div>
          <h2 className="display text-4xl mb-12">Everything I built. None of the placeholders.</h2>

          <div className="space-y-10">
            <Feature
              title="Daily AI article writer"
              body="Claude Sonnet 4.5 auto-writes 3 in-depth, vendor-sourced review articles every morning at 8 AM. Picks topics based on coverage gaps in your existing content. Cost: ~$0.45/day."
            />
            <Feature
              title="X auto-poster + 5-tweet threads"
              body="Every new article auto-tweets in your brand voice (pricing-reveal, comparison, or contrarian template). Daily 5-tweet thread at 11 AM. Optional auto-reply bot (kept off by default — it's expensive)."
            />
            <Feature
              title="Pexels auto-hero images"
              body="Writer pulls a unique, thematically-relevant hero image per article from Pexels API. Free. No two articles share an image. Audit bot catches it if they do."
            />
            <Feature
              title="Email capture + welcome flow"
              body="Drop-in EmailCaptureForm component, sticky inline + footer variants. POSTs to /api/subscribe which adds to Resend audience and sends a branded welcome email with your lead magnet."
            />
            <Feature
              title="Dashboard with live bot orchestration"
              body="localhost:5050/dashboard — every metric (visitors, subscribers, X followers, clicks, impressions), every bot, every job. Chat with the system in plain English (calls audit/write/deploy tools)."
            />
            <Feature
              title="9 launchd cron jobs pre-configured"
              body="audit, healthcheck, auto-deploy, daily-article, x-thread, followups (and optional x-analytics, auto-reply, x-monitor). One command to install all of them."
            />
            <Feature
              title="Affiliate link tracking"
              body="/go/<vendor> redirects log every click. Per-vendor + per-article attribution. Convert all your article URLs to /go/ format with a single script."
            />
            <Feature
              title="Audit bot (11 checks)"
              body="Catches duplicate hero images, near-duplicate titles, missing schema, thin content, placeholder URLs, production downtime. Runs daily 7 AM. Self-heals when possible."
            />
          </div>
        </div>
      </section>

      {/* PROOF */}
      <section className="border-b border-rule bg-bg-1">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 mb-4">証拠 · PROOF</div>
          <h2 className="display text-4xl mb-8">It's running right now.</h2>
          <p className="text-ink-1 text-[17px] leading-relaxed mb-8 max-w-2xl">
            KanzenAI.com is the live demo. 22 articles, daily auto-publishing, X bots active, dashboard humming. Every line of code you'd buy is what runs that site.
          </p>
          <Link href="/" className="inline-flex items-center gap-2 underline hover:text-ink-2 text-[15px]">
            Tour kanzenai.com →
          </Link>
        </div>
      </section>

      {/* HONEST SECTION */}
      <section className="border-b border-rule">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-[10px] uppercase tracking-[0.22em] text-ink-2 mb-4">正直 · STRAIGHT TALK</div>
          <h2 className="display text-4xl mb-8">What you still have to do.</h2>
          <ul className="space-y-4 text-[16px] leading-relaxed text-ink-1">
            <li className="flex gap-3"><span className="text-ink-3">→</span> Bring your own Anthropic, Resend, Pexels, and Vercel keys (all have free tiers).</li>
            <li className="flex gap-3"><span className="text-ink-3">→</span> Pick your niche. Real estate is hard-coded as the example — swap the topic/brand strings.</li>
            <li className="flex gap-3"><span className="text-ink-3">→</span> Apply to affiliate programs in your niche. The system tracks them but can't approve them for you.</li>
            <li className="flex gap-3"><span className="text-ink-3">→</span> X API requires <strong>credits</strong>, not free. Posting is essentially free ($0.0001/post). Search/auto-reply is expensive ($1-5/day). I'll show you which knobs to leave off.</li>
            <li className="flex gap-3"><span className="text-ink-3">→</span> Traffic still takes weeks. The boilerplate doesn't make you visitors — it makes you a publishing engine.</li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="display text-4xl mb-6">$149. Ship by Sunday.</h2>
          <p className="text-ink-2 text-[15px] mb-8 max-w-md mx-auto">
            One-time. Lifetime updates. 7-day refund if it doesn't deploy clean.
          </p>
          <a
            href="https://gumroad.com/l/icchv"
            target="_blank"
            rel="noopener"
            className="inline-flex items-center justify-center gap-2 bg-ink-0 text-bg-0 px-8 py-4 text-[14px] font-semibold uppercase tracking-[0.12em] hover:bg-ink-1 transition"
          >
            Buy on Gumroad
            <ArrowRight className="w-4 h-4" />
          </a>
          <div className="mt-6 text-[12px] text-ink-3">
            Built by Brady Ostrow · founder of KanzenAI · ships from kanzenai.com
          </div>
        </div>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="border-l-2 border-ink-0 pl-5">
      <h3 className="display text-2xl mb-2">{title}</h3>
      <p className="text-ink-1 leading-relaxed text-[15.5px]">{body}</p>
    </div>
  );
}
