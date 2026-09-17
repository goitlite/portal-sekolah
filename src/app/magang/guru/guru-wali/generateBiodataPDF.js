import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// =========================================================
// HELPER: Mengambil Base64 Gambar (Untuk Logo di Kop Surat)
// =========================================================
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
    return null;
  }
};

// =========================================================
// HELPER: Konversi & ambil gambar dari link Google Drive.
// Link "https://drive.google.com/file/.../view" TIDAK bisa
// langsung di-fetch sebagai byte gambar (hanya membuka halaman
// preview HTML), jadi dicoba beberapa format URL alternatif
// yang lebih ramah CORS/fetch sampai salah satu berhasil.
// =========================================================
const ambilGambarDariDrive = async (urlAsli) => {
  if (!urlAsli) return null;

  const str = String(urlAsli).trim();
  const match =
    str.match(/\/d\/([a-zA-Z0-9_-]+)/) || // .../file/d/ID/view
    str.match(/[?&]id=([a-zA-Z0-9_-]+)/); // .../uc?id=ID atau open?id=ID

  const fileId = match ? match[1] : null;

  const kandidat = fileId
    ? [
        `https://lh3.googleusercontent.com/d/${fileId}`,
        `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`,
        `https://drive.google.com/uc?export=view&id=${fileId}`,
      ]
    : [str];

  for (const url of kandidat) {
    const hasil = await getBase64Image(url);
    if (hasil) return hasil;
  }
  return null;
};

// =========================================================
// =========================================================
// KONFIGURASI: CATATAN PERKEMBANGAN MURID (LAMPIRAN B)
// =========================================================
const ASPEK_PEMANTAUAN = [
  { key: "akademik", label: "Akademik" },
  { key: "karakter", label: "Karakter" },
  { key: "sosial", label: "Sosial-Emosional" },
  { key: "disiplin", label: "Kedisiplinan" },
  { key: "potensi", label: "Potensi & Minat" },
];

const NAMA_BULAN_INDO = [
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

// Ubah "2025-07" -> "Juli 2025"
const formatBulanTahun = (nilaiBulan) => {
  if (!nilaiBulan) return "-";
  const [tahun, bulan] = String(nilaiBulan).split("-");
  const indexBulan = Number(bulan) - 1;
  const namaBulan = NAMA_BULAN_INDO[indexBulan] || bulan;
  return `${namaBulan} ${tahun}`;
};

// Ubah "akademik" -> "Akademik" (dipakai membentuk key des/tin/ket + Aspek)
const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

const FORM_CATATAN_KOSONG = {
  periodeAwal: "",
  periodeAkhir: "",
  desAkademik: "",
  tinAkademik: "",
  ketAkademik: "",
  desKarakter: "",
  tinKarakter: "",
  ketKarakter: "",
  desSosial: "",
  tinSosial: "",
  ketSosial: "",
  desDisiplin: "",
  tinDisiplin: "",
  ketDisiplin: "",
  desPotensi: "",
  tinPotensi: "",
  ketPotensi: "",
};

// =========================================================
// FUNGSI UTAMA: GENERATE PDF BIODATA
// =========================================================
export const generateBiodataPDF = async (siswa) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- Pisahkan Nama & Kelas dari format "Nama [Kelas]" ---
  const namaMentah = siswa.nama || "-";
  const matchKelas = namaMentah.match(/\[(.*?)\]/);
  const kelas = matchKelas ? matchKelas[1] : siswa.kelas || "-";
  const namaBersih =
    namaMentah.replace(/\s*\[.*?\]\s*/, "").trim() || namaMentah;

  // --- Ambil logo & foto profil secara paralel ---
  const [logoImg, fotoImg] = await Promise.all([
    getBase64Image("/logo.png"),
    ambilGambarDariDrive(siswa.fotoProfil),
  ]);

  // --- KOP SURAT (dipadatkan) ---
  if (logoImg) {
    doc.addImage(logoImg.data, "PNG", 15, 10, 18, 18);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SMK NEGERI 1 TELUK KUANTAN", pageWidth / 2, 15, {
    align: "center",
  });

  doc.setFontSize(12);
  doc.text("BIODATA LENGKAP SISWA WALI", pageWidth / 2, 21, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Tahun Pelajaran 2026/2027", pageWidth / 2, 26, { align: "center" });

  // Garis Bawah Kop (dipadatkan)
  doc.setLineWidth(0.6);
  doc.line(15, 30, pageWidth - 15, 30);
  doc.setLineWidth(0.25);
  doc.line(15, 31.2, pageWidth - 15, 31.2);

  let startY = 36;

  // Helper Pembuat Tabel - Warna Headernya diubah ke Biru Navy Formal
  // (dipadatkan: cellPadding & fontSize dikecilkan, jarak antar tabel dirapatkan)
  const createTable = (title, bodyData, opts = {}) => {
    autoTable(doc, {
      startY: startY,
      head: [[{ content: title, colSpan: 2 }]],
      body: bodyData,
      theme: "grid",
      styles: {
        fontSize: 9,
        cellPadding: 2,
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 42, fontStyle: "bold", fillColor: [248, 248, 250] },
        1: { cellWidth: opts.col1Width || "auto" },
      },
      margin: { left: 15, right: opts.rightMargin ?? 15 },
      tableWidth: opts.tableWidth || undefined,
    });
    startY = doc.lastAutoTable.finalY + 4;
  };

  // --- I. IDENTITAS SISWA (dipersempit agar foto muat di kanan) ---
  const identitasTableY = startY;

  createTable(
    "I. IDENTITAS SISWA",
    [
      ["ID Siswa", siswa.idSiswa || "-"],
      ["Nama Lengkap", namaBersih],
      ["Kelas", kelas],
    ],
    { tableWidth: 125 },
  );

  // --- FOTO PROFIL (kanan atas, sejajar tabel identitas) ---
  const fotoW = 32;
  const fotoH = 40;
  const fotoX = pageWidth - 15 - fotoW;
  const fotoY = identitasTableY;

  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(fotoX, fotoY, fotoW, fotoH);

  if (fotoImg) {
    try {
      doc.addImage(fotoImg.data, "JPEG", fotoX, fotoY, fotoW, fotoH);
    } catch (e) {
      // biarkan kotak kosong jika gambar gagal ditempel
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7);
    doc.text("Tidak ada foto", fotoX + fotoW / 2, fotoY + fotoH / 2, {
      align: "center",
      baseline: "middle",
    });
  }

  // Pastikan konten berikutnya tidak bertumpuk dengan kotak foto
  startY = Math.max(startY, fotoY + fotoH + 4);

  // NO HP dimasukkan ke Data Pribadi
  createTable("II. DATA PRIBADI", [
    ["No. Handphone (WA)", siswa.noHp || "-"], // Cita-cita dihapus, diganti No HP di sini
    [
      "Tempat, Tanggal Lahir",
      `${siswa.tempatLahir || "-"}, ${siswa.tglLahir || "-"}`,
    ],
    ["Anak Ke", siswa.anakKe || "-"],
    ["Alamat Lengkap", siswa.alamat || "-"],
    ["Transportasi", siswa.transportasi || "-"],
  ]);

  createTable("III. DATA AYAH", [
    ["Nama Ayah", siswa.ayah || "-"],
    ["Pekerjaan Ayah", siswa.pekerjaanAyah || "-"],
    ["Kontak Ayah", siswa.kontakAyah || "-"],
  ]);

  createTable("IV. DATA IBU", [
    ["Nama Ibu", siswa.ibu || "-"],
    ["Pekerjaan Ibu", siswa.pekerjaanIbu || "-"],
    ["Kontak Ibu", siswa.kontakIbu || "-"],
  ]);

  // Cek jika halaman hampir penuh, pindah ke halaman 2
  if (startY > 235) {
    doc.addPage();
    startY = 15;
  }

  createTable("V. PROFIL, MINAT & BAKAT", [
    ["Hobi", siswa.hobi || "-"],
    ["Bakat / Keahlian", siswa.bakatKeahlian || "-"],
    ["Pelajaran Disukai", siswa.pelajaranDisukai || "-"],
    ["Alasan Disukai", siswa.alasanDisukai || "-"],
    ["Pelajaran Tidak Disukai", siswa.pelajaranTidakDisukai || "-"],
    ["Alasan Tidak Disukai", siswa.alasanTidakDisukai || "-"],
  ]);

  // Tabel Khusus untuk Harapan
  autoTable(doc, {
    startY: startY,
    head: [
      [
        {
          content: "VI. HARAPAN SISWA DI SMKN 1 DAN CITA CITA KEDEPANNYA",
          styles: { halign: "center" },
        },
      ],
    ],
    body: [[siswa.harapan || "-"]],
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: [0, 0, 0],
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    margin: { left: 15, right: 15 },
  });
  startY = doc.lastAutoTable.finalY + 10;

  // =========================================================
  // LAMPIRAN B: FORMAT CATATAN PERKEMBANGAN MURID
  // Ditambahkan sebelum bagian tanda tangan.
  // Semua identitas dan isi diambil otomatis dari data siswa.
  // =========================================================

  // Perkiraan ruang agar Lampiran B + tanda tangan tidak terpotong.
  // Jika tidak cukup, Lampiran B dimulai di halaman berikutnya.
  if (startY > 165) {
    doc.addPage();
    startY = 18;
  } else {
    startY += 2;
  }

  const periodePemantauan =
    siswa.periodeAwal && siswa.periodeAkhir
      ? `Bulan ${formatBulanTahun(siswa.periodeAwal)} – ${formatBulanTahun(
          siswa.periodeAkhir,
        )}`
      : "-";

  // Judul Lampiran B
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("LAMPIRAN B: FORMAT CATATAN PERKEMBANGAN MURID", 15, startY);

  startY += 8;

  // Identitas Lampiran B - dibuat seperti format pada contoh.
  const labelX = 15;
  const colonX = 55;
  const valueX = 59;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const tulisIdentitasLampiran = (label, value, y) => {
    doc.setFont("helvetica", "normal");
    doc.text(label, labelX, y);
    doc.text(":", colonX, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(value || "-"), valueX, y);
  };

  tulisIdentitasLampiran("Nama Murid", namaBersih, startY);
  tulisIdentitasLampiran("Kelas", kelas, startY + 5);
  tulisIdentitasLampiran("Periode Pemantauan", periodePemantauan, startY + 10);
  tulisIdentitasLampiran("Guru Wali", siswa.namaGuru || "-", startY + 15);

  startY += 20;

  // Tabel utama Lampiran B: 4 kolom x 5 aspek.
  autoTable(doc, {
    startY,
    head: [
      [
        "Aspek Pemantauan",
        "Deskripsi Perkembangan",
        "Tindak Lanjut yang Dilakukan",
        "Keterangan Tambahan",
      ],
    ],
    body: [
      [
        "Akademik",
        siswa.desAkademik || "-",
        siswa.tinAkademik || "-",
        siswa.ketAkademik || "-",
      ],
      [
        "Karakter",
        siswa.desKarakter || "-",
        siswa.tinKarakter || "-",
        siswa.ketKarakter || "-",
      ],
      [
        "Sosial-Emosional",
        siswa.desSosial || "-",
        siswa.tinSosial || "-",
        siswa.ketSosial || "-",
      ],
      [
        "Kedisiplinan",
        siswa.desDisiplin || "-",
        siswa.tinDisiplin || "-",
        siswa.ketDisiplin || "-",
      ],
      [
        "Potensi & Minat",
        siswa.desPotensi || "-",
        siswa.tinPotensi || "-",
        siswa.ketPotensi || "-",
      ],
    ],
    theme: "grid",
    styles: {
      fontSize: 8.2,
      cellPadding: 2,
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.25,
      valign: "middle",
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      fontSize: 8.2,
      halign: "center",
      valign: "middle",
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: {
        cellWidth: 35,
        fontStyle: "normal",
        halign: "left",
      },
      1: {
        cellWidth: 55,
        halign: "left",
      },
      2: {
        cellWidth: 55,
        halign: "left",
      },
      3: {
        cellWidth: 35,
        halign: "left",
      },
    },
    margin: { left: 15, right: 15 },
    tableWidth: 180,
    rowPageBreak: "avoid",
  });

  startY = doc.lastAutoTable.finalY + 9;

  // --- BAGIAN TANDA TANGAN ---
  if (startY > 250) {
    doc.addPage();
    startY = 25;
  }

  const tanggalCetak = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Teluk Kuantan, ${tanggalCetak}`, 130, startY);
  doc.text("Mengetahui,", 130, startY + 4.5);
  doc.text("Guru Wali,", 130, startY + 9);

  doc.setFont("helvetica", "bold");
  doc.text(siswa.namaGuru || "___________________", 130, startY + 26);
  doc.setLineWidth(0.3);
  doc.line(130, startY + 27, 190, startY + 27);

  // Penamaan file yang rapi
  const namaFileSafe = namaBersih
    ? namaBersih.replace(/[^a-zA-Z0-9]/g, "_")
    : "Siswa";
  doc.save(`Biodata_${namaFileSafe}.pdf`);
};
