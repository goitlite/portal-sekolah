"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  getSemuaSiswaUntukTambahWali,
  simpanSiswaWaliKelas,
  sinkronSiswaWaliKelas,
  addSiswa,
} from "../../../lib/api";

// =====================================================
// MODEL KELAS BAKU
// Dipakai KHUSUS untuk form "Daftarkan Siswa Baru"
// =====================================================
const KELAS_DATA = [
  {
    label: "Kelas X",
    items: [
      { label: "X TJKT 1", val: "X TKJ 1" },
      { label: "X TJKT 2", val: "X TKJ 2" },
      { label: "X DPIB", val: "X DPIB" },
      { label: "X TAV", val: "X TAV" },
      { label: "X GEOMATIKA", val: "X GEOMATIKA" },
      { label: "X TO1", val: "X TO 1" },
      { label: "X TO2", val: "X TO 2" },
      { label: "X TO3", val: "X TO 3" },
      { label: "X TO4", val: "X TO 4" },
      { label: "X TPL", val: "X TPL" },
      { label: "X TITL 1", val: "X TITL 1" },
      { label: "X TITL 2", val: "X TITL 2" },
    ],
  },
  {
    label: "Kelas XI",
    items: [
      { label: "XI TJKT 1", val: "XI TKJ 1" },
      { label: "XI TJKT 2", val: "XI TKJ 2" },
      { label: "XI DPIB", val: "XI DPIB" },
      { label: "XI TAV", val: "XI TAV" },
      { label: "XI GEOMATIKA", val: "XI GEOMATIKA" },
      { label: "XI TBSM 1", val: "XI TBSM 1" },
      { label: "XI TBSM 2", val: "XI TBSM 2" },
      { label: "XI TAB", val: "XI TAB" },
      { label: "XI TKRO", val: "XI TKR" },
      { label: "XI TPL", val: "XI TPL" },
      { label: "XI TITL 1", val: "XI TITL 1" },
      { label: "XI TITL 2", val: "XI TITL 2" },
    ],
  },
  {
    label: "Kelas XII",
    items: [
      { label: "XII TJKT 1", val: "TKJ 1" },
      { label: "XII TJKT 2", val: "TKJ 2" },
      { label: "XII DPIB", val: "DPIB" },
      { label: "XII TAV", val: "TAV" },
      { label: "XII GEOMATIKA", val: "GEOMATIKA" },
      { label: "XII TBSM 1", val: "TBSM 1" },
      { label: "XII TBSM 2", val: "TBSM 2" },
      { label: "XII TAB", val: "TAB" },
      { label: "XII TKRO", val: "TKR" },
      { label: "XII TPL", val: "TPL" },
      { label: "XII TITL", val: "TITL" },
    ],
  },
  {
    label: "Lainnya",
    items: [{ label: "KELAS CONTOH", val: "CONTOH" }],
  },
];

export default function ModalTambahSiswaWali({
  isOpen,
  onClose,
  guru,
  wali,
  onSiswaAdded,
}) {
  const [kandidatSiswa, setKandidatSiswa] = useState([]);
  const [loadingKandidat, setLoadingKandidat] = useState(false);
  const [searchTambah, setSearchTambah] = useState("");
  const [filterKelasTambah, setFilterKelasTambah] = useState("");
  const [menambahId, setMenambahId] = useState(null);
  const [sinkronLoading, setSinkronLoading] = useState(false);

  // Form pendaftaran siswa baru
  const [showFormBaru, setShowFormBaru] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const [kelasBaru, setKelasBaru] = useState(wali?.kelas || "");
  const [savingBaru, setSavingBaru] = useState(false);

  // Proteksi race condition
  const requestIdRef = useRef(0);

  const loadKandidat = useCallback(async () => {
    if (!guru?.id || !wali?.idWali) return;
    const currentRequestId = ++requestIdRef.current;
    setLoadingKandidat(true);
    try {
      const result = await getSemuaSiswaUntukTambahWali(guru.id, wali.idWali);
      if (requestIdRef.current === currentRequestId) {
        const raw = result.success ? result.data || [] : [];
        const normalized = (Array.isArray(raw) ? raw : []).map((s) => ({
          ...s,
          idSiswa: String(s.idSiswa || s.id || s.ID_SISWA || s.ID || ""),
          nama: s.nama || s.namaSiswa || s.NAMA || s.NAMA_SISWA || "",
          kelas: s.kelas || s.KELAS || "",
          namaGuruWaliKelas: s.namaGuruWaliKelas || s.guruWaliKelas || "",
        }));
        setKandidatSiswa(normalized);
      }
    } catch (err) {
      console.error("ERROR LOAD KANDIDAT SISWA WALI:", err);
      if (requestIdRef.current === currentRequestId) {
        setKandidatSiswa([]);
      }
    } finally {
      if (requestIdRef.current === currentRequestId) {
        setLoadingKandidat(false);
      }
    }
  }, [guru?.id, wali?.idWali]);

  useEffect(() => {
    if (isOpen) {
      loadKandidat();
      setKelasBaru(wali?.kelas || "");
      setSearchTambah("");
      setFilterKelasTambah("");
    }
  }, [isOpen, loadKandidat, wali?.kelas]);

  // Pengelompokan filter kelas dinamis
  const { grupKelasTersedia, totalKelasTersedia } = useMemo(() => {
    const uniqueClasses = Array.from(
      new Set(kandidatSiswa.map((s) => (s.kelas || "").trim()).filter(Boolean)),
    ).sort();

    const groups = {
      "Kelas X": [],
      "Kelas XI": [],
      "Kelas XII": [],
    };

    uniqueClasses.forEach((kelas) => {
      const kUpper = kelas.toUpperCase();
      if (kUpper.includes("XII")) {
        groups["Kelas XII"].push(kelas);
      } else if (kUpper.includes("XI")) {
        groups["Kelas XI"].push(kelas);
      } else if (kUpper.includes("X")) {
        groups["Kelas X"].push(kelas);
      } else {
        groups["Kelas XII"].push(kelas);
      }
    });

    return {
      grupKelasTersedia: groups,
      totalKelasTersedia: uniqueClasses.length,
    };
  }, [kandidatSiswa]);

  const kandidatTersaring = useMemo(() => {
    return kandidatSiswa.filter((s) => {
      const q = searchTambah.trim().toLowerCase();
      const cocokNama =
        !q ||
        (s.nama || "").toLowerCase().includes(q) ||
        String(s.idSiswa).toLowerCase().includes(q);
      const cocokKelas = !filterKelasTambah || s.kelas === filterKelasTambah;
      return cocokNama && cocokKelas;
    });
  }, [kandidatSiswa, searchTambah, filterKelasTambah]);

  async function tambahSiswaKeWali(siswa) {
    if (!guru || !wali) return;
    setMenambahId(siswa.idSiswa);
    try {
      const result = await simpanSiswaWaliKelas({
        idGuru: guru.id,
        idWali: wali.idWali,
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
        alert(result.message || "Gagal menambahkan siswa ke kelas wali.");
      }
    } catch (err) {
      console.error("ERROR TAMBAH SISWA WALI:", err);
      alert("Terjadi kesalahan saat menambahkan siswa.");
    } finally {
      setMenambahId(null);
    }
  }

  async function handleSinkron() {
    if (!guru || !wali || (!wali.kelas && !wali.namaKelas)) {
      alert("Data kelas tidak valid untuk disinkronkan.");
      return;
    }
    const targetKelas = wali.kelas || wali.namaKelas;
    const konfirmasi = window.confirm(
      `Sinkronkan seluruh siswa kelas "${targetKelas}" ke kelas wali ini?\n\n` +
        `Siswa yang belum terdaftar di kelas wali lain akan otomatis ditambahkan.`,
    );
    if (!konfirmasi) return;

    try {
      setSinkronLoading(true);
      const result = await sinkronSiswaWaliKelas({
        idGuru: guru.id,
        idWali: wali.idWali,
        kelas: targetKelas,
      });

      if (result.success) {
        const d = result.data || {};
        alert(
          `✅ Sinkron selesai!\n\n` +
            `Ditambahkan: ${d.ditambahkan || 0} siswa\n` +
            `Sudah ada: ${d.sudahAda || 0} siswa\n` +
            `Gagal / diambil wali lain: ${d.gagal || 0} siswa`,
        );
        await loadKandidat();
        if (typeof onSiswaAdded === "function") {
          onSiswaAdded();
        }
      } else {
        alert(result.message || "Gagal melakukan sinkronisasi.");
      }
    } catch (err) {
      console.error("ERROR SINKRON WALI:", err);
      alert("Terjadi kesalahan saat sinkronisasi siswa.");
    } finally {
      setSinkronLoading(false);
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
          "Siswa baru tersimpan di sistem, namun ID tidak terbaca otomatis. Silakan cari namanya di kotak pencarian.",
        );
        setShowFormBaru(false);
        loadKandidat();
        return;
      }

      const hasilEnroll = await simpanSiswaWaliKelas({
        idGuru: guru.id,
        idWali: wali.idWali,
        idSiswa: idBaru,
      });

      if (hasilEnroll.success) {
        alert(
          `✅ Siswa "${namaBaru.trim().toUpperCase()}" berhasil didaftarkan & ditambahkan ke kelas wali ${wali.namaKelas}.`,
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
            "Siswa didaftarkan ke sistem tapi gagal dimasukkan ke kelas wali.",
        );
      }
    } catch (err) {
      console.error("ERROR DAFTAR SISWA BARU WALI:", err);
      alert("Terjadi kesalahan saat mendaftarkan siswa baru.");
    } finally {
      setSavingBaru(false);
    }
  }

  if (!isOpen || !wali) return null;

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
        <div className="shrink-0 bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 px-5 py-4 text-white">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm sm:text-base font-black">
                ➕ Tambah Siswa ke &quot;{wali.namaKelas}&quot;
              </h3>
              {(wali.kelas || wali.namaKelas) && (
                <p className="text-[11px] text-teal-100 font-bold">
                  Kelas: {wali.kelas || wali.namaKelas}
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

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => {
                setNamaBaru(searchTambah);
                setShowFormBaru(true);
              }}
              className="flex-1 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-950 px-3 py-2 text-xs font-black shadow-md transition-all flex items-center justify-center gap-1.5 border border-amber-300"
            >
              <span>➕</span>
              <span>Daftarkan Siswa Tidak Ada di Server</span>
            </button>

            {(wali.kelas || wali.namaKelas) && (
              <button
                onClick={handleSinkron}
                disabled={sinkronLoading}
                className="rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white px-3 py-2 text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 active:scale-95 shrink-0"
              >
                <span>{sinkronLoading ? "⏳" : "🔄"}</span>
                <span>Sinkron Kelas</span>
              </button>
            )}
          </div>

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

          {/* Dropdown Filter Kelas yang Dikelompokkan Dinamis */}
          <div className="mt-2">
            <select
              value={filterKelasTambah}
              onChange={(e) => setFilterKelasTambah(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-800 outline-none shadow-sm focus:ring-2 focus:ring-teal-400 transition-all cursor-pointer"
            >
              <option value="" className="text-slate-800 bg-white font-bold">
                -- Semua Kelas ({totalKelasTersedia}) --
              </option>

              {grupKelasTersedia["Kelas X"].length > 0 && (
                <optgroup
                  label="Kelas X"
                  className="font-bold text-slate-900 bg-slate-100"
                >
                  {grupKelasTersedia["Kelas X"].map((kelas) => (
                    <option
                      key={kelas}
                      value={kelas}
                      className="font-medium text-slate-800 bg-white"
                    >
                      {kelas}
                    </option>
                  ))}
                </optgroup>
              )}

              {grupKelasTersedia["Kelas XI"].length > 0 && (
                <optgroup
                  label="Kelas XI"
                  className="font-bold text-slate-900 bg-slate-100"
                >
                  {grupKelasTersedia["Kelas XI"].map((kelas) => (
                    <option
                      key={kelas}
                      value={kelas}
                      className="font-medium text-slate-800 bg-white"
                    >
                      {kelas}
                    </option>
                  ))}
                </optgroup>
              )}

              {grupKelasTersedia["Kelas XII"].length > 0 && (
                <optgroup
                  label="Kelas XII"
                  className="font-bold text-slate-900 bg-slate-100"
                >
                  {grupKelasTersedia["Kelas XII"].map((kelas) => (
                    <option
                      key={kelas}
                      value={kelas}
                      className="font-medium text-slate-800 bg-white"
                    >
                      {kelas}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>

            {!loadingKandidat && totalKelasTersedia === 0 && (
              <p className="mt-1 text-[10px] text-teal-100/90 font-semibold">
                Belum ada data kelas yang terbaca dari siswa di server.
              </p>
            )}
          </div>
        </div>

        {/* Konten Daftar Siswa */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50 custom-scrollbar">
          {showFormBaru && (
            <div className="rounded-2xl border-2 border-teal-400 bg-teal-50/90 p-4 space-y-3 shadow-sm mb-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-teal-900 flex items-center gap-1.5">
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
                <span className="block text-[10px] font-bold uppercase text-teal-800 mb-1">
                  Nama Lengkap Siswa
                </span>
                <input
                  value={namaBaru}
                  onChange={(e) => setNamaBaru(e.target.value.toUpperCase())}
                  placeholder="Contoh: AHMAD FAUZI"
                  className="w-full rounded-xl border border-teal-300 bg-white px-3 py-2 text-xs font-black text-slate-800 outline-none focus:border-teal-600 uppercase shadow-sm"
                />
              </label>

              <label className="block">
                <span className="block text-[10px] font-bold uppercase text-teal-800 mb-1">
                  Pilih Kelas
                </span>
                <select
                  value={kelasBaru}
                  onChange={(e) => setKelasBaru(e.target.value)}
                  className="w-full rounded-xl border border-teal-300 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-teal-600 shadow-sm cursor-pointer"
                >
                  <option value="" className="text-slate-800 bg-white">
                    -- Pilih kelas --
                  </option>
                  {KELAS_DATA.map((group) => (
                    <optgroup
                      key={group.label}
                      label={group.label}
                      className="font-bold text-slate-900 bg-white"
                    >
                      {group.items.map((opt) => (
                        <option
                          key={opt.val}
                          value={opt.val}
                          className="font-medium text-slate-800 bg-white"
                        >
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={daftarSiswaBaru}
                  disabled={savingBaru}
                  className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-black px-4 py-2.5 disabled:opacity-60 transition-all shadow-md"
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
              <p className="text-[10px] text-teal-800/80 leading-tight">
                Siswa baru akan otomatis dibuatkan akun di sistem dan langsung
                terdaftar pada kelas wali ini.
              </p>
            </div>
          )}

          {loadingKandidat ? (
            <div className="text-center py-10">
              <div className="relative mx-auto h-8 w-8">
                <div className="absolute inset-0 rounded-full border-2 border-teal-200"></div>
                <div className="absolute inset-0 rounded-full border-2 border-teal-600 border-t-transparent animate-spin"></div>
              </div>
              <p className="mt-3 text-xs font-bold text-slate-400">
                Memuat daftar siswa dari server...
              </p>
            </div>
          ) : kandidatTersaring.length > 0 ? (
            kandidatTersaring.map((s) => {
              const sudahDiambil = !!s.namaGuruWaliKelas;
              return (
                <div
                  key={s.idSiswa}
                  className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 shadow-sm transition-all ${
                    sudahDiambil
                      ? "bg-rose-50/70 border-rose-200"
                      : "bg-white border-slate-200 hover:border-teal-300"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-black truncate ${
                        sudahDiambil ? "text-rose-800" : "text-slate-800"
                      }`}
                    >
                      {s.nama}{" "}
                      {s.kelas && (
                        <span className="ml-1 rounded-md bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 text-[9px] font-bold">
                          {s.kelas}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-bold">
                        ID: {s.idSiswa}
                      </span>
                      {sudahDiambil ? (
                        <span className="text-[9px] font-black text-rose-600 bg-rose-100 border border-rose-200 px-2 py-0.2 rounded-full">
                          🔒 Diambil: {s.namaGuruWaliKelas}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-teal-600 bg-teal-50 border border-teal-200 px-2 py-0.2 rounded-full">
                          ✅ Tersedia
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => !sudahDiambil && tambahSiswaKeWali(s)}
                    disabled={sudahDiambil || menambahId === s.idSiswa}
                    title={
                      sudahDiambil
                        ? `Sudah diambil oleh ${s.namaGuruWaliKelas}`
                        : "Tambahkan ke kelas wali"
                    }
                    className={`shrink-0 rounded-xl text-[11px] font-black px-3.5 py-2 transition-all shadow-sm ${
                      sudahDiambil
                        ? "bg-rose-100 text-rose-400 border border-rose-200 cursor-not-allowed"
                        : menambahId === s.idSiswa
                          ? "bg-slate-200 text-slate-500 cursor-wait"
                          : "bg-teal-600 hover:bg-teal-700 active:scale-95 text-white"
                    }`}
                  >
                    {menambahId === s.idSiswa
                      ? "⏳..."
                      : sudahDiambil
                        ? "🔒 Diambil"
                        : "+ Tambah"}
                  </button>
                </div>
              );
            })
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
              Semua siswa dari kelas/pencarian ini sudah terdaftar di kelas
              wali.
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
