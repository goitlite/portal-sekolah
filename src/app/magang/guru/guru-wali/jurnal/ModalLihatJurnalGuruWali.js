"use client";

import { useEffect, useState, useCallback } from "react";
import { getJurnalGuruWali, deleteJurnalGuruWali } from "../../../lib/api";

// =====================================================
// Kelompokkan baris jurnal (flat, per siswa) menjadi
// satu kartu per PERTEMUAN (idJurnal) — sesuai aturan
// backend: "SATU PERTEMUAN = SATU ID JURNAL".
// =====================================================
function kelompokkanJurnal(rows) {
  const map = new Map();

  rows.forEach((r) => {
    const key = r.idJurnal || `${r.idSiswa}-${r.tanggal}-${r.createdAt}`;

    if (!map.has(key)) {
      map.set(key, {
        idJurnal: r.idJurnal,
        tanggal: r.tanggal,
        formatPertemuan: r.formatPertemuan || "Individu",
        topik: r.topik,
        tindakLanjut: r.tindakLanjut,
        keterangan: r.keterangan,
        fotoUrl: r.fotoUrl,
        createdAt: r.createdAt,
        siswa: [],
      });
    }

    map.get(key).siswa.push({
      idSiswa: r.idSiswa,
      nama: r.namaSiswa,
      kelas: r.kelas,
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
}

export default function ModalLihatJurnalGuruWali({ isOpen, onClose, guru }) {
  const [daftarJurnal, setDaftarJurnal] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [searchNama, setSearchNama] = useState("");

  const idGuru = guru?.id || "";
  const namaGuru = guru?.nama || "";

  const loadJurnal = useCallback(async () => {
    if (!idGuru) return;
    setLoading(true);
    setError("");
    try {
      const res = await getJurnalGuruWali(idGuru);
      if (res?.success) {
        setDaftarJurnal(kelompokkanJurnal(res.data || []));
      } else {
        setError(res?.message || "Gagal mengambil data jurnal.");
        setDaftarJurnal([]);
      }
    } catch (err) {
      console.error("Gagal memuat jurnal guru wali:", err);
      setError("Terjadi kesalahan saat mengambil data jurnal.");
      setDaftarJurnal([]);
    } finally {
      setLoading(false);
    }
  }, [idGuru]);

  useEffect(() => {
    if (isOpen) {
      loadJurnal();
    }
  }, [isOpen, loadJurnal]);

  async function handleHapus(idJurnal) {
    const konfirmasi = window.confirm(
      "Hapus jurnal pertemuan ini?\n\nTindakan ini akan menghapus data untuk semua siswa dalam pertemuan tersebut dan tidak dapat dibatalkan.",
    );
    if (!konfirmasi) return;

    setDeletingId(idJurnal);
    try {
      const res = await deleteJurnalGuruWali({ idGuru, idJurnal });
      if (res?.success) {
        setDaftarJurnal((prev) => prev.filter((j) => j.idJurnal !== idJurnal));
      } else {
        alert(res?.message || "Gagal menghapus jurnal.");
      }
    } catch (err) {
      console.error("Gagal menghapus jurnal guru wali:", err);
      alert("Terjadi kesalahan saat menghapus jurnal.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!isOpen) return null;

  const filteredJurnal = searchNama.trim()
    ? daftarJurnal.filter((j) =>
        j.siswa.some((s) =>
          (s.nama || "").toLowerCase().includes(searchNama.toLowerCase()),
        ),
      )
    : daftarJurnal;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-800 to-indigo-800 text-white px-6 py-5 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                📖 Riwayat Jurnal Guru Wali
              </h2>
              <p className="text-xs font-medium text-blue-200 mt-0.5 truncate">
                Guru: {namaGuru || "-"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 rounded-xl bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
            >
              ✕
            </button>
          </div>

          {daftarJurnal.length > 0 && (
            <input
              type="text"
              value={searchNama}
              onChange={(e) => setSearchNama(e.target.value)}
              placeholder="Cari nama siswa..."
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-medium text-white placeholder-blue-200 outline-none focus:bg-white/20 transition-colors"
            />
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-ljgw px-5 py-4 space-y-3 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <div className="relative h-9 w-9 mb-3">
                <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
                <div className="absolute inset-0 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
              </div>
              <p className="text-xs font-bold">Memuat riwayat jurnal...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs font-bold text-red-600">
              {error}
            </div>
          ) : filteredJurnal.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <span className="text-4xl mb-2">📭</span>
              <p className="text-xs font-bold">
                {searchNama.trim()
                  ? "Tidak ditemukan jurnal untuk nama tersebut."
                  : "Belum ada jurnal yang tercatat."}
              </p>
            </div>
          ) : (
            filteredJurnal.map((j) => (
              <div
                key={j.idJurnal}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5 mb-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-black text-slate-800">
                        {j.tanggal || "-"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase border ${
                          j.formatPertemuan === "Kelompok"
                            ? "bg-violet-50 text-violet-700 border-violet-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {j.formatPertemuan === "Kelompok"
                          ? "👥 Kelompok"
                          : "👤 Individu"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500 leading-snug">
                      {j.siswa
                        .map((s) => s.nama + (s.kelas ? ` [${s.kelas}]` : ""))
                        .join(", ")}
                    </p>
                  </div>

                  <button
                    onClick={() => handleHapus(j.idJurnal)}
                    disabled={deletingId === j.idJurnal}
                    className="shrink-0 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[10px] font-black text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                  >
                    {deletingId === j.idJurnal ? "⏳" : "🗑️ Hapus"}
                  </button>
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <p className="text-slate-700">
                    <span className="font-black text-slate-500">Topik: </span>
                    {j.topik || "-"}
                  </p>
                  {j.tindakLanjut && (
                    <p className="text-slate-700">
                      <span className="font-black text-slate-500">
                        Tindak Lanjut:{" "}
                      </span>
                      {j.tindakLanjut}
                    </p>
                  )}
                  {j.keterangan && (
                    <p className="text-slate-700">
                      <span className="font-black text-slate-500">
                        Keterangan:{" "}
                      </span>
                      {j.keterangan}
                    </p>
                  )}
                </div>

                {j.fotoUrl && (
                  <a
                    href={j.fotoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    📸 Lihat Bukti Foto
                  </a>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-white rounded-b-3xl">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-black py-3 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `.custom-scrollbar-ljgw::-webkit-scrollbar { width: 6px; } .custom-scrollbar-ljgw::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`,
        }}
      />
    </div>
  );
}
