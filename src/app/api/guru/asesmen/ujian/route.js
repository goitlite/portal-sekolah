// src/app/api/guru/asesmen/ujian/route.js
// Proxy Server-Side untuk aksi Ujian ke Google Apps Script Asesmen (Sheet UJIAN)
// Melindungi UJIAN_KEY & Memverifikasi Kepemilikan Ujian / PIN Admin Asesmen

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GS_ASESMEN_URL =
  process.env.GS_ASESMEN_URL ||
  "https://script.google.com/macros/s/AKfycbyNGdlYFNDpOET7BcJL6jwsJVFiLsYLt57_-B66YIHxa2Il75aPeFFMNEovgauKwnLM/exec";

const UJIAN_KEY = process.env.UJIAN_KEY || "SMKN1TELKU_UJIAN_ADMIN_SECURE_2026";
const PIN_ADMIN_ASESMEN = process.env.PIN_ADMIN_ASESMEN || "4321";

// GET: Ambil daftar seluruh baris ujian
export async function GET() {
  try {
    const response = await fetch(`${GS_ASESMEN_URL}?action=getData`, {
      cache: "no-store",
    });
    const data = await response.json();
    return NextResponse.json({
      status: "success",
      data: Array.isArray(data) ? data : [],
    });
  } catch (error) {
    console.error("[API Guru Asesmen Ujian GET] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal mengambil data ujian",
        data: [],
      },
      { status: 500 }
    );
  }
}

// POST: Tambah, edit, atau hapus baris ujian
export async function POST(request) {
  try {
    const body = await request.json();
    const { action, pin_admin, id_guru, nama_guru } = body;

    if (!action) {
      return NextResponse.json(
        { status: "error", message: "Action wajib diisi" },
        { status: 400 }
      );
    }

    // Cek apakah aksi dilakukan dengan otoritas Admin Asesmen
    const isAdmin =
      pin_admin &&
      String(pin_admin).trim() === String(PIN_ADMIN_ASESMEN).trim();

    const formData = new URLSearchParams();
    formData.append("action", action);
    formData.append("ujian_key", UJIAN_KEY);
    formData.append("is_admin", isAdmin ? "true" : "false");
    formData.append("id_guru", String(id_guru || ""));
    formData.append("nama_guru", String(nama_guru || ""));

    for (const [key, value] of Object.entries(body)) {
      if (
        key !== "action" &&
        key !== "ujian_key" &&
        key !== "is_admin" &&
        key !== "id_guru" &&
        key !== "nama_guru" &&
        key !== "pin_admin"
      ) {
        formData.append(key, String(value ?? ""));
      }
    }

    const response = await fetch(GS_ASESMEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      cache: "no-store",
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API Guru Asesmen Ujian POST] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal memproses aksi ujian",
      },
      { status: 500 }
    );
  }
}
