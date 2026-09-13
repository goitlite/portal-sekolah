import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getPresensiMapelGrid } from "../../lib/api";

// Helper: Mengambil Base64 + Dimensi Asli Gambar (Logo Sekolah)
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
    console.warn("Fetch logo gagal, fallback ke canvas:", error);
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

export async function generateLaporanMapelPDF({
  guru,
  mapel,
  siswaList: siswaListProp,
  grid: gridProp,
  tanggalPertemuan: tanggalPertemuanProp,
  jumlahPertemuan: jumlahPertemuanProp,
}) {
  let siswaList = siswaListProp;
  let grid = gridProp;
  let tanggalPertemuan = tanggalPertemuanProp || {};
  let jumlahPertemuan = jumlahPertemuanProp;

  // Jika data grid belum disediakan langsung, fetch dari API
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

  // Inisialisasi dokumen PDF Landscape A4
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  // 1. Ambil & Gambar Logo Sekolah
  const logo = await getBase64Image("/logo.png");
  if (logo && logo.data) {
    // Rasio logo proporsional
    const logoH = 18;
    const logoW = (logo.width / logo.height) * logoH;
    doc.addImage(logo.data, "PNG", 14, 10, logoW, logoH);
  }

  // 2. Kop Laporan
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("SMK NEGERI 1 TELUK KUANTAN", 36, 15);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("LAPORAN PRESENSI & DAFTAR NILAI HARIAN MATA PELAJARAN", 36, 21);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text("Website: https://portalsmkn1telku.vercel.app/ | Sistem Akademik & Magang", 36, 26);

  // Garis Pembatas Kop
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.6);
  doc.line(14, 29, pageWidth - 14, 29);
  doc.setLineWidth(0.2);
  doc.line(14, 30, pageWidth - 14, 30);

  // 3. Informasi Mata Pelajaran
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

  // 4. Bangun Kolom & Baris Tabel
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
          subTgl = `\n${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
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

  // Kolom Rekapitulasi
  headCols.push(
    { content: "H", styles: { halign: "center" } },
    { content: "S", styles: { halign: "center" } },
    { content: "I", styles: { halign: "center" } },
    { content: "A", styles: { halign: "center" } },
    { content: "C", styles: { halign: "center" } },
    { content: "Tot Nilai", styles: { halign: "center" } }
  );

  const tableRows = siswaList.map((s, idx) => {
    const row = [idx + 1, s.nama || "-"];

    let totalH = 0;
    let totalS = 0;
    let totalI = 0;
    let totalA = 0;
    let totalC = 0;
    let jumlahNilai = 0;

    for (let p = 1; p <= jumlahPertemuan; p++) {
      const cell = (grid && grid[`${s.idSiswa}_${p}`]) || { status: "", nilai: "" };
      const status = cell.status || "";
      const nilai = cell.nilai;

      if (status === "Hadir") {
        totalH++;
        if (nilai !== "" && !isNaN(Number(nilai))) {
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

    row.push(totalH, totalS, totalI, totalA, totalC, jumlahNilai > 0 ? jumlahNilai : "-");
    return row;
  });

  // Lebar kolom dinamis
  const colStyles = {
    0: { cellWidth: 8, halign: "center" }, // No
    1: { cellWidth: 42, halign: "left" }, // Nama
  };

  // Kolom pertemuan
  const sisaIndex = 2 + jumlahPertemuan;
  for (let i = 2; i < sisaIndex; i++) {
    colStyles[i] = { halign: "center" };
  }

  // Kolom H, S, I, A, C
  colStyles[sisaIndex] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 1] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 2] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 3] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 4] = { cellWidth: 7, halign: "center" };
  colStyles[sisaIndex + 5] = { cellWidth: 14, halign: "center", fontStyle: "bold" }; // Tot Nilai

  // 5. Render AutoTable dengan Warna Tipis di Header & Selang Seling Baris
  autoTable(doc, {
    startY: 45,
    head: [headCols],
    body: tableRows,
    theme: "grid",

    headStyles: {
      fillColor: [235, 243, 253], // Warna tipis biru-slate (soft highlight)
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
      fillColor: [248, 250, 252], // Warna tipis selang-seling (zebra stripe)
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
      // Footer di setiap halaman
      const curPage = data.pageNumber;
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 116, 139);
      // Ganti localhost dengan https://portalsmkn1telku.vercel.app/
      doc.text("https://portalsmkn1telku.vercel.app/", 14, pageHeight - 7);
      doc.text(
        `Dicetak: ${formatTanggalIndo(new Date())} | Hal. ${curPage}`,
        pageWidth - 14,
        pageHeight - 7,
        { align: "right" }
      );
    },
  });

  // 6. Tanda Tangan Guru Mapel
  let ttdY = doc.lastAutoTable.finalY + 8;
  if (ttdY > pageHeight - 42) {
    doc.addPage("a4", "landscape");
    ttdY = 20;
  }

  const rightColX = pageWidth - 65;
  const tanggalCetakTtd = formatTanggalIndo(new Date());

  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "normal");
  doc.text(`Teluk Kuantan, ${tanggalCetakTtd}`, rightColX, ttdY, { align: "center" });
  doc.text("Guru Mapel,", rightColX, ttdY + 4.5, { align: "center" });

  // Ruang tanda tangan
  const namaGuruTeks = guru?.nama || "-";
  doc.setFont("helvetica", "bold");
  doc.text(namaGuruTeks, rightColX, ttdY + 22, { align: "center" });

  // Garis bawah nama guru
  const textWidth = doc.getTextWidth(namaGuruTeks);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  doc.line(rightColX - textWidth / 2, ttdY + 23, rightColX + textWidth / 2, ttdY + 23);

  doc.setFont("helvetica", "normal");
  doc.text(`NIP. ${guru?.nip || "........................................."}`, rightColX, ttdY + 27, {
    align: "center",
  });

  // 7. Simpan Dokumen sebagai PDF
  const namaFileAman = `${mapel.namaMapel || "Mapel"}_${mapel.kelas || "Semua"}`.replace(
    /[^a-zA-Z0-9_-]/g,
    "_"
  );
  doc.save(`Laporan_Presensi_Nilai_${namaFileAman}.pdf`);
}
