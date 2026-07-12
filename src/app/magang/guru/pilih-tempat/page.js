"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getTempatMagangGuru } from "../../lib/api";

import { getSession, isLoggedIn } from "../../lib/auth";

export default function PilihTempatPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [tempat, setTempat] = useState([]);

  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();

      if (!session || session.role !== "guru") {
        router.replace("/magang/login");
        return;
      }

      const hasil = await getTempatMagangGuru(session.id);
      console.log("SESSION :", session);
      console.log("HASIL API :", hasil);

      if (hasil.success) {
        setTempat(hasil.data);
      }

      setLoading(false);
    }

    init();
  }, []);

  function pilih(item) {
    localStorage.setItem("tempatMagangMonitoring", item.tempat);

    router.push("/magang/guru/monitoring");
  }

  const filtered = tempat.filter((item) =>
    item.tempat.toLowerCase().includes(keyword.toLowerCase()),
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        Memuat...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="max-w-5xl mx-auto p-6">
        <h1 className="text-3xl font-black">Pilih Tempat Magang</h1>

        <p className="text-slate-500 mt-2">
          Monitoring dilakukan berdasarkan lokasi magang.
        </p>

        <input
          className="mt-6 w-full rounded-xl border p-4"
          placeholder="Cari tempat magang..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />

        <div className="grid gap-5 mt-8">
          {filtered.map((item, index) => (
            <button
              key={index}
              onClick={() => pilih(item)}
              className="bg-white rounded-2xl p-6 shadow hover:shadow-lg text-left"
            >
              <h2 className="text-xl font-bold">{item.tempat}</h2>

              <p className="text-slate-500 mt-2">{item.jumlah} siswa</p>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
