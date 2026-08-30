// PageLoom OS service worker — installability only, not an offline data cache.
//
// Deliberately conservative: only immutable, content-hashed static assets
// (_next/static/**, icons, manifest) are cached. Everything else — every API
// call and every page navigation — goes straight to the network, uncached.
// This app is authenticated, multi-tenant business software; caching an API
// response or a rendered page could leak one user's data to a later session
// on a shared device, or show stale approvals/financial figures as current.
const CACHE_NAME = "pageloom-static-v1";
const STATIC_CACHE_PATTERNS = [/^\/_next\/static\//, /^\/icon-.*\.png$/, /^\/apple-touch-icon\.png$/, /^\/manifest\.webmanifest$/];

self.addEventListener("install", () => {
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
  if (!isCacheableStaticAsset(url)) return; // network-only for API calls, navigations, everything else

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
