"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  getPresensiMapelGrid,
  savePresensiMapel,
  hapusSiswaMapel,
  uploadTugasMapel,
  getTugasMapel,
  getJawabanSiswa,
} from "../../lib/api";
import { generateLaporanMapelPDF } from "./generateLaporanMapelPDF";
import ModalTambahSiswa from "./kelola/ModalTambahSiswa";

const PERTEMUAN_MAX = 20;
const NILAI_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 5); // 5 s.d 100

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
      return "bg-white text-slate-500 border-slate-300 hover:border-blue-400";
  }
}

export default function ModalPresensiMapel({ isOpen, onClose, guru, mapel }) {
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0); // progress bar saat memuat
  const [siswaList, setSiswaList] = useState([]);
  const [grid, setGrid] = useState({});
  const [tanggalPertemuan, setTanggalPertemuan] = useState({});
  const [jumlahPertemuan, setJumlahPertemuan] = useState(1);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [menghapusId, setMenghapusId] = useState(null);
  const [menambahId, setMenambahId] = useState(null); // loading saat tambah siswa
  const [cetakLoading, setCetakLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState("");
  const [showTambahModal, setShowTambahModal] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  // Bar merayap pelan (maks 88%) selama menunggu server
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => {
      setLoadProgress((p) => (p < 88 ? p + (88 - p) * 0.06 : p));
    }, 300);
    return () => clearInterval(t);
  }, [loading]);

  // State khusus Mapel Online
  const isMapelOnline = String(mapel?.keterangan || "").startsWith("[ONLINE]");
  const [tugasMapel, setTugasMapel] = useState({}); // { [pertemuanKe]: tugasObj }
  const [jawabanSiswa, setJawabanSiswa] = useState({}); // { [`${idSiswa}_${pertemuanKe}`]: jawabanObj }
  const [modalTugasOpen, setModalTugasOpen] = useState(false);
  const [targetTugasP, setTargetTugasP] = useState(null);
  const [judulTugasInput, setJudulTugasInput] = useState("");
  const [deskripsiTugasInput, setDeskripsiTugasInput] = useState("");
  const [fileTugasInput, setFileTugasInput] = useState(null);
  const [uploadingTugas, setUploadingTugas] = useState(false);

  // Muat data saat modal dibuka atau mapel berubah
  useEffect(() => {
    if (isOpen && mapel?.idMapel && guru?.id) {
      loadGrid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mapel?.idMapel, guru?.id]);

  async function loadGrid() {
    try {
      setLoading(true);
      setLoadProgress(8);
      const result = await getPresensiMapelGrid(guru.id, mapel.idMapel);
      setLoadProgress(65);
      const data = result.success ? result.data : { siswa: [], presensi: [] };

      const daftarSiswa = (data.siswa || [])
        .slice()
        .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
      setSiswaList(daftarSiswa);

      const gridBaru = {};
      const tanggalBaru = {};
      let maxP = 1;

      (data.presensi || []).forEach((p) => {
        if (!p.pertemuanKe) return;
        if (p.pertemuanKe > maxP) maxP = p.pertemuanKe;

        gridBaru[`${p.idSiswa}_${p.pertemuanKe}`] = {
          status: p.status || "",
          nilai: p.nilai ?? "",
        };
        if (p.tanggal && !tanggalBaru[p.pertemuanKe]) {
          tanggalBaru[p.pertemuanKe] = p.tanggal;
        }
      });

      setGrid(gridBaru);
      setTanggalPertemuan(tanggalBaru);
      setJumlahPertemuan(Math.min(PERTEMUAN_MAX, maxP));
      setHasUnsavedChanges(false);

      // Jika mapel online, muat tugas guru dan jawaban siswa
      if (isMapelOnline) {
        try {
          const resTugas = await getTugasMapel(mapel.idMapel, "");
          if (resTugas?.success && Array.isArray(resTugas.data)) {
            const tMap = {};
            resTugas.data.forEach((t) => {
              if (t.pertemuanKe) tMap[Number(t.pertemuanKe)] = t;
            });
            setTugasMapel(tMap);
          }
          const resJwb = await getJawabanSiswa(mapel.idMapel, "", "");
          if (resJwb?.success && Array.isArray(resJwb.data)) {
            const jMap = {};
            resJwb.data.forEach((j) => {
              if (j.idSiswa && j.pertemuanKe) {
                jMap[`${j.idSiswa}_${j.pertemuanKe}`] = j;
              }
            });
            setJawabanSiswa(jMap);
          }
        } catch (errTugas) {
          console.warn("Gagal memuat data tugas/jawaban online:", errTugas);
        }
      }
    } catch (err) {
      console.error("ERROR LOAD GRID PRESENSI MAPEL:", err);
      alert("Gagal memuat data presensi mapel.");
    } finally {
      setLoadProgress(100);
      setLoading(false);
    }
  }

  function bukaModalTugas(p) {
    setTargetTugasP(p);
    const existing = tugasMapel[p];
    setJudulTugasInput(existing?.judulTugas || `Tugas Pertemuan ${p}`);
    setDeskripsiTugasInput(existing?.deskripsi || "");
    setFileTugasInput(null);
    setModalTugasOpen(true);
  }

  async function handleSimpanTugas() {
    if (!targetTugasP) return;
    if (!judulTugasInput.trim()) {
      alert("Judul tugas wajib diisi.");
      return;
    }
    setUploadingTugas(true);
    try {
      let fileBase64 = "";
      let namaFile = "";
      let mimeType = "";
      if (fileTugasInput) {
        fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(fileTugasInput);
        });
        namaFile = fileTugasInput.name;
        mimeType = fileTugasInput.type || "application/pdf";
      }
      const existing = tugasMapel[targetTugasP];
      const res = await uploadTugasMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        pertemuanKe: targetTugasP,
        judulTugas: judulTugasInput.trim(),
        deskripsi: deskripsiTugasInput.trim(),
        fileUrl: existing?.fileUrl || "",
        fileBase64,
        namaFile,
        mimeType,
      });

      if (res?.success) {
        alert("✅ Tugas berhasil disimpan.");
        setTugasMapel((prev) => ({
          ...prev,
          [targetTugasP]: {
            ...prev[targetTugasP],
            judulTugas: judulTugasInput.trim(),
            deskripsi: deskripsiTugasInput.trim(),
            fileUrl: res.data?.fileUrl || existing?.fileUrl || "",
          },
        }));
        setModalTugasOpen(false);
      } else {
        alert(res?.message || "Gagal menyimpan tugas.");
      }
    } catch (e) {
      console.error("Gagal simpan tugas:", e);
      alert("Terjadi kesalahan saat mengunggah tugas.");
    } finally {
      setUploadingTugas(false);
    }
  }

  function updateCell(idSiswa, pertemuanKe, field, value) {
    const key = `${idSiswa}_${pertemuanKe}`;
    setGrid((prev) => {
      const current = prev[key] || { status: "", nilai: "" };
      const updated = { ...current, [field]: value };
      if (field === "status" && value !== "Hadir") {
        updated.nilai = "";
      }
      return { ...prev, [key]: updated };
    });
    setHasUnsavedChanges(true);
  }

  function updateTanggalPertemuan(pertemuanKe, value) {
    setTanggalPertemuan((prev) => ({ ...prev, [pertemuanKe]: value }));
    setHasUnsavedChanges(true);
  }

  function tambahKolomPertemuan() {
    if (jumlahPertemuan >= PERTEMUAN_MAX) return;
    const nextP = jumlahPertemuan + 1;
    setJumlahPertemuan(nextP);

    // Otomatis isi tanggal hari ini jika belum ada
    setTanggalPertemuan((prev) => {
      if (!prev[nextP]) {
        const today = new Date().toLocaleDateString("en-CA");
        return { ...prev, [nextP]: today };
      }
      return prev;
    });

    // Otomatis default Hadir untuk semua siswa
    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        const key = `${s.idSiswa}_${nextP}`;
        if (!salinan[key] || !salinan[key].status) {
          salinan[key] = {
            status: "Hadir",
            nilai: salinan[key]?.nilai || "",
          };
        }
      });
      return salinan;
    });
    setHasUnsavedChanges(true);
  }

  function kurangiKolomPertemuan() {
    if (jumlahPertemuan <= 1) return;

    const konfirmasi = window.confirm(
      `⚠️ Hapus kolom Pertemuan ${jumlahPertemuan}?\n\nData presensi dan nilai pada pertemuan ini akan dihapus dari tabel saat ini. Lanjutkan?`,
    );
    if (!konfirmasi) return;

    const pDihapus = jumlahPertemuan;
    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        delete salinan[`${s.idSiswa}_${pDihapus}`];
      });
      return salinan;
    });
    setTanggalPertemuan((prev) => {
      const salinan = { ...prev };
      delete salinan[pDihapus];
      return salinan;
    });
    setJumlahPertemuan((prev) => Math.max(1, prev - 1));
    setHasUnsavedChanges(true);
  }

  function hitungTotal(idSiswa) {
    const total = {
      Hadir: 0,
      Sakit: 0,
      Izin: 0,
      Alfa: 0,
      Cabut: 0,
      jumlahNilai: 0,
    };

    for (let p = 1; p <= jumlahPertemuan; p++) {
      const cell = grid[`${idSiswa}_${p}`];
      if (cell?.status && total[cell.status] !== undefined) {
        total[cell.status]++;
      }
      if (
        cell?.status === "Hadir" &&
        cell?.nilai !== "" &&
        cell?.nilai !== undefined
      ) {
        const n = Number(cell.nilai);
        if (Number.isFinite(n)) {
          total.jumlahNilai += n;
        }
      }
    }

    return total;
  }

  async function handleSimpanPresensi() {
    const cells = [];
    Object.entries(grid).forEach(([key, val]) => {
      if (!val.status) return;
      const [idSiswa, pertemuanKe] = key.split("_");
      const pKe = Number(pertemuanKe);
      if (pKe > jumlahPertemuan) return;
      const siswa = siswaList.find((s) => String(s.idSiswa) === idSiswa);
      cells.push({
        idSiswa,
        namaSiswa: siswa?.nama || "",
        pertemuanKe: pKe,
        tanggal: tanggalPertemuan[pertemuanKe] || "",
        status: val.status,
        nilaiHarian: val.status === "Hadir" ? val.nilai : "",
      });
    });

    if (cells.length === 0) {
      alert("Belum ada data presensi yang diisi untuk disimpan.");
      return;
    }

    setSaving(true);
    try {
      const result = await savePresensiMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        cells,
      });

      if (result.success) {
        alert(
          `✅ Presensi & Nilai berhasil disimpan!\nDiperbarui: ${result.data?.diperbarui || 0} • Baris baru: ${result.data?.ditambah || 0}`,
        );
        setHasUnsavedChanges(false);
      } else {
        alert(result.message || "Gagal menyimpan presensi.");
      }
    } catch (err) {
      console.error("ERROR SIMPAN PRESENSI:", err);
      alert("Terjadi kesalahan saat menyimpan data presensi.");
    } finally {
      setSaving(false);
    }
  }

  async function hapusSiswaDariMapel(siswa) {
    const konfirmasi = window.confirm(
      `Hapus "${siswa.nama}" dari mapel "${mapel.namaMapel}"?\n\n` +
        `• Jika siswa ini TIDAK terdaftar di mapel lain, TIDAK punya Guru Pembimbing Magang, TIDAK punya Guru Wali PKL, dan TIDAK terdaftar di kelas Wali Kelas, sistem akan otomatis menghapusnya dari database sekolah.\n` +
        `• Jika masih aktif di mapel lain, kelas wali, atau kegiatan magang, siswa HANYA dihapus dari mapel ini saja dan data induknya tetap aman.\n\nLanjutkan?`,
    );
    if (!konfirmasi) return;

    setMenghapusId(siswa.idSiswa);
    try {
      const result = await hapusSiswaMapel({
        idMapel: mapel.idMapel,
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
        if (result.data?.action === "hapus_permanen_dari_sistem") {
          alert(
            `✅ "${siswa.nama}" dihapus PERMANEN dari sistem (tidak terdaftar di mapel lain / Guru Pembimbing / Guru Wali / Wali Kelas).`,
          );
        } else {
          alert(
            `✅ "${siswa.nama}" berhasil dihapus dari mapel ini.\n(Data induk siswa di sistem tetap aman karena masih aktif di Wali Kelas, mapel lain, atau bimbingan magang).`,
          );
        }
      } else {
        alert(result.message || "Gagal menghapus siswa dari mapel.");
      }
    } catch (err) {
      console.error("ERROR HAPUS SISWA MAPEL:", err);
      alert("Terjadi kesalahan saat menghapus siswa.");
    } finally {
      setMenghapusId(null);
    }
  }

  async function handleCetakPdf() {
    setCetakLoading(true);
    try {
      await generateLaporanMapelPDF({
        guru,
        mapel,
        siswaList,
        grid,
        tanggalPertemuan,
        jumlahPertemuan,
      });
    } catch (err) {
      console.error("Gagal cetak PDF:", err);
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
      onClose(false); // tidak ada perubahan — jangan refresh kartu
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
          .includes(q) ||
        (s.namaGuruWali || "").toLowerCase().includes(q),
    );
  }, [siswaList, searchKeyword]);

  const currentPertemuanArray = Array.from(
    { length: jumlahPertemuan },
    (_, i) => i + 1,
  );

  if (!isOpen || !mapel) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-1 sm:p-3 md:p-4 backdrop-blur-sm animate-fadeIn">
        <div className="flex w-full max-w-7xl max-h-[95vh] flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200">
          {/* HEADER MODAL */}
          <div className="shrink-0 bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 px-3.5 py-3 sm:px-5 sm:py-3.5 text-white shadow-md border-b border-blue-800/60">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              {/* Judul & Info Mapel */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xl">📊</span>
                  <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight truncate text-white">
                    {mapel.namaMapel}
                  </h2>
                  {mapel.kelas && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-700/60 border border-blue-400/40 text-blue-100">
                      Kelas {mapel.kelas}
                    </span>
                  )}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-900/60 border border-cyan-400/40 text-cyan-200">
                    👥 {siswaList.length} Siswa
                  </span>
                  {hasUnsavedChanges && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-amber-950 animate-pulse">
                      ● Ada Perubahan
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-blue-200/90 truncate mt-0.5">
                  Guru:{" "}
                  <span className="font-bold text-white">
                    {guru?.nama || "-"}
                  </span>
                  {mapel.keterangan ? ` • ${mapel.keterangan}` : ""}
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
                    className="w-28 sm:w-36 md:w-44 text-[10px] sm:text-xs pl-6 pr-2 py-1.5 rounded-xl bg-white/10 text-white placeholder:text-blue-200/60 border border-white/20 focus:bg-white focus:text-slate-800 focus:outline-none transition-all"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-200/80">
                    🔍
                  </span>
                  {searchKeyword && (
                    <button
                      type="button"
                      onClick={() => setSearchKeyword("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-blue-200 hover:text-white"
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
                      : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white"
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

                {/* Tombol Tutup */}
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-black p-1.5 sm:px-2.5 sm:py-2 transition-all ml-1"
                  title="Tutup Popup"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>

          {/* BODY: TABEL PRESENSI PADAT & RESPONSIF */}
          <div className="flex-1 overflow-hidden p-2 sm:p-3 bg-slate-50 flex flex-col min-h-0">
            {loading ? (
              <div className="py-20 flex items-center justify-center p-6">
                <div className="w-full max-w-xs text-center">
                  <p className="mb-4 text-base font-bold text-slate-600 tracking-wide">
                    Memuat presensi & nilai {mapel?.namaMapel || ""}...
                  </p>
                  <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ease-out ${isMapelOnline ? "bg-gradient-to-r from-teal-400 to-emerald-500" : "bg-gradient-to-r from-blue-500 to-indigo-600"}`}
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs font-black text-slate-400">
                    {Math.round(loadProgress)}%
                  </p>
                </div>
              </div>
            ) : siswaList.length === 0 ? (
              <div className="rounded-2xl bg-white border border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-xs my-auto">
                <span className="text-4xl sm:text-5xl block mb-2">👥</span>
                <h4 className="text-sm sm:text-base font-black text-slate-700">
                  Belum Ada Siswa di Mapel Ini
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                  Daftarkan siswa kelas {mapel.kelas || ""} ke mapel ini agar
                  Anda bisa mulai mengisi presensi dan nilai harian.
                </p>
                <button
                  type="button"
                  onClick={() => setShowTambahModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black shadow-md hover:brightness-110 active:scale-95"
                >
                  <span>➕</span>
                  <span>Tambah Siswa Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex-1 flex flex-col relative w-full">
                {/* KONTENER SCROLLABLE */}
                <div
                  className="overflow-auto custom-scrollbar flex-1 relative overscroll-contain touch-pan-x touch-pan-y"
                  style={{ WebkitOverflowScrolling: "touch" }}
                  onScroll={(e) => {
                    if (e.currentTarget.scrollLeft > 10) {
                      e.currentTarget.classList.add("is-scrolled");
                    } else {
                      e.currentTarget.classList.remove("is-scrolled");
                    }
                  }}
                >
                  <table className="border-separate border-spacing-0 whitespace-nowrap text-[9px] sm:text-[10px] min-w-max w-full [&_.col-nama]:transition-all [&_.col-nama]:duration-300 [.is-scrolled_&_.col-nama]:!w-[150px] [.is-scrolled_&_.col-nama]:!min-w-[150px] [.is-scrolled_&_.col-nama]:!max-w-[150px]">
                    {/* THEAD */}
                    <thead className="bg-slate-100 text-slate-800 shadow-sm leading-none">
                      <tr>
                        {/* NO */}
                        <th className="px-1 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-0 bg-slate-100 z-[70] w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] text-center">
                          No
                        </th>

                        {/* NAMA SISWA */}
                        <th
                          className="col-nama px-2 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-[28px] sm:left-[32px] bg-slate-100 z-[80] text-left shadow-[4px_0_8px_-4px_rgba(0,0,0,0.12)] w-[180px] sm:w-[210px] min-w-[180px] sm:min-w-[210px] max-w-[210px]"
                          style={{
                            position: "sticky",
                            left: "28px",
                            zIndex: 80,
                          }}
                        >
                          <div className="w-full flex items-center justify-between">
                            <span className="truncate">Nama Siswa</span>
                            {searchKeyword && (
                              <span className="text-[8px] font-semibold text-blue-600 bg-blue-50 px-1 py-0.5 rounded">
                                {filteredSiswaList.length}/{siswaList.length}
                              </span>
                            )}
                          </div>
                        </th>

                        {/* PERTEMUAN KOLOM (DINAMIS) */}
                        {currentPertemuanArray.map((p) => (
                          <th
                            key={p}
                            className={`px-1 py-1.5 font-black border-b-2 border-slate-300 border-l border-slate-200 text-center sticky top-0 bg-slate-100 z-40 ${isMapelOnline ? "min-w-[85px] sm:min-w-[95px]" : "min-w-[62px] sm:min-w-[70px]"}`}
                          >
                            <div className="mb-1 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] text-slate-800">
                              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-black text-[9px]">
                                Pert. {p}
                              </span>

                              {p === jumlahPertemuan && (
                                <div className="flex flex-row items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={kurangiKolomPertemuan}
                                    disabled={jumlahPertemuan <= 1}
                                    className="h-4 w-4 rounded bg-rose-500 text-white flex items-center justify-center text-[10px] font-black hover:bg-rose-600 hover:scale-110 disabled:opacity-50 shadow-xs transition-all"
                                    title="Kurangi kolom pertemuan"
                                  >
                                    -
                                  </button>
                                  <button
                                    type="button"
                                    onClick={tambahKolomPertemuan}
                                    disabled={jumlahPertemuan >= PERTEMUAN_MAX}
                                    className="h-4 w-4 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-black hover:bg-blue-700 hover:scale-110 disabled:opacity-50 shadow-xs transition-all"
                                    title="Tambah kolom pertemuan"
                                  >
                                    +
                                  </button>
                                </div>
                              )}
                            </div>

                            <input
                              type="date"
                              value={tanggalPertemuan[p] || ""}
                              onChange={(e) =>
                                updateTanggalPertemuan(p, e.target.value)
                              }
                              className="w-full max-w-[75px] h-[19px] rounded border border-slate-300 text-[8px] sm:text-[9px] px-0.5 py-0 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none mx-auto block cursor-pointer transition-all shadow-inner"
                            />

                            {/* Badge Tugas Guru di header kolom — lebih besar & informatif */}
                            {isMapelOnline && (
                              <div className="mt-1.5 flex items-center justify-center">
                                {tugasMapel[p] ? (
                                  <button
                                    type="button"
                                    onClick={() => bukaModalTugas(p)}
                                    className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all w-full"
                                    title={`Edit Tugas P-${p}: ${tugasMapel[p].judulTugas}`}
                                  >
                                    <span className="text-[10px] font-black leading-none">📎 Ada Tugas</span>
                                    <span className="text-[8px] font-semibold opacity-90 truncate w-full text-center max-w-[60px]">{tugasMapel[p].judulTugas}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => bukaModalTugas(p)}
                                    className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 border border-dashed border-slate-300 hover:border-blue-400 text-[9px] font-bold transition-all w-full justify-center"
                                    title="Upload tugas guru untuk pertemuan ini"
                                  >
                                    <span>➕</span>
                                    <span>Tugas</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </th>
                        ))}

                        {/* REKAP TOTAL */}
                        <th className="px-1.5 py-1.5 font-black border-b-2 border-slate-300 border-l-2 border-slate-300 text-center sticky top-0 bg-slate-200/90 z-50">
                          <div className="w-[136px] min-w-[136px] max-w-[136px] mx-auto">
                            <div className="text-[8px] sm:text-[9px] mb-0.5 uppercase tracking-widest text-slate-600 font-extrabold">
                              TOTAL
                            </div>

                            <div className="flex items-center justify-center gap-1 text-[8px] sm:text-[9px] leading-none bg-white py-0.5 rounded shadow-xs border border-slate-200 font-black">
                              <span
                                className="w-4 text-emerald-700"
                                title="Hadir"
                              >
                                H
                              </span>
                              <span className="w-4 text-blue-700" title="Sakit">
                                S
                              </span>
                              <span className="w-4 text-amber-600" title="Izin">
                                I
                              </span>
                              <span className="w-4 text-rose-700" title="Alfa">
                                A
                              </span>
                              <span
                                className="w-4 text-violet-700"
                                title="Cabut"
                              >
                                C
                              </span>
                              <span
                                className="w-5 text-fuchsia-700"
                                title="Total Nilai"
                              >
                                Nilai
                              </span>
                            </div>
                          </div>
                        </th>
                      </tr>
                    </thead>

                    {/* TBODY */}
                    <tbody className="divide-y divide-slate-200">
                      {filteredSiswaList.map((s, idx) => {
                        const total = hitungTotal(s.idSiswa);
                        const isEven = idx % 2 === 1;

                        return (
                          <tr
                            key={s.idSiswa}
                            className={`transition-colors group ${
                              isEven
                                ? "bg-slate-50/70 hover:bg-blue-50/80 focus-within:bg-blue-50/80"
                                : "bg-white hover:bg-blue-50/80 focus-within:bg-blue-50/80"
                            }`}
                          >
                            {/* NO */}
                            <td
                              className={`px-1 py-1 border-b border-slate-200 sticky left-0 group-hover:bg-blue-50 group-focus-within:bg-blue-50 z-[70] font-bold text-center text-slate-600 w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] transition-colors ${
                                isEven ? "bg-slate-50" : "bg-white"
                              }`}
                            >
                              {idx + 1}
                            </td>

                            {/* NAMA SISWA */}
                            <td
                              className={`col-nama px-2 py-1 border-b border-slate-200 sticky left-[28px] sm:left-[32px] group-hover:bg-blue-50 group-focus-within:bg-blue-50 z-[60] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] w-[180px] sm:w-[210px] min-w-[180px] sm:min-w-[210px] max-w-[210px] transition-colors ${
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
                                  className="font-black text-slate-800 text-[10px] sm:text-[11px] leading-tight truncate w-full"
                                  title={s.nama}
                                >
                                  {s.nama}
                                </p>

                                <div className="flex items-center justify-between mt-0.5 w-full gap-1">
                                  <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                                    <span className="shrink-0 text-[7px] sm:text-[8px] text-slate-500 font-semibold bg-slate-100 px-1 py-0 rounded">
                                      ID: {s.idSiswa}
                                    </span>

                                    {s.namaGuruWali ? (
                                      <span className="truncate rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0 text-[7px] font-bold">
                                        Wali: {s.namaGuruWali}
                                      </span>
                                    ) : (
                                      <span className="shrink-0 rounded bg-red-50 text-red-500 border border-red-200 px-1 py-0 text-[7px] font-bold">
                                        Tanpa Wali
                                      </span>
                                    )}
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => hapusSiswaDariMapel(s)}
                                    disabled={menghapusId === s.idSiswa}
                                    title="Hapus siswa dari mapel ini"
                                    className="shrink-0 flex h-4 w-4 items-center justify-center rounded bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white text-[8px] font-bold disabled:opacity-50 transition-all shadow-xs"
                                  >
                                    {menghapusId === s.idSiswa ? "⏳" : "✕"}
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* PERTEMUAN CELLS */}
                            {currentPertemuanArray.map((p) => {
                              const key = `${s.idSiswa}_${p}`;
                              const cell = grid[key] || {
                                status: "",
                                nilai: "",
                              };
                              const isHadir = cell.status === "Hadir";

                              return (
                                <td
                                  key={p}
                                  className="p-0.5 border-b border-slate-200 border-l border-slate-200/80 text-center align-middle hover:bg-blue-100/60 focus-within:bg-blue-100/70 transition-colors"
                                >
                                  <div className="flex flex-col items-center justify-center gap-1 w-full h-full py-0.5">
                                    <div className="flex flex-row items-center justify-center gap-0.5">
                                      {/* STATUS SELECT */}
                                      <select
                                        value={cell.status}
                                        onChange={(e) =>
                                          updateCell(
                                            s.idSiswa,
                                            p,
                                            "status",
                                            e.target.value,
                                          )
                                        }
                                        className={`cursor-pointer rounded border text-[9px] sm:text-[10px] font-black h-[21px] px-0.5 shadow-xs hover:scale-105 transition-all appearance-none outline-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600 ${warnaStatus(cell.status)}`}
                                        style={{
                                          width: isHadir ? "35px" : "48px",
                                          textAlignLast: "center",
                                        }}
                                      >
                                        <option hidden value={cell.status}>
                                          {isHadir ? "H" : cell.status || "-"}
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

                                      {/* NILAI SELECT (JIKA HADIR) */}
                                      {isHadir && (
                                        <select
                                          value={cell.nilai}
                                          onChange={(e) =>
                                            updateCell(
                                              s.idSiswa,
                                              p,
                                              "nilai",
                                              e.target.value,
                                            )
                                          }
                                          title="Nilai Harian"
                                          className="cursor-pointer rounded border border-emerald-500 text-[9px] sm:text-[10px] h-[21px] px-0.5 text-center font-black bg-white text-emerald-800 shadow-xs hover:bg-emerald-50 hover:border-emerald-600 hover:scale-105 transition-all appearance-none outline-none focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
                                          style={{
                                            width: "35px",
                                            textAlignLast: "center",
                                          }}
                                        >
                                          <option value="">Nil</option>
                                          {NILAI_OPTIONS.map((n) => (
                                            <option key={n} value={n}>
                                              {n}
                                            </option>
                                          ))}
                                        </select>
                                      )}
                                    </div>

                                    {/* KHUSUS MAPEL ONLINE: HANYA HASIL UPLOAD SISWA */}
                                    {isMapelOnline && (
                                      <div className="flex flex-col items-center gap-0.5 w-full pt-1 border-t border-slate-200/60 leading-none">
                                        {jawabanSiswa[`${s.idSiswa}_${p}`] ? (
                                          <a
                                            href={jawabanSiswa[`${s.idSiswa}_${p}`].fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={`Hasil upload ${s.nama}: ${jawabanSiswa[`${s.idSiswa}_${p}`].keterangan || "Buka jawaban siswa"}`}
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[9px] font-extrabold border border-emerald-300 transition-all w-full justify-center"
                                          >
                                            <span>📥</span>
                                            <span>Terkumpul</span>
                                          </a>
                                        ) : (
                                          <span className="text-[7px] text-slate-400 font-medium italic">
                                            —
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              );
                            })}

                            {/* TOTAL REKAP PER SISWA */}
                            <td
                              className={`px-1 py-1 border-b border-l-2 border-slate-200 group-hover:bg-blue-50 group-focus-within:bg-blue-50 transition-colors text-center ${
                                isEven ? "bg-slate-100/70" : "bg-slate-50/50"
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 w-[136px] min-w-[136px] max-w-[136px] mx-auto leading-none">
                                <span className="w-4 text-[9px] font-black text-emerald-600 bg-emerald-100 py-0.5 rounded">
                                  {total.Hadir}
                                </span>
                                <span className="w-4 text-[9px] font-black text-blue-600 bg-blue-100 py-0.5 rounded">
                                  {total.Sakit}
                                </span>
                                <span className="w-4 text-[9px] font-black text-amber-600 bg-amber-100 py-0.5 rounded">
                                  {total.Izin}
                                </span>
                                <span className="w-4 text-[9px] font-black text-rose-600 bg-rose-100 py-0.5 rounded">
                                  {total.Alfa}
                                </span>
                                <span className="w-4 text-[9px] font-black text-violet-600 bg-violet-100 py-0.5 rounded">
                                  {total.Cabut}
                                </span>
                                <span className="w-5 text-[9px] font-black text-fuchsia-700 bg-fuchsia-100 py-0.5 rounded border border-fuchsia-200">
                                  {total.jumlahNilai}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* FOOTER BAR DALAM TABEL (LEGENDA & STATUS) */}
                <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-600 font-medium">
                  {/* Legenda */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-slate-700">
                      Keterangan:
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
                      <span>Hadir (H)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
                      <span>Sakit (S)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                      <span>Izin (I)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                      <span>Alfa (A)</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block"></span>
                      <span>Cabut (C)</span>
                    </span>
                  </div>

                  {/* Tombol Simpan Cepat di Bawah */}
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 hidden md:inline">
                      Menampilkan {filteredSiswaList.length} dari{" "}
                      {siswaList.length} siswa
                    </span>
                    <button
                      type="button"
                      onClick={handleSimpanPresensi}
                      disabled={saving}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] shadow-xs active:scale-95 disabled:opacity-50 transition-all flex items-center gap-1"
                    >
                      <span>💾</span>
                      <span>{saving ? "Menyimpan..." : "Simpan Presensi"}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* TOAST LOADING: hapus / tambah siswa */}
      {(menghapusId || menambahId) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[260] flex items-center gap-3 bg-slate-900/90 backdrop-blur text-white text-xs font-bold px-5 py-3 rounded-2xl shadow-2xl animate-fadeIn pointer-events-none">
          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin flex-shrink-0" />
          <span>
            {menghapusId ? "Menghapus siswa dari mapel..." : "Menambahkan siswa ke mapel..."}
          </span>
        </div>
      )}

      {/* MODAL TAMBAH SISWA KE MAPEL */}
      {showTambahModal && (
        <ModalTambahSiswa
          key={mapel.idMapel}
          isOpen={showTambahModal}
          onClose={() => setShowTambahModal(false)}
          guru={guru}
          mapel={mapel}
          onTambahStart={(idSiswa) => setMenambahId(idSiswa)}
          onTambahSelesai={() => setMenambahId(null)}
          onSiswaAdded={() => {
            setMenambahId(null);
            loadGrid();
          }}
        />
      )}

      {/* MODAL KONFIRMASI SIMPAN SEBELUM TUTUP */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-slate-200">
            <h3 className="font-black text-slate-800 text-base mb-1.5 flex items-center gap-2">
              <span>⚠️</span>
              <span>Ada Perubahan Belum Disimpan!</span>
            </h3>
            <p className="text-xs text-slate-600 mb-5 font-medium leading-relaxed">
              Anda telah mengubah data presensi atau nilai. Apakah ingin
              menyimpannya sekarang sebelum menutup popup?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  setShowCloseConfirm(false);
                  await handleSimpanPresensi();
                  onClose(true); // ada perubahan — refresh kartu
                }}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white text-xs font-black py-2.5 shadow-md active:scale-98 transition-all"
              >
                💾 Ya, Simpan & Tutup
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCloseConfirm(false);
                  onClose(false); // buang perubahan — jangan refresh kartu
                }}
                className="w-full rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black py-2 hover:bg-rose-100 active:scale-98 transition-all"
              >
                Tutup Tanpa Menyimpan
              </button>
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                className="w-full rounded-xl bg-slate-100 text-slate-600 text-xs font-bold py-2 hover:bg-slate-200 transition-all"
              >
                Batal (Kembali Mengedit)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL UPLOAD TUGAS GURU (MAPEL ONLINE) */}
      {modalTugasOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <span>📎</span>
                <span>Upload Tugas Pertemuan {targetTugasP}</span>
              </h4>
              <button
                type="button"
                onClick={() => setModalTugasOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Judul Tugas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={judulTugasInput}
                  onChange={(e) => setJudulTugasInput(e.target.value)}
                  placeholder="Contoh: Tugas Mandiri Pertemuan 1"
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Instruksi / Deskripsi (opsional)
                </label>
                <textarea
                  rows={2}
                  value={deskripsiTugasInput}
                  onChange={(e) => setDeskripsiTugasInput(e.target.value)}
                  placeholder="Petunjuk pengerjaan tugas..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  File Lampiran / Modul (PDF, Doc, Gambar)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                  onChange={(e) => setFileTugasInput(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {tugasMapel[targetTugasP]?.fileUrl && !fileTugasInput && (
                  <p className="text-[10px] text-emerald-600 mt-1">
                    ✓ Sudah ada file tugas terunggah (
                    <a
                      href={tugasMapel[targetTugasP].fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold"
                    >
                      Buka File
                    </a>
                    ). Pilih file baru jika ingin mengganti.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={handleSimpanTugas}
                disabled={uploadingTugas}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {uploadingTugas ? "⏳ Menyimpan..." : "💾 Simpan Tugas"}
              </button>
              <button
                type="button"
                onClick={() => setModalTugasOpen(false)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
