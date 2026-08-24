"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "../../../lib/auth";
import { getDataSiswaWali, saveJurnalGuruWali } from "../../../lib/api";

export default function JurnalGuruWaliPage() {
  const router = useRouter();

  // State Identitas
  const [idGuru, setIdGuru] = useState("");
  const [namaGuru, setNamaGuru] = useState("");
  const [siswa, setSiswa] = useState([]);

  // State Form
  const [idSiswa, setIdSiswa] = useState("");
  const [namaSiswa, setNamaSiswa] = useState("");
  const [kelas, setKelas] = useState("");
  const [siswaKelompok, setSiswaKelompok] = useState([]);
  const [tanggal, setTanggal] = useState("");
  const [formatPertemuan, setFormatPertemuan] = useState("Individu");
  const [topik, setTopik] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [keterangan, setKeterangan] = useState("");

  // UI States
  const [loadingSiswa, setLoadingSiswa] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // =====================================================
  // STATE & REF BUKTI FOTO (KAMERA & UPLOAD)
  // =====================================================
  const [opsiFoto, setOpsiFoto] = useState(false);
  const [modeFoto, setModeFoto] = useState("kamera"); // 'kamera' atau 'upload'
  const [photo, setPhoto] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const watermarkCanvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setMessage("Sesi guru tidak ditemukan. Silakan login kembali.");
      setMessageType("error");
      setLoadingSiswa(false);
      return;
    }
    const id = session.idGuru || session.id || session.ID_GURU || "";
    if (!id) {
      setMessage("ID guru tidak ditemukan pada sesi login.");
      setMessageType("error");
      setLoadingSiswa(false);
      return;
    }
    const idGuruFinal = String(id).trim();
    setIdGuru(idGuruFinal);
    loadSiswa(idGuruFinal);

    return () => hentikanKamera();
  }, []);

  async function loadSiswa(idGuru) {
    try {
      setLoadingSiswa(true);
      const result = await getDataSiswaWali(idGuru);
      if (result && result.success && Array.isArray(result.data)) {
        setSiswa(result.data);
        if (result.data.length > 0) {
          setNamaGuru(String(result.data[0].namaGuru || "").trim());
        }
        setSiswaKelompok(result.data);
      } else {
        setSiswa([]);
        setSiswaKelompok([]);
        setMessage(result?.message || "Data siswa wali tidak ditemukan.");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Gagal mengambil data siswa.");
      setMessageType("error");
    } finally {
      setLoadingSiswa(false);
    }
  }

  function parseNamaKelas(namaLengkap) {
    const text = String(namaLengkap || "").trim();
    let nama = text;
    let kelasData = "";
    const match = text.match(/\s*\[([^\]]+)\]\s*$/);
    if (match) {
      kelasData = match[1].trim();
      nama = text.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
    }
    return { nama, kelas: kelasData };
  }

  function handlePilihSiswa(e) {
    const id = e.target.value;
    setIdSiswa(id);
    const data = siswa.find(
      (item) => String(item.idSiswa).trim() === String(id).trim(),
    );
    if (!data) {
      setNamaSiswa("");
      setKelas("");
      return;
    }
    const hasil = parseNamaKelas(data.nama);
    setNamaSiswa(hasil.nama);
    setKelas(hasil.kelas);
  }

  function handleFormatChange(e) {
    const format = e.target.value;
    setFormatPertemuan(format);
    if (format === "Kelompok") {
      setSiswaKelompok([...siswa]);
      setIdSiswa("");
      setNamaSiswa("");
      setKelas("");
    } else {
      setSiswaKelompok([]);
      setIdSiswa("");
      setNamaSiswa("");
      setKelas("");
    }
  }

  function hapusSiswaKelompok(idSiswa) {
    setSiswaKelompok((prev) =>
      prev.filter(
        (item) => String(item.idSiswa).trim() !== String(idSiswa).trim(),
      ),
    );
  }

  // =====================================================
  // LOGIKA KAMERA, UPLOAD & WATERMARK
  // =====================================================
  function hentikanKamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }

  async function startKamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert("Browser memblokir fitur kamera.");
      return;
    }
    hentikanKamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          await videoRef.current.play();
          setCameraReady(true);
        };
      }
    } catch (err) {
      alert("Kamera tidak dapat diakses.");
    }
  }

  function addWatermark(imageData) {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = watermarkCanvasRef.current;
        if (!canvas) return resolve(imageData);
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const now = new Date();
        const tanggalStr = now.toLocaleDateString("id-ID", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const jamStr = now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        const isLandscape = img.width > img.height;
        const baseFontSize = isLandscape
          ? Math.max(24, img.width / 40)
          : Math.max(24, img.width / 30);

        const boxH = baseFontSize * 5.5;
        const boxX = 20;
        const boxY = img.height - boxH - 20;
        const boxW = img.width - 40;

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(boxX, boxY, boxW, boxH);

        ctx.fillStyle = "#FFFFFF";

        ctx.font = `bold ${baseFontSize * 1.2}px Arial`;
        ctx.fillText("JURNAL GURU WALI", boxX + 20, boxY + baseFontSize * 1.5);

        ctx.font = `${baseFontSize * 0.9}px Arial`;
        ctx.fillText(`Guru : ${namaGuru}`, boxX + 20, boxY + baseFontSize * 3);
        ctx.fillText(
          `Topik : ${topik ? topik.substring(0, 30) + "..." : "Pembinaan Siswa"}`,
          boxX + 20,
          boxY + baseFontSize * 4,
        );
        ctx.fillText(
          `Waktu: ${tanggalStr} | ${jamStr} WIB`,
          boxX + 20,
          boxY + baseFontSize * 5,
        );

        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = imageData;
    });
  }

  async function ambilFoto() {
    if (photo) {
      setPhoto("");
      await startKamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState !== 4) {
      alert("Kamera belum siap.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const image = canvas.toDataURL("image/jpeg", 0.9);
    const watermarked = await addWatermark(image);
    setPhoto(watermarked);
    hentikanKamera();
  }

  function handleUploadFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Harap pilih file gambar yang valid (JPG/PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      const watermarked = await addWatermark(base64Data);
      setPhoto(watermarked);
    };
    reader.readAsDataURL(file);
  }

  function handleToggleFoto(e) {
    const isChecked = e.target.checked;
    setOpsiFoto(isChecked);
    if (!isChecked) {
      setPhoto("");
      hentikanKamera();
    } else {
      if (modeFoto === "kamera") startKamera();
    }
  }

  function ubahModeFoto(mode) {
    setModeFoto(mode);
    setPhoto("");
    if (mode === "kamera") {
      startKamera();
    } else {
      hentikanKamera();
    }
  }

  // =====================================================
  // SIMPAN JURNAL
  // =====================================================
  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    if (!idGuru) return showErr("ID guru tidak ditemukan.");
    if (formatPertemuan === "Individu" && !idSiswa)
      return showErr("Silakan pilih siswa.");
    if (formatPertemuan === "Kelompok" && siswaKelompok.length === 0)
      return showErr("Tidak ada siswa dalam kelompok.");
    if (!tanggal) return showErr("Tanggal pertemuan wajib diisi.");
    if (!topik.trim()) return showErr("Topik atau masalah wajib diisi.");
    if (opsiFoto && !photo)
      return showErr(
        "Opsi foto diaktifkan, silakan ambil gambar/unggah terlebih dahulu.",
      );

    let data = {
      idGuru,
      tanggal,
      formatPertemuan,
      topik: topik.trim(),
      tindakLanjut: tindakLanjut.trim(),
      keterangan: keterangan.trim(),
      fotoUrl: opsiFoto ? photo : "",
      fotoId: "",
    };

    if (formatPertemuan === "Individu") {
      data.idSiswa = idSiswa;
    } else {
      data.idSiswaList = siswaKelompok.map((item) => item.idSiswa);
    }

    try {
      setLoading(true);
      const result = await saveJurnalGuruWali(data);

      if (result?.success) {
        setMessage("Jurnal berhasil disimpan.");
        setMessageType("success");
        setTanggal("");
        setTopik("");
        setTindakLanjut("");
        setKeterangan("");
        setIdSiswa("");
        setNamaSiswa("");
        setKelas("");
        setFormatPertemuan("Individu");
        setSiswaKelompok([]);

        setOpsiFoto(false);
        setPhoto("");
        hentikanKamera();
      } else {
        showErr(result?.message || "Jurnal gagal disimpan.");
      }
    } catch (error) {
      showErr("Terjadi kesalahan saat menyimpan jurnal.");
    } finally {
      setLoading(false);
    }
  }

  function showErr(msg) {
    setMessage(msg);
    setMessageType("error");
  }

  return (
    <main className="min-h-screen bg-slate-50/60 py-6 sm:py-10 px-4 sm:px-6 lg:px-8 font-sans text-slate-800">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* HEADER */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 sm:p-8 text-white shadow-xl shadow-blue-500/10">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl shadow-inner backdrop-blur-md">
                📘
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">
                  Jurnal Guru Wali
                </h1>
                <p className="mt-0.5 text-xs sm:text-sm text-blue-100/90 font-medium">
                  Dokumentasi kegiatan dan pembinaan siswa bimbingan
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (window.history.length > 1) router.back();
                else router.push("/magang/guru/guru-wali");
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
                />
              </svg>
              <span>Kembali</span>
            </button>
          </div>
        </div>

        {/* IDENTITAS GURU WALI CARD */}
        <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-bold text-sm">
              👨‍🏫
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Guru Wali Bimbingan
              </span>
              <p className="text-sm sm:text-base font-bold text-slate-800">
                {namaGuru || "-"}
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-100">
            ID: {idGuru || "-"}
          </span>
        </div>

        {/* FORM UTAMA */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-8 shadow-sm space-y-6"
        >
          {/* FORMAT PERTEMUAN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Format Pertemuan <span className="text-rose-500">*</span>
            </label>
            <select
              value={formatPertemuan}
              onChange={handleFormatChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="Individu">Individu (1 Siswa)</option>
              <option value="Kelompok">Kelompok (Banyak Siswa)</option>
            </select>
          </div>

          {/* INDIVIDU SELECTOR */}
          {formatPertemuan === "Individu" && (
            <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50/40 p-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Pilih Siswa <span className="text-rose-500">*</span>
                </label>
                <select
                  value={idSiswa}
                  onChange={handlePilihSiswa}
                  disabled={loadingSiswa}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-60"
                >
                  <option value="">
                    {loadingSiswa
                      ? "Memuat daftar siswa..."
                      : "-- Pilih Siswa Wali --"}
                  </option>
                  {siswa.map((item, index) => {
                    const parsed = parseNamaKelas(item.nama);
                    return (
                      <option key={item.idSiswa || index} value={item.idSiswa}>
                        {parsed.nama} {parsed.kelas ? `[${parsed.kelas}]` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {idSiswa && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Nama Siswa
                    </label>
                    <input
                      value={namaSiswa}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Kelas
                    </label>
                    <input
                      value={kelas || "-"}
                      readOnly
                      className="w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* KELOMPOK SELECTOR */}
          {formatPertemuan === "Kelompok" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Daftar Siswa Peserta Kelompok
                </label>
                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  {siswaKelompok.length} Siswa
                </span>
              </div>

              <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {siswaKelompok.length === 0 ? (
                  <div className="p-6 text-center text-xs font-medium text-slate-400">
                    Tidak ada siswa terpilih dalam kelompok ini.
                  </div>
                ) : (
                  siswaKelompok.map((item, index) => {
                    const identitas = parseNamaKelas(item.nama);
                    return (
                      <div
                        key={item.idSiswa || index}
                        className="flex items-center justify-between p-3.5 transition-colors hover:bg-slate-50/80"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                            {index + 1}
                          </div>
                          <div>
                            <p className="text-xs sm:text-sm font-bold text-slate-800">
                              {identitas.nama}
                            </p>
                            <p className="text-[11px] font-medium text-slate-400">
                              Kelas: {identitas.kelas || "-"}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => hapusSiswaKelompok(item.idSiswa)}
                          title="Hapus siswa dari kelompok"
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TANGGAL PERTEMUAN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Tanggal Pertemuan <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* TOPIK / MASALAH */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Topik / Masalah Bimbingan <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={topik}
              onChange={(e) => setTopik(e.target.value)}
              rows={3}
              placeholder="Tuliskan topik atau masalah yang dibahas..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* TINDAK LANJUT */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Rencana Tindak Lanjut
            </label>
            <textarea
              value={tindakLanjut}
              onChange={(e) => setTindakLanjut(e.target.value)}
              rows={2}
              placeholder="Tuliskan rencana atau arahan tindak lanjut..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* KETERANGAN */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Keterangan Tambahan
            </label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={2}
              placeholder="Tambahkan catatan atau keterangan lain jika ada..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* OPSI BUKTI FOTO */}
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4 sm:p-5">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={opsiFoto}
                onChange={handleToggleFoto}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-bold text-slate-800">
                📷 Lampirkan Bukti Foto Kegiatan (Opsional)
              </span>
            </label>

            {opsiFoto && (
              <div className="mt-4 space-y-4 pt-2">
                {/* TAB KAMERA / UPLOAD */}
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-200/60 p-1">
                  <button
                    type="button"
                    onClick={() => ubahModeFoto("kamera")}
                    className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-bold transition-all ${
                      modeFoto === "kamera"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    📸 Pakai Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => ubahModeFoto("upload")}
                    className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-bold transition-all ${
                      modeFoto === "upload"
                        ? "bg-white text-blue-600 shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    📁 Unggah File
                  </button>
                </div>

                {/* AREA TAMPILAN KAMERA / UPLOAD */}
                <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-900 min-h-[220px] flex items-center justify-center">
                  {modeFoto === "kamera" ? (
                    !photo ? (
                      <div className="relative w-full aspect-[4/3] flex items-center justify-center bg-slate-950">
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          className="h-full w-full object-cover"
                        />
                        {!cameraReady && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 p-4 text-center">
                            <button
                              type="button"
                              onClick={startKamera}
                              className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-500/30 transition-all hover:bg-blue-500 active:scale-95"
                            >
                              Aktifkan Kamera
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <img
                        src={photo}
                        alt="Hasil Kamera"
                        className="w-full h-auto object-cover"
                      />
                    )
                  ) : !photo ? (
                    <div className="w-full py-8 text-center bg-white border border-dashed border-slate-300 rounded-xl">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadFile}
                        id="file-upload"
                        className="hidden"
                      />
                      <label
                        htmlFor="file-upload"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                          />
                        </svg>
                        <span>Pilih Foto dari Galeri</span>
                      </label>
                      <p className="mt-2 text-[11px] font-medium text-slate-400">
                        Format didukung: JPG, PNG
                      </p>
                    </div>
                  ) : (
                    <img
                      src={photo}
                      alt="Hasil Upload"
                      className="w-full h-auto object-cover"
                    />
                  )}

                  {/* Canvas tersembunyi untuk pemrosesan watermark */}
                  <canvas ref={canvasRef} className="hidden" />
                  <canvas ref={watermarkCanvasRef} className="hidden" />
                </div>

                {/* TOMBOL AKSI FOTO */}
                {modeFoto === "kamera" && (
                  <button
                    type="button"
                    onClick={ambilFoto}
                    disabled={!cameraReady && !photo}
                    className={`w-full rounded-xl py-3 text-xs font-bold text-white shadow-md transition-all active:scale-98 ${
                      photo
                        ? "bg-amber-500 hover:bg-amber-600 shadow-amber-500/20"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {photo ? "🔄 Ulangi Ambil Foto" : "📸 Ambil Foto Bukti"}
                  </button>
                )}

                {modeFoto === "upload" && photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto("")}
                    className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 py-3 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition-all active:scale-98"
                  >
                    🔄 Ganti File Foto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* PESAN FEEDBACK */}
          {message && (
            <div
              className={`flex items-center gap-2 rounded-xl p-4 text-xs font-bold border ${
                messageType === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              <span>{messageType === "success" ? "✅" : "⚠️"}</span>
              <span>{message}</span>
            </div>
          )}

          {/* TOMBOL SIMPAN */}
          <button
            type="submit"
            disabled={loading || loadingSiswa || (opsiFoto && !photo)}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {loading
              ? "Menyimpan Jurnal & Foto..."
              : "💾 Simpan Jurnal Bimbingan"}
          </button>
        </form>
      </div>
    </main>
  );
}
