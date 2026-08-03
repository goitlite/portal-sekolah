import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper internal: Mengambil Base64 + Dimensi Asli Gambar
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
            data: canvas.toDataURL("image/jpeg", 0.8),
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

// HELPER BARU: Membaca & Mengonversi Bulan Otomatis dari Data Spreadsheet
const autoDetectBulanFromData = (dataList, bulanInput) => {
  // 1. Jika pengguna secara manual memilih bulan di dropdown, utamakan pilihan tersebut
  if (bulanInput && bulanInput.trim() !== "" && bulanInput !== "Semua Bulan") {
    return bulanInput;
  }

  const bulanNames = [
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

  const setBulan = new Set();

  if (Array.isArray(dataList)) {
    dataList.forEach((item) => {
      // Pindai field tanggal di tingkat tempat/lokasi magang
      [
        item.bulan,
        item.tanggal,
        item.timestamp,
        item.waktu,
        item.periode,
        item.TIMESTAMP,
      ].forEach((val) => {
        if (val) {
          const d = new Date(val);
          if (!isNaN(d.getTime())) {
            setBulan.add(`${bulanNames[d.getMonth()]} ${d.getFullYear()}`);
          }
        }
      });

      // Pindai field tanggal di tingkat siswa/presensi
      if (Array.isArray(item.siswa)) {
        item.siswa.forEach((s) => {
          [
            s.bulan,
            s.tanggal,
            s.timestamp,
            s.waktu,
            s.TIMESTAMP,
            s.updatedAt,
            s.createdAt,
          ].forEach((val) => {
            if (val) {
              const d = new Date(val);
              if (!isNaN(d.getTime())) {
                setBulan.add(`${bulanNames[d.getMonth()]} ${d.getFullYear()}`);
              }
            }
          });
        });
      }
    });
  }

  // 2. Jika tanggal ditemukan dari spreadsheet, gabungkan bulan-bulan unik tersebut
  if (setBulan.size > 0) {
    return Array.from(setBulan).join(", ");
  }

  // 3. Fallback: Jika di spreadsheet tidak ditemukan kolom tanggal/timestamp sama sekali, gunakan bulan & tahun saat ini
  const skrg = new Date();
  return `${bulanNames[skrg.getMonth()]} ${skrg.getFullYear()}`;
};

export const generateLaporanPDF = async ({
  data,
  guruDipilih,
  namaGuru,
  bulan,
  guruList = [],
  dataPernyataan, // Parameter baru
}) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Penerjemah ID -> Nama Guru
  const getNamaGuru = (id) => {
    if (!id) return "-";
    const guru = guruList.find((g) => {
      const finalId =
        g.id ||
        g.ID ||
        g.ID_GURU ||
        g.id_guru ||
        g.idGuru ||
        g.NAMA_GURU ||
        g.nama ||
        g.$id ||
        "";
      return String(finalId) === String(id);
    });
    if (!guru) return id;
    return guru.NAMA || guru.nama || guru.NAMA_GURU || guru.nama_guru || id;
  };

  // 2. Deteksi Bulan Otomatis dari Data Spreadsheet
  const teksBulan = autoDetectBulanFromData(data, bulan);

  // 3. Kalkulasi Data
  const totalTempat = data.length;
  let totalSiswaGlobal = 0,
    totalHGlobal = 0,
    totalIGlobal = 0,
    totalSGlobal = 0,
    totalAGlobal = 0;

  const dataProcessed = data.map((item) => {
    let h = 0,
      i = 0,
      s = 0,
      a = 0;
    item.siswa.forEach((siswa) => {
      h += parseInt(siswa.hadir) || 0;
      i += parseInt(siswa.izin) || 0;
      s += parseInt(siswa.sakit) || 0;
      a += parseInt(siswa.alfa) || 0;
    });
    totalSiswaGlobal += item.siswa.length;
    totalHGlobal += h;
    totalIGlobal += i;
    totalSGlobal += s;
    totalAGlobal += a;
    return { ...item, stat: { h, i, s, a } };
  });

  // Tentukan Nama Guru Asli
  let teksNamaGuru = namaGuru;
  if (!teksNamaGuru || teksNamaGuru === guruDipilih) {
    teksNamaGuru = getNamaGuru(guruDipilih);
  }
  if ((!teksNamaGuru || teksNamaGuru === "-") && dataProcessed.length > 0) {
    teksNamaGuru = getNamaGuru(dataProcessed[0].guru);
  }
  if (!teksNamaGuru || teksNamaGuru === "-") {
    teksNamaGuru = "Semua_Guru";
  }

  const tanggalCetak = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const logoImg = await getBase64Image("/logo.png");
  const logoBase64 = logoImg ? logoImg.data : null;

  // ==========================================
  // HALAMAN 1: COVER
  // ==========================================
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SMK NEGERI 1 TELUK KUANTAN", pageWidth / 2, 40, {
    align: "center",
  });
  doc.setFontSize(22);
  doc.text("LAPORAN REKAP PRESENSI MAGANG", pageWidth / 2, 50, {
    align: "center",
  });
  doc.setFontSize(14);
  doc.text("TAHUN PELAJARAN 2026/2027", pageWidth / 2, 58, { align: "center" });

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", pageWidth / 2 - 25, 75, 50, 50);
  }

  let startYCover = 150;
  const addCoverMeta = (label, value, y) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(label, pageWidth / 2, y, { align: "center" });
    doc.setFont("helvetica", "bold");
    doc.text(value, pageWidth / 2, y + 6, { align: "center" });
  };

  addCoverMeta("Guru Pembimbing :", teksNamaGuru, startYCover);
  addCoverMeta("Periode :", teksBulan, startYCover + 18);
  addCoverMeta(
    "Jumlah Tempat Magang :",
    `${totalTempat} Lokasi`,
    startYCover + 36,
  );
  addCoverMeta("Jumlah Siswa :", `${totalSiswaGlobal} Orang`, startYCover + 54);
  addCoverMeta("Tanggal Cetak :", tanggalCetak, startYCover + 72);

  // ==========================================
  // HALAMAN DETAIL: 2 TEMPAT MAGANG PER HALAMAN
  // ==========================================
  let globalPageNum = 2;
  let currentYOnPage = 0;

  const renderHeaderHalaman = () => {
    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, pageWidth, 14, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("SMKN 1 TELUK KUANTAN - LAPORAN PRESENSI MAGANG", 15, 10);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Halaman ${globalPageNum}`, pageWidth - 15, 10, {
      align: "right",
    });
    doc.setTextColor(0, 0, 0);
    globalPageNum++;
  };

  for (let i = 0; i < dataProcessed.length; i++) {
    const item = dataProcessed[i];
    const isFirstOnPage = i % 2 === 0;

    if (isFirstOnPage) {
      doc.addPage();
      renderHeaderHalaman();
      currentYOnPage = 18;
    } else {
      currentYOnPage = 154;
      doc.setDrawColor(210);
      doc.setLineWidth(0.4);
      doc.line(15, 150, pageWidth - 15, 150);
    }

    let detailY = currentYOnPage;

    // FOTO BESAR (Max Tinggi 75mm)
    const bigImgObj = await getBase64Image(item.foto);
    const maxW = 180;
    const maxH = 75;

    if (bigImgObj) {
      let imgW = maxW;
      let imgH = (bigImgObj.height * maxW) / bigImgObj.width;

      if (imgH > maxH) {
        imgH = maxH;
        imgW = (bigImgObj.width * maxH) / bigImgObj.height;
      }

      const xOffset = 15 + (maxW - imgW) / 2;
      const yOffset = detailY + (maxH - imgH) / 2;

      doc.setDrawColor(180);
      doc.setLineWidth(0.3);
      doc.rect(15, detailY, maxW, maxH);
      doc.addImage(bigImgObj.data, "JPEG", xOffset, yOffset, imgW, imgH);
      detailY += maxH + 3;
    } else {
      doc.setDrawColor(200);
      doc.rect(15, detailY, maxW, maxH);
      doc.setFontSize(8);
      doc.text("FOTO TIDAK TERSEDIA", pageWidth / 2, detailY + 35, {
        align: "center",
      });
      detailY += maxH + 3;
    }

    // METADATA
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Tempat Magang:", 15, detailY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let truncatedTempat =
      item.tempat.length > 50
        ? item.tempat.substring(0, 50) + "..."
        : item.tempat;
    doc.text(truncatedTempat, 38, detailY);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Guru:", 115, detailY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(getNamaGuru(item.guru), 124, detailY);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text("Siswa:", 170, detailY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${item.siswa.length} Org`, 180, detailY);

    detailY += 3;

    // TABEL SISWA
    const tableData = item.siswa.map((s, idx) => [
      idx + 1,
      s.nama.split("[")[0].trim(),
      s.hadir,
      s.izin,
      s.sakit,
      s.alfa,
    ]);

    autoTable(doc, {
      startY: detailY,
      head: [["No", "Nama Siswa", "H", "I", "S", "A"]],
      body: tableData,
      theme: "plain",
      styles: { fontSize: 7, cellPadding: 0.8 },
      headStyles: {
        fontStyle: "bold",
        lineWidth: 0.3,
        lineColor: 0,
        fillColor: [240, 240, 240],
      },
      bodyStyles: { lineWidth: 0.1, lineColor: 220 },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { cellWidth: "auto" },
        2: { halign: "center", cellWidth: 10 },
        3: { halign: "center", cellWidth: 10 },
        4: { halign: "center", cellWidth: 10 },
        5: { halign: "center", cellWidth: 10 },
      },
      margin: { left: 15, right: 15 },
    });

    // KOTAK RINGKASAN
    let finalY = doc.lastAutoTable.finalY + 2;
    doc.setDrawColor(0);
    doc.setLineWidth(0.4);
    doc.line(15, finalY, 195, finalY);

    finalY += 3.5;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(
      `Total Hadir: ${item.stat.h}   |   Total Izin: ${item.stat.i}   |   Total Sakit: ${item.stat.s}   |   Total Alfa: ${item.stat.a}`,
      15,
      finalY,
    );

    finalY += 2;
    doc.line(15, finalY, 195, finalY);
  }

  // ==========================================
  // HALAMAN TERAKHIR: REKAP AKHIR & TTD
  // ==========================================
  doc.addPage();

  doc.setFillColor(33, 37, 41);
  doc.rect(0, 0, pageWidth, 16, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SMKN 1 TELUK KUANTAN - LAPORAN PRESENSI MAGANG", 15, 11);

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.text("REKAP AKHIR", pageWidth / 2, 45, { align: "center" });
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - 25, 48, pageWidth / 2 + 25, 48);

  let rekapY = 65;
  const col1 = 50;
  const col2 = 140;

  const addRekapRow = (label, val, y) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text(label, col1, y);
    doc.setFont("helvetica", "bold");
    doc.text(val.toString(), col2, y);
    doc.setDrawColor(200);
    doc.setLineWidth(0.2);
    doc.line(col1, y + 2, col2 + 20, y + 2);
  };

  addRekapRow("Jumlah Tempat Magang", totalTempat, rekapY);
  addRekapRow("Jumlah Siswa", totalSiswaGlobal, rekapY + 12);
  addRekapRow("Total Hadir", totalHGlobal, rekapY + 24);
  addRekapRow("Total Izin", totalIGlobal, rekapY + 36);
  addRekapRow("Total Sakit", totalSGlobal, rekapY + 48);
  addRekapRow("Total Alfa", totalAGlobal, rekapY + 60);

  const ttdY = 175;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Mengetahui,", 145, ttdY);
  doc.text("Guru Pembimbing", 145, ttdY + 5);

  doc.setFont("helvetica", "bold");
  doc.text(teksNamaGuru, 145, ttdY + 32);
  doc.setDrawColor(0);
  doc.setLineWidth(0.4);
  doc.line(145, ttdY + 33, 195, ttdY + 33);
  doc.setFont("helvetica", "normal");
  doc.text(`NIP. ${" ".repeat(25)}`, 145, ttdY + 38);

  // ==========================================
  // HALAMAN TAMBAHAN: PERNYATAAN PERTANGGUNGJAWABAN MUTLAK
  // ==========================================
  if (dataPernyataan) {
    doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("PERNYATAAN PERTANGGUNGJAWABAN MUTLAK", pageWidth / 2, 30, {
      align: "center",
    });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);

    let py = 50;
    doc.text("Saya yang bertanda tangan di bawah ini :", 15, py);

    py += 10;
    doc.text(`Nama`, 15, py);
    doc.text(`: ${dataPernyataan.nama || "-"}`, 50, py);

    py += 8;
    doc.text(`NIP`, 15, py);
    doc.text(`: ${dataPernyataan.nip || "-"}`, 50, py);

    py += 8;
    doc.text(`Pangkat / Gol`, 15, py);
    doc.text(`: ${dataPernyataan.pangkat || "-"}`, 50, py);

    py += 8;
    doc.text(`Jabatan`, 15, py);
    doc.text(`: ${dataPernyataan.jabatan || "-"}`, 50, py);

    py += 15;
    const paragraf1 = `Dengan ini menyatakan dengan sesungguhnya bahwa saya telah melaksanakan tugas perjalanan dinas sesuai Surat Perintah Tugas (SPT) Nomor : ${dataPernyataan.spt || "-"}`;
    const splitParagraf1 = doc.splitTextToSize(paragraf1, pageWidth - 30);
    doc.text(splitParagraf1, 15, py);
    py += splitParagraf1.length * 6 + 4;

    const paragraf2 =
      "Disamping itu, pembebanan anggaran biaya perjalanan dinas yang akan saya laksanakan tidak ganda dengan kegiatan lainnya.";
    const splitParagraf2 = doc.splitTextToSize(paragraf2, pageWidth - 30);
    doc.text(splitParagraf2, 15, py);
    py += splitParagraf2.length * 6 + 4;

    const paragraf3 =
      "Apabila terbukti saya tidak melaksanakan tugas sesuai SPT dan tidak menyampaikan bukti pertanggungjawaban yang telah ditetapkan dalam Peraturan Gubernur tentang Pedoman Perjalanan Dinas yang Bersumber dari Anggaran Pendapatan dan Belanja Daerah Provinsi Riau, maka saya mempertanggungjawabkannya sesuai dengan ketentuan peraturan perundang-undangan.";
    const splitParagraf3 = doc.splitTextToSize(paragraf3, pageWidth - 30);
    doc.text(splitParagraf3, 15, py);
    py += splitParagraf3.length * 6 + 4;

    const paragraf4 =
      "Demikian Surat Pernyataan ini saya buat dengan sebenarnya untuk dapat dipergunakan sebagaimana mestinya.";
    const splitParagraf4 = doc.splitTextToSize(paragraf4, pageWidth - 30);
    doc.text(splitParagraf4, 15, py);

    py += 30;
    const cetakDate = new Date();
    const namaBulanCetak = [
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
    const tanggalFormat = `${cetakDate.getDate()} ${namaBulanCetak[cetakDate.getMonth()]} ${cetakDate.getFullYear()}`;

    doc.text(`Teluk Kuantan, ${tanggalFormat}`, 120, py);
    doc.text("Yang Membuat Pernyataan,", 120, py + 6);

    py += 35;
    doc.setFont("helvetica", "bold");
    doc.text(dataPernyataan.nama || "-", 120, py);
    doc.setFont("helvetica", "normal");
    doc.text(`NIP. ${dataPernyataan.nip || "-"}`, 120, py + 6);
  }

  const namaFileAman = teksNamaGuru.replace(/[^a-zA-Z0-9_]/g, "_");
  const bulanFileAman = teksBulan.replace(/[^a-zA-Z0-9_]/g, "_");
  doc.save(`Laporan_Magang_${namaFileAman}_${bulanFileAman}.pdf`);
};
