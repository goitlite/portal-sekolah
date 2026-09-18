"use client";

import React, { useState, useEffect, useCallback } from "react";
import { getGuru, getMapelByGuru, getPresensiMapelGrid } from "../lib/api";

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
      return "bg-slate-100 text-slate-500 border-slate-200";
  }
}

function formatTanggalMapel(tglStr) {
  if (!tglStr) return "-";
  try {
    const parts = tglStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];
      return `${day} ${months[month] || parts[1]} ${year}`;
    }
    return tglStr;
  } catch (e) {
    return tglStr;
  }
}

export default function ModalKehadiranMapel({ isOpen, onClose, user }) {
  const [loading, setLoading] = useState(false);
  const [mapelList, setMapelList] = useState([]);
  const [selectedMapelId, setSelectedMapelId] = useState(null);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);

  const CACHE_KEY = `cache_mapel_siswa_${user?.id}`;

  const loadDataMapel = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");

    try {
      // 1. Ambil daftar semua guru
      const resGuru = await getGuru();
      const daftarGuru =
        resGuru?.success && Array.isArray(resGuru.data) ? resGuru.data : [];

      if (daftarGuru.length === 0) {
        setMapelList([]);
        return;
      }

      // Ambil kelas siswa dari nama: "Nama Siswa [X TO 1]"
      const namaMentah = String(user?.nama || "");
      const matchKelas = namaMentah.match(/\[(.*?)\]/);
      const kelasSiswa = matchKelas ? matchKelas[1].trim().toLowerCase() : "";

      // 2. Cari mapel dari guru-guru secara paralel
      const mapelPromises = daftarGuru.map(async (g) => {
        try {
          const res = await getMapelByGuru(g.ID || g.id || g.idGuru);
          if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
            return res.data.map((m) => ({
              ...m,
              namaGuru: g.NAMA_GURU || g.nama || "Guru Mapel",
              idGuru: g.ID || g.id || g.idGuru,
            }));
          }
        } catch (e) {}
        return [];
      });

      const hasilSemuaMapel = (await Promise.all(mapelPromises)).flat();

      // 3. Filter mapel yang relevan bagi siswa:
      // Prioritaskan mapel yang kelasnya cocok dengan kelas siswa, atau periksa semua mapel
      const mapelKandidat = hasilSemuaMapel.filter((m) => {
        if (!kelasSiswa) return true;
        const kelasMapel = String(m.kelas || "")
          .trim()
          .toLowerCase();
        return (
          !kelasMapel ||
          kelasMapel === kelasSiswa ||
          kelasSiswa.includes(kelasMapel) ||
          kelasMapel.includes(kelasSiswa)
        );
      });

      // Target mapel yang akan diperiksa presensi grid-nya
      const targetMapelList =
        mapelKandidat.length > 0 ? mapelKandidat : hasilSemuaMapel;

      // 4. Periksa keterdaftaran & presensi siswa di setiap mapel
      const gridPromises = targetMapelList.map(async (m) => {
        try {
          const resGrid = await getPresensiMapelGrid(m.idGuru, m.idMapel);
          if (!resGrid?.success || !resGrid.data) return null;

          const daftarSiswa = resGrid.data.siswa || [];
          const isEnrolled = daftarSiswa.some(
            (s) => String(s.idSiswa).trim() === String(user.id).trim(),
          );

          // Jika siswa terdaftar di mapel ini:
          if (isEnrolled) {
            const presensiSemua = resGrid.data.presensi || [];
            const presensiSaya = presensiSemua.filter(
              (p) => String(p.idSiswa).trim() === String(user.id).trim(),
            );

            // Hitung statistik
            let hadir = 0;
            let sakit = 0;
            let izin = 0;
            let alfa = 0;
            let cabut = 0;
            let totalNilai = 0;
            let jumlahNilaiAda = 0;

            // Kumpulkan per pertemuan
            const pertemuanMap = {};
            presensiSaya.forEach((p) => {
              const pKe = Number(p.pertemuanKe);
              if (pKe) {
                pertemuanMap[pKe] = {
                  pertemuanKe: pKe,
                  tanggal: p.tanggal || "",
                  status: p.status || "-",
                  nilai:
                    p.nilai !== undefined && p.nilai !== "" ? p.nilai : null,
                };

                if (p.status === "Hadir") hadir++;
                else if (p.status === "Sakit") sakit++;
                else if (p.status === "Izin") izin++;
                else if (p.status === "Alfa") alfa++;
                else if (p.status === "Cabut") cabut++;

                if (
                  p.nilai !== null &&
                  p.nilai !== undefined &&
                  p.nilai !== ""
                ) {
                  const val = Number(p.nilai);
                  if (!isNaN(val)) {
                    totalNilai += val;
                    jumlahNilaiAda++;
                  }
                }
              }
            });

            // Urutkan riwayat pertemuan
            const pertemuanList = Object.values(pertemuanMap).sort(
              (a, b) => a.pertemuanKe - b.pertemuanKe,
            );

            const totalPertemuan = pertemuanList.length;
            const persentaseHadir =
              totalPertemuan > 0
                ? Math.round((hadir / totalPertemuan) * 100)
                : 0;
            const rataRataNilai =
              jumlahNilaiAda > 0
                ? Math.round((totalNilai / jumlahNilaiAda) * 10) / 10
                : null;

            return {
              ...m,
              totalPertemuan,
              hadir,
              sakit,
              izin,
              alfa,
              cabut,
              persentaseHadir,
              rataRataNilai,
              pertemuanList,
            };
          }
        } catch (e) {
          console.error("Error cek mapel grid:", m.idMapel, e);
        }
        return null;
      });

      const mapelSiswaDitemukan = (await Promise.all(gridPromises)).filter(
        Boolean,
      );

      setMapelList(mapelSiswaDitemukan);
      if (mapelSiswaDitemukan.length > 0 && !selectedMapelId) {
        setSelectedMapelId(mapelSiswaDitemukan[0].idMapel);
      }

      const syncTime = new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      });
      setLastSync(syncTime);

      // Simpan ke cache
      try {
        localStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ data: mapelSiswaDitemukan, syncTime }),
        );
      } catch (err) {}
    } catch (err) {
      console.error("Gagal memuat mapel siswa:", err);
      setError("Gagal menyinkronkan data mata pelajaran dari server.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.nama, CACHE_KEY, selectedMapelId]);

  useEffect(() => {
    if (isOpen && user?.id) {
      // Baca cache dulu
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed?.data)) {
            setMapelList(parsed.data);
            setLastSync(parsed.syncTime || null);
            if (parsed.data.length > 0) {
              setSelectedMapelId(parsed.data[0].idMapel);
            }
          }
        }
      } catch (e) {}

      loadDataMapel();
    }
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const mapelAktif =
    mapelList.find((m) => m.idMapel === selectedMapelId) || mapelList[0];

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 px-5 py-4 sm:px-6 sm:py-5 text-white">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-amber-400 opacity-10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between gap-3 relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 border border-white/20 text-2xl shadow-inner">
                📚
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-1 border border-amber-400/30">
                  Akademik &middot; Kehadiran Mapel
                </div>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-amber-100">
                  Presensi & Nilai Mata Pelajaran
                </h3>
                <p className="text-[11px] sm:text-xs text-blue-200 font-medium">
                  Pantau kehadiran dan nilai tiap pertemuan yang tercatat oleh
                  Guru Mapel
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadDataMapel}
                disabled={loading}
                title="Sinkronkan data terbaru"
                className="shrink-0 rounded-xl bg-white/10 hover:bg-white/25 px-3 py-1.5 text-xs font-bold text-white transition-all flex items-center gap-1.5 border border-white/20 disabled:opacity-50"
              >
                <span className={loading ? "animate-spin inline-block" : ""}>
                  🔄
                </span>
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                onClick={onClose}
                className="shrink-0 rounded-full bg-white/10 hover:bg-white/25 w-8 h-8 flex items-center justify-center text-xs font-black text-white transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* SUBHEADER: STATUS & TABS */}
        <div className="shrink-0 bg-slate-100/90 border-b border-slate-200 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium overflow-x-auto py-1">
            <span className="font-bold text-slate-700 whitespace-nowrap">
              Mapel Diikuti: ({mapelList.length})
            </span>
            {lastSync && (
              <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline">
                &middot; Terakhir disinkronkan pukul {lastSync} WIB
              </span>
            )}
          </div>
        </div>

        {/* KONTEN UTAMA */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50 space-y-5">
          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {loading && mapelList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="relative h-12 w-12 mb-3">
                <div className="absolute inset-0 rounded-full border-3 border-blue-200" />
                <div className="absolute inset-0 rounded-full border-3 border-blue-600 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm font-bold text-slate-700">
                Menyinkronkan Daftar Mapel...
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Mencocokkan kelas dan kehadiran siswa dari guru mata pelajaran
              </p>
            </div>
          ) : mapelList.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center shadow-sm">
              <div className="text-5xl mb-3">📖</div>
              <h4 className="text-base font-black text-slate-800 mb-1">
                Belum Terdaftar di Mata Pelajaran
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-4">
                Guru Mapel belum menambahkan kamu ke dalam daftar rombel mata
                pelajaran mereka, atau belum ada jadwal presensi yang dibuka.
              </p>
              <button
                onClick={loadDataMapel}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-all active:scale-95"
              >
                🔄 Periksa Ulang Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* PILIHAN MAPEL (CHIPS/TABS) */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {mapelList.map((m) => {
                  const isSelected = m.idMapel === mapelAktif?.idMapel;
                  return (
                    <button
                      key={m.idMapel}
                      onClick={() => setSelectedMapelId(m.idMapel)}
                      className={`shrink-0 rounded-2xl px-4 py-2.5 text-left transition-all border ${
                        isSelected
                          ? "bg-gradient-to-r from-blue-700 to-indigo-800 text-white border-blue-600 shadow-md scale-[1.02]"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">📖</span>
                        <div>
                          <div className="text-xs sm:text-sm font-black leading-tight">
                            {m.namaMapel}
                          </div>
                          <div
                            className={`text-[10px] font-medium mt-0.5 ${isSelected ? "text-blue-200" : "text-slate-400"}`}
                          >
                            {m.namaGuru} &middot; {m.kelas || "Semua"}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* CARD DETAIL MAPEL AKTIF */}
              {mapelAktif && (
                <div className="rounded-3xl bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
                  {/* HEADER MAPEL */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-lg sm:text-xl font-black text-slate-800">
                          {mapelAktif.namaMapel}
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black uppercase tracking-wider">
                          Kelas {mapelAktif.kelas || "-"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Guru Pengampu:{" "}
                        <strong className="text-slate-700">
                          {mapelAktif.namaGuru}
                        </strong>
                      </p>
                      {mapelAktif.keterangan && (
                        <p className="text-[11px] text-slate-400 italic mt-0.5">
                          {mapelAktif.keterangan}
                        </p>
                      )}
                    </div>

                    {/* RATA-RATA NILAI */}
                    <div className="flex items-center gap-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-3 sm:px-4 sm:py-2.5 shrink-0">
                      <div className="text-2xl">🏆</div>
                      <div>
                        <span className="block text-[10px] font-black uppercase tracking-wider text-amber-700">
                          Rata-rata Nilai
                        </span>
                        <span className="text-lg sm:text-xl font-black text-amber-900">
                          {mapelAktif.rataRataNilai !== null
                            ? mapelAktif.rataRataNilai
                            : "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* GRID STATISTIK KEHADIRAN MAPEL */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-0.5">
                        Hadir
                      </span>
                      <span className="text-xl font-black text-emerald-800">
                        {mapelAktif.hadir}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-blue-50 border border-blue-200 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 block mb-0.5">
                        Sakit
                      </span>
                      <span className="text-xl font-black text-blue-800">
                        {mapelAktif.sakit}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block mb-0.5">
                        Izin
                      </span>
                      <span className="text-xl font-black text-amber-800">
                        {mapelAktif.izin}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 block mb-0.5">
                        Alfa
                      </span>
                      <span className="text-xl font-black text-rose-800">
                        {mapelAktif.alfa}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-purple-50 border border-purple-200 p-3 text-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block mb-0.5">
                        Cabut
                      </span>
                      <span className="text-xl font-black text-purple-800">
                        {mapelAktif.cabut}
                      </span>
                    </div>

                    <div className="rounded-2xl bg-indigo-50 border border-indigo-200 p-3 text-center col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block mb-0.5">
                        % Kehadiran
                      </span>
                      <span className="text-xl font-black text-indigo-800">
                        {mapelAktif.persentaseHadir}%
                      </span>
                    </div>
                  </div>

                  {/* DAFTAR PERTEMUAN */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider">
                        📅 Riwayat Pertemuan (
                        {mapelAktif.pertemuanList?.length || 0})
                      </h5>
                    </div>

                    {!mapelAktif.pertemuanList ||
                    mapelAktif.pertemuanList.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400 font-medium">
                        Belum ada pertemuan presensi yang tercatat untuk mapel
                        ini.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {mapelAktif.pertemuanList.map((item) => (
                          <div
                            key={item.pertemuanKe}
                            className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/80 border border-slate-200 hover:bg-slate-100/80 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700 shadow-sm">
                                P{item.pertemuanKe}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">
                                  Pertemuan {item.pertemuanKe}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">
                                  {formatTanggalMapel(item.tanggal)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {item.nilai !== null &&
                                item.nilai !== undefined && (
                                  <span className="px-2.5 py-1 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 text-xs font-black shadow-xs">
                                    ⭐ {item.nilai}
                                  </span>
                                )}
                              <span
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-black border shadow-xs ${warnaStatus(
                                  item.status,
                                )}`}
                              >
                                {item.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4 flex items-center justify-between">
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
            Data disinkronkan dengan aplikasi Presensi & Jurnal Guru Mapel
          </p>
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-black px-5 py-2.5 shadow-sm transition-all active:scale-95"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
