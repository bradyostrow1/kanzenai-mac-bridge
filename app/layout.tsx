import "./globals.css";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  metadataBase: new URL("https://kanzenai.com"),
  title: "KanzenAI — The complete intelligence brief for real estate agents",
  description: "Honest, deep reviews and comparisons of CRMs, AI assistants, lead-gen, and transaction tools — written for working real estate agents who don't have time for fluff.",
  alternates: {
    canonical: "https://kanzenai.com",
  },
  openGraph: {
    type: "website",
    url: "https://kanzenai.com",
    siteName: "KanzenAI",
    title: "KanzenAI — Reviews for working real estate agents",
    description: "Honest reviews of CRMs, AI assistants, lead-gen, and transaction tools.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KanzenAI — Reviews for working real estate agents",
    description: "Honest reviews of CRMs, AI assistants, and lead-gen tools.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-ink-0 bg-bg-0 antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
