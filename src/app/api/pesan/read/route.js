// src/app/api/pesan/read/route.js
// Tandai pesan dari pengirim tertentu ke penerima (user yang login) sebagai sudah dibaca

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

    const { idPenerima, idPengirim } = await request.json();

    if (!idPenerima || !idPengirim) {
      return NextResponse.json(
        { error: "idPenerima dan idPengirim wajib diisi." },
        { status: 400 },
      );
    }

    // Update pesan di mana penerima adalah idPenerima dan pengirim adalah idPengirim
    const { error } = await supabase
      .from("pesan_sekolah")
      .update({ dibaca: true })
      .eq("id_penerima", String(idPenerima).trim())
      .eq("id_pengirim", String(idPengirim).trim())
      .eq("dibaca", false);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json({ ok: true, updated: 0 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Pesan Read] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Gagal memperbarui status baca." },
      { status: 500 },
    );
  }
}
