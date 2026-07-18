"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { cleanupResources } from "../lib/navigation";
import { getSession, isLoggedIn } from "../lib/auth";
import { savePresensi } from "../lib/api";
import QRCode from "qrcode";

const NamaBadge = ({ rawName }) => {
  if (!rawName) return null;

  const match = rawName.match(/(.+?)\s*\[(.*?)\]/);

  if (!match) {
    return <span>{rawName}</span>;
  }

  const namaSiswa = match[1].trim();
  const kelas = match[2].trim();

  let badgeClasses = "bg-slate-100 border-slate-300 text-slate-700";
  if (kelas === "XI TJKT 1") {
    badgeClasses = "bg-emerald-50 border-emerald-400 text-emerald-700";
  } else if (kelas === "XI TJKT 2") {
    badgeClasses = "bg-violet-50 border-violet-400 text-violet-700";
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 sm:gap-2">
      <span>{namaSiswa}</span>{" "}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 border rounded-md text-[9px] sm:text-[11px] font-black uppercase tracking-wider shadow-sm bg-clip-border ${badgeClasses}`}
      >
        {kelas}
      </span>
    </span>
  );
};

export default function PresensiPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [status, setStatus] = useState("Hadir");
  const [pembimbing, setPembimbing] = useState("");
  const [kompetensi, setKompetensi] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const [recentPembimbing, setRecentPembimbing] = useState([]);

  // State baru untuk mendeteksi apakah sudah absen hari ini
  const [hasPresensiToday, setHasPresensiToday] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkCanvasRef = useRef(null);

  const [photo, setPhoto] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const [latitude, setLatitude] = useState("-");
  const [longitude, setLongitude] = useState("-");
  const [accuracy, setAccuracy] = useState("-");
  const [alamat, setAlamat] = useState("-"); // State baru untuk menyimpan alamat dari OpenStreetMap

  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const streamRef = useRef(null);
  const watchIdRef = useRef(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = async () => {
        try {
          await videoRef.current.play();
          setCameraReady(true);
        } catch (e) {
          console.error("Gagal memutar video:", e);
        }
      };
    } catch (err) {
      console.error(err);
      alert("Kamera tidak dapat dibuka.");
    }
  }

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

        // ==========================================
        // 1. WATERMARK ATAS KANAN (ALAMAT & LOKASI)
        // ==========================================
        const topBoxW = 480;
        const topBoxH = 140;
        const topBoxX = img.width - topBoxW - 20; // 20px dari tepi kanan
        const topBoxY = 20; // 20px dari tepi atas

        // Background transparan yang sama dengan watermark bawah
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(topBoxX, topBoxY, topBoxW, topBoxH);

        // Icon Map
        ctx.font = "34px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText("📍", topBoxX + 20, topBoxY + 50);

        // Judul Lokasi
        ctx.font = "bold 18px Arial";
        ctx.fillText("LOKASI SAAT INI:", topBoxX + 65, topBoxY + 45);

        // Teks Alamat (dengan fungsi auto-wrap ke baris baru)
        ctx.font = "16px Arial";
        const alamatText = alamat !== "-" ? alamat : "Mencari detail alamat...";
        const maxTextWidth = topBoxW - 85;
        const words = alamatText.split(" ");
        let line = "";
        let textY = topBoxY + 75;
        const lineHeight = 22;

        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + " ";
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxTextWidth && n > 0) {
            ctx.fillText(line, topBoxX + 65, textY);
            line = words[n] + " ";
            textY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, topBoxX + 65, textY); // Draw sisa teks

        // ==========================================
        // 2. WATERMARK BAWAH (DATA SISWA & BARCODE)
        // ==========================================
        const boxX = 20;
        const boxY = img.height - 230;
        const boxW = img.width - 40;
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

        titleY += 18;

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

  async function capturePhoto() {
    if (photo) {
      setPhoto("");
      setLatitude("-");
      setLongitude("-");
      setAccuracy("-");
      setAlamat("-");
      await startCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    if (video.readyState !== 4) {
      alert("Kamera masih mempersiapkan gambar.");
      return;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Kamera belum siap.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/jpeg", 0.9);
    setPhoto(image);

    if (navigator.geolocation) {
      setGpsLoading(true);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          setLatitude(lat);
          setLongitude(lon);
          setAccuracy(Math.round(pos.coords.accuracy) + " meter");

          // Panggil API OpenStreetMap (Nominatim) untuk reverse geocoding
          fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
          )
            .then((res) => res.json())
            .then((data) => {
              setAlamat(data.display_name || "Detail alamat tidak ditemukan");
              setGpsLoading(false);
            })
            .catch((err) => {
              console.error(err);
              setAlamat("Gagal memuat alamat dari server GPS");
              setGpsLoading(false);
            });
        },
        (err) => {
          alert("GPS gagal didapatkan. Pastikan izin lokasi aktif.");
          setGpsLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        },
      );
    } else {
      alert("Browser Anda tidak mendukung fitur GPS.");
    }
  }

  function cleanup() {
    cleanupResources({
      streamRef,
      videoRef,
      watchIdRef,
    });
  }

  async function handleSubmit() {
    if (!photo) {
      alert("Silakan ambil foto terlebih dahulu.");
      return;
    }

    if (latitude === "-") {
      alert("Lokasi GPS belum diperoleh.");
      return;
    }

    if (pembimbing.trim() === "") {
      alert("Nama pembimbing lapangan wajib diisi.");
      return;
    }

    if (kompetensi.trim() === "") {
      alert("Kompetensi hari ini wajib diisi.");
      return;
    }

    try {
      setSaving(true);

      const photoWithWatermark = await addWatermark(photo);

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

      if (result.success) {
        alert("Presensi berhasil disimpan.");
        let pembimbingList = JSON.parse(
          localStorage.getItem("magang_recent_pembimbing") || "[]",
        );

        pembimbingList = pembimbingList.filter((item) => item !== pembimbing);
        if (pembimbing.trim() !== "") {
          pembimbingList.unshift(pembimbing);
        }
        pembimbingList = pembimbingList.slice(0, 10);

        localStorage.setItem(
          "magang_recent_pembimbing",
          JSON.stringify(pembimbingList),
        );
        localStorage.setItem(
          "magang_user_pref",
          JSON.stringify({ status, pembimbing }),
        );

        const todayStr = new Date().toLocaleDateString("id-ID");
        localStorage.setItem("magang_last_presensi_date", todayStr);

        router.replace("/magang/dashboard_siswa");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    async function loadPage() {
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
      const pembimbingList = JSON.parse(
        localStorage.getItem("magang_recent_pembimbing") || "[]",
      );
      setRecentPembimbing(pembimbingList);

      const pref = JSON.parse(localStorage.getItem("magang_user_pref") || "{}");
      if (pref.status) setStatus(pref.status);
      if (pref.pembimbing) setPembimbing(pref.pembimbing);

      const lastPresensiDate = localStorage.getItem(
        "magang_last_presensi_date",
      );
      const todayStr = new Date().toLocaleDateString("id-ID");
      if (lastPresensiDate === todayStr) {
        setHasPresensiToday(true);
      }

      setLoading(false);
    }

    loadPage();
  }, [router]);

  useEffect(() => {
    if (!loading && user && !photo) {
      startCamera();
    }
    return () => {
      cleanup();
    };
  }, [loading, user, photo]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-700 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-base font-bold text-slate-600 tracking-wide">
            Membuka Form Presensi...
          </p>
        </div>
      </main>
    );
  }

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
    <main className="min-h-screen bg-slate-50 space-y-6 pb-12">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-4 sm:px-6 py-3">
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
                PRESENSI MAGANG
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              cleanup();
              router.replace("/magang/dashboard_siswa");
            }}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 sm:px-5 py-2 text-xs sm:text-sm font-black text-white hover:brightness-110 active:scale-95 shadow-md shadow-indigo-900/30 border border-blue-500/30 transition-all flex items-center gap-1"
          >
            🏠 BERANDA PROFIL
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 space-y-6 sm:space-y-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 text-white shadow-xl border border-blue-800">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-amber-400 opacity-10 rounded-full blur-2xl"></div>
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-3 border border-amber-400/30">
              📸 Input Presensi Harian
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex flex-wrap items-center gap-1.5 sm:gap-2">
              <NamaBadge rawName={user.nama} />
            </h2>

            <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3 border-t border-white/10 pt-4">
              <Info label="ID SISWA" value={user.id} isLight={true} />
              <Info
                label="GURU PEMBIMBING"
                value={user.namaGuru}
                isLight={true}
              />
              <Info
                label="TEMPAT MAGANG"
                value={user.tempatMagang}
                isLight={true}
              />
            </div>

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

        {hasPresensiToday ? (
          <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-5 shadow-sm transition-all duration-300">
            <p className="text-lg font-black text-emerald-600 flex items-center gap-2">
              ✅ Hebat! Anda Sudah Melakukan Presensi Hari Ini
            </p>
            <p className="text-xs text-emerald-600/80 font-bold mt-1.5 ml-8">
              Tetap semangat! Anda dapat mengisi form lagi jika perlu melaporkan
              kegiatan tambahan.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 p-5 shadow-sm transition-all duration-300">
            <p className="text-lg font-black text-rose-600 flex items-center gap-2">
              🔴 Status: Belum Melakukan Presensi Hari Ini
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <section className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
                🤳 Foto Kamera Utama
              </h2>

              <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-video w-full shadow-inner border border-slate-200">
                {!photo ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    controls={false}
                    disablePictureInPicture
                    className="h-full w-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <img
                    src={photo}
                    alt="Hasil Selfie"
                    className="h-full w-full object-cover"
                  />
                )}
                <canvas ref={canvasRef} className="hidden" />
                <canvas ref={watermarkCanvasRef} className="hidden" />
              </div>
            </div>

            <button
              onClick={capturePhoto}
              disabled={!cameraReady && !photo}
              className={`mt-5 w-full rounded-2xl py-4 text-base font-black text-white transition-all duration-150 shadow-md active:scale-[0.97] ${
                photo
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-orange-500/20 hover:brightness-110"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-600/20 hover:brightness-110 disabled:from-slate-400 disabled:to-slate-400 disabled:scale-100 disabled:cursor-not-allowed"
              }`}
            >
              {photo ? "🔄 AMBIL ULANG FOTO" : "📸 AMBIL FOTO & DETEKSI GPS"}
            </button>
          </section>

          <section className="rounded-[2rem] bg-white p-5 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-800">
                📡 Koordinat Geotagging
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Sistem mengunci titik koordinat otomatis ketika tombol jepret
                ditekan.
              </p>

              <div className="mt-5 space-y-3">
                <GpsCard
                  label="Latitude (Garis Lintang)"
                  value={latitude}
                  icon="🌐"
                />
                <GpsCard
                  label="Longitude (Garis Bujur)"
                  value={longitude}
                  icon="📍"
                />
                <GpsCard
                  label="Akurasi Margin Kesalahan"
                  value={gpsLoading ? "Mencari Satelit..." : accuracy}
                  icon="🎯"
                  isLoading={gpsLoading}
                />
                <GpsCard
                  label="Detail Alamat Lokasi"
                  value={gpsLoading ? "Mencari alamat..." : alamat}
                  icon="🗺️"
                  isLoading={gpsLoading}
                />
              </div>
            </div>

            <div className="mt-5 p-4 bg-blue-50 text-blue-800 rounded-2xl text-xs font-bold border border-blue-100">
              ℹ️ Pastikan akurasi berada di bawah 50 meter untuk validitas
              kehadiran optimal.
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-slate-100">
          <h2 className="text-2xl font-black text-slate-800 mb-6 border-b border-slate-100 pb-4">
            📝 Lembar Verifikasi Aktivitas
          </h2>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider block mb-3">
                Pilih Status Absensi Hari Ini
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    name: "Hadir",
                    color:
                      "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 text-emerald-700 bg-emerald-50/20",
                  },
                  {
                    name: "Izin",
                    color:
                      "peer-checked:border-amber-500 peer-checked:bg-amber-50 text-amber-700 bg-amber-50/20",
                  },
                  {
                    name: "Sakit",
                    color:
                      "peer-checked:border-blue-500 peer-checked:bg-blue-50 text-blue-700 bg-blue-50/20",
                  },
                ].map((item) => (
                  <label
                    key={item.name}
                    className="relative cursor-pointer block select-none"
                  >
                    <input
                      type="radio"
                      name="status_absen"
                      className="peer sr-only"
                      checked={status === item.name}
                      onChange={() => setStatus(item.name)}
                    />
                    <div
                      className={`w-full text-center py-4 rounded-xl border-2 border-slate-200 font-black text-sm transition-all duration-150 active:scale-[0.95] ${item.color} peer-checked:shadow-sm`}
                    >
                      {item.name === "Hadir" && "✅ "}
                      {item.name === "Izin" && "📝 "}
                      {item.name === "Sakit" && "🤒 "}
                      {item.name}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                Nama Pembimbing Lapangan (Instansi/DUDI)
              </label>
              <input
                list="listPembimbing"
                value={pembimbing}
                onChange={(e) => setPembimbing(e.target.value)}
                placeholder="Masukkan nama staf pembimbing industri..."
                className="w-full rounded-2xl border-2 border-slate-200 p-4 font-semibold text-slate-800 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors"
              />
              <datalist id="listPembimbing">
                {recentPembimbing.map((item, index) => (
                  <option key={index} value={item} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                Materi/Kompetensi yang Dikerjakan Hari Ini
              </label>
              <textarea
                rows={4}
                value={kompetensi}
                onChange={(e) => setKompetensi(e.target.value)}
                placeholder="Contoh: Melakukan perbaikan jaringan LAN, merakit PC kantor, membuat laporan keuangan harian..."
                className="w-full rounded-2xl border-2 border-slate-200 p-4 font-semibold text-slate-800 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider mb-2">
                Catatan Tambahan / Keterangan{" "}
                <span className="text-slate-400 font-normal">(Opsional)</span>
              </label>
              <textarea
                rows={3}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Tulis alasan jika Izin/Sakit, atau catatan kendala teknis di lapangan..."
                className="w-full rounded-2xl border-2 border-slate-200 p-4 font-semibold text-slate-800 focus:border-blue-500 focus:ring-0 focus:outline-none transition-colors resize-none"
              />
            </div>

            <div className="pt-4">
              <button
                onClick={handleSubmit}
                disabled={!photo || latitude === "-" || saving}
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 py-5 text-lg font-black text-white hover:brightness-110 shadow-lg shadow-emerald-500/30 active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:scale-100 disabled:cursor-not-allowed transition-all"
              >
                {saving
                  ? "🔄 SEDANG MENYIMPAN DATA..."
                  : "🚀 SIMPAN & KIRIM PRESENSI"}
              </button>

              {(!photo || latitude === "-") && !saving && (
                <p className="mt-3 text-center text-xs font-bold text-rose-500 animate-pulse">
                  *Akses simpan ditutup. Harap ambil foto selfie & pastikan
                  koordinat GPS terkunci terlebih dahulu.
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Info({ label, value, isLight = false }) {
  return (
    <div
      className={`rounded-xl p-3 ${isLight ? "bg-white/10 border border-white/5" : "bg-slate-50 border border-slate-100"}`}
    >
      <p
        className={`text-[10px] font-black uppercase tracking-wider ${isLight ? "text-blue-300" : "text-slate-400"}`}
      >
        {label}
      </p>
      <p
        className={`text-sm font-extrabold mt-0.5 truncate ${isLight ? "text-white" : "text-slate-800"}`}
      >
        {value}
      </p>
    </div>
  );
}

function GpsCard({ label, value, icon, isLoading = false }) {
  // Ubah value menjadi string dengan aman untuk mencegah TypeError
  const safeValue = String(value);

  return (
    <div className="flex items-center gap-4 rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 shadow-sm">
      <div className="text-2xl bg-white w-12 h-12 flex items-center justify-center rounded-xl border border-slate-200 shadow-sm shrink-0">
        <span className={isLoading ? "animate-bounce" : ""}>{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">
          {label}
        </p>
        <p
          className={`text-sm sm:text-base font-black ${
            safeValue === "-" || safeValue.includes("Mencari")
              ? "text-slate-400"
              : "text-blue-900"
          } ${label.includes("Alamat") ? "line-clamp-2" : "truncate"}`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
