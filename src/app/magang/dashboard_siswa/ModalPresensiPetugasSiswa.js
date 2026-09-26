"use client";

import { useState, useEffect, useMemo } from "react";
import { getPresensiWaliGrid, savePresensiWaliKelas } from "../lib/api";

const STATUS_OPTIONS = [
  {
    value: "Hadir",
    label: "Hadir",
    color: "bg-emerald-500 text-white border-emerald-600 ring-emerald-300",
  },
  {
    value: "Sakit",
    label: "Sakit",
    color: "bg-blue-600 text-white border-blue-700 ring-blue-300",
  },
  {
    value: "Izin",
    label: "Izin",
    color: "bg-amber-500 text-white border-amber-600 ring-amber-300",
  },
  {
    value: "Alfa",
    label: "Alfa",
    color: "bg-rose-500 text-white border-rose-600 ring-rose-300",
  },
  {
    value: "Cabut",
    label: "Cabut",
    color: "bg-violet-500 text-white border-violet-600 ring-violet-300",
  },
];

function formatTanggalIndo(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function ModalPresensiPetugasSiswa({
  isOpen,
  onClose,
  petugasInfo, // { idWali, idGuru, namaKelas, kelas }
  user, // { id, nama }
  onPresensiSubmitted,
}) {
  const [loading, setLoading] = useState(true);
  const [siswaList, setSiswaList] = useState([]);
  const [presensiMap, setPresensiMap] = useState({}); // { [idSiswa]: { status: "Hadir", keterangan: "" } }
  const [isSubmittedToday, setIsSubmittedToday] = useState(false);
  const [submittedData, setSubmittedData] = useState([]); // data tersimpan hari ini (read-only)
  const [searchQuery, setSearchQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const todayISO = useMemo(() => {
    // Format YYYY-MM-DD lokal
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const todayFormatted = useMemo(() => {
    return formatTanggalIndo(new Date());
  }, []);

  useEffect(() => {
    if (isOpen && petugasInfo?.idWali && petugasInfo?.idGuru) {
      loadDataKelas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, petugasInfo?.idWali, petugasInfo?.idGuru]);

  async function loadDataKelas() {
    setLoading(true);
    setErrorMessage("");
    try {
      // 1. Cek flag localStorage untuk kecepatan akses
      const lockKey = `presensi_petugas_done_${petugasInfo.idWali}_${todayISO}`;
      const localLocked =
        typeof window !== "undefined" && localStorage.getItem(lockKey) === "1";

      const res = await getPresensiWaliGrid(
        petugasInfo.idGuru,
        petugasInfo.idWali,
      );
      if (!res.success) {
        throw new Error(
          res.message || "Gagal mengambil data kelas dari server.",
        );
      }

      const rawSiswa = res.data?.siswa || [];
      const normalizedSiswa = rawSiswa
        .map((s) => ({
          idSiswa: String(s.idSiswa || s.id || "").trim(),
          nama: (s.nama || s.namaSiswa || "").trim(),
          kelas: s.kelas || "",
        }))
        .filter((s) => s.idSiswa)
        .sort((a, b) => a.nama.localeCompare(b.nama));

      setSiswaList(normalizedSiswa);

      // 2. Cek apakah di database sudah ada presensi pada todayISO
      const rawPresensi = res.data?.presensi || [];
      const todayRecords = rawPresensi.filter(
        (p) => String(p.tanggal).trim() === todayISO,
      );

      if (todayRecords.length > 0 || localLocked) {
        // Hari ini sudah diisi! Masuk mode terkunci (read-only)
        setIsSubmittedToday(true);
        const mapExisting = {};
        todayRecords.forEach((p) => {
          mapExisting[String(p.idSiswa).trim()] = {
            status: p.status || "Hadir",
            keterangan: p.keterangan || "",
          };
        });
        setSubmittedData(mapExisting);
        if (typeof window !== "undefined") {
          localStorage.setItem(lockKey, "1");
        }
      } else {
        // Belum diisi: Inisialisasi default SEMUA HADIR
        setIsSubmittedToday(false);
        const initialMap = {};
        normalizedSiswa.forEach((s) => {
          initialMap[s.idSiswa] = {
            status: "Hadir",
            keterangan: "",
          };
        });
        setPresensiMap(initialMap);
      }
    } catch (err) {
      console.error("Gagal memuat data presensi petugas:", err);
      setErrorMessage(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  }

  function handleStatusChange(idSiswa, status) {
    if (isSubmittedToday) return; // Terkunci
    setPresensiMap((prev) => ({
      ...prev,
      [idSiswa]: {
        ...(prev[idSiswa] || { keterangan: "" }),
        status,
      },
    }));
  }

  function handleKeteranganChange(idSiswa, keterangan) {
    if (isSubmittedToday) return; // Terkunci
    setPresensiMap((prev) => ({
      ...prev,
      [idSiswa]: {
        ...(prev[idSiswa] || { status: "Hadir" }),
        keterangan,
      },
    }));
  }

  function handleSetSemuaHadir() {
    if (isSubmittedToday) return;
    const resetMap = {};
    siswaList.forEach((s) => {
      resetMap[s.idSiswa] = {
        status: "Hadir",
        keterangan: "",
      };
    });
    setPresensiMap(resetMap);
  }

  // Ringkasan Counter
  const stats = useMemo(() => {
    const dataSource = isSubmittedToday ? submittedData : presensiMap;
    let hadir = 0;
    let sakit = 0;
    let izin = 0;
    let alfa = 0;
    let cabut = 0;

    siswaList.forEach((s) => {
      const item = dataSource[s.idSiswa];
      const st = item?.status || "Hadir";
      if (st === "Hadir") hadir++;
      else if (st === "Sakit") sakit++;
      else if (st === "Izin") izin++;
      else if (st === "Alfa") alfa++;
      else if (st === "Cabut") cabut++;
    });

    return { total: siswaList.length, hadir, sakit, izin, alfa, cabut };
  }, [siswaList, presensiMap, submittedData, isSubmittedToday]);

  // Filter Siswa untuk Pencarian
  const filteredSiswa = useMemo(() => {
    if (!searchQuery.trim()) return siswaList;
    const q = searchQuery.toLowerCase();
    return siswaList.filter((s) => s.nama.toLowerCase().includes(q));
  }, [siswaList, searchQuery]);

  async function handleSubmit() {
    if (isSubmittedToday) return;

    if (siswaList.length === 0) {
      alert("Tidak ada data siswa yang dapat disimpan.");
      return;
    }

    const nonHadirCount = stats.sakit + stats.izin + stats.alfa + stats.cabut;
    const konfirmasiPesan =
      `📋 KONFIRMASI PENGIRIMAN PRESENSI KELAS\n\n` +
      `Kelas: ${petugasInfo.namaKelas}\n` +
      `Tanggal: ${todayFormatted}\n` +
      `Total Siswa: ${stats.total}\n` +
      `• Hadir: ${stats.hadir}\n` +
      `• Sakit: ${stats.sakit}\n` +
      `• Izin: ${stats.izin}\n` +
      `• Alfa: ${stats.alfa}\n` +
      `• Cabut: ${stats.cabut}\n\n` +
      `⚠️ PERHATIAN:\n` +
      `Presensi hanya dapat diisi 1 KALI SEHARI.\n` +
      `Setelah disimpan, Anda TIDAK DAPAT MENGUBAH data ini lagi (hanya Guru Wali Kelas yang dapat mengubah).\n\n` +
      `Apakah Anda yakin data ini sudah benar dan ingin mengirimkannya?`;

    if (!window.confirm(konfirmasiPesan)) return;

    setSaving(true);
    try {
      const cells = siswaList.map((s) => {
        const item = presensiMap[s.idSiswa] || {
          status: "Hadir",
          keterangan: "",
        };
        return {
          idSiswa: s.idSiswa,
          namaSiswa: s.nama,
          tanggal: todayISO,
          status: item.status || "Hadir",
          keterangan:
            item.keterangan ||
            (item.status !== "Hadir"
              ? `Petugas: ${user?.nama || "Siswa"}`
              : ""),
        };
      });

      const res = await savePresensiWaliKelas({
        idGuru: petugasInfo.idGuru,
        idWali: petugasInfo.idWali,
        cells,
      });

      if (!res.success) {
        throw new Error(res.message || "Gagal menyimpan presensi ke server.");
      }

      // Kunci lokal
      const lockKey = `presensi_petugas_done_${petugasInfo.idWali}_${todayISO}`;
      if (typeof window !== "undefined") {
        localStorage.setItem(lockKey, "1");
      }

      setIsSubmittedToday(true);
      setSubmittedData({ ...presensiMap });

      alert(
        `✅ ALHAMDULILLAH! Presensi kelas ${petugasInfo.namaKelas} berhasil dikirim.\n\n` +
          `Data telah tercatat di sistem wali kelas. Terima kasih telah menjalankan tugas presensi hari ini.`,
      );

      if (typeof onPresensiSubmitted === "function") {
        onPresensiSubmitted();
      }
    } catch (err) {
      console.error("Gagal mengirim presensi:", err);
      alert(
        "❌ Terjadi kesalahan saat menyimpan: " +
          (err.message || "Silakan coba lagi."),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex h-[94vh] sm:h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        {/* ============================================================ */}
        {/* HEADER MODAL */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 px-4 sm:px-6 py-4 text-white shadow-md relative">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 flex items-center justify-center text-xl sm:text-2xl shadow-md shrink-0 border border-white/30">
                ⭐
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                    Presensi Kelas Harian
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/25 border border-amber-300/40 text-amber-200 text-[10px] font-black uppercase tracking-wider">
                    Petugas Siswa
                  </span>
                </div>
                <p className="text-xs text-teal-100 font-medium flex items-center gap-1 mt-0.5">
                  <span>🏫 {petugasInfo?.namaKelas || "Kelas Wali"}</span>
                  <span>•</span>
                  <span>📅 {todayFormatted}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-full bg-white/10 hover:bg-white/20 active:scale-95 w-9 h-9 flex items-center justify-center text-sm font-black transition-all border border-white/20 shrink-0"
              title="Tutup"
            >
              ✕
            </button>
          </div>

          {/* Banner Status Terkunci Hari Ini */}
          {isSubmittedToday && (
            <div className="mt-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 px-3.5 py-2 flex items-center gap-2 text-emerald-100 text-xs font-semibold">
              <span className="text-base">🔒</span>
              <span>
                Presensi kelas untuk hari ini (<b>{todayFormatted}</b>) telah
                dikirim dan <b>terkunci</b>. Hanya Guru Wali Kelas yang
                berwenang melakukan perubahan.
              </span>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* STATS COUNTER BAR & SEARCH */}
        {/* ============================================================ */}
        <div className="shrink-0 bg-slate-50 border-b border-slate-200 px-4 sm:px-6 py-3 space-y-2.5">
          {/* Quick Counter Badges */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            <div className="rounded-xl bg-white p-2 text-center border border-slate-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-slate-400">
                Total
              </span>
              <span className="text-sm sm:text-base font-black text-slate-800">
                {stats.total}
              </span>
            </div>
            <div className="rounded-xl bg-emerald-50 p-2 text-center border border-emerald-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-emerald-700">
                Hadir
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-800">
                {stats.hadir}
              </span>
            </div>
            <div className="rounded-xl bg-blue-50 p-2 text-center border border-blue-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-blue-700">
                Sakit
              </span>
              <span className="text-sm sm:text-base font-black text-blue-800">
                {stats.sakit}
              </span>
            </div>
            <div className="rounded-xl bg-amber-50 p-2 text-center border border-amber-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-amber-700">
                Izin
              </span>
              <span className="text-sm sm:text-base font-black text-amber-800">
                {stats.izin}
              </span>
            </div>
            <div className="rounded-xl bg-rose-50 p-2 text-center border border-rose-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-rose-700">
                Alfa
              </span>
              <span className="text-sm sm:text-base font-black text-rose-800">
                {stats.alfa}
              </span>
            </div>
            <div className="rounded-xl bg-violet-50 p-2 text-center border border-violet-200 shadow-xs">
              <span className="block text-[10px] font-black uppercase text-violet-700">
                Cabut
              </span>
              <span className="text-sm sm:text-base font-black text-violet-800">
                {stats.cabut}
              </span>
            </div>
          </div>

          {/* Search Bar & Reset Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs sm:text-sm">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama siswa..."
                className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all"
              />
            </div>

            {!isSubmittedToday && (
              <button
                type="button"
                onClick={handleSetSemuaHadir}
                className="rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 px-3.5 py-2 text-xs font-black transition-all flex items-center justify-center gap-1.5 active:scale-95 shrink-0"
              >
                <span>✨</span>
                <span>Reset Semua Hadir</span>
              </button>
            )}
          </div>
        </div>

        {/* ============================================================ */}
        {/* TABEL / DAFTAR SISWA */}
        {/* ============================================================ */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/70">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                Memuat daftar siswa kelas {petugasInfo?.namaKelas}...
              </p>
            </div>
          ) : errorMessage ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3 max-w-md mx-auto my-8">
              <span className="text-3xl">⚠️</span>
              <p className="text-xs sm:text-sm font-black text-rose-800">
                {errorMessage}
              </p>
              <button
                onClick={loadDataKelas}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700"
              >
                Coba Muat Ulang
              </button>
            </div>
          ) : filteredSiswa.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 max-w-md mx-auto my-8 space-y-2">
              <span className="text-3xl">🔍</span>
              <p className="text-xs sm:text-sm font-bold">
                {searchQuery
                  ? `Tidak ada siswa dengan nama "${searchQuery}".`
                  : "Belum ada siswa yang terdaftar di kelas ini."}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredSiswa.map((siswa, idx) => {
                const currentStatus = isSubmittedToday
                  ? submittedData[siswa.idSiswa]?.status || "Hadir"
                  : presensiMap[siswa.idSiswa]?.status || "Hadir";
                const currentKet = isSubmittedToday
                  ? submittedData[siswa.idSiswa]?.keterangan || ""
                  : presensiMap[siswa.idSiswa]?.keterangan || "";

                return (
                  <div
                    key={siswa.idSiswa}
                    className={`rounded-2xl bg-white p-3 sm:p-4 border transition-all ${
                      currentStatus !== "Hadir"
                        ? "border-amber-300 shadow-sm bg-amber-50/20"
                        : "border-slate-200/80 shadow-xs hover:border-teal-200"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Nama & Nomor Urut */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-600 shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-black text-slate-800 truncate">
                            {siswa.nama}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            ID: {siswa.idSiswa}{" "}
                            {siswa.kelas ? `• ${siswa.kelas}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Kontrol Status Presensi */}
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {isSubmittedToday ? (
                          // Tampilan Terkunci (Read-Only Badge)
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-xl text-xs font-black border shadow-xs ${
                                STATUS_OPTIONS.find(
                                  (opt) => opt.value === currentStatus,
                                )?.color ||
                                "bg-emerald-500 text-white border-emerald-600"
                              }`}
                            >
                              {currentStatus}
                            </span>
                            {currentKet && (
                              <span className="text-[11px] text-slate-500 italic max-w-[160px] truncate">
                                ({currentKet})
                              </span>
                            )}
                          </div>
                        ) : (
                          // Dropdown / Button Selector Status
                          <div className="flex flex-wrap items-center gap-1">
                            {STATUS_OPTIONS.map((opt) => {
                              const isSelected = currentStatus === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() =>
                                    handleStatusChange(siswa.idSiswa, opt.value)
                                  }
                                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-black border transition-all active:scale-95 ${
                                    isSelected
                                      ? `${opt.color} shadow-sm ring-2`
                                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Input Opsional Keterangan (hanya muncul jika bukan hadir dan belum submitted) */}
                    {!isSubmittedToday && currentStatus !== "Hadir" && (
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
                          Ket:
                        </span>
                        <input
                          type="text"
                          value={currentKet}
                          onChange={(e) =>
                            handleKeteranganChange(
                              siswa.idSiswa,
                              e.target.value,
                            )
                          }
                          placeholder={`Keterangan ${currentStatus.toLowerCase()} (opsional)...`}
                          className="flex-1 px-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50/50 font-medium text-slate-800 outline-none focus:border-teal-500 focus:bg-white"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* FOOTER MODAL */}
        {/* ============================================================ */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-medium text-center sm:text-left">
            {isSubmittedToday ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <span>✅</span> Data presensi hari ini telah terekam secara
                permanen.
              </span>
            ) : (
              <span>
                Default presensi adalah <b>Hadir semua</b>. Ubah status siswa
                yang tidak hadir lalu tekan tombol simpan.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 sm:flex-initial rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 text-xs font-bold transition-all text-center"
            >
              {isSubmittedToday ? "Tutup" : "Batal"}
            </button>

            {!isSubmittedToday && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving || loading || siswaList.length === 0}
                className="flex-1 sm:flex-initial rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:brightness-110 active:scale-95 text-white px-6 py-2.5 text-xs font-black shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Mengirim Presensi...</span>
                  </>
                ) : (
                  <>
                    <span>📤</span>
                    <span>Kirim Presensi Hari Ini</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
