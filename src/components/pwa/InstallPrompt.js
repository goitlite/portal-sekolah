"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Jika aplikasi sudah terinstall, jangan tampilkan popup
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return;
    }

    // Deteksi iPhone / iPad
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    setIsIOS(ios);

    // Jika iPhone langsung tampilkan popup
    if (ios) {
      console.log("iPhone terdeteksi");

      setTimeout(() => {
        setShow(true);
      }, 800);

      return;
    }

    function handleBeforeInstallPrompt(e) {
      e.preventDefault();

      console.log("PWA Install tersedia");

      setDeferredPrompt(e);

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
    // iPhone tidak memiliki beforeinstallprompt
    if (isIOS) {
      setShow(false);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    console.log(choice.outcome);

    setDeferredPrompt(null);
    setShow(false);
  }

  function handleLater() {
    setShow(false);
  }

  if (!show) return null;

  return (
    <>
      {/* Bottom Sheet */}
      <div className="fixed left-0 right-0 bottom-0 z-[9999] animate-in slide-in-from-bottom duration-500">
        <div
          className="
    mx-auto
    max-w-md
    rounded-t-[32px]
    border border-white/40
    bg-gradient-to-br
    from-amber-100/70
    via-yellow-50/65
    to-white/55
    backdrop-blur-2xl
    shadow-[0_-20px_60px_rgba(251,191,36,0.25)]
    p-6
  "
        >
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white p-3 shadow-lg border border-amber-200">
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

          <div className="mt-6 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
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

          <div className="mt-5 rounded-2xl bg-white border border-amber-100 shadow-sm p-4">
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
            {isIOS ? "📱 Saya Mengerti" : "📲 Instal Sekarang"}
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
