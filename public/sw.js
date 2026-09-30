// v3: Ditambahkan handler Web Push Notification lengkap untuk Android & Desktop,
// serta mekanisme auto-update Service Worker.
const CACHE_NAME = "portal-sekolah-v3";

const STATIC_FILES = ["/logo.png", "/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  console.log("[SW v3] Installed");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_FILES).catch((e) => {
        console.warn("[SW] Cache addAll warning:", e);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW v3] Activated");
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      ),
    ])
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Jangan cache request API dan selain GET
  if (url.pathname.startsWith("/api/") || event.request.method !== "GET") {
    return;
  }

  // Navigasi HTML: Network-first
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches
            .match(event.request)
            .then((cached) => cached || caches.match("/"));
        })
    );
    return;
  }

  // Asset statis Next.js & gambar
  if (
    url.pathname.startsWith("/_next/static/") ||
    STATIC_FILES.includes(url.pathname)
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return (
          cached ||
          fetch(event.request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
              });
            }
            return response;
          })
        );
      })
    );
  }
});

// ============================================================
// WEB PUSH - Event: "push"
// Notifikasi latar belakang untuk HP Android & Browser
// ============================================================
self.addEventListener("push", (event) => {
  console.log("[SW] Push event diterima");

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = {
        title: "Portal Sekolah",
        body: event.data.text() || "Ada pesan masuk baru.",
      };
    }
  } else {
    payload = {
      title: "Portal Sekolah",
      body: "Ada pesan masuk baru.",
    };
  }

  const title = payload.title || "Portal Sekolah";
  const targetUrl = payload.url || "/magang/login";

  const options = {
    body: payload.body || "Pesan baru telah diterima.",
    icon: payload.icon || "/logo.png",
    badge: "/logo.png",
    vibrate: [200, 100, 200],
    renotify: true,
    tag: payload.tag || "pesan-" + Date.now(),
    data: {
      url: targetUrl,
      timestamp: Date.now(),
      ...(payload.data || {}),
    },
  };

  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .catch((err) => {
        console.warn("[SW] Gagal showNotification dengan options lengkap, coba fallback:", err);
        return self.registration.showNotification(title, {
          body: options.body,
          data: options.data,
        });
      })
  );
});

// ============================================================
// WEB PUSH - Event: "notificationclick"
// ============================================================
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin) {
            if ("focus" in client) client.focus();
            if ("navigate" in client) return client.navigate(targetUrl);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
