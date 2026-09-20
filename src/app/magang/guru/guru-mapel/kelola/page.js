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
import { generateLaporanMapelPDF } from "../generateLaporanMapelPDF";
import ModalTambahSiswa from "./ModalTambahSiswa";

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
      return "bg-blue-600 text-white border-blue-700";
    case "Izin":
      return "bg-amber-500 text-white border-amber-600";
    case "Alfa":
      return "bg-rose-500 text-white border-rose-600";
    case "Cabut":
      return "bg-violet-500 text-white border-violet-600";
    default:
      return "bg-white text-slate-500 border-slate-300 hover:border-blue-400";
  }
}

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

export default function KelolaMapelPage() {
  const router = useRouter();

  const [guru, setGuru] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [daftarMapel, setDaftarMapel] = useState([]);
  const [searchMapel, setSearchMapel] = useState("");
  const [statsPresensiMapel, setStatsPresensiMapel] = useState({});
  const [loadingStatsMapel, setLoadingStatsMapel] = useState({});
  const [selectedPertemuanMapel, setSelectedPertemuanMapel] = useState({});

  // Helper format tanggal pertemuan mapel
  const formatTanggalMapelIndo = (tanggalStr) => {
    if (!tanggalStr) return "";
    try {
      const d = new Date(tanggalStr);
      if (isNaN(d.getTime())) return String(tanggalStr);
      return d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return String(tanggalStr);
    }
  };

  // --- AMBIL STATISTIK PRESENSI PERTEMUAN SEBELUMNYA MAPEL ---
  const loadStatsMapel = useCallback(
    async (idMapel) => {
      if (!guru?.id || !idMapel) return;
      setLoadingStatsMapel((prev) => ({ ...prev, [idMapel]: true }));

      try {
        const res = await getPresensiMapelGrid(guru.id, idMapel);
        if (res && res.success && res.data) {
          const siswaList = res.data.siswa || [];
          const presensiList = res.data.presensi || [];

          const siswaMap = {};
          siswaList.forEach((s) => {
            siswaMap[String(s.idSiswa || s.id)] = s.nama || s.namaSiswa || "";
          });

          const meetingsMap = {};
          presensiList.forEach((p) => {
            if (!p.pertemuanKe) return;
            const pKe = Number(p.pertemuanKe);
            if (!meetingsMap[pKe]) {
              meetingsMap[pKe] = { tanggal: p.tanggal || "", records: [] };
            }
            if (p.tanggal && !meetingsMap[pKe].tanggal) {
              meetingsMap[pKe].tanggal = p.tanggal;
            }
            if (p.status) {
              meetingsMap[pKe].records.push(p);
            }
          });

          const validMeetings = Object.keys(meetingsMap)
            .map(Number)
            .filter((p) => meetingsMap[p].records.length > 0)
            .sort((a, b) => a - b);

          const latestP =
            validMeetings.length > 0 ? Math.max(...validMeetings) : null;

          const perPertemuan = {};
          Object.keys(meetingsMap).forEach((pStr) => {
            const pKe = Number(pStr);
            const mData = meetingsMap[pKe];
            let hadir = 0,
              sakit = 0,
              izin = 0,
              alfa = 0,
              cabut = 0;
            const absenList = [];
            let totalNilai = 0;
            let countNilai = 0;

            mData.records.forEach((rec) => {
              const st = String(rec.status || "").trim();
              const sid = String(rec.idSiswa).trim();
              const nama = siswaMap[sid] || rec.namaSiswa || `Siswa ${sid}`;

              if (st === "Hadir") {
                hadir++;
                const n = Number(rec.nilai);
                if (Number.isFinite(n) && n > 0) {
                  totalNilai += n;
                  countNilai++;
                }
              } else if (st === "Sakit") {
                sakit++;
                absenList.push({ idSiswa: sid, nama, status: "Sakit" });
              } else if (st === "Izin") {
                izin++;
                absenList.push({ idSiswa: sid, nama, status: "Izin" });
              } else if (st === "Alfa") {
                alfa++;
                absenList.push({ idSiswa: sid, nama, status: "Alfa" });
              } else if (st === "Cabut") {
                cabut++;
                absenList.push({ idSiswa: sid, nama, status: "Cabut" });
              }
            });

            const rataRataNilai =
              countNilai > 0 ? (totalNilai / countNilai).toFixed(1) : null;

            perPertemuan[pKe] = {
              tanggal: mData.tanggal,
              hadir,
              sakit,
              izin,
              alfa,
              cabut,
              sudahDiisi: mData.records.length > 0,
              absenList,
              rataRataNilai,
            };
          });

          setStatsPresensiMapel((prev) => ({
            ...prev,
            [idMapel]: {
              totalSiswa: siswaList.length,
              validMeetings,
              latestP,
              perPertemuan,
            },
          }));
        }
      } catch (err) {
        console.warn("Gagal memuat statistik presensi mapel:", err);
      } finally {
        setLoadingStatsMapel((prev) => ({ ...prev, [idMapel]: false }));
      }
    },
    [guru?.id],
  );

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
  const [cetakCardLoadingId, setCetakCardLoadingId] = useState(null);
  const [mapelTambahTarget, setMapelTambahTarget] = useState(null);

  async function handleCetakPdfMapel(mapel) {
    try {
      setCetakCardLoadingId(mapel.idMapel);
      await generateLaporanMapelPDF({ guru, mapel });
    } catch (err) {
      console.error("Gagal cetak PDF mapel:", err);
      alert(err.message || "Gagal mencetak laporan PDF mapel.");
    } finally {
      setCetakCardLoadingId(null);
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
        const list = result.data || [];
        setDaftarMapel(list);
        list.forEach((m) => {
          if (m.idMapel) loadStatsMapel(m.idMapel);
        });
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
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base sm:text-lg font-black text-slate-800 px-1">
              📋 Daftar Mapel Anda (
              {Array.isArray(daftarMapel) ? daftarMapel.length : 0})
            </h2>

            {/* PENCARIAN & SEGAR KAN */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchMapel}
                  onChange={(e) => setSearchMapel(e.target.value)}
                  placeholder="Cari mapel atau kelas..."
                  className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 transition-all shadow-xs"
                />
              </div>

              <button
                type="button"
                onClick={() => loadMapel(guru?.id)}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shrink-0 shadow-xs active:scale-95"
              >
                <span className={loading ? "animate-spin inline-block" : ""}>
                  🔄
                </span>
                <span className="hidden sm:inline">Segarkan</span>
              </button>
            </div>
          </div>

          {!Array.isArray(daftarMapel) || daftarMapel.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400 text-sm font-medium shadow-sm">
              Belum ada mapel. Tambahkan mapel pertama Bapak/Ibu di atas.
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {daftarMapel
                .filter((m) => {
                  if (!searchMapel.trim()) return true;
                  const q = searchMapel.toLowerCase();
                  const nama = String(m.namaMapel || "").toLowerCase();
                  const kelas = String(m.kelas || "").toLowerCase();
                  const ket = String(m.keterangan || "").toLowerCase();
                  return (
                    nama.includes(q) || kelas.includes(q) || ket.includes(q)
                  );
                })
                .map((mapel) => {
                  const isEditing = editingId === mapel.idMapel;
                  const isAktif = mapelAktifId === mapel.idMapel;
                  const isExpanded = expandedMapelId === mapel.idMapel;
                  const stats = statsPresensiMapel[mapel.idMapel];
                  const isLoadingStats = loadingStatsMapel[mapel.idMapel];
                  const activeP =
                    selectedPertemuanMapel[mapel.idMapel] ??
                    stats?.latestP ??
                    (stats?.validMeetings?.[0] || 1);
                  const meetingData = stats?.perPertemuan?.[activeP];
                  const totalSiswaDisplay =
                    stats?.totalSiswa || mapel.jumlahSiswa || 0;
                  const totalPertemuanDisplay =
                    stats?.validMeetings?.length || 0;

                  return (
                    <div
                      key={mapel.idMapel}
                      className={`rounded-[2rem] overflow-hidden shadow-lg border p-5 sm:p-6 text-white transition-all hover:shadow-2xl space-y-4 ${
                        isAktif
                          ? "border-amber-400 bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 shadow-amber-500/10"
                          : "border-blue-800 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950"
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3 bg-white p-4 rounded-xl shadow-inner text-slate-800">
                          <input
                            value={editNama}
                            onChange={(e) => setEditNama(e.target.value)}
                            placeholder="Nama Mapel"
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
                              type="button"
                              onClick={() => simpanEdit(mapel.idMapel)}
                              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 py-2.5 shadow-md transition-colors"
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
                          {/* BAGIAN ATAS: NAMA MAPEL, BADGES & TOMBOL AKSI CEPAT */}
                          {/* ============================================================ */}
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="font-black text-xl sm:text-2xl text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-indigo-200 drop-shadow-sm">
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
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-800/60 border border-indigo-500/40 text-indigo-100">
                                  👥 {totalSiswaDisplay} Siswa
                                </span>
                                {totalPertemuanDisplay > 0 && (
                                  <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-400/20 border border-cyan-300/40 text-cyan-200 shadow-xs">
                                    🗓️ {totalPertemuanDisplay} Pertemuan
                                  </span>
                                )}
                              </div>

                              {mapel.keterangan && (
                                <p className="text-xs text-blue-200/90 font-medium italic pt-0.5">
                                  {mapel.keterangan}
                                </p>
                              )}
                            </div>

                            {/* TOMBOL AKSI KANAN */}
                            <div className="flex gap-2 flex-wrap shrink-0 mt-1 md:mt-0 items-center">
                              <button
                                type="button"
                                onClick={() => setMapelTambahTarget(mapel)}
                                title="Tambah / Daftarkan Siswa ke Mapel Ini"
                                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-95 px-3.5 py-2 sm:py-2.5 text-xs font-black text-white border border-emerald-400/40 shadow-md transition-all flex items-center gap-1.5"
                              >
                                <span>➕</span>
                                <span>Tambah Siswa</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCetakPdfMapel(mapel)}
                                disabled={cetakCardLoadingId === mapel.idMapel}
                                title="Cetak Laporan Presensi & Nilai PDF"
                                className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:brightness-110 active:scale-95 px-3.5 py-2 sm:py-2.5 text-xs font-black text-white border border-fuchsia-400/40 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-60"
                              >
                                {cetakCardLoadingId === mapel.idMapel ? (
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
                                onClick={() => pilihMapelAktif(mapel)}
                                disabled={isAktif}
                                className={`rounded-xl px-3.5 py-2 sm:py-2.5 text-xs font-black shadow-md transition-all active:scale-95 ${
                                  isAktif
                                    ? "bg-blue-900/50 text-blue-400 border border-blue-800/50 cursor-not-allowed opacity-60"
                                    : "bg-blue-600 hover:bg-blue-500 text-white border border-blue-500"
                                }`}
                              >
                                {isAktif ? "✓ Terpilih" : "📌 Pilih"}
                              </button>

                              <button
                                type="button"
                                onClick={() => mulaiEdit(mapel)}
                                title="Edit nama mapel dan keterangan"
                                className="rounded-xl bg-amber-500/20 border border-amber-400/40 px-3 py-2 sm:py-2.5 text-xs font-black text-amber-200 hover:bg-amber-500/40 transition-colors flex items-center gap-1.5 active:scale-95"
                              >
                                <span>✏️</span>
                                <span>Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => hapusMapelHandler(mapel)}
                                title="Hapus mapel"
                                className="rounded-xl bg-rose-500/20 border border-rose-400/40 px-3 py-2 sm:py-2.5 text-xs font-black text-rose-200 hover:bg-rose-500/40 transition-colors flex items-center gap-1.5 active:scale-95"
                              >
                                <span>🗑️</span>
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>

                          {/* ============================================================ */}
                          {/* PANEL STATISTIK PRESENSI PERTEMUAN SEBELUMNYA (PADAT & COMPACT) */}
                          {/* ============================================================ */}
                          <div className="rounded-2xl border border-blue-700/60 bg-blue-950/70 p-3.5 sm:p-4 space-y-3 backdrop-blur-xs">
                            {/* Header Bar Statistik */}
                            <div className="flex items-center justify-between gap-2 border-b border-blue-800/60 pb-2.5 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-base">📊</span>
                                <div>
                                  <span className="text-xs font-black tracking-wide text-white block sm:inline">
                                    Presensi Pertemuan Sebelumnya
                                  </span>
                                  {activeP && (
                                    <span className="text-[11px] text-blue-200/80 font-medium sm:ml-2">
                                      (P-{activeP}
                                      {meetingData?.tanggal
                                        ? ` • ${formatTanggalMapelIndo(meetingData.tanggal)}`
                                        : ""}
                                      )
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {isLoadingStats ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-800/70 text-blue-200 text-[10px] font-bold animate-pulse">
                                    ⏳ Memeriksa...
                                  </span>
                                ) : meetingData?.sudahDiisi ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase tracking-wider">
                                    ✅ P-{activeP} Terisi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-200 text-[10px] font-bold">
                                    ⚪ Belum Ada Pertemuan
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Selector Pertemuan (jika lebih dari 1 pertemuan yang sudah ada) */}
                            {stats?.validMeetings &&
                              stats.validMeetings.length > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                  <span className="text-[10px] text-blue-300 font-black uppercase tracking-wider">
                                    Pilih Sesi:
                                  </span>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {stats.validMeetings.map((pNum) => {
                                      const isSel = pNum === activeP;
                                      return (
                                        <button
                                          key={pNum}
                                          type="button"
                                          onClick={() =>
                                            setSelectedPertemuanMapel(
                                              (prev) => ({
                                                ...prev,
                                                [mapel.idMapel]: pNum,
                                              }),
                                            )
                                          }
                                          className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black transition-all ${
                                            isSel
                                              ? "bg-blue-500 text-white shadow-xs border border-blue-300 scale-105"
                                              : "bg-blue-900/60 hover:bg-blue-800/70 text-blue-200 border border-blue-700/50"
                                          }`}
                                        >
                                          P-{pNum}{" "}
                                          {pNum === stats.latestP
                                            ? "⭐ (Terakhir)"
                                            : ""}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                            {/* Mini Counters Grid (Padat 5 Kolom) */}
                            <div className="grid grid-cols-5 gap-1.5 sm:gap-2 text-center">
                              <div className="rounded-xl bg-emerald-950/60 border border-emerald-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-emerald-300 tracking-wider">
                                  Hadir
                                </span>
                                <span className="text-xs sm:text-base font-black text-emerald-100">
                                  {meetingData?.hadir || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-blue-950/60 border border-blue-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-blue-300 tracking-wider">
                                  Sakit
                                </span>
                                <span className="text-xs sm:text-base font-black text-blue-100">
                                  {meetingData?.sakit || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-amber-950/60 border border-amber-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-amber-300 tracking-wider">
                                  Izin
                                </span>
                                <span className="text-xs sm:text-base font-black text-amber-100">
                                  {meetingData?.izin || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-rose-950/60 border border-rose-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-rose-300 tracking-wider">
                                  Alfa
                                </span>
                                <span className="text-xs sm:text-base font-black text-rose-100">
                                  {meetingData?.alfa || 0}
                                </span>
                              </div>

                              <div className="rounded-xl bg-violet-950/60 border border-violet-500/40 p-1.5 sm:p-2">
                                <span className="block text-[9px] sm:text-[10px] font-black uppercase text-violet-300 tracking-wider">
                                  Cabut
                                </span>
                                <span className="text-xs sm:text-base font-black text-violet-100">
                                  {meetingData?.cabut || 0}
                                </span>
                              </div>
                            </div>

                            {/* Rata-Rata Nilai & Detail Absen Siswa */}
                            <div className="pt-1 space-y-2">
                              {meetingData?.rataRataNilai && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-900/60 border border-indigo-400/30 text-indigo-200 text-xs font-bold">
                                  <span>🎯</span>
                                  <span>
                                    Rata-rata Nilai:{" "}
                                    <b className="text-white">
                                      {meetingData.rataRataNilai}
                                    </b>
                                  </span>
                                </div>
                              )}

                              {meetingData?.sudahDiisi ? (
                                meetingData?.absenList?.length > 0 ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 flex items-center gap-1">
                                        <span>⚠️</span>
                                        <span>
                                          Siswa Tidak Hadir (
                                          {meetingData.absenList.length}):
                                        </span>
                                      </span>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1 custom-scrollbar">
                                      {meetingData.absenList.map((item, i) => {
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
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-3 py-2">
                                    <span>✨</span>
                                    <span>
                                      Semua siswa hadir pada pertemuan ini (
                                      {totalSiswaDisplay} siswa) — Nihil Absen.
                                    </span>
                                  </div>
                                )
                              ) : (
                                <div className="text-[11px] text-blue-200/80 font-medium italic flex items-center gap-1.5 bg-blue-900/30 rounded-xl px-3 py-1.5">
                                  <span>💡</span>
                                  <span>
                                    Belum ada presensi pertemuan yang dicatat.
                                    Buka tabel presensi & nilai di bawah untuk
                                    mulai mengisi.
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* ============================================================ */}
                          {/* TOMBOL UTAMA: BUKA / TUTUP PRESENSI & NILAI */}
                          {/* ============================================================ */}
                          <button
                            type="button"
                            onClick={() => toggleExpand(mapel.idMapel)}
                            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 sm:py-3.5 text-xs sm:text-sm font-black shadow-md border transition-all cursor-pointer active:scale-[0.99] ${
                              isExpanded
                                ? "bg-slate-800 text-amber-300 border-amber-400/40 hover:bg-slate-700"
                                : "bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 hover:brightness-110 text-amber-950 border-amber-300"
                            }`}
                          >
                            <span>{isExpanded ? "🔽" : "📊"}</span>
                            <span>
                              {isExpanded
                                ? "TUTUP PRESENSI & NILAI"
                                : "BUKA PRESENSI & NILAI"}
                            </span>
                          </button>
                        </>
                      )}

                      {/* ============================================================ */}
                      {/* TABEL PRESENSI GRID SAAT DI-EXPAND */}
                      {/* ============================================================ */}
                      {isExpanded && !isEditing && (
                        <div className="bg-slate-50 border-t border-blue-800 rounded-2xl p-2 sm:p-4 text-slate-800 shadow-inner overflow-hidden mt-4">
                          <PresensiMapelGrid
                            ref={activeGridRef}
                            guru={guru}
                            mapel={mapel}
                            daftarKelas={daftarKelas}
                            onBukaTambah={() => setMapelTambahTarget(mapel)}
                            onPresensiSaved={() =>
                              loadStatsMapel(mapel.idMapel)
                            }
                            onClose={() => {
                              setExpandedMapelId(pendingOpenId);
                              setPendingOpenId(null);
                              setShowCloseModal(false);
                              loadStatsMapel(mapel.idMapel);
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
        {/* MODAL TAMBAH SISWA KE MAPEL */}
        <ModalTambahSiswa
          key={mapelTambahTarget?.idMapel || "closed"}
          isOpen={!!mapelTambahTarget}
          onClose={() => setMapelTambahTarget(null)}
          guru={guru}
          mapel={mapelTambahTarget}
          onSiswaAdded={() => {
            if (activeGridRef.current?.reloadGrid) {
              activeGridRef.current.reloadGrid();
            }
            loadMapel(guru?.id);
            if (mapelTambahTarget?.idMapel) {
              loadStatsMapel(mapelTambahTarget.idMapel);
            }
          }}
        />
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
  { guru, mapel, daftarKelas, onBukaTambah, onClose, onPresensiSaved },
  ref,
) {
  const [loading, setLoading] = useState(true);
  const [siswaList, setSiswaList] = useState([]);
  const [grid, setGrid] = useState({});
  const [tanggalPertemuan, setTanggalPertemuan] = useState({});
  const [saving, setSaving] = useState(false);

  // State Dinamis untuk jumlah pertemuan P
  const [jumlahPertemuan, setJumlahPertemuan] = useState(1);
  const [menghapusId, setMenghapusId] = useState(null);

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
    if (jumlahPertemuan >= PERTEMUAN_MAX) return;
    const nextP = jumlahPertemuan + 1;
    setJumlahPertemuan(nextP);

    // Otomatis default Hadir untuk semua siswa di pertemuan yang baru ditambahkan
    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        const key = `${s.idSiswa}_${nextP}`;
        if (!salinan[key] || !salinan[key].status) {
          salinan[key] = {
            status: "Hadir",
            nilai: salinan[key]?.nilai || "",
          };
        }
      });
      return salinan;
    });

    // Otomatis isi tanggal hari ini jika belum ada
    setTanggalPertemuan((prev) => {
      if (!prev[nextP]) {
        const today = new Date().toLocaleDateString("en-CA");
        return { ...prev, [nextP]: today };
      }
      return prev;
    });
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

    const pDihapus = jumlahPertemuan;
    setGrid((prev) => {
      const salinan = { ...prev };
      siswaList.forEach((s) => {
        delete salinan[`${s.idSiswa}_${pDihapus}`];
      });
      return salinan;
    });
    setTanggalPertemuan((prev) => {
      const salinan = { ...prev };
      delete salinan[pDihapus];
      return salinan;
    });

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

    for (let p = 1; p <= jumlahPertemuan; p++) {
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
      const pKe = Number(pertemuanKe);
      if (pKe > jumlahPertemuan) return;
      const siswa = siswaList.find((s) => String(s.idSiswa) === idSiswa);
      cells.push({
        idSiswa,
        namaSiswa: siswa?.nama || "",
        pertemuanKe: pKe,
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
        if (onPresensiSaved) onPresensiSaved();
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
        if (onPresensiSaved) onPresensiSaved();
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
                onClick={onBukaTambah || bukaModalTambah}
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 active:scale-95 text-white text-[10px] sm:text-[11px] font-black px-3 py-2 sm:px-4 sm:py-2.5 shadow-md transition-all flex items-center gap-1"
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
              Belum ada siswa di mapel ini. Klik &quot;➕ Tambah Siswa&quot;
              untuk mulai.
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
                  <thead className="bg-slate-100 text-slate-800 shadow-sm leading-none">
                    <tr>
                      <th className="px-1 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-0 bg-slate-100 z-[70] w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] text-center">
                        No
                      </th>

                      <th
                        className="col-nama px-1.5 py-2 font-black border-b-2 border-slate-300 sticky top-0 left-[28px] sm:left-[32px] bg-slate-100 z-[80] text-left shadow-[5px_0_10px_-5px_rgba(0,0,0,0.1)] w-[190px] min-w-[190px] max-w-[190px]"
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
                          className="px-0.5 py-1.5 font-black border-b-2 border-slate-300 border-l border-slate-200 text-center min-w-[55px] sm:min-w-[65px] sticky top-0 bg-slate-100 z-40"
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

                      <th className="px-1 py-1 font-black border-b-2 border-slate-300 border-l-2 border-slate-300 text-center sticky top-0 bg-slate-200/80 z-50">
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

                  <tbody className="divide-y divide-slate-200">
                    {siswaList.map((s, idx) => {
                      const total = hitungTotal(s.idSiswa);
                      const isEven = idx % 2 === 1;

                      return (
                        <tr
                          key={s.idSiswa}
                          className={`transition-colors group ${
                            isEven
                              ? "bg-slate-50/70 hover:bg-blue-100 focus-within:bg-blue-100"
                              : "bg-white hover:bg-blue-100 focus-within:bg-blue-100"
                          }`}
                        >
                          <td
                            className={`px-1 py-1 border-b border-slate-200 sticky left-0 group-hover:bg-blue-100 group-focus-within:bg-blue-100 z-[70] font-bold text-center text-slate-600 w-[28px] sm:w-[32px] min-w-[28px] sm:min-w-[32px] max-w-[28px] sm:max-w-[32px] transition-colors ${
                              isEven ? "bg-slate-50" : "bg-white"
                            }`}
                          >
                            {idx + 1}
                          </td>

                          <td
                            className={`col-nama px-1.5 py-1 border-b border-slate-200 sticky left-[28px] sm:left-[32px] group-hover:bg-blue-100 group-focus-within:bg-blue-100 z-[60] shadow-[5px_0_10px_-5px_rgba(0,0,0,0.08)] w-[190px] min-w-[190px] max-w-[190px] transition-colors ${
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
                                className="p-0.5 border-b border-slate-200 border-l border-slate-200/80 text-center align-middle hover:bg-blue-200/70 focus-within:bg-blue-200/80 transition-colors"
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
                                    className={`cursor-pointer rounded border text-[9px] sm:text-[10px] font-black h-[21px] px-0.5 shadow-sm hover:scale-105 transition-all appearance-none outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 ${warnaStatus(cell.status)}`}
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
                                      className="cursor-pointer rounded border border-emerald-500 text-[9px] sm:text-[10px] h-[21px] px-0.5 text-center font-black bg-white text-emerald-800 shadow-sm hover:bg-emerald-50 hover:border-emerald-600 hover:scale-105 transition-all appearance-none outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
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

                          <td
                            className={`px-1 py-1 border-b border-l-2 border-slate-200 group-hover:bg-blue-100 group-focus-within:bg-blue-100 transition-colors text-center ${
                              isEven ? "bg-slate-100/70" : "bg-slate-50/50"
                            }`}
                          >
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
    </div>
  );
});
