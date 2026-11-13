// src/app/magang/guru/PanelLaporanJoki.js
// Komponen bersama untuk menampilkan hasil deteksi joki (dipakai ModalPantauAsesmenKelas,
// TabKelolaUjian, dan pratinjau ModalPrintRekapUjian). Data berasal dari deteksiJoki() di
// "@/lib/auditAsesmenHelper".
"use client";

import React, { useState } from "react";

const LABEL_TINGKAT = {
  terdeteksi: "Terdeteksi Joki",
  mungkin: "Dugaan Joki (perlu verifikasi)",
};

export function labelTingkat(tingkat) {
  return LABEL_TINGKAT[tingkat] || LABEL_TINGKAT.mungkin;
}

/** Teks pelaku untuk tabel/PDF/laporan */
export function teksPelaku(kasus) {
  if (kasus.pelaku) return `${kasus.pelaku.nama} (${kasus.pelaku.kelas})`;
  if (kasus.kandidat && kasus.kandidat.length > 0) {
    return `Belum pasti. Kandidat akun: ${kasus.kandidat.map((k) => k.nama).join(", ")}`;
  }
  return "Belum teridentifikasi";
}

/** Teks siap salin / kirim ke guru admin */
export function teksLaporanJoki(kasusList = [], { judul = "" } = {}) {
  if (!kasusList.length) return "";
  const baris = [
    `LAPORAN DUGAAN JOKI ASESMEN${judul ? " - " + judul : ""}`,
    "SMKN 1 Teluk Kuantan",
    "",
  ];
  kasusList.forEach((k, i) => {
    baris.push(`${i + 1}. [${labelTingkat(k.tingkat)}] Mapel: ${k.mapel}`);
    baris.push(`   Nama di Google Form: ${k.korban.nama} (${k.korban.kelas})`);
    baris.push(`   Dikerjakan oleh akun: ${teksPelaku(k)}`);
    baris.push(
      `   Waktu form: ${k.waktuRespon || "-"} | Nilai form: ${k.nilai}`,
    );
    baris.push(`   Alasan: ${k.alasan}`);
    baris.push("");
  });
  return baris.join("\n");
}

/** Lencana kecil di sel nilai tabel siswa. `info` = deteksi.perSiswa.get(kunciSiswa) */
export function BadgeJoki({ info }) {
  if (!info) return null;
  const pelaku = info.pelaku?.[0];
  if (pelaku) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-600 text-white"
          title={pelaku.alasan}
        >
          🚨{" "}
          {pelaku.tingkat === "terdeteksi" ? "Terdeteksi Joki" : "Dugaan Joki"}
        </span>
        <span
          className="text-[9px] text-rose-800 font-bold truncate max-w-[140px]"
          title={`Mengisi form a.n. ${pelaku.korban.nama}`}
        >
          Mengisi a.n. {pelaku.korban.nama}
        </span>
        <span className="text-[9px] text-rose-600 font-black">
          {pelaku.mapel} • Nilai form: {pelaku.nilai}
        </span>
      </div>
    );
  }
  return null;
}

export default function PanelLaporanJoki({
  kasus = [],
  catatan = [],
  logTersedia = true,
  judul = "",
  className = "",
}) {
  const [terbuka, setTerbuka] = useState(true);
  const [tersalin, setTersalin] = useState(false);

  if (kasus.length === 0 && (catatan.length === 0 || logTersedia)) return null;

  const salin = async () => {
    try {
      await navigator.clipboard.writeText(teksLaporanJoki(kasus, { judul }));
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2500);
    } catch (_) {}
  };

  return (
    <div
      className={`rounded-2xl border border-rose-300 bg-rose-50/70 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setTerbuka((v) => !v)}
          className="flex items-center gap-2 text-left cursor-pointer"
        >
          <span className="text-base">🚨</span>
          <span className="text-xs sm:text-sm font-black text-rose-900">
            Laporan Dugaan Joki{judul ? ` - ${judul}` : ""}
          </span>
          <span className="rounded-full bg-rose-600 text-white px-2 py-0.5 text-[10px] font-black">
            {kasus.length} kasus
          </span>
          <span className="text-[10px] text-rose-700">
            {terbuka ? "▲" : "▼"}
          </span>
        </button>
        {kasus.length > 0 && (
          <button
            type="button"
            onClick={salin}
            className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 text-[10px] font-black cursor-pointer active:scale-95"
            title="Salin laporan untuk dikirim ke guru admin (mis. lewat WhatsApp)"
          >
            {tersalin ? "✓ Tersalin" : "📋 Salin Laporan"}
          </button>
        )}
      </div>

      {terbuka && (
        <div className="px-3 pb-3 space-y-2">
          {kasus.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-rose-200 bg-white">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-rose-100 text-rose-900 text-[10px] uppercase font-black">
                  <tr>
                    <th className="px-2 py-1.5">Mapel</th>
                    <th className="px-2 py-1.5">Nama di Google Form</th>
                    <th className="px-2 py-1.5">Dikerjakan oleh akun</th>
                    <th className="px-2 py-1.5">Waktu form</th>
                    <th className="px-2 py-1.5 text-center">Nilai form</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100 text-slate-800">
                  {kasus.map((k) => (
                    <tr key={k.id}>
                      <td className="px-2 py-1.5 font-bold whitespace-nowrap">
                        {k.mapel}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-bold">{k.korban.nama}</div>
                        <div className="text-[10px] text-slate-500">
                          {k.korban.kelas}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 font-semibold text-rose-800">
                        {teksPelaku(k)}
                      </td>
                      <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                        {k.waktuRespon || "-"}
                      </td>
                      <td className="px-2 py-1.5 text-center font-mono font-black">
                        {k.nilai}
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black ${
                            k.tingkat === "terdeteksi"
                              ? "bg-rose-600 text-white"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}
                          title={k.alasan}
                        >
                          {labelTingkat(k.tingkat)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {kasus.length > 0 && (
            <p className="text-[10px] text-rose-900/80 leading-snug">
              Dasar deteksi: nama di Google Form dipilih dari data sekolah,
              sehingga satu respon pasti milik satu siswa. Respon a.n. siswa
              tersebut dihitung <b>tidak sah</b> karena akunnya tidak tercatat
              membuka ujian mapel itu. Nilai form ditampilkan hanya sebagai
              bahan pertimbangan guru; keputusan akhir tetap pada guru/admin.
            </p>
          )}

          {catatan.map((c, i) => (
            <p
              key={i}
              className="text-[10px] font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1"
            >
              ℹ️ {c}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
