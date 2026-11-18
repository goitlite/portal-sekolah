import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Permintaan password tidak valid." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const expectedPin = process.env.ANDROID_PWA_GATE_PIN;
  if (!expectedPin) {
    return NextResponse.json(
      {
        status: "error",
        message: "Akses web PWA Android belum dikonfigurasi oleh admin.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const pin = typeof body?.pin === "string" ? body.pin.trim() : "";
  if (!pin || pin.length > 32) {
    return NextResponse.json(
      { status: "error", message: "Masukkan password akses PWA." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (pin !== expectedPin.trim()) {
    return NextResponse.json(
      { status: "error", message: "Password akses PWA tidak sesuai." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { status: "success" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
