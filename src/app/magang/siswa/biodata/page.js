"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBiodataSiswa, updateBiodataSiswa } from "../../lib/api";
import { getSession, isLoggedIn } from "../../lib/auth";

export default function BiodataSiswa() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    noHp: "", // Menggantikan citaCita
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await updateBiodataSiswa({
        idSiswa: user.id,
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
        <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 shadow-lg">
          <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider">
            Identitas Siswa
          </p>
          <h2 className="mt-1 text-xl font-black">{user?.nama || "-"}</h2>
          <div className="mt-3 flex gap-4 text-xs font-medium text-blue-100">
            <span>ID: {user?.id}</span> | <span>📍 {user?.tempatMagang}</span>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-emerald-50 text-emerald-700 p-3 text-xs font-bold">
            {" "}
            {message}{" "}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 text-rose-700 p-3 text-xs font-bold">
            {" "}
            ❌ {error}{" "}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* KONTAK HP DILETAKKAN DI BAGIAN DATA SISWA */}
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

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 text-white py-3.5 text-sm font-black shadow-md hover:bg-blue-700 active:scale-95 transition-all"
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
