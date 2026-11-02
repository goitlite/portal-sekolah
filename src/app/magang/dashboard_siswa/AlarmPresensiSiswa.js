"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/**
 * Komponen Alarm Notifikasi Presensi Siswa
 * - Siswa Magang: Mengingatkan ambil presensi magang setiap Senin - Jumat jam 09:00+ WIB jika belum presensi.
 * - Petugas Presensi Kelas: Mengingatkan ambil presensi wajah setiap Senin - Jumat jam 07:00+ WIB.
 * - Siswa belum magang: 100% bebas dari alarm magang.
 * - Dilengkapi suara chime Web Audio API, haptic getar HP, dan browser Web Notification.
 */
export default function AlarmPresensiSiswa({
  sudahMagang = false,
  isSudahPresensi = false,
  petugasWaliData = null,
  user = null,
  onOpenPresensiMagang,
  onOpenScanWajah,
}) {
  const [activeAlarm, setActiveAlarm] = useState(null); // 'magang' | 'petugas' | null
  const [dismissed, setDismissed] = useState(false);
  const soundPlayedRef = useRef(false);

  // Mainkan nada alarm lembut via Web Audio API (tanpa file eksternal)
  const triggerAlarmSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const playTone = (freq, startTime, duration) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.18, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const t = ctx.currentTime;
      playTone(587.33, t, 0.2); // D5
      playTone(880, t + 0.15, 0.25); // A5
      playTone(1174.66, t + 0.35, 0.4); // D6
    } catch {
      // Browser autoplay restriction aman diabaikan
    }

    // Getar di HP jika didukung browser
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([180, 80, 180]);
      } catch {}
    }
  }, []);

  // Memicu notifikasi sistem browser (Web Notification API)
  const triggerSystemNotification = useCallback((title, body) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          icon: "/logo.png",
          badge: "/logo.png",
          tag: "portal-alarm-presensi",
        });
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    } catch {}
  }, []);

  // Periksa jadwal alarm secara berkala
  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const day = now.getDay(); // 0: Minggu, 1: Senin, ..., 5: Jumat, 6: Sabtu
      const hour = now.getHours();

      // Hanya berlaku hari kerja Senin s/d Jumat
      const isHariKerja = day >= 1 && day <= 5;
      if (!isHariKerja) {
        setActiveAlarm(null);
        return;
      }

      const todayKey = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      // 1. KONDISI PETUGAS PRESENSI WAJAH (Mulai Jam 07:00 pagi hingga jam 10:59)
      if (petugasWaliData && hour >= 7 && hour < 11) {
        const isDismissedPetugas = localStorage.getItem(
          `alarm_petugas_dismissed_${todayKey}`,
        );
        if (!isDismissedPetugas) {
          setActiveAlarm("petugas");
          if (!soundPlayedRef.current) {
            soundPlayedRef.current = true;
            triggerAlarmSound();
            triggerSystemNotification(
              "⏰ Waktunya Presensi Wajah Kelas!",
              `Halo Petugas Presensi ${petugasWaliData.namaKelas || ""}, silakan buka kamera untuk mencatat presensi rekan sekelas.`,
            );
          }
          return;
        }
      }

      // 2. KONDISI SISWA SEDANG MAGANG (Mulai Jam 09:00 pagi hingga jam 16:59 jika belum presensi)
      if (sudahMagang && !isSudahPresensi && hour >= 9 && hour < 17) {
        const isDismissedMagang = localStorage.getItem(
          `alarm_magang_dismissed_${todayKey}`,
        );
        if (!isDismissedMagang) {
          setActiveAlarm("magang");
          if (!soundPlayedRef.current) {
            soundPlayedRef.current = true;
            triggerAlarmSound();
            triggerSystemNotification(
              "⏰ Waktunya Ambil Presensi Magang!",
              `Halo ${user?.nama || "Siswa"}, sekarang sudah jam 09:00 WIB. Jangan lupa kirim presensi selfie & lokasi hari ini.`,
            );
          }
          return;
        }
      }

      // Jika kondisi di atas tidak terpenuhi
      setActiveAlarm(null);
    };

    checkSchedule();
    const interval = setInterval(checkSchedule, 30000); // Periksa setiap 30 detik
    return () => clearInterval(interval);
  }, [
    sudahMagang,
    isSudahPresensi,
    petugasWaliData,
    user?.nama,
    triggerAlarmSound,
    triggerSystemNotification,
  ]);

  const handleDismiss = () => {
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(now.getDate()).padStart(2, "0")}`;

    if (activeAlarm === "petugas") {
      localStorage.setItem(`alarm_petugas_dismissed_${todayKey}`, "true");
    } else if (activeAlarm === "magang") {
      localStorage.setItem(`alarm_magang_dismissed_${todayKey}`, "true");
    }
    setDismissed(true);
    setActiveAlarm(null);
  };

  if (!activeAlarm || dismissed) return null;

  const isPetugasAlarm = activeAlarm === "petugas";

  return (
    <div className="fixed top-14 sm:top-16 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-bounce-short">
      <div
        className={`rounded-2xl p-3.5 sm:p-4 text-white shadow-2xl border backdrop-blur-md transition-all duration-300 ${
          isPetugasAlarm
            ? "bg-gradient-to-br from-teal-950 via-emerald-950 to-slate-950 border-emerald-400/60 shadow-emerald-900/40"
            : "bg-gradient-to-br from-amber-950 via-slate-950 to-orange-950 border-amber-400/60 shadow-amber-900/40"
        }`}
      >
        <div className="flex items-start justify-between gap-2.5">
          {/* Ikon jam bergetar */}
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${
              isPetugasAlarm
                ? "bg-emerald-500/20 border-emerald-400 text-2xl"
                : "bg-amber-500/20 border-amber-400 text-2xl"
            }`}
          >
            <span className="animate-pulse">⏰</span>
          </div>

          {/* Konten Notifikasi */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span
                className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  isPetugasAlarm
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/40"
                    : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                }`}
              >
                {isPetugasAlarm
                  ? "⭐ Alarm Petugas Presensi"
                  : "⏰ Alarm Presensi Magang"}
              </span>
              <span className="text-[10px] text-slate-400 font-bold">
                Pukul{" "}
                {new Date().toLocaleTimeString("id-ID", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                WIB
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-black text-white leading-tight">
              {isPetugasAlarm
                ? "Waktunya Presensi Wajah Kelas!"
                : "Waktunya Ambil Presensi Magang!"}
            </h4>

            <p className="text-[11px] sm:text-xs text-slate-200 mt-1 leading-snug">
              {isPetugasAlarm
                ? `Halo ${user?.nama?.split(" ")[0] || "Petugas"}, silakan buka kamera presensi wajah untuk rekan kelas ${petugasWaliData?.namaKelas || ""}.`
                : `Halo ${user?.nama?.split(" ")[0] || "Siswa"}, jam kerja sudah dimulai. Jangan lupa kirim selfie & lokasi live presensi magang.`}
            </p>

            {/* Tombol Aksi */}
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  handleDismiss();
                  if (isPetugasAlarm) {
                    onOpenScanWajah?.();
                  } else {
                    onOpenPresensiMagang?.();
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-[11px] sm:text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer ${
                  isPetugasAlarm
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:brightness-110 border border-emerald-300/60"
                    : "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 hover:brightness-110 border border-amber-200/60"
                }`}
              >
                <span>{isPetugasAlarm ? "🧏" : "📸"}</span>
                <span>
                  {isPetugasAlarm ? "Mulai Scan Wajah" : "Presensi Sekarang"}
                </span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="py-1.5 px-2.5 rounded-xl text-[11px] font-bold text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
              >
                Nanti
              </button>
            </div>
          </div>

          {/* Tombol X Tutup */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Tutup Alarm"
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer leading-none text-sm"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

