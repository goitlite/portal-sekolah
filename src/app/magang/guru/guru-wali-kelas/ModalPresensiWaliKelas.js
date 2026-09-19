"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  getPresensiWaliGrid,
  savePresensiWaliKelas,
  hapusSiswaWaliKelas,
} from "../../lib/api";
import { generateLaporanWaliKelasPDF } from "./generateLaporanWaliKelasPDF";
import ModalTambahSiswaWali from "./kelola/ModalTambahSiswaWali";

const STATUS_OPTIONS = [
  { value: "Hadir", label: "Hadir" },
  { value: "Sakit", label: "Sakit" },
  { value: "Izin", label: "Izin" },
  { value: "Alfa", label: "Alfa" },
  { value: "Cabut", label: "Cabut" },
];

function warnaStatus(status) {
  switch (status) {
    case "Hadir":
      return "bg-emerald-500 text-white border-emerald-600";
    case "Sakit":
      return "bg-blue-600 text-white border-blue-700";
    case "Izin":
      return "bg-amber-500 text-white border-amber-600";
    case "Alfa":
      return "bg-rose-500 text-white border-rose-600";
    case "Cabut":
      return "bg-violet-500 text-white border-violet-600";
    default:
      return "bg-white text-slate-500 border-slate-300 hover:border-teal-400";
  }
}

function formatTanggalKolom(tanggalISO) {
  if (!tanggalISO) return "";
  try {
    const d = new Date(tanggalISO);
    if (isNaN(d.getTime())) return tanggalISO;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return tanggalISO;
  }
}

export default function ModalPresensiWaliKelas({
  isOpen,
  onClose,
  guru,
  wali,
}) {
  const [loading, setLoading] = useState(true);
  const [siswaList, setSiswaList] = useState([]);
  const [grid, setGrid] = useState({});
  const [daftarTanggal, setDaftarTanggal] = useState([]);
  const [tanggalBaru, setTanggalBaru] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [menghapusId, setMenghapusId] = useState(null);
  const [cetakLoading, setCetakLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showTambahModal, setShowTambahModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (isOpen && wali?.idWali && guru?.id) {
      loadGrid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, wali?.idWali, guru?.id]);

  async function loadGrid() {
    try {
      setLoading(true);
      const result = await getPresensiWaliGrid(guru.id, wali.idWali);
      const data = result.success ? result.data : { siswa: [], presensi: [] };

      const daftarSiswa = (data.siswa || [])
        .slice()
        .map((s) => ({ ...s, nama: s.namaSiswa || s.nama || "" }))
        .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
      setSiswaList(daftarSiswa);

      const gridBaru = {};
      const tanggalSet = new Set();

      (data.presensi || []).forEach((p) => {
        if (!p.tanggal) return;
        tanggalSet.add(p.tanggal);
        const key = `${p.idSiswa}_${p.tanggal}`;
        gridBaru[key] = {
          status: p.status || "",
          keterangan: p.keterangan || "",
        };
      });

      setGrid(gridBaru);
      const sortedTanggal = Array.from(tanggalSet).sort();
      setDaftarTanggal(sortedTanggal);
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error("ERROR LOAD GRID PRESENSI WALI KELAS:", err);
      alert("Gagal memuat data presensi wali kelas.");
    } finally {
      setLoading(false);
    }
  }

  function updateCell(idSiswa, tanggal, field, value) {
    const key = `${idSiswa}_${tanggal}`;
    setGrid((prev) => {
      const current = prev[key] || { status: "", keterangan: "" };
      return { ...prev, [key]: { ...current, [field]: value } };
    });
    setHasUnsavedChanges(true);
  }

  function tambahHari() {
    const today = new Date().toLocaleDateString("en-CA");
    const tgl = tanggalBaru || today;
    if (daftarTanggal.includes(tgl)) {
      alert(`Tanggal ${tgl} sudah ada di tabel.`);
      return;
    }
    const newList = [...daftarTanggal, tgl].sort();
    setDaftarTanggal(newList);

    // Otomatis default Hadir untuk semua siswa di tanggal baru
    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        const key = `${s.idSiswa}_${tgl}`;
        if (!salinan[key] || !salinan[key].status) {
          salinan[key] = { status: "Hadir", keterangan: "" };
        }
      });
      return salinan;
    });
    setTanggalBaru("");
    setHasUnsavedChanges(true);
  }

  function hapusHariTerakhir() {
    if (daftarTanggal.length === 0) return;
    const tglHapus = daftarTanggal[daftarTanggal.length - 1];
    const konfirmasi = window.confirm(
      `⚠️ Hapus kolom tanggal ${formatTanggalKolom(tglHapus)} (${tglHapus})?\n\n` +
        `Data presensi hari ini akan dihapus dari tabel saat ini. Lanjutkan?`,
    );
    if (!konfirmasi) return;

    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        delete salinan[`${s.idSiswa}_${tglHapus}`];
      });
      return salinan;
    });
    setDaftarTanggal((prev) => prev.slice(0, -1));
    setHasUnsavedChanges(true);
  }

  function hitungTotal(idSiswa) {
    const total = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Cabut: 0 };
    daftarTanggal.forEach((tgl) => {
      const cell = grid[`${idSiswa}_${tgl}`];
      if (cell?.status && total[cell.status] !== undefined) {
        total[cell.status]++;
      }
    });
    return total;
  }

  async function handleSimpanPresensi() {
    const cells = [];
    daftarTanggal.forEach((tgl) => {
      siswaList.forEach((s) => {
        const cell = grid[`${s.idSiswa}_${tgl}`];
        if (!cell?.status) return;
        cells.push({
          idSiswa: s.idSiswa,
          namaSiswa: s.nama,
          tanggal: tgl,
          status: cell.status,
          keterangan: cell.keterangan || "",
        });
      });
    });

    if (cells.length === 0) {
      alert("Belum ada data presensi yang diisi untuk disimpan.");
      return;
    }

    setSaving(true);
    try {
      const result = await savePresensiWaliKelas({
        idGuru: guru.id,
        idWali: wali.idWali,
        cells,
      });

      if (result.success) {
        alert(
          `✅ Presensi wali kelas berhasil disimpan!\nTotal: ${result.data?.tersimpan || cells.length} data tersimpan.`,
        );
        setHasUnsavedChanges(false);
      } else {
        alert(result.message || "Gagal menyimpan presensi.");
      }
    } catch (err) {
      console.error("ERROR SIMPAN PRESENSI WALI:", err);
      alert("Terjadi kesalahan saat menyimpan data presensi.");
    } finally {
      setSaving(false);
    }
  }

  async function hapusSiswaDariWali(siswa) {
    const konfirmasi = window.confirm(
      `Hapus "${siswa.nama}" dari Kelas Wali "${wali.namaKelas}"?\n\n` +
        `Data presensi dan jurnal bimbingan siswa di kelas ini akan ikut terhapus. Lanjutkan?`,
    );
    if (!konfirmasi) return;

    setMenghapusId(siswa.idSiswa);
    try {
      const result = await hapusSiswaWaliKelas({
        idWali: wali.idWali,
        idSiswa: siswa.idSiswa,
      });
      if (result.success) {
        setSiswaList((prev) => prev.filter((s) => s.idSiswa !== siswa.idSiswa));
        setGrid((prev) => {
          const salinan = { ...prev };
          Object.keys(salinan).forEach((k) => {
            if (k.startsWith(`${siswa.idSiswa}_`)) delete salinan[k];
          });
          return salinan;
        });
        alert(`✅ "${siswa.nama}" berhasil dihapus dari kelas wali ini.`);
      } else {
        alert(result.message || "Gagal menghapus siswa dari kelas wali.");
      }
    } catch (err) {
      console.error("ERROR HAPUS SISWA WALI:", err);
      alert("Terjadi kesalahan saat menghapus siswa.");
    } finally {
      setMenghapusId(null);
    }
  }

  async function handleCetakPdf() {
    try {
      setCetakLoading(true);
      await generateLaporanWaliKelasPDF({ guru, wali });
    } catch (err) {
      console.error("Gagal cetak PDF wali kelas:", err);
      alert(
        "Gagal mencetak laporan PDF: " + (err?.message || "Terjadi kesalahan"),
      );
    } finally {
      setCetakLoading(false);
    }
  }

  function handleRequestClose() {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  }

  const filteredSiswaList = useMemo(() => {
    if (!searchKeyword.trim()) return siswaList;
    const q = searchKeyword.toLowerCase();
    return siswaList.filter(
      (s) =>
        (s.nama || "").toLowerCase().includes(q) ||
        String(s.idSiswa || "")
          .toLowerCase()
          .includes(q),
    );
  }, [siswaList, searchKeyword]);

  if (!isOpen || !wali) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-1 sm:p-3 md:p-4 backdrop-blur-sm animate-fadeIn">
        <div className="flex w-full max-w-7xl max-h-[95vh] flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200">
          {/* HEADER MODAL */}
          <div className="shrink-0 bg-gradient-to-r from-teal-950 via-teal-900 to-slate-900 px-3.5 py-3 sm:px-5 sm:py-3.5 text-white shadow-md border-b border-teal-800/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Judul & Info Wali Kelas */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">📅</span>
                  <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight truncate text-white">
                    {wali.namaKelas}
                  </h2>
                  {wali.kelas && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-teal-700/60 border border-teal-400/40 text-teal-100">
                      Kelas {wali.kelas}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-900/60 border border-emerald-400/40 text-emerald-200">
                    👥 {siswaList.length} Siswa
                  </span>
                  {hasUnsavedChanges && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-amber-950 animate-pulse">
                      ● Ada Perubahan
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-teal-200/90 truncate mt-0.5">
                  Wali Kelas:{" "}
                  <span className="font-bold text-white">
                    {guru?.nama || "-"}
                  </span>
                  {wali.keterangan ? ` • ${wali.keterangan}` : ""}
                </p>
              </div>

              {/* Toolbar Aksi Header */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap shrink-0">
                {/* Cari Siswa */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="Cari siswa..."
                    className="w-28 sm:w-36 md:w-44 text-[10px] sm:text-xs pl-6 pr-2 py-1.5 rounded-xl bg-white/10 text-white placeholder:text-teal-200/60 border border-white/20 focus:bg-white focus:text-slate-800 focus:outline-none transition-all"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-teal-200/80">
                    🔍
                  </span>
                  {searchKeyword && (
                    <button
                      type="button"
                      onClick={() => setSearchKeyword("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-teal-200 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Tambah Siswa */}
                <button
                  type="button"
                  onClick={() => setShowTambahModal(true)}
                  className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 active:scale-95 text-white text-[10px] sm:text-xs font-black px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm transition-all flex items-center gap-1"
                >
                  <span>➕</span>
                  <span className="hidden sm:inline">Tambah Siswa</span>
                </button>

                {/* Cetak PDF */}
                <button
                  type="button"
                  onClick={handleCetakPdf}
                  disabled={cetakLoading}
                  className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:brightness-110 active:scale-95 text-white text-[10px] sm:text-xs font-black px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm transition-all flex items-center gap-1 disabled:opacity-60"
                >
                  {cetakLoading ? (
                    <>
                      <span className="animate-spin inline-block">⏳</span>
                      <span className="hidden sm:inline">Cetak...</span>
                    </>
                  ) : (
                    <>
                      <span>🖨️</span>
                      <span className="hidden sm:inline">PDF</span>
                    </>
                  )}
                </button>

                {/* Simpan Presensi */}
                <button
                  type="button"
                  onClick={handleSimpanPresensi}
                  disabled={saving}
                  className={`rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2 text-[10px] sm:text-xs font-black shadow-md transition-all flex items-center gap-1.5 ${
                    hasUnsavedChanges
                      ? "bg-gradient-to-r from-amber-400 to-yellow-400 text-amber-950 ring-2 ring-amber-300 animate-bounce"
                      : "bg-gradient-to-r from-teal-600 to-emerald-600 hover:brightness-110 text-white"
                  } disabled:opacity-60`}
                >
                  {saving ? (
                    <>
                      <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Simpan</span>
                    </>
                  )}
                </button>

                {/* Tutup */}
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="rounded-full bg-white/10 hover:bg-white/20 w-8 h-8 flex items-center justify-center text-xs font-bold text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* SUB-TOOLBAR KONTROL HARI / TANGGAL */}
          <div className="shrink-0 bg-slate-100 border-b border-slate-200 px-3.5 py-2 sm:px-5 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] sm:text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                Hari / Tanggal Presensi:
              </span>
              <span className="rounded-md bg-teal-100 border border-teal-200 text-teal-800 text-[10px] sm:text-xs font-black px-2 py-0.5">
                {daftarTanggal.length} Hari Aktif
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={tanggalBaru}
                  onChange={(e) => setTanggalBaru(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white text-[10px] sm:text-xs px-2 py-1 h-[30px] outline-none focus:border-teal-500 font-medium"
                />
                <button
                  type="button"
                  onClick={tambahHari}
                  className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 h-[30px] shadow-sm transition-all flex items-center gap-1"
                >
                  <span>➕ Tambah Hari</span>
                </button>
              </div>

              <button
                type="button"
                onClick={hapusHariTerakhir}
                disabled={daftarTanggal.length === 0}
                className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-[10px] sm:text-xs font-bold px-2.5 py-1 h-[30px] transition-all disabled:opacity-40"
              >
                <span>➖ Hapus Terakhir</span>
              </button>
            </div>
          </div>

          {/* AREA TABEL UTAMA */}
          <div className="flex-1 overflow-auto bg-slate-50 p-2 sm:p-4 custom-scrollbar">
            {loading ? (
              <div className="py-20 text-center">
                <div className="relative mx-auto h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-4 border-teal-200"></div>
                  <div className="absolute inset-0 rounded-full border-4 border-teal-600 border-t-transparent animate-spin"></div>
                </div>
                <p className="mt-4 text-xs font-black text-slate-500">
                  Memuat data presensi harian kelas...
                </p>
              </div>
            ) : filteredSiswaList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                <span className="text-4xl">👥</span>
                <h3 className="mt-3 text-sm font-black text-slate-700">
                  {siswaList.length === 0
                    ? "Belum Ada Siswa di Kelas Ini"
                    : "Siswa Tidak Ditemukan"}
                </h3>
                <p className="mt-1 text-xs text-slate-400 font-medium max-w-sm mx-auto">
                  {siswaList.length === 0
                    ? "Klik tombol 'Tambah Siswa' untuk menambahkan siswa ke kelas wali ini."
                    : `Tidak ada siswa yang cocok dengan pencarian "${searchKeyword}".`}
                </p>
                {siswaList.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTambahModal(true)}
                    className="mt-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black px-4 py-2 shadow-md transition-all inline-flex items-center gap-1.5"
                  >
                    <span>➕</span>
                    <span>Tambah Siswa Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden relative w-full">
                <div
                  className="overflow-auto custom-scrollbar relative max-h-[62vh] overscroll-contain"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  <table className="border-separate border-spacing-0 whitespace-nowrap text-[9px] sm:text-[10px] min-w-max w-full">
                    <thead className="bg-slate-100 text-slate-800 shadow-sm leading-none">
                      <tr>
                        <th className="px-1 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-0 bg-slate-100 z-[70] w-[28px] sm:w-[32px] min-w-[28px] text-center">
                          No
                        </th>
                        <th
                          className="px-1.5 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-[28px] sm:left-[32px] bg-slate-100 z-[80] text-left shadow-[5px_0_10px_-5px_rgba(0,0,0,0.1)] w-[190px] min-w-[190px] max-w-[190px]"
                          style={{
                            position: "sticky",
                            left: "28px",
                            zIndex: 80,
                          }}
                        >
                          Nama Siswa
                        </th>

                        {daftarTanggal.map((tgl) => (
                          <th
                            key={tgl}
                            className="px-0.5 py-1.5 font-black border-b-2 border-slate-300 border-l border-slate-200 text-center min-w-[50px] sm:min-w-[55px] sticky top-0 bg-slate-100 z-40"
                          >
                            <div className="text-[9px] sm:text-[10px] text-slate-800">
                              <span className="bg-teal-100 text-teal-800 px-1 py-0.5 rounded text-[9px] font-bold">
                                {formatTanggalKolom(tgl)}
                              </span>
                            </div>
                          </th>
                        ))}

                        {/* Kolom Total */}
                        <th className="px-1 py-1 font-black border-b-2 border-slate-300 border-l-2 border-slate-300 text-center sticky top-0 bg-slate-200/80 z-50">
                          <div className="w-[100px] min-w-[100px] max-w-[100px] mx-auto">
                            <div className="text-[9px] sm:text-[10px] mb-0.5 uppercase tracking-widest text-slate-600 font-extrabold">
                              TOTAL
                            </div>
                            <div className="flex items-center justify-center gap-1 text-[9px] leading-none bg-white py-0.5 rounded shadow-sm border border-slate-200">
                              <span
                                className="w-4 text-emerald-700 font-bold"
                                title="Hadir"
                              >
                                H
                              </span>
                              <span
                                className="w-4 text-blue-700 font-bold"
                                title="Sakit"
                              >
                                S
                              </span>
                              <span
                                className="w-4 text-amber-600 font-bold"
                                title="Izin"
                              >
                                I
                              </span>
                              <span
                                className="w-4 text-rose-700 font-bold"
                                title="Alfa"
                              >
                                A
                              </span>
                              <span
                                className="w-4 text-violet-700 font-bold"
                                title="Cabut"
                              >
                                C
                              </span>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {filteredSiswaList.map((s, idx) => {
                        const total = hitungTotal(s.idSiswa);
                        const isEven = idx % 2 === 1;

                        return (
                          <tr
                            key={s.idSiswa}
                            className={`transition-colors group ${
                              isEven
                                ? "bg-slate-50/70 hover:bg-teal-50 focus-within:bg-teal-50"
                                : "bg-white hover:bg-teal-50 focus-within:bg-teal-50"
                            }`}
                          >
                            <td
                              className={`px-1 py-1 border-b border-slate-200 sticky left-0 group-hover:bg-teal-50 group-focus-within:bg-teal-50 z-[70] font-bold text-center text-slate-600 w-[28px] sm:w-[32px] min-w-[28px] transition-colors ${
                                isEven ? "bg-slate-50" : "bg-white"
                              }`}
                            >
                              {idx + 1}
                            </td>

                            <td
                              className={`px-1.5 py-1 border-b border-slate-200 sticky left-[28px] sm:left-[32px] group-hover:bg-teal-50 group-focus-within:bg-teal-50 z-[60] shadow-[5px_0_10px_-5px_rgba(0,0,0,0.08)] w-[190px] min-w-[190px] max-w-[190px] transition-colors ${
                                isEven ? "bg-slate-50" : "bg-white"
                              }`}
                              style={{
                                position: "sticky",
                                left: "28px",
                                zIndex: 60,
                              }}
                            >
                              <div className="flex flex-col justify-center h-full w-full min-w-0 overflow-hidden">
                                <p
                                  className="font-black text-slate-800 text-[10px] sm:text-[11px] leading-none truncate w-full"
                                  title={s.nama}
                                >
                                  {s.nama}
                                </p>
                                <div className="flex items-center justify-between mt-0.5 w-full">
                                  <div className="flex items-center gap-1 min-w-0 overflow-hidden mr-1">
                                    {s.kelas && (
                                      <span className="truncate rounded bg-teal-50 text-teal-700 border border-teal-200 px-1 py-0 text-[7px] font-bold">
                                        {s.kelas}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => hapusSiswaDariWali(s)}
                                    disabled={menghapusId === s.idSiswa}
                                    title="Hapus siswa dari kelas wali"
                                    className="shrink-0 flex h-4 w-4 items-center justify-center rounded bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white text-[8px] disabled:opacity-50 transition-all shadow-sm"
                                  >
                                    {menghapusId === s.idSiswa ? "⏳" : "✕"}
                                  </button>
                                </div>
                              </div>
                            </td>

                            {daftarTanggal.map((tgl) => {
                              const key = `${s.idSiswa}_${tgl}`;
                              const cell = grid[key] || {
                                status: "",
                                keterangan: "",
                              };

                              return (
                                <td
                                  key={tgl}
                                  className="p-0.5 border-b border-slate-200 border-l border-slate-200/80 text-center align-middle hover:bg-teal-100/70 focus-within:bg-teal-100/80 transition-colors"
                                >
                                  <select
                                    value={cell.status}
                                    onChange={(e) =>
                                      updateCell(
                                        s.idSiswa,
                                        tgl,
                                        "status",
                                        e.target.value,
                                      )
                                    }
                                    className={`cursor-pointer rounded border text-[9px] sm:text-[10px] font-black h-[21px] px-0.5 shadow-sm hover:scale-105 transition-all appearance-none outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 w-[50px] ${warnaStatus(cell.status)}`}
                                    style={{ textAlignLast: "center" }}
                                  >
                                    <option hidden value={cell.status}>
                                      {cell.status
                                        ? cell.status.charAt(0)
                                        : "-"}
                                    </option>
                                    <option
                                      value=""
                                      className="bg-white text-slate-800"
                                    >
                                      -
                                    </option>
                                    {STATUS_OPTIONS.map((opt) => (
                                      <option
                                        key={opt.value}
                                        value={opt.value}
                                        className="bg-white text-slate-800"
                                      >
                                        {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              );
                            })}

                            {/* Total */}
                            <td
                              className={`px-1 py-1 border-b border-l-2 border-slate-200 group-hover:bg-teal-50 group-focus-within:bg-teal-50 transition-colors text-center ${
                                isEven ? "bg-slate-100/70" : "bg-slate-50/50"
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 w-[100px] min-w-[100px] max-w-[100px] mx-auto leading-none font-bold">
                                <span className="w-4 text-[10px] text-emerald-600 bg-emerald-100 py-0.5 rounded">
                                  {total.Hadir}
                                </span>
                                <span className="w-4 text-[10px] text-blue-600 bg-blue-100 py-0.5 rounded">
                                  {total.Sakit}
                                </span>
                                <span className="w-4 text-[10px] text-amber-600 bg-amber-100 py-0.5 rounded">
                                  {total.Izin}
                                </span>
                                <span className="w-4 text-[10px] text-rose-600 bg-rose-100 py-0.5 rounded">
                                  {total.Alfa}
                                </span>
                                <span className="w-4 text-[10px] text-violet-600 bg-violet-100 py-0.5 rounded">
                                  {total.Cabut}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* FOOTER MODAL */}
          <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-2.5 sm:px-5 flex items-center justify-between text-[11px] text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">
                {filteredSiswaList.length} Siswa Terdaftar
              </span>
              {hasUnsavedChanges && (
                <span className="text-amber-600 font-bold">
                  ⚠️ Jangan lupa tekan &quot;Simpan&quot; sebelum keluar
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleRequestClose}
              className="rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-1.5 font-bold transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* MODAL KONFIRMASI TUTUP SAAT PERUBAHAN BELUM DISIMPAN */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-5 sm:p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-150">
            <h3 className="font-black text-slate-800 text-base sm:text-lg mb-2">
              Simpan Perubahan?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 font-medium leading-relaxed">
              Ada perubahan data presensi yang belum disimpan. Apakah Bapak/Ibu
              ingin menyimpannya sekarang?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  await handleSimpanPresensi();
                  setShowCloseConfirm(false);
                  onClose();
                }}
                className="w-full rounded-xl bg-teal-600 text-white text-xs sm:text-sm font-black py-2.5 hover:bg-teal-700 transition-colors shadow-sm"
              >
                💾 Simpan & Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  onClose();
                }}
                className="w-full rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-xs sm:text-sm font-black py-2.5 hover:bg-rose-100 transition-colors"
              >
                🗑️ Tutup Tanpa Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="w-full rounded-xl bg-slate-100 text-slate-600 text-xs sm:text-sm font-bold py-2 hover:bg-slate-200 transition-colors"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH SISWA KE KELAS WALI */}
      {showTambahModal && (
        <ModalTambahSiswaWali
          isOpen={showTambahModal}
          onClose={() => setShowTambahModal(false)}
          guru={guru}
          wali={wali}
          onSiswaAdded={() => {
            loadGrid();
          }}
        />
      )}
    </>
  );
}
