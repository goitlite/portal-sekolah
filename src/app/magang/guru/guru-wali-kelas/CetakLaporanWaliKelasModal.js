"use client";

import { useState, useEffect } from "react";
import { getWaliKelasByGuru } from "../../lib/api";
import { generateLaporanWaliKelasPDF } from "./generateLaporanWaliKelasPDF";

export default function CetakLaporanWaliKelasModal({ isOpen, onClose, guru }) {
  const [daftarWali, setDaftarWali] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cetakLoadingId, setCetakLoadingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && guru?.id) {
      loadWali();
    }
  }, [isOpen, guru?.id]);

  async function loadWali() {
    try {
      setLoading(true);
      setError("");
      const result = await getWaliKelasByGuru(guru.id);
      if (result.success) {
        const raw = result.data ?? result.message ?? [];
        const normalized = (Array.isArray(raw) ? raw : []).map((w, idx) => ({
          ...w,
          idWali: String(w.idWali || w.ID_WALI || w.id || `wali-${idx}`),
          idGuru: String(w.idGuru || w.ID_GURU || ""),
          namaKelas: String(w.namaKelas || w.NAMA_KELAS || w.kelas || ""),
          kelas: String(w.kelas || w.NAMA_KELAS || w.namaKelas || ""),
          keterangan: String(w.keterangan || w.KETERANGAN || ""),
          jumlahSiswa: w.jumlahSiswa,
        }));
        setDaftarWali(normalized);
      } else {
        setError(result.message || "Gagal mengambil daftar kelas wali.");
      }
    } catch (err) {
      console.error("Gagal memuat kelas wali:", err);
      setError("Terjadi kesalahan saat memuat daftar kelas wali.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCetak(wali) {
    try {
      setCetakLoadingId(wali.idWali);
      await generateLaporanWaliKelasPDF({ guru, wali });
    } catch (err) {
      console.error("Gagal cetak PDF wali kelas:", err);
      alert(err.message || "Gagal mencetak laporan PDF wali kelas.");
    } finally {
      setCetakLoadingId(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        {/* Header Modal */}
        <div className="shrink-0 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-950 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🖨️</span>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight">
                  Cetak Laporan Wali Kelas (PDF)
                </h3>
                <p className="text-[11px] text-teal-200 font-medium">
                  Pilih kelas wali untuk mengunduh rekapitulasi presensi &
                  jurnal
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 hover:bg-white/25 w-8 h-8 flex items-center justify-center text-xs font-black transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Konten Daftar Wali Kelas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 text-center">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-12">
              <div className="relative mx-auto h-10 w-10">
                <div className="absolute inset-0 rounded-full border-3 border-teal-200"></div>
                <div className="absolute inset-0 rounded-full border-3 border-teal-600 border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-3 text-xs font-bold text-slate-500">
                Memuat data kelas wali...
              </p>
            </div>
          ) : daftarWali.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-xs sm:text-sm font-bold text-slate-400">
              Belum ada kelas wali yang dibuat. Silakan kelola kelas wali
              terlebih dahulu.
            </div>
          ) : (
            daftarWali.map((wali) => {
              const isPrinting = cetakLoadingId === wali.idWali;

              return (
                <div
                  key={wali.idWali}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-black text-slate-800 truncate">
                        {wali.namaKelas}
                      </h4>
                      {wali.kelas && (
                        <span className="rounded-full bg-teal-100 border border-teal-200 px-2.5 py-0.5 text-[10px] font-black text-teal-800 uppercase">
                          Kelas {wali.kelas}
                        </span>
                      )}
                      {wali.jumlahSiswa !== undefined && (
                        <span className="rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          👥 {wali.jumlahSiswa} Siswa
                        </span>
                      )}
                    </div>
                    {wali.keterangan && (
                      <p className="text-[11px] text-slate-500 font-medium mt-1 truncate">
                        {wali.keterangan}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleCetak(wali)}
                    disabled={isPrinting}
                    className="shrink-0 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:brightness-110 active:scale-95 text-white text-xs font-black px-4 py-2.5 shadow-sm transition-all disabled:opacity-60"
                  >
                    {isPrinting ? (
                      <>
                        <span className="inline-block animate-spin">⏳</span>
                        <span>Mencetak...</span>
                      </>
                    ) : (
                      <>
                        <span>🖨️</span>
                        <span>Cetak PDF</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Modal */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>{daftarWali.length} kelas wali terdaftar</span>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 font-bold transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
