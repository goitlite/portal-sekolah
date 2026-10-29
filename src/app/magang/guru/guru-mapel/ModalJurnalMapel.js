"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import {
  saveJurnalMapel,
  getJurnalMapel,
  deleteJurnalMapel,
  getPresensiMapelGrid,
  uploadPhoto,
} from "../../lib/api";

// Helper kompresi foto ke max 1200px sebelum upload
async function kompresiFoto(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) {
            height = Math.round((height * maxPx) / width);
            width = maxPx;
          } else {
            width = Math.round((width * maxPx) / height);
            height = maxPx;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            const f = new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
              type: "image/jpeg",
            });
            resolve(f);
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

// Konversi File ke base64 string
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatTanggalIndo(tanggalStr) {
  if (!tanggalStr) return "-";
  try {
    const d = new Date(tanggalStr);
    if (isNaN(d.getTime())) return String(tanggalStr);
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(tanggalStr);
  }
}

// Contoh template teks yang relevan dengan mata pelajaran guru
function getContohTeksMapel(namaMapel) {
  const nama = namaMapel || "Mata Pelajaran";
  return {
    materi: `Konsep & Praktik ${nama}`,
    tujuanPembelajaran: `Peserta didik mampu memahami prinsip dasar serta mempraktikkan keterampilan pokok materi ${nama} dengan baik dan mandiri.`,
    kegiatanPembelajaran: `Pembelajaran diawali salam, apersepsi, dan presensi, dilanjutkan penjelasan konsep ${nama} serta pendampingan praktik mandiri/kelompok siswa, lalu ditutup dengan refleksi bersama dan arahan tindak lanjut.`,
    hasilRefleksi: `Sebagian besar siswa antusias dan dapat mengikuti praktik dengan baik, sebagian kecil masih memerlukan bimbingan tambahan.`,
    tindakLanjut: `Melanjutkan materi ke kompetensi berikutnya serta memberikan pengayaan/remedial bagi siswa yang membutuhkan.`,
  };
}

// Parsing isi jurnal (mendukung kolom langsung & format JSON di KETERANGAN)
// CATATAN: GAS getAllDataMapel_() menggunakan nama kolom sheet sebagai key (UPPERCASE_UNDERSCORE)
// misal: row.KETERANGAN, row.TOPIK, row.TINDAK_LANJUT, row.FOTO_URL, row.TANGGAL, row.KELAS, dll.
function parseDataJurnal(row) {
  let meta = {};
  // Prioritaskan UPPERCASE (dari GAS sheet), fallback ke lowercase
  const rawKet = row.KETERANGAN || row.keterangan || "";
  if (rawKet && typeof rawKet === "string" && rawKet.trim().startsWith("{")) {
    try {
      meta = JSON.parse(rawKet);
    } catch {
      meta = {};
    }
  }

  // materi: dari meta JSON (data baru), lalu TOPIK (kolom sheet dedikasi)
  const materi =
    meta.materi || row.TOPIK || row.materi || row.topik || meta.topik || "";

  // Kolom tujuan/kegiatan/hasil TIDAK ADA sebagai kolom tersendiri di sheet
  // — semua disimpan di KETERANGAN JSON (meta)
  const tujuanPembelajaran = meta.tujuanPembelajaran || "";
  const kegiatanPembelajaran = meta.kegiatanPembelajaran || "";
  const hasilRefleksi = meta.hasilRefleksi || "";

  // tindakLanjut: dari meta JSON (data baru), lalu kolom TINDAK_LANJUT (data lama)
  const tindakLanjut =
    meta.tindakLanjut || row.TINDAK_LANJUT || row.tindakLanjut || row.tindak_lanjut || "";

  // Kehadiran: TIDAK ada kolom tersendiri di sheet — semua di KETERANGAN JSON (meta)
  const hadir = meta.hadir !== undefined ? Number(meta.hadir) : 0;
  const sakit = meta.sakit !== undefined ? Number(meta.sakit) : 0;
  const izin  = meta.izin  !== undefined ? Number(meta.izin)  : 0;
  const alfa  = meta.alfa  !== undefined ? Number(meta.alfa)  : 0;
  const cabut = meta.cabut !== undefined ? Number(meta.cabut) : 0;

  const pertemuanKe = meta.pertemuanKe || row.pertemuanKe || null;
  const catatan =
    meta.catatan || (!rawKet?.trim()?.startsWith("{") ? rawKet : "") || "";

  return {
    idJurnal: row.ID_JURNAL || row.idJurnal,
    idGuru: row.ID_GURU || row.idGuru,
    idMapel: row.ID_MAPEL || row.idMapel,
    kelas: row.KELAS || row.kelas || "",
    tanggal: row.TANGGAL || row.tanggal || "",
    materi,
    tujuanPembelajaran,
    kegiatanPembelajaran,
    hasilRefleksi,
    tindakLanjut,
    hadir,
    sakit,
    izin,
    alfa,
    cabut,
    pertemuanKe,
    catatan,
    fotoUrl: row.FOTO_URL || row.fotoUrl || "",
    createdAt: row.CREATED_AT || row.createdAt || "",
  };
}

export default function ModalJurnalMapel({
  isOpen,
  onClose,
  guru,
  mapel,
  onSaved,
  initialTab = "form",
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "form");
  const [saving, setSaving] = useState(false);

  // Form states
  const [tanggal, setTanggal] = useState(new Date().toLocaleDateString("en-CA"));
  const [materi, setMateri] = useState("");
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState("");
  const [kegiatanPembelajaran, setKegiatanPembelajaran] = useState("");
  const [hasilRefleksi, setHasilRefleksi] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [pertemuanKe, setPertemuanKe] = useState("");
  const [infoAutoSinkron, setInfoAutoSinkron] = useState("");

  // Presensi counts
  const [hadir, setHadir] = useState(0);
  const [sakit, setSakit] = useState(0);
  const [izin, setIzin] = useState(0);
  const [alfa, setAlfa] = useState(0);
  const [cabut, setCabut] = useState(0);

  // Foto
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef(null);

  // Riwayat Jurnal
  const [daftarJurnal, setDaftarJurnal] = useState([]);
  const [loadingJurnal, setLoadingJurnal] = useState(false);
  const [errorJurnal, setErrorJurnal] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [searchMateri, setSearchMateri] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Data presensi mapel card untuk sinkronisasi otomatis
  const [presensiMapelSesiList, setPresensiMapelSesiList] = useState([]);
  const [selectedSesiPresensi, setSelectedSesiPresensi] = useState("");

  const idGuru = guru?.id || "";
  const idMapel = mapel?.idMapel || "";
  const kelasMapel = mapel?.kelas || "";
  const namaMapel = mapel?.namaMapel || "";

  // Mengisi form dengan contoh teks bawaan mapel
  const pasangContohTeks = useCallback(() => {
    const contoh = getContohTeksMapel(namaMapel);
    setMateri(contoh.materi);
    setTujuanPembelajaran(contoh.tujuanPembelajaran);
    setKegiatanPembelajaran(contoh.kegiatanPembelajaran);
    setHasilRefleksi(contoh.hasilRefleksi);
    setTindakLanjut(contoh.tindakLanjut);
  }, [namaMapel]);

  // Kosongkan seluruh input teks jika guru ingin mengetik dari awal
  function kosongkanTeks() {
    setMateri("");
    setTujuanPembelajaran("");
    setKegiatanPembelajaran("");
    setHasilRefleksi("");
    setTindakLanjut("");
  }

  // -------------------------------------------------------
  // Load data presensi mapel untuk sinkronisasi otomatis
  // -------------------------------------------------------
  const loadPresensiMapel = useCallback(async () => {
    if (!idGuru || !idMapel) return;
    try {
      const res = await getPresensiMapelGrid(idGuru, idMapel);
      if (res?.success && res?.data) {
        const presensiList = res.data.presensi || [];
        const sesiMap = {};

        presensiList.forEach((p) => {
          if (!p.pertemuanKe) return;
          const pKe = Number(p.pertemuanKe);
          if (!sesiMap[pKe]) {
            sesiMap[pKe] = {
              pertemuanKe: pKe,
              tanggal: p.tanggal || "",
              hadir: 0,
              sakit: 0,
              izin: 0,
              alfa: 0,
              cabut: 0,
            };
          }
          if (p.tanggal && !sesiMap[pKe].tanggal) {
            sesiMap[pKe].tanggal = p.tanggal;
          }
          const st = String(p.status || "").trim();
          if (st === "Hadir") sesiMap[pKe].hadir++;
          else if (st === "Sakit") sesiMap[pKe].sakit++;
          else if (st === "Izin") sesiMap[pKe].izin++;
          else if (st === "Alfa") sesiMap[pKe].alfa++;
          else if (st === "Cabut") sesiMap[pKe].cabut++;
        });

        const list = Object.values(sesiMap).sort(
          (a, b) => b.pertemuanKe - a.pertemuanKe,
        );
        setPresensiMapelSesiList(list);

        // Jika form baru dibuka dan ada sesi terakhir, pasang otomatis
        if (list.length > 0) {
          const sesiTerbaru = list[0];
          setSelectedSesiPresensi(String(sesiTerbaru.pertemuanKe));
          if (sesiTerbaru.tanggal) setTanggal(sesiTerbaru.tanggal);
          setPertemuanKe(String(sesiTerbaru.pertemuanKe));
          setHadir(sesiTerbaru.hadir);
          setSakit(sesiTerbaru.sakit);
          setIzin(sesiTerbaru.izin);
          setAlfa(sesiTerbaru.alfa);
          setCabut(sesiTerbaru.cabut);
          setInfoAutoSinkron(
            `Otomatis terisi dari Presensi Pertemuan ${sesiTerbaru.pertemuanKe}`
          );
        }
      }
    } catch (err) {
      console.warn("Gagal load presensi mapel:", err);
    }
  }, [idGuru, idMapel]);

  // -------------------------------------------------------
  // Load Riwayat Jurnal Mapel
  // -------------------------------------------------------
  const loadJurnal = useCallback(async () => {
    if (!idGuru || !idMapel) return;
    setLoadingJurnal(true);
    setErrorJurnal("");
    try {
      const res = await getJurnalMapel(idGuru, idMapel);
      if (res?.success) {
        const raw = Array.isArray(res.data) ? res.data : [];
        const parsed = raw.map(parseDataJurnal);
        parsed.sort((a, b) => {
          const ta = new Date(a.tanggal || a.createdAt).getTime() || 0;
          const tb = new Date(b.tanggal || b.createdAt).getTime() || 0;
          return tb - ta;
        });
        setDaftarJurnal(parsed);
      } else {
        setErrorJurnal(res?.message || "Gagal mengambil data jurnal mapel.");
        setDaftarJurnal([]);
      }
    } catch (err) {
      console.error("Gagal memuat jurnal mapel:", err);
      setErrorJurnal("Terjadi kesalahan saat mengambil riwayat jurnal.");
      setDaftarJurnal([]);
    } finally {
      setLoadingJurnal(false);
    }
  }, [idGuru, idMapel]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "form");
      setSuccessMessage("");
      setSearchMateri("");
      pasangContohTeks();
      loadPresensiMapel();
      loadJurnal();
    }
  }, [isOpen, initialTab, pasangContohTeks, loadPresensiMapel, loadJurnal]);

  // -------------------------------------------------------
  // Handler perubahan tanggal: otomatis mendeteksi presensi
  // -------------------------------------------------------
  function handleTanggalChange(newTgl) {
    setTanggal(newTgl);
    if (!newTgl) return;

    // Cek apakah tanggal ini cocok dengan salah satu sesi presensi mapel
    const sesiCocok = presensiMapelSesiList.find(
      (s) =>
        s.tanggal &&
        String(s.tanggal).trim().substring(0, 10) ===
          String(newTgl).trim().substring(0, 10)
    );

    if (sesiCocok) {
      setPertemuanKe(String(sesiCocok.pertemuanKe));
      setHadir(sesiCocok.hadir);
      setSakit(sesiCocok.sakit);
      setIzin(sesiCocok.izin);
      setAlfa(sesiCocok.alfa);
      setCabut(sesiCocok.cabut);
      setSelectedSesiPresensi(String(sesiCocok.pertemuanKe));
      setInfoAutoSinkron(
        `Presensi tanggal ini otomatis terisi dari Pertemuan ${sesiCocok.pertemuanKe}`
      );
    } else {
      setSelectedSesiPresensi("");
      setInfoAutoSinkron(
        "Tidak ada sesi presensi tersimpan di tanggal ini (Bisa diisi manual)"
      );
    }
  }

  // Pilih sesi pertemuan manual dari dropdown
  function handlePilihSesi(pKeStr) {
    setSelectedSesiPresensi(pKeStr);
    if (!pKeStr) return;
    const sesi = presensiMapelSesiList.find(
      (s) => String(s.pertemuanKe) === String(pKeStr)
    );
    if (sesi) {
      if (sesi.tanggal) setTanggal(sesi.tanggal);
      setPertemuanKe(String(sesi.pertemuanKe));
      setHadir(sesi.hadir);
      setSakit(sesi.sakit);
      setIzin(sesi.izin);
      setAlfa(sesi.alfa);
      setCabut(sesi.cabut);
      setInfoAutoSinkron(
        `Otomatis terisi dari Presensi Pertemuan ${sesi.pertemuanKe}`
      );
    }
  }

  function resetForm() {
    setTanggal(new Date().toLocaleDateString("en-CA"));
    pasangContohTeks();
    setPertemuanKe("");
    setHadir(0);
    setSakit(0);
    setIzin(0);
    setAlfa(0);
    setCabut(0);
    setSelectedSesiPresensi("");
    setInfoAutoSinkron("");
    setFotoPreview(null);
    setFotoFile(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  // Handle upload foto
  async function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const kompres = await kompresiFoto(file);
    const fileToUse = kompres || file;
    setFotoFile(fileToUse);

    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target.result);
    reader.readAsDataURL(fileToUse);
  }

  function hapusFoto() {
    setFotoFile(null);
    setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  // -------------------------------------------------------
  // Simpan Jurnal Mapel
  // -------------------------------------------------------
  async function handleSimpan(e) {
    e.preventDefault();

    if (!materi.trim()) {
      alert("Materi pembelajaran wajib diisi.");
      return;
    }
    if (!tanggal) {
      alert("Tanggal pembelajaran wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      let fotoUrl = "";
      if (fotoFile) {
        try {
          setUploadingFoto(true);
          const base64 = await fileToBase64(fotoFile);
          const resUpload = await uploadPhoto(
            base64,
            fotoFile.name,
            fotoFile.type || "image/jpeg"
          );
          if (resUpload?.success && resUpload?.data?.url) {
            fotoUrl = resUpload.data.url;
          }
        } catch (uploadErr) {
          console.warn("Upload foto gagal, melanjutkan tanpa foto:", uploadErr);
        } finally {
          setUploadingFoto(false);
        }
      }

      const payload = {
        idGuru,
        idMapel,
        kelas: kelasMapel,
        tanggal,
        materi: materi.trim(),
        topik: materi.trim(),
        tujuanPembelajaran: tujuanPembelajaran.trim(),
        kegiatanPembelajaran: kegiatanPembelajaran.trim(),
        hasilRefleksi: hasilRefleksi.trim(),
        tindakLanjut: tindakLanjut.trim(),
        hadir: Number(hadir) || 0,
        sakit: Number(sakit) || 0,
        izin: Number(izin) || 0,
        alfa: Number(alfa) || 0,
        cabut: Number(cabut) || 0,
        pertemuanKe: pertemuanKe ? Number(pertemuanKe) : null,
        formatPertemuan: "Klasikal",
        fotoUrl,
      };

      const res = await saveJurnalMapel(payload);
      if (res?.success) {
        setSuccessMessage("✅ Jurnal pembelajaran mapel berhasil disimpan!");
        resetForm();
        await loadJurnal();
        if (typeof onSaved === "function") onSaved();
        setActiveTab("riwayat");
      } else {
        alert(res?.message || "Gagal menyimpan jurnal mapel.");
      }
    } catch (err) {
      console.error("Gagal simpan jurnal mapel:", err);
      alert("Terjadi kesalahan saat menyimpan jurnal mapel.");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------
  // Hapus Jurnal Mapel
  // -------------------------------------------------------
  async function handleHapus(jurnalItem) {
    if (
      !confirm(
        `Hapus jurnal materi "${jurnalItem.materi}" tanggal ${formatTanggalIndo(
          jurnalItem.tanggal
        )}?`
      )
    ) {
      return;
    }

    setDeletingId(jurnalItem.idJurnal);
    try {
      const res = await deleteJurnalMapel(jurnalItem.idJurnal, idGuru, idMapel);
      if (res?.success) {
        setDaftarJurnal((prev) =>
          prev.filter((j) => j.idJurnal !== jurnalItem.idJurnal)
        );
        if (typeof onSaved === "function") onSaved();
      } else {
        alert(res?.message || "Gagal menghapus jurnal mapel.");
      }
    } catch (err) {
      console.error("Gagal hapus jurnal mapel:", err);
      alert("Terjadi kesalahan saat menghapus jurnal mapel.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!isOpen) return null;

  const totalSiswaKelas = hadir + sakit + izin + alfa + cabut;

  const filteredJurnal = daftarJurnal.filter((j) => {
    if (!searchMateri.trim()) return true;
    const q = searchMateri.toLowerCase();
    return (
      (j.materi || "").toLowerCase().includes(q) ||
      (j.tujuanPembelajaran || "").toLowerCase().includes(q) ||
      (j.kegiatanPembelajaran || "").toLowerCase().includes(q) ||
      (j.hasilRefleksi || "").toLowerCase().includes(q) ||
      (j.tanggal || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-indigo-200 bg-white shadow-2xl">
        {/* ======================================================== */}
        {/* HEADER MODAL UTAMA */}
        {/* ======================================================== */}
        <div className="shrink-0 relative overflow-hidden bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700 px-4 py-3 sm:px-6 sm:py-3.5 text-white shadow-sm">
          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/20 text-xl shadow-xs backdrop-blur-sm">
                📝
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-sm sm:text-base font-bold text-white truncate">
                    Jurnal Mengajar Mata Pelajaran
                  </h2>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white border border-white/30">
                    {namaMapel || "Mapel"}
                  </span>
                </div>
                <p className="text-[11px] text-blue-100 flex items-center gap-1.5 flex-wrap">
                  <span>
                    Kelas: <b className="text-white font-semibold">{kelasMapel || "Semua"}</b>
                  </span>
                  <span>•</span>
                  <span>
                    Guru: <b className="text-white font-semibold">{guru?.nama || "Guru Mapel"}</b>
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              title="Tutup Popup"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-all hover:bg-white/30 active:scale-95 cursor-pointer font-bold text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* TAB BAR NAVIGASI MANDIRI */}
        {/* ======================================================== */}
        <div className="shrink-0 bg-slate-100 border-b border-slate-200 px-3 py-2 sm:px-6 flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("form")}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "form"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
              }`}
            >
              <span>✍️</span>
              <span>Input Jurnal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("riwayat")}
              className={`flex items-center gap-1.5 rounded-xl px-3 sm:px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "riwayat"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-slate-300"
              }`}
            >
              <span>📋</span>
              <span>Riwayat ({daftarJurnal.length})</span>
            </button>
          </div>

          {activeTab === "form" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={pasangContohTeks}
                className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                title="Isi form dengan contoh teks ideal"
              >
                💡 Contoh Teks
              </button>
              <button
                type="button"
                onClick={kosongkanTeks}
                className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                title="Kosongkan kolom teks"
              >
                🧹 Kosongkan
              </button>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* BODY MODAL */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 bg-slate-50 custom-scrollbar">
          {successMessage && (
            <div className="mb-3 flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 animate-in fade-in">
              <span>{successMessage}</span>
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="text-emerald-700 hover:text-emerald-900 text-sm ml-2 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: FORM INPUT JURNAL */}
          {/* ======================================================== */}
          {activeTab === "form" && (
            <form onSubmit={handleSimpan} className="space-y-3 sm:space-y-4">
              {/* PANEL TANGGAL & AUTO-SINKRONISASI PRESENSI */}
              <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tanggal Pelaksanaan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={tanggal}
                      onChange={(e) => handleTanggalChange(e.target.value)}
                      className="w-full sm:max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300"
                    />
                    {infoAutoSinkron && (
                      <p className="mt-1 text-[11px] font-medium text-indigo-600 flex items-center gap-1">
                        <span>⚡</span>
                        <span>{infoAutoSinkron}</span>
                      </p>
                    )}
                  </div>

                  {presensiMapelSesiList.length > 0 && (
                    <div className="sm:text-right">
                      <span className="block text-[10px] font-medium text-slate-500 mb-1">
                        Atau pilih dari sesi presensi:
                      </span>
                      <select
                        value={selectedSesiPresensi}
                        onChange={(e) => handlePilihSesi(e.target.value)}
                        className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-900 shadow-2xs outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
                      >
                        <option value="">-- Pilih Sesi Pertemuan --</option>
                        {presensiMapelSesiList.map((sesi) => (
                          <option key={sesi.pertemuanKe} value={sesi.pertemuanKe}>
                            P-{sesi.pertemuanKe} ({sesi.tanggal || "-"}) • H:{sesi.hadir} S:{sesi.sakit} I:{sesi.izin} A:{sesi.alfa} C:{sesi.cabut}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* 5 COUNTERS KEHADIRAN */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                    <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <span>👥 Kehadiran Siswa</span>
                      <span className="text-[10px] text-slate-400 font-normal">(Otomatis sinkron / bisa manual)</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Total: <b className="font-semibold text-slate-700">{totalSiswaKelas} Siswa</b>
                    </span>
                  </div>

                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { label: "Hadir", val: hadir, set: setHadir, cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
                      { label: "Sakit", val: sakit, set: setSakit, cls: "border-blue-200 bg-blue-50 text-blue-800" },
                      { label: "Izin",  val: izin,  set: setIzin,  cls: "border-amber-200 bg-amber-50 text-amber-800" },
                      { label: "Alfa",  val: alfa,  set: setAlfa,  cls: "border-rose-200 bg-rose-50 text-rose-800" },
                      { label: "Cabut", val: cabut, set: setCabut, cls: "border-violet-200 bg-violet-50 text-violet-800" },
                    ].map(({ label, val, set, cls }) => (
                      <div key={label} className={`rounded-lg border p-1.5 text-center ${cls}`}>
                        <label className="block text-[9px] font-bold uppercase opacity-75">{label}</label>
                        <input
                          type="number"
                          min="0"
                          value={val}
                          onChange={(e) => set(Number(e.target.value) || 0)}
                          className="mt-0.5 w-full rounded bg-white border border-current/25 px-1 py-0.5 text-center text-xs font-bold text-slate-800 focus:outline-none"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* KELAS & PERTEMUAN KE */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kelas
                  </label>
                  <input
                    type="text"
                    disabled
                    value={kelasMapel ? `Kelas ${kelasMapel}` : "Semua Kelas"}
                    className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pertemuan Ke- (Opsional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 1, 2, 3..."
                    value={pertemuanKe}
                    onChange={(e) => setPertemuanKe(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                  />
                </div>
              </div>

              {/* MATERI POKOK */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Materi Pembelajaran <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Konfigurasi Routing Statis & Default Gateway"
                  value={materi}
                  onChange={(e) => setMateri(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              </div>

              {/* TUJUAN PEMBELAJARAN */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tujuan Pembelajaran
                </label>
                <textarea
                  rows={2}
                  placeholder="Kompetensi yang diharapkan dicapai siswa..."
                  value={tujuanPembelajaran}
                  onChange={(e) => setTujuanPembelajaran(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 resize-none outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
                />
              </div>

              {/* KEGIATAN PEMBELAJARAN (1 PARAGRAF IDEAL) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Kegiatan Pembelajaran (1 Paragraf Rangkuman)
                  </label>
                  <span className="text-[10px] text-slate-400 font-normal">
                    Pendahuluan, inti, dan penutup
                  </span>
                </div>
                <textarea
                  rows={3}
                  placeholder="Rangkuman 1 paragraf: pendahuluan/apersepsi, kegiatan inti/praktik materi, dan penutup/refleksi..."
                  value={kegiatanPembelajaran}
                  onChange={(e) => setKegiatanPembelajaran(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 resize-y outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
                />
              </div>

              {/* HASIL / REFLEKSI & TINDAK LANJUT */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hasil / Refleksi Pembelajaran
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Hasil capaian pemahaman siswa & evaluasi guru..."
                    value={hasilRefleksi}
                    onChange={(e) => setHasilRefleksi(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 resize-none outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rencana Tindak Lanjut
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Rencana pengayaan, remedial, atau penugasan..."
                    value={tindakLanjut}
                    onChange={(e) => setTindakLanjut(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 resize-none outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200 leading-relaxed"
                  />
                </div>
              </div>

              {/* FOTO DOKUMENTASI PEMBELAJARAN */}
              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Foto Dokumentasi Kegiatan (Opsional)
                </label>

                {fotoPreview ? (
                  <div className="relative inline-block overflow-hidden rounded-lg border border-slate-200">
                    <img
                      src={fotoPreview}
                      alt="Preview Dokumentasi"
                      className="max-h-36 w-auto object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={hapusFoto}
                      className="absolute top-1.5 right-1.5 rounded-full bg-rose-600/90 text-white px-2 py-0.5 text-[10px] font-bold shadow hover:bg-rose-700 cursor-pointer"
                      title="Hapus foto"
                    >
                      ✕ Hapus
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <input
                      ref={fotoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFotoChange}
                      className="hidden"
                      id="upload-foto-jurnal-mapel"
                    />
                    <label
                      htmlFor="upload-foto-jurnal-mapel"
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                    >
                      <span>📷</span>
                      <span>Ambil Foto / Pilih Gambar</span>
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Dikompres otomatis sebelum disimpan
                    </span>
                  </div>
                )}
              </div>

              {/* TOMBOL SIMPAN & RESET */}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
                >
                  Reset Form
                </button>

                <button
                  type="submit"
                  disabled={saving || uploadingFoto}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {saving || uploadingFoto ? (
                    <>
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Simpan Jurnal Mapel</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ======================================================== */}
          {/* TAB 2: RIWAYAT JURNAL MAPEL (SIMPEL, PADAT & RESPONSIF) */}
          {/* ======================================================== */}
          {activeTab === "riwayat" && (
            <div className="space-y-3">
              {/* SEARCH FILTER & REFRESH */}
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchMateri}
                    onChange={(e) => setSearchMateri(e.target.value)}
                    placeholder="Cari materi, refleksi, atau tanggal..."
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadJurnal}
                  disabled={loadingJurnal}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                >
                  <span>🔄</span>
                  <span>{loadingJurnal ? "Memuat..." : "Segarkan"}</span>
                </button>
              </div>

              {/* LIST RIWAYAT */}
              {loadingJurnal ? (
                <div className="flex items-center justify-center p-10 text-slate-500 text-xs gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
                  <span>Memuat riwayat jurnal...</span>
                </div>
              ) : filteredJurnal.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                  <span className="text-3xl">📚</span>
                  <p className="mt-2 text-sm font-semibold text-slate-700">
                    Belum Ada Riwayat Jurnal
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {searchMateri
                      ? "Tidak ada jurnal yang sesuai dengan kata kunci pencarian."
                      : "Gunakan tab 'Input Jurnal' untuk mencatat kegiatan pembelajaran mata pelajaran ini."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredJurnal.map((item, idx) => {
                    const isDeleting = deletingId === item.idJurnal;
                    const totalSiswaItem =
                      item.hadir + item.sakit + item.izin + item.alfa + item.cabut;
                    return (
                      <article
                        key={item.idJurnal || idx}
                        className="rounded-xl border border-slate-200 bg-white shadow-2xs hover:shadow-xs transition-shadow overflow-hidden"
                      >
                        <div className="flex items-start">
                          {/* Garis Aksen Kiri */}
                          <div className="w-1 self-stretch bg-indigo-500 shrink-0" />

                          <div className="flex-1 p-3 min-w-0 space-y-2">
                            {/* BARIS 1: META & HAPUS */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  📅 {formatTanggalIndo(item.tanggal)}
                                </span>

                                {item.pertemuanKe && (
                                  <span className="rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                    Pertemuan {item.pertemuanKe}
                                  </span>
                                )}

                                <span className="rounded-md bg-slate-50 border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">
                                  Kelas {item.kelas || kelasMapel || "-"}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleHapus(item)}
                                disabled={isDeleting}
                                className="shrink-0 text-[11px] font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg px-2 py-0.5 transition-colors cursor-pointer disabled:opacity-50"
                                title="Hapus jurnal ini"
                              >
                                {isDeleting ? "Menghapus..." : "🗑️ Hapus"}
                              </button>
                            </div>

                            {/* MATERI POKOK */}
                            <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                              {item.materi || "(Tanpa Materi)"}
                            </h3>

                            {/* REKAP PRESENSI RINGKAS */}
                            {totalSiswaItem > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                                <span className="text-slate-400 font-medium">Presensi:</span>
                                <span className="rounded px-1.5 py-0.5 font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  H: {item.hadir}
                                </span>
                                <span className="rounded px-1.5 py-0.5 font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  S: {item.sakit}
                                </span>
                                <span className="rounded px-1.5 py-0.5 font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                  I: {item.izin}
                                </span>
                                <span className="rounded px-1.5 py-0.5 font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  A: {item.alfa}
                                </span>
                                <span className="rounded px-1.5 py-0.5 font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                  C: {item.cabut}
                                </span>
                                <span className="text-slate-400">({totalSiswaItem} siswa)</span>
                              </div>
                            )}

                            {/* RINCIAN TEKS JURNAL (TAMPILAN SIMPEL & BERSIH) */}
                            {(item.tujuanPembelajaran || item.kegiatanPembelajaran || item.hasilRefleksi || item.tindakLanjut) && (
                              <div className="space-y-1 pt-1.5 border-t border-slate-100 text-xs text-slate-700 leading-relaxed">
                                {item.tujuanPembelajaran && (
                                  <p>
                                    <span className="font-semibold text-indigo-700">Tujuan: </span>
                                    <span>{item.tujuanPembelajaran}</span>
                                  </p>
                                )}
                                {item.kegiatanPembelajaran && (
                                  <p>
                                    <span className="font-semibold text-slate-800">Kegiatan: </span>
                                    <span>{item.kegiatanPembelajaran}</span>
                                  </p>
                                )}
                                {item.hasilRefleksi && (
                                  <p>
                                    <span className="font-semibold text-teal-700">Refleksi: </span>
                                    <span>{item.hasilRefleksi}</span>
                                  </p>
                                )}
                                {item.tindakLanjut && (
                                  <p>
                                    <span className="font-semibold text-amber-700">Tindak Lanjut: </span>
                                    <span>{item.tindakLanjut}</span>
                                  </p>
                                )}
                              </div>
                            )}

                            {/* FOTO DOKUMENTASI */}
                            {item.fotoUrl && (
                              <div className="pt-1">
                                <a
                                  href={item.fotoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                  <span>📷</span>
                                  <span>Lihat Foto Dokumentasi</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
