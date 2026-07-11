"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  getStatistikSiswa,
  getRiwayatSiswa,
  getPresensiHariIni,
} from "../lib/api";

import { getSession, isLoggedIn, logout } from "../lib/auth";

export default function DashboardSiswa() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [statistik, setStatistik] = useState(null);

  const [riwayat, setRiwayat] = useState([]);

  const [presensiHariIni, setPresensiHariIni] = useState(null);

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

        // Presensi hari ini
        const today = await getPresensiHariIni(session.idGuru);

        if (today.success) {
          const dataSaya = today.data.find((x) => x.ID_SISWA === session.id);

          if (dataSaya) {
            setPresensiHariIni(dataSaya);
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

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700"></div>

          <p className="mt-4 text-slate-500">Memuat Dashboard...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* HEADER */}

      <header className="sticky top-0 z-50 bg-white shadow">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={45} height={45} />

            <div>
              <h1 className="font-black text-slate-800">PRESENSI MAGANG</h1>

              <p className="text-xs text-slate-500">SMKN 1 TELUK KUANTAN</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-6">
        {/* HERO */}

        <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-8 text-white shadow-xl">
          <p className="uppercase tracking-widest text-amber-300 text-sm">
            Dashboard Siswa
          </p>

          <h2 className="mt-3 text-4xl font-black">Selamat Datang</h2>

          <h3 className="mt-2 text-2xl font-bold">{user.nama}</h3>

          <p className="mt-2 text-blue-200">
            Silakan melakukan presensi magang hari ini.
          </p>
        </div>

        {/* DATA SISWA */}

        <div className="mt-8 rounded-3xl bg-white p-8 shadow">
          <h2 className="text-2xl font-black text-slate-800">
            Informasi Siswa
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <Card title="Hadir" value={statistik?.hadir ?? 0} />

            <Card title="Izin" value={statistik?.izin ?? 0} />

            <Card title="Sakit" value={statistik?.sakit ?? 0} />

            <Card
              title="Persentase"
              value={`${statistik?.persentaseHadir ?? 0}%`}
            />
          </div>

          <div className="mt-6 space-y-5">
            <Info label="ID Siswa" value={user.id} />

            <Info label="Guru Pembimbing" value={user.namaGuru} />

            <Info label="Tempat Magang" value={user.tempatMagang} />
          </div>
        </div>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow">
          <h2 className="text-2xl font-black text-slate-800">
            Status Presensi Hari Ini
          </h2>

          {presensiHariIni ? (
            <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-6">
              <h3 className="text-xl font-black text-green-700">
                🟢 Sudah Presensi
              </h3>

              <div className="mt-4 space-y-2">
                <Info label="Status" value={presensiHariIni.STATUS} />

                <Info label="Jam" value={presensiHariIni.TIMESTAMP} />
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
              <h3 className="text-xl font-black text-red-600">
                🔴 Belum Presensi
              </h3>

              <p className="mt-2 text-slate-600">
                Silakan melakukan presensi hari ini.
              </p>
            </div>
          )}
        </div>

        {/* MENU */}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <MenuCard
            title="📍 Presensi Sekarang"
            subtitle="Ambil foto & lokasi"
            onClick={() => router.push("/magang/presensi")}
          />

          <MenuCard
            title="📄 Riwayat Lengkap"
            subtitle="Lihat seluruh presensi"
            onClick={() => router.push("/magang/riwayat")}
          />
        </div>

        <div className="mt-8 rounded-3xl bg-white p-8 shadow">
          <h2 className="text-2xl font-black text-slate-800">
            Riwayat Presensi Terbaru
          </h2>

          {riwayat.length === 0 ? (
            <p className="mt-5 text-slate-500">Belum ada riwayat presensi.</p>
          ) : (
            <div className="mt-5 space-y-4">
              {riwayat.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <p className="font-bold">{item.TIMESTAMP}</p>

                    <p className="text-sm text-slate-500">
                      {item.TEMPAT_MAGANG}
                    </p>
                  </div>

                  <span className="rounded-full bg-blue-700 px-4 py-1 text-white">
                    {item.STATUS}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Info({ label, value }) {
  return (
    <div className="border-b border-slate-200 pb-3">
      <p className="text-xs uppercase text-slate-400">{label}</p>

      <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}

function MenuCard({ title, subtitle, onClick }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl bg-white p-6 text-left shadow hover:-translate-y-1 hover:shadow-xl transition"
    >
      <h2 className="text-xl font-black text-slate-800">{title}</h2>

      <p className="mt-2 text-slate-500">{subtitle}</p>
    </button>
  );
}
function Card({ title, value }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow">
      <p className="text-sm font-semibold text-slate-500">{title}</p>

      <h2 className="mt-3 text-4xl font-black text-blue-900">{value}</h2>
    </div>
  );
}
