"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { login } from "../lib/api";
// 1. IMPORT DIPERBARUI: Menambahkan isLoggedIn dan getSession
import { saveSession, isLoggedIn, getSession } from "../lib/auth";
import InstallPrompt from "@/components/pwa/InstallPrompt";

// =====================================================
// KONFIGURASI PENGAMAN LOGIN (ANTI BRUTE-FORCE)
// =====================================================
// Setelah MAX_ATTEMPTS kali gagal login berturut-turut,
// form dikunci selama LOCK_DURATION_MS (default 2 menit).
// Disimpan di localStorage sehingga tetap terkunci walau
// halaman direfresh, sampai waktu kunci habis.
// CATATAN: Ini proteksi sisi client (per browser/HP). Untuk
// proteksi tambahan di sisi server, bisa ditambahkan rate-limit
// di Login.gs (CacheService) sebagai lapisan kedua nanti.
// =====================================================
const LOGIN_LOCK_KEY = "magang_login_lock";
const MAX_ATTEMPTS = 3;
const LOCK_DURATION_MS = 2 * 60 * 1000; // 2 menit

function formatMMSS(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// =====================================================
// KONFIGURASI CAPTCHA MATEMATIKA (LAPISAN KE-2)
// =====================================================
// Captcha buatan sendiri (bukan reCAPTCHA Google) supaya:
// - Tidak butuh API key/secret key dari pihak ketiga
// - Tidak tergantung koneksi ke server luar (kadang lambat
//   atau diblokir jaringan sekolah)
// - Tidak perlu ubah backend GAS sama sekali
// Muncul otomatis setelah CAPTCHA_AFTER_ATTEMPTS kali gagal,
// dan soal berganti otomatis setiap kali dijawab salah atau
// setiap kali ada percobaan login baru yang gagal.
// =====================================================
const CAPTCHA_AFTER_ATTEMPTS = 1; // captcha aktif setelah 1x gagal

function buatSoalCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1; // 1 - 9
  const b = Math.floor(Math.random() * 9) + 1; // 1 - 9
  return { a, b };
}

export default function LoginMagang() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [recentIds, setRecentIds] = useState([]);

  // 2. STATE BARU: Untuk menahan tampilan form saat sedang mengecek sesi
  const [isChecking, setIsChecking] = useState(true);

  // --- STATE BARU: PENGAMAN ANTI BRUTE-FORCE ---
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [lockUntil, setLockUntil] = useState(0);
  const [remainingTime, setRemainingTime] = useState(0); // dalam detik

  const isLocked = lockUntil > 0 && remainingTime > 0;

  // --- STATE BARU: CAPTCHA MATEMATIKA ---
  const [captchaChallenge, setCaptchaChallenge] = useState({ a: 0, b: 0 });
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaError, setCaptchaError] = useState("");

  // Captcha wajib diisi kalau sudah gagal >= CAPTCHA_AFTER_ATTEMPTS kali
  // dan form belum terkunci.
  const captchaRequired =
    !isLocked && attemptsLeft <= MAX_ATTEMPTS - CAPTCHA_AFTER_ATTEMPTS;

  // Buat soal captcha baru setiap kali captcha jadi wajib
  // (pertama kali dibutuhkan, atau setelah percobaan gagal berikutnya)
  useEffect(() => {
    if (captchaRequired) {
      setCaptchaChallenge(buatSoalCaptcha());
      setCaptchaInput("");
      setCaptchaError("");
    }
  }, [captchaRequired, attemptsLeft]);

  function gantiSoalCaptcha() {
    setCaptchaChallenge(buatSoalCaptcha());
    setCaptchaInput("");
    setCaptchaError("");
  }

  // --- MUAT STATUS KUNCI DARI localStorage SAAT HALAMAN DIBUKA ---
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(LOGIN_LOCK_KEY) || "null");
      if (stored && stored.lockUntil && stored.lockUntil > Date.now()) {
        setLockUntil(stored.lockUntil);
        setAttemptsLeft(0);
      } else if (stored && stored.attempts) {
        setAttemptsLeft(Math.max(0, MAX_ATTEMPTS - stored.attempts));
      }
    } catch (err) {
      // Abaikan jika data korup, anggap belum ada percobaan gagal
    }
  }, []);

  // --- COUNTDOWN TIMER SAAT TERKUNCI ---
  useEffect(() => {
    if (!lockUntil) {
      setRemainingTime(0);
      return;
    }

    const tick = () => {
      const diff = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      setRemainingTime(diff);

      if (diff <= 0) {
        // Waktu kunci habis -> reset otomatis
        setLockUntil(0);
        setAttemptsLeft(MAX_ATTEMPTS);
        try {
          localStorage.removeItem(LOGIN_LOCK_KEY);
        } catch (err) {}
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lockUntil]);

  // --- HELPER: CATAT PERCOBAAN GAGAL ---
  function recordFailedAttempt() {
    try {
      const stored = JSON.parse(localStorage.getItem(LOGIN_LOCK_KEY) || "null");
      let attempts = stored && stored.attempts ? stored.attempts : 0;
      attempts += 1;

      if (attempts >= MAX_ATTEMPTS) {
        const until = Date.now() + LOCK_DURATION_MS;
        localStorage.setItem(
          LOGIN_LOCK_KEY,
          JSON.stringify({ attempts: 0, lockUntil: until }),
        );
        setLockUntil(until);
        setAttemptsLeft(0);
      } else {
        localStorage.setItem(
          LOGIN_LOCK_KEY,
          JSON.stringify({ attempts, lockUntil: 0 }),
        );
        setAttemptsLeft(MAX_ATTEMPTS - attempts);
      }
    } catch (err) {
      // Jika localStorage gagal ditulis, jangan hentikan alur login
    }
  }

  // --- HELPER: RESET PERCOBAAN SAAT LOGIN BERHASIL ---
  function resetLoginAttempts() {
    try {
      localStorage.removeItem(LOGIN_LOCK_KEY);
    } catch (err) {}
    setAttemptsLeft(MAX_ATTEMPTS);
    setLockUntil(0);
  }

  // 3. USE-EFFECT BARU: Logika auto-redirect
  // USE-EFFECT PERBAIKAN
  useEffect(() => {
    if (isLoggedIn()) {
      const session = getSession();
      if (session?.role === "guru") {
        router.replace("/magang/guru");
      } else if (session?.role === "siswa") {
        // Tambahkan pengecekan tempatMagang di sini
        if (!session.tempatMagang || !session.tempatMagang.trim()) {
          router.replace("/magang/dashboard_siswa"); // Belum magang
        } else {
          router.replace("/magang/presensi"); // Sudah magang
        }
      } else if (session?.role === "admin") {
        router.replace("/magang/admin");
      }
    } else {
      setIsChecking(false);
    }
  }, [router]);

  // Ambil data dari localStorage saat halaman dibuka
  useEffect(() => {
    const ids = JSON.parse(localStorage.getItem("magang_recent_ids") || "[]");
    setRecentIds(ids);
  }, []);

  async function handleLogin(e) {
    e.preventDefault();

    // --- CEK KUNCI SEBELUM PROSES LOGIN ---
    if (lockUntil && lockUntil > Date.now()) {
      alert(
        `🔒 Terlalu banyak percobaan gagal.\nSilakan coba lagi dalam ${formatMMSS(
          remainingTime,
        )} menit:detik.`,
      );
      return;
    }

    if (!id.trim()) {
      alert("Masukkan ID.");
      return;
    }

    // --- VALIDASI CAPTCHA (JIKA SEDANG DIWAJIBKAN) ---
    if (captchaRequired) {
      const jawabanBenar = captchaChallenge.a + captchaChallenge.b;

      if (captchaInput.trim() === "") {
        setCaptchaError("Jawaban verifikasi wajib diisi.");
        return;
      }

      if (parseInt(captchaInput, 10) !== jawabanBenar) {
        setCaptchaError("Jawaban verifikasi salah. Soal diganti, coba lagi.");
        gantiSoalCaptcha();
        return;
      }
    }

    setLoading(true);

    try {
      const result = await login(id);

      if (!result.success) {
        // --- ID SALAH / TIDAK DITEMUKAN: CATAT SEBAGAI PERCOBAAN GAGAL ---
        recordFailedAttempt();
        gantiSoalCaptcha();
        alert(result.message);
        return;
      }

      if (!result.data) {
        alert("Data login tidak diterima dari server.");
        return;
      }

      // --- LOGIN BERHASIL: RESET PENGAMAN ---
      resetLoginAttempts();
      setCaptchaInput("");
      setCaptchaError("");

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

  // 4. TAMPILAN LOADING: Muncul sebentar saat sistem mengecek sesi user
  if (isChecking) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
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
          <p className="text-slate-500 font-semibold animate-pulse tracking-wide">
            Memeriksa sesi login...
          </p>
        </div>
      </main>
    );
  }

  // JIKA TIDAK ADA SESI AKTIF (BELUM LOGIN), TAMPILKAN FORM LOGIN
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

          {/* SHAPE LENGKUNGAN SIMETRIS HALUS */}
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

        {/* AREA BAWAH LENGKUNGAN */}
        <div className="bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-500 relative z-10">
          {/* FORM LOGIN */}
          <form
            onSubmit={handleLogin}
            className="px-6 pb-6 pt-4 sm:px-8 sm:pb-8"
          >
            {/* --- BANNER PENGAMAN: TERKUNCI --- */}
            {isLocked && (
              <div className="mb-5 rounded-2xl bg-red-700 text-white px-4 py-3.5 text-center shadow-lg border border-red-900/40">
                <p className="text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                  🔒 Akun Sementara Terkunci
                </p>
                <p className="mt-1 text-2xl font-black tracking-widest tabular-nums">
                  {formatMMSS(remainingTime)}
                </p>
                <p className="mt-1 text-[10px] font-semibold text-red-100">
                  Terlalu banyak percobaan gagal. Silakan tunggu hingga waktu
                  habis.
                </p>
              </div>
            )}

            {/* --- BANNER PENGAMAN: SISA PERCOBAAN --- */}
            {!isLocked && attemptsLeft < MAX_ATTEMPTS && (
              <div className="mb-5 rounded-xl bg-red-950/10 border border-red-900/30 text-red-950 px-4 py-2.5 text-center">
                <p className="text-[11px] font-black">
                  ⚠️ ID salah. Sisa percobaan:{" "}
                  <span className="text-red-700">{attemptsLeft}x</span> sebelum
                  dikunci {LOCK_DURATION_MS / 60000} menit.
                </p>
              </div>
            )}

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
                  disabled={isLocked}
                  className="w-full rounded-2xl border-2 border-amber-600/20 bg-white px-4 py-4 text-center text-3xl font-black tracking-[8px] text-slate-900 outline-none transition-all placeholder:text-slate-200 focus:border-blue-950 focus:ring-4 focus:ring-blue-950/10 shadow-inner group-hover:border-amber-600/40 disabled:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>

              <datalist id="recentIds">
                {recentIds.map((item, index) => (
                  <option key={index} value={item} />
                ))}
              </datalist>
            </div>

            {/* --- KOTAK CAPTCHA MATEMATIKA (MUNCUL SETELAH GAGAL) --- */}
            {captchaRequired && (
              <div className="mb-6 rounded-2xl border-2 border-dashed border-blue-950/30 bg-white/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-[11px] font-black text-blue-950 uppercase tracking-widest">
                    🧠 Verifikasi Keamanan
                  </label>
                  <button
                    type="button"
                    onClick={gantiSoalCaptcha}
                    className="text-[10px] font-bold text-blue-900 underline decoration-dotted"
                  >
                    🔄 Ganti Soal
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 select-none rounded-xl bg-blue-950 py-3 text-center text-xl font-black tracking-wider text-white">
                    {captchaChallenge.a} + {captchaChallenge.b} = ?
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    value={captchaInput}
                    onChange={(e) => {
                      setCaptchaInput(e.target.value.replace(/\D/g, ""));
                      setCaptchaError("");
                    }}
                    placeholder="?"
                    className="w-20 rounded-xl border-2 border-blue-950/20 bg-white px-2 py-3 text-center text-xl font-black text-slate-900 outline-none focus:border-blue-950"
                  />
                </div>

                {captchaError && (
                  <p className="mt-2 text-[11px] font-bold text-red-700">
                    ⚠️ {captchaError}
                  </p>
                )}
              </div>
            )}

            {/* TOMBOL MASUK */}
            <button
              type="submit"
              disabled={loading || isLocked}
              className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 py-4 font-black uppercase text-white shadow-[0_10px_25px_-5px_rgba(15,23,42,0.4)] transition-all hover:-translate-y-0.5 hover:shadow-[0_15px_30px_-5px_rgba(15,23,42,0.5)] disabled:translate-y-0 disabled:opacity-70 disabled:shadow-none flex justify-center items-center gap-2"
            >
              <div className="absolute inset-0 w-full h-full bg-white/10 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out"></div>
              {isLocked ? (
                <span className="relative z-10 tracking-widest text-sm">
                  🔒 TERKUNCI {formatMMSS(remainingTime)}
                </span>
              ) : loading ? (
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

              {/* Garis Pemisah */}
              <div className="hidden sm:block w-[1px] bg-white/40 my-2"></div>
              <div className="block sm:hidden h-[1px] bg-white/40 mx-4"></div>

              {/* Tombol Halaman Utama */}
              <Link
                href="/"
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
                href="/magang/admin"
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
