"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getDataSiswaWali, saveJurnalGuruWali } from "../../../lib/api";

const FORMAT_OPTIONS = ["Individu", "Kelompok"];

// =====================================================
// HELPER: pisahkan "Nama Siswa [Kelas]" -> { nama, kelas }
// Pola sama seperti halaman Jurnal Guru Wali yang lama.
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
// (fitur ini sudah ada di pola Jurnal Guru Wali lama,
// dipertahankan supaya bukti foto tetap punya identitas)
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

export default function ModalJurnalGuruWali({
  isOpen,
  onClose,
  guru, // { id, nama }
  onSaved,
}) {
  const [siswaList, setSiswaList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields (pola sama dengan Jurnal Guru Wali lama)
  const [format, setFormat] = useState("Individu");
  const [idSiswaTerpilih, setIdSiswaTerpilih] = useState("");
  const [idSiswaKelompok, setIdSiswaKelompok] = useState([]);
  const [tanggal, setTanggal] = useState(
    new Date().toLocaleDateString("en-CA"),
  );
  const [topik, setTopik] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [keterangan, setKeterangan] = useState("");

  // Foto (opsional)
  const [photo, setPhoto] = useState(""); // dataURL final (sudah diberi watermark)
  const [processingFoto, setProcessingFoto] = useState(false);
  const fotoInputRef = useRef(null);

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
      } else {
        setSiswaList([]);
      }
    } catch (err) {
      console.error("Gagal load siswa wali untuk jurnal:", err);
      setSiswaList([]);
    } finally {
      setLoading(false);
    }
  }, [idGuru]);

  useEffect(() => {
    if (isOpen) {
      loadSiswa();
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function resetForm() {
    setFormat("Individu");
    setIdSiswaTerpilih("");
    setIdSiswaKelompok([]);
    setTanggal(new Date().toLocaleDateString("en-CA"));
    setTopik("");
    setTindakLanjut("");
    setKeterangan("");
    setPhoto("");
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  function toggleSiswaKelompok(idSiswa) {
    setIdSiswaKelompok((prev) =>
      prev.includes(idSiswa)
        ? prev.filter((id) => id !== idSiswa)
        : [...prev, idSiswa],
    );
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
      // PENTING: fotoUrl dikirim sebagai dataURL base64 mentah (bukan
      // di-upload dari client). Backend saveJurnalGuruWali di GS yang
      // sudah ada akan otomatis meng-upload ke Drive & membuat barcode
      // QR-nya sendiri — ini pola lama yang tetap dipertahankan.
      const payload = {
        idGuru,
        tanggal,
        formatPertemuan: format,
        topik: topik.trim(),
        tindakLanjut: tindakLanjut.trim(),
        keterangan: keterangan.trim(),
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
        onClose();
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

  if (!isOpen) return null;

  const isFormValid =
    (format === "Individu" ? !!idSiswaTerpilih : idSiswaKelompok.length > 0) &&
    topik.trim().length > 0 &&
    !!tanggal;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-6 py-5 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                📝 Jurnal Guru Wali
              </h2>
              <p className="text-xs font-medium text-indigo-200 mt-0.5">
                Guru: {namaGuru || "-"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl bg-white/20 p-2 text-white hover:bg-white/30 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
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
            <label className="block text-xs font-black uppercase text-slate-700 mb-2">
              {format === "Individu" ? "Siswa" : "Siswa (Pilih Beberapa)"}
            </label>
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
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 custom-scrollbar-jgw divide-y divide-slate-100">
                {siswaList.map((s) => {
                  const checked = idSiswaKelompok.includes(s.idSiswa);
                  return (
                    <label
                      key={s.idSiswa}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                        checked ? "bg-indigo-50" : "hover:bg-slate-100"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleSiswaKelompok(s.idSiswa)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600"
                      />
                      <span
                        className={`text-xs font-bold ${checked ? "text-indigo-700" : "text-slate-700"}`}
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
              <p className="text-[10px] font-bold text-indigo-600 mt-1">
                {idSiswaKelompok.length} siswa dipilih
              </p>
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

        {/* Footer */}
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
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `.custom-scrollbar-jgw::-webkit-scrollbar { width: 6px; } .custom-scrollbar-jgw::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`,
        }}
      />
    </div>
  );
}
