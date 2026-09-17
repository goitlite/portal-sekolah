"use server";

export async function verifikasiPinLogin(inputPin) {
  // Mengambil PIN dari .env.local, jika tidak ada pakai cadangan "293031"
  const PIN_ASLI = process.env.PIN_ADMIN_RAHASIA || "293031";
  return inputPin === PIN_ASLI;
}

export async function verifikasiPinHapus(kodeHapus) {
  // Mengambil PIN Hapus dari .env.local, jika tidak ada pakai cadangan "858687"
  const PIN_HAPUS = process.env.PIN_HAPUS_RAHASIA || "858687";
  return kodeHapus === PIN_HAPUS;
}
