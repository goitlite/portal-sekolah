"use client";

// src/app/magang/lib/pushHelper.js
// Helper push subscription yang dipakai bersama di semua dashboard
// Pola langsung identik dengan PesanKepsekGuru yang sudah terbukti bekerja

const VAPID_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BD68J66JpkZS7Xe6-03zP6rlSRQ6f0WN00t4ycbyLIDNVmI9DfpqM-paeYaNoj14ujRNcgQojx2fTtZ-PzpWBTE";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

/**
 * Subscribe push notification dan simpan ke server Supabase.
 * - Jika permission sudah "granted" → langsung subscribe
 * - Jika permission "default" → minta izin, lalu subscribe
 * - Jika permission "denied" → return false (tidak bisa paksa)
 *
 * @param {{ userId: string, role: string }} userInfo
 * @returns {Promise<boolean>} true jika berhasil terdaftar
 */
export async function autoPushSubscribe(userInfo) {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;
  if (!userInfo?.userId || !userInfo?.role) return false;

  // HTTPS wajib (kecuali localhost)
  const isSecure = window.isSecureContext || window.location.hostname === "localhost";
  if (!isSecure) return false;

  try {
    const reg = await navigator.serviceWorker.ready;

    // Jika permission denied → tidak bisa lakukan apa-apa secara programatik
    if (Notification.permission === "denied") return false;

    // Jika belum diminta → minta izin
    if (Notification.permission === "default") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return false;
    }

    // Subscribe (ambil existing atau buat baru)
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
    }

    if (!subscription) return false;

    // Simpan ke Supabase via API
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        userId: String(userInfo.userId).trim(),
        role: String(userInfo.role).trim(),
      }),
    });
    const data = await res.json();
    return res.ok && data.ok;
  } catch (err) {
    console.warn("[Push] autoPushSubscribe gagal:", err);
    return false;
  }
}

/**
 * Jalankan cleanup pesan lama di Supabase secara background (fire and forget).
 * Aman dipanggil dari mana saja — tidak mengganggu UI.
 */
export function runPesanCleanupBackground() {
  if (typeof window === "undefined") return;
  // Throttle: hanya jalankan sekali per sesi browser (bukan per render)
  const key = "pesan_cleanup_last_run";
  const lastRun = parseInt(sessionStorage.getItem(key) || "0", 10);
  const now = Date.now();
  // Jalankan maksimal sekali per 6 jam per sesi
  if (now - lastRun < 6 * 60 * 60 * 1000) return;
  sessionStorage.setItem(key, String(now));

  fetch("/api/pesan/cleanup", { method: "POST" })
    .then((r) => r.json())
    .then((d) => {
      if (d.pesanDihapus > 0) {
        console.log(`[Cleanup] Berhasil hapus ${d.pesanDihapus} pesan lama (>${d.threshold}).`);
      }
    })
    .catch(() => {}); // silent
}

