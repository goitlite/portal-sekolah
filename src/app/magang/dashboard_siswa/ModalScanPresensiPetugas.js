"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { getPresensiWaliGrid, savePresensiWaliKelas } from "../lib/api";

// Web Audio API beep nada tinggi bersih (tanpa perlu file eksternal)
function playBeepSuccess() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
}

// Helper cek apakah waktu lokal saat ini sudah melewati batas jam 08:30 WIB
function checkIsPastTimeLimit() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  // Batas 08:30 WIB: jika jam > 8 ATAU (jam == 8 dan menit >= 30)
  return hours > 23 || (hours === 23 && minutes >= 30);
}

// In-memory cache internal modul agar scanner start instan saat modal dibuka kembali
const MEMORY_SISWA_CACHE = {}; // { [idWali]: siswaList }

export default function ModalScanPresensiPetugas({
  isOpen,
  onClose,
  petugasInfo, // { idWali, idGuru, namaKelas, kelas }
  user, // { id, nama }
  onPresensiSubmitted,
}) {
  const [loadingData, setLoadingData] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const [siswaList, setSiswaList] = useState([]);

  // Data hasil scan: { [idSiswa]: { status: "Hadir", waktuScan: "07:15:23", timestamp: 177... } }
  // Aturan First-Scan Wins: jika sudah ada, tidak akan ditimpa!
  const [scannedMap, setScannedMap] = useState({});

  // Status manual untuk siswa yang berhalangan (Sakit, Izin, Alfa, Cabut)
  const [manualStatusMap, setManualStatusMap] = useState({});
  const [manualKetMap, setManualKetMap] = useState({});

  // Notifikasi real-time terakhir saat scan
  const [lastScanNotice, setLastScanNotice] = useState(null);

  // Status pengiriman presensi & pembatasan jam
  const [saving, setSaving] = useState(false);
  const [isLockedByTime, setIsLockedByTime] = useState(false);
  const [isSubmittedToday, setIsSubmittedToday] = useState(false);
  const [hasPreviousSubmission, setHasPreviousSubmission] = useState(false);
  const [activeTab, setActiveTab] = useState("kamera"); // "kamera" | "daftar"

  const html5QrCodeRef = useRef(null);
  const scannedMapRef = useRef(scannedMap);
  const siswaMapRef = useRef({});

  // Sync ref agar callback Html5Qrcode selalu membaca data terbaru tanpa stale closure
  useEffect(() => {
    scannedMapRef.current = scannedMap;
  }, [scannedMap]);

  // Pantau pembatasan waktu (08:30 WIB) secara berkala
  useEffect(() => {
    if (!isOpen) return;
    const check = () => {
      const past = checkIsPastTimeLimit();
      setIsLockedByTime(past);
      if (past) {
        setIsSubmittedToday(true);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const todayISO = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  // 1. Muat data siswa rombel secara instan dari internal storage/cache
  useEffect(() => {
    if (!isOpen || !petugasInfo?.idWali || !petugasInfo?.idGuru) return;

    let isMounted = true;
    const waliId = petugasInfo.idWali;
    const storageKeySiswa = `cache_scan_siswa_${waliId}`;

    // Cek apakah data siswa sudah tersimpan di memory atau local storage internal
    let cachedSiswa = MEMORY_SISWA_CACHE[waliId];
    if (!cachedSiswa && typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(storageKeySiswa);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedSiswa = parsed;
            MEMORY_SISWA_CACHE[waliId] = parsed;
          }
        }
      } catch (_) {}
    }

    // Jika sudah ada cache internal, terapkan langsung SECARA INSTAN agar kamera langsung aktif
    if (cachedSiswa && cachedSiswa.length > 0) {
      setSiswaList(cachedSiswa);
      const sMap = {};
      cachedSiswa.forEach((s) => {
        sMap[s.idSiswa] = s;
      });
      siswaMapRef.current = sMap;
      setLoadingData(false);
    } else {
      setLoadingData(true);
    }

    // Baca draft scan lokal untuk hari ini
    const draftKey = `draft_scan_${waliId}_${todayISO}`;
    let localDraft = {};
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === "object") {
          localDraft = parsed;
        }
      }
    } catch (_) {}

    if (Object.keys(localDraft).length > 0) {
      setScannedMap((prev) => ({ ...localDraft, ...prev }));
    }

    async function syncDataFromServer() {
      setScannerError("");
      try {
        const pastLimit = checkIsPastTimeLimit();
        setIsLockedByTime(pastLimit);

        const res = await getPresensiWaliGrid(
          petugasInfo.idGuru,
          petugasInfo.idWali,
        );

        if (!isMounted) return;

        if (!res.success) {
          throw new Error(
            res.message || "Gagal memuat data kelas dari server.",
          );
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

        // Simpan ke storage internal & cache memory
        MEMORY_SISWA_CACHE[waliId] = normalizedSiswa;
        try {
          localStorage.setItem(
            storageKeySiswa,
            JSON.stringify(normalizedSiswa),
          );
        } catch (_) {}

        setSiswaList(normalizedSiswa);

        // Buat map cepat untuk pencarian O(1)
        const sMap = {};
        normalizedSiswa.forEach((s) => {
          sMap[s.idSiswa] = s;
        });
        siswaMapRef.current = sMap;

        // Cek data presensi yang sudah tersimpan di database hari ini
        const rawPresensi = res.data?.presensi || [];
        const todayRecords = rawPresensi.filter(
          (p) => String(p.tanggal).trim() === todayISO,
        );

        const existingScanMap = {};
        const existingManualMap = {};
        const existingKetMap = {};

        if (todayRecords.length > 0) {
          setHasPreviousSubmission(true);

          todayRecords.forEach((p) => {
            const sid = String(p.idSiswa).trim();
            if (p.status === "Hadir") {
              const matchTime = String(p.keterangan || "").match(
                /(\d{2}[:.]\d{2}(?:[:.]\d{2})?)/,
              );
              existingScanMap[sid] = {
                status: "Hadir",
                waktuScan: matchTime ? matchTime[1] : "Tersimpan",
                timestamp: Date.now(),
              };
            } else {
              existingManualMap[sid] = p.status || "Alfa";
              existingKetMap[sid] = p.keterangan || "";
            }
          });
        }

        // Gabungkan: data server + draft lokal (pertahankan scan pertama)
        setScannedMap((prev) => ({
          ...existingScanMap,
          ...localDraft,
          ...prev,
        }));
        setManualStatusMap((prev) => ({ ...existingManualMap, ...prev }));
        setManualKetMap((prev) => ({ ...existingKetMap, ...prev }));

        if (pastLimit) {
          setIsSubmittedToday(true);
        } else {
          setIsSubmittedToday(false);
        }
      } catch (err) {
        if (isMounted && (!cachedSiswa || cachedSiswa.length === 0)) {
          setScannerError(err.message || "Gagal memuat data rombel kelas.");
        }
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }

    syncDataFromServer();

    return () => {
      isMounted = false;
    };
  }, [isOpen, petugasInfo, todayISO]);

  // Simpan draft hasil scan ke localStorage jika ada penambahan
  useEffect(() => {
    if (!petugasInfo?.idWali || isSubmittedToday) return;
    const draftKey = `draft_scan_${petugasInfo.idWali}_${todayISO}`;
    try {
      if (Object.keys(scannedMap).length > 0) {
        localStorage.setItem(draftKey, JSON.stringify(scannedMap));
      }
    } catch (_) {}
  }, [scannedMap, petugasInfo?.idWali, isSubmittedToday, todayISO]);

  // 2. Lifecycle Scanner Kamera Html5Qrcode (Start Instan)
  useEffect(() => {
    if (!isOpen || loadingData || isSubmittedToday || activeTab !== "kamera") {
      stopScannerGracefully();
      return;
    }

    const scannerContainerId = "qr-reader-petugas";
    let isCancelled = false;

    // Timeout dipercepat ke 60ms agar kamera langsung aktif
    const timer = setTimeout(() => {
      if (isCancelled) return;
      startScanner(scannerContainerId);
    }, 60);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
      stopScannerGracefully();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, loadingData, isSubmittedToday, activeTab]);

  async function startScanner(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    try {
      if (html5QrCodeRef.current) {
        await stopScannerGracefully();
      }

      const html5QrCode = new Html5Qrcode(containerId);
      html5QrCodeRef.current = html5QrCode;

      // Konfigurasi kamera luas & adaptif: qrbox proporsional tanpa mengunci rasio 1:1
      const config = {
        fps: 20,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.floor(minEdge * 0.78);
          return {
            width: Math.max(edge, 200),
            height: Math.max(edge, 200),
          };
        },
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleBarcodeDecoded(decodedText);
        },
        () => {},
      );

      setScannerActive(true);
      setScannerError("");
    } catch (err) {
      console.warn("Gagal menyalakan kamera:", err);
      setScannerActive(false);
      setScannerError(
        "Kamera tidak dapat diakses. Pastikan izin kamera aktif pada browser.",
      );
    }
  }

  async function stopScannerGracefully() {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (_) {}
      html5QrCodeRef.current = null;
    }
    setScannerActive(false);
  }

  // 3. LOGIKA PEMINDAIAN: FIRST-SCAN WINS (ANTI DUPLIKAT)
  function handleBarcodeDecoded(rawText) {
    if (!rawText) return;

    // Cek batas jam sebelum memproses
    if (checkIsPastTimeLimit()) {
      setIsSubmittedToday(true);
      setIsLockedByTime(true);
      stopScannerGracefully();
      alert(
        "⛔ Batas waktu pengisian presensi barcode telah berakhir (Pukul 08.30 WIB).",
      );
      return;
    }

    let scannedId = String(rawText).trim();
    if (scannedId.startsWith("PRESENSI-SMK1TK:")) {
      scannedId = scannedId.replace("PRESENSI-SMK1TK:", "").trim();
    }

    const targetSiswa = siswaMapRef.current[scannedId];

    // Kasus A: Kartu bukan milik siswa di rombel kelas ini
    if (!targetSiswa) {
      setLastScanNotice({
        type: "error",
        title: "Siswa Tidak Dikenal",
        message: `ID [${scannedId}] tidak terdaftar di kelas ${petugasInfo?.namaKelas || "ini"}.`,
        waktu: new Date().toLocaleTimeString("id-ID"),
      });
      return;
    }

    // Kasus B: Siswa SUDAH PERNAH DI-SCAN SEBELUMNYA (FIRST-SCAN WINS)
    const existingScan = scannedMapRef.current[scannedId];
    if (existingScan) {
      setLastScanNotice({
        type: "duplicate",
        title: "Sudah Pernah Discan",
        message: `${targetSiswa.nama} sudah tercatat pada scan pertama pukul ${existingScan.waktuScan} WIB. Data pertama tetap dipertahankan.`,
        waktu: existingScan.waktuScan,
        siswa: targetSiswa,
      });
      return;
    }

    // Kasus C: SCAN PERTAMA KALI BERHASIL
    const now = new Date();
    const jamScan = now.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const newScanEntry = {
      status: "Hadir",
      waktuScan: jamScan,
      timestamp: Date.now(),
    };

    setScannedMap((prev) => ({
      ...prev,
      [scannedId]: newScanEntry,
    }));

    setManualStatusMap((prev) => {
      const copy = { ...prev };
      delete copy[scannedId];
      return copy;
    });

    playBeepSuccess();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(60);
    }

    setLastScanNotice({
      type: "success",
      title: "Berhasil Hadir!",
      message: `${targetSiswa.nama} berhasil dicatat HADIR.`,
      waktu: jamScan,
      siswa: targetSiswa,
    });
  }

  // Ringkasan Statistik
  const stats = useMemo(() => {
    let hadirCount = 0;
    let sakitCount = 0;
    let izinCount = 0;
    let alfaCount = 0;
    let cabutCount = 0;

    siswaList.forEach((s) => {
      if (scannedMap[s.idSiswa]) {
        hadirCount++;
      } else {
        const manual = manualStatusMap[s.idSiswa] || "Belum Scan";
        if (manual === "Sakit") sakitCount++;
        else if (manual === "Izin") izinCount++;
        else if (manual === "Alfa") alfaCount++;
        else if (manual === "Cabut") cabutCount++;
      }
    });

    const belumScanCount =
      siswaList.length -
      hadirCount -
      (sakitCount + izinCount + alfaCount + cabutCount);

    return {
      total: siswaList.length,
      hadir: hadirCount,
      sakit: sakitCount,
      izin: izinCount,
      alfa: alfaCount,
      cabut: cabutCount,
      belumScan: Math.max(0, belumScanCount),
    };
  }, [siswaList, scannedMap, manualStatusMap]);

  const siswaBelumDiscan = useMemo(() => {
    return siswaList.filter((s) => !scannedMap[s.idSiswa]);
  }, [siswaList, scannedMap]);

  const siswaSudahDiscan = useMemo(() => {
    return siswaList.filter((s) => !!scannedMap[s.idSiswa]);
  }, [siswaList, scannedMap]);

  // 4. KIRIM / SIMPAN PRESENSI KE BACKEND DENGAN CELLS LENGKAP
  async function handleSubmitPresensi() {
    if (isSubmittedToday || isLockedByTime) {
      alert(
        "⛔ Waktu pengisian presensi barcode untuk hari ini telah berakhir (Pukul 08.30 WIB).",
      );
      return;
    }

    if (siswaList.length === 0) {
      alert("Tidak ada data siswa.");
      return;
    }

    const pastCheck = checkIsPastTimeLimit();
    if (pastCheck) {
      setIsSubmittedToday(true);
      setIsLockedByTime(true);
      alert(
        "⛔ Batas waktu pukul 08.30 WIB telah terlewati. Presensi sekarang dikunci.",
      );
      return;
    }

    const confirmText =
      `📋 KONFIRMASI PENGIRIMAN PRESENSI BARCODE\n\n` +
      `Kelas: ${petugasInfo?.namaKelas}\n` +
      `Total Siswa: ${stats.total}\n` +
      `• Hadir (Scan Barcode): ${stats.hadir}\n` +
      `• Sakit: ${stats.sakit}\n` +
      `• Izin: ${stats.izin}\n` +
      `• Alfa: ${stats.alfa + stats.belumScan} (${stats.belumScan} siswa belum discan otomatis dijadikan Alfa)\n\n` +
      `⏰ INFORMASI PEMBATASAN WAKTU:\n` +
      `Anda dapat menyimpan dan memperbarui data ini kembali jika ada siswa lain yang hadir menyusul hingga pukul 08.30 WIB.\n\n` +
      `Apakah Anda ingin menyimpan data presensi ini sekarang?`;

    if (!window.confirm(confirmText)) return;

    setSaving(true);
    try {
      // SUSUN CELLS DENGAN FORMAT YANG DIHARAPKAN GOOGLE APPS SCRIPT
      const cells = siswaList.map((s) => {
        const scan = scannedMap[s.idSiswa];
        if (scan) {
          return {
            idSiswa: s.idSiswa,
            namaSiswa: s.nama,
            tanggal: todayISO,
            status: "Hadir",
            keterangan: `Scan pertama: ${scan.waktuScan} WIB`,
          };
        }

        const st = manualStatusMap[s.idSiswa] || "Alfa";
        const ket =
          manualKetMap[s.idSiswa] ||
          (st === "Alfa"
            ? "Tidak hadir saat scan barcode"
            : `Petugas: ${user?.nama || "Siswa"}`);

        return {
          idSiswa: s.idSiswa,
          namaSiswa: s.nama,
          tanggal: todayISO,
          status: st,
          keterangan: ket,
        };
      });

      // KEY WAJIB cells (BUKAN presensi)
      const res = await savePresensiWaliKelas({
        idGuru: petugasInfo.idGuru,
        idWali: petugasInfo.idWali,
        cells,
      });

      if (!res.success) {
        throw new Error(res.message || "Gagal menyimpan presensi ke server.");
      }

      setHasPreviousSubmission(true);

      // Bersihkan draft lokal karena sudah tersimpan di server
      try {
        localStorage.removeItem(`draft_scan_${petugasInfo.idWali}_${todayISO}`);
      } catch (_) {}

      if (typeof onPresensiSubmitted === "function") {
        onPresensiSubmitted();
      }

      // Cek apakah setelah simpan sudah lewat jam 08.30 WIB
      if (checkIsPastTimeLimit()) {
        setIsSubmittedToday(true);
        setIsLockedByTime(true);
        await stopScannerGracefully();
        alert(
          "✅ Presensi kelas via barcode berhasil disimpan ke sistem!\nWaktu pengisian hari ini telah ditutup (pukul 08.30 WIB).",
        );
        onClose();
      } else {
        alert(
          "✅ Presensi kelas via barcode berhasil disimpan ke sistem!\n\n" +
            "💡 Anda masih dapat memindai siswa lain yang datang menyusul dan menyimpannya kembali hingga batas pukul 08.30 WIB.",
        );
      }
    } catch (err) {
      console.error("Gagal simpan presensi:", err);
      alert(`Terjadi kesalahan: ${err.message || "Gagal menghubungi server"}`);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* HEADER MODAL MINIMALIS */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-teal-400/20 text-teal-300 text-sm">
              📷
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-black tracking-tight">
                  Scan Presensi Siswa
                </h3>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-teal-400/20 text-teal-200 font-bold border border-teal-300/30">
                  {petugasInfo?.namaKelas || "Rombel"}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-teal-200 truncate">
                Pindai kartu kertas siswa • Simpan berulang s.d 08.30 WIB
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScannerGracefully();
              onClose();
            }}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* TAB NAVIGASI: KAMERA SCAN vs REVIEW DAFTAR */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50 px-3 sm:px-5 pt-1.5 shrink-0">
          <button
            onClick={() => setActiveTab("kamera")}
            className={`px-3 py-1.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "kamera"
                ? "border-emerald-600 text-emerald-800 bg-white rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📷</span>
            <span>Kamera Pemindai</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {stats.hadir}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("daftar")}
            className={`px-3 py-1.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === "daftar"
                ? "border-emerald-600 text-emerald-800 bg-white rounded-t-lg"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>📋</span>
            <span>Daftar Siswa &amp; Status</span>
            {stats.belumScan > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
                {stats.belumScan} Belum
              </span>
            )}
          </button>
        </div>

        {/* KONTEN BODY */}
        <div className="p-2.5 sm:p-4 overflow-y-auto space-y-2 sm:space-y-2.5 flex-1">
          {/* BANNER NOTIFIKASI BATAS WAKTU SIMPEL */}
          {isLockedByTime ? (
            <div className="px-2.5 py-1.5 bg-rose-50 rounded-lg border border-rose-300 text-rose-950 flex items-center justify-between text-[11px] shadow-2xs">
              <div className="flex items-center gap-1.5 truncate">
                <span>⛔</span>
                <span className="font-bold text-rose-900 truncate">
                  Batas waktu 08.30 WIB telah berakhir. Data presensi barcode
                  dikunci.
                </span>
              </div>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 font-bold shrink-0">
                Terkunci
              </span>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg border border-teal-200 text-teal-950 flex items-center justify-between text-[11px] shadow-2xs">
              <div className="flex items-center gap-1.5 truncate">
                <span>⏰</span>
                <span className="truncate">
                  Bisa simpan &amp; scan berulang s.d <strong>08.30 WIB</strong>
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-teal-300 font-bold text-teal-800 shadow-2xs">
                  Batas: 08.30 WIB
                </span>
                {hasPreviousSubmission && (
                  <span className="text-[8.5px] px-1 py-0.5 rounded bg-emerald-600 text-white font-bold">
                    ✓ Tersimpan
                  </span>
                )}
              </div>
            </div>
          )}

          {/* STATISTIK RINGKAS MINIMALIS */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="py-1 px-1 rounded-lg bg-slate-100 border border-slate-200">
              <div className="text-[8.5px] text-slate-500 font-bold uppercase leading-none">
                Total
              </div>
              <div className="text-xs sm:text-sm font-black text-slate-900 leading-tight mt-0.5">
                {stats.total}
              </div>
            </div>

            <div className="py-1 px-1 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-[8.5px] text-emerald-700 font-bold uppercase leading-none">
                Hadir
              </div>
              <div className="text-xs sm:text-sm font-black text-emerald-700 leading-tight mt-0.5">
                {stats.hadir}
              </div>
            </div>

            <div className="py-1 px-1 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-[8.5px] text-amber-700 font-bold uppercase leading-none">
                Sakit/Izin
              </div>
              <div className="text-xs sm:text-sm font-black text-amber-700 leading-tight mt-0.5">
                {stats.sakit + stats.izin}
              </div>
            </div>

            <div className="py-1 px-1 rounded-lg bg-rose-50 border border-rose-200">
              <div className="text-[8.5px] text-rose-700 font-bold uppercase leading-none">
                Belum
              </div>
              <div className="text-xs sm:text-sm font-black text-rose-700 leading-tight mt-0.5">
                {stats.belumScan + stats.alfa + stats.cabut}
              </div>
            </div>
          </div>

          {/* TAB 1: KAMERA PEMINDAI */}
          {activeTab === "kamera" && !isLockedByTime && (
            <div className="space-y-2">
              {/* FEEDBACK TERAKHIR HASIL SCAN (TOAST BANNER) */}
              {lastScanNotice && (
                <div
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between transition-all animate-in fade-in slide-in-from-top-1 ${
                    lastScanNotice.type === "success"
                      ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                      : lastScanNotice.type === "duplicate"
                        ? "bg-blue-50 border-blue-300 text-blue-950"
                        : "bg-rose-50 border-rose-300 text-rose-950"
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm">
                      {lastScanNotice.type === "success"
                        ? "✅"
                        : lastScanNotice.type === "duplicate"
                          ? "ℹ️"
                          : "⚠️"}
                    </span>
                    <div className="truncate">
                      <span className="font-bold">{lastScanNotice.title}:</span>{" "}
                      {lastScanNotice.message}
                    </div>
                  </div>
                  <span className="text-[9.5px] font-mono px-1.5 py-0.5 rounded bg-white/80 font-bold shrink-0 ml-1">
                    {lastScanNotice.waktu}
                  </span>
                </div>
              )}

              {/* CONTAINER KAMERA LUAS & LEBAR UNTUK SMARTPHONE */}
              <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700 w-full h-[54vh] sm:h-[430px] min-h-[300px] max-h-[550px] flex flex-col items-center justify-center shadow-md">
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                      #qr-reader-petugas {
                        width: 100% !important;
                        height: 100% !important;
                        border: none !important;
                        position: relative !important;
                      }
                      #qr-reader-petugas video {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: cover !important;
                        border-radius: 0.875rem !important;
                      }
                      #qr-reader-petugas__scan_region {
                        background: transparent !important;
                      }
                      #qr-reader-petugas__dashboard_section_csr span,
                      #qr-reader-petugas__dashboard_section_swaplink {
                        display: none !important;
                      }
                    `,
                  }}
                />
                <div id="qr-reader-petugas" className="w-full h-full" />

                {scannerActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-3.5">
                    <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium shadow-xs">
                      Arahkan kamera ke QR Code kartu kertas siswa
                    </div>

                    <div className="w-52 h-52 sm:w-60 sm:h-60 border-2 border-dashed border-emerald-400 rounded-2xl animate-pulse" />

                    <div className="px-2.5 py-0.5 rounded-md bg-emerald-950/85 text-emerald-300 text-[9.5px] font-mono font-bold shadow-xs">
                      Scan Pertama Terkunci • Bisa Simpan Berulang s.d 08.30
                    </div>
                  </div>
                )}

                {scannerError && (
                  <div className="absolute inset-0 p-4 bg-slate-900/90 text-white flex flex-col items-center justify-center text-center space-y-2">
                    <span className="text-3xl">📷</span>
                    <p className="text-xs text-rose-300 max-w-sm">
                      {scannerError}
                    </p>
                    <button
                      onClick={() => startScanner("qr-reader-petugas")}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}
              </div>

              {/* LIST SISWA TERAKHIR DISCAN (KOMPAK) */}
              {siswaSudahDiscan.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Terakhir Hadir:</span>
                    <span className="text-emerald-700 font-black">
                      {siswaSudahDiscan.length} Siswa Terdata
                    </span>
                  </div>
                  <div className="space-y-1 max-h-24 overflow-y-auto">
                    {siswaSudahDiscan
                      .slice(-4)
                      .reverse()
                      .map((s) => (
                        <div
                          key={s.idSiswa}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50/80 border border-emerald-200/80 flex items-center justify-between text-xs text-emerald-950"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="text-emerald-600 font-bold">
                              ✓
                            </span>
                            <span className="font-bold truncate">{s.nama}</span>
                          </div>
                          <span className="text-[9.5px] font-mono text-emerald-800 shrink-0 ml-1">
                            {scannedMap[s.idSiswa]?.waktuScan} WIB
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DAFTAR SISWA & STATUS */}
          {activeTab === "daftar" && (
            <div className="space-y-4">
              {/* BAGIAN A: SISWA BELUM DISCAN (BISA DITANDAI SAKIT / IZIN / ALFA) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>Siswa Belum Discan ({siswaBelumDiscan.length})</span>
                  </h4>
                  <span className="text-[10px] text-slate-500">
                    Bisa ditandai Sakit / Izin
                  </span>
                </div>

                {siswaBelumDiscan.length === 0 ? (
                  <div className="p-3 text-center bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-bold">
                    🎉 Seluruh siswa ({stats.total}) telah hadir dan discan.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {siswaBelumDiscan.map((s) => {
                      const curStatus = manualStatusMap[s.idSiswa] || "Alfa";
                      return (
                        <div
                          key={s.idSiswa}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {s.nama}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              ID: {s.idSiswa}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {["Sakit", "Izin", "Alfa", "Cabut"].map((st) => (
                              <button
                                key={st}
                                disabled={isLockedByTime}
                                onClick={() =>
                                  setManualStatusMap((prev) => ({
                                    ...prev,
                                    [s.idSiswa]: st,
                                  }))
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                                  curStatus === st
                                    ? st === "Sakit"
                                      ? "bg-blue-600 text-white"
                                      : st === "Izin"
                                        ? "bg-amber-500 text-white"
                                        : st === "Alfa"
                                          ? "bg-rose-600 text-white"
                                          : "bg-violet-600 text-white"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BAGIAN B: SISWA YANG SUDAH DISCAN HADIR */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>
                    Siswa Sudah Discan Hadir ({siswaSudahDiscan.length})
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {siswaSudahDiscan.map((s) => (
                    <div
                      key={s.idSiswa}
                      className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200 flex items-center justify-between text-xs"
                    >
                      <div className="truncate">
                        <span className="font-bold text-slate-900 truncate block">
                          {s.nama}
                        </span>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {s.idSiswa}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                        {scannedMap[s.idSiswa]?.waktuScan} WIB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER AKSI: TOMBOL SIMPAN / KIRIM */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              stopScannerGracefully();
              onClose();
            }}
            className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>

          {!isLockedByTime && (
            <button
              onClick={handleSubmitPresensi}
              disabled={saving || stats.total === 0}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-black transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{saving ? "⏳" : "💾"}</span>
              <span>
                {saving
                  ? "Menyimpan ke Server..."
                  : hasPreviousSubmission
                    ? "Perbarui Presensi Kelas (s.d 08.30)"
                    : "Kirim Presensi Kelas (s.d 08.30)"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
