// ==========================================
// AUTH.JS
// Mengelola Session Login Presensi Magang
// ==========================================

const STORAGE_KEY = "magang_session";

/**
 * Simpan session login
 * @param {Object} userData
 */
export function saveSession(userData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
}

/**
 * Ambil data session
 * @returns {Object|null}
 */
export function getSession() {
  if (typeof window === "undefined") return null;

  const data = localStorage.getItem(STORAGE_KEY);

  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Hapus session
 */
export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Apakah sudah login?
 * @returns {boolean}
 */
export function isLoggedIn() {
  return getSession() !== null;
}

/**
 * Ambil role user
 * @returns {string|null}
 */
export function getRole() {
  const user = getSession();

  return user ? user.role : null;
}

/**
 * Ambil nama user
 * @returns {string}
 */
export function getNama() {
  const user = getSession();

  return user ? user.nama : "";
}

/**
 * Ambil ID user
 * @returns {string}
 */
export function getId() {
  const user = getSession();

  return user ? user.id : "";
}
