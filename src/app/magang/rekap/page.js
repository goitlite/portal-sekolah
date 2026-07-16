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
  const [isSharing, setIsSharing] = useState(false);
  const [shareProgress, setShareProgress] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [riwayatSiswa, setRiwayatSiswa] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  // --- FUNGSI RESET CACHE & BROWSER STATE ---
  async function clearBrowserState() {
    localStorage.clear();
    sessionStorage.clear();

    if ("caches" in window) {
      try {
        const keys = await caches.keys();
        for (const key of keys) {
          await caches.delete(key);
        }
      } catch (error) {
        console.error("Gagal menghapus Cache Storage:", error);
      }
    }

    if ("serviceWorker" in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      } catch (error) {
        console.error("Gagal unregister Service Worker:", error);
      }
    }
  }

  async function forceFreshMode() {
    await clearBrowserState();
    window.history.replaceState({}, "", window.location.pathname);
    window.location.href = window.location.pathname + "?fresh=" + Date.now();
  }

  // Bersihkan cache saat halaman pertama kali dibuka
  useEffect(() => {
    clearBrowserState().then(() => {
      load();
    });
  }, []);

  // --- LOGIKA FETCH DENGAN RETRY ---
  async function load(isRetry = false) {
    if (!isRetry) setLoading(true);

    try {
      const session = getSession();
      const guruId = session ? session.id : "";
      const hasil = await getRekapGuru(guruId, bulan);
      setData(hasil.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Fetch Rekap error:", error);
      if (!isRetry) {
        console.log("Mencoba ulang (retry) dalam 1 detik...");
        await clearBrowserState(); // Reset cache otomatis
        setTimeout(() => load(true), 1000);
      } else {
        setLoading(false);
        // Biarkan gagal setelah retry, user bisa pakai tombol Paksa Fresh
      }
    }
  }

  async function handleSiswaClick(
    idSiswa,
    namaSiswa,
    namaGuru,
    tempatMagang,
    isRetry = false,
  ) {
    if (!isRetry) {
      setSelectedSiswa({
        id: idSiswa,
        nama: namaSiswa,
        guru: namaGuru,
        tempat: tempatMagang,
      });
      setRiwayatLoading(true);
      setRiwayatSiswa([]);
    }

    try {
      const response = await getRiwayatSiswa(idSiswa);
      const dataSiswa = response.data || response;

      if (Array.isArray(dataSiswa)) {
        if (dataSiswa.length > 0) {
          setRiwayatSiswa([...dataSiswa].reverse());
        }
      }
      setRiwayatLoading(false);
    } catch (error) {
      console.error("Fetch Riwayat error:", error);
      if (!isRetry) {
        console.log("Mencoba ulang (retry) riwayat dalam 1 detik...");
        await clearBrowserState(); // Reset cache otomatis
        setTimeout(
          () =>
            handleSiswaClick(idSiswa, namaSiswa, namaGuru, tempatMagang, true),
          1000,
        );
      } else {
        setRiwayatLoading(false);
      }
    }
  }

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
    if (cards.length === 0) return;

    setIsSharing(true);
    setShareProgress("Menyiapkan gambar...");

    try {
      const filesArray = [];
      for (let i = 0; i < cards.length; i++) {
        setShareProgress(`Memproses foto ${i + 1} dari ${cards.length}...`);
        const blob = await toBlob(cards[i], {
          quality: 0.9,
          backgroundColor: "#f8fafc",
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
          "Gambar akan didownload otomatis, silakan seret (drag) ke WhatsApp.",
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
    } finally {
      setIsSharing(false);
      setShareProgress("");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg border-b border-blue-700/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-1.5 rounded-2xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={48}
                height={48}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                PRESENSI MAGANG
              </h1>
              <p className="text-sm font-medium text-blue-300 tracking-wide">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>
          <Link
            href="/magang/login"
            className="rounded-xl bg-white/10 px-6 py-2.5 font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 hover:border-white transition-all duration-300 shadow-sm"
          >
            Login
          </Link>
        </div>
      </header>

      <div className="min-h-screen bg-slate-50 space-y-8 pb-12 pt-8">
        <div className="mx-auto max-w-7xl px-0 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-6 sm:px-0 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                Live Monitoring
              </div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                Rekap Kehadiran
              </h1>
              <p className="mt-2 text-slate-500 font-medium text-lg">
                Pantau aktivitas dan presensi siswa magang secara *real-time*.
              </p>
            </div>

            {mode === "card" && (
              <button
                onClick={handleShareWA}
                disabled={isSharing || data.length === 0}
                className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-4 font-black text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-emerald-500/40 disabled:bg-slate-400 flex items-center justify-center gap-3 min-w-[280px]"
              >
                {isSharing ? (
                  <>
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span className="relative z-10">{shareProgress}</span>
                  </>
                ) : (
                  <>
                    <span className="relative z-10 tracking-wide">
                      BAGIKAN LAPORAN
                    </span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="mx-6 sm:mx-0 flex flex-wrap gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-200/60 mb-10 items-end">
            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                Bulan
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-semibold text-slate-700 outline-none focus:border-blue-500"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
              >
                <option value="">Juli 2026</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                Lokasi Magang
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-semibold text-slate-700 outline-none focus:border-blue-500"
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
            </div>

            {/* TOMBOL MODE FRESH (BARU) */}
            <div className="flex items-end gap-2">
              <button
                onClick={forceFreshMode}
                className="rounded-xl px-6 py-3.5 font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 shadow-sm transition-all"
                title="Hapus Cache & Refresh Halaman"
              >
                🔄 Refresh Data
              </button>

              <button
                onClick={() => setMode("card")}
                className={`rounded-xl px-6 py-3.5 font-bold transition-all ${
                  mode === "card"
                    ? "bg-blue-700 text-white shadow-lg shadow-blue-700/30"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                Card
              </button>
              <button
                onClick={() => setMode("table")}
                className={`rounded-xl px-6 py-3.5 font-bold transition-all ${
                  mode === "table"
                    ? "bg-blue-700 text-white shadow-lg shadow-blue-700/30"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                Tabel
              </button>
            </div>
          </div>

          {loading ? (
            <div className="mt-20 flex flex-col items-center justify-center text-slate-500">
              <div className="relative h-16 w-16">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-700 border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-6 font-semibold text-lg tracking-wide">
                Sinkronisasi Data Sistem...
              </p>
            </div>
          ) : (
            mode === "card" && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 px-0 sm:px-0">
                {data
                  .filter((x) => {
                    if (tempat === "Semua") return true;
                    return x.tempat === tempat;
                  })
                  .map((item, index) => (
                    <div
                      key={index}
                      className="rekap-card-wa overflow-hidden sm:rounded-[2rem] bg-white shadow-xl shadow-slate-200/50 border-y sm:border border-slate-200 flex flex-col -mx-6 sm:mx-0"
                    >
                      {item.foto ? (
                        <div
                          className="relative w-full cursor-pointer bg-slate-100 flex items-center justify-center group overflow-hidden"
                          onClick={() => setSelectedImage(item.foto)}
                        >
                          {/* GAMBAR DENGAN BUSTER CACHE & EAGER */}
                          <img
                            src={`${item.foto}?v=${Date.now()}`}
                            loading="eager"
                            alt="Foto Lokasi"
                            className="w-full max-h-[450px] object-contain transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
                            <span className="text-white font-black tracking-widest uppercase bg-blue-900/60 px-6 py-3 rounded-2xl border border-white/30 shadow-2xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                              Perbesar Foto
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex h-[300px] flex-col items-center justify-center bg-slate-50 text-slate-400 border-b border-dashed border-slate-200">
                          <span className="font-semibold tracking-wide">
                            Belum ada foto monitoring
                          </span>
                        </div>
                      )}

                      <div className="p-6 sm:p-8">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                              <span className="text-blue-600">📍</span>{" "}
                              {item.tempat}
                            </h2>
                            <p className="mt-2 text-slate-500 font-medium flex items-center gap-2">
                              <span className="bg-slate-100 p-1 rounded-lg">
                                👨‍🏫
                              </span>{" "}
                              {item.guru}
                            </p>
                          </div>
                          <div className="bg-blue-50 border border-blue-100 text-blue-700 px-4 py-2 rounded-2xl text-center">
                            <p className="text-xs font-black uppercase tracking-wider mb-0.5 opacity-70">
                              Total Siswa
                            </p>
                            <p className="text-2xl font-black">
                              {item.siswa.length}
                            </p>
                          </div>
                        </div>

                        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                          <table className="w-full text-sm text-left">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="py-3.5 px-4 font-bold text-slate-500 w-12 text-center">
                                  No
                                </th>
                                <th className="py-3.5 px-4 font-bold text-slate-500">
                                  Nama Siswa
                                </th>
                                <th className="py-3.5 px-2 font-black text-emerald-600 text-center w-10">
                                  H
                                </th>
                                <th className="py-3.5 px-2 font-black text-amber-500 text-center w-10">
                                  I
                                </th>
                                <th className="py-3.5 px-2 font-black text-blue-500 text-center w-10">
                                  S
                                </th>
                                <th className="py-3.5 px-2 font-black text-rose-500 text-center w-10">
                                  A
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {item.siswa.map((s, i) => (
                                <tr
                                  key={i}
                                  className="hover:bg-blue-50/50 transition-colors duration-200 group"
                                >
                                  <td className="py-4 px-4 text-center font-medium text-slate-400">
                                    {i + 1}
                                  </td>
                                  <td className="py-4 px-4">
                                    <button
                                      onClick={() =>
                                        handleSiswaClick(
                                          s.id,
                                          s.nama,
                                          item.guru,
                                          item.tempat,
                                        )
                                      }
                                      className="text-left font-bold text-slate-700 group-hover:text-blue-700 group-hover:underline focus:outline-none transition-colors"
                                    >
                                      {s.nama}
                                    </button>
                                  </td>
                                  <td className="py-4 px-2 text-center font-black text-emerald-600 bg-emerald-50/30">
                                    {s.hadir}
                                  </td>
                                  <td className="py-4 px-2 text-center font-black text-amber-500 bg-amber-50/30">
                                    {s.izin}
                                  </td>
                                  <td className="py-4 px-2 text-center font-black text-blue-500 bg-blue-50/30">
                                    {s.sakit}
                                  </td>
                                  <td className="py-4 px-2 text-center font-black text-rose-500 bg-rose-50/30">
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

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-2 sm:p-8"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-300 z-[101]"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            Tutup
          </button>
          <div className="relative max-w-full max-h-full w-full h-full flex items-center justify-center p-4">
            {/* GAMBAR OVERLAY DENGAN BUSTER CACHE & EAGER */}
            <img
              src={`${selectedImage}?v=${Date.now()}`}
              loading="eager"
              alt="Preview Full"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {selectedSiswa && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          aria-labelledby="slide-over-title"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 overflow-hidden">
            <div
              onClick={() => setSelectedSiswa(null)}
              className="absolute inset-0 bg-slate-900/60 transition-opacity backdrop-blur-sm"
            ></div>
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <div className="pointer-events-auto w-screen max-w-4xl transform transition-transform duration-500 ease-in-out">
                <div className="flex h-full flex-col bg-slate-50 shadow-2xl rounded-l-[2.5rem] overflow-hidden border-l border-white/20">
                  <div className="relative bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900 p-8 text-white overflow-hidden">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl"></div>
                    <div className="relative flex items-start justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 bg-blue-400/20 border border-blue-300/30 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md mb-4">
                          <span className="w-2 h-2 rounded-full bg-blue-300"></span>{" "}
                          Riwayat Presensi
                        </div>
                        <h2 className="text-3xl font-black tracking-tight leading-none mb-1">
                          {selectedSiswa.nama}
                        </h2>
                      </div>
                      <button
                        onClick={() => setSelectedSiswa(null)}
                        className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 border border-white/10 transition-all"
                      >
                        Tutup
                      </button>
                    </div>

                    <div className="relative mt-8 grid grid-cols-2 gap-6 border-t border-white/10 pt-6 text-sm">
                      <div>
                        <p className="text-blue-200/80 text-xs uppercase tracking-widest font-bold mb-1">
                          Pembimbing
                        </p>
                        <p className="font-bold text-lg flex items-center gap-2">
                          <span className="text-xl">👨‍🏫</span>{" "}
                          {selectedSiswa.guru}
                        </p>
                      </div>
                      <div>
                        <p className="text-blue-200/80 text-xs uppercase tracking-widest font-bold mb-1">
                          Lokasi Magang
                        </p>
                        <p className="font-bold text-lg flex items-center gap-2">
                          <span className="text-xl">📍</span>{" "}
                          {selectedSiswa.tempat}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                    {riwayatLoading ? (
                      <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                        <div className="relative h-12 w-12 mb-4">
                          <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                          <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
                        </div>
                        <p className="font-bold tracking-wide">
                          Menyinkronkan Riwayat...
                        </p>
                      </div>
                    ) : riwayatSiswa.length === 0 ? (
                      <div className="flex h-64 flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-dashed border-slate-300">
                        <p className="text-xl font-black text-slate-700">
                          Belum Ada Data
                        </p>
                        <p className="text-sm font-medium mt-1">
                          Siswa belum melakukan presensi bulan ini.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute top-0 w-full h-1 bg-emerald-500"></div>
                            <span className="text-4xl font-black text-emerald-600 group-hover:scale-110 transition-transform">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Hadir")
                                  .length
                              }
                            </span>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
                              Hadir
                            </p>
                          </div>
                          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute top-0 w-full h-1 bg-amber-500"></div>
                            <span className="text-4xl font-black text-amber-500 group-hover:scale-110 transition-transform">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Izin")
                                  .length
                              }
                            </span>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
                              Izin
                            </p>
                          </div>
                          <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden group">
                            <div className="absolute top-0 w-full h-1 bg-blue-500"></div>
                            <span className="text-4xl font-black text-blue-500 group-hover:scale-110 transition-transform">
                              {
                                riwayatSiswa.filter((r) => r.STATUS === "Sakit")
                                  .length
                              }
                            </span>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-2">
                              Sakit
                            </p>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40">
                          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-wider text-[11px]">
                              <tr>
                                <th className="px-6 py-4 text-center">No</th>
                                <th className="px-6 py-4">Waktu Presensi</th>
                                <th className="px-6 py-4 text-center">
                                  Status
                                </th>
                                <th className="px-6 py-4 text-center">Bukti</th>
                                <th className="px-6 py-4">Pembimbing</th>
                                <th className="px-6 py-4">
                                  Kegiatan / Kompetensi
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
                                    className="hover:bg-slate-50/80 transition-colors"
                                  >
                                    <td className="px-6 py-5 text-center font-bold text-slate-400">
                                      {i + 1}
                                    </td>
                                    <td className="px-6 py-5 whitespace-nowrap">
                                      <p className="font-bold text-slate-800 text-base">
                                        {tanggal}
                                      </p>
                                      <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                                        {hari}
                                      </p>
                                    </td>
                                    <td className="px-6 py-5 text-center whitespace-nowrap">
                                      <span
                                        className={`inline-flex rounded-xl px-4 py-1.5 text-xs font-black uppercase tracking-wider border ${
                                          status === "Hadir"
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : status === "Izin"
                                              ? "bg-amber-50 text-amber-700 border-amber-200"
                                              : "bg-blue-50 text-blue-700 border-blue-200"
                                        }`}
                                      >
                                        {status}
                                      </span>
                                    </td>
                                    <td className="px-6 py-5 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        {fotoUrl ? (
                                          <a
                                            href={`${fotoUrl}?v=${Date.now()}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-100"
                                          >
                                            <span className="text-lg group-hover:scale-110 transition-transform">
                                              📸
                                            </span>
                                          </a>
                                        ) : (
                                          <span className="h-10 w-10 flex items-center justify-center text-slate-300 font-bold">
                                            -
                                          </span>
                                        )}
                                        {mapUrl && (
                                          <a
                                            href={mapUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-all border border-rose-100"
                                          >
                                            <span className="text-lg group-hover:scale-110 transition-transform">
                                              📍
                                            </span>
                                          </a>
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      className="px-6 py-5 max-w-[150px] truncate font-semibold text-slate-700"
                                      title={r.PEMBIMBING_LAPANGAN || "-"}
                                    >
                                      {r.PEMBIMBING_LAPANGAN || "-"}
                                    </td>
                                    <td className="px-6 py-5">
                                      <p
                                        className="max-w-[200px] truncate font-bold text-slate-800"
                                        title={
                                          r.KOMPETENSI_YANG_DIKUASAI || "-"
                                        }
                                      >
                                        {r.KOMPETENSI_YANG_DIKUASAI || "-"}
                                      </p>
                                      {r.KETERANGAN && (
                                        <p
                                          className="max-w-[200px] truncate text-xs text-slate-500 mt-1"
                                          title={r.KETERANGAN}
                                        >
                                          Catatan: {r.KETERANGAN}
                                        </p>
                                      )}
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

                  <div className="border-t border-slate-200 bg-white p-6 flex justify-end z-10">
                    <button
                      onClick={() => setSelectedSiswa(null)}
                      className="rounded-xl border-2 border-slate-200 bg-white px-8 py-3 font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all focus:outline-none focus:ring-4 focus:ring-slate-100"
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
