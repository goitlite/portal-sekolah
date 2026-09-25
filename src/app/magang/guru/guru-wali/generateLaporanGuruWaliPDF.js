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
    "https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=" +
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

  // 3. Fallback JS Date
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
// HELPER: Gabungkan baris jurnal Kelompok jadi SATU baris tabel
//
// Backend menyimpan satu baris per SISWA (bahkan untuk pertemuan
// Kelompok), tapi semua siswa dalam satu pertemuan yang sama
// berbagi ID_JURNAL yang sama ("SATU PERTEMUAN = SATU ID_JURNAL").
// Jadi cukup dikelompokkan berdasarkan idJurnal: pertemuan Individu
// otomatis tetap 1 baris (karena idJurnal-nya unik per siswa),
// sedangkan pertemuan Kelompok otomatis melebur jadi 1 baris berisi
// daftar semua nama siswa yang ikut.
// ============================================================
const susunBarisLaporanC = (data) => {
  const map = new Map();
  const urutanKey = [];

  data.forEach((item, idx) => {
    const key = item.idJurnal || `row-${idx}`;

    if (!map.has(key)) {
      map.set(key, {
        tanggal: item.tanggal || "-",
        formatPertemuan: item.formatPertemuan || "-",
        topik: item.topik || "-",
        tindakLanjut: item.tindakLanjut || "-",
        keterangan: item.keterangan || "-",
        fotoUrl: item.fotoUrl || "",
        siswaList: [],
      });
      urutanKey.push(key);
    }

    const entry = map.get(key);
    const namaLengkap = `${item.namaSiswa || "-"}${
      item.kelas && item.kelas !== "-" ? " [" + item.kelas + "]" : ""
    }`;
    entry.siswaList.push(namaLengkap);
  });

  return urutanKey.map((key) => map.get(key));
};

// ============================================================
// HELPER: Tentukan Semester & Tahun Ajaran otomatis
// ============================================================
const tentukanSemesterTahunAjaran = (data) => {
  const tanggalValid = data
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

  data.forEach((item) => {
    if ((item.formatPertemuan || "").toLowerCase() !== "kelompok") return;

    const tgl = parseTanggal(item.createdAt || item.CREATED_AT || item.tanggal);
    const sesiKey = getSesiKelompokKey(item);
    if (!tgl || !sesiKey) return;

    const bulanKey = `${tgl.year}-${tgl.month}`;
    if (!totalSesiKelompokPerBulan.has(bulanKey)) {
      totalSesiKelompokPerBulan.set(bulanKey, new Set());
    }
    totalSesiKelompokPerBulan.get(bulanKey).add(sesiKey);
  });

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

  const hasil = [];

  perSiswa.forEach((siswaEntry) => {
    const daftarBulan = Array.from(siswaEntry.bulan.values()).sort(
      (a, b) => a.year * 100 + a.month - (b.year * 100 + b.month),
    );

    let totalPertemuan = 0;
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
    doc.setFontSize(11); // Diperkecil dari 13
    doc.text(
      "LAMPIRAN D: FORMAT PELAPORAN SEMESTER GURU WALI",
      pageWidth / 2,
      12, // Margin atas dikurangi
      { align: "center" },
    );

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9); // Diperkecil dari 10
    const labelX = 14;
    const colonX = 55; // Disesuaikan agar lebih rapat
    let y = 20; // Mulai lebih ke atas
    const lineGap = 4.5; // Jarak antar baris diperkecil

    const rows = [
      ["Nama Guru Wali", teksNamaGuru],
      [
        "Murid Dampingan/ Kelas",
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

    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9); // Diperkecil
    doc.text("1. Rekapitulasi Pertemuan", labelX, y);
    y += 3;

    const body = siswa.baris.map((b) => [
      b.bulan,
      String(b.jumlahPertemuan),
      b.formatBreakdown,
      b.persentase,
    ]);

    body.push([
      "Total",
      String(siswa.totalPertemuan),
      siswa.totalFormatBreakdown,
      siswa.persentaseTotal,
    ]);

    const totalRowIndex = body.length - 1;

    autoTable(doc, {
      startY: y + 1,
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
        fontSize: 8.5, // Diperkecil
        cellPadding: 1.5, // Padding dikurangi drastis
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.15,
        valign: "middle",
        halign: "center",
      },

      headStyles: {
        fontStyle: "bold",
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        lineColor: [0, 0, 0],
        lineWidth: 0.15,
      },

      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 35 },
        2: { cellWidth: 65 },
        3: { cellWidth: 45 },
      },

      margin: { left: 14, right: 14, bottom: 10 }, // Margin disesuaikan

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

  // Baris tabel yang sudah dikelompokkan: pertemuan Kelompok jadi
  // satu baris berisi semua nama siswa, pertemuan Individu tetap
  // satu baris per siswa seperti biasa.
  const barisLaporan = susunBarisLaporanC(data);

  const tanggalCetak = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  doc.setFontSize(11); // Diperkecil
  doc.setFont("helvetica", "bold"); // Bold untuk judul
  doc.text(
    "LAMPIRAN C: FORMAT REKAP PERTEMUAN DENGAN MURID",
    pageWidth / 2,
    12, // Lebih naik
    { align: "center" }, // Diganti ke center agar lebih rapi
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9); // Diperkecil
  doc.text(`Guru Wali`, 14, 20);
  doc.text(`: ${teksNamaGuru}`, 40, 20);
  doc.text(`Tanggal Cetak`, 14, 25);
  doc.text(`: ${tanggalCetak}`, 40, 25);
  doc.text(`Jumlah Pertemuan`, 200, 20);
  doc.text(`: ${barisLaporan.length}`, 235, 20);

  const barcodeImages = await Promise.all(
    barisLaporan.map((item) => {
      const url = buildBarcodeUrl(item.fotoUrl);
      return url ? getBase64Image(url) : Promise.resolve(null);
    }),
  );

  const BARCODE_COL_INDEX = 6;
  const body = barisLaporan.map((item, idx) => {
    const isKelompok = item.siswaList.length > 1;
    const namaMuridCell = isKelompok
      ? `Format Kelompok:\n${item.siswaList.map((nama) => `•  ${nama}`).join("\n")}`
      : item.siswaList[0] || "-";

    return [
      idx + 1,
      item.tanggal || "-",
      namaMuridCell,
      item.topik || "-",
      item.tindakLanjut || "-",
      item.keterangan || "-",
      "",
    ];
  });

  autoTable(doc, {
    startY: 30, // Tabel mulai lebih atas
    head: [
      [
        "No.",
        "Tanggal", // Disingkat
        "Nama Murid",
        "Topik Pembahasan", // Disingkat
        "Tindak Lanjut",
        "Keterangan",
        "Bukti", // Disingkat
      ],
    ],
    body,
    theme: "grid",

    styles: {
      fontSize: 7.5, // Diperkecil signifikan untuk memuat teks lebih banyak
      cellPadding: 1.8, // Padding sedikit dilonggarkan agar lebih nyaman dibaca
      textColor: [30, 41, 59], // slate-800, lebih soft dari hitam pekat
      lineColor: [203, 213, 225], // slate-300, garis antar sel lebih tipis/soft
      lineWidth: 0.1,
      valign: "middle",
      minCellHeight: 14, // Minimum height dikurangi agar row lebih rapat
    },

    headStyles: {
      fontStyle: "bold",
      fillColor: [37, 99, 235], // biru (blue-600) — senada dengan tabel Mapel
      textColor: [255, 255, 255],
      lineColor: [37, 99, 235],
      lineWidth: 0.1,
      halign: "center",
      valign: "middle",
      fontSize: 8,
    },

    alternateRowStyles: {
      fillColor: [239, 246, 255], // biru sangat muda (blue-50) — pembeda tipis antar baris
    },

    columnStyles: {
      0: { cellWidth: 8, halign: "center" }, // No. diperkecil
      1: { cellWidth: 18, halign: "center" }, // Tanggal diperkecil
      2: { cellWidth: 35 }, // Nama Murid
      3: { cellWidth: "auto" }, // Topik (akan mengambil sisa ruang)
      4: { cellWidth: 50 }, // Tindak Lanjut sedikit diperlebar
      5: { cellWidth: 40 }, // Keterangan dikurangi sedikit
      6: { cellWidth: 16, halign: "center" }, // Kolom Bukti/Barcode dikompresi
    },

    margin: { left: 10, right: 10, bottom: 10 }, // Margin kanan/kiri/bawah lebih kecil

    didDrawCell: (cellData) => {
      if (
        cellData.section !== "body" ||
        cellData.column.index !== BARCODE_COL_INDEX
      ) {
        return;
      }

      const imgObj = barcodeImages[cellData.row.index];

      if (!imgObj) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "italic");
        doc.text(
          "-",
          cellData.cell.x + cellData.cell.width / 2,
          cellData.cell.y + cellData.cell.height / 2,
          { align: "center", baseline: "middle" },
        );
        return;
      }

      // Perkecil ukuran maksimal gambar barcode agar pas di sel kecil
      const maxSize = Math.min(
        cellData.cell.width - 2, // Margin barcode sangat tipis
        cellData.cell.height - 2,
      );

      const imgX = cellData.cell.x + (cellData.cell.width - maxSize) / 2;
      const imgY = cellData.cell.y + (cellData.cell.height - maxSize) / 2;

      doc.addImage(imgObj.data, "PNG", imgX, imgY, maxSize, maxSize);
    },
  });

  let ttdY = doc.lastAutoTable.finalY + 12; // Jarak TTD dikurangi
  if (ttdY > 185) {
    // Threshold page break disesuaikan landscape
    doc.addPage("a4", "landscape");
    ttdY = 20;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Mengetahui,", 230, ttdY); // Posisi X digeser karena margin beda
  doc.text("Guru Wali", 230, ttdY + 4);
  doc.setFont("helvetica", "bold");
  doc.text(teksNamaGuru, 230, ttdY + 22); // Ruang tanda tangan dikurangi sedikit
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.line(230, ttdY + 23, 276, ttdY + 23); // Panjang garis NIP disesuaikan
  doc.setFont("helvetica", "normal");
  doc.text(`NIP. ${" ".repeat(20)}`, 230, ttdY + 27);

  // Lampiran D
  tambahHalamanLampiranD(doc, { data, namaGuru: teksNamaGuru });

  const namaFileAman = teksNamaGuru.replace(/[^a-zA-Z0-9_]/g, "_");
  doc.save(`Laporan_Jurnal_GuruWali_${namaFileAman}.pdf`);
};
