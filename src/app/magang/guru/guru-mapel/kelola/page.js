"use client";

import {
  useEffect,
  useState,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
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
  getSiswa,
  uploadTugasMapel,
  getTugasMapel,
  getJawabanSiswa,
  hapusPertemuanMapel,
} from "../../../lib/api";
import { generateLaporanMapelPDF } from "../generateLaporanMapelPDF";
import ModalTambahSiswa from "./ModalTambahSiswa";
import ModalJurnalMapel from "../ModalJurnalMapel";

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


// =========================================================
// PERSENTASE KEHADIRAN & HELPER (seragam dengan card wali kelas)
// =========================================================
function hitungPersenKehadiran(d) {
  if (!d) return null;
  const jumlah =
    (d.hadir || 0) +
    (d.sakit || 0) +
    (d.izin || 0) +
    (d.alfa || 0) +
    (d.cabut || 0);
  if (!jumlah) return null;
  return Math.round(((d.hadir || 0) / jumlah) * 100);
}

function gabungStatistikSesi(perSesiMap) {
  const t = { hadir: 0, sakit: 0, izin: 0, alfa: 0, cabut: 0 };
  Object.values(perSesiMap || {}).forEach((d) => {
    if (!d || !d.sudahDiisi) return;
    t.hadir += d.hadir || 0;
    t.sakit += d.sakit || 0;
    t.izin += d.izin || 0;
    t.alfa += d.alfa || 0;
    t.cabut += d.cabut || 0;
  });
  return t;
}

function tierPersenKehadiran(persen) {
  if (persen === null || persen === undefined)
    return { label: "Belum ada data", text: "#64748b", bg: "#e2e8f0" };
  if (persen >= 90)
    return { label: "Sangat Baik", text: "#065f46", bg: "#a7f3d0" };
  if (persen >= 80)
    return { label: "Baik", text: "#3f6212", bg: "#d9f99d" };
  if (persen >= 70)
    return { label: "Cukup", text: "#92400e", bg: "#fde68a" };
  if (persen >= 60)
    return { label: "Kurang", text: "#9a3412", bg: "#fed7aa" };
  return { label: "Rendah", text: "#9f1239", bg: "#fecdd3" };
}

function PersenKehadiranBar({ data, label, semuaData, jumlahSesi }) {
  const persen = hitungPersenKehadiran(data);
  const tier = tierPersenKehadiran(persen);

  return (
    <div className="rounded-xl border border-yellow-200 bg-white/90 px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap shadow-sm">
      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
        📈 % Kehadiran {label}
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        <span
          className="px-2 py-0.5 rounded text-xs font-black"
          style={{ color: tier.text, backgroundColor: tier.bg }}
          title={tier.label}
        >
          {persen === null ? "-" : `${persen}%`}
        </span>
        <span
          className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase"
          style={{ color: tier.text, backgroundColor: tier.bg }}
        >
          {tier.label}
        </span>
      </div>
    </div>
  );
}

const scrollHorizontal = (id, direction) => {
  const container = document.getElementById(id);
  if (container) {
    const scrollAmount = direction === "left" ? -200 : 200;
    container.scrollBy({ left: scrollAmount, behavior: "smooth" });
  }
};

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
    async (idMapel, idGuruParam = null) => {
      const activeGuruId = idGuruParam || guru?.id || getSession()?.id;
      if (!activeGuruId || !idMapel) return;
      setLoadingStatsMapel((prev) => ({ ...prev, [idMapel]: true }));

      try {
        const res = await getPresensiMapelGrid(activeGuruId, idMapel);
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
  const [namaKelasManual, setNamaKelasManual] = useState("");
  const [selectedSiswaManual, setSelectedSiswaManual] = useState([]);
  const [searchSiswaManual, setSearchSiswaManual] = useState("");
  const [filterKelasManual, setFilterKelasManual] = useState("");
  const [semuaSiswaManual, setSemuaSiswaManual] = useState([]);
  const [loadingSemuaSiswaManual, setLoadingSemuaSiswaManual] = useState(false);
  const [jenisMapel, setJenisMapel] = useState("biasa"); // "biasa" | "online"
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
  const [mapelJurnalAktif, setMapelJurnalAktif] = useState(null);

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
    const activeGuruId = idGuru || guru?.id || getSession()?.id;
    if (!activeGuruId) return;

    try {
      setLoading(true);
      setError("");
      const result = await getMapelByGuru(activeGuruId);
      if (result.success) {
        const list = result.data || [];
        setDaftarMapel(list);
        list.forEach((m) => {
          if (m.idMapel) loadStatsMapel(m.idMapel, activeGuruId);
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

  async function loadDaftarSiswaManual() {
    if (semuaSiswaManual.length > 0) return;
    try {
      setLoadingSemuaSiswaManual(true);
      const res = await getSiswa();
      if (res?.success && Array.isArray(res.data)) {
        const parsed = res.data
          .map((item) => {
            const idSiswa = String(
              item.ID || item.id || item.ID_SISWA || item.idSiswa || "",
            ).trim();
            const rawNama = String(
              item.NAMA || item.nama || item.NAMA_SISWA || "",
            ).trim();
            const match = rawNama.match(/^(.*?)\s*\[(.*?)\]$/);
            const nama = match ? match[1].trim() : rawNama;
            const kelas = match
              ? match[2].trim()
              : String(item.KELAS || item.kelas || "").trim();
            return { idSiswa, nama, kelas, rawNama };
          })
          .filter((s) => s.idSiswa && s.nama)
          .sort((a, b) => a.nama.localeCompare(b.nama));
        setSemuaSiswaManual(parsed);
      }
    } catch (err) {
      console.error("Gagal load siswa manual:", err);
    } finally {
      setLoadingSemuaSiswaManual(false);
    }
  }

  async function handlePilihKelas(kelas) {
    setKelasDipilih(kelas);
    if (!kelas) {
      setPreviewSiswa([]);
      return;
    }
    if (kelas === "__MANUAL__") {
      setPreviewSiswa([]);
      await loadDaftarSiswaManual();
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

  const uniqueClassesManual = useMemo(() => {
    return Array.from(
      new Set(
        semuaSiswaManual
          .map((s) => (s.kelas || "").trim())
          .filter(Boolean),
      ),
    ).sort();
  }, [semuaSiswaManual]);

  const filteredSiswaManual = useMemo(() => {
    return semuaSiswaManual.filter((s) => {
      const q = searchSiswaManual.trim().toLowerCase();
      const matchSearch =
        !q ||
        s.nama.toLowerCase().includes(q) ||
        (s.kelas && s.kelas.toLowerCase().includes(q)) ||
        s.idSiswa.includes(q);
      const matchKelas =
        !filterKelasManual || s.kelas === filterKelasManual;
      return matchSearch && matchKelas;
    });
  }, [semuaSiswaManual, searchSiswaManual, filterKelasManual]);

  const toggleSiswaManual = (id) => {
    setSelectedSiswaManual((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAllFiltered = () => {
    const idsToAdd = filteredSiswaManual.map((s) => s.idSiswa);
    setSelectedSiswaManual((prev) =>
      Array.from(new Set([...prev, ...idsToAdd])),
    );
  };

  const handleDeselectAll = () => {
    setSelectedSiswaManual([]);
  };

  async function handleTambahMapel(e) {
    e.preventDefault();
    if (!namaMapel.trim()) {
      alert("Nama mapel wajib diisi.");
      return;
    }

    const isManual = kelasDipilih === "__MANUAL__";
    if (isManual) {
      if (!namaKelasManual.trim()) {
        alert("Nama kelas manual wajib diisi.");
        return;
      }
      if (selectedSiswaManual.length === 0) {
        const konfirmasi = window.confirm(
          "Belum ada siswa yang dipilih dari checklist.\nApakah Anda yakin ingin membuat kelas manual ini tanpa siswa terlebih dahulu?",
        );
        if (!konfirmasi) return;
      }
    }

    setSaving(true);
    try {
      // Encode jenis mapel online ke dalam keterangan
      const keteranganFinal =
        jenisMapel === "online"
          ? `[ONLINE]${keterangan.trim() ? " " + keterangan.trim() : ""}`
          : keterangan.trim();

      const finalKelas = isManual
        ? namaKelasManual.trim()
        : (kelasDipilih || "");

      const result = await addMapel({
        idGuru: guru.id,
        namaMapel: namaMapel.trim(),
        kelas: finalKelas,
        keterangan: keteranganFinal,
        idSiswaList: isManual ? selectedSiswaManual : undefined,
      });

      if (result.success) {
        const newIdMapel = result.data?.idMapel;
        let jumlahBerhasil = result.data?.jumlahSiswaOtomatis || 0;

        // Jika kelas manual dan ada siswa yang dipilih, daftarkan siswa ke mapel jika backend belum otomatis memasukkannya
        if (
          isManual &&
          newIdMapel &&
          selectedSiswaManual.length > 0 &&
          jumlahBerhasil === 0
        ) {
          const chunkSize = 5;
          for (let i = 0; i < selectedSiswaManual.length; i += chunkSize) {
            const chunk = selectedSiswaManual.slice(i, i + chunkSize);
            await Promise.all(
              chunk.map(async (idSiswa) => {
                try {
                  await simpanSiswaMapel({
                    idGuru: guru.id,
                    idMapel: newIdMapel,
                    idSiswa,
                  });
                  jumlahBerhasil++;
                } catch (err) {
                  console.error("Gagal simpan siswa mapel:", err);
                }
              }),
            );
          }
        }

        if (isManual) {
          alert(
            `✅ Mapel "${namaMapel.trim()}" (Kelas: ${finalKelas}) berhasil dibuat.\n\n` +
              `${selectedSiswaManual.length} siswa berhasil didaftarkan ke kelas manual ini.` +
              (jenisMapel === "online"
                ? "\n\n🌐 Mapel ini dikonfigurasi sebagai Mapel Online."
                : ""),
          );
        } else if (kelasDipilih) {
          alert(
            `✅ Mapel "${namaMapel.trim()}" berhasil dibuat untuk kelas ${kelasDipilih}.\n\n` +
              `${jumlahBerhasil} siswa dari kelas tersebut otomatis dimasukkan ke mapel ini.` +
              (jenisMapel === "online"
                ? "\n\n🌐 Mapel ini dikonfigurasi sebagai Mapel Online."
                : ""),
          );
        } else {
          alert(`✅ Mapel "${namaMapel.trim()}" berhasil dibuat.`);
        }

        setNamaMapel("");
        setKeterangan("");
        setKelasDipilih("");
        setNamaKelasManual("");
        setSelectedSiswaManual([]);
        setSearchSiswaManual("");
        setFilterKelasManual("");
        setJenisMapel("biasa");
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
                      Pilihan Kelas{" "}
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
                          : "-- Tanpa kelas / Pilih kelas --"}
                      </option>
                      <option
                        value="__MANUAL__"
                        className="font-bold text-emerald-700 bg-emerald-50"
                      >
                        ✏️ Kelas Manual (Input Nama & Seleksi Checklist Siswa)
                      </option>
                      {KELAS_OPTIONS}
                    </select>
                  </label>
                </div>

                {/* KONFIGURASI KELAS MANUAL JIKA DIPILIH */}
                {kelasDipilih === "__MANUAL__" && (
                  <div className="rounded-2xl border-2 border-emerald-400 bg-white p-4 sm:p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                    <div className="flex items-center justify-between flex-wrap gap-2 border-b border-emerald-100 pb-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
                          <span>✏️</span> Konfigurasi Kelas Manual
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Tentukan nama kelas dan pilih siswa secara manual menggunakan checklist di bawah.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                        <span>✓</span>
                        <span>{selectedSiswaManual.length} Siswa Dipilih</span>
                      </div>
                    </div>

                    {/* INPUT NAMA KELAS MANUAL */}
                    <div>
                      <label className="block">
                        <span className="block text-xs font-bold uppercase text-slate-700 mb-1.5">
                          Nama Kelas Manual <span className="text-rose-500">*</span>
                        </span>
                        <input
                          type="text"
                          value={namaKelasManual}
                          onChange={(e) => setNamaKelasManual(e.target.value)}
                          placeholder="Contoh: Kelas Binaan / X TJKT Gabungan / XII Remedial"
                          required
                          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all shadow-xs"
                        />
                      </label>
                    </div>

                    {/* SELEKSI SISWA CHECKLIST */}
                    <div className="space-y-2.5 pt-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-bold uppercase text-slate-700">
                          Pilih Siswa Manual (Checklist)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSelectAllFiltered}
                            disabled={filteredSiswaManual.length === 0}
                            className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                          >
                            ☑️ Pilih Semua ({filteredSiswaManual.length})
                          </button>
                          <button
                            type="button"
                            onClick={handleDeselectAll}
                            disabled={selectedSiswaManual.length === 0}
                            className="text-[11px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                          >
                            ⏹️ Kosongkan Pilihan
                          </button>
                        </div>
                      </div>

                      {/* FILTER & PENCARIAN SISWA */}
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-xs">
                            🔍
                          </span>
                          <input
                            type="text"
                            value={searchSiswaManual}
                            onChange={(e) => setSearchSiswaManual(e.target.value)}
                            placeholder="Cari nama atau kelas siswa..."
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-500 transition-all"
                          />
                        </div>
                        <select
                          value={filterKelasManual}
                          onChange={(e) => setFilterKelasManual(e.target.value)}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:border-emerald-500 transition-all cursor-pointer"
                        >
                          <option value="">-- Semua Kelas ({uniqueClassesManual.length}) --</option>
                          {uniqueClassesManual.map((k) => (
                            <option key={k} value={k}>
                              Kelas {k}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* LIST SISWA CHECKLIST */}
                      {loadingSemuaSiswaManual ? (
                        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200">
                          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent mb-2" />
                          <p className="text-xs font-bold text-slate-500">Memuat data seluruh siswa...</p>
                        </div>
                      ) : filteredSiswaManual.length === 0 ? (
                        <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                          Tidak ada siswa ditemukan yang cocok dengan pencarian / filter.
                        </div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto space-y-1.5 p-1 bg-slate-50/70 rounded-xl border border-slate-200 custom-scrollbar">
                          {filteredSiswaManual.map((s, idx) => {
                            const isSelected = selectedSiswaManual.includes(s.idSiswa);
                            return (
                              <label
                                key={s.idSiswa || idx}
                                className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                  isSelected
                                    ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-xs"
                                    : "bg-white border-slate-200/80 hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSiswaManual(s.idSiswa)}
                                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 shrink-0"
                                />
                                <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className={`text-xs truncate ${isSelected ? "font-black text-emerald-950" : "font-bold text-slate-800"}`}>
                                      {s.nama}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                      ID: {s.idSiswa}
                                    </p>
                                  </div>
                                  {s.kelas && (
                                    <span className="shrink-0 rounded-md bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-bold">
                                      {s.kelas}
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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

                {/* PILIHAN JENIS MAPEL */}
                <div>
                  <span className="block text-xs font-bold uppercase text-slate-700 mb-2">
                    Jenis Kelas Mapel
                  </span>
                  <div className="flex gap-3 flex-wrap">
                    <label
                      className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${jenisMapel === "biasa" ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <input
                        type="radio"
                        name="jenisMapelKelola"
                        value="biasa"
                        checked={jenisMapel === "biasa"}
                        onChange={() => setJenisMapel("biasa")}
                        className="accent-blue-600"
                      />
                      <div>
                        <span className="text-sm font-black text-slate-800">
                          📋 Mapel Biasa
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Presensi & nilai harian tatap muka
                        </p>
                      </div>
                    </label>
                    <label
                      className={`flex items-center gap-2 cursor-pointer px-4 py-2.5 rounded-xl border-2 transition-all ${jenisMapel === "online" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white hover:border-slate-300"}`}
                    >
                      <input
                        type="radio"
                        name="jenisMapelKelola"
                        value="online"
                        checked={jenisMapel === "online"}
                        onChange={() => setJenisMapel("online")}
                        className="accent-emerald-600"
                      />
                      <div>
                        <span className="text-sm font-black text-slate-800">
                          🌐 Mapel Online
                        </span>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Presensi + upload tugas & pengumpulan siswa
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {kelasDipilih && kelasDipilih !== "__MANUAL__" && (
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

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full sm:w-auto rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black px-8 py-3.5 shadow-md transition-all disabled:opacity-60 active:scale-95"
                  >
                    {saving ? "Menyimpan..." : "💾 SIMPAN MAPEL"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormMapelOpen(false);
                      setNamaMapel("");
                      setKeterangan("");
                      setKelasDipilih("");
                      setNamaKelasManual("");
                      setSelectedSiswaManual([]);
                      setSearchSiswaManual("");
                      setFilterKelasManual("");
                      setJenisMapel("biasa");
                      setPreviewSiswa([]);
                    }}
                    className="rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-bold px-6 py-3.5 transition-all active:scale-95"
                  >
                    Batal
                  </button>
                </div>
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
                  // Deteksi mapel online
                  const isMapelOnline = String(
                    mapel.keterangan || "",
                  ).startsWith("[ONLINE]");
                  const keteranganBersih = isMapelOnline
                    ? String(mapel.keterangan || "")
                        .replace(/^\[ONLINE\]\s*/, "")
                        .trim()
                    : String(mapel.keterangan || "").trim();

                  return (
                    <div
                      key={mapel.idMapel}
                      className={`group relative overflow-hidden rounded-2xl border-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.12)] ${
                        isAktif
                          ? isMapelOnline
                            ? "border-emerald-500 ring-2 ring-emerald-400/40 shadow-emerald-500/20"
                            : "border-indigo-500 ring-2 ring-indigo-400/40 shadow-indigo-500/20"
                          : isMapelOnline
                            ? "border-teal-300/80"
                            : "border-indigo-200/80"
                      }`}
                    >
                      {isEditing ? (
                        <div className="space-y-3 bg-white p-4 rounded-xl shadow-inner text-slate-800 m-3">
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
                          {/* HEADER CARD MAPEL: KOMPAK & MODERN */}
                          <div
                            className={`relative overflow-hidden px-3.5 py-3 sm:px-4 sm:py-3.5 ${
                              isMapelOnline
                                ? "bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600"
                                : "bg-gradient-to-r from-blue-700 via-indigo-600 to-violet-700"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-lg text-white shadow-xs backdrop-blur-sm sm:h-10 sm:w-10 sm:text-xl">
                                  {isMapelOnline ? "🌐" : "📚"}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h3 className="truncate text-sm sm:text-base font-bold text-white leading-tight">
                                      {mapel.namaMapel}
                                    </h3>
                                    <span className="inline-flex shrink-0 items-center rounded-full border border-white/30 bg-white/20 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                                      {isMapelOnline ? "Online" : "Mapel"}
                                    </span>
                                    {isAktif && (
                                      <span className="inline-flex shrink-0 items-center rounded-full border border-amber-300 bg-amber-400 text-amber-950 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider shadow-xs">
                                        ✓ Terpilih
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-white/90">
                                    {mapel.kelas && (
                                      <span className="inline-flex items-center rounded-md bg-white/15 border border-white/20 px-1.5 py-0.5 font-medium">
                                        Kelas {mapel.kelas}
                                      </span>
                                    )}
                                    <span className="inline-flex items-center rounded-md bg-white/15 border border-white/20 px-1.5 py-0.5 font-medium">
                                      👥 {totalSiswaDisplay} Siswa
                                    </span>
                                    {totalPertemuanDisplay > 0 && (
                                      <span className="inline-flex items-center rounded-md bg-white/15 border border-white/20 px-1.5 py-0.5 font-medium">
                                        🗓️ {totalPertemuanDisplay} Sesi
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* STATUS TERISI */}
                              <div className="shrink-0 text-right">
                                {isLoadingStats ? (
                                  <span className="inline-flex items-center rounded-full bg-white/20 border border-white/30 px-2 py-0.5 text-[9px] font-semibold text-white">
                                    ⏳ Memuat
                                  </span>
                                ) : meetingData?.sudahDiisi ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/25 border border-emerald-300/40 px-2 py-0.5 text-[9px] font-bold text-emerald-100">
                                    ✅ P-{activeP} Terisi
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-white/10 border border-white/20 px-2 py-0.5 text-[9px] text-white/70 font-medium">
                                    Belum Presensi
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* BODY KARTU MAPEL (BERWARNA MENYESUAIKAN REGULER / DARING) */}
                          <div
                            className={`p-3 sm:p-3.5 space-y-2.5 ${
                              isMapelOnline
                                ? "bg-gradient-to-b from-emerald-100/90 via-teal-50/70 to-emerald-100/95"
                                : "bg-gradient-to-b from-blue-100/90 via-indigo-50/70 to-blue-100/95"
                            }`}
                          >
                            {/* KETERANGAN */}
                            {keteranganBersih && (
                              <div
                                className={`rounded-xl border px-2.5 py-1.5 text-[11px] line-clamp-2 leading-relaxed ${
                                  isMapelOnline
                                    ? "border-teal-200/90 bg-white/90 text-teal-950"
                                    : "border-blue-200/90 bg-white/90 text-indigo-950"
                                }`}
                              >
                                {keteranganBersih}
                              </div>
                            )}

                            {/* AKSI CEPAT (RESPONSIF MOBILE) */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setMapelTambahTarget(mapel)}
                                title="Tambah / Daftarkan Siswa ke Mapel Ini"
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white py-2 px-1.5 text-[10px] sm:text-[11px] font-semibold shadow-2xs transition-all cursor-pointer"
                              >
                                <span>➕</span>
                                <span className="truncate">Tambah Siswa</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setMapelJurnalAktif(mapel)}
                                className={`inline-flex items-center justify-center gap-1 rounded-xl text-white py-2 px-1.5 text-[10px] sm:text-[11px] font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer ${
                                  isMapelOnline
                                    ? "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
                                    : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
                                }`}
                                title="Catat & lihat jurnal pembelajaran mapel"
                              >
                                <span>📝</span>
                                <span className="truncate">Jurnal</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleCetakPdfMapel(mapel)}
                                disabled={cetakCardLoadingId === mapel.idMapel}
                                title="Cetak Laporan Presensi, Nilai & Jurnal PDF"
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-700 hover:to-pink-700 active:scale-95 text-white py-2 px-1.5 text-[10px] sm:text-[11px] font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                              >
                                {cetakCardLoadingId === mapel.idMapel ? (
                                  <>
                                    <span className="inline-block animate-spin">⏳</span>
                                    <span className="truncate">Cetak...</span>
                                  </>
                                ) : (
                                  <>
                                    <span>🖨️</span>
                                    <span className="truncate">Cetak PDF</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() => pilihMapelAktif(mapel)}
                                disabled={isAktif}
                                className={`inline-flex items-center justify-center gap-1 rounded-xl py-2 px-1.5 text-[10px] sm:text-[11px] font-semibold shadow-2xs transition-all active:scale-95 cursor-pointer ${
                                  isAktif
                                    ? "bg-amber-400 text-amber-950 font-bold border border-amber-500 cursor-not-allowed opacity-90"
                                    : isMapelOnline
                                      ? "bg-teal-700 hover:bg-teal-800 text-white"
                                      : "bg-blue-600 hover:bg-blue-700 text-white"
                                }`}
                              >
                                <span>{isAktif ? "✓" : "📌"}</span>
                                <span className="truncate">{isAktif ? "Terpilih" : "Pilih Mapel"}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => mulaiEdit(mapel)}
                                title="Edit nama mapel dan keterangan"
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white py-2 px-1.5 text-[10px] sm:text-[11px] font-semibold shadow-2xs transition-all cursor-pointer"
                              >
                                <span>✏️</span>
                                <span className="truncate">Edit</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => hapusMapelHandler(mapel)}
                                title="Hapus mapel"
                                className="inline-flex items-center justify-center gap-1 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white py-2 px-1.5 text-[10px] sm:text-[11px] font-semibold shadow-2xs transition-all cursor-pointer"
                              >
                                <span>🗑️</span>
                                <span className="truncate">Hapus</span>
                              </button>
                            </div>

                            {isLoadingStats && (
                              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] font-bold text-amber-800">
                                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                                <span>Menyinkronkan data presensi dan riwayat pertemuan...</span>
                              </div>
                            )}

                            {/* PANEL PRESENSI PADAT */}
                            <div
                              className={`rounded-xl border p-2.5 sm:p-3 space-y-2 shadow-xs ${
                                isMapelOnline
                                  ? "border-teal-200/90 bg-white/95"
                                  : "border-indigo-200/90 bg-white/95"
                              }`}
                            >
                              {/* BARIS PILIH SESI PERTEMUAN (JIKA LEBIH DARI 1) */}
                              {stats?.validMeetings && stats.validMeetings.length > 1 && (
                                <div
                                  className={`flex items-center gap-1.5 pb-2 border-b ${
                                    isMapelOnline ? "border-teal-100" : "border-indigo-100"
                                  }`}
                                >
                                  <span
                                    className={`text-[10px] font-semibold shrink-0 ${
                                      isMapelOnline ? "text-teal-700" : "text-indigo-700"
                                    }`}
                                  >
                                    Sesi:
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => scrollHorizontal(`scroll-sesi-mapel-${mapel.idMapel}`, "left")}
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] transition-colors ${
                                      isMapelOnline
                                        ? "border-teal-200 bg-teal-50/70 text-teal-700 hover:bg-teal-100"
                                        : "border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100"
                                    }`}
                                  >
                                    ◀
                                  </button>
                                  <div
                                    id={`scroll-sesi-mapel-${mapel.idMapel}`}
                                    className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-smooth py-0.5"
                                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                                  >
                                    <style>{`#scroll-sesi-mapel-${mapel.idMapel}::-webkit-scrollbar { display: none; }`}</style>
                                    {[...stats.validMeetings].reverse().map((pNum) => {
                                      const isSel = pNum === activeP;
                                      return (
                                        <button
                                          key={pNum}
                                          type="button"
                                          disabled={isLoadingStats}
                                          onClick={() =>
                                            setSelectedPertemuanMapel((prev) => ({
                                              ...prev,
                                              [mapel.idMapel]: pNum,
                                            }))
                                          }
                                          className={`shrink-0 rounded-lg px-2 py-0.5 text-[10px] font-semibold transition-all ${
                                            isSel
                                              ? isMapelOnline
                                                ? "bg-teal-600 text-white shadow-2xs"
                                                : "bg-indigo-600 text-white shadow-2xs"
                                              : isMapelOnline
                                                ? "bg-teal-100/70 text-teal-800 hover:bg-teal-200/70"
                                                : "bg-indigo-100/70 text-indigo-800 hover:bg-indigo-200/70"
                                          }`}
                                        >
                                          P-{pNum}{pNum === stats.latestP ? " ⭐" : ""}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => scrollHorizontal(`scroll-sesi-mapel-${mapel.idMapel}`, "right")}
                                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[10px] transition-colors ${
                                      isMapelOnline
                                        ? "border-teal-200 bg-teal-50/70 text-teal-700 hover:bg-teal-100"
                                        : "border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100"
                                    }`}
                                  >
                                    ▶
                                  </button>
                                </div>
                              )}

                              {/* INFO TANGGAL SESI AKTIF */}
                              <div
                                className={`flex items-center justify-between text-[11px] flex-wrap gap-1 ${
                                  isMapelOnline ? "text-teal-900" : "text-indigo-950"
                                }`}
                              >
                                <span className="font-semibold">
                                  {activeP
                                    ? `Pertemuan ${activeP}${
                                        meetingData?.tanggal ? ` • ${formatTanggalMapelIndo(meetingData.tanggal)}` : ""
                                      }`
                                    : "Belum ada catatan pertemuan"}
                                </span>
                                {meetingData?.rataRataNilai && (
                                  <span
                                    className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                                      isMapelOnline
                                        ? "text-teal-800 bg-teal-100 border-teal-200"
                                        : "text-indigo-800 bg-indigo-100 border-indigo-200"
                                    }`}
                                  >
                                    Nilai: {meetingData.rataRataNilai}
                                  </span>
                                )}
                              </div>

                              {/* 5 COUNTERS KEHADIRAN RINGKAS */}
                              <div className="grid grid-cols-5 gap-1 text-center">
                                {[
                                  { label: "Hadir", val: meetingData?.hadir || 0, cls: "border-emerald-200 bg-emerald-50/80 text-emerald-800" },
                                  { label: "Sakit", val: meetingData?.sakit || 0, cls: "border-blue-200 bg-blue-50/80 text-blue-800" },
                                  { label: "Izin",  val: meetingData?.izin  || 0, cls: "border-amber-200 bg-amber-50/80 text-amber-800" },
                                  { label: "Alfa",  val: meetingData?.alfa  || 0, cls: "border-rose-200 bg-rose-50/80 text-rose-800" },
                                  { label: "Cabut", val: meetingData?.cabut || 0, cls: "border-violet-200 bg-violet-50/80 text-violet-800" },
                                ].map(({ label, val, cls }) => (
                                  <div key={label} className={`rounded-lg border px-1 py-1 ${cls}`}>
                                    <span className="block text-[8px] font-bold uppercase opacity-75">{label}</span>
                                    <span className="block text-xs font-bold leading-tight">{val}</span>
                                  </div>
                                ))}
                              </div>

                              {/* BAR PERSEN KEHADIRAN JIKA SUDAH DIISI */}
                              {meetingData?.sudahDiisi && (
                                <div className="pt-0.5">
                                  <PersenKehadiranBar
                                    data={meetingData}
                                    label={`P-${activeP}`}
                                    semuaData={gabungStatistikSesi(stats?.perPertemuan)}
                                    jumlahSesi={stats?.validMeetings?.length || 0}
                                  />
                                </div>
                              )}

                              {/* DAFTAR SISWA TIDAK HADIR / NIHIL ABSEN */}
                              {meetingData?.sudahDiisi ? (
                                meetingData?.absenList?.length > 0 ? (
                                  <div className="rounded-lg border border-amber-200/80 bg-amber-50/60 p-2">
                                    <div className="flex items-center justify-between mb-1 text-[10px] font-semibold text-amber-800">
                                      <span>⚠️ Siswa Tidak Hadir</span>
                                      <span>{meetingData.absenList.length} siswa</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-0.5 custom-scrollbar">
                                      {meetingData.absenList.map((item, i) => {
                                        let badgeCls = "border-rose-200 bg-rose-50 text-rose-700";
                                        if (item.status === "Sakit") badgeCls = "border-blue-200 bg-blue-50 text-blue-700";
                                        else if (item.status === "Izin") badgeCls = "border-amber-200 bg-amber-50 text-amber-700";
                                        else if (item.status === "Cabut") badgeCls = "border-violet-200 bg-violet-50 text-violet-700";
                                        return (
                                          <span
                                            key={i}
                                            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-medium ${badgeCls}`}
                                          >
                                            <b className="font-bold">{item.status}:</b>
                                            <span className="max-w-[120px] truncate">{item.nama}</span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1.5 text-[10px] font-medium text-emerald-800 flex items-center gap-1.5">
                                    <span>✨</span>
                                    <span>Semua siswa hadir (Nihil absen)</span>
                                  </div>
                                )
                              ) : (
                                <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-500">
                                  💡 Belum ada presensi yang dicatat pada pertemuan ini.
                                </div>
                              )}
                            </div>

                            {/* TOMBOL UTAMA: BUKA / TUTUP PRESENSI & NILAI */}
                            <button
                              type="button"
                              onClick={() => toggleExpand(mapel.idMapel)}
                              className={`flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold tracking-wide shadow-2xs transition-all hover:brightness-105 active:scale-[0.99] cursor-pointer ${
                                isExpanded
                                  ? "border-slate-700 bg-slate-800 text-amber-300"
                                  : isMapelOnline
                                    ? "border-teal-400 bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 hover:from-teal-700 hover:to-emerald-800 text-white shadow-teal-500/20"
                                    : "border-indigo-400 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800 text-white shadow-indigo-500/20"
                              }`}
                            >
                              <span>{isExpanded ? "🔽" : "📊"}</span>
                              <span>
                                {isExpanded
                                  ? "TUTUP PRESENSI & NILAI"
                                  : "BUKA PRESENSI & NILAI"}
                              </span>
                            </button>
                          </div>
                        </>
                      )}

{/* TABEL PRESENSI GRID SAAT DI-EXPAND */}
                      {/* ============================================================ */}
                      {isExpanded && !isEditing && (
                        <div
                          className={`border-t rounded-2xl p-2 sm:p-4 shadow-inner overflow-hidden mt-4 ${
                            isMapelOnline
                              ? "bg-teal-950/5 border-teal-500/30 text-slate-800"
                              : "bg-indigo-950/5 border-indigo-500/30 text-slate-800"
                          }`}
                        >
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
        {/* MODAL JURNAL MAPEL */}
        {mapelJurnalAktif && (
          <ModalJurnalMapel
            isOpen={!!mapelJurnalAktif}
            onClose={() => setMapelJurnalAktif(null)}
            guru={guru}
            mapel={mapelJurnalAktif}
            onSaved={() => {
              const targetId = mapelJurnalAktif?.idMapel;
              if (targetId) loadStatsMapel(targetId);
            }}
          />
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
  const [pertemuanDihapusList, setPertemuanDihapusList] = useState([]);

  // State khusus Mapel Online
  const isMapelOnline = String(mapel?.keterangan || "").startsWith("[ONLINE]");
  const [tugasMapel, setTugasMapel] = useState({}); // { [p]: tugasObj }
  const [jawabanSiswa, setJawabanSiswa] = useState({}); // { [`${idSiswa}_${p}`]: jawabanObj }
  const [modalTugasOpen, setModalTugasOpen] = useState(false);
  const [targetTugasP, setTargetTugasP] = useState(null);
  const [judulTugasInput, setJudulTugasInput] = useState("");
  const [deskripsiTugasInput, setDeskripsiTugasInput] = useState("");
  const [linkTugasInput, setLinkTugasInput] = useState("");
  const [fileTugasInput, setFileTugasInput] = useState(null);
  const [uploadingTugas, setUploadingTugas] = useState(false);

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
      setPertemuanDihapusList([]);

      // Jika mapel online, muat tugas guru dan jawaban siswa
      if (isMapelOnline) {
        try {
          const resTugas = await getTugasMapel(mapel.idMapel, "");
          if (resTugas?.success && Array.isArray(resTugas.data)) {
            const tMap = {};
            resTugas.data.forEach((t) => {
              if (t.pertemuanKe) tMap[Number(t.pertemuanKe)] = t;
            });
            setTugasMapel(tMap);
          }
          const resJwb = await getJawabanSiswa(mapel.idMapel, "", "");
          if (resJwb?.success && Array.isArray(resJwb.data)) {
            const jMap = {};
            resJwb.data.forEach((j) => {
              if (j.idSiswa && j.pertemuanKe) {
                jMap[`${j.idSiswa}_${j.pertemuanKe}`] = j;
              }
            });
            setJawabanSiswa(jMap);
          }
        } catch (errTugas) {
          console.warn("Gagal memuat tugas/jawaban online kelola:", errTugas);
        }
      }
    } catch (err) {
      console.error("ERROR LOAD GRID PRESENSI:", err);
    } finally {
      setLoading(false);
    }
  }

  function bukaModalTugas(p) {
    setTargetTugasP(p);
    const existing = tugasMapel[p];
    setJudulTugasInput(existing?.judulTugas || `Tugas Pertemuan ${p}`);
    
    // Ekstrak link lama: dari linkUrl, dari [LINK]: di deskripsi, atau fileUrl non-drive
    const rawDeskripsi = String(existing?.deskripsi || "");
    let existingLink = existing?.linkUrl || "";
    if (!existingLink) {
      const matchLink = rawDeskripsi.match(/\[LINK\]:\s*([^\s\r\n]+)/i);
      if (matchLink) {
        existingLink = matchLink[1].trim();
      } else if (existing?.fileUrl && !existing.fileUrl.includes("drive.google.com")) {
        existingLink = existing.fileUrl;
      }
    }
    setLinkTugasInput(existingLink || "");

    const deskripsiClean = rawDeskripsi.replace(/\[LINK\]:\s*\S+/gi, "").trim();
    setDeskripsiTugasInput(deskripsiClean);
    setFileTugasInput(null);
    setModalTugasOpen(true);
  }

  async function handleSimpanTugas() {
    if (!targetTugasP) return;
    if (!judulTugasInput.trim()) {
      alert("Judul tugas wajib diisi.");
      return;
    }
    setUploadingTugas(true);
    try {
      let fileBase64 = "";
      let namaFile = "";
      let mimeType = "";
      if (fileTugasInput) {
        fileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(fileTugasInput);
        });
        namaFile = fileTugasInput.name;
        mimeType = fileTugasInput.type || "application/pdf";
      }
      const existing = tugasMapel[targetTugasP];
      const linkTugasBersih = linkTugasInput.trim();

      // Gabungkan link ke deskripsi agar 100% kompatibel & tersimpan di Sheet
      let deskripsiFinal = deskripsiTugasInput.trim();
      if (linkTugasBersih) {
        deskripsiFinal = deskripsiFinal.replace(/\[LINK\]:\s*\S+/gi, "").trim();
        deskripsiFinal = deskripsiFinal
          ? `${deskripsiFinal}\n\n[LINK]: ${linkTugasBersih}`
          : `[LINK]: ${linkTugasBersih}`;
      }

      const res = await uploadTugasMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        pertemuanKe: targetTugasP,
        judulTugas: judulTugasInput.trim(),
        deskripsi: deskripsiFinal,
        linkUrl: linkTugasBersih,
        fileUrl: linkTugasBersih && !fileTugasInput ? linkTugasBersih : (existing?.fileUrl || ""),
        fileBase64,
        namaFile,
        mimeType,
      });

      if (res?.success) {
        alert("✅ Tugas & materi berhasil disimpan.");
        setTugasMapel((prev) => ({
          ...prev,
          [targetTugasP]: {
            ...prev[targetTugasP],
            judulTugas: judulTugasInput.trim(),
            deskripsi: deskripsiFinal,
            linkUrl: linkTugasBersih,
            fileUrl: res.data?.fileUrl || (linkTugasBersih && !fileTugasInput ? linkTugasBersih : existing?.fileUrl || ""),
          },
        }));
        setModalTugasOpen(false);
      } else {
        alert(res?.message || "Gagal menyimpan tugas.");
      }
    } catch (e) {
      console.error("Gagal simpan tugas:", e);
      alert("Terjadi kesalahan saat mengunggah tugas.");
    } finally {
      setUploadingTugas(false);
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
        `Data presensi dan tugas pada pertemuan terakhir ini akan dihapus permanen saat disimpan. Lanjutkan?`,
    );

    if (!konfirmasi) return;

    const pDihapus = jumlahPertemuan;
    setPertemuanDihapusList((prev) => [...prev, pDihapus]);
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
    setTugasMapel((prev) => {
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

    if (cells.length === 0 && pertemuanDihapusList.length === 0) {
      alert("Belum ada data presensi yang diisi.");
      return;
    }

    setSaving(true);
    try {
      // 1. Jika ada pertemuan yang dihapus, bersihkan di backend
      if (pertemuanDihapusList.length > 0) {
        await Promise.all(
          pertemuanDihapusList.map((p) =>
            hapusPertemuanMapel(guru.id, mapel.idMapel, p).catch(() => null)
          )
        );
      }

      // 2. Simpan presensi saat ini beserta parameter pertemuanDihapus & maxPertemuan
      const result = await savePresensiMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        cells,
        pertemuanDihapus: pertemuanDihapusList,
        maxPertemuan: jumlahPertemuan,
      });
      if (result.success) {
        setPertemuanDihapusList([]);
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
                          className={`px-0.5 py-1.5 font-black border-b-2 border-slate-300 border-l border-slate-200 text-center sticky top-0 bg-slate-100 z-40 ${isMapelOnline ? "min-w-[85px] sm:min-w-[95px]" : "min-w-[55px] sm:min-w-[65px]"}`}
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

                          {/* Tombol Tugas Guru untuk Mapel Online */}
                          {isMapelOnline && (
                            <div className="mt-1 flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => bukaModalTugas(p)}
                                className={`text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 transition-all shadow-xs ${
                                  tugasMapel[p]
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                                }`}
                                title={
                                  tugasMapel[p]
                                    ? `Edit Tugas P-${p}: ${tugasMapel[p].judulTugas}`
                                    : "Upload tugas guru untuk pertemuan ini"
                                }
                              >
                                <span>{tugasMapel[p] ? "📎" : "➕"}</span>
                                <span>
                                  {tugasMapel[p] ? "Tugas P" + p : "Tugas"}
                                </span>
                              </button>
                            </div>
                          )}
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
                                <div className="flex flex-col items-center justify-center gap-1 w-full h-full py-0.5">
                                  <div className="flex flex-row items-center justify-center gap-0.5">
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

                                  {/* KHUSUS MAPEL ONLINE: UPLOAD TUGAS GURU & HASIL UPLOAD SISWA */}
                                  {isMapelOnline && (
                                    <div className="flex flex-col items-center gap-0.5 w-full pt-1 border-t border-slate-200/60 leading-none">
                                      {/* Tempat upload tugas untuk siswa dari guru mapel */}
                                      {tugasMapel[p] ? (
                                        <a
                                          href={tugasMapel[p].fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Tugas Guru: ${tugasMapel[p].judulTugas || "Buka file"}`}
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-[8px] font-bold border border-blue-200 transition-all max-w-[80px] truncate"
                                        >
                                          <span>📎</span>
                                          <span className="truncate">
                                            Tugas Guru
                                          </span>
                                        </a>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => bukaModalTugas(p)}
                                          className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-slate-500 hover:text-blue-700 text-[7px] font-bold border border-slate-200 transition-all"
                                          title="Upload tugas guru untuk pertemuan ini"
                                        >
                                          <span>➕</span>
                                          <span>Tugas</span>
                                        </button>
                                      )}

                                      {/* Dibawahnya: Hasil upload yang diupload siswa */}
                                      {jawabanSiswa[`${s.idSiswa}_${p}`] ? (
                                        <a
                                          href={
                                            jawabanSiswa[`${s.idSiswa}_${p}`]
                                              .fileUrl
                                          }
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Hasil upload ${s.nama}: ${jawabanSiswa[`${s.idSiswa}_${p}`].keterangan || "Buka jawaban siswa"}`}
                                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-[8px] font-extrabold border border-emerald-300 transition-all max-w-[80px] truncate"
                                        >
                                          <span>📥</span>
                                          <span className="truncate">
                                            Hasil Siswa
                                          </span>
                                        </a>
                                      ) : (
                                        <span className="text-[7px] text-slate-400 font-medium">
                                          Belum kumpul
                                        </span>
                                      )}
                                    </div>
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

      {/* MODAL UPLOAD TUGAS GURU (MAPEL ONLINE) */}
      {modalTugasOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b pb-2">
              <h4 className="text-sm font-black text-slate-800 flex items-center gap-1.5">
                <span>📎</span>
                <span>Upload Tugas Pertemuan {targetTugasP}</span>
              </h4>
              <button
                type="button"
                onClick={() => setModalTugasOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-slate-800">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Judul Tugas <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={judulTugasInput}
                  onChange={(e) => setJudulTugasInput(e.target.value)}
                  placeholder="Contoh: Tugas Mandiri Pertemuan 1"
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Instruksi / Deskripsi (opsional)
                </label>
                <textarea
                  rows={2}
                  value={deskripsiTugasInput}
                  onChange={(e) => setDeskripsiTugasInput(e.target.value)}
                  placeholder="Petunjuk pengerjaan tugas..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>🔗 Tautan / Link Tugas (YouTube, Drive, Web)</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">opsional</span>
                </label>
                <input
                  type="url"
                  value={linkTugasInput}
                  onChange={(e) => setLinkTugasInput(e.target.value)}
                  placeholder="Contoh: https://youtube.com/watch?v=... atau https://drive.google.com/..."
                  className="w-full rounded-xl border border-slate-300 p-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500"
                />
                {linkTugasInput && (linkTugasInput.includes("youtube.com") || linkTugasInput.includes("youtu.be")) && (
                  <p className="text-[10px] text-rose-600 font-bold mt-1 flex items-center gap-1 bg-rose-50 border border-rose-200 p-1.5 rounded-lg">
                    <span>🔴</span>
                    <span>Link YouTube terdeteksi — Video pembelajaran akan otomatis disematkan & ditampilkan paling atas di dashboard siswa!</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 flex items-center justify-between">
                  <span>📁 Unggah File Lampiran / Modul (PDF, Doc, Gambar)</span>
                  <span className="text-[10px] text-slate-400 font-normal lowercase">opsional</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                  onChange={(e) =>
                    setFileTugasInput(e.target.files?.[0] || null)
                  }
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {tugasMapel[targetTugasP]?.fileUrl && !fileTugasInput && (
                  <p className="text-[10px] text-emerald-600 mt-1">
                    ✓ Sudah ada berkas/link terunggah (
                    <a
                      href={tugasMapel[targetTugasP].fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline font-bold"
                    >
                      Buka Tautan/Berkas
                    </a>
                    ). Pilih file baru atau ubah link di atas jika ingin mengganti.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={handleSimpanTugas}
                disabled={uploadingTugas}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black py-2.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {uploadingTugas ? "⏳ Menyimpan..." : "💾 Simpan Tugas"}
              </button>
              <button
                type="button"
                onClick={() => setModalTugasOpen(false)}
                className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold py-2.5 px-4 transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
