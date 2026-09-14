"use client";

import { useEffect, useRef, useState } from "react";

// ============================================================
// 🎓 RUANG BELAJAR SISWA
// Modul latihan TKA (Tes Kemampuan Akademik) + Literasi + Numerasi.
// Komponen ini SENGAJA dipisah dari file Dashboard Siswa utama supaya
// tidak ada satupun kode/tampilan dashboard lama yang tersentuh.
// ============================================================

const SUMBER_BELAJAR = {
  simulasi: {
    key: "simulasi",
    judul: "Simulasi TKA",
    deskripsi: "Uji kemampuanmu melalui simulasi TKA resmi.",
    icon: "🎯",
    tombol: "🚀 Mulai Simulasi",
    url: "https://pusmendik.kemendikdasmen.go.id/tka/simulasi_tka",
    gradient: "from-amber-500 via-yellow-500 to-orange-500",
  },
  literasi: {
    key: "literasi",
    judul: "Literasi",
    deskripsi: "Tingkatkan kemampuan memahami dan menganalisis informasi.",
    icon: "📖",
    tombol: "▶️ Mulai Belajar",
    url: "https://s.id/videolitnumsmk",
    gradient: "from-blue-500 to-indigo-600",
  },
  numerasi: {
    key: "numerasi",
    judul: "Numerasi",
    deskripsi:
      "Latih kemampuan berpikir menggunakan angka dan konsep matematika.",
    icon: "🔢",
    tombol: "▶️ Mulai Belajar",
    url: "https://s.id/videolitnumsmk",
    gradient: "from-violet-500 to-purple-600",
  },
};

const URUTAN_AKTIVITAS = ["literasi", "numerasi", "simulasi"];

function getTodayStr() {
  return new Date().toLocaleDateString("id-ID");
}

function getDefaultProgress() {
  return {
    literasi: { done: false, lastOpened: "" },
    numerasi: { done: false, lastOpened: "" },
    simulasi: { done: false, lastOpened: "" },
    totalOpens: 0,
  };
}

export default function RuangBelajarTKA({ idSiswa }) {
  // Progress selalu diikat ke ID siswa yang sedang login supaya data
  // antar akun tidak tercampur.
  const storageKey = `tka_learning_progress_${idSiswa || "guest"}`;

  const [progress, setProgress] = useState(getDefaultProgress());
  const [toast, setToast] = useState("");
  const toastTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  function tampilkanToast(pesan) {
    setToast(pesan);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(""), 3000);
  }

  // ------------------------------------------------------------
  // Baca progress dari localStorage HANYA di client (di dalam
  // useEffect), supaya tidak menyentuh window/localStorage saat
  // render di server (mencegah error SSR/hydration).
  // ------------------------------------------------------------
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setProgress((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.error("Gagal membaca progress Ruang Belajar Siswa:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function simpanProgress(next) {
    setProgress(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (err) {
      // Beberapa browser mobile punya kuota localStorage kecil.
      // Gagal simpan tidak boleh menghentikan interaksi siswa.
      console.warn("Gagal menyimpan progress belajar (kuota penuh?):", err);
    }
  }

  function bukaAktivitas(kunci) {
    const item = SUMBER_BELAJAR[kunci];
    const today = getTodayStr();
    const next = {
      ...progress,
      [kunci]: { done: true, lastOpened: today },
      totalOpens: (progress.totalOpens || 0) + 1,
    };
    simpanProgress(next);

    // Langsung buka link di tab baru (tanpa modal iframe)
    window.open(item.url, "_blank", "noopener,noreferrer");
    tampilkanToast(`${item.icon} ${item.judul} dibuka di tab baru.`);
  }

  const today = getTodayStr();

  const targetHarian = URUTAN_AKTIVITAS.map((k) => ({
    key: k,
    ...SUMBER_BELAJAR[k],
    selesai: progress[k]?.lastOpened === today,
  }));
  const jumlahSelesaiHariIni = targetHarian.filter((t) => t.selesai).length;
  const persenHarian = Math.round((jumlahSelesaiHariIni / 3) * 100);

  const totalSelesaiSepanjangWaktu = URUTAN_AKTIVITAS.filter(
    (k) => progress[k]?.done,
  ).length;
  const totalOpens = progress.totalOpens || 0;

  const pencapaian = [
    { label: "🎯 Latihan Pertama", aktif: !!progress.simulasi?.done },
    { label: "📖 Materi Pertama", aktif: !!progress.literasi?.done },
    { label: "🔢 Numerasi Pertama", aktif: !!progress.numerasi?.done },
    { label: "🔥 3 Aktivitas Selesai", aktif: totalSelesaiSepanjangWaktu >= 3 },
    { label: "🏆 10 Aktivitas Selesai", aktif: totalOpens >= 10 },
  ];

  return (
    <>
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-5 sm:p-8 text-white shadow-xl border border-blue-800">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-amber-400 opacity-10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
            🎓 Ruang Belajar Siswa
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Ruang Belajar Siswa
          </h2>
          <p className="mt-1 text-xs sm:text-sm font-bold text-amber-300">
            Persiapkan TKA • Tingkatkan Literasi • Asah Numerasi
          </p>
          <p className="mt-2 text-sm text-blue-200 max-w-lg font-medium">
            Tempat belajar, berlatih, dan mempersiapkan kemampuan akademikmu.
          </p>

          {/* ================= KARTU AKTIVITAS ================= */}
          <div className="mt-6 grid gap-4 grid-cols-1 sm:grid-cols-3">
            {URUTAN_AKTIVITAS.map((kunci) => {
              const item = SUMBER_BELAJAR[kunci];
              const sudahDibuka = !!progress[kunci]?.done;
              return (
                <div
                  key={kunci}
                  className="rounded-2xl bg-white/10 border border-white/15 p-4 sm:p-5 flex flex-col justify-between shadow-inner backdrop-blur-sm"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 border border-white/20 text-2xl shadow-inner">
                        {item.icon}
                      </div>
                      {sudahDibuka && (
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full">
                          ✅ Sudah Dibuka
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 text-sm sm:text-base font-black tracking-tight">
                      {item.judul}
                    </h3>
                    <p className="mt-1 text-[11px] sm:text-xs text-blue-200 font-medium leading-relaxed">
                      {item.deskripsi}
                    </p>
                  </div>
                  <button
                    onClick={() => bukaAktivitas(kunci)}
                    className={`mt-4 w-full rounded-xl bg-gradient-to-r ${item.gradient} px-4 py-2.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-95 hover:brightness-110 transition-all`}
                  >
                    {item.tombol}
                  </button>
                  <p className="mt-2 text-center text-[10px] font-semibold text-blue-300/70">
                    🔗 Dibuka di tab baru
                  </p>
                </div>
              );
            })}
          </div>

          {/* ================= TARGET BELAJAR HARI INI ================= */}
          <div className="mt-6 rounded-2xl bg-white/10 border border-white/15 p-4 sm:p-5 backdrop-blur-sm">
            <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
              🔥 Target Belajar Hari Ini
            </h3>

            <div className="mt-3 space-y-2">
              {targetHarian.map((t) => (
                <div key={t.key} className="flex items-center gap-2.5">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] font-black ${
                      t.selesai
                        ? "bg-emerald-400 border-emerald-300 text-emerald-950"
                        : "bg-white/10 border-white/25 text-transparent"
                    }`}
                  >
                    {t.selesai ? "✓" : ""}
                  </span>
                  <span
                    className={`text-xs sm:text-sm font-bold ${
                      t.selesai ? "text-blue-200" : "text-white"
                    }`}
                  >
                    {t.key === "simulasi"
                      ? "Mengerjakan Simulasi TKA"
                      : `Membuka materi ${t.judul}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-blue-200 uppercase tracking-wider mb-1.5">
                <span>Progress Hari Ini</span>
                <span>
                  {jumlahSelesaiHariIni} / 3 aktivitas ({persenHarian}%)
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-all duration-500"
                  style={{ width: `${persenHarian}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* ================= PERKEMBANGAN BELAJAR ================= */}
          <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 p-4 sm:p-5 backdrop-blur-sm">
            <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
              📊 Perkembangan Belajar
            </h3>

            <div className="mt-4 space-y-4">
              {URUTAN_AKTIVITAS.map((kunci) => {
                const item = SUMBER_BELAJAR[kunci];
                const selesai = !!progress[kunci]?.done;
                return (
                  <div key={kunci}>
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-blue-200 mb-1.5">
                      <span>
                        {item.icon} {item.judul}
                      </span>
                      <span>{selesai ? "100%" : "0%"}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${item.gradient} transition-all duration-500`}
                        style={{ width: selesai ? "100%" : "0%" }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= PENCAPAIAN ================= */}
          <div className="mt-4 rounded-2xl bg-white/10 border border-white/15 p-4 sm:p-5 backdrop-blur-sm">
            <h3 className="text-sm sm:text-base font-black flex items-center gap-2">
              🏆 Pencapaian
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {pencapaian.map((p, i) => (
                <span
                  key={i}
                  className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black border transition-all ${
                    p.aktif
                      ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 border-amber-200 shadow-sm"
                      : "bg-white/5 text-blue-300/50 border-white/10"
                  }`}
                >
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ================= TOAST KONFIRMASI TAB BARU ================= */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[300] -translate-x-1/2 rounded-full border border-white/10 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
