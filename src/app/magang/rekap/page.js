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
      const dataSiswa = response?.data
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

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

  // Helper mendapatkan nama Hari dari string Timestamp
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
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-700 to-blue-900 text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Logo"
              width={52}
              height={52}
              className="drop-shadow-sm"
            />
            <div>
              <h1 className="text-lg font-black tracking-wide">
                PRESENSI MAGANG
              </h1>
              <p className="text-xs font-semibold text-blue-100 tracking-wider">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>
          <Link
            href="/magang/login"
            className="rounded-lg bg-white px-5 py-2 text-sm font-bold text-blue-700 shadow transition-colors hover:bg-blue-50 focus:ring-2 focus:ring-blue-300"
          >
            Login
          </Link>
        </div>
      </header>

      <div className="space-y-6 bg-slate-100 min-h-screen p-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Rekap Kehadiran
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Rekap presensi seluruh siswa magang lapangan.
              </p>
            </div>

            {/* TOMBOL SHARE WA */}
            {mode === "card" && (
              <button
                onClick={handleShareWA}
                disabled={isSharing || data.length === 0}
                className="flex min-w-[250px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black tracking-wide text-white shadow-md transition-all hover:bg-emerald-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-slate-400"
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
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-4 shadow-sm border border-slate-100 mb-6">
            <select
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={bulan}
              onChange={(e) => setBulan(e.target.value)}
            >
              <option value="">Juli 2026</option>
            </select>

            <select
              className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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

            <div className="ml-auto flex gap-2">
              <button
                onClick={() => setMode("card")}
                className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-colors ${
                  mode === "card"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Card
              </button>

              <button
                onClick={() => setMode("table")}
                className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-colors ${
                  mode === "table"
                    ? "bg-blue-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tabel
              </button>
            </div>
          </div>

          {/* LOADING STATE DATA AWAL */}
          {loading ? (
            <div className="mt-16 flex flex-col items-center justify-center text-slate-500">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700"></div>
              <p className="mt-4 text-sm font-semibold">
                Memuat rekap data & foto...
              </p>
            </div>
          ) : (
            /* TAMPILAN CARD */
            mode === "card" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {data
                  .filter((x) => {
                    if (tempat === "Semua") return true;
                    return x.tempat === tempat;
                  })
                  .map((item, index) => (
                    <div
                      key={index}
                      className="rekap-card-wa flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm border border-slate-200 transition-shadow duration-300 hover:shadow-lg"
                    >
                      {/* Laporan Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3">
                        <div>
                          <h3 className="text-xs font-black tracking-wider text-slate-800">
                            LAPORAN MONITORING MAGANG
                          </h3>
                          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-0.5">
                            SMKN 1 Teluk Kuantan
                          </p>
                        </div>
                      </div>

                      {/* Area Foto Presensi - Ukuran Maksimal & Klik View Full */}
                      {item.foto ? (
                        <div className="flex h-80 w-full items-center justify-center bg-slate-50 p-3 border-b border-slate-200 overflow-hidden">
                          <a
                            href={item.foto}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-sm transition-transform duration-200 hover:scale-[1.01] cursor-zoom-in"
                            title="Klik untuk melihat foto asli resolusi penuh"
                          >
                            <img
                              src={item.foto}
                              alt="Foto Lokasi"
                              className="h-full w-full object-contain rounded-xl"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
                              <span className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-700 shadow-md">
                                🔍 Buka Ukuran Penuh
                              </span>
                            </div>
                          </a>
                        </div>
                      ) : (
                        <div className="flex h-80 w-full flex-col items-center justify-center border-b border-slate-200 bg-slate-50 text-slate-400">
                          <span className="text-4xl mb-3">📷</span>
                          <span className="text-sm font-semibold">
                            Belum ada foto monitoring
                          </span>
                        </div>
                      )}

                      {/* Meta Info Guru & Tempat */}
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <h2 className="text-lg font-black text-slate-800 leading-tight">
                              📍 {item.tempat}
                            </h2>
                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs shadow-sm shadow-indigo-200">
                                👨‍🏫
                              </span>
                              <div className="leading-tight">
                                <span className="text-xs text-slate-400 font-medium block">
                                  Guru Pembimbing :
                                </span>
                                <span className="text-slate-800 font-bold">
                                  {item.guru}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-center rounded-lg border border-blue-100 bg-gradient-to-b from-blue-50 to-blue-100/50 px-4 py-2 shadow-inner">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                              Total Siswa
                            </span>
                            <span className="text-xl font-black text-blue-800">
                              {item.siswa.length}
                            </span>
                          </div>
                        </div>

                        {/* Tabel Ringkas Rekap Presensi */}
                        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200">
                              <tr>
                                <th className="px-3 py-2 font-black text-slate-600">
                                  No
                                </th>
                                <th className="px-3 py-2 font-black text-slate-600">
                                  Nama Siswa
                                </th>
                                <th className="px-2 py-2 text-center font-black text-emerald-600">
                                  H
                                </th>
                                <th className="px-2 py-2 text-center font-black text-amber-500">
                                  I
                                </th>
                                <th className="px-2 py-2 text-center font-black text-blue-500">
                                  S
                                </th>
                                <th className="px-2 py-2 text-center font-black text-red-500">
                                  A
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {item.siswa.map((s, i) => (
                                <tr
                                  key={i}
                                  className="transition-colors hover:bg-slate-50/80"
                                >
                                  <td className="px-3 py-1.5 font-medium text-slate-500">
                                    {i + 1}
                                  </td>
                                  <td className="px-3 py-1.5 font-medium">
                                    <button
                                      onClick={() =>
                                        handleSiswaClick(
                                          s.id,
                                          s.nama,
                                          item.guru,
                                          item.tempat,
                                        )
                                      }
                                      className="inline-flex items-center gap-1.5 text-left font-bold text-blue-600 transition-colors hover:text-blue-800 hover:underline focus:outline-none truncate max-w-[140px] md:max-w-[200px]"
                                    >
                                      {/* Ikon User Disamping Nama */}
                                      <svg
                                        className="w-3.5 h-3.5 text-slate-400 flex-shrink-0"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                      <span className="truncate">{s.nama}</span>
                                    </button>
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-bold text-emerald-600">
                                    {s.hadir}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-bold text-amber-500">
                                    {s.izin}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-bold text-blue-500">
                                    {s.sakit}
                                  </td>
                                  <td className="px-2 py-1.5 text-center font-bold text-red-500">
                                    {s.alfa}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )
          )}
        </div>
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
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            ></div>

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              {/* Drawer Container */}
              <div className="pointer-events-auto w-screen max-w-4xl transform transition-transform duration-500 ease-in-out">
                <div className="flex h-full flex-col overflow-hidden rounded-l-3xl bg-white shadow-2xl">
                  {/* HEADER DRAWER */}
                  <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-6 text-white shadow-inner">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block rounded-full bg-blue-500/40 px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                          Riwayat Presensi Magang
                        </span>
                        <h2 className="mt-3 text-2xl font-black tracking-tight leading-tight">
                          {selectedSiswa.nama}
                        </h2>
                      </div>
                      <button
                        onClick={() => setSelectedSiswa(null)}
                        className="rounded-full bg-black/20 p-2.5 text-white transition hover:bg-black/40 focus:outline-none"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                            d="M6 18L18 6M6 6l12 12"
                          ></path>
                        </svg>
                      </button>
                    </div>

                    {/* Metadata Detail */}
                    <div className="mt-6 grid grid-cols-2 gap-6 border-t border-white/10 pt-5 text-sm">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                          Guru Pembimbing
                        </p>
                        <p className="mt-1 font-bold">
                          👨‍🏫 {selectedSiswa.guru}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
                          Tempat Magang
                        </p>
                        <p className="mt-1 font-bold">
                          📍 {selectedSiswa.tempat}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BODY CONTENT */}
                  <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                    {riwayatLoading ? (
                      <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-700"></div>
                        <p className="mt-4 text-sm font-semibold">
                          Mengambil seluruh riwayat presensi...
                        </p>
                      </div>
                    ) : riwayatSiswa.length === 0 ? (
                      <div className="flex h-64 flex-col items-center justify-center text-slate-400">
                        <p className="text-lg font-bold">
                          Belum ada riwayat presensi
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          Siswa belum pernah melakukan presensi bulan ini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* STATISTIK RINGKAS */}
                        <div className="grid grid-cols-3 divide-x divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm p-2">
                          <div className="flex flex-col items-center justify-center py-3">
                            <span className="text-3xl font-black text-emerald-600">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Hadir")
                                  .length
                              }
                            </span>
                            <p className="mt-1 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                              Hadir
                            </p>
                          </div>
                          <div className="flex flex-col items-center justify-center py-3">
                            <span className="text-3xl font-black text-amber-500">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Izin")
                                  .length
                              }
                            </span>
                            <p className="mt-1 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                              Izin
                            </p>
                          </div>
                          <div className="flex flex-col items-center justify-center py-3">
                            <span className="text-3xl font-black text-blue-500">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Sakit")
                                  .length
                              }
                            </span>
                            <p className="mt-1 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                              Sakit
                            </p>
                          </div>
                        </div>

                        {/* TABEL RIWAYAT LENGKAP */}
                        <div className="overflow-hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <table className="min-w-full text-left text-xs whitespace-nowrap">
                            <thead className="border-b border-slate-200 bg-slate-50">
                              <tr>
                                <th className="px-4 py-3 text-center font-black uppercase tracking-wider text-slate-600">
                                  No
                                </th>
                                <th className="px-4 py-3 font-black uppercase tracking-wider text-slate-600">
                                  Tanggal & Hari
                                </th>
                                <th className="px-4 py-3 text-center font-black uppercase tracking-wider text-slate-600">
                                  Status
                                </th>
                                <th className="px-4 py-3 text-center font-black uppercase tracking-wider text-slate-600">
                                  Foto
                                </th>
                                <th className="px-4 py-3 text-center font-black uppercase tracking-wider text-slate-600">
                                  Peta
                                </th>
                                <th className="px-4 py-3 font-black uppercase tracking-wider text-slate-600">
                                  Pembimbing
                                </th>
                                <th className="px-4 py-3 font-black uppercase tracking-wider text-slate-600">
                                  Kompetensi
                                </th>
                                <th className="px-4 py-3 font-black uppercase tracking-wider text-slate-600">
                                  Keterangan
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {riwayatSiswa.map((r, i) => {
                                const { hari, tanggal } = getHariDanTanggal(
                                  r.TIMESTAMP,
                                );
                                const status = r.STATUS || "-";
                                const fotoUrl = r.FOTO;
                                const mapUrl = r.MAP;

                                return (
                                  <tr
                                    key={i}
                                    className="transition hover:bg-slate-50"
                                  >
                                    <td className="px-4 py-3 text-center font-bold text-slate-500">
                                      {i + 1}
                                    </td>
                                    <td className="px-4 py-3">
                                      <p className="font-bold text-slate-800">
                                        {tanggal}
                                      </p>
                                      <p className="mt-0.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide">
                                        {hari}
                                      </p>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <span
                                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
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
                                    <td className="px-4 py-3 text-center">
                                      {fotoUrl ? (
                                        <a
                                          href={fotoUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center justify-center rounded-lg bg-blue-50 p-1.5 text-blue-600 transition hover:bg-blue-100 hover:text-blue-800"
                                          title="Buka Foto"
                                        >
                                          📸
                                        </a>
                                      ) : (
                                        <span className="text-slate-300">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {mapUrl ? (
                                        <a
                                          href={mapUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="inline-flex items-center justify-center rounded-lg bg-rose-50 p-1.5 text-rose-600 transition hover:bg-rose-100 hover:text-rose-800"
                                          title="Buka Google Maps"
                                        >
                                          🗺️
                                        </a>
                                      ) : (
                                        <span className="text-slate-300">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td
                                      className="px-4 py-3 max-w-[150px] truncate font-medium text-slate-700"
                                      title={r.PEMBIMBING_LAPANGAN || "-"}
                                    >
                                      {r.PEMBIMBING_LAPANGAN || "-"}
                                    </td>
                                    <td
                                      className="px-4 py-3 max-w-[180px] truncate font-semibold text-slate-800"
                                      title={r.KOMPETENSI_YANG_DIKUASAI || "-"}
                                    >
                                      {r.KOMPETENSI_YANG_DIKUASAI || "-"}
                                    </td>
                                    <td
                                      className="px-4 py-3 max-w-[150px] truncate font-medium text-slate-500"
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
                  <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
                    <button
                      onClick={() => setSelectedSiswa(null)}
                      className="rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
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
