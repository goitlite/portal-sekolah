"use client";

// =========================================================
// PesanKepsekGuru.js
// Pesan interaktif antara Kepala Sekolah <-> Guru.
// - Mendukung penyimpanan riwayat di Storage (localStorage).
// - Memiliki fitur "Hapus Semua Pesan" di storage.
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
  } catch (e) {}
}

/**
 * Menggabungkan pesan dari server (1 baris spreadsheet) ke dalam histori array storage
 */
function mergePesanServerKeHistori(idGuru, serverData) {
  if (!idGuru || !serverData) return getPesanHistori(idGuru);

  let list = getPesanHistori(idGuru);
  let changed = false;

  // 1. Pesan Kepsek
  if (serverData.pesanKepsek && serverData.pesanKepsek.trim()) {
    const exists = list.some(
      (m) =>
        m.pengirim === "kepsek" &&
        m.teks === serverData.pesanKepsek &&
        (m.waktu === serverData.waktuKepsek || !serverData.waktuKepsek),
    );
    if (!exists) {
      list.push({
        id: "ks-" + (serverData.waktuKepsek || Date.now()),
        pengirim: "kepsek",
        namaPengirim: "Kepala Sekolah",
        teks: serverData.pesanKepsek,
        waktu: serverData.waktuKepsek || new Date().toISOString(),
        dibaca: serverData.dibacaGuru,
      });
      changed = true;
    }
  }

  // 2. Pesan Guru
  if (serverData.pesanGuru && serverData.pesanGuru.trim()) {
    const exists = list.some(
      (m) =>
        m.pengirim === "guru" &&
        m.teks === serverData.pesanGuru &&
        (m.waktu === serverData.waktuGuru || !serverData.waktuGuru),
    );
    if (!exists) {
      list.push({
        id: "gr-" + (serverData.waktuGuru || Date.now()),
        pengirim: "guru",
        namaPengirim: serverData.namaGuru || "Guru",
        teks: serverData.pesanGuru,
        waktu: serverData.waktuGuru || new Date().toISOString(),
        dibaca: serverData.dibacaKepsek,
      });
      changed = true;
    }
  }

  // Urutkan berdasarkan waktu
  list.sort((a, b) => {
    const ta = new Date(a.waktu || 0).getTime();
    const tb = new Date(b.waktu || 0).getTime();
    return ta - tb;
  });

  if (changed) {
    savePesanHistori(idGuru, list);
  }

  return list;
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
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function normalisasiGuru(g) {
  const idGuru = String(g.ID || g.id || g.ID_GURU || g.idGuru || "").trim();
  const namaGuru = String(
    g.NAMA_GURU || g.NAMA || g.nama || g.namaGuru || "",
  ).trim();
  return { idGuru, namaGuru };
}

// =========================================================
// HOOK: JUMLAH PESAN BELUM DIBACA (untuk badge tombol)
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
    } catch (e) {}
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
        className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} max-h-[92vh] flex flex-col overflow-hidden border border-slate-200/80`}
      >
        <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 p-4 sm:p-5 flex items-center justify-between text-white border-b border-blue-800 shrink-0">
          <div className="min-w-0 pr-3">
            <h3 className="text-sm sm:text-base font-black tracking-tight truncate flex items-center gap-2">
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
// PANEL CHAT (Riwayat Pesan Storage + Input Pesan)
// =========================================================
function ChatPanel({
  mode,
  guru,
  idPengirim,
  initialData = null,
  onChanged,
  onBack,
}) {
  const lawan = mode === "guru" ? "Kepala Sekolah" : guru.namaGuru || "Guru";

  // Baca langsung dari storage lokal -> TAMPIL 0 DETIK!
  const [histori, setHistori] = useState(() => getPesanHistori(guru.idGuru));
  const [loading, setLoading] = useState(
    () => histori.length === 0 && !initialData,
  );
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isi, setIsi] = useState("");
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [histori]);

  // Sinkronisasi background dari server
  const syncServer = useCallback(async () => {
    try {
      let serverData = initialData;
      if (!serverData) {
        const res = await pesanGet(guru.idGuru);
        if (res?.success && res.data) {
          serverData = res.data;
        }
      }

      if (serverData) {
        const merged = mergePesanServerKeHistori(guru.idGuru, serverData);
        setHistori([...merged]);

        // Tandai dibaca jika ada pesan masuk yang belum dibaca
        const adaMasukBelumDibaca =
          mode === "guru"
            ? serverData.pesanKepsek && !serverData.dibacaGuru
            : serverData.pesanGuru && !serverData.dibacaKepsek;

        if (adaMasukBelumDibaca) {
          pesanTandaiDibaca(guru.idGuru, mode)
            .then((r) => {
              if (r?.success) onChanged?.();
            })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[ChatPanel] Sync background warning:", e);
    } finally {
      setLoading(false);
    }
  }, [guru.idGuru, mode, initialData, onChanged]);

  useEffect(() => {
    const t = setTimeout(syncServer, 0);
    return () => clearTimeout(t);
  }, [syncServer]);

  // Hapus semua pesan di storage
  function handleHapusSemua() {
    if (histori.length === 0) {
      alert("Tidak ada pesan di penyimpanan untuk dihapus.");
      return;
    }
    const yakin = window.confirm(
      `Hapus semua riwayat pesan dengan ${lawan} dari penyimpanan perangkat ini?\n\nPesan lama yang tersimpan di storage HP/browser ini akan dibersihkan.`,
    );
    if (!yakin) return;

    hapusSemuaPesanStorage(guru.idGuru);
    setHistori([]);
    setInfo("🗑️ Semua riwayat pesan di storage berhasil dihapus.");
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
        "❌ Izin notifikasi DIBLOKIR di HP Anda.\n\nCara mengaktifkannya:\n1. Buka Pengaturan HP (Settings)\n2. Pilih 'Aplikasi' (Apps) > 'Portal Sekolah' (atau Chrome)\n3. Pilih 'Notifikasi' > Hidupkan 'Izinkan Notifikasi'.",
      );
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert(
          "⚠️ Izin notifikasi belum diizinkan (Status: " +
            perm +
            "). Silakan pilih 'Izinkan' saat muncul pop-up.",
        );
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

      // Trigger juga kirim push via FCM server untuk role saat ini
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🔔 Web Push FCM Berhasil!",
          body: `Halo ${mode === "guru" ? guru.namaGuru || "Guru" : "Kepala Sekolah"}, push notifikasi server aktif.`,
          targetUserId: mode === "guru" ? guru.idGuru : idPengirim,
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

    setSending(true);

    // Optimistic Update: Tambahkan langsung ke histori storage lokal
    const pesanBaru = {
      id: "msg-" + Date.now(),
      pengirim: mode,
      namaPengirim:
        mode === "guru" ? guru.namaGuru || "Guru" : "Kepala Sekolah",
      teks,
      waktu: new Date().toISOString(),
      dibaca: false,
    };

    const newHistori = [...histori, pesanBaru];
    setHistori(newHistori);
    savePesanHistori(guru.idGuru, newHistori);
    setIsi("");

    try {
      const res = await pesanKirim({
        dari: mode,
        idGuru: guru.idGuru,
        idPengirim,
        isi: teks,
      });

      if (res?.success) {
        setInfo("✅ Pesan terkirim.");
        onChanged?.();

        // Kirim Web Push Notification ke HP Android / Device penerima
        try {
          const namaPengirim =
            mode === "guru" ? guru.namaGuru || "Guru" : "Kepala Sekolah";
          if (mode === "guru") {
            await fetch("/api/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: `📩 Pesan dari ${namaPengirim}`,
                body: teks.length > 100 ? teks.slice(0, 97) + "..." : teks,
                url: "/magang/kepsek",
                targetRole: "kepsek",
              }),
            });
          } else {
            await fetch("/api/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "📩 Pesan dari Kepala Sekolah",
                body: teks.length > 100 ? teks.slice(0, 97) + "..." : teks,
                url: "/magang/guru",
                targetUserId: guru.idGuru,
              }),
            });
          }
        } catch (pushErr) {
          console.warn("[Push] Kirim notifikasi error:", pushErr);
        }
      } else {
        setError(res?.message || "Pesan gagal tersimpan di server Google.");
      }
    } catch (e) {
      setError(
        "Pesan tersimpan di storage lokal, tetapi koneksi ke server gagal.",
      );
    } finally {
      setSending(false);
      setTimeout(() => setInfo(""), 4000);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-100/70">
      {/* Header Lawan Bicara + Tombol Hapus */}
      <div className="px-4 py-3 border-b border-slate-200 bg-white flex items-center justify-between gap-3 shrink-0 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black cursor-pointer active:scale-95"
            >
              ← Kembali
            </button>
          )}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xs shadow-md shrink-0">
            {mode === "guru"
              ? "KS"
              : String(lawan).substring(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-800 truncate">
              {lawan}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              {mode === "guru"
                ? "Kepala Sekolah SMKN 1 Teluk Kuantan"
                : `ID Guru: ${guru.idGuru}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Tombol Tes Notifikasi */}
          <button
            type="button"
            onClick={handleTesNotif}
            title="Tes apakah notifikasi bisa muncul di HP ini"
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

      {/* Area Chat / Riwayat Pesan dari Storage */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3.5">
        {loading && histori.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400">
              Menghubungkan pesan...
            </p>
          </div>
        ) : histori.length === 0 ? (
          <div className="text-center py-16 space-y-2 max-w-sm mx-auto">
            <div className="w-14 h-14 bg-white rounded-3xl shadow-sm border border-slate-200 flex items-center justify-center text-2xl mx-auto">
              💬
            </div>
            <p className="text-xs font-black text-slate-700">
              Belum ada percakapan
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Tulis pesan pertama Anda di bawah. Riwayat pesan akan tersimpan
              rapi di perangkat ini.
            </p>
          </div>
        ) : (
          histori.map((msg, idx) => {
            const isMe = msg.pengirim === mode;
            return (
              <div
                key={msg.id || idx}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-1.5 mb-1 px-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {isMe ? "Anda" : lawan}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    • {formatWaktuPesan(msg.waktu)}
                  </span>
                </div>

                <div
                  className={`max-w-[88%] sm:max-w-[78%] rounded-2xl p-3.5 shadow-xs ${
                    isMe
                      ? "rounded-tr-xs bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 text-white"
                      : "rounded-tl-xs bg-white border border-slate-200 text-slate-800"
                  }`}
                >
                  <p className="text-xs sm:text-sm font-medium whitespace-pre-wrap break-words leading-relaxed">
                    {msg.teks}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Tulis Pesan */}
      <div className="p-3 sm:p-4 border-t border-slate-200 bg-white shrink-0 space-y-2 shadow-lg">
        {error && (
          <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError("")}
              className="text-rose-500 font-bold ml-2"
            >
              ✕
            </button>
          </p>
        )}
        {info && (
          <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            {info}
          </p>
        )}

        <div className="relative">
          <textarea
            rows={2}
            value={isi}
            maxLength={PESAN_MAX_LENGTH}
            onChange={(e) => {
              setIsi(e.target.value);
              if (error) setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                kirim();
              }
            }}
            placeholder={`Tulis pesan untuk ${lawan}... (Enter untuk kirim)`}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] text-slate-400">
            Tersimpan di storage •{" "}
            <span className="font-bold text-slate-500">
              {isi.length}/{PESAN_MAX_LENGTH}
            </span>
          </p>
          <button
            type="button"
            onClick={kirim}
            disabled={sending || !isi.trim()}
            className="shrink-0 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 hover:brightness-110 active:scale-95 text-white text-xs font-black shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
          >
            {sending ? "⏳ Mengirim..." : "📨 Kirim Pesan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================
// SISI GURU: Modal Pesan Kepala Sekolah
// =========================================================
export function PesanGuruModal({ isOpen, onClose, user, onChanged }) {
  if (!isOpen || !user?.id) return null;
  return (
    <PesanShell
      title="✉️ Pesan Kepala Sekolah"
      subtitle="Percakapan langsung dengan Kepala Sekolah SMKN 1 Teluk Kuantan"
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
// SISI KEPALA SEKOLAH: Kotak Pesan Seluruh Guru + Chat
// =========================================================
function KepsekInbox({ onClose, initialGuru, user, onChanged }) {
  // Gunakan cache untuk daftar guru agar langsung tampil 0 detik!
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
    initialGuru?.idGuru ? initialGuru : null,
  );

  const loadAll = useCallback(
    async (quiet = false) => {
      if (!quiet && guruList.length === 0) setLoading(true);
      setError("");
      try {
        const [resGuru, resPesan] = await Promise.all([
          getGuru(),
          pesanGetDaftar(),
        ]);

        if (resGuru?.success && Array.isArray(resGuru.data)) {
          const list = resGuru.data
            .map(normalisasiGuru)
            .filter((g) => g.idGuru);
          setGuruList(list);
          try {
            sessionStorage.setItem(
              STORAGE_KEPSEK_LIST_CACHE,
              JSON.stringify(list),
            );
          } catch (e) {}
        }

        if (resPesan?.success && Array.isArray(resPesan.data)) {
          const map = {};
          resPesan.data.forEach((row) => {
            map[String(row.idGuru)] = row;
            // Otomatis sinkronkan juga ke histori storage lokal per guru
            mergePesanServerKeHistori(String(row.idGuru), row);
          });
          setDaftar(map);
        }
      } catch (e) {
        if (guruList.length === 0) {
          setError("Gagal terhubung ke server Google.");
        }
      } finally {
        setLoading(false);
      }
    },
    [guruList.length],
  );

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
    const base = guruList.map((g) => ({
      ...g,
      row: daftar[g.idGuru] || null,
      histori: getPesanHistori(g.idGuru),
    }));

    if (
      initialGuru?.idGuru &&
      !base.some((g) => g.idGuru === initialGuru.idGuru)
    ) {
      base.push({
        idGuru: initialGuru.idGuru,
        namaGuru: initialGuru.namaGuru,
        row: daftar[initialGuru.idGuru] || null,
        histori: getPesanHistori(initialGuru.idGuru),
      });
    }

    const filtered = q
      ? base.filter(
          (g) =>
            g.namaGuru.toLowerCase().includes(q) ||
            g.idGuru.toLowerCase().includes(q),
        )
      : base;

    const unread = (g) => (g.row?.pesanGuru && !g.row?.dibacaKepsek ? 1 : 0);
    const lastTime = (g) => {
      const serverTime =
        [g.row?.waktuGuru, g.row?.waktuKepsek].filter(Boolean).sort().pop() ||
        "";
      const lastMsg = g.histori[g.histori.length - 1];
      const localTime = lastMsg?.waktu || "";
      return serverTime > localTime ? serverTime : localTime;
    };

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
      subtitle="Kotak pesan Kepala Sekolah bersama seluruh Guru SMKN 1 Teluk Kuantan"
      onClose={onClose}
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col md:flex-row flex-1 min-h-0 h-[74vh]">
        {/* DAFTAR GURU */}
        <div
          className={`${
            selected ? "hidden md:flex" : "flex"
          } md:w-80 shrink-0 flex-col border-r border-slate-200 min-h-0 flex-1 md:flex-none bg-white`}
        >
          <div className="p-3 border-b border-slate-200 bg-slate-50/80 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari guru atau ID..."
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
            {!loading && items.length === 0 && (
              <p className="text-center py-8 text-xs font-bold text-slate-400">
                Guru tidak ditemukan.
              </p>
            )}

            {items.map((g) => {
              const belumDibaca = g.row?.pesanGuru && !g.row?.dibacaKepsek;
              const lastLocal = g.histori[g.histori.length - 1];
              let preview = "";
              if (lastLocal) {
                preview = `${lastLocal.pengirim === "guru" ? "Guru: " : "Anda: "}${lastLocal.teks}`;
              } else if (g.row?.pesanGuru || g.row?.pesanKepsek) {
                preview = g.row?.pesanGuru
                  ? `Guru: ${g.row.pesanGuru}`
                  : `Anda: ${g.row.pesanKepsek}`;
              }

              const aktif = selected?.idGuru === g.idGuru;
              return (
                <button
                  key={g.idGuru}
                  type="button"
                  onClick={() =>
                    setSelected({
                      idGuru: g.idGuru,
                      namaGuru: g.namaGuru,
                      row: g.row,
                    })
                  }
                  className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                    aktif ? "bg-blue-50/80" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                    {g.namaGuru.substring(0, 2).toUpperCase() || "??"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-slate-800 truncate">
                        {g.namaGuru || g.idGuru}
                      </p>
                      {belumDibaca && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-rose-500 text-white text-[9px] font-black animate-pulse">
                          BARU
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] truncate ${
                        belumDibaca
                          ? "font-bold text-slate-800"
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
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-slate-50">
              <span className="text-5xl mb-3">💬</span>
              <p className="text-sm font-black text-slate-600">
                Pilih guru untuk melihat dan membalas pesan
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Riwayat pesan tersimpan di storage dan akan langsung terbuka
                tanpa menunggu loading.
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
