// src/app/api/push/subscribe/route.js
// Simpan PushSubscription dari browser (menggunakan Supabase)

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/subscribe
 * Body: { subscription, userId, role }
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
    const { subscription, userId, role } = await request.json();

    if (!subscription?.endpoint || !userId || !role) {
      return NextResponse.json(
        { error: "subscription, userId, dan role wajib diisi" },
        { status: 400 },
      );
    }

    // Upsert: update jika endpoint sama sudah ada, tambah jika baru
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: String(userId).trim(),
        role: String(role).trim(),
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

    if (error) throw error;

    // Untuk log, kita ambil total data agar mirip dengan sistem lama
    const { count } = await supabase
      .from("push_subscriptions")
      .select("*", { count: "exact", head: true });

    console.log(
      `[Push Subscribe] ${role} id=${userId} terdaftar ke Supabase. Total subs di database: ${count || 1}`,
    );

    return NextResponse.json({ ok: true, total: count || 1 });
  } catch (err) {
    console.error("[Push Subscribe] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error saat menyimpan token" },
      { status: 500 },
    );
  }
}
