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
  
  var cleanId = String(id).trim();

  // Validasi bentuk ID (cegah input aneh/terlalu panjang & kunci cache > 250 karakter)
  if (cleanId.length > 30) {
    return errorResponse('Format ID tidak valid');
  }

  // Rate Limiting (Server-side Throttling via CacheService)
  // Cegah serangan brute-force & enumerasi tebak ID tanpa membebani kuota Sheet
  var cache = CacheService.getScriptCache();

  // 1. Anti-Enumerasi Global (penghambat bot; BUKAN pertahanan utama - pertahanan utama = ID sulit ditebak)
  //    Batas dibuat longgar (100 gagal/60 detik) agar jam sibuk (salah ketik massal) tidak
  //    mengunci siswa yang benar. ID yang sudah sukses login dalam 6 jam terakhir ('known_')
  //    tetap boleh masuk saat server sedang dalam mode terkunci, sehingga serangan tidak
  //    bisa memblokir pengguna yang sedang aktif.
  var GLOBAL_FAIL_LIMIT = 100;
  var globalFailKey = 'login_fail_global';
  var globalFails = parseInt(cache.get(globalFailKey) || '0', 10);
  if (globalFails >= GLOBAL_FAIL_LIMIT && cache.get('known_' + cleanId) !== '1') {
    return errorResponse('Terlalu banyak percobaan login gagal di server. Silakan tunggu 1 menit lalu coba lagi.');
  }

  // 2. Proteksi Per-ID (Kunci ID jika 5 kali salah berturut-turut)
  var failKey = 'login_fail_' + cleanId;
  var failCount = parseInt(cache.get(failKey) || '0', 10);
  if (failCount >= 5) {
    return errorResponse('Terlalu banyak percobaan login gagal untuk ID ini. Akun dikunci sementara selama 15 menit demi keamanan.');
  }

  var userData = null;

  // Cegah login admin lewat form ID biasa (wajib melalui verifikasi PIN khusus)
  if ((typeof ADMIN_ID !== 'undefined' && cleanId === ADMIN_ID) || cleanId === 'TJKTADMIN2026') {
    return errorResponse('Akun Administrator hanya dapat diakses melalui verifikasi PIN khusus di Panel Admin.');
  }

  // Cek Kepala Sekolah
  if (typeof KEPSEK_ID !== 'undefined' && cleanId === KEPSEK_ID) {
    userData = {
      role: 'kepsek',
      id: cleanId,
      nama: typeof KEPSEK_NAMA !== 'undefined' ? KEPSEK_NAMA : 'Kepala SMKN 1 Teluk Kuantan'
    };
  }
  // Cek Guru & Siswa
  else {
    const guru = findDataByColumn(SHEETS.ADMIN_GURU, COLUMNS.ADMIN_GURU.ID, cleanId);
    if (guru) {
      userData = {
        role: 'guru',
        id: guru[COLUMNS.ADMIN_GURU.ID],
        nama: guru[COLUMNS.ADMIN_GURU.NAMA_GURU]
      };
    } else {
      const siswa = findDataByColumn(SHEETS.SISWA, COLUMNS.SISWA.ID, cleanId);
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
    failCount++;
    cache.put(failKey, String(failCount), 900); // Kunci hitungan per-ID selama 15 menit

    globalFails++;
    cache.put(globalFailKey, String(globalFails), 60); // Window bot enumerasi 60 detik

    var sisa = 5 - failCount;
    var msg = 'ID tidak ditemukan';
    if (sisa > 0 && sisa <= 2) {
      msg += ' (' + sisa + ' percobaan tersisa sebelum dikunci)';
    }
    return errorResponse(msg);
  }

  // Bersihkan catatan kegagalan jika login sukses
  cache.remove(failKey);

  // Tandai ID ini sebagai 'dikenal' (boleh login ulang saat mode terkunci global)
  cache.put('known_' + cleanId, '1', 21600);

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
 * Login khusus Administrator menggunakan PIN
 * @param {string} pin - PIN admin
 * @returns {Object} JSON response dengan status, role, dan token sesi admin
 */
function adminLogin(pin) {
  // PIN WAJIB diatur di Project Settings > Script Properties (nama: ADMIN_PIN).
  // Tidak ada lagi PIN cadangan di dalam kode: jika belum diatur, login admin ditolak.
  var ADMIN_PIN = PropertiesService.getScriptProperties().getProperty("ADMIN_PIN");
  if (isEmpty(ADMIN_PIN) || String(ADMIN_PIN).trim().length < 6) {
    Logger.log("[adminLogin] ADMIN_PIN belum diatur di Script Properties (minimal 6 karakter).");
    return errorResponse("Login administrator belum dikonfigurasi di server. Hubungi pengelola sistem.");
  }
  var cache = CacheService.getScriptCache();
  var failKey = 'admin_login_fail';
  var failCount = parseInt(cache.get(failKey) || '0', 10);

  if (failCount >= 5) {
    return errorResponse("Terlalu banyak percobaan PIN Admin gagal. Akses dikunci sementara selama 15 menit demi keamanan.");
  }

  if (isEmpty(pin) || !samaAman_(String(pin).trim(), String(ADMIN_PIN).trim())) {
    failCount++;
    cache.put(failKey, String(failCount), 900); // 15 menit
    return errorResponse("Kode PIN Administrator salah!");
  }

  // Bersihkan kegagalan jika PIN benar
  cache.remove(failKey);
  
  var token = Utilities.getUuid();
  var sessionPayload = {
    id: "ADMIN_PORTAL",
    role: "admin",
    nama: "Administrator",
    loginAt: new Date().getTime()
  };
  
  CacheService.getScriptCache().put(
    'sess_' + token,
    JSON.stringify(sessionPayload),
    21600
  );
  
  catatRiwayatLogin_(sessionPayload.id, sessionPayload.nama, sessionPayload.role);
  
  return successResponse("Login administrator berhasil", {
    role: "admin",
    id: "ADMIN_PORTAL",
    nama: "Administrator",
    token: token
  });
}

/**
 * Perbandingan string tanpa berhenti di karakter pertama yang berbeda
 * (constant-time comparison — mencegah timing attack pada PIN admin)
 */
function samaAman_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
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
