// src/lib/auditAsesmenHelper.js
// Helper pencocokan nilai asesmen siswa berdasarkan respon Google Form
// Aturan: Hanya menampilkan nilai murni & menggunakan respon pertama yang masuk (earliest submission)
//
// REVISI STABILITAS (v1.1) - bentuk hasil lama tetap kompatibel (sudahUjian, nilai, nilaiAngka, timestamp, raw):
// 1. Pencocokan nama tidak lagi memakai "substring" (dulu "Andi" cocok dengan "Andika",
//    "Siti Nur Aisyah" cocok dengan "Siti Nur Halimah"). Sekarang: SEMUA kata pada nama yang lebih pendek
//    harus ada di nama yang lebih panjang (urutan bebas, toleran typo ringan y/i, huruf ganda, 1 huruf pada kata panjang).
// 2. ID siswa yang sama antara form & portal = pasti cocok; jika ID beda/kosong, pencocokan jatuh ke nama
//    (ID di form bisa berupa NISN sedangkan ID portal berbeda jenis, jadi tidak dipakai untuk menolak).
// 3. Parameter opsional ke-4 `daftarSiswa`: respon yang namanya PERSIS milik siswa lain di daftar
//    tidak akan "dicuri" oleh siswa yang namanya hanya mirip (mis. "Siti Aisyah" vs "Siti Nur Aisyah").
// 4. Mapel "Semua Mapel" / "Semua" / kosong = tanpa filter (dulu "Semua Mapel" membuat semua siswa "Belum Ujian").
// 5. Hasil menyertakan `perMapel`, `jumlahRespon`, `nilai100` agar tampilan "semua mapel" tidak menyesatkan.
// 6. Data respon diolah sekali per array (WeakMap) -> tidak lambat saat tabel dirender ulang.

/**
 * Normalisasi teks: hilangkan spasi ganda, tanda baca ringan, dan jadikan huruf kecil
 */
export function normText(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------------
// PENCOCOKAN NAMA
// ------------------------------------------------------------------
const ALIAS_KATA = {
  muhamad: "muhammad",
  mohamad: "muhammad",
  mohammad: "muhammad",
  muhammad: "muhammad",
  moh: "muhammad",
  muh: "muhammad",
  mhd: "muhammad",
};

function canonToken(t) {
  let x = t
    .replace(/y/g, "i")
    .replace(/(.)\1+/g, "$1") // huruf ganda: hasanah/hasana, muhammad/muhamad
    .replace(/oe/g, "u");
  if (ALIAS_KATA[x]) x = ALIAS_KATA[x];
  return x;
}

function namaTokens(nama) {
  const all = normText(nama).split(" ").filter(Boolean);
  // buang inisial 1 huruf ("M Rizki"), kecuali semua kata hanya 1 huruf
  const panjang = all.filter((w) => w.length > 1);
  return (panjang.length > 0 ? panjang : all).map(canonToken);
}

function jarakSatuHuruf(a, b) {
  // true jika a & b berbeda maksimal 1 edit (sisip/hapus/ganti)
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let beda = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    beda++;
    if (beda > 1) return false;
    if (la === lb) {
      i++;
      j++;
    } else if (la > lb) {
      i++;
    } else {
      j++;
    }
  }
  if (i < la || j < lb) beda++;
  return beda <= 1;
}

function kataSama(x, y) {
  if (x === y) return true;
  // toleransi 1 huruf hanya untuk kata panjang agar "dian" != "diah"
  return x.length >= 6 && y.length >= 6 && jarakSatuHuruf(x, y);
}

function tokensMirip(ta, tb) {
  if (ta.length === 0 || tb.length === 0) return false;
  const [kecil, besar] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const dipakai = new Set();
  for (const k of kecil) {
    let ketemu = -1;
    for (let j = 0; j < besar.length; j++) {
      if (dipakai.has(j)) continue;
      if (kataSama(k, besar[j])) {
        ketemu = j;
        break;
      }
    }
    if (ketemu === -1) return false;
    dipakai.add(ketemu);
  }
  return true;
}

/**
 * Pencocokan nama siswa dengan nama di formulir respon
 */
export function isNamaMirip(namaA, namaB) {
  const a = normText(namaA);
  const b = normText(namaB);
  if (!a || !b) return false;
  if (a === b) return true;
  return tokensMirip(namaTokens(a), namaTokens(b));
}

// ------------------------------------------------------------------
// MAPEL
// ------------------------------------------------------------------
/**
 * Kamus singkatan mata pelajaran SMK
 */
const KAMUS_MAPEL = {
  asj: ["administrasi sistem jaringan", "sistem jaringan", "asj"],
  tlj: ["teknologi layanan jaringan", "layanan jaringan", "tlj"],
  aij: ["administrasi infrastruktur jaringan", "infrastruktur jaringan", "aij"],
  pbo: ["pemrograman berorientasi objek", "pbo"],
  pkk: ["produk kreatif dan kewirausahaan", "kewirausahaan", "pkk"],
  bindo: ["bahasa indonesia", "b indo", "b indonesia", "bindo"],
  bing: ["bahasa inggris", "b inggris", "b ing", "bing"],
  mtk: ["matematika", "mtk", "math"],
  pai: ["pendidikan agama islam", "agama islam", "pai", "pabp"],
  ppkn: ["pendidikan pancasila", "pancasila", "pkn", "ppkn"],
  penjas: ["pendidikan jasmani", "pjok", "penjas", "olahraga"],
  dpp: ["dasar program keahlian", "dasar kejuruan", "dpk", "dpp"],
};

/** true bila target berarti "tanpa filter mapel" */
export function isMapelSemua(target) {
  const n = normText(target);
  return !n || n === "all" || n.startsWith("semua");
}

function punyaAlias(teks, alias) {
  if (alias.length <= 4) {
    return (" " + teks + " ").includes(" " + alias + " ");
  }
  return teks.includes(alias);
}

/**
 * Cek kesesuaian nama mata pelajaran
 */
export function isMapelCocok(mapelA, mapelB) {
  if (isMapelSemua(mapelB)) return true;
  const a = normText(mapelA);
  const b = normText(mapelB);
  if (!a) return true; // respon tidak mencantumkan mapel -> tidak dibatasi
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  for (const aliases of Object.values(KAMUS_MAPEL)) {
    const matchA = aliases.some((al) => punyaAlias(a, al));
    const matchB = aliases.some((al) => punyaAlias(b, al));
    if (matchA && matchB) return true;
  }

  return false;
}

// ------------------------------------------------------------------
// WAKTU & NILAI
// ------------------------------------------------------------------
/**
 * Parse timestamp (DD/MM/YYYY HH:mm:ss atau ISO) ke millisecond
 */
export function parseTimestampMs(ts) {
  if (!ts) return 0;
  if (typeof ts === "number") return ts;
  const str = String(ts).trim();

  // Cek format Indonesia / Google Form: DD/MM/YYYY HH:mm:ss
  const matchIndo = str.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT]+(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?/,
  );
  if (matchIndo) {
    const day = parseInt(matchIndo[1], 10);
    const month = parseInt(matchIndo[2], 10) - 1;
    const year = parseInt(matchIndo[3], 10);
    const hour = matchIndo[4] ? parseInt(matchIndo[4], 10) : 0;
    const min = matchIndo[5] ? parseInt(matchIndo[5], 10) : 0;
    const sec = matchIndo[6] ? parseInt(matchIndo[6], 10) : 0;
    return new Date(year, month, day, hour, min, sec).getTime();
  }

  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}

/** "80 / 100" -> { angka: 80, skala100: 80 } ; "8/10" -> { angka: 8, skala100: 80 } */
function parseNilai(nilai) {
  if (nilai === null || nilai === undefined || nilai === "" || nilai === "-") {
    return { angka: null, skala100: null };
  }
  const s = String(nilai).trim();
  const bagian = s.split("/");
  const angka = parseFloat(bagian[0].replace(",", ".").trim());
  if (isNaN(angka)) return { angka: null, skala100: null };
  let skala100 = angka;
  if (bagian.length > 1) {
    const penyebut = parseFloat(bagian[1].replace(",", ".").trim());
    if (!isNaN(penyebut) && penyebut > 0)
      skala100 = Math.round((angka / penyebut) * 1000) / 10;
  }
  return { angka, skala100 };
}

// ------------------------------------------------------------------
// PERSIAPAN DATA (di-cache per array supaya render ulang tabel ringan)
// ------------------------------------------------------------------
const cacheRespon = new WeakMap();
const cacheDaftar = new WeakMap();

function siapkanRespon(responList) {
  let hasil = cacheRespon.get(responList);
  if (hasil) return hasil;
  hasil = responList.map((r, order) => ({
    r,
    order,
    id: normText(r?.id_siswa),
    namaNorm: normText(r?.nama || r?.namaForm),
    tokens: namaTokens(r?.nama || r?.namaForm),
    ts: parseTimestampMs(r?.timestamp),
  }));
  cacheRespon.set(responList, hasil);
  return hasil;
}

function namaPersisSiswaLain(daftarSiswa) {
  if (!Array.isArray(daftarSiswa) || daftarSiswa.length === 0) return null;
  let peta = cacheDaftar.get(daftarSiswa);
  if (peta) return peta;
  peta = new Map(); // namaNorm -> Set(kunci siswa)
  daftarSiswa.forEach((s, i) => {
    const n = normText(s?.nama);
    if (!n) return;
    if (!peta.has(n)) peta.set(n, new Set());
    peta.get(n).add(kunciSiswa(s, i));
  });
  cacheDaftar.set(daftarSiswa, peta);
  return peta;
}

function kunciSiswa(s) {
  return (
    normText(s?.id_siswa) || "n:" + normText(s?.nama) + "|" + normText(s?.kelas)
  );
}

/** Kunci unik siswa (ID, atau nama|kelas jika ID kosong) - dipakai UI untuk mencari hasil deteksi joki */
export const kunciSiswaAsesmen = (s) => kunciSiswa(s);

function urutkanTerawal(a, b) {
  if (a.ts && b.ts && a.ts !== b.ts) return a.ts - b.ts;
  return a.order - b.order; // urutan baris asli sebagai penentu
}

function ringkasRespon(p) {
  const { angka, skala100 } = parseNilai(p.r.nilai);
  return {
    mapel: p.r.mapel || "",
    nilai: p.r.nilai || "-",
    nilaiAngka: angka,
    nilai100: skala100,
    timestamp: p.r.timestamp || "",
    raw: p.r,
  };
}

/**
 * Cari semua respon Google Form milik siswa (urut dari yang paling awal).
 * Dipakai juga oleh evaluasiNilaiSiswa; diekspor untuk kebutuhan fitur deteksi berikutnya.
 */
export function cariResponSiswa(
  siswa,
  responList = [],
  targetMapel = "",
  daftarSiswa = [],
  abaikan = null,
) {
  if (!siswa || !Array.isArray(responList) || responList.length === 0)
    return [];

  const siap = siapkanRespon(responList);
  const sid = normText(siswa.id_siswa);
  const namaSiswaNorm = normText(siswa.nama);
  const tokenSiswa = namaTokens(siswa.nama);
  const adaFilterMapel = !isMapelSemua(targetMapel);
  const petaNama = namaPersisSiswaLain(daftarSiswa);
  const kunciSendiri = kunciSiswa(siswa);
  const memoMapel = new Map();

  const hasil = siap.filter((p) => {
    if (abaikan && abaikan.has(p.r)) return false; // respon yang ditandai bukan dikerjakan akun pemilik nama
    if (adaFilterMapel) {
      const kunci = String(p.r.mapel ?? "");
      if (!memoMapel.has(kunci))
        memoMapel.set(kunci, isMapelCocok(kunci, targetMapel));
      if (!memoMapel.get(kunci)) return false;
    }

    if (sid && p.id && sid === p.id) return true; // ID sama = pasti siswa ini

    if (!namaSiswaNorm || !p.namaNorm) return false;
    if (namaSiswaNorm === p.namaNorm) return true;
    if (!tokensMirip(tokenSiswa, p.tokens)) return false;

    // Nama hanya "mirip": jangan ambil respon yang persis bernama siswa lain
    if (petaNama && petaNama.has(p.namaNorm)) {
      const pemilik = petaNama.get(p.namaNorm);
      if (!pemilik.has(kunciSendiri)) return false;
    }
    return true;
  });

  return hasil.sort(urutkanTerawal);
}

/**
 * Evaluasi nilai seorang siswa dari kumpulan respon Google Form
 * ATURAN KHUSUS: Menggunakan respon PERTAMA yang masuk (earliest submission) per mata pelajaran
 *
 * @param {Object} siswa - Objek siswa { nama, kelas, id_siswa }
 * @param {Array} responList - Daftar respon form [{ nama, kelas, mapel, nilai, timestamp, ... }]
 * @param {string} targetMapel - Nama mata pelajaran yang sedang dipantau (kosong / "Semua Mapel" = semua)
 * @param {Array} daftarSiswa - (opsional) daftar siswa pembanding agar nama persis milik siswa lain tidak tertukar
 * @param {Set} abaikan - (opsional) respon yang diabaikan, mis. hasil `deteksiJoki(...).responTidakSah`
 * @returns {Object} { sudahUjian, nilai, nilaiAngka, nilai100, timestamp, raw, jumlahRespon, perMapel, banyakMapel }
 */
export function evaluasiNilaiSiswa(
  siswa,
  responList = [],
  targetMapel = "",
  daftarSiswa = [],
  abaikan = null,
) {
  const kosong = {
    sudahUjian: false,
    nilai: "-",
    nilaiAngka: null,
    nilai100: null,
    timestamp: "",
    raw: null,
    jumlahRespon: 0,
    perMapel: [],
    banyakMapel: false,
  };

  const cocok = cariResponSiswa(
    siswa,
    responList,
    targetMapel,
    daftarSiswa,
    abaikan,
  );
  if (cocok.length === 0) return kosong;

  // Respon pertama per mapel (cocok sudah urut dari yang paling awal)
  const perMapelMap = new Map();
  cocok.forEach((p) => {
    const kunci = normText(p.r.mapel) || "-";
    if (!perMapelMap.has(kunci)) perMapelMap.set(kunci, ringkasRespon(p));
  });
  const perMapel = Array.from(perMapelMap.values());

  const pertama = ringkasRespon(cocok[0]);

  return {
    sudahUjian: true,
    nilai: pertama.nilai,
    nilaiAngka: pertama.nilaiAngka,
    nilai100: pertama.nilai100,
    timestamp: pertama.timestamp,
    raw: pertama.raw,
    jumlahRespon: cocok.length,
    perMapel,
    banyakMapel: perMapel.length > 1,
  };
}

// ------------------------------------------------------------------
// DETEKSI JOKI (akun portal mengerjakan Google Form atas nama siswa lain)
// ------------------------------------------------------------------
// Prinsip: nama di Google Form berupa dropdown dari data sekolah = nama di akun portal, sehingga
// satu respon form PASTI milik satu siswa. Respon a.n. siswa Y yang masuk, padahal akun Y tidak
// tercatat membuka ujian mapel itu di portal, berarti diisi oleh akun lain.
//
// Bukti "akun membuka ujian mapel M" diambil dari `riwayat_sesi` (log LOG_SESI di GAS database, dicatat
// saat siswa menekan Mulai Ujian). Tanpa log, hanya akun yang BELUM PERNAH membuka ujian apa pun yang
// dicurigai, dan tingkatnya selalu "mungkin".
//
// Tingkat: "terdeteksi" = log ada dan sebagian besar siswa lain pada mapel itu tercatat; "mungkin" = bukti
// kurang kuat (log belum lengkap, mis. sebagian siswa memakai aplikasi yang tidak mencatat log).

const JENDELA_SESI_MS = 6 * 3600 * 1000; // sesi masuk s.d. respon masih dianggap satu ujian
const TOLERANSI_JAM_MS = 10 * 60 * 1000;

const ringkasSiswa = (s) => ({
  key: kunciSiswa(s),
  nama: s?.nama || "-",
  kelas: s?.kelas || "-",
  id_siswa: s?.id_siswa || "-",
});

const kelasSama = (a, b) => {
  const x = normText(a);
  const y = normText(b);
  return !!x && !!y && x === y;
};

/**
 * @param {Array} daftarSiswa - SEMUA siswa (lintas kelas) dengan field riwayat_sesi/log_mulai bila tersedia
 * @param {Array} responList - respon dari /api/exam/rekap-nilai
 * @param {string} targetMapel - mapel yang dipantau; kosong / "Semua Mapel" = semua mapel yang ada respon
 * @returns {{kasus:Array, perSiswa:Map, responTidakSah:Set, logTersedia:boolean, namaTidakDikenal:Array, catatan:Array}}
 */
export function deteksiJoki(
  daftarSiswa = [],
  responList = [],
  targetMapel = "",
) {
  const hasil = {
    kasus: [],
    perSiswa: new Map(), // kunci siswa -> { pelaku: [kasus], korban: [kasus] }
    responTidakSah: new Set(),
    logTersedia: false,
    namaTidakDikenal: [],
    catatan: [],
  };
  if (!Array.isArray(daftarSiswa) || !Array.isArray(responList)) return hasil;
  if (daftarSiswa.length === 0 || responList.length === 0) return hasil;

  const logTersedia = daftarSiswa.some((s) => Array.isArray(s?.riwayat_sesi));
  hasil.logTersedia = logTersedia;
  if (!logTersedia) {
    hasil.catatan.push(
      "Log riwayat masuk ujian belum tersedia (perbarui GAS database). Deteksi terbatas: hanya akun yang belum pernah membuka ujian.",
    );
  }
  let logMulaiMs = 0;
  daftarSiswa.forEach((s) => {
    const t = parseTimestampMs(s?.log_mulai);
    if (t > logMulaiMs) logMulaiMs = t;
  });

  const byNama = new Map();
  daftarSiswa.forEach((s) => {
    const n = normText(s?.nama);
    if (!n) return;
    if (!byNama.has(n)) byNama.set(n, []);
    byNama.get(n).push(s);
  });

  const siap = siapkanRespon(responList);
  const adaFilter = !isMapelSemua(targetMapel);

  // Spreadsheet yang dipakai beberapa mapel: respon tidak bisa dipastikan milik mapel yang mana -> dilewati
  const mapelPerSumber = new Map();
  siap.forEach((p) => {
    const sm = p.r?.sumber;
    if (!sm) return;
    if (!mapelPerSumber.has(sm)) mapelPerSumber.set(sm, new Set());
    mapelPerSumber.get(sm).add(normText(p.r.mapel) || "-");
  });
  const sumberBersama = new Set();
  mapelPerSumber.forEach((v, k) => {
    if (v.size > 1) sumberBersama.add(k);
  });
  if (sumberBersama.size > 0) {
    hasil.catatan.push(
      "Ada Spreadsheet respon yang dipakai beberapa mapel; respon itu dilewati dari deteksi joki. Gunakan 1 Spreadsheet per sesi.",
    );
  }

  let dilewatiLama = 0;
  const kelompok = new Map(); // kunci mapel -> { disp, items }
  siap.forEach((p) => {
    if (adaFilter && !isMapelCocok(p.r.mapel, targetMapel)) return;
    if (p.r?.sumber && sumberBersama.has(p.r.sumber)) return;
    if (logTersedia && logMulaiMs && (!p.ts || p.ts < logMulaiMs)) {
      dilewatiLama++; // respon sebelum log aktif: tidak ada bukti pembanding
      return;
    }
    const mk = normText(p.r.mapel) || "-";
    if (!kelompok.has(mk))
      kelompok.set(mk, { disp: p.r.mapel || "", items: [] });
    kelompok.get(mk).items.push(p);
  });
  if (dilewatiLama > 0) {
    hasil.catatan.push(
      `${dilewatiLama} respon sebelum log riwayat ujian aktif tidak diperiksa joki.`,
    );
  }

  const tandai = (kunci, jenis, kasus) => {
    if (!hasil.perSiswa.has(kunci))
      hasil.perSiswa.set(kunci, { pelaku: [], korban: [] });
    hasil.perSiswa.get(kunci)[jenis].push(kasus);
  };

  for (const [mk, grup] of kelompok) {
    const items = grup.items.slice().sort(urutkanTerawal);

    // 1. Pemilik respon (nama form -> akun portal)
    const pemilik = new Map(); // kunci siswa -> { s, items }
    items.forEach((p) => {
      const list = byNama.get(p.namaNorm);
      if (!list) {
        if (
          !hasil.namaTidakDikenal.some(
            (x) => x.nama === p.r.nama && x.mapel === grup.disp,
          )
        ) {
          hasil.namaTidakDikenal.push({
            nama: p.r.nama || p.r.namaForm || "-",
            mapel: grup.disp,
          });
        }
        return;
      }
      let s = null;
      if (list.length === 1) s = list[0];
      else {
        const f = list.filter((x) => kelasSama(x.kelas, p.r.kelas));
        if (f.length === 1) s = f[0];
      }
      if (!s) return; // nama kembar antar kelas & kelas respon tidak jelas: tidak dinilai
      const k = kunciSiswa(s);
      if (!pemilik.has(k)) pemilik.set(k, { s, items: [] });
      pemilik.get(k).items.push(p);
    });

    const sesiUntuk = (s) =>
      (Array.isArray(s?.riwayat_sesi) ? s.riwayat_sesi : [])
        .filter((e) => isMapelCocok(e?.mapel, grup.disp))
        .map((e) => ({ ...e, ms: parseTimestampMs(e?.waktu) }));

    // 2. Pemilik respon yang akunnya tidak tercatat membuka ujian mapel ini
    const mencurigakan = [];
    let total = 0;
    let bersesi = 0;
    pemilik.forEach((v) => {
      total++;
      let curiga = false;
      if (logTersedia) {
        if (sesiUntuk(v.s).length > 0) bersesi++;
        else curiga = true;
      } else {
        const st = String(v.s?.status_sesi || "").trim();
        const ma = String(v.s?.mapel_aktif || "").trim();
        if (!st && !ma) curiga = true;
        else bersesi++;
      }
      if (curiga) mencurigakan.push(v);
    });
    if (mencurigakan.length === 0) continue;

    const andal = logTersedia && total >= 3 && bersesi / total >= 0.5;
    const tingkat = andal ? "terdeteksi" : "mungkin";

    // 3. Kandidat pelaku: akun yang membuka ujian mapel ini tetapi tidak punya respon atas namanya sendiri
    const kunciBerespon = new Set(pemilik.keys());
    const kandidatPelaku = [];
    if (logTersedia) {
      daftarSiswa.forEach((x) => {
        if (kunciBerespon.has(kunciSiswa(x))) return;
        const waktu = sesiUntuk(x)
          .map((e) => e.ms)
          .filter(Boolean);
        if (waktu.length === 0) return;
        kandidatPelaku.push({ s: x, ms: Math.min(...waktu) });
      });
    }

    mencurigakan.sort((a, b) => urutkanTerawal(a.items[0], b.items[0]));
    const dipakai = new Set();

    mencurigakan.forEach((v) => {
      const p = v.items[0];
      let pelaku = null;
      let kandidat = [];
      if (logTersedia && p.ts) {
        let calon = kandidatPelaku.filter(
          (c) =>
            !dipakai.has(kunciSiswa(c.s)) &&
            c.ms <= p.ts + TOLERANSI_JAM_MS &&
            p.ts - c.ms <= JENDELA_SESI_MS,
        );
        // Bila kandidat lebih dari satu: sesi sebuah akun "milik" respon terdekat setelah sesi itu dibuka.
        // Akun yang sesinya lebih dekat ke respon LAIN (mis. sudah dipakai mengerjakan form lain) dikeluarkan.
        if (calon.length > 1) {
          const tsSemua = items
            .map((it) => it.ts)
            .filter(Boolean)
            .sort((a, b) => a - b);
          const sesiTerdekat = (c) => {
            const semuaMs = sesiUntuk(c.s)
              .map((e) => e.ms)
              .filter(Boolean);
            return semuaMs.some((ms) => {
              const next = tsSemua.find((t) => t >= ms - TOLERANSI_JAM_MS);
              return next === p.ts;
            });
          };
          const sempit = calon.filter(sesiTerdekat);
          if (sempit.length >= 1) calon = sempit;
        }
        kandidat = calon.slice(0, 5).map((c) => ringkasSiswa(c.s));
        // Pelaku hanya disebut bila satu-satunya akun yang cocok (hindari menuduh akun yang belum selesai)
        if (calon.length === 1) {
          pelaku = ringkasSiswa(calon[0].s);
          dipakai.add(pelaku.key);
        }
      }

      const korban = ringkasSiswa(v.s);
      const mapelLabel = grup.disp || "-";
      const nilaiInfo = (() => {
        const n = parseNilai(p.r.nilai);
        return {
          nilai: p.r.nilai || "-",
          nilaiAngka: n.angka,
          nilai100: n.skala100,
        };
      })();
      const kasus = {
        id: `${mk}|${korban.key}`,
        mapel: mapelLabel,
        tingkat,
        korban,
        pelaku,
        kandidat: pelaku ? [] : kandidat,
        waktuRespon: p.r.timestamp || "",
        ...nilaiInfo,
        alasan: logTersedia
          ? `Respon a.n. ${korban.nama} masuk, tetapi akun ${korban.nama} tidak tercatat membuka ujian ${mapelLabel} di portal.`
          : `Respon a.n. ${korban.nama} masuk, tetapi akun ${korban.nama} belum pernah membuka sesi ujian di portal.`,
      };
      hasil.kasus.push(kasus);
      v.items.forEach((it) => hasil.responTidakSah.add(it.r));
      tandai(korban.key, "korban", kasus);
      if (pelaku) tandai(pelaku.key, "pelaku", kasus);
    });
  }

  return hasil;
}
