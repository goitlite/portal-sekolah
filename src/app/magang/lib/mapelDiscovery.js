// src/app/magang/lib/mapelDiscovery.js
// Helper pencarian & sinkronisasi otomatis mata pelajaran siswa
// Digunakan oleh ModalKehadiranMapel dan PesanSekolahModal

import { getGuru, getMapelByGuru, getPresensiMapelGrid } from "./api.js";

/**
 * Mencari semua mata pelajaran yang diikuti oleh siswa.
 * Memeriksa cache localStorage terlebih dahulu untuk kecepatan instan (0 ms),
 * jika belum ada atau diperbarui, memindai dari server dan menyimpannya ke cache.
 *
 * @param {object} user - Objek siswa minimal { id, nama, kelas? }
 * @returns {Promise<Array>} Daftar mapel siswa dengan informasi guru
 */
export async function autoDiscoverMapelForStudent(user) {
  if (!user || !user.id) return [];

  const userId = String(user.id).trim();

  const ENROLLED_CACHE_KEY = `cache_enrolled_mapels_v4_${userId}`;

  // 1. Cek cache terverifikasi untuk siswa ini (Kecepatan 0 ms)
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(ENROLLED_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.every((m) => m && m.namaGuru && m.namaGuru !== "Guru Mapel");
          if (valid) return parsed;
        }
      }
    } catch (e) {}
  }

  // 2. Ambil master guru untuk memetakan ID_GURU -> NAMA_GURU
  let guruMap = {};
  if (typeof window !== "undefined") {
    try {
      const cachedGuru = localStorage.getItem("cache_daftar_guru_map");
      if (cachedGuru) guruMap = JSON.parse(cachedGuru);
    } catch (e) {}
  }

  if (Object.keys(guruMap).length === 0) {
    try {
      const resGuru = await getGuru();
      if (resGuru?.success && Array.isArray(resGuru.data)) {
        resGuru.data.forEach((g) => {
          const gId = String(g.ID || g.id || g.idGuru || "").trim();
          const gNama = String(
            g.NAMA_GURU || g.namaGuru || g.NAMA || g.nama || "",
          ).trim();
          if (gId && gNama) guruMap[gId] = gNama;
        });
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(
              "cache_daftar_guru_map",
              JSON.stringify(guruMap),
            );
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  // 3. Ekstrak kelas siswa
  const namaMentah = String(user.nama || "");
  const matchKelas = namaMentah.match(/\[(.*?)\]/);
  const kelasSiswa = (
    matchKelas ? matchKelas[1].trim() : user.kelas || user.KELAS || ""
  ).toLowerCase();

  const normK = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/kelas/g, "")
      .replace(/daring/g, "")
      .replace(/tjkt/g, "tkj")
      .replace(/[^a-z0-9]/g, "");

  const kSiswaNorm = normK(kelasSiswa);
  const kSiswaNoGrade = kSiswaNorm.replace(/^(x|xi|xii)/, "");

  // 4. Ambil SEMUA mapel sekolah
  let allMapels = [];
  try {
    const resAll = await getMapelByGuru("ALL");
    if (resAll?.success && Array.isArray(resAll.data)) {
      allMapels = resAll.data.map((m) => {
        const gId = String(m.idGuru || "").trim();
        return {
          ...m,
          namaGuru: m.namaGuru || guruMap[gId] || "Guru Mapel",
        };
      });
    }
  } catch (e) {}

  if (allMapels.length === 0) return [];

  // 5. Tentukan target mapel yang akan diverifikasi enrollment-nya
  // Jika jumlah mapel di sekolah sedikit (<= 40), cek seluruh mapel sekolah
  // agar mapel online / lintas rombel seperti 'mapel tes' tidak pernah terlewat!
  const targetList =
    allMapels.length <= 40
      ? allMapels
      : allMapels.filter((m) => {
          const isOnline =
            String(m.keterangan || "").toUpperCase().includes("ONLINE") ||
            String(m.namaMapel || "").toUpperCase().includes("ONLINE");
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

  // 6. Cek presensi grid / enrollment siswa secara paralel
  const enrolledResults = await Promise.all(
    targetList.map(async (m) => {
      try {
        const kmNorm = normK(m.kelas);
        const kmNoGrade = kmNorm.replace(/^(x|xi|xii)/, "");
        const matchesClass =
          kSiswaNorm &&
          kmNorm &&
          (kmNorm === kSiswaNorm ||
            kSiswaNorm.includes(kmNorm) ||
            kmNorm.includes(kSiswaNorm) ||
            (kmNoGrade && kSiswaNoGrade && kmNoGrade === kSiswaNoGrade));

        const gId = String(m.idGuru || "").trim();
        const namaGuruFinal = m.namaGuru || guruMap[gId] || "Guru Mapel";

        const resGrid = await getPresensiMapelGrid(m.idGuru, m.idMapel);
        const daftarSiswa = resGrid?.data?.siswa || [];
        const isEnrolled = daftarSiswa.some(
          (s) => String(s.idSiswa).trim() === userId,
        );

        // Aturan ketat:
        // 1. Jika guru sudah menginput daftar siswa di grid, siswa WAJIB terdaftar (isEnrolled)
        // 2. Jika grid belum memiliki daftar siswa sama sekali, hanya cocokkan jika kelas sama persis
        let siswaTerdaftar = false;
        if (daftarSiswa.length > 0) {
          siswaTerdaftar = isEnrolled;
        } else if (!resGrid?.success || !resGrid?.data) {
          siswaTerdaftar = kSiswaNorm && kmNorm && (kmNorm === kSiswaNorm);
        } else {
          siswaTerdaftar = false;
        }

        if (siswaTerdaftar) {
          return {
            ...m,
            namaGuru: namaGuruFinal,
          };
        }
      } catch (e) {}
      return null;
    }),
  );

  const enrolledMapels = enrolledResults.filter(Boolean);

  // 7. Simpan ke cache terpisah: Daring hanya untuk online, Reguler hanya untuk biasa
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(ENROLLED_CACHE_KEY, JSON.stringify(enrolledMapels));

      const isOnlineCheck = (m) => {
        const ket = String(m?.keterangan || "").toUpperCase();
        const jns = String(m?.jenisMapel || "").toUpperCase();
        const nama = String(m?.namaMapel || "").toUpperCase();
        return ket.includes("ONLINE") || jns.includes("ONLINE") || nama.includes("ONLINE");
      };

      const mapelOnline = enrolledMapels.filter(isOnlineCheck);
      const mapelReguler = enrolledMapels.filter((m) => !isOnlineCheck(m));

      localStorage.setItem(
        `cache_discovered_mapels_${userId}_reguler`,
        JSON.stringify(mapelReguler),
      );
      localStorage.setItem(
        `cache_discovered_mapels_${userId}_daring`,
        JSON.stringify(mapelOnline),
      );
    } catch (e) {}
  }

  return enrolledMapels;
}
