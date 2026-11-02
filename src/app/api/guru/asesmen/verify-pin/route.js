// src/app/api/guru/asesmen/verify-pin/route.js
// Verifikasi PIN / Kode Khusus Guru Admin Asesmen (Super Admin Ujian)

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PIN_ADMIN_ASESMEN = process.env.PIN_ADMIN_ASESMEN || "4321";

export async function POST(request) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin) {
      return NextResponse.json(
        { status: "error", message: "Kode khusus wajib diisi" },
        { status: 400 }
      );
    }

    if (String(pin).trim() === String(PIN_ADMIN_ASESMEN).trim()) {
      return NextResponse.json({
        status: "success",
        message: "Kode Admin Asesmen valid! Mode Super Admin diaktifkan.",
        isAdmin: true,
      });
    }

    return NextResponse.json(
      { status: "error", message: "Kode khusus Admin Asesmen salah!", isAdmin: false },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error.message },
      { status: 500 }
    );
  }
}

