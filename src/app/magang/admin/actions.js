"use server";

export async function verifikasiPinLogin(inputPin) {
  // PIN wajib diatur di .env.local (PIN_ADMIN_RAHASIA).
  // Harus cocok dengan ADMIN_PIN di GAS Script Properties.
  const PIN_ASLI = process.env.PIN_ADMIN_RAHASIA;
  if (!PIN_ASLI || PIN_ASLI.length < 6) return false; // belum dikonfigurasi = tolak
  return inputPin === PIN_ASLI;
}

export async function verifikasiPinHapus(kodeHapus) {
  // PIN hapus diatur di .env.local (PIN_HAPUS_RAHASIA).
  const PIN_HAPUS = process.env.PIN_HAPUS_RAHASIA;
  if (!PIN_HAPUS || PIN_HAPUS.length < 6) return false;
  return kodeHapus === PIN_HAPUS;
}
