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

export async function resetPelanggaranSiswa({ id_siswa, nama, kelas, id_guru, pin_admin }) {
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

export async function resetDeviceSiswa({ id_siswa, nama, kelas, id_guru, pin_admin }) {
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


export async function kirimPesanUjian({ kelas, nama, pesan, id_guru, pin_admin }) {
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
