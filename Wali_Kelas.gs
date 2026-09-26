// ============================================================
// Wali_Kelas.gs
// Fitur Guru Wali Kelas — menggunakan spreadsheet MAPEL_DATA_SMKN1TK
// Pola mengikuti Mapel.gs
// ============================================================

// ------------------------------------------------------------
// KONSTANTA
// ------------------------------------------------------------

const WALI_SHEETS = {
  WALI_KELAS: "WALI_KELAS",
  SISWA_WALI_KELAS: "SISWA_WALI_KELAS",
  PRESENSI_WALI_KELAS: "PRESENSI_WALI_KELAS",
  JURNAL_WALI_KELAS: "JURNAL_WALI_KELAS",
};

const WALI_COLUMNS = {
  WALI_KELAS: {
    ID_WALI: "ID_WALI",
    ID_GURU: "ID_GURU",
    NAMA_KELAS: "NAMA_KELAS",
    KETERANGAN: "KETERANGAN",
    CREATED_AT: "CREATED_AT",
  },
  SISWA_WALI_KELAS: {
    ID_GURU: "ID_GURU",
    ID_WALI: "ID_WALI",
    ID_SISWA: "ID_SISWA",
    CREATED_AT: "CREATED_AT",
  },
  PRESENSI_WALI_KELAS: {
    ID_PRESENSI: "ID_PRESENSI",
    ID_GURU: "ID_GURU",
    ID_WALI: "ID_WALI",
    ID_SISWA: "ID_SISWA",
    NAMA_SISWA: "NAMA_SISWA",
    TANGGAL: "TANGGAL",
    STATUS: "STATUS",
    KETERANGAN: "KETERANGAN",
    CREATED_AT: "CREATED_AT",
  },
  JURNAL_WALI_KELAS: {
    ID_JURNAL: "ID_JURNAL",
    ID_GURU: "ID_GURU",
    ID_WALI: "ID_WALI",
    ID_SISWA: "ID_SISWA",
    NAMA_SISWA: "NAMA_SISWA",
    KELAS: "KELAS",
    TANGGAL: "TANGGAL",
    FORMAT_PERTEMUAN: "FORMAT_PERTEMUAN",
    TOPIK: "TOPIK",
    TINDAK_LANJUT: "TINDAK_LANJUT",
    KETERANGAN: "KETERANGAN",
    FOTO_URL: "FOTO_URL",
    FOTO_ID: "FOTO_ID",
    CREATED_AT: "CREATED_AT",
  },
};

// ------------------------------------------------------------
// SETUP
// ------------------------------------------------------------

/**
 * Tambahkan 4 sheet baru ke spreadsheet MAPEL_DATA_SMKN1TK yang sudah ada.
 * Jalankan sekali dari Apps Script Editor.
 */
function setupWaliKelasSheet() {
  const ss = getMapelSS_();

  const sheetDefs = [
    {
      name: WALI_SHEETS.WALI_KELAS,
      headers: Object.values(WALI_COLUMNS.WALI_KELAS),
    },
    {
      name: WALI_SHEETS.SISWA_WALI_KELAS,
      headers: Object.values(WALI_COLUMNS.SISWA_WALI_KELAS),
    },
    {
      name: WALI_SHEETS.PRESENSI_WALI_KELAS,
      headers: Object.values(WALI_COLUMNS.PRESENSI_WALI_KELAS),
    },
    {
      name: WALI_SHEETS.JURNAL_WALI_KELAS,
      headers: Object.values(WALI_COLUMNS.JURNAL_WALI_KELAS),
    },
  ];

  sheetDefs.forEach(({ name, headers }) => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      Logger.log("Sheet dibuat: " + name);
    } else {
      Logger.log("Sheet sudah ada, dilewati: " + name);
    }
  });

  Logger.log("setupWaliKelasSheet selesai.");
}

/**
 * Jalankan SEKALI dari Apps Script Editor untuk membersihkan baris duplikat
 * di SISWA_WALI_KELAS (siswa yang masuk lebih dari 1 kali di kelas wali yang sama).
 * Hanya menyimpan baris pertama per kombinasi ID_WALI + ID_SISWA.
 */
function bersihkanDuplicateSiswaWali() {
  const sheet = getWaliSheet_(WALI_SHEETS.SISWA_WALI_KELAS);
  const headers = getWaliHeaders_(WALI_SHEETS.SISWA_WALI_KELAS);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("Sheet kosong, tidak ada yang dibersihkan.");
    return;
  }

  const colIdWali = headers.indexOf(WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI);
  const colIdSiswa = headers.indexOf(WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA);
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  const seen = new Set();
  let hapus = 0;

  // Hapus dari bawah agar index tidak geser
  for (let i = rows.length - 1; i >= 0; i--) {
    const key = String(rows[i][colIdWali]) + "|" + String(rows[i][colIdSiswa]);
    if (seen.has(key)) {
      sheet.deleteRow(i + 2);
      hapus++;
    } else {
      seen.add(key);
    }
  }

  Logger.log("Selesai. Baris duplikat dihapus: " + hapus);
}

// ------------------------------------------------------------
// HELPER INTERNAL
// ------------------------------------------------------------

function getWaliSheet_(nama) {
  const ss = getMapelSS_();
  const sheet = ss.getSheetByName(nama);
  if (!sheet) throw new Error("Sheet tidak ditemukan: " + nama);
  return sheet;
}

function getWaliHeaders_(nama) {
  const sheet = getWaliSheet_(nama);
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function getAllDataWali_(nama) {
  const sheet = getWaliSheet_(nama);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const headers = getWaliHeaders_(nama);
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return rows.map((row) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function findAllDataWaliByColumn_(nama, kolom, nilai) {
  return getAllDataWali_(nama).filter(
    (row) => String(row[kolom]) === String(nilai),
  );
}

function appendRowWali_(nama, obj) {
  const sheet = getWaliSheet_(nama);
  const headers = getWaliHeaders_(nama);
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ""));
  sheet.appendRow(row);
}

/**
 * Parsing data siswa dari sheet SISWA utama sekolah.
 * Menangani kolom ID/id/ID_SISWA dan NAMA/nama yang mengandung "[KELAS]" (misal: "BUDI [XII TKJ 1]")
 */
function _parseSiswaInfo_(siswa) {
  if (!siswa) return { idSiswa: "", nama: "", kelas: "", rawName: "" };

  const idSiswa = String(
    siswa.ID || siswa.id || siswa.ID_SISWA || siswa.idSiswa || "",
  ).trim();

  const rawName = String(
    siswa.NAMA || siswa.nama || siswa.NAMA_SISWA || siswa.namaSiswa || "",
  ).trim();

  let nama = rawName;
  let kelas = String(siswa.KELAS || siswa.kelas || "").trim();

  // Pola nama sekolah: "BUDI SANTOSO [XII TKJ 1]"
  const match = rawName.match(/(.+?)\s*\[(.*?)\]/);
  if (match) {
    nama = match[1].trim();
    if (!kelas) {
      kelas = match[2].trim();
    }
  }

  return {
    idSiswa: idSiswa,
    nama: nama,
    kelas: kelas,
    rawName: rawName,
  };
}

/**
 * Normalisasi nama kelas: uppercase, TJKT→TKJ, TKRO→TKR, hapus non-alfanumerik.
 */
function _cleanClass_(str) {
  if (!str) return "";
  return String(str)
    .toUpperCase()
    .replace(/TJKT/g, "TKJ")
    .replace(/TKRO/g, "TKR")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Ekstrak { level, body } dari string kelas yang sudah di-clean.
 * Contoh: "XIITKJ1" → { level: "XII", body: "TKJ1" }
 *         "XITKJ1"  → { level: "XI",  body: "TKJ1" }
 *         "XTKJ1"   → { level: "X",   body: "TKJ1" }
 */
function _extractLevel_(cleanStr) {
  const m = cleanStr.match(/^(XII|XI|X)(.*)$/);
  if (m) return { level: m[1], body: m[2] };
  return { level: "", body: cleanStr };
}

/**
 * Pencocokan kelas siswa dengan kelas target.
 * Strategi:
 *  1. Exact / substring match pada string LENGKAP (termasuk level).
 *  2. Fallback short-class (tanpa level) — HANYA diizinkan bila level-nya SAMA.
 * Dengan demikian siswa "XI TJKT 1" TIDAK akan cocok dengan target "XII TJKT 1".
 */
function _matchKelas_(studentClass, studentRawName, targetClass) {
  const targetClean = _cleanClass_(targetClass);
  if (!targetClean) return false;

  const sClassClean = _cleanClass_(studentClass);
  const rawClean = _cleanClass_(studentRawName);

  // --- Langkah 1: exact / substring match pada string LENGKAP (level ikut dicek) ---
  if (sClassClean && sClassClean === targetClean) return true;
  if (sClassClean && sClassClean.includes(targetClean)) return true;
  if (sClassClean && targetClean.includes(sClassClean)) return true;
  if (rawClean && rawClean.includes(targetClean)) return true;

  // --- Langkah 2: fallback short-class — wajib level sama ---
  const targetParts = _extractLevel_(targetClean);
  const targetLevel = targetParts.level; // "XII" / "XI" / "X" / ""
  const targetBody = targetParts.body; // "TKJ1", dll.

  if (!targetBody) return false;

  // Ekstrak level dari data siswa
  const sParts = _extractLevel_(sClassClean);
  const rawParts = _extractLevel_(rawClean);
  const sLevel = sParts.level || rawParts.level || "";
  const sBody = sParts.body || rawParts.body || sClassClean || rawClean;

  // Jika KEDUA sisi memiliki level yang diketahui → level HARUS sama
  if (targetLevel && sLevel && targetLevel !== sLevel) {
    return false; // level berbeda, tolak (misal XII vs XI)
  }

  // Level cocok atau salah satu tidak diketahui → bandingkan body
  if (
    sBody &&
    (sBody === targetBody ||
      sBody.includes(targetBody) ||
      targetBody.includes(sBody))
  ) {
    return true;
  }
  if (rawClean && rawClean.includes(targetBody)) {
    return true;
  }

  return false;
}

// ------------------------------------------------------------
// WALI KELAS CRUD
// ------------------------------------------------------------

/**
 * Ambil semua kelas wali milik guru tertentu.
 * Action: getWaliKelasByGuru
 */
function getWaliKelasByGuru(idGuru) {
  try {
    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    const rawData = findAllDataWaliByColumn_(
      WALI_SHEETS.WALI_KELAS,
      WALI_COLUMNS.WALI_KELAS.ID_GURU,
      idGuru,
    );
    const data = rawData.map(function (r) {
      return {
        idWali: String(r.ID_WALI || r.idWali || ""),
        idGuru: String(r.ID_GURU || r.idGuru || ""),
        namaKelas: String(r.NAMA_KELAS || r.namaKelas || ""),
        kelas: String(r.NAMA_KELAS || r.namaKelas || r.kelas || ""),
        keterangan: String(r.KETERANGAN || r.keterangan || ""),
        createdAt: r.CREATED_AT || r.createdAt || "",
        ID_WALI: String(r.ID_WALI || r.idWali || ""),
        ID_GURU: String(r.ID_GURU || r.idGuru || ""),
        NAMA_KELAS: String(r.NAMA_KELAS || r.namaKelas || ""),
        KETERANGAN: String(r.KETERANGAN || r.keterangan || ""),
        CREATED_AT: r.CREATED_AT || r.createdAt || "",
      };
    });
    return successResponse("Data kelas wali ditemukan", data);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Tambah kelas wali baru.
 * Auto-enroll siswa sekelas yang belum punya guru wali kelas.
 * Action: addWaliKelas
 */
function addWaliKelas(params) {
  try {
    const idGuru = params.idGuru || params.ID_GURU;
    const namaKelas = params.namaKelas || params.NAMA_KELAS;
    const kelasTarget = params.kelas || namaKelas;
    const keterangan = params.keterangan || params.KETERANGAN || "";

    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(namaKelas)) return errorResponse("namaKelas wajib diisi.");

    const idWali = generateRandomId();
    const now = new Date().toISOString();

    appendRowWali_(WALI_SHEETS.WALI_KELAS, {
      [WALI_COLUMNS.WALI_KELAS.ID_WALI]: idWali,
      [WALI_COLUMNS.WALI_KELAS.ID_GURU]: idGuru,
      [WALI_COLUMNS.WALI_KELAS.NAMA_KELAS]: namaKelas,
      [WALI_COLUMNS.WALI_KELAS.KETERANGAN]: keterangan,
      [WALI_COLUMNS.WALI_KELAS.CREATED_AT]: now,
    });

    // Auto-enroll siswa sekelas yang belum punya guru wali kelas
    const hasil = _autoEnrollSiswaKelas_(idGuru, idWali, kelasTarget, now);

    return successResponse("Kelas wali berhasil ditambahkan", {
      idWali: idWali,
      namaKelas: namaKelas,
      jumlahSiswaOtomatis: hasil.ditambahkan,
      autoEnroll: hasil,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Edit nama kelas dan/atau keterangan.
 * Action: editWaliKelas
 */
function editWaliKelas(params) {
  try {
    const idGuru = params.idGuru || params.ID_GURU;
    const idWali = params.idWali || params.ID_WALI;
    const namaKelas = params.namaKelas || params.NAMA_KELAS;
    const keterangan =
      params.keterangan !== undefined ? params.keterangan : params.KETERANGAN;

    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");

    const sheet = getWaliSheet_(WALI_SHEETS.WALI_KELAS);
    const headers = getWaliHeaders_(WALI_SHEETS.WALI_KELAS);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return errorResponse("Data kelas wali tidak ditemukan.");

    const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    const colIdWali = headers.indexOf(WALI_COLUMNS.WALI_KELAS.ID_WALI);
    const colIdGuru = headers.indexOf(WALI_COLUMNS.WALI_KELAS.ID_GURU);
    const colNamaKelas = headers.indexOf(WALI_COLUMNS.WALI_KELAS.NAMA_KELAS);
    const colKeterangan = headers.indexOf(WALI_COLUMNS.WALI_KELAS.KETERANGAN);

    let found = false;
    for (let i = 0; i < rows.length; i++) {
      const matchWali = String(rows[i][colIdWali]) === String(idWali);
      const matchGuru =
        isEmpty(idGuru) || String(rows[i][colIdGuru]) === String(idGuru);

      if (matchWali && matchGuru) {
        const rowNum = i + 2;
        if (!isEmpty(namaKelas)) {
          sheet.getRange(rowNum, colNamaKelas + 1).setValue(namaKelas);
        }
        if (keterangan !== undefined) {
          sheet.getRange(rowNum, colKeterangan + 1).setValue(keterangan);
        }
        found = true;
        break;
      }
    }

    if (!found) return errorResponse("Kelas wali tidak ditemukan.");
    return successResponse("Kelas wali berhasil diupdate", {
      idWali,
      updated: true,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Hapus kelas wali + cascade delete SISWA, PRESENSI, JURNAL.
 * Action: deleteWaliKelas
 */
function deleteWaliKelas(params) {
  try {
    const idWali = params ? params.idWali || params.ID_WALI : "";
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");

    const deleted = _deleteRowsByColumn_(
      WALI_SHEETS.WALI_KELAS,
      WALI_COLUMNS.WALI_KELAS.ID_WALI,
      idWali,
    );
    if (!deleted) return errorResponse("Kelas wali tidak ditemukan.");

    // Cascade delete
    _deleteRowsByColumn_(
      WALI_SHEETS.SISWA_WALI_KELAS,
      WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI,
      idWali,
    );
    _deleteRowsByColumn_(
      WALI_SHEETS.PRESENSI_WALI_KELAS,
      WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_WALI,
      idWali,
    );
    _deleteRowsByColumn_(
      WALI_SHEETS.JURNAL_WALI_KELAS,
      WALI_COLUMNS.JURNAL_WALI_KELAS.ID_WALI,
      idWali,
    );

    return successResponse("Kelas wali berhasil dihapus", {
      idWali: idWali,
      deleted: true,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ------------------------------------------------------------
// SISWA WALI KELAS
// ------------------------------------------------------------

/**
 * Ambil daftar siswa dalam kelas wali beserta nama dan kelas.
 * Action: getSiswaWaliKelas
 */
function getSiswaWaliKelas(idGuru, idWali) {
  try {
    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");

    const anggota = getAllDataWali_(WALI_SHEETS.SISWA_WALI_KELAS).filter(
      (row) =>
        String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_GURU]) === String(idGuru) &&
        String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI]) === String(idWali),
    );

    // Deduplikasi: jika ada idSiswa yang muncul lebih dari sekali, ambil yang pertama saja
    const seenSiswa = new Set();
    const anggotaUniq = anggota.filter((row) => {
      const sid = String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA]);
      if (seenSiswa.has(sid)) return false;
      seenSiswa.add(sid);
      return true;
    });

    const result = anggotaUniq.map((row) => {
      const sid = String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA]);
      const siswa = getSiswaById(sid);
      const info = _parseSiswaInfo_(siswa);
      return {
        idSiswa: sid,
        namaSiswa: info.nama || sid,
        nama: info.nama || sid,
        kelas: info.kelas || "",
        createdAt: row[WALI_COLUMNS.SISWA_WALI_KELAS.CREATED_AT],
      };
    });

    return successResponse("Data siswa wali kelas ditemukan", result);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Tambah siswa ke kelas wali.
 * Constraint eksklusif: 1 siswa hanya boleh punya 1 guru wali kelas.
 * Action: simpanSiswaWaliKelas
 */
function simpanSiswaWaliKelas(params) {
  try {
    const idGuru = params ? params.idGuru || params.ID_GURU : "";
    const idWali = params ? params.idWali || params.ID_WALI : "";
    const idSiswa = params ? params.idSiswa || params.ID_SISWA : "";

    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");
    if (isEmpty(idSiswa)) return errorResponse("idSiswa wajib diisi.");

    // Cek constraint eksklusif: apakah siswa sudah punya guru wali kelas lain?
    const existing = getAllDataWali_(WALI_SHEETS.SISWA_WALI_KELAS).find(
      (row) =>
        String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA]) === String(idSiswa),
    );

    if (existing) {
      if (
        String(existing[WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI]) ===
        String(idWali)
      ) {
        return errorResponse("Siswa sudah terdaftar di kelas wali ini.");
      }
      return errorResponse(
        "Siswa sudah memiliki guru wali kelas lain (ID Wali: " +
          existing[WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI] +
          ").",
      );
    }

    const now = new Date().toISOString();
    appendRowWali_(WALI_SHEETS.SISWA_WALI_KELAS, {
      [WALI_COLUMNS.SISWA_WALI_KELAS.ID_GURU]: idGuru,
      [WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI]: idWali,
      [WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA]: idSiswa,
      [WALI_COLUMNS.SISWA_WALI_KELAS.CREATED_AT]: now,
    });

    return successResponse("Siswa berhasil ditambahkan", {
      idSiswa: idSiswa,
      ditambahkan: true,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Hapus siswa dari kelas wali + cascade presensi + jurnal.
 * Action: hapusSiswaWaliKelas
 */
function hapusSiswaWaliKelas(params) {
  try {
    const idWali = params ? params.idWali || params.ID_WALI : "";
    const idSiswa = params ? params.idSiswa || params.ID_SISWA : "";

    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");
    if (isEmpty(idSiswa)) return errorResponse("idSiswa wajib diisi.");

    _deleteRowsByTwoColumns_(
      WALI_SHEETS.SISWA_WALI_KELAS,
      WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI,
      idWali,
      WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA,
      idSiswa,
    );

    _deleteRowsByTwoColumns_(
      WALI_SHEETS.PRESENSI_WALI_KELAS,
      WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_WALI,
      idWali,
      WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_SISWA,
      idSiswa,
    );

    _deleteRowsByTwoColumns_(
      WALI_SHEETS.JURNAL_WALI_KELAS,
      WALI_COLUMNS.JURNAL_WALI_KELAS.ID_WALI,
      idWali,
      WALI_COLUMNS.JURNAL_WALI_KELAS.ID_SISWA,
      idSiswa,
    );

    return successResponse("Siswa berhasil dihapus", {
      idSiswa: idSiswa,
      dihapus: true,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Ambil semua siswa untuk modal tambah.
 * Menggunakan _parseSiswaInfo_ agar nama & kelas terbaca dengan baik.
 * Action: getSemuaSiswaUntukTambahWali
 */
function getSemuaSiswaUntukTambahWali(idGuru, idWali) {
  try {
    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");

    const semuaSiswa = getSiswa();
    const siswaWali = getAllDataWali_(WALI_SHEETS.SISWA_WALI_KELAS);
    const waliKelas = getAllDataWali_(WALI_SHEETS.WALI_KELAS);

    // Map idSiswa -> data wali
    const siswaWaliMap = {};
    siswaWali.forEach((row) => {
      siswaWaliMap[String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA])] = row;
    });

    // Map idWali -> data kelas wali
    const waliMap = {};
    waliKelas.forEach((row) => {
      waliMap[String(row[WALI_COLUMNS.WALI_KELAS.ID_WALI])] = row;
    });

    const result = semuaSiswa
      .map((s) => {
        const info = _parseSiswaInfo_(s);
        const idSiswaStr = info.idSiswa;
        if (!idSiswaStr) return null;

        const existing = siswaWaliMap[idSiswaStr];
        // Sudah ada di kelas wali ini sendiri → skip
        if (
          existing &&
          String(existing[WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI]) ===
            String(idWali)
        ) {
          return null;
        }

        let namaGuruWaliKelas = "";
        if (existing) {
          const waliData =
            waliMap[String(existing[WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI])];
          if (waliData) {
            const guru = getGuruById(waliData[WALI_COLUMNS.WALI_KELAS.ID_GURU]);
            namaGuruWaliKelas = guru ? guru.NAMA_GURU || guru.nama || "" : "";
          }
        }

        return {
          idSiswa: idSiswaStr,
          nama: info.nama || idSiswaStr,
          namaSiswa: info.nama || idSiswaStr,
          kelas: info.kelas || "Tanpa Kelas",
          sudahPunyaWali: !!existing,
          namaGuruWaliKelas: namaGuruWaliKelas,
        };
      })
      .filter(Boolean);

    return successResponse("Data siswa untuk tambah wali ditemukan", result);
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Sinkron semua siswa sekelas ke kelas wali ini.
 * Action: sinkronSiswaWaliKelas
 */
function sinkronSiswaWaliKelas(params) {
  try {
    const idGuru = params ? params.idGuru || params.ID_GURU : "";
    const idWali = params ? params.idWali || params.ID_WALI : "";
    const kelas = params
      ? params.kelas || params.namaKelas || params.KELAS || params.NAMA_KELAS
      : "";

    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");
    if (isEmpty(kelas)) return errorResponse("kelas wajib diisi.");

    const now = new Date().toISOString();
    const hasil = _autoEnrollSiswaKelas_(idGuru, idWali, kelas, now);
    return successResponse("Sinkron siswa berhasil", hasil);
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ------------------------------------------------------------
// PRESENSI WALI KELAS
// ------------------------------------------------------------

/**
 * Ambil grid presensi kelas wali.
 * Action: getPresensiWaliGrid
 */
function getPresensiWaliGrid(idGuru, idWali) {
  try {
    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");

    const anggota = getAllDataWali_(WALI_SHEETS.SISWA_WALI_KELAS).filter(
      (row) =>
        String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_GURU]) === String(idGuru) &&
        String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI]) === String(idWali),
    );

    const siswaList = anggota.map((row) => {
      const sid = String(row[WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA]);
      const siswa = getSiswaById(sid);
      const info = _parseSiswaInfo_(siswa);
      return {
        idSiswa: sid,
        namaSiswa: info.nama || sid,
        nama: info.nama || sid,
        kelas: info.kelas || "",
      };
    });

    const presensiRaw = getAllDataWali_(WALI_SHEETS.PRESENSI_WALI_KELAS).filter(
      (row) =>
        String(row[WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_WALI]) ===
        String(idWali),
    );

    const presensi = presensiRaw.map((row) => {
      const tanggal = row[WALI_COLUMNS.PRESENSI_WALI_KELAS.TANGGAL];
      return {
        idSiswa: String(row[WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_SISWA]),
        tanggal:
          tanggal instanceof Date
            ? Utilities.formatDate(
                tanggal,
                Session.getScriptTimeZone(),
                "yyyy-MM-dd",
              )
            : String(tanggal),
        status: row[WALI_COLUMNS.PRESENSI_WALI_KELAS.STATUS],
        keterangan: row[WALI_COLUMNS.PRESENSI_WALI_KELAS.KETERANGAN],
      };
    });

    return successResponse("Data presensi wali kelas ditemukan", {
      siswa: siswaList,
      presensi: presensi,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Simpan (upsert) presensi kelas wali.
 * Key unik: idWali + idSiswa + tanggal.
 * Action: savePresensiWaliKelas
 */
function savePresensiWaliKelas(params) {
  try {
    const idGuru = params.idGuru || params.ID_GURU;
    const idWali = params.idWali || params.ID_WALI;
    const cells = params.cells;

    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");
    if (!Array.isArray(cells) || cells.length === 0)
      return errorResponse("cells wajib diisi.");

    const sheet = getWaliSheet_(WALI_SHEETS.PRESENSI_WALI_KELAS);
    const headers = getWaliHeaders_(WALI_SHEETS.PRESENSI_WALI_KELAS);
    const lastRow = sheet.getLastRow();
    const now = new Date().toISOString();

    let existingRows = [];
    if (lastRow > 1) {
      existingRows = sheet
        .getRange(2, 1, lastRow - 1, headers.length)
        .getValues();
    }

    const colIdWali = headers.indexOf(WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_WALI);
    const colIdSiswa = headers.indexOf(
      WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_SISWA,
    );
    const colTanggal = headers.indexOf(
      WALI_COLUMNS.PRESENSI_WALI_KELAS.TANGGAL,
    );
    const colStatus = headers.indexOf(WALI_COLUMNS.PRESENSI_WALI_KELAS.STATUS);
    const colKeterangan = headers.indexOf(
      WALI_COLUMNS.PRESENSI_WALI_KELAS.KETERANGAN,
    );

    cells.forEach((cell) => {
      const { idSiswa, namaSiswa, tanggal, status, keterangan } = cell;

      let foundRowNum = -1;
      for (let i = 0; i < existingRows.length; i++) {
        const r = existingRows[i];
        const tExisting =
          r[colTanggal] instanceof Date
            ? Utilities.formatDate(
                r[colTanggal],
                Session.getScriptTimeZone(),
                "yyyy-MM-dd",
              )
            : String(r[colTanggal]);
        if (
          String(r[colIdWali]) === String(idWali) &&
          String(r[colIdSiswa]) === String(idSiswa) &&
          tExisting === String(tanggal)
        ) {
          foundRowNum = i + 2;
          break;
        }
      }

      if (foundRowNum > 0) {
        sheet.getRange(foundRowNum, colStatus + 1).setValue(status || "");
        sheet
          .getRange(foundRowNum, colKeterangan + 1)
          .setValue(keterangan || "");
      } else {
        const idPresensi = generateRandomId();
        appendRowWali_(WALI_SHEETS.PRESENSI_WALI_KELAS, {
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_PRESENSI]: idPresensi,
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_GURU]: idGuru,
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_WALI]: idWali,
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.ID_SISWA]: idSiswa,
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.NAMA_SISWA]: namaSiswa || "",
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.TANGGAL]: tanggal,
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.STATUS]: status || "",
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.KETERANGAN]: keterangan || "",
          [WALI_COLUMNS.PRESENSI_WALI_KELAS.CREATED_AT]: now,
        });
      }
    });

    // Invalidate cache Kepsek agar data kehadiran langsung terupdate
    try {
      const cache = CacheService.getScriptCache();
      cache.remove("KEPSEK_V2_WALIKELAS_DATA_V3");
      cache.remove("KEPSEK_V2_WALIKELAS_DATA_V2");
      cache.remove("WALIKELAS_DATA_V3");
    } catch (_) {}

    return successResponse("Presensi wali kelas berhasil disimpan", {
      tersimpan: cells.length,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ------------------------------------------------------------
// JURNAL WALI KELAS
// ------------------------------------------------------------

/**
 * Simpan jurnal bimbingan wali kelas.
 * Support format kelompok dan individu.
 * Action: saveJurnalWaliKelas
 */
function saveJurnalWaliKelas(params) {
  try {
    const idGuru = params.idGuru || params.ID_GURU;
    const idWali = params.idWali || params.ID_WALI;
    const tanggal = params.tanggal || params.TANGGAL;
    const formatPertemuan =
      params.formatPertemuan || params.FORMAT_PERTEMUAN || "";
    const topik = params.topik || params.TOPIK || "";
    const tindakLanjut = params.tindakLanjut || params.TINDAK_LANJUT || "";
    const keterangan = params.keterangan || params.KETERANGAN || "";
    const fotoBase64 = params.fotoBase64;
    const fotoMime = params.fotoMime;
    const fotoUrlParam = params.fotoUrl || params.FOTO_URL || "";
    const siswaList = params.siswaList;
    const idSiswaList = params.idSiswaList;
    const idSiswa = params.idSiswa || params.ID_SISWA;
    const namaSiswa = params.namaSiswa || params.NAMA_SISWA;
    const kelas = params.kelas || params.KELAS;

    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");
    if (isEmpty(idWali)) return errorResponse("idWali wajib diisi.");
    if (isEmpty(tanggal)) return errorResponse("tanggal wajib diisi.");

    // Upload foto jika ada base64
    let fotoUrl = fotoUrlParam;
    let fotoId = "";
    if (!isEmpty(fotoBase64) && !isEmpty(fotoMime)) {
      const fotoResult = prosesFotoMapel_(fotoBase64, fotoMime);
      fotoUrl = fotoResult.url || "";
      fotoId = fotoResult.id || "";
    }

    const now = new Date().toISOString();

    // Mode kelompok via siswaList
    if (Array.isArray(siswaList) && siswaList.length > 0) {
      siswaList.forEach((s) => {
        const idJurnal = generateRandomId();
        appendRowWali_(WALI_SHEETS.JURNAL_WALI_KELAS, {
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_JURNAL]: idJurnal,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_GURU]: idGuru,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_WALI]: idWali,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_SISWA]: s.idSiswa || "",
          [WALI_COLUMNS.JURNAL_WALI_KELAS.NAMA_SISWA]:
            s.namaSiswa || s.nama || "",
          [WALI_COLUMNS.JURNAL_WALI_KELAS.KELAS]: s.kelas || "",
          [WALI_COLUMNS.JURNAL_WALI_KELAS.TANGGAL]: tanggal,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.FORMAT_PERTEMUAN]:
            formatPertemuan || "Kelompok",
          [WALI_COLUMNS.JURNAL_WALI_KELAS.TOPIK]: topik,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.TINDAK_LANJUT]: tindakLanjut,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.KETERANGAN]: keterangan,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_URL]: fotoUrl,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_ID]: fotoId,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.CREATED_AT]: now,
        });
      });
      return successResponse("Jurnal kelompok berhasil disimpan", {
        tersimpan: siswaList.length,
        mode: "kelompok",
      });
    }

    // Mode kelompok via idSiswaList
    if (Array.isArray(idSiswaList) && idSiswaList.length > 0) {
      idSiswaList.forEach((sid) => {
        const siswaData = getSiswaById(sid);
        const info = _parseSiswaInfo_(siswaData);
        const idJurnal = generateRandomId();
        appendRowWali_(WALI_SHEETS.JURNAL_WALI_KELAS, {
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_JURNAL]: idJurnal,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_GURU]: idGuru,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_WALI]: idWali,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_SISWA]: sid,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.NAMA_SISWA]: info.nama || sid,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.KELAS]: info.kelas || "",
          [WALI_COLUMNS.JURNAL_WALI_KELAS.TANGGAL]: tanggal,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.FORMAT_PERTEMUAN]:
            formatPertemuan || "Kelompok",
          [WALI_COLUMNS.JURNAL_WALI_KELAS.TOPIK]: topik,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.TINDAK_LANJUT]: tindakLanjut,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.KETERANGAN]: keterangan,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_URL]: fotoUrl,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_ID]: fotoId,
          [WALI_COLUMNS.JURNAL_WALI_KELAS.CREATED_AT]: now,
        });
      });
      return successResponse("Jurnal kelompok berhasil disimpan", {
        tersimpan: idSiswaList.length,
        mode: "kelompok",
      });
    }

    // Mode individu
    if (isEmpty(idSiswa))
      return errorResponse("idSiswa wajib diisi untuk format individu.");

    let namaSiswaFinal = namaSiswa || "";
    let kelasFinal = kelas || "";
    if (!namaSiswaFinal || !kelasFinal) {
      const siswaData = getSiswaById(idSiswa);
      const info = _parseSiswaInfo_(siswaData);
      namaSiswaFinal = namaSiswaFinal || info.nama || "";
      kelasFinal = kelasFinal || info.kelas || "";
    }

    const idJurnal = generateRandomId();
    appendRowWali_(WALI_SHEETS.JURNAL_WALI_KELAS, {
      [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_JURNAL]: idJurnal,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_GURU]: idGuru,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_WALI]: idWali,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.ID_SISWA]: idSiswa,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.NAMA_SISWA]: namaSiswaFinal,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.KELAS]: kelasFinal,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.TANGGAL]: tanggal,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.FORMAT_PERTEMUAN]:
        formatPertemuan || "Individu",
      [WALI_COLUMNS.JURNAL_WALI_KELAS.TOPIK]: topik,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.TINDAK_LANJUT]: tindakLanjut,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.KETERANGAN]: keterangan,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_URL]: fotoUrl,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_ID]: fotoId,
      [WALI_COLUMNS.JURNAL_WALI_KELAS.CREATED_AT]: now,
    });

    return successResponse("Jurnal individu berhasil disimpan", {
      tersimpan: 1,
      mode: "individu",
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

/**
 * Ambil jurnal wali kelas.
 * Action: getJurnalWaliKelas
 */
function getJurnalWaliKelas(idGuru, idWali) {
  try {
    if (isEmpty(idGuru)) return errorResponse("idGuru wajib diisi.");

    let data = getAllDataWali_(WALI_SHEETS.JURNAL_WALI_KELAS).filter(
      (row) =>
        String(row[WALI_COLUMNS.JURNAL_WALI_KELAS.ID_GURU]) === String(idGuru),
    );

    if (!isEmpty(idWali)) {
      data = data.filter(
        (row) =>
          String(row[WALI_COLUMNS.JURNAL_WALI_KELAS.ID_WALI]) ===
          String(idWali),
      );
    }

    const result = data.map((row) => {
      const tanggal = row[WALI_COLUMNS.JURNAL_WALI_KELAS.TANGGAL];
      return {
        idJurnal: row[WALI_COLUMNS.JURNAL_WALI_KELAS.ID_JURNAL],
        idGuru: row[WALI_COLUMNS.JURNAL_WALI_KELAS.ID_GURU],
        idWali: row[WALI_COLUMNS.JURNAL_WALI_KELAS.ID_WALI],
        idSiswa: row[WALI_COLUMNS.JURNAL_WALI_KELAS.ID_SISWA],
        namaSiswa: row[WALI_COLUMNS.JURNAL_WALI_KELAS.NAMA_SISWA],
        kelas: row[WALI_COLUMNS.JURNAL_WALI_KELAS.KELAS],
        tanggal:
          tanggal instanceof Date
            ? Utilities.formatDate(
                tanggal,
                Session.getScriptTimeZone(),
                "yyyy-MM-dd",
              )
            : String(tanggal),
        formatPertemuan: row[WALI_COLUMNS.JURNAL_WALI_KELAS.FORMAT_PERTEMUAN],
        topik: row[WALI_COLUMNS.JURNAL_WALI_KELAS.TOPIK],
        tindakLanjut: row[WALI_COLUMNS.JURNAL_WALI_KELAS.TINDAK_LANJUT],
        keterangan: row[WALI_COLUMNS.JURNAL_WALI_KELAS.KETERANGAN],
        fotoUrl: row[WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_URL],
        fotoId: row[WALI_COLUMNS.JURNAL_WALI_KELAS.FOTO_ID],
        createdAt: row[WALI_COLUMNS.JURNAL_WALI_KELAS.CREATED_AT],
      };
    });

    return successResponse("Data jurnal wali kelas ditemukan", result);
  } catch (e) {
    return errorResponse(e.message);
  }
}

// ------------------------------------------------------------
// PRIVATE UTILITY HELPERS
// ------------------------------------------------------------

/**
 * Auto-enroll siswa sekelas ke kelas wali ini.
 * Menggunakan smart class matching yang mengenali pola "NAMA [KELAS]" dan berbagai format kelas.
 */
function _autoEnrollSiswaKelas_(idGuru, idWali, namaKelas, now) {
  const semuaSiswa = getSiswa();
  const siswaWali = getAllDataWali_(WALI_SHEETS.SISWA_WALI_KELAS);

  // Set siswa yang sudah ada di kelas wali INI (per idWali)
  const siswaWaliIniSet = new Set(
    siswaWali
      .filter(
        (r) =>
          String(r[WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI]) === String(idWali),
      )
      .map((r) => String(r[WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA])),
  );

  // Set siswa yang sudah ada di wali kelas MANA SAJA (untuk constraint eksklusif)
  const siswaWaliGlobalSet = new Set(
    siswaWali.map((r) => String(r[WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA])),
  );

  let ditambahkan = 0;
  let sudahAda = 0;
  let gagal = 0;

  semuaSiswa.forEach((siswa) => {
    const info = _parseSiswaInfo_(siswa);
    if (!info.idSiswa) return;

    if (!_matchKelas_(info.kelas, info.rawName, namaKelas)) {
      return;
    }

    // Sudah ada di kelas wali INI → skip, tidak hitung sudahAda atau gagal
    if (siswaWaliIniSet.has(info.idSiswa)) {
      sudahAda++;
      return;
    }

    // Sudah diambil wali kelas LAIN → catat sebagai gagal (constraint eksklusif)
    if (siswaWaliGlobalSet.has(info.idSiswa)) {
      gagal++;
      return;
    }

    try {
      appendRowWali_(WALI_SHEETS.SISWA_WALI_KELAS, {
        [WALI_COLUMNS.SISWA_WALI_KELAS.ID_GURU]: idGuru,
        [WALI_COLUMNS.SISWA_WALI_KELAS.ID_WALI]: idWali,
        [WALI_COLUMNS.SISWA_WALI_KELAS.ID_SISWA]: info.idSiswa,
        [WALI_COLUMNS.SISWA_WALI_KELAS.CREATED_AT]: now,
      });
      // Update KEDUA set agar iterasi berikut tidak duplikat
      siswaWaliIniSet.add(info.idSiswa);
      siswaWaliGlobalSet.add(info.idSiswa);
      ditambahkan++;
    } catch (_) {
      gagal++;
    }
  });

  return { ditambahkan: ditambahkan, sudahAda: sudahAda, gagal: gagal };
}

function _deleteRowsByColumn_(namaSheet, namaKolom, nilai) {
  const sheet = getWaliSheet_(namaSheet);
  const headers = getWaliHeaders_(namaSheet);
  const colIdx = headers.indexOf(namaKolom);
  if (colIdx < 0) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let deleted = false;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][colIdx]) === String(nilai)) {
      sheet.deleteRow(i + 2);
      deleted = true;
    }
  }
  return deleted;
}

function _deleteRowsByTwoColumns_(
  namaSheet,
  namaKolom1,
  nilai1,
  namaKolom2,
  nilai2,
) {
  const sheet = getWaliSheet_(namaSheet);
  const headers = getWaliHeaders_(namaSheet);
  const colIdx1 = headers.indexOf(namaKolom1);
  const colIdx2 = headers.indexOf(namaKolom2);
  if (colIdx1 < 0 || colIdx2 < 0) return false;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return false;

  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  let deleted = false;

  for (let i = rows.length - 1; i >= 0; i--) {
    if (
      String(rows[i][colIdx1]) === String(nilai1) &&
      String(rows[i][colIdx2]) === String(nilai2)
    ) {
      sheet.deleteRow(i + 2);
      deleted = true;
    }
  }
  return deleted;
}
