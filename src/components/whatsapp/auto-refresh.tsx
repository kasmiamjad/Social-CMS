"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  /** Refresh interval in milliseconds. Default 5000ms (5s). */
  intervalMs?: number;
}

/**
 * Invisible component that re-fetches server-rendered data every N milliseconds.
 * Used in the WhatsApp thread view to surface new messages without a page reload.
 *
 * Pauses while the tab is hidden to avoid wasting Supabase quota in the background.
 * Resumes immediately when the tab becomes visible again.
 *
 * Client-side textarea state (your in-progress reply) is preserved because
 * router.refresh() only re-runs server components — not client ones.
 */
export function AutoRefresh({ intervalMs = 5000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (id) return;
      id = setInterval(() => {
        // Only refresh while the tab is actually visible.
        if (document.visibilityState === "visible") {
          router.refresh();
        }
      }, intervalMs);
    }

    function stop() {
      if (id) clearInterval(id);
      id = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        // Refresh immediately on tab re-focus, then resume polling.
        router.refresh();
        start();
      } else {
        stop();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, router]);

  return null;
}
