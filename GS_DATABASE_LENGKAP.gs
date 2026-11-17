// =====================================================
// SMKN 1 TELUK KUANTAN - EXAM SYSTEM BACKEND (DATABASE GS)
// VERSI TERINTEGRASI: SINKRONISASI AUDIT GOOGLE FORM (KOLOM L, M, N)
// Struktur Kolom Sheet database:
// A=nama, B=kelas, C=id_siswa, D=wa, E=isi_pengaduan, F=waktu_update, G=pesan, H=Banyak Pelanggaran
// I=device_id, J=mapel_aktif, K=status_sesi
// L=Nama Form Dropdown, M=Nilai Form, N=Ket Nilai
// =====================================================

const SPREADSHEET_ID = "1O7mZWHny3f-MJa5WpejEKDL29VgFmUlyofabyZ5Iy2o";
const SHEET_NAME = "database";
const PORTAL_AUTH_URL = "https://script.google.com/macros/s/AKfycbwL6gJ9rVKps7EmqKO0o928iwbFlqk-xQDY4za0PcIPh0f-kkRTyu5XCavvZ-9bsZA/exec";

// KUNCI RAHASIA AKSES GURU (Wajib cocok dengan GURU_KEY di Next.js .env.local)
const GURU_KEY = "SMKN1TELKU_GURU_ASESMEN_SECURE_2026";

const LOG_SHEET_NAME = "LOG_SESI";
const LOG_HEADER = ["waktu", "id_siswa", "nama", "kelas", "mapel", "device_id"];
const LOG_MAX_PER_SISWA = 60;
const LOG_DEDUPE_MS = 2 * 60 * 1000;

function ambilSheetLog(ss, buatJikaTidakAda) {
  let log = ss.getSheetByName(LOG_SHEET_NAME);
  if (!log && buatJikaTidakAda) {
    log = ss.insertSheet(LOG_SHEET_NAME);
    log.appendRow(LOG_HEADER);
    log.setFrozenRows(1);
    PropertiesService.getScriptProperties().setProperty("LOG_SESI_MULAI", new Date().toISOString());
  }
  return log;
}

function catatLogSesi(ss, nama, kelas, idSiswa, mapel, deviceId) {
  try {
    const mapelStr = String(mapel || "").trim();
    if (!mapelStr) return;
    const log = ambilSheetLog(ss, true);
    const idK = idSiswa && String(idSiswa).trim() !== "-" ? String(idSiswa).trim() : "";
    const namaK = String(nama || "").trim().toLowerCase();
    const devK = String(deviceId || "").trim();
    const nowMs = Date.now();
    const last = log.getLastRow();

    if (last > 1) {
      const start = Math.max(2, last - 299);
      const rows = log.getRange(start, 1, last - start + 1, 6).getValues();
      for (let i = rows.length - 1; i >= 0; i--) {
        const rId = String(rows[i][1] || "").trim();
        const rNama = String(rows[i][2] || "").trim().toLowerCase();
        const sama = idK ? rId === idK : (namaK && rNama === namaK);
        if (
          sama &&
          String(rows[i][4] || "").trim().toLowerCase() === mapelStr.toLowerCase() &&
          String(rows[i][5] || "").trim() === devK
        ) {
          const logMs =
            rows[i][0] instanceof Date
              ? rows[i][0].getTime()
              : new Date(rows[i][0]).getTime();
          if (logMs > 0 && nowMs >= logMs && nowMs - logMs < LOG_DEDUPE_MS) {
            return;
          }
        }
      }
    }
    log.appendRow([new Date(), idK || "-", String(nama || "").trim(), String(kelas || "").trim(), mapelStr, devK]);
  } catch (e) {}
}

function bacaLogSesi(ss) {
  try {
    const log = ambilSheetLog(ss, true);
    const last = log.getLastRow();
    const peta = {};
    if (last > 1) {
      const rows = log.getRange(2, 1, last - 1, 6).getValues();
      rows.forEach(function (r) {
        const id = String(r[1] || "").trim();
        const nama = String(r[2] || "").trim().toLowerCase();
        const kelas = String(r[3] || "").trim().toLowerCase();
        const kunci = id && id !== "-" ? "id:" + id : "nk:" + nama + "|" + kelas;
        const waktu = r[0] instanceof Date ? r[0].toISOString() : String(r[0] || "");
        if (!peta[kunci]) peta[kunci] = [];
        peta[kunci].push({ mapel: String(r[4] || "").trim(), waktu: waktu, device: String(r[5] || "").trim() });
      });
      Object.keys(peta).forEach(function (k) {
        if (peta[k].length > LOG_MAX_PER_SISWA) peta[k] = peta[k].slice(-LOG_MAX_PER_SISWA);
      });
    }
    return peta;
  } catch (e) {
    return null;
  }
}

// =====================================================
// MAIN ROUTER
// =====================================================
function doGet(e) { return doPost(e); }

function doPost(e) {
  try {
    const params = e.parameter || {};
    const action = (params.action || "").trim();

    if (action === "register") {
      return handleRegister(params);
    } 
    else if (action === "pengaduan") {
      return handlePengaduan(params);
    }
    else if (action === "cek_pesan") {
      return handleCekPesan(params);
    }
    else if (action === "hapus_akun") {
      return handleHapusAkun(params);
    }
    else if (action === "catat_pelanggaran") {
      return handleCatatPelanggaran(params);
    }
    else if (action === "get_pelanggaran") {
      return handleGetPelanggaran(params);
    }
    else if (action === "kunci_sesi_ujian") {
      return handleKunciSesiUjian(params);
    }
    else if (action === "android_kunci_sesi_ujian") {
      return handleAndroidKunciSesiUjian(params);
    }
    // --- AUDIT FORM: data respon dibaca portal dari sheet_respon_url ---
    else if (action === "guru_sync_form_audit") {
      return handleGuruSyncFormAudit(params);
    }
    // --- AKSI GURU LAINNYA ---
    else if (action === "guru_get_semua_siswa") {
      return handleGuruGetSemuaSiswa(params);
    }
    else if (action === "guru_reset_pelanggaran") {
      return handleGuruResetPelanggaran(params);
    }
    else if (action === "guru_reset_device") {
      return handleGuruResetDevice(params);
    }
    else if (action === "guru_kirim_pesan") {
      return handleGuruKirimPesan(params);
    }
    else if (action === "guru_hapus_pesan") {
      return handleGuruHapusPesan(params);
    }
    else if (action === "guru_hapus_akun") {
      return handleGuruHapusAkun(params);
    }
    else {
      return responseJSON({ status: "error", message: "Action tidak dikenal: " + action });
    }
  } catch (error) {
    return responseJSON({ status: "error", message: error.toString() });
  }
}

function verifikasiGuruKey(params) {
  const key = (params.guru_key || "").trim();
  return key === GURU_KEY;
}

// =====================================================
// 0. KUNCI SESI PERANGKAT UJIAN (1 NAMA 1 HP - ANTI JOKI)
// =====================================================
function handleAndroidKunciSesiUjian(params) {
  const portalToken = String(params.portal_token || "").trim();
  const requestedId = String(params.id_siswa || "").trim();
  const deviceId = String(params.device_id || "").trim();
  const mapel = String(params.mapel || "").trim();

  if (!portalToken || !requestedId || !deviceId || !mapel) {
    return responseJSON({
      status: "error",
      code: "INVALID_REQUEST",
      message: "Sesi, ID siswa, perangkat, atau mata pelajaran tidak lengkap."
    });
  }

  let portalSession;
  try {
    const response = UrlFetchApp.fetch(PORTAL_AUTH_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        action: "validateSession",
        token: portalToken
      }),
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      return responseJSON({
        status: "error",
        code: "AUTH_HTTP_ERROR",
        message: "Portal tidak dapat memverifikasi sesi (HTTP " + response.getResponseCode() + ")."
      });
    }

    let result = JSON.parse(response.getContentText());
    if (
      !result.success &&
      /^Action tidak dikenali:\s*validateSession$/i.test(String(result.message || "").trim())
    ) {
      const loginResponse = UrlFetchApp.fetch(PORTAL_AUTH_URL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          action: "login",
          params: { id: requestedId }
        }),
        muteHttpExceptions: true
      });

      if (loginResponse.getResponseCode() !== 200) {
        return responseJSON({
          status: "error",
          code: "AUTH_HTTP_ERROR",
          message: "Portal tidak dapat memverifikasi akun (HTTP " + loginResponse.getResponseCode() + ")."
        });
      }
      result = JSON.parse(loginResponse.getContentText());
    }

    if (!result.success || !result.data) {
      return responseJSON({
        status: "error",
        code: result.tokenExpired ? "AUTH_EXPIRED" : "AUTH_INVALID",
        message: result.message || "Sesi Portal tidak valid. Silakan login kembali."
      });
    }
    portalSession = result.data;
  } catch (err) {
    Logger.log("Gagal memverifikasi sesi Portal untuk kunci Android: " + (err && err.stack ? err.stack : err));
    return responseJSON({
      status: "error",
      code: "AUTH_UNAVAILABLE",
      message: "Tidak dapat memverifikasi sesi Portal. Periksa koneksi lalu coba lagi."
    });
  }

  const sessionId = String(portalSession.id || "").trim();
  if (portalSession.role !== "siswa" || sessionId !== requestedId) {
    return responseJSON({
      status: "error",
      code: "AUTH_INVALID",
      message: "Sesi Portal tidak cocok dengan akun siswa ini."
    });
  }

  const rawNama = String(portalSession.nama || "").trim();
  const namaMatch = rawNama.match(/^(.*?)\s*\[([^\]]+)\]\s*$/);
  const nama = namaMatch ? namaMatch[1].trim() : rawNama;
  const kelas = String(portalSession.kelas || (namaMatch ? namaMatch[2] : "")).trim();
  if (!nama || !kelas) {
    return responseJSON({
      status: "error",
      code: "PROFILE_INCOMPLETE",
      message: "Nama atau kelas belum terdaftar dengan lengkap. Hubungi guru."
    });
  }

  return handleKunciSesiUjian({
    id_siswa: sessionId,
    nama: nama,
    kelas: kelas,
    mapel: mapel,
    device_id: deviceId,
    require_id_match: true,
    source: "portal"
  });
}

function handleKunciSesiUjian(params) {
  const nama = (params.nama || "").trim().toLowerCase();
  const kelas = (params.kelas || "").trim().toLowerCase();
  const idSiswa = (params.id_siswa || "").trim();
  const mapel = (params.mapel || "").trim();
  const deviceId = (params.device_id || "").trim();
  const requireIdMatch = params.require_id_match === true ||
    String(params.require_id_match || "").trim().toLowerCase() === "true";

  if ((!nama && !idSiswa) || (requireIdMatch && !idSiswa) || !deviceId || !mapel) {
    return responseJSON({
      status: "error",
      code: "INVALID_REQUEST",
      message: "Identitas siswa, perangkat, atau mata pelajaran tidak lengkap."
    });
  }

  const scriptLock = LockService.getScriptLock();
  try {
    scriptLock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let rowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      let rNama = String(data[i][0] || "").trim().toLowerCase();
      let rKelas = String(data[i][1] || "").trim().toLowerCase();
      let rId = String(data[i][2] || "").trim();

      const matchesId = idSiswa && idSiswa !== "-" && rId === idSiswa;
      const matchesLegacyIdentity = !requireIdMatch && nama && kelas && rNama === nama && rKelas === kelas;
      if (matchesId || matchesLegacyIdentity) {
        rowIndex = i + 1;

        let existingDevId = String(data[i][8] || "").trim();
        let statusSesi    = String(data[i][10] || "").trim().toUpperCase();

        if (statusSesi === "AKTIF" && existingDevId && deviceId && existingDevId !== deviceId) {
          return responseJSON({
            status: "error",
            message: "AKSES DITOLAK!\n\nNama (" + (data[i][0] || nama) + ") sudah terdaftar aktif ujian di perangkat lain.\n\nMinta Guru/Admin untuk mereset kunci HP Anda."
          });
        }
        break;
      }
    }

    if (rowIndex !== -1) {
      if (!data[rowIndex - 1][0] && params.nama) {
        sheet.getRange(rowIndex, 1).setValue(params.nama.trim().toUpperCase());
      }
      if (!data[rowIndex - 1][1] && params.kelas) {
        sheet.getRange(rowIndex, 2).setValue(params.kelas.trim().toUpperCase());
      }
      if (deviceId) sheet.getRange(rowIndex, 9).setValue(deviceId);
      if (mapel) sheet.getRange(rowIndex, 10).setValue(mapel);
      sheet.getRange(rowIndex, 11).setValue("AKTIF");
      sheet.getRange(rowIndex, 6).setValue(new Date());
      catatLogSesi(ss, data[rowIndex - 1][0] || params.nama, data[rowIndex - 1][1] || params.kelas,
                   data[rowIndex - 1][2] || idSiswa, mapel, deviceId);
      return responseJSON({ status: "success", message: "Sesi perangkat berhasil dikunci" });
    }

    // ===============================================================
    // PENGECUALIAN UNTUK PORTAL:
    // Jika siswa masuk lewat Portal (isPortal), otomatis izinkan masuk
    // dan buatkan baris baru jika akun baru saja dihapus / belum ada di sheet.
    // ===============================================================
    const isPortal = (params.source === "portal" || params.portal === "true");
    if (isPortal) {
      sheet.appendRow([
        params.nama ? params.nama.trim().toUpperCase() : "-",
        params.kelas ? params.kelas.trim().toUpperCase() : "-",
        idSiswa || "-",
        "-",
        "",
        new Date(),
        "",
        "0",
        deviceId,
        mapel,
        "AKTIF"
      ]);
      catatLogSesi(ss, params.nama, params.kelas, idSiswa, mapel, deviceId);
      return responseJSON({ status: "success", message: "Sesi perangkat portal berhasil dibuat dan dikunci" });
    }

    // UNTUK ANDROID NATIVE: Tolak jika ID tidak terdaftar di database
    return responseJSON({
      status: "error",
      message: "AKSES DITOLAK!\n\nIdentitas siswa (" + (params.nama || idSiswa) + ") tidak terdaftar di database sekolah.\nSilahkan registrasi dengan ID resmi Anda terlebih dahulu."
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  } finally {
    if (scriptLock.hasLock()) scriptLock.releaseLock();
  }
}

// =====================================================
// 1. CATAT PELANGGARAN
// =====================================================
function handleCatatPelanggaran(params) {
  const nama = (params.nama || "").trim().toLowerCase();
  const kelas = (params.kelas || "").trim().toLowerCase();
  const idSiswa = (params.id_siswa || "").trim();
  const pelanggaran = String(params.pelanggaran || "0").trim();

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < data.length; i++) {
      let rowNama = String(data[i][0] || "").trim().toLowerCase();
      let rowKelas = String(data[i][1] || "").trim().toLowerCase();
      let rowId = String(data[i][2] || "").trim();

      if ((idSiswa && idSiswa !== "-" && rowId === idSiswa) ||
          (nama && kelas && rowNama === nama && rowKelas === kelas)) {
        sheet.getRange(i + 1, 8).setValue(pelanggaran);
        sheet.getRange(i + 1, 6).setValue(new Date());
        updated = true;
        break;
      }
    }

    if (!updated && (nama || idSiswa)) {
      sheet.appendRow([
        params.nama ? params.nama.trim().toUpperCase() : "-",
        params.kelas ? params.kelas.trim().toUpperCase() : "-",
        idSiswa || "-",
        "-",
        "",
        new Date(),
        "",
        pelanggaran
      ]);
      updated = true;
    }

    return responseJSON({
      status: "success",
      message: updated ? "Pelanggaran berhasil dicatat" : "Data siswa tidak ditemukan"
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

// =====================================================
// 2. GET PELANGGARAN
// =====================================================
function handleGetPelanggaran(params) {
  const nama = (params.nama || "").trim().toLowerCase();
  const kelas = (params.kelas || "").trim().toLowerCase();
  const idSiswa = (params.id_siswa || "").trim();

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let jmlPelanggaran = 0;

    for (let i = 1; i < data.length; i++) {
      let rowNama = String(data[i][0] || "").trim().toLowerCase();
      let rowKelas = String(data[i][1] || "").trim().toLowerCase();
      let rowId = String(data[i][2] || "").trim();

      if ((idSiswa && idSiswa !== "-" && rowId === idSiswa) ||
          (nama && kelas && rowNama === nama && rowKelas === kelas)) {
        jmlPelanggaran = parseInt(data[i][7]) || 0;
        break;
      }
    }

    return responseJSON({ status: "success", pelanggaran: jmlPelanggaran });
  } catch (err) {
    return responseJSON({ status: "success", pelanggaran: 0 });
  }
}

// =====================================================
// 3. REGISTER SISWA (KUNCI ID MUTLAK UNTUK ANDROID NATIVE)
// =====================================================
function handleRegister(params) {
  const nama = (params.nama || params.nama_siswa || "").trim();
  const kelas = (params.kelas || "").trim();
  const idSiswa = (params.wa_siswa || params.id_siswa || params.id || params.nisn || "").trim();
  const wa_ortu = (params.wa_ortu || "-").trim();
  const isPortal = (params.source === "portal" || params.portal === "true");

  if (!nama || !kelas || !idSiswa) {
    return responseJSON({ status: "ERROR", message: "Field tidak lengkap" });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  let row = -1;

  // 1. CARI BERDASARKAN ID DI KOLOM C (KOLOM 3) - MUTLAK!
  for (let i = 1; i < data.length; i++) {
    let idSheet = (data[i][2] || "").toString().trim();
    if (idSheet && (idSheet === idSiswa || (!isNaN(idSheet) && !isNaN(idSiswa) && Number(idSheet) === Number(idSiswa)))) {
      row = i;
      break;
    }
  }

  // 2. Fallback khusus portal: jika masuk dari portal, cek kecocokan nama + kelas
  if (row === -1 && isPortal) {
    for (let i = 1; i < data.length; i++) {
      let rNama = (data[i][0] || "").toString().trim().toLowerCase();
      let rKelas = (data[i][1] || "").toString().trim().toLowerCase();
      if (rNama === nama.toLowerCase() && (!kelas || rKelas === kelas.toLowerCase())) {
        row = i;
        break;
      }
    }
  }

  // JIKA TIDAK DITEMUKAN:
  if (row === -1) {
    // PENGECUALIAN UNTUK PORTAL:
    // Portal otomatis membuat baris baru agar siswa portal selalu otomatis masuk
    if (isPortal) {
      sheet.appendRow([
        nama.toUpperCase(),
        kelas.toUpperCase(),
        idSiswa,
        wa_ortu,
        "",
        new Date(),
        "",
        "0"
      ]);
      return responseJSON({
        status: "SUCCESS",
        Status: "SUCCESS",
        message: "Registrasi portal berhasil",
        nama: nama.toUpperCase(),
        kelas: kelas.toUpperCase(),
        id_siswa: idSiswa
      });
    }

    // UNTUK ANDROID NATIVE: ID WAJIB SUDAH ADA DI SPREADSHEET DATABASE!
    // JIKA TIDAK DITEMUKAN: DITOLAK KERAS! DILARANG appendRow!
    return responseJSON({
      status: "ERROR",
      message: "REGISTRASI DITOLAK!\n\nID Siswa (" + idSiswa + ") tidak terdaftar di database sekolah.\nSilahkan pastikan ID benar atau hubungi Admin/Guru."
    });
  }

  // JIKA DITEMUKAN: Update baris ID tersebut dengan data pendaftar
  sheet.getRange(row + 1, 1).setValue(nama.toUpperCase());
  sheet.getRange(row + 1, 2).setValue(kelas.toUpperCase());
  sheet.getRange(row + 1, 3).setValue(idSiswa);
  sheet.getRange(row + 1, 4).setValue(wa_ortu);
  sheet.getRange(row + 1, 6).setValue(new Date());

  return responseJSON({
    status: "SUCCESS",
    Status: "SUCCESS",
    message: "Registrasi berhasil",
    nama: nama.toUpperCase(),
    kelas: kelas.toUpperCase(),
    id_siswa: idSiswa
  });
}

// =====================================================
// 4. PENGADUAN
// =====================================================
function handlePengaduan(params) {
  const nama = (params.nama || "").trim().toLowerCase();
  const kelas = (params.kelas || "").trim().toLowerCase();
  const isi = (params.isi_pengaduan || "").trim();

  if (!nama || !kelas || !isi) {
    return responseJSON({ status: "error", message: "Nama, kelas, atau isi kosong" });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    let namaSheet = (data[i][0] || "").toString().trim().toLowerCase();
    let kelasSheet = (data[i][1] || "").toString().trim().toLowerCase();

    if (namaSheet === nama && kelasSheet === kelas) {
      let lastTime = data[i][5] ? new Date(data[i][5]) : null;
      let now = new Date();

      if (lastTime) {
        let diff = (now - lastTime) / (1000 * 60);
        if (diff < 3) {
          let sisaDetik = Math.ceil((3 - diff) * 60);
          return responseJSON({ status: "error", message: "Tunggu " + sisaDetik + " detik lagi" });
        }
      }

      sheet.getRange(i + 1, 5).setValue(isi);
      sheet.getRange(i + 1, 6).setValue(new Date());

      return responseJSON({ status: "success", message: "Pengaduan berhasil dikirim" });
    }
  }

  sheet.appendRow([nama.toUpperCase(), kelas.toUpperCase(), "-", "-", isi, new Date(), "", "0"]);
  return responseJSON({ status: "success", message: "Pengaduan tersimpan" });
}

// =====================================================
// 5. CEK PESAN UJIAN
// =====================================================
function handleCekPesan(params) {
  const nama = (params.nama || "").trim().toLowerCase();
  const kelas = (params.kelas || "").trim().toLowerCase();

  if (!nama || !kelas) {
    return responseJSON({ status: "success", pesan: "", pelanggaran: 0 });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    let pesanExact = "", pesanLain = "", maxPel = 0;
    for (let i = 1; i < data.length; i++) {
      let namaSheet = (data[i][0] || "").toString().trim().toLowerCase();
      if (namaSheet !== nama) continue;
      let kelasSheet = (data[i][1] || "").toString().trim().toLowerCase();
      let p = (data[i][6] || "").toString().trim();
      let v = parseInt(data[i][7]) || 0;
      if (v > maxPel) maxPel = v;
      if (p) {
        if (kelasSheet === kelas) { if (!pesanExact) pesanExact = p; }
        else if (!pesanLain) pesanLain = p;
      }
    }
    return responseJSON({ status: "success", pesan: pesanExact || pesanLain, pelanggaran: maxPel });
  } catch (error) {
    return responseJSON({ status: "success", pesan: "", pelanggaran: 0 });
  }
}

// =====================================================
// 6. HAPUS AKUN (KHUSUS ANDROID NATIVE & GURU: MENYISAKAN HANYA ID)
// =====================================================
function handleHapusAkun(params) {
  const idSiswa = (params.id_siswa || params.wa_siswa || params.id || params.nisn || "").trim();
  const nama = (params.nama || params.nama_siswa || "").trim().toLowerCase();
  const kelas = (params.kelas || "").trim().toLowerCase();

  if (!idSiswa && !nama) {
    return responseJSON({ status: "error", Status: "ERROR", message: "Identitas siswa tidak lengkap" });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let row = -1;
    let targetId = "";

    for (let i = 1; i < data.length; i++) {
      let rNama = String(data[i][0] || "").trim().toLowerCase();
      let rKelas = String(data[i][1] || "").trim().toLowerCase();
      let idSheet = String(data[i][2] || "").trim();

      const idCocok = idSiswa && idSiswa !== "-" && (idSheet === idSiswa || (!isNaN(idSheet) && !isNaN(idSiswa) && Number(idSheet) === Number(idSiswa)));
      const namaCocok = nama && rNama === nama && (!kelas || rKelas === kelas);

      // Utamakan pencocokan ID
      if (idCocok || (namaCocok && !idSiswa)) {
        row = i;
        targetId = idSheet || idSiswa;
        break;
      }
    }

    if (row === -1) {
      return responseJSON({ status: "error", Status: "ERROR", message: "Data baris siswa tidak ditemukan di database" });
    }

    // ===============================================================
    // ATURAN MUTLAK ANDROID NATIVE:
    // DILARANG MENGHAPUS TOTAL BARIS (DILARANG deleteRow)!
    // KOSONGKAN SELURUH DATA ATAS NAMA SISWA INI, TETAPI HANYA MENYISAKAN ID DI KOLOM C!
    // ===============================================================
    const totalKolom = Math.max(14, sheet.getLastColumn());

    // 1. Kosongkan Kolom A (Nama) dan Kolom B (Kelas)
    sheet.getRange(row + 1, 1, 1, 2).setValues([["", ""]]);

    // 2. Pastikan Kolom C tetap berisi targetId (HANYA ID YANG BERTAHAN!)
    if (targetId) {
      sheet.getRange(row + 1, 3).setValue(targetId);
    }

    // 3. Kosongkan Kolom D (4) sampai kolom terakhir (N / Kolom 14 dst)
    if (totalKolom >= 4) {
      const kosong = [];
      for (let c = 4; c <= totalKolom; c++) {
        kosong.push("");
      }
      sheet.getRange(row + 1, 4, 1, kosong.length).setValues([kosong]);
    }

    SpreadsheetApp.flush();

    return responseJSON({
      status: "success",
      Status: "SUCCESS",
      message: "Akun siswa (" + (params.nama || idSiswa) + ") berhasil direset! Nama & data dihapus total, hanya ID (" + targetId + ") yang tetap dipertahankan di database.",
      id_siswa: targetId
    });
  } catch (err) {
    return responseJSON({ status: "error", Status: "ERROR", message: err.toString() });
  }
}

// =====================================================
// 7. GURU/ADMIN: AMBIL SEMUA SISWA + KOLOM L, M, N (BARU)
// =====================================================
function handleGuruGetSemuaSiswa(params) {
  if (!verifikasiGuruKey(params)) {
    return responseJSON({ status: "error", message: "Akses ditolak (kunci tidak valid)" });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const result = [];
    const logPeta = bacaLogSesi(ss);
    const logMulai = PropertiesService.getScriptProperties().getProperty("LOG_SESI_MULAI") || "";

    for (let i = 1; i < data.length; i++) {
      const nama = String(data[i][0] || "").trim();
      const kelas = String(data[i][1] || "").trim();
      const idSiswa = String(data[i][2] || "").trim();
      const wa = String(data[i][3] || "").trim();
      const pengaduan = String(data[i][4] || "").trim();
      const waktuUpdate = data[i][5] ? String(data[i][5]) : "";
      const pesan = String(data[i][6] || "").trim();
      const pelanggaran = parseInt(data[i][7]) || 0;
      const deviceId = String(data[i][8] || "").trim();     // Kolom I
      const mapelAktif = String(data[i][9] || "").trim();   // Kolom J
      const statusSesi = String(data[i][10] || "").trim();  // Kolom K

      // ✨ MEMBACA KOLOM L, M, N TANPA MERUSAK STRUKTUR LAMA
      const namaFormDropdown = String(data[i][11] || "").trim(); // Kolom L (12)
      const nilaiForm        = String(data[i][12] || "").trim(); // Kolom M (13)
      const ketNilai         = String(data[i][13] || "").trim(); // Kolom N (14)

      if (nama || kelas || idSiswa) {
        const item = {
          nama,
          kelas,
          id_siswa: idSiswa,
          wa,
          pengaduan,
          waktu_update: waktuUpdate,
          pesan,
          pelanggaran,
          device_id: deviceId,
          mapel_aktif: mapelAktif,
          status_sesi: statusSesi,
          nama_form_dropdown: namaFormDropdown,
          nilai_form: nilaiForm,
          ket_nilai: ketNilai,
          rowIndex: i + 1
        };
        if (logPeta) {
          const kunci = idSiswa && idSiswa !== "-" ? "id:" + idSiswa : "nk:" + nama.toLowerCase() + "|" + kelas.toLowerCase();
          item.riwayat_sesi = logPeta[kunci] || [];
          item.log_mulai = logMulai;
        }
        result.push(item);
      }
    }

    return responseJSON({ status: "success", data: result });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString(), data: [] });
  }
}

// =====================================================
// 7a. SINKRONKAN RINGKASAN AUDIT GOOGLE FORM KE KOLOM L, M, N
// =====================================================
function handleGuruSyncFormAudit(params) {
  if (!verifikasiGuruKey(params)) {
    return responseJSON({ status: "error", message: "Akses ditolak" });
  }

  const kelasTarget = String(params.kelas || "").trim().toLowerCase();
  const mapelTarget = String(params.mapel || "").trim();
  let payload;
  try {
    payload = JSON.parse(params.payload || "{}");
  } catch (err) {
    return responseJSON({
      status: "error",
      message: "Payload audit Form tidak valid: " + err.toString(),
    });
  }

  const siswa = payload && Array.isArray(payload.siswa) ? payload.siswa : null;
  if (!kelasTarget || !mapelTarget || !siswa || siswa.length > 500) {
    return responseJSON({
      status: "error",
      message: "Kelas, mapel, atau daftar siswa audit tidak valid",
    });
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet database tidak ditemukan");

    const maxColumns = sheet.getMaxColumns();
    if (maxColumns < 14) {
      sheet.insertColumnsAfter(maxColumns, 14 - maxColumns);
    }

    const header = ["Nama Form Dropdown", "Nilai Form", "Ket Nilai"];
    const currentHeader = sheet.getRange(1, 12, 1, 3).getValues()[0];
    if (header.some(function (value, i) {
      return currentHeader[i] !== value;
    })) {
      sheet.getRange(1, 12, 1, 3).setValues([header]);
    }

    const data = sheet.getDataRange().getValues();
    const updates = [];
    const tidakDitemukan = [];
    const barisTerpakai = new Set();

    siswa.forEach(function (item) {
      if (!item || typeof item !== "object") {
        tidakDitemukan.push("(baris payload tidak valid)");
        return;
      }

      const idSiswa = String(item.id_siswa || "").trim();
      const nama = String(item.nama || "").trim().toLowerCase();
      const kelas = String(item.kelas || "").trim().toLowerCase();
      if (
        (kelasTarget !== "semua" && kelas !== kelasTarget) ||
        (!idSiswa && !nama)
      ) {
        tidakDitemukan.push(idSiswa || nama || "(identitas kosong)");
        return;
      }

      const cocok = [];
      for (let i = 1; i < data.length; i++) {
        const rowId = String(data[i][2] || "").trim();
        const rowNama = String(data[i][0] || "").trim().toLowerCase();
        const rowKelas = String(data[i][1] || "").trim().toLowerCase();
        const match = idSiswa && idSiswa !== "-"
          ? rowId === idSiswa && rowKelas === kelas
          : rowNama === nama && rowKelas === kelas;
        if (match) cocok.push(i + 1);
      }

      if (cocok.length !== 1 || barisTerpakai.has(cocok[0])) {
        tidakDitemukan.push(
          idSiswa || (nama + " (" + kelas + ")") +
            (cocok.length > 1 || barisTerpakai.has(cocok[0])
              ? " (data ganda)"
              : ""),
        );
        return;
      }

      barisTerpakai.add(cocok[0]);
      updates.push({
        row: cocok[0],
        values: [
          String(item.nama_form_dropdown || ""),
          String(item.nilai_form || ""),
          String(item.ket_nilai || ("BELUM UJIAN | " + mapelTarget)),
        ],
      });
    });

    updates.sort(function (a, b) {
      return a.row - b.row;
    });
    let start = 0;
    while (start < updates.length) {
      let end = start + 1;
      while (
        end < updates.length &&
        updates[end].row === updates[end - 1].row + 1
      ) {
        end++;
      }
      const values = updates.slice(start, end).map(function (update) {
        return update.values;
      });
      sheet.getRange(updates[start].row, 12, values.length, 3).setValues(values);
      start = end;
    }

    SpreadsheetApp.flush();
    return responseJSON({
      status: "success",
      message: "Ringkasan audit Form berhasil disinkronkan",
      updated: updates.length,
      tidakDitemukan: tidakDitemukan,
      mapel: mapelTarget,
      catatan: "Kolom L-N adalah ringkasan kelas/mapel terakhir yang disinkronkan.",
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

// =====================================================
// 8. GURU/ADMIN: RESET PELANGGARAN
// =====================================================
function handleGuruResetPelanggaran(params) {
  if (!verifikasiGuruKey(params)) {
    return responseJSON({ status: "error", message: "Akses ditolak" });
  }

  const idSiswa = (params.id_siswa || "").trim();
  const kelas = (params.kelas || "").trim().toUpperCase();
  const nama = (params.nama || "").trim().toLowerCase();

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let count = 0;

    for (let i = 1; i < data.length; i++) {
      let rNama = String(data[i][0] || "").trim().toLowerCase();
      let rKelas = String(data[i][1] || "").trim().toUpperCase();
      let rId = String(data[i][2] || "").trim();

      let match = false;
      if (idSiswa && idSiswa !== "-" && rId === idSiswa) {
        match = true;
      } else if (nama && kelas && rNama === nama && rKelas === kelas) {
        match = true;
      } else if (!idSiswa && !nama && kelas && (kelas === "SEMUA" || rKelas === kelas)) {
        match = true;
      }

      if (match) {
        sheet.getRange(i + 1, 8).setValue("0");
        sheet.getRange(i + 1, 6).setValue(new Date());
        count++;
        if (idSiswa || (nama && kelas)) break;
      }
    }

    return responseJSON({
      status: "success",
      message: "Berhasil mereset " + count + " pelanggaran siswa",
      count: count
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

// =====================================================
// 9. GURU/ADMIN: RESET KUNCI PERANGKAT HP
// =====================================================
function handleGuruResetDevice(params) {
  if (!verifikasiGuruKey(params)) {
    return responseJSON({ status: "error", message: "Akses ditolak" });
  }

  const idSiswa = (params.id_siswa || "").trim();
  const kelas = (params.kelas || "").trim().toUpperCase();
  const nama = (params.nama || "").trim().toLowerCase();

  const scriptLock = LockService.getScriptLock();
  try {
    scriptLock.waitLock(10000);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let updated = false;

    for (let i = 1; i < data.length; i++) {
      let rNama = String(data[i][0] || "").trim().toLowerCase();
      let rKelas = String(data[i][1] || "").trim().toUpperCase();
      let rId = String(data[i][2] || "").trim();

      let match = false;
      if (idSiswa && idSiswa !== "-" && rId === idSiswa) {
        match = true;
      } else if (nama && kelas && rNama === nama && rKelas === kelas) {
        match = true;
      }

      if (match) {
        sheet.getRange(i + 1, 9).setValue("");
        sheet.getRange(i + 1, 10).setValue("");
        sheet.getRange(i + 1, 11).setValue("RESET");
        sheet.getRange(i + 1, 6).setValue(new Date());
        updated = true;
        break;
      }
    }

    return responseJSON({
      status: updated ? "success" : "error",
      message: updated
        ? "Perangkat siswa (" + (params.nama || idSiswa) + ") berhasil direset. Siswa dapat login dari HP baru."
        : "Data siswa tidak ditemukan."
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  } finally {
    if (scriptLock.hasLock()) scriptLock.releaseLock();
  }
}

// =====================================================
// 10. GURU/ADMIN: KIRIM PESAN
// =====================================================
function handleGuruKirimPesan(params) {
  if (!verifikasiGuruKey(params)) {
    return responseJSON({ status: "error", message: "Akses ditolak" });
  }

  const kelas = (params.kelas || "").trim().toUpperCase();
  const nama = (params.nama || "").trim().toLowerCase();
  const pesan = (params.pesan || "").trim();

  if (!pesan) {
    return responseJSON({ status: "error", message: "Isi pesan tidak boleh kosong" });
  }

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let count = 0;

    for (let i = 1; i < data.length; i++) {
      let rNama = String(data[i][0] || "").trim().toLowerCase();
      let rKelas = String(data[i][1] || "").trim().toUpperCase();

      let match = false;
      if (nama && rNama === nama && (!kelas || rKelas === kelas)) {
        match = true;
      } else if (!nama && kelas && (kelas === "SEMUA" || rKelas === kelas)) {
        match = true;
      }

      if (match) {
        sheet.getRange(i + 1, 7).setValue(pesan);
        sheet.getRange(i + 1, 6).setValue(new Date());
        count++;
      }
    }

    return responseJSON({
      status: "success",
      message: "Pesan terkirim ke " + count + " siswa",
      count: count
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

// =====================================================
// 11. GURU/ADMIN: HAPUS PESAN
// =====================================================
function handleGuruHapusPesan(params) {
  if (!verifikasiGuruKey(params)) {
    return responseJSON({ status: "error", message: "Akses ditolak" });
  }

  const kelas = (params.kelas || "").trim().toUpperCase();
  const nama = (params.nama || "").trim().toLowerCase();

  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    let count = 0;

    for (let i = 1; i < data.length; i++) {
      let rNama = String(data[i][0] || "").trim().toLowerCase();
      let rKelas = String(data[i][1] || "").trim().toUpperCase();

      let match = false;
      if (nama && rNama === nama && (!kelas || rKelas === kelas)) {
        match = true;
      } else if (!nama && kelas && (kelas === "SEMUA" || rKelas === kelas)) {
        match = true;
      }

      if (match) {
        sheet.getRange(i + 1, 7).setValue("");
        sheet.getRange(i + 1, 6).setValue(new Date());
        count++;
      }
    }

    return responseJSON({
      status: "success",
      message: "Pesan dibersihkan untuk " + count + " siswa",
      count: count
    });
  } catch (err) {
    return responseJSON({ status: "error", message: err.toString() });
  }
}

// =====================================================
// 12. GURU/ADMIN: HAPUS TOTAL BARIS SISWA
// =====================================================
function handleGuruHapusAkun(params) {
  if (!verifikasiGuruKey(params)) {
    return responseJSON({ status: "error", message: "Akses ditolak" });
  }
  return handleHapusAkun(params);
}

// =====================================================
// RESPONSE JSON HELPER
// =====================================================
function responseJSON(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}