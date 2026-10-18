"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { getPresensiWaliGrid, savePresensiWaliKelas } from "../lib/api";

const STATUS_OPTIONS = [
  {
    value: "Hadir",
    label: "Hadir",
    color: "bg-emerald-500 text-white border-emerald-600 ring-emerald-300",
  },
  {
    value: "Sakit",
    label: "Sakit",
    color: "bg-blue-600 text-white border-blue-700 ring-blue-300",
  },
  {
    value: "Izin",
    label: "Izin",
    color: "bg-amber-500 text-white border-amber-600 ring-amber-300",
  },
  {
    value: "Alfa",
    label: "Alfa",
    color: "bg-rose-500 text-white border-rose-600 ring-rose-300",
  },
  {
    value: "Cabut",
    label: "Cabut",
    color: "bg-violet-500 text-white border-violet-600 ring-violet-300",
  },
];

function formatTanggalIndo(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// Format waktu simpan terakhir dalam bahasa Indonesia
function formatLastSavedIndo(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const hari = d.toLocaleDateString("id-ID", { weekday: "long" });
    const tgl = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const jam = d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${hari}, ${tgl} • ${jam} WIB`;
  } catch (_) {
    return "";
  }
}

// Helper penyimpanan antrian presensi offline multi-hari (kunci berbeda dari barcode)
function getOfflineQueueReguler(waliId) {
  try {
    const raw = localStorage.getItem(`offline_presensi_reguler_${waliId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveOfflineQueueReguler(waliId, queue) {
  try {
    localStorage.setItem(
      `offline_presensi_reguler_${waliId}`,
      JSON.stringify(queue),
    );
  } catch (_) {}
}

async function runSerial(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i++) out.push(await fn(items[i], i));
  return out;
}

export default function ModalPresensiPetugasSiswa({
  isOpen,
  onClose,
  petugasInfo, // { idWali, idGuru, namaKelas, kelas }
  availableClasses = [],
  user, // { id, nama }
  onOpenScanner,
  onPresensiSubmitted,
}) {
  const [selectedWaliId, setSelectedWaliId] = useState(petugasInfo?.idWali);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!Array.isArray(availableClasses) || availableClasses.length <= 1) {
        setSelectedWaliId(petugasInfo?.idWali);
      } else if (!selectedWaliId && petugasInfo?.idWali) {
        setSelectedWaliId(petugasInfo.idWali);
      }
    }
  }, [isOpen, petugasInfo?.idWali, availableClasses]);

  const activeClass = useMemo(() => {
    const found = availableClasses.find(
      (c) => String(c.idWali) === String(selectedWaliId),
    );
    return found || petugasInfo;
  }, [selectedWaliId, availableClasses, petugasInfo]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [siswaList, setSiswaList] = useState([]);
  const [presensiMap, setPresensiMap] = useState({}); // { [idSiswa]: { status: "Hadir", keterangan: "" } }
  const [isSubmittedToday, setIsSubmittedToday] = useState(false);
  const [submittedData, setSubmittedData] = useState([]); // data tersimpan hari ini (read-only)
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [regulerCount, setRegulerCount] = useState(0);
  // Status simpan online terakhir dan antrian offline multi-hari
  const [lastOnlineSaveTime, setLastOnlineSaveTime] = useState("");
  const [pendingOfflineRecords, setPendingOfflineRecords] = useState([]);
  // Guard agar flush tidak jalan dua kali bersamaan
  const flushingRef = useRef(false);

  const todayISO = useMemo(() => {
    // Format YYYY-MM-DD lokal
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const todayFormatted = useMemo(() => {
    return formatTanggalIndo(new Date());
  }, []);

  useEffect(() => {
    if (isOpen && activeClass?.idWali && activeClass?.idGuru) {
      loadDataKelas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeClass?.idWali, activeClass?.idGuru]);

  async function loadDataKelas() {
    setLoading(true);
    setErrorMessage("");

    const waliId = activeClass?.idWali || petugasInfo?.idWali;
    const guruId = activeClass?.idGuru || petugasInfo?.idGuru;
    const storageKeySiswa = `cache_reguler_siswa_${waliId}`;

    // 1. Cek kuota pengisian reguler khusus hari ini (maksimal 2x sehari)
    const regulerKey = `presensi_reguler_count_${waliId}_${todayISO}`;
    let currentRegulerCount = 0;
    try {
      const saved = localStorage.getItem(regulerKey);
      if (saved !== null) {
        currentRegulerCount = parseInt(saved, 10) || 0;
      }
    } catch (_) {}
    setRegulerCount(currentRegulerCount);

    // 2. Muat waktu simpan online terakhir dan antrian offline
    try {
      const lastSaved = localStorage.getItem(`last_online_save_reguler_${waliId}`);
      if (lastSaved) setLastOnlineSaveTime(lastSaved);
    } catch (_) {}
    const offlineQueue = getOfflineQueueReguler(waliId);
    const pastRecords = offlineQueue.filter(
      (item) => item.tanggal && item.tanggal !== todayISO,
    );
    setPendingOfflineRecords(pastRecords);

    // 3. Coba muat dari cache lokal dulu (agar dapat tampil tanpa internet)
    let cachedSiswa = null;
    try {
      const raw = localStorage.getItem(storageKeySiswa);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          cachedSiswa = parsed;
        }
      }
    } catch (_) {}

    if ((!cachedSiswa || cachedSiswa.length === 0) && Array.isArray(activeClass?.daftarSiswa) && activeClass.daftarSiswa.length > 0) {
      cachedSiswa = activeClass.daftarSiswa.map((s) => ({
        idSiswa: String(s.idSiswa || s.id || "").trim(),
        nama: (s.nama || s.namaSiswa || "").trim(),
        kelas: s.kelas || activeClass.namaKelas || "",
      })).filter((s) => s.idSiswa);
    }

    try {
      const res = await getPresensiWaliGrid(guruId, waliId);

      if (!res.success) {
        // Jika server menolak (bukan masalah jaringan), lempar error
        if (!res.networkError) {
          throw new Error(res.message || "Gagal mengambil data kelas dari server.");
        }
        // Masalah jaringan → pakai cache
        throw new Error("network");
      }

      const rawSiswa = res.data?.siswa || [];
      const normalizedSiswa = rawSiswa
        .map((s) => ({
          idSiswa: String(s.idSiswa || s.id || "").trim(),
          nama: (s.nama || s.namaSiswa || "").trim(),
          kelas: s.kelas || "",
        }))
        .filter((s) => s.idSiswa)
        .sort((a, b) => a.nama.localeCompare(b.nama));

      // Simpan ke cache lokal untuk akses offline selanjutnya
      try {
        localStorage.setItem(storageKeySiswa, JSON.stringify(normalizedSiswa));
      } catch (_) {}

      setSiswaList(normalizedSiswa);

      // 4. Ambil data presensi yang sudah tersimpan di database hari ini (jika ada)
      const rawPresensi = res.data?.presensi || [];
      const todayRecords = rawPresensi.filter(
        (p) => String(p.tanggal).trim() === todayISO,
      );

      const mapExisting = {};
      todayRecords.forEach((p) => {
        mapExisting[String(p.idSiswa).trim()] = {
          status: p.status || "Hadir",
          keterangan: p.keterangan || "",
        };
      });

      // Data awal: gabungkan siswa dengan status yang sudah tersimpan di database
      const initialMap = {};
      normalizedSiswa.forEach((s) => {
        initialMap[s.idSiswa] = mapExisting[s.idSiswa] || {
          status: "Hadir",
          keterangan: "",
        };
      });

      setPresensiMap(initialMap);

      // KUNCI HANYA JIKA PENGISIAN REGULER SUDAH TERCAPAI 2 KALI!
      // Presensi barcode TIDAK BOLEH mengunci presensi reguler
      if (currentRegulerCount >= 2) {
        setIsSubmittedToday(true);
        setSubmittedData(initialMap);
      } else {
        setIsSubmittedToday(false);
      }
    } catch (err) {
      // Fallback: gunakan cache lokal jika ada (offline-first)
      if (cachedSiswa && cachedSiswa.length > 0) {
        setSiswaList(cachedSiswa);
        const initialMap = {};
        cachedSiswa.forEach((s) => {
          // Cek juga apakah ada data antrian offline hari ini
          const fromQueue = offlineQueue.find(
            (q) => q.idSiswa === s.idSiswa && q.tanggal === todayISO,
          );
          initialMap[s.idSiswa] = fromQueue
            ? { status: fromQueue.status, keterangan: fromQueue.keterangan || "" }
            : { status: "Hadir", keterangan: "" };
        });
        setPresensiMap(initialMap);
        if (currentRegulerCount >= 2) {
          setIsSubmittedToday(true);
          setSubmittedData(initialMap);
        } else {
          setIsSubmittedToday(false);
        }
        // Tampilkan error hanya jika bukan masalah jaringan biasa (offline)
        if (err.message !== "network") {
          setErrorMessage(
            `⚠️ Menggunakan data cache. ${err.message || "Periksa koneksi internet."}`,
          );
        }
      } else {
        console.error("Gagal memuat data presensi petugas:", err);
        setErrorMessage(
          err.message === "network"
            ? "Tidak ada koneksi internet dan belum ada data cache. Sambungkan ke internet lalu muat ulang."
            : err.message || "Terjadi kesalahan koneksi.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(idSiswa, status) {
    if (isSubmittedToday) return; // Terkunci
    setPresensiMap((prev) => ({
      ...prev,
      [idSiswa]: {
        ...(prev[idSiswa] || { keterangan: "" }),
        status,
      },
    }));
  }

  function handleKeteranganChange(idSiswa, keterangan) {
    if (isSubmittedToday) return; // Terkunci
    setPresensiMap((prev) => ({
      ...prev,
      [idSiswa]: {
        ...(prev[idSiswa] || { status: "Hadir" }),
        keterangan,
      },
    }));
  }

  function handleSetSemuaHadir() {
    if (isSubmittedToday) return;
    const resetMap = {};
    siswaList.forEach((s) => {
      resetMap[s.idSiswa] = {
        status: "Hadir",
        keterangan: "",
      };
    });
    setPresensiMap(resetMap);
  }

  // Ringkasan Counter
  const stats = useMemo(() => {
    const dataSource = isSubmittedToday ? submittedData : presensiMap;
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alfa = 0;
    let cabut = 0;

    siswaList.forEach((s) => {
      const item = dataSource[s.idSiswa];
      const st = item?.status || "Hadir";
      if (st === "Hadir") hadir++;
      else if (st === "Sakit") sakit++;
      else if (st === "Izin") izin++;
      else if (st === "Alfa") alfa++;
      else if (st === "Cabut") cabut++;
    });

    return { total: siswaList.length, hadir, sakit, izin, alfa, cabut };
  }, [siswaList, presensiMap, submittedData, isSubmittedToday]);

  // Filter Siswa untuk Pencarian
  const filteredSiswa = useMemo(() => {
    if (!searchQuery.trim()) return siswaList;
    const q = searchQuery.toLowerCase();
    return siswaList.filter((s) => s.nama.toLowerCase().includes(q));
  }, [siswaList, searchQuery]);

  async function handleSubmit() {
    if (isSubmittedToday || regulerCount >= 2) {
      alert(
        "⛔ Batas maksimal 2 kali pengisian presensi reguler hari ini telah terpenuhi.",
      );
      return;
    }

    if (siswaList.length === 0) {
      alert("Tidak ada data siswa yang dapat disimpan.");
      return;
    }

    const konfirmasiPesan =
      `📋 KONFIRMASI PENGIRIMAN PRESENSI REGULER\n\n` +
      `Kelas: ${petugasInfo.namaKelas}\n` +
      `Tanggal: ${todayFormatted}\n` +
      `Pengisian Ke: ${regulerCount + 1} dari 2 harian\n` +
      `Total Siswa: ${stats.total}\n` +
      `• Hadir: ${stats.hadir}\n` +
      `• Sakit: ${stats.sakit}\n` +
      `• Izin: ${stats.izin}\n` +
      `• Alfa: ${stats.alfa}\n` +
      `• Cabut: ${stats.cabut}\n\n` +
      `💡 KETENTUAN PENGISIAN:\n` +
      `Presensi reguler dapat diisi maksimal 2 kali sehari (tanpa terpengaruh oleh presensi barcode).\n\n` +
      `Apakah Anda yakin data ini sudah benar dan ingin mengirimkannya?`;

    if (!window.confirm(konfirmasiPesan)) return;

    setSaving(true);
    try {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      const waliId = petugasInfo?.idWali;

      // Susun cells dari presensiMap
      const todayCells = siswaList.map((s) => {
        const item = presensiMap[s.idSiswa] || {
          status: "Hadir",
          keterangan: "",
        };
        return {
          idSiswa: s.idSiswa,
          namaSiswa: s.nama,
          tanggal: todayISO,
          status: item.status || "Hadir",
          keterangan:
            item.keterangan ||
            (item.status !== "Hadir"
              ? `Petugas: ${user?.nama || "Siswa"}`
              : ""),
        };
      });

      // Gabungkan dengan antrian pending offline multi-hari
      const allCells = [...pendingOfflineRecords, ...todayCells];

      // Simpan ke antrian offline DULU sebelum kirim
      try {
        if (waliId) {
          const newQueue = allCells.map((c) => ({
            ...c,
            timestamp: c.timestamp || Date.now(),
          }));
          saveOfflineQueueReguler(waliId, newQueue);
          const newPending = newQueue.filter((c) => c.tanggal !== todayISO);
          setPendingOfflineRecords(newPending);
        }
      } catch (_) {}

      // Jika sedang offline → simpan saja, tidak kirim (kuota TIDAK dinaikkan)
      if (isOffline) {
        alert(
          "📱 Data presensi tersimpan di perangkat ini.\n\nData akan dikirim otomatis ke server saat koneksi internet kembali tersedia.",
        );
        return;
      }

      const guruId = activeClass?.idGuru || petugasInfo?.idGuru;
      const targetNamaKelas = activeClass?.namaKelas || petugasInfo?.namaKelas;

      // Kirim ke server
      let res;
      try {
        res = await savePresensiWaliKelas({
          idGuru: guruId,
          idWali: waliId,
          cells: allCells,
        });
      } catch (_) {
        res = { success: false, networkError: true };
      }

      if (res?.success) {
        // Bersihkan antrian offline hari ini
        if (waliId) {
          const q = getOfflineQueueReguler(waliId);
          const remaining = q.filter(
            (c) =>
              c.tanggal &&
              c.tanggal !== todayISO &&
              !allCells.some(
                (a) => a.idSiswa === c.idSiswa && a.tanggal === c.tanggal,
              ),
          );
          saveOfflineQueueReguler(waliId, remaining);
          setPendingOfflineRecords(remaining);
          const nowISO = new Date().toISOString();
          try {
            localStorage.setItem(`last_online_save_reguler_${waliId}`, nowISO);
          } catch (_) {}
          setLastOnlineSaveTime(nowISO);
        }

        // Update kuota presensi reguler (hanya saat server berhasil)
        const nextCount = regulerCount + 1;
        const regulerKey = `presensi_reguler_count_${waliId}_${todayISO}`;
        try {
          localStorage.setItem(regulerKey, String(nextCount));
        } catch (_) {}
        setRegulerCount(nextCount);

        if (nextCount >= 2) {
          setIsSubmittedToday(true);
          setSubmittedData({ ...presensiMap });
          alert(
            `✅ ALHAMDULILLAH! Presensi reguler ke-2 kelas ${targetNamaKelas} berhasil dikirim.\n\n` +
              `Batas 2 kali pengisian presensi reguler hari ini telah selesai. Terima kasih telah menjalankan tugas presensi hari ini.`,
          );
        } else {
          setIsSubmittedToday(false);
          alert(
            `✅ ALHAMDULILLAH! Presensi reguler ke-1 kelas ${targetNamaKelas} berhasil dikirim.\n\n` +
              `💡 Anda masih dapat mengisi presensi reguler 1 kali lagi untuk hari ini jika ada pembaruan.`,
          );
        }

        if (typeof onPresensiSubmitted === "function") {
          onPresensiSubmitted();
        }
      } else if (!res || res.networkError) {
        // Jaringan terputus saat kirim → data sudah aman di antrian offline
        alert(
          "📱 Koneksi internet tidak tersedia saat pengiriman.\n\nData presensi tersimpan aman di perangkat dan akan dikirim otomatis saat online.",
        );
      } else {
        // Server menolak (bukan masalah jaringan)
        alert(
          `❌ Server menolak pengiriman: ${res.message || "Gagal menyimpan presensi."}`,
        );
      }
    } catch (err) {
      console.error("Gagal mengirim presensi:", err);
      alert(
        "❌ Terjadi kesalahan tidak terduga: " +
          (err.message || "Silakan coba lagi."),
      );
    } finally {
      setSaving(false);
    }
  }

  // AUTO-FLUSH: Kirim antrian offline reguler ke server saat ada koneksi
  async function flushOfflineQueueReguler() {
    if (flushingRef.current) return;
    const wIdsToFlush = new Set();
    if (petugasInfo?.idWali) wIdsToFlush.add(petugasInfo.idWali);
    if (Array.isArray(availableClasses)) {
      availableClasses.forEach((c) => {
        if (c.idWali) wIdsToFlush.add(c.idWali);
      });
    }

    flushingRef.current = true;
    try {
      await runSerial([...wIdsToFlush], async (wId) => {
        const q = getOfflineQueueReguler(wId);
        if (q.length === 0) return;
        const targetGuru =
          availableClasses.find((c) => String(c.idWali) === String(wId))?.idGuru ||
          petugasInfo?.idGuru;
        if (!targetGuru) return;

        try {
          const res = await savePresensiWaliKelas({
            idGuru: targetGuru,
            idWali: wId,
            cells: q,
          });
          if (res?.success) {
            const sKey = (c) =>
              `${String(c.idSiswa).trim()}|${String(c.tanggal).trim()}|${String(c.status).trim()}`;
            const sentKeys = new Set(q.map(sKey));
            const remaining = getOfflineQueueReguler(wId).filter(
              (c) => !sentKeys.has(sKey(c)),
            );
            saveOfflineQueueReguler(wId, remaining);

            const nowISO = new Date().toISOString();
            try {
              localStorage.setItem(`last_online_save_reguler_${wId}`, nowISO);
            } catch (_) {}
            if (String(wId) === String(activeClass?.idWali)) {
              setPendingOfflineRecords(remaining);
              setLastOnlineSaveTime(nowISO);
            }
          }
        } catch (_) {}
      });
    } finally {
      flushingRef.current = false;
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const t0 = setTimeout(flushOfflineQueueReguler, 1500);
    window.addEventListener("online", flushOfflineQueueReguler);
    const iv = setInterval(flushOfflineQueueReguler, 60000);
    return () => {
      clearTimeout(t0);
      clearInterval(iv);
      window.removeEventListener("online", flushOfflineQueueReguler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeClass?.idWali, activeClass?.idGuru, todayISO]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex h-[94vh] sm:h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        {/* ============================================================ */}
        {/* HEADER MODAL */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-4 sm:px-6 py-4 text-white shadow-md relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-xl sm:text-2xl shadow-md shrink-0 border border-white/30">
                ⭐
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                    Presensi Kelas Harian
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/25 border border-amber-300/40 text-amber-200 text-[10px] font-black uppercase tracking-wider">
                    Petugas Siswa
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {Array.isArray(availableClasses) && availableClasses.length > 1 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowClassDropdown((v) => !v)}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-teal-400/25 hover:bg-teal-400/40 text-teal-100 font-black border border-teal-300/40 transition-all cursor-pointer shadow-2xs active:scale-95"
                        title="Pilih Kelas yang Ingin Diabsen"
                      >
                        <span>🏫 {activeClass?.namaKelas || petugasInfo?.namaKelas || "Kelas Wali"}</span>
                        <span className="text-[8px] opacity-75">▾</span>
                      </button>

                      {showClassDropdown && (
                        <>
                          <div
                            className="fixed inset-0 z-30"
                            onClick={() => setShowClassDropdown(false)}
                          />
                          <div className="absolute left-0 top-full mt-1.5 w-64 sm:w-72 max-h-80 overflow-y-auto bg-slate-900 border border-teal-500/40 rounded-xl shadow-2xl p-1.5 z-40 text-white text-xs divide-y divide-slate-800 animate-in fade-in zoom-in-95 duration-100">
                            <div className="p-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                                Pilih Kelas Reguler
                              </p>
                              {/* Kelas Asal Petugas */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedWaliId(petugasInfo?.idWali);
                                  setShowClassDropdown(false);
                                }}
                                className={`w-full text-left px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                  String(selectedWaliId) === String(petugasInfo?.idWali)
                                    ? "bg-emerald-600 text-white"
                                    : "hover:bg-slate-800 text-slate-200"
                                }`}
                              >
                                <div className="truncate">
                                  <span className="mr-1.5">📌</span>
                                  <span>{petugasInfo?.namaKelas || "Kelas Petugas"}</span>
                                  <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-200 border border-amber-300/30">
                                    Kelas Anda
                                  </span>
                                </div>
                                {String(selectedWaliId) === String(petugasInfo?.idWali) && <span>✓</span>}
                              </button>

                              {/* Kelas Lainnya */}
                              {availableClasses
                                .filter((c) => String(c.idWali) !== String(petugasInfo?.idWali))
                                .map((c) => {
                                  const isSelected = String(selectedWaliId) === String(c.idWali);
                                  return (
                                    <button
                                      key={c.idWali}
                                      type="button"
                                      onClick={() => {
                                        setSelectedWaliId(c.idWali);
                                        setShowClassDropdown(false);
                                      }}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer mt-0.5 ${
                                        isSelected
                                          ? "bg-teal-600 text-white font-bold"
                                          : "hover:bg-slate-800 text-slate-300"
                                      }`}
                                    >
                                      <div className="truncate">
                                        <span className="mr-1.5">🏫</span>
                                        <span>{c.namaKelas}</span>
                                        {c.namaGuru && (
                                          <span className="text-[10px] text-slate-400 block truncate ml-5">
                                            {c.namaGuru}
                                          </span>
                                        )}
                                      </div>
                                      {isSelected && <span className="font-bold">✓</span>}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-teal-400/25 text-teal-100 font-black border border-teal-300/40 shadow-2xs"
                      title={`Khusus Kelas ${activeClass?.namaKelas || petugasInfo?.namaKelas || ""}`}
                    >
                      <span>🏫 {activeClass?.namaKelas || petugasInfo?.namaKelas || "Kelas Wali"}</span>
                    </span>
                  )}
                  <span>•</span>
                  <span className="text-xs text-teal-100 font-medium">📅 {todayFormatted}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-full bg-white/10 hover:bg-white/20 active:scale-95 w-9 h-9 flex items-center justify-center text-sm font-black transition-all border border-white/20 shrink-0"
              title="Tutup"
            >
              ✕
            </button>
          </div>

          {/* Banner Status Pengisian Reguler (Maksimal 2x Sehari) */}
          {isSubmittedToday ? (
            <div className="mt-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-3.5 py-2 flex items-center gap-2 text-emerald-100 text-xs font-semibold">
              <span className="text-base">🔒</span>
              <span>
                Presensi reguler kelas untuk hari ini (<b>{todayFormatted}</b>)
                telah dikirim <b>2 kali (2/2 selesai)</b> dan kini{" "}
                <b>terkunci</b>. Hanya Guru Wali Kelas yang berwenang melakukan
                perubahan lebih lanjut.
              </span>
            </div>
          ) : regulerCount === 1 ? (
            <div className="mt-3 rounded-xl bg-amber-400/20 border border-amber-300/40 px-3.5 py-2 flex items-center gap-2 text-amber-100 text-xs font-semibold">
              <span className="text-base">ℹ️</span>
              <span>
                Pengisian Reguler Ke-2 (<b>1 dari 2 telah dikirim</b>). Anda
                masih dapat memperbarui data dan mengirimkan presensi reguler 1
                kali lagi untuk hari ini.
              </span>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-teal-400/20 border border-teal-300/30 px-3.5 py-2 flex items-center justify-between gap-2 text-teal-100 text-xs font-medium">
              <div className="flex items-center gap-2">
                <span>📋</span>
                <span>
                  Presensi reguler dapat diisi maksimal <b>2 kali sehari</b>{" "}
                  (tanpa terpengaruh oleh presensi barcode).
                </span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/20 font-mono font-bold shrink-0">
                0 / 2 Terisi
              </span>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* STATS COUNTER BAR & SEARCH */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 space-y-2.5">
          {/* Quick Counter Badges */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div className="rounded-xl bg-white p-2 text-center border border-slate-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-slate-400">
                Total
              </span>
              <span className="text-sm sm:text-base font-black text-slate-800">
                {stats.total}
              </span>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 text-center border border-emerald-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-emerald-700">
                Hadir
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-800">
                {stats.hadir}
              </span>
            </div>
            <div className="rounded-xl bg-blue-50 p-2 text-center border border-blue-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-blue-700">
                Sakit
              </span>
              <span className="text-sm sm:text-base font-black text-blue-800">
                {stats.sakit}
              </span>
            </div>
            <div className="rounded-xl bg-amber-50 p-2 text-center border border-amber-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-amber-700">
                Izin
              </span>
              <span className="text-sm sm:text-base font-black text-amber-800">
                {stats.izin}
              </span>
            </div>
            <div className="rounded-xl bg-rose-50 p-2 text-center border border-rose-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-rose-700">
                Alfa
              </span>
              <span className="text-sm sm:text-base font-black text-rose-800">
                {stats.alfa}
              </span>
            </div>
            <div className="rounded-xl bg-violet-50 p-2 text-center border border-violet-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-violet-700">
                Cabut
              </span>
              <span className="text-sm sm:text-base font-black text-violet-800">
                {stats.cabut}
              </span>
            </div>
          </div>

          {/* Search Bar & Reset Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa..."
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
              />
            </div>

            {!isSubmittedToday && (
              <div className="flex items-center gap-2 shrink-0">
                {typeof onOpenScanner === "function" && (
                  <button
                    type="button"
                    onClick={onOpenScanner}
                    className="rounded-xl border border-teal-500 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white px-3.5 py-2 text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-2xs cursor-pointer"
                  >
                    <span>📷</span>
                    <span>Buka Mode Scan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleSetSemuaHadir}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3.5 py-2 text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
                >
                  <span>✨</span>
                  <span>Reset Semua Hadir</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* TABEL / DAFTAR SISWA */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/70">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                Memuat daftar siswa kelas {petugasInfo?.namaKelas}...
              </p>
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3 max-w-md mx-auto my-8">
              <span className="text-3xl">⚠️</span>
              <p className="text-xs sm:text-sm font-black text-rose-800">
                {errorMessage}
              </p>
              <button
                onClick={loadDataKelas}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                Coba Muat Ulang
              </button>
            </div>
          ) : filteredSiswa.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 max-w-md mx-auto my-8 space-y-2">
              <span className="text-3xl">🔍</span>
              <p className="text-xs sm:text-sm font-bold">
                {searchQuery
                  ? `Tidak ada siswa dengan nama "${searchQuery}".`
                  : "Belum ada siswa yang terdaftar di kelas ini."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSiswa.map((siswa, idx) => {
                const currentStatus = isSubmittedToday
                  ? submittedData[siswa.idSiswa]?.status || "Hadir"
                  : presensiMap[siswa.idSiswa]?.status || "Hadir";
                const currentKet = isSubmittedToday
                  ? submittedData[siswa.idSiswa]?.keterangan || ""
                  : presensiMap[siswa.idSiswa]?.keterangan || "";

                return (
                  <div
                    key={siswa.idSiswa}
                    className={`rounded-2xl bg-white p-3 sm:p-4 border transition-all ${
                      currentStatus !== "Hadir"
                        ? "border-amber-300 shadow-sm bg-amber-50/20"
                        : "border-slate-200/80 shadow-xs hover:border-teal-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Nama & Nomor Urut */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black text-slate-800 truncate">
                            {siswa.nama}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            ID: {siswa.idSiswa}{" "}
                            {siswa.kelas ? `• ${siswa.kelas}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Kontrol Status Presensi */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {isSubmittedToday ? (
                          // Tampilan Terkunci (Read-Only Badge)
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-xl text-xs font-black border shadow-xs ${
                                STATUS_OPTIONS.find(
                                  (opt) => opt.value === currentStatus,
                                )?.color ||
                                "bg-emerald-500 text-white border-emerald-600"
                              }`}
                            >
                              {currentStatus}
                            </span>
                            {currentKet && (
                              <span className="text-[11px] text-slate-500 italic max-w-[160px] truncate">
                                ({currentKet})
                              </span>
                            )}
                          </div>
                        ) : (
                          // Dropdown / Button Selector Status
                          <div className="flex flex-wrap items-center gap-1">
                            {STATUS_OPTIONS.map((opt) => {
                              const isSelected = currentStatus === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(siswa.idSiswa, opt.value)
                                  }
                                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black border transition-all active:scale-95 ${
                                    isSelected
                                      ? `${opt.color} shadow-sm ring-2`
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Input Opsional Keterangan (hanya muncul jika bukan hadir dan belum submitted) */}
                    {!isSubmittedToday && currentStatus !== "Hadir" && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                          Ket:
                        </span>
                        <input
                          type="text"
                          value={currentKet}
                          onChange={(e) =>
                            handleKeteranganChange(
                              siswa.idSiswa,
                              e.target.value,
                            )
                          }
                          placeholder={`Keterangan ${currentStatus.toLowerCase()} (opsional)...`}
                          className="flex-1 px-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50/50 font-medium text-slate-800 outline-none focus:border-teal-500 focus:bg-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* FOOTER MODAL */}
        {/* ============================================================ */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 py-3.5 flex flex-col gap-2">
          {/* Indikator status simpan offline */}
          {(pendingOfflineRecords.length > 0 || lastOnlineSaveTime) && (
            <div className="flex items-center justify-between gap-2 text-[10px]">
              {pendingOfflineRecords.length > 0 ? (
                <span className="flex items-center gap-1 text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  <span>📱</span>
                  <span>{pendingOfflineRecords.length} data hari lalu belum terkirim</span>
                </span>
              ) : (
                <span />
              )}
              {lastOnlineSaveTime && (
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <span>☁️</span>
                  <span className="truncate max-w-[200px]">{formatLastSavedIndo(lastOnlineSaveTime)}</span>
                </span>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
              {isSubmittedToday ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <span>✅</span> Data presensi hari ini telah terekam secara
                  permanen.
                </span>
              ) : (
                <span>
                  Default presensi adalah <b>Hadir semua</b>. Ubah status siswa
                  yang tidak hadir lalu tekan tombol simpan.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 sm:flex-initial rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 text-xs font-bold transition-all text-center"
              >
                {isSubmittedToday ? "Tutup" : "Batal"}
              </button>

              {!isSubmittedToday && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving || loading || siswaList.length === 0}
                  className="flex-1 sm:flex-initial rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:brightness-110 active:scale-95 text-white px-6 py-2.5 text-xs font-black shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>Mengirim Presensi...</span>
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      <span>
                        {regulerCount === 1
                          ? "Kirim Presensi Reguler Ke-2 (2/2)"
                          : "Kirim Presensi Reguler Ke-1 (1/2)"}
                      </span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
