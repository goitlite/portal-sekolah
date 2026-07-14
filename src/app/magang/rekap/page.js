"use client";

import { useEffect, useState } from "react";
import { getRekapGuru } from "../lib/api";
import { getSession } from "../lib/auth";
import Image from "next/image";
import Link from "next/link";
// IMPORT LIBRARY BARU DI SINI
import { toBlob } from "html-to-image";

export default function RekapPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [bulan, setBulan] = useState("");
  const [mode, setMode] = useState("card");
  const [tempat, setTempat] = useState("Semua");
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const session = getSession();
    const guruId = session ? session.id : "";
    const hasil = await getRekapGuru(guruId, bulan);

    console.log(hasil);
    setData(hasil.data || []);
    setLoading(false);
  }

  async function handleShareWA() {
    const cards = document.querySelectorAll(".rekap-card-wa");

    if (cards.length === 0) {
      alert("Tidak ada data card yang ditampilkan untuk dibagikan.");
      return;
    }

    setIsSharing(true);

    try {
      const filesArray = [];

      for (let i = 0; i < cards.length; i++) {
        // PERBAIKAN: Menggunakan html-to-image yang lebih tahan CSS Modern
        const blob = await toBlob(cards[i], {
          quality: 0.9,
          backgroundColor: "#ffffff",
          pixelRatio: 2, // Menggandakan resolusi agar HD seperti scale: 2
        });

        if (blob) {
          const file = new File([blob], `Rekap_Magang_${i + 1}.jpg`, {
            type: "image/jpeg",
          });
          filesArray.push(file);
        }
      }

      if (filesArray.length === 0) {
        throw new Error("Gagal menghasilkan gambar dari card.");
      }

      // Kirim kumpulan gambar langsung ke WhatsApp (Untuk HP)
      if (navigator.canShare && navigator.canShare({ files: filesArray })) {
        await navigator.share({
          title: "Rekap Presensi Magang",
          text: "Berikut adalah laporan rekap presensi dan monitoring siswa magang.",
          files: filesArray,
        });
      } else {
        // Fallback untuk Desktop/PC
        alert(
          "Perangkat PC tidak mendukung Share massal langsung. Gambar akan didownload otomatis, silakan tarik (drag) gambar tersebut ke WhatsApp Web.",
        );
        filesArray.forEach((file) => {
          const url = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    } catch (error) {
      console.error("Gagal membagikan ke WhatsApp:", error);
      alert("Terjadi kesalahan saat memproses gambar.");
    } finally {
      setIsSharing(false);
    }
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800">
              Rekap Kehadiran
            </h1>
            <p className="text-slate-500">Rekap presensi seluruh siswa.</p>
          </div>

          {/* TOMBOL SHARE WA */}
          {mode === "card" && (
            <button
              onClick={handleShareWA}
              disabled={isSharing || data.length === 0}
              className="rounded-xl bg-green-600 px-6 py-3 font-black text-white shadow transition hover:bg-green-700 disabled:bg-slate-400 flex items-center justify-center gap-2"
            >
              {isSharing ? "MEMPROSES GAMBAR..." : "📲 BAGIKAN KE WHATSAPP"}
            </button>
          )}
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
                  className="rekap-card-wa overflow-hidden rounded-3xl bg-white shadow"
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
