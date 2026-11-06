"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  fetchSemuaSiswaAsesmen,
  resetPelanggaranSiswa,
  resetDeviceSiswa,
  kirimPesanUjian,
  hapusPesanUjian,
  hapusAkunSiswaAsesmen,
  fetchDaftarUjian,
  tambahDataUjian,
  editDataUjian,
  hapusDataUjian,
} from "@/services/guruAsesmenService";

// Generator palet warna dinamis per kelas
const PALET_KELAS = [
  { border: "border-l-emerald-500", bg: "bg-emerald-50/40", badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  { border: "border-l-sky-500", bg: "bg-sky-50/40", badge: "bg-sky-100 text-sky-800 border-sky-300" },
  { border: "border-l-amber-500", bg: "bg-amber-50/40", badge: "bg-amber-100 text-amber-900 border-amber-300" },
  { border: "border-l-fuchsia-500", bg: "bg-fuchsia-50/40", badge: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300" },
  { border: "border-l-indigo-500", bg: "bg-indigo-50/40", badge: "bg-indigo-100 text-indigo-800 border-indigo-300" },
  { border: "border-l-rose-500", bg: "bg-rose-50/40", badge: "bg-rose-100 text-rose-800 border-rose-300" },
  { border: "border-l-teal-500", bg: "bg-teal-50/40", badge: "bg-teal-100 text-teal-800 border-teal-300" },
  { border: "border-l-violet-500", bg: "bg-violet-50/40", badge: "bg-violet-100 text-violet-800 border-violet-300" },
  { border: "border-l-orange-500", bg: "bg-orange-50/40", badge: "bg-orange-100 text-orange-900 border-orange-300" },
  { border: "border-l-lime-500", bg: "bg-lime-50/40", badge: "bg-lime-100 text-lime-800 border-lime-300" },
  { border: "border-l-cyan-500", bg: "bg-cyan-50/40", badge: "bg-cyan-100 text-cyan-800 border-cyan-300" },
  { border: "border-l-pink-500", bg: "bg-pink-50/40", badge: "bg-pink-100 text-pink-800 border-pink-300" },
];

function getWarnaKelas(namaKelas) {
  if (!namaKelas) return PALET_KELAS[0];
  let hash = 0;
  const str = String(namaKelas).trim().toUpperCase();
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % PALET_KELAS.length;
  return PALET_KELAS[idx];
}

export default function ModalPantauAsesmenKelas({
  isOpen,
  onClose,
  kelasTarget,
  namaMapel,
  user,
}) {
  const [siswaList, setSiswaList] = useState([]);
  const [daftarUjian, setDaftarUjian] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [suksesMsg, setSuksesMsg] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Filter State (Lengkap seperti di TabKelolaUjian)
  const [searchNama, setSearchNama] = useState("");
  const [searchId, setSearchId] = useState("");
  const [filterPelanggaran, setFilterPelanggaran] = useState("SEMUA"); // SEMUA, MELANGGAR, BERSIH, TERBANYAK
  const [sortOrder, setSortOrder] = useState("asc"); // asc / desc

  // Form Sesi Ujian di Modal ini
  const [showFormUjian, setShowFormUjian] = useState(false);
  const [isEditUjian, setIsEditUjian] = useState(false);
  const [formUjian, setFormUjian] = useState({
    rowIndex: null,
    kelasLama: "",
    mapelLama: "",
    kelas: "",
    mapel: "",
    token: "",
    link: "",
    kodeKirim: "",
  });

  // Modal input pesan custom
  const [showPesanModal, setShowPesanModal] = useState(false);
  const [pesanInput, setPesanInput] = useState("");
  const [targetSiswaPesan, setTargetSiswaPesan] = useState(null); // null = sekelas

  const muatData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const [resSiswa, resUjian] = await Promise.all([
        fetchSemuaSiswaAsesmen(),
        fetchDaftarUjian(),
      ]);

      if (resSiswa.status === "success" && Array.isArray(resSiswa.data)) {
        setSiswaList(resSiswa.data);
      } else {
        setErrorMsg(resSiswa.message || "Gagal memuat database siswa");
      }

      if (resUjian.status === "success" && Array.isArray(resUjian.data)) {
        setDaftarUjian(resUjian.data);
      }
    } catch (err) {
      setErrorMsg("Koneksi gagal: " + err.message);
    } finally {
      setLoading(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        muatData();
        setPesanInput("");
        setSuksesMsg("");
        setErrorMsg("");
        setShowFormUjian(false);
        setSearchNama("");
        setSearchId("");
        setFilterPelanggaran("SEMUA");
        setSortOrder("asc");
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, muatData]);

  // Sesi Ujian yang sesuai kelas & mapel target
  const sesiUjianAktif = useMemo(() => {
    if (!kelasTarget || !namaMapel) return null;
    const kTarget = kelasTarget.toString().trim().toUpperCase();
    const mTarget = namaMapel.toString().trim().toUpperCase();

    // Prioritas 1: Kelas dan Mapel cocok persis
    let found = daftarUjian.find((u) => {
      const kSheet = (u.kls || "").toString().trim().toUpperCase();
      const mSheet = (u.mpl || "").toString().trim().toUpperCase();
      return kSheet === kTarget && mSheet === mTarget;
    });

    // Prioritas 2: Kelas cocok dan nama mapel mengandung kata kunci
    if (!found) {
      found = daftarUjian.find((u) => {
        const kSheet = (u.kls || "").toString().trim().toUpperCase();
        const mSheet = (u.mpl || "").toString().trim().toUpperCase();
        return (
          kSheet === kTarget &&
          (mSheet.includes(mTarget) || mTarget.includes(mSheet))
        );
      });
    }

    return found || null;
  }, [daftarUjian, kelasTarget, namaMapel]);

  // Filter siswa yang sesuai kelas target
  const siswaKelas = useMemo(() => {
    if (!kelasTarget) return [];
    const kTargetClean = kelasTarget.toString().trim().toUpperCase();
    return siswaList.filter((s) => {
      const kSheet = (s.kelas || "").toString().trim().toUpperCase();
      return kSheet === kTargetClean;
    });
  }, [siswaList, kelasTarget]);

  // Filter dan Sort Siswa Berdasarkan Nama, ID, Pelanggaran, dan Urutan
  const siswaFiltered = useMemo(() => {
    let result = [...siswaKelas];

    // Filter Nama Siswa
    if (searchNama.trim()) {
      const q = searchNama.toLowerCase();
      result = result.filter((s) =>
        (s.nama || "").toLowerCase().includes(q)
      );
    }

    // Filter ID Siswa
    if (searchId.trim()) {
      const q = searchId.toLowerCase();
      result = result.filter((s) =>
        (s.id_siswa || "").toLowerCase().includes(q)
      );
    }

    // Filter Status Pelanggaran
    if (filterPelanggaran === "MELANGGAR") {
      result = result.filter((s) => (s.pelanggaran || 0) > 0);
    } else if (filterPelanggaran === "BERSIH") {
      result = result.filter((s) => (s.pelanggaran || 0) === 0);
    } else if (filterPelanggaran === "TERBANYAK") {
      result.sort((a, b) => (b.pelanggaran || 0) - (a.pelanggaran || 0));
      return result;
    }

    // Sort Urutan Nomor / ID
    if (sortOrder === "desc") {
      result.reverse();
    }

    return result;
  }, [siswaKelas, searchNama, searchId, filterPelanggaran, sortOrder]);

  // Statistik Kelas
  const stats = useMemo(() => {
    const total = siswaKelas.length;
    let adaPelanggaran = 0;
    let totalPelanggaran = 0;
    let adaPengaduan = 0;

    siswaKelas.forEach((s) => {
      if (s.pelanggaran > 0) {
        adaPelanggaran++;
        totalPelanggaran += s.pelanggaran;
      }
      if (s.pengaduan) adaPengaduan++;
    });

    return { total, adaPelanggaran, totalPelanggaran, adaPengaduan };
  }, [siswaKelas]);

  // Buka Form Buat Ujian Baru untuk Kelas & Mapel ini
  const handleOpenBuatUjian = () => {
    setIsEditUjian(false);
    setFormUjian({
      rowIndex: null,
      kelasLama: "",
      mapelLama: "",
      kelas: (kelasTarget || "").toUpperCase(),
      mapel: (namaMapel || "").toUpperCase(),
      token: "",
      link: "",
      kodeKirim: "",
    });
    setShowFormUjian(true);
  };

  // Buka Form Edit Ujian untuk Sesi ini
  const handleOpenEditSesiUjian = () => {
    if (!sesiUjianAktif) return;
    setIsEditUjian(true);
    setFormUjian({
      rowIndex: sesiUjianAktif.rowIndex || null,
      kelasLama: sesiUjianAktif.kls,
      mapelLama: sesiUjianAktif.mpl,
      kelas: sesiUjianAktif.kls,
      mapel: sesiUjianAktif.mpl,
      token: sesiUjianAktif.token || "",
      link: sesiUjianAktif.link || "",
      kodeKirim: sesiUjianAktif.kodeKirim || "",
    });
    setShowFormUjian(true);
  };

  // Simpan Form Sesi Ujian (Mengunci rowIndex agar tidak membuat baris baru)
  const handleSimpanSesiUjian = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMsg("");
    try {
      if (isEditUjian) {
        const res = await editDataUjian({
          ...formUjian,
          id_guru: user?.id || "",
          nama_guru: user?.nama || "Guru",
        });
        if (res.status === "success") {
          setSuksesMsg(res.message || "Sesi ujian berhasil diperbarui!");
          setShowFormUjian(false);
          muatData();
        } else {
          setErrorMsg(res.message || "Gagal memperbarui ujian");
        }
      } else {
        const res = await tambahDataUjian({
          ...formUjian,
          id_guru: user?.id || "",
          nama_guru: user?.nama || "Guru",
        });
        if (res.status === "success") {
          setSuksesMsg(res.message || "Sesi ujian berhasil dibuat!");
          setShowFormUjian(false);
          muatData();
        } else {
          setErrorMsg(res.message || "Gagal membuat ujian");
        }
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Hapus Sesi Ujian
  const handleHapusSesiUjian = async () => {
    if (!sesiUjianAktif) return;
    if (
      !confirm(
        `Hapus sesi ujian ${sesiUjianAktif.kls} - ${sesiUjianAktif.mpl}?\nSiswa tidak akan dapat masuk menggunakan token ini lagi.`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await hapusDataUjian({
        rowIndex: sesiUjianAktif.rowIndex,
        kelas: sesiUjianAktif.kls,
        mapel: sesiUjianAktif.mpl,
        id_guru: user?.id || "",
        nama_guru: user?.nama || "Guru",
      });
      if (res.status === "success") {
        setSuksesMsg(res.message || "Sesi ujian berhasil dihapus");
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal menghapus ujian");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Aksi Reset Pelanggaran 1 Siswa
  const handleResetPelanggaranSiswa = async (siswa) => {
    if (
      !confirm(
        `Reset pelanggaran untuk ${siswa.nama || siswa.id_siswa} menjadi 0?`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await resetPelanggaranSiswa({
        id_siswa: siswa.id_siswa,
        nama: siswa.nama,
        kelas: kelasTarget,
        id_guru: user?.id || "",
      });
      if (res.status === "success") {
        setSuksesMsg(`Pelanggaran ${siswa.nama} berhasil direset!`);
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal mereset pelanggaran");
      }
    } catch (e) {
      setErrorMsg("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Aksi Reset Perangkat HP Siswa (Mengizinkan ganti HP)
  const handleResetDeviceSiswa = async (siswa) => {
    if (
      !confirm(
        `Reset sesi perangkat untuk ${siswa.nama || siswa.id_siswa}?\nSiswa akan diizinkan login di HP/perangkat baru.`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await resetDeviceSiswa({
        id_siswa: siswa.id_siswa,
        nama: siswa.nama,
        kelas: kelasTarget,
        id_guru: user?.id || "",
      });
      if (res.status === "success") {
        setSuksesMsg(`Perangkat ${siswa.nama} berhasil direset! Siswa dapat login di HP baru.`);
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal mereset perangkat");
      }
    } catch (e) {
      setErrorMsg("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Aksi Reset Pelanggaran Sekelas
  const handleResetPelanggaranSekelas = async () => {
    if (
      !confirm(
        `Yakin ingin mereset SEMUA pelanggaran siswa kelas ${kelasTarget} menjadi 0?`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await resetPelanggaranSiswa({
        kelas: kelasTarget,
        id_guru: user?.id || "",
      });
      if (res.status === "success") {
        setSuksesMsg(res.message || "Semua pelanggaran kelas berhasil direset!");
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal mereset");
      }
    } catch (e) {
      setErrorMsg("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Aksi Hapus Total Baris Siswa dari Spreadsheet
  const handleHapusAkunSiswa = async (siswa) => {
    const konfirmasi = confirm(
      `⚠️ HAPUS TOTAL BARIS SISWA:\n\nApakah Anda yakin ingin menghapus seluruh baris data siswa "${siswa.nama}" (ID: ${siswa.id_siswa})?\n\n- Seluruh baris nama dan data siswa akan DIHAPUS TOTAL dari spreadsheet database.\n- Tindakan ini berlaku permanen untuk siswa kelas ${kelasTarget}.`
    );
    if (!konfirmasi) return;

    setActionLoading(true);
    setErrorMsg("");
    try {
      const res = await hapusAkunSiswaAsesmen(
        siswa.id_siswa,
        "",
        siswa.nama,
        kelasTarget
      );
      if (res.status === "success") {
        setSuksesMsg(
          `Baris data siswa "${siswa.nama}" berhasil dihapus total dari database!`
        );
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal menghapus baris siswa");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Aksi Cepat: UJIAN DI RESET
  const handleResetUjianSekelas = async () => {
    const konfirmasi = confirm(
      `⚠️ PERINGATAN KERAS:\n\nApakah Anda yakin ingin mengirim pesan "UJIAN DI RESET" ke seluruh siswa kelas ${kelasTarget}?\n\nSemua siswa kelas ini yang sedang membuka ujian di web atau HP akan OTOMATIS KELUAR dari halaman ujian dan diarahkan kembali ke form login/nama!`
    );
    if (!konfirmasi) return;

    setActionLoading(true);
    try {
      const res = await kirimPesanUjian({
        kelas: kelasTarget,
        pesan: "UJIAN DI RESET",
        id_guru: user?.id || "",
      });
      if (res.status === "success") {
        setSuksesMsg(
          `Perintah UJIAN DI RESET berhasil dikirim ke kelas ${kelasTarget}!`
        );
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal mengirim perintah reset");
      }
    } catch (e) {
      setErrorMsg("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Bersihkan Pesan Sekelas
  const handleHapusPesanSekelas = async () => {
    if (
      !confirm(
        `Bersihkan pesan ujian untuk semua siswa di kelas ${kelasTarget}?`
      )
    )
      return;

    setActionLoading(true);
    try {
      const res = await hapusPesanUjian({
        kelas: kelasTarget,
        id_guru: user?.id || "",
      });
      if (res.status === "success") {
        setSuksesMsg("Pesan kelas berhasil dibersihkan!");
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal menghapus pesan");
      }
    } catch (e) {
      setErrorMsg("Error: " + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Kirim Pesan Custom
  const handleKirimPesanCustom = async (e) => {
    e.preventDefault();
    if (!pesanInput.trim()) return;

    setActionLoading(true);
    try {
      const res = await kirimPesanUjian({
        kelas: kelasTarget,
        nama: targetSiswaPesan ? targetSiswaPesan.nama : "",
        pesan: pesanInput.trim(),
        id_guru: user?.id || "",
      });
      if (res.status === "success") {
        setSuksesMsg("Pesan berhasil dikirim!");
        setShowPesanModal(false);
        setPesanInput("");
        setTargetSiswaPesan(null);
        muatData();
      } else {
        setErrorMsg(res.message || "Gagal mengirim pesan");
      }
    } catch (err) {
      setErrorMsg("Error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const warnaKelasObj = getWarnaKelas(kelasTarget);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-2 sm:p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative flex max-h-[95vh] w-full max-w-5xl flex-col rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* HEADER MODAL */}
        <div className="flex items-center justify-between border-b border-blue-900/30 bg-gradient-to-r from-blue-950 via-indigo-900 to-slate-900 px-3 py-2.5 sm:px-5 sm:py-4 text-white">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl bg-amber-400/20 text-base sm:text-xl border border-amber-300/40 shrink-0">
              🛡️
            </span>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h3 className="text-sm sm:text-lg font-black tracking-tight text-white leading-tight">
                  Pantau Asesmen & Ujian
                </h3>
                <span className={`rounded-lg px-2 py-0.5 text-[10px] sm:text-xs font-black border ${warnaKelasObj.badge}`}>
                  {kelasTarget || "KELAS"}
                </span>
                {namaMapel && (
                  <span className="rounded-lg bg-blue-500/20 px-2 py-0.5 text-[10px] sm:text-xs font-bold text-blue-200 border border-blue-400/30">
                    {namaMapel}
                  </span>
                )}
              </div>
              <p className="hidden sm:block text-xs text-blue-200">
                SMKN 1 Teluk Kuantan • Status Ujian & Monitoring Pelanggaran Siswa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all font-bold cursor-pointer text-xs sm:text-sm shrink-0"
          >
            ✕
          </button>
        </div>

        {/* ALERT STATUS */}
        {suksesMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 text-xs font-bold text-emerald-800 flex items-center justify-between animate-fadeIn">
            <span>✅ {suksesMsg}</span>
            <button
              onClick={() => setSuksesMsg("")}
              className="text-emerald-700 hover:text-emerald-900 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}
        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 text-xs font-bold text-rose-800 flex items-center justify-between animate-fadeIn">
            <span>⚠️ {errorMsg}</span>
            <button
              onClick={() => setErrorMsg("")}
              className="text-rose-700 hover:text-rose-900 font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* KARTU STATUS SESI UJIAN AKTIF KELAS & MAPEL INI           */}
        {/* ========================================================= */}
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/50 border-b border-amber-200/80 px-3 py-2 sm:px-5 sm:py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-[11px] sm:text-xs font-black uppercase text-amber-950 flex items-center gap-1">
                  <span>📑</span>
                  <span className="hidden sm:inline">Sesi Ujian Sheet UJIAN:</span>
                  <span className="sm:hidden">Sesi:</span>
                </span>
                {sesiUjianAktif ? (
                  <span className="rounded-full bg-emerald-600 text-white px-2 py-0.5 text-[9px] sm:text-[10px] font-black">
                    ✓ TERDAFTAR (#{sesiUjianAktif.rowIndex || "-"})
                  </span>
                ) : (
                  <span className="rounded-full bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold">
                    ✕ Belum Ada Sesi
                  </span>
                )}
              </div>

              {sesiUjianAktif ? (
                <div className="mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
                  <span className="font-bold text-slate-800">
                    Token:{" "}
                    <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300 text-emerald-800 font-black">
                      {sesiUjianAktif.token || "-"}
                    </b>
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="font-bold text-slate-800">
                    Kirim:{" "}
                    <b className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-300 text-amber-900 font-black">
                      {sesiUjianAktif.kodeKirim || "-"}
                    </b>
                  </span>
                  {sesiUjianAktif.link && (
                    <>
                      <span className="text-slate-400">•</span>
                      <a
                        href={sesiUjianAktif.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 underline font-bold hover:text-blue-900"
                      >
                        🔗 Buka Form
                      </a>
                    </>
                  )}
                  {sesiUjianAktif.guru && (
                    <>
                      <span className="hidden sm:inline text-slate-400">•</span>
                      <span className="hidden sm:inline text-[10px] text-slate-500 font-semibold truncate max-w-[150px]">
                        Pembuat: {sesiUjianAktif.guru}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-[11px] sm:text-xs text-amber-900 font-medium">
                  Belum ada sesi ujian di sheet UJIAN untuk kelas <b>{kelasTarget}</b> mapel <b>{namaMapel}</b>.
                </p>
              )}
            </div>

            {/* TOMBOL AKSI SESI UJIAN (KOMPAK & IKON DI HP) */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              {sesiUjianAktif ? (
                <>
                  <button
                    onClick={handleOpenEditSesiUjian}
                    disabled={actionLoading}
                    className="rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer flex items-center gap-1"
                    title="Edit Token / Link Ujian"
                  >
                    <span>✏️</span>
                    <span className="hidden sm:inline">Edit Token/Link</span>
                    <span className="sm:hidden">Edit</span>
                  </button>
                  <button
                    onClick={handleHapusSesiUjian}
                    disabled={actionLoading}
                    className="rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-2.5 py-1 sm:px-3 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    title="Hapus Sesi Ujian"
                  >
                    <span>🗑️</span>
                    <span className="hidden sm:inline">Hapus</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={handleOpenBuatUjian}
                  disabled={actionLoading}
                  className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white px-2.5 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-black shadow-xs transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                >
                  <span>➕</span>
                  <span className="hidden sm:inline">Buat Sesi Ujian untuk Kelas Ini</span>
                  <span className="sm:hidden">Buat Sesi</span>
                </button>
              )}
            </div>
          </div>

          {/* FORM INLINE BUAT / EDIT SESI UJIAN */}
          {showFormUjian && (
            <form
              onSubmit={handleSimpanSesiUjian}
              className="mt-3 rounded-2xl bg-white p-4 border border-amber-300 shadow-md space-y-3 animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b pb-2">
                <h4 className="text-xs font-black uppercase text-amber-950">
                  {isEditUjian
                    ? `✏️ Edit Sesi Ujian (Baris #${formUjian.rowIndex})`
                    : `➕ Buat Sesi Ujian Baru (${kelasTarget} - ${namaMapel})`}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowFormUjian(false)}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
                >
                  ✕ Batal
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                    Token Masuk Ujian
                  </label>
                  <input
                    type="text"
                    value={formUjian.token}
                    onChange={(e) =>
                      setFormUjian({ ...formUjian, token: e.target.value })
                    }
                    placeholder="Contoh: 1234"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-mono font-bold text-emerald-800 outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                    Kode Kirim Jawaban
                  </label>
                  <input
                    type="text"
                    value={formUjian.kodeKirim}
                    onChange={(e) =>
                      setFormUjian({ ...formUjian, kodeKirim: e.target.value })
                    }
                    placeholder="Contoh: 8888"
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-mono font-bold text-amber-900 outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-0.5">
                    Link Google Form Ujian
                  </label>
                  <input
                    type="url"
                    value={formUjian.link}
                    onChange={(e) =>
                      setFormUjian({ ...formUjian, link: e.target.value })
                    }
                    placeholder="https://docs.google.com/forms/d/..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-amber-950 px-4 py-1.5 text-xs font-black shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading
                    ? "Menyimpan..."
                    : isEditUjian
                    ? "💾 Simpan Perubahan"
                    : "💾 Simpan Sesi Ujian ke Sheet UJIAN"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowFormUjian(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
              </div>
            </form>
          )}
        </div>

        {/* STATISTIK & AKSI CEPAT KELAS */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 sm:px-5 sm:py-3 space-y-2 sm:space-y-2.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2.5">
            <div className="rounded-xl border border-slate-200 bg-white p-2 sm:p-2.5 shadow-2xs">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block truncate">
                Total Siswa
              </span>
              <span className="text-base sm:text-lg font-black text-slate-800">
                {stats.total}
              </span>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-2 sm:p-2.5 shadow-2xs">
              <span className="text-[9px] sm:text-[10px] font-bold text-rose-600 uppercase block truncate">
                Pelanggar
              </span>
              <span className="text-base sm:text-lg font-black text-rose-700">
                {stats.adaPelanggaran}
              </span>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-2 sm:p-2.5 shadow-2xs">
              <span className="text-[9px] sm:text-[10px] font-bold text-amber-700 uppercase block truncate">
                Melanggar
              </span>
              <span className="text-base sm:text-lg font-black text-amber-800">
                {stats.totalPelanggaran}
              </span>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-2 sm:p-2.5 shadow-2xs">
              <span className="text-[9px] sm:text-[10px] font-bold text-blue-700 uppercase block truncate">
                Pengaduan
              </span>
              <span className="text-base sm:text-lg font-black text-blue-800">
                {stats.adaPengaduan}
              </span>
            </div>
          </div>

          {/* TOMBOL AKSI CEPAT KELAS (PADAT & IKON PADA MOBILE) */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2 pt-0.5">
            <button
              onClick={muatData}
              disabled={loading || actionLoading}
              className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Refresh Data Siswa"
            >
              <span>🔄</span>
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              onClick={handleResetPelanggaranSekelas}
              disabled={actionLoading || stats.totalPelanggaran === 0}
              className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-black transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1"
              title="Reset Semua Pelanggaran Kelas ke 0"
            >
              <span>0️⃣</span>
              <span className="hidden sm:inline">Reset Pelanggaran Kelas</span>
              <span className="sm:hidden">Reset 0</span>
            </button>

            <button
              onClick={() => {
                setTargetSiswaPesan(null);
                setShowPesanModal(true);
              }}
              disabled={actionLoading}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-black transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
              title="Kirim Pesan ke Seluruh Siswa Kelas Ini"
            >
              <span>💬</span>
              <span className="hidden sm:inline">Kirim Pesan ke Kelas</span>
              <span className="sm:hidden">Pesan</span>
            </button>

            <button
              onClick={handleHapusPesanSekelas}
              disabled={actionLoading}
              className="rounded-xl bg-slate-600 hover:bg-slate-700 text-white px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold transition-all shadow-2xs active:scale-95 cursor-pointer flex items-center gap-1"
              title="Bersihkan Pesan Aktif di Kelas Ini"
            >
              <span>🧹</span>
              <span className="hidden sm:inline">Bersihkan Pesan</span>
              <span className="sm:hidden">Bersihkan</span>
            </button>

            <button
              onClick={handleResetUjianSekelas}
              disabled={actionLoading}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-black transition-all shadow-2xs active:scale-95 ml-auto cursor-pointer flex items-center gap-1"
              title="RESET UJIAN KELAS (Keluarkan Semua Siswa dari Ujian)"
            >
              <span>⚠️</span>
              <span className="hidden sm:inline">RESET UJIAN KELAS</span>
              <span className="sm:hidden">Reset Ujian</span>
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* BAR FILTER LENGKAP (KONSISTEN DENGAN KELOLA ASESMEN)       */}
        {/* ========================================================= */}
        <div className="p-3 bg-white border-b border-slate-200 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {/* Cari Nama Siswa */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                👤
              </span>
              <input
                type="text"
                value={searchNama}
                onChange={(e) => setSearchNama(e.target.value)}
                placeholder="Cari nama siswa..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 font-medium outline-none transition-all"
              />
            </div>

            {/* Cari ID Siswa */}
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                🔑
              </span>
              <input
                type="text"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="Cari ID / NISN siswa..."
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 font-mono font-medium outline-none transition-all"
              />
            </div>

            {/* Filter Status Pelanggaran */}
            <div className="relative">
              <select
                value={filterPelanggaran}
                onChange={(e) => setFilterPelanggaran(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 font-bold text-slate-700 outline-none transition-all cursor-pointer"
              >
                <option value="SEMUA">Filter: Semua Status</option>
                <option value="MELANGGAR">⚠️ Melanggar ({">"} 0)</option>
                <option value="BERSIH">✓ Bersih (0 Pelanggaran)</option>
                <option value="TERBANYAK">🔥 Urut Terbanyak</option>
              </select>
            </div>

            {/* Urutan No / ID */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="w-full flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-all cursor-pointer"
                title="Ganti urutan data"
              >
                <span>Urutan: {sortOrder === "asc" ? "⬆️ No. Awal" : "⬇️ No. Akhir"}</span>
              </button>
            </div>
          </div>

          {/* Info Hasil Filter */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
            <span>
              Menampilkan <b>{siswaFiltered.length}</b> dari <b>{siswaKelas.length}</b> siswa di kelas {kelasTarget}
            </span>
            {(searchNama || searchId || filterPelanggaran !== "SEMUA") && (
              <button
                onClick={() => {
                  setSearchNama("");
                  setSearchId("");
                  setFilterPelanggaran("SEMUA");
                  setSortOrder("asc");
                }}
                className="text-rose-600 hover:text-rose-800 font-bold underline cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* TABEL SISWA PADAT (COMPACT) DENGAN PEWARNAAN KELAS OTOMATIS */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <span className="text-3xl animate-spin">⏳</span>
              <p className="text-xs font-bold">Memuat database asesmen...</p>
            </div>
          ) : siswaFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
              <span className="text-4xl">📋</span>
              <p className="text-xs font-bold">
                {siswaKelas.length === 0
                  ? `Belum ada data siswa untuk kelas ${kelasTarget} di database asesmen.`
                  : "Tidak ada siswa yang cocok dengan filter pencarian."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-[10px] sm:text-[11px] font-black uppercase text-slate-700 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="px-2.5 py-2.5 text-center w-10">No</th>
                    <th className="px-2.5 py-2.5">Nama Siswa</th>
                    <th className="px-2.5 py-2.5 text-center">Kelas</th>
                    <th className="px-2.5 py-2.5">ID Siswa</th>
                    <th className="px-2.5 py-2.5 text-center">Pelanggaran</th>
                    <th className="px-2.5 py-2.5">Pesan Aktif</th>
                    <th className="px-2.5 py-2.5">Pengaduan Siswa</th>
                    <th className="px-2.5 py-2.5 text-center w-40">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {siswaFiltered.map((s, idx) => {
                    const isMelanggar = (s.pelanggaran || 0) > 0;
                    return (
                      <tr
                        key={s.id_siswa || idx}
                        className={`transition-colors border-l-4 ${
                          isMelanggar
                            ? "!bg-rose-100/90 ring-1 ring-rose-400 font-bold border-l-rose-600 text-rose-950"
                            : `${warnaKelasObj.bg} ${warnaKelasObj.border} hover:bg-slate-100/80`
                        }`}
                      >
                        <td className="px-2.5 py-2 text-center font-bold text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-2.5 py-2 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span>{s.nama || <span className="text-rose-500 italic">(Dihapus/Kosong)</span>}</span>
                            {s.status_sesi === "AKTIF" && s.device_id && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-teal-100 text-teal-800 border border-teal-300"
                                title={`Terkunci di HP (Mapel: ${s.mapel_aktif || "-"})`}
                              >
                                📱 Terkunci HP
                              </span>
                            )}
                            {s.status_sesi === "RESET" && (
                              <span
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-300"
                                title="Sesi perangkat telah direset oleh guru, siswa dapat login dari HP baru"
                              >
                                🔄 Boleh HP Baru
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[9px] font-black border ${warnaKelasObj.badge}`}
                          >
                            {s.kelas || kelasTarget}
                          </span>
                        </td>
                        <td className="px-2.5 py-2 font-mono text-[11px] text-slate-700 font-semibold">
                          {s.id_siswa || "-"}
                        </td>
                        <td className="px-2.5 py-2 text-center">
                          {isMelanggar ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-black text-white shadow-sm animate-pulse">
                              ⚠️ {s.pelanggaran}x
                            </span>
                          ) : (
                            <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                              ✓ Bersih (0)
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          {s.pesan ? (
                            <span
                              className="inline-block max-w-[150px] truncate rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200"
                              title={s.pesan}
                            >
                              💬 {s.pesan}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2">
                          {s.pengaduan ? (
                            <span
                              className="inline-block max-w-[160px] truncate rounded-lg bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800 border border-blue-200"
                              title={s.pengaduan}
                            >
                              📢 {s.pengaduan}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-1.5 sm:px-2.5 py-1.5 sm:py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Reset Perangkat HP */}
                            <button
                              type="button"
                              onClick={() => handleResetDeviceSiswa(s)}
                              disabled={actionLoading}
                              className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-1.5 py-1 sm:px-2 sm:py-1 text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-2xs flex items-center gap-0.5"
                              title="Reset sesi perangkat siswa ini agar bisa masuk di HP baru"
                            >
                              <span>📱</span>
                              <span className="hidden sm:inline">Reset HP</span>
                            </button>

                            {/* Reset 0 */}
                            <button
                              type="button"
                              onClick={() => handleResetPelanggaranSiswa(s)}
                              disabled={actionLoading || !isMelanggar}
                              className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-1.5 py-1 sm:px-2 sm:py-1 text-[10px] font-bold transition-all disabled:opacity-40 cursor-pointer shadow-2xs flex items-center gap-0.5"
                              title="Reset pelanggaran siswa ini ke 0"
                            >
                              <span>0️⃣</span>
                              <span className="hidden sm:inline">Reset 0</span>
                            </button>

                            {/* Kirim Pesan */}
                            <button
                              type="button"
                              onClick={() => {
                                setTargetSiswaPesan(s);
                                setShowPesanModal(true);
                              }}
                              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-1 sm:px-2 sm:py-1 text-[10px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-0.5"
                              title="Kirim pesan khusus ke siswa ini"
                            >
                              <span>💬</span>
                              <span className="hidden sm:inline">Pesan</span>
                            </button>

                            {/* Hapus Akun Siswa (Sesuai Rule Admin: Pertahankan ID) */}
                            <button
                              type="button"
                              onClick={() => handleHapusAkunSiswa(s)}
                              disabled={actionLoading}
                              className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-1.5 py-1 sm:px-2 sm:py-1 text-[10px] font-black transition-all cursor-pointer shadow-2xs flex items-center gap-0.5"
                              title="Hapus / Reset akun siswa ini (ID tetap tersimpan, nama & kelas dikosongkan untuk diisi kembali)"
                            >
                              <span>🗑️</span>
                              <span className="hidden sm:inline">Hapus</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3">
          <p className="text-[11px] text-slate-500">
            * Menghapus akun siswa akan mempertahankan ID siswa di database, dan mewajibkan siswa mengisi Nama & Kelas kembali saat masuk ujian.
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 text-xs font-bold transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* MODAL INPUT PESAN */}
      {showPesanModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl border border-slate-200">
            <h4 className="text-sm font-black text-slate-900 mb-1">
              💬 Kirim Pesan Ujian
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              {targetSiswaPesan
                ? `Penerima: ${targetSiswaPesan.nama} (${targetSiswaPesan.id_siswa})`
                : `Penerima: SEMUA SISWA KELAS ${kelasTarget}`}
            </p>

            <form onSubmit={handleKirimPesanCustom} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Isi Pesan
                </label>
                <textarea
                  value={pesanInput}
                  onChange={(e) => setPesanInput(e.target.value)}
                  placeholder="Contoh: Periksa kembali jawaban Anda, sisa waktu 15 menit."
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                  required
                />
              </div>

              {/* Template Cepat & Perintah Khusus */}
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] font-black text-amber-800 uppercase flex items-center gap-1">
                    <span>⚡</span> Perintah Otomatis Asesmen:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPesanInput("BUKA KUNCI")}
                      className="text-[10px] bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 text-emerald-900 font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Membuka kunci soal & timer selesai agar siswa bisa submit sekarang"
                    >
                      <span>🔓</span> BUKA KUNCI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPesanInput("HAPUS PELANGGARAN")}
                      className="text-[10px] bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Reset pelanggaran siswa jadi 0 & tutup layar hukuman 3 menit"
                    >
                      <span>0️⃣</span> HAPUS PELANGGARAN
                    </button>
                    <button
                      type="button"
                      onClick={() => setPesanInput("KUNCI SOAL")}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Kunci kembali formulir soal ujian siswa"
                    >
                      <span>🔒</span> KUNCI SOAL
                    </button>
                    <button
                      type="button"
                      onClick={() => setPesanInput("TAMBAH WAKTU 10")}
                      className="text-[10px] bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-900 font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Menambah 10 menit sisa waktu ujian siswa"
                    >
                      <span>⏱️</span> +10 MENIT
                    </button>
                    <button
                      type="button"
                      onClick={() => setPesanInput("TAMBAH WAKTU 5")}
                      className="text-[10px] bg-blue-100 hover:bg-blue-200 border border-blue-300 text-blue-900 font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Menambah 5 menit sisa waktu ujian siswa"
                    >
                      <span>⏱️</span> +5 MENIT
                    </button>
                    <button
                      type="button"
                      onClick={() => setPesanInput("UJIAN DI RESET")}
                      className="text-[10px] bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-900 font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                      title="Batalkan sesi ujian & keluarkan siswa ke halaman /exam"
                    >
                      <span>⚠️</span> UJIAN DI RESET
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    Pesan Arahan Biasa:
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPesanInput("Fokus pada soal ujian Anda!")}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-700 font-semibold cursor-pointer"
                    >
                      Fokus pada soal
                    </button>
                    <button
                      type="button"
                      onClick={() => setPesanInput("Sisa waktu 15 menit lagi.")}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-700 font-semibold cursor-pointer"
                    >
                      Sisa waktu 15 menit
                    </button>
                    <button
                      type="button"
                      onClick={() => setPesanInput("Periksa kembali jawaban Anda sebelum submit.")}
                      className="text-[10px] bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md text-slate-700 font-semibold cursor-pointer"
                    >
                      Periksa jawaban
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <button
                  type="submit"
                  disabled={actionLoading || !pesanInput.trim()}
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? "Mengirim..." : "Kirim Pesan"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPesanModal(false)}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2 px-4 transition-all cursor-pointer"
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
