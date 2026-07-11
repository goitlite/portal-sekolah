"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { getSession, isLoggedIn } from "../lib/auth";
// 1. Import savePresensi
import { savePresensi } from "../lib/api";

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

  const [latitude, setLatitude] = useState("-");
  const [longitude, setLongitude] = useState("-");
  const [accuracy, setAccuracy] = useState("-");

  const [gpsLoading, setGpsLoading] = useState(false);

  // 2. Tambahan state saving
  const [saving, setSaving] = useState(false);

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

  async function capturePhoto() {
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
          setLatitude(pos.coords.latitude);
          setLongitude(pos.coords.longitude);
          setAccuracy(Math.round(pos.coords.accuracy) + " meter");
          setGpsLoading(false);
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

  // 3. Fungsi handleSubmit
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

      const result = await savePresensi({
        idSiswa: user.id,
        nama: user.nama,
        idGuru: user.idGuru,
        namaGuru: user.namaGuru,
        tempatMagang: user.tempatMagang,

        fotoUrl: photo,

        mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,

        status: status,

        pembimbingLapangan: pembimbing,

        kompetensiYangDikuasai: kompetensi,

        keterangan: keterangan,
      });

      if (result.success) {
        alert("Presensi berhasil disimpan.");

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
      setLoading(false);
    }

    loadPage();
  }, [router]);

  useEffect(() => {
    if (!loading && user && !photo) {
      startCamera();
    }

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [loading, user, photo]);

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

        <div className="mt-8 grid gap-8 md:grid-cols-2">
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
                  className="h-80 w-full rounded-3xl bg-black object-cover shadow-inner"
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

          <section className="rounded-3xl bg-white p-8 shadow">
            <h2 className="text-2xl font-black text-slate-800">Lokasi GPS</h2>
            <p className="mt-2 text-sm text-slate-500">
              Lokasi akan terdeteksi otomatis saat Anda mengambil foto selfie.
            </p>

            <div className="mt-6 space-y-4">
              <GpsInfo label="Latitude" value={latitude} />
              <GpsInfo label="Longitude" value={longitude} />
              <GpsInfo
                label="Akurasi GPS"
                value={gpsLoading ? "Mendapatkan lokasi..." : accuracy}
              />
            </div>
          </section>
        </div>

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

            {/* 4. Ganti tombol submit dan hubungkan handleSubmit */}
            <button
              onClick={handleSubmit}
              disabled={!photo || latitude === "-" || saving}
              className="mt-8 w-full rounded-2xl bg-emerald-600 py-5 text-xl font-black text-white hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition"
            >
              {saving ? "MENYIMPAN..." : "SIMPAN PRESENSI"}
            </button>

            {(!photo || latitude === "-") && !saving && (
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

function Info({ label, value }) {
  return (
    <div className="rounded-xl bg-white/10 p-4">
      <p className="text-xs uppercase tracking-wider text-blue-200">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

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
