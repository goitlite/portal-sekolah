"use client";

import { useState, useEffect, useRef } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { getBiodataSiswa } from "../lib/api";
import { LOGO_SEKOLAH_BASE64 } from "./logoBase64";

// Mapping singkatan konsentrasi keahlian SMKN 1 Teluk Kuantan
const JURUSAN_MAP = {
  RPL: "Rekayasa Perangkat Lunak",
  PPLG: "Pengembangan Perangkat Lunak & Gim",
  TKJ: "Teknik Komputer & Jaringan",
  TJKT: "Teknik Jaringan Komputer & Telekomunikasi",
  DKV: "Desain Komunikasi Visual",
  AKL: "Akuntansi & Keuangan Lembaga",
  AK: "Akuntansi & Keuangan Lembaga",
  MPLB: "Manajemen Perkantoran & Layanan Bisnis",
  OTKP: "Otomatisasi & Tata Kelola Perkantoran",
  BDP: "Bisnis Daring & Pemasaran",
  PM: "Pemasaran / Bisnis Digital",
  TBSM: "Teknik & Bisnis Sepeda Motor",
  TSM: "Teknik Sepeda Motor",
  TKRO: "Teknik Kendaraan Ringan Otomotif",
  TKR: "Teknik Kendaraan Ringan",
  TITL: "Teknik Instalasi Tenaga Listrik",
};

function formatNamaJurusanResmi(raw) {
  if (!raw) return "-";
  const trimmed = String(raw).trim();
  const upper = trimmed.toUpperCase();

  if (JURUSAN_MAP[upper]) {
    return JURUSAN_MAP[upper];
  }

  for (const [key, val] of Object.entries(JURUSAN_MAP)) {
    const regex = new RegExp(`\\b${key}\\b`, "i");
    if (regex.test(trimmed)) {
      return val;
    }
  }

  return trimmed;
}

/**
 * Memisahkan nama siswa dan konsentrasi keahlian yang tercantum di format belakang nama.
 */
function pisahkanNamaDanJurusan(namaRaw, kelasRaw, jurusanFallback) {
  if (!namaRaw || typeof namaRaw !== "string") {
    return {
      namaSiswaTampil: namaRaw || "Siswa",
      konsentrasiKeahlian: formatNamaJurusanResmi(jurusanFallback || kelasRaw || "-"),
    };
  }

  const str = namaRaw.trim();
  let extracted = "";
  let cleanName = str;

  // 1. Format dalam kurung di akhir: "Nama (Jurusan)"
  const parenMatch = str.match(/\(([^)]+)\)\s*$/);
  if (parenMatch && parenMatch[1]) {
    extracted = parenMatch[1].trim();
    cleanName = str.replace(/\s*\([^)]+\)\s*$/, "").trim();
  }
  // 2. Format kurung siku di akhir: "Nama [Jurusan]"
  else if (str.match(/\[([^\]]+)\]\s*$/)) {
    const squareMatch = str.match(/\[([^\]]+)\]\s*$/);
    if (squareMatch && squareMatch[1]) {
      extracted = squareMatch[1].trim();
      cleanName = str.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
    }
  }
  // 3. Format strip di akhir: "Nama - Jurusan"
  else if (str.includes(" - ")) {
    const parts = str.split(" - ");
    if (parts.length >= 2) {
      extracted = parts[parts.length - 1].trim();
      cleanName = parts.slice(0, -1).join(" - ").trim();
    }
  }
  // 4. Format slash di akhir: "Nama / Jurusan"
  else if (str.includes(" / ")) {
    const parts = str.split(" / ");
    if (parts.length >= 2) {
      extracted = parts[parts.length - 1].trim();
      cleanName = parts.slice(0, -1).join(" / ").trim();
    }
  }

  if (!extracted) {
    extracted = jurusanFallback || kelasRaw || "-";
  }

  return {
    namaSiswaTampil: cleanName || str,
    konsentrasiKeahlian: formatNamaJurusanResmi(extracted),
  };
}

function isValidPhotoUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed.toLowerCase() === "null" ||
    trimmed.toLowerCase() === "undefined" ||
    trimmed.toLowerCase().includes("tidak ada")
  ) {
    return false;
  }
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:image/")
  );
}

/**
 * PURE HTML5 CANVAS GENERATOR (100% BEBAS DARI ERROR DOM/CORS/FONT)
 * Menggambar kartu ID Card CR80 (860 x 540 px, 300 DPI HD)
 */
function generateCardCanvas({
  nama,
  idSiswa,
  kelas,
  jurusan,
  noHp,
  qrDataUrl,
  logoBase64,
  photoUrl,
}) {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      const W = 860;
      const H = 540;
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");

      // 1. Background Kartu Putih Bersih
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);

      // 2. Header Kop Gradasi Deep Navy
      const grad = ctx.createLinearGradient(0, 0, W, 0);
      grad.addColorStop(0, "#1e3a8a");
      grad.addColorStop(0.5, "#1e40af");
      grad.addColorStop(1, "#0f172a");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, 90);

      // Garis Aksen Emas
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(0, 90, W, 6);

      // 3. Teks Kop Sekolah
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 23px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("SMKN 1 TELUK KUANTAN", 106, 44);

      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 14.5px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("KARTU PRESENSI KEHADIRAN SISWA", 106, 72);

      // 4. Badge Kelas (Kanan Kop)
      const badgeW = 160;
      const badgeH = 44;
      const badgeX = W - badgeW - 25;
      const badgeY = 23;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(badgeX, badgeY, badgeW, badgeH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 17px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(kelas || "-", badgeX + badgeW / 2, badgeY + 28);
      ctx.textAlign = "left";

      // 5. Kotak Pas Foto 3x4 (Kiri)
      const photoX = 35;
      const photoY = 125;
      const photoW = 180;
      const photoH = 240;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(photoX, photoY, photoW, photoH);
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]); // Garis putus-putus resmi area foto
      ctx.strokeRect(photoX, photoY, photoW, photoH);
      ctx.setLineDash([]); // Reset dash

      // Model Gambar Pas Foto Kosong (Siluet Elegan)
      ctx.fillStyle = "#e2e8f0";
      ctx.beginPath();
      ctx.arc(photoX + photoW / 2, photoY + 95, 42, 0, Math.PI * 2);
      ctx.fill();

      // Siluet Kepala & Bahu
      ctx.fillStyle = "#94a3b8";
      ctx.beginPath();
      ctx.arc(photoX + photoW / 2, photoY + 85, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(photoX + photoW / 2, photoY + 130, 28, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#475569";
      ctx.font = "bold 15px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("PAS FOTO", photoX + photoW / 2, photoY + 185);

      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("3 × 4 CM", photoX + photoW / 2, photoY + 210);
      ctx.textAlign = "left";

      // 6. Biodata Siswa (Tengah)
      const bioX = 245;

      // Nama Siswa
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("NAMA LENGKAP", bioX, 142);
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 20px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      const maxNamaW = 340;
      let namaTrunc = (nama || "SISWA").toUpperCase();
      if (ctx.measureText(namaTrunc).width > maxNamaW) {
        ctx.font = "bold 17px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      }
      ctx.fillText(namaTrunc, bioX, 170);

      // Nomor Induk / ID
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("NOMOR INDUK / ID", bioX, 206);
      ctx.fillStyle = "#1e3a8a";
      ctx.font = "bold 18px monospace";
      ctx.fillText(idSiswa || "-", bioX, 230);

      // Konsentrasi Keahlian
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("KONSENTRASI KEAHLIAN", bioX, 268);
      ctx.fillStyle = "#0369a1";
      ctx.font = "bold 17px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(jurusan || "-", bioX, 293);

      // No HP
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("NO. KONTAK / HP", bioX, 330);
      ctx.fillStyle = "#475569";
      ctx.font = "600 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText(noHp || "-", bioX, 354);

      // 7. Area QR Code (Kanan)
      const qrBoxX = 615;
      const qrBoxY = 125;
      const qrBoxW = 210;
      const qrBoxH = 240;

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);

      // Teks ID Siswa di bawah QR
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 17px monospace";
      ctx.textAlign = "center";
      ctx.fillText(idSiswa || "-", qrBoxX + qrBoxW / 2, qrBoxY + 195);

      ctx.fillStyle = "#64748b";
      ctx.font = "bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("SCAN PRESENSI", qrBoxX + qrBoxW / 2, qrBoxY + 220);
      ctx.textAlign = "left";

      // 8. Footer Kartu
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 485, W, 55);
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 485, W, 1.5);

      ctx.fillStyle = "#475569";
      ctx.font = "bold 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.fillText("Resmi SMKN 1 Teluk Kuantan", 35, 520);

      ctx.font = "italic 13px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText("Wajib dibawa setiap hari sekolah", W - 35, 520);
      ctx.textAlign = "left";

      // 9. Load dan Render Logo Sekolah & QR Code
      const logoImg = new Image();
      const qrImg = new Image();
      let loaded = 0;
      const targetLoads = (photoUrl ? 1 : 0) + 2;

      function onResourceLoaded() {
        loaded++;
        if (loaded >= targetLoads) {
          resolve(canvas);
        }
      }

      logoImg.onload = () => {
        // Kotak putih pelindung logo sekolah
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(24, 13, 64, 64);
        ctx.drawImage(logoImg, 26, 15, 60, 60);
        onResourceLoaded();
      };
      logoImg.onerror = () => onResourceLoaded();

      qrImg.onload = () => {
        // Gambar QR Code tajam
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(qrBoxX + 25, qrBoxY + 15, 160, 160);
        ctx.drawImage(qrImg, qrBoxX + 25, qrBoxY + 15, 160, 160);
        onResourceLoaded();
      };
      qrImg.onerror = () => onResourceLoaded();

      logoImg.src = logoBase64;
      qrImg.src = qrDataUrl;

      // Jika ada foto siswa riil
      if (photoUrl) {
        const pImg = new Image();
        pImg.crossOrigin = "anonymous";
        pImg.onload = () => {
          ctx.drawImage(pImg, photoX, photoY, photoW, photoH);
          onResourceLoaded();
        };
        pImg.onerror = () => onResourceLoaded();
        pImg.src = photoUrl;
      }
    } catch (err) {
      reject(err);
    }
  });
}

export default function ModalKartuBarcodeSiswa({
  isOpen,
  onClose,
  user, // { id, nama, kelas, tempatMagang, ... }
  fotoTerbaru, // fallback foto dari riwayat presensi
}) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("");
  const [biodata, setBiodata] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef(null);

  // Payload unik resmi kartu presensi siswa
  const qrPayload = user?.id ? `PRESENSI-SMK1TK:${String(user.id).trim()}` : "";

  // 1. Generate QR Code tajam resolusi tinggi (Data URL lokal)
  useEffect(() => {
    if (!isOpen || !qrPayload) return;

    QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 1,
      color: {
        dark: "#0f172a",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error("Gagal generate QR Code:", err));
  }, [isOpen, qrPayload]);

  // 2. Ambil biodata tambahan (noHp, foto profil, dll)
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    let isMounted = true;

    getBiodataSiswa(user.id)
      .then((res) => {
        if (isMounted && res?.success && res?.data) {
          setBiodata(res.data);
        }
      })
      .catch((err) => {
        console.warn("Gagal memuat biodata tambahan:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id]);

  if (!isOpen || !user) return null;

  // Resolusi Foto: Cek apakah benar-benar ada foto valid
  const rawPhoto =
    biodata?.fotoProfil ||
    biodata?.foto ||
    fotoTerbaru ||
    user?.foto ||
    null;

  const hasPhoto = isValidPhotoUrl(rawPhoto);
  const studentPhoto = hasPhoto ? rawPhoto : null;

  const noHp = biodata?.noHp || biodata?.kontak || user?.noHp || "-";
  const idSiswa = String(user.id || "").trim();
  const rawNama = user.nama || "Siswa";
  const kelasSiswa = user.kelas || "-";

  // Ekstrak nama bersih dan konsentrasi keahlian dari format di belakang nama
  const { namaSiswaTampil, konsentrasiKeahlian } = pisahkanNamaDanJurusan(
    rawNama,
    kelasSiswa,
    user?.jurusan,
  );

  // 3. FUNGSI SIMPAN PDF MENGGUNAKAN PURE NATIVE CANVAS (100% BEBAS DARI ERROR DOM/CORS)
  const handleDownloadPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const canvas = await generateCardCanvas({
        nama: namaSiswaTampil,
        idSiswa,
        kelas: kelasSiswa,
        jurusan: konsentrasiKeahlian,
        noHp,
        qrDataUrl: qrCodeDataUrl,
        logoBase64: LOGO_SEKOLAH_BASE64,
        photoUrl: studentPhoto,
      });

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [86, 54], // Standar ID Card CR80 (86mm x 54mm)
      });

      pdf.addImage(imgData, "PNG", 0, 0, 86, 54);

      const safeName = (namaSiswaTampil || "Siswa").replace(/[^a-zA-Z0-9]/g, "_");
      const safeKelas = (kelasSiswa || "Kelas").replace(/[^a-zA-Z0-9]/g, "_");
      pdf.save(`Kartu_Presensi_${safeName}_${safeKelas}.pdf`);
    } catch (err) {
      console.error("Gagal export PDF:", err);
      alert("Gagal membuat file PDF. Silakan coba kembali.");
    } finally {
      setIsExporting(false);
    }
  };

  // 4. FUNGSI SIMPAN GAMBAR (PNG) MENGGUNAKAN PURE NATIVE CANVAS
  const handleDownloadPNG = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      const canvas = await generateCardCanvas({
        nama: namaSiswaTampil,
        idSiswa,
        kelas: kelasSiswa,
        jurusan: konsentrasiKeahlian,
        noHp,
        qrDataUrl: qrCodeDataUrl,
        logoBase64: LOGO_SEKOLAH_BASE64,
        photoUrl: studentPhoto,
      });

      const dataUrl = canvas.toDataURL("image/png");

      const safeName = (namaSiswaTampil || "Siswa").replace(/[^a-zA-Z0-9]/g, "_");
      const safeKelas = (kelasSiswa || "Kelas").replace(/[^a-zA-Z0-9]/g, "_");

      const link = document.createElement("a");
      link.download = `Kartu_Presensi_${safeName}_${safeKelas}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal simpan gambar PNG:", err);
      alert("Gagal menyimpan gambar PNG. Silakan gunakan tombol Simpan PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden my-auto">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-amber-400/20 text-amber-300 text-base">
              🪪
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black tracking-tight">
                Kartu Barcode Presensi Siswa
              </h3>
              <p className="text-[10px] sm:text-xs text-blue-200">
                Simpan file PDF atau Gambar untuk dipindai petugas presensi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* AREA KONTEN */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 bg-slate-50">
          {/* PETUNJUK RESMI */}
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-900">
            <span className="text-base shrink-0">📄</span>
            <div className="leading-relaxed">
              <span className="font-bold">Ketentuan Penggunaan:</span> Simpan kartu ini dalam format PDF untuk dicetak mandiri di selembar kertas, atau simpan sebagai gambar PNG di ponsel Anda.
            </div>
          </div>

          {/* ======================================================== */}
          {/* TAMPILAN PRATINJAU KARTU PRESENSI FISIK */}
          {/* ======================================================== */}
          <div className="flex justify-center">
            <div
              ref={cardRef}
              id="printable-presensi-card"
              className="w-full max-w-[480px] bg-white rounded-xl shadow-md border-2 border-slate-400 flex flex-col justify-between overflow-hidden select-none"
              style={{
                backgroundColor: "#ffffff",
                fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              }}
            >
              {/* KOP KARTU (HEADER UTUH DENGAN LOGO RESMI BASE64) */}
              <div
                style={{
                  background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #0f172a 100%)",
                  borderBottom: "3px solid #f59e0b",
                }}
                className="px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center justify-between text-white"
              >
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <div
                    style={{ backgroundColor: "#ffffff" }}
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg p-0.5 flex items-center justify-center shrink-0 shadow-xs"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={LOGO_SEKOLAH_BASE64}
                      alt="Logo SMKN 1 Teluk Kuantan"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[11px] sm:text-xs font-black tracking-wide uppercase text-white drop-shadow-xs">
                      SMKN 1 TELUK KUANTAN
                    </div>
                    <div
                      style={{ color: "#fbbf24" }}
                      className="text-[7.5px] sm:text-[8.5px] font-black tracking-wider uppercase mt-0.5"
                    >
                      KARTU PRESENSI KEHADIRAN SISWA
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: "rgba(15, 23, 42, 0.9)",
                    borderColor: "rgba(56, 189, 248, 0.6)",
                    color: "#ffffff",
                  }}
                  className="text-[8.5px] sm:text-[9.5px] font-black px-2.5 py-1 rounded-md border shadow-2xs shrink-0"
                >
                  {kelasSiswa}
                </div>
              </div>

              {/* ISI KARTU: FOTO / MODEL KOSONG + BIODATA + QR CODE */}
              <div className="p-3 sm:p-4 grid grid-cols-12 gap-2.5 sm:gap-3.5 items-center bg-white">
                {/* 1. FOTO SISWA ATAU MODEL GAMBAR KOSONG (3 Kolom) */}
                <div className="col-span-3 flex flex-col items-center">
                  <div
                    style={{
                      borderColor: "#cbd5e1",
                      backgroundColor: "#f8fafc",
                    }}
                    className="w-18 h-22 sm:w-22 sm:h-26 rounded-lg border-2 overflow-hidden relative shadow-2xs flex items-center justify-center"
                  >
                    {studentPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={studentPhoto}
                        alt={namaSiswaTampil}
                        crossOrigin="anonymous"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      // MODEL GAMBAR KOSONG (PAS FOTO 3x4) RESMI
                      <div
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1.5px dashed #94a3b8",
                        }}
                        className="w-full h-full rounded-md flex flex-col items-center justify-center p-1 text-center select-none"
                      >
                        <div
                          style={{
                            backgroundColor: "#e2e8f0",
                            borderColor: "#cbd5e1",
                          }}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border mb-1 shadow-2xs"
                        >
                          <svg
                            className="w-5 h-5 text-slate-400"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                          </svg>
                        </div>
                        <span
                          style={{ color: "#475569" }}
                          className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-wider leading-none"
                        >
                          PAS FOTO
                        </span>
                        <span
                          style={{ color: "#94a3b8" }}
                          className="text-[6px] sm:text-[6.5px] font-bold mt-0.5"
                        >
                          3 × 4 CM
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. BIODATA SISWA (5 Kolom) */}
                <div className="col-span-5 space-y-1 sm:space-y-1.5 text-slate-800 pr-1">
                  <div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                      Nama Siswa
                    </div>
                    <div
                      style={{ color: "#0f172a" }}
                      className="text-[10.5px] sm:text-xs font-black leading-tight line-clamp-2 uppercase"
                    >
                      {namaSiswaTampil}
                    </div>
                  </div>

                  <div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                      Nomor Induk / ID
                    </div>
                    <div
                      style={{ color: "#1e3a8a" }}
                      className="text-[9px] sm:text-[10px] font-mono font-bold"
                    >
                      {idSiswa || "-"}
                    </div>
                  </div>

                  <div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                      Konsentrasi Keahlian
                    </div>
                    <div
                      style={{ color: "#0369a1" }}
                      className="text-[8.5px] sm:text-[9.5px] font-black leading-tight line-clamp-2"
                    >
                      {konsentrasiKeahlian}
                    </div>
                  </div>

                  <div>
                    <div className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">
                      No. Kontak / HP
                    </div>
                    <div
                      style={{ color: "#475569" }}
                      className="text-[8px] sm:text-[9px] font-semibold"
                    >
                      {noHp}
                    </div>
                  </div>
                </div>

                {/* 3. BARCODE / QR CODE (4 Kolom) */}
                <div
                  style={{
                    backgroundColor: "#f8fafc",
                    borderColor: "#e2e8f0",
                  }}
                  className="col-span-4 flex flex-col items-center justify-center p-2 rounded-lg border"
                >
                  <div
                    style={{
                      backgroundColor: "#ffffff",
                      borderColor: "#cbd5e1",
                    }}
                    className="w-18 h-18 sm:w-22 sm:h-22 p-1 rounded-md border shadow-2xs flex items-center justify-center"
                  >
                    {qrCodeDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrCodeDataUrl}
                        alt={`QR Code ${idSiswa}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] text-slate-400 font-medium">
                        Memuat QR...
                      </div>
                    )}
                  </div>
                  <div
                    style={{ color: "#0f172a" }}
                    className="mt-1 text-[8.5px] sm:text-[9.5px] font-mono font-black tracking-wider"
                  >
                    {idSiswa}
                  </div>
                  <div
                    style={{ color: "#64748b" }}
                    className="text-[6.5px] font-bold uppercase tracking-tight"
                  >
                    SCAN PRESENSI
                  </div>
                </div>
              </div>

              {/* FOOTER KARTU */}
              <div
                style={{
                  backgroundColor: "#f8fafc",
                  borderTop: "1px solid #e2e8f0",
                  color: "#64748b",
                }}
                className="px-3.5 py-1.5 flex items-center justify-between text-[7px] sm:text-[7.5px]"
              >
                <span className="font-bold text-slate-700">
                  Resmi SMKN 1 Teluk Kuantan
                </span>
                <span className="italic font-medium">
                  Wajib dibawa setiap hari sekolah
                </span>
              </div>
            </div>
          </div>

          {/* ======================================================== */}
          {/* TOMBOL AKSI: DOWNLOAD PDF & PNG */}
          {/* ======================================================== */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
            <button
              onClick={handleDownloadPNG}
              disabled={isExporting}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>🖼️</span>
              <span>Simpan Gambar (PNG)</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={isExporting}
              className="w-full sm:w-auto px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{isExporting ? "⏳" : "📥"}</span>
              <span>{isExporting ? "Membuat PDF..." : "Simpan PDF"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
