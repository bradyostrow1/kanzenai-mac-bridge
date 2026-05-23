# Bot 12 · IMAGE PRODUCER — spec

**Status:** 🟡 partially built — v0 (lib/images.ts + dynamic OG cards) shipped.
**Activate when:** Brady names which owned image-gen tool he wants wired
(Nano Banana? fal.ai? Replicate? Other?). The architecture below has a
clean adapter slot for that decision; until then, Pexels carries v0.

This bot exists because every Kanzen article today is a wall of text after
the hero, every hero is a Pexels stock photo that 10,000 other sites also
use, and every social share gets a generic "title + raw hero" preview that
nothing distinguishes from any competitor. Bot 12 closes those three gaps.

---

## v0 — what's already shipped

| Piece | File | Behavior |
|---|---|---|
| Hero gen library | `lib/images.ts` | Pexels client + `generateHeroFromPexels()` + `pickFallbackFromPool()` + `ImageAdapter` interface for future owned-gen plugins. Pure refactor of the writer's existing logic. |
| Dynamic OG cards | `app/(site)/articles/[slug]/opengraph-image.tsx` | Per-article 1200×630 branded card using built-in `next/og`. Kanzen wordmark + article title + category badge + domain. Auto-generated at build time + on-demand. Replaces the raw-hero OG image. |
| Writer integration | `scripts/write-article.ts` | Calls into `lib/images.ts` (no behavior change vs. before). |

v0 already gives Kanzen:
- Branded social previews on every X post / LinkedIn share / Slack unfurl
- A reusable image library the rest of the bot roster can call
- A clear adapter interface waiting for one decision from Brady

## v1 — what this spec finishes (when activated)

### 1. Owned image-gen adapter (DECISION GATE)
`lib/images.ts` exports `ImageAdapter` — `{ name, generate(brief) → Promise<Buffer> }`. Add one file under `lib/image-adapters/`:
- `nano-banana.ts` — if Brady picks Nano Banana
- `fal.ts` — if he picks fal.ai
- `replicate.ts` — Replicate
- any other

The adapter returns a JPEG/PNG buffer for a given `brief` (title, topic, vendor keywords). Bot 12 tries the owned adapter first, falls back to Pexels on error / no key. Same fallback chain the writer uses today.

### 2. Inline images in articles
Picks 2–3 thematic Pexels (or owned-gen) images per article and inserts them as new sections. Article JSON already has a `sections` array — extend the shape with a new block type:
```json
{ "type": "image", "src": "/articles/<slug>-inline-1.jpg", "caption": "...", "credit": "..." }
```
Render template (`app/(site)/articles/[slug]/page.tsx`) gets a small `case "image":` branch in its block switch.

Cadence: run as a **post-write hook** for newly created articles, AND as `--backfill` for older ones (gated, opt-in — touches 30 article JSONs).

### 3. Hero quality scoring
Current writer random-picks from Pexels top-8 — sometimes returns a marble countertop for a CRM article. Add a Claude scoring pass: feed it the article title + 3–5 candidate image descriptions (Pexels returns photo `alt`), pick the most thematically tight. ~$0.001/article overhead.

### 4. WebP + size optimization
Saved JPGs are 200–400 KB each. Convert to WebP at ~85 quality, target ≤80 KB. Requires `sharp` (native module — small install). Update render to use `<picture>` with WebP first + JPG fallback. LCP wins are real.

### 5. Vercel Blob migration (optional)
Once article count > 100, `public/articles/` ships ~20 MB of images in every deploy. Move to Vercel Blob — same `blob.put()` pattern 808 uses. Brady has the token in MEMORY.

## Architecture

```
                  ┌──────────────────────────────────┐
                  │  Owned image-gen adapter (TBD)   │
                  │  e.g. lib/image-adapters/...     │
                  └──────────────┬───────────────────┘
                                 ↓ (try first)
lib/images.ts ──→  ImageAdapter chain:
                     1. owned adapter (if key + adapter present)
                     2. Pexels (always present)
                     3. on-disk pool (fallback of last resort)
                  ↓
                  generateHeroFromBrief({ title, topic, keywords })
                  generateInlineSetFromBrief(brief, count)
                  ↓
                  ┌──────────────┴──────────────┐
                  ↓                             ↓
scripts/x-image-producer.ts          scripts/write-article.ts
  (Bot 12 — daily +                    (in-line during article write —
   --backfill for old articles)         hero only, as it does today)
                  ↓
                  writes to public/articles/<slug>-hero.jpg
                          and public/articles/<slug>-inline-N.jpg
                  edits content/articles/<slug>.json to point at them
                          + insert image sections
                  ↓
                  app/(site)/articles/[slug]/opengraph-image.tsx
                          consumes article + hero → branded 1200×630 PNG
```

## Schedule (when v1 enabled)

- **On article write** (Bot 1 → Bot 12 post-hook) — hero + 2–3 inline images at write time.
- **Daily 4 AM** (between night and Bot 10 audit at 7 AM) — `--backfill` mode: find any article lacking inline images, fill them. Hard cap: 5 articles/day to keep Pexels under daily request budget.
- **On demand** — `npm run x-image-producer -- --slug <slug> --regenerate` for one-off fixes.

## Stack + keys

- `PEXELS_API_KEY` — already present
- `ANTHROPIC_API_KEY` — already present, used for hero quality scoring + image-section caption generation
- **OWNED image-gen key** — TBD. Stub slot in `.env.local`:
  ```
  # OWNED_IMAGEGEN_PROVIDER=nano-banana | fal | replicate | none
  # NANO_BANANA_API_KEY=
  # FAL_KEY=
  # REPLICATE_API_TOKEN=
  ```

## Approval gates

✅ Pexels fetches — free, AUTO. Same as today.
✅ Saving images to `public/articles/` — local disk, AUTO.
✅ Editing article JSON to insert image sections — Bot 12 mutates content; same trust level as the writer itself. AUTO.
🟡 Owned image-gen calls — most have per-image cost ($0.001–$0.05). Cap via env var (e.g. `OWNED_IMAGEGEN_DAILY_MAX_USD=2`), Telegram alert if hit.
🔴 Vercel Blob writes — only when migration enabled. CFO gate if monthly spend would exceed the existing tier.

## Money chain

Bot 12 has no direct revenue link. It exists to lift the article-quality bar
which feeds: article CTR → affiliate clicks → Bot 6 earnings. The Bot-6 link
guard already protects the downstream revenue path.

Owned image-gen costs flow up the standard chain: per-image spend → daily
ledger row → CFO summary → Brady reviews monthly. Hard daily cap is the
fast brake; CFO is the slow brake.

## Risk

Low. Adding images can't ban a Twitter account or burn a real-money budget
(at v0). The only real risk is bandwidth + Pexels rate limit — both already
handled by the existing writer's logic.

The owned-gen adapter is where v1 introduces actual money. The daily cap
+ CFO surface handle that the same way Bot 9 handles ad spend, just smaller.

## Build checklist (for v1)

- [ ] Brady names the owned image-gen tool
- [ ] `lib/image-adapters/<tool>.ts` implementing `ImageAdapter`
- [ ] `scripts/x-image-producer.ts` — the daily bot + `--backfill` + `--slug` modes
- [ ] Article JSON shape: add `"type": "image"` block
- [ ] Render template: handle the new block type
- [ ] Claude scoring pass on candidate images
- [ ] `sharp` install + WebP conversion + `<picture>` render
- [ ] (Optional) Vercel Blob migration once article count > 100
- [ ] Wire into scheduler (disabled by default — same pattern as Bot 11)
- [ ] First-week dry-run: Bot 12 picks inline images, writes a manifest, doesn't actually mutate the article JSON until Brady approves the first batch
