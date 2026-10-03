"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSession, isLoggedIn, logout } from "../lib/auth";
import {
  getDashboardKepsekPkl,
  getDashboardKepsekWali,
  getDashboardKepsekMapel,
  getDashboardKepsekWaliKelas,
  getDetailMapelKepsek,
  getPresensiWaliGrid,
  getSiswa,
  getMonitoringGuru,
} from "../lib/api";
import { generateLaporanWaliKelasPDF } from "../guru/guru-wali-kelas/generateLaporanWaliKelasPDF";
import {
  PesanKepsekModal,
  useJumlahPesanBaru,
} from "../kepsek/PesanKepsekGuru";

// --- OPTIMASI FOTO GOOGLE DRIVE / USER CONTENT ---
function optimizeFotoUrl(url, size = 300) {
  if (!url || typeof url !== "string") return url;
  if (url.includes("googleusercontent.com")) {
    const base = url.split("=")[0];
    return `${base}=w${size}-h${size}-c`;
  }
  const driveIdMatch = url.match(/[-\w]{25,}/);
  if (url.includes("drive.google.com") && driveIdMatch) {
    return `https://lh3.googleusercontent.com/d/${driveIdMatch[0]}=w${size}-h${size}-c`;
  }
  return url;
}

function formatTanggal(waktu) {
  if (!waktu) return "-";
  const tanggal = new Date(waktu);
  if (isNaN(tanggal.getTime())) return waktu;
  return (
    tanggal.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function formatTanggalIndo(tanggalStr) {
  if (!tanggalStr) return "-";
  try {
    const d = new Date(
      tanggalStr.includes("T") ? tanggalStr : tanggalStr + "T00:00:00",
    );
    if (isNaN(d.getTime())) return String(tanggalStr);
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(tanggalStr);
  }
}

function formatTanggalKolom(tanggalStr) {
  if (!tanggalStr) return "";
  try {
    const d = new Date(
      tanggalStr.includes("T") ? tanggalStr : tanggalStr + "T00:00:00",
    );
    if (isNaN(d.getTime())) return String(tanggalStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return String(tanggalStr);
  }
}

// Format WhatsApp
function getWhatsAppUrl(noHp, pesan = "") {
  if (!noHp) return null;
  let nomor = String(noHp).replace(/\D/g, "");
  if (!nomor) return null;
  if (nomor.startsWith("0")) {
    nomor = "62" + nomor.substring(1);
  } else if (!nomor.startsWith("62")) {
    nomor = "62" + nomor;
  }
  return `https://wa.me/${nomor}${pesan ? `?text=${encodeURIComponent(pesan)}` : ""}`;
}

export default function DashboardKepalaSekolah() {
  const router = useRouter();

  // Tab Menu Utama: "pembimbing" | "wali" | "mapel" | "walikelas"
  const [activeMenuTab, setActiveMenuTab] = useState("pembimbing");
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);

  // --- PESAN KEPALA SEKOLAH <-> GURU ---
  const [showPesan, setShowPesan] = useState(false);
  const [pesanTarget, setPesanTarget] = useState(null);
  const [jumlahPesanBaru, refreshPesanBaru] = useJumlahPesanBaru({
    role: "kepsek",
    idGuru: "",
    enabled: isReady,
  });

  // --- MODE TAMPILAN DAFTAR: "list" | "card" ---
  const [viewMode, setViewMode] = useState("list");
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = localStorage.getItem("kepsek_view_mode");
        if (v === "list" || v === "card") setViewMode(v);
      } catch (e) {}
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function ubahViewMode(mode) {
    setViewMode(mode);
    try {
      localStorage.setItem("kepsek_view_mode", mode);
    } catch (e) {}
  }

  // guru: objek berisi idGuru & namaGuru (atau null = buka kotak pesan)
  function bukaPesan(guru) {
    if (guru) {
      setPesanTarget({
        idGuru: String(guru.idGuru || guru.id || "").trim(),
        namaGuru: String(guru.namaGuru || guru.nama || "").trim(),
      });
    } else {
      setPesanTarget(null);
    }
    setShowPesan(true);
  }

  // --- STATE MODAL STATISTIK (POP-UP DAFTAR NAMA) ---
  const [statModalConfig, setStatModalConfig] = useState({
    isOpen: false,
    title: "",
    data: [],
  });

  // --- STATE PREVIEW FOTO / LIGHTBOX ---
  const [lightboxUrl, setLightboxUrl] = useState(null);

  // --- STATE DATA MASTER SISWA SPREADSHEET (SEMUA KELAS) ---
  const [dataMasterSiswa, setDataMasterSiswa] = useState([]);
  const [loadingMasterSiswa, setLoadingMasterSiswa] = useState(false);

  // --- STATE MODAL MONITORING GURU PEMBIMBING ---
  const [selectedMonitoringGuru, setSelectedMonitoringGuru] = useState(null);
  const [monitoringList, setMonitoringList] = useState([]);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [errorMonitoring, setErrorMonitoring] = useState("");
  const monitoringCacheRef = useRef({});

  // --- STATE PENCARIAN DI DALAM MODAL STATISTIK SISWA ---
  const [statModalSearch, setStatModalSearch] = useState("");
  // --- STATE TAB AKTIF DI MODAL STATISTIK: "statistik" | "semua" | "X" | "XI" | "XII" ---
  const [statModalTab, setStatModalTab] = useState("statistik");

  // =========================================================
  // 1. STATE & DATA TAB: PEMBIMBING PKL
  // =========================================================
  const [dataPkl, setDataPkl] = useState({ statistik: {}, cards: [] });
  const [loadingPkl, setLoadingPkl] = useState(false);
  const [errorPkl, setErrorPkl] = useState("");
  const [loadedPkl, setLoadedPkl] = useState(false);
  const [searchPkl, setSearchPkl] = useState("");
  const [filterPklStatus, setFilterPklStatus] = useState("semua"); // "semua" | "sudah_jurnal" | "belum_jurnal"
  const [sortPkl, setSortPkl] = useState("terbaru"); // "terbaru" | "terbanyak" | "nama"
  const [selectedGuruPkl, setSelectedGuruPkl] = useState(null); // Detail modal

  // =========================================================
  // 2. STATE & DATA TAB: GURU WALI
  // =========================================================
  const [dataWali, setDataWali] = useState({ statistik: {}, cards: [] });
  const [loadingWali, setLoadingWali] = useState(false);
  const [errorWali, setErrorWali] = useState("");
  const [loadedWali, setLoadedWali] = useState(false);
  const [searchWali, setSearchWali] = useState("");
  const [filterWaliStatus, setFilterWaliStatus] = useState("semua");
  const [sortWali, setSortWali] = useState("terbaru"); // "terbaru" | "terbanyak" | "nama"
  const [selectedGuruWali, setSelectedGuruWali] = useState(null); // Detail modal

  // =========================================================
  // 3. STATE & DATA TAB: GURU MAPEL
  // =========================================================
  const [dataMapel, setDataMapel] = useState({ statistik: {}, cards: [] });
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [errorMapel, setErrorMapel] = useState("");
  const [loadedMapel, setLoadedMapel] = useState(false);
  const [searchMapel, setSearchMapel] = useState("");
  const [filterMapelJenis, setFilterMapelJenis] = useState("semua"); // "semua" | "online" | "reguler"
  const [sortMapel, setSortMapel] = useState("terbaru"); // "terbaru" | "mapel_terbanyak" | "siswa_terbanyak" | "nama"
  const [selectedGuruMapel, setSelectedGuruMapel] = useState(null); // Detail modal
  const [selectedPertemuanMapel, setSelectedPertemuanMapel] = useState({}); // { [idMapel]: pertemuanKe }
  const [detailMapelKepsek, setDetailMapelKepsek] = useState(null); // { mapel, data } sub-modal per siswa
  const [loadingDetailMapel, setLoadingDetailMapel] = useState(false); // loading sub-modal

  // =========================================================
  // 4. STATE & DATA TAB: WALI KELAS
  // =========================================================
  const [dataWaliKelas, setDataWaliKelas] = useState({
    statistik: {},
    cards: [],
  });
  const [loadingWaliKelas, setLoadingWaliKelas] = useState(false);
  const [errorWaliKelas, setErrorWaliKelas] = useState("");
  const [loadedWaliKelas, setLoadedWaliKelas] = useState(false);
  const [searchWaliKelas, setSearchWaliKelas] = useState("");
  const [filterWaliKelasStatus, setFilterWaliKelasStatus] = useState("semua"); // "semua" | "sudah_presensi" | "belum_presensi"
  const [sortWaliKelas, setSortWaliKelas] = useState("terbaru"); // "terbaru" | "kehadiran" | "siswa" | "nama"
  const [selectedWaliKelas, setSelectedWaliKelas] = useState(null); // Detail modal
  const [isAllPresensiModalOpen, setIsAllPresensiModalOpen] = useState(false); // Modal seluruh presensi
  const [selectedPresensiKelasModal, setSelectedPresensiKelasModal] =
    useState(null); // Modal presensi spesifik per kelas
  const [expandedHadirWaliId, setExpandedHadirWaliId] = useState(null); // Toggle daftar siswa hadir di card
  const [filterKelasPresensi, setFilterKelasPresensi] = useState("all");
  const [filterStatusPresensi, setFilterStatusPresensi] = useState("all");
  const [searchPresensiText, setSearchPresensiText] = useState("");
  const [presensiKelasSubTab, setPresensiKelasSubTab] = useState("hari_ini"); // "hari_ini" | "riwayat"
  const [modalGridData, setModalGridData] = useState(null);
  const [loadingModalGrid, setLoadingModalGrid] = useState(false);
  const [cetakLaporanLoading, setCetakLaporanLoading] = useState(false);
  const [searchMatrixStudent, setSearchMatrixStudent] = useState("");

  // Cek Auth Kepala Sekolah
  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/magang/login");
      return;
    }
    const session = getSession();
    // Diizinkan untuk role 'kepsek' atau 'admin'
    if (!session || (session.role !== "kepsek" && session.role !== "admin")) {
      router.replace("/magang/login");
      return;
    }
    const timer = setTimeout(() => {
      setUser(session);
      setIsReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  // =========================================================
  // FETCH HANDLERS PER TAB (DENGAN CACHING SESSIONSTORAGE)
  // =========================================================

  // 0. Load Data Master Siswa Spreadsheet (Sheet SISWA)
  const loadMasterSiswa = useCallback(async (forceRefresh = false) => {
    const cacheKey = "kepsek_cache_master_siswa";
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setDataMasterSiswa(parsed);
            return;
          }
        }
      } catch (e) {
        console.warn("Gagal membaca cache master siswa:", e);
      }
    }

    setLoadingMasterSiswa(true);
    try {
      const res = await getSiswa();
      if (res && res.success && Array.isArray(res.data)) {
        setDataMasterSiswa(res.data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {}
      }
    } catch (err) {
      console.error("Error load master siswa Kepsek:", err);
    } finally {
      setLoadingMasterSiswa(false);
    }
  }, []);

  // Handler Buka Modal Monitoring Guru Pembimbing
  const handleOpenMonitoring = useCallback(async (guru) => {
    if (!guru) return;
    setSelectedMonitoringGuru(guru);
    setErrorMonitoring("");

    const idGuru = String(guru.idGuru || guru.id || "").trim();
    if (monitoringCacheRef.current[idGuru]) {
      setMonitoringList(monitoringCacheRef.current[idGuru]);
      setLoadingMonitoring(false);
      return;
    }

    setLoadingMonitoring(true);
    setMonitoringList([]);
    try {
      const res = await getMonitoringGuru(idGuru, 50);
      if (res && res.success && Array.isArray(res.data)) {
        setMonitoringList(res.data);
        monitoringCacheRef.current[idGuru] = res.data;
      } else {
        setMonitoringList([]);
        if (res?.message && !res.message.includes("tidak ditemukan")) {
          setErrorMonitoring(res.message);
        }
      }
    } catch (err) {
      console.error("Gagal memuat monitoring guru:", err);
      setErrorMonitoring("Gagal menghubungi server untuk data monitoring.");
    } finally {
      setLoadingMonitoring(false);
    }
  }, []);

  // Helper filter daftar siswa PKL valid (punya kolom tempat magang terisi)
  const getSiswaPklList = useCallback((guru) => {
    return (guru?.daftarSiswa || []).filter((s) => {
      const t = String(s.tempatMagang || s.tempat || "").trim();
      return t !== "" && t !== "-";
    });
  }, []);

  // 1. Load Data PKL
  const loadPklData = useCallback(async (forceRefresh = false) => {
    const cacheKey = "kepsek_cache_pkl";
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.statistik && Array.isArray(parsed.cards)) {
            setDataPkl(parsed);
            setLoadedPkl(true);
            return;
          }
        }
      } catch (e) {
        console.warn("Gagal membaca cache PKL Kepsek:", e);
      }
    }

    setLoadingPkl(true);
    setErrorPkl("");

    try {
      const res = await getDashboardKepsekPkl(forceRefresh);
      if (res && res.success && res.data) {
        setDataPkl(res.data);
        setLoadedPkl(true);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {}
      } else {
        setErrorPkl(
          res?.message || "Gagal mengambil data Guru Pembimbing PKL.",
        );
      }
    } catch (err) {
      console.error("Error load PKL Kepsek:", err);
      setErrorPkl("Terjadi kendala jaringan saat menghubungi server.");
    } finally {
      setLoadingPkl(false);
    }
  }, []);

  // 2. Load Data Guru Wali
  const loadWaliData = useCallback(async (forceRefresh = false) => {
    const cacheKey = "kepsek_cache_wali";
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.statistik && Array.isArray(parsed.cards)) {
            setDataWali(parsed);
            setLoadedWali(true);
            return;
          }
        }
      } catch (e) {
        console.warn("Gagal membaca cache Wali Kepsek:", e);
      }
    }

    setLoadingWali(true);
    setErrorWali("");

    try {
      const res = await getDashboardKepsekWali(forceRefresh);
      if (res && res.success && res.data) {
        setDataWali(res.data);
        setLoadedWali(true);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {}
      } else {
        setErrorWali(res?.message || "Gagal mengambil data Guru Wali.");
      }
    } catch (err) {
      console.error("Error load Wali Kepsek:", err);
      setErrorWali("Terjadi kendala jaringan saat menghubungi server.");
    } finally {
      setLoadingWali(false);
    }
  }, []);

  // 3. Load Data Guru Mapel
  const loadMapelData = useCallback(async (forceRefresh = false) => {
    const cacheKey = "kepsek_cache_mapel";
    if (!forceRefresh) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.statistik && Array.isArray(parsed.cards)) {
            setDataMapel(parsed);
            setLoadedMapel(true);
            return;
          }
        }
      } catch (e) {
        console.warn("Gagal membaca cache Mapel Kepsek:", e);
      }
    }

    setLoadingMapel(true);
    setErrorMapel("");

    try {
      const res = await getDashboardKepsekMapel(forceRefresh);
      if (res && res.success && res.data) {
        setDataMapel(res.data);
        setLoadedMapel(true);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {}
      } else {
        setErrorMapel(res?.message || "Gagal mengambil data Guru Mapel.");
      }
    } catch (err) {
      console.error("Error load Mapel Kepsek:", err);
      setErrorMapel("Terjadi kendala jaringan saat menghubungi server.");
    } finally {
      setLoadingMapel(false);
    }
  }, []);

  // 4. Load Data Wali Kelas
  const loadWaliKelasData = useCallback(async (forceRefresh = false) => {
    const cacheKey = "kepsek_cache_walikelas";
    if (forceRefresh) {
      try {
        sessionStorage.removeItem(cacheKey);
      } catch (e) {}
    } else {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.statistik && Array.isArray(parsed.cards)) {
            setDataWaliKelas(parsed);
            setLoadedWaliKelas(true);
            return;
          }
        }
      } catch (e) {
        console.warn("Gagal membaca cache Wali Kelas Kepsek:", e);
      }
    }

    setLoadingWaliKelas(true);
    setErrorWaliKelas("");

    try {
      const res = await getDashboardKepsekWaliKelas(forceRefresh);
      if (res && res.success && res.data) {
        setDataWaliKelas(res.data);
        setLoadedWaliKelas(true);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(res.data));
        } catch (e) {}
      } else {
        setErrorWaliKelas(res?.message || "Gagal mengambil data Wali Kelas.");
      }
    } catch (err) {
      console.error("Error load Wali Kelas Kepsek:", err);
      setErrorWaliKelas("Terjadi kendala jaringan saat menghubungi server.");
    } finally {
      setLoadingWaliKelas(false);
    }
  }, []);

  const handleTabChange = useCallback(
    (tab) => {
      setActiveMenuTab(tab);
      if (tab === "pembimbing" && !loadedPkl) loadPklData(false);
      else if (tab === "wali" && !loadedWali) loadWaliData(false);
      else if (tab === "mapel" && !loadedMapel) loadMapelData(false);
      else if (tab === "walikelas") loadWaliKelasData(false); // Selalu ambil presensi terbaru saat klik tab Wali Kelas
    },
    [
      loadedPkl,
      loadedWali,
      loadedMapel,
      loadedWaliKelas,
      loadPklData,
      loadWaliData,
      loadMapelData,
      loadWaliKelasData,
    ],
  );

  // Initial load saat komponen siap
  useEffect(() => {
    if (!isReady) return;
    const timer = setTimeout(() => {
      loadMasterSiswa(false);
      if (!loadedPkl) {
        loadPklData(false);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [isReady, loadedPkl, loadPklData, loadMasterSiswa]);

  function handleLogout() {
    if (!confirm("Keluar dari Portal Kepala Sekolah?")) return;
    sessionStorage.removeItem("kepsek_cache_pkl");
    sessionStorage.removeItem("kepsek_cache_wali");
    sessionStorage.removeItem("kepsek_cache_mapel");
    sessionStorage.removeItem("kepsek_cache_walikelas");
    sessionStorage.removeItem("kepsek_cache_master_siswa");
    logout();
    router.replace("/magang/login");
  }

  // --- LIHAT PRESENSI SISWA -> BUKA HALAMAN REKAP DENGAN GURU PEMBIMBING TERPILIH ---
  // Memakai mekanisme auto-select yang sama dengan Dashboard Guru
  // (localStorage target*Rekap dibaca & dibersihkan oleh halaman /magang/rekap).
  function handleLihatPresensiSiswa(guru) {
    const idGuru = String(guru?.idGuru || guru?.id || "").trim();
    if (!idGuru) {
      alert("ID Guru Pembimbing tidak ditemukan.");
      return;
    }
    const namaBulan = [
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
    const date = new Date();
    const bulanTerbaru = `${namaBulan[date.getMonth()]} ${date.getFullYear()}`;

    try {
      localStorage.setItem("targetGuruRekap", idGuru);
      localStorage.setItem("targetTempatRekap", "Semua");
      localStorage.setItem("targetBulanRekap", bulanTerbaru);
    } catch (e) {
      console.warn("Gagal menyimpan target rekap:", e);
    }
    router.push("/magang/rekap");
  }

  // --- KLIK CARD STATISTIK -> BUKA MODAL DAFTAR NAMA ---
  function handleStatCardClick(title, listData, breakdownKelas = null) {
    setStatModalSearch("");
    const hasBreakdown =
      Array.isArray(breakdownKelas) && breakdownKelas.length > 0;
    setStatModalTab(hasBreakdown ? "statistik" : "semua");
    setStatModalConfig({
      isOpen: true,
      title,
      data: listData || [],
      breakdownKelas: hasBreakdown ? breakdownKelas : null,
    });
  }

  // --- STATISTIK DATA SISWA MASTER SPREADSHEET (SHEET SISWA) ---
  const statsSiswa = useMemo(() => {
    const list = dataMasterSiswa || [];

    const normalized = list.map((itemSiswa) => {
      const id = String(
        itemSiswa.ID ||
          itemSiswa.id ||
          itemSiswa.ID_SISWA ||
          itemSiswa.idSiswa ||
          "",
      ).trim();
      const rawNama = String(
        itemSiswa.NAMA || itemSiswa.nama || itemSiswa.NAMA_SISWA || "",
      ).trim();
      const tempat = String(
        itemSiswa.TEMPAT_MAGANG ||
          itemSiswa.tempatMagang ||
          itemSiswa.TEMPAT ||
          itemSiswa.tempat ||
          "",
      ).trim();
      const match = rawNama.match(/(.+?)\s*\[(.*?)\]/);
      const nama = match ? match[1].trim() : rawNama;
      const kelas = match
        ? match[2].trim()
        : String(itemSiswa.KELAS || itemSiswa.kelas || "").trim();
      return {
        id,
        nama,
        rawNama,
        kelas,
        tempatMagang: tempat,
        status: String(itemSiswa.STATUS || itemSiswa.status || "").trim(),
        idGuru: String(itemSiswa.ID_GURU || itemSiswa.idGuru || "").trim(),
        namaGuru: String(
          itemSiswa.NAMA_GURU || itemSiswa.namaGuru || "",
        ).trim(),
      };
    });

    // 1. Seluruh siswa yang punya akun (memiliki ID)
    const siswaPunyaAkun = normalized.filter(
      (itemSiswa) => itemSiswa.id !== "",
    );

    // 2. Siswa Kelas X: [X ...] atau kelas berawalan 'X ' / 'X-' / 'X' / '10'
    const siswaKelasX = siswaPunyaAkun.filter((itemSiswa) => {
      const k = itemSiswa.kelas.toUpperCase();
      return /^X[\s\-_]/.test(k) || /^X$/.test(k) || /^10[\s\-_]/.test(k);
    });

    // 3. Siswa Kelas XI: [XI ...] atau kelas berawalan 'XI ' / 'XI-' / 'XI' / '11'
    const siswaKelasXI = siswaPunyaAkun.filter((itemSiswa) => {
      const k = itemSiswa.kelas.toUpperCase();
      return /^XI[\s\-_]/.test(k) || /^XI$/.test(k) || /^11[\s\-_]/.test(k);
    });

    // 4. Siswa Kelas XII: inputnya teks tanpa angka X dan XI (atau XII)
    const siswaKelasXII = siswaPunyaAkun.filter((itemSiswa) => {
      const k = itemSiswa.kelas.toUpperCase();
      const isX = /^X[\s\-_]/.test(k) || /^X$/.test(k) || /^10[\s\-_]/.test(k);
      const isXI =
        /^XI[\s\-_]/.test(k) || /^XI$/.test(k) || /^11[\s\-_]/.test(k);
      return !isX && !isXI;
    });

    // 5. Total Siswa PKL: wajib memiliki data tempat magang terisi
    const siswaPkl = siswaPunyaAkun.filter(
      (itemSiswa) =>
        itemSiswa.tempatMagang !== "" && itemSiswa.tempatMagang !== "-",
    );

    // Helper: buat breakdown jumlah siswa per kelas/jurusan dari sebuah list
    function buildBreakdown(siswaList) {
      const map = {};
      siswaList.forEach((itemSiswa) => {
        const k = itemSiswa.kelas || "—";
        if (!map[k]) map[k] = { kelas: k, count: 0, siswaList: [] };
        map[k].count++;
        map[k].siswaList.push(itemSiswa);
      });
      return Object.values(map).sort((a, b) => b.count - a.count);
    }

    return {
      totalAkun: siswaPunyaAkun.length,
      listAkun: siswaPunyaAkun.map((itemSiswa) => ({
        nama: itemSiswa.nama,
        info: `ID: ${itemSiswa.id} • Kelas: ${itemSiswa.kelas || "XII"} ${itemSiswa.tempatMagang ? `• 📍 ${itemSiswa.tempatMagang}` : "• Belum Magang"}`,
      })),
      breakdownAkun: buildBreakdown(siswaPunyaAkun),
      totalKelasX: siswaKelasX.length,
      listKelasX: siswaKelasX.map((itemSiswa) => ({
        nama: itemSiswa.nama,
        info: `ID: ${itemSiswa.id} • Kelas: ${itemSiswa.kelas} ${itemSiswa.tempatMagang ? `• 📍 ${itemSiswa.tempatMagang}` : ""}`,
      })),
      breakdownKelasX: buildBreakdown(siswaKelasX),
      totalKelasXI: siswaKelasXI.length,
      listKelasXI: siswaKelasXI.map((itemSiswa) => ({
        nama: itemSiswa.nama,
        info: `ID: ${itemSiswa.id} • Kelas: ${itemSiswa.kelas} ${itemSiswa.tempatMagang ? `• 📍 ${itemSiswa.tempatMagang}` : ""}`,
      })),
      breakdownKelasXI: buildBreakdown(siswaKelasXI),
      totalKelasXII: siswaKelasXII.length,
      listKelasXII: siswaKelasXII.map((itemSiswa) => ({
        nama: itemSiswa.nama,
        info: `ID: ${itemSiswa.id} • Jurusan/Kelas: ${itemSiswa.kelas || "XII"} ${itemSiswa.tempatMagang ? `• 📍 ${itemSiswa.tempatMagang}` : ""}`,
      })),
      breakdownKelasXII: buildBreakdown(siswaKelasXII),
      totalSiswaPkl: siswaPkl.length,
      listSiswaPkl: siswaPkl.map((itemSiswa) => ({
        nama: itemSiswa.nama,
        info: `ID: ${itemSiswa.id} • ${itemSiswa.kelas ? `${itemSiswa.kelas} • ` : ""}📍 ${itemSiswa.tempatMagang}`,
      })),
    };
  }, [dataMasterSiswa]);

  // =========================================================
  // FILTER DATA PER TAB
  // =========================================================

  // 1. Filter Pembimbing PKL
  const filteredCardsPkl = useMemo(() => {
    const list = dataPkl.cards || [];
    return list
      .filter((g) => {
        const siswaList = getSiswaPklList(g);
        if (!siswaList || siswaList.length === 0) return false;

        const matchSearch =
          !searchPkl ||
          (g.namaGuru || "").toLowerCase().includes(searchPkl.toLowerCase()) ||
          (g.idGuru || "").toLowerCase().includes(searchPkl.toLowerCase()) ||
          (g.daftarTempat || []).some((t) =>
            t.toLowerCase().includes(searchPkl.toLowerCase()),
          ) ||
          siswaList.some((s) =>
            (s.nama || "").toLowerCase().includes(searchPkl.toLowerCase()),
          );

        let matchStatus = true;
        if (filterPklStatus === "sudah_jurnal") {
          matchStatus = g.sudahIsiJurnal;
        } else if (filterPklStatus === "belum_jurnal") {
          matchStatus = !g.sudahIsiJurnal;
        }

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (sortPkl === "terbaru") {
          const dateA = a.jurnalTerakhir?.tanggal || a.riwayatJurnal?.[0]?.tanggal || "";
          const dateB = b.jurnalTerakhir?.tanggal || b.riwayatJurnal?.[0]?.tanggal || "";
          if (dateA && dateB) return dateB.localeCompare(dateA);
          if (dateA) return -1;
          if (dateB) return 1;
          return (b.jumlahSiswa || 0) - (a.jumlahSiswa || 0);
        }
        if (sortPkl === "terbanyak") {
          return (b.jumlahSiswa || 0) - (a.jumlahSiswa || 0);
        }
        if (sortPkl === "nama") {
          return (a.namaGuru || "").localeCompare(b.namaGuru || "");
        }
        return 0;
      });
  }, [dataPkl.cards, searchPkl, filterPklStatus, sortPkl, getSiswaPklList]);

  // 2. Filter Guru Wali
  const filteredCardsWali = useMemo(() => {
    const list = dataWali.cards || [];
    return list
      .filter((g) => {
        const matchSearch =
          !searchWali ||
          (g.namaGuru || "").toLowerCase().includes(searchWali.toLowerCase()) ||
          (g.idGuru || "").toLowerCase().includes(searchWali.toLowerCase()) ||
          (g.daftarSiswa || []).some((s) =>
            (s.nama || "").toLowerCase().includes(searchWali.toLowerCase()),
          );

        let matchStatus = true;
        if (filterWaliStatus === "sudah_jurnal") {
          matchStatus = g.sudahIsiJurnal;
        } else if (filterWaliStatus === "belum_jurnal") {
          matchStatus = !g.sudahIsiJurnal;
        }

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (sortWali === "terbaru") {
          const dateA = a.jurnalTerakhir?.tanggal || a.riwayatJurnal?.[0]?.tanggal || "";
          const dateB = b.jurnalTerakhir?.tanggal || b.riwayatJurnal?.[0]?.tanggal || "";
          if (dateA && dateB) return dateB.localeCompare(dateA);
          if (dateA) return -1;
          if (dateB) return 1;
          return (b.totalPertemuan || 0) - (a.totalPertemuan || 0);
        }
        if (sortWali === "terbanyak") {
          return (b.jumlahSiswa || 0) - (a.jumlahSiswa || 0);
        }
        if (sortWali === "nama") {
          return (a.namaGuru || "").localeCompare(b.namaGuru || "");
        }
        return 0;
      });
  }, [dataWali.cards, searchWali, filterWaliStatus, sortWali]);

  // 3. Filter Guru Mapel
  const filteredCardsMapel = useMemo(() => {
    const list = dataMapel.cards || [];
    return list
      .filter((g) => {
        const matchSearch =
          !searchMapel ||
          (g.namaGuru || "").toLowerCase().includes(searchMapel.toLowerCase()) ||
          (g.daftarMapel || []).some(
            (m) =>
              (m.namaMapel || "")
                .toLowerCase()
                .includes(searchMapel.toLowerCase()) ||
              (m.kelas || "").toLowerCase().includes(searchMapel.toLowerCase()),
          );

        let matchJenis = true;
        if (filterMapelJenis === "online") {
          matchJenis = (g.daftarMapel || []).some(
            (m) =>
              m.isOnline ||
              String(m.keterangan || "").toUpperCase().includes("ONLINE") ||
              String(m.namaMapel || "").toUpperCase().includes("ONLINE"),
          );
        } else if (filterMapelJenis === "reguler") {
          matchJenis = (g.daftarMapel || []).some(
            (m) =>
              !m.isOnline &&
              !String(m.keterangan || "").toUpperCase().includes("ONLINE") &&
              !String(m.namaMapel || "").toUpperCase().includes("ONLINE"),
          );
        }

        return matchSearch && matchJenis;
      })
      .sort((a, b) => {
        if (sortMapel === "terbaru") {
          const getLatestDate = (item) => {
            let latest = item.jurnalTerakhir?.tanggal || item.riwayatJurnal?.[0]?.tanggal || "";
            (item.daftarMapel || []).forEach((m) => {
              (m.presensiPertemuan || []).forEach((pt) => {
                if (pt.tanggal && pt.tanggal > latest) latest = pt.tanggal;
              });
            });
            return latest;
          };
          const dateA = getLatestDate(a);
          const dateB = getLatestDate(b);
          if (dateA && dateB) return dateB.localeCompare(dateA);
          if (dateA) return -1;
          if (dateB) return 1;
          return (b.jumlahMapel || 0) - (a.jumlahMapel || 0);
        }
        if (sortMapel === "mapel_terbanyak") {
          return (b.jumlahMapel || 0) - (a.jumlahMapel || 0);
        }
        if (sortMapel === "siswa_terbanyak") {
          return (b.totalSiswa || 0) - (a.totalSiswa || 0);
        }
        if (sortMapel === "nama") {
          return (a.namaGuru || "").localeCompare(b.namaGuru || "");
        }
        return 0;
      });
  }, [dataMapel.cards, searchMapel, filterMapelJenis, sortMapel]);

  // 4. Filter Wali Kelas
  const filteredCardsWaliKelas = useMemo(() => {
    const list = dataWaliKelas.cards || [];
    return list
      .filter((w) => {
        const matchSearch =
          !searchWaliKelas ||
          (w.namaGuru || "")
            .toLowerCase()
            .includes(searchWaliKelas.toLowerCase()) ||
          (w.namaKelas || "")
            .toLowerCase()
            .includes(searchWaliKelas.toLowerCase()) ||
          (w.keterangan || "")
            .toLowerCase()
            .includes(searchWaliKelas.toLowerCase());

        let matchStatus = true;
        const hasTodayAbsen =
          (w.presensiHariIni?.hadir || 0) +
            (w.presensiHariIni?.sakit || 0) +
            (w.presensiHariIni?.izin || 0) +
            (w.presensiHariIni?.alfa || 0) >
          0;
        if (filterWaliKelasStatus === "sudah_presensi") {
          matchStatus = hasTodayAbsen;
        } else if (filterWaliKelasStatus === "belum_presensi") {
          matchStatus = !hasTodayAbsen;
        }

        return matchSearch && matchStatus;
      })
      .sort((a, b) => {
        if (sortWaliKelas === "terbaru") {
          const dateA = a.presensiHariIni?.tanggal || a.presensi?.latestDate || a.createdAt || "";
          const dateB = b.presensiHariIni?.tanggal || b.presensi?.latestDate || b.createdAt || "";
          if (dateA && dateB) return dateB.localeCompare(dateA);
          if (dateA) return -1;
          if (dateB) return 1;
          return (b.jumlahSiswa || 0) - (a.jumlahSiswa || 0);
        }
        if (sortWaliKelas === "kehadiran") {
          return (b.presensiHariIni?.persenHadir || 0) - (a.presensiHariIni?.persenHadir || 0);
        }
        if (sortWaliKelas === "siswa") {
          return (b.jumlahSiswa || 0) - (a.jumlahSiswa || 0);
        }
        if (sortWaliKelas === "nama") {
          return (a.namaKelas || "").localeCompare(b.namaKelas || "");
        }
        return 0;
      });
  }, [dataWaliKelas.cards, searchWaliKelas, filterWaliKelasStatus, sortWaliKelas]);

  // Filter Seluruh Presensi Wali Kelas untuk Modal Master
  const filteredAllPresensi = useMemo(() => {
    let list = [];
    if (
      Array.isArray(dataWaliKelas?.statistik?.semuaPresensiTerbaru) &&
      dataWaliKelas.statistik.semuaPresensiTerbaru.length > 0
    ) {
      list = dataWaliKelas.statistik.semuaPresensiTerbaru;
    } else if (Array.isArray(dataWaliKelas?.cards)) {
      dataWaliKelas.cards.forEach((c) => {
        if (Array.isArray(c.riwayatPresensi)) {
          list = list.concat(c.riwayatPresensi);
        }
      });
    }

    return list.filter((item) => {
      if (filterKelasPresensi !== "all") {
        if (
          item.idWali !== filterKelasPresensi &&
          item.namaKelas !== filterKelasPresensi
        ) {
          return false;
        }
      }
      if (filterStatusPresensi !== "all") {
        if (
          String(item.status || "").toLowerCase() !==
          filterStatusPresensi.toLowerCase()
        ) {
          return false;
        }
      }
      if (searchPresensiText.trim()) {
        const query = searchPresensiText.toLowerCase();
        const namaSiswa = String(item.namaSiswa || "").toLowerCase();
        const namaKelas = String(item.namaKelas || "").toLowerCase();
        const namaGuru = String(item.namaGuru || "").toLowerCase();
        const ket = String(item.keterangan || "").toLowerCase();
        const tgl = String(item.tanggal || "").toLowerCase();
        if (
          !namaSiswa.includes(query) &&
          !namaKelas.includes(query) &&
          !namaGuru.includes(query) &&
          !ket.includes(query) &&
          !tgl.includes(query)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    dataWaliKelas,
    filterKelasPresensi,
    filterStatusPresensi,
    searchPresensiText,
  ]);

  // Fetch data grid presensi saat modal kelas spesifik dibuka
  useEffect(() => {
    if (
      !selectedPresensiKelasModal?.idWali ||
      !selectedPresensiKelasModal?.idGuru
    ) {
      return;
    }

    let isMounted = true;
    async function fetchGrid() {
      setLoadingModalGrid(true);
      try {
        const res = await getPresensiWaliGrid(
          selectedPresensiKelasModal.idGuru,
          selectedPresensiKelasModal.idWali,
        );
        if (isMounted && res && res.success && res.data) {
          setModalGridData(res.data);
        }
      } catch (e) {
        console.warn("Gagal load grid presensi wali:", e);
      } finally {
        if (isMounted) setLoadingModalGrid(false);
      }
    }

    fetchGrid();
    return () => {
      isMounted = false;
    };
  }, [selectedPresensiKelasModal]);

  // Handler cetak PDF Laporan Wali Kelas Resmi
  const handleCetakLaporanPdf = async () => {
    if (!selectedPresensiKelasModal) return;
    try {
      setCetakLaporanLoading(true);
      await generateLaporanWaliKelasPDF({
        guru: {
          id: selectedPresensiKelasModal.idGuru,
          nama: selectedPresensiKelasModal.namaGuru,
        },
        wali: {
          idWali: selectedPresensiKelasModal.idWali,
          namaKelas: selectedPresensiKelasModal.namaKelas,
          kelas: selectedPresensiKelasModal.namaKelas,
          keterangan: selectedPresensiKelasModal.keterangan,
        },
      });
    } catch (err) {
      console.error("Gagal cetak PDF laporan wali kelas:", err);
      alert(err.message || "Gagal mencetak laporan PDF wali kelas.");
    } finally {
      setCetakLaporanLoading(false);
    }
  };

  // Matrix Presensi Siswa mirip Cetak Laporan PDF
  const matrixData = useMemo(() => {
    if (!selectedPresensiKelasModal) {
      return {
        siswaList: [],
        daftarTanggal: [],
        grid: {},
        perTanggalStats: {},
        rataRataKehadiran: 0,
        totalHari: 0,
        totalSiswa: 0,
      };
    }

    // 1. Ambil list siswa
    const rawSiswa =
      modalGridData?.siswa && modalGridData.siswa.length > 0
        ? modalGridData.siswa
        : selectedPresensiKelasModal.daftarSiswa || [];

    const siswaList = rawSiswa
      .map((s) => ({
        idSiswa: String(s.idSiswa || s.ID_SISWA || s.id || ""),
        nama: s.nama || s.namaSiswa || s.NAMA_SISWA || `Siswa ${s.idSiswa}`,
        kelas: s.kelas || selectedPresensiKelasModal.namaKelas || "",
      }))
      .sort((a, b) => a.nama.localeCompare(b.nama));

    // 2. Ambil list presensi
    const rawPresensi =
      modalGridData?.presensi && modalGridData.presensi.length > 0
        ? modalGridData.presensi
        : selectedPresensiKelasModal.riwayatPresensi || [];

    const grid = {};
    const tanggalSet = new Set();

    rawPresensi.forEach((p) => {
      const sid = String(p.idSiswa || p.ID_SISWA || "").trim();
      const rawTgl = p.tanggal || p.TANGGAL;
      if (!rawTgl || !sid) return;
      const tgl = String(rawTgl).substring(0, 10);
      tanggalSet.add(tgl);

      const key = `${sid}_${tgl}`;
      grid[key] = {
        status: p.status || p.STATUS || "Hadir",
        keterangan: p.keterangan || p.KETERANGAN || "",
      };
    });

    const daftarTanggal = Array.from(tanggalSet).sort();

    // 3. Hitung ringkasan total per siswa
    let grandTotalHadir = 0;
    let totalCell = 0;

    const siswaMatrix = siswaList.map((s) => {
      let h = 0,
        sakit = 0,
        i = 0,
        a = 0,
        c = 0;
      daftarTanggal.forEach((tgl) => {
        const cell = grid[`${s.idSiswa}_${tgl}`];
        if (cell?.status) {
          totalCell++;
          if (cell.status === "Hadir") {
            h++;
            grandTotalHadir++;
          } else if (cell.status === "Sakit") sakit++;
          else if (cell.status === "Izin") i++;
          else if (cell.status === "Alfa") a++;
          else if (cell.status === "Cabut") c++;
        }
      });

      const totalMasuk = h + sakit + i + a + c;
      const persen =
        daftarTanggal.length > 0
          ? Math.round((h / daftarTanggal.length) * 100)
          : totalMasuk > 0
            ? Math.round((h / totalMasuk) * 100)
            : 0;

      return {
        ...s,
        h,
        s: sakit,
        i,
        a,
        c,
        totalMasuk,
        persen,
      };
    });

    // 4. Hitung kehadiran per tanggal (footer)
    const perTanggalStats = {};
    daftarTanggal.forEach((tgl) => {
      let countHadir = 0;
      siswaList.forEach((s) => {
        const cell = grid[`${s.idSiswa}_${tgl}`];
        if (cell?.status === "Hadir") countHadir++;
      });
      const persenDate =
        siswaList.length > 0
          ? Math.round((countHadir / siswaList.length) * 100)
          : 0;
      perTanggalStats[tgl] = { countHadir, persenDate };
    });

    const rataRataKehadiran =
      totalCell > 0
        ? Math.round((grandTotalHadir / totalCell) * 100)
        : siswaMatrix.length > 0 && daftarTanggal.length > 0
          ? Math.round(
              siswaMatrix.reduce((acc, curr) => acc + curr.persen, 0) /
                siswaMatrix.length,
            )
          : 0;

    return {
      siswaList: siswaMatrix,
      daftarTanggal,
      grid,
      perTanggalStats,
      rataRataKehadiran,
      totalHari: daftarTanggal.length,
      totalSiswa: siswaList.length,
    };
  }, [selectedPresensiKelasModal, modalGridData]);

  // Filter pencarian nama siswa di matrix
  const filteredMatrixSiswa = useMemo(() => {
    if (!searchMatrixStudent.trim()) return matrixData.siswaList;
    const q = searchMatrixStudent.toLowerCase();
    return matrixData.siswaList.filter(
      (s) =>
        s.nama.toLowerCase().includes(q) || s.idSiswa.toLowerCase().includes(q),
    );
  }, [matrixData.siswaList, searchMatrixStudent]);

  if (!isReady) {
    return (
      <main className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-white text-sm font-semibold tracking-wide">
            Menyiapkan Workspace Kepala Sekolah...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 space-y-6 pb-16 relative">
      {/* ======================================================= */}
      {/* 1. NAVBAR STICKY NAVY GRADIENT */}
      {/* ======================================================= */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white shadow-lg border-b border-blue-800/60">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1.5 rounded-xl border border-white/20 shadow-inner">
              <Image
                src="/logo.png"
                alt="Logo Sekolah"
                width={36}
                height={36}
                className="object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100">
                  PORTAL KEPALA SEKOLAH
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-black border border-amber-400/30">
                  EKSEKUTIF
                </span>
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => bukaPesan(null)}
              className="relative rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 px-3.5 py-2 text-xs font-black text-white border border-sky-300/50 shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              ✉️ PESAN
              {jumlahPesanBaru > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border border-white shadow">
                  {jumlahPesanBaru}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-gradient-to-r from-rose-700 to-red-800 px-4 py-2 text-xs font-black text-white border border-rose-400/50 shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              🚪 KELUAR
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-6">
        {/* ======================================================= */}
        {/* 2. HERO SAPAAN KEPALA SEKOLAH */}
        {/* ======================================================= */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl border border-blue-700/60">
          {/* Ornamen glow latar */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl pointer-events-none"></div>

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400/20 to-yellow-300/10 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider mb-3 border border-amber-400/40">
                🏛️ Workspace Kepala Sekolah
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight">
                Selamat Datang,
              </h2>
              <h3 className="mt-1 text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-200">
                {user?.nama || "Bapak/Ibu Kepala Sekolah"}
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-blue-200 max-w-xl font-medium leading-relaxed">
                Pusat kendali & agregasi evaluasi kinerja pembimbingan,
                presensi, dan jurnal lintas 4 modul pengajaran SMKN 1 Teluk
                Kuantan.
              </p>
            </div>

            {/* Quick Action Refresh */}
            <div className="flex flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
              <span className="text-[11px] text-blue-200 font-semibold bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                📅 {formatTanggal(new Date())}
              </span>
              <button
                onClick={() => {
                  loadMasterSiswa(true);
                  if (activeMenuTab === "pembimbing") loadPklData(true);
                  if (activeMenuTab === "wali") loadWaliData(true);
                  if (activeMenuTab === "mapel") loadMapelData(true);
                  if (activeMenuTab === "walikelas") loadWaliKelasData(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 font-black text-xs shadow-md transition-all active:scale-95"
              >
                <span>🔄</span> Segarkan Data
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================= */}
        {/* 2.5 STATISTIK AKUN SISWA SPREADSHEET (SEMUA KELAS) */}
        {/* ======================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Statistik Akun Siswa
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Data real-time seluruh Akun siswa yang terdaftar, Akun Siswa
                  dibuat Oleh Guru Pembimbing PKL/Guru Wali/Guru Mapel/Guru
                  Walas
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
              💡 Klik kartu untuk melihat daftar siswa
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Seluruh Siswa (Akun)"
              value={loadingMasterSiswa ? "..." : statsSiswa.totalAkun || "--"}
              accentColor="border-blue-600"
              icon="👥"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Akun Siswa — Semua Kelas",
                  statsSiswa.listAkun,
                  statsSiswa.breakdownAkun,
                )
              }
            />
            <StatCard
              title="Siswa Kelas X"
              value={
                loadingMasterSiswa ? "..." : (statsSiswa.totalKelasX ?? "--")
              }
              accentColor="border-sky-500"
              icon="🎒"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Siswa Kelas X",
                  statsSiswa.listKelasX,
                  statsSiswa.breakdownKelasX,
                )
              }
            />
            <StatCard
              title="Siswa Kelas XI"
              value={
                loadingMasterSiswa ? "..." : (statsSiswa.totalKelasXI ?? "--")
              }
              accentColor="border-indigo-500"
              icon="📘"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Siswa Kelas XI",
                  statsSiswa.listKelasXI,
                  statsSiswa.breakdownKelasXI,
                )
              }
            />
            <StatCard
              title="Siswa Kelas XII"
              value={
                loadingMasterSiswa ? "..." : (statsSiswa.totalKelasXII ?? "--")
              }
              accentColor="border-purple-600"
              icon="🎓"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Siswa Kelas XII (Jurusan PKL)",
                  statsSiswa.listKelasXII,
                  statsSiswa.breakdownKelasXII,
                )
              }
            />
          </div>
        </div>

        {/* ======================================================= */}
        {/* 3. TAB MENU EMAS 4 KATEGORI (IDENTIK POLA JS_GURU) */}
        {/* ======================================================= */}
        <div className="relative space-y-3 rounded-2xl border border-blue-700/50 bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-2.5 sm:p-4 shadow-lg">
          <div className="flex items-center gap-3 my-1 w-full px-1">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-amber-400 to-yellow-300 rounded-full opacity-80"></div>
            <h3 className="text-xs sm:text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 uppercase whitespace-nowrap drop-shadow-sm">
              MODUL MONITORING EKSEKUTIF
            </h3>
            <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-amber-400 to-yellow-300 rounded-full opacity-80"></div>
          </div>

          <div className="relative flex overflow-hidden rounded-xl border border-amber-400/30 bg-blue-950/80 p-1 shadow-inner">
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-0 w-12 rounded-r-xl bg-gradient-to-l from-amber-400/50 via-yellow-400/20 to-transparent sm:w-16"></div>

            {/* Tab 1: Pembimbing PKL */}
            <button
              onClick={() => handleTabChange("pembimbing")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "pembimbing"
                  ? "scale-[1.01] border border-[#FBF5B7] bg-gradient-to-r from-[#BF953F] via-[#FCF6BA] to-[#B38728] text-amber-950 shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-amber-400/15 hover:text-amber-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "pembimbing" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  👔
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Pembimbing PKL
              </span>
            </button>

            {/* Tab 2: Guru Wali */}
            <button
              onClick={() => handleTabChange("wali")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "wali"
                  ? "scale-[1.01] border border-[#FBF5B7] bg-gradient-to-r from-[#BF953F] via-[#FCF6BA] to-[#B38728] text-amber-950 shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-amber-400/15 hover:text-amber-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "wali" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  👨‍🏫
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Guru Wali
              </span>
            </button>

            {/* Tab 3: Guru Mapel */}
            <button
              onClick={() => handleTabChange("mapel")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "mapel"
                  ? "scale-[1.01] border border-[#FBF5B7] bg-gradient-to-r from-[#BF953F] via-[#FCF6BA] to-[#B38728] text-amber-950 shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-amber-400/15 hover:text-amber-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "mapel" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  📚
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Guru Mapel
              </span>
            </button>

            {/* Tab 4: Wali Kelas */}
            <button
              onClick={() => handleTabChange("walikelas")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "walikelas"
                  ? "scale-[1.01] border border-teal-300 bg-gradient-to-r from-teal-700 via-teal-500 to-emerald-600 text-white shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-teal-400/15 hover:text-teal-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "walikelas" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  🏫
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Wali Kelas
              </span>
            </button>
          </div>
        </div>

        {/* ======================================================= */}
        {/* KONTEN TAB 1: PEMBIMBING PKL */}
        {/* ======================================================= */}

        {/* TOGGLE TAMPILAN: LIST / KARTU (berlaku untuk semua tab) */}
        <div className="flex items-center justify-between gap-3 -mb-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Tampilan Daftar
          </p>
          <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => ubahViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-blue-900 text-white shadow"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              ☰ List
            </button>
            <button
              type="button"
              onClick={() => ubahViewMode("card")}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer ${
                viewMode === "card"
                  ? "bg-blue-900 text-white shadow"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              ▦ Kartu
            </button>
          </div>
        </div>
        {activeMenuTab === "pembimbing" && (
          <div className="space-y-6">
            {/* STATISTIK GRID MODUL PKL */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Guru Pembimbing"
                value={
                  dataPkl.statistik?.totalGuruPembimbing ??
                  (dataPkl.cards?.length || "--")
                }
                accentColor="border-indigo-500"
                icon="👔"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Guru Pembimbing PKL",
                    dataPkl.statistik?.listGuruPembimbing ||
                      (dataPkl.cards || []).map((g) => ({
                        nama: g.namaGuru,
                        info: `ID: ${g.idGuru} • ${g.jumlahSiswa || 0} siswa (${g.jumlahTempat || (g.daftarTempat || []).length} tempat)`,
                      })),
                  )
                }
              />
              <StatCard
                title="Total Siswa PKL"
                value={
                  dataPkl.statistik?.totalSiswaPkl ??
                  (statsSiswa.totalSiswaPkl > 0
                    ? statsSiswa.totalSiswaPkl
                    : "--")
                }
                accentColor="border-blue-500"
                icon="👥"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Siswa PKL (Memiliki Tempat Magang)",
                    dataPkl.statistik?.listSiswaPkl?.length > 0
                      ? dataPkl.statistik.listSiswaPkl
                      : statsSiswa.listSiswaPkl,
                  )
                }
              />
              <StatCard
                title="DUDI / Tempat PKL"
                value={dataPkl.statistik?.totalTempatPkl ?? "--"}
                accentColor="border-emerald-500"
                icon="📍"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Tempat PKL & Jumlah Siswa",
                    dataPkl.statistik?.listTempatPkl,
                  )
                }
              />
              <StatCard
                title="Jurnal PKL Terisi"
                value={dataPkl.statistik?.totalJurnalPkl ?? "--"}
                accentColor="border-amber-500"
                icon="📝"
                onClick={() =>
                  handleStatCardClick(
                    "Log Jurnal PKL Terbaru",
                    dataPkl.statistik?.listJurnalTerbaru,
                  )
                }
              />
            </div>

            {/* FILTER & PENCARIAN */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">👔</span>
                <h3 className="text-base font-black text-slate-800">
                  Daftar Guru Pembimbing PKL
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                  {filteredCardsPkl.length} Guru
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchPkl}
                    onChange={(e) => setSearchPkl(e.target.value)}
                    placeholder="Cari guru, siswa, tempat..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-medium"
                  />
                </div>

                <select
                  value={filterPklStatus}
                  onChange={(e) => setFilterPklStatus(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="semua">Semua Status Jurnal</option>
                  <option value="sudah_jurnal">✅ Sudah Isi Jurnal</option>
                  <option value="belum_jurnal">⚠️ Belum Isi Jurnal</option>
                </select>

                <select
                  value={sortPkl}
                  onChange={(e) => setSortPkl(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="terbaru">⚡ Urutkan: Data Terbaru</option>
                  <option value="terbanyak">👥 Siswa Terbanyak</option>
                  <option value="nama">🔤 Nama Guru (A-Z)</option>
                </select>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorPkl && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
                <p className="text-xs font-bold">⚠️ {errorPkl}</p>
                <button
                  onClick={() => loadPklData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingPkl && <LoadingGrid count={6} />}

            {/* GRID CARDS GURU PKL */}
            {!loadingPkl && filteredCardsPkl.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-400">
                  Tidak ada guru pembimbing PKL yang sesuai dengan filter
                  pencarian.
                </p>
              </div>
            )}

            {!loadingPkl &&
              filteredCardsPkl.length > 0 &&
              viewMode === "list" && (
                <div className="space-y-3">
                  {filteredCardsPkl.map((guru, idx) => {
                    const siswaPklCount = getSiswaPklList(guru).length;
                    return (
                      <GuruListRow
                        key={guru.idGuru}
                        no={idx + 1}
                        initials={String(guru.namaGuru || "?")
                          .substring(0, 2)
                          .toUpperCase()}
                        title={guru.namaGuru}
                        subtitle={`ID: ${guru.idGuru}`}
                        badge={{
                          text: guru.sudahIsiJurnal
                            ? "Aktif Jurnal"
                            : "Belum Jurnal",
                          tone: guru.sudahIsiJurnal ? "ok" : "warn",
                        }}
                        metas={[
                          {
                            label: "Siswa PKL",
                            value: `${siswaPklCount} Siswa`,
                          },
                          {
                            label: "DUDI / Tempat",
                            value: `${guru.jumlahTempat || 0} Lokasi`,
                          },
                          {
                            label: "Monitoring",
                            value: `${guru.totalMonitoring || 0}x Laporan`,
                            tone: "text-emerald-300",
                          },
                          {
                            label: "Jurnal Terakhir",
                            value:
                              guru.jurnalTerakhir?.materi || "Belum ada materi",
                          },
                        ]}
                        actions={[
                          {
                            icon: "📷",
                            label: `Monitoring (${guru.totalMonitoring || 0})`,
                            tone: "emerald",
                            onClick: () => handleOpenMonitoring(guru),
                          },
                          {
                            icon: "📋",
                            label: "Presensi",
                            tone: "amber",
                            onClick: () => handleLihatPresensiSiswa(guru),
                          },
                          {
                            icon: "✉️",
                            label: "Pesan",
                            tone: "sky",
                            onClick: () => bukaPesan(guru),
                          },
                        ]}
                        onClick={() => setSelectedGuruPkl(guru)}
                      />
                    );
                  })}
                </div>
              )}

            {!loadingPkl &&
              filteredCardsPkl.length > 0 &&
              viewMode === "card" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCardsPkl.map((guru) => {
                    const siswaPklCount = getSiswaPklList(guru).length;
                    return (
                      <div
                        key={guru.idGuru}
                        onClick={() => setSelectedGuruPkl(guru)}
                        className="group relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 rounded-2xl border border-blue-700/50 p-5 shadow-lg hover:shadow-amber-500/20 hover:border-amber-400/60 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                      >
                        {/* Efek Sedikit Gradien Kuning di Sudut Kanan Atas */}
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-600/5 blur-2xl pointer-events-none group-hover:bg-amber-400/30 transition-all duration-500"></div>

                        <div className="relative z-10">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-900 flex items-center justify-center font-black text-sm shadow-md">
                                {guru.namaGuru.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                                  {guru.namaGuru}
                                </h4>
                                <p className="text-[11px] font-medium text-blue-300">
                                  ID: {guru.idGuru}
                                </p>
                              </div>
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase border ${
                                guru.sudahIsiJurnal
                                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                                  : "bg-rose-500/20 text-rose-300 border-rose-400/30"
                              }`}
                            >
                              {guru.sudahIsiJurnal
                                ? "Aktif Jurnal"
                                : "Belum Jurnal"}
                            </span>
                          </div>

                          {/* Info Siswa & Tempat & Monitoring */}
                          <div className="mt-4 grid grid-cols-3 gap-2 bg-blue-950/60 p-2.5 rounded-xl border border-blue-800/50">
                            <div>
                              <p className="text-[10px] font-bold text-blue-300/80 uppercase">
                                Siswa PKL
                              </p>
                              <p className="text-xs font-black text-white">
                                {siswaPklCount} Siswa
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-blue-300/80 uppercase">
                                DUDI / Tempat
                              </p>
                              <p className="text-xs font-black text-white">
                                {guru.jumlahTempat} Lokasi
                              </p>
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMonitoring(guru);
                              }}
                              className="cursor-pointer hover:bg-emerald-500/20 rounded-lg p-0.5 transition-colors group/mon"
                              title="Klik untuk melihat foto dan keterangan monitoring"
                            >
                              <p className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-0.5">
                                <span>📷</span> Monitoring
                              </p>
                              <p className="text-xs font-black text-emerald-300 underline decoration-dotted group-hover/mon:text-emerald-200">
                                {guru.totalMonitoring || 0}x Laporan
                              </p>
                            </div>
                          </div>

                          {/* Jurnal Terakhir */}
                          <div className="mt-3">
                            <p className="text-[10px] font-bold text-amber-300/80 uppercase">
                              Jurnal Terakhir:
                            </p>
                            <p className="text-xs font-semibold text-blue-50 line-clamp-1">
                              {guru.jurnalTerakhir?.materi ||
                                "Belum ada materi tercatat"}
                            </p>
                            {guru.jurnalTerakhir?.tanggal && (
                              <p className="text-[10px] text-blue-300/70">
                                📅{" "}
                                {formatTanggalIndo(guru.jurnalTerakhir.tanggal)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="relative z-10 mt-4 pt-3 border-t border-blue-800/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMonitoring(guru);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-emerald-300 font-bold border border-white/10 transition-colors shadow-xs active:scale-95"
                            >
                              <span>📷</span>
                              <span>
                                Monitoring ({guru.totalMonitoring || 0})
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLihatPresensiSiswa(guru);
                              }}
                              title="Buka halaman Rekap Presensi untuk guru pembimbing ini"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-amber-300 font-bold border border-white/10 transition-colors shadow-xs active:scale-95"
                            >
                              <span>📋</span>
                              <span>Presensi Siswa</span>
                            </button>

                            <PesanButton onClick={() => bukaPesan(guru)} />
                          </div>

                          <div className="flex items-center gap-1 font-black text-amber-400 group-hover:translate-x-1 transition-transform">
                            <span>Rincian</span>
                            <span>→</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        )}

        {/* ======================================================= */}
        {/* KONTEN TAB 2: GURU WALI */}
        {/* ======================================================= */}
        {activeMenuTab === "wali" && (
          <div className="space-y-6">
            {/* STATISTIK GRID GURU WALI */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <StatCard
                title="Guru Wali Aktif"
                value={dataWali.statistik?.totalGuruWali ?? "--"}
                accentColor="border-indigo-500"
                icon="👨‍🏫"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Guru Wali",
                    dataWali.statistik?.listGuruWali,
                  )
                }
              />
              <StatCard
                title="Siswa Perwalian"
                value={dataWali.statistik?.totalSiswaWali ?? "--"}
                accentColor="border-blue-500"
                icon="🧒"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Seluruh Siswa Wali",
                    dataWali.statistik?.listSiswaWali,
                  )
                }
              />
              <StatCard
                title="Total Pertemuan"
                value={dataWali.statistik?.totalPertemuanWali ?? "--"}
                accentColor="border-emerald-500"
                icon="🤝"
                onClick={() =>
                  handleStatCardClick(
                    "Log Pertemuan Bimbingan Terbaru",
                    dataWali.statistik?.listPertemuanTerbaru,
                  )
                }
              />
            </div>

            {/* FILTER & PENCARIAN GURU WALI */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">👨‍🏫</span>
                <h3 className="text-base font-black text-slate-800">
                  Daftar Guru Wali & Pertemuan
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                  {filteredCardsWali.length} Guru
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchWali}
                    onChange={(e) => setSearchWali(e.target.value)}
                    placeholder="Cari nama guru, anak wali..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-medium"
                  />
                </div>

                <select
                  value={filterWaliStatus}
                  onChange={(e) => setFilterWaliStatus(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="semua">Semua Status Pertemuan</option>
                  <option value="sudah_jurnal">✅ Sudah Ada Pertemuan</option>
                  <option value="belum_jurnal">⚠️ Belum Ada Pertemuan</option>
                </select>

                <select
                  value={sortWali}
                  onChange={(e) => setSortWali(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="terbaru">⚡ Urutkan: Data Terbaru</option>
                  <option value="terbanyak">👥 Siswa Terbanyak</option>
                  <option value="nama">🔤 Nama Guru (A-Z)</option>
                </select>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorWali && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
                <p className="text-xs font-bold">⚠️ {errorWali}</p>
                <button
                  onClick={() => loadWaliData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingWali && <LoadingGrid count={6} />}

            {/* GRID CARDS GURU WALI */}
            {!loadingWali && filteredCardsWali.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-400">
                  Tidak ada guru wali yang sesuai dengan filter pencarian.
                </p>
              </div>
            )}

            {!loadingWali &&
              filteredCardsWali.length > 0 &&
              viewMode === "list" && (
                <div className="space-y-3">
                  {filteredCardsWali.map((guru, idx) => (
                    <GuruListRow
                      key={guru.idGuru}
                      no={idx + 1}
                      initials={String(guru.namaGuru || "?")
                        .substring(0, 2)
                        .toUpperCase()}
                      title={guru.namaGuru}
                      subtitle={`ID: ${guru.idGuru}`}
                      badge={{
                        text: `${guru.totalPertemuan} Pertemuan`,
                        tone: guru.totalPertemuan > 0 ? "ok" : "neutral",
                      }}
                      metas={[
                        {
                          label: "Anak Wali",
                          value: `${guru.jumlahSiswa} Siswa`,
                        },
                        {
                          label: "Rasio Bimbingan",
                          value:
                            guru.jumlahSiswa > 0
                              ? `${(guru.totalPertemuan / guru.jumlahSiswa).toFixed(1)}x / siswa`
                              : "-",
                          tone: "text-amber-300",
                        },
                        {
                          label: "Topik Terakhir",
                          value:
                            guru.jurnalTerakhir?.topik || "Belum ada catatan",
                          wide: true,
                        },
                      ]}
                      actions={[
                        {
                          icon: "✉️",
                          label: "Pesan",
                          tone: "sky",
                          onClick: () => bukaPesan(guru),
                        },
                      ]}
                      onClick={() => setSelectedGuruWali(guru)}
                    />
                  ))}
                </div>
              )}

            {!loadingWali &&
              filteredCardsWali.length > 0 &&
              viewMode === "card" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCardsWali.map((guru) => (
                    <div
                      key={guru.idGuru}
                      onClick={() => setSelectedGuruWali(guru)}
                      className="group relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 rounded-2xl border border-blue-700/50 p-5 shadow-lg hover:shadow-amber-500/20 hover:border-amber-400/60 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                    >
                      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-600/5 blur-2xl pointer-events-none group-hover:bg-amber-400/30 transition-all duration-500"></div>

                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-900 flex items-center justify-center font-black text-sm shadow-md">
                              {guru.namaGuru.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                                {guru.namaGuru}
                              </h4>
                              <p className="text-[11px] font-medium text-blue-300">
                                ID: {guru.idGuru}
                              </p>
                            </div>
                          </div>

                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide border ${
                              guru.totalPertemuan > 0
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/30"
                                : "bg-white/10 text-slate-300 border-white/20"
                            }`}
                          >
                            {guru.totalPertemuan} Pertemuan
                          </span>
                        </div>

                        {/* Info Anak Wali */}
                        <div className="mt-4 bg-blue-950/60 p-3 rounded-xl border border-blue-800/50 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-blue-300/80 uppercase">
                              Jumlah Anak Wali
                            </p>
                            <p className="text-sm font-black text-white">
                              {guru.jumlahSiswa} Siswa
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-blue-300/80 uppercase">
                              Rasio Bimbingan
                            </p>
                            <p className="text-sm font-black text-amber-400">
                              {guru.jumlahSiswa > 0
                                ? `${(guru.totalPertemuan / guru.jumlahSiswa).toFixed(1)}x / siswa`
                                : "-"}
                            </p>
                          </div>
                        </div>

                        {/* Topik Jurnal Terakhir */}
                        <div className="mt-3">
                          <p className="text-[10px] font-bold text-amber-300/80 uppercase">
                            Topik Terakhir:
                          </p>
                          <p className="text-xs font-semibold text-blue-50 line-clamp-1">
                            {guru.jurnalTerakhir?.topik ||
                              "Belum ada catatan pertemuan"}
                          </p>
                          {guru.jurnalTerakhir?.tanggal && (
                            <p className="text-[10px] text-blue-300/70">
                              📅{" "}
                              {formatTanggalIndo(guru.jurnalTerakhir.tanggal)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="relative z-10 mt-4 pt-3 border-t border-blue-800/50 flex items-center justify-between gap-2 text-xs font-black text-amber-400">
                        <PesanButton onClick={() => bukaPesan(guru)} />
                        <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Detail Jurnal & Murid</span>
                          <span>→</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* ======================================================= */}
        {/* KONTEN TAB 3: GURU MAPEL */}
        {/* ======================================================= */}
        {activeMenuTab === "mapel" && (
          <div className="space-y-6">
            {/* STATISTIK GRID GURU MAPEL */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <StatCard
                title="Guru Mapel"
                value={dataMapel.statistik?.totalGuruMapel ?? "--"}
                accentColor="border-indigo-500"
                icon="📚"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Guru Mata Pelajaran",
                    dataMapel.statistik?.listGuruMapel,
                  )
                }
              />
              <StatCard
                title="Rombel / Kelas Mapel"
                value={dataMapel.statistik?.totalKelasMapel ?? "--"}
                accentColor="border-blue-500"
                icon="🏫"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Rombel Mata Pelajaran",
                    dataMapel.statistik?.listKelasMapel,
                  )
                }
              />
              <StatCard
                title="Jurnal Mengajar"
                value={dataMapel.statistik?.totalJurnalMapel ?? "--"}
                accentColor="border-emerald-500"
                icon="📖"
                onClick={() =>
                  handleStatCardClick(
                    "Log Jurnal Guru Mapel Terbaru",
                    dataMapel.statistik?.listJurnalMapelTerbaru,
                  )
                }
              />
            </div>

            {/* FILTER & PENCARIAN GURU MAPEL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h3 className="text-base font-black text-slate-800">
                  Daftar Guru Pengampu Mapel
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                  {filteredCardsMapel.length} Guru
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-60">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchMapel}
                    onChange={(e) => setSearchMapel(e.target.value)}
                    placeholder="Cari guru, mata pelajaran, kelas..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-medium"
                  />
                </div>

                <select
                  value={filterMapelJenis}
                  onChange={(e) => setFilterMapelJenis(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="semua">Semua Tipe Mapel</option>
                  <option value="online">🌐 Mapel Online</option>
                  <option value="reguler">📚 Mapel Reguler</option>
                </select>

                <select
                  value={sortMapel}
                  onChange={(e) => setSortMapel(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="terbaru">⚡ Urutkan: Data Terbaru</option>
                  <option value="mapel_terbanyak">📚 Mapel Terbanyak</option>
                  <option value="siswa_terbanyak">👥 Siswa Terbanyak</option>
                  <option value="nama">🔤 Nama Guru (A-Z)</option>
                </select>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorMapel && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
                <p className="text-xs font-bold">⚠️ {errorMapel}</p>
                <button
                  onClick={() => loadMapelData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingMapel && <LoadingGrid count={6} />}

            {/* GRID CARDS GURU MAPEL */}
            {!loadingMapel && filteredCardsMapel.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-400">
                  Tidak ada guru mapel yang sesuai dengan filter pencarian.
                </p>
              </div>
            )}

            {!loadingMapel &&
              filteredCardsMapel.length > 0 &&
              viewMode === "list" && (
                <div className="space-y-3">
                  {filteredCardsMapel.map((guru, idx) => (
                    <GuruListRow
                      key={guru.idGuru}
                      no={idx + 1}
                      initials={String(guru.namaGuru || "?")
                        .substring(0, 2)
                        .toUpperCase()}
                      title={guru.namaGuru}
                      subtitle={`ID: ${guru.idGuru}`}
                      badge={{
                        text: `${guru.jumlahMapel} Mapel`,
                        tone: "info",
                      }}
                      metas={[
                        {
                          label: "Jurnal Terakhir",
                          value:
                            guru.jurnalTerakhir?.topik ||
                            "Belum ada catatan jurnal",
                          wide: true,
                        },
                      ]}
                      extra={
                        <div className="flex flex-wrap gap-1.5">
                          {(guru.daftarMapel || []).slice(0, 4).map((m, i) => {
                            const isOnline = m.isOnline ||
                              String(m.keterangan || "").toUpperCase().includes("ONLINE") ||
                              String(m.namaMapel || "").toUpperCase().includes("ONLINE");
                            return (
                              <span
                                key={i}
                                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border flex items-center gap-1 ${
                                  isOnline
                                    ? "bg-teal-900/60 text-teal-200 border-teal-500/40"
                                    : "bg-white/10 text-white border-white/20"
                                }`}
                              >
                                <span>{isOnline ? "🌐" : "📚"}</span>
                                <span>{m.namaMapel} ({m.kelas || "-"})</span>
                                {m.totalTugasDikumpulkan > 0 && (
                                  <span className="text-[9px] bg-emerald-500/30 text-emerald-200 px-1 rounded font-bold">
                                    📎 {m.totalTugasDikumpulkan}
                                  </span>
                                )}
                              </span>
                            );
                          })}
                          {(guru.daftarMapel || []).length > 4 && (
                            <span className="px-2 py-0.5 rounded-md bg-white/5 text-blue-200 text-[11px] font-bold">
                              +{(guru.daftarMapel || []).length - 4} lainnya
                            </span>
                          )}
                        </div>
                      }
                      actions={[
                        {
                          icon: "✉️",
                          label: "Pesan",
                          tone: "sky",
                          onClick: () => bukaPesan(guru),
                        },
                      ]}
                      onClick={() => setSelectedGuruMapel(guru)}
                    />
                  ))}
                </div>
              )}

            {!loadingMapel &&
              filteredCardsMapel.length > 0 &&
              viewMode === "card" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCardsMapel.map((guru) => (
                    <div
                      key={guru.idGuru}
                      onClick={() => setSelectedGuruMapel(guru)}
                      className="group relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 rounded-2xl border border-blue-700/50 p-5 shadow-lg hover:shadow-amber-500/20 hover:border-amber-400/60 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                    >
                      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-600/5 blur-2xl pointer-events-none group-hover:bg-amber-400/30 transition-all duration-500"></div>

                      <div className="relative z-10">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-900 flex items-center justify-center font-black text-sm shadow-md">
                              {guru.namaGuru.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors">
                                {guru.namaGuru}
                              </h4>
                              <p className="text-[11px] font-medium text-blue-300">
                                ID: {guru.idGuru}
                              </p>
                            </div>
                          </div>

                          <span className="px-2.5 py-0.5 rounded-full bg-blue-800/60 border border-blue-600 text-amber-200 text-[10px] font-black">
                            {guru.jumlahMapel} Mapel
                          </span>
                        </div>

                        {/* Daftar Mata Pelajaran Diampu */}
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-bold text-blue-300/80 uppercase">
                            <span>Mata Pelajaran & Kelas:</span>
                            <span>{guru.daftarMapel?.length || 0} Mapel</span>
                          </div>
                          <div className="space-y-1.5">
                            {(guru.daftarMapel || []).slice(0, 3).map((m, idx) => {
                              const isOnline = m.isOnline ||
                                String(m.keterangan || "").toUpperCase().includes("ONLINE") ||
                                String(m.namaMapel || "").toUpperCase().includes("ONLINE");
                              return (
                                <div
                                  key={idx}
                                  className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                                    isOnline
                                      ? "bg-teal-950/60 border-teal-500/40 text-teal-100"
                                      : "bg-blue-900/40 border-blue-600/40 text-blue-100"
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs">{isOnline ? "🌐" : "📚"}</span>
                                      <span className="font-bold text-xs truncate text-white">{m.namaMapel}</span>
                                      {isOnline && (
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-teal-400/20 text-teal-300 border border-teal-400/30">
                                          ONLINE
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-blue-300/70 mt-0.5">
                                      {m.kelas ? `Kelas ${m.kelas}` : "Semua Kelas"} • 👥 {m.siswaCount || 0} Siswa
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                                    {m.presensiPertemuan?.length > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white border border-white/20">
                                        📅 {m.presensiPertemuan.length} Sesi
                                      </span>
                                    )}
                                    {m.totalTugasDikumpulkan > 0 && (
                                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                                        📎 {m.totalTugasDikumpulkan} Tugas
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {(guru.daftarMapel || []).length > 3 && (
                              <p className="text-center text-[10px] font-bold text-amber-300/90 py-1 bg-white/5 rounded-lg border border-white/10">
                                +{(guru.daftarMapel || []).length - 3} mata pelajaran lainnya
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Jurnal Terakhir */}
                        <div className="mt-3 bg-blue-950/60 p-2.5 rounded-xl border border-blue-800/50">
                          <p className="text-[10px] font-bold text-amber-300/80 uppercase">
                            Jurnal Terakhir:
                          </p>
                          <p className="text-xs font-semibold text-blue-50 line-clamp-1">
                            {guru.jurnalTerakhir?.topik ||
                              "Belum ada catatan jurnal"}
                          </p>
                          {guru.jurnalTerakhir?.tanggal && (
                            <p className="text-[10px] text-blue-300/70">
                              📅{" "}
                              {formatTanggalIndo(guru.jurnalTerakhir.tanggal)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="relative z-10 mt-4 pt-3 border-t border-blue-800/50 flex items-center justify-between gap-2 text-xs font-black text-amber-400">
                        <PesanButton onClick={() => bukaPesan(guru)} />
                        <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                          <span>Rincian Kelas & Jurnal</span>
                          <span>→</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* ======================================================= */}
        {/* KONTEN TAB 4: WALI KELAS */}
        {/* ======================================================= */}
        {activeMenuTab === "walikelas" && (
          <div className="space-y-6">
            {/* STATISTIK GRID WALI KELAS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Total Kelas Wali"
                value={dataWaliKelas.statistik?.totalWaliKelas ?? "--"}
                accentColor="border-teal-500"
                icon="🏫"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Kelas & Wali",
                    dataWaliKelas.statistik?.listKelasWali,
                  )
                }
              />
              <StatCard
                title="Siswa Terdaftar"
                value={dataWaliKelas.statistik?.totalSiswaWaliKelas ?? "--"}
                accentColor="border-blue-500"
                icon="👥"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Kelas & Jumlah Siswa",
                    dataWaliKelas.statistik?.listKelasWali,
                  )
                }
              />
              <StatCard
                title="Hadir Hari Ini"
                value={
                  dataWaliKelas.statistik?.totalHadirHariIni !== undefined
                    ? `${dataWaliKelas.statistik.totalHadirHariIni} (${dataWaliKelas.statistik.persenKehadiranHariIni ?? 0}%)`
                    : "--"
                }
                accentColor="border-emerald-500"
                icon="🟢"
                onClick={() =>
                  handleStatCardClick(
                    "Daftar Siswa Hadir Hari Ini",
                    dataWaliKelas.statistik?.listSiswaHadirHariIni,
                  )
                }
              />
              <StatCard
                title="Bimbingan Wali"
                value={dataWaliKelas.statistik?.totalJurnalBimbingan ?? "--"}
                accentColor="border-amber-500"
                icon="📋"
                onClick={() =>
                  handleStatCardClick(
                    "Log Bimbingan Kelas Terbaru",
                    dataWaliKelas.statistik?.listJurnalBimbinganTerbaru,
                  )
                }
              />
            </div>

            {/* BANNER UTAMA KEHADIRAN HARI INI & ACTION BAR */}
            <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 p-5 sm:p-6 rounded-3xl border border-teal-500/30 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>
                    📅 Tanggal:{" "}
                    {dataWaliKelas.statistik?.tanggalHariIni || "Hari Ini"}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-white flex flex-wrap items-center gap-2">
                  <span>🏫 Monitoring Presensi Siswa Wali Kelas</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black shadow-xs">
                    {dataWaliKelas.statistik?.persenKehadiranHariIni ?? 0}%
                    Total Hadir
                  </span>
                </h3>
                <p className="text-xs text-slate-300 max-w-xl">
                  Pantau kehadiran realtime tiap kelas, rincian siswa hadir hari
                  ini, serta rekap catatan bimbingan wali kelas.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAllPresensiModalOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 text-xs font-black shadow-lg hover:shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <span className="text-sm">📋</span>
                  <span>Lihat Seluruh Presensi Wali Kelas</span>
                </button>
                <button
                  type="button"
                  onClick={() => loadWaliKelasData(true)}
                  className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <span>🔄</span>
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* FILTER & PENCARIAN WALI KELAS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white font-black text-lg shadow-xs">
                  🏫
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800">
                    Daftar Rombel & Presensi Wali Kelas
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400">
                    Menampilkan {filteredCardsWaliKelas.length} Rombongan
                    Belajar
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative flex-1 sm:w-60">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchWaliKelas}
                    onChange={(e) => setSearchWaliKelas(e.target.value)}
                    placeholder="Cari kelas, nama guru wali..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 outline-none font-medium transition-all"
                  />
                </div>

                <select
                  value={filterWaliKelasStatus}
                  onChange={(e) => setFilterWaliKelasStatus(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="semua">Semua Status Presensi</option>
                  <option value="sudah_presensi">✅ Sudah Presensi Hari Ini</option>
                  <option value="belum_presensi">⚠️ Belum Presensi Hari Ini</option>
                </select>

                <select
                  value={sortWaliKelas}
                  onChange={(e) => setSortWaliKelas(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 font-bold outline-none"
                >
                  <option value="terbaru">⚡ Urutkan: Data Terbaru</option>
                  <option value="kehadiran">📊 % Kehadiran Hari Ini</option>
                  <option value="siswa">👥 Siswa Terbanyak</option>
                  <option value="nama">🔤 Nama Kelas (A-Z)</option>
                </select>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorWaliKelas && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
                <p className="text-xs font-bold">⚠️ {errorWaliKelas}</p>
                <button
                  onClick={() => loadWaliKelasData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingWaliKelas && <LoadingGrid count={6} />}

            {/* GRID CARDS WALI KELAS DENGAN DESAIN MODERN & PRESENSI HARI INI */}
            {!loadingWaliKelas && filteredCardsWaliKelas.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-400">
                  Tidak ada kelas yang sesuai dengan filter pencarian.
                </p>
              </div>
            )}

            {!loadingWaliKelas &&
              filteredCardsWaliKelas.length > 0 &&
              viewMode === "list" && (
                <div className="space-y-3">
                  {filteredCardsWaliKelas.map((wali, idx) => (
                    <GuruListRow
                      key={wali.idWali}
                      no={idx + 1}
                      initials={String(wali.namaGuru || "?")
                        .substring(0, 2)
                        .toUpperCase()}
                      title={wali.namaGuru}
                      subtitle={`🏫 ${wali.namaKelas}${wali.keterangan ? ` • ${wali.keterangan}` : ""}`}
                      badge={{
                        text: `${wali.presensiHariIni?.persenHadir ?? 0}% Hadir`,
                        tone:
                          (wali.presensiHariIni?.persenHadir ?? 0) >= 75
                            ? "ok"
                            : "warn",
                      }}
                      metas={[
                        { label: "Siswa", value: `${wali.jumlahSiswa} Siswa` },
                        {
                          label:
                            wali.presensiHariIni?.isToday === false &&
                            wali.presensiHariIni?.tanggal
                              ? `Hadir (${formatTanggalKolom(wali.presensiHariIni.tanggal)})`
                              : "Hadir Hari Ini",
                          value: `${wali.presensiHariIni?.hadir || 0} siswa`,
                          tone: "text-emerald-300",
                        },
                        {
                          label: "S / I / A",
                          value: `${wali.presensiHariIni?.sakit || 0} / ${wali.presensiHariIni?.izin || 0} / ${wali.presensiHariIni?.alfa || 0}`,
                        },
                        {
                          label: "Bimbingan",
                          value: `${wali.jumlahJurnal || 0} Pertemuan`,
                          tone: "text-amber-300",
                        },
                      ]}
                      actions={[
                        {
                          icon: "📅",
                          label: "Rekap Presensi",
                          tone: "amber",
                          onClick: () => setSelectedPresensiKelasModal(wali),
                        },
                        {
                          icon: "✉️",
                          label: "Pesan",
                          tone: "sky",
                          onClick: () => bukaPesan(wali),
                        },
                      ]}
                      onClick={() => setSelectedWaliKelas(wali)}
                    />
                  ))}
                </div>
              )}

            {!loadingWaliKelas &&
              filteredCardsWaliKelas.length > 0 &&
              viewMode === "card" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredCardsWaliKelas.map((wali) => (
                    <div
                      key={wali.idWali}
                      className="group relative overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 rounded-3xl border border-blue-700/50 shadow-lg hover:shadow-amber-500/20 hover:border-amber-400/60 transition-all duration-300 flex flex-col justify-between"
                    >
                      {/* Top Gradient Accent Bar (Diganti jadi kuning emas) */}
                      <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 absolute top-0 left-0 z-20" />

                      {/* Efek Sedikit Gradien Kuning di Sudut Kanan Atas */}
                      <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-600/5 blur-2xl pointer-events-none group-hover:bg-amber-400/30 transition-all duration-500"></div>

                      <div className="p-5 relative z-10 mt-1">
                        {/* Class Badge & Total Siswa */}
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-800/60 border border-blue-600/50 text-amber-300 text-xs font-black shadow-2xs">
                            <span>🏫</span>
                            <span>{wali.namaKelas}</span>
                          </span>
                          <span className="px-2.5 py-1 rounded-xl bg-white/10 text-white text-xs font-black border border-white/20">
                            {wali.jumlahSiswa} Siswa
                          </span>
                        </div>

                        {/* Wali Info */}
                        <div className="mt-3 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center font-black text-sm shrink-0 shadow-md">
                            👨‍🏫
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors truncate">
                              {wali.namaGuru}
                            </h4>
                            <p className="text-[11px] font-medium text-blue-300 truncate">
                              {wali.keterangan || "Wali Kelas Reguler"}
                            </p>
                          </div>
                        </div>

                        {/* WIDGET PRESENSI HARI INI / SESI AKTIF */}
                        <div className="mt-4 p-3.5 rounded-2xl bg-blue-950/60 border border-blue-800/70">
                          <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-black text-amber-200">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                              <span>
                                {wali.presensiHariIni?.isToday === false &&
                                wali.presensiHariIni?.tanggal
                                  ? `PRESENSI (${formatTanggalIndo(wali.presensiHariIni.tanggal)})`
                                  : "PRESENSI HARI INI"}
                              </span>
                            </span>
                            <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-emerald-500/30 border border-emerald-400/30 text-emerald-300 shadow-2xs">
                              {wali.presensiHariIni?.persenHadir ?? 0}% Hadir
                            </span>
                          </div>

                          {/* Progress Bar Kehadiran */}
                          <div className="w-full bg-blue-900/50 h-2 rounded-full overflow-hidden mt-2 border border-blue-800/50">
                            <div
                              className="bg-gradient-to-r from-amber-400 to-yellow-300 h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(100, Math.max(0, wali.presensiHariIni?.persenHadir ?? 0))}%`,
                              }}
                            />
                          </div>

                          {/* 4 Status Hari Ini */}
                          <div className="grid grid-cols-4 gap-1.5 mt-2.5 text-center">
                            <div className="bg-blue-900/40 p-1.5 rounded-xl border border-blue-800/50 shadow-2xs">
                              <p className="text-[9px] font-bold text-blue-300">
                                HADIR
                              </p>
                              <p className="text-xs font-black text-emerald-400">
                                {wali.presensiHariIni?.hadir || 0}
                              </p>
                            </div>
                            <div className="bg-blue-900/40 p-1.5 rounded-xl border border-blue-800/50 shadow-2xs">
                              <p className="text-[9px] font-bold text-blue-300">
                                SAKIT
                              </p>
                              <p className="text-xs font-black text-sky-400">
                                {wali.presensiHariIni?.sakit || 0}
                              </p>
                            </div>
                            <div className="bg-blue-900/40 p-1.5 rounded-xl border border-blue-800/50 shadow-2xs">
                              <p className="text-[9px] font-bold text-blue-300">
                                IZIN
                              </p>
                              <p className="text-xs font-black text-amber-400">
                                {wali.presensiHariIni?.izin || 0}
                              </p>
                            </div>
                            <div className="bg-blue-900/40 p-1.5 rounded-xl border border-blue-800/50 shadow-2xs">
                              <p className="text-[9px] font-bold text-blue-300">
                                ALFA
                              </p>
                              <p className="text-xs font-black text-rose-400">
                                {wali.presensiHariIni?.alfa || 0}
                              </p>
                            </div>
                          </div>

                          {/* Siswa Hadir Hari Ini Dropdown / List */}
                          <div className="mt-3 pt-2.5 border-t border-blue-800/60">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedHadirWaliId(
                                  expandedHadirWaliId === wali.idWali
                                    ? null
                                    : wali.idWali,
                                )
                              }
                              className="w-full flex items-center justify-between text-[11px] font-bold text-amber-300 hover:text-amber-200 transition-colors cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <span>👥</span>
                                <span>
                                  Siswa Hadir Hari Ini (
                                  {wali.presensiHariIni?.siswaHadirList
                                    ?.length || 0}
                                  )
                                </span>
                              </span>
                              <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-md border border-white/20 shadow-2xs text-white">
                                {expandedHadirWaliId === wali.idWali
                                  ? "Tutup ▲"
                                  : "Lihat ▼"}
                              </span>
                            </button>

                            {expandedHadirWaliId === wali.idWali && (
                              <div className="mt-2 space-y-1 max-h-36 overflow-y-auto pr-1">
                                {!wali.presensiHariIni?.siswaHadirList ||
                                wali.presensiHariIni.siswaHadirList.length ===
                                  0 ? (
                                  <p className="text-[10px] text-blue-300 italic text-center py-2 bg-blue-900/30 rounded-lg border border-blue-800/50">
                                    Belum ada siswa yang presensi hadir hari
                                    ini.
                                  </p>
                                ) : (
                                  wali.presensiHariIni.siswaHadirList.map(
                                    (s, sIdx) => (
                                      <div
                                        key={sIdx}
                                        className="flex items-center justify-between text-[10px] bg-blue-900/50 p-1.5 rounded-lg border border-blue-800/50 shadow-2xs"
                                      >
                                        <span className="font-bold text-white truncate max-w-[150px] sm:max-w-[180px]">
                                          {s.nama || s.namaSiswa}
                                        </span>
                                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black text-[9px] shrink-0 border border-emerald-500/30">
                                          Hadir
                                        </span>
                                      </div>
                                    ),
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Rekap Kumulatif & Bimbingan */}
                        <div className="mt-3 flex items-center justify-between text-[11px] text-blue-200 bg-white/5 px-3 py-2 rounded-xl border border-white/10">
                          <span className="font-semibold">
                            Log Presensi:{" "}
                            <strong className="text-white">
                              {wali.presensi?.totalEntries || 0}
                            </strong>
                          </span>
                          <span className="font-semibold">
                            Bimbingan:{" "}
                            <strong className="text-amber-300">
                              {wali.jumlahJurnal || 0} Pertemuan
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Tombol Aksi Bawah */}
                      <div className="p-4 bg-blue-950/80 border-t border-blue-800/50 flex items-center gap-2 relative z-10">
                        <button
                          type="button"
                          onClick={() => setSelectedPresensiKelasModal(wali)}
                          className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-900 text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        >
                          <span>📅</span>
                          <span>Rekap Presensi</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedWaliKelas(wali)}
                          className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        >
                          <span>🔍 Detail</span>
                        </button>
                        <PesanButton
                          onClick={() => bukaPesan(wali)}
                          className="!py-2 !rounded-xl border-white/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        )}
      </div>

      {/* ======================================================= */}
      {/* MODAL 1: DETAIL GURU PKL & SISWA */}
      {/* ======================================================= */}
      {selectedGuruPkl && (
        <ModalWrapper
          title={`Detail Guru Pembimbing PKL: ${selectedGuruPkl.namaGuru}`}
          onClose={() => setSelectedGuruPkl(null)}
        >
          <div className="space-y-6">
            {/* Header Profil Singkat */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">
                  ID Guru: {selectedGuruPkl.idGuru}
                </p>
                <h4 className="text-lg font-black text-slate-800">
                  {selectedGuruPkl.namaGuru}
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Membimbing {getSiswaPklList(selectedGuruPkl).length} siswa PKL
                  di {selectedGuruPkl.jumlahTempat} tempat PKL
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-blue-100 text-blue-800 text-xs font-black">
                  📝 {selectedGuruPkl.jumlahJurnal} Jurnal PKL
                </span>
                <button
                  type="button"
                  onClick={() => handleOpenMonitoring(selectedGuruPkl)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 shadow-md shadow-emerald-600/20"
                >
                  <span>📷</span>
                  <span>
                    {selectedGuruPkl.totalMonitoring || 0}x Monitoring (Lihat
                    Foto & Keterangan)
                  </span>
                </button>
              </div>
            </div>

            {/* TABEL / DAFTAR SISWA BIMBINGAN */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span>👥</span> Daftar Siswa Bimbingan (
                  {getSiswaPklList(selectedGuruPkl).length} Siswa PKL)
                </h5>
                <button
                  type="button"
                  onClick={() => handleOpenMonitoring(selectedGuruPkl)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  <span>📷</span>
                  <span>Buka Foto & Keterangan</span>
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">No</th>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5">Kelas</th>
                      <th className="p-2.5">Tempat PKL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedGuruPkl.daftarSiswa?.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 font-black text-slate-800">
                          {s.nama}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {s.kelas || "-"}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {s.tempat || s.tempatMagang ? (
                            <span className="font-semibold text-slate-800">
                              📍 {s.tempat || s.tempatMagang}
                            </span>
                          ) : (
                            <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-bold text-[10px]">
                              Belum Ditentukan
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {(!selectedGuruPkl.daftarSiswa ||
                      selectedGuruPkl.daftarSiswa.length === 0) && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-4 text-center text-slate-400 font-medium"
                        >
                          Belum ada siswa yang ditugaskan ke guru ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* RIWAYAT JURNAL PKL */}
            <div>
              <h5 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                <span>📝</span> Riwayat Jurnal PKL Terakhir (
                {selectedGuruPkl.riwayatJurnal?.length || 0})
              </h5>
              {(!selectedGuruPkl.riwayatJurnal ||
                selectedGuruPkl.riwayatJurnal.length === 0) && (
                <p className="text-xs text-slate-400 font-medium p-4 bg-slate-50 rounded-xl text-center">
                  Belum ada jurnal pembimbingan PKL yang diinput oleh guru ini.
                </p>
              )}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedGuruPkl.riwayatJurnal?.map((j, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 border-b border-slate-100 pb-1.5">
                      <span>
                        📅 {formatTanggalIndo(j.tanggal)} •{" "}
                        {j.mingguKe || "Pertemuan"}
                      </span>
                      <span className="text-indigo-600 font-black">
                        {j.namaSiswa ? `Siswa: ${j.namaSiswa}` : "Bimbingan"}
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-500 uppercase text-[10px]">
                        Materi Bimbingan:
                      </p>
                      <p className="text-slate-800 font-medium">
                        {j.materi || "-"}
                      </p>
                    </div>
                    {j.masalah && (
                      <div>
                        <p className="font-bold text-rose-500 uppercase text-[10px]">
                          Kendala / Permasalahan:
                        </p>
                        <p className="text-slate-700">{j.masalah}</p>
                      </div>
                    )}
                    {j.tindakLanjut && (
                      <div>
                        <p className="font-bold text-emerald-600 uppercase text-[10px]">
                          Tindak Lanjut Pembimbing:
                        </p>
                        <p className="text-slate-700">{j.tindakLanjut}</p>
                      </div>
                    )}
                    {j.fotoUrl && (
                      <div className="pt-1">
                        <button
                          onClick={() => setLightboxUrl(j.fotoUrl)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          📷 Lihat Foto Dokumentasi Jurnal
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ======================================================= */}
      {/* MODAL MONITORING GURU PEMBIMBING (FOTO & KETERANGAN) */}
      {/* ======================================================= */}
      {selectedMonitoringGuru && (
        <ModalWrapper
          title={`Laporan Monitoring PKL: ${selectedMonitoringGuru.namaGuru}`}
          onClose={() => setSelectedMonitoringGuru(null)}
        >
          <div className="space-y-6">
            {/* Header Guru */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">
                  ID Guru: {selectedMonitoringGuru.idGuru}
                </p>
                <h4 className="text-lg font-black text-slate-800">
                  {selectedMonitoringGuru.namaGuru}
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Membimbing {getSiswaPklList(selectedMonitoringGuru).length}{" "}
                  siswa PKL di {selectedMonitoringGuru.jumlahTempat} tempat PKL
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black shadow-xs flex items-center gap-1.5">
                  <span>📷</span>
                  <span>{monitoringList.length} Laporan Monitoring</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const idGuru = String(
                      selectedMonitoringGuru.idGuru ||
                        selectedMonitoringGuru.id ||
                        "",
                    ).trim();
                    delete monitoringCacheRef.current[idGuru];
                    handleOpenMonitoring(selectedMonitoringGuru);
                  }}
                  title="Segarkan data monitoring guru ini"
                  className="p-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors text-xs font-bold cursor-pointer"
                >
                  🔄
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loadingMonitoring && (
              <div className="text-center py-12 space-y-3">
                <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-bold text-slate-500">
                  Mengambil foto & keterangan monitoring guru dari
                  spreadsheet...
                </p>
              </div>
            )}

            {/* Error State */}
            {!loadingMonitoring && errorMonitoring && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center justify-between">
                <p className="text-xs font-bold">⚠️ {errorMonitoring}</p>
                <button
                  onClick={() => handleOpenMonitoring(selectedMonitoringGuru)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* Empty State */}
            {!loadingMonitoring &&
              !errorMonitoring &&
              monitoringList.length === 0 && (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <span className="text-4xl">📷</span>
                  <h5 className="text-sm font-black text-slate-700">
                    Belum Ada Data Monitoring
                  </h5>
                  <p className="text-xs text-slate-400 font-medium max-w-sm mx-auto">
                    Guru pembimbing ini belum mengunggah foto maupun keterangan
                    kunjungan monitoring ke tempat magang.
                  </p>
                </div>
              )}

            {/* Daftar Laporan Monitoring (Foto & Keterangan) */}
            {!loadingMonitoring &&
              !errorMonitoring &&
              monitoringList.length > 0 && (
                <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                  {monitoringList.map((m, idx) => {
                    const fotoUrl = m.FOTO || m.fotoUrl || m.foto || "";
                    const optimizedUrl = optimizeFotoUrl(fotoUrl, 700);
                    const tanggalStr =
                      m.TIMESTAMP ||
                      m.timestamp ||
                      m.TANGGAL ||
                      m.tanggal ||
                      "";
                    const tempatMagang =
                      m.TEMPAT_MAGANG || m.tempatMagang || m.tempat || "-";
                    const keteranganStr = m.KETERANGAN || m.keterangan || "";
                    const statusStr = m.STATUS || m.status || "BERSAMA SISWA";
                    const mapUrl =
                      m.MAP ||
                      m.mapUrl ||
                      (m.LATITUDE && m.LONGITUDE
                        ? `https://www.google.com/maps?q=${m.LATITUDE},${m.LONGITUDE}`
                        : null);

                    return (
                      <div
                        key={idx}
                        className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 sm:p-5 space-y-4 hover:border-emerald-300 transition-colors"
                      >
                        {/* Bar Info Kunjungan */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <span className="text-xs font-black text-slate-800 block">
                                📍 {tempatMagang}
                              </span>
                              <span className="text-[11px] font-medium text-slate-400">
                                📅 {formatTanggalIndo(tanggalStr)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wide">
                              {statusStr}
                            </span>
                            {mapUrl && (
                              <a
                                href={mapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
                              >
                                <span>🗺️</span> Peta GPS
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Konten Grid: Foto & Keterangan */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                          {/* Foto Monitoring */}
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                              <span>📷</span> Foto Monitoring Lapangan:
                            </p>
                            {fotoUrl ? (
                              <div
                                onClick={() => setLightboxUrl(fotoUrl)}
                                className="group/img relative w-full h-56 rounded-xl overflow-hidden bg-slate-900 border border-slate-200 shadow-inner cursor-pointer"
                              >
                                <img
                                  src={optimizedUrl}
                                  alt={`Monitoring ${tempatMagang}`}
                                  className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end justify-between p-3 text-white">
                                  <span className="text-xs font-bold">
                                    🔍 Klik Perbesar
                                  </span>
                                  <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded backdrop-blur-xs font-medium">
                                    Buka Lightbox
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full h-40 rounded-xl bg-slate-100 border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 text-xs">
                                <span className="text-2xl mb-1">📷</span>
                                <span>Tidak ada foto terlampir</span>
                              </div>
                            )}
                          </div>

                          {/* Keterangan Monitoring */}
                          <div className="space-y-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                              <span>📝</span> Keterangan / Laporan Pembimbing:
                            </p>
                            <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-4 min-h-[140px] flex flex-col justify-between">
                              <p className="text-xs sm:text-sm font-semibold text-slate-800 whitespace-pre-wrap leading-relaxed">
                                {keteranganStr ? (
                                  `"${keteranganStr}"`
                                ) : (
                                  <span className="italic text-slate-400">
                                    (Tidak ada keterangan tertulis pada saat
                                    monitoring)
                                  </span>
                                )}
                              </p>
                              <div className="pt-3 border-t border-amber-100 text-[10px] text-amber-800/80 font-bold flex items-center justify-between">
                                <span>SMKN 1 Teluk Kuantan</span>
                                <span>Laporan Resmi Monitoring</span>
                              </div>
                            </div>

                            {m.LATITUDE && m.LONGITUDE && (
                              <div className="text-[11px] font-medium text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex items-center justify-between">
                                <span className="font-bold text-slate-600">
                                  Koordinat GPS:
                                </span>
                                <span className="font-mono text-[10px] text-slate-700">
                                  {m.LATITUDE}, {m.LONGITUDE}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
          </div>
        </ModalWrapper>
      )}

      {/* ======================================================= */}
      {/* MODAL 2: DETAIL GURU WALI & PERTEMUAN */}
      {/* ======================================================= */}
      {selectedGuruWali && (
        <ModalWrapper
          title={`Detail Guru Wali: ${selectedGuruWali.namaGuru}`}
          onClose={() => setSelectedGuruWali(null)}
        >
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">
                  ID: {selectedGuruWali.idGuru}
                </p>
                <h4 className="text-lg font-black text-slate-800">
                  {selectedGuruWali.namaGuru}
                </h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Membina {selectedGuruWali.jumlahSiswa} anak wali
                </p>
              </div>

              <span className="px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-black">
                🤝 {selectedGuruWali.totalPertemuan}x Pertemuan Bimbingan
              </span>
            </div>

            {/* DAFTAR ANAK WALI */}
            <div>
              <h5 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                <span>🧒</span> Daftar Anak Wali (
                {selectedGuruWali.daftarSiswa?.length || 0})
              </h5>
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                    <tr>
                      <th className="p-2.5">No</th>
                      <th className="p-2.5">Nama Siswa</th>
                      <th className="p-2.5">Kelas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedGuruWali.daftarSiswa?.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-slate-400">
                          {idx + 1}
                        </td>
                        <td className="p-2.5 font-black text-slate-800">
                          {s.nama}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          {s.kelas || "-"}
                        </td>
                      </tr>
                    ))}
                    {(!selectedGuruWali.daftarSiswa ||
                      selectedGuruWali.daftarSiswa.length === 0) && (
                      <tr>
                        <td
                          colSpan={3}
                          className="p-4 text-center text-slate-400 font-medium"
                        >
                          Belum ada siswa terdaftar sebagai anak wali.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LOG JURNAL PERTEMUAN WALI */}
            <div>
              <h5 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                <span>📖</span> Riwayat Pertemuan Guru Wali (
                {selectedGuruWali.riwayatJurnal?.length || 0})
              </h5>
              {(!selectedGuruWali.riwayatJurnal ||
                selectedGuruWali.riwayatJurnal.length === 0) && (
                <p className="text-xs text-slate-400 font-medium p-4 bg-slate-50 rounded-xl text-center">
                  Belum ada jurnal pertemuan yang dicatat oleh guru wali ini.
                </p>
              )}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedGuruWali.riwayatJurnal?.map((j, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 border-b border-slate-100 pb-1.5">
                      <span>📅 {formatTanggalIndo(j.tanggal)}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-black border border-blue-200">
                        {j.formatPertemuan || "Individu"}
                      </span>
                    </div>
                    {j.namaSiswa && (
                      <p className="text-xs font-black text-slate-800">
                        Murid: {j.namaSiswa}
                      </p>
                    )}
                    <div>
                      <p className="font-bold text-slate-400 uppercase text-[10px]">
                        Topik Bahasan:
                      </p>
                      <p className="text-slate-800 font-medium">
                        {j.topik || "-"}
                      </p>
                    </div>
                    {j.tindakLanjut && (
                      <div>
                        <p className="font-bold text-emerald-600 uppercase text-[10px]">
                          Tindak Lanjut:
                        </p>
                        <p className="text-slate-700">{j.tindakLanjut}</p>
                      </div>
                    )}
                    {j.fotoUrl && (
                      <button
                        onClick={() => setLightboxUrl(j.fotoUrl)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline pt-1"
                      >
                        📷 Lihat Dokumentasi Pertemuan
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ======================================================= */}
      {/* MODAL 3: DETAIL GURU MAPEL (LENGKAP) */}
      {/* ======================================================= */}
      {selectedGuruMapel && (
        <ModalWrapper
          title={`Detail Guru Mapel: ${selectedGuruMapel.namaGuru}`}
          onClose={() => setSelectedGuruMapel(null)}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-5">
            {/* HEADER GURU */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-2xl border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase">ID: {selectedGuruMapel.idGuru}</p>
                <h4 className="text-lg font-black text-slate-800">{selectedGuruMapel.namaGuru}</h4>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Mengampu {selectedGuruMapel.jumlahMapel} mata pelajaran / rombel
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-black">
                  📖 {selectedGuruMapel.jumlahJurnal || 0} Jurnal
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-indigo-100 text-indigo-800 text-xs font-black">
                  📅 {selectedGuruMapel.totalPertemuan || 0} Pertemuan
                </span>
                <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-black">
                  📎 {selectedGuruMapel.totalTugas || 0} Tugas Dikumpulkan
                </span>
              </div>
            </div>

            {/* DAFTAR MAPEL DENGAN PRESENSI & TUGAS */}
            <div>
              <h5 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2">
                <span>📚</span> Mata Pelajaran & Rombel ({selectedGuruMapel.daftarMapel?.length || 0})
              </h5>
              <div className="space-y-4">
                 {(selectedGuruMapel.daftarMapel || []).map((m, idx) => {
                  const isOnline = m.isOnline ||
                    String(m.keterangan || "").toUpperCase().includes("ONLINE") ||
                    String(m.namaMapel || "").toUpperCase().includes("ONLINE");
                  const hasPresentasi = m.presensiPertemuan && m.presensiPertemuan.length > 0;
                  const hasTugas = m.tugasPertemuan && m.tugasPertemuan.length > 0;

                  async function bukaDetailMapel() {
                    setDetailMapelKepsek({ mapel: m, guru: selectedGuruMapel, data: null });
                    setLoadingDetailMapel(true);
                    try {
                      const res = await getDetailMapelKepsek(selectedGuruMapel.idGuru, m.idMapel);
                      setDetailMapelKepsek({ mapel: m, guru: selectedGuruMapel, data: res?.data || null });
                    } catch (e) {
                      setDetailMapelKepsek({ mapel: m, guru: selectedGuruMapel, data: null, error: String(e) });
                    } finally {
                      setLoadingDetailMapel(false);
                    }
                  }

                  return (
                    <div
                      key={m.idMapel || idx}
                      className={`rounded-2xl border overflow-hidden ${isOnline ? "border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50" : "border-indigo-200 bg-gradient-to-br from-indigo-50 to-slate-50"}`}
                    >
                      {/* Header Mapel — diklik buka sub-modal */}
                      <button
                        type="button"
                        onClick={bukaDetailMapel}
                        className={`w-full px-4 py-3 flex items-center justify-between gap-2 text-left transition-all hover:brightness-110 active:scale-[0.99] ${isOnline ? "bg-gradient-to-r from-teal-600 to-emerald-600" : "bg-gradient-to-r from-indigo-600 to-blue-600"}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-white text-sm">{isOnline ? "🌐" : "📚"}</span>
                          <h6 className="text-sm font-black text-white truncate">{m.namaMapel}</h6>
                          {isOnline && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-white/20 text-white text-[10px] font-bold">ONLINE</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {m.kelas && (
                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold">{m.kelas}</span>
                          )}
                          <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold">
                            👥 {m.siswaCount || 0} Siswa
                          </span>
                          {hasPresentasi && (
                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold">
                              📅 {m.presensiPertemuan.length} Sesi
                            </span>
                          )}
                          {m.totalTugasDikumpulkan > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-bold">
                              📎 {m.totalTugasDikumpulkan} Tugas
                            </span>
                          )}
                          <span className="ml-1 px-2 py-0.5 rounded-md bg-white/30 text-white text-[10px] font-black">
                            Lihat Detail →
                          </span>
                        </div>
                      </button>

                      {/* Presensi Per Pertemuan */}
                      {hasPresentasi && (
                        <div className="p-3">
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">📊 Presensi Per Pertemuan</p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className={`text-white ${isOnline ? "bg-teal-600" : "bg-indigo-600"}`}>
                                  <th className="px-2 py-1.5 text-left font-bold rounded-tl-lg">Pertemuan</th>
                                  <th className="px-2 py-1.5 text-left font-bold">Tanggal</th>
                                  <th className="px-2 py-1.5 text-center font-bold">Hadir</th>
                                  <th className="px-2 py-1.5 text-center font-bold">Tdk Hadir</th>
                                  <th className="px-2 py-1.5 text-center font-bold rounded-tr-lg">% Hadir</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.presensiPertemuan.map((pt, ptIdx) => {
                                  const pct = pt.persenHadir || 0;
                                  const barColor = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-500";
                                  return (
                                    <tr key={ptIdx} className={ptIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                      <td className="px-2 py-1.5 font-bold text-slate-700">
                                        Ke-{pt.pertemuanKe}
                                      </td>
                                      <td className="px-2 py-1.5 text-slate-500">
                                        {formatTanggalKolom(pt.tanggal) || "-"}
                                      </td>
                                      <td className="px-2 py-1.5 text-center font-bold text-emerald-700">
                                        {pt.totalHadir}
                                      </td>
                                      <td className="px-2 py-1.5 text-center font-bold text-rose-600">
                                        {pt.totalTidakHadir}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <div className="flex items-center gap-1.5">
                                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                                          </div>
                                          <span className={`text-[10px] font-bold ${pct >= 80 ? "text-emerald-700" : pct >= 60 ? "text-amber-700" : "text-rose-600"}`}>
                                            {pct}%
                                          </span>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr className={`font-black text-white text-[10px] ${isOnline ? "bg-teal-700" : "bg-indigo-700"}`}>
                                  <td colSpan={2} className="px-2 py-1.5 rounded-bl-lg">TOTAL ({m.presensiPertemuan.length} Sesi)</td>
                                  <td className="px-2 py-1.5 text-center">
                                    {m.presensiPertemuan.reduce((s, p) => s + (p.totalHadir || 0), 0)}
                                  </td>
                                  <td className="px-2 py-1.5 text-center">
                                    {m.presensiPertemuan.reduce((s, p) => s + (p.totalTidakHadir || 0), 0)}
                                  </td>
                                  <td className="px-2 py-1.5 text-center rounded-br-lg">
                                    {(() => {
                                      const totH = m.presensiPertemuan.reduce((s, p) => s + (p.totalHadir || 0), 0);
                                      const totA = m.presensiPertemuan.reduce((s, p) => s + (p.totalSiswa || 0), 0);
                                      return totA > 0 ? Math.round((totH / totA) * 100) + "%" : "-";
                                    })()}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Tugas Terkumpul Per Pertemuan */}
                      {hasTugas && (
                        <div className={`px-3 pb-3 ${hasPresentasi ? "border-t border-slate-200/60" : ""}`}>
                          {hasPresentasi && <div className="h-2" />}
                          <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">📎 Tugas Dikumpulkan per Pertemuan</p>
                          <div className="flex flex-wrap gap-1.5">
                            {m.tugasPertemuan.map((t, tIdx) => (
                              <span
                                key={tIdx}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border ${isOnline ? "bg-teal-100 text-teal-800 border-teal-200" : "bg-indigo-100 text-indigo-800 border-indigo-200"}`}
                              >
                                Sesi {t.pertemuanKe}: {t.jumlahDikumpulkan} file
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Jika belum ada presensi & tugas */}
                      {!hasPresentasi && !hasTugas && (
                        <div className="px-4 py-3 text-[11px] text-slate-400 font-medium italic">
                          Belum ada presensi atau tugas yang tercatat untuk mapel ini.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* LOG JURNAL MAPEL */}
            <div>
              <h5 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                <span>📖</span> Riwayat Jurnal Mengajar ({selectedGuruMapel.riwayatJurnal?.length || 0})
              </h5>
              {(!selectedGuruMapel.riwayatJurnal ||
                selectedGuruMapel.riwayatJurnal.length === 0) && (
                <p className="text-xs text-slate-400 font-medium p-4 bg-slate-50 rounded-xl text-center">
                  Belum ada jurnal mengajar yang diinput oleh guru ini.
                </p>
              )}
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {selectedGuruMapel.riwayatJurnal?.map((j, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 border-b border-slate-100 pb-1.5">
                      <span>📅 {formatTanggalIndo(j.tanggal)}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-400 uppercase text-[10px]">
                        Materi / Topik:
                      </p>
                      <p className="text-slate-800 font-medium">
                        {j.topik || "-"}
                      </p>
                    </div>
                    {j.keterangan && (
                      <p className="text-slate-600 text-[11px]">
                        {j.keterangan}
                      </p>
                    )}
                    {j.fotoUrl && (
                      <button
                        onClick={() => setLightboxUrl(j.fotoUrl)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-600 hover:underline pt-1"
                      >
                        📷 Lihat Dokumentasi Kelas
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ======================================================= */}
      {/* MODAL 3b: DETAIL SISWA PER MAPEL (Sub-Modal) */}
      {/* ======================================================= */}
      {detailMapelKepsek && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-5 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            {(() => {
              const m = detailMapelKepsek.mapel;
              const g = detailMapelKepsek.guru;
              const isOnline = m.isOnline || String(m.keterangan || "").toUpperCase().includes("ONLINE");
              return (
                <>
                  <div className={`px-5 py-4 flex items-center justify-between gap-3 ${isOnline ? "bg-gradient-to-r from-teal-600 to-emerald-600" : "bg-gradient-to-r from-indigo-600 to-blue-700"}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xl">{isOnline ? "🌐" : "📚"}</span>
                        <h3 className="text-base font-black text-white truncate">{m.namaMapel}</h3>
                        {isOnline && <span className="px-2 py-0.5 rounded bg-white/25 text-white text-[10px] font-black">ONLINE</span>}
                        {m.kelas && <span className="px-2 py-0.5 rounded bg-white/20 text-white text-[10px] font-bold">{m.kelas}</span>}
                      </div>
                      <p className="text-xs text-white/80 font-medium mt-0.5">
                        Guru: {g.namaGuru} · {detailMapelKepsek.data?.jumlahSiswa ?? m.siswaCount ?? 0} Siswa · {detailMapelKepsek.data?.jumlahSesi ?? m.presensiPertemuan?.length ?? 0} Sesi
                      </p>
                    </div>
                    <button
                      onClick={() => setDetailMapelKepsek(null)}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all font-black text-base"
                    >✕</button>
                  </div>

                  {/* Body */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {loadingDetailMapel && (
                      <div className="py-16 flex flex-col items-center justify-center gap-3">
                        <div className={`w-10 h-10 rounded-full border-4 border-t-transparent animate-spin ${isOnline ? "border-teal-500" : "border-indigo-500"}`} />
                        <p className="text-sm font-bold text-slate-500">Memuat data kehadiran & nilai siswa...</p>
                      </div>
                    )}

                    {!loadingDetailMapel && detailMapelKepsek.error && (
                      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold text-center">
                        ⚠️ Gagal memuat data: {detailMapelKepsek.error}
                      </div>
                    )}

                    {!loadingDetailMapel && detailMapelKepsek.data && (() => {
                      const d = detailMapelKepsek.data;
                      const pertemuanList = d.pertemuanList || [];
                      const siswaRows = d.siswaRows || [];

                      if (siswaRows.length === 0) {
                        return (
                          <div className="py-12 text-center">
                            <span className="text-5xl block mb-2">👥</span>
                            <p className="text-sm font-bold text-slate-500">Belum ada siswa terdaftar di mapel ini.</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {/* Statistik Ringkas */}
                          <div className={`p-4 rounded-2xl border ${isOnline ? "bg-teal-50 border-teal-200" : "bg-indigo-50 border-indigo-200"}`}>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {[
                                { label: "Total Siswa", val: siswaRows.length, icon: "👥" },
                                { label: "Sesi Direkam", val: pertemuanList.length, icon: "📅" },
                                {
                                  label: "Rata-rata Kehadiran",
                                  val: siswaRows.length
                                    ? Math.round(siswaRows.reduce((s, x) => s + (x.persenHadir || 0), 0) / siswaRows.length) + "%"
                                    : "-",
                                  icon: "📊"
                                },
                                {
                                  label: "Rata-rata Nilai",
                                  val: (() => {
                                    const withNilai = siswaRows.filter(x => x.avgNilai !== null);
                                    return withNilai.length
                                      ? Math.round(withNilai.reduce((s, x) => s + x.avgNilai, 0) / withNilai.length)
                                      : "-";
                                  })(),
                                  icon: "⭐"
                                },
                              ].map((st) => (
                                <div key={st.label} className="bg-white rounded-xl p-3 text-center shadow-xs border border-white">
                                  <div className="text-lg">{st.icon}</div>
                                  <div className={`text-xl font-black ${isOnline ? "text-teal-700" : "text-indigo-700"}`}>{st.val}</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">{st.label}</div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Tabel Presensi & Nilai Per Siswa */}
                          <div>
                            <h4 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                              <span>📋</span> Kehadiran & Nilai Per Siswa
                            </h4>
                            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
                              <table className="w-full text-[11px]">
                                <thead>
                                  <tr className={`text-white ${isOnline ? "bg-teal-700" : "bg-indigo-700"}`}>
                                    <th className="px-3 py-2 text-left font-bold sticky left-0 bg-inherit min-w-[140px] rounded-tl-2xl">Nama Siswa</th>
                                    <th className="px-2 py-2 text-center font-bold min-w-[60px]">Hadir</th>
                                    <th className="px-2 py-2 text-center font-bold min-w-[50px]">%</th>
                                    <th className="px-2 py-2 text-center font-bold min-w-[50px]">Nilai</th>
                                    {pertemuanList.map(pt => (
                                      <th key={pt.pertemuanKe} className="px-2 py-2 text-center font-bold min-w-[52px]">
                                        <div className="font-black">P{pt.pertemuanKe}</div>
                                        {pt.tanggal && <div className="text-[9px] font-medium opacity-80">{formatTanggalKolom(pt.tanggal)}</div>}
                                      </th>
                                    ))}
                                    {isOnline && pertemuanList.some(pt => pt.tugas) && (
                                      <th className="px-2 py-2 text-center font-bold min-w-[60px] rounded-tr-2xl">Tugas</th>
                                    )}
                                  </tr>
                                </thead>
                                 <tbody>
                                   {siswaRows.map((s, sIdx) => {
                                     const pctColor = s.persenHadir >= 80 ? "text-emerald-700 font-black" : s.persenHadir >= 60 ? "text-amber-700 font-bold" : "text-rose-600 font-bold";
                                     return (
                                       <tr key={s.idSiswa} className={sIdx % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                                         <td className={`px-3 py-2 font-bold text-slate-800 sticky left-0 ${sIdx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}>
                                           <div className="truncate max-w-[130px]">{s.nama}</div>
                                           {s.kelas && <div className="text-[9px] text-slate-400 font-medium">{s.kelas}</div>}
                                         </td>
                                         <td className="px-2 py-2 text-center font-bold text-slate-700">{s.totalHadir}/{s.totalSesi}</td>
                                         <td className={`px-2 py-2 text-center text-[11px] ${pctColor}`}>{s.persenHadir}%</td>
                                         <td className="px-2 py-2 text-center font-black text-slate-700">{s.avgNilai !== null ? s.avgNilai : "-"}</td>
                                         {s.pertemuan.map(pt => {
                                           const st = String(pt.status || "").toUpperCase();
                                           const isH = st === "H" || st === "HADIR";
                                           const isI = st === "I" || st === "IZIN";
                                           const isS = st === "S" || st === "SAKIT";
                                           const isA = st === "A" || st === "ALPHA" || (st && !isH && !isI && !isS);
                                           const bgCell = isH ? "bg-emerald-100 text-emerald-800" : isI ? "bg-amber-100 text-amber-800" : isS ? "bg-blue-100 text-blue-800" : isA && st ? "bg-rose-100 text-rose-700" : "text-slate-300";
                                           const label = isH ? "H" : isI ? "I" : isS ? "S" : isA && st ? "A" : "·";
                                           const jwbArr = Array.isArray(pt.jawaban) ? pt.jawaban : (pt.jawaban ? [pt.jawaban] : null);
                                           return (
                                             <td key={pt.pertemuanKe} className="px-1.5 py-2 text-center">
                                               <div className="inline-flex flex-col items-center gap-0.5">
                                                 <span className={`px-1.5 py-0.5 rounded font-black text-[11px] min-w-[20px] text-center ${bgCell}`}>{label}</span>
                                                 {pt.nilai !== "" && pt.nilai !== null && pt.nilai !== undefined && (
                                                   <span className="text-[9px] font-bold text-slate-500">{pt.nilai}</span>
                                                 )}
                                                 {jwbArr && jwbArr.length > 0 && jwbArr[0].fileUrl && (
                                                   <a
                                                     href={jwbArr[0].fileUrl}
                                                     target="_blank"
                                                     rel="noopener noreferrer"
                                                     onClick={(e) => e.stopPropagation()}
                                                     title={jwbArr[0].namaFile || "Lihat file tugas"}
                                                     className="text-[9px] font-black text-teal-600 hover:text-teal-800 bg-teal-50 border border-teal-200 rounded px-1 py-0.5 leading-none hover:underline"
                                                   >
                                                     📎
                                                   </a>
                                                 )}
                                                 {jwbArr && jwbArr.length > 1 && (
                                                   <span className="text-[8px] text-teal-600 font-bold">+{jwbArr.length - 1}</span>
                                                 )}
                                               </div>
                                             </td>
                                           );
                                         })}
                                         {isOnline && pertemuanList.some(pt => pt.tugas) && (
                                           <td className="px-2 py-2 text-center">
                                             {(() => {
                                               const jwbCount = s.pertemuan.filter(pt => {
                                                 const arr = Array.isArray(pt.jawaban) ? pt.jawaban : (pt.jawaban ? [pt.jawaban] : null);
                                                 return arr && arr.length > 0;
                                               }).length;
                                               const tugasTotal = pertemuanList.filter(pt => pt.tugas).length;
                                               return (
                                                 <span className={`text-[10px] font-bold ${jwbCount > 0 ? "text-teal-700" : "text-slate-300"}`}>
                                                   {jwbCount}/{tugasTotal}
                                                 </span>
                                               );
                                             })()}
                                           </td>
                                         )}
                                       </tr>
                                     );
                                   })}
                                 </tbody>
                               </table>
                             </div>
                             <p className="text-[10px] text-slate-400 mt-2 font-medium">
                               H = Hadir · S = Sakit · I = Izin · A = Alpha · Angka di bawah = Nilai · 📎 = ada file tugas
                             </p>
                           </div>

                           {/* Tugas Per Pertemuan (online) — dengan daftar siswa dan link file */}
                           {isOnline && pertemuanList.some(pt => pt.tugas) && (
                             <div>
                               <h4 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                                 <span>📎</span> Tugas Per Pertemuan
                               </h4>
                               <div className="space-y-3">
                                 {pertemuanList.filter(pt => pt.tugas).map(pt => {
                                   const jawabanSiswa = siswaRows.map(s => {
                                     const ptData = s.pertemuan.find(x => x.pertemuanKe === pt.pertemuanKe);
                                     const arr = ptData ? (Array.isArray(ptData.jawaban) ? ptData.jawaban : (ptData.jawaban ? [ptData.jawaban] : null)) : null;
                                     return { nama: s.nama, kelas: s.kelas, arr };
                                   }).filter(x => x.arr && x.arr.length > 0);
                                   const belumKumpul = siswaRows.length - jawabanSiswa.length;
                                   return (
                                     <div key={pt.pertemuanKe} className="rounded-xl border border-teal-200 bg-teal-50 overflow-hidden">
                                       <div className="px-3 py-2 bg-teal-600 flex items-center justify-between">
                                         <span className="text-xs font-black text-white">Sesi {pt.pertemuanKe}: {pt.tugas.judulTugas}</span>
                                         <div className="flex items-center gap-1.5">
                                           <span className="text-[10px] font-bold text-white/90 bg-teal-700 px-2 py-0.5 rounded-full">{jawabanSiswa.length}/{siswaRows.length} dikumpulkan</span>
                                           {belumKumpul > 0 && <span className="text-[10px] font-bold text-rose-200 bg-rose-600/40 px-2 py-0.5 rounded-full">{belumKumpul} belum</span>}
                                         </div>
                                       </div>
                                       {pt.tugas.deskripsi && <p className="px-3 py-1.5 text-[10px] text-teal-800 border-b border-teal-100">{pt.tugas.deskripsi}</p>}
                                       {jawabanSiswa.length > 0 ? (
                                         <div className="px-3 py-2 space-y-1.5">
                                           {jawabanSiswa.map((js, jsIdx) => (
                                             <div key={jsIdx} className="flex items-start gap-2 flex-wrap">
                                               <span className="text-[10px] font-bold text-teal-800 min-w-[100px] flex-shrink-0">
                                                 {js.nama}{js.kelas && <span className="text-teal-500 font-normal ml-1">({js.kelas})</span>}
                                               </span>
                                               <div className="flex flex-wrap gap-1">
                                                 {js.arr.map((jwb, jIdx) => (
                                                   <a key={jIdx} href={jwb.fileUrl || "#"} target="_blank" rel="noopener noreferrer"
                                                     onClick={(e) => !jwb.fileUrl && e.preventDefault()}
                                                     className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${jwb.fileUrl ? "bg-white text-teal-700 border-teal-300 hover:bg-teal-50 hover:border-teal-500 cursor-pointer" : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"}`}
                                                     title={jwb.fileUrl ? ("Buka: " + (jwb.namaFile || "file tugas")) : "File tidak tersedia"}
                                                   >
                                                     <span>{jwb.fileUrl ? "📄" : "❌"}</span>
                                                     <span className="truncate max-w-[120px]">{jwb.namaFile || ("File " + (jIdx + 1))}</span>
                                                   </a>
                                                 ))}
                                               </div>
                                             </div>
                                           ))}
                                         </div>
                                       ) : (
                                         <p className="px-3 py-2 text-[10px] text-slate-400 font-medium italic">Belum ada siswa yang mengumpulkan tugas ini.</p>
                                       )}
                                     </div>
                                   );
                                 })}
                               </div>
                             </div>
                           )}
                        </>
                      );
                    })()}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ======================================================= */}
      {/* MODAL 4: DETAIL WALI KELAS */}
      {/* ======================================================= */}
      {selectedWaliKelas && (
        <ModalWrapper
          title={`Detail Kelas Wali: ${selectedWaliKelas.namaKelas}`}
          onClose={() => setSelectedWaliKelas(null)}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="px-2.5 py-0.5 rounded-md bg-teal-100 text-teal-800 text-xs font-black uppercase">
                  Kelas: {selectedWaliKelas.namaKelas}
                </span>
                <h4 className="mt-1 text-lg font-black text-slate-800">
                  Wali Kelas: {selectedWaliKelas.namaGuru}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedWaliKelas.keterangan || "Kelas Aktif"}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs font-bold text-slate-400">Total Murid</p>
                <p className="text-2xl font-black text-slate-800">
                  {selectedWaliKelas.jumlahSiswa} Siswa
                </p>
              </div>
            </div>

            {/* STATUS PRESENSI HARI INI & AKUMULASI */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-black text-slate-800 flex items-center gap-2">
                  <span>📊</span> Rekap Kehadiran Siswa
                </h5>
                <span className="text-xs font-bold text-teal-700">
                  Hari Ini:{" "}
                  {selectedWaliKelas.presensiHariIni?.persenHadir ?? 0}% Hadir
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center bg-slate-50 p-3 sm:p-4 rounded-xl border border-slate-200">
                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400">HADIR</p>
                  <p className="text-xl font-black text-emerald-600">
                    {selectedWaliKelas.presensiHariIni?.hadir ||
                      selectedWaliKelas.presensi?.hadir ||
                      0}
                  </p>
                  <p className="text-[9px] text-slate-400 font-semibold">
                    Hari ini ({selectedWaliKelas.presensiHariIni?.hadir || 0})
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400">SAKIT</p>
                  <p className="text-xl font-black text-blue-600">
                    {selectedWaliKelas.presensiHariIni?.sakit ||
                      selectedWaliKelas.presensi?.sakit ||
                      0}
                  </p>
                  <p className="text-[9px] text-slate-400 font-semibold">
                    Hari ini ({selectedWaliKelas.presensiHariIni?.sakit || 0})
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400">IZIN</p>
                  <p className="text-xl font-black text-amber-600">
                    {selectedWaliKelas.presensiHariIni?.izin ||
                      selectedWaliKelas.presensi?.izin ||
                      0}
                  </p>
                  <p className="text-[9px] text-slate-400 font-semibold">
                    Hari ini ({selectedWaliKelas.presensiHariIni?.izin || 0})
                  </p>
                </div>
                <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-xs">
                  <p className="text-[10px] font-bold text-slate-400">ALFA</p>
                  <p className="text-xl font-black text-rose-600">
                    {selectedWaliKelas.presensiHariIni?.alfa ||
                      selectedWaliKelas.presensi?.alfa ||
                      0}
                  </p>
                  <p className="text-[9px] text-slate-400 font-semibold">
                    Hari ini ({selectedWaliKelas.presensiHariIni?.alfa || 0})
                  </p>
                </div>
              </div>
            </div>

            {/* DAFTAR SISWA KELAS INI & STATUS HARI INI */}
            {selectedWaliKelas.daftarSiswa &&
              selectedWaliKelas.daftarSiswa.length > 0 && (
                <div>
                  <h5 className="text-sm font-black text-slate-800 mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>👥</span> Rombel Siswa (
                      {selectedWaliKelas.daftarSiswa.length} Orang)
                    </span>
                    <span className="text-xs text-slate-400 font-medium">
                      Status Kehadiran Hari Ini
                    </span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {selectedWaliKelas.daftarSiswa.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-800 truncate">
                            {s.nama || s.namaSiswa}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            NIS/ID: {s.idSiswa}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-black shrink-0 ${
                            s.statusHariIni === "Hadir"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : s.statusHariIni === "Sakit"
                                ? "bg-blue-100 text-blue-800 border border-blue-200"
                                : s.statusHariIni === "Izin"
                                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                                  : s.statusHariIni === "Alfa"
                                    ? "bg-rose-100 text-rose-800 border border-rose-200"
                                    : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {s.statusHariIni || "Belum Absen"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* LOG JURNAL BIMBINGAN WALI KELAS */}
            <div>
              <h5 className="text-sm font-black text-slate-800 mb-2 flex items-center gap-2">
                <span>📋</span> Riwayat Jurnal Bimbingan Wali Kelas (
                {selectedWaliKelas.riwayatJurnal?.length || 0})
              </h5>
              {(!selectedWaliKelas.riwayatJurnal ||
                selectedWaliKelas.riwayatJurnal.length === 0) && (
                <p className="text-xs text-slate-400 font-medium p-4 bg-slate-50 rounded-xl text-center">
                  Belum ada catatan bimbingan kelas yang diinput oleh wali kelas
                  ini.
                </p>
              )}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {selectedWaliKelas.riwayatJurnal?.map((j, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1.5 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 border-b border-slate-100 pb-1.5">
                      <span>📅 {formatTanggalIndo(j.tanggal)}</span>
                      {j.namaSiswa && (
                        <span className="font-bold text-teal-700">
                          Siswa: {j.namaSiswa}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-400 uppercase text-[10px]">
                        Topik Bimbingan:
                      </p>
                      <p className="text-slate-800 font-medium">
                        {j.topik || "-"}
                      </p>
                    </div>
                    {j.tindakLanjut && (
                      <div>
                        <p className="font-bold text-emerald-600 uppercase text-[10px]">
                          Tindak Lanjut:
                        </p>
                        <p className="text-slate-700">{j.tindakLanjut}</p>
                      </div>
                    )}
                    {j.fotoUrl && (
                      <button
                        onClick={() => setLightboxUrl(j.fotoUrl)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-700 hover:underline pt-1 cursor-pointer"
                      >
                        📷 Lihat Dokumentasi Bimbingan
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ModalWrapper>
      )}

      {/* ======================================================= */}
      {/* MODAL 5: REKAP PRESENSI KELAS SPESIFIK */}
      {/* ======================================================= */}
      {selectedPresensiKelasModal && (
        <ModalWrapper
          title={`Rekap Presensi Kelas: ${selectedPresensiKelasModal.namaKelas}`}
          onClose={() => {
            setSelectedPresensiKelasModal(null);
            setModalGridData(null);
          }}
          maxWidth="max-w-6xl"
        >
          <div className="space-y-5">
            {/* Header info kelas + Quick Action Cetak PDF */}
            <div className="p-4 bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 rounded-2xl border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-teal-200 text-teal-900 text-xs font-black">
                    🏫 {selectedPresensiKelasModal.namaKelas}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-white border border-teal-200 text-teal-800 text-[11px] font-bold">
                    👥 {matrixData.totalSiswa} Siswa
                  </span>
                </div>
                <h4 className="mt-1 text-base font-black text-slate-800">
                  Wali Kelas: {selectedPresensiKelasModal.namaGuru}
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedPresensiKelasModal.keterangan ||
                    "Rombongan Belajar Aktif"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCetakLaporanPdf}
                  disabled={cetakLaporanLoading}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-900 hover:from-teal-600 hover:to-emerald-800 text-white text-xs font-black shadow-md hover:shadow-teal-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Unduh dokumen PDF laporan resmi presensi & jurnal wali kelas"
                >
                  {cetakLaporanLoading ? (
                    <>
                      <span className="animate-spin text-sm">⏳</span>
                      <span>Menyiapkan PDF...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-sm">🖨️</span>
                      <span>Cetak PDF Laporan Resmi</span>
                    </>
                  )}
                </button>

                <div className="text-center bg-white px-3 py-2 rounded-xl border border-emerald-100 shadow-2xs">
                  <p className="text-[10px] font-bold text-slate-400">
                    Hadir Hari Ini
                  </p>
                  <p className="text-lg font-black text-emerald-600">
                    {selectedPresensiKelasModal.presensiHariIni?.hadir || 0}
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-Tab Selector */}
            <div className="flex border-b border-slate-200 text-xs font-black">
              <button
                type="button"
                onClick={() => setPresensiKelasSubTab("hari_ini")}
                className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  presensiKelasSubTab === "hari_ini"
                    ? "border-teal-600 text-teal-800"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <span>🟢</span>
                <span>
                  Kehadiran Siswa Hari Ini (
                  {selectedPresensiKelasModal.presensiHariIni?.hadir || 0}/
                  {matrixData.totalSiswa})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPresensiKelasSubTab("riwayat")}
                className={`pb-2.5 px-4 flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  presensiKelasSubTab === "riwayat"
                    ? "border-teal-600 text-teal-800"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                <span>📋</span>
                <span>
                  Rekapitulasi Presensi Matrix — Format Laporan (
                  {matrixData.totalHari} Pertemuan)
                </span>
              </button>
            </div>

            {/* KONTEN SUB-TAB 1: HARI INI */}
            {presensiKelasSubTab === "hari_ini" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                  <span>Daftar Seluruh Siswa Rombel:</span>
                  <span className="text-[11px] text-slate-400">
                    Tanggal:{" "}
                    {selectedPresensiKelasModal.presensiHariIni?.tanggal ||
                      "Hari Ini"}
                  </span>
                </div>

                {!selectedPresensiKelasModal.daftarSiswa ||
                selectedPresensiKelasModal.daftarSiswa.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-xl">
                    Belum ada data siswa di kelas ini.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {selectedPresensiKelasModal.daftarSiswa.map((s, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs shadow-2xs hover:border-teal-300 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-slate-800">
                              {s.nama || s.namaSiswa}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              NIS/ID: {s.idSiswa}{" "}
                              {s.keteranganHariIni
                                ? `• ${s.keteranganHariIni}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-lg text-xs font-black ${
                            s.statusHariIni === "Hadir"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : s.statusHariIni === "Sakit"
                                ? "bg-blue-100 text-blue-800 border border-blue-300"
                                : s.statusHariIni === "Izin"
                                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                                  : s.statusHariIni === "Alfa"
                                    ? "bg-rose-100 text-rose-800 border border-rose-300"
                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                          }`}
                        >
                          {s.statusHariIni || "Belum Presensi"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* KONTEN SUB-TAB 2: REKAPITULASI PRESENSI MATRIX (SEPERTI GAMBAR CETAK LAPORAN) */}
            {presensiKelasSubTab === "riwayat" && (
              <div className="space-y-4">
                {/* 3 Summary Cards persis seperti Cover Laporan Cetak */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-blue-100 tracking-wider">
                      Total Siswa
                    </p>
                    <p className="text-2xl font-black mt-0.5">
                      {matrixData.totalSiswa} Siswa
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 text-white shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-indigo-100 tracking-wider">
                      Total Hari / Pertemuan
                    </p>
                    <p className="text-2xl font-black mt-0.5">
                      {matrixData.totalHari} Hari
                    </p>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-sm">
                    <p className="text-[10px] uppercase font-bold text-emerald-100 tracking-wider">
                      Rata-rata Kehadiran
                    </p>
                    <p className="text-2xl font-black mt-0.5">
                      {matrixData.rataRataKehadiran}% Hadir
                    </p>
                  </div>
                </div>

                {/* Toolbar Pencarian Siswa & Indikator Status */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">
                      Tabel Rekapitulasi Presensi Harian Siswa:
                    </span>
                    {loadingModalGrid && (
                      <span className="text-[11px] text-teal-600 font-bold animate-pulse flex items-center gap-1">
                        <span>🔄</span> Memperbarui data live...
                      </span>
                    )}
                  </div>

                  <div className="relative w-full sm:w-64">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                      🔍
                    </span>
                    <input
                      type="text"
                      value={searchMatrixStudent}
                      onChange={(e) => setSearchMatrixStudent(e.target.value)}
                      placeholder="Cari nama siswa..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 outline-none font-medium transition-all"
                    />
                  </div>
                </div>

                {/* TABEL MATRIX PERSIS SEPERTI GAMBAR CETAK LAPORAN */}
                {matrixData.siswaList.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-400">
                      Belum ada data siswa atau log presensi untuk kelas ini.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto max-h-[460px] overflow-y-auto custom-scrollbar">
                      <table className="w-full border-separate border-spacing-0 text-[10px] whitespace-nowrap">
                        <thead className="bg-slate-100 text-slate-800 sticky top-0 z-30 shadow-xs">
                          <tr>
                            <th className="py-2.5 px-2 font-black border-b-2 border-slate-300 text-center sticky left-0 bg-slate-100 z-40 w-10 min-w-10">
                              No
                            </th>
                            <th className="py-2.5 px-3 font-black border-b-2 border-slate-300 text-left sticky left-10 bg-slate-100 z-40 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.08)] min-w-[170px] max-w-[210px]">
                              Nama Siswa
                            </th>

                            {/* Kolom Tanggal-Tanggal Sesi (DD/MM) */}
                            {matrixData.daftarTanggal.map((tgl) => (
                              <th
                                key={tgl}
                                className="py-2 px-1 font-black border-b-2 border-slate-300 border-l border-slate-200 text-center min-w-[46px]"
                              >
                                <span className="px-1.5 py-0.5 rounded bg-teal-50 border border-teal-200 text-teal-800 text-[9px] font-black">
                                  {formatTanggalKolom(tgl)}
                                </span>
                              </th>
                            ))}

                            {/* Kolom Total Rekapitulasi (H, S, I, A, C, %) */}
                            <th className="py-1 px-2 font-black border-b-2 border-slate-300 border-l-2 border-slate-300 text-center bg-slate-200/95 sticky right-0 z-40">
                              <div className="text-[9px] font-black text-slate-700 uppercase tracking-wider mb-1">
                                TOTAL
                              </div>
                              <div className="flex items-center justify-center gap-1 bg-white py-0.5 px-1.5 rounded shadow-2xs border border-slate-200 text-[9px] font-black">
                                <span
                                  className="w-4 text-emerald-700"
                                  title="Hadir"
                                >
                                  H
                                </span>
                                <span
                                  className="w-4 text-blue-700"
                                  title="Sakit"
                                >
                                  S
                                </span>
                                <span
                                  className="w-4 text-amber-600"
                                  title="Izin"
                                >
                                  I
                                </span>
                                <span
                                  className="w-4 text-rose-700"
                                  title="Alfa"
                                >
                                  A
                                </span>
                                <span
                                  className="w-4 text-violet-700"
                                  title="Cabut"
                                >
                                  C
                                </span>
                                <span
                                  className="w-8 text-teal-800 border-l border-slate-200 pl-0.5"
                                  title="Persentase Kehadiran"
                                >
                                  %
                                </span>
                              </div>
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {filteredMatrixSiswa.map((s, sIdx) => {
                            const isEven = sIdx % 2 === 1;
                            return (
                              <tr
                                key={s.idSiswa}
                                className={`hover:bg-teal-50/60 transition-colors ${
                                  isEven ? "bg-slate-50/50" : "bg-white"
                                }`}
                              >
                                {/* No */}
                                <td
                                  className={`py-1.5 px-2 text-center font-bold text-slate-500 sticky left-0 z-20 ${
                                    isEven ? "bg-slate-50" : "bg-white"
                                  }`}
                                >
                                  {sIdx + 1}
                                </td>

                                {/* Nama Siswa */}
                                <td
                                  className={`py-1.5 px-3 text-left font-bold text-slate-800 sticky left-10 z-20 shadow-[4px_0_8px_-3px_rgba(0,0,0,0.06)] min-w-[170px] max-w-[210px] truncate ${
                                    isEven ? "bg-slate-50" : "bg-white"
                                  }`}
                                >
                                  <div className="truncate">
                                    <span className="text-[11px] font-black text-slate-800">
                                      {s.nama}
                                    </span>
                                    <p className="text-[9px] text-slate-400 font-medium">
                                      NIS: {s.idSiswa}
                                    </p>
                                  </div>
                                </td>

                                {/* Sel tiap tanggal */}
                                {matrixData.daftarTanggal.map((tgl) => {
                                  const cell =
                                    matrixData.grid[`${s.idSiswa}_${tgl}`];
                                  const st = cell?.status;

                                  let badgeClass =
                                    "bg-slate-50 text-slate-300 border-slate-200";
                                  let letter = "-";

                                  if (st === "Hadir") {
                                    badgeClass =
                                      "bg-emerald-100 text-emerald-800 border-emerald-300 font-black";
                                    letter = "H";
                                  } else if (st === "Sakit") {
                                    badgeClass =
                                      "bg-blue-100 text-blue-800 border-blue-300 font-black";
                                    letter = "S";
                                  } else if (st === "Izin") {
                                    badgeClass =
                                      "bg-amber-100 text-amber-800 border-amber-300 font-black";
                                    letter = "I";
                                  } else if (st === "Alfa") {
                                    badgeClass =
                                      "bg-rose-100 text-rose-800 border-rose-300 font-black";
                                    letter = "A";
                                  } else if (st === "Cabut") {
                                    badgeClass =
                                      "bg-violet-100 text-violet-800 border-violet-300 font-black";
                                    letter = "C";
                                  }

                                  return (
                                    <td
                                      key={tgl}
                                      className="py-1 px-1 border-l border-slate-100 text-center align-middle"
                                      title={`${s.nama} (${formatTanggalKolom(tgl)}): ${st || "Belum ada data"}${cell?.keterangan ? ` - ${cell.keterangan}` : ""}`}
                                    >
                                      <span
                                        className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] border shadow-2xs ${badgeClass}`}
                                      >
                                        {letter}
                                      </span>
                                    </td>
                                  );
                                })}

                                {/* Kolom Total Rekapitulasi Siswa */}
                                <td className="py-1 px-2 border-l-2 border-slate-200 text-center bg-slate-50 sticky right-0 z-20">
                                  <div className="flex items-center justify-center gap-1 text-[10px] font-bold">
                                    <span className="w-4 text-emerald-700 font-black">
                                      {s.h}
                                    </span>
                                    <span className="w-4 text-blue-700 font-black">
                                      {s.s}
                                    </span>
                                    <span className="w-4 text-amber-600 font-black">
                                      {s.i}
                                    </span>
                                    <span className="w-4 text-rose-700 font-black">
                                      {s.a}
                                    </span>
                                    <span className="w-4 text-violet-700 font-black">
                                      {s.c}
                                    </span>
                                    <span
                                      className={`w-8 border-l border-slate-200 pl-0.5 font-black text-[9px] ${
                                        s.persen >= 85
                                          ? "text-emerald-700"
                                          : s.persen >= 75
                                            ? "text-amber-600"
                                            : "text-rose-600"
                                      }`}
                                    >
                                      {s.persen}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>

                        {/* FOOTER TOTAL HADIR PER TANGGAL */}
                        {matrixData.daftarTanggal.length > 0 && (
                          <tfoot className="bg-slate-100 text-slate-800 sticky bottom-0 z-30 font-black border-t-2 border-slate-300">
                            <tr>
                              <td
                                colSpan={2}
                                className="py-2 px-3 text-right sticky left-0 bg-slate-100 z-30 font-black text-slate-700"
                              >
                                Jumlah Hadir Harian:
                              </td>

                              {matrixData.daftarTanggal.map((tgl) => {
                                const colStat = matrixData.perTanggalStats[tgl];
                                return (
                                  <td
                                    key={tgl}
                                    className="py-2 px-1 text-center border-l border-slate-200"
                                  >
                                    <div className="text-[10px] font-black text-emerald-700">
                                      {colStat?.countHadir || 0}
                                    </div>
                                    <div className="text-[8px] text-slate-400 font-semibold">
                                      {colStat?.persenDate || 0}%
                                    </div>
                                  </td>
                                );
                              })}

                              <td className="py-2 px-2 text-center border-l-2 border-slate-300 bg-slate-200/95 sticky right-0 z-40">
                                <span className="text-xs font-black text-teal-900">
                                  Rata-rata: {matrixData.rataRataKehadiran}%
                                </span>
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Legenda Keterangan Status */}
                    <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-600">
                          Keterangan Status:
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 font-bold">
                          <strong>H</strong> Hadir
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 border border-blue-300 text-blue-800 font-bold">
                          <strong>S</strong> Sakit
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 font-bold">
                          <strong>I</strong> Izin
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800 font-bold">
                          <strong>A</strong> Alfa
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-violet-100 border border-violet-300 text-violet-800 font-bold">
                          <strong>C</strong> Cabut
                        </span>
                      </div>

                      <div className="text-slate-400 font-medium text-[10px]">
                        Menampilkan {filteredMatrixSiswa.length} dari{" "}
                        {matrixData.totalSiswa} siswa • {matrixData.totalHari}{" "}
                        hari sesi aktif
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </ModalWrapper>
      )}

      {/* ======================================================= */}
      {/* MODAL 6: SELURUH PRESENSI WALI KELAS (SEMUA KELAS) */}
      {/* ======================================================= */}
      {isAllPresensiModalOpen && (
        <ModalWrapper
          title="Rekap Seluruh Presensi Siswa — Wali Kelas"
          onClose={() => setIsAllPresensiModalOpen(false)}
          maxWidth="max-w-5xl"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-teal-950 rounded-2xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <h4 className="text-base font-black flex items-center gap-2">
                  <span>📋 Seluruh Log Presensi Wali Kelas</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black">
                    {filteredAllPresensi.length} Data
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Rekap kehadiran siswa dari seluruh rombel wali kelas SMKN 1
                  Teluk Kuantan.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-white/10 text-xs font-bold border border-white/10">
                  Total Tercatat:{" "}
                  {dataWaliKelas.statistik?.totalPresensiTercatat ?? 0}
                </span>
              </div>
            </div>

            {/* FILTER CONTROLS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              {/* Filter Kelas */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Filter Rombel / Kelas:
                </label>
                <select
                  value={filterKelasPresensi}
                  onChange={(e) => setFilterKelasPresensi(e.target.value)}
                  className="w-full p-2 text-xs rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 outline-none focus:border-teal-500"
                >
                  <option value="all">
                    Semua Rombel ({filteredCardsWaliKelas.length})
                  </option>
                  {filteredCardsWaliKelas.map((c) => (
                    <option key={c.idWali} value={c.idWali}>
                      {c.namaKelas} — {c.namaGuru}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Status */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Status Kehadiran:
                </label>
                <div className="flex items-center gap-1">
                  {["all", "Hadir", "Sakit", "Izin", "Alfa"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setFilterStatusPresensi(st)}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        filterStatusPresensi.toLowerCase() === st.toLowerCase()
                          ? st === "Hadir"
                            ? "bg-emerald-600 text-white shadow-xs"
                            : st === "Sakit"
                              ? "bg-blue-600 text-white shadow-xs"
                              : st === "Izin"
                                ? "bg-amber-600 text-white shadow-xs"
                                : st === "Alfa"
                                  ? "bg-rose-600 text-white shadow-xs"
                                  : "bg-teal-700 text-white shadow-xs"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {st === "all" ? "Semua" : st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search text */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Pencarian Cepat:
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchPresensiText}
                    onChange={(e) => setSearchPresensiText(e.target.value)}
                    placeholder="Nama siswa, tanggal, kelas..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-medium outline-none focus:border-teal-500"
                  />
                </div>
              </div>
            </div>

            {/* TABEL DATA PRESENSI */}
            {filteredAllPresensi.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-sm font-bold text-slate-400">
                  Tidak ada data presensi yang sesuai dengan filter.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Tanggal</th>
                        <th className="py-2.5 px-3">Kelas</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3">Wali Kelas</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                        <th className="py-2.5 px-3">Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAllPresensi.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-teal-50/40 transition-colors"
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-600 whitespace-nowrap">
                            📅 {formatTanggalIndo(row.tanggal)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 font-bold border border-teal-200 text-[11px] whitespace-nowrap">
                              🏫 {row.namaKelas}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {row.namaSiswa}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-medium">
                            {row.namaGuru || "-"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-block whitespace-nowrap ${
                                row.status === "Hadir"
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : row.status === "Sakit"
                                    ? "bg-blue-100 text-blue-800 border border-blue-300"
                                    : row.status === "Izin"
                                      ? "bg-amber-100 text-amber-800 border border-amber-300"
                                      : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {row.status || "Hadir"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px] max-w-xs truncate">
                            {row.keterangan || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </ModalWrapper>
      )}

      {/* ======================================================= */}
      {/* POP-UP MODAL STATISTIK (KLIK DARI STAT CARD) */}
      {/* ======================================================= */}
      {statModalConfig.isOpen &&
        (() => {
          const allData = statModalConfig.data || [];
          const breakdown = statModalConfig.breakdownKelas || [];
          const hasBreakdown = Array.isArray(breakdown) && breakdown.length > 0;
          const q = statModalSearch.toLowerCase().trim();

          // -----------------------------------------------------------
          // KASUS 1: CARD BIASA / MODUL MONITORING EKSEKUTIF (GURU, TEMPAT, JURNAL, DLL)
          // -----------------------------------------------------------
          if (!hasBreakdown) {
            const displayData = q
              ? allData.filter((item) => {
                  const nama = typeof item === "object" ? item.nama : item;
                  const info = typeof item === "object" ? item.info : "";
                  return (
                    (nama || "").toLowerCase().includes(q) ||
                    (info || "").toLowerCase().includes(q)
                  );
                })
              : allData;

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-5 flex items-center justify-between text-white border-b border-blue-800 shrink-0">
                    <div>
                      <h3 className="text-base font-black tracking-tight">
                        {statModalConfig.title}
                      </h3>
                      <p className="text-[11px] text-blue-200 mt-0.5">
                        Total: {displayData.length}{" "}
                        {allData.length !== displayData.length
                          ? `dari ${allData.length} data`
                          : "data"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setStatModalConfig({
                          ...statModalConfig,
                          isOpen: false,
                        })
                      }
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold text-white transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Input Pencarian */}
                  {allData.length > 5 && (
                    <div className="p-3 bg-slate-100 border-b border-slate-200 shrink-0">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          🔍
                        </span>
                        <input
                          type="text"
                          value={statModalSearch}
                          onChange={(e) => setStatModalSearch(e.target.value)}
                          placeholder="Cari..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {/* List Data */}
                  <div className="p-5 overflow-y-auto flex-1">
                    {displayData.length > 0 ? (
                      <ul className="space-y-2.5">
                        {displayData.map((item, index) => (
                          <li
                            key={index}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-indigo-800 text-white font-black flex items-center justify-center text-xs shrink-0">
                                {index + 1}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-black text-slate-800 truncate">
                                  {typeof item === "object" ? item.nama : item}
                                </p>
                                {typeof item === "object" && item.info && (
                                  <p className="text-[11px] font-medium text-slate-500 truncate">
                                    {item.info}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-center py-8 text-xs font-bold text-slate-400">
                        {statModalSearch
                          ? "Tidak ada data yang sesuai dengan pencarian."
                          : "Belum ada data tersedia pada kategori ini."}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                      onClick={() =>
                        setStatModalConfig({
                          ...statModalConfig,
                          isOpen: false,
                        })
                      }
                      className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black transition-all cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // -----------------------------------------------------------
          // KASUS 2: CARD STATISTIK AKUN SISWA (SHEET SISWA - MEMILIKI BREAKDOWN KELAS)
          // -----------------------------------------------------------
          const listByTab = (() => {
            if (statModalTab === "semua") return allData;
            if (statModalTab === "X")
              return allData.filter((item) =>
                (item.info || "").toUpperCase().match(/KELAS:\s*X[\s\-_]/),
              );
            if (statModalTab === "XI")
              return allData.filter((item) =>
                (item.info || "").toUpperCase().match(/KELAS:\s*XI[\s\-_]/),
              );
            if (statModalTab === "XII")
              return allData.filter(
                (item) =>
                  !(item.info || "")
                    .toUpperCase()
                    .match(/KELAS:\s*X[I]?[\s\-_]/) &&
                  (item.info || "").toUpperCase().includes("KELAS:"),
              );
            return allData;
          })();

          const displayData =
            statModalTab !== "statistik"
              ? q
                ? listByTab.filter((item) => {
                    const nama = typeof item === "object" ? item.nama : item;
                    const info = typeof item === "object" ? item.info : "";
                    return (
                      (nama || "").toLowerCase().includes(q) ||
                      (info || "").toLowerCase().includes(q)
                    );
                  })
                : listByTab
              : [];

          const maxCount =
            breakdown.length > 0
              ? Math.max(...breakdown.map((b) => b.count))
              : 1;

          const tabDefs = [
            { key: "statistik", label: "📊 Statistik", icon: "📊" },
            { key: "semua", label: "👥 Semua", icon: "👥" },
            { key: "X", label: "🎒 Kelas X", icon: "🎒" },
            { key: "XI", label: "📘 Kelas XI", icon: "📘" },
            { key: "XII", label: "🎓 Kelas XII", icon: "🎓" },
          ];

          const barColors = [
            "bg-blue-600",
            "bg-sky-500",
            "bg-indigo-500",
            "bg-purple-600",
            "bg-teal-500",
            "bg-cyan-500",
            "bg-violet-500",
            "bg-rose-400",
          ];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-5 flex items-center justify-between text-white border-b border-blue-800 shrink-0">
                  <div>
                    <h3 className="text-base font-black tracking-tight">
                      {statModalConfig.title}
                    </h3>
                    <p className="text-[11px] text-blue-200 mt-0.5">
                      {statModalTab === "statistik"
                        ? `${breakdown.length} kelompok kelas/jurusan • ${allData.length} total siswa`
                        : `${displayData.length}${q ? ` dari ${listByTab.length}` : ""} siswa`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setStatModalConfig({
                        ...statModalConfig,
                        isOpen: false,
                      })
                    }
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold text-white transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Tab Bar */}
                <div className="flex overflow-x-auto bg-slate-100 border-b border-slate-200 shrink-0 gap-0.5 p-1.5">
                  {tabDefs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setStatModalTab(t.key);
                        setStatModalSearch("");
                      }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                        statModalTab === t.key
                          ? "bg-blue-900 text-white shadow"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Input Pencarian */}
                {statModalTab !== "statistik" && allData.length > 5 && (
                  <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        🔍
                      </span>
                      <input
                        type="text"
                        value={statModalSearch}
                        onChange={(e) => setStatModalSearch(e.target.value)}
                        placeholder="Cari nama, ID, kelas, atau tempat..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Konten Utama */}
                <div className="overflow-y-auto flex-1 p-5">
                  {/* TAB: STATISTIK – BAR CHART */}
                  {statModalTab === "statistik" && (
                    <div className="space-y-3">
                      {breakdown.length === 0 ? (
                        <p className="text-center py-8 text-xs font-bold text-slate-400">
                          Data belum tersedia.
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-4 px-1">
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                              Jumlah Siswa per Kelas / Jurusan
                            </p>
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full">
                              Total: {allData.length}
                            </span>
                          </div>

                          {breakdown.map((item, i) => {
                            const pct =
                              maxCount > 0
                                ? Math.max(
                                    4,
                                    Math.round((item.count / maxCount) * 100),
                                  )
                                : 4;
                            const color = barColors[i % barColors.length];
                            return (
                              <div key={item.kelas} className="group">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-black text-slate-700 truncate max-w-[60%]">
                                    {item.kelas}
                                  </span>
                                  <span className="text-[11px] font-black text-slate-500 ml-2 shrink-0">
                                    {item.count} siswa
                                    <span className="ml-1 text-slate-300 font-medium">
                                      (
                                      {Math.round(
                                        (item.count / allData.length) * 100,
                                      )}
                                      %)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full ${color} rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                                    style={{ width: `${pct}%` }}
                                  >
                                    {pct > 20 && (
                                      <span className="text-[9px] font-black text-white">
                                        {item.count}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB: LIST SISWA */}
                  {statModalTab !== "statistik" &&
                    (displayData.length > 0 ? (
                      <ul className="space-y-2.5">
                        {displayData.map((item, index) => (
                          <li
                            key={index}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-indigo-800 text-white font-black flex items-center justify-center text-xs shrink-0">
                                {index + 1}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-black text-slate-800 truncate">
                                  {typeof item === "object" ? item.nama : item}
                                </p>
                                {typeof item === "object" && item.info && (
                                  <p className="text-[11px] font-medium text-slate-500 truncate">
                                    {item.info}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-center py-8 text-xs font-bold text-slate-400">
                        {statModalSearch
                          ? "Tidak ada data yang sesuai dengan pencarian."
                          : "Belum ada data tersedia pada kategori ini."}
                      </p>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button
                    onClick={() =>
                      setStatModalConfig({
                        ...statModalConfig,
                        isOpen: false,
                      })
                    }
                    className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* ======================================================= */}
      {/* MODAL PESAN KEPALA SEKOLAH <-> GURU */}
      {/* ======================================================= */}
      <PesanKepsekModal
        isOpen={showPesan}
        initialGuru={pesanTarget}
        user={user}
        onChanged={refreshPesanBaru}
        onClose={() => {
          setShowPesan(false);
          setPesanTarget(null);
          refreshPesanBaru();
        }}
      />

      {/* ======================================================= */}
      {/* LIGHTBOX FOTO */}
      {/* ======================================================= */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={optimizeFotoUrl(lightboxUrl, 1200)}
              alt="Preview Dokumentasi"
              className="rounded-2xl max-h-[85vh] w-auto object-contain shadow-2xl border border-white/20"
            />
            <p className="text-center text-white/80 text-xs font-bold mt-3">
              Klik di mana saja untuk menutup
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

// =========================================================
// REUSABLE COMPONENTS
// =========================================================

// StatCard (persis struktur & desain Card() di js_guru)
function StatCard({ title, value, accentColor, icon, onClick }) {
  const bgMap = {
    "border-indigo-500": "from-indigo-600 via-indigo-700 to-blue-800",
    "border-emerald-500": "from-emerald-500 via-green-600 to-teal-700",
    "border-blue-500": "from-blue-600 via-sky-700 to-indigo-800",
    "border-amber-500": "from-amber-500 via-orange-500 to-amber-700",
    "border-teal-500": "from-teal-600 via-teal-700 to-emerald-800",
    "border-blue-600": "from-blue-700 via-blue-800 to-indigo-950",
    "border-sky-500": "from-sky-500 via-cyan-600 to-blue-700",
    "border-purple-600": "from-purple-600 via-violet-700 to-indigo-900",
  };

  const bg = bgMap[accentColor] || "from-slate-700 to-slate-800";

  return (
    <button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        rounded-3xl
        bg-gradient-to-br ${bg}
        text-white
        p-4 sm:p-5
        w-full
        shadow-lg
        active:scale-95
        hover:brightness-105
        transition-all duration-300
        text-left
      `}
    >
      <div className="relative flex items-start justify-between">
        <div className="h-11 w-11 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center text-xl shadow">
          {icon}
        </div>

        <div className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold border border-white/20 flex items-center gap-1">
          Detail
          <span className="group-hover:translate-x-1 transition-transform">
            →
          </span>
        </div>
      </div>

      <div className="relative mt-5">
        <p className="text-[10px] sm:text-xs uppercase tracking-[2px] text-white/80 font-bold">
          {title}
        </p>
        <h2 className="mt-1 text-3xl sm:text-4xl font-black leading-none drop-shadow-sm">
          {value}
        </h2>
      </div>

      <div className="relative mt-4 h-1 rounded-full bg-white/20 overflow-hidden">
        <div className="h-full w-0 bg-white group-hover:w-full transition-all duration-500"></div>
      </div>
    </button>
  );
}

// Modal Wrapper Reusable
function ModalWrapper({ title, onClose, maxWidth = "max-w-3xl", children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm">
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200`}
      >
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-4 sm:p-5 flex items-center justify-between text-white border-b border-blue-800 shrink-0">
          <h3 className="text-sm sm:text-base font-black tracking-tight truncate pr-4">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold text-white transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1">{children}</div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black transition-all active:scale-95"
          >
            Tutup Jendela
          </button>
        </div>
      </div>
    </div>
  );
}

// Loading Skeleton
function LoadingGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 animate-pulse shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-200 rounded-xl"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-3/4"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          </div>
          <div className="h-14 bg-slate-100 rounded-xl"></div>
          <div className="h-3 bg-slate-200 rounded w-2/3"></div>
        </div>
      ))}
    </div>
  );
}

// Tombol kecil "Pesan" untuk footer kartu
function PesanButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-sky-300 font-bold text-xs border border-white/10 transition-colors shadow-xs active:scale-95 cursor-pointer ${className}`}
    >
      <span>✉️</span>
      <span>Pesan</span>
    </button>
  );
}

// Baris daftar responsif (mode "List")
// - HP     : identitas -> info (2 kolom) -> tombol, tersusun ke bawah
// - Tablet : info 3 kolom
// - Desktop: satu baris (identitas | info | tombol)
function GuruListRow({
  no,
  initials,
  title,
  subtitle,
  badge,
  metas = [],
  extra = null,
  actions = [],
  onClick,
}) {
  const badgeTone = {
    ok: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    warn: "bg-rose-500/20 text-rose-300 border-rose-400/30",
    info: "bg-blue-500/20 text-blue-200 border-blue-400/30",
    neutral: "bg-white/10 text-slate-200 border-white/20",
  };
  const actionTone = {
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    sky: "text-sky-300",
    slate: "text-white",
  };

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden bg-gradient-to-r from-blue-950 via-blue-900 to-slate-900 rounded-2xl border border-blue-700/50 p-3 sm:p-4 shadow-md hover:shadow-amber-500/20 hover:border-amber-400/60 transition-all duration-300 cursor-pointer flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4"
    >
      <div className="pointer-events-none absolute top-0 right-0 -mr-8 -mt-8 w-28 h-28 rounded-full bg-gradient-to-br from-amber-400/15 to-yellow-600/5 blur-2xl"></div>

      {/* Identitas */}
      <div className="relative z-10 flex items-center gap-3 lg:w-72 xl:w-80 shrink-0 min-w-0">
        {no != null && (
          <span className="hidden sm:block w-5 shrink-0 text-center text-[11px] font-black text-blue-300/70">
            {no}
          </span>
        )}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-900 flex items-center justify-center font-black text-sm shadow-md shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-black text-white group-hover:text-amber-300 transition-colors truncate">
            {title}
          </h4>
          <p className="text-[11px] font-medium text-blue-300 truncate">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Info ringkas */}
      <div className="relative z-10 flex-1 min-w-0 space-y-2">
        {metas.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {metas.map((m, i) => (
              <div
                key={i}
                className={`bg-blue-950/60 rounded-xl border border-blue-800/50 px-2.5 py-1.5 min-w-0 ${
                  m.wide ? "col-span-2" : ""
                }`}
              >
                <p className="text-[9px] font-bold text-blue-300/80 uppercase truncate">
                  {m.label}
                </p>
                <p
                  className={`text-xs font-black truncate ${
                    m.tone || "text-white"
                  }`}
                  title={String(m.value ?? "")}
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>
        )}
        {extra}
      </div>

      {/* Status + aksi */}
      <div className="relative z-10 flex flex-wrap items-center gap-2 lg:justify-end lg:max-w-sm shrink-0">
        {badge && (
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase border ${
              badgeTone[badge.tone] || badgeTone.neutral
            }`}
          >
            {badge.text}
          </span>
        )}
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              a.onClick?.();
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-xs border border-white/10 transition-colors shadow-xs active:scale-95 cursor-pointer ${
              actionTone[a.tone] || actionTone.slate
            }`}
          >
            <span>{a.icon}</span>
            <span>{a.label}</span>
          </button>
        ))}
        <span className="hidden lg:inline text-amber-400 font-black text-sm group-hover:translate-x-1 transition-transform">
          →
        </span>
      </div>
    </div>
  );
}
