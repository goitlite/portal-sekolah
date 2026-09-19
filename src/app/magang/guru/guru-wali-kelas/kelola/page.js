"use client";

import {
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { getSession, isLoggedIn } from "../../../lib/auth";
import {
  getWaliKelasByGuru,
  addWaliKelas,
  editWaliKelas,
  deleteWaliKelas,
  getKelasSiswaMapel,
  getSiswaByKelasMapel,
  getPresensiWaliGrid,
  savePresensiWaliKelas,
  hapusSiswaWaliKelas,
  addSiswa,
} from "../../../lib/api";
import { generateLaporanWaliKelasPDF } from "../generateLaporanWaliKelasPDF";
import ModalTambahSiswaWali from "./ModalTambahSiswaWali";
import ModalJurnalWaliKelas from "./ModalJurnalWaliKelas";
import ModalPilihPetugasPresensi from "../ModalPilihPetugasPresensi";
import {
  getPetugasFromWali,
  parseKeteranganWali,
} from "../../../lib/petugasPresensiHelper";

const STATUS_OPTIONS = [
  { value: "Hadir", label: "Hadir" },
  { value: "Sakit", label: "Sakit" },
  { value: "Izin", label: "Izin" },
  { value: "Alfa", label: "Alfa" },
  { value: "Cabut", label: "Cabut" },
];

function warnaStatus(status) {
  switch (status) {
    case "Hadir":
      return "bg-emerald-500 text-white border-emerald-600";
    case "Sakit":
      return "bg-blue-600 text-white border-blue-700";
    case "Izin":
      return "bg-amber-500 text-white border-amber-600";
    case "Alfa":
      return "bg-rose-500 text-white border-rose-600";
    case "Cabut":
      return "bg-violet-500 text-white border-violet-600";
    default:
      return "bg-white text-slate-500 border-slate-300 hover:border-teal-400";
  }
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

// Daftar kelas statis (sama dengan guru-mapel)
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

export default function KelolaWaliKelasPage() {
  const router = useRouter();

  const [guru, setGuru] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState("");

  const [daftarWali, setDaftarWali] = useState([]);
  const [searchWali, setSearchWali] = useState("");
  const [statsPresensiHariIniWali, setStatsPresensiHariIniWali] = useState({});
  const [loadingStatsWali, setLoadingStatsWali] = useState({});

  // --- AMBIL STATISTIK PRESENSI HARI INI KELAS WALI ---
  const loadStatsHariIniWali = useCallback(
    async (idWali) => {
      if (!guru?.id || !idWali) return;
      setLoadingStatsWali((prev) => ({ ...prev, [idWali]: true }));

      try {
        const todayISO = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
        const res = await getPresensiWaliGrid(guru.id, idWali);

        if (res && res.success && res.data) {
          const siswaList = res.data.siswa || [];
          const presensiList = res.data.presensi || [];

          const siswaMap = {};
          siswaList.forEach((s) => {
            siswaMap[String(s.idSiswa || s.id)] = s.nama || s.namaSiswa || "";
          });

          const todayRecords = presensiList.filter(
            (p) => String(p.tanggal).trim() === todayISO,
          );

          let hadir = 0;
          let sakit = 0;
          let izin = 0;
          let alfa = 0;
          let cabut = 0;
          const absenList = [];

          todayRecords.forEach((p) => {
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

          setStatsPresensiHariIniWali((prev) => ({
            ...prev,
            [idWali]: {
              sudahDiisi: todayRecords.length > 0,
              totalSiswa: siswaList.length,
              hadir,
              sakit,
              izin,
              alfa,
              cabut,
              absenList,
              tanggal: todayISO,
            },
          }));
        }
      } catch (err) {
        console.warn(
          "Gagal memuat statistik presensi hari ini kelas wali:",
          err,
        );
      } finally {
        setLoadingStatsWali((prev) => ({ ...prev, [idWali]: false }));
      }
    },
    [guru?.id],
  );

  // Form Tambah Kelas Wali
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [namaKelas, setNamaKelas] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [kelasDipilih, setKelasDipilih] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewSiswa, setPreviewSiswa] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState(null);
  const [editNamaKelas, setEditNamaKelas] = useState("");
  const [editKeterangan, setEditKeterangan] = useState("");

  // Expanded presensi grid
  const [expandedWaliId, setExpandedWaliId] = useState(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);
  const activeGridRef = useRef(null);

  // Modal tambah siswa
  const [waliTambahTarget, setWaliTambahTarget] = useState(null);

  // Modal jurnal
  const [waliJurnalTarget, setWaliJurnalTarget] = useState(null);

  // Modal petugas presensi
  const [waliPetugasTarget, setWaliPetugasTarget] = useState(null);

  // Cetak PDF
  const [cetakLoadingId, setCetakLoadingId] = useState(null);

  async function handleCetakPDF(wali) {
    try {
      setCetakLoadingId(wali.idWali);
      await generateLaporanWaliKelasPDF({ guru, wali });
    } catch (err) {
      console.error("Gagal cetak PDF wali kelas:", err);
      alert(err.message || "Gagal mencetak laporan PDF wali kelas.");
    } finally {
      setCetakLoadingId(null);
    }
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      router.replace("/magang/login");
      return;
    }
    const session = getSession();
    if (!session || session.role !== "guru") {
      router.replace("/magang/login");
      return;
    }
    setGuru(session);
    loadWali(session.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadWali(idGuru) {
    let progressTimer = null;
    try {
      setLoading(true);
      setError("");
      setLoadProgress(15);
      await new Promise((res) => setTimeout(res, 50)); // allow initial render

      setLoadProgress(35);
      progressTimer = setInterval(() => {
        setLoadProgress((prev) =>
          prev < 88 ? prev + Math.floor(Math.random() * 5 + 3) : prev,
        );
      }, 300);

      const result = await getWaliKelasByGuru(idGuru);
      if (progressTimer) clearInterval(progressTimer);

      if (result.success) {
        // GAS successResponse(data) dgn 1 arg → array masuk ke result.message atau result.data
        // Normalkan: cek keduanya, pastikan selalu array dan tiap item punya idWali & namaKelas
        const raw = result.data ?? result.message ?? [];
        const normalized = (Array.isArray(raw) ? raw : []).map((w, idx) => ({
          ...w,
          idWali: String(w.idWali || w.ID_WALI || w.id || `wali-${idx}`),
          idGuru: String(w.idGuru || w.ID_GURU || ""),
          namaKelas: String(w.namaKelas || w.NAMA_KELAS || w.kelas || ""),
          kelas: String(w.kelas || w.NAMA_KELAS || w.namaKelas || ""),
          keterangan: String(w.keterangan || w.KETERANGAN || ""),
          createdAt: w.createdAt || w.CREATED_AT || "",
        }));
        setLoadProgress(100);
        setDaftarWali(normalized);
        normalized.forEach((w) => {
          if (w.idWali) {
            loadStatsHariIniWali(w.idWali);
          }
        });
      } else {
        setError(result.message || "Gagal mengambil data kelas wali.");
        setDaftarWali([]);
      }
    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      console.error("ERROR LOAD WALI:", err);
      setError("Terjadi kesalahan saat mengambil data kelas wali.");
      setDaftarWali([]);
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setLoading(false);
      setLoadProgress(0);
    }
  }

  async function handlePilihKelas(kelas) {
    setKelasDipilih(kelas);
    if (!kelas) {
      setPreviewSiswa([]);
      return;
    }
    try {
      setLoadingPreview(true);
      const result = await getSiswaByKelasMapel(kelas);
      setPreviewSiswa(result.success ? result.data || [] : []);
    } catch {
      setPreviewSiswa([]);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleTambahWali(e) {
    e.preventDefault();
    if (!namaKelas.trim() && !kelasDipilih) {
      alert("Nama kelas wajib diisi atau pilih kelas.");
      return;
    }
    const namaFinal = namaKelas.trim() || kelasDipilih;
    setSaving(true);
    try {
      const result = await addWaliKelas({
        idGuru: guru.id,
        namaKelas: namaFinal,
        kelas: kelasDipilih || namaFinal,
        keterangan: keterangan.trim(),
      });
      if (result.success) {
        const jumlah =
          result.data?.jumlahSiswaOtomatis ??
          result.data?.autoEnroll?.ditambahkan ??
          0;
        if (kelasDipilih) {
          alert(
            `✅ Kelas Wali "${namaFinal}" berhasil dibuat.\n\n${jumlah} siswa dari kelas ${kelasDipilih} otomatis dimasukkan.`,
          );
        }
        setNamaKelas("");
        setKeterangan("");
        setKelasDipilih("");
        setPreviewSiswa([]);
        setIsFormOpen(false);
        await loadWali(guru.id);
      } else {
        alert(result.message || "Gagal menambahkan kelas wali.");
      }
    } catch (err) {
      console.error("ERROR TAMBAH WALI:", err);
      alert("Terjadi kesalahan saat menambahkan kelas wali.");
    } finally {
      setSaving(false);
    }
  }

  function mulaiEdit(wali) {
    setEditingId(wali.idWali);
    setEditNamaKelas(wali.namaKelas);
    setEditKeterangan(wali.keterangan || "");
  }

  function batalEdit() {
    setEditingId(null);
    setEditNamaKelas("");
    setEditKeterangan("");
  }

  async function simpanEdit(idWali) {
    if (!editNamaKelas.trim()) {
      alert("Nama kelas wajib diisi.");
      return;
    }
    try {
      const result = await editWaliKelas({
        idWali,
        namaKelas: editNamaKelas.trim(),
        keterangan: editKeterangan.trim(),
      });
      if (result.success) {
        batalEdit();
        await loadWali(guru.id);
      } else {
        alert(result.message || "Gagal mengubah kelas wali.");
      }
    } catch (err) {
      console.error("ERROR EDIT WALI:", err);
      alert("Terjadi kesalahan saat mengubah kelas wali.");
    }
  }

  async function hapusWaliHandler(wali) {
    const konfirmasi = window.confirm(
      `Hapus Kelas Wali "${wali.namaKelas}"?\n\n` +
        `Ini akan menghapus SELURUH data presensi harian dan jurnal bimbingan ` +
        `kelas ini. Siswa tidak akan dihapus dari sistem sekolah.\n\nLanjutkan?`,
    );
    if (!konfirmasi) return;
    try {
      const result = await deleteWaliKelas({
        idGuru: guru?.id,
        idWali: wali.idWali,
      });
      if (result.success) {
        if (expandedWaliId === wali.idWali) setExpandedWaliId(null);
        alert(`✅ Kelas Wali "${wali.namaKelas}" berhasil dihapus.`);
        await loadWali(guru.id);
      } else {
        alert(result.message || "Gagal menghapus kelas wali.");
      }
    } catch (err) {
      console.error("ERROR HAPUS WALI:", err);
      alert("Terjadi kesalahan saat menghapus kelas wali.");
    }
  }

  function toggleExpand(idWali) {
    if (expandedWaliId === idWali) {
      setPendingOpenId(null);
      setShowCloseModal(true);
    } else if (expandedWaliId) {
      setPendingOpenId(idWali);
      setShowCloseModal(true);
    } else {
      setExpandedWaliId(idWali);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-xs text-center">
          <div className="mb-5 flex justify-center">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 rounded-full border-4 border-teal-200" />
              <div className="absolute inset-0 rounded-full border-4 border-teal-500 border-t-transparent animate-spin" />
            </div>
          </div>
          <p className="mb-4 text-base font-bold text-slate-600 tracking-wide">
            Memuat Data Wali Kelas...
          </p>
          <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-300 ease-out"
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
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* NAVBAR */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white shadow-md border-b border-teal-700/50">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1 rounded-xl border border-white/20">
              <span className="text-xl sm:text-2xl px-1">🏫</span>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-teal-200">
                PORTAL AKADEMIK
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-teal-300">
                KELOLA WALI KELAS — PRESENSI HARIAN
              </p>
            </div>
          </div>
          <button
            onClick={() => router.replace("/magang/guru")}
            className="rounded-xl bg-gradient-to-r from-teal-700 to-emerald-800 px-4 py-2 text-xs sm:text-sm font-black text-white border-2 border-amber-300/80 shadow-lg hover:border-amber-200 hover:brightness-110 active:scale-95 transition-all duration-300"
          >
            ⬅️ KEMBALI
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 p-6 sm:p-8 text-white shadow-md border border-teal-800">
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
              🏫 Workspace Guru Wali Kelas
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Kelola Wali Kelas & Presensi
            </h2>
            <p className="mt-2 text-sm text-teal-200 max-w-md font-medium">
              Buat kelas wali, lalu buka <b>📅 Presensi Harian</b> untuk mengisi
              kehadiran siswa per hari. Catat juga <b>📝 Jurnal Bimbingan</b>{" "}
              lengkap dengan foto berbarcode di laporan cetak.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-xs sm:text-sm font-bold text-center border border-rose-200 shadow-sm">
            ⚠️ {error}
          </div>
        )}

        {/* FORM TAMBAH KELAS WALI */}
        <section className="rounded-[1.5rem] bg-white border border-slate-200 shadow-md transition-all overflow-hidden">
          <div
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="p-4 sm:p-5 flex items-center justify-between cursor-pointer bg-gradient-to-r from-teal-600 to-emerald-600 text-white hover:brightness-110 transition-all"
          >
            <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
              ➕ TAMBAH KELAS WALI BARU
            </h2>
            <span className="font-black text-xs sm:text-sm bg-white/20 px-4 py-1.5 rounded-full border border-white/30">
              {isFormOpen ? "🔽 TUTUP" : "▶️ BUKA"}
            </span>
          </div>

          {isFormOpen && (
            <div className="p-4 sm:p-6 bg-slate-50">
              <form onSubmit={handleTambahWali} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                      Nama Kelas Wali
                    </span>
                    <input
                      type="text"
                      value={namaKelas}
                      onChange={(e) => setNamaKelas(e.target.value)}
                      placeholder="Contoh: XI TJKT 1 atau nama bebas"
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    />
                  </label>

                  <label className="block">
                    <span className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                      Kelas{" "}
                      <span className="normal-case font-medium text-slate-500">
                        (untuk sinkron siswa otomatis)
                      </span>
                    </span>
                    <select
                      value={kelasDipilih}
                      onChange={(e) => handlePilihKelas(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                    >
                      <option value="">-- Tanpa sinkron otomatis --</option>
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
                    value={keterangan}
                    onChange={(e) => setKeterangan(e.target.value)}
                    placeholder="Contoh: Semester Ganjil 2026/2027"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                  />
                </label>

                {kelasDipilih && (
                  <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                        👥 Preview Siswa Kelas {kelasDipilih}
                      </h3>
                      <span className="rounded-full bg-teal-100 px-3 py-1 text-[10px] font-black text-teal-700">
                        {previewSiswa.length} Siswa
                      </span>
                    </div>
                    {loadingPreview ? (
                      <p className="text-xs font-bold text-slate-500 py-3 text-center">
                        Memuat daftar siswa...
                      </p>
                    ) : previewSiswa.length === 0 ? (
                      <p className="text-xs font-bold text-slate-500 py-3 text-center">
                        Tidak ada siswa ditemukan untuk kelas ini.
                      </p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {previewSiswa.map((s, i) => (
                          <div
                            key={s.idSiswa || i}
                            className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-black">
                                {i + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-800 truncate">
                                {s.nama}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-black px-8 py-3.5 shadow-md transition-all disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "💾 SIMPAN KELAS WALI"}
                </button>
              </form>
            </div>
          )}
        </section>

        {/* DAFTAR KARTU KELAS WALI */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-black text-slate-800 px-1">
              🏫 Daftar Kelas Wali Anda (
              {Array.isArray(daftarWali) ? daftarWali.length : 0})
            </h2>

            {/* PENCARIAN & SEGAR KAN */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchWali}
                  onChange={(e) => setSearchWali(e.target.value)}
                  placeholder="Cari kelas..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-500 transition-all shadow-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => loadWali(guru?.id)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shrink-0 shadow-xs active:scale-95"
              >
                <span className={loading ? "animate-spin inline-block" : ""}>
                  🔄
                </span>
                <span className="hidden sm:inline">Segarkan</span>
              </button>
            </div>
          </div>

          {!Array.isArray(daftarWali) || daftarWali.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400 text-sm font-medium shadow-sm">
              Belum ada kelas wali. Tambahkan kelas wali pertama Anda di atas.
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {daftarWali
                .filter((w) => {
                  if (!searchWali.trim()) return true;
                  const q = searchWali.toLowerCase();
                  const nama = String(w.namaKelas || "").toLowerCase();
                  const kelas = String(w.kelas || "").toLowerCase();
                  const ket = String(w.keterangan || "").toLowerCase();
                  return (
                    nama.includes(q) || kelas.includes(q) || ket.includes(q)
                  );
                })
                .map((wali, idx) => {
                  const isEditing = editingId === wali.idWali;
                  const isExpanded = expandedWaliId === wali.idWali;
                  const petugas = getPetugasFromWali(wali);
                  const { cleanText } = parseKeteranganWali(
                    wali.keterangan || "",
                  );
                  const stats = statsPresensiHariIniWali[wali.idWali];
                  const isLoadingStats = loadingStatsWali[wali.idWali];
                  const totalSiswaDisplay =
                    stats?.totalSiswa || wali.jumlahSiswa || 0;

                  // Format tanggal hari ini
                  const todayStr = new Date().toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <div
                      key={wali.idWali || `wali-${idx}`}
                      className="rounded-[2rem] overflow-hidden shadow-lg border border-teal-800 bg-gradient-to-br from-teal-950 via-teal-900 to-slate-950 p-5 sm:p-6 text-white transition-all hover:shadow-2xl space-y-4"
                    >
                      {isEditing ? (
                        <div className="space-y-3 bg-white p-4 rounded-xl shadow-inner text-slate-800">
                          <input
                            value={editNamaKelas}
                            onChange={(e) => setEditNamaKelas(e.target.value)}
                            placeholder="Nama Kelas"
                            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-teal-500"
                          />
                          <input
                            value={editKeterangan}
                            onChange={(e) => setEditKeterangan(e.target.value)}
                            placeholder="Keterangan (opsional)"
                            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-xs text-slate-600 outline-none focus:border-teal-500"
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => simpanEdit(wali.idWali)}
                              className="rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-black px-5 py-2.5 shadow-md transition-colors"
                            >
                              💾 Simpan
                            </button>
                            <button
                              type="button"
                              onClick={batalEdit}
                              className="rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black px-5 py-2.5 transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* ============================================================ */}
                          {/* BAGIAN ATAS: NAMA KELAS, BADGES & TOMBOL AKSI CEPAT */}
                          {/* ============================================================ */}
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-white via-teal-100 to-emerald-200 drop-shadow-sm">
                                  {wali.namaKelas}
                                </h3>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                {wali.kelas && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-800/60 border border-teal-500/40 text-teal-100">
                                    Kelas {wali.kelas}
                                  </span>
                                )}
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-800/60 border border-emerald-500/40 text-emerald-100">
                                  👥 {totalSiswaDisplay} Siswa
                                </span>
                                {petugas?.namaSiswa && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/25 border border-amber-300/50 text-amber-200 shadow-xs">
                                    ⭐ Petugas: {petugas.namaSiswa}
                                  </span>
                                )}
                              </div>

                              {cleanText && (
                                <p className="text-xs text-teal-200/90 font-medium italic pt-0.5">
                                  {cleanText}
                                </p>
                              )}
                            </div>

                            {/* TOMBOL AKSI KANAN */}
                            <div className="flex gap-2 flex-wrap shrink-0 mt-1 md:mt-0 items-center">
                              <button
                                type="button"
                                onClick={() => setWaliPetugasTarget(wali)}
                                title="Tunjuk siswa sebagai petugas presensi kelas ini"
                                className="rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:brightness-110 active:scale-95 px-3.5 py-2 sm:py-2.5 text-xs font-black text-amber-950 border border-amber-300/60 shadow-md transition-all flex items-center gap-1.5"
                              >
                                <span>⭐</span>
                                <span>Petugas Presensi</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWaliTambahTarget(wali)}
                                title="Tambah / Daftarkan Siswa ke Kelas Wali Ini"
                                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 px-3.5 py-2 sm:py-2.5 text-xs font-black text-white border border-emerald-400/40 shadow-md transition-all flex items-center gap-1.5"
                              >
                                <span>➕</span>
                                <span>Tambah Siswa</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setWaliJurnalTarget(wali)}
                                title="Catat Jurnal Bimbingan Siswa"
                                className="rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:brightness-110 active:scale-95 px-3.5 py-2 sm:py-2.5 text-xs font-black text-white border border-indigo-400/40 shadow-md transition-all flex items-center gap-1.5"
                              >
                                <span>📝</span>
                                <span>Jurnal</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCetakPDF(wali)}
                                disabled={cetakLoadingId === wali.idWali}
                                title="Cetak Laporan Presensi PDF"
                                className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:brightness-110 active:scale-95 px-3.5 py-2 sm:py-2.5 text-xs font-black text-white border border-fuchsia-400/40 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60"
                              >
                                {cetakLoadingId === wali.idWali ? (
                                  <>
                                    <span className="inline-block animate-spin">
                                      ⏳
                                    </span>
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
                                onClick={() => mulaiEdit(wali)}
                                title="Edit nama kelas dan keterangan"
                                className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-3 py-2 sm:py-2.5 text-xs font-black text-amber-200 hover:bg-amber-500/40 transition-colors flex items-center gap-1.5 active:scale-95"
                              >
                                <span>✏️</span>
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => hapusWaliHandler(wali)}
                                title="Hapus kelas wali"
                                className="rounded-xl bg-rose-500/20 border border-rose-400/40 px-3 py-2 sm:py-2.5 text-xs font-black text-rose-200 hover:bg-rose-500/40 transition-colors flex items-center gap-1.5 active:scale-95"
                              >
                                <span>🗑️</span>
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>

                          {/* ============================================================ */}
                          {/* PANEL STATISTIK PRESENSI HARI INI (PADAT & COMPACT) */}
                          {/* ============================================================ */}
                          <div className="rounded-2xl border border-teal-700/60 bg-teal-950/70 p-3.5 sm:p-4 space-y-3 backdrop-blur-xs">
                            {/* Header Bar Statistik */}
                            <div className="flex items-center justify-between gap-2 border-b border-teal-800/60 pb-2.5 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-base">📊</span>
                                <div>
                                  <span className="text-xs font-black tracking-wide text-white block sm:inline">
                                    Presensi Hari Ini
                                  </span>
                                  <span className="text-[11px] text-teal-200/80 font-medium sm:ml-2">
                                    ({todayStr})
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isLoadingStats ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-teal-800/70 text-teal-200 text-[10px] font-bold animate-pulse">
                                    ⏳ Memeriksa...
                                  </span>
                                ) : stats?.sudahDiisi ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                                    ✅ Sudah Diisi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[10px] font-bold">
                                    ⚪ Belum Diisi
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Mini Counters Grid (Padat 5 Kolom) */}
                            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                              <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                                  Hadir
                                </span>
                                <span className="text-xs sm:text-base font-black text-emerald-100">
                                  {stats?.hadir || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-blue-950/60 border border-blue-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-blue-300 tracking-wider">
                                  Sakit
                                </span>
                                <span className="text-xs sm:text-base font-black text-blue-100">
                                  {stats?.sakit || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-amber-950/60 border border-amber-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-amber-300 tracking-wider">
                                  Izin
                                </span>
                                <span className="text-xs sm:text-base font-black text-amber-100">
                                  {stats?.izin || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-rose-300 tracking-wider">
                                  Alfa
                                </span>
                                <span className="text-xs sm:text-base font-black text-rose-100">
                                  {stats?.alfa || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-violet-950/60 border border-violet-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-violet-300 tracking-wider">
                                  Cabut
                                </span>
                                <span className="text-xs sm:text-base font-black text-violet-100">
                                  {stats?.cabut || 0}
                                </span>
                              </div>
                            </div>

                            {/* Daftar Siswa Sakit, Izin, Alfa, Cabut Hari Ini (Padat & Compact) */}
                            <div className="pt-1">
                              {stats?.sudahDiisi ? (
                                stats?.absenList?.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                        <span>⚠️</span>
                                        <span>
                                          Siswa Tidak Hadir Hari Ini (
                                          {stats.absenList.length}):
                                        </span>
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
                                      {stats.absenList.map((item, i) => {
                                        let colorStyle =
                                          "bg-rose-500/20 text-rose-200 border-rose-500/40";
                                        if (item.status === "Sakit") {
                                          colorStyle =
                                            "bg-blue-500/20 text-blue-200 border-blue-500/40";
                                        } else if (item.status === "Izin") {
                                          colorStyle =
                                            "bg-amber-500/20 text-amber-200 border-amber-500/40";
                                        } else if (item.status === "Cabut") {
                                          colorStyle =
                                            "bg-violet-500/20 text-violet-200 border-violet-500/40";
                                        }

                                        return (
                                          <div
                                            key={i}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border font-bold shadow-xs ${colorStyle}`}
                                          >
                                            <span className="text-[9px] font-black uppercase px-1 py-0.5 rounded bg-black/40 tracking-wider">
                                              {item.status}
                                            </span>
                                            <span className="truncate max-w-[150px] sm:max-w-[220px]">
                                              {item.nama}
                                            </span>
                                            {item.keterangan && (
                                              <span className="text-[10px] text-white/60 font-medium italic truncate max-w-[120px]">
                                                ({item.keterangan})
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-3 py-2">
                                    <span>✨</span>
                                    <span>
                                      Semua siswa hadir hari ini (
                                      {totalSiswaDisplay} siswa) — Nihil Absen.
                                    </span>
                                  </div>
                                )
                              ) : (
                                <div className="text-[11px] text-teal-200/80 font-medium italic flex items-center gap-1.5 bg-teal-900/30 rounded-xl px-3 py-1.5">
                                  <span>💡</span>
                                  <span>
                                    Presensi hari ini belum diisi. Gunakan
                                    tombol di bawah untuk membuka tabel presensi
                                    kelas.
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ============================================================ */}
                          {/* TOMBOL UTAMA: BUKA / TUTUP PRESENSI HARIAN KELAS */}
                          {/* ============================================================ */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(wali.idWali)}
                            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-black shadow-md border transition-all cursor-pointer active:scale-[0.99] ${
                              isExpanded
                                ? "bg-slate-800 text-amber-300 border-amber-400/40 hover:bg-slate-700"
                                : "bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:brightness-110 text-amber-950 border-amber-300"
                            }`}
                          >
                            <span>{isExpanded ? "🔽" : "📅"}</span>
                            <span>
                              {isExpanded
                                ? "TUTUP PRESENSI HARIAN"
                                : "BUKA PRESENSI HARIAN"}
                            </span>
                          </button>
                        </>
                      )}

                      {/* ============================================================ */}
                      {/* TABEL PRESENSI GRID SAAT DI-EXPAND */}
                      {/* ============================================================ */}
                      {isExpanded && !isEditing && (
                        <div className="bg-slate-50 border-t border-teal-800 rounded-2xl p-2 sm:p-4 text-slate-800 shadow-inner overflow-hidden">
                          <PresensiWaliGrid
                            ref={activeGridRef}
                            guru={guru}
                            wali={wali}
                            onBukaTambah={() => setWaliTambahTarget(wali)}
                            onPresensiSaved={() =>
                              loadStatsHariIniWali(wali.idWali)
                            }
                            onClose={() => {
                              setExpandedWaliId(pendingOpenId);
                              setPendingOpenId(null);
                              setShowCloseModal(false);
                              loadStatsHariIniWali(wali.idWali);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </section>

        {/* MODAL KONFIRMASI TUTUP */}
        {showCloseModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="font-black text-slate-800 text-lg mb-2">
                Simpan Perubahan?
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 font-medium leading-relaxed">
                Apakah Bapak/Ibu ingin menyimpan data presensi sebelum menutup
                tabel ini?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (activeGridRef.current) {
                      activeGridRef.current.triggerSimpan();
                    }
                  }}
                  className="w-full rounded-xl bg-teal-600 text-white text-xs sm:text-sm font-black py-3 hover:bg-teal-700 transition-colors shadow-sm"
                >
                  💾 Simpan & Tutup
                </button>
                <button
                  onClick={() => {
                    setExpandedWaliId(pendingOpenId);
                    setPendingOpenId(null);
                    setShowCloseModal(false);
                  }}
                  className="w-full rounded-xl bg-rose-50 text-rose-600 border border-rose-200 text-xs sm:text-sm font-black py-3 hover:bg-rose-100 transition-colors"
                >
                  🗑️ Tutup Tanpa Simpan
                </button>
                <button
                  onClick={() => {
                    setShowCloseModal(false);
                    setPendingOpenId(null);
                  }}
                  className="w-full rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-xs sm:text-sm font-black py-3 hover:bg-slate-100 mt-2 transition-colors"
                >
                  Batal (Kembali)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL TAMBAH SISWA */}
        <ModalTambahSiswaWali
          key={waliTambahTarget?.idWali || "closed"}
          isOpen={!!waliTambahTarget}
          onClose={() => setWaliTambahTarget(null)}
          guru={guru}
          wali={waliTambahTarget}
          onSiswaAdded={() => {
            if (activeGridRef.current?.reloadGrid) {
              activeGridRef.current.reloadGrid();
            }
            loadWali(guru?.id);
            if (waliTambahTarget?.idWali) {
              loadStatsHariIniWali(waliTambahTarget.idWali);
            }
          }}
        />

        {/* MODAL JURNAL */}
        <ModalJurnalWaliKelas
          key={
            waliJurnalTarget?.idWali
              ? `j-${waliJurnalTarget.idWali}`
              : "j-closed"
          }
          isOpen={!!waliJurnalTarget}
          onClose={() => setWaliJurnalTarget(null)}
          guru={guru}
          wali={waliJurnalTarget}
          onSaved={() => {
            alert("✅ Jurnal bimbingan berhasil disimpan.");
          }}
        />

        {/* MODAL PETUGAS PRESENSI */}
        {waliPetugasTarget && (
          <ModalPilihPetugasPresensi
            isOpen={!!waliPetugasTarget}
            onClose={() => setWaliPetugasTarget(null)}
            guru={guru}
            wali={waliPetugasTarget}
            onPetugasUpdated={(updatedWali) => {
              setDaftarWali((prev) =>
                prev.map((w) =>
                  w.idWali === updatedWali.idWali
                    ? { ...w, keterangan: updatedWali.keterangan }
                    : w,
                ),
              );
              loadWali(guru?.id);
            }}
          />
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `,
        }}
      />
    </div>
  );
}

// =========================================================================
// KOMPONEN: TABEL PRESENSI HARIAN (per Tanggal)
// =========================================================================
const PresensiWaliGrid = forwardRef(function PresensiWaliGrid(
  { guru, wali, onBukaTambah, onClose, onPresensiSaved },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [siswaList, setSiswaList] = useState([]);
  const [grid, setGrid] = useState({});
  const [daftarTanggal, setDaftarTanggal] = useState([]);
  const [saving, setSaving] = useState(false);
  const [menghapusId, setMenghapusId] = useState(null);
  const [tanggalBaru, setTanggalBaru] = useState("");

  useImperativeHandle(ref, () => ({
    triggerSimpan: async () => {
      await handleSimpanPresensi();
      if (onClose) onClose();
    },
    reloadGrid: () => {
      loadGrid();
    },
  }));

  useEffect(() => {
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wali.idWali]);

  async function loadGrid() {
    try {
      setLoading(true);
      const result = await getPresensiWaliGrid(guru.id, wali.idWali);
      const data = result.success ? result.data : { siswa: [], presensi: [] };

      // GAS mengembalikan namaSiswa, normalize ke nama untuk konsistensi frontend
      const daftarSiswa = (data.siswa || [])
        .slice()
        .map((s) => ({ ...s, nama: s.namaSiswa || s.nama || "" }))
        .sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
      setSiswaList(daftarSiswa);

      const gridBaru = {};
      const tanggalSet = new Set();

      (data.presensi || []).forEach((p) => {
        if (!p.tanggal) return;
        tanggalSet.add(p.tanggal);
        const key = `${p.idSiswa}_${p.tanggal}`;
        gridBaru[key] = {
          status: p.status || "",
          keterangan: p.keterangan || "",
        };
      });

      setGrid(gridBaru);
      const sortedTanggal = Array.from(tanggalSet).sort();
      setDaftarTanggal(sortedTanggal);
    } catch (err) {
      console.error("ERROR LOAD GRID PRESENSI WALI:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateCell(idSiswa, tanggal, field, value) {
    const key = `${idSiswa}_${tanggal}`;
    setGrid((prev) => {
      const current = prev[key] || { status: "", keterangan: "" };
      return { ...prev, [key]: { ...current, [field]: value } };
    });
  }

  function tambahHari() {
    const today = new Date().toLocaleDateString("en-CA");
    const tgl = tanggalBaru || today;
    if (daftarTanggal.includes(tgl)) {
      alert(`Tanggal ${tgl} sudah ada di tabel.`);
      return;
    }
    const newList = [...daftarTanggal, tgl].sort();
    setDaftarTanggal(newList);

    // Default Hadir untuk semua siswa di tanggal baru
    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        const key = `${s.idSiswa}_${tgl}`;
        if (!salinan[key] || !salinan[key].status) {
          salinan[key] = { status: "Hadir", keterangan: "" };
        }
      });
      return salinan;
    });
    setTanggalBaru("");
  }

  function hapusHariTerakhir() {
    if (daftarTanggal.length === 0) return;
    const tglHapus = daftarTanggal[daftarTanggal.length - 1];
    const konfirmasi = window.confirm(
      `⚠️ Hapus kolom tanggal ${formatTanggalKolom(tglHapus)} (${tglHapus})?\n\n` +
        `Data presensi hari ini akan dihapus. Lanjutkan?`,
    );
    if (!konfirmasi) return;

    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        delete salinan[`${s.idSiswa}_${tglHapus}`];
      });
      return salinan;
    });
    setDaftarTanggal((prev) => prev.slice(0, -1));
  }

  function hitungTotal(idSiswa) {
    const total = { Hadir: 0, Sakit: 0, Izin: 0, Alfa: 0, Cabut: 0 };
    daftarTanggal.forEach((tgl) => {
      const cell = grid[`${idSiswa}_${tgl}`];
      if (cell?.status && total[cell.status] !== undefined) {
        total[cell.status]++;
      }
    });
    return total;
  }

  async function handleSimpanPresensi() {
    const cells = [];
    daftarTanggal.forEach((tgl) => {
      siswaList.forEach((s) => {
        const cell = grid[`${s.idSiswa}_${tgl}`];
        if (!cell?.status) return;
        cells.push({
          idSiswa: s.idSiswa,
          namaSiswa: s.nama,
          tanggal: tgl,
          status: cell.status,
          keterangan: cell.keterangan || "",
        });
      });
    });

    if (cells.length === 0) {
      alert("Belum ada data presensi yang diisi.");
      return;
    }

    setSaving(true);
    try {
      const result = await savePresensiWaliKelas({
        idGuru: guru.id,
        idWali: wali.idWali,
        cells,
      });
      if (result.success) {
        alert(
          `✅ Presensi tersimpan.\nTotal: ${result.data?.tersimpan || cells.length} data diproses.`,
        );
        if (onPresensiSaved) onPresensiSaved();
      } else {
        alert(result.message || "Gagal menyimpan presensi.");
      }
    } catch (err) {
      console.error("ERROR SIMPAN PRESENSI WALI:", err);
      alert("Terjadi kesalahan saat menyimpan presensi.");
    } finally {
      setSaving(false);
    }
  }

  async function hapusSiswaDariWali(siswa) {
    const konfirmasi = window.confirm(
      `Hapus "${siswa.nama}" dari Kelas Wali "${wali.namaKelas}"?\n\n` +
        `Data presensi dan jurnal bimbingan siswa ini di kelas wali ini akan ikut terhapus. ` +
        `Data siswa di sistem sekolah tetap aman.\n\nLanjutkan?`,
    );
    if (!konfirmasi) return;

    setMenghapusId(siswa.idSiswa);
    try {
      const result = await hapusSiswaWaliKelas({
        idWali: wali.idWali,
        idSiswa: siswa.idSiswa,
      });
      if (result.success) {
        setSiswaList((prev) => prev.filter((s) => s.idSiswa !== siswa.idSiswa));
        setGrid((prev) => {
          const salinan = { ...prev };
          Object.keys(salinan).forEach((key) => {
            if (key.startsWith(`${siswa.idSiswa}_`)) delete salinan[key];
          });
          return salinan;
        });
        alert(`✅ "${siswa.nama}" dihapus dari kelas wali ini.`);
        if (onPresensiSaved) onPresensiSaved();
      } else {
        alert(result.message || "Gagal menghapus siswa dari kelas wali.");
      }
    } catch (err) {
      console.error("ERROR HAPUS SISWA WALI:", err);
      alert("Terjadi kesalahan saat menghapus siswa.");
    } finally {
      setMenghapusId(null);
    }
  }

  return (
    <div className="mt-1 rounded-2xl bg-white p-2 sm:p-4 overflow-hidden">
      {loading ? (
        <p className="text-center text-xs font-bold text-slate-400 py-6">
          Memuat tabel presensi harian...
        </p>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-[10px] sm:text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl">
                👥 {siswaList.length} Siswa
              </p>
              <p className="text-[10px] sm:text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl">
                📅 {daftarTanggal.length} Hari
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {/* Tambah Hari */}
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={tanggalBaru}
                  onChange={(e) => setTanggalBaru(e.target.value)}
                  className="rounded-lg border border-slate-300 text-[10px] sm:text-xs px-2 py-1.5 h-[34px] outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
                <button
                  onClick={tambahHari}
                  className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] sm:text-[11px] font-black px-3 py-1.5 h-[34px] shadow-sm transition-all whitespace-nowrap"
                  title="Tambah kolom hari baru"
                >
                  ➕ Tambah Hari
                </button>
              </div>
              <button
                onClick={hapusHariTerakhir}
                disabled={daftarTanggal.length === 0}
                className="rounded-xl bg-rose-100 border border-rose-300 text-rose-700 text-[10px] sm:text-[11px] font-black px-3 py-1.5 h-[34px] hover:bg-rose-200 disabled:opacity-50 transition-all shadow-sm whitespace-nowrap"
                title="Hapus kolom hari terakhir"
              >
                ➖ Hapus Terakhir
              </button>
              <button
                onClick={() => onBukaTambah && onBukaTambah()}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 active:scale-95 text-white text-[10px] sm:text-[11px] font-black px-3 py-1.5 h-[34px] shadow-md transition-all whitespace-nowrap"
              >
                ➕ Tambah Siswa
              </button>
              <button
                onClick={handleSimpanPresensi}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:brightness-110 text-white text-[10px] sm:text-[11px] font-black px-3 py-1.5 h-[34px] shadow-md disabled:opacity-60 transition-all whitespace-nowrap"
              >
                {saving ? "Menyimpan..." : "💾 Simpan"}
              </button>
            </div>
          </div>

          {siswaList.length === 0 ? (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-8 text-center text-xs sm:text-sm font-bold text-slate-400 shadow-inner">
              Belum ada siswa. Klik &quot;➕ Tambah Siswa&quot; untuk mulai.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden relative w-full">
              <div
                className="overflow-auto custom-scrollbar relative h-[70vh] overscroll-contain touch-pan-x touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                <table className="border-separate border-spacing-0 whitespace-nowrap text-[9px] sm:text-[10px] min-w-max w-full">
                  <thead className="bg-slate-100 text-slate-800 shadow-sm leading-none">
                    <tr>
                      <th className="px-1 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-0 bg-slate-100 z-[70] w-[28px] sm:w-[32px] min-w-[28px] text-center">
                        No
                      </th>
                      <th
                        className="px-1.5 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-[28px] sm:left-[32px] bg-slate-100 z-[80] text-left shadow-[5px_0_10px_-5px_rgba(0,0,0,0.1)] w-[190px] min-w-[190px] max-w-[190px]"
                        style={{ position: "sticky", left: "28px", zIndex: 80 }}
                      >
                        Nama Siswa
                      </th>

                      {daftarTanggal.map((tgl, idx) => (
                        <th
                          key={tgl}
                          className="px-0.5 py-1.5 font-black border-b-2 border-slate-300 border-l border-slate-200 text-center min-w-[50px] sm:min-w-[55px] sticky top-0 bg-slate-100 z-40"
                        >
                          <div className="text-[9px] sm:text-[10px] text-slate-800">
                            <span className="bg-teal-100 text-teal-800 px-1 py-0.5 rounded text-[9px]">
                              {formatTanggalKolom(tgl)}
                            </span>
                          </div>
                        </th>
                      ))}

                      {/* Kolom Total */}
                      <th className="px-1 py-1 font-black border-b-2 border-slate-300 border-l-2 border-slate-300 text-center sticky top-0 bg-slate-200/80 z-50">
                        <div className="w-[100px] min-w-[100px] max-w-[100px] mx-auto">
                          <div className="text-[9px] sm:text-[10px] mb-0.5 uppercase tracking-widest text-slate-600">
                            TOTAL
                          </div>
                          <div className="flex items-center justify-center gap-1 text-[9px] leading-none bg-white py-0.5 rounded shadow-sm border border-slate-200">
                            <span
                              className="w-4 text-emerald-700"
                              title="Hadir"
                            >
                              H
                            </span>
                            <span className="w-4 text-blue-700" title="Sakit">
                              S
                            </span>
                            <span className="w-4 text-amber-600" title="Izin">
                              I
                            </span>
                            <span className="w-4 text-rose-700" title="Alfa">
                              A
                            </span>
                            <span className="w-4 text-violet-700" title="Cabut">
                              C
                            </span>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {siswaList.map((s, idx) => {
                      const total = hitungTotal(s.idSiswa);
                      const isEven = idx % 2 === 1;
                      const totalPertemuan = daftarTanggal.length;
                      const persen =
                        totalPertemuan > 0
                          ? Math.round((total.Hadir / totalPertemuan) * 100)
                          : 0;

                      return (
                        <tr
                          key={s.idSiswa}
                          className={`transition-colors group ${
                            isEven
                              ? "bg-slate-50/70 hover:bg-teal-50 focus-within:bg-teal-50"
                              : "bg-white hover:bg-teal-50 focus-within:bg-teal-50"
                          }`}
                        >
                          <td
                            className={`px-1 py-1 border-b border-slate-200 sticky left-0 group-hover:bg-teal-50 group-focus-within:bg-teal-50 z-[70] font-bold text-center text-slate-600 w-[28px] sm:w-[32px] min-w-[28px] transition-colors ${
                              isEven ? "bg-slate-50" : "bg-white"
                            }`}
                          >
                            {idx + 1}
                          </td>

                          <td
                            className={`px-1.5 py-1 border-b border-slate-200 sticky left-[28px] sm:left-[32px] group-hover:bg-teal-50 group-focus-within:bg-teal-50 z-[60] shadow-[5px_0_10px_-5px_rgba(0,0,0,0.08)] w-[190px] min-w-[190px] max-w-[190px] transition-colors ${
                              isEven ? "bg-slate-50" : "bg-white"
                            }`}
                            style={{
                              position: "sticky",
                              left: "28px",
                              zIndex: 60,
                            }}
                          >
                            <div className="flex flex-col justify-center h-full w-full min-w-0 overflow-hidden">
                              <p
                                className="font-black text-slate-800 text-[10px] sm:text-[11px] leading-none truncate w-full"
                                title={s.nama}
                              >
                                {s.nama}
                              </p>
                              <div className="flex items-center justify-between mt-0.5 w-full">
                                <div className="flex items-center gap-1 min-w-0 overflow-hidden mr-1">
                                  {s.kelas && (
                                    <span className="truncate rounded bg-teal-50 text-teal-700 border border-teal-200 px-1 py-0 text-[7px] font-bold">
                                      {s.kelas}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => hapusSiswaDariWali(s)}
                                  disabled={menghapusId === s.idSiswa}
                                  title="Hapus siswa dari kelas wali"
                                  className="shrink-0 flex h-4 w-4 items-center justify-center rounded bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white text-[8px] disabled:opacity-50 transition-all shadow-sm"
                                >
                                  {menghapusId === s.idSiswa ? "⏳" : "✕"}
                                </button>
                              </div>
                            </div>
                          </td>

                          {daftarTanggal.map((tgl) => {
                            const key = `${s.idSiswa}_${tgl}`;
                            const cell = grid[key] || {
                              status: "",
                              keterangan: "",
                            };

                            return (
                              <td
                                key={tgl}
                                className="p-0.5 border-b border-slate-200 border-l border-slate-200/80 text-center align-middle hover:bg-teal-100/70 focus-within:bg-teal-100/80 transition-colors"
                              >
                                <select
                                  value={cell.status}
                                  onChange={(e) =>
                                    updateCell(
                                      s.idSiswa,
                                      tgl,
                                      "status",
                                      e.target.value,
                                    )
                                  }
                                  className={`cursor-pointer rounded border text-[9px] sm:text-[10px] font-black h-[21px] px-0.5 shadow-sm hover:scale-105 transition-all appearance-none outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600 w-[50px] ${warnaStatus(cell.status)}`}
                                  style={{ textAlignLast: "center" }}
                                >
                                  <option hidden value={cell.status}>
                                    {cell.status ? cell.status.charAt(0) : "-"}
                                  </option>
                                  <option
                                    value=""
                                    className="bg-white text-slate-800"
                                  >
                                    -
                                  </option>
                                  {STATUS_OPTIONS.map((opt) => (
                                    <option
                                      key={opt.value}
                                      value={opt.value}
                                      className="bg-white text-slate-800"
                                    >
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            );
                          })}

                          {/* Total */}
                          <td
                            className={`px-1 py-1 border-b border-l-2 border-slate-200 group-hover:bg-teal-50 group-focus-within:bg-teal-50 transition-colors text-center ${
                              isEven ? "bg-slate-100/70" : "bg-slate-50/50"
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1 w-[100px] min-w-[100px] max-w-[100px] mx-auto leading-none">
                              <span className="w-4 text-[10px] font-black text-emerald-600 bg-emerald-100 py-0.5 rounded">
                                {total.Hadir}
                              </span>
                              <span className="w-4 text-[10px] font-black text-blue-600 bg-blue-100 py-0.5 rounded">
                                {total.Sakit}
                              </span>
                              <span className="w-4 text-[10px] font-black text-amber-600 bg-amber-100 py-0.5 rounded">
                                {total.Izin}
                              </span>
                              <span className="w-4 text-[10px] font-black text-rose-600 bg-rose-100 py-0.5 rounded">
                                {total.Alfa}
                              </span>
                              <span className="w-4 text-[10px] font-black text-violet-600 bg-violet-100 py-0.5 rounded">
                                {total.Cabut}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
});
