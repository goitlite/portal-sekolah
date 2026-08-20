"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Carousel from "@/components/features/Carousel";

export default function Home() {
  const router = useRouter();

  // State untuk mengontrol Modal
  const [showApkModal, setShowApkModal] = useState(false);
  const [showPcWarningModal, setShowPcWarningModal] = useState(false);

  async function handleMasukAsesmen(e) {
    // Deteksi apakah perangkat menggunakan layar sentuh
    const isTouchDevice =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0);

    // Jika perangkat layar sentuh, munculkan Modal PC, bukan alert bawaan browser
    if (isTouchDevice) {
      setShowPcWarningModal(true);
      return; // Hentikan proses masuk
    }

    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (!isIOS) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (err) {
      console.log("Fullscreen gagal");
    }

    const savedNama = localStorage.getItem("nama");
    const savedKelas = localStorage.getItem("kelas");

    if (savedNama && savedKelas) {
      router.push("/exam");
      return;
    }
    router.push("/login");
  }

  // --- TAMBAHAN: FUNGSI UNTUK BUKA APLIKASI ANDROID ATAU DOWNLOAD ---
  const handleBukaAplikasiAndroid = () => {
    // Skema URI khusus aplikasi Anda (harus disetting di aplikasi Android)
    const appScheme = "asesmensmkn1://buka";

    let appOpened = false;

    // Jika web tiba-tiba tidak fokus (masuk background), berarti aplikasi berhasil dibuka
    const onBlur = () => {
      appOpened = true;
    };
    window.addEventListener("blur", onBlur);

    // 1. Coba panggil/buka aplikasi
    window.location.href = appScheme;

    // 2. Beri waktu tunggu 1.5 detik.
    // Jika lewat 1.5 detik aplikasi tidak terbuka, berarti belum diinstal.
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!appOpened) {
        // Jika gagal buka aplikasi, munculkan Modal Download
        setShowApkModal(true);
      }
    }, 1500);
  };
  // ------------------------------------------------------------------

  // Card Layanan: Base Biru Cerah + Garis Atas Dinamis + Judul Badge + Label "Baru" + Background Icon
  const ServiceCard = ({
    icon,
    title,
    description,
    themeColor,
    isNew,
    onClick,
  }) => {
    // Pilihan warna aksen (Garis atas, efek hover tombol, dan Badge Judul)
    const themes = {
      yellow: {
        border: "border-t-yellow-400",
        hoverBorder: "hover:border-t-yellow-300",
        badgeHover:
          "group-hover:bg-yellow-400 group-hover:text-yellow-950 group-hover:border-yellow-300",
        titleBadge: "bg-yellow-400 text-yellow-950 shadow-yellow-400/50",
      },
      emerald: {
        border: "border-t-emerald-400",
        hoverBorder: "hover:border-t-emerald-300",
        badgeHover:
          "group-hover:bg-emerald-400 group-hover:text-emerald-950 group-hover:border-emerald-300",
        titleBadge: "bg-emerald-400 text-emerald-950 shadow-emerald-400/50",
      },
      orange: {
        border: "border-t-orange-400",
        hoverBorder: "hover:border-t-orange-300",
        badgeHover:
          "group-hover:bg-orange-400 group-hover:text-orange-950 group-hover:border-orange-300",
        titleBadge: "bg-orange-400 text-orange-950 shadow-orange-400/50",
      },
      pink: {
        border: "border-t-pink-400",
        hoverBorder: "hover:border-t-pink-300",
        badgeHover:
          "group-hover:bg-pink-400 group-hover:text-pink-950 group-hover:border-pink-300",
        titleBadge: "bg-pink-400 text-pink-950 shadow-pink-400/50",
      },
      violet: {
        border: "border-t-violet-400",
        hoverBorder: "hover:border-t-violet-300",
        badgeHover:
          "group-hover:bg-violet-400 group-hover:text-white group-hover:border-violet-300",
        titleBadge: "bg-violet-400 text-white shadow-violet-400/50",
      },
      cyan: {
        border: "border-t-cyan-400",
        hoverBorder: "hover:border-t-cyan-300",
        badgeHover:
          "group-hover:bg-cyan-400 group-hover:text-cyan-950 group-hover:border-cyan-300",
        titleBadge: "bg-cyan-400 text-cyan-950 shadow-cyan-400/50",
      },
    };

    const style = themes[themeColor] || themes.yellow;

    return (
      <div className="relative w-full h-full flex">
        {/* Label "Baru" diletakkan di luar struktur button agar bisa menonjol keluar sudut */}
        {isNew && (
          <div className="absolute -top-2.5 -right-2.5 z-20 animate-bounce">
            <span className="bg-rose-500 text-white text-[10px] font-black tracking-widest uppercase px-2 py-1 rounded-full shadow-lg shadow-rose-500/40 border-2 border-white flex items-center justify-center">
              Baru
            </span>
          </div>
        )}

        <button
          onClick={onClick}
          className={`
            group relative text-left 
            bg-gradient-to-br from-cyan-400 via-blue-500 to-blue-600
            border-x border-b border-blue-300/40
            border-t-[4px] ${style.border}
            rounded-2xl p-3.5 sm:p-5 shadow-lg shadow-blue-500/30 
            transition-all duration-300 active:scale-[0.98]
            flex flex-col justify-between w-full
            hover:-translate-y-1.5 hover:shadow-xl hover:shadow-blue-500/40 ${style.hoverBorder}
            overflow-hidden
          `}
        >
          {/* Efek kilau cahaya saat di-hover */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0"></div>

          {/* BACKGROUND ICON BESAR TRANSPARAN DI KIRI */}
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[110px] sm:text-[140px] leading-none opacity-[0.5] z-0 pointer-events-none select-none transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-12">
            {icon}
          </div>

          {/* Konten Utama Card (Berada di atas background icon) */}
          <div className="relative z-10 w-full">
            {/* Icon & Action Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg sm:text-xl bg-white/20 text-white shadow-inner backdrop-blur-md border border-white/30">
                {icon}
              </div>

              {/* Badge menyesuaikan warna tema saat disentuh */}
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border border-white/30 bg-white/10 text-white flex items-center gap-1 backdrop-blur-sm transition-all duration-300 shadow-sm ${style.badgeHover}`}
              >
                Akses
                <span className="group-hover:translate-x-1 transition-transform duration-300">
                  →
                </span>
              </span>
            </div>

            {/* Title Badge (Disesuaikan dengan warna tema) */}
            <div className="mb-2">
              <span
                className={`inline-block text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-md shadow-sm ${style.titleBadge}`}
              >
                {title}
              </span>
            </div>

            {/* Description */}
            <p className="text-[11px] sm:text-xs text-blue-50 leading-relaxed line-clamp-2 font-medium drop-shadow-sm mt-1">
              {description}
            </p>
          </div>
        </button>
      </div>
    );
  };

  return (
    <main
      className="
        min-h-screen
        bg-gradient-to-br
        from-orange-50
        via-amber-50/80
        to-yellow-100/90
        text-stone-800
        font-sans
        overflow-hidden
        relative
        selection:bg-amber-500
        selection:text-white
      "
    >
      {/* Grid Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="h-full w-full bg-[linear-gradient(to_right,#f59e0b_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b_1px,transparent_1px)] bg-[size:44px_44px] opacity-[0.05]" />
      </div>

      {/* Soft Ambient Light Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[950px] h-[450px]
          bg-gradient-to-b from-orange-300/30 via-amber-200/20 to-transparent
          blur-[100px] rounded-full"
        />
        <div
          className="absolute -bottom-24 -left-20 w-[420px] h-[350px]
          bg-yellow-300/25 blur-[90px] rounded-full"
        />
        <div
          className="absolute top-1/4 -right-24 w-[380px] h-[380px]
          bg-amber-400/15 blur-[90px] rounded-full"
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* HERO SECTION */}
        <section className="pt-3 pb-4 sm:pt-8 sm:pb-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
            <div className="grid md:grid-cols-12 gap-5 sm:gap-8 items-center">
              {/* Left Column: Headline */}
              <div className="md:col-span-5 text-center md:text-left z-20 order-2 md:order-1 flex flex-col items-center md:items-start">
                {/* Badge/Label Atas */}
                <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-md border border-amber-200/80 shadow-sm rounded-full px-3.5 py-1.5 mb-4">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-amber-900 text-[11px] font-bold tracking-wider uppercase">
                    Portal Resmi Sekolah
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-stone-900 leading-[1.15] tracking-tight drop-shadow-sm">
                  Sistem Layanan <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-amber-600 via-orange-500 to-amber-600 bg-clip-text text-transparent">
                    Digital Sekolah
                  </span>
                </h1>

                <p className="mt-3 sm:mt-4 text-stone-600/90 text-sm font-medium leading-relaxed max-w-md">
                  Pusat layanan akademik terpadu untuk mendukung pembelajaran,
                  evaluasi, dan presensi secara mandiri dan cepat.
                </p>

                {/* Status Quick Bar - Emas Menyala */}
                <div className="mt-6 w-full grid grid-cols-2 gap-3 text-left bg-gradient-to-r from-yellow-300 via-yellow-400 to-amber-500 p-3.5 rounded-2xl border border-yellow-200 shadow-[0_0_20px_rgba(250,204,21,0.6)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/40 to-transparent pointer-events-none"></div>

                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse"></div>
                    <div>
                      <p className="text-[10px] text-yellow-950/70 font-extrabold uppercase tracking-wider leading-none">
                        Status Server
                      </p>
                      <p className="text-xs font-black text-yellow-950 mt-1 drop-shadow-sm">
                        Online & Normal
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-l-2 border-yellow-500/30 pl-3 relative z-10">
                    <div className="w-3 h-3 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.9)]"></div>
                    <div>
                      <p className="text-[10px] text-yellow-950/70 font-extrabold uppercase tracking-wider leading-none">
                        Instansi
                      </p>
                      <p className="text-xs font-black text-yellow-950 mt-1 truncate drop-shadow-sm">
                        SMKN 1 Teluk Kuantan
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Carousel */}
              <div className="md:col-span-7 order-1 md:order-2 w-full">
                <div className="p-2 bg-white/60 backdrop-blur-lg rounded-[1.5rem] shadow-xl shadow-amber-900/5 border border-amber-100/50 relative">
                  <div className="overflow-hidden rounded-xl aspect-video md:aspect-[16/9] shadow-inner">
                    <Carousel />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES SECTION */}
        <section className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="max-w-7xl mx-auto">
            {/* Header Section Layanan */}
            <div className="flex items-center justify-between mb-4 border-b border-amber-200/50 pb-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-stone-900 flex items-center gap-2">
                  <span className="w-2 h-5 bg-blue-500 rounded-full inline-block shadow-sm shadow-blue-500/50"></span>
                  Layanan Akademik & Siswa
                </h2>
              </div>
              <button
                onClick={async () => {
                  if ("caches" in window) {
                    try {
                      await caches.delete("portal-sekolah-v1");
                    } catch (error) {
                      console.error("Gagal menghapus cache:", error);
                    }
                  }
                  window.location.reload();
                }}
                className="text-[11px] text-white font-bold uppercase tracking-wide flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 px-3 py-1 rounded-full shadow-sm shadow-emerald-500/30 border border-emerald-400 transition-all cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
                Refresh Menu
              </button>
            </div>

            {/* Grid Kartu: 2 kolom di HP, 3 kolom di Tablet/Desktop agar rapi untuk 6 card */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-5">
              {/* Card 1: Asesmen Komputer */}
              <ServiceCard
                icon="💻"
                title="Asesmen Online Komputer"
                description="Asesmen anti curang untuk PC / Komputer"
                themeColor="yellow"
                onClick={handleMasukAsesmen}
              />

              {/* --- Card 2: Asesmen Android (DIUBAH FUNGSI ONCLICK-NYA DI SINI) --- */}
              <ServiceCard
                icon="📱"
                title="Asesmen Online Android"
                description="Asesmen anti curang untuk smartphone Android"
                themeColor="cyan"
                isNew={true}
                onClick={handleBukaAplikasiAndroid}
              />
              {/* ------------------------------------------------------------------- */}

              {/* Card 3: Presensi Kelas */}
              <ServiceCard
                icon="📋"
                title="Presensi Kelas"
                description="Pencatatan kehadiran siswa harian."
                themeColor="emerald"
                onClick={() => router.push("/presensi")}
              />

              {/* Card 4: Presensi Magang */}
              <ServiceCard
                icon="💼"
                title="Portal Magang/Guru Wali/Kelulusan"
                description="Monitoring jurnal & kehadiran PKL Beserta Guru Wali/Kelulusan."
                themeColor="orange"
                isNew={true}
                onClick={() => router.push("/magang/login")}
              />

              {/* Card 5: Video Belajar */}
              <ServiceCard
                icon="▶️"
                title="Video Belajar"
                description="Kumpulan materi video interaktif."
                themeColor="pink"
                onClick={() =>
                  window.open(
                    "https://tjktsmkn1telukkuantan.web.id/video-belajar/",
                    "_blank",
                  )
                }
              />

              {/* Card 6: Materi Belajar */}
              <ServiceCard
                icon="📚"
                title="Materi Belajar"
                description="Modul & e-book pembelajaran."
                themeColor="violet"
                onClick={() =>
                  window.open(
                    "https://tjktsmkn1telukkuantan.web.id/buku-belajar/",
                    "_blank",
                  )
                }
              />
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="mt-auto py-6 text-center text-stone-500 text-xs font-medium w-full border-t border-amber-200/50 bg-white/30 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4">
            <p className="text-stone-800 font-bold tracking-wide">
              © 2026 SMKN 1 TELUK KUANTAN
            </p>
            <p className="text-[11px] text-stone-500 mt-1">
              Sistem Layanan Sekolah Digital • Terintegrasi & Responsif
            </p>
          </div>
        </footer>

        {/* ------------------------------------------------------------- */}
        {/* MODAL 1: POPUP PERINGATAN AKSES PC (Untuk Asesmen Komputer)   */}
        {/* ------------------------------------------------------------- */}
        {showPcWarningModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-rose-200 relative overflow-hidden flex flex-col items-center text-center">
              {/* Ikon Peringatan Besar */}
              <div className="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center text-3xl mb-4 shadow-inner border border-rose-200">
                ⚠️
              </div>

              <h3 className="font-extrabold text-stone-900 text-lg mb-2">
                Akses Ditolak
              </h3>

              <p className="text-sm font-medium text-stone-600 mb-6 leading-relaxed">
                Asesmen ini hanya bisa diakses menggunakan{" "}
                <strong>PC/Komputer</strong>. <br />
                <br />
                Jika Anda menggunakan smartphone, silakan gunakan menu{" "}
                <strong>Asesmen Online Android</strong>.
              </p>

              {/* Tombol Aksi */}
              <button
                onClick={() => setShowPcWarningModal(false)}
                className="w-full py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 active:bg-stone-300 text-stone-700 font-extrabold text-sm transition-colors border border-stone-200"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* MODAL 2: POPUP UPDATE APLIKASI ANDROID                        */}
        {/* ------------------------------------------------------------- */}
        {showApkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-amber-200 relative overflow-hidden">
              {/* Header Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl p-2 bg-cyan-100 rounded-xl">
                    📱
                  </span>
                  <div>
                    <h3 className="font-extrabold text-stone-900 text-base sm:text-lg leading-tight">
                      Update Aplikasi Asesmen
                    </h3>
                    <p className="text-[11px] font-bold text-cyan-600">
                      Versi Terbaru (V3)
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowApkModal(false)}
                  className="text-stone-400 hover:text-stone-700 text-xl font-bold w-8 h-8 rounded-lg hover:bg-stone-100 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* List Keterangan Update */}
              <div className="my-4 space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                <p className="text-xs font-bold text-stone-700 mb-2">
                  Pembaruan & Fitur Terbaru:
                </p>
                <ol className="space-y-2 text-xs text-stone-600 font-medium">
                  <li className="flex items-start gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="bg-amber-400 text-amber-950 font-black rounded-md w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>
                      Sudah menggunakan nomor ID untuk mendaftar ujian
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="bg-amber-400 text-amber-950 font-black rounded-md w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>Sudah bisa hapus akun</span>
                  </li>
                  <li className="flex items-start gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="bg-amber-400 text-amber-950 font-black rounded-md w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Timer waktu kirim jawaban bisa dimatikan dari admin
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="bg-amber-400 text-amber-950 font-black rounded-md w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <span>Pendeteksi kendala jaringan saat ujian</span>
                  </li>
                  <li className="flex items-start gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="bg-amber-400 text-amber-950 font-black rounded-md w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      5
                    </span>
                    <span>
                      Tidak bisa keluar aplikasi saat ujian lebih stabil
                    </span>
                  </li>
                  <li className="flex items-start gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="bg-amber-400 text-amber-950 font-black rounded-md w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      6
                    </span>
                    <span>Pencatatan kecurangan lebih stabil</span>
                  </li>
                  <li className="flex items-start gap-2 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/60">
                    <span className="bg-amber-400 text-amber-950 font-black rounded-md w-5 h-5 flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      7
                    </span>
                    <span>Fitur pesan pengaduan lebih stabil</span>
                  </li>
                </ol>
              </div>

              {/* Tombol Aksi */}
              <div className="pt-3 border-t border-stone-200 flex gap-2.5">
                <button
                  onClick={() => setShowApkModal(false)}
                  className="w-1/3 py-2.5 px-3 rounded-xl border border-stone-300 text-stone-700 font-bold text-xs hover:bg-stone-100 active:bg-stone-200 transition-colors"
                >
                  Batal
                </button>
                <a
                  href="https://drive.google.com/file/d/1kE8mZUbzQcrsRgdQs7H99lX_4DHDBE7F/view?usp=drive_link"
                  onClick={() => setShowApkModal(false)}
                  className="w-2/3 py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-extrabold text-xs text-center shadow-md shadow-blue-500/30 transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  <span>Download APK</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
