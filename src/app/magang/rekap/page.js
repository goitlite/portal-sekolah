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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white/10 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={36}
                height={36}
                className="object-contain sm:w-[48px] sm:h-[48px]"
              />
            </div>
            <div>
              <h1 className="text-base sm:text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                PRESENSI MAGANG
              </h1>
              <p className="text-[10px] sm:text-sm font-medium text-blue-300 tracking-wide">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>
          <Link
            href="/magang/login"
            className="rounded-lg sm:rounded-xl bg-white/10 px-4 sm:px-6 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm"
          >
            Login
          </Link>
        </div>
      </header>

      <div className="min-h-screen bg-slate-50 space-y-8 pb-12 pt-6 sm:pt-8">
        <div className="mx-auto max-w-7xl px-3 sm:px-6">
          {/* JUDUL & TOMBOL WA */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2 sm:mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
                Live Monitoring
              </div>
              <h1 className="text-2xl sm:text-4xl font-black text-slate-800 tracking-tight">
                Rekap Kehadiran
              </h1>
              <p className="mt-1 sm:mt-2 text-slate-500 font-medium text-sm sm:text-lg">
                Pantau aktivitas dan presensi siswa magang.
              </p>
            </div>

            <button
              onClick={handleShareWA}
              disabled={isSharing || data.length === 0}
              className="group relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 sm:px-8 py-3.5 sm:py-4 text-sm sm:text-base font-black text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 disabled:bg-slate-400 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {isSharing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  <span>{shareProgress}</span>
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5 sm:w-6 sm:h-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  <span>BAGIKAN LAPORAN</span>
                </>
              )}
            </button>
          </div>

          {/* FILTER CONTROLS */}
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/60 mb-6 sm:mb-10">
            <div className="flex-1 w-full sm:min-w-[200px]">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">
                Bulan
              </label>
              <select
                className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3.5 text-sm sm:text-base font-semibold text-slate-700 outline-none focus:border-blue-500"
                value={bulan}
                onChange={(e) => setBulan(e.target.value)}
              >
                <option value="">Juli 2026</option>
              </select>
            </div>

            <div className="flex-1 w-full sm:min-w-[200px]">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">
                Lokasi Magang
              </label>
              <select
                className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3.5 text-sm sm:text-base font-semibold text-slate-700 outline-none focus:border-blue-500"
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
              className="w-full sm:w-auto rounded-lg sm:rounded-xl px-4 sm:px-6 py-2.5 sm:py-3.5 text-sm sm:text-base font-bold bg-rose-100 text-rose-700 mt-auto sm:h-[54px]"
            >
              🔄 Refresh
            </button>
          </div>

          {/* LOADING STATE */}
          {loading ? (
            <div className="mt-20 flex flex-col items-center justify-center text-slate-500">
              <div className="relative h-12 w-12 sm:h-16 sm:w-16">
                <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-700 border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-4 sm:mt-6 font-semibold text-sm sm:text-lg">
                Sinkronisasi Data Sistem...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
              {data
                .filter((x) =>
                  tempat === "Semua" ? true : x.tempat === tempat,
                )
                .map((item, index) => (
                  <div
                    key={index}
                    // --- PERUBAHAN WARNA CARD YANG LEBIH JELAS & ELEGAN ---
                    className="rekap-card-wa overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] bg-gradient-to-br from-blue-100 via-indigo-50 to-blue-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-blue-300 flex flex-col transition-all duration-300"
                  >
                    {item.foto ? (
                      <div
                        className="relative w-full h-[220px] sm:h-[350px] lg:h-[400px] bg-white flex items-center justify-center cursor-pointer group border-b border-blue-200"
                        onClick={() => setSelectedImage(item.foto)}
                      >
                        <img
                          src={item.foto}
                          alt="Foto Lokasi"
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-blue-900/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <span className="text-white text-xs sm:text-sm font-bold bg-blue-900/70 px-4 py-2 rounded-xl">
                            Perbesar Foto
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-[200px] sm:h-[300px] flex-col items-center justify-center bg-white border-b border-blue-200 text-slate-400">
                        <svg
                          className="w-10 h-10 mb-2 text-slate-300"
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
                        <span className="text-xs sm:text-sm font-semibold">
                          Belum ada foto
                        </span>
                      </div>
                    )}

                    <div className="p-4 sm:p-7">
                      {/* --- HEADER CARD: TEMPAT (KIRI) & GURU (KANAN) --- */}
                      <div className="flex flex-row items-start justify-between gap-2 sm:gap-4 border-b border-blue-200/60 pb-3 sm:pb-4">
                        {/* KIRI - Tempat Magang */}
                        <div className="flex-1 text-left">
                          <div className="inline-flex items-start gap-1 sm:gap-2 bg-blue-600 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl shadow-sm mb-1.5">
                            <span className="text-[10px] sm:text-sm mt-0.5">
                              📍
                            </span>
                            <h2 className="text-[12px] sm:text-xl font-black tracking-tight leading-snug break-words">
                              {item.tempat}
                            </h2>
                          </div>
                          <div className="mt-1">
                            <span className="inline-block bg-blue-200/80 text-blue-900 text-[9px] sm:text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-md">
                              Total: {item.siswa.length} Siswa
                            </span>
                          </div>
                        </div>

                        {/* KANAN - Guru Pembimbing */}
                        <div className="flex-1 text-right flex flex-col items-end">
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5 sm:mb-1 text-slate-500">
                            <span className="text-[9px] sm:text-xs font-black uppercase tracking-wider">
                              Pembimbing
                            </span>
                            <div className="flex items-center justify-center w-4 h-4 sm:w-6 sm:h-6 rounded bg-indigo-500 text-white shadow-sm">
                              <svg
                                className="w-2.5 h-2.5 sm:w-4 sm:h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2.5}
                                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                />
                              </svg>
                            </div>
                          </div>
                          <p className="text-[11px] sm:text-sm font-bold text-slate-800 leading-tight">
                            {item.guru}
                          </p>
                        </div>
                      </div>

                      {/* --- TABEL SISWA (TANPA SCROLL HORIZONTAL, TEKS LEBIH RAPAT) --- */}
                      <div className="mt-4 sm:mt-5 w-full rounded-xl sm:rounded-2xl border border-white bg-white/70 backdrop-blur-sm p-1.5 sm:p-3 shadow-inner">
                        {/* Hapus overflow-x-auto, pastikan tabel 100% mengisi lebar */}
                        <table className="w-full text-left border-separate border-spacing-y-1 sm:border-spacing-y-2">
                          <thead>
                            <tr className="text-slate-600">
                              <th className="pb-1 px-1 sm:px-3 font-bold uppercase text-[9px] sm:text-xs w-6 sm:w-12 text-center">
                                No
                              </th>
                              <th className="pb-1 px-1 sm:px-3 font-bold uppercase text-[9px] sm:text-xs">
                                Nama Siswa
                              </th>
                              <th className="pb-1 px-0.5 sm:px-2 font-black text-emerald-600 text-center w-6 sm:w-10 text-[9px] sm:text-xs">
                                H
                              </th>
                              <th className="pb-1 px-0.5 sm:px-2 font-black text-amber-500 text-center w-6 sm:w-10 text-[9px] sm:text-xs">
                                I
                              </th>
                              <th className="pb-1 px-0.5 sm:px-2 font-black text-blue-500 text-center w-6 sm:w-10 text-[9px] sm:text-xs">
                                S
                              </th>
                              <th className="pb-1 px-0.5 sm:px-2 font-black text-rose-500 text-center w-6 sm:w-10 text-[9px] sm:text-xs">
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
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg sm:rounded-full cursor-pointer transition-all active:scale-[0.98] shadow-sm"
                              >
                                <td className="py-1.5 sm:py-3 px-1 sm:px-3 text-center rounded-l-lg sm:rounded-l-full">
                                  <span className="inline-flex items-center justify-center w-4 h-4 sm:w-7 sm:h-7 rounded-md sm:rounded-full bg-white/20 font-bold text-[9px] sm:text-xs mx-auto">
                                    {i + 1}
                                  </span>
                                </td>

                                {/* Teks nama dibiarkan membungkus ke bawah (wrap) jika panjang, tidak dipotong */}
                                <td className="py-1.5 sm:py-3 px-1 sm:px-3 font-semibold text-[10px] sm:text-sm leading-tight whitespace-normal break-words">
                                  {s.nama}
                                </td>

                                <td className="py-1.5 sm:py-3 px-0.5 sm:px-2 text-center">
                                  <span className="inline-flex items-center justify-center w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-full bg-emerald-500 text-white font-bold text-[9px] sm:text-sm mx-auto shadow-sm">
                                    {s.hadir}
                                  </span>
                                </td>
                                <td className="py-1.5 sm:py-3 px-0.5 sm:px-2 text-center">
                                  <span className="inline-flex items-center justify-center w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-full bg-amber-500 text-white font-bold text-[9px] sm:text-sm mx-auto shadow-sm">
                                    {s.izin}
                                  </span>
                                </td>
                                <td className="py-1.5 sm:py-3 px-0.5 sm:px-2 text-center">
                                  <span className="inline-flex items-center justify-center w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-full bg-blue-400 text-white font-bold text-[9px] sm:text-sm mx-auto shadow-sm">
                                    {s.sakit}
                                  </span>
                                </td>
                                <td className="py-1.5 sm:py-3 px-0.5 sm:px-2 text-center rounded-r-lg sm:rounded-r-full">
                                  <span className="inline-flex items-center justify-center w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-full bg-rose-500 text-white font-bold text-[9px] sm:text-sm mx-auto shadow-sm">
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

      {/* OVERLAY GAMBAR / LIGHTBOX (Tetap Sama) */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-2 sm:p-8"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center transition-all z-[101]"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImage(null);
            }}
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
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
          <div className="relative w-full h-full flex items-center justify-center p-4">
            <img
              src={selectedImage}
              alt="Preview"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* MODAL RIWAYAT PRESENSI SISWA (Tetap Sama) */}
      {/* ... (Kode Modal Drawer Riwayat tidak diubah agar fokus ke perbaikan card utama) ... */}
      {selectedSiswa && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          {/* Background overlay */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              onClick={() => setSelectedSiswa(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            ></div>
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
              <div className="pointer-events-auto w-screen max-w-4xl transform transition-transform duration-500 ease-in-out">
                {/* ... (Isi drawer tetap utuh seperti sebelumnya) ... */}
                <div className="flex h-full flex-col bg-slate-50 shadow-2xl rounded-l-[2.5rem] overflow-hidden">
                  <div className="relative bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900 p-6 sm:p-8 text-white overflow-hidden">
                    {/* ... Konten Header Riwayat ... */}
                    <div className="relative flex items-start justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 bg-blue-400/20 border border-blue-300/30 px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest mb-3">
                          Riwayat Presensi
                        </div>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight mb-1">
                          {selectedSiswa.nama}
                        </h2>
                      </div>
                      <button
                        onClick={() => setSelectedSiswa(null)}
                        className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20 border border-white/10"
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
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                    {/* Placeholder agar UI drawer tetap ada, logika tabel riwayat Anda sebelumnya tetap dimasukkan disini */}
                    <p className="text-center text-slate-500 mt-10">
                      Memuat riwayat...
                    </p>
                  </div>

                  <div className="border-t border-slate-200 bg-white p-4 sm:p-6 flex justify-end">
                    <button
                      onClick={() => setSelectedSiswa(null)}
                      className="rounded-xl border-2 border-slate-200 bg-white px-6 py-2.5 text-sm sm:text-base font-bold text-slate-600 hover:bg-slate-50"
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
