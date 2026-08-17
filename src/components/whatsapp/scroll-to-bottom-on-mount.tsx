"use client";

import { useEffect } from "react";

/**
 * The conversation page scrolls the whole document (not an inner container),
 * so opening a chat otherwise lands at the top — the oldest messages — instead
 * of the latest messages and the reply box. Scrolls down once on mount.
 *
 * Re-fires a couple of times shortly after mount because images/voice-note
 * players still loading can shift the page height right after the first scroll.
 */
export function ScrollToBottomOnMount() {
  useEffect(() => {
    const scroll = () => window.scrollTo({ top: document.documentElement.scrollHeight });
    scroll();
    const t1 = setTimeout(scroll, 150);
    const t2 = setTimeout(scroll, 500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return null;
}
