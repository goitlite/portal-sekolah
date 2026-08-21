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
  const [modeFoto, setModeFoto] = useState("kamera"); // State baru: 'kamera' atau 'upload'
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

    // Cleanup kamera saat halaman ditutup
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

        // Format waktu
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

        // Box latar belakang watermark responsif menyesuaikan ukuran foto
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

        // Teks Identitas
        ctx.fillStyle = "#FFFFFF";

        // Header
        ctx.font = `bold ${baseFontSize * 1.2}px Arial`;
        ctx.fillText("JURNAL GURU WALI", boxX + 20, boxY + baseFontSize * 1.5);

        // Teks Biasa
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

  // --- Fungsi Upload dari Galeri ---
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

  // --- Fungsi Toggle Mode Foto ---
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
    setPhoto(""); // Reset foto saat berpindah tab
    if (mode === "kamera") {
      startKamera();
    } else {
      hentikanKamera(); // Matikan kamera jika pindah ke mode upload
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
        setMessage("✅ Jurnal berhasil disimpan.");
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

        // Reset Foto
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
    <main
      style={{ minHeight: "100vh", background: "#f5f7fb", padding: "24px" }}
    >
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        {/* HEADER */}
        <div
          style={{
            background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
            color: "white",
            padding: "24px",
            borderRadius: "18px",
            marginBottom: "20px",
            position: "relative",
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (window.history.length > 1) router.back();
              else router.push("/magang/guru/guru-wali");
            }}
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: "10px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.12)",
              color: "white",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⬅️ Kembali
          </button>
          <h1 style={{ margin: 0, fontSize: "25px", paddingRight: "100px" }}>
            📘 Jurnal Guru Wali
          </h1>
          <p style={{ margin: "8px 0 0", opacity: 0.9 }}>
            Dokumentasi kegiatan dan pembinaan siswa wali
          </p>
        </div>

        {/* FORM */}
        <form
          onSubmit={handleSubmit}
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "18px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
          }}
        >
          {/* IDENTITAS */}
          <div
            style={{ marginBottom: "18px", fontSize: "13px", color: "#64748b" }}
          >
            <span>Guru Wali:</span>
            <strong style={{ marginLeft: "6px", color: "#1e293b" }}>
              {namaGuru || "-"}
            </strong>
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label>
              <strong>Format Pertemuan</strong>
            </label>
            <select
              value={formatPertemuan}
              onChange={handleFormatChange}
              style={inputStyle}
            >
              <option value="Individu">Individu</option>
              <option value="Kelompok">Kelompok</option>
            </select>
          </div>

          {/* INDIVIDU / KELOMPOK SELECTOR */}
          {formatPertemuan === "Individu" && (
            <>
              <div style={{ marginBottom: "18px" }}>
                <label>
                  <strong>Siswa</strong>
                </label>
                <select
                  value={idSiswa}
                  onChange={handlePilihSiswa}
                  disabled={loadingSiswa}
                  style={inputStyle}
                >
                  <option value="">
                    {loadingSiswa ? "Memuat siswa..." : "Pilih siswa"}
                  </option>
                  {siswa.map((item, index) => (
                    <option key={item.idSiswa || index} value={item.idSiswa}>
                      {parseNamaKelas(item.nama).nama} {" ["}
                      {parseNamaKelas(item.nama).kelas}
                      {"]"}
                    </option>
                  ))}
                </select>
              </div>
              {idSiswa && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "12px",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <label>
                      <strong>Nama</strong>
                    </label>
                    <input
                      value={namaSiswa}
                      readOnly
                      style={{ ...inputStyle, background: "#f3f4f6" }}
                    />
                  </div>
                  <div>
                    <label>
                      <strong>Kelas</strong>
                    </label>
                    <input
                      value={kelas}
                      readOnly
                      style={{ ...inputStyle, background: "#f3f4f6" }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {formatPertemuan === "Kelompok" && (
            <div style={{ marginBottom: "20px" }}>
              <label>
                <strong>Siswa yang Mengikuti Pertemuan</strong>
              </label>
              <div
                style={{
                  marginTop: "8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                {siswaKelompok.length === 0 ? (
                  <div
                    style={{
                      padding: "18px",
                      color: "#64748b",
                      textAlign: "center",
                    }}
                  >
                    Tidak ada siswa.
                  </div>
                ) : (
                  siswaKelompok.map((item, index) => {
                    const identitas = parseNamaKelas(item.nama);
                    return (
                      <div
                        key={item.idSiswa || index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "11px 13px",
                          borderBottom:
                            index < siswaKelompok.length - 1
                              ? "1px solid #e2e8f0"
                              : "none",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: "#1e293b" }}>
                            {identitas.nama}
                          </div>
                          <div style={{ fontSize: "12px", color: "#64748b" }}>
                            Kelas: {identitas.kelas || "-"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => hapusSiswaKelompok(item.idSiswa)}
                          style={{
                            width: "34px",
                            height: "34px",
                            border: "none",
                            borderRadius: "50%",
                            background: "#fee2e2",
                            color: "#dc2626",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
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

          <div style={{ marginBottom: "18px" }}>
            <label>
              <strong>Tanggal Pertemuan</strong>
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label>
              <strong>Topik / Masalah</strong>
            </label>
            <textarea
              value={topik}
              onChange={(e) => setTopik(e.target.value)}
              rows={3}
              placeholder="Tuliskan topik pembahasan..."
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "18px" }}>
            <label>
              <strong>Tindak Lanjut</strong>
            </label>
            <textarea
              value={tindakLanjut}
              onChange={(e) => setTindakLanjut(e.target.value)}
              rows={2}
              placeholder="Tuliskan tindak lanjut..."
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: "22px" }}>
            <label>
              <strong>Keterangan</strong>
            </label>
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={2}
              style={inputStyle}
            />
          </div>

          {/* =================================================
              TOGGLE & UI KAMERA + UPLOAD FILE
          ================================================= */}
          <div
            style={{
              marginBottom: "24px",
              padding: "16px",
              borderRadius: "12px",
              border: "1px dashed #cbd5e1",
              background: "#f8fafc",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                fontWeight: "bold",
                color: "#334155",
              }}
            >
              <input
                type="checkbox"
                checked={opsiFoto}
                onChange={handleToggleFoto}
                style={{ marginRight: "10px", width: "18px", height: "18px" }}
              />
              📷 Sertakan Bukti Foto (Opsional)
            </label>

            {opsiFoto && (
              <div style={{ marginTop: "16px" }}>
                {/* TAB SELECTOR: KAMERA vs UPLOAD */}
                <div
                  style={{ display: "flex", gap: "10px", marginBottom: "16px" }}
                >
                  <button
                    type="button"
                    onClick={() => ubahModeFoto("kamera")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border:
                        modeFoto === "kamera"
                          ? "2px solid #2563eb"
                          : "1px solid #cbd5e1",
                      background: modeFoto === "kamera" ? "#eff6ff" : "white",
                      color: modeFoto === "kamera" ? "#2563eb" : "#64748b",
                      fontWeight: "bold",
                      cursor: "pointer",
                      transition: "0.2s",
                    }}
                  >
                    📸 Kamera
                  </button>
                  <button
                    type="button"
                    onClick={() => ubahModeFoto("upload")}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "8px",
                      border:
                        modeFoto === "upload"
                          ? "2px solid #2563eb"
                          : "1px solid #cbd5e1",
                      background: modeFoto === "upload" ? "#eff6ff" : "white",
                      color: modeFoto === "upload" ? "#2563eb" : "#64748b",
                      fontWeight: "bold",
                      cursor: "pointer",
                      transition: "0.2s",
                    }}
                  >
                    📁 Unggah File
                  </button>
                </div>

                {/* CONTAINER PREVIEW / INPUT */}
                <div
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    borderRadius: "12px",
                    background:
                      modeFoto === "kamera" && !photo ? "#0f172a" : "#f1f5f9",
                    aspectRatio:
                      modeFoto === "kamera" && !photo ? "4/3" : "auto",
                    width: "100%",
                    border: "1px solid #cbd5e1",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {modeFoto === "kamera" ? (
                    // --- TAMPILAN KAMERA ---
                    !photo ? (
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          muted
                          playsInline
                          style={{
                            height: "100%",
                            width: "100%",
                            objectFit: "cover",
                          }}
                        />
                        {!cameraReady && (
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "rgba(15,23,42,0.9)",
                              color: "white",
                            }}
                          >
                            <button
                              type="button"
                              onClick={startKamera}
                              style={{
                                padding: "10px 20px",
                                borderRadius: "8px",
                                background: "#2563eb",
                                color: "white",
                                border: "none",
                                fontWeight: "bold",
                                cursor: "pointer",
                              }}
                            >
                              Ketuk untuk Aktifkan Kamera Belakang
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <img
                        src={photo}
                        alt="Hasil Kamera"
                        style={{
                          width: "100%",
                          height: "auto",
                          display: "block",
                        }}
                      />
                    )
                  ) : // --- TAMPILAN UPLOAD ---
                  !photo ? (
                    <div
                      style={{
                        width: "100%",
                        padding: "40px 20px",
                        textAlign: "center",
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadFile}
                        id="file-upload"
                        style={{ display: "none" }}
                      />
                      <label
                        htmlFor="file-upload"
                        style={{
                          display: "inline-block",
                          padding: "14px 28px",
                          background: "#10b981",
                          color: "white",
                          borderRadius: "10px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          boxShadow: "0 4px 6px rgba(16, 185, 129, 0.2)",
                        }}
                      >
                        Pilih Foto dari Galeri
                      </label>
                      <p
                        style={{
                          marginTop: "12px",
                          fontSize: "13px",
                          color: "#64748b",
                        }}
                      >
                        Format: JPG, PNG
                      </p>
                    </div>
                  ) : (
                    <img
                      src={photo}
                      alt="Hasil Upload"
                      style={{
                        width: "100%",
                        height: "auto",
                        display: "block",
                      }}
                    />
                  )}

                  {/* Canvas hidden untuk render gambar dan watermark */}
                  <canvas ref={canvasRef} style={{ display: "none" }} />
                  <canvas
                    ref={watermarkCanvasRef}
                    style={{ display: "none" }}
                  />
                </div>

                {/* TOMBOL AKSI BAWAH */}
                {modeFoto === "kamera" && (
                  <button
                    type="button"
                    onClick={ambilFoto}
                    disabled={!cameraReady && !photo}
                    style={{
                      marginTop: "12px",
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: photo ? "#f59e0b" : "#2563eb",
                      color: "white",
                      fontWeight: "bold",
                      cursor:
                        !cameraReady && !photo ? "not-allowed" : "pointer",
                    }}
                  >
                    {photo ? "🔄 Ulangi Foto" : "📸 Ambil Foto Bukti"}
                  </button>
                )}

                {modeFoto === "upload" && photo && (
                  <button
                    type="button"
                    onClick={() => setPhoto("")}
                    style={{
                      marginTop: "12px",
                      width: "100%",
                      padding: "12px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#f59e0b",
                      color: "white",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    🔄 Ganti Foto
                  </button>
                )}
              </div>
            )}
          </div>

          {/* PESAN & TOMBOL SIMPAN */}
          {message && (
            <div
              style={{
                padding: "12px 14px",
                marginBottom: "18px",
                borderRadius: "10px",
                background: messageType === "success" ? "#dcfce7" : "#fee2e2",
                color: messageType === "success" ? "#166534" : "#991b1b",
              }}
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || loadingSiswa || (opsiFoto && !photo)}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              background:
                loading || loadingSiswa || (opsiFoto && !photo)
                  ? "#94a3b8"
                  : "#2563eb",
              color: "white",
              fontSize: "16px",
              fontWeight: 600,
              cursor:
                loading || loadingSiswa || (opsiFoto && !photo)
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {loading ? "Menyimpan Data & Foto..." : "💾 Simpan Jurnal"}
          </button>
        </form>
      </div>
    </main>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px 12px",
  marginTop: "6px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  fontSize: "14px",
  outline: "none",
  fontFamily: "inherit",
};
