"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  getStatistikSiswa,
  getRiwayatSiswa,
  getPresensiHariIni,
  getDataSiswaWali,
} from "../lib/api";

import { getSession, isLoggedIn, logout } from "../lib/auth";

// --- HELPER FORMAT TANGGAL ---
function formatWaktu(timestamp) {
  if (!timestamp) return { tanggal: "-", jam: "-" };
  try {
    const normalized = timestamp.replace(" ", "T");
    const d = new Date(normalized);

    if (isNaN(d.getTime())) {
      return { tanggal: `📅 ${timestamp}`, jam: "" };
    }

    const hari = d.toLocaleDateString("id-ID", { weekday: "long" });
    const tgl = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const jam = d
      .toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
      .replace(":", ".");

    return {
      tanggal: `📅 ${hari}, ${tgl}`,
      jam: `🕘 ${jam} WIB`,
    };
  } catch (error) {
    return { tanggal: `📅 ${timestamp}`, jam: "" };
  }
}

const NamaBadge = ({ rawName, isGradient = false }) => {
  if (!rawName) return null;

  const match = rawName.match(/(.+?)\s*\[(.*?)\]/);

  if (!match) {
    return (
      <span
        className={
          isGradient
            ? "text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100"
            : ""
        }
      >
        {rawName}
      </span>
    );
  }

  const namaSiswa = match[1].trim();
  const kelas = match[2].trim();

  let badgeClasses = "bg-slate-100 border-slate-300 text-slate-700";
  if (kelas === "TJKT 1") {
    badgeClasses = "bg-emerald-50 border-emerald-400 text-emerald-700";
  } else if (kelas === "TJKT 2") {
    badgeClasses = "bg-violet-50 border-violet-400 text-violet-700";
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2">
      <span
        className={
          isGradient
            ? "text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100"
            : ""
        }
      >
        {namaSiswa}
      </span>
      <span
        className={`inline-flex items-center px-1.5 py-0.5 border rounded-md text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm bg-clip-border text-current ${badgeClasses}`}
      >
        {kelas}
      </span>
    </span>
  );
};

export default function DashboardSiswa() {
  const router = useRouter();
  const CACHE_KEY = "dashboardSiswaCache";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [guruWali, setGuruWali] = useState("-");
  const [statistik, setStatistik] = useState(null);
  const [riwayat, setRiwayat] = useState([]);

  const [presensiHariIni, setPresensiHariIni] = useState(null);
  const [hasPresensiTodayLocal, setHasPresensiTodayLocal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();

      if (!session || session.role !== "siswa") {
        router.replace("/magang/login");
        return;
      }

      if (isMounted) setUser(session);

      // CEK PREFERENCE LOKAL
      const lastPresensiDate = localStorage.getItem(
        "magang_last_presensi_date",
      );
      const todayStr = new Date().toLocaleDateString("id-ID");
      if (lastPresensiDate === todayStr && isMounted) {
        setHasPresensiTodayLocal(true);
      }

      // --- PERBAIKAN: Buat variabel lokal penampung fallback ---
      let fallbackStatistik = null;
      let fallbackRiwayat = [];
      let fallbackPresensi = null;
      let fallbackGuruWali = "-";

      // 1. BACA CACHE & INSTANT RENDER
      const cachedDataStr = localStorage.getItem(CACHE_KEY);
      if (cachedDataStr && isMounted) {
        try {
          const cachedData = JSON.parse(cachedDataStr);

          // Simpan ke variabel lokal agar aman dari stale closure
          fallbackStatistik = cachedData.statistik || null;
          fallbackRiwayat = cachedData.riwayat || [];
          fallbackPresensi = cachedData.presensiHariIni || null;
          fallbackGuruWali = cachedData.guruWali || "-";

          // Tampilkan ke UI
          setStatistik(fallbackStatistik);
          setRiwayat(fallbackRiwayat);
          setPresensiHariIni(fallbackPresensi);
          setGuruWali(fallbackGuruWali);

          setLoading(false);
        } catch (error) {
          console.error("Gagal membaca cache dashboard siswa:", error);
        }
      }

      // 2. FETCH PARALEL (BACKGROUND SYNC)
      try {
        const [stat, history, today, waliResult] = await Promise.allSettled([
          getStatistikSiswa(session.id),
          getRiwayatSiswa(session.id),
          getPresensiHariIni(session.idGuru),
          getDataSiswaWali(session.idGuru),
        ]);

        if (!isMounted) return;

        // --- PERBAIKAN: Gunakan variabel lokal sebagai default ---
        let currentStatistik = fallbackStatistik;
        let currentRiwayat = fallbackRiwayat;
        let currentPresensi = fallbackPresensi;
        let currentGuruWali = fallbackGuruWali;

        // Hasil Statistik
        if (stat.status === "fulfilled" && stat.value?.success) {
          currentStatistik = stat.value.data;
          setStatistik(currentStatistik);
        }

        // Hasil Riwayat
        if (history.status === "fulfilled" && history.value?.success) {
          currentRiwayat = history.value.data.slice(0, 5);
          setRiwayat(currentRiwayat);
        }

        // Hasil Presensi Hari Ini
        if (today.status === "fulfilled" && today.value?.success) {
          const dataSaya = today.value.data.find(
            (x) => x.ID_SISWA === session.id,
          );
          if (dataSaya) {
            currentPresensi = dataSaya;
            setPresensiHariIni(currentPresensi);
            setHasPresensiTodayLocal(true);
          } else {
            currentPresensi = null;
            setPresensiHariIni(null);
          }
        }

        // Hasil Guru Wali
        if (
          waliResult.status === "fulfilled" &&
          waliResult.value?.success &&
          Array.isArray(waliResult.value.data)
        ) {
          const siswaSaya = waliResult.value.data.find(
            (item) => String(item.idSiswa).trim() === String(session.id).trim(),
          );
          if (siswaSaya?.namaGuru) {
            currentGuruWali = siswaSaya.namaGuru;
            setGuruWali(currentGuruWali);
          }
        }

        // Simpan Cache Lengkap Terbaru
        const serverData = {
          statistik: currentStatistik,
          riwayat: currentRiwayat,
          presensiHariIni: currentPresensi,
          guruWali: currentGuruWali,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(serverData));
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [router]);

  function handleLogout() {
    if (!confirm("Keluar dari aplikasi?")) return;
    localStorage.removeItem(CACHE_KEY);
    logout();
    router.replace("/magang/login");
  }

  const sudahMagang = !!user?.tempatMagang?.trim();

  const isSudahPresensi = !!presensiHariIni || hasPresensiTodayLocal;
  const fotoTerbaru = riwayat.length > 0 ? riwayat[0].FOTO : null;

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-base font-bold text-slate-600 tracking-wide">
            Menyinkronkan Data Siswa...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 space-y-6 pb-12">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1 rounded-xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={38}
                height={38}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                PRESENSI MAGANG
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-white hover:brightness-110 active:scale-95 shadow-md shadow-red-900/30 border border-red-500/30 transition-all"
          >
            ❌ LOGOUT
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6 sm:space-y-8">
        {/* HERO BANNER SISWA */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl border border-blue-800">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-amber-400 opacity-10 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
              🎓 Dashboard Siswa
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Halo,
            </h2>
            <h3 className="mt-1 text-xl sm:text-3xl font-extrabold flex flex-wrap items-center gap-1.5 sm:gap-2">
              <NamaBadge rawName={user?.nama} isGradient={true} />
            </h3>
            <p className="mt-2 text-sm text-blue-200 max-w-md font-medium">
              Jangan lupa untuk mengirimkan bukti presensi magang harian kamu
              hari ini!
            </p>
          </div>
        </div>

        {/* STATUS PRESENSI HARI INI */}

        {/* MENU UTAMA */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3"></div>

        {/* STATUS PRESENSI HARI INI */}

        {/* MENU UTAMA */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          {!sudahMagang ? (
            <MenuCardDisabled
              title="Presensi Terkunci"
              subtitle="Belum memiliki tempat magang"
              icon="🔒"
            />
          ) : isSudahPresensi ? (
            <MenuCardDisabled
              title="Presensi Selesai"
              subtitle="Telah diisi hari ini"
              icon="✅"
            />
          ) : (
            <MenuCard
              title="Presensi Sekarang"
              subtitle="Kirim foto & lokasi live"
              icon="📸"
              bgGrad="from-emerald-500 to-teal-600 shadow-emerald-500/30"
              onClick={() => router.push("/magang/presensi")}
            />
          )}

          <MenuCard
            title="Riwayat Presensi Magang"
            subtitle="Lihat semua datamu"
            icon="📋"
            bgGrad="from-blue-500 to-indigo-600 shadow-blue-500/30"
            onClick={() => {
              if (user) {
                // 1. Set filter otomatis untuk halaman rekap
                localStorage.setItem(
                  "targetGuruRekap",
                  user.idGuru || user.namaGuru,
                );
                localStorage.setItem(
                  "targetTempatRekap",
                  user.tempatMagang || "Semua",
                );

                // 2. Set trigger untuk langsung membuka popup siswa
                localStorage.setItem(
                  "targetSiswaPopup",
                  JSON.stringify({
                    id: user.id,
                    nama: user.nama,
                    guru: user.namaGuru,
                    tempat: user.tempatMagang,
                  }),
                );
              }
              router.push("/magang/rekap");
            }}
          />

          {/* BIODATA */}
          <MenuCard
            title="Biodata Saya"
            subtitle="Lihat & edit data pribadi"
            icon="👤"
            bgGrad="from-violet-500 to-purple-600 shadow-violet-500/30"
            onClick={() => router.push("/magang/siswa/biodata")}
          />
          {/* ==========================================
            MENU KELULUSAN
        ========================================== */}

          <button
            type="button"
            onClick={() => router.push("/magang/siswa/kelulusan")}
            className="
            group
            w-full
            overflow-hidden
            rounded-2xl
            sm:rounded-3xl
            bg-gradient-to-r
            from-amber-500
            via-yellow-500
            to-orange-500
            p-4
            sm:p-5
            text-left
            text-white
            shadow-lg
            shadow-amber-500/20
            border
            border-amber-300/50
            transition-all
            duration-200
            hover:shadow-xl
            hover:shadow-amber-500/30
            hover:-translate-y-0.5
            active:scale-[0.98]
          "
          >
            <div className="flex items-center gap-3 sm:gap-4">
              {/* ICON */}
              <div
                className="
                shrink-0
                flex
                h-12
                w-12
                sm:h-14
                sm:w-14
                items-center
                justify-center
                rounded-xl
                sm:rounded-2xl
                bg-white/20
                border
                border-white/30
                text-2xl
                sm:text-3xl
                shadow-inner
              "
              >
                🎓
              </div>

              {/* TEXT */}
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-xl font-black tracking-tight">
                  KELULUSAN
                </h2>

                <p className="mt-0.5 text-[11px] sm:text-sm font-medium text-white/90">
                  Lihat informasi kelulusan dan nilai
                </p>
              </div>

              {/* ARROW */}
              <div
                className="
                shrink-0
                flex
                h-9
                w-9
                sm:h-10
                sm:w-10
                items-center
                justify-center
                rounded-full
                bg-white/15
                border
                border-white/20
                text-lg
                transition-transform
                group-hover:translate-x-1
              "
              >
                →
              </div>
            </div>
          </button>
        </div>

        {/* INFORMASI & STATISTIK SISWA */}
        <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FFF7E5] to-[#F8E7A5] border border-[#E8D28A] shadow-[0_10px_30px_rgba(214,178,63,0.12)] transition-all duration-300 hover:shadow-[0_16px_40px_rgba(214,178,63,0.18)] p-5 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-4">
            Statistik & Profil Kamu
          </h2>

          <div className="grid gap-3 sm:gap-5 grid-cols-2 xl:grid-cols-4 mb-8">
            <Card
              title="Hadir"
              value={statistik?.hadir ?? 0}
              accentColor="border-emerald-500"
              textColor="text-emerald-600"
              icon="✅"
            />
            <Card
              title="Izin"
              value={statistik?.izin ?? 0}
              accentColor="border-amber-500"
              textColor="text-amber-600"
              icon="📝"
            />
            <Card
              title="Sakit"
              value={statistik?.sakit ?? 0}
              accentColor="border-blue-500"
              textColor="text-blue-600"
              icon="🤒"
            />
            <Card
              title="Kehadiran"
              value={`${statistik?.persentaseHadir ?? 0}%`}
              accentColor="border-indigo-500"
              textColor="text-indigo-600"
              icon="📈"
            />
          </div>

          <div className="grid sm:grid-cols-4 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <Info label="ID Siswa" value={user.id} />
            <Info label="Guru Pembimbing" value={user.namaGuru} />
            <Info label="Guru Wali" value={guruWali} />
            <Info label="Tempat Magang" value={user.tempatMagang} />
          </div>
        </div>

        {/* COMPACT TIMELINE TERBARU DENGAN LINK FOTO */}
        <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FFF7E5] to-[#F8E7A5] border border-[#E8D28A] shadow-[0_10px_30px_rgba(214,178,63,0.12)] overflow-hidden transition-all duration-300 hover:shadow-[0_16px_40px_rgba(214,178,63,0.18)] border border-slate-100">
          {/* Header Timeline & Tombol Link Berdampingan */}
          <div className="border-b border-slate-100 p-4 sm:p-5 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
            <h2 className="text-base sm:text-xl font-black text-slate-800 flex items-center gap-2">
              ⏳ Riwayat Terakhir
            </h2>
            {/* LINK FOTO (Buka tab baru) */}
            <div className="shrink-0">
              {fotoTerbaru ? (
                <a
                  href={fotoTerbaru}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-blue-500/30 hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                  📸 Lihat Foto Presensi
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-200 text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-300">
                  🚫 Tidak Ada Foto
                </span>
              )}
            </div>
          </div>

          <div className="p-4 sm:p-6">
            {riwayat.length === 0 ? (
              <div className="text-center py-6 bg-white/50 rounded-2xl border border-dashed border-slate-300">
                <p className="text-sm font-bold text-slate-400">
                  Belum ada riwayat presensi.
                </p>
              </div>
            ) : (
              <div className="relative space-y-3">
                {/* Garis Vertikal Latar Belakang */}
                <div className="absolute top-3 bottom-4 left-[11px] w-[2px] bg-slate-200 z-0"></div>

                {riwayat.map((item, index) => {
                  const { tanggal, jam } = formatWaktu(item.TIMESTAMP);

                  // Konfigurasi Status
                  let statusIcon = "🟢";
                  let statusText = "HADIR";
                  let dotColor = "border-emerald-500";
                  let statusTextColor = "text-emerald-600";

                  if (item.STATUS?.toLowerCase() === "izin") {
                    statusIcon = "🟡";
                    statusText = "IZIN";
                    dotColor = "border-amber-500";
                    statusTextColor = "text-amber-600";
                  } else if (item.STATUS?.toLowerCase() === "sakit") {
                    statusIcon = "🔵";
                    statusText = "SAKIT";
                    dotColor = "border-blue-500";
                    statusTextColor = "text-blue-600";
                  }

                  return (
                    <div
                      key={index}
                      className="relative z-10 flex items-start gap-3"
                    >
                      {/* Timeline Dot Indicator */}
                      <div className="shrink-0 mt-3.5 flex justify-center w-[24px]">
                        <div
                          className={`h-4 w-4 rounded-full bg-white border-[3px] ${dotColor} shadow-sm`}
                        />
                      </div>

                      {/* Card Content Timeline - Desain Compact */}
                      <div className="flex-1 bg-white/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div
                            className={`font-black text-[13px] sm:text-sm tracking-wide mb-1 ${statusTextColor}`}
                          >
                            {statusIcon} {statusText}
                          </div>
                          <p className="text-[11px] sm:text-xs font-bold text-slate-500 truncate max-w-[200px] sm:max-w-xs">
                            📍 {item.TEMPAT_MAGANG || "-"}
                          </p>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 mt-1 sm:mt-0">
                          <p className="text-[10px] sm:text-xs font-medium text-slate-500">
                            {tanggal}
                          </p>
                          <p className="text-[10px] sm:text-xs font-medium text-slate-500">
                            {jam}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

/* --- REUSABLE COMPONENTS --- */

function Info({ label, value, textColor = "text-slate-800" }) {
  return (
    <div>
      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
        {label}
      </p>
      <p className={`text-sm sm:text-base font-black ${textColor} truncate`}>
        {value}
      </p>
    </div>
  );
}

function Card({ title, value, accentColor, textColor, icon }) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-100 border-t-4 ${accentColor} relative overflow-hidden group`}
    >
      <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">
        {title}
      </p>
      <h2
        className={`mt-1 sm:mt-2 text-2xl sm:text-3xl font-black ${textColor}`}
      >
        {value}
      </h2>
      <div className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/80 border border-yellow-300 shadow-lg flex items-center justify-center text-2xl">
        {icon}
      </div>
    </div>
  );
}

function MenuCard({ title, subtitle, icon, bgGrad, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${bgGrad} text-white shadow-lg flex flex-col justify-between h-32 sm:h-36 transition-all active:scale-[0.96] active:brightness-95 focus:outline-none border border-white/10`}
    >
      <div className="text-2xl sm:text-3xl bg-white/20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-white/20 shadow-inner">
        {icon}
      </div>
      <div>
        <h2 className="text-sm sm:text-lg font-black tracking-tight leading-snug">
          {title}
        </h2>
        <p className="text-[10px] sm:text-xs text-white/90 font-medium mt-0.5">
          {subtitle}
        </p>
      </div>
    </button>
  );
}

function MenuCardDisabled({ title, subtitle, icon }) {
  return (
    <button
      disabled
      className="w-full text-left p-4 sm:p-5 rounded-2xl bg-slate-200 text-slate-400 flex flex-col justify-between h-32 sm:h-36 cursor-not-allowed border border-slate-300"
    >
      <div className="text-2xl sm:text-3xl bg-slate-300/50 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-slate-300">
        {icon}
      </div>
      <div>
        <h2 className="text-sm sm:text-lg font-black tracking-tight leading-snug">
          {title}
        </h2>
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
