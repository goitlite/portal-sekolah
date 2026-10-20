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

  return successResponse('Login berhasil', userData);
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

