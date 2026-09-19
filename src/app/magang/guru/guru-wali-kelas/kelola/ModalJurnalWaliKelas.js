"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { saveJurnalWaliKelas, uploadPhoto } from "../../../lib/api";

const FORMAT_OPTIONS = ["Individu", "Kelompok"];

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
  onSaved,
}) {
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

  // Load siswa list dari props atau dari server
  const loadSiswa = useCallback(async () => {
    if (!guru || !wali) return;
    try {
      setLoading(true);
      // Import lazily untuk menghindari circular
      const { getSiswaWaliKelas } = await import("../../../lib/api");
      const res = await getSiswaWaliKelas(guru.id, wali.idWali);
      setSiswaList(
        res.success
          ? (res.data || [])
              // GAS mengembalikan namaSiswa, normalize ke nama
              .map((s) => ({ ...s, nama: s.namaSiswa || s.nama || "" }))
              .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""))
          : [],
      );
    } catch (err) {
      console.error("Gagal load siswa untuk jurnal:", err);
      setSiswaList([]);
    } finally {
      setLoading(false);
    }
  }, [guru, wali]);

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
    setFotoPreview(null);
    setFotoFile(null);
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

    const kompres = await kompresiFoto(file);
    const fileToUse = kompres || file;
    setFotoFile(fileToUse);

    // Preview
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target.result);
    reader.readAsDataURL(fileToUse);
  }

  function hapusFoto() {
    setFotoFile(null);
    setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  }

  async function handleSimpan(e) {
    e.preventDefault();

    // Validasi
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

      const payload = {
        idGuru: guru.id,
        idWali: wali.idWali,
        tanggal,
        formatPertemuan: format,
        topik: topik.trim(),
        tindakLanjut: tindakLanjut.trim(),
        keterangan: keterangan.trim(),
        fotoUrl,
      };

      if (format === "Individu") {
        payload.idSiswa = idSiswaTerpilih;
      } else {
        payload.idSiswaList = idSiswaKelompok;
      }

      const result = await saveJurnalWaliKelas(payload);

      if (result.success) {
        if (onSaved) onSaved();
        resetForm();
        onClose();
      } else {
        alert(result.message || "Gagal menyimpan jurnal bimbingan.");
      }
    } catch (err) {
      console.error("ERROR SIMPAN JURNAL WALI:", err);
      alert("Terjadi kesalahan saat menyimpan jurnal bimbingan.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  const isFormValid =
    (format === "Individu" ? !!idSiswaTerpilih : idSiswaKelompok.length > 0) &&
    topik.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-purple-700 text-white px-6 py-5 rounded-t-3xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-black flex items-center gap-2">
                📝 Jurnal Bimbingan Wali Kelas
              </h2>
              <p className="text-xs font-medium text-indigo-200 mt-0.5">
                Kelas {wali?.namaKelas || "-"}
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
          className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-4"
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
                Memuat daftar siswa...
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
                    {s.nama}
                    {s.kelas ? ` [${s.kelas}]` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 custom-scrollbar divide-y divide-slate-100">
                {siswaList.length === 0 ? (
                  <p className="text-xs text-slate-400 font-medium px-4 py-3">
                    Belum ada siswa terdaftar.
                  </p>
                ) : (
                  siswaList.map((s) => {
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
                          {s.nama}
                          {s.kelas ? (
                            <span className="ml-1 font-normal text-slate-400">
                              [{s.kelas}]
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })
                )}
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
              Tanggal Bimbingan
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
              Topik Pembahasan <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={topik}
              onChange={(e) => setTopik(e.target.value)}
              rows={3}
              placeholder="Contoh: Pembahasan nilai ujian semester, motivasi belajar..."
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
                  className="h-20 w-20 rounded-xl object-cover border-2 border-indigo-300 shadow-md"
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
              <label className="flex flex-col items-center justify-center w-full h-24 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 cursor-pointer transition-colors">
                <span className="text-2xl mb-1">📷</span>
                <span className="text-xs font-bold text-indigo-600">
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
            disabled={saving || !isFormValid}
            className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black py-3 shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `.custom-scrollbar::-webkit-scrollbar { width: 6px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }`,
        }}
      />
    </div>
  );
}
