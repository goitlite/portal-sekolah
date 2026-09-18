"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSession, isLoggedIn, logout } from "../lib/auth";

import {
  getDashboardGuru,
  getTempatMagangGuru,
  getAktivitasGuru,
  getJurnalGuruWali,
  getDataSiswaWali,
  getJurnalPKL,
  getRekapSemua, // ⬅️ TAMBAHKAN
  getGuru, // ⬅️ TAMBAHKAN
  getMapelByGuru,
  getBiodataSiswa,
  updateBiodataSiswa,
} from "../lib/api";
import { generateLaporanPDF } from "../rekap/pdf/laporanMagang"; // ⬅️ TAMBAHKAN
import { generateLaporanGuruWaliPDF } from "./guru-wali/generateLaporanGuruWaliPDF";
import { generateLaporanMapelPDF } from "./guru-mapel/generateLaporanMapelPDF";
import CetakLaporanGuruWaliModal from "./guru-wali/CetakLaporanGuruWaliModal";
import CetakLaporanMapelModal from "./guru-mapel/CetakLaporanMapelModal";
import ModalPresensiMapel from "./guru-mapel/ModalPresensiMapel";
import IsiJurnalPklModal from "./IsiJurnalPklModal";
import { generateLaporanJurnalPKL } from "./generateLaporanJurnalPKL";

// --- OPTIMASI FOTO: paksa Google mengirim versi kecil, bukan resolusi asli ---
// Foto asli dari kamera HP bisa 3-8MB / 4000x3000px. Ditampilkan di thumbnail kecil
// tetap saja didekode browser di resolusi aslinya -> bisa habiskan ratusan MB RAM
// dan bikin tab crash/blank di HP dengan memori terbatas.
function optimizeFotoUrl(url, size = 300) {
  if (!url || typeof url !== "string") return url;

  // Format: https://lh3.googleusercontent.com/d/FILE_ID
  if (url.includes("googleusercontent.com")) {
    // Buang parameter ukuran lama kalau ada, lalu pasang yang baru
    const base = url.split("=")[0];
    return `${base}=w${size}-h${size}-c`;
  }

  // Format: https://drive.google.com/uc?id=FILE_ID atau /file/d/FILE_ID/view
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
      second: "2-digit",
    }) + " WIB"
  );
}

// Format nomor WhatsApp (08xxx / 62xxx -> https://wa.me/62xxx)
function getWhatsAppUrl(noHp) {
  if (!noHp) return null;
  let nomor = String(noHp).replace(/\D/g, "");
  if (!nomor) return null;
  if (nomor.startsWith("0")) {
    nomor = "62" + nomor.substring(1);
  } else if (!nomor.startsWith("62")) {
    nomor = "62" + nomor;
  }
  return `https://wa.me/${nomor}`;
}

// Bagikan template ID login ke nomor WhatsApp siswa
function kirimLoginWhatsApp(idSiswa, namaSiswa) {
  if (!idSiswa) {
    alert("ID siswa tidak tersedia.");
    return;
  }
  const namaBersih = String(namaSiswa || "Siswa")
    .replace(/\s*\[.*?\]\s*/, "")
    .trim();
  const pesan = `Halo ${namaBersih}.\n\nSilakan login ke Portal SMKN 1 Teluk Kuantan:\nhttps://portalsmkn1telku.vercel.app/\n\nGunakan ID sesuai kartu Anda:\nNama: ${namaBersih}\nID: ${idSiswa}`;
  const url = `https://wa.me/?text=${encodeURIComponent(pesan)}`;
  window.open(url, "_blank");
}

// =========================================================
// KONFIGURASI: CATATAN PERKEMBANGAN MURID (LAMPIRAN B)
// =========================================================
const ASPEK_PEMANTAUAN = [
  { key: "akademik", label: "Akademik" },
  { key: "karakter", label: "Karakter" },
  { key: "sosial", label: "Sosial-Emosional" },
  { key: "disiplin", label: "Kedisiplinan" },
  { key: "potensi", label: "Potensi & Minat" },
];

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

const formatBulanTahun = (nilaiBulan) => {
  if (!nilaiBulan) return "-";
  const [tahun, bulan] = String(nilaiBulan).split("-");
  const indexBulan = Number(bulan) - 1;
  const namaBulan = NAMA_BULAN_INDO[indexBulan] || bulan;
  return `${namaBulan} ${tahun}`;
};

const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

const FORM_CATATAN_KOSONG = {
  periodeAwal: "",
  periodeAkhir: "",
  desAkademik: "",
  tinAkademik: "",
  ketAkademik: "",
  desKarakter: "",
  tinKarakter: "",
  ketKarakter: "",
  desSosial: "",
  tinSosial: "",
  ketSosial: "",
  desDisiplin: "",
  tinDisiplin: "",
  ketDisiplin: "",
  desPotensi: "",
  tinPotensi: "",
  ketPotensi: "",
};

// Bungkus satu request dengan batas waktu — tanpa ini, kalau Apps Script
// macet/lambat merespons, request bisa menggantung tanpa batas dan spinner
// tidak akan pernah berhenti berputar.
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

// Retry ringan untuk request awal dashboard — GAS kadang "cold start" dan
// gagal/lambat di percobaan pertama setelah idle lama, jadi dicoba sekali
// lagi sebelum benar-benar dianggap gagal.
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

// Retry khusus alur CETAK (bukan loading dashboard) — bedanya dari
// fetchStepWithRetry di atas: di sini respons ber-`success: false` (misalnya
// GAS sempat cold-start dan balas error, tapi tidak "throw" secara teknis)
// JUGA dianggap kegagalan dan ikut di-retry, bukan cuma network/timeout.
// Ini akar masalah kenapa cetak laporan sering gagal PERSIS SEKALI di
// percobaan pertama (login baru = GAS belum "panas") lalu sukses begitu
// tombol ditekan ulang: percobaan pertama gagal diam-diam dan dibaca kode
// sebagai "datanya kosong", padahal sebenarnya request-nya yang gagal.
// Retry 2x (3 percobaan total) karena mencetak adalah aksi sesekali yang
// wajar ditunggu sedikit lebih lama demi hasil yang benar.
async function fetchPrintDataWithRetry(
  fn,
  { retries = 2, delayMs = 1200, onRetry } = {},
) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fetchWithTimeout(fn, 15000);
      if (result && result.success === false) {
        throw new Error(
          result.message || "Permintaan ke server gagal diproses.",
        );
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        if (typeof onRetry === "function") {
          onRetry(attempt + 1, retries);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

function DashboardGuruContent() {
  const router = useRouter();
  // v2: dinaikkan supaya cache lama yang mungkin korup (struktur tidak lengkap)
  // otomatis diabaikan begitu fix ini live, tanpa perlu user hapus data browser manual.
  const CACHE_KEY = "dashboardGuruCache_v2";
  // --- STATE UNTUK TAB MENU UTAMA ---
  const [activeMenuTab, setActiveMenuTab] = useState("pembimbing");

  const [showPilihCetakPklModal, setShowPilihCetakPklModal] = useState(false);

  // --- STATE BARU JURNAL PKL ---
  const [showJurnalPklModal, setShowJurnalPklModal] = useState(false);
  const [includeCetakJurnalPkl, setIncludeCetakJurnalPkl] = useState(false);
  const [loadingCetakJurnalPkl, setLoadingCetakJurnalPkl] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0); // ⬅️ TAMBAHKAN: progress bar batang
  const [loadFailed, setLoadFailed] = useState(false); // ⬅️ TAMBAHKAN: status gagal total
  const [loadFailedMessage, setLoadFailedMessage] = useState(""); // ⬅️ TAMBAHKAN
  const isMountedRef = useRef(true); // ⬅️ TAMBAHKAN: pengganti isMounted lokal agar bisa dipakai ulang oleh tombol refresh
  const [user, setUser] = useState(null);
  const [aktivitas, setAktivitas] = useState([]);
  const [tempatMagang, setTempatMagang] = useState([]);
  const [dashboard, setDashboard] = useState({
    jumlahSiswa: "--",
    hadirHariIni: "--",
    totalHadir: "--",
    izinSakit: "--",
    // Ekspektasi array list nama dari API backend:
    listJumlahSiswa: [],
    listHadirHariIni: [],
    listTotalHadir: [],
    listIzinSakit: [],
  });

  // --- STATE UNTUK MODAL NAMA SISWA ---
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    data: [],
  });

  // --- STATE UNTUK GALERI AKTIVITAS & FULLSCREEN ---
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [loadingCetakWali, setLoadingCetakWali] = useState(false);
  const [showLaporanWaliModal, setShowLaporanWaliModal] = useState(false);
  const [showCetakMapelModal, setShowCetakMapelModal] = useState(false);

  // --- STATE KHUSUS TAB GURU WALI ---
  const [dataSiswaWali, setDataSiswaWali] = useState([]);
  const [loadingSiswaWali, setLoadingSiswaWali] = useState(false);
  const [errorSiswaWali, setErrorSiswaWali] = useState("");
  const [siswaWaliLoaded, setSiswaWaliLoaded] = useState(false);
  const [searchSiswaWali, setSearchSiswaWali] = useState("");
  const [selectedSiswaWali, setSelectedSiswaWali] = useState(null);

  // --- STATE CATATAN PERKEMBANGAN (LAMPIRAN B) ---
  const [showCatatanModal, setShowCatatanModal] = useState(false);
  const [siswaCatatanAktif, setSiswaCatatanAktif] = useState(null);
  const [loadingCatatan, setLoadingCatatan] = useState(false);
  const [savingCatatan, setSavingCatatan] = useState(false);
  const [formCatatan, setFormCatatan] = useState(FORM_CATATAN_KOSONG);

  // --- STATE KHUSUS TAB GURU MAPEL ---
  const [daftarMapel, setDaftarMapel] = useState([]);
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [errorMapel, setErrorMapel] = useState("");
  const [mapelLoaded, setMapelLoaded] = useState(false);
  const [searchMapel, setSearchMapel] = useState("");
  const [cetakMapelCardLoadingId, setCetakCardLoadingId] = useState(null);
  const [mapelPresensiAktif, setMapelPresensiAktif] = useState(null);

  const [loadingCetakLaporanMonitoring, setLoadingCetakLaporanMonitoring] =
    useState(false);
  const [progressPdfMonitoring, setProgressPdfMonitoring] = useState(0); // ⬅️ TAMBAHKAN
  const [retryStatusText, setRetryStatusText] = useState(""); // ⬅️ TAMBAHKAN: pesan saat retry cetak

  const [showCetakModal, setShowCetakModal] = useState(false);
  const [formDataCetak, setFormDataCetak] = useState({
    nip: "",
    pangkat: "",
    jabatan: "",
    spt: "",
  });

  // 👇 TAMBAHAN STATE UNTUK LAPORAN PERJALANAN DINAS
  const [includePerjalananDinas, setIncludePerjalananDinas] = useState(false);
  // Generate tanggal otomatis sesuai saat form dibuka
  const hariIni = new Date();
  const namaBulanMap = [
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
  const tanggalOtomatisInit = `${hariIni.getDate()} ${namaBulanMap[hariIni.getMonth()]} ${hariIni.getFullYear()}`;

  const [formPerjalananDinas, setFormPerjalananDinas] = useState({
    dasar: "Surat Perintah Tugas Kepala Sekolah tentang Siswa PKL 2026",
    tempatKegiatan: "Teluk Kuantan",
    tanggalPelaksanaan: "04 September 2026",
    pelaksanaKegiatan:
      "Pembimbing Praktik Kerja Lapangan (PKL) SMKN 1 Teluk Kuantan",
    namaKegiatan: "Monitoring Siswa PKL 2026",
    tujuanKegiatan: "Melakukan Monitoring Siswa PKL 2026",
    sasaranKegiatan: "Siswa PKL 2026 SMKN 1 Teluk Kuantan",
    prosesKegiatan:
      "Kegiatan Monitoring Siswa Praktik Kerja Lapangan (PKL) SMKN 1 Teluk Kuantan Tahun Pelajaran 2026/2027 dilaksanakan pada tanggal 03 September 2026 di Teluk Kuantan. Kegiatan diawali dengan monitoring ke PT. Telkom, dilanjutkan ke Kantor Diskominfo Kuansing, Toko Kita Store, dan terakhir Kantor Mayatama Net. Dalam kegiatan tersebut, guru pembimbing memantau presensi online, perkembangan kompetensi, jurnal kegiatan, serta permasalahan yang dihadapi siswa dan berkoordinasi dengan pihak Dunia Usaha dan Dunia Industri (DUDI)",
    hasilKegiatan:
      "Kegiatan Monitoring Siswa PKL berjalan dengan baik dan sesuai rencana. Siswa mampu beradaptasi dengan lingkungan Dunia Usaha dan Dunia Industri (DUDI) serta memperoleh pengalaman kerja yang bermanfaat untuk meningkatkan kompetensi dan kesiapan memasuki dunia kerja.",
    saranSaran:
      "Perlu ditingkatkan kerja sama dengan lebih banyak DUDI yang profesional dan relevan sebagai mitra strategis dalam mendukung peningkatan kompetensi peserta didik.",
    tanggalTtd: tanggalOtomatisInit, // <-- Form akan terisi secara otomatis mengikuti tanggal hari ini
  });

  // 👇 TAMBAHAN STATE UNTUK FITUR "TAMBAH FOTO LAMPIRAN"
  const [includeFotoLampiran, setIncludeFotoLampiran] = useState(false);
  const [fotoLampiranList, setFotoLampiranList] = useState([
    { namaTempat: "", fotoBase64: "", fotoWidth: 0, fotoHeight: 0 },
  ]);

  // Tambah baris baru (tombol ikon "+")
  function tambahBarisFotoLampiran() {
    setFotoLampiranList((prev) => [
      ...prev,
      { namaTempat: "", fotoBase64: "", fotoWidth: 0, fotoHeight: 0 },
    ]);
  }

  // Hapus satu baris
  function hapusBarisFotoLampiran(index) {
    setFotoLampiranList((prev) => prev.filter((_, i) => i !== index));
  }

  // Ubah nama tempat magang pada baris tertentu
  function ubahNamaTempatFotoLampiran(index, value) {
    setFotoLampiranList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, namaTempat: value } : row)),
    );
  }

  // Upload & kompres foto lampiran ringan (maks 1200px) agar ukuran PDF wajar
  async function handleUploadFotoLampiran(index, file) {
    if (!file) return;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = await new Promise((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });

      const MAX_DIM = 1200;
      let targetW = img.width;
      let targetH = img.height;
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIM) / targetW);
          targetW = MAX_DIM;
        } else {
          targetW = Math.round((targetW * MAX_DIM) / targetH);
          targetH = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);

      setFotoLampiranList((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                fotoBase64: compressedDataUrl,
                fotoWidth: targetW,
                fotoHeight: targetH,
              }
            : row,
        ),
      );
    } catch (err) {
      console.error("Gagal memproses foto lampiran:", err);
      alert("Gagal memproses foto. Coba gunakan file gambar lain.");
    }
  }

  // 👇 TAMBAHKAN KODE INI UNTUK MENGINGAT ISIAN FORM
  useEffect(() => {
    const savedData = localStorage.getItem("dataPernyataanMutlak");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormDataCetak({
          nip: parsed.nip || "",
          pangkat: parsed.pangkat || "",
          jabatan: parsed.jabatan || "",
          spt: parsed.spt || "",
        });
      } catch (e) {
        console.error("Gagal membaca data dari localStorage", e);
      }
    }
  }, []);

  // loadDashboard dibuat sebagai fungsi biasa (bukan hanya di dalam useEffect)
  // supaya bisa dipanggil ulang oleh tombol "🔄 Muat Ulang" saat gagal, tanpa
  // perlu reload seluruh halaman.
  const loadDashboard = useCallback(async () => {
    if (!isLoggedIn()) {
      router.replace("/magang/login");
      return;
    }

    const session = getSession();

    if (!session || session.role !== "guru") {
      router.replace("/magang/login");
      return;
    }

    if (isMountedRef.current) {
      setUser(session);
      setLoadFailed(false);
      setLoadFailedMessage("");
      setLoadProgress(8);
    }

    // 1. LOAD CACHE — tampil instan kalau ada & valid, lalu tetap disegarkan
    // di latar belakang oleh fetch di bawah.
    const cachedDataStr = localStorage.getItem(CACHE_KEY);
    let usedCache = false;

    if (cachedDataStr && isMountedRef.current) {
      try {
        const cachedData = JSON.parse(cachedDataStr);

        // PENTING: validasi ketat struktur cache sebelum dipakai.
        // Ini akar masalah "sekali gagal, seterusnya selalu gagal": kalau cache
        // pernah tersimpan dengan field yang undefined/rusak (misal karena request
        // sempat gagal saat pertama kali disimpan), versi lama kode langsung
        // percaya bentuk cache apa adanya. Akibatnya .length/.map dipanggil pada
        // undefined saat render -> seluruh halaman crash, dan karena crash terjadi
        // sebelum data baru sempat menimpa cache yang rusak, error ini berulang
        // di SETIAP login berikutnya sampai localStorage dibersihkan manual.
        const isValidCache =
          cachedData &&
          typeof cachedData === "object" &&
          cachedData.dashboard &&
          typeof cachedData.dashboard === "object" &&
          Array.isArray(cachedData.tempatMagang) &&
          Array.isArray(cachedData.aktivitas);

        if (isValidCache) {
          setDashboard(cachedData.dashboard);
          setTempatMagang(cachedData.tempatMagang);
          setAktivitas(cachedData.aktivitas);
          setLoading(false);
          usedCache = true;
        } else {
          console.warn(
            "Cache dashboard tidak valid, diabaikan & dihapus. Menunggu data baru dari server.",
          );
          localStorage.removeItem(CACHE_KEY);
        }
      } catch (error) {
        console.error("Gagal membaca cache dashboard, cache dihapus:", error);
        localStorage.removeItem(CACHE_KEY);
      }
    }

    // 2. FETCH DATA — tiap request dibungkus timeout (15 detik) + retry 1x
    // supaya cold-start GAS tidak bikin spinner menggantung selamanya, dan
    // progress bar naik nyata setiap salah satu dari 3 request selesai
    // (bukan animasi buatan).
    const totalSteps = 3;
    let doneSteps = 0;
    const bumpProgress = () => {
      doneSteps += 1;
      if (isMountedRef.current) {
        setLoadProgress(10 + Math.round((doneSteps / totalSteps) * 80));
      }
    };

    try {
      const [result, tempat, aktivitasResult] = await Promise.allSettled([
        fetchStepWithRetry(() => getDashboardGuru(session.id)).finally(
          bumpProgress,
        ),
        fetchStepWithRetry(() => getTempatMagangGuru(session.id)).finally(
          bumpProgress,
        ),
        fetchStepWithRetry(() => getAktivitasGuru(session.id)).finally(
          bumpProgress,
        ),
      ]);

      if (!isMountedRef.current) return;

      // Dashboard
      const dashboardData =
        result.status === "fulfilled" &&
        result.value?.success &&
        result.value?.data
          ? result.value.data
          : null;

      // Tempat Magang (dipaksa array - jaga-jaga backend mengembalikan bentuk lain saat error)
      const tempatDataRaw =
        tempat.status === "fulfilled" && tempat.value?.success
          ? tempat.value.data
          : [];
      const tempatData = Array.isArray(tempatDataRaw) ? tempatDataRaw : [];

      // Aktivitas (dipaksa array - jaga-jaga backend mengembalikan bentuk lain saat error)
      const aktivitasDataRaw =
        aktivitasResult.status === "fulfilled" && aktivitasResult.value?.success
          ? aktivitasResult.value.data
          : [];
      const aktivitasData = Array.isArray(aktivitasDataRaw)
        ? aktivitasDataRaw
        : [];

      // Jika dashboard berhasil
      if (dashboardData) {
        const serverData = {
          dashboard: dashboardData,
          tempatMagang: tempatData,
          aktivitas: aktivitasData,
        };

        setDashboard(serverData.dashboard);
        setTempatMagang(serverData.tempatMagang);
        setAktivitas(serverData.aktivitas);
        setLoadProgress(100);

        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(serverData));
        } catch (cacheErr) {
          // Beberapa browser mobile punya kuota localStorage kecil.
          // Gagal cache tidak boleh menghentikan render dashboard.
          console.warn("Cache dashboard dilewati (kuota penuh?):", cacheErr);
        }
      } else if (!usedCache) {
        // Gagal total dan tidak ada cache sebagai fallback — tampilkan status
        // gagal + tombol refresh, JANGAN biarkan spinner berputar selamanya.
        setLoadFailed(true);
        setLoadFailedMessage(
          result.status === "rejected"
            ? "Koneksi ke server terputus atau server lambat merespons."
            : "Data dashboard tidak ditemukan di server.",
        );
      }
    } catch (err) {
      console.error("Error fetching dashboard:", err);
      if (!usedCache) {
        setLoadFailed(true);
        setLoadFailedMessage(
          "Terjadi kesalahan saat mengambil data. Periksa koneksi internet Anda.",
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

  // --- FUNGSI KLIK CARD STATISTIK ---
  function handleCardClick(title, listData) {
    setModalConfig({
      isOpen: true,
      title: title,
      data: listData || [],
    });
  }

  // --- FUNGSI NAVIGASI GALERI ---
  const handleNextImage = (e) => {
    e.stopPropagation();
    setGalleryIndex((prev) => (prev + 1) % aktivitas.length);
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setGalleryIndex((prev) => (prev - 1 + aktivitas.length) % aktivitas.length);
  };

  // --- CETAK LAPORAN JURNAL GURU WALI (PDF) ---
  const handleCetakLaporanGuruWali = async () => {
    if (!user?.id || loadingCetakWali) return;

    setLoadingCetakWali(true);

    try {
      const res = await getJurnalGuruWali(user.id);
      const daftarJurnal = res?.data || res || [];

      if (!Array.isArray(daftarJurnal) || daftarJurnal.length === 0) {
        alert("Belum ada jurnal pertemuan yang tercatat untuk dicetak.");
        return;
      }

      await generateLaporanGuruWaliPDF({
        data: daftarJurnal,
        namaGuru: user?.nama || daftarJurnal[0]?.namaGuru,
      });
    } catch (error) {
      console.error("Gagal mencetak laporan guru wali:", error);
      alert(
        "Gagal mencetak laporan: " + (error?.message || "Terjadi kesalahan"),
      );
    } finally {
      setLoadingCetakWali(false);
    }
  };

  // --- FUNGSI CETAK JURNAL PKL ---
  const handleCetakJurnalPkl = async () => {
    if (!user?.id || loadingCetakJurnalPkl) return;
    setLoadingCetakJurnalPkl(true);
    try {
      const res = await getJurnalPKL(user.id);
      const daftarJurnal = res?.data || [];
      if (!Array.isArray(daftarJurnal) || daftarJurnal.length === 0) {
        alert("Belum ada jurnal PKL yang tercatat untuk dicetak.");
        return;
      }
      await generateLaporanJurnalPKL({
        data: daftarJurnal,
        namaGuru: user?.nama,
      });
    } catch (error) {
      alert(
        "Gagal mencetak jurnal PKL: " + (error?.message || "Terjadi kesalahan"),
      );
    } finally {
      setLoadingCetakJurnalPkl(false);
    }
  };

  const handleCetakLaporanMonitoringLangsung = async () => {
    if (!user?.id || loadingCetakLaporanMonitoring) return;
    setLoadingCetakLaporanMonitoring(true);
    setProgressPdfMonitoring(0);
    setRetryStatusText("");

    try {
      // Simpan form (perilaku sama seperti alur lama)
      localStorage.setItem(
        "dataPernyataanMutlak",
        JSON.stringify({ nama: user?.nama, ...formDataCetak }),
      );

      if (includePerjalananDinas) {
        localStorage.setItem(
          "dataPerjalananDinas",
          JSON.stringify(formPerjalananDinas),
        );
      } else {
        localStorage.removeItem("dataPerjalananDinas");
      }

      if (includeCetakJurnalPkl) {
        await handleCetakJurnalPkl();
      }

      // Samakan format "bulan" persis seperti targetBulanRekap di alur lama
      const date = new Date();
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
      const bulanTerbaru = `${namaBulan[date.getMonth()]} ${date.getFullYear()}`;

      // Ambil data rekap & daftar guru SECARA PARALEL (bukan berurutan) dengan
      // retry otomatis + cek `success` eksplisit. Ini memperbaiki bug: kalau
      // login baru saja dilakukan (GAS belum "panas"), percobaan pertama bisa
      // gagal/timeout secara diam-diam dan sebelumnya dibaca sebagai "data
      // kosong" — padahal sebenarnya request-nya yang gagal. Sekarang gagal
      // di percobaan pertama akan otomatis dicoba lagi hingga 2x sebelum
      // benar-benar dianggap gagal.
      setProgressPdfMonitoring(5);
      const [hasilRekap, resGuru] = await Promise.all([
        fetchPrintDataWithRetry(
          () => getRekapSemua(bulanTerbaru, "", user.id),
          {
            onRetry: (attempt, total) =>
              setRetryStatusText(
                `Server lambat merespons, mencoba lagi... (${attempt}/${total})`,
              ),
          },
        ),
        fetchPrintDataWithRetry(() => getGuru()),
      ]);
      setRetryStatusText("");
      setProgressPdfMonitoring(18);

      const dataRekap = hasilRekap?.data || [];
      let guruList = resGuru?.data || [];
      guruList = [...guruList].sort((a, b) =>
        (a.NAMA_GURU || "").localeCompare(b.NAMA_GURU || ""),
      );

      // Filter identik dengan filteredDataToRender (filterNama="", filterKelas="Semua", tempat="Semua")
      const filteredDataToRender = dataRekap
        .filter((item) => (item.siswa || []).length > 0)
        .sort((a, b) => a.tempat.localeCompare(b.tempat));

      if (filteredDataToRender.length === 0) {
        alert(
          "Tidak ada data untuk dicetak. Pastikan sudah ada presensi tercatat.",
        );
        return;
      }

      // Cari namaGuru — persis logika handleDownloadPDF di halaman Rekap
      const guruObj = guruList.find((g) => {
        const finalId =
          g.id ||
          g.ID ||
          g.ID_GURU ||
          g.id_guru ||
          g.idGuru ||
          g.NAMA_GURU ||
          g.nama ||
          "";
        return finalId === user.id;
      });
      const namaGuru = guruObj
        ? guruObj.NAMA || guruObj.nama || guruObj.NAMA_GURU || guruObj.nama_guru
        : user.id;

      const dataPernyataanStr = localStorage.getItem("dataPernyataanMutlak");
      const dataPernyataan = dataPernyataanStr
        ? JSON.parse(dataPernyataanStr)
        : null;

      const dataPerjalananStr = localStorage.getItem("dataPerjalananDinas");
      const dataPerjalanan = dataPerjalananStr
        ? JSON.parse(dataPerjalananStr)
        : null;

      // Foto lampiran tambahan (hanya baris yang sudah diisi foto)
      const dataFotoLampiran = includeFotoLampiran
        ? fotoLampiranList.filter((item) => item.fotoBase64)
        : null;

      await generateLaporanPDF({
        data: filteredDataToRender,
        guruDipilih: user.id,
        namaGuru,
        bulan: bulanTerbaru || "Semua Bulan",
        guruList,
        dataPernyataan,
        dataPerjalanan,
        dataFotoLampiran,
        onProgress: (p) => setProgressPdfMonitoring(18 + p * 0.8), // petakan 0-100 dari PDF ke 18-98%
      });

      setProgressPdfMonitoring(100);
      setTimeout(() => setShowCetakModal(false), 400); // beri jeda supaya 100% sempat terlihat
    } catch (error) {
      console.error("Gagal mencetak laporan monitoring:", error);
      alert(
        error?.message
          ? `Gagal mencetak laporan: ${error.message}`
          : "Terjadi kesalahan teknis saat menyusun PDF. Pastikan koneksi internet lancar.",
      );
    } finally {
      setRetryStatusText("");
      setLoadingCetakLaporanMonitoring(false);
    }
  };

  // --- AMBIL DAFTAR SISWA WALI (Lazy-load & Caching) ---
  const loadSiswaWaliData = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) return [];
      const cacheKey = `siswaWaliCache_${user.id}`;

      // Gunakan cache session agar instan jika bukan refresh manual
      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDataSiswaWali(parsed);
              setSiswaWaliLoaded(true);
              return parsed;
            }
          }
        } catch (e) {
          console.warn("Gagal membaca cache siswa wali:", e);
        }
      }

      setLoadingSiswaWali(true);
      setErrorSiswaWali("");

      try {
        const res = await fetchStepWithRetry(() => getDataSiswaWali(user.id), {
          retries: 1,
          timeoutMs: 15000,
        });

        if (res && res.success) {
          const list = Array.isArray(res.data) ? res.data : [];
          setDataSiswaWali(list);
          setSiswaWaliLoaded(true);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(list));
          } catch (e) {}
          return list;
        } else {
          setErrorSiswaWali(res?.message || "Gagal mengambil data siswa wali.");
          return [];
        }
      } catch (err) {
        console.error("Error load siswa wali:", err);
        setErrorSiswaWali(
          "Terjadi kendala koneksi saat mengambil data siswa wali.",
        );
        return [];
      } finally {
        setLoadingSiswaWali(false);
      }
    },
    [user?.id],
  );

  // --- AMBIL DAFTAR MAPEL (Lazy-load & Caching) ---
  const loadMapelData = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) return [];
      const cacheKey = `mapelCache_${user.id}`;

      if (!forceRefresh) {
        try {
          const cached = sessionStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDaftarMapel(parsed);
              setMapelLoaded(true);
              return parsed;
            }
          }
        } catch (e) {
          console.warn("Gagal membaca cache mapel:", e);
        }
      }

      setLoadingMapel(true);
      setErrorMapel("");

      try {
        const res = await fetchStepWithRetry(() => getMapelByGuru(user.id), {
          retries: 1,
          timeoutMs: 15000,
        });

        if (res && res.success) {
          const list = Array.isArray(res.data) ? res.data : [];
          setDaftarMapel(list);
          setMapelLoaded(true);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(list));
          } catch (e) {}
          return list;
        } else {
          setErrorMapel(res?.message || "Gagal mengambil data mata pelajaran.");
          return [];
        }
      } catch (err) {
        console.error("Error load mapel:", err);
        setErrorMapel(
          "Terjadi kendala koneksi saat mengambil data mata pelajaran.",
        );
        return [];
      } finally {
        setLoadingMapel(false);
      }
    },
    [user?.id],
  );

  // Lazy trigger data fetching saat tab Guru Wali atau Guru Mapel dipilih
  useEffect(() => {
    if (activeMenuTab === "wali" && !siswaWaliLoaded && user?.id) {
      loadSiswaWaliData(false);
    } else if (activeMenuTab === "mapel" && !mapelLoaded && user?.id) {
      loadMapelData(false);
    }
  }, [
    activeMenuTab,
    siswaWaliLoaded,
    mapelLoaded,
    user?.id,
    loadSiswaWaliData,
    loadMapelData,
  ]);

  // Handler cetak laporan PDF langsung dari kartu Mapel
  const handleCetakPdfMapelDirect = async (mapel) => {
    try {
      setCetakCardLoadingId(mapel.idMapel);
      await generateLaporanMapelPDF({ guru: user, mapel });
    } catch (err) {
      console.error("Gagal cetak PDF mapel:", err);
      alert(err?.message || "Gagal mencetak laporan PDF mapel.");
    } finally {
      setCetakCardLoadingId(null);
    }
  };

  // --- AMBIL DAFTAR SISWA WALI (untuk pilihan cetak Lampiran A & B) ---
  const fetchDaftarSiswaWaliDashboard = async () => {
    if (dataSiswaWali && dataSiswaWali.length > 0) return dataSiswaWali;
    return await loadSiswaWaliData(false);
  };

  // --- HANDLER CATATAN PERKEMBANGAN MURID (LAMPIRAN B) ---
  async function handleBukaCatatanPerkembangan(siswa) {
    if (!siswa) return;
    const studentId = siswa.idSiswa || siswa.id || siswa.ID_SISWA || siswa.ID;
    setSiswaCatatanAktif(siswa);
    setShowCatatanModal(true);
    setLoadingCatatan(true);
    setFormCatatan(FORM_CATATAN_KOSONG);

    try {
      if (!studentId) {
        console.warn("ID Siswa tidak ditemukan:", siswa);
        return;
      }
      const res = await getBiodataSiswa(String(studentId));

      if (!res?.success) {
        console.warn("Gagal mengambil catatan perkembangan:", res?.message);
        return;
      }

      const data = res.data || {};

      setFormCatatan({
        periodeAwal: data.periodeAwal || "",
        periodeAkhir: data.periodeAkhir || "",
        desAkademik: data.desAkademik || "",
        tinAkademik: data.tinAkademik || "",
        ketAkademik: data.ketAkademik || "",
        desKarakter: data.desKarakter || "",
        tinKarakter: data.tinKarakter || "",
        ketKarakter: data.ketKarakter || "",
        desSosial: data.desSosial || "",
        tinSosial: data.tinSosial || "",
        ketSosial: data.ketSosial || "",
        desDisiplin: data.desDisiplin || "",
        tinDisiplin: data.tinDisiplin || "",
        ketDisiplin: data.ketDisiplin || "",
        desPotensi: data.desPotensi || "",
        tinPotensi: data.tinPotensi || "",
        ketPotensi: data.ketPotensi || "",
      });
    } catch (error) {
      console.error("Gagal mengambil catatan perkembangan:", error);
      alert("Gagal mengambil data catatan perkembangan sebelumnya.");
    } finally {
      setLoadingCatatan(false);
    }
  }

  function tutupCatatanModal() {
    setShowCatatanModal(false);
    setSiswaCatatanAktif(null);
    setFormCatatan(FORM_CATATAN_KOSONG);
  }

  function updateFieldCatatan(key, value) {
    setFormCatatan((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSimpanCatatanPerkembangan() {
    if (!siswaCatatanAktif) return;
    const studentId =
      siswaCatatanAktif.idSiswa ||
      siswaCatatanAktif.id ||
      siswaCatatanAktif.ID_SISWA ||
      siswaCatatanAktif.ID;

    if (!studentId) {
      alert("ID Siswa tidak ditemukan.");
      return;
    }

    if (!formCatatan.periodeAwal || !formCatatan.periodeAkhir) {
      alert("Pilih periode pemantauan (bulan awal dan bulan akhir) dulu.");
      return;
    }

    setSavingCatatan(true);
    try {
      const res = await updateBiodataSiswa({
        idSiswa: String(studentId),
        ...formCatatan,
      });

      if (!res?.success) {
        alert(res?.message || "Gagal menyimpan catatan perkembangan.");
        return;
      }

      alert("Catatan perkembangan berhasil disimpan.");
      tutupCatatanModal();
    } catch (error) {
      console.error("Gagal menyimpan catatan perkembangan:", error);
      alert("Terjadi kesalahan saat menyimpan catatan perkembangan.");
    } finally {
      setSavingCatatan(false);
    }
  }

  // Status gagal total (tidak ada cache & fetch gagal setelah retry) —
  // tampilkan tombol refresh, jangan biarkan pengguna terjebak di spinner.
  if (loadFailed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3">⚠️</p>
          <h2 className="text-lg font-black text-slate-800 mb-2">
            Gagal Memuat Dashboard
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

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xs text-center">
          <p className="mb-4 text-base font-bold text-slate-600 tracking-wide">
            Menyinkronkan Dashboard Guru...
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
    <main className="min-h-screen bg-slate-50 space-y-6 pb-12 relative">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1 rounded-xl border border-white/20">
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
                PORTAL AKADEMIK
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 px-5 py-2 text-xs sm:text-sm font-black text-white border-2 border-amber-300/80 shadow-lg hover:border-amber-200 hover:brightness-110 active:scale-95 transition-all duration-300"
          >
            ❌ LOGOUT
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-md border border-blue-800">
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
              aktivitas Murid
            </p>
          </div>
        </div>

        {/* MENU TAMPILAN UTAMA - DIBUNGKUS BACKGROUND GRADIENT HEADER & TAB EMAS */}
        <div className="relative mt-2 space-y-3 rounded-2xl border border-blue-700/50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-2.5 shadow-md sm:p-5">
          {/* Ornamen Glow Emas */}

          {/* TAMBAHKAN KODE GARIS EMAS DI SINI */}
          <div className="flex items-center gap-3 my-1 w-full px-1">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-amber-400 to-yellow-300 rounded-full opacity-80"></div>
            <h3 className="text-xs sm:text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 uppercase whitespace-nowrap drop-shadow-sm">
              PILIH JENIS PEMBIMBING
            </h3>
            <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-amber-400 to-yellow-300 rounded-full opacity-80"></div>
          </div>

          {/* 1. CONTAINER TAB DENGAN LENGKUNGAN EMAS */}
          <div className="relative flex overflow-hidden rounded-xl border border-amber-400/30 bg-blue-950/70 p-1 shadow-inner">
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-0 w-12 rounded-r-xl bg-gradient-to-l from-amber-400/50 via-yellow-400/20 to-transparent sm:w-16"></div>

            {/* Tab: Pembimbing PKL */}
            <button
              onClick={() => setActiveMenuTab("pembimbing")}
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

            {/* Tab: Guru Wali */}
            <button
              onClick={() => setActiveMenuTab("wali")}
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

            {/* Tab: Guru Mapel */}
            <button
              onClick={() => setActiveMenuTab("mapel")}
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
          </div>

          {/* 2. KONTEN TAB PEMBIMBING PKL */}
          {activeMenuTab === "pembimbing" && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
              <SolidCompactCard
                title="Kelola Murid PKL"
                desc="Lihat & kelola siswa bimbingan"
                icon="🗂️"
                bgGrad="from-blue-600 to-indigo-700"
                onClick={() => router.push("/magang/siswa")}
              />
              <SolidCompactCard
                title="Tambah Murid PKL"
                desc="Registrasi akun siswa baru"
                icon="➕"
                bgGrad="from-sky-500 to-cyan-600"
                onClick={() => router.push("/magang/tambah")}
              />
              <SolidCompactCard
                title="Rekap PKL"
                desc="Rekapitulasi kehadiran & log"
                icon="📊"
                bgGrad="from-violet-600 to-purple-800"
                onClick={() => router.push("/magang/rekap")}
              />
              <SolidCompactCard
                title="Isi Jurnal PKL"
                desc="Catat jurnal pembimbingan individual"
                icon="📝"
                bgGrad="from-rose-500 to-pink-600"
                onClick={() => setShowJurnalPklModal(true)}
              />
              <SolidCompactCard
                title="Cetak Laporan PKL"
                desc="Monitoring atau Jurnal PKL"
                icon="🖨️"
                bgGrad="from-fuchsia-500 to-pink-600"
                onClick={() => setShowPilihCetakPklModal(true)}
              />
            </div>
          )}

          {/* 3. KONTEN TAB GURU WALI */}
          {activeMenuTab === "wali" && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
              <SolidCompactCard
                title="Kelola Murid Wali"
                desc="Lihat & Kelola murid perwalian"
                icon="👥"
                bgGrad="from-orange-500 to-red-600"
                onClick={() => router.push("/magang/guru/guru-wali")}
              />
              <SolidCompactCard
                title="Tambah Siswa Wali"
                desc="Registrasi siswa wali baru"
                icon="➕"
                bgGrad="from-emerald-500 to-teal-600"
                onClick={() => router.push("/magang/guru/guru-wali/tambah")}
              />
              <SolidCompactCard
                title="Rekap Guru Wali"
                desc="Pantau aktivitas harian"
                icon="📈"
                bgGrad="from-amber-500 to-orange-500"
                onClick={() => router.push("/magang/guru/guru-wali/rekap")}
              />
              <SolidCompactCard
                title="Isi Jurnal Guru Wali"
                desc="Catat agenda jurnal harian"
                icon="📝"
                bgGrad="from-rose-500 to-pink-600"
                onClick={() => router.push("/magang/guru/guru-wali/jurnal")}
              />
              <SolidCompactCard
                title="Cetak Laporan Guru Wali"
                desc="Pilih Cover / Lampiran A&B / Lampiran C&D"
                icon="📑"
                bgGrad="from-slate-500 to-slate-700"
                onClick={() => setShowLaporanWaliModal(true)}
              />
            </div>
          )}

          {/* 4. KONTEN TAB GURU MAPEL */}
          {activeMenuTab === "mapel" && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
              <SolidCompactCard
                title="Kelola Mapel"
                desc="Tambah mata pelajaran & presensi"
                icon="📚"
                bgGrad="from-cyan-600 to-blue-700"
                onClick={() => router.push("/magang/guru/guru-mapel/kelola")}
              />
              <SolidCompactCard
                title="Isi Pembinaan Mapel"
                desc="Segera hadir (Fase berikutnya)"
                icon="📷"
                bgGrad="from-slate-500 to-slate-700"
                disabled={true}
                onClick={() => {}}
              />
              <SolidCompactCard
                title="Cetak Laporan Mapel"
                desc="Unduh rekap presensi & nilai (PDF)"
                icon="🖨️"
                bgGrad="from-fuchsia-600 to-pink-600"
                onClick={() => setShowCetakMapelModal(true)}
              />
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* KONTEN DINAMIS BERDASARKAN TAB JENIS PEMBIMBING TERPILIH */}
        {/* ======================================================== */}

        {/* 1. JIKA TAB PEMBIMBING PKL: TAMPILKAN MONITORING, STATISTIK & AKTIVITAS TERKINI */}
        {activeMenuTab === "pembimbing" && (
          <>
            {/* MONITORING LAPANGAN */}
            <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FCE7A4] to-[#F3D36B] p-5 sm:p-6 shadow-[0_12px_35px_rgba(212,175,55,0.22)] border border-[#D9B44A]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9B44A]/40 pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    📸 Monitoring Lapangan
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-amber-900/70">
                    Pilih area penempatan aktif untuk meninjau log presensi
                    mandiri siswa.
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
                        {/* BAGIAN INFORMASI TEMPAT & JUMLAH SISWA */}
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

                        {/* BAGIAN TOMBOL */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto mt-3 sm:mt-0">
                          <button
                            onClick={() => {
                              const date = new Date();
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
                              const bulanTerbaru = `${namaBulan[date.getMonth()]} ${date.getFullYear()}`;

                              localStorage.setItem(
                                "targetTempatRekap",
                                item.tempat,
                              );
                              localStorage.setItem("targetGuruRekap", user.id);
                              localStorage.setItem(
                                "targetBulanRekap",
                                bulanTerbaru,
                              );

                              router.push("/magang/rekap");
                            }}
                            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-[0.97] hover:brightness-110 flex items-center justify-center gap-2 transition-all"
                          >
                            👁️ LIHAT AKTIVITAS
                          </button>

                          <button
                            onClick={() => mulaiMonitoring(item.tempat)}
                            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-[0.97] hover:brightness-110 flex items-center justify-center gap-2 transition-all"
                          >
                            📷 MONITORING AREA
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* STATISTIK CARD GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card
                title="Jumlah Siswa"
                value={dashboard?.jumlahSiswa ?? "--"}
                accentColor="border-indigo-500"
                textColor="text-indigo-600"
                icon="👥"
                onClick={() =>
                  handleCardClick(
                    "Daftar Jumlah Siswa",
                    dashboard?.listJumlahSiswa,
                  )
                }
              />
              <Card
                title="Hadir Hari Ini"
                value={dashboard?.hadirHariIni ?? "--"}
                accentColor="border-emerald-500"
                textColor="text-emerald-600"
                icon="✅"
                onClick={() =>
                  handleCardClick(
                    "Siswa Hadir Hari Ini",
                    dashboard?.listHadirHariIni,
                  )
                }
              />
              <Card
                title="Total Kehadiran"
                value={dashboard?.totalHadir ?? "--"}
                accentColor="border-blue-500"
                textColor="text-blue-600"
                icon="📊"
                onClick={() =>
                  handleCardClick(
                    "Log Total Kehadiran",
                    dashboard?.listTotalHadir,
                  )
                }
              />
              <Card
                title="Izin / Sakit"
                value={dashboard?.izinSakit ?? "--"}
                accentColor="border-amber-500"
                textColor="text-amber-600"
                icon="🤒"
                onClick={() =>
                  handleCardClick(
                    "Daftar Siswa Izin / Sakit",
                    dashboard?.listIzinSakit,
                  )
                }
              />
            </div>

            {/* TABEL AKTIVITAS TERBARU */}
            <div className="rounded-[2rem] bg-white border border-slate-200 shadow-md overflow-hidden">
              <div className="border-b border-slate-100 p-5 bg-gradient-to-r from-slate-50 to-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    ⚡ Aktivitas Terkini
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-slate-500">
                    Log pengiriman presensi & pemantauan foto riil siswa di
                    lapangan.
                  </p>
                </div>
                {aktivitas.length > 0 && (
                  <button
                    onClick={() => {
                      setGalleryIndex(0);
                      setShowGallery(true);
                    }}
                    className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold py-2.5 px-5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>👁️</span> Lihat Semuanya
                  </button>
                )}
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
                            src={optimizeFotoUrl(item.foto, 160)}
                            alt="Aktivitas"
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
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
          </>
        )}

        {/* ======================================================= */}
        {/* 2. KONTEN TAB: GURU WALI */}
        {/* ======================================================= */}
        {activeMenuTab === "wali" && (
          <div className="space-y-6">
            {/* HEADER SEKSI GURU WALI */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👨‍🏫</span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">
                    Daftar Siswa Wali
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-xs font-black">
                    {dataSiswaWali.length} Siswa
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Kontak dan informasi penting siswa perwalian untuk komunikasi
                  cepat via WhatsApp.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchSiswaWali}
                    onChange={(e) => setSearchSiswaWali(e.target.value)}
                    placeholder="Cari nama, ID, kelas..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-medium transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => loadSiswaWaliData(true)}
                  disabled={loadingSiswaWali}
                  title="Segarkan data siswa wali"
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <span
                    className={
                      loadingSiswaWali ? "animate-spin inline-block" : ""
                    }
                  >
                    🔄
                  </span>
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorSiswaWali && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="text-xs sm:text-sm font-semibold">
                    {errorSiswaWali}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => loadSiswaWaliData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shrink-0"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingSiswaWali && (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((sk) => (
                  <div
                    key={sk}
                    className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
                  >
                    <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                    <div className="h-8 bg-slate-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY STATE */}
            {!loadingSiswaWali &&
              !errorSiswaWali &&
              dataSiswaWali.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-sm">
                  <span className="text-5xl">👨‍🎓</span>
                  <h3 className="mt-3 text-base sm:text-lg font-black text-slate-700">
                    Belum Ada Siswa Wali
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto font-medium">
                    Belum terdapat siswa yang terhubung dengan akun guru wali
                    ini. Anda dapat mendaftarkan siswa baru.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/magang/guru/guru-wali/tambah")}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                  >
                    ➕ Tambah Siswa Wali Baru
                  </button>
                </div>
              )}

            {/* GRID KARTU SISWA WALI */}
            {!loadingSiswaWali && (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dataSiswaWali
                  .filter((siswa) => {
                    if (!searchSiswaWali.trim()) return true;
                    const q = searchSiswaWali.toLowerCase();
                    const nama = String(siswa.nama || "").toLowerCase();
                    const idS = String(siswa.idSiswa || "").toLowerCase();
                    const kelas = String(siswa.kelas || "").toLowerCase();
                    const tempat = String(
                      siswa.tempatMagang || "",
                    ).toLowerCase();
                    return (
                      nama.includes(q) ||
                      idS.includes(q) ||
                      kelas.includes(q) ||
                      tempat.includes(q)
                    );
                  })
                  .map((siswa, idx) => {
                    const namaMentah = siswa.nama || "-";
                    const matchKelas = namaMentah.match(/\[(.*?)\]/);
                    const kelas = matchKelas ? matchKelas[1] : siswa.kelas;
                    const namaBersih = namaMentah
                      .replace(/\s*\[.*?\]\s*/, "")
                      .trim();

                    const ortuHp =
                      siswa.kontakAyah ||
                      siswa.kontakIbu ||
                      siswa.noHpOrtu ||
                      siswa.noHpOrangTua;
                    const labelOrtu = siswa.kontakAyah
                      ? "Ayah"
                      : siswa.kontakIbu
                        ? "Ibu"
                        : "Ortu";

                    return (
                      <div
                        key={siswa.idSiswa || idx}
                        className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-[#EADBBD] bg-gradient-to-b from-[#FFFDF9] via-[#FAF6ED] to-[#F5EEDD] shadow-[0_6px_25px_rgba(217,180,74,0.12)] hover:shadow-[0_14px_35px_rgba(217,180,74,0.22)] hover:border-[#D4AF37] transition-all duration-300"
                      >
                        {/* HEADER KARTU: ELEGAN BLUE-NAVY DENGAN SENTUHAN EMAS */}
                        <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-4 sm:p-5 text-white border-b border-[#D4AF37]/30">
                          {/* Ambient Glow Emas Lembut */}
                          <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br from-amber-400/20 via-yellow-400/10 to-transparent blur-2xl"></div>

                          <div className="relative z-10 flex items-start gap-3.5">
                            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 via-white/10 to-indigo-500/25 text-2xl shadow-inner border border-amber-300/40">
                              👨‍🎓
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="truncate text-sm sm:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-100 to-yellow-100 leading-tight drop-shadow-xs">
                                  {namaBersih || "-"}
                                </h3>
                                {kelas && (
                                  <span className="inline-flex items-center shrink-0 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-2.5 py-0.5 text-[10px] font-black text-amber-950 border border-amber-200/90 shadow-sm">
                                    {kelas}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <p className="text-[11px] font-bold text-amber-200/90 tracking-wide">
                                  ID:{" "}
                                  <span className="text-white font-black">
                                    {siswa.idSiswa || "-"}
                                  </span>
                                </p>
                                {siswa.idSiswa && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      kirimLoginWhatsApp(
                                        siswa.idSiswa,
                                        siswa.nama,
                                      )
                                    }
                                    title="Bagi ID login siswa via WhatsApp"
                                    className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 px-2.5 py-1 text-[10px] font-black text-white shadow-sm border border-emerald-400/30 transition-all hover:scale-105 active:scale-95"
                                  >
                                    <span>📲</span>
                                    <span>Bagi ID</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* INFORMASI PENTING (BODY KARTU BERWARNA LEMBUT & ELEGAN) */}
                        <div className="flex flex-1 flex-col p-4 sm:p-5 bg-gradient-to-b from-white/90 via-[#FFFDF9]/95 to-[#FAF6ED] space-y-3">
                          {/* 1. KONTAK WHATSAPP SISWA & ORANG TUA */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {/* WHATSAPP SISWA */}
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/30 border border-emerald-200/80 shadow-xs transition-all hover:border-emerald-300">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800/80 block mb-1.5 flex items-center gap-1">
                                📱 WA Siswa
                              </span>
                              {siswa.noHp ? (
                                <a
                                  href={getWhatsAppUrl(siswa.noHp)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-xs font-black shadow-xs transition-all active:scale-95 break-all w-full justify-center"
                                >
                                  <span>💬</span>
                                  <span>{siswa.noHp}</span>
                                </a>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400 italic block py-0.5">
                                  Belum diisi
                                </span>
                              )}
                            </div>

                            {/* WHATSAPP ORANG TUA */}
                            <div className="p-3 rounded-2xl bg-gradient-to-br from-white via-teal-50/40 to-cyan-100/30 border border-teal-200/80 shadow-xs transition-all hover:border-teal-300">
                              <span className="text-[10px] font-black uppercase tracking-wider text-teal-800/80 block mb-1.5 flex items-center gap-1">
                                👨‍👩‍👧 WA {labelOrtu}
                              </span>
                              {ortuHp ? (
                                <a
                                  href={getWhatsAppUrl(ortuHp)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-700 hover:brightness-110 text-white text-xs font-black shadow-xs transition-all active:scale-95 break-all w-full justify-center"
                                >
                                  <span>💬</span>
                                  <span>{ortuHp}</span>
                                </a>
                              ) : (
                                <span className="text-xs font-semibold text-slate-400 italic block py-0.5">
                                  Belum diisi
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 2. ALAMAT SISWA */}
                          <div className="p-3 rounded-2xl bg-gradient-to-br from-white to-amber-50/30 border border-amber-200/60 shadow-xs">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900/70 block mb-1 flex items-center gap-1">
                              📍 Alamat Domisili
                            </span>
                            <p className="text-xs font-semibold text-slate-700 leading-relaxed line-clamp-2">
                              {siswa.alamat ? (
                                siswa.alamat
                              ) : (
                                <span className="italic text-slate-400">
                                  Belum ada data alamat
                                </span>
                              )}
                            </p>
                          </div>

                          {/* 3. TEMPAT MAGANG & PEMBIMBING */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-white to-blue-50/50 border border-blue-200/60 shadow-xs">
                              <span className="text-[10px] font-black uppercase tracking-wider text-blue-800/70 block mb-0.5">
                                🏢 Magang / DUDI
                              </span>
                              <p className="text-[11px] font-bold text-slate-800 truncate">
                                {siswa.tempatMagang || "-"}
                              </p>
                            </div>
                            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-white to-indigo-50/50 border border-indigo-200/60 shadow-xs">
                              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800/70 block mb-0.5">
                                👔 Guru Wali
                              </span>
                              <p className="text-[11px] font-bold text-slate-800 truncate">
                                {siswa.namaGuru || "-"}
                              </p>
                            </div>
                          </div>

                          {/* 4. TOMBOL AKSI KARTU */}
                          <div className="pt-2 mt-auto grid grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSiswaWali(siswa)}
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 hover:from-blue-100 hover:to-indigo-100 border border-blue-300/80 px-2.5 py-2.5 text-[11px] sm:text-xs font-black text-blue-900 shadow-xs transition-all active:scale-95"
                            >
                              <span>👁️</span>
                              <span>Profil Lengkap</span>
                            </button>

                            {/* GANTI EDIT MENJADI CATATAN PERKEMBANGAN */}
                            <button
                              type="button"
                              onClick={() =>
                                handleBukaCatatanPerkembangan(siswa)
                              }
                              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 hover:brightness-110 border border-indigo-400/50 px-2.5 py-2.5 text-[11px] sm:text-xs font-black text-white shadow-md shadow-indigo-500/20 transition-all active:scale-95"
                            >
                              <span>📝</span>
                              <span>Catatan Perkembangan</span>
                            </button>
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
        {/* 3. KONTEN TAB: GURU MAPEL */}
        {/* ======================================================= */}
        {activeMenuTab === "mapel" && (
          <div className="space-y-6">
            {/* HEADER SEKSI GURU MAPEL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">
                    Mata Pelajaran Anda
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-black">
                    {daftarMapel.length} Mapel
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Kelola presensi, nilai, dan daftar siswa per pertemuan
                  pembelajaran.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchMapel}
                    onChange={(e) => setSearchMapel(e.target.value)}
                    placeholder="Cari mapel, kelas..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-medium transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => router.push("/magang/guru/guru-mapel/kelola")}
                  className="px-3.5 py-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                >
                  <span>➕</span>
                  <span className="hidden sm:inline">Tambah Mapel</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadMapelData(true)}
                  disabled={loadingMapel}
                  title="Segarkan data mapel"
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <span
                    className={loadingMapel ? "animate-spin inline-block" : ""}
                  >
                    🔄
                  </span>
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorMapel && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="text-xs sm:text-sm font-semibold">
                    {errorMapel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => loadMapelData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shrink-0"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingMapel && (
              <div className="space-y-4">
                {[1, 2, 3].map((sk) => (
                  <div
                    key={sk}
                    className="animate-pulse rounded-[2rem] border border-blue-900/30 bg-blue-950/20 p-6 space-y-3"
                  >
                    <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY STATE */}
            {!loadingMapel && !errorMapel && daftarMapel.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-sm">
                <span className="text-5xl">📚</span>
                <h3 className="mt-3 text-base sm:text-lg font-black text-slate-700">
                  Belum Ada Mata Pelajaran
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto font-medium">
                  Bapak/Ibu belum menambahkan mata pelajaran. Buat mata
                  pelajaran sekarang untuk mulai mencatat presensi dan nilai.
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/magang/guru/guru-mapel/kelola")}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                >
                  ➕ Tambah Mapel Baru
                </button>
              </div>
            )}

            {/* LIST KARTU MAPEL (SESUAI DENGAN KELOLA MAPEL) */}
            {!loadingMapel && (
              <div className="space-y-4 sm:space-y-5">
                {daftarMapel
                  .filter((m) => {
                    if (!searchMapel.trim()) return true;
                    const q = searchMapel.toLowerCase();
                    const nama = String(m.namaMapel || "").toLowerCase();
                    const kelas = String(m.kelas || "").toLowerCase();
                    const ket = String(m.keterangan || "").toLowerCase();
                    return (
                      nama.includes(q) || kelas.includes(q) || ket.includes(q)
                    );
                  })
                  .map((mapel) => (
                    <div
                      key={mapel.idMapel}
                      className="rounded-[2rem] overflow-hidden shadow-lg border border-blue-800 bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-5 sm:p-6 text-white transition-all hover:shadow-xl"
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2 flex-wrap">
                            <h3 className="font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 drop-shadow-sm">
                              {mapel.namaMapel}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {mapel.kelas && (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-800/60 border border-blue-500/40 text-blue-100">
                                Kelas {mapel.kelas}
                              </span>
                            )}
                          </div>

                          {mapel.keterangan && (
                            <p className="text-xs sm:text-sm text-blue-200 font-medium mt-3">
                              {mapel.keterangan}
                            </p>
                          )}
                        </div>

                        {/* TOMBOL AKSI KANAN */}
                        <div className="flex gap-2 flex-wrap shrink-0 mt-2 md:mt-0">
                          <button
                            type="button"
                            onClick={() => setMapelPresensiAktif(mapel)}
                            title="Buka popup presensi & nilai mapel ini"
                            className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 px-4 py-2.5 text-xs font-black text-white border border-emerald-400/40 shadow-md transition-all flex items-center gap-1.5"
                          >
                            <span>📊</span>
                            <span>Presensi & Nilai</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCetakPdfMapelDirect(mapel)}
                            disabled={cetakMapelCardLoadingId === mapel.idMapel}
                            title="Cetak Laporan Presensi & Nilai PDF"
                            className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:brightness-110 active:scale-95 px-4 py-2.5 text-xs font-black text-white border border-fuchsia-400/40 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60"
                          >
                            {cetakMapelCardLoadingId === mapel.idMapel ? (
                              <>
                                <span className="inline-block animate-spin">
                                  ⏳
                                </span>
                                <span>Mencetak...</span>
                              </>
                            ) : (
                              <>
                                <span>🖨️</span>
                                <span>Cetak PDF</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              localStorage.setItem(
                                "mapelAktifId",
                                mapel.idMapel,
                              );
                              router.push("/magang/guru/guru-mapel/kelola");
                            }}
                            title="Buka pengaturan lengkap mapel"
                            className="rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-3.5 py-2.5 text-xs font-black text-white transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <span>⚙️</span>
                            <span>Kelola Mapel</span>
                          </button>
                        </div>
                      </div>

                      {/* TOMBOL BUKA PRESENSI & NILAI (POPUP SEPERTI KELOLA MAPEL) */}
                      <button
                        type="button"
                        onClick={() => setMapelPresensiAktif(mapel)}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:brightness-110 active:scale-[0.98] px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-black text-amber-950 shadow-md border border-amber-300 transition-all cursor-pointer"
                      >
                        <span>📊</span>
                        <span>BUKA PRESENSI & NILAI</span>
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL POP-UP NAMA SISWA */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                {modalConfig.title}
              </h3>
              <button
                onClick={() =>
                  setModalConfig({ ...modalConfig, isOpen: false })
                }
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {modalConfig.data && modalConfig.data.length > 0 ? (
                <ul className="space-y-2">
                  {modalConfig.data.map((namaSiswa, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                          {index + 1}
                        </div>

                        {typeof namaSiswa === "object" ? (
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800">
                                {namaSiswa.nama.replace(/\s*\[.*?\]/, "")}
                              </span>

                              <span className="px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold">
                                {
                                  (namaSiswa.nama.match(/\[(.*?)\]/) || [
                                    ,
                                    "",
                                  ])[1]
                                }
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-700">
                              {String(namaSiswa).replace(/\s*\[.*?\]/, "")}
                            </span>

                            <span className="px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold">
                              {
                                (String(namaSiswa).match(/\[(.*?)\]/) || [
                                  ,
                                  "",
                                ])[1]
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {typeof namaSiswa === "object" && (
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold min-w-[48px] text-center">
                          {namaSiswa.total}x
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm font-semibold text-slate-500">
                    Tidak ada data siswa / Belum ada riwayat.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() =>
                  setModalConfig({ ...modalConfig, isOpen: false })
                }
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL GALERI AKTIVITAS (TAMPILAN SLIDER)
          ========================================= */}
      {showGallery && aktivitas.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-2xl overflow-hidden flex flex-col relative">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-4 flex items-center justify-between text-white">
              <h3 className="font-black text-lg">
                Galeri Aktivitas ({galleryIndex + 1}/{aktivitas.length})
              </h3>
              <button
                onClick={() => setShowGallery(false)}
                className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col items-center relative">
              <div
                className="relative w-full h-64 sm:h-96 bg-slate-100 rounded-xl overflow-hidden cursor-zoom-in group border border-slate-200 shadow-inner"
                onClick={() => setIsFullScreen(true)}
              >
                <img
                  src={optimizeFotoUrl(aktivitas[galleryIndex].foto, 800)}
                  alt="Aktivitas"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full transition-opacity font-bold">
                    🔍 Klik Gambar untuk Fullscreen
                  </span>
                </div>
              </div>

              <div className="mt-5 text-center px-4 w-full">
                <span
                  className={`inline-block mb-1.5 rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    aktivitas[galleryIndex].jenis === "PRESENSI"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {aktivitas[galleryIndex].jenis}
                </span>
                <h4 className="font-black text-xl text-slate-800">
                  {aktivitas[galleryIndex].nama}
                </h4>
                <p className="text-sm font-semibold text-slate-500 mt-1">
                  📍 {aktivitas[galleryIndex].tempat}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  ⏱️ {formatTanggal(aktivitas[galleryIndex].waktu)}
                </p>
              </div>

              <button
                onClick={handlePrevImage}
                className="absolute left-2 sm:left-4 top-[40%] -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 shadow-lg p-3 sm:p-4 rounded-full flex items-center justify-center transition-all active:scale-95 border border-slate-200"
              >
                ◀
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-2 sm:right-4 top-[40%] -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 shadow-lg p-3 sm:p-4 rounded-full flex items-center justify-center transition-all active:scale-95 border border-slate-200"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL GAMBAR FULLSCREEN
          ========================================= */}
      {isFullScreen && aktivitas.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-2 sm:p-6">
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[70] bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
          >
            ✕
          </button>

          <img
            src={optimizeFotoUrl(aktivitas[galleryIndex].foto, 1280)}
            alt="Fullscreen Aktivitas"
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            decoding="async"
          />

          <button
            onClick={handlePrevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white shadow-md p-4 rounded-full flex items-center justify-center transition-all"
          >
            ◀
          </button>
          <button
            onClick={handleNextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white shadow-md p-4 rounded-full flex items-center justify-center transition-all"
          >
            ▶
          </button>
        </div>
      )}

      {/* MODAL PILIHAN: CETAK LAPORAN MONITORING atau CETAK JURNAL PKL */}
      {showPilihCetakPklModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-fuchsia-500 to-pink-600 p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                Cetak Laporan PKL
              </h3>
              <button
                onClick={() => setShowPilihCetakPklModal(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <button
                onClick={() => {
                  setShowPilihCetakPklModal(false);
                  setShowCetakModal(true);
                }}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center gap-3"
              >
                <span className="text-2xl">📊</span>
                <span>
                  <span className="block font-bold text-slate-800">
                    Cetak Laporan Monitoring
                  </span>
                  <span className="block text-xs text-slate-500">
                    Rekap kehadiran & data pernyataan mutlak (PDF/Excel)
                  </span>
                </span>
              </button>

              <button
                disabled={loadingCetakJurnalPkl}
                onClick={async () => {
                  setShowPilihCetakPklModal(false);
                  await handleCetakJurnalPkl();
                }}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50 transition-colors flex items-center gap-3 disabled:opacity-60"
              >
                <span className="text-2xl">📘</span>
                <span>
                  <span className="block font-bold text-slate-800">
                    {loadingCetakJurnalPkl
                      ? "Menyiapkan PDF..."
                      : "Cetak Jurnal PKL"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Format Pembimbingan Individual, langsung unduh PDF
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ISIAN CETAK LAPORAN */}
      {showCetakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-lg overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                Kelengkapan Cetak Laporan
              </h3>
              <button
                onClick={() => setShowCetakModal(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-slate-500">Nama</label>
                <input
                  type="text"
                  value={user?.nama || ""}
                  readOnly
                  className="w-full mt-1 p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">NIP</label>
                <input
                  type="text"
                  placeholder="Masukkan NIP"
                  value={formDataCetak.nip}
                  onChange={(e) =>
                    setFormDataCetak({ ...formDataCetak, nip: e.target.value })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Pangkat / Golongan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Penata Tk. I / III.d"
                  value={formDataCetak.pangkat}
                  onChange={(e) =>
                    setFormDataCetak({
                      ...formDataCetak,
                      pangkat: e.target.value,
                    })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Jabatan
                </label>
                <input
                  type="text"
                  placeholder="Masukkan Jabatan"
                  value={formDataCetak.jabatan}
                  onChange={(e) =>
                    setFormDataCetak({
                      ...formDataCetak,
                      jabatan: e.target.value,
                    })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Nomor Surat Perintah Tugas (SPT)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan Nomor SPT"
                  value={formDataCetak.spt}
                  onChange={(e) =>
                    setFormDataCetak({ ...formDataCetak, spt: e.target.value })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* 👇 CHECKBOX & FORM LAPORAN PERJALANAN DINAS */}
              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includePerjalananDinas}
                    onChange={(e) =>
                      setIncludePerjalananDinas(e.target.checked)
                    }
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-black text-slate-800">
                    📝 Buat Laporan Perjalanan Dinas
                  </span>
                </label>
              </div>

              {includePerjalananDinas && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <p className="font-bold text-indigo-700 uppercase text-[11px] mb-1">
                    Form Input Laporan Perjalanan Dinas
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 rounded-lg text-slate-600 font-medium text-[11px]">
                    <div>
                      <span className="font-bold">Nama:</span>{" "}
                      {user?.nama || "Otomatis"}
                    </div>
                    <div>
                      <span className="font-bold">NIP:</span>{" "}
                      {formDataCetak.nip || "Otomatis"}
                    </div>
                    <div>
                      <span className="font-bold">Jabatan:</span>{" "}
                      {formDataCetak.jabatan || "Otomatis"}
                    </div>
                    <div>
                      <span className="font-bold">No. Surat Tugas:</span>{" "}
                      {formDataCetak.spt || "Otomatis"}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      I. Dasar
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.dasar}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          dasar: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      II. Tempat Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.tempatKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          tempatKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      III. Tanggal Pelaksanaan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.tanggalPelaksanaan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          tanggalPelaksanaan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      IV. Pelaksana Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.pelaksanaKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          pelaksanaKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      V. Nama Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.namaKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          namaKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      VII. Tujuan Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.tujuanKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          tujuanKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      VIII. Sasaran Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.sasaranKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          sasaranKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      IX. Proses Kegiatan
                    </label>
                    <textarea
                      rows={4}
                      value={formPerjalananDinas.prosesKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          prosesKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      X. Hasil Kegiatan
                    </label>
                    <textarea
                      rows={3}
                      value={formPerjalananDinas.hasilKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          hasilKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      XI. Saran – saran
                    </label>
                    <textarea
                      rows={2}
                      value={formPerjalananDinas.saranSaran}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          saranSaran: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 👇 CHECKBOX & FORM TAMBAH FOTO LAMPIRAN */}
              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeFotoLampiran}
                    onChange={(e) => setIncludeFotoLampiran(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-black text-slate-800">
                    📎 Tambah Foto Lampiran
                  </span>
                </label>
              </div>

              {includeFotoLampiran && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <p className="font-bold text-indigo-700 uppercase text-[11px] mb-1">
                    Foto Lampiran Kegiatan
                  </p>

                  <div className="space-y-2">
                    {fotoLampiranList.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2"
                      >
                        <input
                          type="text"
                          placeholder="Nama tempat magang"
                          value={item.namaTempat}
                          onChange={(e) =>
                            ubahNamaTempatFotoLampiran(index, e.target.value)
                          }
                          className="flex-1 p-2 border border-slate-300 rounded-lg bg-white text-xs"
                        />

                        <label className="shrink-0 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadFotoLampiran(index, file);
                              e.target.value = "";
                            }}
                          />
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                              item.fotoBase64
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                : "bg-indigo-100 text-indigo-700 border border-indigo-300"
                            }`}
                          >
                            {item.fotoBase64
                              ? "✅ Foto Terpilih"
                              : "📤 Upload Foto"}
                          </span>
                        </label>

                        {fotoLampiranList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => hapusBarisFotoLampiran(index)}
                            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200 font-bold"
                            title="Hapus baris"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={tambahBarisFotoLampiran}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white font-black text-lg shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
                      title="Tambah baris"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {loadingCetakLaporanMonitoring && (
              <div className="px-5 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-bold ${
                      retryStatusText ? "text-amber-600" : "text-slate-500"
                    }`}
                  >
                    {retryStatusText || "Menyiapkan PDF..."}
                  </span>
                  <span className="text-[10px] font-black text-indigo-600">
                    {Math.round(progressPdfMonitoring)}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPdfMonitoring}%` }}
                  />
                </div>
              </div>
            )}

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowCetakModal(false)}
                disabled={loadingCetakLaporanMonitoring}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleCetakLaporanMonitoringLangsung}
                disabled={loadingCetakLaporanMonitoring}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-200 disabled:opacity-60"
              >
                {loadingCetakLaporanMonitoring
                  ? `⏳ ${Math.round(progressPdfMonitoring)}%`
                  : "Lanjutkan Cetak"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PILIHAN CETAK LAPORAN GURU WALI */}
      <CetakLaporanGuruWaliModal
        isOpen={showLaporanWaliModal}
        onClose={() => setShowLaporanWaliModal(false)}
        namaGuru={user?.nama}
        fetchDaftarSiswaWali={fetchDaftarSiswaWaliDashboard}
        onCetakLampiranCD={handleCetakLaporanGuruWali}
        loadingLampiranCD={loadingCetakWali}
      />

      {/* MODAL ISIKAN JURNAL PKL */}
      <IsiJurnalPklModal
        isOpen={showJurnalPklModal}
        onClose={() => setShowJurnalPklModal(false)}
        idGuru={user?.id}
        namaGuru={user?.nama}
        onSaved={() => setShowJurnalPklModal(false)}
      />

      {/* MODAL CETAK LAPORAN MAPEL */}
      <CetakLaporanMapelModal
        isOpen={showCetakMapelModal}
        onClose={() => setShowCetakMapelModal(false)}
        guru={user}
      />

      {/* MODAL PROFIL LENGKAP SISWA WALI */}
      {selectedSiswaWali && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedSiswaWali(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* TEMA WARNA HEADER MODAL */}
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-indigo-800 p-4 sm:p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl shadow-inner border border-white/20">
                    👨‍🎓
                  </div>
                  <div>
                    {(() => {
                      const namaMentah = selectedSiswaWali.nama || "-";
                      const matchKelas = namaMentah.match(/\[(.*?)\]/);
                      const kelas = matchKelas
                        ? matchKelas[1]
                        : selectedSiswaWali.kelas;
                      const namaBersih = namaMentah
                        .replace(/\s*\[.*?\]\s*/, "")
                        .trim();

                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {namaBersih || "-"}
                          </h3>
                          {kelas && (
                            <span className="rounded-md bg-gradient-to-r from-amber-400 to-yellow-400 px-2 py-0.5 text-[10px] font-black text-amber-950">
                              {kelas}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="mt-1 flex items-center gap-2 text-xs text-blue-200">
                      <span>ID: {selectedSiswaWali.idSiswa || "-"}</span>
                      {selectedSiswaWali.noHp && (
                        <>
                          <span>&bull;</span>
                          <a
                            href={getWhatsAppUrl(selectedSiswaWali.noHp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-300 font-bold hover:underline flex items-center gap-1"
                          >
                            💬 {selectedSiswaWali.noHp}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSiswaWali(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-black text-white hover:bg-black/40 hover:scale-105 active:scale-95 transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800 text-xs sm:text-sm">
              {/* DATA SEKOLAH & MAGANG */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
                <h4 className="font-black text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-blue-900">
                  🏫 Data Magang & Pembimbing
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Guru Pembimbing:
                    </span>
                    <span className="font-bold text-slate-800">
                      {selectedSiswaWali.namaGuru || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Tempat Magang:
                    </span>
                    <span className="font-bold text-slate-800">
                      {selectedSiswaWali.tempatMagang || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DATA KONTAK & ALAMAT */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
                <h4 className="font-black text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-blue-900">
                  📱 Kontak & Alamat
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      No. HP Siswa:
                    </span>
                    {selectedSiswaWali.noHp ? (
                      <a
                        href={getWhatsAppUrl(selectedSiswaWali.noHp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                      >
                        💬 {selectedSiswaWali.noHp} (Buka WhatsApp)
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Belum diisi</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Tempat, Tanggal Lahir:
                    </span>
                    <span className="font-bold text-slate-800">
                      {[
                        selectedSiswaWali.tempatLahir,
                        selectedSiswaWali.tglLahir,
                      ]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Alamat Domisili:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {selectedSiswaWali.alamat || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DATA ORANG TUA */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
                <h4 className="font-black text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-blue-900">
                  👨‍👩‍👧 Data Orang Tua
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-black text-slate-500 uppercase block mb-1">
                      👨 Ayah
                    </span>
                    <p className="font-bold text-slate-800">
                      {selectedSiswaWali.ayah || "-"}
                    </p>
                    {selectedSiswaWali.pekerjaanAyah && (
                      <p className="text-xs text-slate-500">
                        Pekerjaan: {selectedSiswaWali.pekerjaanAyah}
                      </p>
                    )}
                    {selectedSiswaWali.kontakAyah ? (
                      <a
                        href={getWhatsAppUrl(selectedSiswaWali.kontakAyah)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline mt-1"
                      >
                        💬 {selectedSiswaWali.kontakAyah} (Chat WA)
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-0.5">
                        Kontak belum diisi
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-black text-slate-500 uppercase block mb-1">
                      👩 Ibu
                    </span>
                    <p className="font-bold text-slate-800">
                      {selectedSiswaWali.ibu || "-"}
                    </p>
                    {selectedSiswaWali.pekerjaanIbu && (
                      <p className="text-xs text-slate-500">
                        Pekerjaan: {selectedSiswaWali.pekerjaanIbu}
                      </p>
                    )}
                    {selectedSiswaWali.kontakIbu ? (
                      <a
                        href={getWhatsAppUrl(selectedSiswaWali.kontakIbu)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline mt-1"
                      >
                        💬 {selectedSiswaWali.kontakIbu} (Chat WA)
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-0.5">
                        Kontak belum diisi
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* HARAPAN / CITA-CITA (JIKA ADA) */}
              {selectedSiswaWali.harapan && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 block mb-1">
                    🎯 Cita-cita / Harapan Siswa:
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed">
                    {selectedSiswaWali.harapan}
                  </p>
                </div>
              )}
            </div>

            {/* FOOTER MODAL */}
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedSiswaWali(null)}
                className="flex-1 rounded-xl bg-slate-200 hover:bg-slate-300 px-3 py-2.5 text-xs sm:text-sm font-black text-slate-700 transition-all active:scale-98"
              >
                Tutup Profil
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = selectedSiswaWali;
                  setSelectedSiswaWali(null);
                  handleBukaCatatanPerkembangan(s);
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 px-3 py-2.5 text-xs sm:text-sm font-black text-white transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>📝</span>
                <span>Catatan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const match = (selectedSiswaWali.nama || "").match(
                    /\[(.*?)\]/,
                  );
                  const extractedKelas = match
                    ? match[1]
                    : selectedSiswaWali.kelas || "";
                  router.push(
                    `/magang/guru/guru-wali/tambah?editId=${selectedSiswaWali.idSiswa}&kelas=${encodeURIComponent(extractedKelas)}`,
                  );
                }}
                className="flex-1 rounded-xl bg-blue-800 hover:bg-blue-900 px-3 py-2.5 text-xs sm:text-sm font-black text-white transition-all active:scale-98 flex items-center justify-center gap-1.5"
              >
                <span>✏️</span>
                <span>Edit Nama</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CATATAN PERKEMBANGAN MURID (LAMPIRAN B) */}
      {showCatatanModal && siswaCatatanAktif && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200">
            {/* HEADER MODAL */}
            <div className="shrink-0 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 px-4 py-4 sm:px-6 sm:py-5 text-white shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-black uppercase tracking-wider">
                      Lampiran B
                    </span>
                    <h2 className="text-sm sm:text-base font-black">
                      Catatan Perkembangan Murid
                    </h2>
                  </div>
                  <p className="mt-1 text-[11px] sm:text-xs text-indigo-100 font-medium">
                    {(siswaCatatanAktif.nama || "-").replace(
                      /\s*\[.*?\]\s*/,
                      "",
                    )}{" "}
                    &middot;{" "}
                    {(siswaCatatanAktif.nama || "").match(/\[(.*?)\]/)?.[1] ||
                      siswaCatatanAktif.kelas ||
                      "-"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={tutupCatatanModal}
                  className="shrink-0 rounded-xl bg-white/10 hover:bg-white/25 px-2.5 py-1.5 text-xs font-black text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BODY (scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
              {loadingCatatan ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs sm:text-sm font-bold text-slate-500">
                    Memuat catatan perkembangan sebelumnya...
                  </p>
                </div>
              ) : (
                <>
                  {/* INFO GURU WALI */}
                  <div className="rounded-2xl bg-gradient-to-r from-indigo-50/70 to-blue-50/70 border border-indigo-100 p-3 text-xs sm:text-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Guru Wali
                      </span>
                      <p className="font-black text-indigo-950">
                        {siswaCatatanAktif.namaGuru || user?.nama || "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        ID Siswa
                      </span>
                      <p className="font-bold text-slate-700">
                        {siswaCatatanAktif.idSiswa ||
                          siswaCatatanAktif.id ||
                          "-"}
                      </p>
                    </div>
                  </div>

                  {/* PERIODE PEMANTAUAN */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <label className="mb-2 block text-xs sm:text-sm font-black text-slate-800">
                      📅 Periode Pemantauan
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-500">
                          Bulan Awal
                        </span>
                        <input
                          type="month"
                          value={formCatatan.periodeAwal}
                          onChange={(e) =>
                            updateFieldCatatan("periodeAwal", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-500">
                          Bulan Akhir
                        </span>
                        <input
                          type="month"
                          value={formCatatan.periodeAkhir}
                          onChange={(e) =>
                            updateFieldCatatan("periodeAkhir", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                    {formCatatan.periodeAwal && formCatatan.periodeAkhir && (
                      <p className="mt-2 text-[11px] sm:text-xs font-bold text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-lg inline-block">
                        Periode: {formatBulanTahun(formCatatan.periodeAwal)} —{" "}
                        {formatBulanTahun(formCatatan.periodeAkhir)}
                      </p>
                    )}
                  </div>

                  {/* ASPEK PEMANTAUAN */}
                  <div className="space-y-3.5">
                    {ASPEK_PEMANTAUAN.map((aspek) => (
                      <div
                        key={aspek.key}
                        className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs"
                      >
                        <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/40 px-3.5 py-2.5 text-xs sm:text-sm font-black text-indigo-900 border-b border-slate-100 flex items-center justify-between">
                          <span>{aspek.label}</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded">
                            Aspek
                          </span>
                        </div>
                        <div className="p-3.5 space-y-3">
                          <div>
                            <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-600">
                              Deskripsi Perkembangan
                            </span>
                            <textarea
                              rows={2}
                              value={formCatatan[`des${capitalize(aspek.key)}`]}
                              onChange={(e) =>
                                updateFieldCatatan(
                                  `des${capitalize(aspek.key)}`,
                                  e.target.value,
                                )
                              }
                              placeholder={`Tulis deskripsi perkembangan ${aspek.label.toLowerCase()}...`}
                              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
                            />
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-600">
                              Tindak Lanjut yang Dilakukan
                            </span>
                            <textarea
                              rows={2}
                              value={formCatatan[`tin${capitalize(aspek.key)}`]}
                              onChange={(e) =>
                                updateFieldCatatan(
                                  `tin${capitalize(aspek.key)}`,
                                  e.target.value,
                                )
                              }
                              placeholder="Tindakan bimbingan atau solusi yang diberikan..."
                              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
                            />
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-600">
                              Keterangan Tambahan
                            </span>
                            <textarea
                              rows={2}
                              value={formCatatan[`ket${capitalize(aspek.key)}`]}
                              onChange={(e) =>
                                updateFieldCatatan(
                                  `ket${capitalize(aspek.key)}`,
                                  e.target.value,
                                )
                              }
                              placeholder="Keterangan opsional atau catatan khusus..."
                              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* FOOTER */}
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4 flex gap-2.5">
              <button
                type="button"
                onClick={tutupCatatanModal}
                disabled={savingCatatan}
                className="flex-1 rounded-xl bg-white border border-slate-300 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSimpanCatatanPerkembangan}
                disabled={loadingCatatan || savingCatatan}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {savingCatatan ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Simpan Catatan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRESENSI & NILAI MAPEL (POPUP RESPONSIF & PADAT) */}
      {mapelPresensiAktif && (
        <ModalPresensiMapel
          isOpen={!!mapelPresensiAktif}
          onClose={() => setMapelPresensiAktif(null)}
          guru={user}
          mapel={mapelPresensiAktif}
        />
      )}
    </main>
  );
}

// --- JARING PENGAMAN TERAKHIR ---
// Kalau suatu saat ada error runtime tak terduga (bukan cuma dari cache),
// pengguna tidak lagi terjebak layar putih/kosong permanen. Tombol di bawah
// juga membersihkan cache dashboard, jadi kalau penyebabnya cache korup lagi
// di masa depan, pengguna bisa pulih sendiri tanpa harus tahu cara hapus
// data browser secara manual.
class DashboardGuruErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Dashboard Guru crash:", error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("dashboardGuruCache_v2");
      localStorage.removeItem("dashboardGuruCache"); // versi lama, jaga-jaga
    } catch (e) {
      // abaikan
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center max-w-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <h2 className="text-lg font-black text-slate-800 mb-2">
              Gagal Memuat Dashboard
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Terjadi kendala saat menampilkan data. Tekan tombol di bawah untuk
              membersihkan data sementara dan memuat ulang halaman.
            </p>
            <button
              onClick={this.handleReset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              🔄 Muat Ulang Dashboard
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function DashboardGuru() {
  return (
    <DashboardGuruErrorBoundary>
      <DashboardGuruContent />
    </DashboardGuruErrorBoundary>
  );
}

function Card({ title, value, accentColor, textColor, icon, onClick }) {
  const bgMap = {
    "border-indigo-500": "from-indigo-600 via-indigo-700 to-blue-800",
    "border-emerald-500": "from-emerald-500 via-green-600 to-teal-700",
    "border-blue-500": "from-blue-600 via-sky-700 to-indigo-800",
    "border-amber-500": "from-amber-500 via-orange-500 to-amber-700",
  };

  const bg = bgMap[accentColor] || "from-slate-600 to-slate-700";

  return (
    <button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        rounded-3xl
        bg-gradient-to-br ${bg}
        text-white
        p-4
        w-full
        shadow-md
        active:scale-95
        transition-all duration-300
      `}
    >
      {/* Icon + Arrow */}
      <div className="relative flex items-start justify-between">
        <div className="h-11 w-11 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center text-xl shadow">
          {icon}
        </div>

        <div className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold border border-white/20">
          Detail
          <span className="group-hover:translate-x-1 transition-transform">
            →
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="relative mt-5">
        <p className="text-[10px] sm:text-xs uppercase tracking-[2px] text-white/80 font-bold">
          {title}
        </p>

        <h2 className="mt-1 text-3xl sm:text-4xl font-black leading-none">
          {value}
        </h2>
      </div>

      {/* Garis */}
      <div className="relative mt-4 h-1 rounded-full bg-white/20 overflow-hidden">
        <div className="h-full w-0 bg-white group-hover:w-full transition-all duration-500"></div>
      </div>
    </button>
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

function SolidCompactCard({
  title,
  desc,
  icon,
  bgGrad,
  onClick,
  disabled = false,
}) {
  const formatTitleWithBadge = (text) => {
    if (!text) return text;
    const regex = /(PKL|WALI)/gi;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toUpperCase() === "PKL" || part.toUpperCase() === "WALI") {
        return (
          <span
            key={index}
            className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950 font-black shadow-sm border border-amber-200/60 leading-none"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col justify-center min-h-[76px] rounded-xl p-3 text-left transition-all duration-300 overflow-hidden shadow-lg ${
        disabled
          ? "opacity-60 cursor-not-allowed bg-slate-800 text-slate-400 border border-slate-700"
          : `bg-gradient-to-br ${bgGrad} text-white hover:scale-[1.02] active:scale-[0.98]`
      }`}
    >
      <div className="pointer-events-none absolute -bottom-2 -right-2 z-0 flex items-center justify-center opacity-20 transition-transform duration-300 group-hover:rotate-6">
        <span className="text-5xl sm:text-6xl rotate-12 select-none">
          {icon}
        </span>
      </div>

      <div className="relative z-10 w-full space-y-0.5">
        <h4 className="text-xs font-extrabold leading-normal tracking-wide sm:text-sm text-white drop-shadow-sm flex flex-wrap items-center">
          {formatTitleWithBadge(title)}
        </h4>
        <p className="text-[10px] text-white/80 leading-tight sm:text-xs font-medium">
          {desc}
        </p>
      </div>
    </button>
  );
}
