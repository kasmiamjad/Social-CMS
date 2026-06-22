/*
 * a3sixty Technician PWA service worker — Phase A (installable + offline shell).
 *
 * Deliberately conservative: we only precache the offline fallback page and
 * serve it when a page navigation fails (no network). We do NOT cache authed
 * pages or API responses, so there's no risk of showing another technician's
 * data or stale job state. Web Push handling is at the bottom.
 */
const CACHE = "a3tech-v2";
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

// ── Web Push (Phase B) ───────────────────────────────────────────────────────
// Payload shape sent by the server: { title, body, url, tag }.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data && event.data.text ? event.data.text() : "" };
  }
  const title = data.title || "a3 Tech";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/tech" },
    })
  );
});

// Focus an existing tech window (navigating it to the job) or open a new one.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/tech";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes("/tech") && "focus" in client) {
          if ("navigate" in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
