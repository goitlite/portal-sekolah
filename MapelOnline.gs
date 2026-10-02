/**
 * MapelOnline.gs
 * Tambahan backend untuk fitur MAPEL ONLINE
 *
 * ====================================================================
 * CARA PASANG:
 * 1. Buat file baru "MapelOnline.gs" di Google Apps Script project
 * 2. Copy-paste seluruh isi file ini ke dalamnya
 * 3. Jalankan setupMapelOnlineSheets() SATU KALI untuk membuat sheet baru
 * 4. Deploy ulang (New Version)
 *
 * SHEET BARU YANG DIBUAT:
 * - TUGAS_MAPEL   : [ID_TUGAS, ID_MAPEL, ID_GURU, PERTEMUAN_KE, JUDUL_TUGAS, DESKRIPSI, FILE_URL, FILE_ID, CREATED_AT]
 * - JAWABAN_SISWA : [ID_JAWABAN, ID_MAPEL, ID_SISWA, NAMA_SISWA, PERTEMUAN_KE, ID_TUGAS, FILE_URL, FILE_ID, KETERANGAN, CREATED_AT]
 *
 * ACTION BARU YANG DITAMBAH (tambahkan ke router utama di Code.gs / WebApp.gs):
 *   case 'uploadTugasMapel'    : return uploadTugasMapel_(params);
 *   case 'getTugasMapel'       : return getTugasMapel_(params);
 *   case 'uploadJawabanSiswa'  : return uploadJawabanSiswa_(params);
 *   case 'getJawabanSiswa'     : return getJawabanSiswa_(params);
 * ====================================================================
 */

// ==============================================
// SETUP SHEET BARU (jalankan satu kali)
// ==============================================
function setupMapelOnlineSheets() {
  const ss = getMapelSS_(); // dari Mapel.gs

  function ensureSheet(nama, headers) {
    let sheet = ss.getSheetByName(nama);
    if (!sheet) {
      sheet = ss.insertSheet(nama);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      Logger.log('Sheet baru dibuat: ' + nama);
    } else {
      Logger.log('Sheet sudah ada: ' + nama);
    }
    return sheet;
  }

  ensureSheet('TUGAS_MAPEL', [
    'ID_TUGAS', 'ID_MAPEL', 'ID_GURU', 'PERTEMUAN_KE',
    'JUDUL_TUGAS', 'DESKRIPSI', 'FILE_URL', 'FILE_ID', 'CREATED_AT'
  ]);

  ensureSheet('JAWABAN_SISWA', [
    'ID_JAWABAN', 'ID_MAPEL', 'ID_SISWA', 'NAMA_SISWA', 'PERTEMUAN_KE',
    'ID_TUGAS', 'FILE_URL', 'FILE_ID', 'KETERANGAN', 'CREATED_AT'
  ]);

  Logger.log('=== Setup MapelOnline selesai ===');
}

// ==============================================
// HELPER — Upload file ke Google Drive
// ==============================================
function uploadFileToDrive_(base64DataUrl, namaFile, mimeType, folderName) {
  if (!base64DataUrl) return { url: '', id: '' };

  try {
    // Pisahkan prefix base64 ("data:image/png;base64,xxx")
    var parts = base64DataUrl.split(',');
    var data = parts.length > 1 ? parts[1] : parts[0];
    var blob = Utilities.newBlob(Utilities.base64Decode(data), mimeType || 'application/octet-stream', namaFile || 'file');

    // Cari atau buat folder
    var folderNama = folderName || 'MapelOnline_Files';
    var folders = DriveApp.getFoldersByName(folderNama);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderNama);

    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      id: file.getId()
    };
  } catch (e) {
    Logger.log('uploadFileToDrive_ error: ' + e.message);
    return { url: '', id: '' };
  }
}

// ==============================================
// ACTION: uploadTugasMapel
// Guru upload/simpan tugas untuk pertemuan tertentu
// ==============================================
function uploadTugasMapel_(params) {
  try {
    var idGuru = String(params.idGuru || '').trim();
    var idMapel = String(params.idMapel || '').trim();
    var pertemuanKe = String(params.pertemuanKe || '').trim();
    var judulTugas = String(params.judulTugas || '').trim();
    var deskripsi = String(params.deskripsi || '').trim();
    var fileBase64 = params.fileBase64 || '';
    var namaFile = String(params.namaFile || 'tugas').trim();
    var mimeType = String(params.mimeType || 'application/pdf').trim();
    var fileUrlLangsung = String(params.fileUrl || '').trim();

    if (!idGuru || !idMapel || !pertemuanKe) {
      return { success: false, message: 'idGuru, idMapel, dan pertemuanKe wajib diisi.' };
    }

    var fileUrl = fileUrlLangsung;
    var fileId = '';

    // Upload ke Drive jika ada base64
    if (fileBase64 && !fileUrl) {
      var hasil = uploadFileToDrive_(fileBase64, namaFile, mimeType, 'TugasMapel_' + idMapel);
      fileUrl = hasil.url;
      fileId = hasil.id;
    }

    var idTugas = 'TGS-' + idMapel + '-P' + pertemuanKe + '-' + new Date().getTime();
    var now = new Date().toISOString();

    appendRowMapel_('TUGAS_MAPEL', {
      ID_TUGAS: idTugas,
      ID_MAPEL: idMapel,
      ID_GURU: idGuru,
      PERTEMUAN_KE: pertemuanKe,
      JUDUL_TUGAS: judulTugas || ('Tugas Pertemuan ' + pertemuanKe),
      DESKRIPSI: deskripsi,
      FILE_URL: fileUrl,
      FILE_ID: fileId,
      CREATED_AT: now
    });

    return {
      success: true,
      message: 'Tugas berhasil disimpan.',
      data: { idTugas: idTugas, fileUrl: fileUrl }
    };
  } catch (e) {
    Logger.log('uploadTugasMapel_ error: ' + e.message);
    return { success: false, message: 'Gagal menyimpan tugas: ' + e.message };
  }
}

// ==============================================
// ACTION: getTugasMapel
// Ambil semua tugas guru untuk suatu mapel (dan opsional pertemuanKe)
// ==============================================
function getTugasMapel_(params) {
  try {
    var idMapel = String(params.idMapel || '').trim();
    var pertemuanKe = String(params.pertemuanKe || '').trim();

    if (!idMapel) {
      return { success: false, message: 'idMapel wajib diisi.' };
    }

    var semua = getAllDataMapel_('TUGAS_MAPEL');
    var filtered = semua.filter(function(t) {
      if (String(t.ID_MAPEL) !== idMapel) return false;
      if (pertemuanKe && String(t.PERTEMUAN_KE) !== pertemuanKe) return false;
      return true;
    });

    var result = filtered.map(function(t) {
      return {
        idTugas: t.ID_TUGAS,
        idMapel: t.ID_MAPEL,
        idGuru: t.ID_GURU,
        pertemuanKe: t.PERTEMUAN_KE,
        judulTugas: t.JUDUL_TUGAS,
        deskripsi: t.DESKRIPSI,
        fileUrl: t.FILE_URL,
        createdAt: t.CREATED_AT
      };
    });

    return { success: true, data: result };
  } catch (e) {
    Logger.log('getTugasMapel_ error: ' + e.message);
    return { success: false, message: 'Gagal mengambil tugas: ' + e.message };
  }
}

// ==============================================
// ACTION: uploadJawabanSiswa
// Siswa upload jawaban untuk suatu tugas/pertemuan
// ==============================================
function uploadJawabanSiswa_(params) {
  try {
    var idSiswa = String(params.idSiswa || '').trim();
    var namaSiswa = String(params.namaSiswa || '').trim();
    var idMapel = String(params.idMapel || '').trim();
    var pertemuanKe = String(params.pertemuanKe || '').trim();
    var idTugas = String(params.idTugas || '').trim();
    var keterangan = String(params.keterangan || '').trim();
    var fileBase64 = params.fileBase64 || '';
    var namaFile = String(params.namaFile || 'jawaban').trim();
    var mimeType = String(params.mimeType || 'application/pdf').trim();

    if (!idSiswa || !idMapel || !pertemuanKe) {
      return { success: false, message: 'idSiswa, idMapel, dan pertemuanKe wajib diisi.' };
    }

    if (!fileBase64) {
      return { success: false, message: 'File jawaban wajib diunggah.' };
    }

    var hasil = uploadFileToDrive_(fileBase64, namaFile, mimeType, 'JawabanSiswa_' + idMapel);
    var fileUrl = hasil.url;
    var fileId = hasil.id;

    if (!fileUrl) {
      return { success: false, message: 'Gagal mengunggah file ke Google Drive.' };
    }

    var idJawaban = 'JWB-' + idSiswa + '-' + idMapel + '-P' + pertemuanKe + '-' + new Date().getTime();
    var now = new Date().toISOString();

    appendRowMapel_('JAWABAN_SISWA', {
      ID_JAWABAN: idJawaban,
      ID_MAPEL: idMapel,
      ID_SISWA: idSiswa,
      NAMA_SISWA: namaSiswa,
      PERTEMUAN_KE: pertemuanKe,
      ID_TUGAS: idTugas,
      FILE_URL: fileUrl,
      FILE_ID: fileId,
      KETERANGAN: keterangan,
      CREATED_AT: now
    });

    return {
      success: true,
      message: 'Jawaban berhasil dikirim.',
      data: { idJawaban: idJawaban, fileUrl: fileUrl, namaFile: namaFile }
    };
  } catch (e) {
    Logger.log('uploadJawabanSiswa_ error: ' + e.message);
    return { success: false, message: 'Gagal mengirim jawaban: ' + e.message };
  }
}

// ==============================================
// ACTION: getJawabanSiswa
// Ambil semua jawaban siswa untuk suatu mapel & pertemuan
// (guru bisa ambil semua, siswa ambil miliknya sendiri)
// ==============================================
function getJawabanSiswa_(params) {
  try {
    var idMapel = String(params.idMapel || '').trim();
    var pertemuanKe = String(params.pertemuanKe || '').trim();
    var idSiswa = String(params.idSiswa || '').trim();

    if (!idMapel) {
      return { success: false, message: 'idMapel wajib diisi.' };
    }

    var semua = getAllDataMapel_('JAWABAN_SISWA');
    var filtered = semua.filter(function(j) {
      if (String(j.ID_MAPEL) !== idMapel) return false;
      if (pertemuanKe && String(j.PERTEMUAN_KE) !== pertemuanKe) return false;
      if (idSiswa && String(j.ID_SISWA) !== idSiswa) return false;
      return true;
    });

    var result = filtered.map(function(j) {
      return {
        idJawaban: j.ID_JAWABAN,
        idMapel: j.ID_MAPEL,
        idSiswa: j.ID_SISWA,
        namaSiswa: j.NAMA_SISWA,
        pertemuanKe: j.PERTEMUAN_KE,
        idTugas: j.ID_TUGAS,
        fileUrl: j.FILE_URL,
        keterangan: j.KETERANGAN,
        createdAt: j.CREATED_AT
      };
    });

    return { success: true, data: result };
  } catch (e) {
    Logger.log('getJawabanSiswa_ error: ' + e.message);
    return { success: false, message: 'Gagal mengambil jawaban: ' + e.message };
  }
}

/**
 * ==============================================
 * TAMBAHKAN KE ROUTER UTAMA (Code.gs / WebApp.gs):
 * Di dalam fungsi doPost() atau switch(action), tambahkan:
 *
 *   case 'uploadTugasMapel':
 *     return ContentService.createTextOutput(JSON.stringify(
 *       uploadTugasMapel_(params)
 *     )).setMimeType(ContentService.MimeType.JSON);
 *
 *   case 'getTugasMapel':
 *     return ContentService.createTextOutput(JSON.stringify(
 *       getTugasMapel_(params)
 *     )).setMimeType(ContentService.MimeType.JSON);
 *
 *   case 'uploadJawabanSiswa':
 *     return ContentService.createTextOutput(JSON.stringify(
 *       uploadJawabanSiswa_(params)
 *     )).setMimeType(ContentService.MimeType.JSON);
 *
 *   case 'getJawabanSiswa':
 *     return ContentService.createTextOutput(JSON.stringify(
 *       getJawabanSiswa_(params)
 *     )).setMimeType(ContentService.MimeType.JSON);
 * ==============================================
 */
