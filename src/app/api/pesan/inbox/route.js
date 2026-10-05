// src/app/api/pesan/inbox/route.js
// Ambil daftar obrolan aktif untuk pengguna (semua pesan masuk/keluar)
// Dikelompokkan berdasarkan lawan bicara dengan pesan terakhir & jumlah unread

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
    const userId = (searchParams.get("userId") || "").trim();

    if (!userId) {
      return NextResponse.json(
        { error: "Parameter userId wajib diisi." },
        { status: 400 },
      );
    }

    // Ambil pesan di mana user ini adalah pengirim ATAU penerima
    const { data: rows, error } = await supabase
      .from("pesan_sekolah")
      .select("*")
      .or(`id_pengirim.eq.${userId},id_penerima.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json({ ok: true, data: [] });
      }
      throw error;
    }

    // Kelompokkan per lawan bicara
    const kontakMap = new Map();

    (rows || []).forEach((row) => {
      const isSayaPengirim = String(row.id_pengirim).trim() === userId;
      const lawanId = isSayaPengirim ? row.id_penerima : row.id_pengirim;
      const lawanNama = isSayaPengirim ? (row.nama_penerima || lawanId) : row.nama_pengirim;
      const lawanRole = isSayaPengirim ? (row.role_penerima || "") : row.role_pengirim;

      if (!kontakMap.has(lawanId)) {
        kontakMap.set(lawanId, {
          lawanId,
          lawanNama,
          lawanRole,
          pesanTerakhir: row.pesan,
          waktuTerakhir: row.created_at,
          pengirimTerakhir: isSayaPengirim ? "saya" : "lawan",
          unreadCount: 0,
        });
      }

      // Jika pesan masuk ke saya dan belum dibaca
      if (!isSayaPengirim && !row.dibaca) {
        const item = kontakMap.get(lawanId);
        item.unreadCount += 1;
      }
    });

    const hasil = Array.from(kontakMap.values());

    return NextResponse.json({
      ok: true,
      data: hasil,
    });
  } catch (err) {
    console.error("[Pesan Inbox] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memuat daftar inbox pesan." },
      { status: 500 },
    );
  }
}
