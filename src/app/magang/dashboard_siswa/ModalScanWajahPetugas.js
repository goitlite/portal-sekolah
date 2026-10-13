"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  getPresensiWaliGrid,
  savePresensiWaliKelas,
  getBiodataSiswa,
} from "../lib/api";

// =====================================================================
// KONFIGURASI
// =====================================================================
// Batas jam presensi. CATATAN: komentar lama menyebut 08:30, tetapi nilai
// yang aktif di kode sebelumnya adalah 23:30 (mode uji). Untuk produksi
// ubah menjadi BATAS_JAM = 8 dan BATAS_MENIT = 30.
const BATAS_JAM = 23;
const BATAS_MENIT = 30;

// Pengenalan wajah: jarak Euclidean antar deskriptor 128-d (makin kecil = makin mirip).
// Orang yang sama biasanya < 0.4, orang berbeda biasanya > 0.6.
const MATCH_DIST = 0.5; // kandidat dianggap cocok jika jarak <= ini
const LOOSE_DIST = 0.6; // di atas ini = jelas bukan siapa pun
const MARGIN_MIN = 0.06; // jarak siswa terdekat ke-2 harus lebih jauh sekian (anti-ragu)
const VOTES_NEEDED = 3; // jumlah hasil identik berturut-turut sebelum dicatat hadir
const VOTE_WINDOW_MS = 3500; // jendela waktu pengumpulan suara
const MIN_FACE_RATIO = 0.16; // lebar wajah minimal terhadap lebar frame kamera
const MAX_YAW = 0.35; // toleransi menoleh (rasio hidung terhadap jarak mata)
const MAX_ROLL_DEG = 22; // toleransi kepala miring
const DETECT_INTERVAL_MS = 110; // jeda antar deteksi wajah
const DESC_INTERVAL_MS = 300; // jeda antar pembuatan deskriptor (bagian paling berat)
const SCAN_COOLDOWN_MS = 3000; // jeda anti-duplikat setelah satu siswa tercatat

const FA_VERSION = "1.7.15";
const FA_BUNDLE = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FA_VERSION}/dist/face-api.esm.js`;
const FA_MODELS = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FA_VERSION}/model/`;

// =====================================================================
// HELPER UMUM
// =====================================================================
function checkIsPastTimeLimit() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return hours > BATAS_JAM || (hours === BATAS_JAM && minutes >= BATAS_MENIT);
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

// <PURE-HELPERS>
function euclid(a, b) {
  let s = 0;
  for (let i = 0; i < 128; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// Cari siswa paling mirip + jarak ke siswa terdekat kedua
function matchFace(desc, profiles) {
  let best = null;
  let d1 = Infinity;
  let d2 = Infinity;
  for (const p of profiles) {
    const d = euclid(desc, p.descriptor);
    if (d < d1) {
      d2 = d1;
      d1 = d;
      best = p;
    } else if (d < d2) {
      d2 = d;
    }
  }
  return { best, d1, d2 };
}

function isConfident(d1, d2) {
  return d1 <= MATCH_DIST && d2 - d1 >= MARGIN_MIN;
}

// Kumpulkan suara; kembalikan idSiswa jika sudah terkonfirmasi (atau null)
function pushVote(votes, id, now) {
  while (votes.length && now - votes[0].t > VOTE_WINDOW_MS) votes.shift();
  votes.push({ id, t: now });
  if (!id) return null;
  const counts = {};
  for (const v of votes) if (v.id) counts[v.id] = (counts[v.id] || 0) + 1;
  if ((counts[id] || 0) < VOTES_NEEDED) return null;
  for (const k of Object.keys(counts)) {
    if (k !== id && counts[k] >= 2) return null; // ada kandidat lain yang bersaing
  }
  return id;
}

// Kotak wajah (piksel video) -> persen di kontainer (video memakai object-cover)
function mapBoxToContainer(box, vw, vh, cw, ch, mirror) {
  const scale = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;
  const w = box.width * scale;
  const h = box.height * scale;
  let left = box.x * scale + ox;
  const top = box.y * scale + oy;
  if (mirror) left = cw - left - w;
  return {
    leftPct: (left / cw) * 100,
    topPct: (top / ch) * 100,
    widthPct: (w / cw) * 100,
    heightPct: (h / ch) * 100,
  };
}

function centerOf(pts) {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

// Perkiraan arah hadap & kemiringan dari 68 titik landmark
function headPose(landmarks) {
  const eyes = [centerOf(landmarks.getLeftEye()), centerOf(landmarks.getRightEye())].sort(
    (a, b) => a.x - b.x,
  );
  const nose = landmarks.getNose();
  const tip = nose[3] || nose[Math.floor(nose.length / 2)];
  const dx = eyes[1].x - eyes[0].x;
  const dy = eyes[1].y - eyes[0].y;
  const eyeDist = Math.hypot(dx, dy) || 1;
  const midX = (eyes[0].x + eyes[1].x) / 2;
  return {
    yaw: (tip.x - midX) / eyeDist,
    rollDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}
// </PURE-HELPERS>

// =====================================================================
// FACE-API (deskriptor wajah 128-d) — dimuat sekali per sesi halaman
// =====================================================================
let faPromise = null;
function loadFaceApi() {
  if (faPromise) return faPromise;
  faPromise = (async () => {
    const fa = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ FA_BUNDLE
    );
    let backendOk = false;
    try {
      backendOk = await fa.tf.setBackend("webgl");
    } catch (_) {}
    if (!backendOk) await fa.tf.setBackend("cpu"); // perangkat tanpa WebGL
    await fa.tf.ready();
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri(FA_MODELS),
      fa.nets.faceLandmark68TinyNet.loadFromUri(FA_MODELS),
      fa.nets.faceRecognitionNet.loadFromUri(FA_MODELS),
    ]);
    return fa;
  })().catch((err) => {
    faPromise = null; // boleh dicoba lagi
    throw err;
  });
  return faPromise;
}

// Cache template per siswa, TERIKAT pada URL foto: jika siswa mendaftar ulang
// (URL berubah) template lama otomatis dibuang di semua perangkat.
const DESC_KEY = "face_desc_v2_";
function readCachedDescriptor(idSiswa, url) {
  try {
    const raw = localStorage.getItem(DESC_KEY + idSiswa);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (o?.url === url && Array.isArray(o.d) && o.d.length === 128) {
      return Float32Array.from(o.d);
    }
  } catch (_) {}
  return null;
}
function writeCachedDescriptor(idSiswa, url, desc) {
  try {
    localStorage.setItem(
      DESC_KEY + idSiswa,
      JSON.stringify({ url, d: Array.from(desc, (v) => +v.toFixed(5)) }),
    );
  } catch (_) {}
}

function driveThumbUrl(url, size = 800) {
  if (!url) return "";
  let id = "";
  if (url.includes("/file/d/")) id = url.split("/file/d/")[1].split("/")[0];
  else if (url.includes("id=")) id = url.split("id=")[1].split("&")[0];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : url;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("gagal memuat gambar"));
    img.src = src;
  });
}

// Coba lewat proxy internal dulu (aman dari CORS), lalu langsung dari Drive
async function loadFaceImage(url) {
  const candidates = [
    `/api/image-proxy?url=${encodeURIComponent(url)}`,
    driveThumbUrl(url, 800),
  ];
  let lastErr = null;
  for (const src of candidates) {
    try {
      return await loadImage(src);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("gagal memuat foto");
}

// Foto pendaftaran -> deskriptor 128-d (wajah diratakan lewat landmark)
async function computeTemplate(fa, url) {
  const img = await loadFaceImage(url);
  const det = await fa
    .detectSingleFace(
      img,
      new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }),
    )
    .withFaceLandmarks(true);
  if (!det) return { descriptor: null };
  const [canvas] = await fa.extractFaces(img, [det.landmarks.align()]);
  const descriptor = await fa.nets.faceRecognitionNet.computeFaceDescriptor(canvas);
  return { descriptor };
}

export default function ModalScanWajahPetugas({
  isOpen,
  onClose,
  petugasInfo, // { idWali, idGuru, namaKelas, kelas }
  user, // { id, nama }
  onPresensiSubmitted,
  onOpenBarcode,
  onOpenReguler,
}) {
  const [loadingData, setLoadingData] = useState(true);
  const [syncingFaces, setSyncingFaces] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("environment"); // "environment" (belakang) | "user" (depan)
  const [cameraError, setCameraError] = useState("");
  const [engineStatus, setEngineStatus] = useState("loading"); // loading | ready | fallback
  const [siswaList, setSiswaList] = useState([]);
  const [registeredFaceCount, setRegisteredFaceCount] = useState(0);
  const [templateInfo, setTemplateInfo] = useState({ total: 0, ready: 0, pending: 0, failed: [] });
  const [engineNonce, setEngineNonce] = useState(0);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLine, setDebugLine] = useState("");

  // Status visual deteksi wajah di layar kamera (Live HUD)
  const [liveFaceBox, setLiveFaceBox] = useState(null); // { leftPct, topPct, widthPct, heightPct }
  const [liveFaceStatus, setLiveFaceStatus] = useState("Arahkan kamera ke wajah siswa...");

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
      if (scanOverlayTimerRef.current) clearTimeout(scanOverlayTimerRef.current);
    };
  }, [scanOverlay]);

  // Pantau batas waktu 08:30 WIB
  useEffect(() => {
    if (!isOpen) return;
    const check = () => {
      const past = checkIsPastTimeLimit();
      setIsLockedByTime(past);
      if (past) setIsSubmittedToday(true);
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

  // 1. MUAT DATA SISWA & PROFIL FOTO WAJAH DARI SPREADSHEET (PARALEL CEPAT)
  useEffect(() => {
    if (!isOpen || !petugasInfo?.idWali || !petugasInfo?.idGuru) return;

    let isMounted = true;
    const waliId = petugasInfo.idWali;
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
      setLoadingData(true);
      try {
        const pastLimit = checkIsPastTimeLimit();
        setIsLockedByTime(pastLimit);

        const res = await getPresensiWaliGrid(
          petugasInfo.idGuru,
          petugasInfo.idWali,
        );
        if (!isMounted) return;

        if (!res.success) {
          throw new Error(res.message || "Gagal memuat data rombel.");
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

        setSiswaList(normalizedSiswa);
        MEMORY_SISWA_CACHE[waliId] = normalizedSiswa;
        try {
          localStorage.setItem(
            storageKeySiswa,
            JSON.stringify(normalizedSiswa),
          );
        } catch (_) {}

        // Sinkronisasi data presensi yang sudah tersimpan hari ini
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
          ...prev,
        }));
        setManualStatusMap((prev) => ({ ...existingManualMap, ...prev }));
        setManualKetMap((prev) => ({ ...existingKetMap, ...prev }));

        // Pra-muat profil foto wajah siswa secara paralel
        loadStudentFaceProfilesParallel(normalizedSiswa);
      } catch (err) {
        if (isMounted) {
          setCameraError(err.message || "Gagal memuat data kelas.");
        }
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }

    initClassData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, petugasInfo, todayISO]);

  // Ringkasan status template (untuk header & peringatan di layar)
  function syncTemplateInfo(profiles) {
    const reg = profiles.filter((p) => p.fotoWajah);
    setTemplateInfo({
      total: reg.length,
      ready: reg.filter((p) => p.descriptor).length,
      pending: reg.filter((p) => p.status === "pending").length,
      failed: reg
        .filter((p) => p.status === "noface" || p.status === "error")
        .map((p) => ({ nama: p.nama, reason: p.status })),
    });
  }

  // Siapkan profil wajah: URL foto -> template (deskriptor 128-d).
  // 1) Pakai URL dari cache agar scan bisa langsung jalan.
  // 2) Validasi URL ke server (sekali per sesi halaman / saat "Sinkron Wajah");
  //    jika ada yang berubah (siswa daftar ulang) profil dibangun ulang.
  async function loadStudentFaceProfilesParallel(siswaArray, forceRefresh = false) {
    if (forceRefresh) setSyncingFaces(true);
    const waliId = petugasInfo?.idWali || "unknown";
    const localCacheKey = `cached_face_urls_${waliId}`;

    try {
      let urlCache = {};
      try {
        const saved = localStorage.getItem(localCacheKey);
        if (saved) urlCache = JSON.parse(saved) || {};
      } catch (_) {}

      // --- URL awal dari cache lokal ---
      const urlsA = {};
      siswaArray.forEach((s) => {
        let u = urlCache[s.idSiswa] || null;
        if (!u) {
          try {
            const saved = localStorage.getItem(`face_reg_${s.idSiswa}`);
            if (saved) u = JSON.parse(saved)?.fotoWajah || null;
          } catch (_) {}
        }
        if (u) urlsA[s.idSiswa] = u;
      });

      const applyProfiles = async (urlMap) => {
        const jobId = ++templateJobRef.current;
        const profiles = siswaArray.map((s) => {
          const url = urlMap[s.idSiswa] || null;
          const cached = url ? readCachedDescriptor(s.idSiswa, url) : null;
          return {
            idSiswa: s.idSiswa,
            nama: s.nama,
            fotoWajah: url,
            descriptor: cached,
            status: !url ? "nophoto" : cached ? "ok" : "pending",
          };
        });
        studentProfilesRef.current = profiles;
        setRegisteredFaceCount(profiles.filter((p) => p.fotoWajah).length);
        syncTemplateInfo(profiles);

        const pending = profiles.filter((p) => p.status === "pending");
        if (pending.length === 0) return;

        let fa;
        try {
          fa = await loadFaceApi();
        } catch (_) {
          return; // status engine "fallback" ditangani efek pemuat model
        }
        for (const p of pending) {
          if (jobId !== templateJobRef.current) return;
          try {
            const res = await computeTemplate(fa, p.fotoWajah);
            if (res.descriptor) {
              p.descriptor = res.descriptor;
              p.status = "ok";
              writeCachedDescriptor(p.idSiswa, p.fotoWajah, res.descriptor);
            } else {
              p.status = "noface";
            }
          } catch (e) {
            console.warn("Template wajah gagal:", p.nama, e);
            p.status = "error";
          }
          if (jobId === templateJobRef.current) syncTemplateInfo(profiles);
        }
      };

      // Jalankan awal (tanpa menunggu selesai agar validasi server paralel)
      const firstRun = applyProfiles(urlsA);

      // --- Validasi URL ke server ---
      const mustCheck = forceRefresh || !SESSION_URL_CHECKED[waliId];
      if (mustCheck) {
        const urlsB = {};
        const BATCH_SIZE = 5;
        let allOk = true;
        for (let i = 0; i < siswaArray.length; i += BATCH_SIZE) {
          const batch = siswaArray.slice(i, i + BATCH_SIZE);
          await Promise.allSettled(
            batch.map(async (s) => {
              try {
                const bio = await getBiodataSiswa(s.idSiswa);
                if (bio?.success) {
                  if (bio.data?.fotoWajah) urlsB[s.idSiswa] = bio.data.fotoWajah;
                } else {
                  allOk = false;
                  if (urlsA[s.idSiswa]) urlsB[s.idSiswa] = urlsA[s.idSiswa];
                }
              } catch (_) {
                allOk = false;
                if (urlsA[s.idSiswa]) urlsB[s.idSiswa] = urlsA[s.idSiswa];
              }
            }),
          );
        }
        if (allOk) SESSION_URL_CHECKED[waliId] = true;

        try {
          localStorage.setItem(localCacheKey, JSON.stringify(urlsB));
        } catch (_) {}

        const changed =
          siswaArray.some((s) => (urlsA[s.idSiswa] || null) !== (urlsB[s.idSiswa] || null));
        if (changed || forceRefresh) {
          await applyProfiles(urlsB);
        } else {
          await firstRun;
        }
      } else {
        await firstRun;
      }
    } catch (err) {
      console.warn("Gagal menyiapkan profil wajah:", err);
    } finally {
      if (forceRefresh) setSyncingFaces(false);
    }
  }

  // Simpan draft lokal
  useEffect(() => {
    if (!petugasInfo?.idWali || isSubmittedToday) return;
    const draftKey = `draft_scan_${petugasInfo.idWali}_${todayISO}`;
    try {
      if (Object.keys(scannedMap).length > 0) {
        localStorage.setItem(draftKey, JSON.stringify(scannedMap));
      }
    } catch (_) {}
  }, [scannedMap, petugasInfo?.idWali, isSubmittedToday, todayISO]);

  // 2. MODEL PENGENALAN WAJAH (dimuat sekali per sesi halaman, lalu di-cache browser)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setEngine("loading");
    withTimeout(loadFaceApi(), 90000)
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
    return () => {
      cancelled = true;
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
    setLiveFaceBox(null);
  }

  // 4. LOOP PENGENALAN WAJAH (berurutan, tanpa tumpang-tindih)
  useEffect(() => {
    if (!isOpen || !cameraActive) return;
    const st = { alive: true, votes: [], lastDescAt: 0 };
    (async () => {
      while (st.alive) {
        const t0 = performance.now();
        try {
          await recognitionTick(st);
        } catch (e) {
          console.warn("Siklus pengenalan wajah gagal:", e);
        }
        const wait = Math.max(40, DETECT_INTERVAL_MS - (performance.now() - t0));
        await new Promise((r) => setTimeout(r, wait));
      }
    })();
    return () => {
      st.alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cameraActive, cameraFacing]);

  async function recognitionTick(st) {
    const video = videoRef.current;
    const fa = faRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    if (!fa) {
      setLiveFaceStatus(
        engineStatusRef.current === "fallback"
          ? "⚠️ Model pengenalan wajah gagal dimuat"
          : "⏳ Memuat model pengenalan wajah...",
      );
      return;
    }

    if (Date.now() - lastSuccessScanAt.current < SCAN_COOLDOWN_MS) {
      setLiveFaceStatus("⏳ Jeda anti-duplikat...");
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const dets = await fa
      .detectAllFaces(
        video,
        new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }),
      )
      .withFaceLandmarks(true);
    if (!st.alive) return;

    if (!dets || dets.length === 0) {
      st.votes.length = 0;
      setLiveFaceBox(null);
      setDebugLine("");
      setLiveFaceStatus("Arahkan kamera ke wajah siswa...");
      return;
    }

    // Wajah terbesar (terdekat ke kamera); wajah lain di belakang diabaikan
    const main = dets.reduce((a, b) =>
      b.detection.box.width * b.detection.box.height >
      a.detection.box.width * a.detection.box.height
        ? b
        : a,
    );
    const box = main.detection.box;

    setLiveFaceBox(
      mapBoxToContainer(
        box,
        vw,
        vh,
        video.clientWidth || vw,
        video.clientHeight || vh,
        cameraFacing === "user",
      ),
    );

    if (box.width / vw < MIN_FACE_RATIO) {
      st.votes.length = 0;
      setLiveFaceStatus("🔍 Dekatkan kamera ke wajah siswa");
      return;
    }

    const pose = headPose(main.landmarks);
    if (Math.abs(pose.yaw) > MAX_YAW || Math.abs(pose.rollDeg) > MAX_ROLL_DEG) {
      st.votes.length = 0;
      setLiveFaceStatus("😐 Minta siswa menghadap lurus ke kamera");
      return;
    }

    const now = Date.now();
    if (now - st.lastDescAt < DESC_INTERVAL_MS) return;
    st.lastDescAt = now;

    const profiles = (studentProfilesRef.current || []).filter((p) => p.descriptor);
    if (profiles.length === 0) {
      setLiveFaceStatus(
        "⚠️ Belum ada template wajah siap (tunggu / tekan Sinkron Wajah)",
      );
      return;
    }

    const [faceCanvas] = await fa.extractFaces(video, [main.landmarks.align()]);
    const desc = await fa.nets.faceRecognitionNet.computeFaceDescriptor(faceCanvas);
    if (!st.alive) return;

    const { best, d1, d2 } = matchFace(desc, profiles);
    const confident = best && isConfident(d1, d2);

    if (showDebugRef.current && best) {
      setDebugLine(
        `terdekat: ${best.nama} • jarak ${d1.toFixed(2)} • selisih ${
          Number.isFinite(d2) ? (d2 - d1).toFixed(2) : "-"
        } (butuh ≤ ${MATCH_DIST} & ≥ ${MARGIN_MIN})`,
      );
    }

    const confirmed = pushVote(st.votes, confident ? best.idSiswa : null, now);
    if (confirmed) {
      st.votes.length = 0;
      recognizedRef.current(best.idSiswa, best.nama);
      return;
    }

    if (confident) {
      setLiveFaceStatus("🔍 Memverifikasi wajah...");
    } else if (best && d1 <= LOOSE_DIST) {
      setLiveFaceStatus("🔍 Mencocokkan... tahan posisi sebentar");
    } else {
      setLiveFaceStatus("⚠️ Wajah tidak dikenal / belum terdaftar di kelas ini");
    }
  }

  // 5. PENANGANAN HASIL SCAN WAJAH (SAMA PERSIS DENGAN ATURAN BARCODE)
  function handleStudentRecognized(scannedId, studentName) {
    if (checkIsPastTimeLimit()) {
      setIsSubmittedToday(true);
      setIsLockedByTime(true);
      stopCamera();
      alert("⛔ Batas waktu presensi telah berakhir (Pukul 08.30 WIB).");
      return;
    }

    // Kasus: Siswa sudah pernah discan sebelumnya (FIRST-SCAN WINS)
    const existing = scannedMapRef.current[scannedId];
    if (existing) {
      lastSuccessScanAt.current = Date.now();
      setScanOverlay({
        type: "duplicate",
        nama: studentName,
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

    lastSuccessScanAt.current = Date.now();
    playBeepSuccess();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(80);
    }

    setScanOverlay({
      type: "success",
      nama: studentName,
      waktu: jamScan,
      pesan: `hadir pada pukul ${jamScan} WIB via Presensi Wajah`,
    });
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

  // 6. KIRIM / SIMPAN PRESENSI KE BACKEND DENGAN PROGRESS BAR
  async function handleSubmitPresensi() {
    if (isSubmittedToday || isLockedByTime) {
      alert("⛔ Batas waktu pengisian presensi hari ini telah berakhir.");
      return;
    }

    if (siswaList.length === 0) {
      alert("Tidak ada data siswa.");
      return;
    }

    const confirmText =
      `📋 KONFIRMASI PENGIRIMAN PRESENSI KELAS\n\n` +
      `Kelas: ${petugasInfo?.namaKelas}\n` +
      `Total Siswa: ${stats.total}\n` +
      `• Hadir: ${stats.hadir}\n` +
      `• Sakit: ${stats.sakit}\n` +
      `• Izin: ${stats.izin}\n` +
      `• Alfa: ${stats.alfa + stats.belumScan} (${stats.belumScan} siswa belum hadir otomatis Alfa)\n\n` +
      `Apakah Anda ingin menyimpan data presensi ini sekarang?`;

    if (!window.confirm(confirmText)) return;

    setSaving(true);
    setSaveProgress({ pct: 25, label: "Menyusun data presensi...", done: false, error: false });

    try {
      const cells = siswaList.map((s) => {
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

        const st = manualStatusMap[s.idSiswa] || "Alfa";
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
        };
      });

      setSaveProgress({ pct: 65, label: "Menyimpan ke Google Sheets...", done: false, error: false });

      const res = await savePresensiWaliKelas({
        idGuru: petugasInfo.idGuru,
        idWali: petugasInfo.idWali,
        cells,
      });

      if (!res.success) {
        throw new Error(res.message || "Gagal menyimpan presensi.");
      }

      setHasPreviousSubmission(true);
      try {
        localStorage.removeItem(`draft_scan_${petugasInfo.idWali}_${todayISO}`);
      } catch (_) {}

      if (typeof onPresensiSubmitted === "function") {
        onPresensiSubmitted();
      }

      setSaveProgress({
        pct: 100,
        label: "✅ Presensi kelas berhasil disimpan ke Spreadsheet!",
        done: true,
        error: false,
      });

      setTimeout(() => {
        setSaveProgress(null);
        if (checkIsPastTimeLimit()) {
          setIsSubmittedToday(true);
          onClose();
        }
      }, 1500);
    } catch (err) {
      console.error("Gagal simpan presensi:", err);
      setSaveProgress({
        pct: 100,
        label: `❌ Terjadi kesalahan: ${err.message || "Koneksi terputus"}`,
        done: true,
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  function toggleCameraFacing() {
    setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[94vh]">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-teal-400/20 text-teal-300 text-sm">
              🧏
            </span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-black tracking-tight">
                  Scan Presensi Wajah
                </h3>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-400/20 text-teal-200 font-bold border border-teal-300/30">
                  {petugasInfo?.namaKelas || "Rombel"}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-teal-200 truncate">
                Pengenalan wajah • {templateInfo.ready}/{registeredFaceCount} template siap • {registeredFaceCount}/{siswaList.length} terdaftar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                loadStudentFaceProfilesParallel(siswaList, true);
              }}
              disabled={syncingFaces}
              className="px-2 py-1 rounded-lg bg-teal-500/25 hover:bg-teal-500/40 border border-teal-300/40 text-teal-100 text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
              title="Sinkronkan pembaruan foto wajah siswa terbaru dari Google Sheets"
            >
              <span className={syncingFaces ? "animate-spin" : ""}>🔄</span>
              <span>{syncingFaces ? "Sinkron..." : "Sinkron Wajah"}</span>
            </button>
            <button
              onClick={toggleCameraFacing}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Ganti Kamera Depan / Belakang"
            >
              <span>📷</span>
              <span>{cameraFacing === "environment" ? "Blkg" : "Dpn"}</span>
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
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 sm:px-5 pt-1.5 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("kamera")}
              className={`px-3 py-1.5 text-xs font-black border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "kamera"
                  ? "border-emerald-600 text-emerald-800 bg-white rounded-t-lg"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>🧏</span>
              <span>Kamera Wajah</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
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
              <span>Daftar Siswa</span>
              {stats.belumScan > 0 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  {stats.belumScan} Belum
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 mb-1">
            {typeof onOpenBarcode === "function" && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onOpenBarcode();
                }}
                className="px-2.5 py-1 rounded-lg bg-teal-100 hover:bg-teal-200 text-teal-900 font-black text-[11px] border border-teal-300 flex items-center gap-1 transition-all cursor-pointer"
                title="Beralih ke Scan Barcode"
              >
                <span>📷</span>
                <span>Mode Barcode</span>
              </button>
            )}
            {typeof onOpenReguler === "function" && (
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onOpenReguler();
                }}
                className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 font-black text-[11px] border border-amber-300 flex items-center gap-1 transition-all cursor-pointer"
                title="Beralih ke Presensi Reguler"
              >
                <span>📋</span>
                <span>Reguler</span>
              </button>
            )}
          </div>
        </div>

        {/* BODY AREA */}
        <div className="p-2.5 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/50">
          {/* STATISTIK RINGKAS */}
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <div className="py-1 px-1 rounded-lg bg-slate-100 border border-slate-200">
              <div className="text-[8.5px] text-slate-500 font-bold uppercase">Total</div>
              <div className="text-xs sm:text-sm font-black text-slate-900 mt-0.5">{stats.total}</div>
            </div>
            <div className="py-1 px-1 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-[8.5px] text-emerald-700 font-bold uppercase">Hadir</div>
              <div className="text-xs sm:text-sm font-black text-emerald-700 mt-0.5">{stats.hadir}</div>
            </div>
            <div className="py-1 px-1 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-[8.5px] text-amber-700 font-bold uppercase">Sakit/Izin</div>
              <div className="text-xs sm:text-sm font-black text-amber-700 mt-0.5">{stats.sakit + stats.izin}</div>
            </div>
            <div className="py-1 px-1 rounded-lg bg-rose-50 border border-rose-200">
              <div className="text-[8.5px] text-rose-700 font-bold uppercase">Belum</div>
              <div className="text-xs sm:text-sm font-black text-rose-700 mt-0.5">{stats.belumScan + stats.alfa + stats.cabut}</div>
            </div>
          </div>

          {/* TAB 1: KAMERA SCAN WAJAH */}
          {activeTab === "kamera" && !isLockedByTime && (
            <div className="space-y-2">
              {/* STATUS MODEL & TEMPLATE */}
              {engineStatus === "loading" && (
                <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[10.5px]">
                  ⏳ Memuat model pengenalan wajah (±7 MB, hanya sekali)...
                </div>
              )}
              {engineStatus === "fallback" && (
                <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[10.5px] flex items-center justify-between gap-2">
                  <span>
                    Model pengenalan wajah gagal dimuat (cek koneksi / akses ke cdn.jsdelivr.net).
                    Scan wajah tidak aktif.
                  </span>
                  <button
                    type="button"
                    onClick={() => setEngineNonce((n) => n + 1)}
                    className="px-2 py-1 rounded-lg bg-rose-600 text-white font-bold shrink-0 cursor-pointer"
                  >
                    Coba lagi
                  </button>
                </div>
              )}
              {templateInfo.pending > 0 && (
                <div className="px-2.5 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-[10.5px]">
                  🔄 Menyiapkan template wajah siswa: {templateInfo.ready}/{templateInfo.total}...
                </div>
              )}
              {templateInfo.failed.length > 0 && (
                <div className="px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[10.5px]">
                  ⚠️ {templateInfo.failed.length} foto wajah tidak bisa dipakai:{" "}
                  <strong>
                    {templateInfo.failed
                      .slice(0, 5)
                      .map((f) => f.nama)
                      .join(", ")}
                    {templateInfo.failed.length > 5 ? ", ..." : ""}
                  </strong>
                  . Minta siswa daftar ulang (wajah menghadap lurus, cahaya cukup), lalu tekan
                  Sinkron Wajah.
                </div>
              )}

              {/* CONTAINER KAMERA PEMINDAI */}
              <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-700 w-full h-[52vh] sm:h-[400px] min-h-[300px] flex items-center justify-center shadow-md">
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
                    {/* Status Deteksi di Bagian Atas */}
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 max-w-[94%] text-center px-3 py-1 rounded-full text-[10.5px] font-bold shadow-md backdrop-blur-xs transition-colors bg-black/75 text-emerald-300 border border-emerald-400/30">
                      {liveFaceStatus}
                    </div>

                    {showDebug && debugLine && (
                      <div className="absolute top-10 left-1/2 -translate-x-1/2 max-w-[94%] text-center px-2 py-0.5 rounded-md bg-black/70 text-yellow-200 text-[9.5px] font-mono">
                        {debugLine}
                      </div>
                    )}

                    {/* LIVE FACE TRACKING BOX (Kotak Hijau Melacak Wajah Langsung) */}
                    {liveFaceBox ? (
                      <div
                        className="absolute rounded-xl border-2 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.7)] transition-all duration-75 flex flex-col justify-between p-1"
                        style={{
                          left: `${liveFaceBox.leftPct}%`,
                          top: `${liveFaceBox.topPct}%`,
                          width: `${liveFaceBox.widthPct}%`,
                          height: `${liveFaceBox.heightPct}%`,
                        }}
                      >
                        <span className="text-[8.5px] font-mono font-bold bg-emerald-950/80 text-emerald-200 px-1 py-0.5 rounded w-fit">
                          WAJAH
                        </span>
                        <div className="w-full flex justify-end">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        </div>
                      </div>
                    ) : (
                      /* Oval Target Jika Belum Ada Wajah */
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-52 h-64 sm:w-56 sm:h-72 rounded-[50%] border-2 border-dashed border-teal-400/50 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-teal-400/60" />
                        </div>
                      </div>
                    )}

                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-emerald-950/85 text-emerald-300 text-[9.5px] font-mono font-bold shadow-xs whitespace-nowrap">
                      Deteksi Wajah Aktif • Cooldown 3 Detik Anti-Duplikat
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
                    <style dangerouslySetInnerHTML={{ __html: `
                      @keyframes fadeInScale {
                        from { opacity: 0; transform: scale(0.82); }
                        to   { opacity: 1; transform: scale(1); }
                      }
                      @keyframes overlayPulse {
                        0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); }
                        50%       { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
                      }
                    `}} />
                    <div
                      className={`w-full max-w-xs rounded-2xl px-5 py-5 flex flex-col items-center gap-2 text-center shadow-2xl border-2 backdrop-blur-md ${
                        scanOverlay.type === "success"
                          ? "bg-emerald-950/92 border-emerald-400 text-white"
                          : scanOverlay.type === "duplicate"
                            ? "bg-blue-950/92 border-blue-400 text-white"
                            : "bg-rose-950/92 border-rose-400 text-white"
                      }`}
                      style={scanOverlay.type === "success" ? { animation: "overlayPulse 0.8s ease-out 1" } : {}}
                    >
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-3xl shadow-lg border-2 ${
                        scanOverlay.type === "success"
                          ? "bg-emerald-500 border-emerald-300"
                          : scanOverlay.type === "duplicate"
                            ? "bg-blue-500 border-blue-300"
                            : "bg-rose-500 border-rose-300"
                      }`}>
                        {scanOverlay.type === "success" ? "✅" : scanOverlay.type === "duplicate" ? "ℹ️" : "⚠️"}
                      </div>

                      <div className={`text-[10px] font-black uppercase tracking-widest px-3 py-0.5 rounded-full ${
                        scanOverlay.type === "success"
                          ? "bg-emerald-500/40 text-emerald-200"
                          : scanOverlay.type === "duplicate"
                            ? "bg-blue-500/40 text-blue-200"
                            : "bg-rose-500/40 text-rose-200"
                      }`}>
                        {scanOverlay.type === "success" ? "Hadir Terverifikasi" : scanOverlay.type === "duplicate" ? "Sudah Hadir" : "Tidak Dikenal"}
                      </div>

                      {scanOverlay.nama && (
                        <div className="text-xl sm:text-2xl font-black leading-tight tracking-tight text-white drop-shadow-md">
                          {scanOverlay.nama}
                        </div>
                      )}

                      <div className={`text-sm font-bold leading-snug ${
                        scanOverlay.type === "success" ? "text-emerald-200" :
                        scanOverlay.type === "duplicate" ? "text-blue-200" : "text-rose-200"
                      }`}>
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
                    <p className="text-xs text-rose-300 max-w-sm">{cameraError}</p>
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
                <span>Tampilkan jarak kemiripan (untuk uji coba / kalibrasi)</span>
              </label>

              {/* LIST SISWA TERAKHIR DISCAN */}
              {siswaSudahDiscan.length > 0 && (
                <div className="space-y-1 pt-0.5">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Terakhir Hadir:</span>
                    <span className="text-emerald-700 font-black">{siswaSudahDiscan.length} Siswa Terdata</span>
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
                            <span className="text-emerald-600 font-bold">✓</span>
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
                  <span className="text-[10px] text-slate-500">Tandai Sakit / Izin</span>
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
                          <div className="font-bold text-slate-900">{s.nama}</div>
                          <div className="text-[10px] font-mono text-slate-500">ID: {s.idSiswa}</div>
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
                        <span className="font-bold text-slate-900 truncate block">{s.nama}</span>
                        <span className="text-[9px] text-slate-500 font-mono">{s.idSiswa}</span>
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

          {/* Progress Bar Penyimpanan */}
          {saveProgress && (
            <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className={saveProgress.error ? "text-rose-700" : ""}>{saveProgress.label}</span>
                <span className="font-mono text-teal-700 ml-2">{saveProgress.pct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <div
                  className={`h-full transition-all duration-300 ${
                    saveProgress.error
                      ? "bg-rose-500"
                      : saveProgress.done
                        ? "bg-emerald-500"
                        : "bg-teal-600"
                  }`}
                  style={{ width: `${saveProgress.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* FOOTER AKSI */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={() => {
              stopCamera();
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
                  ? "Menyimpan ke Spreadsheet..."
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
