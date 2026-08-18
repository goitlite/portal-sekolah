"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "../../lib/auth";
import { getDataSiswaWali, hapusSiswaWali } from "../../lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// =========================================================
// HELPER: Mengambil Base64 Gambar (Untuk Logo di Kop Surat)
// =========================================================
const getBase64Image = async (url) => {
  if (!url) return null;
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const reader = new FileReader();
        reader.onloadend = () => {
          URL.revokeObjectURL(objectUrl);
          resolve({
            data: reader.result,
            width: img.width,
            height: img.height,
          });
        };
        reader.readAsDataURL(blob);
      };
      img.onerror = () => resolve(null);
      img.src = objectUrl;
    });
  } catch (error) {
    return null;
  }
};

// =========================================================
// FUNGSI UTAMA: GENERATE PDF BIODATA
// =========================================================
export const generateBiodataPDF = async (siswa) => {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // --- KOP SURAT ---
  const logoImg = await getBase64Image("/logo.png"); // Pastikan file logo.png ada di folder public
  if (logoImg) {
    doc.addImage(logoImg.data, "PNG", 15, 12, 22, 22);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("SMK NEGERI 1 TELUK KUANTAN", pageWidth / 2, 18, {
    align: "center",
  });

  doc.setFontSize(14);
  doc.text("BIODATA LENGKAP SISWA WALI", pageWidth / 2, 25, {
    align: "center",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Tahun Pelajaran 2026/2027", pageWidth / 2, 31, { align: "center" });

  // Garis Bawah Kop
  doc.setLineWidth(0.8);
  doc.line(15, 37, pageWidth - 15, 37);
  doc.setLineWidth(0.3);
  doc.line(15, 38.5, pageWidth - 15, 38.5);

  let startY = 46;

  // Helper Pembuat Tabel - Warna Headernya diubah ke Biru Navy Formal
  const createTable = (title, bodyData, headColor = [30, 58, 138]) => {
    autoTable(doc, {
      startY: startY,
      head: [[{ content: title, colSpan: 2 }]],
      body: bodyData,
      theme: "grid",
      styles: {
        fontSize: 9.5,
        cellPadding: 3.5,
        textColor: [0, 0, 0],
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: headColor,
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 55, fontStyle: "bold", fillColor: [248, 248, 250] },
        1: { cellWidth: "auto" },
      },
      margin: { left: 15, right: 15 },
    });
    startY = doc.lastAutoTable.finalY + 6;
  };

  // --- ISI BIODATA ---
  createTable("I. DATA SEKOLAH & MAGANG", [
    ["ID Siswa", siswa.idSiswa || "-"],
    ["Nama Lengkap", siswa.nama || "-"],
    ["Guru Pembimbing", siswa.namaGuru || "-"],
    ["Tempat Magang", siswa.tempatMagang || "-"],
  ]);

  // NO HP dimasukkan ke Data Pribadi
  createTable("II. DATA PRIBADI", [
    ["No. Handphone (WA)", siswa.noHp || "-"], // Cita-cita dihapus, diganti No HP di sini
    [
      "Tempat, Tanggal Lahir",
      `${siswa.tempatLahir || "-"}, ${siswa.tglLahir || "-"}`,
    ],
    ["Anak Ke", siswa.anakKe || "-"],
    ["Alamat Lengkap", siswa.alamat || "-"],
    ["Transportasi", siswa.transportasi || "-"],
  ]);

  createTable("III. DATA AYAH", [
    ["Nama Ayah", siswa.ayah || "-"],
    ["Pekerjaan Ayah", siswa.pekerjaanAyah || "-"],
    ["Kontak Ayah", siswa.kontakAyah || "-"],
  ]);

  createTable("IV. DATA IBU", [
    ["Nama Ibu", siswa.ibu || "-"],
    ["Pekerjaan Ibu", siswa.pekerjaanIbu || "-"],
    ["Kontak Ibu", siswa.kontakIbu || "-"],
  ]);

  // Cek jika halaman hampir penuh, pindah ke halaman 2
  if (startY > 220) {
    doc.addPage();
    startY = 20;
  }

  createTable("V. PROFIL, MINAT & BAKAT", [
    ["Hobi", siswa.hobi || "-"],
    ["Bakat / Keahlian", siswa.bakatKeahlian || "-"],
    ["Pelajaran Disukai", siswa.pelajaranDisukai || "-"],
    ["Alasan Disukai", siswa.alasanDisukai || "-"],
    ["Pelajaran Tidak Disukai", siswa.pelajaranTidakDisukai || "-"],
    ["Alasan Tidak Disukai", siswa.alasanTidakDisukai || "-"],
  ]);

  // Tabel Khusus untuk Harapan
  autoTable(doc, {
    startY: startY,
    head: [
      [
        {
          content: "VI. HARAPAN SISWA DI SMKN 1 DAN CITA CITA KEDEPANNYA",
          styles: { halign: "center" },
        },
      ],
    ],
    body: [[siswa.harapan || "-"]],
    theme: "grid",
    styles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: [0, 0, 0],
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    margin: { left: 15, right: 15 },
  });
  startY = doc.lastAutoTable.finalY + 15;

  // --- BAGIAN TANDA TANGAN ---
  if (startY > 240) {
    doc.addPage();
    startY = 30;
  }

  const tanggalCetak = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Teluk Kuantan, ${tanggalCetak}`, 130, startY);
  doc.text("Mengetahui,", 130, startY + 5);
  doc.text("Guru Wali,", 130, startY + 10);

  doc.setFont("helvetica", "bold");
  doc.text(siswa.namaGuru || "___________________", 130, startY + 30);
  doc.setLineWidth(0.3);
  doc.line(130, startY + 31, 190, startY + 31);

  // Penamaan file yang rapi
  const namaFileSafe = siswa.nama
    ? siswa.nama.replace(/[^a-zA-Z0-9]/g, "_")
    : "Siswa";
  doc.save(`Biodata_${namaFileSafe}.pdf`);
};

// =========================================================
// KOMPONEN UTAMA
// =========================================================
export default function GuruWaliPage() {
  const router = useRouter();
  const [dataSiswa, setDataSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [isPrinting, setIsPrinting] = useState(null);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    loadDataSiswaWali();

    const sudahLihat = sessionStorage.getItem("guruWaliWelcome");

    if (!sudahLihat) {
      setShowWelcome(true);
    }
  }, []);

  async function loadDataSiswaWali() {
    try {
      setLoading(true);
      setError("");
      const session = getSession();

      if (!session || session.role !== "guru") {
        setError("Sesi guru tidak ditemukan.");
        return;
      }

      const idGuru = session.id;
      if (!idGuru) {
        setError("ID guru tidak ditemukan.");
        return;
      }

      const result = await getDataSiswaWali(idGuru);

      if (!result.success) {
        setError(result.message || "Gagal mengambil data.");
        return;
      }
      setDataSiswa(result.data || []);
    } catch (err) {
      console.error("ERROR GURU WALI:", err);
      setError("Terjadi kesalahan saat mengambil data.");
    } finally {
      setLoading(false);
    }
  }

  async function handleHapusSiswa(idSiswa, namaSiswa) {
    const isConfirm = window.confirm(
      `Peringatan!\n\nApakah Bapak/Ibu yakin ingin menghapus siswa ${namaSiswa} dari daftar wali? Data hubungan guru wali ini akan dihapus secara permanen dari spreadsheet sistem.`,
    );

    if (!isConfirm) return;

    try {
      const session = getSession();
      const result = await hapusSiswaWali({
        idSiswa: idSiswa,
        idGuru: session.id,
      });

      if (result.success) {
        alert(`Siswa ${namaSiswa} berhasil dihapus dari daftar wali.`);
        setDataSiswa((prev) =>
          prev.filter((siswa) => siswa.idSiswa !== idSiswa),
        );
      } else {
        alert(`Gagal menghapus data: ${result.message}`);
      }
    } catch (error) {
      console.error("Error Hapus Siswa:", error);
      alert("Terjadi kesalahan sistem saat mencoba menghapus siswa.");
    }
  }

  async function handleCetakPDF(siswa) {
    try {
      setIsPrinting(siswa.idSiswa);
      await generateBiodataPDF(siswa);
    } catch (error) {
      console.error("Gagal mencetak PDF", error);
      alert("Terjadi kesalahan saat membuat file PDF.");
    } finally {
      setIsPrinting(null);
    }
  }

  function tutupWelcomeGuruWali() {
    sessionStorage.setItem("guruWaliWelcome", "true");
    setShowWelcome(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 sm:h-10 sm:w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-800" />
            <p className="text-sm sm:text-base font-bold text-slate-700">
              Memuat data siswa wali...
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Mohon tunggu sebentar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl sm:rounded-3xl border border-red-200 bg-red-50 p-5 sm:p-6 text-red-700 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl sm:text-2xl">⚠️</span>
              <h2 className="text-base sm:text-lg font-black">
                Gagal Memuat Data
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium">{error}</p>
            <button
              onClick={loadDataSiswaWali}
              className="mt-4 sm:mt-5 rounded-xl bg-red-600 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-black text-white transition hover:bg-red-700 active:scale-95"
            >
              🔄 Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  function getWhatsAppUrl(noHp) {
    if (!noHp) return null;

    let nomor = String(noHp).replace(/\D/g, "");

    // Indonesia: 0812xxxx → 62812xxxx
    if (nomor.startsWith("0")) {
      nomor = "62" + nomor.substring(1);
    }

    // Kalau sudah 62, biarkan
    if (!nomor.startsWith("62")) {
      nomor = "62" + nomor;
    }

    return `https://wa.me/${nomor}`;
  }

  function kirimLoginWhatsApp(idSiswa, namaSiswa) {
    if (!idSiswa) {
      alert("ID siswa tidak tersedia.");
      return;
    }

    const pesan = `Halo ${namaSiswa || "Siswa"}.

Silakan login ke Portal SMKN 1 Teluk Kuantan:

https://portalsmkn1telku.vercel.app/

Gunakan ID sesuai kartu Anda:

Nama: ${namaSiswa || "-"}
ID: ${idSiswa}`;

    const url = `https://wa.me/?text=${encodeURIComponent(pesan)}`;

    window.open(url, "_blank");
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
        <div className="mx-auto max-w-6xl">
          {/* HEADER DIPERBAIKI MENJADI WARNA BLUE-NAVY FORMAL SEKOLAH */}
          <div className="mb-5 sm:mb-6 overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-r from-blue-900 to-blue-700 p-5 sm:p-8 text-white shadow-xl flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between relative">
            <button
              onClick={() => router.back()}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 rounded-xl bg-white/10 px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm flex items-center gap-2"
            >
              ⬅️ Kembali
            </button>

            <div className="mt-8 sm:mt-0">
              <div className="mb-1.5 sm:mb-2 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">👨‍🏫</span>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                  Guru Wali
                </span>
              </div>
              <h1 className="text-xl font-black sm:text-3xl">
                Data Siswa Wali
              </h1>
              <p className="mt-1.5 sm:mt-2 max-w-2xl text-xs sm:text-sm font-medium text-blue-100 sm:text-base">
                Daftar siswa yang menjadi tanggung jawab guru wali. Pilih siswa
                untuk melihat profil lengkap.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0 mr-0 sm:mr-24">
              <div className="flex items-center justify-center rounded-xl sm:rounded-2xl bg-white/15 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-sm border border-white/10">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-black">
                    {dataSiswa.length}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-100">
                    Siswa Wali
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* =====================================================
      MENU GURU WALI
  ===================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {/* TAMBAH SISWA */}
            <button
              onClick={() => router.push("/magang/guru/guru-wali/tambah")}
              className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-4 text-white shadow-lg shadow-amber-500/20 transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl">
                ➕
              </span>

              <span className="flex flex-col items-start">
                <span className="text-sm font-black">TAMBAH SISWA</span>

                <span className="text-[10px] font-medium text-white/80">
                  Tambahkan siswa wali
                </span>
              </span>
            </button>

            {/* ISI JURNAL */}
            <button
              onClick={() => router.push("/magang/guru/guru-wali/jurnal")} // Diubah dari alert ke router.push
              className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-4 text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl">
                📝
              </span>

              <span className="flex flex-col items-start">
                <span className="text-sm font-black">ISI JURNAL GURU WALI</span>

                <span className="text-[10px] font-medium text-white/80">
                  Klik untuk mulai
                </span>
              </span>
            </button>
            {/* Tombol 2: Rekap Guru Wali */}
            <button
              onClick={() => router.push("/magang/guru/guru-wali/rekap")}
              className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-4 text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl">
                📊
              </span>
              <span className="flex flex-col items-start">
                <span className="text-sm font-black">REKAP GURU WALI</span>
                <span className="text-[10px] font-medium text-white/80">
                  Lihat data rekap
                </span>
              </span>
            </button>

            {/* CETAK JURNAL */}
            <button
              onClick={() =>
                alert(
                  "🖨️ Fitur Cetak Jurnal Guru Wali sedang dalam proses pengembangan.",
                )
              }
              className="group flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-4 text-white shadow-lg shadow-emerald-500/20 transition-all hover:-translate-y-1 hover:shadow-xl active:scale-[0.98]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-2xl">
                🖨️
              </span>

              <span className="flex flex-col items-start">
                <span className="text-sm font-black">
                  CETAK JURNAL GURU WALI
                </span>

                <span className="text-[10px] font-medium text-white/80">
                  Sedang dikembangkan
                </span>
              </span>
            </button>
          </div>
          {/* LIST SISWA */}
          {dataSiswa.length === 0 ? (
            <div className="rounded-2xl sm:rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 sm:p-10 text-center shadow-sm">
              <div className="mb-3 sm:mb-4 text-4xl sm:text-5xl">👨‍🎓</div>
              <h2 className="text-lg sm:text-xl font-black text-slate-700">
                Belum Ada Siswa Wali
              </h2>
              <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500">
                Belum terdapat siswa yang terhubung dengan guru wali ini.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {dataSiswa.map((siswa, index) => (
                <div
                  key={siswa.idSiswa || index}
                  className="group flex flex-col overflow-hidden rounded-xl sm:rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-blue-200"
                >
                  {/* WARNA CARD HEADER MENJADI BIRU NAVY */}
                  <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-4 sm:p-5 text-white">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-white/15 text-xl sm:text-2xl shadow-inner">
                        👨‍🎓
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-sm sm:text-base font-black">
                          {siswa.nama || "-"}
                        </h2>
                        <div className="mt-1 flex items-center gap-2">
                          <p className="text-[10px] sm:text-xs font-bold text-blue-200">
                            ID: {siswa.idSiswa || "-"}
                          </p>

                          {siswa.idSiswa && (
                            <button
                              type="button"
                              onClick={() =>
                                kirimLoginWhatsApp(siswa.idSiswa, siswa.nama)
                              }
                              title="Bagikan informasi login via WhatsApp"
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white shadow-md transition-all hover:scale-110 hover:bg-blue-700 active:scale-95"
                            >
                              {/* Icon SVG Share */}
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2.5}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100-2.684 3 3 0 000 2.684zm0 9.316a3 3 0 100-2.684 3 3 0 000 2.684z"
                                />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex-1 space-y-2.5 sm:space-y-3">
                      <div>
                        {/* WHATSAPP */}
                        <div>
                          <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">
                            WhatsApp
                          </p>

                          {siswa.noHp ? (
                            <a
                              href={getWhatsAppUrl(siswa.noHp)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-green-600 hover:text-green-700 hover:underline"
                            >
                              💬 {siswa.noHp}
                            </a>
                          ) : (
                            <>
                              <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-400">
                                💬 -
                              </p>

                              <p className="mt-1 text-[10px] italic font-medium text-amber-600">
                                Harus diisi di akun siswa
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Tempat Magang
                        </p>

                        {siswa.tempatMagang ? (
                          <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-700">
                            📍 {siswa.tempatMagang}
                          </p>
                        ) : (
                          <>
                            <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-400">
                              📍 -
                            </p>

                            <p className="mt-1 text-[10px] italic font-medium text-amber-600">
                              Harus diisi di akun siswa
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* KELOMPOK TOMBOL PROFIL, EDIT, HAPUS, CETAK */}
                    <div className="mt-4 sm:mt-5 grid grid-cols-2 xl:grid-cols-4 gap-2">
                      <button
                        onClick={() => setSelectedSiswa(siswa)}
                        className="flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-blue-600 px-2 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.97]"
                      >
                        👁️ PROFIL
                      </button>

                      <button
                        onClick={() => {
                          const match = (siswa.nama || "").match(/\[(.*?)\]/);
                          const extractedKelas = match ? match[1] : "";
                          router.push(
                            `/magang/guru/guru-wali/tambah?editId=${siswa.idSiswa}&kelas=${encodeURIComponent(extractedKelas)}`,
                          );
                        }}
                        className="flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-amber-50 border border-amber-200 px-2 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black text-amber-700 transition-all hover:bg-amber-100 hover:border-amber-300 active:scale-[0.97]"
                      >
                        ✏️ EDIT
                      </button>

                      <button
                        onClick={() => handleCetakPDF(siswa)}
                        disabled={isPrinting === siswa.idSiswa}
                        className="flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-200 px-2 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black text-emerald-700 transition-all hover:bg-emerald-100 hover:border-emerald-300 active:scale-[0.97] disabled:opacity-50"
                      >
                        {isPrinting === siswa.idSiswa ? "⏳ LOAD" : "🖨️ CETAK"}
                      </button>

                      <button
                        onClick={() =>
                          handleHapusSiswa(siswa.idSiswa, siswa.nama)
                        }
                        className="flex items-center justify-center gap-1.5 rounded-lg sm:rounded-xl bg-red-50 border border-red-200 px-2 py-2.5 sm:py-3 text-[10px] sm:text-xs font-black text-red-600 transition-all hover:bg-red-100 hover:border-red-300 active:scale-[0.97]"
                      >
                        🗑️ HAPUS
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* POPUP / MODAL DETAIL SISWA */}
        {selectedSiswa && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setSelectedSiswa(null);
            }}
          >
            <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              {/* TEMA WARNA HEADER MODAL */}
              <div className="shrink-0 bg-gradient-to-r from-blue-900 to-blue-800 p-4 sm:p-5 text-white">
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="flex flex-1 min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-white/20 text-xl sm:text-2xl backdrop-blur-sm">
                      👨‍🎓
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base sm:text-lg font-black">
                        {selectedSiswa.nama || "-"}
                      </h2>
                      <div className="mt-1 flex flex-wrap gap-1.5 sm:gap-2">
                        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold">
                          ID: {selectedSiswa.idSiswa || "-"}
                        </span>
                        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold">
                          📍 {selectedSiswa.tempatMagang || "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSiswa(null)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/20 text-sm font-black text-white transition-all hover:bg-black/40 hover:scale-105 active:scale-95"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto p-4 sm:p-5">
                <div className="space-y-4 sm:space-y-5">
                  <Section icon="🏫" title="Data Sekolah & Magang">
                    <Info label="ID Siswa" value={selectedSiswa.idSiswa} />
                    <Info label="Nama Siswa" value={selectedSiswa.nama} />
                    <Info
                      label="Guru Pembimbing"
                      value={selectedSiswa.namaGuru}
                    />
                    <Info
                      label="Tempat Magang"
                      value={selectedSiswa.tempatMagang}
                    />
                  </Section>

                  <Section icon="📱" title="Data Pribadi">
                    {/* DATA NO HP DIMASUKKAN KE SINI */}
                    <Info
                      label="No. Handphone (WA)"
                      value={selectedSiswa.noHp}
                    />
                    <Info
                      label="Tempat Lahir"
                      value={selectedSiswa.tempatLahir}
                    />
                    <Info
                      label="Tanggal Lahir"
                      value={selectedSiswa.tglLahir}
                    />
                    <Info label="Anak Ke" value={selectedSiswa.anakKe} />
                    <Info label="Alamat" value={selectedSiswa.alamat} full />
                    <Info
                      label="Transportasi"
                      value={selectedSiswa.transportasi}
                    />
                  </Section>

                  <Section icon="👨" title="Data Ayah">
                    <Info label="Nama Ayah" value={selectedSiswa.ayah} />
                    <Info
                      label="Pekerjaan Ayah"
                      value={selectedSiswa.pekerjaanAyah}
                    />
                    <Info
                      label="Kontak Ayah"
                      value={selectedSiswa.kontakAyah}
                    />
                  </Section>

                  <Section icon="👩" title="Data Ibu">
                    <Info label="Nama Ibu" value={selectedSiswa.ibu} />
                    <Info
                      label="Pekerjaan Ibu"
                      value={selectedSiswa.pekerjaanIbu}
                    />
                    <Info label="Kontak Ibu" value={selectedSiswa.kontakIbu} />
                  </Section>

                  <Section icon="⭐" title="Profil, Hobi & Bakat">
                    <Info label="Hobi" value={selectedSiswa.hobi} />
                    <Info
                      label="Bakat / Keahlian"
                      value={selectedSiswa.bakatKeahlian}
                    />
                  </Section>

                  <Section icon="📚" title="Minat & Pelajaran">
                    <Info
                      label="Pelajaran Disukai"
                      value={selectedSiswa.pelajaranDisukai}
                    />
                    <Info
                      label="Alasan Menyukai"
                      value={selectedSiswa.alasanDisukai}
                      full
                    />
                    <Info
                      label="Pelajaran Tidak Disukai"
                      value={selectedSiswa.pelajaranTidakDisukai}
                    />
                    <Info
                      label="Alasan Tidak Menyukai"
                      value={selectedSiswa.alasanTidakDisukai}
                      full
                    />
                  </Section>

                  <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg">🎯</span>
                      <h3 className="text-sm sm:text-base font-black text-blue-900">
                        Harapan Siswa di SMKN 1 DAN CITA CITA
                      </h3>
                    </div>
                    <p className="rounded-lg bg-white/80 p-3 sm:p-4 text-xs sm:text-sm font-semibold leading-relaxed text-slate-700">
                      {selectedSiswa.harapan || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
                <button
                  onClick={() => setSelectedSiswa(null)}
                  className="w-full rounded-lg bg-blue-900 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white transition hover:bg-blue-800 active:scale-[0.98]"
                >
                  Tutup Profil
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POPUP WELCOME GURU WALI */}
      {showWelcome && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-4xl shadow-inner">
                👨‍🏫
              </div>
              <h2 className="mt-4 text-xs font-black uppercase tracking-widest text-blue-600">
                PORTAL GURU WALI
              </h2>
              <h3 className="mt-1 text-2xl font-black text-slate-800">
                Selamat Datang
              </h3>
              <p className="mt-3 text-sm font-medium leading-relaxed text-slate-500">
                Di Halaman Guru Wali
                <br />
                Halaman ini dirancang untuk membantu Bapak/Ibu Guru Wali dalam
                mendokumentasikan kegiatan, memantau siswa wali, serta
                menyiapkan
                <span className="font-bold text-blue-600">
                  {" "}
                  laporan Guru Wali
                </span>
                secara lebih mudah dan terorganisir.
              </p>

              {/* FITUR */}
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
                  <div className="text-xl">📋</div>
                  <p className="mt-1 text-[11px] font-black text-slate-700">
                    Data Siswa Wali
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
                  <div className="text-xl">📝</div>
                  <p className="mt-1 text-[11px] font-black text-slate-700">
                    Dokumentasi Kegiatan
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <div className="text-xl">📊</div>
                  <p className="mt-1 text-[11px] font-black text-slate-700">
                    Pemantauan Siswa
                  </p>
                </div>

                <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-3">
                  <div className="text-xl">🖨️</div>
                  <p className="mt-1 text-[11px] font-black text-slate-700">
                    Laporan Guru Wali
                  </p>
                </div>
              </div>

              {/* PESAN PENUTUP */}
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-center">
                <p className="text-xs font-semibold leading-5 text-slate-600">
                  ✨ Dengan dokumentasi yang rapi, setiap pendampingan siswa
                  menjadi lebih terarah, tercatat, dan mudah
                  dipertanggungjawabkan.
                </p>
              </div>

              <p className="mt-4 text-center text-[11px] font-medium italic text-slate-400">
                Terima kasih atas dedikasi Bapak/Ibu dalam mendampingi dan
                membimbing siswa. 🌟
              </p>

              {/* TOMBOL */}
              <button
                type="button"
                onClick={tutupWelcomeGuruWali}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-900/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]"
              >
                <span>🚀</span>
                MULAI GURU WALI
              </button>

              <button
                type="button"
                onClick={tutupWelcomeGuruWali}
                className="mt-2 w-full py-2 text-[11px] font-bold text-slate-400 transition hover:text-slate-600"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ icon, title, children }) {
  return (
    <section>
      <div className="mb-2.5 sm:mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm sm:text-base font-black text-slate-800">
          {title}
        </h3>
      </div>
      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Info({ label, value, full = false }) {
  const isEmpty =
    value === null ||
    value === undefined ||
    String(value).trim() === "" ||
    String(value).trim() === "-";

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-sm p-3 sm:p-3.5 ${
        full ? "sm:col-span-2" : ""
      }`}
    >
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>

      {isEmpty ? (
        <div>
          <p className="text-xs sm:text-sm font-bold text-slate-400">-</p>

          <p className="mt-1 text-[10px] sm:text-[11px] font-medium italic text-amber-600">
            Harus diisi di akun siswa
          </p>
        </div>
      ) : (
        <p className="text-xs sm:text-sm font-bold text-slate-700 break-words">
          {value}
        </p>
      )}
    </div>
  );
}
