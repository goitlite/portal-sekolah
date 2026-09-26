// ============================================================
// Kepsek.gs
// Dashboard Kepala Sekolah SMKN 1 Teluk Kuantan
// Agregator Read-Only Lintas Guru untuk 4 Modul:
// 1. Pembimbing PKL
// 2. Guru Wali
// 3. Guru Mapel
// 4. Wali Kelas
// ============================================================

/**
 * Dispatcher utama untuk action Kepala Sekolah di doPost(e)
 */
function handleKepsekAction_(action, params) {
  params = params || {};
  switch (action) {
    case "getDashboardKepsekPkl":
      return getDashboardKepsekPkl(params);
    case "getDashboardKepsekWali":
      return getDashboardKepsekWali(params);
    case "getDashboardKepsekMapel":
      return getDashboardKepsekMapel(params);
    case "getDashboardKepsekWaliKelas":
      return getDashboardKepsekWaliKelas(params);
    case "getDashboardKepsekSemua":
      return getDashboardKepsekSemua(params);
    default:
      return ContentService.createTextOutput(
        JSON.stringify({
          success: false,
          message: "Action Kepsek tidak dikenali: " + action,
        }),
      ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ------------------------------------------------------------
// HELPER AMBIL SHEET & DATA
// ------------------------------------------------------------

function getKepsekCache_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const data = cache.get("KEPSEK_V2_" + key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    Logger.log("Cache get error: " + e.message);
  }
  return null;
}

function setKepsekCache_(key, data, ttl) {
  try {
    const cache = CacheService.getScriptCache();
    const jsonStr = JSON.stringify(data);
    if (jsonStr.length < 95000) {
      cache.put("KEPSEK_V2_" + key, jsonStr, ttl || 600);
    }
  } catch (e) {
    Logger.log("Cache put error: " + e.message);
  }
}

/**
 * Helper untuk mengambil sheet dari Spreadsheet Utama (MAGANG)
 * atau Spreadsheet Mapel / Wali Kelas
 */
function getSheetByNameSafe_(sheetName) {
  // 1. Jika ini sheet modul WALI KELAS dan getWaliSheet_ tersedia di Wali_Kelas.gs
  if (
    typeof getWaliSheet_ === "function" &&
    (sheetName === "WALI_KELAS" ||
      sheetName === "SISWA_WALI_KELAS" ||
      sheetName === "PRESENSI_WALI_KELAS" ||
      sheetName === "JURNAL_WALI_KELAS")
  ) {
    try {
      const sheet = getWaliSheet_(sheetName);
      if (sheet) return sheet;
    } catch (e) {}
  }

  // 2. Coba ambil dari helper getMapelSS_() jika ada di Mapel.gs atau Wali_Kelas.gs
  try {
    if (typeof getMapelSS_ === "function") {
      const mapelSS = getMapelSS_();
      if (mapelSS) {
        const sheet = mapelSS.getSheetByName(sheetName);
        if (sheet) return sheet;
      }
    }
  } catch (e) {}

  // 3. Coba ambil dari Spreadsheet aktif utama
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) return sheet;
    }
  } catch (e) {}

  // 4. Coba ambil dari MAPEL_SPREADSHEET_ID (dari Config.gs jika diset)
  try {
    if (typeof MAPEL_SPREADSHEET_ID !== "undefined" && MAPEL_SPREADSHEET_ID) {
      const mapelSS = SpreadsheetApp.openById(MAPEL_SPREADSHEET_ID);
      if (mapelSS) {
        const sheet = mapelSS.getSheetByName(sheetName);
        if (sheet) return sheet;
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Ambil semua baris dari sheet sebagai array of object berbasis nama header.
 */
function getSheetRowsAsObjects_(sheetName) {
  // 1. Gunakan helper resmi getAllDataWali_ dari Wali_Kelas.gs jika tersedia
  if (
    typeof getAllDataWali_ === "function" &&
    (sheetName === "WALI_KELAS" ||
      sheetName === "SISWA_WALI_KELAS" ||
      sheetName === "PRESENSI_WALI_KELAS" ||
      sheetName === "JURNAL_WALI_KELAS")
  ) {
    try {
      const rowsWali = getAllDataWali_(sheetName);
      if (Array.isArray(rowsWali) && rowsWali.length > 0) {
        return rowsWali;
      }
    } catch (e) {
      Logger.log(
        "getAllDataWali_ fallback untuk " + sheetName + ": " + e.message,
      );
    }
  }

  // 2. Gunakan helper resmi getAllDataMapel_ jika tersedia
  if (
    typeof getAllDataMapel_ === "function" &&
    (sheetName === "MAPEL" ||
      sheetName === "SISWA_MAPEL" ||
      sheetName === "JURNAL_MAPEL")
  ) {
    try {
      const rowsMapel = getAllDataMapel_(sheetName);
      if (Array.isArray(rowsMapel) && rowsMapel.length > 0) {
        return rowsMapel;
      }
    } catch (e) {}
  }

  const sheet = getSheetByNameSafe_(sheetName);
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const headers = sheet
    .getRange(1, 1, 1, lastCol)
    .getValues()[0]
    .map(function (h) {
      return String(h || "").trim();
    });
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return data.map(function (row) {
    const obj = {};
    headers.forEach(function (header, idx) {
      if (header) {
        obj[header] = row[idx];
      }
    });
    return obj;
  });
}

/**
 * Ambil seluruh data guru dari fungsi getGuru() atau sheet ADMIN_GURU
 */
function getSemuaGuruSafe_() {
  // 1. Coba panggil fungsi getGuru() yang sudah ada di Backend
  try {
    if (typeof getGuru === "function") {
      const g = getGuru();
      if (Array.isArray(g) && g.length > 0) {
        return g.map(function (item) {
          const id = String(
            item.ID || item.id || item.ID_GURU || item.idGuru || "",
          ).trim();
          const nama = String(
            item.NAMA_GURU || item.namaGuru || item.NAMA || item.nama || id,
          ).trim();
          return { id: id, nama: nama, NAMA_GURU: nama, ID: id };
        });
      }
    }
  } catch (e) {}

  // 2. Baca dari sheet ADMIN_GURU (sesuai SHEETS.ADMIN_GURU di Config.gs)
  let rows = getSheetRowsAsObjects_("ADMIN_GURU");
  if (!rows || rows.length === 0) {
    rows = getSheetRowsAsObjects_("GURU");
  }

  return rows.map(function (item) {
    const id = String(item.ID || item.id || item.ID_GURU || "").trim();
    const nama = String(
      item.NAMA_GURU || item.namaGuru || item.NAMA || item.nama || id,
    ).trim();
    return { id: id, nama: nama, NAMA_GURU: nama, ID: id };
  });
}

/**
 * Ambil seluruh data siswa dari fungsi getSiswa() atau sheet SISWA
 */
function getSemuaSiswaSafe_() {
  try {
    if (typeof getSiswa === "function") {
      const s = getSiswa();
      if (Array.isArray(s) && s.length > 0) {
        return s.map(function (item) {
          return normalisasiItemSiswa_(item);
        });
      }
    }
  } catch (e) {}

  const rows = getSheetRowsAsObjects_("SISWA");
  return rows.map(function (item) {
    return normalisasiItemSiswa_(item);
  });
}

function normalisasiItemSiswa_(item) {
  const idSiswa = String(
    item.ID || item.id || item.ID_SISWA || item.idSiswa || "",
  ).trim();
  const rawNama = String(
    item.NAMA || item.nama || item.NAMA_SISWA || item.namaSiswa || "",
  ).trim();
  let nama = rawNama;
  let kelas = String(item.KELAS || item.kelas || "").trim();

  // Pola nama sekolah: "BUDI SANTOSO [XII TKJ 1]"
  const match = rawNama.match(/(.+?)\s*\[(.*?)\]/);
  if (match) {
    nama = match[1].trim();
    if (!kelas) {
      kelas = match[2].trim();
    }
  }

  const idGuru = String(
    item.ID_GURU || item.idGuru || item.GURU_PEMBIMBING || "",
  ).trim();
  const namaGuru = String(item.NAMA_GURU || item.namaGuru || "").trim();
  const tempat = String(
    item.TEMPAT_MAGANG || item.tempatMagang || item.TEMPAT || "",
  ).trim();

  return {
    idSiswa: idSiswa,
    id: idSiswa,
    nama: nama,
    rawNama: rawNama,
    kelas: kelas,
    idGuru: idGuru,
    namaGuru: namaGuru,
    tempatMagang: tempat,
    tempat: tempat,
  };
}

function kepsekJsonSuccess_(message, data) {
  return ContentService.createTextOutput(
    JSON.stringify({
      success: true,
      message: message,
      data: data,
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

function kepsekJsonError_(message) {
  return ContentService.createTextOutput(
    JSON.stringify({
      success: false,
      message: message || "Terjadi kesalahan internal",
    }),
  ).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// 1. DASHBOARD KEPSEK: MODUL PEMBIMBING PKL
// ------------------------------------------------------------
function getDashboardKepsekPkl(params) {
  params = params || {};
  const forceRefresh = !!params.forceRefresh;
  const cacheKey = "PKL_DATA_V2";

  if (!forceRefresh) {
    const cached = getKepsekCache_(cacheKey);
    if (cached) return kepsekJsonSuccess_("Data PKL dari Cache", cached);
  }

  try {
    const allGuru = getSemuaGuruSafe_();
    const allSiswa = getSemuaSiswaSafe_();
    const jurnalRows = getSheetRowsAsObjects_("JURNAL_PKL");
    const monitoringRows = getSheetRowsAsObjects_("MONITORING");

    // Inisialisasi map guru
    const guruMap = {};
    const guruByName = {};

    allGuru.forEach(function (g) {
      if (!g.id && !g.nama) return;
      const keyId = g.id || g.nama;
      const guruObj = {
        idGuru: g.id || "-",
        namaGuru: g.nama || g.id,
        siswaCount: 0,
        siswaList: [],
        tempatList: {},
        jurnalList: [],
        lastJurnalDate: "",
        lastJurnalMateri: "",
        totalMonitoring: 0,
      };
      guruMap[keyId] = guruObj;
      if (g.nama) {
        guruByName[g.nama.toLowerCase()] = guruObj;
      }
    });

    // Petakan siswa ke guru pembimbing
    const allSiswaPkl = [];
    const tempatSet = {};

    allSiswa.forEach(function (s) {
      if (s.tempatMagang) {
        tempatSet[s.tempatMagang] = (tempatSet[s.tempatMagang] || 0) + 1;
      }

      allSiswaPkl.push(s);

      // Cari guru berdasarkan ID atau Nama
      let targetGuru = null;
      if (s.idGuru && guruMap[s.idGuru]) {
        targetGuru = guruMap[s.idGuru];
      } else if (s.namaGuru && guruByName[s.namaGuru.toLowerCase()]) {
        targetGuru = guruByName[s.namaGuru.toLowerCase()];
      }

      if (targetGuru) {
        targetGuru.siswaCount++;
        targetGuru.siswaList.push(s);
        if (s.tempatMagang) {
          targetGuru.tempatList[s.tempatMagang] = true;
        }
      }
    });

    // Petakan Jurnal PKL
    jurnalRows.forEach(function (j) {
      const idGuru = String(j.ID_GURU || j.idGuru || "").trim();
      const tgl = String(j.TANGGAL || j.tanggal || j.CREATED_AT || "").trim();
      const materi = String(j.MATERI || j.materi || "").trim();
      const masalah = String(
        j.PERMASALAHAN || j.permasalahan || j.MASALAH || j.masalah || "",
      ).trim();
      const tindak = String(j.TINDAK_LANJUT || j.tindakLanjut || "").trim();
      const namaSiswa = String(j.NAMA_SISWA || j.namaSiswa || "").trim();
      const fotoUrl = String(j.FOTO_URL || j.fotoUrl || j.FOTO || "").trim();
      const mingguKe = String(j.MINGGU_KE || j.mingguKe || "").trim();

      const itemJurnal = {
        idGuru: idGuru,
        tanggal: tgl,
        namaSiswa: namaSiswa,
        materi: materi,
        masalah: masalah,
        tindakLanjut: tindak,
        fotoUrl: fotoUrl,
        mingguKe: mingguKe,
      };

      if (idGuru && guruMap[idGuru]) {
        guruMap[idGuru].jurnalList.push(itemJurnal);
        if (
          !guruMap[idGuru].lastJurnalDate ||
          tgl > guruMap[idGuru].lastJurnalDate
        ) {
          guruMap[idGuru].lastJurnalDate = tgl;
          guruMap[idGuru].lastJurnalMateri = materi;
        }
      }
    });

    // Petakan Monitoring
    monitoringRows.forEach(function (m) {
      const idGuru = String(m.ID_GURU || m.idGuru || "").trim();
      if (idGuru && guruMap[idGuru]) {
        guruMap[idGuru].totalMonitoring++;
      }
    });

    // Format list cards
    const cardGuruPkl = Object.keys(guruMap)
      .map(function (k) {
        const g = guruMap[k];
        const tempatArr = Object.keys(g.tempatList);
        return {
          idGuru: g.idGuru,
          namaGuru: g.namaGuru,
          jumlahSiswa: g.siswaCount,
          jumlahTempat: tempatArr.length,
          daftarTempat: tempatArr,
          daftarSiswa: g.siswaList,
          jumlahJurnal: g.jurnalList.length,
          jurnalTerakhir: {
            tanggal: g.lastJurnalDate,
            materi: g.lastJurnalMateri,
          },
          riwayatJurnal: g.jurnalList.slice(-10).reverse(),
          totalMonitoring: g.totalMonitoring,
          sudahIsiJurnal: g.jurnalList.length > 0,
        };
      })
      .sort(function (a, b) {
        return b.jumlahSiswa - a.jumlahSiswa;
      });

    // Guru yang aktif pembimbing (punya siswa atau punya jurnal)
    const guruAktifPkl = cardGuruPkl.filter(function (g) {
      return g.jumlahSiswa > 0 || g.jumlahJurnal > 0;
    });

    const statistik = {
      totalGuruPembimbing:
        guruAktifPkl.length > 0 ? guruAktifPkl.length : allGuru.length,
      totalSiswaPkl:
        allSiswaPkl.filter(function (s) {
          return !!s.tempatMagang;
        }).length || allSiswaPkl.length,
      totalTempatPkl: Object.keys(tempatSet).length,
      totalJurnalPkl: jurnalRows.length,
      totalMonitoring: monitoringRows.length,
      listGuruPembimbing: (guruAktifPkl.length > 0
        ? guruAktifPkl
        : cardGuruPkl
      ).map(function (g) {
        return {
          nama: g.namaGuru,
          info: g.jumlahSiswa + " siswa (" + g.jumlahTempat + " tempat)",
        };
      }),
      listSiswaPkl: allSiswaPkl.map(function (s) {
        return {
          nama: s.nama,
          info: (s.kelas ? s.kelas + " • " : "") + (s.tempatMagang || "Magang"),
        };
      }),
      listTempatPkl: Object.keys(tempatSet).map(function (t) {
        return { nama: t, info: tempatSet[t] + " siswa" };
      }),
      listJurnalTerbaru: jurnalRows
        .slice(-15)
        .reverse()
        .map(function (j) {
          return {
            nama: String(j.NAMA_SISWA || j.namaSiswa || "Siswa"),
            info:
              String(j.TANGGAL || j.tanggal || "") +
              " • " +
              String(j.MATERI || j.materi || ""),
          };
        }),
    };

    const result = {
      statistik: statistik,
      cards: cardGuruPkl,
    };

    setKepsekCache_(cacheKey, result, 600);
    return kepsekJsonSuccess_(
      "Berhasil memuat data PKL Kepala Sekolah",
      result,
    );
  } catch (err) {
    Logger.log("Error getDashboardKepsekPkl: " + err.message);
    return kepsekJsonError_(err.message);
  }
}

// ------------------------------------------------------------
// 2. DASHBOARD KEPSEK: MODUL GURU WALI
// ------------------------------------------------------------
function getDashboardKepsekWali(params) {
  params = params || {};
  const forceRefresh = !!params.forceRefresh;
  const cacheKey = "WALI_DATA_V2";

  if (!forceRefresh) {
    const cached = getKepsekCache_(cacheKey);
    if (cached) return kepsekJsonSuccess_("Data Guru Wali dari Cache", cached);
  }

  try {
    const allGuru = getSemuaGuruSafe_();
    const allSiswa = getSemuaSiswaSafe_();
    const siswaWaliRows = getSheetRowsAsObjects_("GURU_WALI");
    const jurnalWaliRows = getSheetRowsAsObjects_("JURNAL_GURU_WALI");

    // Map siswa untuk lookup nama & kelas dari ID_SISWA
    const siswaMap = {};
    allSiswa.forEach(function (s) {
      siswaMap[s.idSiswa] = s;
    });

    const guruMap = {};
    const guruByName = {};

    allGuru.forEach(function (g) {
      if (!g.id && !g.nama) return;
      const keyId = g.id || g.nama;
      const obj = {
        idGuru: g.id || "-",
        namaGuru: g.nama || g.id,
        siswaCount: 0,
        siswaList: [],
        jurnalList: [],
        pertemuanCount: 0,
        lastJurnalDate: "",
        lastTopik: "",
      };
      guruMap[keyId] = obj;
      if (g.nama) {
        guruByName[g.nama.toLowerCase()] = obj;
      }
    });

    // Petakan Siswa Wali
    const allSiswaWaliList = [];
    siswaWaliRows.forEach(function (sw) {
      const idGuru = String(sw.ID_GURU || sw.idGuru || "").trim();
      const idSiswa = String(sw.ID_SISWA || sw.idSiswa || sw.ID || "").trim();

      const infoSiswa = siswaMap[idSiswa] || {};
      const namaSiswa = String(
        infoSiswa.nama ||
          sw.NAMA_SISWA ||
          sw.namaSiswa ||
          sw.NAMA ||
          `Siswa ${idSiswa}`,
      ).trim();
      const kelasSiswa = String(
        infoSiswa.kelas || sw.KELAS || sw.kelas || "-",
      ).trim();

      const item = {
        idSiswa: idSiswa,
        nama: namaSiswa,
        kelas: kelasSiswa,
        idGuru: idGuru,
      };
      allSiswaWaliList.push(item);

      if (idGuru && guruMap[idGuru]) {
        guruMap[idGuru].siswaCount++;
        guruMap[idGuru].siswaList.push(item);
      }
    });

    // Petakan Jurnal Guru Wali
    jurnalWaliRows.forEach(function (jw) {
      const idGuru = String(jw.ID_GURU || jw.idGuru || "").trim();
      const tgl = String(
        jw.TANGGAL || jw.tanggal || jw.CREATED_AT || "",
      ).trim();
      const topik = String(jw.TOPIK || jw.topik || "").trim();
      const tindak = String(jw.TINDAK_LANJUT || jw.tindakLanjut || "").trim();
      const ket = String(jw.KETERANGAN || jw.keterangan || "").trim();
      const format = String(
        jw.FORMAT_PERTEMUAN || jw.formatPertemuan || "Individu",
      ).trim();
      const idSiswa = String(jw.ID_SISWA || jw.idSiswa || "").trim();
      const namaSiswa = String(
        jw.NAMA_SISWA ||
          jw.namaSiswa ||
          (siswaMap[idSiswa] ? siswaMap[idSiswa].nama : "Siswa"),
      ).trim();
      const fotoUrl = String(jw.FOTO_URL || jw.fotoUrl || "").trim();

      const itemJurnal = {
        idJurnal: String(jw.ID_JURNAL || jw.idJurnal || ""),
        tanggal: tgl,
        topik: topik,
        tindakLanjut: tindak,
        keterangan: ket,
        formatPertemuan: format,
        namaSiswa: namaSiswa,
        fotoUrl: fotoUrl,
      };

      if (idGuru && guruMap[idGuru]) {
        guruMap[idGuru].jurnalList.push(itemJurnal);
        guruMap[idGuru].pertemuanCount++;
        if (
          !guruMap[idGuru].lastJurnalDate ||
          tgl > guruMap[idGuru].lastJurnalDate
        ) {
          guruMap[idGuru].lastJurnalDate = tgl;
          guruMap[idGuru].lastTopik = topik;
        }
      }
    });

    const cardGuruWali = Object.keys(guruMap)
      .map(function (k) {
        const g = guruMap[k];
        return {
          idGuru: g.idGuru,
          namaGuru: g.namaGuru,
          jumlahSiswa: g.siswaCount,
          daftarSiswa: g.siswaList,
          totalPertemuan: g.jurnalList.length,
          jurnalTerakhir: {
            tanggal: g.lastJurnalDate,
            topik: g.lastTopik,
          },
          riwayatJurnal: g.jurnalList.slice(-10).reverse(),
          sudahIsiJurnal: g.jurnalList.length > 0,
        };
      })
      .sort(function (a, b) {
        return b.jumlahSiswa - a.jumlahSiswa;
      });

    const guruAktifWali = cardGuruWali.filter(function (g) {
      return g.jumlahSiswa > 0 || g.totalPertemuan > 0;
    });

    const statistik = {
      totalGuruWali:
        guruAktifWali.length > 0 ? guruAktifWali.length : allGuru.length,
      totalSiswaWali: allSiswaWaliList.length,
      totalPertemuanWali: jurnalWaliRows.length,
      listGuruWali: (guruAktifWali.length > 0
        ? guruAktifWali
        : cardGuruWali
      ).map(function (g) {
        return {
          nama: g.namaGuru,
          info:
            g.jumlahSiswa + " anak wali • " + g.totalPertemuan + " pertemuan",
        };
      }),
      listSiswaWali: allSiswaWaliList.map(function (s) {
        return { nama: s.nama, info: s.kelas };
      }),
      listPertemuanTerbaru: jurnalWaliRows
        .slice(-15)
        .reverse()
        .map(function (j) {
          return {
            nama: String(j.NAMA_SISWA || j.namaSiswa || "Siswa"),
            info:
              String(j.TANGGAL || j.tanggal || "") +
              " • " +
              String(j.TOPIK || j.topik || ""),
          };
        }),
    };

    const result = {
      statistik: statistik,
      cards: cardGuruWali,
    };

    setKepsekCache_(cacheKey, result, 600);
    return kepsekJsonSuccess_(
      "Berhasil memuat data Guru Wali Kepala Sekolah",
      result,
    );
  } catch (err) {
    Logger.log("Error getDashboardKepsekWali: " + err.message);
    return kepsekJsonError_(err.message);
  }
}

// ------------------------------------------------------------
// 3. DASHBOARD KEPSEK: MODUL GURU MAPEL
// ------------------------------------------------------------
function getDashboardKepsekMapel(params) {
  params = params || {};
  const forceRefresh = !!params.forceRefresh;
  const cacheKey = "MAPEL_DATA_V2";

  if (!forceRefresh) {
    const cached = getKepsekCache_(cacheKey);
    if (cached) return kepsekJsonSuccess_("Data Guru Mapel dari Cache", cached);
  }

  try {
    const allGuru = getSemuaGuruSafe_();
    const mapelRows = getSheetRowsAsObjects_("MAPEL");
    const siswaMapelRows = getSheetRowsAsObjects_("SISWA_MAPEL");
    const jurnalMapelRows = getSheetRowsAsObjects_("JURNAL_MAPEL");

    const guruMap = {};
    const guruByName = {};

    allGuru.forEach(function (g) {
      if (!g.id && !g.nama) return;
      const keyId = g.id || g.nama;
      const obj = {
        idGuru: g.id || "-",
        namaGuru: g.nama || g.id,
        mapelList: [],
        totalSiswa: 0,
        jurnalList: [],
        lastJurnalDate: "",
        lastTopik: "",
      };
      guruMap[keyId] = obj;
      if (g.nama) {
        guruByName[g.nama.toLowerCase()] = obj;
      }
    });

    // Mapel & Rombel
    const mapelDetailMap = {};
    mapelRows.forEach(function (m) {
      const idMapel = String(m.ID_MAPEL || m.idMapel || "").trim();
      const idGuru = String(m.ID_GURU || m.idGuru || "").trim();
      const namaMapel = String(m.NAMA_MAPEL || m.namaMapel || "").trim();
      const kelas = String(m.KELAS || m.kelas || "").trim();

      const itemMapel = {
        idMapel: idMapel,
        namaMapel: namaMapel,
        kelas: kelas,
        idGuru: idGuru,
        siswaCount: 0,
        daftarSiswa: [],
      };
      mapelDetailMap[idMapel] = itemMapel;

      if (idGuru && guruMap[idGuru]) {
        guruMap[idGuru].mapelList.push(itemMapel);
      }
    });

    // Siswa Mapel
    siswaMapelRows.forEach(function (sm) {
      const idMapel = String(sm.ID_MAPEL || sm.idMapel || "").trim();
      const idSiswa = String(sm.ID_SISWA || sm.idSiswa || "").trim();
      const namaSiswa = String(
        sm.NAMA_SISWA || sm.namaSiswa || `Siswa ${idSiswa}`,
      ).trim();

      if (idMapel && mapelDetailMap[idMapel]) {
        mapelDetailMap[idMapel].siswaCount++;
        mapelDetailMap[idMapel].daftarSiswa.push({
          idSiswa: idSiswa,
          nama: namaSiswa,
        });
      }
    });

    // Jurnal Mapel
    jurnalMapelRows.forEach(function (jm) {
      const idGuru = String(jm.ID_GURU || jm.idGuru || "").trim();
      const tgl = String(
        jm.TANGGAL || jm.tanggal || jm.CREATED_AT || "",
      ).trim();
      const topik = String(jm.TOPIK || jm.topik || "").trim();
      const ket = String(jm.KETERANGAN || jm.keterangan || "").trim();
      const namaSiswa = String(jm.NAMA_SISWA || jm.namaSiswa || "").trim();
      const fotoUrl = String(jm.FOTO_URL || jm.fotoUrl || "").trim();

      const itemJurnal = {
        idJurnal: String(jm.ID_JURNAL || jm.idJurnal || ""),
        tanggal: tgl,
        topik: topik,
        keterangan: ket,
        namaSiswa: namaSiswa,
        fotoUrl: fotoUrl,
      };

      if (idGuru && guruMap[idGuru]) {
        guruMap[idGuru].jurnalList.push(itemJurnal);
        if (
          !guruMap[idGuru].lastJurnalDate ||
          tgl > guruMap[idGuru].lastJurnalDate
        ) {
          guruMap[idGuru].lastJurnalDate = tgl;
          guruMap[idGuru].lastTopik = topik;
        }
      }
    });

    const cardGuruMapel = Object.keys(guruMap)
      .map(function (k) {
        const g = guruMap[k];
        let totalSiswaGuru = 0;
        g.mapelList.forEach(function (m) {
          totalSiswaGuru += m.siswaCount;
        });

        return {
          idGuru: g.idGuru,
          namaGuru: g.namaGuru,
          jumlahMapel: g.mapelList.length,
          daftarMapel: g.mapelList,
          totalSiswa: totalSiswaGuru,
          jumlahJurnal: g.jurnalList.length,
          jurnalTerakhir: {
            tanggal: g.lastJurnalDate,
            topik: g.lastTopik,
          },
          riwayatJurnal: g.jurnalList.slice(-10).reverse(),
          sudahIsiJurnal: g.jurnalList.length > 0,
        };
      })
      .sort(function (a, b) {
        return b.jumlahMapel - a.jumlahMapel;
      });

    const guruAktifMapel = cardGuruMapel.filter(function (g) {
      return g.jumlahMapel > 0;
    });

    const statistik = {
      totalGuruMapel:
        guruAktifMapel.length > 0 ? guruAktifMapel.length : allGuru.length,
      totalKelasMapel: mapelRows.length,
      totalJurnalMapel: jurnalMapelRows.length,
      listGuruMapel: (guruAktifMapel.length > 0
        ? guruAktifMapel
        : cardGuruMapel
      ).map(function (g) {
        return {
          nama: g.namaGuru,
          info: g.jumlahMapel + " mapel/rombel • " + g.totalSiswa + " siswa",
        };
      }),
      listKelasMapel: mapelRows.map(function (m) {
        return {
          nama: String(m.NAMA_MAPEL || m.namaMapel),
          info: String(m.KELAS || m.kelas),
        };
      }),
      listJurnalMapelTerbaru: jurnalMapelRows
        .slice(-15)
        .reverse()
        .map(function (j) {
          return {
            nama: String(j.NAMA_SISWA || j.namaSiswa || "Siswa"),
            info:
              String(j.TANGGAL || j.tanggal || "") +
              " • " +
              String(j.TOPIK || j.topik || ""),
          };
        }),
    };

    const result = {
      statistik: statistik,
      cards: cardGuruMapel,
    };

    setKepsekCache_(cacheKey, result, 600);
    return kepsekJsonSuccess_(
      "Berhasil memuat data Guru Mapel Kepala Sekolah",
      result,
    );
  } catch (err) {
    Logger.log("Error getDashboardKepsekMapel: " + err.message);
    return kepsekJsonError_(err.message);
  }
}

// ------------------------------------------------------------
// 4. DASHBOARD KEPSEK: MODUL WALI KELAS
// ------------------------------------------------------------
function formatTglSafe_(val) {
  if (!val) return "";
  if (val instanceof Date) {
    try {
      return Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
    } catch (e) {
      try {
        return Utilities.formatDate(
          val,
          Session.getScriptTimeZone(),
          "yyyy-MM-dd",
        );
      } catch (err) {}
    }
  }
  var str = String(val).trim();
  // Format YYYY-MM-DD
  if (str.length >= 10 && str.charAt(4) === "-" && str.charAt(7) === "-") {
    return str.substring(0, 10);
  }
  // Format DD/MM/YYYY
  var partsSlash = str.split("/");
  if (partsSlash.length === 3 && partsSlash[2].length >= 4) {
    var d = ("0" + partsSlash[0]).slice(-2);
    var m = ("0" + partsSlash[1]).slice(-2);
    var y = partsSlash[2].substring(0, 4);
    return y + "-" + m + "-" + d;
  }
  // Format DD-MM-YYYY
  var partsDash = str.split("-");
  if (
    partsDash.length === 3 &&
    partsDash[0].length <= 2 &&
    partsDash[2].length >= 4
  ) {
    var d2 = ("0" + partsDash[0]).slice(-2);
    var m2 = ("0" + partsDash[1]).slice(-2);
    var y2 = partsDash[2].substring(0, 4);
    return y2 + "-" + m2 + "-" + d2;
  }
  var dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    try {
      return Utilities.formatDate(dt, "Asia/Jakarta", "yyyy-MM-dd");
    } catch (e) {}
  }
  return str;
}

function getDashboardKepsekWaliKelas(params) {
  params = params || {};
  const forceRefresh = !!params.forceRefresh;
  const cacheKey = "WALIKELAS_DATA_V3";

  if (!forceRefresh) {
    const cached = getKepsekCache_(cacheKey);
    if (cached) return kepsekJsonSuccess_("Data Wali Kelas dari Cache", cached);
  }

  try {
    const todayDate = new Date();
    const todayWib = Utilities.formatDate(
      todayDate,
      "Asia/Jakarta",
      "yyyy-MM-dd",
    );
    let todayScriptTz = "";
    try {
      todayScriptTz = Utilities.formatDate(
        todayDate,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd",
      );
    } catch (e) {}
    const todayYmd = todayWib;

    const allGuru = getSemuaGuruSafe_();
    const allSiswa = getSemuaSiswaSafe_();
    const waliKelasRows = getSheetRowsAsObjects_("WALI_KELAS");
    const siswaWaliKelasRows = getSheetRowsAsObjects_("SISWA_WALI_KELAS");
    const presensiWaliRows = getSheetRowsAsObjects_("PRESENSI_WALI_KELAS");
    const jurnalWaliRows = getSheetRowsAsObjects_("JURNAL_WALI_KELAS");

    // Mapping ID Guru -> NAMA ASLI GURU
    const guruNameMap = {};
    allGuru.forEach(function (g) {
      if (g.id) {
        guruNameMap[String(g.id).trim()] = g.nama || g.NAMA_GURU;
      }
    });

    const siswaMap = {};
    allSiswa.forEach(function (s) {
      siswaMap[s.idSiswa] = s;
    });

    // Mapping Kelas & Wali
    const namaKelasMap = {};
    const namaGuruMap = {};
    waliKelasRows.forEach(function (w) {
      const idWali = String(w.ID_WALI || w.idWali || "").trim();
      const idGuru = String(w.ID_GURU || w.idGuru || "").trim();
      const namaKelas = String(
        w.NAMA_KELAS || w.namaKelas || w.kelas || "",
      ).trim();
      let namaGuru = guruNameMap[idGuru];
      if (!namaGuru && typeof getGuruById === "function") {
        try {
          const gObj = getGuruById(idGuru);
          if (gObj) namaGuru = gObj.NAMA_GURU || gObj.nama || gObj.NAMA;
        } catch (e) {}
      }
      if (!namaGuru) {
        namaGuru = idGuru ? "Guru Wali (" + idGuru + ")" : "Guru Wali Kelas";
      }
      namaKelasMap[idWali] = namaKelas;
      namaGuruMap[idWali] = namaGuru;
    });

    // Siswa per idWali
    const siswaPerWali = {};
    siswaWaliKelasRows.forEach(function (swk) {
      const idWali = String(swk.ID_WALI || swk.idWali || "").trim();
      const idSiswa = String(swk.ID_SISWA || swk.idSiswa || "").trim();
      if (idWali) {
        if (!siswaPerWali[idWali]) siswaPerWali[idWali] = [];
        siswaPerWali[idWali].push(idSiswa);
      }
    });

    // Jurnal per idWali
    const jurnalPerWali = {};
    jurnalWaliRows.forEach(function (jwk) {
      const idWali = String(jwk.ID_WALI || jwk.idWali || "").trim();
      if (idWali) {
        if (!jurnalPerWali[idWali]) jurnalPerWali[idWali] = [];
        jurnalPerWali[idWali].push({
          idJurnal: String(jwk.ID_JURNAL || jwk.idJurnal || ""),
          tanggal: String(jwk.TANGGAL || jwk.tanggal || ""),
          namaSiswa: String(jwk.NAMA_SISWA || jwk.namaSiswa || ""),
          topik: String(jwk.TOPIK || jwk.topik || ""),
          tindakLanjut: String(jwk.TINDAK_LANJUT || jwk.tindakLanjut || ""),
          keterangan: String(jwk.KETERANGAN || jwk.keterangan || ""),
          fotoUrl: String(jwk.FOTO_URL || jwk.fotoUrl || ""),
        });
      }
    });

    // Presensi per idWali & Seluruh Presensi
    const presensiPerWali = {};
    const allPresensiList = [];

    presensiWaliRows.forEach(function (pw) {
      const idWali = String(pw.ID_WALI || pw.idWali || "").trim();
      const idSiswa = String(pw.ID_SISWA || pw.idSiswa || "").trim();
      const tgl = formatTglSafe_(
        pw.TANGGAL || pw.tanggal || pw.CREATED_AT || pw.createdAt,
      );
      const status = String(pw.STATUS || pw.status || "Hadir").trim();
      const keterangan = String(pw.KETERANGAN || pw.keterangan || "").trim();
      const sInfo = siswaMap[idSiswa] || {};
      const namaSiswa = String(
        pw.NAMA_SISWA || pw.namaSiswa || sInfo.nama || "Siswa " + idSiswa,
      ).trim();
      const namaKelas = namaKelasMap[idWali] || sInfo.kelas || "-";
      const namaGuru = namaGuruMap[idWali] || "-";

      const presensiItem = {
        idPresensi: String(pw.ID_PRESENSI || pw.idPresensi || ""),
        idWali: idWali,
        idSiswa: idSiswa,
        namaSiswa: namaSiswa,
        namaKelas: namaKelas,
        namaGuru: namaGuru,
        tanggal: tgl,
        status: status,
        keterangan: keterangan,
      };

      allPresensiList.push(presensiItem);

      if (idWali) {
        if (!presensiPerWali[idWali]) {
          presensiPerWali[idWali] = {
            totalEntries: 0,
            hadir: 0,
            sakit: 0,
            izin: 0,
            alfa: 0,
            latestDate: "",
            hadirHariIni: 0,
            sakitHariIni: 0,
            izinHariIni: 0,
            alfaHariIni: 0,
            todayEntries: {},
            entriesByDate: {},
            riwayatPresensi: [],
          };
        }

        const stat = presensiPerWali[idWali];
        stat.totalEntries++;
        stat.riwayatPresensi.push(presensiItem);

        if (!stat.entriesByDate[tgl]) {
          stat.entriesByDate[tgl] = {};
        }
        stat.entriesByDate[tgl][idSiswa] = presensiItem;

        if (status === "Hadir") stat.hadir++;
        else if (status === "Sakit") stat.sakit++;
        else if (status === "Izin") stat.izin++;
        else if (status === "Alfa" || status === "Cabut") stat.alfa++;

        if (tgl && (!stat.latestDate || tgl > stat.latestDate)) {
          stat.latestDate = tgl;
        }

        // Cek apakah tanggal hari ini (WIB atau Script Timezone)
        const isToday =
          tgl === todayWib || (todayScriptTz && tgl === todayScriptTz);
        if (isToday) {
          stat.todayEntries[idSiswa] = presensiItem;
          if (status === "Hadir") stat.hadirHariIni++;
          else if (status === "Sakit") stat.sakitHariIni++;
          else if (status === "Izin") stat.izinHariIni++;
          else if (status === "Alfa" || status === "Cabut") stat.alfaHariIni++;
        }
      }
    });

    let grandHadirHariIni = 0;
    let grandSakitHariIni = 0;
    let grandIzinHariIni = 0;
    let grandAlfaHariIni = 0;
    const allSiswaHadirHariIniList = [];

    // Format Card Wali Kelas dengan NAMA ASLI GURU, Presensi Hari Ini, dan Daftar Siswa
    const cardWaliKelas = waliKelasRows
      .map(function (w) {
        const idWali = String(w.ID_WALI || w.idWali || "").trim();
        const idGuru = String(w.ID_GURU || w.idGuru || "").trim();
        const namaKelas = String(
          w.NAMA_KELAS || w.namaKelas || w.kelas || "",
        ).trim();
        const ket = String(w.KETERANGAN || w.keterangan || "").trim();
        const namaGuru =
          namaGuruMap[idWali] ||
          (idGuru ? "Guru Wali (" + idGuru + ")" : "Guru Wali Kelas");

        const rawSiswaIds = siswaPerWali[idWali] || [];
        const jurnalList = jurnalPerWali[idWali] || [];
        const presensiStat = presensiPerWali[idWali] || {
          hadir: 0,
          sakit: 0,
          izin: 0,
          alfa: 0,
          latestDate: "",
          hadirHariIni: 0,
          sakitHariIni: 0,
          izinHariIni: 0,
          alfaHariIni: 0,
          todayEntries: {},
          riwayatPresensi: [],
        };

        const hasTodayPresensi =
          (presensiStat.hadirHariIni || 0) +
            (presensiStat.sakitHariIni || 0) +
            (presensiStat.izinHariIni || 0) +
            (presensiStat.alfaHariIni || 0) >
          0;
        const activeDate = hasTodayPresensi
          ? todayYmd
          : presensiStat.latestDate || todayYmd;
        const activeEntries = hasTodayPresensi
          ? presensiStat.todayEntries || {}
          : (presensiStat.entriesByDate && presensiStat.latestDate
              ? presensiStat.entriesByDate[presensiStat.latestDate]
              : null) ||
            presensiStat.todayEntries ||
            {};

        // Hitung rincian status sesi aktif (hari ini atau sesi terbaru)
        let activeHadir = 0;
        let activeSakit = 0;
        let activeIzin = 0;
        let activeAlfa = 0;

        // Buat daftar siswa lengkap dengan status hari ini / sesi aktif
        const siswaDetailList = rawSiswaIds.map(function (sid) {
          const sInfo = siswaMap[sid] || {};
          const tEntry = activeEntries ? activeEntries[sid] : null;
          const statusToday = tEntry ? tEntry.status : "Belum Presensi";
          const ketToday = tEntry ? tEntry.keterangan : "";

          if (statusToday === "Hadir") activeHadir++;
          else if (statusToday === "Sakit") activeSakit++;
          else if (statusToday === "Izin") activeIzin++;
          else if (statusToday === "Alfa" || statusToday === "Cabut")
            activeAlfa++;

          const sObj = {
            idSiswa: sid,
            nama: sInfo.nama || "Siswa " + sid,
            namaSiswa: sInfo.nama || "Siswa " + sid,
            kelas: sInfo.kelas || namaKelas,
            statusHariIni: statusToday,
            keteranganHariIni: ketToday,
            isHadirHariIni: statusToday === "Hadir",
          };

          if (sObj.isHadirHariIni) {
            allSiswaHadirHariIniList.push({
              idSiswa: sid,
              namaSiswa: sObj.nama,
              namaKelas: namaKelas,
              namaGuru: namaGuru,
              keterangan: ketToday,
            });
          }

          return sObj;
        });

        grandHadirHariIni += activeHadir;
        grandSakitHariIni += activeSakit;
        grandIzinHariIni += activeIzin;
        grandAlfaHariIni += activeAlfa;

        // Urutkan siswa: yang sudah Hadir di atas, lalu abjad
        siswaDetailList.sort(function (a, b) {
          if (a.isHadirHariIni && !b.isHadirHariIni) return -1;
          if (!a.isHadirHariIni && b.isHadirHariIni) return 1;
          return a.nama.localeCompare(b.nama);
        });

        const siswaHadirHariIni = siswaDetailList.filter(function (s) {
          return s.isHadirHariIni;
        });

        const totalSiswaKelas = siswaDetailList.length;
        const totalHadirKelas = activeHadir;
        const persenHadirKelas =
          totalSiswaKelas > 0
            ? Math.round((totalHadirKelas / totalSiswaKelas) * 100)
            : 0;

        // Urutkan riwayat presensi kelas (terbaru di atas)
        const riwayatKelas = (presensiStat.riwayatPresensi || [])
          .slice()
          .reverse();

        return {
          idWali: idWali,
          idGuru: idGuru,
          namaGuru: namaGuru,
          namaKelas: namaKelas,
          keterangan: ket,
          jumlahSiswa: totalSiswaKelas,
          daftarSiswa: siswaDetailList,
          // Presensi Hari Ini / Sesi Aktif
          presensiHariIni: {
            tanggal: activeDate,
            isToday: hasTodayPresensi,
            labelSesi: hasTodayPresensi ? "Hari Ini" : "Sesi Terakhir",
            hadir: totalHadirKelas,
            sakit: activeSakit,
            izin: activeIzin,
            alfa: activeAlfa,
            totalAbsen: totalHadirKelas + activeSakit + activeIzin + activeAlfa,
            persenHadir: persenHadirKelas,
            siswaHadirList: siswaHadirHariIni,
            siswaTidakHadirList: siswaDetailList.filter(function (s) {
              return (
                s.statusHariIni !== "Hadir" &&
                s.statusHariIni !== "Belum Presensi"
              );
            }),
            siswaBelumPresensiList: siswaDetailList.filter(function (s) {
              return s.statusHariIni === "Belum Presensi";
            }),
          },
          // Presensi Kumulatif (Keseluruhan)
          presensi: {
            hadir: presensiStat.hadir || 0,
            sakit: presensiStat.sakit || 0,
            izin: presensiStat.izin || 0,
            alfa: presensiStat.alfa || 0,
            totalEntries: presensiStat.totalEntries || 0,
            latestDate: presensiStat.latestDate || "",
          },
          // Riwayat Presensi Kelas Ini (Max 300 record terbaru)
          riwayatPresensi: riwayatKelas.slice(0, 300),
          totalPresensiKelas: riwayatKelas.length,
          // Jurnal Bimbingan
          jumlahJurnal: jurnalList.length,
          riwayatJurnal: jurnalList.slice(-10).reverse(),
          createdAt: String(w.CREATED_AT || w.createdAt || ""),
        };
      })
      .sort(function (a, b) {
        return a.namaKelas.localeCompare(b.namaKelas);
      });

    const totalSiswaWaliKelas = siswaWaliKelasRows.length;
    const persenKehadiranSekolah =
      totalSiswaWaliKelas > 0
        ? Math.round((grandHadirHariIni / totalSiswaWaliKelas) * 100)
        : 0;

    const statistik = {
      totalWaliKelas: cardWaliKelas.length,
      totalSiswaWaliKelas: totalSiswaWaliKelas,
      totalPresensiTercatat: presensiWaliRows.length,
      totalJurnalBimbingan: jurnalWaliRows.length,
      // Statistik Hari Ini
      tanggalHariIni: todayYmd,
      totalHadirHariIni: grandHadirHariIni,
      totalSakitHariIni: grandSakitHariIni,
      totalIzinHariIni: grandIzinHariIni,
      totalAlfaHariIni: grandAlfaHariIni,
      persenKehadiranHariIni: persenKehadiranSekolah,
      listKelasWali: cardWaliKelas.map(function (c) {
        return {
          nama: c.namaKelas,
          info:
            c.namaGuru +
            " (" +
            c.jumlahSiswa +
            " siswa • " +
            (c.presensiHariIni ? c.presensiHariIni.hadir : 0) +
            " hadir hari ini)",
        };
      }),
      listSiswaHadirHariIni: allSiswaHadirHariIniList.map(function (s) {
        return {
          nama: s.namaSiswa,
          info:
            s.namaKelas +
            " • Wali: " +
            s.namaGuru +
            (s.keterangan ? " (" + s.keterangan + ")" : ""),
        };
      }),
      listJurnalBimbinganTerbaru: jurnalWaliRows
        .slice(-15)
        .reverse()
        .map(function (j) {
          return {
            nama: String(j.NAMA_SISWA || j.namaSiswa || "Siswa"),
            info:
              String(j.TANGGAL || j.tanggal || "") +
              " • " +
              String(j.TOPIK || j.topik || ""),
          };
        }),
      // Seluruh presensi terbaru (150 record terakhir untuk modal seluruh presensi)
      semuaPresensiTerbaru: allPresensiList.slice(-150).reverse(),
    };

    const result = {
      statistik: statistik,
      cards: cardWaliKelas,
    };

    setKepsekCache_(cacheKey, result, 600);
    return kepsekJsonSuccess_(
      "Berhasil memuat data Wali Kelas Kepala Sekolah",
      result,
    );
  } catch (err) {
    Logger.log("Error getDashboardKepsekWaliKelas: " + err.message);
    return kepsekJsonError_(err.message);
  }
}

// ------------------------------------------------------------
// 5. DASHBOARD KEPSEK: SEMUA MODUL SEKALIGUS
// ------------------------------------------------------------
function getDashboardKepsekSemua(params) {
  params = params || {};
  const forceRefresh = !!params.forceRefresh;

  const pkl = JSON.parse(
    getDashboardKepsekPkl({ forceRefresh: forceRefresh }).getContent(),
  );
  const wali = JSON.parse(
    getDashboardKepsekWali({ forceRefresh: forceRefresh }).getContent(),
  );
  const mapel = JSON.parse(
    getDashboardKepsekMapel({ forceRefresh: forceRefresh }).getContent(),
  );
  const walikelas = JSON.parse(
    getDashboardKepsekWaliKelas({ forceRefresh: forceRefresh }).getContent(),
  );

  return kepsekJsonSuccess_(
    "Semua data dashboard kepala sekolah berhasil dimuat",
    {
      pembimbing: pkl.data,
      wali: wali.data,
      mapel: mapel.data,
      walikelas: walikelas.data,
    },
  );
}
