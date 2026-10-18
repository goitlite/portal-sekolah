"use client";

import { useState, useEffect, useRef } from "react";
import { uploadPhoto, updateBiodataSiswa, getBiodataSiswa, getWajahBulk } from "../lib/api";

import {
  loadFaceApi,
  checkFaceDuplicate,
  writeCachedDescriptor,
  headPose,
  updateHeadTurnTracker,
  headTurnStep,
  headTurnHint,
  MAX_CHALLENGE_YAW,
  MAX_YAW,
  MAX_ROLL_DEG,
  DUPLICATE_THRESHOLD,
  mapBoxToContainer,
} from "../lib/faceApiHelper";

// Ukuran hasil pas foto (3:4)
const OUT_W = 600;
const OUT_H = 800;

// Audio Feedback Singleton
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
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  } catch (_) {}
}

function playBeepWarning() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const t = audioCtx.currentTime;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(260, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.24);
  } catch (_) {}
}

function driveThumb(url) {
  if (!url) return "";
  let id = "";
  if (url.includes("/file/d/")) id = url.split("/file/d/")[1].split("/")[0];
  else if (url.includes("id=")) id = url.split("id=")[1].split("&")[0];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : url;
}

/**
 * Enriches each student in `students` array with their `fotoWajah` URL by
 * scanning all caches that ModalScanWajahPetugas writes:
 *   1. cached_face_urls_<idWali>  → bulk URL map from petugas sync
 *   2. face_reg_<idSiswa>         → individual siswa self-registered or wali-registered
 *
 * This is necessary because statistikKelas.daftarSiswa / availableClasses usually
 * carry no fotoWajah field — the URL is only stored separately by petugas or by
 * individual registration flow.  Without this step checkFaceDuplicate skips all
 * students (because !st.fotoWajah) and anti-duplication is effectively disabled.
 */
function enrichWithFotoWajah(students) {
  if (!Array.isArray(students) || students.length === 0) return students;

  // 1. Collect ALL cached_face_urls_<idWali> maps from localStorage in one pass
  const bulkMap = {}; // idSiswa → fotoWajah
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("cached_face_urls_")) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const map = JSON.parse(raw);
          if (map && typeof map === "object") {
            Object.assign(bulkMap, map);
          }
        }
      }
    }
  } catch (_) {}

  return students.map((s) => {
    if (s.fotoWajah) return s; // sudah ada, skip
    const sid = String(s.idSiswa || s.id || "").trim();
    if (!sid) return s;

    // 2a. Try bulk petugas cache
    let url = bulkMap[sid] || null;

    // 2b. Try individual face_reg_* (self-registered or wali)
    if (!url) {
      try {
        const raw = localStorage.getItem(`face_reg_${sid}`);
        if (raw) url = JSON.parse(raw)?.fotoWajah || null;
      } catch (_) {}
    }

    if (url && url !== "NO_PHOTO") {
      return { ...s, fotoWajah: url };
    }
    return s;
  });
}

export default function ModalDaftarWajahSementaraSiswa({

  isOpen,
  onClose,
  user,
  fotoLama,
  otherStudents = [],
  onFaceRegistered,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const stateRef = useRef({
    liveness: null,
    lastStep: -1,
    processing: false,
    alive: false,
  });

  // Ref untuk daftar siswa yang sudah diperkaya dengan fotoWajah dari server
  // (diisi saat modal dibuka via getWajahBulk, dipakai saat anti-duplikat)
  const enrichedStudentsRef = useRef([]);

  const [loadingAi, setLoadingAi] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraFacing, setCameraFacing] = useState("user");
  const [liveFaceBox, setLiveFaceBox] = useState(null);
  const [liveFaceStatus, setLiveFaceStatus] = useState("Menyiapkan kamera...");
  const [challengeStep, setChallengeStep] = useState(0); // 0: Hadap, 1: Toleh, 2: Lurus, 3: Verified
  const [zoneState, setZoneState] = useState("standby"); // standby | adjust | multiple | verifying | success | error

  // Status proses pengambilan & penyimpanan
  const [processingState, setProcessingState] = useState(null); // { step, label, error, duplicateInfo }
  const [registeredPhotoUrl, setRegisteredPhotoUrl] = useState(null);
  const [successComplete, setSuccessComplete] = useState(false);

  // ── Fetch fotoWajah semua siswa dari server via getWajahBulk saat modal dibuka ──
  // Ini kritis untuk anti-duplikat lintas-perangkat: setiap siswa pakai device berbeda
  // sehingga localStorage tidak bisa diandalkan untuk data siswa lain.
  useEffect(() => {
    if (!isOpen || !Array.isArray(otherStudents) || otherStudents.length === 0) return;
    let cancelled = false;

    (async () => {
      // 1. Perkaya dulu dari localStorage (cepat, offline-first)
      const localEnriched = enrichWithFotoWajah(otherStudents);
      if (!cancelled) enrichedStudentsRef.current = localEnriched;

      // 2. Fetch dari server untuk mendapat data terbaru (termasuk siswa di device lain)
      try {
        const ids = otherStudents
          .map((s) => String(s.idSiswa || s.id || "").trim())
          .filter(Boolean);
        if (ids.length === 0) return;

        const bulk = await getWajahBulk(ids);
        if (cancelled) return;

        if (bulk?.success && bulk.data && typeof bulk.data === "object") {
          // Merge: server sebagai sumber kebenaran, fallback ke localStorage
          const serverMap = bulk.data; // { idSiswa: fotoWajahUrl }
          const merged = localEnriched.map((s) => {
            const sid = String(s.idSiswa || s.id || "").trim();
            const serverUrl = serverMap[sid];
            if (serverUrl && serverUrl !== "NO_PHOTO") {
              return { ...s, fotoWajah: serverUrl };
            }
            return s;
          });
          enrichedStudentsRef.current = merged;
        }
      } catch (_) {
        // Jika server gagal, tetap gunakan data localStorage
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, otherStudents]);

  // Inisialisasi face-api & kamera

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setSuccessComplete(false);
      setProcessingState(null);
      setRegisteredPhotoUrl(null);
      setChallengeStep(0);
      setZoneState("standby");
      return;
    }

    let isCancelled = false;
    setLoadingAi(true);
    setLiveFaceStatus("⏳ Memuat model AI biometrik...");

    loadFaceApi()
      .then(() => {
        if (!isCancelled) {
          setLoadingAi(false);
          startCamera();
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setLoadingAi(false);
          setCameraError("Gagal memuat sistem pengenal wajah. Periksa koneksi internet Anda.");
          console.error("Gagal loadFaceApi:", err);
        }
      });

    return () => {
      isCancelled = true;
      stopCamera();
    };
  }, [isOpen, cameraFacing]);

  // Kontrol Kamera
  async function startCamera() {
    stopCamera();
    setCameraError("");
    setLiveFaceStatus("Memulai kamera...");

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Perangkat / browser tidak mendukung akses kamera.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: cameraFacing },
          width: { ideal: 720 },
          height: { ideal: 960 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current
            .play()
            .then(() => {
              setCameraActive(true);
              setLiveFaceStatus("Arahkan wajah ke dalam lingkaran...");
              startDetectionLoop();
            })
            .catch((err) => {
              console.warn("Gagal auto-play video:", err);
            });
        };
      }
    } catch (err) {
      console.error("Gagal membuka kamera:", err);
      setCameraError("Izin kamera ditolak atau kamera sedang digunakan aplikasi lain.");
    }
  }

  function stopCamera() {
    stateRef.current.alive = false;
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

  // Loop Deteksi & Tantangan 3 Tahap Liveness
  function startDetectionLoop() {
    const st = stateRef.current;
    st.liveness = null;
    st.lastStep = -1;
    st.processing = false;
    st.alive = true;

    let lastDetectAt = 0;
    const DETECT_INTERVAL = 90; // ~11 fps untuk efisiensi

    const loop = async (now) => {
      if (!st.alive) return;

      if (!st.processing && now - lastDetectAt >= DETECT_INTERVAL) {
        lastDetectAt = now;
        await processSingleFrame(now);
      }

      if (st.alive) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  }

  async function processSingleFrame(now) {
    const video = videoRef.current;
    const st = stateRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight || st.processing) {
      return;
    }

    try {
      const fa = await loadFaceApi();
      const dets = await fa
        .detectAllFaces(
          video,
          new fa.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }),
        )
        .withFaceLandmarks(true);

      if (!st.alive || st.processing) return;

      // 1. Validasi Jumlah Wajah
      if (dets.length === 0) {
        st.liveness = null;
        st.lastStep = -1;
        setChallengeStep(0);
        setLiveFaceBox(null);
        setZoneState("standby");
        setLiveFaceStatus("Arahkan wajah ke dalam zona pemindaian...");
        return;
      }

      if (dets.length > 1) {
        st.liveness = null;
        st.lastStep = -1;
        setChallengeStep(0);
        setLiveFaceBox(null);
        setZoneState("multiple");
        setLiveFaceStatus("⚠️ Hanya 1 orang di depan kamera");
        return;
      }

      // 2. Wajah Tunggal
      const main = dets[0];
      const box = main.detection.box;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

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

      const cxNorm = (box.x + box.width / 2) / vw;
      const cyNorm = (box.y + box.height / 2) / vh;
      const wRatio = box.width / vw;

      // Toleransi posisi zona wajah
      const inChallenge = !(st.liveness && st.liveness.isMotionVerified);
      const cxLo = inChallenge ? 0.2 : 0.28;
      const cxHi = inChallenge ? 0.8 : 0.72;
      const minRatio = inChallenge ? 0.14 : 0.18;

      if (cxNorm < cxLo || cxNorm > cxHi || cyNorm < 0.2 || cyNorm > 0.78) {
        setZoneState("adjust");
        setLiveFaceStatus("📍 Posisikan wajah tepat di tengah oval");
        return;
      }

      if (wRatio < minRatio) {
        setZoneState("adjust");
        setLiveFaceStatus("🔍 Dekatkan wajah sedikit ke kamera");
        return;
      }

      if (wRatio > 0.72) {
        setZoneState("adjust");
        setLiveFaceStatus("↔️ Mundurkan wajah sedikit");
        return;
      }

      // 3. Pose Kepala (Landmarks 68-pt)
      const pose = headPose(main.landmarks);
      const yawLimit = inChallenge ? MAX_CHALLENGE_YAW : MAX_YAW;

      if (Math.abs(pose.rollDeg) > MAX_ROLL_DEG) {
        setZoneState("adjust");
        setLiveFaceStatus("↔️ Jangan miringkan kepala: hadap tegak");
        return;
      }

      // 4. LIVENESS TRACKER 3 TAHAP (Hadap -> Toleh -> Lurus)
      st.liveness = updateHeadTurnTracker(st.liveness, pose.yaw, now);
      const live = st.liveness;
      const step = headTurnStep(live);

      if (step !== st.lastStep) {
        if (step > st.lastStep && step > 0 && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(35);
        }
        st.lastStep = step;
        setChallengeStep(step);
      }

      // Petunjuk teks stepper liveness
      const hint = headTurnHint(live);
      setLiveFaceStatus(hint);
      setZoneState(step >= 1 ? "verifying" : "adjust");

      // 5. TAHAP KE-3 SELESAI: Gerakan liveness terverifikasi nyata & kembali lurus!
      // Bedanya dengan scan presensi: Tahap ke-3 mengambil registrasi wajah (bukan presensi).
      if (live.isMotionVerified && Math.abs(pose.yaw) <= MAX_YAW) {
        st.processing = true;
        setZoneState("success");
        setLiveFaceStatus("✨ Gerakan nyata terverifikasi! Memproses registrasi...");
        if (navigator.vibrate) navigator.vibrate([40, 50, 40]);
        playBeepSuccess();

        // Eksekusi pengambilan foto, ekstraksi deskriptor, anti-duplikat & simpan
        await handleLivenessPassedAndRegister(video, main);
      }
    } catch (err) {
      console.warn("Error dalam frame processing:", err);
    }
  }

  // Tahap ke-3: Ambil Wajah, Anti-Duplikat, dan Daftarkan
  async function handleLivenessPassedAndRegister(video, detection) {
    try {
      setProcessingState({
        step: "capture",
        label: "Mengambil pas foto wajah berkualitas tinggi...",
        error: false,
      });

      // 1. Potong Frame Wajah (3:4 Pas Foto)
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const guideW = Math.min(vw, Math.round(vh * 0.75));
      const guideH = Math.min(vh, Math.round(guideW * (4 / 3)));
      const gx = Math.round((vw - guideW) / 2);
      const gy = Math.round((vh - guideH) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";

      // Foto referensi tidak dicerminkan (orientasi asli identitas)
      ctx.drawImage(video, gx, gy, guideW, guideH, 0, 0, OUT_W, OUT_H);
      const base64Photo = canvas.toDataURL("image/jpeg", 0.92);

      // 2. Analisis Biometrik 128-d (Face Recognition Descriptor)
      setProcessingState({
        step: "biometrics",
        label: "Mengekstrak biometrik wajah 128-d...",
        error: false,
      });

      const fa = await loadFaceApi();
      const [faceCrop] = await fa.extractFaces(video, [detection.landmarks.align()]);
      const descriptor = await fa.nets.faceRecognitionNet.computeFaceDescriptor(faceCrop);

      if (!descriptor || descriptor.length !== 128) {
        throw new Error("Gagal mengekstrak fitur biometrik wajah. Pastikan pencahayaan cukup.");
      }

      // 3. FITUR ANTI-DUPLIKAT (Pengecekan ke seluruh siswa sekolah)
      setProcessingState({
        step: "anti_duplicate",
        label: "Memeriksa keunikan wajah (Anti-Duplikasi)...",
        error: false,
      });

      // Gunakan enrichedStudentsRef.current yang telah di-fetch dari server via getWajahBulk
      // saat modal dibuka. Ini memastikan deteksi duplikat bekerja lintas-perangkat
      // (siswa 568045 daftar di HP-A, lalu siswa 568047 coba daftar wajah sama di HP-B → terdeteksi)
      // Fallback: jika server belum selesai fetch, pakai localStorage enrichment
      const studentsForDupCheck =
        enrichedStudentsRef.current.length > 0
          ? enrichedStudentsRef.current
          : enrichWithFotoWajah(otherStudents);

      const dupCheck = await checkFaceDuplicate({
        currentStudentId: user.id,
        descriptor,
        otherStudents: studentsForDupCheck,
        threshold: DUPLICATE_THRESHOLD, // 0.45 (batas identik stabil)
      });

      if (dupCheck.isDuplicate) {
        playBeepWarning();
        setZoneState("error");
        setProcessingState({
          step: "duplicate_error",
          label: "Pendaftaran Ditolak: Wajah Mirip dengan Siswa Lain",
          error: true,
          duplicateInfo: {
            name: dupCheck.matchedName || "Siswa Lain",
            id: dupCheck.matchedId,
          },
        });
        return;
      }

      // 4. Unggah Foto ke Server (Google Drive / Apps Script)
      setProcessingState({
        step: "uploading",
        label: "Mengunggah foto wajah ke server...",
        error: false,
      });

      const fileName = `wajah_sementara_${user.id}_${Date.now()}.jpg`;
      const uploadRes = await uploadPhoto(base64Photo, fileName, "image/jpeg");
      if (!uploadRes?.success || !uploadRes.data?.url) {
        throw new Error(uploadRes?.message || "Gagal mengunggah foto wajah ke server.");
      }
      const photoUrl = uploadRes.data.url;

      // 5. Simpan ke Biodata Siswa di Spreadsheet
      setProcessingState({
        step: "saving",
        label: "Mendaftarkan wajah sementara ke database...",
        error: false,
      });

      const updateRes = await updateBiodataSiswa({
        idSiswa: user.id,
        fotoWajah: photoUrl,
      });

      if (!updateRes?.success) {
        throw new Error(updateRes?.message || "Gagal memperbarui foto wajah di database.");
      }

      // 6. Simpan Template Deskriptor & Penanda Sementara di LocalStorage
      try {
        writeCachedDescriptor(user.id, photoUrl, Array.from(descriptor));
      } catch (_) {}

      try {
        const regInfo = {
          idSiswa: user.id,
          nama: user.nama,
          fotoWajah: photoUrl,
          source: "mandiri_sementara",
          registeredAt: new Date().toISOString(),
          registeredDate: new Date().toLocaleDateString("id-ID"),
        };
        localStorage.setItem(`face_reg_${user.id}`, JSON.stringify(regInfo));
        localStorage.setItem(`face_reg_source_${user.id}`, JSON.stringify(regInfo));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("portal_face_sync"));
        }
      } catch (_) {}

      // Berhasil Sempurna
      setRegisteredPhotoUrl(photoUrl);
      setSuccessComplete(true);
      setProcessingState(null);
      stopCamera();
      playBeepSuccess();

      if (onFaceRegistered) {
        onFaceRegistered(photoUrl);
      }
    } catch (err) {
      console.error("Gagal proses registrasi wajah:", err);
      playBeepWarning();
      setZoneState("error");
      setProcessingState({
        step: "error",
        label: err?.message || "Gagal menyelesaikan pendaftaran wajah.",
        error: true,
      });
    }
  }

  // Tombol Coba Lagi (jika terjadi error / duplikat)
  function handleRetry() {
    setProcessingState(null);
    setZoneState("standby");
    setChallengeStep(0);
    const st = stateRef.current;
    st.liveness = null;
    st.lastStep = -1;
    st.processing = false;
    startCamera();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-teal-100 overflow-hidden flex flex-col max-h-[95vh]">
        {/* HEADER MODAL */}
        <div className="px-4 py-3 bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-400/20 border border-teal-300/30 flex items-center justify-center text-base">
              🧏
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black tracking-tight">
                Daftar Presensi Wajah Sementara
              </h3>
              <p className="text-[10px] text-teal-200">
                Verifikasi 3 Tahap • Anti-Duplikat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* BODY MODAL */}
        <div className="p-4 overflow-y-auto space-y-3.5 flex-1 flex flex-col justify-between">
          {/* JIKA SUKSES TERDAFTAR */}
          {successComplete && registeredPhotoUrl ? (
            <div className="py-4 flex flex-col items-center text-center space-y-3.5 animate-fadeIn">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={driveThumb(registeredPhotoUrl)}
                  alt="Wajah Terdaftar Sementara"
                  className="w-24 h-32 rounded-2xl object-cover border-4 border-emerald-500 shadow-xl bg-slate-100"
                />
                <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-base border-2 border-white shadow-md">
                  ✓
                </span>
              </div>

              <div className="space-y-1">
                <span className="inline-block px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
                  🎉 Registrasi Sementara Berhasil!
                </span>
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  {user?.nama || "Siswa"}
                </h4>
                <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                  Wajah Anda telah berhasil terdaftar dan siap digunakan untuk scan presensi wajah harian di kelas.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-950 text-left leading-relaxed space-y-1">
                <p className="font-bold flex items-center gap-1 text-amber-900">
                  <span>ℹ️</span> <span>Catatan Prioritas Wali Kelas:</span>
                </p>
                <p>
                  Jika nantinya Bapak/Ibu Wali Kelas melakukan registrasi resmi di kelas, data sementara ini akan otomatis digantikan sepenuhnya oleh data resmi Wali Kelas.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:brightness-110 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                Selesai & Tutup
              </button>
            </div>
          ) : processingState?.step === "duplicate_error" ? (
            /* JIKA TERDETEKSI DUPLIKAT */
            <div className="py-4 flex flex-col items-center text-center space-y-3.5 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-rose-100 border border-rose-300 text-rose-600 flex items-center justify-center text-3xl shadow-sm">
                ⛔
              </div>
              <div className="space-y-1">
                <span className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-800 font-black text-xs">
                  Registrasi Wajah Ditolak (Anti-Duplikasi)
                </span>
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  Wajah Terdeteksi Sudah Terdaftar
                </h4>
                <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                  Fitur biometrik wajah Anda terdeteksi mirip/identik dengan:
                </p>
                <p className="text-sm font-black text-rose-700 bg-rose-50 py-1.5 px-3 rounded-xl border border-rose-200">
                  👤 {processingState.duplicateInfo?.name}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs pt-1">
                  Satu wajah tidak dapat digunakan untuk mendaftar akun siswa yang berbeda. Pastikan siswa yang bersangkutan mendaftar dengan wajah aslinya.
                </p>
              </div>

              <div className="w-full flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  🔄 Coba Lagi
                </button>
              </div>
            </div>
          ) : processingState?.error ? (
            /* JIKA TERJADI ERROR LAIN */
            <div className="py-4 flex flex-col items-center text-center space-y-3.5 animate-fadeIn">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center text-3xl shadow-sm">
                ⚠️
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  Pendaftaran Wajah Gagal
                </h4>
                <p className="text-xs text-slate-600 max-w-xs leading-relaxed">
                  {processingState.label}
                </p>
              </div>
              <div className="w-full flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex-1 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                >
                  🔄 Ulangi Pendaftaran
                </button>
              </div>
            </div>
          ) : (
            /* AREA KAMERA & STEPPER 3 TAHAP LIVENESS */
            <div className="space-y-3 flex flex-col">
              {/* STEPPER 3 TAHAP (Kapsul Indikator Gerakan Nyata) */}
              <div className="bg-slate-900 text-white p-2.5 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-wider text-teal-400">
                  Gerakan Nyata:
                </div>
                <div className="flex items-center gap-1.5">
                  {[
                    { step: 0, num: "1", label: "Hadap" },
                    { step: 1, num: "2", label: "Toleh" },
                    { step: 2, num: "3", label: "Lurus" },
                  ].map((item) => {
                    const isDone = challengeStep > item.step;
                    const isActive = challengeStep === item.step;
                    return (
                      <div
                        key={item.label}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold transition-all ${
                          isDone
                            ? "bg-emerald-600 text-white shadow-xs"
                            : isActive
                              ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300 animate-pulse"
                              : "bg-slate-800 text-slate-400 opacity-60"
                        }`}
                      >
                        <span>{isDone ? "✓" : item.num}</span>
                        <span>{item.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* VIEWPORT KAMERA & OVERLAY RETICLE */}
              <div className="relative w-full aspect-[3/4] max-h-[380px] bg-slate-950 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                {/* Video Kamera Feed */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className={`w-full h-full object-cover ${
                    cameraFacing === "user" ? "scale-x-[-1]" : ""
                  }`}
                />

                {/* Oval Panduan Wajah */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div
                    className={`w-[78%] h-[84%] rounded-[50%/60%] border-2 transition-all duration-300 flex items-center justify-center ${
                      zoneState === "success"
                        ? "border-emerald-400 bg-emerald-500/10 shadow-[0_0_25px_rgba(52,211,153,0.5)]"
                        : zoneState === "verifying"
                          ? "border-amber-400 bg-amber-500/5 shadow-[0_0_15px_rgba(251,191,36,0.4)]"
                          : zoneState === "multiple"
                            ? "border-rose-500 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                            : "border-teal-300/60 shadow-sm"
                    }`}
                  >
                    {/* Reticle Garis Fokus */}
                    <div className="w-8 h-8 border-t border-b border-white/40 opacity-40" />
                  </div>
                </div>

                {/* Kotak Tracking Wajah Aktif */}
                {liveFaceBox && (
                  <div
                    className="absolute border border-teal-400/80 rounded-xl transition-all duration-75 pointer-events-none"
                    style={{
                      left: `${liveFaceBox.leftPct}%`,
                      top: `${liveFaceBox.topPct}%`,
                      width: `${liveFaceBox.widthPct}%`,
                      height: `${liveFaceBox.heightPct}%`,
                    }}
                  />
                )}

                {/* Banner Status Deteksi di Bawah Kamera */}
                <div className="absolute bottom-2 inset-x-2 text-center pointer-events-none">
                  <span className="inline-block px-3 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md text-white text-[11px] font-bold border border-white/10 shadow-lg">
                    {liveFaceStatus}
                  </span>
                </div>

                {/* Tombol Balik Kamera */}
                <button
                  type="button"
                  onClick={() =>
                    setCameraFacing((p) => (p === "user" ? "environment" : "user"))
                  }
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-slate-950/70 hover:bg-slate-900 text-white flex items-center justify-center text-xs shadow-md border border-white/20 transition-all cursor-pointer active:scale-95"
                  title="Balik Kamera"
                >
                  🔄
                </button>

                {/* Loading / Error Overlay */}
                {loadingAi && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-white text-xs gap-2 p-4 text-center">
                    <div className="w-7 h-7 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <span>Menyiapkan Model AI Biometrik...</span>
                  </div>
                )}

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center text-white text-xs gap-2 p-4 text-center">
                    <span className="text-2xl">📷</span>
                    <span className="font-bold text-rose-300">{cameraError}</span>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="mt-2 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px]"
                    >
                      Coba Lagi
                    </button>
                  </div>
                )}

                {/* Processing Overlay Saat Tahap 3 Lolos */}
                {processingState && !processingState.error && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center text-white text-xs gap-3 p-4 text-center animate-fadeIn">
                    <div className="w-10 h-10 border-3 border-teal-400 border-t-transparent rounded-full animate-spin" />
                    <div className="space-y-1">
                      <p className="font-black text-sm text-teal-300">
                        {processingState.label}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Memeriksa anti-duplikasi & mengamankan data biometrik
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* PANDUAN RINGKAS SISWA */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <span>💡</span> <span>Cara Mendaftar (3 Tahap Gerakan):</span>
                </div>
                <p className="leading-snug">
                  1. <strong>Hadap Lurus:</strong> Posisikan wajah Anda di tengah lingkaran.
                </p>
                <p className="leading-snug">
                  2. <strong>Toleh Kepala:</strong> Tolehkan kepala sedikit ke kiri atau kanan.
                </p>
                <p className="leading-snug">
                  3. <strong>Kembali Lurus:</strong> Hadapkan kembali wajah lurus ke kamera.
                </p>
                <p className="text-[10px] text-teal-800 font-semibold pt-0.5">
                  🛡️ Pendaftaran wajib menggunakan gerakan langsung (tidak bisa menggunakan foto). Sistem dilengkapi fitur Anti-Duplikat identitas.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

