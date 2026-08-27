"use client";

import React, { useEffect, useState } from "react";
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
} from "../lib/api";
import { generateLaporanGuruWaliPDF } from "./guru-wali/generateLaporanGuruWaliPDF";
import CetakLaporanGuruWaliModal from "./guru-wali/CetakLaporanGuruWaliModal";
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
    tanggalPelaksanaan: "16 - 17 Agustus 2026",
    pelaksanaKegiatan: "Panitia PKL SMKN 1 Teluk Kuantan",
    namaKegiatan: "Monitoring Siswa PKL 2026",
    tujuanKegiatan: "Melakukan Monitoring Siswa PKL 2026",
    sasaranKegiatan: "Siswa PKL 2026 SMKN 1 Teluk Kuantan",
    prosesKegiatan:
      "Kegiatan Monitoring siswa Praktik Kerja Lapangan (PKL) SMKN 1 Teluk Kuantan Tahun Pelajaran 2026/2027 dilaksanakan pada tanggal 16–17 Juli 2026 di Pekanbaru. Diawali dengan monitoring lapangan ke PT. Telkom Pekanbaru dan kemudian PT. Mayatama Pekanbaru. Dalam Kegiatan tersebut guru pembimbing Memantau perkembangan kompetensi yang dicapai, jurnal dan berbagai permasalahan yang dihadapi siswa serta berkoordinasi Bersama pihak pihak dunia usaha dan dunia industri (DUDI) menyangkut perkembangan siswa di Tempat PKL",
    hasilKegiatan:
      "Kegiatan Monitoring siswa PKL berjalan sesuai dengan rencana. Seluruh siswa PKL mampu beradaptasi di lingkungan dunia usaha dan dunia industri (DUDI) sehingga diharapkan memberikan pengalaman kerja yang bermanfaat bagi peserta siswa",
    saranSaran:
      "Diperlukan kerja sama dengan DUDI yang lebih banyak lagi dan profesional sebagai mitra strategis dalam mendukung peningkatan kompetensi peserta didik.",
    tanggalTtd: tanggalOtomatisInit, // <-- Form akan terisi secara otomatis mengikuti tanggal hari ini
  });

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

  useEffect(() => {
    let isMounted = true;

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

      if (isMounted) {
        setUser(session);
      }

      // 1. LOAD CACHE
      const cachedDataStr = localStorage.getItem(CACHE_KEY);

      if (cachedDataStr && isMounted) {
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

      // 2. FETCH DATA PARALEL
      try {
        const [result, tempat, aktivitasResult] = await Promise.allSettled([
          getDashboardGuru(session.id),
          getTempatMagangGuru(session.id),
          getAktivitasGuru(session.id),
        ]);

        if (!isMounted) return;

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
          aktivitasResult.status === "fulfilled" &&
          aktivitasResult.value?.success
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

          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(serverData));
          } catch (cacheErr) {
            // Beberapa browser mobile punya kuota localStorage kecil.
            // Gagal cache tidak boleh menghentikan render dashboard.
            console.warn("Cache dashboard dilewati (kuota penuh?):", cacheErr);
          }
        } else if (!cachedDataStr) {
          alert("Data dashboard tidak ditemukan.");
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [router]);

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

  // --- AMBIL DAFTAR SISWA WALI (untuk pilihan cetak Lampiran A & B) ---
  const fetchDaftarSiswaWaliDashboard = async () => {
    if (!user?.id) return [];
    const result = await getDataSiswaWali(user.id);
    if (!result?.success) {
      console.warn("Gagal mengambil daftar siswa wali:", result?.message);
      return [];
    }
    return result.data || [];
  };

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-base font-bold text-slate-600 tracking-wide">
            Menyinkronkan Dashboard Guru...
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
        </div>

        {/* MONITORING LAPANGAN */}
        <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FCE7A4] to-[#F3D36B] p-5 sm:p-6 shadow-[0_12px_35px_rgba(212,175,55,0.22)] border border-[#D9B44A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9B44A]/40 pb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                📸 Monitoring Lapangan
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-amber-900/70">
                Pilih area penempatan aktif untuk meninjau log presensi mandiri
                siswa.
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
              handleCardClick("Daftar Jumlah Siswa", dashboard?.listJumlahSiswa)
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
              handleCardClick("Log Total Kehadiran", dashboard?.listTotalHadir)
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
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowCetakModal(false)}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-colors"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  if (includeCetakJurnalPkl) {
                    await handleCetakJurnalPkl();
                  }

                  // Simpan form ke localStorage
                  localStorage.setItem(
                    "dataPernyataanMutlak",
                    JSON.stringify({
                      nama: user?.nama,
                      ...formDataCetak,
                    }),
                  );

                  if (includePerjalananDinas) {
                    localStorage.setItem(
                      "dataPerjalananDinas",
                      JSON.stringify(formPerjalananDinas),
                    );
                  } else {
                    localStorage.removeItem("dataPerjalananDinas");
                  }

                  // Logika pindah halaman yang asli
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

                  localStorage.setItem("targetTempatRekap", "Semua");
                  localStorage.setItem("targetGuruRekap", user.id);
                  localStorage.setItem("targetBulanRekap", bulanTerbaru);

                  window.location.href = "/magang/rekap?source=dashboard_guru";
                }}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-200"
              >
                Lanjutkan Cetak
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
