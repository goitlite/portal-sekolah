"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  getPresensiWaliGrid,
  getBiodataSiswa,
  getWajahBulk,
  uploadPhoto,
  updateBiodataSiswa,
} from "../../lib/api";
import {
  loadFaceApi,
  checkFaceDuplicate,
  writeCachedDescriptor,
  loadImage,
} from "../../lib/faceApiHelper";
import ModalRegistrasiWajahSiswa from "../../dashboard_siswa/ModalRegistrasiWajahSiswa";

function driveThumb(url) {
  if (!url) return "";
  let id = "";
  if (url.includes("/file/d/")) id = url.split("/file/d/")[1].split("/")[0];
  else if (url.includes("id=")) id = url.split("id=")[1].split("&")[0];
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w200` : url;
}

export default function ModalRegistrasiWajahWaliKelas({
  isOpen,
  onClose,
  guru,
  wali,
}) {
  const [loading, setLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState(0);
  const [siswaList, setSiswaList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState("semua"); // "semua" | "antrian" | "terdaftar" | "belum"
  const [activeSiswaToRegister, setActiveSiswaToRegister] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Staging state untuk registrasi massal
  const [stagedPhotos, setStagedPhotos] = useState({});
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    current: 0,
    pct: 0,
    currentStudentName: "",
    stepText: "",
    successCount: 0,
    failCount: 0,
    isComplete: false,
    errors: [],
  });

  const waliId = wali?.idWali;
  const guruId = guru?.id;
  const localCacheKey = useMemo(() => `cached_face_urls_${waliId}`, [waliId]);
  const stagedStorageKey = useMemo(() => `staged_face_photos_${waliId}`, [waliId]);

  // Muat staged photos dari localStorage saat modal dibuka
  useEffect(() => {
    if (!waliId) return;
    try {
      const saved = localStorage.getItem(stagedStorageKey);
      if (saved) {
        setStagedPhotos(JSON.parse(saved) || {});
      }
    } catch (_) {}
  }, [waliId, stagedStorageKey]);

  const loadSiswaDanFoto = useCallback(async (force = false) => {
    if (!waliId || !guruId) return;

    if (force) setRefreshing(true);
    else setLoading(true);
    setLoadProgress(10);

    try {
      // 1. Ambil daftar siswa rombel dari spreadsheet
      const res = await getPresensiWaliGrid(guruId, waliId);
      const rawSiswa = (res?.success && res.data?.siswa) || [];
      const normalized = rawSiswa
        .map((s) => ({
          idSiswa: String(s.idSiswa || s.id || "").trim(),
          nama: (s.nama || s.namaSiswa || "").trim(),
          kelas: s.kelas || wali?.namaKelas || "",
          fotoWajah: null,
        }))
        .filter((s) => s.idSiswa)
        .sort((a, b) => a.nama.localeCompare(b.nama));

      setLoadProgress(25);

      // 2. Baca URL foto dari cache lokal
      let urlCache = {};
      if (!force) {
        try {
          const saved = localStorage.getItem(localCacheKey);
          if (saved) urlCache = JSON.parse(saved) || {};
        } catch (_) {}
      }

      // Pasang foto dari cache dulu jika ada
      normalized.forEach((s) => {
        let fUrl = urlCache[s.idSiswa] || null;
        if (!fUrl) {
          try {
            const savedReg = localStorage.getItem(`face_reg_${s.idSiswa}`);
            if (savedReg) {
              const parsed = JSON.parse(savedReg);
              if (parsed?.fotoWajah) fUrl = parsed.fotoWajah;
            }
          } catch (_) {}
        }
        if (fUrl) {
          s.fotoWajah = fUrl;
          urlCache[s.idSiswa] = fUrl;
        }
      });

      setSiswaList([...normalized]);

      // 3. Ambil data foto dari biodata server secara bertahap untuk siswa yang belum ada fotonya
      const missing = normalized.filter((s) => !s.fotoWajah || force);
      if (missing.length > 0) {
        const missingIds = missing.map((s) => s.idSiswa);
        let bulkSuccess = false;
        try {
          const bulkRes = await getWajahBulk(missingIds);
          if (bulkRes?.success && bulkRes.data) {
            Object.entries(bulkRes.data).forEach(([id, url]) => {
              if (url) {
                const st = normalized.find((s) => s.idSiswa === id);
                if (st) {
                  st.fotoWajah = url;
                  urlCache[id] = url;
                }
              }
            });
            bulkSuccess = true;
          }
        } catch (_) {}

        // Fallback jika getWajahBulk belum ada atau masih ada yang belum ditemukan
        const stillMissing = bulkSuccess
          ? normalized.filter((s) => !s.fotoWajah && force)
          : missing;

        if (stillMissing.length > 0) {
          const BATCH_SIZE = 5;
          const totalMissing = stillMissing.length;
          for (let i = 0; i < totalMissing; i += BATCH_SIZE) {
            const batch = stillMissing.slice(i, i + BATCH_SIZE);
            await Promise.allSettled(
              batch.map(async (st) => {
                try {
                  const bio = await getBiodataSiswa(st.idSiswa);
                  if (bio?.success && bio.data?.fotoWajah) {
                    st.fotoWajah = bio.data.fotoWajah;
                    urlCache[st.idSiswa] = bio.data.fotoWajah;
                  }
                } catch (_) {}
              }),
            );
            setLoadProgress(25 + Math.round(((i + batch.length) / totalMissing) * 75));
          }
        }
        setSiswaList([...normalized]);
        try {
          localStorage.setItem(localCacheKey, JSON.stringify(urlCache));
        } catch (_) {}
      } else {
        setLoadProgress(100);
      }
    } catch (err) {
      console.error("Gagal memuat siswa untuk registrasi wajah:", err);
    } finally {
      setLoadProgress(100);
      setLoading(false);
      setRefreshing(false);
    }
  }, [guruId, waliId, localCacheKey, wali?.namaKelas]);

  useEffect(() => {
    if (isOpen) {
      loadSiswaDanFoto();
    }
  }, [isOpen, loadSiswaDanFoto]);

  // Statistik terdaftar & staged
  const stats = useMemo(() => {
    const total = siswaList.length;
    const terdaftar = siswaList.filter((s) => !!s.fotoWajah).length;
    const stagedCount = Object.keys(stagedPhotos).length;
    const belum = Math.max(0, total - terdaftar - stagedCount);
    const persen = total > 0 ? Math.round(((terdaftar + stagedCount) / total) * 100) : 0;
    return { total, terdaftar, stagedCount, belum, persen };
  }, [siswaList, stagedPhotos]);

  // Staged Photos Handlers
  const handleStagePhoto = useCallback(
    (idSiswa, base64Photo, userInfo) => {
      setStagedPhotos((prev) => {
        const updated = {
          ...prev,
          [idSiswa]: {
            idSiswa,
            nama: userInfo?.nama || "",
            kelas: userInfo?.kelas || wali?.namaKelas || "",
            base64: base64Photo,
            timestamp: Date.now(),
          },
        };
        try {
          localStorage.setItem(stagedStorageKey, JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    },
    [stagedStorageKey, wali?.namaKelas],
  );

  const handleRemoveStaged = useCallback(
    (idSiswa) => {
      setStagedPhotos((prev) => {
        const updated = { ...prev };
        delete updated[idSiswa];
        try {
          localStorage.setItem(stagedStorageKey, JSON.stringify(updated));
        } catch (_) {}
        return updated;
      });
    },
    [stagedStorageKey],
  );

  const handleClearAllStaged = useCallback(() => {
    if (!window.confirm("Batalkan semua foto siswa dalam antrian?")) return;
    setStagedPhotos({});
    try {
      localStorage.removeItem(stagedStorageKey);
    } catch (_) {}
  }, [stagedStorageKey]);

  // Pencarian siswa berikutnya untuk foto beruntun
  const getNextStudentToRegister = useCallback(
    (currentId) => {
      const currentIndex = siswaList.findIndex((s) => s.idSiswa === currentId);
      // Prioritas 1: Siswa setelahnya yang belum terdaftar dan belum ada di staging
      for (let i = currentIndex + 1; i < siswaList.length; i++) {
        const s = siswaList[i];
        if (!s.fotoWajah && !stagedPhotos[s.idSiswa]) {
          return s;
        }
      }
      // Prioritas 2: Siswa sebelumnya yang belum terdaftar dan belum ada di staging
      for (let i = 0; i < currentIndex; i++) {
        const s = siswaList[i];
        if (!s.fotoWajah && !stagedPhotos[s.idSiswa]) {
          return s;
        }
      }
      // Prioritas 3: Siswa berikutnya secara urutan rombel
      if (currentIndex >= 0 && currentIndex < siswaList.length - 1) {
        return siswaList[currentIndex + 1];
      }
      return null;
    },
    [siswaList, stagedPhotos],
  );

  // PROSES SIMPAN SEMUA (SERIAL BATCH SAVE KE DRIVE & SPREADSHEET)
  const handleSaveAllStaged = async () => {
    const stagedEntries = Object.values(stagedPhotos);
    if (stagedEntries.length === 0) return;

    setBatchSaving(true);
    setBatchProgress({
      total: stagedEntries.length,
      current: 0,
      pct: 0,
      currentStudentName: "",
      stepText: "Mempersiapkan proses penyimpanan...",
      successCount: 0,
      failCount: 0,
      isComplete: false,
      errors: [],
    });

    let successCount = 0;
    let failCount = 0;
    const errors = [];
    const updatedStaged = { ...stagedPhotos };

    // Inisialisasi Face API jika memungkinkan
    let fa = null;
    try {
      fa = await loadFaceApi();
    } catch (e) {
      console.warn("Face API dilewati:", e);
    }

    for (let i = 0; i < stagedEntries.length; i++) {
      const item = stagedEntries[i];
      const studentName = item.nama || item.idSiswa;
      const basePct = Math.round((i / stagedEntries.length) * 100);

      setBatchProgress((prev) => ({
        ...prev,
        current: i + 1,
        pct: basePct + 2,
        currentStudentName: studentName,
        stepText: `1/3 Menganalisis biometrik wajah ${studentName}...`,
      }));

      try {
        // 1. Ekstraksi biometrik & Duplication Check
        let myDescriptor = null;
        if (fa && item.base64) {
          try {
            const img = await loadImage(item.base64);
            const det = await fa
              .detectSingleFace(
                img,
                new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }),
              )
              .withFaceLandmarks(true);

            if (det) {
              const [aligned] = await fa.extractFaces(img, [det.landmarks.align()]);
              myDescriptor = await fa.nets.faceRecognitionNet.computeFaceDescriptor(aligned);
            }
          } catch (err) {
            console.warn("Ekstraksi biometrik dilewati:", studentName, err);
          }

          if (myDescriptor) {
            setBatchProgress((prev) => ({
              ...prev,
              stepText: `Memeriksa keunikan wajah ${studentName}...`,
            }));

            const dupCheck = await checkFaceDuplicate({
              currentStudentId: item.idSiswa,
              descriptor: myDescriptor,
              otherStudents: siswaList,
              threshold: 0.45,
            });

            if (dupCheck.isDuplicate) {
              throw new Error(
                `Wajah identik dengan ${dupCheck.matchedName || dupCheck.matchedId}`,
              );
            }
          }
        }

        // 2. Upload foto ke Google Drive
        setBatchProgress((prev) => ({
          ...prev,
          pct: basePct + Math.round((1 / stagedEntries.length) * 45),
          stepText: `2/3 Mengunggah foto ${studentName} ke Google Drive...`,
        }));

        const fileName = `wajah_${item.idSiswa}_${Date.now()}.jpg`;
        const uploadRes = await uploadPhoto(item.base64, fileName, "image/jpeg");
        if (!uploadRes?.success || !uploadRes.data?.url) {
          throw new Error(uploadRes?.message || "Gagal mengunggah foto ke Google Drive");
        }
        const photoUrl = uploadRes.data.url;

        // 3. Update spreadsheet DATA_SISWA_WALI
        setBatchProgress((prev) => ({
          ...prev,
          pct: basePct + Math.round((1 / stagedEntries.length) * 80),
          stepText: `3/3 Mendaftarkan ${studentName} ke spreadsheet...`,
        }));

        const updateRes = await updateBiodataSiswa({
          idSiswa: item.idSiswa,
          fotoWajah: photoUrl,
        });

        if (!updateRes?.success) {
          throw new Error(updateRes?.message || "Gagal memperbarui spreadsheet");
        }

        // 4. Cache biometrik dan update local state
        if (myDescriptor && photoUrl) {
          try {
            writeCachedDescriptor(item.idSiswa, photoUrl, myDescriptor);
          } catch (_) {}
        }

        // Simpan ke local cache & broadcast sync
        try {
          const saved = localStorage.getItem(localCacheKey);
          const cache = saved ? JSON.parse(saved) : {};
          cache[item.idSiswa] = photoUrl;
          localStorage.setItem(localCacheKey, JSON.stringify(cache));
          localStorage.setItem(
            `face_reg_${item.idSiswa}`,
            JSON.stringify({
              idSiswa: item.idSiswa,
              nama: item.nama,
              fotoWajah: photoUrl,
              registeredAt: new Date().toISOString(),
            }),
          );
          localStorage.removeItem(`face_feat_${item.idSiswa}`);
          localStorage.removeItem(`face_feat_zncc_${item.idSiswa}`);

          localStorage.setItem(`face_updated_at_${waliId}`, String(Date.now()));
          if (typeof window !== "undefined" && "BroadcastChannel" in window) {
            const bc = new BroadcastChannel("portal_face_sync");
            bc.postMessage({
              type: "FACE_UPDATED",
              waliId,
              idSiswa: item.idSiswa,
              newPhotoUrl: photoUrl,
              timestamp: Date.now(),
            });
            bc.close();
          }
        } catch (_) {}

        // Update siswa di state tampilan
        setSiswaList((prev) =>
          prev.map((s) => (s.idSiswa === item.idSiswa ? { ...s, fotoWajah: photoUrl } : s)),
        );

        // Hapus dari stagedPhotos secara live
        delete updatedStaged[item.idSiswa];
        try {
          localStorage.setItem(stagedStorageKey, JSON.stringify(updatedStaged));
        } catch (_) {}
        setStagedPhotos({ ...updatedStaged });

        successCount++;
        setBatchProgress((prev) => ({
          ...prev,
          successCount,
          pct: Math.round(((i + 1) / stagedEntries.length) * 100),
        }));
      } catch (err) {
        console.error(`Gagal menyimpan ${studentName}:`, err);
        failCount++;
        errors.push({ idSiswa: item.idSiswa, nama: studentName, message: err.message });
        setBatchProgress((prev) => ({
          ...prev,
          failCount,
        }));
      }
    }

    setBatchProgress((prev) => ({
      ...prev,
      pct: 100,
      isComplete: true,
      stepText:
        errors.length === 0
          ? `✅ Selesai! Semua ${successCount} siswa berhasil didaftarkan ke server!`
          : `⚠️ Selesai: ${successCount} berhasil, ${failCount} gagal.`,
      errors,
    }));
  };

  // Filter & Search
  const filteredSiswa = useMemo(() => {
    return siswaList.filter((s) => {
      const matchSearch =
        !searchTerm.trim() ||
        s.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.idSiswa.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterTab === "antrian") return !!stagedPhotos[s.idSiswa];
      if (filterTab === "terdaftar") return !!s.fotoWajah;
      if (filterTab === "belum") return !s.fotoWajah && !stagedPhotos[s.idSiswa];
      return true;
    });
  }, [siswaList, searchTerm, filterTab, stagedPhotos]);

  // Callback setelah siswa berhasil didaftarkan wajahnya langsung (1 siswa)
  function handleFaceRegistered(idSiswa, newPhotoUrl) {
    // Hapus dari staged jika ada
    handleRemoveStaged(idSiswa);

    setSiswaList((prev) =>
      prev.map((s) =>
        s.idSiswa === idSiswa ? { ...s, fotoWajah: newPhotoUrl } : s,
      ),
    );

    try {
      const saved = localStorage.getItem(localCacheKey);
      const cache = saved ? JSON.parse(saved) : {};
      cache[idSiswa] = newPhotoUrl;
      localStorage.setItem(localCacheKey, JSON.stringify(cache));
      localStorage.removeItem(`face_feat_${idSiswa}`);
      localStorage.removeItem(`face_feat_zncc_${idSiswa}`);

      localStorage.setItem(`face_updated_at_${waliId}`, String(Date.now()));
      if (typeof window !== "undefined" && "BroadcastChannel" in window) {
        const bc = new BroadcastChannel("portal_face_sync");
        bc.postMessage({
          type: "FACE_UPDATED",
          waliId,
          idSiswa,
          newPhotoUrl,
          timestamp: Date.now(),
        });
        bc.close();
      }
    } catch (_) {}

    setActiveSiswaToRegister(null);
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
          {/* HEADER MODAL */}
          <div className="flex items-center justify-between px-3.5 sm:px-6 py-3 sm:py-3.5 bg-gradient-to-r from-teal-800 via-emerald-800 to-slate-900 text-white shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-xl bg-teal-400/20 text-teal-300 text-base sm:text-lg">
                🧏
              </span>
              <div className="leading-tight">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-base font-black tracking-tight">
                    Registrasi Wajah Siswa
                  </h3>
                  <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-teal-400/25 text-teal-200 font-extrabold border border-teal-300/40">
                    {wali?.namaKelas || "Rombel"}
                  </span>
                  {stats.stagedCount > 0 && (
                    <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-400/30 text-amber-200 font-extrabold border border-amber-300/40 animate-pulse">
                      ⚡ {stats.stagedCount} di Antrian
                    </span>
                  )}
                </div>
                <p className="text-[10px] sm:text-xs text-teal-200 mt-0.5">
                  Foto siswa berturut-turut lalu simpan semua sekaligus ke server
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadSiswaDanFoto(true)}
                disabled={refreshing || loading}
                className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/35 border border-teal-300/40 text-teal-100 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Muat ulang status wajah siswa"
              >
                <span className={refreshing ? "animate-spin" : ""}>🔄</span>
                <span className="hidden sm:inline">
                  {refreshing ? `Menyinkronkan (${loadProgress}%)...` : "Sinkron"}
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-sm font-bold cursor-pointer"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
          </div>

          {/* STATUS RINGKAS PROGRESS */}
          <div className="bg-slate-50 border-b border-slate-200 p-3 sm:p-4 space-y-2.5 shrink-0">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-700 flex items-center gap-1.5">
                <span>📊 Status Pendaftaran:</span>
                <strong className="text-emerald-700 font-black">
                  {stats.terdaftar} Terdaftar
                </strong>
                {stats.stagedCount > 0 && (
                  <span className="text-amber-700 font-black">
                    (+{stats.stagedCount} Siap Simpan)
                  </span>
                )}
                <span className="text-slate-500">dari {stats.total} Siswa</span>
              </span>
              <span className="font-mono text-teal-700 font-black">
                {stats.persen}% Selesai
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${stats.persen}%` }}
              />
            </div>

            {/* SEARCH & FILTER TABS */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
              {/* Search input */}
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 text-xs">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama siswa atau NISN..."
                  className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter tab buttons */}
              <div className="flex items-center gap-1 shrink-0 bg-slate-200/80 p-0.5 rounded-xl flex-wrap">
                <button
                  type="button"
                  onClick={() => setFilterTab("semua")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterTab === "semua"
                      ? "bg-white text-slate-800 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Semua ({stats.total})
                </button>
                {stats.stagedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterTab("antrian")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterTab === "antrian"
                        ? "bg-amber-500 text-white shadow-xs"
                        : "text-amber-800 hover:text-amber-950 font-black"
                    }`}
                  >
                    ⚡ Antrian ({stats.stagedCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFilterTab("terdaftar")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterTab === "terdaftar"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Terdaftar ({stats.terdaftar})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab("belum")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterTab === "belum"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Belum ({stats.belum})
                </button>
              </div>
            </div>
          </div>

          {/* LIST SISWA */}
          <div className="p-3 sm:p-5 overflow-y-auto space-y-2 flex-1 bg-slate-50/60">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-72 text-center space-y-3">
                <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-slate-700">
                  Memuat data siswa dan verifikasi foto wajah kelas {wali?.namaKelas}...
                </p>
                <div className="w-48 bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${loadProgress}%` }}
                  ></div>
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {loadProgress}% Selesai
                </span>
              </div>
            ) : filteredSiswa.length === 0 ? (
              <div className="text-center py-10 rounded-2xl bg-white border border-dashed border-slate-300 p-6 space-y-1">
                <p className="text-2xl">👥</p>
                <p className="text-xs sm:text-sm font-black text-slate-700">
                  Tidak ada siswa ditemukan
                </p>
                <p className="text-[11px] text-slate-400">
                  Coba ubah kata kunci pencarian atau ganti filter tab di atas.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {refreshing && (
                  <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-between gap-3 text-xs mb-1 animate-in fade-in">
                    <div className="flex items-center gap-2 text-teal-800 font-bold truncate">
                      <span className="animate-spin text-sm shrink-0">🔄</span>
                      <span className="truncate">Menyinkronkan foto wajah siswa dari server...</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-24 sm:w-32 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${loadProgress}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-teal-700 font-bold text-[11px]">
                        {loadProgress}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5">
                  {filteredSiswa.map((s, idx) => {
                    const stagedItem = stagedPhotos[s.idSiswa];
                    const isStaged = !!stagedItem;
                    const hasPhoto = !!s.fotoWajah;

                    return (
                      <div
                        key={s.idSiswa}
                        className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isStaged
                            ? "bg-amber-50/70 border-amber-300 shadow-sm ring-1 ring-amber-300/60"
                            : hasPhoto
                              ? "bg-white border-emerald-200 hover:border-emerald-300 shadow-xs"
                              : "bg-white border-slate-200 hover:border-amber-300 shadow-2xs"
                        }`}
                      >
                        {/* Avatar & Info */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            {isStaged ? (
                              <img
                                src={stagedItem.base64}
                                alt={s.nama}
                                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border-2 border-amber-400 bg-amber-100 shadow-xs"
                              />
                            ) : hasPhoto ? (
                              <img
                                src={driveThumb(s.fotoWajah)}
                                alt={s.nama}
                                className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border-2 border-emerald-400 bg-emerald-50 shadow-xs"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = "";
                                }}
                              />
                            ) : (
                              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs sm:text-sm">
                                {idx + 1}
                              </div>
                            )}
                            <span
                              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white border-2 border-white font-bold ${
                                isStaged
                                  ? "bg-amber-500"
                                  : hasPhoto
                                    ? "bg-emerald-500"
                                    : "bg-amber-400"
                              }`}
                            >
                              {isStaged ? "⚡" : hasPhoto ? "✓" : "!"}
                            </span>
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                              {s.nama}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 truncate">
                              NISN: {s.idSiswa}
                            </p>
                            <div className="mt-0.5">
                              {isStaged ? (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded-md border border-amber-300">
                                  <span>🟡</span> Siap Disimpan (Antrian)
                                </span>
                              ) : hasPhoto ? (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200">
                                  <span>🟢</span> Terdaftar
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded-md border border-amber-200">
                                  <span>⚠️</span> Belum Terdaftar
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tombol Aksi Siswa */}
                        <div className="shrink-0 flex items-center gap-1.5">
                          {isStaged ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleRemoveStaged(s.idSiswa)}
                                className="w-8 h-8 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-all flex items-center justify-center text-xs cursor-pointer"
                                title="Batalkan foto ini dari antrian"
                              >
                                ✕
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveSiswaToRegister({
                                    id: s.idSiswa,
                                    nama: s.nama,
                                    kelas: s.kelas || wali?.namaKelas,
                                    fotoLama: s.fotoWajah,
                                  })
                                }
                                className="px-2.5 py-1.5 rounded-xl text-xs font-black bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition-all flex items-center gap-1 cursor-pointer"
                                title="Ambil ulang foto wajah siswa ini"
                              >
                                <span>📸</span>
                                <span>Ulang</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setActiveSiswaToRegister({
                                  id: s.idSiswa,
                                  nama: s.nama,
                                  kelas: s.kelas || wali?.namaKelas,
                                  fotoLama: s.fotoWajah,
                                })
                              }
                              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                                hasPhoto
                                  ? "bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300"
                                  : "bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white border border-teal-600 shadow-emerald-700/20"
                              }`}
                            >
                              <span>🧏</span>
                              <span>{hasPhoto ? "Ubah Wajah" : "Daftarkan"}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* FLOATING ACTION BAR: JIKA ADA FOTO DALAM ANTRIAN */}
          {stats.stagedCount > 0 && (
            <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-emerald-700 text-white px-3.5 sm:px-6 py-2.5 sm:py-3 border-t border-amber-400 flex flex-wrap items-center justify-between gap-2 shadow-lg shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="p-1.5 rounded-xl bg-white/20 text-white text-base">
                  📦
                </span>
                <div className="leading-tight truncate">
                  <div className="text-xs sm:text-sm font-black truncate flex items-center gap-1.5">
                    <span>{stats.stagedCount} Foto Siswa Siap Disimpan</span>
                    <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded-full font-bold">
                      Antrian Lokal
                    </span>
                  </div>
                  <div className="text-[10px] text-amber-100 truncate">
                    Tekan tombol untuk upload ke Google Drive & simpan ke spreadsheet
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={handleClearAllStaged}
                  disabled={batchSaving}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all cursor-pointer"
                >
                  Batal Semua
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllStaged}
                  disabled={batchSaving}
                  className="px-4 py-2 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95 text-xs sm:text-sm font-black shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Simpan Semua ({stats.stagedCount} Siswa)</span>
                </button>
              </div>
            </div>
          )}

          {/* FOOTER MODAL */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <p className="text-[10px] sm:text-xs text-slate-500">
              💡 Scan wajah siswa satu per satu ke antrian, lalu klik <strong>Simpan Semua</strong> untuk upload berurutan.
            </p>
            <button
              type="button"
              onClick={onClose}
              disabled={batchSaving}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* MODAL REGISTRASI WAJAH SISWA AKTIF */}
      {activeSiswaToRegister && (
        <ModalRegistrasiWajahSiswa
          isOpen={!!activeSiswaToRegister}
          onClose={() => setActiveSiswaToRegister(null)}
          user={{
            id: activeSiswaToRegister.id,
            nama: activeSiswaToRegister.nama,
            kelas: activeSiswaToRegister.kelas,
          }}
          fotoLama={activeSiswaToRegister.fotoLama}
          otherStudents={siswaList}
          onFaceRegistered={(newUrl) =>
            handleFaceRegistered(activeSiswaToRegister.id, newUrl)
          }
          // Batch staging props:
          onStagePhoto={(idSiswa, base64Photo, userInfo) => {
            handleStagePhoto(idSiswa, base64Photo, userInfo);
          }}
          hasNextStudent={!!getNextStudentToRegister(activeSiswaToRegister.id)}
          nextStudentName={getNextStudentToRegister(activeSiswaToRegister.id)?.nama}
          onNextStudent={() => {
            const nextStudent = getNextStudentToRegister(activeSiswaToRegister.id);
            if (nextStudent) {
              setActiveSiswaToRegister({
                id: nextStudent.idSiswa,
                nama: nextStudent.nama,
                kelas: nextStudent.kelas || wali?.namaKelas,
                fotoLama: nextStudent.fotoWajah,
              });
            } else {
              setActiveSiswaToRegister(null);
            }
          }}
        />
      )}

      {/* OVERLAY PROGRESS BAR DI TENGAH LAYAR UNTUK SIMPAN SEMUA */}
      {batchSaving && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-5 sm:p-6 space-y-4 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 mx-auto flex items-center justify-center text-2xl shadow-inner">
              {batchProgress.isComplete ? (
                batchProgress.errors.length === 0 ? "🎉" : "⚠️"
              ) : (
                <span className="animate-spin text-xl">🔄</span>
              )}
            </div>

            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                {batchProgress.isComplete
                  ? "Penyimpanan Massal Selesai"
                  : "Menyimpan Registrasi Wajah Siswa"}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {batchProgress.isComplete
                  ? "Proses upload dan pembaruan data telah selesai"
                  : `Memproses ${batchProgress.current} dari ${batchProgress.total} Siswa...`}
              </p>
            </div>

            {/* Nama siswa saat ini */}
            {!batchProgress.isComplete && batchProgress.currentStudentName && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 truncate">
                👤 Siswa: <strong className="text-teal-800">{batchProgress.currentStudentName}</strong>
              </div>
            )}

            {/* Progress Bar & Persentase */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-600 truncate max-w-[280px]">
                  {batchProgress.stepText}
                </span>
                <span className="font-mono text-teal-700 ml-2">
                  {batchProgress.pct}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-teal-500 via-emerald-500 to-teal-600 rounded-full transition-all duration-300"
                  style={{ width: `${batchProgress.pct}%` }}
                />
              </div>
            </div>

            {/* Counter badges */}
            <div className="flex items-center justify-center gap-3 text-xs font-bold pt-1">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800">
                🟢 {batchProgress.successCount} Berhasil
              </span>
              {batchProgress.failCount > 0 && (
                <span className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
                  🔴 {batchProgress.failCount} Gagal
                </span>
              )}
            </div>

            {/* Daftar error jika ada kegagalan */}
            {batchProgress.errors.length > 0 && (
              <div className="text-left p-3 rounded-xl bg-rose-50 border border-rose-200 max-h-36 overflow-y-auto space-y-1 text-[11px]">
                <p className="font-black text-rose-800">Catatan error:</p>
                {batchProgress.errors.map((err, i) => (
                  <p key={i} className="text-rose-700">
                    • <strong>{err.nama}</strong>: {err.message}
                  </p>
                ))}
              </div>
            )}

            {/* Tombol Selesai */}
            {batchProgress.isComplete && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setBatchSaving(false)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-700 to-emerald-700 hover:from-teal-600 hover:to-emerald-600 text-white font-black text-xs sm:text-sm shadow-md transition-all cursor-pointer"
                >
                  Tutup & Kembali
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
