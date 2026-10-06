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
  const { getSupabaseServerClient } = await import("@/lib/supabaseServer");

  let subscriptions = [];
  let rawRows = [];
  const supabase = getSupabaseServerClient();

  if (supabase) {
    try {
      let query = supabase.from("push_subscriptions").select("*");
      if (targetUserId) {
        query = query.eq("user_id", String(targetUserId).trim());
      } else if (targetRole) {
        query = query.eq("role", String(targetRole).trim());
      }
      const { data: rows, error } = await query;
      if (!error && Array.isArray(rows)) {
        rawRows = rows;
        subscriptions = rows.map((r) => ({
          endpoint: r.endpoint,
          keys: { p256dh: r.p256dh, auth: r.auth },
        }));
        console.log(
          `[sendPushNotification] Target: userId="${targetUserId || "-"}" role="${targetRole || "-"}" → ${rows.length} subscription ditemukan di Supabase.`
        );
      } else if (error) {
        console.error("[sendPushNotification] Supabase query error:", error);
      }
    } catch (e) {
      console.error("[sendPushNotification] Supabase query exception:", e);
    }
  }

  // Fallback dev jika file JSON ada
  if (subscriptions.length === 0) {
    try {
      const fs = await import("fs/promises");
      const raw = await fs.readFile("./push_subscriptions.json", "utf-8");
      const localSubs = JSON.parse(raw);
      if (Array.isArray(localSubs)) {
        let filtered = localSubs;
        if (targetUserId) filtered = localSubs.filter((s) => s.userId === targetUserId);
        else if (targetRole) filtered = localSubs.filter((s) => s.role === targetRole);
        subscriptions = filtered.map((s) => ({
          endpoint: s.endpoint,
          keys: s.keys || { p256dh: s.p256dh, auth: s.auth },
        }));
      }
    } catch {
      /* fallback dev json */
    }
  }

  if (subscriptions.length === 0) {
    console.warn(
      `[sendPushNotification] Tidak ada subscriber untuk userId="${targetUserId || "-"}" role="${targetRole || "-"}". Push dibatalkan.`
    );
    return { ok: true, sent: 0, failed: 0 };
  }

  const wp = getWebPush();
  // Sertakan icon agar konsisten dengan /api/push/send
  const payload = JSON.stringify({ title, body, url, icon: "/logo.png", data });

  const results = await Promise.allSettled(
    subscriptions.map(({ endpoint, keys }) =>
      wp.sendNotification({ endpoint, keys }, payload),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[sendPushNotification] Terkirim: ${sent}, Gagal: ${failed}`);

  // Auto-cleanup: hapus subscription yang sudah tidak valid (HTTP 410 = browser cabut izin)
  if (supabase && rawRows.length > 0) {
    const toDeleteEndpoints = [];
    results.forEach((r, i) => {
      if (r.status === "rejected" && r.reason?.statusCode === 410) {
        toDeleteEndpoints.push(subscriptions[i].endpoint);
        console.warn(
          "[sendPushNotification] Hapus subscription kadaluarsa (410) dari Supabase:",
          rawRows[i]?.user_id
        );
      }
    });
    if (toDeleteEndpoints.length > 0) {
      try {
        await supabase
          .from("push_subscriptions")
          .delete()
          .in("endpoint", toDeleteEndpoints);
      } catch (e) {
        console.warn("[sendPushNotification] Gagal hapus expired subs:", e);
      }
    }
  }

  return { ok: true, sent, failed };
}
