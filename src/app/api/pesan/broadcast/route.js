// src/app/api/pesan/broadcast/route.js
// Endpoint Broadcast Pesan Massal dari Kepala Sekolah ke Semua Guru
// Menggunakan Supabase Cloud (0 Byte di Vercel) + Web Push Notification ke Semua Guru

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
      namaPengirim = "HURDISMAN, S.Pd",
      rolePengirim = "kepsek",
      pesan,
      targetList = [], // Array dari { id, nama } guru
    } = body;

    if (!idPengirim || !pesan || !pesan.trim()) {
      return NextResponse.json(
        { error: "idPengirim dan pesan tidak boleh kosong." },
        { status: 400 },
      );
    }

    if (String(rolePengirim).toLowerCase() !== "kepsek") {
      return NextResponse.json(
        { error: "Hanya Kepala Sekolah yang memiliki wewenang mengirim broadcast." },
        { status: 403 },
      );
    }

    if (!Array.isArray(targetList) || targetList.length === 0) {
      return NextResponse.json(
        { error: "Daftar guru penerima broadcast tidak boleh kosong." },
        { status: 400 },
      );
    }

    const cleanTeks = pesan.trim();

    // Buat batch insert rows untuk Supabase
    const rows = targetList.map((guru) => ({
      id_pengirim: String(idPengirim).trim(),
      nama_pengirim: String(namaPengirim || "HURDISMAN, S.Pd").trim(),
      role_pengirim: "kepsek",
      subrole_pengirim: "kepala_sekolah",
      id_penerima: String(guru.id || guru.idGuru).trim(),
      nama_penerima: String(guru.nama || guru.namaGuru || "Guru").trim(),
      role_penerima: "guru",
      pesan: cleanTeks,
      dibaca: false,
    }));

    const { data, error } = await supabase
      .from("pesan_sekolah")
      .insert(rows)
      .select();

    if (error) {
      console.error("[api/pesan/broadcast] Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Kirim Web Push Notification ke seluruh guru
    try {
      const ringkasanPesan = cleanTeks.length > 90 ? cleanTeks.slice(0, 90) + "..." : cleanTeks;
      await sendPushNotification({
        title: `📢 Pengumuman Kepala Sekolah (${namaPengirim})`,
        body: ringkasanPesan,
        url: "/magang/guru",
        targetRole: "guru",
      });
    } catch (pushErr) {
      console.warn("[api/pesan/broadcast] Push notification notice:", pushErr?.message);
    }

    return NextResponse.json({
      success: true,
      terkirim: rows.length,
      data,
    });
  } catch (err) {
    console.error("[api/pesan/broadcast] Server error:", err);
    return NextResponse.json(
      { error: err?.message || "Terjadi kesalahan internal server." },
      { status: 500 },
    );
  }
}
