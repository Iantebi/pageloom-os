// PageLoom OS service worker — installability only, not an offline data cache.
//
// Deliberately conservative: only immutable, content-hashed static assets
// (_next/static/**, icons, manifest) are cached. Everything else — every API
// call and every page navigation — goes straight to the network, uncached.
// This app is authenticated, multi-tenant business software; caching an API
// response or a rendered page could leak one user's data to a later session
// on a shared device, or show stale approvals/financial figures as current.
const CACHE_NAME = "pageloom-static-v2";
const OFFLINE_URL = "/offline.html";
const STATIC_CACHE_PATTERNS = [/^\/_next\/static\//, /^\/icon-.*\.png$/, /^\/apple-touch-icon\.png$/, /^\/manifest\.webmanifest$/];

self.addEventListener("install", (event) => {
  // Precache just the offline fallback shell — everything else stays cached lazily by the fetch
  // handler below. This is the one entry that must exist BEFORE it's ever needed (a fetch that's
  // already failing offline can't also be the fetch that populates its own fallback).
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))).then(() => self.clients.claim())
  );
});

function isCacheableStaticAsset(url) {
  return STATIC_CACHE_PATTERNS.some((pattern) => pattern.test(url.pathname));
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Navigations (loading a page, not a sub-resource) stay network-only like everything else
  // dynamic — but ONLY on failure (genuinely offline / DNS down), fall back to the static,
  // data-free offline shell instead of the browser's own generic error page. This never serves
  // a cached/stale version of the actual app — that's still explicitly out of scope (see the
  // top-of-file comment on why: authenticated, multi-tenant data must never be cached).
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(OFFLINE_URL))));
    return;
  }

  if (!isCacheableStaticAsset(url)) return; // network-only for API calls and everything else

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })
  );
});
