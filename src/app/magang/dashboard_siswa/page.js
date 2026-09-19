"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  getStatistikSiswa,
  getRiwayatSiswa,
  getPresensiHariIni,
  getDataSiswaWali,
  getBiodataSiswa,
  getSiswaById,
} from "../lib/api";

import { getSession, saveSession, isLoggedIn, logout } from "../lib/auth";

// 🎓 MODUL RUANG BELAJAR
import RuangBelajarTKA from "./RuangBelajarTKA";

// 📚 MODAL MAPEL & 📝 MODAL CATATAN WALI
import ModalKehadiranMapel from "./ModalKehadiranMapel";
import ModalCatatanWali from "./ModalCatatanWali";
import ModalPresensiPetugasSiswa from "./ModalPresensiPetugasSiswa";
import { findPetugasWaliKelasForSiswa } from "../lib/petugasPresensiHelper";

// --- HELPER FORMAT WAKTU & TANGGAL ---
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

// Helper format bulan-tahun untuk tampilan periode catatan wali
const NAMA_BULAN_INDO = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatBulanTahun(nilaiBulan) {
  if (!nilaiBulan) return "-";
  const [tahun, bulan] = String(nilaiBulan).split("-");
  const indexBulan = Number(bulan) - 1;
  const namaBulan = NAMA_BULAN_INDO[indexBulan] || bulan;
  return `${namaBulan} ${tahun}`;
}

// Timeout helper agar Apps Script tidak menggantung tanpa batas
function fetchWithTimeout(fn, ms = 15000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Waktu tunggu server habis (timeout).")),
        ms,
      ),
    ),
  ]);
}

// Retry ringan untuk cold-start Google Apps Script
async function fetchStepWithRetry(fn, { retries = 1, timeoutMs = 15000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(fn, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }
  throw lastError;
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

  let badgeClasses = "bg-amber-400/20 border-amber-300/40 text-amber-200";
  if (kelas.includes("TJKT") || kelas.includes("TKJ")) {
    badgeClasses = "bg-emerald-500/20 border-emerald-400/40 text-emerald-300";
  } else if (
    kelas.includes("TO") ||
    kelas.includes("TKR") ||
    kelas.includes("TBSM")
  ) {
    badgeClasses = "bg-blue-500/20 border-blue-400/40 text-blue-200";
  } else if (kelas.includes("DPIB") || kelas.includes("GEOMATIKA")) {
    badgeClasses = "bg-purple-500/20 border-purple-400/40 text-purple-200";
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
        className={`inline-flex items-center px-2 py-0.5 border rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider backdrop-blur-sm shadow-sm ${badgeClasses}`}
      >
        {kelas}
      </span>
    </span>
  );
};

export default function DashboardSiswa() {
  const router = useRouter();
  const CACHE_KEY = "dashboardSiswaCache_v3";

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadFailedMessage, setLoadFailedMessage] = useState("");
  const isMountedRef = useRef(true);

  const [user, setUser] = useState(null);
  const [guruWali, setGuruWali] = useState("-");
  const [statistik, setStatistik] = useState(null);
  const [riwayat, setRiwayat] = useState([]);
  const [catatanWali, setCatatanWali] = useState(null);

  const [presensiHariIni, setPresensiHariIni] = useState(null);
  const [hasPresensiTodayLocal, setHasPresensiTodayLocal] = useState(false);

  // Modals state
  const [showModalCatatan, setShowModalCatatan] = useState(false);
  const [showModalMapel, setShowModalMapel] = useState(false);
  const [showModalPresensiPetugas, setShowModalPresensiPetugas] =
    useState(false);

  // Status Petugas Presensi Kelas
  const [petugasWaliData, setPetugasWaliData] = useState(null);

  const loadDashboard = useCallback(async () => {
    if (!isLoggedIn()) {
      router.replace("/magang/login");
      return;
    }

    const session = getSession();

    if (!session || session.role !== "siswa") {
      router.replace("/magang/login");
      return;
    }

    if (isMountedRef.current) {
      setUser(session);
      setLoadFailed(false);
      setLoadFailedMessage("");
      setLoadProgress(8);

      // Cek apakah siswa merupakan petugas presensi kelas
      const pInfo = findPetugasWaliKelasForSiswa(session.id);
      if (pInfo) {
        setPetugasWaliData(pInfo);
      }
    }

    // Cek preference lokal tanggal presensi hari ini
    const lastPresensiDate = localStorage.getItem("magang_last_presensi_date");
    const todayStr = new Date().toLocaleDateString("id-ID");
    if (lastPresensiDate === todayStr && isMountedRef.current) {
      setHasPresensiTodayLocal(true);
    }

    let fallbackStatistik = null;
    let fallbackRiwayat = [];
    let fallbackPresensi = null;
    let fallbackGuruWali = "-";
    let fallbackCatatanWali = null;
    let usedCache = false;

    // 1. BACA CACHE & INSTANT RENDER
    const cachedDataStr = localStorage.getItem(CACHE_KEY);
    if (cachedDataStr && isMountedRef.current) {
      try {
        const cachedData = JSON.parse(cachedDataStr);
        const isValid =
          cachedData &&
          typeof cachedData === "object" &&
          Array.isArray(cachedData.riwayat);

        if (isValid) {
          fallbackStatistik = cachedData.statistik || null;
          fallbackRiwayat = cachedData.riwayat || [];
          fallbackPresensi = cachedData.presensiHariIni || null;
          fallbackGuruWali = cachedData.guruWali || "-";
          fallbackCatatanWali = cachedData.catatanWali || null;

          setStatistik(fallbackStatistik);
          setRiwayat(fallbackRiwayat);
          setPresensiHariIni(fallbackPresensi);
          setGuruWali(fallbackGuruWali);
          setCatatanWali(fallbackCatatanWali);
          setLoading(false);
          usedCache = true;
        } else {
          localStorage.removeItem(CACHE_KEY);
        }
      } catch (error) {
        console.error("Gagal membaca cache dashboard siswa:", error);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    // 2. FETCH DATA SECARA PARALEL DENGAN PROGRESS BERTINGKAT
    const totalSteps = 6;
    let doneSteps = 0;
    const bumpProgress = () => {
      doneSteps += 1;
      if (isMountedRef.current) {
        setLoadProgress(10 + Math.round((doneSteps / totalSteps) * 85));
      }
    };

    try {
      const [stat, history, today, waliResult, biodataResult, siswaResult] =
        await Promise.allSettled([
          fetchStepWithRetry(() => getStatistikSiswa(session.id)).finally(
            bumpProgress,
          ),
          fetchStepWithRetry(() => getRiwayatSiswa(session.id)).finally(
            bumpProgress,
          ),
          fetchStepWithRetry(() => getPresensiHariIni(session.idGuru)).finally(
            bumpProgress,
          ),
          fetchStepWithRetry(() => getDataSiswaWali("ALL")).finally(
            bumpProgress,
          ),
          fetchStepWithRetry(() => getBiodataSiswa(session.id)).finally(
            bumpProgress,
          ),
          fetchStepWithRetry(() => getSiswaById(session.id)).finally(
            bumpProgress,
          ),
        ]);

      if (!isMountedRef.current) return;

      let currentStatistik = fallbackStatistik;
      let currentRiwayat = fallbackRiwayat;
      let currentPresensi = fallbackPresensi;
      let currentGuruWali = fallbackGuruWali;
      let currentCatatanWali = fallbackCatatanWali;

      // Hasil Sinkronisasi Data Siswa (Tempat Magang & Status Terbaru)
      if (
        siswaResult.status === "fulfilled" &&
        siswaResult.value?.success &&
        siswaResult.value.data
      ) {
        const sData = siswaResult.value.data;
        const freshTempat = sData.TEMPAT_MAGANG || sData.tempatMagang || "";
        const freshStatus = sData.STATUS || sData.status || "";
        const freshGuru = sData.NAMA_GURU || sData.namaGuru || "";
        const freshIdGuru = sData.ID_GURU || sData.idGuru || "";

        setUser((prev) => {
          const updated = {
            ...prev,
            tempatMagang:
              freshTempat !== undefined ? freshTempat : prev?.tempatMagang,
            status: freshStatus !== undefined ? freshStatus : prev?.status,
            namaGuru: freshGuru || prev?.namaGuru,
            idGuru: freshIdGuru || prev?.idGuru,
          };
          try {
            saveSession(updated);
          } catch (e) {}
          return updated;
        });
      }

      // Hasil Statistik
      if (stat.status === "fulfilled" && stat.value?.success) {
        currentStatistik = stat.value.data;
        setStatistik(currentStatistik);
      }

      // Hasil Riwayat
      if (history.status === "fulfilled" && history.value?.success) {
        currentRiwayat = (history.value.data || []).slice(0, 5);
        setRiwayat(currentRiwayat);
      }

      // Hasil Presensi Hari Ini
      if (today.status === "fulfilled" && today.value?.success) {
        const dataSaya = (today.value.data || []).find(
          (x) => String(x.ID_SISWA).trim() === String(session.id).trim(),
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
        if (siswaSaya?.namaGuru && siswaSaya.namaGuru !== "Tanpa Guru Wali") {
          currentGuruWali = siswaSaya.namaGuru;
        } else {
          currentGuruWali = "-";
        }
        setGuruWali(currentGuruWali);
      }

      // Hasil Biodata & Catatan Perkembangan Wali
      if (
        biodataResult.status === "fulfilled" &&
        biodataResult.value?.success
      ) {
        const bioData = biodataResult.value.data || {};
        currentCatatanWali = {
          periodeAwal: bioData.periodeAwal || "",
          periodeAkhir: bioData.periodeAkhir || "",
          desAkademik: bioData.desAkademik || "",
          tinAkademik: bioData.tinAkademik || "",
          ketAkademik: bioData.ketAkademik || "",
          desKarakter: bioData.desKarakter || "",
          tinKarakter: bioData.tinKarakter || "",
          ketKarakter: bioData.ketKarakter || "",
          desSosial: bioData.desSosial || "",
          tinSosial: bioData.tinSosial || "",
          ketSosial: bioData.ketSosial || "",
          desDisiplin: bioData.desDisiplin || "",
          tinDisiplin: bioData.tinDisiplin || "",
          ketDisiplin: bioData.ketDisiplin || "",
          desPotensi: bioData.desPotensi || "",
          tinPotensi: bioData.tinPotensi || "",
          ketPotensi: bioData.ketPotensi || "",
        };
        setCatatanWali(currentCatatanWali);
      }

      setLoadProgress(100);

      // Simpan Cache Lengkap Terbaru
      const serverData = {
        statistik: currentStatistik,
        riwayat: currentRiwayat,
        presensiHariIni: currentPresensi,
        guruWali: currentGuruWali,
        catatanWali: currentCatatanWali,
      };

      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(serverData));
      } catch (cacheErr) {
        console.warn("Cache dashboard siswa dilewati:", cacheErr);
      }
    } catch (err) {
      console.error("Error fetching dashboard siswa:", err);
      if (!usedCache) {
        setLoadFailed(true);
        setLoadFailedMessage(
          "Terjadi kendala saat mengambil data siswa dari server. Periksa koneksi internet Anda.",
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [router, CACHE_KEY]);

  useEffect(() => {
    isMountedRef.current = true;
    loadDashboard();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadDashboard]);

  // Cek berkala / saat tab kembali aktif jika penunjukan baru saja dilakukan guru
  useEffect(() => {
    if (!user?.id) return;
    const checkPetugas = () => {
      const pInfo = findPetugasWaliKelasForSiswa(user.id);
      if (pInfo) {
        setPetugasWaliData(pInfo);
      }
    };
    checkPetugas();
    window.addEventListener("focus", checkPetugas);
    return () => {
      window.removeEventListener("focus", checkPetugas);
    };
  }, [user?.id]);

  function handleLogout() {
    if (!confirm("Keluar dari portal sekolah?")) return;
    localStorage.removeItem(CACHE_KEY);
    logout();
    router.replace("/magang/login");
  }

  const rawStatus = String(user?.status || user?.STATUS || "")
    .trim()
    .toUpperCase();
  const rawTempat = String(
    user?.tempatMagang || user?.TEMPAT_MAGANG || "",
  ).trim();
  const isSedangMagang =
    rawStatus === "MAGANG" ||
    rawStatus === "SEDANG_MAGANG" ||
    (rawTempat !== "" && rawTempat !== "-" && rawStatus !== "BELUM_MAGANG");

  const sudahMagang = isSedangMagang;
  const isSudahPresensi = !!presensiHariIni || hasPresensiTodayLocal;
  const fotoTerbaru = riwayat.length > 0 ? riwayat[0].FOTO : null;

  // Cek ada catatan wali terisi
  const adaCatatanWali =
    catatanWali &&
    (catatanWali.desAkademik ||
      catatanWali.desKarakter ||
      catatanWali.desSosial ||
      catatanWali.desDisiplin ||
      catatanWali.desPotensi);

  // Status gagal total
  if (loadFailed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3">⚠️</p>
          <h2 className="text-lg font-black text-slate-800 mb-2">
            Gagal Memuat Dashboard Siswa
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            {loadFailedMessage ||
              "Terjadi kendala saat mengambil data dari server."}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setLoadProgress(0);
              loadDashboard();
            }}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 shadow-lg shadow-indigo-200"
          >
            🔄 Muat Ulang
          </button>
        </div>
      </main>
    );
  }

  // Tampilan Loading Bar (Persis seperti guru/page.js)
  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xs text-center">
          <p className="mb-4 text-base font-bold text-slate-600 tracking-wide">
            Menyinkronkan Dashboard Siswa...
          </p>
          <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-black text-slate-400">
            {Math.round(loadProgress)}%
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 space-y-6 pb-14 relative">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1.5 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
              <Image
                src="/logo.png"
                alt="Logo"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-amber-200">
                PORTAL SISWA
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-white border-2 border-amber-300/80 shadow-md hover:border-amber-200 hover:brightness-110 active:scale-95 transition-all duration-200"
          >
            ❌ LOGOUT
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6 sm:space-y-8">
        {/* HERO BANNER SISWA */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl border border-blue-800">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-amber-400 opacity-15 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
              🎓 Dashboard Peserta Didik
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              Selamat Datang,
            </h2>
            <h3 className="mt-1 text-xl sm:text-3xl font-extrabold flex flex-wrap items-center gap-2">
              <NamaBadge rawName={user?.nama} isGradient={true} />
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-blue-200 max-w-lg font-medium leading-relaxed">
              Pantau catatan perkembangan wali kelas, kehadiran mata pelajaran,
              dan riwayat presensi harian kamu secara terpadu.
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* MENU UTAMA DASHBOARD */}
        {/* ============================================================ */}
        <div className="space-y-3">
          <div className="flex items-center gap-3 my-1 w-full px-1">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-amber-400 to-yellow-300 rounded-full opacity-70"></div>
            <h3 className="text-xs sm:text-sm font-black tracking-widest text-slate-700 uppercase whitespace-nowrap">
              MENU AKSES CEPAT
            </h3>
            <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-amber-400 to-yellow-300 rounded-full opacity-70"></div>
          </div>

          <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-3">
            {/* ⭐ PETUGAS PRESENSI KELAS (JIKA DITUNJUK OLEH WALI KELAS) */}
            {petugasWaliData && (
              <MenuCard
                title="Presensi Kelas"
                subtitle={`Petugas ${petugasWaliData.namaKelas || "Kelas"}`}
                icon="⭐"
                bgGrad="from-teal-600 via-emerald-600 to-teal-800 shadow-teal-500/25 border-amber-300/40"
                badge="Petugas"
                onClick={() => setShowModalPresensiPetugas(true)}
              />
            )}

            {/* 1. PRESENSI MAGANG HARI INI */}
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
                bgGrad="from-emerald-500 to-teal-600 shadow-emerald-500/25"
                onClick={() => router.push("/magang/presensi")}
              />
            )}

            {/* 2. KEHADIRAN MAPEL (FITUR BARU) */}
            <MenuCard
              title="Kehadiran Mapel"
              subtitle="Cek presensi & nilai pelajaran"
              icon="📚"
              bgGrad="from-blue-600 via-indigo-600 to-blue-800 shadow-indigo-500/25 border-amber-300/40"
              badge="Baru"
              onClick={() => setShowModalMapel(true)}
            />

            {/* 3. CATATAN GURU WALI (FITUR BARU) */}
            <MenuCard
              title="Catatan Guru Wali"
              subtitle="Evaluasi & bimbingan siswa"
              icon="👨‍🏫"
              bgGrad="from-amber-600 via-orange-600 to-amber-700 shadow-amber-500/25 border-amber-300/40"
              badge="Wali"
              onClick={() => setShowModalCatatan(true)}
            />

            {/* 4. RIWAYAT PRESENSI MAGANG */}
            <MenuCard
              title="Riwayat Presensi"
              subtitle="Lihat semua datamu"
              icon="📋"
              bgGrad="from-sky-500 to-blue-600 shadow-sky-500/25"
              onClick={() => {
                if (user) {
                  localStorage.setItem(
                    "targetGuruRekap",
                    user.idGuru || user.namaGuru || "",
                  );
                  localStorage.setItem(
                    "targetTempatRekap",
                    user.tempatMagang || "Semua",
                  );
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

            {/* 5. BIODATA SAYA */}
            <MenuCard
              title="Biodata Saya"
              subtitle="Lihat & edit profil diri"
              icon="👤"
              bgGrad="from-violet-600 to-purple-700 shadow-violet-500/25"
              onClick={() => router.push("/magang/siswa/biodata")}
            />

            {/* 6. KELULUSAN */}
            <MenuCard
              title="Kelulusan"
              subtitle="Informasi status kelulusan"
              icon="🎓"
              bgGrad="from-rose-500 to-pink-600 shadow-rose-500/25"
              onClick={() => router.push("/magang/siswa/kelulusan")}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* BANNER SPOTLIGHT: PETUGAS PRESENSI KELAS (JIKA DITUNJUK) */}
        {/* ============================================================ */}
        {petugasWaliData && (
          <div className="rounded-[2rem] bg-gradient-to-br from-teal-900 via-emerald-900 to-slate-900 p-5 sm:p-7 text-white shadow-lg border border-teal-400/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider border border-amber-400/30">
                  ⭐ Mandat Petugas Presensi Kelas
                </div>
                <h3 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-emerald-200">
                  Petugas Presensi: {petugasWaliData.namaKelas}
                </h3>
                <p className="text-xs sm:text-sm text-teal-100 font-medium leading-relaxed">
                  Kamu ditunjuk untuk mengisi presensi harian seluruh siswa di
                  kelas {petugasWaliData.namaKelas}. Pengisian dilakukan 1 kali
                  sehari dengan default Hadir semua.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowModalPresensiPetugas(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-110 active:scale-95 text-amber-950 text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>📋</span>
                  <span>Isi Presensi Kelas</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* BANNER SPOTLIGHT: CATATAN GURU WALI */}
        {/* ============================================================ */}
        <div className="rounded-[2rem] bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950 p-5 sm:p-7 text-white shadow-lg border border-blue-700/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider border border-amber-400/30">
                📝 Catatan Perkembangan Siswa
              </div>
              <h3 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-yellow-200">
                Catatan dari Guru Wali: {guruWali}
              </h3>
              <p className="text-xs sm:text-sm text-blue-200 font-medium leading-relaxed">
                {catatanWali?.periodeAwal && catatanWali?.periodeAkhir
                  ? `Periode Pemantauan: ${formatBulanTahun(catatanWali.periodeAwal)} — ${formatBulanTahun(catatanWali.periodeAkhir)}`
                  : "Guru wali mencatat perkembangan akademik, karakter, kedisiplinan, sosial, dan potensi bakat kamu."}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowModalCatatan(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 active:scale-95 text-amber-950 text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2"
              >
                <span>🔍</span>
                <span>Buka Catatan Wali</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* INFORMASI & STATISTIK SISWA */}
        {/* ============================================================ */}
        <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FFF7E5] to-[#F8E7A5] border border-[#E8D28A] shadow-[0_10px_30px_rgba(214,178,63,0.12)] p-5 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-amber-200/60 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800">
                Statistik Presensi Magang
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Akumulasi kehadiran magang kamu selama kegiatan berlangsung
              </p>
            </div>
            <button
              onClick={() => setShowModalMapel(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/90 border border-amber-300 text-slate-700 text-xs font-bold hover:bg-amber-100 transition-colors shadow-sm"
            >
              <span>📚</span>
              <span>Lihat Presensi Mapel</span>
            </button>
          </div>

          <div className="grid gap-3 sm:gap-5 grid-cols-2 lg:grid-cols-4">
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white/90 p-4 sm:p-5 rounded-2xl border border-amber-200/70 shadow-inner">
            <Info label="ID Siswa" value={user?.id} />
            <Info label="Guru Pembimbing" value={user?.namaGuru || "-"} />
            <Info label="Guru Wali" value={guruWali} />
            <Info
              label="Tempat Magang"
              value={user?.tempatMagang || "Belum Terdaftar"}
            />
          </div>
        </div>

        {/* ============================================================ */}
        {/* COMPACT TIMELINE PRESENSI TERBARU */}
        {/* ============================================================ */}
        <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FFF7E5] to-[#F8E7A5] border border-[#E8D28A] shadow-[0_10px_30px_rgba(214,178,63,0.12)] overflow-hidden">
          <div className="border-b border-amber-200/60 p-4 sm:p-5 bg-gradient-to-r from-amber-50/60 to-white flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                ⏳ Riwayat Presensi Terakhir
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium">
                5 log presensi magang terakhir yang terekam
              </p>
            </div>

            <div className="shrink-0">
              {fotoTerbaru ? (
                <a
                  href={fotoTerbaru}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] sm:text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
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
              <div className="text-center py-8 bg-white/70 rounded-2xl border border-dashed border-amber-200">
                <p className="text-sm font-bold text-slate-400">
                  Belum ada riwayat presensi magang tercatat.
                </p>
              </div>
            ) : (
              <div className="relative space-y-3">
                <div className="absolute top-3 bottom-4 left-[11px] w-[2px] bg-amber-200 z-0" />

                {riwayat.map((item, index) => {
                  const { tanggal, jam } = formatWaktu(item.TIMESTAMP);

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
                      <div className="shrink-0 mt-3.5 flex justify-center w-[24px]">
                        <div
                          className={`h-4 w-4 rounded-full bg-white border-[3px] ${dotColor} shadow-sm`}
                        />
                      </div>

                      <div className="flex-1 bg-white/95 backdrop-blur-sm p-3.5 sm:p-4 rounded-2xl border border-amber-200/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div
                            className={`font-black text-xs sm:text-sm tracking-wide mb-1 ${statusTextColor}`}
                          >
                            {statusIcon} {statusText}
                          </div>
                          <p className="text-[11px] sm:text-xs font-bold text-slate-600 truncate max-w-[220px] sm:max-w-sm">
                            📍 {item.TEMPAT_MAGANG || "-"}
                          </p>
                        </div>

                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0 mt-1 sm:mt-0">
                          <p className="text-[10px] sm:text-xs font-semibold text-slate-600">
                            {tanggal}
                          </p>
                          <p className="text-[10px] sm:text-xs font-medium text-slate-400">
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

        {/* ============================================================ */}
        {/* 🎓 RUANG BELAJAR SISWA — HANYA TAMPIL JIKA STATUS SISWA SEDANG MAGANG */}
        {/* ============================================================ */}
        {isSedangMagang && <RuangBelajarTKA idSiswa={user?.id} />}
      </div>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}
      <ModalCatatanWali
        isOpen={showModalCatatan}
        onClose={() => setShowModalCatatan(false)}
        catatan={catatanWali}
        guruWali={guruWali}
        user={user}
      />

      <ModalKehadiranMapel
        isOpen={showModalMapel}
        onClose={() => setShowModalMapel(false)}
        user={user}
      />

      {petugasWaliData && (
        <ModalPresensiPetugasSiswa
          isOpen={showModalPresensiPetugas}
          onClose={() => setShowModalPresensiPetugas(false)}
          petugasInfo={petugasWaliData}
          user={user}
        />
      )}
    </main>
  );
}

/* --- REUSABLE COMPONENTS --- */

function Info({ label, value, textColor = "text-slate-800" }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
        {label}
      </p>
      <p className={`text-xs sm:text-sm font-black ${textColor} truncate`}>
        {value}
      </p>
    </div>
  );
}

function Card({ title, value, accentColor, textColor, icon }) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 sm:p-5 shadow-xs border border-amber-200/60 border-t-4 ${accentColor} relative overflow-hidden group hover:shadow-md transition-all`}
    >
      <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">
        {title}
      </p>
      <h2
        className={`mt-1 sm:mt-2 text-2xl sm:text-3xl font-black ${textColor}`}
      >
        {value}
      </h2>
      <div className="absolute top-3.5 right-3.5 w-11 h-11 rounded-full bg-slate-50 border border-amber-200 shadow-sm flex items-center justify-center text-xl">
        {icon}
      </div>
    </div>
  );
}

function MenuCard({ title, subtitle, icon, bgGrad, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${bgGrad} text-white shadow-md flex flex-col justify-between h-32 sm:h-36 transition-all active:scale-[0.97] hover:-translate-y-0.5 hover:shadow-lg focus:outline-none border border-white/15 relative overflow-hidden`}
    >
      {badge && (
        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-amber-400 text-amber-950 text-[9px] font-black uppercase tracking-wider shadow-sm">
          {badge}
        </span>
      )}
      <div className="text-2xl sm:text-3xl bg-white/20 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-white/20 shadow-inner">
        {icon}
      </div>
      <div>
        <h2 className="text-sm sm:text-base font-black tracking-tight leading-snug">
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
        <h2 className="text-sm sm:text-base font-black tracking-tight leading-snug">
          {title}
        </h2>
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-0.5">
          {subtitle}
        </p>
      </div>
    </button>
  );
}
