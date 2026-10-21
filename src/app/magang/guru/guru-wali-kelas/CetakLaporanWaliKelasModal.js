"use client";

import { useState, useEffect, useCallback } from "react";
import { getWaliKelasByGuru, getSiswaWaliKelas } from "../../lib/api";
import { generateLaporanWaliKelasPDF } from "./generateLaporanWaliKelasPDF";

const NAMA_BULAN = [
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

const DEFAULT_KONDISI_KELAS = [
  {
    pelaksanaanPiket:
      "Regu Piket (Senin - Jumat) aktif menyapu, mengepel lantai, dan membersihkan papan tulis setiap pagi & pulang sekolah.",
    inventarisKelas:
      "Meja Siswa: 36 (Baik), Kursi Siswa: 36 (Baik), Meja & Kursi Guru: 1 Set (Baik), Whiteboard: 1 (Baik), Kipas Angin: 2 Unit (Baik), Jam Dinding: 1 (Aktif).",
    keterangan:
      "Ruang kelas dalam kondisi bersih, rapi, fasilitas sarana prasarana terpelihara dengan baik dan siap untuk KBM.",
  },
];

export default function CetakLaporanWaliKelasModal({
  isOpen,
  onClose,
  guru,
  targetWali = null, // Opsional: jika dipanggil langsung dari card wali kelas
}) {
  const [daftarWali, setDaftarWali] = useState([]);
  const [selectedWaliId, setSelectedWaliId] = useState("");
  const [loading, setLoading] = useState(false);
  const [cetakLoading, setCetakLoading] = useState(false);
  const [error, setError] = useState("");

  // Mode periode: "bulan" | "semua"
  const [modePeriode, setModePeriode] = useState("bulan");
  const now = new Date();
  const [bulanPilihan, setBulanPilihan] = useState(now.getMonth() + 1);
  const [tahunPilihan, setTahunPilihan] = useState(now.getFullYear());

  // Tab aktif di modal: "periode" | "kondisi" | "mutasi"
  const [activeTab, setActiveTab] = useState("periode");

  // Point C: Kondisi Kelas
  const [includeKondisi, setIncludeKondisi] = useState(true);
  const [kondisiList, setKondisiList] = useState(DEFAULT_KONDISI_KELAS);

  // Point D: Mutasi Siswa
  const [includeMutasi, setIncludeMutasi] = useState(true);
  const [mutasiList, setMutasiList] = useState([]);
  const [daftarSiswaKelas, setDaftarSiswaKelas] = useState([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);

  // Load daftar wali kelas jika targetWali belum ada
  useEffect(() => {
    if (!isOpen) return;

    if (targetWali) {
      const tid = String(targetWali.idWali || targetWali.ID_WALI || "");
      setSelectedWaliId(tid);
    }
    if (guru?.id) {
      loadDaftarWali();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, targetWali, guru?.id]);

  async function loadDaftarWali() {
    try {
      setLoading(true);
      setError("");
      const result = await getWaliKelasByGuru(guru.id);
      if (result.success) {
        const raw = result.data ?? result.message ?? [];
        const normalized = (Array.isArray(raw) ? raw : []).map((w, idx) => ({
          ...w,
          idWali: String(w.idWali || w.ID_WALI || w.id || `wali-${idx}`),
          idGuru: String(w.idGuru || w.ID_GURU || ""),
          namaKelas: String(w.namaKelas || w.NAMA_KELAS || w.kelas || ""),
          kelas: String(w.kelas || w.NAMA_KELAS || w.namaKelas || ""),
          keterangan: String(w.keterangan || w.KETERANGAN || ""),
          jumlahSiswa: w.jumlahSiswa,
        }));
        setDaftarWali(normalized);
        if (normalized.length > 0) {
          if (targetWali) {
            setSelectedWaliId(
              String(targetWali.idWali || targetWali.ID_WALI || ""),
            );
          } else if (!selectedWaliId) {
            setSelectedWaliId(normalized[0].idWali);
          }
        }
      } else {
        if (targetWali) {
          setDaftarWali([targetWali]);
        } else {
          setError(result.message || "Gagal mengambil daftar kelas wali.");
        }
      }
    } catch (err) {
      console.error("Gagal memuat kelas wali:", err);
      if (targetWali) {
        setDaftarWali([targetWali]);
      } else {
        setError("Terjadi kesalahan saat memuat daftar kelas wali.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Wali yang sedang aktif dipilih
  const currentWali =
    daftarWali.find((w) => String(w.idWali) === String(selectedWaliId)) ||
    targetWali ||
    daftarWali[0] ||
    null;

  // Load data kondisi kelas & mutasi siswa dari LocalStorage per idWali
  const loadStoredDataWali = useCallback(async (idWali) => {
    if (!idWali) return;

    // 1. Kondisi Kelas dari localStorage
    try {
      const storedKondisi = localStorage.getItem(`portal_wali_kondisi_${idWali}`);
      if (storedKondisi) {
        const parsed = JSON.parse(storedKondisi);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKondisiList(parsed);
        } else {
          setKondisiList(DEFAULT_KONDISI_KELAS);
        }
      } else {
        setKondisiList(DEFAULT_KONDISI_KELAS);
      }
    } catch {
      setKondisiList(DEFAULT_KONDISI_KELAS);
    }

    // 2. Mutasi Siswa dari localStorage
    try {
      const storedMutasi = localStorage.getItem(`portal_wali_mutasi_${idWali}`);
      if (storedMutasi) {
        const parsed = JSON.parse(storedMutasi);
        if (Array.isArray(parsed)) {
          setMutasiList(parsed);
        } else {
          setMutasiList([]);
        }
      } else {
        setMutasiList([]);
      }
    } catch {
      setMutasiList([]);
    }

    // 3. Ambil daftar siswa kelas untuk dropdown mutasi
    if (guru?.id) {
      try {
        setLoadingSiswa(true);
        const res = await getSiswaWaliKelas(guru.id, idWali);
        if (res.success && Array.isArray(res.data)) {
          const list = res.data
            .map((s) => ({
              idSiswa: s.idSiswa || s.id || "",
              nama: (s.namaSiswa || s.nama || "").replace(/\s*\[.*?\]$/, "").trim(),
              kelas: s.kelas || "",
            }))
            .sort((a, b) => a.nama.localeCompare(b.nama));
          setDaftarSiswaKelas(list);
        }
      } catch (err) {
        console.warn("Gagal mengambil daftar siswa wali:", err);
      } finally {
        setLoadingSiswa(false);
      }
    }
  }, [guru?.id]);

  useEffect(() => {
    if (currentWali?.idWali) {
      loadStoredDataWali(currentWali.idWali);
    }
  }, [currentWali?.idWali, loadStoredDataWali]);

  // Simpan kondisi ke localStorage jika berubah
  function updateKondisiRow(idx, field, val) {
    setKondisiList((prev) => {
      const updated = prev.map((item, i) =>
        i === idx ? { ...item, [field]: val } : item,
      );
      if (currentWali?.idWali) {
        try {
          localStorage.setItem(
            `portal_wali_kondisi_${currentWali.idWali}`,
            JSON.stringify(updated),
          );
        } catch (e) {
          console.warn("LocalStorage save error:", e);
        }
      }
      return updated;
    });
  }

  function tambahKondisiRow() {
    setKondisiList((prev) => {
      const updated = [
        ...prev,
        {
          pelaksanaanPiket: "",
          inventarisKelas: "",
          keterangan: "",
        },
      ];
      if (currentWali?.idWali) {
        localStorage.setItem(
          `portal_wali_kondisi_${currentWali.idWali}`,
          JSON.stringify(updated),
        );
      }
      return updated;
    });
  }

  function hapusKondisiRow(idx) {
    setKondisiList((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      const finalVal = updated.length > 0 ? updated : DEFAULT_KONDISI_KELAS;
      if (currentWali?.idWali) {
        localStorage.setItem(
          `portal_wali_kondisi_${currentWali.idWali}`,
          JSON.stringify(finalVal),
        );
      }
      return finalVal;
    });
  }

  function resetKondisiDefault() {
    setKondisiList(DEFAULT_KONDISI_KELAS);
    if (currentWali?.idWali) {
      localStorage.setItem(
        `portal_wali_kondisi_${currentWali.idWali}`,
        JSON.stringify(DEFAULT_KONDISI_KELAS),
      );
    }
  }

  // Mutasi Siswa Handlers
  function updateMutasiRow(idx, field, val) {
    setMutasiList((prev) => {
      const updated = prev.map((item, i) =>
        i === idx ? { ...item, [field]: val } : item,
      );
      if (currentWali?.idWali) {
        try {
          localStorage.setItem(
            `portal_wali_mutasi_${currentWali.idWali}`,
            JSON.stringify(updated),
          );
        } catch (e) {
          console.warn("LocalStorage save error:", e);
        }
      }
      return updated;
    });
  }

  function tambahMutasiRow() {
    setMutasiList((prev) => {
      const updated = [
        ...prev,
        {
          nama: "",
          isManual: false,
          jenis: "Mutasi Keluar",
          tanggal: new Date().toLocaleDateString("en-CA"),
          keterangan: "",
        },
      ];
      if (currentWali?.idWali) {
        localStorage.setItem(
          `portal_wali_mutasi_${currentWali.idWali}`,
          JSON.stringify(updated),
        );
      }
      return updated;
    });
  }

  function hapusMutasiRow(idx) {
    setMutasiList((prev) => {
      const updated = prev.filter((_, i) => i !== idx);
      if (currentWali?.idWali) {
        localStorage.setItem(
          `portal_wali_mutasi_${currentWali.idWali}`,
          JSON.stringify(updated),
        );
      }
      return updated;
    });
  }

  // Eksekusi Cetak PDF
  async function handleProsesCetak() {
    if (!currentWali) {
      alert("Pilih kelas wali terlebih dahulu.");
      return;
    }

    try {
      setCetakLoading(true);

      const cetakSemua = modePeriode === "semua";
      const bulan = cetakSemua ? null : Number(bulanPilihan);
      const tahun = cetakSemua ? null : Number(tahunPilihan);

      await generateLaporanWaliKelasPDF({
        guru,
        wali: currentWali,
        bulan,
        tahun,
        cetakSemua,
        kondisiKelas: includeKondisi ? kondisiList : [],
        mutasiSiswa: includeMutasi ? mutasiList : [],
        includeKondisiKelas: includeKondisi,
        includeMutasiSiswa: includeMutasi,
      });
    } catch (err) {
      console.error("Gagal cetak PDF wali kelas:", err);
      alert(err.message || "Gagal mencetak laporan PDF wali kelas.");
    } finally {
      setCetakLoading(false);
    }
  }

  if (!isOpen) return null;

  // Tahun Options (3 tahun ke belakang sampai tahun depan)
  const tahunOptions = [];
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y++) {
    tahunOptions.push(y);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        {/* Header Modal */}
        <div className="shrink-0 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-950 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🖨️</span>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight">
                  Cetak Laporan Wali Kelas (PDF)
                </h3>
                <p className="text-[11px] text-teal-200 font-medium">
                  Laporan Lengkap: Kehadiran, Rekapitulasi, Jurnal, Kondisi Kelas & Mutasi
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 hover:bg-white/25 w-8 h-8 flex items-center justify-center text-xs font-black transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Tab Navigasi Pengaturan Cetak */}
          <div className="mt-3.5 flex gap-1.5 p-1 bg-black/20 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab("periode")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all ${
                activeTab === "periode"
                  ? "bg-white text-teal-950 shadow-sm"
                  : "text-teal-200 hover:text-white"
              }`}
            >
              📅 1. Periode & Kelas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("kondisi")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeTab === "kondisi"
                  ? "bg-white text-teal-950 shadow-sm"
                  : "text-teal-200 hover:text-white"
              }`}
            >
              🏢 2. Kondisi Kelas
              {includeKondisi && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("mutasi")}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeTab === "mutasi"
                  ? "bg-white text-teal-950 shadow-sm"
                  : "text-teal-200 hover:text-white"
              }`}
            >
              🔄 3. Mutasi Siswa
              {mutasiList.length > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] rounded-full bg-amber-400 text-slate-900 font-black">
                  {mutasiList.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Konten Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 text-center">
              ⚠️ {error}
            </div>
          )}

          {/* ========================================================
              TAB 1: PERIODE & PILIHAN KELAS
              ======================================================== */}
          {activeTab === "periode" && (
            <div className="space-y-4">
              {/* Pilihan Kelas Wali */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <label className="block text-xs font-black uppercase text-slate-700 mb-2">
                  🏫 Kelas Wali yang Dicetak
                </label>

                {loading ? (
                  <p className="text-xs text-slate-400 font-medium py-2">
                    Memuat daftar kelas wali...
                  </p>
                ) : daftarWali.length === 0 ? (
                  <p className="text-xs text-rose-500 font-bold py-2">
                    Belum ada kelas wali yang terdaftar.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <select
                      value={selectedWaliId}
                      onChange={(e) => setSelectedWaliId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    >
                      {daftarWali.map((w) => (
                        <option key={w.idWali} value={w.idWali}>
                          {w.namaKelas} {w.kelas ? `[Kelas ${w.kelas}]` : ""}{" "}
                          {w.jumlahSiswa !== undefined ? `(${w.jumlahSiswa} Siswa)` : ""}
                        </option>
                      ))}
                    </select>

                    {currentWali && (
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
                        <span className="font-bold text-slate-700">Guru Wali:</span>
                        <span>{guru?.nama || "-"}</span>
                        {currentWali.keterangan && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="italic">{currentWali.keterangan}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Opsi Jangkauan Periode Cetak */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <label className="block text-xs font-black uppercase text-slate-700">
                  🗓️ Jangkauan Periode Laporan
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Opsi 1: Bulan Tertentu */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      modePeriode === "bulan"
                        ? "border-teal-600 bg-teal-50/60 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="modePeriode"
                      value="bulan"
                      checked={modePeriode === "bulan"}
                      onChange={() => setModePeriode("bulan")}
                      className="mt-0.5 h-4 w-4 text-teal-600 accent-teal-600"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800">
                        Bulan Tertentu
                      </p>
                      <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                        Menyaring presensi & jurnal hanya pada bulan & tahun yang dipilih
                      </p>
                    </div>
                  </label>

                  {/* Opsi 2: Cetak Seluruhnya */}
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      modePeriode === "semua"
                        ? "border-teal-600 bg-teal-50/60 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="modePeriode"
                      value="semua"
                      checked={modePeriode === "semua"}
                      onChange={() => setModePeriode("semua")}
                      className="mt-0.5 h-4 w-4 text-teal-600 accent-teal-600"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800">
                        Cetak Seluruhnya (Semua Bulan)
                      </p>
                      <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">
                        Akumulasi lengkap seluruh presensi & jurnal tanpa batasan tanggal
                      </p>
                    </div>
                  </label>
                </div>

                {/* Dropdown Bulan & Tahun jika modePeriode === 'bulan' */}
                {modePeriode === "bulan" && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center gap-2.5 animate-in fade-in duration-150">
                    <span className="text-xs font-bold text-slate-700">Pilih Bulan:</span>
                    <select
                      value={bulanPilihan}
                      onChange={(e) => setBulanPilihan(Number(e.target.value))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-800 outline-none focus:border-teal-500"
                    >
                      {NAMA_BULAN.map((bln, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {bln}
                        </option>
                      ))}
                    </select>

                    <span className="text-xs font-bold text-slate-700 ml-2">Tahun:</span>
                    <select
                      value={tahunPilihan}
                      onChange={(e) => setTahunPilihan(Number(e.target.value))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-black text-slate-800 outline-none focus:border-teal-500"
                    >
                      {tahunOptions.map((thn) => (
                        <option key={thn} value={thn}>
                          {thn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Rincian Bagian Dokumen PDF */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5 text-xs">
                <span className="font-black text-slate-700 uppercase tracking-wide block">
                  📑 Bagian Laporan yang Akan Dicetak:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-teal-900">
                    <span>✓</span>
                    <span>A. Presensi Harian & Rekap Total</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-teal-900">
                    <span>✓</span>
                    <span>B. Jurnal Bimbingan Wali Kelas</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-700">
                    <span className={includeKondisi ? "text-emerald-600 font-black" : "text-slate-300"}>
                      {includeKondisi ? "✓" : "✕"}
                    </span>
                    <span>C. Kondisi Kelas & Inventaris</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100 font-bold text-slate-700">
                    <span className={includeMutasi ? "text-emerald-600 font-black" : "text-slate-300"}>
                      {includeMutasi ? "✓" : "✕"}
                    </span>
                    <span>D. Rekapitulasi Mutasi Siswa</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: POINT C - KONDISI KELAS & INVENTARIS
              ======================================================== */}
          {activeTab === "kondisi" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-800">
                    Point C: Kondisi Kelas & Inventaris
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tersimpan otomatis di memori browser (tanpa spreadsheet)
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeKondisi}
                    onChange={(e) => setIncludeKondisi(e.target.checked)}
                    className="h-4 w-4 rounded text-teal-600 accent-teal-600"
                  />
                  <span className="text-xs font-black text-slate-700">
                    Sertakan di PDF
                  </span>
                </label>
              </div>

              {includeKondisi && (
                <div className="space-y-3">
                  {kondisiList.map((row, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="text-xs font-black text-slate-700">
                          Baris #{idx + 1}
                        </span>
                        {kondisiList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => hapusKondisiRow(idx)}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition-colors"
                          >
                            🗑️ Hapus Baris
                          </button>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="block">
                          <span className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                            🧹 Pelaksanaan Piket Kebersihan:
                          </span>
                          <textarea
                            value={row.pelaksanaanPiket}
                            onChange={(e) =>
                              updateKondisiRow(idx, "pelaksanaanPiket", e.target.value)
                            }
                            rows={2}
                            placeholder="Contoh: Regu piket Senin-Jumat aktif membersihkan kelas sebelum & sesudah KBM..."
                            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-teal-500 transition-all resize-none"
                          />
                        </label>

                        <label className="block">
                          <span className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                            📦 Inventaris & Sarana Prasarana Kelas:
                          </span>
                          <textarea
                            value={row.inventarisKelas}
                            onChange={(e) =>
                              updateKondisiRow(idx, "inventarisKelas", e.target.value)
                            }
                            rows={2}
                            placeholder="Contoh: Meja Siswa 36 (Baik), Kursi Siswa 36 (Baik), Whiteboard 1 (Baik)..."
                            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-teal-500 transition-all resize-none"
                          />
                        </label>

                        <label className="block">
                          <span className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                            📝 Keterangan / Evaluasi:
                          </span>
                          <input
                            type="text"
                            value={row.keterangan}
                            onChange={(e) =>
                              updateKondisiRow(idx, "keterangan", e.target.value)
                            }
                            placeholder="Contoh: Ruang kelas tertata rapi, bersih dan nyaman untuk pembelajaran."
                            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-teal-500 transition-all"
                          />
                        </label>
                      </div>
                    </div>
                  ))}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={tambahKondisiRow}
                      className="rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 px-3.5 py-2 text-xs font-black transition-colors"
                    >
                      ➕ Tambah Baris Kondisi
                    </button>
                    <button
                      type="button"
                      onClick={resetKondisiDefault}
                      className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 px-3 py-2 text-xs font-bold transition-colors"
                    >
                      💡 Isi Template Standar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              TAB 3: POINT D - REKAPITULASI MUTASI SISWA
              ======================================================== */}
          {activeTab === "mutasi" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-800">
                    Point D: Rekapitulasi Mutasi Siswa
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Catat mutasi masuk atau keluar (tersimpan di browser)
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeMutasi}
                    onChange={(e) => setIncludeMutasi(e.target.checked)}
                    className="h-4 w-4 rounded text-teal-600 accent-teal-600"
                  />
                  <span className="text-xs font-black text-slate-700">
                    Sertakan di PDF
                  </span>
                </label>
              </div>

              {includeMutasi && (
                <div className="space-y-3">
                  {mutasiList.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center space-y-2">
                      <p className="text-xs font-bold text-slate-500">
                        Belum ada catatan mutasi siswa.
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Jika dibiarkan kosong, laporan PDF akan mencetak keterangan resmi{" "}
                        <span className="font-bold text-slate-600">
                          "NIHIL (Tidak ada mutasi siswa pada periode ini)"
                        </span>
                        .
                      </p>
                      <button
                        type="button"
                        onClick={tambahMutasiRow}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-black px-4 py-2 shadow-xs transition-colors"
                      >
                        ➕ Tambah Data Mutasi
                      </button>
                    </div>
                  ) : (
                    <>
                      {mutasiList.map((m, idx) => (
                        <div
                          key={idx}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3"
                        >
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-xs font-black text-slate-700">
                              Mutasi #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => hapusMutasiRow(idx)}
                              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 transition-colors"
                            >
                              🗑️ Hapus
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Pilihan Siswa */}
                            <div className="sm:col-span-2">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold uppercase text-slate-600">
                                  Nama Siswa:
                                </label>
                                <button
                                  type="button"
                                  onClick={() =>
                                    updateMutasiRow(idx, "isManual", !m.isManual)
                                  }
                                  className="text-[10px] font-bold text-teal-600 hover:text-teal-800"
                                >
                                  {m.isManual ? "Switch ke Dropdown" : "Ketik Manual"}
                                </button>
                              </div>

                              {m.isManual ? (
                                <input
                                  type="text"
                                  value={m.nama}
                                  onChange={(e) =>
                                    updateMutasiRow(idx, "nama", e.target.value)
                                  }
                                  placeholder="Ketik nama lengkap siswa..."
                                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                                />
                              ) : (
                                <select
                                  value={m.nama}
                                  onChange={(e) =>
                                    updateMutasiRow(idx, "nama", e.target.value)
                                  }
                                  className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                                >
                                  <option value="">-- Pilih dari siswa kelas --</option>
                                  {daftarSiswaKelas.map((s) => (
                                    <option key={s.idSiswa} value={s.nama}>
                                      {s.nama}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>

                            {/* Jenis Mutasi */}
                            <div>
                              <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                                Jenis Mutasi:
                              </label>
                              <select
                                value={m.jenis || "Mutasi Keluar"}
                                onChange={(e) =>
                                  updateMutasiRow(idx, "jenis", e.target.value)
                                }
                                className={`w-full rounded-xl border p-2 text-xs font-black outline-none ${
                                  m.jenis === "Mutasi Masuk"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                    : "bg-rose-50 text-rose-800 border-rose-300"
                                }`}
                              >
                                <option value="Mutasi Masuk">➕ Mutasi Masuk</option>
                                <option value="Mutasi Keluar">➖ Mutasi Keluar</option>
                              </select>
                            </div>

                            {/* Tanggal Mutasi */}
                            <div>
                              <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                                Tanggal Mutasi:
                              </label>
                              <input
                                type="date"
                                value={m.tanggal}
                                onChange={(e) =>
                                  updateMutasiRow(idx, "tanggal", e.target.value)
                                }
                                className="w-full rounded-xl border border-slate-300 p-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
                              />
                            </div>

                            {/* Keterangan */}
                            <div className="sm:col-span-2">
                              <label className="text-[11px] font-bold uppercase text-slate-600 block mb-1">
                                Keterangan / Asal / Tujuan / Alasan:
                              </label>
                              <input
                                type="text"
                                value={m.keterangan}
                                onChange={(e) =>
                                  updateMutasiRow(idx, "keterangan", e.target.value)
                                }
                                placeholder="Contoh: Pindah domisili mengikuti orang tua ke Pekanbaru"
                                className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-800 outline-none focus:border-teal-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={tambahMutasiRow}
                        className="rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 px-3.5 py-2 text-xs font-black transition-colors"
                      >
                        ➕ Tambah Siswa Mutasi Lainnya
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Modal: Tombol Cetak PDF Utama */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 text-center sm:text-left">
            <span className="font-bold text-slate-700">Kelas Terpilih:</span>{" "}
            {currentWali?.namaKelas || "-"} •{" "}
            <span>
              {modePeriode === "bulan"
                ? `${NAMA_BULAN[bulanPilihan - 1]} ${tahunPilihan}`
                : "Semua Periode (Seluruhnya)"}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={cetakLoading}
              className="flex-1 sm:flex-none rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 text-xs font-bold transition-colors"
            >
              Tutup
            </button>

            <button
              type="button"
              onClick={handleProsesCetak}
              disabled={cetakLoading || !currentWali}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-pink-600 to-rose-600 hover:brightness-110 active:scale-95 text-white text-xs font-black px-5 py-2.5 shadow-md transition-all disabled:opacity-60"
            >
              {cetakLoading ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Menyusun Laporan PDF...</span>
                </>
              ) : (
                <>
                  <span>🖨️</span>
                  <span>
                    Cetak PDF —{" "}
                    {modePeriode === "bulan"
                      ? `${NAMA_BULAN[bulanPilihan - 1]} ${tahunPilihan}`
                      : "Semua Periode"}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
