"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { saveMonitoring, uploadPhoto } from "../../lib/api";
import { getSession, isLoggedIn } from "../../lib/auth";
import QRCode from "qrcode";

export default function MonitoringPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState(null);

  const [status, setStatus] = useState("BERSAMA SISWA");
  const [keterangan, setKeterangan] = useState("");

  const [photo, setPhoto] = useState("");
  const [photoSuccess, setPhotoSuccess] = useState(false);

  const [cameraReady, setCameraReady] = useState(false);

  const [latitude, setLatitude] = useState("-");
  const [longitude, setLongitude] = useState("-");
  const [alamat, setAlamat] = useState("-"); // State baru untuk Alamat
  const [accuracy, setAccuracy] = useState("-");
  const [gpsSuccess, setGpsSuccess] = useState(false);

  const [gpsLoading, setGpsLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkCanvasRef = useRef(null);

  const [tempatMagang, setTempatMagang] = useState("");

  // FUNGSI BACK DENGAN STOP KAMERA
  function handleBack() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
    }
    router.replace("/magang/guru");
  }

  // FUNGSI KAMERA (Kamera Belakang/Environment)
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = async () => {
        await videoRef.current.play();
        setCameraReady(true);
      };
    } catch (err) {
      console.log(err);
      alert("Kamera tidak dapat dibuka.");
    }
  }

  // FUNGSI TAMBAH WATERMARK
  function addWatermark(imageData) {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.onload = () => {
        const canvas = watermarkCanvasRef.current;
        if (!canvas) return resolve(imageData);
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(img, 0, 0);

        const now = new Date();
        const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
        const tanggal = now.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const jam = now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        // Ukuran box diperbesar untuk menampung baris alamat
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

        // KOLOM 1
        ctx.fillText("Guru : " + user.nama, col1, startY);
        ctx.fillText("Tempat : " + tempatMagang, col1, startY + 30);
        ctx.fillText("Status : " + status, col1, startY + 60);

        // KOLOM 2
        ctx.fillText("Hari : " + hari, col2, startY);
        ctx.fillText("Tanggal : " + tanggal, col2, startY + 30);
        ctx.fillText("Jam : " + jam + " WIB", col2, startY + 60);

        // BARIS GABUNGAN UNTUK LOKASI DI BAWAH KOLOM
        ctx.fillText(
          "Koordinat : " + latitude + ", " + longitude,
          col1,
          startY + 90,
        );

        // Membatasi teks alamat agar tidak menabrak QR Code
        const limit = 60;
        const textAlamat =
          alamat.length > limit ? alamat.substring(0, limit) + "..." : alamat;
        ctx.fillText("Lokasi : " + textAlamat, col1, startY + 120);

        const qrX = boxX + boxW - 165;
        const qrY = boxY + 20;
        const qrData = `https://maps.google.com/?q=${latitude},${longitude}`;

        QRCode.toDataURL(qrData, { width: 150, margin: 1 }).then((qrUrl) => {
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

            const watermarkedImage = canvas.toDataURL("image/jpeg", 0.9);
            resolve(watermarkedImage);
          };
          qrImage.src = qrUrl;
        });
      };
      img.src = imageData;
    });
  }

  // FUNGSI AMBIL FOTO
  async function capturePhoto() {
    if (photo) {
      setPhoto("");
      setPhotoSuccess(false);
      setLatitude("-");
      setLongitude("-");
      setAlamat("-"); // Reset Alamat
      setAccuracy("-");
      setGpsSuccess(false);
      setCameraReady(false);
      await startCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState !== 4) {
      alert("Kamera belum siap.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/jpeg", 0.9);
    setPhoto(image);
    setPhotoSuccess(true);

    const tracks = video.srcObject?.getTracks();
    tracks?.forEach((track) => track.stop());
    video.srcObject = null;

    getLocation();
  }

  // FUNGSI GPS (Ditambah Reverse Geocoding via Nominatim)
  function getLocation() {
    if (!navigator.geolocation) {
      alert("GPS tidak didukung.");
      return;
    }

    setGpsLoading(true);
    setAlamat("Mencari alamat lokasi...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);
        setAccuracy(Math.round(pos.coords.accuracy) + " meter");
        setGpsSuccess(true);
        setGpsLoading(false);

        // Fetch nama jalan / alamat dari koordinat
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
          );
          const data = await res.json();
          if (data && data.display_name) {
            setAlamat(data.display_name);
          } else {
            setAlamat("Alamat tidak ditemukan");
          }
        } catch (err) {
          setAlamat("Gagal memuat alamat");
        }
      },
      () => {
        setGpsLoading(false);
        setAlamat("-");
        alert("Lokasi tidak dapat diperoleh.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  // FUNGSI SIMPAN MONITORING
  async function handleSaveMonitoring() {
    if (!photo) {
      alert("Silakan ambil foto monitoring.");
      return;
    }
    if (latitude === "-") {
      alert("Lokasi GPS belum diperoleh.");
      return;
    }
    if (keterangan.trim() === "") {
      alert("Keterangan monitoring wajib diisi.");
      return;
    }

    try {
      setSaving(true);
      const photoWithWatermark = await addWatermark(photo);
      const upload = await uploadPhoto(
        photoWithWatermark,
        "MONITORING_" + Date.now() + ".jpg",
      );

      if (!upload.success) {
        alert(upload.message);
        setSaving(false);
        return;
      }

      const result = await saveMonitoring({
        idGuru: user.id,
        namaGuru: user.nama,
        tempatMagang: tempatMagang,
        fotoUrl: upload.data.url,
        latitude: latitude,
        longitude: longitude,
        mapUrl: "https://www.google.com/maps?q=" + latitude + "," + longitude,
        status: status,
        keterangan: keterangan,
      });

      if (result.success) {
        alert("Monitoring berhasil disimpan.");
        if (videoRef.current?.srcObject) {
          videoRef.current.srcObject
            .getTracks()
            .forEach((track) => track.stop());
          videoRef.current.srcObject = null;
        }
        setPhoto("");
        setPhotoSuccess(false);
        setKeterangan("");
        setLatitude("-");
        setLongitude("-");
        setAlamat("-"); // Reset Alamat
        setAccuracy("-");
        setGpsSuccess(false);
        window.location.href = "/magang/guru";
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.log(err);
      alert("Terjadi kesalahan.");
    }
    setSaving(false);
  }

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
        router.replace("/magang/guru/pilih-tempat");
        return;
      }
      setTempatMagang(tempat);
      setLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!loading && user && !photo) {
      startCamera();
    }
    return () => {
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [loading, user, photo]);

  // --- TAMPILAN LOADING ANIMATIF ---
  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-700 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-base font-bold text-slate-600 tracking-wide">
            Menyiapkan Modul Monitoring...
          </p>
        </div>
      </main>
    );
  }

  // GET CURRENT DATE/TIME
  const now = new Date();
  const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
  const tanggal = now.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const jam = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1 rounded-xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={38}
                height={38}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                MONITORING MAGANG
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <button
            onClick={handleBack}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-white hover:brightness-110 active:scale-95 shadow-md shadow-indigo-900/30 border border-blue-500/30 transition-all flex items-center gap-1"
          >
            🔙 KEMBALI
          </button>
        </div>
      </header>

      {/* HERO BANNER GURU */}
      <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-6 sm:pt-8 space-y-6 sm:space-y-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-xl border border-blue-800">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-amber-400 opacity-10 rounded-full blur-2xl"></div>

          <div className="relative">
            <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-3 border border-amber-400/30">
              🔍 Monitoring Lapangan
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight">
              {user.nama}
            </h2>

            <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3 border-t border-white/10 pt-5">
              <Info label="ID GURU" value={user.id} isLight={true} />
              <Info label="NAMA GURU" value={user.nama} isLight={true} />
              <Info label="TEMPAT MAGANG" value={tempatMagang} isLight={true} />
            </div>

            {/* WAKTU MONITORING */}
            <div className="mt-4 grid gap-3 grid-cols-3">
              <div className="col-span-1 rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Hari
                </p>
                <p className="mt-0.5 text-sm sm:text-base font-black text-white capitalize">
                  {hari}
                </p>
              </div>
              <div className="col-span-1 rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Tanggal
                </p>
                <p className="mt-0.5 text-sm sm:text-base font-black text-white">
                  {tanggal}
                </p>
              </div>
              <div className="col-span-1 rounded-xl bg-white/5 border border-white/10 p-3 sm:p-4 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">
                  Jam
                </p>
                <p className="mt-0.5 text-sm sm:text-base font-black text-amber-300">
                  {jam}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* KAMERA & GPS LAYOUT */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* KAMERA */}
          <section className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                📸 Foto Lingkungan
              </h2>

              <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-video w-full shadow-inner border border-slate-200">
                {!photo ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <img
                    src={photo}
                    alt="Monitoring"
                    className="w-full h-full object-cover"
                  />
                )}
                {/* Canvas hidden untuk processing watermark */}
                <canvas ref={canvasRef} className="hidden" />
                <canvas ref={watermarkCanvasRef} className="hidden" />
              </div>
            </div>

            {photoSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm flex items-center justify-center gap-2">
                <span className="text-xl">✅</span>
                <p className="text-sm font-black text-emerald-700 tracking-wide">
                  FOTO TEREKAM
                </p>
              </div>
            )}

            <button
              onClick={capturePhoto}
              disabled={!cameraReady && !photo}
              className={`mt-4 w-full rounded-2xl py-4 text-base font-black text-white transition-all duration-150 shadow-md active:scale-[0.97] ${
                photo
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/20 hover:brightness-110"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/20 hover:brightness-110 disabled:from-slate-400 disabled:to-slate-400 disabled:scale-100 disabled:cursor-not-allowed"
              }`}
            >
              {photo ? "🔄 AMBIL ULANG FOTO" : "📸 AMBIL FOTO & TITIK GPS"}
            </button>
          </section>

          {/* GPS INFO */}
          <section className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-1">
                📡 Pelacakan Lokasi
              </h2>
              <p className="text-xs font-semibold text-slate-400 mb-4">
                Memastikan koordinat akurat di tempat instansi.
              </p>

              <div className="space-y-3">
                <GpsCard
                  label="Garis Lintang (Latitude)"
                  value={latitude}
                  icon="🌐"
                />
                <GpsCard
                  label="Garis Bujur (Longitude)"
                  value={longitude}
                  icon="📍"
                />
                {/* Komponen Baru untuk Alamat */}
                <GpsCard
                  label="Alamat Lokasi"
                  value={alamat}
                  icon="🗺️"
                  isLoading={gpsLoading || String(alamat).includes("Mencari")}
                />
                <GpsCard
                  label="Akurasi Radar"
                  value={gpsLoading ? "Mengunci Satelit..." : accuracy}
                  icon="🎯"
                  isLoading={gpsLoading}
                />
              </div>

              {gpsSuccess && latitude !== "-" && (
                <div className="mt-4 text-center">
                  <a
                    href={`https://maps.google.com/?q=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 transition-colors"
                  >
                    🗺️ Cek Akurasi via Google Maps
                  </a>
                </div>
              )}
            </div>

            {gpsSuccess && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 shadow-sm flex items-center justify-center gap-2">
                <span className="text-xl">✅</span>
                <p className="text-sm font-black text-emerald-700 tracking-wide">
                  TITIK GPS TERKUNCI
                </p>
              </div>
            )}
          </section>
        </div>

        {/* DATA MONITORING FORM */}
        <section className="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-4">
            📝 Laporan Aktivitas
          </h2>

          <div className="space-y-6">
            {/* STATUS MONITORING (TOUCH BLOCKS) */}
            <div>
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider block mb-3">
                Kondisi Lapangan Siswa
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  {
                    name: "BERSAMA SISWA",
                    icon: "👨‍🏫",
                    color:
                      "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 text-emerald-700 bg-emerald-50/20",
                  },
                  {
                    name: "SISWA MAGANG DILUAR",
                    icon: "🏢",
                    color:
                      "peer-checked:border-amber-500 peer-checked:bg-amber-50 text-amber-700 bg-amber-50/20",
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
                      className={`flex flex-col items-center justify-center h-full text-center py-4 px-2 rounded-2xl border-2 border-slate-200 font-black text-sm transition-all duration-150 active:scale-[0.96] ${item.color} peer-checked:shadow-sm`}
                    >
                      <span className="text-2xl mb-1">{item.icon}</span>
                      {item.name}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* KETERANGAN KONDISI */}
            <div className="flex flex-col">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                Keterangan Monitoring <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={4}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Jelaskan temuan di lapangan, sikap siswa, kedisiplinan, dll..."
                className="w-full rounded-2xl border-2 border-slate-200 p-4 font-semibold text-slate-800 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors resize-none"
              />
            </div>

            {/* TOMBOL SIMPAN */}
            <div className="pt-4">
              <button
                onClick={handleSaveMonitoring}
                disabled={saving || !photo || latitude === "-"}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-5 text-lg font-black text-white hover:brightness-110 shadow-lg shadow-emerald-500/30 active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed transition-all"
              >
                {saving
                  ? "🔄 MENGUNGGAH KE SERVER..."
                  : "🚀 SIMPAN DATA MONITORING"}
              </button>

              {(!photo || latitude === "-") && !saving && (
                <p className="mt-3 text-center text-xs font-bold text-rose-500 animate-pulse">
                  *Akses simpan terkunci. Pastikan Foto Lingkungan & Titik GPS
                  sudah didapatkan.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* --- REUSABLE SUB-COMPONENTS --- */

function Info({ label, value, isLight = false }) {
  return (
    <div
      className={`rounded-xl p-3 sm:p-4 ${isLight ? "bg-white/10 border border-white/5" : "bg-slate-50 border border-slate-100"}`}
    >
      <p
        className={`text-[10px] font-black uppercase tracking-wider ${isLight ? "text-blue-300" : "text-slate-400"}`}
      >
        {label}
      </p>
      <p
        className={`text-sm sm:text-base font-extrabold mt-0.5 truncate ${isLight ? "text-white" : "text-slate-800"}`}
      >
        {value}
      </p>
    </div>
  );
}

// SUDAH DIPERBAIKI: Konversi string aman untuk .includes()
function GpsCard({ label, value, icon, isLoading = false }) {
  const safeValue = String(value);

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3 sm:p-4 shadow-sm">
      <div className="text-xl sm:text-2xl bg-white w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-slate-200 shadow-sm shrink-0">
        <span className={isLoading ? "animate-bounce" : ""}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">
          {label}
        </p>
        <p
          className={`text-sm sm:text-base font-black ${
            safeValue === "-" ||
            safeValue.includes("Mencari") ||
            safeValue.includes("Gagal")
              ? "text-slate-400"
              : "text-blue-900"
          } ${String(label).includes("Alamat") ? "line-clamp-2 text-xs sm:text-sm" : "truncate"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
