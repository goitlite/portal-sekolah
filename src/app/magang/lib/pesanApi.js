// src/app/magang/lib/pesanApi.js
// Client API untuk Sistem Pesan Sekolah Terpadu (Supabase Backend)

/**
 * Kirim pesan baru
 */
export async function kirimPesanSekolah(data) {
  try {
    const res = await fetch("/api/pesan/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err) {
    console.error("[pesanApi] kirimPesan error:", err);
    return { ok: false, error: err?.message || "Gagal menghubungi server." };
  }
}

/**
 * Ambil riwayat percakapan antara 2 user
 */
export async function getPercakapanSekolah(user1, user2) {
  try {
    const res = await fetch(
      `/api/pesan/percakapan?user1=${encodeURIComponent(user1)}&user2=${encodeURIComponent(user2)}`,
    );
    return await res.json();
  } catch (err) {
    console.error("[pesanApi] getPercakapan error:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Ambil daftar inbox percakapan user
 */
export async function getInboxSekolah(userId) {
  try {
    const res = await fetch(
      `/api/pesan/inbox?userId=${encodeURIComponent(userId)}`,
    );
    return await res.json();
  } catch (err) {
    console.error("[pesanApi] getInbox error:", err);
    return { ok: false, data: [] };
  }
}

/**
 * Tandai pesan dari pengirim tertentu ke penerima sudah dibaca
 */
export async function tandaiPesanDibaca(idPenerima, idPengirim) {
  try {
    const res = await fetch("/api/pesan/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idPenerima, idPengirim }),
    });
    return await res.json();
  } catch (err) {
    console.error("[pesanApi] tandaiDibaca error:", err);
    return { ok: false };
  }
}

/**
 * Hitung jumlah pesan belum dibaca
 */
export async function getJumlahPesanUnread(userId) {
  try {
    const res = await fetch(
      `/api/pesan/unread-count?userId=${encodeURIComponent(userId)}`,
    );
    const json = await res.json();
    return json?.count || 0;
  } catch (err) {
    return 0;
  }
}

/**
 * Kirim broadcast pesan massal Kepala Sekolah ke semua guru
 */
export async function kirimBroadcastSekolah({
  idPengirim,
  namaPengirim,
  rolePengirim = "kepsek",
  pesan,
  targetList = [],
}) {
  try {
    const res = await fetch("/api/pesan/broadcast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idPengirim,
        namaPengirim,
        rolePengirim,
        pesan,
        targetList,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error("[pesanApi] kirimBroadcast error:", err);
    return { ok: false, error: err?.message || "Gagal mengirim pesan broadcast." };
  }
}

