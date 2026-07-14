"use client";

import { useEffect, useState } from "react";
import { getRekapGuru } from "../lib/api";
import { getSession } from "../lib/auth";
import Image from "next/image";
import Link from "next/link";

export default function RekapPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [bulan, setBulan] = useState("");
  const [mode, setMode] = useState("card");
  const [tempat, setTempat] = useState("Semua");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const session = getSession();

    if (!session) return;

    const hasil = await getRekapGuru(session.id, bulan);

    console.log("HASIL REKAP =", hasil);

    setData(hasil.data || []);
  }

  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={52} height={52} />

            <div>
              <h1 className="text-lg font-black">PRESENSI MAGANG</h1>

              <p className="text-sm text-blue-100">SMKN 1 TELUK KUANTAN</p>
            </div>
          </div>

          <Link
            href="/magang/login"
            className="rounded-xl bg-white px-5 py-2 font-bold text-blue-700 hover:bg-blue-100"
          >
            Login
          </Link>
        </div>
      </header>

      <div className="space-y-6 p-6 min-h-screen bg-slate-100">
        <div>
          <h1 className="text-3xl font-black text-slate-800">
            Rekap Kehadiran
          </h1>
          <p className="text-slate-500">Rekap presensi seluruh siswa.</p>
        </div>

        {/* FILTER */}
        <div className="flex flex-wrap gap-3 bg-white p-5 rounded-3xl shadow">
          <select
            className="rounded-xl border p-3"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
          >
            <option value="">Juli 2026</option>
          </select>

          <select
            className="rounded-xl border p-3"
            value={tempat}
            onChange={(e) => setTempat(e.target.value)}
          >
            <option>Semua</option>
            {data.map((x) => (
              <option key={x.tempat} value={x.tempat}>
                {x.tempat}
              </option>
            ))}
          </select>

          <button
            onClick={() => setMode("card")}
            className={
              mode == "card"
                ? "rounded-xl bg-blue-700 px-5 py-3 text-white font-bold"
                : "rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-700"
            }
          >
            Card
          </button>

          <button
            onClick={() => setMode("table")}
            className={
              mode == "table"
                ? "rounded-xl bg-blue-700 px-5 py-3 text-white font-bold"
                : "rounded-xl bg-slate-200 px-5 py-3 font-bold text-slate-700"
            }
          >
            Tabel
          </button>
        </div>

        {/* TAMPILAN CARD */}
        {mode == "card" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data
              .filter((x) => {
                if (tempat == "Semua") return true;
                return x.tempat == tempat;
              })
              .map((item, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-3xl bg-white shadow"
                >
                  {item.foto ? (
                    <div className="bg-slate-100 flex items-center justify-center">
                      <img
                        src={item.foto}
                        alt="Foto Lokasi"
                        className="max-h-80 w-auto object-contain"
                      />
                    </div>
                  ) : (
                    <div className="flex h-72 items-center justify-center bg-slate-100 text-slate-400">
                      Belum ada foto monitoring
                    </div>
                  )}

                  <div className="p-6">
                    <h2 className="text-2xl font-black text-slate-800">
                      📍 {item.tempat}
                    </h2>
                    <p className="mt-2 text-slate-600">👨‍🏫 {item.guru}</p>
                    <p className="text-slate-600">
                      Jumlah siswa : <b>{item.siswa.length}</b>
                    </p>

                    <table className="mt-5 w-full text-sm text-left">
                      <thead>
                        <tr className="border-b">
                          <th className="py-2">No</th>
                          <th className="py-2">Nama</th>
                          <th className="py-2">H</th>
                          <th className="py-2">I</th>
                          <th className="py-2">S</th>
                          <th className="py-2">A</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.siswa.map((s, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="py-2">{i + 1}</td>
                            <td className="py-2">{s.nama}</td>
                            <td className="py-2">{s.hadir}</td>
                            <td className="py-2">{s.izin}</td>
                            <td className="py-2">{s.sakit}</td>
                            <td className="py-2">{s.alfa}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
}
