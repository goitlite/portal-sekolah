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
 * Autentikasi Admin ke Google Apps Script untuk mendapatkan Token Sesi Server.
 * Token ini diperlukan untuk memanggil getSiswa dan getDashboardKepsekWaliKelas.
 */
async function getGasAdminToken() {
  const adminPin = process.env.PIN_ADMIN_RAHASIA || "663355";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(GAS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "adminLogin", params: { pin: adminPin } }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const json = await res.json();
    if (json && json.success && json.data?.token) {
      return json.data.token;
    }
    console.warn("[Cron Alarm] adminLogin gagal:", json?.message);
  } catch (err) {
    console.warn("[Cron Alarm] Error request adminLogin:", err?.message);
  }
  return null;
}

/**
 * Helper request aman ke Google Apps Script dengan token sesi admin
 */
async function fetchFromGAS(action, params = {}, token = null) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const payload = { action, params };
    if (token) {
      payload.token = token;
    }

    const response = await fetch(GAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
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
    const targetIdParam = searchParams.get("targetId"); // Uji coba kirim ke 1 siswa spesifik
    const forceAllParam = searchParams.get("all") === "true"; // Uji coba broadcast seluruh siswa

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
        targetType = "magang";
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
        message: "Tidak ada perangkat HP siswa yang terdaftar untuk menerima notifikasi di Supabase.",
        sent: 0,
        failed: 0,
      });
    }

    // Dapatkan token admin dari Google Apps Script
    const adminToken = await getGasAdminToken();
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
      const waliRes = await fetchFromGAS(
        "getDashboardKepsekWaliKelas",
        { forceRefresh: false },
        adminToken,
      );

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
      const siswaRes = await fetchFromGAS("getSiswa", {}, adminToken);
      const rawSiswaList = Array.isArray(siswaRes)
        ? siswaRes
        : Array.isArray(siswaRes?.data)
        ? siswaRes.data
        : [];

      if (rawSiswaList.length > 0) {
        rawSiswaList.forEach((s) => {
          const sid = String(s.ID || s.id || s.nisn || s.NISN || "").trim();
          const rawStatus = String(s.STATUS || s.status || "").trim().toUpperCase();
          const rawTempat = String(s.TEMPAT_MAGANG || s.tempatMagang || "").trim();

          const isSedangMagang =
            rawStatus === "MAGANG" ||
            rawStatus === "SEDANG_MAGANG" ||
            (rawTempat !== "" &&
              rawTempat !== "-" &&
              rawStatus !== "BELUM_MAGANG");

          // HANYA SISWA MAGANG YANG DITAMBAHKAN (Siswa belum magang tidak dimasukkan)
          if (isSedangMagang && sid) {
            targetUserIds.add(sid.toLowerCase());
          }
        });
      }

      console.log(
        `[Cron Alarm Magang] Teridentifikasi ${targetUserIds.size} siswa aktif magang dari server GAS.`,
      );
    }

    // 3. Filter target subscriptions dari database Supabase
    const matchedSubscriptions = allSubs.filter((sub) => {
      const sId = String(sub.user_id || "").trim().toLowerCase();
      const sRole = String(sub.role || "").trim().toLowerCase();

      // Mode Uji Coba: jika targetId spesifik diberikan di query param
      if (targetIdParam && sId === targetIdParam.trim().toLowerCase()) {
        return true;
      }

      // Mode Uji Coba: jika all=true diberikan di query param
      if (forceAllParam && (sRole === "siswa" || sRole.startsWith("siswa_"))) {
        return true;
      }

      // 1. Cocokkan ID siswa dengan targetUserIds dari server Google Apps Script
      if (targetUserIds.size > 0 && targetUserIds.has(sId)) {
        return true;
      }

      // 2. Cocokkan berdasarkan peran spesifik yang tersimpan di Supabase
      if (targetType === "petugas" && (sRole === "siswa_petugas" || sRole === "petugas")) {
        return true;
      }
      if (targetType === "magang" && sRole === "siswa_magang") {
        return true;
      }

      return false;
    });

    console.log(
      `[Cron Alarm] Tipe: "${targetType}". Dari ${allSubs.length} total subs, cocok ${matchedSubscriptions.length} perangkat HP.`,
    );

    if (matchedSubscriptions.length === 0) {
      return NextResponse.json({
        ok: true,
        type: targetType,
        gasAuthSuccess: !!adminToken,
        targetCandidates: targetUserIds.size,
        deviceSubscriptions: allSubs.length,
        matchedDevices: 0,
        sent: 0,
        failed: 0,
        message:
          targetUserIds.size === 0
            ? "Data siswa magang/petugas belum termuat dari server (atau sedang kosong). Anda dapat menguji kirim dengan menambahkan &targetId=[ID_SISWA] atau &all=true di URL."
            : `Teridentifikasi ${targetUserIds.size} siswa sasaran, namun belum ada token push HP mereka yang tersimpan di database Supabase.`,
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
      gasAuthSuccess: !!adminToken,
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
