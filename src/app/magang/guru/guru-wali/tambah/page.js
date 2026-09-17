// GANTI SELURUH ISI FILE JS GURU WALI TAMBAH DENGAN KODE INI

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

import { getSession, isLoggedIn } from "../../../lib/auth";
import {
  addSiswa,
  editSiswa,
  simpanGuruWaliSiswa,
  getTempatMagangGuru,
  getSiswa,
  getDataSiswaWali,
  getGuru,
} from "../../../lib/api";

// =========================================================
// DATA KELAS BAKU
// Dipakai untuk siswa yang benar-benar belum ada di server.
// Value sengaja mengikuti pola JS MODAL TAMBAH SISWA BARU.
// =========================================================
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

function cleanValue(value) {
  const v = String(value ?? "").trim();
  if (!v || v === "-" || v === "0" || v.toLowerCase() === "null") return "";
  if (v.toLowerCase().includes("belum ada")) return "";
  if (v.toLowerCase().includes("belum")) return "";
  if (v.toLowerCase().includes("tanpa guru wali")) return "";
  return v;
}

function getStudentId(s) {
  return s?.id ?? s?.ID ?? s?.idSiswa ?? s?.ID_SISWA ?? "";
}

function getStudentName(s) {
  return s?.nama ?? s?.NAMA ?? "";
}

function getStudentClass(s) {
  const nama = String(getStudentName(s));
  const match = nama.match(/\[(.*?)\]\s*$/);
  return (s?.kelas ?? s?.KELAS ?? match?.[1] ?? "").trim();
}

function getGuruWaliId(s) {
  return cleanValue(
    s?.idGuruWali ?? s?.ID_GURU_WALI ?? s?.["ID GURU WALI"] ?? s?.guruWaliId,
  );
}

function getGuruWaliName(s) {
  return cleanValue(
    s?.namaGuruWali ??
      s?.NAMA_GURU_WALI ??
      s?.["NAMA GURU WALI"] ??
      s?.guruWali ??
      s?.namaWali,
  );
}

function getStatusMagang(s) {
  const status = String(
    s?.status ?? s?.STATUS ?? s?.statusMagang ?? s?.STATUS_MAGANG ?? "",
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  const tempat =
    s?.tempatMagang ?? s?.TEMPAT_MAGANG ?? s?.tempat ?? s?.TEMPAT ?? "";

  if (status === "MAGANG" || (status === "" && String(tempat).trim())) {
    return {
      status: "MAGANG",
      tempat: String(tempat).trim(),
    };
  }

  return {
    status: "BELUM_MAGANG",
    tempat: "",
  };
}

function TambahSiswaWaliContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const editId = searchParams?.get("editId");
  const editKelas = searchParams?.get("kelas");
  const isEditMode = Boolean(editId);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guru, setGuru] = useState(null);

  const [dataSiswaSpreadsheet, setDataSiswaSpreadsheet] = useState([]);
  const [loadingDataSiswa, setLoadingDataSiswa] = useState(false);
  const [daftarGuru, setDaftarGuru] = useState([]);

  // =========================================================
  // MODAL TAMBAH SISWA
  // Pola UI/UX mengikuti JS MODAL TAMBAH SISWA BARU.
  // =========================================================
  const [isSiswaModalOpen, setIsSiswaModalOpen] = useState(false);
  const [searchTambah, setSearchTambah] = useState("");
  const [filterKelasTambah, setFilterKelasTambah] = useState("");
  const [showFormBaru, setShowFormBaru] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const [kelasBaru, setKelasBaru] = useState("");
  const [menambahId, setMenambahId] = useState(null);
  const [savingBaru, setSavingBaru] = useState(false);

  // =========================================================
  // FORM EDIT / DATA TERPILIH
  // =========================================================
  const [pilihSiswaId, setPilihSiswaId] = useState("");
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("X TKJ 1");

  const [status, setStatus] = useState("BELUM_MAGANG");
  const [tempatMagang, setTempatMagang] = useState("");

  const [pilihGuruPembimbing, setPilihGuruPembimbing] = useState("");
  const [namaGuruPembimbing, setNamaGuruPembimbing] = useState("");
  const [modeGantiGuru, setModeGantiGuru] = useState(false);

  // =========================================================
  // MODAL TEMPAT MAGANG
  // =========================================================
  const [isModalTempatOpen, setIsModalTempatOpen] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState([]);
  const [inputTempatBaru, setInputTempatBaru] = useState("");
  const [daftarTempatDb, setDaftarTempatDb] = useState([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // =========================================================
  // FETCH DATA
  // =========================================================
  async function fetchMasterSiswa() {
    setLoadingDataSiswa(true);

    try {
      if (typeof getSiswa === "function") {
        const res = await getSiswa();

        if (res?.success) {
          const siswaDasar = Array.isArray(res.data) ? res.data : [];

          // getSiswa() hanya berisi master siswa.
          // Nama Guru Wali berasal dari relasi GURU_WALI, sehingga
          // digabung dari getDataSiswaWali("ALL") agar status wali
          // pada modal benar-benar sama dengan halaman/modal lain.
          let dataWali = [];
          try {
            const resWali = await getDataSiswaWali("ALL");
            if (resWali?.success && Array.isArray(resWali.data)) {
              dataWali = resWali.data;
            }
          } catch (waliError) {
            console.warn("Gagal mengambil relasi Guru Wali:", waliError);
          }

          const waliBySiswa = new Map(
            dataWali
              .filter((w) => getStudentId(w))
              .map((w) => [String(getStudentId(w)).trim(), w]),
          );

          const gabungan = siswaDasar.map((siswa) => {
            const id = String(getStudentId(siswa)).trim();
            const wali = waliBySiswa.get(id);

            return {
              ...siswa,
              idGuruWali: wali?.idGuru ?? "",
              namaGuruWali: wali?.idGuru ? (wali?.namaGuru ?? "") : "",
            };
          });

          setDataSiswaSpreadsheet(gabungan);
        }
      }
    } catch (error) {
      console.error("Gagal menarik data siswa spreadsheet:", error);
      setDataSiswaSpreadsheet([]);
    } finally {
      setLoadingDataSiswa(false);
    }
  }

  async function fetchMasterGuru() {
    try {
      if (typeof getGuru === "function") {
        const res = await getGuru();

        if (res?.success && Array.isArray(res.data)) {
          setDaftarGuru(
            res.data.map((g) => ({
              id: g.id ?? g.ID ?? g.id_guru ?? g.ID_GURU,
              nama: g.namaGuru ?? g.NAMA_GURU ?? g.nama ?? g.NAMA,
            })),
          );
        }
      }
    } catch (error) {
      console.error("Gagal menarik data guru:", error);
      setDaftarGuru([]);
    }
  }

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
        const parsed = JSON.parse(storedPlaces);
        if (Array.isArray(parsed)) setRecentPlaces(parsed);
      } catch (error) {
        console.error("Gagal membaca history tempat magang:", error);
      }
    }

    fetchMasterSiswa();
    fetchMasterGuru();
  }, [router]);

  // =========================================================
  // DATA SISWA UNTUK MODAL
  // =========================================================
  const daftarSiswaModal = useMemo(() => {
    return (dataSiswaSpreadsheet || [])
      .map((s) => ({
        ...s,
        idSiswa: String(getStudentId(s)).trim(),
        namaTampil: String(getStudentName(s))
          .replace(/\[.*?\]/g, "")
          .trim(),
        kelasTampil: getStudentClass(s),
        idGuruWaliTampil: getGuruWaliId(s),
        namaGuruWaliTampil: getGuruWaliName(s),
        ...getStatusMagang(s),
      }))
      .filter((s) => s.idSiswa && s.namaTampil)
      .sort((a, b) => a.namaTampil.localeCompare(b.namaTampil));
  }, [dataSiswaSpreadsheet]);

  const { grupKelasTersedia, totalKelasTersedia } = useMemo(() => {
    const uniqueClasses = Array.from(
      new Set(daftarSiswaModal.map((s) => s.kelasTampil).filter(Boolean)),
    ).sort();

    const groups = {
      "Kelas X": [],
      "Kelas XI": [],
      "Kelas XII": [],
    };

    uniqueClasses.forEach((namaKelas) => {
      const upper = namaKelas.toUpperCase();

      if (upper.includes("XII")) {
        groups["Kelas XII"].push(namaKelas);
      } else if (upper.includes("XI")) {
        groups["Kelas XI"].push(namaKelas);
      } else if (upper.includes("X")) {
        groups["Kelas X"].push(namaKelas);
      } else {
        groups["Kelas XII"].push(namaKelas);
      }
    });

    return {
      grupKelasTersedia: groups,
      totalKelasTersedia: uniqueClasses.length,
    };
  }, [daftarSiswaModal]);

  const siswaTersaringModal = useMemo(() => {
    const query = searchTambah.trim().toLowerCase();

    return daftarSiswaModal.filter((s) => {
      const cocokNama = !query || s.namaTampil.toLowerCase().includes(query);

      const cocokKelas =
        !filterKelasTambah || s.kelasTampil === filterKelasTambah;

      return cocokNama && cocokKelas;
    });
  }, [daftarSiswaModal, searchTambah, filterKelasTambah]);

  const tidakDitemukan =
    !loadingDataSiswa &&
    searchTambah.trim() !== "" &&
    siswaTersaringModal.length === 0;

  // =========================================================
  // BUKA / TUTUP MODAL SISWA
  // =========================================================
  const bukaModalTambahSiswa = () => {
    if (isEditMode) return;

    setSearchTambah("");
    setFilterKelasTambah("");
    setShowFormBaru(false);
    setNamaBaru("");
    setKelasBaru("");
    setIsSiswaModalOpen(true);
  };

  const tutupModalTambahSiswa = () => {
    if (menambahId || savingBaru) return;

    // Pada mode TAMBAH, daftar siswa sekarang menjadi tampilan utama halaman.
    // Tombol Tutup/Kembali harus kembali ke daftar Guru Wali, bukan menyisakan
    // halaman kosong setelah selector ditutup.
    if (!isEditMode) {
      router.back();
      return;
    }

    setIsSiswaModalOpen(false);
    setSearchTambah("");
    setFilterKelasTambah("");
    setShowFormBaru(false);
  };

  // =========================================================
  // TAMBAH SISWA YANG SUDAH ADA DI SERVER
  // Tombol pada modal langsung menjalankan relasi Guru Wali.
  // Logika duplikat tetap 100% melalui simpanGuruWaliSiswa().
  // =========================================================
  async function tambahSiswaDariModal(siswa) {
    const idSiswa = String(siswa.idSiswa || "").trim();
    if (!idSiswa || !guru?.id || menambahId) return;

    setMenambahId(idSiswa);
    try {
      const result = await simpanGuruWaliSiswa({
        idSiswa,
        idGuru: String(guru.id).trim(),
      });

      if (result?.success) {
        let pesan = "Siswa berhasil ditambahkan sebagai siswa Guru Wali.";

        if (result.data?.action === "update") {
          pesan = "Siswa berhasil dipindahkan ke Guru Wali ini.";
        } else if (result.data?.action === "already") {
          pesan = "Siswa sudah menjadi siswa Guru Wali ini.";
        } else if (result.data?.action === "insert") {
          pesan = "Siswa berhasil ditambahkan sebagai siswa wali.";
        }

        alert(
          `${pesan}\n\n` +
            `Nama : ${siswa.namaTampil}\n` +
            `ID Siswa : ${idSiswa}`,
        );

        // Segarkan data supaya nama Guru Wali di modal langsung berubah.
        await fetchMasterSiswa();
      } else {
        alert(result?.message || "Gagal menambahkan siswa sebagai Guru Wali.");
      }
    } catch (error) {
      console.error("ERROR TAMBAH SISWA GURU WALI:", error);
      alert("Terjadi kesalahan saat menambahkan siswa sebagai Guru Wali.");
    } finally {
      setMenambahId(null);
    }
  }

  // =========================================================
  // TAMBAH SISWA MANUAL
  //
  // PENTING:
  // Siswa manual SELALU BELUM_MAGANG.
  // Tidak ada pilihan status MAGANG pada form manual.
  // =========================================================
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
        isGuruWali: true,
        idGuruWali: guru.id,
      });

      if (!hasilAdd?.success) {
        alert(hasilAdd?.message || "Gagal mendaftarkan siswa baru ke sistem.");
        return;
      }

      const idBaru =
        hasilAdd.data?.id ??
        hasilAdd.data?.ID ??
        hasilAdd.data?.idSiswa ??
        hasilAdd.data?.ID_SISWA;

      if (!idBaru) {
        alert(
          "Siswa berhasil didaftarkan, tetapi ID siswa tidak terbaca otomatis.",
        );

        setShowFormBaru(false);
        await fetchMasterSiswa();
        return;
      }

      // Manual = selalu BELUM_MAGANG.
      setPilihSiswaId(String(idBaru));
      setNama(namaBaru.trim().toUpperCase());
      setKelas(kelasBaru);
      setStatus("BELUM_MAGANG");
      setTempatMagang("");
      setPilihGuruPembimbing("");
      setNamaGuruPembimbing("");
      setModeGantiGuru(false);

      alert(
        `✅ Siswa "${namaBaru.trim().toUpperCase()}" berhasil ditambahkan sebagai siswa Guru Wali.\n\n` +
          `ID Siswa : ${idBaru}\n` +
          `Status : BELUM MAGANG`,
      );

      setNamaBaru("");
      setKelasBaru("");
      setShowFormBaru(false);
      setIsSiswaModalOpen(false);

      await fetchMasterSiswa();
    } catch (error) {
      console.error("ERROR DAFTAR SISWA BARU:", error);
      alert("Terjadi kesalahan saat mendaftarkan siswa baru.");
    } finally {
      setSavingBaru(false);
    }
  }

  // =========================================================
  // AUTO-FILL MODE EDIT
  // =========================================================
  useEffect(() => {
    if (!editId || dataSiswaSpreadsheet.length === 0) return;

    const student = dataSiswaSpreadsheet.find(
      (s) => String(getStudentId(s)) === String(editId),
    );

    if (!student) return;

    setPilihSiswaId(String(editId));

    const rawNama = getStudentName(student);
    const match = String(rawNama).match(/^(.*?)\s*\[(.*?)\]\s*$/);

    if (match) {
      setNama(match[1].trim().toUpperCase());
      setKelas(match[2].trim());
    } else {
      setNama(String(rawNama).trim().toUpperCase());

      if (editKelas) {
        setKelas(editKelas);
      }
    }

    const idGuruPembimbing = cleanValue(
      student.idGuru ?? student.ID_GURU ?? student["ID GURU"],
    );

    const namaGuruPembimbing = cleanValue(
      student.namaGuru ?? student.NAMA_GURU ?? student["NAMA GURU"],
    );

    setPilihGuruPembimbing(idGuruPembimbing);
    setNamaGuruPembimbing(namaGuruPembimbing);
    setModeGantiGuru(false);

    const magang = getStatusMagang(student);
    setStatus(magang.status);
    setTempatMagang(magang.tempat);
  }, [editId, editKelas, dataSiswaSpreadsheet]);

  // =========================================================
  // GURU PEMBIMBING
  // =========================================================
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
  // TEMPAT MAGANG
  // =========================================================
  useEffect(() => {
    if (isModalTempatOpen && guru?.id) {
      fetchTempatMagangDb();
    }
  }, [isModalTempatOpen, guru?.id]);

  async function fetchTempatMagangDb() {
    setLoadingDb(true);

    try {
      const res = await getTempatMagangGuru(guru.id);

      if (res?.success && res.data) {
        const rawArray = Array.isArray(res.data) ? res.data : [res.data];

        const normalizedData = rawArray
          .map((item) => {
            if (!item) return "";

            if (typeof item === "object") {
              return item.tempat ?? item.TEMPAT ?? item.nama ?? "";
            }

            return String(item);
          })
          .filter((item) => typeof item === "string" && item.trim() !== "");

        setDaftarTempatDb([...new Set(normalizedData)]);
      } else {
        setDaftarTempatDb([]);
      }
    } catch (error) {
      console.error("Gagal menarik data tempat magang:", error);
      setDaftarTempatDb([]);
    } finally {
      setLoadingDb(false);
    }
  }

  const saveToLocalStorage = (newPlace) => {
    if (!newPlace) return;

    let currentPlaces = [...recentPlaces].filter((p) => p !== newPlace);

    currentPlaces.unshift(newPlace);

    if (currentPlaces.length > 8) {
      currentPlaces = currentPlaces.slice(0, 8);
    }

    setRecentPlaces(currentPlaces);
    localStorage.setItem("recentTempatMagang", JSON.stringify(currentPlaces));
  };

  const handlePilihTempat = (place) => {
    setTempatMagang(place);
    setStatus("MAGANG");
    setIsModalTempatOpen(false);
  };

  const handleGunakanTempatBaru = () => {
    if (!inputTempatBaru.trim()) return;

    const tempat = inputTempatBaru.trim().toUpperCase();

    setTempatMagang(tempat);
    setStatus("MAGANG");
    saveToLocalStorage(tempat);

    setInputTempatBaru("");
    setIsModalTempatOpen(false);
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);

    if (newStatus === "BELUM_MAGANG") {
      setTempatMagang("");
    }
  };

  // =========================================================
  // SIMPAN DATA
  //
  // DUPLIKAT / RELASI GURU WALI TETAP MENGGUNAKAN
  // simpanGuruWaliSiswa() seperti kode lama.
  // =========================================================
  async function simpanSiswa() {
    if (!isEditMode && !pilihSiswaId) {
      alert("Silakan pilih siswa terlebih dahulu.");
      return;
    }

    if (isEditMode && !nama.trim()) {
      alert("Nama lengkap tidak boleh kosong.");
      return;
    }

    if (status === "MAGANG" && !tempatMagang.trim()) {
      alert("Silakan pilih tempat magang terlebih dahulu.");
      return;
    }

    setSaving(true);

    try {
      const namaSiswaDenganKelas = `${nama.trim()} [${kelas}]`;

      let result;

      if (isEditMode) {
        result = await editSiswa({
          id: editId,
          nama: namaSiswaDenganKelas,
          idGuru: pilihGuruPembimbing
            ? String(pilihGuruPembimbing).trim()
            : "-",
          namaGuru: namaGuruPembimbing
            ? String(namaGuruPembimbing).trim()
            : "-",
          tempatMagang: status === "MAGANG" ? tempatMagang : "",
          status,
          isGuruWali: true,
          idGuruWali: guru.id,
        });
      } else {
        // =====================================================
        // SISWA SUDAH ADA DI SERVER
        //
        // HANYA RELASI GURU WALI YANG DISIMPAN.
        //
        // Jangan memakai addSiswa() di sini.
        // Logika duplikat tetap ditangani backend melalui
        // simpanGuruWaliSiswa().
        // =====================================================
        result = await simpanGuruWaliSiswa({
          idSiswa: String(pilihSiswaId).trim(),
          idGuru: String(guru.id).trim(),
        });
      }

      if (result?.success) {
        if (status === "MAGANG" && tempatMagang) {
          saveToLocalStorage(tempatMagang);
        }

        let pesanBerhasil = "Siswa berhasil ditambahkan.";

        if (isEditMode) {
          pesanBerhasil = "Data siswa berhasil diperbarui.";
        } else if (result.data?.action === "update") {
          pesanBerhasil = "Siswa berhasil dipindahkan ke Guru Wali ini.";
        } else if (result.data?.action === "already") {
          pesanBerhasil = "Siswa sudah menjadi siswa Guru Wali ini.";
        } else if (result.data?.action === "insert") {
          pesanBerhasil = "Siswa berhasil ditambahkan sebagai siswa wali.";
        }

        alert(
          `${pesanBerhasil}\n\n` +
            `ID Siswa : ${
              result.data?.idSiswa ?? result.data?.id ?? editId ?? pilihSiswaId
            }\n` +
            `Status : ${status}`,
        );

        router.replace("/magang/guru/guru-wali");
      } else {
        alert(result?.message || "Gagal menyimpan data siswa.");
      }
    } catch (error) {
      console.error(error);

      alert(
        isEditMode
          ? "Terjadi kesalahan saat memperbarui data siswa."
          : "Terjadi kesalahan saat menyimpan data siswa.",
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // LOADING
  // =========================================================
  if (loading || !guru) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center text-slate-500">
          <div className="relative h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
            <div className="absolute inset-0 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin" />
          </div>

          <p className="mt-4 text-sm font-bold">Memuat halaman...</p>
        </div>
      </main>
    );
  }

  // =========================================================
  // UI UTAMA
  // =========================================================
  return (
    <main className="min-h-screen bg-slate-50 font-sans selection:bg-emerald-200">
      <header className="sticky top-0 z-40 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 p-1.5 backdrop-blur-sm">
              <Image
                src="/logo.png"
                alt="Logo"
                width={42}
                height={42}
                className="object-contain"
              />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-black tracking-tight sm:text-lg">
                {isEditMode ? "EDIT SISWA WALI" : "TAMBAH SISWA WALI"}
              </h1>

              <p className="truncate text-[10px] font-bold text-emerald-100 sm:text-xs">
                Guru Wali: {guru.nama}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.back()}
            className="shrink-0 rounded-xl border border-white/30 bg-white/10 px-3 py-2 text-xs font-black text-white transition-all hover:bg-white hover:text-emerald-800 active:scale-95 sm:px-5"
          >
            Kembali
          </button>
        </div>
      </header>

      {isEditMode && (
        <div className="mx-auto w-full max-w-3xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="overflow-hidden rounded-3xl border border-amber-300 bg-gradient-to-br from-amber-300 via-yellow-300 to-amber-400 shadow-xl">
            <div className="border-b border-amber-400 px-5 py-5 sm:px-7">
              <div className="mb-2 inline-flex rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-700 shadow-sm">
                Pembaruan Data Siswa
              </div>

              <h2 className="text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
                Perbarui Data Siswa Wali
              </h2>

              <p className="mt-1 text-xs font-semibold text-slate-700">
                Perbarui data siswa wali dan kelola status magang.
              </p>
            </div>

            <div className="space-y-5 p-5 sm:space-y-6 sm:p-7">
              {isEditMode && (
                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                    ID Siswa
                  </p>
                  <p className="mt-1 text-sm font-black text-blue-950">
                    {pilihSiswaId}
                  </p>
                </section>
              )}

              {isEditMode && (
                <div>
                  <label className="mb-1.5 block text-sm font-black text-slate-900">
                    Nama Lengkap
                  </label>

                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value.toUpperCase())}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm font-bold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    placeholder="MASUKKAN NAMA SISWA..."
                  />
                </div>
              )}

              {isEditMode && (
                <div>
                  <label className="mb-1.5 block text-sm font-black text-slate-900">
                    Kelas
                  </label>

                  <select
                    value={kelas}
                    onChange={(e) => {
                      setKelas(e.target.value);

                      // Mode ini khusus edit siswa wali.
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-sm font-bold text-slate-900 outline-none transition-all focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    {KELAS_DATA.flatMap((group) =>
                      group.items.map((item) => (
                        <option key={item.val} value={item.val}>
                          {item.label}
                        </option>
                      )),
                    )}
                  </select>
                </div>
              )}

              {isEditMode && (
                <section className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                      Guru Pembimbing Magang
                    </p>

                    <div className="flex gap-2">
                      {!modeGantiGuru && (
                        <button
                          type="button"
                          onClick={handleKlikGantiPembimbing}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[10px] font-black text-white shadow-sm transition hover:bg-indigo-700 active:scale-95"
                        >
                          Ganti
                        </button>
                      )}

                      {pilihGuruPembimbing && (
                        <button
                          type="button"
                          onClick={handleKlikHapusPembimbing}
                          className="rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-black text-white shadow-sm transition hover:bg-red-600 active:scale-95"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>

                  {!modeGantiGuru ? (
                    <p className="text-sm font-black text-indigo-950">
                      {namaGuruPembimbing || (
                        <span className="font-medium italic text-slate-500">
                          Belum ada pembimbing magang
                        </span>
                      )}
                    </p>
                  ) : (
                    <div>
                      <select
                        value={pilihGuruPembimbing}
                        onChange={(e) => {
                          const selectedId = e.target.value;

                          setPilihGuruPembimbing(selectedId);

                          const guruTerpilih = daftarGuru.find(
                            (g) => String(g.id) === String(selectedId),
                          );

                          setNamaGuruPembimbing(guruTerpilih?.nama || "");

                          setModeGantiGuru(false);
                        }}
                        className="w-full rounded-xl border border-indigo-200 bg-white p-3 text-sm font-bold text-slate-900 outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Pilih Guru Baru --</option>

                        {daftarGuru.map((g, idx) => (
                          <option key={g.id || idx} value={g.id}>
                            {g.nama}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => setModeGantiGuru(false)}
                        className="mt-2 text-[10px] font-bold text-slate-500 underline"
                      >
                        Batal Ganti
                      </button>
                    </div>
                  )}
                </section>
              )}

              {isEditMode && (
                <section>
                  <label className="mb-1.5 block text-sm font-black text-slate-900">
                    Status Siswa
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleStatusChange("BELUM_MAGANG")}
                      className={`rounded-2xl border-2 p-4 text-sm font-black transition-all active:scale-[0.98] ${
                        status === "BELUM_MAGANG"
                          ? "border-amber-500 bg-amber-50 text-amber-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      <div className="mb-1 text-xl">🎓</div>
                      BELUM MAGANG
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStatus("MAGANG");

                        if (!tempatMagang) {
                          setIsModalTempatOpen(true);
                        }
                      }}
                      className={`rounded-2xl border-2 p-4 text-sm font-black transition-all active:scale-[0.98] ${
                        status === "MAGANG"
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      <div className="mb-1 text-xl">🏢</div>
                      MAGANG
                    </button>
                  </div>
                </section>
              )}

              {isEditMode && status === "MAGANG" && (
                <section>
                  <label className="mb-1.5 block text-sm font-black text-slate-900">
                    Tempat Magang (DUDI)
                  </label>

                  <button
                    type="button"
                    onClick={() => setIsModalTempatOpen(true)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 text-left text-sm font-bold text-slate-900 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="truncate">
                      {tempatMagang || "📍 Pilih Tempat Magang"}
                    </span>

                    <span className="ml-3 text-slate-400">▼</span>
                  </button>
                </section>
              )}

              {isEditMode && status === "BELUM_MAGANG" && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex gap-3">
                    <div className="text-xl">ℹ️</div>

                    <div>
                      <p className="text-sm font-black text-amber-800">
                        Siswa belum magang
                      </p>

                      <p className="mt-1 text-xs font-semibold leading-relaxed text-amber-700">
                        Tempat magang belum diperlukan. Status dapat diubah
                        menjadi MAGANG nanti setelah siswa mendapatkan tempat
                        magang.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <div className="flex flex-col gap-3 border-t border-amber-400 pt-5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 active:scale-[0.98] sm:w-1/3"
                >
                  Batal
                </button>

                {isEditMode && (
                  <button
                    type="button"
                    onClick={simpanSiswa}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white shadow-md shadow-emerald-700/20 transition hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-2/3"
                  >
                    {saving ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        Menyimpan Data...
                      </>
                    ) : (
                      <>
                        <span className="text-lg">
                          {isEditMode ? "✏️" : "💾"}
                        </span>

                        {isEditMode
                          ? "Perbarui Data Siswa"
                          : "Simpan Siswa Wali"}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          DAFTAR / PILIH SISWA GURU WALI
          MODE TAMBAH LANGSUNG — UI/UX MENGIKUTI JS MODAL TAMBAH SISWA BARU
          ===================================================== */}
      {(isSiswaModalOpen || !isEditMode) && (
        <div
          className={`${
            isEditMode
              ? "fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
              : "mx-auto flex min-h-[calc(100vh-90px)] w-full max-w-3xl items-start justify-center px-4 py-5 sm:px-6 sm:py-8"
          }`}
          onMouseDown={(e) => {
            if (isEditMode && e.target === e.currentTarget) {
              tutupModalTambahSiswa();
            }
          }}
        >
          <div
            className={`flex w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl ${
              isEditMode
                ? "max-h-[90vh] max-w-lg"
                : "max-h-[calc(100vh-125px)] max-w-2xl"
            }`}
          >
            <div className="shrink-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-5 py-4 text-white">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black sm:text-base">
                    ➕ Daftar Siswa Guru Wali
                  </h3>

                  <p className="mt-0.5 text-[10px] font-bold text-emerald-100">
                    Guru Wali: {guru.nama}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={tutupModalTambahSiswa}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-black transition hover:bg-white/35 active:scale-95"
                  aria-label={isEditMode ? "Tutup" : "Kembali"}
                >
                  {isEditMode ? "✕" : "←"}
                </button>
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
                  className="w-full rounded-xl border border-white/40 bg-white/15 px-4 py-2.5 text-xs font-bold text-white outline-none placeholder:text-white/70 focus:bg-white/25 sm:text-sm"
                />
              </div>

              <div className="mt-2">
                <select
                  value={filterKelasTambah}
                  onChange={(e) => setFilterKelasTambah(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 outline-none shadow-sm focus:ring-2 focus:ring-emerald-400 sm:text-sm"
                >
                  <option value="">
                    -- Semua Kelas ({totalKelasTersedia}) --
                  </option>

                  {grupKelasTersedia["Kelas X"].length > 0 && (
                    <optgroup label="Kelas X">
                      {grupKelasTersedia["Kelas X"].map((namaKelas) => (
                        <option key={namaKelas} value={namaKelas}>
                          {namaKelas}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {grupKelasTersedia["Kelas XI"].length > 0 && (
                    <optgroup label="Kelas XI">
                      {grupKelasTersedia["Kelas XI"].map((namaKelas) => (
                        <option key={namaKelas} value={namaKelas}>
                          {namaKelas}
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {grupKelasTersedia["Kelas XII"].length > 0 && (
                    <optgroup label="Kelas XII">
                      {grupKelasTersedia["Kelas XII"].map((namaKelas) => (
                        <option key={namaKelas} value={namaKelas}>
                          {namaKelas}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
              {showFormBaru && (
                <div className="mb-3 space-y-3 rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                      📝 Daftarkan Siswa Baru
                    </p>

                    <button
                      type="button"
                      onClick={() => setShowFormBaru(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-800"
                    >
                      ✕ Tutup
                    </button>
                  </div>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase text-emerald-800">
                      Nama Lengkap Siswa
                    </span>

                    <input
                      value={namaBaru}
                      onChange={(e) =>
                        setNamaBaru(e.target.value.toUpperCase())
                      }
                      placeholder="Contoh: AHMAD FAUZI"
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-xs font-black text-slate-800 outline-none focus:border-emerald-600"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase text-emerald-800">
                      Pilih Kelas
                    </span>

                    <select
                      value={kelasBaru}
                      onChange={(e) => setKelasBaru(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600"
                    >
                      <option value="">-- Pilih kelas --</option>

                      {KELAS_DATA.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.items.map((item) => (
                            <option key={item.val} value={item.val}>
                              {item.label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                      Status Otomatis
                    </p>

                    <p className="mt-1 text-xs font-black text-amber-900">
                      🎓 BELUM MAGANG
                    </p>

                    <p className="mt-0.5 text-[10px] font-semibold text-amber-700">
                      Siswa manual selalu dibuat BELUM MAGANG.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={daftarSiswaBaru}
                      disabled={savingBaru}
                      className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-emerald-700 active:scale-95 disabled:opacity-60"
                    >
                      {savingBaru ? "Menyimpan..." : "💾 Simpan & Tambahkan"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowFormBaru(false)}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}

              {loadingDataSiswa ? (
                <div className="py-10 text-center">
                  <div className="relative mx-auto h-8 w-8">
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-200" />
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                  </div>

                  <p className="mt-3 text-xs font-bold text-slate-400">
                    Memuat daftar siswa dari server...
                  </p>
                </div>
              ) : siswaTersaringModal.length > 0 ? (
                siswaTersaringModal.map((siswa) => {
                  const sudahAdaGuruWali = Boolean(siswa.namaGuruWaliTampil);

                  const guruWaliIni =
                    siswa.idGuruWaliTampil &&
                    String(siswa.idGuruWaliTampil) === String(guru.id);

                  return (
                    <div
                      key={siswa.idSiswa}
                      className={`rounded-2xl border bg-white px-4 py-3 shadow-sm transition-all ${
                        guruWaliIni
                          ? "border-emerald-300 bg-emerald-50/40"
                          : "border-slate-200 hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${
                            guruWaliIni ? "bg-emerald-100" : "bg-slate-100"
                          }`}
                        >
                          {guruWaliIni ? "👨‍🏫" : "👤"}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-slate-800 sm:text-sm">
                            {siswa.namaTampil}
                          </p>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {siswa.kelasTampil && (
                              <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-black text-blue-700">
                                {siswa.kelasTampil}
                              </span>
                            )}

                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-black ${
                                siswa.status === "MAGANG"
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-amber-50 text-amber-700"
                              }`}
                            >
                              {siswa.status === "MAGANG"
                                ? "🏢 MAGANG"
                                : "🎓 BELUM MAGANG"}
                            </span>
                          </div>

                          <p
                            className={`mt-1 text-[10px] font-bold ${
                              sudahAdaGuruWali
                                ? "text-emerald-700"
                                : "text-slate-400"
                            }`}
                          >
                            {sudahAdaGuruWali
                              ? `✓ Sudah ada Guru Wali ${siswa.namaGuruWaliTampil}`
                              : "○ Belum ada Guru Wali"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => tambahSiswaDariModal(siswa)}
                          disabled={menambahId === siswa.idSiswa}
                          className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-black shadow-sm transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                            guruWaliIni
                              ? "bg-emerald-700 text-white hover:bg-emerald-800"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {menambahId === siswa.idSiswa
                            ? "⏳..."
                            : guruWaliIni
                              ? "Sudah"
                              : "+ Tambah"}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : tidakDitemukan ? (
                <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center">
                  <div className="text-3xl">🔎</div>

                  <p className="mt-2 text-xs font-black text-amber-800">
                    Siswa &quot;{searchTambah}&quot; tidak ditemukan di server.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setNamaBaru(searchTambah);
                      setKelasBaru("");
                      setShowFormBaru(true);
                    }}
                    className="mt-3 rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-amber-600 active:scale-95"
                  >
                    ➕ Daftarkan Siswa Ini ke Server
                  </button>
                </div>
              ) : (
                <div className="py-10 text-center">
                  <div className="text-3xl">👨‍🎓</div>

                  <p className="mt-2 text-xs font-black text-slate-500">
                    Belum ada siswa yang sesuai.
                  </p>

                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    Cari nama siswa. Jika tidak ditemukan, pilihan pendaftaran
                    manual akan muncul.
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
              <span className="text-[10px] font-bold text-slate-500">
                {siswaTersaringModal.length} siswa ditemukan
              </span>

              <button
                type="button"
                onClick={tutupModalTambahSiswa}
                className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-[11px] font-black text-slate-700 transition hover:bg-slate-100 active:scale-95"
              >
                {isEditMode ? "Selesai / Tutup" : "Kembali"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          MODAL TEMPAT MAGANG
          ===================================================== */}
      {isModalTempatOpen && (
        <div
          className="fixed inset-0 z-[210] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setIsModalTempatOpen(false);
            }
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-4 sm:px-5">
              <div>
                <h3 className="text-base font-black text-slate-800">
                  Pilih Tempat Magang
                </h3>

                <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                  Pilih lokasi yang sudah tersedia atau gunakan lokasi baru.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalTempatOpen(false)}
                className="rounded-full bg-white p-2 text-slate-400 shadow-sm transition hover:bg-slate-100 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 space-y-7 overflow-y-auto p-4 sm:p-6">
              <section>
                <h4 className="mb-3 flex items-center gap-1.5 text-sm font-black text-slate-700">
                  ⭐ Terakhir Digunakan
                </h4>

                {recentPlaces.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {recentPlaces.map((place, idx) => (
                      <button
                        type="button"
                        key={`${place}-${idx}`}
                        onClick={() => handlePilihTempat(place)}
                        className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-left text-xs font-bold text-indigo-700 transition hover:bg-indigo-600 hover:text-white"
                      >
                        {place}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm italic text-slate-500">
                    Belum ada riwayat tempat magang tersimpan di perangkat ini.
                  </p>
                )}
              </section>

              <section>
                <h4 className="mb-3 flex items-center justify-between text-sm font-black text-slate-700">
                  <span>🔍 Daftar dari Database</span>

                  {daftarTempatDb.length > 0 && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
                      {daftarTempatDb.length} Lokasi
                    </span>
                  )}
                </h4>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                  placeholder="Cari / Filter tempat magang..."
                  className="mb-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                />

                {loadingDb ? (
                  <div className="p-6 text-center">
                    <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />

                    <p className="text-xs font-bold text-slate-500">
                      Mengambil data dari server...
                    </p>
                  </div>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {daftarTempatDb
                      .filter((item) =>
                        String(item).toUpperCase().includes(searchQuery),
                      )
                      .map((item, idx) => (
                        <button
                          type="button"
                          key={`${item}-${idx}`}
                          onClick={() => handlePilihTempat(String(item))}
                          className="group flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3 text-left text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span className="truncate pr-2">{String(item)}</span>

                          <span className="shrink-0 rounded-md bg-blue-100 px-2 py-1 text-[10px] font-black text-blue-600 opacity-0 transition group-hover:opacity-100">
                            Pilih
                          </span>
                        </button>
                      ))}

                    {daftarTempatDb.filter((item) =>
                      String(item).toUpperCase().includes(searchQuery),
                    ).length === 0 && (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-6 text-center">
                        <p className="text-sm font-bold text-slate-500">
                          Belum ada tempat magang
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Data DUDI akan muncul setelah siswa magang
                          ditambahkan.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section>
                <h4 className="mb-3 text-sm font-black text-slate-700">
                  Atau ketik tempat magang baru
                </h4>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={inputTempatBaru}
                    onChange={(e) =>
                      setInputTempatBaru(e.target.value.toUpperCase())
                    }
                    placeholder="CONTOH: PT MAJU BERSAMA"
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
                  />

                  <button
                    type="button"
                    onClick={handleGunakanTempatBaru}
                    disabled={!inputTempatBaru.trim()}
                    className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Gunakan
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function TambahSiswaWaliPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="rounded-2xl bg-white px-6 py-5 shadow-lg">
            <p className="text-sm font-bold text-slate-600">
              Memuat halaman...
            </p>
          </div>
        </div>
      }
    >
      <TambahSiswaWaliContent />
    </Suspense>
  );
}
