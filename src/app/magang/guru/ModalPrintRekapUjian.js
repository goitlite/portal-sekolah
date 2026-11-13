// src/app/magang/guru/ModalPrintRekapUjian.js
// Modal Cetak & Ekspor PDF Rekap Nilai Asesmen Siswa
// Menampilkan nilai murni siswa berdasarkan respon pertama yang masuk

"use client";

import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  evaluasiNilaiSiswa,
  isMapelSemua,
  deteksiJoki,
  kunciSiswaAsesmen,
} from "@/lib/auditAsesmenHelper";
import PanelLaporanJoki, { labelTingkat, teksPelaku } from "./PanelLaporanJoki";

// Pemanggil autoTable yang aman lintas versi & bundler
const runAutoTable = (doc, options) => {
  if (typeof autoTable === "function") {
    autoTable(doc, options);
  } else if (typeof autoTable?.default === "function") {
    autoTable.default(doc, options);
  } else if (typeof doc.autoTable === "function") {
    doc.autoTable(options);
  } else {
    throw new Error(
      "Komponen tabel PDF tidak berhasil dimuat. Muat ulang halaman lalu coba kembali.",
    );
  }
};

export default function ModalPrintRekapUjian({
  isOpen,
  onClose,
  kelas = "",
  mapel = "",
  daftarSiswa = [],
  semuaSiswa = null, // opsional: seluruh siswa (pelaku joki bisa dari kelas lain)
  responList = [],
  user = null,
}) {
  const [downloading, setDownloading] = useState(false);

  const semuaMapel = isMapelSemua(mapel);
  const semuaKelas = !kelas || /^semua/i.test(String(kelas).trim());

  // Deteksi joki (nama form tidak cocok dengan akun yang membuka ujian)
  const deteksi = useMemo(
    () =>
      deteksiJoki(
        semuaSiswa && semuaSiswa.length ? semuaSiswa : daftarSiswa,
        responList,
        semuaMapel ? "" : mapel,
      ),
    [semuaSiswa, daftarSiswa, responList, mapel, semuaMapel],
  );

  // Hanya kasus yang melibatkan siswa yang dicetak
  const kasusCetak = useMemo(() => {
    const kunci = new Set((daftarSiswa || []).map((s) => kunciSiswaAsesmen(s)));
    return deteksi.kasus.filter(
      (k) => kunci.has(k.korban.key) || (k.pelaku && kunci.has(k.pelaku.key)),
    );
  }, [deteksi, daftarSiswa]);

  // Evaluasi nilai seluruh siswa di kelas ini untuk mapel ini
  const rekapEvaluasi = useMemo(() => {
    if (!daftarSiswa || daftarSiswa.length === 0) return [];

    return daftarSiswa.map((siswa, idx) => {
      const res = evaluasiNilaiSiswa(
        siswa,
        responList,
        mapel,
        daftarSiswa,
        deteksi.responTidakSah,
      );
      const jk = deteksi.perSiswa.get(kunciSiswaAsesmen(siswa));
      const jokiPelaku = jk && jk.pelaku.length > 0 ? jk.pelaku[0] : null;
      let status = res.sudahUjian ? "Sudah Ujian" : "Belum Ujian";
      if (jokiPelaku)
        status =
          jokiPelaku.tingkat === "terdeteksi"
            ? "Terdeteksi Joki"
            : "Dugaan Joki";

      // Mode "Semua Mapel": tampilkan nilai per mapel (bukan hanya respon paling awal yang bisa menyesatkan)
      let nilaiTampil = res.sudahUjian ? res.nilai : "-";
      let nilaiRata = res.nilai100 ?? res.nilaiAngka;
      if (res.sudahUjian && semuaMapel && res.banyakMapel) {
        nilaiTampil = res.perMapel
          .map((m) => `${m.mapel || "-"}: ${m.nilai}`)
          .join("\n");
        const angka = res.perMapel
          .map((m) => m.nilai100 ?? m.nilaiAngka)
          .filter((n) => n !== null && n !== undefined);
        nilaiRata = angka.length
          ? angka.reduce((a, b) => a + b, 0) / angka.length
          : null;
      }

      return {
        no: idx + 1,
        id_siswa: siswa.id_siswa || "-",
        nama: siswa.nama || "-",
        kelas: siswa.kelas || (semuaKelas ? "-" : kelas),
        pelanggaran: Number(siswa.pelanggaran || 0),
        nilai: nilaiTampil,
        nilaiAngka: nilaiRata ?? null,
        sudahUjian: res.sudahUjian,
        status,
        joki: jokiPelaku ? "pelaku" : null,
        waktuSubmit: res.timestamp || "-",
      };
    });
  }, [daftarSiswa, responList, mapel, kelas, semuaMapel, semuaKelas, deteksi]);

  // Statistik Ringkas
  const stats = useMemo(() => {
    const total = rekapEvaluasi.length;
    const sudah = rekapEvaluasi.filter((s) => s.sudahUjian).length;
    const belum = total - sudah;
    const totalPelanggaran = rekapEvaluasi.reduce(
      (acc, s) => acc + (s.pelanggaran || 0),
      0,
    );
    const nilaiValid = rekapEvaluasi
      .filter(
        (s) =>
          s.nilaiAngka !== null &&
          s.nilaiAngka !== undefined &&
          !isNaN(s.nilaiAngka),
      )
      .map((s) => s.nilaiAngka);
    const avg =
      nilaiValid.length > 0
        ? (nilaiValid.reduce((a, b) => a + b, 0) / nilaiValid.length).toFixed(1)
        : "-";

    return { total, sudah, belum, avg, totalPelanggaran };
  }, [rekapEvaluasi]);

  // Tanggal Hari Ini (Format Indonesia)
  const tanggalHariIni = useMemo(() => {
    return new Date().toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }, []);

  // Ekspor Dokumen Resmi PDF menggunakan jsPDF + AutoTable
  const handleDownloadPDF = () => {
    setDownloading(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      // KOP SURAT
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("PEMERINTAH PROVINSI RIAU", pageWidth / 2, 16, {
        align: "center",
      });
      doc.setFontSize(14);
      doc.text("DINAS PENDIDIKAN", pageWidth / 2, 23, { align: "center" });
      doc.setFontSize(16);
      doc.text("SMK NEGERI 1 TELUK KUANTAN", pageWidth / 2, 31, {
        align: "center",
      });

      // Garis Kop Ganda
      doc.setLineWidth(0.8);
      doc.line(14, 35, pageWidth - 14, 35);
      doc.setLineWidth(0.2);
      doc.line(14, 36, pageWidth - 14, 36);

      // JUDUL LAPORAN
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("REKAPITULASI NILAI ASESMEN / UJIAN", pageWidth / 2, 44, {
        align: "center",
      });

      // INFORMASI KELAS & MAPEL
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const startInfoY = 51;
      doc.text(`Kelas                : ${kelas || "-"}`, 14, startInfoY);
      doc.text(`Mata Pelajaran : ${mapel || "-"}`, 14, startInfoY + 6);
      doc.text(
        `Tanggal Cetak  : ${tanggalHariIni}`,
        pageWidth - 14,
        startInfoY,
        { align: "right" },
      );
      doc.text(
        `Guru Pengampu  : ${user?.nama || "Guru Mata Pelajaran"}`,
        pageWidth - 14,
        startInfoY + 6,
        {
          align: "right",
        },
      );

      // TABEL DATA NILAI & PELANGGARAN
      // Saat "Semua Kelas" ditampilkan, tambahkan kolom Kelas agar tabel tidak ambigu
      const kolomKelas = semuaKelas;
      const tableRows = rekapEvaluasi.map((s) => {
        const baris = [
          s.no,
          s.id_siswa,
          s.nama,
          s.pelanggaran > 0 ? `${s.pelanggaran}x` : "0",
          s.nilai,
          s.status,
          s.waktuSubmit,
        ];
        if (kolomKelas) baris.splice(3, 0, s.kelas);
        return baris;
      });
      const kolomNilai = kolomKelas ? 5 : 4;
      const kolomPelanggaran = kolomKelas ? 4 : 3;
      const kolomStatus = kolomKelas ? 6 : 5;
      const headTabel = [
        "No",
        "NIS / ID",
        "Nama Siswa",
        "Pelanggaran",
        "Nilai",
        "Status",
        "Waktu Submit",
      ];
      if (kolomKelas) headTabel.splice(3, 0, "Kelas");

      runAutoTable(doc, {
        startY: startInfoY + 12,
        head: [headTabel],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [15, 23, 42], // slate-900
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
          fontSize: 9,
        },
        styles: {
          fontSize: 8.5,
          cellPadding: 2.2,
          valign: "middle",
        },
        columnStyles: kolomKelas
          ? {
              0: { halign: "center", cellWidth: 9 },
              1: { halign: "center", cellWidth: 22 },
              2: { halign: "left" },
              3: { halign: "center", cellWidth: 22 },
              4: { halign: "center", cellWidth: 18 },
              5: { halign: "center", cellWidth: 24, fontStyle: "bold" },
              6: { halign: "center", cellWidth: 20 },
              7: { halign: "center", cellWidth: 28 },
            }
          : {
              0: { halign: "center", cellWidth: 10 },
              1: { halign: "center", cellWidth: 24 },
              2: { halign: "left" },
              3: { halign: "center", cellWidth: 22 },
              4: { halign: "center", cellWidth: 20, fontStyle: "bold" },
              5: { halign: "center", cellWidth: 26 },
              6: { halign: "center", cellWidth: 32 },
            },
        didParseCell: function (data) {
          if (data.section === "body") {
            // Kolom Pelanggaran
            if (data.column.index === kolomPelanggaran) {
              const val = String(data.cell.raw);
              if (val !== "0") {
                data.cell.styles.textColor = [225, 29, 72]; // rose-600
                data.cell.styles.fontStyle = "bold";
              } else {
                data.cell.styles.textColor = [100, 116, 139]; // slate-500
              }
            }
            // Kolom Status (joki)
            if (data.column.index === kolomStatus) {
              const val = String(data.cell.raw);
              if (/Joki/.test(val)) {
                data.cell.styles.textColor = [255, 255, 255];
                data.cell.styles.fillColor = [225, 29, 72];
                data.cell.styles.fontStyle = "bold";
              }
            }
            // Kolom Nilai
            if (data.column.index === kolomNilai) {
              const val = String(data.cell.raw);
              if (val !== "-") {
                data.cell.styles.textColor = [16, 122, 68]; // emerald-700
              } else {
                data.cell.styles.textColor = [148, 163, 184]; // slate-400
              }
            }
          }
        },
      });

      // LAPORAN DUGAAN JOKI (hanya jika ada kasus)
      if (kasusCetak.length > 0) {
        let jy = (doc.lastAutoTable?.finalY || 180) + 10;
        if (jy + 30 > 280) {
          doc.addPage();
          jy = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(190, 18, 60);
        doc.text("LAPORAN DUGAAN JOKI ASESMEN", 14, jy);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text(
          "Nama di Google Form dipilih dari data sekolah. Respon a.n. siswa di bawah dinyatakan tidak sah karena akunnya tidak tercatat membuka ujian mapel tersebut.",
          14,
          jy + 5,
          { maxWidth: pageWidth - 28 },
        );
        runAutoTable(doc, {
          startY: jy + 12,
          head: [
            [
              "No",
              "Mapel",
              "Nama di Form (Pemilik Nama)",
              "Dikerjakan oleh Akun",
              "Waktu Form",
              "Nilai Form",
              "Status",
            ],
          ],
          body: kasusCetak.map((k, i) => [
            i + 1,
            k.mapel,
            `${k.korban.nama} (${k.korban.kelas})`,
            teksPelaku(k),
            k.waktuRespon || "-",
            k.nilai,
            labelTingkat(k.tingkat),
          ]),
          theme: "grid",
          headStyles: {
            fillColor: [159, 18, 57],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
            fontSize: 8.5,
          },
          styles: { fontSize: 8, cellPadding: 2, valign: "middle" },
          columnStyles: {
            0: { halign: "center", cellWidth: 9 },
            1: { cellWidth: 22 },
            4: { halign: "center", cellWidth: 26 },
            5: { halign: "center", cellWidth: 16, fontStyle: "bold" },
            6: { halign: "center", cellWidth: 26 },
          },
        });
      }

      // BLOK TANDA TANGAN DI BAWAH TABEL
      const finalY = (doc.lastAutoTable?.finalY || 180) + 12;
      let ttdY = finalY;

      // Jika ruang tidak cukup (blok tanda tangan butuh ~40 mm), pindah ke halaman baru dan mulai dari atas
      if (finalY + 40 > 285) {
        doc.addPage();
        ttdY = 25;
      }

      const ttdX = pageWidth - 65;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Teluk Kuantan, ${tanggalHariIni}`, ttdX, ttdY);
      doc.text("Guru Mata Pelajaran,", ttdX, ttdY + 6);

      doc.setFont("helvetica", "bold");
      doc.text(user?.nama || "Guru Pengampu", ttdX, ttdY + 28);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        "NIP. ....................................................",
        ttdX,
        ttdY + 33,
      );

      const fileName = `Rekap_Nilai_${(kelas || "Kelas").replace(/\s+/g, "_")}_${(mapel || "Mapel").replace(/\s+/g, "_")}.pdf`;
      doc.save(fileName);
    } catch (err) {
      alert("Gagal membuat PDF: " + err.message);
    } finally {
      setDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* HEADER MODAL */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">📄</span>
              <h2 className="text-lg font-bold">Rekapitulasi Nilai Asesmen</h2>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Kelas:{" "}
              <span className="font-semibold text-emerald-400">{kelas}</span> •
              Mapel:{" "}
              <span className="font-semibold text-emerald-400">{mapel}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            ✕
          </button>
        </div>

        {/* RINGKASAN STATISTIK */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
            <span className="text-[11px] text-slate-500 font-medium">
              Total Siswa
            </span>
            <p className="text-lg font-black text-slate-800">{stats.total}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-emerald-200 bg-emerald-50/30 text-center">
            <span className="text-[11px] text-emerald-700 font-medium">
              Sudah Ujian
            </span>
            <p className="text-lg font-black text-emerald-700">{stats.sudah}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-amber-200 bg-amber-50/30 text-center">
            <span className="text-[11px] text-amber-700 font-medium">
              Belum Ujian
            </span>
            <p className="text-lg font-black text-amber-700">{stats.belum}</p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/30 text-center">
            <span className="text-[11px] text-rose-700 font-medium">
              Total Pelanggaran
            </span>
            <p className="text-lg font-black text-rose-700">
              {stats.totalPelanggaran}x
            </p>
          </div>
          <div
            className={`p-3 rounded-xl border text-center ${kasusCetak.length > 0 ? "border-rose-400 bg-rose-100" : "border-slate-200 bg-white"}`}
          >
            <span className="text-[11px] text-rose-700 font-medium">
              Terdeteksi Joki
            </span>
            <p
              className={`text-lg font-black ${kasusCetak.length > 0 ? "text-rose-700" : "text-slate-400"}`}
            >
              {kasusCetak.length}
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-sky-200 bg-sky-50/30 text-center">
            <span className="text-[11px] text-sky-700 font-medium">
              Rata-rata Nilai
            </span>
            <p className="text-lg font-black text-sky-700">{stats.avg}</p>
          </div>
        </div>

        {/* TABEL PREVIEW */}
        <div className="flex-1 overflow-y-auto p-6">
          <PanelLaporanJoki
            kasus={kasusCetak}
            catatan={deteksi.catatan}
            logTersedia={deteksi.logTersedia}
            judul={[kelas, mapel].filter(Boolean).join(" - ")}
            className="mb-4"
          />
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-[11px] font-black uppercase text-slate-700 sticky top-0 border-b border-slate-300">
              <tr>
                <th className="px-3 py-2 text-center w-12">No</th>
                <th className="px-3 py-2">ID Siswa</th>
                <th className="px-3 py-2">Nama Siswa</th>
                <th className="px-3 py-2 text-center">Pelanggaran</th>
                <th className="px-3 py-2 text-center">Nilai Ujian</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Waktu Respon</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rekapEvaluasi.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-8 text-slate-400 italic"
                  >
                    Tidak ada data siswa untuk kelas ini.
                  </td>
                </tr>
              ) : (
                rekapEvaluasi.map((s) => (
                  <tr
                    key={`${s.no}-${s.id_siswa}-${s.nama}`}
                    className="hover:bg-slate-50 transition"
                  >
                    <td className="px-3 py-2.5 text-center text-slate-500 font-mono">
                      {s.no}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-slate-600">
                      {s.id_siswa}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">
                      {s.nama}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {s.pelanggaran > 0 ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 font-mono">
                          {s.pelanggaran}x
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">
                          0
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {s.sudahUjian ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono whitespace-pre-line text-left">
                          {s.nilai}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic font-mono">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {s.joki === "pelaku" ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white">
                          {s.status}
                        </span>
                      ) : s.sudahUjian ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Sudah Ujian
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">
                          Belum Ujian
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-500 text-[11px] font-mono">
                      {s.waktuSubmit}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER AKSI */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-xs text-slate-500 italic">
            * Menampilkan nilai yang pertama kali dikirimkan oleh siswa
            (earliest submission) per mata pelajaran.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition"
            >
              Tutup
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading || rekapEvaluasi.length === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              <span>
                {downloading
                  ? "⏳ Memproses PDF..."
                  : "📥 Cetak / Unduh Rekap PDF"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
