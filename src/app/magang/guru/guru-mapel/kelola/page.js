"use client";

import {
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useRouter } from "next/navigation";
import { getSession, isLoggedIn } from "../../../lib/auth";
import {
  getMapelByGuru,
  addMapel,
  editMapel,
  deleteMapel,
  getKelasSiswaMapel,
  getSiswaByKelasMapel,
  getPresensiMapelGrid,
  getSemuaSiswaUntukTambahMapel,
  simpanSiswaMapel,
  hapusSiswaMapel,
  savePresensiMapel,
  addSiswa,
} from "../../../lib/api";

const PERTEMUAN_MAX = 20;
const NILAI_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 5); // Kelipatan 5 hingga 100

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
      return "bg-blue-500 text-white border-blue-600";
    case "Izin":
      return "bg-amber-500 text-white border-amber-600";
    case "Alfa":
      return "bg-rose-500 text-white border-rose-600";
    case "Cabut":
      return "bg-violet-500 text-white border-violet-600";
    default:
      return "bg-slate-50 text-slate-400 border-slate-200";
  }
}

export default function KelolaMapelPage() {
  const router = useRouter();

  const [guru, setGuru] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [daftarMapel, setDaftarMapel] = useState([]);

  // State untuk Card Tambah Mapel
  const [isFormMapelOpen, setIsFormMapelOpen] = useState(false);
  const [namaMapel, setNamaMapel] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [kelasDipilih, setKelasDipilih] = useState("");
  const [saving, setSaving] = useState(false);

  const [daftarKelas, setDaftarKelas] = useState([]);
  const [loadingKelas, setLoadingKelas] = useState(true);

  const [previewSiswa, setPreviewSiswa] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editNama, setEditNama] = useState("");
  const [editKeterangan, setEditKeterangan] = useState("");

  const [mapelAktifId, setMapelAktifId] = useState("");
  const [expandedMapelId, setExpandedMapelId] = useState(null);

  // State Modal Tutup Presensi
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [pendingOpenId, setPendingOpenId] = useState(null);
  const activeGridRef = useRef(null);

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
    setMapelAktifId(localStorage.getItem("mapelAktifId") || "");
    loadMapel(session.id);
    loadKelas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadMapel(idGuru) {
    try {
      setLoading(true);
      setError("");
      const result = await getMapelByGuru(idGuru);
      if (result.success) {
        setDaftarMapel(result.data || []);
      } else {
        setError(result.message || "Gagal mengambil data mapel.");
      }
    } catch (err) {
      console.error("ERROR LOAD MAPEL:", err);
      setError("Terjadi kesalahan saat mengambil data mapel.");
    } finally {
      setLoading(false);
    }
  }

  async function loadKelas() {
    try {
      setLoadingKelas(true);
      const result = await getKelasSiswaMapel();
      if (result.success) setDaftarKelas(result.data || []);
    } catch (err) {
      console.error("ERROR LOAD KELAS:", err);
    } finally {
      setLoadingKelas(false);
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
    } catch (err) {
      console.error("ERROR PREVIEW SISWA KELAS:", err);
      setPreviewSiswa([]);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleTambahMapel(e) {
    e.preventDefault();
    if (!namaMapel.trim()) {
      alert("Nama mapel wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const result = await addMapel({
        idGuru: guru.id,
        namaMapel: namaMapel.trim(),
        kelas: kelasDipilih || "",
        keterangan: keterangan.trim(),
      });

      if (result.success) {
        const jumlah = result.data?.jumlahSiswaOtomatis || 0;
        if (kelasDipilih) {
          alert(
            `✅ Mapel "${namaMapel.trim()}" berhasil dibuat untuk kelas ${kelasDipilih}.\n\n` +
              `${jumlah} siswa dari kelas tersebut otomatis dimasukkan ke mapel ini.`,
          );
        }
        setNamaMapel("");
        setKeterangan("");
        setKelasDipilih("");
        setPreviewSiswa([]);
        setIsFormMapelOpen(false); // Tutup form setelah berhasil
        await loadMapel(guru.id);
      } else {
        alert(result.message || "Gagal menambahkan mapel.");
      }
    } catch (err) {
      console.error("ERROR TAMBAH MAPEL:", err);
      alert("Terjadi kesalahan saat menambahkan mapel.");
    } finally {
      setSaving(false);
    }
  }

  function mulaiEdit(mapel) {
    setEditingId(mapel.idMapel);
    setEditNama(mapel.namaMapel);
    setEditKeterangan(mapel.keterangan || "");
  }

  function batalEdit() {
    setEditingId(null);
    setEditNama("");
    setEditKeterangan("");
  }

  async function simpanEdit(idMapel) {
    if (!editNama.trim()) {
      alert("Nama mapel wajib diisi.");
      return;
    }
    try {
      const result = await editMapel({
        idMapel,
        namaMapel: editNama.trim(),
        keterangan: editKeterangan.trim(),
      });

      if (result.success) {
        if (mapelAktifId === idMapel) {
          localStorage.setItem("mapelAktifNama", editNama.trim());
        }
        batalEdit();
        await loadMapel(guru.id);
      } else {
        alert(result.message || "Gagal mengubah mapel.");
      }
    } catch (err) {
      console.error("ERROR EDIT MAPEL:", err);
      alert("Terjadi kesalahan saat mengubah mapel.");
    }
  }

  async function hapusMapelHandler(mapel) {
    const konfirmasi = window.confirm(
      `Hapus mapel "${mapel.namaMapel}"${mapel.kelas ? ` (${mapel.kelas})` : ""}?\n\n` +
        `Ini akan menghapus SELURUH siswa yang terdaftar di mapel ini juga, ` +
        `mengikuti ketentuan yang sama seperti hapus siswa satu-per-satu:\n` +
        `• Siswa yang TIDAK punya Guru Pembimbing Magang & TIDAK punya Guru Wali ` +
        `akan dihapus PERMANEN dari database sekolah.\n` +
        `• Siswa yang masih punya salah satunya akan tetap aman di sistem, hanya ` +
        `dilepas dari mapel ini.\n\n` +
        `Histori presensi, nilai, dan pembinaan mapel ini juga akan terhapus. Lanjutkan?`,
    );
    if (!konfirmasi) return;

    try {
      const result = await deleteMapel({ idMapel: mapel.idMapel });
      if (result.success) {
        if (mapelAktifId === mapel.idMapel) {
          localStorage.removeItem("mapelAktifId");
          localStorage.removeItem("mapelAktifNama");
          setMapelAktifId("");
        }
        if (expandedMapelId === mapel.idMapel) setExpandedMapelId(null);

        const total = result.data?.totalSiswa ?? 0;
        const permanen = result.data?.dihapusPermanen ?? 0;
        const mapelSaja = result.data?.dihapusDariMapelSaja ?? 0;
        alert(
          `✅ Mapel "${mapel.namaMapel}" berhasil dihapus.\n\n` +
            `Total siswa terdampak: ${total}\n` +
            `• Dihapus permanen dari sistem: ${permanen}\n` +
            `• Dilepas dari mapel saja (data tetap aman): ${mapelSaja}`,
        );

        await loadMapel(guru.id);
      } else {
        alert(result.message || "Gagal menghapus mapel.");
      }
    } catch (err) {
      console.error("ERROR HAPUS MAPEL:", err);
      alert("Terjadi kesalahan saat menghapus mapel.");
    }
  }

  function pilihMapelAktif(mapel) {
    localStorage.setItem("mapelAktifId", mapel.idMapel);
    localStorage.setItem("mapelAktifNama", mapel.namaMapel);
    setMapelAktifId(mapel.idMapel);
  }

  function toggleExpand(idMapel) {
    if (expandedMapelId === idMapel) {
      // Menutup tabel yang sedang terbuka
      setPendingOpenId(null);
      setShowCloseModal(true);
    } else if (expandedMapelId) {
      // Ada tabel mapel LAIN yang masih terbuka -> konfirmasi dulu
      // supaya perubahan yang belum disimpan di tabel lama tidak hilang.
      setPendingOpenId(idMapel);
      setShowCloseModal(true);
    } else {
      setExpandedMapelId(idMapel);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="relative mx-auto h-14 w-14">
            <div className="absolute inset-0 rounded-full border-4 border-amber-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 text-base font-bold text-slate-600 tracking-wide">
            Memuat Data Mapel...
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* NAVBAR STICKY MODEL JS GURU */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-md border-b border-blue-700/50">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-1 rounded-xl border border-white/20">
              <span className="text-xl sm:text-2xl px-1">📚</span>
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                PORTAL AKADEMIK
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300">
                KELOLA MATA PELAJARAN
              </p>
            </div>
          </div>

          <button
            onClick={() => router.replace("/magang/guru")}
            className="rounded-xl bg-gradient-to-r from-blue-700 to-indigo-800 px-4 py-2 text-xs sm:text-sm font-black text-white border-2 border-amber-300/80 shadow-lg hover:border-amber-200 hover:brightness-110 active:scale-95 transition-all duration-300"
          >
            ⬅️ KEMBALI
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-6">
        {/* HERO SECTION */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900 p-6 sm:p-8 text-white shadow-md border border-blue-800">
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-4 border border-amber-400/30">
              ✨ Workspace Guru Mapel
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Kelola Mapel & Presensi
            </h2>
            <p className="mt-2 text-sm text-blue-200 max-w-md font-medium">
              Buat mapel, lalu buka <b>📊 Presensi & Nilai</b> pada tiap kartu
              untuk mengisi kehadiran dan nilai harian per pertemuan.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 text-rose-700 p-3 text-xs sm:text-sm font-bold text-center border border-rose-200 shadow-sm">
            ⚠️ {error}
          </div>
        )}

        {/* SECTION TAMBAH MAPEL */}
        <section className="rounded-[1.5rem] bg-white border border-slate-200 shadow-md transition-all overflow-hidden">
          <div
            onClick={() => setIsFormMapelOpen(!isFormMapelOpen)}
            className="p-4 sm:p-5 flex items-center justify-between cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:brightness-110 transition-all"
          >
            <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
              ➕ TAMBAH MAPEL BARU
            </h2>
            <span className="font-black text-xs sm:text-sm bg-white/20 px-4 py-1.5 rounded-full border border-white/30">
              {isFormMapelOpen ? "🔽 TUTUP" : "▶️ BUKA"}
            </span>
          </div>

          {isFormMapelOpen && (
            <div className="p-4 sm:p-6 bg-slate-50">
              <form onSubmit={handleTambahMapel} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                      Nama Mapel
                    </span>
                    <input
                      type="text"
                      value={namaMapel}
                      onChange={(e) => setNamaMapel(e.target.value)}
                      placeholder="Contoh: Matematika"
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
                      value={kelasDipilih}
                      onChange={(e) => handlePilihKelas(e.target.value)}
                      disabled={loadingKelas}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                    >
                      <option value="">
                        {loadingKelas
                          ? "Memuat daftar kelas..."
                          : "-- Tanpa kelas (manual) --"}
                      </option>
                      {daftarKelas.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
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
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </label>

                {kelasDipilih && (
                  <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200 mt-2">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                        👥 Siswa Kelas {kelasDipilih}
                      </h3>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black text-emerald-700">
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
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-black">
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
                  className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black px-8 py-3.5 shadow-md transition-all disabled:opacity-60"
                >
                  {saving ? "Menyimpan..." : "💾 SIMPAN MAPEL"}
                </button>
              </form>
            </div>
          )}
        </section>

        {/* DAFTAR KARTU MAPEL (BIRU) */}
        <section>
          <h2 className="text-base sm:text-lg font-black text-slate-800 mb-4 px-2">
            📋 Daftar Mapel Anda ({daftarMapel.length})
          </h2>

          {daftarMapel.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400 text-sm font-medium shadow-sm">
              Belum ada mapel. Tambahkan mapel pertama Bapak/Ibu di atas.
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {daftarMapel.map((mapel) => {
                const isEditing = editingId === mapel.idMapel;
                const isAktif = mapelAktifId === mapel.idMapel;
                const isExpanded = expandedMapelId === mapel.idMapel;

                return (
                  <div
                    key={mapel.idMapel}
                    className={`rounded-[2rem] overflow-hidden shadow-lg border transition-all ${
                      isAktif
                        ? "border-amber-400 bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 shadow-amber-500/10"
                        : "border-blue-800 bg-gradient-to-br from-indigo-950 via-blue-900 to-indigo-900"
                    }`}
                  >
                    <div className="p-5 sm:p-6 text-white">
                      {isEditing ? (
                        <div className="space-y-3 bg-white p-4 rounded-xl shadow-inner text-slate-800">
                          <input
                            value={editNama}
                            onChange={(e) => setEditNama(e.target.value)}
                            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500"
                          />
                          <input
                            value={editKeterangan}
                            onChange={(e) => setEditKeterangan(e.target.value)}
                            placeholder="Keterangan (opsional)"
                            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-xs text-slate-600 outline-none focus:border-blue-500"
                          />
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => simpanEdit(mapel.idMapel)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 shadow-md transition-colors"
                            >
                              💾 Simpan
                            </button>
                            <button
                              onClick={batalEdit}
                              className="rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black px-5 py-2.5 transition-colors"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 drop-shadow-sm">
                                {mapel.namaMapel}
                              </h3>
                              {isAktif && (
                                <span className="rounded-lg bg-amber-400/20 text-amber-300 px-3 py-1 text-[10px] sm:text-xs font-black uppercase border border-amber-400/30">
                                  ✓ Aktif Terpilih
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              {mapel.kelas && (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-800/60 border border-blue-500/40 text-blue-100">
                                  Kelas {mapel.kelas}
                                </span>
                              )}
                            </div>

                            {mapel.keterangan && (
                              <p className="text-xs sm:text-sm text-blue-200 font-medium mt-3">
                                {mapel.keterangan}
                              </p>
                            )}
                          </div>

                          {/* Tombol Aksi Kanan */}
                          <div className="flex gap-2 flex-wrap shrink-0 mt-2 md:mt-0">
                            <button
                              onClick={() => pilihMapelAktif(mapel)}
                              disabled={isAktif}
                              className={`rounded-xl px-4 py-2.5 text-xs font-black shadow-md transition-all ${
                                isAktif
                                  ? "bg-blue-900/50 text-blue-400 border border-blue-800/50 cursor-not-allowed opacity-60"
                                  : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                              }`}
                            >
                              {isAktif ? "✓ Terpilih" : "📌 Pilih"}
                            </button>
                            <button
                              onClick={() => mulaiEdit(mapel)}
                              className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-4 py-2.5 text-xs font-black text-amber-200 hover:bg-amber-500/40 transition-colors"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => hapusMapelHandler(mapel)}
                              className="rounded-xl bg-rose-500/20 border border-rose-400/40 px-4 py-2.5 text-xs font-black text-rose-200 hover:bg-rose-500/40 transition-colors"
                            >
                              🗑️ Hapus
                            </button>
                          </div>
                        </div>
                      )}

                      {!isEditing && (
                        <button
                          onClick={() => toggleExpand(mapel.idMapel)}
                          className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 sm:py-3.5 text-[11px] sm:text-sm font-black shadow-md transition-all ${
                            isExpanded
                              ? "bg-amber-400 text-amber-950 hover:bg-amber-500 border border-amber-300"
                              : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
                          }`}
                        >
                          {isExpanded
                            ? "🔽 TUTUP PRESENSI & NILAI"
                            : "📊 BUKA PRESENSI & NILAI"}
                        </button>
                      )}
                    </div>

                    {isExpanded && !isEditing && (
                      <div className="bg-slate-50 border-t border-slate-200 p-2 sm:p-5 text-slate-800">
                        <PresensiMapelGrid
                          ref={activeGridRef}
                          guru={guru}
                          mapel={mapel}
                          daftarKelas={daftarKelas}
                          onClose={() => {
                            setExpandedMapelId(pendingOpenId);
                            setPendingOpenId(null);
                            setShowCloseModal(false);
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
                Apakah Bapak/Ibu ingin menyimpan data presensi dan nilai sebelum
                menutup tabel ini?
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (activeGridRef.current) {
                      activeGridRef.current.triggerSimpan();
                    }
                  }}
                  className="w-full rounded-xl bg-blue-600 text-white text-xs sm:text-sm font-black py-3 hover:bg-blue-700 transition-colors shadow-sm"
                >
                  💾 Simpan & Tutup
                </button>
                <button
                  onClick={() => {
                    setExpandedMapelId(pendingOpenId);
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
// KOMPONEN: TABEL PRESENSI + NILAI
// =========================================================================
const PresensiMapelGrid = forwardRef(function PresensiMapelGrid(
  { guru, mapel, daftarKelas, onClose },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [siswaList, setSiswaList] = useState([]);
  const [grid, setGrid] = useState({});
  const [tanggalPertemuan, setTanggalPertemuan] = useState({});
  const [saving, setSaving] = useState(false);

  // State Dinamis untuk jumlah pertemuan P
  const [jumlahPertemuan, setJumlahPertemuan] = useState(1);

  const [showTambahModal, setShowTambahModal] = useState(false);
  const [kandidatSiswa, setKandidatSiswa] = useState([]);
  const [loadingKandidat, setLoadingKandidat] = useState(false);
  const [searchTambah, setSearchTambah] = useState("");
  const [filterKelasTambah, setFilterKelasTambah] = useState("");
  const [menambahId, setMenambahId] = useState(null);

  const [showFormBaru, setShowFormBaru] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const [kelasBaru, setKelasBaru] = useState(mapel.kelas || "");
  const [savingBaru, setSavingBaru] = useState(false);

  const [menghapusId, setMenghapusId] = useState(null);

  useImperativeHandle(ref, () => ({
    triggerSimpan: async () => {
      await handleSimpanPresensi();
      if (onClose) onClose();
    },
  }));

  useEffect(() => {
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapel.idMapel]);

  async function loadGrid() {
    try {
      setLoading(true);
      const result = await getPresensiMapelGrid(guru.id, mapel.idMapel);
      const data = result.success ? result.data : { siswa: [], presensi: [] };

      const daftarSiswa = (data.siswa || [])
        .slice()
        .sort((a, b) => a.nama.localeCompare(b.nama));
      setSiswaList(daftarSiswa);

      const gridBaru = {};
      const tanggalBaru = {};
      let maxP = 1;

      (data.presensi || []).forEach((p) => {
        if (!p.pertemuanKe) return;

        if (p.pertemuanKe > maxP) maxP = p.pertemuanKe;

        gridBaru[`${p.idSiswa}_${p.pertemuanKe}`] = {
          status: p.status || "",
          nilai: p.nilai ?? "",
        };
        if (p.tanggal && !tanggalBaru[p.pertemuanKe]) {
          tanggalBaru[p.pertemuanKe] = p.tanggal;
        }
      });

      setGrid(gridBaru);
      setTanggalPertemuan(tanggalBaru);
      setJumlahPertemuan(Math.min(PERTEMUAN_MAX, maxP));
    } catch (err) {
      console.error("ERROR LOAD GRID PRESENSI:", err);
    } finally {
      setLoading(false);
    }
  }

  function updateCell(idSiswa, pertemuanKe, field, value) {
    const key = `${idSiswa}_${pertemuanKe}`;
    setGrid((prev) => {
      const current = prev[key] || { status: "", nilai: "" };
      const updated = { ...current, [field]: value };
      if (field === "status" && value !== "Hadir") updated.nilai = "";
      return { ...prev, [key]: updated };
    });
  }

  function updateTanggalPertemuan(pertemuanKe, value) {
    setTanggalPertemuan((prev) => ({ ...prev, [pertemuanKe]: value }));
  }

  function tambahKolomPertemuan() {
    setJumlahPertemuan((prev) => Math.min(PERTEMUAN_MAX, prev + 1));
  }

  // Menambahkan fitur untuk mengurangi kolom
  // Mengurangi kolom dengan konfirmasi peringatan
  function kurangiKolomPertemuan() {
    if (jumlahPertemuan <= 1) return;

    const konfirmasi = window.confirm(
      `⚠️ Hapus kolom Pertemuan ${jumlahPertemuan}?\n\n` +
        `Data presensi dan nilai pada pertemuan terakhir ini akan dihapus. Lanjutkan?`,
    );

    if (!konfirmasi) return;

    setJumlahPertemuan((prev) => Math.max(1, prev - 1));
  }

  function hitungTotal(idSiswa) {
    const total = {
      Hadir: 0,
      Sakit: 0,
      Izin: 0,
      Alfa: 0,
      Cabut: 0,
      jumlahNilai: 0,
    };

    for (let p = 1; p <= PERTEMUAN_MAX; p++) {
      const cell = grid[`${idSiswa}_${p}`];

      if (cell?.status && total[cell.status] !== undefined) {
        total[cell.status]++;
      }

      if (cell?.status === "Hadir" && cell?.nilai !== "") {
        const nilai = Number(cell.nilai);
        if (Number.isFinite(nilai)) {
          total.jumlahNilai += nilai;
        }
      }
    }

    return total;
  }

  async function handleSimpanPresensi() {
    const cells = [];
    Object.entries(grid).forEach(([key, val]) => {
      if (!val.status) return;
      const [idSiswa, pertemuanKe] = key.split("_");
      const siswa = siswaList.find((s) => String(s.idSiswa) === idSiswa);
      cells.push({
        idSiswa,
        namaSiswa: siswa?.nama || "",
        pertemuanKe: Number(pertemuanKe),
        tanggal: tanggalPertemuan[pertemuanKe] || "",
        status: val.status,
        nilaiHarian: val.status === "Hadir" ? val.nilai : "",
      });
    });

    if (cells.length === 0) {
      alert("Belum ada data presensi yang diisi.");
      return;
    }

    setSaving(true);
    try {
      const result = await savePresensiMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        cells,
      });
      if (result.success) {
        alert(
          `✅ Presensi tersimpan.\nDiperbarui: ${result.data?.diperbarui || 0} • Baris baru: ${result.data?.ditambah || 0}`,
        );
      } else {
        alert(result.message || "Gagal menyimpan presensi.");
      }
    } catch (err) {
      console.error("ERROR SIMPAN PRESENSI:", err);
      alert("Terjadi kesalahan saat menyimpan presensi.");
    } finally {
      setSaving(false);
    }
  }

  async function bukaModalTambah() {
    setShowTambahModal(true);
    setSearchTambah("");
    setFilterKelasTambah("");
    setShowFormBaru(false);
    setNamaBaru("");
    setKelasBaru(mapel.kelas || "");
    setLoadingKandidat(true);
    try {
      const result = await getSemuaSiswaUntukTambahMapel(
        guru.id,
        mapel.idMapel,
      );
      setKandidatSiswa(result.success ? result.data || [] : []);
    } catch (err) {
      console.error("ERROR LOAD KANDIDAT SISWA:", err);
      setKandidatSiswa([]);
    } finally {
      setLoadingKandidat(false);
    }
  }

  async function tambahSiswaKeMapel(siswa) {
    setMenambahId(siswa.idSiswa);
    try {
      const result = await simpanSiswaMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        idSiswa: siswa.idSiswa,
      });
      if (result.success) {
        setSiswaList((prev) =>
          [
            ...prev,
            {
              idSiswa: siswa.idSiswa,
              nama: siswa.nama,
              kelas: siswa.kelas,
              namaGuruWali: siswa.namaGuruWali,
            },
          ].sort((a, b) => a.nama.localeCompare(b.nama)),
        );
        setKandidatSiswa((prev) =>
          prev.filter((s) => s.idSiswa !== siswa.idSiswa),
        );
      } else {
        alert(result.message || "Gagal menambahkan siswa.");
      }
    } catch (err) {
      console.error("ERROR TAMBAH SISWA MAPEL:", err);
      alert("Terjadi kesalahan saat menambahkan siswa.");
    } finally {
      setMenambahId(null);
    }
  }

  async function daftarSiswaBaru() {
    if (!namaBaru.trim()) {
      alert("Nama siswa wajib diisi.");
      return;
    }
    if (!kelasBaru) {
      alert("Pilih kelas siswa terlebih dahulu.");
      return;
    }

    setSavingBaru(true);
    try {
      const namaLengkap = `${namaBaru.trim().toUpperCase()} [${kelasBaru}]`;

      const hasilAdd = await addSiswa({
        id: "",
        nama: namaLengkap,
        idGuru: "",
        namaGuru: "",
        tempatMagang: "",
        status: "BELUM_MAGANG",
      });

      if (!hasilAdd.success) {
        alert(hasilAdd.message || "Gagal mendaftarkan siswa baru ke sistem.");
        return;
      }

      const idBaru =
        hasilAdd.data?.id ||
        hasilAdd.data?.ID ||
        hasilAdd.data?.idSiswa ||
        hasilAdd.data?.ID_SISWA;

      if (!idBaru) {
        alert(
          "Siswa baru tersimpan di sistem, tapi ID tidak terbaca otomatis. Silakan cari namanya lagi di kotak pencarian untuk memasukkannya ke mapel ini.",
        );
        setShowFormBaru(false);
        bukaModalTambah();
        return;
      }

      const hasilEnroll = await simpanSiswaMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        idSiswa: idBaru,
      });

      if (hasilEnroll.success) {
        setSiswaList((prev) =>
          [
            ...prev,
            {
              idSiswa: idBaru,
              nama: namaBaru.trim().toUpperCase(),
              kelas: kelasBaru,
              namaGuruWali: "",
            },
          ].sort((a, b) => a.nama.localeCompare(b.nama)),
        );
        alert(
          `✅ Siswa "${namaBaru.trim().toUpperCase()}" berhasil didaftarkan & ditambahkan ke mapel ini.`,
        );
        setNamaBaru("");
        setShowFormBaru(false);
        setSearchTambah("");
      } else {
        alert(
          hasilEnroll.message ||
            "Siswa berhasil didaftarkan ke sistem, tapi gagal dimasukkan ke mapel ini. Coba cari namanya di 'Tambah Siswa'.",
        );
      }
    } catch (err) {
      console.error("ERROR DAFTAR SISWA BARU:", err);
      alert("Terjadi kesalahan saat mendaftarkan siswa baru.");
    } finally {
      setSavingBaru(false);
    }
  }

  async function hapusSiswaDariMapel(siswa) {
    const konfirmasi = window.confirm(
      `Hapus "${siswa.nama}" dari mapel "${mapel.namaMapel}"?\n\n` +
        `• Jika siswa ini TIDAK punya Guru Pembimbing Magang DAN TIDAK punya ` +
        `Guru Wali, sistem akan otomatis menghapusnya PERMANEN dari database sekolah.\n` +
        `• Jika masih punya salah satu di antaranya, siswa hanya dihapus dari ` +
        `mapel ini saja (data siswa tetap aman di sistem).`,
    );
    if (!konfirmasi) return;

    setMenghapusId(siswa.idSiswa);
    try {
      const result = await hapusSiswaMapel({
        idMapel: mapel.idMapel,
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

        if (result.data?.action === "hapus_permanen_dari_sistem") {
          alert(
            `✅ "${siswa.nama}" dihapus PERMANEN dari sistem (tidak punya Guru Pembimbing / Guru Wali).`,
          );
        } else {
          alert(
            `✅ "${siswa.nama}" dihapus dari mapel ini. Data siswa tetap aman di sistem.`,
          );
        }
      } else {
        alert(result.message || "Gagal menghapus siswa dari mapel.");
      }
    } catch (err) {
      console.error("ERROR HAPUS SISWA MAPEL:", err);
      alert("Terjadi kesalahan saat menghapus siswa.");
    } finally {
      setMenghapusId(null);
    }
  }

  const daftarKelasKandidat = Array.from(
    new Set(kandidatSiswa.map((s) => s.kelas).filter(Boolean)),
  ).sort();

  const kandidatTersaring = kandidatSiswa.filter((s) => {
    const cocokNama = s.nama.toLowerCase().includes(searchTambah.toLowerCase());
    const cocokKelas = !filterKelasTambah || s.kelas === filterKelasTambah;
    return cocokNama && cocokKelas;
  });
  const tidakDitemukan =
    !loadingKandidat &&
    searchTambah.trim() !== "" &&
    kandidatTersaring.length === 0;

  const currentPertemuanArray = Array.from(
    { length: jumlahPertemuan },
    (_, i) => i + 1,
  );

  return (
    <div className="mt-1 rounded-2xl bg-white p-2 sm:p-4 overflow-hidden">
      {loading ? (
        <p className="text-center text-xs font-bold text-slate-400 py-6">
          Memuat tabel presensi...
        </p>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <p className="text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl">
                👥 {siswaList.length} Siswa Terdaftar
              </p>
            </div>
            {/* Tombol Pertemuan (+) dihilangkan dari sini karena dipindah ke header */}
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              <button
                onClick={bukaModalTambah}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white text-[10px] sm:text-[11px] font-black px-3 py-2 sm:px-4 sm:py-2.5 shadow-md transition-all"
              >
                ➕ Tambah Siswa
              </button>
              <button
                onClick={handleSimpanPresensi}
                disabled={saving}
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:brightness-110 text-white text-[10px] sm:text-[11px] font-black px-3 py-2 sm:px-4 sm:py-2.5 shadow-md disabled:opacity-60 transition-all"
              >
                {saving ? "Menyimpan..." : "💾 Simpan Presensi"}
              </button>
            </div>
          </div>

          {siswaList.length === 0 ? (
            <div className="rounded-xl bg-slate-50 border border-dashed border-slate-300 p-8 text-center text-xs sm:text-sm font-bold text-slate-400 shadow-inner">
              Belum ada siswa di mapel ini. Klik "➕ Tambah Siswa" untuk mulai.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden relative w-full">
              <div
                className="overflow-auto custom-scrollbar relative h-[70vh] overscroll-contain touch-pan-x touch-pan-y"
                style={{ WebkitOverflowScrolling: "touch" }}
                onScroll={(e) => {
                  if (e.currentTarget.scrollLeft > 10) {
                    e.currentTarget.classList.add("is-scrolled");
                  } else {
                    e.currentTarget.classList.remove("is-scrolled");
                  }
                }}
              >
                <table className="border-separate border-spacing-0 whitespace-nowrap text-[9px] sm:text-[10px] min-w-max w-full [&_.col-nama]:transition-all [&_.col-nama]:duration-300 [.is-scrolled_&_.col-nama]:!w-[150px] [.is-scrolled_&_.col-nama]:!min-w-[150px] [.is-scrolled_&_.col-nama]:!max-w-[150px]">
                  <thead className="bg-slate-50 text-slate-700 shadow-sm leading-none">
                    <tr>
                      <th className="px-1 py-1.5 font-black border-b-2 border-slate-300 sticky top-0 left-0 bg-slate-50 z-[70] w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] text-center">
                        No
                      </th>

                      <th
                        className="col-nama px-1.5 py-1.5 font-black border-b-2 border-slate-300 sticky top-0 left-[28px] sm:left-[32px] bg-slate-50 z-[80] text-left shadow-[5px_0_10px_-5px_rgba(0,0,0,0.1)] w-[190px] min-w-[190px] max-w-[190px]"
                        style={{
                          position: "sticky",
                          left: "28px",
                          zIndex: 80,
                        }}
                      >
                        <div className="w-full overflow-hidden truncate">
                          Nama Siswa
                        </div>
                      </th>

                      {currentPertemuanArray.map((p) => (
                        <th
                          key={p}
                          className="px-0.5 py-1 font-black border-b-2 border-slate-300 border-l border-slate-100 text-center min-w-[55px] sm:min-w-[65px] sticky top-0 bg-slate-50 z-40"
                        >
                          <div className="mb-1 flex items-center justify-center gap-1 text-[9px] sm:text-[10px] text-slate-800">
                            <span className="bg-blue-100 text-blue-800 px-1 py-0.5 rounded">
                              Pert. {p}
                            </span>

                            {p === jumlahPertemuan && (
                              <div className="flex flex-row items-center gap-0.5">
                                <button
                                  onClick={kurangiKolomPertemuan}
                                  disabled={jumlahPertemuan <= 1}
                                  className="h-3.5 w-3.5 rounded bg-rose-500 text-white flex items-center justify-center text-[10px] font-black hover:bg-rose-600 hover:scale-110 disabled:opacity-50 shadow-sm transition-all"
                                  title="Kurangi"
                                >
                                  -
                                </button>
                                <button
                                  onClick={tambahKolomPertemuan}
                                  disabled={jumlahPertemuan >= PERTEMUAN_MAX}
                                  className="h-3.5 w-3.5 rounded bg-blue-600 text-white flex items-center justify-center text-[10px] font-black hover:bg-blue-700 hover:scale-110 disabled:opacity-50 shadow-sm transition-all"
                                  title="Tambah"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>

                          <input
                            type="date"
                            value={tanggalPertemuan[p] || ""}
                            onChange={(e) =>
                              updateTanggalPertemuan(p, e.target.value)
                            }
                            className="w-full max-w-[75px] h-[18px] rounded border border-slate-300 text-[8px] sm:text-[9px] px-0.5 py-0 bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none mx-auto block cursor-pointer transition-all shadow-inner"
                          />
                        </th>
                      ))}

                      <th className="px-1 py-1 font-black border-b-2 border-slate-300 border-l-2 border-slate-200 text-center sticky top-0 bg-slate-100 z-50">
                        <div className="w-[130px] min-w-[130px] max-w-[130px] mx-auto">
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
                            <span
                              className="w-4 font-black text-fuchsia-700"
                              title="Total Nilai"
                            >
                              N
                            </span>
                          </div>
                        </div>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {siswaList.map((s, idx) => {
                      const total = hitungTotal(s.idSiswa);

                      return (
                        <tr
                          key={s.idSiswa}
                          className="hover:bg-blue-50/60 transition-colors group"
                        >
                          <td className="px-1 py-1 border-b border-slate-100 sticky left-0 bg-white group-hover:bg-blue-50/90 z-[70] font-bold text-center text-slate-500 w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px]">
                            {idx + 1}
                          </td>

                          <td
                            className="col-nama px-1.5 py-1 border-b border-slate-100 sticky left-[28px] sm:left-[32px] bg-white group-hover:bg-blue-50/90 z-[60] shadow-[5px_0_10px_-5px_rgba(0,0,0,0.05)] w-[190px] min-w-[190px] max-w-[190px]"
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
                                  <span className="shrink-0 text-[7px] sm:text-[8px] text-slate-400 font-medium bg-slate-100 px-1 py-0 rounded truncate">
                                    ID: {s.idSiswa}
                                  </span>

                                  {s.namaGuruWali ? (
                                    <span className="truncate rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 py-0 text-[7px] font-bold">
                                      Wali: {s.namaGuruWali}
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded bg-red-50 text-red-500 border border-red-200 px-1 py-0 text-[7px] font-bold">
                                      Tanpa Wali
                                    </span>
                                  )}
                                </div>

                                <button
                                  onClick={() => hapusSiswaDariMapel(s)}
                                  disabled={menghapusId === s.idSiswa}
                                  title="Hapus"
                                  className="shrink-0 flex h-4 w-4 items-center justify-center rounded bg-red-50 border border-red-200 text-red-600 hover:bg-red-500 hover:text-white text-[8px] disabled:opacity-50 transition-all shadow-sm"
                                >
                                  {menghapusId === s.idSiswa ? "⏳" : "✕"}
                                </button>
                              </div>
                            </div>
                          </td>

                          {currentPertemuanArray.map((p) => {
                            const key = `${s.idSiswa}_${p}`;
                            const cell = grid[key] || {
                              status: "",
                              nilai: "",
                            };
                            const isHadir = cell.status === "Hadir";

                            return (
                              <td
                                key={p}
                                className="p-0.5 border-b border-slate-100 border-l border-slate-50 text-center align-middle"
                              >
                                <div className="flex flex-col sm:flex-row items-center justify-center gap-0.5 w-full h-full">
                                  <select
                                    value={cell.status}
                                    onChange={(e) =>
                                      updateCell(
                                        s.idSiswa,
                                        p,
                                        "status",
                                        e.target.value,
                                      )
                                    }
                                    className={`cursor-pointer rounded border text-[9px] sm:text-[10px] font-black h-[20px] px-0.5 shadow-sm hover:scale-105 transition-all appearance-none outline-none focus:ring-1 focus:ring-blue-400 ${warnaStatus(cell.status)}`}
                                    style={{
                                      width: isHadir ? "35px" : "50px",
                                      textAlignLast: "center",
                                    }}
                                  >
                                    <option hidden value={cell.status}>
                                      {isHadir ? "H" : cell.status || "-"}
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

                                  {isHadir && (
                                    <select
                                      value={cell.nilai}
                                      onChange={(e) =>
                                        updateCell(
                                          s.idSiswa,
                                          p,
                                          "nilai",
                                          e.target.value,
                                        )
                                      }
                                      title="Nilai"
                                      className="cursor-pointer rounded border border-emerald-400 text-[9px] sm:text-[10px] h-[20px] px-0.5 text-center font-black bg-white text-emerald-800 shadow-sm hover:bg-emerald-50 hover:scale-105 transition-all appearance-none outline-none focus:ring-1 focus:ring-emerald-500"
                                      style={{
                                        width: "35px",
                                        textAlignLast: "center",
                                      }}
                                    >
                                      <option value="">Nil</option>
                                      {NILAI_OPTIONS.map((n) => (
                                        <option key={n} value={n}>
                                          {n}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </td>
                            );
                          })}

                          <td className="px-1 py-1 border-b border-l-2 border-slate-200 bg-slate-50/50 group-hover:bg-blue-100/50 transition-colors text-center">
                            <div className="flex items-center justify-center gap-1 w-[130px] min-w-[130px] max-w-[130px] mx-auto leading-none">
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
                              <span className="w-4 text-[10px] font-black text-fuchsia-700 bg-fuchsia-100 py-0.5 rounded border border-fuchsia-200">
                                {total.jumlahNilai}
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

      {/* MODAL TAMBAH SISWA */}
      {showTambahModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowTambahModal(false);
          }}
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="shrink-0 bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-4 text-white">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black">
                  ➕ Tambah Siswa ke "{mapel.namaMapel}"
                </h3>
                <button
                  onClick={() => setShowTambahModal(false)}
                  className="rounded-full bg-white/20 hover:bg-white/30 w-7 h-7 flex items-center justify-center text-xs font-black transition-colors"
                >
                  ✕
                </button>
              </div>
              <input
                type="text"
                value={searchTambah}
                onChange={(e) => {
                  setSearchTambah(e.target.value);
                  setShowFormBaru(false);
                }}
                placeholder="Cari nama siswa..."
                className="mt-3 w-full rounded-xl border border-white/30 bg-white/10 placeholder-white/60 px-4 py-2.5 text-xs sm:text-sm font-medium text-white outline-none focus:bg-white/20 transition-colors"
              />
              <select
                value={filterKelasTambah}
                onChange={(e) => setFilterKelasTambah(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-xs sm:text-sm font-bold text-white outline-none focus:bg-white/20 transition-colors"
              >
                <option value="" className="text-slate-800">
                  -- Semua Kelas --
                </option>
                {daftarKelasKandidat.map((k) => (
                  <option key={k} value={k} className="text-slate-800">
                    {k}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingKandidat ? (
                <p className="text-center text-xs font-bold text-slate-400 py-6">
                  Memuat daftar siswa...
                </p>
              ) : kandidatTersaring.length > 0 ? (
                kandidatTersaring.map((s) => (
                  <div
                    key={s.idSiswa}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-800 truncate">
                        {s.nama}{" "}
                        {s.kelas && (
                          <span className="ml-1 rounded bg-slate-200 text-slate-600 px-1.5 py-0.5 text-[9px] font-bold">
                            {s.kelas}
                          </span>
                        )}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                        {s.namaGuruWali
                          ? `Wali: ${s.namaGuruWali}`
                          : "Belum ada Guru Wali"}
                      </p>
                    </div>
                    <button
                      onClick={() => tambahSiswaKeMapel(s)}
                      disabled={menambahId === s.idSiswa}
                      className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black px-3 py-1.5 disabled:opacity-60 transition-colors shadow-sm"
                    >
                      {menambahId === s.idSiswa ? "⏳..." : "+ Tambah"}
                    </button>
                  </div>
                ))
              ) : !tidakDitemukan ? (
                <p className="text-center text-xs font-bold text-slate-400 py-6">
                  Semua siswa sudah terdaftar di mapel ini.
                </p>
              ) : null}

              {tidakDitemukan && !showFormBaru && (
                <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center">
                  <p className="text-xs font-bold text-amber-800 mb-3">
                    Siswa "{searchTambah}" tidak ditemukan di database.
                  </p>
                  <button
                    onClick={() => {
                      setNamaBaru(searchTambah);
                      setShowFormBaru(true);
                    }}
                    className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black px-4 py-2 transition-colors shadow-sm"
                  >
                    ➕ Daftarkan Siswa Baru
                  </button>
                </div>
              )}

              {showFormBaru && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
                  <p className="text-xs font-black text-emerald-800">
                    📝 Daftarkan Siswa Baru ke Sistem
                  </p>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase text-emerald-700 mb-1">
                      Nama Lengkap
                    </span>
                    <input
                      value={namaBaru}
                      // Tambahkan .toUpperCase() di bawah ini
                      onChange={(e) =>
                        setNamaBaru(e.target.value.toUpperCase())
                      }
                      // Kamu juga bisa menambahkan class "uppercase" di className agar kursor dan teks langsung terlihat kapital
                      className="w-full rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 uppercase"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase text-emerald-700 mb-1">
                      Kelas
                    </span>
                    <select
                      value={kelasBaru}
                      onChange={(e) => setKelasBaru(e.target.value)}
                      className="w-full rounded-lg border border-emerald-300 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Pilih kelas --</option>

                      <optgroup label="Kelas X">
                        <option value="X TKJ 1">X TJKT 1</option>
                        <option value="X TKJ 2">X TJKT 2</option>
                        <option value="X DPIB">X DPIB</option>
                        <option value="X TAV">X TAV</option>
                        <option value="X GEOMATIKA">X GEOMATIKA</option>
                        <option value="X TO 1">X TO1</option>
                        <option value="X TO 2">X TO2</option>
                        <option value="X TO 3">X TO3</option>
                        <option value="X TO 4">X TO4</option>
                        <option value="X TPL">X TPL</option>
                        <option value="X TITL 1">X TITL 1</option>
                        <option value="X TITL 2">X TITL 2</option>
                      </optgroup>

                      <optgroup label="Kelas XI">
                        <option value="XI TKJ 1">XI TJKT 1</option>
                        <option value="XI TKJ 2">XI TJKT 2</option>
                        <option value="XI DPIB">XI DPIB</option>
                        <option value="XI TAV">XI TAV</option>
                        <option value="XI GEOMATIKA">XI GEOMATIKA</option>
                        <option value="XI TBSM 1">XI TBSM 1</option>
                        <option value="XI TBSM 2">XI TBSM 2</option>
                        <option value="XI TAB">XI TAB</option>
                        <option value="XI TKR">XI TKRO</option>
                        <option value="XI TPL">XI TPL</option>
                        <option value="XI TITL 1">XI TITL 1</option>
                        <option value="XI TITL 2">XI TITL 2</option>
                      </optgroup>

                      <optgroup label="Kelas XII">
                        <option value="TKJ 1">XII TJKT 1</option>
                        <option value="TKJ 2">XII TJKT 2</option>
                        <option value="DPIB">XII DPIB</option>
                        <option value="TAV">XII TAV</option>
                        <option value="GEOMATIKA">XII GEOMATIKA</option>
                        <option value="TBSM 1">XII TBSM 1</option>
                        <option value="TBSM 2">XII TBSM 2</option>
                        <option value="TAB">XII TAB</option>
                        <option value="TKR">XII TKRO</option>
                        <option value="TPL">XII TPL</option>
                        <option value="TITL">XII TITL</option>
                      </optgroup>

                      <optgroup label="Lainnya">
                        <option value="CONTOH">KELAS CONTOH</option>
                      </optgroup>
                    </select>
                  </label>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={daftarSiswaBaru}
                      disabled={savingBaru}
                      className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black px-3 py-2 disabled:opacity-60 transition-colors shadow-sm"
                    >
                      {savingBaru ? "Menyimpan..." : "💾 Simpan & Tambahkan"}
                    </button>
                    <button
                      onClick={() => setShowFormBaru(false)}
                      className="rounded-lg bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 text-[11px] font-black px-4 py-2 transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                  <p className="text-[10px] text-emerald-700/80 leading-tight">
                    Siswa baru akan otomatis dibuatkan ID dan langsung
                    dimasukkan ke mapel ini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
