/**
 * ============================================================
 * JurnalPKL.gs
 *
 * Modul Jurnal PKL (Guru Pembimbing)
 *
 * SUMBER RELASI:
 *   SISWA (kolom ID_GURU) — TIDAK butuh tabel relasi terpisah
 *   seperti GURU_WALI, karena ID_GURU di sheet SISWA memang
 *   sudah menunjuk ke Guru Pembimbing PKL siswa tersebut.
 *
 * DATA JURNAL:
 *   JURNAL_PKL
 *
 * CATATAN:
 * Modul ini sengaja dibuat terpisah (meniru pola JurnalGuruWali.gs)
 * agar tidak mengganggu sistem Jurnal Guru Wali yang sudah berjalan.
 * ============================================================
 */


// ============================================================
// 1. HEADER JURNAL PKL
// ============================================================

const HEADER_JURNAL_PKL = [
  "ID_JURNAL",
  "ID_GURU",
  "ID_SISWA",
  "TANGGAL",
  "NAMA_SISWA",
  "KELAS",
  "TEMPAT_PKL",
  "MATERI",
  "PERMASALAHAN",
  "TINDAK_LANJUT",
  "FOTO_URL",
  "FOTO_ID",
  "CREATED_AT",
  "MINGGU_KE"
];


// ============================================================
// 2. AMBIL SHEET JURNAL PKL
// ============================================================

function getSheetJurnalPKL() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(SHEETS.JURNAL_PKL);

  if (!sheet) {

    throw new Error(
      "Sheet " +
      SHEETS.JURNAL_PKL +
      " tidak ditemukan."
    );

  }

  return sheet;
}


// ============================================================
// 3. BUAT ID JURNAL PKL
// ============================================================

function generateIdJurnalPKL() {

  const waktu = new Date();

  return (
    "JP-" +
    Utilities.formatDate(
      waktu,
      Session.getScriptTimeZone(),
      "yyyyMMdd-HHmmss"
    ) +
    "-" +
    Math.floor(Math.random() * 1000)
  );
}


// ============================================================
// 4. SIMPAN JURNAL PKL (BANYAK BARIS SEKALIGUS)
//
// params: {
//   idGuru,
//   items: [
//     { idSiswa, mingguKe, tanggal, materi, permasalahan,
//       tindakLanjut, fotoUrl,
//       namaSiswa?,  // ← opsional: override dari frontend (untuk multi-siswa)
//       kelas?       // ← opsional: override dari frontend (untuk multi-siswa)
//     },
//     ...
//   ]
// }
//
// Multi-siswa dalam 1 baris jurnal:
//   Frontend mengirim 1 item dengan idSiswa = idSiswa pertama,
//   namaSiswa = "Siswa A / Siswa B / Siswa C" (gabungan).
//   Backend menggunakan namaSiswa dari frontend jika tersedia,
//   sehingga cetak PDF menampilkan semua nama dalam 1 baris.
//
// Setiap baris pada tabel "Isi Jurnal PKL" di frontend = 1 baris
// sheet = 1 ID_JURNAL sendiri (beda dgn Guru Wali kelompok yang
// berbagi 1 idJurnal), karena tiap baris jurnal PKL adalah
// pertemuan individual yang berdiri sendiri.
// ============================================================

function saveJurnalPKL(params) {

  Logger.log("==========================================");
  Logger.log("       SIMPAN JURNAL PKL");
  Logger.log("==========================================");

  if (!params) {
    return errorResponse("Data jurnal tidak ditemukan");
  }

  const idGuru =
    String(params.idGuru || "").trim();

  if (!idGuru) {
    return errorResponse("ID guru tidak ditemukan");
  }

  const items = params.items;

  if (!Array.isArray(items) || items.length === 0) {
    return errorResponse("Tidak ada baris jurnal untuk disimpan");
  }


  // ==========================================================
  // AMBIL DATA SISWA SEKALIGUS (untuk validasi relasi & nama/kelas)
  // ==========================================================

  const semuaSiswa =
    getAllData(SHEETS.SISWA);

  const sheet =
    getSheetJurnalPKL();

  const rowsToInsert = [];
  const hasilSimpan = [];

  for (let x = 0; x < items.length; x++) {

    const item = items[x];

    const idSiswa =
      String(item.idSiswa || "").trim();

    if (!idSiswa) {
      return errorResponse(
        "Baris ke-" + (x + 1) + ": ID siswa tidak ditemukan"
      );
    }

    if (!item.tanggal) {
      return errorResponse(
        "Baris ke-" + (x + 1) + ": tanggal wajib diisi"
      );
    }

    if (!String(item.materi || "").trim()) {
      return errorResponse(
        "Baris ke-" + (x + 1) + ": materi bimbingan wajib diisi"
      );
    }


    // --------------------------------------------------------
    // 1. CARI DATA SISWA & VALIDASI RELASI GURU -> SISWA
    //    (validasi menggunakan idSiswa pertama / utama)
    // --------------------------------------------------------

    const siswa =
      semuaSiswa.find(function (row) {
        return String(row[COLUMNS.SISWA.ID] || "").trim() === idSiswa;
      });

    if (!siswa) {
      return errorResponse(
        "Baris ke-" + (x + 1) + ": data siswa tidak ditemukan (" + idSiswa + ")"
      );
    }

    const idGuruSiswa =
      String(siswa[COLUMNS.SISWA.ID_GURU] || "").trim();

    if (idGuruSiswa !== idGuru) {
      return errorResponse(
        "Baris ke-" + (x + 1) + ": siswa " + idSiswa +
        " bukan bimbingan guru pembimbing ini"
      );
    }


    // --------------------------------------------------------
    // 2. TENTUKAN NAMA SISWA DAN KELAS
    //
    //    Prioritas:
    //    a) Jika frontend mengirim item.namaSiswa (override, misal
    //       gabungan "Siswa A / Siswa B"), gunakan itu langsung.
    //    b) Jika tidak, parsing dari data sheet SISWA.
    // --------------------------------------------------------

    let namaSiswa = "";
    let kelasSiswa = "";

    const namaSiswaOverride = String(item.namaSiswa || "").trim();
    const kelasOverride     = String(item.kelas     || "").trim();

    if (namaSiswaOverride) {

      // Gunakan nama gabungan dari frontend (multi-siswa)
      namaSiswa  = namaSiswaOverride;
      kelasSiswa = kelasOverride || "-";

    } else {

      // Fallback: ambil dari data siswa di sheet
      const namaAsli = String(siswa[COLUMNS.SISWA.NAMA] || "").trim();

      const matchKelas = namaAsli.match(/\s*\[([^\]]+)\]\s*$/);

      if (matchKelas) {
        kelasSiswa = matchKelas[1].trim();
        namaSiswa  = namaAsli.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
      } else {
        namaSiswa  = namaAsli;
        kelasSiswa = "-";
      }

    }

    if (!kelasSiswa) kelasSiswa = "-";

    const tempatPkl =
      String(item.tempatPkl || siswa[COLUMNS.SISWA.TEMPAT_MAGANG] || "").trim();


    // --------------------------------------------------------
    // 3. UPLOAD FOTO (opsional) — pakai fungsi uploadPhoto yang
    //    SUDAH ADA di sistem Presensi (sama seperti Jurnal Wali)
    // --------------------------------------------------------

    let urlFotoAkhir = "";

    if (item.fotoUrl && String(item.fotoUrl).startsWith("data:image")) {

      const base64   = item.fotoUrl.split(",")[1];
      const namaFile = "JURNAL_PKL_" + idGuru + "_" + idSiswa + "_" + Date.now() + ".jpg";

      const upload = uploadPhoto(base64, namaFile, "image/jpeg");

      if (!upload.success) {
        return errorResponse(
          "Baris ke-" + (x + 1) + ": gagal mengupload bukti foto - " + upload.message
        );
      }

      urlFotoAkhir = upload.data.url;

    } else if (item.fotoUrl && !String(item.fotoUrl).startsWith("data:image")) {

      // URL eksternal yang sudah ada (base64 sudah diproses di sisi client)
      urlFotoAkhir = String(item.fotoUrl).trim();
    }


    // --------------------------------------------------------
    // 4. SUSUN BARIS
    // --------------------------------------------------------

    const idJurnal = generateIdJurnalPKL();

    const row = [
      idJurnal,
      idGuru,
      idSiswa,
      item.tanggal || "",
      namaSiswa,
      kelasSiswa,
      tempatPkl,
      String(item.materi       || "").trim(),
      String(item.permasalahan || "").trim(),
      String(item.tindakLanjut || "").trim(),
      urlFotoAkhir,
      "",
      new Date(),
      String(item.mingguKe || "").trim()
    ];

    rowsToInsert.push(row);

    hasilSimpan.push({
      idJurnal:  idJurnal,
      idSiswa:   idSiswa,
      namaSiswa: namaSiswa,
      kelas:     kelasSiswa
    });
  }


  // ==========================================================
  // BATCH INSERT
  // ==========================================================

  if (rowsToInsert.length > 0) {
    sheet
      .getRange(
        sheet.getLastRow() + 1,
        1,
        rowsToInsert.length,
        rowsToInsert[0].length
      )
      .setValues(rowsToInsert);
  }

  Logger.log("TOTAL BARIS JURNAL PKL : " + hasilSimpan.length);

  return successResponse(
    hasilSimpan.length + " jurnal PKL berhasil disimpan",
    {
      jumlah: hasilSimpan.length,
      data:   hasilSimpan
    }
  );
}


// ============================================================
// 5. AMBIL SEMUA JURNAL PKL MILIK GURU PEMBIMBING
// ============================================================

function getJurnalPKL(idGuru) {

  Logger.log("==========================================");
  Logger.log("     AMBIL JURNAL PKL");
  Logger.log("ID GURU : " + idGuru);
  Logger.log("==========================================");

  if (!idGuru) {
    return errorResponse("ID guru tidak ditemukan");
  }

  const guru = String(idGuru).trim();

  const sheet = getSheetJurnalPKL();
  const data  = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return successResponse("Belum ada jurnal PKL", []);
  }

  const headers = data[0];
  const col = {};

  headers.forEach(function (header, index) {
    col[String(header).trim()] = index;
  });

  const hasil = [];

  for (let i = 1; i < data.length; i++) {

    const row = data[i];

    const rowGuru =
      String(row[col.ID_GURU] || "").trim();

    if (rowGuru !== guru) {
      continue;
    }

    const namaGuruJurnal =
      getNamaGuruJurnal(rowGuru);

    hasil.push({
      idJurnal:    row[col.ID_JURNAL]    || "",
      idGuru:      rowGuru,
      namaGuru:    namaGuruJurnal || rowGuru,
      idSiswa:     row[col.ID_SISWA]     || "",
      tanggal:     row[col.TANGGAL]      || "",
      namaSiswa:   row[col.NAMA_SISWA]   || "",
      kelas:       row[col.KELAS]        || "",
      tempatPkl:   row[col.TEMPAT_PKL]   || "",
      materi:      row[col.MATERI]       || "",
      permasalahan: row[col.PERMASALAHAN] || "",
      tindakLanjut: row[col.TINDAK_LANJUT] || "",
      fotoUrl:     row[col.FOTO_URL]     || "",
      fotoId:      row[col.FOTO_ID]      || "",
      createdAt:   row[col.CREATED_AT]   || "",
      mingguKe:    row[col.MINGGU_KE]    || ""
    });
  }

  Logger.log("JUMLAH JURNAL PKL : " + hasil.length);

  return successResponse(
    "Jurnal PKL berhasil ditemukan",
    hasil
  );
}


// ============================================================
// 6. HAPUS SATU BARIS JURNAL PKL
//
// params: {
//   idGuru   : string  — wajib, untuk memvalidasi kepemilikan
//   idJurnal : string  — wajib, ID baris yang akan dihapus
// }
// ============================================================

function deleteJurnalPKL(params) {

  Logger.log("==========================================");
  Logger.log("       HAPUS JURNAL PKL");
  Logger.log("==========================================");

  if (!params) {
    return errorResponse("Parameter tidak ditemukan");
  }

  const idGuru   = String(params.idGuru   || "").trim();
  const idJurnal = String(params.idJurnal || "").trim();

  if (!idGuru) {
    return errorResponse("idGuru wajib diisi");
  }

  if (!idJurnal) {
    return errorResponse("idJurnal wajib diisi");
  }

  const sheet = getSheetJurnalPKL();
  const data  = sheet.getDataRange().getValues();

  if (data.length < 2) {
    return errorResponse("Tidak ada data jurnal PKL");
  }

  // Bangun peta kolom dari header
  const headers = data[0];
  const col = {};

  headers.forEach(function (header, index) {
    col[String(header).trim()] = index;
  });

  if (col.ID_JURNAL === undefined) {
    return errorResponse("Kolom ID_JURNAL tidak ditemukan di sheet JURNAL_PKL");
  }

  let deleted = 0;

  // Iterasi mundur agar penghapusan baris tidak menggeser indeks
  for (let i = data.length - 1; i >= 1; i--) {

    const rowJurnal =
      String(data[i][col.ID_JURNAL] || "").trim();

    const rowGuru =
      col.ID_GURU !== undefined
        ? String(data[i][col.ID_GURU] || "").trim()
        : "";

    if (rowJurnal !== idJurnal) continue;

    // Validasi kepemilikan: hanya boleh hapus jurnal milik guru ini
    if (col.ID_GURU !== undefined && rowGuru !== idGuru) {
      return errorResponse(
        "Jurnal ini bukan milik guru yang sedang login"
      );
    }

    // data[0] = header (baris sheet ke-1), data[1] = baris sheet ke-2, dst.
    sheet.deleteRow(i + 1);
    deleted++;

    // Setiap ID_JURNAL unik, cukup hapus 1 baris
    break;
  }

  if (deleted === 0) {
    return errorResponse(
      "Jurnal tidak ditemukan atau bukan milik guru ini"
    );
  }

  Logger.log("ID JURNAL DIHAPUS : " + idJurnal);

  return successResponse("Jurnal PKL berhasil dihapus", {
    idJurnal: idJurnal,
    deleted:  deleted
  });
}


/**
 * Catatan: fungsi getNamaGuruJurnal() TIDAK perlu dibuat ulang —
 * sudah ada di JurnalGuruWali.gs dan bisa dipakai langsung karena
 * semua file .gs dalam 1 project berbagi scope global yang sama.
 */

