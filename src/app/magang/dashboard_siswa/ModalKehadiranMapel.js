"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { getGuru, getMapelByGuru, getPresensiMapelGrid, uploadJawabanSiswa, getTugasMapel, getJawabanSiswa } from "../lib/api";

export function checkIsOnlineMapel(m) {
  if (!m) return false;
  const ket = String(m.keterangan || "").toUpperCase();
  const jns = String(m.jenisMapel || "").toUpperCase();
  const nama = String(m.namaMapel || "").toUpperCase();
  return ket.includes("ONLINE") || jns.includes("ONLINE") || nama.includes("ONLINE");
}

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
        "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
        "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
      ];
      return `${day} ${months[month] || parts[1]} ${year}`;
    }
    return tglStr;
  } catch (e) {
    return tglStr;
  }
}

export function extractYouTubeVideoId(url) {
  if (!url || typeof url !== "string") return null;
  const regExp = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url.match(regExp);
  return match ? match[1] : null;
}

export function parseTugasData(t) {
  if (!t) {
    return {
      ytId: null,
      ytUrl: null,
      downloadUrl: null,
      linkEksternal: null,
      deskripsiBersih: "",
    };
  }

  const rawDeskripsi = String(t.deskripsi || "");
  let ytId = null;
  let ytUrl = null;
  let downloadUrl = null;
  let linkEksternal = null;

  // 1. Ekstrak dari pola [LINK]: ... di deskripsi
  let linkFromDeskripsi = "";
  const tagMatch = rawDeskripsi.match(/\[LINK\]:\s*(https?:\/\/[^\s]+)/i);
  if (tagMatch) {
    linkFromDeskripsi = tagMatch[1].trim();
  }

  // 2. Ekstrak semua URL yang ada di deskripsi
  const urlsInDeskripsi = rawDeskripsi.match(/https?:\/\/[^\s<>"'\)]+/gi) || [];

  // 3. Kumpulkan semua calon link yang unik
  const candidatesSet = new Set();
  if (t.linkUrl && typeof t.linkUrl === "string") candidatesSet.add(t.linkUrl.trim());
  if (linkFromDeskripsi) candidatesSet.add(linkFromDeskripsi);
  urlsInDeskripsi.forEach((u) => candidatesSet.add(u.trim()));
  if (t.fileUrl && typeof t.fileUrl === "string") candidatesSet.add(t.fileUrl.trim());

  const allCandidates = Array.from(candidatesSet);

  // 4. Cari YouTube terlebih dahulu
  for (const u of allCandidates) {
    const yId = extractYouTubeVideoId(u);
    if (yId) {
      ytId = yId;
      ytUrl = u.startsWith("http") ? u : `https://www.youtube.com/watch?v=${yId}`;
      break;
    }
  }

  // 5. Cek download file (Google Drive atau berkas fisik)
  if (t.fileUrl && !extractYouTubeVideoId(t.fileUrl)) {
    downloadUrl = t.fileUrl;
  }

  // 6. Cek link eksternal (link apapun yang bukan YouTube)
  for (const u of allCandidates) {
    if (!extractYouTubeVideoId(u)) {
      if (!linkEksternal) {
        linkEksternal = u;
      }
    }
  }

  // Jika downloadUrl ada tapi linkEksternal belum ada, gunakan downloadUrl
  if (!linkEksternal && downloadUrl) {
    linkEksternal = downloadUrl;
  }

  // 7. Bersihkan teks deskripsi dari tag [LINK] dan url mentah
  const deskripsiBersih = rawDeskripsi
    .replace(/\[LINK\]:\s*\S+/gi, "")
    .replace(/https?:\/\/[^\s]+/gi, "")
    .trim();

  return {
    ytId,
    ytUrl,
    downloadUrl,
    linkEksternal,
    deskripsiBersih,
  };
}

export function findYouTubeFromTugas(tugasList) {
  if (!Array.isArray(tugasList)) return null;
  for (const t of tugasList) {
    if (!t) continue;
    const parsed = parseTugasData(t);
    if (parsed.ytId) {
      return { videoId: parsed.ytId, tugas: t, sourceUrl: parsed.ytUrl };
    }
  }
  return null;
}

export default function ModalKehadiranMapel({
  isOpen,
  onClose,
  user,
  fokusDaring = false,
}) {
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStageText, setLoadingStageText] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [mapelList, setMapelList] = useState([]);
  const [selectedMapelId, setSelectedMapelId] = useState(null);
  const [error, setError] = useState("");
  const [lastSync, setLastSync] = useState(null);

  // State untuk fitur upload tugas (mapel online)
  const [tugasPerMapel, setTugasPerMapel] = useState({}); // { idMapel: { pertemuanKe: [tugas] } }
  const [uploadState, setUploadState] = useState({}); // { "idMapel_pKe": { file, keterangan, loading, sukses, error } }
  const [pDipilihUpload, setPDipilihUpload] = useState(1);
  const fileInputRefs = useRef({});

  // ── Auto-pilih pertemuan terbaru yang memiliki tugas ──────────────────────
  // Saat mapel diganti atau data tugas baru masuk dari server, otomatis loncat
  // ke pertemuan tertinggi yang punya tugas agar siswa langsung melihat tugas.
  // Jika pertemuan yang sudah dipilih user sudah punya tugas, tidak di-reset.
  // ── Auto-pilih pertemuan terbaru yang memiliki tugas ──────────────────────
  // Saat mapel dibuka/diganti atau data tugas masuk dari server, otomatis pilih
  // pertemuan tertinggi (terbaru) yang memiliki tugas agar siswa langsung melihat tugas terbaru.
  useEffect(() => {
    if (!selectedMapelId) return;
    const tugasMapelIni = tugasPerMapel[selectedMapelId] || {};
    const tugasKeys = Object.keys(tugasMapelIni)
      .map(Number)
      .filter(
        (n) =>
          n > 0 &&
          Array.isArray(tugasMapelIni[String(n)]) &&
          tugasMapelIni[String(n)].length > 0,
      );
    if (tugasKeys.length > 0) {
      const maxP = Math.max(...tugasKeys);
      setPDipilihUpload(maxP);
    }
  }, [selectedMapelId]);

  useEffect(() => {
    if (!selectedMapelId) return;
    const tugasMapelIni = tugasPerMapel[selectedMapelId] || {};
    const tugasKeys = Object.keys(tugasMapelIni)
      .map(Number)
      .filter(
        (n) =>
          n > 0 &&
          Array.isArray(tugasMapelIni[String(n)]) &&
          tugasMapelIni[String(n)].length > 0,
      );
    if (tugasKeys.length > 0) {
      const maxP = Math.max(...tugasKeys);
      setPDipilihUpload((prev) => {
        // Jika prev belum disetel atau belum ada tugas di prev, gunakan maxP
        const prevAda = Array.isArray(tugasMapelIni[String(prev)]) && tugasMapelIni[String(prev)].length > 0;
        return prevAda ? prev : maxP;
      });
    }
  }, [tugasPerMapel]);
  // ─────────────────────────────────────────────────────────────────────────

  const CACHE_KEY = `cache_mapel_siswa_${user?.id}_${fokusDaring ? "daring" : "reguler"}`;
  const DISCOVER_CACHE_KEY = `cache_discovered_mapels_${user?.id}_${fokusDaring ? "daring" : "reguler"}`;

  // Refs untuk mencegah stale closure saat auto-update background
  const mapelListRef = useRef(mapelList);
  mapelListRef.current = mapelList;

  const selectedMapelIdRef = useRef(selectedMapelId);
  selectedMapelIdRef.current = selectedMapelId;

  const tugasPerMapelRef = useRef(tugasPerMapel);
  tugasPerMapelRef.current = tugasPerMapel;

  const uploadStateRef = useRef(uploadState);
  uploadStateRef.current = uploadState;

  // Helper simpan ke localStorage
  const saveCurrentStateToCache = useCallback(
    (customSyncTime, overrideMapel, overrideTugas, overrideUpload) => {
      try {
        const syncTime =
          customSyncTime ||
          new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          });
        const payload = {
          data: overrideMapel || mapelListRef.current,
          tugasPerMapel: overrideTugas || tugasPerMapelRef.current,
          uploadState: overrideUpload || uploadStateRef.current,
          syncTime,
          timestamp: Date.now(),
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch (e) {}
    },
    [CACHE_KEY]
  );

  // Ambil data detail (tugas, jawaban, presensi) untuk 1 mapel
  const enrichSingleMapel = useCallback(
    async (m) => {
      if (!m?.idMapel || !user?.id) return m;
      try {
        const [resTugas, resJwb, resGrid] = await Promise.all([
          getTugasMapel(m.idMapel, "").catch(() => null),
          getJawabanSiswa(m.idMapel, "", user.id).catch(() => null),
          m.idGuru
            ? getPresensiMapelGrid(m.idGuru, m.idMapel).catch(() => null)
            : Promise.resolve(null),
        ]);

        let newTugasMap = null;
        let newUploadMap = {};
        let tambahanPertemuan = [];

        // 1. Tugas dari Guru
        if (resTugas?.success && Array.isArray(resTugas.data)) {
          newTugasMap = {};
          resTugas.data.forEach((t) => {
            const pKe = String(t.pertemuanKe || "1");
            if (!newTugasMap[pKe]) newTugasMap[pKe] = [];
            newTugasMap[pKe].push(t);
          });
          setTugasPerMapel((prev) => ({ ...prev, [m.idMapel]: newTugasMap }));
        }

        // 2. Jawaban Siswa
        if (resJwb?.success && Array.isArray(resJwb.data)) {
          resJwb.data.forEach((j) => {
            const key = `${m.idMapel}_${j.pertemuanKe}`;
            newUploadMap[key] = {
              sukses: true,
              fileUrl: j.fileUrl,
              namaFile: j.namaFile || "Berkas Terkirim",
              keterangan: j.keterangan || "",
              waktu: j.createdAt || "",
            };
          });
          setUploadState((prev) => ({ ...prev, ...newUploadMap }));
        }

        // 3. Presensi & Nilai (Hanya pertemuan yang aktif di server guru)
        let updatedPertemuanList = [];
        let hadir = 0,
          sakit = 0,
          izin = 0,
          alfa = 0,
          cabut = 0;
        let totalNilai = 0,
          jumlahNilaiAda = 0;

        if (resGrid?.success && resGrid.data) {
          const presensiSemua = resGrid.data.presensi || [];
          const presensiSaya = presensiSemua.filter(
            (p) => String(p.idSiswa).trim() === String(user.id).trim()
          );

          // Himpunan pertemuan yang AKTIF di server guru (tidak dihapus)
          const validPertemuanSet = new Set();
          presensiSemua.forEach((p) => {
            const pNum = Number(p.pertemuanKe);
            if (pNum) validPertemuanSet.add(pNum);
          });
          if (newTugasMap) {
            Object.keys(newTugasMap).forEach((pStr) => {
              const pNum = Number(pStr);
              if (pNum) validPertemuanSet.add(pNum);
            });
          }

          const pMap = {};
          presensiSaya.forEach((p) => {
            const pKe = Number(p.pertemuanKe);
            if (pKe && validPertemuanSet.has(pKe)) {
              pMap[pKe] = {
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

              if (p.nilai !== null && p.nilai !== undefined && p.nilai !== "") {
                const val = Number(p.nilai);
                if (!isNaN(val)) {
                  totalNilai += val;
                  jumlahNilaiAda++;
                }
              }
            }
          });

          // Daftar pertemuan resmi: HANYA yang ada di validPertemuanSet, urut terbaru di atas (b - a)!
          const activeSortedP = Array.from(validPertemuanSet).sort((a, b) => b - a);
          updatedPertemuanList = activeSortedP.map((pNum) => {
            if (pMap[pNum]) return pMap[pNum];
            const sample = presensiSemua.find((p) => Number(p.pertemuanKe) === pNum);
            return {
              pertemuanKe: pNum,
              tanggal: sample?.tanggal || "",
              status: newTugasMap?.[String(pNum)] ? "Ada Tugas" : "-",
              nilai: null,
            };
          });
        } else {
          // Fallback jika grid belum termuat
          updatedPertemuanList = m.pertemuanList || [];
          hadir = m.hadir || 0;
          sakit = m.sakit || 0;
          izin = m.izin || 0;
          alfa = m.alfa || 0;
          cabut = m.cabut || 0;
        }

        const totalPertemuan = updatedPertemuanList.length;
        const persentaseHadir =
          totalPertemuan > 0 ? Math.round((hadir / totalPertemuan) * 100) : 0;
        const rataRataNilai =
          jumlahNilaiAda > 0
            ? Math.round((totalNilai / jumlahNilaiAda) * 10) / 10
            : m.rataRataNilai || null;

        const existingMapel = mapelListRef.current?.find(
          (item) => item.idMapel === m.idMapel
        );
        const namaGuruFinal =
          m.namaGuru || existingMapel?.namaGuru || "Guru Mapel";

        const enrichedMapel = {
          ...m,
          namaGuru: namaGuruFinal,
          hadir,
          sakit,
          izin,
          alfa,
          cabut,
          totalPertemuan,
          persentaseHadir,
          rataRataNilai,
          pertemuanList: updatedPertemuanList,
        };

        setMapelList((prevList) =>
          prevList.map((item) =>
            item.idMapel === m.idMapel ? enrichedMapel : item
          )
        );

        return enrichedMapel;
      } catch (e) {
        console.error("enrichSingleMapel error:", m.idMapel, e);
        return m;
      }
    },
    [user?.id]
  );

  // Pindai daftar mata pelajaran siswa dari server (Super Fast)
  const discoverMapelSiswa = useCallback(
    async (isSilent = false) => {
      // 1. Cek cache daftar mapel khusus sesuai jenis modal (reguler vs daring)
      try {
        const raw = localStorage.getItem(DISCOVER_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const list = Array.isArray(parsed) ? parsed : parsed?.data;
          if (Array.isArray(list) && list.length > 0) {
            const filtered = list.filter((m) =>
              fokusDaring ? checkIsOnlineMapel(m) : !checkIsOnlineMapel(m)
            );
            const valid = filtered.every((m) => m && m.namaGuru && m.namaGuru !== "Guru Mapel");
            if (valid && filtered.length > 0) {
              return filtered;
            }
          }
        }
      } catch (e) {}

      if (!isSilent) {
        setLoadingProgress(40);
        setLoadingStageText("Mengambil kurikulum mata pelajaran...");
      }

      // 2. Ambil master guru untuk mapping ID_GURU -> NAMA_GURU
      let guruMap = {};
      try {
        const cachedGuru = localStorage.getItem("cache_daftar_guru_map");
        if (cachedGuru) {
          guruMap = JSON.parse(cachedGuru);
        }
      } catch (e) {}

      let daftarGuru = [];
      if (Object.keys(guruMap).length === 0) {
        try {
          const resGuru = await getGuru();
          if (resGuru?.success && Array.isArray(resGuru.data)) {
            daftarGuru = resGuru.data;
            resGuru.data.forEach((g) => {
              const gId = String(g.ID || g.id || g.idGuru || "").trim();
              const gNama = g.NAMA_GURU || g.nama || "";
              if (gId) guruMap[gId] = gNama;
            });
            try {
              localStorage.setItem(
                "cache_daftar_guru_map",
                JSON.stringify(guruMap)
              );
            } catch (e) {}
          }
        } catch (e) {}
      }

      const namaMentah = String(user?.nama || "");
      const matchKelas = namaMentah.match(/\[(.*?)\]/);
      const kelasSiswa = matchKelas ? matchKelas[1].trim().toLowerCase() : "";

      let allMapels = [];

      // Coba ambil SEMUA mapel sekolah dalam 1 request cepat lewat getMapelByGuru("ALL")
      try {
        const resAll = await getMapelByGuru("ALL");
        if (resAll?.success && Array.isArray(resAll.data) && resAll.data.length > 0) {
          allMapels = resAll.data.map((m) => {
            const gId = String(m.idGuru || "").trim();
            return {
              ...m,
              namaGuru: m.namaGuru || guruMap[gId] || "Guru Mapel",
            };
          });
        }
      } catch (e) {}

      // Fallback: Jika belum ada endpoint ALL, ambil lewat daftar guru
      if (allMapels.length === 0) {
        if (!isSilent) {
          setLoadingProgress(48);
          setLoadingStageText("Mencocokkan data guru mapel...");
        }
        if (daftarGuru.length === 0) {
          const resGuru = await getGuru();
          daftarGuru =
            resGuru?.success && Array.isArray(resGuru.data) ? resGuru.data : [];
        }
        if (daftarGuru.length === 0) return [];

        const mapelPromises = daftarGuru.map(async (g) => {
          try {
            const gId = String(g.ID || g.id || g.idGuru || "").trim();
            const gNama = g.NAMA_GURU || g.nama || guruMap[gId] || "Guru Mapel";
            const res = await getMapelByGuru(gId);
            if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
              return res.data.map((m) => ({
                ...m,
                namaGuru: m.namaGuru || gNama,
                idGuru: gId,
              }));
            }
          } catch (e) {}
          return [];
        });
        allMapels = (await Promise.all(mapelPromises)).flat();
      }

      if (!isSilent) {
        setLoadingProgress(58);
        setLoadingStageText("Menyesuaikan rombel kelas siswa...");
      }

      const normK = (s) =>
        String(s || "")
          .toLowerCase()
          .replace(/kelas/g, "")
          .replace(/daring/g, "")
          .replace(/tjkt/g, "tkj")
          .replace(/[^a-z0-9]/g, "");

      const kSiswaNorm = normK(kelasSiswa);
      const kSiswaNoGrade = kSiswaNorm.replace(/^(x|xi|xii)/, "");

      const targetList =
        allMapels.length <= 40
          ? allMapels
          : allMapels.filter((m) => {
              const isOnline = checkIsOnlineMapel(m);
              if (isOnline) return true;
              if (!kSiswaNorm) return true;
              const kmNorm = normK(m.kelas);
              const kmNoGrade = kmNorm.replace(/^(x|xi|xii)/, "");
              return (
                !kmNorm ||
                kmNorm === kSiswaNorm ||
                kSiswaNorm.includes(kmNorm) ||
                kmNorm.includes(kSiswaNorm) ||
                (kmNoGrade && kSiswaNoGrade && kmNoGrade === kSiswaNoGrade)
              );
            });

      if (!isSilent) {
        setLoadingProgress(68);
        setLoadingStageText("Memvalidasi rombel siswa...");
      }

      // Cek enrollment siswa secara paralel cepat
      const enrolledResults = await Promise.all(
        targetList.map(async (m) => {
          try {
            const resGrid = await getPresensiMapelGrid(m.idGuru, m.idMapel);
            const kmNorm = normK(m.kelas);
            const kmNoGrade = kmNorm.replace(/^(x|xi|xii)/, "");
            const matchesExactClass =
              kSiswaNorm &&
              kmNorm &&
              (kmNorm === kSiswaNorm ||
                kSiswaNorm.includes(kmNorm) ||
                kmNorm.includes(kSiswaNorm) ||
                (kmNoGrade && kSiswaNoGrade && kmNoGrade === kSiswaNoGrade));

            const gId = String(m.idGuru || "").trim();
            const namaGuruFinal = m.namaGuru || guruMap[gId] || "Guru Mapel";
            const isOnline = checkIsOnlineMapel(m);

            // Saring ketat jenis mapel sesuai modal:
            // Tombol "Ruang Pembelajaran Online" (fokusDaring = true) HANYA untuk mapel online!
            // Tombol "Kehadiran Mapel" (fokusDaring = false) HANYA untuk mapel reguler biasa!
            if (fokusDaring && !isOnline) return null;
            if (!fokusDaring && isOnline) return null;

            const daftarSiswa = resGrid?.data?.siswa || [];
            const isEnrolled = daftarSiswa.some(
              (s) => String(s.idSiswa).trim() === String(user.id).trim()
            );

            // Aturan pendaftaran:
            // 1. Jika guru sudah menginput daftar siswa, siswa WAJIB terdaftar (isEnrolled)
            // 2. Jika grid belum ada daftar siswa sama sekali, hanya lolos jika kelasnya cocok persis
            let siswaValid = false;
            if (daftarSiswa.length > 0) {
              siswaValid = isEnrolled;
            } else if (!resGrid?.success || !resGrid?.data) {
              siswaValid = kSiswaNorm && kmNorm && (kmNorm === kSiswaNorm);
            } else {
              siswaValid = false;
            }

            if (!siswaValid) {
              return null;
            }

            return {
              ...m,
              namaGuru: namaGuruFinal,
              isOnline,
              totalPertemuan: 0,
              hadir: 0,
              sakit: 0,
              izin: 0,
              alfa: 0,
              cabut: 0,
              persentaseHadir: 0,
              rataRataNilai: null,
              pertemuanList: [],
            };
          } catch (e) {}
          return null;
        })
      );

      const enrolledMapels = enrolledResults.filter(Boolean);

      // Simpan ke discover cache khusus untuk modal ini (reguler atau daring terpisah)
      try {
        if (enrolledMapels.length > 0) {
          localStorage.setItem(
            DISCOVER_CACHE_KEY,
            JSON.stringify(enrolledMapels)
          );
        }
      } catch (e) {}

      return enrolledMapels;
    },
    [user?.id, user?.nama, fokusDaring, DISCOVER_CACHE_KEY]
  );

  // Fungsi sinkronisasi data utama (Cepat & Auto-Update)
  const refreshData = useCallback(
    async ({ fullScan = false, silent = false } = {}) => {
      if (!user?.id) return;

      if (!silent) {
        setLoading(true);
        setLoadingProgress(15);
        setLoadingStageText("Menghubungkan ke server akademik...");
      }
      setIsSyncing(true);
      setError("");

      try {
        let baseList = mapelListRef.current;

        // Jika belum ada mapel sama sekali atau diminta fullScan
        if (!baseList || baseList.length === 0 || fullScan) {
          if (!silent) {
            setLoadingProgress(35);
            setLoadingStageText("Memeriksa rombel mata pelajaran...");
          }
          baseList = await discoverMapelSiswa(silent);
          if (baseList.length === 0) {
            setMapelList([]);
            if (!silent) setLoading(false);
            setIsSyncing(false);
            return;
          }
          setMapelList(baseList);
        }

        // Tentukan mapel aktif
        const currentSelectedId =
          selectedMapelIdRef.current || baseList[0]?.idMapel;
        if (!selectedMapelIdRef.current && baseList[0]?.idMapel) {
          setSelectedMapelId(baseList[0].idMapel);
        }

        const activeMapel =
          baseList.find((m) => m.idMapel === currentSelectedId) || baseList[0];
        const otherMapels = baseList.filter(
          (m) => m.idMapel !== activeMapel?.idMapel
        );

        if (!silent) {
          setLoadingProgress(75);
          setLoadingStageText(`Mengambil tugas terbaru ${activeMapel?.namaMapel || ""}...`);
        }

        // 1. PRIORITAS UTAMA: Sinkronkan mapel yang sedang aktif dibuka siswa (Selesai ~1-2 detik!)
        if (activeMapel) {
          await enrichSingleMapel(activeMapel);
        }

        // 2. Sinkronkan sisa mapel lainnya dalam chunk 3 mapel sekaligus
        if (!silent) {
          setLoadingProgress(90);
          setLoadingStageText("Memperbarui seluruh mata pelajaran...");
        }

        for (let i = 0; i < otherMapels.length; i += 3) {
          const chunk = otherMapels.slice(i, i + 3);
          await Promise.all(chunk.map((m) => enrichSingleMapel(m)));
        }

        const syncTime = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        setLastSync(syncTime);
        saveCurrentStateToCache(syncTime);

        if (!silent) {
          setLoadingProgress(100);
          setLoadingStageText("Data mata pelajaran siap!");
        }
      } catch (err) {
        console.error("Gagal refresh data mapel:", err);
        if (!silent) {
          setError("Gagal menyinkronkan data mata pelajaran dari server.");
        }
      } finally {
        setIsSyncing(false);
        if (!silent) {
          setTimeout(() => setLoading(false), 200);
        }
      }
    },
    [user?.id, discoverMapelSiswa, enrichSingleMapel, saveCurrentStateToCache]
  );

  // Hook pembuka modal: INSTAN dari cache + AUTO-UPDATE di background
  useEffect(() => {
    if (!isOpen || !user?.id) return;

    // 1. Tampilkan cache lokal secara INSTAN (0 ms latency)
    let hasCache = false;
    let cacheMissingGuru = false;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        const list = Array.isArray(parsed?.data) ? parsed.data : [];
        const filteredList = list.filter((m) =>
          fokusDaring ? checkIsOnlineMapel(m) : !checkIsOnlineMapel(m)
        );

        if (filteredList.length > 0) {
          hasCache = true;
          let guruMapCached = {};
          try {
            const rawG = localStorage.getItem("cache_daftar_guru_map");
            if (rawG) guruMapCached = JSON.parse(rawG);
          } catch (e) {}

          const dataWithGuru = filteredList.map((m) => {
            const gId = String(m.idGuru || "").trim();
            const gNama = m.namaGuru || guruMapCached[gId] || "";
            if (!gNama || gNama === "Guru Mapel") cacheMissingGuru = true;
            return {
              ...m,
              namaGuru: gNama || "Guru Mapel",
            };
          });

          setMapelList(dataWithGuru);
          if (parsed.tugasPerMapel) setTugasPerMapel(parsed.tugasPerMapel);
          if (parsed.uploadState) setUploadState(parsed.uploadState);
          setLastSync(parsed.syncTime || null);
          setSelectedMapelId((prev) => {
            if (prev && dataWithGuru.some((m) => m.idMapel === prev)) return prev;
            return dataWithGuru[0]?.idMapel || null;
          });
        }
      }
    } catch (e) {
      console.error("Error membaca cache:", e);
    }

    // 2. AUTO-UPDATE: Selalu periksa data baru dari server di background!
    // Jika cache ada tapi nama guru kosong, lakukan scan ulang silent agar nama guru langsung ditarik
    if (hasCache) {
      refreshData({ fullScan: cacheMissingGuru, silent: true });
    } else {
      refreshData({ fullScan: true, silent: false });
    }
  }, [isOpen, user?.id, CACHE_KEY, refreshData]);

  // Handler upload jawaban siswa
  const handleUploadJawaban = async (mapelId, pertemuanKe, idTugas) => {
    const stateKey = `${mapelId}_${pertemuanKe}`;
    const current = uploadState[stateKey] || {};
    const file = current.file;
    if (!file) { alert("Pilih file terlebih dahulu."); return; }

    setUploadState((prev) => ({
      ...prev,
      [stateKey]: { ...current, loading: true, error: "", sukses: false },
    }));

    try {
      // Baca file sebagai base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const result = await uploadJawabanSiswa({
        idSiswa: user.id,
        namaSiswa: String(user.nama || "").replace(/\s*\[.*?\]\s*/g, "").trim(),
        idMapel: mapelId,
        idTugas: idTugas || "",
        pertemuanKe,
        keterangan: current.keterangan || "",
        fileBase64: base64,
        namaFile: file.name,
        mimeType: file.type || "application/octet-stream",
      });

      if (result?.success) {
        const updatedEntry = {
          ...current,
          loading: false,
          sukses: true,
          file: null,
          keterangan: "",
          namaFile: file.name,
          fileUrl: result.data?.fileUrl || "",
          waktu: new Date().toISOString(),
        };
        setUploadState((prev) => {
          const next = { ...prev, [stateKey]: updatedEntry };
          try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
              const parsed = JSON.parse(cached);
              parsed.uploadState = next;
              localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
            }
          } catch (e) {}
          return next;
        });
      } else {
        setUploadState((prev) => ({
          ...prev,
          [stateKey]: {
            ...current,
            loading: false,
            error: result?.message || "Gagal mengunggah jawaban.",
          },
        }));
      }
    } catch (err) {
      console.error("Error upload jawaban:", err);
      setUploadState((prev) => ({
        ...prev,
        [stateKey]: { ...current, loading: false, error: "Terjadi kesalahan saat mengunggah file." },
      }));
    }
  };

  if (!isOpen) return null;

  const mapelAktif =
    mapelList.find((m) => m.idMapel === selectedMapelId) || mapelList[0];

  // Deteksi apakah mapel aktif adalah mapel online
  const isMapelOnline = checkIsOnlineMapel(mapelAktif) || fokusDaring;
  const keteranganBersih = String(mapelAktif?.keterangan || "")
    .replace(/^\[ONLINE\]\s*/i, "")
    .trim();

  // Cari tugas terakhir/terbaru dari guru di mapel aktif
  const latestTaskInfo = (() => {
    if (!mapelAktif?.idMapel) return null;
    const tugasMap = tugasPerMapel[mapelAktif.idMapel] || {};
    const pKeys = Object.keys(tugasMap)
      .map(Number)
      .filter(
        (p) =>
          p > 0 &&
          Array.isArray(tugasMap[String(p)]) &&
          tugasMap[String(p)].length > 0
      )
      .sort((a, b) => b - a);

    if (pKeys.length === 0) return null;
    const latestP = pKeys[0];
    const tasksInP = tugasMap[String(latestP)] || [];
    const primaryTask = tasksInP[0];
    if (!primaryTask) return null;

    const parsed = parseTugasData(primaryTask);
    const ytInList = findYouTubeFromTugas(tasksInP);

    return {
      pertemuanKe: latestP,
      tasks: tasksInP,
      primaryTask,
      parsed,
      ytInfo:
        ytInList ||
        (parsed.ytId ? { videoId: parsed.ytId, sourceUrl: parsed.ytUrl } : null),
    };
  })();

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-2.5 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[94vh] sm:max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div
          className={`relative shrink-0 overflow-hidden ${
            fokusDaring
              ? "bg-gradient-to-r from-teal-950 via-teal-900 to-cyan-950"
              : "bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950"
          } px-3.5 py-2.5 sm:px-6 sm:py-4 text-white`}
        >
          <div className="absolute top-0 right-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-amber-400 opacity-10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between gap-2.5 relative z-10">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/20 text-lg sm:text-xl shadow-inner">
                {fokusDaring ? "💻" : "📚"}
              </div>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full bg-amber-400/20 text-amber-300 text-[8px] sm:text-[9px] font-black uppercase tracking-wider mb-0.5 border border-amber-400/30">
                  {fokusDaring
                    ? "E-Learning · Tugas Daring"
                    : "Akademik · Kehadiran Mapel"}
                </div>
                <h3 className="text-xs sm:text-base font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-blue-100 to-amber-100 truncate">
                  {fokusDaring
                    ? "Tugas Daring & Pembelajaran Mandiri"
                    : "Presensi & Nilai Mata Pelajaran"}
                </h3>
                <p className="text-[9px] sm:text-xs text-blue-200 font-medium truncate">
                  {fokusDaring
                    ? "Akses modul, tugas online, dan kumpulkan jawaban langsung ke guru"
                    : "Pantau rekap presensi dan nilai tiap pertemuan pelajaran reguler"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {loading && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/25 border border-amber-400/40 text-amber-300 text-[10px] font-black shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
                  <span>{loadingProgress}%</span>
                </div>
              )}
              <button
                onClick={() => refreshData({ fullScan: false, silent: false })}
                disabled={loading || isSyncing}
                title="Sinkronkan data terbaru"
                className="shrink-0 rounded-xl bg-white/10 hover:bg-white/25 px-2.5 py-1 text-xs font-bold text-white transition-all flex items-center gap-1 border border-white/20 disabled:opacity-50 cursor-pointer"
              >
                <span className={loading || isSyncing ? "animate-spin inline-block text-xs" : "text-xs"}>
                  🔄
                </span>
                <span className="hidden sm:inline text-xs">
                  {isSyncing ? "Sync..." : "Refresh"}
                </span>
              </button>
              <button
                onClick={onClose}
                className="shrink-0 rounded-full bg-white/10 hover:bg-white/25 w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center text-xs font-black text-white transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* SUBHEADER: STATUS & TABS */}
        <div className="shrink-0 bg-slate-100/90 border-b border-slate-200 px-3.5 sm:px-6 py-1.5 sm:py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs text-slate-600 font-medium overflow-x-auto py-0.5">
            <span className="font-bold text-slate-700 whitespace-nowrap">
              Mapel Diikuti: ({mapelList.length})
            </span>
            {lastSync && (
              <span className="text-[10px] text-slate-400 whitespace-nowrap hidden sm:inline">
                &middot; Terakhir sync {lastSync} WIB
              </span>
            )}
            {isSyncing && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded-full border border-blue-200">
                <span className="w-1 h-1 rounded-full bg-blue-600 animate-ping"></span>
                <span>Auto Update</span>
              </span>
            )}
          </div>
          {loading && (
            <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-blue-700 font-black">
              <span className="truncate max-w-[140px] hidden md:inline text-[10px] font-bold text-slate-500">
                {loadingStageText}
              </span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 border border-blue-200">
                {loadingProgress}%
              </span>
            </div>
          )}
        </div>

        {/* PROGRESS BAR PERSENTASE DI ATAS KONTEN */}
        {loading ? (
          <div className="shrink-0 w-full bg-slate-200/90 h-1.5 overflow-hidden border-b border-slate-300 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(loadingProgress, 100)}%` }}
            />
          </div>
        ) : isSyncing ? (
          <div className="shrink-0 w-full bg-blue-100 h-1 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-400 animate-pulse w-full" />
          </div>
        ) : null}

        {/* KONTEN UTAMA */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 bg-slate-50 space-y-3 sm:space-y-4">
          {error && (
            <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {loading && mapelList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-8 text-center max-w-md mx-auto my-4">
              {/* Meter Lingkaran Persentase */}
              <div className="relative flex items-center justify-center mb-6">
                <div className="w-24 h-24 rounded-full border-4 border-slate-200 border-t-blue-600 border-r-indigo-500 animate-spin" />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-slate-800 tracking-tight">
                    {loadingProgress}%
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Memuat
                  </span>
                </div>
              </div>

              {/* Box Progress Bar Persentase */}
              <div className="w-full space-y-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="truncate max-w-[280px] text-left text-blue-900 font-extrabold">
                    {loadingStageText || "Menyiapkan mata pelajaran..."}
                  </span>
                  <span className="text-blue-700 font-black shrink-0 ml-2 text-sm">
                    {loadingProgress}%
                  </span>
                </div>

                {/* Bar Persentase */}
                <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 shadow-sm transition-all duration-300 ease-out relative"
                    style={{ width: `${Math.min(loadingProgress, 100)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-400 font-medium text-left leading-relaxed">
                  Menghubungkan ke database sekolah untuk mengambil data kelas, kehadiran, dan materi tugas siswa...
                </p>
              </div>
            </div>
          ) : mapelList.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 sm:p-12 text-center shadow-sm">
              <div className="text-5xl mb-3">{fokusDaring ? "💻" : "📖"}</div>
              <h4 className="text-base font-black text-slate-800 mb-1">
                {fokusDaring
                  ? "Belum Ada Pembelajaran Online"
                  : "Belum Terdaftar di Mata Pelajaran Reguler"}
              </h4>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-4">
                {fokusDaring
                  ? "Kamu saat ini belum memiliki mata pelajaran online/daring yang aktif dari guru mapel."
                  : "Guru Mapel belum menambahkan kamu ke dalam daftar rombel mata pelajaran reguler mereka, atau belum ada jadwal presensi yang dibuka."}
              </p>
              <button
                onClick={() => refreshData({ fullScan: true, silent: false })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
              >
                🔄 Periksa Ulang Sekarang
              </button>
            </div>
          ) : (
            <div className="space-y-3.5 sm:space-y-4">
              {/* PILIHAN MAPEL (CHIPS/TABS) */}
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                {mapelList.map((m) => {
                  const isSelected = m.idMapel === mapelAktif?.idMapel;
                  const mIsOnline = checkIsOnlineMapel(m);
                  return (
                    <button
                      key={m.idMapel}
                      onClick={() => {
                        setSelectedMapelId(m.idMapel);
                      }}
                      className={`shrink-0 rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 text-left transition-all border ${
                        isSelected
                          ? "bg-gradient-to-r from-blue-700 to-indigo-800 text-white border-blue-600 shadow-xs scale-[1.01]"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{mIsOnline ? "🌐" : "📖"}</span>
                        <div>
                          <div className="text-[11px] sm:text-xs font-black leading-tight">
                            {m.namaMapel}
                          </div>
                          <div
                            className={`text-[9px] font-medium mt-0.5 flex items-center gap-1 ${isSelected ? "text-blue-200" : "text-slate-400"}`}
                          >
                            <span className="truncate max-w-[100px] sm:max-w-none">{m.namaGuru || "Guru Mapel"}</span>
                            {mIsOnline && (
                              <span className={`text-[8px] font-black px-1 py-0.2 rounded ${isSelected ? "bg-emerald-400/30 text-emerald-200" : "bg-emerald-100 text-emerald-700"}`}>
                                ONLINE
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* CARD DETAIL MAPEL AKTIF */}
              {mapelAktif && (
                <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 p-3 sm:p-4.5 shadow-xs space-y-3">
                  {/* HEADER MAPEL & RATA-RATA NILAI (RINGKAS & PADAT) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/90 border border-slate-200 rounded-xl p-2.5 sm:p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-slate-800 truncate">
                          {mapelAktif.namaMapel}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-[9px] font-black uppercase tracking-wider">
                          Kelas {mapelAktif.kelas || "-"}
                        </span>
                        {isMapelOnline && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                            🌐 Online
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                        Guru Pengampu: <strong className="text-slate-700">{mapelAktif.namaGuru || "Guru Mapel"}</strong>
                        {keteranganBersih ? ` · ${keteranganBersih}` : ""}
                      </p>
                    </div>

                    {/* RATA-RATA NILAI BADGE COMPACT */}
                    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl px-2.5 py-1 shrink-0 self-start sm:self-auto shadow-2xs">
                      <span className="text-sm sm:text-base">🏆</span>
                      <div className="text-left sm:text-right">
                        <span className="text-[8px] font-black uppercase text-amber-700 block leading-none">
                          Rata-rata Nilai
                        </span>
                        <span className="text-xs sm:text-sm font-black text-amber-900 leading-tight">
                          {mapelAktif.rataRataNilai !== null
                            ? mapelAktif.rataRataNilai
                            : "--"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* MINI BADGE STRIP PRESENSI MAPEL (KOMPAK & PADAT) */}
                  <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
                    <div className="rounded-lg bg-emerald-50/90 border border-emerald-200 py-1 px-0.5 text-center">
                      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-emerald-700 block leading-none mb-0.5">
                        Hadir
                      </span>
                      <span className="text-xs sm:text-sm font-black text-emerald-900 leading-none">
                        {mapelAktif.hadir}
                      </span>
                    </div>
                    <div className="rounded-lg bg-blue-50/90 border border-blue-200 py-1 px-0.5 text-center">
                      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-blue-700 block leading-none mb-0.5">
                        Sakit
                      </span>
                      <span className="text-xs sm:text-sm font-black text-blue-900 leading-none">
                        {mapelAktif.sakit}
                      </span>
                    </div>
                    <div className="rounded-lg bg-amber-50/90 border border-amber-200 py-1 px-0.5 text-center">
                      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-amber-700 block leading-none mb-0.5">
                        Izin
                      </span>
                      <span className="text-xs sm:text-sm font-black text-amber-900 leading-none">
                        {mapelAktif.izin}
                      </span>
                    </div>
                    <div className="rounded-lg bg-rose-50/90 border border-rose-200 py-1 px-0.5 text-center">
                      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-rose-700 block leading-none mb-0.5">
                        Alfa
                      </span>
                      <span className="text-xs sm:text-sm font-black text-rose-900 leading-none">
                        {mapelAktif.alfa}
                      </span>
                    </div>
                    <div className="rounded-lg bg-purple-50/90 border border-purple-200 py-1 px-0.5 text-center">
                      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-purple-700 block leading-none mb-0.5">
                        Cabut
                      </span>
                      <span className="text-xs sm:text-sm font-black text-purple-900 leading-none">
                        {mapelAktif.cabut}
                      </span>
                    </div>
                    <div className="rounded-lg bg-indigo-50/90 border border-indigo-200 py-1 px-0.5 text-center">
                      <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-indigo-700 block leading-none mb-0.5">
                        % Hadir
                      </span>
                      <span className="text-xs sm:text-sm font-black text-indigo-900 leading-none">
                        {mapelAktif.persentaseHadir}%
                      </span>
                    </div>
                  </div>

                  {/* ======================================================== */}
                  {/* BANNER / CARD: TUGAS TERAKHIR DARI GURU (TAMPIL DI PALING ATAS) */}
                  {/* ======================================================== */}
                  {latestTaskInfo && (
                    <div className="rounded-2xl bg-gradient-to-br from-indigo-950 via-slate-900 to-blue-950 text-white p-3.5 sm:p-4 border border-indigo-400/40 shadow-md space-y-3 relative overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400 text-slate-950 text-sm font-black shadow-xs shrink-0">
                            📌
                          </span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wide">
                                Tugas Terakhir Dari Guru
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow-2xs">
                                Pertemuan {latestTaskInfo.pertemuanKe} (Terbaru)
                              </span>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-slate-300 font-medium">
                              Instruksi dan materi aktif terkini dari {mapelAktif.namaGuru || "Guru Mapel"}
                            </p>
                          </div>
                        </div>

                        {isMapelOnline && (
                          <button
                            type="button"
                            onClick={() => {
                              setPDipilihUpload(latestTaskInfo.pertemuanKe);
                              const uploadEl = document.getElementById("panel-upload-tugas-siswa");
                              if (uploadEl) {
                                uploadEl.scrollIntoView({ behavior: "smooth", block: "start" });
                              }
                            }}
                            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                          >
                            <span>📤</span>
                            <span>Kumpulkan Tugas P-{latestTaskInfo.pertemuanKe}</span>
                          </button>
                        )}
                      </div>

                      {/* JIKA ADA VIDEO YOUTUBE PADA TUGAS TERAKHIR: TAMPILKAN DI PALING ATAS! */}
                      {latestTaskInfo.ytInfo && (
                        <div className="rounded-xl overflow-hidden bg-black/60 border border-white/15 p-2 sm:p-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2 px-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-red-500 text-base">▶️</span>
                              <span className="text-[11px] font-black text-white uppercase tracking-wider truncate">
                                Video Pembelajaran · Pertemuan {latestTaskInfo.pertemuanKe}
                              </span>
                            </div>
                            <a
                              href={latestTaskInfo.ytInfo.sourceUrl || `https://www.youtube.com/watch?v=${latestTaskInfo.ytInfo.videoId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-black transition-all flex items-center gap-1 shadow-xs active:scale-95"
                            >
                              <span>Tonton di YouTube</span>
                              <span>↗</span>
                            </a>
                          </div>
                          <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black shadow-inner border border-white/10">
                            <iframe
                              src={`https://www.youtube.com/embed/${latestTaskInfo.ytInfo.videoId}?rel=0`}
                              title={`Video Materi Pertemuan ${latestTaskInfo.pertemuanKe}`}
                              className="w-full h-full border-0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      )}

                      {/* DAFTAR TUGAS DI PERTEMUAN TERAKHIR */}
                      <div className="space-y-2">
                        {latestTaskInfo.tasks.map((t, idx) => {
                          const parsed = parseTugasData(t);
                          return (
                            <div
                              key={t.idTugas || idx}
                              className="rounded-xl bg-white/10 border border-white/15 p-3 space-y-2 backdrop-blur-xs"
                            >
                              <div className="min-w-0">
                                <h6 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                                  <span>📝</span>
                                  <span>{t.judulTugas || `Tugas Pertemuan ${latestTaskInfo.pertemuanKe}`}</span>
                                </h6>
                                {parsed.deskripsiBersih && (
                                  <p className="text-[11px] sm:text-xs text-slate-200 mt-1 leading-relaxed whitespace-pre-line font-medium bg-black/25 p-2.5 rounded-lg border border-white/10">
                                    {parsed.deskripsiBersih}
                                  </p>
                                )}
                              </div>

                              {/* TOMBOL-TOMBOL TAUTAN, YOUTUBE, & UNDUHAN */}
                              <div className="flex items-center gap-2 flex-wrap pt-1">
                                {parsed.ytId && (
                                  <a
                                    href={`https://www.youtube.com/watch?v=${parsed.ytId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[11px] font-black shadow-xs transition-all active:scale-95"
                                  >
                                    <span>▶️</span>
                                    <span>Tonton Video YouTube</span>
                                    <span>↗</span>
                                  </a>
                                )}

                                {parsed.linkEksternal && (
                                  <a
                                    href={parsed.linkEksternal}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-[11px] font-black shadow-xs transition-all active:scale-95"
                                  >
                                    <span>🔗</span>
                                    <span>Buka Link Tugas / Materi</span>
                                    <span>↗</span>
                                  </a>
                                )}

                                {parsed.downloadUrl && parsed.downloadUrl !== parsed.linkEksternal && (
                                  <a
                                    href={parsed.downloadUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-slate-950 text-[11px] font-black shadow-xs transition-all active:scale-95"
                                  >
                                    <span>📥</span>
                                    <span>Unduh Modul / Lembar Kerja</span>
                                    <span>↗</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ======================================================== */}
                  {/* PANEL UTAMA: UPLOAD TUGAS SISWA (MAPEL ONLINE)           */}
                  {/* ======================================================== */}
                  {isMapelOnline && (
                    <div id="panel-upload-tugas-siswa" className="rounded-2xl bg-gradient-to-br from-emerald-50/90 via-teal-50/80 to-blue-50/80 border border-emerald-300 p-3 sm:p-4 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white text-base shadow-xs">
                            📤
                          </div>
                          <div>
                            <h5 className="text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                              <span>Upload &amp; Pengumpulan Tugas</span>
                              <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-800">ONLINE</span>
                            </h5>
                            <p className="text-[10px] text-emerald-700 font-medium">
                              Kirimkan berkas tugas/jawaban Anda langsung ke Guru Mapel
                            </p>
                          </div>
                        </div>

                        {/* PILIH PERTEMUAN */}
                        {(() => {
                          const pListCount = mapelAktif.pertemuanList?.length || 0;
                          const tugasMapelIni = tugasPerMapel[mapelAktif.idMapel] || {};
                          const tugasKeys = Object.keys(tugasMapelIni).map(Number).filter(Boolean);
                          const maxPMapel = Math.max(pListCount, ...tugasKeys, 1);
                          // Buat array pertemuan dari tertinggi ke terendah (terbaru di atas)
                          const pertemuanArr = Array.from({ length: maxPMapel }, (_, idx) => maxPMapel - idx);
                          return (
                            <div className="flex items-center gap-1.5 shrink-0 bg-white/90 border border-emerald-300 rounded-lg px-2 py-1 self-start sm:self-auto shadow-2xs">
                              <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">
                                Pertemuan:
                              </span>
                              <select
                                value={Math.min(pDipilihUpload, maxPMapel)}
                                onChange={(e) => setPDipilihUpload(Number(e.target.value))}
                                className="bg-transparent font-black text-xs text-emerald-900 outline-none cursor-pointer"
                              >
                                {pertemuanArr.map((pNum) => {
                                  const adaTugas = Array.isArray(tugasMapelIni[String(pNum)]) && tugasMapelIni[String(pNum)].length > 0;
                                  return (
                                    <option key={pNum} value={pNum}>
                                      P-{pNum}{adaTugas ? " 📌" : ""}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })()}
                      </div>

                      {/* INFO TUGAS DARI GURU UNTUK PERTEMUAN INI */}
                      {(() => {
                        const pListCount = mapelAktif.pertemuanList?.length || 0;
                        const tugasKeys = Object.keys(tugasPerMapel[mapelAktif.idMapel] || {}).map(Number).filter(Boolean);
                        const maxPMapel = Math.max(pListCount, ...tugasKeys, 1);
                        const pAktif = Math.min(Math.max(1, pDipilihUpload), maxPMapel);

                        const tugasList = tugasPerMapel[mapelAktif.idMapel]?.[String(pAktif)] || [];
                        const ytInfo = findYouTubeFromTugas(tugasList);
                        const stateKey = `${mapelAktif.idMapel}_${pAktif}`;
                        const upState = uploadState[stateKey] || {};

                        return (
                          <div className="space-y-2.5">
                            {/* JIKA MEMILIH TUGAS TERBARU: HINDARI DUPLIKASI MATERI KARENA SUDAH LENGKAP DI ATAS */}
                            {latestTaskInfo && pAktif === latestTaskInfo.pertemuanKe ? (
                              <div className="rounded-xl bg-emerald-100/70 border border-emerald-300/80 px-3 py-1.5 flex items-center justify-between text-xs">
                                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                                  <span>📎</span>
                                  <span>Pengumpulan Tugas Pertemuan {pAktif} (Materi Lengkap di Atas)</span>
                                </span>
                                <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-emerald-200 text-emerald-800">
                                  Tugas Terbaru
                                </span>
                              </div>
                            ) : (
                              /* JIKA MEMILIH PERTEMUAN LAMA: TAMPILKAN MATERI LAMA SECARA KOMPAK */
                              <div className="space-y-2">
                                {ytInfo && (
                                  <div className="rounded-xl overflow-hidden bg-slate-900 border border-red-500/40 p-2 text-white space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 px-1">
                                      <span className="text-[11px] font-black text-white flex items-center gap-1 truncate">
                                        <span>▶️</span> Video Pembelajaran P-{pAktif}
                                      </span>
                                      <a
                                        href={ytInfo.sourceUrl || `https://www.youtube.com/watch?v=${ytInfo.videoId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-[9px] font-black shrink-0"
                                      >
                                        Tonton ↗
                                      </a>
                                    </div>
                                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
                                      <iframe
                                        src={`https://www.youtube.com/embed/${ytInfo.videoId}?rel=0`}
                                        title={`Video Materi P-${pAktif}`}
                                        className="w-full h-full border-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                      />
                                    </div>
                                  </div>
                                )}

                                {tugasList.length > 0 ? (
                                  <div className="rounded-xl bg-white border border-blue-200 p-2.5 space-y-1.5 shadow-2xs">
                                    <div className="flex items-center justify-between text-[10px] font-black text-blue-700 uppercase">
                                      <span>📋 Modul Guru (Pertemuan {pAktif})</span>
                                      <span className="px-1.5 py-0.2 rounded-full bg-blue-100">{tugasList.length} Tugas</span>
                                    </div>
                                    {tugasList.map((t, ti) => {
                                      const { ytId, downloadUrl, linkEksternal, deskripsiBersih } = parseTugasData(t);
                                      return (
                                        <div key={ti} className="bg-blue-50/70 p-2 rounded-lg border border-blue-100 space-y-1">
                                          <p className="text-xs font-bold text-slate-800 leading-snug">
                                            {t.judulTugas || `Tugas P-${pAktif}`}
                                          </p>
                                          {deskripsiBersih && (
                                            <p className="text-[10px] text-slate-600 leading-relaxed whitespace-pre-line">
                                              {deskripsiBersih}
                                            </p>
                                          )}
                                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                                            {ytId && (
                                              <a
                                                href={`https://www.youtube.com/watch?v=${ytId}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[9px] font-black shadow-2xs"
                                              >
                                                ▶ Video
                                              </a>
                                            )}
                                            {linkEksternal && (
                                              <a
                                                href={linkEksternal}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2 py-0.5 rounded-md bg-teal-600 text-white text-[9px] font-black shadow-2xs"
                                              >
                                                🔗 Buka Link
                                              </a>
                                            )}
                                            {downloadUrl && downloadUrl !== linkEksternal && (
                                              <a
                                                href={downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2 py-0.5 rounded-md bg-blue-600 text-white text-[9px] font-black shadow-2xs"
                                              >
                                                📥 Unduh Modul
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-lg bg-white/70 border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-500 italic">
                                    ℹ️ Belum ada lampiran modul khusus untuk Pertemuan {pAktif}. Anda dapat langsung mengunggah berkas jawaban di bawah.
                                  </div>
                                )}
                              </div>
                            )}

                            {/* STATUS & FORM UPLOAD JAWABAN SISWA (KOMPAK & RESPONSIF) */}
                            {upState.sukses ? (
                              <div className="rounded-xl bg-emerald-100 border border-emerald-300 p-2.5 sm:p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-2xs">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl">✅</span>
                                  <div>
                                    <p className="text-xs font-black text-emerald-900 leading-tight">
                                      Tugas Pertemuan {pAktif} Berhasil Dikirim!
                                    </p>
                                    <p className="text-[10px] text-emerald-700 font-medium">
                                      Berkas: <strong>{upState.namaFile || "Berkas Jawaban"}</strong>
                                      {upState.waktu ? ` · Dikirim ${upState.waktu.substring(0, 10)}` : ""}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {upState.fileUrl && (
                                    <a
                                      href={upState.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1 rounded-lg bg-white border border-emerald-400 text-emerald-800 text-[10px] font-black hover:bg-emerald-50 transition-all shadow-2xs"
                                    >
                                      📄 Buka Berkas
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setUploadState((prev) => ({ ...prev, [stateKey]: {} }))}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-black transition-all shadow-2xs active:scale-95 cursor-pointer"
                                  >
                                    🔄 Ganti Berkas
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-xl bg-white border border-emerald-200 p-2.5 sm:p-3 space-y-2 shadow-2xs">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-800 flex items-center gap-1">
                                    <span>📎</span>
                                    <span>Pilih Berkas Jawaban (P-{pAktif})</span>
                                  </span>
                                  <span className="text-[9px] sm:text-[10px] text-slate-400">PDF, DOC, Gambar, ZIP (Maks 10MB)</span>
                                </div>

                                <div className="grid gap-2 sm:grid-cols-2">
                                  <label className="cursor-pointer block">
                                    <div
                                      className={`rounded-xl border-2 border-dashed p-2 sm:p-2.5 text-center transition-all ${
                                        upState.file
                                          ? "border-emerald-500 bg-emerald-50/80 text-emerald-800"
                                          : "border-slate-300 bg-slate-50 hover:border-emerald-400 text-slate-600"
                                      }`}
                                    >
                                      {upState.file ? (
                                        <div className="text-xs font-black truncate">
                                          📄 {upState.file.name}
                                        </div>
                                      ) : (
                                        <div className="text-[11px] sm:text-xs font-bold text-slate-500">
                                          📂 Klik untuk memilih berkas...
                                        </div>
                                      )}
                                    </div>
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setUploadState((prev) => ({
                                          ...prev,
                                          [stateKey]: {
                                            ...prev[stateKey],
                                            file,
                                            error: "",
                                            sukses: false,
                                          },
                                        }));
                                      }}
                                    />
                                  </label>

                                  <input
                                    type="text"
                                    value={upState.keterangan || ""}
                                    onChange={(e) =>
                                      setUploadState((prev) => ({
                                        ...prev,
                                        [stateKey]: {
                                          ...prev[stateKey],
                                          keterangan: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="Catatan pengerjaan (opsional)..."
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 outline-none focus:border-emerald-500"
                                  />
                                </div>

                                {upState.error && (
                                  <p className="text-[11px] font-bold text-rose-600">⚠️ {upState.error}</p>
                                )}

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUploadJawaban(
                                      mapelAktif.idMapel,
                                      pAktif,
                                      tugasList[0]?.idTugas || ""
                                    )
                                  }
                                  disabled={!upState.file || upState.loading}
                                  className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 active:scale-98 text-white font-black text-xs py-2 shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span>{upState.loading ? "⏳" : "📤"}</span>
                                  <span>
                                    {upState.loading
                                      ? "Sedang Mengirim Berkas ke Server..."
                                      : `Kirim Tugas Pertemuan ${pAktif}`}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* DAFTAR PERTEMUAN (TANPA DUPLIKAT TUGAS TERBARU) */}
                  {(() => {
                    // Saring agar pertemuan tugas terbaru TIDAK diduplikasi pada riwayat
                    const riwayatPertemuan = (mapelAktif.pertemuanList || []).filter(
                      (item) => !latestTaskInfo || item.pertemuanKe !== latestTaskInfo.pertemuanKe
                    );

                    return (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center justify-between gap-2">
                          <h5 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <span>📅</span>
                            <span>
                              {latestTaskInfo
                                ? "Riwayat Pertemuan Sebelumnya"
                                : "Riwayat Presensi & Pertemuan"}
                              {" "}({riwayatPertemuan.length})
                            </span>
                          </h5>
                          {latestTaskInfo && (
                            <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">
                              Tugas P-{latestTaskInfo.pertemuanKe} aktif di atas
                            </span>
                          )}
                        </div>

                        {riwayatPertemuan.length === 0 ? (
                          <div className="rounded-xl bg-slate-50 border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 font-medium">
                            {latestTaskInfo
                              ? `Pertemuan ${latestTaskInfo.pertemuanKe} adalah materi/tugas aktif saat ini dan ditampilkan di bagian atas.`
                              : "Belum ada riwayat pertemuan yang tercatat untuk mata pelajaran ini."}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {riwayatPertemuan.map((item) => {
                              const stateKey = `${mapelAktif.idMapel}_${item.pertemuanKe}`;
                              const upState = uploadState[stateKey] || {};
                              const tugasGuru = tugasPerMapel[mapelAktif.idMapel]?.[String(item.pertemuanKe)] || [];

                              return (
                                <div
                                  key={item.pertemuanKe}
                                  className="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs hover:border-slate-300 transition-all space-y-2"
                                >
                                  {/* Baris utama: Pertemuan, Tanggal, Nilai, Status Presensi */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-black shadow-2xs ${isMapelOnline ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-slate-100 border-slate-200 text-slate-700"}`}>
                                        P{item.pertemuanKe}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                                          <span>Pertemuan {item.pertemuanKe}</span>
                                          {tugasGuru.length > 0 && (
                                            <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-blue-100 text-blue-700 uppercase">
                                              Ada Tugas
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-medium">
                                          {formatTanggalMapel(item.tanggal)}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      {item.nilai !== null && item.nilai !== undefined && (
                                        <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-black shadow-2xs">
                                          ⭐ {item.nilai}
                                        </span>
                                      )}
                                      <span className={`px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black border shadow-2xs ${warnaStatus(item.status)}`}>
                                        {item.status}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Jika ada materi / tugas di pertemuan lama ini */}
                                  {tugasGuru.length > 0 && (
                                    <div className="rounded-lg bg-slate-50 border border-slate-200/80 p-2 space-y-1.5 text-xs">
                                      {tugasGuru.map((t, ti) => {
                                        const { ytId, downloadUrl, linkEksternal, deskripsiBersih } = parseTugasData(t);
                                        return (
                                          <div key={ti} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                            <div className="min-w-0 flex-1">
                                              <span className="text-[11px] font-bold text-slate-700 line-clamp-1">
                                                📝 {t.judulTugas || `Tugas P-${item.pertemuanKe}`}
                                              </span>
                                              {deskripsiBersih && (
                                                <p className="text-[10px] text-slate-500 line-clamp-1">
                                                  {deskripsiBersih}
                                                </p>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0 flex-wrap">
                                              {ytId && (
                                                <a
                                                  href={`https://www.youtube.com/watch?v=${ytId}`}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-[9px] font-black shadow-2xs flex items-center gap-0.5"
                                                >
                                                  <span>▶</span>
                                                  <span>Video</span>
                                                </a>
                                              )}
                                              {linkEksternal && (
                                                <a
                                                  href={linkEksternal}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-2 py-0.5 rounded-md bg-teal-600 hover:bg-teal-700 text-white text-[9px] font-black shadow-2xs flex items-center gap-0.5"
                                                >
                                                  <span>🔗</span>
                                                  <span>Link</span>
                                                </a>
                                              )}
                                              {downloadUrl && downloadUrl !== linkEksternal && (
                                                <a
                                                  href={downloadUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black shadow-2xs flex items-center gap-0.5"
                                                >
                                                  <span>📥</span>
                                                  <span>Modul</span>
                                                </a>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* Status Pengumpulan Jawaban di Pertemuan Lama (Khusus Mapel Online) */}
                                  {isMapelOnline && (
                                    <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px]">
                                      {upState.sukses ? (
                                        <div className="flex items-center gap-1.5 text-emerald-700 font-bold truncate">
                                          <span>✅</span>
                                          <span className="truncate">Terkirim: {upState.namaFile || "Berkas Jawaban"}</span>
                                          {upState.fileUrl && (
                                            <a
                                              href={upState.fileUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 underline font-semibold ml-1 shrink-0"
                                            >
                                              Lihat
                                            </a>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                          <span>⚪</span>
                                          <span>Belum dikumpulkan</span>
                                        </div>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => {
                                          setPDipilihUpload(item.pertemuanKe);
                                          const el = document.getElementById("panel-upload-tugas-siswa");
                                          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 font-black text-[9px] transition-all cursor-pointer shrink-0"
                                      >
                                        {upState.sukses ? "🔄 Upload Ulang" : "📤 Kumpulkan Susulan"}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4 flex items-center justify-between">
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
            Data disinkronkan dengan aplikasi Presensi &amp; Jurnal Guru Mapel
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
