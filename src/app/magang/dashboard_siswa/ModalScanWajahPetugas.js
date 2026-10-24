"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  getPresensiWaliGrid,
  savePresensiWaliKelas,
  getBiodataSiswa,
  getWajahBulk,
} from "../lib/api";
import {
  MATCH_DIST,
  LOOSE_DIST,
  MARGIN_MIN,
  VOTES_NEEDED,
  VOTE_WINDOW_MS,
  MIN_FACE_RATIO,
  MAX_YAW,
  MAX_ROLL_DEG,
  DETECT_INTERVAL_MS,
  DESC_INTERVAL_MS,
  SCAN_COOLDOWN_MS,
  loadFaceApi,
  resetFaceApiPromise,
  euclid,
  matchFace,
  isConfident,
  pushVote,
  mapBoxToContainer,
  headPose,
  isSameFaceUrl,
  readCachedDescriptor,
  writeCachedDescriptor,
  loadFaceImage,
  computeTemplate,
  updateHeadTurnTracker,
  keepLiveness,
  headTurnHint,
  headTurnStep,
  MAX_CHALLENGE_YAW,
  IDENT_WINDOW_MS,
  IDENT_LOCK_TTL_MS,
  IDENT_LATE_LOCK_MS,
} from "../lib/faceApiHelper";

// =====================================================================
// KONFIGURASI PRESENSI
// =====================================================================
// KONFIGURASI BATAS WAKTU PRESENSI
// =====================================================================
// Batas resmi presensi scan wajah adalah dibuka pukul 06:30 WIB dan ditutup pukul 08:00 WIB.
const WAJAH_OPEN_H = 6;
const WAJAH_OPEN_M = 30; // 06:30 WIB
const WAJAH_CLOSE_H = 8;
const WAJAH_CLOSE_M = 0; // 08:00 WIB

// Kode akses hanya berlaku untuk HARI INI di perangkat ini (tidak permanen)
function localDateKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function isBypassActiveToday(...names) {
  try {
    const t = localDateKey();
    return names.some((n) => localStorage.getItem(n) === t);
  } catch (_) {
    return false;
  }
}

function checkIsPastTimeLimit() {
  try {
    if (typeof window !== "undefined") {
      if (
        isBypassActiveToday("portal_bypass_wajah_time", "portal_bypass_time_limit")
      ) {
        return false;
      }
    }
  } catch (_) {}

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentTotal = hours * 60 + minutes;
  const openTotal = WAJAH_OPEN_H * 60 + WAJAH_OPEN_M; // 390 (06:30 WIB)
  const closeTotal = WAJAH_CLOSE_H * 60 + WAJAH_CLOSE_M; // 480 (08:00 WIB)

  // Buka tepat jam 06:30 sampai 08:00 WIB
  const isOpen = currentTotal >= openTotal && currentTotal < closeTotal;
  return !isOpen;
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ]);
}

// Satu AudioContext dipakai ulang (membuat baru tiap bunyi = kebocoran memori)
let audioCtx = null;
function playBeepSuccess() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.12);
  } catch (_) {}
}

// Cache in-memory data siswa rombel & penanda: URL foto sudah divalidasi ke server
// pada sesi halaman ini (agar tidak memanggil server berulang tiap modal dibuka)
const MEMORY_SISWA_CACHE = {};
const SESSION_URL_CHECKED = {};

// Format tanggal, hari, dan jam bahasa Indonesia (misal: "Jumat, 16 Okt 2026 • 07:45 WIB")
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

// Jalankan satu per satu (GAS tanpa LockService rawan tabrakan bila banyak request menulis sekaligus)
async function runSerial(items, fn) {
  const out = [];
  for (let i = 0; i < items.length; i++) out.push(await fn(items[i], i));
  return out;
}

export default function ModalScanWajahPetugas({
  isOpen,
  onClose,
  petugasInfo, // { idWali, idGuru, namaKelas, kelas }
  availableClasses = [],
  user, // { id, nama }
  onPresensiSubmitted,
  onOpenBarcode,
  onOpenReguler,
}) {
  const [selectedWaliId, setSelectedWaliId] = useState(petugasInfo?.idWali);
  const [showClassDropdown, setShowClassDropdown] = useState(false);

  useEffect(() => {
    if (isOpen && petugasInfo?.idWali && !selectedWaliId) {
      setSelectedWaliId(petugasInfo.idWali);
    }
  }, [isOpen, petugasInfo?.idWali]);

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

  // Kunci stabil daftar kelas: efek tidak berjalan ulang hanya karena array baru dengan isi sama
  const classesKey = useMemo(
    () =>
      (availableClasses || [])
        .map((c) => `${c.idWali}:${(c.daftarSiswa || []).length}`)
        .join("|"),
    [availableClasses],
  );
  const allModeRef = useRef(false);
  allModeRef.current = isAllClassesMode;

  const [loadingData, setLoadingData] = useState(true);
  const [syncingFaces, setSyncingFaces] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment"); // "environment" (belakang) | "user" (depan)
  const [cameraError, setCameraError] = useState("");
  const [engineStatus, setEngineStatus] = useState("loading"); // loading | ready | fallback
  const [siswaList, setSiswaList] = useState([]);
  const [registeredFaceCount, setRegisteredFaceCount] = useState(0);
  const [templateInfo, setTemplateInfo] = useState({
    total: 0,
    ready: 0,
    pending: 0,
    failed: [],
  });
  const [engineNonce, setEngineNonce] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLine, setDebugLine] = useState("");

  // Status visual deteksi wajah di layar kamera (Live HUD)
  const [liveFaceBoxes, setLiveFaceBoxes] = useState([]); // array of { leftPct, topPct, widthPct, heightPct, label, status }
  const multiCooldownRef = useRef({}); // cooldown scan multi-wajah { [idSiswa]: timestamp }
  const multiTrackedFacesRef = useRef([]); // pelacakan spasial multi-wajah { cx, cy, label, status, sid, lastSeen }
  const [liveFaceStatus, setLiveFaceStatus] = useState(
    "Arahkan wajah ke dalam zona pemindaian...",
  );
  const [challengeStep, setChallengeStep] = useState(-1); // indikator langkah toleh (-1 = sembunyi)
  const [scanZoneState, setScanZoneState] = useState("standby"); // standby | adjust | multiple | moving | verifying | success

  // Loading bar bertingkat di tengah layar untuk sinkron harian pertama kali
  const [syncModalProgress, setSyncModalProgress] = useState(null);
  // { show: boolean, stage: number, totalStages: number, pct: number, title: string, desc: string, detail: string }

  // Dialog pilihan konfirmasi sinkron ulang bagi yang sudah pernah menggunakan
  const [syncPromptOpen, setSyncPromptOpen] = useState(false);

  // Hasil sinkron cepat — ditampilkan sebagai toast ringkas setelah selesai
  const [syncResultInfo, setSyncResultInfo] = useState(null);
  // { newCount: number, unchangedCount: number, durationMs: number }
  const syncResultTimerRef = useRef(null);

  // Dropdown tombol sinkron (Cepat / Ulang)
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const syncMenuRef = useRef(null);

  // Status sinkronisasi online & akumulasi offline multi-hari
  const [lastOnlineSaveTime, setLastOnlineSaveTime] = useState("");
  const [pendingOfflineRecords, setPendingOfflineRecords] = useState([]);

  // Status scan: { [idSiswa]: { status: "Hadir", waktuScan: "07:15:23", timestamp } }
  const [scannedMap, setScannedMap] = useState({});
  const [manualStatusMap, setManualStatusMap] = useState({});
  const [manualKetMap, setManualKetMap] = useState({});

  // Overlay notifikasi hasil scan di tengah layar
  const [scanOverlay, setScanOverlay] = useState(null); // { type, nama, waktu, pesan }
  const scanOverlayTimerRef = useRef(null);

  // Status proses simpan
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null);
  const [isLockedByTime, setIsLockedByTime] = useState(false);
  const [isSubmittedToday, setIsSubmittedToday] = useState(false);
  const [hasPreviousSubmission, setHasPreviousSubmission] = useState(false);
  const [activeTab, setActiveTab] = useState("kamera"); // "kamera" | "daftar"

  // Input kode 1230 untuk buka akses jika di luar jam
  const [unlockCodeInput, setUnlockCodeInput] = useState("");
  const [unlockError, setUnlockError] = useState("");

  function handleUnlockWajahWithCode() {
    if (unlockCodeInput.trim() === "1230") {
      try {
        localStorage.setItem("portal_bypass_wajah_time", localDateKey());
        localStorage.setItem("portal_bypass_time_limit", localDateKey());
      } catch (_) {}
      timeLockedRef.current = false;
      setIsLockedByTime(false);
      setIsSubmittedToday(false);
      setUnlockError("");
      setUnlockCodeInput("");
      if (activeTab === "kamera") {
        setTimeout(() => {
          try {
            startCamera();
          } catch (_) {}
        }, 150);
      }
    } else {
      setUnlockError("Kode akses salah! Masukkan kode untuk membuka.");
    }
  }

  // Fitur Verifikasi Cepat (Hanya Tahap 1 & 3 Tanpa Toleh dengan Kode 1230)
  const [isFastVerify, setIsFastVerify] = useState(false);
  const isFastVerifyRef = useRef(false);
  const [showFastVerifyModal, setShowFastVerifyModal] = useState(false);
  const [fastVerifyCodeInput, setFastVerifyCodeInput] = useState("");
  const [fastVerifyError, setFastVerifyError] = useState("");

  useEffect(() => {
    isFastVerifyRef.current = isFastVerify;
  }, [isFastVerify]);

  // Verifikasi Cepat tidak boleh "tertinggal menyala" saat modal ditutup lalu dibuka lagi
  useEffect(() => {
    if (!isOpen) setIsFastVerify(false);
  }, [isOpen]);

  function handleToggleFastVerify() {
    if (isFastVerify) {
      setIsFastVerify(false);
    } else {
      setFastVerifyCodeInput("");
      setFastVerifyError("");
      setShowFastVerifyModal(true);
    }
  }

  function handleConfirmFastVerifyCode() {
    if (fastVerifyCodeInput.trim() === "1230") {
      setIsFastVerify(true);
      setShowFastVerifyModal(false);
      setFastVerifyCodeInput("");
      setFastVerifyError("");
    } else {
      setFastVerifyError(
        "Kode salah! Masukkan kode 1230 untuk mengaktifkan Verifikasi Cepat.",
      );
    }
  }

  // Ref untuk kamera & pengenalan wajah
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const camSessionRef = useRef(0); // token sesi kamera: cegah stream bocor/balapan
  const faRef = useRef(null); // modul face-api (setelah termuat)
  const engineStatusRef = useRef("loading");
  const scannedMapRef = useRef(scannedMap);
  const studentProfilesRef = useRef([]); // [{ idSiswa, nama, fotoWajah, descriptor, status }]
  const templateJobRef = useRef(0); // pembatalan pekerjaan penyiapan template lama
  const lastSuccessScanAt = useRef(0);
  const recognizedRef = useRef(() => {});
  const showDebugRef = useRef(false);

  // Status pemuatan profil foto wajah kelas: "loading_data" | "reading_photos" | "computing_templates" | "ready"
  const [profileLoadingState, setProfileLoadingState] =
    useState("loading_data");
  const profileLoadingStateRef = useRef("loading_data");

  function updateProfileLoadingState(st) {
    profileLoadingStateRef.current = st;
    setProfileLoadingState(st);
  }

  function setEngine(s) {
    engineStatusRef.current = s;
    setEngineStatus(s);
  }

  useEffect(() => {
    scannedMapRef.current = scannedMap;
  }, [scannedMap]);

  // Auto-dismiss overlay hasil scan
  useEffect(() => {
    if (!scanOverlay) return;
    if (scanOverlayTimerRef.current) clearTimeout(scanOverlayTimerRef.current);
    scanOverlayTimerRef.current = setTimeout(
      () => setScanOverlay(null),
      scanOverlay.type === "success" ? 2800 : 3500,
    );
    return () => {
      if (scanOverlayTimerRef.current)
        clearTimeout(scanOverlayTimerRef.current);
    };
  }, [scanOverlay]);

  // Tanggal dihitung ulang setiap modal dibuka (halaman bisa dibiarkan terbuka semalaman)
  const todayISO = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Pergantian hari: buang sisa data kemarin agar scan hari ini tidak ditolak "sudah hadir"
  const dayRef = useRef(null);
  const timeLockedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) return;
    if (dayRef.current !== null && dayRef.current !== todayISO) {
      setScannedMap({});
      setManualStatusMap({});
      setManualKetMap({});
      setIsSubmittedToday(false);
      setHasPreviousSubmission(false);
      timeLockedRef.current = false;
    }
    dayRef.current = todayISO;
  }, [isOpen, todayISO]);

  // Pantau batas waktu operasional wajah (06:30 – 08:00 WIB) secara berkala.
  // Kunci "sudah submit" karena jam HANYA dicabut lagi bila memang dipasang oleh batas jam
  // (mis. modal dibuka sebelum jam buka, lalu jam buka tiba).
  useEffect(() => {
    if (!isOpen) return;
    const check = () => {
      const past = checkIsPastTimeLimit();
      setIsLockedByTime(past);
      if (past) {
        setIsSubmittedToday((prev) => {
          if (!prev) timeLockedRef.current = true;
          return true;
        });
      } else if (timeLockedRef.current) {
        timeLockedRef.current = false;
        setIsSubmittedToday(false);
      }
    };
    check();
    const timer = setInterval(check, 15000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // 1. MUAT DATA SISWA & PROFIL FOTO WAJAH DARI SPREADSHEET (PARALEL CEPAT)
  useEffect(() => {
    if (!isOpen || !petugasInfo?.idWali || !petugasInfo?.idGuru) return;

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

      // Siapkan profil wajah seluruh siswa dari cache
      loadStudentFaceProfilesParallel(combinedSiswa, false);
      return;
    }

    // B. MODE PER KELAS TERTENTU
    const waliId = activeClass?.idWali || petugasInfo?.idWali;
    const guruId = activeClass?.idGuru || petugasInfo?.idGuru;
    if (!waliId || !guruId) return;

    const storageKeySiswa = `cache_scan_siswa_${waliId}`;

    // Baca draft scan lokal untuk hari ini
    const draftKey = `draft_scan_${waliId}_${todayISO}`;
    let localDraft = {};
    try {
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === "object") localDraft = parsed;
      }
    } catch (_) {}
    if (Object.keys(localDraft).length > 0) {
      setScannedMap((prev) => ({ ...localDraft, ...prev }));
    }

    async function initClassData() {
      const pastLimit = checkIsPastTimeLimit();
      setIsLockedByTime(pastLimit);

      // 1. OFFLINE-FIRST: Ambil data rombel siswa dari cache lokal segera
      let localSiswa = MEMORY_SISWA_CACHE[waliId] || null;
      if (!localSiswa) {
        try {
          const raw = localStorage.getItem(storageKeySiswa);
          if (raw) localSiswa = JSON.parse(raw);
        } catch (_) {}
      }

      if (
        (!localSiswa || localSiswa.length === 0) &&
        Array.isArray(activeClass?.daftarSiswa) &&
        activeClass.daftarSiswa.length > 0
      ) {
        localSiswa = activeClass.daftarSiswa
          .map((s) => ({
            idSiswa: String(s.idSiswa || s.id || "").trim(),
            nama: (s.nama || s.namaSiswa || "").trim(),
            kelas: s.kelas || activeClass.namaKelas || "",
            idWali: waliId,
            idGuru: guruId,
          }))
          .filter((s) => s.idSiswa);
      }

      // Muat waktu simpan online terakhir jika ada
      try {
        const lastSaved = localStorage.getItem(`last_online_save_${waliId}`);
        if (lastSaved) setLastOnlineSaveTime(lastSaved);
      } catch (_) {}

      // Muat antrian offline multi-hari
      const offlineQueue = getOfflineQueue(waliId);
      // Catatan presensi hari lampau yang belum terkirim online
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

      // Status sinkronisasi awal & batasan notif pilihan hanya 1 kali sehari (saat pertama buka)
      let hasEverSynced = false;
      try {
        hasEverSynced =
          localStorage.getItem(`face_sync_completed_${waliId}`) === "true";
      } catch (_) {}

      const promptKey = `face_sync_prompt_date_${waliId}`;
      let lastPromptDate = null;
      try {
        lastPromptDate = localStorage.getItem(promptKey);
      } catch (_) {}
      const isFirstOpenToday = lastPromptDate !== todayISO;

      // Jika data lokal sudah ada, gunakan LANGSUNG agar kamera siap seketika (meskipun offline)
      if (Array.isArray(localSiswa) && localSiswa.length > 0) {
        setSiswaList(localSiswa);
        setScannedMap((prev) => ({
          ...localDraft,
          ...todayOfflineScan,
          ...prev,
        }));
        setManualStatusMap((prev) => ({
          ...todayOfflineManual,
          ...prev,
        }));
        setLoadingData(false);
        // Langsung siapkan profil wajah secara offline
        loadStudentFaceProfilesParallel(localSiswa, false);

        // Jika sudah pernah sinkron dan baru pertama buka hari ini: munculkan dialog pilihan (1x sehari)
        if (hasEverSynced && isFirstOpenToday) {
          setSyncPromptOpen(true);
          try {
            localStorage.setItem(promptKey, todayISO);
          } catch (_) {}
        }
      } else {
        setLoadingData(true);
        updateProfileLoadingState("loading_data");
      }

      // 2. Cobalah sinkronisasi data terbaru dari server jika online
      try {
        const res = await getPresensiWaliGrid(guruId, waliId);
        if (!isMounted) return;

        if (res && res.success) {
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

          setSiswaList(normalizedSiswa);
          MEMORY_SISWA_CACHE[waliId] = normalizedSiswa;
          try {
            localStorage.setItem(
              storageKeySiswa,
              JSON.stringify(normalizedSiswa),
            );
          } catch (_) {}

          // Sinkronisasi data presensi yang sudah tersimpan di server hari ini
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

          setScannedMap((prev) => ({
            ...existingScanMap,
            ...localDraft,
            ...todayOfflineScan,
            ...prev,
          }));
          setManualStatusMap((prev) => ({
            ...existingManualMap,
            ...todayOfflineManual,
            ...prev,
          }));
          setManualKetMap((prev) => ({ ...existingKetMap, ...prev }));

          // Jika petugas baru pertama kali menggunakan -> auto sinkronisasi penuh
          const idsOf = (arr) =>
            (arr || [])
              .map((s) => s.idSiswa)
              .sort()
              .join("|");
          const rosterChanged =
            Array.isArray(localSiswa) &&
            localSiswa.length > 0 &&
            idsOf(localSiswa) !== idsOf(normalizedSiswa);

          if (!hasEverSynced) {
            loadStudentFaceProfilesParallel(normalizedSiswa, true);
          } else if (rosterChanged) {
            loadStudentFaceProfilesParallel(normalizedSiswa, true);
          } else if (!localSiswa || localSiswa.length === 0) {
            loadStudentFaceProfilesParallel(normalizedSiswa, false);
            if (isFirstOpenToday) {
              setSyncPromptOpen(true);
              try {
                localStorage.setItem(promptKey, todayISO);
              } catch (_) {}
            }
          }
        }
      } catch (netErr) {
        console.warn(
          "Koneksi offline atau server tidak terjangkau, menggunakan data cache lokal:",
          netErr,
        );
        if ((!localSiswa || localSiswa.length === 0) && isMounted) {
          setCameraError(
            "Jaringan terputus dan data rombel belum tersimpan di perangkat ini. Hubungkan internet untuk sinkronisasi awal.",
          );
        }
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }

    initClassData();

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

  // Ringkasan status template (untuk header & peringatan di layar)
  function syncTemplateInfo(profiles) {
    const reg = profiles.filter((p) => p.fotoWajah);
    setTemplateInfo({
      total: reg.length,
      ready: reg.filter((p) => p.descriptor).length,
      pending: reg.filter((p) => p.status === "pending").length,
      failed: reg
        .filter((p) => p.status === "noface" || p.status === "error")
        .map((p) => ({
          nama: p.nama,
          kelas: p.kelas || activeClass?.namaKelas || "",
          reason: p.status,
        })),
    });
  }

  // Siapkan profil wajah: URL foto -> template (deskriptor 128-d).
  // 1) Pakai URL dari cache agar scan bisa langsung jalan.
  // 2) Validasi URL ke server (sekali per sesi halaman / saat "Sinkron Wajah");
  //    jika ada yang berubah (siswa daftar ulang) profil dibangun ulang.
  async function loadStudentFaceProfilesParallel(
    siswaArray,
    forceRefresh = false,
  ) {
    if (forceRefresh) {
      setSyncingFaces(true);
      if (engineStatusRef.current === "fallback") {
        resetFaceApiPromise();
        setEngineNonce((n) => n + 1);
      }
    }
    const effectiveWaliId = isAllClassesMode
      ? "ALL_CLASSES"
      : selectedWaliId ||
        activeClass?.idWali ||
        petugasInfo?.idWali ||
        "unknown";
    const localCacheKey = `cached_face_urls_${effectiveWaliId}`;

    try {
      let urlCache = {};
      try {
        const saved = localStorage.getItem(localCacheKey);
        if (saved) urlCache = JSON.parse(saved) || {};
      } catch (_) {}

      let globalCache = {};
      try {
        const savedG = localStorage.getItem("portal_sekolah_known_face_urls");
        if (savedG) globalCache = JSON.parse(savedG) || {};
      } catch (_) {}

      // Cache rombel per-wali untuk siswa yang berasal dari kelas lain
      const waliCaches = {};

      // --- URL awal dari cache lokal ---
      const urlsA = {};
      siswaArray.forEach((s) => {
        const sid = String(s.idSiswa).trim();
        let u = urlCache[sid] || globalCache[sid] || null;
        if (!u && s.idWali) {
          if (!waliCaches[s.idWali]) {
            try {
              const rawW = localStorage.getItem(`cached_face_urls_${s.idWali}`);
              waliCaches[s.idWali] = rawW ? JSON.parse(rawW) : {};
            } catch (_) {
              waliCaches[s.idWali] = {};
            }
          }
          u = waliCaches[s.idWali]?.[sid] || null;
        }
        if (!u) {
          try {
            const saved = localStorage.getItem(`face_reg_${sid}`);
            if (saved) u = JSON.parse(saved)?.fotoWajah || null;
          } catch (_) {}
        }
        if (u && u !== "NO_PHOTO") urlsA[sid] = u;
      });

      const applyProfiles = async (urlMap, isSyncingWithModal = false) => {
        const jobId = ++templateJobRef.current;
        const profiles = siswaArray.map((s) => {
          const sid = String(s.idSiswa).trim();
          const rawUrl = urlMap[sid] || null;
          const url = rawUrl && rawUrl !== "NO_PHOTO" ? rawUrl : null;
          const cached = url ? readCachedDescriptor(sid, url) : null;
          const isDesc = cached instanceof Float32Array;
          // Saat forceRefresh, buang kegagalan lama agar bisa dianalisis ulang dengan deteksi adaptif
          const status = !url
            ? "nophoto"
            : isDesc
            ? "ok"
            : !forceRefresh && (cached?.status === "noface" || cached?.status === "error")
            ? cached.status
            : "pending";
          return {
            idSiswa: sid,
            nama: s.nama,
            kelas: s.kelas || "",
            idWali: s.idWali || activeClass?.idWali,
            idGuru: s.idGuru || activeClass?.idGuru,
            fotoWajah: url,
            descriptor: isDesc ? cached : null,
            status,
          };
        });
        studentProfilesRef.current = profiles;
        setRegisteredFaceCount(profiles.filter((p) => p.fotoWajah).length);
        syncTemplateInfo(profiles);

        const pending = profiles.filter((p) => p.status === "pending");
        if (pending.length === 0) {
          if (isSyncingWithModal) {
            setSyncModalProgress({
              show: true,
              stage: 3,
              totalStages: 3,
              pct: 100,
              title: "✅ Data Wajah Siswa Siap!",
              desc: "Seluruh foto dan template biometrik wajah telah tersinkronisasi.",
              detail: `${profiles.filter((p) => p.descriptor).length} siswa siap presensi`,
            });
            setTimeout(() => setSyncModalProgress(null), 600);
          }
          updateProfileLoadingState("ready");
          return;
        }

        updateProfileLoadingState("computing_templates");

        if (isSyncingWithModal) {
          setSyncModalProgress({
            show: true,
            stage: 2,
            totalStages: 3,
            pct: 50,
            title: "Menyiapkan Kecerdasan Buatan (AI)",
            desc: "Memuat modul neural recognition & biometrik...",
            detail: "Mempersiapkan modul AI wajah",
          });
        }

        let fa;
        try {
          fa = await loadFaceApi();
        } catch (_) {
          if (isSyncingWithModal) setSyncModalProgress(null);
          pending.forEach((p) => {
            if (p.status === "pending") p.status = "error";
          });
          syncTemplateInfo(profiles);
          updateProfileLoadingState("ready");
          return; // status engine "fallback" ditangani efek pemuat model
        }

        let computedCount = 0;
        const BATCH_SIZE = 4;
        for (let i = 0; i < pending.length; i += BATCH_SIZE) {
          if (jobId !== templateJobRef.current) return;
          const chunk = pending.slice(i, i + BATCH_SIZE);
          await Promise.all(
            chunk.map(async (p) => {
              try {
                const res = await computeTemplate(fa, p.fotoWajah);
                if (res && res.descriptor) {
                  p.descriptor = res.descriptor;
                  p.status = "ok";
                  writeCachedDescriptor(p.idSiswa, p.fotoWajah, res.descriptor);
                } else {
                  p.status = "noface";
                  writeCachedDescriptor(p.idSiswa, p.fotoWajah, "NO_FACE");
                }
              } catch (e) {
                console.warn("Template wajah gagal:", p.nama, e);
                const isOffline =
                  e?.message === "OFFLINE_NETWORK_UNAVAILABLE" ||
                  (typeof navigator !== "undefined" && !navigator.onLine);
                p.status = isOffline ? "offline_pending" : "error";
                if (!isOffline) {
                  writeCachedDescriptor(p.idSiswa, p.fotoWajah, "ERROR");
                }
              }
              computedCount++;
            }),
          );
          if (jobId === templateJobRef.current) syncTemplateInfo(profiles);

          if (isSyncingWithModal) {
            const stage3Pct =
              55 + Math.round((Math.min(computedCount, pending.length) / pending.length) * 42); // 55% -> 97%
            setSyncModalProgress({
              show: true,
              stage: 3,
              totalStages: 3,
              pct: stage3Pct,
              title: "Membangun Template Biometrik",
              desc: "Mengekstrak ciri khas wajah 128-d untuk identifikasi akurat...",
              detail: `${Math.min(computedCount, pending.length)} dari ${pending.length} template siswa diproses`,
            });
          }
        }

        pending.forEach((p) => {
          if (p.status === "pending") {
            const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
            p.status = isOffline ? "offline_pending" : "error";
          }
        });
        if (jobId === templateJobRef.current) {
          syncTemplateInfo(profiles);
          updateProfileLoadingState("ready");
        }

        if (isSyncingWithModal) {
          setSyncModalProgress({
            show: true,
            stage: 3,
            totalStages: 3,
            pct: 100,
            title: "✅ Data Wajah Siswa Siap!",
            desc: "Seluruh foto dan template biometrik wajah berhasil disinkronkan.",
            detail: "Kamera pemindai siap digunakan",
          });
          setTimeout(() => setSyncModalProgress(null), 600);
        }
      };

      // Jalankan awal (tanpa menunggu selesai agar validasi server paralel)
      const firstRun = applyProfiles(urlsA, false);

      // --- Validasi URL ke server ---
      const hasEverSyncedKey = `face_sync_completed_${effectiveWaliId}`;
      let hasEverSynced = false;
      try {
        hasEverSynced = localStorage.getItem(hasEverSyncedKey) === "true";
      } catch (_) {}

      const lastSyncKey = `face_last_sync_date_${effectiveWaliId}`;
      const isOnlineNow =
        typeof navigator === "undefined" || navigator.onLine !== false;
      if (forceRefresh && !isOnlineNow) {
        alert(
          "📴 Tidak ada koneksi internet. Sinkron wajah dibatalkan, kamera memakai data yang sudah tersimpan di perangkat.",
        );
      }

      // Periksa apakah ada siswa yang belum diketahui status fotonya
      const unknownStudents = siswaArray.filter((s) => {
        const sid = String(s.idSiswa).trim();
        if (urlsA[sid]) return false;
        if (
          !forceRefresh &&
          (urlCache[sid] === "NO_PHOTO" || globalCache[sid] === "NO_PHOTO")
        ) {
          return false;
        }
        return true;
      });

      const mustCheck =
        isOnlineNow &&
        (forceRefresh ||
          (!hasEverSynced && !SESSION_URL_CHECKED[effectiveWaliId]) ||
          unknownStudents.length > 0);

      if (mustCheck) {
        updateProfileLoadingState("reading_photos");
        const studentsToFetch = forceRefresh ? siswaArray : unknownStudents;

        setSyncModalProgress({
          show: true,
          stage: 1,
          totalStages: 3,
          pct: 20,
          title: isAllClassesMode
            ? "Sinkronisasi Foto Wajah (Semua Kelas)"
            : "Sinkronisasi Foto Wajah Siswa",
          desc: "Memeriksa pembaruan foto wajah siswa dari database server...",
          detail: `Memeriksa ${studentsToFetch.length} data siswa`,
        });

        const urlsB = { ...urlsA };
        let allOk = true;

        // Ambil SEMUA foto wajah sekaligus dalam 1 panggilan bulk yang cepat
        let bulkMap = null;
        try {
          const bulk = await getWajahBulk(
            studentsToFetch.map((s) => String(s.idSiswa).trim()),
          );
          if (
            bulk &&
            bulk.success &&
            bulk.data &&
            typeof bulk.data === "object"
          ) {
            bulkMap = bulk.data;
          }
        } catch (_) {}

        if (bulkMap) {
          studentsToFetch.forEach((s) => {
            const sid = String(s.idSiswa).trim();
            const foto = String(bulkMap[sid] || "").trim();
            if (foto) {
              urlsB[sid] = foto;
              urlCache[sid] = foto;
              globalCache[sid] = foto;
              if (s.idWali) {
                try {
                  const rawW = localStorage.getItem(`cached_face_urls_${s.idWali}`);
                  const wObj = rawW ? JSON.parse(rawW) : {};
                  wObj[sid] = foto;
                  localStorage.setItem(`cached_face_urls_${s.idWali}`, JSON.stringify(wObj));
                } catch (_) {}
              }
            } else {
              urlCache[sid] = "NO_PHOTO";
              globalCache[sid] = "NO_PHOTO";
            }
          });
        } else {
          allOk = false;
          studentsToFetch.forEach((s) => {
            const sid = String(s.idSiswa).trim();
            if (urlsA[sid]) urlsB[sid] = urlsA[sid];
          });
        }

        setSyncModalProgress({
          show: true,
          stage: 1,
          totalStages: 3,
          pct: 45,
          title: isAllClassesMode
            ? "Foto Wajah Siap (Semua Kelas)"
            : "Foto Wajah Siswa Siap",
          desc: "Daftar foto wajah berhasil diverifikasi dari server.",
          detail: `${studentsToFetch.length} siswa siap diproses`,
        });

        try {
          localStorage.setItem(localCacheKey, JSON.stringify(urlCache));
          localStorage.setItem(
            "portal_sekolah_known_face_urls",
            JSON.stringify(globalCache),
          );
        } catch (_) {}

        if (allOk) {
          SESSION_URL_CHECKED[effectiveWaliId] = true;
          try {
            localStorage.setItem(hasEverSyncedKey, "true");
            localStorage.setItem(lastSyncKey, todayISO);
          } catch (_) {}
        }

        const changed = siswaArray.some(
          (s) => (urlsA[s.idSiswa] || null) !== (urlsB[s.idSiswa] || null),
        );
        if (changed || forceRefresh) {
          await applyProfiles(urlsB, true);
        } else {
          await firstRun;
          setSyncModalProgress({
            show: true,
            stage: 3,
            totalStages: 3,
            pct: 100,
            title: "✅ Data Wajah Siswa Siap!",
            desc: "Semua foto wajah siswa sudah termutakhirkan.",
            detail: "Kamera pemindai siap digunakan",
          });
          setTimeout(() => setSyncModalProgress(null), 600);
        }
        if (allOk) {
          try {
            localStorage.setItem(hasEverSyncedKey, "true");
          } catch (_) {}
        }
        updateProfileLoadingState("ready");
      } else {
        await firstRun;
        updateProfileLoadingState("ready");
      }
    } catch (err) {
      console.warn("Gagal menyiapkan profil wajah:", err);
      updateProfileLoadingState("ready");
      setSyncModalProgress(null);
    } finally {
      if (forceRefresh) setSyncingFaces(false);
    }
  }

  // -----------------------------------------------------------------------
  // SINKRON CEPAT — hanya proses siswa yang fotonya berubah/baru
  // -----------------------------------------------------------------------
  async function handleSinkronCepat() {
    if (syncingFaces) return;
    setShowSyncMenu(false);
    const t0 = Date.now();

    const effectiveWaliId = isAllClassesMode
      ? "ALL_CLASSES"
      : selectedWaliId || activeClass?.idWali || petugasInfo?.idWali || "unknown";
    const localCacheKey = `cached_face_urls_${effectiveWaliId}`;
    const isOnlineNow = typeof navigator === "undefined" || navigator.onLine !== false;

    if (!isOnlineNow) {
      alert("📴 Tidak ada koneksi internet. Sinkron cepat dibatalkan.");
      return;
    }

    const currentSiswa = studentProfilesRef.current?.length
      ? studentProfilesRef.current
      : siswaList;
    if (!currentSiswa || currentSiswa.length === 0) {
      // Tidak ada data rombel → lakukan sinkron penuh
      loadStudentFaceProfilesParallel(siswaList, true);
      return;
    }

    setSyncingFaces(true);
    try {
      // Baca URL cache lokal sebelumnya
      let urlCache = {};
      try {
        const saved = localStorage.getItem(localCacheKey);
        if (saved) urlCache = JSON.parse(saved) || {};
      } catch (_) {}
      let globalCache = {};
      try {
        const savedG = localStorage.getItem("portal_sekolah_known_face_urls");
        if (savedG) globalCache = JSON.parse(savedG) || {};
      } catch (_) {}

      // Ambil URL terbaru dari server sekaligus (bulk)
      let bulkMap = null;
      try {
        const bulk = await getWajahBulk(
          currentSiswa.map((s) => String(s.idSiswa).trim()),
        );
        if (bulk?.success && bulk.data && typeof bulk.data === "object") {
          bulkMap = bulk.data;
        }
      } catch (_) {}

      if (!bulkMap) {
        // Fallback: lakukan sinkron penuh jika bulk gagal
        loadStudentFaceProfilesParallel(siswaList, true);
        return;
      }

      // Bandingkan dengan cache lama: temukan siswa yang fotonya baru/berubah
      const changedStudents = [];
      let registeredCount = 0;
      let unchangedCount = 0;
      let noPhotoCount = 0;

      currentSiswa.forEach((s) => {
        const sid = String(s.idSiswa).trim();
        const newUrl = bulkMap[sid] || null;
        const oldUrl = urlCache[sid] || globalCache[sid] || null;
        const hasPhoto = newUrl && newUrl !== "NO_PHOTO";
        const isSame = hasPhoto && (oldUrl === newUrl || isSameFaceUrl(oldUrl, newUrl));

        if (hasPhoto) {
          registeredCount++;
          if (!isSame) {
            changedStudents.push({ ...s, _newUrl: newUrl });
          } else {
            unchangedCount++;
          }
        } else {
          noPhotoCount++;
        }
      });

      // 1. Update cache untuk siswa yang fotonya berubah/baru
      if (changedStudents.length > 0) {
        changedStudents.forEach((s) => {
          const sid = String(s.idSiswa).trim();
          urlCache[sid] = s._newUrl;
          globalCache[sid] = s._newUrl;
          if (s.idWali) {
            try {
              const rawW = localStorage.getItem(`cached_face_urls_${s.idWali}`);
              const wObj = rawW ? JSON.parse(rawW) : {};
              wObj[sid] = s._newUrl;
              localStorage.setItem(`cached_face_urls_${s.idWali}`, JSON.stringify(wObj));
            } catch (_) {}
          }
        });
        try {
          localStorage.setItem(localCacheKey, JSON.stringify(urlCache));
          localStorage.setItem("portal_sekolah_known_face_urls", JSON.stringify(globalCache));
        } catch (_) {}
      }

      // 2. Siapkan profil lengkap: perbarui URL foto & coba baca descriptor dari cache
      const jobId = ++templateJobRef.current;
      const existingProfiles = studentProfilesRef.current || [];
      const updatedProfiles = currentSiswa.map((s) => {
        const sid = String(s.idSiswa).trim();
        const existing = existingProfiles.find((p) => p.idSiswa === sid);
        const changed = changedStudents.find((c) => String(c.idSiswa).trim() === sid);
        const photoUrl = changed ? changed._newUrl : (bulkMap[sid] || existing?.fotoWajah || urlCache[sid] || null);
        const finalUrl = photoUrl && photoUrl !== "NO_PHOTO" ? photoUrl : null;

        if (!finalUrl) {
          return {
            idSiswa: sid,
            nama: s.nama,
            kelas: s.kelas || "",
            idWali: s.idWali || activeClass?.idWali,
            idGuru: s.idGuru || activeClass?.idGuru,
            fotoWajah: null,
            descriptor: null,
            status: "nophoto",
          };
        }

        // Coba pakai descriptor yang sudah ada di memori jika URL sama
        let desc = (existing?.fotoWajah === finalUrl && existing?.descriptor) ? existing.descriptor : null;
        let status = "pending";
        if (!desc) {
          const cached = readCachedDescriptor(sid, finalUrl);
          if (cached instanceof Float32Array) {
            desc = cached;
            status = "ok";
          } else if (cached?.status === "noface" || cached?.status === "error") {
            status = cached.status;
          }
        } else {
          status = "ok";
        }

        return {
          idSiswa: sid,
          nama: s.nama,
          kelas: s.kelas || "",
          idWali: s.idWali || activeClass?.idWali,
          idGuru: s.idGuru || activeClass?.idGuru,
          fotoWajah: finalUrl,
          descriptor: desc,
          status,
        };
      });

      studentProfilesRef.current = updatedProfiles;
      setRegisteredFaceCount(updatedProfiles.filter((p) => p.fotoWajah).length);
      syncTemplateInfo(updatedProfiles);

      // 3. Siswa yang masih perlu dihitung deskriptornya (fotonya baru/belum ada di cache)
      const needCompute = updatedProfiles.filter((p) => p.fotoWajah && !p.descriptor && p.status === "pending");

      if (needCompute.length > 0) {
        updateProfileLoadingState("computing_templates");
        let fa = null;
        try {
          fa = await loadFaceApi();
        } catch (_) {
          fa = null;
        }

        if (fa) {
          const BATCH_SIZE = 4;
          for (let i = 0; i < needCompute.length; i += BATCH_SIZE) {
            if (jobId !== templateJobRef.current) break;
            const chunk = needCompute.slice(i, i + BATCH_SIZE);
            await Promise.all(
              chunk.map(async (p) => {
                try {
                  const res = await computeTemplate(fa, p.fotoWajah);
                  if (res?.descriptor) {
                    p.descriptor = res.descriptor;
                    p.status = "ok";
                    writeCachedDescriptor(p.idSiswa, p.fotoWajah, res.descriptor);
                  } else {
                    p.status = "noface";
                    writeCachedDescriptor(p.idSiswa, p.fotoWajah, "NO_FACE");
                  }
                } catch (e) {
                  const isOffline =
                    e?.message === "OFFLINE_NETWORK_UNAVAILABLE" ||
                    (typeof navigator !== "undefined" && !navigator.onLine);
                  p.status = isOffline ? "offline_pending" : "error";
                  if (!isOffline) {
                    writeCachedDescriptor(p.idSiswa, p.fotoWajah, "ERROR");
                  }
                }
              }),
            );
            if (jobId === templateJobRef.current) syncTemplateInfo([...studentProfilesRef.current]);
          }
        }

        // Pastikan tidak ada profil yang tertinggal dengan status "pending" agar tidak stuck di UI
        needCompute.forEach((p) => {
          if (p.status === "pending") {
            const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
            p.status = p.descriptor ? "ok" : isOffline ? "offline_pending" : "error";
            if (!p.descriptor && !isOffline) writeCachedDescriptor(p.idSiswa, p.fotoWajah, "ERROR");
          }
        });
      }

      if (jobId === templateJobRef.current) {
        syncTemplateInfo(updatedProfiles);
        updateProfileLoadingState("ready");
      }

      const durationMs = Date.now() - t0;
      clearTimeout(syncResultTimerRef.current);
      setSyncResultInfo({
        newCount: changedStudents.length,
        registeredCount,
        noPhotoCount,
        totalSiswa: currentSiswa.length,
        durationMs,
      });
      syncResultTimerRef.current = setTimeout(() => setSyncResultInfo(null), 6000);
    } catch (err) {
      console.warn("Sinkron cepat gagal:", err);
    } finally {
      updateProfileLoadingState("ready");
      setSyncingFaces(false);
    }
  }

  // Tutup dropdown sinkron jika klik di luar
  useEffect(() => {
    if (!showSyncMenu) return;
    function handleClickOutside(e) {
      if (syncMenuRef.current && !syncMenuRef.current.contains(e.target)) {
        setShowSyncMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSyncMenu]);

  // Sinkronisasi instan jika ada pendaftaran foto baru di perangkat yang sama
  useEffect(() => {
    if (!isOpen) return;

    let bc = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("portal_face_sync");
        bc.onmessage = (event) => {
          if (event.data?.type === "FACE_UPDATED") {
            if (
              studentProfilesRef.current &&
              studentProfilesRef.current.length > 0
            ) {
              loadStudentFaceProfilesParallel(studentProfilesRef.current, true);
            }
          }
        };
      } catch (_) {}
    }

    const handleStorage = (e) => {
      if (e.key && e.key.startsWith("face_updated_at_") && e.newValue) {
        if (
          studentProfilesRef.current &&
          studentProfilesRef.current.length > 0
        ) {
          loadStudentFaceProfilesParallel(studentProfilesRef.current, true);
        }
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      if (bc) {
        try {
          bc.close();
        } catch (_) {}
      }
      window.removeEventListener("storage", handleStorage);
    };
  }, [isOpen]);

  // Simpan draft lokal (dipetakan per wali kelas saat mode Semua Kelas agar data aman meski reload/offline)
  useEffect(() => {
    if (isSubmittedToday) return;
    if (isAllClassesMode) {
      const byWali = {};
      Object.entries(scannedMap).forEach(([sid, entry]) => {
        const s = siswaList.find((x) => x.idSiswa === sid);
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
    siswaList,
    activeClass?.idWali,
    isAllClassesMode,
    petugasInfo?.idWali,
    isSubmittedToday,
    todayISO,
  ]);

  // 2. MODEL PENGENALAN WAJAH (dimuat sekali per sesi halaman, lalu di-cache browser)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setEngine("loading");

    // Jika dipicu dari engineNonce > 0, force reset promise agar bersih dari kegagalan sebelumnya
    const isRetry = engineNonce > 0;
    if (isRetry) {
      resetFaceApiPromise();
    }

    withTimeout(loadFaceApi(isRetry), 90000)
      .then((fa) => {
        if (cancelled) return;
        faRef.current = fa;
        setEngine("ready");
      })
      .catch((err) => {
        console.warn("Model pengenalan wajah gagal dimuat:", err);
        if (cancelled) return;
        faRef.current = null;
        setEngine("fallback");
      });

    // Auto-retry saat koneksi internet kembali online
    const handleOnlineRetry = () => {
      if (engineStatusRef.current === "fallback") {
        resetFaceApiPromise();
        setEngineNonce((n) => n + 1);
      }
    };
    window.addEventListener("online", handleOnlineRetry);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnlineRetry);
    };
  }, [isOpen, engineNonce]);

  // Batalkan pekerjaan template yang masih berjalan saat modal ditutup
  useEffect(() => {
    if (isOpen) return;
    templateJobRef.current += 1;
  }, [isOpen]);

  // 3. SIKLUS HIDUP KAMERA
  useEffect(() => {
    if (!isOpen || isSubmittedToday || activeTab !== "kamera") {
      stopCamera();
      return;
    }
    startCamera();
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSubmittedToday, activeTab, cameraFacing]);

  async function startCamera() {
    stopCamera();
    const session = ++camSessionRef.current;
    setCameraError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Browser tidak mendukung kamera. Buka lewat HTTPS dan gunakan Chrome / Safari terbaru.",
      );
      return;
    }

    const attempts = [
      {
        audio: false,
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      },
      { audio: false, video: true },
    ];

    let stream = null;
    let lastErr = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (err) {
        lastErr = err;
        if (err?.name === "NotAllowedError") break;
      }
    }

    // Modal ditutup / kamera di-restart saat menunggu izin -> buang stream
    if (session !== camSessionRef.current) {
      stream?.getTracks().forEach((t) => t.stop());
      return;
    }

    if (!stream) {
      const name = lastErr?.name;
      setCameraError(
        name === "NotAllowedError"
          ? "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser lalu coba lagi."
          : name === "NotFoundError"
            ? "Kamera tidak ditemukan pada perangkat ini."
            : name === "NotReadableError"
              ? "Kamera sedang dipakai aplikasi/modal lain. Tutup lalu coba lagi."
              : "Kamera tidak dapat diakses. Pastikan izin kamera aktif pada browser.",
      );
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      return;
    }
    video.srcObject = stream;
    try {
      await video.play();
    } catch (e) {
      if (e?.name !== "AbortError") console.warn("Video play gagal:", e);
    }
    if (session !== camSessionRef.current) return;
    setCameraActive(true);
  }

  function stopCamera() {
    camSessionRef.current += 1; // batalkan permintaan kamera yang masih menunggu
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
    setLiveFaceBoxes([]);
  }

  // 4. LOOP PENGENALAN WAJAH (berurutan, tanpa tumpang-tindih)
  useEffect(() => {
    if (!isOpen || !cameraActive) return;
    const st = {
      alive: true,
      votes: [],
      lastDescAt: 0,
      lastCenter: null,
      liveness: null,
      lock: null,
      lastStep: -1,
    };
    (async () => {
      while (st.alive) {
        const t0 = performance.now();
        try {
          await recognitionTick(st);
        } catch (e) {
          console.warn("Siklus pengenalan wajah gagal:", e);
        }
        const wait = Math.max(
          40,
          DETECT_INTERVAL_MS - (performance.now() - t0),
        );
        await new Promise((r) => setTimeout(r, wait));
      }
    })();
    return () => {
      st.alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cameraActive, cameraFacing]);

  // Wajah hilang / keluar zona: tantangan & identitas dipertahankan selama masa tenggang
  function dropIfLost(st, now) {
    st.liveness = keepLiveness(st.liveness, now);
    if (!st.liveness) {
      st.lock = null;
      st.votes.length = 0;
      st.lastStep = -1;
      setChallengeStep(-1);
    }
  }

  async function recognitionTick(st) {
    const video = videoRef.current;
    const fa = faRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    if (!fa) {
      setScanZoneState("standby");
      setLiveFaceStatus(
        engineStatusRef.current === "fallback"
          ? "⚠️ Model pengenalan wajah gagal dimuat"
          : "⏳ Memuat model pengenalan wajah...",
      );
      return;
    }

    if (Date.now() - lastSuccessScanAt.current < SCAN_COOLDOWN_MS) {
      setScanZoneState("success");
      setLiveFaceStatus("⏳ Jeda anti-duplikat...");
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    // Ambang deteksi kamera responsif kilat: 0.28 (mode cepat) atau 0.32 (mode biasa) agar dari jauh langsung tertangkap
    const liveScoreThreshold = isFastVerifyRef.current ? 0.28 : 0.32;
    const dets = await fa
      .detectAllFaces(
        video,
        new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: liveScoreThreshold }),
      )
      .withFaceLandmarks(true);
    if (!st.alive) return;

    // 1. Tidak Ada Wajah Terdeteksi
    if (!dets || dets.length === 0) {
      st.lastCenter = null;
      dropIfLost(st, Date.now());
      setLiveFaceBoxes([]);
      setScanZoneState("standby");
      setDebugLine("");
      const loadState = profileLoadingStateRef.current;
      if (loadState === "loading_data") {
        setLiveFaceStatus("⏳ Sedang memuat data rombel kelas...");
      } else if (loadState === "reading_photos") {
        setLiveFaceStatus("⏳ Sedang membaca foto wajah siswa dari server...");
      } else if (
        (loadState === "computing_templates" || syncingFaces || templateInfo.pending > 0) &&
        templateInfo.ready === 0
      ) {
        setLiveFaceStatus(
          `⏳ Sedang memproses template wajah (${templateInfo.ready}/${templateInfo.total} siswa siap)...`,
        );
      } else {
        setLiveFaceStatus("Arahkan wajah ke dalam zona pemindaian...");
      }
      return;
    }

    // 2. BEBERAPA WAJAH TERDETEKSI (Multi-Face)
    if (dets.length > 1) {
      if (!isFastVerifyRef.current) {
        // MODE BIASA (3 TAHAP LIVENESS): Multi-Face Protection
        // Cegah salah presensi akibat siswa lain berdiri lebih dekat/di samping kamera
        st.votes.length = 0;
        st.lastCenter = null;
        st.liveness = null;
        st.lock = null;
        st.lastStep = -1;
        setChallengeStep(-1);
        setLiveFaceBoxes([]);
        setScanZoneState("multiple");
        setLiveFaceStatus("⚠️ Hanya 1 siswa di dalam zona (atau aktifkan Mode Cepat)");
        return;
      }

      // MODE VERIFIKASI CEPAT: DUKUNG SCAN BANYAK SISWA SEKALIGUS!
      const now = Date.now();
      const validFaces = dets
        .map((d) => {
          const b = d.detection.box;
          const cx = (b.x + b.width / 2) / vw;
          const cy = (b.y + b.height / 2) / vh;
          const wR = b.width / vw;
          const p = headPose(d.landmarks);
          return { d, box: b, cx, cy, wRatio: wR, pose: p };
        })
        .filter((f) => {
          return (
            f.wRatio >= 0.10 &&
            f.wRatio <= 0.72 &&
            Math.abs(f.pose.yaw) <= MAX_YAW * 1.35 &&
            Math.abs(f.pose.rollDeg) <= MAX_ROLL_DEG * 1.35 &&
            f.cy >= 0.12 &&
            f.cy <= 0.88
          );
        });

      if (validFaces.length === 0) {
        setLiveFaceBoxes([]);
        setScanZoneState("adjust");
        setLiveFaceStatus("📍 Posisikan wajah menghadap ke kamera");
        return;
      }

      const profiles = (studentProfilesRef.current || []).filter((p) => p.descriptor);
      if (profiles.length === 0) {
        setLiveFaceBoxes(
          validFaces.map((f) => ({
            ...mapBoxToContainer(f.box, vw, vh, video.clientWidth || vw, video.clientHeight || vh, cameraFacing === "user"),
            label: "Memindai...",
            status: "verifying",
          })),
        );
        setScanZoneState("standby");
        setLiveFaceStatus("⏳ Template wajah sedang disiapkan...");
        return;
      }

      // Pelacakan Spasial: pertahankan nama wajah yang sudah teridentifikasi agar tidak berkedip bergantian
      const mappedBoxes = validFaces.map((f) => {
        const baseBox = mapBoxToContainer(
          f.box,
          vw,
          vh,
          video.clientWidth || vw,
          video.clientHeight || vh,
          cameraFacing === "user",
        );

        // Cari wajah terlacak terdekat di frame sebelumnya (radius toleransi gerakan kepala 0.16)
        let prev = null;
        let minDist = 0.16;
        for (const t of multiTrackedFacesRef.current) {
          const dist = Math.hypot(t.cx - f.cx, t.cy - f.cy);
          if (dist < minDist) {
            minDist = dist;
            prev = t;
          }
        }

        const sid = prev?.sid;
        const alreadyScanned = sid ? !!scannedMapRef.current[sid] : false;
        const label = prev?.label || "Memindai...";
        const status = alreadyScanned ? "duplicate" : prev?.status || "verifying";

        return {
          ...baseBox,
          cx: f.cx,
          cy: f.cy,
          sid,
          label,
          status,
        };
      });

      // Analisis biometrik tiap wajah
      if (now - st.lastDescAt >= DESC_INTERVAL_MS) {
        st.lastDescAt = now;
        const recognizedBatch = [];

        for (let i = 0; i < validFaces.length; i++) {
          const f = validFaces[i];
          const mBox = mappedBoxes[i];
          try {
            const [faceCanvas] = await fa.extractFaces(video, [f.d.landmarks.align()]);
            const desc = await fa.nets.faceRecognitionNet.computeFaceDescriptor(faceCanvas);
            const { best, d1, d2 } = matchFace(desc, profiles);
            const confident = best && isConfident(d1, d2, MATCH_DIST, MARGIN_MIN);

            if (confident) {
              const sid = best.idSiswa;
              const alreadyScanned = !!scannedMapRef.current[sid];
              const cooldownUntil = multiCooldownRef.current[sid] || 0;

              if (alreadyScanned) {
                mBox.label = `✓ ${best.nama} (Hadir)`;
                mBox.status = "duplicate";
                mBox.sid = sid;
              } else {
                mBox.label = `✓ ${best.nama}`;
                mBox.status = "verified";
                mBox.sid = sid;

                if (now > cooldownUntil) {
                  multiCooldownRef.current[sid] = now + 8000;
                  recognizedBatch.push({ id: sid, nama: best.nama });
                }
              }
            } else {
              if (mBox.label === "Memindai...") {
                mBox.label = "Wajah Terdeteksi";
                mBox.status = "unknown";
              }
            }
          } catch (_) {}
        }

        // Update memori spasial agar frame berikutnya stabil tanpa berkedip
        multiTrackedFacesRef.current = mappedBoxes.map((b) => ({
          cx: b.cx,
          cy: b.cy,
          label: b.label,
          status: b.status,
          sid: b.sid,
          lastSeen: now,
        }));

        setLiveFaceBoxes(mappedBoxes);
        if (recognizedBatch.length > 0) {
          setScanZoneState("success");
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([40, 30, 40]);
          }
          recognizedBatch.forEach((item) => {
            recognizedRef.current(item.id, item.nama);
          });
          const namaList = recognizedBatch.map((s) => s.nama).join(", ");
          setLiveFaceStatus(`✅ ${recognizedBatch.length} siswa hadir: ${namaList}`);
        } else {
          const cocok = mappedBoxes.filter((b) => b.status === "verified" || b.status === "duplicate");
          if (cocok.length > 0) {
            setScanZoneState("success");
            const names = cocok
              .map((c) => c.label.replace(/^✓\s*/, "").replace(/\s*\(Hadir\)$/, ""))
              .join(", ");
            setLiveFaceStatus(`⚡ Mode Cepat: ${names}`);
          } else {
            setScanZoneState("verifying");
            setLiveFaceStatus(`⚡ Mode Cepat: ${mappedBoxes.length} wajah di kamera`);
          }
        }
      } else {
        // Frame antar-interval: bersihkan tracker yang sudah tidak tampak > 2.5 detik
        multiTrackedFacesRef.current = multiTrackedFacesRef.current.filter((t) => now - t.lastSeen < 2500);
        setLiveFaceBoxes(mappedBoxes);
      }
      return;
    }

    // 3. Wajah Tunggal Terdeteksi — Validasi Zona Pemindaian Target
    const main = dets[0];
    const box = main.detection.box;

    setLiveFaceBoxes([
      {
        ...mapBoxToContainer(
          box,
          vw,
          vh,
          video.clientWidth || vw,
          video.clientHeight || vh,
          cameraFacing === "user",
        ),
        label: st.lock ? st.lock.nama : "SISWA",
        status: st.lock ? "verified" : "verifying",
      },
    ]);

    // Hitung posisi normalisasi pusat wajah (0.0 - 1.0)
    const cxNorm = (box.x + box.width / 2) / vw;
    const cyNorm = (box.y + box.height / 2) / vh;
    const wRatio = box.width / vw;

    // Selama tantangan toleh berlangsung, zona dilonggarkan karena kotak wajah
    // bergeser & menyempit saat kepala menoleh.
    const nowT = Date.now();
    const inChallenge = !(st.liveness && st.liveness.isMotionVerified);
    const cxLo = inChallenge ? 0.2 : 0.28;
    const cxHi = inChallenge ? 0.8 : 0.72;
    // Jarak responsif: wajah dari jauh (rasio lebih kecil) langsung dapat diproses
    const minRatio = isFastVerifyRef.current ? 0.08 : (inChallenge ? 0.10 : 0.13);

    // A. Cek Wajah di Posisi Tengah (Zona Reticle Tengah)
    if (cxNorm < cxLo || cxNorm > cxHi || cyNorm < 0.2 || cyNorm > 0.75) {
      st.lastCenter = null;
      dropIfLost(st, nowT);
      setScanZoneState("adjust");
      setLiveFaceStatus("📍 Posisikan wajah di tengah bingkai");
      return;
    }

    // B. Cek Jarak Wajah ke Kamera (Terlalu Jauh / Terlalu Dekat)
    if (wRatio < minRatio) {
      st.lastCenter = null;
      dropIfLost(st, nowT);
      setScanZoneState("adjust");
      setLiveFaceStatus("🔍 Dekatkan wajah ke kamera");
      return;
    }

    if (wRatio > 0.68) {
      st.lastCenter = null;
      dropIfLost(st, nowT);
      setScanZoneState("adjust");
      setLiveFaceStatus("↔️ Mundurkan wajah sedikit");
      return;
    }

    // C. Cek Kemiringan dan Arah Hadap Kepala
    // Saat tantangan toleh: menoleh jauh DIPERBOLEHKAN (MAX_CHALLENGE_YAW).
    // Setelah lolos: pengenalan wajah hanya pada posisi hampir lurus (MAX_YAW).
    const pose = headPose(main.landmarks);
    const yawLimit = inChallenge ? MAX_CHALLENGE_YAW : MAX_YAW;
    if (
      Math.abs(pose.yaw) > yawLimit ||
      Math.abs(pose.rollDeg) > MAX_ROLL_DEG
    ) {
      st.lastCenter = null;
      dropIfLost(st, nowT);
      setScanZoneState("adjust");
      setLiveFaceStatus(
        inChallenge
          ? "↔️ Jangan miringkan kepala: hadap ke kamera"
          : "😐 Hadap lurus ke kamera",
      );
      return;
    }

    // D. LIVENESS (tantangan toleh atau verifikasi cepat) — BERJALAN PARALEL dengan pengenalan identitas.
    const now = Date.now();
    let live;
    if (isFastVerifyRef.current) {
      // MODE VERIFIKASI CEPAT: hanya tahap 1 (hadap) dan tahap 3 (lurus) tanpa toleh
      if (!st.liveness) {
        st.liveness = {
          base: pose.yaw,
          phase: "center",
          relYaw: 0,
          isMotionVerified: false,
          startedAt: now,
          verifiedAt: 0,
          lastSeenAt: now,
        };
        st.lastStep = 0;
        setChallengeStep(0); // Tahap 1: Hadap
      } else {
        // Otomatis verifikasi tahap 3 (lurus) jika posisi stabil
        st.liveness.lastSeenAt = now;
        st.liveness.phase = "verified";
        st.liveness.isMotionVerified = true;
        if (!st.liveness.verifiedAt) st.liveness.verifiedAt = now;
        if (st.lastStep !== 2) {
          st.lastStep = 2;
          setChallengeStep(2); // Tahap 3: Lurus / Terverifikasi
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(30);
          }
        }
      }
      live = st.liveness;
    } else {
      st.liveness = updateHeadTurnTracker(st.liveness, pose.yaw, now);
      live = st.liveness;
      const step = headTurnStep(live);
      if (step !== st.lastStep) {
        if (
          step > st.lastStep &&
          step > 0 &&
          typeof navigator !== "undefined" &&
          navigator.vibrate
        ) {
          navigator.vibrate(30); // getar singkat tiap langkah berhasil
        }
        st.lastStep = step;
        setChallengeStep(step);
      }
    }

    if (st.lock && now - st.lock.at > IDENT_LOCK_TTL_MS) st.lock = null;
    if (showDebugRef.current && !live.isMotionVerified) {
      setDebugLine(
        `liveness: ${live.phase} • yaw ${pose.yaw.toFixed(2)} • dasar ${live.base.toFixed(2)} • selisih ${live.relYaw.toFixed(2)}${
          st.lock ? ` • terkunci: ${st.lock.nama}` : ""
        }`,
      );
    }

    // Petunjuk sesuai kondisi saat ini (dipakai di beberapa cabang di bawah)
    const guideText = isFastVerifyRef.current
      ? live.isMotionVerified
        ? "✨ Tahan posisi hadap lurus..."
        : st.lock
          ? `👤 ${st.lock.nama} terdeteksi — tahan lurus`
          : "😐 Hadap lurus ke kamera"
      : live.isMotionVerified
        ? "✨ Tahan lurus ke kamera sebentar..."
        : st.lock
          ? `👤 ${st.lock.nama} dikenali — ${headTurnHint(live)}`
          : headTurnHint(live);

    // Stabilitas gerakan: wajah yang sedang bergerak cepat buram, jadi
    // pembuatan deskriptor dilewati (suara yang sudah terkumpul TIDAK dihapus).
    let moving = false;
    if (st.lastCenter) {
      const dt = now - st.lastCenter.t;
      const shift = Math.hypot(
        cxNorm - st.lastCenter.x,
        cyNorm - st.lastCenter.y,
      );
      if (dt < 250 && shift > 0.06) moving = true;
      if (dt < 250 && shift > 0.2) st.votes.length = 0; // lompatan besar: kemungkinan orang lain
    }
    st.lastCenter = { x: cxNorm, y: cyNorm, t: now };
    if (moving) {
      setScanZoneState("verifying");
      setLiveFaceStatus(guideText);
      return;
    }

    // E. Cek Kesiapan Template Profil Kelas (Pemuatan Awal)
    const profiles = (studentProfilesRef.current || []).filter(
      (p) => p.descriptor,
    );
    if (profiles.length === 0) {
      st.votes.length = 0;
      setScanZoneState("standby");
      const loadState = profileLoadingStateRef.current;
      if (loadState === "loading_data") {
        setLiveFaceStatus("⏳ Sedang memuat data rombel kelas... Mohon tunggu");
      } else if (loadState === "reading_photos") {
        setLiveFaceStatus(
          "⏳ Sedang membaca foto wajah siswa dari server... Mohon tunggu",
        );
      } else if (
        loadState === "computing_templates" ||
        templateInfo.pending > 0 ||
        syncingFaces
      ) {
        setLiveFaceStatus(
          `⏳ Sedang memproses template wajah (${templateInfo.ready}/${templateInfo.total} siswa)... Mohon tunggu`,
        );
      } else {
        const totalWithPhoto = (studentProfilesRef.current || []).filter(
          (p) => p.fotoWajah,
        ).length;
        if (totalWithPhoto === 0) {
          setLiveFaceStatus(
            "ℹ️ Belum ada foto wajah siswa yang terdaftar di kelas ini",
          );
        } else {
          setLiveFaceStatus(
            "⚠️ Template wajah belum siap (tekan tombol Sinkron Wajah)",
          );
        }
      }
      return;
    }

    // Pengenalan identitas hanya pada frame yang cukup menghadap lurus
    if (Math.abs(pose.yaw) > MAX_YAW) {
      setScanZoneState("verifying");
      setLiveFaceStatus(
        live.isMotionVerified
          ? "😐 Hadap lurus ke kamera untuk dicocokkan"
          : guideText,
      );
      return;
    }

    // F. Analisis Biometrik 128-d (Interval Hemat Daya)
    if (now - st.lastDescAt < DESC_INTERVAL_MS) return;
    st.lastDescAt = now;

    const [faceCanvas] = await fa.extractFaces(video, [main.landmarks.align()]);
    const desc =
      await fa.nets.faceRecognitionNet.computeFaceDescriptor(faceCanvas);
    if (!st.alive) return;

    const { best, d1, d2 } = matchFace(desc, profiles);
    // Mode Semua Kelas: kandidat jauh lebih banyak, jadi ambang dibuat lebih ketat
    const strict = allModeRef.current;
    const confident =
      best &&
      isConfident(
        d1,
        d2,
        strict ? 0.45 : MATCH_DIST,
        strict ? 0.09 : MARGIN_MIN,
      );

    if (showDebugRef.current && best) {
      setDebugLine(
        `terdekat: ${best.nama} • jarak ${d1.toFixed(2)} • selisih ${
          Number.isFinite(d2) ? (d2 - d1).toFixed(2) : "-"
        } (butuh ≤ ${MATCH_DIST} & ≥ ${MARGIN_MIN}) • ${live.phase}${st.lock ? " • terkunci" : ""}`,
      );
    }

    // Identitas berganti di tengah proses (orang lain menggantikan): mulai ulang
    // dari awal, termasuk tantangan toleh, agar verifikasi tidak "dipinjam".
    if (st.lock && confident && best.idSiswa !== st.lock.id) {
      st.lock = null;
      st.votes.length = 0;
      st.liveness = null;
      st.lastStep = -1;
      setChallengeStep(-1);
      setScanZoneState("adjust");
      setLiveFaceStatus("🔄 Wajah berganti: mulai ulang verifikasi");
      return;
    }

    const confirmedId = pushVote(
      st.votes,
      confident ? best.idSiswa : null,
      now,
      IDENT_WINDOW_MS,
      allModeRef.current ? VOTES_NEEDED + 1 : VOTES_NEEDED,
    );
    if (st.lock && confident && best.idSiswa === st.lock.id) {
      st.lock.at = now; // pencocokan segar: perbarui
    } else if (confirmedId && !st.lock) {
      st.lock = { id: best.idSiswa, nama: best.nama, firstAt: now, at: now };
    }

    // Selesai: tantangan toleh lulus + identitas terkunci + ada pencocokan segar sesudahnya
    if (st.lock && live.isMotionVerified) {
      if (
        !isFastVerifyRef.current &&
        st.lock.firstAt > live.verifiedAt + IDENT_LATE_LOCK_MS
      ) {
        // Identitas baru terbentuk lama setelah tantangan: tidak dipercaya, ulangi toleh
        st.liveness = null;
        st.lastStep = -1;
        setChallengeStep(-1);
        setScanZoneState("adjust");
        setLiveFaceStatus("🔄 Ulangi: toleh kepala sekali lagi lalu hadap lurus");
        return;
      }
      if (st.lock.at >= live.verifiedAt || isFastVerifyRef.current) {
        const { id, nama } = st.lock;
        st.votes.length = 0;
        st.lastCenter = null;
        st.liveness = null; // Siswa berikutnya harus menoleh ulang
        st.lock = null;
        st.lastStep = -1;
        setChallengeStep(-1);
        setScanZoneState("success");
        setLiveFaceStatus(`✅ Wajah terverifikasi: ${nama}`);
        recognizedRef.current(id, nama);
        return;
      }
    }

    if (confident || (best && d1 <= LOOSE_DIST)) {
      setScanZoneState("verifying");
      setLiveFaceStatus(guideText);
    } else {
      setScanZoneState("adjust");
      setLiveFaceStatus(
        "⚠️ Wajah tidak dikenal / belum terdaftar di kelas ini",
      );
    }
  }

  // 5. PENANGANAN HASIL SCAN WAJAH (SAMA PERSIS DENGAN ATURAN BARCODE)
  function handleStudentRecognized(scannedId, studentName) {
    if (checkIsPastTimeLimit()) {
      setIsSubmittedToday(true);
      setIsLockedByTime(true);
      stopCamera();
      alert("⛔ Batas waktu presensi telah berakhir (Pukul 08.00 WIB).");
      return;
    }

    // Siswa yang sudah tidak terdaftar di daftar aktif tidak boleh dicatat
    const matchedStudent = siswaList.find((s) => s.idSiswa === scannedId);
    if (!matchedStudent) {
      lastSuccessScanAt.current = Date.now();
      setScanOverlay({
        type: "unknown",
        nama: studentName,
        pesan: isAllClassesMode
          ? "Siswa belum terdaftar di database sekolah."
          : `Bukan siswa kelas ${activeClass?.namaKelas || "ini"}.`,
      });
      return;
    }

    // Kasus: Siswa sudah pernah discan sebelumnya (FIRST-SCAN WINS)
    const existing = scannedMapRef.current[scannedId];
    if (existing) {
      lastSuccessScanAt.current = Date.now();
      setScanOverlay({
        type: "duplicate",
        nama: `${studentName}${matchedStudent.kelas ? ` • ${matchedStudent.kelas}` : ""}`,
        waktu: existing.waktuScan,
        pesan: `Sudah tercatat hadir pada pukul ${existing.waktuScan} WIB.`,
      });
      return;
    }

    // Kasus: Presensi wajah sukses dicatat hadir pertama kali
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
      metode: "Wajah",
      idWali: matchedStudent.idWali || activeClass?.idWali,
      idGuru: matchedStudent.idGuru || activeClass?.idGuru,
      kelas: matchedStudent.kelas || activeClass?.namaKelas,
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
        matchedStudent.idWali || activeClass?.idWali || petugasInfo?.idWali;
      if (targetWaliId) {
        const q = getOfflineQueue(targetWaliId);
        const filtered = q.filter(
          (item) => !(item.idSiswa === scannedId && item.tanggal === todayISO),
        );
        filtered.push({
          idSiswa: scannedId,
          namaSiswa: studentName,
          tanggal: todayISO,
          status: "Hadir",
          keterangan: `Presensi Wajah: ${jamScan} WIB`,
          timestamp: Date.now(),
          idWali: targetWaliId,
          idGuru: matchedStudent.idGuru || activeClass?.idGuru,
        });
        saveOfflineQueue(targetWaliId, filtered);
      }
    } catch (_) {}

    lastSuccessScanAt.current = Date.now();
    playBeepSuccess();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(80);
    }

    setScanOverlay({
      type: "success",
      nama: `${studentName}${matchedStudent.kelas ? ` • ${matchedStudent.kelas}` : ""}`,
      waktu: jamScan,
      pesan: `hadir pada pukul ${jamScan} WIB via Presensi Wajah`,
    });
  }

  // Update status manual (Sakit, Izin, Alfa, Cabut) sekaligus simpan ke antrian offline
  function handleUpdateManualStatus(targetSiswa, st) {
    if (isLockedByTime) return;
    setManualStatusMap((prev) => ({
      ...prev,
      [targetSiswa.idSiswa]: st,
    }));

    try {
      // Kelas milik SISWA yang bersangkutan (bukan kelas petugas) agar tidak masuk lembar yang salah
      const waliId =
        targetSiswa.idWali || activeClass?.idWali || petugasInfo?.idWali;
      if (waliId && waliId !== "ALL_CLASSES") {
        const q = getOfflineQueue(waliId);
        const filtered = q.filter(
          (item) =>
            !(
              item.idSiswa === targetSiswa.idSiswa && item.tanggal === todayISO
            ),
        );
        const ket =
          manualKetMap[targetSiswa.idSiswa] ||
          (st === "Alfa"
            ? "Tidak hadir saat presensi wajah"
            : `Petugas: ${user?.nama || "Siswa"}`);
        filtered.push({
          idSiswa: targetSiswa.idSiswa,
          namaSiswa: targetSiswa.nama,
          tanggal: todayISO,
          status: st,
          keterangan: ket,
          timestamp: Date.now(),
          idWali: waliId,
          idGuru: targetSiswa.idGuru || activeClass?.idGuru,
        });
        saveOfflineQueue(waliId, filtered);
      }
    } catch (_) {}
  }

  recognizedRef.current = handleStudentRecognized;
  showDebugRef.current = showDebug;

  // Statistik Ringkasan
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

  // KIRIM OTOMATIS ANTRIAN OFFLINE
  // - Catatan hari lampau selalu boleh dikirim (tidak terkena batas jam).
  // - Catatan hari ini ikut dikirim setelah batas jam lewat (petugas sudah tak bisa menyimpan manual).
  // - Aman diulang: server melakukan upsert per siswa+tanggal.
  const flushingRef = useRef(false);
  async function flushOfflineQueue() {
    if (flushingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const wIdsToFlush = new Set();
    if (petugasInfo?.idWali) wIdsToFlush.add(petugasInfo.idWali);
    if (Array.isArray(availableClasses)) {
      availableClasses.forEach((c) => {
        if (c.idWali) wIdsToFlush.add(c.idWali);
      });
    }

    flushingRef.current = true;
    try {
      const lockedNow = checkIsPastTimeLimit();
      await runSerial([...wIdsToFlush], async (wId) => {
        const q = getOfflineQueue(wId);
        const cells = q.filter(
          (it) =>
            it &&
            it.idSiswa &&
            it.tanggal &&
            (it.tanggal !== todayISO || lockedNow),
        );
        if (cells.length === 0) return;

        const targetGuru =
          availableClasses.find((c) => String(c.idWali) === String(wId))
            ?.idGuru || petugasInfo?.idGuru;
        if (!targetGuru) return;

        try {
          const res = await savePresensiWaliKelas({
            idGuru: targetGuru,
            idWali: wId,
            cells,
          });
          if (res && res.success) {
            const keyOf = (it) =>
              `${it.idSiswa}|${it.tanggal}|${it.timestamp || ""}|${it.status}`;
            const sent = new Set(cells.map(keyOf));
            saveOfflineQueue(
              wId,
              getOfflineQueue(wId).filter((it) => !sent.has(keyOf(it))),
            );
            if (String(wId) === String(activeClass?.idWali)) {
              setPendingOfflineRecords((prev) =>
                prev.filter((it) => !sent.has(keyOf(it))),
              );
            }
            const nowIso = new Date().toISOString();
            try {
              localStorage.setItem(`last_online_save_${wId}`, nowIso);
            } catch (_) {}
            if (String(wId) === String(activeClass?.idWali)) {
              setLastOnlineSaveTime(nowIso);
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
    const onOnline = () => flushOfflineQueue();
    window.addEventListener("online", onOnline);
    const iv = setInterval(flushOfflineQueue, 60000);
    return () => {
      clearTimeout(t0);
      clearInterval(iv);
      window.removeEventListener("online", onOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeClass?.idWali, activeClass?.idGuru, todayISO]);

  // 6. KIRIM / SIMPAN PRESENSI KE BACKEND DENGAN PROGRESS BAR (OFFLINE & ONLINE)
  async function handleSubmitPresensi() {
    if (isSubmittedToday || isLockedByTime) {
      alert("⛔ Batas waktu pengisian presensi hari ini telah berakhir.");
      return;
    }

    if (siswaList.length === 0) {
      alert("Tidak ada data siswa.");
      return;
    }

    const isOffline =
      typeof navigator !== "undefined" && navigator.onLine === false;
    const pendingCount = pendingOfflineRecords.length;
    const offlineNote =
      pendingCount > 0
        ? `\n\n📌 Terdeteksi ${pendingCount} data presensi offline hari kemarin yang belum tersimpan online dan akan dimasukkan bersama.`
        : "";

    let confirmText = "";
    if (isAllClassesMode) {
      confirmText =
        (isOffline
          ? `📱 KONFIRMASI SIMPAN SCAN PINTAR (MODE OFFLINE)\n\n`
          : `📋 KONFIRMASI PENGIRIMAN SCAN PINTAR (SEMUA KELAS)\n\n`) +
        `Total Siswa Hadir Terpindai: ${stats.hadir}\n` +
        `Data kehadiran akan diteruskan otomatis ke masing-masing lembar wali kelas terkait.` +
        offlineNote +
        `\n\nApakah Anda ingin menyimpan data presensi ini sekarang?`;
    } else {
      confirmText =
        (isOffline
          ? `📱 KONFIRMASI SIMPAN PRESENSI (MODE OFFLINE)\n\n`
          : `📋 KONFIRMASI PENGIRIMAN PRESENSI KELAS\n\n`) +
        `Kelas: ${activeClass?.namaKelas || petugasInfo?.namaKelas}\n` +
        `Total Siswa Hari Ini: ${stats.total}\n` +
        `• Hadir: ${stats.hadir}\n` +
        `• Sakit: ${stats.sakit}\n` +
        `• Izin: ${stats.izin}\n` +
        `• Alfa: ${stats.alfa + stats.belumScan} (${stats.belumScan} siswa belum hadir otomatis Alfa)` +
        offlineNote +
        (isOffline
          ? `\n\nJaringan internet sedang mati. Data diamankan OFFLINE di HP dan dikirim otomatis ke Spreadsheet begitu internet kembali (selama aplikasi terbuka).\nSimpan presensi sekarang?`
          : `\n\nApakah Anda ingin menyimpan data presensi ini sekarang?`);
    }

    if (!window.confirm(confirmText)) return;

    setSaving(true);
    try {
      // --- LOGIKA SIMPAN MODE SEMUA KELAS (SCAN PINTAR) ---
      if (isAllClassesMode) {
        const activeRecorded = siswaList.filter(
          (s) => scannedMap[s.idSiswa] || manualStatusMap[s.idSiswa],
        );

        if (activeRecorded.length === 0 && pendingOfflineRecords.length === 0) {
          alert("Belum ada siswa yang discan untuk disimpan.");
          setSaving(false);
          setSaveProgress(null);
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
              keterangan: `Presensi Wajah: ${scan.waktuScan} WIB`,
              idWali: s.idWali,
              idGuru: s.idGuru,
              source: "scan_pintar",
              overwriteOnlyIf: ["", "Alfa"],
            };
          }
          const explicit = manualStatusMap[s.idSiswa] || "Alfa";
          const ket =
            manualKetMap[s.idSiswa] || `Petugas: ${user?.nama || "Siswa"}`;
          return {
            idSiswa: s.idSiswa,
            namaSiswa: s.nama,
            tanggal: todayISO,
            status: explicit,
            keterangan: ket,
            idWali: s.idWali,
            idGuru: s.idGuru,
            source: "scan_pintar",
            overwriteOnlyIf: ["", "Alfa"],
          };
        });

        const groups = {};
        [...pendingOfflineRecords, ...todayCells].forEach((cell) => {
          const s = siswaList.find((x) => x.idSiswa === cell.idSiswa);
          const wId = cell.idWali || s?.idWali || petugasInfo?.idWali;
          const gId = cell.idGuru || s?.idGuru || petugasInfo?.idGuru;
          if (!wId) return;
          if (!groups[wId])
            groups[wId] = { idWali: wId, idGuru: gId, cells: [] };
          groups[wId].cells.push(cell);
        });

        // Simpan ke offline queue per wali kelas (merge aman tanpa menghapus antrian hari lain)
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

        const groupEntries = Object.entries(groups);
        const totalGroups = groupEntries.length;

        const getNamaKelas = (wId) => {
          const found = availableClasses.find(
            (c) => String(c.idWali) === String(wId),
          );
          return found?.namaKelas || found?.kelas || `Kelas (${wId})`;
        };

        const initDetails = groupEntries.map(([wId]) => ({
          wId,
          namaKelas: getNamaKelas(wId),
          status: "pending",
        }));

        if (isOffline) {
          setSaveProgress({
            phase: "error",
            label: "📱 Offline — presensi wajah tersimpan di antrian HP",
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
          label: `Menyimpan presensi wajah ke ${totalGroups} lembar wali kelas...`,
          pct: 10,
          details: initDetails,
          allSuccess: null,
        });

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

              detailsRef[idx] = {
                ...detailsRef[idx],
                status: res?.success ? "ok" : "error",
              };
              doneCount++;

              setSaveProgress((prev) => ({
                ...prev,
                label: `Mengirim... (${doneCount}/${totalGroups} kelas)`,
                pct: Math.round(10 + (doneCount / totalGroups) * 85),
                details: [...detailsRef],
              }));

              if (res?.success) {
                // Bersihkan HANYA data yang sudah terkirim, sisakan antrian hari lain
                const sKey = (c) =>
                  `${String(c.idSiswa).trim()}|${String(c.tanggal).trim()}|${String(c.status).trim()}`;
                const sentKeys = new Set(grp.cells.map(sKey));
                const remaining = getOfflineQueue(wId).filter(
                  (c) => !sentKeys.has(sKey(c)),
                );
                saveOfflineQueue(wId, remaining);

                const nowIso = new Date().toISOString();
                try {
                  localStorage.setItem(`last_online_save_${wId}`, nowIso);
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
                pct: Math.round(10 + (doneCount / totalGroups) * 85),
                details: [...detailsRef],
              }));
              return false;
            }
          },
        );

        const allSuccess = saveResults.every(Boolean);

        if (typeof onPresensiSubmitted === "function") {
          onPresensiSubmitted();
        }

        setSaveProgress({
          phase: allSuccess ? "done" : "error",
          label: allSuccess
            ? "✅ Presensi Scan Pintar wajah berhasil disimpan ke masing-masing wali kelas!"
            : "📱 Sebagian presensi tersimpan online dan sisanya di antrian HP.",
          pct: 100,
          details: [...detailsRef],
          allSuccess,
        });

        setTimeout(() => {
          setSaveProgress(null);
          if (checkIsPastTimeLimit()) {
            setIsSubmittedToday(true);
            onClose();
          }
        }, 2500);
        return;
      }

      // --- LOGIKA SIMPAN MODE PER KELAS TERTENTU ---
      const waliId = activeClass?.idWali || petugasInfo?.idWali;
      const guruId = activeClass?.idGuru || petugasInfo?.idGuru;
      const namaKelasNow =
        activeClass?.namaKelas || petugasInfo?.namaKelas || "Kelas ini";

      const todayCells = siswaList.map((s) => {
        const scan = scannedMap[s.idSiswa];
        if (scan) {
          return {
            idSiswa: s.idSiswa,
            namaSiswa: s.nama,
            tanggal: todayISO,
            status: "Hadir",
            keterangan: `Presensi Wajah: ${scan.waktuScan} WIB`,
          };
        }

        const explicit = manualStatusMap[s.idSiswa];
        const st = explicit || "Alfa";
        const ket =
          manualKetMap[s.idSiswa] ||
          (st === "Alfa"
            ? "Tidak hadir saat presensi wajah"
            : `Petugas: ${user?.nama || "Siswa"}`);

        return {
          idSiswa: s.idSiswa,
          namaSiswa: s.nama,
          tanggal: todayISO,
          status: st,
          keterangan: ket,
          ...(explicit ? {} : { auto: true, onlyIfEmpty: true }),
        };
      });

      // Gabungkan data presensi offline dari hari-hari lampau dengan data hari ini
      const allCells = [...pendingOfflineRecords, ...todayCells];

      // Amankan dulu ke antrian lokal HP agar data terjamin tidak hilang
      try {
        if (waliId) saveOfflineQueue(waliId, allCells);
      } catch (_) {}

      // KASUS 1: Perangkat sedang offline (jaringan dimatikan)
      if (isOffline) {
        setSaveProgress({
          phase: "error",
          label:
            "📱 Offline — presensi disimpan di antrian HP dan dikirim otomatis saat online",
          pct: 100,
          details: [
            { wId: waliId, namaKelas: namaKelasNow, status: "offline" },
          ],
          allSuccess: false,
        });

        if (typeof onPresensiSubmitted === "function") {
          onPresensiSubmitted();
        }

        setTimeout(() => {
          setSaveProgress(null);
          if (checkIsPastTimeLimit()) {
            setIsSubmittedToday(true);
            onClose();
          }
        }, 2500);
        return;
      }

      // KASUS 2: Mencoba simpan secara Online ke Spreadsheet
      setSaveProgress({
        phase: "sending",
        label: `Menyimpan presensi wajah ke lembar ${namaKelasNow}...`,
        pct: 35,
        details: [{ wId: waliId, namaKelas: namaKelasNow, status: "pending" }],
        allSuccess: null,
      });

      let res;
      try {
        res = await savePresensiWaliKelas({
          idGuru: guruId,
          idWali: waliId,
          cells: allCells,
        });
      } catch (netErr) {
        res = {
          success: false,
          networkError: true,
          message: netErr?.message || "Tidak dapat terhubung ke server.",
        };
      }

      if (res && res.success) {
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

          const nowIso = new Date().toISOString();
          try {
            localStorage.setItem(`last_online_save_${waliId}`, nowIso);
            localStorage.removeItem(`draft_scan_${waliId}_${todayISO}`);
          } catch (_) {}
          setLastOnlineSaveTime(nowIso);
        }

        setHasPreviousSubmission(true);

        if (typeof onPresensiSubmitted === "function") {
          onPresensiSubmitted();
        }

        const pastLimit = checkIsPastTimeLimit();

        setSaveProgress({
          phase: "done",
          label: pastLimit
            ? "✅ Tersimpan! Waktu pengisian hari ini telah ditutup."
            : "✅ Presensi wajah berhasil disimpan ke Spreadsheet!",
          pct: 100,
          details: [{ wId: waliId, namaKelas: namaKelasNow, status: "ok" }],
          allSuccess: true,
        });

        setTimeout(() => {
          setSaveProgress(null);
          if (pastLimit) {
            setIsSubmittedToday(true);
            setIsLockedByTime(true);
            onClose();
          }
        }, 2200);
      } else if (!res || res.networkError) {
        console.warn(
          "Gagal simpan online (jaringan), data tetap di antrian:",
          res?.message,
        );
        setSaveProgress({
          phase: "error",
          label:
            "📱 Koneksi terputus. Presensi tersimpan aman di HP dan akan dikirim otomatis saat online.",
          pct: 100,
          details: [
            { wId: waliId, namaKelas: namaKelasNow, status: "offline" },
          ],
          allSuccess: false,
        });

        if (typeof onPresensiSubmitted === "function") {
          onPresensiSubmitted();
        }

        setTimeout(() => {
          setSaveProgress(null);
          if (checkIsPastTimeLimit()) {
            setIsSubmittedToday(true);
            onClose();
          }
        }, 2500);
      } else {
        console.warn("Server menolak penyimpanan presensi:", res?.message);
        setSaveProgress({
          phase: "error",
          label: `⛔ Gagal disimpan: ${res?.message || "kesalahan di server"}. Data masih aman di HP.`,
          pct: 100,
          details: [{ wId: waliId, namaKelas: namaKelasNow, status: "error" }],
          allSuccess: false,
        });
        setTimeout(() => setSaveProgress(null), 5000);
      }
    } catch (err) {
      console.warn("Penyimpanan offline:", err);
      setSaveProgress({
        phase: "error",
        label: "📱 Presensi berhasil diamankan di penyimpanan lokal perangkat.",
        pct: 100,
        details: [],
        allSuccess: false,
      });
      setTimeout(() => setSaveProgress(null), 2500);
    } finally {
      setSaving(false);
    }
  }

  function toggleCameraFacing() {
    setCameraFacing((prev) =>
      prev === "environment" ? "user" : "environment",
    );
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
        {/* ===== OVERLAY PROGRESS SIMPAN SPREADSHEET (DI TENGAH LAYAR) ===== */}
        {saveProgress && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm pointer-events-auto">
            <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm mx-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              {/* Header overlay */}
              <div
                className={`px-5 py-3.5 flex items-center gap-2.5 ${
                  saveProgress.phase === "done"
                    ? "bg-emerald-600"
                    : saveProgress.phase === "error"
                      ? "bg-amber-600"
                      : "bg-teal-700"
                } text-white`}
              >
                {saveProgress.phase === "sending" && (
                  <svg
                    className="animate-spin h-5 w-5 shrink-0"
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
                  <span className="text-lg shrink-0">✅</span>
                )}
                {saveProgress.phase === "error" && (
                  <span className="text-lg shrink-0">⚠️</span>
                )}
                <div className="font-bold text-sm leading-snug">
                  {saveProgress.phase === "sending"
                    ? "Menyimpan ke Spreadsheet..."
                    : saveProgress.phase === "done"
                      ? "Penyimpanan Selesai"
                      : "Status Penyimpanan"}
                </div>
              </div>

              <div className="px-5 py-4 space-y-3.5">
                {/* Progress bar */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs text-slate-600 font-medium line-clamp-1">
                      {saveProgress.label}
                    </span>
                    <span className="text-xs font-black text-slate-800 ml-2">
                      {saveProgress.pct}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        saveProgress.phase === "done"
                          ? "bg-emerald-500"
                          : saveProgress.phase === "error"
                            ? "bg-amber-500"
                            : "bg-teal-600"
                      }`}
                      style={{ width: `${saveProgress.pct}%` }}
                    />
                  </div>
                </div>

                {/* Detail per kelas */}
                {saveProgress.details && saveProgress.details.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {saveProgress.details.map((d, i) => (
                      <div
                        key={d.wId || i}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
                          d.status === "ok"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : d.status === "error"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : d.status === "offline"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-slate-50 text-slate-600 border border-slate-200"
                        }`}
                      >
                        <span className="shrink-0 text-sm">
                          {d.status === "ok" ? (
                            "✅"
                          ) : d.status === "error" ? (
                            "❌"
                          ) : d.status === "offline" ? (
                            "📱"
                          ) : (
                            <svg
                              className="animate-spin h-3.5 w-3.5 text-teal-600"
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
                        <span className="ml-auto shrink-0 text-[10px] font-semibold opacity-75">
                          {d.status === "ok"
                            ? "Tersimpan"
                            : d.status === "error"
                              ? "Gagal"
                              : d.status === "offline"
                                ? "Antrian HP"
                                : "Mengirim..."}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer info */}
                {saveProgress.phase === "done" && (
                  <p className="text-[11px] text-emerald-600 text-center font-medium">
                    Menutup otomatis dalam beberapa detik...
                  </p>
                )}
                {saveProgress.phase === "error" && (
                  <button
                    type="button"
                    onClick={() => setSaveProgress(null)}
                    className="w-full text-xs py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                  >
                    Tutup
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[94vh] relative">
          {/* MODAL DIALOG PILIHAN SINKRONISASI */}
          {syncPromptOpen && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs">
              <div className="bg-white rounded-2xl sm:rounded-3xl p-5 max-w-sm sm:max-w-md w-full shadow-2xl border border-slate-200 text-center space-y-3.5">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center text-2xl shadow-inner">
                  ⚡
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm sm:text-base font-black text-slate-900">
                    Pembaruan Data Wajah Siswa
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-semibold">
                    Apakah ingin memeriksa penambahan foto wajah siswa baru dari wali kelas?
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Pilih <strong className="text-emerald-700">Sinkron Cepat</strong> untuk hanya mengambil foto yang baru didaftarkan, atau <strong className="text-slate-700">Lewati</strong> agar kamera langsung siap tanpa jeda.
                  </p>
                </div>

                <div className="space-y-2 pt-1.5">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => {
                      setSyncPromptOpen(false);
                      handleSinkronCepat();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black shadow-md transition-all cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 ring-2 ring-emerald-400/50"
                  >
                    <span>⚡</span>
                    <span>Sinkron Cepat (Rekomendasi)</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSyncPromptOpen(false);
                        loadStudentFaceProfilesParallel(
                          studentProfilesRef.current?.length
                            ? studentProfilesRef.current
                            : siswaList,
                          true,
                        );
                      }}
                      className="w-1/2 py-2 px-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      🔄 Sinkron Ulang
                    </button>

                    <button
                      type="button"
                      onClick={() => setSyncPromptOpen(false)}
                      className="w-1/2 py-2 px-2.5 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold transition-all cursor-pointer"
                    >
                      ✕ Lewati (Default)
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* HEADER MODAL */}
          <div className="flex items-center justify-between px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded-md bg-teal-400/20 text-teal-300 text-sm shrink-0">
                🧏
              </span>
              <div className="leading-tight min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-black tracking-tight truncate">
                    Scan Presensi Wajah
                  </h3>
                  {/* PEMILIH KELAS / SCAN PINTAR */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowClassDropdown((v) => !v)}
                      className="inline-flex items-center gap-1 text-[9.5px] px-2 py-0.5 rounded-full bg-teal-400/25 hover:bg-teal-400/40 text-teal-100 font-black border border-teal-300/40 transition-all cursor-pointer shadow-2xs active:scale-95 shrink-0"
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
                                    Pindai otomatis wajah siswa dari kelas mana
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
                </div>
                <p className="text-[9px] text-teal-200 truncate mt-0.5">
                  {templateInfo.ready}/{registeredFaceCount} siap •{" "}
                  {stats.hadir}/{stats.total} hadir
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* TOMBOL SINKRON SPLIT: Cepat + Ulang */}
              <div className="relative" ref={syncMenuRef}>
                <div className="flex items-center rounded-lg overflow-hidden border border-teal-300/40 divide-x divide-teal-300/40">
                  {/* Tombol utama: Sinkron Cepat */}
                  <button
                    onClick={handleSinkronCepat}
                    disabled={syncingFaces}
                    className="px-2 py-1 bg-teal-500/25 hover:bg-teal-500/40 text-teal-100 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                    title="Sinkron Cepat: hanya data baru/berubah"
                  >
                    <span className={syncingFaces ? "animate-spin" : ""}>⚡</span>
                    <span className="hidden sm:inline">
                      {syncingFaces ? "Sinkron..." : "Cepat"}
                    </span>
                  </button>
                  {/* Dropdown arrow: Sinkron Ulang */}
                  <button
                    onClick={() => setShowSyncMenu((v) => !v)}
                    disabled={syncingFaces}
                    className="px-1.5 py-1 bg-teal-500/25 hover:bg-teal-500/40 text-teal-100 text-[10px] font-bold transition-all cursor-pointer disabled:opacity-50"
                    title="Pilihan sinkron"
                    aria-label="Pilihan sinkron"
                  >
                    ▾
                  </button>
                </div>
                {showSyncMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden min-w-[140px]">
                    <button
                      type="button"
                      onClick={handleSinkronCepat}
                      disabled={syncingFaces}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-teal-200 hover:bg-teal-800/50 transition-colors cursor-pointer disabled:opacity-50 text-left"
                    >
                      <span>⚡</span>
                      <span>Sinkron Cepat</span>
                    </button>
                    <div className="border-t border-slate-700" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowSyncMenu(false);
                        loadStudentFaceProfilesParallel(siswaList, true);
                      }}
                      disabled={syncingFaces}
                      className="w-full flex items-center gap-2 px-3 py-2 text-[11px] font-bold text-amber-300 hover:bg-amber-900/40 transition-colors cursor-pointer disabled:opacity-50 text-left"
                    >
                      <span>🔄</span>
                      <span>Sinkron Ulang</span>
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={toggleCameraFacing}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                title="Ganti Kamera Depan / Belakang"
              >
                <span>📷</span>
                <span>{cameraFacing === "environment" ? "Blkg" : "Dpn"}</span>
              </button>
              <button
                type="button"
                onClick={handleToggleFastVerify}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  isFastVerify
                    ? "bg-violet-500 text-white shadow-md"
                    : "bg-white/10 hover:bg-white/20 text-white"
                }`}
                title="Verifikasi Cepat (tanpa toleh, kode 1230)"
              >
                <span>⚡</span>
                <span>{isFastVerify ? "Cepat ON" : "Cepat"}</span>
              </button>
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
          </div>

          {/* TAB NAVIGASI & SWITCH KE BARCODE / REGULER */}
          <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-50 px-2.5 sm:px-4 py-1.5 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab("kamera")}
                className={`px-2.5 py-1 text-[11px] sm:text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === "kamera"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                <span>🧏</span>
                <span>Kamera</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded-full font-bold ${
                    activeTab === "kamera"
                      ? "bg-white/25 text-white"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {stats.hadir}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("daftar")}
                className={`px-2.5 py-1 text-[11px] sm:text-xs font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  activeTab === "daftar"
                    ? "bg-emerald-600 text-white shadow-xs"
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
              {typeof onOpenBarcode === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onOpenBarcode();
                  }}
                  className="px-2 py-1 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 font-bold text-[10px] sm:text-[11px] border border-teal-300 flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="Beralih ke Scan Barcode"
                >
                  <span>📷</span>
                  <span>Barcode</span>
                </button>
              )}
              {typeof onOpenReguler === "function" && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
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

          {/* BODY AREA */}
          <div className="p-2 sm:p-3.5 overflow-y-auto space-y-2 flex-1 bg-slate-50/50">
            {/* NOTIFIKASI HASIL SINKRON CEPAT / SINKRON ULANG */}
            {syncResultInfo && (
              <div
                className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all shadow-sm ${
                  syncResultInfo.newCount > 0
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-900"
                    : "bg-slate-100 border-slate-300 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">
                    {syncResultInfo.newCount > 0 ? "⚡" : "✓"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-black">
                      {syncResultInfo.newCount > 0
                        ? `Sinkron Cepat: ${syncResultInfo.newCount} foto wajah baru ditambahkan!`
                        : `Sinkron Cepat: Data wajah sudah mutakhir (${syncResultInfo.registeredCount || 0} dari ${syncResultInfo.totalSiswa || 0} siswa terdaftar)`}
                    </p>
                    <p className="text-[10px] text-slate-500 font-normal">
                      {syncResultInfo.registeredCount || 0} foto siap scan • {syncResultInfo.noPhotoCount || 0} siswa belum ada foto • Selesai {(syncResultInfo.durationMs / 1000).toFixed(1)}s
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSyncResultInfo(null)}
                  className="w-5 h-5 rounded-full hover:bg-black/10 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer text-xs"
                  title="Tutup notifikasi"
                >
                  ✕
                </button>
              </div>
            )}

            {/* STATISTIK RINGKAS */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              <div className="py-1 px-1 rounded-lg bg-slate-100 border border-slate-200">
                <div className="text-[8.5px] text-slate-500 font-bold uppercase">
                  Total
                </div>
                <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">
                  {stats.total}
                </div>
              </div>
              <div className="py-1 px-1 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="text-[8.5px] text-emerald-700 font-bold uppercase">
                  Hadir
                </div>
                <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">
                  {stats.hadir}
                </div>
              </div>
              <div className="py-1 px-1 rounded-lg bg-amber-50 border border-amber-200">
                <div className="text-[8.5px] text-amber-700 font-bold uppercase">
                  Sakit/Izin
                </div>
                <div className="text-xs sm:text-sm font-black text-amber-700 mt-0.5">
                  {stats.sakit + stats.izin}
                </div>
              </div>
              <div className="py-1 px-1 rounded-lg bg-rose-50 border border-rose-200">
                <div className="text-[8.5px] text-rose-700 font-bold uppercase">
                  Belum
                </div>
                <div className="text-xs sm:text-sm font-black text-rose-700 mt-0.5">
                  {stats.belumScan + stats.alfa + stats.cabut}
                </div>
              </div>
            </div>

            {/* TAB 1: KAMERA SCAN WAJAH — DITUTUP (DI LUAR JAM OPERASIONAL) */}
            {activeTab === "kamera" && isLockedByTime && (
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950 border-2 border-slate-700 w-full h-[58vh] sm:h-[430px] min-h-[350px] max-h-[520px] flex flex-col items-center justify-center p-6 shadow-lg text-white text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-3xl shadow-inner animate-pulse">
                  🔒
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base sm:text-lg font-black text-white tracking-wide">
                    Presensi Wajah Ditutup
                  </h3>
                  <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                    Presensi Scan Wajah dibuka pukul{" "}
                    <strong className="text-teal-300">06.30 – 08.00 WIB</strong>
                    .
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
                        if (e.key === "Enter") handleUnlockWajahWithCode();
                      }}
                      placeholder="Masukkan kode 1230..."
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white placeholder-slate-500 text-xs font-mono text-center tracking-widest focus:outline-hidden focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={handleUnlockWajahWithCode}
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
              <div className="space-y-1.5 relative">
                {/* STATUS KRITIS MODEL AI / FOTO GAGAL */}
                {engineStatus === "fallback" && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center justify-between gap-1.5 shadow-xs">
                    <span className="truncate font-semibold">
                      ⚠️ Model AI gagal dimuat. Periksa koneksi internet.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        resetFaceApiPromise();
                        setEngine("loading");
                        setEngineNonce((n) => n + 1);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-[10px] shrink-0 cursor-pointer transition-all shadow-xs"
                    >
                      🔄 Ulangi
                    </button>
                  </div>
                )}
                {engineStatus === "loading" && (
                  <div className="px-2.5 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-[10.5px] flex items-center gap-1.5 shadow-xs animate-pulse">
                    <span className="animate-spin text-xs">⏳</span>
                    <span className="font-semibold">
                      Sedang memuat model kecerdasan buatan (AI)...
                    </span>
                  </div>
                )}
                {templateInfo.failed.length > 0 && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[10.5px] flex flex-col gap-1 shadow-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between gap-1.5 font-bold">
                      <span>
                        ⚠️ {templateInfo.failed.length} foto siswa perlu didaftarkan ulang (harus lurus & jelas):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          templateInfo.failed.forEach((f) => {
                            const p = studentProfilesRef.current.find((sp) => sp.nama === f.nama);
                            if (p?.idSiswa) {
                              try {
                                localStorage.removeItem(DESC_KEY + p.idSiswa);
                              } catch (_) {}
                            }
                          });
                          loadStudentFaceProfilesParallel(studentProfilesRef.current, true);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-bold text-[9.5px] shrink-0 cursor-pointer transition-all shadow-xs"
                        title="Coba analisis ulang foto dengan deteksi adaptif"
                      >
                        🔄 Proses Ulang
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {templateInfo.failed.map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-amber-200/80 border border-amber-400/60 font-bold text-amber-950 text-[10px] flex items-center gap-1 shadow-2xs"
                        >
                          <span>👤</span>
                          <span>{s.nama}</span>
                          {s.kelas && (
                            <span className="text-[9px] px-1 py-0.1 rounded bg-amber-300/80 text-amber-900 font-mono font-semibold">
                              {s.kelas}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {/* BANNER VERIFIKASI CEPAT */}
                {isFastVerify && (
                  <div className="px-2.5 py-1.5 rounded-xl bg-violet-50 border border-violet-300 text-violet-800 text-[11px] flex items-center justify-between gap-1.5 shadow-xs">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>⚡</span>
                      <span className="font-bold">
                        Mode Verifikasi Cepat aktif
                      </span>
                      <span className="text-violet-600 truncate">
                        – Tahap toleh dilewati
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsFastVerify(false)}
                      className="px-2 py-0.5 rounded-lg bg-violet-200 hover:bg-violet-300 text-violet-900 font-bold text-[10px] shrink-0 cursor-pointer transition-all shadow-xs"
                    >
                      Matikan
                    </button>
                  </div>
                )}

                {/* CONTAINER KAMERA PEMINDAI (MOBILE-OPTIMIZED VIEWPORT) */}
                <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-black border-2 border-slate-700 w-full h-[58vh] sm:h-[430px] min-h-[350px] max-h-[520px] flex items-center justify-center shadow-lg">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className={`w-full h-full object-cover ${cameraFacing === "user" ? "-scale-x-100" : ""}`}
                  />

                  {/* OVERLAY PANDUAN PENGAMBILAN WAJAH */}
                  {cameraActive && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* TOP HUD: PANDUAN SISWA & STEPPER TANTANGAN (BEBAS TUMPANG TINDIH) */}
                      <div className="absolute top-2.5 inset-x-2 flex flex-col items-center gap-1 z-20 pointer-events-none">
                        {/* Kartu Status Panduan Utama */}
                        <div
                          className={`max-w-[92%] text-center px-3.5 py-1.5 rounded-full text-[11px] sm:text-xs font-black shadow-xl backdrop-blur-md transition-all border ${
                            scanZoneState === "multiple"
                              ? "bg-rose-950/95 text-rose-200 border-rose-500 shadow-rose-500/30"
                              : scanZoneState === "adjust" ||
                                  scanZoneState === "moving"
                                ? "bg-amber-950/95 text-amber-200 border-amber-400 shadow-amber-400/30"
                                : scanZoneState === "verifying" ||
                                    scanZoneState === "success"
                                  ? "bg-emerald-950/95 text-emerald-200 border-emerald-400 shadow-emerald-400/30"
                                  : "bg-slate-950/85 text-teal-200 border-teal-400/40"
                          }`}
                        >
                          {liveFaceStatus}
                        </div>

                        {/* Stepper Tantangan Toleh / Verifikasi Cepat */}
                        {challengeStep >= 0 && (
                          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                            {isFastVerify ? (
                              // Mode Verifikasi Cepat: Hanya Tahap 1 (Hadap) dan 3 (Lurus)
                              <>
                                {[
                                  { num: "1", label: "Hadap" },
                                  { num: "3", label: "Lurus" },
                                ].map((stepItem, i) => {
                                  // challengeStep 0=Hadap, 2=Lurus
                                  const done =
                                    (i === 0 && challengeStep > 0) ||
                                    (i === 1 && challengeStep >= 2);
                                  const active =
                                    (i === 0 && challengeStep === 0) ||
                                    (i === 1 && challengeStep === 2);
                                  return (
                                    <span
                                      key={stepItem.label}
                                      className={`px-2 py-0.5 rounded-full text-[9.5px] font-black border backdrop-blur-md transition-all ${
                                        done
                                          ? "bg-emerald-500 text-black border-emerald-300 shadow-xs"
                                          : active
                                            ? "bg-violet-400 text-black border-violet-200 animate-pulse shadow-xs ring-1 ring-violet-300"
                                            : "bg-black/60 text-slate-300 border-white/20"
                                      }`}
                                    >
                                      {done ? "✓" : stepItem.num}{" "}
                                      {stepItem.label}
                                    </span>
                                  );
                                })}
                                <span className="text-[9px] text-violet-200 font-bold bg-violet-900/60 border border-violet-500/30 px-1.5 py-0.5 rounded-full">
                                  ⚡ Cepat
                                </span>
                              </>
                            ) : (
                              // Mode Normal: 3 tahap
                              [
                                { num: "1", label: "Hadap" },
                                { num: "2", label: "Toleh" },
                                { num: "3", label: "Lurus" },
                              ].map((stepItem, i) => {
                                const done = i < challengeStep;
                                const active = i === challengeStep;
                                return (
                                  <span
                                    key={stepItem.label}
                                    className={`px-2 py-0.5 rounded-full text-[9.5px] font-black border backdrop-blur-md transition-all ${
                                      done
                                        ? "bg-emerald-500 text-black border-emerald-300 shadow-xs"
                                        : active
                                          ? "bg-amber-400 text-black border-amber-200 animate-pulse shadow-xs ring-1 ring-amber-300"
                                          : "bg-black/60 text-slate-300 border-white/20"
                                    }`}
                                  >
                                    {done ? "✓" : stepItem.num} {stepItem.label}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        )}

                        {/* Baris Kalibrasi / Debug (Hanya saat diaktifkan) */}
                        {showDebug && debugLine && (
                          <div className="max-w-[94%] text-center px-2 py-0.5 rounded-md bg-black/85 text-yellow-300 text-[9px] font-mono border border-yellow-400/40 shadow-md backdrop-blur-sm truncate">
                            🔍 {debugLine}
                          </div>
                        )}
                      </div>

                      {/* ZONA PEMINDAIAN WAJAH (RETICLE ERGONOMIS PONSEL — BERSIH TANPA TEKS PENUTUP MATA) */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                        <div
                          className={`relative w-[205px] h-[255px] sm:w-[245px] sm:h-[305px] rounded-3xl border-2 transition-all duration-300 flex flex-col justify-between p-2.5 ${
                            scanZoneState === "multiple"
                              ? "border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.6)] bg-rose-950/20"
                              : scanZoneState === "adjust" ||
                                  scanZoneState === "moving"
                                ? "border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)] bg-amber-950/15"
                                : scanZoneState === "verifying" ||
                                    scanZoneState === "success"
                                  ? "border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.7)] bg-emerald-950/20"
                                  : "border-teal-400/40 shadow-[0_0_15px_rgba(45,212,191,0.2)] bg-black/10"
                          }`}
                        >
                          {/* Sudut Fokus (Corner Brackets Minimalis) */}
                          <div className="absolute -top-1 -left-1 w-6 h-6 border-t-3 border-l-3 rounded-tl-xl border-current opacity-90" />
                          <div className="absolute -top-1 -right-1 w-6 h-6 border-t-3 border-r-3 rounded-tr-xl border-current opacity-90" />
                          <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-3 border-l-3 rounded-bl-xl border-current opacity-90" />
                          <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-3 border-r-3 rounded-br-xl border-current opacity-90" />

                          {/* Indikator Ping di Sudut Kanan Atas */}
                          <div className="w-full flex justify-end">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                scanZoneState === "multiple"
                                  ? "bg-rose-500 animate-ping"
                                  : scanZoneState === "verifying" ||
                                      scanZoneState === "success"
                                    ? "bg-emerald-400 animate-ping"
                                    : "bg-teal-400/50"
                              }`}
                            />
                          </div>

                          {/* Garis Pemindai Halus Animasi */}
                          {(scanZoneState === "verifying" ||
                            scanZoneState === "standby") && (
                            <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-teal-300 to-transparent opacity-65 animate-pulse my-auto" />
                          )}

                          {/* Titik Pusat Fokus */}
                          <div className="flex justify-center items-center w-full">
                            <div className="w-2 h-2 rounded-full border border-teal-300/40 opacity-60" />
                          </div>
                        </div>
                      </div>

                      {/* LIVE FACE TRACKING BOXES (mendukung 1 siswa maupun multi-siswa) */}
                      {liveFaceBoxes.map((box, idx) => (
                        <div
                          key={idx}
                          className={`absolute rounded-xl border-2 transition-all duration-75 flex flex-col justify-between p-1 pointer-events-none ${
                            box.status === "verified" || box.status === "duplicate"
                              ? "border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.7)] bg-emerald-500/10"
                              : box.status === "verifying"
                              ? "border-teal-400 shadow-[0_0_12px_rgba(45,212,191,0.6)] bg-teal-500/10"
                              : "border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.5)] bg-sky-500/10"
                          }`}
                          style={{
                            left: `${box.leftPct}%`,
                            top: `${box.topPct}%`,
                            width: `${box.widthPct}%`,
                            height: `${box.heightPct}%`,
                          }}
                        >
                          <span
                            className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded w-fit truncate max-w-[130px] shadow-xs ${
                              box.status === "verified" || box.status === "duplicate"
                                ? "bg-emerald-950/90 text-emerald-200 border border-emerald-500/40"
                                : box.status === "verifying"
                                ? "bg-teal-950/90 text-teal-200 border border-teal-500/40"
                                : "bg-slate-900/90 text-slate-200 border border-slate-700"
                            }`}
                          >
                            {box.label || "SISWA"}
                          </span>
                          <div className="w-full flex justify-end">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                box.status === "verified" || box.status === "duplicate"
                                  ? "bg-emerald-400"
                                  : "bg-teal-400 animate-ping"
                              }`}
                            />
                          </div>
                        </div>
                      ))}

                      {/* BOTTOM HUD: STATUS AMAN TANPA MENABRAK RETICLE */}
                      <div className="absolute bottom-2.5 inset-x-0 flex justify-center pointer-events-none z-10">
                        <div className="px-3 py-0.5 rounded-full bg-black/75 text-emerald-300 text-[9px] font-mono font-bold border border-emerald-500/25 backdrop-blur-xs shadow-xs">
                          Deteksi Wajah Aktif • Cooldown 3s
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODAL NOTIFIKASI LOADING BAR BERTINGKAT DI TENGAH LAYAR (SINKRON HARIAN PERTAMA KALI) */}
                  {syncModalProgress && syncModalProgress.show && (
                    <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
                      <div className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-3.5">
                        {/* Ikon Tahap */}
                        <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-3xl shadow-inner">
                          {syncModalProgress.pct === 100
                            ? "✅"
                            : syncModalProgress.stage === 1
                              ? "📥"
                              : syncModalProgress.stage === 2
                                ? "🧠"
                                : "⚡"}
                        </div>

                        {/* Judul & Keterangan */}
                        <div className="space-y-1 w-full">
                          <div className="flex items-center justify-between text-[10px] font-black text-teal-700 uppercase tracking-wider">
                            <span>
                              Tahap {syncModalProgress.stage} dari{" "}
                              {syncModalProgress.totalStages}
                            </span>
                            <span className="font-mono text-xs font-bold text-teal-800">
                              {syncModalProgress.pct}%
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                            {syncModalProgress.title}
                          </h4>
                          <p className="text-[11px] sm:text-xs text-slate-500 leading-relaxed">
                            {syncModalProgress.desc}
                          </p>
                        </div>

                        {/* Loading Bar Bertingkat */}
                        <div className="w-full space-y-1.5">
                          <div className="w-full h-3 rounded-full bg-slate-100 p-0.5 border border-slate-200 overflow-hidden shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                syncModalProgress.pct === 100
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  : "bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 animate-pulse"
                              }`}
                              style={{ width: `${syncModalProgress.pct}%` }}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
                            <span className="truncate mr-2">
                              {syncModalProgress.detail ||
                                "Sedang memproses..."}
                            </span>
                            <span className="font-bold shrink-0">
                              {syncModalProgress.pct}%
                            </span>
                          </div>
                        </div>

                        {/* Indikator Tahap (Step Dots) */}
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {[1, 2, 3].map((stg) => (
                            <div
                              key={stg}
                              className={`h-1.5 rounded-full transition-all duration-300 ${
                                stg < syncModalProgress.stage ||
                                syncModalProgress.pct === 100
                                  ? "w-6 bg-emerald-500"
                                  : stg === syncModalProgress.stage
                                    ? "w-8 bg-teal-600 animate-pulse"
                                    : "w-3 bg-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* OVERLAY NOTIFIKASI BESAR DI TENGAH LAYAR */}
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
                            ? "Hadir Terverifikasi"
                            : scanOverlay.type === "duplicate"
                              ? "Sudah Hadir"
                              : "Tidak Dikenal"}
                        </div>

                        {scanOverlay.nama && (
                          <div className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-white drop-shadow-md">
                            {scanOverlay.nama}
                          </div>
                        )}

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

                        {scanOverlay.type === "success" && (
                          <div className="text-2xl sm:text-3xl font-black font-mono text-emerald-300 tracking-wide drop-shadow-lg">
                            {scanOverlay.waktu} WIB
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Kamera */}
                  {cameraError && (
                    <div className="absolute inset-0 p-4 bg-slate-900/90 text-white flex flex-col items-center justify-center text-center space-y-2">
                      <span className="text-3xl">📷</span>
                      <p className="text-xs text-rose-300 max-w-sm">
                        {cameraError}
                      </p>
                      <button
                        onClick={startCamera}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer"
                      >
                        Coba Buka Kamera Lagi
                      </button>
                    </div>
                  )}
                </div>

                <label className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-500 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showDebug}
                    onChange={(e) => setShowDebug(e.target.checked)}
                    className="rounded w-3.5 h-3.5"
                  />
                  <span>
                    Tampilkan jarak kemiripan (untuk uji coba / kalibrasi)
                  </span>
                </label>

                {/* LIST SISWA TERAKHIR DISCAN */}
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
                              <span className="font-bold truncate">
                                {s.nama}
                              </span>
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

            {/* TAB 2: DAFTAR SISWA & STATUS MANUAL */}
            {activeTab === "daftar" && (
              <div className="space-y-4">
                {/* Siswa Belum Discan */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      <span>Siswa Belum Hadir ({siswaBelumDiscan.length})</span>
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      Tandai Sakit / Izin
                    </span>
                  </div>

                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {siswaBelumDiscan.map((s) => {
                      const curStatus = manualStatusMap[s.idSiswa] || "Alfa";
                      return (
                        <div
                          key={s.idSiswa}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
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
                                onClick={() => handleUpdateManualStatus(s, st)}
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
                </div>

                {/* Siswa Hadir */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Siswa Sudah Hadir ({siswaSudahDiscan.length})</span>
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

          {/* FOOTER AKSI */}
          <div className="px-3 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <button
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>

              {/* Indikator Status Simpan Terakhir */}
              <div className="text-[10px] sm:text-[11px] leading-tight text-slate-500">
                {lastOnlineSaveTime ? (
                  <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                    <span className="text-xs">☁️</span>
                    <span>
                      Update Online: {formatLastSavedIndo(lastOnlineSaveTime)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="text-xs">📱</span>
                    <span>Tersimpan Offline di HP</span>
                  </div>
                )}
                {pendingOfflineRecords.length > 0 && (
                  <div className="text-[9.5px] font-bold text-amber-600 mt-0.5 flex items-center gap-1">
                    <span>⚠️</span>
                    <span>
                      +{pendingOfflineRecords.length} presensi offline belum
                      tersimpan online
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!isLockedByTime && (
              <button
                onClick={handleSubmitPresensi}
                disabled={saving || stats.total === 0}
                className="px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-700 active:scale-95 text-white text-xs sm:text-sm font-black transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span className="text-base">{saving ? "⏳" : "💾"}</span>
                <div className="flex flex-col text-left">
                  <span>
                    {saving
                      ? "Menyimpan ke Spreadsheet..."
                      : pendingOfflineRecords.length > 0
                        ? `Simpan Online (${stats.hadir + stats.sakit + stats.izin} Siswa + ${pendingOfflineRecords.length} Offline)`
                        : hasPreviousSubmission
                          ? "Perbarui Presensi Kelas"
                          : "Simpan Presensi Kelas"}
                  </span>
                  {lastOnlineSaveTime && !saving && (
                    <span className="text-[9px] font-normal text-emerald-100 opacity-90 truncate">
                      Update Terakhir: {formatLastSavedIndo(lastOnlineSaveTime)}
                    </span>
                  )}
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
      {/* MODAL VERIFIKASI CEPAT — Input Kode 1230 */}
      {showFastVerifyModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xs p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="text-3xl">⚡</div>
              <h3 className="text-sm font-black text-slate-900">
                Aktifkan Verifikasi Cepat
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                Mode ini melewati tahap toleh kepala. Masukkan kode untuk
                mengaktifkan.
              </p>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                inputMode="numeric"
                value={fastVerifyCodeInput}
                onChange={(e) => {
                  setFastVerifyCodeInput(e.target.value);
                  if (fastVerifyError) setFastVerifyError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmFastVerifyCode();
                }}
                placeholder="Kode akses..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono text-center tracking-widest focus:outline-none focus:border-violet-400"
                autoFocus
              />
              {fastVerifyError && (
                <div className="text-[11px] text-rose-600 font-semibold">
                  ⚠️ {fastVerifyError}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowFastVerifyModal(false);
                  setFastVerifyError("");
                }}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmFastVerifyCode}
                className="flex-1 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black cursor-pointer"
              >
                Aktifkan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
