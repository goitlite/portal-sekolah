import Link from "next/link";
import Image from "next/image";
import InstallPrompt from "@/components/pwa/InstallPrompt";

export default function MagangHome() {
  return (
    // Background Layar Utama (Slate Abu-abu Netral)
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-5 py-10 antialiased">
      {/* CARD BUNGKUSAN UTAMA */}
      <div className="w-full max-w-md overflow-hidden rounded-[32px] shadow-[0_25px_60px_rgba(15,23,42,0.15)] border border-slate-200 transform transition-all duration-700 animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
        {/* 1. HEADER: Gradasi Kuning Emas ke Amber Matang */}
        <div className="relative bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 px-6 pt-10 pb-8 text-center overflow-hidden">
          {/* Efek kilauan cahaya tipis */}
          <div className="absolute -top-24 -left-20 w-64 h-64 rounded-full bg-white/20 blur-2xl pointer-events-none"></div>

          {/* Bingkai Logo Putih Solid */}
          <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-2xl bg-white p-[3px] shadow-lg shadow-amber-700/40 transform transition-all duration-500 hover:scale-105 hover:rotate-2">
            <div className="w-full h-full bg-slate-50 rounded-xl flex items-center justify-center border border-amber-200">
              <Image
                src="/logo.png"
                alt="Logo SMKN 1 Teluk Kuantan"
                width={65}
                height={65}
                className="priority opacity-95"
                priority
              />
            </div>
          </div>

          {/* TULISAN UTAMA: Menggunakan warna Putih Bersih dengan warna tepi (stroke) Biru Navy/Hitam Gelap */}
          <h1
            className="text-xl md:text-2xl font-black tracking-wide text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]"
            style={{ WebkitTextStroke: "1.5px #020617" }}
          >
            PRESENSI MAGANG ONLINE
          </h1>

          {/* Badge Nama Sekolah: Diganti ke Biru Navy Gelap Premium (Bukan Hitam) */}
          <div className="mt-3 inline-block rounded-full bg-blue-950 px-4 py-1 shadow-md border border-blue-900">
            <p className="text-[11px] font-extrabold tracking-widest text-amber-400 uppercase">
              SMKN 1 TELUK KUANTAN
            </p>
          </div>

          {/* Sub-judul: Diganti ke Biru Navy Gelap untuk kesan mewah dan kontras tinggi */}
          <p className="mt-3 text-xs font-black text-blue-950 tracking-wide uppercase opacity-90 drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]">
            Teknik Jaringan Komputer dan Telekomunikasi
          </p>
        </div>

        {/* 2. KONTEN BAWAH HEADER: Gradasi Hijau Emerald Pekat ke Teal Tua */}
        <div className="p-6 md:p-8 space-y-5 bg-gradient-to-b from-emerald-600 via-emerald-700 to-teal-800">
          <p className="text-center text-xs md:text-sm text-emerald-50 leading-relaxed max-w-xs mx-auto mb-2 opacity-90">
            Sistem pencatatan kehadiran prakerin berbasis verifikasi{" "}
            <span className="font-extrabold text-amber-300">Lokasi GPS</span>{" "}
            dan{" "}
            <span className="font-extrabold text-amber-300">
              Dokumentasi Aktivitas
            </span>{" "}
            secara riil.
          </p>

          {/* List Fitur Bergradasi Biru Ocean */}
          <div className="space-y-3.5">
            {/* Fitur 1 */}
            <div className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-950 p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 cursor-pointer border border-white/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white text-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-slate-900 group-hover:shadow-md group-hover:shadow-amber-400/20">
                📷
              </div>
              <div>
                <h2 className="text-xs md:text-sm font-bold text-white tracking-wide">
                  Verifikasi Kamera & Gambar
                </h2>
                <p className="text-[11px] md:text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Siswa wajib mengunggah foto aktivitas nyata di lokasi.
                </p>
              </div>
            </div>

            {/* Fitur 2 */}
            <div className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-950 p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 cursor-pointer border border-white/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white text-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-slate-900 group-hover:shadow-md group-hover:shadow-amber-400/20">
                📍
              </div>
              <div>
                <h2 className="text-xs md:text-sm font-bold text-white tracking-wide">
                  Geolokasi GPS Presisi
                </h2>
                <p className="text-[11px] md:text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Mencatat koordinat otomatis yang terhubung Google Maps.
                </p>
              </div>
            </div>

            {/* Fitur 3 */}
            <div className="group flex items-center gap-4 rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-950 p-4 shadow-lg shadow-black/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 cursor-pointer border border-white/10">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white text-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-amber-400 group-hover:text-slate-900 group-hover:shadow-md group-hover:shadow-amber-400/20">
                👨‍🏫
              </div>
              <div>
                <h2 className="text-xs md:text-sm font-bold text-white tracking-wide">
                  Monitoring & Jurnal Guru
                </h2>
                <p className="text-[11px] md:text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Mempermudah rekapitulasi harian oleh guru pembimbing.
                </p>
              </div>
            </div>
          </div>

          {/* Tombol Masuk Sistem: Kuning Amber Menyala */}
          <div className="pt-3">
            <Link
              href="/magang/login"
              className="block w-full rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 py-4 text-center text-sm font-black text-slate-950 shadow-md shadow-amber-500/20 transition-all duration-300 hover:from-amber-300 hover:to-yellow-300 hover:shadow-xl hover:shadow-amber-500/30 active:scale-[0.98] tracking-wide uppercase"
            >
              Masuk ke Aplikasi
            </Link>
          </div>
        </div>

        {/* Footer: Menggunakan Biru Navy Gelap Selaras dengan Elemen Atas */}
        <div className="border-t border-blue-950/30 bg-blue-950 px-6 py-4 text-center">
          <p className="text-[10px] font-bold tracking-wider text-amber-400 uppercase">
            © 2026 TJKT SMKN 1 TELUK KUANTAN
          </p>
        </div>
      </div>
      <InstallPrompt />
    </main>
  );
}
