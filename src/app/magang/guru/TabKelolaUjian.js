"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchDaftarUjian,
  tambahDataUjian,
  editDataUjian,
  hapusDataUjian,
  fetchSemuaSiswaAsesmen,
  resetPelanggaranSiswa,
  kirimPesanUjian,
  hapusPesanUjian,
  hapusAkunSiswaAsesmen,
  verifyPinAdminAsesmen,
} from "@/services/guruAsesmenService";

// Palet warna kelas konsisten (Otomatis membedakan baris tiap kelas)
const PALET_WARNA_KELAS = [
  { bg: "bg-sky-50/70 hover:bg-sky-100/90", border: "border-l-sky-500", badge: "bg-sky-100 text-sky-900 border-sky-300" },
  { bg: "bg-emerald-50/70 hover:bg-emerald-100/90", border: "border-l-emerald-500", badge: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { bg: "bg-amber-50/70 hover:bg-amber-100/90", border: "border-l-amber-500", badge: "bg-amber-100 text-amber-900 border-amber-300" },
  { bg: "bg-purple-50/70 hover:bg-purple-100/90", border: "border-l-purple-500", badge: "bg-purple-100 text-purple-900 border-purple-300" },
  { bg: "bg-teal-50/70 hover:bg-teal-100/90", border: "border-l-teal-500", badge: "bg-teal-100 text-teal-900 border-teal-300" },
  { bg: "bg-indigo-50/70 hover:bg-indigo-100/90", border: "border-l-indigo-500", badge: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  { bg: "bg-orange-50/70 hover:bg-orange-100/90", border: "border-l-orange-500", badge: "bg-orange-100 text-orange-900 border-orange-300" },
  { bg: "bg-cyan-50/70 hover:bg-cyan-100/90", border: "border-l-cyan-500", badge: "bg-cyan-100 text-cyan-900 border-cyan-300" },
  { bg: "bg-lime-50/70 hover:bg-lime-100/90", border: "border-l-lime-500", badge: "bg-lime-100 text-lime-900 border-lime-300" },
  { bg: "bg-fuchsia-50/70 hover:bg-fuchsia-100/90", border: "border-l-fuchsia-500", badge: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300" },
  { bg: "bg-rose-50/60 hover:bg-rose-100/80", border: "border-l-rose-500", badge: "bg-rose-100 text-rose-900 border-rose-300" },
  { bg: "bg-slate-50/70 hover:bg-slate-100/90", border: "border-l-slate-500", badge: "bg-slate-100 text-slate-900 border-slate-300" },
];

function getWarnaKelas(namaKelas) {
  if (!namaKelas) return PALET_WARNA_KELAS[0];
  let hash = 0;
  const clean = String(namaKelas).trim().toUpperCase();
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALET_WARNA_KELAS.length;
  return PALET_WARNA_KELAS[index];
}

export default function TabKelolaUjian({ user, daftarMapelGuru = [], onClose }) {
  // Mode Admin Asesmen (Super Admin Ujian)
  const [isAdminAsesmen, setIsAdminAsesmen] = useState(false);
  const [pinAdminAsesmen, setPinAdminAsesmen] = useState("");
  const [showModalPin, setShowModalPin] = useState(false);
  const [inputPin, setInputPin] = useState("");
  const [pinError, setPinError] = useState("");

  // Sub-tab: "ujian" (Sheet UJIAN) | "monitoring" (Database Siswa & Pelanggaran)
  const [subTab, setSubTab] = useState("ujian");

  // State Sheet UJIAN
  const [daftarUjian, setDaftarUjian] = useState([]);
  const [loadingUjian, setLoadingUjian] = useState(false);

  // Filter Sheet UJIAN
  const [filterUjianKelas, setFilterUjianKelas] = useState("SEMUA");
  const [filterUjianMapel, setFilterUjianMapel] = useState("");

  // Form Tambah Ujian Terpisah
  const [modalTambahOpen, setModalTambahOpen] = useState(false);
  const [selectedMapelOption, setSelectedMapelOption] = useState("");
  const [formTambah, setFormTambah] = useState({
    kelas: "",
    mapel: "",
    token: "",
    link: "",
    kodeKirim: "",
  });

  // Form Edit Ujian Terpisah
  const [modalEditOpen, setModalEditOpen] = useState(false);
  const [formEdit, setFormEdit] = useState({
    rowIndex: null,
    kelasLama: "",
    mapelLama: "",
    kelas: "",
    mapel: "",
    token: "",
    link: "",
    kodeKirim: "",
    guru: "",
  });

  // State Database Siswa
  const [daftarSiswa, setDaftarSiswa] = useState([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);

  // Filter Multi-Kriteria Database Siswa
  const [filterKelas, setFilterKelas] = useState("SEMUA");
  const [filterNamaSiswa, setFilterNamaSiswa] = useState("");
  const [filterIdSiswa, setFilterIdSiswa] = useState("");
  const [filterPelanggaran, setFilterPelanggaran] = useState("SEMUA"); // "SEMUA" | "MELANGGAR" | "BERSIH" | "TERBANYAK"
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"
  
  // Pagination untuk ribuan siswa
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);

  // Status Alerts & Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [suksesMsg, setSuksesMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Modal Kirim Pesan Massal
  const [showPesanModal, setShowPesanModal] = useState(false);
  const [pesanInput, setPesanInput] = useState("");
  const [targetPesan, setTargetPesan] = useState({ tipe: "kelas", kelas: "SEMUA", nama: "" });

  // Cek sessionStorage untuk PIN Admin yang pernah dimasukkan
  useEffect(() => {
    try {
      const savedAdmin = sessionStorage.getItem("is_admin_asesmen");
      const savedPin = sessionStorage.getItem("pin_admin_asesmen");
      if (savedAdmin === "true" && savedPin) {
        setIsAdminAsesmen(true);
        setPinAdminAsesmen(savedPin);
      }
    } catch {}
  }, []);

  // 1. Muat Data Sheet UJIAN
  const loadUjian = useCallback(async () => {
    setLoadingUjian(true);
    setErrorMsg("");
    try {
      const res = await fetchDaftarUjian();
      if (res.status === "success" && Array.isArray(res.data)) {
        setDaftarUjian(res.data);
      } else {
        setErrorMsg(res.message || "Gagal memuat sheet UJIAN");
      }
    } catch (e) {
      setErrorMsg("Koneksi gagal: " + e.message);
    } finally {
      setLoadingUjian(false);
    }
  }, []);

  // 2. Muat Database Siswa
  const loadSiswa = useCallback(async () => {
    setLoadingSiswa(true);
    setErrorMsg("");
    try {
      const res = await fetchSemuaSiswaAsesmen();
      if (res.status === "success" && Array.isArray(res.data)) {
        setDaftarSiswa(res.data);
      } else {
        setErrorMsg(res.message || "Gagal memuat data database siswa");
      }
    } catch (e) {
      setErrorMsg("Koneksi gagal: " + e.message);
    } finally {
      setLoadingSiswa(false);
    }
  }, []);

  useEffect(() => {
    loadUjian();
    loadSiswa();
  }, [loadUjian, loadSiswa]);

  // Daftar Unik Opsi Mapel & Kelas yang Diajar Guru Ini
  const opsiMapelGuru = useMemo(() => {
    if (!Array.isArray(daftarMapelGuru)) return [];
    return daftarMapelGuru
      .filter((m) => m && (m.kelas || m.namaMapel))
      .map((m) => ({
        kelas: String(m.kelas || "").trim().toUpperCase(),
        namaMapel: String(m.namaMapel || "").trim().toUpperCase(),
        idMapel: m.idMapel,
      }));
  }, [daftarMapelGuru]);

  // Handler Verifikasi PIN Admin Asesmen
  const handleVerifyPin = async (e) => {
    e.preventDefault();
    setPinError("");
    setActionLoading(true);
    try {
      const res = await verifyPinAdminAsesmen(inputPin);
      if (res.status === "success" && res.isAdmin) {
        setIsAdminAsesmen(true);
        setPinAdminAsesmen(inputPin);
        try {
          sessionStorage.setItem("is_admin_asesmen", "true");
          sessionStorage.setItem("pin_admin_asesmen", inputPin);
        } catch {}
        setShowModalPin(false);
        setInputPin("");
        setSuksesMsg("Selamat datang, Admin Asesmen! Anda memiliki akses penuh.");
      } else {
        setPinError(res.message || "Kode khusus salah!");
      }
    } catch (err) {
      setPinError("Gagal verifikasi: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogoutAdmin = () => {
    setIsAdminAsesmen(false);
    setPinAdminAsesmen("");
    try {
      sessionStorage.removeItem("is_admin_asesmen");
      sessionStorage.removeItem("pin_admin_asesmen");
    } catch {}
    setSuksesMsg("Mode Admin Asesmen dinonaktifkan.");
  };

  // Helper cek apakah guru berhak mengelola ujian tertentu
  const canManageUjian = useCallback(
    (item) => {
      if (isAdminAsesmen) return true;
      if (!item) return false;

      // Jika belum ada pembuatnya, guru mapel boleh mengeditnya
      if (!item.guru || item.guru === "-" || item.guru === "") return true;

      const pembuat = item.guru.toLowerCase();
      const uNama = (user?.nama || "").toLowerCase().trim();
      const uId = (user?.id || "").toString().toLowerCase().trim();

      if (uId && pembuat.includes(uId)) return true;
      if (uNama && pembuat.includes(uNama)) return true;

      return false;
    },
    [isAdminAsesmen, user]
  );

  // List Unik Kelas dari data siswa & data ujian
  const uniqueKelasList = useMemo(() => {
    const setKelas = new Set();
    daftarUjian.forEach((u) => {
      if (u.kls) setKelas.add(u.kls.trim().toUpperCase());
    });
    daftarSiswa.forEach((s) => {
      if (s.kelas) setKelas.add(s.kelas.trim().toUpperCase());
    });
    return Array.from(setKelas).sort();
  }, [daftarUjian, daftarSiswa]);

  // List Unik Mapel dari data ujian
  const uniqueUjianMapelList = useMemo(() => {
    const setMapel = new Set();
    daftarUjian.forEach((u) => {
      if (u.mpl) setMapel.add(u.mpl.trim().toUpperCase());
    });
    return Array.from(setMapel).sort();
  }, [daftarUjian]);

  // 1. FILTER DAFTAR UJIAN (Sheet UJIAN)
  const filteredUjian = useMemo(() => {
    return daftarUjian.filter((u) => {
      const matchKls =
        filterUjianKelas === "SEMUA" ||
        (u.kls || "").trim().toUpperCase() === filterUjianKelas;

      if (!matchKls) return false;

      if (!filterUjianMapel.trim()) return true;
      const q = filterUjianMapel.toLowerCase();
      return (
        (u.mpl || "").toLowerCase().includes(q) ||
        (u.token || "").toLowerCase().includes(q)
      );
    });
  }, [daftarUjian, filterUjianKelas, filterUjianMapel]);

  // 2. FILTER MULTI-KRITERIA DATABASE SISWA
  const filteredSiswa = useMemo(() => {
    let result = daftarSiswa.filter((s) => {
      // Filter Kelas
      if (filterKelas !== "SEMUA") {
        if ((s.kelas || "").trim().toUpperCase() !== filterKelas) return false;
      }

      // Filter Nama
      if (filterNamaSiswa.trim()) {
        const qNama = filterNamaSiswa.toLowerCase();
        if (!(s.nama || "").toLowerCase().includes(qNama)) return false;
      }

      // Filter ID Siswa
      if (filterIdSiswa.trim()) {
        const qId = filterIdSiswa.toLowerCase();
        if (!(s.id_siswa || "").toLowerCase().includes(qId)) return false;
      }

      // Filter Status Pelanggaran
      if (filterPelanggaran === "MELANGGAR") {
        if (!s.pelanggaran || s.pelanggaran <= 0) return false;
      } else if (filterPelanggaran === "BERSIH") {
        if (s.pelanggaran && s.pelanggaran > 0) return false;
      }

      return true;
    });

    // Pengurutan / Sortir
    if (filterPelanggaran === "TERBANYAK") {
      result.sort((a, b) => (b.pelanggaran || 0) - (a.pelanggaran || 0));
    } else if (sortOrder === "desc") {
      result.reverse();
    }

    return result;
  }, [daftarSiswa, filterKelas, filterNamaSiswa, filterIdSiswa, filterPelanggaran, sortOrder]);

  // Statistik Keseluruhan
  const statsSiswa = useMemo(() => {
    let pelanggar = 0;
    let totalPelanggaran = 0;
    let pengaduan = 0;

    filteredSiswa.forEach((s) => {
      if (s.pelanggaran > 0) {
        pelanggar++;
        totalPelanggaran += s.pelanggaran;
      }
      if (s.pengaduan) pengaduan++;
    });

    return {
      total: filteredSiswa.length,
      pelanggar,
      totalPelanggaran,
      pengaduan,
    };
  }, [filteredSiswa]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredSiswa.length / pageSize) || 1;
  const paginatedSiswa = useMemo(() => {
    if (pageSize >= 9999) return filteredSiswa;
    const start = (currentPage - 1) * pageSize;
    return filteredSiswa.slice(start, start + pageSize);
  }, [filteredSiswa, currentPage, pageSize]);

  // Reset page saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterKelas, filterNamaSiswa, filterIdSiswa, filterPelanggaran, pageSize]);

  // --- 1. AKSI TAMBAH UJIAN (APPEND BARU) ---
  const handleOpenTambahUjian = () => {
    setSelectedMapelOption("");
    setFormTambah({
      kelas: "",
      mapel: "",
      token: "",
      link: "",
      kodeKirim: "",
    });
    setModalTambahOpen(true);
  };

  const handleSubmitTambah = async (e) => {
    e.preventDefault();
    if (!formTambah.kelas.trim() || !formTambah.mapel.trim()) {
      alert("Kelas dan Mapel wajib dipilih atau diisi!");
      return;
    }

    setActionLoading(true);
    try {
      const res = await tambahDataUjian({
        ...formTambah,
        id_guru: user?.id || "",
        nama_guru: user?.nama || "Guru",
        pin_admin: pinAdminAsesmen,
      });

      if (res.status === "success") {
        setSuksesMsg(res.message || "Ujian baru berhasil ditambahkan!");
        setModalTambahOpen(false);
        loadUjian();
      } else {
        setErrorMsg(res.message || "Gagal menambahkan ujian");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- 2. AKSI EDIT UJIAN (HANYA UPDATE BARIS LAMA, TIDAK MENAMBAH BARIS) ---
  const handleOpenEditUjian = (item, idx) => {
    if (!canManageUjian(item)) {
      alert(
        `Akses Ditolak!\nUjian ini dibuat oleh: ${item.guru || "Guru Lain"}.\n\nAnda hanya dapat mengedit ujian buatan Anda sendiri, kecuali memasukkan Kode Admin Asesmen (4321).`
      );
      return;
    }

    const rowExact = item.rowIndex || idx + 2;
    setFormEdit({
      rowIndex: rowExact,
      kelasLama: item.kls,
      mapelLama: item.mpl,
      kelas: item.kls,
      mapel: item.mpl,
      token: item.token || "",
      link: item.link || "",
      kodeKirim: item.kodeKirim || "",
      guru: item.guru || "",
    });
    setModalEditOpen(true);
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!formEdit.kelas.trim() || !formEdit.mapel.trim()) {
      alert("Kelas dan Mapel wajib diisi!");
      return;
    }

    setActionLoading(true);
    try {
      const res = await editDataUjian({
        ...formEdit,
        id_guru: user?.id || "",
        nama_guru: user?.nama || "Guru",
        pin_admin: pinAdminAsesmen,
      });

      if (res.status === "success") {
        setSuksesMsg(res.message || `Baris ${formEdit.rowIndex} berhasil diperbarui!`);
        setModalEditOpen(false);
        loadUjian();
      } else {
        setErrorMsg(res.message || "Gagal mengedit ujian");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- 3. AKSI HAPUS UJIAN ---
  const handleHapusUjian = async (item, idx) => {
    if (!canManageUjian(item)) {
      alert(
        `Akses Ditolak!\nUjian ini dibuat oleh: ${item.guru || "Guru Lain"}.\n\nHanya pembuat ujian atau Admin Asesmen yang dapat menghapusnya.`
      );
      return;
    }

    const rowExact = item.rowIndex || idx + 2;
    if (
      !confirm(
        `Hapus ujian baris ke-${rowExact} (${item.kls} - ${item.mpl})?\n\nTindakan ini akan menghapus baris dari sheet UJIAN!`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await hapusDataUjian({
        rowIndex: rowExact,
        kelas: item.kls,
        mapel: item.mpl,
        id_guru: user?.id || "",
        nama_guru: user?.nama || "Guru",
        pin_admin: pinAdminAsesmen,
      });

      if (res.status === "success") {
        setSuksesMsg(res.message || "Ujian berhasil dihapus");
        loadUjian();
      } else {
        setErrorMsg(res.message || "Gagal menghapus ujian");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // --- 4. AKSI DATABASE SISWA ---
  const handleResetPelanggaranSiswa = async (s) => {
    if (!confirm(`Reset pelanggaran ${s.nama || s.id_siswa} ke 0?`)) return;
    setActionLoading(true);
    try {
      const res = await resetPelanggaranSiswa({
        id_siswa: s.id_siswa,
        nama: s.nama,
        kelas: s.kelas,
        id_guru: user?.id || "",
        pin_admin: pinAdminAsesmen,
      });
      if (res.status === "success") {
        setSuksesMsg(`Pelanggaran ${s.nama} berhasil direset ke 0!`);
        loadSiswa();
      } else {
        setErrorMsg(res.message || "Gagal mereset pelanggaran");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPelanggaranMassal = async () => {
    const scopeLabel =
      filterKelas === "SEMUA"
        ? "SELURUH SISWA DI SEMUA KELAS TERFILTER"
        : `SELURUH SISWA KELAS ${filterKelas}`;
    if (
      !confirm(
        `Apakah Anda yakin ingin mereset SEMUA pelanggaran untuk ${scopeLabel} menjadi 0?`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await resetPelanggaranSiswa({
        kelas: filterKelas,
        id_guru: user?.id || "",
        pin_admin: pinAdminAsesmen,
      });
      if (res.status === "success") {
        setSuksesMsg(res.message || "Pelanggaran massal berhasil direset!");
        loadSiswa();
      } else {
        setErrorMsg(res.message || "Gagal mereset massal");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleHapusAkunSiswa = async (s) => {
    const konfirmasi = confirm(
      `⚠️ HAPUS AKUN SISWA:\n\nNama: ${s.nama}\nKelas: ${s.kelas}\nID Siswa: ${s.id_siswa}\n\nSesuai mekanisme sistem:\n- Kolom C (ID Siswa) AKAN TETAP TERSIMPAN agar siswa dapat registrasi ulang.\n- Data Nama, Kelas, Pelanggaran, dan Pesan akan dibersihkan.\n\nLanjutkan?`
    );
    if (!konfirmasi) return;

    setActionLoading(true);
    try {
      const res = await hapusAkunSiswaAsesmen(s.id_siswa, pinAdminAsesmen);
      if (res.status === "success") {
        setSuksesMsg(`Akun siswa ${s.nama} (${s.id_siswa}) berhasil dihapus!`);
        loadSiswa();
      } else {
        setErrorMsg(res.message || "Gagal menghapus akun");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleKirimPesanSubmit = async (e) => {
    e.preventDefault();
    if (!pesanInput.trim()) return;

    setActionLoading(true);
    try {
      const res = await kirimPesanUjian({
        kelas: targetPesan.kelas,
        nama: targetPesan.nama,
        pesan: pesanInput.trim(),
        id_guru: user?.id || "",
        pin_admin: pinAdminAsesmen,
      });
      if (res.status === "success") {
        setSuksesMsg(res.message || "Pesan berhasil dikirim!");
        setShowPesanModal(false);
        setPesanInput("");
        loadSiswa();
      } else {
        setErrorMsg(res.message || "Gagal mengirim pesan");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn pb-8 text-slate-800">
      {/* BANNER UTAMA */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 p-4 sm:p-6 text-white shadow-xl border border-blue-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-400/30">
                🛡️ Pusat Kendali Asesmen & Ujian
              </span>
              {isAdminAsesmen ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 text-xs font-black shadow-md border border-yellow-200">
                  👑 MODE ADMIN ASESMEN AKTIF
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold border border-white/15">
                  👤 Guru: {user?.nama || "Guru"}
                </span>
              )}
            </div>
            <h2 className="text-lg sm:text-2xl font-black tracking-tight text-white">
              Sistem Asesmen SMKN 1 Teluk Kuantan
            </h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Tampilan responsif & padat untuk ribuan peserta ujian dengan pewarnaan kelas otomatis.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!isAdminAsesmen ? (
              <button
                onClick={() => {
                  setInputPin("");
                  setPinError("");
                  setShowModalPin(true);
                }}
                className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-3 py-2 text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 border border-amber-300/40"
              >
                <span>🔑</span>
                <span>Masuk Admin (4321)</span>
              </button>
            ) : (
              <button
                onClick={handleLogoutAdmin}
                className="rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-400/30 px-3 py-2 text-xs font-bold transition-all"
              >
                🚪 Keluar Admin
              </button>
            )}

            <button
              onClick={() => {
                loadUjian();
                loadSiswa();
              }}
              disabled={loadingUjian || loadingSiswa || actionLoading}
              className="rounded-xl bg-white/10 hover:bg-white/20 text-white px-3 py-2 text-xs font-bold backdrop-blur-sm border border-white/20 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
            >
              <span>🔄</span>
              <span>Refresh</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="rounded-xl bg-white/15 hover:bg-white/25 text-white px-3 py-2 text-xs font-black transition-all"
              >
                ✕ Tutup
              </button>
            )}
          </div>
        </div>

        {/* NAVIGASI SUB-TAB */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <button
            onClick={() => setSubTab("ujian")}
            className={`rounded-xl px-4 py-2 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm ${
              subTab === "ujian"
                ? "bg-amber-400 text-amber-950 shadow-amber-400/30 scale-105"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <span>📑</span>
            <span>Sheet UJIAN ({filteredUjian.length} Sesi)</span>
          </button>

          <button
            onClick={() => setSubTab("monitoring")}
            className={`rounded-xl px-4 py-2 text-xs font-black transition-all flex items-center gap-1.5 shadow-sm ${
              subTab === "monitoring"
                ? "bg-amber-400 text-amber-950 shadow-amber-400/30 scale-105"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <span>🛡️</span>
            <span>Monitoring Database Siswa ({filteredSiswa.length} Siswa)</span>
          </button>
        </div>
      </div>

      {/* ALERT STATUS */}
      {suksesMsg && (
        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-center justify-between shadow-sm">
          <span>✅ {suksesMsg}</span>
          <button onClick={() => setSuksesMsg("")} className="text-emerald-700 font-bold px-2">✕</button>
        </div>
      )}
      {errorMsg && (
        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800 flex items-center justify-between shadow-sm">
          <span>⚠️ {errorMsg}</span>
          <button onClick={() => setErrorMsg("")} className="text-rose-700 font-bold px-2">✕</button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. SUB-TAB: DAFTAR SESI UJIAN (FILTER KELAS & MAPEL)    */}
      {/* ======================================================== */}
      {subTab === "ujian" && (
        <div className="space-y-3">
          {/* BARIS FILTER UJIAN */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-black text-slate-700 uppercase">Filter Ujian:</span>
                
                {/* FILTER KELAS */}
                <select
                  value={filterUjianKelas}
                  onChange={(e) => setFilterUjianKelas(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                >
                  <option value="SEMUA">-- Semua Kelas ({daftarUjian.length}) --</option>
                  {uniqueKelasList.map((k) => (
                    <option key={k} value={k}>Kelas {k}</option>
                  ))}
                </select>

                {/* FILTER MAPEL */}
                <input
                  type="text"
                  value={filterUjianMapel}
                  onChange={(e) => setFilterUjianMapel(e.target.value)}
                  placeholder="Cari mapel / token..."
                  className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-amber-500 w-44"
                />

                {(filterUjianKelas !== "SEMUA" || filterUjianMapel) && (
                  <button
                    onClick={() => {
                      setFilterUjianKelas("SEMUA");
                      setFilterUjianMapel("");
                    }}
                    className="text-[11px] text-rose-600 hover:underline font-bold px-1"
                  >
                    Reset Filter
                  </button>
                )}
              </div>

              <button
                onClick={handleOpenTambahUjian}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-3.5 py-2 text-xs font-black shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>➕</span>
                <span>Tambah Sesi Ujian Baru</span>
              </button>
            </div>
          </div>

          {/* TABEL SESI UJIAN (PADAT & RESPONSIF) */}
          {loadingUjian ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 gap-2">
              <span className="text-2xl animate-spin">⏳</span>
              <p className="text-xs font-bold">Memuat data Sheet UJIAN...</p>
            </div>
          ) : filteredUjian.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-slate-200 text-slate-400 gap-2">
              <span className="text-3xl">📭</span>
              <p className="text-xs font-bold">Tidak ada sesi ujian yang cocok dengan filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-[11px] font-black uppercase text-slate-700 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12">Baris</th>
                    <th className="px-3 py-2.5">Kelas</th>
                    <th className="px-3 py-2.5">Mata Pelajaran</th>
                    <th className="px-3 py-2.5">Token</th>
                    <th className="px-3 py-2.5">Link Google Form</th>
                    <th className="px-3 py-2.5 text-center">Kode Kirim</th>
                    <th className="px-3 py-2.5">Pembuat</th>
                    <th className="px-3 py-2.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredUjian.map((item, idx) => {
                    const rowNumber = item.rowIndex || idx + 2;
                    const canManage = canManageUjian(item);
                    const warna = getWarnaKelas(item.kls);

                    return (
                      <tr
                        key={idx}
                        className={`transition-colors ${warna.bg} ${warna.border} border-l-4`}
                      >
                        <td className="px-3 py-2 text-center font-bold text-slate-400">
                          #{rowNumber}
                        </td>
                        <td className="px-3 py-2 font-black">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${warna.badge}`}>
                            {item.kls || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-bold text-slate-900">
                          {item.mpl || "-"}
                        </td>
                        <td className="px-3 py-2 font-mono font-black text-emerald-800">
                          <span className="bg-white/80 border border-emerald-300 px-1.5 py-0.5 rounded">
                            {item.token || "-"}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline font-semibold block truncate max-w-[170px]"
                              title={item.link}
                            >
                              🔗 {item.link}
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center font-mono font-black text-amber-900">
                          {item.kodeKirim || "-"}
                        </td>
                        <td className="px-3 py-2 text-[10px] text-slate-600">
                          {item.guru ? (
                            <span className="truncate block max-w-[130px]" title={item.guru}>
                              👤 {item.guru}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Umum</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {canManage ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditUjian(item, idx)}
                                disabled={actionLoading}
                                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 text-[10px] font-bold transition-all shadow-2xs"
                                title="Edit sesi ujian ini"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => handleHapusUjian(item, idx)}
                                disabled={actionLoading}
                                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-2 py-1 text-[10px] font-bold transition-all shadow-2xs"
                                title="Hapus sesi ujian ini"
                              >
                                🗑️ Hapus
                              </button>
                            </div>
                          ) : (
                            <span
                              className="text-[10px] text-slate-400 bg-slate-100 rounded px-1.5 py-0.5 font-semibold cursor-not-allowed"
                              title="Terkunci: Dibuat oleh guru lain"
                            >
                              🔒 Terkunci
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. SUB-TAB: MONITORING DATABASE SISWA                    */}
      {/* ======================================================== */}
      {subTab === "monitoring" && (
        <div className="space-y-3">
          {/* STATISTIK RINGKAS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">
                Total Siswa (Hasil Filter)
              </span>
              <span className="text-xl font-black text-slate-800">
                {statsSiswa.total} <span className="text-xs font-normal text-slate-400">/ {daftarSiswa.length}</span>
              </span>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3 shadow-xs">
              <span className="text-[10px] font-bold text-rose-600 uppercase block">
                Siswa Ada Pelanggaran
              </span>
              <span className="text-xl font-black text-rose-700">
                {statsSiswa.pelanggar}
              </span>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 shadow-xs">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">
                Total Pelanggaran
              </span>
              <span className="text-xl font-black text-amber-800">
                {statsSiswa.totalPelanggaran}
              </span>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3 shadow-xs">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">
                Pengaduan Siswa
              </span>
              <span className="text-xl font-black text-blue-800">
                {statsSiswa.pengaduan}
              </span>
            </div>
          </div>

          {/* PANEL MULTI-FILTER LENGKAP: NO, NAMA, KELAS, ID SISWA, PELANGGARAN */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-1.5">
                <span>🔍</span>
                <span>Filter Pencarian Data Siswa</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setFilterKelas("SEMUA");
                    setFilterNamaSiswa("");
                    setFilterIdSiswa("");
                    setFilterPelanggaran("SEMUA");
                  }}
                  className="text-[11px] text-rose-600 hover:underline font-bold"
                >
                  Reset Semua Filter
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
              {/* 1. FILTER KELAS */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Kelas
                </label>
                <select
                  value={filterKelas}
                  onChange={(e) => setFilterKelas(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="SEMUA">-- Semua Kelas ({daftarSiswa.length}) --</option>
                  {uniqueKelasList.map((k) => (
                    <option key={k} value={k}>Kelas {k}</option>
                  ))}
                </select>
              </div>

              {/* 2. FILTER NAMA SISWA */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Nama Siswa
                </label>
                <input
                  type="text"
                  value={filterNamaSiswa}
                  onChange={(e) => setFilterNamaSiswa(e.target.value)}
                  placeholder="Ketik nama siswa..."
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              {/* 3. FILTER ID SISWA */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  ID Siswa
                </label>
                <input
                  type="text"
                  value={filterIdSiswa}
                  onChange={(e) => setFilterIdSiswa(e.target.value)}
                  placeholder="Ketik ID siswa..."
                  className="w-full rounded-xl border border-slate-300 px-2.5 py-1.5 text-xs font-mono font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              {/* 4. FILTER STATUS PELANGGARAN */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Pelanggaran
                </label>
                <select
                  value={filterPelanggaran}
                  onChange={(e) => setFilterPelanggaran(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                >
                  <option value="SEMUA">Semua Status</option>
                  <option value="MELANGGAR">⚠️ Melanggar Saja (&gt; 0)</option>
                  <option value="BERSIH">✓ Bersih (0 Pelanggaran)</option>
                  <option value="TERBANYAK">🔥 Urut Pelanggaran Terbanyak</option>
                </select>
              </div>

              {/* 5. URUTAN & BARIS PER HALAMAN */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  Tampilkan / Halaman
                </label>
                <div className="flex gap-1.5">
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value={50}>50 Baris</option>
                    <option value={100}>100 Baris</option>
                    <option value={250}>250 Baris</option>
                    <option value={9999}>Semua Ribuan</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="rounded-xl border border-slate-300 px-2 py-1.5 text-xs font-bold bg-slate-50 hover:bg-slate-100 shrink-0"
                    title="Ubah urutan"
                  >
                    {sortOrder === "asc" ? "🔼" : "🔽"}
                  </button>
                </div>
              </div>
            </div>

            {/* TOMBOL AKSI MASSAL KELAS */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <span className="text-[11px] text-slate-500 font-medium">
                Ditemukan <b>{filteredSiswa.length}</b> siswa
                {filterKelas !== "SEMUA" && ` pada kelas ${filterKelas}`}.
              </span>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={handleResetPelanggaranMassal}
                  disabled={actionLoading || statsSiswa.totalPelanggaran === 0}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 text-xs font-black transition-all shadow-xs active:scale-95 disabled:opacity-50"
                >
                  0️⃣ Reset Pelanggaran Terfilter
                </button>

                <button
                  onClick={() => {
                    setTargetPesan({ tipe: "kelas", kelas: filterKelas, nama: "" });
                    setShowPesanModal(true);
                  }}
                  disabled={actionLoading}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-xs font-black transition-all shadow-xs active:scale-95"
                >
                  💬 Broadcast Pesan ({filterKelas})
                </button>

                <button
                  onClick={() => {
                    setTargetPesan({ tipe: "kelas", kelas: filterKelas, nama: "" });
                    setPesanInput("UJIAN DI RESET");
                    setShowPesanModal(true);
                  }}
                  disabled={actionLoading}
                  className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 text-xs font-black transition-all shadow-xs active:scale-95"
                >
                  ⚠️ Reset Ujian ({filterKelas})
                </button>
              </div>
            </div>
          </div>

          {/* TABEL DATABASE SISWA (RESPONSIF, PADAT & WARNA OTOMATIS PER KELAS) */}
          {loadingSiswa ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 gap-2">
              <span className="text-3xl animate-spin">⏳</span>
              <p className="text-xs font-bold">Memuat database siswa asesmen...</p>
            </div>
          ) : filteredSiswa.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-slate-200 text-slate-400 gap-2">
              <span className="text-3xl">📋</span>
              <p className="text-xs font-bold">Tidak ada siswa yang sesuai dengan filter.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm max-h-[65vh] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-[11px] font-black uppercase text-slate-700 border-b border-slate-200 sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="px-2.5 py-2 text-center w-12">No</th>
                      <th className="px-2.5 py-2">Nama Siswa</th>
                      <th className="px-2.5 py-2">Kelas</th>
                      <th className="px-2.5 py-2">ID Siswa</th>
                      <th className="px-2.5 py-2 text-center">Pelanggaran</th>
                      <th className="px-2.5 py-2">Pesan Aktif</th>
                      <th className="px-2.5 py-2">Pengaduan</th>
                      <th className="px-2.5 py-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedSiswa.map((s, idx) => {
                      const nomorUrut = (currentPage - 1) * pageSize + idx + 1;
                      const warna = getWarnaKelas(s.kelas);
                      const isMelanggar = s.pelanggaran > 0;

                      return (
                        <tr
                          key={s.id_siswa || idx}
                          className={`transition-colors border-l-4 ${warna.border} ${warna.bg} ${
                            isMelanggar ? "!bg-rose-100/90 ring-1 ring-rose-400" : ""
                          }`}
                        >
                          <td className="px-2.5 py-1.5 text-center font-bold text-slate-500">
                            {nomorUrut}
                          </td>
                          <td className="px-2.5 py-1.5 font-bold text-slate-900 leading-tight">
                            {s.nama || "-"}
                          </td>
                          <td className="px-2.5 py-1.5 font-black whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${warna.badge}`}>
                              {s.kelas || "-"}
                            </span>
                          </td>
                          <td className="px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                            {s.id_siswa || "-"}
                          </td>
                          <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                            {isMelanggar ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-2xs">
                                ⚠️ {s.pelanggaran}x
                              </span>
                            ) : (
                              <span className="inline-block rounded-full bg-emerald-100/80 px-2 py-0.5 text-[9px] font-bold text-emerald-800 border border-emerald-200">
                                ✓ 0
                              </span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {s.pesan ? (
                              <span
                                className="inline-block max-w-[140px] truncate rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300"
                                title={s.pesan}
                              >
                                💬 {s.pesan}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5">
                            {s.pengaduan ? (
                              <span
                                className="inline-block max-w-[140px] truncate rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800 border border-blue-200"
                                title={s.pengaduan}
                              >
                                📢 {s.pengaduan}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="px-2.5 py-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleResetPelanggaranSiswa(s)}
                                disabled={actionLoading || s.pelanggaran === 0}
                                className="rounded bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 text-[10px] font-bold transition-all disabled:opacity-30 shadow-2xs"
                                title="Reset pelanggaran siswa ke 0"
                              >
                                0
                              </button>
                              <button
                                onClick={() => {
                                  setTargetPesan({
                                    tipe: "siswa",
                                    kelas: s.kelas,
                                    nama: s.nama,
                                  });
                                  setShowPesanModal(true);
                                }}
                                className="rounded bg-blue-600 hover:bg-blue-700 text-white px-2 py-0.5 text-[10px] font-bold transition-all shadow-2xs"
                                title="Kirim pesan ke siswa ini"
                              >
                                Pesan
                              </button>
                              {isAdminAsesmen && (
                                <button
                                  onClick={() => handleHapusAkunSiswa(s)}
                                  disabled={actionLoading}
                                  className="rounded bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-1.5 py-0.5 text-[10px] font-bold transition-all"
                                  title="Hapus akun siswa (ID tetap tersimpan)"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CONTROLLER */}
              {pageSize < 9999 && totalPages > 1 && (
                <div className="flex items-center justify-between bg-white px-4 py-2.5 rounded-2xl border border-slate-200 text-xs">
                  <span className="text-slate-500 font-medium">
                    Halaman <b>{currentPage}</b> dari <b>{totalPages}</b> (Total {filteredSiswa.length} Siswa)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 rounded-lg border text-xs font-bold disabled:opacity-40 hover:bg-slate-50"
                    >
                      ◀ Sebelumnya
                    </button>
                    <span className="px-2 font-bold text-slate-700">{currentPage}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 rounded-lg border text-xs font-bold disabled:opacity-40 hover:bg-slate-50"
                    >
                      Berikutnya ▶
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: TAMBAH SESI UJIAN BARU                          */}
      {/* ======================================================== */}
      {modalTambahOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>➕</span>
                  <span>Tambah Sesi Ujian Baru</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Pembuat: <b>{user?.nama || "Guru"}</b> •{" "}
                  {isAdminAsesmen
                    ? "Mode Admin (Bisa pilih kelas apa saja)"
                    : "Hanya kelas & mapel yang Anda ajar"}
                </p>
              </div>
              <button
                onClick={() => setModalTambahOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitTambah} className="space-y-3.5">
              {/* DROPDOWN PILIHAN MAPEL GURU */}
              {!isAdminAsesmen ? (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Pilih Kelas & Mapel Anda <span className="text-rose-500">*</span>
                  </label>
                  {opsiMapelGuru.length > 0 ? (
                    <select
                      value={selectedMapelOption}
                      onChange={(e) => {
                        setSelectedMapelOption(e.target.value);
                        if (e.target.value) {
                          const [k, ...rest] = e.target.value.split("||");
                          const m = rest.join("||");
                          setFormTambah((prev) => ({
                            ...prev,
                            kelas: (k || "").trim().toUpperCase(),
                            mapel: (m || "").trim().toUpperCase(),
                          }));
                        } else {
                          setFormTambah((prev) => ({
                            ...prev,
                            kelas: "",
                            mapel: "",
                          }));
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 bg-white"
                      required
                    >
                      <option value="">-- Pilih dari Mapel yang Anda Ajar --</option>
                      {opsiMapelGuru.map((op, i) => (
                        <option key={i} value={`${op.kelas}||${op.namaMapel}`}>
                          📌 Kelas {op.kelas} — {op.namaMapel}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-200">
                      ⚠️ Anda belum memiliki daftar mapel yang dibuat. Buat mapel terlebih dahulu di portal Guru Mapel.
                    </p>
                  )}
                  <p className="text-[10px] text-slate-400 mt-1">
                    * Terkunci otomatis sesuai kelas & mata pelajaran yang Anda ajar.
                  </p>
                </div>
              ) : null}

              {/* TAMPILAN KELAS & MAPEL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Kelas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTambah.kelas}
                    readOnly={!isAdminAsesmen}
                    onChange={(e) =>
                      setFormTambah({ ...formTambah, kelas: e.target.value.toUpperCase() })
                    }
                    placeholder="Pilih dari dropdown di atas"
                    className={`w-full rounded-xl border p-2.5 text-xs font-bold outline-none ${
                      !isAdminAsesmen
                        ? "bg-slate-100 text-slate-700 border-slate-200 cursor-not-allowed"
                        : "bg-white text-slate-800 border-slate-300 focus:border-blue-500"
                    }`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formTambah.mapel}
                    readOnly={!isAdminAsesmen}
                    onChange={(e) =>
                      setFormTambah({ ...formTambah, mapel: e.target.value.toUpperCase() })
                    }
                    placeholder="Pilih dari dropdown di atas"
                    className={`w-full rounded-xl border p-2.5 text-xs font-bold outline-none ${
                      !isAdminAsesmen
                        ? "bg-slate-100 text-slate-700 border-slate-200 cursor-not-allowed"
                        : "bg-white text-slate-800 border-slate-300 focus:border-blue-500"
                    }`}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Token Masuk Ujian
                  </label>
                  <input
                    type="text"
                    value={formTambah.token}
                    onChange={(e) =>
                      setFormTambah({ ...formTambah, token: e.target.value })
                    }
                    placeholder="Contoh: 1234"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold font-mono text-emerald-700 outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Kode Kirim Jawaban
                  </label>
                  <input
                    type="text"
                    value={formTambah.kodeKirim}
                    onChange={(e) =>
                      setFormTambah({ ...formTambah, kodeKirim: e.target.value })
                    }
                    placeholder="Contoh: 8888"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold font-mono text-amber-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Link Google Form Ujian
                </label>
                <input
                  type="url"
                  value={formTambah.link}
                  onChange={(e) =>
                    setFormTambah({ ...formTambah, link: e.target.value })
                  }
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t">
                <button
                  type="submit"
                  disabled={actionLoading || (!isAdminAsesmen && (!formTambah.kelas || !formTambah.mapel))}
                  className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black py-2.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? "Menyimpan..." : "➕ Simpan ke Sheet UJIAN"}
                </button>
                <button
                  type="button"
                  onClick={() => setModalTambahOpen(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: EDIT SESI UJIAN (HANYA UPDATE BARIS LAMA)       */}
      {/* ======================================================== */}
      {modalEditOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-amber-300">
            <div className="flex items-center justify-between pb-3 border-b border-amber-100 mb-4 bg-amber-50/70 -mx-6 -mt-6 p-5 rounded-t-3xl border-b">
              <div>
                <h3 className="text-base font-black text-amber-950 flex items-center gap-2">
                  <span>✏️</span>
                  <span>Edit Ujian: Baris #{formEdit.rowIndex}</span>
                </h3>
                <p className="text-[11px] text-amber-800">
                  Data pada baris <b>#{formEdit.rowIndex}</b> akan diperbarui di spreadsheet (tidak menambah baris baru).
                </p>
              </div>
              <button
                onClick={() => setModalEditOpen(false)}
                className="text-amber-800 hover:text-amber-950 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-3.5 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Kelas <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formEdit.kelas}
                    onChange={(e) =>
                      setFormEdit({ ...formEdit, kelas: e.target.value.toUpperCase() })
                    }
                    placeholder="Contoh: X TJKT 1"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Mata Pelajaran <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formEdit.mapel}
                    onChange={(e) =>
                      setFormEdit({ ...formEdit, mapel: e.target.value.toUpperCase() })
                    }
                    placeholder="Contoh: K5-PKPJ"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-800 outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Token Masuk Ujian
                  </label>
                  <input
                    type="text"
                    value={formEdit.token}
                    onChange={(e) =>
                      setFormEdit({ ...formEdit, token: e.target.value })
                    }
                    placeholder="Contoh: 1234"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold font-mono text-emerald-700 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Kode Kirim Jawaban
                  </label>
                  <input
                    type="text"
                    value={formEdit.kodeKirim}
                    onChange={(e) =>
                      setFormEdit({ ...formEdit, kodeKirim: e.target.value })
                    }
                    placeholder="Contoh: 8888"
                    className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold font-mono text-amber-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Link Google Form Ujian
                </label>
                <input
                  type="url"
                  value={formEdit.link}
                  onChange={(e) =>
                    setFormEdit({ ...formEdit, link: e.target.value })
                  }
                  placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-3 border-t">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 text-white text-xs font-black py-2.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? "Menyimpan Perubahan..." : `💾 Simpan Perubahan Baris #${formEdit.rowIndex}`}
                </button>
                <button
                  type="button"
                  onClick={() => setModalEditOpen(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: INPUT KODE KHUSUS ADMIN ASESMEN (PIN: 4321)     */}
      {/* ======================================================== */}
      {showModalPin && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-amber-300 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl border border-amber-200 mb-3">
              🔑
            </div>
            <h4 className="text-base font-black text-slate-900">
              Kode Khusus Admin Asesmen
            </h4>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Masukkan kode khusus pengelola ujian untuk membuka izin penuh mengedit & menghapus seluruh sesi ujian.
            </p>

            {pinError && (
              <div className="mb-3 rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs font-bold text-rose-700">
                ⚠️ {pinError}
              </div>
            )}

            <form onSubmit={handleVerifyPin} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                placeholder="Masukkan Kode (Contoh: 4321)"
                className="w-full text-center tracking-widest text-lg font-black rounded-xl border border-slate-300 py-3 text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                autoFocus
                required
              />

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={actionLoading || !inputPin.trim()}
                  className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 text-xs font-black py-2.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                >
                  {actionLoading ? "Memverifikasi..." : "Verifikasi Kode"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModalPin(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-3 transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: KIRIM PESAN UJIAN                               */}
      {/* ======================================================== */}
      {showPesanModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <h4 className="text-sm font-black text-slate-900 mb-1">
              💬 Kirim Pesan / Reset Ujian
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {targetPesan.tipe === "siswa"
                ? `Penerima: ${targetPesan.nama} (${targetPesan.kelas})`
                : targetPesan.kelas === "SEMUA"
                ? "Penerima: SELURUH SISWA DI SEMUA KELAS"
                : `Penerima: SEMUA SISWA KELAS ${targetPesan.kelas}`}
            </p>

            <form onSubmit={handleKirimPesanSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Isi Pesan
                </label>
                <textarea
                  value={pesanInput}
                  onChange={(e) => setPesanInput(e.target.value)}
                  placeholder="Ketik pesan arahan..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Template Cepat */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Opsi Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPesanInput("Fokus pada soal ujian Anda!")}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-700 font-semibold"
                  >
                    Fokus soal
                  </button>
                  <button
                    type="button"
                    onClick={() => setPesanInput("Sisa waktu 15 menit lagi.")}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-700 font-semibold"
                  >
                    Sisa 15 menit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPesanInput("UJIAN DI RESET")}
                    className="text-[10px] bg-rose-100 hover:bg-rose-200 px-2 py-1 rounded-md text-rose-800 font-bold"
                  >
                    UJIAN DI RESET
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <button
                  type="submit"
                  disabled={actionLoading || !pesanInput.trim()}
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 transition-all disabled:opacity-50"
                >
                  {actionLoading ? "Mengirim..." : "Kirim Pesan"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPesanModal(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
