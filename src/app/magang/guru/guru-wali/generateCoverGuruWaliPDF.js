import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================
// HELPER: Ambil Base64 gambar dari URL/path publik (mis. /logo.png,
// /cover_jurnal_guru_wali.png). Dipakai juga oleh file generator PDF
// lain di project ini (pola yang sama dengan generateBiodataPDF).
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
    console.warn("Gagal mengambil gambar cover/logo:", error);
    return null;
  }
};

// ============================================================
// KOORDINAT BOX TEKS PUTIH PADA COVER (hasil ukur manual dari
// file COVER_JURNAL_GURU_WALI.pdf, halaman 1, ukuran A4 potrait).
// Kotak putih polos ada di bawah teks "Refleksi & Pendampingan".
// Satuan: mm.
// ============================================================
const COVER_BOX = {
  x: 26.4,
  y: 101.6,
  width: 100.9,
  height: 33.2,
};

const MARGIN_L = 18;
const MARGIN_R = 18;
const PAGE_BOTTOM = 283;

// ============================================================
// ISI TEKS SOP GURU WALI (halaman 2 dst), diketik ulang dari
// dokumen SOP resmi sekolah (SMKN 1 Teluk Kuantan) agar tersusun
// rapi & konsisten dengan gaya heading tebal seperti pada dokumen
// sumber, alih-alih menempel gambar hasil scan.
// ============================================================
const SOP_CONTENT = [
  { type: "h1", text: "STANDAR OPERASIONAL PROSEDUR (SOP)" },
  { type: "h1", text: "GURU WALI" },
  { type: "space", h: 3 },
  {
    type: "infoline",
    label: "Satuan Pendidikan",
    value: "SMKN 1 TELUK KUANTAN",
  },
  { type: "infoline", label: "Jenjang", value: "SMK" },
  { type: "infoline", label: "Tahun Ajaran", value: "2025/2026" },
  { type: "hr" },

  { type: "h2", text: "I. Dasar Hukum" },
  {
    type: "p",
    text: "Permendikdasmen No. 11 Tahun 2025 (tentang pemenuhan beban kerja guru) menetapkan peran dan kewajiban guru wali di sekolah, dengan ketentuan dalam Pasal 9, 14, dan 17 dan 18 sebagai berikut:",
  },
  {
    type: "numbered",
    items: [
      "Pasal 9 ayat (1–5): Penugasan dan ruang lingkup tugas Guru Wali",
      "Pasal 14: Ekuivalensi tugas Guru Wali setara 2 JP per minggu",
      "Pasal 17 dan 18: Penetapan, pelaksanaan, dan penghitungan beban kerja",
    ],
  },

  { type: "h2", text: "II. Pengertian" },
  {
    type: "p",
    text: "Guru Wali adalah guru mata pelajaran yang diberi tugas mendampingi perkembangan akademik, karakter, keterampilan, dan kompetensi murid dari saat masuk hingga lulus pada satuan pendidikan yang sama.",
  },

  { type: "h2", text: "III. Tujuan" },
  { type: "p", text: "Adapun tujuan guru wali yaitu:" },
  {
    type: "bullet",
    items: [
      "Menjamin pelaksanaan pendampingan murid secara menyeluruh dan berkesinambungan.",
      "Meningkatkan keterlibatan guru dalam pendidikan karakter dan pengembangan potensi murid.",
      "Memberikan dukungan sistematis terhadap pertumbuhan akademik dan non-akademik Murid.",
    ],
  },

  { type: "h2", text: "IV. Ruang Lingkup Tugas" },
  {
    type: "p",
    text: "Berdasarkan Pasal 9 ayat (2), Guru Wali melaksanakan tugas sebagai berikut:",
  },
  {
    type: "table",
    head: [["Kategori", "Penjelasan Singkat"]],
    body: [
      ["Pendamping Akademik", "Memantau dan membantu capaian belajar Murid."],
      [
        "Pengembangan Karakter",
        "Mendorong tumbuhnya sikap integritas, tanggung jawab, dan disiplin.",
      ],
      [
        "Pendamping Pendidikan",
        "Mendampingi Murid sepanjang jenjang pendidikan.",
      ],
      ["Penghubung Komunikasi", "Menjembatani Murid, guru, dan orang tua."],
      [
        "Mediator & Koordinator",
        "Mengatasi isu Murid, menyampaikan informasi, fasilitasi komunikasi dengan orang tua.",
      ],
      [
        "Beban Kerja",
        "Tugas diakui sebagai 2 jam tatap muka per minggu, bagian dari 37,5 jam kerja.",
      ],
    ],
    colStyles: { 0: { fontStyle: "bold", cellWidth: 48 } },
  },

  { type: "h2", text: "Rincian Tupoksi Guru Wali:" },

  { type: "h3", text: "1. Tugas Pokok Guru Wali" },
  {
    type: "bullet",
    items: [
      [
        "Pendampingan akademik",
        ": aktif memantau capaian belajar Murid serta membantu mengatasi kendala akademik.",
      ],
      [
        "Pengembangan kompetensi, keterampilan, dan karakter",
        ": membimbing Murid sesuai kebutuhan dan potensinya.",
      ],
      [
        "Pendampingan sepanjang pendidikan",
        ": mendampingi Murid sejak awal masuk hingga mereka menyelesaikan jenjang pendidikan di satuan yang sama.",
      ],
      [
        "Fungsi penghubung",
        ": menjadi jembatan antara Murid, guru mata pelajaran, guru BK, dan orang tua/wali murid.",
      ],
    ],
  },

  { type: "h3", text: "2. Fungsi Guru Wali" },
  {
    type: "bullet",
    items: [
      ["Pendamping pembelajaran", ": memastikan tujuan akademik tercapai."],
      [
        "Pembimbing karakter dan keterampilan sosial",
        ", sesuai dengan profil Pelajar Pancasila.",
      ],
      ["Mediator", ": membantu menyelesaikan berbagai persoalan Murid."],
      [
        "Koordinator informasi",
        " tentang kegiatan sekolah, pengembangan diri, dan layanan BK.",
      ],
      ["Fasilitator komunikasi", " antara sekolah dan orang tua/wali murid."],
    ],
  },

  { type: "h3", text: "3. Kolaborasi" },
  {
    type: "p",
    text: "Guru wali bekerja sama dengan berbagai pihak internal sekolah:",
  },
  {
    type: "bullet",
    items: [
      ["Guru BK, guru mata pelajaran, wali kelas", ""],
      ["Kepala Sekolah serta tenaga kependidikan lainnya", ""],
      [
        "Tujuan kolaborasi ini adalah",
        " untuk memantau dan mendukung perkembangan Murid secara menyeluruh.",
      ],
    ],
  },

  { type: "h3", text: "4. Beban Kerja & Ekuivalensi" },
  {
    type: "bullet",
    items: [
      [
        "Tugas Guru Wali setara dengan 2 jam Tatap Muka per minggu",
        " (Pasal 14 dan Lampiran Permendikdasmen No. 11 Tahun 2025)",
      ],
      [
        "Kegiatan pendampingan",
        " yang dilaksanakan oleh guru wali dihitung ekuivalen 2 jam tatap muka per minggu.",
      ],
      [
        "Ini menjadi bagian dari pemenuhan beban kerja guru yaitu 37 jam 30 menit per minggu",
        ", sesuai ketentuan dalam Permendikdasmen No. 11 Tahun 2025.",
      ],
    ],
  },

  { type: "h2", text: "V. Prosedur Pelaksanaan" },
  { type: "h3", text: "1. Penunjukan Guru Wali" },
  {
    type: "bullet",
    items: [
      ["Dilakukan oleh Kepala Sekolah", " (Pasal 18 ayat 1)."],
      [
        "Berdasarkan rasio jumlah murid dengan jumlah guru mata pelajaran",
        " (Pasal 18 ayat 2).",
      ],
    ],
  },

  { type: "h3", text: "2. Pelaksanaan Tugas" },
  {
    type: "table",
    head: [["No", "Kegiatan", "Penjelasan", "Waktu Pelaksanaan"]],
    body: [
      [
        "1",
        "Identifikasi murid dampingan",
        "Memahami latar belakang, potensi, dan tantangan murid",
        "Awal tahun ajaran",
      ],
      [
        "2",
        "Penyusunan dan pelaksanaan rencana pendampingan",
        "Disesuaikan dengan kebutuhan murid",
        "Per semester",
      ],
      [
        "3",
        "Pertemuan berkala dengan murid",
        "Secara individual atau kelompok kecil",
        "2x per bulan",
      ],
      [
        "4",
        "Kolaborasi dengan guru BK & wali kelas",
        "Untuk tindak lanjut masalah tertentu",
        "Sesuai kebutuhan",
      ],
      [
        "5",
        "Pelaporan perkembangan murid",
        "Secara berkala (bulanan/semester)",
        "Setiap akhir bulan atau semester",
      ],
      [
        "6",
        "Dokumentasi dan refleksi",
        "Catatan kemajuan, hambatan, dan rekomendasi",
        "Berkelanjutan",
      ],
    ],
    colStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 42, fontStyle: "bold" },
      3: { cellWidth: 32 },
    },
  },

  { type: "h2", text: "VI. Evaluasi dan Pelaporan" },
  {
    type: "bullet",
    items: [["Guru Wali menyusun laporan singkat setiap semester berisi:", ""]],
  },
  {
    type: "subbullet",
    items: [
      "Rekap pertemuan dan kegiatan",
      "Catatan perkembangan murid",
      "Rekomendasi tindak lanjut",
    ],
  },
  {
    type: "bullet",
    items: [
      [
        "Laporan dikumpulkan",
        " ke Wakil Kepala Sekolah bidang KeMuridan atau Kurikulum.",
      ],
    ],
  },

  { type: "h2", text: "VIII. Penutup" },
  {
    type: "p",
    text: "SOP ini menjadi acuan pelaksanaan tugas Guru Wali untuk memastikan pendampingan murid berjalan sistematis, profesional, dan berdampak pada perkembangan Murid secara utuh.",
  },
  {
    type: "p",
    text: "Guru wali menurut Permendikdasmen No. 11/2025 bukan sekadar jabatan administratif. Mereka memiliki peran strategis dalam:",
  },
  {
    type: "bullet",
    items: [
      ["Membangun akademik dan karakter Murid,", ""],
      ["Menjaga kesinambungan pendampingan sepanjang masa pendidikan,", ""],
      [
        "Menghubungkan dan memfasilitasi komunikasi",
        " antara sekolah, Murid, serta orang tua.",
      ],
    ],
  },
  {
    type: "p",
    text: "Dan yang penting, tugas ini diakui secara resmi dalam penghitungannya sebagai bagian dari beban kerja wajib guru.",
  },
];

// ============================================================
// RENDERER: mencetak SOP_CONTENT ke halaman-halaman berikutnya
// pada dokumen jsPDF yang sama (setelah halaman cover), dengan
// heading tebal & rapi mengikuti gaya dokumen SOP sumber.
// ============================================================
function renderSopGuruWali(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_L - MARGIN_R;
  let y = 20;

  doc.addPage();

  function pastikanRuang(tinggiDibutuhkan) {
    if (y + tinggiDibutuhkan > PAGE_BOTTOM) {
      doc.addPage();
      y = 20;
    }
  }

  for (const block of SOP_CONTENT) {
    switch (block.type) {
      case "h1": {
        pastikanRuang(9);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(block.text, pageWidth / 2, y, { align: "center" });
        y += 7;
        break;
      }

      case "space": {
        y += block.h;
        break;
      }

      case "infoline": {
        pastikanRuang(6);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10.5);
        doc.setTextColor(30, 41, 59);
        doc.text(block.label, MARGIN_L, y);
        doc.text(":", MARGIN_L + 38, y);
        doc.setFont("helvetica", "bold");
        doc.text(block.value, MARGIN_L + 42, y);
        y += 5.5;
        break;
      }

      case "hr": {
        pastikanRuang(4);
        y += 1;
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(MARGIN_L, y, pageWidth - MARGIN_R, y);
        y += 6;
        break;
      }

      case "h2": {
        pastikanRuang(10);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11.5);
        doc.setTextColor(13, 89, 89);
        doc.text(block.text, MARGIN_L, y);
        y += 6.5;
        break;
      }

      case "h3": {
        pastikanRuang(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(15, 23, 42);
        doc.text(block.text, MARGIN_L, y);
        y += 6;
        break;
      }

      case "p": {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        const lines = doc.splitTextToSize(block.text, contentWidth);
        pastikanRuang(lines.length * 4.6 + 2);
        doc.text(lines, MARGIN_L, y);
        y += lines.length * 4.6 + 3;
        break;
      }

      case "numbered": {
        doc.setFontSize(10);
        block.items.forEach((teks, idx) => {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 41, 59);
          const prefix = `${idx + 1}. `;
          const indent = MARGIN_L + 5;
          const lines = doc.splitTextToSize(teks, contentWidth - 5);
          pastikanRuang(lines.length * 4.6 + 1);
          doc.text(prefix, MARGIN_L, y);
          doc.text(lines, indent, y);
          y += lines.length * 4.6 + 1.5;
        });
        y += 1.5;
        break;
      }

      case "bullet": {
        doc.setFontSize(10);
        block.items.forEach((item) => {
          const [bold, normal] = Array.isArray(item) ? item : [item, ""];
          const indent = MARGIN_L + 5;
          const maxW = contentWidth - 5;

          doc.setFont("helvetica", "bold");
          const boldWidth = doc.getTextWidth(bold);

          if (!normal || doc.getTextWidth(bold + normal) <= maxW) {
            pastikanRuang(5.5);
            doc.setTextColor(30, 41, 59);
            doc.text("•", MARGIN_L, y);
            doc.setFont("helvetica", "bold");
            doc.text(bold, indent, y);
            if (normal) {
              doc.setFont("helvetica", "normal");
              doc.text(normal, indent + boldWidth, y);
            }
            y += 5.2;
          } else {
            const gabung = bold + normal;
            const lines = doc.splitTextToSize(gabung, maxW);
            pastikanRuang(lines.length * 4.6 + 1);
            doc.setTextColor(30, 41, 59);
            doc.text("•", MARGIN_L, y);
            doc.setFont("helvetica", "bold");
            doc.text(lines[0], indent, y);
            doc.setFont("helvetica", "normal");
            for (let i = 1; i < lines.length; i++) {
              y += 4.6;
              doc.text(lines[i], indent, y);
            }
            y += 5.2;
          }
        });
        y += 1;
        break;
      }

      case "subbullet": {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(51, 65, 85);
        block.items.forEach((teks) => {
          const indent = MARGIN_L + 11;
          const lines = doc.splitTextToSize(teks, contentWidth - 11);
          pastikanRuang(lines.length * 4.4 + 1);
          doc.text("○", MARGIN_L + 6, y);
          doc.text(lines, indent, y);
          y += lines.length * 4.4 + 1;
        });
        y += 1.5;
        break;
      }

      case "table": {
        pastikanRuang(16);
        autoTable(doc, {
          startY: y,
          margin: { left: MARGIN_L, right: MARGIN_R },
          head: block.head,
          body: block.body,
          theme: "grid",
          styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 2.2,
            textColor: [30, 41, 59],
            lineColor: [203, 213, 225],
            valign: "middle",
          },
          headStyles: {
            fillColor: [13, 89, 89],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
          },
          columnStyles: block.colStyles || {},
        });
        y = doc.lastAutoTable.finalY + 5;
        break;
      }

      default:
        break;
    }
  }
}

/**
 * generateCoverGuruWaliPDF
 * Mencetak dokumen Buku Jurnal Guru Wali:
 *  - Halaman 1: cover bergambar, dengan logo sekolah + nama guru
 *    ditulis rapi di dalam kotak putih elegan yang sudah tersedia
 *    pada desain cover.
 *  - Halaman 2 dst: teks SOP Guru Wali (dasar hukum, pengertian,
 *    tujuan, ruang lingkup tugas, tupoksi, prosedur pelaksanaan,
 *    evaluasi & pelaporan, penutup), diketik ulang rapi dengan
 *    heading tebal senada gaya dokumen SOP sumber.
 *
 * @param {Object} params
 * @param {string} params.namaGuru - Nama guru wali yang akan dicetak di cover.
 * @param {string} [params.coverImageUrl] - Path gambar cover (default: /cover_jurnal_guru_wali.png).
 * @param {string} [params.logoUrl] - Path logo sekolah (default: /logo.png).
 */
export const generateCoverGuruWaliPDF = async ({
  namaGuru,
  coverImageUrl = "/cover_jurnal_guru_wali.png",
  logoUrl = "/logo.png",
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const [coverImg, logoImg] = await Promise.all([
    getBase64Image(coverImageUrl),
    getBase64Image(logoUrl),
  ]);

  // --- HALAMAN 1: COVER (gambar penuh 1 halaman) ---
  if (coverImg) {
    doc.addImage(coverImg.data, "PNG", 0, 0, pageWidth, pageHeight);
  } else {
    doc.setFillColor(56, 178, 172);
    doc.rect(0, 0, pageWidth, pageHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(26);
    doc.setTextColor(255, 255, 255);
    doc.text("BUKU JURNAL GURU WALI", pageWidth / 2, 60, { align: "center" });
  }

  // --- ISI KOTAK PUTIH: LOGO SEKOLAH + NAMA GURU ---
  const { x: boxX, y: boxY, width: boxW, height: boxH } = COVER_BOX;
  const paddingX = 4;

  let textStartX = boxX + paddingX;
  const textCenterY = boxY + boxH / 2;

  if (logoImg) {
    const logoSize = boxH - 8;
    const logoX = boxX + paddingX;
    const logoY = boxY + (boxH - logoSize) / 2;
    doc.addImage(logoImg.data, "PNG", logoX, logoY, logoSize, logoSize);
    textStartX = logoX + logoSize + 5;
  }

  const teksNamaGuru = namaGuru || "Nama Guru Wali";
  const maxTextWidth = boxX + boxW - paddingX - textStartX;

  doc.setTextColor(15, 76, 92);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Nama Guru Wali", textStartX, textCenterY - 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const namaLines = doc.splitTextToSize(teksNamaGuru, maxTextWidth);
  doc.text(namaLines, textStartX, textCenterY + 3);

  doc.setDrawColor(191, 149, 63);
  doc.setLineWidth(0.5);
  doc.line(
    textStartX,
    textCenterY + (namaLines.length > 1 ? 9 : 6),
    boxX + boxW - paddingX,
    textCenterY + (namaLines.length > 1 ? 9 : 6),
  );

  // --- HALAMAN 2 DST: TEKS SOP GURU WALI ---
  renderSopGuruWali(doc);

  const namaFileAman = teksNamaGuru.replace(/[^a-zA-Z0-9_]/g, "_");
  doc.save(`Cover_Jurnal_GuruWali_${namaFileAman}.pdf`);
};
