/**
 * Login.gs
 * Fungsi autentikasi dan login dengan cache optimization & session token
 */

/**
 * Login dengan ID
 * Pengecekan urutan: Admin -> Kepsek -> Guru -> Siswa
 * @param {string} id - ID yang digunakan untuk login
 * @returns {Object} JSON response dengan status, role, data, dan token sesi
 */
function loginById(id) {
  // Validasi input
  if (isEmpty(id)) {
    return errorResponse('ID tidak boleh kosong');
  }
  
  var userData = null;

  // Cek Admin (hardcode)
  if (id === ADMIN_ID) {
    userData = {
      role: 'admin',
      id: id,
      nama: 'Administrator'
    };
  }
  // Cek Kepala Sekolah
  else if (typeof KEPSEK_ID !== 'undefined' && id === KEPSEK_ID) {
    userData = {
      role: 'kepsek',
      id: id,
      nama: typeof KEPSEK_NAMA !== 'undefined' ? KEPSEK_NAMA : 'Kepala SMKN 1 Teluk Kuantan'
    };
  }
  // Cek Guru & Siswa
  else {
    const guru = findDataByColumn(SHEETS.ADMIN_GURU, COLUMNS.ADMIN_GURU.ID, id);
    if (guru) {
      userData = {
        role: 'guru',
        id: guru[COLUMNS.ADMIN_GURU.ID],
        nama: guru[COLUMNS.ADMIN_GURU.NAMA_GURU]
      };
    } else {
      const siswa = findDataByColumn(SHEETS.SISWA, COLUMNS.SISWA.ID, id);
      if (siswa) {
        userData = {
          role: 'siswa',
          id: siswa[COLUMNS.SISWA.ID],
          nama: siswa[COLUMNS.SISWA.NAMA],
          namaGuru: siswa[COLUMNS.SISWA.NAMA_GURU],
          idGuru: siswa[COLUMNS.SISWA.ID_GURU],
          tempatMagang: siswa[COLUMNS.SISWA.TEMPAT_MAGANG]
        };
      }
    }
  }
  
  // Jika tidak ditemukan
  if (!userData) {
    return errorResponse('ID tidak ditemukan');
  }

  // ============================================
  // TOKEN SESI (UUID) - TTL 6 Jam (21600 detik)
  // Dihitung independen per-user sejak waktu login
  // ============================================
  var token = Utilities.getUuid();
  var sessionPayload = {
    id: userData.id,
    role: userData.role,
    nama: userData.nama,
    loginAt: new Date().getTime()
  };

  CacheService.getScriptCache().put(
    'sess_' + token,
    JSON.stringify(sessionPayload),
    21600
  );

  // Sisipkan token ke dalam userData agar otomatis disimpan oleh frontend
  userData.token = token;

  // Catat riwayat login secara aman (Rolling Buffer maksimal 1000 baris)
  catatRiwayatLogin_(userData.id, userData.nama, userData.role);

  return successResponse('Login berhasil', userData);
}

/**
 * Catat riwayat login ke sheet LOG_LOGIN dengan batasan aman (Rolling Buffer)
 * Otomatis menjaga maksimal 1.000 baris agar Spreadsheet tetap ringan & aman selamanya.
 */
function catatRiwayatLogin_(id, nama, role) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("LOG_LOGIN");
    
    // 1. Buat sheet dan baris header otomatis jika belum ada
    if (!sheet) {
      sheet = ss.insertSheet("LOG_LOGIN");
      sheet.appendRow(["Waktu Login (WIB)", "ID Pengguna", "Nama Pengguna", "Peran / Role"]);
      sheet.setFrozenRows(1);
    }
    
    // 2. Tambahkan baris login baru
    var waktuWIB = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([waktuWIB, "'" + String(id), nama, role]);

    // ============================================
    // 3. PENGAMAN KAPASITAS (ROLLING BUFFER)
    // Maksimal 1.000 baris riwayat terbaru.
    // Jika tembus 1.050 baris, hapus 50 baris terlama (baris paling atas)
    // ============================================
    var MAX_LOG_ROWS = 1000;
    var totalBaris = sheet.getLastRow();
    
    if (totalBaris > MAX_LOG_ROWS + 50) {
      var barisDihapus = totalBaris - MAX_LOG_ROWS;
      sheet.deleteRows(2, barisDihapus); // Hapus dari baris ke-2 (tepat setelah header)
    }
  } catch (err) {
    // Pengaman silent: jangan biarkan pencatatan log mengganggu respon login pengguna
    Logger.log("[catatRiwayatLogin_] Warning: " + err.message);
  }
}

/**
 * Validasi apakah user adalah admin
 */
function isAdmin(id) {
  return id === ADMIN_ID;
}

/**
 * Validasi apakah user adalah kepala sekolah
 */
function isKepsek(id) {
  return typeof KEPSEK_ID !== 'undefined' && id === KEPSEK_ID;
}

/**
 * Validasi apakah user adalah guru
 */
function isGuru(id) {
  const guru = findDataByColumn(SHEETS.ADMIN_GURU, COLUMNS.ADMIN_GURU.ID, id);
  return guru !== null;
}

/**
 * Validasi apakah user adalah siswa
 */
function isSiswa(id) {
  const siswa = findDataByColumn(SHEETS.SISWA, COLUMNS.SISWA.ID, id);
  return siswa !== null;
}

/**
 * Get role dari ID
 */
function getRoleById(id) {
  if (isAdmin(id)) return 'admin';
  if (isKepsek(id)) return 'kepsek';
  if (isGuru(id)) return 'guru';
  if (isSiswa(id)) return 'siswa';
  return null;
}

