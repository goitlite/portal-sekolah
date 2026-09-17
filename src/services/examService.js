const BASE_URL =
  "https://script.google.com/macros/s/AKfycbwCSoPrJnmrYxB-MqLufBeDnHFXeWjehMtIAceiwUxpcA00FJQrhp5CCLGDxSouo43v/exec";

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
