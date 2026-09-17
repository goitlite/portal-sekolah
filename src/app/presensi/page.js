"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

function PresensiContent() {
  const searchParams = useSearchParams();

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams();
    const mode = searchParams.get("mode");
    const kelas = searchParams.get("kelas");
    if (mode) params.set("mode", mode);
    if (kelas) params.set("kelas", kelas);

    const queryString = params.toString();
    return queryString ? `/presensi.html?${queryString}` : "/presensi.html";
  }, [searchParams]);

  return (
    <main className="relative w-full h-screen bg-[#f8fafc] overflow-hidden">
      {/* Tombol Navigasi Cepat Kembali ke Dashboard Guru */}
      <div className="absolute top-3 left-3 z-50">
        <Link
          href="/magang/guru"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-700 text-xs font-bold shadow hover:shadow-md border border-slate-200 backdrop-blur-sm transition-all active:scale-95"
          title="Kembali ke Dashboard Guru"
        >
          <span>⬅️</span> Dashboard Guru
        </Link>
      </div>

      <iframe
        src={iframeSrc}
        className="w-full h-full border-0"
        title="Presensi Siswa SMKN 1 Teluk Kuantan"
        allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
      />
    </main>
  );
}

export default function PresensiPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full h-screen bg-[#f8fafc] flex items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">
            Memuat presensi...
          </div>
        </div>
      }
    >
      <PresensiContent />
    </Suspense>
  );
}
