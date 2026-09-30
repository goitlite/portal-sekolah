// src/app/api/push/subscribe/route.js
// Simpan PushSubscription dari browser ke file JSON lokal

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// File penyimpanan subscription (di root project, tidak ikut build)
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
      userId: String(userId),
      role: String(role),
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
      `[Push Subscribe] ${role} id=${userId} endpoint=...${subscription.endpoint.slice(-30)}`,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Push Subscribe] Error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
