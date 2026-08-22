import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// HELPER: Mengambil Base64 + Dimensi Asli Gambar
// ============================================================
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
    console.warn("Fetch gambar gagal, fallback ke Canvas...", error);
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
        } catch (err) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }
};

// ============================================================
// HELPER: Bangun URL Barcode / QR
// ============================================================
const buildBarcodeUrl = (fotoUrl) => {
  if (!fotoUrl) return null;
  return (
    "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" +
    encodeURIComponent(fotoUrl)
  );
};

// ============================================================
// HELPER: Nama bulan Indonesia
// ============================================================
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

// ============================================================
// [PERBAIKAN]: Parse Tanggal (Lebih Kuat & Dinamis)
// Mendukung format dd/MM/yyyy, YYYY-MM-DD, dan Date bawaan JS
// ============================================================
const parseTanggal = (tanggalString) => {
  if (!tanggalString) return null;
  const str = String(tanggalString).trim();

  // 1. Coba parse dd/MM/yyyy (mis. 17/08/2026)
  const matchDMY = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (matchDMY) {
    return { year: Number(matchDMY[3]), month: Number(matchDMY[2]) - 1 };
  }

  // 2. Coba parse format ISO YYYY-MM-DD (mis. 2026-08-17)
  const matchISO = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchISO) {
    return { year: Number(matchISO[1]), month: Number(matchISO[2]) - 1 };
  }

  // 3. Fallback JS Date (sangat berguna untuk parse CREATED_AT mis: 8/17/2026 21:31)
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() };
  }

  return null;
};

// ============================================================
// HELPER: Kunci sesi pertemuan kelompok
// ============================================================
const getSesiKelompokKey = (item) => {
  if (!item.idJurnal) return null;
  const parts = String(item.idJurnal).split("-");
  if (parts.length < 3) return null;
  return `${parts[1]}-${parts[2]}`; // YYYYMMDD-HHMMSS
};

// ============================================================
// HELPER: Tentukan Semester & Tahun Ajaran otomatis
// ============================================================
const tentukanSemesterTahunAjaran = (data) => {
  const tanggalValid = data
    // [PERBAIKAN]: Prioritaskan referensi createdAt
    .map((item) =>
      parseTanggal(item.createdAt || item.CREATED_AT || item.tanggal),
    )
    .filter(Boolean);

  if (tanggalValid.length === 0) {
    return { semester: "Ganjil / Genap", tahunAjaran: "-" };
  }

  const terbaru = tanggalValid.reduce((acc, cur) => {
    const accVal = acc.year * 100 + acc.month;
    const curVal = cur.year * 100 + cur.month;
    return curVal > accVal ? cur : acc;
  });

  if (terbaru.month >= 6) {
    return {
      semester: "Ganjil",
      tahunAjaran: `${terbaru.year}/${terbaru.year + 1}`,
    };
  }

  return {
    semester: "Genap",
    tahunAjaran: `${terbaru.year - 1}/${terbaru.year}`,
  };
};

// ============================================================
// HELPER: Susun rekap bulanan per siswa
// ============================================================
const susunRekapBulananPerSiswa = (data) => {
  const totalSesiKelompokPerBulan = new Map();

  // 1. Hitung total sesi Kelompok unik PER BULAN lintas siswa (penyebut persentase)
  data.forEach((item) => {
    if ((item.formatPertemuan || "").toLowerCase() !== "kelompok") return;

    // [PERBAIKAN]: Memakai kolom CREATED_AT untuk bulan
    const tgl = parseTanggal(item.createdAt || item.CREATED_AT || item.tanggal);
    const sesiKey = getSesiKelompokKey(item);
    if (!tgl || !sesiKey) return;

    const bulanKey = `${tgl.year}-${tgl.month}`;
    if (!totalSesiKelompokPerBulan.has(bulanKey)) {
      totalSesiKelompokPerBulan.set(bulanKey, new Set());
    }
    totalSesiKelompokPerBulan.get(bulanKey).add(sesiKey);
  });

  // 2. Kelompokkan data per siswa
  const perSiswa = new Map();

  data.forEach((item) => {
    const idSiswa = item.idSiswa || item.namaSiswa;
    if (!idSiswa) return;

    if (!perSiswa.has(idSiswa)) {
      perSiswa.set(idSiswa, {
        namaSiswa: item.namaSiswa || "-",
        kelas: item.kelas || "-",
        bulan: new Map(),
      });
    }

    const siswaEntry = perSiswa.get(idSiswa);
    // [PERBAIKAN]: Memakai kolom CREATED_AT untuk bulan
    const tgl = parseTanggal(item.createdAt || item.CREATED_AT || item.tanggal);
    if (!tgl) return;

    const bulanKey = `${tgl.year}-${tgl.month}`;
    if (!siswaEntry.bulan.has(bulanKey)) {
      siswaEntry.bulan.set(bulanKey, {
        year: tgl.year,
        month: tgl.month,
        individu: 0,
        kelompok: 0,
        sesiKelompokDiikuti: new Set(),
      });
    }

    const bulanEntry = siswaEntry.bulan.get(bulanKey);
    const isKelompok =
      (item.formatPertemuan || "").toLowerCase() === "kelompok";

    if (isKelompok) {
      bulanEntry.kelompok += 1;
      const sesiKey = getSesiKelompokKey(item);
      if (sesiKey) bulanEntry.sesiKelompokDiikuti.add(sesiKey);
    } else {
      bulanEntry.individu += 1;
    }
  });

  // 3. Bentuk struktur akhir siap-cetak
  const hasil = [];

  perSiswa.forEach((siswaEntry) => {
    const daftarBulan = Array.from(siswaEntry.bulan.values()).sort(
      (a, b) => a.year * 100 + a.month - (b.year * 100 + b.month),
    );

    let totalPertemuan = 0;
    // [PERBAIKAN]: Tracking total individu & kelompok untuk breakdown baris Total
    let totalIndividu = 0;
    let totalKelompok = 0;

    let totalSesiDiikuti = 0;
    let totalSesiTersedia = 0;

    const baris = daftarBulan.map((b) => {
      const bulanKey = `${b.year}-${b.month}`;
      const totalSesiBulanIni = totalSesiKelompokPerBulan.get(bulanKey);
      const sesiTersedia = totalSesiBulanIni ? totalSesiBulanIni.size : 0;
      const sesiDiikuti = b.sesiKelompokDiikuti.size;

      const jumlahPertemuan = b.individu + b.kelompok;

      // Hitung total keseluruhan
      totalPertemuan += jumlahPertemuan;
      totalIndividu += b.individu;
      totalKelompok += b.kelompok;
      totalSesiDiikuti += sesiDiikuti;
      totalSesiTersedia += sesiTersedia;

      const persentase =
        sesiTersedia > 0
          ? `${Math.round((sesiDiikuti / sesiTersedia) * 100)}%`
          : "-";

      return {
        bulan: `${NAMA_BULAN[b.month]} ${b.year}`,
        jumlahPertemuan,
        formatBreakdown: `Individu: ${b.individu} / Kelompok: ${b.kelompok}`,
        persentase,
      };
    });

    const persentaseTotal =
      totalSesiTersedia > 0
        ? `${Math.round((totalSesiDiikuti / totalSesiTersedia) * 100)}%`
        : "-";

    hasil.push({
      namaSiswa: siswaEntry.namaSiswa,
      kelas: siswaEntry.kelas,
      baris,
      totalPertemuan,
      // [PERBAIKAN]: Kirim string gabungan total untuk kolom Format Total
      totalFormatBreakdown: `Individu: ${totalIndividu} / Kelompok: ${totalKelompok}`,
      persentaseTotal,
    });
  });

  return hasil;
};

// ============================================================
// HALAMAN: LAMPIRAN D
// ============================================================
const tambahHalamanLampiranD = (doc, { data, namaGuru }) => {
  const rekapSiswa = susunRekapBulananPerSiswa(data);
  if (rekapSiswa.length === 0) return;

  const { semester, tahunAjaran } = tentukanSemesterTahunAjaran(data);
  const teksNamaGuru = namaGuru || data[0]?.namaGuru || "Guru Wali";

  rekapSiswa.forEach((siswa) => {
    doc.addPage("a4", "portrait");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(
      "LAMPIRAN D: FORMAT PELAPORAN SEMESTER GURU WALI",
      pageWidth / 2,
      16,
      { align: "center" },
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const labelX = 14;
    const colonX = 65;
    let y = 28;
    const lineGap = 6;

    const rows = [
      ["Nama Guru Wali", teksNamaGuru],
      [
        "Kelas/Murid Dampingan",
        `${siswa.namaSiswa}${siswa.kelas && siswa.kelas !== "-" ? " (" + siswa.kelas + ")" : ""}`,
      ],
      ["Semester", semester],
      ["Tahun Ajaran", tahunAjaran],
    ];

    rows.forEach(([label, value]) => {
      doc.text(label, labelX, y);
      doc.text(`: ${value}`, colonX, y);
      y += lineGap;
    });

    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("1. Rekapitulasi Pertemuan", labelX, y);
    y += 4;

    const body = siswa.baris.map((b) => [
      b.bulan,
      String(b.jumlahPertemuan),
      b.formatBreakdown,
      b.persentase,
    ]);

    // [PERBAIKAN]: Menampilkan breakdown di baris Total juga
    body.push([
      "Total",
      String(siswa.totalPertemuan),
      siswa.totalFormatBreakdown, // Sebelumnya string kosong ""
      siswa.persentaseTotal,
    ]);

    const totalRowIndex = body.length - 1;

    autoTable(doc, {
      startY: y + 2,
      head: [
        [
          "Bulan",
          "Jumlah Pertemuan",
          "Format (Individu/Kelompok)",
          "Persentase Kehadiran",
        ],
      ],
      body,
      theme: "grid",

      styles: {
        fontSize: 9.5,
        cellPadding: 3,
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.2,
        valign: "middle",
        halign: "center",
      },

      headStyles: {
        fontStyle: "bold",
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.3,
      },

      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35 },
        2: { cellWidth: 65 },
        3: { cellWidth: 45 },
      },

      margin: { left: 14, right: 14 },

      didParseCell: (cellData) => {
        if (
          cellData.section === "body" &&
          cellData.row.index === totalRowIndex
        ) {
          cellData.cell.styles.fontStyle = "bold";
          cellData.cell.styles.fillColor = [248, 248, 248];
        }
      },
    });
  });
};

/**
 * generateLaporanGuruWaliPDF
 * @param {Object} opts
 * @param {Array}  opts.data - Pastikan objek data berisi createdAt atau CREATED_AT.
 * @param {String} opts.namaGuru
 */
export const generateLaporanGuruWaliPDF = async ({ data, namaGuru }) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Belum ada data jurnal guru wali untuk dicetak.");
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const teksNamaGuru = namaGuru || (data[0] && data[0].namaGuru) || "Guru Wali";

  const tanggalCetak = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SMK NEGERI 1 TELUK KUANTAN", pageWidth / 2, 14, {
    align: "center",
  });

  doc.setFontSize(12);
  doc.text(
    "LAMPIRAN C: FORMAT REKAP PERTEMUAN DENGAN MURID",
    pageWidth / 2,
    21,
    { align: "center" },
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Guru Wali`, 14, 30);
  doc.text(`: ${teksNamaGuru}`, 40, 30);
  doc.text(`Tanggal Cetak`, 14, 36);
  doc.text(`: ${tanggalCetak}`, 40, 36);
  doc.text(`Jumlah Pertemuan`, 200, 30);
  doc.text(`: ${data.length}`, 235, 30);

  const barcodeImages = await Promise.all(
    data.map((item) => {
      const url = buildBarcodeUrl(item.fotoUrl);
      return url ? getBase64Image(url) : Promise.resolve(null);
    }),
  );

  const BARCODE_COL_INDEX = 6;
  const body = data.map((item, idx) => [
    idx + 1,
    item.tanggal || "-",
    `${item.namaSiswa || "-"}${item.kelas && item.kelas !== "-" ? " [" + item.kelas + "]" : ""}`,
    item.topik || "-",
    item.tindakLanjut || "-",
    item.keterangan || "-",
    "",
  ]);

  autoTable(doc, {
    startY: 42,
    head: [
      [
        "No.",
        "Tanggal Pertemuan",
        "Nama Murid",
        "Topik atau Masalah yang Dibahas",
        "Tindak Lanjut",
        "Keterangan",
        "Bukti Foto",
      ],
    ],
    body,
    theme: "grid",

    styles: {
      fontSize: 8.5,
      cellPadding: 2.5,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      valign: "middle",
      minCellHeight: 22,
    },

    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
      halign: "center",
      valign: "middle",
    },

    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 28, halign: "center" },
      2: { cellWidth: 40 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 45 },
      5: { cellWidth: 45 },
      6: { cellWidth: 26, halign: "center" },
    },

    margin: { left: 14, right: 14 },

    didDrawCell: (cellData) => {
      if (
        cellData.section !== "body" ||
        cellData.column.index !== BARCODE_COL_INDEX
      ) {
        return;
      }

      const imgObj = barcodeImages[cellData.row.index];

      if (!imgObj) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.text(
          "Tidak ada",
          cellData.cell.x + cellData.cell.width / 2,
          cellData.cell.y + cellData.cell.height / 2,
          { align: "center", baseline: "middle" },
        );
        return;
      }

      const maxSize = Math.min(
        cellData.cell.width - 4,
        cellData.cell.height - 4,
      );

      const imgX = cellData.cell.x + (cellData.cell.width - maxSize) / 2;
      const imgY = cellData.cell.y + (cellData.cell.height - maxSize) / 2;

      doc.addImage(imgObj.data, "PNG", imgX, imgY, maxSize, maxSize);
    },
  });

  let ttdY = doc.lastAutoTable.finalY + 16;
  if (ttdY > 185) {
    doc.addPage("a4", "landscape");
    ttdY = 30;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Mengetahui,", 220, ttdY);
  doc.text("Guru Wali", 220, ttdY + 5);
  doc.setFont("helvetica", "bold");
  doc.text(teksNamaGuru, 220, ttdY + 30);
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(220, ttdY + 31, 270, ttdY + 31);
  doc.setFont("helvetica", "normal");
  doc.text(`NIP. ${" ".repeat(25)}`, 220, ttdY + 36);

  // Lampiran D
  tambahHalamanLampiranD(doc, { data, namaGuru: teksNamaGuru });

  const namaFileAman = teksNamaGuru.replace(/[^a-zA-Z0-9_]/g, "_");
  doc.save(`Laporan_Jurnal_GuruWali_${namaFileAman}.pdf`);
};
