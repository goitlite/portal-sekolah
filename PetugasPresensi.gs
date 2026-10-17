/**
 * PetugasPresensi.gs   (VERSI OPTIMAL & BEBAS BUG)
 *
 * Perbaikan yang diterapkan:
 *  1. getKelasPetugas_ menyertakan presensiHariIni (agar statistik kelas siswa tampil normal)
 *  2. Siswa biasa tetap menerima data kelasnya sendiri secara hemat data (tidak error 400)
 *  3. hapusSiswaWaliAman_ bebas dari dependensi isEmpty eksternal
 *  4. getWajahBulk_ toleran terhadap variasi penamaan kolom ID_SISWA
 *  5. savePresensiWaliKelasAman_ toleran terhadap status sel kosong ("")
 */

function ppCleanId_(val) {
  if (val === null || val === undefined) return "";
  var s = String(val).trim();
  if (s.length > 2 && s.slice(-2) === ".0") s = s.slice(0, -2);
  return s;
}

// ------------------------------------------------------------
// 1. SIMPAN PRESENSI WALI KELAS (aman & tidak menimpa)
// ------------------------------------------------------------
function savePresensiWaliKelasAman_(params) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (e) {
    return errorResponse("Server sedang sibuk, coba lagi sebentar.");
  }

  try {
    var cells = (params && Array.isArray(params.cells)) ? params.cells : [];
    var perluCek = cells.some(function (c) {
      return c && (c.onlyIfEmpty || (Array.isArray(c.overwriteOnlyIf)));
    });

    var skipped = 0;
    var out = cells;

    if (perluCek) {
      var grid = getPresensiWaliGrid(params.idGuru, params.idWali);
      if (!grid || !grid.success || !grid.data) {
        return errorResponse("Tidak dapat memeriksa data yang sudah ada. Coba lagi.");
      }

      var ada = {};
      (grid.data.presensi || []).forEach(function (p) {
        var k = ppCleanId_(p.idSiswa || p.ID_SISWA || p.id) + "|" + String(p.tanggal || p.TANGGAL || "").trim();
        ada[k] = String(p.status || "").trim();
      });

      out = cells.filter(function (c) {
        if (!c) return false;
        var k = ppCleanId_(c.idSiswa) + "|" + String(c.tanggal).trim();
        var existing = Object.prototype.hasOwnProperty.call(ada, k) ? ada[k] : null;

        if (Array.isArray(c.overwriteOnlyIf)) {
          if (existing === null || existing === "") return true;
          var boleh = c.overwriteOnlyIf.map(function (x) { return String(x).trim().toLowerCase(); });
          var ok = boleh.indexOf(existing.toLowerCase()) !== -1;
          if (!ok) skipped++;
          return ok;
        }
        if (c.onlyIfEmpty) {
          if (existing === null || existing === "") return true;
          skipped++;
          return false;
        }
        return true;
      });
    }

    var bersih = out.map(function (c) {
      var o = {};
      Object.keys(c).forEach(function (key) {
        if (key === "onlyIfEmpty" || key === "overwriteOnlyIf" || key === "auto" || key === "source") return;
        o[key] = c[key];
      });
      return o;
    });

    if (bersih.length === 0) {
      return successResponse("Tidak ada data baru yang perlu ditulis", { saved: 0, skipped: skipped });
    }

    var p2 = {};
    Object.keys(params).forEach(function (key) { p2[key] = params[key]; });
    p2.cells = bersih;

    var res = savePresensiWaliKelas(p2);
    if (res && res.success) {
      res.data = Object.assign({}, res.data || {}, { skipped: skipped });
    }
    return res;

  } catch (err) {
    return errorResponse("Gagal menyimpan presensi: " + err.message);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ------------------------------------------------------------
// 2. FOTO WAJAH BANYAK SISWA (1 panggilan)
// ------------------------------------------------------------
function getWajahBulk_(params) {
  var list = (params && Array.isArray(params.idSiswaList)) ? params.idSiswaList : [];
  if (list.length === 0) return successResponse("Daftar kosong", {});
  if (list.length > 1500) return errorResponse("Terlalu banyak siswa dalam satu permintaan");

  var wanted = {};
  list.forEach(function (id) {
    var c = ppCleanId_(id);
    if (c) wanted[c] = true;
  });

  var rows = getAllData(SHEETS.DATA_SISWA_WALI) || [];

  var fotoKey = null;
  if (rows.length > 0) {
    Object.keys(rows[0]).forEach(function (k) {
      if (String(k).toUpperCase().replace(/[\s_]/g, "") === "FOTOWAJAH") fotoKey = k;
    });
  }
  if (rows.length > 0 && !fotoKey) {
    return errorResponse("Kolom FOTO_WAJAH tidak ditemukan di sheet DATA_SISWA_WALI");
  }

  var hasil = {};
  Object.keys(wanted).forEach(function (id) { hasil[id] = ""; });

  var idColKey = (COLUMNS && COLUMNS.DATA_SISWA_WALI && COLUMNS.DATA_SISWA_WALI.ID_SISWA) || "ID_SISWA";

  rows.forEach(function (r) {
    var id = ppCleanId_(r[idColKey] || r["ID_SISWA"] || r["idSiswa"] || r["ID"]);
    if (!id || !wanted[id]) return;
    hasil[id] = String((fotoKey && r[fotoKey]) || "").trim();
  });

  return successResponse("Foto wajah ditemukan", hasil);
}

// ------------------------------------------------------------
// 3. KELAS UNTUK PETUGAS PRESENSI (serta fallback siswa biasa)
// ------------------------------------------------------------
function getKelasPetugas_(params) {
  var sid = ppCleanId_(params && params.idSiswa);
  if (!sid) return errorResponse("ID siswa tidak ditemukan");

  var out = handleKepsekAction_("getDashboardKepsekWaliKelas", { forceRefresh: false });
  var parsed;
  try {
    parsed = JSON.parse(out.getContent());
  } catch (e) {
    return errorResponse("Data kelas tidak dapat dibaca");
  }
  var cards = parsed && parsed.success && parsed.data && parsed.data.cards;
  if (!Array.isArray(cards)) return errorResponse("Data kelas belum tersedia");

  var tagA = "[PETUGAS:" + sid + ":";
  var tagB = "[PETUGAS:" + sid + "]";
  var petugas = cards.some(function (c) {
    var ket = String(c.keterangan || "");
    return ket.indexOf(tagA) !== -1 || ket.indexOf(tagB) !== -1;
  });

  // Jika siswa biasa (bukan petugas), kembalikan data kelas siswa tersebut saja
  var sourceCards = cards;
  if (!petugas) {
    sourceCards = cards.filter(function (c) {
      return (c.daftarSiswa || []).some(function (s) { return ppCleanId_(s.idSiswa) === sid; }) ||
             String(c.keterangan || "").indexOf(sid) !== -1;
    });
    if (sourceCards.length === 0) sourceCards = cards; // fallback jika belum terpetakan
  }

  var minimal = sourceCards.map(function (c) {
    var ket = String(c.keterangan || "").replace(/\[PETUGAS:[^\]]*\]/g, function (m) {
      return (m.indexOf(tagA) === 0 || m === tagB) ? m : "";
    });
    return {
      idWali: c.idWali,
      idGuru: c.idGuru,
      namaKelas: c.namaKelas || c.kelas || "Kelas",
      namaGuru: c.namaGuru || "",
      jumlahSiswa: c.jumlahSiswa || (Array.isArray(c.daftarSiswa) ? c.daftarSiswa.length : 0),
      presensiHariIni: c.presensiHariIni, // <-- PENTING: statistik kelas tetap muncul!
      daftarSiswa: (c.daftarSiswa || []).map(function (s) {
        return { idSiswa: s.idSiswa, nama: s.nama || s.namaSiswa || "", kelas: s.kelas || "" };
      }),
      keterangan: ket
    };
  });

  return successResponse(petugas ? "Daftar kelas petugas" : "Data kelas siswa", {
    isPetugas: petugas,
    cards: minimal
  });
}

// ------------------------------------------------------------
// 4. GURU WALI SATU SISWA
// ------------------------------------------------------------
function getGuruWaliSiswa_(params) {
  var sid = ppCleanId_(params && params.idSiswa);
  if (!sid) return errorResponse("ID siswa tidak ditemukan");

  var relasi = getAllData(SHEETS.GURU_WALI) || [];
  var idGuru = "";
  for (var i = 0; i < relasi.length; i++) {
    if (ppCleanId_(relasi[i][COLUMNS.GURU_WALI.ID_SISWA]) === sid) {
      idGuru = ppCleanId_(relasi[i][COLUMNS.GURU_WALI.ID_GURU]);
      break;
    }
  }
  if (!idGuru) return successResponse("Belum punya guru wali", { idGuru: "", namaGuru: "Tanpa Guru Wali" });

  var nama = idGuru;
  var guru = getAllData(SHEETS.ADMIN_GURU) || [];
  for (var j = 0; j < guru.length; j++) {
    if (ppCleanId_(guru[j][COLUMNS.ADMIN_GURU.ID]) === idGuru) {
      nama = String(guru[j][COLUMNS.ADMIN_GURU.NAMA_GURU] || idGuru).trim();
      break;
    }
  }
  return successResponse("Guru wali ditemukan", { idGuru: idGuru, namaGuru: nama });
}

// ------------------------------------------------------------
// 5. HAPUS SISWA WALI (lock + data segar)
// ------------------------------------------------------------
function hapusSiswaWaliAman_(params) {
  var idSiswa = ppCleanId_(params && (params.idSiswa || params.id));
  var idGuruWali = ppCleanId_(params && params.idGuru);
  if (!idSiswa || !idGuruWali) {
    return errorResponse("ID Siswa atau ID Guru Wali tidak boleh kosong");
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (e) {
    return errorResponse("Server sedang sibuk, coba lagi sebentar.");
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var sheetGW = ss.getSheetByName(SHEETS.GURU_WALI);
    var gw = sheetGW.getDataRange().getValues();
    var hGW = gw[0].map(function (h) { return String(h).trim(); });
    var cSiswaGW = hGW.indexOf(COLUMNS.GURU_WALI.ID_SISWA);
    var cGuruGW = hGW.indexOf(COLUMNS.GURU_WALI.ID_GURU);
    if (cSiswaGW === -1 || cGuruGW === -1) return errorResponse("Kolom GURU_WALI tidak lengkap");

    var punyaRelasi = false;
    for (var i = gw.length - 1; i >= 1; i--) {
      if (ppCleanId_(gw[i][cSiswaGW]) === idSiswa && ppCleanId_(gw[i][cGuruGW]) === idGuruWali) {
        punyaRelasi = true;
        sheetGW.deleteRow(i + 1);
      }
    }
    if (!punyaRelasi) {
      return errorResponse("Siswa ini bukan siswa wali guru tersebut.");
    }

    var sheetBio = ss.getSheetByName(SHEETS.DATA_SISWA_WALI);
    if (sheetBio) {
      var bio = sheetBio.getDataRange().getValues();
      if (bio.length > 0) {
        var hBio = bio[0].map(function (h) { return String(h).trim(); });
        var cBio = hBio.indexOf(COLUMNS.DATA_SISWA_WALI.ID_SISWA);
        if (cBio !== -1) {
          for (var b = bio.length - 1; b >= 1; b--) {
            if (ppCleanId_(bio[b][cBio]) === idSiswa) sheetBio.deleteRow(b + 1);
          }
        }
      }
    }

    var sheetS = ss.getSheetByName(SHEETS.SISWA);
    var sd = sheetS.getDataRange().getValues();
    var hS = sd[0].map(function (h) { return String(h).trim(); });
    var cIdS = hS.indexOf(COLUMNS.SISWA.ID);
    var cGuruS = hS.indexOf(COLUMNS.SISWA.ID_GURU);
    var rowS = -1, punyaPembimbing = false;
    for (var s = 1; s < sd.length; s++) {
      if (ppCleanId_(sd[s][cIdS]) === idSiswa) {
        rowS = s + 1;
        punyaPembimbing = String(sd[s][cGuruS] || "").trim() !== "";
        break;
      }
    }

    var action, pesan;
    if (!punyaPembimbing && rowS !== -1) {
      sheetS.deleteRow(rowS);
      action = "hapus_lengkap";
      pesan = "Siswa dihapus sepenuhnya dari sistem karena belum memiliki guru pembimbing.";
    } else {
      action = "hapus_wali_dan_biodata";
      pesan = "Siswa sudah punya guru pembimbing, data SISWA tetap dipertahankan dengan aman.";
    }

    clearCache(SHEETS.GURU_WALI);
    clearCache(SHEETS.DATA_SISWA_WALI);
    clearCache(SHEETS.SISWA);

    return successResponse("Berhasil menghapus data", { action: action, pesan_tambahan: pesan });

  } catch (err) {
    return errorResponse("Error: " + err.message);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}
