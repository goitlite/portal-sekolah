"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { login } from "../lib/api";
import { saveSession } from "../lib/auth";
import InstallPrompt from "@/components/pwa/InstallPrompt";

export default function LoginMagang() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentIds, setRecentIds] = useState([]);

  // Ambil data dari localStorage saat halaman dibuka
  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem("magang_recent_ids") || "[]");
    setRecentIds(ids);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();

    if (!id.trim()) {
      alert("Masukkan ID.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(id);

      if (!result.success) {
        alert(result.message);
        return;
      }

      if (!result.data) {
        alert("Data login tidak diterima dari server.");
        return;
      }

      // Simpan ID yang berhasil login ke localStorage
      let ids = JSON.parse(localStorage.getItem("magang_recent_ids") || "[]");
      ids = ids.filter((item) => item !== id);
      ids.unshift(id);
      ids = ids.slice(0, 10);
      localStorage.setItem("magang_recent_ids", JSON.stringify(ids));

      // Simpan hanya data user
      saveSession(result.data);

      // Redirect sesuai role
      switch (result.data.role) {
        case "admin":
          router.replace("/magang/admin");
          return;

        case "guru":
          router.replace("/magang/guru");
          return;

        case "siswa":
          if (!result.data.tempatMagang || !result.data.tempatMagang.trim()) {
            // Belum magang → langsung dashboard siswa
            router.replace("/magang/dashboard_siswa");
          } else {
            // Sudah magang → masuk presensi
            router.replace("/magang/presensi");
          }
          return;

        default:
          alert("Role tidak dikenali : " + result.data.role);
          return;
      }
    } catch (err) {
      console.error(err);
      alert("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      {/* Card Login */}
      <div className="w-full max-w-[420px] bg-white rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden border border-slate-200/60">
        {/* HEADER AREA (Biru Cerah dengan Garis Estetik) */}
        <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 pt-12 pb-16 px-6 text-center overflow-hidden">
          {/* ORNAMEN GARIS-GARIS INDAH & ELEGAN */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute -top-16 -right-16 w-48 h-48 border-[1.5px] border-white/15 rounded-full"></div>
            <div className="absolute -top-8 -right-8 w-48 h-48 border-[1.5px] border-white/20 rounded-full"></div>

            <div className="absolute top-20 -left-20 w-56 h-56 border-[1px] border-white/10 rounded-full"></div>
            <div className="absolute top-28 -left-12 w-56 h-56 border-[1px] border-white/5 rounded-full"></div>

            {/* Garis diagonal tipis bercahaya */}
            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.04)_50%,transparent_75%)] bg-[length:10px_10px]"></div>
          </div>

          {/* LOGO */}
          <div className="relative z-10 mx-auto mb-5 flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-md border border-white/25 shadow-2xl p-2 transition-transform duration-500 hover:scale-105">
            <div className="bg-white rounded-2xl w-full h-full flex items-center justify-center">
              <Image
                src="/logo.png"
                width={64}
                height={64}
                alt="Logo"
                priority
                className="object-contain"
              />
            </div>
          </div>

          <div className="relative z-10">
            <h1 className="text-2xl font-black text-white tracking-tight drop-shadow-md">
              PORTAL AKADEMIK
            </h1>
            <div className="flex items-center justify-center gap-2 mt-1">
              <span className="h-[1px] w-8 bg-white/40"></span>
              <p className="text-[10px] sm:text-xs font-bold text-blue-100 uppercase tracking-[0.2em]">
                SMKN 1 TELUK KUANTAN
              </p>
              <span className="h-[1px] w-8 bg-white/40"></span>
            </div>
          </div>

          {/* SHAPE LENGKUNGAN SIMETRIS HALUS (Warna disamakan dengan awal gradasi emas) */}
          <div className="absolute bottom-[-1px] left-0 w-full overflow-hidden leading-[0]">
            <svg
              className="relative block w-full h-[40px] sm:h-[50px]"
              viewBox="0 0 1200 120"
              preserveAspectRatio="none"
            >
              <path
                d="M0,0 Q600,120 1200,0 L1200,120 L0,120 Z"
                className="fill-amber-400"
              ></path>
            </svg>
          </div>
        </div>

        {/* AREA BAWAH LENGKUNGAN (Dominan Kuning Emas Mewah) */}
        <div className="bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-500 relative z-10">
          {/* FORM LOGIN */}
          <form
            onSubmit={handleLogin}
            className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8"
          >
            <div className="mb-6">
              <label className="mb-2 block text-[11px] font-black text-blue-950 uppercase tracking-widest text-center opacity-85">
                ID Pengguna Guru dan Siswa
              </label>
              <div className="relative group">
                <input
                  list="recentIds"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={id}
                  onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="w-full rounded-2xl border-2 border-amber-600/20 bg-white px-4 py-4 text-center text-3xl font-black tracking-[8px] text-slate-900 outline-none transition-all placeholder:text-slate-200 focus:border-blue-950 focus:ring-4 focus:ring-blue-950/10 shadow-inner group-hover:border-amber-600/40"
                />
              </div>

              <datalist id="recentIds">
                {recentIds.map((item, index) => (
                  <option key={index} value={item} />
                ))}
              </datalist>
            </div>

            {/* TOMBOL MASUK (Biru Navy Kontras Tinggi) */}
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 py-4 font-black uppercase text-white shadow-[0_10px_25px_-5px_rgba(15,23,42,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-5px_rgba(15,23,42,0.5)] disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none flex justify-center items-center gap-2"
            >
              <div className="absolute inset-0 w-full h-full bg-white/10 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out"></div>
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-5 w-5 text-white"
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
                  <span className="relative z-10 tracking-widest text-sm">
                    MEMPROSES...
                  </span>
                </>
              ) : (
                <>
                  <span className="relative z-10 tracking-widest text-base">
                    MASUK
                  </span>
                  <svg
                    className="w-5 h-5 relative z-10"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </>
              )}
            </button>

            {/* TOMBOL LIHAT REKAP */}
            {/* CARD MENU TAMBAHAN (Rekap & Home) */}
            <div className="mt-6 rounded-2xl bg-white/20 border border-white/30 backdrop-blur-sm p-1.5 shadow-sm overflow-hidden flex flex-col sm:flex-row gap-1">
              {/* Tombol Lihat Rekap */}
              <Link
                href="/magang/rekap"
                className="flex-1 group flex items-center justify-center gap-2 text-[11px] sm:text-xs font-black text-blue-950 hover:text-white transition-all py-3 px-2 rounded-xl hover:bg-slate-900/10 active:scale-[0.98]"
              >
                <div className="bg-white/30 p-1.5 rounded-lg group-hover:bg-slate-900/20 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                LIHAT REKAP
              </Link>

              {/* Garis Pemisah (Hanya terlihat di layar agak besar, hilang di layar kecil) */}
              <div className="hidden sm:block w-[1px] bg-white/40 my-2"></div>
              {/* Garis Pemisah untuk layar kecil (Horizontal) */}
              <div className="block sm:hidden h-[1px] bg-white/40 mx-4"></div>

              {/* Tombol Halaman Utama */}
              <Link
                href="/" // Pastikan rute beranda Anda benar
                className="flex-1 group flex items-center justify-center gap-2 text-[11px] sm:text-xs font-black text-amber-950/80 hover:text-white transition-all py-3 px-2 rounded-xl hover:bg-slate-900/10 active:scale-[0.98]"
              >
                <div className="bg-white/30 p-1.5 rounded-lg group-hover:bg-slate-900/20 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                </div>
                MENU UTAMA
              </Link>

              {/* Garis Pemisah Tambahan */}
              <div className="hidden sm:block w-[1px] bg-white/40 my-2"></div>
              <div className="block sm:hidden h-[1px] bg-white/40 mx-4"></div>

              {/* Tombol Buat Akun Guru Pembimbing */}
              <Link
                href="/magang/admin" // Sesuaikan rute ini
                className="flex-1 group flex items-center justify-center gap-2 text-[11px] sm:text-xs font-black text-emerald-950 hover:text-white transition-all py-3 px-2 rounded-xl hover:bg-slate-900/10 active:scale-[0.98]"
              >
                <div className="bg-white/30 p-1.5 rounded-lg group-hover:bg-slate-900/20 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                </div>
                BUAT AKUN GURU
              </Link>
            </div>
          </form>
          {/* FOOTER INFO */}
          <div className="p-5 text-center border-t border-amber-600/20 bg-black/10">
            <p className="text-[11px] sm:text-xs font-bold text-amber-950/80 leading-relaxed">
              ID siswa dibuat otomatis dari Akun Pembimbing/Guru wali
            </p>
          </div>
        </div>
      </div>
      <InstallPrompt />
    </main>
  );
}
