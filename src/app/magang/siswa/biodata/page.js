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
    citaCita: "",
    bakatKeahlian: "",
    transportasi: "",

    pelajaranDisukai: "",
    alasanDisukai: "",

    pelajaranTidakDisukai: "",
    alasanTidakDisukai: "",

    harapan: "",
  });

  // ============================================================
  // LOAD
  // ============================================================

  useEffect(() => {
    async function loadData() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();

      if (!session || session.role !== "siswa") {
        router.replace("/magang/login");
        return;
      }

      setUser(session);

      try {
        const result = await getBiodataSiswa(session.id);

        if (result.success && result.data) {
          setForm({
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
            citaCita: result.data.citaCita || "",
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
        console.error(err);

        setError("Gagal mengambil data biodata.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  // ============================================================
  // HANDLE INPUT
  // ============================================================

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  // ============================================================
  // SAVE
  // ============================================================

  async function handleSubmit(e) {
    e.preventDefault();

    if (!user) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await updateBiodataSiswa({
        idSiswa: user.id,

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
        citaCita: form.citaCita,
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

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });
      } else {
        setError(result.message || "Gagal menyimpan biodata.");
      }
    } catch (err) {
      console.error(err);

      setError("Terjadi kesalahan saat menyimpan biodata.");
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200" />

            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
          </div>

          <p className="mt-4 font-bold text-slate-600">Memuat biodata...</p>
        </div>
      </main>
    );
  }

  // ============================================================
  // PAGE
  // ============================================================

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      {/* HEADER */}

      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-black">👤 BIODATA SAYA</h1>

            <p className="text-[10px] sm:text-xs text-blue-300">
              DATA PRIBADI SISWA
            </p>
          </div>

          <button
            onClick={() => router.push("/magang/dashboard_siswa")}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-xs font-bold hover:bg-white/20"
          >
            ← Kembali
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 mt-6">
        {/* IDENTITAS */}

        <div className="rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 text-white p-6 shadow-xl">
          <p className="text-xs text-blue-300 font-bold uppercase tracking-wider">
            Identitas Siswa
          </p>

          <h2 className="mt-2 text-2xl font-black">{user?.nama || "-"}</h2>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Info label="ID Siswa" value={user?.id} />

            <Info label="Guru Pembimbing" value={user?.namaGuru} />

            <Info label="Tempat Magang" value={user?.tempatMagang} />
          </div>
        </div>

        {/* MESSAGE */}

        {message && (
          <div className="mt-5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 p-4 font-bold text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-4 font-bold text-sm">
            ❌ {error}
          </div>
        )}

        {/* FORM */}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* DATA LAHIR */}

          <Section title="📅 Data Kelahiran">
            <div className="grid sm:grid-cols-2 gap-4">
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

          {/* AYAH */}

          <Section title="👨 Data Ayah">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Nama Ayah"
                name="ayah"
                value={form.ayah}
                onChange={handleChange}
              />

              <Input
                label="Pekerjaan Ayah"
                name="pekerjaanAyah"
                value={form.pekerjaanAyah}
                onChange={handleChange}
              />

              <Input
                label="Kontak Ayah"
                name="kontakAyah"
                value={form.kontakAyah}
                onChange={handleChange}
              />
            </div>
          </Section>

          {/* IBU */}

          <Section title="👩 Data Ibu">
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                label="Nama Ibu"
                name="ibu"
                value={form.ibu}
                onChange={handleChange}
              />

              <Input
                label="Pekerjaan Ibu"
                name="pekerjaanIbu"
                value={form.pekerjaanIbu}
                onChange={handleChange}
              />

              <Input
                label="Kontak Ibu"
                name="kontakIbu"
                value={form.kontakIbu}
                onChange={handleChange}
              />
            </div>
          </Section>

          {/* DATA PRIBADI */}

          <Section title="🏠 Data Pribadi">
            <div className="grid sm:grid-cols-2 gap-4">
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

              <Textarea
                label="Alamat"
                name="alamat"
                value={form.alamat}
                onChange={handleChange}
              />

              <Input
                label="Hobi"
                name="hobi"
                value={form.hobi}
                onChange={handleChange}
              />

              <Input
                label="Cita-cita"
                name="citaCita"
                value={form.citaCita}
                onChange={handleChange}
              />

              <Textarea
                label="Bakat / Keahlian"
                name="bakatKeahlian"
                value={form.bakatKeahlian}
                onChange={handleChange}
              />
            </div>
          </Section>

          {/* PELAJARAN */}

          <Section title="📚 Minat Pelajaran">
            <Input
              label="Pelajaran yang Disukai"
              name="pelajaranDisukai"
              value={form.pelajaranDisukai}
              onChange={handleChange}
            />

            <Textarea
              label="Alasan Menyukai"
              name="alasanDisukai"
              value={form.alasanDisukai}
              onChange={handleChange}
            />

            <Input
              label="Pelajaran yang Tidak Disukai"
              name="pelajaranTidakDisukai"
              value={form.pelajaranTidakDisukai}
              onChange={handleChange}
            />

            <Textarea
              label="Alasan Tidak Menyukai"
              name="alasanTidakDisukai"
              value={form.alasanTidakDisukai}
              onChange={handleChange}
            />
          </Section>

          {/* HARAPAN */}

          <Section title="🎓 Harapan di SMKN 1">
            <Textarea
              label="Harapan"
              name="harapan"
              value={form.harapan}
              onChange={handleChange}
              rows={5}
            />
          </Section>

          {/* BUTTON */}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white py-4 font-black shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {saving ? "⏳ Menyimpan..." : "💾 SIMPAN BIODATA"}
          </button>
        </form>
      </div>
    </main>
  );
}

/* ============================================================
   COMPONENTS
============================================================ */

function Section({ title, children }) {
  return (
    <section className="rounded-[2rem] bg-white border border-slate-200 shadow-sm p-5 sm:p-7">
      <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-4 mb-5">
        {title}
      </h2>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Input({ label, name, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </span>

      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function Textarea({ label, name, value, onChange, rows = 3 }) {
  return (
    <label className="block">
      <span className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </span>

      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800 outline-none resize-y focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/10 p-3">
      <p className="text-[10px] text-blue-300 uppercase font-bold">{label}</p>

      <p className="mt-1 text-sm font-black truncate">{value || "-"}</p>
    </div>
  );
}
