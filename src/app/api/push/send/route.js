// src/app/api/push/send/route.js
// Kirim Web Push ke guru atau kepsek (menggunakan Supabase)

import { NextResponse } from "next/server";
import { getWebPush } from "@/lib/webpush";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/send
 * Body: {
 *   title, body, url?,
 *   targetUserId?,    // kirim ke user spesifik
 *   targetUserIds?,   // kirim ke daftar banyak guru tertentu
 *   targetRole?,      // kirim ke role ("guru"/"kepsek")
 * }
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Layanan database notifikasi (Supabase) belum terkonfigurasi." },
        { status: 503 },
      );
    }
    const {
      title,
      body: notifBody,
      url = "/magang/login",
      targetUserId,
      targetUserIds,
      targetRole,
    } = await request.json();

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: "title dan body wajib diisi" },
        { status: 400 },
      );
    }

    // Ambil SEMUA subscription dari Supabase
    const { data: allSubs, error } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (error) throw error;

    const cleanTargetId = targetUserId
      ? String(targetUserId).trim().toLowerCase()
      : "";
    const cleanTargetIds = new Set(
      Array.isArray(targetUserIds)
        ? targetUserIds
            .map((x) => String(x).trim().toLowerCase())
            .filter(Boolean)
        : [],
    );
    const cleanTargetRole = targetRole
      ? String(targetRole).trim().toLowerCase()
      : "";

    // Filter penerima (Logika ini dipertahankan dari file lama)
    // 1. Jika ada targetUserId, cocokkan userId
    // 2. Jika ada targetRole, masukkan juga subscriber dengan role tersebut agar HP penerima PASTI kena
    let targets = (allSubs || []).filter((s) => {
      const sId = String(s.user_id || "")
        .trim()
        .toLowerCase();
      const sRole = String(s.role || "")
        .trim()
        .toLowerCase();

      if (cleanTargetId && sId === cleanTargetId) return true;
      if (cleanTargetIds.size > 0 && cleanTargetIds.has(sId)) return true;
      if (cleanTargetRole && sRole === cleanTargetRole) return true;
      return false;
    });

    console.log(
      `[Push Send] Target filter -> Id: "${cleanTargetId}", Role: "${cleanTargetRole}". Cocok: ${targets.length} dari ${(allSubs || []).length} subs.`,
    );

    if (targets.length === 0) {
      const totalDiServer = (allSubs || []).length;
      // Log detail hanya di server (tidak dikirim ke browser)
      console.log(
        `[Push Send] Tidak cocok. Total perangkat terdaftar: ${totalDiServer}. ` +
        (allSubs || []).map((s) => `${s.role}:${s.user_id}`).join(", ")
      );
      return NextResponse.json({
        ok: false,
        sent: 0,
        message: `HP belum terdaftar untuk menerima notifikasi. Ada ${totalDiServer} perangkat aktif di server. Silakan tekan tombol 🔔 di modal pesan untuk mendaftarkan HP ini.`,
      });
    }

    const wp = getWebPush();
    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: "/logo.png",
      url,
    });

    // Kirim menggunakan webpush
    const results = await Promise.allSettled(
      targets.map((row) =>
        wp.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
        ),
      ),
    );

    // Hapus subscription yang sudah tidak valid (410 = browser mencabut izin) dari Supabase
    const toDeleteEndpoints = [];
    results.forEach((r, i) => {
      if (r.status === "rejected" && r.reason?.statusCode === 410) {
        toDeleteEndpoints.push(targets[i].endpoint);
        console.warn(
          "[Push Send] Hapus subscription kadaluarsa dari database:",
          targets[i].user_id,
        );
      }
    });

    if (toDeleteEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", toDeleteEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`[Push Send] Terkirim: ${sent}, Gagal: ${failed}`);
    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    console.error("[Push Send] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error saat mengirim push" },
      { status: 500 },
    );
  }
}
