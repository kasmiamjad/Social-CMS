"use client";

import { useEffect } from "react";

/**
 * Registers the technician PWA service worker (scoped to /tech so it never
 * controls the admin app). Renders nothing. Runs once after the window loads.
 */
export function TechSwRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/tech" }).catch(() => {
        /* registration is best-effort; the panel works without it */
      });
    };
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
