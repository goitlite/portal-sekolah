/**
 * Mapel.gs (v4)
 * Backend untuk fitur GURU MAPEL (Guru Mata Pelajaran)
 *
 * ====================================================================
 * INI FILE PENGGANTI Mapel.gs versi sebelumnya — GANTI SELURUH ISI FILE
 * Mapel.gs LAMA dengan file ini.
 *
 * APA YANG BARU DI v4 (dibanding v3):
 * - hapusSiswaMapel() sekarang "PINTAR": setelah menghapus siswa dari
 *   mapel ini (SISWA_MAPEL + histori PRESENSI_MAPEL/JURNAL_MAPEL khusus
 *   mapel ini, seperti sebelumnya), sistem OTOMATIS MENGECEK apakah
 *   siswa tsb AMAN dihapus PERMANEN dari sheet SISWA di spreadsheet
 *   MAGANG:
 *     AMAN (boleh dihapus permanen) HANYA JIKA:
 *       1. Kolom NAMA_GURU siswa tsb di sheet SISWA KOSONG (belum
 *          punya Guru Pembimbing Magang), DAN
 *       2. Siswa tsb TIDAK ADA baris relasinya di sheet GURU_WALI
 *          (belum/tidak punya Guru Wali).
 *     Kalau salah satu syarat di atas TIDAK terpenuhi (siswa masih
 *     punya Guru Pembimbing dan/atau Guru Wali), penghapusan HANYA
 *     terjadi di data Mapel — sheet SISWA/GURU_WALI TIDAK disentuh
 *     sama sekali, siswa tetap aman di sistem.
 *   Fungsi mengembalikan `action`: 'hapus_permanen_dari_sistem' atau
 *   'hapus_mapel_saja', supaya frontend bisa menampilkan pesan yang
 *   sesuai ke guru.
 * - Tidak ada action/WebApp baru yang perlu ditambahkan — nama action
 *   'hapusSiswaMapel' tetap sama persis seperti sebelumnya.
 * ====================================================================
 *
 * CATATAN ARSITEKTUR (tidak berubah):
 * Data Mapel disimpan di SPREADSHEET TERPISAH (MAPEL_SPREADSHEET_ID).
 * Data GURU/SISWA/GURU_WALI tetap dibaca (dan, HANYA pada kondisi aman
 * di atas, dihapus barisnya) dari spreadsheet MAGANG yang lama, lewat
 * fungsi generik yang sudah ada (getSiswaById, deleteSiswa,
 * findDataByColumn) — file ini tidak pernah menulis langsung ke sheet
 * SISWA/GURU_WALI, semua lewat fungsi yang sudah diuji di file lain.
 * ====================================================================
 */

// ============================================
// SETUP SEKALI JALAN (jalankan manual dari editor)
// ============================================
/**
 * JALANKAN SATU KALI SAJA — HANYA kalau BELUM pernah setup spreadsheet
 * Mapel sebelumnya. Kalau sudah pernah, TIDAK PERLU jalankan lagi.
 */
function setupMapelSpreadsheet() {
  const ss = SpreadsheetApp.create('MAPEL_DATA_SMKN1TK');

  const struktur = {
    MAPEL: ['ID_MAPEL', 'ID_GURU', 'NAMA_MAPEL', 'KELAS', 'KETERANGAN', 'CREATED_AT'],
    SISWA_MAPEL: ['ID_GURU', 'ID_MAPEL', 'ID_SISWA', 'CREATED_AT'],
    PRESENSI_MAPEL: ['ID_PRESENSI', 'ID_GURU', 'ID_MAPEL', 'ID_SISWA', 'NAMA_SISWA', 'TANGGAL', 'PERTEMUAN_KE', 'STATUS', 'NILAI_HARIAN', 'CREATED_AT'],
    JURNAL_MAPEL: ['ID_JURNAL', 'ID_GURU', 'ID_MAPEL', 'ID_SISWA', 'NAMA_SISWA', 'KELAS', 'TANGGAL', 'FORMAT_PERTEMUAN', 'TOPIK', 'TINDAK_LANJUT', 'KETERANGAN', 'FOTO_URL', 'FOTO_ID', 'CREATED_AT']
  };

  const namaSheetList = Object.keys(struktur);

  namaSheetList.forEach(function (nama, index) {
    let sheet;
    if (index === 0) {
      sheet = ss.getSheets()[0];
      sheet.setName(nama);
    } else {
      sheet = ss.insertSheet(nama);
    }
    const headers = struktur[nama];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  });

  Logger.log('==========================================');
  Logger.log('SPREADSHEET MAPEL BERHASIL DIBUAT!');
  Logger.log('ID Spreadsheet : ' + ss.getId());
  Logger.log('URL            : ' + ss.getUrl());
  Logger.log('==========================================');
  Logger.log('1. Salin ID di atas ke MAPEL_SPREADSHEET_ID di Config.gs');
  Logger.log('2. Deploy > Manage Deployments > New Version');
}

// ============================================
// HELPER INTERNAL — AKSES SPREADSHEET MAPEL
// ============================================
function getMapelSS_() {
  if (typeof MAPEL_SPREADSHEET_ID === 'undefined' ||
      isEmpty(MAPEL_SPREADSHEET_ID) ||
      String(MAPEL_SPREADSHEET_ID).indexOf('PASTE_ID') === 0) {
    throw new Error('MAPEL_SPREADSHEET_ID belum diatur di Config.gs. Jalankan setupMapelSpreadsheet() dulu, lalu salin ID-nya ke Config.gs.');
  }
  return SpreadsheetApp.openById(MAPEL_SPREADSHEET_ID);
}

function getMapelSheet_(sheetName) {
  const ss = getMapelSS_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" tidak ditemukan di Spreadsheet Mapel. Jalankan ulang setupMapelSpreadsheet() atau buat sheet tsb manual.');
  }
  return sheet;
}

function getMapelHeaders_(sheetName) {
  const sheet = getMapelSheet_(sheetName);
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function getAllDataMapel_(sheetName) {
  const sheet = getMapelSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol === 0) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];

  return values.slice(1).map(function (row) {
    const obj = {};
    headers.forEach(function (h, idx) {
      obj[h] = row[idx];
    });
    return obj;
  });
}

function findAllDataMapelByColumn_(sheetName, column, value) {
  return getAllDataMapel_(sheetName).filter(function (item) {
    return String(item[column]) === String(value);
  });
}

function appendRowMapel_(sheetName, obj) {
  const sheet = getMapelSheet_(sheetName);
  const headers = getMapelHeaders_(sheetName);
  const row = objectToRow(obj, headers);
  sheet.appendRow(row);
}

// Hapus semua baris di 1 sheet Mapel yang cocok idMapel + idSiswa.
function hapusBarisMapelBerdasarkanSiswa_(sheetName, kolomMapel, kolomSiswa, idMapel, idSiswa) {
  try {
    const sheet = getMapelSheet_(sheetName);
    const headers = getMapelHeaders_(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const data = sheet.getRange(1, 1, lastRow, headers.length).getValues();
    const mapelCol = headers.indexOf(kolomMapel);
    const siswaCol = headers.indexOf(kolomSiswa);

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][mapelCol]) === String(idMapel) &&
          String(data[i][siswaCol]) === String(idSiswa)) {
        sheet.deleteRow(i + 1);
      }
    }
  } catch (error) {
    Logger.log('hapusBarisMapelBerdasarkanSiswa_ error: ' + error.message);
  }
}

// Hapus SEMUA jejak seorang siswa di SELURUH mapel (semua guru), dipakai
// setelah siswa tsb dihapus permanen dari sheet SISWA (supaya tidak ada
// baris "yatim" menunjuk ke ID siswa yang sudah tidak ada).
function hapusSemuaJejakSiswaDiSemuaMapel_(idSiswa) {
  const target = [
    { sheet: MAPEL_SHEETS.SISWA_MAPEL, kolom: MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA },
    { sheet: MAPEL_SHEETS.PRESENSI_MAPEL, kolom: MAPEL_COLUMNS.PRESENSI_MAPEL.ID_SISWA },
    { sheet: MAPEL_SHEETS.JURNAL_MAPEL, kolom: MAPEL_COLUMNS.JURNAL_MAPEL.ID_SISWA }
  ];

  target.forEach(function (t) {
    try {
      const sheet = getMapelSheet_(t.sheet);
      const headers = getMapelHeaders_(t.sheet);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      const data = sheet.getRange(1, 1, lastRow, headers.length).getValues();
      const siswaCol = headers.indexOf(t.kolom);

      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][siswaCol]) === String(idSiswa)) {
          sheet.deleteRow(i + 1);
        }
      }
    } catch (error) {
      Logger.log('hapusSemuaJejakSiswaDiSemuaMapel_ error (' + t.sheet + '): ' + error.message);
    }
  });
}

// Mengecek apakah seorang siswa masih terdaftar di mapel lain
// (baik mapel lain dari guru yang sama, maupun mapel dari guru lain).
// Jika idMapelExclude diberikan, baris yang merujuk ke idMapelExclude akan diabaikan.
function isSiswaTerdaftarDiMapelLain_(idSiswa, idMapelExclude) {
  try {
    const sheet = getMapelSheet_(MAPEL_SHEETS.SISWA_MAPEL);
    const headers = getMapelHeaders_(MAPEL_SHEETS.SISWA_MAPEL);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;

    const data = sheet.getRange(1, 1, lastRow, headers.length).getValues();
    const siswaCol = headers.indexOf(MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA);
    const mapelCol = headers.indexOf(MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL);

    for (let i = 1; i < data.length; i++) {
      const rowSiswaId = String(data[i][siswaCol]).trim();
      const rowMapelId = String(data[i][mapelCol]).trim();

      if (rowSiswaId === String(idSiswa).trim()) {
        // Abaikan jika mapel ini adalah mapel yang sedang dihapus
        if (idMapelExclude && rowMapelId === String(idMapelExclude).trim()) {
          continue;
        }
        // Masih ditemukan di mapel lain!
        return true;
      }
    }
    return false;
  } catch (error) {
    Logger.log('isSiswaTerdaftarDiMapelLain_ error: ' + error.message);
    // Demi keselamatan data siswa, jika gagal membaca, anggap masih digunakan
    return true;
  }
}

// Cek apakah seorang siswa AMAN dihapus PERMANEN dari sheet SISWA (spreadsheet MAGANG):
// AMAN HANYA JIKA:
// 1. TIDAK terdaftar di mapel lain manapun (baik guru sama maupun guru berbeda).
// 2. TIDAK punya Guru Pembimbing (NAMA_GURU dan ID_GURU kosong).
// 3. TIDAK terdaftar di sheet GURU_WALI sama sekali.
// Jika siswa masih digunakan di mapel lain atau punya guru wali/pembimbing,
// data siswa di sheet SISWA TIDAK BOLEH dihapus!
function isSiswaAmanDihapusPermanen_(idSiswa, idMapelExclude) {
  try {
    // 1. Cek apakah masih digunakan di mapel lain manapun
    if (isSiswaTerdaftarDiMapelLain_(idSiswa, idMapelExclude)) {
      Logger.log('Siswa ' + idSiswa + ' TIDAK aman dihapus permanen: masih digunakan di mapel lain.');
      return false;
    }

    // 2. Cek Guru Pembimbing Magang di sheet SISWA
    const siswa = getSiswaById(idSiswa); // fungsi dari Siswa.gs, spreadsheet MAGANG
    if (!siswa) return false; // sudah tidak ada datanya, tidak perlu apa-apa lagi

    const namaGuru = String(siswa[COLUMNS.SISWA.NAMA_GURU] || '').trim();
    const idGuruPembimbing = String(siswa[COLUMNS.SISWA.ID_GURU] || '').trim();
    const punyaGuruPembimbing =
      (!isEmpty(namaGuru) && namaGuru !== '-') ||
      (!isEmpty(idGuruPembimbing) && idGuruPembimbing !== '-');
    if (punyaGuruPembimbing) {
      Logger.log('Siswa ' + idSiswa + ' TIDAK aman dihapus permanen: masih punya Guru Pembimbing Magang.');
      return false;
    }

    // 3. Cek Guru Wali di sheet GURU_WALI
    const relasiWali = findDataByColumn(SHEETS.GURU_WALI, COLUMNS.GURU_WALI.ID_SISWA, idSiswa);
    if (relasiWali) {
      Logger.log('Siswa ' + idSiswa + ' TIDAK aman dihapus permanen: masih punya Guru Wali (PKL).');
      return false;
    }

    // 4. Cek Guru Wali Kelas di sheet SISWA_WALI_KELAS (spreadsheet MAPEL)
    try {
      let sheetWali = null;
      try {
        sheetWali = getMapelSS_().getSheetByName("SISWA_WALI_KELAS");
      } catch (e) {}
      if (sheetWali && sheetWali.getLastRow() >= 2) {
        const lastRowWali = sheetWali.getLastRow();
        const lastColWali = sheetWali.getLastColumn();
        const headersWali = sheetWali.getRange(1, 1, 1, lastColWali).getValues()[0];
        const colSiswaWali = headersWali.indexOf("ID_SISWA");
        if (colSiswaWali !== -1) {
          const valsWali = sheetWali.getRange(2, colSiswaWali + 1, lastRowWali - 1, 1).getValues();
          for (let w = 0; w < valsWali.length; w++) {
            if (String(valsWali[w][0]).trim() === String(idSiswa).trim()) {
              Logger.log('Siswa ' + idSiswa + ' TIDAK aman dihapus permanen: masih terdaftar di kelas Wali Kelas.');
              return false;
            }
          }
        }
      }
    } catch (waliKelasErr) {
      Logger.log('Info: Gagal cek SISWA_WALI_KELAS: ' + waliKelasErr.message);
      return false; // Demi keamanan data jika ragu, jangan hapus siswa permanen
    }

    return true;
  } catch (error) {
    Logger.log('isSiswaAmanDihapusPermanen_ error: ' + error.message);
    return false;
  }
}

// ============================================
// HELPER — DATA SISWA & GURU WALI (spreadsheet MAGANG, tidak diubah)
// ============================================
function parseNamaKelasSiswa_(namaLengkap) {
  const text = String(namaLengkap || '').trim();
  const match = text.match(/\[(.*?)\]/);
  const kelas = match ? match[1].trim() : '';
  const namaBersih = text.replace(/\s*\[.*?\]\s*/, '').trim();
  return { namaBersih: namaBersih, kelas: kelas };
}

function getNamaGuruWaliSiswa_(idSiswa) {
  try {
    const relasi = findDataByColumn(SHEETS.GURU_WALI, COLUMNS.GURU_WALI.ID_SISWA, idSiswa);
    if (!relasi) return '';
    const guru = getGuruById(relasi[COLUMNS.GURU_WALI.ID_GURU]);
    return guru ? guru[COLUMNS.ADMIN_GURU.NAMA_GURU] : '';
  } catch (error) {
    return '';
  }
}

function getKelasSiswaMapel() {
  try {
    const semuaSiswa = getSiswa();
    const kelasSet = {};
    semuaSiswa.forEach(function (s) {
      const info = parseNamaKelasSiswa_(s[COLUMNS.SISWA.NAMA]);
      if (info.kelas) kelasSet[info.kelas] = true;
    });
    return Object.keys(kelasSet).sort();
  } catch (error) {
    Logger.log('getKelasSiswaMapel error: ' + error.message);
    return [];
  }
}

function getSiswaByKelasMapel(kelas) {
  if (isEmpty(kelas)) return [];
  try {
    const semuaSiswa = getSiswa();
    const hasil = [];
    semuaSiswa.forEach(function (s) {
      const info = parseNamaKelasSiswa_(s[COLUMNS.SISWA.NAMA]);
      if (info.kelas === kelas) {
        const idSiswa = s[COLUMNS.SISWA.ID];
        hasil.push({
          idSiswa: idSiswa,
          nama: info.namaBersih,
          kelas: info.kelas,
          namaGuruWali: getNamaGuruWaliSiswa_(idSiswa) || ''
        });
      }
    });
    hasil.sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });
    return hasil;
  } catch (error) {
    Logger.log('getSiswaByKelasMapel error: ' + error.message);
    return [];
  }
}

function getSemuaSiswaUntukTambahMapel(idGuru, idMapel) {
  if (isEmpty(idMapel)) return [];
  try {
    const semuaSiswa = getSiswa();

    const sudahTerdaftar = {};
    findAllDataMapelByColumn_(MAPEL_SHEETS.SISWA_MAPEL, MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL, idMapel)
      .forEach(function (e) {
        sudahTerdaftar[e[MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA]] = true;
      });

    const semuaRelasiWali = getAllData(SHEETS.GURU_WALI);
    const semuaGuru = getGuru();
    const guruMap = {};
    semuaGuru.forEach(function (g) {
      guruMap[g[COLUMNS.ADMIN_GURU.ID]] = g[COLUMNS.ADMIN_GURU.NAMA_GURU];
    });
    const waliMap = {};
    semuaRelasiWali.forEach(function (r) {
      waliMap[r[COLUMNS.GURU_WALI.ID_SISWA]] = guruMap[r[COLUMNS.GURU_WALI.ID_GURU]] || '';
    });

    return semuaSiswa
      .filter(function (s) { return !sudahTerdaftar[s[COLUMNS.SISWA.ID]]; })
      .map(function (s) {
        const idSiswa = s[COLUMNS.SISWA.ID];
        const info = parseNamaKelasSiswa_(s[COLUMNS.SISWA.NAMA]);
        return {
          idSiswa: idSiswa,
          nama: info.namaBersih,
          kelas: info.kelas,
          namaGuruWali: waliMap[idSiswa] || ''
        };
      })
      .sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });
  } catch (error) {
    Logger.log('getSemuaSiswaUntukTambahMapel error: ' + error.message);
    return [];
  }
}

function prosesFotoMapel_(fotoUrl, namaFile) {
  if (isEmpty(fotoUrl)) return { url: '', id: '' };
  if (String(fotoUrl).indexOf('data:') !== 0) {
    return { url: fotoUrl, id: '' };
  }
  try {
    const matches = String(fotoUrl).match(/^data:(.+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : 'image/jpeg';
    const base64Data = matches ? matches[2] : fotoUrl;
    const hasil = uploadPhoto(base64Data, namaFile, mimeType);
    if (hasil && hasil.success && hasil.data) {
      return { url: hasil.data.url || '', id: hasil.data.id || hasil.data.fileId || '' };
    }
    return { url: '', id: '' };
  } catch (error) {
    Logger.log('prosesFotoMapel_ error: ' + error.message);
    return { url: '', id: '' };
  }
}

// ============================================
// 1. KELOLA MAPEL (CRUD daftar mata pelajaran)
// ============================================
function getMapelByGuru(idGuru) {
  if (isEmpty(idGuru)) return [];
  try {
    const list = findAllDataMapelByColumn_(MAPEL_SHEETS.MAPEL, MAPEL_COLUMNS.MAPEL.ID_GURU, idGuru);
    return list.map(function (m) {
      return {
        idMapel: m[MAPEL_COLUMNS.MAPEL.ID_MAPEL],
        idGuru: m[MAPEL_COLUMNS.MAPEL.ID_GURU],
        namaMapel: m[MAPEL_COLUMNS.MAPEL.NAMA_MAPEL],
        kelas: m[MAPEL_COLUMNS.MAPEL.KELAS] || '',
        keterangan: m[MAPEL_COLUMNS.MAPEL.KETERANGAN] || ''
      };
    });
  } catch (error) {
    Logger.log('getMapelByGuru error: ' + error.message);
    return [];
  }
}

function addMapel(params) {
  if (isEmpty(params.idGuru)) return errorResponse('ID guru tidak boleh kosong');
  if (isEmpty(params.namaMapel)) return errorResponse('Nama mapel tidak boleh kosong');

  try {
    const kelas = params.kelas ? String(params.kelas).trim() : '';
    const namaBaru = String(params.namaMapel).trim().toUpperCase();

    const existing = findAllDataMapelByColumn_(MAPEL_SHEETS.MAPEL, MAPEL_COLUMNS.MAPEL.ID_GURU, params.idGuru);
    const sudahAda = existing.some(function (m) {
      const namaSama = String(m[MAPEL_COLUMNS.MAPEL.NAMA_MAPEL]).trim().toUpperCase() === namaBaru;
      const kelasSama = String(m[MAPEL_COLUMNS.MAPEL.KELAS] || '').trim() === kelas;
      return namaSama && kelasSama;
    });
    if (sudahAda) {
      return errorResponse(
        kelas
          ? 'Mapel "' + params.namaMapel + '" untuk kelas ' + kelas + ' sudah ada.'
          : 'Mapel dengan nama tersebut sudah ada.'
      );
    }

    const idMapel = generateRandomId();
    const obj = {};
    obj[MAPEL_COLUMNS.MAPEL.ID_MAPEL] = idMapel;
    obj[MAPEL_COLUMNS.MAPEL.ID_GURU] = params.idGuru;
    obj[MAPEL_COLUMNS.MAPEL.NAMA_MAPEL] = String(params.namaMapel).trim();
    obj[MAPEL_COLUMNS.MAPEL.KELAS] = kelas;
    obj[MAPEL_COLUMNS.MAPEL.KETERANGAN] = params.keterangan || '';
    obj[MAPEL_COLUMNS.MAPEL.CREATED_AT] = new Date();

    appendRowMapel_(MAPEL_SHEETS.MAPEL, obj);

    let jumlahSiswaOtomatis = 0;
    if (Array.isArray(params.idSiswaList) && params.idSiswaList.length > 0) {
      params.idSiswaList.forEach(function (sid) {
        if (!isEmpty(sid)) {
          const enrollObj = {};
          enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.ID_GURU] = params.idGuru;
          enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL] = idMapel;
          enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA] = sid;
          enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.CREATED_AT] = new Date();
          appendRowMapel_(MAPEL_SHEETS.SISWA_MAPEL, enrollObj);
          jumlahSiswaOtomatis++;
        }
      });
    } else if (!isEmpty(kelas)) {
      const daftarSiswaKelas = getSiswaByKelasMapel(kelas);
      daftarSiswaKelas.forEach(function (s) {
        const enrollObj = {};
        enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.ID_GURU] = params.idGuru;
        enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL] = idMapel;
        enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA] = s.idSiswa;
        enrollObj[MAPEL_COLUMNS.SISWA_MAPEL.CREATED_AT] = new Date();
        appendRowMapel_(MAPEL_SHEETS.SISWA_MAPEL, enrollObj);
        jumlahSiswaOtomatis++;
      });
    }

    return successResponse('Mapel berhasil ditambahkan', {
      idMapel: idMapel,
      namaMapel: String(params.namaMapel).trim(),
      kelas: kelas,
      jumlahSiswaOtomatis: jumlahSiswaOtomatis
    });
  } catch (error) {
    return errorResponse('Error: ' + error.message);
  }
}

function editMapel(params) {
  if (isEmpty(params.idMapel)) return errorResponse('ID mapel tidak boleh kosong');
  if (isEmpty(params.namaMapel)) return errorResponse('Nama mapel tidak boleh kosong');

  try {
    const sheet = getMapelSheet_(MAPEL_SHEETS.MAPEL);
    const headers = getMapelHeaders_(MAPEL_SHEETS.MAPEL);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return errorResponse('Mapel tidak ditemukan');

    const data = sheet.getRange(1, 1, lastRow, headers.length).getValues();
    const idCol = headers.indexOf(MAPEL_COLUMNS.MAPEL.ID_MAPEL);
    const namaCol = headers.indexOf(MAPEL_COLUMNS.MAPEL.NAMA_MAPEL) + 1;
    const ketCol = headers.indexOf(MAPEL_COLUMNS.MAPEL.KETERANGAN) + 1;

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(params.idMapel)) {
        sheet.getRange(i + 1, namaCol).setValue(String(params.namaMapel).trim());
        if (params.keterangan !== undefined) {
          sheet.getRange(i + 1, ketCol).setValue(params.keterangan || '');
        }
        return successResponse('Mapel berhasil diubah', {
          idMapel: params.idMapel,
          namaMapel: String(params.namaMapel).trim()
        });
      }
    }
    return errorResponse('Mapel tidak ditemukan');
  } catch (error) {
    return errorResponse('Error: ' + error.message);
  }
}

// Hapus semua baris di 1 sheet Mapel yang cocok idMapel (dipakai saat
// mapel itu sendiri dihapus total, membersihkan SISWA_MAPEL/
// PRESENSI_MAPEL/JURNAL_MAPEL milik mapel tsb sekaligus).
function hapusSemuaBarisMapelBerdasarkanIdMapel_(sheetName, kolomMapel, idMapel) {
  try {
    const sheet = getMapelSheet_(sheetName);
    const headers = getMapelHeaders_(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    const data = sheet.getRange(1, 1, lastRow, headers.length).getValues();
    const mapelCol = headers.indexOf(kolomMapel);

    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][mapelCol]) === String(idMapel)) {
        sheet.deleteRow(i + 1);
      }
    }
  } catch (error) {
    Logger.log('hapusSemuaBarisMapelBerdasarkanIdMapel_ error (' + sheetName + '): ' + error.message);
  }
}

// Hapus 1 mapel SEKALIGUS SELURUH siswanya, mengikuti ketentuan yang
// SAMA PERSIS seperti hapusSiswaMapel() per siswa:
//   - Siswa yang TIDAK punya Guru Pembimbing Magang DAN TIDAK punya
//     Guru Wali -> dihapus PERMANEN dari sheet SISWA (spreadsheet
//     MAGANG) + dibersihkan jejaknya dari SEMUA mapel lain juga.
//   - Siswa yang masih punya salah satunya -> TIDAK disentuh sama
//     sekali di sheet SISWA/GURU_WALI, hanya kehilangan
//     keanggotaannya di mapel yang dihapus ini.
// Setelah semua siswa diproses, seluruh data Mapel (SISWA_MAPEL,
// PRESENSI_MAPEL, JURNAL_MAPEL, baris MAPEL itu sendiri) dihapus.
function deleteMapel(params) {
  if (isEmpty(params.idMapel)) return errorResponse('ID mapel tidak boleh kosong');

  try {
    const daftarSiswaMapel = findAllDataMapelByColumn_(
      MAPEL_SHEETS.SISWA_MAPEL, MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL, params.idMapel
    );
    const daftarIdSiswa = daftarSiswaMapel.map(function (e) {
      return e[MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA];
    });

    let dihapusPermanen = 0;

    daftarIdSiswa.forEach(function (idSiswa) {
      if (isSiswaAmanDihapusPermanen_(idSiswa, params.idMapel)) {
        const hasilHapusPermanen = deleteSiswa({ id: idSiswa }); // fungsi dari Siswa.gs
        if (hasilHapusPermanen && hasilHapusPermanen.success) {
          dihapusPermanen++;
          hapusSemuaJejakSiswaDiSemuaMapel_(idSiswa); // bersihkan di SEMUA mapel, bukan cuma yang ini
        }
      }
    });

    // Bersihkan sisa data Mapel untuk mapel ini (siswa yang tidak
    // dihapus permanen otomatis ikut hilang dari sini juga karena
    // barisnya menunjuk ke idMapel yang akan dihapus total).
    hapusSemuaBarisMapelBerdasarkanIdMapel_(MAPEL_SHEETS.SISWA_MAPEL, MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL, params.idMapel);
    hapusSemuaBarisMapelBerdasarkanIdMapel_(MAPEL_SHEETS.PRESENSI_MAPEL, MAPEL_COLUMNS.PRESENSI_MAPEL.ID_MAPEL, params.idMapel);
    hapusSemuaBarisMapelBerdasarkanIdMapel_(MAPEL_SHEETS.JURNAL_MAPEL, MAPEL_COLUMNS.JURNAL_MAPEL.ID_MAPEL, params.idMapel);

    const sheet = getMapelSheet_(MAPEL_SHEETS.MAPEL);
    const headers = getMapelHeaders_(MAPEL_SHEETS.MAPEL);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return errorResponse('Mapel tidak ditemukan');

    const data = sheet.getRange(1, 1, lastRow, headers.length).getValues();
    const idCol = headers.indexOf(MAPEL_COLUMNS.MAPEL.ID_MAPEL);

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][idCol]) === String(params.idMapel)) {
        sheet.deleteRow(i + 1);
        return successResponse('Mapel & seluruh siswanya berhasil diproses sesuai ketentuan', {
          idMapel: params.idMapel,
          totalSiswa: daftarIdSiswa.length,
          dihapusPermanen: dihapusPermanen,
          dihapusDariMapelSaja: daftarIdSiswa.length - dihapusPermanen
        });
      }
    }
    return errorResponse('Mapel tidak ditemukan');
  } catch (error) {
    return errorResponse('Error: ' + error.message);
  }
}

// ============================================
// 2. SISWA MAPEL (daftar peserta per mapel)
// ============================================
function getSiswaMapel(idGuru, idMapel) {
  if (isEmpty(idGuru) || isEmpty(idMapel)) return [];
  try {
    const enrolled = findAllDataMapelByColumn_(MAPEL_SHEETS.SISWA_MAPEL, MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL, idMapel)
      .filter(function (e) { return String(e[MAPEL_COLUMNS.SISWA_MAPEL.ID_GURU]) === String(idGuru); });

    const hasil = enrolled.map(function (e) {
      const idSiswa = e[MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA];
      const siswa = getSiswaById(idSiswa);
      const info = parseNamaKelasSiswa_(siswa ? siswa[COLUMNS.SISWA.NAMA] : '');
      return {
        idSiswa: idSiswa,
        nama: info.namaBersih || (siswa ? siswa[COLUMNS.SISWA.NAMA] : '(Siswa tidak ditemukan)'),
        kelas: info.kelas,
        namaGuruWali: getNamaGuruWaliSiswa_(idSiswa) || ''
      };
    });

    hasil.sort(function (a, b) { return String(a.nama).localeCompare(String(b.nama)); });
    return hasil;
  } catch (error) {
    Logger.log('getSiswaMapel error: ' + error.message);
    return [];
  }
}

function simpanSiswaMapel(params) {
  if (isEmpty(params.idGuru)) return errorResponse('ID guru tidak boleh kosong');
  if (isEmpty(params.idMapel)) return errorResponse('ID mapel tidak boleh kosong');
  if (isEmpty(params.idSiswa)) return errorResponse('ID siswa tidak boleh kosong');

  try {
    const existing = findAllDataMapelByColumn_(MAPEL_SHEETS.SISWA_MAPEL, MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL, params.idMapel)
      .filter(function (e) { return String(e[MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA]) === String(params.idSiswa); });

    if (existing.length > 0) {
      return successResponse('Siswa sudah terdaftar di mapel ini', { action: 'already' });
    }

    const obj = {};
    obj[MAPEL_COLUMNS.SISWA_MAPEL.ID_GURU] = params.idGuru;
    obj[MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL] = params.idMapel;
    obj[MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA] = params.idSiswa;
    obj[MAPEL_COLUMNS.SISWA_MAPEL.CREATED_AT] = new Date();

    appendRowMapel_(MAPEL_SHEETS.SISWA_MAPEL, obj);

    return successResponse('Siswa berhasil ditambahkan ke mapel', { action: 'insert' });
  } catch (error) {
    return errorResponse('Error: ' + error.message);
  }
}

// Hapus siswa dari 1 mapel — "PINTAR" (lihat catatan v4 di atas file):
// 1. SELALU hapus dari SISWA_MAPEL + histori PRESENSI_MAPEL/JURNAL_MAPEL
//    milik siswa tsb KHUSUS mapel ini.
// 2. KALAU siswa tsb tidak punya Guru Pembimbing DAN tidak punya Guru
//    Wali -> ikut dihapus PERMANEN dari sheet SISWA (spreadsheet
//    MAGANG) + dibersihkan jejaknya dari SEMUA mapel lain juga.
// 3. KALAU siswa masih punya Guru Pembimbing dan/atau Guru Wali ->
//    sheet SISWA/GURU_WALI TIDAK disentuh sama sekali.
function hapusSiswaMapel(params) {
  if (isEmpty(params.idMapel)) return errorResponse('ID mapel tidak boleh kosong');
  if (isEmpty(params.idSiswa)) return errorResponse('ID siswa tidak boleh kosong');

  try {
    const sheet = getMapelSheet_(MAPEL_SHEETS.SISWA_MAPEL);
    const headers = getMapelHeaders_(MAPEL_SHEETS.SISWA_MAPEL);
    const lastRow = sheet.getLastRow();
    let ditemukan = false;

    if (lastRow >= 2) {
      const data = sheet.getRange(1, 1, lastRow, headers.length).getValues();
      const mapelCol = headers.indexOf(MAPEL_COLUMNS.SISWA_MAPEL.ID_MAPEL);
      const siswaCol = headers.indexOf(MAPEL_COLUMNS.SISWA_MAPEL.ID_SISWA);

      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][mapelCol]) === String(params.idMapel) &&
            String(data[i][siswaCol]) === String(params.idSiswa)) {
          sheet.deleteRow(i + 1);
          ditemukan = true;
          break;
        }
      }
    }

    if (!ditemukan) return errorResponse('Data relasi siswa-mapel tidak ditemukan');

    hapusBarisMapelBerdasarkanSiswa_(
      MAPEL_SHEETS.PRESENSI_MAPEL,
      MAPEL_COLUMNS.PRESENSI_MAPEL.ID_MAPEL,
      MAPEL_COLUMNS.PRESENSI_MAPEL.ID_SISWA,
      params.idMapel, params.idSiswa
    );

    hapusBarisMapelBerdasarkanSiswa_(
      MAPEL_SHEETS.JURNAL_MAPEL,
      MAPEL_COLUMNS.JURNAL_MAPEL.ID_MAPEL,
      MAPEL_COLUMNS.JURNAL_MAPEL.ID_SISWA,
      params.idMapel, params.idSiswa
    );

    // Hapus juga riwayat upload tugas online siswa khusus di mapel ini (jika ada)
    try {
      const sheetUpload = getMapelSS_().getSheetByName('UPLOAD_SISWA');
      if (sheetUpload && sheetUpload.getLastRow() >= 2) {
        const headersU = sheetUpload.getRange(1, 1, 1, sheetUpload.getLastColumn()).getValues()[0];
        const colM = headersU.indexOf('ID_MAPEL');
        const colS = headersU.indexOf('ID_SISWA');
        if (colM !== -1 && colS !== -1) {
          const dataU = sheetUpload.getDataRange().getValues();
          for (let u = dataU.length - 1; u >= 1; u--) {
            if (String(dataU[u][colM]) === String(params.idMapel) &&
                String(dataU[u][colS]) === String(params.idSiswa)) {
              sheetUpload.deleteRow(u + 1);
            }
          }
        }
      }
    } catch (eUpload) {}

    // Cek apakah aman dihapus PERMANEN dari sheet SISWA:
    // HANYA aman jika siswa TIDAK terdaftar di mapel lain manapun (guru sama / guru beda),
    // TIDAK punya Guru Pembimbing, dan TIDAK punya Guru Wali.
    if (isSiswaAmanDihapusPermanen_(params.idSiswa, params.idMapel)) {
      const hasilHapusPermanen = deleteSiswa({ id: params.idSiswa }); // fungsi dari Siswa.gs
      if (hasilHapusPermanen && hasilHapusPermanen.success) {
        hapusSemuaJejakSiswaDiSemuaMapel_(params.idSiswa);
        return successResponse(
          'Siswa dihapus permanen dari sistem (tidak terdaftar di mapel lain / Guru Pembimbing / Guru Wali)',
          { idSiswa: params.idSiswa, action: 'hapus_permanen_dari_sistem' }
        );
      }
    }

    return successResponse('Siswa berhasil dihapus dari mapel ini (data induk siswa tetap aman di sistem karena digunakan di mapel lain / pembimbing / wali)', {
      idSiswa: params.idSiswa,
      action: 'hapus_mapel_saja'
    });
  } catch (error) {
    return errorResponse('Error: ' + error.message);
  }
}

// ============================================
// 3. PRESENSI PERTEMUAN MAPEL + NILAI HARIAN (GRID)
// ============================================
function getPresensiMapelGrid(idGuru, idMapel) {
  if (isEmpty(idGuru) || isEmpty(idMapel)) return { siswa: [], presensi: [] };

  try {
    const siswa = getSiswaMapel(idGuru, idMapel);

    const presensi = findAllDataMapelByColumn_(MAPEL_SHEETS.PRESENSI_MAPEL, MAPEL_COLUMNS.PRESENSI_MAPEL.ID_MAPEL, idMapel)
      .filter(function (p) { return String(p[MAPEL_COLUMNS.PRESENSI_MAPEL.ID_GURU]) === String(idGuru); })
      .map(function (p) {
        return {
          idSiswa: p[MAPEL_COLUMNS.PRESENSI_MAPEL.ID_SISWA],
          pertemuanKe: Number(p[MAPEL_COLUMNS.PRESENSI_MAPEL.PERTEMUAN_KE]) || 0,
          tanggal: p[MAPEL_COLUMNS.PRESENSI_MAPEL.TANGGAL]
            ? Utilities.formatDate(new Date(p[MAPEL_COLUMNS.PRESENSI_MAPEL.TANGGAL]), Session.getScriptTimeZone(), 'yyyy-MM-dd')
            : '',
          status: p[MAPEL_COLUMNS.PRESENSI_MAPEL.STATUS] || '',
          nilai: p[MAPEL_COLUMNS.PRESENSI_MAPEL.NILAI_HARIAN]
        };
      });

    return { siswa: siswa, presensi: presensi };
  } catch (error) {
    Logger.log('getPresensiMapelGrid error: ' + error.message);
    return { siswa: [], presensi: [] };
  }
}

function savePresensiMapel(params) {
  if (isEmpty(params.idGuru)) return errorResponse('ID guru tidak boleh kosong');
  if (isEmpty(params.idMapel)) return errorResponse('ID mapel tidak boleh kosong');
  if (!Array.isArray(params.cells) || params.cells.length === 0) {
    return successResponse('Tidak ada perubahan untuk disimpan', { diperbarui: 0, ditambah: 0 });
  }

  const statusValid = ['Hadir', 'Sakit', 'Izin', 'Alfa', 'Cabut'];

  try {
    const sheet = getMapelSheet_(MAPEL_SHEETS.PRESENSI_MAPEL);
    const headers = getMapelHeaders_(MAPEL_SHEETS.PRESENSI_MAPEL);
    const numCols = headers.length;
    const lastRow = sheet.getLastRow();

    const idMapelCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.ID_MAPEL);
    const idSiswaCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.ID_SISWA);
    const pertemuanCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.PERTEMUAN_KE);
    const tanggalCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.TANGGAL);
    const statusCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.STATUS);
    const nilaiCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.NILAI_HARIAN);
    const idPresensiCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.ID_PRESENSI);
    const idGuruCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.ID_GURU);
    const namaSiswaCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.NAMA_SISWA);
    const createdAtCol = headers.indexOf(MAPEL_COLUMNS.PRESENSI_MAPEL.CREATED_AT);

    let existingData = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, numCols).getValues() : [];

    const indexMap = {};
    existingData.forEach(function (row, idx) {
      if (String(row[idMapelCol]) === String(params.idMapel)) {
        indexMap[String(row[idSiswaCol]) + '|' + String(row[pertemuanCol])] = idx;
      }
    });

    const barisBaru = [];
    let diperbarui = 0;
    let ditambah = 0;

    params.cells.forEach(function (cell) {
      if (isEmpty(cell.idSiswa) || isEmpty(cell.pertemuanKe)) return;

      const status = statusValid.indexOf(cell.status) !== -1 ? cell.status : '';
      if (isEmpty(status)) return;

      const nilai = (status === 'Hadir' && !isEmpty(cell.nilaiHarian)) ? Number(cell.nilaiHarian) : '';
      const key = String(cell.idSiswa) + '|' + String(cell.pertemuanKe);

      if (Object.prototype.hasOwnProperty.call(indexMap, key)) {
        const idx = indexMap[key];
        existingData[idx][statusCol] = status;
        existingData[idx][nilaiCol] = nilai;
        if (!isEmpty(cell.tanggal)) existingData[idx][tanggalCol] = cell.tanggal;
        diperbarui++;
      } else {
        const rowArr = new Array(numCols).fill('');
        rowArr[idPresensiCol] = generateRandomId();
        rowArr[idGuruCol] = params.idGuru;
        rowArr[idMapelCol] = params.idMapel;
        rowArr[idSiswaCol] = cell.idSiswa;
        rowArr[namaSiswaCol] = cell.namaSiswa || '';
        rowArr[tanggalCol] = cell.tanggal || '';
        rowArr[pertemuanCol] = cell.pertemuanKe;
        rowArr[statusCol] = status;
        rowArr[nilaiCol] = nilai;
        rowArr[createdAtCol] = new Date();
        barisBaru.push(rowArr);
        ditambah++;
      }
    });

    if (existingData.length > 0) {
      sheet.getRange(2, 1, existingData.length, numCols).setValues(existingData);
    }
    if (barisBaru.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, barisBaru.length, numCols).setValues(barisBaru);
    }

    return successResponse('Presensi mapel berhasil disimpan', {
      diperbarui: diperbarui,
      ditambah: ditambah
    });
  } catch (error) {
    return errorResponse('Error: ' + error.message);
  }
}

// ============================================
// 4. PEMBINAAN SISWA MAPEL (dipakai di Fase 4)
// ============================================
function saveJurnalMapel(params) {
  if (isEmpty(params.idGuru)) return errorResponse('ID guru tidak boleh kosong');
  if (isEmpty(params.idMapel)) return errorResponse('ID mapel tidak boleh kosong');
  if (isEmpty(params.tanggal)) return errorResponse('Tanggal wajib diisi');

  const formatPertemuan = params.formatPertemuan || 'Individu';
  let daftarIdSiswa = [];

  if (formatPertemuan === 'Kelompok' && Array.isArray(params.idSiswaList) && params.idSiswaList.length > 0) {
    daftarIdSiswa = params.idSiswaList;
  } else if (!isEmpty(params.idSiswa)) {
    daftarIdSiswa = [params.idSiswa];
  } else {
    return errorResponse('Siswa wajib dipilih');
  }

  try {
    const namaFile = 'jurnal_mapel_' + params.idGuru + '_' + Date.now() + '.jpg';
    const foto = prosesFotoMapel_(params.fotoUrl, namaFile);

    daftarIdSiswa.forEach(function (idSiswa) {
      const siswa = getSiswaById(idSiswa);
      const info = parseNamaKelasSiswa_(siswa ? siswa[COLUMNS.SISWA.NAMA] : '');

      const obj = {};
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.ID_JURNAL] = generateRandomId();
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.ID_GURU] = params.idGuru;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.ID_MAPEL] = params.idMapel;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.ID_SISWA] = idSiswa;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.NAMA_SISWA] = info.namaBersih;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.KELAS] = info.kelas;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.TANGGAL] = params.tanggal;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.FORMAT_PERTEMUAN] = formatPertemuan;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.TOPIK] = params.topik || '';
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.TINDAK_LANJUT] = params.tindakLanjut || '';
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.KETERANGAN] = params.keterangan || '';
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.FOTO_URL] = foto.url;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.FOTO_ID] = foto.id;
      obj[MAPEL_COLUMNS.JURNAL_MAPEL.CREATED_AT] = new Date();

      appendRowMapel_(MAPEL_SHEETS.JURNAL_MAPEL, obj);
    });

    return successResponse('Jurnal pembinaan mapel berhasil disimpan', { jumlahSiswa: daftarIdSiswa.length });
  } catch (error) {
    return errorResponse('Error: ' + error.message);
  }
}

function getJurnalMapel(idGuru, idMapel) {
  if (isEmpty(idGuru)) return [];
  try {
    let list = findAllDataMapelByColumn_(MAPEL_SHEETS.JURNAL_MAPEL, MAPEL_COLUMNS.JURNAL_MAPEL.ID_GURU, idGuru);
    if (!isEmpty(idMapel)) {
      list = list.filter(function (j) { return String(j[MAPEL_COLUMNS.JURNAL_MAPEL.ID_MAPEL]) === String(idMapel); });
    }
    return list;
  } catch (error) {
    Logger.log('getJurnalMapel error: ' + error.message);
    return [];
  }
}