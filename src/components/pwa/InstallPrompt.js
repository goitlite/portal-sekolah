"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Jika aplikasi sudah terinstall, jangan tampilkan popup
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Jika user sebelumnya memilih "Nanti"
    const dismissed = localStorage.getItem("installDismiss");
    if (dismissed) {
      const selisih = Date.now() - parseInt(dismissed);

      // 1 jam
      if (selisih < 60 * 60 * 1000) {
        return;
      }
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();

      console.log("PWA Install tersedia");

      setDeferredPrompt(e);

      // beri jeda sedikit agar tidak muncul mendadak
      setTimeout(() => {
        setShow(true);
      }, 800);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    console.log(choice.outcome);

    setDeferredPrompt(null);
    setShow(false);
  }

  function handleLater() {
    localStorage.setItem("installDismiss", Date.now().toString());

    setShow(false);
  }

  if (!show) return null;

  return (
    <>
      {/* Background */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]" />

      {/* Bottom Sheet */}
      <div className="fixed left-0 right-0 bottom-0 z-[9999] animate-in slide-in-from-bottom duration-500">
        <div className="mx-auto max-w-md rounded-t-3xl bg-white shadow-2xl p-6">
          <div className="flex justify-center">
            <div className="rounded-2xl bg-slate-100 p-3 shadow">
              <Image
                src="/logo.png"
                alt="Logo"
                width={70}
                height={70}
                priority
              />
            </div>
          </div>

          <h2 className="mt-5 text-center text-2xl font-black text-slate-900">
            Instal Portal Sekolah
          </h2>

          <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
            Tambahkan aplikasi ke layar utama untuk akses yang lebih cepat dan
            nyaman.
          </p>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-bold text-amber-700">📱 Cara Instal</h3>

            <div className="mt-3 space-y-3 text-sm text-slate-700">
              <div>
                <span className="font-bold text-slate-900">Android</span>
                <br />
                Tekan <b>Instal Sekarang</b>, lalu pilih <b>Install</b>.
              </div>

              <div className="border-t border-amber-200 pt-3">
                <span className="font-bold text-slate-900">iPhone / iPad</span>
                <br />
                Buka menu <b>Bagikan (Share)</b>, lalu pilih{" "}
                <b>Add to Home Screen</b>.
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 p-4">
            <div className="space-y-2 text-sm text-slate-700">
              <div>✅ Ikon langsung di layar utama</div>
              <div>✅ Tampilan seperti aplikasi</div>
              <div>✅ Akses & login lebih cepat</div>
            </div>
          </div>

          <button
            onClick={handleInstall}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-4 text-base font-bold text-slate-900 shadow-lg transition active:scale-95 hover:shadow-xl"
          >
            📲 Instal Sekarang
          </button>

          <button
            onClick={handleLater}
            className="mt-3 w-full py-3 text-sm font-semibold text-slate-500 hover:text-slate-700"
          >
            Nanti Saja
          </button>
        </div>
      </div>
    </>
  );
}
