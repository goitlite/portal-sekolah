/**
 * BiodataSiswa.gs
 *
 * Mengambil dan memperbarui biodata siswa sendiri.
 * Data disimpan di DATA_SISWA_WALI.
 */

function getBiodataSiswa(idSiswa) {
  if (isEmpty(idSiswa)) return errorResponse("ID siswa tidak boleh kosong");
  idSiswa = String(idSiswa).trim();

  const siswa = findDataByColumn(SHEETS.SISWA, COLUMNS.SISWA.ID, idSiswa);
  if (!siswa) return errorResponse("Data siswa tidak ditemukan");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.DATA_SISWA_WALI);
  if (!sheet) return errorResponse("Sheet DATA_SISWA_WALI tidak ditemukan");

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return errorResponse("Sheet DATA_SISWA_WALI belum memiliki header");

  const headers = values[0];
  function col(name) { return headers.indexOf(name); }

  const idColumn = col(COLUMNS.DATA_SISWA_WALI.ID_SISWA);
  if (idColumn === -1) return errorResponse("Kolom ID_SISWA tidak ditemukan di DATA_SISWA_WALI");

  let detail = null;
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][idColumn] || "").trim();
    if (id === idSiswa) {
      detail = values[i];
      break;
    }
  }

  function value(columnName) {
    if (!columnName) return "";
    let index = col(columnName);
    // Pencarian kolom fleksibel untuk FOTO_WAJAH
    if (index === -1 && (columnName === "FOTO_WAJAH" || columnName === (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH))) {
      index = col("FOTO_WAJAH");
      if (index === -1) index = col("FOTO WAJAH");
      if (index === -1) index = col("fotoWajah");
    }
    if (index === -1 || !detail) return "";
    return detail[index];
  }

  const colWajahTarget = (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH) || "FOTO_WAJAH";

  const hasil = {
    idSiswa: idSiswa,
    nama: siswa[COLUMNS.SISWA.NAMA] || "",
    namaGuru: siswa[COLUMNS.SISWA.NAMA_GURU] || "",
    tempatMagang: siswa[COLUMNS.SISWA.TEMPAT_MAGANG] || "",

    // DATA BIODATA
    fotoProfil: value(COLUMNS.DATA_SISWA_WALI.FOTO_PROFIL) || "",
    fotoWajah: value(colWajahTarget) || "", // Mengambil foto wajah presensi dari sheet
    noHp: value(COLUMNS.DATA_SISWA_WALI.NO_HP) || "", 
    tempatLahir: value(COLUMNS.DATA_SISWA_WALI.TEMPAT_LAHIR) || "",
    tglLahir: formatTanggalWali(value(COLUMNS.DATA_SISWA_WALI.TGL_LAHIR)),
    
    ayah: value(COLUMNS.DATA_SISWA_WALI.AYAH) || "",
    pekerjaanAyah: value(COLUMNS.DATA_SISWA_WALI.PEKERJAAN_AYAH) || "",
    kontakAyah: formatKontakWali(value(COLUMNS.DATA_SISWA_WALI.KONTAK_AYAH)),
    ibu: value(COLUMNS.DATA_SISWA_WALI.IBU) || "",
    pekerjaanIbu: value(COLUMNS.DATA_SISWA_WALI.PEKERJAAN_IBU) || "",
    kontakIbu: formatKontakWali(value(COLUMNS.DATA_SISWA_WALI.KONTAK_IBU)),
    
    anakKe: value(COLUMNS.DATA_SISWA_WALI.ANAK_KE) || "",
    alamat: value(COLUMNS.DATA_SISWA_WALI.ALAMAT) || "",
    hobi: value(COLUMNS.DATA_SISWA_WALI.HOBI) || "",
    bakatKeahlian: value(COLUMNS.DATA_SISWA_WALI.BAKAT_KEAHLIAN) || "",
    transportasi: value(COLUMNS.DATA_SISWA_WALI.TRANSPORTASI) || "",
    
    pelajaranDisukai: value(COLUMNS.DATA_SISWA_WALI.PELAJARAN_DISUKAI) || "",
    alasanDisukai: value(COLUMNS.DATA_SISWA_WALI.ALASAN_DISUKAI) || "",
    pelajaranTidakDisukai: value(COLUMNS.DATA_SISWA_WALI.PELAJARAN_TIDAK_DISUKAI) || "",
    alasanTidakDisukai: value(COLUMNS.DATA_SISWA_WALI.ALASAN_TIDAK_DISUKAI) || "",
    harapan: value(COLUMNS.DATA_SISWA_WALI.HARAPAN_DI_SMKN1) || "",
    ijazahSmp: value(COLUMNS.DATA_SISWA_WALI.IJAZAH_SMP) || "",

    // DOKUMEN & NILAI RAPOR TAMBAHAN
    kartuKeluarga: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.KARTU_KELUARGA) || "KARTU_KELUARGA") || value("KARTU_KELUARGA") || value("kartuKeluarga") || "",
    
    totalNilai1: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_1) || "TOTAL_NILAI_1") || value("TOTAL_NILAI_1") || value("totalNilai1") || "",
    mapel1: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_1) || "MAPEL_1") || value("MAPEL_1") || value("mapel1") || "",
    nilaiRapor1: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_1) || "NILAI_RAPOR_1") || value("NILAI_RAPOR_1") || value("nilaiRapor1") || "",

    totalNilai2: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_2) || "TOTAL_NILAI_2") || value("TOTAL_NILAI_2") || value("totalNilai2") || "",
    mapel2: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_2) || "MAPEL_2") || value("MAPEL_2") || value("mapel2") || "",
    nilaiRapor2: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_2) || "NILAI_RAPOR_2") || value("NILAI_RAPOR_2") || value("nilaiRapor2") || "",

    totalNilai3: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_3) || "TOTAL_NILAI_3") || value("TOTAL_NILAI_3") || value("totalNilai3") || "",
    mapel3: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_3) || "MAPEL_3") || value("MAPEL_3") || value("mapel3") || "",
    nilaiRapor3: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_3) || "NILAI_RAPOR_3") || value("NILAI_RAPOR_3") || value("nilaiRapor3") || "",

    totalNilai4: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_4) || "TOTAL_NILAI_4") || value("TOTAL_NILAI_4") || value("totalNilai4") || "",
    mapel4: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_4) || "MAPEL_4") || value("MAPEL_4") || value("mapel4") || "",
    nilaiRapor4: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_4) || "NILAI_RAPOR_4") || value("NILAI_RAPOR_4") || value("nilaiRapor4") || "",

    nilaiRaporRata: value((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_RATA) || "NILAI_RAPOR_RATA") || value("NILAI_RAPOR_RATA") || value("nilaiRaporRata") || "",

    // ===================================================
    // CATATAN PERKEMBANGAN MURID (LAMPIRAN B)
    // ===================================================
    periodeAwal: value(COLUMNS.DATA_SISWA_WALI.PERIODE_AWAL) || "",
    periodeAkhir: value(COLUMNS.DATA_SISWA_WALI.PERIODE_AKHIR) || "",
    desAkademik: value(COLUMNS.DATA_SISWA_WALI.DES_AKADEMIK) || "",
    tinAkademik: value(COLUMNS.DATA_SISWA_WALI.TIN_AKADEMIK) || "",
    ketAkademik: value(COLUMNS.DATA_SISWA_WALI.KET_AKADEMIK) || "",
    desKarakter: value(COLUMNS.DATA_SISWA_WALI.DES_KARAKTER) || "",
    tinKarakter: value(COLUMNS.DATA_SISWA_WALI.TIN_KARAKTER) || "",
    ketKarakter: value(COLUMNS.DATA_SISWA_WALI.KET_KARAKTER) || "",
    desSosial: value(COLUMNS.DATA_SISWA_WALI.DES_SOSIAL) || "",
    tinSosial: value(COLUMNS.DATA_SISWA_WALI.TIN_SOSIAL) || "",
    ketSosial: value(COLUMNS.DATA_SISWA_WALI.KET_SOSIAL) || "",
    desDisiplin: value(COLUMNS.DATA_SISWA_WALI.DES_DISIPLIN) || "",
    tinDisiplin: value(COLUMNS.DATA_SISWA_WALI.TIN_DISIPLIN) || "",
    ketDisiplin: value(COLUMNS.DATA_SISWA_WALI.KET_DISIPLIN) || "",
    desPotensi: value(COLUMNS.DATA_SISWA_WALI.DES_POTENSI) || "",
    tinPotensi: value(COLUMNS.DATA_SISWA_WALI.TIN_POTENSI) || "",
    ketPotensi: value(COLUMNS.DATA_SISWA_WALI.KET_POTENSI) || ""
  };

  return successResponse("Data biodata berhasil diambil", hasil);
}

function updateBiodataSiswa(idSiswa, data) {
  if (isEmpty(idSiswa)) return errorResponse("ID siswa tidak boleh kosong");
  idSiswa = String(idSiswa).trim();

  const siswa = findDataByColumn(SHEETS.SISWA, COLUMNS.SISWA.ID, idSiswa);
  if (!siswa) return errorResponse("Data siswa tidak ditemukan");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.DATA_SISWA_WALI);
  if (!sheet) return errorResponse("Sheet DATA_SISWA_WALI tidak ditemukan");

  const values = sheet.getDataRange().getValues();
  if (values.length < 1) return errorResponse("Sheet DATA_SISWA_WALI belum memiliki header");

  const headers = values[0];
  const idColumn = headers.indexOf(COLUMNS.DATA_SISWA_WALI.ID_SISWA);
  if (idColumn === -1) return errorResponse("Kolom ID_SISWA tidak ditemukan");

  // Otomatis buat header kolom FOTO_WAJAH jika belum ada di Sheet DATA_SISWA_WALI
  const colWajahTarget = (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH) || "FOTO_WAJAH";
  if (headers.indexOf(colWajahTarget) === -1 && headers.indexOf("FOTO WAJAH") === -1 && headers.indexOf("fotoWajah") === -1) {
    sheet.getRange(1, headers.length + 1).setValue("FOTO_WAJAH");
    headers.push("FOTO_WAJAH");
  }

  // Otomatis buat header kolom dokumen & nilai rapor jika belum ada
  const autoHeaders = [
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.KARTU_KELUARGA) || "KARTU_KELUARGA",
    
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_1) || "TOTAL_NILAI_1",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_1) || "MAPEL_1",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_1) || "NILAI_RAPOR_1",

    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_2) || "TOTAL_NILAI_2",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_2) || "MAPEL_2",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_2) || "NILAI_RAPOR_2",

    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_3) || "TOTAL_NILAI_3",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_3) || "MAPEL_3",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_3) || "NILAI_RAPOR_3",

    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_4) || "TOTAL_NILAI_4",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_4) || "MAPEL_4",
    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_4) || "NILAI_RAPOR_4",

    (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_RATA) || "NILAI_RAPOR_RATA"
  ];
  autoHeaders.forEach(function(h) {
    if (headers.indexOf(h) === -1) {
      sheet.getRange(1, headers.length + 1).setValue(h);
      headers.push(h);
    }
  });

  let rowNumber = -1;
  for (let i = 1; i < values.length; i++) {
    const id = String(values[i][idColumn] || "").trim();
    if (id === idSiswa) {
      rowNumber = i + 1;
      break;
    }
  }

  if (rowNumber === -1) {
    const newRow = new Array(headers.length).fill("");
    newRow[idColumn] = idSiswa;

    Object.keys(data || {}).forEach(function(key) {
      const columnName = getBiodataColumnName(key);
      if (!columnName) return;
      let columnIndex = headers.indexOf(columnName);
      if (columnIndex === -1 && key === "fotoWajah") {
        columnIndex = headers.indexOf("FOTO WAJAH");
        if (columnIndex === -1) columnIndex = headers.indexOf("fotoWajah");
      }
      if (columnIndex === -1) return;
      newRow[columnIndex] = sanitizeBiodataValue(data[key]);
    });

    sheet.appendRow(newRow);
    clearCache(SHEETS.DATA_SISWA_WALI);
    return successResponse("Biodata berhasil disimpan", { idSiswa: idSiswa });
  }

  Object.keys(data || {}).forEach(function(key) {
    const columnName = getBiodataColumnName(key);
    if (!columnName) return;
    if (columnName === COLUMNS.DATA_SISWA_WALI.ID_SISWA) return;
    
    let columnIndex = headers.indexOf(columnName);
    if (columnIndex === -1 && key === "fotoWajah") {
      columnIndex = headers.indexOf("FOTO WAJAH");
      if (columnIndex === -1) columnIndex = headers.indexOf("fotoWajah");
    }
    if (columnIndex === -1) return;
    sheet.getRange(rowNumber, columnIndex + 1).setValue(sanitizeBiodataValue(data[key]));
  });

  return successResponse("Biodata berhasil diperbarui", { idSiswa: idSiswa });
}

function getBiodataColumnName(key) {
  const colWajah = (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH) || "FOTO_WAJAH";
  const map = {
    fotoProfil: COLUMNS.DATA_SISWA_WALI.FOTO_PROFIL,
    fotoWajah: colWajah, // Memetakan properti fotoWajah ke kolom FOTO_WAJAH
    noHp: COLUMNS.DATA_SISWA_WALI.NO_HP,
    tempatLahir: COLUMNS.DATA_SISWA_WALI.TEMPAT_LAHIR,
    tglLahir: COLUMNS.DATA_SISWA_WALI.TGL_LAHIR,
    ayah: COLUMNS.DATA_SISWA_WALI.AYAH,
    pekerjaanAyah: COLUMNS.DATA_SISWA_WALI.PEKERJAAN_AYAH,
    kontakAyah: COLUMNS.DATA_SISWA_WALI.KONTAK_AYAH,
    ibu: COLUMNS.DATA_SISWA_WALI.IBU,
    pekerjaanIbu: COLUMNS.DATA_SISWA_WALI.PEKERJAAN_IBU,
    kontakIbu: COLUMNS.DATA_SISWA_WALI.KONTAK_IBU,
    anakKe: COLUMNS.DATA_SISWA_WALI.ANAK_KE,
    alamat: COLUMNS.DATA_SISWA_WALI.ALAMAT,
    hobi: COLUMNS.DATA_SISWA_WALI.HOBI,
    bakatKeahlian: COLUMNS.DATA_SISWA_WALI.BAKAT_KEAHLIAN,
    transportasi: COLUMNS.DATA_SISWA_WALI.TRANSPORTASI,
    pelajaranDisukai: COLUMNS.DATA_SISWA_WALI.PELAJARAN_DISUKAI,
    alasanDisukai: COLUMNS.DATA_SISWA_WALI.ALASAN_DISUKAI,
    pelajaranTidakDisukai: COLUMNS.DATA_SISWA_WALI.PELAJARAN_TIDAK_DISUKAI,
    alasanTidakDisukai: COLUMNS.DATA_SISWA_WALI.ALASAN_TIDAK_DISUKAI,
    harapan: COLUMNS.DATA_SISWA_WALI.HARAPAN_DI_SMKN1,
    ijazahSmp: COLUMNS.DATA_SISWA_WALI.IJAZAH_SMP,

    // DOKUMEN & NILAI RAPOR TAMBAHAN
    kartuKeluarga: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.KARTU_KELUARGA) || "KARTU_KELUARGA",
    
    totalNilai1: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_1) || "TOTAL_NILAI_1",
    mapel1: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_1) || "MAPEL_1",
    nilaiRapor1: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_1) || "NILAI_RAPOR_1",

    totalNilai2: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_2) || "TOTAL_NILAI_2",
    mapel2: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_2) || "MAPEL_2",
    nilaiRapor2: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_2) || "NILAI_RAPOR_2",

    totalNilai3: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_3) || "TOTAL_NILAI_3",
    mapel3: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_3) || "MAPEL_3",
    nilaiRapor3: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_3) || "NILAI_RAPOR_3",

    totalNilai4: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_4) || "TOTAL_NILAI_4",
    mapel4: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_4) || "MAPEL_4",
    nilaiRapor4: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_4) || "NILAI_RAPOR_4",

    nilaiRaporRata: (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_RATA) || "NILAI_RAPOR_RATA",

    // ===================================================
    // CATATAN PERKEMBANGAN MURID (LAMPIRAN B)
    // ===================================================
    periodeAwal: COLUMNS.DATA_SISWA_WALI.PERIODE_AWAL,
    periodeAkhir: COLUMNS.DATA_SISWA_WALI.PERIODE_AKHIR,
    desAkademik: COLUMNS.DATA_SISWA_WALI.DES_AKADEMIK,
    tinAkademik: COLUMNS.DATA_SISWA_WALI.TIN_AKADEMIK,
    ketAkademik: COLUMNS.DATA_SISWA_WALI.KET_AKADEMIK,
    desKarakter: COLUMNS.DATA_SISWA_WALI.DES_KARAKTER,
    tinKarakter: COLUMNS.DATA_SISWA_WALI.TIN_KARAKTER,
    ketKarakter: COLUMNS.DATA_SISWA_WALI.KET_KARAKTER,
    desSosial: COLUMNS.DATA_SISWA_WALI.DES_SOSIAL,
    tinSosial: COLUMNS.DATA_SISWA_WALI.TIN_SOSIAL,
    ketSosial: COLUMNS.DATA_SISWA_WALI.KET_SOSIAL,
    desDisiplin: COLUMNS.DATA_SISWA_WALI.DES_DISIPLIN,
    tinDisiplin: COLUMNS.DATA_SISWA_WALI.TIN_DISIPLIN,
    ketDisiplin: COLUMNS.DATA_SISWA_WALI.KET_DISIPLIN,
    desPotensi: COLUMNS.DATA_SISWA_WALI.DES_POTENSI,
    tinPotensi: COLUMNS.DATA_SISWA_WALI.TIN_POTENSI,
    ketPotensi: COLUMNS.DATA_SISWA_WALI.KET_POTENSI
  };
  return map[key] || null;
}

function sanitizeBiodataValue(value) {
  if (value === null || value === undefined) return "";
  const str = String(value).trim();
  if (/^0\d+$/.test(str)) return "'" + str;
  if (/^\d{4}-\d{2}$/.test(str)) return "'" + str;
  return str;
}

/**
 * Mengambil foto wajah banyak siswa sekaligus dalam 1 panggilan (Bulk).
 * @param {Array<string>} idSiswaList - Daftar ID Siswa
 * @returns {Object} { [idSiswa]: urlFoto }
 */
function getWajahBulk(idSiswaList) {
  try {
    if (!idSiswaList || !Array.isArray(idSiswaList) || idSiswaList.length === 0) {
      return successResponse("OK", {});
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.DATA_SISWA_WALI);
    if (!sheet) return successResponse("OK", {});

    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return successResponse("OK", {});

    const headers = values[0];
    const idCol = headers.indexOf(COLUMNS.DATA_SISWA_WALI.ID_SISWA);
    let wajahCol = headers.indexOf((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH) || "FOTO_WAJAH");
    if (wajahCol === -1) wajahCol = headers.indexOf("FOTO_WAJAH");
    if (wajahCol === -1) wajahCol = headers.indexOf("FOTO WAJAH");
    if (wajahCol === -1) wajahCol = headers.indexOf("fotoWajah");

    if (idCol === -1 || wajahCol === -1) return successResponse("OK", {});

    const targetSet = {};
    idSiswaList.forEach(function(id) {
      targetSet[String(id).trim()] = true;
    });

    const result = {};
    for (var i = 1; i < values.length; i++) {
      var sid = String(values[i][idCol] || "").trim();
      if (targetSet[sid]) {
        var foto = values[i][wajahCol] || "";
        result[sid] = foto;
      }
    }

    return successResponse("Data wajah berhasil dimuat", result);
  } catch (err) {
    return errorResponse("Gagal memuat wajah bulk: " + err.message);
  }
}

/**
 * Mengambil data lengkap seluruh biodata siswa untuk Rekap Guru Wali.
 * Guru Wali dan Guru Pembimbing dipisah secara ketat. Siswa yang tidak punya Guru Wali
 * tidak akan diisi nama Guru Pembimbing.
 * @param {string} idGuru - ID Guru atau "ALL"
 * @returns {Array<Object>} Daftar siswa lengkap beserta biodata
 */
function getDataSiswaWali(idGuru) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetSiswa = ss.getSheetByName(SHEETS.SISWA);
    if (!sheetSiswa) return [];

    const sheetBio = ss.getSheetByName(SHEETS.DATA_SISWA_WALI);
    const sheetGW = ss.getSheetByName(SHEETS.GURU_WALI);

    const siswaRows = sheetSiswa.getDataRange().getValues();
    if (siswaRows.length < 2) return [];
    const siswaHeaders = siswaRows[0];
    const sIdCol = siswaHeaders.indexOf(COLUMNS.SISWA.ID);
    const sNamaCol = siswaHeaders.indexOf(COLUMNS.SISWA.NAMA);
    const sGuruMagangCol = siswaHeaders.indexOf(COLUMNS.SISWA.NAMA_GURU); // Guru Pembimbing Magang
    const sMagangCol = siswaHeaders.indexOf(COLUMNS.SISWA.TEMPAT_MAGANG);

    // 1. Map relasi Guru Wali HANYA dan EKSKLUSIF dari sheet GURU_WALI
    // (JANGAN PERNAH menyatukan dengan Wali Kelas / SISWA_WALI_KELAS, karena Wali Kelas dan Guru Wali berbeda)
    const waliMap = {};
    if (sheetGW) {
      const gwRows = sheetGW.getDataRange().getValues();
      if (gwRows.length > 1) {
        const gwHeaders = gwRows[0];
        const gwSiswaCol = gwHeaders.indexOf(COLUMNS.GURU_WALI.ID_SISWA);
        const gwGuruCol = gwHeaders.indexOf(COLUMNS.GURU_WALI.ID_GURU);
        for (let i = 1; i < gwRows.length; i++) {
          let sid = String(gwRows[i][gwSiswaCol] || "").trim();
          if (sid.length > 2 && sid.slice(-2) === ".0") sid = sid.slice(0, -2);
          let gid = String(gwRows[i][gwGuruCol] || "").trim();
          if (gid.length > 2 && gid.slice(-2) === ".0") gid = gid.slice(0, -2);
          if (sid && gid) waliMap[sid] = gid;
        }
      }
    }

    // 2. Nama guru lookup dari ADMIN_GURU / GURU
    const guruNamaMap = {};
    const sheetGuru = ss.getSheetByName(SHEETS.ADMIN_GURU) || ss.getSheetByName(SHEETS.GURU);
    if (sheetGuru) {
      const gRows = sheetGuru.getDataRange().getValues();
      if (gRows.length > 1) {
        const gHeaders = gRows[0];
        const gIdCol = gHeaders.indexOf((COLUMNS.ADMIN_GURU && COLUMNS.ADMIN_GURU.ID) || "ID");
        const gNamaCol = gHeaders.indexOf((COLUMNS.ADMIN_GURU && COLUMNS.ADMIN_GURU.NAMA_GURU) || "NAMA_GURU") !== -1
          ? gHeaders.indexOf((COLUMNS.ADMIN_GURU && COLUMNS.ADMIN_GURU.NAMA_GURU) || "NAMA_GURU")
          : gHeaders.indexOf("NAMA");
        for (let i = 1; i < gRows.length; i++) {
          let gid = String(gRows[i][gIdCol] || "").trim();
          if (gid.length > 2 && gid.slice(-2) === ".0") gid = gid.slice(0, -2);
          const gnm = String(gRows[i][gNamaCol] || "").trim();
          if (gid) guruNamaMap[gid] = gnm;
        }
      }
    }

    // 4. Map biodata dari DATA_SISWA_WALI
    const bioMap = {};
    if (sheetBio) {
      const bioRows = sheetBio.getDataRange().getValues();
      if (bioRows.length > 1) {
        const bioHeaders = bioRows[0];
        const bIdCol = bioHeaders.indexOf(COLUMNS.DATA_SISWA_WALI.ID_SISWA);
        for (let i = 1; i < bioRows.length; i++) {
          const sid = String(bioRows[i][bIdCol] || "").trim();
          if (sid) {
            const row = bioRows[i];
            const getVal = function(colName) {
              if (!colName) return "";
              let idx = bioHeaders.indexOf(colName);
              if (idx === -1 && (colName === "FOTO_WAJAH" || colName === (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH))) {
                idx = bioHeaders.indexOf("FOTO_WAJAH");
                if (idx === -1) idx = bioHeaders.indexOf("FOTO WAJAH");
                if (idx === -1) idx = bioHeaders.indexOf("fotoWajah");
              }
              return idx !== -1 ? (row[idx] || "") : "";
            };

            const colWajahTarget = (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH) || "FOTO_WAJAH";

            const tglVal = getVal(COLUMNS.DATA_SISWA_WALI.TGL_LAHIR);
            const tglLahirFormatted = typeof formatTanggalWali === "function" ? formatTanggalWali(tglVal) : (tglVal instanceof Date ? Utilities.formatDate(tglVal, Session.getScriptTimeZone(), "yyyy-MM-dd") : String(tglVal || ""));

            const kAyah = getVal(COLUMNS.DATA_SISWA_WALI.KONTAK_AYAH);
            const kontakAyahFormatted = typeof formatKontakWali === "function" ? formatKontakWali(kAyah) : String(kAyah || "").replace(/^'/, "");

            const kIbu = getVal(COLUMNS.DATA_SISWA_WALI.KONTAK_IBU);
            const kontakIbuFormatted = typeof formatKontakWali === "function" ? formatKontakWali(kIbu) : String(kIbu || "").replace(/^'/, "");

            bioMap[sid] = {
              fotoProfil: getVal(COLUMNS.DATA_SISWA_WALI.FOTO_PROFIL),
              fotoWajah: getVal(colWajahTarget),
              noHp: getVal(COLUMNS.DATA_SISWA_WALI.NO_HP),
              tempatLahir: getVal(COLUMNS.DATA_SISWA_WALI.TEMPAT_LAHIR),
              tglLahir: tglLahirFormatted,
              ayah: getVal(COLUMNS.DATA_SISWA_WALI.AYAH),
              pekerjaanAyah: getVal(COLUMNS.DATA_SISWA_WALI.PEKERJAAN_AYAH),
              kontakAyah: kontakAyahFormatted,
              ibu: getVal(COLUMNS.DATA_SISWA_WALI.IBU),
              pekerjaanIbu: getVal(COLUMNS.DATA_SISWA_WALI.PEKERJAAN_IBU),
              kontakIbu: kontakIbuFormatted,
              anakKe: getVal(COLUMNS.DATA_SISWA_WALI.ANAK_KE),
              alamat: getVal(COLUMNS.DATA_SISWA_WALI.ALAMAT),
              hobi: getVal(COLUMNS.DATA_SISWA_WALI.HOBI),
              bakatKeahlian: getVal(COLUMNS.DATA_SISWA_WALI.BAKAT_KEAHLIAN),
              transportasi: getVal(COLUMNS.DATA_SISWA_WALI.TRANSPORTASI),
              pelajaranDisukai: getVal(COLUMNS.DATA_SISWA_WALI.PELAJARAN_DISUKAI),
              alasanDisukai: getVal(COLUMNS.DATA_SISWA_WALI.ALASAN_DISUKAI),
              pelajaranTidakDisukai: getVal(COLUMNS.DATA_SISWA_WALI.PELAJARAN_TIDAK_DISUKAI),
              alasanTidakDisukai: getVal(COLUMNS.DATA_SISWA_WALI.ALASAN_TIDAK_DISUKAI),
              harapan: getVal(COLUMNS.DATA_SISWA_WALI.HARAPAN_DI_SMKN1),
              ijazahSmp: getVal(COLUMNS.DATA_SISWA_WALI.IJAZAH_SMP),
              // TAMBAHAN KK & NILAI RAPOR
              kartuKeluarga: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.KARTU_KELUARGA) || "KARTU_KELUARGA") || getVal("KARTU_KELUARGA") || getVal("kartuKeluarga"),
              totalNilai1: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_1) || "TOTAL_NILAI_1") || getVal("TOTAL_NILAI_1") || getVal("totalNilai1"),
              mapel1: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_1) || "MAPEL_1") || getVal("MAPEL_1") || getVal("mapel1"),
              nilaiRapor1: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_1) || "NILAI_RAPOR_1") || getVal("NILAI_RAPOR_1") || getVal("nilaiRapor1"),
              totalNilai2: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_2) || "TOTAL_NILAI_2") || getVal("TOTAL_NILAI_2") || getVal("totalNilai2"),
              mapel2: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_2) || "MAPEL_2") || getVal("MAPEL_2") || getVal("mapel2"),
              nilaiRapor2: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_2) || "NILAI_RAPOR_2") || getVal("NILAI_RAPOR_2") || getVal("nilaiRapor2"),
              totalNilai3: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_3) || "TOTAL_NILAI_3") || getVal("TOTAL_NILAI_3") || getVal("totalNilai3"),
              mapel3: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_3) || "MAPEL_3") || getVal("MAPEL_3") || getVal("mapel3"),
              nilaiRapor3: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_3) || "NILAI_RAPOR_3") || getVal("NILAI_RAPOR_3") || getVal("nilaiRapor3"),
              totalNilai4: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.TOTAL_NILAI_4) || "TOTAL_NILAI_4") || getVal("TOTAL_NILAI_4") || getVal("totalNilai4"),
              mapel4: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.MAPEL_4) || "MAPEL_4") || getVal("MAPEL_4") || getVal("mapel4"),
              nilaiRapor4: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_4) || "NILAI_RAPOR_4") || getVal("NILAI_RAPOR_4") || getVal("nilaiRapor4"),
              nilaiRaporRata: getVal((COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.NILAI_RAPOR_RATA) || "NILAI_RAPOR_RATA") || getVal("NILAI_RAPOR_RATA") || getVal("nilaiRaporRata"),
            };
          }
        }
      }
    }

    const hasil = [];
    for (let i = 1; i < siswaRows.length; i++) {
      const row = siswaRows[i];
      let sid = String(row[sIdCol] || "").trim();
      if (sid.length > 2 && sid.slice(-2) === ".0") sid = sid.slice(0, -2);
      if (!sid) continue;

      const guruWaliId = waliMap[sid] || "";
      // Filter jika idGuru ditentukan dan bukan "ALL"
      let cleanFilterGuru = idGuru ? String(idGuru).trim() : "";
      if (cleanFilterGuru.length > 2 && cleanFilterGuru.slice(-2) === ".0") cleanFilterGuru = cleanFilterGuru.slice(0, -2);

      if (cleanFilterGuru && cleanFilterGuru !== "ALL" && guruWaliId !== cleanFilterGuru) {
        continue;
      }

      // HANYA ambil nama Guru Wali jika siswa memang punya relasi di sheet GURU_WALI
      // JIKA TIDAK PUNYA GURU WALI, BIARKAN KOSONG "" (JANGAN gunakan Guru Pembimbing Magang!)
      const namaGuruWali = guruWaliId ? (guruNamaMap[guruWaliId] || guruWaliId) : "";

      const bio = bioMap[sid] || {};

      const item = {
        idSiswa: sid,
        nama: row[sNamaCol] || "",
        idGuru: guruWaliId, // ID Guru Wali dari sheet GURU_WALI
        namaGuru: namaGuruWali, // HANYA Guru Wali (KOSONG jika belum ada Guru Wali)
        guruPembimbing: (sGuruMagangCol !== -1 && row[sGuruMagangCol]) ? String(row[sGuruMagangCol]).trim() : "",
        tempatMagang: (sMagangCol !== -1 && row[sMagangCol]) ? String(row[sMagangCol]).trim() : "",
      };

      Object.keys(bio).forEach(function(k) {
        item[k] = bio[k];
      });

      hasil.push(item);
    }

    return hasil;
  } catch (err) {
    Logger.log("Error in getDataSiswaWali: " + err.message);
    return [];
  }
}


