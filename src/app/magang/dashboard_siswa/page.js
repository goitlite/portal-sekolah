"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  getStatistikSiswa,
  getRiwayatSiswa,
  getPresensiHariIni,
} from "../lib/api"; // Sesuai dengan source asli[cite: 5]

import { getSession, isLoggedIn, logout } from "../lib/auth"; // Sesuai dengan source asli[cite: 5]

// Letakkan di bawah import, di atas fungsi utama DashboardSiswa[cite: 5]
const NamaBadge = ({ rawName, isGradient = false }) => {
  if (!rawName) return null;

  const match = rawName.match(/(.+?)\s*\[(.*?)\]/); //[cite: 5]

  if (!match) {
    return (
      <span
        className={
          isGradient
            ? "text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100" //[cite: 5]
            : ""
        }
      >
        {rawName}
      </span>
    );
  }

  const namaSiswa = match[1].trim(); //[cite: 5]
  const kelas = match[2].trim(); //[cite: 5]

  let badgeClasses = "bg-slate-100 border-slate-300 text-slate-700"; //[cite: 5]
  if (kelas === "TJKT 1") {
    badgeClasses = "bg-emerald-50 border-emerald-400 text-emerald-700"; //[cite: 5]
  } else if (kelas === "TJKT 2") {
    badgeClasses = "bg-violet-50 border-violet-400 text-violet-700"; //[cite: 5]
  }

  return (
    // inline-flex agar nama dan badge berjejer rapi ke samping secara konsisten[cite: 5]
    <span className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2">
      {/* Nama tetap menggunakan efek gradasi aslinya[cite: 5] */}
      <span
        className={
          isGradient
            ? "text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100" //[cite: 5]
            : ""
        }
      >
        {namaSiswa}
      </span>
      {/* Badge solid yang terbebas dari efek pemotongan teks parent[cite: 5] */}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 border rounded-md text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm bg-clip-border text-current ${badgeClasses}`} //[cite: 5]
      >
        {kelas}
      </span>
    </span>
  );
};

export default function DashboardSiswa() {
  const router = useRouter(); //[cite: 5]
  const CACHE_KEY = "dashboardSiswaCache"; // Kunci cache khusus siswa

  const [loading, setLoading] = useState(true); //[cite: 5]
  const [user, setUser] = useState(null); //[cite: 5]
  const [statistik, setStatistik] = useState(null); //[cite: 5]
  const [riwayat, setRiwayat] = useState([]); //[cite: 5]

  // State untuk data API[cite: 5]
  const [presensiHariIni, setPresensiHariIni] = useState(null); //[cite: 5]

  // State tambahan untuk cek preference lokal[cite: 5]
  const [hasPresensiTodayLocal, setHasPresensiTodayLocal] = useState(false); //[cite: 5]

  useEffect(() => {
    async function loadDashboard() {
      if (!isLoggedIn()) {
        //[cite: 5]
        router.replace("/magang/login"); //[cite: 5]
        return;
      }

      const session = getSession(); //[cite: 5]

      if (!session || session.role !== "siswa") {
        //[cite: 5]
        router.replace("/magang/login"); //[cite: 5]
        return;
      }

      setUser(session); //[cite: 5]

      // --- CEK PREFERENCE LOKAL (Seperti di halaman form) ---[cite: 5]
      const lastPresensiDate = localStorage.getItem(
        "magang_last_presensi_date", //[cite: 5]
      );
      const todayStr = new Date().toLocaleDateString("id-ID"); //[cite: 5]
      if (lastPresensiDate === todayStr) {
        //[cite: 5]
        setHasPresensiTodayLocal(true); //[cite: 5]
      }
      // -----------------------------------------------------[cite: 5]

      // 1. LOAD DATA DARI CACHE (INSTAN / TANPA SPINNER)
      const cachedDataStr = localStorage.getItem(CACHE_KEY);
      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          setStatistik(cachedData.statistik);
          setRiwayat(cachedData.riwayat);
          setPresensiHariIni(cachedData.presensiHariIni);
          setLoading(false); // Hilangkan loading screen agar responsif
        } catch (error) {
          console.error("Gagal membaca cache dashboard siswa:", error);
        }
      }

      // 2. TETAP AMBIL DATA TERBARU DARI SERVER DI LATAR BELAKANG
      try {
        let currentStatistik = statistik;
        let currentRiwayat = riwayat;
        let currentPresensi = presensiHariIni;

        // Statistik[cite: 5]
        const stat = await getStatistikSiswa(session.id); //[cite: 5]
        if (stat.success) {
          //[cite: 5]
          currentStatistik = stat.data;
          setStatistik(currentStatistik);
        }

        // Riwayat[cite: 5]
        const history = await getRiwayatSiswa(session.id); //[cite: 5]
        if (history.success) {
          //[cite: 5]
          currentRiwayat = history.data.slice(0, 5);
          setRiwayat(currentRiwayat);
        }

        // Presensi hari ini (Data dari Server API)[cite: 5]
        const today = await getPresensiHariIni(session.idGuru); //[cite: 5]
        if (today.success) {
          //[cite: 5]
          const dataSaya = today.data.find((x) => x.ID_SISWA === session.id); //[cite: 5]
          if (dataSaya) {
            //[cite: 5]
            currentPresensi = dataSaya;
            setPresensiHariIni(currentPresensi);
            // Optional: Backup untuk memastikan jika API bilang sudah, lokal juga ter-set[cite: 5]
            setHasPresensiTodayLocal(true); //[cite: 5]
          } else {
            currentPresensi = null;
            setPresensiHariIni(null);
          }
        }

        // Simpan Ke Cache Terbaru
        const serverData = {
          statistik: currentStatistik,
          riwayat: currentRiwayat,
          presensiHariIni: currentPresensi,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(serverData));
      } catch (err) {
        //[cite: 5]
        console.error("Error fetching dashboard:", err); //[cite: 5]
      } finally {
        setLoading(false); //[cite: 5]
      }
    }

    loadDashboard(); //[cite: 5]
  }, [router]); //[cite: 5]

  function handleLogout() {
    if (!confirm("Keluar dari aplikasi?")) return; //[cite: 5]
    localStorage.removeItem(CACHE_KEY); // Menghapus cache pada saat logout
    logout(); //[cite: 5]
    router.replace("/magang/login"); //[cite: 5]
  }

  // Helper untuk menentukan apakah presensi hari ini "SUDAH"[cite: 5]
  // (Menggunakan gabungan antara API dan LocalStorage)[cite: 5]
  const isSudahPresensi = !!presensiHariIni || hasPresensiTodayLocal; //[cite: 5]

  // --- TAMPILAN LOADING ANIMATIF ---[cite: 5]
  if (loading) {
    //[cite: 5]
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
    ); //[cite: 5]
  }

  return (
    <main className="min-h-screen bg-slate-50 space-y-6 pb-12">
      {/* HEADER NAVBAR[cite: 5] */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1 rounded-xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png" //[cite: 5]
                alt="Logo" //[cite: 5]
                width={38} //[cite: 5]
                height={38} //[cite: 5]
                className="object-contain" //[cite: 5]
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
            onClick={handleLogout} //[cite: 5]
            className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-white hover:brightness-110 active:scale-95 shadow-md shadow-red-900/30 border border-red-500/30 transition-all" //[cite: 5]
          >
            ❌ LOGOUT
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6 sm:space-y-8">
        {/* HERO BANNER SISWA[cite: 5] */}
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

        {/* STATUS PRESENSI HARI INI[cite: 5] */}
        <div
          className="
rounded-[2rem]
bg-gradient-to-br
from-[#FFFDF8]
via-[#FFF5D9]
to-[#F7E7A7]
p-5 sm:p-6
border border-[#E8D28A]
shadow-[0_10px_30px_rgba(214,178,63,0.12)]
transition-all duration-300
hover:shadow-[0_16px_40px_rgba(214,178,63,0.18)]
" //[cite: 5]
        >
          <h2 className="text-lg sm:text-xl font-black text-slate-800 mb-4">
            Status Kehadiran Hari Ini
          </h2>

          {isSudahPresensi ? ( //[cite: 5]
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
                disabled //[cite: 5]
                className="rounded-xl bg-slate-300 px-6 py-3 text-sm font-black text-slate-500 cursor-not-allowed whitespace-nowrap" //[cite: 5]
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
                onClick={() => router.push("/magang/presensi")} //[cite: 5]
                className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-rose-500/40 active:scale-[0.96] transition-all whitespace-nowrap" //[cite: 5]
              >
                📸 ISI PRESENSI
              </button>
            </div>
          )}
        </div>

        {/* MENU UTAMA (Tombol Sentuh Besar)[cite: 5] */}
        <div className="grid gap-4 grid-cols-2">
          {isSudahPresensi ? ( //[cite: 5]
            <MenuCardDisabled
              title="Presensi Selesai" //[cite: 5]
              subtitle="Telah diisi hari ini" //[cite: 5]
              icon="✅" //[cite: 5]
            />
          ) : (
            <MenuCard
              title="Presensi Sekarang" //[cite: 5]
              subtitle="Kirim foto & lokasi live" //[cite: 5]
              icon="📸" //[cite: 5]
              bgGrad="from-emerald-500 to-teal-600 shadow-emerald-500/30" //[cite: 5]
              onClick={() => router.push("/magang/presensi")} //[cite: 5]
            />
          )}

          <MenuCard
            title="Riwayat Lengkap" //[cite: 5]
            subtitle="Lihat semua datamu" //[cite: 5]
            icon="📋" //[cite: 5]
            bgGrad="from-blue-500 to-indigo-600 shadow-blue-500/30" //[cite: 5]
            onClick={() => router.push("/magang/rekap")} //[cite: 5]
          />
        </div>

        {/* INFORMASI & STATISTIK SISWA[cite: 5] */}
        <div
          className="rounded-[2rem]
bg-gradient-to-br
from-[#FFFDF8]
via-[#FFF7E5]
to-[#F8E7A5]
border border-[#E8D28A]
shadow-[0_10px_30px_rgba(214,178,63,0.12)]
transition-all duration-300
hover:shadow-[0_16px_40px_rgba(214,178,63,0.18)] p-5 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100" //[cite: 5]
        >
          <h2 className="text-xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-4">
            Statistik & Profil Kamu
          </h2>

          <div className="grid gap-3 sm:gap-5 grid-cols-2 xl:grid-cols-4 mb-8">
            <Card
              title="Hadir" //[cite: 5]
              value={statistik?.hadir ?? 0} //[cite: 5]
              accentColor="border-emerald-500" //[cite: 5]
              textColor="text-emerald-600" //[cite: 5]
              icon="✅" //[cite: 5]
            />
            <Card
              title="Izin" //[cite: 5]
              value={statistik?.izin ?? 0} //[cite: 5]
              accentColor="border-amber-500" //[cite: 5]
              textColor="text-amber-600" //[cite: 5]
              icon="📝" //[cite: 5]
            />
            <Card
              title="Sakit" //[cite: 5]
              value={statistik?.sakit ?? 0} //[cite: 5]
              accentColor="border-blue-500" //[cite: 5]
              textColor="text-blue-600" //[cite: 5]
              icon="🤒" //[cite: 5]
            />
            <Card
              title="Kehadiran" //[cite: 5]
              value={`${statistik?.persentaseHadir ?? 0}%`} //[cite: 5]
              accentColor="border-indigo-500" //[cite: 5]
              textColor="text-indigo-600" //[cite: 5]
              icon="📈" //[cite: 5]
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-100">
            <Info label="ID Siswa" value={user.id} />
            <Info label="Guru Pembimbing" value={user.namaGuru} />
            <Info label="Tempat Magang" value={user.tempatMagang} />
          </div>
        </div>

        {/* RIWAYAT TERBARU[cite: 5] */}
        <div
          className="rounded-[2rem]
bg-gradient-to-br
from-[#FFFDF8]
via-[#FFF7E5]
to-[#F8E7A5]
border border-[#E8D28A]
shadow-[0_10px_30px_rgba(214,178,63,0.12)]
overflow-hidden
transition-all duration-300
hover:shadow-[0_16px_40px_rgba(214,178,63,0.18)] shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden" //[cite: 5]
        >
          <div className="border-b border-slate-100 p-5 bg-gradient-to-r from-slate-50 to-white">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
              ⏳ Riwayat Terakhir
            </h2>
          </div>

          <div className="p-4 sm:p-6">
            {riwayat.length === 0 ? ( //[cite: 5]
              <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                <p className="text-sm font-bold text-slate-400">
                  Belum ada riwayat presensi.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {riwayat.map((item, index) => {
                  //[cite: 5]
                  const statusWarna = //[cite: 5]
                    item.STATUS === "Hadir" //[cite: 5]
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200" //[cite: 5]
                      : item.STATUS === "Izin" //[cite: 5]
                        ? "bg-amber-100 text-amber-700 border-amber-200" //[cite: 5]
                        : "bg-blue-100 text-blue-700 border-blue-200"; //[cite: 5]

                  return (
                    <div
                      key={index} //[cite: 5]
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow" //[cite: 5]
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
                        className={`inline-flex items-center justify-center rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider border ${statusWarna}`} //[cite: 5]
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
  ); //[cite: 5]
}

/* --- REUSABLE COMPONENTS ---[cite: 5] */

function Info({ label, value, textColor = "text-slate-800" }) {
  //[cite: 5]
  return (
    <div>
      <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-0.5">
        {label}
      </p>
      <p className={`text-sm sm:text-base font-black ${textColor} truncate`}>
        {value}
      </p>
    </div>
  ); //[cite: 5]
}

function Card({ title, value, accentColor, textColor, icon }) {
  //[cite: 5]
  return (
    <div
      className={`rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-100 border-t-4 ${accentColor} relative overflow-hidden group`} //[cite: 5]
    >
      <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">
        {title}
      </p>
      <h2
        className={`mt-1 sm:mt-2 text-2xl sm:text-3xl font-black ${textColor}`} //[cite: 5]
      >
        {value}
      </h2>
      <div
        className="
 absolute
 top-4
 right-4
 w-12
 h-12
 rounded-full
 bg-white/80
 border
 border-yellow-300
 shadow-lg
 flex
 items-center
 justify-center
 text-2xl
" //[cite: 5]
      >
        {icon}
      </div>
    </div>
  ); //[cite: 5]
}

function MenuCard({ title, subtitle, icon, bgGrad, onClick }) {
  //[cite: 5]
  return (
    <button
      onClick={onClick} //[cite: 5]
      className={`w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${bgGrad} text-white shadow-lg flex flex-col justify-between h-32 sm:h-36 transition-all active:scale-[0.96] active:brightness-95 focus:outline-none border border-white/10`} //[cite: 5]
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
  ); //[cite: 5]
}

// Komponen Card Menu khusus yang keadaannya dinonaktifkan (Disabled)[cite: 5]
function MenuCardDisabled({ title, subtitle, icon }) {
  //[cite: 5]
  return (
    <button
      disabled //[cite: 5]
      className="w-full text-left p-4 sm:p-5 rounded-2xl bg-slate-200 text-slate-400 flex flex-col justify-between h-32 sm:h-36 cursor-not-allowed border border-slate-300" //[cite: 5]
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
  ); //[cite: 5]
}
