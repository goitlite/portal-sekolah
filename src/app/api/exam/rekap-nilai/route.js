// src/app/api/exam/rekap-nilai/route.js
// API Pengambilan Nilai Asesmen Siswa dari Google Sheets Respon Ujian
// Menggunakan Service Account Google Sheets API & In-Memory Caching
//
// REVISI STABILITAS (v1.1) - bentuk respon lama tetap: { status, totalRespon, data[], responses[] }
// 1. Satu spreadsheet respon hanya dibaca SEKALI walau dipakai beberapa sesi ujian (dulu dibaca berulang -> kuota 429).
// 2. Cache per-spreadsheet + pakai data lama jika Google gagal/429 (nilai tidak mendadak kosong).
// 3. Tombol refresh dibatasi (min. jeda 5 dtk per sheet) supaya klik beruntun tidak menghabiskan kuota.
// 4. Nama tab dikutip ('Form Responses 1'!A:AZ) -> aman untuk tab ber-spasi (Respons Formulir 1).
// 5. Deteksi kolom: judul PERSIS lebih dulu, baru judul pendek berawalan kata kunci. Judul soal yang
//    kebetulan memuat kata "kelas"/"total"/"nilai"/"nama" tidak lagi salah dianggap kolom identitas/skor.
//    Kolom nama yang tidak ditemukan TIDAK ditebak (dulu bisa terambil kolom email).
// 6. Kegagalan per-sheet tidak lagi diam: dikembalikan di `diagnostics` agar UI bisa menampilkan penyebabnya.
// 7. `token` ujian dihapus dari data respon (tidak ada gunanya untuk rekap dan membocorkan token).

import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const GS_ASESMEN_URL =
  process.env.GS_ASESMEN_URL ||
  "https://script.google.com/macros/s/AKfycbyNGdlYFNDpOET7BcJL6jwsJVFiLsYLt57_-B66YIHxa2Il75aPeFFMNEovgauKwnLM/exec";

const SHEET_TTL_MS = 20 * 1000; // data sheet dianggap segar
const MIN_REFRESH_GAP_MS = 5 * 1000; // jeda minimum antar pembacaan paksa per sheet
const UJIAN_TTL_MS = 20 * 1000; // daftar sesi ujian dari GAS

const sheetCache = new Map(); // spreadsheetId -> { at, rows }
let ujianCache = { at: 0, list: [] };

let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Autentikasi Google Service Account murni menggunakan Node.js crypto bawaan.
 * Tidak membutuhkan package eksternal 'googleapis' sehingga bundle sangat ringan dan bebas error deploy Vercel.
 */
async function getGoogleAccessToken() {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt - nowSec > 60) {
    return cachedAccessToken;
  }

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Kredensial Service Account belum lengkap di environment server (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)",
    );
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: nowSec + 3600,
    iat: nowSec,
  };

  const toBase64Url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsignedToken = `${toBase64Url(header)}.${toBase64Url(payload)}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signature = signer.sign(privateKey, "base64url");
  const assertion = `${unsignedToken}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Gagal autentikasi Google Service Account (${res.status}): ${errText}`);
    err.code = res.status;
    err.response = { status: res.status };
    throw err;
  }

  const data = await res.json();
  cachedAccessToken = data.access_token;
  tokenExpiresAt = nowSec + (data.expires_in || 3600);
  return cachedAccessToken;
}

function extractSheetId(url) {
  if (!url) return null;
  const match = String(url).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function friendlyError(err) {
  const code = err?.code || err?.response?.status;
  if (code === 403)
    return "Akses ditolak (403): bagikan Spreadsheet respon ke email bot sebagai Viewer";
  if (code === 404)
    return "Spreadsheet tidak ditemukan (404): periksa URL Spreadsheet respon";
  if (code === 429)
    return "Kuota Google Sheets terlampaui (429): coba lagi 1 menit lagi";
  return err?.message || "Gagal membaca spreadsheet";
}

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------
// DETEKSI KOLOM
// ------------------------------------------------------------------
function cariKolom(
  headers,
  { exact = [], starts = [], maxLen = 30, kata = null, tolak = null },
) {
  for (const e of exact) {
    const i = headers.indexOf(e);
    if (i >= 0) return i;
  }
  for (const s of starts) {
    const i = headers.findIndex((h) => h.length <= maxLen && h.startsWith(s));
    if (i >= 0) return i;
  }
  if (kata) {
    const i = headers.findIndex(
      (h) => h.length <= 40 && kata.test(h) && !(tolak && tolak.test(h)),
    );
    if (i >= 0) return i;
  }
  return -1;
}

function deteksiKolom(headers) {
  const timestamp = cariKolom(headers, {
    exact: ["timestamp", "cap waktu", "waktu", "tanggal"],
    starts: ["timestamp", "cap waktu"],
  });

  return {
    timestamp: timestamp >= 0 ? timestamp : 0,
    score: cariKolom(headers, {
      exact: [
        "score",
        "skor",
        "nilai",
        "total score",
        "total skor",
        "total nilai",
        "poin",
        "points",
        "point",
      ],
      starts: ["score", "skor", "nilai", "total score", "total skor"],
      maxLen: 20,
    }),
    nama: cariKolom(headers, {
      exact: [
        "nama",
        "nama lengkap",
        "nama siswa",
        "nama peserta",
        "nama peserta didik",
        "nama anda",
        "name",
        "full name",
      ],
      starts: ["nama"],
      kata: /\bnama\b/,
      tolak: /email|mapel|guru|orang tua|ayah|ibu|sekolah|kelas|mata pelajaran/,
    }),
    kelas: cariKolom(headers, {
      exact: ["kelas", "class", "kls", "kelas anda"],
      starts: ["kelas"],
      maxLen: 20,
    }),
    idSiswa: cariKolom(headers, {
      exact: [
        "id_siswa",
        "id siswa",
        "idsiswa",
        "id peserta",
        "id",
        "nis",
        "nisn",
        "nomor induk",
      ],
    }),
  };
}

// ------------------------------------------------------------------
// BACA SATU SPREADSHEET (cache + retry + fallback data lama)
// ------------------------------------------------------------------
async function fetchGoogleSheetsJson(endpointPath, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${endpointPath}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const errText = await res.text();
    const err = new Error(`Google Sheets API Error (${res.status}): ${errText}`);
    err.code = res.status;
    err.response = { status: res.status };
    throw err;
  }
  return await res.json();
}

async function ambilBaris(spreadsheetId) {
  const token = await getGoogleAccessToken();
  const meta = await fetchGoogleSheetsJson(
    `${spreadsheetId}?fields=sheets.properties.title`,
    token,
  );
  const sheetName = meta.sheets?.[0]?.properties?.title;
  if (!sheetName) return [];

  const kutip = `'${String(sheetName).replace(/'/g, "''")}'`;
  const range = encodeURIComponent(`${kutip}!A:AZ`);
  const valuesData = await fetchGoogleSheetsJson(
    `${spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    token,
  );
  return valuesData.values || [];
}

async function bacaSheetDenganCache(spreadsheetId, forceRefresh) {
  const now = Date.now();
  const cached = sheetCache.get(spreadsheetId);

  if (cached) {
    const umur = now - cached.at;
    const masihSegar = umur < SHEET_TTL_MS;
    const terlaluCepat = forceRefresh && umur < MIN_REFRESH_GAP_MS;
    if ((!forceRefresh && masihSegar) || terlaluCepat) {
      return { rows: cached.rows, stale: false };
    }
  }

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const rows = await ambilBaris(spreadsheetId);
      sheetCache.set(spreadsheetId, { at: Date.now(), rows });
      return { rows, stale: false };
    } catch (err) {
      lastErr = err;
      const code = err?.code || err?.response?.status;
      if (code === 429 || code >= 500) {
        await tidur(1200);
        continue;
      }
      break;
    }
  }

  if (cached)
    return { rows: cached.rows, stale: true, error: friendlyError(lastErr) };
  throw lastErr;
}

// ------------------------------------------------------------------
// DAFTAR SESI UJIAN DARI GAS
// ------------------------------------------------------------------
async function ambilDaftarUjian(forceRefresh, diagnostics) {
  const now = Date.now();
  if (
    !forceRefresh &&
    ujianCache.list.length > 0 &&
    now - ujianCache.at < UJIAN_TTL_MS
  ) {
    return ujianCache.list;
  }
  try {
    const resGas = await fetch(
      `${GS_ASESMEN_URL}?action=getData&semua=1&ujian_key=${encodeURIComponent(process.env.UJIAN_KEY || "SMKN1TELKU_UJIAN_ADMIN_SECURE_2026")}`,
      { cache: "no-store" },
    );
    if (!resGas.ok) throw new Error(`HTTP ${resGas.status}`);
    const json = await resGas.json();
    if (!Array.isArray(json))
      throw new Error("Respon sheet UJIAN tidak berbentuk daftar");
    ujianCache = { at: Date.now(), list: json };
    return json;
  } catch (err) {
    diagnostics.ujianError =
      "Gagal membaca sheet UJIAN: " + (err?.message || err);
    return ujianCache.list; // pakai data terakhir bila ada
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get("refresh") === "true";
    const filterKelas = norm(searchParams.get("kelas") || "");
    // Catatan: parameter `mapel` sengaja TIDAK dipakai menyaring di server. Penyaringan mapel dilakukan di
    // auditAsesmenHelper (toleran singkatan, mis. "ASJ" = "Administrasi Sistem Jaringan"); jika disaring
    // di sini dengan pencocokan teks biasa, nilai bisa hilang hanya karena penamaan mapel berbeda.

    const diagnostics = {
      totalSesi: 0,
      sheetDibaca: 0,
      totalRespon: 0,
      ujianError: null,
      tanpaLink: [], // sesi yang belum mengisi URL Spreadsheet respon
      linkTidakValid: [],
      gagalBaca: [], // sheet yang tidak bisa dibaca (403/404/429/dll)
      peringatan: [], // kolom tidak ketemu, sheet dipakai bersama, data lama dipakai
    };

    // 1. Daftar sesi ujian
    const daftarUjian = await ambilDaftarUjian(forceRefresh, diagnostics);
    diagnostics.totalSesi = daftarUjian.length;

    // 2. Kelompokkan sesi per spreadsheet (satu sheet dibaca sekali)
    const sheetMap = new Map(); // spreadsheetId -> [sesi...]
    for (const u of daftarUjian) {
      const rawUrl = u.sheet_respon_url || u.sheetUrl || u.sheet_url;
      if (!rawUrl || !String(rawUrl).trim()) {
        diagnostics.tanpaLink.push({ kelas: u.kls || "", mapel: u.mpl || "" });
        continue;
      }
      const id = extractSheetId(rawUrl);
      if (!id) {
        diagnostics.linkTidakValid.push({
          kelas: u.kls || "",
          mapel: u.mpl || "",
        });
        continue;
      }
      if (!sheetMap.has(id)) sheetMap.set(id, []);
      sheetMap.get(id).push(u);
    }

    // Jika diminta kelas tertentu, baca hanya sheet milik sesi kelas itu (hemat kuota)
    const sheetIds = Array.from(sheetMap.keys()).filter((id) => {
      if (!filterKelas) return true;
      return sheetMap.get(id).some((u) => {
        const k = norm(u.kls);
        return !k || k.includes(filterKelas) || filterKelas.includes(k);
      });
    });

    // 3. Baca spreadsheet paralel
    const hasilBaca = await Promise.allSettled(
      sheetIds.map((id) =>
        bacaSheetDenganCache(id, forceRefresh),
      ),
    );

    const allRowsCollected = [];

    hasilBaca.forEach((hasil, idx) => {
      const spreadsheetId = sheetIds[idx];
      const sesiList = sheetMap.get(spreadsheetId);
      const label = sesiList.map((u) => `${u.kls} - ${u.mpl}`).join(", ");

      if (hasil.status === "rejected") {
        console.warn(
          `[Rekap Nilai] Gagal membaca sheet (${label}):`,
          hasil.reason?.message,
        );
        diagnostics.gagalBaca.push({
          sesi: label,
          alasan: friendlyError(hasil.reason),
        });
        return;
      }

      const { rows, stale, error } = hasil.value;
      diagnostics.sheetDibaca += 1;
      if (stale && error)
        diagnostics.peringatan.push({
          sesi: label,
          pesan: `${error} (memakai data terakhir)`,
        });
      if (sesiList.length > 1) {
        diagnostics.peringatan.push({
          sesi: label,
          pesan: `Satu Spreadsheet respon dipakai ${sesiList.length} sesi; nilai per mapel dibedakan hanya dari sesi, bisa tertukar. Gunakan 1 Spreadsheet per sesi.`,
        });
      }

      if (rows.length < 2) return;

      const headers = rows[0].map((h) => norm(h));
      const col = deteksiKolom(headers);

      if (col.nama < 0) {
        diagnostics.peringatan.push({
          sesi: label,
          pesan:
            'Kolom "Nama" tidak ditemukan di Spreadsheet respon (judul kolom harus "Nama" / "Nama Lengkap")',
        });
        return;
      }
      if (col.score < 0) {
        diagnostics.peringatan.push({
          sesi: label,
          pesan:
            'Kolom "Score" tidak ada (Form belum dijadikan Kuis?) - nilai tampil "-"',
        });
      }

      rows.slice(1).forEach((r, rowIdx) => {
        const rowNama = (r[col.nama] || "").toString().trim();
        if (!rowNama) return;

        const rowTimestamp = r[col.timestamp] || "";
        const rowIdSiswa =
          col.idSiswa >= 0 ? (r[col.idSiswa] || "").toString().trim() : "";
        const rowKelasForm =
          col.kelas >= 0 ? (r[col.kelas] || "").toString().trim() : "";

        let nilaiRaw = "-";
        if (
          col.score >= 0 &&
          r[col.score] !== undefined &&
          String(r[col.score]).trim() !== ""
        ) {
          nilaiRaw = String(r[col.score]).trim();
        }

        // Satu entri per sesi yang memakai sheet ini (perilaku sama seperti sebelumnya, tanpa baca ulang API)
        sesiList.forEach((ujian) => {
          allRowsCollected.push({
            nama: rowNama,
            kelas: rowKelasForm || ujian.kls || "",
            mapel: ujian.mpl || "",
            id_siswa: rowIdSiswa,
            nilai: nilaiRaw,
            timestamp: rowTimestamp,
            rowOrder: rowIdx + 2,
            sumber: spreadsheetId,
          });
        });
      });
    });

    // 4. Filter opsional berdasarkan kelas
    let hasil = allRowsCollected;
    if (filterKelas) {
      hasil = hasil.filter((r) => {
        const k = norm(r.kelas);
        return !k || k.includes(filterKelas) || filterKelas.includes(k);
      });
    }

    diagnostics.totalRespon = hasil.length;

    return NextResponse.json({
      status: "success",
      totalRespon: hasil.length,
      data: hasil,
      responses: hasil,
      diagnostics,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API /exam/rekap-nilai] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal memproses rekap nilai ujian",
        data: [],
        responses: [],
      },
      { status: 500 },
    );
  }
}
