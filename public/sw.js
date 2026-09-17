// v2: nama cache dinaikkan supaya perangkat yang sudah kena bug "cache HTML lama
// permanen" otomatis dibersihkan saat Service Worker baru ini ter-install.
const CACHE_NAME = "portal-sekolah-v2";

// "/" SENGAJA TIDAK di-precache di sini lagi. Alasan: dengan strategi navigasi
// network-first di bawah, precache "/" saat install tidak diperlukan untuk
// kasus online, dan malah berisiko menyimpan HTML basi kalau proses install
// kebetulan terjadi saat server sedang bermasalah/deploy baru saja jalan.
const STATIC_FILES = ["/logo.png", "/favicon.ico", "/manifest.webmanifest"];

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

      // Hapus SEMUA cache dengan nama selain versi saat ini. Karena CACHE_NAME
      // baru saja dinaikkan ke v2, ini akan membersihkan cache v1 yang mungkin
      // berisi HTML/asset basi di perangkat yang sudah pernah gagal load.
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

  // ============================================================
  // HALAMAN HTML (navigasi): NETWORK-FIRST, bukan cache-first.
  //
  // Ini perbaikan akar masalah "sekali gagal load, seterusnya selalu gagal":
  // versi lama selalu memakai HTML dari cache kalau ada, dan HANYA fetch ke
  // server kalau cache kosong. Akibatnya kalau HTML yang tersimpan di cache
  // pernah korup/menunjuk ke build lama (hash file JS/CSS Next.js yang sudah
  // tidak ada lagi setelah redeploy), pengguna itu akan TERUS mendapat
  // halaman rusak tersebut selamanya, walau server sudah baik-baik saja.
  //
  // Sekarang: selalu coba ambil dari server dulu (dapat HTML + referensi
  // build TERBARU). Cache cuma dipakai sebagai fallback kalau benar-benar
  // offline / server tidak terjangkau.
  // ============================================================
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          // Offline / server tidak terjangkau -> baru pakai cache sebagai cadangan
          return caches
            .match(event.request)
            .then((cached) => cached || caches.match("/"));
        }),
    );

    return;
  }

  // ============================================================
  // ASSET NEXT.JS (/_next/static/...): aman tetap cache-first.
  // Setiap file di sini punya nama unik berisi hash konten per build, jadi
  // kalau isinya berubah, URL-nya PASTI ikut berubah. Tidak ada risiko
  // menyajikan versi basi dengan nama file yang sama.
  // ============================================================
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
