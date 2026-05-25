/**
 * Dynamic OG card per article — 1200×630, KanzenAI-branded.
 *
 * Replaces the raw-hero OG image. Every social share (X, LinkedIn, Slack
 * unfurl) now shows the article title over a darkened hero with the Kanzen
 * wordmark + category badge. Generated at build time via Next.js's built-in
 * file convention — no extra deps; `next/og` ships with Next 14.
 *
 * Bot 12 · v0 — see scripts/specs/bot-12-image-producer.md.
 */
import { ImageResponse } from "next/og";
import { getArticle } from "@/lib/articles";

export const runtime = "nodejs";          // we use fs in lib/articles
export const contentType = "image/png";
export const size = { width: 1200, height: 630 };
export const alt = "KanzenAI — honest AI tool reviews for solopreneurs and creators";

export default async function Image({ params }: { params: { slug: string } }) {
  const article = getArticle(params.slug);
  const title = article?.title ?? "KanzenAI";
  const category = article?.category ?? "Reviews";
  const heroUrl = article?.headerImage
    ? `https://kanzenai.com${article.headerImage}`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          color: "#f0eee9",
          background: "#0a0a0a",
          position: "relative",
        }}
      >
        {/* Hero as background (with overlay) */}
        {heroUrl && (
          // next/og supports <img>; intentional, not <Image>.
          // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
          <img
            src={heroUrl}
            width={1200}
            height={630}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "brightness(0.42) saturate(0.85)",
            }}
          />
        )}

        {/* Top row: wordmark + category */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: 44,
                fontWeight: 800,
                letterSpacing: -1,
                color: "#f0eee9",
                fontFamily: "serif",
              }}
            >
              KanzenAI
            </div>
            <div
              style={{
                fontSize: 13,
                letterSpacing: 4,
                color: "#a9a6a0",
                marginTop: 6,
                textTransform: "uppercase",
              }}
            >
              完全 · Honest Reviews
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 18px",
              border: "1.5px solid #f0eee9",
              fontSize: 16,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#f0eee9",
            }}
          >
            {category}
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            zIndex: 1,
            fontSize: title.length > 70 ? 60 : title.length > 50 ? 72 : 84,
            lineHeight: 1.05,
            fontWeight: 800,
            fontFamily: "serif",
            letterSpacing: -2,
            color: "#f0eee9",
            maxWidth: 1080,
          }}
        >
          {title}
        </div>

        {/* Bottom row: domain */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            zIndex: 1,
          }}
        >
          <div
            style={{
              fontSize: 18,
              color: "#a9a6a0",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            kanzenai.com
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#a9a6a0",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            For working agents
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
