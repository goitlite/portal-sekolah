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

// Konfigurasi jam operasional presensi scan barcode (Buka 07.00 WIB, Tutup 07.15 WIB)
const BARCODE_OPEN_H = 7;
const BARCODE_OPEN_M = 0;
const BARCODE_CLOSE_H = 7;
const BARCODE_CLOSE_M = 15;

// Helper cek apakah waktu lokal saat ini di luar batas operasional barcode (07:00 - 07:15 WIB)
function checkIsPastTimeLimit() {
  try {
    if (typeof window !== "undefined") {
      if (
        localStorage.getItem("portal_bypass_barcode_time") === "true" ||
        localStorage.getItem("portal_bypass_time_limit") === "true"
      ) {
        return false;
      }
    }
  } catch (_) {}

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTotal = hours * 60 + minutes;
  const openTotal = BARCODE_OPEN_H * 60 + BARCODE_OPEN_M; // 420 (07:00 WIB)
  const closeTotal = BARCODE_CLOSE_H * 60 + BARCODE_CLOSE_M; // 435 (07:15 WIB)

  // Buka hanya pada jam 07:00 s.d 07:15 WIB
  const isOpen = currentTotal >= openTotal && currentTotal < closeTotal;
  return !isOpen;
}

// In-memory cache internal modul agar scanner start instan saat modal dibuka kembali
const MEMORY_SISWA_CACHE = {}; // { [idWali]: siswaList }

// Format tanggal, hari, dan jam bahasa Indonesia
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

// Helper penyimpanan antrian presensi offline multi-hari
function getOfflineQueue(waliId) {
  try {
    const raw = localStorage.getItem(`offline_presensi_queue_${waliId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function saveOfflineQueue(waliId, queue) {
  try {
    localStorage.setItem(
      `offline_presensi_queue_${waliId}`,
      JSON.stringify(queue),
    );
  } catch (_) {}
}

// Jalankan satu per satu (GAS dengan ScriptLock lebih stabil dan cepat jika berurutan tanpa lock timeout)
async function runSerial(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i++) out.push(await fn(items[i], i));
  return out;
}

export default function ModalScanPresensiPetugas({
  isOpen,
  onClose,
  petugasInfo, // { idWali, idGuru, namaKelas, kelas }
  availableClasses = [],
  user, // { id, nama }
  onPresensiSubmitted,
  onOpenReguler,
  onOpenScanWajah,
}) {
  const [selectedWaliId, setSelectedWaliId] = useState(petugasInfo?.idWali);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  // Sinkronkan selectedWaliId jika modal dibuka ulang atau jika lintas kelas tidak diizinkan
  useEffect(() => {
    if (isOpen) {
      if (!Array.isArray(availableClasses) || availableClasses.length <= 1) {
        setSelectedWaliId(petugasInfo?.idWali);
      } else if (!selectedWaliId && petugasInfo?.idWali) {
        setSelectedWaliId(petugasInfo.idWali);
      }
    }
  }, [isOpen, petugasInfo?.idWali, availableClasses]);

  const isAllClassesMode = selectedWaliId === "ALL_CLASSES";

  const activeClass = useMemo(() => {
    if (isAllClassesMode) {
      return {
        idWali: "ALL_CLASSES",
        idGuru: petugasInfo?.idGuru,
        namaKelas: "Semua Kelas (Scan Pintar)",
        kelas: "Semua Kelas",
      };
    }
    const found = availableClasses.find(
      (c) => String(c.idWali) === String(selectedWaliId),
    );
    return found || petugasInfo;
  }, [isAllClassesMode, selectedWaliId, availableClasses, petugasInfo]);

  // Kunci stabil daftar kelas: efek tidak berjalan ulang hanya karena array/objek baru berisi sama
  const classesKey = useMemo(
    () =>
      (availableClasses || [])
        .map((c) => `${c.idWali}:${(c.daftarSiswa || []).length}`)
        .join("|"),
    [availableClasses],
  );

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

  // Notifikasi real-time terakhir saat scan (banner kecil di atas kamera)
  const [lastScanNotice, setLastScanNotice] = useState(null);

  // Overlay notifikasi BESAR di tengah layar scan (sukses / gagal / duplikat)
  const [scanOverlay, setScanOverlay] = useState(null);
  const scanOverlayTimerRef = useRef(null);

  // Status pengiriman presensi & pembatasan jam
  const [saving, setSaving] = useState(false);
  // Progress overlay saat menyimpan ke spreadsheet
  // { phase: "prepare"|"sending"|"done"|"error", label: string, pct: number,
  //   details: [{namaKelas, status:"ok"|"error"|"pending"}], allSuccess: bool }
  const [saveProgress, setSaveProgress] = useState(null);
  const [lastOnlineSaveTime, setLastOnlineSaveTime] = useState("");
  const [pendingOfflineRecords, setPendingOfflineRecords] = useState([]);
  const [isLockedByTime, setIsLockedByTime] = useState(false);
  const [isSubmittedToday, setIsSubmittedToday] = useState(false);
  const [hasPreviousSubmission, setHasPreviousSubmission] = useState(false);
  const [activeTab, setActiveTab] = useState("kamera"); // "kamera" | "daftar"

  // Input kode 1230 untuk membuka akses jika sedang di luar jam (ditutup)
  const [unlockCodeInput, setUnlockCodeInput] = useState("");
  const [unlockError, setUnlockError] = useState("");

  function handleUnlockWithCode() {
    if (unlockCodeInput.trim() === "1230") {
      try {
        localStorage.setItem("portal_bypass_barcode_time", "true");
        localStorage.setItem("portal_bypass_time_limit", "true");
      } catch (_) {}
      setIsLockedByTime(false);
      setIsSubmittedToday(false);
      setUnlockError("");
      setUnlockCodeInput("");
      // Jalankan scanner jika di tab kamera
      if (activeTab === "kamera") {
        setTimeout(() => {
          try {
            startScanner();
          } catch (_) {}
        }, 150);
      }
    } else {
      setUnlockError("Kode akses salah! Masukkan kode untuk membuka.");
    }
  }

  const html5QrCodeRef = useRef(null);
  const scannedMapRef = useRef(scannedMap);
  const siswaMapRef = useRef({});
  // Timestamp scan terakhir sukses — digunakan untuk cooldown agar overlay hijau tidak langsung diganti
  const lastSuccessScanAt = useRef(0);
  // Durasi cooldown (ms): selama ini semua bacaan scanner diabaikan
  const SCAN_COOLDOWN_MS = 3000;
  // Guard agar flush tidak jalan dua kali bersamaan
  const flushingRef = useRef(false);

  // Sync ref agar callback Html5Qrcode selalu membaca data terbaru tanpa stale closure
  useEffect(() => {
    scannedMapRef.current = scannedMap;
  }, [scannedMap]);

  // Auto-dismiss overlay notifikasi tengah layar (sukses 2.8 dtk, error/duplikat 3.5 dtk)
  useEffect(() => {
    if (!scanOverlay) return;
    if (scanOverlayTimerRef.current) clearTimeout(scanOverlayTimerRef.current);
    scanOverlayTimerRef.current = setTimeout(
      () => {
        setScanOverlay(null);
      },
      scanOverlay.type === "success" ? 2800 : 3500,
    );
    return () => {
      if (scanOverlayTimerRef.current)
        clearTimeout(scanOverlayTimerRef.current);
    };
  }, [scanOverlay]);

  // Pantau pembatasan waktu operasional barcode (07:00 – 07:15 WIB) secara berkala
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
    if (!isOpen) return;

    let isMounted = true;

    // A. MODE SEMUA KELAS (SCAN PINTAR)
    if (isAllClassesMode) {
      const combinedSiswa = [];
      const combinedMap = {};
      const allOfflineRecords = [];
      let combinedDraft = {};

      let classesToProcess =
        Array.isArray(availableClasses) && availableClasses.length > 0
          ? availableClasses
          : [];

      if (classesToProcess.length === 0 && typeof window !== "undefined") {
        try {
          const rawCls = localStorage.getItem(
            "portal_sekolah_daftar_kelas_cache",
          );
          if (rawCls) {
            const parsed = JSON.parse(rawCls);
            if (Array.isArray(parsed) && parsed.length > 0) {
              classesToProcess = parsed;
            }
          }
        } catch (_) {}
      }

      if (classesToProcess.length === 0) {
        classesToProcess = [petugasInfo];
      }

      classesToProcess.forEach((cls) => {
        const wId = cls?.idWali;
        const gId = cls?.idGuru;
        if (!wId) return;

        // Ambil data siswa dari memory cache, localStorage, atau prop daftarSiswa
        let list = MEMORY_SISWA_CACHE[wId];
        if (!list && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem(`cache_scan_siswa_${wId}`);
            if (raw) list = JSON.parse(raw);
          } catch (_) {}
        }
        if (!list || list.length === 0) {
          list = cls.daftarSiswa || [];
        }

        if (Array.isArray(list)) {
          list.forEach((s) => {
            const sid = String(s.idSiswa || s.id || "").trim();
            if (sid && !combinedMap[sid]) {
              const obj = {
                idSiswa: sid,
                nama: (s.nama || s.namaSiswa || "").trim(),
                kelas: s.kelas || cls.namaKelas || "",
                idWali: wId,
                idGuru: gId,
              };
              combinedMap[sid] = obj;
              combinedSiswa.push(obj);
            }
          });
        }

        // Kumpulkan antrian offline
        const q = getOfflineQueue(wId);
        allOfflineRecords.push(...q);

        // Kumpulkan draft
        try {
          const rawDraft = localStorage.getItem(
            `draft_scan_${wId}_${todayISO}`,
          );
          if (rawDraft) {
            const parsed = JSON.parse(rawDraft);
            if (parsed && typeof parsed === "object") {
              combinedDraft = { ...combinedDraft, ...parsed };
            }
          }
        } catch (_) {}
      });

      combinedSiswa.sort((a, b) => a.nama.localeCompare(b.nama));
      setSiswaList(combinedSiswa);
      siswaMapRef.current = combinedMap;
      setLoadingData(false);

      setPendingOfflineRecords(
        allOfflineRecords.filter(
          (item) => item.tanggal && item.tanggal !== todayISO,
        ),
      );

      const todayOfflineScan = {};
      const todayOfflineManual = {};
      allOfflineRecords
        .filter((item) => !item.tanggal || item.tanggal === todayISO)
        .forEach((item) => {
          if (item.status === "Hadir") {
            todayOfflineScan[item.idSiswa] = {
              status: "Hadir",
              waktuScan:
                String(item.keterangan || "").match(
                  /(\d{2}[:.]\d{2}(?:[:.]\d{2})?)/,
                )?.[1] || "Offline",
              timestamp: item.timestamp || Date.now(),
            };
          } else if (item.status) {
            todayOfflineManual[item.idSiswa] = item.status;
          }
        });

      setScannedMap((prev) => ({
        ...combinedDraft,
        ...todayOfflineScan,
        ...prev,
      }));
      setManualStatusMap((prev) => ({
        ...todayOfflineManual,
        ...prev,
      }));
      return;
    }

    // B. MODE PER KELAS TERTENTU
    const waliId = activeClass?.idWali || petugasInfo?.idWali;
    const guruId = activeClass?.idGuru || petugasInfo?.idGuru;
    if (!waliId || !guruId) return;

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

    // Fallback dari prop daftarSiswa jika belum ada di cache
    if (
      (!cachedSiswa || cachedSiswa.length === 0) &&
      Array.isArray(activeClass?.daftarSiswa) &&
      activeClass.daftarSiswa.length > 0
    ) {
      cachedSiswa = activeClass.daftarSiswa
        .map((s) => ({
          idSiswa: String(s.idSiswa || s.id || "").trim(),
          nama: (s.nama || s.namaSiswa || "").trim(),
          kelas: s.kelas || activeClass.namaKelas || "",
          idWali: waliId,
          idGuru: guruId,
        }))
        .filter((s) => s.idSiswa);
    }

    // Jika sudah ada data siswa, terapkan langsung SECARA INSTAN agar kamera langsung aktif
    if (cachedSiswa && cachedSiswa.length > 0) {
      setSiswaList(cachedSiswa);
      const sMap = {};
      cachedSiswa.forEach((s) => {
        sMap[s.idSiswa] = {
          ...s,
          idWali: waliId,
          idGuru: guruId,
          kelas: s.kelas || activeClass.namaKelas || "",
        };
      });
      siswaMapRef.current = sMap;
      setLoadingData(false);
    } else {
      setLoadingData(true);
    }

    // Muat waktu simpan online terakhir jika ada
    try {
      const lastSaved = localStorage.getItem(`last_online_save_${waliId}`);
      if (lastSaved) setLastOnlineSaveTime(lastSaved);
    } catch (_) {}

    // Muat antrian offline multi-hari
    const offlineQueue = getOfflineQueue(waliId);
    const pastRecords = offlineQueue.filter(
      (item) => item.tanggal && item.tanggal !== todayISO,
    );
    setPendingOfflineRecords(pastRecords);

    // Catatan offline hari ini jika ada
    const todayOffline = offlineQueue.filter(
      (item) => !item.tanggal || item.tanggal === todayISO,
    );
    const todayOfflineScan = {};
    const todayOfflineManual = {};
    todayOffline.forEach((item) => {
      if (item.status === "Hadir") {
        todayOfflineScan[item.idSiswa] = {
          status: "Hadir",
          waktuScan:
            String(item.keterangan || "").match(
              /(\d{2}[:.]\d{2}(?:[:.]\d{2})?)/,
            )?.[1] || "Offline",
          timestamp: item.timestamp || Date.now(),
        };
      } else if (item.status) {
        todayOfflineManual[item.idSiswa] = item.status;
      }
    });

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

    setScannedMap((prev) => ({
      ...localDraft,
      ...todayOfflineScan,
      ...prev,
    }));
    setManualStatusMap((prev) => ({
      ...todayOfflineManual,
      ...prev,
    }));

    async function syncDataFromServer() {
      setScannerError("");
      try {
        const pastLimit = checkIsPastTimeLimit();
        setIsLockedByTime(pastLimit);

        const res = await getPresensiWaliGrid(guruId, waliId);

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
            kelas: s.kelas || activeClass.namaKelas || "",
            idWali: waliId,
            idGuru: guruId,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    activeClass?.idWali,
    activeClass?.idGuru,
    isAllClassesMode,
    selectedWaliId,
    todayISO,
    classesKey,
  ]);

  // Simpan draft hasil scan ke localStorage jika ada penambahan
  useEffect(() => {
    if (isSubmittedToday) return;
    if (isAllClassesMode) {
      const byWali = {};
      Object.entries(scannedMap).forEach(([sid, entry]) => {
        const s = siswaMapRef.current[sid];
        const wId = s?.idWali || petugasInfo?.idWali;
        if (wId) {
          if (!byWali[wId]) byWali[wId] = {};
          byWali[wId][sid] = entry;
        }
      });
      Object.entries(byWali).forEach(([wId, draft]) => {
        try {
          localStorage.setItem(
            `draft_scan_${wId}_${todayISO}`,
            JSON.stringify(draft),
          );
        } catch (_) {}
      });
    } else {
      const waliId = activeClass?.idWali || petugasInfo?.idWali;
      if (!waliId) return;
      const draftKey = `draft_scan_${waliId}_${todayISO}`;
      try {
        if (Object.keys(scannedMap).length > 0) {
          localStorage.setItem(draftKey, JSON.stringify(scannedMap));
        }
      } catch (_) {}
    }
  }, [
    scannedMap,
    activeClass?.idWali,
    isAllClassesMode,
    petugasInfo?.idWali,
    isSubmittedToday,
    todayISO,
  ]);

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

    // Cooldown: abaikan scan apapun selama SCAN_COOLDOWN_MS setelah scan sukses terakhir
    // agar overlay hijau (sukses) tidak langsung digantikan oleh bacaan ulang yg sama
    const nowMs = Date.now();
    if (nowMs - lastSuccessScanAt.current < SCAN_COOLDOWN_MS) return;

    // Cek batas jam sebelum memproses
    if (checkIsPastTimeLimit()) {
      setIsSubmittedToday(true);
      setIsLockedByTime(true);
      stopScannerGracefully();
      alert(
        "⛔ Batas waktu pengisian presensi barcode telah berakhir (Buka pukul 07.00 – 07.15 WIB). Masukkan kode untuk membuka akses.",
      );
      return;
    }

    let scannedId = String(rawText).trim();
    if (scannedId.startsWith("PRESENSI-SMK1TK:")) {
      scannedId = scannedId.replace("PRESENSI-SMK1TK:", "").trim();
    }

    const targetSiswa = siswaMapRef.current[scannedId];

    // Kasus A: Kartu bukan milik siswa
    if (!targetSiswa) {
      const notif = {
        type: "error",
        title: "Siswa Tidak Dikenal",
        message: isAllClassesMode
          ? `ID [${scannedId}] tidak terdaftar di database sekolah.`
          : `ID [${scannedId}] tidak terdaftar di kelas ${activeClass?.namaKelas || "ini"}.`,
        waktu: new Date().toLocaleTimeString("id-ID"),
      };
      setLastScanNotice(notif);
      setScanOverlay({
        type: "error",
        nama: null,
        waktu: notif.waktu,
        pesan: notif.message,
      });
      return;
    }

    // Kasus B: Siswa SUDAH PERNAH DI-SCAN SEBELUMNYA (FIRST-SCAN WINS)
    const existingScan = scannedMapRef.current[scannedId];
    if (existingScan) {
      const kelasLabel = targetSiswa.kelas ? ` (${targetSiswa.kelas})` : "";
      const notif = {
        type: "duplicate",
        title: "Sudah Pernah Discan",
        message: `${targetSiswa.nama}${kelasLabel} sudah tercatat pada scan pertama pukul ${existingScan.waktuScan} WIB. Data pertama tetap dipertahankan.`,
        waktu: existingScan.waktuScan,
        siswa: targetSiswa,
      };
      setLastScanNotice(notif);
      setScanOverlay({
        type: "duplicate",
        nama: `${targetSiswa.nama}${targetSiswa.kelas ? ` • ${targetSiswa.kelas}` : ""}`,
        waktu: existingScan.waktuScan,
        pesan: `Sudah tercatat hadir pukul ${existingScan.waktuScan} WIB`,
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
      idWali: targetSiswa.idWali || activeClass?.idWali,
      idGuru: targetSiswa.idGuru || activeClass?.idGuru,
      kelas: targetSiswa.kelas || activeClass?.namaKelas,
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

    // Simpan ke antrian offline lokal multi-hari (diteruskan ke wali kelas siswa yang bersangkutan)
    try {
      const targetWaliId =
        targetSiswa.idWali || activeClass?.idWali || petugasInfo?.idWali;
      if (targetWaliId) {
        const q = getOfflineQueue(targetWaliId);
        const filtered = q.filter(
          (item) => !(item.idSiswa === scannedId && item.tanggal === todayISO),
        );
        filtered.push({
          idSiswa: scannedId,
          namaSiswa: targetSiswa.nama,
          tanggal: todayISO,
          status: "Hadir",
          keterangan: `Presensi Barcode: ${jamScan} WIB`,
          timestamp: Date.now(),
        });
        saveOfflineQueue(targetWaliId, filtered);
      }
    } catch (_) {}

    playBeepSuccess();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(60);
    }

    // Catat waktu scan sukses untuk aktifkan cooldown (blokir bacaan ulang scanner)
    lastSuccessScanAt.current = Date.now();

    const kelasLabel = targetSiswa.kelas ? ` (${targetSiswa.kelas})` : "";
    setLastScanNotice({
      type: "success",
      title: "Berhasil Hadir!",
      message: `${targetSiswa.nama}${kelasLabel} berhasil dicatat HADIR.`,
      waktu: jamScan,
      siswa: targetSiswa,
    });
    setScanOverlay({
      type: "success",
      nama: targetSiswa.nama,
      waktu: jamScan,
      pesan: `hadir pada pukul ${jamScan} WIB`,
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

  // 4. AUTO-FLUSH: Kirim antrian offline ke server saat ada koneksi
  async function flushOfflineQueue() {
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
        const q = getOfflineQueue(wId);
        if (q.length === 0) return;
        const targetGuru =
          availableClasses.find((c) => String(c.idWali) === String(wId))
            ?.idGuru || petugasInfo?.idGuru;
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
            const remaining = getOfflineQueue(wId).filter(
              (c) => !sentKeys.has(sKey(c)),
            );
            saveOfflineQueue(wId, remaining);

            const nowISO = new Date().toISOString();
            try {
              localStorage.setItem(`last_online_save_${wId}`, nowISO);
            } catch (_) {}
            if (String(wId) === String(activeClass?.idWali)) {
              setPendingOfflineRecords(remaining);
              setLastOnlineSaveTime(nowISO);
              setHasPreviousSubmission(true);
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
    const t0 = setTimeout(flushOfflineQueue, 1500);
    window.addEventListener("online", flushOfflineQueue);
    const iv = setInterval(flushOfflineQueue, 60000);
    return () => {
      clearTimeout(t0);
      clearInterval(iv);
      window.removeEventListener("online", flushOfflineQueue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeClass?.idWali, activeClass?.idGuru, todayISO]);

  // 5. KIRIM / SIMPAN PRESENSI KE BACKEND DENGAN CELLS LENGKAP
  async function handleSubmitPresensi() {
    if (isSubmittedToday || isLockedByTime) {
      alert(
        "⛔ Waktu pengisian presensi barcode untuk hari ini telah berakhir (Buka pukul 07.00 – 07.15 WIB). Masukkan kode jika ingin membuka akses.",
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
        "⛔ Batas waktu pukul 07.15 WIB telah terlewati. Presensi barcode sekarang dikunci.",
      );
      return;
    }

    // A. DIALOG KONFIRMASI BERDASARKAN MODE
    let confirmText = "";
    if (isAllClassesMode) {
      confirmText =
        `📋 KONFIRMASI PENGIRIMAN SCAN PINTAR (SEMUA KELAS)\n\n` +
        `Total Siswa Hadir Terpindai: ${stats.hadir}\n` +
        `Data kehadiran akan diteruskan otomatis ke masing-masing lembar wali kelas terkait.\n\n` +
        `Apakah Anda ingin menyimpan data presensi ini sekarang?`;
    } else {
      confirmText =
        `📋 KONFIRMASI PENGIRIMAN PRESENSI BARCODE\n\n` +
        `Kelas: ${activeClass?.namaKelas || petugasInfo?.namaKelas}\n` +
        `Total Siswa: ${stats.total}\n` +
        `• Hadir (Scan Barcode): ${stats.hadir}\n` +
        `• Sakit: ${stats.sakit}\n` +
        `• Izin: ${stats.izin}\n` +
        `• Alfa: ${stats.alfa + stats.belumScan} (${stats.belumScan} siswa belum discan otomatis dijadikan Alfa)\n\n` +
        `⏰ INFORMASI PEMBATASAN WAKTU:\n` +
        `Presensi barcode dibuka pukul 07.00 – 07.15 WIB. Anda dapat memperbarui data jika diperlukan hingga batas waktu berakhir.\n\n` +
        `Apakah Anda ingin menyimpan data presensi ini sekarang?`;
    }

    if (!window.confirm(confirmText)) return;

    setSaving(true);
    try {
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;

      // --- LOGIKA SIMPAN MODE SEMUA KELAS (SCAN PINTAR) ---
      if (isAllClassesMode) {
        // HANYA kirim siswa yang memang tercatat hadir/manual (tidak mengubah/meng-Alfa-kan siswa lain di kelas masing-masing)
        const activeRecorded = siswaList.filter(
          (s) => scannedMap[s.idSiswa] || manualStatusMap[s.idSiswa],
        );

        if (activeRecorded.length === 0 && pendingOfflineRecords.length === 0) {
          alert("Belum ada siswa yang discan untuk disimpan.");
          setSaving(false);
          return;
        }

        const todayCells = activeRecorded.map((s) => {
          const scan = scannedMap[s.idSiswa];
          if (scan) {
            return {
              idSiswa: s.idSiswa,
              namaSiswa: s.nama,
              tanggal: todayISO,
              status: "Hadir",
              keterangan: `Scan pertama: ${scan.waktuScan} WIB`,
              idWali: s.idWali,
              idGuru: s.idGuru,
              source: "scan_pintar",
              overwriteOnlyIf: ["", "Alfa"],
            };
          }
          const st = manualStatusMap[s.idSiswa] || "Alfa";
          const ket =
            manualKetMap[s.idSiswa] || `Petugas: ${user?.nama || "Siswa"}`;
          return {
            idSiswa: s.idSiswa,
            namaSiswa: s.nama,
            tanggal: todayISO,
            status: st,
            keterangan: ket,
            idWali: s.idWali,
            idGuru: s.idGuru,
            source: "scan_pintar",
            overwriteOnlyIf: ["", "Alfa"],
          };
        });

        // Kelompokkan cells per idWali
        const groups = {};
        [...pendingOfflineRecords, ...todayCells].forEach((cell) => {
          const sid = cell.idSiswa;
          const s = siswaMapRef.current[sid];
          const wId = cell.idWali || s?.idWali || petugasInfo?.idWali;
          const gId = cell.idGuru || s?.idGuru || petugasInfo?.idGuru;
          if (!wId) return;
          if (!groups[wId])
            groups[wId] = { idWali: wId, idGuru: gId, cells: [] };
          groups[wId].cells.push(cell);
        });

        // Simpan ke antrian offline masing-masing wali kelas (merge aman tanpa menghapus antrian hari lain)
        Object.entries(groups).forEach(([wId, grp]) => {
          try {
            const existingQ = getOfflineQueue(wId);
            const keyOf = (c) => `${c.idSiswa}|${c.tanggal}`;
            const map = new Map();
            existingQ.forEach((c) => map.set(keyOf(c), c));
            grp.cells.forEach((c) =>
              map.set(keyOf(c), { ...c, timestamp: c.timestamp || Date.now() }),
            );
            saveOfflineQueue(wId, Array.from(map.values()));
          } catch (_) {}
        });

        // Siapkan daftar kelas untuk ditampilkan di progress overlay
        const groupEntries = Object.entries(groups);
        const totalGroups = groupEntries.length;

        // Ambil nama kelas dari availableClasses untuk label progress
        const getNamaKelas = (wId) => {
          const found = availableClasses.find(
            (c) => String(c.idWali) === String(wId),
          );
          return found?.namaKelas || found?.kelas || `Kelas (${wId})`;
        };

        // Inisialisasi progress: semua "pending"
        const initDetails = groupEntries.map(([wId]) => ({
          wId,
          namaKelas: getNamaKelas(wId),
          status: "pending",
        }));

        if (isOffline) {
          setSaveProgress({
            phase: "error",
            label: "📱 Offline — presensi barcode tersimpan di antrian HP",
            pct: 100,
            details: initDetails.map((d) => ({ ...d, status: "offline" })),
            allSuccess: false,
          });
          if (typeof onPresensiSubmitted === "function") onPresensiSubmitted();
          setTimeout(() => {
            setSaveProgress(null);
            if (checkIsPastTimeLimit()) {
              setIsSubmittedToday(true);
              onClose();
            }
          }, 2500);
          return;
        }

        setSaveProgress({
          phase: "sending",
          label: `Mengirim ke ${totalGroups} lembar wali kelas...`,
          pct: 5,
          details: initDetails,
          allSuccess: null,
        });

        // Kirim ke semua wali kelas berurutan (runSerial) agar tidak tabrakan di LockService GAS
        let doneCount = 0;
        const detailsRef = [...initDetails];

        const saveResults = await runSerial(
          groupEntries,
          async ([wId, grp], idx) => {
            try {
              const res = await savePresensiWaliKelas({
                idGuru: grp.idGuru,
                idWali: wId,
                cells: grp.cells,
              });

              // Update status kelas ini
              detailsRef[idx] = {
                ...detailsRef[idx],
                status: res?.success ? "ok" : "error",
              };
              doneCount++;

              setSaveProgress((prev) => ({
                ...prev,
                label: `Mengirim... (${doneCount}/${totalGroups} kelas)`,
                pct: Math.round(10 + (doneCount / totalGroups) * 80),
                details: [...detailsRef],
              }));

              if (res?.success) {
                // Bersihkan HANYA data yang sudah terkirim, sisakan antrian hari lain
                const sKey = (c) =>
                  `${String(c.idSiswa).trim()}|${String(c.tanggal).trim()}|${String(c.status).trim()}`;
                const sentKeys = new Set(grp.cells.map(sKey));
                const remainingQ = getOfflineQueue(wId).filter(
                  (c) => !sentKeys.has(sKey(c)),
                );
                saveOfflineQueue(wId, remainingQ);

                const nowISO = new Date().toISOString();
                try {
                  localStorage.setItem(`last_online_save_${wId}`, nowISO);
                  localStorage.removeItem(`draft_scan_${wId}_${todayISO}`);
                } catch (_) {}
                return true;
              }
              return false;
            } catch (_) {
              detailsRef[idx] = { ...detailsRef[idx], status: "error" };
              doneCount++;
              setSaveProgress((prev) => ({
                ...prev,
                label: `Mengirim... (${doneCount}/${totalGroups} kelas)`,
                pct: Math.round(10 + (doneCount / totalGroups) * 80),
                details: [...detailsRef],
              }));
              return false;
            }
          },
        );
        const allSuccess = saveResults.every(Boolean);

        // Fase selesai
        setSaveProgress({
          phase: allSuccess ? "done" : "error",
          label: allSuccess
            ? "✅ Semua data berhasil dikirim!"
            : "⚠️ Sebagian data tersimpan online, sisanya di antrian perangkat",
          pct: 100,
          details: [...detailsRef],
          allSuccess,
        });

        // Auto-tutup overlay setelah 3 detik
        setTimeout(() => setSaveProgress(null), 3000);

        if (typeof onPresensiSubmitted === "function") {
          onPresensiSubmitted();
        }
        return;
      }

      // --- LOGIKA SIMPAN MODE PER KELAS TERTENTU ---
      const waliId = activeClass?.idWali || petugasInfo?.idWali;
      const guruId = activeClass?.idGuru || petugasInfo?.idGuru;

      // SUSUN CELLS — Hadir (scan), status manual, atau Alfa otomatis (onlyIfEmpty)
      const todayCells = siswaList.map((s) => {
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

        // Alfa otomatis (belum ada pilihan manual) hanya tulis jika server masih kosong
        const isAutoAlfa = st === "Alfa" && !manualStatusMap[s.idSiswa];
        return {
          idSiswa: s.idSiswa,
          namaSiswa: s.nama,
          tanggal: todayISO,
          status: st,
          keterangan: ket,
          ...(isAutoAlfa ? { auto: true, onlyIfEmpty: true } : {}),
        };
      });

      // Gabungkan dengan antrian pending offline multi-hari
      const allCells = [...pendingOfflineRecords, ...todayCells];

      // Simpan ke antrian offline DULU sebelum kirim (data aman meski koneksi mati saat kirim)
      try {
        if (waliId) {
          const newQueue = allCells.map((c) => ({
            ...c,
            timestamp: c.timestamp || Date.now(),
          }));
          saveOfflineQueue(waliId, newQueue);
          const newPending = newQueue.filter((c) => c.tanggal !== todayISO);
          setPendingOfflineRecords(newPending);
        }
      } catch (_) {}

      // Jika sedang offline → simpan saja, tidak kirim
      if (isOffline) {
        setSaveProgress({
          phase: "error",
          label: "📱 Offline — data tersimpan di perangkat",
          pct: 100,
          details: [
            {
              wId: waliId,
              namaKelas:
                activeClass?.namaKelas || petugasInfo?.namaKelas || "Kelas ini",
              status: "offline",
            },
          ],
          allSuccess: false,
        });
        setTimeout(() => setSaveProgress(null), 3000);
        return;
      }

      // Tampilkan progress: sedang mengirim
      const namaKelasNow =
        activeClass?.namaKelas || petugasInfo?.namaKelas || "Kelas ini";
      setSaveProgress({
        phase: "sending",
        label: `Mengirim ke lembar ${namaKelasNow}...`,
        pct: 30,
        details: [{ wId: waliId, namaKelas: namaKelasNow, status: "pending" }],
        allSuccess: null,
      });

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
        // Berhasil → bersihkan antrian offline hari ini
        if (waliId) {
          const q = getOfflineQueue(waliId);
          const remaining = q.filter(
            (c) =>
              c.tanggal &&
              c.tanggal !== todayISO &&
              !allCells.some(
                (a) => a.idSiswa === c.idSiswa && a.tanggal === c.tanggal,
              ),
          );
          saveOfflineQueue(waliId, remaining);
          setPendingOfflineRecords(remaining);
          const nowISO = new Date().toISOString();
          try {
            localStorage.setItem(`last_online_save_${waliId}`, nowISO);
          } catch (_) {}
          setLastOnlineSaveTime(nowISO);
        }

        setHasPreviousSubmission(true);

        // Bersihkan draft lokal karena sudah tersimpan di server
        try {
          localStorage.removeItem(`draft_scan_${waliId}_${todayISO}`);
        } catch (_) {}

        if (typeof onPresensiSubmitted === "function") {
          onPresensiSubmitted();
        }

        // Cek apakah setelah simpan sudah lewat jam 07.15 WIB
        const pastLimit = checkIsPastTimeLimit();

        setSaveProgress({
          phase: "done",
          label: pastLimit
            ? "✅ Tersimpan! Waktu pengisian barcode hari ini telah ditutup."
            : "✅ Presensi berhasil disimpan! Masih bisa update hingga 07.15 WIB.",
          pct: 100,
          details: [{ wId: waliId, namaKelas: namaKelasNow, status: "ok" }],
          allSuccess: true,
        });

        setTimeout(async () => {
          setSaveProgress(null);
          if (pastLimit) {
            setIsSubmittedToday(true);
            setIsLockedByTime(true);
            await stopScannerGracefully();
            onClose();
          }
        }, 2500);
      } else if (!res || res.networkError) {
        // Jaringan terputus saat kirim → data sudah aman di antrian offline
        setSaveProgress({
          phase: "error",
          label: "📱 Koneksi terputus — data aman di antrian perangkat",
          pct: 100,
          details: [
            { wId: waliId, namaKelas: namaKelasNow, status: "offline" },
          ],
          allSuccess: false,
        });
        setTimeout(() => setSaveProgress(null), 3500);
      } else {
        // Server menolak (bukan masalah jaringan)
        setSaveProgress({
          phase: "error",
          label: `❌ ${res.message || "Server menolak pengiriman"}`,
          pct: 100,
          details: [{ wId: waliId, namaKelas: namaKelasNow, status: "error" }],
          allSuccess: false,
        });
        setTimeout(() => setSaveProgress(null), 4000);
      }
    } catch (err) {
      console.error("Gagal simpan presensi:", err);
      setSaveProgress({
        phase: "error",
        label: `❌ ${err.message || "Terjadi kesalahan. Silakan coba lagi."}`,
        pct: 100,
        details: [],
        allSuccess: false,
      });
      setTimeout(() => setSaveProgress(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      {/* ===== OVERLAY PROGRESS SIMPAN SPREADSHEET ===== */}
      {saveProgress && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm pointer-events-auto">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header overlay */}
            <div
              className={`px-5 py-3 flex items-center gap-2 ${
                saveProgress.phase === "done"
                  ? "bg-emerald-600"
                  : saveProgress.phase === "error"
                    ? "bg-amber-500"
                    : "bg-teal-700"
              } text-white`}
            >
              {saveProgress.phase === "sending" && (
                <svg
                  className="animate-spin h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              )}
              {saveProgress.phase === "done" && (
                <span className="text-base shrink-0">✅</span>
              )}
              {saveProgress.phase === "error" && (
                <span className="text-base shrink-0">⚠️</span>
              )}
              <div className="font-bold text-sm leading-snug">
                {saveProgress.phase === "sending"
                  ? "Menyimpan ke Spreadsheet..."
                  : saveProgress.phase === "done"
                    ? "Penyimpanan Selesai"
                    : "Status Penyimpanan"}
              </div>
            </div>

            <div className="px-5 py-4 space-y-3">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {saveProgress.label}
                  </span>
                  <span className="text-[11px] font-black text-slate-700">
                    {saveProgress.pct}%
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      saveProgress.phase === "done"
                        ? "bg-emerald-500"
                        : saveProgress.phase === "error"
                          ? "bg-amber-400"
                          : "bg-teal-500"
                    }`}
                    style={{ width: `${saveProgress.pct}%` }}
                  />
                </div>
              </div>

              {/* Daftar detail per kelas */}
              {saveProgress.details && saveProgress.details.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {saveProgress.details.map((d, i) => (
                    <div
                      key={d.wId || i}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                        d.status === "ok"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : d.status === "error"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : d.status === "offline"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-50 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {/* Ikon status */}
                      <span className="shrink-0 text-sm">
                        {d.status === "ok" ? (
                          "✅"
                        ) : d.status === "error" ? (
                          "❌"
                        ) : d.status === "offline" ? (
                          "📱"
                        ) : (
                          <svg
                            className="animate-spin h-3.5 w-3.5 text-teal-500"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8z"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="truncate">{d.namaKelas}</span>
                      <span className="ml-auto shrink-0 text-[10px] opacity-70">
                        {d.status === "ok"
                          ? "Tersimpan"
                          : d.status === "error"
                            ? "Gagal"
                            : d.status === "offline"
                              ? "Antrian"
                              : "Mengirim..."}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer info */}
              {saveProgress.phase === "done" && (
                <p className="text-[10px] text-emerald-600 text-center font-medium">
                  Menutup otomatis dalam beberapa detik...
                </p>
              )}
              {saveProgress.phase === "error" && (
                <button
                  type="button"
                  onClick={() => setSaveProgress(null)}
                  className="w-full text-[11px] py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold transition-colors"
                >
                  Tutup
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* HEADER MODAL MINIMALIS */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-teal-400/20 text-teal-300 text-sm">
              📷
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black tracking-tight">
                  Scan Presensi Siswa
                </h3>
                {/* PEMILIH KELAS / SCAN PINTAR */}
                {Array.isArray(availableClasses) &&
                availableClasses.length > 1 ? (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowClassDropdown((v) => !v)}
                      className="inline-flex items-center gap-1 text-[9.5px] px-2 py-0.5 rounded-full bg-teal-400/25 hover:bg-teal-400/40 text-teal-100 font-black border border-teal-300/40 transition-all cursor-pointer shadow-2xs active:scale-95"
                      title="Pilih Kelas atau Mode Scan Pintar"
                    >
                      <span>
                        {isAllClassesMode
                          ? "🌟 Semua Kelas (Pintar)"
                          : `🏫 ${activeClass?.namaKelas || petugasInfo?.namaKelas || "Rombel"}`}
                      </span>
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
                            <p className="text-[10px] font-bold text-teal-300 uppercase tracking-wider px-2 py-1">
                              Mode Pemindaian
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedWaliId("ALL_CLASSES");
                                setShowClassDropdown(false);
                              }}
                              className={`w-full text-left px-2.5 py-2 rounded-lg font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                isAllClassesMode
                                  ? "bg-teal-600 text-white"
                                  : "hover:bg-slate-800 text-teal-100"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-base">🌟</span>
                                <div>
                                  <p className="text-xs font-black">
                                    Semua Kelas (Scan Pintar)
                                  </p>
                                  <p className="text-[9.5px] font-normal text-teal-200">
                                    Pindai otomatis kartu siswa dari kelas mana
                                    pun
                                  </p>
                                </div>
                              </div>
                              {isAllClassesMode && <span>✓</span>}
                            </button>
                          </div>

                          <div className="p-1">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1">
                              Pilih Per Kelas
                            </p>
                            {/* Kelas Asal Petugas */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedWaliId(petugasInfo?.idWali);
                                setShowClassDropdown(false);
                              }}
                              className={`w-full text-left px-2.5 py-1.5 rounded-lg font-bold flex items-center justify-between transition-colors cursor-pointer ${
                                !isAllClassesMode &&
                                String(selectedWaliId) ===
                                  String(petugasInfo?.idWali)
                                  ? "bg-emerald-600 text-white"
                                  : "hover:bg-slate-800 text-slate-200"
                              }`}
                            >
                              <div className="truncate">
                                <span className="mr-1.5">📌</span>
                                <span>
                                  {petugasInfo?.namaKelas || "Kelas Petugas"}
                                </span>
                                <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-200 border border-amber-300/30">
                                  Kelas Anda
                                </span>
                              </div>
                              {!isAllClassesMode &&
                                String(selectedWaliId) ===
                                  String(petugasInfo?.idWali) && <span>✓</span>}
                            </button>

                            {/* Kelas Lainnya */}
                            {availableClasses
                              .filter(
                                (c) =>
                                  String(c.idWali) !==
                                  String(petugasInfo?.idWali),
                              )
                              .map((c) => {
                                const isSelected =
                                  !isAllClassesMode &&
                                  String(selectedWaliId) === String(c.idWali);
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
                                    {isSelected && (
                                      <span className="font-bold">✓</span>
                                    )}
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
                    className="inline-flex items-center gap-1 text-[9.5px] px-2 py-0.5 rounded-full bg-teal-400/25 text-teal-100 font-black border border-teal-300/40 shadow-2xs"
                    title={`Khusus Kelas ${activeClass?.namaKelas || petugasInfo?.namaKelas || ""}`}
                  >
                    <span>
                      🏫{" "}
                      {activeClass?.namaKelas ||
                        petugasInfo?.namaKelas ||
                        "Kelas Petugas"}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-[9px] sm:text-[10px] text-teal-200 truncate">
                Pindai kartu barcode siswa • Buka 07.00 – 07.15 WIB
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

        {/* TAB NAVIGASI & SWITCH KE WAJAH / REGULER */}
        <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 sm:px-4 py-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("kamera")}
              className={`px-2.5 py-1 text-[11px] sm:text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === "kamera"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>📷</span>
              <span>Scanner</span>
              <span
                className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${
                  activeTab === "kamera"
                    ? "bg-white/25 text-white"
                    : "bg-teal-100 text-teal-800"
                }`}
              >
                {stats.hadir}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("daftar")}
              className={`px-2.5 py-1 text-[11px] sm:text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                activeTab === "daftar"
                  ? "bg-teal-700 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>📋</span>
              <span>Daftar</span>
              {stats.belumScan > 0 && (
                <span
                  className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${
                    activeTab === "daftar"
                      ? "bg-white/25 text-white"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {stats.belumScan}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            {typeof onOpenScanWajah === "function" && (
              <button
                type="button"
                onClick={() => {
                  stopScannerGracefully();
                  onOpenScanWajah();
                }}
                className="px-2 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-[10px] sm:text-[11px] border border-emerald-300 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                title="Beralih ke Pemindai Wajah"
              >
                <span>🧏</span>
                <span>Wajah</span>
              </button>
            )}

            {typeof onOpenReguler === "function" && (
              <button
                type="button"
                onClick={() => {
                  stopScannerGracefully();
                  onOpenReguler();
                }}
                className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[10px] sm:text-[11px] border border-amber-300 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                title="Beralih ke Presensi Reguler"
              >
                <span>📋</span>
                <span>Reguler</span>
              </button>
            )}
          </div>
        </div>

        {/* KONTEN BODY */}
        <div className="p-2.5 sm:p-4 overflow-y-auto space-y-2 sm:space-y-2.5 flex-1">
          {/* BANNER NOTIFIKASI BATAS WAKTU BARCODE */}
          {isLockedByTime ? (
            <div className="px-2.5 py-2 bg-rose-50 rounded-xl border border-rose-300 text-rose-950 text-[11px] shadow-xs space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 truncate">
                  <span>⛔</span>
                  <span className="font-bold text-rose-900 truncate">
                    Presensi barcode ditutup. Buka pukul 07.00 – 07.15 WIB.
                  </span>
                </div>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-200 text-rose-900 font-bold shrink-0">
                  Terkunci
                </span>
              </div>
              <p className="text-[10.5px] text-rose-800 leading-snug">
                Gunakan kode akses <b>.....</b> pada layar kamera di bawah jika
                ingin membuka akses seperti biasa.
              </p>
            </div>
          ) : (
            <div className="px-2.5 py-1.5 bg-gradient-to-r from-teal-50 to-emerald-50 rounded-lg border border-teal-200 text-teal-950 flex items-center justify-between text-[11px] shadow-2xs">
              <div className="flex items-center gap-1.5 truncate">
                <span>⏰</span>
                <span className="truncate">
                  Bisa simpan &amp; scan berulang s.d <strong>07.15 WIB</strong>
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white border border-teal-300 font-bold text-teal-800 shadow-2xs">
                  Batas: 07.15 WIB
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
          {activeTab === "kamera" && isLockedByTime && (
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-700 w-full h-[54vh] sm:h-[430px] min-h-[320px] max-h-[550px] flex flex-col items-center justify-center p-6 shadow-md text-white text-center space-y-3.5">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl shadow-inner animate-pulse">
                🔒
              </div>
              <div className="space-y-1">
                <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                  Presensi Barcode Ditutup
                </h3>
                <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                  Presensi Scan Barcode hanya dibuka pada pukul{" "}
                  <strong className="text-amber-300">07.00 – 07.15 WIB</strong>.
                </p>
              </div>

              <div className="w-full max-w-xs pt-1 space-y-2">
                <div className="text-[11px] text-slate-400 font-medium text-left"></div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    value={unlockCodeInput}
                    onChange={(e) => {
                      setUnlockCodeInput(e.target.value);
                      if (unlockError) setUnlockError("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUnlockWithCode();
                    }}
                    placeholder="Masukkan kode ..."
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 text-xs font-mono text-center tracking-widest focus:outline-hidden focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleUnlockWithCode}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md shrink-0 flex items-center gap-1"
                  >
                    <span>🔓</span>
                    <span>Buka</span>
                  </button>
                </div>
                {unlockError && (
                  <div className="text-[11px] text-rose-400 font-semibold animate-in fade-in">
                    ⚠️ {unlockError}
                  </div>
                )}
              </div>
            </div>
          )}

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
                      Scan Pertama Terkunci • Bisa Simpan Berulang s.d 07.15
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

                {/* OVERLAY NOTIFIKASI BESAR DI TENGAH LAYAR SCAN */}
                {scanOverlay && (
                  <div
                    className="absolute inset-0 flex items-center justify-center z-20 px-4 cursor-pointer"
                    style={{ animation: "fadeInScale 0.18s ease-out" }}
                    onClick={() => setScanOverlay(null)}
                  >
                    <style
                      dangerouslySetInnerHTML={{
                        __html: `
                      @keyframes fadeInScale {
                        from { opacity: 0; transform: scale(0.82); }
                        to   { opacity: 1; transform: scale(1); }
                      }
                      @keyframes overlayPulse {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); }
                        50%       { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
                      }
                    `,
                      }}
                    />
                    <div
                      className={`w-full max-w-xs rounded-2xl px-5 py-5 flex flex-col items-center gap-2 text-center shadow-2xl border-2 backdrop-blur-md ${
                        scanOverlay.type === "success"
                          ? "bg-emerald-950/92 border-emerald-400 text-white"
                          : scanOverlay.type === "duplicate"
                            ? "bg-blue-950/92 border-blue-400 text-white"
                            : "bg-rose-950/92 border-rose-400 text-white"
                      }`}
                      style={
                        scanOverlay.type === "success"
                          ? { animation: "overlayPulse 0.8s ease-out 1" }
                          : {}
                      }
                    >
                      {/* Ikon status */}
                      <div
                        className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-lg border-2 ${
                          scanOverlay.type === "success"
                            ? "bg-emerald-500 border-emerald-300"
                            : scanOverlay.type === "duplicate"
                              ? "bg-blue-500 border-blue-300"
                              : "bg-rose-500 border-rose-300"
                        }`}
                      >
                        {scanOverlay.type === "success"
                          ? "✅"
                          : scanOverlay.type === "duplicate"
                            ? "ℹ️"
                            : "⚠️"}
                      </div>

                      {/* Label status */}
                      <div
                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full ${
                          scanOverlay.type === "success"
                            ? "bg-emerald-500/40 text-emerald-200"
                            : scanOverlay.type === "duplicate"
                              ? "bg-blue-500/40 text-blue-200"
                              : "bg-rose-500/40 text-rose-200"
                        }`}
                      >
                        {scanOverlay.type === "success"
                          ? "Hadir Tercatat"
                          : scanOverlay.type === "duplicate"
                            ? "Sudah Discan"
                            : "Tidak Dikenal"}
                      </div>

                      {/* Nama siswa (besar & jelas) */}
                      {scanOverlay.nama && (
                        <div className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-white drop-shadow-md">
                          {scanOverlay.nama}
                        </div>
                      )}

                      {/* Keterangan / pesan */}
                      <div
                        className={`text-sm font-bold leading-snug ${
                          scanOverlay.type === "success"
                            ? "text-emerald-200"
                            : scanOverlay.type === "duplicate"
                              ? "text-blue-200"
                              : "text-rose-200"
                        }`}
                      >
                        {scanOverlay.pesan}
                      </div>

                      {/* Jam tampil besar untuk sukses */}
                      {scanOverlay.type === "success" && (
                        <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-300 tracking-wide drop-shadow-lg">
                          {scanOverlay.waktu} WIB
                        </div>
                      )}
                    </div>
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
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{s.nama}</span>
                              {s.kelas && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200 font-normal">
                                  {s.kelas}
                                </span>
                              )}
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
                          {s.kelas && (
                            <span className="ml-1.5 text-[9px] px-1 py-0.2 rounded bg-emerald-100 text-emerald-800 font-normal">
                              {s.kelas}
                            </span>
                          )}
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
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex flex-col gap-2 shrink-0">
          {/* Indikator status simpan offline */}
          {(pendingOfflineRecords.length > 0 || lastOnlineSaveTime) && (
            <div className="flex items-center justify-between gap-2 text-[10px]">
              {pendingOfflineRecords.length > 0 ? (
                <span className="flex items-center gap-1 text-amber-700 font-bold bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                  <span>📱</span>
                  <span>
                    {pendingOfflineRecords.length} data hari lalu belum terkirim
                  </span>
                </span>
              ) : (
                <span />
              )}
              {lastOnlineSaveTime && (
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <span>☁️</span>
                  <span className="truncate max-w-[180px]">
                    {formatLastSavedIndo(lastOnlineSaveTime)}
                  </span>
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
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
                      ? "Perbarui Presensi Kelas (s.d 07.15)"
                      : "Kirim Presensi Kelas (s.d 07.15)"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
