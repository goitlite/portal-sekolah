"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

import { getSession, isLoggedIn } from "../../../lib/auth";
import {
  addSiswa,
  getTempatMagangGuru,
  getSiswa,
  getGuru,
} from "../../../lib/api";

export default function TambahSiswaWaliPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams?.get("editId");
  const editKelas = searchParams?.get("kelas");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guru, setGuru] = useState(null);

  // =========================================================
  // STATE TAB & DATA SISWA SPREADSHEET
  // =========================================================
  const [activeTab, setActiveTab] = useState(1);
  const [dataSiswaSpreadsheet, setDataSiswaSpreadsheet] = useState([]);
  const [loadingDataSiswa, setLoadingDataSiswa] = useState(false);

  // State Form Tab 1
  const [pilihSiswaId, setPilihSiswaId] = useState("");

  // State Form Umum
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("TJKT 1");
  const [status, setStatus] = useState("BELUM_MAGANG");
  const [tempatMagang, setTempatMagang] = useState("");

  // State Guru Otomatis
  const [pilihGuruPembimbing, setPilihGuruPembimbing] = useState("");
  const [namaGuruPembimbing, setNamaGuruPembimbing] = useState("");

  const [daftarGuru, setDaftarGuru] = useState([]);
  const [modeGantiGuru, setModeGantiGuru] = useState(false);

  // Modal tempat magang
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState([]);
  const [inputTempatBaru, setInputTempatBaru] = useState("");
  const [daftarTempatDb, setDaftarTempatDb] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // =========================================================
  // LOGIN / SESSION & FETCH DATA
  // =========================================================
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
    setLoading(false);

    const storedPlaces = localStorage.getItem("recentTempatMagang");
    if (storedPlaces) {
      try {
        setRecentPlaces(JSON.parse(storedPlaces));
      } catch (error) {
        console.error("Gagal membaca history tempat magang", error);
      }
    }

    async function fetchMasterSiswa() {
      setLoadingDataSiswa(true);
      try {
        if (typeof getSiswa === "function") {
          const res = await getSiswa();
          if (res.success) {
            setDataSiswaSpreadsheet(res.data);
          }
        }
      } catch (error) {
        console.error("Gagal menarik data siswa spreadsheet", error);
      }
      setLoadingDataSiswa(false);
    }

    async function fetchMasterGuru() {
      try {
        if (typeof getGuru === "function") {
          const res = await getGuru();
          if (res.success && res.data) {
            const mappedGuru = res.data.map((g) => ({
              id: g.id || g.ID || g.id_guru || g.ID_GURU,
              nama: g.namaGuru || g.NAMA_GURU || g.nama || g.NAMA,
            }));
            setDaftarGuru(mappedGuru);
          }
        }
      } catch (error) {
        console.error("Gagal menarik data guru", error);
      }
    }

    fetchMasterSiswa();
    fetchMasterGuru();
  }, [router]);

  // =========================================================
  // EFEK AUTO-FILL DARI TOMBOL "EDIT DATA"
  // =========================================================
  useEffect(() => {
    if (editId && dataSiswaSpreadsheet.length > 0) {
      setActiveTab(1);

      if (editKelas) {
        setKelas(editKelas);
      }

      setPilihSiswaId(editId);

      const student = dataSiswaSpreadsheet.find(
        (s) => String(s.id || s.ID) === String(editId),
      );

      if (student) {
        const rawNama = student.nama || student.NAMA || "";
        const bersihNama = rawNama.replace(/\[.*?\]/g, "").trim();
        setNama(bersihNama);

        const extractedIdGuru =
          student.idGuru || student.ID_GURU || student["ID GURU"] || "";
        const extractedNamaGuru =
          student.namaGuru || student.NAMA_GURU || student["NAMA GURU"] || "";

        setPilihGuruPembimbing(extractedIdGuru);
        setNamaGuruPembimbing(extractedNamaGuru);

        const rawStatus = String(
          student.status || student.STATUS || "",
        ).toUpperCase();
        const rawTempat =
          student.tempatMagang ||
          student.TEMPAT_MAGANG ||
          student.tempat ||
          student.TEMPAT ||
          "";

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
      }
    }
  }, [editId, editKelas, dataSiswaSpreadsheet]);

  // =========================================================
  // FILTERING & SORTING SISWA BERDASARKAN KELAS
  // =========================================================
  const siswaFiltered = (dataSiswaSpreadsheet || [])
    .filter((s) => {
      const namaLengkap = String(s.nama || s.NAMA || "").toUpperCase();
      const targetKelas = `[${kelas.toUpperCase()}]`;
      return namaLengkap.includes(targetKelas);
    })
    .sort((a, b) => {
      const namaA = String(a.nama || a.NAMA || "");
      const namaB = String(b.nama || b.NAMA || "");
      return namaA.localeCompare(namaB);
    });

  const handlePilihSiswa = (e) => {
    const selectedId = e.target.value;
    setPilihSiswaId(selectedId);

    const student = siswaFiltered.find(
      (s) => String(s.id || s.ID) === String(selectedId),
    );

    if (student) {
      const rawNama = student.nama || student.NAMA || "";
      const bersihNama = rawNama.replace(/\[.*?\]/g, "").trim();
      setNama(bersihNama);

      const extractedIdGuru =
        student.idGuru || student.ID_GURU || student["ID GURU"] || "";
      const extractedNamaGuru =
        student.namaGuru || student.NAMA_GURU || student["NAMA GURU"] || "";

      setPilihGuruPembimbing(extractedIdGuru);
      setNamaGuruPembimbing(extractedNamaGuru);

      const rawStatus = String(
        student.status || student.STATUS || "",
      ).toUpperCase();
      const rawTempat =
        student.tempatMagang ||
        student.TEMPAT_MAGANG ||
        student.tempat ||
        student.TEMPAT ||
        "";

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
    } else {
      setNama("");
      setPilihGuruPembimbing("");
      setNamaGuruPembimbing("");
      setStatus("BELUM_MAGANG");
      setTempatMagang("");
    }
  };

  // =========================================================
  // LOGIKA TEMPAT MAGANG & STATUS
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
            if (typeof item === "object")
              return item.tempat || item.TEMPAT || item.nama || "";
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
    if (newStatus === "BELUM_MAGANG") setTempatMagang("");
  };

  const handleKlikGantiPembimbing = () => {
    const inputKode = window.prompt(
      "Masukkan kode konfirmasi untuk mengubah Guru Pembimbing:",
    );
    if (inputKode === "663355") {
      setModeGantiGuru(true);
    } else if (inputKode !== null) {
      alert("Kode konfirmasi salah!");
    }
  };

  const handleKlikHapusPembimbing = () => {
    const inputKode = window.prompt(
      "Masukkan kode konfirmasi untuk menghapus Guru Pembimbing:",
    );
    if (inputKode === "663355") {
      setPilihGuruPembimbing("");
      setNamaGuruPembimbing("");
      setModeGantiGuru(false);
    } else if (inputKode !== null) {
      alert("Kode konfirmasi salah!");
    }
  };

  // =========================================================
  // SIMPAN SISWA
  // =========================================================
  async function simpanSiswa() {
    if (activeTab === 1 && !pilihSiswaId) {
      alert("Silakan pilih siswa dari dropdown terlebih dahulu.");
      return;
    }
    if (activeTab === 2 && nama.trim() === "") {
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

      const result = await addSiswa({
        id: activeTab === 1 ? pilihSiswaId : "",
        nama: namaSiswaDenganKelas,
        idGuru: activeTab === 1 ? pilihGuruPembimbing : "",
        namaGuru: activeTab === 1 ? namaGuruPembimbing : "",
        tempatMagang: status === "MAGANG" ? tempatMagang : "",
        status: status,
        isGuruWali: true,
        idGuruWali: guru.id,
      });

      if (result.success) {
        if (status === "MAGANG" && tempatMagang)
          saveToLocalStorage(tempatMagang);
        alert(
          `Siswa berhasil ditambahkan.\n\nID Siswa : ${result.data.id}\nStatus : ${status}`,
        );
        router.replace("/magang/guru/guru-wali");
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat menyimpan data siswa.");
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
          <p className="mt-4 font-semibold text-sm">Memuat halaman...</p>
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
                TAMBAH / EDIT SISWA WALI
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300 tracking-wide mt-0.5">
                Guru Wali: {guru.nama}
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
          <div className="mb-6 border-b border-slate-100 pb-5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
              Registrasi Siswa Wali
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Formulir Data Siswa
            </h2>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl mb-6 sm:mb-8">
            <button
              onClick={() => {
                setActiveTab(1);
                setPilihSiswaId("");
                setNama("");
                setPilihGuruPembimbing("");
                setNamaGuruPembimbing("");
                setStatus("BELUM_MAGANG");
                setTempatMagang("");
              }}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
                activeTab === 1
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              1. Tambah siswa dari Database
            </button>
            <button
              onClick={() => {
                setActiveTab(2);
                setNama("");
                setPilihGuruPembimbing("");
                setNamaGuruPembimbing("");
                setStatus("BELUM_MAGANG");
                setTempatMagang("");
              }}
              className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
                activeTab === 2
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              2. Tambah Siswa secara Manual
            </button>
          </div>

          <div className="space-y-5 sm:space-y-6">
            <div>
              <label className="block mb-1.5 text-sm font-bold text-slate-700">
                Kelas
              </label>
              <div className="relative">
                <select
                  value={kelas}
                  onChange={(e) => {
                    setKelas(e.target.value);
                    setPilihSiswaId("");
                    setNama("");
                    setPilihGuruPembimbing("");
                    setNamaGuruPembimbing("");
                    setStatus("BELUM_MAGANG");
                    setTempatMagang("");
                  }}
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

            {activeTab === 1 && (
              <div>
                <label className="block mb-1.5 text-sm font-bold text-slate-700">
                  Pilih Nama Siswa (Kelas {kelas})
                </label>
                {loadingDataSiswa ? (
                  <div className="p-3 text-sm text-blue-600 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-2">
                    <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    Memuat data spreadsheet...
                  </div>
                ) : (
                  <div>
                    <select
                      value={pilihSiswaId}
                      onChange={handlePilihSiswa}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 text-sm sm:text-base text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
                    >
                      <option value="">-- Pilih Siswa --</option>
                      {siswaFiltered.map((s, idx) => (
                        <option key={s.id || s.ID || idx} value={s.id || s.ID}>
                          {s.nama || s.NAMA}
                        </option>
                      ))}
                    </select>

                    {pilihSiswaId && (
                      <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-xs text-indigo-500 font-bold uppercase tracking-wider">
                            Guru Pembimbing Magang
                          </p>
                          <div className="flex gap-2">
                            {!modeGantiGuru && (
                              <button
                                type="button"
                                onClick={handleKlikGantiPembimbing}
                                className="text-[10px] bg-indigo-500 hover:bg-indigo-600 text-white px-2.5 py-1 rounded-md font-bold transition-colors shadow-sm"
                              >
                                Ganti
                              </button>
                            )}
                            {pilihGuruPembimbing && (
                              <button
                                type="button"
                                onClick={handleKlikHapusPembimbing}
                                className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-md font-bold transition-colors shadow-sm"
                              >
                                Hapus
                              </button>
                            )}
                          </div>
                        </div>

                        {!modeGantiGuru ? (
                          <p className="text-sm font-semibold text-indigo-900">
                            {namaGuruPembimbing || (
                              <span className="italic text-slate-500 font-normal">
                                Belum ada pembimbing magang
                              </span>
                            )}
                          </p>
                        ) : (
                          <div className="mt-2">
                            <select
                              className="w-full rounded-lg border border-indigo-200 p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                              value={pilihGuruPembimbing}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                setPilihGuruPembimbing(selectedId);
                                const guruTerpilih = daftarGuru.find(
                                  (g) =>
                                    String(g.id || g.ID) === String(selectedId),
                                );
                                if (guruTerpilih) {
                                  setNamaGuruPembimbing(
                                    guruTerpilih.nama || guruTerpilih.NAMA,
                                  );
                                } else {
                                  setNamaGuruPembimbing("");
                                }
                                setModeGantiGuru(false);
                              }}
                            >
                              <option value="">-- Pilih Guru Baru --</option>
                              {daftarGuru.map((g, idx) => (
                                <option
                                  key={g.id || g.ID || idx}
                                  value={g.id || g.ID}
                                >
                                  {g.nama || g.NAMA}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setModeGantiGuru(false)}
                              className="mt-2 text-[10px] text-slate-500 underline"
                            >
                              Batal Ganti
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {pilihSiswaId && (
                      <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3">
                        <div className="text-xl">ℹ️</div>
                        <div>
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Status & Tempat Magang (Otomatis dari Spreadsheet)
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                status === "MAGANG"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {status === "MAGANG"
                                ? "🏢 MAGANG"
                                : "🎓 BELUM MAGANG"}
                            </span>
                            {status === "MAGANG" && tempatMagang && (
                              <span className="text-sm font-semibold text-slate-800">
                                di {tempatMagang}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 2 && (
              <div>
                <label className="block mb-1.5 text-sm font-bold text-slate-700">
                  Nama Lengkap Siswa Baru
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-3.5 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  placeholder="MASUKKAN NAMA SISWA..."
                />
              </div>
            )}

            {activeTab === 2 && (
              <>
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

                {status === "MAGANG" && (
                  <div>
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

                {status === "BELUM_MAGANG" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <div className="text-xl">ℹ️</div>
                      <div>
                        <p className="text-sm font-bold text-amber-800">
                          Siswa belum magang
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          Tempat magang belum diperlukan. Status dapat diubah
                          menjadi MAGANG nanti setelah siswa mendapatkan tempat
                          magang.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:gap-4">
            <button
              onClick={() => router.back()}
              className="w-full sm:w-1/3 rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all text-center"
            >
              Batal
            </button>
            <button
              onClick={simpanSiswa}
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
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Menyimpan Data...
                </>
              ) : (
                <>
                  <span className="text-lg leading-none">+</span>
                  <span>Simpan Data Siswa</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm transition-opacity p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
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
                  <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
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
                          Belum ada tempat magang
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Data DUDI akan muncul setelah siswa magang
                          ditambahkan.
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
