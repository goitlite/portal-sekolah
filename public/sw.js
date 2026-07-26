const CACHE_NAME = "portal-sekolah-v1";

const STATIC_FILES = [
  "/",
  "/logo.png",
  "/favicon.ico",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  console.log("Service Worker Installed");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_FILES);
    }),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker Activated");

  event.waitUntil(
    Promise.all([
      clients.claim(),

      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        ),
      ),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Cache hanya halaman utama
  if (event.request.mode === "navigate" && url.pathname === "/") {
    event.respondWith(
      caches.match("/").then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            const clone = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put("/", clone);
            });

            return response;
          })
        );
      }),
    );

    return;
  }

  // Cache asset Next.js
  if (
    url.pathname.startsWith("/_next/static/") ||
    STATIC_FILES.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            const clone = response.clone();

            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });

            return response;
          })
        );
      }),
    );
  }
});
