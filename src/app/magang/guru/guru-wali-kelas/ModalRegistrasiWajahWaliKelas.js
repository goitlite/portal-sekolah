"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getPresensiWaliGrid, getBiodataSiswa } from "../../lib/api";
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
  const [filterTab, setFilterTab] = useState("semua"); // "semua" | "terdaftar" | "belum"
  const [activeSiswaToRegister, setActiveSiswaToRegister] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const waliId = wali?.idWali;
  const guruId = guru?.id;
  const localCacheKey = useMemo(() => `cached_face_urls_${waliId}`, [waliId]);

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
        const BATCH_SIZE = 5;
        const totalMissing = missing.length;
        for (let i = 0; i < totalMissing; i += BATCH_SIZE) {
          const batch = missing.slice(i, i + BATCH_SIZE);
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

  // Statistik terdaftar
  const stats = useMemo(() => {
    const total = siswaList.length;
    const terdaftar = siswaList.filter((s) => !!s.fotoWajah).length;
    const belum = total - terdaftar;
    const persen = total > 0 ? Math.round((terdaftar / total) * 100) : 0;
    return { total, terdaftar, belum, persen };
  }, [siswaList]);

  // Filter & Search
  const filteredSiswa = useMemo(() => {
    return siswaList.filter((s) => {
      const matchSearch =
        !searchTerm.trim() ||
        s.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.idSiswa.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchSearch) return false;

      if (filterTab === "terdaftar") return !!s.fotoWajah;
      if (filterTab === "belum") return !s.fotoWajah;
      return true;
    });
  }, [siswaList, searchTerm, filterTab]);

  // Callback setelah siswa berhasil didaftarkan wajahnya
  function handleFaceRegistered(idSiswa, newPhotoUrl) {
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
      // Invalidate feature cache lama agar diekstrak ulang
      localStorage.removeItem(`face_feat_${idSiswa}`);
      localStorage.removeItem(`face_feat_zncc_${idSiswa}`);

      // Broadcast pembaruan wajah ke scanner yang sedang aktif di tab/jendela lain
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
                </div>
                <p className="text-[10px] sm:text-xs text-teal-200 mt-0.5">
                  Pilih siswa untuk mendaftarkan posisi wajah presensi kelas
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
                  {stats.terdaftar} dari {stats.total} Siswa
                </strong>
              </span>
              <span className="font-mono text-teal-700 font-black">
                {stats.persen}% Selesai
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-300"
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
              <div className="flex items-center gap-1 shrink-0 bg-slate-200/80 p-0.5 rounded-xl">
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
                  const hasPhoto = !!s.fotoWajah;
                  return (
                    <div
                      key={s.idSiswa}
                      className={`p-2.5 sm:p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        hasPhoto
                          ? "bg-white border-emerald-200 hover:border-emerald-300 shadow-xs"
                          : "bg-white border-slate-200 hover:border-amber-300 shadow-2xs"
                      }`}
                    >
                      {/* Avatar & Info */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {hasPhoto ? (
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
                            className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] text-white border-2 border-white ${
                              hasPhoto ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                          >
                            {hasPhoto ? "✓" : "!"}
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
                            {hasPhoto ? (
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

                      {/* Tombol Aksi */}
                      <div className="shrink-0">
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
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

          {/* FOOTER */}
          <div className="px-4 sm:px-6 py-2.5 sm:py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <p className="text-[10px] sm:text-xs text-slate-500">
              💡 Guru wali dapat mendaftarkan posisi wajah siswa langsung di kelas.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>

      {/* MODAL REGISTRASI WAJAH SISWA AKTIF (PERSIS SEPERTI DI DASHBOARD SISWA) */}
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
        />
      )}
    </>
  );
}

