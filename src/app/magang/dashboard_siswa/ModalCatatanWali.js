"use client";

import React from "react";

const ASPEK_PEMANTAUAN = [
  {
    key: "akademik",
    label: "Akademik",
    icon: "📚",
    color: "from-blue-500 to-indigo-600",
    lightBg: "bg-blue-50 border-blue-200 text-blue-900",
  },
  {
    key: "karakter",
    label: "Karakter",
    icon: "🌟",
    color: "from-amber-500 to-yellow-600",
    lightBg: "bg-amber-50 border-amber-200 text-amber-900",
  },
  {
    key: "sosial",
    label: "Sosial-Emosional",
    icon: "🤝",
    color: "from-emerald-500 to-teal-600",
    lightBg: "bg-emerald-50 border-emerald-200 text-emerald-900",
  },
  {
    key: "disiplin",
    label: "Kedisiplinan",
    icon: "⏱️",
    color: "from-rose-500 to-red-600",
    lightBg: "bg-rose-50 border-rose-200 text-rose-900",
  },
  {
    key: "potensi",
    label: "Potensi & Minat",
    icon: "🎯",
    color: "from-purple-500 to-indigo-600",
    lightBg: "bg-purple-50 border-purple-200 text-purple-900",
  },
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

function formatBulanTahun(nilaiBulan) {
  if (!nilaiBulan) return "-";
  const [tahun, bulan] = String(nilaiBulan).split("-");
  const indexBulan = Number(bulan) - 1;
  const namaBulan = NAMA_BULAN_INDO[indexBulan] || bulan;
  return `${namaBulan} ${tahun}`;
}

const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

export default function ModalCatatanWali({
  isOpen,
  onClose,
  catatan,
  guruWali,
  user,
}) {
  if (!isOpen) return null;

  const periodeAwal = catatan?.periodeAwal;
  const periodeAkhir = catatan?.periodeAkhir;
  const adaPeriode = periodeAwal || periodeAkhir;

  // Cek apakah ada setidaknya satu catatan terisi
  const adaCatatan = ASPEK_PEMANTAUAN.some((aspek) => {
    const cap = capitalize(aspek.key);
    return (
      catatan?.[`des${cap}`]?.trim() ||
      catatan?.[`tin${cap}`]?.trim() ||
      catatan?.[`ket${cap}`]?.trim()
    );
  });

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* HEADER MODAL */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-5 py-4 sm:px-6 sm:py-5 text-white">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-amber-400 opacity-10 blur-xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-2xl shadow-inner">
                📝
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-amber-400/30">
                  Lampiran B &middot; Evaluasi Berkala
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-amber-100">
                  Catatan Perkembangan Murid
                </h3>
                <p className="text-[11px] sm:text-xs text-blue-200 font-medium">
                  {user?.nama || "Siswa"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="shrink-0 rounded-full bg-white/10 hover:bg-white/25 w-8 h-8 flex items-center justify-center text-xs font-black text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SUB-HEADER INFORMASI */}
        <div className="shrink-0 bg-slate-100/80 border-b border-slate-200 px-5 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Guru Wali:</span>
            <span className="font-black text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-sm">
              👨‍🏫 {guruWali || "-"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-bold">Periode:</span>
            <span className="font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shadow-sm">
              📅{" "}
              {adaPeriode
                ? `${formatBulanTahun(periodeAwal)} — ${formatBulanTahun(periodeAkhir)}`
                : "Belum ditentukan"}
            </span>
          </div>
        </div>

        {/* BODY (SCROLLABLE) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
          {!adaCatatan ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <h4 className="text-sm sm:text-base font-black text-slate-700 mb-1">
                Belum Ada Catatan Perkembangan
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                Guru Wali kamu ({guruWali || "Wali Kelas"}) belum mengisi
                catatan evaluasi perkembangan untuk periode ini. Catatan akan
                otomatis tampil begitu diperbarui oleh Guru Wali.
              </p>
            </div>
          ) : (
            ASPEK_PEMANTAUAN.map((aspek) => {
              const cap = capitalize(aspek.key);
              const des = catatan?.[`des${cap}`];
              const tin = catatan?.[`tin${cap}`];
              const ket = catatan?.[`ket${cap}`];
              const isFilled = des?.trim() || tin?.trim() || ket?.trim();

              return (
                <div
                  key={aspek.key}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all hover:border-indigo-200"
                >
                  <div className="flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100/60 px-4 py-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{aspek.icon}</span>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800">
                        {aspek.label}
                      </h4>
                    </div>
                    {isFilled ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        ✓ Terisi
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">
                        Belum ada catatan
                      </span>
                    )}
                  </div>

                  <div className="p-3.5 sm:p-4 space-y-3">
                    {/* Deskripsi */}
                    <div>
                      <span className="block text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                        Deskripsi Perkembangan
                      </span>
                      <div className="rounded-xl bg-slate-50 p-2.5 sm:p-3 text-xs sm:text-sm font-medium text-slate-700 leading-relaxed border border-slate-100">
                        {des?.trim() ? (
                          des
                        ) : (
                          <span className="text-slate-400 italic">
                            Belum ada deskripsi
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tindak Lanjut */}
                    <div>
                      <span className="block text-[10px] sm:text-xs font-black uppercase tracking-wider text-blue-500 mb-1">
                        Tindak Lanjut yang Dilakukan
                      </span>
                      <div className="rounded-xl bg-blue-50/60 p-2.5 sm:p-3 text-xs sm:text-sm font-medium text-blue-900 leading-relaxed border border-blue-100">
                        {tin?.trim() ? (
                          tin
                        ) : (
                          <span className="text-slate-400 italic">
                            Belum ada tindak lanjut
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Keterangan Tambahan */}
                    {ket?.trim() && (
                      <div>
                        <span className="block text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-400 mb-1">
                          Keterangan Tambahan
                        </span>
                        <div className="rounded-xl bg-amber-50/50 p-2.5 sm:p-3 text-xs sm:text-sm font-medium text-amber-900 leading-relaxed border border-amber-100">
                          {ket}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4 flex items-center justify-between">
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
            Data disinkronkan langsung dari catatan Guru Wali
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black px-5 py-2.5 shadow-sm transition-all active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
