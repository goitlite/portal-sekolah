"use client";

import { useState } from "react";
import { getBiodataSiswa } from "../../lib/api";
import { generateCoverGuruWaliPDF } from "./generateCoverGuruWaliPDF";
import { generateBiodataPDF } from "./generateBiodataPDF";
import { generateLaporanGuruWaliPDF } from "./generateLaporanGuruWaliPDF";

// ============================================================
// KOMPONEN: MODAL PILIHAN CETAK LAPORAN GURU WALI
// ============================================================
// Dipakai bersama oleh dashboard guru (JS_GURU_FIX3) dan halaman
// data siswa wali (JS_GURUWALI_FIX6). Berisi 3 pilihan cetak:
//
//   1. Cetak Cover         -> generateCoverGuruWaliPDF
//   2. Cetak Lampiran A & B -> pilih siswa dari daftar wali,
//                              lalu generateBiodataPDF (berisi
//                              Lampiran A: Biodata + Lampiran B:
//                              Catatan Perkembangan Murid)
//   3. Cetak Lampiran C & D -> generateLaporanGuruWaliPDF (perlu
//                              data jurnal pertemuan guru wali)
//
// Props:
//   isOpen            : boolean, tampil/tidaknya modal
//   onClose           : () => void
//   namaGuru          : string, nama guru wali yang sedang login
//   daftarSiswaWali   : array siswa wali (dari getDataSiswaWali),
//                       dipakai untuk daftar pada Lampiran A & B.
//                       Gunakan ini jika halaman pemanggil SUDAH
//                       memuat daftar siswa (mis. halaman data
//                       siswa wali).
//   fetchDaftarSiswaWali : async () => array, ALTERNATIF dari
//                       daftarSiswaWali. Dipanggil sekali secara
//                       lazy saat menu "Lampiran A & B" dibuka -
//                       dipakai halaman yang BELUM memuat daftar
//                       siswa wali (mis. dashboard guru), supaya
//                       tidak perlu fetch di awal render dashboard.
//   onCetakLampiranCD : async () => void, dipanggil ketika tombol
//                       Lampiran C & D diklik. Biarkan komponen
//                       pemanggil yang mengambil data jurnal
//                       (getJurnalGuruWali) lalu memanggil
//                       generateLaporanGuruWaliPDF, supaya logic
//                       fetch jurnal tetap berada di satu tempat
//                       (tidak duplikasi antara dua halaman).
//   loadingLampiranCD : boolean, status loading dari proses di atas
// ============================================================

const MENU_UTAMA = "menu";
const MENU_PILIH_SISWA = "pilihSiswa";

export default function CetakLaporanGuruWaliModal({
  isOpen,
  onClose,
  namaGuru,
  daftarSiswaWali = null,
  fetchDaftarSiswaWali,
  onCetakLampiranCD,
  loadingLampiranCD = false,
}) {
  const [tampilan, setTampilan] = useState(MENU_UTAMA);
  const [loadingCover, setLoadingCover] = useState(false);
  const [idSiswaSedangDicetak, setIdSiswaSedangDicetak] = useState(null);
  const [daftarSiswaLazy, setDaftarSiswaLazy] = useState(null);
  const [loadingDaftarSiswa, setLoadingDaftarSiswa] = useState(false);

  // Sumber daftar siswa: prop langsung (jika halaman sudah punya
  // datanya) ATAU hasil fetch lazy (jika halaman memakai fetcher).
  const siswaSiapDipakai = daftarSiswaWali ?? daftarSiswaLazy ?? [];

  if (!isOpen) return null;

  function tutupModal() {
    setTampilan(MENU_UTAMA);
    setIdSiswaSedangDicetak(null);
    onClose();
  }

  async function bukaMenuPilihSiswa() {
    setTampilan(MENU_PILIH_SISWA);

    // Jika daftar belum tersedia lewat prop, dan ada fetcher, ambil
    // sekali saja secara lazy.
    if (
      daftarSiswaWali == null &&
      daftarSiswaLazy == null &&
      typeof fetchDaftarSiswaWali === "function"
    ) {
      setLoadingDaftarSiswa(true);
      try {
        const hasil = await fetchDaftarSiswaWali();
        setDaftarSiswaLazy(Array.isArray(hasil) ? hasil : []);
      } catch (error) {
        console.error("Gagal mengambil daftar siswa wali:", error);
        setDaftarSiswaLazy([]);
      } finally {
        setLoadingDaftarSiswa(false);
      }
    }
  }

  async function handleCetakCover() {
    if (loadingCover) return;
    setLoadingCover(true);
    try {
      await generateCoverGuruWaliPDF({ namaGuru });
      tutupModal();
    } catch (error) {
      console.error("Gagal mencetak cover jurnal guru wali:", error);
      alert("Gagal mencetak cover: " + (error?.message || "Terjadi kesalahan"));
    } finally {
      setLoadingCover(false);
    }
  }

  async function handlePilihSiswaLampiranAB(siswa) {
    if (idSiswaSedangDicetak) return;

    try {
      setIdSiswaSedangDicetak(siswa.idSiswa);

      // Ambil biodata lengkap (fotoProfil, noHp, ayah/ibu, catatan
      // perkembangan, dll) dari sheet DATA_SISWA_WALI. Data pada
      // "siswa" (roster daftar wali) hanya berisi idSiswa/nama/
      // namaGuru/tempatMagang, sehingga harus digabung dulu -
      // pola yang sama persis dengan handleCetakPDF pada halaman
      // data siswa wali.
      const resBiodata = await getBiodataSiswa(String(siswa.idSiswa));

      if (!resBiodata?.success) {
        console.warn("Gagal mengambil biodata:", resBiodata?.message);
      }

      const biodata = resBiodata?.success ? resBiodata.data : {};

      const siswaLengkap = {
        ...siswa,
        ...biodata,
        idSiswa: siswa.idSiswa,
        nama: siswa.nama,
        namaGuru: siswa.namaGuru || namaGuru,
        tempatMagang: siswa.tempatMagang,
      };

      // generateBiodataPDF sudah memuat Lampiran A (Biodata Siswa)
      // dan Lampiran B (Catatan Perkembangan Murid) dalam satu file.
      await generateBiodataPDF(siswaLengkap);
    } catch (error) {
      console.error("Gagal mencetak Lampiran A & B:", error);
      alert(
        "Gagal mencetak biodata siswa: " +
          (error?.message || "Terjadi kesalahan"),
      );
    } finally {
      setIdSiswaSedangDicetak(null);
    }
  }

  async function handleKlikLampiranCD() {
    if (loadingLampiranCD) return;
    if (typeof onCetakLampiranCD === "function") {
      await onCetakLampiranCD();
    }
    tutupModal();
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) tutupModal();
      }}
    >
      <div className="flex w-full max-w-lg max-h-[90vh] flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl">
        {/* HEADER */}
        <div className="shrink-0 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 px-5 py-4 sm:px-6 sm:py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {tampilan === MENU_PILIH_SISWA && (
                <button
                  onClick={() => setTampilan(MENU_UTAMA)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-black text-white transition-all hover:bg-white/20"
                  title="Kembali"
                >
                  ←
                </button>
              )}
              <div>
                <h2 className="text-sm sm:text-base font-black tracking-tight">
                  🖨️ Cetak Laporan Guru Wali
                </h2>
                <p className="mt-0.5 text-[11px] sm:text-xs font-medium text-blue-200">
                  {tampilan === MENU_UTAMA
                    ? "Pilih jenis dokumen yang ingin dicetak"
                    : "Pilih siswa untuk cetak Lampiran A & B"}
                </p>
              </div>
            </div>
            <button
              onClick={tutupModal}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-black text-white transition-all hover:bg-black/40"
            >
              ✕
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {tampilan === MENU_UTAMA && (
            <div className="space-y-3">
              {/* PILIHAN 1: CETAK COVER */}
              <button
                onClick={handleCetakCover}
                disabled={loadingCover}
                className="group flex w-full items-center gap-4 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 text-left transition-all hover:border-teal-300 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-2xl text-white shadow-sm">
                  📘
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-slate-800">
                    Cetak Cover
                  </span>
                  <span className="block text-xs font-medium text-slate-500">
                    {loadingCover
                      ? "Menyiapkan PDF cover..."
                      : "Halaman sampul Buku Jurnal Guru Wali + logo sekolah & nama guru"}
                  </span>
                </span>
                <span className="shrink-0 text-slate-300 group-hover:text-teal-500 group-hover:translate-x-1 transition-all">
                  →
                </span>
              </button>

              {/* PILIHAN 2: CETAK LAMPIRAN A & B */}
              <button
                onClick={bukaMenuPilihSiswa}
                className="group flex w-full items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 text-left transition-all hover:border-amber-300 hover:shadow-md active:scale-[0.98]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-2xl text-white shadow-sm">
                  🧑‍🎓
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-slate-800">
                    Cetak Lampiran A &amp; B
                  </span>
                  <span className="block text-xs font-medium text-slate-500">
                    {daftarSiswaWali != null
                      ? `Biodata & Catatan Perkembangan per siswa wali (${daftarSiswaWali.length} siswa)`
                      : "Biodata & Catatan Perkembangan per siswa wali"}
                  </span>
                </span>
                <span className="shrink-0 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all">
                  →
                </span>
              </button>

              {/* PILIHAN 3: CETAK LAMPIRAN C & D */}
              <button
                onClick={handleKlikLampiranCD}
                disabled={loadingLampiranCD}
                className="group flex w-full items-center gap-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 text-left transition-all hover:border-indigo-300 hover:shadow-md active:scale-[0.98] disabled:opacity-60"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-2xl text-white shadow-sm">
                  📑
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-black text-slate-800">
                    Cetak Lampiran C &amp; D
                  </span>
                  <span className="block text-xs font-medium text-slate-500">
                    {loadingLampiranCD
                      ? "Menyiapkan PDF rekap..."
                      : "Rekap Pertemuan (C) & Pelaporan Semester (D) seluruh siswa wali"}
                  </span>
                </span>
                <span className="shrink-0 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all">
                  →
                </span>
              </button>
            </div>
          )}

          {tampilan === MENU_PILIH_SISWA && (
            <div className="space-y-2">
              {loadingDaftarSiswa ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-bold text-slate-500">
                    ⏳ Memuat daftar siswa wali...
                  </p>
                </div>
              ) : siswaSiapDipakai.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
                  <p className="text-sm font-bold text-slate-500">
                    Belum ada siswa wali untuk dicetak.
                  </p>
                </div>
              ) : (
                siswaSiapDipakai.map((siswa, index) => {
                  const namaMentah = siswa.nama || "-";
                  const matchKelas = namaMentah.match(/\[(.*?)\]/);
                  const kelas = matchKelas ? matchKelas[1] : siswa.kelas;
                  const namaBersih = namaMentah
                    .replace(/\s*\[.*?\]\s*/, "")
                    .trim();
                  const sedangDicetak = idSiswaSedangDicetak === siswa.idSiswa;

                  return (
                    <button
                      key={siswa.idSiswa || index}
                      onClick={() => handlePilihSiswaLampiranAB(siswa)}
                      disabled={!!idSiswaSedangDicetak}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition-all hover:border-blue-300 hover:bg-blue-50/50 active:scale-[0.98] disabled:opacity-60"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-base">
                        👤
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-xs sm:text-sm font-black text-slate-800">
                            {namaBersih || "-"}
                          </span>
                          {kelas && (
                            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                              {kelas}
                            </span>
                          )}
                        </span>
                        <span className="block text-[10px] font-medium text-slate-400">
                          ID: {siswa.idSiswa || "-"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[10px] font-black text-blue-600">
                        {sedangDicetak ? "⏳ Mencetak..." : "🖨️ Cetak"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
          <button
            onClick={tutupModal}
            className="w-full rounded-xl bg-white border border-slate-300 px-4 py-2.5 text-xs sm:text-sm font-black text-slate-600 transition hover:bg-slate-100 active:scale-[0.98]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
