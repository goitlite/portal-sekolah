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
    // Fallback pencarian fleksibel untuk kolom FOTO_WAJAH
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

    // DATA BIODATA BARU
    fotoProfil: value(COLUMNS.DATA_SISWA_WALI.FOTO_PROFIL) || "",
    fotoWajah: value(colWajahTarget) || "", // ---> DITAMBAHKAN AGAR WAJAH DAPAT DIBACA DARI SPREADSHEET
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

  // Otomatis tambahkan header FOTO_WAJAH jika belum ada di sheet DATA_SISWA_WALI
  const colWajahTarget = (COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.FOTO_WAJAH) || "FOTO_WAJAH";
  if (headers.indexOf(colWajahTarget) === -1 && headers.indexOf("FOTO WAJAH") === -1 && headers.indexOf("fotoWajah") === -1) {
    sheet.getRange(1, headers.length + 1).setValue("FOTO_WAJAH");
    headers.push("FOTO_WAJAH");
  }

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
    fotoWajah: colWajah, // ---> DITAMBAHKAN AGAR FOTO WAJAH TERSIMPAN KE SPREADSHEET
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

