"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  getStatistikSiswa,
  getRiwayatSiswa,
  getPresensiHariIni,
} from "../lib/api"; // Sesuai dengan source asli

import { getSession, isLoggedIn, logout } from "../lib/auth"; // Sesuai dengan source asli

// Letakkan di bawah import, di atas fungsi utama DashboardSiswa
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
  if (kelas === "XI TJKT 1") {
    badgeClasses = "bg-emerald-50 border-emerald-400 text-emerald-700";
  } else if (kelas === "XI TJKT 2") {
    badgeClasses = "bg-violet-50 border-violet-400 text-violet-700";
  }

  return (
    // inline-flex agar nama dan badge berjejer rapi ke samping secara konsisten
    <span className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2">
      {/* Nama tetap menggunakan efek gradasi aslinya */}
      <span
        className={
          isGradient
            ? "text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100"
            : ""
        }
      >
        {namaSiswa}
      </span>
      {/* Badge solid yang terbebas dari efek pemotongan teks parent */}
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

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [statistik, setStatistik] = useState(null);
  const [riwayat, setRiwayat] = useState([]);

  // State untuk data API
  const [presensiHariIni, setPresensiHariIni] = useState(null);

  // State tambahan untuk cek preference lokal
  const [hasPresensiTodayLocal, setHasPresensiTodayLocal] = useState(false);

  useEffect(() => {
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

      setUser(session);

      // --- CEK PREFERENCE LOKAL (Seperti di halaman form) ---
      const lastPresensiDate = localStorage.getItem(
        "magang_last_presensi_date",
      );
      const todayStr = new Date().toLocaleDateString("id-ID");
      if (lastPresensiDate === todayStr) {
        setHasPresensiTodayLocal(true);
      }
      // -----------------------------------------------------

      try {
        // Statistik
        const stat = await getStatistikSiswa(session.id);
        if (stat.success) {
          setStatistik(stat.data);
        }

        // Riwayat
        const history = await getRiwayatSiswa(session.id);
        if (history.success) {
          setRiwayat(history.data.slice(0, 5));
        }

        // Presensi hari ini (Data dari Server API)
        const today = await getPresensiHariIni(session.idGuru);
        if (today.success) {
          const dataSaya = today.data.find((x) => x.ID_SISWA === session.id);
          if (dataSaya) {
            setPresensiHariIni(dataSaya);
            // Optional: Backup untuk memastikan jika API bilang sudah, lokal juga ter-set
            setHasPresensiTodayLocal(true);
          }
        }
      } catch (err) {
        console.error(err);
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  function handleLogout() {
    if (!confirm("Keluar dari aplikasi?")) return;
    logout();
    router.replace("/magang/login");
  }

  // Helper untuk menentukan apakah presensi hari ini "SUDAH"
  // (Menggunakan gabungan antara API dan LocalStorage)
  const isSudahPresensi = !!presensiHariIni || hasPresensiTodayLocal;

  // --- TAMPILAN LOADING ANIMATIF ---
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
        <div className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-4">
            Status Kehadiran Hari Ini
          </h2>

          {isSudahPresensi ? (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wide shadow-sm shadow-emerald-500/30 mb-2">
                  ✅ Sudah Presensi
                </div>
                <p className="text-sm font-semibold text-emerald-800/80">
                  Kamu sudah melakukan presensi hari ini. Tetap semangat
                  menjalani kegiatan magang!
                </p>
              </div>
              <button
                disabled
                className="rounded-xl bg-slate-300 px-6 py-3 text-sm font-black text-slate-500 cursor-not-allowed whitespace-nowrap"
              >
                ✔️ SELESAI HARI INI
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs sm:text-sm font-black uppercase tracking-wide shadow-sm shadow-rose-500/30 mb-2">
                  ❌ Belum Presensi
                </div>
                <p className="text-sm font-semibold text-rose-800/80">
                  Kamu belum melakukan presensi hari ini. Silakan isi sekarang!
                </p>
              </div>
              <button
                onClick={() => router.push("/magang/presensi")}
                className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-rose-500/40 active:scale-[0.96] transition-all whitespace-nowrap"
              >
                📸 ISI PRESENSI
              </button>
            </div>
          )}
        </div>

        {/* MENU UTAMA (Tombol Sentuh Besar) */}
        <div className="grid gap-4 grid-cols-2">
          {isSudahPresensi ? (
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
            title="Riwayat Lengkap"
            subtitle="Lihat semua datamu"
            icon="📋"
            bgGrad="from-blue-500 to-indigo-600 shadow-blue-500/30"
            onClick={() => router.push("/magang/rekap")}
          />
        </div>

        {/* INFORMASI & STATISTIK SISWA */}
        <div className="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
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

          <div className="grid sm:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <Info label="ID Siswa" value={user.id} />
            <Info label="Guru Pembimbing" value={user.namaGuru} />
            <Info label="Tempat Magang" value={user.tempatMagang} />
          </div>
        </div>

        {/* RIWAYAT TERBARU */}
        <div className="rounded-[2rem] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 p-5 bg-gradient-to-r from-slate-50 to-white">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
              ⏳ Riwayat Terakhir
            </h2>
          </div>

          <div className="p-4 sm:p-6">
            {riwayat.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <p className="text-sm font-bold text-slate-400">
                  Belum ada riwayat presensi.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {riwayat.map((item, index) => {
                  const statusWarna =
                    item.STATUS === "Hadir"
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : item.STATUS === "Izin"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-blue-100 text-blue-700 border-blue-200";

                  return (
                    <div
                      key={index}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div>
                        <p className="font-black text-slate-700 text-sm">
                          {item.TIMESTAMP}
                        </p>
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                          📍 {item.TEMPAT_MAGANG}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider border ${statusWarna}`}
                      >
                        {item.STATUS}
                      </span>
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
      <div className="absolute right-3 bottom-2 text-2xl opacity-15 sm:opacity-20 pointer-events-none select-none">
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

// Komponen Card Menu khusus yang keadaannya dinonaktifkan (Disabled)
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
