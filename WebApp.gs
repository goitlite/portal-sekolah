/**
 * WebApp.gs
 * Handler untuk semua request dari aplikasi Next.js
 * Single endpoint: doPost()
 */

/**
 * Main Web App endpoint
 * Semua request harus menggunakan POST method
 * Request harus berisi parameter 'action'
 * 
 * @param {Object} e - Event parameter dari Apps Script
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  try {
    // Parse request body
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const params = payload.params || {};
    
    // Debug log
    log('WebApp Request', { action: action, params: params });
    
    // Handle request berdasarkan action
    let response;
    
    // ============================================
    // AUTH
    // ============================================
    if (action === 'login') {
      response = loginById(params.id);
    }

    // ============================================
    // SUPER ADMIN
    // ============================================
    else if (action === 'getAdminGuru') {
      response = getAdminGuru();
    }

    else if (action === 'addAdminGuru') {
      response = addAdminGuru(params.nama);
    }

    else if (action === 'deleteAdminGuru') {
      response = deleteAdminGuru(params.id);
    }
    
    // ============================================
    // GURU OPERATIONS
    // ============================================
    else if (action === 'getGuru') {
      response = successResponse('Data guru ditemukan', getGuru());
    }
    
    else if (action === 'addGuru') {
      response = addGuru(params);
    }
    
    else if (action === 'editGuru') {
      response = editGuru(params);
    }
    
    else if (action === 'deleteGuru') {
      response = deleteGuru(params);
    }

    // ============================================
    // SISWA OPERATIONS
    // ============================================
    else if (action === 'getSiswa') {
      response = successResponse('Data siswa ditemukan', getSiswa());
    }

    else if (action === 'getSiswaById') {
      const siswa = getSiswaById(params.id);

      if (siswa) {
        response = successResponse('Data siswa ditemukan', siswa);
      } else {
        response = errorResponse('Siswa tidak ditemukan');
      }
    }

    else if (action === 'getSiswaByGuru') {
      response = successResponse(
        'Data siswa ditemukan',
        getSiswaByGuru(params.idGuru)
      );
    }

    else if (action === 'addSiswa') {
      response = addSiswa(params);
    }

    else if (action === 'aktifkanSiswaMagang') {
      response = aktifkanSiswaMagang(params);
    }

    else if (action === 'editSiswa') {
      response = editSiswa(params);
    }

    else if (action === 'deleteSiswa') {
      const idSiswaHapus = params.id || params.idSiswa;
      if (idSiswaHapus && typeof isSiswaAmanDihapusPermanen_ === 'function') {
        if (!isSiswaAmanDihapusPermanen_(idSiswaHapus)) {
          response = errorResponse('Siswa tidak dapat dihapus karena masih digunakan di Wali Kelas, Mapel lain, atau memiliki Guru Pembimbing/Wali.');
        } else {
          response = deleteSiswa(params);
        }
      } else {
        response = deleteSiswa(params);
      }
    }

    // ============================================
    // GURU WALI
    // ============================================
    else if (action === 'getSiswaWali') {
      response = successResponse(
        'Data siswa wali ditemukan',
        getSiswaWali(params.idGuru)
      );
    }

    else if (action === 'getDataSiswaWali') {
      response = successResponse(
        'Data lengkap siswa wali ditemukan',
        getDataSiswaWali(params.idGuru)
      );
    }

    else if (action === 'simpanGuruWaliSiswa') {
      response = simpanGuruWaliSiswa(params);
    }

    else if (action === 'getBiodataSiswa') {
      response = getBiodataSiswa(params.idSiswa);
    }

    else if (action === 'updateBiodataSiswa') {
      Logger.log("=================================");
      Logger.log("UPDATE BIODATA SISWA");
      Logger.log("PARAMS:");
      Logger.log(JSON.stringify(params));

      Logger.log("ID SISWA:");
      Logger.log(params.idSiswa);

      Logger.log("DATA:");
      Logger.log(JSON.stringify(params.data));

      response = updateBiodataSiswa(
        params.idSiswa,
        params.data
      );

      Logger.log("HASIL UPDATE:");
      Logger.log(JSON.stringify(response));
    }

    else if (action === 'hapusSiswaWali') {
      response = hapusSiswaWali(params);
    }

    // ============================================
    // JURNAL GURU WALI
    // ============================================
    else if (action === 'saveJurnalGuruWali') {
      response = saveJurnalGuruWali(params);
    }

    else if (action === 'getJurnalGuruWali') {
      response = getJurnalGuruWali(params.idGuru);
    }

    else if (action === 'getJurnalSiswa') {
      response = getJurnalSiswa(
        params.idGuru,
        params.idSiswa
      );
    }

    else if (action === 'deleteJurnalGuruWali') {
      response = deleteJurnalGuruWali(params);
    }

    // ============================================
    // JURNAL PKL (GURU PEMBIMBING)
    // ============================================
    else if (action === 'saveJurnalPKL') {
      response = saveJurnalPKL(params);
    }

    else if (action === 'getJurnalPKL') {
      response = getJurnalPKL(params.idGuru);
    }

    else if (action === 'deleteJurnalPKL') {
      response = deleteJurnalPKL(params);
    }

    // ============================================
    // PRESENSI OPERATIONS
    // ============================================
    else if (action === 'savePresensi') {
      response = savePresensi(params);
    }
    
    else if (action === 'getRiwayatSiswa') {
      const riwayat = getRiwayatSiswa(params.idSiswa, params.limit);
      response = successResponse('Riwayat presensi ditemukan', riwayat);
    }
    
    else if (action === 'getPresensiGuru') {
      const presensi = getPresensiGuru(params.idGuru, params.limit);
      response = successResponse('Presensi guru ditemukan', presensi);
    }
    
    else if (action === 'getPresensiHariIni') {
      const presensi = getPresensiHariIni(params.idGuru);
      response = successResponse('Presensi hari ini ditemukan', presensi);
    }
    
    else if (action === 'rekapGuru') {
      response = rekapGuru(params.idGuru, params.bulan);
    }
    
    else if (action === 'getStatistikSiswa') {
      response = getStatistikSiswa(params.idSiswa);
    }

    // ============================================
    // MONITORING OPERATIONS
    // ============================================
    else if (action === 'saveMonitoring') {
      response = saveMonitoring(params);
    }

    else if (action === 'getMonitoringGuru') {
      response = successResponse(
        'Data monitoring ditemukan',
        getMonitoringGuru(params.idGuru, params.limit)
      );
    }

    else if (action === 'getMonitoringTerbaru') {
      response = successResponse(
        'Monitoring terbaru ditemukan',
        getMonitoringTerbaru(params.idGuru, params.limit)
      );
    }

    else if (action === 'getStatistikMonitoring') {
      response = getStatistikMonitoring(params.idGuru);
    }

    else if (action === "getAktivitasGuru") {
      response = successResponse(
        "Aktivitas ditemukan",
        getAktivitasGuru(params.idGuru)
      );
    }

    // ============================================
    // REKAP KEHADIRAN
    // ============================================
    else if (action === "getRekapGuru") {
      response = successResponse(
        "Rekap berhasil",
        getRekapGuru(
          params.idGuru,
          params.bulan
        )
      );
    }

    else if (action === "getRekapSemua") {
      response = successResponse(
        "Rekap berhasil",
        getRekapSemua(
          params.bulan,
          params.tempat,
          params.idGuru
        )
      );
    }
    
    // ============================================
    // UPLOAD PHOTO
    // ============================================
    else if (action === 'uploadPhoto') {
      response = uploadPhoto(params.base64Data, params.fileName, params.mimeType);
    }
    
    else if (action === 'uploadPhotoFromUrl') {
      response = uploadPhotoFromUrl(params.imageUrl, params.fileName);
    }
    
    // ============================================
    // TEMPAT MAGANG
    // ============================================
    else if (action === "getTempatMagangGuru") {
      response = successResponse(
        "Data tempat magang",
        getTempatMagangGuru(params.idGuru)
      );
    }

    else if (action === "getSemuaTempatMagang") {
      response = successResponse(
        "Data semua tempat magang",
        getSemuaTempatMagang()
      );
    }

    // ============================================
    // PESAN KEPALA SEKOLAH <-> GURU
    // ============================================
    else if (action === 'pesanKirim') {
      response = pesanKirim(params);
    }
 
    else if (action === 'pesanGet') {
      response = pesanGet(params.idGuru);
    }
 
    else if (action === 'pesanGetDaftar') {
      response = pesanGetDaftar();
    }
 
    else if (action === 'pesanTandaiDibaca') {
      response = pesanTandaiDibaca(params);
    }
 
    else if (action === 'pesanGetJumlahBaru') {
      response = pesanGetJumlahBaru(params);
    }

    else if (action === 'pesanKirimMassal') {
      response = pesanKirimMassal(params);
    }

    // ============================================
    // GURU MAPEL
    // ============================================
    else if (action === 'getMapelByGuru') {
      response = successResponse(
        'Data mapel ditemukan',
        getMapelByGuru(params.idGuru)
      );
    }

    else if (action === 'addMapel') {
      response = addMapel(params);
    }

    else if (action === 'editMapel') {
      response = editMapel(params);
    }

    else if (action === 'deleteMapel') {
      response = deleteMapel(params);
    }

    else if (action === 'getKelasSiswaMapel') {
      response = successResponse(
        'Daftar kelas ditemukan',
        getKelasSiswaMapel()
      );
    }

    else if (action === 'getSiswaByKelasMapel') {
      response = successResponse(
        'Data siswa per kelas ditemukan',
        getSiswaByKelasMapel(params.kelas)
      );
    }

    else if (action === 'getSiswaMapel') {
      response = successResponse(
        'Data siswa mapel ditemukan',
        getSiswaMapel(params.idGuru, params.idMapel)
      );
    }

    else if (action === 'simpanSiswaMapel') {
      response = simpanSiswaMapel(params);
    }

    else if (action === 'hapusSiswaMapel') {
      response = hapusSiswaMapel(params);
    }

    else if (action === 'getSemuaSiswaUntukTambahMapel') {
      response = successResponse(
        'Daftar siswa untuk ditambahkan ditemukan',
        getSemuaSiswaUntukTambahMapel(params.idGuru, params.idMapel)
      );
    }

    else if (action === 'getPresensiMapelGrid') {
      response = successResponse(
        'Data grid presensi mapel ditemukan',
        getPresensiMapelGrid(params.idGuru, params.idMapel)
      );
    }

    else if (action === 'savePresensiMapel') {
      response = savePresensiMapel(params);
    }

    else if (action === 'hapusPertemuanMapel') {
      response = hapusPertemuanMapel(params);
    }

    else if (action === 'saveJurnalMapel') {
      response = saveJurnalMapel(params);
    }

    else if (action === 'getJurnalMapel') {
      response = successResponse(
        'Data jurnal mapel ditemukan',
        getJurnalMapel(params.idGuru, params.idMapel)
      );
    }

    // ============================================
    // MAPEL ONLINE (TUGAS GURU & JAWABAN SISWA)
    // ============================================
    else if (action === 'uploadTugasMapel') {
      response = uploadTugasMapel_(params);
    }

    else if (action === 'getTugasMapel') {
      response = getTugasMapel_(params);
    }

    else if (action === 'uploadJawabanSiswa') {
      response = uploadJawabanSiswa_(params);
    }

    else if (action === 'getJawabanSiswa') {
      response = getJawabanSiswa_(params);
    }

    // ============================================
    // GURU WALI KELAS (Presensi Harian + Jurnal)
    // ============================================
    else if (action === 'getWaliKelasByGuru') {
      response = getWaliKelasByGuru(params.idGuru);
    }

    else if (action === 'addWaliKelas') {
      response = addWaliKelas(params);
    }

    else if (action === 'editWaliKelas') {
      response = editWaliKelas(params);
    }

    else if (action === 'deleteWaliKelas') {
      response = deleteWaliKelas(params);
    }

    else if (action === 'getSiswaWaliKelas') {
      response = getSiswaWaliKelas(params.idGuru, params.idWali);
    }

    else if (action === 'simpanSiswaWaliKelas') {
      response = simpanSiswaWaliKelas(params);
    }

    else if (action === 'hapusSiswaWaliKelas') {
      response = hapusSiswaWaliKelas(params);
    }

    else if (action === 'getSemuaSiswaUntukTambahWali') {
      response = getSemuaSiswaUntukTambahWali(params.idGuru, params.idWali);
    }

    else if (action === 'sinkronSiswaWaliKelas') {
      response = sinkronSiswaWaliKelas(params);
    }

    else if (action === 'getPresensiWaliGrid') {
      response = getPresensiWaliGrid(params.idGuru, params.idWali);
    }

    else if (action === 'savePresensiWaliKelas') {
      response = savePresensiWaliKelas(params);
    }

    else if (action === 'saveJurnalWaliKelas') {
      response = saveJurnalWaliKelas(params);
    }

    else if (action === 'getJurnalWaliKelas') {
      response = getJurnalWaliKelas(params.idGuru, params.idWali);
    }

    // ============================================
    // DASHBOARD KEPALA SEKOLAH (Agregator Lintas Guru)
    // ============================================
    else if (action && action.indexOf('Kepsek') !== -1) {
      return handleKepsekAction_(action, params);
    }

    // ============================================
    // UNKNOWN ACTION
    // ============================================
    else {
      response = errorResponse('Action tidak dikenali: ' + action);
    }
    
    // Return response
    return ContentService.createTextOutput(JSON.stringify(response))
      .setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    const errorResponse = {
      success: false,
      message: 'Server error: ' + error.message
    };
    
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GET request handler (optional, untuk testing)
 * @param {Object} e - Event parameter
 * @returns {TextOutput} JSON response
 */
function doGet(e) {
  const response = {
    success: true,
    message: 'Sistem Presensi Magang Online - Backend API',
    status: 'running',
    version: '1.0.0',
    endpoint: 'POST',
    info: 'Kirim request POST dengan parameter action dan params dalam JSON format',
    available_actions: [
      'login',
      'getAdminGuru', 'addAdminGuru', 'deleteAdminGuru',
      'getGuru', 'addGuru', 'editGuru', 'deleteGuru',
      'getSiswa', 'getSiswaByGuru', 'addSiswa', 'aktifkanSiswaMagang','editSiswa', 'deleteSiswa',
      'getSiswaWali', 'getDataSiswaWali', 'getBiodataSiswa', 'updateBiodataSiswa',
      'saveJurnalGuruWali', 'getJurnalGuruWali', 'getJurnalSiswa', 'deleteJurnalGuruWali', 
      'savePresensi', 'getRiwayatSiswa', 'getPresensiGuru', 'getPresensiHariIni', 'rekapGuru', 'getStatistikSiswa',
      'saveMonitoring','getMonitoringGuru','getMonitoringTerbaru','getStatistikMonitoring',
      'uploadPhoto', 'uploadPhotoFromUrl',
      'getMapelByGuru', 'addMapel', 'editMapel', 'deleteMapel',
      'getKelasSiswaMapel', 'getSiswaByKelasMapel', 'getSiswaMapel', 'simpanSiswaMapel', 'hapusSiswaMapel',
      'getSemuaSiswaUntukTambahMapel', 'getPresensiMapelGrid', 'savePresensiMapel', 'hapusPertemuanMapel', 'saveJurnalMapel', 'getJurnalMapel',
      'uploadTugasMapel', 'getTugasMapel', 'uploadJawabanSiswa', 'getJawabanSiswa',
      'getWaliKelasByGuru', 'addWaliKelas', 'editWaliKelas', 'deleteWaliKelas',
      'getSiswaWaliKelas', 'simpanSiswaWaliKelas', 'hapusSiswaWaliKelas', 'getSemuaSiswaUntukTambahWali',
      'sinkronSiswaWaliKelas', 'getPresensiWaliGrid', 'savePresensiWaliKelas', 'saveJurnalWaliKelas', 'getJurnalWaliKelas',
      'saveJurnalPKL', 'getJurnalPKL', 'deleteJurnalPKL'
    ]
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fungsi untuk deploy Web App
 * Jalankan ini sekali untuk mendapatkan deployment URL
 */
function deployWebApp() {
  const scriptId = ScriptApp.getScriptId();
  Logger.log('Script ID: ' + scriptId);
  Logger.log('Deploy ke: https://script.google.com/macros/d/' + scriptId + '/usercache_DEPLOYMENT_ID/execute');
  Logger.log('Catatan: Perlu deploy manual dari Apps Script Editor');
}

// ============================================
// HELPER: TEST REQUESTS
// ============================================

/**
 * Test fungsi login
 */
function testLogin() {
  const result = loginById('TJKTADMIN2026');
  Logger.log('Login test: ' + JSON.stringify(result));
}

/**
 * Test generate ID
 */
function testGenerateId() {
  const id1 = generateRandomId();
  const id2 = generateRandomId();
  Logger.log('Generated ID 1: ' + id1);
  Logger.log('Generated ID 2: ' + id2);
}

/**
 * Test get all guru
 */
function testGetGuru() {
  const guru = getGuru();
  Logger.log('All guru: ' + JSON.stringify(guru));
}

/**
 * Test get all siswa
 */
function testGetSiswa() {
  const siswa = getSiswa();
  Logger.log('All siswa: ' + JSON.stringify(siswa));
}

/**
 * Test doPost dengan simulasi
 */
function testDoPost() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'login',
        params: {
          id: 'TJKTADMIN2026'
        }
      })
    }
  };
  
  const result = doPost(mockEvent);
  Logger.log('doPost test result: ' + result.getContent());
}

function testDoPostGuruWali() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        action: 'getDataSiswaWali',
        params: {
          idGuru: '888888'
        }
      })
    }
  };

  const result = doPost(mockEvent);

  Logger.log(
    '========== TEST API GURU WALI =========='
  );

  Logger.log(
    result.getContent()
  );
}
