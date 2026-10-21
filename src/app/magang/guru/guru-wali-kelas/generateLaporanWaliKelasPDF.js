import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getPresensiWaliGrid, getJurnalWaliKelas } from "../../lib/api";

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
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext("2d").drawImage(img, 0, 0);
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

// QR Barcode dari fotoUrl
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

function hitungTahunAjaran(daftarTanggal) {
  const ref =
    daftarTanggal && daftarTanggal.length > 0
      ? new Date([...daftarTanggal].sort().pop())
      : new Date();
  const y = ref.getFullYear();
  const m = ref.getMonth();
  return m >= 6 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

// Footer nomor halaman
function footerFn(doc) {
  return (data) => {
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    doc.text("https://portalsmkn1telku.vercel.app/", 14, ph - 7);
    doc.text(
      `Dicetak: ${formatTanggalIndo(new Date())} | Hal. ${data.pageNumber}`,
      pw - 14,
      ph - 7,
      { align: "right" },
    );
  };
}

// Gambar kop surat
async function gambarKop(doc, judul) {
  const pw = doc.internal.pageSize.getWidth();
  const logo = await getBase64Image("/logo.png");
  if (logo && logo.data) {
    const h = 18,
      w = (logo.width / logo.height) * h;
    doc.addImage(logo.data, "PNG", 14, 10, w, h);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text("SMK NEGERI 1 TELUK KUANTAN", 36, 15);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(judul, 36, 21);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Website: https://portalsmkn1telku.vercel.app/ | Sistem Akademik & Magang",
    36,
    26,
  );
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(14, 29, pw - 14, 29);
  doc.setLineWidth(0.2);
  doc.line(14, 30, pw - 14, 30);
}

// Tanda tangan kanan bawah
function gambarTTD(doc, guru) {
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  let y = (doc.lastAutoTable?.finalY || 150) + 8;
  if (y > ph - 42) {
    doc.addPage("a4", "landscape");
    y = 20;
  }
  const cx = pw - 65;
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.text(`Teluk Kuantan, ${formatTanggalIndo(new Date())}`, cx, y, {
    align: "center",
  });
  doc.text("Guru Wali Kelas,", cx, y + 4.5, { align: "center" });
  const nm = guru?.nama || "-";
  doc.setFont("helvetica", "bold");
  doc.text(nm, cx, y + 22, { align: "center" });
  const tw = doc.getTextWidth(nm);
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.line(cx - tw / 2, y + 23, cx + tw / 2, y + 23);
  doc.setFont("helvetica", "normal");
  doc.text(`NIP. ${guru?.nip || "..........................."}`, cx, y + 27, {
    align: "center",
  });
}

// ============================================================
// HELPER: filter tanggal berdasarkan bulan & tahun
// ============================================================
function filterTanggalBulan(daftarTanggal, bulan, tahun) {
  if (!bulan || !tahun) return daftarTanggal;
  return daftarTanggal.filter((tgl) => {
    const d = new Date(tgl);
    return (
      !isNaN(d) && d.getMonth() + 1 === bulan && d.getFullYear() === tahun
    );
  });
}

// ============================================================
// HELPER: kelompokkan baris jurnal per sesi (idJurnal)
// Mendukung data lama (tiap siswa punya idJurnal berbeda) dengan
// fallback grouping: tanggal + topik + createdAt (resolusi menit)
// ============================================================
function kelompokkanJurnal(rows) {
  const byIdJurnal = new Map();
  rows.forEach((r) => {
    if (!r.idJurnal) return;
    if (!byIdJurnal.has(r.idJurnal)) byIdJurnal.set(r.idJurnal, []);
    byIdJurnal.get(r.idJurnal).push(r);
  });

  const merged = new Map();

  rows.forEach((r) => {
    const jurnalId = r.idJurnal || "";
    const rowsInGroup = byIdJurnal.get(jurnalId) || [];

    let groupKey;
    if (jurnalId && rowsInGroup.length > 1) {
      groupKey = `id:${jurnalId}`;
    } else {
      const createdMinute = String(r.createdAt || "").substring(0, 16);
      const topikKey = String(r.topik || "").trim().substring(0, 60);
      groupKey = `legacy:${r.tanggal}|${topikKey}|${createdMinute}`;
    }

    if (!merged.has(groupKey)) {
      merged.set(groupKey, {
        idJurnal: jurnalId,
        tanggal: r.tanggal,
        formatPertemuan: r.formatPertemuan || "Individu",
        topik: r.topik || "-",
        tindakLanjut: r.tindakLanjut || "-",
        keterangan: r.keterangan || "",
        fotoUrl: r.fotoUrl || "",
        siswaList: [],
      });
    }
    const nama = r.namaSiswa || r.nama || "";
    if (nama && !merged.get(groupKey).siswaList.includes(nama)) {
      merged.get(groupKey).siswaList.push(nama);
    }
  });

  return Array.from(merged.values()).sort((a, b) => {
    const ta = new Date(a.tanggal).getTime() || 0;
    const tb = new Date(b.tanggal).getTime() || 0;
    return ta - tb;
  });
}

// ============================================================
// === BAGIAN A.1 & A.2: KEHADIRAN (Presensi Harian & Rekap Total) ===
// ============================================================
async function lampiranA(doc, { guru, wali, siswaList, grid, daftarTanggal, bulanLabel }) {
  await gambarKop(doc, "A. KEHADIRAN — LAPORAN PRESENSI HARIAN WALI KELAS");

  const ta = hitungTahunAjaran(daftarTanggal);
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Kelas", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${wali.namaKelas || "-"}`, 42, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Tahun Ajaran", 14, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${ta}`, 42, 41);
  doc.setFont("helvetica", "bold");
  doc.text("Guru Wali Kelas", 160, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${guru?.nama || "-"}`, 195, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Periode Laporan", 160, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${bulanLabel}`, 195, 41);

  // 3 Kartu statistik
  let totalH = 0,
    totalCell = 0;
  siswaList.forEach((s) => {
    daftarTanggal.forEach((tgl) => {
      const c = grid?.[`${s.idSiswa}_${tgl}`];
      if (c?.status) {
        totalCell++;
        if (c.status === "Hadir") totalH++;
      }
    });
  });
  const rata =
    totalCell > 0 ? `${Math.round((totalH / totalCell) * 100)}%` : "-";
  const cards = [
    { label: "Total Siswa", val: String(siswaList.length) },
    { label: "Hari Efektif", val: String(daftarTanggal.length) },
    { label: "Rata-rata Kehadiran", val: rata },
  ];
  const cW = 55,
    cH = 12,
    cG = 8,
    cX0 = 14,
    cY = 44;
  cards.forEach((k, i) => {
    const x = cX0 + i * (cW + cG);
    doc.setFillColor(37, 99, 235);
    doc.setDrawColor(37, 99, 235);
    doc.roundedRect(x, cY, cW, cH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(k.label, x + cW / 2, cY + 4, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(k.val, x + cW / 2, cY + 9.5, { align: "center" });
  });

  // Warna status
  const SC = {
    Hadir: [220, 252, 231],
    Sakit: [219, 234, 254],
    Izin: [254, 243, 199],
    Alfa: [254, 226, 226],
    Cabut: [237, 233, 254],
  };
  const STC = {
    Hadir: [22, 163, 74],
    Sakit: [37, 99, 235],
    Izin: [217, 119, 6],
    Alfa: [220, 38, 38],
    Cabut: [109, 40, 217],
  };

  // Chunks maks 20 tanggal per tabel
  const CHUNK = 20;
  const chunks = [];
  for (let i = 0; i < daftarTanggal.length; i += CHUNK)
    chunks.push(daftarTanggal.slice(i, i + CHUNK));
  if (chunks.length === 0) chunks.push([]);

  let firstChunk = true;
  for (const chunkTgl of chunks) {
    if (!firstChunk) {
      doc.addPage("a4", "landscape");
      await gambarKop(doc, "A. KEHADIRAN — LAPORAN PRESENSI HARIAN (Sambungan)");
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Kelas: ${wali.namaKelas || "-"} — Guru: ${guru?.nama || "-"} — ${bulanLabel}`,
        14,
        36,
      );
    }
    const startY = firstChunk ? 59 : 40;
    firstChunk = false;

    const headCols = [
      { content: "No", styles: { halign: "center" } },
      { content: "Nama Siswa", styles: { halign: "left" } },
      ...chunkTgl.map((tgl) => {
        try {
          const d = new Date(tgl);
          const label = isNaN(d)
            ? tgl
            : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
          return { content: label, styles: { halign: "center" } };
        } catch {
          return { content: tgl, styles: { halign: "center" } };
        }
      }),
      { content: "H", styles: { halign: "center" } },
      { content: "S", styles: { halign: "center" } },
      { content: "I", styles: { halign: "center" } },
      { content: "A", styles: { halign: "center" } },
      { content: "C", styles: { halign: "center" } },
      { content: "%", styles: { halign: "center" } },
    ];

    const tableRows = siswaList.map((s, idx) => {
      const row = [idx + 1, s.nama || "-"];
      let h = 0,
        sk = 0,
        iz = 0,
        a = 0,
        c = 0;
      chunkTgl.forEach((tgl) => {
        const st = grid?.[`${s.idSiswa}_${tgl}`]?.status || "";
        switch (st) {
          case "Hadir":
            h++;
            row.push("H");
            break;
          case "Sakit":
            sk++;
            row.push("S");
            break;
          case "Izin":
            iz++;
            row.push("I");
            break;
          case "Alfa":
            a++;
            row.push("A");
            break;
          case "Cabut":
            c++;
            row.push("C");
            break;
          default:
            row.push("-");
            break;
        }
      });

      let hAll = 0,
        baseAll = 0;
      daftarTanggal.forEach((tgl) => {
        const st = grid?.[`${s.idSiswa}_${tgl}`]?.status || "";
        if (st) {
          baseAll++;
          if (st === "Hadir") hAll++;
        }
      });
      const pct = baseAll > 0 ? `${Math.round((hAll / baseAll) * 100)}%` : "-";
      row.push(h, sk, iz, a, c, pct);
      return row;
    });

    const totalRow = ["", "Total Hadir"];
    chunkTgl.forEach((tgl) => {
      let cnt = 0;
      siswaList.forEach((s) => {
        if (grid?.[`${s.idSiswa}_${tgl}`]?.status === "Hadir") cnt++;
      });
      totalRow.push(cnt > 0 ? String(cnt) : "-");
    });
    totalRow.push("", "", "", "", "", "");
    tableRows.push(totalRow);

    const totalRowIndex = tableRows.length - 1;
    const rekIdx = 2 + chunkTgl.length;
    const colStyles = {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 45, halign: "left" },
    };
    for (let i = 2; i < rekIdx; i++) colStyles[i] = { halign: "center" };
    [0, 1, 2, 3, 4].forEach((_, off) => {
      colStyles[rekIdx + off] = { cellWidth: 7, halign: "center" };
    });
    colStyles[rekIdx + 5] = {
      cellWidth: 12,
      halign: "center",
      fontStyle: "bold",
    };

    autoTable(doc, {
      startY,
      head: [headCols],
      body: tableRows,
      theme: "grid",
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 7.5,
        halign: "center",
        valign: "middle",
        lineWidth: 0.15,
        minCellHeight: 8,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
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
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const {
          row: { index: ri },
          column: { index: ci },
          cell,
        } = data;
        if (ri === totalRowIndex) {
          cell.styles.fontStyle = "bold";
          cell.styles.fillColor = [241, 245, 249];
          cell.styles.textColor = [15, 23, 42];
          return;
        }
        if (ci >= 2 && ci < rekIdx && SC[cell.raw]) {
          cell.styles.fillColor = SC[cell.raw];
          cell.styles.textColor = STC[cell.raw];
          cell.styles.fontStyle = "bold";
        }
        if (ci === rekIdx + 5) {
          const num = parseFloat(String(cell.raw).replace("%", ""));
          if (!isNaN(num)) {
            if (num < 75) {
              cell.styles.fillColor = [254, 226, 226];
              cell.styles.textColor = [220, 38, 38];
              cell.styles.fontStyle = "bold";
            } else if (num < 85) {
              cell.styles.fillColor = [254, 249, 195];
              cell.styles.textColor = [161, 98, 7];
              cell.styles.fontStyle = "bold";
            } else {
              cell.styles.fillColor = [220, 252, 231];
              cell.styles.textColor = [22, 163, 74];
              cell.styles.fontStyle = "bold";
            }
          }
        }
      },
      didDrawPage: footerFn(doc),
    });
  }

  // ============================================================
  // REKAPITULASI TOTAL PRESENSI SISWA (halaman tersendiri)
  // ============================================================
  doc.addPage("a4", "landscape");
  await gambarKop(doc, "A. KEHADIRAN — REKAPITULASI TOTAL PRESENSI SISWA");

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Kelas", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${wali.namaKelas || "-"}`, 42, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Tahun Ajaran", 14, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${ta}`, 42, 41);
  doc.setFont("helvetica", "bold");
  doc.text("Guru Wali Kelas", 160, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${guru?.nama || "-"}`, 195, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Periode Laporan", 160, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${bulanLabel}`, 195, 41);

  const totalHeadCols = [
    [
      { content: "No", styles: { halign: "center" } },
      { content: "Nama Siswa", styles: { halign: "left" } },
      { content: "Hadir (H)", styles: { halign: "center" } },
      { content: "Sakit (S)", styles: { halign: "center" } },
      { content: "Izin (I)", styles: { halign: "center" } },
      { content: "Alfa (A)", styles: { halign: "center" } },
      { content: "Cabut (C)", styles: { halign: "center" } },
      { content: "Total Kehadiran", styles: { halign: "center" } },
      { content: "Persentase (%)", styles: { halign: "center" } },
    ],
  ];

  const totalTableRows = siswaList.map((s, idx) => {
    let h = 0,
      sk = 0,
      iz = 0,
      a = 0,
      c = 0,
      tot = 0;
    daftarTanggal.forEach((tgl) => {
      const st = grid?.[`${s.idSiswa}_${tgl}`]?.status || "";
      if (st) {
        tot++;
        if (st === "Hadir") h++;
        else if (st === "Sakit") sk++;
        else if (st === "Izin") iz++;
        else if (st === "Alfa") a++;
        else if (st === "Cabut") c++;
      }
    });
    const pct = tot > 0 ? `${Math.round((h / tot) * 100)}%` : "0%";
    return [idx + 1, s.nama || "-", h, sk, iz, a, c, `${h} / ${tot}`, pct];
  });

  autoTable(doc, {
    startY: 46,
    head: totalHeadCols,
    body: totalTableRows,
    theme: "grid",
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      minCellHeight: 8,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      valign: "middle",
      minCellHeight: 6,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto", halign: "left" },
      2: { cellWidth: 22, halign: "center" },
      3: { cellWidth: 22, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 22, halign: "center" },
      6: { cellWidth: 22, halign: "center" },
      7: { cellWidth: 30, halign: "center" },
      8: { cellWidth: 28, halign: "center", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14, bottom: 18 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 8) {
        const num = parseFloat(String(data.cell.raw).replace("%", ""));
        if (!isNaN(num)) {
          if (num < 75) {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [220, 38, 38];
          } else if (num < 85) {
            data.cell.styles.fillColor = [254, 249, 195];
            data.cell.styles.textColor = [161, 98, 7];
          } else {
            data.cell.styles.fillColor = [220, 252, 231];
            data.cell.styles.textColor = [22, 163, 74];
          }
        }
      }
    },
    didDrawPage: footerFn(doc),
  });

  gambarTTD(doc, guru);
}

// ============================================================
// === BAGIAN B: JURNAL BIMBINGAN WALI KELAS ===
// ============================================================
async function lampiranB(doc, { guru, wali, jurnalList, bulanLabel }) {
  doc.addPage("a4", "landscape");
  const pw = doc.internal.pageSize.getWidth();
  await gambarKop(doc, "B. JURNAL BIMBINGAN WALI KELAS");

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Kelas", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${wali.namaKelas || "-"}`, 42, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Guru Wali Kelas", 160, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${guru?.nama || "-"}`, 195, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Periode Laporan", 14, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${bulanLabel}`, 42, 41);
  doc.setFont("helvetica", "bold");
  doc.text("Jumlah Entri", 160, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${jurnalList.length} Sesi Bimbingan`, 195, 41);

  if (!jurnalList || jurnalList.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Tidak ada catatan jurnal bimbingan pada ${bulanLabel}.`,
      pw / 2,
      60,
      { align: "center" },
    );
    gambarTTD(doc, guru);
    return;
  }

  const barcodeImages = await Promise.all(
    jurnalList.map((item) => {
      const url = buildBarcodeUrl(item.fotoUrl);
      return url ? getBase64Image(url) : Promise.resolve(null);
    }),
  );

  const BARCODE_COL = 7;
  const body = jurnalList.map((item, idx) => {
    const ketBersih = (item.keterangan || "")
      .replace(/\[[A-Z0-9_:,|]+\]/gi, "")
      .trim();

    const isSemuaSiswa =
      item.keterangan && item.keterangan.includes("[SEMUA_SISWA]");
    const namaTampil = isSemuaSiswa
      ? "Seluruh Siswa Kelas"
      : (item.siswaList || []).join(", ") || item.namaSiswa || "-";

    return [
      idx + 1,
      item.tanggal || "-",
      namaTampil,
      item.formatPertemuan || "-",
      item.topik || "-",
      item.tindakLanjut || "-",
      ketBersih || "-",
      "",
    ];
  });

  autoTable(doc, {
    startY: 46,
    head: [
      [
        "No",
        "Tanggal",
        "Nama Siswa / Kelompok",
        "Format",
        "Topik Pembahasan",
        "Tindak Lanjut",
        "Keterangan",
        "Barcode Foto",
      ],
    ],
    body,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: "middle",
      minCellHeight: 18,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
      valign: "middle",
      lineWidth: 0.15,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 20, halign: "center" },
      2: { cellWidth: 42 },
      3: { cellWidth: 18, halign: "center" },
      4: { cellWidth: "auto" },
      5: { cellWidth: 45 },
      6: { cellWidth: 35 },
      7: { cellWidth: 18, halign: "center" },
    },
    margin: { left: 14, right: 14, bottom: 18 },
    didDrawCell: (cellData) => {
      if (cellData.section !== "body" || cellData.column.index !== BARCODE_COL)
        return;
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
      const maxSize = Math.min(
        cellData.cell.width - 2,
        cellData.cell.height - 2,
      );
      doc.addImage(
        imgObj.data,
        "PNG",
        cellData.cell.x + (cellData.cell.width - maxSize) / 2,
        cellData.cell.y + (cellData.cell.height - maxSize) / 2,
        maxSize,
        maxSize,
      );
    },
    didDrawPage: footerFn(doc),
  });

  gambarTTD(doc, guru);
}

// ============================================================
// === BAGIAN C: KONDISI KELAS & INVENTARIS ===
// ============================================================
async function lampiranC(doc, { guru, wali, kondisiKelas, bulanLabel }) {
  doc.addPage("a4", "landscape");
  await gambarKop(doc, "C. KONDISI KELAS & INVENTARIS");

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Kelas", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${wali.namaKelas || "-"}`, 42, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Guru Wali Kelas", 160, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${guru?.nama || "-"}`, 195, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Periode Laporan", 14, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${bulanLabel}`, 42, 41);
  doc.setFont("helvetica", "bold");
  doc.text("Tanggal Evaluasi", 160, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${formatTanggalIndo(new Date())}`, 195, 41);

  const listData = Array.isArray(kondisiKelas) && kondisiKelas.length > 0
    ? kondisiKelas
    : [
        {
          pelaksanaanPiket: "Regu Piket Kelas (Senin - Jumat) aktif membersihkan ruangan, membuang sampah, dan menata meja/kursi sebelum KBM & setelah pulang sekolah.",
          inventarisKelas: "Meja Siswa (36 Baik), Kursi Siswa (36 Baik), Meja & Kursi Guru (1 Set Baik), Whiteboard & Spidol (Baik), Kipas Angin (2 Unit Berfungsi Baik), Jam Dinding (1 Unit Aktif).",
          keterangan: "Ruangan bersih, tertib, dan sarana prasarana terpelihara dengan baik.",
        },
      ];

  const tableBody = listData.map((row, idx) => [
    idx + 1,
    row.pelaksanaanPiket || "-",
    row.inventarisKelas || "-",
    row.keterangan || "-",
  ]);

  autoTable(doc, {
    startY: 47,
    head: [
      [
        "No",
        "Pelaksanaan Piket Kebersihan",
        "Inventaris & Sarana Prasarana Kelas",
        "Keterangan / Evaluasi",
      ],
    ],
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: "top",
      minCellHeight: 14,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
      lineWidth: 0.15,
      minCellHeight: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 90, halign: "left" },
      2: { cellWidth: 95, halign: "left" },
      3: { cellWidth: "auto", halign: "left" },
    },
    margin: { left: 14, right: 14, bottom: 18 },
    didDrawPage: footerFn(doc),
  });

  gambarTTD(doc, guru);
}

// ============================================================
// === BAGIAN D: REKAPITULASI MUTASI SISWA ===
// ============================================================
async function lampiranD(doc, { guru, wali, mutasiSiswa, totalSiswa, bulanLabel }) {
  doc.addPage("a4", "landscape");
  await gambarKop(doc, "D. REKAPITULASI MUTASI SISWA");

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.text("Kelas", 14, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${wali.namaKelas || "-"}`, 42, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Guru Wali Kelas", 160, 36);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${guru?.nama || "-"}`, 195, 36);
  doc.setFont("helvetica", "bold");
  doc.text("Periode Laporan", 14, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${bulanLabel}`, 42, 41);
  doc.setFont("helvetica", "bold");
  doc.text("Tanggal Cetak", 160, 41);
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${formatTanggalIndo(new Date())}`, 195, 41);

  const rawList = Array.isArray(mutasiSiswa) ? mutasiSiswa.filter(m => m && (m.nama || m.keterangan)) : [];

  let countMasuk = 0;
  let countKeluar = 0;
  rawList.forEach((m) => {
    if (String(m.jenis || "").toLowerCase().includes("masuk")) {
      countMasuk++;
    } else {
      countKeluar++;
    }
  });

  // Summary box
  const cards = [
    { label: "Total Siswa Terdaftar", val: String(totalSiswa || "-") },
    { label: "Mutasi Masuk (+)", val: String(countMasuk) },
    { label: "Mutasi Keluar (-)", val: String(countKeluar) },
  ];
  const cW = 55,
    cH = 12,
    cG = 8,
    cX0 = 14,
    cY = 44;
  cards.forEach((k, i) => {
    const x = cX0 + i * (cW + cG);
    doc.setFillColor(37, 99, 235);
    doc.setDrawColor(37, 99, 235);
    doc.roundedRect(x, cY, cW, cH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text(k.label, x + cW / 2, cY + 4, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(k.val, x + cW / 2, cY + 9.5, { align: "center" });
  });

  let tableBody = [];
  if (rawList.length === 0) {
    tableBody = [
      [
        "-",
        "NIHIL (Tidak ada mutasi siswa masuk atau keluar pada periode ini)",
        "-",
        "-",
        "-",
      ],
    ];
  } else {
    tableBody = rawList.map((m, idx) => [
      idx + 1,
      m.nama || "-",
      m.jenis || "Mutasi Keluar",
      m.tanggal || "-",
      m.keterangan || "-",
    ]);
  }

  autoTable(doc, {
    startY: 59,
    head: [
      [
        "No",
        "Nama Siswa",
        "Jenis Mutasi",
        "Tanggal Mutasi",
        "Keterangan / Alasan / Asal / Tujuan",
      ],
    ],
    body: tableBody,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [30, 41, 59],
      lineColor: [203, 213, 225],
      lineWidth: 0.15,
      valign: "middle",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: [37, 99, 235],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8.5,
      halign: "center",
      valign: "middle",
      lineWidth: 0.15,
      minCellHeight: 9,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: 70, halign: "left" },
      2: { cellWidth: 32, halign: "center", fontStyle: "bold" },
      3: { cellWidth: 32, halign: "center" },
      4: { cellWidth: "auto", halign: "left" },
    },
    margin: { left: 14, right: 14, bottom: 18 },
    didParseCell: (data) => {
      if (data.section !== "body") return;
      if (data.column.index === 2) {
        const val = String(data.cell.raw).toLowerCase();
        if (val.includes("masuk")) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fillColor = [220, 252, 231];
        } else if (val.includes("keluar")) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fillColor = [254, 226, 226];
        }
      }
    },
    didDrawPage: footerFn(doc),
  });

  gambarTTD(doc, guru);
}

// ============================================================
// EXPORT UTAMA
// ============================================================
export async function generateLaporanWaliKelasPDF({
  guru,
  wali,
  siswaList: siswaListProp,
  grid: gridProp,
  daftarTanggal: daftarTanggalProp,
  jurnalList: jurnalListProp,
  bulan, // 1-12, opsional (null jika cetakSemua)
  tahun, // 4-digit year, opsional
  cetakSemua = false,
  kondisiKelas = [],
  mutasiSiswa = [],
  includeKondisiKelas = true,
  includeMutasiSiswa = true,
}) {
  let siswaList = siswaListProp;
  let grid = gridProp;
  let daftarTanggalAll = daftarTanggalProp || [];
  let jurnalListAll = jurnalListProp;

  // Ambil data presensi jika belum ada
  if (!siswaList || !grid) {
    try {
      const res = await getPresensiWaliGrid(guru.id, wali.idWali);
      const data = res.success ? res.data : {};

      siswaList = (data.siswa || [])
        .slice()
        .map((s) => ({ ...s, nama: s.namaSiswa || s.nama || "" }))
        .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));

      const gridBaru = {};
      const tanggalSet = new Set();
      (data.presensi || []).forEach((p) => {
        if (!p.tanggal) return;
        tanggalSet.add(p.tanggal);
        gridBaru[`${p.idSiswa}_${p.tanggal}`] = {
          status: p.status || "",
          keterangan: p.keterangan || "",
        };
      });
      grid = gridBaru;
      daftarTanggalAll =
        data.daftarTanggal && data.daftarTanggal.length > 0
          ? [...data.daftarTanggal].sort()
          : [...tanggalSet].sort();
    } catch (err) {
      console.error("Gagal mengambil data presensi wali kelas:", err);
      throw new Error("Gagal mengambil data presensi untuk cetak laporan.");
    }
  }

  // Ambil data jurnal jika belum ada
  if (!jurnalListAll) {
    try {
      const res = await getJurnalWaliKelas(guru.id, wali.idWali);
      jurnalListAll = res.success ? res.data || [] : [];
    } catch {
      jurnalListAll = [];
    }
  }

  const isFilterBulan = !cetakSemua && !!bulan && !!tahun;

  // Filter tanggal presensi berdasarkan bulan & tahun jika dipilih
  const daftarTanggal = isFilterBulan
    ? filterTanggalBulan(daftarTanggalAll, bulan, tahun)
    : daftarTanggalAll;

  // Filter jurnal berdasarkan bulan & tahun jika dipilih
  let jurnalFiltered = jurnalListAll;
  if (isFilterBulan) {
    jurnalFiltered = jurnalListAll.filter((j) => {
      if (!j.tanggal) return false;
      const d = new Date(j.tanggal);
      return (
        !isNaN(d) && d.getMonth() + 1 === bulan && d.getFullYear() === tahun
      );
    });
  }

  // Label periode untuk kop
  const bulanLabel = isFilterBulan
    ? `${NAMA_BULAN[bulan - 1]} ${tahun}`
    : "Semua Periode (Rekap Akumulatif)";

  // Kelompokkan jurnal per sesi
  const jurnalKelompok = kelompokkanJurnal(jurnalFiltered);

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  // Bagian A: Presensi Harian & Rekap Total
  await lampiranA(doc, {
    guru,
    wali,
    siswaList,
    grid,
    daftarTanggal,
    bulanLabel,
  });

  // Bagian B: Jurnal Bimbingan Wali Kelas
  await lampiranB(doc, {
    guru,
    wali,
    jurnalList: jurnalKelompok,
    bulanLabel,
  });

  // Bagian C: Kondisi Kelas (opsional)
  if (includeKondisiKelas) {
    await lampiranC(doc, {
      guru,
      wali,
      kondisiKelas,
      bulanLabel,
    });
  }

  // Bagian D: Mutasi Siswa (opsional)
  if (includeMutasiSiswa) {
    await lampiranD(doc, {
      guru,
      wali,
      mutasiSiswa,
      totalSiswa: siswaList.length,
      bulanLabel,
    });
  }

  const namaFile = isFilterBulan
    ? `Laporan_Wali_Kelas_${wali.namaKelas || "Kelas"}_${NAMA_BULAN[bulan - 1]}_${tahun}.pdf`
    : `Laporan_Wali_Kelas_${wali.namaKelas || "Kelas"}_Semua_Periode.pdf`;

  doc.save(namaFile);
}
