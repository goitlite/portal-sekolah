// src/app/api/pesan/cleanup/route.js
// Auto-cleanup pesan lama di Supabase agar database tidak penuh (free tier 500MB)
// Strategy: Hapus pesan > 30 hari secara otomatis
// Dipanggil secara background dari dashboard saat halaman dibuka

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// Threshold hari — hapus pesan yang lebih tua dari ini
const HAPUS_LEBIH_DARI_HARI = 30;

/**
 * POST /api/pesan/cleanup
 * Hapus pesan lama otomatis. Dipanggil background dari dashboard.
 * Aman dijalankan kapan saja — hanya hapus data yang > 30 hari.
 */
export async function POST() {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, error: "Supabase tidak tersedia" }, { status: 503 });
    }

    const batasTanggal = new Date();
    batasTanggal.setDate(batasTanggal.getDate() - HAPUS_LEBIH_DARI_HARI);
    const batasISO = batasTanggal.toISOString();

    // Hapus pesan yang lebih tua dari HAPUS_LEBIH_DARI_HARI hari
    const { data: deleted, error, count } = await supabase
      .from("pesan_sekolah")
      .delete()
      .lt("created_at", batasISO)
      .select("id");

    if (error) {
      console.error("[Cleanup Pesan] Error hapus pesan lama:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    const jumlahHapus = Array.isArray(deleted) ? deleted.length : (count || 0);

    if (jumlahHapus > 0) {
      console.log(`[Cleanup Pesan] ✅ Berhasil hapus ${jumlahHapus} pesan yang lebih dari ${HAPUS_LEBIH_DARI_HARI} hari.`);
    }

    // Juga bersihkan push_subscriptions expired (opsional — tidak berbahaya)
    // Hapus subscription yang tidak di-update lebih dari 90 hari (endpoint mungkin expired)
    const batasPush = new Date();
    batasPush.setDate(batasPush.getDate() - 90);
    await supabase
      .from("push_subscriptions")
      .delete()
      .lt("updated_at", batasPush.toISOString())
      .catch(() => {}); // silent, tidak fatal jika gagal

    return NextResponse.json({
      ok: true,
      pesanDihapus: jumlahHapus,
      threshold: `${HAPUS_LEBIH_DARI_HARI} hari`,
    });
  } catch (err) {
    console.error("[Cleanup Pesan] Server error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/pesan/cleanup
 * Hanya cek jumlah pesan tanpa menghapus (untuk diagnostik)
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }

    const { count: totalPesan } = await supabase
      .from("pesan_sekolah")
      .select("*", { count: "exact", head: true });

    const batasTanggal = new Date();
    batasTanggal.setDate(batasTanggal.getDate() - HAPUS_LEBIH_DARI_HARI);

    const { count: pesanLama } = await supabase
      .from("pesan_sekolah")
      .select("*", { count: "exact", head: true })
      .lt("created_at", batasTanggal.toISOString());

    return NextResponse.json({
      ok: true,
      totalPesan: totalPesan || 0,
      pesanLayakHapus: pesanLama || 0,
      threshold: `${HAPUS_LEBIH_DARI_HARI} hari`,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}
