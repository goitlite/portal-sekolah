"use client";

import { useRouter } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import Carousel from "@/components/features/Carousel";

export default function Home() {
  const router = useRouter();

  async function handleMasukAsesmen() {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      // fullscreen selain iPhone
      if (!isIOS) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (err) {
      console.log("Fullscreen gagal");
    }

    // =========================
    // AUTO LOGIN SESSION
    // =========================
    const savedNama = localStorage.getItem("nama");

    const savedKelas = localStorage.getItem("kelas");

    // jika pernah login
    if (savedNama && savedKelas) {
      router.push("/exam");

      return;
    }

    // jika belum login
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 overflow-hidden">
      {/* BACKGROUND EFFECT */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>

        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl"></div>

        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* CONTENT */}
      <div className="relative z-10">
        <Navbar />

        {/* HERO */}
        <section className="relative">
          <Carousel />

          {/* OVERLAY */}
          <div className="absolute inset-0 bg-black/40"></div>

          {/* TEXT */}
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="text-center max-w-4xl">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md rounded-full px-5 py-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>

                <span className="text-white text-sm font-medium tracking-wide">
                  Portal Digital Sekolah Modern
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight drop-shadow-2xl">
                SISTEM
                <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                  {" "}
                  ASESMEN{" "}
                </span>
                ONLINE
              </h1>

              <div className="mt-10 flex flex-wrap gap-4 justify-center">
                <button
                  onClick={handleMasukAsesmen}
                  className="
                    group
                    relative
                    overflow-hidden
                    bg-gradient-to-r
                    from-blue-600
                    to-cyan-500
                    hover:from-blue-500
                    hover:to-cyan-400
                    text-white
                    px-10
                    py-4
                    rounded-2xl
                    font-bold
                    text-lg
                    shadow-2xl
                    transition-all
                    duration-300
                    hover:scale-105
                    hover:shadow-cyan-500/30
                  "
                >
                  <span className="relative z-10">🚀 Masuk Asesmen</span>

                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition"></div>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* MENU PORTAL */}
        <section className="max-w-6xl mx-auto px-5 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-black text-white mb-4">
              Layanan Digital Sekolah
            </h2>

            <p className="text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Akses berbagai layanan pembelajaran modern dalam satu portal
              digital sekolah yang cepat, elegan, dan responsif.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* ASESMEN */}
            <button
              onClick={handleMasukAsesmen}
              className="
        group
        bg-white/10
        border
        border-white/10
        backdrop-blur-xl
        rounded-3xl
        p-6
        shadow-2xl
        hover:scale-[1.03]
        transition-all
        duration-300
        text-left
      "
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-3xl shadow-lg mb-5">
                📝
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Asesmen Online
              </h3>

              <p className="text-gray-300 text-sm leading-relaxed">
                Sistem ujian digital modern dengan akses cepat dan tampilan
                responsif.
              </p>
            </button>

            {/* PRESENSI */}
            <button
              onClick={() => router.push("/presensi")}
              className="
    group
    bg-white/10
    border
    border-white/10
    backdrop-blur-xl
    rounded-3xl
    p-6
    shadow-2xl
    hover:scale-[1.03]
    transition-all
    duration-300
    text-left
  "
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center text-3xl shadow-lg mb-5">
                📋
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Presensi Kelas
              </h3>

              <p className="text-gray-300 text-sm leading-relaxed">
                Presensi digital siswa secara realtime dan terintegrasi.
              </p>
            </button>

            {/* VIDEO */}
            <button
              className="
        group
        bg-white/10
        border
        border-white/10
        backdrop-blur-xl
        rounded-3xl
        p-6
        shadow-2xl
        hover:scale-[1.03]
        transition-all
        duration-300
        text-left
      "
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-400 flex items-center justify-center text-3xl shadow-lg mb-5">
                🎥
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Video Belajar
              </h3>

              <p className="text-gray-300 text-sm leading-relaxed">
                Akses video pembelajaran interaktif kapan saja dan dimana saja.
              </p>
            </button>

            {/* MATERI */}
            <button
              className="
        group
        bg-white/10
        border
        border-white/10
        backdrop-blur-xl
        rounded-3xl
        p-6
        shadow-2xl
        hover:scale-[1.03]
        transition-all
        duration-300
        text-left
      "
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-400 flex items-center justify-center text-3xl shadow-lg mb-5">
                📚
              </div>

              <h3 className="text-xl font-bold text-white mb-3">
                Materi Belajar
              </h3>

              <p className="text-gray-300 text-sm leading-relaxed">
                Kumpulan materi digital lengkap untuk mendukung pembelajaran
                siswa.
              </p>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
