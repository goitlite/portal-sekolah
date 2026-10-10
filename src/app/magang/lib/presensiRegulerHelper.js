// Helper perhitungan presensi reguler mandiri siswa (maksimal 2x sehari)
// Presensi reguler HANYA dihitung saat siswa mengirim form presensi reguler (bukan barcode)

export const MAX_PRESENSI_REGULER_PER_HARI = 2;

export function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDayIndo(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return false;
  try {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    }
  } catch (_) {}
  return String(dateStr1).trim() === String(dateStr2).trim();
}

/**
 * Mengambil jumlah presensi reguler lokal hari ini untuk siswa tertentu
 */
export function getLocalPresensiRegulerCount(idSiswa) {
  if (typeof window === "undefined" || !idSiswa) return 0;
  const todayKey = getTodayDateKey();
  const storageKey = `magang_presensi_reguler_count_${idSiswa}_${todayKey}`;

  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      const parsed = parseInt(raw, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }

    // Fallback backward-compatibility cek key lama
    const oldDate = localStorage.getItem("magang_last_presensi_date");
    const todayStr = new Date().toLocaleDateString("id-ID");
    if (oldDate === todayStr) {
      return 1;
    }
  } catch (_) {}

  return 0;
}

/**
 * Menambahkan 1 hitungan presensi reguler setelah berhasil submit form reguler
 */
export function incrementLocalPresensiReguler(idSiswa) {
  if (typeof window === "undefined" || !idSiswa) return 1;
  const todayKey = getTodayDateKey();
  const storageKey = `magang_presensi_reguler_count_${idSiswa}_${todayKey}`;

  const current = getLocalPresensiRegulerCount(idSiswa);
  const next = current + 1;

  try {
    localStorage.setItem(storageKey, String(next));
    localStorage.setItem(
      "magang_last_presensi_date",
      new Date().toLocaleDateString("id-ID"),
    );
  } catch (_) {}

  return next;
}

/**
 * Menghitung jumlah presensi reguler dari data riwayat server pada hari ini
 */
export function countServerRegulerToday(riwayatList) {
  if (!Array.isArray(riwayatList) || riwayatList.length === 0) return 0;
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();

  let count = 0;
  for (const item of riwayatList) {
    const rawDate = item.TIMESTAMP || item.TANGGAL || item.tanggal || item.timestamp;
    if (!rawDate) continue;

    try {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) {
        if (
          d.getFullYear() === todayYear &&
          d.getMonth() === todayMonth &&
          d.getDate() === todayDate
        ) {
          count++;
        }
      } else {
        // Cek format DD/MM/YYYY atau YYYY-MM-DD
        const str = String(rawDate);
        const todayStrId = today.toLocaleDateString("id-ID");
        const todayIso = getTodayDateKey();
        if (str.includes(todayIso) || str.includes(todayStrId)) {
          count++;
        }
      }
    } catch (_) {}
  }

  return count;
}

/**
 * Hitung total presensi reguler hari ini (kombinasi riwayat server & storage lokal)
 */
export function getTotalPresensiRegulerToday(idSiswa, riwayatList = []) {
  const localCount = getLocalPresensiRegulerCount(idSiswa);
  const serverCount = countServerRegulerToday(riwayatList);
  return Math.max(localCount, serverCount);
}

