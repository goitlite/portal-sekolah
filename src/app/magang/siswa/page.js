"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { getSiswaByGuru, deleteSiswa } from "../lib/api";
import { getSession, isLoggedIn } from "../lib/auth";

export default function DaftarSiswa() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [siswa, setSiswa] = useState([]);

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
        const result = await getSiswaByGuru(session.id);

        console.log(result);

        if (result.success) {
          setSiswa(result.data);
        } else {
          alert(result.message);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal mengambil data siswa.");
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  async function handleDelete(id) {
    const yakin = confirm("Apakah Anda yakin ingin menghapus siswa ini?");

    if (!yakin) return;

    try {
      const result = await deleteSiswa(id);

      if (result.success) {
        alert("Siswa berhasil dihapus.");

        setSiswa((prev) => prev.filter((item) => item.ID !== id));
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);

      alert("Gagal menghapus siswa.");
    }
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

      <header className="sticky top-0 z-50 bg-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={45} height={45} />

            <div>
              <h1 className="font-black text-slate-800">DAFTAR SISWA MAGANG</h1>

              <p className="text-xs text-slate-500">Guru : {user?.nama}</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/magang/guru")}
            className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-bold text-white hover:bg-blue-800"
          >
            Kembali
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-black text-slate-800">Daftar Siswa</h2>

            <p className="text-slate-500">Total siswa : {siswa.length}</p>
          </div>

          <button
            onClick={() => router.push("/magang/tambah")}
            className="rounded-xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
          >
            + Tambah Siswa
          </button>
        </div>

        {siswa.length === 0 ? (
          <div className="rounded-3xl bg-white p-12 text-center shadow">
            <h2 className="text-xl font-bold text-slate-700">
              Belum Ada Siswa
            </h2>

            <p className="mt-2 text-slate-500">
              Guru ini belum memiliki siswa magang.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {siswa.map((item) => (
              <div
                key={item.ID}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow transition hover:-translate-y-1 hover:shadow-xl"
              >
                <h2 className="text-2xl font-black text-slate-800">
                  {item.NAMA}
                </h2>

                <div className="mt-5 space-y-2">
                  <div>
                    <p className="text-xs uppercase text-slate-400">ID SISWA</p>

                    <p className="font-bold">{item.ID}</p>
                  </div>

                  <div>
                    <p className="text-xs uppercase text-slate-400">
                      TEMPAT MAGANG
                    </p>

                    <p className="font-semibold">{item.TEMPAT_MAGANG}</p>
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => router.push(`/magang/edit/${item.ID}`)}
                    className="flex-1 rounded-xl bg-amber-500 py-3 font-bold text-white hover:bg-amber-600"
                  >
                    ✏ Edit
                  </button>

                  <button
                    onClick={() => handleDelete(item.ID)}
                    className="flex-1 rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700"
                  >
                    🗑 Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
