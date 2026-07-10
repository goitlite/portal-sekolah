// ==========================================
// API Presensi Magang
// ==========================================

export const API_URL =
  "https://script.google.com/macros/s/AKfycbwL6gJ9rVKps7EmqKO0o928iwbFlqk-xQDY4za0PcIPh0f-kkRTyu5XCavvZ-9bsZA/exec";

/**
 * Login menggunakan ID
 */
export async function login(id) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },

      body: JSON.stringify({
        action: "login",

        params: {
          id: id,
        },
      }),
    });

    return await response.json();
  } catch (err) {
    console.error(err);

    return {
      success: false,
      message: "Tidak dapat terhubung ke server.",
    };
  }
}
