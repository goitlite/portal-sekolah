"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import QRCode from "qrcode";

import { saveMonitoring } from "../../lib/api";
import { getSession, isLoggedIn } from "../../lib/auth";

/* =====================================================================
   MONITORING MAGANG (GURU PEMBIMBING) — Model Responsif Mobile & Stepper
   Alur: 1 Foto Lingkungan & GPS → 2 Kondisi Siswa → 3 Laporan → 4 Kirim
   ===================================================================== */

const STEPS = [
  { id: 1, label: "Foto & GPS", icon: "📸" },
  { id: 2, label: "Kondisi", icon: "👨‍🏫" },
  { id: 3, label: "Laporan", icon: "📝" },
  { id: 4, label: "Kirim", icon: "🚀" },
];

export default function MonitoringPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const [status, setStatus] = useState("BERSAMA SISWA");
  const [keterangan, setKeterangan] = useState("");
  const [step, setStep] = useState(1);

  const [photo, setPhoto] = useState("");
  const [photoSuccess, setPhotoSuccess] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");

  // Panduan Landscape (dipertahankan penuh)
  const [showLandscapeGuide, setShowLandscapeGuide] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);

  // GPS Lokasi
  const [latitude, setLatitude] = useState("-");
  const [longitude, setLongitude] = useState("-");
  const [alamat, setAlamat] = useState("-");
  const [accuracy, setAccuracy] = useState("-");
  const [gpsSuccess, setGpsSuccess] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  // Progress Bar Simpan
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveStatusText, setSaveStatusText] = useState("");

  // Dialog Notifikasi
  const [dialog, setDialog] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const textRef = useRef(null);
  const redirectTimerRef = useRef(null);
  const gpsRunRef = useRef(0);
  const submittingRef = useRef(false);

  const [tempatMagang, setTempatMagang] = useState("");

  // Jam berjalan
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Deteksi Orientasi Layar Otomatis
  useEffect(() => {
    function handleOrientation() {
      setIsLandscape(window.innerWidth > window.innerHeight);
    }
    handleOrientation();
    window.addEventListener("resize", handleOrientation);
    window.addEventListener("orientationchange", handleOrientation);
    return () => {
      window.removeEventListener("resize", handleOrientation);
      window.removeEventListener("orientationchange", handleOrientation);
    };
  }, []);

  function handleLandscapeClick() {
    setShowLandscapeGuide(true);
  }

  // Dialog Helper
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

  // Fungsi Back dengan Stop Kamera
  function handleBack() {
    stopStream();
    router.replace("/magang/guru");
  }

  function stopStream() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }

  // Akses Kamera Belakang (Environment)
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Browser memblokir kamera. Pastikan akses web ini menggunakan HTTPS."
      );
      return;
    }

    stopStream();
    setCameraReady(false);
    setCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      attachStream(stream);
    } catch (err) {
      console.warn("Kamera belakang HD gagal diakses, mencoba mode dasar...", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        attachStream(fallbackStream);
      } catch (fallbackErr) {
        console.error("Semua percobaan akses kamera gagal:", fallbackErr);
        setCameraError(
          "Akses kamera ditolak. Pastikan izin kamera telah diberikan di pengaturan browser HP."
        );
      }
    }
  }

  function attachStream(stream) {
    streamRef.current = stream;
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;

    videoRef.current.onloadedmetadata = async () => {
      try {
        await videoRef.current.play();
        setCameraReady(true);
      } catch (e) {
        console.error("Gagal autoplay video:", e);
        setCameraError("Gagal memulai video kamera. Ketuk coba lagi.");
      }
    };
  }

  // Tambah Watermark
  async function addWatermark(imageData) {
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

        const t = new Date();
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

        const boxX = 20;
        const boxY = img.height - 250;
        const boxW = img.width - 40;
        const boxH = 230;

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.fillStyle = "#FFFFFF";

        const titleX = boxX + 20;
        let titleY = boxY + 35;

        ctx.font = "bold 24px Arial";
        ctx.fillText("SMKN 1 TELUK KUANTAN", titleX, titleY);

        titleY += 30;
        ctx.font = "bold 20px Arial";
        ctx.fillText("PRESENSI MONITORING MAGANG", titleX, titleY);

        titleY += 18;

        const col1 = boxX + 20;
        const col2 = boxX + 330;
        const startY = boxY + 95;

        ctx.font = "18px Arial";
        ctx.fillText("Guru : " + user.nama, col1, startY);
        ctx.fillText("Tempat : " + tempatMagang, col1, startY + 30);
        ctx.fillText("Status : " + status, col1, startY + 60);

        ctx.fillText("Hari : " + hari, col2, startY);
        ctx.fillText("Tanggal : " + tanggal, col2, startY + 30);
        ctx.fillText("Jam : " + jam + " WIB", col2, startY + 60);

        ctx.fillText(
          "Koordinat : " + latitude + ", " + longitude,
          col1,
          startY + 90,
        );

        const limit = 60;
        const textAlamat =
          alamat.length > limit ? alamat.substring(0, limit) + "..." : alamat;
        ctx.fillText("Lokasi : " + textAlamat, col1, startY + 120);

        const qrX = boxX + boxW - 165;
        const qrY = boxY + 20;
        const qrData = `https://maps.google.com/?q=${latitude},${longitude}`;

        const finish = () => {
          const watermarkedImage = canvas.toDataURL("image/jpeg", 0.7);
          resolve(watermarkedImage);
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

  // Fungsi Ambil / Ulang Foto
  async function capturePhoto() {
    if (photo) {
      setPhoto("");
      setPhotoSuccess(false);
      setLatitude("-");
      setLongitude("-");
      setAlamat("-");
      setAccuracy("-");
      setGpsSuccess(false);
      setGpsLoading(false);
      setStep(1);
      await startCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      warn("Kamera masih mempersiapkan gambar. Tunggu sebentar.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/jpeg", 0.7);
    setPhoto(image);
    setPhotoSuccess(true);

    stopStream();
    setCameraReady(false);

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch (_) {}
    }

    // Ambil GPS dan otomatis lanjut langkah jika lokasi terkunci
    getLocation(true);
  }

  // Fungsi GPS
  function getLocation(autoNext = false) {
    if (!navigator.geolocation) {
      warn("Fitur GPS tidak didukung di browser ini.");
      return;
    }

    const run = ++gpsRunRef.current;
    setGpsLoading(true);
    setAlamat("Mencari alamat lokasi...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (run !== gpsRunRef.current) return;
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);
        setAccuracy(Math.round(pos.coords.accuracy) + " meter");
        setGpsSuccess(true);
        setGpsLoading(false);

        if (autoNext) {
          setStep((s) => (s === 1 ? 2 : s));
        }

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
          );
          const data = await res.json();
          if (run === gpsRunRef.current) {
            setAlamat(data && data.display_name ? data.display_name : "Detail alamat tidak ditemukan");
          }
        } catch (err) {
          if (run === gpsRunRef.current) {
            setAlamat("Alamat tidak termuat (koordinat GPS tetap tersimpan)");
          }
        }
      },
      (err) => {
        if (run !== gpsRunRef.current) return;
        setGpsLoading(false);
        setAlamat("-");
        warn(
          "Lokasi GPS tidak dapat diperoleh. Pastikan Lokasi HP aktif dan izin lokasi browser diizinkan."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 3000,
      }
    );
  }

  // Navigasi Langkah
  const gpsOk = latitude !== "-";
  const fotoLengkap = !!photo && gpsOk;

  function goStep(n) {
    if (n > 1 && !fotoLengkap) {
      warn(!photo ? "Ambil foto lingkungan terlebih dahulu." : "Lokasi GPS belum didapatkan.");
      return;
    }
    if (n > 2 && !status) {
      setStep(2);
      return;
    }
    if (n > 3 && keterangan.trim().length < 3) {
      setStep(3);
      warn("Isi catatan / temuan monitoring terlebih dahulu.");
      return;
    }
    setStep(n);
  }

  function nextFromKondisi() {
    setStep(3);
  }

  function nextFromKeterangan() {
    if (keterangan.trim().length < 3) {
      warn("Jelaskan temuan kondisi siswa di lapangan terlebih dahulu.");
      return;
    }
    setStep(4);
  }

  // Fokus otomatis ke textarea saat step 3 aktif
  useEffect(() => {
    if (step === 3) {
      const t = setTimeout(() => {
        if (textRef.current) textRef.current.focus({ preventScroll: false });
      }, 180);
      return () => clearTimeout(t);
    }
  }, [step]);

  // Simpan Monitoring dengan Animasi Progress Bar
  async function handleSaveMonitoring() {
    if (submittingRef.current) return;

    if (!photo) {
      setStep(1);
      warn("Silakan ambil foto monitoring terlebih dahulu.");
      return;
    }
    if (latitude === "-") {
      setStep(1);
      warn("Lokasi GPS belum diperoleh. Pastikan titik koordinat sudah terkunci.");
      return;
    }
    if (keterangan.trim().length < 3) {
      setStep(3);
      warn("Keterangan monitoring wajib diisi.");
      return;
    }

    submittingRef.current = true;
    let progressTimer = null;

    try {
      setSaving(true);
      setSaveProgress(15);
      setSaveStatusText("Menyiapkan foto & lokasi...");

      // Proses watermark lokal di browser
      const photoWithWatermark = await addWatermark(photo);
      setSaveProgress(40);
      setSaveStatusText("Memproses watermark & barcode...");

      progressTimer = setInterval(() => {
        setSaveProgress((prev) =>
          prev < 90 ? prev + Math.floor(Math.random() * 4 + 2) : prev
        );
      }, 300);

      setSaveStatusText("Mengirim data monitoring ke server...");
      setSaveProgress((prev) => Math.max(prev, 60));

      const result = await saveMonitoring({
        idGuru: user.id,
        namaGuru: user.nama,
        tempatMagang: tempatMagang,
        base64Photo: photoWithWatermark,
        latitude: latitude,
        longitude: longitude,
        mapUrl: "https://www.google.com/maps?q=" + latitude + "," + longitude,
        status: status,
        keterangan: keterangan,
      });

      if (progressTimer) clearInterval(progressTimer);

      if (result && result.success) {
        setSaveProgress(100);
        setSaveStatusText("Data monitoring berhasil terkirim!");
        await new Promise((res) => setTimeout(res, 350));

        stopStream();

        const goHome = () => {
          if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
          router.replace("/magang/guru");
        };

        showDialog({
          type: "success",
          title: "Monitoring Berhasil Disimpan",
          message: `Data monitoring di ${tempatMagang} telah tersimpan dan diverifikasi.`,
          actions: [
            { label: "Ke Beranda Sekarang", primary: true, onClick: goHome },
          ],
        });

        redirectTimerRef.current = setTimeout(goHome, 3500);
      } else {
        showDialog({
          type: "error",
          title: "Gagal Menyimpan Monitoring",
          message: (result && result.message) || "Server menolak permintaan. Silakan coba lagi.",
          actions: [{ label: "Tutup", primary: true, onClick: closeDialog }],
        });
      }
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      console.error(err);
      showDialog({
        type: "error",
        title: "Terjadi Kesalahan",
        message: "Data monitoring gagal dikirim. Periksa koneksi internet Anda lalu coba kirim lagi.",
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

  // Lifecycle Session
  useEffect(() => {
    async function init() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }
      const session = getSession();
      if (!session || session.role !== "guru") {
        router.replace("/magang/login");
        return;
      }
      setUser(session);

      const tempat = localStorage.getItem("tempatMagangMonitoring");
      if (!tempat) {
        alert("Silakan pilih tempat magang terlebih dahulu.");
        router.replace("/magang/guru");
        return;
      }
      setTempatMagang(tempat);
      setLoading(false);
    }
    init();
  }, [router]);

  // Nyalakan kamera otomatis saat pertama kali dibuka jika belum ada foto
  useEffect(() => {
    if (loading || !user) return;
    const t = setTimeout(() => {
      if (!photo) startCamera();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  useEffect(() => {
    return () => {
      gpsRunRef.current += 1;
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
      stopStream();
    };
  }, []);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-700 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-3 text-sm font-bold text-slate-600 tracking-wide">
            Menyiapkan Modul Monitoring...
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

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="bg-white/10 p-1 sm:p-1.5 rounded-xl border border-white/20 backdrop-blur-sm shadow-inner">
              <Image
                src="/logo.png"
                alt="Logo"
                width={32}
                height={32}
                className="object-contain sm:w-9 sm:h-9"
              />
            </div>
            <div>
              <h1 className="text-xs sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                MONITORING PKL
              </h1>
              <p className="text-[9px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <button
            onClick={handleBack}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-black text-white hover:brightness-110 active:scale-95 shadow-md border border-blue-500/30 transition-all flex items-center gap-1"
          >
            🔙 <span className="hidden xs:inline sm:inline">KEMBALI</span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-3 sm:px-6 pt-3 space-y-3">
        {/* KARTU IDENTITAS GURU — PADAT & ELEGAN */}
        <section className="rounded-2xl bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-3.5 sm:p-4 text-white shadow-md border border-blue-800 relative overflow-hidden">
          <div className="pointer-events-none absolute -top-10 -right-10 h-36 w-36 rounded-full bg-blue-500/20 blur-2xl" />
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] sm:text-[10px] font-black uppercase tracking-wider mb-1 border border-amber-400/30">
                🔍 Monitoring Lapangan
              </span>
              <h2 className="text-base sm:text-lg font-black leading-tight text-white truncate">
                {user.nama}
              </h2>
              <p className="mt-0.5 text-[11px] sm:text-xs text-blue-200 truncate">
                ID Guru: <span className="font-bold text-white">{user.id}</span>
              </p>
              <p className="text-[11px] sm:text-xs text-amber-200 font-extrabold truncate flex items-center gap-1 mt-0.5">
                <span>📍</span>
                <span className="truncate">{tempatMagang}</span>
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
        </section>

        {/* STEPPER PROGRES */}
        <nav className="flex items-center gap-1" aria-label="Langkah monitoring">
          {STEPS.map((s, i) => {
            const done =
              (s.id === 1 && fotoLengkap) ||
              (s.id === 2 && step > 2) ||
              (s.id === 3 && keterangan.trim().length >= 3 && step > 3);
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
                  <span className="mx-0.5 text-slate-300 text-xs select-none">›</span>
                )}
              </div>
            );
          })}
        </nav>

        {/* ISI UTAMA: kamera kiri, langkah kanan */}
        <div className="grid gap-3 md:grid-cols-2 md:items-start">
          {/* KOLOM KIRI: KAMERA + PANDUAN + STATUS GPS */}
          <section
            className={`${
              step === 1 ? "" : "hidden md:block"
            } rounded-2xl bg-white p-3 shadow-sm border border-slate-100`}
          >
            {/* AREA VIDEO / FOTO */}
            <div className="relative overflow-hidden rounded-xl bg-slate-900 aspect-video w-full border border-slate-200 shadow-inner">
              {!photo ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    controls={false}
                    className="h-full w-full object-cover"
                  />
                  {!cameraReady && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-800/95 p-3 text-center">
                      <div className="mb-2 text-2xl sm:text-3xl">📷</div>
                      {cameraError ? (
                        <p className="mb-2 text-[11px] font-semibold text-amber-200 max-w-xs">
                          {cameraError}
                        </p>
                      ) : (
                        <p className="mb-2 text-[11px] font-semibold text-slate-300">
                          Kamera belakang siap diaktifkan
                        </p>
                      )}
                      <button
                        onClick={startCamera}
                        className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-xs sm:text-sm font-black text-white shadow-lg active:scale-95 transition-all"
                      >
                        {cameraError ? "Coba Aktifkan Kamera" : "Aktifkan Kamera"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo}
                  alt="Hasil Foto Monitoring"
                  className="h-full w-full object-cover"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
              <canvas ref={watermarkCanvasRef} className="hidden" />
            </div>

            {/* KONTROL KAMERA */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady && !photo}
                className={`flex-1 rounded-xl py-2.5 text-xs sm:text-sm font-black text-white transition-all shadow active:scale-[0.97] flex items-center justify-center gap-1.5 ${
                  photo
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110"
                    : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed"
                }`}
              >
                <span>{photo ? "🔄" : "📸"}</span>
                <span>{photo ? "Ambil Ulang Foto" : "Ambil Foto & GPS"}</span>
              </button>

              <button
                type="button"
                onClick={handleLandscapeClick}
                title="Panduan Mode Landscape"
                className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 hover:bg-blue-100 active:scale-95 transition-all shrink-0 flex items-center gap-1"
              >
                <span>🔄</span>
                <span className="hidden xs:inline">Landscape</span>
              </button>
            </div>

            {/* RINGKASAN STATUS LOKASI GPS */}
            <div className="mt-2.5 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  📡 Status Lokasi GPS
                </p>
                {photo && (latitude === "-" || gpsLoading) && (
                  <button
                    type="button"
                    onClick={() => getLocation(true)}
                    className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 active:scale-95"
                  >
                    ↻ Ambil GPS
                  </button>
                )}
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <GpsMini label="Latitude" value={latitude} />
                <GpsMini label="Longitude" value={longitude} />
                <GpsMini
                  label="Akurasi"
                  value={gpsLoading && !gpsOk ? "Mengunci Satelit…" : accuracy}
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
                    ? "Alamat akan muncul setelah foto & GPS diambil"
                    : alamat}
              </p>
              {accBuruk && (
                <p className="mt-1 text-[10px] font-bold text-amber-600">
                  ⚠ Akurasi di atas 50 meter. Pindah ke tempat terbuka lalu ambil ulang bila perlu.
                </p>
              )}
            </div>
          </section>

          {/* KOLOM KANAN: PANEL LANGKAH-LANGKAH BERTAHAP */}
          <section className="rounded-2xl bg-white p-3 sm:p-4 shadow-sm border border-slate-100">
            {/* LANGKAH 1 */}
            {step === 1 && (
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>📸</span>
                  <span>Langkah 1 — Foto Lingkungan & GPS</span>
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500 leading-relaxed">
                  {photo
                    ? gpsOk
                      ? "Foto dan koordinat GPS sudah siap."
                      : gpsLoading
                        ? "Foto tersimpan, sedang mengunci lokasi GPS..."
                        : "Foto tersimpan, namun titik GPS belum didapatkan. Tekan 'Ambil GPS'."
                    : "Arahkan kamera ke area lingkungan kerja siswa/instansi dan tekan tombol 'Ambil Foto & GPS'."}
                </p>

                {photo && gpsOk && (
                  <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 flex items-center gap-2">
                    <span className="text-base text-emerald-600">✅</span>
                    <p className="text-[11px] sm:text-xs font-black text-emerald-700">
                      Foto & Titik GPS berhasil diperoleh!
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => goStep(2)}
                  disabled={!fotoLengkap}
                  className="mt-3.5 w-full rounded-xl bg-blue-700 hover:bg-blue-800 py-2.5 text-xs sm:text-sm font-black text-white shadow active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                >
                  Lanjut ke Kondisi Siswa →
                </button>
              </div>
            )}

            {/* LANGKAH 2 */}
            {step === 2 && (
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>👨‍🏫</span>
                  <span>Langkah 2 — Kondisi Lapangan Siswa</span>
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Pilih kondisi penempatan siswa saat kunjungan monitoring:
                </p>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    {
                      name: "BERSAMA SISWA",
                      icon: "👨‍🏫",
                      desc: "Siswa berada di lokasi bersama guru pembimbing",
                      border: "peer-checked:border-emerald-500 peer-checked:bg-emerald-50/70 text-emerald-800",
                    },
                    {
                      name: "SISWA MAGANG DILUAR",
                      icon: "🏢",
                      desc: "Siswa sedang penugasan dinas luar / lapangan",
                      border: "peer-checked:border-amber-500 peer-checked:bg-amber-50/70 text-amber-800",
                    },
                  ].map((item) => (
                    <label
                      key={item.name}
                      className="relative cursor-pointer block select-none h-full"
                    >
                      <input
                        type="radio"
                        className="peer sr-only"
                        checked={status === item.name}
                        onChange={() => setStatus(item.name)}
                      />
                      <div
                        className={`flex flex-col items-center justify-center text-center p-3 sm:p-4 rounded-xl sm:rounded-2xl border-2 border-slate-200 font-bold transition-all duration-150 active:scale-[0.97] ${item.border} peer-checked:shadow-sm`}
                      >
                        <span className="text-2xl mb-1">{item.icon}</span>
                        <span className="text-xs sm:text-sm font-black">{item.name}</span>
                        <span className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                          {item.desc}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-3.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs sm:text-sm font-black text-slate-600 active:scale-95"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={nextFromKondisi}
                    className="flex-1 rounded-xl bg-blue-700 hover:bg-blue-800 py-2.5 text-xs sm:text-sm font-black text-white shadow active:scale-[0.98] transition-all"
                  >
                    Lanjut ke Laporan →
                  </button>
                </div>
              </div>
            )}

            {/* LANGKAH 3 */}
            {step === 3 && (
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>📝</span>
                  <span>Langkah 3 — Keterangan & Catatan Monitoring</span>
                </h3>
                <label className="mt-2 block text-[11px] font-black uppercase tracking-wider text-slate-500">
                  Temuan di Lapangan / Catatan Bimbingan <span className="text-rose-500">*</span>
                </label>
                <textarea
                  ref={textRef}
                  rows={4}
                  value={keterangan}
                  onChange={(e) => setKeterangan(e.target.value)}
                  placeholder="Jelaskan temuan di lapangan, sikap siswa, kedisiplinan, materi yang dipelajari, kendala..."
                  className="mt-1 w-full rounded-xl border-2 border-slate-200 p-3 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-500 focus:outline-none transition-colors resize-none"
                />
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  Minimal 3 karakter untuk melanjutkan.
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs sm:text-sm font-black text-slate-600 active:scale-95"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={nextFromKeterangan}
                    disabled={keterangan.trim().length < 3}
                    className="flex-1 rounded-xl bg-blue-700 hover:bg-blue-800 py-2.5 text-xs sm:text-sm font-black text-white shadow active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed transition-all"
                  >
                    Lanjut ke Periksa & Kirim →
                  </button>
                </div>
              </div>
            )}

            {/* LANGKAH 4 */}
            {step === 4 && (
              <div>
                <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                  <span>🚀</span>
                  <span>Langkah 4 — Periksa & Kirim</span>
                </h3>

                <dl className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 text-xs">
                  <Ringkas label="Guru" value={user.nama} onEdit={null} />
                  <Ringkas label="Lokasi Magang" value={tempatMagang} onEdit={null} />
                  <Ringkas label="Status Kondisi" value={status} onEdit={() => setStep(2)} />
                  <Ringkas
                    label="Foto & GPS"
                    value={fotoLengkap ? "Siap ✔" : "Belum lengkap"}
                    onEdit={() => setStep(1)}
                  />
                  <Ringkas
                    label="Keterangan"
                    value={keterangan}
                    onEdit={() => setStep(3)}
                  />
                </dl>

                <div className="mt-3.5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-xl border border-slate-200 px-3 py-3 text-xs sm:text-sm font-black text-slate-600 active:scale-95"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMonitoring}
                    disabled={!fotoLengkap || saving || keterangan.trim().length < 3}
                    className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-3 text-xs sm:text-sm font-black text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:cursor-not-allowed transition-all"
                  >
                    {saving
                      ? `🔄 Menyimpan… (${Math.round(saveProgress)}%)`
                      : "🚀 SIMPAN DATA MONITORING"}
                  </button>
                </div>
                {!fotoLengkap && !saving && (
                  <p className="mt-2 text-center text-[11px] font-bold text-rose-500">
                    Foto lingkungan dan titik GPS harus terkunci dulu (langkah 1).
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* OVERLAY PROGRES SIMPAN DENGAN PERSENTASE BAR */}
      {saving && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-xs text-center bg-white p-5 rounded-3xl shadow-2xl border border-slate-100">
            <p className="mb-3 text-sm font-bold text-slate-700">
              {saveStatusText || "Menyimpan Data Monitoring..."}
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

      {/* MODAL INDIKATOR LANDSCAPE OTOMATIS (DIPERTAHANKAN PENUH) */}
      {showLandscapeGuide && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm transition-all">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            {!isLandscape ? (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl animate-pulse">
                  📱
                </div>
                <h2 className="mt-4 text-xl font-black text-slate-900">
                  Ubah Mode Foto Mendatar
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Silahkan ubah setting di notifikasi HP menjadi ROTASI OTOMATIS dan putar HP Anda ke posisi mendatar agar area lingkungan tempat magang terlihat lebih luas.
                </p>
                <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm font-black text-amber-700 flex items-center justify-center gap-2">
                  <span className="animate-spin">🔄</span> Putar HP →
                </div>
                <button
                  type="button"
                  onClick={() => setShowLandscapeGuide(false)}
                  className="mt-6 w-full rounded-2xl bg-slate-100 py-3.5 font-bold text-slate-600 shadow-sm transition active:scale-95 hover:bg-slate-200"
                >
                  Tutup Panduan
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-3xl">
                  ✅
                </div>
                <h2 className="mt-4 text-xl font-black text-emerald-700">
                  Landscape Aktif
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">
                  Posisi layar sudah mendatar. Silakan ambil foto lingkungan.
                </p>
                <button
                  type="button"
                  onClick={() => setShowLandscapeGuide(false)}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-bold text-white shadow-md transition active:scale-95 hover:brightness-110"
                >
                  Silakan Ambil Foto
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* --- REUSABLE SUB-COMPONENTS (SAMA SEPERTI PRESENSI/PAGE.JS) --- */

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
