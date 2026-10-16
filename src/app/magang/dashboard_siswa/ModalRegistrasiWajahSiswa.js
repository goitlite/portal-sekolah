"use client";

import { useState, useEffect, useRef } from "react";
import { uploadPhoto, updateBiodataSiswa, getBiodataSiswa } from "../lib/api";
import {
  loadFaceApi,
  checkFaceDuplicate,
  writeCachedDescriptor,
  loadImage,
} from "../lib/faceApiHelper";

// =====================================================================
// KONFIGURASI (bisa disetel tanpa mengubah logika)
// =====================================================================
const OUT_W = 600; // ukuran hasil pas foto (3:4)
const OUT_H = 800;

const TARGET = { cx: 0.5, cy: 0.46 }; // pusat oval (relatif terhadap bingkai 3:4)
const SCALE_IDEAL = 0.47; // lebar wajah ideal = 47% lebar bingkai
const SCALE_TOL = 0.08; // toleransi ukuran wajah
const POS_TOL = 0.07; // toleransi geser X / Y (7% bingkai)
const MAX_ROLL_DEG = 10; // kemiringan kepala maksimum
const MAX_YAW = 0.28; // toleransi hadap kiri/kanan
const LIGHT_MIN = 30; // % kecerahan minimum wajah
const LIGHT_MAX = 90; // % kecerahan maksimum wajah
const BLUR_MIN = 8; // batas variansi Laplacian (di bawah = buram)
const SCORE_READY = 82; // skor minimum untuk auto-capture

const TICK_MS = 90; // analisis ±11 kali/detik (hemat baterai)
const HOLD_MS = 900; // posisi harus stabil selama ini sebelum hitung mundur
const COUNT_STEP_MS = 700; // durasi tiap angka hitung mundur
const LOST_GRACE_MS = 500; // toleransi kehilangan posisi saat hitung mundur

const WORK_W = 240; // resolusi kanvas analisis
const WORK_H = 320;

const MP_VERSION = "0.10.14";
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
const MP_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

// =====================================================================
// HELPER UMUM
// =====================================================================
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

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
function playBeep(from = 659.25, to = 880) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + 0.1);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.18);
  } catch (_) {}
}

// Ubah link Drive jadi thumbnail yang aman ditampilkan di <img>
function driveThumb(url) {
  if (!url) return "";
  let id = "";
  if (url.includes("/file/d/")) id = url.split("/file/d/")[1].split("/")[0];
  else if (url.includes("id=")) id = url.split("id=")[1].split("&")[0];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : url;
}

// Bingkai 3:4 di tengah video. Dipakai SAMA untuk pelacakan, tampilan, dan
// hasil foto, sehingga yang dilihat siswa = yang disimpan.
function getGuideRect(vw, vh) {
  const w = Math.min(vw, Math.round(vh * 0.75));
  const h = Math.min(vh, Math.round(w * (4 / 3)));
  return { x: Math.round((vw - w) / 2), y: Math.round((vh - h) / 2), w, h };
}

// =====================================================================
// DETEKTOR WAJAH
// 1) MediaPipe BlazeFace (akurat, jalan di semua browser modern)
// 2) FaceDetector bawaan browser (jika ada)
// 3) Mode dasar (warna kulit) -> TIDAK dipakai untuk auto-capture
// =====================================================================
let mpPromise = null;
function loadMediaPipeDetector() {
  if (mpPromise) return mpPromise;
  mpPromise = (async () => {
    const mod = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ MP_BUNDLE
    );
    const vision = await mod.FilesetResolver.forVisionTasks(MP_WASM);
    const make = (delegate) =>
      mod.FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MP_MODEL, delegate },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.6,
      });
    try {
      return await make("GPU");
    } catch (_) {
      return await make("CPU");
    }
  })().catch((err) => {
    mpPromise = null; // boleh dicoba lagi pada pembukaan modal berikutnya
    throw err;
  });
  return mpPromise;
}

// Wajah dari piksel kulit: kasar, hanya sebagai cadangan terakhir
function detectSkinFace(data, W, H) {
  const x0 = Math.floor(W * 0.15);
  const x1 = Math.floor(W * 0.85);
  const y0 = Math.floor(H * 0.08);
  const y1 = Math.floor(H * 0.85);
  let cnt = 0,
    total = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    syy = 0;
  for (let y = y0; y < y1; y += 4) {
    for (let x = x0; x < x1; x += 4) {
      total++;
      const p = (y * W + x) * 4;
      const r = data[p],
        g = data[p + 1],
        b = data[p + 2];
      if (
        r > 60 &&
        g > 40 &&
        b > 20 &&
        r > g &&
        r > b &&
        Math.abs(r - g) > 12 &&
        r - b > 12
      ) {
        cnt++;
        sx += x;
        sy += y;
        sxx += x * x;
        syy += y * y;
      }
    }
  }
  if (!total || cnt / total < 0.06) return null;
  const mx = sx / cnt;
  const my = sy / cnt;
  const stdX = Math.sqrt(Math.max(0, sxx / cnt - mx * mx));
  const stdY = Math.sqrt(Math.max(0, syy / cnt - my * my));
  return {
    cx: mx / W,
    cy: my / H,
    w: clamp((stdX * 4) / W, 0.1, 1),
    h: clamp((stdY * 4) / H, 0.1, 1),
    conf: 0.3,
    eyes: null,
  };
}

// Kualitas gambar di area wajah: kecerahan, pemerataan, backlight, ketajaman
function computeQuality(data, W, H, face) {
  const fx0 = Math.max(0, Math.floor((face.cx - face.w / 2) * W));
  const fx1 = Math.min(W - 1, Math.ceil((face.cx + face.w / 2) * W));
  const fy0 = Math.max(0, Math.floor((face.cy - face.h / 2) * H));
  const fy1 = Math.min(H - 1, Math.ceil((face.cy + face.h / 2) * H));
  if (fx1 - fx0 < 8 || fy1 - fy0 < 8) return null;

  const gray = new Float32Array(W * H);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  }

  const midX = (fx0 + fx1) >> 1;
  let sum = 0,
    n = 0,
    sl = 0,
    nl = 0,
    sr = 0,
    nr = 0;
  for (let y = fy0; y <= fy1; y += 2) {
    for (let x = fx0; x <= fx1; x += 2) {
      const v = gray[y * W + x];
      sum += v;
      n++;
      if (x < midX) {
        sl += v;
        nl++;
      } else {
        sr += v;
        nr++;
      }
    }
  }

  let sb = 0,
    nb = 0;
  for (let y = 0; y < H; y += 4) {
    for (let x = 0; x < W; x += 4) {
      if (x >= fx0 && x <= fx1 && y >= fy0 && y <= fy1) continue;
      sb += gray[y * W + x];
      nb++;
    }
  }

  let lsum = 0,
    lsq = 0,
    ln = 0;
  for (let y = fy0 + 1; y < fy1; y++) {
    for (let x = fx0 + 1; x < fx1; x++) {
      const i = y * W + x;
      const lap =
        4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - W] - gray[i + W];
      lsum += lap;
      lsq += lap * lap;
      ln++;
    }
  }
  const lmean = ln ? lsum / ln : 0;
  const lvar = ln ? lsq / ln - lmean * lmean : 0;

  const faceMean = sum / n;
  return {
    brightness: (faceMean / 255) * 100,
    balance: (Math.abs(sl / (nl || 1) - sr / (nr || 1)) / 255) * 100,
    backlight: nb ? ((sb / nb - faceMean) / 255) * 100 : 0,
    sharp: lvar,
  };
}

const EMPTY_METRICS = {
  detected: false,
  multiple: false,
  ready: false,
  score: 0,
  stability: 100,
  scalePct: 0,
  brightness: 0,
  xLabel: "-",
  yLabel: "-",
  poseLabel: "-",
  sharpLabel: "-",
  ok: { x: false, y: false, scale: false, light: false, pose: false, sharp: false },
  box: null,
  statusText: "Menyiapkan kamera...",
};

// =====================================================================
// KOMPONEN
// =====================================================================
export default function ModalRegistrasiWajahSiswa({
  isOpen,
  onClose,
  user, // { id, nama, kelas }
  fotoLama,
  onFaceRegistered,
  otherStudents = [],
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState("user"); // "user" | "environment"
  const [cameraError, setCameraError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);
  const [faceMetrics, setFaceMetrics] = useState(EMPTY_METRICS);
  const [engine, setEngine] = useState("loading"); // loading | ai | native | basic
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [countdown, setCountdown] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(null);
  const [existingFacePhoto, setExistingFacePhoto] = useState(null);

  const videoRef = useRef(null);
  const workCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const camSessionRef = useRef(0);
  const rafRef = useRef(null);
  const engineRef = useRef(null);
  const autoRef = useRef(true);
  const metricsRef = useRef(EMPTY_METRICS);
  const capturedMetricsRef = useRef(EMPTY_METRICS);
  const lastFaceAtRef = useRef(0);
  const closeTimerRef = useRef(null);
  const uploadedRef = useRef({ image: null, url: null });
  const captureRef = useRef(() => {});
  const trackRef = useRef({});
  const cameraFacingRef = useRef(cameraFacing);
  cameraFacingRef.current = cameraFacing;

  autoRef.current = autoCaptureEnabled;

  function toggleCameraFacing() {
    setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"));
  }

  // -------------------------------------------------------------------
  // 1. Muat detektor wajah saat modal dibuka
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setEngine("loading");
    engineRef.current = null;

    (async () => {
      try {
        const det = await withTimeout(loadMediaPipeDetector(), 15000);
        if (cancelled) return;
        engineRef.current = { type: "ai", detector: det, lastTs: 0 };
        setEngine("ai");
        return;
      } catch (e) {
        console.warn("MediaPipe tidak tersedia, memakai cadangan:", e);
      }
      if (cancelled) return;
      if (typeof window !== "undefined" && "FaceDetector" in window) {
        try {
          engineRef.current = {
            type: "native",
            detector: new window.FaceDetector({
              fastMode: true,
              maxDetectedFaces: 2,
            }),
          };
          setEngine("native");
          return;
        } catch (_) {}
      }
      engineRef.current = { type: "basic" };
      setEngine("basic");
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // -------------------------------------------------------------------
  // 2. Status foto wajah yang sudah terdaftar (server = sumber kebenaran)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let cancelled = false;
    let cached = null;
    try {
      const saved = localStorage.getItem(`face_reg_${user.id}`);
      if (saved) cached = JSON.parse(saved)?.fotoWajah || null;
    } catch (_) {}
    setExistingFacePhoto(fotoLama || cached || null);

    (async () => {
      try {
        const res = await getBiodataSiswa(String(user.id));
        if (cancelled || !res?.success || !res.data) return;
        if ("fotoWajah" in res.data) {
          const url = res.data.fotoWajah || "";
          setExistingFacePhoto(url || null);
          if (!url) {
            try {
              localStorage.removeItem(`face_reg_${user.id}`);
            } catch (_) {}
          }
        }
      } catch (_) {}
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id, fotoLama]);

  // -------------------------------------------------------------------
  // 3. Siklus hidup kamera
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setPreviewImage(null);
      setCountdown(null);
      setSaveProgress(null);
      setFaceMetrics(EMPTY_METRICS);
      return;
    }
    uploadedRef.current = { image: null, url: null };
    if (!previewImage) {
      startCamera();
    }
    return () => {
      stopCamera();
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cameraFacing]);

  async function startCamera() {
    stopCamera();
    const session = ++camSessionRef.current;
    setCameraError("");
    setCountdown(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Browser tidak mendukung kamera. Buka lewat HTTPS dan gunakan Chrome / Safari terbaru.",
      );
      return;
    }

    const currentFacing = cameraFacingRef.current;
    const attempts = [
      {
        audio: false,
        video: {
          facingMode: { ideal: currentFacing },
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
      },
      {
        audio: false,
        video: {
          facingMode: currentFacing,
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
        if (err?.name === "NotAllowedError") break; // izin ditolak, tak perlu coba lagi
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
              ? "Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi."
              : "Kamera tidak dapat diakses. Periksa izin kamera pada browser.",
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
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }

  // -------------------------------------------------------------------
  // 4. Loop analisis wajah (tanpa closure basi: semua lewat ref)
  // -------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen || !cameraActive || previewImage) return;

    const t = {
      sx: null,
      sy: null,
      sw: null,
      prevCx: null,
      prevCy: null,
      stab: 100,
      readySince: 0,
      lostSince: 0,
      countEndsAt: 0,
      quality: null,
      tick: 0,
    };
    trackRef.current = t;

    let alive = true;
    let busy = false;
    let last = 0;

    const updateCountdown = (ready, now) => {
      if (ready && autoRef.current) {
        t.lostSince = 0;
        if (!t.readySince) t.readySince = now;
        if (!t.countEndsAt && now - t.readySince >= HOLD_MS) {
          t.countEndsAt = now + 3 * COUNT_STEP_MS;
          playBeep();
        }
      } else {
        if (!t.lostSince) t.lostSince = now;
        if (now - t.lostSince > LOST_GRACE_MS) {
          t.readySince = 0;
          if (t.countEndsAt) {
            t.countEndsAt = 0;
            setCountdown(null);
          }
        }
      }
      if (t.countEndsAt) {
        const remain = t.countEndsAt - now;
        if (remain <= 0) {
          t.countEndsAt = 0;
          t.readySince = 0;
          setCountdown(null);
          captureRef.current();
          return true; // sudah mengambil foto
        }
        setCountdown(Math.ceil(remain / COUNT_STEP_MS));
      }
      return false;
    };

    const setNoFace = (text, multiple = false) => {
      const m = {
        ...EMPTY_METRICS,
        multiple,
        score: Math.max(0, (metricsRef.current.score || 0) - 12),
        statusText: text,
      };
      metricsRef.current = m;
      setFaceMetrics(m);
    };

    const analyze = async (now) => {
      const video = videoRef.current;
      const eng = engineRef.current;
      if (!video || video.readyState < 2 || !video.videoWidth) return;
      if (!eng) {
        setNoFace("Menyiapkan deteksi wajah...");
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const g = getGuideRect(vw, vh);

      let canvas = workCanvasRef.current;
      if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.width = WORK_W;
        canvas.height = WORK_H;
        workCanvasRef.current = canvas;
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, g.x, g.y, g.w, g.h, 0, 0, WORK_W, WORK_H);

      // ---- deteksi ----
      let faces = [];
      let imgData = null;

      if (eng.type === "ai") {
        const ts = Math.max(performance.now(), eng.lastTs + 1);
        eng.lastTs = ts;
        const res = eng.detector.detectForVideo(video, ts);
        faces = (res?.detections || []).map((d) => {
          const b = d.boundingBox;
          const kp = d.keypoints || [];
          const toN = (p) => ({
            x: (p.x * vw - g.x) / g.w,
            y: (p.y * vh - g.y) / g.h,
          });
          let eyes = null;
          if (kp.length >= 2) {
            const pair = [toN(kp[0]), toN(kp[1])].sort((a, c) => a.x - c.x);
            eyes = {
              l: pair[0],
              r: pair[1],
              nose: kp[2] ? toN(kp[2]) : null,
            };
          }
          return {
            cx: (b.originX + b.width / 2 - g.x) / g.w,
            cy: (b.originY + b.height / 2 - g.y) / g.h,
            w: b.width / g.w,
            h: b.height / g.h,
            conf: d.categories?.[0]?.score ?? 0,
            eyes,
          };
        });
      } else if (eng.type === "native") {
        const found = await eng.detector.detect(video);
        faces = (found || []).map((f) => {
          const b = f.boundingBox;
          return {
            cx: (b.x + b.width / 2 - g.x) / g.w,
            cy: (b.y + b.height / 2 - g.y) / g.h,
            w: b.width / g.w,
            h: b.height / g.h,
            conf: 0.8,
            eyes: null,
          };
        });
      } else {
        imgData = ctx.getImageData(0, 0, WORK_W, WORK_H).data;
        const f = detectSkinFace(imgData, WORK_W, WORK_H);
        faces = f ? [f] : [];
      }

      // hanya wajah yang pusatnya di dalam bingkai
      faces = faces.filter((f) => f.cx > 0 && f.cx < 1 && f.cy > 0 && f.cy < 1);

      if (faces.length === 0) {
        if (updateCountdown(false, now)) return;
        setNoFace(
          eng.type === "basic"
            ? "Wajah belum terlihat. Hadapkan wajah ke dalam oval."
            : "Posisikan wajah Anda di dalam oval...",
        );
        return;
      }

      const bigFaces = faces.filter((f) => f.w >= 0.15);
      if (bigFaces.length > 1) {
        if (updateCountdown(false, now)) return;
        setNoFace(
          "👥 Terdeteksi lebih dari satu wajah. Pastikan hanya Anda di kamera.",
          true,
        );
        return;
      }

      const face = faces.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
      lastFaceAtRef.current = now;

      // ---- penghalusan & kestabilan ----
      const a = 0.5;
      t.sx = t.sx == null ? face.cx : t.sx + a * (face.cx - t.sx);
      t.sy = t.sy == null ? face.cy : t.sy + a * (face.cy - t.sy);
      t.sw = t.sw == null ? face.w : t.sw + a * (face.w - t.sw);
      let stabRaw = 100;
      if (t.prevCx != null) {
        const mv = Math.hypot(face.cx - t.prevCx, face.cy - t.prevCy);
        stabRaw = clamp(100 - mv * 2000, 0, 100);
      }
      t.prevCx = face.cx;
      t.prevCy = face.cy;
      t.stab = t.stab + 0.4 * (stabRaw - t.stab);

      // ---- kualitas gambar (tiap 3 siklus) ----
      if (t.tick % 3 === 0) {
        if (!imgData) imgData = ctx.getImageData(0, 0, WORK_W, WORK_H).data;
        t.quality = computeQuality(imgData, WORK_W, WORK_H, face);
      }
      t.tick++;
      const q = t.quality;

      // ---- pose kepala (hanya jika titik mata tersedia) ----
      let rollDeg = 0;
      let yaw = 0;
      let hasPose = false;
      if (face.eyes) {
        const dxp = (face.eyes.r.x - face.eyes.l.x) * g.w;
        const dyp = (face.eyes.r.y - face.eyes.l.y) * g.h;
        const eyeDist = Math.hypot(dxp, dyp) || 1;
        rollDeg = (Math.atan2(dyp, dxp) * 180) / Math.PI;
        if (face.eyes.nose) {
          const midX = (face.eyes.l.x + face.eyes.r.x) / 2;
          yaw = ((face.eyes.nose.x - midX) * g.w) / eyeDist;
        }
        hasPose = true;
      }

      // ---- penilaian ----
      const dx = t.sx - TARGET.cx;
      const dy = t.sy - TARGET.cy;
      const scaleRatio = t.sw / SCALE_IDEAL;
      const scaleTolR = SCALE_TOL / SCALE_IDEAL;

      const okX = Math.abs(dx) <= POS_TOL;
      const okY = Math.abs(dy) <= POS_TOL;
      const okScale = Math.abs(scaleRatio - 1) <= scaleTolR;
      const tooDark = q ? q.brightness < LIGHT_MIN : false;
      const tooBright = q ? q.brightness > LIGHT_MAX : false;
      const backlit = q ? q.backlight > 28 : false;
      const uneven = q ? q.balance > 22 : false;
      const okLight = !(tooDark || tooBright || backlit || uneven);
      const okPose =
        !hasPose || (Math.abs(rollDeg) <= MAX_ROLL_DEG && Math.abs(yaw) <= MAX_YAW);
      const okSharp = q ? q.sharp >= BLUR_MIN : true;

      const comp = (err, tol) => Math.max(0, 100 - (err / tol) * 40);
      const xS = comp(Math.abs(dx), POS_TOL);
      const yS = comp(Math.abs(dy), POS_TOL);
      const sS = comp(Math.abs(scaleRatio - 1), scaleTolR);
      const lightS = Math.max(
        40,
        100 - 20 * [tooDark, tooBright, backlit, uneven].filter(Boolean).length,
      );
      const poseS = okPose ? 100 : 55;
      const sharpS = okSharp ? 100 : 70;
      const score = Math.round(
        clamp(
          xS * 0.28 +
            yS * 0.28 +
            sS * 0.18 +
            t.stab * 0.1 +
            lightS * 0.08 +
            ((poseS + sharpS) / 2) * 0.08,
          0,
          100,
        ),
      );

      // ---- instruksi (prioritas: bingkai -> cahaya -> pose -> fokus) ----
      const isUserFacing = cameraFacingRef.current === "user";
      let statusText = "✨ Posisi sempurna! Tahan sebentar...";
      let xLabel = "Tengah";
      let yLabel = "Pas";
      if (!okX) {
        if (isUserFacing) {
          // wajah (mentah) di kanan => di layar selfie tampak di kiri => geser ke kanan
          xLabel = dx > 0 ? "Ke kanan" : "Ke kiri";
        } else {
          // kamera belakang: mentah di kanan => di layar tampak di kanan => geser ke kiri
          xLabel = dx > 0 ? "Ke kiri" : "Ke kanan";
        }
      }
      if (!okY) {
        yLabel = dy > 0 ? "Turunkan HP" : "Naikkan HP";
      }

      const stable = t.stab >= 70;
      if (!okScale) {
        statusText =
          scaleRatio < 1 ? "🔍 Dekatkan wajah ke kamera" : "↔️ Mundurkan wajah sedikit";
      } else if (!okX) {
        if (isUserFacing) {
          statusText = dx > 0 ? "👉 Geser sedikit ke kanan" : "👈 Geser sedikit ke kiri";
        } else {
          statusText = dx > 0 ? "👈 Geser sedikit ke kiri" : "👉 Geser sedikit ke kanan";
        }
      } else if (!okY) {
        statusText =
          dy > 0 ? "👇 Turunkan HP sedikit" : "👆 Naikkan HP sedikit";
      } else if (tooDark) {
        statusText = "💡 Terlalu gelap — cari tempat lebih terang";
      } else if (tooBright) {
        statusText = "☀️ Terlalu silau — kurangi cahaya langsung ke wajah";
      } else if (backlit) {
        statusText = "🔆 Cahaya dari belakang — hadapkan wajah ke sumber cahaya";
      } else if (uneven) {
        statusText = "🌗 Cahaya tidak merata — hadapkan wajah ke arah cahaya";
      } else if (hasPose && Math.abs(rollDeg) > MAX_ROLL_DEG) {
        statusText = "↩️ Luruskan kepala, jangan miring";
      } else if (hasPose && Math.abs(yaw) > MAX_YAW) {
        statusText = "😐 Hadap lurus ke kamera";
      } else if (!okSharp) {
        statusText = "📷 Gambar buram — bersihkan lensa & tahan HP diam";
      } else if (!stable) {
        statusText = "✋ Tahan HP agar tidak bergoyang";
      }

      const isBasic = eng.type === "basic";
      const allOk = okX && okY && okScale && okLight && okPose && okSharp;
      const ready = !isBasic && allOk && stable && score >= SCORE_READY;

      if (isBasic && allOk) {
        statusText =
          "Mode dasar aktif: tekan tombol Ambil Foto bila wajah sudah di dalam oval.";
      }

      const m = {
        detected: true,
        multiple: false,
        ready,
        score,
        stability: Math.round(t.stab),
        scalePct: Math.round(scaleRatio * 100),
        brightness: q ? Math.round(q.brightness) : 0,
        xLabel,
        yLabel,
        poseLabel: !hasPose ? "-" : okPose ? "Lurus" : "Miring",
        sharpLabel: !q ? "-" : okSharp ? "Tajam" : "Buram",
        ok: {
          x: okX,
          y: okY,
          scale: okScale,
          light: okLight,
          pose: okPose,
          sharp: okSharp,
        },
        box: { cx: t.sx, cy: t.sy, w: t.sw, h: face.h },
        statusText,
      };
      metricsRef.current = m;
      setFaceMetrics(m);

      updateCountdown(ready, now);
    };

    const loop = (now) => {
      if (!alive) return;
      rafRef.current = requestAnimationFrame(loop);
      if (busy || now - last < TICK_MS) return;
      last = now;
      busy = true;
      analyze(now)
        .catch((e) => console.warn("Analisis wajah gagal:", e))
        .finally(() => {
          busy = false;
        });
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      alive = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isOpen, cameraActive, previewImage]);

  // -------------------------------------------------------------------
  // 5. Ambil foto (crop 3:4 tepat sama dengan bingkai di layar)
  // -------------------------------------------------------------------
  function captureFaceSnapshot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      const g = getGuideRect(video.videoWidth, video.videoHeight);
      const out = document.createElement("canvas");
      out.width = OUT_W;
      out.height = OUT_H;
      const ctx = out.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      // Tidak dicerminkan: foto referensi harus orientasi asli (seperti dilihat orang lain)
      ctx.drawImage(video, g.x, g.y, g.w, g.h, 0, 0, OUT_W, OUT_H);

      capturedMetricsRef.current = { ...metricsRef.current };
      setCountdown(null);
      setPreviewImage(out.toDataURL("image/jpeg", 0.9));
      stopCamera();
      playBeep(880, 1175);
      if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
    } catch (err) {
      console.error("Gagal mengambil foto wajah:", err);
      alert("Gagal mengambil gambar wajah. Silakan ulangi.");
    }
  }
  captureRef.current = captureFaceSnapshot;

  // Tombol manual: pada mode AI/native wajib ada wajah terdeteksi
  function handleManualCapture() {
    const type = engineRef.current?.type;
    if (type === "ai" || type === "native") {
      if (performance.now() - lastFaceAtRef.current > 1000) {
        alert("Wajah belum terdeteksi. Hadapkan wajah Anda ke dalam oval.");
        return;
      }
      if (metricsRef.current.multiple) {
        alert("Terdeteksi lebih dari satu wajah. Pastikan hanya Anda di kamera.");
        return;
      }
    }
    captureFaceSnapshot();
  }

  function handleRetake() {
    setPreviewImage(null);
    setSaveProgress(null);
    setFaceMetrics(EMPTY_METRICS);
    metricsRef.current = EMPTY_METRICS;
    startCamera();
  }

  // -------------------------------------------------------------------
  // 6. Simpan: upload -> update spreadsheet -> VERIFIKASI tersimpan
  // -------------------------------------------------------------------
  async function handleSaveFaceToSpreadsheet() {
    if (!previewImage || !user?.id || saving) return;

    setSaving(true);
    setSaveProgress({
      pct: 12,
      label: "Menganalisis biometrik wajah (128-d)...",
      done: false,
      error: false,
    });

    try {
      // 1. Ekstraksi biometrik wajah & Pemeriksaan Anti-Duplikasi
      let myDescriptor = null;
      try {
        const fa = await loadFaceApi();
        const img = await loadImage(previewImage);
        const det = await fa
          .detectSingleFace(
            img,
            new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }),
          )
          .withFaceLandmarks(true);

        if (det) {
          const [aligned] = await fa.extractFaces(img, [det.landmarks.align()]);
          myDescriptor = await fa.nets.faceRecognitionNet.computeFaceDescriptor(aligned);
        }
      } catch (e) {
        console.warn("Gagal menganalisis fitur biometrik wajah:", e);
      }

      // Jika fitur biometrik wajah berhasil diekstrak, lakukan verifikasi anti-duplikasi
      if (myDescriptor) {
        setSaveProgress({
          pct: 28,
          label: "Memeriksa keunikan wajah (Anti-Duplikasi)...",
          done: false,
          error: false,
        });

        const dupCheck = await checkFaceDuplicate({
          currentStudentId: user.id,
          descriptor: myDescriptor,
          otherStudents,
          threshold: 0.45,
        });

        if (dupCheck.isDuplicate) {
          setSaving(false);
          setSaveProgress({
            pct: 100,
            label: `❌ Wajah sudah terdaftar atas nama ${dupCheck.matchedName}`,
            done: true,
            error: true,
          });
          alert(
            `⛔ Registrasi Wajah Ditolak!\n\n` +
            `Biometrik wajah ini terdeteksi sudah terdaftar atas nama siswa lain:\n` +
            `• Nama: ${dupCheck.matchedName}\n` +
            `• ID Siswa: ${dupCheck.matchedId}\n\n` +
            `Satu wajah tidak dapat digunakan untuk mendaftar lebih dari satu siswa.`
          );
          return;
        }
      }

      // 2. Upload (dipakai ulang jika sebelumnya upload sukses tapi simpan gagal)
      let photoUrl = null;
      if (uploadedRef.current.image === previewImage) {
        photoUrl = uploadedRef.current.url;
      } else {
        setSaveProgress({
          pct: 50,
          label: "Mengunggah foto wajah ke Google Drive...",
          done: false,
          error: false,
        });
        const fileName = `wajah_${user.id}_${Date.now()}.jpg`;
        const uploadRes = await uploadPhoto(previewImage, fileName, "image/jpeg");
        if (!uploadRes?.success || !uploadRes.data?.url) {
          throw new Error(uploadRes?.message || "Gagal mengunggah foto ke server.");
        }
        photoUrl = uploadRes.data.url;
        uploadedRef.current = { image: previewImage, url: photoUrl };
      }

      setSaveProgress({
        pct: 75,
        label: "Mendaftarkan foto wajah ke spreadsheet...",
        done: false,
        error: false,
      });
      const updateRes = await updateBiodataSiswa({
        idSiswa: user.id,
        fotoWajah: photoUrl, // terpisah dari fotoProfil (kartu barcode)
      });
      if (!updateRes?.success) {
        throw new Error(updateRes?.message || "Gagal memperbarui data di spreadsheet.");
      }

      // Simpan template deskriptor biometrik ke cache lokal agar scanner presensi instan mengenali
      if (myDescriptor && photoUrl) {
        try {
          writeCachedDescriptor(user.id, photoUrl, myDescriptor);
        } catch (_) {}
      }

      // Verifikasi lembut: coba baca ulang dari server untuk sinkronisasi cache
      setSaveProgress({
        pct: 90,
        label: "Memeriksa konfirmasi data...",
        done: false,
        error: false,
      });
      try {
        const check = await getBiodataSiswa(String(user.id));
        if (check?.success && check.data?.fotoWajah) {
          // Terverifikasi langsung dari database
          setExistingFacePhoto(check.data.fotoWajah);
        }
      } catch (_) {
        // Jika pembacaan ulang terhambat koneksi, tetap lanjutkan karena upload & update sukses
      }

      try {
        localStorage.setItem(
          `face_reg_${user.id}`,
          JSON.stringify({
            idSiswa: user.id,
            nama: user.nama,
            fotoWajah: photoUrl,
            registeredAt: new Date().toISOString(),
            score: capturedMetricsRef.current.score || 0,
          }),
        );
        // Hapus cache fitur lama agar otomatis diekstrak ulang dari foto terbaru
        localStorage.removeItem(`face_feat_${user.id}`);
        localStorage.removeItem(`face_feat_zncc_${user.id}`);
      } catch (_) {}

      setExistingFacePhoto(photoUrl);
      setSaveProgress({
        pct: 100,
        label: "✅ Registrasi wajah berhasil disimpan!",
        done: true,
        error: false,
      });
      if (typeof onFaceRegistered === "function") onFaceRegistered(photoUrl);

      closeTimerRef.current = setTimeout(() => {
        stopCamera();
        onClose();
      }, 1400);
    } catch (err) {
      console.error("Gagal menyimpan registrasi wajah:", err);
      setSaveProgress({
        pct: 100,
        label: `❌ ${err.message || "Koneksi terputus"}`,
        done: true,
        error: true,
      });
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    stopCamera();
    onClose();
  }

  if (!isOpen) return null;

  const m = faceMetrics;
  const saveOk = saveProgress?.done && !saveProgress?.error;
  const scoreColor =
    m.score >= SCORE_READY
      ? "emerald"
      : m.score >= 60
        ? "amber"
        : "slate";
  const ovalClass =
    m.ready || m.score >= SCORE_READY
      ? "border-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.55)]"
      : m.score >= 60
        ? "border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.35)]"
        : "border-teal-300/60 shadow-[0_0_10px_rgba(20,184,166,0.2)]";

  const Tile = ({ label, value, ok }) => (
    <div className="py-1 px-1 rounded-xl bg-white border border-slate-200 shadow-xs">
      <div className="text-[8px] font-black uppercase text-slate-400">{label}</div>
      <div
        className={`text-[11px] font-black font-mono mt-0.5 ${
          !m.detected ? "text-slate-400" : ok ? "text-emerald-700" : "text-amber-700"
        }`}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* HEADER */}
        <div className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3 bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-teal-400/20 text-teal-300 text-sm">🧑</span>
            <div className="leading-tight">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-xs sm:text-sm font-black tracking-tight">
                  Registrasi Wajah Siswa
                </h3>
                {user?.nama && (
                  <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-teal-400/25 text-teal-100 font-extrabold border border-teal-300/30 max-w-[180px] truncate">
                    {user.nama}
                  </span>
                )}
              </div>
              <p className="text-[9.5px] sm:text-[10px] text-teal-200">
                {engine === "loading"
                  ? "⏳ Memuat deteksi wajah AI..."
                  : engine === "ai"
                    ? "🤖 Deteksi wajah AI aktif"
                    : engine === "native"
                      ? "✓ Deteksi wajah bawaan browser"
                      : "⚠️ Mode dasar (tanpa AI)"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!previewImage && (
              <button
                type="button"
                onClick={toggleCameraFacing}
                disabled={saving}
                className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-white text-[10px] sm:text-xs font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/20"
                title="Ganti Kamera Depan / Belakang"
              >
                <span>📷</span>
                <span>{cameraFacing === "environment" ? "Blkg" : "Dpn"}</span>
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={saving}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-xs font-bold cursor-pointer disabled:opacity-50"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/50">
          {/* Banner foto terdaftar */}
          <div className="px-2.5 py-1.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[10.5px] flex items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              {existingFacePhoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={driveThumb(existingFacePhoto)}
                  alt="Foto terdaftar"
                  className="w-7 h-9 rounded object-cover border border-amber-300 shrink-0"
                />
              ) : (
                <span>🔒</span>
              )}
              <span className="truncate">
                {existingFacePhoto ? (
                  <>
                    Sudah terdaftar. Mendaftar ulang akan <strong>menimpa</strong> foto lama.
                  </>
                ) : (
                  <>
                    Foto ini <strong>tersendiri</strong> &amp; tidak mengubah kartu barcode.
                  </>
                )}
              </span>
            </div>
            {existingFacePhoto && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-600 text-white font-bold shrink-0">
                ✓ Terdaftar
              </span>
            )}
          </div>

          {engine === "basic" && !previewImage && (
            <div className="px-2.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[10.5px]">
              Deteksi AI tidak dapat dimuat (cek koneksi internet). Pengambilan otomatis
              dinonaktifkan; pastikan <strong>hanya wajah Anda</strong> yang berada di dalam oval.
            </div>
          )}

          {/* ====== KAMERA (selalu ter-mount agar stream bisa dipasang ulang) ====== */}
          <div className={previewImage ? "hidden" : "space-y-2.5"}>
            <div
              className="relative rounded-2xl overflow-hidden bg-black border-2 border-slate-800 mx-auto shadow-lg"
              style={{ aspectRatio: "3 / 4", width: "min(100%, 42vh)" }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`absolute inset-0 w-full h-full object-cover transition-transform duration-200 ${
                  cameraFacing === "user" ? "-scale-x-100" : ""
                }`}
              />

              {cameraActive && (
                <div className="absolute inset-0 pointer-events-none">
                  {/* Status */}
                  <div
                    role="status"
                    aria-live="polite"
                    className={`absolute top-2 left-1/2 -translate-x-1/2 max-w-[94%] text-center px-3 py-1 rounded-full text-[10.5px] font-bold shadow-md backdrop-blur-xs transition-colors ${
                      m.ready
                        ? "bg-emerald-600/95 text-white ring-2 ring-emerald-300"
                        : m.score >= 60
                          ? "bg-amber-600/90 text-white"
                          : "bg-slate-900/85 text-slate-100"
                    }`}
                  >
                    {m.statusText}
                  </div>

                  {/* Kotak wajah terdeteksi (dicerminkan jika kamera depan) */}
                  {m.box && (
                    <div
                      className={`absolute rounded-md border-2 transition-all duration-100 ${
                        m.ready ? "border-emerald-300/90" : "border-white/50"
                      }`}
                      style={{
                        left: cameraFacing === "user"
                          ? `${(1 - (m.box.cx + m.box.w / 2)) * 100}%`
                          : `${(m.box.cx - m.box.w / 2) * 100}%`,
                        top: `${(m.box.cy - m.box.h / 2) * 100}%`,
                        width: `${m.box.w * 100}%`,
                        height: `${m.box.h * 100}%`,
                      }}
                    />
                  )}

                  {/* Oval panduan */}
                  <div
                    className={`absolute rounded-[50%] border-[3px] border-dashed transition-all duration-200 ${ovalClass}`}
                    style={{
                      left: "50%",
                      top: `${TARGET.cy * 100}%`,
                      width: "64%",
                      height: "65%",
                      transform: "translate(-50%, -50%)",
                    }}
                  />

                  {/* Hitung mundur */}
                  {countdown !== null && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-7xl font-black text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] animate-pulse">
                        {countdown}
                      </span>
                    </div>
                  )}

                  {/* Skor */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[86%] space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-mono text-white/90 px-1 font-bold">
                      <span>Skor Posisi Wajah</span>
                      <span
                        className={
                          scoreColor === "emerald" ? "text-emerald-300 font-black" : "text-amber-300"
                        }
                      >
                        {m.score}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/20 p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-150 ${
                          scoreColor === "emerald"
                            ? "bg-gradient-to-r from-emerald-400 to-teal-300 shadow-[0_0_10px_#34d399]"
                            : scoreColor === "amber"
                              ? "bg-gradient-to-r from-amber-400 to-yellow-300"
                              : "bg-gradient-to-r from-rose-500 to-amber-500"
                        }`}
                        style={{ width: `${Math.max(6, m.score)}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {!cameraActive && !cameraError && (
                <div className="absolute inset-0 flex items-center justify-center text-white/80 text-xs font-bold">
                  <span className="animate-pulse">Membuka kamera...</span>
                </div>
              )}

              {cameraError && (
                <div className="absolute inset-0 p-4 bg-slate-900/95 text-white flex flex-col items-center justify-center text-center space-y-2">
                  <span className="text-3xl">📷</span>
                  <p className="text-xs text-rose-300 max-w-xs">{cameraError}</p>
                  <button
                    onClick={startCamera}
                    className="px-4 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Coba Buka Kamera Lagi
                  </button>
                </div>
              )}
            </div>

            {/* Metrik */}
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <Tile label="Posisi X" value={m.xLabel} ok={m.ok.x} />
              <Tile label="Posisi Y" value={m.yLabel} ok={m.ok.y} />
              <Tile
                label="Jarak"
                value={m.scalePct > 0 ? `${m.scalePct}%` : "-"}
                ok={m.ok.scale}
              />
              <Tile
                label="Cahaya"
                value={m.brightness > 0 ? `${m.brightness}%` : "-"}
                ok={m.ok.light}
              />
              <Tile label="Kepala" value={m.poseLabel} ok={m.ok.pose} />
              <Tile label="Fokus" value={m.sharpLabel} ok={m.ok.sharp} />
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label className="flex items-center gap-1.5 text-[10.5px] font-bold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoCaptureEnabled}
                  disabled={engine === "basic"}
                  onChange={(e) => setAutoCaptureEnabled(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 w-3.5 h-3.5"
                />
                <span>Ambil otomatis saat posisi pas</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">
                Stabil: {m.detected ? `${m.stability}%` : "-"}
              </span>
            </div>
          </div>

          {/* ====== PRATINJAU ====== */}
          {previewImage && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2">
                <span className="text-xl">✅</span>
                <div>
                  <div className="font-bold">Foto wajah berhasil diambil!</div>
                  <div className="text-[10.5px] text-emerald-800">
                    Periksa hasilnya sebelum disimpan. Wajah harus jelas, tidak tertutup masker/kacamata
                    gelap/topi.
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <div className="w-36 h-48 sm:w-40 sm:h-52 rounded-xl overflow-hidden border-2 border-emerald-500 shadow-md bg-slate-100 shrink-0 relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewImage} alt="Pratinjau Wajah" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/60 text-white font-mono text-[9px] font-bold">
                    3 : 4
                  </span>
                </div>

                <div className="space-y-1.5 flex-1 w-full text-xs">
                  <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">
                      Informasi Registrasi
                    </div>
                    <div className="font-black text-slate-800 text-sm">{user?.nama || "Siswa"}</div>
                    <div className="text-slate-500 font-mono text-[10px]">ID Siswa: {user?.id}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[10.5px]">
                    <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-bold">
                      🎯 Skor: <strong>{capturedMetricsRef.current.score || 0}%</strong>
                    </div>
                    <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 font-bold">
                      💡 Cahaya: <strong>{capturedMetricsRef.current.brightness || 0}%</strong>
                    </div>
                  </div>

                  <p className="text-[10px] text-teal-800 leading-tight bg-teal-50 p-2 rounded-lg border border-teal-200">
                    🔒 Disimpan khusus untuk <strong>presensi wajah</strong> dan{" "}
                    <strong>tidak mengubah foto kartu barcode</strong>.
                  </p>
                </div>
              </div>

              {saveProgress && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className={saveProgress.error ? "text-rose-700" : ""}>
                      {saveProgress.label}
                    </span>
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
          )}
        </div>

        {/* FOOTER */}
        <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          {!previewImage ? (
            <>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 sm:px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  disabled={saving || !cameraActive}
                  className="px-2.5 sm:px-3 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  title="Ganti Kamera Depan / Belakang"
                >
                  <span>📷</span>
                  <span>{cameraFacing === "environment" ? "Kamera Belakang" : "Kamera Depan"}</span>
                </button>
              </div>
              <button
                type="button"
                onClick={handleManualCapture}
                disabled={!cameraActive || countdown !== null || engine === "loading"}
                className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:brightness-110 active:scale-95 text-white text-xs font-black shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>📸</span>
                <span>Ambil Foto Wajah</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRetake}
                disabled={saving || saveOk}
                className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                <span>🔄</span>
                <span>Foto Ulang</span>
              </button>
              <button
                type="button"
                onClick={handleSaveFaceToSpreadsheet}
                disabled={saving || saveOk}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:brightness-110 active:scale-95 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : saveProgress?.error ? (
                  <>
                    <span>🔁</span>
                    <span>Coba Simpan Lagi</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Simpan Registrasi</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
