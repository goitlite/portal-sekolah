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
// UPLOAD FOTO KE GOOGLE DRIVE (SERBAGUNA)
// ==========================================

export async function uploadPhoto(
  base64Data,
  fileName,
  mimeType = "image/jpeg",
) {
  return request("uploadPhoto", {
    base64Data,
    fileName,
    mimeType,
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

// ==========================================
// SIMPAN / PINDAHKAN SISWA GURU WALI
// ==========================================
// ATURAN:
// 1 ID_SISWA hanya boleh memiliki 1 GURU WALI
// ==========================================

export async function simpanGuruWaliSiswa({ idSiswa, idGuru }) {
  return request("simpanGuruWaliSiswa", {
    idSiswa,
    idGuru,
  });
}

// ==========================================
// BIODATA SISWA
// ==========================================

export async function getBiodataSiswa(idSiswa) {
  return request("getBiodataSiswa", {
    idSiswa,
  });
}

export async function updateBiodataSiswa(data) {
  return request("updateBiodataSiswa", {
    idSiswa: data.idSiswa,

    data: {
      // DATA SISWA
      fotoProfil: data.fotoProfil, // ---> TAMBAHKAN BARIS INI
      noHp: data.noHp,
      tempatLahir: data.tempatLahir,
      tglLahir: data.tglLahir,

      // DATA AYAH
      ayah: data.ayah,
      pekerjaanAyah: data.pekerjaanAyah,
      kontakAyah: data.kontakAyah,

      // DATA IBU
      ibu: data.ibu,
      pekerjaanIbu: data.pekerjaanIbu,
      kontakIbu: data.kontakIbu,

      // DATA PRIBADI
      anakKe: data.anakKe,
      alamat: data.alamat,
      hobi: data.hobi,
      bakatKeahlian: data.bakatKeahlian,
      transportasi: data.transportasi,

      // DATA PELAJARAN
      pelajaranDisukai: data.pelajaranDisukai,
      alasanDisukai: data.alasanDisukai,

      pelajaranTidakDisukai: data.pelajaranTidakDisukai,
      alasanTidakDisukai: data.alasanTidakDisukai,

      // HARAPAN
      harapan: data.harapan,
      ijazahSmp: data.ijazahSmp, // ---> TAMBAHKAN BARIS INI

      // ===================================================
      // CATATAN PERKEMBANGAN MURID (LAMPIRAN B) - TAMBAHAN BARU
      // ===================================================
      periodeAwal: data.periodeAwal,
      periodeAkhir: data.periodeAkhir,

      desAkademik: data.desAkademik,
      tinAkademik: data.tinAkademik,
      ketAkademik: data.ketAkademik,

      desKarakter: data.desKarakter,
      tinKarakter: data.tinKarakter,
      ketKarakter: data.ketKarakter,

      desSosial: data.desSosial,
      tinSosial: data.tinSosial,
      ketSosial: data.ketSosial,

      desDisiplin: data.desDisiplin,
      tinDisiplin: data.tinDisiplin,
      ketDisiplin: data.ketDisiplin,

      desPotensi: data.desPotensi,
      tinPotensi: data.tinPotensi,
      ketPotensi: data.ketPotensi,
    },
  });
}

export async function getSiswa() {
  try {
    const response = await fetch(API_URL, {
      method: "POST", // Menggunakan POST sesuai requirement doPost() di WebApp.gs
      headers: {
        // Gunakan text/plain untuk menghindari preflight CORS error di Google Apps Script
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "getSiswa",
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Gagal mengambil data siswa:", error);
    return { success: false, data: [] };
  }
}

// =========================================================
// API HAPUS SISWA WALI
// =========================================================
// =========================================================
// API HAPUS SISWA WALI
// =========================================================
export async function hapusSiswaWali({ idSiswa, idGuru }) {
  return request("hapusSiswaWali", {
    idSiswa,
    idGuru,
  });
}

// =========================================================
// JURNAL GURU WALI
// =========================================================

// ---------------------------------------------------------
// SIMPAN JURNAL GURU WALI
// ---------------------------------------------------------
// Nama dan kelas TIDAK dikirim dari frontend.
// Apps Script akan mengambilnya berdasarkan ID_SISWA.
// ---------------------------------------------------------

export async function saveJurnalGuruWali(data) {
  return request("saveJurnalGuruWali", {
    idGuru: data.idGuru,
    idSiswa: data.idSiswa,
    idSiswaList: data.idSiswaList, // 🔥 TAMBAHKAN BARIS INI

    tanggal: data.tanggal,

    formatPertemuan: data.formatPertemuan || "Individu",

    topik: data.topik || "",

    tindakLanjut: data.tindakLanjut || "",

    keterangan: data.keterangan || "",

    fotoUrl: data.fotoUrl || "",

    fotoId: data.fotoId || "",
  });
}

// ---------------------------------------------------------
// AMBIL SEMUA JURNAL GURU
// ---------------------------------------------------------

export async function getJurnalGuruWali(idGuru) {
  return request("getJurnalGuruWali", {
    idGuru,
  });
}

// ---------------------------------------------------------
// AMBIL JURNAL SATU SISWA
// ---------------------------------------------------------

export async function getJurnalSiswa(idGuru, idSiswa) {
  return request("getJurnalSiswa", {
    idGuru,
    idSiswa,
  });
}

// ---------------------------------------------------------
// HAPUS JURNAL GURU WALI (satu pertemuan / idJurnal)
// ---------------------------------------------------------

export async function deleteJurnalGuruWali({ idGuru, idJurnal }) {
  return request("deleteJurnalGuruWali", {
    idGuru,
    idJurnal,
  });
}

export async function saveJurnalPKL(data) {
  return request("saveJurnalPKL", {
    idGuru: data.idGuru,
    items: data.items || [],
  });
}

// ---------------------------------------------------------
// AMBIL SEMUA JURNAL PKL MILIK GURU PEMBIMBING
// ---------------------------------------------------------

export async function getJurnalPKL(idGuru) {
  return request("getJurnalPKL", {
    idGuru,
  });
}

/**
 * ====================================================================
 * PATCH FINAL UNTUK src/lib/api.js — FITUR GURU MAPEL (v3)
 * ====================================================================
 * INI VERSI GABUNGAN/FINAL. Abaikan file JS_API_PATCH_MAPEL.txt,
 * JS_API_PATCH_MAPEL_V2.txt, JS_API_PATCH_MAPEL_V3.txt yang lama —
 * cukup pakai file ini saja.
 *
 * CARA PASANG:
 * Tempel seluruh blok di bawah ini ke BAGIAN PALING BAWAH file
 * lib/api.js yang sudah ada (setelah fungsi getJurnalPKL()). Tidak ada
 * satupun fungsi lama yang diubah — murni tambahan.
 * ====================================================================
 */

// ==========================================
// GURU MAPEL
// ==========================================

export async function getMapelByGuru(idGuru) {
  return request("getMapelByGuru", { idGuru });
}

export async function addMapel(data) {
  return request("addMapel", data);
}

export async function editMapel(data) {
  return request("editMapel", data);
}

export async function deleteMapel(data) {
  return request("deleteMapel", data);
}

export async function getKelasSiswaMapel() {
  return request("getKelasSiswaMapel");
}

export async function getSiswaByKelasMapel(kelas) {
  return request("getSiswaByKelasMapel", { kelas });
}

export async function getSiswaMapel(idGuru, idMapel) {
  return request("getSiswaMapel", { idGuru, idMapel });
}

export async function simpanSiswaMapel(data) {
  return request("simpanSiswaMapel", data);
}

export async function hapusSiswaMapel(data) {
  return request("hapusSiswaMapel", data);
}

export async function getSemuaSiswaUntukTambahMapel(idGuru, idMapel) {
  return request("getSemuaSiswaUntukTambahMapel", { idGuru, idMapel });
}

export async function getPresensiMapelGrid(idGuru, idMapel) {
  return request("getPresensiMapelGrid", { idGuru, idMapel });
}

export async function savePresensiMapel(data) {
  return request("savePresensiMapel", {
    idGuru: data.idGuru,
    idMapel: data.idMapel,
    cells: data.cells || [],
  });
}

export async function saveJurnalMapel(data) {
  return request("saveJurnalMapel", {
    idGuru: data.idGuru,
    idMapel: data.idMapel,
    idSiswa: data.idSiswa,
    idSiswaList: data.idSiswaList,
    tanggal: data.tanggal,
    formatPertemuan: data.formatPertemuan || "Individu",
    topik: data.topik || "",
    tindakLanjut: data.tindakLanjut || "",
    keterangan: data.keterangan || "",
    fotoUrl: data.fotoUrl || "",
  });
}

export async function getJurnalMapel(idGuru, idMapel) {
  return request("getJurnalMapel", { idGuru, idMapel });
}

/**
 * ====================================================================
 * GURU WALI KELAS (Presensi Harian + Jurnal Bimbingan)
 * ====================================================================
 * Menggunakan spreadsheet MAPEL_DATA_SMKN1TK yang sama, tapi
 * dengan 4 sheet baru: WALI_KELAS, SISWA_WALI_KELAS,
 * PRESENSI_WALI_KELAS, JURNAL_WALI_KELAS.
 *
 * Constraint eksklusif: 1 siswa hanya boleh 1 Guru Wali Kelas.
 * ====================================================================
 */

// Daftar kelas wali milik guru
export async function getWaliKelasByGuru(idGuru) {
  return request("getWaliKelasByGuru", { idGuru });
}

// Tambah kelas wali baru (+ auto-enroll siswa sekelas)
export async function addWaliKelas(data) {
  return request("addWaliKelas", data);
}

// Edit nama/keterangan kelas wali
export async function editWaliKelas(data) {
  return request("editWaliKelas", data);
}

// Hapus kelas wali + seluruh data terkait
export async function deleteWaliKelas(data) {
  return request("deleteWaliKelas", data);
}

// Daftar siswa terdaftar di kelas wali
export async function getSiswaWaliKelas(idGuru, idWali) {
  return request("getSiswaWaliKelas", { idGuru, idWali });
}

// Tambah 1 siswa ke kelas wali (cek eksklusif)
export async function simpanSiswaWaliKelas(data) {
  return request("simpanSiswaWaliKelas", data);
}

// Hapus siswa dari kelas wali (cascade presensi + jurnal)
export async function hapusSiswaWaliKelas(data) {
  return request("hapusSiswaWaliKelas", data);
}

// List siswa yang bisa ditambahkan (belum punya guru wali kelas lain)
export async function getSemuaSiswaUntukTambahWali(idGuru, idWali) {
  return request("getSemuaSiswaUntukTambahWali", { idGuru, idWali });
}

// Sinkron semua siswa sekelas ke kelas wali (yang belum punya wali lain)
export async function sinkronSiswaWaliKelas(data) {
  return request("sinkronSiswaWaliKelas", data);
}

// Grid presensi per tanggal (key: idSiswa_YYYY-MM-DD)
export async function getPresensiWaliGrid(idGuru, idWali) {
  return request("getPresensiWaliGrid", { idGuru, idWali });
}

// Simpan presensi harian (upsert per siswa+tanggal)
export async function savePresensiWaliKelas(data) {
  return request("savePresensiWaliKelas", {
    idGuru: data.idGuru,
    idWali: data.idWali,
    cells: data.cells || [],
  });
}

// Simpan jurnal bimbingan wali kelas (+ foto)
export async function saveJurnalWaliKelas(data) {
  return request("saveJurnalWaliKelas", {
    idGuru: data.idGuru,
    idWali: data.idWali,
    idSiswa: data.idSiswa,
    idSiswaList: data.idSiswaList,
    tanggal: data.tanggal,
    formatPertemuan: data.formatPertemuan || "Individu",
    topik: data.topik || "",
    tindakLanjut: data.tindakLanjut || "",
    keterangan: data.keterangan || "",
    fotoUrl: data.fotoUrl || "",
  });
}

// Ambil semua jurnal wali kelas per guru (idWali opsional)
export async function getJurnalWaliKelas(idGuru, idWali) {
  return request("getJurnalWaliKelas", { idGuru, idWali: idWali || "" });
}
