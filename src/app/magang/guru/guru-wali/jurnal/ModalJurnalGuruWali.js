"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  getDataSiswaWali,
  saveJurnalGuruWali,
  getJurnalGuruWali,
  deleteJurnalGuruWali,
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
// HELPER: kompresi foto ke dataURL (max 1200px, JPEG)
// =====================================================
function compressToDataUrl(file, maxPx = 1200, quality = 0.82) {
  return new Promise((resolve, reject) => {
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
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Gagal membaca gambar."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}

// =====================================================
// HELPER: tambahkan watermark info jurnal ke foto
// =====================================================
function addWatermark(dataUrl, { namaGuru, topik }) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const now = new Date();
      const tanggalStr = now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const jamStr = now.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      const baseFontSize = Math.max(22, img.width / 32);
      const boxH = baseFontSize * 5.2;
      const boxX = 20;
      const boxY = img.height - boxH - 20;
      const boxW = img.width - 40;

      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(boxX, boxY, boxW, boxH);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${baseFontSize * 1.15}px Arial`;
      ctx.fillText("JURNAL GURU WALI", boxX + 20, boxY + baseFontSize * 1.5);

      ctx.font = `${baseFontSize * 0.85}px Arial`;
      ctx.fillText(
        `Guru : ${namaGuru || "-"}`,
        boxX + 20,
        boxY + baseFontSize * 3,
      );
      ctx.fillText(
        `Topik : ${topik ? topik.substring(0, 34) + (topik.length > 34 ? "..." : "") : "Pembinaan Siswa"}`,
        boxX + 20,
        boxY + baseFontSize * 4,
      );
      ctx.fillText(
        `Waktu: ${tanggalStr} | ${jamStr} WIB`,
        boxX + 20,
        boxY + baseFontSize * 5,
      );

      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// =====================================================
// HELPER: kelompokkan baris jurnal per pertemuan (idJurnal)
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

export default function ModalJurnalGuruWali({
  isOpen,
  onClose,
  guru, // { id, nama }
  onSaved,
  initialTab = "form",
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "form"); // 'form' | 'riwayat'
  const [siswaList, setSiswaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [format, setFormat] = useState("Individu");
  const [idSiswaTerpilih, setIdSiswaTerpilih] = useState("");
  const [idSiswaKelompok, setIdSiswaKelompok] = useState([]);
  const [idSiswaPkl, setIdSiswaPkl] = useState([]);
  const [tanggal, setTanggal] = useState(
    new Date().toLocaleDateString("en-CA"),
  );
  const [topik, setTopik] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [keterangan, setKeterangan] = useState("");

  // Foto (opsional)
  const [photo, setPhoto] = useState("");
  const [processingFoto, setProcessingFoto] = useState(false);
  const fotoInputRef = useRef(null);

  // Riwayat Jurnal state
  const [daftarJurnal, setDaftarJurnal] = useState([]);
  const [loadingJurnal, setLoadingJurnal] = useState(false);
  const [errorJurnal, setErrorJurnal] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [searchNama, setSearchNama] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const idGuru = guru?.id || "";
  const namaGuru = guru?.nama || "";

  const loadSiswa = useCallback(async () => {
    if (!idGuru) return;
    try {
      setLoading(true);
      const result = await getDataSiswaWali(idGuru);
      if (result?.success && Array.isArray(result.data)) {
        const list = result.data
          .map((s) => {
            const hasil = parseNamaKelas(s.nama);
            return { ...s, namaBersih: hasil.nama, kelas: hasil.kelas };
          })
          .sort((a, b) =>
            (a.namaBersih || "").localeCompare(b.namaBersih || ""),
          );
        setSiswaList(list);
        setIdSiswaPkl(list.map((s) => s.idSiswa));
      } else {
        setSiswaList([]);
        setIdSiswaPkl([]);
      }
    } catch (err) {
      console.error("Gagal load siswa wali untuk jurnal:", err);
      setSiswaList([]);
      setIdSiswaPkl([]);
    } finally {
      setLoading(false);
    }
  }, [idGuru]);

  const loadJurnal = useCallback(async () => {
    if (!idGuru) return;
    setLoadingJurnal(true);
    setErrorJurnal("");
    try {
      const res = await getJurnalGuruWali(idGuru);
      if (res?.success) {
        setDaftarJurnal(kelompokkanJurnal(res.data || []));
      } else {
        setErrorJurnal(res?.message || "Gagal mengambil data jurnal.");
        setDaftarJurnal([]);
      }
    } catch (err) {
      console.error("Gagal memuat jurnal guru wali:", err);
      setErrorJurnal("Terjadi kesalahan saat mengambil data jurnal.");
      setDaftarJurnal([]);
    } finally {
      setLoadingJurnal(false);
    }
  }, [idGuru]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "form");
      setSuccessMessage("");
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
    setIdSiswaPkl(siswaList.map((s) => s.idSiswa));
    setTanggal(new Date().toLocaleDateString("en-CA"));
    setTopik("");
    setTindakLanjut("");
    setKeterangan("");
    setPhoto("");
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  function toggleSiswaKelompok(idSiswa) {
    setIdSiswaKelompok((prev) => {
      if (prev.includes(idSiswa)) {
        // Jika uncheck hadir, default statusnya menjadi Sedang PKL
        setIdSiswaPkl((pklPrev) =>
          pklPrev.includes(idSiswa) ? pklPrev : [...pklPrev, idSiswa],
        );
        return prev.filter((id) => id !== idSiswa);
      } else {
        // Jika check hadir, keluarkan dari Sedang PKL
        setIdSiswaPkl((pklPrev) => pklPrev.filter((id) => id !== idSiswa));
        return [...prev, idSiswa];
      }
    });
  }

  function toggleStatusPklSiswa(idSiswa) {
    setIdSiswaPkl((prev) =>
      prev.includes(idSiswa)
        ? prev.filter((id) => id !== idSiswa)
        : [...prev, idSiswa],
    );
  }

  function setSemuaUncheckedSebagaiPkl() {
    const unchecked = siswaList
      .filter((s) => !idSiswaKelompok.includes(s.idSiswa))
      .map((s) => s.idSiswa);
    setIdSiswaPkl(unchecked);
  }

  function setSemuaUncheckedSebagaiTidakHadir() {
    setIdSiswaPkl([]);
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setProcessingFoto(true);
      const compressed = await compressToDataUrl(file);
      const watermarked = await addWatermark(compressed, { namaGuru, topik });
      setPhoto(watermarked);
    } catch (err) {
      alert("Gagal memproses foto. Coba pilih foto lain.");
    } finally {
      setProcessingFoto(false);
    }
  }

  function hapusFoto() {
    setPhoto("");
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  async function handleSimpan(e) {
    e.preventDefault();

    if (!idGuru) {
      alert("ID guru tidak ditemukan.");
      return;
    }
    if (format === "Individu" && !idSiswaTerpilih) {
      alert("Pilih siswa terlebih dahulu.");
      return;
    }
    if (format === "Kelompok" && idSiswaKelompok.length === 0) {
      alert("Pilih minimal 1 siswa untuk pertemuan kelompok.");
      return;
    }
    if (!tanggal) {
      alert("Tanggal pertemuan wajib diisi.");
      return;
    }
    if (!topik.trim()) {
      alert("Topik atau masalah wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      let ketFinal = keterangan.trim();
      if (format === "Kelompok") {
        // Cari siswa yang TIDAK dicentang hadir dan berstatus Sedang PKL
        const pklIds = siswaList
          .filter(
            (s) =>
              !idSiswaKelompok.includes(s.idSiswa) &&
              idSiswaPkl.includes(s.idSiswa),
          )
          .map((s) => s.idSiswa);

        if (pklIds.length > 0) {
          const tag = `[PKL_EXEMPT_IDS:${pklIds.join(",")}]`;
          ketFinal = ketFinal ? `${ketFinal} ${tag}` : tag;
        }
      }

      const payload = {
        idGuru,
        tanggal,
        formatPertemuan: format,
        topik: topik.trim(),
        tindakLanjut: tindakLanjut.trim(),
        keterangan: ketFinal,
        fotoUrl: photo || "",
        fotoId: "",
      };

      if (format === "Individu") {
        payload.idSiswa = idSiswaTerpilih;
      } else {
        payload.idSiswaList = idSiswaKelompok;
      }

      const result = await saveJurnalGuruWali(payload);

      if (result?.success) {
        if (onSaved) onSaved();
        resetForm();
        setSuccessMessage("✅ Jurnal Guru Wali berhasil disimpan.");
        // Muat ulang daftar jurnal dan arahkan ke tab riwayat agar guru melihat perubahannya
        await loadJurnal();
        setActiveTab("riwayat");
      } else {
        alert(result?.message || "Gagal menyimpan jurnal guru wali.");
      }
    } catch (err) {
      console.error("ERROR SIMPAN JURNAL GURU WALI:", err);
      alert("Terjadi kesalahan saat menyimpan jurnal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleHapusJurnal(idJurnal) {
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

  const isFormValid =
    (format === "Individu" ? !!idSiswaTerpilih : idSiswaKelompok.length > 0) &&
    topik.trim().length > 0 &&
    !!tanggal;

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
        {/* Header dengan Tab Toggle */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-5 sm:px-6 py-4 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                📝 Jurnal Guru Wali
              </h2>
              <p className="text-xs font-medium text-indigo-200 mt-0.5 truncate">
                Guru: {namaGuru || "-"}
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
                      ? "bg-white text-indigo-900 shadow-sm"
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
                      ? "bg-white text-indigo-900 shadow-sm"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  📖 Riwayat
                  {daftarJurnal.length > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        activeTab === "riwayat"
                          ? "bg-indigo-100 text-indigo-800"
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
              className="mt-3 w-full rounded-xl border border-white/20 bg-white/15 px-4 py-2 text-xs font-medium text-white placeholder-indigo-200 outline-none focus:bg-white/25 transition-colors"
            />
          )}
        </div>

        {/* TAB 1: FORM INPUT JURNAL */}
        {activeTab === "form" && (
          <>
            <form
              onSubmit={handleSimpan}
              className="flex-1 overflow-y-auto custom-scrollbar-jgw px-6 py-5 space-y-4"
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
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
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
                    {format === "Individu" ? "Siswa" : "Siswa Bimbingan (Centang yang Hadir)"}
                  </label>
                  {format === "Kelompok" && siswaList.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setIdSiswaKelompok(siswaList.map((s) => s.idSiswa))
                        }
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
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

                {/* Card Opsi Pengecualian Sedang PKL (Khusus Format Kelompok) */}
                {format === "Kelompok" && (
                  <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50/90 p-3.5 space-y-2 shadow-sm">
                    <div>
                      <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                        🏢 Status Siswa yang Tidak Dicentang (Sedang PKL vs Tidak Hadir)
                      </span>
                      <span className="text-[11px] font-medium text-amber-800 leading-snug block mt-0.5">
                        Klik tombol status pada setiap siswa di bawah:
                        <br />• <strong>🏢 Sedang PKL</strong>: dikecualikan dan <strong>persentase kehadiran tetap aman</strong> (tidak berkurang).
                        <br />• <strong>❌ Tidak Hadir</strong>: dianggap alpa dan <strong>persentase kehadiran berkurang saat dicetak</strong>.
                      </span>
                    </div>

                    {siswaList.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/80">
                        <button
                          type="button"
                          onClick={setSemuaUncheckedSebagaiPkl}
                          className="text-[10.5px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          🏢 Jadikan Semua: Sedang PKL (Aman)
                        </button>
                        <button
                          type="button"
                          onClick={setSemuaUncheckedSebagaiTidakHadir}
                          className="text-[10.5px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-900 border border-rose-300 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          ❌ Jadikan Semua: Tidak Hadir (Kurangi %)
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {loading ? (
                  <p className="text-xs text-slate-400 font-medium py-2">
                    Memuat daftar siswa wali...
                  </p>
                ) : siswaList.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium py-2">
                    Belum ada siswa wali terdaftar.
                  </p>
                ) : format === "Individu" ? (
                  <select
                    value={idSiswaTerpilih}
                    onChange={(e) => setIdSiswaTerpilih(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 custom-scrollbar-jgw divide-y divide-slate-100">
                    {siswaList.map((s) => {
                      const isHadir = idSiswaKelompok.includes(s.idSiswa);
                      const isPkl = idSiswaPkl.includes(s.idSiswa);

                      return (
                        <div
                          key={s.idSiswa}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 transition-colors ${
                            isHadir ? "bg-indigo-50/70" : "hover:bg-slate-100"
                          }`}
                        >
                          {/* Checkbox Hadir & Nama */}
                          <label className="flex items-center gap-3 min-w-0 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={isHadir}
                              onChange={() => toggleSiswaKelompok(s.idSiswa)}
                              className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 cursor-pointer shrink-0"
                            />
                            <span
                              className={`text-xs font-bold truncate ${isHadir ? "text-indigo-800" : "text-slate-700"}`}
                            >
                              {s.namaBersih}
                              {s.kelas ? (
                                <span className="ml-1 font-normal text-slate-400">
                                  [{s.kelas}]
                                </span>
                              ) : null}
                            </span>
                          </label>

                          {/* Tombol Status Interaktif */}
                          {isHadir ? (
                            <span className="shrink-0 text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-md">
                              ✓ Hadir Kelompok
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                toggleStatusPklSiswa(s.idSiswa);
                              }}
                              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-bold border transition-all cursor-pointer shadow-sm ${
                                isPkl
                                  ? "bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300"
                                  : "bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-300"
                              }`}
                              title={
                                isPkl
                                  ? "Klik tombol ini untuk ubah menjadi: Tidak Hadir (mengurangi persentase kehadiran)"
                                  : "Klik tombol ini untuk ubah menjadi: Sedang PKL (tidak mengurangi persentase kehadiran)"
                              }
                            >
                              {isPkl ? (
                                <>
                                  <span>🏢 Sedang PKL</span>
                                  <span className="text-[9px] bg-amber-200 text-amber-900 px-1 py-0.2 rounded font-black">
                                    Aman
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span>❌ Tidak Hadir</span>
                                  <span className="text-[9px] bg-rose-200 text-rose-900 px-1 py-0.2 rounded font-black">
                                    Kurangi %
                                  </span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {format === "Kelompok" && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold px-1 mt-2">
                    <span className="text-indigo-600">
                      👥 {idSiswaKelompok.length} siswa hadir
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        🏢 {siswaList.filter((s) => !idSiswaKelompok.includes(s.idSiswa) && idSiswaPkl.includes(s.idSiswa)).length} sedang PKL (aman)
                      </span>
                      {siswaList.filter((s) => !idSiswaKelompok.includes(s.idSiswa) && !idSiswaPkl.includes(s.idSiswa)).length > 0 && (
                        <span className="text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          ❌ {siswaList.filter((s) => !idSiswaKelompok.includes(s.idSiswa) && !idSiswaPkl.includes(s.idSiswa)).length} tidak hadir (kurangi %)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tanggal */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Tanggal Pertemuan
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Topik */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  Topik / Masalah <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={topik}
                  onChange={(e) => setTopik(e.target.value)}
                  rows={3}
                  placeholder="Contoh: Pembahasan kendala di tempat PKL, motivasi belajar..."
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
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
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              {/* Upload Foto */}
              <div>
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  📸 Bukti Foto (opsional)
                  <span className="ml-1 font-normal normal-case text-slate-400">
                    otomatis diberi watermark identitas jurnal
                  </span>
                </label>
                {photo ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={photo}
                      alt="Preview foto"
                      className="h-20 w-20 rounded-xl object-cover border-2 border-indigo-300 shadow-md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700">
                        Foto siap dikirim
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
                  <label className="flex flex-col items-center justify-center w-full h-24 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors">
                    {processingFoto ? (
                      <>
                        <span className="text-2xl mb-1 animate-spin">⏳</span>
                        <span className="text-xs font-bold text-indigo-600">
                          Memproses foto...
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-2xl mb-1">📷</span>
                        <span className="text-xs font-bold text-indigo-600">
                          Klik untuk ambil / pilih foto
                        </span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          JPG/PNG • Otomatis dikompres & diberi watermark
                        </span>
                      </>
                    )}
                    <input
                      ref={fotoInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFotoChange}
                      disabled={processingFoto}
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
                disabled={saving || !isFormValid || processingFoto}
                className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black py-3 shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="animate-spin inline-block">⏳</span>
                    Menyimpan...
                  </>
                ) : (
                  "💾 Simpan Jurnal"
                )}
              </button>
            </div>
          </>
        )}

        {/* TAB 2: RIWAYAT JURNAL GURU WALI */}
        {activeTab === "riwayat" && (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar-jgw px-5 py-4 space-y-3 bg-slate-50">
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
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
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
                            .map(
                              (s) =>
                                s.nama + (s.kelas ? ` [${s.kelas}]` : ""),
                            )
                            .join(", ")}
                        </p>
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
                        <div className="space-y-1">
                          {j.keterangan.replace(/\[PKL_EXEMPT\]/gi, "").trim() && (
                            <p className="text-slate-700">
                              <span className="font-black text-slate-500">
                                Keterangan:{" "}
                              </span>
                              {j.keterangan.replace(/\[PKL_EXEMPT\]/gi, "").trim()}
                            </p>
                          )}
                          {j.keterangan.includes("[PKL_EXEMPT]") && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-black text-amber-800">
                              🏢 Pengecualian PKL Aktif (Siswa tidak dicentang aman dari pengurangan persentase)
                            </span>
                          )}
                        </div>
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
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-2.5 transition-colors shadow-sm"
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
          __html: `.custom-scrollbar-jgw::-webkit-scrollbar { width: 6px; } .custom-scrollbar-jgw::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`,
        }}
      />
    </div>
  );
}
