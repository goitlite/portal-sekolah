// src/app/api/pesan/unread-count/route.js
// Hitung total pesan belum dibaca untuk user tertentu

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const { searchParams } = new URL(request.url);
    const userId = (searchParams.get("userId") || "").trim();

    if (!userId) {
      return NextResponse.json({ ok: true, count: 0 });
    }

    const { count, error } = await supabase
      .from("pesan_sekolah")
      .select("*", { count: "exact", head: true })
      .eq("id_penerima", userId)
      .eq("dibaca", false);

    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") {
        return NextResponse.json({ ok: true, count: 0 });
      }
      throw error;
    }

    return NextResponse.json({ ok: true, count: count || 0 });
  } catch (err) {
    console.error("[Pesan Unread Count] Error:", err);
    return NextResponse.json({ ok: true, count: 0 });
  }
}
