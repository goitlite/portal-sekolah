"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSiswaByGuru, getJurnalPKL, saveJurnalPKL, deleteJurnalPKL } from "../lib/api";
import { generateLaporanJurnalPKL } from "./generateLaporanJurnalPKL";

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

const JADWAL_BULAN_PKL = [
  { bulan: "Juli", maxMinggu: 4 },
  { bulan: "Agustus", maxMinggu: 4 },
  { bulan: "September", maxMinggu: 4 },
  { bulan: "Oktober", maxMinggu: 4 },
  { bulan: "November", maxMinggu: 4 },
  { bulan: "Desember", maxMinggu: 2 },
];

function buildOpsiMingguKe() {
  const now = new Date();
  // Semester ganjil PKL (Juli - Desember):
  // Jika saat ini bulan Juli (index 6) s/d Desember (index 11), gunakan tahun sekarang.
  // Jika saat ini Januari s/d Juni, gunakan tahun sebelumnya.
  const tahun =
    now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  const opsi = [];
  for (const item of JADWAL_BULAN_PKL) {
    for (let m = 1; m <= item.maxMinggu; m++) {
      opsi.push(`Minggu ke-${m} ${item.bulan} ${tahun}`);
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
    idSiswaList: [], // Array of {idSiswa, nama, kelas, tempatPkl}
    kelas: "",
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

  // State multi-select checklist siswa
  const [openDropdownKey, setOpenDropdownKey] = useState(null);
  const [siswaSearchMap, setSiswaSearchMap] = useState({});

  // State hapus baris riwayat jurnal
  const [deletingJurnalId, setDeletingJurnalId] = useState(null);
  const [printingPdf, setPrintingPdf] = useState(false);


  const watermarkCanvasRef = useRef(null);

  const opsiMingguKe = useMemo(() => {
    const list = buildOpsiMingguKe();
    if (Array.isArray(savedJurnalList)) {
      savedJurnalList.forEach((j) => {
        if (j.mingguKe && !list.includes(j.mingguKe)) {
          list.push(j.mingguKe);
        }
      });
    }
    return list;
  }, [savedJurnalList]);

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
    updateRow(key, { kelas, idSiswaList: [] });
    setSiswaSearchMap((prev) => ({ ...prev, [key]: "" }));
  }

  function handleToggleSiswa(key, siswa) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const exists = r.idSiswaList.some(
          (s) => String(s.idSiswa) === String(siswa.idSiswa),
        );
        const newList = exists
          ? r.idSiswaList.filter(
              (s) => String(s.idSiswa) !== String(siswa.idSiswa),
            )
          : [...r.idSiswaList, siswa];
        return { ...r, idSiswaList: newList };
      }),
    );
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
    // Buat row dengan namaSiswa gabungan untuk watermark
    const rowForWatermark = {
      ...(row || {}),
      namaSiswa: (row?.idSiswaList || []).map((s) => s.nama).join(", "),
      kelas: [
        ...new Set(
          (row?.idSiswaList || []).map((s) => s.kelas).filter(Boolean),
        ),
      ].join(", "),
    };
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      const watermarked = await addWatermark(base64Data, rowForWatermark);
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
        (!r.idSiswaList || r.idSiswaList.length === 0) &&
        !materi &&
        !masalah &&
        !tindak;
      if (kosong) continue;

      if (!r.mingguKe) return showErr(`Baris ${i + 1}: pilih Minggu ke.`);
      if (!r.tanggal) return showErr(`Baris ${i + 1}: pilih tanggal.`);
      if (!r.idSiswaList || r.idSiswaList.length === 0)
        return showErr(`Baris ${i + 1}: pilih minimal 1 siswa.`);
      if (!materi) return showErr(`Baris ${i + 1}: isi materi bimbingan.`);
      if (!masalah) return showErr(`Baris ${i + 1}: isi permasalahan.`);
      if (!tindak) return showErr(`Baris ${i + 1}: isi tindak lanjut.`);

      // Gabungkan semua siswa yang dipilih menjadi satu baris jurnal
      const namaSiswaGabung = r.idSiswaList.map((s) => s.nama).join(" / ");
      const kelasList = [
        ...new Set(r.idSiswaList.map((s) => s.kelas).filter(Boolean)),
      ];
      const kelasGabung = kelasList.join(", ");

      // Gabungkan semua tempat PKL dari siswa yang dipilih (jika ada tempat berbeda)
      const tempatPklList = [
        ...new Set(
          r.idSiswaList
            .map((s) => String(s.tempatPkl || "").trim())
            .filter((t) => t && t !== "-"),
        ),
      ];
      const tempatPklGabung =
        tempatPklList.length > 0 ? tempatPklList.join(" / ") : "-";

      const idSiswaPertama = r.idSiswaList[0]?.idSiswa || "";

      dataValid.push({
        idGuru,
        idSiswa: idSiswaPertama,
        namaSiswa: namaSiswaGabung,
        kelas: kelasGabung,
        tempatPkl: tempatPklGabung,
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

  async function handleHapusJurnalPkl(idJurnal) {
    if (!idJurnal) return;
    const konfirmasi = window.confirm(
      "Hapus baris jurnal PKL ini?\n\nTindakan ini tidak dapat dibatalkan.",
    );
    if (!konfirmasi) return;

    setDeletingJurnalId(idJurnal);
    try {
      let res;
      if (typeof deleteJurnalPKL === "function") {
        res = await deleteJurnalPKL({ idGuru, idJurnal });
      } else {
        // Fallback jika cache Turbopack HMR di browser belum me-refresh export api.js
        const API_ENDPOINT =
          "https://script.google.com/macros/s/AKfycbwL6gJ9rVKps7EmqKO0o928iwbFlqk-xQDY4za0PcIPh0f-kkRTyu5XCavvZ-9bsZA/exec";
        const response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify({
            action: "deleteJurnalPKL",
            params: { idGuru, idJurnal },
          }),
        });
        res = await response.json();
      }

      if (res?.success) {
        setSavedJurnalList((prev) =>
          prev.filter((j) => j.idJurnal !== idJurnal),
        );
      } else {
        alert(res?.message || "Gagal menghapus jurnal PKL.");
      }
    } catch (err) {
      console.error("Gagal menghapus jurnal PKL:", err);
      alert("Terjadi kesalahan saat menghapus jurnal PKL.");
    } finally {
      setDeletingJurnalId(null);
    }
  }

  async function handleCetakJurnalPDF() {
    if (!filteredJurnal || filteredJurnal.length === 0) {
      alert("Tidak ada data jurnal untuk dicetak.");
      return;
    }
    try {
      setPrintingPdf(true);
      await generateLaporanJurnalPKL({
        data: filteredJurnal,
        namaGuru: namaGuru || "Guru Pembimbing",
      });
    } catch (err) {
      console.error("Gagal mencetak jurnal PKL:", err);
      alert("Gagal mencetak PDF: " + (err?.message || "Terjadi kesalahan"));
    } finally {
      setPrintingPdf(false);
    }
  }

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
        background: "rgba(15,23,42,0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "8px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          color: "#0f172a",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "1400px",
          maxHeight: "96vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)",
        }}
      >
        {/* HEADER MODAL + TOMBOL NAVIGASI MODE */}
        <div
          style={{
            background:
              "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)",
            color: "#ffffff",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: "15px",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.2px",
              }}
            >
              📝 Modul Jurnal PKL — Format Pembimbingan
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#e0e7ff" }}>
              Guru Pembimbing: <strong style={{ color: "#ffffff" }}>{namaGuru || "-"}</strong>
            </p>
          </div>

          {/* TOMBOL TOGGLE NAVIGASI */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                background: "rgba(255,255,255,0.12)",
                padding: "3px",
                borderRadius: "10px",
                display: "flex",
                gap: "3px",
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab("form")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: activeTab === "form" ? "#ffffff" : "transparent",
                  color: activeTab === "form" ? "#312e81" : "#ffffff",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow:
                    activeTab === "form"
                      ? "0 2px 6px rgba(0,0,0,0.15)"
                      : "none",
                }}
              >
                ✏️ Form Input Jurnal
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("riwayat")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    activeTab === "riwayat" ? "#ffffff" : "transparent",
                  color: activeTab === "riwayat" ? "#312e81" : "#ffffff",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow:
                    activeTab === "riwayat"
                      ? "0 2px 6px rgba(0,0,0,0.15)"
                      : "none",
                }}
              >
                📊 Semua Jurnal ({savedJurnalList.length})
              </button>
            </div>

            <button
              onClick={onClose}
              style={{
                background: "rgba(255,255,255,0.18)",
                border: "none",
                color: "#ffffff",
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                cursor: "pointer",
                fontSize: "15px",
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
            padding: "12px 14px",
            overflow: "auto",
            flex: 1,
            background: "#f8fafc",
            color: "#0f172a",
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

              <div className="space-y-3">
                {rows.map((r, index) => {
                  const siswaKelasIni = r.kelas
                    ? siswaList.filter(
                        (s) =>
                          String(s.kelas).trim() === String(r.kelas).trim(),
                      )
                    : siswaList;

                  const uniqueTempatPkl = [
                    ...new Set(
                      r.idSiswaList
                        .map((s) => String(s.tempatPkl || "").trim())
                        .filter((t) => t && t !== "-"),
                    ),
                  ];

                  return (
                    <div
                      key={r.key}
                      className="relative rounded-xl border border-slate-200 p-3 sm:p-4 shadow-sm hover:shadow-md transition-all space-y-3"
                      style={{ background: "#ffffff", color: "#0f172a" }}
                    >
                      {/* Header Baris / Nomor & Tombol Hapus */}
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 bg-indigo-100 text-indigo-700 font-black rounded-lg text-xs">
                            #{index + 1}
                          </span>
                          <h4
                            className="font-extrabold text-sm"
                            style={{ color: "#0f172a" }}
                          >
                            Baris Bimbingan Jurnal
                          </h4>
                        </div>
                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => hapusBaris(r.key)}
                            className="text-xs font-bold text-red-600 hover:bg-red-50 px-2 py-0.5 rounded-lg transition-colors border border-red-200"
                          >
                            ✕ Hapus Baris
                          </button>
                        )}
                      </div>

                      {/* Grid Input Utama: 1 Kolom (HP) & Multi Kolom (Tablet/Desktop) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {/* MINGGU KE */}
                        <div>
                          <label
                            className="block text-[11px] font-bold mb-1"
                            style={{ color: "#334155" }}
                          >
                            Minggu Ke
                          </label>
                          <select
                            value={r.mingguKe}
                            onChange={(e) =>
                              updateRow(r.key, { mingguKe: e.target.value })
                            }
                            style={{ ...selectStyle, background: "#ffffff", color: "#0f172a" }}
                          >
                            <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>
                              Pilih minggu
                            </option>
                            {opsiMingguKe.map((opt) => (
                              <option
                                key={opt}
                                value={opt}
                                style={{ background: "#ffffff", color: "#0f172a" }}
                              >
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* TANGGAL */}
                        <div>
                          <label
                            className="block text-[11px] font-bold mb-1"
                            style={{ color: "#334155" }}
                          >
                            Tanggal Bimbingan
                          </label>
                          <input
                            type="date"
                            value={r.tanggal}
                            onChange={(e) =>
                              updateRow(r.key, { tanggal: e.target.value })
                            }
                            style={{ ...selectStyle, background: "#ffffff", color: "#0f172a" }}
                          />
                        </div>

                        {/* FILTER KELAS */}
                        <div>
                          <label
                            className="block text-[11px] font-bold mb-1"
                            style={{ color: "#334155" }}
                          >
                            Kelas
                          </label>
                          <select
                            value={r.kelas}
                            onChange={(e) =>
                              handlePilihKelas(r.key, e.target.value)
                            }
                            style={{ ...selectStyle, background: "#ffffff", color: "#0f172a" }}
                          >
                            <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>
                              Semua kelas
                            </option>
                            {daftarKelas.map((k) => (
                              <option
                                key={k}
                                value={k}
                                style={{ background: "#ffffff", color: "#0f172a" }}
                              >
                                {k}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* NAMA SISWA — Multi-select checklist */}
                        <div style={{ position: "relative" }}>
                          <label
                            className="block text-[11px] font-bold mb-1"
                            style={{ color: "#334155" }}
                          >
                            Nama Siswa{" "}
                            {r.idSiswaList.length > 0 && (
                              <span
                                style={{
                                  background: "#4f46e5",
                                  color: "#ffffff",
                                  borderRadius: "999px",
                                  padding: "0 6px",
                                  fontSize: "10px",
                                  fontWeight: 800,
                                  marginLeft: "4px",
                                }}
                              >
                                {r.idSiswaList.length}
                              </span>
                            )}
                          </label>

                          {/* Tombol trigger dropdown */}
                          <button
                            type="button"
                            onClick={() =>
                              setOpenDropdownKey(
                                openDropdownKey === r.key ? null : r.key,
                              )
                            }
                            style={{
                              ...selectStyle,
                              textAlign: "left",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "4px",
                              cursor: "pointer",
                              background:
                                r.idSiswaList.length > 0 ? "#eef2ff" : "#ffffff",
                              borderColor:
                                r.idSiswaList.length > 0 ? "#818cf8" : "#cbd5e1",
                            }}
                          >
                            <span
                              style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                flex: 1,
                                color:
                                  r.idSiswaList.length === 0
                                    ? "#94a3b8"
                                    : "#1e1b4b",
                                fontWeight: r.idSiswaList.length > 0 ? 600 : 400,
                              }}
                            >
                              {r.idSiswaList.length === 0
                                ? "Pilih siswa..."
                                : r.idSiswaList.length === 1
                                  ? r.idSiswaList[0].nama
                                  : `${r.idSiswaList.length} siswa dipilih`}
                            </span>
                            <span style={{ fontSize: "9px", opacity: 0.6, color: "#475569" }}>
                              ▼
                            </span>
                          </button>

                          {/* Dropdown checklist */}
                          {openDropdownKey === r.key && (
                            <>
                              {/* Overlay untuk menutup dropdown */}
                              <div
                                style={{
                                  position: "fixed",
                                  inset: 0,
                                  zIndex: 40,
                                }}
                                onClick={() => setOpenDropdownKey(null)}
                              />
                              <div
                                style={{
                                  position: "absolute",
                                  zIndex: 50,
                                  top: "100%",
                                  left: 0,
                                  right: 0,
                                  background: "#ffffff",
                                  color: "#0f172a",
                                  border: "1px solid #818cf8",
                                  borderRadius: "10px",
                                  boxShadow:
                                    "0 8px 24px rgba(79,70,229,0.2)",
                                  marginTop: "4px",
                                  overflow: "hidden",
                                  minWidth: "260px",
                                }}
                              >
                                {/* Search bar */}
                                <div
                                  style={{
                                    padding: "6px",
                                    borderBottom: "1px solid #e2e8f0",
                                    background: "#f8fafc",
                                  }}
                                >
                                  <input
                                    type="text"
                                    placeholder="🔍 Cari nama siswa..."
                                    value={siswaSearchMap[r.key] || ""}
                                    onChange={(e) =>
                                      setSiswaSearchMap((prev) => ({
                                        ...prev,
                                        [r.key]: e.target.value,
                                      }))
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      ...selectStyle,
                                      padding: "5px 8px",
                                      fontSize: "11px",
                                      background: "#ffffff",
                                      color: "#0f172a",
                                    }}
                                  />
                                </div>

                                {/* Opsi Pilih Semua */}
                                {siswaKelasIni.length > 0 && (
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "8px",
                                      padding: "5px 10px",
                                      cursor: "pointer",
                                      borderBottom: "1px solid #e2e8f0",
                                      background: "#f1f5f9",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      color: "#334155",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const filteredSiswa = siswaKelasIni.filter(
                                        (s) =>
                                          !(siswaSearchMap[r.key] || "") ||
                                          s.nama
                                            .toLowerCase()
                                            .includes(
                                              (
                                                siswaSearchMap[r.key] || ""
                                              ).toLowerCase(),
                                            ),
                                      );
                                      const allChecked = filteredSiswa.every(
                                        (s) =>
                                          r.idSiswaList.some(
                                            (sel) =>
                                              String(sel.idSiswa) ===
                                              String(s.idSiswa),
                                          ),
                                      );
                                      if (allChecked) {
                                        const idsFiltered = new Set(
                                          filteredSiswa.map((s) =>
                                            String(s.idSiswa),
                                          ),
                                        );
                                        updateRow(r.key, {
                                          idSiswaList: r.idSiswaList.filter(
                                            (s) =>
                                              !idsFiltered.has(
                                                String(s.idSiswa),
                                              ),
                                          ),
                                        });
                                      } else {
                                        const existing = new Set(
                                          r.idSiswaList.map((s) =>
                                            String(s.idSiswa),
                                          ),
                                        );
                                        const toAdd = filteredSiswa.filter(
                                          (s) =>
                                            !existing.has(String(s.idSiswa)),
                                        );
                                        updateRow(r.key, {
                                          idSiswaList: [
                                            ...r.idSiswaList,
                                            ...toAdd,
                                          ],
                                        });
                                      }
                                    }}
                                  >
                                    ☑ Pilih Semua
                                  </label>
                                )}

                                {/* List siswa */}
                                <div
                                  style={{ maxHeight: "180px", overflowY: "auto" }}
                                >
                                  {siswaKelasIni
                                    .filter(
                                      (s) =>
                                        !(siswaSearchMap[r.key] || "") ||
                                        s.nama
                                          .toLowerCase()
                                          .includes(
                                            (
                                              siswaSearchMap[r.key] || ""
                                            ).toLowerCase(),
                                          ),
                                    )
                                    .map((s) => {
                                      const isChecked = r.idSiswaList.some(
                                        (sel) =>
                                          String(sel.idSiswa) ===
                                          String(s.idSiswa),
                                      );
                                      return (
                                        <label
                                          key={s.idSiswa}
                                          onClick={(e) => e.stopPropagation()}
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            padding: "5px 10px",
                                            cursor: "pointer",
                                            background: isChecked
                                              ? "#eef2ff"
                                              : "#ffffff",
                                            fontSize: "11px",
                                            fontWeight: isChecked ? 700 : 500,
                                            color: isChecked
                                              ? "#3730a3"
                                              : "#0f172a",
                                            borderBottom: "1px solid #f1f5f9",
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() =>
                                              handleToggleSiswa(r.key, s)
                                            }
                                            style={{
                                              accentColor: "#4f46e5",
                                              cursor: "pointer",
                                            }}
                                          />
                                          <span style={{ flex: 1, color: isChecked ? "#3730a3" : "#0f172a" }}>
                                            {s.nama}
                                          </span>
                                          {s.kelas && (
                                            <span
                                              style={{
                                                fontSize: "10px",
                                                color: "#475569",
                                                background: "#f1f5f9",
                                                padding: "1px 5px",
                                                borderRadius: "4px",
                                              }}
                                            >
                                              {s.kelas}
                                            </span>
                                          )}
                                          {s.tempatPkl && (
                                            <span
                                              style={{
                                                fontSize: "9px",
                                                color: "#15803d",
                                                background: "#dcfce7",
                                                padding: "1px 5px",
                                                borderRadius: "4px",
                                                maxWidth: "110px",
                                                overflow: "hidden",
                                                textOverflow: "ellipsis",
                                                whiteSpace: "nowrap",
                                                border: "1px solid #bbf7d0",
                                              }}
                                              title={s.tempatPkl}
                                            >
                                              🏢 {s.tempatPkl}
                                            </span>
                                          )}
                                        </label>
                                      );
                                    })}
                                  {siswaKelasIni.filter(
                                    (s) =>
                                      !(siswaSearchMap[r.key] || "") ||
                                      s.nama
                                        .toLowerCase()
                                        .includes(
                                          (
                                            siswaSearchMap[r.key] || ""
                                          ).toLowerCase(),
                                        ),
                                  ).length === 0 && (
                                    <div
                                      style={{
                                        padding: "12px",
                                        textAlign: "center",
                                        color: "#94a3b8",
                                        fontSize: "11px",
                                      }}
                                    >
                                      Tidak ada siswa ditemukan
                                    </div>
                                  )}
                                </div>

                                {/* Footer tombol selesai */}
                                <div
                                  style={{
                                    padding: "5px 10px",
                                    borderTop: "1px solid #e2e8f0",
                                    background: "#f8fafc",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      color: "#64748b",
                                    }}
                                  >
                                    {r.idSiswaList.length} dipilih
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setOpenDropdownKey(null)}
                                    style={{
                                      padding: "3px 9px",
                                      background: "#4f46e5",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: "6px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✓ Selesai
                                  </button>
                                </div>
                              </div>
                            </>
                          )}

                          {/* Chip siswa terpilih */}
                          {r.idSiswaList.length > 0 && (
                            <div
                              style={{
                                marginTop: "4px",
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "3px",
                              }}
                            >
                              {r.idSiswaList.map((s) => (
                                <span
                                  key={s.idSiswa}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "3px",
                                    background: "#e0e7ff",
                                    color: "#3730a3",
                                    borderRadius: "999px",
                                    padding: "2px 7px 2px 6px",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {s.nama}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggleSiswa(r.key, s)
                                    }
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      color: "#6366f1",
                                      fontWeight: 800,
                                      padding: 0,
                                      fontSize: "11px",
                                      lineHeight: 1,
                                    }}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Preview Tempat PKL yang otomatis mengikuti siswa */}
                          {r.idSiswaList.length > 0 && (
                            <div
                              style={{
                                marginTop: "5px",
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: "4px",
                                padding: "4px 8px",
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  color: "#166534",
                                }}
                              >
                                🏢 Tempat PKL:
                              </span>
                              {uniqueTempatPkl.length > 0 ? (
                                uniqueTempatPkl.map((tp, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      background: "#dcfce7",
                                      color: "#15803d",
                                      fontSize: "10px",
                                      fontWeight: 700,
                                      border: "1px solid #86efac",
                                    }}
                                  >
                                    {tp}
                                  </span>
                                ))
                              ) : (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    color: "#94a3b8",
                                    fontStyle: "italic",
                                  }}
                                >
                                  (Belum ada data tempat PKL di master siswa)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Grid Isian Teks Panjang (Materi, Masalah, Tindak Lanjut) */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
                        {/* MATERI */}
                        <div>
                          <label
                            className="block text-[11px] font-bold mb-1"
                            style={{ color: "#334155" }}
                          >
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
                          <label
                            className="block text-[11px] font-bold mb-1"
                            style={{ color: "#334155" }}
                          >
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
                          <label
                            className="block text-[11px] font-bold mb-1"
                            style={{ color: "#334155" }}
                          >
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
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "#475569" }}
                        >
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
              {/* FILTER & KARTU STATISTIK + TOMBOL CETAK */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "10px",
                  marginBottom: "14px",
                  background: "#ffffff",
                  color: "#0f172a",
                  padding: "12px 16px",
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
                    gap: "8px",
                    flex: 1,
                  }}
                >
                  <input
                    type="text"
                    placeholder="🔍 Cari nama siswa, kelas, tempat PKL..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "9px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                      background: "#ffffff",
                      color: "#0f172a",
                      minWidth: "200px",
                      flex: 1,
                      outline: "none",
                    }}
                  />

                  <select
                    value={filterMinggu}
                    onChange={(e) => setFilterMinggu(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "9px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                      background: "#ffffff",
                      color: "#0f172a",
                      outline: "none",
                    }}
                  >
                    <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>
                      📅 Semua Minggu Ke
                    </option>
                    {opsiMingguKe.map((m) => (
                      <option
                        key={m}
                        value={m}
                        style={{ background: "#ffffff", color: "#0f172a" }}
                      >
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Badge Statistik & Tombol Cetak PDF */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      background: "#e0e7ff",
                      color: "#3730a3",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    📋 Total: {filteredJurnal.length}
                  </div>
                  <div
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    🎓 Siswa: {new Set(filteredJurnal.map((i) => i.idSiswa)).size}
                  </div>

                  <button
                    type="button"
                    onClick={handleCetakJurnalPDF}
                    disabled={printingPdf || filteredJurnal.length === 0}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background:
                        printingPdf || filteredJurnal.length === 0
                          ? "#94a3b8"
                          : "linear-gradient(135deg, #059669, #047857)",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor:
                        printingPdf || filteredJurnal.length === 0
                          ? "not-allowed"
                          : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      boxShadow: "0 2px 6px rgba(5,150,105,0.25)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {printingPdf ? "⏳ Menyiapkan PDF..." : "🖨️ Cetak PDF Laporan"}
                  </button>
                </div>
              </div>

              {/* TABEL DATA HASIL SIMPAN */}
              {filteredJurnal.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 16px",
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    color: "#64748b",
                  }}
                >
                  <div style={{ fontSize: "36px", marginBottom: "6px" }}>
                    📁
                  </div>
                  <h4
                    style={{
                      margin: "0 0 4px",
                      fontSize: "15px",
                      color: "#334155",
                      fontWeight: 700,
                    }}
                  >
                    Belum Ada Data Jurnal
                  </h4>
                  <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                    {searchTerm || filterMinggu
                      ? "Tidak ada data yang sesuai dengan pencarian atau filter Anda."
                      : "Belum ada jurnal PKL yang disimpan oleh Anda."}
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0",
                    overflow: "hidden",
                    boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
                  }}
                >
                  <div style={{ overflowX: "auto", width: "100%" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "12px",
                        textAlign: "left",
                        color: "#0f172a",
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
                          <th
                            style={{
                              ...thRiwayatStyle,
                              textAlign: "center",
                              background: "#7f1d1d",
                            }}
                          >
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredJurnal.map((item, idx) => (
                          <tr
                            key={item.idJurnal || idx}
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                              color: "#0f172a",
                            }}
                          >
                            <td style={tdRiwayatStyle}>{idx + 1}</td>

                            {/* Badge Minggu Ke */}
                            <td style={tdRiwayatStyle}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  borderRadius: "10px",
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
                              style={{ ...tdRiwayatStyle, minWidth: "130px" }}
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
                              {(() => {
                                const rawNama = item.namaSiswa || "-";
                                const listNama = rawNama
                                  .split(/\s*[\/|\n]\s*/)
                                  .map((n) => n.trim())
                                  .filter(Boolean);

                                if (listNama.length === 0) {
                                  return (
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        color: "#0f172a",
                                      }}
                                    >
                                      -
                                    </div>
                                  );
                                }

                                return (
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "4px",
                                    }}
                                  >
                                    {listNama.map((ns, i) => (
                                      <div
                                        key={i}
                                        style={{
                                          display: "flex",
                                          alignItems: "flex-start",
                                          gap: "6px",
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        <span
                                          style={{
                                            color: "#2563eb",
                                            fontWeight: 800,
                                            fontSize: "13px",
                                            lineHeight: 1.2,
                                            flexShrink: 0,
                                            marginTop: "1px",
                                          }}
                                        >
                                          •
                                        </span>
                                        <span
                                          style={{
                                            fontWeight: 700,
                                            color: "#0f172a",
                                            fontSize: "12px",
                                            flex: 1,
                                            wordBreak: "break-word",
                                          }}
                                        >
                                          {ns}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}

                              {item.kelas && item.kelas !== "-" ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "3px",
                                    marginTop: "5px",
                                  }}
                                >
                                  {item.kelas
                                    .split(/\s*,\s*|\s*[\/|\n]\s*/)
                                    .filter(Boolean)
                                    .map((k, ki) => (
                                      <span
                                        key={ki}
                                        style={{
                                          display: "inline-block",
                                          padding: "1.5px 6px",
                                          borderRadius: "4px",
                                          background: "#dcfce7",
                                          color: "#166534",
                                          fontSize: "10.5px",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {k}
                                      </span>
                                    ))}
                                </div>
                              ) : null}
                            </td>

                            {/* Tempat PKL — Menampilkan tiap tempat magang bertingkat */}
                            <td
                              style={{ ...tdRiwayatStyle, minWidth: "140px" }}
                            >
                              {item.tempatPkl && item.tempatPkl !== "-" ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "3px",
                                  }}
                                >
                                  {item.tempatPkl
                                    .split(/\s*[\/|\n]\s*/)
                                    .filter(Boolean)
                                    .map((tp, i) => (
                                      <span
                                        key={i}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                          padding: "2px 6px",
                                          borderRadius: "6px",
                                          background: "#f0fdf4",
                                          color: "#166534",
                                          border: "1px solid #bbf7d0",
                                          fontSize: "11px",
                                          fontWeight: 600,
                                          lineHeight: 1.25,
                                        }}
                                      >
                                        🏢 {tp}
                                      </span>
                                    ))}
                                </div>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>-</span>
                              )}
                            </td>

                            {/* Materi */}
                            <td
                              style={{
                                ...tdRiwayatStyle,
                                minWidth: "180px",
                                color: "#334155",
                              }}
                            >
                              {item.materi || "-"}
                            </td>

                            {/* Permasalahan */}
                            <td
                              style={{
                                ...tdRiwayatStyle,
                                minWidth: "180px",
                                color: "#991b1b",
                              }}
                            >
                              {item.permasalahan || "-"}
                            </td>

                            {/* Tindak Lanjut */}
                            <td
                              style={{
                                ...tdRiwayatStyle,
                                minWidth: "180px",
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

                            {/* Tombol Hapus */}
                            <td
                              style={{ ...tdRiwayatStyle, textAlign: "center" }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  handleHapusJurnalPkl(item.idJurnal)
                                }
                                disabled={
                                  deletingJurnalId === item.idJurnal ||
                                  !item.idJurnal
                                }
                                title={
                                  !item.idJurnal
                                    ? "ID jurnal tidak tersedia"
                                    : "Hapus jurnal ini"
                                }
                                style={{
                                  padding: "5px 10px",
                                  background:
                                    deletingJurnalId === item.idJurnal
                                      ? "#94a3b8"
                                      : !item.idJurnal
                                        ? "#e2e8f0"
                                        : "#fee2e2",
                                  color:
                                    deletingJurnalId === item.idJurnal
                                      ? "#ffffff"
                                      : !item.idJurnal
                                        ? "#94a3b8"
                                        : "#dc2626",
                                  border: "1px solid",
                                  borderColor:
                                    deletingJurnalId === item.idJurnal
                                      ? "#94a3b8"
                                      : !item.idJurnal
                                        ? "#cbd5e1"
                                        : "#fca5a5",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor:
                                    deletingJurnalId === item.idJurnal ||
                                    !item.idJurnal
                                      ? "not-allowed"
                                      : "pointer",
                                  whiteSpace: "nowrap",
                                  transition: "all 0.15s",
                                }}
                              >
                                {deletingJurnalId === item.idJurnal
                                  ? "⏳"
                                  : "🗑️ Hapus"}
                              </button>
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
            padding: "10px 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
            background: "#ffffff",
            color: "#0f172a",
          }}
        >
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            {activeTab === "form"
              ? `Menampilkan ${rows.length} baris input`
              : `Total ${savedJurnalList.length} jurnal tersimpan`}
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#334155",
                fontWeight: 700,
                fontSize: "12px",
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
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: saving
                    ? "#94a3b8"
                    : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
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
        style={{ ...selectStyle, background: "#ffffff", color: "#0f172a" }}
      >
        <option value="" style={{ background: "#ffffff", color: "#0f172a" }}>
          Pilih...
        </option>
        {options.map((opt, i) => (
          <option
            key={i}
            value={opt}
            style={{ background: "#ffffff", color: "#0f172a" }}
          >
            {opt.length > 55 ? opt.slice(0, 55) + "..." : opt}
          </option>
        ))}
        <option
          value={OPT_LAINNYA}
          style={{ background: "#ffffff", color: "#0f172a" }}
        >
          ✏️ Lainnya (isi manual)
        </option>
      </select>
      {value === OPT_LAINNYA && (
        <textarea
          value={manualValue}
          onChange={(e) => onChangeManual(e.target.value)}
          placeholder="Tulis manual..."
          rows={2}
          style={{
            ...selectStyle,
            marginTop: "4px",
            resize: "vertical",
            background: "#ffffff",
            color: "#0f172a",
          }}
        />
      )}
    </div>
  );
}

const tdStyle = {
  borderBottom: "1px solid #e2e8f0",
  borderRight: "1px solid #e2e8f0",
  padding: "6px 8px",
  verticalAlign: "top",
  color: "#0f172a",
};

const thRiwayatStyle = {
  padding: "9px 10px",
  fontWeight: 700,
  fontSize: "12px",
  whiteSpace: "nowrap",
  color: "#f8fafc",
};

const tdRiwayatStyle = {
  padding: "8px 10px",
  verticalAlign: "middle",
  color: "#0f172a",
  fontSize: "12px",
};

const selectStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 9px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "12px",
  outline: "none",
  fontFamily: "inherit",
  background: "#ffffff",
  color: "#0f172a",
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
