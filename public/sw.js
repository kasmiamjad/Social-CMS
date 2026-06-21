/*
 * a3sixty Technician PWA service worker — Phase A (installable + offline shell).
 *
 * Deliberately conservative: we only precache the offline fallback page and
 * serve it when a page navigation fails (no network). We do NOT cache authed
 * pages or API responses, so there's no risk of showing another technician's
 * data or stale job state. Push handling is added in Phase B.
 */
const CACHE = "a3tech-v1";
const OFFLINE_URL = "/tech/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only handle top-level page navigations; let everything else hit the network
  // normally (so auth, API calls and media are never cached).
  if (request.method === "GET" && request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
