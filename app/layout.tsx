import "./globals.css";
import type { ReactNode } from "react";
import { VisitorBeacon } from "@/components/VisitorBeacon";

export const metadata = {
  metadataBase: new URL("https://kanzenai.com"),
  title: "KanzenAI — The complete AI tool brief for solopreneurs and creators",
  description: "Honest, deep reviews and comparisons of AI software, productivity tools, and automation platforms — written for solopreneurs, creators, and small businesses who don't have time for fluff.",
  alternates: {
    canonical: "https://kanzenai.com",
  },
  openGraph: {
    type: "website",
    url: "https://kanzenai.com",
    siteName: "KanzenAI",
    title: "KanzenAI — AI tool reviews for solopreneurs and creators",
    description: "Honest reviews of AI software, productivity tools, and automation platforms.",
  },
  twitter: {
    card: "summary_large_image",
    title: "KanzenAI — AI tool reviews for solopreneurs and creators",
    description: "Honest reviews of AI software, productivity tools, and automation platforms.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans text-ink-0 bg-bg-0 antialiased">
        {children}
        <VisitorBeacon />
      </body>
    </html>
  );
}
