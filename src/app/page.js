"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Carousel from "@/components/features/Carousel";

export default function Home() {
  const router = useRouter();

  async function handleMasukAsesmen(e) {
    // Deteksi apakah perangkat menggunakan layar sentuh
    const isTouchDevice =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0);

    if (isTouchDevice) {
      alert(
        "Asesmen ini hanya untuk PC gunakan aplikasi asesmen Android UNTUK MELANJUTKAN Asesmen menggunakan pc",
      );
      return; // Hentikan proses masuk jika menggunakan layar sentuh
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
              <span className="text-[11px] text-amber-700/70 font-semibold uppercase tracking-wide hidden sm:inline bg-amber-100/50 px-3 py-1 rounded-full">
                Pilih menu untuk melanjutkan
              </span>
            </div>

            {/* Grid Kartu: 2 kolom di HP, 3 kolom di Tablet/Desktop agar rapi untuk 6 card */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-5">
              {/* Card 1: Asesmen Komputer */}
              <ServiceCard
                icon="💻"
                title="Asesmen Online Komputer"
                description="Ujian digital terstruktur dan aman."
                themeColor="yellow"
                onClick={handleMasukAsesmen}
              />

              {/* Card 2: Asesmen Android (Baru Ditambahkan) */}
              <ServiceCard
                icon="📱"
                title="Asesmen Online Android"
                description="update : Timer kirim bisa di non aktifkan dari admin"
                themeColor="cyan"
                isNew={true}
                onClick={() =>
                  (window.location.href =
                    "https://tjktsmkn1telukkuantan.web.id/wp-content/uploads/upf-docs/ASESMEN%20ANDROID.apk")
                }
              />

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
                title="Presensi Magang"
                description="Monitoring jurnal & kehadiran PKL."
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
      </div>
    </main>
  );
}
