"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

import { getSession, isLoggedIn } from "../../lib/auth";
import { getSiswaById, editSiswa, getTempatMagangGuru } from "../../lib/api";

export default function EditSiswaPage() {
  const router = useRouter();
  const params = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guru, setGuru] = useState(null);

  // State Form Siswa
  const [idSiswa, setIdSiswa] = useState("");
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("TJKT 1");
  const [tempatMagang, setTempatMagang] = useState("");
  const [status, setStatus] = useState("BELUM_MAGANG"); // Menggunakan format underscore

  // State Modal Tempat Magang
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState([]);
  const [inputTempatBaru, setInputTempatBaru] = useState("");

  const [daftarTempatDb, setDaftarTempatDb] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // =========================================================
  // LOGIN / SESSION & FETCH DATA SISWA
  // =========================================================
  useEffect(() => {
    async function loadData() {
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

      const storedPlaces = localStorage.getItem("recentTempatMagang");
      if (storedPlaces) {
        try {
          setRecentPlaces(JSON.parse(storedPlaces));
        } catch (e) {
          console.error("Gagal membaca history", e);
        }
      }

      try {
        const result = await getSiswaById(params.id);
        if (!result.success) {
          alert(result.message);
          router.push("/magang/siswa");
          return;
        }

        const data = result.data;
        setIdSiswa(data.ID || data.id || "");

        // Ekstrak Nama dan Kelas
        const rawName = data.NAMA || data.nama || "";
        const match = rawName.match(/(.+?)\s*\[(.*?)\]/);

        if (match) {
          setNama(match[1].trim().toUpperCase());
          setKelas(match[2].trim());
        } else {
          setNama(rawName.toUpperCase());
        }

        // Setup Tempat & Status Sesuai Logika TambahSiswaWali
        const rawTempat =
          data.TEMPAT_MAGANG || data.tempatMagang || data.TEMPAT || "";
        let rawStatus = String(
          data.STATUS_MAGANG || data.STATUS || data.status || "",
        ).toUpperCase();
        rawStatus = rawStatus.replace(" ", "_"); // Normalisasi ke format underscore

        if (
          rawStatus === "MAGANG" ||
          (rawStatus === "" && rawTempat.trim() !== "")
        ) {
          setStatus("MAGANG");
          setTempatMagang(rawTempat);
        } else {
          setStatus("BELUM_MAGANG");
          setTempatMagang("");
        }
      } catch (err) {
        console.error(err);
        alert("Gagal mengambil data siswa.");
      }
      setLoading(false);
    }

    loadData();
  }, [params.id, router]);

  // =========================================================
  // LOGIKA TEMPAT MAGANG & MODAL (SAMA PERSIS DENGAN TAMBAH SISWA)
  // =========================================================
  useEffect(() => {
    if (isModalOpen && guru?.id) {
      fetchTempatMagangDb();
    }
  }, [isModalOpen, guru]);

  async function fetchTempatMagangDb() {
    setLoadingDb(true);
    try {
      const res = await getTempatMagangGuru(guru.id);

      if (res.success && res.data) {
        const rawArray = Array.isArray(res.data) ? res.data : [res.data];
        const normalizedData = rawArray
          .map((item) => {
            if (!item) return "";
            if (typeof item === "object") {
              return item.tempat || item.TEMPAT || item.nama || "";
            }
            return String(item);
          })
          .filter((item) => typeof item === "string" && item.trim() !== "");

        setDaftarTempatDb([...new Set(normalizedData)]);
      } else {
        setDaftarTempatDb([]);
      }
    } catch (error) {
      console.error("Gagal menarik data tempat magang", error);
      setDaftarTempatDb([]);
    }
    setLoadingDb(false);
  }

  const saveToLocalStorage = (newPlace) => {
    if (!newPlace) return;
    let currentPlaces = [...recentPlaces].filter((p) => p !== newPlace);
    currentPlaces.unshift(newPlace);
    if (currentPlaces.length > 8) currentPlaces = currentPlaces.slice(0, 8);
    setRecentPlaces(currentPlaces);
    localStorage.setItem("recentTempatMagang", JSON.stringify(currentPlaces));
  };

  const handlePilihTempat = (place) => {
    setTempatMagang(place);
    setStatus("MAGANG");
    setIsModalOpen(false);
  };

  const handleGunakanTempatBaru = () => {
    if (inputTempatBaru.trim() === "") return;
    const tempat = inputTempatBaru.trim().toUpperCase();
    setTempatMagang(tempat);
    setStatus("MAGANG");
    saveToLocalStorage(tempat);
    setInputTempatBaru("");
    setIsModalOpen(false);
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    if (newStatus === "BELUM_MAGANG") {
      setTempatMagang("");
    }
  };

  // =========================================================
  // SIMPAN PERUBAHAN
  // =========================================================
  async function simpan() {
    if (nama.trim() === "") {
      alert("Nama siswa belum diisi.");
      return;
    }

    if (status === "MAGANG" && tempatMagang.trim() === "") {
      alert("Silakan pilih tempat magang terlebih dahulu.");
      return;
    }

    setSaving(true);
    try {
      const namaSiswaDenganKelas = `${nama.trim()} [${kelas}]`;

      // Menyamakan Payload seperti addSiswa di TambahSiswaWali
      const result = await editSiswa({
        id: idSiswa,
        nama: namaSiswaDenganKelas,
        namaGuru: guru.nama,
        tempatMagang: status === "MAGANG" ? tempatMagang : "",
        status: status,
        statusMagang: status, // Fallback untuk memastikan backend menangkap parameter
      });

      if (result.success) {
        if (status === "MAGANG" && tempatMagang) {
          saveToLocalStorage(tempatMagang);
        }
        alert("Data siswa berhasil diperbarui.");
        router.push("/magang/siswa");
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan.");
    }
    setSaving(false);
  }

  // =========================================================
  // UI LOADING
  // =========================================================
  if (loading || !guru) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center justify-center text-slate-500">
          <div className="relative h-12 w-12 sm:h-14 sm:w-14">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
          </div>
          <p className="mt-4 font-semibold text-sm">Memuat data siswa...</p>
        </div>
      </main>
    );
  }

  // =========================================================
  // UI UTAMA
  // =========================================================
  return (
    <main className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 flex flex-col relative">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg border-b border-blue-700/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white/10 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={36}
                height={36}
                className="object-contain sm:w-[44px] sm:h-[44px]"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                EDIT SISWA
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300 tracking-wide mt-0.5">
                Guru: {guru?.nama || "Memuat..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.back()}
            className="rounded-lg sm:rounded-xl bg-white/10 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm"
          >
            Kembali
          </button>
        </div>
      </header>

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="mb-6 sm:mb-8 border-b border-slate-100 pb-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
              Pembaruan Data
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Edit Formulir Siswa
            </h2>
            <p className="mt-1 text-slate-500 font-medium text-sm">
              Perbarui informasi nama, kelas, tempat, atau status magang siswa
              di bawah ini.
            </p>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                ID Siswa
              </label>
              <input
                type="text"
                value={idSiswa}
                disabled
                className="w-full rounded-xl border border-slate-200 bg-slate-100 p-3 sm:p-3.5 text-sm sm:text-base text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                Nama Lengkap
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value.toUpperCase())}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                placeholder="MASUKKAN NAMA SISWA..."
              />
            </div>

            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                Kelas
              </label>
              <div className="relative">
                <select
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 pr-10 text-sm sm:text-base text-slate-900 font-medium focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
                >
                  <option value="X TKJ 1">X TJKT 1</option>
                  <option value="X TKJ 2">X TJKT 2</option>
                  <option value="X DPIB">X DPIB</option>
                  <option value="X TAV">X TAV</option>
                  <option value="X GEOMATIKA">X GEOMATIKA</option>
                  <option value="X TO 1">X TO1</option>
                  <option value="X TO 2">X TO2</option>
                  <option value="X TO 3">X TO3</option>
                  <option value="X TO 4">X TO4</option>
                  <option value="X TPL">X TPL</option>
                  <option value="X TITL 1">X TITL 1</option>
                  <option value="X TITL 2">X TITL 2</option>

                  <option value="XI TKJ 1">XI TJKT 1</option>
                  <option value="XI TKJ 2">XI TJKT 2</option>
                  <option value="XI DPIB">XI DPIB</option>
                  <option value="XI TAV">XI TAV</option>
                  <option value="XI GEOMATIKA">XI GEOMATIKA</option>
                  <option value="XI TBSM 1">XI TBSM 1</option>
                  <option value="XI TBSM 2">XI TBSM 2</option>
                  <option value="XI TAB">XI TAB</option>
                  <option value="XI TKR">XI TKRO</option>
                  <option value="XI TPL">XI TPL</option>
                  <option value="XI TITL 1">XI TITL 1</option>
                  <option value="XI TITL 2">XI TITL 2</option>

                  <option value="TKJ 1">XII TJKT 1</option>
                  <option value="TKJ 2">XII TJKT 2</option>
                  <option value="DPIB">XII DPIB</option>
                  <option value="TAV">XII TAV</option>
                  <option value="GEOMATIKA">XII GEOMATIKA</option>
                  <option value="TBSM 1">XII TBSM 1</option>
                  <option value="TBSM 2">XII TBSM 2</option>
                  <option value="TAB">XII TAB</option>
                  <option value="TKR">XII TKRO</option>
                  <option value="TPL">XII TPL</option>
                  <option value="TITL">XII TITL</option>
                  <option value="TJKT 1">XII TJKT CONTOH</option>
                  <option value="TJKT 2">XII TJKT CONTOH</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg
                    className="h-4 w-4 fill-current"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* STATUS SISWA MENGGUNAKAN DUA TOMBOL (SEPERTI TAMBAH SISWA) */}
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                Status Siswa
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleStatusChange("BELUM_MAGANG")}
                  className={`rounded-xl border-2 p-3 sm:p-4 text-sm font-bold transition-all ${
                    status === "BELUM_MAGANG"
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <div className="text-lg mb-1">🎓</div>
                  BELUM MAGANG
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus("MAGANG");
                    if (!tempatMagang) setIsModalOpen(true);
                  }}
                  className={`rounded-xl border-2 p-3 sm:p-4 text-sm font-bold transition-all ${
                    status === "MAGANG"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <div className="text-lg mb-1">🏢</div>
                  MAGANG
                </button>
              </div>
            </div>

            {/* TEMPAT MAGANG: HANYA DITAMPILKAN JIKA STATUS = MAGANG */}
            {status === "MAGANG" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block mb-1.5 text-sm font-bold text-slate-700">
                  Tempat Magang (DUDI)
                </label>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="w-full text-left rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 text-sm sm:text-base focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all flex items-center justify-between group hover:bg-slate-100"
                >
                  <span
                    className={
                      tempatMagang
                        ? "text-slate-900 font-medium"
                        : "text-slate-400"
                    }
                  >
                    {tempatMagang ? tempatMagang : "📍 Pilih Tempat Magang"}
                  </span>
                  <span className="text-slate-400 group-hover:text-blue-500 transition-colors">
                    ▼
                  </span>
                </button>
              </div>
            )}

            {/* INFO JIKA BELUM MAGANG */}
            {status === "BELUM_MAGANG" && (
              <div className="animate-in fade-in duration-200 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <div className="text-xl">ℹ️</div>
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      Siswa belum magang
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Tempat magang tidak dicatat. Status dapat diubah menjadi
                      MAGANG jika siswa sudah memiliki tempat magang.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => router.push("/magang/siswa")}
              className="w-full sm:w-1/3 rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all text-center"
            >
              Batal
            </button>
            <button
              onClick={simpan}
              disabled={saving}
              className="w-full sm:w-2/3 group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Menyimpan Data...
                </>
              ) : (
                <>
                  <span className="text-lg leading-none">💾</span>
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MODAL TEMPAT MAGANG (PERSIS TAMBAH SISWA) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-opacity p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-base sm:text-lg font-bold text-slate-800">
                Pilih Tempat Magang
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 rounded-full p-1.5 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-8 flex-1">
              <div>
                <h4 className="text-sm font-bold text-slate-700 flex items-center gap-1.5 mb-3">
                  <span>⭐</span> Terakhir Digunakan
                </h4>
                {recentPlaces.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recentPlaces.map((place, idx) => (
                      <button
                        key={idx}
                        onClick={() => handlePilihTempat(place)}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs sm:text-sm font-medium border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-colors text-left"
                      >
                        {place}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-dashed border-slate-200">
                    Belum ada riwayat tempat magang tersimpan di perangkat ini.
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-700 flex items-center justify-between mb-3">
                  <span className="flex items-center gap-1.5">
                    🔍 Daftar dari Database
                  </span>
                  {daftarTempatDb.length > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      {daftarTempatDb.length} Lokasi
                    </span>
                  )}
                </h4>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  placeholder="Cari / Filter tempat magang..."
                  className="w-full mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all"
                />

                {loadingDb ? (
                  <div className="p-6 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2"></div>
                    <p className="text-xs font-medium text-slate-500">
                      Mengambil data dari server...
                    </p>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {daftarTempatDb.length > 0 ? (
                      daftarTempatDb
                        .filter((item) =>
                          String(item).toUpperCase().includes(searchQuery),
                        )
                        .map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handlePilihTempat(String(item))}
                            className="w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 text-sm font-medium text-slate-700 border border-slate-100 transition-all flex items-center justify-between group"
                          >
                            <span className="truncate pr-2">
                              {String(item)}
                            </span>
                            <span className="text-[10px] text-blue-600 opacity-0 group-hover:opacity-100 font-bold bg-blue-100 px-2 py-1 rounded-md shrink-0">
                              Pilih
                            </span>
                          </button>
                        ))
                    ) : (
                      <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-sm font-medium text-slate-500">
                          Belum ada data DUDI
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Tempat yang diketik akan otomatis masuk database.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-slate-700 mb-3">
                  Atau ketik tempat magang baru
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={inputTempatBaru}
                    onChange={(e) =>
                      setInputTempatBaru(e.target.value.toUpperCase())
                    }
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="CONTOH: PT MAJU BERSAMA"
                  />
                  <button
                    onClick={handleGunakanTempatBaru}
                    disabled={inputTempatBaru.trim() === ""}
                    className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Gunakan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
