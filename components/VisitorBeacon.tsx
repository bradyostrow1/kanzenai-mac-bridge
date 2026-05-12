"use client";

import { useEffect } from "react";

/**
 * Tiny client-side visitor counter. Fires one beacon per session (using
 * sessionStorage to dedupe) at /api/track-view. Free, self-hosted, no
 * third-party tracker. Counts kept in .audit/visits.log via the API route.
 */
export function VisitorBeacon() {
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      // Don't double-count: one beacon per browser session
      if (sessionStorage.getItem("kanzen-tracked") === "1") return;
      sessionStorage.setItem("kanzen-tracked", "1");

      // Fire-and-forget POST. No await, no error handling. Dev-mode skips.
      if (window.location.hostname === "localhost") return;

      fetch("/api/track-view", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: window.location.pathname,
          ref: document.referrer || null,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never break the page over analytics */
    }
  }, []);

  return null;
}
