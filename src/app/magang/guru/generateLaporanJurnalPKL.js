import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

/**
 * Format tanggal Indonesia berdasarkan Zona Waktu WIB (Asia/Jakarta)
 */
function formatTanggalWIB(waktu) {
  if (!waktu) return "-";
  try {
    const d = new Date(waktu.includes("T") ? waktu : waktu + "T00:00:00");
    if (isNaN(d.getTime())) return waktu;
    return d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch (e) {
    return waktu;
  }
}

export const generateLaporanJurnalPKL = async ({ data, namaGuru }) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("Belum ada jurnal PKL untuk dicetak.");
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const teksNamaGuru = namaGuru || "Guru Pembimbing";

  // Pra-generate semua QR Code untuk bukti foto
  const qrList = await Promise.all(
    data.map(async (item) => {
      if (!item.fotoUrl) return null;
      try {
        return await QRCode.toDataURL(item.fotoUrl, {
          margin: 0,
          width: 120,
        });
      } catch (err) {
        console.error("Gagal membuat QR code bukti foto:", err);
        return null;
      }
    }),
  );

  // Menyusun baris tabel secara berurutan agar mengalir ke bawah hingga halaman penuh
  const body = data.map((item, i) => [
    i + 1,
    item.mingguKe || "-",
    formatTanggalWIB(item.waktu || item.tanggal),
    item.namaSiswa || "-",
    item.kelas || "-",
    item.tempatPkl || "-",
    item.materi || "-",
    item.permasalahan || "-",
    item.tindakLanjut || "-",
    "", // Paraf Siswa
    "", // Barcode Foto
  ]);

  const BARCODE_COL_INDEX = 10;

  // Judul Header Laporan
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FORMAT PEMBIMBINGAN INDIVIDUAL (JURNAL PKL)", 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Guru Pembimbing: ${teksNamaGuru}`, pageWidth - 100, 14);

  autoTable(doc, {
    startY: 20,
    head: [
      [
        "No",
        "Minggu Ke",
        "Waktu / Tanggal",
        "Nama Siswa",
        "Kelas",
        "Tempat PKL",
        "Materi Pembimbingan",
        "Permasalahan",
        "Tindak Lanjut",
        "Paraf Siswa",
        "Barcode Foto",
      ],
    ],
    body,
    theme: "grid",
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      valign: "middle",
      minCellHeight: 10, // Ukuran fleksibel agar muat banyak baris per halaman
    },
    headStyles: {
      fontStyle: "bold",
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.15,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 22 },
      2: { cellWidth: 28 },
      3: { cellWidth: 26 },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 26 },
      6: { cellWidth: "auto" },
      7: { cellWidth: 32 },
      8: { cellWidth: 32 },
      9: { cellWidth: 16, halign: "center" },
      10: { cellWidth: 18, halign: "center" },
    },
    margin: { left: 10, right: 10, top: 15, bottom: 15 },
    didDrawCell: (cellData) => {
      if (
        cellData.section === "body" &&
        cellData.column.index === BARCODE_COL_INDEX
      ) {
        const qrDataUrl = qrList[cellData.row.index];
        if (qrDataUrl) {
          const size = Math.min(
            cellData.cell.width - 2,
            cellData.cell.height - 2,
          );
          const x = cellData.cell.x + (cellData.cell.width - size) / 2;
          const y = cellData.cell.y + (cellData.cell.height - size) / 2;
          doc.addImage(qrDataUrl, "PNG", x, y, size, size);
        } else {
          doc.setFontSize(6.5);
          doc.setTextColor(150, 150, 150);
          doc.text(
            "-",
            cellData.cell.x + cellData.cell.width / 2,
            cellData.cell.y + cellData.cell.height / 2,
            { align: "center", baseline: "middle" },
          );
          doc.setTextColor(0, 0, 0);
        }
      }
    },
  });

  // Tanda Tangan Guru Pembimbing
  let ttdY = doc.lastAutoTable.finalY + 12;
  if (ttdY + 35 > pageHeight) {
    doc.addPage("a4", "landscape");
    ttdY = 20;
  }

  const tglSekarang = new Date().toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Teluk Kuantan, ${tglSekarang} WIB`, pageWidth - 65, ttdY);
  doc.text("Guru Pembimbing PKL", pageWidth - 65, ttdY + 5);
  doc.setFont("helvetica", "bold");
  doc.text(teksNamaGuru, pageWidth - 65, ttdY + 25);
  doc.setLineWidth(0.3);
  doc.line(pageWidth - 65, ttdY + 26, pageWidth - 14, ttdY + 26);
  doc.setFont("helvetica", "normal");
  doc.text("NIP. ", pageWidth - 65, ttdY + 30);

  const namaFileAman = teksNamaGuru.replace(/[^a-zA-Z0-9_]/g, "_");
  doc.save(`Jurnal_PKL_${namaFileAman}.pdf`);
};
