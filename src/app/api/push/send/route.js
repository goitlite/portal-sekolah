// src/app/api/push/send/route.js
// Kirim Web Push ke guru atau kepsek

import { NextResponse } from "next/server";
import { getWebPush } from "@/lib/webpush";
import fs from "fs/promises";
import path from "path";

const FILE = path.join(process.cwd(), "push_subscriptions.json");

async function readSubs() {
  try {
    const raw = await fs.readFile(FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeSubs(subs) {
  await fs.writeFile(FILE, JSON.stringify(subs, null, 2), "utf-8");
}

/**
 * POST /api/push/send
 * Body: {
 *   title, body, url?,
 *   targetUserId?,    // kirim ke 1 user spesifik
 *   targetRole?,      // kirim ke semua user dengan role ini ("guru"/"kepsek")
 * }
 */
export async function POST(request) {
  try {
    const {
      title,
      body: notifBody,
      url = "/magang/login",
      targetUserId,
      targetRole,
    } = await request.json();

    if (!title || !notifBody) {
      return NextResponse.json(
        { error: "title dan body wajib diisi" },
        { status: 400 },
      );
    }

    const allSubs = await readSubs();

    // Filter penerima
    let targets = allSubs;
    if (targetUserId) {
      targets = allSubs.filter((s) => s.userId === String(targetUserId));
    } else if (targetRole) {
      targets = allSubs.filter((s) => s.role === String(targetRole));
    }

    if (targets.length === 0) {
      return NextResponse.json({
        ok: true,
        sent: 0,
        message: "Tidak ada subscriber",
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
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
