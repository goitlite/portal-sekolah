"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { getSession, isLoggedIn } from "../lib/auth";
import {
  getStatistikSiswa,
  getRiwayatSiswa,
  getPresensiHariIni,
  savePresensi,
} from "../lib/api";

export default function PresensiPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  const [status, setStatus] = useState("Hadir");
  const [pembimbing, setPembimbing] = useState("");
  const [kompetensi, setKompetensi] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [photo, setPhoto] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  // 1. Tambahan State GPS
  const [latitude, setLatitude] = useState("-");
  const [longitude, setLongitude] = useState("-");
  const [accuracy, setAccuracy] = useState("-");

  // SOLUSI 1: State gpsLoading dipindah ke level atas komponen
  const [gpsLoading, setGpsLoading] = useState(false);

  // 2. Fungsi startCamera dipindah ke dalam komponen
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

      if (!videoRef.current) return;

      videoRef.current.srcObject = stream;

      videoRef.current.onloadedmetadata = async () => {
        await videoRef.current.play();
        setCameraReady(true);
      };
    } catch (err) {
      console.error(err);
      alert("Kamera tidak dapat dibuka.");
    }
  }

  // 3. Fungsi capturePhoto dipindah ke dalam dan disisipkan GPS
  async function capturePhoto() {
    // Logika untuk Ambil Ulang Foto
    if (photo) {
      setPhoto("");
      setLatitude("-");
      setLongitude("-");
      setAccuracy("-");
      await startCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    // SOLUSI 3: Pastikan ukuran video sudah siap sebelum menggambar canvas
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      alert("Kamera belum siap.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    console.log(video.readyState);
    console.log(video.videoWidth);
    console.log(video.videoHeight);
    ctx.drawImage(video, 0, 0);

    // SOLUSI 4: Pastikan canvas berhasil menggambar
    console.log(canvas.toDataURL("image/jpeg"));

    const image = canvas.toDataURL("image/jpeg", 0.9);
    setPhoto(image);

    // SOLUSI 2 & 5: Baris kode untuk menghentikan track video (track.stop) dihapus
    // agar stream tetap menyala saat React merender <img>.

    // Ambil GPS Otomatis setelah jepret foto
    if (navigator.geolocation) {
      // SOLUSI 1: Cukup setGpsLoading(true) di sini
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setAccuracy(Math.round(pos.coords.accuracy) + " meter");
          setGpsLoading(false); // Opsional: Matikan loading saat sukses
        },
        (err) => {
          alert("GPS gagal didapatkan. Pastikan izin lokasi aktif.");
          setGpsLoading(false); // Opsional: Matikan loading saat error
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

      await startCamera();

      setLoading(false);
    }

    loadPage();
  }, [router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-blue-700"></div>
          <p className="mt-4 text-slate-500">Memuat halaman presensi...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-10">
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Logo" width={45} height={45} />
            <div>
              <h1 className="font-black text-slate-800">PRESENSI MAGANG</h1>
              <p className="text-xs text-slate-500">SMKN 1 TELUK KUANTAN</p>
            </div>
          </div>

          <button
            onClick={() => router.back()}
            className="rounded-xl bg-blue-700 px-5 py-2 font-bold text-white hover:bg-blue-800"
          >
            Kembali
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl p-6">
        {/* HERO */}
        <div className="rounded-3xl bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-8 text-white shadow-xl">
          <p className="text-sm uppercase tracking-widest text-amber-300">
            Presensi Hari Ini
          </p>
          <h2 className="mt-3 text-4xl font-black">{user.nama}</h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Info label="ID SISWA" value={user.id} />
            <Info label="GURU PEMBIMBING" value={user.namaGuru} />
            <Info label="TEMPAT MAGANG" value={user.tempatMagang} />
          </div>
        </div>

        {/* STATUS */}
        <section className="mt-8 rounded-3xl bg-white p-8 shadow">
          <h2 className="text-2xl font-black text-slate-800">
            Status Hari Ini
          </h2>
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-2xl font-black text-red-600">
              🔴 Belum Presensi
            </p>
            <p className="mt-2 text-slate-600">
              Silakan lakukan presensi hari ini.
            </p>
          </div>
        </section>

        {/* FOTO & GPS SECTION DIBUAT BERDEKATAN KARENA SATU AKSI */}
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          {/* FOTO */}
          <section className="rounded-3xl bg-white p-8 shadow">
            <h2 className="text-2xl font-black text-slate-800">Foto Selfie</h2>

            <div className="mt-6 relative">
              {!photo ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                  disablePictureInPicture
                  className="h-80 w-full rounded-3xl bg-black object-cover"
                />
              ) : (
                <img
                  src={photo}
                  alt="Hasil Selfie"
                  className="h-80 w-full rounded-3xl object-cover shadow-md border border-slate-200"
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <button
              onClick={capturePhoto}
              disabled={!cameraReady && !photo}
              className={`mt-6 w-full rounded-2xl py-4 text-lg font-bold text-white transition ${
                photo
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-blue-700 hover:bg-blue-800 disabled:bg-slate-400"
              }`}
            >
              {photo ? "Ambil Ulang Foto" : "Ambil Foto & Lokasi"}
            </button>
          </section>

          {/* GPS */}
          <section className="rounded-3xl bg-white p-8 shadow">
            <h2 className="text-2xl font-black text-slate-800">Lokasi GPS</h2>
            <p className="mt-2 text-sm text-slate-500">
              Lokasi akan terdeteksi otomatis saat Anda mengambil foto selfie.
            </p>

            <div className="mt-6 space-y-4">
              {/* Menggunakan GpsInfo agar warna font kontras dengan background putih */}
              <GpsInfo label="Latitude" value={latitude} />
              <GpsInfo label="Longitude" value={longitude} />
              <GpsInfo label="Akurasi GPS" value={accuracy} />
            </div>

            {/* Tombol Ambil Lokasi manual dihapus sesuai Blueprint (1 kali klik) */}
          </section>
        </div>

        {/* FORM */}
        <section className="mt-8 rounded-3xl bg-white p-8 shadow">
          <h2 className="text-2xl font-black text-slate-800">Data Presensi</h2>

          <div className="mt-8">
            <label className="font-bold text-slate-700">Status</label>
            <div className="mt-4 space-y-3">
              {["Hadir", "Izin", "Sakit"].map((item) => (
                <label
                  key={item}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition hover:bg-slate-50 ${
                    status === item ? "border-blue-500 bg-blue-50/50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    className="h-5 w-5 cursor-pointer accent-blue-600"
                    checked={status === item}
                    onChange={() => setStatus(item)}
                  />
                  <span className="font-semibold text-slate-800">{item}</span>
                </label>
              ))}
            </div>

            <div className="mt-8">
              <label className="font-bold text-slate-700">
                Pembimbing Lapangan
              </label>
              <input
                value={pembimbing}
                onChange={(e) => setPembimbing(e.target.value)}
                placeholder="Nama Pembimbing di Instansi"
                className="mt-2 w-full rounded-xl border p-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mt-6">
              <label className="font-bold text-slate-700">
                Kompetensi Hari Ini
              </label>
              <textarea
                rows={4}
                value={kompetensi}
                onChange={(e) => setKompetensi(e.target.value)}
                placeholder="Apa yang Anda kerjakan atau pelajari hari ini?"
                className="mt-2 w-full rounded-xl border p-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mt-6">
              <label className="font-bold text-slate-700">Keterangan</label>
              <textarea
                rows={4}
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
                className="mt-2 w-full rounded-xl border p-4 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <button
              disabled={!photo || latitude === "-"}
              className="mt-8 w-full rounded-2xl bg-emerald-600 py-5 text-xl font-black text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              SIMPAN PRESENSI
            </button>

            {(!photo || latitude === "-") && (
              <p className="mt-3 text-center text-sm font-semibold text-red-500">
                *Harap ambil Foto & Lokasi GPS terlebih dahulu sebelum
                menyimpan.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

// Komponen Info untuk Hero (Background Biru Gelap)
function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 p-4">
      <p className="text-xs uppercase tracking-wider text-blue-200">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

// Komponen Info untuk GPS (Background Putih Terang)
function GpsInfo({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-slate-800">{value}</p>
    </div>
  );
}
