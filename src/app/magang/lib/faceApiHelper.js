// =====================================================================
// faceApiHelper.js — Modul Pusat Pengenalan Wajah & Anti-Duplikasi Biometrik
// Menggunakan @vladmandic/face-api (128-d Neural Embeddings)
// =====================================================================

export const FA_VERSION = "1.7.15";
export const FA_BUNDLE = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FA_VERSION}/dist/face-api.esm.js`;
export const FA_MODELS = `https://cdn.jsdelivr.net/npm/@vladmandic/face-api@${FA_VERSION}/model/`;

export const DESC_KEY = "face_desc_v2_";
export const MATCH_DIST = 0.5; // Batas kecocokan presensi
export const DUPLICATE_THRESHOLD = 0.33; // Batas identik anti-duplikasi pasti (makin kecil = makin mirip). Di atas 0.33 adalah kemiripan wajar (jilbab/lookalike)
export const LOOSE_DIST = 0.6; // di atas ini = jelas bukan siapa pun
export const MARGIN_MIN = 0.06; // jarak siswa terdekat ke-2 harus lebih jauh sekian (anti-ragu)
export const VOTES_NEEDED = 3; // jumlah hasil identik berturut-turut sebelum dicatat hadir
export const VOTE_WINDOW_MS = 3500; // jendela waktu pengumpulan suara
export const MIN_FACE_RATIO = 0.16; // lebar wajah minimal terhadap lebar frame kamera
export const MAX_YAW = 0.35; // toleransi menoleh (rasio hidung terhadap jarak mata)
export const MAX_ROLL_DEG = 22; // toleransi kepala miring
export const DETECT_INTERVAL_MS = 110; // jeda antar deteksi wajah
export const DESC_INTERVAL_MS = 300; // jeda antar pembuatan deskriptor (bagian paling berat)
export const SCAN_COOLDOWN_MS = 3000; // jeda anti-duplikat setelah satu siswa tercatat

let faPromise = null;

export function resetFaceApiPromise() {
  faPromise = null;
}

// Pemuatan modul face-api secara singleton (hanya 1x per sesi, bisa di-force jika retry)
export function loadFaceApi(force = false) {
  if (force) {
    faPromise = null;
  }
  if (faPromise) return faPromise;
  faPromise = (async () => {
    const fa = await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ FA_BUNDLE
    );
    let backendOk = false;
    try {
      backendOk = await fa.tf.setBackend("webgl");
    } catch (_) {}
    if (!backendOk) await fa.tf.setBackend("cpu");
    await fa.tf.ready();
    await Promise.all([
      fa.nets.tinyFaceDetector.loadFromUri(FA_MODELS),
      fa.nets.faceLandmark68TinyNet.loadFromUri(FA_MODELS),
      fa.nets.faceRecognitionNet.loadFromUri(FA_MODELS),
    ]);
    return fa;
  })().catch((err) => {
    faPromise = null; // Boleh dicoba lagi jika koneksi sempat terputus
    throw err;
  });
  return faPromise;
}

// Jarak Euclidean antar dua deskriptor 128-d
export function euclid(a, b) {
  if (!a || !b || a.length !== 128 || b.length !== 128) return Infinity;
  let s = 0;
  for (let i = 0; i < 128; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

// Cari siswa paling mirip + jarak ke siswa terdekat kedua
export function matchFace(desc, profiles) {
  let best = null;
  let d1 = Infinity;
  let d2 = Infinity;
  for (const p of profiles) {
    const d = euclid(desc, p.descriptor);
    if (d < d1) {
      d2 = d1;
      d1 = d;
      best = p;
    } else if (d < d2) {
      d2 = d;
    }
  }
  return { best, d1, d2 };
}

export function isConfident(
  d1,
  d2,
  matchDist = MATCH_DIST,
  marginMin = MARGIN_MIN,
) {
  return d1 <= matchDist && d2 - d1 >= marginMin;
}

// Kumpulkan suara; kembalikan idSiswa jika sudah terkonfirmasi (atau null)
export function pushVote(
  votes,
  id,
  now,
  windowMs = VOTE_WINDOW_MS,
  needed = VOTES_NEEDED,
) {
  while (votes.length && now - votes[0].t > windowMs) votes.shift();
  votes.push({ id, t: now });
  if (!id) return null;
  const counts = {};
  for (const v of votes) if (v.id) counts[v.id] = (counts[v.id] || 0) + 1;
  if ((counts[id] || 0) < needed) return null;
  for (const k of Object.keys(counts)) {
    if (k !== id && counts[k] >= 2) return null; // ada kandidat lain yang bersaing
  }
  return id;
}

// Kotak wajah (piksel video) -> persen di kontainer (video memakai object-cover)
export function mapBoxToContainer(box, vw, vh, cw, ch, mirror) {
  const scale = Math.max(cw / vw, ch / vh);
  const ox = (cw - vw * scale) / 2;
  const oy = (ch - vh * scale) / 2;
  const w = box.width * scale;
  const h = box.height * scale;
  let left = box.x * scale + ox;
  const top = box.y * scale + oy;
  if (mirror) left = cw - left - w;
  return {
    leftPct: (left / cw) * 100,
    topPct: (top / ch) * 100,
    widthPct: (w / cw) * 100,
    heightPct: (h / ch) * 100,
  };
}

export function centerOf(pts) {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

// Perkiraan arah hadap & kemiringan dari 68 titik landmark
export function headPose(landmarks) {
  const eyes = [
    centerOf(landmarks.getLeftEye()),
    centerOf(landmarks.getRightEye()),
  ].sort((a, b) => a.x - b.x);
  const nose = landmarks.getNose();
  const tip = nose[3] || nose[Math.floor(nose.length / 2)];
  const dx = eyes[1].x - eyes[0].x;
  const dy = eyes[1].y - eyes[0].y;
  const eyeDist = Math.hypot(dx, dy) || 1;
  const midX = (eyes[0].x + eyes[1].x) / 2;
  return {
    yaw: (tip.x - midX) / eyeDist,
    rollDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

// Ekstrak ID file Google Drive dari berbagai variasi URL
export function extractDriveFileId(url) {
  if (!url || typeof url !== "string") return "";
  const m1 = url.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (m2) return m2[1];
  return "";
}

// Cek apakah dua URL merujuk ke foto yang sama (identik atau ID Google Drive sama)
export function isSameFaceUrl(urlA, urlB) {
  if (!urlA || !urlB) return false;
  if (urlA === urlB) return true;
  const idA = extractDriveFileId(urlA);
  const idB = extractDriveFileId(urlB);
  if (idA && idB && idA === idB) return true;
  return false;
}

// Baca deskriptor dari cache lokal
export function readCachedDescriptor(idSiswa, url) {
  try {
    const raw = localStorage.getItem(DESC_KEY + idSiswa);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (isSameFaceUrl(o?.url, url)) {
      if (Array.isArray(o.d) && o.d.length === 128) {
        return Float32Array.from(o.d);
      }
      if (o.status === "noface" || o.status === "error") {
        return { status: o.status };
      }
    }
  } catch (_) {}
  return null;
}

// Simpan deskriptor ke cache lokal
export function writeCachedDescriptor(idSiswa, url, desc) {
  try {
    if (!desc) return;
    if (desc === "NO_FACE" || desc === "ERROR") {
      localStorage.setItem(
        DESC_KEY + idSiswa,
        JSON.stringify({
          url: url || "",
          status: desc === "NO_FACE" ? "noface" : "error",
        }),
      );
      return;
    }
    localStorage.setItem(
      DESC_KEY + idSiswa,
      JSON.stringify({
        url: url || "",
        d: Array.from(desc, (v) => +v.toFixed(5)),
        status: "ok",
      }),
    );
  } catch (_) {}
}

export function driveThumbUrl(url, size = 320) {
  if (!url) return "";
  const id = extractDriveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : url;
}

export function loadImage(src, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      img.src = "";
      reject(new Error("Timeout memuat gambar"));
    }, timeoutMs);
    img.crossOrigin = "anonymous";
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("Gagal memuat gambar"));
    };
    img.src = src;
  });
}

// Muat foto wajah lewat proxy atau thumbnail Drive (Fast & Offline-Aware)
export async function loadFaceImage(url) {
  if (!url) throw new Error("URL foto kosong");
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return await loadImage(url, 10000);
  }

  // Fast-fail bila perangkat sedang offline: cegah UI macet/timeout bermenit-menit
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error("OFFLINE_NETWORK_UNAVAILABLE");
  }

  const candidates = [
    `/api/image-proxy?url=${encodeURIComponent(url)}`,
    driveThumbUrl(url, 320),
  ];
  let lastErr = null;
  for (const src of candidates) {
    try {
      return await loadImage(src, 4000);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("Gagal memuat foto wajah");
}

// Ekstrak deskriptor 128-d dari URL foto pendaftaran (Cepat & Hemat Memori)
export async function computeTemplate(fa, url) {
  const img = await loadFaceImage(url);
  // Deteksi cepat kilat (inputSize 320, ambang 0.3)
  let det = await fa
    .detectSingleFace(
      img,
      new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.3 }),
    )
    .withFaceLandmarks(true);

  // Jika belum terbaca (misal pencahayaan kurang/sedikit miring), coba fallback
  if (!det) {
    det = await fa
      .detectSingleFace(
        img,
        new fa.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.25 }),
      )
      .withFaceLandmarks(true);
  }

  if (!det) return { descriptor: null };
  const [canvas] = await fa.extractFaces(img, [det.landmarks.align()]);
  const descriptor =
    await fa.nets.faceRecognitionNet.computeFaceDescriptor(canvas);
  return { descriptor };
}

// Cari nama siswa dari berbagai cache penyimpanan lokal
export function findStudentNameById(idSiswa, otherStudents = []) {
  if (!idSiswa) return "Siswa Lain";

  // 1. Cek dari daftar siswa yang di-passing
  if (Array.isArray(otherStudents)) {
    const found = otherStudents.find(
      (s) => String(s.idSiswa || s.id || "").trim() === String(idSiswa).trim(),
    );
    if (found?.nama || found?.namaSiswa) return found.nama || found.namaSiswa;
  }

  // 2. Cek dari face_reg_[id]
  try {
    const reg = localStorage.getItem(`face_reg_${idSiswa}`);
    if (reg) {
      const parsed = JSON.parse(reg);
      if (parsed?.nama) return parsed.nama;
    }
  } catch (_) {}

  // 3. Cek dari semua cache_scan_siswa_* di localStorage
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("cache_scan_siswa_")) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr)) {
            const match = arr.find(
              (s) =>
                String(s.idSiswa || s.id || "").trim() ===
                String(idSiswa).trim(),
            );
            if (match?.nama) return match.nama;
          }
        }
      }
    }
  } catch (_) {}

  return `Siswa ID ${idSiswa}`;
}

// =====================================================================
// PENGECEKAN ANTI-DUPLIKASI BIOMETRIK (PRE-REGISTRATION FACE MATCHING)
// =====================================================================
/**
 * Mengecek apakah deskriptor wajah baru mirip dengan siswa lain yang sudah terdaftar
 * @param {Object} params
 * @param {string|number} params.currentStudentId - ID siswa yang sedang didaftarkan
 * @param {Float32Array|Array} params.descriptor - Deskriptor 128-d wajah baru
 * @param {Array} [params.otherStudents] - Daftar siswa rombel/kelas (opsional)
 * @param {number} [params.threshold=0.33] - Jarak maksimal yang dianggap identik pasti
 * @returns {Promise<{ isDuplicate: boolean, matchedId?: string, matchedName?: string, distance?: number }>}
 */
export async function checkFaceDuplicate({
  currentStudentId,
  descriptor,
  otherStudents = [],
  threshold = DUPLICATE_THRESHOLD,
}) {
  if (!descriptor || descriptor.length !== 128) {
    return { isDuplicate: false };
  }

  const curIdStr = String(currentStudentId || "").trim();

  // Buat index siswa aktif dari otherStudents (jika ada)
  const hasOtherStudentsList = Array.isArray(otherStudents) && otherStudents.length > 0;
  const activeStudentMap = new Map();
  if (hasOtherStudentsList) {
    for (const st of otherStudents) {
      const sid = String(st.idSiswa || st.id || "").trim();
      if (sid && sid !== curIdStr) {
        activeStudentMap.set(sid, st);
        // Jika siswa di rombel tidak memiliki foto (misal foto telah dihapus), bersihkan cache lokal usang
        if (!st.fotoWajah) {
          try {
            localStorage.removeItem(DESC_KEY + sid);
          } catch (_) {}
        }
      }
    }
  }

  // 1. Periksa seluruh descriptor yang tersimpan di localStorage (face_desc_v2_*)
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DESC_KEY)) {
        const otherId = key.slice(DESC_KEY.length).trim();
        if (otherId && otherId !== curIdStr) {
          // Jika otherStudents disediakan, pastikan otherId memang terdaftar dan memiliki foto aktif
          if (hasOtherStudentsList) {
            const stInfo = activeStudentMap.get(otherId);
            if (!stInfo || !stInfo.fotoWajah) {
              // Siswa ini tidak dalam daftar aktif atau fotonya sudah dihapus; abaikan cache usang
              continue;
            }
          }

          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.d) && parsed.d.length === 128) {
              // Jika otherStudents tersedia, pastikan URL foto di cache sesuai dengan foto aktif
              if (hasOtherStudentsList) {
                const stInfo = activeStudentMap.get(otherId);
                if (stInfo?.fotoWajah && parsed.url && parsed.url !== stInfo.fotoWajah) {
                  // Cache URL tidak cocok dengan foto terkini; lewati
                  continue;
                }
              }

              const dist = euclid(descriptor, parsed.d);
              if (dist <= threshold) {
                const matchedName = findStudentNameById(otherId, otherStudents);
                return {
                  isDuplicate: true,
                  matchedId: otherId,
                  matchedName,
                  distance: dist,
                };
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn("Pemeriksaan duplikasi descriptor lokal gagal:", e);
  }

  // 2. Periksa siswa lain dari otherStudents yang belum memiliki descriptor lokal
  if (hasOtherStudentsList) {
    let fa = null;
    for (const st of otherStudents) {
      const sid = String(st.idSiswa || st.id || "").trim();
      if (!sid || sid === curIdStr || !st.fotoWajah) continue;

      // Cek apakah descriptor sudah ada di cache
      const cached = readCachedDescriptor(sid, st.fotoWajah);
      if (cached && !(cached instanceof Object && cached.status)) {
        const dist = euclid(descriptor, cached);
        if (dist <= threshold) {
          return {
            isDuplicate: true,
            matchedId: sid,
            matchedName: st.nama || st.namaSiswa || sid,
            distance: dist,
          };
        }
      } else {
        // Ekstrak template siswa pembanding jika perlu
        try {
          if (!fa) fa = await loadFaceApi();
          const res = await computeTemplate(fa, st.fotoWajah);
          if (res?.descriptor) {
            writeCachedDescriptor(sid, st.fotoWajah, res.descriptor);
            const dist = euclid(descriptor, res.descriptor);
            if (dist <= threshold) {
              return {
                isDuplicate: true,
                matchedId: sid,
                matchedName: st.nama || st.namaSiswa || sid,
                distance: dist,
              };
            }
          }
        } catch (_) {}
      }
    }
  }

  return { isDuplicate: false };
}

// =====================================================================
// LIVENESS — TANTANGAN TOLEH KEPALA (v2, toleran & tahan getaran)
// ---------------------------------------------------------------------
// Prinsip: foto cetak / layar HP tidak bisa mengubah arah hadap. Siswa
// cukup menoleh kiri ATAU kanan (sedikit sampai jauh), lalu hadap lurus.
//
// Perbaikan dari versi sebelumnya:
//  1) Yaw diukur RELATIF terhadap posisi awal siswa (baseline). Wajah yang
//     secara alami condong (hidung asimetris / sudut kamera) tidak lagi
//     macet di fase "kembali ke tengah".
//  2) Yaw disaring median-3 dan butuh >= 2 frame berturut-turut, sehingga
//     getaran landmark / foto yang digoyang tidak dihitung sebagai toleh.
//  3) Menoleh JAUH tidak membatalkan tantangan (modal memakai
//     MAX_CHALLENGE_YAW selama tantangan, bukan MAX_YAW).
//  4) Wajah hilang sesaat (saat menoleh jauh detektor sering kehilangan
//     wajah) diberi masa tenggang FACE_LOSS_GRACE_MS, bukan reset total.
//  5) Status "terverifikasi" kedaluwarsa setelah LIVENESS_TTL_MS.
// =====================================================================
export const HEAD_TURN_REL = 0.28; // selisih yaw dari baseline agar dianggap menoleh (~25-30 derajat)
export const HEAD_CENTER_REL = 0.1; // selisih maksimum dari baseline agar dianggap sudah kembali
export const MAX_CHALLENGE_YAW = 1.0; // batas yaw saat tantangan berlangsung (menoleh jauh diperbolehkan)
export const HEAD_HOLD_MS = 300; // lama tahan minimal di posisi toleh / tengah (tahan sebentar ~0,3 dtk)
export const HEAD_HOLD_FRAMES = 3; // dan minimal sekian frame berturut-turut
export const HEAD_CENTER_HOLD_MS = 150; // tahan di tengah (identitas tetap harus cocok lagi sesudahnya)
export const HEAD_CENTER_FRAMES = 2;
export const HEAD_BASELINE_FRAMES = 4; // jumlah frame stabil untuk menentukan baseline
export const HEAD_BASELINE_SPREAD = 0.08; // batas getaran yaw saat kalibrasi baseline
export const HEAD_BASELINE_FALLBACK_MS = 2500; // tak kunjung diam: pakai median frame terakhir
export const HEAD_TURN_TIMEOUT_MS = 10000; // fase "toleh" diulang bila tak ada gerakan
export const HEAD_CENTER_TIMEOUT_MS = 6000; // fase "kembali" diulang bila tak kembali
export const LIVENESS_TTL_MS = 10000; // masa berlaku verifikasi sampai wajah dicocokkan
export const IDENT_WINDOW_MS = 6000; // jendela suara identitas (lebih panjang: siswa sedang menoleh)
export const IDENT_LOCK_TTL_MS = 12000; // identitas yang sudah terkunci dianggap segar selama ini
export const IDENT_LATE_LOCK_MS = 1000; // kunci identitas yang terbentuk >1 dtk setelah liveness tidak dipercaya
export const FACE_LOSS_GRACE_MS = 1500; // wajah boleh hilang sesaat tanpa reset tantangan

// Alias nama lama agar impor lama tidak error
export const HEAD_TURN_YAW = HEAD_TURN_REL;
export const HEAD_CENTER_YAW = HEAD_CENTER_REL;
export const HEAD_TURN_HOLD_MS = HEAD_HOLD_MS;

function median(arr) {
  const a = [...arr].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

function newHeadTracker(now) {
  return {
    phase: "calibrating", // calibrating -> need_turn -> need_center -> verified
    base: 0,
    baseBuf: [],
    yawBuf: [],
    direction: 0,
    holdStart: 0,
    holdFrames: 0,
    centerStart: 0,
    centerFrames: 0,
    phaseStart: now,
    lastSeenAt: now,
    verifiedAt: 0,
    relYaw: 0,
    isMotionVerified: false,
  };
}

/**
 * State machine liveness. Panggil sekali per frame saat satu wajah terdeteksi.
 * Mengembalikan tracker (objek yang sama, diubah di tempat).
 */
export function updateHeadTurnTracker(tracker, yaw, now = Date.now()) {
  let t = tracker || newHeadTracker(now);

  if (t.isMotionVerified) {
    if (now - t.verifiedAt <= LIVENESS_TTL_MS) {
      t.lastSeenAt = now;
      return t;
    }
    t = newHeadTracker(now); // kedaluwarsa: ulangi dari awal
  }

  t.lastSeenAt = now;
  t.yawBuf.push(yaw);
  if (t.yawBuf.length > 3) t.yawBuf.shift();
  const y = t.yawBuf.length >= 3 ? median(t.yawBuf) : yaw;

  // ── Kalibrasi baseline: tunggu beberapa frame yang stabil ──────────
  // Siswa yang tidak pernah diam (terus menoleh) tidak akan pernah stabil, jadi
  // setelah HEAD_BASELINE_FALLBACK_MS dipakai median beberapa frame terakhir.
  if (t.phase === "calibrating") {
    t.baseBuf.push(y);
    if (t.baseBuf.length > 8) t.baseBuf.shift();
    const recent = t.baseBuf.slice(-HEAD_BASELINE_FRAMES);
    if (recent.length >= HEAD_BASELINE_FRAMES) {
      const spread = Math.max(...recent) - Math.min(...recent);
      const stable = spread <= HEAD_BASELINE_SPREAD;
      const timedOut =
        now - t.phaseStart >= HEAD_BASELINE_FALLBACK_MS &&
        t.baseBuf.length >= 6;
      if (stable || timedOut) {
        t.base = median(stable ? recent : t.baseBuf);
        t.phase = "need_turn";
        t.phaseStart = now;
        t.direction = 0;
        t.holdFrames = 0;
      }
    }
    t.relYaw = 0;
    return t;
  }

  const rel = y - t.base;
  t.relYaw = rel;

  // ── Fase 1: menoleh (kiri atau kanan, seberapa jauh pun) ───────────
  if (t.phase === "need_turn") {
    if (now - t.phaseStart > HEAD_TURN_TIMEOUT_MS) {
      t.phaseStart = now;
      t.direction = 0;
      t.holdFrames = 0;
      return t;
    }
    if (Math.abs(rel) >= HEAD_TURN_REL) {
      const dir = rel > 0 ? 1 : -1;
      if (t.direction !== dir) {
        t.direction = dir;
        t.holdStart = now;
        t.holdFrames = 1;
      } else {
        t.holdFrames += 1;
      }
      if (
        t.holdFrames >= HEAD_HOLD_FRAMES &&
        now - t.holdStart >= HEAD_HOLD_MS
      ) {
        t.phase = "need_center";
        t.phaseStart = now;
        t.centerStart = 0;
        t.centerFrames = 0;
      }
    } else {
      t.direction = 0;
      t.holdFrames = 0;
    }
    return t;
  }

  // ── Fase 2: kembali menghadap lurus ────────────────────────────────
  if (t.phase === "need_center") {
    if (now - t.phaseStart > HEAD_CENTER_TIMEOUT_MS) {
      t.phase = "need_turn";
      t.phaseStart = now;
      t.direction = 0;
      t.holdFrames = 0;
      return t;
    }
    if (Math.abs(rel) <= HEAD_CENTER_REL) {
      if (!t.centerStart) t.centerStart = now;
      t.centerFrames += 1;
      if (
        t.centerFrames >= HEAD_CENTER_FRAMES &&
        now - t.centerStart >= HEAD_CENTER_HOLD_MS
      ) {
        t.phase = "verified";
        t.isMotionVerified = true;
        t.verifiedAt = now;
      }
    } else {
      t.centerStart = 0;
      t.centerFrames = 0;
    }
    return t;
  }

  return t;
}

/**
 * Dipanggil saat frame tidak valid (wajah hilang, di luar zona, dsb.).
 * Tantangan dipertahankan selama masih dalam masa tenggang.
 */
export function keepLiveness(tracker, now = Date.now()) {
  if (!tracker) return null;
  return now - tracker.lastSeenAt <= FACE_LOSS_GRACE_MS ? tracker : null;
}

/** Teks petunjuk untuk siswa sesuai fase tantangan (ringkas untuk ponsel). */
export function headTurnHint(tracker) {
  if (!tracker || tracker.phase === "calibrating") {
    return "😐 Hadap lurus ke kamera sebentar";
  }
  if (tracker.phase === "need_center") {
    return "😊 Bagus! Hadapkan kembali wajah ke kamera";
  }
  return "↔️ Toleh sedikit ke kiri atau kanan";
}

/** Nomor langkah tantangan untuk indikator di layar: -1 = tidak aktif, 0..3 */
export function headTurnStep(tracker) {
  if (!tracker) return -1;
  if (tracker.phase === "calibrating") return 0;
  if (tracker.phase === "need_turn") return 1;
  if (tracker.phase === "need_center") return 2;
  return 3;
}
