// ==========================================
// API Presensi Magang Online
// SMKN 1 Teluk Kuantan
// ==========================================

export const API_URL =
  "https://script.google.com/macros/s/AKfycbwL6gJ9rVKps7EmqKO0o928iwbFlqk-xQDY4za0PcIPh0f-kkRTyu5XCavvZ-9bsZA/exec";

// ==========================================
// REQUEST UMUM
// Semua request ke Apps Script lewat sini
// ==========================================

async function request(action, params = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action,
        params,
      }),
    });

    const result = await response.json();

    return result;
  } catch (err) {
    console.error("API ERROR :", err);

    return {
      success: false,
      message: "Tidak dapat terhubung ke server.",
    };
  }
}

// ==========================================
// LOGIN
// ==========================================

export async function login(id) {
  return request("login", {
    id,
  });
}

// ==========================================
// DASHBOARD GURU
// ==========================================

export async function getDashboardGuru(idGuru) {
  return request("rekapGuru", {
    idGuru,
    bulan: "Semua",
  });
}

// ==========================================
// SISWA BERDASARKAN GURU
// ==========================================

export async function getSiswaByGuru(idGuru) {
  return request("getSiswaByGuru", {
    idGuru,
  });
}

// ==========================================
// PRESENSI HARI INI
// ==========================================

export async function getPresensiHariIni(idGuru) {
  return request("getPresensiHariIni", {
    idGuru,
  });
}

// ==========================================
// RIWAYAT SISWA
// ==========================================

export async function getRiwayatSiswa(idSiswa) {
  return request("getRiwayatSiswa", {
    idSiswa,
  });
}

// ==========================================
// STATISTIK SISWA
// ==========================================

export async function getStatistikSiswa(idSiswa) {
  return request("getStatistikSiswa", {
    idSiswa,
  });
}

// ==========================================
// SIMPAN PRESENSI
// ==========================================

export async function savePresensi(data) {
  return request("savePresensi", data);
}

// ==========================================
// TAMBAH SISWA
// ==========================================

export async function addSiswa(data) {
  return request("addSiswa", data);
}

// ==========================================
// AKTIFKAN SISWA MENJADI MAGANG
// ==========================================

export async function aktifkanSiswaMagang(data) {
  return request("aktifkanSiswaMagang", data);
}

// ==========================================
// SEMUA TEMPAT MAGANG
// ==========================================

export async function getSemuaTempatMagang() {
  return request("getSemuaTempatMagang");
}

// ==========================================
// EDIT SISWA
// ==========================================

export async function editSiswa(data) {
  return request("editSiswa", data);
}

// ==========================================
// HAPUS SISWA
// ==========================================

export async function deleteSiswa(id) {
  return request("deleteSiswa", {
    id,
  });
}

// ==========================================
// GET DATA GURU
// ==========================================

export async function getGuru() {
  return request("getGuru");
}

// ==========================================
// GET SISWA BERDASARKAN ID
// ==========================================

export async function getSiswaById(id) {
  return request("getSiswaById", {
    id,
  });
}

// =====================================================
// MONITORING
// =====================================================
export async function getTempatMagangGuru(idGuru) {
  return request("getTempatMagangGuru", {
    idGuru,
  });
}

export async function saveMonitoring(data) {
  return request("saveMonitoring", data);
}

export async function getMonitoringGuru(idGuru, limit = 20) {
  return request("getMonitoringGuru", {
    idGuru,
    limit,
  });
}

export async function getMonitoringTerbaru(idGuru, limit = 5) {
  return request("getMonitoringTerbaru", {
    idGuru,
    limit,
  });
}

export async function getStatistikMonitoring(idGuru) {
  return request("getStatistikMonitoring", {
    idGuru,
  });
}

export async function getAktivitasGuru(idGuru) {
  return request("getAktivitasGuru", {
    idGuru,
  });
}

// ==========================================
// UPLOAD FOTO KE GOOGLE DRIVE
// ==========================================

export async function uploadPhoto(base64Data, fileName) {
  return request("uploadPhoto", {
    base64Data,
    fileName,
    mimeType: "image/jpeg",
  });
}

export async function getRekapGuru(idGuru, bulan) {
  return request("getRekapGuru", {
    idGuru,
    bulan,
  });
}

export function getRekapSemua(bulan, tempat = "", idGuru = "") {
  return request("getRekapSemua", {
    bulan,
    tempat,
    idGuru,
  });
}

// ==========================================
// GURU WALI
// ==========================================

export async function getDataSiswaWali(idGuru) {
  return request("getDataSiswaWali", {
    idGuru,
  });
}
