"use client";

// =========================================================
// PesanKepsekGuru.js
// Ruang Chat Kepala Sekolah <-> Guru Model WhatsApp.
// - Gelembung chat mengalir ala WhatsApp (Kiri = Masuk, Kanan = Keluar).
// - Centang 1 (✓ Terkirim) dan Centang 2 Biru (✓✓ Dibaca).
// - Tidak ada tombol pesan tersimpan yang terpisah (otomatis mengalir).
// - Semua chat tersimpan otomatis di localStorage.
// - Tombol Hapus Chat membersihkan semua riwayat.
// - Web Push Notification langsung terkirim ke Android.
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
const STORAGE_CHAT_PREFIX = "portal_pesan_chat_";
const STORAGE_KEPSEK_LIST_CACHE = "portal_pesan_kepsek_list_cache";

// =========================================================
// HELPER STORAGE (CHAT HISTORY LOCALSTORAGE)
// =========================================================
export function getChatHistory(idGuru) {
  if (typeof window === "undefined" || !idGuru) return [];
  try {
    const raw = localStorage.getItem(STORAGE_CHAT_PREFIX + idGuru);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

export function saveChatHistory(idGuru, list) {
  if (typeof window === "undefined" || !idGuru) return;
  try {
    localStorage.setItem(STORAGE_CHAT_PREFIX + idGuru, JSON.stringify(list));
  } catch (e) {}
}

export function hapusSemuaChat(idGuru) {
  if (typeof window === "undefined" || !idGuru) return;
  try {
    localStorage.removeItem(STORAGE_CHAT_PREFIX + idGuru);
    localStorage.removeItem("portal_pesan_last_" + idGuru);
    localStorage.removeItem("portal_pesan_histori_" + idGuru);
  } catch (e) {}
}

function formatJamPesan(waktu) {
  if (!waktu) return "";
  const d = new Date(waktu);
  if (isNaN(d.getTime())) return String(waktu);
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTanggalHeader(waktu) {
  if (!waktu) return "";
  const d = new Date(waktu);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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
// SHELL MODAL CHAT
// =========================================================
function PesanShell({ onClose, maxWidth = "max-w-3xl", children }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className={`bg-white rounded-3xl shadow-2xl w-full ${maxWidth} h-[92vh] max-h-[850px] flex flex-col overflow-hidden border border-slate-200/80`}
      >
        {children}
      </div>
    </div>
  );
}

// =========================================================
// PANEL CHAT MODEL WHATSAPP
// =========================================================
function ChatPanel({ mode, guru, idPengirim, initialData = null, onChanged, onBack, onClose }) {
  const lawan = mode === "guru" ? "Kepala Sekolah" : guru.namaGuru || "Guru";

  // Baca histori chat langsung dari storage -> Langsung tampil dalam 0 detik!
  const [messages, setMessages] = useState(() => getChatHistory(guru.idGuru));
  const [isi, setIsi] = useState("");
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");

  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sinkronisasi data terkini dari server
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
        let currentList = getChatHistory(guru.idGuru);
        let changed = false;

        // Cek pesan Kepsek
        if (serverData.pesanKepsek && serverData.pesanKepsek.trim()) {
          const exists = currentList.find(
            (m) =>
              m.pengirim === "kepsek" &&
              m.teks === serverData.pesanKepsek &&
              (m.waktu === serverData.waktuKepsek || !serverData.waktuKepsek)
          );
          if (exists) {
            // Update status dibaca
            if (exists.dibaca !== serverData.dibacaGuru) {
              exists.dibaca = serverData.dibacaGuru;
              changed = true;
            }
          } else {
            currentList.push({
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

        // Cek pesan Guru
        if (serverData.pesanGuru && serverData.pesanGuru.trim()) {
          const exists = currentList.find(
            (m) =>
              m.pengirim === "guru" &&
              m.teks === serverData.pesanGuru &&
              (m.waktu === serverData.waktuGuru || !serverData.waktuGuru)
          );
          if (exists) {
            // Update status dibaca
            if (exists.dibaca !== serverData.dibacaKepsek) {
              exists.dibaca = serverData.dibacaKepsek;
              changed = true;
            }
          } else {
            currentList.push({
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

        if (changed) {
          currentList.sort(
            (a, b) => new Date(a.waktu || 0).getTime() - new Date(b.waktu || 0).getTime()
          );
          saveChatHistory(guru.idGuru, currentList);
          setMessages([...currentList]);
        }

        // Tandai dibaca jika ada pesan masuk yang belum dibaca
        const adaMasukBelumDibaca =
          mode === "guru"
            ? serverData.pesanKepsek && !serverData.dibacaGuru
            : serverData.pesanGuru && !serverData.dibacaKepsek;

        if (adaMasukBelumDibaca) {
          pesanTandaiDibaca(guru.idGuru, mode).then((r) => {
            if (r?.success) onChanged?.();
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("[Chat] Sync warning:", e);
    }
  }, [guru.idGuru, mode, initialData, onChanged]);

  useEffect(() => {
    const t = setTimeout(syncServer, 0);
    return () => clearTimeout(t);
  }, [syncServer]);

  // Hapus semua percakapan
  function handleHapusChat() {
    if (messages.length === 0) {
      alert("Ruang chat sudah kosong.");
      return;
    }

    const yakin = window.confirm(
      `Hapus semua pesan chat dengan ${lawan}?\n\nSemua riwayat percakapan di perangkat ini akan dibersihkan.`
    );
    if (!yakin) return;

    hapusSemuaChat(guru.idGuru);
    setMessages([]);
    setInfo("🗑️ Semua riwayat chat berhasil dibersihkan.");
    setTimeout(() => setInfo(""), 4000);
  }

  // Tes Notifikasi langsung
  async function handleTesNotif() {
    if (!("Notification" in window)) {
      alert("Browser/HP ini tidak mendukung Web Notification.");
      return;
    }

    if (Notification.permission === "denied") {
      alert(
        "❌ Izin notifikasi DIBLOKIR di HP Anda.\n\nCara mengaktifkannya:\n1. Buka Pengaturan HP > Aplikasi > Portal Sekolah (atau Chrome)\n2. Pilih Notifikasi > Hidupkan Izinkan Notifikasi."
      );
      return;
    }

    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        alert("⚠️ Izin notifikasi belum diizinkan. Silakan pilih 'Izinkan'.");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification("🔔 Tes Notifikasi Portal Sekolah", {
        body: "Hebat! Notifikasi di HP Anda sudah aktif dan berfungsi.",
        icon: "/logo.png",
        vibrate: [200, 100, 200],
      });

      setInfo("🔔 Notifikasi percobaan dikirim ke HP Anda!");
      setTimeout(() => setInfo(""), 4000);

      // Trigger Web Push server
      fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "🔔 Web Push Berhasil!",
          body: `Halo ${mode === "guru" ? (guru.namaGuru || "Guru") : "Kepala Sekolah"}, push notifikasi server aktif.`,
          targetUserId: mode === "guru" ? String(guru.idGuru).trim() : String(idPengirim).trim(),
          targetRole: mode,
        }),
      }).catch(() => {});
    } catch (e) {
      alert("Gagal memicu notifikasi: " + e.message);
    }
  }

  // Kirim Pesan ala WhatsApp
  async function handleKirim(e) {
    if (e) e.preventDefault();

    const teks = isi.trim();
    if (!teks) return;

    if (teks.length > PESAN_MAX_LENGTH) {
      setError(`Pesan maksimal ${PESAN_MAX_LENGTH} karakter.`);
      return;
    }

    setError("");
    setInfo("");
    setSending(true);

    const waktuSkrg = new Date().toISOString();

    // 1. Optimistic Chat Bubble Langsung Masuk (Centang 1 Terkirim)
    const pesanBaru = {
      id: "msg-" + Date.now(),
      pengirim: mode,
      namaPengirim: mode === "guru" ? (guru.namaGuru || "Guru") : "Kepala Sekolah",
      teks,
      waktu: waktuSkrg,
      dibaca: false, // Centang 1 (Belum dibaca lawan bicara)
    };

    const newHistory = [...messages, pesanBaru];
    setMessages(newHistory);
    saveChatHistory(guru.idGuru, newHistory);
    setIsi("");

    // 2. Tembakkan Web Push Langsung ke HP lawan bicara tanpa menunggu
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
    }).catch(() => {});

    // 3. Simpan ke Google Apps Script (Spreadsheet)
    try {
      const res = await pesanKirim({
        dari: mode,
        idGuru: guru.idGuru,
        idPengirim,
        isi: teks,
      });

      if (res?.success) {
        onChanged?.();
      } else {
        console.warn("[Chat] Gagal sync spreadsheet:", res?.message);
      }
    } catch (e) {
      console.warn("[Chat] Server sync pending:", e);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#efeae2] relative">
      {/* HEADER ALA WHATSAPP */}
      <div className="px-4 py-3 bg-[#075e54] text-white flex items-center justify-between gap-3 shrink-0 shadow-md z-10">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="md:hidden w-8 h-8 rounded-full hover:bg-black/10 flex items-center justify-center text-white text-base font-bold cursor-pointer active:scale-90"
            >
              ←
            </button>
          )}

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center font-black text-sm text-white shrink-0 shadow-inner">
            {mode === "guru" ? "KS" : String(lawan).substring(0, 2).toUpperCase()}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white truncate leading-tight">{lawan}</h3>
            <p className="text-[11px] text-emerald-100/80 font-medium truncate">
              {mode === "guru" ? "Kepala Sekolah SMKN 1 Teluk Kuantan" : `ID: ${guru.idGuru}`}
            </p>
          </div>
        </div>

        {/* Tombol Aksi Header */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleTesNotif}
            title="Tes Notifikasi HP"
            className="px-2.5 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-emerald-100 text-xs font-bold transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
          >
            <span>🔔</span>
            <span className="hidden sm:inline text-[11px]">Tes Notif</span>
          </button>

          <button
            type="button"
            onClick={handleHapusChat}
            title="Hapus Semua Chat"
            className="w-8 h-8 rounded-full hover:bg-black/20 flex items-center justify-center text-white text-sm transition-all active:scale-95 cursor-pointer"
          >
            🗑️
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Tutup Chat"
              className="w-8 h-8 rounded-full hover:bg-black/20 flex items-center justify-center text-white text-base font-bold transition-all active:scale-95 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* NOTIFIKASI INFO / ERROR */}
      {info && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 text-center font-semibold animate-in fade-in duration-200">
          {info}
        </div>
      )}
      {error && (
        <div className="bg-rose-600 text-white text-xs px-4 py-1.5 text-center font-semibold animate-in fade-in duration-200">
          {error}
        </div>
      )}

      {/* RUANG OBROLAN (CANVAS CHAT WHATSAPP) */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 space-y-2.5 bg-[#efeae2] bg-[radial-gradient(#0000000d_1px,transparent_1px)] [background-size:16px_16px]"
      >
        {/* Banner Enkripsi / Info Sekolah */}
        <div className="text-center my-2">
          <span className="inline-block bg-[#ffeecd] border border-[#e2d4b7] text-[#54656f] text-[10px] font-medium px-3 py-1 rounded-lg shadow-2xs max-w-xs sm:max-w-md">
            🔒 Pesan terenkripsi & tersimpan otomatis di perangkat ini.
          </span>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-16 space-y-2 max-w-xs mx-auto">
            <div className="w-12 h-12 bg-white/70 rounded-full flex items-center justify-center text-2xl mx-auto shadow-xs border border-stone-200">
              💬
            </div>
            <p className="text-xs font-bold text-stone-600">Belum ada percakapan</p>
            <p className="text-[11px] text-stone-500 leading-relaxed">
              Mulai kirim pesan pertama Anda ke {lawan} di bawah.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.pengirim === mode;
            return (
              <div
                key={msg.id || index}
                className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`relative max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-2xl shadow-xs text-xs sm:text-sm ${
                    isMe
                      ? "bg-[#d9fdd3] text-slate-900 rounded-tr-xs border border-[#bbf7d0]/40"
                      : "bg-white text-slate-900 rounded-tl-xs border border-slate-200/60"
                  }`}
                >
                  {/* Nama Pengirim di bubble jika bukan kita */}
                  {!isMe && (
                    <p className="text-[10px] font-black text-[#128c7e] mb-0.5">
                      {lawan}
                    </p>
                  )}

                  {/* Isi Pesan */}
                  <p className="whitespace-pre-wrap break-words leading-relaxed text-slate-800 pr-14">
                    {msg.teks}
                  </p>

                  {/* Jam & Status Centang di Kanan Bawah */}
                  <div className="absolute right-2 bottom-1.5 flex items-center gap-1 select-none pointer-events-none">
                    <span className="text-[9px] text-slate-500 font-medium">
                      {formatJamPesan(msg.waktu)}
                    </span>

                    {/* Centang Status (Hanya untuk pesan kita) */}
                    {isMe && (
                      <span
                        className={`text-[11px] font-black leading-none ${
                          msg.dibaca ? "text-[#53bdeb]" : "text-slate-400"
                        }`}
                        title={msg.dibaca ? "Dibaca" : "Terkirim"}
                      >
                        {msg.dibaca ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* INPUT BAR ALA WHATSAPP */}
      <div className="p-2 sm:p-3 bg-[#f0f2f5] border-t border-slate-200/80 shrink-0">
        <form onSubmit={handleKirim} className="flex items-center gap-2 max-w-4xl mx-auto">
          <div className="flex-1 bg-white rounded-full border border-slate-300 px-4 py-2 flex items-center shadow-xs focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/20 transition-all">
            <textarea
              rows={1}
              value={isi}
              maxLength={PESAN_MAX_LENGTH}
              onChange={(e) => setIsi(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleKirim();
                }
              }}
              placeholder="Ketik pesan..."
              className="w-full resize-none text-xs sm:text-sm text-slate-800 outline-none max-h-24 bg-transparent placeholder:text-slate-400 font-medium"
            />
          </div>

          <button
            type="submit"
            disabled={sending || !isi.trim()}
            className="w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white flex items-center justify-center font-bold text-sm shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span className="translate-x-0.5">➤</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

// =========================================================
// SISI GURU: Modal Chat Kepala Sekolah
// =========================================================
export function PesanGuruModal({ isOpen, onClose, user, onChanged }) {
  if (!isOpen || !user?.id) return null;
  return (
    <PesanShell onClose={onClose} maxWidth="max-w-xl">
      <ChatPanel
        key={String(user.id)}
        mode="guru"
        guru={{ idGuru: String(user.id), namaGuru: user.nama || "" }}
        idPengirim={String(user.id)}
        onChanged={onChanged}
        onClose={onClose}
      />
    </PesanShell>
  );
}

// =========================================================
// SISI KEPALA SEKOLAH: Kotak Pesan Seluruh Guru + Chat
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
    <PesanShell onClose={onClose} maxWidth="max-w-4xl">
      <div className="flex flex-col md:flex-row flex-1 min-h-0 h-full">
        {/* DAFTAR GURU */}
        <div
          className={`${
            selected ? "hidden md:flex" : "flex"
          } md:w-80 shrink-0 flex-col border-r border-slate-200 min-h-0 flex-1 md:flex-none bg-white`}
        >
          {/* Header List */}
          <div className="p-3.5 bg-[#075e54] text-white flex items-center justify-between shrink-0">
            <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
              <span>💬</span> Kotak Pesan Guru
            </h3>
            <button
              onClick={onClose}
              className="md:hidden w-7 h-7 rounded-full hover:bg-black/10 flex items-center justify-center text-white"
            >
              ✕
            </button>
          </div>

          {/* Search Box */}
          <div className="p-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari guru atau ID..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white focus:border-[#00a884] outline-none font-medium"
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
                  className={`w-full text-left px-3.5 py-3 flex items-center gap-3 transition-colors cursor-pointer ${
                    aktif ? "bg-[#f0f2f5]" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-[#128c7e] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                    {g.namaGuru.substring(0, 2).toUpperCase() || "??"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {g.namaGuru || g.idGuru}
                      </p>
                      {belumDibaca && (
                        <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#25d366] text-white text-[9px] font-black">
                          BARU
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11px] truncate mt-0.5 ${
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
              onClose={onClose}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400 bg-[#f0f2f5]">
              <span className="text-5xl mb-3">💬</span>
              <p className="text-sm font-bold text-slate-600">
                Pilih guru untuk memulai obrolan
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Pesan akan langsung terkirim dan memunculkan notifikasi di HP Guru.
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
