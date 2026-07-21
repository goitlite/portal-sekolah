"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { addSiswa } from "../lib/api";
import { getSession, isLoggedIn } from "../lib/auth";

export default function TambahSiswaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [guru, setGuru] = useState(null);

  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("TJKT 1");
  const [tempatMagang, setTempatMagang] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/magang/login");
      return;
    }

    const session = getSession();

    if (!session || session.role !== "guru") {
      router.replace("/magang/login");
      return;
    }

    setGuru(session);
    setLoading(false);
  }, [router]);

  async function simpanSiswa() {
    if (nama.trim() === "") {
      alert("Nama siswa belum diisi.");
      return;
    }

    if (tempatMagang.trim() === "") {
      alert("Tempat magang belum diisi.");
      return;
    }

    setSaving(true);

    try {
      const namaSiswaDenganKelas = `${nama.trim()} [${kelas}]`;

      const result = await addSiswa({
        nama: namaSiswaDenganKelas,
        idGuru: guru.id,
        namaGuru: guru.nama,
        tempatMagang: tempatMagang,
      });

      if (result.success) {
        alert("Siswa berhasil ditambahkan.\n\nID Siswa : " + result.data.id);
        router.replace("/magang/siswa");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    }

    setSaving(false);
  }

  // --- TAMPILAN LOADING ---
  if (loading || !guru) {
    return (
      <main className="min-h-screen bg-slate-50 font-sans flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-slate-500">
          <div className="relative h-12 w-12 sm:h-14 sm:w-14">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 font-semibold text-sm">Memuat halaman...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 flex flex-col">
      {/* HEADER FIXED */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg border-b border-blue-700/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
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
                TAMBAH SISWA
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300 tracking-wide mt-0.5">
                Guru: {guru.nama}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-lg sm:rounded-xl bg-white/10 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm"
          >
            Kembali
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="mb-6 sm:mb-8 border-b border-slate-100 pb-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
              Registrasi Baru
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Formulir Data Siswa
            </h2>
            <p className="mt-1 text-slate-500 font-medium text-sm">
              Lengkapi informasi di bawah ini untuk menambahkan siswa magang
              baru.
            </p>
          </div>

          <div className="space-y-5 sm:space-y-6">
            {/* Input Nama (Dengan otomatis toUpperCase) */}
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                placeholder="MASUKKAN NAMA SISWA..."
              />
            </div>

            {/* Input Kelas */}
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                Kelas
              </label>
              <div className="relative">
                <select
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 pr-10 text-sm sm:text-base text-slate-900 font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
                >
                  <option value="TJKT 1">TJKT 1</option>
                  <option value="TJKT 2">TJKT 2</option>
                  <option value="TDPIB">TDPIB</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg
                    className="h-4 w-4 fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Input Tempat Magang (Dengan otomatis toUpperCase) */}
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                Tempat Magang (DUDI)
              </label>
              <input
                type="text"
                value={tempatMagang}
                onChange={(e) => setTempatMagang(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                placeholder="CONTOH: PT. TELKOM INDONESIA"
              />
            </div>
          </div>

          {/* Tombol Aksi */}
          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => router.back()}
              className="w-full sm:w-1/3 rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all text-center"
            >
              Batal
            </button>

            <button
              onClick={simpanSiswa}
              disabled={saving}
              className="w-full sm:w-2/3 group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Menyimpan Data...
                </>
              ) : (
                <>
                  <span className="text-lg leading-none">+</span>
                  <span>Simpan Data Siswa</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
