"use client";

// =========================================================
// PesanKepsekGuru.js
// Pesan 1-kali-chat antara Kepala Sekolah <-> Guru.
// - Menampilkan status "✓✓ Dibaca" (hijau) dan "✓ Terkirim" (kuning).
// - Memiliki riwayat storage pesan sebelumnya + tombol "Hapus Semua Pesan".
// - Loading instan (0 detik) dengan cache lokal + background sync.
// - Terintegrasi Web Push Notification ke Android & Desktop.
// =========================================================

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  getGuru,
  pesanKirim,
  pesanGet,
  pesanGetDaftar,
  pesanTandaiDibaca,
  pesanGetJumlahBaru,
} from "../lib/api";

export const PESAN_MAX_LENGTH = 500;
const STORAGE_HISTORI_PREFIX = "portal_pesan_histori_";
const STORAGE_LAST_PREFIX = "portal_pesan_last_";
const STORAGE_KEPSEK_LIST_CACHE = "portal_pesan_kepsek_list_cache";

// =========================================================
// HELPER STORAGE PESAN (HISTORI LOKAL)
// =========================================================
export function getPesanHistori(idGuru) {
  if (typeof window === "undefined" || !idGuru) return [];
  try {
    const raw = localStorage.getItem(STORAGE_HISTORI_PREFIX + idGuru);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function savePesanHistori(idGuru, list) {
  if (typeof window === "undefined" || !idGuru) return;
  try {
    localStorage.setItem(STORAGE_HISTORI_PREFIX + idGuru, JSON.stringify(list));
  } catch (e) {}
}

export function hapusSemuaPesanStorage(idGuru) {
  if (typeof window === "undefined" || !idGuru) return;
  try {
    localStorage.removeItem(STORAGE_HISTORI_PREFIX + idGuru);
    localStorage.removeItem(STORAGE_LAST_PREFIX + idGuru);
  } catch (e) {}
}

function formatWaktuPesan(waktu) {
  if (!waktu) return "";
  const d = new Date(waktu);
  if (isNaN(d.getTime())) return String(waktu);
  return (
    d.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function normalisasiGuru(g) {
  const idGuru = String(g.ID || g.id || g.ID_GURU || g.idGuru || "").trim();
  const namaGuru = String(
    g.NAMA_GURU || g.NAMA || g.nama || g.namaGuru || ""
  ).trim();
  return { idGuru, namaGuru };
}

// =========================================================
// HOOK: JUMLAH PESAN BELUM DIBACA (untuk badge tombol)
// role: "guru" | "kepsek"
// =========================================================
export function useJumlahPesanBaru({
  role,
  idGuru = "",
  enabled = true,
  intervalMs = 60000,
}) {
  const [jumlah, setJumlah] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    if (role === "guru" && !idGuru) return;
    try {
      const res = await pesanGetJumlahBaru(role, idGuru);
      if (res && res.success) {
        setJumlah(Number(res.data?.jumlah ?? res.data) || 0);
      }
    } catch (e) {
      // badge tidak boleh mengganggu dashboard
    }
  }, [role, idGuru, enabled]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const first = setTimeout(() => {
      if (alive) refresh();
    }, 0);
    const timer = setInterval(() => {
      if (alive && document.visibilityState === "visible") refresh();
    }, intervalMs);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh, enabled, intervalMs]);

  return [jumlah, refresh];
}

// =========================================================
// SHELL MODAL
// =========================================================
function PesanShell({
  title,
  subtitle,
  onClose,
  maxWidth = "max-w-3xl",
  children,
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[92vh] flex flex-col overflow-hidden border border-slate-200`}
      >
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-4 sm:p-5 flex items-center justify-between text-white border-b border-blue-800 shrink-0">
          <div className="min-w-0 pr-3">
            <h3 className="text-sm sm:text-base font-black tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-blue-200 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-sm font-bold text-white transition-colors shrink-0 cursor-pointer active:scale-95"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}

// =========================================================
// PANEL CHAT (1 pesan masuk + 1 pesan keluar + Riwayat Storage + Status Dibaca)
// mode: "guru"   -> lawan bicara = Kepala Sekolah
//       "kepsek" -> lawan bicara = guru terpilih
// =========================================================
function ChatPanel({ mode, guru, idPengirim, initialData = null, onChanged, onBack }) {
  const lawan = mode === "guru" ? "Kepala Sekolah" : guru.namaGuru || "Guru";

  // Baca cache data terakhir dari storage -> Tampil 0 detik!
  const [data, setData] = useState(() => {
    if (initialData) return initialData;
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(STORAGE_LAST_PREFIX + guru.idGuru);
        if (cached) return JSON.parse(cached);
      } catch (e) {}
    }
    return null;
  });

  const [histori, setHistori] = useState(() => getPesanHistori(guru.idGuru));
  const [showHistori, setShowHistori] = useState(false);
  const [loading, setLoading] = useState(() => !data && !initialData);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isi, setIsi] = useState("");
  const [sending, setSending] = useState(false);

  const onChangedRef = useRef(onChanged);
  useEffect(() => {
    onChangedRef.current = onChanged;
  }, [onChanged]);

  // Muat & Sinkronisasi Pesan Terkini dari Server
  const load = useCallback(async () => {
    setError("");
    try {
      let d = initialData;
      if (!d) {
        const res = await pesanGet(guru.idGuru);
        if (res?.success && res.data) {
          d = res.data;
        } else if (!data) {
          setError(res?.message || "Gagal memuat pesan.");
          return;
        }
      }

      if (d) {
        setData(d);
        try {
          localStorage.setItem(STORAGE_LAST_PREFIX + guru.idGuru, JSON.stringify(d));
        } catch (e) {}

        // Simpan juga ke histori storage jika ada teks baru
        let currentHistori = getPesanHistori(guru.idGuru);
        let updated = false;

        if (d.pesanKepsek && !currentHistori.some((m) => m.teks === d.pesanKepsek && m.pengirim === "kepsek")) {
          currentHistori.push({
            id: "ks-" + (d.waktuKepsek || Date.now()),
            pengirim: "kepsek",
            namaPengirim: "Kepala Sekolah",
            teks: d.pesanKepsek,
            waktu: d.waktuKepsek || new Date().toISOString(),
          });
          updated = true;
        }

        if (d.pesanGuru && !currentHistori.some((m) => m.teks === d.pesanGuru && m.pengirim === "guru")) {
          currentHistori.push({
            id: "gr-" + (d.waktuGuru || Date.now()),
            pengirim: "guru",
            namaPengirim: d.namaGuru || "Guru",
            teks: d.pesanGuru,
            waktu: d.waktuGuru || new Date().toISOString(),
          });
          updated = true;
        }

        if (updated) {
          savePesanHistori(guru.idGuru, currentHistori);
          setHistori([...currentHistori]);
        }

        // Tandai dibaca jika ada pesan masuk yang belum dibaca
        const adaMasukBelumDibaca =
          mode === "guru"
            ? d?.pesanKepsek && !d?.dibacaGuru
            : d?.pesanGuru && !d?.dibacaKepsek;

        if (adaMasukBelumDibaca) {
          pesanTandaiDibaca(guru.idGuru, mode).then((r2) => {
            if (r2?.success) {
              onChangedRef.current?.();
            }
          }).catch(() => {});
        }
      }
    } catch (e) {
      if (!data) setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, [guru.idGuru, mode, initialData, data]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  // Pemetaan pesan masuk & keluar
  const masuk =
    mode === "guru"
      ? { teks: data?.pesanKepsek, waktu: data?.waktuKepsek }
      : { teks: data?.pesanGuru, waktu: data?.waktuGuru };

  const keluar =
    mode === "guru"
      ? {
          teks: data?.pesanGuru,
          waktu: data?.waktuGuru,
          dibaca: data?.dibacaKepsek,
        }
      : {
          teks: data?.pesanKepsek,
          waktu: data?.waktuKepsek,
          dibaca: data?.dibacaGuru,
        };

  // Hapus semua pesan di storage
  function handleHapusSemua() {
    const totalPesan = histori.length + (data?.pesanGuru || data?.pesanKepsek ? 1 : 0);
    if (totalPesan === 0) {
      alert("Tidak ada pesan tersimpan untuk dihapus.");
      return;
    }
    const yakin = window.confirm(
      `Hapus semua riwayat pesan dengan ${lawan} dari penyimpanan perangkat ini?\n\nPesan lama yang tersimpan di storage HP/browser ini akan dibersihkan.`
    );
    if (!yakin) return;

    hapusSemuaPesanStorage(guru.idGuru);
    setHistori([]);
    setData(null);
    setInfo("🗑️ Semua riwayat pesan di storage perangkat ini berhasil dibersihkan.");
    setTimeout(() => setInfo(""), 4000);
  }

  // Tes Notifikasi langsung di HP ini
  async function handleTesNotif() {
    if (!("Notification" in window)) {
      alert("Browser/HP ini tidak mendukung Web Notification.");
      return;
    }

    if (Notification.permission === "denied") {
      alert(
        "❌ Izin notifikasi DIBLOKIR di HP Anda.\n\nCara mengaktifkannya:\n1. Buka Pengaturan HP (Settings)\n2. Pilih 'Aplikasi' (Apps) > 'Portal Sekolah' (atau Chrome)\n3. Pilih 'Notifikasi' > Hidupkan 'Izinkan Notifikasi'."
      );
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("⚠️ Izin notifikasi belum diizinkan (Status: " + perm + "). Silakan pilih 'Izinkan' saat muncul pop-up.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("🔔 Tes Notifikasi Portal Sekolah", {
        body: "Hebat! Notifikasi di HP Anda sudah aktif dan berfungsi normal.",
        icon: "/logo.png",
        badge: "/logo.png",
        vibrate: [200, 100, 200],
      });

      setInfo("🔔 Notifikasi percobaan dikirim ke HP Anda!");
      setTimeout(() => setInfo(""), 5000);

      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🔔 Web Push FCM Berhasil!",
          body: `Halo ${mode === "guru" ? (guru.namaGuru || "Guru") : "Kepala Sekolah"}, push notifikasi server aktif.`,
          targetUserId: mode === "guru" ? String(guru.idGuru).trim() : String(idPengirim).trim(),
          targetRole: mode,
        }),
      }).catch(() => {});
    } catch (e) {
      alert("Gagal memicu notifikasi: " + e.message);
    }
  }

  async function kirim() {
    setError("");
    setInfo("");
    const teks = isi.trim();
    if (!teks) {
      setError("Pesan tidak boleh kosong.");
      return;
    }
    if (teks.length > PESAN_MAX_LENGTH) {
      setError(`Pesan maksimal ${PESAN_MAX_LENGTH} karakter.`);
      return;
    }
    if (
      keluar.teks &&
      !window.confirm(
        "Pesan Anda sebelumnya kepada " +
          lawan +
          " akan diganti dengan pesan baru ini.\n\nLanjutkan?"
      )
    ) {
      return;
    }

    setSending(true);

    const waktuSkrg = new Date().toISOString();

    // 1. Update Tampilan Langsung (Optimistic) dengan status "✓ Terkirim"
    const dataBaru = {
      ...(data || {}),
      idGuru: guru.idGuru,
      namaGuru: guru.namaGuru,
      [mode === "guru" ? "pesanGuru" : "pesanKepsek"]: teks,
      [mode === "guru" ? "waktuGuru" : "waktuKepsek"]: waktuSkrg,
      [mode === "guru" ? "dibacaKepsek" : "dibacaGuru"]: false, // Belum dibaca oleh lawan bicara
    };
    setData(dataBaru);
    try {
      localStorage.setItem(STORAGE_LAST_PREFIX + guru.idGuru, JSON.stringify(dataBaru));
    } catch (e) {}

    // Simpan juga ke histori storage
    const historiBaru = [
      ...histori,
      {
        id: "msg-" + Date.now(),
        pengirim: mode,
        namaPengirim: mode === "guru" ? (guru.namaGuru || "Guru") : "Kepala Sekolah",
        teks,
        waktu: waktuSkrg,
        dibaca: false,
      },
    ];
    setHistori(historiBaru);
    savePesanHistori(guru.idGuru, historiBaru);
    setIsi("");

    // 2. Kirim Web Push Langsung ke HP lawan bicara (Paralel, tanpa menunggu Apps Script)
    const targetUserIdKirim = mode === "guru" ? "" : String(guru.idGuru).trim();
    const targetRoleKirim = mode === "guru" ? "kepsek" : "guru";
    const namaPengirimNotif = mode === "guru" ? (guru.namaGuru || "Guru") : "Kepala Sekolah";

    fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: mode === "guru" ? `📩 Pesan dari ${namaPengirimNotif}` : "📩 Pesan dari Kepala Sekolah",
        body: teks.length > 100 ? teks.slice(0, 97) + "..." : teks,
        url: mode === "guru" ? "/magang/kepsek" : "/magang/guru",
        targetUserId: targetUserIdKirim,
        targetRole: targetRoleKirim,
      }),
    })
      .then((r) => r.json())
      .then((resPush) => {
        console.log("[Push Send Status]:", resPush);
      })
      .catch((err) => {
        console.warn("[Push Send Error]:", err);
      });

    // 3. Simpan ke Google Apps Script (Spreadsheet)
    try {
      const res = await pesanKirim({
        dari: mode,
        idGuru: guru.idGuru,
        idPengirim,
        isi: teks,
      });

      if (res?.success) {
        if (res.data) {
          setData(res.data);
          try {
            localStorage.setItem(STORAGE_LAST_PREFIX + guru.idGuru, JSON.stringify(res.data));
          } catch (e) {}
        }
        setInfo("✅ Pesan terkirim.");
        onChangedRef.current?.();
      } else {
        setError(res?.message || "Pesan disimpan di storage lokal, tapi gagal tersimpan di Spreadsheet.");
      }
    } catch (e) {
      setError("Pesan tersimpan di storage lokal. Menunggu sinkronisasi ke server.");
    } finally {
      setSending(false);
      setTimeout(() => setInfo(""), 4000);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50/70">
      {/* Header lawan bicara + Tombol Aksi */}
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden px-2.5 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black cursor-pointer active:scale-95"
            >
              ← Kembali
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-900 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
            {mode === "guru" ? "KS" : String(lawan).substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">{lawan}</p>
            <p className="text-[11px] text-slate-400 font-medium">
              {mode === "guru"
                ? "Pesan ke / dari Kepala Sekolah"
                : `ID Guru: ${guru.idGuru}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tombol Tes Notifikasi */}
          <button
            type="button"
            onClick={handleTesNotif}
            title="Tes apakah notifikasi bisa bergetar dan muncul di HP ini"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
          >
            <span>🔔</span>
            <span className="hidden sm:inline">Tes Notif HP</span>
          </button>

          {/* Tombol Hapus Semua Pesan di Storage */}
          <button
            type="button"
            onClick={handleHapusSemua}
            title="Hapus riwayat pesan di penyimpanan perangkat ini"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-[11px] font-bold transition-all active:scale-95 cursor-pointer"
          >
            <span>🗑️</span>
            <span className="hidden sm:inline">Hapus Semua Pesan</span>
          </button>
        </div>
      </div>

      {/* Isi percakapan (Format Asli Elegan dengan Status Terbaca/Belum Dibaca) */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        {loading && !data ? (
          <div className="text-center py-10 space-y-2">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">Memuat pesan...</p>
          </div>
        ) : (
          <>
            {/* Pesan masuk (Kiri) */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Pesan dari {lawan}
              </p>
              {masuk.teks ? (
                <div className="max-w-[92%] sm:max-w-[80%] rounded-2xl rounded-tl-sm bg-white border border-slate-200 shadow-sm p-3.5">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
                    {masuk.teks}
                  </p>
                  <p className="mt-2 text-[10px] font-medium text-slate-400">
                    🕒 {formatWaktuPesan(masuk.waktu)}
                  </p>
                </div>
              ) : (
                <p className="text-xs italic text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-3">
                  Belum ada pesan dari {lawan}.
                </p>
              )}
            </div>

            {/* Pesan keluar (Kanan - Pesan Anda dengan Status ✓✓ Dibaca / ✓ Terkirim) */}
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                Pesan Anda
              </p>
              {keluar.teks ? (
                <div className="max-w-[92%] sm:max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-blue-700 to-indigo-800 text-white shadow-sm p-3.5">
                  <p className="text-xs sm:text-sm font-semibold whitespace-pre-wrap break-words leading-relaxed">
                    {keluar.teks}
                  </p>
                  <div className="mt-2 text-[10px] font-medium text-blue-200 flex items-center justify-between gap-3 pt-1 border-t border-white/15">
                    <span>🕒 {formatWaktuPesan(keluar.waktu)}</span>
                    <span
                      className={`font-black text-[11px] flex items-center gap-1 ${
                        keluar.dibaca ? "text-emerald-300 font-extrabold" : "text-amber-300"
                      }`}
                    >
                      {keluar.dibaca ? "✓✓ Dibaca" : "✓ Terkirim"}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs italic text-slate-400 bg-white border border-dashed border-slate-200 rounded-xl p-3">
                  Anda belum mengirim pesan.
                </p>
              )}
            </div>

            {/* Bagian Riwayat Pesan Storage Sebelumnya (Jika Ada) */}
            {histori.length > 2 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowHistori(!showHistori)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-200/70 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>📜</span>
                  <span>{showHistori ? "Sembunyikan Riwayat Pesan Lama" : `Lihat Riwayat Pesan Lama (${histori.length} pesan di storage)`}</span>
                </button>

                {showHistori && (
                  <div className="mt-3 p-3 bg-white/80 rounded-2xl border border-slate-200 space-y-2.5 divide-y divide-slate-100">
                    {histori.slice(0, -2).map((m, idx) => (
                      <div key={m.id || idx} className="pt-2 first:pt-0">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-0.5">
                          <span className={m.pengirim === mode ? "text-blue-700" : "text-slate-700"}>
                            {m.pengirim === mode ? "Anda" : lawan}
                          </span>
                          <span className="text-[9px] text-slate-400">{formatWaktuPesan(m.waktu)}</span>
                        </div>
                        <p className="text-xs text-slate-700 whitespace-pre-wrap">{m.teks}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Kotak Tulis Pesan */}
      <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0 space-y-2">
        {error && (
          <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError("")} className="text-rose-500 font-bold ml-2">✕</button>
          </p>
        )}
        {info && (
          <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5">
            {info}
          </p>
        )}

        <textarea
          rows={3}
          value={isi}
          maxLength={PESAN_MAX_LENGTH}
          onChange={(e) => {
            setIsi(e.target.value);
            if (error) setError("");
          }}
          placeholder={`Tulis pesan untuk ${lawan}...`}
          className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-xs sm:text-sm text-slate-800 font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-medium text-slate-400 leading-snug">
            Tersimpan di storage • Pesan baru menimpa di spreadsheet.
            <span className="ml-1 font-black text-slate-500">
              {isi.length}/{PESAN_MAX_LENGTH}
            </span>
          </p>
          <button
            type="button"
            onClick={kirim}
            disabled={sending || !isi.trim()}
            className="shrink-0 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:brightness-110 text-white text-xs font-black shadow-md active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {sending ? "⏳ Mengirim..." : "📨 Kirim Pesan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// SISI GURU: pesan ke/dari Kepala Sekolah
// =========================================================
export function PesanGuruModal({ isOpen, onClose, user, onChanged }) {
  if (!isOpen || !user?.id) return null;
  return (
    <PesanShell
      title="✉️ Pesan Kepala Sekolah"
      subtitle="Satu pesan terakhir untuk Kepala Sekolah SMKN 1 Teluk Kuantan"
      onClose={onClose}
      maxWidth="max-w-xl"
    >
      <ChatPanel
        key={String(user.id)}
        mode="guru"
        guru={{ idGuru: String(user.id), namaGuru: user.nama || "" }}
        idPengirim={String(user.id)}
        onChanged={onChanged}
      />
    </PesanShell>
  );
}

// =========================================================
// SISI KEPALA SEKOLAH: kotak pesan seluruh guru + chat
// initialGuru: {idGuru, namaGuru} -> langsung buka chat guru tsb
// =========================================================
function KepsekInbox({ onClose, initialGuru, user, onChanged }) {
  const [guruList, setGuruList] = useState(() => {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEPSEK_LIST_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const [daftar, setDaftar] = useState({});
  const [loading, setLoading] = useState(() => guruList.length === 0);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(
    initialGuru?.idGuru ? initialGuru : null
  );

  const loadAll = useCallback(async (quiet = false) => {
    if (!quiet && guruList.length === 0) setLoading(true);
    setError("");
    try {
      const [resGuru, resPesan] = await Promise.all([
        getGuru(),
        pesanGetDaftar(),
      ]);

      if (resGuru?.success && Array.isArray(resGuru.data)) {
        const list = resGuru.data.map(normalisasiGuru).filter((g) => g.idGuru);
        setGuruList(list);
        try {
          sessionStorage.setItem(STORAGE_KEPSEK_LIST_CACHE, JSON.stringify(list));
        } catch (e) {}
      }

      if (resPesan?.success && Array.isArray(resPesan.data)) {
        const map = {};
        resPesan.data.forEach((row) => {
          map[String(row.idGuru)] = row;
        });
        setDaftar(map);
      }

      if (!resGuru?.success) {
        setError(resGuru?.message || "Gagal memuat daftar guru.");
      }
    } catch (e) {
      if (guruList.length === 0) setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, [guruList.length]);

  useEffect(() => {
    const t = setTimeout(() => loadAll(false), 0);
    return () => clearTimeout(t);
  }, [loadAll]);

  const handleChanged = useCallback(() => {
    loadAll(true);
    onChanged?.();
  }, [loadAll, onChanged]);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = guruList.map((g) => ({ ...g, row: daftar[g.idGuru] || null }));

    if (
      initialGuru?.idGuru &&
      !base.some((g) => g.idGuru === initialGuru.idGuru)
    ) {
      base.push({
        idGuru: initialGuru.idGuru,
        namaGuru: initialGuru.namaGuru,
        row: daftar[initialGuru.idGuru] || null,
      });
    }

    const filtered = q
      ? base.filter(
          (g) =>
            g.namaGuru.toLowerCase().includes(q) ||
            g.idGuru.toLowerCase().includes(q)
        )
      : base;

    const unread = (g) => (g.row?.pesanGuru && !g.row?.dibacaKepsek ? 1 : 0);
    const lastTime = (g) =>
      [g.row?.waktuGuru, g.row?.waktuKepsek].filter(Boolean).sort().pop() || "";

    return filtered.sort((a, b) => {
      if (unread(a) !== unread(b)) return unread(b) - unread(a);
      const ta = lastTime(a);
      const tb = lastTime(b);
      if (ta !== tb) return ta < tb ? 1 : -1;
      return a.namaGuru.localeCompare(b.namaGuru);
    });
  }, [guruList, daftar, search, initialGuru]);

  return (
    <PesanShell
      title="✉️ Pesan Guru"
      subtitle="Satu pesan terakhir per guru — pesan baru menimpa pesan lama"
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col md:flex-row flex-1 min-h-0 h-[72vh]">
        {/* DAFTAR GURU */}
        <div
          className={`${
            selected ? "hidden md:flex" : "flex"
          } md:w-80 shrink-0 flex-col border-r border-slate-200 min-h-0 flex-1 md:flex-none`}
        >
          <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama / ID guru..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-blue-500 outline-none font-medium"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-100">
            {loading && guruList.length === 0 && (
              <p className="text-center py-8 text-xs font-bold text-slate-400 animate-pulse">
                Memuat daftar guru...
              </p>
            )}
            {!loading && error && guruList.length === 0 && (
              <div className="p-4 text-center space-y-2">
                <p className="text-xs font-bold text-rose-600">⚠️ {error}</p>
                <button
                  type="button"
                  onClick={() => loadAll(false)}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
                >
                  Coba Lagi
                </button>
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="text-center py-8 text-xs font-bold text-slate-400">
                Guru tidak ditemukan.
              </p>
            )}

            {items.map((g) => {
              const belumDibaca = g.row?.pesanGuru && !g.row?.dibacaKepsek;
              const preview =
                (g.row?.waktuGuru || "") >= (g.row?.waktuKepsek || "")
                  ? g.row?.pesanGuru
                    ? `Guru: ${g.row.pesanGuru}`
                    : ""
                  : `Anda: ${g.row?.pesanKepsek || ""}`;
              const aktif = selected?.idGuru === g.idGuru;
              return (
                <button
                  key={g.idGuru}
                  type="button"
                  onClick={() =>
                    setSelected({ idGuru: g.idGuru, namaGuru: g.namaGuru, row: g.row })
                  }
                  className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                    aktif ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-900 flex items-center justify-center font-black text-xs shrink-0">
                    {g.namaGuru.substring(0, 2).toUpperCase() || "??"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-800 truncate">
                        {g.namaGuru || g.idGuru}
                      </p>
                      {belumDibaca && (
                        <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black">
                          BARU
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] truncate ${
                        belumDibaca
                          ? "font-bold text-slate-700"
                          : "font-medium text-slate-400"
                      }`}
                    >
                      {preview || "Belum ada pesan"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL CHAT */}
        <div
          className={`${
            selected ? "flex" : "hidden md:flex"
          } flex-1 min-w-0 min-h-0 flex-col`}
        >
          {selected ? (
            <ChatPanel
              key={selected.idGuru}
              mode="kepsek"
              guru={selected}
              initialData={selected.row || daftar[selected.idGuru] || null}
              idPengirim={String(user?.id || "")}
              onChanged={handleChanged}
              onBack={() => setSelected(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
              <span className="text-5xl mb-2">✉️</span>
              <p className="text-sm font-black text-slate-500">
                Pilih guru untuk mengirim atau membaca pesan
              </p>
            </div>
          )}
        </div>
      </div>
    </PesanShell>
  );
}

export function PesanKepsekModal(props) {
  if (!props.isOpen) return null;
  return <KepsekInbox {...props} />;
}
