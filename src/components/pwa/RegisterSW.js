"use client";

// src/components/pwa/RegisterSW.js
// Mendaftarkan Service Worker + subscribe Web Push setelah login

import { useEffect } from "react";

/**
 * Konversi base64url VAPID public key ke Uint8Array.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

/**
 * Subscribe ke Web Push dan kirim ke server.
 * @param {ServiceWorkerRegistration} registration
 * @param {{ userId: string, role: string }} userInfo
 */
async function subscribeToPush(registration, userInfo) {
  // Sudah ada subscription aktif → tidak perlu subscribe ulang
  const existing = await registration.pushManager.getSubscription();
  if (existing) return;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("[Push] Izin notifikasi ditolak.");
    return;
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.error("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY tidak ditemukan.");
    return;
  }

  try {
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subscription,
        userId: userInfo.userId,
        role: userInfo.role,
      }),
    });

    console.log(
      "[Push] Subscribe berhasil untuk",
      userInfo.role,
      userInfo.userId,
    );
  } catch (err) {
    console.error("[Push] Gagal subscribe:", err);
  }
}

export default function RegisterSW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        console.log("[SW] Terdaftar.");

        // Ambil session dari localStorage (format: magang_session)
        try {
          const sessStr = localStorage.getItem("magang_session");
          if (!sessStr) return;
          const sess = JSON.parse(sessStr);
          const userId = String(sess?.id || "").trim();
          const role = String(sess?.role || "").trim();
          if (userId && role) {
            await subscribeToPush(registration, { userId, role });
          }
        } catch (e) {
          console.warn("[Push] Tidak bisa baca session:", e);
        }
      })
      .catch((err) => {
        console.error("[SW] Gagal mendaftar:", err);
      });
  }, []);

  return null;
}

/**
 * Dipanggil dari halaman login setelah berhasil masuk.
 * Gunakan ini agar push langsung aktif tanpa refresh.
 *
 * @param {{ userId: string, role: string }} userInfo
 *
 * Contoh penggunaan di login/page.js setelah saveSession():
 *   import { initPushAfterLogin } from "@/components/pwa/RegisterSW";
 *   await initPushAfterLogin({ userId: result.data.id, role: result.data.role });
 */
export async function initPushAfterLogin({ userId, role }) {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    await subscribeToPush(registration, { userId, role });
  } catch (e) {
    console.warn("[Push] initPushAfterLogin gagal:", e);
  }
}
