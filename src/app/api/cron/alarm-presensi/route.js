// src/app/api/cron/alarm-presensi/route.js
// Endpoint Cron Job Otomatis untuk Mengirim Push Notifikasi Alarm Presensi ke HP Siswa
// Berjalan otomatis setiap Senin - Jumat:
// - Pukul 07:00 WIB (00:00 UTC): Khusus Petugas Presensi Kelas
// - Pukul 09:00 WIB (02:00 UTC): Khusus Siswa Sedang Magang (Siswa belum magang TIDAK menerima notif ini)

import { NextResponse } from "next/server";
import { getWebPush } from "@/lib/webpush";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbwL6gJ9rVKps7EmqKO0o928iwbFlqk-xQDY4za0PcIPh0f-kkRTyu5XCavvZ-9bsZA/exec";

/**
 * Helper request aman ke Google Apps Script dengan timeout
 */
async function fetchFromGAS(action, params = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({ action, params }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json();
    return data;
  } catch (err) {
    console.warn(`[Cron Alarm] Gagal mengambil data GAS (${action}):`, err?.message);
    return null;
  }
}

/**
 * Handler utama Cron (GET untuk Vercel Cron, POST untuk pengujian manual)
 */
async function handleAlarmCron(request) {
  try {
    // 1. Verifikasi Keamanan Cron Secret jika diset di environment Vercel
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron caller" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const paramType = searchParams.get("type"); // "petugas" | "magang"

    // 2. Tentukan tipe alarm (berdasarkan param atau jam WIB sekarang)
    const now = new Date();
    const utcHours = now.getUTCHours();
    const wibHours = (utcHours + 7) % 24;

    let targetType = paramType;
    if (!targetType) {
      if (wibHours >= 6 && wibHours < 8) {
        targetType = "petugas";
      } else if (wibHours >= 8 && wibHours < 12) {
        targetType = "magang";
      } else {
        targetType = "magang"; // default preview
      }
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "Layanan database notifikasi (Supabase) belum terkonfigurasi." },
        { status: 503 },
      );
    }

    // Ambil seluruh Push Subscriptions aktif di Supabase
    const { data: allSubs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*");

    if (subsError) throw subsError;

    if (!allSubs || allSubs.length === 0) {
      return NextResponse.json({
        ok: true,
        message: "Tidak ada perangkat HP siswa yang terdaftar untuk menerima notifikasi.",
        sent: 0,
        failed: 0,
      });
    }

    let targetUserIds = new Set();
    let notifTitle = "";
    let notifBody = "";
    let targetUrl = "/magang/dashboard_siswa";

    // ============================================================
    // A. ALARM KHUSUS PETUGAS PRESENSI WAJAH KELAS (07:00 WIB)
    // ============================================================
    if (targetType === "petugas") {
      notifTitle = "⏰ Waktunya Presensi Wajah Kelas!";
      notifBody =
        "Selamat pagi Petugas Presensi. Silakan buka kamera untuk mencatat presensi rekan sekelas hari ini.";
      targetUrl = "/magang/dashboard_siswa";

      // Ambil daftar Wali Kelas untuk mengekstrak siapa saja yang ditunjuk sebagai Petugas
      const waliRes = await fetchFromGAS("getDashboardKepsekWaliKelas", {
        forceRefresh: false,
      });

      if (waliRes && waliRes.success && Array.isArray(waliRes.data?.cards)) {
        waliRes.data.cards.forEach((card) => {
          const match = (card.keterangan || "").match(
            /\[PETUGAS:([^:\]]+):([^\]]*)\]/,
          );
          if (match && match[1]) {
            targetUserIds.add(match[1].trim().toLowerCase());
          }
        });
      }

      console.log(
        `[Cron Alarm Petugas] Teridentifikasi ${targetUserIds.size} Petugas Presensi:`,
        Array.from(targetUserIds),
      );
    }
    // ============================================================
    // B. ALARM KHUSUS SISWA SEDANG MAGANG (09:00 WIB)
    // ============================================================
    else {
      notifTitle = "⏰ Waktunya Ambil Presensi Magang!";
      notifBody =
        "Halo, sekarang sudah jam 09:00 WIB. Jangan lupa kirim selfie & lokasi live presensi magang hari ini.";
      targetUrl = "/magang/presensi";

      // Ambil daftar master siswa untuk memfilter HANYA siswa yang sedang magang
      const siswaRes = await fetchFromGAS("getSiswa", {});
      const rawSiswaList = Array.isArray(siswaRes)
        ? siswaRes
        : Array.isArray(siswaRes?.data)
        ? siswaRes.data
        : [];

      if (rawSiswaList.length > 0) {
        rawSiswaList.forEach((s) => {
          const rawStatus = String(s.status || s.STATUS || "")
            .trim()
            .toUpperCase();
          const rawTempat = String(
            s.tempatMagang || s.TEMPAT_MAGANG || "",
          ).trim();
          const isSedangMagang =
            rawStatus === "MAGANG" ||
            rawStatus === "SEDANG_MAGANG" ||
            (rawTempat !== "" &&
              rawTempat !== "-" &&
              rawStatus !== "BELUM_MAGANG");

          // HANYA SISWA MAGANG YANG DITAMBAHKAN (Siswa belum magang tidak menerima)
          if (isSedangMagang && s.id) {
            targetUserIds.add(String(s.id).trim().toLowerCase());
          }
        });
      }

      console.log(
        `[Cron Alarm Magang] Teridentifikasi ${targetUserIds.size} siswa aktif magang.`,
      );
    }

    // 3. Filter target subscriptions dari database Supabase
    const matchedSubscriptions = allSubs.filter((sub) => {
      const sId = String(sub.user_id || "").trim().toLowerCase();
      const sRole = String(sub.role || "").trim().toLowerCase();

      // Harus terdaftar sebagai siswa dan ada di daftar targetUserIds
      return sRole === "siswa" && targetUserIds.has(sId);
    });

    console.log(
      `[Cron Alarm] Tipe: "${targetType}". Dari ${allSubs.length} total subs, cocok ${matchedSubscriptions.length} perangkat HP.`,
    );

    if (matchedSubscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        type: targetType,
        targetCandidates: targetUserIds.size,
        deviceSubscriptions: allSubs.length,
        matchedDevices: 0,
        sent: 0,
        failed: 0,
        message:
          "Belum ada perangkat HP siswa yang cocok dan mengizinkan push notifikasi di database.",
      });
    }

    // 4. Kirim Web Push ke seluruh perangkat sasaran
    const wp = getWebPush();
    const todayKey = `${now.getFullYear()}-${String(
      now.getMonth() + 1,
    ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const payload = JSON.stringify({
      title: notifTitle,
      body: notifBody,
      icon: "/logo.png",
      url: targetUrl,
      tag: `alarm-${targetType}-${todayKey}`,
    });

    const results = await Promise.allSettled(
      matchedSubscriptions.map((row) =>
        wp.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
        ),
      ),
    );

    // Hapus token yang sudah kadaluarsa (kode status 410 = browser sudah mencabut izin)
    const toDeleteEndpoints = [];
    results.forEach((r, i) => {
      if (r.status === "rejected" && r.reason?.statusCode === 410) {
        toDeleteEndpoints.push(matchedSubscriptions[i].endpoint);
      }
    });

    if (toDeleteEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", toDeleteEndpoints);
      console.log(
        `[Cron Alarm] Dihapus ${toDeleteEndpoints.length} subscription kadaluarsa.`,
      );
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({
      ok: true,
      type: targetType,
      targetCandidates: targetUserIds.size,
      matchedDevices: matchedSubscriptions.length,
      sent,
      failed,
      timeWib: `${String(wibHours).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")} WIB`,
    });
  } catch (err) {
    console.error("[Cron Alarm] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal error saat menjalankan cron alarm" },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  return handleAlarmCron(request);
}

export async function POST(request) {
  return handleAlarmCron(request);
}

