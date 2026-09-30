// src/lib/sendPushNotification.js
// Fungsi helper untuk mengirim notifikasi push dari Server Actions / API routes

/**
 * Kirim push notification dari server-side (Server Action / API route).
 *
 * @param {object} options
 * @param {string}  options.title        - Judul notifikasi
 * @param {string}  options.body         - Isi pesan notifikasi
 * @param {string}  [options.url]        - URL tujuan saat notif diklik
 * @param {string}  [options.targetUserId] - Kirim ke user tertentu
 * @param {string}  [options.targetRole]   - Kirim ke semua user dengan role ini
 * @param {object}  [options.data]       - Data tambahan
 * @returns {Promise<{ok: boolean, sent: number, failed: number}>}
 *
 * Contoh penggunaan dari Server Action saat guru mengirim pesan ke kepsek:
 *
 *   import { sendPushNotification } from "@/lib/sendPushNotification";
 *
 *   // Setelah pesan tersimpan ke DB:
 *   await sendPushNotification({
 *     title: "Pesan dari Guru",
 *     body: `${namaGuru}: ${isiPesan.slice(0, 100)}`,
 *     url: "/pesan",
 *     targetRole: "kepsek",
 *   });
 */
export async function sendPushNotification({
  title,
  body,
  url = "/",
  targetUserId,
  targetRole,
  data = {},
}) {
  const { getWebPush } = await import("@/lib/webpush");

  // -------------------------------------------------------
  // TODO: Ambil subscription dari database Anda.
  //
  // Contoh (Supabase):
  //   const supabase = createClient(...);
  //   let query = supabase.from("push_subscriptions").select("*");
  //   if (targetUserId) query = query.eq("user_id", targetUserId);
  //   else if (targetRole) query = query.eq("role", targetRole);
  //   const { data: rows } = await query;
  //   const subscriptions = rows.map(r => ({
  //     endpoint: r.endpoint,
  //     keys: { p256dh: r.p256dh, auth: r.auth },
  //   }));
  // -------------------------------------------------------

  // Fallback: baca dari file JSON (dev only)
  const fs = await import("fs/promises");
  let allSubs = [];
  try {
    allSubs = JSON.parse(
      await fs.readFile("./push_subscriptions.json", "utf-8"),
    );
  } catch {
    /* file belum ada */
  }

  let subscriptions = allSubs;
  if (targetUserId)
    subscriptions = allSubs.filter((s) => s.userId === targetUserId);
  else if (targetRole)
    subscriptions = allSubs.filter((s) => s.role === targetRole);

  if (subscriptions.length === 0) return { ok: true, sent: 0, failed: 0 };

  const wp = getWebPush();
  const payload = JSON.stringify({ title, body, url, data });

  const results = await Promise.allSettled(
    subscriptions.map(({ endpoint, keys }) =>
      wp.sendNotification({ endpoint, keys }, payload),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return { ok: true, sent, failed };
}
