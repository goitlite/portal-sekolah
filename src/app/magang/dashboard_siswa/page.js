"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  getStatistikSiswa,
  getRiwayatSiswa,
  getPresensiHariIni,
  getDataSiswaWali,
  getBiodataSiswa,
  getSiswaById,
  getDashboardKepsekWaliKelas,
} from "../lib/api";

import { getSession, saveSession, isLoggedIn, logout } from "../lib/auth";
import { getExamData } from "@/services/examService";

// 🎓 MODUL RUANG BELAJAR
import RuangBelajarTKA from "./RuangBelajarTKA";

// 📚 MODAL MAPEL & 📝 MODAL CATATAN WALI
import ModalKehadiranMapel from "./ModalKehadiranMapel";
import ModalCatatanWali from "./ModalCatatanWali";
import ModalPresensiPetugasSiswa from "./ModalPresensiPetugasSiswa";
import ModalKartuBarcodeSiswa from "./ModalKartuBarcodeSiswa";
import ModalScanPresensiPetugas from "./ModalScanPresensiPetugas";
import PesanSekolahModal, {
  useJumlahPesanSekolah,
} from "../components/PesanSekolahModal";
import { autoDiscoverMapelForStudent } from "../lib/mapelDiscovery";
import {
  findPetugasWaliKelasForSiswa,
  parseKeteranganWali,
  cachePetugasLocal,
} from "../lib/petugasPresensiHelper";
import {
  getTotalPresensiRegulerToday,
  MAX_PRESENSI_REGULER_PER_HARI,
} from "../lib/presensiRegulerHelper";
import { autoPushSubscribe, runPesanCleanupBackground } from "../lib/pushHelper";

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
  const [showModalTugasDaring, setShowModalTugasDaring] = useState(false);
  const [showModalPresensiPetugas, setShowModalPresensiPetugas] =
    useState(false);
  const [showModalKartuBarcode, setShowModalKartuBarcode] = useState(false);
  const [showModalScanBarcode, setShowModalScanBarcode] = useState(false);
  const [showModalPesan, setShowModalPesan] = useState(false);
  const [unreadPesanCount, refreshPesanCount] = useJumlahPesanSekolah({
    userId: user?.id,
    enabled: !!user?.id,
  });

  // Pra-muat (prefetch) daftar mapel dan guru mapel di latar belakang agar kontak langsung siap instan tanpa harus buka modal mapel
  useEffect(() => {
    if (user?.id) {
      autoDiscoverMapelForStudent(user).catch(() => {});
    }
  }, [user?.id]);

  // Status Petugas Presensi Kelas & Statistik Kehadiran Kelas
  const [petugasWaliData, setPetugasWaliData] = useState(null);
  const [statistikKelas, setStatistikKelas] = useState(null);
  const [loadingStatistikKelas, setLoadingStatistikKelas] = useState(false);

  // Ambil data Wali Kelas siswa dari backend & cek mandat petugas presensi
  const loadDataKelasSiswa = useCallback(async (currentSession) => {
    const sess = currentSession || getSession();
    if (!sess || !sess.id) return;

    setLoadingStatistikKelas(true);
    try {
      // 1. Coba baca cache lokal dulu untuk render instan
      const pInfoLocal = findPetugasWaliKelasForSiswa(sess.id);
      if (pInfoLocal) {
        setPetugasWaliData(pInfoLocal);
      }

      // 2. Ambil data wali kelas (gunakan sessionStorage dulu agar tidak berulang kali fetch)
      const cacheKey = "dashboard_siswa_cache_walikelas";
      let cards = [];
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.cards)) {
            cards = parsed.cards;
          }
        }
      } catch (_) {}

      if (cards.length === 0) {
        const res = await getDashboardKepsekWaliKelas(false);
        if (res && res.success && Array.isArray(res.data?.cards)) {
          cards = res.data.cards;
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
          } catch (_) {}
        }
      }

      if (cards.length > 0) {
        const sid = String(sess.id).trim();

        // Cari kelas siswa di antara seluruh rombel
        const myClass = cards.find((c) => {
          // A. Cek di daftarSiswa
          if (
            Array.isArray(c.daftarSiswa) &&
            c.daftarSiswa.some((s) => String(s.idSiswa).trim() === sid)
          ) {
            return true;
          }
          // B. Cek di keterangan ada tag [PETUGAS:idSiswa
          const ket = String(c.keterangan || "");
          if (
            ket.includes(`[PETUGAS:${sid}:`) ||
            ket.includes(`[PETUGAS:${sid}]`)
          ) {
            return true;
          }
          // C. Fallback pencocokan nama kelas
          if (
            sess.kelas &&
            c.namaKelas &&
            (c.namaKelas.toLowerCase().includes(sess.kelas.toLowerCase()) ||
              sess.kelas.toLowerCase().includes(c.namaKelas.toLowerCase()))
          ) {
            return true;
          }
          return false;
        });

        if (myClass && isMountedRef.current) {
          setStatistikKelas({
            idWali: myClass.idWali,
            idGuru: myClass.idGuru,
            namaKelas: myClass.namaKelas,
            namaGuru: myClass.namaGuru,
            jumlahSiswa: myClass.jumlahSiswa,
            presensiHariIni: myClass.presensiHariIni,
            presensi: myClass.presensi,
            daftarSiswa: myClass.daftarSiswa,
            keterangan: myClass.keterangan,
          });

          // Cek apakah siswa ini adalah PETUGAS PRESENSI KELAS
          const isPetugas =
            String(myClass.keterangan || "").includes(`[PETUGAS:${sid}:`) ||
            String(myClass.keterangan || "").includes(`[PETUGAS:${sid}]`);

          if (isPetugas) {
            const pInfo = {
              idWali: myClass.idWali,
              idGuru: myClass.idGuru,
              namaKelas: myClass.namaKelas,
              namaGuru: myClass.namaGuru,
              kelas: myClass.namaKelas,
              keterangan: myClass.keterangan,
              petugas: {
                idSiswa: sid,
                namaSiswa: sess.nama,
              },
            };
            setPetugasWaliData(pInfo);
            cachePetugasLocal(myClass.idWali, pInfo);
          }
        }
      }
    } catch (err) {
      console.warn("Gagal memuat data kelas siswa:", err);
    } finally {
      if (isMountedRef.current) {
        setLoadingStatistikKelas(false);
      }
    }
  }, []);

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

      // Cek apakah siswa merupakan petugas presensi kelas & ambil statistik kelas
      loadDataKelasSiswa(session);

      autoPushSubscribe({
        userId: String(session.id || "").trim(),
        role: "siswa",
      }).catch(() => {});
      runPesanCleanupBackground();
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
  }, [router, CACHE_KEY, loadDataKelasSiswa]);

  const hasLoadedDashboardRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    if (!hasLoadedDashboardRef.current) {
      hasLoadedDashboardRef.current = true;
      loadDashboard();
    }

    // Otomatis membaca token dan link asesmen dari spreadsheet saat dashboard dibuka
    getExamData()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem("cached_exam_data", JSON.stringify(data));
          localStorage.setItem("cached_exam_data_time", Date.now().toString());
        }
      })
      .catch((err) => console.log("Gagal membaca token asesmen:", err));

    return () => {
      isMountedRef.current = false;
    };
  }, [loadDashboard]);

  // Cek berkala / saat tab kembali aktif jika penunjukan baru saja dilakukan guru
  useEffect(() => {
    let lastCheck = 0;
    const checkPetugas = () => {
      const now = Date.now();
      // Throttle: hanya cek maksimal sekali per 30 detik saat tab focus
      if (now - lastCheck < 30000) return;
      lastCheck = now;

      const sess = getSession();
      if (!sess?.id) return;
      const pInfo = findPetugasWaliKelasForSiswa(sess.id);
      if (pInfo) {
        setPetugasWaliData(pInfo);
      }
      loadDataKelasSiswa(sess);
    };

    window.addEventListener("focus", checkPetugas);
    return () => {
      window.removeEventListener("focus", checkPetugas);
    };
  }, [loadDataKelasSiswa]);

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

  // Hitung presensi reguler mandiri siswa hari ini (maks 2x sehari, independen dari barcode)
  const regulerPresensiCount = useMemo(() => {
    if (!user?.id) return 0;
    return getTotalPresensiRegulerToday(user.id, riwayat);
  }, [user?.id, riwayat]);

  const isSudahPresensi = regulerPresensiCount >= MAX_PRESENSI_REGULER_PER_HARI;
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

  // Helper render statistik presensi magang (dipadatkan)
  const renderStatistikMagang = () => (
    <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#FFFDF8] via-[#FFF7E5] to-[#F8E7A5] border border-[#E8D28A] shadow-sm p-3 sm:p-5 space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between border-b border-amber-200/70 pb-2.5 sm:pb-3">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            <h2 className="text-sm sm:text-lg font-black text-slate-800">
              Statistik Presensi Magang
            </h2>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-600 font-medium mt-0.5">
            Akumulasi kehadiran magang kamu selama kegiatan berlangsung
          </p>
        </div>
        <button
          onClick={() => setShowModalMapel(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg sm:rounded-xl bg-white/95 border border-amber-300 text-slate-700 text-[10px] sm:text-xs font-bold hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer active:scale-95"
        >
          <span>📚</span>
          <span>Presensi Mapel</span>
        </button>
      </div>

      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4">
        <Card
          title="Hadir"
          value={statistik?.hadir ?? 0}
          accentColor="border-emerald-500"
          textColor="text-emerald-600"
          icon="✅"
          borderColor="border-amber-200/60"
        />
        <Card
          title="Izin"
          value={statistik?.izin ?? 0}
          accentColor="border-amber-500"
          textColor="text-amber-600"
          icon="📝"
          borderColor="border-amber-200/60"
        />
        <Card
          title="Sakit"
          value={statistik?.sakit ?? 0}
          accentColor="border-blue-500"
          textColor="text-blue-600"
          icon="🤒"
          borderColor="border-amber-200/60"
        />
        <Card
          title="Kehadiran"
          value={`${statistik?.persentaseHadir ?? 0}%`}
          accentColor="border-indigo-500"
          textColor="text-indigo-600"
          icon="📈"
          borderColor="border-amber-200/60"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-white/95 p-2.5 sm:p-3.5 rounded-xl border border-amber-200/70 shadow-2xs">
        <Info label="ID Siswa" value={user?.id} />
        <Info label="Guru Pembimbing" value={user?.namaGuru || "-"} />
        <Info label="Guru Wali" value={guruWali} />
        <Info
          label="Tempat Magang"
          value={user?.tempatMagang || "Belum Terdaftar"}
        />
      </div>
    </div>
  );

  // Helper render statistik kehadiran kelas / rombel (warna cerah kuning emas)
  const renderStatistikKelas = () => (
    <div className="rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-50 via-yellow-100/80 to-amber-200/60 border-2 border-amber-400 shadow-[0_8px_30px_rgba(245,158,11,0.22)] p-3 sm:p-5 space-y-3 sm:space-y-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 -mr-12 -mt-12 h-40 w-40 rounded-full bg-yellow-300/30 blur-2xl pointer-events-none" />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-300/80 pb-2.5 sm:pb-3 gap-2 relative z-10">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-300/70 animate-pulse"></span>
            <h2 className="text-sm sm:text-lg font-black text-amber-950 flex items-center gap-1.5 flex-wrap">
              <span>🏫 Statistik Kehadiran Kelas</span>
              <span className="text-[9px] sm:text-[10px] px-2.5 py-0.5 rounded-md bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 border border-amber-500 font-extrabold shadow-2xs">
                {statistikKelas?.namaKelas || user?.kelas || "Rombel"}
              </span>
            </h2>
          </div>
          <p className="text-[10px] sm:text-xs text-amber-900/80 font-medium mt-0.5">
            Rekapitulasi kehadiran teman sekelas hari ini • Wali Kelas:{" "}
            <strong className="text-amber-950">
              {statistikKelas?.namaGuru || guruWali || "Guru Wali Kelas"}
            </strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Tombol Lihat Barcode Presensi Siswa (Tersedia untuk Semua Siswa) */}
          <button
            onClick={() => setShowModalKartuBarcode(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-white/95 hover:bg-amber-100/90 text-amber-950 text-xs font-black shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer border border-amber-300"
            title="Lihat & Cetak Kartu Barcode Presensi"
          >
            <span>🪪</span>
            <span>Lihat Barcode Presensi</span>
          </button>

          {/* Tombol Khusus Petugas Presensi Kelas */}
          {petugasWaliData ? (
            <>
              <button
                onClick={() => setShowModalScanBarcode(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer border border-teal-500"
                title="Pindai Kartu Barcode Kertas Siswa"
              >
                <span>📷</span>
                <span>Scan Kehadiran</span>
              </button>
              <button
                onClick={() => setShowModalPresensiPetugas(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-amber-950 text-xs font-black shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer border border-amber-400"
                title="Isi Presensi Kelas secara Reguler"
              >
                <span>📋</span>
                <span>Isi Presensi Reguler</span>
              </button>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/95 border border-amber-300 text-amber-900 text-[10px] sm:text-xs font-bold shadow-2xs">
              <span>👥</span>
              <span>{statistikKelas?.jumlahSiswa || 0} Siswa Rombel</span>
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-4 relative z-10">
        <Card
          title="Hadir Hari Ini"
          value={statistikKelas?.presensiHariIni?.hadir ?? 0}
          accentColor="border-emerald-500"
          textColor="text-emerald-700"
          icon="🟢"
          borderColor="border-amber-200"
        />
        <Card
          title="Sakit"
          value={statistikKelas?.presensiHariIni?.sakit ?? 0}
          accentColor="border-sky-500"
          textColor="text-sky-700"
          icon="🤒"
          borderColor="border-amber-200"
        />
        <Card
          title="Izin"
          value={statistikKelas?.presensiHariIni?.izin ?? 0}
          accentColor="border-amber-500"
          textColor="text-amber-700"
          icon="📝"
          borderColor="border-amber-200"
        />
        <Card
          title="Kehadiran Kelas"
          value={`${statistikKelas?.presensiHariIni?.persenHadir ?? 0}%`}
          accentColor="border-yellow-500"
          textColor="text-amber-600"
          icon="📊"
          borderColor="border-amber-200"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-white/95 p-2.5 sm:p-3.5 rounded-xl border border-amber-300/80 shadow-2xs relative z-10">
        <Info
          label="Nama Kelas"
          value={statistikKelas?.namaKelas || user?.kelas || "-"}
          textColor="text-amber-950"
        />
        <Info
          label="Guru Wali Kelas"
          value={statistikKelas?.namaGuru || guruWali || "-"}
          textColor="text-amber-950"
        />
        <Info
          label="Total Siswa Rombel"
          value={`${statistikKelas?.jumlahSiswa || 0} Siswa`}
          textColor="text-amber-950"
        />
        <Info
          label="Petugas Presensi"
          value={
            petugasWaliData
              ? "⭐ Kamu (Ditunjuk)"
              : parseKeteranganWali(statistikKelas?.keterangan).petugasNama ||
                "Belum Ditunjuk"
          }
          textColor={petugasWaliData ? "text-amber-600 font-bold" : "text-amber-950"}
        />
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-50 space-y-4 sm:space-y-6 pb-12 relative">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-white/10 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner">
              <Image
                src="/logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="object-contain sm:w-9 sm:h-9"
              />
            </div>
            <div>
              <h1 className="text-xs sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-amber-200">
                PORTAL SISWA
              </h1>
              <p className="text-[9px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setShowModalPesan(true)}
              className="relative rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-sm font-black text-white border border-sky-300/50 shadow-md hover:brightness-110 active:scale-95 transition-all duration-300 flex items-center gap-1.5"
            >
              <span>💬 PESAN</span>
              {unreadPesanCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border border-white shadow">
                  {unreadPesanCount}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 px-3 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-sm font-black text-white border-2 border-amber-300/80 shadow-md hover:border-amber-200 hover:brightness-110 active:scale-95 transition-all duration-200"
            >
              ❌ LOGOUT
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-3 sm:px-6 space-y-4 sm:space-y-6">
        {/* HERO BANNER SISWA */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-4 sm:p-7 text-white shadow-xl border border-blue-800">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-44 h-44 bg-amber-400 opacity-15 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] sm:text-xs font-bold uppercase tracking-wider mb-2.5 sm:mb-4 border border-amber-400/30">
              🎓 Dashboard Peserta Didik
            </div>
            <h2 className="text-xl sm:text-3xl font-black tracking-tight">
              Selamat Datang,
            </h2>
            <h3 className="mt-0.5 text-lg sm:text-2xl font-extrabold flex flex-wrap items-center gap-1.5 sm:gap-2">
              <NamaBadge rawName={user?.nama} isGradient={true} />
            </h3>
            <p className="mt-1.5 text-xs sm:text-sm text-blue-200 max-w-lg font-medium leading-relaxed">
              Pantau catatan perkembangan wali kelas, kehadiran mata pelajaran,
              dan riwayat presensi harian kamu secara terpadu.
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* STATISTIK DI ATAS MENU AKSES CEPAT (KONDISIONAL STATUS MAGANG) */}
        {/* Jika status siswa sedang magang: Statistik Presensi Magang */}
        {/* Jika status siswa tidak magang: Statistik Kehadiran Kelas */}
        {/* ============================================================ */}
        {sudahMagang ? renderStatistikMagang() : renderStatistikKelas()}

        {/* ============================================================ */}
        {/* MENU UTAMA DASHBOARD */}
        {/* ============================================================ */}
        <div className="space-y-3.5 sm:space-y-4">
          <div className="flex items-center gap-2.5 my-0.5 w-full px-1">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-amber-400 to-yellow-300 rounded-full opacity-70"></div>
            <h3 className="text-xs sm:text-sm font-black tracking-widest text-slate-700 uppercase whitespace-nowrap flex items-center gap-1.5">
              <span>⚡</span>
              <span>MENU AKSES CEPAT</span>
            </h3>
            <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-amber-400 to-yellow-300 rounded-full opacity-70"></div>
          </div>

          {/* KELOMPOK 1: PRESENSI MAGANG (Presensi Sekarang & Riwayat Berdekatan, Warna Senada) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>Presensi Magang</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                Akses Harian &amp; Rekap
              </span>
            </div>
            <div className="grid gap-2 sm:gap-3 grid-cols-2">
              {/* 1. PRESENSI SEKARANG (MAKSIMAL 2x SEHARI) */}
              {!sudahMagang ? (
                <MenuCardDisabled
                  title="Presensi Terkunci"
                  subtitle="Belum memiliki tempat magang"
                  icon="🔒"
                />
              ) : isSudahPresensi ? (
                <MenuCardDisabled
                  title="Presensi Selesai"
                  subtitle="Batas 2x presensi harian tercapai"
                  icon="✅"
                />
              ) : regulerPresensiCount === 1 ? (
                <MenuCard
                  title="Presensi Ke-2"
                  subtitle="Presensi ke-2 hari ini (1/2)"
                  icon="📸"
                  badge="Ke-2"
                  bgGrad="from-sky-500 via-teal-600 to-emerald-700 shadow-teal-500/20 border-teal-300/40"
                  onClick={() => router.push("/magang/presensi")}
                />
              ) : (
                <MenuCard
                  title="Presensi Sekarang"
                  subtitle="Kirim foto & lokasi live (0/2)"
                  icon="📸"
                  badge="Ke-1"
                  bgGrad="from-emerald-500 via-teal-600 to-teal-700 shadow-emerald-500/20 border-emerald-300/40"
                  onClick={() => router.push("/magang/presensi")}
                />
              )}

              {/* 2. RIWAYAT PRESENSI MAGANG (Berdekatan dengan Presensi Sekarang, Warna Senada) */}
              {!sudahMagang ? (
                <MenuCardDisabled
                  title="Riwayat Terkunci"
                  subtitle="Belum memiliki tempat magang"
                  icon="🔒"
                />
              ) : (
                <MenuCard
                  title="Riwayat Presensi"
                  subtitle="Lihat semua datamu"
                  icon="📋"
                  badge="Rekap"
                  bgGrad="from-teal-600 via-cyan-600 to-teal-800 shadow-teal-500/20 border-teal-300/40"
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
              )}
            </div>
          </div>

          {/* KELOMPOK 2: AKADEMIK & PEMBELAJARAN (Tugas Mapel & CBT Ujian) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block"></span>
                <span>Pembelajaran &amp; Ujian</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                Akademik Sekolah
              </span>
            </div>
            <div className="grid gap-2 sm:gap-3 grid-cols-2">
              {/* TUGAS & KEHADIRAN MAPEL */}
              <MenuCard
                title="Kehadiran Mapel"
                subtitle="Lihat Kehadiran dan Nilai Harian"
                icon="📚"
                bgGrad="from-blue-600 via-indigo-600 to-indigo-800 shadow-indigo-500/20 border-indigo-300/40"
                badge="Mapel"
                onClick={() => setShowModalMapel(true)}
              />

              {/* ASESMEN SEKOLAH / CBT */}
              <MenuCard
                title="Asesmen Sekolah"
                subtitle="CBT ujian & penilaian online"
                icon="📝"
                bgGrad="from-indigo-600 via-purple-700 to-indigo-900 shadow-purple-500/20 border-purple-300/40"
                badge="Ujian"
                onClick={() => {
                  if (user) {
                    const match = (user.nama || "").match(/(.+?)\s*\[(.*?)\]/);
                    const cleanNama = match
                      ? match[1].trim()
                      : (user.nama || "").trim();
                    const userKelas = match
                      ? match[2].trim()
                      : (user.kelas || statistikKelas?.namaKelas || "").trim();

                    localStorage.setItem("nama", cleanNama);
                    localStorage.setItem(
                      "id_siswa",
                      String(user.id || "").trim(),
                    );
                    if (userKelas) {
                      localStorage.setItem("kelas", userKelas);
                    }
                  }
                  router.push("/exam");
                }}
              />
            </div>
          </div>

          {/* KELOMPOK 3: PROFIL & STATUS SISWA */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>
                <span>Data &amp; Status Siswa</span>
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-400">
                Informasi Personal
              </span>
            </div>
            <div className="grid gap-2 sm:gap-3 grid-cols-2">
              {/* BIODATA SAYA */}
              <MenuCard
                title="Biodata Saya"
                subtitle="Lihat & edit profil diri"
                icon="👤"
                bgGrad="from-purple-600 via-fuchsia-600 to-pink-600 shadow-purple-500/20 border-purple-300/40"
                badge="Profil"
                onClick={() => router.push("/magang/siswa/biodata")}
              />

              {/* KELULUSAN */}
              <MenuCard
                title="Status Kelulusan"
                subtitle="Informasi status kelulusan"
                icon="🎓"
                bgGrad="from-rose-500 via-pink-600 to-rose-700 shadow-rose-500/20 border-rose-300/40"
                badge="Status"
                onClick={() => router.push("/magang/siswa/kelulusan")}
              />
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* BANNER SPOTLIGHT: PETUGAS PRESENSI KELAS (JIKA DITUNJUK) */}
        {/* ============================================================ */}
        {petugasWaliData && (
          <div className="rounded-2xl sm:rounded-[2rem] bg-gradient-to-br from-teal-900 via-emerald-900 to-slate-900 p-4 sm:p-6 text-white shadow-lg border border-teal-400/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] sm:text-xs font-black uppercase tracking-wider border border-amber-400/30">
                  ⭐ Mandat Petugas Presensi Kelas
                </div>
                <h3 className="text-base sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-emerald-200">
                  Petugas Presensi: {petugasWaliData.namaKelas}
                </h3>
                <p className="text-xs sm:text-sm text-teal-100 font-medium leading-relaxed">
                  Kamu ditunjuk untuk mengisi presensi harian seluruh siswa di
                  kelas {petugasWaliData.namaKelas}. Pengisian dilakukan 1 kali
                  sehari dengan default Hadir semua.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowModalScanBarcode(true)}
                  className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 hover:brightness-110 active:scale-95 text-teal-950 text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📷</span>
                  <span>Scan Barcode Siswa</span>
                </button>
                <button
                  onClick={() => setShowModalPresensiPetugas(true)}
                  className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:brightness-110 active:scale-95 text-amber-950 text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📋</span>
                  <span>Isi Presensi Reguler</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* BANNER SPOTLIGHT: CATATAN GURU WALI */}
        {/* ============================================================ */}
        <div className="rounded-2xl sm:rounded-[2rem] bg-gradient-to-br from-indigo-900 via-blue-900 to-indigo-950 p-4 sm:p-6 text-white shadow-lg border border-blue-700/60 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] sm:text-xs font-black uppercase tracking-wider border border-amber-400/30">
                📝 Catatan Perkembangan Siswa
              </div>
              <h3 className="text-base sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-yellow-200">
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
                className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 active:scale-95 text-amber-950 text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔍</span>
                <span>Buka Catatan Wali</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* CARD SPOTLIGHT: TUGAS DARING & E-LEARNING SISWA (BARU) */}
        {/* ============================================================ */}
        <div className="rounded-2xl sm:rounded-[2rem] bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950 p-4 sm:p-6 text-white shadow-lg border border-teal-400/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-teal-400/20 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-400/20 text-teal-300 text-[9px] sm:text-xs font-black uppercase tracking-wider border border-teal-400/30">
                🌐 Ruang Pembelajaran Online
              </div>
              <h3 className="text-base sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-emerald-200">
                Tugas Daring &amp; Pembelajaran Mandiri
              </h3>
              <p className="text-xs sm:text-sm text-teal-100 font-medium leading-relaxed">
                Akses lembar tugas daring dari guru mata pelajaran, unduh modul
                materi, dan kumpulkan berkas jawaban tugas kamu secara online
                kapan saja.
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[9px] sm:text-xs text-teal-200">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-bold">
                  📥 Unduh Modul Guru
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-bold">
                  📤 Upload Berkas Jawaban
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 border border-white/15 font-bold">
                  ⭐ Pantau Nilai Daring
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowModalTugasDaring(true)}
                className="w-full sm:w-auto px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-400 hover:brightness-110 active:scale-95 text-teal-950 text-xs sm:text-sm font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💻</span>
                <span>Buka Tugas Daring</span>
              </button>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* STATISTIK & RIWAYAT BAGIAN BAWAH */}
        {/* Jika status siswa sedang magang: tampilkan Statistik Kehadiran Kelas, Ruang Belajar, dan Riwayat Magang */}
        {/* Jika status siswa tidak magang: tutup/kunci statistik magang dan riwayat magang */}
        {/* ============================================================ */}
        {sudahMagang ? (
          <>
            {renderStatistikKelas()}
            {isSedangMagang && <RuangBelajarTKA idSiswa={user?.id} />}
            <div className="rounded-2xl sm:rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FFF7E5] to-[#F8E7A5] border border-[#E8D28A] shadow-[0_10px_30px_rgba(214,178,63,0.12)] overflow-hidden">
              <div className="border-b border-amber-200/60 p-3.5 sm:p-5 bg-gradient-to-r from-amber-50/60 to-white flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-sm sm:text-lg font-black text-slate-800 flex items-center gap-1.5 sm:gap-2">
                    ⏳ Riwayat Presensi Terakhir
                  </h2>
                  <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
                    5 log presensi magang terakhir yang terekam
                  </p>
                </div>

                <div className="shrink-0">
                  {fotoTerbaru ? (
                    <a
                      href={fotoTerbaru}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[9px] sm:text-xs font-bold uppercase tracking-wider rounded-xl shadow-md shadow-blue-500/25 hover:shadow-lg hover:scale-105 active:scale-95 transition-all"
                    >
                      📸 Lihat Foto Presensi
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-4 sm:py-2 bg-slate-200 text-slate-400 text-[9px] sm:text-xs font-bold uppercase tracking-wider rounded-xl border border-slate-300">
                      🚫 Tidak Ada Foto
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3.5 sm:p-6">
                {riwayat.length === 0 ? (
                  <div className="text-center py-6 sm:py-8 bg-white/70 rounded-xl sm:rounded-2xl border border-dashed border-amber-200">
                    <p className="text-xs sm:text-sm font-bold text-slate-400">
                      Belum ada riwayat presensi magang tercatat.
                    </p>
                  </div>
                ) : (
                  <div className="relative space-y-2.5 sm:space-y-3">
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
          </>
        ) : (
          <>
            <LockedSection
              title="Statistik Presensi Magang"
              subtitle="Terkunci — belum memiliki tempat magang"
              icon="📊"
            />
            <LockedSection
              title="Riwayat Presensi Terakhir"
              subtitle="Terkunci — belum memiliki tempat magang"
              icon="⏳"
            />
          </>
        )}
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

      {/* MODAL TUGAS DARING DENGAN FORMAT SEPERTI KEHADIRAN MAPEL TAPI FOKUS DARING */}
      <ModalKehadiranMapel
        isOpen={showModalTugasDaring}
        onClose={() => setShowModalTugasDaring(false)}
        user={user}
        fokusDaring={true}
      />

      {/* MODAL KARTU BARCODE PRESENSI SISWA (CETAK & PDF) */}
      <ModalKartuBarcodeSiswa
        isOpen={showModalKartuBarcode}
        onClose={() => setShowModalKartuBarcode(false)}
        user={user}
        fotoTerbaru={fotoTerbaru}
      />

      {/* MODAL SCAN PRESENSI BARCODE UNTUK PETUGAS KELAS */}
      {petugasWaliData && (
        <ModalScanPresensiPetugas
          isOpen={showModalScanBarcode}
          onClose={() => setShowModalScanBarcode(false)}
          petugasInfo={petugasWaliData}
          user={user}
          onPresensiSubmitted={() => {
            loadDataKelasSiswa();
          }}
        />
      )}

      {/* MODAL PRESENSI PETUGAS KELAS REGULER */}
      {petugasWaliData && (
        <ModalPresensiPetugasSiswa
          isOpen={showModalPresensiPetugas}
          onClose={() => setShowModalPresensiPetugas(false)}
          petugasInfo={petugasWaliData}
          user={user}
          onOpenScanner={() => {
            setShowModalPresensiPetugas(false);
            setShowModalScanBarcode(true);
          }}
          onPresensiSubmitted={() => {
            loadDataKelasSiswa();
          }}
        />
      )}

      <PesanSekolahModal
        isOpen={showModalPesan}
        onClose={() => {
          setShowModalPesan(false);
          refreshPesanCount();
        }}
        currentUser={{
          id: user?.id,
          nama: user?.nama,
          kelas: user?.kelas || statistikKelas?.namaKelas || "",
          role: "siswa",
          idGuru: user?.idGuru,
          namaGuru: user?.namaGuru,
          guruWali:
            guruWali && guruWali !== "-" && guruWali !== "Tanpa Guru Wali"
              ? { nama: guruWali }
              : null,
          waliKelas: statistikKelas?.namaGuru
            ? {
                id: statistikKelas.idGuru,
                nama: statistikKelas.namaGuru,
                kelas: statistikKelas.namaKelas,
              }
            : null,
        }}
      />
    </main>
  );
}

/* --- REUSABLE COMPONENTS --- */

function Info({ label, value, textColor = "text-slate-800" }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400 mb-0.5">
        {label}
      </p>
      <p className={`text-xs sm:text-sm font-black ${textColor} truncate`}>
        {value}
      </p>
    </div>
  );
}

function Card({
  title,
  value,
  accentColor,
  textColor,
  icon,
  borderColor = "border-slate-200/80",
}) {
  return (
    <div
      className={`rounded-xl sm:rounded-2xl bg-white p-2.5 sm:p-3.5 shadow-2xs border ${borderColor} border-t-4 ${accentColor} relative overflow-hidden group hover:shadow-md transition-all`}
    >
      <p className="text-[9px] sm:text-xs font-black text-slate-400 uppercase tracking-wider truncate pr-6 sm:pr-8">
        {title}
      </p>
      <h2
        className={`mt-0.5 sm:mt-1 text-lg sm:text-2xl font-black ${textColor}`}
      >
        {value}
      </h2>
      <div className="absolute top-2 right-2 sm:top-3 sm:right-3 w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-slate-50 border border-slate-200/80 shadow-2xs flex items-center justify-center text-xs sm:text-base">
        {icon}
      </div>
    </div>
  );
}

function MenuCard({ title, subtitle, icon, bgGrad, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br ${bgGrad} text-white shadow-md flex flex-col justify-between min-h-[86px] sm:min-h-[110px] transition-all active:scale-[0.97] hover:-translate-y-0.5 hover:shadow-lg focus:outline-none border border-white/15 relative overflow-hidden cursor-pointer`}
    >
      {badge && (
        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-amber-400 text-amber-950 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-xs">
          {badge}
        </span>
      )}
      <div className="text-sm sm:text-xl bg-white/20 w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl border border-white/20 shadow-inner">
        {icon}
      </div>
      <div>
        <h2 className="text-xs sm:text-sm font-black tracking-tight leading-tight">
          {title}
        </h2>
        <p className="text-[9px] sm:text-xs text-white/85 font-medium mt-0.5 line-clamp-1 sm:line-clamp-2 leading-tight">
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
      className="w-full text-left p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-200 text-slate-400 flex flex-col justify-between min-h-[86px] sm:min-h-[110px] cursor-not-allowed border border-slate-300"
    >
      <div className="text-sm sm:text-xl bg-slate-300/50 w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-300">
        {icon}
      </div>
      <div>
        <h2 className="text-xs sm:text-sm font-black tracking-tight leading-tight">
          {title}
        </h2>
        <p className="text-[9px] sm:text-xs text-slate-500 font-medium mt-0.5 line-clamp-1 sm:line-clamp-2 leading-tight">
          {subtitle}
        </p>
      </div>
    </button>
  );
}

function LockedSection({ title, subtitle, icon }) {
  return (
    <div className="rounded-xl sm:rounded-2xl bg-slate-100/90 border border-slate-300/80 p-3 sm:p-4.5 flex items-center gap-3 sm:gap-4 cursor-not-allowed select-none">
      <div className="text-lg sm:text-2xl bg-slate-200/70 w-8 h-8 sm:w-11 sm:h-11 shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl border border-slate-300 text-slate-400">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-xs sm:text-base font-black text-slate-400 flex items-center gap-1.5 sm:gap-2">
          <span>🔒</span>
          <span>{title}</span>
        </h2>
        <p className="text-[9px] sm:text-xs text-slate-500 font-medium mt-0.5 truncate">
          {subtitle}
        </p>
      </div>
    </div>
  );
}
