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
// EDIT SISWA
// ==========================================

export async function editSiswa(data) {
  return request("editSiswa", data);
}

// ==========================================
// HAPUS SISWA
// ==========================================

export async function deleteSiswa(idSiswa) {
  return request("deleteSiswa", {
    idSiswa,
  });
}

// ==========================================
// GET DATA GURU
// ==========================================

export async function getGuru() {
  return request("getGuru");
}
