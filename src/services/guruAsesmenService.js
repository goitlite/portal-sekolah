// src/services/guruAsesmenService.js
// Client helper untuk mengakses API asesmen internal portal guru

// =====================================================
// 0. VERIFIKASI PIN ADMIN ASESMEN (KODE KHUSUS)
// =====================================================
export async function verifyPinAdminAsesmen(pin) {
  try {
    const res = await fetch("/api/guru/asesmen/verify-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message, isAdmin: false };
  }
}

// =====================================================
// 1. DATA DATABASE SISWA (PELANGGARAN, PESAN, PENGADUAN)
// =====================================================

export async function fetchSemuaSiswaAsesmen() {
  try {
    const res = await fetch("/api/guru/asesmen/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "guru_get_semua_siswa" }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message, data: [] };
  }
}

export async function resetPelanggaranSiswa({
  id_siswa,
  nama,
  kelas,
  id_guru,
  pin_admin,
}) {
  try {
    const res = await fetch("/api/guru/asesmen/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_reset_pelanggaran",
        id_siswa,
        nama,
        kelas,
        id_guru,
        pin_admin,
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

export async function resetDeviceSiswa({
  id_siswa,
  nama,
  kelas,
  id_guru,
  pin_admin,
}) {
  try {
    const res = await fetch("/api/guru/asesmen/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_reset_device",
        id_siswa,
        nama,
        kelas,
        id_guru,
        pin_admin,
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

export async function kirimPesanUjian({
  kelas,
  nama,
  pesan,
  id_guru,
  pin_admin,
}) {
  try {
    const res = await fetch("/api/guru/asesmen/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_kirim_pesan",
        kelas,
        nama: nama || "",
        pesan: pesan || "",
        id_guru,
        pin_admin,
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

export async function hapusPesanUjian({ kelas, nama, id_guru, pin_admin }) {
  try {
    const res = await fetch("/api/guru/asesmen/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_hapus_pesan",
        kelas,
        nama: nama || "",
        id_guru,
        pin_admin,
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

export async function hapusAkunSiswaAsesmen(id_siswa, pin_admin, nama, kelas) {
  try {
    const res = await fetch("/api/guru/asesmen/database", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_hapus_akun",
        id_siswa,
        nama: nama || "",
        kelas: kelas || "",
        pin_admin,
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

// =====================================================
// 2. KELOLA DATA SHEET UJIAN (CRUD TOKEN, LINK, KODEKIRIM)
// =====================================================

export async function fetchDaftarUjian() {
  try {
    const res = await fetch("/api/guru/asesmen/ujian");
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message, data: [] };
  }
}

export async function tambahDataUjian({
  kelas,
  mapel,
  token,
  link,
  kodeKirim,
  id_guru,
  nama_guru,
  pin_admin,
  sheet_respon_url,
  sheetUrl,
}) {
  try {
    const res = await fetch("/api/guru/asesmen/ujian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_tambah_ujian",
        kelas,
        mapel,
        token,
        link,
        kodeKirim,
        id_guru,
        nama_guru,
        pin_admin,
        sheet_respon_url: sheet_respon_url || sheetUrl || "",
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

export async function editDataUjian({
  rowIndex,
  indexRow,
  kelasLama,
  mapelLama,
  kelas,
  mapel,
  token,
  link,
  kodeKirim,
  id_guru,
  nama_guru,
  pin_admin,
  sheet_respon_url,
  sheetUrl,
}) {
  try {
    const res = await fetch("/api/guru/asesmen/ujian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_edit_ujian",
        rowIndex: rowIndex || indexRow,
        kelasLama,
        mapelLama,
        kelas,
        mapel,
        token,
        link,
        kodeKirim,
        id_guru,
        nama_guru,
        pin_admin,
        sheet_respon_url:
          sheet_respon_url !== undefined
            ? sheet_respon_url
            : sheetUrl !== undefined
              ? sheetUrl
              : "",
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

export async function hapusDataUjian({
  rowIndex,
  indexRow,
  kelas,
  mapel,
  id_guru,
  nama_guru,
  pin_admin,
}) {
  try {
    const res = await fetch("/api/guru/asesmen/ujian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_hapus_ujian",
        rowIndex: rowIndex || indexRow,
        kelas,
        mapel,
        id_guru,
        nama_guru,
        pin_admin,
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

/** Sembunyikan / munculkan sesi ujian dari siswa (kolom H sheet UJIAN). tampil: true = terlihat */
export async function aturTampilSesiUjian({
  rowIndex,
  kelas,
  mapel,
  tampil,
  id_guru,
  nama_guru,
  pin_admin,
}) {
  try {
    const res = await fetch("/api/guru/asesmen/ujian", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "guru_set_tampil_ujian",
        rowIndex,
        kelas,
        mapel,
        tampil: tampil ? "true" : "false",
        id_guru,
        nama_guru,
        pin_admin,
      }),
    });
    return await res.json();
  } catch (err) {
    return { status: "error", message: err.message };
  }
}

// =====================================================
// 3. AMBIL REKAP NILAI DARI GOOGLE SHEETS RESPON
// =====================================================
export async function fetchRekapNilaiUjian({
  kelas,
  mapel,
  refresh = false,
} = {}) {
  // Batas waktu 28 dtk agar layar tidak menggantung bila server/Google lambat
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  try {
    const params = new URLSearchParams();
    if (kelas) params.append("kelas", kelas);
    if (mapel) params.append("mapel", mapel);
    if (refresh) params.append("refresh", "true");

    const res = await fetch(`/api/exam/rekap-nilai?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    const json = await res.json();
    // Respon berisi: status, data/responses (array), diagnostics (penyebab bila nilai kosong)
    return json;
  } catch (err) {
    const pesan =
      err?.name === "AbortError"
        ? "Pengambilan nilai terlalu lama (timeout). Coba tekan Refresh."
        : err.message;
    return { status: "error", message: pesan, data: [], responses: [] };
  } finally {
    clearTimeout(timer);
  }
}
