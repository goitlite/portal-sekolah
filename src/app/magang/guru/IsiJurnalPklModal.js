"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSiswaByGuru, getJurnalPKL, saveJurnalPKL } from "../lib/api";

const OPSI_MATERI = [
  "Pengenalan lingkungan kerja, tata tertib, disiplin dan budaya kerja",
  "Kehadiran, ketepatan waktu dan tanggung jawab",
  "Pelaksanaan tugas sesuai kompetensi keahlian",
  "Keselamatan dan Kesehatan Kerja (K3)",
  "Komunikasi dan etika profesional",
  "Penyelesaian tugas dan tanggung jawab pekerjaan",
  "Adaptasi terhadap lingkungan kerja",
  "Penggunaan peralatan dan teknologi di tempat kerja",
  "Dokumentasi kegiatan PKL dan pengisian jurnal",
  "Evaluasi perkembangan kompetensi",
  "Penyelesaian permasalahan selama PKL",
  "Persiapan penyelesaian PKL dan laporan",
];

const OPSI_PERMASALAHAN = [
  "Siswa belum memahami sepenuhnya aturan dan budaya kerja di tempat PKL",
  "Siswa masih kurang disiplin dalam mengikuti jam kerja",
  "Siswa mengalami kesulitan memahami tugas yang diberikan oleh pembimbing industri",
  "Siswa belum sepenuhnya memahami prosedur K3 di lingkungan kerja",
  "Siswa masih kurang percaya diri berkomunikasi dengan karyawan/pembimbing",
  "Siswa membutuhkan waktu lebih lama dalam menyelesaikan tugas",
  "Siswa mengalami kesulitan beradaptasi dengan lingkungan dan ritme kerja",
  "Siswa belum terbiasa menggunakan beberapa peralatan/aplikasi yang digunakan di industri",
  "Jurnal kegiatan belum diisi secara rutin dan lengkap",
  "Terdapat beberapa kompetensi yang masih perlu ditingkatkan",
  "Siswa mengalami kendala dalam menyelesaikan tugas tertentu",
  "Siswa belum memahami kelengkapan administrasi akhir PKL",
];

const OPSI_TINDAK_LANJUT = [
  "Guru pembimbing memberikan arahan mengenai tata tertib, kedisiplinan, etika dan budaya kerja serta meminta siswa mengikuti arahan pembimbing industri",
  "Memberikan penguatan tentang pentingnya disiplin dan tanggung jawab serta melakukan pemantauan kehadiran",
  "Siswa diarahkan untuk aktif bertanya, mempelajari SOP pekerjaan dan meminta pendampingan industri",
  "Guru mengingatkan penggunaan APD dan kepatuhan terhadap SOP serta berkoordinasi dengan pembimbing industri",
  "Memberikan motivasi agar siswa berkomunikasi secara sopan, santun, percaya diri dan profesional",
  "Guru memberikan arahan mengenai manajemen waktu dan meminta siswa memahami industri kerja sebelum melaksanakan tugas",
  "Memberikan pendampingan dan motivasi agar siswa mampu beradaptasi serta menjaga sikap positif",
  "Siswa diarahkan untuk mempelajari petunjuk penggunaan, bertanya kepada pembimbing industri dan melakukan praktik dengan pengawasan",
  "Siswa diminta mengisi jurnal secara berkala sesuai kegiatan yang benar-benar dilakukan dan mendapatkan validasi pembimbing industri",
  "Guru dan pembimbing industri memberikan umpan balik serta perbaikan sesuai kebutuhan siswa",
  "Guru melakukan konsultasi dengan siswa dan pembimbing industri untuk menentukan solusi yang sesuai",
  "Guru memberikan arahan mengenai laporan, jurnal, dokumentasi, penilaian dan administrasi yang harus diselesaikan",
];

const OPT_LAINNYA = "__LAINNYA__";

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

function buildOpsiMingguKe() {
  const now = new Date();
  const opsi = [];
  for (let offset = -1; offset <= 4; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const bulan = NAMA_BULAN[d.getMonth()];
    const tahun = d.getFullYear();
    for (let minggu = 1; minggu <= 5; minggu++) {
      opsi.push(`Minggu ke-${minggu} ${bulan} ${tahun}`);
    }
  }
  return opsi;
}

function formatWaktu(tanggalISO) {
  if (!tanggalISO) return "";
  const d = new Date(
    tanggalISO.includes("T") ? tanggalISO : tanggalISO + "T00:00:00",
  );
  if (isNaN(d.getTime())) return tanggalISO;
  return (
    d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }) + " WIB"
  );
}

function parseNamaKelas(namaLengkap) {
  const text = String(namaLengkap || "").trim();
  let nama = text;
  let kelasData = "";
  const match = text.match(/\s*\[([^\]]+)\]\s*$/);
  if (match) {
    kelasData = match[1].trim();
    nama = text.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
  }
  return { nama, kelas: kelasData };
}

function normalisasiSiswa(item) {
  const idSiswa = String(item.idSiswa ?? item.id ?? item.ID ?? "").trim();
  const namaMentah = String(item.nama ?? item.NAMA ?? "").trim();
  const { nama, kelas } = parseNamaKelas(namaMentah);
  const tempatPkl = String(
    item.tempatMagang ?? item.TEMPAT_MAGANG ?? item.tempatPkl ?? "",
  ).trim();
  return {
    idSiswa,
    nama,
    kelas: item.kelas || kelas || "-",
    tempatPkl,
  };
}

let rowUid = 0;
function buatBarisBaru() {
  rowUid += 1;
  return {
    key: `row-${Date.now()}-${rowUid}`,
    mingguKe: "",
    tanggal: "",
    idSiswa: "",
    namaSiswa: "",
    kelas: "",
    tempatPkl: "",
    materiPilih: "",
    materiManual: "",
    masalahPilih: "",
    masalahManual: "",
    tindakPilih: "",
    tindakManual: "",
    ingatFoto: false,
    foto: "",
  };
}

export default function IsiJurnalPklModal({
  isOpen,
  onClose,
  idGuru,
  namaGuru,
  onSaved,
}) {
  const [activeTab, setActiveTab] = useState("form"); // 'form' | 'riwayat'
  const [siswaList, setSiswaList] = useState([]);
  const [savedJurnalList, setSavedJurnalList] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [rows, setRows] = useState([buatBarisBaru()]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");

  // State pencarian & pratinjau foto
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMinggu, setFilterMinggu] = useState("");
  const [previewFotoUrl, setPreviewFotoUrl] = useState(null);

  const watermarkCanvasRef = useRef(null);
  const opsiMingguKe = useMemo(() => buildOpsiMingguKe(), []);
  const daftarKelas = useMemo(() => {
    const set = new Set(
      siswaList.map((s) => String(s.kelas || "").trim()).filter(Boolean),
    );
    return Array.from(set).sort();
  }, [siswaList]);

  useEffect(() => {
    if (!isOpen) return;
    setMessage("");
    setMessageType("");
    loadDataAwal();
  }, [isOpen]);

  async function loadDataAwal() {
    if (!idGuru) return;
    try {
      setLoadingData(true);
      const [siswaRes, jurnalRes] = await Promise.all([
        getSiswaByGuru(idGuru),
        getJurnalPKL(idGuru),
      ]);

      if (siswaRes && siswaRes.success && Array.isArray(siswaRes.data)) {
        setSiswaList(siswaRes.data.map(normalisasiSiswa));
      } else {
        setSiswaList([]);
      }

      const daftarJurnal = jurnalRes?.data || [];
      if (Array.isArray(daftarJurnal)) {
        setSavedJurnalList(daftarJurnal);
      } else {
        setSavedJurnalList([]);
      }

      setRows([buatBarisBaru()]);
    } catch (err) {
      console.error("Gagal memuat data awal:", err);
      setMessage("Gagal memuat data awal bimbingan/jurnal.");
      setMessageType("error");
      setRows([buatBarisBaru()]);
    } finally {
      setLoadingData(false);
    }
  }

  function updateRow(key, patch) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  }

  function hapusBaris(key) {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((r) => r.key !== key),
    );
  }

  function handlePilihKelas(key, kelas) {
    updateRow(key, { kelas, idSiswa: "", namaSiswa: "", tempatPkl: "" });
  }

  function handlePilihSiswa(key, idSiswa) {
    const data = siswaList.find(
      (s) => String(s.idSiswa).trim() === String(idSiswa).trim(),
    );
    updateRow(key, {
      idSiswa,
      namaSiswa: data ? data.nama : "",
      kelas: data ? data.kelas : "",
      tempatPkl: data ? data.tempatPkl : "",
    });
  }

  function addWatermark(imageData, row) {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = watermarkCanvasRef.current;
        if (!canvas) return resolve(imageData);
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        const now = new Date();
        const tanggalStr = now.toLocaleDateString("id-ID", {
          timeZone: "Asia/Jakarta",
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const jamStr = now.toLocaleTimeString("id-ID", {
          timeZone: "Asia/Jakarta",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        const baseFontSize = Math.max(24, img.width / 34);
        const boxH = baseFontSize * 5.5;
        const boxX = 20;
        const boxY = img.height - boxH - 20;
        const boxW = img.width - 40;

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.fillStyle = "#FFFFFF";

        ctx.font = `bold ${baseFontSize * 1.2}px Arial`;
        ctx.fillText("JURNAL PKL", boxX + 20, boxY + baseFontSize * 1.5);

        ctx.font = `${baseFontSize * 0.9}px Arial`;
        ctx.fillText(
          `Siswa : ${row.namaSiswa || "-"} ${row.kelas ? "(" + row.kelas + ")" : ""}`,
          boxX + 20,
          boxY + baseFontSize * 3,
        );
        ctx.fillText(
          `Pembimbing : ${namaGuru || "-"}`,
          boxX + 20,
          boxY + baseFontSize * 4,
        );
        ctx.fillText(
          `Waktu: ${tanggalStr} | ${jamStr} WIB`,
          boxX + 20,
          boxY + baseFontSize * 5,
        );

        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = imageData;
    });
  }

  function handleUploadFoto(key, e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Harap pilih file gambar yang valid (JPG/PNG).");
      return;
    }
    const row = rows.find((r) => r.key === key);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      const watermarked = await addWatermark(base64Data, row || {});
      updateRow(key, { foto: watermarked });
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    setMessage("");
    setMessageType("");

    if (!idGuru) return showErr("ID guru tidak ditemukan.");

    const dataValid = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const materi =
        r.materiPilih === OPT_LAINNYA ? r.materiManual.trim() : r.materiPilih;
      const masalah =
        r.masalahPilih === OPT_LAINNYA
          ? r.masalahManual.trim()
          : r.masalahPilih;
      const tindak =
        r.tindakPilih === OPT_LAINNYA ? r.tindakManual.trim() : r.tindakPilih;

      const kosong =
        !r.mingguKe &&
        !r.tanggal &&
        !r.idSiswa &&
        !materi &&
        !masalah &&
        !tindak;
      if (kosong) continue;

      if (!r.mingguKe) return showErr(`Baris ${i + 1}: pilih Minggu ke.`);
      if (!r.tanggal) return showErr(`Baris ${i + 1}: pilih tanggal.`);
      if (!r.idSiswa) return showErr(`Baris ${i + 1}: pilih nama siswa.`);
      if (!materi) return showErr(`Baris ${i + 1}: isi materi bimbingan.`);
      if (!masalah) return showErr(`Baris ${i + 1}: isi permasalahan.`);
      if (!tindak) return showErr(`Baris ${i + 1}: isi tindak lanjut.`);

      dataValid.push({
        idGuru,
        idSiswa: r.idSiswa,
        namaSiswa: r.namaSiswa,
        kelas: r.kelas,
        tempatPkl: r.tempatPkl,
        mingguKe: r.mingguKe,
        tanggal: r.tanggal,
        waktu: formatWaktu(r.tanggal),
        materi,
        permasalahan: masalah,
        tindakLanjut: tindak,
        fotoUrl: r.foto || "",
        fotoId: "",
      });
    }

    if (dataValid.length === 0) {
      return showErr("Tidak ada baris jurnal yang diisi.");
    }

    try {
      setSaving(true);
      const result = await saveJurnalPKL({ idGuru, items: dataValid });
      if (result?.success) {
        setMessage(`✅ ${dataValid.length} jurnal PKL berhasil disimpan.`);
        setMessageType("success");
        setRows([buatBarisBaru()]);

        // Memuat ulang data tersimpan
        const jurnalRes = await getJurnalPKL(idGuru);
        if (jurnalRes?.data) setSavedJurnalList(jurnalRes.data);

        if (typeof onSaved === "function") onSaved();
      } else {
        showErr(result?.message || "Jurnal PKL gagal disimpan.");
      }
    } catch (err) {
      showErr("Terjadi kesalahan saat menyimpan jurnal PKL.");
    } finally {
      setSaving(false);
    }
  }

  function showErr(msg) {
    setMessage(msg);
    setMessageType("error");
  }

  // Filter Data Jurnal Tersimpan
  const filteredJurnal = useMemo(() => {
    return savedJurnalList.filter((item) => {
      const matchSearch =
        !searchTerm ||
        (item.namaSiswa || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (item.kelas || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.tempatPkl || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (item.materi || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchMinggu = !filterMinggu || item.mingguKe === filterMinggu;

      return matchSearch && matchMinggu;
    });
  }, [savedJurnalList, searchTerm, filterMinggu]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,23,42,0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "1400px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
        }}
      >
        {/* HEADER MODAL + TOMBOL NAVIGASI MODE */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
            color: "white",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "19px",
                fontWeight: 800,
                letterSpacing: "-0.3px",
              }}
            >
              📝 Modul Jurnal PKL — Format Pembimbingan Individual
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "12px", opacity: 0.85 }}>
              Guru Pembimbing: <strong>{namaGuru || "-"}</strong>
            </p>
          </div>

          {/* TOMBOL TOGGLE NAVIGASI */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                padding: "4px",
                borderRadius: "12px",
                display: "flex",
                gap: "4px",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: activeTab === "form" ? "#ffffff" : "transparent",
                  color: activeTab === "form" ? "#312e81" : "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow:
                    activeTab === "form"
                      ? "0 2px 8px rgba(0,0,0,0.15)"
                      : "none",
                }}
              >
                ✏️ Form Input Jurnal
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("riwayat")}
                style={{
                  padding: "8px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background:
                    activeTab === "riwayat" ? "#ffffff" : "transparent",
                  color: activeTab === "riwayat" ? "#312e81" : "#ffffff",
                  fontWeight: 700,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow:
                    activeTab === "riwayat"
                      ? "0 2px 8px rgba(0,0,0,0.15)"
                      : "none",
                }}
              >
                📊 Lihat Semua Data Jurnal ({savedJurnalList.length})
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "none",
                color: "white",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* BODY MODAL */}
        <div
          style={{
            padding: "20px 24px",
            overflow: "auto",
            flex: 1,
            background: "#f8fafc",
          }}
        >
          {loadingData && (
            <div
              style={{
                padding: "12px",
                background: "#e0f2fe",
                color: "#0369a1",
                borderRadius: "10px",
                fontSize: "13px",
                marginBottom: "16px",
              }}
            >
              ⏳ Memuat data bimbingan siswa & jurnal...
            </div>
          )}

          {/* ============================================================
              TAB 1: FORM INPUT JURNAL BARU
             ============================================================ */}
          {activeTab === "form" && (
            <div>
              <div
                style={{
                  marginBottom: "14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    color: "#475569",
                    fontWeight: 600,
                  }}
                >
                  Isi baris bimbingan jurnal di bawah ini:
                </span>
                <button
                  type="button"
                  onClick={() => setRows((prev) => [...prev, buatBarisBaru()])}
                  style={{
                    padding: "8px 16px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "9px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(37,99,235,0.2)",
                  }}
                >
                  ➕ Tambah Baris Input Baru
                </button>
              </div>

              <div className="space-y-4">
                {rows.map((r, index) => {
                  const siswaKelasIni = r.kelas
                    ? siswaList.filter(
                        (s) =>
                          String(s.kelas).trim() === String(r.kelas).trim(),
                      )
                    : siswaList;

                  return (
                    <div
                      key={r.key}
                      className="relative bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-4"
                    >
                      {/* Header Baris / Nomor & Tombol Hapus */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-7 h-7 bg-indigo-100 text-indigo-700 font-black rounded-lg text-xs">
                            #{index + 1}
                          </span>
                          <h4 className="font-extrabold text-sm text-slate-800">
                            Baris Bimbingan Jurnal
                          </h4>
                        </div>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => hapusBaris(r.key)}
                            className="text-xs font-bold text-red-600 hover:bg-red-50 px-2.5 py-1 rounded-lg transition-colors border border-red-200"
                          >
                            ✕ Hapus Baris
                          </button>
                        )}
                      </div>

                      {/* Grid Input Utama: 1 Kolom (HP) & Multi Kolom (Tablet/Desktop) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* MINGGU KE */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Minggu Ke
                          </label>
                          <select
                            value={r.mingguKe}
                            onChange={(e) =>
                              updateRow(r.key, { mingguKe: e.target.value })
                            }
                            style={selectStyle}
                          >
                            <option value="">Pilih minggu</option>
                            {opsiMingguKe.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* TANGGAL */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Tanggal Bimbingan
                          </label>
                          <input
                            type="date"
                            value={r.tanggal}
                            onChange={(e) =>
                              updateRow(r.key, { tanggal: e.target.value })
                            }
                            style={selectStyle}
                          />
                        </div>

                        {/* FILTER KELAS */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Kelas
                          </label>
                          <select
                            value={r.kelas}
                            onChange={(e) =>
                              handlePilihKelas(r.key, e.target.value)
                            }
                            style={selectStyle}
                          >
                            <option value="">Semua kelas</option>
                            {daftarKelas.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* NAMA SISWA */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Nama Siswa
                          </label>
                          <select
                            value={r.idSiswa}
                            onChange={(e) =>
                              handlePilihSiswa(r.key, e.target.value)
                            }
                            style={selectStyle}
                          >
                            <option value="">Pilih siswa</option>
                            {siswaKelasIni.map((s) => (
                              <option key={s.idSiswa} value={s.idSiswa}>
                                {s.nama}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Grid Isian Teks Panjang (Materi, Masalah, Tindak Lanjut) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        {/* MATERI */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Materi Bimbingan
                          </label>
                          <ComboDropdown
                            options={OPSI_MATERI}
                            value={r.materiPilih}
                            manualValue={r.materiManual}
                            onChangeSelect={(v) =>
                              updateRow(r.key, { materiPilih: v })
                            }
                            onChangeManual={(v) =>
                              updateRow(r.key, { materiManual: v })
                            }
                          />
                        </div>

                        {/* PERMASALAHAN */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Permasalahan
                          </label>
                          <ComboDropdown
                            options={OPSI_PERMASALAHAN}
                            value={r.masalahPilih}
                            manualValue={r.masalahManual}
                            onChangeSelect={(v) =>
                              updateRow(r.key, { masalahPilih: v })
                            }
                            onChangeManual={(v) =>
                              updateRow(r.key, { masalahManual: v })
                            }
                          />
                        </div>

                        {/* TINDAK LANJUT */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-500 mb-1">
                            Tindak Lanjut
                          </label>
                          <ComboDropdown
                            options={OPSI_TINDAK_LANJUT}
                            value={r.tindakPilih}
                            manualValue={r.tindakManual}
                            onChangeSelect={(v) =>
                              updateRow(r.key, { tindakPilih: v })
                            }
                            onChangeManual={(v) =>
                              updateRow(r.key, { tindakManual: v })
                            }
                          />
                        </div>
                      </div>

                      {/* Area Upload Foto */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">
                          Bukti Foto (Opsional)
                        </span>
                        {!r.foto ? (
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg cursor-pointer text-xs font-bold hover:bg-emerald-700 transition-colors">
                            📷 Unggah Foto
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleUploadFoto(r.key, e)}
                            />
                          </label>
                        ) : (
                          <div className="flex items-center gap-3">
                            <img
                              src={r.foto}
                              alt="bukti"
                              className="w-14 h-10 object-cover rounded-md border border-slate-200"
                            />
                            <button
                              type="button"
                              onClick={() => updateRow(r.key, { foto: "" })}
                              className="text-xs font-bold text-red-600 hover:underline"
                            >
                              ✕ Hapus Foto
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <canvas ref={watermarkCanvasRef} style={{ display: "none" }} />
            </div>
          )}

          {/* ============================================================
              TAB 2: LIHAT SEMUA DATA JURNAL (TAMPILAN MENARIK)
             ============================================================ */}
          {activeTab === "riwayat" && (
            <div>
              {/* FILTER & KARTU STATISTIK */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                  marginBottom: "18px",
                  background: "white",
                  padding: "16px 20px",
                  borderRadius: "14px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                }}
              >
                {/* Search Bar & Filter Minggu */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    flex: 1,
                  }}
                >
                  <input
                    type="text"
                    placeholder="🔍 Cari nama siswa, kelas, tempat PKL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      minWidth: "260px",
                      flex: 1,
                      outline: "none",
                    }}
                  />

                  <select
                    value={filterMinggu}
                    onChange={(e) => setFilterMinggu(e.target.value)}
                    style={{
                      padding: "9px 14px",
                      borderRadius: "10px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      background: "white",
                      outline: "none",
                    }}
                  >
                    <option value="">📅 Semua Minggu Ke</option>
                    {opsiMingguKe.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Badge Statistik */}
                <div style={{ display: "flex", gap: "10px" }}>
                  <div
                    style={{
                      background: "#e0e7ff",
                      color: "#3730a3",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    📋 Total: {filteredJurnal.length} Jurnal
                  </div>
                  <div
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    🎓 Siswa:{" "}
                    {new Set(filteredJurnal.map((i) => i.idSiswa)).size} Orang
                  </div>
                </div>
              </div>

              {/* TABEL DATA HASIL SIMPAN */}
              {filteredJurnal.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "48px 20px",
                    background: "white",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    color: "#64748b",
                  }}
                >
                  <div style={{ fontSize: "40px", marginBottom: "8px" }}>
                    📁
                  </div>
                  <h4
                    style={{
                      margin: "0 0 4px",
                      fontSize: "16px",
                      color: "#334155",
                    }}
                  >
                    Belum Ada Data Jurnal
                  </h4>
                  <p style={{ margin: 0, fontSize: "13px" }}>
                    {searchTerm || filterMinggu
                      ? "Tidak ada data yang sesuai dengan pencarian atau filter Anda."
                      : "Belum ada jurnal PKL yang disimpan oleh Anda."}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: "white",
                    borderRadius: "16px",
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                        textAlign: "left",
                      }}
                    >
                      <thead>
                        <tr style={{ background: "#1e293b", color: "#f8fafc" }}>
                          <th style={thRiwayatStyle}>No</th>
                          <th style={thRiwayatStyle}>Minggu Ke</th>
                          <th style={thRiwayatStyle}>Tanggal / Waktu</th>
                          <th style={thRiwayatStyle}>Siswa & Kelas</th>
                          <th style={thRiwayatStyle}>Tempat PKL</th>
                          <th style={thRiwayatStyle}>Materi Bimbingan</th>
                          <th style={thRiwayatStyle}>Permasalahan</th>
                          <th style={thRiwayatStyle}>Tindak Lanjut</th>
                          <th style={thRiwayatStyle}>Bukti Foto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredJurnal.map((item, idx) => (
                          <tr
                            key={item.idJurnal || idx}
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                            }}
                          >
                            <td style={tdRiwayatStyle}>{idx + 1}</td>

                            {/* Badge Minggu Ke */}
                            <td style={tdRiwayatStyle}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "4px 10px",
                                  borderRadius: "12px",
                                  background: "#e0e7ff",
                                  color: "#3730a3",
                                  fontWeight: 700,
                                  fontSize: "11px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {item.mingguKe || "-"}
                              </span>
                            </td>

                            {/* Tanggal Waktu */}
                            <td
                              style={{ ...tdRiwayatStyle, minWidth: "140px" }}
                            >
                              <div
                                style={{ fontWeight: 600, color: "#1e293b" }}
                              >
                                {item.tanggal ? formatWaktu(item.tanggal) : "-"}
                              </div>
                            </td>

                            {/* Nama Siswa & Kelas */}
                            <td
                              style={{ ...tdRiwayatStyle, minWidth: "160px" }}
                            >
                              <div
                                style={{ fontWeight: 700, color: "#0f172a" }}
                              >
                                {item.namaSiswa || "-"}
                              </div>
                              <span
                                style={{
                                  display: "inline-block",
                                  marginTop: "3px",
                                  padding: "2px 8px",
                                  borderRadius: "6px",
                                  background: "#dcfce7",
                                  color: "#166534",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                }}
                              >
                                {item.kelas || "-"}
                              </span>
                            </td>

                            {/* Tempat PKL */}
                            <td
                              style={{ ...tdRiwayatStyle, minWidth: "140px" }}
                            >
                              <span
                                style={{ color: "#334155", fontWeight: 500 }}
                              >
                                🏢 {item.tempatPkl || "-"}
                              </span>
                            </td>

                            {/* Materi */}
                            <td
                              style={{
                                ...tdRiwayatStyle,
                                minWidth: "200px",
                                color: "#334155",
                              }}
                            >
                              {item.materi || "-"}
                            </td>

                            {/* Permasalahan */}
                            <td
                              style={{
                                ...tdRiwayatStyle,
                                minWidth: "200px",
                                color: "#991b1b",
                              }}
                            >
                              {item.permasalahan || "-"}
                            </td>

                            {/* Tindak Lanjut */}
                            <td
                              style={{
                                ...tdRiwayatStyle,
                                minWidth: "200px",
                                color: "#166534",
                              }}
                            >
                              {item.tindakLanjut || "-"}
                            </td>

                            {/* Pratinjau Bukti Foto */}
                            <td
                              style={{ ...tdRiwayatStyle, textAlign: "center" }}
                            >
                              {item.fotoUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreviewFotoUrl(item.fotoUrl)
                                  }
                                  style={{
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  <img
                                    src={item.fotoUrl}
                                    alt="bukti"
                                    style={{
                                      width: "48px",
                                      height: "36px",
                                      objectFit: "cover",
                                      borderRadius: "6px",
                                      border: "1px solid #cbd5e1",
                                    }}
                                  />
                                </button>
                              ) : (
                                <span
                                  style={{ fontSize: "11px", color: "#94a3b8" }}
                                >
                                  -
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PESAN NOTIFIKASI */}
          {message && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px 16px",
                borderRadius: "12px",
                background: messageType === "success" ? "#dcfce7" : "#fee2e2",
                color: messageType === "success" ? "#166534" : "#991b1b",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}
        </div>

        {/* FOOTER MODAL */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#ffffff",
          }}
        >
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            {activeTab === "form"
              ? `Menampilkan ${rows.length} baris input`
              : `Total ${savedJurnalList.length} jurnal tersimpan`}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                border: "1px solid #cbd5e1",
                background: "white",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tutup
            </button>

            {activeTab === "form" && (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                style={{
                  padding: "10px 24px",
                  borderRadius: "10px",
                  border: "none",
                  background: saving
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "white",
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
                }}
              >
                {saving ? "Menyimpan..." : "💾 Simpan Semua Jurnal"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* LIGHTBOX UNTUK PREVIEW FOTO */}
      {previewFotoUrl && (
        <div
          onClick={() => setPreviewFotoUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            style={{
              position: "relative",
              maxWidth: "90vw",
              maxHeight: "90vh",
            }}
          >
            <img
              src={previewFotoUrl}
              alt="Preview Bukti Foto"
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                borderRadius: "12px",
                boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              }}
            />
            <button
              onClick={() => setPreviewFotoUrl(null)}
              style={{
                position: "absolute",
                top: "-15px",
                right: "-15px",
                background: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: "36px",
                height: "36px",
                fontSize: "16px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ComboDropdown({
  options,
  value,
  manualValue,
  onChangeSelect,
  onChangeManual,
}) {
  return (
    <div>
      <select
        value={value}
        onChange={(e) => onChangeSelect(e.target.value)}
        style={selectStyle}
      >
        <option value="">Pilih...</option>
        {options.map((opt, i) => (
          <option key={i} value={opt}>
            {opt.length > 55 ? opt.slice(0, 55) + "..." : opt}
          </option>
        ))}
        <option value={OPT_LAINNYA}>✏️ Lainnya (isi manual)</option>
      </select>
      {value === OPT_LAINNYA && (
        <textarea
          value={manualValue}
          onChange={(e) => onChangeManual(e.target.value)}
          placeholder="Tulis manual..."
          rows={2}
          style={{ ...selectStyle, marginTop: "4px", resize: "vertical" }}
        />
      )}
    </div>
  );
}

const tdStyle = {
  borderBottom: "1px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  padding: "8px",
  verticalAlign: "top",
};

const thRiwayatStyle = {
  padding: "12px 14px",
  fontWeight: 700,
  fontSize: "12px",
  whiteSpace: "nowrap",
};

const tdRiwayatStyle = {
  padding: "12px 14px",
  verticalAlign: "middle",
};

const selectStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "7px 9px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "12px",
  outline: "none",
  fontFamily: "inherit",
  background: "white",
};

function btnBulat(color) {
  return {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "none",
    background: color,
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: "14px",
    lineHeight: "28px",
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}
