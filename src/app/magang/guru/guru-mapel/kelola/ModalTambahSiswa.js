"use client";

import { useState, useEffect } from "react";
import {
  getSemuaSiswaUntukTambahMapel,
  simpanSiswaMapel,
  addSiswa,
} from "../../../lib/api";

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

export default function ModalTambahSiswa({
  isOpen,
  onClose,
  guru,
  mapel,
  onSiswaAdded,
}) {
  const [kandidatSiswa, setKandidatSiswa] = useState([]);
  const [loadingKandidat, setLoadingKandidat] = useState(false);
  const [searchTambah, setSearchTambah] = useState("");
  const [filterKelasTambah, setFilterKelasTambah] = useState("");
  const [menambahId, setMenambahId] = useState(null);

  const [showFormBaru, setShowFormBaru] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const [kelasBaru, setKelasBaru] = useState(mapel?.kelas || "");
  const [savingBaru, setSavingBaru] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      if (!guru?.id || !mapel?.idMapel) return;
      setLoadingKandidat(true);
      try {
        const result = await getSemuaSiswaUntukTambahMapel(
          guru.id,
          mapel.idMapel,
        );
        if (!ignore) {
          setKandidatSiswa(result.success ? result.data || [] : []);
        }
      } catch (err) {
        console.error("ERROR LOAD KANDIDAT SISWA:", err);
        if (!ignore) setKandidatSiswa([]);
      } finally {
        if (!ignore) setLoadingKandidat(false);
      }
    }

    if (isOpen && guru?.id && mapel?.idMapel) {
      loadData();
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, guru?.id, mapel?.idMapel]);

  async function loadKandidat() {
    if (!guru?.id || !mapel?.idMapel) return;
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
        setKandidatSiswa((prev) =>
          prev.filter((s) => s.idSiswa !== siswa.idSiswa),
        );
        if (typeof onSiswaAdded === "function") {
          onSiswaAdded(siswa);
        }
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
          "Siswa baru tersimpan di sistem, tapi ID tidak terbaca otomatis. Silakan cari namanya di kotak pencarian untuk memasukkannya ke mapel ini.",
        );
        setShowFormBaru(false);
        loadKandidat();
        return;
      }

      const hasilEnroll = await simpanSiswaMapel({
        idGuru: guru.id,
        idMapel: mapel.idMapel,
        idSiswa: idBaru,
      });

      if (hasilEnroll.success) {
        alert(
          `✅ Siswa "${namaBaru.trim().toUpperCase()}" berhasil didaftarkan & ditambahkan ke mapel ${mapel.namaMapel}.`,
        );
        setNamaBaru("");
        setShowFormBaru(false);
        setSearchTambah("");
        if (typeof onSiswaAdded === "function") {
          onSiswaAdded({
            idSiswa: idBaru,
            nama: namaBaru.trim().toUpperCase(),
            kelas: kelasBaru,
          });
        }
        loadKandidat();
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

  if (!isOpen || !mapel) return null;

  const kandidatTersaring = kandidatSiswa.filter((s) => {
    const cocokNama = (s.nama || "")
      .toLowerCase()
      .includes(searchTambah.toLowerCase());
    const cocokKelas = !filterKelasTambah || s.kelas === filterKelasTambah;
    return cocokNama && cocokKelas;
  });

  const tidakDitemukan =
    !loadingKandidat &&
    searchTambah.trim() !== "" &&
    kandidatTersaring.length === 0;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        {/* Header Modal */}
        <div className="shrink-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black">
                ➕ Tambah Siswa ke &quot;{mapel.namaMapel}&quot;
              </h3>
              {mapel.kelas && (
                <p className="text-[11px] text-emerald-100 font-bold">
                  Kelas Terpilih: {mapel.kelas}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 hover:bg-white/35 w-8 h-8 flex items-center justify-center text-xs font-black transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Tombol Baru di Atas: Daftarkan Siswa yang Tidak Ada di Server */}
          <button
            onClick={() => {
              setNamaBaru(searchTambah);
              setShowFormBaru(true);
            }}
            className="w-full rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-950 px-4 py-2.5 text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 border border-amber-300"
          >
            <span>➕</span>
            <span>Daftarkan Siswa yang Tidak Ada di Server</span>
          </button>

          {/* Kolom Pencarian Nama Siswa */}
          <div className="mt-3">
            <input
              type="text"
              value={searchTambah}
              onChange={(e) => {
                setSearchTambah(e.target.value);
                setShowFormBaru(false);
              }}
              placeholder="Cari nama siswa di server..."
              className="w-full rounded-xl border border-white/40 bg-white/15 placeholder-white/70 px-4 py-2 text-xs sm:text-sm font-bold text-white outline-none focus:bg-white/25 transition-colors shadow-inner"
            />
          </div>

          {/* Dropdown Filter Kelas (TEKS HITAM JELAS & TERBACA) */}
          <div className="mt-2">
            <select
              value={filterKelasTambah}
              onChange={(e) => setFilterKelasTambah(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none shadow-sm focus:ring-2 focus:ring-emerald-400 transition-all cursor-pointer"
            >
              <option value="" className="text-slate-800 bg-white font-bold">
                -- Semua Kelas --
              </option>
              {KELAS_OPTIONS}
            </select>
          </div>
        </div>

        {/* Konten Daftar Siswa */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
          {/* Form Pendaftaran Siswa Baru (Muncul jika tombol atas / tidak ditemukan diklik) */}
          {showFormBaru && (
            <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/90 p-4 space-y-3 shadow-sm mb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                  📝 Daftarkan Siswa Baru (Tidak Ada di Server)
                </p>
                <button
                  onClick={() => setShowFormBaru(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 font-bold"
                >
                  ✕ Tutup
                </button>
              </div>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase text-emerald-800 mb-1">
                  Nama Lengkap Siswa
                </span>
                <input
                  value={namaBaru}
                  onChange={(e) => setNamaBaru(e.target.value.toUpperCase())}
                  placeholder="Contoh: AHMAD FAUZI"
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-emerald-600 uppercase shadow-sm"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase text-emerald-800 mb-1">
                  Pilih Kelas
                </span>
                <select
                  value={kelasBaru}
                  onChange={(e) => setKelasBaru(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 shadow-sm cursor-pointer"
                >
                  <option value="" className="text-slate-800 bg-white">
                    -- Pilih kelas --
                  </option>
                  {KELAS_OPTIONS}
                </select>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={daftarSiswaBaru}
                  disabled={savingBaru}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black px-4 py-2.5 disabled:opacity-60 transition-all shadow-md"
                >
                  {savingBaru
                    ? "Menyimpan ke Server..."
                    : "💾 Simpan & Tambahkan"}
                </button>
                <button
                  onClick={() => setShowFormBaru(false)}
                  className="rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold px-4 py-2.5 transition-colors"
                >
                  Batal
                </button>
              </div>
              <p className="text-[10px] text-emerald-800/80 leading-tight">
                Siswa baru akan otomatis dibuatkan akun di sistem dan langsung
                terdaftar pada mapel ini.
              </p>
            </div>
          )}

          {loadingKandidat ? (
            <div className="text-center py-10">
              <div className="relative mx-auto h-8 w-8">
                <div className="absolute inset-0 rounded-full border-2 border-emerald-200"></div>
                <div className="absolute inset-0 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-3 text-xs font-bold text-slate-400">
                Memuat daftar siswa dari server...
              </p>
            </div>
          ) : kandidatTersaring.length > 0 ? (
            kandidatTersaring.map((s) => (
              <div
                key={s.idSiswa}
                className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm hover:border-emerald-300 transition-all"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-800 truncate">
                    {s.nama}{" "}
                    {s.kelas && (
                      <span className="ml-1 rounded-md bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold">
                        {s.kelas}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {s.namaGuruWali
                      ? `Wali: ${s.namaGuruWali}`
                      : "Belum ada Guru Wali"}
                  </p>
                </div>
                <button
                  onClick={() => tambahSiswaKeMapel(s)}
                  disabled={menambahId === s.idSiswa}
                  className="shrink-0 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[11px] font-black px-3.5 py-2 disabled:opacity-60 transition-all shadow-sm"
                >
                  {menambahId === s.idSiswa ? "⏳..." : "+ Tambah"}
                </button>
              </div>
            ))
          ) : tidakDitemukan ? (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center">
              <p className="text-xs font-bold text-amber-800 mb-2">
                Siswa &quot;{searchTambah}&quot; tidak ditemukan di server.
              </p>
              <button
                onClick={() => {
                  setNamaBaru(searchTambah);
                  setShowFormBaru(true);
                }}
                className="rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black px-4 py-2.5 transition-colors shadow-sm"
              >
                ➕ Daftarkan Siswa Ini ke Server
              </button>
            </div>
          ) : (
            <p className="text-center text-xs font-bold text-slate-400 py-10">
              Semua siswa dari kelas/pencarian ini sudah terdaftar di mapel.
            </p>
          )}
        </div>

        {/* Footer Modal */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 flex items-center justify-between text-[11px] text-slate-500">
          <span>{kandidatTersaring.length} siswa ditemukan</span>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2 font-bold transition-colors"
          >
            Selesai / Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
