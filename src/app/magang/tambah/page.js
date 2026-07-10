"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { addSiswa } from "../lib/api";
import { getSession, isLoggedIn } from "../lib/auth";

export default function TambahSiswaPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [guru, setGuru] = useState(null);

  const [nama, setNama] = useState("");
  const [tempatMagang, setTempatMagang] = useState("");

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/magang/login");
      return;
    }

    const session = getSession();

    if (!session || session.role !== "guru") {
      router.replace("/magang/login");
      return;
    }

    setGuru(session);
    setLoading(false);
  }, [router]);

  async function simpanSiswa() {
    if (nama.trim() === "") {
      alert("Nama siswa belum diisi.");
      return;
    }

    if (tempatMagang.trim() === "") {
      alert("Tempat magang belum diisi.");
      return;
    }

    setSaving(true);

    try {
      const result = await addSiswa({
        nama: nama,
        idGuru: guru.id,
        namaGuru: guru.nama,
        tempatMagang: tempatMagang,
      });

      if (result.success) {
        alert("Siswa berhasil ditambahkan.\n\nID Siswa : " + result.data.id);

        router.replace("/magang/siswa");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);

      alert("Terjadi kesalahan.");
    }

    setSaving(false);
  }

  if (loading || !guru) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-100">
        <p>Memuat...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      {/* HEADER */}

      <header className="bg-white border-b shadow-sm">
        <div className="mx-auto max-w-4xl flex items-center gap-4 px-6 py-4">
          <Image src="/logo.png" width={45} height={45} alt="logo" />

          <div>
            <h1 className="font-black text-xl">TAMBAH SISWA MAGANG</h1>

            <p className="text-sm text-slate-500">Guru : {guru.nama}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl p-6">
        <div className="rounded-3xl bg-white shadow p-8">
          <h2 className="text-2xl font-black mb-8">Form Tambah Siswa</h2>

          <div className="space-y-6">
            <div>
              <label className="block mb-2 font-semibold">Nama Siswa</label>

              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Masukkan nama siswa"
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">Tempat Magang</label>

              <input
                type="text"
                value={tempatMagang}
                onChange={(e) => setTempatMagang(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="Contoh : PT PLN Teluk Kuantan"
              />
            </div>
          </div>

          <div className="mt-10 flex gap-4">
            <button
              onClick={() => router.back()}
              className="rounded-xl border px-6 py-3 font-bold"
            >
              Batal
            </button>

            <button
              onClick={simpanSiswa}
              disabled={saving}
              className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white hover:bg-blue-800 disabled:bg-slate-400"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
