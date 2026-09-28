const BASE_URL =
  "https://script.google.com/macros/s/AKfycbw9dkz277yVbLu8WWSDFdZwUqMbERbnyBOIxuBDalQshowNYIk78ygGC4Nvyk870FVT/exec";

// ===================================================
// REGISTER SISWA
// ===================================================
export async function registerStudent(data) {
  try {
    const formData = new URLSearchParams();

    formData.append("action", "register");
    formData.append("nama", data.nama);
    formData.append("kelas", data.kelas);
    formData.append("wa_siswa", data.wa_siswa || data.id_siswa || "");
    formData.append("wa_ortu", data.wa_ortu || "-");

    const response = await fetch(BASE_URL, {
      method: "POST",
      body: formData,
    });

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      message: "Gagal terhubung server",
    };
  }
}

// ===================================================
// CEK PESAN ADMIN
// ===================================================
export async function cekPesan(nama, kelas) {
  try {
    const formData = new URLSearchParams();

    formData.append("action", "cek_pesan");
    formData.append("nama", nama);
    formData.append("kelas", kelas);

    const response = await fetch(BASE_URL, {
      method: "POST",
      body: formData,
    });

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      pesan: "",
    };
  }
}

// ===================================================
// PENGADUAN SISWA
// ===================================================
export async function kirimPengaduan(nama, kelas, isiPengaduan) {
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "pengaduan",
        nama,
        kelas,
        isi_pengaduan: isiPengaduan,
      }),
    });

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      message: "Gagal kirim pengaduan",
    };
  }
}

// ===================================================
// HAPUS AKUN SISWA
// ===================================================
export async function hapusAkun(idSiswa) {
  try {
    const formData = new URLSearchParams();
    formData.append("action", "hapus_akun");
    formData.append("id_siswa", idSiswa);

    const response = await fetch(BASE_URL, {
      method: "POST",
      body: formData,
    });

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      message: "Gagal hapus akun",
    };
  }
}

// ===================================================
// CATAT PELANGGARAN KE SPREADSHEET DATABASE (KOLOM H)
// ===================================================
export async function catatPelanggaran(
  nama,
  kelas,
  idSiswa,
  jumlahPelanggaran,
) {
  try {
    const formData = new URLSearchParams();
    formData.append("action", "catat_pelanggaran");
    formData.append("nama", nama);
    formData.append("kelas", kelas);
    formData.append("id_siswa", idSiswa || "");
    formData.append("pelanggaran", String(jumlahPelanggaran));

    const response = await fetch(BASE_URL, {
      method: "POST",
      body: formData,
    });

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      message: "Gagal mencatat pelanggaran",
    };
  }
}

// ===================================================
// AMBIL JUMLAH PELANGGARAN DARI DATABASE SPREADSHEET
// ===================================================
export async function getPelanggaran(nama, kelas, idSiswa) {
  try {
    const formData = new URLSearchParams();
    formData.append("action", "get_pelanggaran");
    formData.append("nama", nama);
    formData.append("kelas", kelas);
    formData.append("id_siswa", idSiswa || "");

    const response = await fetch(BASE_URL, {
      method: "POST",
      body: formData,
    });

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      pelanggaran: 0,
    };
  }
}
