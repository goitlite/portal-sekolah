const BASE_URL =
  "https://script.google.com/macros/s/AKfycbwfetob0Q_j8KTVQI-7YVzrgy0ce6RpkslF4o5_u9kTlGSVQN7lmZkDVMtlVxHPaVRm/exec";

// ===================================================
// REGISTER SISWA
// ===================================================
export async function registerStudent(data) {
  try {
    const formData = new URLSearchParams();

    formData.append("action", "register");
    formData.append("nama", data.nama);
    formData.append("kelas", data.kelas);
    formData.append("wa_siswa", data.wa_siswa);
    formData.append("wa_ortu", data.wa_ortu);

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

export async function kirimPengaduan(nama, kelas, isiPengaduan) {
  try {
    const response = await fetch(
      "https://script.google.com/macros/s/AKfycbwfetob0Q_j8KTVQI-7YVzrgy0ce6RpkslF4o5_u9kTlGSVQN7lmZkDVMtlVxHPaVRm/exec",
      {
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
      },
    );

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      message: "Gagal kirim pengaduan",
    };
  }
}
