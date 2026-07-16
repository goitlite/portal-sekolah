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

  // --- HELPER UNTUK GAMBAR DRIVE ---
  function getSafeFreshUrl(url) {
    if (!url) return "";
    return url.includes("?")
      ? `${url}&v=${Date.now()}`
      : `${url}?v=${Date.now()}`;
  }

  // --- LOGIKA LOAD & RETRY ---
  useEffect(() => {
    clearBrowserState().then(() => {
      load();
    });
  }, []);

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
        await clearBrowserState();
        setTimeout(() => load(true), 1000);
      } else {
        setLoading(false);
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
        await clearBrowserState();
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
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* JUDUL & TOMBOL WA */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-6 sm:px-0 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                Live Monitoring
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight">
                Rekap Kehadiran
              </h1>
              <p className="mt-2 text-slate-500 font-medium text-base sm:text-lg">
                Pantau aktivitas dan presensi siswa magang secara real-time.
              </p>
            </div>

            <button
              onClick={handleShareWA}
              disabled={isSharing || data.length === 0}
              className="group relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-4 font-black text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-emerald-500/40 disabled:bg-slate-400 disabled:shadow-none flex items-center justify-center gap-3 w-full sm:w-auto sm:min-w-[280px]"
            >
              <div className="absolute inset-0 w-full h-full bg-white/20 scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-500 ease-out"></div>
              {isSharing ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span className="relative z-10">{shareProgress}</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-6 h-6 relative z-10"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span className="relative z-10 tracking-wide">
                    BAGIKAN LAPORAN
                  </span>
                </>
              )}
            </button>
          </div>

          {/* FILTER CONTROLS - Bersih & Rapi Tanpa Tab Switcher */}
          <div className="mx-6 sm:mx-0 flex flex-wrap items-end gap-4 bg-white p-4 rounded-3xl shadow-sm border border-slate-200/60 mb-10">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                Bulan
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
              >
                <option value="">Juli 2026</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1 block">
                Lokasi Magang
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition"
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

            <button
              onClick={forceFreshMode}
              className="rounded-xl px-6 py-3.5 font-bold bg-rose-100 text-rose-700 hover:bg-rose-200 shadow-sm transition-all h-[54px]"
              title="Hapus Cache & Refresh Halaman"
            >
              🔄 Refresh
            </button>
          </div>

          {/* LOADING STATE DATA AWAL */}
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {data
                .filter((x) =>
                  tempat === "Semua" ? true : x.tempat === tempat,
                )
                .map((item, index) => (
                  <div
                    key={index}
                    className="rekap-card-wa overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-white via-white to-blue-50/40 shadow-xl shadow-slate-200/60 border border-blue-100/70 flex flex-col transition-all duration-300 hover:shadow-2xl hover:border-blue-200/80"
                  >
                    {/* MODEL THUMBNAIL FOTO LAMA (Watermark Terlihat Jelas) */}
                    {item.foto ? (
                      <div
                        className="relative w-full h-[260px] sm:h-[380px] lg:h-[430px] bg-gradient-to-b from-slate-100 to-white overflow-hidden flex items-center justify-center cursor-pointer group"
                        onClick={() => setSelectedImage(item.foto)}
                      >
                        <img
                          src={item.foto}
                          alt="Foto Lokasi"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className="w-full max-h-[450px] object-contain transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
                          <span className="text-white font-black tracking-widest uppercase bg-blue-900/60 px-6 py-3 rounded-2xl border border-white/30 shadow-2xl flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                            <svg
                              className="w-5 h-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                              />
                            </svg>
                            Perbesar Foto
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-[300px] flex-col items-center justify-center bg-slate-50 text-slate-400 border-b border-dashed border-slate-200">
                        <svg
                          className="w-12 h-12 mb-3 text-slate-300"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="font-semibold tracking-wide">
                          Belum ada foto monitoring
                        </span>
                      </div>
                    )}

                    <div className="border-t border-slate-100"></div>

                    <div className="p-6 sm:p-7">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex-1">
                          {/* SENTUHAN SHAPE BADGE PADA NAMA PERUSAHAAN */}
                          <div className="inline-flex items-center gap-2.5 bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent pl-3 pr-5 py-2 rounded-full border border-blue-100/80 mb-3 shadow-sm">
                            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white text-xs shadow-md shadow-blue-500/20">
                              📍
                            </span>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight">
                              {item.tempat}
                            </h2>
                          </div>

                          {/* LOGO GURU PEMBIMBING YANG PRO */}
                          <div className="mt-1 text-slate-500 text-sm font-medium flex items-center gap-2">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 14l9-5-9-5-9 5 9 5z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                                />
                              </svg>
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                              GURU PEMBIMBING :
                            </span>
                            <span className="font-bold text-slate-700">
                              {item.guru}
                            </span>
                          </div>
                        </div>

                        <div className="bg-white border border-blue-100 text-blue-700 px-5 py-2 rounded-2xl text-center shadow-sm max-w-[120px]">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                            Total Siswa
                          </p>
                          <p className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-indigo-600">
                            {item.siswa.length}
                          </p>
                        </div>
                      </div>

                      {/* CONTAINER TABEL DAFTAR SISWA */}
                      <div className="mt-8 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                        <table className="w-full text-sm text-left border-separate border-spacing-y-3">
                          <thead>
                            <tr className="text-slate-400">
                              <th className="pb-3 px-4 font-bold uppercase tracking-wider text-xs w-14 text-center">
                                No
                              </th>
                              <th className="pb-3 px-4 font-bold uppercase tracking-wider text-xs">
                                Daftar Siswa
                              </th>
                              <th className="pb-3 px-2 font-black text-emerald-600 text-center w-12 text-xs">
                                H
                              </th>
                              <th className="pb-3 px-2 font-black text-amber-500 text-center w-12 text-xs">
                                I
                              </th>
                              <th className="pb-3 px-2 font-black text-blue-500 text-center w-12 text-xs">
                                S
                              </th>
                              <th className="pb-3 px-2 font-black text-rose-500 text-center w-12 text-xs">
                                A
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.siswa.map((s, i) => (
                              <tr
                                key={i}
                                onClick={() =>
                                  handleSiswaClick(
                                    s.id,
                                    s.nama,
                                    item.guru,
                                    item.tempat,
                                  )
                                }
                                className="bg-blue-600 text-white rounded-full cursor-pointer select-none transition-all duration-150 
                     md:hover:bg-blue-700 md:hover:scale-[1.01] md:hover:shadow-md
                     active:scale-[0.98] active:bg-blue-800"
                              >
                                {/* KOLOM NO DENGAN LINGKARAN SEMI-TRANSPARAN */}
                                <td className="py-3.5 px-4 text-center rounded-l-full">
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/20 font-bold text-xs">
                                    {i + 1}
                                  </span>
                                </td>

                                {/* NAMA SISWA */}
                                <td className="py-3.5 px-4 font-bold text-base tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">
                                  {s.nama}
                                </td>

                                {/* INDIKATOR KEHADIRAN (HADIR) */}
                                <td className="py-3.5 px-2 text-center">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white font-black shadow-sm">
                                    {s.hadir}
                                  </span>
                                </td>

                                {/* INDIKATOR KEHADIRAN (IZIN) */}
                                <td className="py-3.5 px-2 text-center">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500 text-white font-black shadow-sm">
                                    {s.izin}
                                  </span>
                                </td>

                                {/* INDIKATOR KEHADIRAN (SAKIT) */}
                                <td className="py-3.5 px-2 text-center">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-400 text-white font-black shadow-sm">
                                    {s.sakit}
                                  </span>
                                </td>

                                {/* INDIKATOR KEHADIRAN (ALFA) */}
                                <td className="py-3.5 px-2 text-center rounded-r-full">
                                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-500 text-white font-black shadow-sm">
                                    {s.alfa}
                                  </span>
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
          )}
        </div>
      </div>

      {/* OVERLAY GAMBAR / LIGHTBOX */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-2 sm:p-8"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 sm:top-8 sm:right-8 text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full w-12 h-12 flex items-center justify-center transition-all duration-300 focus:outline-none shadow-2xl z-[101]"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="relative max-w-full max-h-full w-full h-full flex items-center justify-center p-4">
            <img
              src={selectedImage}
              alt="Preview Full"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* DRAWER MODAL - DETAIL RIWAYAT PRESENSI SISWA */}
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
                        className="rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 border border-white/10 focus:outline-none transition-all"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2.5}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
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
                        <svg
                          className="w-16 h-16 mb-4 text-slate-200"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
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
                                            href={getSafeFreshUrl(fotoUrl)}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="group flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all border border-blue-100"
                                            title="Buka Foto Bukti"
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
                                            title="Buka Peta Lokasi"
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
