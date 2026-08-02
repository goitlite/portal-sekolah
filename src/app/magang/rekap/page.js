"use client";

import { useEffect, useState } from "react";
import {
  getRekapGuru,
  getRekapSemua,
  getRiwayatSiswa,
  getGuru,
} from "../lib/api";
import { getSession } from "../lib/auth";
import Image from "next/image";
import Link from "next/link";
import { toBlob } from "html-to-image";

const NamaBadge = ({ rawName }) => {
  if (!rawName) return null;

  const match = rawName.match(/(.+?)\s*\[(.*?)\]/);

  if (!match) {
    return <span>{rawName}</span>; // Warna mengikuti parent
  }

  const namaSiswa = match[1].trim();
  const kelas = match[2].trim();

  let badgeClasses = "bg-slate-100 border-slate-300 text-slate-700";
  if (kelas === "TJKT 1") {
    badgeClasses = "bg-emerald-50 border-emerald-400 text-emerald-700";
  } else if (kelas === "TJKT 2") {
    badgeClasses = "bg-violet-50 border-violet-400 text-violet-700";
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2">
      <span>{namaSiswa}</span>{" "}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 border rounded-md text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm ${badgeClasses}`}
      >
        {kelas}
      </span>
    </span>
  );
};

export default function RekapPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [bulan, setBulan] = useState("");
  const [mode, setMode] = useState("card");
  const [tempat, setTempat] = useState("Semua");
  const [sharingIndex, setSharingIndex] = useState(null);
  const [shareProgress, setShareProgress] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [riwayatSiswa, setRiwayatSiswa] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [guruDipilih, setGuruDipilih] = useState("");
  const [guruList, setGuruList] = useState([]);

  // Tambahan state untuk filter Nama dan Kelas
  const [filterNama, setFilterNama] = useState("");
  const [filterKelas, setFilterKelas] = useState("Semua");

  // Tambahan state untuk filter Bulan di Popup Riwayat Presensi
  const [selectedRiwayatBulan, setSelectedRiwayatBulan] = useState("Semua");

  // Menangkap request auto-select dari Dashboard Guru
  useEffect(() => {
    const autoSelectTempat = localStorage.getItem("targetTempatRekap");
    const autoSelectGuru = localStorage.getItem("targetGuruRekap");
    const autoSelectBulan = localStorage.getItem("targetBulanRekap");

    let hasAutoSelect = false;

    if (autoSelectGuru) {
      setGuruDipilih(autoSelectGuru);
      hasAutoSelect = true;
    }
    if (autoSelectTempat) {
      setTempat(autoSelectTempat);
      hasAutoSelect = true;
    }
    if (autoSelectBulan) {
      setBulan(autoSelectBulan);
      hasAutoSelect = true;
    }

    // Bersihkan memori agar jika halaman direfresh, filter tidak terkunci
    if (hasAutoSelect) {
      localStorage.removeItem("targetTempatRekap");
      localStorage.removeItem("targetGuruRekap");
      localStorage.removeItem("targetBulanRekap");
    }
  }, []);

  async function forceFreshMode() {
    if (guruDipilih) {
      load(false);
    } else {
      alert("Silakan pilih guru pembimbing terlebih dahulu");
    }
  }

  function getSafeFreshUrl(url) {
    if (!url) return "";
    return url.includes("?")
      ? `${url}&v=${Date.now()}`
      : `${url}?v=${Date.now()}`;
  }

  useEffect(() => {
    async function fetchGuru() {
      try {
        const res = await getGuru();
        let list = res.data || [];
        list.sort((a, b) => a.NAMA_GURU.localeCompare(b.NAMA_GURU));
        setGuruList(list);
      } catch (error) {
        console.error("Gagal load data guru", error);
      }
    }
    fetchGuru();
  }, []);

  useEffect(() => {
    if (!guruDipilih) {
      setData([]);
      setLoading(false);
      return;
    }
    load(false);
  }, [guruDipilih, bulan, tempat]);

  async function load(isRetry = false) {
    if (!isRetry) setLoading(true);

    try {
      const idGuruAman = guruDipilih || "";
      const hasil = await getRekapSemua(
        bulan,
        tempat === "Semua" ? "" : tempat,
        idGuruAman,
      );

      setData(hasil.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Fetch Rekap error:", error);
      if (!isRetry) {
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
      setSelectedRiwayatBulan("Semua"); // Reset filter bulan saat membuka siswa baru
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

  // Helper untuk mendapatkan Nama Bulan dan Tahun untuk filter
  function getBulanTahun(timestampStr) {
    if (!timestampStr) return "-";
    try {
      const datePart = timestampStr.split(" ")[0];
      const date = new Date(datePart);
      if (isNaN(date.getTime())) return "-";
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
      return `${bulanNames[date.getMonth()]} ${date.getFullYear()}`;
    } catch (e) {
      return "-";
    }
  }

  async function handleShareWACard(index, namaTempat) {
    setSharingIndex(index);
    setShareProgress("Menyiapkan elemen...");
    await new Promise((resolve) => setTimeout(resolve, 800));

    const cards = document.querySelectorAll(".rekap-card-wa");
    const card = cards[index];

    if (!card) {
      alert("Tidak ada data card yang ditemukan untuk dibagikan.");
      setSharingIndex(null);
      return;
    }

    setShareProgress("Memproses gambar...");

    try {
      const blob = await toBlob(card, {
        quality: 0.9,
        backgroundColor: "#f8fafc",
        pixelRatio: 2,
        cacheBust: true, // Membantu menghindari masalah cache gambar
      });

      if (!blob) throw new Error("Gagal menghasilkan gambar dari card.");

      const file = new File(
        [blob],
        `Rekap_Magang_${namaTempat.replace(/\s+/g, "_")}.jpg`,
        {
          type: "image/jpeg",
        },
      );

      setShareProgress("Membuka WhatsApp...");

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Rekap Presensi Magang - ${namaTempat}`,
          text: `Berikut adalah laporan rekap presensi siswa di ${namaTempat}.`,
          files: [file],
        });
      } else {
        alert("Perangkat tidak mendukung Share. Gambar akan didownload.");
        const url = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Gagal membagikan ke WhatsApp:", error);
      alert(
        "Terjadi kesalahan teknis saat memproses gambar. Pastikan gambar sudah ter-load.",
      );
    } finally {
      setSharingIndex(null);
      setShareProgress("");
    }
  }

  // Mendapatkan daftar kelas unik dari data siswa untuk opsi Filter Kelas
  const uniqueKelas = Array.from(
    new Set(
      data.flatMap((item) =>
        item.siswa
          .map((s) => {
            const match = s.nama.match(/\[(.*?)\]/);
            return match ? match[1].trim() : null;
          })
          .filter(Boolean),
      ),
    ),
  ).sort();

  // Memfilter data berdasarkan filter Guru, Nama, dan Kelas
  const filteredDataToRender = data
    .map((item) => {
      const filteredSiswa = item.siswa.filter((s) => {
        // Filter Pencarian Nama
        const matchName = s.nama
          .toLowerCase()
          .includes(filterNama.toLowerCase());

        // Filter Kelas
        const matchClass = s.nama.match(/\[(.*?)\]/);
        const siswaKelas = matchClass ? matchClass[1].trim() : "";
        const matchKelas =
          filterKelas === "Semua" || siswaKelas === filterKelas;

        return matchName && matchKelas;
      });
      return { ...item, siswa: filteredSiswa };
    })
    .filter((item) => item.siswa.length > 0) // Sembunyikan lokasi magang jika siswanya 0 setelah difilter
    .filter((item) => (tempat === "Semua" ? true : item.tempat === tempat))
    .sort((a, b) => a.tempat.localeCompare(b.tempat));

  // Mendapatkan daftar bulan unik dari data riwayat yang sedang dibuka
  const uniqueBulanRiwayat = Array.from(
    new Set(
      riwayatSiswa
        .map((r) => getBulanTahun(r.TIMESTAMP))
        .filter((b) => b !== "-"),
    ),
  );

  // Memfilter data riwayat berdasarkan filter bulan pada popup
  const filteredRiwayatSiswa =
    selectedRiwayatBulan === "Semua"
      ? riwayatSiswa
      : riwayatSiswa.filter(
          (r) => getBulanTahun(r.TIMESTAMP) === selectedRiwayatBulan,
        );

  return (
    <>
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
          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 bg-gradient-to-br from-[#FFFDF8] via-[#FCE7A4] to-[#F3D36B] p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-[0_12px_35px_rgba(212,175,55,0.22)] border border-[#D9B44A] mb-6 sm:mb-10">
            <div className="flex-1 w-full sm:min-w-[200px]">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">
                Guru Pembimbing
              </label>
              <select
                className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3.5 text-sm sm:text-base font-semibold text-slate-700 outline-none focus:border-blue-500"
                value={guruDipilih}
                onChange={(e) => {
                  setGuruDipilih(e.target.value);
                }}
              >
                <option value="">-- Pilih Guru Pembimbing --</option>
                {guruList.map((g, i) => {
                  const finalId =
                    g.id ||
                    g.ID ||
                    g.ID_GURU ||
                    g.id_guru ||
                    g.idGuru ||
                    g.NAMA_GURU ||
                    g.nama ||
                    "";
                  const finalNama =
                    g.NAMA || g.nama || g.NAMA_GURU || g.nama_guru || "Guru";
                  return (
                    <option key={i} value={finalId}>
                      {finalNama}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex-1 w-full sm:min-w-[150px]">
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

            <div className="flex-1 w-full sm:min-w-[150px]">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">
                Lokasi Magang
              </label>
              <select
                className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3.5 text-sm sm:text-base font-semibold text-slate-700 outline-none focus:border-blue-500"
                value={tempat}
                onChange={(e) => setTempat(e.target.value)}
              >
                <option value="Semua">Semua Tempat</option>
                {data
                  .sort((a, b) => a.tempat.localeCompare(b.tempat))
                  .map((x) => (
                    <option key={x.tempat} value={x.tempat}>
                      {x.tempat}
                    </option>
                  ))}
              </select>
            </div>

            {/* Filter Baru: Cari Nama */}
            <div className="flex-1 w-full sm:min-w-[150px]">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">
                Cari Siswa
              </label>
              <input
                type="text"
                placeholder="Ketik nama..."
                className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3.5 text-sm sm:text-base font-semibold text-slate-700 outline-none focus:border-blue-500"
                value={filterNama}
                onChange={(e) => setFilterNama(e.target.value)}
              />
            </div>

            {/* Filter Baru: Filter Kelas Otomatis */}
            <div className="flex-1 w-full sm:min-w-[150px]">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">
                Kelas
              </label>
              <select
                className="w-full rounded-lg sm:rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3.5 text-sm sm:text-base font-semibold text-slate-700 outline-none focus:border-blue-500"
                value={filterKelas}
                onChange={(e) => setFilterKelas(e.target.value)}
              >
                <option value="Semua">Semua Kelas</option>
                {uniqueKelas.map((k) => (
                  <option key={k} value={k}>
                    {k}
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
          ) : !guruDipilih ? (
            <div className="mt-20 flex flex-col items-center justify-center text-slate-400 bg-white p-8 sm:p-12 rounded-3xl border border-dashed border-slate-300 max-w-2xl mx-auto shadow-sm transition-all">
              <span className="text-6xl mb-4 opacity-80">👨‍🏫</span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-700 mb-2 text-center tracking-tight">
                Pilih Guru Pembimbing
              </h3>
              <p className="text-center font-medium text-sm sm:text-base max-w-md text-slate-500 leading-relaxed">
                Silakan pilih{" "}
                <span className="font-bold text-blue-600">Guru Pembimbing</span>{" "}
                di filter atas terlebih dahulu untuk melihat data rekap presensi
                siswa.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
              {filteredDataToRender.map((item, index) => (
                <div
                  key={index}
                  className="rekap-card-wa overflow-hidden rounded-[1.5rem] sm:rounded-[2.5rem] bg-gradient-to-br from-yellow-50 via-amber-100 to-yellow-200 shadow-[0_10px_35px_rgba(180,140,20,0.18)] border border-yellow-300 flex flex-col transition-all duration-300"
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
                        Belum ada foto Pembimbing Monitoring
                      </span>
                    </div>
                  )}

                  <div className="p-4 sm:p-7">
                    <div className="flex flex-row items-start justify-between gap-2 sm:gap-4 border-b border-blue-200/60 pb-3 sm:pb-4">
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

                        <button
                          onClick={() => handleShareWACard(index, item.tempat)}
                          disabled={sharingIndex === index}
                          title="Bagikan Laporan"
                          className="mt-1.5 sm:mt-2 p-1.5 sm:p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-sm transition-all focus:outline-none flex items-center justify-center active:scale-95"
                        >
                          {sharingIndex === index ? (
                            <div className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          ) : (
                            <svg
                              className="w-3.5 h-3.5 sm:w-4 sm:h-4"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 sm:mt-5 w-full rounded-xl sm:rounded-2xl border border-white bg-white/70 backdrop-blur-sm p-1.5 sm:p-3 shadow-inner">
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
                          {[...item.siswa]
                            .sort((a, b) => a.nama.localeCompare(b.nama))
                            .map((s, i) => (
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
                                <td className="py-1.5 sm:py-3 px-1 sm:px-3 font-semibold text-[10px] sm:text-sm leading-tight whitespace-normal break-words">
                                  <NamaBadge rawName={s.nama} />
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

      {selectedSiswa && (
        <div
          className="fixed inset-0 z-50 overflow-hidden"
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 overflow-hidden">
            <div
              onClick={() => setSelectedSiswa(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            ></div>

            <div className="pointer-events-none fixed inset-y-0 right-0 flex w-full sm:max-w-5xl sm:pl-16">
              <div className="pointer-events-auto w-full transform transition-transform duration-300 ease-in-out">
                <div className="flex h-full flex-col bg-slate-50 shadow-2xl sm:rounded-l-2xl overflow-hidden border-l border-white/20">
                  {/* HEADER BIRU (SUPER PADAT) */}
                  <div className="relative bg-gradient-to-br from-blue-700 via-indigo-800 to-blue-900 p-3 sm:p-4 text-white overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-white opacity-5 rounded-full blur-2xl"></div>
                    <div className="relative flex items-start justify-between">
                      <div>
                        <div className="inline-flex items-center gap-1.5 bg-blue-400/20 border border-blue-300/30 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-wider backdrop-blur-md mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-300"></span>
                          Riwayat Presensi
                        </div>
                        <h2 className="text-base sm:text-xl font-black tracking-tight leading-none">
                          <NamaBadge rawName={selectedSiswa.nama} />
                        </h2>
                      </div>
                      <button
                        onClick={() => setSelectedSiswa(null)}
                        className="rounded hover:bg-white/20 p-1 text-white border border-transparent hover:border-white/10 transition-all ml-2"
                      >
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
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

                    <div className="relative mt-2 sm:mt-3 grid grid-cols-3 gap-2 sm:gap-4 border-t border-white/10 pt-2 sm:pt-3">
                      <div>
                        <p className="text-blue-200/80 text-[8px] sm:text-[9px] uppercase tracking-wider font-bold mb-0.5">
                          Pembimbing
                        </p>
                        <p className="font-bold text-[10px] sm:text-xs flex items-center gap-1 truncate">
                          👨‍🏫 {selectedSiswa.guru}
                        </p>
                      </div>

                      {/* FILTER BULAN DI TENGAH */}
                      <div className="flex flex-col items-center justify-center border-x border-white/10 px-1 sm:px-2">
                        <p className="text-blue-200/80 text-[8px] sm:text-[9px] uppercase tracking-wider font-bold mb-0.5 text-center w-full">
                          Filter Bulan
                        </p>
                        <select
                          value={selectedRiwayatBulan}
                          onChange={(e) =>
                            setSelectedRiwayatBulan(e.target.value)
                          }
                          className="w-full max-w-[120px] bg-white/10 border border-white/20 text-white text-[9px] sm:text-[10px] font-bold rounded px-1 py-0.5 sm:py-1 outline-none focus:border-white transition-colors cursor-pointer text-center appearance-none"
                          style={{ textAlignLast: "center" }}
                        >
                          <option value="Semua" className="text-slate-800">
                            Semua Bulan
                          </option>
                          {uniqueBulanRiwayat.map((b, idx) => (
                            <option
                              key={idx}
                              value={b}
                              className="text-slate-800"
                            >
                              {b}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-right">
                        <p className="text-blue-200/80 text-[8px] sm:text-[9px] uppercase tracking-wider font-bold mb-0.5">
                          Lokasi Magang
                        </p>
                        <p className="font-bold text-[10px] sm:text-xs flex items-center justify-end gap-1 truncate">
                          📍 {selectedSiswa.tempat}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* MAIN CONTENT AREA */}
                  <div className="flex-1 overflow-y-auto p-2 sm:p-4">
                    {riwayatLoading ? (
                      <div className="flex h-32 flex-col items-center justify-center text-slate-500">
                        <div className="relative h-8 w-8 mb-2">
                          <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
                          <div className="absolute inset-0 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
                        </div>
                        <p className="font-bold text-xs">Menyinkronkan...</p>
                      </div>
                    ) : riwayatSiswa.length === 0 ? (
                      <div className="flex h-32 flex-col items-center justify-center text-slate-400 bg-white rounded-lg border border-dashed border-slate-300">
                        <p className="text-sm font-black text-slate-700">
                          Belum Ada Data
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 sm:space-y-4">
                        {/* KOTAK REKAPITULASI (MENGGUNAKAN DATA FILTER) */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-0.5 bg-emerald-500"></div>
                            <span className="text-xl sm:text-2xl font-black text-emerald-600 leading-none">
                              {
                                filteredRiwayatSiswa.filter(
                                  (r) => r.STATUS === "Hadir",
                                ).length
                              }
                            </span>
                            <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase mt-1">
                              Hadir
                            </p>
                          </div>
                          <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-0.5 bg-amber-500"></div>
                            <span className="text-xl sm:text-2xl font-black text-amber-500 leading-none">
                              {
                                filteredRiwayatSiswa.filter(
                                  (r) => r.STATUS === "Izin",
                                ).length
                              }
                            </span>
                            <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase mt-1">
                              Izin
                            </p>
                          </div>
                          <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-100 flex flex-col items-center justify-center relative overflow-hidden">
                            <div className="absolute top-0 w-full h-0.5 bg-blue-500"></div>
                            <span className="text-xl sm:text-2xl font-black text-blue-500 leading-none">
                              {
                                filteredRiwayatSiswa.filter(
                                  (r) => r.STATUS === "Sakit",
                                ).length
                              }
                            </span>
                            <p className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase mt-1">
                              Sakit
                            </p>
                          </div>
                        </div>

                        {/* TABEL DATA (MENGGUNAKAN DATA FILTER) */}
                        <div className="rounded-lg border border-slate-200 bg-white w-full overflow-hidden">
                          <div className="overflow-x-auto w-full">
                            <table className="min-w-max w-full divide-y divide-slate-200 text-left">
                              <thead className="bg-slate-50">
                                <tr>
                                  <th className="px-2 py-1.5 text-center text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
                                    No
                                  </th>
                                  <th className="px-2 py-1.5 text-left text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
                                    Tanggal
                                  </th>
                                  <th className="px-2 py-1.5 text-center text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
                                    Status
                                  </th>
                                  <th className="px-2 py-1.5 text-center text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
                                    Lampiran
                                  </th>
                                  <th className="px-2 py-1.5 text-left text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
                                    Pembimbing Lapangan
                                  </th>
                                  <th className="px-2 py-1.5 text-left text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase">
                                    Kompetensi & Keterangan
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {filteredRiwayatSiswa.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan="6"
                                      className="py-8 text-center text-slate-400 font-bold text-xs sm:text-sm bg-white"
                                    >
                                      Tidak ada data di bulan ini
                                    </td>
                                  </tr>
                                ) : (
                                  filteredRiwayatSiswa.map((r, i) => {
                                    const { hari, tanggal } = getHariDanTanggal(
                                      r.TIMESTAMP,
                                    );
                                    const status = r.STATUS || "-";
                                    const fotoUrl = r.FOTO;
                                    const mapUrl = r.MAP;

                                    return (
                                      <tr
                                        key={i}
                                        className="hover:bg-slate-50 transition-colors"
                                      >
                                        <td className="px-2 py-1 sm:py-1.5 text-center font-bold text-slate-400 text-[10px] sm:text-xs">
                                          {i + 1}
                                        </td>
                                        <td className="px-2 py-1 sm:py-1.5 whitespace-nowrap">
                                          <p className="font-bold text-slate-800 text-[10px] sm:text-xs leading-none">
                                            {tanggal}
                                          </p>
                                          <p className="text-[8px] sm:text-[9px] text-slate-500 font-semibold uppercase mt-0.5 leading-none">
                                            {hari}
                                          </p>
                                        </td>
                                        <td className="px-2 py-1 sm:py-1.5 text-center whitespace-nowrap">
                                          <span
                                            className={`inline-flex rounded px-1.5 py-0.5 text-[8px] sm:text-[9px] font-bold uppercase border ${
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
                                        <td className="px-2 py-1 sm:py-1.5 text-center">
                                          <div className="flex items-center justify-center gap-1">
                                            {fotoUrl ? (
                                              <a
                                                href={getSafeFreshUrl(fotoUrl)}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors border border-blue-100"
                                              >
                                                <span className="text-[9px] sm:text-[10px]">
                                                  📸
                                                </span>
                                              </a>
                                            ) : (
                                              <span className="h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center text-slate-300 text-[9px]">
                                                -
                                              </span>
                                            )}
                                            {mapUrl && (
                                              <a
                                                href={mapUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white transition-colors border border-rose-100"
                                              >
                                                <span className="text-[9px] sm:text-[10px]">
                                                  📍
                                                </span>
                                              </a>
                                            )}
                                          </div>
                                        </td>
                                        <td
                                          className="px-2 py-1 sm:py-1.5 max-w-[100px] sm:max-w-[120px] truncate font-semibold text-slate-700 text-[9px] sm:text-[11px]"
                                          title={r.PEMBIMBING_LAPANGAN || "-"}
                                        >
                                          {r.PEMBIMBING_LAPANGAN || "-"}
                                        </td>
                                        <td className="px-2 py-1 sm:py-1.5">
                                          <p
                                            className="max-w-[120px] sm:max-w-[200px] truncate font-bold text-slate-800 text-[9px] sm:text-[11px] leading-tight"
                                            title={
                                              r.KOMPETENSI_YANG_DIKUASAI || "-"
                                            }
                                          >
                                            {r.KOMPETENSI_YANG_DIKUASAI || "-"}
                                          </p>
                                          {r.KETERANGAN && (
                                            <p
                                              className="max-w-[120px] sm:max-w-[200px] truncate text-[8px] sm:text-[9px] text-slate-500 leading-tight mt-0.5"
                                              title={r.KETERANGAN}
                                            >
                                              {r.KETERANGAN}
                                            </p>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* FOOTER (TUTUP) */}
                  <div className="border-t border-slate-200 bg-white p-2 flex justify-end shrink-0">
                    <button
                      onClick={() => setSelectedSiswa(null)}
                      className="w-full sm:w-auto rounded-md border border-slate-300 bg-slate-50 px-4 py-1.5 font-bold text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none text-[10px] sm:text-xs"
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
