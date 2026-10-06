// src/app/api/pesan/delete/route.js
// Endpoint untuk menghapus 1 pesan spesifik atau seluruh percakapan antara 2 pengguna
// Disimpan di Supabase Cloud (0 Byte di server Vercel)

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Layanan database Supabase belum terkonfigurasi." },
        { status: 503 },
      );
    }

    const body = await request.json();
    const { type = "single", messageId, user1, user2 } = body;

    // 1. HAPUS SATU PESAN SPESIFIK
    if (type === "single") {
      if (!messageId) {
        return NextResponse.json(
          { error: "messageId wajib diisi untuk menghapus satu pesan." },
          { status: 400 },
        );
      }

      const { error } = await supabase
        .from("pesan_sekolah")
        .delete()
        .eq("id", messageId);

      if (error) {
        console.error("[Pesan Delete Single] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "Pesan berhasil dihapus.",
        messageId,
      });
    }

    // 2. HAPUS SELURUH PERCAKAPAN (OBROLAN PER NAMA / THREAD)
    if (type === "percakapan") {
      const u1 = String(user1 || "").trim();
      const u2 = String(user2 || "").trim();

      if (!u1 || !u2) {
        return NextResponse.json(
          { error: "Parameter user1 dan user2 wajib diisi untuk menghapus percakapan." },
          { status: 400 },
        );
      }

      // Hapus pesan kedua arah: u1 -> u2 dan u2 -> u1
      const [del1, del2] = await Promise.all([
        supabase
          .from("pesan_sekolah")
          .delete()
          .eq("id_pengirim", u1)
          .eq("id_penerima", u2),
        supabase
          .from("pesan_sekolah")
          .delete()
          .eq("id_pengirim", u2)
          .eq("id_penerima", u1),
      ]);

      if (del1.error || del2.error) {
        const err = del1.error || del2.error;
        console.error("[Pesan Delete Percakapan] Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
      }

      return NextResponse.json({
        ok: true,
        message: "Seluruh riwayat percakapan berhasil dihapus.",
        user1: u1,
        user2: u2,
      });
    }

    return NextResponse.json(
      { error: "Tipe penghapusan tidak valid. Gunakan 'single' atau 'percakapan'." },
      { status: 400 },
    );
  } catch (err) {
    console.error("[Pesan Delete] Server error:", err);
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan internal saat menghapus pesan." },
      { status: 500 },
    );
  }
}
