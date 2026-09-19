// =========================================================
// HELPER: MANAJEMEN PETUGAS PRESENSI KELAS WALI
// =========================================================

/**
 * Memecah string keterangan wali kelas menjadi teks keterangan bersih
 * dan informasi petugas presensi yang disematkan dalam tag [PETUGAS:idSiswa:namaSiswa].
 */
export function parseKeteranganWali(keterangan) {
  if (!keterangan || typeof keterangan !== "string") {
    return {
      cleanText: "",
      petugasId: "",
      petugasNama: "",
    };
  }

  const match = keterangan.match(/\[PETUGAS:([^:\]]+):([^\]]*)\]/);
  if (match) {
    const cleanText = keterangan.replace(match[0], "").trim();
    return {
      cleanText,
      petugasId: match[1].trim(),
      petugasNama: (match[2] || "").trim(),
    };
  }

  return {
    cleanText: keterangan.trim(),
    petugasId: "",
    petugasNama: "",
  };
}

/**
 * Menyusun kembali string keterangan yang memuat data petugas presensi
 * ke dalam format tag [PETUGAS:idSiswa:namaSiswa].
 */
export function buildKeteranganWali(cleanText, petugasId, petugasNama) {
  const baseText = (cleanText || "").replace(/\[PETUGAS:[^\]]*\]/g, "").trim();

  if (petugasId) {
    const tag = `[PETUGAS:${petugasId.trim()}:${(petugasNama || "").trim()}]`;
    return baseText ? `${baseText} ${tag}` : tag;
  }

  return baseText;
}

/**
 * Ekstrak data petugas presensi dari sebuah objek wali kelas.
 */
export function getPetugasFromWali(wali) {
  if (!wali) return null;

  // 1. Coba baca dari keterangan
  const parsed = parseKeteranganWali(wali.keterangan || wali.KETERANGAN || "");
  if (parsed.petugasId) {
    return {
      idSiswa: parsed.petugasId,
      namaSiswa: parsed.petugasNama,
    };
  }

  // 2. Coba baca dari localStorage sebagai cadangan cepat
  if (typeof window !== "undefined" && wali.idWali) {
    try {
      const cached = localStorage.getItem(`petugas_wali_${wali.idWali}`);
      if (cached) {
        const obj = JSON.parse(cached);
        if (obj && obj.idSiswa) {
          return obj;
        }
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Simpan penunjukan petugas presensi ke localStorage untuk akses cepat.
 */
export function cachePetugasLocal(idWali, petugasData) {
  if (typeof window === "undefined" || !idWali) return;
  try {
    if (petugasData && petugasData.idSiswa) {
      localStorage.setItem(
        `petugas_wali_${idWali}`,
        JSON.stringify(petugasData),
      );
      // Simpan juga indeks global ID siswa -> data wali
      const mapStr = localStorage.getItem("petugas_siswa_map") || "{}";
      const map = JSON.parse(mapStr);
      map[String(petugasData.idSiswa).trim()] = {
        ...petugasData,
        idWali,
      };
      localStorage.setItem("petugas_siswa_map", JSON.stringify(map));
    } else {
      localStorage.removeItem(`petugas_wali_${idWali}`);
    }
  } catch (e) {
    console.warn("Gagal menyimpan cache petugas:", e);
  }
}

/**
 * Periksa apakah seorang siswa adalah petugas presensi dari salah satu kelas.
 */
export function findPetugasWaliKelasForSiswa(idSiswa, listWali = []) {
  if (!idSiswa) return null;
  const sid = String(idSiswa).trim();

  // 1. Cari di listWali yang diberikan
  if (Array.isArray(listWali) && listWali.length > 0) {
    for (const w of listWali) {
      const p = getPetugasFromWali(w);
      if (p && String(p.idSiswa).trim() === sid) {
        return {
          idWali: w.idWali,
          idGuru: w.idGuru,
          namaKelas: w.namaKelas || w.kelas || "Kelas Wali",
          kelas: w.kelas || w.namaKelas || "",
          keterangan: w.keterangan || "",
          petugas: p,
        };
      }
    }
  }

  // 2. Cek di localStorage petugas_siswa_map
  if (typeof window !== "undefined") {
    try {
      const mapStr = localStorage.getItem("petugas_siswa_map");
      if (mapStr) {
        const map = JSON.parse(mapStr);
        if (map[sid]) {
          return map[sid];
        }
      }

      // 3. Scan semua key petugas_wali_* di localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("petugas_wali_")) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const obj = JSON.parse(raw);
              if (obj && String(obj.idSiswa).trim() === sid) {
                return obj;
              }
            }
          } catch (_) {}
        }
      }

      // 4. Scan sessionStorage cache_wali_kelas_*
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("cache_wali_kelas_")) {
          try {
            const raw = sessionStorage.getItem(key);
            if (raw) {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                for (const w of list) {
                  const p = getPetugasFromWali(w);
                  if (p && String(p.idSiswa).trim() === sid) {
                    return {
                      idWali: w.idWali,
                      idGuru: w.idGuru,
                      namaKelas: w.namaKelas || w.kelas || "Kelas Wali",
                      kelas: w.kelas || w.namaKelas || "",
                      keterangan: w.keterangan || "",
                      petugas: p,
                    };
                  }
                }
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  return null;
}
