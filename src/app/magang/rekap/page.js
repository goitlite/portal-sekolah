"use client";

import { useEffect, useState } from "react";
import { getRekapGuru, getRiwayatSiswa } from "../lib/api";
import { getSession } from "../lib/auth";
import Image from "next/image";
import Link from "next/link";
import { toBlob } from "html-to-image";

export default function RekapPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [bulan, setBulan] = useState("");
  const [mode, setMode] = useState("card");
  const [tempat, setTempat] = useState("Semua");

  // State untuk share WA
  const [isSharing, setIsSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState("");

  // State untuk Detail Siswa (Modal/Drawer)
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [riwayatSiswa, setRiwayatSiswa] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const session = getSession();
    const guruId = session ? session.id : "";
    const hasil = await getRekapGuru(guruId, bulan);
    setData(hasil.data || []);
    setLoading(false);
  }

  // Fungsi saat nama siswa di-klik
  // Fungsi saat nama siswa di-klik
  async function handleSiswaClick(idSiswa, namaSiswa, namaGuru, tempatMagang) {
    setSelectedSiswa({
      id: idSiswa,
      nama: namaSiswa,
      guru: namaGuru,
      tempat: tempatMagang,
    });
    setRiwayatLoading(true);
    setRiwayatSiswa([]);

    try {
      // Ambil data riwayat dari API
      const response = await getRiwayatSiswa(idSiswa);

      // LOG DEBUGGING: Jika ingin melihat struktur data di Console browser (F12)
      console.log("Cek Response API Riwayat:", response);

      // PERBAIKAN: Ambil array yang ada di dalam "response.data"
      const riwayatData = response?.data
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

      if (riwayatData && Array.isArray(riwayatData) && riwayatData.length > 0) {
        // Balik urutan: dari yang paling lama hingga yang paling baru (kronologis naik)
        const sortedLamaKeBaru = [...riwayatData].reverse();
        setRiwayatSiswa(sortedLamaKeBaru);
      } else {
        setRiwayatSiswa([]);
      }
    } catch (error) {
      console.error("Gagal mengambil riwayat siswa:", error);
      setRiwayatSiswa([]);
    } finally {
      setRiwayatLoading(false);
    }
  }
  async function handleSiswaClick(idSiswa, namaSiswa, namaGuru, tempatMagang) {
    console.log("--- DEBUGGING KLIK SISWA ---");
    console.log("ID Siswa yang diklik:", idSiswa);

    setSelectedSiswa({
      id: idSiswa,
      nama: namaSiswa,
      guru: namaGuru,
      tempat: tempatMagang,
    });
    setRiwayatLoading(true);
    setRiwayatSiswa([]);

    try {
      const response = await getRiwayatSiswa(idSiswa);
      console.log("Response Lengkap dari API:", response);

      // Ambil data (asumsi struktur response API adalah { success: true, data: [...] })
      const dataSiswa = response.data || response;

      if (Array.isArray(dataSiswa)) {
        console.log("Jumlah data ditemukan:", dataSiswa.length);
        if (dataSiswa.length > 0) {
          setRiwayatSiswa([...dataSiswa].reverse());
        } else {
          console.warn(
            "API mengembalikan array kosong! Pastikan ID di sheet PRESENSI sama dengan ID di sheet SISWA.",
          );
        }
      } else {
        console.error("Format data dari API salah, bukan Array!");
      }
    } catch (error) {
      console.error("Error saat fetch:", error);
    } finally {
      setRiwayatLoading(false);
    }
  }

  // Helper mendapatkan nama Hari dari string Timestamp (Format: "YYYY-MM-DD HH:mm:ss" atau sejenisnya)
  function getHariDanTanggal(timestampStr) {
    if (!timestampStr) return { hari: "-", tanggal: "-" };
    try {
      const datePart = timestampStr.split(" ")[0];
      const date = new Date(datePart);
      if (isNaN(date.getTime())) return { hari: "-", tanggal: datePart };

      const hariNames = [
        "Minggu",
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu",
      ];
      const bulanNames = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];

      return {
        hari: hariNames[date.getDay()],
        tanggal: `${date.getDate()} ${bulanNames[date.getMonth()]} ${date.getFullYear()}`,
      };
    } catch (e) {
      return { hari: "-", tanggal: timestampStr };
    }
  }

  async function handleShareWA() {
    const cards = document.querySelectorAll(".rekap-card-wa");
    if (cards.length === 0) {
      alert("Tidak ada data card yang ditampilkan untuk dibagikan.");
      return;
    }

    setIsSharing(true);
    setShareProgress("Menyiapkan gambar...");

    try {
      const filesArray = [];
      for (let i = 0; i < cards.length; i++) {
        setShareProgress(`Memproses foto ${i + 1} dari ${cards.length}...`);
        const blob = await toBlob(cards[i], {
          quality: 0.9,
          backgroundColor: "#ffffff",
          pixelRatio: 2,
        });

        if (blob) {
          const file = new File([blob], `Rekap_Magang_${i + 1}.jpg`, {
            type: "image/jpeg",
          });
          filesArray.push(file);
        }
      }

      if (filesArray.length === 0)
        throw new Error("Gagal menghasilkan gambar.");

      setShareProgress("Membuka WhatsApp...");

      if (navigator.canShare && navigator.canShare({ files: filesArray })) {
        await navigator.share({
          title: "Rekap Presensi Magang",
          text: "Berikut adalah laporan rekap presensi dan monitoring siswa magang.",
          files: filesArray,
        });
      } else {
        alert(
          "Perangkat PC tidak mendukung Share massal langsung. Gambar akan didownload otomatis, silakan seret (drag) gambar tersebut ke WhatsApp Web.",
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
      setShareProgress("");
    }
  }

  return (
    <>
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow">
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
            <p className="text-slate-500">
              Rekap presensi seluruh siswa magang.
            </p>
          </div>

          {/* TOMBOL SHARE WA */}
          {mode === "card" && (
            <button
              onClick={handleShareWA}
              disabled={isSharing || data.length === 0}
              className="rounded-xl bg-green-600 px-6 py-3 font-black text-white shadow transition hover:bg-green-700 disabled:bg-slate-400 flex items-center justify-center gap-2 min-w-[250px]"
            >
              {isSharing ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  {shareProgress}
                </>
              ) : (
                "📲 BAGIKAN KE WHATSAPP"
              )}
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

        {/* LOADING STATE DATA AWAL */}
        {loading ? (
          <div className="mt-10 flex flex-col items-center justify-center text-slate-500">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700"></div>
            <p className="mt-4 font-semibold">Memuat rekap data & foto...</p>
          </div>
        ) : (
          /* TAMPILAN CARD */
          mode == "card" && (
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
                            <th className="py-2 text-center">H</th>
                            <th className="py-2 text-center">I</th>
                            <th className="py-2 text-center">S</th>
                            <th className="py-2 text-center">A</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.siswa.map((s, i) => (
                            <tr
                              key={i}
                              className="border-b last:border-b-0 hover:bg-slate-50 transition"
                            >
                              <td className="py-3">{i + 1}</td>
                              <td className="py-3">
                                {/* NAMA SISWA YANG BISA DI-KLIK */}
                                <button
                                  onClick={() =>
                                    handleSiswaClick(
                                      s.id,
                                      s.nama,
                                      item.guru,
                                      item.tempat,
                                    )
                                  }
                                  className="text-left font-bold text-blue-600 hover:text-blue-800 hover:underline focus:outline-none"
                                >
                                  {s.nama}
                                </button>
                              </td>
                              <td className="py-3 text-center font-semibold text-emerald-600">
                                {s.hadir}
                              </td>
                              <td className="py-3 text-center font-semibold text-amber-500">
                                {s.izin}
                              </td>
                              <td className="py-3 text-center font-semibold text-blue-500">
                                {s.sakit}
                              </td>
                              <td className="py-3 text-center font-semibold text-red-500">
                                {s.alfa}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          )
        )}
      </div>

      {/* DRAWER MODAL - DETAIL RIWAYAT PRESENSI SISWA */}
      {selectedSiswa && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          aria-labelledby="slide-over-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 overflow-hidden">
            {/* Background Overlay hitam transparan */}
            <div
              onClick={() => setSelectedSiswa(null)}
              className="absolute inset-0 bg-slate-900 bg-opacity-60 transition-opacity backdrop-blur-sm"
            ></div>

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 md:pl-16">
              {/* Drawer Container */}
              <div className="pointer-events-auto w-screen max-w-4xl transform transition-transform duration-500 ease-in-out">
                <div className="flex h-full flex-col bg-white shadow-2xl rounded-l-3xl overflow-hidden">
                  {/* HEADER DRAWER */}
                  <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black uppercase tracking-widest bg-blue-500 bg-opacity-40 px-3 py-1 rounded-full">
                          Riwayat Presensi Magang
                        </span>
                        <h2 className="text-2xl font-black mt-2 tracking-tight">
                          {selectedSiswa.nama}
                        </h2>
                      </div>
                      <button
                        onClick={() => setSelectedSiswa(null)}
                        className="rounded-full bg-black bg-opacity-20 p-2 text-white hover:bg-opacity-30 focus:outline-none transition"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Metadata Detail */}
                    <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white border-opacity-10 pt-4 text-sm">
                      <div>
                        <p className="text-blue-200 text-xs uppercase tracking-wider font-semibold">
                          Guru Pembimbing
                        </p>
                        <p className="font-bold mt-0.5">
                          👨‍🏫 {selectedSiswa.guru}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-200 text-xs uppercase tracking-wider font-semibold">
                          Tempat Magang
                        </p>
                        <p className="font-bold mt-0.5">
                          📍 {selectedSiswa.tempat}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BODY CONTENT */}
                  <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    {riwayatLoading ? (
                      <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700"></div>
                        <p className="mt-4 font-semibold">
                          Mengambil seluruh riwayat presensi...
                        </p>
                      </div>
                    ) : riwayatSiswa.length === 0 ? (
                      <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                        <p className="text-lg font-bold">
                          Belum ada riwayat presensi
                        </p>
                        <p className="text-sm text-slate-400">
                          Siswa belum pernah melakukan presensi bulan ini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* STATISTIK RINGKAS */}
                        <div className="grid grid-cols-3 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                          <div className="text-center border-r">
                            <span className="text-2xl font-black text-emerald-600">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Hadir")
                                  .length
                              }
                            </span>
                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                              Hadir
                            </p>
                          </div>
                          <div className="text-center border-r">
                            <span className="text-2xl font-black text-amber-500">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Izin")
                                  .length
                              }
                            </span>
                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                              Izin
                            </p>
                          </div>
                          <div className="text-center">
                            <span className="text-2xl font-black text-blue-500">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Sakit")
                                  .length
                              }
                            </span>
                            <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                              Sakit
                            </p>
                          </div>
                        </div>

                        {/* TABEL RIWAYAT LENGKAP */}
                        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                            <thead className="bg-slate-100 font-black text-slate-700 uppercase tracking-wider text-xs">
                              <tr>
                                <th className="px-4 py-3 text-center">No</th>
                                <th className="px-4 py-3">Tanggal & Hari</th>
                                <th className="px-4 py-3 text-center">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-center">Foto</th>
                                <th className="px-4 py-3 text-center">Peta</th>
                                <th className="px-4 py-3">
                                  Pembimbing Lapangan
                                </th>
                                <th className="px-4 py-3">Kompetensi</th>
                                <th className="px-4 py-3">Keterangan</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {riwayatSiswa.map((r, i) => {
                                // r[1] = Timestamp
                                // r[13] = FotoUrl, r[14] = MapUrl
                                // r[15] = Status (Hadir, Sakit, Izin)
                                // r[16] = Pembimbing Lapangan
                                // r[17] = Kompetensi, r[18] = Keterangan
                                const { hari, tanggal } = getHariDanTanggal(
                                  r.TIMESTAMP,
                                );

                                const status = r.STATUS || "-";
                                const fotoUrl = r.FOTO;
                                const mapUrl = r.MAP;

                                return (
                                  <tr
                                    key={i}
                                    className="hover:bg-slate-50 transition"
                                  >
                                    <td className="px-4 py-4 text-center font-bold text-slate-500">
                                      {i + 1}
                                    </td>
                                    <td className="px-4 py-4 whitespace-nowrap">
                                      <p className="font-bold text-slate-800">
                                        {tanggal}
                                      </p>
                                      <p className="text-xs text-slate-500 font-semibold">
                                        {hari}
                                      </p>
                                    </td>
                                    <td className="px-4 py-4 text-center whitespace-nowrap">
                                      <span
                                        className={`rounded-full px-3 py-1 text-xs font-black uppercase ${
                                          status === "Hadir"
                                            ? "bg-emerald-100 text-emerald-800"
                                            : status === "Izin"
                                              ? "bg-amber-100 text-amber-800"
                                              : "bg-blue-100 text-blue-800"
                                        }`}
                                      >
                                        {status}
                                      </span>
                                    </td>
                                    {/* Link Foto Singkat */}
                                    <td className="px-4 py-4 text-center">
                                      {fotoUrl ? (
                                        <a
                                          href={fotoUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center justify-center rounded-lg bg-blue-100 p-2 text-blue-700 hover:bg-blue-200 transition"
                                          title="Buka Foto"
                                        >
                                          📸
                                        </a>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                    {/* Link Map Singkat */}
                                    <td className="px-4 py-4 text-center">
                                      {mapUrl ? (
                                        <a
                                          href={mapUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center justify-center rounded-lg bg-rose-100 p-2 text-rose-700 hover:bg-rose-200 transition"
                                          title="Buka Google Maps"
                                        >
                                          🗺️
                                        </a>
                                      ) : (
                                        "-"
                                      )}
                                    </td>
                                    <td
                                      className="px-4 py-4 max-w-[150px] truncate"
                                      title={r.PEMBIMBING_LAPANGAN || "-"}
                                    >
                                      {r.PEMBIMBING_LAPANGAN || "-"}
                                    </td>
                                    <td
                                      className="px-4 py-4 max-w-[150px] truncate font-medium text-slate-700"
                                      title={r.KOMPETENSI_YANG_DIKUASAI || "-"}
                                    >
                                      {r.KOMPETENSI_YANG_DIKUASAI || "-"}
                                    </td>
                                    <td
                                      className="px-4 py-4 max-w-[150px] truncate text-xs text-slate-500"
                                      title={r.KETERANGAN || "-"}
                                    >
                                      {r.KETERANGAN || "-"}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FOOTER DRAWER */}
                  <div className="border-t border-slate-100 bg-slate-50 p-6 flex justify-end">
                    <button
                      onClick={() => setSelectedSiswa(null)}
                      className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Tutup Riwayat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
