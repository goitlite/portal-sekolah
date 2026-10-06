// src/app/api/pesan/broadcast/route.js
// Endpoint Broadcast Pesan Massal:
//   - Kepala Sekolah → Semua / Pilihan Guru
//   - Guru → Siswa Bimbingannya (PKL, Wali, Wali Kelas, Mapel)
// Menggunakan Supabase Cloud (0 Byte di Vercel) + Web Push Notification

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
      namaPengirim = "Pengirim",
      rolePengirim = "kepsek",
      pesan,
      targetList = [], // Array dari { id, nama } penerima
    } = body;

    if (!idPengirim || !pesan || !pesan.trim()) {
      return NextResponse.json(
        { error: "idPengirim dan pesan tidak boleh kosong." },
        { status: 400 },
      );
    }

    const rPengirim = String(rolePengirim).toLowerCase().trim();

    // Hanya kepsek dan guru yang boleh broadcast
    if (rPengirim !== "kepsek" && rPengirim !== "guru") {
      return NextResponse.json(
        { error: "Hanya Kepala Sekolah atau Guru yang memiliki wewenang mengirim broadcast." },
        { status: 403 },
      );
    }

    if (!Array.isArray(targetList) || targetList.length === 0) {
      return NextResponse.json(
        { error: "Daftar penerima broadcast tidak boleh kosong." },
        { status: 400 },
      );
    }

    const cleanTeks = pesan.trim();

    // Tentukan role penerima berdasarkan pengirim:
    //   kepsek → broadcast ke guru
    //   guru   → broadcast ke siswa
    const rolePenerima = rPengirim === "kepsek" ? "guru" : "siswa";

    // Buat batch insert rows untuk Supabase
    const rows = targetList.map((target) => ({
      id_pengirim: String(idPengirim).trim(),
      nama_pengirim: String(namaPengirim || "Pengirim").trim(),
      role_pengirim: rPengirim,
      subrole_pengirim: rPengirim === "kepsek" ? "kepala_sekolah" : "guru",
      id_penerima: String(target.id || target.idSiswa || target.idGuru || "").trim(),
      nama_penerima: String(target.nama || target.namaSiswa || target.namaGuru || "Penerima").trim(),
      role_penerima: rolePenerima,
      pesan: cleanTeks,
      dibaca: false,
    })).filter((r) => r.id_penerima); // buang row tanpa id penerima

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada penerima valid dalam daftar broadcast." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("pesan_sekolah")
      .insert(rows)
      .select();

    if (error) {
      console.error("[api/pesan/broadcast] Supabase insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Kirim Web Push Notification ke penerima
    try {
      const ringkasanPesan = cleanTeks.length > 90 ? cleanTeks.slice(0, 90) + "..." : cleanTeks;
      const pushTitle =
        rPengirim === "kepsek"
          ? `📢 Pengumuman Kepala Sekolah (${namaPengirim})`
          : `📣 Pesan dari Guru (${namaPengirim})`;
      const pushUrl = rolePenerima === "siswa" ? "/magang/dashboard_siswa" : "/magang/guru";

      await sendPushNotification({
        title: pushTitle,
        body: ringkasanPesan,
        url: pushUrl,
        targetRole: rolePenerima,
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
