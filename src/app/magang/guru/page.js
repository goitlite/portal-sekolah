"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// FIX PATH IMPORT: Dikembalikan ke ../lib sesuai struktur Bapak
import { getDashboardGuru } from "../lib/api";
import { getSession, isLoggedIn, logout } from "../lib/auth";

export default function DashboardGuru() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [dashboard, setDashboard] = useState({
    jumlahSiswa: "--",
    hadirHariIni: "--",
    totalHadir: "--",
    izinSakit: "--",
    aktivitas: [],
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

      // PERBAIKAN 2: Menggunakan blok try-catch-finally agar loading aman
      try {
        const result = await getDashboardGuru(session.id);
        console.log("Dashboard Result :", result);

        // PERBAIKAN 1 & 6: Pengecekan ketat untuk result.success dan result.data
        if (result.success && result.data) {
          setDashboard(result.data);
        } else {
          console.log("Response dari API:", result);
          alert(
            result.message ||
              "Data dashboard tidak ditemukan atau format Apps Script belum sesuai.",
          );
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        alert(
          "Gagal mengambil dashboard. Periksa koneksi atau Apps Script Anda.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, [router]);

  function handleLogout() {
    if (!confirm("Keluar dari aplikasi?")) return;
    logout();
    router.replace("/magang/login");
  }

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700"></div>
          <p className="mt-4 text-sm text-slate-500">Memuat Dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white border-b shadow-sm">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={45} height={45} />
            <div>
              <h1 className="font-black text-slate-800">PRESENSI MAGANG</h1>
              <p className="text-xs text-slate-500">SMKN 1 TELUK KUANTAN</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-6">
        {/* HERO */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-8 text-white shadow-xl">
          <p className="text-sm uppercase tracking-widest text-amber-300">
            Workspace Guru Pembimbing
          </p>
          <h2 className="mt-3 text-4xl font-black">Selamat Datang</h2>
          <h3 className="mt-2 text-2xl font-bold">{user?.nama}</h3>
          <p className="mt-2 text-blue-200">
            Monitoring seluruh aktivitas siswa magang.
          </p>
        </div>

        {/* CARD */}
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {/* PERBAIKAN 4: Menggunakan Nullish Coalescing (??) agar default ke "--" */}
          <Card title="Jumlah Siswa" value={dashboard?.jumlahSiswa ?? "--"} />
          <Card
            title="Hadir Hari Ini"
            value={dashboard?.hadirHariIni ?? "--"}
          />
          <Card title="Total Kehadiran" value={dashboard?.totalHadir ?? "--"} />
          <Card title="Izin / Sakit" value={dashboard?.izinSakit ?? "--"} />
        </div>

        {/* MENU */}
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {/* PERBAIKAN 5: Menu sudah menggunakan onClick dengan router.push */}
          <MenuCard
            title="Daftar Siswa"
            subtitle="Kelola data siswa magang"
            onClick={() => router.push("/magang/siswa")}
          />
          <MenuCard
            title="Tambah Siswa"
            subtitle="Membuat ID siswa baru"
            onClick={() => router.push("/magang/tambah")}
          />
          <MenuCard
            title="Monitoring Lapangan"
            subtitle="Foto monitoring kegiatan siswa"
            onClick={() => router.push("/magang/guru/monitoring")}
          />
          <MenuCard
            title="Rekap Kehadiran"
            subtitle="Lihat rekap bulanan"
            onClick={() => router.push("/magang/rekap")}
          />
          <MenuCard
            title="Cetak Rekap"
            subtitle="Cetak PDF / Excel"
            onClick={() => alert("Fitur cetak sedang dikembangkan")}
          />
        </div>

        {/* AKTIVITAS */}
        <div className="mt-10 rounded-3xl bg-white shadow overflow-hidden">
          <div className="border-b p-5">
            <h2 className="font-black text-slate-800">
              Aktivitas Presensi Terbaru
            </h2>
          </div>

          <div className="p-6">
            {/* PERBAIKAN 3: Pengecekan eksistensi array aktivitas sebelum map */}
            {!dashboard?.aktivitas || dashboard.aktivitas.length === 0 ? (
              <p className="text-center text-slate-500">Belum ada aktivitas.</p>
            ) : (
              <div className="space-y-1">
                {dashboard.aktivitas.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{item.nama}</p>
                      <p className="text-xs text-slate-500">{item.waktu}</p>
                    </div>
                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                      {item.status}
                    </span>
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

function Card({ title, value }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow transition hover:shadow-md">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <h2 className="mt-3 text-4xl font-black text-blue-900">{value}</h2>
    </div>
  );
}

function MenuCard({ title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-2xl border border-transparent bg-white p-6 text-left shadow transition hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl focus:outline-none"
    >
      <h2 className="text-lg font-black text-slate-800">{title}</h2>
      <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
    </button>
  );
}
