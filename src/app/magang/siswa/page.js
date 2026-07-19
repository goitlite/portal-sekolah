"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { getSiswaByGuru, deleteSiswa } from "../lib/api";
import { getSession, isLoggedIn } from "../lib/auth";

// --- KOMPONEN BADGE NAMA ---
const NamaBadge = ({ rawName }) => {
  if (!rawName) return null;

  const match = rawName.match(/(.+?)\s*\[(.*?)\]/);

  if (!match) {
    return <span className="text-slate-800">{rawName}</span>;
  }

  const namaSiswa = match[1].trim();
  const kelas = match[2].trim();

  let badgeClasses = "bg-blue-50 border-blue-200 text-blue-700";
  if (kelas === "TJKT 1") {
    badgeClasses = "bg-emerald-50 border-emerald-200 text-emerald-700";
  } else if (kelas === "TJKT 2") {
    badgeClasses = "bg-violet-50 border-violet-200 text-violet-700";
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-slate-800 leading-tight">{namaSiswa}</span>{" "}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 sm:px-2 border rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm ${badgeClasses}`}
      >
        {kelas}
      </span>
    </span>
  );
};

export default function DaftarSiswa() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [siswa, setSiswa] = useState([]);

  useEffect(() => {
    async function loadData() {
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

      try {
        const result = await getSiswaByGuru(session.id);

        if (result.success) {
          // Mengurutkan data siswa secara alfabetis
          const sortedSiswa = [...result.data].sort((a, b) =>
            a.NAMA.localeCompare(b.NAMA, "id", { sensitivity: "base" }),
          );
          setSiswa(sortedSiswa);
        } else {
          alert(result.message);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal mengambil data siswa.");
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  async function handleDelete(id) {
    const yakin = confirm("Apakah Anda yakin ingin menghapus siswa ini?");

    if (!yakin) return;

    try {
      const result = await deleteSiswa(id);

      if (result.success) {
        alert("Siswa berhasil dihapus.");
        setSiswa((prev) => prev.filter((item) => item.ID !== id));
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus siswa.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 flex flex-col">
      {/* HEADER FIXED (Solid & Mirip Rekap) */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg border-b border-blue-700/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white/10 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={36}
                height={36}
                className="object-contain sm:w-[44px] sm:h-[44px]"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                DAFTAR SISWA
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300 tracking-wide mt-0.5">
                Guru: {user?.nama || "Memuat..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/magang/guru")}
            className="rounded-lg sm:rounded-xl bg-white/10 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm"
          >
            Kembali
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* HEADER KONTEN & TOMBOL TAMBAH */}
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              Sistem Bimbingan
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              Data Siswa Magang
            </h2>
            <p className="mt-1 text-slate-500 font-medium text-sm">
              Total terdaftar:{" "}
              <span className="font-bold text-slate-700">
                {siswa.length} Siswa
              </span>
            </p>
          </div>

          <button
            onClick={() => router.push("/magang/tambah")}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:scale-105 flex items-center justify-center gap-2 w-full md:w-auto"
          >
            <span className="text-lg leading-none">+</span>
            <span>Tambah Siswa</span>
          </button>
        </div>

        {/* LOADING & KONDISI KOSONG */}
        {loading ? (
          <div className="mt-20 flex flex-col items-center justify-center text-slate-500">
            <div className="relative h-12 w-12 sm:h-14 sm:w-14">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 font-semibold text-sm">Memuat data siswa...</p>
          </div>
        ) : siswa.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 p-10 sm:p-16 text-center shadow-sm">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-xl font-black text-slate-700">
              Belum Ada Siswa
            </h2>
            <p className="mt-2 text-slate-500 text-sm">
              Guru ini belum memiliki siswa magang di dalam sistem.
            </p>
          </div>
        ) : (
          /* GRID KARTU SISWA (Dibuat Lebih Rapat) */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {siswa.map((item) => {
              const isRPL = item.NAMA.includes("TJKT 1");
              const isTKJ = item.NAMA.includes("TJKT 2");
              const accentColor = isRPL
                ? "bg-emerald-500"
                : isTKJ
                  ? "bg-violet-500"
                  : "bg-blue-500";

              return (
                <div
                  key={item.ID}
                  className="group flex flex-col bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 relative overflow-hidden h-full"
                >
                  {/* Garis Warna Aksen di Atas Kartu */}
                  <div
                    className={`absolute top-0 left-0 w-full h-1 ${accentColor}`}
                  ></div>

                  <h2 className="text-base sm:text-lg font-bold text-slate-800 flex flex-wrap items-center gap-1.5 mb-3">
                    <NamaBadge rawName={item.NAMA} />
                  </h2>

                  {/* Konten Kartu yang Lebih Kompak */}
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        ID Siswa
                      </p>
                      <p className="font-bold text-slate-700 text-xs">
                        {item.ID}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        Tempat Magang
                      </p>
                      <p className="font-semibold text-slate-700 text-xs leading-snug line-clamp-2">
                        {item.TEMPAT_MAGANG}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="mt-auto flex gap-2 pt-3 border-t border-slate-100">
                    <button
                      onClick={() => router.push(`/magang/edit/${item.ID}`)}
                      className="flex-1 rounded-lg bg-amber-50 border border-amber-200 py-2 text-xs font-bold text-amber-600 hover:bg-amber-500 hover:text-white transition-colors"
                    >
                      ✏ Edit
                    </button>

                    <button
                      onClick={() => handleDelete(item.ID)}
                      className="flex-1 rounded-lg bg-rose-50 border border-rose-200 py-2 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition-colors"
                    >
                      🗑 Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
