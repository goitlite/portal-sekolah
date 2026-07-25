"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Carousel from "@/components/features/Carousel";

export default function Home() {
  const router = useRouter();

  async function handleMasukAsesmen() {
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

  // Card Layanan: Desain Terang, Formal, dan Ringkas
  const ServiceCard = ({ icon, title, description, color, onClick }) => {
    const colorStyles = {
      blue: {
        accent: "border-t-blue-600",
        iconBg: "bg-blue-600 text-white shadow-blue-500/20",
        badge: "bg-blue-50 text-blue-700 border-blue-200",
        hoverBorder: "hover:border-blue-300",
      },
      emerald: {
        accent: "border-t-emerald-600",
        iconBg: "bg-emerald-600 text-white shadow-emerald-500/20",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
        hoverBorder: "hover:border-emerald-300",
      },
      amber: {
        accent: "border-t-amber-500",
        iconBg: "bg-amber-500 text-white shadow-amber-500/20",
        badge: "bg-amber-50 text-amber-800 border-amber-200",
        hoverBorder: "hover:border-amber-300",
      },
      pink: {
        accent: "border-t-rose-500",
        iconBg: "bg-rose-500 text-white shadow-rose-500/20",
        badge: "bg-rose-50 text-rose-700 border-rose-200",
        hoverBorder: "hover:border-rose-300",
      },
      violet: {
        accent: "border-t-indigo-600",
        iconBg: "bg-indigo-600 text-white shadow-indigo-500/20",
        badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
        hoverBorder: "hover:border-indigo-300",
      },
    };

    const style = colorStyles[color] || colorStyles.blue;

    return (
      <button
        onClick={onClick}
        className={`
          group relative text-left bg-white border border-slate-200/90
          rounded-2xl p-3.5 sm:p-5 shadow-sm hover:shadow-md
          transition-all duration-200 active:scale-[0.98]
          flex flex-col justify-between w-full border-t-4 ${style.accent} ${style.hoverBorder}
        `}
      >
        <div>
          {/* Icon & Action Badge */}
          <div className="flex items-center justify-between mb-3">
            <div
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center text-lg sm:text-xl shadow-sm ${style.iconBg}`}
            >
              {icon}
            </div>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${style.badge} flex items-center gap-1`}
            >
              Akses
              <span className="group-hover:translate-x-0.5 transition-transform">
                →
              </span>
            </span>
          </div>

          {/* Title & Description */}
          <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug group-hover:text-amber-600 transition-colors">
            {title}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2 font-normal">
            {description}
          </p>
        </div>
      </button>
    );
  };

  return (
    <main
      className="
    min-h-screen
    bg-gradient-to-br
    from-white
    via-amber-50
    to-yellow-100/70
    text-slate-800
    font-sans
    overflow-hidden
    relative
    selection:bg-amber-500
    selection:text-white
  "
    >
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none">
        <div className="h-full w-full bg-[linear-gradient(to_right,#475569_1px,transparent_1px),linear-gradient(to_bottom,#475569_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>
      {/* Soft Ambient Light Background */}
      {/* Elegant Golden Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Cahaya utama */}
        <div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[950px] h-[420px]
      bg-gradient-to-b
      from-yellow-200/45
      via-amber-100/25
      to-transparent
      blur-3xl rounded-full"
        />

        {/* Cahaya kiri bawah */}
        <div
          className="absolute -bottom-24 -left-20 w-[420px] h-[320px]
      bg-yellow-100/30
      blur-3xl rounded-full"
        />

        {/* Cahaya kanan */}
        <div
          className="absolute top-1/3 -right-24 w-[380px] h-[280px]
      bg-amber-100/25
      blur-3xl rounded-full"
        />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* HERO SECTION */}
        <section className="pt-3 pb-4 sm:pt-6 sm:pb-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
            <div className="grid md:grid-cols-12 gap-4 sm:gap-6 items-center">
              {/* Left Column: Headline */}
              <div className="md:col-span-5 text-center md:text-left z-20 order-2 md:order-1 flex flex-col items-center md:items-start">
                <div className="inline-flex items-center gap-2 bg-white border border-amber-200/80 shadow-xs rounded-full px-3 py-1 mb-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-slate-700 text-[11px] font-semibold tracking-wide uppercase">
                    Portal Resmi Sekolah
                  </span>
                </div>

                <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight tracking-tight">
                  Sistem Layanan <br className="hidden sm:inline" />
                  <span className="bg-gradient-to-r from-amber-600 to-amber-800 bg-clip-text text-transparent">
                    Digital Sekolah
                  </span>
                </h1>

                <p className="mt-2 sm:mt-3 text-slate-600 text-xs sm:text-sm font-medium leading-relaxed max-w-md">
                  Pusat layanan akademik terpadu untuk mendukung pembelajaran,
                  evaluasi, dan presensi secara mandiri dan cepat.
                </p>

                {/* Status Quick Bar (Mengisi area kosong secara formal) */}
                <div className="mt-4 w-full grid grid-cols-2 gap-2 text-left bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium leading-none">
                        Status Server
                      </p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">
                        Online & Normal
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-l border-slate-100 pl-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-medium leading-none">
                        Instansi
                      </p>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5 truncate">
                        SMKN 1 Teluk Kuantan
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Carousel */}
              <div className="md:col-span-7 order-1 md:order-2 w-full">
                <div className="p-1.5 sm:p-2 bg-white rounded-2xl shadow-sm border border-slate-200/80">
                  <div className="overflow-hidden rounded-xl aspect-video md:aspect-[16/9]">
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
            <div className="flex items-center justify-between mb-3 border-b border-slate-200/60 pb-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-1.5 h-4 bg-amber-500 rounded-full inline-block"></span>
                  Layanan Akademik & Siswa
                </h2>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                Pilih menu untuk melanjutkan
              </span>
            </div>

            {/* Grid Kartu: 2 Kolom di HP, Compact & Rapi */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
              <ServiceCard
                icon="💻"
                title="Asesmen Online"
                description="Ujian digital terstruktur dan aman."
                color="blue"
                onClick={handleMasukAsesmen}
              />
              <ServiceCard
                icon="📋"
                title="Presensi Kelas"
                description="Pencatatan kehadiran siswa harian."
                color="emerald"
                onClick={() => router.push("/presensi")}
              />
              <ServiceCard
                icon="💼"
                title="Presensi Magang"
                description="Monitoring jurnal & kehadiran PKL."
                color="amber"
                onClick={() => router.push("/magang/login")}
              />
              <ServiceCard
                icon="▶️"
                title="Video Belajar"
                description="Kumpulan materi video interaktif."
                color="pink"
                onClick={() =>
                  window.open(
                    "https://tjktsmkn1telukkuantan.web.id/video-belajar/",
                    "_blank",
                  )
                }
              />
              <ServiceCard
                icon="📚"
                title="Materi Belajar"
                description="Modul & e-book pembelajaran."
                color="violet"
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
        <footer className="mt-auto py-5 text-center text-slate-500 text-xs font-medium w-full border-t border-slate-200/80 bg-white">
          <div className="max-w-7xl mx-auto px-4">
            <p className="text-slate-700 font-semibold">
              © 2026 SMKN 1 TELUK KUANTAN
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sistem Layanan Sekolah Digital • Terintegrasi & Responsif
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
