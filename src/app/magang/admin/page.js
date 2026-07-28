"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { verifikasiPinLogin, verifikasiPinHapus } from "./actions"; // Memanggil fungsi aman dari server

// Ganti URL ini dengan URL dari hasil "NEW DEPLOYMENT" yang aksesnya "Anyone"
const API_URL =
  "https://script.google.com/macros/s/AKfycbwL6gJ9rVKps7EmqKO0o928iwbFlqk-xQDY4za0PcIPh0f-kkRTyu5XCavvZ-9bsZA/exec";

export default function AdminPage() {
  const router = useRouter();

  // ===========================
  // Mencegah Hydration Error & Pemanasan Server
  // ===========================
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    // TRIK PEMANASAN (WARM UP): Menembak API secara diam-diam di latar belakang.
    // Ini memaksa server Google Apps Script bangun dari 'tidur' (cold start)
    // saat layar PIN masih tampil, sehingga saat PIN benar data langsung instan.
    fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      redirect: "follow",
      body: JSON.stringify({ action: "getAdminGuru" }),
    }).catch(() => {
      // Dibiarkan kosong/diabaikan karena ini hanya tembakan pemancing
    });
  }, []);

  // ===========================
  // State Autentikasi (Kunci PIN)
  // ===========================
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inputPin, setInputPin] = useState("");

  // State Data
  const [loading, setLoading] = useState(true);
  const [guruList, setGuruList] = useState([]);

  // State Tambah & Hapus
  const [showTambah, setShowTambah] = useState(false);
  const [namaGuru, setNamaGuru] = useState("");
  const [saving, setSaving] = useState(false);

  const [showHapus, setShowHapus] = useState(false);
  const [hapusId, setHapusId] = useState("");
  const [kodeHapus, setKodeHapus] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [toast, setToast] = useState({
    show: false,
    message: "",
    type: "success",
  });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  // ===========================
  // Fungsi Cek PIN Login (Diperbarui)
  // ===========================
  const handleLoginAdmin = async (e) => {
    e.preventDefault();

    // Mengecek PIN murni di belakang layar (Server)
    const isPinBenar = await verifikasiPinLogin(inputPin);

    if (isPinBenar) {
      setIsAuthenticated(true);
      loadGuru();
    } else {
      showToast("Kode PIN salah!", "error");
      setInputPin("");
    }
  };

  // ===========================
  // Ambil Data Guru
  // ===========================
  async function loadGuru() {
    try {
      setLoading(true);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        redirect: "follow",
        body: JSON.stringify({
          action: "getAdminGuru",
        }),
      });

      const json = await res.json();

      if (json.success) {
        const sortedData = (json.data || []).sort((a, b) =>
          a.NAMA_GURU.localeCompare(b.NAMA_GURU),
        );
        setGuruList(sortedData);
      } else {
        showToast(json.message, "error");
      }
    } catch (err) {
      console.error("Error loadGuru:", err);
      showToast(
        "Gagal mengambil data. Pastikan Apps Script diset 'Anyone'.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  // ===========================
  // Simpan Guru
  // ===========================
  async function simpanGuru() {
    if (!namaGuru.trim()) {
      showToast("Nama guru wajib diisi.", "error");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        redirect: "follow",
        body: JSON.stringify({
          action: "addAdminGuru",
          params: {
            nama: namaGuru,
          },
        }),
      });

      const json = await res.json();

      if (!json.success) {
        showToast(json.message, "error");
        return;
      }

      showToast("Akun guru berhasil dibuat", "success");
      setNamaGuru("");
      setShowTambah(false);
      loadGuru();
    } catch (err) {
      console.error("Error simpanGuru:", err);
      showToast("Terjadi kesalahan saat menyimpan data.", "error");
    } finally {
      setSaving(false);
    }
  }

  // Jika halaman belum sepenuhnya dimuat oleh browser, jangan tampilkan apa-apa (mencegah bentrok server cache)
  if (!isMounted) {
    return null;
  }

  // ===========================
  // TAMPILAN LOCK SCREEN
  // ===========================
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-blue-50 p-5">
        {toast.show && (
          <div className="fixed left-1/2 top-10 z-[100] flex w-[90%] max-w-sm -translate-x-1/2 transform items-center gap-4 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 transition-all">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
              🔴
            </div>
            <div>
              <div className="text-lg font-black text-slate-800">Gagal</div>
              <div className="text-sm font-medium text-slate-500">
                {toast.message}
              </div>
            </div>
          </div>
        )}

        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-4xl shadow-inner">
              🔒
            </div>
          </div>
          <h2 className="text-center text-2xl font-black text-slate-800">
            Akses Terbatas
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Masukkan kode rahasia admin untuk mengelola data.
          </p>

          <form onSubmit={handleLoginAdmin} className="mt-8">
            <input
              type="password"
              value={inputPin}
              onChange={(e) => setInputPin(e.target.value)}
              placeholder="Masukkan kode PIN"
              className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-4 text-center text-2xl tracking-widest outline-none transition focus:border-blue-600 focus:bg-white"
              autoFocus
            />
            <button
              type="submit"
              className="mt-6 w-full rounded-2xl bg-blue-700 py-4 font-bold text-white shadow-lg transition hover:bg-blue-800"
            >
              Buka Kunci
            </button>
          </form>

          <button
            onClick={() => router.push("/magang/login")}
            className="mt-4 w-full py-2 text-sm font-bold text-slate-500 transition hover:text-slate-800"
          >
            ← Kembali ke Halaman Utama
          </button>
        </div>
      </div>
    );
  }

  // ===========================
  // TAMPILAN DASHBOARD
  // ===========================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-white to-blue-50">
      {toast.show && (
        <div className="fixed left-1/2 top-10 z-[100] flex w-[90%] max-w-sm -translate-x-1/2 transform items-center gap-4 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-900/5 transition-all">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-2xl ${
              toast.type === "success"
                ? "bg-green-100 text-green-600"
                : "bg-red-100 text-red-600"
            }`}
          >
            {toast.type === "success" ? "🟢" : "🔴"}
          </div>
          <div>
            <div className="text-lg font-black text-slate-800">
              {toast.type === "success" ? "Berhasil" : "Gagal"}
            </div>
            <div className="text-sm font-medium text-slate-500">
              {toast.message}
            </div>
          </div>
        </div>
      )}

      {/* HEADER FIXED (Responsif seperti halaman siswa) */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg border-b border-blue-700/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white/10 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/20">
              <img
                src="/logo.png"
                alt="Logo"
                className="object-contain w-9 h-9 sm:w-[44px] sm:h-[44px]"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                DASHBOARD SUPER ADMIN
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300 tracking-wide mt-0.5">
                Kelola Akun Guru Pembimbing
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              window.location.href = "/magang/login";
            }}
            className="rounded-lg sm:rounded-xl bg-white/10 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm"
          >
            Keluar
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-5">
        {/* CARD STATISTIK */}
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-6 shadow-lg">
            <div className="text-sm text-slate-500">Total Guru Pembimbing</div>
            <div className="mt-2 text-5xl font-black text-blue-800">
              {guruList.length}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-3xl bg-gradient-to-r from-yellow-300 via-yellow-200 to-amber-100 p-6 shadow-lg">
            <div>
              <div className="font-bold text-slate-800">Tambah Akun Guru</div>
              <div className="mt-1 text-sm text-slate-700">
                ID akan dibuat otomatis secara acak.
              </div>
            </div>
            <button
              onClick={() => setShowTambah(true)}
              className="rounded-2xl bg-blue-700 px-6 py-3 font-bold text-white transition hover:bg-blue-800"
            >
              + Buat Akun
            </button>
          </div>
        </div>

        {/* LIST GURU */}
        <div className="mt-8">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-black text-slate-800">
              Daftar Guru Pembimbing (A-Z)
            </h2>
            <button
              onClick={loadGuru}
              disabled={loading}
              className="flex w-max items-center justify-center gap-2 rounded-xl bg-blue-100 px-4 py-2 text-sm font-bold text-blue-700 transition hover:bg-blue-200 disabled:opacity-50"
            >
              🔄 Refresh Data
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-white p-10 text-center shadow">
              <div className="animate-pulse font-medium text-slate-500">
                Memuat data dari database...
              </div>
            </div>
          ) : guruList.length === 0 ? (
            <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow">
              <div className="mb-4 text-5xl">📭</div>
              <p className="mb-4 text-slate-600">
                Belum ada akun guru atau data gagal dimuat.
              </p>
              <button
                onClick={loadGuru}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                🔄 Muat Ulang
              </button>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {guruList.map((guru) => (
                <div
                  key={guru.ID}
                  className="rounded-3xl border border-yellow-200 bg-gradient-to-br from-white via-amber-50 to-yellow-100/70 p-5 shadow-lg transition hover:shadow-xl hover:border-yellow-300"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-3xl text-white shadow">
                      👨‍🏫
                    </div>
                    <div className="flex-1">
                      <div className="line-clamp-1 text-lg font-black text-slate-800">
                        {guru.NAMA_GURU}
                      </div>
                      <div className="mt-2 text-xs text-slate-600">ID GURU</div>
                      <div className="font-mono text-xl font-black tracking-widest text-yellow-700">
                        {guru.ID}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setHapusId(guru.ID);
                      setKodeHapus("");
                      setShowHapus(true);
                    }}
                    className="mt-6 w-full rounded-2xl bg-red-50 py-3 font-bold text-red-600 transition hover:bg-red-100"
                  >
                    🗑 Hapus Akun
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MODAL TAMBAH GURU */}
        {showTambah && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-3xl">
                    ➕
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-800">
                      Buat Akun Guru
                    </h2>
                    <p className="text-sm text-slate-500">
                      ID dibuat otomatis oleh sistem
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <label className="text-sm font-bold text-slate-700">
                    Nama Guru Pembimbing
                  </label>
                  <input
                    type="text"
                    value={namaGuru}
                    onChange={(e) => setNamaGuru(e.target.value.toUpperCase())}
                    placeholder="Masukkan nama guru"
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg uppercase outline-none focus:border-blue-600"
                    disabled={saving}
                  />
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => {
                      setShowTambah(false);
                      setNamaGuru("");
                    }}
                    disabled={saving}
                    className="flex-1 rounded-2xl border py-3 font-bold text-slate-600 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={simpanGuru}
                    disabled={saving}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 py-3 font-bold text-slate-900 shadow-lg transition disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {saving ? "Menyimpan..." : "Simpan"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* MODAL HAPUS GURU (Diperbarui) */}
        {showHapus && (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
                <div className="text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-5xl">
                    🗑
                  </div>
                  <h2 className="mt-4 text-2xl font-black text-slate-800">
                    Hapus Akun
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Untuk menghapus akun guru, masukkan kode konfirmasi.
                  </p>
                </div>

                <div className="mt-6">
                  <label className="text-sm font-bold text-slate-700">
                    Kode Konfirmasi
                  </label>
                  <input
                    type="password"
                    value={kodeHapus}
                    onChange={(e) => setKodeHapus(e.target.value)}
                    placeholder="Masukkan kode"
                    className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-center text-xl tracking-widest outline-none focus:border-red-500"
                    disabled={deleting}
                  />
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    onClick={() => {
                      setShowHapus(false);
                      setKodeHapus("");
                      setHapusId("");
                    }}
                    disabled={deleting}
                    className="flex-1 rounded-2xl border py-3 font-bold text-slate-600 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      // Mengecek PIN Hapus di belakang layar
                      const isKodeBenar = await verifikasiPinHapus(kodeHapus);

                      if (!isKodeBenar) {
                        showToast("Kode salah.", "error");
                        return;
                      }

                      try {
                        setDeleting(true);

                        const res = await fetch(API_URL, {
                          method: "POST",
                          headers: {
                            "Content-Type": "text/plain;charset=utf-8",
                          },
                          redirect: "follow",
                          body: JSON.stringify({
                            action: "deleteAdminGuru",
                            params: {
                              id: hapusId,
                            },
                          }),
                        });

                        const json = await res.json();

                        if (!json.success) {
                          showToast(json.message, "error");
                          return;
                        }

                        showToast("Akun berhasil dihapus", "success");
                        setShowHapus(false);
                        setKodeHapus("");
                        setHapusId("");
                        loadGuru();
                      } catch (err) {
                        console.error("Error hapusGuru:", err);
                        showToast("Terjadi kesalahan sistem.", "error");
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                    className="flex-1 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 py-3 font-bold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {deleting ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
