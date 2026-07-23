"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSession, isLoggedIn, logout } from "../lib/auth";

import {
  getDashboardGuru,
  getTempatMagangGuru,
  getAktivitasGuru,
} from "../lib/api";

function formatTanggal(waktu) {
  if (!waktu) return "-";
  const tanggal = new Date(waktu);
  return (
    tanggal.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " WIB"
  );
}

export default function DashboardGuru() {
  const router = useRouter();
  const CACHE_KEY = "dashboardGuruCache";

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [aktivitas, setAktivitas] = useState([]);
  const [tempatMagang, setTempatMagang] = useState([]);
  const [dashboard, setDashboard] = useState({
    jumlahSiswa: "--",
    hadirHariIni: "--",
    totalHadir: "--",
    izinSakit: "--",
  });

  useEffect(() => {
    async function loadDashboard() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();

      if (!session || session.role !== "guru") {
        router.replace("/magang/login");
        return;
      }

      setUser(session);

      // 1. LOAD DATA DARI CACHE (INSTAN / TANPA SPINNER)
      const cachedDataStr = localStorage.getItem(CACHE_KEY);
      if (cachedDataStr) {
        try {
          const cachedData = JSON.parse(cachedDataStr);
          setDashboard(cachedData.dashboard);
          setTempatMagang(cachedData.tempatMagang);
          setAktivitas(cachedData.aktivitas);
          setLoading(false); // Hilangkan loading screen agar responsif
        } catch (error) {
          console.error("Gagal membaca cache dashboard:", error);
        }
      }

      // 2. TETAP AMBIL DATA TERBARU DARI SERVER DI LATAR BELAKANG (BACKGROUND REFRESH)
      try {
        const result = await getDashboardGuru(session.id);

        if (result.success && result.data) {
          const tempat = await getTempatMagangGuru(session.id);
          const aktivitasResult = await getAktivitasGuru(session.id);

          const serverData = {
            dashboard: result.data,
            tempatMagang: tempat.success ? tempat.data : [],
            aktivitas: aktivitasResult.success ? aktivitasResult.data : [],
          };

          // Update State & Simpan Ke Cache Terbaru
          setDashboard(serverData.dashboard);
          setTempatMagang(serverData.tempatMagang);
          setAktivitas(serverData.aktivitas);
          localStorage.setItem(CACHE_KEY, JSON.stringify(serverData));
        } else {
          if (!cachedDataStr) {
            alert(result.message || "Data dashboard tidak ditemukan.");
          }
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  function handleLogout() {
    if (!confirm("Keluar dari aplikasi?")) return;
    localStorage.removeItem(CACHE_KEY); // Menghapus cache guru
    localStorage.removeItem("dashboardSiswaCache"); // Menghapus cache siswa
    logout();
    router.replace("/magang/login");
  }

  function mulaiMonitoring(tempat) {
    localStorage.setItem("tempatMagangMonitoring", tempat);
    router.push("/magang/guru/monitoring");
  }

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-base font-bold text-slate-600 tracking-wide">
            Menyinkronkan Dashboard Guru...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 space-y-6 pb-12">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3">
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
            className="rounded-xl bg-gradient-to-r from-rose-500 to-red-600 px-5 py-2 text-xs sm:text-sm font-black text-white hover:brightness-110 active:scale-95 shadow-md shadow-red-900/30 border border-red-500/30 transition-all"
          >
            ❌ LOGOUT
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl border border-blue-800">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-amber-400 opacity-10 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
              ✨ Workspace Guru Pembimbing
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Selamat Datang,
            </h2>
            <h3 className="mt-1 text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100">
              {user?.nama}
            </h3>
            <p className="mt-2 text-sm text-blue-200 max-w-md font-medium">
              Sistem kendali monitoring, verifikasi, dan rekapitulasi data
              aktivitas siswa magang.
            </p>
          </div>
        </div>

        {/* STATISTIK CARD GRID */}
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          <Card
            title="Jumlah Siswa"
            value={dashboard?.jumlahSiswa ?? "--"}
            accentColor="border-indigo-500"
            textColor="text-indigo-600"
            icon="👥"
          />
          <Card
            title="Hadir Hari Ini"
            value={dashboard?.hadirHariIni ?? "--"}
            accentColor="border-emerald-500"
            textColor="text-emerald-600"
            icon="✅"
          />
          <Card
            title="Total Kehadiran"
            value={dashboard?.totalHadir ?? "--"}
            accentColor="border-blue-500"
            textColor="text-blue-600"
            icon="📊"
          />
          <Card
            title="Izin / Sakit"
            value={dashboard?.izinSakit ?? "--"}
            accentColor="border-amber-500"
            textColor="text-amber-600"
            icon="🤒"
          />
        </div>

        {/* MONITORING LAPANGAN */}
        <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FCE7A4] to-[#F3D36B] p-5 sm:p-6 shadow-[0_12px_35px_rgba(212,175,55,0.22)] border border-[#D9B44A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9B44A]/40 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                📸 Monitoring Lapangan
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-amber-900/70">
                Pilih area penempatan aktif untuk meninjau log presensi mandiri
                siswa.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-3.5">
            {tempatMagang.length === 0 ? (
              <div className="text-center py-6 bg-white/60 rounded-2xl border border-dashed border-[#D9B44A]">
                <p className="text-sm font-bold text-amber-900/60">
                  Belum ada lokasi tempat magang terdaftar.
                </p>
              </div>
            ) : (
              tempatMagang.map((item, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-[#D9B44A]/60 bg-white/80 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-1.5">
                        <span className="text-sm sm:text-base">📍</span>{" "}
                        {item.tempat}
                      </h3>
                      <p className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
                        Terbimbing:{" "}
                        <span className="text-blue-600 font-extrabold">
                          {item.jumlah} Siswa
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => mulaiMonitoring(item.tempat)}
                      className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md shadow-blue-600/30 active:scale-[0.97] hover:brightness-110 flex items-center justify-center gap-2 transition-all"
                    >
                      📷 MONITORING AREA
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* MENU TAMPILAN UTAMA */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <MenuCard
            title="Daftar Siswa"
            subtitle="Kelola profil siswa magang"
            icon="🗂️"
            bgGrad="from-sky-500 to-blue-600 shadow-blue-500/20"
            onClick={() => router.push("/magang/siswa")}
          />
          <MenuCard
            title="Tambah Siswa"
            subtitle="Registrasi akun siswa baru"
            icon="➕"
            bgGrad="from-emerald-500 to-teal-600 shadow-emerald-500/20"
            onClick={() => router.push("/magang/tambah")}
          />
          <MenuCard
            title="Rekap Bulanan"
            subtitle="Pantau performa presensi"
            icon="📅"
            bgGrad="from-amber-500 to-orange-600 shadow-amber-500/20"
            onClick={() => router.push("/magang/rekap")}
          />
          <MenuCard
            title="Cetak Laporan"
            subtitle="Ekspor data PDF / Excel"
            icon="🖨️"
            bgGrad="from-purple-500 to-indigo-600 shadow-purple-500/20"
            onClick={() => alert("Fitur cetak sedang dikembangkan")}
          />
        </div>

        {/* TABEL AKTIVITAS TERBARU */}
        <div className="rounded-[2rem] bg-white border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
          <div className="border-b border-slate-100 p-5 bg-gradient-to-r from-slate-50 to-slate-100">
            <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
              ⚡ Aktivitas Terkini
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Log pengiriman presensi & pemantauan foto riil siswa di lapangan.
            </p>
          </div>

          <div className="p-4 sm:p-6">
            {aktivitas.length === 0 ? (
              <p className="text-center py-8 text-sm font-semibold text-slate-400">
                Belum ada aktivitas presensi masuk hari ini.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                {aktivitas.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-sm"
                  >
                    <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                      <img
                        src={item.foto}
                        alt="Aktivitas"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.border = "2px solid red";
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span
                        className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          item.jenis === "PRESENSI"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {item.jenis}
                      </span>

                      <h3 className="mt-1 text-xs sm:text-sm font-black text-slate-800 truncate">
                        {item.nama}
                      </h3>
                      <p className="text-[11px] font-bold text-slate-500 truncate flex items-center gap-0.5">
                        📍 {item.tempat}
                      </p>
                      <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                        ⏱️ {formatTanggal(item.waktu)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Card({ title, value, accentColor, textColor, icon }) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 sm:p-5 shadow-md border-t-4 ${accentColor} flex flex-col justify-between relative overflow-hidden group`}
    >
      <div>
        <p className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">
          {title}
        </p>
        <h2
          className={`mt-2 text-2xl sm:text-4xl font-black ${textColor} tracking-tight`}
        >
          {value}
        </h2>
      </div>
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
      className={`w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${bgGrad} text-white shadow-lg flex flex-col justify-between h-32 transition-all active:scale-[0.96] active:brightness-95 focus:outline-none border border-white/10`}
    >
      <div className="text-2xl sm:text-3xl bg-white/15 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-white/20 shadow-inner">
        {icon}
      </div>
      <div>
        <h2 className="text-sm sm:text-base font-black tracking-tight leading-snug">
          {title}
        </h2>
        <p className="text-[10px] sm:text-xs text-white/80 font-medium line-clamp-1 mt-0.5">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
