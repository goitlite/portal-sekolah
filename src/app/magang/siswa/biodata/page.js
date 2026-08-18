"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getBiodataSiswa,
  updateBiodataSiswa,
  uploadPhoto,
} from "../../lib/api";
import { getSession, isLoggedIn } from "../../lib/auth";

export default function BiodataSiswa() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingIjazah, setUploadingIjazah] = useState(false); // ---> TAMBAHKAN IN
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fotoProfil: "", // Tambahan state untuk foto profil
    noHp: "",
    tempatLahir: "",
    tglLahir: "",
    ayah: "",
    pekerjaanAyah: "",
    kontakAyah: "",
    ibu: "",
    pekerjaanIbu: "",
    kontakIbu: "",
    anakKe: "",
    alamat: "",
    hobi: "",
    bakatKeahlian: "",
    transportasi: "",
    pelajaranDisukai: "",
    alasanDisukai: "",
    pelajaranTidakDisukai: "",
    alasanTidakDisukai: "",
    harapan: "",
  });

  useEffect(() => {
    async function loadData() {
      if (!isLoggedIn()) return router.replace("/magang/login");
      const session = getSession();
      if (!session || session.role !== "siswa")
        return router.replace("/magang/login");

      setUser(session);
      try {
        const result = await getBiodataSiswa(session.id);
        if (result.success && result.data) {
          setForm({
            fotoProfil: result.data.fotoProfil || "", // Ambil foto jika ada
            noHp: result.data.noHp || "",
            tempatLahir: result.data.tempatLahir || "",
            tglLahir: result.data.tglLahir || "",
            ayah: result.data.ayah || "",
            pekerjaanAyah: result.data.pekerjaanAyah || "",
            kontakAyah: result.data.kontakAyah || "",
            ibu: result.data.ibu || "",
            pekerjaanIbu: result.data.pekerjaanIbu || "",
            kontakIbu: result.data.kontakIbu || "",
            anakKe: result.data.anakKe || "",
            alamat: result.data.alamat || "",
            hobi: result.data.hobi || "",
            bakatKeahlian: result.data.bakatKeahlian || "",
            transportasi: result.data.transportasi || "",
            pelajaranDisukai: result.data.pelajaranDisukai || "",
            alasanDisukai: result.data.alasanDisukai || "",
            pelajaranTidakDisukai: result.data.pelajaranTidakDisukai || "",
            alasanTidakDisukai: result.data.alasanTidakDisukai || "",
            harapan: result.data.harapan || "",
            ijazahSmp: result.data.ijazahSmp || "", // ---> TAMBAHKAN INI
          });
        }
      } catch (err) {
        setError("Gagal mengambil data biodata.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Fungsi untuk trigger klik input file tersembunyi
  function handleFotoClick() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  // Fungsi kompresi dan upload foto
  // Fungsi kompresi dan upload foto (Auto-Save ke Database)
  async function handleFotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFoto(true);
    setError("");

    try {
      // 1. Kompresi gambar dengan Canvas & Convert ke JPG
      const compressedBase64 = await compressImage(file);

      // 2. Upload ke Google Drive via API
      const fileName = `profil_${user.id}_${Date.now()}.jpg`;
      const result = await uploadPhoto(compressedBase64, fileName);

      if (result.success && result.data?.url) {
        const photoUrl = result.data.url;

        // 3. Update State Lokal
        setForm((prev) => ({ ...prev, fotoProfil: photoUrl }));

        // 4. OTOMATIS SIMPAN KE GOOGLE SHEETS (Auto Save)
        await updateBiodataSiswa({
          ...form,
          idSiswa: user.id,
          fotoProfil: photoUrl, // Mengirim URL Foto Profil yang baru
        });

        setMessage(
          "✅ Foto profil berhasil diupload & otomatis tersimpan ke database!",
        );
      } else {
        setError(result.message || "Gagal upload foto.");
      }
    } catch (err) {
      setError("Terjadi kesalahan saat memproses foto.");
    } finally {
      setUploadingFoto(false);
      // Reset input agar bisa pilih file yang sama lagi jika perlu
      e.target.value = null;
    }
  }

  // Helper fungsi untuk mengubah file PDF ke Base64 murni
  function getBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }

  // Fungsi khusus upload Ijazah SMP
  async function handleIjazahChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Validasi Ekstensi (Hanya PDF)
    if (file.type !== "application/pdf") {
      setError("❌ File harus berformat PDF!");
      e.target.value = null;
      return;
    }

    // 2. Validasi Ukuran (Maksimal 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("❌ Ukuran file Ijazah maksimal 2MB!");
      e.target.value = null;
      return;
    }

    setUploadingIjazah(true);
    setError("");

    try {
      const base64 = await getBase64(file);
      const fileName = `ijazah_smp_${user.id}_${Date.now()}.pdf`;

      // 3. Upload File ke Drive
      const result = await uploadPhoto(base64, fileName, "application/pdf");

      if (result.success && result.data?.url) {
        const fileUrl = result.data.url;

        // Update State Lokal
        setForm((prev) => ({ ...prev, ijazahSmp: fileUrl }));

        // 4. OTOMATIS SIMPAN KE GOOGLE SHEETS (Auto Save)
        await updateBiodataSiswa({
          ...form,
          idSiswa: user.id,
          ijazahSmp: fileUrl, // Mengirim URL Ijazah yang baru saja diupload
        });

        setMessage(
          "✅ Ijazah SMP berhasil diupload & otomatis tersimpan ke database!",
        );
      } else {
        setError(result.message || "Gagal upload Ijazah.");
      }
    } catch (err) {
      setError("Terjadi kesalahan saat mengupload dokumen.");
    } finally {
      setUploadingIjazah(false);
      e.target.value = null;
    }
  }

  // Helper fungsi untuk kompresi ke bawah 500KB (max resolusi 800px, quality 0.7)
  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800;

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          // Convert otomatis ke image/jpeg dengan kualitas 70%
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          resolve(dataUrl);
        };
      };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await updateBiodataSiswa({
        idSiswa: user.id,
        fotoProfil: form.fotoProfil, // Kirim URL foto ke backend
        noHp: form.noHp,
        tempatLahir: form.tempatLahir,
        tglLahir: form.tglLahir,
        ayah: form.ayah,
        pekerjaanAyah: form.pekerjaanAyah,
        kontakAyah: form.kontakAyah,
        ibu: form.ibu,
        pekerjaanIbu: form.pekerjaanIbu,
        kontakIbu: form.kontakIbu,
        anakKe: form.anakKe,
        alamat: form.alamat,
        hobi: form.hobi,
        bakatKeahlian: form.bakatKeahlian,
        transportasi: form.transportasi,
        pelajaranDisukai: form.pelajaranDisukai,
        alasanDisukai: form.alasanDisukai,
        pelajaranTidakDisukai: form.pelajaranTidakDisukai,
        alasanTidakDisukai: form.alasanTidakDisukai,
        harapan: form.harapan,
        ijazahSmp: form.ijazahSmp, // ---> TAMBAHKAN INI
      });

      if (result.success) {
        setMessage("✅ Biodata berhasil disimpan.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setError(result.message || "Gagal menyimpan biodata.");
    } catch (err) {
      setError("Terjadi kesalahan saat menyimpan biodata.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center font-bold">
        Memuat biodata...
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <header className="sticky top-0 z-50 bg-blue-900 text-white shadow-md">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black">👤 BIODATA SAYA</h1>
          </div>
          <button
            onClick={() => router.push("/magang/dashboard_siswa")}
            className="rounded bg-white/20 px-3 py-1 text-xs font-bold"
          >
            Kembali
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 mt-6">
        <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 shadow-lg relative">
          {/* ----- UI FOTO PROFIL (Tengah Atas) ----- */}
          <div className="flex justify-center -mt-12 mb-4">
            <div className="relative w-28 h-28 rounded-full border-4 border-indigo-900 bg-slate-200 shadow-xl overflow-hidden group">
              {form.fotoProfil ? (
                <>
                  <img
                    src={formatDriveUrl(form.fotoProfil)} // ---> UBAH BAGIAN INI
                    alt="Foto Profil"
                    className="w-full h-full object-cover"
                  />
                  {/* Tombol Ganti Transparan di Kanan Atas */}
                  <div
                    onClick={handleFotoClick}
                    className="absolute top-0 right-0 bg-black/40 hover:bg-black/60 text-white/80 text-[10px] font-bold px-2 py-1 rounded-bl-lg cursor-pointer transition-all"
                  >
                    Ganti
                  </div>
                </>
              ) : (
                <div
                  onClick={handleFotoClick}
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-300 transition-colors"
                >
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-[10px] font-bold text-slate-500 text-center px-2">
                    Klik Upload
                    <br />
                    Foto
                  </span>
                </div>
              )}

              {/* Overlay Loading Foto */}
              {uploadingFoto && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-xs font-black text-blue-800 animate-pulse">
                    Loading..
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Input File Tersembunyi */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFotoChange}
            className="hidden"
          />
          {/* ------------------------------------------ */}

          <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider text-center">
            Identitas Siswa
          </p>
          <h2 className="mt-1 text-xl font-black text-center">
            {user?.nama || "-"}
          </h2>
          <div className="mt-3 flex justify-center gap-4 text-xs font-medium text-blue-100">
            <span>ID: {user?.id}</span> | <span>📍 {user?.tempatMagang}</span>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-emerald-50 text-emerald-700 p-3 text-xs font-bold text-center">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 text-rose-700 p-3 text-xs font-bold text-center">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Section title="📱 Data Siswa (Kontak & Lahir)">
            <Input
              label="No. HP / WhatsApp Pribadi"
              name="noHp"
              value={form.noHp}
              onChange={handleChange}
              placeholder="Contoh: 08123456789"
            />
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Input
                label="Tempat Lahir"
                name="tempatLahir"
                value={form.tempatLahir}
                onChange={handleChange}
              />
              <Input
                label="Tanggal Lahir"
                name="tglLahir"
                value={form.tglLahir}
                onChange={handleChange}
                placeholder="DD/MM/YYYY"
              />
            </div>
          </Section>

          <Section title="🏠 Data Pribadi">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Anak Ke"
                name="anakKe"
                value={form.anakKe}
                onChange={handleChange}
              />
              <Input
                label="Transportasi ke Sekolah"
                name="transportasi"
                value={form.transportasi}
                onChange={handleChange}
              />
              <Input
                label="Hobi"
                name="hobi"
                value={form.hobi}
                onChange={handleChange}
              />
              <Textarea
                label="Bakat / Keahlian"
                name="bakatKeahlian"
                value={form.bakatKeahlian}
                onChange={handleChange}
                rows={1}
              />
            </div>
            <div className="mt-3">
              <Textarea
                label="Alamat Lengkap"
                name="alamat"
                value={form.alamat}
                onChange={handleChange}
                rows={2}
              />
            </div>
          </Section>

          <Section title="👨‍👩‍👦 Data Orang Tua">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400">
                  DATA AYAH
                </p>
                <Input
                  label="Nama Ayah"
                  name="ayah"
                  value={form.ayah}
                  onChange={handleChange}
                />
                <Input
                  label="Pekerjaan"
                  name="pekerjaanAyah"
                  value={form.pekerjaanAyah}
                  onChange={handleChange}
                />
                <Input
                  label="Kontak"
                  name="kontakAyah"
                  value={form.kontakAyah}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400">DATA IBU</p>
                <Input
                  label="Nama Ibu"
                  name="ibu"
                  value={form.ibu}
                  onChange={handleChange}
                />
                <Input
                  label="Pekerjaan"
                  name="pekerjaanIbu"
                  value={form.pekerjaanIbu}
                  onChange={handleChange}
                />
                <Input
                  label="Kontak"
                  name="kontakIbu"
                  value={form.kontakIbu}
                  onChange={handleChange}
                />
              </div>
            </div>
          </Section>

          <Section title="📚 Minat Pelajaran & Harapan">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Pelajaran Disukai"
                name="pelajaranDisukai"
                value={form.pelajaranDisukai}
                onChange={handleChange}
              />
              <Input
                label="Alasan Menyukai"
                name="alasanDisukai"
                value={form.alasanDisukai}
                onChange={handleChange}
              />
              <Input
                label="Pelajaran Tidak Disukai"
                name="pelajaranTidakDisukai"
                value={form.pelajaranTidakDisukai}
                onChange={handleChange}
              />
              <Input
                label="Alasan Tidak Suka"
                name="alasanTidakDisukai"
                value={form.alasanTidakDisukai}
                onChange={handleChange}
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Harapan di SMKN 1 DAN CITA CITA KEDEPANNYA"
                name="harapan"
                value={form.harapan}
                onChange={handleChange}
                rows={3}
              />
            </div>
          </Section>

          <Section title="📄 Dokumen Pendukung">
            <label className="block w-full">
              <span className="block text-[10px] font-bold uppercase text-slate-500 mb-2">
                Upload Ijazah SMP (Hanya PDF, Max 2MB)
              </span>
              <input
                type="file"
                accept="application/pdf"
                onChange={handleIjazahChange}
                disabled={uploadingIjazah}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none file:mr-4 file:rounded-md file:border-0 file:bg-blue-100 file:px-4 file:py-2 file:text-xs file:font-bold file:text-blue-700 hover:file:bg-blue-200 cursor-pointer disabled:cursor-not-allowed"
              />
            </label>

            {/* Peringatan Status Loading */}
            {uploadingIjazah && (
              <div className="mt-3 text-xs font-bold text-blue-600 animate-pulse flex items-center gap-2">
                ⏳ Sedang mengupload Ijazah...
              </div>
            )}

            {/* Kotak Link Dokumen setelah sukses terupload */}
            {form.ijazahSmp && !uploadingIjazah && (
              <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">📄</span>
                    <div>
                      <p className="text-xs font-black text-emerald-900">
                        Ijazah SMP Terupload
                      </p>
                      <p className="text-[10px] text-emerald-600 font-medium">
                        File tersimpan aman di Google Drive
                      </p>
                    </div>
                  </div>

                  {/* Tombol Utama Buka Dokumen */}
                  <a
                    href={form.ijazahSmp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    🔍 Lihat Dokumen
                  </a>
                </div>

                {/* Menampilkan Teks Link URL Asli (Bisa diklik/dicopy) */}
                <div className="pt-2 border-t border-emerald-200/70 flex items-center gap-1 text-[11px] text-emerald-800 overflow-hidden">
                  <span className="font-bold shrink-0">🔗 Link File:</span>
                  <a
                    href={form.ijazahSmp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline truncate text-blue-600 hover:text-blue-800"
                  >
                    {form.ijazahSmp}
                  </a>
                </div>
              </div>
            )}
          </Section>

          <button
            type="submit"
            disabled={saving || uploadingFoto}
            className={`w-full rounded-xl text-white py-3.5 text-sm font-black shadow-md transition-all ${
              saving || uploadingFoto
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:scale-95"
            }`}
          >
            {saving ? "⏳ Menyimpan..." : "💾 SIMPAN BIODATA"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
      <h2 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-3 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Input({ label, name, value, onChange, placeholder }) {
  return (
    <label className="block w-full">
      <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
        {label}
      </span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
      />
    </label>
  );
}

function Textarea({ label, name, value, onChange, rows = 3 }) {
  return (
    <label className="block w-full">
      <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
        {label}
      </span>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 resize-none"
      />
    </label>
  );
}

// Fungsi untuk mengubah link Drive menjadi Direct Image Link yang kebal blokir
function formatDriveUrl(url) {
  if (!url) return "";

  let fileId = "";

  // Jika link format standar: drive.google.com/file/d/ID_FILE/view
  if (url.includes("/file/d/")) {
    fileId = url.split("/file/d/")[1].split("/")[0];
  }
  // Jika link format query: drive.google.com/uc?id=ID_FILE
  else if (url.includes("id=")) {
    fileId = url.split("id=")[1].split("&")[0];
  }

  if (fileId) {
    // Gunakan endpoint thumbnail Drive (Jauh lebih aman dari blokir CORS browser)
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }

  return url;
}
