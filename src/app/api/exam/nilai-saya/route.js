// src/app/api/exam/nilai-saya/route.js
// Hasil ujian MILIK SATU SISWA untuk ditampilkan di halaman ujian siswa.
// Memakai data yang sama dengan /api/exam/rekap-nilai (nilai di Pantau Asesmen), tetapi hanya mengembalikan
// baris milik siswa yang diminta (nama harus sama persis setelah dinormalisasi). Tidak pernah mengirim data siswa lain.

import { NextResponse } from "next/server";
import { GET as rekapGET } from "../rekap-nilai/route";
import {
  normText,
  parseTimestampMs,
  isNamaMirip,
} from "@/lib/auditAsesmenHelper";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const kelasSerupa = (a, b) => {
  const x = normText(a);
  const y = normText(b);
  if (!x || !y) return true; // kelas tidak diketahui: andalkan nama
  return x === y || x.startsWith(y) || y.startsWith(x);
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const namaSiswaAsli = searchParams.get("nama") || "";
    const nama = normText(namaSiswaAsli);
    const kelas = searchParams.get("kelas") || "";

    if (!nama) {
      return NextResponse.json(
        { status: "error", message: "Nama siswa wajib diisi", hasil: [] },
        { status: 400 },
      );
    }

    const u = new URL(request.url);
    u.pathname = "/api/exam/rekap-nilai";
    u.search = ""; // tanpa filter kelas: pencocokan memakai nama (kelas portal bisa beda penulisan dengan kelas sesi)
    const resRekap = await rekapGET(new Request(u.toString()));
    const json = await resRekap.json();

    if (!json || json.status !== "success") {
      return NextResponse.json(
        {
          status: "error",
          message: json?.message || "Gagal membaca nilai",
          hasil: [],
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    }

    const semua = Array.isArray(json.data) ? json.data : [];
    // Nama: sama persis, atau sangat mirip dengan jumlah kata yang sama (beda y/i, huruf ganda, salah ketik 1 huruf).
    // Jumlah kata harus sama agar "Siti Aisyah" tidak mengambil nilai "Siti Nur Aisyah".
    const jumlahKata = nama.split(" ").filter(Boolean).length;
    const namaCocok = (namaRespon) => {
      const n = normText(namaRespon);
      if (!n) return false;
      if (n === nama) return true;
      return (
        n.split(" ").filter(Boolean).length === jumlahKata &&
        isNamaMirip(namaRespon, namaSiswaAsli)
      );
    };
    // ID di form (mis. NIS) bisa berbeda dengan ID akun portal (mis. no. WA), jadi ID TIDAK dipakai untuk menolak.
    const cocokNama = semua.filter((r) => namaCocok(r.nama));
    // Kelas hanya untuk memilih bila ada beberapa siswa bernama sama di kelas berbeda
    const sekelas = cocokNama.filter((r) => kelasSerupa(r.kelas, kelas));
    const milik = sekelas.length > 0 ? sekelas : cocokNama;
    // Petunjuk diagnosis (hanya angka): berapa respon yang memuat salah satu kata nama siswa ini
    const kataNama = nama.split(" ").filter((k) => k.length >= 3);
    const sebagian = semua.filter((r) => {
      const t = normText(r.nama).split(" ");
      return kataNama.some((k) => t.includes(k));
    }).length;

    // Satu hasil per mapel: respon paling awal (aturan resmi), lalu urutkan dari yang terbaru masuk
    const perMapel = new Map();
    milik.forEach((r) => {
      const k = normText(r.mapel) || "-";
      const ts = parseTimestampMs(r.timestamp) || 0;
      const lama = perMapel.get(k);
      if (!lama || (ts && ts < lama.ts) || (!lama.ts && ts)) {
        perMapel.set(k, {
          mapel: r.mapel || "-",
          nilai: r.nilai || "-",
          timestamp: r.timestamp || "",
          ts,
        });
      }
    });
    const hasil = [...perMapel.values()]
      .sort((a, b) => b.ts - a.ts)
      .map(({ mapel, nilai, timestamp }) => ({ mapel, nilai, timestamp }));

    return NextResponse.json(
      {
        status: "success",
        terakhir: hasil[0] || null,
        hasil,
        diag: {
          dibaca: semua.length,
          cocok: milik.length,
          sebagian,
          namaDicari: nama,
        },
        lastUpdated: json.lastUpdated || Date.now(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[API Nilai Saya] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: error.message || "Gagal memuat hasil",
        hasil: [],
      },
      { status: 500 },
    );
  }
}
