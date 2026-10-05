// src/app/api/pesan/percakapan/route.js
// Ambil riwayat percakapan antara 2 pengguna (misal: Guru A <-> Guru B, atau Guru <-> Siswa)
// Diurutkan berdasarkan created_at ASC

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Layanan database Supabase belum terkonfigurasi." },
        { status: 503 },
      );
    }

    const { searchParams } = new URL(request.url);
    const user1 = (searchParams.get("user1") || "").trim();
    const user2 = (searchParams.get("user2") || "").trim();
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    if (!user1 || !user2) {
      return NextResponse.json(
        { error: "Parameter user1 dan user2 wajib diisi." },
        { status: 400 },
      );
    }

    // Ambil percakapan di mana (pengirim=user1 AND penerima=user2) ATAU (pengirim=user2 AND penerima=user1)
    const { data: rows, error } = await supabase
      .from("pesan_sekolah")
      .select("*")
      .or(
        `and(id_pengirim.eq.${user1},id_penerima.eq.${user2}),and(id_pengirim.eq.${user2},id_penerima.eq.${user1})`,
      )
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json({ ok: true, data: [] });
      }
      throw error;
    }

    return NextResponse.json({
      ok: true,
      data: rows || [],
    });
  } catch (err) {
    console.error("[Pesan Percakapan] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat percakapan." },
      { status: 500 },
    );
  }
}
