// src/app/api/pesan/send/route.js
// Kirim Pesan Sekolah (Multi-Peran: Kepsek, Guru Pembimbing, Guru Mapel, Guru Wali, Wali Kelas, Siswa)
// Disimpan di Supabase Cloud (0 Byte di server Vercel) + Otomatis Kirim Web Push

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import { sendPushNotification } from "@/lib/sendPushNotification";

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
    const {
      idPengirim,
      namaPengirim,
      rolePengirim = "guru", // "kepsek" | "guru" | "siswa"
      subrolePengirim = "",  // "pembimbing" | "mapel" | "wali" | "walikelas" | ""
      idPenerima,
      namaPenerima = "",
      rolePenerima = "guru", // "kepsek" | "guru" | "siswa" | "semua"
      pesan,
    } = body;

    if (!idPengirim || !idPenerima || !pesan || !pesan.trim()) {
      return NextResponse.json(
        { error: "idPengirim, idPenerima, dan pesan tidak boleh kosong." },
        { status: 400 },
      );
    }

    const cleanTeks = pesan.trim();
    const rPengirim = String(rolePengirim).trim().toLowerCase();
    const rPenerima = String(rolePenerima).trim().toLowerCase();

    // Validasi aturan hak akses pesan:
    // 1. Kepala Sekolah hanya dapat berkirim pesan dengan Guru
    if (rPengirim === "kepsek" && rPenerima === "siswa") {
      return NextResponse.json(
        { error: "Kepala Sekolah hanya dapat berkirim pesan dengan Guru." },
        { status: 403 },
      );
    }

    // 2. Siswa hanya dapat berkirim pesan dengan Guru
    if (rPengirim === "siswa" && rPenerima === "kepsek") {
      return NextResponse.json(
        { error: "Siswa hanya dapat berkirim pesan dengan Guru." },
        { status: 403 },
      );
    }

    // 1. Simpan pesan ke tabel Supabase `pesan_sekolah`
    const { data: newRow, error: insertError } = await supabase
      .from("pesan_sekolah")
      .insert({
        id_pengirim: String(idPengirim).trim(),
        nama_pengirim: String(namaPengirim || "Pengguna").trim(),
        role_pengirim: String(rolePengirim).trim().toLowerCase(),
        subrole_pengirim: String(subrolePengirim || "").trim().toLowerCase(),
        id_penerima: String(idPenerima).trim(),
        nama_penerima: String(namaPenerima || "").trim(),
        role_penerima: String(rolePenerima).trim().toLowerCase(),
        pesan: cleanTeks,
        dibaca: false,
      })
      .select()
      .single();

    if (insertError) {
      // Jika tabel belum dibuat di Supabase
      if (insertError.code === "42P01" || insertError.message?.includes("does not exist") || insertError.code === "PGRST205") {
        return NextResponse.json(
          {
            error: "Tabel 'pesan_sekolah' belum dibuat di Supabase. Silakan jalankan script SQL pembuatan tabel di Supabase Dashboard.",
            needSchema: true,
          },
          { status: 400 },
        );
      }
      throw insertError;
    }

    // 2. Kirim Web Push Notification secara asinkron ke HP penerima
    try {
      const judulNotif = `💬 Pesan dari ${namaPengirim || "Pengguna"} (${rolePengirim.toUpperCase()})`;
      const ringkasanPesan = cleanTeks.length > 90 ? cleanTeks.slice(0, 90) + "..." : cleanTeks;

      await sendPushNotification({
        title: judulNotif,
        body: ringkasanPesan,
        url: rolePenerima === "siswa" ? "/magang/dashboard_siswa" : rolePenerima === "kepsek" ? "/magang/kepsek" : "/magang/guru",
        targetUserId: String(idPenerima).trim(),
      });
    } catch (pushErr) {
      console.warn("[Pesan Send] Gagal mengirim Web Push (non-fatal):", pushErr?.message);
    }

    return NextResponse.json({
      ok: true,
      data: newRow,
    });
  } catch (err) {
    console.error("[Pesan Send] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan server saat mengirim pesan." },
      { status: 500 },
    );
  }
}
