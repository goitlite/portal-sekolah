"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  getPresensiWaliGrid,
  savePresensiWaliKelas,
  getBiodataSiswa,
} from "../lib/api";

// Web Audio API beep nada tinggi bersih
function playBeepSuccess() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch (_) {}
}

// Helper cek batas jam 08:30 WIB
function checkIsPastTimeLimit() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return hours > 23 || (hours === 23 && minutes >= 30);
}

// MediaPipe BlazeFace CDN Config
const MP_VERSION = "0.10.14";
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

let mpDetectorPromise = null;
function loadMediaPipeDetector() {
  if (mpDetectorPromise) return mpDetectorPromise;
  mpDetectorPromise = (async () => {
    const mod = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ MP_BUNDLE
    );
    const vision = await mod.FilesetResolver.forVisionTasks(MP_WASM);
    const make = (delegate) =>
      mod.FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.52,
      });
    try {
      return await make("GPU");
    } catch (_) {
      return await make("CPU");
    }
  })().catch((err) => {
    mpDetectorPromise = null;
    throw err;
  });
  return mpDetectorPromise;
}

// Ekstrak fitur visual dari area wajah (grid 8x8 luminance & gradien)
function extractFaceFeatures(ctx, x, y, w, h) {
  if (w <= 10 || h <= 10) return null;
  try {
    const imgData = ctx.getImageData(
      Math.max(0, Math.floor(x)),
      Math.max(0, Math.floor(y)),
      Math.floor(w),
      Math.floor(h),
    );
    const d = imgData.data;
    const grid = 8;
    const features = new Float32Array(grid * grid);
    const blockW = Math.max(1, Math.floor(w / grid));
    const blockH = Math.max(1, Math.floor(h / grid));

    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        let sum = 0;
        let count = 0;
        for (let py = 0; py < blockH; py += 2) {
          for (let px = 0; px < blockW; px += 2) {
            const ix = (gy * blockH + py) * Math.floor(w) + (gx * blockW + px);
            const p = ix * 4;
            if (p < d.length) {
              sum += 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
              count++;
            }
          }
        }
        features[gy * grid + gx] = count > 0 ? sum / count / 255 : 0;
      }
    }
    return features;
  } catch (_) {
    return null;
  }
}

// Cosine similarity antara dua vektor fitur
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// In-memory cache data siswa rombel
const MEMORY_SISWA_CACHE = {};

// ✅ Cache fitur wajah yang sudah diekstrak, bertahan lintas buka/tutup modal
// Key: idSiswa, Value: Float32Array fitur wajah
const FEATURE_CACHE = {};

// Penyimpanan vektor fitur wajah ke localStorage (instant warm-start)
function saveFeatureToStorage(idSiswa, features) {
  try {
    if (!features) return;
    localStorage.setItem(`face_feat_${idSiswa}`, JSON.stringify(Array.from(features)));
  } catch (_) {}
}

function loadFeatureFromStorage(idSiswa) {
  try {
    const saved = localStorage.getItem(`face_feat_${idSiswa}`);
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length === 64) {
        return new Float32Array(arr);
      }
    }
  } catch (_) {}
  return null;
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

  // Ref untuk loop kamera dan pencocokan wajah
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const scannedMapRef = useRef(scannedMap);
  const studentProfilesRef = useRef([]); // [{ idSiswa, nama, features, fotoWajah }]
  const lastSuccessScanAt = useRef(0);
  const SCAN_COOLDOWN_MS = 3000;
  const lastUnknownFaceAtRef = useRef(0);
  const lastInferenceAtRef = useRef(0);
  const INFERENCE_INTERVAL_MS = 85; // ±12 FPS inferensi: sangat hemat daya baterai & kamera tetap mulus 60 FPS

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

  // Pra-muat foto wajah siswa secara paralel (bebas blocking & instant cache)
  async function loadStudentFaceProfilesParallel(siswaArray, forceRefresh = false) {
    if (forceRefresh) setSyncingFaces(true);
    const waliId = petugasInfo?.idWali || "unknown";
    const localCacheKey = `cached_face_urls_${waliId}`;

    let urlCache = {};
    if (!forceRefresh) {
      try {
        const saved = localStorage.getItem(localCacheKey);
        if (saved) urlCache = JSON.parse(saved) || {};
      } catch (_) {}
    }

    // Pisahkan: siswa yang sudah punya URL & fitur vs yang perlu diambil
    const results = [];
    const missingStudents = [];

    siswaArray.forEach((s) => {
      let faceUrl = urlCache[s.idSiswa] || null;
      if (!faceUrl) {
        try {
          const saved = localStorage.getItem(`face_reg_${s.idSiswa}`);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed?.fotoWajah) faceUrl = parsed.fotoWajah;
          }
        } catch (_) {}
      }

      const cachedFeat = FEATURE_CACHE[s.idSiswa] || loadFeatureFromStorage(s.idSiswa);
      if (cachedFeat) {
        FEATURE_CACHE[s.idSiswa] = cachedFeat;
      }

      if (faceUrl && cachedFeat && !forceRefresh) {
        results.push({
          idSiswa: s.idSiswa,
          nama: s.nama,
          fotoWajah: faceUrl,
          features: cachedFeat,
        });
      } else {
        missingStudents.push({ ...s, faceUrl, cachedFeat });
      }
    });

    // Ambil data siswa yang belum ada di cache (secara bertahap dalam batch 5)
    const BATCH_SIZE = 5;
    for (let i = 0; i < missingStudents.length; i += BATCH_SIZE) {
      const batch = missingStudents.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (s) => {
        let faceUrl = s.faceUrl;
        if (!faceUrl || forceRefresh) {
          try {
            const bio = await getBiodataSiswa(s.idSiswa);
            if (bio?.success && bio.data?.fotoWajah) {
              faceUrl = bio.data.fotoWajah;
            }
          } catch (_) {}
        }

        if (faceUrl) {
          urlCache[s.idSiswa] = faceUrl;
        }

        const features = FEATURE_CACHE[s.idSiswa] || s.cachedFeat || null;
        return {
          idSiswa: s.idSiswa,
          nama: s.nama,
          fotoWajah: faceUrl,
          features,
        };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((r) => {
        if (r.status === "fulfilled") results.push(r.value);
      });
    }

    results.sort((a, b) => a.nama.localeCompare(b.nama));

    try {
      localStorage.setItem(localCacheKey, JSON.stringify(urlCache));
    } catch (_) {}

    studentProfilesRef.current = results;
    const count = results.filter((p) => !!p.fotoWajah).length;
    setRegisteredFaceCount(count);

    // Ekstrak template visual jika belum tersimpan
    extractTemplatesViaProxy(results);
    if (forceRefresh) setSyncingFaces(false);
  }

  // Ekstrak template visual lewat proxy Image (/api/image-proxy)
  function extractTemplatesViaProxy(profiles) {
    profiles.forEach((p) => {
      // Jika fitur sudah tersedia, pastikan tersimpan ke localStorage
      if (p.features) {
        FEATURE_CACHE[p.idSiswa] = p.features;
        saveFeatureToStorage(p.idSiswa, p.features);
        return;
      }
      if (FEATURE_CACHE[p.idSiswa]) {
        p.features = FEATURE_CACHE[p.idSiswa];
        saveFeatureToStorage(p.idSiswa, p.features);
        return;
      }

      if (!p.fotoWajah) return;

      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const tempCanvas = document.createElement("canvas");
          tempCanvas.width = 120;
          tempCanvas.height = 160;
          const tCtx = tempCanvas.getContext("2d");
          tCtx.drawImage(img, 0, 0, 120, 160);
          const extracted = extractFaceFeatures(tCtx, 15, 20, 90, 120);
          if (extracted) {
            FEATURE_CACHE[p.idSiswa] = extracted;
            saveFeatureToStorage(p.idSiswa, extracted);
            p.features = extracted;
          }
        } catch (e) {
          console.warn("Gagal ekstrak fitur template:", e);
        }
      };
      img.onerror = () => {
        try {
          const waliId = petugasInfo?.idWali || "unknown";
          const localCacheKey = `cached_face_urls_${waliId}`;
          const saved = localStorage.getItem(localCacheKey);
          if (saved) {
            const cache = JSON.parse(saved);
            delete cache[p.idSiswa];
            localStorage.setItem(localCacheKey, JSON.stringify(cache));
          }
        } catch (_) {}
      };

      const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(p.fotoWajah)}`;
      img.src = proxyUrl;
    });
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

  // 2. LIFECYCLE MODEL AI & KAMERA
  useEffect(() => {
    if (!isOpen || isSubmittedToday || activeTab !== "kamera") {
      stopCamera();
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        setEngineStatus("loading");
        const det = await loadMediaPipeDetector();
        if (!isMounted) return;
        detectorRef.current = det;
        setEngineStatus("ready");
      } catch (err) {
        console.warn("MediaPipe gagal, beralih ke deteksi bawaan:", err);
        setEngineStatus("fallback");
      }
      startCamera();
    })();

    return () => {
      isMounted = false;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isSubmittedToday, activeTab, cameraFacing]);

  async function startCamera() {
    stopCamera();
    setCameraError("");

    try {
      const constraints = {
        audio: false,
        video: {
          facingMode: cameraFacing,
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        startFaceRecognitionLoop();
      }
    } catch (err) {
      console.warn("Gagal menyalakan kamera:", err);
      setCameraActive(false);
      setCameraError(
        "Kamera tidak dapat diakses. Pastikan izin kamera aktif pada browser.",
      );
    }
  }

  function stopCamera() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setLiveFaceBox(null);
  }

  // 3. LOOP REKOGNISI WAJAH SECARA REAL-TIME DENGAN LIVE TRACKING FEEDBACK
  const recognizeFaceFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(recognizeFaceFrame);
      return;
    }

    // Cooldown 3 detik setelah scan sukses
    const nowMs = Date.now();
    if (nowMs - lastSuccessScanAt.current < SCAN_COOLDOWN_MS) {
      setLiveFaceStatus("⏳ Cooldown anti-duplikat...");
      rafRef.current = requestAnimationFrame(recognizeFaceFrame);
      return;
    }

    // Throttle deteksi AI ke ±12 FPS agar hemat baterai & kamera tetap lancar 60 FPS
    if (nowMs - lastInferenceAtRef.current < INFERENCE_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(recognizeFaceFrame);
      return;
    }
    lastInferenceAtRef.current = nowMs;

    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvasRef.current = canvas;
    }
    const cw = 320;
    const ch = Math.round((vh / vw) * cw) || 240;
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      rafRef.current = requestAnimationFrame(recognizeFaceFrame);
      return;
    }

    ctx.drawImage(video, 0, 0, cw, ch);

    let detectedFace = null;

    // A. Deteksi dengan MediaPipe BlazeFace jika tersedia
    if (detectorRef.current) {
      try {
        const detections = detectorRef.current.detectForVideo(
          video,
          performance.now(),
        );
        if (detections?.detections?.length > 0) {
          // Prioritaskan wajah terbesar / terdekat ke kamera (abaikan orang lewat di belakang)
          let dominant = detections.detections[0];
          let maxArea = dominant.boundingBox.width * dominant.boundingBox.height;
          for (let i = 1; i < detections.detections.length; i++) {
            const det = detections.detections[i];
            const area = det.boundingBox.width * det.boundingBox.height;
            if (area > maxArea) {
              maxArea = area;
              dominant = det;
            }
          }

          const b = dominant.boundingBox;
          const scaleX = cw / vw;
          const scaleY = ch / vh;
          detectedFace = {
            x: b.originX * scaleX,
            y: b.originY * scaleY,
            w: b.width * scaleX,
            h: b.height * scaleY,
            rawX: b.originX,
            rawY: b.originY,
            rawW: b.width,
            rawH: b.height,
          };
        }
      } catch (_) {}
    }

    // B. Fallback Native FaceDetector jika didukung
    if (!detectedFace && typeof window !== "undefined" && "FaceDetector" in window) {
      try {
        // eslint-disable-next-line no-undef
        const nativeDet = new window.FaceDetector({ fastMode: true });
        const faces = await nativeDet.detect(video);
        if (faces && faces.length > 0) {
          // Prioritaskan wajah terbesar
          let dominant = faces[0];
          let maxArea = dominant.boundingBox.width * dominant.boundingBox.height;
          for (let i = 1; i < faces.length; i++) {
            const f = faces[i];
            const area = f.boundingBox.width * f.boundingBox.height;
            if (area > maxArea) {
              maxArea = area;
              dominant = f;
            }
          }

          const b = dominant.boundingBox;
          const scaleX = cw / vw;
          const scaleY = ch / vh;
          detectedFace = {
            x: b.x * scaleX,
            y: b.y * scaleY,
            w: b.width * scaleX,
            h: b.height * scaleY,
            rawX: b.x,
            rawY: b.y,
            rawW: b.width,
            rawH: b.height,
          };
        }
      } catch (_) {}
    }

    // C. UPDATE LIVE TRACKING BOX KE LAYAR (Memberi respon visual langsung)
    if (detectedFace && detectedFace.w > 30 && detectedFace.h > 30) {
      const leftPct = (detectedFace.rawX / vw) * 100;
      const topPct = (detectedFace.rawY / vh) * 100;
      const widthPct = (detectedFace.rawW / vw) * 100;
      const heightPct = (detectedFace.rawH / vh) * 100;

      // Jika kamera depan, cerminkan posisi X bounding box
      const displayLeft =
        cameraFacing === "user" ? 100 - leftPct - widthPct : leftPct;

      setLiveFaceBox({
        leftPct: displayLeft,
        topPct,
        widthPct,
        heightPct,
      });

      setLiveFaceStatus("🔍 Wajah terdeteksi! Mencocokkan data kelas...");

      // D. PENCARIAN & PENCOCOKAN WAJAH DENGAN SISWA KELAS (1 : N)
      const liveFeatures = extractFaceFeatures(
        ctx,
        detectedFace.x,
        detectedFace.y,
        detectedFace.w,
        detectedFace.h,
      );

      if (liveFeatures) {
        let bestMatch = null;
        let highestScore = 0;

        const profiles = studentProfilesRef.current || [];
        for (const prof of profiles) {
          if (prof.features) {
            const sim = cosineSimilarity(liveFeatures, prof.features);
            if (sim > highestScore) {
              highestScore = sim;
              bestMatch = prof;
            }
          }
        }

        // Tampilkan persentase pencocokan langsung di status
        if (bestMatch && highestScore > 0.45) {
          const matchPercent = Math.round(highestScore * 100);
          setLiveFaceStatus(
            `⏳ Memindai: ${bestMatch.nama} (${matchPercent}%)`,
          );
        }

        // Ambang batas kecocokan (Threshold Similarity ≥ 0.72)
        if (bestMatch && highestScore >= 0.72) {
          handleStudentRecognized(bestMatch.idSiswa, bestMatch.nama);
        } else if (highestScore < 0.55 && Date.now() - lastUnknownFaceAtRef.current > 4000) {
          // Jika wajah stabil tetapi tidak cocok dengan siapa pun
          lastUnknownFaceAtRef.current = Date.now();
          setLiveFaceStatus("⚠️ Wajah belum terdaftar di kelas ini.");
        }
      }
    } else {
      setLiveFaceBox(null);
      setLiveFaceStatus("Arahkan kamera ke wajah siswa...");
    }

    rafRef.current = requestAnimationFrame(recognizeFaceFrame);
  }, [cameraFacing]);

  function startFaceRecognitionLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recognizeFaceFrame);
  }

  // 4. PENANGANAN HASIL SCAN WAJAH (SAMA PERSIS DENGAN ATURAN BARCODE)
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

  // 5. KIRIM / SIMPAN PRESENSI KE BACKEND DENGAN PROGRESS BAR
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
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-teal-400/20 text-teal-200 font-bold border border-teal-300/30">
                  {petugasInfo?.namaKelas || "Rombel"}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-teal-200 truncate">
                AI Face Matching • {registeredFaceCount}/{siswaList.length} Wajah Terdaftar
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
              <span>Daftar Siswa</span>
              {stats.belumScan > 0 && (
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 font-bold">
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
                        <span className="text-[8.5px] font-mono font-bold bg-emerald-950/80 text-emerald-200 px-1 py-0.2 rounded w-fit">
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
