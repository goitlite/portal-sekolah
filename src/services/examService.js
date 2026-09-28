const BASE_URL =
  "https://script.google.com/macros/s/AKfycbyNGdlYFNDpOET7BcJL6jwsJVFiLsYLt57_-B66YIHxa2Il75aPeFFMNEovgauKwnLM/exec";

// ========================================
// AMBIL DATA UJIAN
// ========================================
export async function getExamData() {
  try {
    const response = await fetch(`${BASE_URL}?action=getData`);

    return await response.json();
  } catch (error) {
    return [];
  }
}

// ========================================
// CEK TOKEN
// ========================================
export async function checkToken(kelas, mapel, token) {
  try {
    const params = new URLSearchParams({
      action: "checkToken",
      kelas,
      mapel,
      token,
    });

    const response = await fetch(`${BASE_URL}?${params.toString()}`);

    return await response.json();
  } catch (error) {
    return {
      status: "error",
      message: "Gagal koneksi server",
    };
  }
}
