// src/app/api/push/subscribe/route.js
// Simpan PushSubscription dari browser (kompatibel Vercel Serverless & Local)

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Di Vercel Serverless, root folder read-only, sehingga wajib pakai os.tmpdir() (/tmp)
const TMP_FILE = path.join(os.tmpdir(), "push_subscriptions.json");
const LOCAL_FILE = path.join(process.cwd(), "push_subscriptions.json");

async function readSubs() {
  // Coba baca dari file lokal dulu (jika dev), lalu coba dari /tmp (jika Vercel)
  for (const filePath of [LOCAL_FILE, TMP_FILE]) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
  }
  return [];
}

async function writeSubs(subs) {
  const content = JSON.stringify(subs, null, 2);
  let saved = false;

  // 1. Coba tulis ke lokal
  try {
    await fs.writeFile(LOCAL_FILE, content, "utf-8");
    saved = true;
  } catch (e) {
    // Di Vercel, lokal read-only (EROFS)
  }

  // 2. Selalu tulis juga ke /tmp (writable di Vercel Serverless)
  try {
    await fs.writeFile(TMP_FILE, content, "utf-8");
    saved = true;
  } catch (e) {
    console.warn("[Push Subscribe] Gagal tulis ke /tmp:", e);
  }

  if (!saved) {
    throw new Error("Gagal menyimpan subscription ke penyimpanan server");
  }
}

/**
 * POST /api/push/subscribe
 * Body: { subscription, userId, role }
 */
export async function POST(request) {
  try {
    const { subscription, userId, role } = await request.json();

    if (!subscription?.endpoint || !userId || !role) {
      return NextResponse.json(
        { error: "subscription, userId, dan role wajib diisi" },
        { status: 400 },
      );
    }

    const subs = await readSubs();

    // Upsert: update jika endpoint sama sudah ada, tambah jika baru
    const idx = subs.findIndex((s) => s.endpoint === subscription.endpoint);
    const entry = {
      userId: String(userId).trim(),
      role: String(role).trim(),
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      updatedAt: new Date().toISOString(),
    };

    if (idx >= 0) {
      subs[idx] = entry;
    } else {
      subs.push(entry);
    }

    await writeSubs(subs);

    console.log(
      `[Push Subscribe] ${role} id=${userId} terdaftar. Total subs di server: ${subs.length}`,
    );

    return NextResponse.json({ ok: true, total: subs.length });
  } catch (err) {
    console.error("[Push Subscribe] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error saat menyimpan token" },
      { status: 500 },
    );
  }
}
