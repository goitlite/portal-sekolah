"use client";

// src/app/magang/components/PesanSekolahModal.js
// Ruang Pesan Kolaborasi Sekolah (WhatsApp Model)
// Mendukung Komunikasi: Siswa <-> Guru (Pembimbing, Mapel, Wali, Wali Kelas) <-> Kepsek
// Disimpan di Supabase Cloud (0 Byte di server Vercel) + Web Push Notification

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  kirimPesanSekolah,
  kirimBroadcastSekolah,
  getPercakapanSekolah,
  getInboxSekolah,
  tandaiPesanDibaca,
  getJumlahPesanUnread,
  hapusSatuPesan,
  hapusPercakapan,
} from "../lib/pesanApi";
import {
  getGuru,
  getSiswa,
  getSiswaByGuru,
  getDataSiswaWali,
  getWaliKelasByGuru,
  getSiswaWaliKelas,
  getSiswaMapel,
  getDashboardKepsekWaliKelas,
  getMapelByGuru,
} from "../lib/api";
import { autoDiscoverMapelForStudent } from "../lib/mapelDiscovery";
import { subscribeToPush } from "@/components/pwa/RegisterSW";

const STORAGE_CHAT_KEY = "portal_pesan_v3_";

// Helper ekstraksi nama guru dari berbagai format properti backend
function ekstrakNamaGuru(g) {
  if (!g) return "";
  if (typeof g === "string") return g.trim();
  return String(
    g.NAMA_GURU ||
    g.namaGuru ||
    g.NAMA ||
    g.nama ||
    g["Nama Guru"] ||
    g["nama_guru"] ||
    g.nama_lengkap ||
    ""
  ).trim();
}

function ekstrakIdGuru(g) {
  if (!g) return "";
  if (typeof g === "string" || typeof g === "number") return String(g).trim();
  return String(
    g.ID_GURU ||
    g.idGuru ||
    g.ID ||
    g.id ||
    g["ID Guru"] ||
    g["id_guru"] ||
    ""
  ).trim();
}

// Format Jam (WIB)
function formatJam(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

// Format Tanggal Singkat
function formatTanggalSingkat(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const selisihHari = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (selisihHari === 0) return formatJam(isoStr);
    if (selisihHari === 1) return "Kemarin";
    return d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

// =========================================================
// HOOK: JUMLAH PESAN BARU (Untuk Badge di Header)
// =========================================================
export function useJumlahPesanSekolah({ userId, enabled = true, intervalMs = 20000 }) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled || !userId) return;
    try {
      const count = await getJumlahPesanUnread(userId);
      setUnreadCount(count);
    } catch {}
  }, [enabled, userId]);

  useEffect(() => {
    if (!enabled || !userId) return;
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, intervalMs);
    const onVisChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisChange);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisChange);
    };
  }, [enabled, userId, intervalMs, refresh]);

  return [unreadCount, refresh];
}

// =========================================================
// KOMPONEN UTAMA MODAL PESAN
// =========================================================
export default function PesanSekolahModal({
  isOpen,
  onClose,
  currentUser, // { id, nama, role: 'siswa'|'guru'|'kepsek', subrole?: 'pembimbing'|'mapel'|'wali'|'walikelas' }
  initialTarget = null, // { id, nama, role } jika ingin langsung membuka kontak tertentu
}) {
  const [activePartner, setActivePartner] = useState(null);
  const [inboxList, setInboxList] = useState([]);
  const [contactList, setContactList] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [activeTabFilter, setActiveTabFilter] = useState("inbox"); // "inbox" | "guru" | "siswa"
  const [searchQuery, setSearchQuery] = useState("");

  // Percakapan aktif
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);
  const [inputPesan, setInputPesan] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Broadcast mode untuk Kepala Sekolah
  const [isBroadcastMode, setIsBroadcastMode] = useState(false);
  const [broadcastPesan, setBroadcastPesan] = useState("");
  const [broadcastModePenerima, setBroadcastModePenerima] = useState("semua"); // "semua" | "pilih"
  const [broadcastSelectedIds, setBroadcastSelectedIds] = useState(() => new Set());
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastStatus, setBroadcastStatus] = useState({ tipe: "", teks: "" });

  // Broadcast mode untuk Guru
  const [isGuruBroadcastMode, setIsGuruBroadcastMode] = useState(false);
  // Tipe: "pkl" | "wali" | "walikelas_{idWali}" | "mapel_{idMapel}"
  const [guruBroadcastTipe, setGuruBroadcastTipe] = useState(null);
  const [guruBroadcastPesan, setGuruBroadcastPesan] = useState("");
  const [guruBroadcastSending, setGuruBroadcastSending] = useState(false);
  const [guruBroadcastStatus, setGuruBroadcastStatus] = useState({ tipe: "", teks: "" });
  const [guruBroadcastTargets, setGuruBroadcastTargets] = useState([]); // [{ id, nama }]
  const [guruBroadcastLoading, setGuruBroadcastLoading] = useState(false);
  // Data profil tugas guru
  const [guruTugasInfo, setGuruTugasInfo] = useState(null);
  // { hasPKL: bool, hasWali: bool, daftarMapel: [], daftarWaliKelas: [] }

  const chatBottomRef = useRef(null);

  const myId = String(currentUser?.id || currentUser?.idGuru || currentUser?.nisn || "").trim();
  const myNama = String(currentUser?.nama || currentUser?.namaGuru || currentUser?.namaSiswa || "Saya").trim();
  const myRole = String(currentUser?.role || "guru").trim().toLowerCase();

  // Scroll otomatis ke paling bawah
  const scrollToBottom = (smooth = true) => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  };

  // Muat Kontak Master (Guru & Siswa)
  const muatDaftarKontak = useCallback(async () => {
    if (contactList.length > 0) return;
    setLoadingContacts(true);
    try {
      const hasil = [];
      const idSudahAda = new Set();

      // ========================================================
      // 1. JIKA PENGGUNA ADALAH SISWA:
      // Siswa HANYA boleh chat dengan:
      // - Guru Wali Kelas (yang terdaftar di kelas siswa)
      // - Guru Wali (yang terdaftar di akun siswa)
      // - Guru Mapel (yang mengajar di kelas siswa)
      // - Guru Pembimbing PKL (jika siswa terdaftar magang)
      // ========================================================
      if (myRole === "siswa") {
        const rawNama = String(currentUser?.nama || "").trim();
        const matchKelas = rawNama.match(/\[(.*?)\]/);
        const kelasSiswa = matchKelas ? matchKelas[1].trim().toLowerCase() : "";

        // A. Guru Pembimbing PKL (dari session akun siswa)
        const pId = String(currentUser?.idGuru || currentUser?.guruPembimbing?.id || "").trim();
        const pNama = String(currentUser?.namaGuru || currentUser?.guruPembimbing?.nama || "").trim();
        if (pNama && pNama !== "-" && pNama !== "Tanpa Pembimbing") {
          const finalId = pId || "pembimbing_" + pNama;
          hasil.push({
            id: finalId,
            nama: pNama,
            role: "guru",
            subLabel: "Guru Pembimbing PKL",
            avatarColor: "from-blue-600 to-indigo-600",
          });
          idSudahAda.add(finalId);
        }

        // B. Guru Wali (dari session / props currentUser)
        const wNama = String(currentUser?.guruWali?.nama || "").trim();
        const wId = String(currentUser?.guruWali?.id || "").trim();
        if (wNama && wNama !== "-" && wNama !== "Tanpa Guru Wali") {
          const finalId = wId || "wali_" + wNama;
          if (!idSudahAda.has(finalId)) {
            hasil.push({
              id: finalId,
              nama: wNama,
              role: "guru",
              subLabel: "Guru Wali",
              avatarColor: "from-indigo-600 to-violet-600",
            });
            idSudahAda.add(finalId);
          }
        }

        // C. Guru Wali Kelas (dari props / query getDashboardKepsekWaliKelas)
        let wkNama = String(currentUser?.waliKelas?.nama || "").trim();
        let wkId = String(currentUser?.waliKelas?.id || "").trim();
        let wkKelas = String(currentUser?.waliKelas?.kelas || "").trim();

        if (!wkNama) {
          try {
            const resWaliKelas = await getDashboardKepsekWaliKelas(false);
            if (resWaliKelas?.success && Array.isArray(resWaliKelas.data?.cards)) {
              const myCard = resWaliKelas.data.cards.find((c) => {
                const cKelas = String(c.namaKelas || "").trim().toLowerCase();
                if (kelasSiswa && cKelas && (cKelas.includes(kelasSiswa) || kelasSiswa.includes(cKelas))) {
                  return true;
                }
                if (Array.isArray(c.daftarSiswa) && c.daftarSiswa.some((s) => String(s.idSiswa || s.id || s.nisn) === myId)) {
                  return true;
                }
                return false;
              });
              if (myCard && myCard.namaGuru) {
                wkNama = myCard.namaGuru;
                wkId = String(myCard.idGuru || "").trim();
                wkKelas = myCard.namaKelas || "";
              }
            }
          } catch (e) {}
        }

        if (wkNama && wkNama !== "-") {
          const finalId = wkId || "walikelas_" + wkNama;
          if (!idSudahAda.has(finalId)) {
            hasil.push({
              id: finalId,
              nama: wkNama,
              role: "guru",
              subLabel: `Guru Wali Kelas ${wkKelas || ""}`.trim(),
              avatarColor: "from-sky-600 to-blue-700",
            });
            idSudahAda.add(finalId);
          }
        }

        // D. Guru Mapel yang mengajar di kelas siswa (Auto-discovery otomatis)
        try {
          const mapels = await autoDiscoverMapelForStudent(currentUser);
          const mapelDaftarUnik = new Set();
          if (Array.isArray(mapels)) {
            mapels.forEach((m) => {
              const gid = String(m.idGuru || "").trim();
              const gnama = String(m.namaGuru || "").trim();
              const nMapel = String(m.namaMapel || "Pelajaran").trim();
              const keyMapel = `${gid}_${nMapel.toLowerCase()}`;
              if (gid && gnama && gnama !== "Guru Mapel" && !mapelDaftarUnik.has(keyMapel)) {
                mapelDaftarUnik.add(keyMapel);
                hasil.push({
                  id: gid,
                  nama: gnama,
                  role: "guru",
                  subLabel: `Guru Mapel: ${nMapel}`,
                  avatarColor: "from-teal-600 to-emerald-600",
                  kategori: "mapel",
                });
              }
            });
          }
        } catch (e) {
          console.error("Error muat mapel siswa:", e);
        }

        // Cocokkan ID guru dari master guru jika ID masih berstatus temporary nama
        try {
          const resSemuaGuru = await getGuru();
          if (resSemuaGuru?.success && Array.isArray(resSemuaGuru.data)) {
            hasil.forEach((h) => {
              if (h.id.startsWith("wali_") || h.id.startsWith("pembimbing_") || h.id.startsWith("walikelas_")) {
                const cocok = resSemuaGuru.data.find(
                  (g) => ekstrakNamaGuru(g).toLowerCase() === h.nama.toLowerCase()
                );
                if (cocok) {
                  h.id = ekstrakIdGuru(cocok);
                }
              }
            });
          }
        } catch (e) {}

        setContactList(hasil);
        return;
      }

      // ========================================================
      // 2. JIKA PENGGUNA ADALAH GURU ATAU KEPALA SEKOLAH:
      // ========================================================

      // A. Kepala Sekolah (Hanya untuk Guru, TIDAK untuk Kepsek dan TIDAK untuk Siswa)
      if (myRole === "guru") {
        hasil.push({
          id: "202026",
          nama: "HURDISMAN, S.Pd",
          role: "kepsek",
          subLabel: "Kepala Sekolah",
          avatarColor: "from-amber-500 to-yellow-600",
        });
        idSudahAda.add("202026");
      }

      // B. Seluruh Guru Sekolah (Untuk Guru & Kepsek)
      try {
        const resGuru = await getGuru();
        if (resGuru?.success && Array.isArray(resGuru.data)) {
          resGuru.data.forEach((g) => {
            const gid = ekstrakIdGuru(g);
            const gnama = ekstrakNamaGuru(g);
            if (gid && gid !== myId && !idSudahAda.has(gid)) {
              hasil.push({
                id: gid,
                nama: gnama || `Guru (${gid})`,
                role: "guru",
                subLabel: "Guru",
                avatarColor: "from-blue-600 to-indigo-600",
              });
              idSudahAda.add(gid);
            }
          });
        }
      } catch (e) {}

      // C. Seluruh Siswa (HANYA untuk Guru. Kepsek TIDAK melihat Siswa)
      if (myRole === "guru") {
        try {
          const resSiswa = await getSiswa();
          if (resSiswa?.success && Array.isArray(resSiswa.data)) {
            resSiswa.data.forEach((s) => {
              const sid = String(s.ID || s.id || s.nisn || s.NISN || "").trim();
              const rawNama = String(s.NAMA || s.nama || "").trim();
              const matchKelas = rawNama.match(/(.+?)\s*\[(.*?)\]/);
              let snama = rawNama;
              let skelas = String(s.kelas || s.KELAS || "").trim();
              if (matchKelas) {
                snama = matchKelas[1].trim();
                if (!skelas) skelas = matchKelas[2].trim();
              }

              if (sid && !idSudahAda.has(sid)) {
                hasil.push({
                  id: sid,
                  nama: snama || `Siswa (${sid})`,
                  role: "siswa",
                  subLabel: skelas ? `Siswa Kelas ${skelas}` : "Siswa",
                  avatarColor: "from-emerald-500 to-teal-600",
                });
                idSudahAda.add(sid);
              }
            });
          }
        } catch (e) {}
      }

      setContactList(hasil);
    } catch (err) {
      console.error("[Pesan] Gagal muat kontak:", err);
    } finally {
      setLoadingContacts(false);
    }
  }, [contactList.length, myId, myRole, currentUser]);

  // Muat Daftar Inbox Percakapan
  const muatInbox = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await getInboxSekolah(myId);
      if (res?.ok && Array.isArray(res.data)) {
        setInboxList(res.data);
      }
    } catch {}
  }, [myId]);

  // Inisialisasi saat modal terbuka
  // Muat profil tugas guru (PKL, Wali, Wali Kelas, Mapel) untuk fitur broadcast
  const muatTugasGuru = useCallback(async () => {
    if (myRole !== "guru" || !myId || guruTugasInfo) return;
    try {
      const [resMapel, resSiswaWali, resWaliKelas] = await Promise.allSettled([
        getMapelByGuru(myId),
        getDataSiswaWali(myId),
        getWaliKelasByGuru(myId),
      ]);

      const daftarMapel = [];
      if (resMapel.status === "fulfilled" && resMapel.value?.success) {
        const rawMapel = resMapel.value.data || resMapel.value.mapel || resMapel.value;
        if (Array.isArray(rawMapel)) {
          rawMapel.forEach((m) => {
            const idMapel = String(m.idMapel || m.ID_MAPEL || m.id || "").trim();
            const namaMapel = String(m.namaMapel || m.NAMA_MAPEL || m.nama || "Mapel").trim();
            if (idMapel) daftarMapel.push({ idMapel, namaMapel });
          });
        }
      }

      const daftarWaliKelas = [];
      if (resWaliKelas.status === "fulfilled" && resWaliKelas.value?.success) {
        const rawWK = resWaliKelas.value.data || resWaliKelas.value.waliKelas || resWaliKelas.value;
        if (Array.isArray(rawWK)) {
          rawWK.forEach((wk) => {
            const idWali = String(wk.idWali || wk.ID_WALI || wk.id || "").trim();
            const namaKelas = String(wk.namaKelas || wk.NAMA_KELAS || wk.kelas || "Kelas").trim();
            if (idWali) daftarWaliKelas.push({ idWali, namaKelas });
          });
        }
      }

      const siswaWaliList = [];
      if (resSiswaWali.status === "fulfilled" && resSiswaWali.value?.success) {
        const rawWali = resSiswaWali.value.data || resSiswaWali.value.siswa || resSiswaWali.value;
        if (Array.isArray(rawWali)) {
          rawWali.forEach((s) => {
            const sid = String(s.idSiswa || s.ID_SISWA || s.id || s.NISN || "").trim();
            if (sid) siswaWaliList.push(sid);
          });
        }
      }

      // Cek apakah guru bertugas sebagai guru PKL (ada siswa magang bimbingannya)
      let hasPKL = false;
      try {
        const resPKL = await getSiswaByGuru(myId);
        hasPKL = resPKL?.success && Array.isArray(resPKL.data) && resPKL.data.length > 0;
      } catch {}

      setGuruTugasInfo({
        hasPKL,
        hasWali: siswaWaliList.length > 0,
        daftarMapel,
        daftarWaliKelas,
      });
    } catch (err) {
      console.error("[Pesan] Gagal muat info tugas guru:", err);
    }
  }, [myRole, myId, guruTugasInfo]);

  useEffect(() => {
    if (isOpen && myId) {
      muatInbox();
      muatDaftarKontak();
      if (myRole === "guru") muatTugasGuru();

      if (initialTarget && initialTarget.id) {
        setActivePartner({
          id: String(initialTarget.id).trim(),
          nama: initialTarget.nama || "Rekan",
          role: initialTarget.role || "guru",
          subLabel: initialTarget.subLabel || "",
        });
      }

      // Auto re-subscribe Web Push agar notifikasi tetap aktif
      // (subscription bisa expired jika browser lama tidak dibuka)
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            subscribeToPush(reg, { userId: myId, role: myRole }).catch(() => {});
          })
          .catch(() => {});
      }
    }
  }, [isOpen, myId, initialTarget, muatInbox, muatDaftarKontak, muatTugasGuru, myRole]);

  // Muat Riwayat Chat saat activePartner berganti
  const muatPercakapan = useCallback(
    async (silent = false) => {
      if (!myId || !activePartner?.id) return;
      if (!silent) setLoadingChat(true);

      try {
        // Baca cache lokal lebih dulu agar instan
        if (!silent) {
          try {
            const cached = localStorage.getItem(STORAGE_CHAT_KEY + activePartner.id);
            if (cached) setMessages(JSON.parse(cached));
          } catch {}
        }

        const res = await getPercakapanSekolah(myId, activePartner.id);
        if (res?.ok && Array.isArray(res.data)) {
          setMessages(res.data);
          try {
            localStorage.setItem(STORAGE_CHAT_KEY + activePartner.id, JSON.stringify(res.data));
          } catch {}

          // Tandai sudah dibaca di server
          tandaiPesanDibaca(myId, activePartner.id);
        }
      } catch (err) {
        console.error("[Pesan] Gagal muat percakapan:", err);
      } finally {
        if (!silent) setLoadingChat(false);
      }
    },
    [myId, activePartner?.id],
  );

  useEffect(() => {
    if (activePartner?.id) {
      muatPercakapan(false);
      const timer = setInterval(() => {
        if (document.visibilityState === "visible") {
          muatPercakapan(true);
        }
      }, 4000);
      return () => clearInterval(timer);
    }
  }, [activePartner?.id, muatPercakapan]);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  // Hapus seluruh obrolan per nama (thread percakapan)
  const handleHapusPercakapan = async (partnerId, partnerNama) => {
    if (!myId || !partnerId) return;
    const konfirmasi = window.confirm(
      `Hapus seluruh riwayat obrolan dengan ${partnerNama || "kontak ini"}?\n\nPesan yang dihapus akan dibersihkan secara permanen.`
    );
    if (!konfirmasi) return;

    try {
      // Optimistic update daftar inbox
      setInboxList((prev) =>
        prev.filter((item) => String(item.lawanId).trim() !== String(partnerId).trim())
      );

      // Jika chat ini yang sedang aktif dibuka, bersihkan pesan di layar
      if (activePartner && String(activePartner.id).trim() === String(partnerId).trim()) {
        setMessages([]);
        try {
          localStorage.removeItem(STORAGE_CHAT_KEY + partnerId);
        } catch {}
      }

      const res = await hapusPercakapan(myId, partnerId);
      if (!res?.ok) {
        alert(res?.error || "Gagal menghapus obrolan.");
        muatInbox();
      } else {
        muatInbox();
      }
    } catch (err) {
      console.error("[Pesan] Gagal hapus percakapan:", err);
      alert("Terjadi kendala saat menghapus percakapan.");
      muatInbox();
    }
  };

  // Hapus satu pesan dalam isi obrolan
  const handleHapusSatuPesan = async (messageId) => {
    if (!messageId) return;
    const konfirmasi = window.confirm("Hapus pesan ini?");
    if (!konfirmasi) return;

    try {
      // Optimistic update pesan di layar
      setMessages((prev) => prev.filter((m) => m.id !== messageId));

      const res = await hapusSatuPesan(messageId);
      if (!res?.ok) {
        alert(res?.error || "Gagal menghapus pesan.");
        muatPercakapan(false);
      } else {
        muatInbox();
      }
    } catch (err) {
      console.error("[Pesan] Gagal hapus pesan:", err);
      alert("Terjadi kendala saat menghapus pesan.");
      muatPercakapan(false);
    }
  };

  // Kirim Pesan
  const handleKirim = async (e) => {
    e?.preventDefault();
    if (!inputPesan.trim() || !activePartner || sending) return;

    const teksKirim = inputPesan.trim();
    setInputPesan("");
    setSending(true);
    setErrorMsg("");

    // Optimistic Update: pesan langsung tampil di layar
    const tempPesan = {
      id: "temp_" + Date.now(),
      id_pengirim: myId,
      nama_pengirim: myNama,
      role_pengirim: myRole,
      id_penerima: activePartner.id,
      nama_penerima: activePartner.nama,
      role_penerima: activePartner.role,
      pesan: teksKirim,
      dibaca: false,
      created_at: new Date().toISOString(),
      isTemp: true,
    };

    setMessages((prev) => [...prev, tempPesan]);
    scrollToBottom(true);

    try {
      const res = await kirimPesanSekolah({
        idPengirim: myId,
        namaPengirim: myNama,
        rolePengirim: myRole,
        subrolePengirim: currentUser?.subrole || "",
        idPenerima: activePartner.id,
        namaPenerima: activePartner.nama,
        rolePenerima: activePartner.role,
        pesan: teksKirim,
      });

      if (res?.ok && res.data) {
        // Ganti pesan temporary dengan pesan resmi dari Supabase
        setMessages((prev) =>
          prev.map((m) => (m.id === tempPesan.id ? res.data : m)),
        );
        muatInbox();
      } else {
        setErrorMsg(res?.error || "Pesan gagal terkirim.");
      }
    } catch (err) {
      setErrorMsg("Koneksi internet bermasalah.");
    } finally {
      setSending(false);
    }
  };

  // Daftar guru target untuk siaran massal (Broadcast Kepsek)
  const daftarGuruUntukBroadcast = useMemo(() => {
    return contactList.filter((c) => c.role === "guru" && c.id !== myId);
  }, [contactList, myId]);

  const toggleSelectBroadcastGuru = (id) => {
    setBroadcastSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllBroadcastGuru = () => {
    setBroadcastSelectedIds(new Set(daftarGuruUntukBroadcast.map((g) => g.id)));
  };

  const handleClearAllBroadcastGuru = () => {
    setBroadcastSelectedIds(new Set());
  };

  const handleKirimBroadcast = async (e) => {
    if (e) e.preventDefault();
    setBroadcastStatus({ tipe: "", teks: "" });
    const cleanTeks = broadcastPesan.trim();
    if (!cleanTeks) {
      setBroadcastStatus({ tipe: "error", teks: "Pesan broadcast tidak boleh kosong." });
      return;
    }

    let targets = [];
    if (broadcastModePenerima === "semua") {
      targets = daftarGuruUntukBroadcast.map((g) => ({ id: g.id, nama: g.nama }));
    } else {
      targets = daftarGuruUntukBroadcast
        .filter((g) => broadcastSelectedIds.has(g.id))
        .map((g) => ({ id: g.id, nama: g.nama }));
    }

    if (targets.length === 0) {
      setBroadcastStatus({
        tipe: "error",
        teks: "Pilih minimal 1 guru penerima pesan broadcast.",
      });
      return;
    }

    const konfirmasi = window.confirm(
      `Kirim pesan broadcast ke ${targets.length} guru sekarang?\n\nPesan akan langsung masuk ke obrolan masing-masing guru dan mengirimkan notifikasi push.`
    );
    if (!konfirmasi) return;

    setBroadcastSending(true);
    setBroadcastStatus({
      tipe: "info",
      teks: "Sedang menyiarkan pesan ke seluruh guru...",
    });

    try {
      const res = await kirimBroadcastSekolah({
        idPengirim: myId,
        namaPengirim: myNama || "HURDISMAN, S.Pd",
        rolePengirim: "kepsek",
        pesan: cleanTeks,
        targetList: targets,
      });

      if (res?.success) {
        setBroadcastStatus({
          tipe: "success",
          teks: `✅ Pesan broadcast berhasil disiarkan ke ${res.terkirim || targets.length} guru!`,
        });
        setBroadcastPesan("");
        setBroadcastSelectedIds(new Set());
        muatInbox();
      } else {
        setBroadcastStatus({
          tipe: "error",
          teks: res?.error || "Gagal menyiarkan pesan broadcast.",
        });
      }
    } catch (err) {
      setBroadcastStatus({
        tipe: "error",
        teks: "Gagal terhubung ke server saat menyiarkan broadcast.",
      });
    } finally {
      setBroadcastSending(false);
    }
  };

  // ─── BROADCAST GURU ────────────────────────────────────────────────────────
  // Muat daftar penerima berdasarkan tipe broadcast yang dipilih guru
  const handleGuruBroadcastPilihTipe = async (tipe) => {
    setGuruBroadcastTipe(tipe);
    setGuruBroadcastTargets([]);
    setGuruBroadcastStatus({ tipe: "", teks: "" });
    setGuruBroadcastPesan("");
    setGuruBroadcastLoading(true);

    try {
      let targets = [];

      if (tipe === "pkl") {
        // Broadcast ke siswa PKL bimbingan guru ini
        // getSiswaByGuru mengembalikan field ID (uppercase) dan NAMA (uppercase)
        const res = await getSiswaByGuru(myId);
        if (res?.success && Array.isArray(res.data)) {
          res.data.forEach((s) => {
            const sid = String(s.idSiswa || s.ID_SISWA || s.id || s.ID || s.NISN || s.nisn || "").trim();
            const rawNama = String(s.namaSiswa || s.NAMA_SISWA || s.nama || s.NAMA || "").trim();
            // Nama siswa mungkin mengandung [kelas] — strip bracket
            const snama = rawNama.replace(/\s*\[.*?\]\s*$/, "").trim() || rawNama;
            if (sid && snama) targets.push({ id: sid, nama: snama });
          });
        }
      } else if (tipe === "wali") {
        // Broadcast ke siswa binaan Guru Wali
        const res = await getDataSiswaWali(myId);
        const rawWali = Array.isArray(res?.data) ? res.data : Array.isArray(res?.siswa) ? res.siswa : [];
        rawWali.forEach((s) => {
          const sid = String(s.idSiswa || s.ID_SISWA || s.id || s.ID || s.NISN || s.nisn || "").trim();
          const rawNama = String(s.namaSiswa || s.NAMA_SISWA || s.nama || s.NAMA || "").trim();
          const snama = rawNama.replace(/\s*\[.*?\]\s*$/, "").trim() || rawNama;
          if (sid && snama) targets.push({ id: sid, nama: snama });
        });
      } else if (tipe.startsWith("walikelas_")) {
        // Broadcast ke siswa di kelas wali tertentu
        const idWali = tipe.replace("walikelas_", "");
        const res = await getSiswaWaliKelas(myId, idWali);
        const rawSiswa = Array.isArray(res?.data) ? res.data : Array.isArray(res?.siswa) ? res.siswa : [];
        rawSiswa.forEach((s) => {
          const sid = String(s.idSiswa || s.ID_SISWA || s.id || s.ID || s.NISN || s.nisn || "").trim();
          const rawNama = String(s.namaSiswa || s.NAMA_SISWA || s.nama || s.NAMA || "").trim();
          const snama = rawNama.replace(/\s*\[.*?\]\s*$/, "").trim() || rawNama;
          if (sid && snama) targets.push({ id: sid, nama: snama });
        });
      } else if (tipe.startsWith("mapel_")) {
        // Broadcast ke siswa peserta mapel tertentu
        const idMapel = tipe.replace("mapel_", "");
        const res = await getSiswaMapel(myId, idMapel);
        const rawSiswa = Array.isArray(res?.data) ? res.data : Array.isArray(res?.siswa) ? res.siswa : [];
        rawSiswa.forEach((s) => {
          const sid = String(s.idSiswa || s.ID_SISWA || s.id || s.ID || s.NISN || s.nisn || "").trim();
          const rawNama = String(s.namaSiswa || s.NAMA_SISWA || s.nama || s.NAMA || "").trim();
          const snama = rawNama.replace(/\s*\[.*?\]\s*$/, "").trim() || rawNama;
          if (sid && snama) targets.push({ id: sid, nama: snama });
        });
      }

      // Deduplikasi
      const seen = new Set();
      targets = targets.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      setGuruBroadcastTargets(targets);
      if (targets.length === 0) {
        setGuruBroadcastStatus({ tipe: "info", teks: "Tidak ada siswa terdaftar untuk kategori ini." });
      }
    } catch (err) {
      console.error("[Pesan] Gagal muat target broadcast guru:", err);
      setGuruBroadcastStatus({ tipe: "error", teks: "Gagal memuat daftar penerima." });
    } finally {
      setGuruBroadcastLoading(false);
    }
  };

  const handleKirimGuruBroadcast = async () => {
    setGuruBroadcastStatus({ tipe: "", teks: "" });
    const cleanTeks = guruBroadcastPesan.trim();
    if (!cleanTeks) {
      setGuruBroadcastStatus({ tipe: "error", teks: "Pesan broadcast tidak boleh kosong." });
      return;
    }
    if (guruBroadcastTargets.length === 0) {
      setGuruBroadcastStatus({ tipe: "error", teks: "Tidak ada penerima untuk broadcast ini." });
      return;
    }

    const konfirmasi = window.confirm(
      `Kirim pesan broadcast ke ${guruBroadcastTargets.length} siswa sekarang?\n\nPesan akan langsung masuk ke obrolan masing-masing siswa.`
    );
    if (!konfirmasi) return;

    setGuruBroadcastSending(true);
    setGuruBroadcastStatus({ tipe: "info", teks: "Sedang menyiarkan pesan ke siswa..." });

    try {
      const res = await kirimBroadcastSekolah({
        idPengirim: myId,
        namaPengirim: myNama,
        rolePengirim: "guru",
        pesan: cleanTeks,
        targetList: guruBroadcastTargets,
      });

      if (res?.success) {
        setGuruBroadcastStatus({
          tipe: "success",
          teks: `✅ Pesan berhasil dikirim ke ${res.terkirim || guruBroadcastTargets.length} siswa!`,
        });
        setGuruBroadcastPesan("");
        muatInbox();
      } else {
        setGuruBroadcastStatus({
          tipe: "error",
          teks: res?.error || "Gagal menyiarkan pesan broadcast.",
        });
      }
    } catch {
      setGuruBroadcastStatus({ tipe: "error", teks: "Gagal terhubung ke server." });
    } finally {
      setGuruBroadcastSending(false);
    }
  };

  // Filter daftar kontak / inbox
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    if (activeTabFilter === "inbox") {
      if (!q) return inboxList;
      return inboxList.filter(
        (item) =>
          item.lawanNama?.toLowerCase().includes(q) ||
          item.pesanTerakhir?.toLowerCase().includes(q),
      );
    }

    let sumber = contactList;
    if (activeTabFilter === "guru") {
      sumber = contactList.filter((c) => c.role === "guru" || c.role === "kepsek");
    } else if (activeTabFilter === "siswa") {
      sumber = contactList.filter((c) => c.role === "siswa");
    }

    if (!q) return sumber;
    return sumber.filter(
      (c) =>
        c.nama?.toLowerCase().includes(q) ||
        c.subLabel?.toLowerCase().includes(q),
    );
  }, [activeTabFilter, inboxList, contactList, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl h-[92vh] max-h-[850px] flex flex-col overflow-hidden border border-slate-200/80">
        
        {/* ========================================================= */}
        {/* HEADER MODAL */}
        {/* ========================================================= */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-600 px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between text-white shrink-0 shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-lg shadow-inner">
              💬
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight leading-tight">
                Pusat Pesan & Informasi Sekolah
              </h2>
              <p className="text-[10px] sm:text-xs text-blue-200 font-medium">
                {myRole === "siswa"
                  ? "Konsultasi & Informasi Siswa dengan Guru"
                  : myRole === "kepsek"
                  ? "Koordinasi Kepala Sekolah dengan Dewan Guru"
                  : "Komunikasi Guru, Siswa & Kepala Sekolah"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Tombol Tes Notif — daftarkan ulang push subscription */}
            <button
              type="button"
              title="Aktifkan / Tes Notifikasi HP"
              onClick={async () => {
                if (!("Notification" in window) || !("serviceWorker" in navigator)) {
                  alert("Browser Anda tidak mendukung notifikasi push.");
                  return;
                }
                try {
                  let perm = Notification.permission;
                  if (perm === "denied") {
                    alert("⛔ Izin notifikasi DIBLOKIR.\n\nSilakan buka:\nPengaturan HP → Aplikasi → Chrome/Browser → Notifikasi → Izinkan.");
                    return;
                  }
                  if (perm === "default") {
                    perm = await Notification.requestPermission();
                  }
                  if (perm !== "granted") {
                    alert("Izin notifikasi belum diberikan (" + perm + ").");
                    return;
                  }
                  const reg = await navigator.serviceWorker.ready;
                  await subscribeToPush(reg, { userId: myId, role: myRole });
                  await reg.showNotification("🔔 Notifikasi Aktif!", {
                    body: "Notifikasi pesan sekolah sudah terdaftar dan aktif di HP ini.",
                    icon: "/logo.png",
                    badge: "/logo.png",
                  });
                } catch (err) {
                  alert("Gagal mengaktifkan notifikasi: " + err.message);
                }
              }}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/25 active:scale-95 flex items-center justify-center text-white/90 transition-all text-sm"
            >
              🔔
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-white/90 font-bold transition-all"
              title="Tutup Modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* BODY (2 PANEL: KONTAK & CHAT) */}
        {/* ========================================================= */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* ---------------- PANEL KIRI: DAFTAR KONTAK / INBOX ---------------- */}
          <div
            className={`w-full md:w-80 lg:w-96 border-r border-slate-200 flex flex-col bg-slate-50/70 shrink-0 ${
              activePartner || isBroadcastMode || isGuruBroadcastMode ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Search & Tabs */}
            <div className="p-3 border-b border-slate-200/80 bg-white shrink-0 space-y-2.5">
              {myRole === "kepsek" && (
                <button
                  type="button"
                  onClick={() => {
                    setIsBroadcastMode(true);
                    setIsGuruBroadcastMode(false);
                    setActivePartner(null);
                    setBroadcastStatus({ tipe: "", teks: "" });
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-between shadow-xs cursor-pointer ${
                    isBroadcastMode
                      ? "bg-gradient-to-r from-amber-500 to-yellow-600 text-white shadow-amber-500/20 ring-2 ring-amber-400"
                      : "bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-300 text-amber-950 hover:bg-amber-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📢</span>
                    <span>Broadcast Pesan ke Guru</span>
                  </div>
                  <span className="text-[10px] bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-full font-bold">
                    Massal
                  </span>
                </button>
              )}

              {/* Tombol Broadcast Guru — muncul hanya jika guru memiliki tugas */}
              {myRole === "guru" && guruTugasInfo &&
                (guruTugasInfo.hasPKL || guruTugasInfo.hasWali ||
                  guruTugasInfo.daftarMapel.length > 0 ||
                  guruTugasInfo.daftarWaliKelas.length > 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsGuruBroadcastMode(true);
                    setIsBroadcastMode(false);
                    setActivePartner(null);
                    setGuruBroadcastTipe(null);
                    setGuruBroadcastTargets([]);
                    setGuruBroadcastStatus({ tipe: "", teks: "" });
                    setGuruBroadcastPesan("");
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition-all flex items-center justify-between shadow-xs cursor-pointer ${
                    isGuruBroadcastMode
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-emerald-500/20 ring-2 ring-emerald-400"
                      : "bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 text-emerald-950 hover:bg-emerald-100"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📣</span>
                    <span>Broadcast Pesan ke Siswa</span>
                  </div>
                  <span className="text-[10px] bg-emerald-200/90 text-emerald-950 px-2 py-0.5 rounded-full font-bold">
                    Massal
                  </span>
                </button>
              )}

              <div className="relative">
                <input
                  type="text"
                  placeholder={
                    myRole === "siswa"
                      ? "Cari nama guru..."
                      : myRole === "kepsek"
                      ? "Cari nama guru..."
                      : "Cari nama guru atau siswa..."
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-100/80 rounded-xl px-3.5 py-2 pl-9 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 border border-slate-200"
                />
                <span className="absolute left-3 top-2.5 text-xs text-slate-400">
                  🔍
                </span>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Tab Filter */}
              <div className="flex gap-1 p-1 bg-slate-100 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTabFilter("inbox")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    activeTabFilter === "inbox"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Obrolan
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTabFilter("guru")}
                  className={`flex-1 py-1.5 rounded-lg transition-all ${
                    activeTabFilter === "guru"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {myRole === "siswa"
                    ? "Guru Saya"
                    : myRole === "guru"
                    ? "Guru & Kepsek"
                    : "Daftar Guru"}
                </button>
                {myRole === "guru" && (
                  <button
                    type="button"
                    onClick={() => setActiveTabFilter("siswa")}
                    className={`flex-1 py-1.5 rounded-lg transition-all ${
                      activeTabFilter === "siswa"
                        ? "bg-white text-blue-700 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Siswa
                  </button>
                )}
              </div>
            </div>

            {/* List Kontak / Inbox */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {loadingContacts && filteredList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 animate-pulse">
                  Memuat daftar kontak...
                </div>
              ) : filteredList.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  {activeTabFilter === "inbox"
                    ? "Belum ada riwayat obrolan. Silakan pilih tab Guru atau Siswa untuk memulai chat baru."
                    : "Kontak tidak ditemukan."}
                </div>
              ) : (
                filteredList.map((item, idx) => {
                  const isInboxItem = activeTabFilter === "inbox";
                  const targetId = isInboxItem ? item.lawanId : item.id;
                  const targetNama = isInboxItem ? item.lawanNama : item.nama;
                  const targetRole = isInboxItem ? item.lawanRole : item.role;
                  const isSelected = activePartner?.id === targetId;
                  const itemUniqueKey = isInboxItem
                    ? `inbox_${item.lawanId}_${idx}`
                    : `kontak_${item.id}_${item.subLabel || ""}_${idx}`;

                  return (
                    <div
                      key={itemUniqueKey}
                      className={`group w-full p-2.5 sm:p-3 flex items-center justify-between gap-2 transition-colors ${
                        isSelected
                          ? "bg-blue-50/90 border-l-4 border-blue-600"
                          : "hover:bg-white bg-transparent"
                      }`}
                    >
                      {/* Area Klik untuk Buka Obrolan */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsBroadcastMode(false);
                          setActivePartner({
                            id: targetId,
                            nama: targetNama,
                            role: targetRole,
                            subLabel: item.subLabel || "",
                          });
                        }}
                        className="flex-1 min-w-0 flex items-center gap-3 text-left"
                      >
                        {/* Avatar */}
                        <div
                          className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${
                            targetRole === "kepsek"
                              ? "from-amber-500 to-yellow-600"
                              : targetRole === "siswa"
                              ? "from-emerald-500 to-teal-600"
                              : "from-blue-600 to-indigo-600"
                          } text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs`}
                        >
                          {targetNama?.charAt(0)?.toUpperCase() || "U"}
                        </div>

                        {/* Info Kontak */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {targetNama}
                            </p>
                            {isInboxItem && item.waktuTerakhir && (
                              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                                {formatTanggalSingkat(item.waktuTerakhir)}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[11px] text-slate-500 truncate">
                              {isInboxItem
                                ? (item.pengirimTerakhir === "saya" ? "Anda: " : "") + item.pesanTerakhir
                                : item.subLabel || targetRole?.toUpperCase()}
                            </p>
                            {isInboxItem && item.unreadCount > 0 && (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                {item.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>

                      {/* Tombol Hapus Obrolan per Nama (khusus tab inbox / obrolan yang ada riwayat) */}
                      {isInboxItem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleHapusPercakapan(targetId, targetNama);
                          }}
                          className="p-1.5 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg text-xs transition-opacity shrink-0"
                          title={`Hapus seluruh obrolan dengan ${targetNama}`}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ---------------- PANEL KANAN: RUANG CHAT / BROADCAST ---------------- */}
          <div
            className={`flex-1 flex flex-col bg-slate-100 ${
              !activePartner && !isBroadcastMode && !isGuruBroadcastMode ? "hidden md:flex" : "flex"
            }`}
          >
            {isGuruBroadcastMode ? (
              /* ─── UI BROADCAST GURU ─── */
              <div className="flex-1 flex flex-col bg-white overflow-y-auto">
                {/* Header */}
                <div className="px-4 py-3.5 bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-600 text-white flex items-center justify-between shrink-0 shadow-md">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsGuruBroadcastMode(false)}
                      className="md:hidden p-1.5 -ml-1 text-white hover:bg-white/20 rounded-lg cursor-pointer"
                    >
                      ⬅️
                    </button>
                    <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl shrink-0">
                      📣
                    </div>
                    <div>
                      <h3 className="text-sm font-black truncate leading-tight">Siaran Pesan ke Siswa</h3>
                      <p className="text-[11px] text-emerald-100 font-medium">Guru: {myNama}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGuruBroadcastMode(false)}
                    className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                  >
                    Tutup
                  </button>
                </div>

                {/* Konten */}
                <div className="p-4 sm:p-5 space-y-4 max-w-2xl mx-auto w-full flex-1">
                  {/* Info Banner */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5 shadow-2xs">
                    <span className="text-base shrink-0">💡</span>
                    <div>
                      <p className="font-bold">Pilih kategori siswa yang ingin Anda kirimi pesan</p>
                      <p className="text-[11px] text-emerald-800/90 mt-0.5">
                        Pilihan muncul sesuai tugas yang Anda emban. Pesan langsung masuk ke obrolan setiap siswa secara personal.
                      </p>
                    </div>
                  </div>

                  {/* Langkah 1: Pilih Kategori */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Langkah 1 — Pilih Kategori Penerima:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {/* PKL */}
                      {guruTugasInfo?.hasPKL && (
                        <button
                          type="button"
                          onClick={() => handleGuruBroadcastPilihTipe("pkl")}
                          className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                            guruBroadcastTipe === "pkl"
                              ? "border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-xs"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xl shrink-0">🏭</span>
                          <div>
                            <div className="font-extrabold">Siswa PKL</div>
                            <div className="text-[10px] text-slate-500 font-medium">Siswa magang bimbingan Anda</div>
                          </div>
                        </button>
                      )}

                      {/* Guru Wali */}
                      {guruTugasInfo?.hasWali && (
                        <button
                          type="button"
                          onClick={() => handleGuruBroadcastPilihTipe("wali")}
                          className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                            guruBroadcastTipe === "wali"
                              ? "border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-xs"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xl shrink-0">🤝</span>
                          <div>
                            <div className="font-extrabold">Siswa Guru Wali</div>
                            <div className="text-[10px] text-slate-500 font-medium">Siswa binaan Guru Wali Anda</div>
                          </div>
                        </button>
                      )}

                      {/* Wali Kelas (satu tombol per kelas) */}
                      {guruTugasInfo?.daftarWaliKelas.map((wk) => (
                        <button
                          key={`walikelas_${wk.idWali}`}
                          type="button"
                          onClick={() => handleGuruBroadcastPilihTipe(`walikelas_${wk.idWali}`)}
                          className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                            guruBroadcastTipe === `walikelas_${wk.idWali}`
                              ? "border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-xs"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xl shrink-0">🏫</span>
                          <div>
                            <div className="font-extrabold">Wali Kelas</div>
                            <div className="text-[10px] text-slate-500 font-medium truncate">{wk.namaKelas}</div>
                          </div>
                        </button>
                      ))}

                      {/* Mapel (satu tombol per mapel) */}
                      {guruTugasInfo?.daftarMapel.map((mp) => (
                        <button
                          key={`mapel_${mp.idMapel}`}
                          type="button"
                          onClick={() => handleGuruBroadcastPilihTipe(`mapel_${mp.idMapel}`)}
                          className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center gap-2.5 cursor-pointer ${
                            guruBroadcastTipe === `mapel_${mp.idMapel}`
                              ? "border-emerald-500 bg-emerald-50/90 text-emerald-950 shadow-xs"
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <span className="text-xl shrink-0">📚</span>
                          <div>
                            <div className="font-extrabold">Mapel</div>
                            <div className="text-[10px] text-slate-500 font-medium truncate">{mp.namaMapel}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Langkah 2: Preview Penerima */}
                  {guruBroadcastTipe && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Langkah 2 — Penerima:
                      </label>
                      <div className="border border-slate-200 rounded-2xl bg-slate-50 shadow-2xs overflow-hidden">
                        {guruBroadcastLoading ? (
                          <div className="py-6 text-center text-xs text-slate-400 animate-pulse">
                            Memuat daftar siswa...
                          </div>
                        ) : guruBroadcastTargets.length === 0 ? (
                          <div className="py-6 text-center text-xs text-slate-400">
                            Tidak ada siswa terdaftar pada kategori ini.
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-white">
                              <span className="text-xs font-bold text-slate-600">{guruBroadcastTargets.length} siswa akan menerima pesan</span>
                              <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full">✓ Siap kirim</span>
                            </div>
                            <div className="max-h-36 overflow-y-auto divide-y divide-slate-100">
                              {guruBroadcastTargets.map((t) => (
                                <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700">
                                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                                    {t.nama?.charAt(0)?.toUpperCase() || "S"}
                                  </div>
                                  <span className="truncate">{t.nama}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Langkah 3: Tulis Pesan */}
                  {guruBroadcastTipe && guruBroadcastTargets.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                          Langkah 3 — Tulis Pesan:
                        </label>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {guruBroadcastPesan.length}/500
                        </span>
                      </div>
                      <textarea
                        rows={5}
                        maxLength={500}
                        value={guruBroadcastPesan}
                        onChange={(e) => setGuruBroadcastPesan(e.target.value)}
                        placeholder="Tuliskan pesan pengumuman, tugas, atau informasi penting untuk siswa di sini..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:bg-white transition-all resize-none font-medium leading-relaxed"
                      />
                    </div>
                  )}

                  {/* Status Banner */}
                  {guruBroadcastStatus.teks && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                        guruBroadcastStatus.tipe === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : guruBroadcastStatus.tipe === "info"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      <span>{guruBroadcastStatus.teks}</span>
                      <button
                        type="button"
                        onClick={() => setGuruBroadcastStatus({ tipe: "", teks: "" })}
                        className="text-xs font-black opacity-60 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Tombol Kirim */}
                  {guruBroadcastTipe && guruBroadcastTargets.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleKirimGuruBroadcast}
                        disabled={guruBroadcastSending || !guruBroadcastPesan.trim()}
                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>{guruBroadcastSending ? "⏳ Sedang Menyiarkan..." : `📣 Kirim ke ${guruBroadcastTargets.length} Siswa Sekarang`}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : isBroadcastMode ? (
              <div className="flex-1 flex flex-col bg-white overflow-y-auto">
                {/* Header Broadcast */}
                <div className="px-4 py-3.5 bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-600 text-white flex items-center justify-between shrink-0 shadow-md">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsBroadcastMode(false)}
                      className="md:hidden p-1.5 -ml-1 text-white hover:bg-white/20 rounded-lg cursor-pointer"
                    >
                      ⬅️
                    </button>
                    <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl shrink-0">
                      📢
                    </div>
                    <div>
                      <h3 className="text-sm font-black truncate leading-tight">
                        Siaran Pesan Massal (Broadcast)
                      </h3>
                      <p className="text-[11px] text-amber-100 font-medium">
                        Kepala Sekolah: {myNama || "HURDISMAN, S.Pd"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBroadcastMode(false)}
                    className="text-xs font-bold bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl cursor-pointer transition-all"
                  >
                    Tutup
                  </button>
                </div>

                {/* Konten Broadcast */}
                <div className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto w-full flex-1">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 text-xs text-amber-900 leading-relaxed flex items-start gap-2.5 shadow-2xs">
                    <span className="text-base shrink-0">💡</span>
                    <div>
                      <p className="font-bold">Info Siaran Massal Kepala Sekolah</p>
                      <p className="text-[11px] text-amber-800/90 mt-0.5">
                        Pesan broadcast ini akan dikirimkan secara serentak ke akun masing-masing guru di Supabase Cloud (0 byte di Vercel) dan memicu Web Push Notification di HP para guru.
                      </p>
                    </div>
                  </div>

                  {/* Mode Penerima */}
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      Target Penerima:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBroadcastModePenerima("semua")}
                        className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                          broadcastModePenerima === "semua"
                            ? "border-amber-500 bg-amber-50/80 text-amber-950 shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-lg">👥</span>
                        <div>
                          <div className="font-extrabold">Semua Guru</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {daftarGuruUntukBroadcast.length} Dewan Guru
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBroadcastModePenerima("pilih")}
                        className={`p-3 rounded-xl border-2 text-xs font-bold transition-all text-left flex items-center gap-2 cursor-pointer ${
                          broadcastModePenerima === "pilih"
                            ? "border-amber-500 bg-amber-50/80 text-amber-950 shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-lg">☑️</span>
                        <div>
                          <div className="font-extrabold">Pilih Tertentu</div>
                          <div className="text-[10px] text-slate-500 font-medium">
                            {broadcastSelectedIds.size} dipilih
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Jika mode pilih tertentu, tampilkan daftar checklist guru */}
                  {broadcastModePenerima === "pilih" && (
                    <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-slate-50 shadow-2xs">
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200 text-xs">
                        <span className="font-bold text-slate-700">Daftar Guru:</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllBroadcastGuru}
                            className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                          >
                            Pilih Semua
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={handleClearAllBroadcastGuru}
                            className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                        {daftarGuruUntukBroadcast.map((g) => {
                          const isChecked = broadcastSelectedIds.has(g.id);
                          return (
                            <label
                              key={g.id}
                              className={`flex items-center gap-2.5 p-2 rounded-xl text-xs cursor-pointer transition-colors ${
                                isChecked
                                  ? "bg-amber-100/70 font-bold text-amber-950"
                                  : "hover:bg-white text-slate-700"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectBroadcastGuru(g.id)}
                                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                              />
                              <span className="truncate">{g.nama}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Input Teks Pesan Broadcast */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                        Isi Pesan Broadcast:
                      </label>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {broadcastPesan.length}/500 karakter
                      </span>
                    </div>
                    <textarea
                      rows={5}
                      maxLength={500}
                      value={broadcastPesan}
                      onChange={(e) => setBroadcastPesan(e.target.value)}
                      placeholder="Tuliskan pengumuman resmi, arahan rapat dinas, jadwal pembimbingan, atau instruksi kerja untuk seluruh guru di sini..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:bg-white transition-all resize-none font-medium leading-relaxed"
                    />
                  </div>

                  {/* Status Banner */}
                  {broadcastStatus.teks && (
                    <div
                      className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                        broadcastStatus.tipe === "success"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : broadcastStatus.tipe === "info"
                          ? "bg-blue-50 text-blue-800 border border-blue-200"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      <span>{broadcastStatus.teks}</span>
                      <button
                        type="button"
                        onClick={() => setBroadcastStatus({ tipe: "", teks: "" })}
                        className="text-xs font-black opacity-60 hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Tombol Kirim Broadcast */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleKirimBroadcast}
                      disabled={broadcastSending || !broadcastPesan.trim()}
                      className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:brightness-110 active:scale-95 disabled:opacity-50 text-white font-black text-xs sm:text-sm shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>{broadcastSending ? "⏳ Sedang Menyiarkan..." : "📢 Kirim Pesan Broadcast Sekarang"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : activePartner ? (
              <>
                {/* Chat Header */}
                <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActivePartner(null)}
                      className="md:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
                    >
                      ⬅️
                    </button>
                    <div
                      className={`w-9 h-9 rounded-2xl bg-gradient-to-tr ${
                        activePartner.role === "kepsek"
                          ? "from-amber-500 to-yellow-600"
                          : activePartner.role === "siswa"
                          ? "from-emerald-500 to-teal-600"
                          : "from-blue-600 to-indigo-600"
                      } text-white font-black text-sm flex items-center justify-center shrink-0`}
                    >
                      {activePartner.nama?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {activePartner.nama}
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {activePartner.subLabel || (activePartner.role === "kepsek" ? "Kepala Sekolah" : activePartner.role === "guru" ? "Guru" : "Siswa")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleHapusPercakapan(activePartner.id, activePartner.nama)}
                      className="p-1.5 text-xs text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                      title="Hapus Seluruh Obrolan"
                    >
                      🗑️
                    </button>
                    <button
                      type="button"
                      onClick={() => muatPercakapan(false)}
                      className="p-1.5 text-xs text-slate-500 hover:text-blue-600 rounded-lg hover:bg-slate-100"
                      title="Segarkan Pesan"
                    >
                      🔄
                    </button>
                  </div>
                </div>

                {/* Chat Messages Stream */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                  {loadingChat && messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 animate-pulse">
                      Memuat obrolan...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6">
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xl mb-2">
                        💬
                      </div>
                      <p className="text-xs font-bold text-slate-700">
                        Belum ada pesan dengan {activePartner.nama}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
                        Tulis pesan Anda di bawah untuk memulai percakapan koordinasi atau konsultasi.
                      </p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isMe = String(m.id_pengirim).trim() === myId;
                      return (
                        <div
                          key={m.id || idx}
                          className={`group flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        >
                          <div
                            className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 shadow-xs relative text-xs sm:text-[13px] leading-relaxed break-words ${
                              isMe
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs"
                                : "bg-white text-slate-800 border border-slate-200/80 rounded-bl-xs"
                            }`}
                          >
                            {!isMe && (
                              <p className="text-[10px] font-black text-blue-600 mb-0.5">
                                {m.nama_pengirim}
                              </p>
                            )}
                            <p className="whitespace-pre-wrap">{m.pesan}</p>
                            <div
                              className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] ${
                                isMe ? "text-blue-100" : "text-slate-400"
                              }`}
                            >
                              <span>{formatJam(m.created_at)}</span>
                              {isMe && (
                                <span
                                  className={m.dibaca ? "text-cyan-300 font-bold" : "text-white/60"}
                                  title={m.dibaca ? "Sudah dibaca" : "Terkirim"}
                                >
                                  {m.dibaca ? "✓✓" : "✓"}
                                </span>
                              )}
                              {m.id && !m.isTemp && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleHapusSatuPesan(m.id);
                                  }}
                                  className={`ml-1 text-[11px] opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:scale-110 cursor-pointer ${
                                    isMe
                                      ? "text-white/70 hover:text-white"
                                      : "text-slate-400 hover:text-rose-600"
                                  }`}
                                  title="Hapus pesan ini"
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="bg-rose-50 text-rose-700 text-xs px-4 py-2 border-t border-rose-200 flex items-center justify-between">
                    <span>⚠️ {errorMsg}</span>
                    <button
                      onClick={() => setErrorMsg("")}
                      className="text-xs font-bold hover:underline"
                    >
                      Tutup
                    </button>
                  </div>
                )}

                {/* Chat Input Field */}
                <form
                  onSubmit={handleKirim}
                  className="p-2.5 sm:p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
                >
                  <input
                    type="text"
                    placeholder={`Tulis pesan ke ${activePartner.nama}...`}
                    value={inputPesan}
                    onChange={(e) => setInputPesan(e.target.value)}
                    disabled={sending}
                    className="flex-1 bg-slate-100 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 border border-slate-200"
                  />
                  <button
                    type="submit"
                    disabled={!inputPesan.trim() || sending}
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50 text-white px-4 py-2.5 text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-1.5"
                  >
                    <span>{sending ? "Mengirim..." : "Kirim"}</span>
                    <span>✈️</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-16 h-16 rounded-3xl bg-white shadow-md flex items-center justify-center text-3xl mb-3">
                  💬
                </div>
                <h4 className="text-sm font-bold text-slate-700 mb-1">
                  Pilih Percakapan
                </h4>
                <p className="text-xs max-w-sm">
                  Pilih salah satu kontak di panel kiri untuk mulai mengirim pesan ke Kepala Sekolah, Guru Pembimbing, Wali Kelas, Guru Mapel, atau Siswa.
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
