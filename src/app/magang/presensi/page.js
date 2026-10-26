"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cleanupResources } from "../lib/navigation";
import { getSession, isLoggedIn } from "../lib/auth";
import { savePresensi, logoutSession } from "../lib/api";
import QRCode from "qrcode";

/* =====================================================================
   PRESENSI MAGANG (PKL) — versi responsif, padat, foto otomatis instan
   Alur: 1 Foto (otomatis saat wajah muncul) → 2 Pembimbing → 3 Kompetensi → 4 Kirim
   ===================================================================== */

// ---- Deteksi wajah (TinyFaceDetector ±190 KB, dimuat sekali) ----
const FA_VERSION = "1.7.15";
const FA_BUNDLE = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FA_VERSION}/dist/face-api.esm.js`;
const FA_MODELS = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FA_VERSION}/model/`;

let faPromise = null;
function loadFaceDetector() {
  if (faPromise) return faPromise;
  faPromise = (async () => {
    const fa = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ FA_BUNDLE
    );
    let ok = false;
    try {
      ok = await fa.tf.setBackend("webgl");
    } catch (_) {}
    if (!ok) {
      try {
        await fa.tf.setBackend("cpu");
      } catch (_) {}
    }
    await fa.tf.ready();
    await fa.nets.tinyFaceDetector.loadFromUri(FA_MODELS);
    return fa;
  })().catch((err) => {
    faPromise = null; // izinkan dicoba lagi bila koneksi pulih
    throw err;
  });
  return faPromise;
}

// Pengaturan foto otomatis instan saat posisi wajah tepat di bingkai oval
const AUTO_MIN_FACE_SIZE = 0.3; // lebar wajah minimal 30% dari dimensi terkecil frame
const AUTO_MAX_FACE_SIZE = 0.72; // lebar wajah maksimal 72% dari dimensi terkecil frame
const AUTO_CENTER_X_MIN = 0.38; // batas kiri pusat wajah (tengah: 0.50)
const AUTO_CENTER_X_MAX = 0.62; // batas kanan pusat wajah
const AUTO_CENTER_Y_MIN = 0.28; // batas atas pusat wajah
const AUTO_CENTER_Y_MAX = 0.64; // batas bawah pusat wajah
const AUTO_STABLE_HITS = 3; // butuh 3 deteksi stabil berturut-turut (~400ms) saat posisi benar-benar pas
const DETECT_INTERVAL_MS = 140;

const STEPS = [
  { id: 1, label: "Foto", icon: "📸" },
  { id: 2, label: "Pembimbing", icon: "👤" },
  { id: 3, label: "Kompetensi", icon: "🛠️" },
  { id: 4, label: "Kirim", icon: "🚀" },
];

const NamaBadge = ({ rawName }) => {
  if (!rawName) return null;

  const match = rawName.match(/(.+?)\s*\[(.*?)\]/);

  if (!match) {
    return <span>{rawName}</span>;
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
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{namaSiswa}</span>{" "}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 border rounded-md text-[10px] font-black uppercase tracking-wider ${badgeClasses}`}
      >
        {kelas}
      </span>
    </span>
  );
};

function pesanGps(code) {
  if (code === 1) {
    return {
      title: "Izin Lokasi Ditolak",
      message:
        "Izin lokasi untuk situs ini diblokir. Ketuk ikon gembok / pengaturan di sebelah alamat situs → Izin → Lokasi → Izinkan. Setelah itu tekan “Coba Lagi”.",
    };
  }
  if (code === 2) {
    return {
      title: "Hidupkan Lokasi (GPS) HP",
      message:
        "Lokasi HP belum aktif atau tidak tersedia. Tarik panel notifikasi dari atas layar, nyalakan ikon “Lokasi / GPS”, lalu tekan “Coba Lagi”.",
    };
  }
  if (code === 3) {
    return {
      title: "Sinyal GPS Lemah",
      message:
        "Titik lokasi belum didapat. Pindah ke tempat terbuka (dekat jendela/luar ruangan), pastikan Lokasi menyala, lalu tekan “Coba Lagi”.",
    };
  }
  return {
    title: "Lokasi Belum Didapat",
    message:
      "Pastikan Lokasi (GPS) HP menyala dan izin lokasi browser diaktifkan, lalu tekan “Coba Lagi”.",
  };
}

export default function PresensiPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const [status, setStatus] = useState("Hadir");
  const [pembimbing, setPembimbing] = useState("");
  const [kompetensi, setKompetensi] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [step, setStep] = useState(1);

  const [recentPembimbing, setRecentPembimbing] = useState([]);
  const [hasPresensiToday, setHasPresensiToday] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkCanvasRef = useRef(null);

  const [photo, setPhoto] = useState("");
  const [capturedAt, setCapturedAt] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const [latitude, setLatitude] = useState("-");
  const [longitude, setLongitude] = useState("-");
  const [accuracy, setAccuracy] = useState("-");
  const [alamat, setAlamat] = useState("-");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatusText, setSaveStatusText] = useState("");

  // Foto otomatis (langsung saat wajah terdeteksi stabil tanpa countdown)
  const [autoCapture, setAutoCapture] = useState(true);
  const [detectorState, setDetectorState] = useState("loading"); // loading | ready | unsupported
  const [faceState, setFaceState] = useState("none"); // none | found | capturing
  const [flashEffect, setFlashEffect] = useState(false);

  // Dialog notifikasi
  const [dialog, setDialog] = useState(null);

  const streamRef = useRef(null);
  const watchIdRef = useRef(null);
  const faRef = useRef(null);
  const nativeDetectorRef = useRef(null);
  const detectTimerRef = useRef(null);
  const stableHitsRef = useRef(0);
  const busyRef = useRef(false);
  const autoCaptureRef = useRef(true);
  const photoRef = useRef("");
  const submittingRef = useRef(false);
  const redirectTimerRef = useRef(null);
  const gpsRunRef = useRef(0);
  const inputRef = useRef(null);
  const textRef = useRef(null);

  useEffect(() => {
    autoCaptureRef.current = autoCapture;
    if (!autoCapture) {
      stableHitsRef.current = 0;
    }
  }, [autoCapture]);

  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);

  /* ------------------------------ Dialog ------------------------------ */
  function showDialog(d) {
    setDialog(d);
  }
  function closeDialog() {
    setDialog(null);
  }
  function warn(message, title = "Perhatian") {
    showDialog({
      type: "warn",
      title,
      message,
      actions: [{ label: "Mengerti", primary: true, onClick: closeDialog }],
    });
  }

  /* ------------------------------ Kamera ------------------------------ */
  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  function stopDetectLoop() {
    if (detectTimerRef.current) {
      clearTimeout(detectTimerRef.current);
      detectTimerRef.current = null;
    }
    stableHitsRef.current = 0;
  }

  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Browser memblokir kamera. Buka situs ini lewat HTTPS (bukan http biasa).",
      );
      return;
    }

    stopStream();
    stopDetectLoop();
    setCameraReady(false);
    setCameraError("");
    setFaceState("none");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      attachStream(stream);
    } catch (err) {
      console.warn("Kamera depan HD gagal, mencoba mode standar...", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        attachStream(fallbackStream);
      } catch (fallbackErr) {
        console.error("Semua percobaan akses kamera gagal:", fallbackErr);
        setCameraError(
          "Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu ketuk tombol di bawah.",
        );
      }
    }
  }

  function attachStream(stream) {
    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stopStream();
      return;
    }
    video.srcObject = stream;
    video.onloadedmetadata = async () => {
      try {
        await video.play();
        setCameraReady(true);
      } catch (e) {
        console.error("Gagal autoplay video:", e);
        setCameraError(
          "Video kamera gagal diputar. Ketuk tombol untuk mencoba lagi.",
        );
      }
    };
  }

  /* ----------------------- Deteksi wajah & foto otomatis instan ----------------------- */
  // Muat detektor di latar belakang
  useEffect(() => {
    let dead = false;
    (async () => {
      // 1. Coba FaceDetector bawaan Chrome/Android jika tersedia
      if (typeof window !== "undefined" && "FaceDetector" in window) {
        try {
          nativeDetectorRef.current = new window.FaceDetector({
            fastMode: true,
            maxDetectedFaces: 1,
          });
          if (!dead) {
            setDetectorState("ready");
            return;
          }
        } catch (_) {}
      }

      // 2. Muat TinyFaceDetector via ESM
      try {
        const fa = await loadFaceDetector();
        if (dead) return;
        faRef.current = fa;
        setDetectorState("ready");
      } catch (err) {
        console.warn("face-api tidak dapat dimuat:", err);
        if (dead) return;
        setDetectorState("unsupported");
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // Mengembalikan data wajah ternormalisasi & posisi tengah (0..1) atau null
  async function detectOnce(video) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const minDim = Math.min(vw, vh);

    if (nativeDetectorRef.current) {
      try {
        const faces = await nativeDetectorRef.current.detect(video);
        if (faces && faces.length > 0) {
          const b = faces[0].boundingBox;
          return {
            sizeRatio: b.width / minDim,
            cx: (b.x + b.width / 2) / vw,
            cy: (b.y + b.height / 2) / vh,
          };
        }
      } catch (_) {}
    }

    if (faRef.current) {
      try {
        const fa = faRef.current;
        const res = await fa.detectSingleFace(
          video,
          new fa.TinyFaceDetectorOptions({
            inputSize: 224,
            scoreThreshold: 0.45,
          }),
        );
        if (!res) return null;
        const b = res.box;
        return {
          sizeRatio: b.width / minDim,
          cx: (b.x + b.width / 2) / vw,
          cy: (b.y + b.height / 2) / vh,
        };
      } catch (_) {}
    }

    return null;
  }

  // Evaluasi apakah wajah benar-benar berada tepat di dalam bingkai oval panduan
  function evaluateFace(f) {
    if (!f) return { ok: false, reason: "none" };
    if (f.sizeRatio < AUTO_MIN_FACE_SIZE)
      return { ok: false, reason: "too_far" };
    if (f.sizeRatio > AUTO_MAX_FACE_SIZE)
      return { ok: false, reason: "too_close" };
    if (f.cx < AUTO_CENTER_X_MIN || f.cx > AUTO_CENTER_X_MAX)
      return { ok: false, reason: "off_x" };
    if (f.cy < AUTO_CENTER_Y_MIN || f.cy > AUTO_CENTER_Y_MAX)
      return { ok: false, reason: "off_y" };
    return { ok: true, reason: "perfect" };
  }

  const runDetectLoop = useCallback(() => {
    stopDetectLoop();
    const tick = async () => {
      detectTimerRef.current = null;
      const video = videoRef.current;
      if (
        !video ||
        photoRef.current ||
        !streamRef.current ||
        video.readyState < 2
      ) {
        detectTimerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
        return;
      }

      if (!busyRef.current) {
        busyRef.current = true;
        try {
          const f = await detectOnce(video);
          const ev = evaluateFace(f);

          if (ev.ok) {
            setFaceState("perfect");
            if (autoCaptureRef.current && !photoRef.current) {
              stableHitsRef.current += 1;
              // Foto HANYA terambil bila posisi wajah sudah benar-benar pas di dalam bingkai oval
              // dan stabil selama ~400ms (tidak bergerak/blur)
              if (stableHitsRef.current >= AUTO_STABLE_HITS) {
                setFaceState("capturing");
                doCapture(true);
                return;
              }
            }
          } else {
            // Wajah belum/tidak di posisi yang tepat: BATALKAN hitungan otomatis!
            stableHitsRef.current = 0;
            if (ev.reason === "too_far") setFaceState("too_far");
            else if (ev.reason === "too_close") setFaceState("too_close");
            else if (ev.reason === "off_x" || ev.reason === "off_y")
              setFaceState("off_center");
            else setFaceState("none");
          }
        } catch (e) {
          console.warn("Deteksi wajah tick error:", e);
        } finally {
          busyRef.current = false;
        }
      }

      if (streamRef.current && !photoRef.current) {
        detectTimerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
      }
    };

    detectTimerRef.current = setTimeout(tick, DETECT_INTERVAL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jalankan loop bila kamera & detektor siap dan belum ada foto
  useEffect(() => {
    if (cameraReady && detectorState === "ready" && !photo) {
      runDetectLoop();
    }
    return () => stopDetectLoop();
  }, [cameraReady, detectorState, photo, runDetectLoop]);

  /* ------------------------------ Foto + GPS ------------------------------ */
  function doCapture(isAuto = false) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || photoRef.current) return;

    if (
      video.readyState < 2 ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      if (!isAuto) warn("Kamera masih mempersiapkan gambar. Tunggu sebentar.");
      return;
    }

    stopDetectLoop();

    // Efek flash visual saat capture
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/jpeg", 0.9);
    photoRef.current = image;
    setPhoto(image);
    setCapturedAt(new Date());
    setFaceState("none");

    // Matikan kamera setelah difoto (hemat baterai & RAM)
    stopStream();
    setCameraReady(false);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch (_) {}
    }

    // Ambil GPS dan otomatis lanjut langkah jika lokasi terkunci
    fetchLocation(true);
  }

  async function ambilUlang() {
    gpsRunRef.current += 1;
    photoRef.current = "";
    setPhoto("");
    setCapturedAt(null);
    setLatitude("-");
    setLongitude("-");
    setAccuracy("-");
    setAlamat("-");
    setGpsError(false);
    setGpsLoading(false);
    setFaceState("none");
    setStep(1);
    await startCamera();
  }

  function getPosition(opts) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, opts);
    });
  }

  // Ambil lokasi GPS. autoNext: lanjut otomatis ke langkah 2 bila berhasil
  async function fetchLocation(autoNext = false) {
    if (!navigator.geolocation) {
      setGpsError(true);
      showDialog({
        type: "error",
        title: "GPS Tidak Didukung",
        message:
          "Browser ini tidak mendukung lokasi. Gunakan Chrome atau browser terbaru di HP Anda.",
        actions: [{ label: "Mengerti", primary: true, onClick: closeDialog }],
      });
      return;
    }

    const run = ++gpsRunRef.current;
    setGpsLoading(true);
    setGpsError(false);
    setAlamat("-");

    let permState = "";
    try {
      if (navigator.permissions?.query) {
        const p = await navigator.permissions.query({ name: "geolocation" });
        permState = p.state;
      }
    } catch (_) {}

    let pos = null;
    let lastErr = null;
    try {
      pos = await getPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    } catch (err) {
      lastErr = err;
      // Coba fallback akurasi standar bila mode tinggi timeout/gagal
      if (err && (err.code === 2 || err.code === 3)) {
        try {
          pos = await getPosition({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 0,
          });
          lastErr = null;
        } catch (err2) {
          lastErr = err2;
        }
      }
    }

    if (run !== gpsRunRef.current) return;

    if (!pos) {
      setGpsLoading(false);
      setGpsError(true);
      const code = permState === "denied" ? 1 : lastErr?.code;
      const m = pesanGps(code);
      showDialog({
        type: "gps",
        title: m.title,
        message: m.message,
        actions: [
          {
            label: "Coba Lagi",
            primary: true,
            onClick: () => {
              closeDialog();
              fetchLocation(autoNext);
            },
          },
          { label: "Nanti", onClick: closeDialog },
        ],
      });
      return;
    }

    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    setLatitude(lat);
    setLongitude(lon);
    setAccuracy(Math.round(pos.coords.accuracy) + " meter");
    setGpsError(false);

    // Lanjut otomatis ke langkah berikutnya begitu lokasi terkunci
    if (autoNext) {
      setStep((s) => (s === 1 ? 2 : s));
    }

    // Ambil detail alamat di latar belakang (tidak menahan alur)
    const ctrl =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const to = setTimeout(() => ctrl && ctrl.abort(), 8000);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
        ctrl ? { signal: ctrl.signal } : undefined,
      );
      const data = await res.json();
      if (run === gpsRunRef.current) {
        setAlamat(data.display_name || "Detail alamat tidak ditemukan");
      }
    } catch (err) {
      console.error(err);
      if (run === gpsRunRef.current) {
        setAlamat("Alamat tidak termuat (koordinat tetap tersimpan)");
      }
    } finally {
      clearTimeout(to);
      if (run === gpsRunRef.current) setGpsLoading(false);
    }
  }

  /* ------------------------------ Watermark ------------------------------ */
  function addWatermark(imageData) {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.onerror = () => resolve(imageData);
      img.onload = () => {
        const canvas = watermarkCanvasRef.current;
        if (!canvas) return resolve(imageData);
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(img, 0, 0);

        // Skala proporsional berbasis lebar 1280 agar teks pas di semua resolusi HP
        const k = img.width / 1280;
        const W = 1280;
        const H = img.height / k;

        ctx.save();
        ctx.scale(k, k);

        const t = capturedAt || new Date();
        const hari = t.toLocaleDateString("id-ID", { weekday: "long" });
        const tanggal = t.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const jam = t.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        // Kotak Lokasi Atas
        const topBoxW = 480;
        const topBoxH = 140;
        const topBoxX = W - topBoxW - 20;
        const topBoxY = 20;

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(topBoxX, topBoxY, topBoxW, topBoxH);

        ctx.font = "34px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("📍", topBoxX + 20, topBoxY + 50);

        ctx.font = "bold 18px Arial";
        ctx.fillText("LOKASI SAAT INI:", topBoxX + 65, topBoxY + 45);

        ctx.font = "16px Arial";
        const alamatText = alamat !== "-" ? alamat : "Mencari detail alamat...";
        const maxTextWidth = topBoxW - 85;
        const words = alamatText.split(" ");
        let line = "";
        let textY = topBoxY + 75;
        const lineHeight = 22;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const testWidth = ctx.measureText(testLine).width;
          if (testWidth > maxTextWidth && n > 0) {
            ctx.fillText(line, topBoxX + 65, textY);
            line = words[n] + " ";
            textY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, topBoxX + 65, textY);

        // Kotak Data Siswa Bawah
        const boxX = 20;
        const boxY = H - 230;
        const boxW = W - 40;
        const boxH = 210;

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = "#FFFFFF";

        const titleX = boxX + 20;
        let titleY = boxY + 35;

        ctx.font = "bold 24px Arial";
        ctx.fillText("SMKN 1 TELUK KUANTAN", titleX, titleY);

        titleY += 30;
        ctx.font = "bold 20px Arial";
        ctx.fillText("PRESENSI SISWA MAGANG", titleX, titleY);

        const col1 = boxX + 20;
        const col2 = boxX + 330;
        const startY = boxY + 95;

        ctx.font = "18px Arial";

        ctx.fillText("Siswa : " + user.nama, col1, startY);
        ctx.fillText("Tempat : " + user.tempatMagang, col1, startY + 30);
        ctx.fillText("Status : " + status, col1, startY + 60);

        ctx.fillText("Hari : " + hari, col2, startY);
        ctx.fillText("Tanggal : " + tanggal, col2, startY + 30);
        ctx.fillText("Jam : " + jam + " WIB", col2, startY + 60);
        ctx.fillText("GPS : " + latitude, col2, startY + 90);

        // QR Code Lokasi
        const qrX = boxX + boxW - 165;
        const qrY = boxY + 20;
        const qrData = `https://maps.google.com/?q=${latitude},${longitude}`;

        const finish = () => {
          ctx.restore();
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        };

        QRCode.toDataURL(qrData, { width: 150, margin: 1 })
          .then((qrUrl) => {
            const qrImage = new window.Image();
            qrImage.onload = () => {
              ctx.drawImage(qrImage, qrX, qrY, 140, 140);
              ctx.fillStyle = "rgba(255,255,255,0.9)";
              ctx.fillRect(qrX, qrY + 140, 140, 24);
              ctx.fillStyle = "#000";
              ctx.font = "bold 13px Arial";
              ctx.textAlign = "center";
              ctx.fillText("BARCODE LOKASI", qrX + 70, qrY + 156);
              ctx.textAlign = "left";
              finish();
            };
            qrImage.onerror = finish;
            qrImage.src = qrUrl;
          })
          .catch(finish);
      };
      img.src = imageData;
    });
  }

  function cleanup() {
    stopDetectLoop();
    cleanupResources({
      streamRef,
      videoRef,
      watchIdRef,
    });
  }

  /* ------------------------------ Langkah & Navigasi ------------------------------ */
  const gpsOk = latitude !== "-";
  const fotoLengkap = !!photo && gpsOk;

  function goStep(n) {
    if (n > 1 && !fotoLengkap) {
      warn(
        !photo
          ? "Ambil foto terlebih dahulu."
          : "Lokasi GPS belum didapat. Hidupkan lokasi lalu coba lagi.",
      );
      return;
    }
    if (n > 2 && pembimbing.trim().length < 2) {
      setStep(2);
      return;
    }
    if (n > 3 && kompetensi.trim().length < 3) {
      setStep(3);
      return;
    }
    setStep(n);
  }

  function nextFromPembimbing(value) {
    const v = (value ?? pembimbing).trim();
    if (v.length < 2) {
      warn("Isi nama pembimbing lapangan terlebih dahulu.");
      return;
    }
    setStep(3);
  }

  function nextFromKompetensi() {
    if (kompetensi.trim().length < 3) {
      warn("Isi kompetensi / kegiatan yang dikerjakan hari ini.");
      return;
    }
    setStep(4);
  }

  // Fokus otomatis ke input saat berpindah langkah
  useEffect(() => {
    if (step !== 2 && step !== 3) return;
    const t = setTimeout(() => {
      const el = step === 2 ? inputRef.current : textRef.current;
      if (el) el.focus({ preventScroll: false });
    }, 180);
    return () => clearTimeout(t);
  }, [step]);

  /* ------------------------------ Simpan & Kirim ------------------------------ */
  async function handleSubmit() {
    if (submittingRef.current) return;

    if (!photo) {
      setStep(1);
      warn("Silakan ambil foto terlebih dahulu.");
      return;
    }
    if (latitude === "-") {
      setStep(1);
      showDialog({
        type: "gps",
        title: "Lokasi Belum Didapat",
        message:
          "Hidupkan Lokasi (GPS) HP Anda, lalu tekan “Coba Lagi” untuk mengunci titik koordinat.",
        actions: [
          {
            label: "Coba Lagi",
            primary: true,
            onClick: () => {
              closeDialog();
              fetchLocation(false);
            },
          },
          { label: "Nanti", onClick: closeDialog },
        ],
      });
      return;
    }
    if (pembimbing.trim() === "") {
      setStep(2);
      warn("Nama pembimbing lapangan wajib diisi.");
      return;
    }
    if (kompetensi.trim() === "") {
      setStep(3);
      warn("Kompetensi hari ini wajib diisi.");
      return;
    }

    submittingRef.current = true;
    let progressTimer = null;
    try {
      setSaving(true);
      setSaveProgress(12);
      setSaveStatusText("Menyiapkan foto & lokasi...");

      const photoWithWatermark = await addWatermark(photo);
      setSaveProgress(35);
      setSaveStatusText("Menyusun berkas bukti presensi...");

      progressTimer = setInterval(() => {
        setSaveProgress((prev) =>
          prev < 90 ? prev + Math.floor(Math.random() * 4 + 2) : prev,
        );
      }, 350);

      setSaveStatusText("Mengirim bukti presensi ke server...");
      setSaveProgress((prev) => Math.max(prev, 50));

      const result = await savePresensi({
        idSiswa: user.id,
        nama: user.nama,
        idGuru: user.idGuru,
        namaGuru: user.namaGuru,
        tempatMagang: user.tempatMagang,
        fotoUrl: photoWithWatermark,
        mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
        status: status,
        pembimbingLapangan: pembimbing,
        kompetensiYangDikuasai: kompetensi,
        keterangan: keterangan,
      });

      if (progressTimer) clearInterval(progressTimer);

      if (result && result.success) {
        setSaveProgress(100);
        setSaveStatusText("Presensi berhasil terkirim!");
        await new Promise((res) => setTimeout(res, 350));

        try {
          let pembimbingList = JSON.parse(
            localStorage.getItem("magang_recent_pembimbing") || "[]",
          );
          pembimbingList = pembimbingList.filter((item) => item !== pembimbing);
          if (pembimbing.trim() !== "") pembimbingList.unshift(pembimbing);
          pembimbingList = pembimbingList.slice(0, 10);

          localStorage.setItem(
            "magang_recent_pembimbing",
            JSON.stringify(pembimbingList),
          );
          localStorage.setItem(
            "magang_user_pref",
            JSON.stringify({ status, pembimbing }),
          );
          localStorage.setItem(
            "magang_last_presensi_date",
            new Date().toLocaleDateString("id-ID"),
          );
        } catch (_) {}

        const jamKirim = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });

        const goHome = () => {
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
          router.replace("/magang/dashboard_siswa");
        };
        showDialog({
          type: "success",
          title: "Presensi Berhasil Disimpan",
          message: `Terima kasih, ${String(user.nama).replace(/\s*\[.*?\]\s*/, "")}. Presensi “${status}” pukul ${jamKirim} WIB sudah terkirim.`,
          actions: [
            { label: "Ke Beranda Sekarang", primary: true, onClick: goHome },
          ],
        });
        redirectTimerRef.current = setTimeout(goHome, 3500);
      } else {
        showDialog({
          type: "error",
          title: "Presensi Belum Terkirim",
          message:
            (result && result.message) ||
            "Server menolak permintaan. Coba lagi.",
          actions: [{ label: "Tutup", primary: true, onClick: closeDialog }],
        });
      }
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      console.error(err);
      showDialog({
        type: "error",
        title: "Terjadi Kesalahan",
        message:
          "Presensi gagal dikirim. Periksa koneksi internet lalu tekan kirim lagi. Data Anda masih tersimpan di layar ini.",
        actions: [{ label: "Tutup", primary: true, onClick: closeDialog }],
      });
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      submittingRef.current = false;
      setSaving(false);
      setSaveProgress(0);
      setSaveStatusText("");
    }
  }

  /* ------------------------------ Lifecycle ------------------------------ */
  useEffect(() => {
    async function initSession() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();
      if (!session || session.role !== "siswa") {
        router.replace("/magang/login");
        return;
      }

      setUser(session);
      try {
        setRecentPembimbing(
          JSON.parse(localStorage.getItem("magang_recent_pembimbing") || "[]"),
        );
        const pref = JSON.parse(
          localStorage.getItem("magang_user_pref") || "{}",
        );
        if (pref.status) setStatus(pref.status);
        if (pref.pembimbing) setPembimbing(pref.pembimbing);
        if (localStorage.getItem("magang_auto_capture") === "0") {
          setAutoCapture(false);
        }
        const lastPresensiDate = localStorage.getItem(
          "magang_last_presensi_date",
        );
        if (lastPresensiDate === new Date().toLocaleDateString("id-ID")) {
          setHasPresensiToday(true);
        }
      } catch (_) {}

      setLoading(false);
    }

    initSession();
  }, [router]);

  // Aktifkan kamera otomatis saat masuk
  useEffect(() => {
    if (loading || !user) return;
    const t = setTimeout(() => {
      if (!photoRef.current) startCamera();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  // Jam berjalan
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Matikan kamera saat tab browser disembunyikan
  useEffect(() => {
    const onHide = () => {
      if (document.hidden && !photoRef.current) {
        stopDetectLoop();
        stopStream();
        setCameraReady(false);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  useEffect(() => {
    return () => {
      gpsRunRef.current += 1;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------ Render UI ------------------------------ */
  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-700 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-600 tracking-wide">
            Membuka Form Presensi...
          </p>
        </div>
      </main>
    );
  }

  const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
  const tanggal = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const jam = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const accNum = parseInt(String(accuracy), 10);
  const accBuruk = !isNaN(accNum) && accNum > 50;

  // Status keterangan kamera interaktif sesuai posisi wajah
  let kameraInfo = "";
  let kameraTone = "bg-slate-900/75 text-white";
  if (!photo && cameraReady) {
    if (faceState === "capturing") {
      kameraInfo = "📸 Jepret! Foto diambil…";
      kameraTone = "bg-emerald-600 text-white font-black animate-pulse";
    } else if (faceState === "perfect") {
      kameraInfo = autoCapture
        ? "✨ Posisi pas! Tahan sebentar…"
        : "Posisi pas — silakan tekan tombol foto";
      kameraTone = "bg-emerald-600 text-white font-black";
    } else if (faceState === "too_far") {
      kameraInfo = "⚠️ Dekatkan wajah ke bingkai oval";
      kameraTone = "bg-amber-600/90 text-white font-bold";
    } else if (faceState === "too_close") {
      kameraInfo = "⚠️ Mundurkan sedikit wajah Anda";
      kameraTone = "bg-amber-600/90 text-white font-bold";
    } else if (faceState === "off_center") {
      kameraInfo = "⚠️ Arahkan wajah tepat ke tengah bingkai oval";
      kameraTone = "bg-amber-600/90 text-white font-bold";
    } else if (detectorState === "loading") {
      kameraInfo = "Menyiapkan sensor wajah…";
    } else if (detectorState === "unsupported") {
      kameraInfo = "Mode manual aktif — tekan tombol foto";
      kameraTone = "bg-amber-500/90 text-white";
    } else if (!autoCapture) {
      kameraInfo = "Foto otomatis nonaktif — tekan tombol foto";
    } else {
      kameraInfo = "Posisikan wajah tepat di dalam bingkai oval";
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-6">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-2 px-3 sm:px-6 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-white/10 p-1 rounded-lg border border-white/20 shrink-0">
              <Image
                src="/logo.png"
                alt="Logo"
                width={30}
                height={30}
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight leading-tight truncate">
                PRESENSI MAGANG
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300 leading-tight truncate">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => {
                cleanup();
                router.replace("/magang/dashboard_siswa");
              }}
              className="rounded-lg bg-blue-600/90 px-2.5 sm:px-4 py-1.5 text-[11px] sm:text-sm font-black text-white hover:brightness-110 active:scale-95 border border-blue-400/30 transition-all"
            >
              🏠 <span className="hidden xs:inline sm:inline">BERANDA</span>
            </button>
            <button
              onClick={async () => {
                if (!confirm("Keluar dari akun siswa?")) return;
                cleanup();
                await logoutSession();
                router.replace("/magang/login");
              }}
              className="rounded-lg bg-rose-600 px-2.5 sm:px-4 py-1.5 text-[11px] sm:text-sm font-black text-white hover:brightness-110 active:scale-95 border border-red-400/30 transition-all"
            >
              ⎋ <span className="hidden xs:inline sm:inline">KELUAR</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-3 sm:px-6 pt-3 space-y-3">
        {/* KARTU IDENTITAS RINGKAS & PADAT */}
        <section className="rounded-2xl bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-3 sm:p-4 text-white shadow-md border border-blue-800">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-black leading-tight">
                <NamaBadge rawName={user.nama} />
              </h2>
              <p className="mt-0.5 text-[11px] sm:text-xs text-blue-200 truncate">
                ID {user.id} · Pembimbing: {user.namaGuru}
              </p>
              <p className="text-[11px] sm:text-xs text-blue-200 truncate">
                📍 {user.tempatMagang}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg sm:text-2xl font-black text-amber-300 tabular-nums leading-none">
                {jam}
              </p>
              <p className="mt-1 text-[10px] sm:text-xs font-semibold text-blue-200 capitalize leading-tight">
                {hari}, {tanggal}
              </p>
            </div>
          </div>

          <div
            className={`mt-2.5 rounded-lg px-2.5 py-1.5 text-[11px] sm:text-xs font-bold ${
              hasPresensiToday
                ? "bg-emerald-400/20 text-emerald-200 border border-emerald-300/30"
                : "bg-rose-400/20 text-rose-200 border border-rose-300/30"
            }`}
          >
            {hasPresensiToday
              ? "✅ Anda sudah presensi hari ini — form boleh diisi lagi untuk kegiatan tambahan."
              : "🔴 Belum presensi hari ini."}
          </div>
        </section>

        {/* STATUS KEHADIRAN (PADAT) */}
        <section className="grid grid-cols-3 gap-2">
          {[
            {
              name: "Hadir",
              icon: "✅",
              on: "border-emerald-500 bg-emerald-50 text-emerald-700",
            },
            {
              name: "Izin",
              icon: "📝",
              on: "border-amber-500 bg-amber-50 text-amber-700",
            },
            {
              name: "Sakit",
              icon: "🤒",
              on: "border-blue-500 bg-blue-50 text-blue-700",
            },
          ].map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setStatus(item.name)}
              aria-pressed={status === item.name}
              className={`rounded-xl border-2 py-2 text-xs sm:text-sm font-black transition-all active:scale-95 ${
                status === item.name
                  ? item.on + " shadow-sm"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {item.icon} {item.name}
            </button>
          ))}
        </section>

        {/* STEPPER PROGRES */}
        <nav className="flex items-center gap-1" aria-label="Langkah presensi">
          {STEPS.map((s, i) => {
            const done =
              (s.id === 1 && fotoLengkap) ||
              (s.id === 2 && pembimbing.trim().length >= 2 && step > 2) ||
              (s.id === 3 && kompetensi.trim().length >= 3 && step > 3);
            const active = step === s.id;
            return (
              <div key={s.id} className="flex items-center flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => goStep(s.id)}
                  className={`flex w-full items-center justify-center gap-1 rounded-lg px-1 py-1.5 text-[10px] sm:text-xs font-black transition-all ${
                    active
                      ? "bg-blue-700 text-white shadow"
                      : done
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-white text-slate-400 border border-slate-200"
                  }`}
                >
                  <span>{done && !active ? "✔" : s.icon}</span>
                  <span className="truncate">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className="mx-0.5 text-slate-300 text-xs">›</span>
                )}
              </div>
            );
          })}
        </nav>

        {/* ISI UTAMA: kamera kiri, langkah kanan */}
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          {/* KAMERA + LOKASI */}
          <section
            className={`${
              step === 1 ? "" : "hidden md:block"
            } rounded-2xl bg-white p-3 shadow-sm border border-slate-100`}
          >
            <div className="relative overflow-hidden rounded-xl bg-slate-900 aspect-[3/4] sm:aspect-[4/3] w-full max-h-[54vh] md:max-h-none border border-slate-200">
              {/* Efek flash putih saat foto terambil */}
              {flashEffect && (
                <div className="absolute inset-0 z-30 bg-white pointer-events-none transition-opacity duration-200" />
              )}

              {!photo ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    controls={false}
                    disablePictureInPicture
                    className="h-full w-full object-cover -scale-x-100"
                  />

                  {cameraReady && (
                    <>
                      {/* Bingkai panduan wajah oval tengah */}
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div
                          className={`h-[74%] aspect-[3/4] rounded-[50%] border-4 transition-all duration-200 ${
                            faceState === "perfect" || faceState === "capturing"
                              ? "border-emerald-400 border-solid shadow-[0_0_24px_rgba(52,211,153,0.8)] bg-emerald-500/15"
                              : faceState === "too_far" ||
                                  faceState === "too_close" ||
                                  faceState === "off_center"
                                ? "border-amber-400 border-dashed shadow-[0_0_12px_rgba(251,191,36,0.5)]"
                                : "border-white/60 border-dashed"
                          }`}
                        />
                      </div>

                      {/* Notifikasi panduan kamera */}
                      <div
                        className={`pointer-events-none absolute left-2 right-2 bottom-2 rounded-lg px-2.5 py-1.5 text-center text-[11px] sm:text-xs font-bold backdrop-blur-sm transition-all ${kameraTone}`}
                      >
                        {kameraInfo}
                      </div>
                    </>
                  )}

                  {!cameraReady && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-800/95 p-4 text-center">
                      <div className="mb-2 text-3xl">📷</div>
                      {cameraError && (
                        <p className="mb-2 text-[11px] font-semibold text-amber-200">
                          {cameraError}
                        </p>
                      )}
                      <button
                        onClick={startCamera}
                        className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-black text-white shadow-lg hover:brightness-110 active:scale-95 transition-all"
                      >
                        {cameraError
                          ? "Coba Aktifkan Kamera"
                          : "Ketuk Untuk Aktifkan Kamera"}
                      </button>
                      {!cameraError && (
                        <p className="mt-2 text-[10px] font-semibold text-slate-300">
                          Menyalakan kamera depan…
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt="Hasil Selfie"
                  className="h-full w-full object-cover"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
              <canvas ref={watermarkCanvasRef} className="hidden" />
            </div>

            {/* Tombol kendali kamera */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                onClick={photo ? ambilUlang : () => doCapture(false)}
                disabled={!cameraReady && !photo}
                className={`flex-1 rounded-xl py-2.5 text-sm font-black text-white transition-all shadow active:scale-[0.97] ${
                  photo
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed"
                }`}
              >
                {photo ? "🔄 Ambil Ulang" : "📸 Foto Sekarang"}
              </button>

              {!photo && (
                <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-bold text-slate-600 select-none cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-blue-600"
                    checked={autoCapture}
                    onChange={(e) => {
                      setAutoCapture(e.target.checked);
                      try {
                        localStorage.setItem(
                          "magang_auto_capture",
                          e.target.checked ? "1" : "0",
                        );
                      } catch (_) {}
                    }}
                  />
                  Otomatis
                </label>
              )}
            </div>

            {/* Ringkasan status lokasi GPS */}
            <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  📡 Lokasi (GPS)
                </p>
                {photo && (gpsError || (!gpsOk && !gpsLoading)) && (
                  <button
                    onClick={() => fetchLocation(true)}
                    className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 active:scale-95"
                  >
                    ↻ Coba Lagi
                  </button>
                )}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <GpsMini label="Latitude" value={latitude} />
                <GpsMini label="Longitude" value={longitude} />
                <GpsMini
                  label="Akurasi"
                  value={gpsLoading && !gpsOk ? "Mencari satelit…" : accuracy}
                  warn={accBuruk}
                  loading={gpsLoading && !gpsOk}
                />
                <GpsMini
                  label="Status"
                  value={
                    gpsOk
                      ? "Terkunci ✔"
                      : gpsLoading
                        ? "Mengambil…"
                        : photo
                          ? "Belum ada"
                          : "Menunggu foto"
                  }
                  loading={gpsLoading && !gpsOk}
                  ok={gpsOk}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-semibold text-slate-600 line-clamp-2">
                🗺️{" "}
                {gpsLoading && alamat === "-"
                  ? "Mencari alamat…"
                  : alamat === "-"
                    ? "Alamat akan muncul setelah foto diambil"
                    : alamat}
              </p>
              {accBuruk && (
                <p className="mt-1 text-[10px] font-bold text-amber-600">
                  ⚠ Akurasi di atas 50 meter. Pindah ke tempat terbuka lalu
                  tekan “Ambil Ulang” bila perlu.
                </p>
              )}
            </div>
          </section>

          {/* PANEL LANGKAH-LANGKAH */}
          <section className="rounded-2xl bg-white p-3 sm:p-4 shadow-sm border border-slate-100">
            {step === 1 && (
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  📸 Langkah 1 — Foto & Lokasi
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {photo
                    ? gpsOk
                      ? "Foto dan lokasi sudah siap."
                      : gpsLoading
                        ? "Foto tersimpan, sedang mengunci lokasi…"
                        : "Foto tersimpan, tetapi lokasi belum didapat. Hidupkan GPS lalu tekan “Coba Lagi”."
                    : "Cukup hadapkan wajah ke kamera. Begitu wajah muncul, foto otomatis terambil tanpa hitungan mundur dan lokasi langsung dikunci."}
                </p>
                <button
                  onClick={() => goStep(2)}
                  disabled={!fotoLengkap}
                  className="mt-3 w-full rounded-xl bg-blue-700 py-2.5 text-sm font-black text-white shadow active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  Lanjut →
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  👤 Langkah 2 — Pembimbing Lapangan
                </h3>
                <label className="mt-2 block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Nama Pembimbing Lapangan (Instansi/DUDI)
                </label>
                <input
                  ref={inputRef}
                  list="listPembimbing"
                  value={pembimbing}
                  onChange={(e) => setPembimbing(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      nextFromPembimbing();
                    }
                  }}
                  enterKeyHint="next"
                  autoComplete="off"
                  placeholder="Nama staf pembimbing industri…"
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none transition-colors"
                />
                <datalist id="listPembimbing">
                  {recentPembimbing.map((item, index) => (
                    <option key={index} value={item} />
                  ))}
                </datalist>

                {recentPembimbing.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recentPembimbing.slice(0, 4).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setPembimbing(item);
                          nextFromPembimbing(item);
                        }}
                        className="max-w-full truncate rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 active:scale-95"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-600 active:scale-95"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => nextFromPembimbing()}
                    disabled={pembimbing.trim().length < 2}
                    className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-black text-white shadow active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Lanjut →
                  </button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  🛠️ Langkah 3 — Kompetensi Hari Ini
                </h3>
                <label className="mt-2 block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Materi / Kompetensi yang Dikerjakan
                </label>
                <textarea
                  ref={textRef}
                  rows={3}
                  value={kompetensi}
                  onChange={(e) => setKompetensi(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      nextFromKompetensi();
                    }
                  }}
                  enterKeyHint="next"
                  placeholder="Contoh: perbaikan jaringan LAN, konfigurasi router, perakitan PC, laporan keuangan…"
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                />
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  Tekan Enter untuk lanjut (Shift+Enter = baris baru).
                </p>

                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => setStep(2)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-black text-slate-600 active:scale-95"
                  >
                    ←
                  </button>
                  <button
                    onClick={nextFromKompetensi}
                    disabled={kompetensi.trim().length < 3}
                    className="flex-1 rounded-xl bg-blue-700 py-2.5 text-sm font-black text-white shadow active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed"
                  >
                    Lanjut →
                  </button>
                </div>
              </div>
            )}

            {step === 4 && (
              <div>
                <h3 className="text-sm font-black text-slate-800">
                  🚀 Langkah 4 — Periksa & Kirim
                </h3>

                <dl className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 text-xs">
                  <Ringkas label="Status" value={status} onEdit={null} />
                  <Ringkas
                    label="Foto & GPS"
                    value={fotoLengkap ? "Siap ✔" : "Belum lengkap"}
                    onEdit={() => setStep(1)}
                  />
                  <Ringkas
                    label="Pembimbing"
                    value={pembimbing}
                    onEdit={() => setStep(2)}
                  />
                  <Ringkas
                    label="Kompetensi"
                    value={kompetensi}
                    onEdit={() => setStep(3)}
                  />
                </dl>

                <label className="mt-2.5 block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Catatan Tambahan{" "}
                  <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <textarea
                  rows={2}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Alasan Izin/Sakit atau kendala di lapangan…"
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => setStep(3)}
                    className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-black text-slate-600 active:scale-95"
                  >
                    ←
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!fotoLengkap || saving}
                    className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-sm sm:text-base font-black text-white shadow-lg shadow-emerald-500/30 hover:brightness-110 active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed transition-all"
                  >
                    {saving
                      ? `🔄 Menyimpan… (${Math.round(saveProgress)}%)`
                      : "🚀 SIMPAN & KIRIM PRESENSI"}
                  </button>
                </div>
                {!fotoLengkap && !saving && (
                  <p className="mt-2 text-center text-[11px] font-bold text-rose-500">
                    Foto selfie dan koordinat GPS harus terkunci dulu (langkah
                    1).
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* OVERLAY PROGRES SIMPAN */}
      {saving && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs text-center bg-white p-5 rounded-3xl shadow-2xl border border-slate-100">
            <p className="mb-3 text-sm font-bold text-slate-700">
              {saveStatusText || "Menyimpan & Mengirim Presensi..."}
            </p>
            <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${saveProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-black text-slate-400">
              {Math.round(saveProgress)}%
            </p>
          </div>
        </div>
      )}

      {/* NOTIFIKASI TENGAH LAYAR */}
      {dialog && !saving && (
        <CenterDialog dialog={dialog} onClose={closeDialog} />
      )}
    </main>
  );
}

function CenterDialog({ dialog, onClose }) {
  const tone = {
    success: { icon: "✅", ring: "bg-emerald-100", title: "text-emerald-700" },
    error: { icon: "❌", ring: "bg-rose-100", title: "text-rose-700" },
    gps: { icon: "📍", ring: "bg-amber-100", title: "text-amber-700" },
    warn: { icon: "⚠️", ring: "bg-amber-100", title: "text-amber-700" },
  }[dialog.type] || { icon: "ℹ️", ring: "bg-blue-100", title: "text-blue-700" };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/60 p-5 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={dialog.type === "success" ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-5 text-center shadow-2xl border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${tone.ring} ${
            dialog.type === "success" ? "animate-bounce" : ""
          }`}
        >
          {tone.icon}
        </div>
        <h3 className={`mt-3 text-lg font-black ${tone.title}`}>
          {dialog.title}
        </h3>
        <p className="mt-1.5 text-sm font-semibold leading-relaxed text-slate-600">
          {dialog.message}
        </p>
        {dialog.type === "success" && (
          <p className="mt-2 text-[11px] font-bold text-slate-400">
            Otomatis menuju beranda…
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2">
          {(dialog.actions || []).map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`w-full rounded-xl py-2.5 text-sm font-black active:scale-[0.97] transition-all ${
                a.primary
                  ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Ringkas({ label, value, onEdit }) {
  return (
    <div className="flex items-start justify-between gap-2 px-2.5 py-1.5">
      <dt className="shrink-0 font-black uppercase tracking-wider text-[10px] text-slate-400 pt-0.5">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-right font-bold text-slate-800 break-words line-clamp-2">
        {value || "-"}
      </dd>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="shrink-0 text-[10px] font-black text-blue-600 underline"
        >
          ubah
        </button>
      )}
    </div>
  );
}

function GpsMini({ label, value, warn = false, loading = false, ok = false }) {
  const v = String(value);
  const kosong = v === "-" || loading;
  return (
    <div className="rounded-lg border border-slate-100 bg-white px-2 py-1">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 leading-none">
        {label}
      </p>
      <p
        className={`mt-0.5 truncate text-xs font-black ${
          warn
            ? "text-amber-600"
            : ok
              ? "text-emerald-600"
              : kosong
                ? "text-slate-400"
                : "text-blue-900"
        } ${loading ? "animate-pulse" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
