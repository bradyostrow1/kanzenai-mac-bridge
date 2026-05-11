/**
 * Brand assets page — visit /brand to see and download the logo at high res.
 */
export default function BrandPage() {
  return (
    <main className="min-h-screen bg-bg-0 flex flex-col items-center justify-center p-10">
      <div className="text-[11px] uppercase tracking-[0.22em] text-ink-2 font-semibold mb-8">
        ブランド · KanzenAI brand
      </div>

      <div className="space-y-12 w-full max-w-3xl">
        {/* SYMBOL MARK — Enso */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-3 mb-3">
            Symbol mark · Enso (円相) — zen circle of completeness
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="aspect-square bg-bg-0 border border-rule flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark.svg" alt="KanzenAI mark" className="w-2/3" />
            </div>
            <div className="aspect-square bg-[#0a0a0a] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-mark-dark.svg" alt="KanzenAI mark dark" className="w-2/3" />
            </div>
          </div>
          <div className="mt-3 text-[11px] text-ink-2 leading-relaxed">
            One brushstroke. Same conceptual root as 完全 (kanzen) — completeness.
            Distinctive, scales to any size, works as favicon at 16×16 and as billboard at 800×800.
          </div>
        </div>

        {/* Wordmark on cream */}
        <div className="bg-bg-0 px-12 py-16 border border-rule">
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-3 mb-6">
            Wordmark · light
          </div>
          <h1 className="display text-[88px] sm:text-[120px] leading-none text-ink-0">
            KanzenAI
          </h1>
        </div>

        {/* Wordmark on dark */}
        <div className="bg-[#0a0a0a] px-12 py-16">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#a3a3a3] mb-6">
            Wordmark · dark
          </div>
          <h1 className="display text-[88px] sm:text-[120px] leading-none text-[#f0eee9]">
            KanzenAI
          </h1>
        </div>

        {/* Lockup: mark + wordmark together */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-3 mb-3">
            Lockup · mark + wordmark
          </div>
          <div className="bg-bg-0 px-12 py-16 border border-rule flex items-center gap-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="" className="w-32 h-32" />
            <h1 className="display text-[88px] leading-none text-ink-0">KanzenAI</h1>
          </div>
        </div>

        {/* Kanji alt */}
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-ink-3 mb-3">
            Alt mark · 完 kanji
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="aspect-square bg-bg-0 border border-rule flex items-center justify-center">
              <span className="display text-[120px] leading-none text-ink-0">完</span>
            </div>
            <div className="aspect-square bg-[#0a0a0a] flex items-center justify-center">
              <span className="display text-[120px] leading-none text-[#f0eee9]">完</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 text-[12px] text-ink-2 text-center max-w-md">
        <strong className="text-ink-0">Downloads:</strong>{" "}
        <a href="/logo-mark.svg" className="underline">mark (light)</a> ·{" "}
        <a href="/logo-mark-dark.svg" className="underline">mark (dark)</a> ·{" "}
        <a href="/logo-mark-transparent.svg" className="underline">mark (transparent)</a> ·{" "}
        <a href="/logo.svg" className="underline">wordmark</a>
      </div>
    </main>
  );
}
