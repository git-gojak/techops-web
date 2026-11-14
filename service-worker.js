const CACHE_NAME = "gojak-techops-v2-ui-refresh";
const APP_SHELL = [
  "./",
  "./index.html",
  "./api.js",
  "./css/style.css",
  "./css/redesign.css",
  "./js/app.js",
  "./js/dashboard.js",
  "./js/computers.js",
  "./js/printers.js",
  "./js/maintenance.js",
  "./js/qr-info.js",
  "./manifest.json",
  "./assets/icons/icon-192.svg",
  "./assets/icons/icon-512.svg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(error => console.warn("App shell cache:", error))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(() =>
      caches.match(request).then(cached => cached || caches.match("./index.html"))
    )
  );
});
