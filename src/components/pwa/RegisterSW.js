"use client";

// src/components/pwa/RegisterSW.js
// Mendaftarkan Service Worker + subscribe Web Push setelah login
// dengan dukungan auto-update SW dan tombol pemicu izin di Android.

import { useEffect, useState } from "react";

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
 * Kirim subscription ke server API
 */
async function kirimKeServer(subscription, userInfo) {
  try {
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
      "[Push] Subscription tersimpan di server untuk",
      userInfo.role,
      userInfo.userId,
    );
  } catch (err) {
    console.warn("[Push] Gagal mengirim subscription ke server:", err);
  }
}

/**
 * Subscribe ke Web Push.
 * @param {ServiceWorkerRegistration} registration
 * @param {{ userId: string, role: string }} userInfo
 */
export async function subscribeToPush(registration, userInfo) {
  if (!userInfo?.userId || !userInfo?.role) return;

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[Push] NEXT_PUBLIC_VAPID_PUBLIC_KEY tidak ditemukan.");
    return;
  }

  try {
    // Periksa subscription yang sudah ada
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Pastikan tetap terdaftar di backend
      await kirimKeServer(subscription, userInfo);
      return subscription;
    }

    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        console.warn("[Push] Izin notifikasi belum diberikan:", perm);
        return null;
      }
    }

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await kirimKeServer(subscription, userInfo);
    return subscription;
  } catch (err) {
    console.error("[Push] Gagal subscribe Web Push:", err);
    return null;
  }
}

export default function RegisterSW() {
  const [showPromptBanner, setShowPromptBanner] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        console.log("[SW] Terdaftar v3.");
        // Paksa periksa dan unduh versi baru sw.js di background
        registration.update().catch(() => {});

        // Cek apakah user sudah login
        try {
          const sessStr = localStorage.getItem("magang_session");
          if (!sessStr) return;
          const sess = JSON.parse(sessStr);
          const userId = String(sess?.id || "").trim();
          const role = String(sess?.role || "").trim();

          if (userId && role) {
            if ("Notification" in window) {
              if (Notification.permission === "granted") {
                await subscribeToPush(registration, { userId, role });
              } else if (Notification.permission === "default") {
                // Tampilkan banner ramah untuk meminta izin
                setShowPromptBanner(true);
              }
            }
          }
        } catch (e) {
          console.warn("[Push] Error sesi:", e);
        }
      })
      .catch((err) => {
        console.error("[SW] Gagal mendaftar:", err);
      });
  }, []);

  async function handleAktifkanNotif() {
    setShowPromptBanner(false);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sessStr = localStorage.getItem("magang_session");
      if (!sessStr) return;
      const sess = JSON.parse(sessStr);
      await subscribeToPush(reg, {
        userId: String(sess?.id || "").trim(),
        role: String(sess?.role || "").trim(),
      });
    } catch (e) {
      console.warn("Gagal aktifkan notif banner:", e);
    }
  }

  if (!showPromptBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[99999] max-w-md mx-auto bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-amber-400/40 backdrop-blur-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom duration-300">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black text-amber-300 flex items-center gap-1.5">
          <span>🔔</span> Notifikasi Pesan
        </p>
        <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
          Aktifkan notifikasi agar pesan baru dari Kepala Sekolah / Guru
          langsung muncul di HP Anda.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleAktifkanNotif}
          className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md active:scale-95 transition-transform"
        >
          Aktifkan
        </button>
        <button
          type="button"
          onClick={() => setShowPromptBanner(false)}
          className="w-7 h-7 text-xs text-slate-400 hover:text-white flex items-center justify-center rounded-full"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

/**
 * Dipanggil dari halaman login setelah berhasil masuk.
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
