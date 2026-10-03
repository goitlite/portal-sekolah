"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSession, isLoggedIn, logout } from "../lib/auth";

import {
  getDashboardGuru,
  getTempatMagangGuru,
  getAktivitasGuru,
  getJurnalGuruWali,
  getDataSiswaWali,
  getJurnalPKL,
  getRekapSemua, // ⬅️ TAMBAHKAN
  getGuru, // ⬅️ TAMBAHKAN
  getMapelByGuru,
  addMapel,
  getKelasSiswaMapel,
  getSiswaByKelasMapel,
  getPresensiMapelGrid,
  getWaliKelasByGuru,
  getPresensiWaliGrid,
  getBiodataSiswa,
  updateBiodataSiswa,
  getSiswa, // ⬅️ Statistik Akun Siswa
} from "../lib/api";

import { generateLaporanPDF } from "../rekap/pdf/laporanMagang"; // ⬅️ TAMBAHKAN
import { generateLaporanGuruWaliPDF } from "./guru-wali/generateLaporanGuruWaliPDF";
import { generateLaporanMapelPDF } from "./guru-mapel/generateLaporanMapelPDF";
import { generateLaporanWaliKelasPDF } from "./guru-wali-kelas/generateLaporanWaliKelasPDF";
import CetakLaporanGuruWaliModal from "./guru-wali/CetakLaporanGuruWaliModal";
import CetakLaporanMapelModal from "./guru-mapel/CetakLaporanMapelModal";
import CetakLaporanWaliKelasModal from "./guru-wali-kelas/CetakLaporanWaliKelasModal";
import ModalPresensiMapel from "./guru-mapel/ModalPresensiMapel";
import ModalPresensiWaliKelas from "./guru-wali-kelas/ModalPresensiWaliKelas";
import ModalJurnalWaliKelas from "./guru-wali-kelas/kelola/ModalJurnalWaliKelas";
import ModalPilihPetugasPresensi from "./guru-wali-kelas/ModalPilihPetugasPresensi";
import {
  getPetugasFromWali,
  parseKeteranganWali,
} from "../lib/petugasPresensiHelper";
import IsiJurnalPklModal from "./IsiJurnalPklModal";
import { generateLaporanJurnalPKL } from "./generateLaporanJurnalPKL";

import ModalJurnalGuruWali from "./guru-wali/jurnal/ModalJurnalGuruWali";
import ModalLihatJurnalGuruWali from "./guru-wali/jurnal/ModalLihatJurnalGuruWali";
import { PesanGuruModal, useJumlahPesanBaru } from "../kepsek/PesanKepsekGuru";

// Daftar kelas statis (sama dengan kelola/page.js) — tidak bergantung pada API
const KELAS_OPTIONS = (
  <>
    <optgroup label="Kelas X" className="font-bold text-slate-900 bg-white">
      <option value="X TKJ 1" className="font-medium text-slate-800 bg-white">
        X TJKT 1
      </option>
      <option value="X TKJ 2" className="font-medium text-slate-800 bg-white">
        X TJKT 2
      </option>
      <option value="X DPIB" className="font-medium text-slate-800 bg-white">
        X DPIB
      </option>
      <option value="X TAV" className="font-medium text-slate-800 bg-white">
        X TAV
      </option>
      <option
        value="X GEOMATIKA"
        className="font-medium text-slate-800 bg-white"
      >
        X GEOMATIKA
      </option>
      <option value="X TO 1" className="font-medium text-slate-800 bg-white">
        X TO1
      </option>
      <option value="X TO 2" className="font-medium text-slate-800 bg-white">
        X TO2
      </option>
      <option value="X TO 3" className="font-medium text-slate-800 bg-white">
        X TO3
      </option>
      <option value="X TO 4" className="font-medium text-slate-800 bg-white">
        X TO4
      </option>
      <option value="X TPL" className="font-medium text-slate-800 bg-white">
        X TPL
      </option>
      <option value="X TITL 1" className="font-medium text-slate-800 bg-white">
        X TITL 1
      </option>
      <option value="X TITL 2" className="font-medium text-slate-800 bg-white">
        X TITL 2
      </option>
    </optgroup>
    <optgroup label="Kelas XI" className="font-bold text-slate-900 bg-white">
      <option value="XI TKJ 1" className="font-medium text-slate-800 bg-white">
        XI TJKT 1
      </option>
      <option value="XI TKJ 2" className="font-medium text-slate-800 bg-white">
        XI TJKT 2
      </option>
      <option value="XI DPIB" className="font-medium text-slate-800 bg-white">
        XI DPIB
      </option>
      <option value="XI TAV" className="font-medium text-slate-800 bg-white">
        XI TAV
      </option>
      <option
        value="XI GEOMATIKA"
        className="font-medium text-slate-800 bg-white"
      >
        XI GEOMATIKA
      </option>
      <option value="XI TBSM 1" className="font-medium text-slate-800 bg-white">
        XI TBSM 1
      </option>
      <option value="XI TBSM 2" className="font-medium text-slate-800 bg-white">
        XI TBSM 2
      </option>
      <option value="XI TAB" className="font-medium text-slate-800 bg-white">
        XI TAB
      </option>
      <option value="XI TKR" className="font-medium text-slate-800 bg-white">
        XI TKRO
      </option>
      <option value="XI TPL" className="font-medium text-slate-800 bg-white">
        XI TPL
      </option>
      <option value="XI TITL 1" className="font-medium text-slate-800 bg-white">
        XI TITL 1
      </option>
      <option value="XI TITL 2" className="font-medium text-slate-800 bg-white">
        XI TITL 2
      </option>
    </optgroup>
    <optgroup label="Kelas XII" className="font-bold text-slate-900 bg-white">
      <option value="TKJ 1" className="font-medium text-slate-800 bg-white">
        XII TJKT 1
      </option>
      <option value="TKJ 2" className="font-medium text-slate-800 bg-white">
        XII TJKT 2
      </option>
      <option value="DPIB" className="font-medium text-slate-800 bg-white">
        XII DPIB
      </option>
      <option value="TAV" className="font-medium text-slate-800 bg-white">
        XII TAV
      </option>
      <option value="GEOMATIKA" className="font-medium text-slate-800 bg-white">
        XII GEOMATIKA
      </option>
      <option value="TBSM 1" className="font-medium text-slate-800 bg-white">
        XII TBSM 1
      </option>
      <option value="TBSM 2" className="font-medium text-slate-800 bg-white">
        XII TBSM 2
      </option>
      <option value="TAB" className="font-medium text-slate-800 bg-white">
        XII TAB
      </option>
      <option value="TKR" className="font-medium text-slate-800 bg-white">
        XII TKRO
      </option>
      <option value="TPL" className="font-medium text-slate-800 bg-white">
        XII TPL
      </option>
      <option value="TITL" className="font-medium text-slate-800 bg-white">
        XII TITL
      </option>
    </optgroup>
    <optgroup label="Lainnya" className="font-bold text-slate-900 bg-white">
      <option value="CONTOH" className="font-medium text-slate-800 bg-white">
        KELAS CONTOH
      </option>
    </optgroup>
  </>
);

// --- OPTIMASI FOTO: paksa Google mengirim versi kecil, bukan resolusi asli ---
// Foto asli dari kamera HP bisa 3-8MB / 4000x3000px. Ditampilkan di thumbnail kecil
// tetap saja didekode browser di resolusi aslinya -> bisa habiskan ratusan MB RAM
// dan bikin tab crash/blank di HP dengan memori terbatas.
function optimizeFotoUrl(url, size = 300) {
  if (!url || typeof url !== "string") return url;

  // Format: https://lh3.googleusercontent.com/d/FILE_ID
  if (url.includes("googleusercontent.com")) {
    // Buang parameter ukuran lama kalau ada, lalu pasang yang baru
    const base = url.split("=")[0];
    return `${base}=w${size}-h${size}-c`;
  }

  // Format: https://drive.google.com/uc?id=FILE_ID atau /file/d/FILE_ID/view
  const driveIdMatch = url.match(/[-\w]{25,}/);
  if (url.includes("drive.google.com") && driveIdMatch) {
    return `https://lh3.googleusercontent.com/d/${driveIdMatch[0]}=w${size}-h${size}-c`;
  }

  return url;
}

function formatTanggal(waktu) {
  if (!waktu) return "-";
  const tanggal = new Date(waktu);
  if (isNaN(tanggal.getTime())) return waktu;
  return (
    tanggal.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " WIB"
  );
}
function formatTanggalKolom(tanggalISO) {
  if (!tanggalISO) return "";
  try {
    const d = new Date(tanggalISO);
    if (isNaN(d.getTime())) return tanggalISO;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return tanggalISO;
  }
}

const formatTanggalWaliIndo = (tanggalStr) => {
  if (!tanggalStr) return "";
  try {
    const d = new Date(tanggalStr);
    if (isNaN(d.getTime())) return String(tanggalStr);
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(tanggalStr);
  }
};

// Format nomor WhatsApp (08xxx / 62xxx -> https://wa.me/62xxx)
function getWhatsAppUrl(noHp) {
  if (!noHp) return null;
  let nomor = String(noHp).replace(/\D/g, "");
  if (!nomor) return null;
  if (nomor.startsWith("0")) {
    nomor = "62" + nomor.substring(1);
  } else if (!nomor.startsWith("62")) {
    nomor = "62" + nomor;
  }
  return `https://wa.me/${nomor}`;
}

// Bagikan template ID login ke nomor WhatsApp siswa
// Warna badge persentase kehadiran siswa Guru Wali.
function getStyleBadgePersen(persen) {
  if (persen === null || persen === undefined) {
    return {
      box: "bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-slate-100/80 text-slate-700",
      star: false,
      shine: false,
    };
  }

  if (persen >= 95) {
    return {
      box: "bg-gradient-to-br from-yellow-100 via-amber-300 to-yellow-500 border-yellow-100 text-amber-950 ring-1 ring-yellow-200/80 shadow-[0_0_12px_rgba(251,191,36,0.75)]",
      star: true,
      shine: true,
    };
  }

  if (persen >= 85) {
    return {
      box: "bg-gradient-to-br from-emerald-300 via-green-500 to-emerald-600 border-emerald-100/80 text-white",
      star: false,
      shine: false,
    };
  }

  if (persen >= 65) {
    return {
      box: "bg-gradient-to-br from-green-400 via-lime-400 to-yellow-300 border-lime-100/80 text-lime-950",
      star: false,
      shine: false,
    };
  }

  if (persen >= 55) {
    return {
      box: "bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 border-orange-100/80 text-orange-950",
      star: false,
      shine: false,
    };
  }

  return {
    box: "bg-gradient-to-br from-red-400 via-red-500 to-red-700 border-red-200/80 text-white",
    star: false,
    shine: false,
  };
}

function kirimLoginWhatsApp(idSiswa, namaSiswa) {
  if (!idSiswa) {
    alert("ID siswa tidak tersedia.");
    return;
  }
  const namaBersih = String(namaSiswa || "Siswa")
    .replace(/\s*\[.*?\]\s*/, "")
    .trim();
  const pesan = `Halo ${namaBersih}.\n\nSilakan login ke Portal SMKN 1 Teluk Kuantan:\nhttps://portalsmkn1telku.vercel.app/\n\nGunakan ID sesuai kartu Anda:\nNama: ${namaBersih}\nID: ${idSiswa}`;
  const url = `https://wa.me/?text=${encodeURIComponent(pesan)}`;
  window.open(url, "_blank");
}

// =========================================================
// KONFIGURASI: CATATAN PERKEMBANGAN MURID (LAMPIRAN B)
// =========================================================
const ASPEK_PEMANTAUAN = [
  { key: "akademik", label: "Akademik" },
  { key: "karakter", label: "Karakter" },
  { key: "sosial", label: "Sosial-Emosional" },
  { key: "disiplin", label: "Kedisiplinan" },
  { key: "potensi", label: "Potensi & Minat" },
];

const NAMA_BULAN_INDO = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const formatBulanTahun = (nilaiBulan) => {
  if (!nilaiBulan) return "-";
  const [tahun, bulan] = String(nilaiBulan).split("-");
  const indexBulan = Number(bulan) - 1;
  const namaBulan = NAMA_BULAN_INDO[indexBulan] || bulan;
  return `${namaBulan} ${tahun}`;
};

const capitalize = (str) =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : "";

const FORM_CATATAN_KOSONG = {
  periodeAwal: "",
  periodeAkhir: "",
  desAkademik: "",
  tinAkademik: "",
  ketAkademik: "",
  desKarakter: "",
  tinKarakter: "",
  ketKarakter: "",
  desSosial: "",
  tinSosial: "",
  ketSosial: "",
  desDisiplin: "",
  tinDisiplin: "",
  ketDisiplin: "",
  desPotensi: "",
  tinPotensi: "",
  ketPotensi: "",
};

// Bungkus satu request dengan batas waktu — tanpa ini, kalau Apps Script
// macet/lambat merespons, request bisa menggantung tanpa batas dan spinner
// tidak akan pernah berhenti berputar.
function fetchWithTimeout(fn, ms = 15000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Waktu tunggu server habis (timeout).")),
        ms,
      ),
    ),
  ]);
}

// Retry ringan untuk request awal dashboard — GAS kadang "cold start" dan
// gagal/lambat di percobaan pertama setelah idle lama, jadi dicoba sekali
// lagi sebelum benar-benar dianggap gagal.
async function fetchStepWithRetry(fn, { retries = 1, timeoutMs = 15000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchWithTimeout(fn, timeoutMs);
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
  }
  throw lastError;
}

// ============================================================
// OPTIMASI REQUEST GURU — SHARED IN-FLIGHT + SESSION CACHE
// Tujuan:
// 1. Dua bagian UI yang meminta data sama memakai 1 request yang sama.
// 2. Data yang baru dibaca tidak dibaca ulang selama TTL.
// 3. Refresh manual tetap bisa memaksa request terbaru.
// 4. Tidak mengubah endpoint Apps Script yang sudah ada.
// ============================================================
const guruInFlightRequests = new Map();
const GURU_CACHE_TTL_MS = 2 * 60 * 1000; // 2 menit
const GURU_READ_TIMEOUT_MS = 20000;

function readGuruSessionCache(key, ttlMs = GURU_CACHE_TTL_MS) {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return { hit: false, fresh: false, data: null };

    const parsed = JSON.parse(raw);

    // Format baru: { savedAt, data }
    if (
      parsed &&
      typeof parsed === "object" &&
      Object.prototype.hasOwnProperty.call(parsed, "savedAt") &&
      Object.prototype.hasOwnProperty.call(parsed, "data")
    ) {
      const age = Date.now() - Number(parsed.savedAt || 0);
      return {
        hit: true,
        fresh: Number.isFinite(age) && age >= 0 && age <= ttlMs,
        data: parsed.data,
      };
    }

    return { hit: false, fresh: false, data: null };
  } catch (err) {
    console.warn("Gagal membaca cache Guru:", err);
    return { hit: false, fresh: false, data: null };
  }
}

function writeGuruSessionCache(key, data) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (err) {
    console.warn("Cache Guru dilewati:", err);
  }
}

function removeGuruSessionCacheByPrefix(prefix) {
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    keys.forEach((key) => sessionStorage.removeItem(key));
  } catch (err) {
    console.warn("Gagal membersihkan cache Guru:", err);
  }
}

function getSharedGuruRequest(key, requestFn) {
  const existing = guruInFlightRequests.get(key);
  if (existing) return existing;

  const promise = Promise.resolve()
    .then(() => fetchWithTimeout(requestFn, GURU_READ_TIMEOUT_MS))
    .finally(() => {
      guruInFlightRequests.delete(key);
    });

  guruInFlightRequests.set(key, promise);
  return promise;
}

async function getCachedGuruData({
  key,
  fetcher,
  forceRefresh = false,
  ttlMs = GURU_CACHE_TTL_MS,
}) {
  if (!forceRefresh) {
    const cached = readGuruSessionCache(key, ttlMs);
    if (cached.hit && cached.fresh) {
      return { success: true, data: cached.data, fromCache: true };
    }
  }

  const res = await getSharedGuruRequest(key, fetcher);

  if (res?.success) {
    writeGuruSessionCache(key, res.data);
  }

  return res;
}

// Retry khusus alur CETAK (bukan loading dashboard) — bedanya dari
// fetchStepWithRetry di atas: di sini respons ber-`success: false` (misalnya
// GAS sempat cold-start dan balas error, tapi tidak "throw" secara teknis)
// JUGA dianggap kegagalan dan ikut di-retry, bukan cuma network/timeout.
// Ini akar masalah kenapa cetak laporan sering gagal PERSIS SEKALI di
// percobaan pertama (login baru = GAS belum "panas") lalu sukses begitu
// tombol ditekan ulang: percobaan pertama gagal diam-diam dan dibaca kode
// sebagai "datanya kosong", padahal sebenarnya request-nya yang gagal.
// Retry 2x (3 percobaan total) karena mencetak adalah aksi sesekali yang
// wajar ditunggu sedikit lebih lama demi hasil yang benar.
async function fetchPrintDataWithRetry(
  fn,
  { retries = 2, delayMs = 1200, onRetry } = {},
) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await fetchWithTimeout(fn, 15000);
      if (result && result.success === false) {
        throw new Error(
          result.message || "Permintaan ke server gagal diproses.",
        );
      }
      return result;
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        if (typeof onRetry === "function") {
          onRetry(attempt + 1, retries);
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

// =========================================================
// PERSENTASE KEHADIRAN + TINGKAT WARNA (kartu Guru Mapel & Wali Kelas)
// Persen = Hadir / (Hadir+Sakit+Izin+Alfa+Cabut) x 100
// =========================================================
function hitungPersenKehadiran(d) {
  if (!d) return null;
  const jumlah =
    (d.hadir || 0) +
    (d.sakit || 0) +
    (d.izin || 0) +
    (d.alfa || 0) +
    (d.cabut || 0);
  if (!jumlah) return null;
  return Math.round(((d.hadir || 0) / jumlah) * 100);
}

// Gabungkan semua sesi yang sudah diisi (untuk persen keseluruhan)
function gabungStatistikSesi(perSesiMap) {
  const t = { hadir: 0, sakit: 0, izin: 0, alfa: 0, cabut: 0 };
  Object.values(perSesiMap || {}).forEach((d) => {
    if (!d || !d.sudahDiisi) return;
    t.hadir += d.hadir || 0;
    t.sakit += d.sakit || 0;
    t.izin += d.izin || 0;
    t.alfa += d.alfa || 0;
    t.cabut += d.cabut || 0;
  });
  return t;
}

function tierPersenKehadiran(persen) {
  // Warna pakai inline style (hex) supaya pasti tampil, tidak tergantung class Tailwind.
  if (persen === null || persen === undefined)
    return {
      label: "Belum ada data",
      text: "#64748b",
      bg: "#e2e8f0",
      from: "#94a3b8",
      to: "#64748b",
    };
  if (persen >= 90)
    return {
      label: "Sangat Baik",
      text: "#065f46",
      bg: "#a7f3d0",
      from: "#34d399",
      to: "#059669",
    };
  if (persen >= 80)
    return {
      label: "Baik",
      text: "#3f6212",
      bg: "#d9f99d",
      from: "#a3e635",
      to: "#65a30d",
    };
  if (persen >= 70)
    return {
      label: "Cukup",
      text: "#92400e",
      bg: "#fde68a",
      from: "#fbbf24",
      to: "#d97706",
    };
  if (persen >= 60)
    return {
      label: "Kurang",
      text: "#9a3412",
      bg: "#fed7aa",
      from: "#fb923c",
      to: "#ea580c",
    };
  return {
    label: "Rendah",
    text: "#9f1239",
    bg: "#fecdd3",
    from: "#fb7185",
    to: "#e11d48",
  };
}

function PersenKehadiranBar({ data, label, semuaData, jumlahSesi }) {
  // Gaya sama dengan kolom % pada tabel presensi: kotak kecil berwarna sesuai tingkat.
  const persen = hitungPersenKehadiran(data);
  const persenSemua = hitungPersenKehadiran(semuaData);
  const tier = tierPersenKehadiran(persen);
  const tierSemua = tierPersenKehadiran(persenSemua);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white/90 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap shadow-sm">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        📈 % Kehadiran {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="px-2 py-0.5 rounded text-xs font-black"
          style={{ color: tier.text, backgroundColor: tier.bg }}
          title={tier.label}
        >
          {persen === null ? "-" : `${persen}%`}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase"
          style={{ color: tier.text, backgroundColor: tier.bg }}
        >
          {tier.label}
        </span>
        {persenSemua !== null && jumlahSesi > 1 && (
          <span
            className="px-2 py-0.5 rounded text-[10px] font-black"
            style={{ color: tierSemua.text, backgroundColor: tierSemua.bg }}
            title={`Keseluruhan ${jumlahSesi} sesi: ${tierSemua.label}`}
          >
            Total {persenSemua}%
          </span>
        )}
      </div>
    </div>
  );
}

function DashboardGuruContent() {
  const router = useRouter();
  // v2: dinaikkan supaya cache lama yang mungkin korup (struktur tidak lengkap)
  // otomatis diabaikan begitu fix ini live, tanpa perlu user hapus data browser manual.
  const CACHE_KEY = "dashboardGuruCache_v3";
  // --- STATE UNTUK TAB MENU UTAMA ---
  const [activeMenuTab, setActiveMenuTab] = useState("pembimbing");

  const [showPilihCetakPklModal, setShowPilihCetakPklModal] = useState(false);

  const [selectedTanggalWali, setSelectedTanggalWali] = useState({});

  // --- STATE BARU JURNAL PKL ---
  const [showJurnalPklModal, setShowJurnalPklModal] = useState(false);
  const [includeCetakJurnalPkl, setIncludeCetakJurnalPkl] = useState(false);
  const [loadingCetakJurnalPkl, setLoadingCetakJurnalPkl] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0); // ⬅️ TAMBAHKAN: progress bar batang
  const [loadFailed, setLoadFailed] = useState(false); // ⬅️ TAMBAHKAN: status gagal total
  const [loadFailedMessage, setLoadFailedMessage] = useState(""); // ⬅️ TAMBAHKAN
  const isMountedRef = useRef(true); // ⬅️ TAMBAHKAN: pengganti isMounted lokal agar bisa dipakai ulang oleh tombol refresh
  const [user, setUser] = useState(null);

  // --- PESAN DARI / KE KEPALA SEKOLAH ---
  const [showPesanKepsek, setShowPesanKepsek] = useState(false);
  const [jumlahPesanBaru, refreshPesanBaru] = useJumlahPesanBaru({
    role: "guru",
    idGuru: user?.id ? String(user.id) : "",
    enabled: !!user?.id,
  });
  const [aktivitas, setAktivitas] = useState([]);
  const [tempatMagang, setTempatMagang] = useState([]);
  const [dashboard, setDashboard] = useState({
    jumlahSiswa: "--",
    hadirHariIni: "--",
    totalHadir: "--",
    izinSakit: "--",
    // Ekspektasi array list nama dari API backend:
    listJumlahSiswa: [],
    listHadirHariIni: [],
    listTotalHadir: [],
    listIzinSakit: [],
  });

  // --- STATE UNTUK MODAL NAMA SISWA ---
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: "",
    data: [],
  });

  // --- STATE STATISTIK AKUN SISWA (SHEET SISWA - SEMUA KELAS) ---
  const [dataMasterSiswa, setDataMasterSiswa] = useState([]);
  const [loadingMasterSiswa, setLoadingMasterSiswa] = useState(false);
  const [statModalConfig, setStatModalConfig] = useState({
    isOpen: false,
    title: "",
    data: [],
    breakdownKelas: null,
  });
  const [statModalSearch, setStatModalSearch] = useState("");
  // Tab aktif di modal: "statistik" | "semua" | "X" | "XI" | "XII"
  const [statModalTab, setStatModalTab] = useState("statistik");

  // Guru Pembimbing PKL diturunkan langsung dari dataMasterSiswa.
  // Tidak ada request tambahan ke Apps Script.
  const guruPklSiswa = useMemo(() => {
    const peta = {};

    (dataMasterSiswa || []).forEach((row) => {
      const id = String(
        row?.id ?? row?.ID ?? row?.idSiswa ?? row?.ID_SISWA ?? "",
      ).trim();

      if (!id) return;

      const namaGuru = String(
        row?.namaGuru ?? row?.NAMA_GURU ?? row?.nama_guru ?? "",
      ).trim();

      if (
        namaGuru &&
        namaGuru !== "-" &&
        namaGuru !== "0" &&
        namaGuru.toLowerCase() !== "null" &&
        !namaGuru.toLowerCase().includes("belum")
      ) {
        peta[id] = namaGuru;
      }
    });

    return peta;
  }, [dataMasterSiswa]);

  // --- STATE UNTUK GALERI AKTIVITAS & FULLSCREEN ---
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [loadingCetakWali, setLoadingCetakWali] = useState(false);
  const [showLaporanWaliModal, setShowLaporanWaliModal] = useState(false);

  const [showJurnalGuruWaliModal, setShowJurnalGuruWaliModal] = useState(false);
  const [showLihatJurnalGuruWaliModal, setShowLihatJurnalGuruWaliModal] =
    useState(false);
  const [showCetakMapelModal, setShowCetakMapelModal] = useState(false);

  // --- STATE KHUSUS TAB GURU WALI ---
  const [dataSiswaWali, setDataSiswaWali] = useState([]);
  const [loadingSiswaWali, setLoadingSiswaWali] = useState(false);
  const [errorSiswaWali, setErrorSiswaWali] = useState("");
  const [siswaWaliLoaded, setSiswaWaliLoaded] = useState(false);
  const [searchSiswaWali, setSearchSiswaWali] = useState("");
  const [selectedSiswaWali, setSelectedSiswaWali] = useState(null);
  // Persentase kehadiran per siswa (diambil dari grid presensi wali kelas)
  const [persenHadirSiswa, setPersenHadirSiswa] = useState({});
  const [loadingPersenHadir, setLoadingPersenHadir] = useState(false);

  // --- STATE CATATAN PERKEMBANGAN (LAMPIRAN B) ---
  const [showCatatanModal, setShowCatatanModal] = useState(false);
  const [siswaCatatanAktif, setSiswaCatatanAktif] = useState(null);
  const [loadingCatatan, setLoadingCatatan] = useState(false);
  const [savingCatatan, setSavingCatatan] = useState(false);
  const [formCatatan, setFormCatatan] = useState(FORM_CATATAN_KOSONG);

  // --- STATE KHUSUS TAB GURU MAPEL ---
  const [daftarMapel, setDaftarMapel] = useState([]);
  const [loadingMapel, setLoadingMapel] = useState(false);
  const [errorMapel, setErrorMapel] = useState("");
  const [mapelLoaded, setMapelLoaded] = useState(false);
  const [searchMapel, setSearchMapel] = useState("");
  const [cetakMapelCardLoadingId, setCetakCardLoadingId] = useState(null);
  const [mapelPresensiAktif, setMapelPresensiAktif] = useState(null);
  const [statsPresensiMapel, setStatsPresensiMapel] = useState({});
  const [loadingStatsMapel, setLoadingStatsMapel] = useState({});
  const [selectedPertemuanMapel, setSelectedPertemuanMapel] = useState({});

  // --- STATE FORM TAMBAH MAPEL INLINE (di tab mapel, tanpa redirect ke kelola) ---
  const [isFormTambahMapelOpen, setIsFormTambahMapelOpen] = useState(false);
  const [formNamaMapel, setFormNamaMapel] = useState("");
  const [formKelasDipilih, setFormKelasDipilih] = useState("");
  const [formKeterangan, setFormKeterangan] = useState("");
  const [formJenisMapel, setFormJenisMapel] = useState("biasa"); // "biasa" | "online"
  const [formSavingMapel, setFormSavingMapel] = useState(false);
  const [formDaftarKelas, setFormDaftarKelas] = useState([]);
  const [formLoadingKelas, setFormLoadingKelas] = useState(false);
  const [formPreviewSiswa, setFormPreviewSiswa] = useState([]);
  const [formLoadingPreview, setFormLoadingPreview] = useState(false);

  // --- STATE KHUSUS TAB GURU WALI KELAS ---

  const [daftarWaliKelas, setDaftarWaliKelas] = useState([]);
  const [loadingWaliKelas, setLoadingWaliKelas] = useState(false);
  const [errorWaliKelas, setErrorWaliKelas] = useState("");
  const [waliKelasLoaded, setWaliKelasLoaded] = useState(false);
  const [searchWaliKelas, setSearchWaliKelas] = useState("");
  const [cetakWaliKelasCardLoadingId, setCetakWaliKelasCardLoadingId] =
    useState(null);
  const [waliKelasPresensiAktif, setWaliKelasPresensiAktif] = useState(null);
  const [waliKelasJurnalAktif, setWaliKelasJurnalAktif] = useState(null);
  const [waliPetugasTarget, setWaliPetugasTarget] = useState(null);
  const [showCetakWaliKelasModal, setShowCetakWaliKelasModal] = useState(false);
  const [statsPresensiHariIniWali, setStatsPresensiHariIniWali] = useState({});
  const [loadingStatsWali, setLoadingStatsWali] = useState({});

  const [loadingCetakLaporanMonitoring, setLoadingCetakLaporanMonitoring] =
    useState(false);
  const [progressPdfMonitoring, setProgressPdfMonitoring] = useState(0); // ⬅️ TAMBAHKAN
  const [retryStatusText, setRetryStatusText] = useState(""); // ⬅️ TAMBAHKAN: pesan saat retry cetak

  const [showCetakModal, setShowCetakModal] = useState(false);
  const [formDataCetak, setFormDataCetak] = useState({
    nip: "",
    pangkat: "",
    jabatan: "",
    spt: "",
  });

  // 👇 TAMBAHAN STATE UNTUK LAPORAN PERJALANAN DINAS
  const [includePerjalananDinas, setIncludePerjalananDinas] = useState(false);
  // Generate tanggal otomatis sesuai saat form dibuka
  const hariIni = new Date();
  const namaBulanMap = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const tanggalOtomatisInit = `${hariIni.getDate()} ${namaBulanMap[hariIni.getMonth()]} ${hariIni.getFullYear()}`;

  const [formPerjalananDinas, setFormPerjalananDinas] = useState({
    dasar: "Surat Perintah Tugas Kepala Sekolah tentang Siswa PKL 2026",
    tempatKegiatan: "Teluk Kuantan",
    tanggalPelaksanaan: "04 September 2026",
    pelaksanaKegiatan:
      "Pembimbing Praktik Kerja Lapangan (PKL) SMKN 1 Teluk Kuantan",
    namaKegiatan: "Monitoring Siswa PKL 2026",
    tujuanKegiatan: "Melakukan Monitoring Siswa PKL 2026",
    sasaranKegiatan: "Siswa PKL 2026 SMKN 1 Teluk Kuantan",
    prosesKegiatan:
      "Kegiatan Monitoring Siswa Praktik Kerja Lapangan (PKL) SMKN 1 Teluk Kuantan Tahun Pelajaran 2026/2027 dilaksanakan pada tanggal 03 September 2026 di Teluk Kuantan. Kegiatan diawali dengan monitoring ke PT. Telkom, dilanjutkan ke Kantor Diskominfo Kuansing, Toko Kita Store, dan terakhir Kantor Mayatama Net. Dalam kegiatan tersebut, guru pembimbing memantau presensi online, perkembangan kompetensi, jurnal kegiatan, serta permasalahan yang dihadapi siswa dan berkoordinasi dengan pihak Dunia Usaha dan Dunia Industri (DUDI)",
    hasilKegiatan:
      "Kegiatan Monitoring Siswa PKL berjalan dengan baik dan sesuai rencana. Siswa mampu beradaptasi dengan lingkungan Dunia Usaha dan Dunia Industri (DUDI) serta memperoleh pengalaman kerja yang bermanfaat untuk meningkatkan kompetensi dan kesiapan memasuki dunia kerja.",
    saranSaran:
      "Perlu ditingkatkan kerja sama dengan lebih banyak DUDI yang profesional dan relevan sebagai mitra strategis dalam mendukung peningkatan kompetensi peserta didik.",
    tanggalTtd: tanggalOtomatisInit, // <-- Form akan terisi secara otomatis mengikuti tanggal hari ini
  });

  // 👇 TAMBAHAN STATE UNTUK FITUR "TAMBAH FOTO LAMPIRAN"
  const [includeFotoLampiran, setIncludeFotoLampiran] = useState(false);
  const [fotoLampiranList, setFotoLampiranList] = useState([
    { namaTempat: "", fotoBase64: "", fotoWidth: 0, fotoHeight: 0 },
  ]);

  // Tambah baris baru (tombol ikon "+")
  function tambahBarisFotoLampiran() {
    setFotoLampiranList((prev) => [
      ...prev,
      { namaTempat: "", fotoBase64: "", fotoWidth: 0, fotoHeight: 0 },
    ]);
  }

  // Hapus satu baris
  function hapusBarisFotoLampiran(index) {
    setFotoLampiranList((prev) => prev.filter((_, i) => i !== index));
  }

  // Ubah nama tempat magang pada baris tertentu
  function ubahNamaTempatFotoLampiran(index, value) {
    setFotoLampiranList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, namaTempat: value } : row)),
    );
  }

  // Upload & kompres foto lampiran ringan (maks 1200px) agar ukuran PDF wajar
  async function handleUploadFotoLampiran(index, file) {
    if (!file) return;
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const img = await new Promise((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = dataUrl;
      });

      const MAX_DIM = 1200;
      let targetW = img.width;
      let targetH = img.height;
      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        if (targetW > targetH) {
          targetH = Math.round((targetH * MAX_DIM) / targetW);
          targetW = MAX_DIM;
        } else {
          targetW = Math.round((targetW * MAX_DIM) / targetH);
          targetH = MAX_DIM;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, targetW, targetH);
      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.8);

      setFotoLampiranList((prev) =>
        prev.map((row, i) =>
          i === index
            ? {
                ...row,
                fotoBase64: compressedDataUrl,
                fotoWidth: targetW,
                fotoHeight: targetH,
              }
            : row,
        ),
      );
    } catch (err) {
      console.error("Gagal memproses foto lampiran:", err);
      alert("Gagal memproses foto. Coba gunakan file gambar lain.");
    }
  }

  // 👇 TAMBAHKAN KODE INI UNTUK MENGINGAT ISIAN FORM
  useEffect(() => {
    const savedData = localStorage.getItem("dataPernyataanMutlak");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormDataCetak({
          nip: parsed.nip || "",
          pangkat: parsed.pangkat || "",
          jabatan: parsed.jabatan || "",
          spt: parsed.spt || "",
        });
      } catch (e) {
        console.error("Gagal membaca data dari localStorage", e);
      }
    }
  }, []);

  // loadDashboard dibuat sebagai fungsi biasa (bukan hanya di dalam useEffect)
  // supaya bisa dipanggil ulang oleh tombol "🔄 Muat Ulang" saat gagal, tanpa
  // perlu reload seluruh halaman.
  const loadDashboard = useCallback(
    async (forceRefresh = false) => {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();

      if (!session || session.role !== "guru") {
        router.replace("/magang/login");
        return;
      }

      const dashboardCacheKey = `${CACHE_KEY}_${String(session.id)}`;

      if (isMountedRef.current) {
        setUser(session);
        setLoadFailed(false);
        setLoadFailedMessage("");
        if (forceRefresh) setLoadProgress(8);
      }

      // Cache dashboard per-GURU.
      // Cache fresh -> tampil instan dan tidak melakukan request.
      // Cache stale -> tampilkan cache dulu, lalu refresh di background.
      let usedCache = false;
      try {
        const cachedRaw = localStorage.getItem(dashboardCacheKey);
        if (cachedRaw) {
          const payload = JSON.parse(cachedRaw);
          const cachedData = payload?.data ?? null;
          const savedAt = Number(payload?.savedAt || 0);

          const isValidCache =
            cachedData &&
            typeof cachedData === "object" &&
            cachedData.dashboard &&
            typeof cachedData.dashboard === "object" &&
            Array.isArray(cachedData.tempatMagang) &&
            Array.isArray(cachedData.aktivitas);

          if (isValidCache) {
            setDashboard(cachedData.dashboard);
            setTempatMagang(cachedData.tempatMagang);
            setAktivitas(cachedData.aktivitas);
            usedCache = true;

            const age = Date.now() - savedAt;
            const fresh =
              !forceRefresh &&
              Number.isFinite(age) &&
              age >= 0 &&
              age <= GURU_CACHE_TTL_MS;

            if (fresh) {
              setLoadProgress(100);
              setLoading(false);
              return;
            }

            if (!forceRefresh) {
              setLoading(false);
            }
          } else {
            localStorage.removeItem(dashboardCacheKey);
          }
        }
      } catch (error) {
        console.warn("Gagal membaca cache dashboard:", error);
        localStorage.removeItem(dashboardCacheKey);
      }

      const totalSteps = 3;
      let doneSteps = 0;
      const bumpProgress = () => {
        doneSteps += 1;
        if (isMountedRef.current) {
          setLoadProgress(10 + Math.round((doneSteps / totalSteps) * 80));
        }
      };

      try {
        const [result, tempat, aktivitasResult] = await Promise.allSettled([
          getSharedGuruRequest(`dashboard:${session.id}`, () =>
            getDashboardGuru(session.id),
          ).finally(bumpProgress),
          getSharedGuruRequest(`tempat:${session.id}`, () =>
            getTempatMagangGuru(session.id),
          ).finally(bumpProgress),
          getSharedGuruRequest(`aktivitas:${session.id}`, () =>
            getAktivitasGuru(session.id),
          ).finally(bumpProgress),
        ]);

        if (!isMountedRef.current) return;

        const dashboardData =
          result.status === "fulfilled" &&
          result.value?.success &&
          result.value?.data
            ? result.value.data
            : null;

        const tempatDataRaw =
          tempat.status === "fulfilled" && tempat.value?.success
            ? tempat.value.data
            : [];
        const tempatData = Array.isArray(tempatDataRaw) ? tempatDataRaw : [];

        const aktivitasDataRaw =
          aktivitasResult.status === "fulfilled" &&
          aktivitasResult.value?.success
            ? aktivitasResult.value.data
            : [];
        const aktivitasData = Array.isArray(aktivitasDataRaw)
          ? aktivitasDataRaw
          : [];

        if (dashboardData) {
          const serverData = {
            dashboard: dashboardData,
            tempatMagang: tempatData,
            aktivitas: aktivitasData,
          };

          setDashboard(serverData.dashboard);
          setTempatMagang(serverData.tempatMagang);
          setAktivitas(serverData.aktivitas);
          setLoadProgress(100);

          try {
            localStorage.setItem(
              dashboardCacheKey,
              JSON.stringify({ savedAt: Date.now(), data: serverData }),
            );
          } catch (cacheErr) {
            console.warn("Cache dashboard dilewati:", cacheErr);
          }
        } else if (!usedCache) {
          setLoadFailed(true);
          setLoadFailedMessage(
            result.status === "rejected"
              ? "Koneksi ke server terputus atau server lambat merespons."
              : "Data dashboard tidak ditemukan di server.",
          );
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        if (!usedCache) {
          setLoadFailed(true);
          setLoadFailedMessage(
            "Terjadi kesalahan saat mengambil data. Periksa koneksi internet Anda.",
          );
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [router, CACHE_KEY],
  );

  useEffect(() => {
    isMountedRef.current = true;
    loadDashboard();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadDashboard]);

  function handleLogout() {
    if (!confirm("Keluar dari aplikasi?")) return;

    const currentUser = user?.id ? String(user.id) : "";

    if (currentUser) {
      localStorage.removeItem(`${CACHE_KEY}_${currentUser}`);
    }

    localStorage.removeItem(CACHE_KEY); // kompatibilitas cache lama
    localStorage.removeItem("dashboardSiswaCache");

    removeGuruSessionCacheByPrefix("guru:v3:");
    sessionStorage.removeItem("api:getSiswa");
    sessionStorage.removeItem("guru_cache_master_siswa");

    logout();
    router.replace("/magang/login");
  }

  function mulaiMonitoring(tempat) {
    localStorage.setItem("tempatMagangMonitoring", tempat);
    router.push("/magang/guru/monitoring");
  }

  // --- FUNGSI KLIK CARD STATISTIK ---
  function handleCardClick(title, listData) {
    setModalConfig({
      isOpen: true,
      title: title,
      data: listData || [],
    });
  }

  // --- FUNGSI NAVIGASI GALERI ---
  const handleNextImage = (e) => {
    e.stopPropagation();
    setGalleryIndex((prev) => (prev + 1) % aktivitas.length);
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    setGalleryIndex((prev) => (prev - 1 + aktivitas.length) % aktivitas.length);
  };

  // --- CETAK LAPORAN JURNAL GURU WALI (PDF) ---
  const handleCetakLaporanGuruWali = async () => {
    if (!user?.id || loadingCetakWali) return;

    setLoadingCetakWali(true);

    try {
      const res = await getJurnalGuruWali(user.id);
      const daftarJurnal = res?.data || res || [];

      if (!Array.isArray(daftarJurnal) || daftarJurnal.length === 0) {
        alert("Belum ada jurnal pertemuan yang tercatat untuk dicetak.");
        return;
      }

      await generateLaporanGuruWaliPDF({
        data: daftarJurnal,
        namaGuru: user?.nama || daftarJurnal[0]?.namaGuru,
      });
    } catch (error) {
      console.error("Gagal mencetak laporan guru wali:", error);
      alert(
        "Gagal mencetak laporan: " + (error?.message || "Terjadi kesalahan"),
      );
    } finally {
      setLoadingCetakWali(false);
    }
  };

  // --- FUNGSI CETAK JURNAL PKL ---
  const handleCetakJurnalPkl = async () => {
    if (!user?.id || loadingCetakJurnalPkl) return;
    setLoadingCetakJurnalPkl(true);
    try {
      const res = await getJurnalPKL(user.id);
      const daftarJurnal = res?.data || [];
      if (!Array.isArray(daftarJurnal) || daftarJurnal.length === 0) {
        alert("Belum ada jurnal PKL yang tercatat untuk dicetak.");
        return;
      }
      await generateLaporanJurnalPKL({
        data: daftarJurnal,
        namaGuru: user?.nama,
      });
    } catch (error) {
      alert(
        "Gagal mencetak jurnal PKL: " + (error?.message || "Terjadi kesalahan"),
      );
    } finally {
      setLoadingCetakJurnalPkl(false);
    }
  };

  const handleCetakLaporanMonitoringLangsung = async () => {
    if (!user?.id || loadingCetakLaporanMonitoring) return;
    setLoadingCetakLaporanMonitoring(true);
    setProgressPdfMonitoring(0);
    setRetryStatusText("");

    try {
      // Simpan form (perilaku sama seperti alur lama)
      localStorage.setItem(
        "dataPernyataanMutlak",
        JSON.stringify({ nama: user?.nama, ...formDataCetak }),
      );

      if (includePerjalananDinas) {
        localStorage.setItem(
          "dataPerjalananDinas",
          JSON.stringify(formPerjalananDinas),
        );
      } else {
        localStorage.removeItem("dataPerjalananDinas");
      }

      if (includeCetakJurnalPkl) {
        await handleCetakJurnalPkl();
      }

      // Samakan format "bulan" persis seperti targetBulanRekap di alur lama
      const date = new Date();
      const namaBulan = [
        "Januari",
        "Februari",
        "Maret",
        "April",
        "Mei",
        "Juni",
        "Juli",
        "Agustus",
        "September",
        "Oktober",
        "November",
        "Desember",
      ];
      const bulanTerbaru = `${namaBulan[date.getMonth()]} ${date.getFullYear()}`;

      // Ambil data rekap & daftar guru SECARA PARALEL (bukan berurutan) dengan
      // retry otomatis + cek `success` eksplisit. Ini memperbaiki bug: kalau
      // login baru saja dilakukan (GAS belum "panas"), percobaan pertama bisa
      // gagal/timeout secara diam-diam dan sebelumnya dibaca sebagai "data
      // kosong" — padahal sebenarnya request-nya yang gagal. Sekarang gagal
      // di percobaan pertama akan otomatis dicoba lagi hingga 2x sebelum
      // benar-benar dianggap gagal.
      setProgressPdfMonitoring(5);
      const [hasilRekap, resGuru] = await Promise.all([
        fetchPrintDataWithRetry(
          () => getRekapSemua(bulanTerbaru, "", user.id),
          {
            onRetry: (attempt, total) =>
              setRetryStatusText(
                `Server lambat merespons, mencoba lagi... (${attempt}/${total})`,
              ),
          },
        ),
        fetchPrintDataWithRetry(() => getGuru()),
      ]);
      setRetryStatusText("");
      setProgressPdfMonitoring(18);

      const dataRekap = hasilRekap?.data || [];
      let guruList = resGuru?.data || [];
      guruList = [...guruList].sort((a, b) =>
        (a.NAMA_GURU || "").localeCompare(b.NAMA_GURU || ""),
      );

      // Filter identik dengan filteredDataToRender (filterNama="", filterKelas="Semua", tempat="Semua")
      const filteredDataToRender = dataRekap
        .filter((item) => (item.siswa || []).length > 0)
        .sort((a, b) => a.tempat.localeCompare(b.tempat));

      if (filteredDataToRender.length === 0) {
        alert(
          "Tidak ada data untuk dicetak. Pastikan sudah ada presensi tercatat.",
        );
        return;
      }

      // Cari namaGuru — persis logika handleDownloadPDF di halaman Rekap
      const guruObj = guruList.find((g) => {
        const finalId =
          g.id ||
          g.ID ||
          g.ID_GURU ||
          g.id_guru ||
          g.idGuru ||
          g.NAMA_GURU ||
          g.nama ||
          "";
        return finalId === user.id;
      });
      const namaGuru = guruObj
        ? guruObj.NAMA || guruObj.nama || guruObj.NAMA_GURU || guruObj.nama_guru
        : user.id;

      const dataPernyataanStr = localStorage.getItem("dataPernyataanMutlak");
      const dataPernyataan = dataPernyataanStr
        ? JSON.parse(dataPernyataanStr)
        : null;

      const dataPerjalananStr = localStorage.getItem("dataPerjalananDinas");
      const dataPerjalanan = dataPerjalananStr
        ? JSON.parse(dataPerjalananStr)
        : null;

      // Foto lampiran tambahan (hanya baris yang sudah diisi foto)
      const dataFotoLampiran = includeFotoLampiran
        ? fotoLampiranList.filter((item) => item.fotoBase64)
        : null;

      await generateLaporanPDF({
        data: filteredDataToRender,
        guruDipilih: user.id,
        namaGuru,
        bulan: bulanTerbaru || "Semua Bulan",
        guruList,
        dataPernyataan,
        dataPerjalanan,
        dataFotoLampiran,
        onProgress: (p) => setProgressPdfMonitoring(18 + p * 0.8), // petakan 0-100 dari PDF ke 18-98%
      });

      setProgressPdfMonitoring(100);
      setTimeout(() => setShowCetakModal(false), 400); // beri jeda supaya 100% sempat terlihat
    } catch (error) {
      console.error("Gagal mencetak laporan monitoring:", error);
      alert(
        error?.message
          ? `Gagal mencetak laporan: ${error.message}`
          : "Terjadi kesalahan teknis saat menyusun PDF. Pastikan koneksi internet lancar.",
      );
    } finally {
      setRetryStatusText("");
      setLoadingCetakLaporanMonitoring(false);
    }
  };

  // --- AMBIL DAFTAR SISWA WALI (Lazy-load & Caching) ---
  const loadSiswaWaliData = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) return [];

      const cacheKey = `guru:v3:siswaWali:${user.id}`;

      if (!forceRefresh) {
        const cached = readGuruSessionCache(cacheKey);
        if (cached.hit && cached.fresh && Array.isArray(cached.data)) {
          setDataSiswaWali(cached.data);
          setSiswaWaliLoaded(true);
          setLoadingSiswaWali(false);
          return cached.data;
        }
      }

      setLoadingSiswaWali(true);
      setErrorSiswaWali("");

      try {
        const res = await getCachedGuruData({
          key: `api:siswaWali:${user.id}`,
          fetcher: () => getDataSiswaWali(user.id),
          forceRefresh,
        });

        if (res?.success) {
          const list = Array.isArray(res.data) ? res.data : [];
          setDataSiswaWali(list);
          setSiswaWaliLoaded(true);
          writeGuruSessionCache(cacheKey, list);
          return list;
        }

        setErrorSiswaWali(res?.message || "Gagal mengambil data siswa wali.");
      } catch (err) {
        console.error("Error load siswa wali:", err);
        setErrorSiswaWali(
          "Terjadi kendala koneksi saat mengambil data siswa wali.",
        );
      } finally {
        setLoadingSiswaWali(false);
      }

      return [];
    },
    [user?.id],
  );

  // --- AMBIL PERSENTASE KEHADIRAN SISWA (dari grid presensi Wali Kelas) ---
  // Rumus sama dengan halaman Kelola Wali Kelas:
  // persen = jumlah "Hadir" siswa / jumlah tanggal pertemuan di kelas × 100
  const loadPersenKehadiranSiswaWali = useCallback(
    async (forceRefresh = false) => {
      if (!user?.id) return;
      const cacheKey = `guru:v3:persenHadirWali:${user.id}`;

      if (!forceRefresh) {
        const cached = readGuruSessionCache(cacheKey);
        if (cached.hit && cached.fresh && cached.data) {
          setPersenHadirSiswa(cached.data);
          setLoadingPersenHadir(false);
          return;
        }
      }

      setLoadingPersenHadir(true);

      try {
        // Pakai request bersama dengan loadWaliKelasData().
        const resWali = await getCachedGuruData({
          key: `api:waliKelas:${user.id}`,
          fetcher: () => getWaliKelasByGuru(user.id),
          forceRefresh,
        });

        const raw = resWali?.success
          ? (resWali.data ?? resWali.message ?? [])
          : [];
        const listWali = Array.isArray(raw) ? raw : [];

        const grids = await Promise.allSettled(
          listWali.map((w) => {
            const idWali = String(w.idWali || w.ID_WALI || w.id || "").trim();
            if (!idWali) return Promise.resolve(null);

            return getSharedGuruRequest(
              `api:waliGrid:${user.id}:${idWali}`,
              () => getPresensiWaliGrid(user.id, idWali),
            );
          }),
        );

        const hasil = {};

        grids.forEach((g) => {
          if (g.status !== "fulfilled" || !g.value?.success || !g.value?.data) {
            return;
          }

          const siswaArr = g.value.data.siswa || [];
          const presensi = g.value.data.presensi || [];
          const tanggalSet = new Set();
          const hadirMap = {};

          presensi.forEach((p) => {
            if (!p.tanggal) return;
            tanggalSet.add(String(p.tanggal).trim());

            if (String(p.status || "").trim() === "Hadir") {
              const sid = String(p.idSiswa).trim();
              hadirMap[sid] = (hadirMap[sid] || 0) + 1;
            }
          });

          const totalPertemuan = tanggalSet.size;

          siswaArr.forEach((s) => {
            const sid = String(s.idSiswa || s.id || "").trim();
            if (!sid) return;

            const hadir = hadirMap[sid] || 0;

            hasil[sid] = {
              hadir,
              total: totalPertemuan,
              persen:
                totalPertemuan > 0
                  ? Math.round((hadir / totalPertemuan) * 100)
                  : 0,
            };
          });
        });

        setPersenHadirSiswa(hasil);
        writeGuruSessionCache(cacheKey, hasil);
      } catch (err) {
        console.warn("Gagal memuat persentase kehadiran siswa wali:", err);
      } finally {
        setLoadingPersenHadir(false);
      }
    },
    [user?.id],
  );

  // Helper format tanggal pertemuan mapel
  const formatTanggalMapelIndo = (tanggalStr) => {
    if (!tanggalStr) return "";
    try {
      const d = new Date(tanggalStr);
      if (isNaN(d.getTime())) return String(tanggalStr);
      return d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(tanggalStr);
    }
  };

  // --- AMBIL STATISTIK PRESENSI PERTEMUAN SEBELUMNYA MAPEL ---
  const loadStatsMapel = useCallback(
    async (idMapel, forceRefresh = false) => {
      if (!user?.id || !idMapel) return;

      const cacheKey = `guru:v3:statsMapel:${user.id}:${idMapel}`;

      if (!forceRefresh) {
        const cached = readGuruSessionCache(cacheKey);
        if (cached.hit && cached.fresh && cached.data) {
          setStatsPresensiMapel((prev) => ({
            ...prev,
            [idMapel]: cached.data,
          }));
          setLoadingStatsMapel((prev) => ({
            ...prev,
            [idMapel]: false,
          }));
          return cached.data;
        }
      }

      setLoadingStatsMapel((prev) => ({ ...prev, [idMapel]: true }));

      try {
        const res = await getSharedGuruRequest(
          `api:mapelGrid:${user.id}:${idMapel}`,
          () => getPresensiMapelGrid(user.id, idMapel),
        );

        if (res?.success && res?.data) {
          const siswaList = res.data.siswa || [];
          const presensiList = res.data.presensi || [];

          const siswaMap = {};
          siswaList.forEach((s) => {
            siswaMap[String(s.idSiswa || s.id)] = s.nama || s.namaSiswa || "";
          });

          const meetingsMap = {};
          presensiList.forEach((p) => {
            if (!p.pertemuanKe) return;
            const pKe = Number(p.pertemuanKe);
            if (!meetingsMap[pKe]) {
              meetingsMap[pKe] = {
                tanggal: p.tanggal || "",
                records: [],
              };
            }
            if (p.tanggal && !meetingsMap[pKe].tanggal) {
              meetingsMap[pKe].tanggal = p.tanggal;
            }
            if (p.status) {
              meetingsMap[pKe].records.push(p);
            }
          });

          const validMeetings = Object.keys(meetingsMap)
            .map(Number)
            .filter((p) => meetingsMap[p].records.length > 0)
            .sort((a, b) => a - b);

          const latestP =
            validMeetings.length > 0 ? Math.max(...validMeetings) : null;

          const perPertemuan = {};

          Object.keys(meetingsMap).forEach((pStr) => {
            const pKe = Number(pStr);
            const mData = meetingsMap[pKe];
            let hadir = 0,
              sakit = 0,
              izin = 0,
              alfa = 0,
              cabut = 0;
            const absenList = [];
            let totalNilai = 0;
            let countNilai = 0;

            mData.records.forEach((rec) => {
              const st = String(rec.status || "").trim();
              const sid = String(rec.idSiswa).trim();
              const nama = siswaMap[sid] || rec.namaSiswa || `Siswa ${sid}`;

              if (st === "Hadir") {
                hadir++;
                const n = Number(rec.nilai);
                if (Number.isFinite(n) && n > 0) {
                  totalNilai += n;
                  countNilai++;
                }
              } else if (st === "Sakit") {
                sakit++;
                absenList.push({
                  idSiswa: sid,
                  nama,
                  status: "Sakit",
                });
              } else if (st === "Izin") {
                izin++;
                absenList.push({
                  idSiswa: sid,
                  nama,
                  status: "Izin",
                });
              } else if (st === "Alfa") {
                alfa++;
                absenList.push({
                  idSiswa: sid,
                  nama,
                  status: "Alfa",
                });
              } else if (st === "Cabut") {
                cabut++;
                absenList.push({
                  idSiswa: sid,
                  nama,
                  status: "Cabut",
                });
              }
            });

            const rataRataNilai =
              countNilai > 0 ? (totalNilai / countNilai).toFixed(1) : null;

            perPertemuan[pKe] = {
              tanggal: mData.tanggal,
              hadir,
              sakit,
              izin,
              alfa,
              cabut,
              sudahDiisi: mData.records.length > 0,
              absenList,
              rataRataNilai,
            };
          });

          const stats = {
            totalSiswa: siswaList.length,
            validMeetings,
            latestP,
            perPertemuan,
          };

          setStatsPresensiMapel((prev) => ({
            ...prev,
            [idMapel]: stats,
          }));
          writeGuruSessionCache(cacheKey, stats);
          return stats;
        }
      } catch (err) {
        console.warn("Gagal memuat statistik presensi mapel:", err);
      } finally {
        setLoadingStatsMapel((prev) => ({
          ...prev,
          [idMapel]: false,
        }));
      }

      return null;
    },
    [user?.id],
  );

  // --- AMBIL DAFTAR MAPEL (Lazy-load & Caching) ---
  const loadMapelData = useCallback(
    async (forceRefresh = false, silent = false) => {
      if (!user?.id) return [];

      const cacheKey = `guru:v3:mapel:${user.id}`;

      if (!forceRefresh) {
        const cached = readGuruSessionCache(cacheKey);
        if (cached.hit && cached.fresh && Array.isArray(cached.data)) {
          setDaftarMapel(cached.data);
          setMapelLoaded(true);
          setLoadingMapel(false);

          // Pertahankan perilaku lama: statistik kartu langsung tersedia,
          // tetapi setiap grid sekarang dilindungi shared-request + cache.
          cached.data.forEach((m) => {
            if (m.idMapel) loadStatsMapel(m.idMapel, false);
          });

          return cached.data;
        }
      }

      if (!silent) setLoadingMapel(true);
      setErrorMapel("");

      try {
        const res = await getCachedGuruData({
          key: `api:mapelList:${user.id}`,
          fetcher: () => getMapelByGuru(user.id),
          forceRefresh,
        });

        if (res?.success) {
          const list = Array.isArray(res.data) ? res.data : [];
          setDaftarMapel(list);
          setMapelLoaded(true);
          writeGuruSessionCache(cacheKey, list);

          list.forEach((m) => {
            if (m.idMapel) {
              loadStatsMapel(m.idMapel, forceRefresh);
            }
          });

          return list;
        }

        setErrorMapel(res?.message || "Gagal mengambil data mata pelajaran.");
      } catch (err) {
        console.error("Error load mapel:", err);
        setErrorMapel(
          "Terjadi kendala koneksi saat mengambil data mata pelajaran.",
        );
      } finally {
        setLoadingMapel(false);
      }

      return [];
    },
    [user?.id, loadStatsMapel],
  );

  // --- AMBIL STATISTIK PRESENSI HARI INI KELAS WALI ---
  // --- AMBIL RIWAYAT STATISTIK PRESENSI KELAS WALI (SEMUA SESI/TANGGAL) ---
  const loadStatsHariIniWali = useCallback(
    async (idWali, forceRefresh = false) => {
      if (!user?.id || !idWali) return null;

      const cacheKey = `guru:v3:statsWali:${user.id}:${idWali}`;

      if (!forceRefresh) {
        const cached = readGuruSessionCache(cacheKey);
        if (cached.hit && cached.fresh && cached.data) {
          setStatsPresensiHariIniWali((prev) => ({
            ...prev,
            [idWali]: cached.data,
          }));
          setLoadingStatsWali((prev) => ({
            ...prev,
            [idWali]: false,
          }));
          return cached.data;
        }
      }

      setLoadingStatsWali((prev) => ({
        ...prev,
        [idWali]: true,
      }));

      try {
        const res = await getSharedGuruRequest(
          `api:waliGrid:${user.id}:${idWali}`,
          () => getPresensiWaliGrid(user.id, idWali),
        );

        if (res?.success && res?.data) {
          const siswaList = res.data.siswa || [];
          const presensiList = res.data.presensi || [];

          const siswaMap = {};
          siswaList.forEach((s) => {
            siswaMap[String(s.idSiswa || s.id)] = s.nama || s.namaSiswa || "";
          });

          const tanggalMap = {};
          presensiList.forEach((p) => {
            if (!p.tanggal) return;
            const tgl = String(p.tanggal).trim();
            if (!tanggalMap[tgl]) tanggalMap[tgl] = [];
            if (p.status) tanggalMap[tgl].push(p);
          });

          const validTanggal = Object.keys(tanggalMap)
            .filter((tgl) => tanggalMap[tgl].length > 0)
            .sort();

          const latestTanggal =
            validTanggal.length > 0
              ? validTanggal[validTanggal.length - 1]
              : null;

          const perTanggal = {};

          validTanggal.forEach((tgl) => {
            const records = tanggalMap[tgl];
            let hadir = 0,
              sakit = 0,
              izin = 0,
              alfa = 0,
              cabut = 0;
            const absenList = [];

            records.forEach((p) => {
              const st = String(p.status || "Hadir").trim();
              const sid = String(p.idSiswa).trim();
              const nama = siswaMap[sid] || p.namaSiswa || `Siswa ${sid}`;

              if (st === "Hadir") {
                hadir++;
              } else {
                if (st === "Sakit") sakit++;
                else if (st === "Izin") izin++;
                else if (st === "Alfa") alfa++;
                else if (st === "Cabut") cabut++;

                absenList.push({
                  idSiswa: sid,
                  nama,
                  status: st,
                  keterangan: p.keterangan || "",
                });
              }
            });

            perTanggal[tgl] = {
              tanggal: tgl,
              sudahDiisi: records.length > 0,
              hadir,
              sakit,
              izin,
              alfa,
              cabut,
              absenList,
            };
          });

          const stats = {
            totalSiswa: siswaList.length,
            validTanggal,
            latestTanggal,
            perTanggal,
          };

          setStatsPresensiHariIniWali((prev) => ({
            ...prev,
            [idWali]: stats,
          }));
          writeGuruSessionCache(cacheKey, stats);
          return stats;
        }
      } catch (err) {
        console.warn("Gagal memuat statistik presensi kelas wali:", err);
      } finally {
        setLoadingStatsWali((prev) => ({
          ...prev,
          [idWali]: false,
        }));
      }

      return null;
    },
    [user?.id],
  );

  // --- AMBIL DAFTAR KELAS WALI (Lazy-load & Caching) ---
  const loadWaliKelasData = useCallback(
    async (forceRefresh = false, silent = false) => {
      if (!user?.id) return [];

      const cacheKey = `guru:v3:waliKelas:${user.id}`;

      if (!forceRefresh) {
        const cached = readGuruSessionCache(cacheKey);
        if (cached.hit && cached.fresh && Array.isArray(cached.data)) {
          setDaftarWaliKelas(cached.data);
          setWaliKelasLoaded(true);
          setLoadingWaliKelas(false);

          cached.data.forEach((w) => {
            if (w.idWali) loadStatsHariIniWali(w.idWali, false);
          });

          return cached.data;
        }
      }

      if (!silent) setLoadingWaliKelas(true);
      setErrorWaliKelas("");

      try {
        const res = await getCachedGuruData({
          key: `api:waliKelas:${user.id}`,
          fetcher: () => getWaliKelasByGuru(user.id),
          forceRefresh,
        });

        if (res?.success) {
          const raw = res.data ?? res.message ?? [];
          const list = (Array.isArray(raw) ? raw : []).map((w, idx) => ({
            ...w,
            idWali: String(w.idWali || w.ID_WALI || w.id || `wali-${idx}`),
            idGuru: String(w.idGuru || w.ID_GURU || ""),
            namaKelas: String(w.namaKelas || w.NAMA_KELAS || w.kelas || ""),
            kelas: String(w.kelas || w.NAMA_KELAS || w.namaKelas || ""),
            keterangan: String(w.keterangan || w.KETERANGAN || ""),
            jumlahSiswa: w.jumlahSiswa,
          }));

          setDaftarWaliKelas(list);
          setWaliKelasLoaded(true);
          writeGuruSessionCache(cacheKey, list);

          list.forEach((w) => {
            if (w.idWali) {
              loadStatsHariIniWali(w.idWali, forceRefresh);
            }
          });

          return list;
        }

        setErrorWaliKelas(res?.message || "Gagal mengambil data kelas wali.");
      } catch (err) {
        console.error("Error load wali kelas:", err);
        setErrorWaliKelas(
          "Terjadi kendala koneksi saat mengambil data kelas wali.",
        );
      } finally {
        setLoadingWaliKelas(false);
      }

      return [];
    },
    [user?.id, loadStatsHariIniWali],
  );

  // Lazy trigger data fetching saat tab Guru Wali, Guru Mapel, atau Wali Kelas dipilih
  useEffect(() => {
    if (activeMenuTab === "wali" && !siswaWaliLoaded && user?.id) {
      loadSiswaWaliData(false);
    } else if (activeMenuTab === "mapel" && !mapelLoaded && user?.id) {
      loadMapelData(false);
    } else if (activeMenuTab === "walikelas" && !waliKelasLoaded && user?.id) {
      loadWaliKelasData(false);
    }
  }, [
    activeMenuTab,
    siswaWaliLoaded,
    mapelLoaded,
    waliKelasLoaded,
    user?.id,
    loadSiswaWaliData,
    loadMapelData,
    loadWaliKelasData,
  ]);

  // Muat persentase kehadiran saat tab Guru Wali dibuka
  useEffect(() => {
    if (activeMenuTab === "wali" && user?.id) {
      loadPersenKehadiranSiswaWali(false);
    }
  }, [activeMenuTab, user?.id, loadPersenKehadiranSiswaWali]);

  // Handler cetak laporan PDF langsung dari kartu Mapel
  const handleCetakPdfMapelDirect = async (mapel) => {
    try {
      setCetakCardLoadingId(mapel.idMapel);
      await generateLaporanMapelPDF({ guru: user, mapel });
    } catch (err) {
      console.error("Gagal cetak PDF mapel:", err);
      alert(err?.message || "Gagal mencetak laporan PDF mapel.");
    } finally {
      setCetakCardLoadingId(null);
    }
  };

  // --- HANDLER FORM TAMBAH MAPEL INLINE ---
  const loadFormDaftarKelas = async () => {
    if (formDaftarKelas.length > 0) return; // Sudah dimuat
    try {
      setFormLoadingKelas(true);
      const res = await getKelasSiswaMapel();
      if (res?.success) setFormDaftarKelas(res.data || []);
    } catch (err) {
      console.error("Error load kelas form:", err);
    } finally {
      setFormLoadingKelas(false);
    }
  };

  const handlePilihKelasForm = async (kelas) => {
    setFormKelasDipilih(kelas);
    if (!kelas) {
      setFormPreviewSiswa([]);
      return;
    }
    try {
      setFormLoadingPreview(true);
      const res = await getSiswaByKelasMapel(kelas);
      setFormPreviewSiswa(res?.success ? res.data || [] : []);
    } catch (err) {
      console.error("Error preview siswa:", err);
      setFormPreviewSiswa([]);
    } finally {
      setFormLoadingPreview(false);
    }
  };

  const handleTambahMapelInline = async (e) => {
    e.preventDefault();
    if (!formNamaMapel.trim()) {
      alert("Nama mapel wajib diisi.");
      return;
    }
    if (!user?.id) {
      alert("Sesi guru tidak ditemukan.");
      return;
    }

    setFormSavingMapel(true);
    try {
      // Encode jenis mapel ke keterangan jika perlu (atau kirim sebagai field terpisah)
      const keteranganFinal =
        formJenisMapel === "online"
          ? `[ONLINE]${formKeterangan ? " " + formKeterangan.trim() : ""}`
          : formKeterangan.trim();

      const result = await addMapel({
        idGuru: user.id,
        namaMapel: formNamaMapel.trim(),
        kelas: formKelasDipilih || "",
        keterangan: keteranganFinal,
      });

      if (result.success) {
        const jumlah = result.data?.jumlahSiswaOtomatis || 0;
        if (formKelasDipilih) {
          alert(
            `✅ Mapel "${formNamaMapel.trim()}" berhasil dibuat untuk kelas ${formKelasDipilih}.\n\n` +
              `${jumlah} siswa dari kelas tersebut otomatis dimasukkan ke mapel ini.` +
              (formJenisMapel === "online"
                ? "\n\n🌐 Mapel ini dikonfigurasi sebagai Mapel Online."
                : ""),
          );
        }
        // Reset form
        setFormNamaMapel("");
        setFormKeterangan("");
        setFormKelasDipilih("");
        setFormPreviewSiswa([]);
        setFormJenisMapel("biasa");
        setIsFormTambahMapelOpen(false);
        // Refresh daftar mapel
        removeGuruSessionCacheByPrefix("guru:v3:mapel:");
        removeGuruSessionCacheByPrefix("api:mapelList:");
        await loadMapelData(true);
      } else {
        alert(result.message || "Gagal menambahkan mapel.");
      }
    } catch (err) {
      console.error("ERROR TAMBAH MAPEL INLINE:", err);
      alert("Terjadi kesalahan saat menambahkan mapel.");
    } finally {
      setFormSavingMapel(false);
    }
  };

  // Handler cetak laporan PDF langsung dari kartu Wali Kelas
  const handleCetakPdfWaliKelasDirect = async (wali) => {
    try {
      setCetakWaliKelasCardLoadingId(wali.idWali);
      await generateLaporanWaliKelasPDF({ guru: user, wali });
    } catch (err) {
      console.error("Gagal cetak PDF wali kelas:", err);
      alert(err?.message || "Gagal mencetak laporan PDF wali kelas.");
    } finally {
      setCetakWaliKelasCardLoadingId(null);
    }
  };

  // --- AMBIL DAFTAR SISWA WALI (untuk pilihan cetak Lampiran A & B) ---
  const fetchDaftarSiswaWaliDashboard = async () => {
    if (dataSiswaWali && dataSiswaWali.length > 0) return dataSiswaWali;
    return await loadSiswaWaliData(false);
  };

  // --- HANDLER CATATAN PERKEMBANGAN MURID (LAMPIRAN B) ---
  async function handleBukaCatatanPerkembangan(siswa) {
    if (!siswa) return;
    const studentId = siswa.idSiswa || siswa.id || siswa.ID_SISWA || siswa.ID;
    setSiswaCatatanAktif(siswa);
    setShowCatatanModal(true);
    setLoadingCatatan(true);
    setFormCatatan(FORM_CATATAN_KOSONG);

    try {
      if (!studentId) {
        console.warn("ID Siswa tidak ditemukan:", siswa);
        return;
      }
      const res = await getBiodataSiswa(String(studentId));

      if (!res?.success) {
        console.warn("Gagal mengambil catatan perkembangan:", res?.message);
        return;
      }

      const data = res.data || {};

      setFormCatatan({
        periodeAwal: data.periodeAwal || "",
        periodeAkhir: data.periodeAkhir || "",
        desAkademik: data.desAkademik || "",
        tinAkademik: data.tinAkademik || "",
        ketAkademik: data.ketAkademik || "",
        desKarakter: data.desKarakter || "",
        tinKarakter: data.tinKarakter || "",
        ketKarakter: data.ketKarakter || "",
        desSosial: data.desSosial || "",
        tinSosial: data.tinSosial || "",
        ketSosial: data.ketSosial || "",
        desDisiplin: data.desDisiplin || "",
        tinDisiplin: data.tinDisiplin || "",
        ketDisiplin: data.ketDisiplin || "",
        desPotensi: data.desPotensi || "",
        tinPotensi: data.tinPotensi || "",
        ketPotensi: data.ketPotensi || "",
      });
    } catch (error) {
      console.error("Gagal mengambil catatan perkembangan:", error);
      alert("Gagal mengambil data catatan perkembangan sebelumnya.");
    } finally {
      setLoadingCatatan(false);
    }
  }

  function tutupCatatanModal() {
    setShowCatatanModal(false);
    setSiswaCatatanAktif(null);
    setFormCatatan(FORM_CATATAN_KOSONG);
  }

  function updateFieldCatatan(key, value) {
    setFormCatatan((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSimpanCatatanPerkembangan() {
    if (!siswaCatatanAktif) return;
    const studentId =
      siswaCatatanAktif.idSiswa ||
      siswaCatatanAktif.id ||
      siswaCatatanAktif.ID_SISWA ||
      siswaCatatanAktif.ID;

    if (!studentId) {
      alert("ID Siswa tidak ditemukan.");
      return;
    }

    if (!formCatatan.periodeAwal || !formCatatan.periodeAkhir) {
      alert("Pilih periode pemantauan (bulan awal dan bulan akhir) dulu.");
      return;
    }

    setSavingCatatan(true);
    try {
      const res = await updateBiodataSiswa({
        idSiswa: String(studentId),
        ...formCatatan,
      });

      if (!res?.success) {
        alert(res?.message || "Gagal menyimpan catatan perkembangan.");
        return;
      }

      alert("Catatan perkembangan berhasil disimpan.");
      tutupCatatanModal();
    } catch (error) {
      console.error("Gagal menyimpan catatan perkembangan:", error);
      alert("Terjadi kesalahan saat menyimpan catatan perkembangan.");
    } finally {
      setSavingCatatan(false);
    }
  }

  // =========================================================
  // STATISTIK AKUN SISWA (SHEET SISWA - SEMUA KELAS)
  // =========================================================
  const loadMasterSiswa = useCallback(async (forceRefresh = false) => {
    const cacheKey = "guru:v3:masterSiswa";

    if (!forceRefresh) {
      const cached = readGuruSessionCache(cacheKey);
      if (cached.hit && cached.fresh && Array.isArray(cached.data)) {
        setDataMasterSiswa(cached.data);
        setLoadingMasterSiswa(false);
        return cached.data;
      }
    }

    setLoadingMasterSiswa(true);
    try {
      const res = await getCachedGuruData({
        key: "api:getSiswa",
        fetcher: () => getSiswa(),
        forceRefresh,
      });

      if (res?.success && Array.isArray(res.data)) {
        setDataMasterSiswa(res.data);
        writeGuruSessionCache(cacheKey, res.data);
        return res.data;
      }
    } catch (err) {
      console.error("Error load master siswa Guru:", err);
    } finally {
      setLoadingMasterSiswa(false);
    }

    return [];
  }, []);

  // Muat statistik siswa di latar belakang setelah user siap
  useEffect(() => {
    if (!user?.id) return;
    loadMasterSiswa(false);
  }, [user?.id, loadMasterSiswa]);

  function handleStatCardClick(title, listData, breakdownKelas = null) {
    setStatModalSearch("");
    const hasBreakdown =
      Array.isArray(breakdownKelas) && breakdownKelas.length > 0;
    setStatModalTab(hasBreakdown ? "statistik" : "semua");
    setStatModalConfig({
      isOpen: true,
      title,
      data: listData || [],
      breakdownKelas: hasBreakdown ? breakdownKelas : null,
    });
  }

  const statsSiswa = useMemo(() => {
    const list = dataMasterSiswa || [];

    const normalized = list.map((itemSiswa) => {
      const id = String(
        itemSiswa.ID ||
          itemSiswa.id ||
          itemSiswa.ID_SISWA ||
          itemSiswa.idSiswa ||
          "",
      ).trim();
      const rawNama = String(
        itemSiswa.NAMA || itemSiswa.nama || itemSiswa.NAMA_SISWA || "",
      ).trim();
      const tempat = String(
        itemSiswa.TEMPAT_MAGANG ||
          itemSiswa.tempatMagang ||
          itemSiswa.TEMPAT ||
          itemSiswa.tempat ||
          "",
      ).trim();
      const match = rawNama.match(/(.+?)\s*\[(.*?)\]/);
      const nama = match ? match[1].trim() : rawNama;
      const kelas = match
        ? match[2].trim()
        : String(itemSiswa.KELAS || itemSiswa.kelas || "").trim();
      return { id, nama, kelas, tempatMagang: tempat };
    });

    // Seluruh siswa yang punya akun (memiliki ID)
    const siswaPunyaAkun = normalized.filter((it) => it.id !== "");

    const isKelasX = (k) =>
      /^X[\s\-_]/.test(k) || /^X$/.test(k) || /^10[\s\-_]/.test(k);
    const isKelasXI = (k) =>
      /^XI[\s\-_]/.test(k) || /^XI$/.test(k) || /^11[\s\-_]/.test(k);

    const siswaKelasX = siswaPunyaAkun.filter((it) =>
      isKelasX(it.kelas.toUpperCase()),
    );
    const siswaKelasXI = siswaPunyaAkun.filter((it) =>
      isKelasXI(it.kelas.toUpperCase()),
    );
    const siswaKelasXII = siswaPunyaAkun.filter((it) => {
      const k = it.kelas.toUpperCase();
      return !isKelasX(k) && !isKelasXI(k);
    });

    function buildBreakdown(siswaList) {
      const map = {};
      siswaList.forEach((it) => {
        const k = it.kelas || "—";
        if (!map[k]) map[k] = { kelas: k, count: 0, siswaList: [] };
        map[k].count++;
        map[k].siswaList.push(it);
      });
      return Object.values(map).sort((a, b) => b.count - a.count);
    }

    return {
      totalAkun: siswaPunyaAkun.length,
      listAkun: siswaPunyaAkun.map((it) => ({
        nama: it.nama,
        info: `ID: ${it.id} • Kelas: ${it.kelas || "XII"} ${it.tempatMagang ? `• 📍 ${it.tempatMagang}` : "• Belum Magang"}`,
      })),
      breakdownAkun: buildBreakdown(siswaPunyaAkun),
      totalKelasX: siswaKelasX.length,
      listKelasX: siswaKelasX.map((it) => ({
        nama: it.nama,
        info: `ID: ${it.id} • Kelas: ${it.kelas} ${it.tempatMagang ? `• 📍 ${it.tempatMagang}` : ""}`,
      })),
      breakdownKelasX: buildBreakdown(siswaKelasX),
      totalKelasXI: siswaKelasXI.length,
      listKelasXI: siswaKelasXI.map((it) => ({
        nama: it.nama,
        info: `ID: ${it.id} • Kelas: ${it.kelas} ${it.tempatMagang ? `• 📍 ${it.tempatMagang}` : ""}`,
      })),
      breakdownKelasXI: buildBreakdown(siswaKelasXI),
      totalKelasXII: siswaKelasXII.length,
      listKelasXII: siswaKelasXII.map((it) => ({
        nama: it.nama,
        info: `ID: ${it.id} • Jurusan/Kelas: ${it.kelas || "XII"} ${it.tempatMagang ? `• 📍 ${it.tempatMagang}` : ""}`,
      })),
      breakdownKelasXII: buildBreakdown(siswaKelasXII),
    };
  }, [dataMasterSiswa]);

  // --- FUNGSI UNTUK SCROLL HORIZONTAL TOMBOL SESI ---
  const scrollHorizontal = (id, direction) => {
    const container = document.getElementById(id);
    if (container) {
      const scrollAmount = 250; // Jarak scroll per klik
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  // Status gagal total (tidak ada cache & fetch gagal setelah retry) —
  // tampilkan tombol refresh, jangan biarkan pengguna terjebak di spinner.
  if (loadFailed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-4xl mb-3">⚠️</p>
          <h2 className="text-lg font-black text-slate-800 mb-2">
            Gagal Memuat Dashboard
          </h2>
          <p className="text-sm text-slate-500 mb-5">
            {loadFailedMessage ||
              "Terjadi kendala saat mengambil data dari server."}
          </p>
          <button
            onClick={() => {
              setLoading(true);
              setLoadProgress(0);
              loadDashboard(true);
            }}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors active:scale-95 shadow-lg shadow-indigo-200"
          >
            🔄 Muat Ulang
          </button>
        </div>
      </main>
    );
  }

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xs text-center">
          <p className="mb-4 text-base font-bold text-slate-600 tracking-wide">
            Menyinkronkan Dashboard Guru...
          </p>
          <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-black text-slate-400">
            {Math.round(loadProgress)}%
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 space-y-6 pb-12 relative">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1 rounded-xl border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={38}
                height={38}
                className="object-contain"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                PORTAL AKADEMIK
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                SMKN 1 TELUK KUANTAN
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPesanKepsek(true)}
              className="relative rounded-xl bg-gradient-to-r from-sky-600 to-blue-700 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black text-white border border-sky-300/50 shadow-lg hover:brightness-110 active:scale-95 transition-all duration-300"
            >
              ✉️ PESAN
              {jumlahPesanBaru > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border border-white shadow">
                  {jumlahPesanBaru}
                </span>
              )}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 px-5 py-2 text-xs sm:text-sm font-black text-white border-2 border-amber-300/80 shadow-lg hover:border-amber-200 hover:brightness-110 active:scale-95 transition-all duration-300"
            >
              ❌ LOGOUT
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-8">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-md border border-blue-800">
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
              ✨ Workspace Guru Pembimbing
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Selamat Datang,
            </h2>
            <h3 className="mt-1 text-xl sm:text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-amber-200 to-yellow-100">
              {user?.nama}
            </h3>
            <p className="mt-2 text-sm text-blue-200 max-w-md font-medium">
              Sistem kendali monitoring, verifikasi, dan rekapitulasi data
              aktivitas Murid
            </p>
          </div>
        </div>

        {/* ======================================================= */}
        {/* STATISTIK AKUN SISWA (SEMUA KELAS) - DI ATAS PILIH JENIS PEMBIMBING */}
        {/* ======================================================= */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl">📊</span>
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                  Statistik Akun Siswa
                </h3>
                <p className="text-[11px] font-medium text-slate-500">
                  Data real-time seluruh Akun siswa yang terdaftar, Akun Siswa
                  dibuat Oleh Guru Pembimbing PKL/Guru Wali/Guru Mapel/Guru
                  Walas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline-block text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
                💡 Klik kartu untuk melihat daftar siswa
              </span>
              <button
                type="button"
                onClick={() => loadMasterSiswa(true)}
                disabled={loadingMasterSiswa}
                title="Segarkan statistik akun siswa"
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                <span
                  className={
                    loadingMasterSiswa ? "animate-spin inline-block" : ""
                  }
                >
                  🔄
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              title="Seluruh Siswa (Akun)"
              value={loadingMasterSiswa ? "..." : statsSiswa.totalAkun || "--"}
              accentColor="border-blue-600"
              icon="👥"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Akun Siswa — Semua Kelas",
                  statsSiswa.listAkun,
                  statsSiswa.breakdownAkun,
                )
              }
            />
            <StatCard
              title="Siswa Kelas X"
              value={
                loadingMasterSiswa ? "..." : (statsSiswa.totalKelasX ?? "--")
              }
              accentColor="border-sky-500"
              icon="🎒"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Siswa Kelas X",
                  statsSiswa.listKelasX,
                  statsSiswa.breakdownKelasX,
                )
              }
            />
            <StatCard
              title="Siswa Kelas XI"
              value={
                loadingMasterSiswa ? "..." : (statsSiswa.totalKelasXI ?? "--")
              }
              accentColor="border-indigo-500"
              icon="📘"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Siswa Kelas XI",
                  statsSiswa.listKelasXI,
                  statsSiswa.breakdownKelasXI,
                )
              }
            />
            <StatCard
              title="Siswa Kelas XII"
              value={
                loadingMasterSiswa ? "..." : (statsSiswa.totalKelasXII ?? "--")
              }
              accentColor="border-purple-600"
              icon="🎓"
              onClick={() =>
                handleStatCardClick(
                  "Statistik Siswa Kelas XII (Jurusan PKL)",
                  statsSiswa.listKelasXII,
                  statsSiswa.breakdownKelasXII,
                )
              }
            />
          </div>
        </div>

        {/* MENU TAMPILAN UTAMA - DIBUNGKUS BACKGROUND GRADIENT HEADER & TAB EMAS */}
        <div className="relative mt-2 space-y-3 rounded-2xl border border-blue-700/50 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 p-2.5 shadow-md sm:p-5">
          {/* Ornamen Glow Emas */}

          {/* TAMBAHKAN KODE GARIS EMAS DI SINI */}
          <div className="flex items-center gap-3 my-1 w-full px-1">
            <div className="h-[2px] flex-1 bg-gradient-to-r from-transparent via-amber-400 to-yellow-300 rounded-full opacity-80"></div>
            <h3 className="text-xs sm:text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-100 uppercase whitespace-nowrap drop-shadow-sm">
              PILIH JENIS PEMBIMBING
            </h3>
            <div className="h-[2px] flex-1 bg-gradient-to-l from-transparent via-amber-400 to-yellow-300 rounded-full opacity-80"></div>
          </div>

          {/* 1. CONTAINER TAB DENGAN LENGKUNGAN EMAS */}
          <div className="relative flex overflow-hidden rounded-xl border border-amber-400/30 bg-blue-950/70 p-1 shadow-inner">
            <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-0 w-12 rounded-r-xl bg-gradient-to-l from-amber-400/50 via-yellow-400/20 to-transparent sm:w-16"></div>

            {/* Tab: Pembimbing PKL */}
            <button
              onClick={() => setActiveMenuTab("pembimbing")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "pembimbing"
                  ? "scale-[1.01] border border-[#FBF5B7] bg-gradient-to-r from-[#BF953F] via-[#FCF6BA] to-[#B38728] text-amber-950 shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-amber-400/15 hover:text-amber-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "pembimbing" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  👔
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Pembimbing PKL
              </span>
            </button>

            {/* Tab: Guru Wali */}
            <button
              onClick={() => setActiveMenuTab("wali")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "wali"
                  ? "scale-[1.01] border border-[#FBF5B7] bg-gradient-to-r from-[#BF953F] via-[#FCF6BA] to-[#B38728] text-amber-950 shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-amber-400/15 hover:text-amber-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "wali" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  👨‍🏫
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Guru Wali
              </span>
            </button>

            {/* Tab: Guru Mapel */}
            <button
              onClick={() => setActiveMenuTab("mapel")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "mapel"
                  ? "scale-[1.01] border border-[#FBF5B7] bg-gradient-to-r from-[#BF953F] via-[#FCF6BA] to-[#B38728] text-amber-950 shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-amber-400/15 hover:text-amber-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "mapel" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  📚
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Guru Mapel
              </span>
            </button>

            {/* Tab: Guru Wali Kelas */}
            <button
              onClick={() => setActiveMenuTab("walikelas")}
              className={`relative z-10 flex-1 flex items-center justify-center rounded-lg px-2 py-3 transition-all duration-300 overflow-hidden ${
                activeMenuTab === "walikelas"
                  ? "scale-[1.01] border border-teal-300 bg-gradient-to-r from-teal-700 via-teal-500 to-emerald-600 text-white shadow-md"
                  : "border border-transparent text-amber-200/90 hover:bg-teal-400/15 hover:text-teal-100"
              }`}
            >
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 pointer-events-none z-0 ${
                  activeMenuTab === "walikelas" ? "opacity-10" : "opacity-20"
                }`}
              >
                <span className="text-7xl sm:text-8xl scale-125 rotate-12">
                  🏫
                </span>
              </div>
              <span className="relative z-10 text-[12px] font-extrabold uppercase leading-tight tracking-wide drop-shadow-sm sm:text-sm">
                Wali Kelas
              </span>
            </button>
          </div>

          {/* 2. KONTEN TAB PEMBIMBING PKL */}
          {activeMenuTab === "pembimbing" && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
              <SolidCompactCard
                title="Kelola Murid PKL"
                desc="Lihat & kelola siswa bimbingan"
                icon="🗂️"
                bgGrad="from-blue-600 to-indigo-700"
                onClick={() => router.push("/magang/siswa")}
              />
              <SolidCompactCard
                title="Tambah Murid PKL"
                desc="Registrasi akun siswa baru"
                icon="➕"
                bgGrad="from-sky-500 to-cyan-600"
                onClick={() => router.push("/magang/tambah")}
              />
              <SolidCompactCard
                title="Rekap PKL"
                desc="Rekapitulasi kehadiran & log"
                icon="📊"
                bgGrad="from-violet-600 to-purple-800"
                onClick={() => router.push("/magang/rekap")}
              />
              <SolidCompactCard
                title="Isi Jurnal PKL"
                desc="Catat jurnal pembimbingan individual"
                icon="📝"
                bgGrad="from-rose-500 to-pink-600"
                onClick={() => setShowJurnalPklModal(true)}
              />
              <SolidCompactCard
                title="Cetak Laporan PKL"
                desc="Monitoring atau Jurnal PKL"
                icon="🖨️"
                bgGrad="from-fuchsia-500 to-pink-600"
                onClick={() => setShowPilihCetakPklModal(true)}
              />
            </div>
          )}

          {/* 3. KONTEN TAB GURU WALI */}
          {activeMenuTab === "wali" && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
              <SolidCompactCard
                title="Kelola Murid Wali"
                desc="Lihat & Kelola murid perwalian"
                icon="👥"
                bgGrad="from-orange-500 to-red-600"
                onClick={() => router.push("/magang/guru/guru-wali")}
              />
              <SolidCompactCard
                title="Tambah Siswa Wali"
                desc="Registrasi siswa wali baru"
                icon="➕"
                bgGrad="from-emerald-500 to-teal-600"
                onClick={() => router.push("/magang/guru/guru-wali/tambah")}
              />
              <SolidCompactCard
                title="Rekap Guru Wali"
                desc="Pantau aktivitas harian"
                icon="📈"
                bgGrad="from-amber-500 to-orange-500"
                onClick={() => router.push("/magang/guru/guru-wali/rekap")}
              />
              <SolidCompactCard
                title="Isi Jurnal Guru Wali"
                desc="Catat agenda jurnal harian"
                icon="📝"
                bgGrad="from-rose-500 to-pink-600"
                onClick={() => setShowJurnalGuruWaliModal(true)}
              />
              <SolidCompactCard
                title="Lihat Jurnal Guru Wali"
                desc="Riwayat jurnal & hapus data"
                icon="📖"
                bgGrad="from-blue-600 to-indigo-700"
                onClick={() => setShowLihatJurnalGuruWaliModal(true)}
              />
              <SolidCompactCard
                title="Cetak Laporan Guru Wali"
                desc="Pilih Cover / Lampiran A&B / Lampiran C&D"
                icon="📑"
                bgGrad="from-slate-500 to-slate-700"
                onClick={() => setShowLaporanWaliModal(true)}
              />
            </div>
          )}

          {/* 4. KONTEN TAB GURU MAPEL */}
          {activeMenuTab === "mapel" && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
              <SolidCompactCard
                title="Kelola Mapel"
                desc="Tambah mata pelajaran & presensi"
                icon="📚"
                bgGrad="from-cyan-600 to-blue-700"
                onClick={() => router.push("/magang/guru/guru-mapel/kelola")}
              />
              <SolidCompactCard
                title="Isi Pembinaan Mapel"
                desc="Segera hadir (Fase berikutnya)"
                icon="📷"
                bgGrad="from-slate-500 to-slate-700"
                disabled={true}
                onClick={() => {}}
              />
              <SolidCompactCard
                title="Cetak Laporan Mapel"
                desc="Unduh rekap presensi & nilai (PDF)"
                icon="🖨️"
                bgGrad="from-fuchsia-600 to-pink-600"
                onClick={() => setShowCetakMapelModal(true)}
              />
            </div>
          )}

          {/* 5. KONTEN TAB GURU WALI KELAS */}
          {activeMenuTab === "walikelas" && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-5">
              <SolidCompactCard
                title="Kelola Wali Kelas"
                desc="Presensi harian & jurnal bimbingan"
                icon="🏫"
                bgGrad="from-teal-600 to-emerald-700"
                onClick={() =>
                  router.push("/magang/guru/guru-wali-kelas/kelola")
                }
              />
              <SolidCompactCard
                title="Presensi Harian"
                desc="Isi absensi siswa per hari"
                icon="📅"
                bgGrad="from-cyan-600 to-teal-700"
                onClick={() => {
                  if (daftarWaliKelas.length > 0) {
                    setWaliKelasPresensiAktif(daftarWaliKelas[0]);
                  } else {
                    router.push("/magang/guru/guru-wali-kelas/kelola");
                  }
                }}
              />
              <SolidCompactCard
                title="Jurnal Bimbingan"
                desc="Catat bimbingan + upload foto"
                icon="📝"
                bgGrad="from-indigo-600 to-purple-700"
                onClick={() => {
                  if (daftarWaliKelas.length > 0) {
                    setWaliKelasJurnalAktif(daftarWaliKelas[0]);
                  } else {
                    router.push("/magang/guru/guru-wali-kelas/kelola");
                  }
                }}
              />
              <SolidCompactCard
                title="Cetak Laporan Wali Kelas"
                desc="Unduh rekap presensi (PDF)"
                icon="🖨️"
                bgGrad="from-fuchsia-600 to-pink-600"
                onClick={() => setShowCetakWaliKelasModal(true)}
              />
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* KONTEN DINAMIS BERDASARKAN TAB JENIS PEMBIMBING TERPILIH */}
        {/* ======================================================== */}

        {/* 1. JIKA TAB PEMBIMBING PKL: TAMPILKAN MONITORING, STATISTIK & AKTIVITAS TERKINI */}
        {activeMenuTab === "pembimbing" && (
          <>
            {/* MONITORING LAPANGAN */}
            <div className="rounded-[2rem] bg-gradient-to-br from-[#FFFDF8] via-[#FCE7A4] to-[#F3D36B] p-5 sm:p-6 shadow-[0_12px_35px_rgba(212,175,55,0.22)] border border-[#D9B44A]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#D9B44A]/40 pb-4">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    📸 Monitoring Lapangan
                  </h2>
                  <p className="text-xs sm:text-sm font-semibold text-amber-900/70">
                    Pilih area penempatan aktif untuk meninjau log presensi
                    mandiri siswa.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3.5">
                {tempatMagang.length === 0 ? (
                  <div className="text-center py-6 bg-white/60 rounded-2xl border border-dashed border-[#D9B44A]">
                    <p className="text-sm font-bold text-amber-900/60">
                      Belum ada lokasi tempat magang terdaftar.
                    </p>
                  </div>
                ) : (
                  tempatMagang.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-[#D9B44A]/60 bg-white/80 p-4 sm:p-5 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* BAGIAN INFORMASI TEMPAT & JUMLAH SISWA */}
                        <div>
                          <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-1.5">
                            <span className="text-sm sm:text-base">📍</span>{" "}
                            {item.tempat}
                          </h3>
                          <p className="text-xs sm:text-sm font-bold text-slate-500 mt-0.5">
                            Terbimbing:{" "}
                            <span className="text-blue-600 font-extrabold">
                              {item.jumlah} Siswa
                            </span>
                          </p>
                        </div>

                        {/* BAGIAN TOMBOL */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 w-full sm:w-auto mt-3 sm:mt-0">
                          <button
                            onClick={() => {
                              const date = new Date();
                              const namaBulan = [
                                "Januari",
                                "Februari",
                                "Maret",
                                "April",
                                "Mei",
                                "Juni",
                                "Juli",
                                "Agustus",
                                "September",
                                "Oktober",
                                "November",
                                "Desember",
                              ];
                              const bulanTerbaru = `${namaBulan[date.getMonth()]} ${date.getFullYear()}`;

                              localStorage.setItem(
                                "targetTempatRekap",
                                item.tempat,
                              );
                              localStorage.setItem("targetGuruRekap", user.id);
                              localStorage.setItem(
                                "targetBulanRekap",
                                bulanTerbaru,
                              );

                              router.push("/magang/rekap");
                            }}
                            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-[0.97] hover:brightness-110 flex items-center justify-center gap-2 transition-all"
                          >
                            👁️ LIHAT AKTIVITAS
                          </button>

                          <button
                            onClick={() => mulaiMonitoring(item.tempat)}
                            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-xs sm:text-sm font-black text-white shadow-md active:scale-[0.97] hover:brightness-110 flex items-center justify-center gap-2 transition-all"
                          >
                            📷 MONITORING AREA
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* STATISTIK CARD GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <Card
                title="Jumlah Siswa"
                value={dashboard?.jumlahSiswa ?? "--"}
                accentColor="border-indigo-500"
                textColor="text-indigo-600"
                icon="👥"
                onClick={() =>
                  handleCardClick(
                    "Daftar Jumlah Siswa",
                    dashboard?.listJumlahSiswa,
                  )
                }
              />
              <Card
                title="Hadir Hari Ini"
                value={dashboard?.hadirHariIni ?? "--"}
                accentColor="border-emerald-500"
                textColor="text-emerald-600"
                icon="✅"
                onClick={() =>
                  handleCardClick(
                    "Siswa Hadir Hari Ini",
                    dashboard?.listHadirHariIni,
                  )
                }
              />
              <Card
                title="Total Kehadiran"
                value={dashboard?.totalHadir ?? "--"}
                accentColor="border-blue-500"
                textColor="text-blue-600"
                icon="📊"
                onClick={() =>
                  handleCardClick(
                    "Log Total Kehadiran",
                    dashboard?.listTotalHadir,
                  )
                }
              />
              <Card
                title="Izin / Sakit"
                value={dashboard?.izinSakit ?? "--"}
                accentColor="border-amber-500"
                textColor="text-amber-600"
                icon="🤒"
                onClick={() =>
                  handleCardClick(
                    "Daftar Siswa Izin / Sakit",
                    dashboard?.listIzinSakit,
                  )
                }
              />
            </div>

            {/* TABEL AKTIVITAS TERBARU */}
            <div className="rounded-[2rem] bg-white border border-slate-200 shadow-md overflow-hidden">
              <div className="border-b border-slate-100 p-5 bg-gradient-to-r from-slate-50 to-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2">
                    ⚡ Aktivitas Terkini
                  </h2>
                  <p className="text-xs sm:text-sm font-medium text-slate-500">
                    Log pengiriman presensi & pemantauan foto riil siswa di
                    lapangan.
                  </p>
                </div>
                {aktivitas.length > 0 && (
                  <button
                    onClick={() => {
                      setGalleryIndex(0);
                      setShowGallery(true);
                    }}
                    className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold py-2.5 px-5 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <span>👁️</span> Lihat Semuanya
                  </button>
                )}
              </div>

              <div className="p-4 sm:p-6">
                {aktivitas.length === 0 ? (
                  <p className="text-center py-8 text-sm font-semibold text-slate-400">
                    Belum ada aktivitas presensi masuk hari ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {aktivitas.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 p-3.5 shadow-sm"
                      >
                        <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100 border border-slate-200">
                          <img
                            src={optimizeFotoUrl(item.foto, 160)}
                            alt="Aktivitas"
                            className="h-full w-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.style.border = "2px solid red";
                            }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <span
                            className={`inline-block rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              item.jenis === "PRESENSI"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-blue-50 text-blue-700 border border-blue-200"
                            }`}
                          >
                            {item.jenis}
                          </span>

                          <h3 className="mt-1 text-xs sm:text-sm font-black text-slate-800 truncate">
                            {item.nama}
                          </h3>
                          <p className="text-[11px] font-bold text-slate-500 truncate flex items-center gap-0.5">
                            📍 {item.tempat}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400 mt-0.5">
                            ⏱️ {formatTanggal(item.waktu)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ======================================================= */}
        {/* 2. KONTEN TAB: GURU WALI */}
        {/* ======================================================= */}
        {activeMenuTab === "wali" && (
          <div className="space-y-6">
            {/* HEADER SEKSI GURU WALI */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👨‍🏫</span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">
                    Daftar Siswa Wali
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-800 text-xs font-black">
                    {dataSiswaWali.length} Siswa
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Kontak dan informasi penting siswa perwalian untuk komunikasi
                  cepat via WhatsApp.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchSiswaWali}
                    onChange={(e) => setSearchSiswaWali(e.target.value)}
                    placeholder="Cari nama, ID, kelas..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-medium transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    loadSiswaWaliData(true);
                    loadPersenKehadiranSiswaWali(true);
                  }}
                  disabled={loadingSiswaWali}
                  title="Segarkan data siswa wali"
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <span
                    className={
                      loadingSiswaWali ? "animate-spin inline-block" : ""
                    }
                  >
                    🔄
                  </span>
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorSiswaWali && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="text-xs sm:text-sm font-semibold">
                    {errorSiswaWali}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => loadSiswaWaliData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shrink-0"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingSiswaWali && (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((sk) => (
                  <div
                    key={sk}
                    className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
                  >
                    <div className="h-5 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                    <div className="h-8 bg-slate-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY STATE */}
            {!loadingSiswaWali &&
              !errorSiswaWali &&
              dataSiswaWali.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-sm">
                  <span className="text-5xl">👨‍🎓</span>
                  <h3 className="mt-3 text-base sm:text-lg font-black text-slate-700">
                    Belum Ada Siswa Wali
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto font-medium">
                    Belum terdapat siswa yang terhubung dengan akun guru wali
                    ini. Anda dapat mendaftarkan siswa baru.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/magang/guru/guru-wali/tambah")}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                  >
                    ➕ Tambah Siswa Wali Baru
                  </button>
                </div>
              )}

            {/* LIST SISWA WALI — PADAT, RESPONSIF, URUT ABJAD */}
            {!loadingSiswaWali && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-3">
                {dataSiswaWali
                  .filter((siswa) => {
                    if (!searchSiswaWali.trim()) return true;
                    const q = searchSiswaWali.toLowerCase();
                    const nama = String(siswa.nama || "").toLowerCase();
                    const idS = String(siswa.idSiswa || "").toLowerCase();
                    const kelas = String(siswa.kelas || "").toLowerCase();
                    const tempat = String(
                      siswa.tempatMagang || "",
                    ).toLowerCase();
                    return (
                      nama.includes(q) ||
                      idS.includes(q) ||
                      kelas.includes(q) ||
                      tempat.includes(q)
                    );
                  })
                  .slice()
                  .sort((a, b) => {
                    const namaA = String(a.nama || "")
                      .replace(/\s*\[.*?\]\s*/, "")
                      .trim();
                    const namaB = String(b.nama || "")
                      .replace(/\s*\[.*?\]\s*/, "")
                      .trim();
                    return namaA.localeCompare(namaB, "id", {
                      sensitivity: "base",
                    });
                  })
                  .map((siswa, idx) => {
                    const namaMentah = siswa.nama || "-";
                    const matchKelas = namaMentah.match(/\[(.*?)\]/);
                    const kelas = matchKelas ? matchKelas[1] : siswa.kelas;
                    const namaBersih = namaMentah
                      .replace(/\s*\[.*?\]\s*/, "")
                      .trim();

                    const sid = String(siswa.idSiswa || "").trim();
                    const persenInfo = persenHadirSiswa[sid] || null;
                    const guruPembimbing = guruPklSiswa[sid] || "";

                    const ortuHp =
                      siswa.kontakAyah ||
                      siswa.kontakIbu ||
                      siswa.noHpOrtu ||
                      siswa.noHpOrangTua;
                    const labelOrtu = siswa.kontakAyah
                      ? "Ayah"
                      : siswa.kontakIbu
                        ? "Ibu"
                        : "Ortu";

                    return (
                      <div
                        key={`${sid || "siswa"}-${idx}`}
                        className="flex flex-col overflow-hidden rounded-2xl border border-[#EADBBD] bg-[#FFFDF9] shadow-sm transition-all duration-200 hover:border-[#D4AF37] hover:shadow-md"
                      >
                        {/* HEADER RINGKAS */}
                        <div className="flex items-start gap-2.5 border-b border-[#D4AF37]/30 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-3 py-2.5 text-white">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/20 text-[11px] font-black text-amber-200">
                            {idx + 1}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <h3 className="break-words text-[13px] sm:text-sm font-black leading-tight text-amber-50">
                                {namaBersih || "-"}
                              </h3>

                              {kelas && (
                                <span className="inline-flex shrink-0 items-center rounded-full border border-amber-200/90 bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 px-2 py-0.5 text-[9px] sm:text-[10px] font-black text-amber-950 shadow-sm">
                                  {kelas}
                                </span>
                              )}
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <p className="text-[11px] font-bold tracking-wide text-amber-200/90">
                                ID:{" "}
                                <span className="font-black text-white">
                                  {siswa.idSiswa || "-"}
                                </span>
                              </p>

                              {siswa.idSiswa && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    kirimLoginWhatsApp(
                                      siswa.idSiswa,
                                      siswa.nama,
                                    )
                                  }
                                  title="Bagi ID login siswa via WhatsApp"
                                  className="inline-flex items-center gap-1 rounded-md border border-emerald-400/30 bg-gradient-to-r from-emerald-600 to-teal-600 px-2 py-0.5 text-[10px] font-black text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
                                >
                                  <span>📲</span>
                                  <span>Bagi ID</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* BADGE % HADIR KELAS */}
                          {(() => {
                            const st = getStyleBadgePersen(
                              persenInfo ? persenInfo.persen : null,
                            );
                            return (
                              <div
                                className={`relative flex min-w-[52px] shrink-0 flex-col items-center justify-center self-start overflow-hidden rounded-xl border px-2 py-1 shadow-md ${st.box}`}
                                title={
                                  persenInfo
                                    ? `Hadir ${persenInfo.hadir} dari ${persenInfo.total} pertemuan`
                                    : "Data kehadiran kelas belum tersedia"
                                }
                              >
                                {st.shine && (
                                  <span className="pointer-events-none absolute inset-0 animate-pulse bg-gradient-to-tr from-white/0 via-white/60 to-white/0"></span>
                                )}

                                <span className="relative flex items-center gap-0.5 text-[13px] sm:text-sm font-black leading-none">
                                  {st.star && (
                                    <span className="text-[11px] drop-shadow">
                                      ⭐
                                    </span>
                                  )}

                                  {persenInfo
                                    ? `${persenInfo.persen}%`
                                    : loadingPersenHadir
                                      ? "…"
                                      : "-"}
                                </span>

                                <span className="relative mt-0.5 text-[7px] font-extrabold uppercase leading-none tracking-wide">
                                  Hadir Kelas
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* BODY PADAT */}
                        <div className="flex flex-1 flex-col gap-2 px-3 py-2.5">
                          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                            <div className="min-w-0 rounded-xl border border-emerald-200/80 bg-emerald-50/50 px-2 py-1.5">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-emerald-800/80">
                                📱 WA Siswa
                              </span>
                              {siswa.noHp ? (
                                <a
                                  href={getWhatsAppUrl(siswa.noHp)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-0.5 block truncate text-[11px] font-black text-emerald-700 hover:underline"
                                >
                                  💬 {siswa.noHp}
                                </a>
                              ) : (
                                <span className="mt-0.5 block text-[11px] font-semibold italic text-slate-400">
                                  Belum diisi
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 rounded-xl border border-teal-200/80 bg-teal-50/50 px-2 py-1.5">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-teal-800/80">
                                👨‍👩‍👧 WA {labelOrtu}
                              </span>
                              {ortuHp ? (
                                <a
                                  href={getWhatsAppUrl(ortuHp)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-0.5 block truncate text-[11px] font-black text-teal-700 hover:underline"
                                >
                                  💬 {ortuHp}
                                </a>
                              ) : (
                                <span className="mt-0.5 block text-[11px] font-semibold italic text-slate-400">
                                  Belum diisi
                                </span>
                              )}
                            </div>

                            <div className="min-w-0 rounded-xl border border-blue-200/70 bg-blue-50/50 px-2 py-1.5">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-blue-800/70">
                                🏢 Magang / DUDI
                              </span>
                              <p
                                className="mt-0.5 truncate text-[11px] font-bold text-slate-800"
                                title={siswa.tempatMagang || ""}
                              >
                                {siswa.tempatMagang || "-"}
                              </p>
                            </div>

                            <div className="min-w-0 rounded-xl border border-indigo-200/70 bg-indigo-50/50 px-2 py-1.5">
                              <span className="block text-[9px] font-black uppercase tracking-wider text-indigo-800/70">
                                👔 Guru Pembimbing
                              </span>
                              <p
                                className="mt-0.5 truncate text-[11px] font-bold text-slate-800"
                                title={guruPembimbing}
                              >
                                {guruPembimbing || "-"}
                              </p>
                            </div>
                          </div>

                          {/* ALAMAT */}
                          <div className="flex items-start gap-1.5 rounded-xl border border-amber-200/60 bg-amber-50/40 px-2 py-1.5">
                            <span className="shrink-0 text-[11px]">📍</span>
                            <p
                              className="line-clamp-1 min-w-0 flex-1 text-[11px] font-semibold text-slate-700"
                              title={siswa.alamat || ""}
                            >
                              {siswa.alamat ? (
                                siswa.alamat
                              ) : (
                                <span className="italic text-slate-400">
                                  Belum ada data alamat
                                </span>
                              )}
                            </p>
                          </div>

                          {/* TOMBOL AKSI */}
                          <div className="mt-auto grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSiswaWali(siswa)}
                              className="flex items-center justify-center gap-1 rounded-lg border border-blue-300/80 bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-100 px-2 py-1.5 text-[11px] font-black text-blue-900 transition-all hover:from-blue-100 hover:to-indigo-100 active:scale-95"
                            >
                              <span>👁️</span>
                              <span>Profil</span>
                              <span className="hidden sm:inline">Lengkap</span>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleBukaCatatanPerkembangan(siswa)
                              }
                              className="flex items-center justify-center gap-1 rounded-lg border border-indigo-400/50 bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 px-2 py-1.5 text-[11px] font-black text-white shadow-sm transition-all hover:brightness-110 active:scale-95"
                            >
                              <span>📝</span>
                              <span>Catatan</span>
                              <span className="hidden sm:inline">
                                Perkembangan
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================= */}
        {/* 3. KONTEN TAB: GURU MAPEL */}
        {/* ======================================================= */}
        {activeMenuTab === "mapel" && (
          <div className="space-y-6">
            {/* HEADER SEKSI GURU MAPEL */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📚</span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">
                    Mata Pelajaran Anda
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-800 text-xs font-black">
                    {daftarMapel.length} Mapel
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Kelola presensi, nilai, dan daftar siswa per pertemuan
                  pembelajaran.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchMapel}
                    onChange={(e) => setSearchMapel(e.target.value)}
                    placeholder="Cari mapel, kelas..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 outline-none font-medium transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsFormTambahMapelOpen(!isFormTambahMapelOpen);
                    // Tidak perlu load kelas - sudah menggunakan dropdown statis
                  }}
                  className={`px-3.5 py-2 rounded-xl text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 ${isFormTambahMapelOpen ? "bg-slate-600 hover:bg-slate-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
                >
                  <span>{isFormTambahMapelOpen ? "✕" : "➕"}</span>
                  <span className="hidden sm:inline">
                    {isFormTambahMapelOpen ? "Tutup Form" : "Tambah Mapel"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => loadMapelData(true)}
                  disabled={loadingMapel}
                  title="Segarkan data mapel"
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <span
                    className={loadingMapel ? "animate-spin inline-block" : ""}
                  >
                    🔄
                  </span>
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </div>

            {/* FORM TAMBAH MAPEL BARU (INLINE) */}
            {isFormTambahMapelOpen && (
              <div className="rounded-[1.5rem] bg-white border border-emerald-200 shadow-md overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-white flex items-center gap-2">
                  <span className="text-lg">➕</span>
                  <h3 className="text-sm font-black">
                    Tambah Mata Pelajaran Baru
                  </h3>
                </div>
                <form
                  onSubmit={handleTambahMapelInline}
                  className="p-5 space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Nama Mapel <span className="text-rose-500">*</span>
                      </span>
                      <input
                        type="text"
                        value={formNamaMapel}
                        onChange={(e) => setFormNamaMapel(e.target.value)}
                        placeholder="Contoh: Matematika"
                        required
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      />
                    </label>

                    <label className="block">
                      <span className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                        Kelas{" "}
                        <span className="normal-case font-medium text-slate-500">
                          (opsional)
                        </span>
                      </span>
                      <select
                        value={formKelasDipilih}
                        onChange={(e) => handlePilihKelasForm(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                      >
                        <option value="">-- Tanpa kelas (manual) --</option>
                        {KELAS_OPTIONS}
                      </select>
                    </label>
                  </div>

                  <label className="block">
                    <span className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                      Keterangan (opsional)
                    </span>
                    <input
                      type="text"
                      value={formKeterangan}
                      onChange={(e) => setFormKeterangan(e.target.value)}
                      placeholder="Contoh: Semester Ganjil 2026/2027"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    />
                  </label>

                  {/* PILIHAN JENIS MAPEL */}
                  <div>
                    <span className="block text-xs font-bold uppercase text-slate-700 mb-2">
                      Jenis Kelas Mapel
                    </span>
                    <div className="flex gap-3 flex-wrap">
                      <label
                        className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${formJenisMapel === "biasa" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <input
                          type="radio"
                          name="jenisMapelForm"
                          value="biasa"
                          checked={formJenisMapel === "biasa"}
                          onChange={() => setFormJenisMapel("biasa")}
                          className="accent-blue-600"
                        />
                        <div>
                          <span className="text-sm font-black text-slate-800">
                            📋 Mapel Biasa
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Presensi & nilai harian tatap muka
                          </p>
                        </div>
                      </label>

                      <label
                        className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${formJenisMapel === "online" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                      >
                        <input
                          type="radio"
                          name="jenisMapelForm"
                          value="online"
                          checked={formJenisMapel === "online"}
                          onChange={() => setFormJenisMapel("online")}
                          className="accent-emerald-600"
                        />
                        <div>
                          <span className="text-sm font-black text-slate-800">
                            🌐 Mapel Online
                          </span>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Presensi + upload tugas & pengumpulan siswa
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {formKelasDipilih && (
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          👥 Siswa Kelas {formKelasDipilih}
                        </h3>
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">
                          {formPreviewSiswa.length} Siswa
                        </span>
                      </div>
                      {formLoadingPreview ? (
                        <p className="text-xs font-bold text-slate-500 py-3 text-center">
                          Memuat daftar siswa...
                        </p>
                      ) : formPreviewSiswa.length === 0 ? (
                        <p className="text-xs font-bold text-slate-500 py-3 text-center">
                          Tidak ada siswa ditemukan untuk kelas ini.
                        </p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {formPreviewSiswa.map((s, i) => (
                            <div
                              key={s.idSiswa || i}
                              className="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2"
                            >
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[9px] font-black">
                                {i + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {s.nama}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={formSavingMapel}
                      className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black px-8 py-3 shadow-md transition-all disabled:opacity-60 active:scale-95"
                    >
                      {formSavingMapel ? "Menyimpan..." : "💾 SIMPAN MAPEL"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormTambahMapelOpen(false);
                        setFormNamaMapel("");
                        setFormKeterangan("");
                        setFormKelasDipilih("");
                        setFormPreviewSiswa([]);
                        setFormJenisMapel("biasa");
                      }}
                      className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold px-5 py-3 transition-all active:scale-95"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        router.push("/magang/guru/guru-mapel/kelola")
                      }
                      className="ml-auto rounded-xl bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold px-4 py-3 border border-slate-200 transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <span>⚙️</span>
                      <span className="hidden sm:inline">
                        Kelola Mapel Lanjutan
                      </span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* ERROR STATE */}
            {errorMapel && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="text-xs sm:text-sm font-semibold">
                    {errorMapel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => loadMapelData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shrink-0"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingMapel && (
              <div className="space-y-4">
                {[1, 2, 3].map((sk) => (
                  <div
                    key={sk}
                    className="animate-pulse rounded-[2rem] border border-blue-900/30 bg-blue-950/20 p-6 space-y-3"
                  >
                    <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY STATE */}
            {!loadingMapel && !errorMapel && daftarMapel.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-sm">
                <span className="text-5xl">📚</span>
                <h3 className="mt-3 text-base sm:text-lg font-black text-slate-700">
                  Belum Ada Mata Pelajaran
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto font-medium">
                  Bapak/Ibu belum menambahkan mata pelajaran. Buat mata
                  pelajaran sekarang untuk mulai mencatat presensi dan nilai.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsFormTambahMapelOpen(true);
                    // loadFormDaftarKelas() - tidak dipakai, menggunakan dropdown statis
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                >
                  ➕ Tambah Mapel Baru
                </button>
              </div>
            )}

            {/* ============================================================
                 KARTU GURU MAPEL — REDESAIN UI
                 Semua handler, data, statistik, dan navigasi tetap sama.
               ============================================================ */}
            {!loadingMapel && (
              <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
                {daftarMapel
                  .filter((m) => {
                    if (!searchMapel.trim()) return true;
                    const q = searchMapel.toLowerCase();
                    const nama = String(m.namaMapel || "").toLowerCase();
                    const kelas = String(m.kelas || "").toLowerCase();
                    const ket = String(m.keterangan || "").toLowerCase();
                    return (
                      nama.includes(q) || kelas.includes(q) || ket.includes(q)
                    );
                  })
                  .map((mapel) => {
                    const stats = statsPresensiMapel[mapel.idMapel];

                    const activeP =
                      selectedPertemuanMapel[mapel.idMapel] ??
                      stats?.latestP ??
                      (stats?.validMeetings?.[0] || 1);
                    const meetingData = stats?.perPertemuan?.[activeP];
                    const totalSiswaDisplay =
                      stats?.totalSiswa || mapel.jumlahSiswa || 0;
                    const totalPertemuanDisplay =
                      stats?.validMeetings?.length || 0;

                    const isMapelOnline =
                      String(mapel.keterangan || "")
                        .toUpperCase()
                        .includes("ONLINE") ||
                      String(mapel.jenisMapel || "")
                        .toUpperCase()
                        .includes("ONLINE") ||
                      String(mapel.namaMapel || "")
                        .toUpperCase()
                        .includes("ONLINE");

                    const keteranganBersih = String(mapel.keterangan || "")
                      .replace(/^\[ONLINE\]\s*/i, "")
                      .replace(/\(ONLINE\)/i, "")
                      .trim();

                    const isLoadingStats =
                      !!loadingStatsMapel[mapel.idMapel] || loadingMapel;

                    const accent = isMapelOnline
                      ? {
                          line: "from-emerald-400 via-teal-400 to-cyan-400",
                          soft: "bg-emerald-50",
                          softBorder: "border-emerald-200",
                          text: "text-emerald-800",
                          subText: "text-emerald-700",
                          button: "bg-emerald-600 hover:bg-emerald-700",
                          active:
                            "bg-emerald-600 text-white border-emerald-500 shadow-sm",
                          inactive:
                            "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50",
                        }
                      : {
                          line: "from-blue-500 via-indigo-500 to-sky-400",
                          soft: "bg-blue-50",
                          softBorder: "border-blue-200",
                          text: "text-blue-900",
                          subText: "text-blue-700",
                          button: "bg-blue-600 hover:bg-blue-700",
                          active:
                            "bg-blue-600 text-white border-blue-500 shadow-sm",
                          inactive:
                            "bg-white text-blue-700 border-blue-200 hover:bg-blue-50",
                        };

                    return (
                      <article
                        key={mapel.idMapel}
                        className={`group relative overflow-hidden rounded-2xl border-2 border-yellow-300/80 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)] ${
                          isMapelOnline ? "bg-emerald-100" : "bg-sky-100"
                        }`}
                      >
                        {/* HEADER KUNING TEBAL */}
                        <div className="relative overflow-hidden border-b-2 border-yellow-500/40 bg-gradient-to-r from-yellow-300 via-amber-200 to-yellow-400 px-2.5 py-2.5 sm:px-4 sm:py-3">
                          <div className="absolute inset-y-0 right-0 w-32 bg-white/20 blur-2xl" />
                          <div className="relative flex items-center justify-between gap-2 sm:gap-3">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-yellow-500/40 bg-white/80 text-lg shadow-sm backdrop-blur-sm sm:h-10 sm:w-10 sm:text-xl">
                                {isMapelOnline ? "🌐" : "📚"}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="min-w-0 truncate text-sm font-black leading-tight tracking-tight text-slate-950 sm:text-lg lg:text-xl">
                                    {mapel.namaMapel}
                                  </h3>

                                  <span
                                    className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[8px] font-black uppercase tracking-wider shadow-sm sm:px-2.5 sm:py-1 sm:text-[9px] ${
                                      isMapelOnline
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-blue-600 bg-blue-600 text-white"
                                    }`}
                                  >
                                    {isMapelOnline
                                      ? "🌐 MAPEL ONLINE"
                                      : "📘 MAPEL REGULER"}
                                  </span>
                                </div>

                                <div className="mt-1.5 flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-0.5">
                                  {mapel.kelas && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white/90 px-2 py-0.5 text-[9px] font-black text-slate-800 shadow-sm">
                                      🎓 <span>{mapel.kelas}</span>
                                    </span>
                                  )}
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white/90 px-2 py-0.5 text-[9px] font-black text-slate-800 shadow-sm">
                                    👥 <span>{totalSiswaDisplay} Siswa</span>
                                  </span>
                                  {totalPertemuanDisplay > 0 && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white/90 px-2 py-0.5 text-[9px] font-black text-slate-800 shadow-sm">
                                      🗓️{" "}
                                      <span>
                                        {totalPertemuanDisplay} Pertemuan
                                      </span>
                                    </span>
                                  )}
                                  {isMapelOnline && (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 px-2 py-0.5 text-[9px] font-black text-white shadow-sm">
                                      ⚡ <span>Upload Tugas</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span
                              className={`inline-flex shrink-0 whitespace-nowrap items-center justify-center rounded-lg border px-2 py-1 text-[7px] leading-tight font-black uppercase tracking-wide text-center shadow-sm sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[10px] ${
                                isMapelOnline
                                  ? "border-emerald-600 bg-emerald-600 text-white"
                                  : "border-blue-600 bg-blue-600 text-white"
                              }`}
                            >
                              {isMapelOnline
                                ? "Pembelajaran Daring"
                                : "Pembelajaran Tatap Muka"}
                            </span>
                          </div>
                        </div>

                        {/* BODY GRADIENT */}
                        <div
                          className={`p-3 sm:p-4 lg:p-5 ${
                            isMapelOnline ? "bg-emerald-100" : "bg-sky-100"
                          }`}
                        >
                          {/* INFORMASI TAMBAHAN */}
                          {(keteranganBersih || isMapelOnline) && (
                            <div className="mb-3 grid grid-cols-1 gap-1.5 sm:mb-4 sm:grid-cols-2 sm:gap-2">
                              {keteranganBersih && (
                                <div className="rounded-xl border border-slate-200/80 bg-white/75 px-2.5 py-2 shadow-sm">
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                    Keterangan
                                  </span>
                                  <p className="text-[10px] font-semibold leading-snug text-slate-700 sm:text-[11px]">
                                    {keteranganBersih}
                                  </p>
                                </div>
                              )}

                              {isMapelOnline && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 shadow-sm">
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-emerald-600">
                                    Fitur Online
                                  </span>
                                  <p className="text-[10px] font-semibold leading-snug text-emerald-800 sm:text-[11px]">
                                    Modul tugas, upload tugas, dan pemeriksaan
                                    kiriman siswa tersedia.
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* AKSI CEPAT */}
                          <div className="mb-3 rounded-xl border border-slate-200/80 bg-white/65 p-2.5 shadow-sm sm:mb-4 sm:rounded-2xl sm:p-3">
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                  Aksi Cepat
                                </p>
                                <p className="text-[9px] font-medium text-slate-400 sm:text-[10px]">
                                  Laporan dan pengelolaan mata pelajaran
                                </p>
                              </div>
                              <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[8px] font-black text-yellow-800 sm:px-2 sm:py-1 sm:text-[9px]">
                                Guru Mapel
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
                              <button
                                type="button"
                                onClick={() => handleCetakPdfMapelDirect(mapel)}
                                disabled={
                                  isLoadingStats ||
                                  cetakMapelCardLoadingId === mapel.idMapel
                                }
                                title="Cetak Laporan Presensi & Nilai PDF"
                                className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-gradient-to-r from-fuchsia-700 to-pink-600 px-2 py-1.5 text-[9px] font-black text-white shadow-sm transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:text-[11px]"
                              >
                                {cetakMapelCardLoadingId === mapel.idMapel ? (
                                  <>
                                    <span className="animate-spin">⏳</span>
                                    <span>Mencetak...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>🖨️</span>
                                    <span>Cetak PDF</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  localStorage.setItem(
                                    "mapelAktifId",
                                    mapel.idMapel,
                                  );
                                  router.push("/magang/guru/guru-mapel/kelola");
                                }}
                                disabled={isLoadingStats}
                                title="Buka pengaturan lengkap mapel"
                                className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[9px] font-black text-white shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none sm:text-[11px] ${accent.button}`}
                              >
                                <span>⚙️</span>
                                <span>Kelola Mapel</span>
                              </button>
                            </div>
                          </div>
                          {/* STATUS SINKRONISASI */}
                          {isLoadingStats && (
                            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-800 sm:mt-4 sm:px-3 sm:py-2.5 sm:text-[11px]">
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                              <span>
                                Menyinkronkan data presensi dan riwayat
                                pertemuan...
                              </span>
                            </div>
                          )}

                          {/* PANEL PRESENSI TERAKHIR */}
                          <div className="mt-3 rounded-xl border border-slate-200/80 bg-white/55 p-2.5 sm:mt-4 sm:rounded-2xl sm:p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <div
                                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent.soft} ${accent.softBorder} border`}
                                >
                                  📊
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-800 sm:text-sm">
                                    Presensi Pertemuan Terakhir
                                  </p>
                                  <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                                    {activeP
                                      ? `P-${activeP}${
                                          meetingData?.tanggal
                                            ? ` • ${formatTanggalMapelIndo(
                                                meetingData.tanggal,
                                              )}`
                                            : ""
                                        }`
                                      : "Belum ada pertemuan"}
                                  </p>
                                </div>
                              </div>

                              {isLoadingStats ? (
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                                  ⏳ Sinkronisasi
                                </span>
                              ) : meetingData?.sudahDiisi ? (
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                  ✅ P-{activeP} Terisi
                                </span>
                              ) : (
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                  ○ Belum Ada Pertemuan
                                </span>
                              )}
                            </div>

                            {/* PILIH PERTEMUAN */}
                            {stats?.validMeetings &&
                              stats.validMeetings.length > 1 && (
                                <div className="mt-3 border-t border-slate-200 pt-3">
                                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <span
                                      className={`shrink-0 text-[10px] font-black uppercase tracking-wider ${accent.subText}`}
                                    >
                                      Pilih Pertemuan
                                    </span>
                                    <div className="flex min-w-0 flex-wrap gap-1.5">
                                      {stats.validMeetings.map((pNum) => {
                                        const isSel = pNum === activeP;
                                        return (
                                          <button
                                            key={pNum}
                                            type="button"
                                            disabled={isLoadingStats}
                                            onClick={() =>
                                              setSelectedPertemuanMapel(
                                                (prev) => ({
                                                  ...prev,
                                                  [mapel.idMapel]: pNum,
                                                }),
                                              )
                                            }
                                            className={`rounded-lg border px-2.5 py-1 text-[10px] font-black transition-all disabled:opacity-50 ${
                                              isSel
                                                ? accent.active
                                                : accent.inactive
                                            }`}
                                          >
                                            P-{pNum}
                                            {pNum === stats.latestP
                                              ? " • Terakhir"
                                              : ""}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}

                            {/* RINGKASAN JUMLAH */}
                            <div className="mt-2 grid grid-cols-5 gap-1 sm:mt-3 sm:gap-2">
                              {[
                                {
                                  label: "Hadir",
                                  value: meetingData?.hadir || 0,
                                  icon: "✓",
                                  cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
                                },
                                {
                                  label: "Sakit",
                                  value: meetingData?.sakit || 0,
                                  icon: "＋",
                                  cls: "border-blue-200 bg-blue-50 text-blue-700",
                                },
                                {
                                  label: "Izin",
                                  value: meetingData?.izin || 0,
                                  icon: "i",
                                  cls: "border-amber-200 bg-amber-50 text-amber-700",
                                },
                                {
                                  label: "Alfa",
                                  value: meetingData?.alfa || 0,
                                  icon: "!",
                                  cls: "border-rose-200 bg-rose-50 text-rose-700",
                                },
                                {
                                  label: "Cabut",
                                  value: meetingData?.cabut || 0,
                                  icon: "↗",
                                  cls: "border-violet-200 bg-violet-50 text-violet-700",
                                },
                              ].map((item) => (
                                <div
                                  key={item.label}
                                  className={`rounded-lg border px-1 py-1.5 text-center ${item.cls} sm:rounded-xl sm:px-1.5 sm:py-2`}
                                >
                                  <span className="block text-[8px] font-black uppercase tracking-wide opacity-80 sm:text-[9px]">
                                    {item.label}
                                  </span>
                                  <span className="mt-0.5 block text-[13px] font-black sm:text-base">
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {meetingData?.sudahDiisi && (
                              <div className="mt-3">
                                <PersenKehadiranBar
                                  data={meetingData}
                                  label={`P-${activeP}`}
                                  semuaData={gabungStatistikSesi(
                                    stats?.perPertemuan,
                                  )}
                                  jumlahSesi={stats?.validMeetings?.length || 0}
                                />
                              </div>
                            )}

                            {/* NILAI & DETAIL ABSEN */}
                            <div className="mt-3 space-y-2">
                              {meetingData?.rataRataNilai && (
                                <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-[11px] font-bold text-indigo-800">
                                  <span>🎯</span>
                                  <span>
                                    Rata-rata nilai:
                                    <b className="ml-1 text-indigo-950">
                                      {meetingData.rataRataNilai}
                                    </b>
                                  </span>
                                </div>
                              )}

                              {meetingData?.sudahDiisi ? (
                                meetingData?.absenList?.length > 0 ? (
                                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                                    <div className="mb-1.5 flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                                        ⚠️ Siswa Tidak Hadir
                                      </span>
                                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-amber-700 shadow-sm">
                                        {meetingData.absenList.length} siswa
                                      </span>
                                    </div>

                                    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                                      {meetingData.absenList.map((item, i) => {
                                        let statusStyle =
                                          "border-rose-200 bg-rose-50 text-rose-700";
                                        if (item.status === "Sakit") {
                                          statusStyle =
                                            "border-blue-200 bg-blue-50 text-blue-700";
                                        } else if (item.status === "Izin") {
                                          statusStyle =
                                            "border-amber-200 bg-amber-50 text-amber-700";
                                        } else if (item.status === "Cabut") {
                                          statusStyle =
                                            "border-violet-200 bg-violet-50 text-violet-700";
                                        }

                                        return (
                                          <div
                                            key={i}
                                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${statusStyle}`}
                                          >
                                            <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black uppercase">
                                              {item.status}
                                            </span>
                                            <span className="max-w-[180px] truncate">
                                              {item.nama}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-bold text-emerald-800">
                                    <span>✨</span>
                                    <span>
                                      Semua siswa hadir pada pertemuan ini (
                                      {totalSiswaDisplay} siswa) — Nihil absen.
                                    </span>
                                  </div>
                                )
                              ) : (
                                <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-medium leading-relaxed text-slate-500">
                                  <span>💡</span>
                                  <span>
                                    Belum ada presensi pertemuan yang dicatat.
                                    Buka tabel presensi &amp; nilai di bawah
                                    untuk mulai mengisi.
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AKSI UTAMA */}
                          <button
                            type="button"
                            disabled={isLoadingStats}
                            onClick={() => {
                              if (isLoadingStats) return;
                              setMapelPresensiAktif(mapel);
                            }}
                            className={`mt-3 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-black tracking-wide shadow-sm transition-all active:scale-[0.99] sm:mt-4 sm:min-h-12 sm:gap-2 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-xs disabled:cursor-not-allowed ${
                              isLoadingStats
                                ? "border border-slate-200 bg-slate-100 text-slate-400"
                                : isMapelOnline
                                  ? "border border-emerald-300 bg-gradient-to-r from-emerald-400 via-green-400 to-lime-300 text-emerald-950 hover:brightness-105"
                                  : "border border-blue-300 bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 text-white hover:brightness-105"
                            }`}
                            title={
                              isLoadingStats
                                ? "Data masih dimuat, tombol dinonaktifkan sementara"
                                : "Buka tabel presensi dan pengisian nilai siswa"
                            }
                          >
                            {isLoadingStats ? (
                              <span className="flex items-center gap-2">
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                                <span>Memuat data presensi...</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <span>📊</span>
                                <span>Buka Presensi &amp; Nilai</span>
                              </span>
                            )}
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ======================================================= */}
        {/* 4. KONTEN TAB: GURU WALI KELAS */}
        {/* ======================================================= */}
        {activeMenuTab === "walikelas" && (
          <div className="space-y-6">
            {/* HEADER SEKSI GURU WALI KELAS */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏫</span>
                  <h2 className="text-lg sm:text-xl font-black text-slate-800">
                    Kelas Wali Anda
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-100 border border-teal-200 text-teal-800 text-xs font-black">
                    {daftarWaliKelas.length} Kelas Wali
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                  Kelola presensi harian siswa, jurnal bimbingan, dan
                  rekapitulasi kehadiran.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <div className="relative flex-1 sm:w-64">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                    🔍
                  </span>
                  <input
                    type="text"
                    value={searchWaliKelas}
                    onChange={(e) => setSearchWaliKelas(e.target.value)}
                    placeholder="Cari kelas wali..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-teal-500 outline-none font-medium transition-all"
                  />
                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push("/magang/guru/guru-wali-kelas/kelola")
                  }
                  className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                >
                  <span>➕</span>
                  <span className="hidden sm:inline">Tambah Kelas</span>
                </button>

                <button
                  type="button"
                  onClick={() => loadWaliKelasData(true)}
                  disabled={loadingWaliKelas}
                  title="Segarkan data kelas wali"
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50 shrink-0"
                >
                  <span
                    className={
                      loadingWaliKelas ? "animate-spin inline-block" : ""
                    }
                  >
                    🔄
                  </span>
                  <span className="hidden sm:inline">Segarkan</span>
                </button>
              </div>
            </div>

            {/* ERROR STATE */}
            {errorWaliKelas && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="text-xs sm:text-sm font-semibold">
                    {errorWaliKelas}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => loadWaliKelasData(true)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shrink-0"
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* LOADING SKELETON */}
            {loadingWaliKelas && (
              <div className="space-y-4">
                {[1, 2, 3].map((sk) => (
                  <div
                    key={sk}
                    className="animate-pulse rounded-[2rem] border border-teal-900/30 bg-teal-950/20 p-6 space-y-3"
                  >
                    <div className="h-6 bg-slate-200 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                    <div className="h-10 bg-slate-100 rounded-xl"></div>
                  </div>
                ))}
              </div>
            )}

            {/* EMPTY STATE */}
            {!loadingWaliKelas &&
              !errorWaliKelas &&
              daftarWaliKelas.length === 0 && (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center shadow-sm">
                  <span className="text-5xl">🏫</span>
                  <h3 className="mt-3 text-base sm:text-lg font-black text-slate-700">
                    Belum Ada Kelas Wali
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-md mx-auto font-medium">
                    Bapak/Ibu belum menambahkan kelas wali. Buat kelas wali
                    sekarang untuk mulai mencatat presensi harian dan jurnal
                    bimbingan.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      router.push("/magang/guru/guru-wali-kelas/kelola")
                    }
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-5 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95"
                  >
                    ➕ Tambah Kelas Wali Baru
                  </button>
                </div>
              )}

            {/* ============================================================
                 KARTU WALI KELAS — REDESAIN UI
                 Semua handler, data, statistik, dan navigasi tetap sama.
               ============================================================ */}
            {!loadingWaliKelas && (
              <div className="grid grid-cols-1 gap-5 sm:gap-6">
                {daftarWaliKelas
                  .filter((w) => {
                    if (!searchWaliKelas.trim()) return true;
                    const q = searchWaliKelas.toLowerCase();
                    const nama = String(w.namaKelas || "").toLowerCase();
                    const kelas = String(w.kelas || "").toLowerCase();
                    const ket = String(w.keterangan || "").toLowerCase();
                    return (
                      nama.includes(q) || kelas.includes(q) || ket.includes(q)
                    );
                  })
                  .map((wali) => {
                    const petugas = getPetugasFromWali(wali);
                    const { cleanText } = parseKeteranganWali(
                      wali.keterangan || "",
                    );
                    const stats = statsPresensiHariIniWali[wali.idWali];
                    const isLoadingStats = loadingStatsWali[wali.idWali];

                    const activeTgl =
                      selectedTanggalWali[wali.idWali] ??
                      stats?.latestTanggal ??
                      (stats?.validTanggal?.[0] || null);
                    const sesiData = activeTgl
                      ? stats?.perTanggal?.[activeTgl]
                      : null;
                    const totalSiswaDisplay =
                      stats?.totalSiswa || wali.jumlahSiswa || 0;
                    const totalSesiDisplay = stats?.validTanggal?.length || 0;

                    return (
                      <article
                        key={wali.idWali}
                        className="group relative overflow-hidden rounded-2xl border-2 border-teal-300/80 bg-emerald-100 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
                      >
                        {/* HEADER HIJAU WALI KELAS */}
                        <div className="relative overflow-hidden border-b-2 border-teal-800/40 bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-3 py-3 sm:px-4 sm:py-3.5">
                          <div className="absolute inset-y-0 right-0 w-32 bg-white/10 blur-2xl" />
                          <div className="relative flex items-center justify-between gap-2 sm:gap-3">
                            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-xl shadow-sm backdrop-blur-sm sm:h-11 sm:w-11 sm:rounded-2xl sm:text-2xl">
                                🏫
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="min-w-0 truncate text-base font-black leading-tight tracking-tight text-white sm:text-xl lg:text-2xl">
                                    {wali.namaKelas}
                                  </h3>
                                  <span className="inline-flex shrink-0 items-center rounded-full border border-white/30 bg-white/15 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
                                    🏫 WALI KELAS
                                  </span>
                                </div>

                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/15 px-2 py-0.5 text-[9px] font-black whitespace-nowrap text-white shadow-sm">
                                    👥 <span>{totalSiswaDisplay} Siswa</span>
                                  </span>
                                  {totalSesiDisplay > 0 && (
                                    <span className="inline-flex items-center gap-1 rounded-lg border border-white/25 bg-white/15 px-2 py-0.5 text-[9px] font-black whitespace-nowrap text-white shadow-sm">
                                      🗓️ <span>{totalSesiDisplay} Sesi</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className="hidden sm:inline-flex w-fit shrink-0 whitespace-nowrap items-center rounded-xl border border-white/25 bg-white/15 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm sm:px-3 sm:text-[10px]">
                              Pengelolaan Siswa &amp; Bimbingan
                            </span>
                          </div>
                        </div>

                        {/* BODY GRADIENT */}
                        <div className="bg-emerald-100 p-3 sm:p-4 lg:p-5">
                          {/* KETERANGAN */}
                          {(cleanText || petugas?.namaSiswa) && (
                            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {cleanText && (
                                <div className="rounded-xl border border-slate-200 bg-white/85 px-3 py-2.5 shadow-sm">
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-slate-400">
                                    Keterangan
                                  </span>
                                  <p className="text-[11px] font-semibold leading-relaxed text-slate-700">
                                    {cleanText}
                                  </p>
                                </div>
                              )}

                              {petugas?.namaSiswa && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2.5 shadow-sm">
                                  <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-amber-700">
                                    Petugas Presensi
                                  </span>
                                  <p className="text-[11px] font-black leading-relaxed text-amber-900">
                                    ⭐ {petugas.namaSiswa}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* AKSI CEPAT */}
                          <div className="mb-4 rounded-2xl border border-slate-200 bg-white/75 p-3 shadow-sm">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                  Aksi Cepat
                                </p>
                                <p className="text-[10px] font-medium text-slate-400">
                                  Presensi, jurnal, laporan, dan pengelolaan
                                  kelas
                                </p>
                              </div>
                              <span className="rounded-full bg-yellow-100 px-2 py-1 text-[9px] font-black text-yellow-800">
                                Wali Kelas
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                              <button
                                type="button"
                                onClick={() => setWaliPetugasTarget(wali)}
                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-2 text-[10px] font-black text-amber-950 shadow-sm transition-all hover:brightness-105 active:scale-95 sm:text-[11px]"
                              >
                                <span>⭐</span>
                                <span>Petugas Presensi</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWaliKelasJurnalAktif(wali)}
                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-3 py-2 text-[10px] font-black text-white shadow-sm transition-all hover:brightness-105 active:scale-95 sm:text-[11px]"
                              >
                                <span>📝</span>
                                <span>Jurnal</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleCetakPdfWaliKelasDirect(wali)
                                }
                                disabled={
                                  cetakWaliKelasCardLoadingId === wali.idWali
                                }
                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 px-3 py-2 text-[10px] font-black text-white shadow-sm transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[11px]"
                              >
                                {cetakWaliKelasCardLoadingId === wali.idWali ? (
                                  <>
                                    <span className="animate-spin">⏳</span>
                                    <span>Mencetak...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>🖨️</span>
                                    <span>Cetak PDF</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  router.push(
                                    "/magang/guru/guru-wali-kelas/kelola",
                                  )
                                }
                                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-700 px-3 py-2 text-[10px] font-black text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95 sm:text-[11px]"
                              >
                                <span>⚙️</span>
                                <span>Kelola Kelas</span>
                              </button>
                            </div>
                          </div>
                          {isLoadingStats && (
                            <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-bold text-amber-800">
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                              <span>
                                Memeriksa data presensi dan riwayat sesi...
                              </span>
                            </div>
                          )}

                          {/* PANEL PRESENSI TERAKHIR */}
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 sm:p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex min-w-0 items-center gap-2.5">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-teal-200 bg-teal-50">
                                  📊
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-black text-slate-800 sm:text-sm">
                                    Presensi Pertemuan Terakhir
                                  </p>
                                  <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                                    {activeTgl
                                      ? formatTanggalWaliIndo(activeTgl)
                                      : "Belum ada sesi tercatat"}
                                  </p>
                                </div>
                              </div>

                              {isLoadingStats ? (
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-black text-amber-700">
                                  ⏳ Memeriksa
                                </span>
                              ) : sesiData?.sudahDiisi ? (
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
                                  ✅ Sudah Diisi
                                </span>
                              ) : (
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                  ○ Belum Ada Pertemuan
                                </span>
                              )}
                            </div>

                            {/* PILIH SESI */}
                            {stats?.validTanggal &&
                              stats.validTanggal.length > 1 && (
                                <div className="mt-3 border-t border-slate-200 pt-3">
                                  <div className="flex items-center gap-2">
                                    <span className="shrink-0 text-[10px] font-black uppercase tracking-wider text-teal-700">
                                      Pilih Sesi
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        scrollHorizontal(
                                          `scroll-sesi-wali-${wali.idWali}`,
                                          "left",
                                        )
                                      }
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-white text-[10px] font-black text-teal-700 transition-all hover:bg-teal-50 active:scale-95"
                                      title="Sesi sebelumnya"
                                    >
                                      ◀
                                    </button>

                                    <div
                                      id={`scroll-sesi-wali-${wali.idWali}`}
                                      className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-0.5 scroll-smooth"
                                      style={{
                                        scrollbarWidth: "none",
                                        msOverflowStyle: "none",
                                      }}
                                    >
                                      <style>{`#scroll-sesi-wali-${wali.idWali}::-webkit-scrollbar { display: none; }`}</style>

                                      {[...stats.validTanggal]
                                        .reverse()
                                        .map((tgl) => {
                                          const isSel = tgl === activeTgl;
                                          return (
                                            <button
                                              key={tgl}
                                              type="button"
                                              onClick={() =>
                                                setSelectedTanggalWali(
                                                  (prev) => ({
                                                    ...prev,
                                                    [wali.idWali]: tgl,
                                                  }),
                                                )
                                              }
                                              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-black transition-all ${
                                                isSel
                                                  ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                                                  : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:bg-teal-50"
                                              }`}
                                            >
                                              {formatTanggalKolom(tgl)}{" "}
                                              {tgl === stats.latestTanggal
                                                ? "⭐"
                                                : ""}
                                            </button>
                                          );
                                        })}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        scrollHorizontal(
                                          `scroll-sesi-wali-${wali.idWali}`,
                                          "right",
                                        )
                                      }
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-teal-200 bg-white text-[10px] font-black text-teal-700 transition-all hover:bg-teal-50 active:scale-95"
                                      title="Sesi berikutnya"
                                    >
                                      ▶
                                    </button>
                                  </div>
                                </div>
                              )}

                            {/* RINGKASAN JUMLAH */}
                            <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
                              {[
                                {
                                  label: "Hadir",
                                  value: sesiData?.hadir || 0,
                                  cls: "border-emerald-200 bg-emerald-50 text-emerald-700",
                                },
                                {
                                  label: "Sakit",
                                  value: sesiData?.sakit || 0,
                                  cls: "border-blue-200 bg-blue-50 text-blue-700",
                                },
                                {
                                  label: "Izin",
                                  value: sesiData?.izin || 0,
                                  cls: "border-amber-200 bg-amber-50 text-amber-700",
                                },
                                {
                                  label: "Alfa",
                                  value: sesiData?.alfa || 0,
                                  cls: "border-rose-200 bg-rose-50 text-rose-700",
                                },
                                {
                                  label: "Cabut",
                                  value: sesiData?.cabut || 0,
                                  cls: "border-violet-200 bg-violet-50 text-violet-700",
                                },
                              ].map((item) => (
                                <div
                                  key={item.label}
                                  className={`rounded-xl border px-1.5 py-2 text-center ${item.cls}`}
                                >
                                  <span className="block text-[9px] font-black uppercase tracking-wide opacity-80">
                                    {item.label}
                                  </span>
                                  <span className="mt-0.5 block text-sm font-black sm:text-base">
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {sesiData?.sudahDiisi && (
                              <div className="mt-3">
                                <PersenKehadiranBar
                                  data={sesiData}
                                  label={formatTanggalKolom(activeTgl)}
                                  semuaData={gabungStatistikSesi(
                                    stats?.perTanggal,
                                  )}
                                  jumlahSesi={stats?.validTanggal?.length || 0}
                                />
                              </div>
                            )}

                            {/* DETAIL ABSEN */}
                            <div className="mt-3">
                              {sesiData?.sudahDiisi ? (
                                sesiData?.absenList?.length > 0 ? (
                                  <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                                        ⚠️ Siswa Tidak Hadir
                                      </span>
                                      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-amber-700 shadow-sm">
                                        {sesiData.absenList.length} siswa
                                      </span>
                                    </div>

                                    <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1 custom-scrollbar">
                                      {sesiData.absenList.map((item, i) => {
                                        let statusStyle =
                                          "border-rose-200 bg-rose-50 text-rose-700";
                                        if (item.status === "Sakit") {
                                          statusStyle =
                                            "border-blue-200 bg-blue-50 text-blue-700";
                                        } else if (item.status === "Izin") {
                                          statusStyle =
                                            "border-amber-200 bg-amber-50 text-amber-700";
                                        } else if (item.status === "Cabut") {
                                          statusStyle =
                                            "border-violet-200 bg-violet-50 text-violet-700";
                                        }

                                        return (
                                          <div
                                            key={i}
                                            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${statusStyle}`}
                                          >
                                            <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-black uppercase">
                                              {item.status}
                                            </span>
                                            <span className="max-w-[180px] truncate">
                                              {item.nama}
                                            </span>
                                            {item.keterangan && (
                                              <span className="max-w-[130px] truncate text-[10px] font-medium italic text-slate-500">
                                                ({item.keterangan})
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-bold text-emerald-800">
                                    <span>✨</span>
                                    <span>
                                      Semua siswa hadir pada pertemuan ini (
                                      {totalSiswaDisplay} siswa) — Nihil absen.
                                    </span>
                                  </div>
                                )
                              ) : (
                                <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] font-medium leading-relaxed text-slate-500">
                                  <span>💡</span>
                                  <span>
                                    Belum ada presensi yang dicatat. Gunakan
                                    tombol di bawah untuk membuka tabel presensi
                                    kelas.
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AKSI UTAMA */}
                          <button
                            type="button"
                            onClick={() => setWaliKelasPresensiAktif(wali)}
                            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 px-4 py-3 text-xs font-black tracking-wide text-amber-950 shadow-sm transition-all hover:brightness-105 active:scale-[0.99]"
                          >
                            <span>📅</span>
                            <span>Buka Presensi Harian</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================= */}
      {/* POP-UP MODAL STATISTIK AKUN SISWA */}
      {/* ======================================================= */}
      {statModalConfig.isOpen &&
        (() => {
          const allData = statModalConfig.data || [];
          const breakdown = statModalConfig.breakdownKelas || [];
          const hasBreakdown = Array.isArray(breakdown) && breakdown.length > 0;
          const q = statModalSearch.toLowerCase().trim();

          // -----------------------------------------------------------
          // KASUS 1: CARD BIASA / MODUL MONITORING EKSEKUTIF (GURU, TEMPAT, JURNAL, DLL)
          // -----------------------------------------------------------
          if (!hasBreakdown) {
            const displayData = q
              ? allData.filter((item) => {
                  const nama = typeof item === "object" ? item.nama : item;
                  const info = typeof item === "object" ? item.info : "";
                  return (
                    (nama || "").toLowerCase().includes(q) ||
                    (info || "").toLowerCase().includes(q)
                  );
                })
              : allData;

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-5 flex items-center justify-between text-white border-b border-blue-800 shrink-0">
                    <div>
                      <h3 className="text-base font-black tracking-tight">
                        {statModalConfig.title}
                      </h3>
                      <p className="text-[11px] text-blue-200 mt-0.5">
                        Total: {displayData.length}{" "}
                        {allData.length !== displayData.length
                          ? `dari ${allData.length} data`
                          : "data"}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setStatModalConfig({
                          ...statModalConfig,
                          isOpen: false,
                        })
                      }
                      className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold text-white transition-colors cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Input Pencarian */}
                  {allData.length > 5 && (
                    <div className="p-3 bg-slate-100 border-b border-slate-200 shrink-0">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                          🔍
                        </span>
                        <input
                          type="text"
                          value={statModalSearch}
                          onChange={(e) => setStatModalSearch(e.target.value)}
                          placeholder="Cari..."
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {/* List Data */}
                  <div className="p-5 overflow-y-auto flex-1">
                    {displayData.length > 0 ? (
                      <ul className="space-y-2.5">
                        {displayData.map((item, index) => (
                          <li
                            key={index}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-indigo-800 text-white font-black flex items-center justify-center text-xs shrink-0">
                                {index + 1}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-black text-slate-800 truncate">
                                  {typeof item === "object" ? item.nama : item}
                                </p>
                                {typeof item === "object" && item.info && (
                                  <p className="text-[11px] font-medium text-slate-500 truncate">
                                    {item.info}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-center py-8 text-xs font-bold text-slate-400">
                        {statModalSearch
                          ? "Tidak ada data yang sesuai dengan pencarian."
                          : "Belum ada data tersedia pada kategori ini."}
                      </p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                    <button
                      onClick={() =>
                        setStatModalConfig({
                          ...statModalConfig,
                          isOpen: false,
                        })
                      }
                      className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black transition-all cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // -----------------------------------------------------------
          // KASUS 2: CARD STATISTIK AKUN SISWA (SHEET SISWA - MEMILIKI BREAKDOWN KELAS)
          // -----------------------------------------------------------
          const listByTab = (() => {
            if (statModalTab === "semua") return allData;
            if (statModalTab === "X")
              return allData.filter((item) =>
                (item.info || "").toUpperCase().match(/KELAS:\s*X[\s\-_]/),
              );
            if (statModalTab === "XI")
              return allData.filter((item) =>
                (item.info || "").toUpperCase().match(/KELAS:\s*XI[\s\-_]/),
              );
            if (statModalTab === "XII")
              return allData.filter(
                (item) =>
                  !(item.info || "")
                    .toUpperCase()
                    .match(/KELAS:\s*X[I]?[\s\-_]/) &&
                  (item.info || "").toUpperCase().includes("KELAS:"),
              );
            return allData;
          })();

          const displayData =
            statModalTab !== "statistik"
              ? q
                ? listByTab.filter((item) => {
                    const nama = typeof item === "object" ? item.nama : item;
                    const info = typeof item === "object" ? item.info : "";
                    return (
                      (nama || "").toLowerCase().includes(q) ||
                      (info || "").toLowerCase().includes(q)
                    );
                  })
                : listByTab
              : [];

          const maxCount =
            breakdown.length > 0
              ? Math.max(...breakdown.map((b) => b.count))
              : 1;

          const tabDefs = [
            { key: "statistik", label: "📊 Statistik", icon: "📊" },
            { key: "semua", label: "👥 Semua", icon: "👥" },
            { key: "X", label: "🎒 Kelas X", icon: "🎒" },
            { key: "XI", label: "📘 Kelas XI", icon: "📘" },
            { key: "XII", label: "🎓 Kelas XII", icon: "🎓" },
          ];

          const barColors = [
            "bg-blue-600",
            "bg-sky-500",
            "bg-indigo-500",
            "bg-purple-600",
            "bg-teal-500",
            "bg-cyan-500",
            "bg-violet-500",
            "bg-rose-400",
          ];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden transform transition-all flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-5 flex items-center justify-between text-white border-b border-blue-800 shrink-0">
                  <div>
                    <h3 className="text-base font-black tracking-tight">
                      {statModalConfig.title}
                    </h3>
                    <p className="text-[11px] text-blue-200 mt-0.5">
                      {statModalTab === "statistik"
                        ? `${breakdown.length} kelompok kelas/jurusan • ${allData.length} total siswa`
                        : `${displayData.length}${q ? ` dari ${listByTab.length}` : ""} siswa`}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      setStatModalConfig({
                        ...statModalConfig,
                        isOpen: false,
                      })
                    }
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold text-white transition-colors cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Tab Bar */}
                <div className="flex overflow-x-auto bg-slate-100 border-b border-slate-200 shrink-0 gap-0.5 p-1.5">
                  {tabDefs.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setStatModalTab(t.key);
                        setStatModalSearch("");
                      }}
                      className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer whitespace-nowrap ${
                        statModalTab === t.key
                          ? "bg-blue-900 text-white shadow"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Input Pencarian */}
                {statModalTab !== "statistik" && allData.length > 5 && (
                  <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        🔍
                      </span>
                      <input
                        type="text"
                        value={statModalSearch}
                        onChange={(e) => setStatModalSearch(e.target.value)}
                        placeholder="Cari nama, ID, kelas, atau tempat..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none font-medium"
                      />
                    </div>
                  </div>
                )}

                {/* Konten Utama */}
                <div className="overflow-y-auto flex-1 p-5">
                  {/* TAB: STATISTIK – BAR CHART */}
                  {statModalTab === "statistik" && (
                    <div className="space-y-3">
                      {breakdown.length === 0 ? (
                        <p className="text-center py-8 text-xs font-bold text-slate-400">
                          Data belum tersedia.
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-4 px-1">
                            <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                              Jumlah Siswa per Kelas / Jurusan
                            </p>
                            <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2 py-0.5 rounded-full">
                              Total: {allData.length}
                            </span>
                          </div>

                          {breakdown.map((item, i) => {
                            const pct =
                              maxCount > 0
                                ? Math.max(
                                    4,
                                    Math.round((item.count / maxCount) * 100),
                                  )
                                : 4;
                            const color = barColors[i % barColors.length];
                            return (
                              <div key={item.kelas} className="group">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[11px] font-black text-slate-700 truncate max-w-[60%]">
                                    {item.kelas}
                                  </span>
                                  <span className="text-[11px] font-black text-slate-500 ml-2 shrink-0">
                                    {item.count} siswa
                                    <span className="ml-1 text-slate-300 font-medium">
                                      (
                                      {Math.round(
                                        (item.count / allData.length) * 100,
                                      )}
                                      %)
                                    </span>
                                  </span>
                                </div>
                                <div className="w-full h-5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full ${color} rounded-full transition-all duration-700 flex items-center justify-end pr-2`}
                                    style={{ width: `${pct}%` }}
                                  >
                                    {pct > 20 && (
                                      <span className="text-[9px] font-black text-white">
                                        {item.count}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB: LIST SISWA */}
                  {statModalTab !== "statistik" &&
                    (displayData.length > 0 ? (
                      <ul className="space-y-2.5">
                        {displayData.map((item, index) => (
                          <li
                            key={index}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-indigo-800 text-white font-black flex items-center justify-center text-xs shrink-0">
                                {index + 1}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-black text-slate-800 truncate">
                                  {typeof item === "object" ? item.nama : item}
                                </p>
                                {typeof item === "object" && item.info && (
                                  <p className="text-[11px] font-medium text-slate-500 truncate">
                                    {item.info}
                                  </p>
                                )}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-center py-8 text-xs font-bold text-slate-400">
                        {statModalSearch
                          ? "Tidak ada data yang sesuai dengan pencarian."
                          : "Belum ada data tersedia pada kategori ini."}
                      </p>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button
                    onClick={() =>
                      setStatModalConfig({
                        ...statModalConfig,
                        isOpen: false,
                      })
                    }
                    className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black transition-all cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* MODAL POP-UP NAMA SISWA */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                {modalConfig.title}
              </h3>
              <button
                onClick={() =>
                  setModalConfig({ ...modalConfig, isOpen: false })
                }
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              {modalConfig.data && modalConfig.data.length > 0 ? (
                <ul className="space-y-2">
                  {modalConfig.data.map((namaSiswa, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 shadow-sm"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
                          {index + 1}
                        </div>

                        {typeof namaSiswa === "object" ? (
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800">
                                {namaSiswa.nama.replace(/\s*\[.*?\]/, "")}
                              </span>

                              <span className="px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold">
                                {
                                  (namaSiswa.nama.match(/\[(.*?)\]/) || [
                                    ,
                                    "",
                                  ])[1]
                                }
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-700">
                              {String(namaSiswa).replace(/\s*\[.*?\]/, "")}
                            </span>

                            <span className="px-2 py-0.5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold">
                              {
                                (String(namaSiswa).match(/\[(.*?)\]/) || [
                                  ,
                                  "",
                                ])[1]
                              }
                            </span>
                          </div>
                        )}
                      </div>

                      {typeof namaSiswa === "object" && (
                        <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold min-w-[48px] text-center">
                          {namaSiswa.total}x
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-center py-8">
                  <p className="text-4xl mb-3">📭</p>
                  <p className="text-sm font-semibold text-slate-500">
                    Tidak ada data siswa / Belum ada riwayat.
                  </p>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() =>
                  setModalConfig({ ...modalConfig, isOpen: false })
                }
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL GALERI AKTIVITAS (TAMPILAN SLIDER)
          ========================================= */}
      {showGallery && aktivitas.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-2xl overflow-hidden flex flex-col relative">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-4 flex items-center justify-between text-white">
              <h3 className="font-black text-lg">
                Galeri Aktivitas ({galleryIndex + 1}/{aktivitas.length})
              </h3>
              <button
                onClick={() => setShowGallery(false)}
                className="bg-white/20 hover:bg-white/30 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 flex flex-col items-center relative">
              <div
                className="relative w-full h-64 sm:h-96 bg-slate-100 rounded-xl overflow-hidden cursor-zoom-in group border border-slate-200 shadow-inner"
                onClick={() => setIsFullScreen(true)}
              >
                <img
                  src={optimizeFotoUrl(aktivitas[galleryIndex].foto, 800)}
                  alt="Aktivitas"
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full transition-opacity font-bold">
                    🔍 Klik Gambar untuk Fullscreen
                  </span>
                </div>
              </div>

              <div className="mt-5 text-center px-4 w-full">
                <span
                  className={`inline-block mb-1.5 rounded-lg px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    aktivitas[galleryIndex].jenis === "PRESENSI"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  {aktivitas[galleryIndex].jenis}
                </span>
                <h4 className="font-black text-xl text-slate-800">
                  {aktivitas[galleryIndex].nama}
                </h4>
                <p className="text-sm font-semibold text-slate-500 mt-1">
                  📍 {aktivitas[galleryIndex].tempat}
                </p>
                <p className="text-xs text-slate-400 mt-1 font-medium">
                  ⏱️ {formatTanggal(aktivitas[galleryIndex].waktu)}
                </p>
              </div>

              <button
                onClick={handlePrevImage}
                className="absolute left-2 sm:left-4 top-[40%] -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 shadow-lg p-3 sm:p-4 rounded-full flex items-center justify-center transition-all active:scale-95 border border-slate-200"
              >
                ◀
              </button>
              <button
                onClick={handleNextImage}
                className="absolute right-2 sm:right-4 top-[40%] -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 shadow-lg p-3 sm:p-4 rounded-full flex items-center justify-center transition-all active:scale-95 border border-slate-200"
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          MODAL GAMBAR FULLSCREEN
          ========================================= */}
      {isFullScreen && aktivitas.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-2 sm:p-6">
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-[70] bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors"
          >
            ✕
          </button>

          <img
            src={optimizeFotoUrl(aktivitas[galleryIndex].foto, 1280)}
            alt="Fullscreen Aktivitas"
            className="max-w-full max-h-full object-contain rounded-lg select-none"
            decoding="async"
          />

          <button
            onClick={handlePrevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white shadow-md p-4 rounded-full flex items-center justify-center transition-all"
          >
            ◀
          </button>
          <button
            onClick={handleNextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white shadow-md p-4 rounded-full flex items-center justify-center transition-all"
          >
            ▶
          </button>
        </div>
      )}

      {/* MODAL PILIHAN: CETAK LAPORAN MONITORING atau CETAK JURNAL PKL */}
      {showPilihCetakPklModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-md overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-fuchsia-500 to-pink-600 p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                Cetak Laporan PKL
              </h3>
              <button
                onClick={() => setShowPilihCetakPklModal(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3">
              <button
                onClick={() => {
                  setShowPilihCetakPklModal(false);
                  setShowCetakModal(true);
                }}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center gap-3"
              >
                <span className="text-2xl">📊</span>
                <span>
                  <span className="block font-bold text-slate-800">
                    Cetak Laporan Monitoring
                  </span>
                  <span className="block text-xs text-slate-500">
                    Rekap kehadiran & data pernyataan mutlak (PDF/Excel)
                  </span>
                </span>
              </button>

              <button
                disabled={loadingCetakJurnalPkl}
                onClick={async () => {
                  setShowPilihCetakPklModal(false);
                  await handleCetakJurnalPkl();
                }}
                className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50 transition-colors flex items-center gap-3 disabled:opacity-60"
              >
                <span className="text-2xl">📘</span>
                <span>
                  <span className="block font-bold text-slate-800">
                    {loadingCetakJurnalPkl
                      ? "Menyiapkan PDF..."
                      : "Cetak Jurnal PKL"}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Format Pembimbingan Individual, langsung unduh PDF
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ISIAN CETAK LAPORAN */}
      {showCetakModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75">
          <div className="bg-white rounded-2xl shadow-md w-full max-w-lg overflow-hidden transform transition-all">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-5 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">
                Kelengkapan Cetak Laporan
              </h3>
              <button
                onClick={() => setShowCetakModal(false)}
                className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div>
                <label className="text-xs font-bold text-slate-500">Nama</label>
                <input
                  type="text"
                  value={user?.nama || ""}
                  readOnly
                  className="w-full mt-1 p-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">NIP</label>
                <input
                  type="text"
                  placeholder="Masukkan NIP"
                  value={formDataCetak.nip}
                  onChange={(e) =>
                    setFormDataCetak({ ...formDataCetak, nip: e.target.value })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Pangkat / Golongan
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Penata Tk. I / III.d"
                  value={formDataCetak.pangkat}
                  onChange={(e) =>
                    setFormDataCetak({
                      ...formDataCetak,
                      pangkat: e.target.value,
                    })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Jabatan
                </label>
                <input
                  type="text"
                  placeholder="Masukkan Jabatan"
                  value={formDataCetak.jabatan}
                  onChange={(e) =>
                    setFormDataCetak({
                      ...formDataCetak,
                      jabatan: e.target.value,
                    })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">
                  Nomor Surat Perintah Tugas (SPT)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan Nomor SPT"
                  value={formDataCetak.spt}
                  onChange={(e) =>
                    setFormDataCetak({ ...formDataCetak, spt: e.target.value })
                  }
                  className="w-full mt-1 p-2 border border-slate-300 rounded-lg focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* 👇 CHECKBOX & FORM LAPORAN PERJALANAN DINAS */}
              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includePerjalananDinas}
                    onChange={(e) =>
                      setIncludePerjalananDinas(e.target.checked)
                    }
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-black text-slate-800">
                    📝 Buat Laporan Perjalanan Dinas
                  </span>
                </label>
              </div>

              {includePerjalananDinas && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <p className="font-bold text-indigo-700 uppercase text-[11px] mb-1">
                    Form Input Laporan Perjalanan Dinas
                  </p>

                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-2 rounded-lg text-slate-600 font-medium text-[11px]">
                    <div>
                      <span className="font-bold">Nama:</span>{" "}
                      {user?.nama || "Otomatis"}
                    </div>
                    <div>
                      <span className="font-bold">NIP:</span>{" "}
                      {formDataCetak.nip || "Otomatis"}
                    </div>
                    <div>
                      <span className="font-bold">Jabatan:</span>{" "}
                      {formDataCetak.jabatan || "Otomatis"}
                    </div>
                    <div>
                      <span className="font-bold">No. Surat Tugas:</span>{" "}
                      {formDataCetak.spt || "Otomatis"}
                    </div>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      I. Dasar
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.dasar}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          dasar: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      II. Tempat Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.tempatKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          tempatKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      III. Tanggal Pelaksanaan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.tanggalPelaksanaan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          tanggalPelaksanaan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      IV. Pelaksana Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.pelaksanaKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          pelaksanaKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      V. Nama Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.namaKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          namaKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      VII. Tujuan Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.tujuanKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          tujuanKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      VIII. Sasaran Kegiatan
                    </label>
                    <input
                      type="text"
                      value={formPerjalananDinas.sasaranKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          sasaranKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      IX. Proses Kegiatan
                    </label>
                    <textarea
                      rows={4}
                      value={formPerjalananDinas.prosesKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          prosesKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      X. Hasil Kegiatan
                    </label>
                    <textarea
                      rows={3}
                      value={formPerjalananDinas.hasilKegiatan}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          hasilKegiatan: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-600">
                      XI. Saran – saran
                    </label>
                    <textarea
                      rows={2}
                      value={formPerjalananDinas.saranSaran}
                      onChange={(e) =>
                        setFormPerjalananDinas({
                          ...formPerjalananDinas,
                          saranSaran: e.target.value,
                        })
                      }
                      className="w-full mt-0.5 p-2 border border-slate-300 rounded-lg bg-white"
                    />
                  </div>
                </div>
              )}

              {/* 👇 CHECKBOX & FORM TAMBAH FOTO LAMPIRAN */}
              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeFotoLampiran}
                    onChange={(e) => setIncludeFotoLampiran(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-xs font-black text-slate-800">
                    📎 Tambah Foto Lampiran
                  </span>
                </label>
              </div>

              {includeFotoLampiran && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <p className="font-bold text-indigo-700 uppercase text-[11px] mb-1">
                    Foto Lampiran Kegiatan
                  </p>

                  <div className="space-y-2">
                    {fotoLampiranList.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2"
                      >
                        <input
                          type="text"
                          placeholder="Nama tempat magang"
                          value={item.namaTempat}
                          onChange={(e) =>
                            ubahNamaTempatFotoLampiran(index, e.target.value)
                          }
                          className="flex-1 p-2 border border-slate-300 rounded-lg bg-white text-xs"
                        />

                        <label className="shrink-0 cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadFotoLampiran(index, file);
                              e.target.value = "";
                            }}
                          />
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                              item.fotoBase64
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                : "bg-indigo-100 text-indigo-700 border border-indigo-300"
                            }`}
                          >
                            {item.fotoBase64
                              ? "✅ Foto Terpilih"
                              : "📤 Upload Foto"}
                          </span>
                        </label>

                        {fotoLampiranList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => hapusBarisFotoLampiran(index)}
                            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200 font-bold"
                            title="Hapus baris"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={tambahBarisFotoLampiran}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-600 text-white font-black text-lg shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
                      title="Tambah baris"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>

            {loadingCetakLaporanMonitoring && (
              <div className="px-5 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[10px] font-bold ${
                      retryStatusText ? "text-amber-600" : "text-slate-500"
                    }`}
                  >
                    {retryStatusText || "Menyiapkan PDF..."}
                  </span>
                  <span className="text-[10px] font-black text-indigo-600">
                    {Math.round(progressPdfMonitoring)}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPdfMonitoring}%` }}
                  />
                </div>
              </div>
            )}

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setShowCetakModal(false)}
                disabled={loadingCetakLaporanMonitoring}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-60"
              >
                Batal
              </button>
              <button
                onClick={handleCetakLaporanMonitoringLangsung}
                disabled={loadingCetakLaporanMonitoring}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl transition-colors shadow-lg shadow-indigo-200 disabled:opacity-60"
              >
                {loadingCetakLaporanMonitoring
                  ? `⏳ ${Math.round(progressPdfMonitoring)}%`
                  : "Lanjutkan Cetak"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PILIHAN CETAK LAPORAN GURU WALI */}
      <CetakLaporanGuruWaliModal
        isOpen={showLaporanWaliModal}
        onClose={() => setShowLaporanWaliModal(false)}
        namaGuru={user?.nama}
        fetchDaftarSiswaWali={fetchDaftarSiswaWaliDashboard}
        onCetakLampiranCD={handleCetakLaporanGuruWali}
        loadingLampiranCD={loadingCetakWali}
      />

      {/* MODAL ISIKAN JURNAL PKL */}
      <IsiJurnalPklModal
        isOpen={showJurnalPklModal}
        onClose={() => setShowJurnalPklModal(false)}
        idGuru={user?.id}
        namaGuru={user?.nama}
        onSaved={() => setShowJurnalPklModal(false)}
      />

      {/* MODAL CETAK LAPORAN MAPEL */}
      <CetakLaporanMapelModal
        isOpen={showCetakMapelModal}
        onClose={() => setShowCetakMapelModal(false)}
        guru={user}
      />

      {/* MODAL CETAK LAPORAN WALI KELAS */}
      <CetakLaporanWaliKelasModal
        isOpen={showCetakWaliKelasModal}
        onClose={() => setShowCetakWaliKelasModal(false)}
        guru={user}
      />

      {/* MODAL PROFIL LENGKAP SISWA WALI */}
      {selectedSiswaWali && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelectedSiswaWali(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* TEMA WARNA HEADER MODAL */}
            <div className="shrink-0 bg-gradient-to-r from-blue-900 to-indigo-800 p-4 sm:p-5 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl shadow-inner border border-white/20">
                    👨‍🎓
                  </div>
                  <div>
                    {(() => {
                      const namaMentah = selectedSiswaWali.nama || "-";
                      const matchKelas = namaMentah.match(/\[(.*?)\]/);
                      const kelas = matchKelas
                        ? matchKelas[1]
                        : selectedSiswaWali.kelas;
                      const namaBersih = namaMentah
                        .replace(/\s*\[.*?\]\s*/, "")
                        .trim();

                      return (
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-white">
                            {namaBersih || "-"}
                          </h3>
                          {kelas && (
                            <span className="rounded-md bg-gradient-to-r from-amber-400 to-yellow-400 px-2 py-0.5 text-[10px] font-black text-amber-950">
                              {kelas}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                    <div className="mt-1 flex items-center gap-2 text-xs text-blue-200">
                      <span>ID: {selectedSiswaWali.idSiswa || "-"}</span>
                      {selectedSiswaWali.noHp && (
                        <>
                          <span>&bull;</span>
                          <a
                            href={getWhatsAppUrl(selectedSiswaWali.noHp)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-300 font-bold hover:underline flex items-center gap-1"
                          >
                            💬 {selectedSiswaWali.noHp}
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSiswaWali(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-black text-white hover:bg-black/40 hover:scale-105 active:scale-95 transition-all"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 sm:p-5 space-y-4 text-slate-800 text-xs sm:text-sm">
              {/* DATA SEKOLAH & MAGANG */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
                <h4 className="font-black text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-blue-900">
                  🏫 Data Magang & Pembimbing
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Guru Pembimbing:
                    </span>
                    <span className="font-bold text-slate-800">
                      {guruPklSiswa[
                        String(selectedSiswaWali.idSiswa || "").trim()
                      ] || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Tempat Magang:
                    </span>
                    <span className="font-bold text-slate-800">
                      {selectedSiswaWali.tempatMagang || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DATA KONTAK & ALAMAT */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
                <h4 className="font-black text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-blue-900">
                  📱 Kontak & Alamat
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      No. HP Siswa:
                    </span>
                    {selectedSiswaWali.noHp ? (
                      <a
                        href={getWhatsAppUrl(selectedSiswaWali.noHp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-bold text-emerald-700 hover:underline"
                      >
                        💬 {selectedSiswaWali.noHp} (Buka WhatsApp)
                      </a>
                    ) : (
                      <span className="text-slate-400 italic">Belum diisi</span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Tempat, Tanggal Lahir:
                    </span>
                    <span className="font-bold text-slate-800">
                      {[
                        selectedSiswaWali.tempatLahir,
                        selectedSiswaWali.tglLahir,
                      ]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      Alamat Domisili:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {selectedSiswaWali.alamat || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* DATA ORANG TUA */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50 space-y-2">
                <h4 className="font-black text-slate-800 flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-blue-900">
                  👨‍👩‍👧 Data Orang Tua
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-black text-slate-500 uppercase block mb-1">
                      👨 Ayah
                    </span>
                    <p className="font-bold text-slate-800">
                      {selectedSiswaWali.ayah || "-"}
                    </p>
                    {selectedSiswaWali.pekerjaanAyah && (
                      <p className="text-xs text-slate-500">
                        Pekerjaan: {selectedSiswaWali.pekerjaanAyah}
                      </p>
                    )}
                    {selectedSiswaWali.kontakAyah ? (
                      <a
                        href={getWhatsAppUrl(selectedSiswaWali.kontakAyah)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline mt-1"
                      >
                        💬 {selectedSiswaWali.kontakAyah} (Chat WA)
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-0.5">
                        Kontak belum diisi
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-slate-200/80">
                    <span className="text-[11px] font-black text-slate-500 uppercase block mb-1">
                      👩 Ibu
                    </span>
                    <p className="font-bold text-slate-800">
                      {selectedSiswaWali.ibu || "-"}
                    </p>
                    {selectedSiswaWali.pekerjaanIbu && (
                      <p className="text-xs text-slate-500">
                        Pekerjaan: {selectedSiswaWali.pekerjaanIbu}
                      </p>
                    )}
                    {selectedSiswaWali.kontakIbu ? (
                      <a
                        href={getWhatsAppUrl(selectedSiswaWali.kontakIbu)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline mt-1"
                      >
                        💬 {selectedSiswaWali.kontakIbu} (Chat WA)
                      </a>
                    ) : (
                      <p className="text-xs text-slate-400 italic mt-0.5">
                        Kontak belum diisi
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* HARAPAN / CITA-CITA (JIKA ADA) */}
              {selectedSiswaWali.harapan && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4">
                  <span className="text-[11px] font-black uppercase tracking-wider text-blue-900 block mb-1">
                    🎯 Cita-cita / Harapan Siswa:
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 leading-relaxed">
                    {selectedSiswaWali.harapan}
                  </p>
                </div>
              )}
            </div>

            {/* FOOTER MODAL */}
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedSiswaWali(null)}
                className="flex-1 rounded-xl bg-slate-200 hover:bg-slate-300 px-3 py-2.5 text-xs sm:text-sm font-black text-slate-700 transition-all active:scale-98"
              >
                Tutup Profil
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = selectedSiswaWali;
                  setSelectedSiswaWali(null);
                  handleBukaCatatanPerkembangan(s);
                }}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 px-3 py-2.5 text-xs sm:text-sm font-black text-white transition-all active:scale-98 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>📝</span>
                <span>Catatan</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const match = (selectedSiswaWali.nama || "").match(
                    /\[(.*?)\]/,
                  );
                  const extractedKelas = match
                    ? match[1]
                    : selectedSiswaWali.kelas || "";
                  router.push(
                    `/magang/guru/guru-wali/tambah?editId=${selectedSiswaWali.idSiswa}&kelas=${encodeURIComponent(extractedKelas)}`,
                  );
                }}
                className="flex-1 rounded-xl bg-blue-800 hover:bg-blue-900 px-3 py-2.5 text-xs sm:text-sm font-black text-white transition-all active:scale-98 flex items-center justify-center gap-1.5"
              >
                <span>✏️</span>
                <span>Edit Nama</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CATATAN PERKEMBANGAN MURID (LAMPIRAN B) */}
      {showCatatanModal && siswaCatatanAktif && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-2xl max-h-[92vh] flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-200">
            {/* HEADER MODAL */}
            <div className="shrink-0 bg-gradient-to-r from-indigo-700 via-indigo-600 to-purple-700 px-4 py-4 sm:px-6 sm:py-5 text-white shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-white/20 text-[10px] font-black uppercase tracking-wider">
                      Lampiran B
                    </span>
                    <h2 className="text-sm sm:text-base font-black">
                      Catatan Perkembangan Murid
                    </h2>
                  </div>
                  <p className="mt-1 text-[11px] sm:text-xs text-indigo-100 font-medium">
                    {(siswaCatatanAktif.nama || "-").replace(
                      /\s*\[.*?\]\s*/,
                      "",
                    )}{" "}
                    &middot;{" "}
                    {(siswaCatatanAktif.nama || "").match(/\[(.*?)\]/)?.[1] ||
                      siswaCatatanAktif.kelas ||
                      "-"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={tutupCatatanModal}
                  className="shrink-0 rounded-xl bg-white/10 hover:bg-white/25 px-2.5 py-1.5 text-xs font-black text-white transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* BODY (scrollable) */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 space-y-4">
              {loadingCatatan ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-xs sm:text-sm font-bold text-slate-500">
                    Memuat catatan perkembangan sebelumnya...
                  </p>
                </div>
              ) : (
                <>
                  {/* INFO GURU WALI */}
                  <div className="rounded-2xl bg-gradient-to-r from-indigo-50/70 to-blue-50/70 border border-indigo-100 p-3 text-xs sm:text-sm flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        Guru Wali
                      </span>
                      <p className="font-black text-indigo-950">
                        {guruPklSiswa[
                          String(siswaCatatanAktif.idSiswa || "").trim()
                        ] ||
                          user?.nama ||
                          "-"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                        ID Siswa
                      </span>
                      <p className="font-bold text-slate-700">
                        {siswaCatatanAktif.idSiswa ||
                          siswaCatatanAktif.id ||
                          "-"}
                      </p>
                    </div>
                  </div>

                  {/* PERIODE PEMANTAUAN */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
                    <label className="mb-2 block text-xs sm:text-sm font-black text-slate-800">
                      📅 Periode Pemantauan
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-500">
                          Bulan Awal
                        </span>
                        <input
                          type="month"
                          value={formCatatan.periodeAwal}
                          onChange={(e) =>
                            updateFieldCatatan("periodeAwal", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                      <div>
                        <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-500">
                          Bulan Akhir
                        </span>
                        <input
                          type="month"
                          value={formCatatan.periodeAkhir}
                          onChange={(e) =>
                            updateFieldCatatan("periodeAkhir", e.target.value)
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                      </div>
                    </div>
                    {formCatatan.periodeAwal && formCatatan.periodeAkhir && (
                      <p className="mt-2 text-[11px] sm:text-xs font-bold text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-lg inline-block">
                        Periode: {formatBulanTahun(formCatatan.periodeAwal)} —{" "}
                        {formatBulanTahun(formCatatan.periodeAkhir)}
                      </p>
                    )}
                  </div>

                  {/* ASPEK PEMANTAUAN */}
                  <div className="space-y-3.5">
                    {ASPEK_PEMANTAUAN.map((aspek) => (
                      <div
                        key={aspek.key}
                        className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs"
                      >
                        <div className="bg-gradient-to-r from-indigo-50 via-slate-50 to-indigo-50/40 px-3.5 py-2.5 text-xs sm:text-sm font-black text-indigo-900 border-b border-slate-100 flex items-center justify-between">
                          <span>{aspek.label}</span>
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded">
                            Aspek
                          </span>
                        </div>
                        <div className="p-3.5 space-y-3">
                          <div>
                            <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-600">
                              Deskripsi Perkembangan
                            </span>
                            <textarea
                              rows={2}
                              value={formCatatan[`des${capitalize(aspek.key)}`]}
                              onChange={(e) =>
                                updateFieldCatatan(
                                  `des${capitalize(aspek.key)}`,
                                  e.target.value,
                                )
                              }
                              placeholder={`Tulis deskripsi perkembangan ${aspek.label.toLowerCase()}...`}
                              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
                            />
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-600">
                              Tindak Lanjut yang Dilakukan
                            </span>
                            <textarea
                              rows={2}
                              value={formCatatan[`tin${capitalize(aspek.key)}`]}
                              onChange={(e) =>
                                updateFieldCatatan(
                                  `tin${capitalize(aspek.key)}`,
                                  e.target.value,
                                )
                              }
                              placeholder="Tindakan bimbingan atau solusi yang diberikan..."
                              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
                            />
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] sm:text-xs font-bold text-slate-600">
                              Keterangan Tambahan
                            </span>
                            <textarea
                              rows={2}
                              value={formCatatan[`ket${capitalize(aspek.key)}`]}
                              onChange={(e) =>
                                updateFieldCatatan(
                                  `ket${capitalize(aspek.key)}`,
                                  e.target.value,
                                )
                              }
                              placeholder="Keterangan opsional atau catatan khusus..."
                              className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 placeholder:text-slate-400"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* FOOTER */}
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4 flex gap-2.5">
              <button
                type="button"
                onClick={tutupCatatanModal}
                disabled={savingCatatan}
                className="flex-1 rounded-xl bg-white border border-slate-300 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSimpanCatatanPerkembangan}
                disabled={loadingCatatan || savingCatatan}
                className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-indigo-500/20 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {savingCatatan ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    <span>Simpan Catatan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRESENSI & NILAI MAPEL (POPUP RESPONSIF & PADAT) */}
      {mapelPresensiAktif && (
        <ModalPresensiMapel
          isOpen={!!mapelPresensiAktif}
          onClose={(changed) => {
            const targetId = mapelPresensiAktif?.idMapel;
            setMapelPresensiAktif(null);
            // Hanya lihat-lihat lalu tutup (tanpa perubahan tersimpan) -> kartu
            // dibiarkan seperti semula, tanpa proses loading.
            if (changed === false) return;
            if (targetId) loadStatsMapel(targetId, true);
            loadMapelData(true, true);
          }}
          guru={user}
          mapel={mapelPresensiAktif}
        />
      )}

      {/* MODAL: PRESENSI WALI KELAS */}
      {waliKelasPresensiAktif && (
        <ModalPresensiWaliKelas
          isOpen={!!waliKelasPresensiAktif}
          onClose={(changed) => {
            const targetId = waliKelasPresensiAktif?.idWali;
            setWaliKelasPresensiAktif(null);
            // Hanya lihat-lihat lalu tutup (tanpa perubahan tersimpan) -> kartu
            // dibiarkan seperti semula, tanpa proses loading.
            if (changed === false) return;
            if (targetId) loadStatsHariIniWali(targetId, true);
            loadWaliKelasData(true, true);
          }}
          guru={user}
          wali={waliKelasPresensiAktif}
        />
      )}

      {/* MODAL: JURNAL WALI KELAS */}
      {waliKelasJurnalAktif && (
        <ModalJurnalWaliKelas
          isOpen={!!waliKelasJurnalAktif}
          onClose={() => setWaliKelasJurnalAktif(null)}
          guru={user}
          wali={waliKelasJurnalAktif}
          onSaved={() => {
            alert("✅ Jurnal bimbingan wali kelas berhasil disimpan.");
          }}
        />
      )}

      {/* MODAL: PILIH PETUGAS PRESENSI KELAS */}
      {waliPetugasTarget && (
        <ModalPilihPetugasPresensi
          isOpen={!!waliPetugasTarget}
          onClose={() => setWaliPetugasTarget(null)}
          guru={user}
          wali={waliPetugasTarget}
          onPetugasUpdated={(updatedWali) => {
            setDaftarWaliKelas((prev) =>
              prev.map((w) =>
                w.idWali === updatedWali.idWali
                  ? { ...w, keterangan: updatedWali.keterangan }
                  : w,
              ),
            );
            loadWaliKelasData(true);
          }}
        />
      )}

      {/* MODAL: PESAN KEPALA SEKOLAH */}
      <PesanGuruModal
        isOpen={showPesanKepsek}
        user={user}
        onChanged={refreshPesanBaru}
        onClose={() => {
          setShowPesanKepsek(false);
          refreshPesanBaru();
        }}
      />

      {/* MODAL: ISI JURNAL GURU WALI */}
      <ModalJurnalGuruWali
        isOpen={showJurnalGuruWaliModal}
        onClose={() => setShowJurnalGuruWaliModal(false)}
        guru={{ id: user?.id, nama: user?.nama }}
        onSaved={() => {
          alert("✅ Jurnal guru wali berhasil disimpan.");
        }}
      />

      {/* MODAL: LIHAT / HAPUS JURNAL GURU WALI */}
      <ModalLihatJurnalGuruWali
        isOpen={showLihatJurnalGuruWaliModal}
        onClose={() => setShowLihatJurnalGuruWaliModal(false)}
        guru={{ id: user?.id, nama: user?.nama }}
      />
    </main>
  );
}

// --- JARING PENGAMAN TERAKHIR ---
// Kalau suatu saat ada error runtime tak terduga (bukan cuma dari cache),
// pengguna tidak lagi terjebak layar putih/kosong permanen. Tombol di bawah
// juga membersihkan cache dashboard, jadi kalau penyebabnya cache korup lagi
// di masa depan, pengguna bisa pulih sendiri tanpa harus tahu cara hapus
// data browser secara manual.
class DashboardGuruErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Dashboard Guru crash:", error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("dashboardGuruCache_v2");
      localStorage.removeItem("dashboardGuruCache"); // versi lama, jaga-jaga
    } catch (e) {
      // abaikan
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="text-center max-w-sm">
            <p className="text-4xl mb-3">⚠️</p>
            <h2 className="text-lg font-black text-slate-800 mb-2">
              Gagal Memuat Dashboard
            </h2>
            <p className="text-sm text-slate-500 mb-5">
              Terjadi kendala saat menampilkan data. Tekan tombol di bawah untuk
              membersihkan data sementara dan memuat ulang halaman.
            </p>
            <button
              onClick={this.handleReset}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              🔄 Muat Ulang Dashboard
            </button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function DashboardGuru() {
  return (
    <DashboardGuruErrorBoundary>
      <DashboardGuruContent />
    </DashboardGuruErrorBoundary>
  );
}

function Card({ title, value, accentColor, textColor, icon, onClick }) {
  const bgMap = {
    "border-indigo-500": "from-indigo-600 via-indigo-700 to-blue-800",
    "border-emerald-500": "from-emerald-500 via-green-600 to-teal-700",
    "border-blue-500": "from-blue-600 via-sky-700 to-indigo-800",
    "border-amber-500": "from-amber-500 via-orange-500 to-amber-700",
  };

  const bg = bgMap[accentColor] || "from-slate-600 to-slate-700";

  return (
    <button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        rounded-3xl
        bg-gradient-to-br ${bg}
        text-white
        p-4
        w-full
        shadow-md
        active:scale-95
        transition-all duration-300
      `}
    >
      {/* Icon + Arrow */}
      <div className="relative flex items-start justify-between">
        <div className="h-11 w-11 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center text-xl shadow">
          {icon}
        </div>

        <div className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold border border-white/20">
          Detail
          <span className="group-hover:translate-x-1 transition-transform">
            →
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="relative mt-5">
        <p className="text-[10px] sm:text-xs uppercase tracking-[2px] text-white/80 font-bold">
          {title}
        </p>

        <h2 className="mt-1 text-3xl sm:text-4xl font-black leading-none">
          {value}
        </h2>
      </div>

      {/* Garis */}
      <div className="relative mt-4 h-1 rounded-full bg-white/20 overflow-hidden">
        <div className="h-full w-0 bg-white group-hover:w-full transition-all duration-500"></div>
      </div>
    </button>
  );
}

// StatCard (persis struktur & desain Card() di js_guru)
function StatCard({ title, value, accentColor, icon, onClick }) {
  const bgMap = {
    "border-indigo-500": "from-indigo-600 via-indigo-700 to-blue-800",
    "border-emerald-500": "from-emerald-500 via-green-600 to-teal-700",
    "border-blue-500": "from-blue-600 via-sky-700 to-indigo-800",
    "border-amber-500": "from-amber-500 via-orange-500 to-amber-700",
    "border-teal-500": "from-teal-600 via-teal-700 to-emerald-800",
    "border-blue-600": "from-blue-700 via-blue-800 to-indigo-950",
    "border-sky-500": "from-sky-500 via-cyan-600 to-blue-700",
    "border-purple-600": "from-purple-600 via-violet-700 to-indigo-900",
  };

  const bg = bgMap[accentColor] || "from-slate-700 to-slate-800";

  return (
    <button
      onClick={onClick}
      className={`
        group relative overflow-hidden
        rounded-3xl
        bg-gradient-to-br ${bg}
        text-white
        p-4 sm:p-5
        w-full
        shadow-lg
        active:scale-95
        hover:brightness-105
        transition-all duration-300
        text-left
      `}
    >
      <div className="relative flex items-start justify-between">
        <div className="h-11 w-11 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center text-xl shadow">
          {icon}
        </div>

        <div className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold border border-white/20 flex items-center gap-1">
          Detail
          <span className="group-hover:translate-x-1 transition-transform">
            →
          </span>
        </div>
      </div>

      <div className="relative mt-5">
        <p className="text-[10px] sm:text-xs uppercase tracking-[2px] text-white/80 font-bold">
          {title}
        </p>
        <h2 className="mt-1 text-3xl sm:text-4xl font-black leading-none drop-shadow-sm">
          {value}
        </h2>
      </div>

      <div className="relative mt-4 h-1 rounded-full bg-white/20 overflow-hidden">
        <div className="h-full w-0 bg-white group-hover:w-full transition-all duration-500"></div>
      </div>
    </button>
  );
}

function MenuCard({ title, subtitle, icon, bgGrad, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 sm:p-5 rounded-2xl bg-gradient-to-br ${bgGrad} text-white shadow-lg flex flex-col justify-between h-32 transition-all active:scale-[0.96] active:brightness-95 focus:outline-none border border-white/10`}
    >
      <div className="text-2xl sm:text-3xl bg-white/15 w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl border border-white/20 shadow-inner">
        {icon}
      </div>
      <div>
        <h2 className="text-sm sm:text-base font-black tracking-tight leading-snug">
          {title}
        </h2>
        <p className="text-[10px] sm:text-xs text-white/80 font-medium line-clamp-1 mt-0.5">
          {subtitle}
        </p>
      </div>
    </button>
  );
}

function SolidCompactCard({
  title,
  desc,
  icon,
  bgGrad,
  onClick,
  disabled = false,
}) {
  const formatTitleWithBadge = (text) => {
    if (!text) return text;
    const regex = /(PKL|WALI)/gi;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.toUpperCase() === "PKL" || part.toUpperCase() === "WALI") {
        return (
          <span
            key={index}
            className="inline-block px-1.5 py-0.5 mx-0.5 rounded bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-amber-950 font-black shadow-sm border border-amber-200/60 leading-none"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col justify-center min-h-[76px] rounded-xl p-3 text-left transition-all duration-300 overflow-hidden shadow-lg ${
        disabled
          ? "opacity-60 cursor-not-allowed bg-slate-800 text-slate-400 border border-slate-700"
          : `bg-gradient-to-br ${bgGrad} text-white hover:scale-[1.02] active:scale-[0.98]`
      }`}
    >
      <div className="pointer-events-none absolute -bottom-2 -right-2 z-0 flex items-center justify-center opacity-20 transition-transform duration-300 group-hover:rotate-6">
        <span className="text-5xl sm:text-6xl rotate-12 select-none">
          {icon}
        </span>
      </div>

      <div className="relative z-10 w-full space-y-0.5">
        <h4 className="text-xs font-extrabold leading-normal tracking-wide sm:text-sm text-white drop-shadow-sm flex flex-wrap items-center">
          {formatTitleWithBadge(title)}
        </h4>
        <p className="text-[10px] text-white/80 leading-tight sm:text-xs font-medium">
          {desc}
        </p>
      </div>
    </button>
  );
}
