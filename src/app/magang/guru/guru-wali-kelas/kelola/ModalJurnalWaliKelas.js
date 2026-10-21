"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  saveJurnalWaliKelas,
  getJurnalWaliKelas,
  deleteJurnalWaliKelas,
  uploadPhoto,
} from "../../../lib/api";

const FORMAT_OPTIONS = ["Individu", "Kelompok"];

// =====================================================
// HELPER: pisahkan "Nama Siswa [Kelas]" -> { nama, kelas }
// =====================================================
function parseNamaKelas(namaLengkap) {
  const text = String(namaLengkap || "").trim();
  let nama = text;
  let kelas = "";
  const match = text.match(/\s*\[([^\]]+)\]\s*$/);
  if (match) {
    kelas = match[1].trim();
    nama = text.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
  }
  return { nama, kelas };
}

// =====================================================
// HELPER: kelompokkan baris jurnal per pertemuan
// Mendukung data lama (tiap siswa punya idJurnal berbeda) dengan
// fallback grouping: tanggal + topik + createdAt (resolusi menit)
// =====================================================
function kelompokkanJurnal(rows) {
  // Langkah 1: hitung berapa baris per idJurnal
  const countPerJurnal = new Map();
  rows.forEach((r) => {
    if (!r.idJurnal) return;
    countPerJurnal.set(r.idJurnal, (countPerJurnal.get(r.idJurnal) || 0) + 1);
  });

  // Langkah 2: tentukan groupKey per baris
  const merged = new Map();

  rows.forEach((r) => {
    const jurnalId = r.idJurnal || "";
    const count = countPerJurnal.get(jurnalId) || 0;

    let groupKey;
    if (jurnalId && count > 1) {
      // Data baru: shared idJurnal
      groupKey = `id:${jurnalId}`;
    } else {
      // Data lama: group by tanggal + topik + createdAt (resolusi menit)
      const createdMinute = String(r.createdAt || "").substring(0, 16);
      const topikKey = String(r.topik || "").trim().substring(0, 60);
      groupKey = `legacy:${r.tanggal}|${topikKey}|${createdMinute}`;
    }

    if (!merged.has(groupKey)) {
      const isSemua =
        r.keterangan && r.keterangan.includes("[SEMUA_SISWA]");
      merged.set(groupKey, {
        idJurnal: jurnalId,
        idWali: r.idWali,
        tanggal: r.tanggal,
        formatPertemuan: r.formatPertemuan || "Individu",
        topik: r.topik,
        tindakLanjut: r.tindakLanjut,
        keterangan: r.keterangan,
        fotoUrl: r.fotoUrl,
        createdAt: r.createdAt,
        siswa: [],
        isSemua,
      });
    }
    merged.get(groupKey).siswa.push({
      idSiswa: r.idSiswa,
      nama: r.namaSiswa || r.nama || "",
      kelas: r.kelas || "",
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    return tb - ta;
  });
}

// Kompres foto ke max 1200px sebelum upload
async function kompresiFoto(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
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

export default function ModalJurnalWaliKelas({
  isOpen,
  onClose,
  guru,
  wali,
  daftarSiswa: daftarSiswaProp, // Array siswa sudah ada dari parent (opsional)
  onSaved,
  initialTab = "form",
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "form");
  const [siswaList, setSiswaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [format, setFormat] = useState("Individu");
  const [idSiswaTerpilih, setIdSiswaTerpilih] = useState("");
  const [idSiswaKelompok, setIdSiswaKelompok] = useState([]);
  const [tanggal, setTanggal] = useState(
    new Date().toLocaleDateString("en-CA"),
  );
  const [topik, setTopik] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [keterangan, setKeterangan] = useState("");

  // Foto
  const [fotoPreview, setFotoPreview] = useState(null);
  const [fotoFile, setFotoFile] = useState(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoInputRef = useRef(null);

  // Riwayat state
  const [daftarJurnal, setDaftarJurnal] = useState([]);
  const [loadingJurnal, setLoadingJurnal] = useState(false);
  const [errorJurnal, setErrorJurnal] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [searchNama, setSearchNama] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const idGuru = guru?.id || "";
  const idWali = wali?.idWali || "";

  // -------------------------------------------------------
  // Load siswa dari props atau dari server
  // -------------------------------------------------------
  const loadSiswa = useCallback(async () => {
    // Jika daftarSiswaProp tersedia & sudah ada data, gunakan langsung
    if (Array.isArray(daftarSiswaProp) && daftarSiswaProp.length > 0) {
      const list = daftarSiswaProp
        .map((s) => {
          const hasil = parseNamaKelas(s.nama || s.namaSiswa || "");
          return {
            ...s,
            namaBersih: hasil.nama || s.nama || s.namaSiswa || "",
            kelas: hasil.kelas || s.kelas || "",
          };
        })
        .sort((a, b) =>
          (a.namaBersih || "").localeCompare(b.namaBersih || ""),
        );
      setSiswaList(list);
      return;
    }

    if (!idGuru || !idWali) return;
    try {
      setLoading(true);
      const { getSiswaWaliKelas } = await import("../../../lib/api");
      const res = await getSiswaWaliKelas(idGuru, idWali);
      if (res?.success && Array.isArray(res.data)) {
        const list = res.data
          .map((s) => {
            const hasil = parseNamaKelas(s.nama || s.namaSiswa || "");
            return {
              ...s,
              namaBersih: hasil.nama || s.nama || s.namaSiswa || "",
              kelas: hasil.kelas || s.kelas || "",
            };
          })
          .sort((a, b) =>
            (a.namaBersih || "").localeCompare(b.namaBersih || ""),
          );
        setSiswaList(list);
      } else {
        setSiswaList([]);
      }
    } catch (err) {
      console.error("Gagal load siswa untuk jurnal wali kelas:", err);
      setSiswaList([]);
    } finally {
      setLoading(false);
    }
  }, [idGuru, idWali, daftarSiswaProp]);

  // -------------------------------------------------------
  // Load riwayat jurnal
  // -------------------------------------------------------
  const loadJurnal = useCallback(async () => {
    if (!idGuru || !idWali) return;
    setLoadingJurnal(true);
    setErrorJurnal("");
    try {
      const res = await getJurnalWaliKelas(idGuru, idWali);
      if (res?.success) {
        setDaftarJurnal(kelompokkanJurnal(res.data || []));
      } else {
        setErrorJurnal(res?.message || "Gagal mengambil data jurnal.");
        setDaftarJurnal([]);
      }
    } catch (err) {
      console.error("Gagal memuat jurnal wali kelas:", err);
      setErrorJurnal("Terjadi kesalahan saat mengambil data jurnal.");
      setDaftarJurnal([]);
    } finally {
      setLoadingJurnal(false);
    }
  }, [idGuru, idWali]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "form");
      setSuccessMessage("");
      setSearchNama("");
      loadSiswa();
      loadJurnal();
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialTab]);

  function resetForm() {
    setFormat("Individu");
    setIdSiswaTerpilih("");
    setIdSiswaKelompok([]);
    setTanggal(new Date().toLocaleDateString("en-CA"));
    setTopik("");
    setTindakLanjut("");
    setKeterangan("");
    setFotoPreview(null);
    setFotoFile(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  function toggleSiswaKelompok(idSiswa) {
    setIdSiswaKelompok((prev) =>
      prev.includes(idSiswa)
        ? prev.filter((id) => id !== idSiswa)
        : [...prev, idSiswa],
    );
  }

  // -------------------------------------------------------
  // Foto
  // -------------------------------------------------------
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
  // Simpan jurnal
  // -------------------------------------------------------
  async function handleSimpan(e) {
    e.preventDefault();

    if (format === "Individu" && !idSiswaTerpilih) {
      alert("Pilih siswa terlebih dahulu.");
      return;
    }
    if (format === "Kelompok" && idSiswaKelompok.length === 0) {
      alert("Pilih minimal 1 siswa untuk bimbingan kelompok.");
      return;
    }
    if (!topik.trim()) {
      alert("Topik pembahasan wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      let fotoUrl = "";

      // Upload foto jika ada
      if (fotoFile) {
        try {
          setUploadingFoto(true);
          const base64 = await fileToBase64(fotoFile);
          const resUpload = await uploadPhoto(
            base64,
            fotoFile.name,
            fotoFile.type || "image/jpeg",
          );
          if (resUpload?.success && resUpload?.data?.url) {
            fotoUrl = resUpload.data.url;
          } else {
            console.warn("Upload foto gagal, lanjut tanpa foto:", resUpload);
          }
        } catch (uploadErr) {
          console.warn("Gagal upload foto:", uploadErr);
        } finally {
          setUploadingFoto(false);
        }
      }

      // Untuk format kelompok semua siswa: tambahkan tag [SEMUA_SISWA]
      let ketFinal = keterangan.trim();
      const isSemuaSiswa =
        format === "Kelompok" &&
        siswaList.length > 0 &&
        idSiswaKelompok.length === siswaList.length;
      if (isSemuaSiswa) {
        ketFinal = ketFinal
          ? `${ketFinal} [SEMUA_SISWA]`
          : "[SEMUA_SISWA]";
      }

      const payload = {
        idGuru,
        idWali,
        tanggal,
        formatPertemuan: format,
        topik: topik.trim(),
        tindakLanjut: tindakLanjut.trim(),
        keterangan: ketFinal,
        fotoUrl,
      };

      if (format === "Individu") {
        payload.idSiswa = idSiswaTerpilih;
      } else {
        // Jika semua siswa terpilih, kirim seluruh idSiswaList
        payload.idSiswaList = idSiswaKelompok;
      }

      const result = await saveJurnalWaliKelas(payload);

      if (result?.success) {
        if (onSaved) onSaved();
        resetForm();
        setSuccessMessage("✅ Jurnal Bimbingan Wali Kelas berhasil disimpan.");
        await loadJurnal();
        setActiveTab("riwayat");
      } else {
        alert(result?.message || "Gagal menyimpan jurnal bimbingan.");
      }
    } catch (err) {
      console.error("ERROR SIMPAN JURNAL WALI KELAS:", err);
      alert("Terjadi kesalahan saat menyimpan jurnal bimbingan.");
    } finally {
      setSaving(false);
    }
  }

  // -------------------------------------------------------
  // Hapus jurnal
  // -------------------------------------------------------
  async function handleHapusJurnal(idJurnal) {
    const konfirmasi = window.confirm(
      "Hapus jurnal pertemuan ini?\n\nTindakan ini akan menghapus data untuk semua siswa dalam pertemuan tersebut dan tidak dapat dibatalkan.",
    );
    if (!konfirmasi) return;

    setDeletingId(idJurnal);
    try {
      const res = await deleteJurnalWaliKelas({ idGuru, idJurnal });
      if (res?.success) {
        setDaftarJurnal((prev) =>
          prev.filter((j) => j.idJurnal !== idJurnal),
        );
      } else {
        alert(res?.message || "Gagal menghapus jurnal.");
      }
    } catch (err) {
      console.error("Gagal menghapus jurnal wali kelas:", err);
      alert("Terjadi kesalahan saat menghapus jurnal.");
    } finally {
      setDeletingId(null);
    }
  }

  if (!isOpen) return null;

  const isFormValid =
    (format === "Individu" ? !!idSiswaTerpilih : idSiswaKelompok.length > 0) &&
    topik.trim().length > 0;

  const filteredJurnal = searchNama.trim()
    ? daftarJurnal.filter((j) => {
        const ket = j.keterangan || "";
        const isSemuaSiswaEntry = ket.includes("[SEMUA_SISWA]");
        if (isSemuaSiswaEntry) return true;
        return j.siswa.some((s) =>
          (s.nama || "").toLowerCase().includes(searchNama.toLowerCase()),
        );
      })
    : daftarJurnal;

  // Hitung isSemuaSiswaChecked
  const isSemuaSiswaChecked =
    format === "Kelompok" &&
    siswaList.length > 0 &&
    idSiswaKelompok.length === siswaList.length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header dengan Tab Toggle */}
        <div className="bg-gradient-to-r from-teal-700 to-emerald-700 text-white px-5 sm:px-6 py-4 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                📝 Jurnal Bimbingan Wali Kelas
              </h2>
              <p className="text-xs font-medium text-teal-200 mt-0.5 truncate">
                Kelas {wali?.namaKelas || "-"}
              </p>
            </div>

            {/* Navigasi Tab */}
            <div className="flex items-center gap-2">
              <div className="bg-white/15 p-1 rounded-xl flex gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage("");
                    setActiveTab("form");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === "form"
                      ? "bg-white text-teal-900 shadow-sm"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  ✏️ Form Input
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("riwayat");
                    if (daftarJurnal.length === 0) loadJurnal();
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === "riwayat"
                      ? "bg-white text-teal-900 shadow-sm"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  📖 Riwayat
                  {daftarJurnal.length > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                        activeTab === "riwayat"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-white/20 text-white"
                      }`}
                    >
                      {daftarJurnal.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={onClose}
                className="rounded-xl bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
                title="Tutup"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Search bar di header khusus tab riwayat */}
          {activeTab === "riwayat" && daftarJurnal.length > 0 && (
            <input
              type="text"
              value={searchNama}
              onChange={(e) => setSearchNama(e.target.value)}
              placeholder="🔍 Cari nama siswa..."
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-xs font-medium text-white placeholder-teal-200 outline-none focus:bg-white/25 transition-colors"
            />
          )}
        </div>

        {/* =====================================================
            TAB 1: FORM INPUT JURNAL
            ===================================================== */}
        {activeTab === "form" && (
          <>
            <form
              onSubmit={handleSimpan}
              className="flex-1 overflow-y-auto custom-scrollbar-jwk px-6 py-5 space-y-4"
            >
              {/* Format Pertemuan */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Format Pertemuan
                </label>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        setFormat(f);
                        setIdSiswaTerpilih("");
                        setIdSiswaKelompok([]);
                      }}
                      className={`flex-1 rounded-xl border-2 text-xs font-black py-2.5 transition-all ${
                        format === f
                          ? "bg-teal-600 border-teal-600 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:border-teal-300"
                      }`}
                    >
                      {f === "Individu" ? "👤 Individu" : "👥 Kelompok"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pilih Siswa */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black uppercase text-slate-700">
                    {format === "Individu"
                      ? "Siswa"
                      : "Siswa (Pilih yang Hadir Bimbingan)"}
                  </label>
                  {format === "Kelompok" && siswaList.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setIdSiswaKelompok(siswaList.map((s) => s.idSiswa))
                        }
                        className="text-[11px] font-bold text-teal-600 hover:text-teal-800"
                      >
                        ☑ Pilih Semua
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setIdSiswaKelompok([])}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-700"
                      >
                        ☐ Bersihkan
                      </button>
                    </div>
                  )}
                </div>

                {/* Notif semua siswa */}
                {isSemuaSiswaChecked && (
                  <div className="mb-2 flex items-center gap-2 rounded-xl bg-teal-50 border border-teal-200 px-3 py-2 text-xs">
                    <span className="text-teal-600">🎉</span>
                    <span className="font-bold text-teal-800">
                      Seluruh siswa kelas dipilih — akan dicatat sebagai{" "}
                      <em>Seluruh Siswa Kelas</em>
                    </span>
                  </div>
                )}

                {loading ? (
                  <p className="text-xs text-slate-400 font-medium py-2">
                    Memuat daftar siswa...
                  </p>
                ) : siswaList.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-2">
                    Belum ada siswa terdaftar di kelas ini.
                  </p>
                ) : format === "Individu" ? (
                  <select
                    value={idSiswaTerpilih}
                    onChange={(e) => setIdSiswaTerpilih(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  >
                    <option value="">-- Pilih siswa --</option>
                    {siswaList.map((s) => (
                      <option key={s.idSiswa} value={s.idSiswa}>
                        {s.namaBersih}
                        {s.kelas ? ` [${s.kelas}]` : ""}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 custom-scrollbar-jwk divide-y divide-slate-100">
                    {siswaList.map((s) => {
                      const checked = idSiswaKelompok.includes(s.idSiswa);
                      return (
                        <label
                          key={s.idSiswa}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                            checked ? "bg-teal-50" : "hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSiswaKelompok(s.idSiswa)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 accent-teal-600"
                          />
                          <span
                            className={`text-xs font-bold ${checked ? "text-teal-700" : "text-slate-700"}`}
                          >
                            {s.namaBersih}
                            {s.kelas ? (
                              <span className="ml-1 font-normal text-slate-400">
                                [{s.kelas}]
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {format === "Kelompok" && idSiswaKelompok.length > 0 && (
                  <p className="text-[10px] font-bold text-teal-600 mt-1">
                    {isSemuaSiswaChecked
                      ? `👥 Semua ${idSiswaKelompok.length} siswa dipilih (Seluruh Siswa Kelas)`
                      : `👥 ${idSiswaKelompok.length} dari ${siswaList.length} siswa dipilih`}
                  </p>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Tanggal Bimbingan
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>

              {/* Topik */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Topik Pembahasan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={topik}
                  onChange={(e) => setTopik(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Pembahasan nilai ujian semester, motivasi belajar, kendala akademik..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all resize-none"
                />
              </div>

              {/* Tindak Lanjut */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Tindak Lanjut
                </label>
                <textarea
                  value={tindakLanjut}
                  onChange={(e) => setTindakLanjut(e.target.value)}
                  rows={2}
                  placeholder="Langkah yang akan diambil selanjutnya..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all resize-none"
                />
              </div>

              {/* Keterangan */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Keterangan (opsional)
                </label>
                <input
                  type="text"
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Catatan tambahan..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>

              {/* Upload Foto */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  📸 Foto Dokumentasi
                  <span className="ml-1 font-normal normal-case text-slate-400">
                    (akan jadi QR barcode di laporan PDF)
                  </span>
                </label>
                {fotoPreview ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={fotoPreview}
                      alt="Preview foto"
                      className="h-20 w-20 rounded-xl object-cover border-2 border-teal-300 shadow-md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {fotoFile?.name || "Foto dipilih"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {fotoFile ? `${(fotoFile.size / 1024).toFixed(0)} KB` : ""}
                      </p>
                      <button
                        type="button"
                        onClick={hapusFoto}
                        className="mt-2 rounded-lg bg-rose-100 text-rose-600 text-[10px] font-black px-3 py-1 hover:bg-rose-200 transition-colors"
                      >
                        🗑️ Hapus Foto
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-24 rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50 hover:bg-teal-100 cursor-pointer transition-colors">
                    <span className="text-2xl mb-1">📷</span>
                    <span className="text-xs font-bold text-teal-600">
                      Klik untuk pilih foto
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      JPG/PNG • Maks. 10MB • Otomatis dikompres
                    </span>
                    <input
                      ref={fotoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFotoChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </form>

            {/* Footer Form */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-3xl flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-black py-3 transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                onClick={handleSimpan}
                disabled={saving || !isFormValid}
                className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black py-3 shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin inline-block">⏳</span>
                    {uploadingFoto ? "Mengupload foto..." : "Menyimpan..."}
                  </>
                ) : (
                  "💾 Simpan Jurnal"
                )}
              </button>
            </div>
          </>
        )}

        {/* =====================================================
            TAB 2: RIWAYAT JURNAL
            ===================================================== */}
        {activeTab === "riwayat" && (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar-jwk px-5 py-4 space-y-3 bg-slate-50">
              {/* Notifikasi Berhasil Simpan */}
              {successMessage && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center justify-between">
                  <span>{successMessage}</span>
                  <button
                    type="button"
                    onClick={() => setSuccessMessage("")}
                    className="text-emerald-600 hover:text-emerald-900 font-black text-sm ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {loadingJurnal ? (
                <div className="flex flex-col items-center justify-center py-14 text-slate-400">
                  <div className="relative h-9 w-9 mb-3">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-teal-600 border-t-transparent animate-spin"></div>
                  </div>
                  <p className="text-xs font-bold">Memuat riwayat jurnal...</p>
                </div>
              ) : errorJurnal ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs font-bold text-red-600">
                  {errorJurnal}
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
                filteredJurnal.map((j) => {
                  const ket = j.keterangan || "";
                  const isSemuaSiswaEntry = ket.includes("[SEMUA_SISWA]");
                  const ketBersih = ket
                    .replace(/\[[A-Z0-9_:,|]+\]/gi, "")
                    .trim();

                  return (
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

                          {/* Nama siswa */}
                          {isSemuaSiswaEntry ? (
                            <span className="inline-flex items-center gap-1 mt-1 rounded-lg bg-teal-50 border border-teal-200 px-2 py-0.5 text-[10px] font-black text-teal-800">
                              👥 Seluruh Siswa Kelas
                            </span>
                          ) : (
                            <p className="mt-1 text-[11px] font-semibold text-slate-500 leading-snug">
                              {j.siswa
                                .map(
                                  (s) =>
                                    s.nama + (s.kelas ? ` [${s.kelas}]` : ""),
                                )
                                .join(", ")}
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleHapusJurnal(j.idJurnal)}
                          disabled={deletingId === j.idJurnal}
                          className="shrink-0 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1.5 text-[10px] font-black text-rose-600 hover:bg-rose-100 transition-colors disabled:opacity-50"
                        >
                          {deletingId === j.idJurnal ? "⏳" : "🗑️ Hapus"}
                        </button>
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <p className="text-slate-700">
                          <span className="font-black text-slate-500">
                            Topik:{" "}
                          </span>
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
                        {ketBersih && (
                          <p className="text-slate-700">
                            <span className="font-black text-slate-500">
                              Keterangan:{" "}
                            </span>
                            {ketBersih}
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
                  );
                })
              )}
            </div>

            {/* Footer Riwayat */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-3xl flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-500">
                Total {daftarJurnal.length} pertemuan tercatat
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSuccessMessage("");
                    setActiveTab("form");
                  }}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black px-4 py-2.5 transition-colors shadow-sm"
                >
                  ✏️ + Tambah Jurnal Baru
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black px-4 py-2.5 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `.custom-scrollbar-jwk::-webkit-scrollbar { width: 6px; } .custom-scrollbar-jwk::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`,
        }}
      />
    </div>
  );
}
