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

  const ServiceCard = ({ icon, title, description, color, onClick }) => {
    // Mapping warna diadaptasi dari style gradien pada Dashboard Guru
    const bgMap = {
      blue: "from-blue-600 via-sky-700 to-indigo-800 shadow-blue-500/30",
      emerald:
        "from-emerald-500 via-green-600 to-teal-700 shadow-emerald-500/30",
      amber: "from-amber-500 via-orange-500 to-amber-700 shadow-orange-500/30",
      pink: "from-pink-500 via-rose-500 to-pink-700 shadow-pink-500/30",
      violet:
        "from-violet-500 via-purple-600 to-indigo-700 shadow-violet-500/30",
    };

    // Default fallback jika warna tidak ditemukan
    const bg =
      bgMap[color] || "from-slate-600 to-slate-700 shadow-slate-500/30";

    return (
      <button
        onClick={onClick}
        className={`
        group relative overflow-hidden
        rounded-3xl
        bg-gradient-to-br ${bg}
        text-white
        p-5
        w-full
        text-left
        shadow-xl
        active:scale-95
        hover:-translate-y-1
        transition-all duration-300
      `}
      >
        {/* Efek Glow Bulat di Kanan Atas */}
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-white/10 blur-3xl"></div>

        {/* Icon + Label "Buka Layanan" dengan style kaca (Backdrop Blur)[cite: 1] */}
        <div className="relative flex items-start justify-between">
          <div className="h-12 w-12 rounded-2xl bg-white/20 backdrop-blur border border-white/20 flex items-center justify-center text-2xl shadow">
            {icon}
          </div>

          <div className="rounded-full bg-white/20 backdrop-blur px-3 py-1.5 text-[10px] font-bold border border-white/20 flex items-center gap-1">
            Buka Layanan
            <span className="group-hover:translate-x-1 transition-transform">
              →
            </span>
          </div>
        </div>

        {/* Title & Deskripsi */}
        <div className="relative mt-6">
          <h2 className="text-xl sm:text-2xl font-black leading-tight mb-1.5">
            {title}
          </h2>
          <p className="text-xs sm:text-sm text-white/80 font-medium leading-relaxed">
            {description}
          </p>
        </div>

        {/* Animasi Garis Bawah saat Hover[cite: 1] */}
        <div className="relative mt-5 h-1 rounded-full bg-white/20 overflow-hidden">
          <div className="h-full w-0 bg-white group-hover:w-full transition-all duration-500"></div>
        </div>
      </button>
    );
  };

  return (
    <main className="min-h-screen bg-amber-50 overflow-hidden text-amber-950">
      {/* BACKGROUND EFFECT (Nuansa Emas) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-200 rounded-full blur-3xl opacity-50"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-yellow-200 rounded-full blur-3xl opacity-40"></div>
      </div>

      <div className="relative z-10">
        <Navbar />

        <section className="relative pt-6 pb-12 md:pt-10 md:pb-20">
          <div className="max-w-7xl mx-auto px-5">
            <div className="grid md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-5 text-center md:text-left z-20 order-2 md:order-1">
                <div className="inline-flex items-center gap-2 bg-white border border-amber-200 shadow-sm rounded-full px-4 py-1.5 mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span className="text-amber-900 text-xs md:text-sm font-bold tracking-wide">
                    Portal Digital Sekolah Modern
                  </span>
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-amber-950 leading-tight tracking-tighter">
                  SISTEM
                  <span className="block bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent">
                    ASESMEN
                  </span>
                  ONLINE
                </h1>

                <p className="mt-6 text-amber-900/70 text-lg font-medium leading-relaxed max-w-lg mx-auto md:mx-0">
                  Platform evaluasi belajar digital modern yang cepat,
                  integritas, dan responsif untuk mendukung prestasi siswa.
                </p>

                <div className="mt-10 flex flex-wrap gap-4 justify-center md:justify-start">
                  <button
                    onClick={handleMasukAsesmen}
                    className="
                      group relative overflow-hidden bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-amber-500/30 transition-all duration-300 hover:scale-105 hover:shadow-amber-500/50
                    "
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      噫 Masuk Asesmen Siswa
                    </span>
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition"></div>
                  </button>
                </div>
              </div>

              <div className="md:col-span-7 order-1 md:order-2">
                <div className="relative p-2 bg-white rounded-3xl shadow-[0_20px_70px_rgba(180,83,9,0.1)] border border-amber-100">
                  <div className="overflow-hidden rounded-2xl aspect-[16/10]">
                    <Carousel />
                  </div>
                  <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-amber-400 rounded-2xl -z-10 animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-5 py-16 md:py-24 bg-white rounded-[3rem] shadow-[0_-10px_60px_rgba(217,119,6,0.03)] border border-amber-100">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold uppercase tracking-wider mb-3 border border-amber-100">
              Layanan Terintegrasi
            </div>
            <h2 className="text-3xl md:text-5xl font-black text-amber-950 tracking-tight">
              Layanan Digital Sekolah
            </h2>
            <p className="text-amber-900/70 mt-5 max-w-2xl mx-auto leading-relaxed font-medium text-lg">
              Akses berbagai layanan pembelajaran dan administrasi modern dalam
              satu portal yang elegan dan responsif.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <ServiceCard
              icon="💻" // Diganti dari "統" menjadi emoji Laptop/Komputer
              title="Asesmen Online"
              description="Sistem ujian digital modern dengan akses cepat dan integritas tinggi."
              color="blue"
              onClick={handleMasukAsesmen}
            />
            <ServiceCard
              icon="📋" // Diganti dari "搭" menjadi emoji Papan Jalan/Clipboard
              title="Presensi Kelas"
              description="Pencatatan kehadiran siswa secara realtime dan terintegrasi sistem."
              color="emerald"
              onClick={() => router.push("/presensi")}
            />
            <ServiceCard
              icon="💼" // Tetap dipertahankan karena sudah terbaca jelas
              title="Presensi Magang"
              description="Monitoring kehadiran dan jurnal harian siswa PKL / Magang."
              color="amber"
              onClick={() => router.push("/magang/login")}
            />
            <ServiceCard
              icon="▶️" // Diganti dari "磁" menjadi emoji Tombol Play
              title="Video Belajar"
              description="Akses ribuan konten video pembelajaran interaktif kapan saja."
              color="pink"
              onClick={() => console.log("Video")}
            />
            <ServiceCard
              icon="📚" // Diganti dari "答" menjadi emoji Tumpukan Buku
              title="Materi Belajar"
              description="Kumpulan modul dan materi digital lengkap pendukung belajar."
              color="violet"
              onClick={() => console.log("Materi")}
            />
          </div>
        </section>

        <footer className="py-10 text-center text-amber-700/60 text-sm font-medium">
          <div className="max-w-7xl mx-auto px-5 border-t border-amber-100 pt-10">
            <p>© 2024 SMKN 1 TELUK KUANTAN. All rights reserved.</p>
            <p className="text-xs mt-1 text-amber-600/50">
              Portal Digital Sekolah Modern v2.0
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
