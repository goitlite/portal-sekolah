"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "../../../lib/auth";
import { getDataSiswaWali } from "../../../lib/api";

const ExpandableText = ({ text, maxLength = 20 }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!text || text === "-" || text.trim() === "")
    return <span className="text-slate-400 italic">-</span>;

  const isLong = text.length > maxLength;
  return (
    <div
      className={`text-[11px] sm:text-xs text-slate-700 ${isLong ? "cursor-pointer hover:bg-slate-50 p-1 rounded transition-colors" : ""}`}
      onClick={() => isLong && setIsExpanded(!isExpanded)}
    >
      {isExpanded
        ? text
        : `${text.substring(0, maxLength)}${isLong ? "..." : ""}`}
      {isLong && !isExpanded && (
        <span className="text-[9px] text-blue-500 font-bold ml-1 border border-blue-200 rounded px-1 bg-blue-50">
          Lihat
        </span>
      )}
    </div>
  );
};

const DocumentIndicator = ({ url, label }) => {
  if (!url || url.trim() === "") {
    return (
      <div className="flex flex-col items-center justify-center bg-red-50 p-1.5 rounded-lg border border-red-100">
        <span className="text-red-500 text-sm">❌</span>
        <span className="text-[8px] font-bold text-red-600 mt-0.5">
          {label}
        </span>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-green-50 hover:bg-green-100 border border-green-200 transition-all hover:scale-105"
      title={`Lihat ${label}`}
    >
      <span className="text-green-600 text-sm shadow-sm">✅</span>
      <span className="text-[8px] font-bold text-green-700 mt-0.5">
        {label}
      </span>
    </a>
  );
};

export default function RekapGuruWaliPage() {
  const router = useRouter();
  const [dataSiswa, setDataSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [kelasOptions, setKelasOptions] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState("Semua");

  const [guruWaliOptions, setGuruWaliOptions] = useState([]);
  const [selectedGuruWali, setSelectedGuruWali] = useState("Semua");

  useEffect(() => {
    loadDataRekap();
  }, []);

  async function loadDataRekap() {
    try {
      setLoading(true);
      const session = getSession();

      if (!session || session.role !== "guru") {
        setError("Sesi guru tidak valid.");
        return;
      }

      // Memanggil ALL agar seluruh siswa & kelas tampil
      const result = await getDataSiswaWali("ALL");

      if (!result.success) {
        setError(result.message || "Gagal mengambil data.");
        return;
      }

      const data = result.data || [];
      setDataSiswa(data);

      const extractedClasses = new Set();
      const extractedGurus = new Set();

      data.forEach((siswa) => {
        // Ekstrak Kelas dari Nama [NAMA_KELAS]
        const match = (siswa.nama || "").match(/\[(.*?)\]/);
        if (match && match[1]) extractedClasses.add(match[1].trim());

        // Ekstrak Nama Guru Wali
        const namaGuruWali = (siswa.namaGuru || "").trim();
        if (namaGuruWali) extractedGurus.add(namaGuruWali);
      });

      setKelasOptions(Array.from(extractedClasses).sort());
      setGuruWaliOptions(Array.from(extractedGurus).sort());
    } catch (err) {
      console.error("ERROR REKAP WALI:", err);
      setError("Terjadi kesalahan sistem.");
    } finally {
      setLoading(false);
    }
  }

  // Filter berdasarkan KELAS dan GURU WALI
  const filteredData = dataSiswa.filter((siswa) => {
    let matchKelas = true;
    if (selectedKelas !== "Semua") {
      const match = (siswa.nama || "").match(/\[(.*?)\]/);
      const kelasSiswa = match ? match[1].trim() : "Tanpa Kelas";
      matchKelas = kelasSiswa === selectedKelas;
    }

    let matchGuru = true;
    if (selectedGuruWali !== "Semua") {
      const namaWaliSiswa = (siswa.namaGuru || "").trim();
      matchGuru = namaWaliSiswa === selectedGuruWali;
    }

    return matchKelas && matchGuru;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-blue-800 border-slate-200"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-red-600 font-bold bg-red-50 min-h-screen">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-2 sm:p-6 font-sans">
      <div className="mx-auto max-w-[1400px]">
        {/* HEADER */}
        <div className="mb-4 sm:mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900 to-blue-700 p-4 sm:p-8 text-white shadow-xl flex flex-col gap-3 relative">
          <button
            onClick={() => router.replace("/magang/guru/guru-wali")}
            className="absolute top-4 right-4 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm"
          >
            ⬅️ Kembali
          </button>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">📊</span>
              <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                Rekap Data
              </span>
            </div>
            <h1 className="text-xl font-black sm:text-3xl">
              Rekap Seluruh Biodata Siswa
            </h1>
            <p className="mt-1.5 text-xs text-blue-100 max-w-2xl">
              Menampilkan data komprehensif dari semua siswa dari semua kelas.
            </p>
          </div>
        </div>

        {/* TOOLBAR FILTER (KELAS & GURU WALI) */}
        <div className="mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            {/* Filter Kelas */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                Filter Kelas:
              </label>
              <select
                value={selectedKelas}
                onChange={(e) => setSelectedKelas(e.target.value)}
                className="flex-1 w-full sm:w-48 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value="Semua">Semua Kelas</option>
                {kelasOptions.map((kls, i) => (
                  <option key={i} value={kls}>
                    {kls}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Guru Wali */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-xs sm:text-sm font-bold text-slate-700 whitespace-nowrap">
                Guru Wali:
              </label>
              <select
                value={selectedGuruWali}
                onChange={(e) => setSelectedGuruWali(e.target.value)}
                className="flex-1 w-full sm:w-48 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs sm:text-sm font-semibold text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none"
              >
                <option value="Semua">Semua Guru Wali</option>
                {guruWaliOptions.map((guru, i) => (
                  <option key={i} value={guru}>
                    {guru}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs sm:text-sm font-bold text-slate-500 bg-slate-100 px-3 py-2 rounded-xl w-full sm:w-auto text-center">
            Total Menampilkan:{" "}
            <span className="text-blue-700">{filteredData.length}</span> Siswa
          </div>
        </div>

        {/* TAMPILAN MOBILE (CARD) */}
        <div className="block lg:hidden space-y-3 pb-8">
          {filteredData.length === 0 ? (
            <div className="text-center p-6 text-slate-500 bg-white rounded-xl shadow-sm border border-slate-200">
              Data siswa tidak ditemukan.
            </div>
          ) : (
            filteredData.map((siswa, idx) => (
              <div
                key={siswa.idSiswa || idx}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4 hover:border-blue-300 transition-all"
              >
                <div className="flex justify-between items-start border-b border-slate-100 pb-2 mb-2">
                  <div className="flex-1 pr-2">
                    <h3 className="font-bold text-blue-900 text-sm">
                      {idx + 1}. {siswa.nama || "-"}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                      ID: {siswa.idSiswa} | Guru Wali:{" "}
                      <span className="text-blue-600">
                        {siswa.namaGuru || "-"}
                      </span>
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                        📞 {siswa.noHp || "-"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <DocumentIndicator url={siswa.fotoProfil} label="FOTO" />
                    <DocumentIndicator url={siswa.ijazahSmp} label="IJAZAH" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="col-span-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="block text-[9px] font-black text-slate-400 uppercase">
                      Tempat, Tgl Lahir & Alamat
                    </span>
                    <span className="font-medium text-[11px] text-slate-700 block">
                      {siswa.tempatLahir ? `${siswa.tempatLahir}, ` : ""}
                      {siswa.tglLahir || "-"}
                    </span>
                    <ExpandableText text={siswa.alamat} maxLength={50} />
                  </div>

                  <div className="p-2 bg-blue-50/50 rounded-lg border border-blue-50">
                    <span className="block text-[9px] font-black text-slate-400 uppercase">
                      Data Ayah
                    </span>
                    <span className="font-bold text-[11px] text-slate-700 block mt-0.5 truncate">
                      {siswa.ayah || "-"}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {siswa.pekerjaanAyah || "-"}
                    </span>
                    <span className="text-[10px] font-medium text-blue-600 block truncate">
                      📞 {siswa.kontakAyah || "-"}
                    </span>
                  </div>

                  <div className="p-2 bg-pink-50/50 rounded-lg border border-pink-50">
                    <span className="block text-[9px] font-black text-slate-400 uppercase">
                      Data Ibu
                    </span>
                    <span className="font-bold text-[11px] text-slate-700 block mt-0.5 truncate">
                      {siswa.ibu || "-"}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {siswa.pekerjaanIbu || "-"}
                    </span>
                    <span className="text-[10px] font-medium text-pink-600 block truncate">
                      📞 {siswa.kontakIbu || "-"}
                    </span>
                  </div>

                  <div className="col-span-2 mt-1">
                    <span className="block text-[9px] font-black text-slate-400 uppercase">
                      Harapan / Cita-cita
                    </span>
                    <p className="text-[11px] font-medium text-slate-700 italic">
                      {siswa.harapan || "-"}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* TAMPILAN DESKTOP (TABEL) */}
        <div className="hidden lg:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh] relative custom-scrollbar">
            <table className="w-full text-left text-[11px] border-collapse whitespace-nowrap">
              <thead className="bg-slate-100 text-slate-600 sticky top-0 z-10 shadow-sm text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-2 font-black border-b sticky left-0 bg-slate-100 z-20 outline outline-1 outline-slate-200">
                    NO
                  </th>
                  <th className="px-3 py-2 font-black border-b sticky left-[40px] bg-slate-100 z-20 outline outline-1 outline-slate-200">
                    NAMA & GURU WALI
                  </th>
                  <th className="px-2 py-2 font-black border-b text-center">
                    FOTO
                  </th>
                  <th className="px-2 py-2 font-black border-b text-center">
                    IJAZAH
                  </th>
                  <th className="px-3 py-2 font-black border-b">NO HP (WA)</th>
                  <th className="px-3 py-2 font-black border-b">TTL</th>
                  <th className="px-3 py-2 font-black border-b">ALAMAT</th>
                  <th className="px-3 py-2 font-black border-b">AYAH & IBU</th>
                  <th className="px-3 py-2 font-black border-b">
                    ANAK KE / HOBI
                  </th>
                  <th className="px-3 py-2 font-black border-b min-w-[150px]">
                    PELAJARAN DISUKAI
                  </th>
                  <th className="px-3 py-2 font-black border-b min-w-[200px]">
                    HARAPAN & CITA-CITA
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td
                      colSpan="11"
                      className="px-4 py-8 text-center text-slate-500 font-medium"
                    >
                      Data siswa tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  filteredData.map((siswa, idx) => (
                    <tr
                      key={siswa.idSiswa || idx}
                      className="hover:bg-blue-50/50 transition-colors group"
                    >
                      <td className="px-3 py-2 border-b sticky left-0 bg-white group-hover:bg-blue-50/50 outline outline-1 outline-slate-100 z-10 font-bold">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2 border-b sticky left-[40px] bg-white group-hover:bg-blue-50/50 outline outline-1 outline-slate-100 z-10">
                        <div className="font-black text-blue-900 text-xs">
                          {siswa.nama || "-"}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 mt-0.5">
                          ID: {siswa.idSiswa} | Wali: {siswa.namaGuru || "-"}
                        </div>
                      </td>

                      <td className="px-2 py-2 border-b align-middle">
                        <DocumentIndicator
                          url={siswa.fotoProfil}
                          label="FOTO"
                        />
                      </td>
                      <td className="px-2 py-2 border-b align-middle">
                        <DocumentIndicator
                          url={siswa.ijazahSmp}
                          label="IJAZAH"
                        />
                      </td>

                      <td className="px-3 py-2 border-b font-bold text-slate-700">
                        {siswa.noHp || "-"}
                      </td>
                      <td className="px-3 py-2 border-b text-slate-700">
                        {siswa.tempatLahir ? `${siswa.tempatLahir}, ` : ""}
                        {siswa.tglLahir || "-"}
                      </td>

                      <td className="px-3 py-2 border-b whitespace-normal min-w-[180px]">
                        <ExpandableText text={siswa.alamat} maxLength={30} />
                      </td>

                      <td className="px-3 py-2 border-b">
                        <div className="text-[10px]">
                          <span className="font-bold text-blue-700">A:</span>{" "}
                          {siswa.ayah || "-"}{" "}
                          <span className="text-slate-400">
                            ({siswa.kontakAyah || "-"})
                          </span>
                          <br />
                          <span className="font-bold text-pink-700">
                            I:
                          </span>{" "}
                          {siswa.ibu || "-"}{" "}
                          <span className="text-slate-400">
                            ({siswa.kontakIbu || "-"})
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-2 border-b text-slate-700">
                        Anak ke: {siswa.anakKe || "-"}
                        <br />
                        Hobi: {siswa.hobi || "-"}
                      </td>

                      <td className="px-3 py-2 border-b whitespace-normal">
                        <span className="font-bold block">
                          {siswa.pelajaranDisukai || "-"}
                        </span>
                        <ExpandableText
                          text={siswa.alasanDisukai}
                          maxLength={40}
                        />
                      </td>

                      <td className="px-3 py-2 border-b whitespace-normal">
                        <ExpandableText text={siswa.harapan} maxLength={50} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `,
        }}
      />
    </div>
  );
}
