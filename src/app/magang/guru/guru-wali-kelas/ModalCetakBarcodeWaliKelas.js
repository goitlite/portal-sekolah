"use client";

import React, { useState, useEffect, useMemo } from "react";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { getPresensiWaliGrid, getBiodataSiswa } from "../../lib/api";
import { LOGO_SEKOLAH_BASE64 } from "../../dashboard_siswa/logoBase64";

// ============================================================
// HELPER NAMA JURUSAN RESMI & PARSER
// ============================================================
function formatNamaJurusanResmi(str) {
  if (!str) return "SMKN 1 TELUK KUANTAN";
  const s = String(str).toUpperCase().trim();

  if (s.includes("TKJ") || s.includes("TJKT") || s.includes("JARINGAN")) {
    return "Teknik Jaringan Komputer & Telekomunikasi";
  }
  if (s.includes("DPIB") || s.includes("BANGUNAN") || s.includes("ARSITEK")) {
    return "Desain Pemodelan & Informasi Bangunan";
  }
  if (s.includes("TAV") || s.includes("AUDIO") || s.includes("ELEKTRONIKA")) {
    return "Teknik Audio Video";
  }
  if (s.includes("GEO") || s.includes("GEOMATIKA") || s.includes("UKUR")) {
    return "Teknik Geomatika";
  }
  if (s.includes("TBSM") || s.includes("SEPEDA") || s.includes("MOTOR")) {
    return "Teknik & Bisnis Sepeda Motor";
  }
  if (s.includes("TKR") || s.includes("TKRO") || s.includes("OTOMOTIF") || s.includes("KENDARAAN")) {
    return "Teknik Kendaraan Ringan Otomotif";
  }
  if (s.includes("TAB") || s.includes("ALAT BERAT")) {
    return "Teknik Alat Berat";
  }
  if (s.includes("TPL") || s.includes("PENGELASAN") || s.includes("LAS")) {
    return "Teknik Pengelasan";
  }
  if (s.includes("TITL") || s.includes("LISTRIK") || s.includes("INSTALASI")) {
    return "Teknik Instalasi Tenaga Listrik";
  }

  return str.trim();
}

function parseNamaDanJurusan(rawName, kelasFallback = "") {
  if (!rawName) {
    return {
      namaSiswaTampil: "SISWA",
      konsentrasiKeahlian: formatNamaJurusanResmi(kelasFallback),
    };
  }

  const str = String(rawName).trim();
  let extracted = "";
  let cleanName = str;

  if (str.includes(" - ")) {
    const parts = str.split(" - ");
    if (parts.length >= 2) {
      extracted = parts[parts.length - 1].trim();
      cleanName = parts.slice(0, -1).join(" - ").trim();
    }
  } else if (str.includes(" / ")) {
    const parts = str.split(" / ");
    if (parts.length >= 2) {
      extracted = parts[parts.length - 1].trim();
      cleanName = parts.slice(0, -1).join(" / ").trim();
    }
  } else if (str.includes("(") && str.includes(")")) {
    const match = str.match(/(.*?)\((.*?)\)/);
    if (match) {
      cleanName = match[1].trim();
      extracted = match[2].trim();
    }
  }

  if (!extracted) {
    extracted = kelasFallback || "-";
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

function optimizeFotoUrl(url, size = 400) {
  if (!url || typeof url !== "string") return url;
  const trimmed = url.trim();
  if (trimmed.includes("googleusercontent.com")) {
    const base = trimmed.split("=")[0];
    return `${base}=w${size}-h${size}-c`;
  }
  const driveIdMatch = trimmed.match(/[-\w]{25,}/);
  if (trimmed.includes("drive.google.com") && driveIdMatch) {
    return `https://lh3.googleusercontent.com/d/${driveIdMatch[0]}=w${size}-h${size}-c`;
  }
  return trimmed;
}

function formatTTL(tempatLahir, tglLahir) {
  const tempat = (tempatLahir || "").trim();
  let tgl = (tglLahir || "").trim();

  if (tgl) {
    try {
      const d = new Date(tgl);
      if (!isNaN(d.getTime())) {
        tgl = d.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
    } catch (_) {}
  }

  if (tempat && tgl) return `${tempat}, ${tgl}`;
  if (tempat) return tempat;
  if (tgl) return tgl;
  return "-";
}

// Helper konversi URL foto menjadi Base64 rasio pas foto 3:4 (Object-Fit: Cover) untuk disisipkan ke dalam jsPDF
function fetchImageAsBase64(url) {
  if (!url) return Promise.resolve(null);

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const targetW = 270;
          const targetH = 360; // Rasio pas foto murni 3:4 (270 / 360 = 0.75)
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");

          const imgRatio = img.width / img.height;
          const boxRatio = targetW / targetH;
          let sx, sy, sw, sh;

          if (imgRatio > boxRatio) {
            sh = img.height;
            sw = img.height * boxRatio;
            sy = 0;
            sx = (img.width - sw) / 2;
          } else {
            sw = img.width;
            sh = img.width / boxRatio;
            sx = 0;
            sy = (img.height - sh) / 2;
          }

          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
          resolve(canvas.toDataURL("image/jpeg", 0.9));
        } catch (_) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    } catch (_) {
      resolve(null);
    }
  });
}

export default function ModalCetakBarcodeWaliKelas({
  isOpen,
  onClose,
  guru,
  wali,
}) {
  const [loading, setLoading] = useState(true);
  const [siswaList, setSiswaList] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  // Ambil data siswa dan biodata lengkap masing-masing siswa (foto, No HP, TTL)
  useEffect(() => {
    if (!isOpen || !guru?.id || !wali?.idWali) return;

    let isMounted = true;
    setLoading(true);
    setLoadProgress(10);

    async function loadData() {
      try {
        const res = await getPresensiWaliGrid(guru.id, wali.idWali);
        if (!isMounted) return;

        const rawSiswa = (res?.success && res.data?.siswa) || [];
        const normalized = rawSiswa
          .map((s) => {
            const idSiswa = String(s.idSiswa || s.id || "").trim();
            const rawName = String(s.nama || s.namaSiswa || "").trim();
            const { namaSiswaTampil, konsentrasiKeahlian } = parseNamaDanJurusan(
              rawName,
              s.kelas || wali.namaKelas || wali.kelas || "",
            );
            return {
              idSiswa,
              namaSiswaTampil,
              konsentrasiKeahlian,
              kelas: s.kelas || wali.namaKelas || wali.kelas || "-",
              fotoProfil: s.fotoProfil || s.foto || "",
              noHp: s.noHp || s.kontak || "",
              tempatLahir: s.tempatLahir || "",
              tglLahir: s.tglLahir || "",
            };
          })
          .filter((s) => s.idSiswa)
          .sort((a, b) => a.namaSiswaTampil.localeCompare(b.namaSiswaTampil));

        setLoadProgress(25);

        // Ambil biodata siswa (fotoProfil, noHp, tempatLahir, tglLahir) per kelompok (batch)
        const BATCH_SIZE = 6;
        const totalSiswa = normalized.length;
        const bioMap = {};

        for (let i = 0; i < totalSiswa; i += BATCH_SIZE) {
          if (!isMounted) return;
          const batch = normalized.slice(i, i + BATCH_SIZE);
          const results = await Promise.all(
            batch.map(async (s) => {
              try {
                const bRes = await getBiodataSiswa(s.idSiswa);
                if (bRes?.success && bRes?.data) {
                  return {
                    idSiswa: s.idSiswa,
                    fotoProfil: bRes.data.fotoProfil || bRes.data.foto || "",
                    noHp: bRes.data.noHp || "",
                    tempatLahir: bRes.data.tempatLahir || "",
                    tglLahir: bRes.data.tglLahir || "",
                  };
                }
              } catch (_) {}
              return { idSiswa: s.idSiswa };
            }),
          );

          results.forEach((item) => {
            if (item?.idSiswa) {
              bioMap[item.idSiswa] = item;
            }
          });

          if (isMounted) {
            setLoadProgress(25 + Math.round(((i + batch.length) / totalSiswa) * 35));
          }
        }

        // Generate QR Code dan gabungkan biodata
        const withQrAndBio = [];
        for (let i = 0; i < totalSiswa; i++) {
          if (!isMounted) return;
          const s = normalized[i];
          const b = bioMap[s.idSiswa] || {};

          const rawFoto = b.fotoProfil || s.fotoProfil || "";
          const hasPhoto = isValidPhotoUrl(rawFoto);
          const photoUrl = hasPhoto ? optimizeFotoUrl(rawFoto) : null;

          const tempatLahir = b.tempatLahir || s.tempatLahir || "";
          const tglLahir = b.tglLahir || s.tglLahir || "";
          const ttl = formatTTL(tempatLahir, tglLahir);
          const noHp = b.noHp || s.noHp || "-";

          const payload = `PRESENSI-SMK1TK:${s.idSiswa}`;
          let qrUrl = "";
          try {
            qrUrl = await QRCode.toDataURL(payload, {
              width: 320,
              margin: 1,
              color: {
                dark: "#0f172a",
                light: "#ffffff",
              },
              errorCorrectionLevel: "M",
            });
          } catch (err) {
            console.error("Gagal generate QR:", s.idSiswa, err);
          }

          withQrAndBio.push({
            ...s,
            photoUrl,
            ttl,
            noHp,
            qrDataUrl: qrUrl,
          });

          if (isMounted) {
            setLoadProgress(60 + Math.round(((i + 1) / totalSiswa) * 40));
          }
        }

        if (isMounted) {
          setSiswaList(withQrAndBio);
          setLoading(false);
          setLoadProgress(100);
        }
      } catch (err) {
        console.error("Gagal memuat siswa wali kelas:", err);
        if (isMounted) setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isOpen, guru?.id, wali?.idWali, wali?.namaKelas, wali?.kelas]);

  // Filter siswa berdasarkan pencarian
  const filteredSiswa = useMemo(() => {
    if (!searchQuery.trim()) return siswaList;
    const q = searchQuery.toLowerCase().trim();
    return siswaList.filter(
      (s) =>
        s.namaSiswaTampil.toLowerCase().includes(q) ||
        s.idSiswa.toLowerCase().includes(q) ||
        s.konsentrasiKeahlian.toLowerCase().includes(q) ||
        s.ttl.toLowerCase().includes(q) ||
        s.noHp.toLowerCase().includes(q),
    );
  }, [siswaList, searchQuery]);

  // Kelompokkan siswa per 6 kartu (1 Lembar Kertas A4)
  const a4Pages = useMemo(() => {
    const pages = [];
    for (let i = 0; i < filteredSiswa.length; i += 6) {
      pages.push(filteredSiswa.slice(i, i + 6));
    }
    return pages;
  }, [filteredSiswa]);

  // Handler Cetak Langsung Browser (A4 6 Kartu per Halaman)
  const handlePrint = () => {
    window.print();
  };

  // Handler Download PDF Resmi Ukuran A4 (6 Kartu per Lembar)
  const handleDownloadPDF = async () => {
    if (siswaList.length === 0) {
      alert("Tidak ada data siswa untuk diunduh.");
      return;
    }

    try {
      setIsExportingPdf(true);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const totalSiswa = siswaList.length;
      const cardW = 94; // mm
      const cardH = 88; // mm
      const colX = [8, 108]; // mm
      const rowY = [8, 101, 194]; // mm

      for (let i = 0; i < totalSiswa; i++) {
        const cardIndexInPage = i % 6;
        const col = cardIndexInPage % 2;
        const row = Math.floor(cardIndexInPage / 2);

        // Tambah halaman baru setiap kelipatan 6 kartu
        if (i > 0 && cardIndexInPage === 0) {
          doc.addPage("a4", "portrait");
        }

        const x = colX[col];
        const y = rowY[row];
        const s = siswaList[i];

        // 1. Garis Potong Putus-Putus Luar Kartu
        doc.setDrawColor(148, 163, 184);
        doc.setLineDashPattern([2, 2], 0);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, "D");
        doc.setLineDashPattern([], 0);

        // 2. Background Putih Kartu
        doc.setFillColor(255, 255, 255);
        doc.rect(x + 0.3, y + 0.3, cardW - 0.6, cardH - 0.6, "F");

        // 3. Kop Surat Gradasi Deep Navy (15 mm tinggi)
        const kopH = 15;
        doc.setFillColor(30, 58, 138); // Deep Navy #1e3a8a
        doc.rect(x, y, cardW, kopH, "F");

        // Garis Aksen Emas
        doc.setFillColor(245, 158, 11);
        doc.rect(x, y + kopH, cardW, 1.2, "F");

        // Logo Sekolah di Kop
        if (LOGO_SEKOLAH_BASE64) {
          doc.setFillColor(255, 255, 255);
          doc.rect(x + 3, y + 1.8, 11.4, 11.4, "F");
          doc.addImage(LOGO_SEKOLAH_BASE64, "PNG", x + 3.2, y + 2, 11, 11);
        }

        // Teks Kop Sekolah
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.text("SMKN 1 TELUK KUANTAN", x + 16, y + 6.5);

        doc.setFontSize(6);
        doc.setTextColor(251, 191, 36);
        doc.text("KARTU PRESENSI KEHADIRAN SISWA", x + 16, y + 11);

        // Badge Kelas (Kanan Kop)
        const badgeW = 22;
        const badgeH = 7.5;
        const badgeX = x + cardW - badgeW - 3;
        const badgeY = y + 3.8;
        doc.setFillColor(15, 23, 42);
        doc.rect(badgeX, badgeY, badgeW, badgeH, "F");
        doc.setDrawColor(56, 189, 248);
        doc.setLineWidth(0.3);
        doc.rect(badgeX, badgeY, badgeW, badgeH, "D");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.5);
        doc.setTextColor(255, 255, 255);
        doc.text(s.kelas || "-", badgeX + badgeW / 2, badgeY + 5, {
          align: "center",
        });

        // 4. Area Pas Foto (3x4 cm - Rasio 3:4 Presisi 19mm x 25.33mm)
        const pfX = x + 3.5;
        const pfY = y + kopH + 3.5;
        const pfW = 19;
        const pfH = 25.33; // 19 * 4 / 3 = 25.33mm (Aspek rasio 3:4)

        let photoRendered = false;
        if (s.photoUrl) {
          const photoBase64 = await fetchImageAsBase64(s.photoUrl);
          if (photoBase64) {
            try {
              doc.addImage(photoBase64, "JPEG", pfX, pfY, pfW, pfH);
              doc.setDrawColor(148, 163, 184);
              doc.setLineWidth(0.2);
              doc.rect(pfX, pfY, pfW, pfH, "D");
              photoRendered = true;
            } catch (_) {
              photoRendered = false;
            }
          }
        }

        // Jika tidak ada foto atau foto gagal dirender -> Tampilkan siluet NO FOTO resmi
        if (!photoRendered) {
          doc.setFillColor(248, 250, 252);
          doc.rect(pfX, pfY, pfW, pfH, "F");
          doc.setDrawColor(148, 163, 184);
          doc.setLineDashPattern([1.5, 1.5], 0);
          doc.setLineWidth(0.2);
          doc.rect(pfX, pfY, pfW, pfH, "D");
          doc.setLineDashPattern([], 0);

          doc.setFillColor(226, 232, 240);
          doc.circle(pfX + pfW / 2, pfY + 8.5, 4.2, "F");
          doc.setFillColor(148, 163, 184);
          doc.circle(pfX + pfW / 2, pfY + 7.5, 2.0, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(4.5);
          doc.setTextColor(71, 85, 105);
          doc.text("PAS FOTO", pfX + pfW / 2, pfY + 18, { align: "center" });
          doc.setFontSize(4);
          doc.setTextColor(148, 163, 184);
          doc.text("3 × 4 CM", pfX + pfW / 2, pfY + 22, { align: "center" });
        }

        // 5. Biodata Siswa (Tengah - Padat & Proporsional Tanpa Spasi Berlebih)
        const bioX = pfX + pfW + 3.5;
        const bioMaxW = 34;
        let curY = pfY + 1.2;

        // Nama Siswa
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.0);
        doc.setTextColor(148, 163, 184);
        doc.text("NAMA LENGKAP", bioX, curY + 2.0);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(6.2);
        doc.setTextColor(15, 23, 42);
        const nmLines = doc.splitTextToSize(
          (s.namaSiswaTampil || "SISWA").toUpperCase(),
          bioMaxW,
        );
        doc.text(nmLines, bioX, curY + 4.8);
        curY += (nmLines.length > 1 ? 8.2 : 6.8);

        // Nomor Induk / ID
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.0);
        doc.setTextColor(148, 163, 184);
        doc.text("NOMOR INDUK / ID", bioX, curY);

        doc.setFont("courier", "bold");
        doc.setFontSize(6.8);
        doc.setTextColor(30, 58, 138);
        doc.text(s.idSiswa || "-", bioX, curY + 2.8);
        curY += 6.5;

        // Konsentrasi Keahlian
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.0);
        doc.setTextColor(148, 163, 184);
        doc.text("KONSENTRASI KEAHLIAN", bioX, curY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.2);
        doc.setTextColor(3, 105, 161);
        const jurLines = doc.splitTextToSize(s.konsentrasiKeahlian || "-", bioMaxW);
        doc.text(jurLines, bioX, curY + 2.6);
        curY += (jurLines.length > 1 ? 7.2 : 6.2);

        // TTL (Tempat Tanggal Lahir)
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.0);
        doc.setTextColor(148, 163, 184);
        doc.text("TTL", bioX, curY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.2);
        doc.setTextColor(51, 65, 85);
        const ttlLines = doc.splitTextToSize(s.ttl || "-", bioMaxW);
        doc.text(ttlLines, bioX, curY + 2.6);
        curY += (ttlLines.length > 1 ? 7.2 : 6.2);

        // No. HP
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.0);
        doc.setTextColor(148, 163, 184);
        doc.text("NO. HP", bioX, curY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.5);
        doc.setTextColor(51, 65, 85);
        doc.text(s.noHp || "-", bioX, curY + 2.8);

        // 6. Area Barcode / QR Code (Kanan - Ekstra Besar)
        const qrBoxW = 29;
        const qrBoxH = 48;
        const qrBoxX = x + cardW - qrBoxW - 3.5;
        const qrBoxY = y + kopH + 3.5;

        doc.setFillColor(248, 250, 252);
        doc.rect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, "F");
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.2);
        doc.rect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, "D");

        // Gambar QR Code Tajam (25 x 25 mm)
        const qrImgSize = 25;
        const qrImgX = qrBoxX + (qrBoxW - qrImgSize) / 2;
        const qrImgY = qrBoxY + 2;

        if (s.qrDataUrl) {
          doc.setFillColor(255, 255, 255);
          doc.rect(qrImgX, qrImgY, qrImgSize, qrImgSize, "F");
          doc.addImage(s.qrDataUrl, "PNG", qrImgX + 0.5, qrImgY + 0.5, qrImgSize - 1, qrImgSize - 1);
        }

        // Teks ID di Bawah QR Code
        doc.setFont("courier", "bold");
        doc.setFontSize(7);
        doc.setTextColor(15, 23, 42);
        doc.text(s.idSiswa || "-", qrBoxX + qrBoxW / 2, qrImgY + qrImgSize + 4.5, {
          align: "center",
        });

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(71, 85, 105);
        doc.text("SCAN PRESENSI", qrBoxX + qrBoxW / 2, qrImgY + qrImgSize + 8, {
          align: "center",
        });

        // 7. Footer Kartu
        const footH = 7.5;
        const footY = y + cardH - footH;
        doc.setFillColor(248, 250, 252);
        doc.rect(x + 0.3, footY, cardW - 0.6, footH - 0.3, "F");
        doc.setDrawColor(226, 232, 240);
        doc.line(x, footY, x + cardW, footY);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(71, 85, 105);
        doc.text("Resmi SMKN 1 Teluk Kuantan", x + 5, footY + 4.8);

        doc.setFont("helvetica", "italic");
        doc.text("Wajib dibawa setiap hari sekolah", x + cardW - 5, footY + 4.8, {
          align: "right",
        });
      }

      const safeKelas = (wali.namaKelas || "Kelas").replace(/[^a-zA-Z0-9_-]/g, "_");
      doc.save(`Kartu_Barcode_Seluruh_Siswa_${safeKelas}.pdf`);
    } catch (err) {
      console.error("Gagal export PDF seluruh siswa:", err);
      alert("Gagal membuat file PDF. Silakan gunakan tombol Cetak Langsung.");
    } finally {
      setIsExportingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-hidden">
      {/* ============================================================ */}
      {/* CSS KHUSUS PRINT: OTOMATIS 6 KARTU DALAM 1 LEMBAR KERTAS A4  */}
      {/* ============================================================ */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 6mm 5mm;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-area-barcode-wali,
          #print-area-barcode-wali * {
            visibility: visible !important;
          }
          #print-area-barcode-wali {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .lembar-a4-halaman {
            page-break-after: always !important;
            break-after: page !important;
            width: 198mm !important;
            height: 284mm !important;
            margin: 0 auto !important;
            padding: 2mm 0 !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            grid-template-rows: repeat(3, 1fr) !important;
            gap: 4mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
          }
          .kartu-item-cetak {
            box-sizing: border-box !important;
            border: 1px dashed #64748b !important;
            border-radius: 6px !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            height: 89mm !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* CONTAINER MODAL UTAMA */}
      <div className="relative w-full max-w-6xl max-h-[96vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* HEADER MODAL */}
        <div className="no-print shrink-0 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-4 sm:p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">
              🪪
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Cetak Barcode Siswa Kelas {wali?.namaKelas}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-[10px] font-black text-teal-300">
                  {siswaList.length} Siswa
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-[10px] font-black text-amber-300">
                  {a4Pages.length} Lembar A4 (6 Card/Lembar)
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium mt-0.5">
                Wali Kelas: <b>{guru?.nama || "-"}</b> • Format resmi cetak kertas A4 siap potong
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Tombol Cetak Langsung Browser */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || siswaList.length === 0}
              className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-black text-xs shadow-md shadow-teal-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <span>🖨️</span>
              <span>Cetak (A4)</span>
            </button>

            {/* Tombol Download PDF File */}
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={loading || siswaList.length === 0 || isExportingPdf}
              className="px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-md shadow-blue-500/25 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isExportingPdf ? (
                <>
                  <span className="animate-spin">⏳</span>
                  <span>Menyiapkan PDF...</span>
                </>
              ) : (
                <>
                  <span>📄</span>
                  <span>Unduh PDF</span>
                </>
              )}
            </button>

            {/* Tombol Tutup */}
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center text-lg font-bold transition-all ml-1 cursor-pointer"
              aria-label="Tutup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* SUBHEADER: SEARCH & INFO BANNER */}
        <div className="no-print shrink-0 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              🔍
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, ID, TTL, atau No HP siswa..."
              className="w-full pl-9 pr-3.5 py-1.5 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1.5">
              <span>💡</span>
              <span>1 Lembar A4 otomatis menampung tepat <b>6 Kartu Siswa</b> (2 Kolom × 3 Baris)</span>
            </span>
          </div>
        </div>

        {/* BODY MODAL: PREVIEW KARTU PER LEMBAR A4 */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/70">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-72 text-center space-y-3">
              <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm font-bold text-slate-700">
                Memuat foto, biodata, & barcode siswa kelas {wali?.namaKelas}...
              </p>
              <div className="w-48 bg-slate-200 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${loadProgress}%` }}
                ></div>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {loadProgress}% Selesai
              </span>
            </div>
          ) : filteredSiswa.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 max-w-md mx-auto my-12 space-y-2">
              <span className="text-3xl">🔍</span>
              <p className="text-sm font-bold">
                {searchQuery
                  ? `Tidak ada siswa yang cocok dengan pencarian "${searchQuery}".`
                  : "Belum ada siswa yang terdaftar di kelas ini."}
              </p>
            </div>
          ) : (
            <div id="print-area-barcode-wali" className="space-y-8">
              {a4Pages.map((pageSiswa, pageIdx) => (
                <div key={pageIdx} className="space-y-2">
                  {/* Label Lembar A4 di Layar */}
                  <div className="no-print flex items-center justify-between px-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <span>📄</span>
                      <span>
                        Lembar Kertas A4 Ke-{pageIdx + 1} dari {a4Pages.length} (Menampung {pageSiswa.length} Kartu)
                      </span>
                    </span>
                    <span className="text-[11px] font-bold text-slate-400">
                      Kartu #{pageIdx * 6 + 1} s/d #{pageIdx * 6 + pageSiswa.length}
                    </span>
                  </div>

                  {/* LEMBAR A4 (6 KARTU DALAM GRID 2 KOLOM x 3 BARIS) */}
                  <div className="lembar-a4-halaman rounded-2xl bg-white p-3 sm:p-5 border border-slate-300 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pageSiswa.map((s) => (
                      <div
                        key={s.idSiswa}
                        className="kartu-item-cetak rounded-xl border border-dashed border-slate-400 bg-white overflow-hidden shadow-2xs flex flex-col justify-between"
                      >
                        {/* KOP KARTU */}
                        <div
                          style={{
                            background: "linear-gradient(90deg, #1e3a8a 0%, #1e40af 50%, #0f172a 100%)",
                          }}
                          className="px-2.5 py-1.5 flex items-center justify-between border-b-2 border-amber-500"
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            {/* Logo Sekolah */}
                            <div className="w-7 h-7 rounded-sm bg-white p-0.5 flex items-center justify-center shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={LOGO_SEKOLAH_BASE64}
                                alt="Logo SMKN 1 Teluk Kuantan"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0 leading-tight">
                              <div className="text-[9px] font-black text-white tracking-tight truncate">
                                SMKN 1 TELUK KUANTAN
                              </div>
                              <div className="text-[6.5px] font-bold text-amber-300 tracking-wider truncate">
                                KARTU PRESENSI KEHADIRAN SISWA
                              </div>
                            </div>
                          </div>

                          <span className="shrink-0 ml-1 px-1.5 py-0.5 rounded bg-slate-900/90 border border-sky-400 text-[8px] font-black text-white">
                            {s.kelas}
                          </span>
                        </div>

                        {/* BODY KARTU: FOTO (3) + BIO (4) + QR CODE (5) - PADAT & PROPORSIONAL */}
                        <div className="px-2.5 py-2 grid grid-cols-12 gap-1.5 items-start content-start">
                          {/* 1. Pas Foto Siswa / Model Gambar Kosong 3x4 (3 Kolom) */}
                          <div className="col-span-3 flex justify-center">
                            <div className="w-15 h-[20mm] sm:w-16 sm:h-[21.3mm] rounded border border-dashed border-slate-400 bg-slate-50 overflow-hidden relative flex flex-col items-center justify-center p-0.5 text-center select-none shadow-2xs aspect-[3/4]">
                              {s.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={s.photoUrl}
                                  alt={s.namaSiswaTampil}
                                  crossOrigin="anonymous"
                                  className="w-full h-full object-cover rounded-xs"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center p-1">
                                  <div className="w-5.5 h-5.5 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center mb-0.5 shadow-2xs">
                                    <svg
                                      className="w-3.5 h-3.5 text-slate-400"
                                      fill="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                                    </svg>
                                  </div>
                                  <span className="text-[5.5px] font-black text-slate-600 uppercase leading-none">
                                    PAS FOTO
                                  </span>
                                  <span className="text-[4.5px] font-bold text-slate-400 mt-0.5">
                                    3 × 4 CM
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* 2. Biodata Siswa: Nama, ID, Jurusan, TTL, No HP (4 Kolom - Padat) */}
                          <div className="col-span-4 space-y-1 text-slate-800 pr-1 pt-0.5">
                            <div>
                              <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                                Nama Siswa
                              </div>
                              <div className="text-[9px] sm:text-[9.5px] font-black text-slate-900 leading-tight uppercase line-clamp-1 mt-0.5">
                                {s.namaSiswaTampil}
                              </div>
                            </div>

                            <div>
                              <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                                Nomor Induk / ID
                              </div>
                              <div className="text-[8px] sm:text-[8.5px] font-mono font-bold text-blue-900 leading-tight mt-0.5">
                                {s.idSiswa}
                              </div>
                            </div>

                            <div>
                              <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                                Jurusan
                              </div>
                              <div className="text-[7px] sm:text-[7.5px] font-black text-sky-800 leading-tight line-clamp-1 mt-0.5">
                                {s.konsentrasiKeahlian}
                              </div>
                            </div>

                            <div>
                              <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                                TTL
                              </div>
                              <div className="text-[7px] sm:text-[7.5px] font-bold text-slate-700 leading-tight line-clamp-1 mt-0.5">
                                {s.ttl}
                              </div>
                            </div>

                            <div>
                              <div className="text-[5.5px] font-bold text-slate-400 uppercase tracking-wider leading-none">
                                No. HP
                              </div>
                              <div className="text-[7px] sm:text-[7.5px] font-semibold text-slate-700 leading-tight mt-0.5">
                                {s.noHp}
                              </div>
                            </div>
                          </div>

                          {/* 3. Barcode / QR Code Ekstra Besar (5 Kolom) */}
                          <div className="col-span-5 flex flex-col items-center justify-center p-1 rounded-lg border border-slate-200 bg-slate-50">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 p-1 rounded-md border border-slate-300 bg-white shadow-2xs flex items-center justify-center">
                              {s.qrDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={s.qrDataUrl}
                                  alt={`QR Code ${s.idSiswa}`}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="text-[7px] text-slate-400">
                                  Memuat QR...
                                </div>
                              )}
                            </div>
                            <div className="mt-0.5 text-[8.5px] sm:text-[9.5px] font-mono font-black text-slate-900 tracking-wider">
                              {s.idSiswa}
                            </div>
                            <div className="text-[6px] font-bold text-slate-500 uppercase tracking-tight">
                              SCAN PRESENSI
                            </div>
                          </div>
                        </div>

                        {/* FOOTER KARTU */}
                        <div className="px-2 py-1 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[6.5px] font-bold text-slate-500">
                          <span>Resmi SMKN 1 Teluk Kuantan</span>
                          <span className="italic">Wajib dibawa setiap hari sekolah</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
