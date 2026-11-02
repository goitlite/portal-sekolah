// src/app/api/guru/asesmen/database/route.js
// Proxy Server-Side untuk aksi Guru ke Google Apps Script Database Ujian
// Melindungi GURU_KEY dari DevTools browser siswa

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const GS_DATABASE_URL =
  process.env.GS_DATABASE_URL ||
  "https://script.google.com/macros/s/AKfycbw9dkz277yVbLu8WWSDFdZwUqMbERbnyBOIxuBDalQshowNYIk78ygGC4Nvyk870FVT/exec";

const GURU_KEY = process.env.GURU_KEY || "SMKN1TELKU_GURU_ASESMEN_SECURE_2026";

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { status: "error", message: "Action wajib diisi" },
        { status: 400 }
      );
    }

    // Siapkan parameter form data untuk dikirim ke Google Apps Script
    const formData = new URLSearchParams();
    formData.append("action", action);
    formData.append("guru_key", GURU_KEY);

    // Salin seluruh properti lain dari body
    for (const [key, value] of Object.entries(body)) {
      if (key !== "action" && key !== "guru_key") {
        formData.append(key, String(value ?? ""));
      }
    }

    const response = await fetch(GS_DATABASE_URL, {
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
    console.error("[API Guru Asesmen Database] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal menghubungi server database asesmen",
      },
      { status: 500 }
    );
  }
}

