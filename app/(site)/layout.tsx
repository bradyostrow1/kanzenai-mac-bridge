import Link from "next/link";
import type { ReactNode } from "react";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}

function Header() {
  return (
    <header className="bg-bg-0">
      <div className="max-w-[1400px] mx-auto px-8 py-6 flex items-center justify-between">
        <Link href="/" className="display text-2xl text-ink-0">
          KanzenAI
        </Link>
        <nav className="hidden sm:flex items-center gap-8 text-[15px] text-ink-0">
          <Link href="/category/crm" className="hover:opacity-60">CRM</Link>
          <Link href="/category/lead-gen" className="hover:opacity-60">Lead Gen</Link>
          <Link href="/category/ai-tools" className="hover:opacity-60">AI Tools</Link>
          <Link href="/compare" className="hover:opacity-60">Compare</Link>
          <Link href="/about" className="hover:opacity-60">About</Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-rule mt-32 bg-bg-0">
      <div className="max-w-[1400px] mx-auto px-8 py-14 text-[14px] text-ink-1 leading-relaxed">
        <div className="display text-xl text-ink-0">KanzenAI</div>
        <p className="mt-3 max-w-2xl">
          Complete intelligence for solopreneurs, creators, and small businesses picking AI tools. We test the tools, compare
          honestly, and earn commission only when you sign up — at no cost to you.
        </p>
        <div className="mt-6 flex gap-7 text-[13px]">
          <Link href="/about" className="hover:opacity-60">About</Link>
          <Link href="/disclosure" className="hover:opacity-60">Affiliate disclosure</Link>
          <Link href="/privacy" className="hover:opacity-60">Privacy</Link>
        </div>
        <div className="mt-6 text-ink-3 text-[12px]">© {new Date().getFullYear()} KanzenAI · Independent editorial</div>
      </div>
    </footer>
  );
}
