"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

import { getSession, isLoggedIn } from "../../lib/auth";
import { getSiswaById, editSiswa } from "../../lib/api";

export default function EditSiswaPage() {
  const router = useRouter();
  const params = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);

  const [form, setForm] = useState({
    id: "",
    nama: "",
    namaGuru: "",
    tempatMagang: "",
  });

  useEffect(() => {
    async function loadData() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();

      if (!session || session.role !== "guru") {
        router.replace("/magang/login");
        return;
      }

      setUser(session);

      try {
        const result = await getSiswaById(params.id);

        console.log(result);

        if (!result.success) {
          alert(result.message);
          router.push("/magang/siswa");
          return;
        }

        const data = result.data;

        setForm({
          id: data.ID,
          nama: data.NAMA,
          namaGuru: data.NAMA_GURU,
          tempatMagang: data.TEMPAT_MAGANG,
        });
      } catch (err) {
        console.error(err);
        alert("Gagal mengambil data siswa.");
      }

      setLoading(false);
    }

    loadData();
  }, [params.id, router]);

  async function simpan() {
    if (form.nama.trim() === "") {
      alert("Nama siswa belum diisi.");
      return;
    }

    if (form.tempatMagang.trim() === "") {
      alert("Tempat magang belum diisi.");
      return;
    }

    setSaving(true);

    try {
      const result = await editSiswa({
        id: form.id,
        nama: form.nama,
        namaGuru: form.namaGuru,
        tempatMagang: form.tempatMagang,
      });

      if (result.success) {
        alert("Data siswa berhasil diperbarui.");
        router.push("/magang/siswa");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    }

    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700"></div>

          <p className="mt-4 text-slate-500">Memuat data siswa...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* HEADER */}

      <header className="sticky top-0 bg-white shadow z-50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={45} height={45} />

            <div>
              <h1 className="font-black text-slate-800">EDIT SISWA MAGANG</h1>

              <p className="text-xs text-slate-500">Guru : {user?.nama}</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/magang/siswa")}
            className="rounded-xl bg-slate-700 px-5 py-2 text-white font-bold hover:bg-slate-800"
          >
            Kembali
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-2xl p-6">
        <div className="rounded-3xl bg-white p-8 shadow">
          <h2 className="text-3xl font-black text-slate-800 mb-8">
            Form Edit Siswa
          </h2>

          <div className="space-y-6">
            <div>
              <label className="mb-2 block font-semibold text-slate-700">
                ID Siswa
              </label>

              <input
                value={form.id}
                disabled
                className="w-full rounded-xl border bg-slate-100 px-4 py-3 text-slate-700"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-slate-700">
                Nama Siswa
              </label>

              <input
                value={form.nama}
                onChange={(e) =>
                  setForm({
                    ...form,
                    nama: e.target.value,
                  })
                }
                className="w-full rounded-xl border px-4 py-3 text-slate-800"
              />
            </div>

            <div>
              <label className="mb-2 block font-semibold text-slate-700">
                Tempat Magang
              </label>

              <input
                value={form.tempatMagang}
                onChange={(e) =>
                  setForm({
                    ...form,
                    tempatMagang: e.target.value,
                  })
                }
                className="w-full rounded-xl border px-4 py-3 text-slate-800"
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                onClick={() => router.push("/magang/siswa")}
                className="flex-1 rounded-xl bg-slate-500 py-3 font-bold text-white hover:bg-slate-600"
              >
                Batal
              </button>

              <button
                onClick={simpan}
                disabled={saving}
                className="flex-1 rounded-xl bg-blue-700 py-3 font-bold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {saving ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
