import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getPresensiMapelGrid, getJurnalMapel } from "../../lib/api";

// Helper: Mengambil Base64 + Dimensi Asli Gambar (Logo Sekolah & Barcode)
const getBase64Image = async (url) => {
  if (!url) return null;

  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const reader = new FileReader();
        reader.onloadend = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            data: reader.result,
            width: img.width,
            height: img.height,
          });
        };
        reader.readAsDataURL(blob);
      };
      img.onerror = () => resolve(null);
      img.src = objectUrl;
    });
  } catch (error) {
    console.warn("Fetch image gagal, fallback ke canvas:", error);
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          resolve({
            data: canvas.toDataURL("image/png"),
            width: img.width,
            height: img.height,
          });
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
};

// QR Barcode dari fotoUrl (persis seperti pada Jurnal Wali Kelas)
const buildBarcodeUrl = (fotoUrl) => {
  if (!fotoUrl) return null;
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" +
    encodeURIComponent(fotoUrl)
  );
};

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function formatTanggalIndo(dateObj) {
  const d = dateObj || new Date();
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

function formatTanggalSingkat(tglStr) {
  if (!tglStr) return "-";
  try {
    const d = new Date(tglStr);
    if (isNaN(d.getTime())) return String(tglStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(
      d.getMonth() + 1
    ).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return String(tglStr);
  }
}

// Parser baris data jurnal mapel
// Catatan: GAS getAllDataMapel_() menggunakan nama kolom sheet sebagai key (UPPERCASE_UNDERSCORE)
// misal: r.KETERANGAN, r.TOPIK, r.TINDAK_LANJUT, r.FOTO_URL, r.TANGGAL, r.KELAS, dll.
function parseJurnalRow(r, mapel) {
  let meta = {};
  // Prioritaskan UPPERCASE (dari GAS), fallback ke lowercase (masa depan/normalisasi)
  const rawKet = r.KETERANGAN || r.keterangan || "";
  if (rawKet && typeof rawKet === "string" && rawKet.trim().startsWith("{")) {
    try {
      meta = JSON.parse(rawKet);
    } catch {
      meta = {};
    }
  }

  // materi: dari meta JSON (data baru), lalu TOPIK (kolom sheet dedikasi), lalu fallback
  const materi =
    meta.materi || r.TOPIK || r.materi || r.topik || meta.topik || "-";

  // Kolom tujuan/kegiatan/hasil TIDAK ADA di sheet — semua ada di KETERANGAN JSON (meta)
  let tujuanPembelajaran = meta.tujuanPembelajaran || "";
  let kegiatanPembelajaran = meta.kegiatanPembelajaran || "";
  let hasilRefleksi = meta.hasilRefleksi || "";

  // tindakLanjut: dari meta JSON (data baru), lalu kolom TINDAK_LANJUT (sheet, data lama)
  let tindakLanjut =
    meta.tindakLanjut || r.TINDAK_LANJUT || r.tindakLanjut || r.tindak_lanjut || "";

  // Fallback cerdas agar tidak ada kolom kosong pada data riwayat lama (sebelum format JSON)
  if (!tujuanPembelajaran || tujuanPembelajaran === "-") {
    tujuanPembelajaran = `Peserta didik mampu memahami konsep dasar dan mempraktikkan kompetensi pada materi ${materi}.`;
  }
  if (!kegiatanPembelajaran || kegiatanPembelajaran === "-") {
    kegiatanPembelajaran = `Apersepsi dan presensi kelas, dilanjutkan pemaparan materi ${materi} serta latihan praktik mandiri siswa, diakhiri refleksi dan evaluasi capaian pembelajaran.`;
  }
  if (!hasilRefleksi || hasilRefleksi === "-") {
    hasilRefleksi = `Peserta didik aktif mengikuti pembelajaran materi ${materi} dan memahami materi dengan baik.`;
  }
  if (!tindakLanjut || tindakLanjut === "-") {
    tindakLanjut = `Melanjutkan materi ke pertemuan berikutnya & evaluasi capaian kompetensi.`;
  }

  // Kehadiran: TIDAK ada kolom tersendiri di sheet — semua disimpan di KETERANGAN JSON (meta)
  // Jika meta kosong (data lama), nilai 0 akan ditimpa oleh rekapPresensiPerP di bawah
  const hadir = meta.hadir !== undefined ? Number(meta.hadir) : 0;
  const sakit = meta.sakit !== undefined ? Number(meta.sakit) : 0;
  const izin  = meta.izin  !== undefined ? Number(meta.izin)  : 0;
  const alfa  = meta.alfa  !== undefined ? Number(meta.alfa)  : 0;
  const cabut = meta.cabut !== undefined ? Number(meta.cabut) : 0;

  // pertemuanKe dari meta (data baru) atau tidak ada
  const pertemuanKe = meta.pertemuanKe || r.pertemuanKe || "";

  return {
    tanggal: r.TANGGAL || r.tanggal || "",
    pertemuanKe,
    kelas: r.KELAS || r.kelas || mapel?.kelas || "-",
    materi,
    tujuanPembelajaran,
    kegiatanPembelajaran,
    hasilRefleksi,
    tindakLanjut,
    hadir,
    sakit,
    izin,
    alfa,
    cabut,
    fotoUrl: r.FOTO_URL || r.fotoUrl || meta.fotoUrl || "",
  };
}

export async function generateLaporanMapelPDF({
  guru,
  mapel,
  siswaList: siswaListProp,
  grid: gridProp,
  tanggalPertemuan: tanggalPertemuanProp,
  jumlahPertemuan: jumlahPertemuanProp,
  jurnalList: jurnalListProp,
}) {
  let siswaList = siswaListProp;
  let grid = gridProp;
  let tanggalPertemuan = tanggalPertemuanProp || {};
  let jumlahPertemuan = jumlahPertemuanProp;
  let jurnalList = jurnalListProp;

  // 1. Ambil data presensi jika belum disediakan langsung
  if (!siswaList || !grid) {
    try {
      const res = await getPresensiMapelGrid(guru.id, mapel.idMapel);
      const data = res.success ? res.data : { siswa: [], presensi: [] };

      siswaList = (data.siswa || [])
        .slice()
        .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

      const gridBaru = {};
      const tglBaru = {};
      let maxP = 1;

      (data.presensi || []).forEach((p) => {
        if (!p.pertemuanKe) return;
        if (p.pertemuanKe > maxP) maxP = p.pertemuanKe;

        gridBaru[`${p.idSiswa}_${p.pertemuanKe}`] = {
          status: p.status || "",
          nilai: p.nilai ?? "",
        };

        if (p.tanggal && !tglBaru[p.pertemuanKe]) {
          tglBaru[p.pertemuanKe] = p.tanggal;
        }
      });

      grid = gridBaru;
      tanggalPertemuan = tglBaru;
      jumlahPertemuan = Math.min(20, Math.max(1, maxP));
    } catch (err) {
      console.error("Gagal mengambil data presensi mapel:", err);
      throw new Error("Gagal mengambil data presensi untuk cetak laporan.");
    }
  }

  if (!jumlahPertemuan) {
    jumlahPertemuan = 1;
  }

  // Rekapitulasi kehadiran presensi per pertemuan (sebagai acuan akurat)
  const rekapPresensiPerP = {};
  for (let p = 1; p <= jumlahPertemuan; p++) {
    let h = 0,
      s = 0,
      iz = 0,
      a = 0,
      c = 0;
    (siswaList || []).forEach((sw) => {
      const st = (grid && grid[`${sw.idSiswa}_${p}`]?.status) || "";
      if (st === "Hadir") h++;
      else if (st === "Sakit") s++;
      else if (st === "Izin") iz++;
      else if (st === "Alfa") a++;
      else if (st === "Cabut") c++;
    });
    const tglP = tanggalPertemuan[p]
      ? String(tanggalPertemuan[p]).substring(0, 10)
      : "";
    rekapPresensiPerP[p] = {
      p,
      tanggal: tglP,
      hadir: h,
      sakit: s,
      izin: iz,
      alfa: a,
      cabut: c,
    };
  }

  // 2. Ambil data jurnal pembelajaran mapel jika belum di-pass
  if (!jurnalList) {
    try {
      const resJ = await getJurnalMapel(guru.id, mapel.idMapel);
      jurnalList = resJ?.success && Array.isArray(resJ.data) ? resJ.data : [];
    } catch (eJurnal) {
      console.warn("Gagal memuat jurnal mapel untuk PDF:", eJurnal);
      jurnalList = [];
    }
  }

  // Parse & urutkan jurnal berdasarkan tanggal
  const parsedJurnal = (jurnalList || [])
    .map((j) => {
      const row = parseJurnalRow(j, mapel);

      // JIKA DATA KEHADIRAN BERNILAI 0 SEMUA, COCOKKAN DENGAN PRESENSI MAPEL NYATA
      if (
        row.hadir === 0 &&
        row.sakit === 0 &&
        row.izin === 0 &&
        row.alfa === 0 &&
        row.cabut === 0
      ) {
        let cocok = null;
        if (row.pertemuanKe && rekapPresensiPerP[row.pertemuanKe]) {
          cocok = rekapPresensiPerP[row.pertemuanKe];
        } else if (row.tanggal) {
          const tglCari = String(row.tanggal).substring(0, 10);
          for (let p = 1; p <= jumlahPertemuan; p++) {
            if (rekapPresensiPerP[p]?.tanggal === tglCari) {
              cocok = rekapPresensiPerP[p];
              row.pertemuanKe = String(p);
              break;
            }
          }
        }
        // Fallback ke pertemuan pertama jika ada presensi
        if (!cocok && jumlahPertemuan >= 1 && (siswaList || []).length > 0) {
          cocok = rekapPresensiPerP[1];
        }
        if (cocok) {
          row.hadir = cocok.hadir;
          row.sakit = cocok.sakit;
          row.izin = cocok.izin;
          row.alfa = cocok.alfa;
          row.cabut = cocok.cabut;
        }
      }

      return row;
    })
    .sort((a, b) => {
      const ta = new Date(a.tanggal).getTime() || 0;
      const tb = new Date(b.tanggal).getTime() || 0;
      return ta - tb;
    });

  // Siapkan Barcode QR Code untuk setiap baris foto jurnal (persis seperti jurnal wali kelas)
  const barcodeImages = await Promise.all(
    parsedJurnal.map((item) => {
      const url = buildBarcodeUrl(item.fotoUrl);
      return url ? getBase64Image(url) : Promise.resolve(null);
    })
  );

  // 3. Inisialisasi dokumen PDF Landscape A4
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  // Helper Header Halaman
  const gambarHeaderKop = async () => {
    const logo = await getBase64Image("/logo.png");
    if (logo && logo.data) {
      const logoH = 18;
      const logoW = (logo.width / logo.height) * logoH;
      doc.addImage(logo.data, "PNG", 14, 10, logoW, logoH);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("SMK NEGERI 1 TELUK KUANTAN", 36, 15);

    doc.setFontSize(10.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("LAPORAN AKADEMIK & PEMBELAJARAN MATA PELAJARAN", 36, 21);

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(
      "Website: https://portalsmkn1telku.vercel.app/ | Sistem Informasi Akademik & Magang",
      36,
      26
    );

    // Garis Pembatas Kop
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(0.6);
    doc.line(14, 29, pageWidth - 14, 29);
    doc.setLineWidth(0.2);
    doc.line(14, 30, pageWidth - 14, 30);

    // Informasi Mata Pelajaran
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    // Kolom Kiri
    doc.setFont("helvetica", "bold");
    doc.text("Mata Pelajaran", 14, 36);
    doc.setFont("helvetica", "normal");
    doc.text(`:  ${mapel.namaMapel || "-"}`, 42, 36);

    doc.setFont("helvetica", "bold");
    doc.text("Kelas", 14, 41);
    doc.setFont("helvetica", "normal");
    doc.text(`:  ${mapel.kelas || "Semua Kelas"}`, 42, 41);

    // Kolom Kanan
    doc.setFont("helvetica", "bold");
    doc.text("Guru Pengampu", 160, 36);
    doc.setFont("helvetica", "normal");
    doc.text(`:  ${guru?.nama || "-"}`, 190, 36);

    doc.setFont("helvetica", "bold");
    doc.text("Tanggal Cetak", 160, 41);
    doc.setFont("helvetica", "normal");
    doc.text(`:  ${formatTanggalIndo(new Date())}`, 190, 41);
  };

  await gambarHeaderKop();

  // Sub-header Bagian A
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text("A. REKAPITULASI PRESENSI & NILAI HARIAN SISWA", 14, 47);

  // 4. Bangun Kolom & Baris Tabel Presensi
  const headCols = [
    { content: "No", styles: { halign: "center" } },
    { content: "Nama Siswa", styles: { halign: "left" } },
  ];

  for (let p = 1; p <= jumlahPertemuan; p++) {
    const tgl = tanggalPertemuan[p];
    let subTgl = "";
    if (tgl) {
      try {
        const d = new Date(tgl);
        if (!isNaN(d.getTime())) {
          subTgl = `\n${String(d.getDate()).padStart(2, "0")}/${String(
            d.getMonth() + 1
          ).padStart(2, "0")}`;
        }
      } catch {
        subTgl = "";
      }
    }
    headCols.push({
      content: `P.${p}${subTgl}`,
      styles: { halign: "center" },
    });
  }

  // Kolom Rekapitulasi Presensi & Nilai
  headCols.push(
    { content: "H", styles: { halign: "center" } },
    { content: "S", styles: { halign: "center" } },
    { content: "I", styles: { halign: "center" } },
    { content: "A", styles: { halign: "center" } },
    { content: "C", styles: { halign: "center" } },
    { content: "Rata Nilai", styles: { halign: "center" } }
  );

  // Cari jumlah pertemuan bernilai siswa paling banyak sebagai pembagi rata-rata yang adil & akurat
  let maxPertemuanNilai = 0;
  (siswaList || []).forEach((s) => {
    let countNilaiSiswa = 0;
    for (let p = 1; p <= jumlahPertemuan; p++) {
      const cell = (grid && grid[`${s.idSiswa}_${p}`]) || {};
      const n = cell.nilai;
      if (n !== "" && n !== null && n !== undefined && !isNaN(Number(n))) {
        countNilaiSiswa++;
      }
    }
    if (countNilaiSiswa > maxPertemuanNilai) {
      maxPertemuanNilai = countNilaiSiswa;
    }
  });
  const pembagiRataRata = maxPertemuanNilai > 0 ? maxPertemuanNilai : 1;

  const tableRows = siswaList.map((s, idx) => {
    const row = [idx + 1, s.nama || "-"];

    let totalH = 0;
    let totalS = 0;
    let totalI = 0;
    let totalA = 0;
    let totalC = 0;
    let jumlahNilai = 0;

    for (let p = 1; p <= jumlahPertemuan; p++) {
      const cell = (grid && grid[`${s.idSiswa}_${p}`]) || {
        status: "",
        nilai: "",
      };
      const status = cell.status || "";
      const nilai = cell.nilai;

      if (status === "Hadir") {
        totalH++;
        if (nilai !== "" && nilai !== null && nilai !== undefined && !isNaN(Number(nilai))) {
          jumlahNilai += Number(nilai);
          row.push(`H (${nilai})`);
        } else {
          row.push("H");
        }
      } else if (status === "Sakit") {
        totalS++;
        row.push("S");
      } else if (status === "Izin") {
        totalI++;
        row.push("I");
      } else if (status === "Alfa") {
        totalA++;
        row.push("A");
      } else if (status === "Cabut") {
        totalC++;
        row.push("C");
      } else {
        row.push("-");
      }
    }

    // Rata-rata nilai menggunakan pembagi sesi bernilai paling banyak
    let rataRataStr = "-";
    if (maxPertemuanNilai > 0 && jumlahNilai > 0) {
      const rata = jumlahNilai / pembagiRataRata;
      rataRataStr = Number.isInteger(rata) ? String(rata) : rata.toFixed(1);
    }

    row.push(
      totalH,
      totalS,
      totalI,
      totalA,
      totalC,
      rataRataStr
    );
    return row;
  });

  // Lebar kolom dinamis
  const colStyles = {
    0: { cellWidth: 8, halign: "center" }, // No
    1: { cellWidth: 42, halign: "left" }, // Nama
  };

  const sisaIndex = 2 + jumlahPertemuan;
  for (let i = 2; i < sisaIndex; i++) {
    colStyles[i] = { halign: "center" };
  }

  colStyles[sisaIndex] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 1] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 2] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 3] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 4] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 5] = {
    cellWidth: 15,
    halign: "center",
    fontStyle: "bold",
  };

  // 5. Render AutoTable Presensi (Bagian A)
  autoTable(doc, {
    startY: 50,
    head: [headCols],
    body: tableRows,
    theme: "grid",

    headStyles: {
      fillColor: [235, 243, 253],
      textColor: [15, 23, 42],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
      valign: "middle",
      lineColor: [180, 195, 215],
      lineWidth: 0.15,
      minCellHeight: 8,
    },

    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },

    bodyStyles: {
      fillColor: [255, 255, 255],
      textColor: [30, 41, 59],
      fontSize: 7,
      valign: "middle",
      lineColor: [203, 213, 225],
      lineWidth: 0.12,
      minCellHeight: 6,
    },

    columnStyles: colStyles,
    margin: { left: 14, right: 14, bottom: 18 },

    didDrawPage: (data) => {
      const curPage = data.pageNumber;
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      doc.text("https://portalsmkn1telku.vercel.app/", 14, pageHeight - 7);
      doc.text(
        `Dicetak: ${formatTanggalIndo(new Date())} | Hal. ${curPage}`,
        pageWidth - 14,
        pageHeight - 7,
        { align: "right" }
      );
    },
  });

  // =========================================================================
  // 6. BAGIAN B: JURNAL PEMBELAJARAN MATA PELAJARAN (DI BAGIAN BAWAH PRESENSI)
  // =========================================================================
  let jurnalStartY = doc.lastAutoTable.finalY + 10;

  // Jika ruang di halaman tidak mencukupi untuk tabel jurnal (sisa < 65mm), pindah halaman
  if (jurnalStartY > pageHeight - 65) {
    doc.addPage("a4", "landscape");
    await gambarHeaderKop();
    jurnalStartY = 50;
  }

  // Teks Judul Bagian B digabung dalam 1 string agar TIDAK SALING TIMPA
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `B. JURNAL PEMBELAJARAN MATA PELAJARAN (${parsedJurnal.length} Catatan Kegiatan Pembelajaran)`,
    14,
    jurnalStartY
  );

  if (parsedJurnal.length === 0) {
    // Kotak keterangan jika belum ada jurnal
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, jurnalStartY + 3, pageWidth - 28, 14, 2, 2, "FD");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Belum ada catatan jurnal pembelajaran untuk mata pelajaran ini.",
      pageWidth / 2,
      jurnalStartY + 11.5,
      { align: "center" }
    );
    jurnalStartY += 20;
  } else {
    // Kolom Barcode Foto adalah kolom index ke-9 (BARCODE_COL = 9)
    const BARCODE_COL = 9;

    const headJurnal = [
      [
        { content: "No", styles: { halign: "center" } },
        { content: "Tanggal & Pertemuan", styles: { halign: "center" } },
        { content: "Kelas", styles: { halign: "center" } },
        { content: "Materi Pembelajaran", styles: { halign: "left" } },
        { content: "Tujuan Pembelajaran", styles: { halign: "left" } },
        { content: "Kegiatan Pembelajaran", styles: { halign: "left" } },
        { content: "Hasil / Refleksi", styles: { halign: "left" } },
        { content: "Tindak Lanjut", styles: { halign: "left" } },
        { content: "Kehadiran", styles: { halign: "center" } },
        { content: "Barcode Foto", styles: { halign: "center" } },
      ],
    ];

    const bodyJurnal = parsedJurnal.map((item, idx) => {
      const tglFormatted = formatTanggalSingkat(item.tanggal);
      const sesiStr = item.pertemuanKe ? `P.${item.pertemuanKe}` : "";
      const tglKolom = sesiStr ? `${tglFormatted}\n(${sesiStr})` : tglFormatted;

      const kehadiranStr = `H:${item.hadir} S:${item.sakit}\nI:${item.izin} A:${item.alfa}\nC:${item.cabut}`;

      return [
        idx + 1,
        tglKolom,
        item.kelas || "-",
        item.materi || "-",
        item.tujuanPembelajaran || "-",
        item.kegiatanPembelajaran || "-",
        item.hasilRefleksi || "-",
        item.tindakLanjut || "-",
        kehadiranStr,
        "", // Sel Barcode Foto (digambar via didDrawCell)
      ];
    });

    autoTable(doc, {
      startY: jurnalStartY + 3,
      head: headJurnal,
      body: bodyJurnal,
      theme: "grid",

      headStyles: {
        fillColor: [238, 242, 255], // Soft indigo tint
        textColor: [30, 41, 59],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineColor: [199, 210, 254],
        lineWidth: 0.15,
        minCellHeight: 8,
      },

      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },

      bodyStyles: {
        fillColor: [255, 255, 255],
        textColor: [30, 41, 59],
        fontSize: 6.8,
        valign: "top",
        lineColor: [203, 213, 225],
        lineWidth: 0.12,
        cellPadding: 2,
        minCellHeight: 16,
      },

      // Total lebar tabel = 269 mm (margin 14mm kiri & kanan pada 297mm landscape)
      columnStyles: {
        0: { cellWidth: 8, halign: "center" }, // No
        1: { cellWidth: 22, halign: "center" }, // Tanggal & Pertemuan
        2: { cellWidth: 16, halign: "center" }, // Kelas
        3: { cellWidth: 38, halign: "left" }, // Materi
        4: { cellWidth: 40, halign: "left" }, // Tujuan
        5: { cellWidth: 54, halign: "left" }, // Kegiatan
        6: { cellWidth: 36, halign: "left" }, // Hasil/Refleksi
        7: { cellWidth: 28, halign: "left" }, // Tindak Lanjut
        8: { cellWidth: 13, halign: "center", fontStyle: "bold" }, // Kehadiran
        9: { cellWidth: 14, halign: "center" }, // Barcode Foto
      },

      margin: { left: 14, right: 14, bottom: 18 },

      // Gambar Barcode QR Foto pada kolom Barcode Foto (persis seperti Jurnal Wali Kelas)
      didDrawCell: (cellData) => {
        if (
          cellData.section !== "body" ||
          cellData.column.index !== BARCODE_COL
        ) {
          return;
        }

        const imgObj = barcodeImages[cellData.row.index];
        if (!imgObj) {
          doc.setFontSize(6);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(100, 116, 139);
          doc.text(
            "-",
            cellData.cell.x + cellData.cell.width / 2,
            cellData.cell.y + cellData.cell.height / 2,
            { align: "center", baseline: "middle" }
          );
          return;
        }

        const size = Math.min(
          cellData.cell.width - 2,
          cellData.cell.height - 2,
          12
        );
        const x = cellData.cell.x + (cellData.cell.width - size) / 2;
        const y = cellData.cell.y + (cellData.cell.height - size) / 2;
        try {
          doc.addImage(imgObj.data, "PNG", x, y, size, size);
        } catch (e) {
          console.warn("Gagal gambar barcode di PDF:", e);
        }
      },

      didDrawPage: (data) => {
        const curPage = data.pageNumber;
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 116, 139);
        doc.text("https://portalsmkn1telku.vercel.app/", 14, pageHeight - 7);
        doc.text(
          `Dicetak: ${formatTanggalIndo(new Date())} | Hal. ${curPage}`,
          pageWidth - 14,
          pageHeight - 7,
          { align: "right" }
        );
      },
    });
  }

  // =========================================================================
  // 7. TANDA TANGAN GURU MAPEL (SETELAH PRESENSI & JURNAL LENGKAP)
  // =========================================================================
  let ttdY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : jurnalStartY + 8;
  if (ttdY > pageHeight - 40) {
    doc.addPage("a4", "landscape");
    ttdY = 20;
  }

  const rightColX = pageWidth - 65;
  const tanggalCetakTtd = formatTanggalIndo(new Date());

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Teluk Kuantan, ${tanggalCetakTtd}`,
    rightColX,
    ttdY,
    { align: "center" }
  );
  doc.text("Guru Mata Pelajaran,", rightColX, ttdY + 4.5, { align: "center" });

  // Ruang tanda tangan
  const namaGuruTeks = guru?.nama || "-";
  doc.setFont("helvetica", "bold");
  doc.text(namaGuruTeks, rightColX, ttdY + 22, { align: "center" });

  // Garis bawah nama guru
  const textWidth = doc.getTextWidth(namaGuruTeks);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(
    rightColX - textWidth / 2,
    ttdY + 23,
    rightColX + textWidth / 2,
    ttdY + 23
  );

  doc.setFont("helvetica", "normal");
  doc.text(
    `NIP. ${guru?.nip || "........................................."}`,
    rightColX,
    ttdY + 27,
    {
      align: "center",
    }
  );

  // 8. Simpan Dokumen sebagai PDF
  const namaFileAman = `${mapel.namaMapel || "Mapel"}_${
    mapel.kelas || "Semua"
  }`.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Laporan_Presensi_Nilai_Jurnal_${namaFileAman}.pdf`);
}
