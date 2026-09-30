// src/app/api/push/send/route.js
// Kirim Web Push ke guru atau kepsek (kompatibel Vercel Serverless & Local)

import { NextResponse } from "next/server";
import { getWebPush } from "@/lib/webpush";
import fs from "fs/promises";
import path from "path";
import os from "os";

const TMP_FILE = path.join(os.tmpdir(), "push_subscriptions.json");
const LOCAL_FILE = path.join(process.cwd(), "push_subscriptions.json");

async function readSubs() {
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
  try {
    await fs.writeFile(LOCAL_FILE, content, "utf-8");
  } catch {}
  try {
    await fs.writeFile(TMP_FILE, content, "utf-8");
  } catch {}
}

/**
 * POST /api/push/send
 * Body: {
 *   title, body, url?,
 *   targetUserId?,    // kirim ke user spesifik
 *   targetRole?,      // kirim ke role ("guru"/"kepsek")
 * }
 */
export async function POST(request) {
  try {
    const {
      title,
      body: notifBody,
      url = "/magang/login",
      targetUserId,
      targetUserIds, // <- BARU: daftar banyak guru tertentu
      targetRole,
    } = await request.json();

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: "title dan body wajib diisi" },
        { status: 400 },
      );
    }

    const allSubs = await readSubs();

    const cleanTargetId = targetUserId
      ? String(targetUserId).trim().toLowerCase()
      : "";
    const cleanTargetIds = new Set(
      Array.isArray(targetUserIds)
        ? targetUserIds
            .map((x) => String(x).trim().toLowerCase())
            .filter(Boolean)
        : [],
    );
    const cleanTargetRole = targetRole
      ? String(targetRole).trim().toLowerCase()
      : "";

    // Filter penerima:
    // 1. Jika ada targetUserId, cocokkan userId
    // 2. Jika ada targetRole, masukkan juga subscriber dengan role tersebut agar HP penerima PASTI kena
    let targets = allSubs.filter((s) => {
      const sId = String(s.userId || "")
        .trim()
        .toLowerCase();
      const sRole = String(s.role || "")
        .trim()
        .toLowerCase();

      if (cleanTargetId && sId === cleanTargetId) return true;
      if (cleanTargetIds.size > 0 && cleanTargetIds.has(sId)) return true;
      if (cleanTargetRole && sRole === cleanTargetRole) return true;
      return false;
    });

    console.log(
      `[Push Send] Target filter -> Id: "${cleanTargetId}", Role: "${cleanTargetRole}". Cocok: ${targets.length} dari ${allSubs.length} subs. Subs di server:`,
      allSubs.map((s) => `${s.role}:${s.userId}`),
    );

    if (targets.length === 0) {
      const daftarDiServer = allSubs
        .map((s) => `${s.role}:${s.userId}`)
        .join(", ");
      return NextResponse.json({
        ok: false,
        sent: 0,
        message: `Tidak ada subscriber yang cocok untuk ID "${cleanTargetId}" atau Role "${cleanTargetRole}". Di server ada ${allSubs.length} perangkat terdaftar: [${daftarDiServer || "Kosong"}]. Silakan tekan tombol Tes Notif di HP agar HP Anda terdaftar.`,
      });
    }

    const wp = getWebPush();
    const payload = JSON.stringify({
      title,
      body: notifBody,
      icon: "/logo.png",
      url,
    });

    const results = await Promise.allSettled(
      targets.map(({ endpoint, keys }) =>
        wp.sendNotification({ endpoint, keys }, payload),
      ),
    );

    // Hapus subscription yang sudah tidak valid (410 = browser mencabut izin)
    const toDelete = new Set();
    results.forEach((r, i) => {
      if (r.status === "rejected" && r.reason?.statusCode === 410) {
        toDelete.add(targets[i].endpoint);
        console.warn(
          "[Push Send] Hapus subscription kadaluarsa:",
          targets[i].userId,
        );
      }
    });

    if (toDelete.size > 0) {
      const cleaned = allSubs.filter((s) => !toDelete.has(s.endpoint));
      await writeSubs(cleaned);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`[Push Send] Terkirim: ${sent}, Gagal: ${failed}`);
    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    console.error("[Push Send] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Server error saat mengirim push" },
      { status: 500 },
    );
  }
}
