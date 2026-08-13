"use client";

import { useEffect, useState } from "react";
import { getSession } from "../../lib/auth";
import { getDataSiswaWali } from "../../lib/api";

export default function GuruWaliPage() {
  const [dataSiswa, setDataSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedSiswa, setSelectedSiswa] = useState(null);

  useEffect(() => {
    loadDataSiswaWali();
  }, []);

  async function loadDataSiswaWali() {
    try {
      setLoading(true);
      setError("");

      const session = getSession();

      if (!session || session.role !== "guru") {
        setError("Sesi guru tidak ditemukan.");
        return;
      }

      const idGuru = session.id;

      if (!idGuru) {
        setError("ID guru tidak ditemukan.");
        return;
      }

      const result = await getDataSiswaWali(idGuru);

      if (!result.success) {
        setError(result.message || "Gagal mengambil data.");
        return;
      }

      setDataSiswa(result.data || []);
    } catch (err) {
      console.error("ERROR GURU WALI:", err);
      setError("Terjadi kesalahan saat mengambil data.");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 h-8 w-8 sm:h-10 sm:w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />
            <p className="text-sm sm:text-base font-bold text-slate-700">
              Memuat data siswa wali...
            </p>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Mohon tunggu sebentar.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl sm:rounded-3xl border border-red-200 bg-red-50 p-5 sm:p-6 text-red-700 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xl sm:text-2xl">⚠️</span>
              <h2 className="text-base sm:text-lg font-black">
                Gagal Memuat Data
              </h2>
            </div>
            <p className="text-xs sm:text-sm font-medium">{error}</p>
            <button
              onClick={loadDataSiswaWali}
              className="mt-4 sm:mt-5 rounded-xl bg-red-600 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-black text-white transition hover:bg-red-700 active:scale-95"
            >
              🔄 Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-3 sm:p-6">
      <div className="mx-auto max-w-6xl">
        {/* ======================================
            HEADER
        ====================================== */}
        <div className="mb-5 sm:mb-6 overflow-hidden rounded-2xl sm:rounded-[2rem] bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 p-5 sm:p-8 text-white shadow-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1.5 sm:mb-2 flex items-center gap-2">
                <span className="text-2xl sm:text-3xl">👨‍🏫</span>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                  Guru Wali
                </span>
              </div>
              <h1 className="text-xl font-black sm:text-3xl">
                Data Siswa Wali
              </h1>
              <p className="mt-1.5 sm:mt-2 max-w-2xl text-xs sm:text-sm font-medium text-blue-100 sm:text-base">
                Daftar siswa yang menjadi tanggung jawab guru wali. Pilih siswa
                untuk melihat profil lengkap.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
              {/* JUMLAH SISWA */}
              <div className="flex items-center justify-center rounded-xl sm:rounded-2xl bg-white/15 px-4 py-3 sm:px-5 sm:py-4 backdrop-blur-sm border border-white/10">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl font-black">
                    {dataSiswa.length}
                  </div>
                  <div className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-100">
                    Siswa Wali
                  </div>
                </div>
              </div>

              {/* TOMBOL TAMBAH SISWA */}
              <button
                onClick={() => {
                  window.location.href = "/magang/guru/guru-wali/tambah";
                }}
                className="
      group relative overflow-hidden
      flex items-center justify-center gap-2
      rounded-xl sm:rounded-2xl
      bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500
      px-4 py-3 sm:px-5 sm:py-4
      text-xs sm:text-sm
      font-black text-white
      shadow-lg shadow-orange-900/20
      border border-white/20
      transition-all duration-300
      hover:-translate-y-1
      hover:shadow-xl hover:shadow-orange-900/30
      hover:brightness-110
      active:scale-95
    "
              >
                {/* efek cahaya */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />

                <span className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-lg">
                  ➕
                </span>

                <span className="relative flex flex-col items-start leading-tight">
                  <span className="text-[11px] sm:text-xs">TAMBAH SISWA</span>
                  <span className="text-[9px] sm:text-[10px] font-medium text-white/80">
                    Registrasi siswa baru
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ======================================
            BELUM ADA DATA
        ====================================== */}
        {dataSiswa.length === 0 ? (
          <div className="rounded-2xl sm:rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 sm:p-10 text-center shadow-sm">
            <div className="mb-3 sm:mb-4 text-4xl sm:text-5xl">👨‍🎓</div>
            <h2 className="text-lg sm:text-xl font-black text-slate-700">
              Belum Ada Siswa Wali
            </h2>
            <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500">
              Belum terdapat siswa yang terhubung dengan guru wali ini.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dataSiswa.map((siswa, index) => (
              <div
                key={siswa.idSiswa || index}
                className="group overflow-hidden rounded-xl sm:rounded-[1.5rem] border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 sm:p-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg sm:rounded-xl bg-white/15 text-xl sm:text-2xl">
                      👨‍🎓
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-sm sm:text-base font-black">
                        {siswa.nama || "-"}
                      </h2>
                      <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-bold text-slate-300">
                        ID: {siswa.idSiswa || "-"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5">
                  <div className="space-y-2.5 sm:space-y-3">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Guru Pembimbing
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-700">
                        👨‍🏫 {siswa.namaGuru || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Tempat Magang
                      </p>
                      <p className="mt-0.5 text-xs sm:text-sm font-bold text-slate-700">
                        📍 {siswa.tempatMagang || "-"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedSiswa(siswa)}
                    className="mt-4 sm:mt-5 flex w-full items-center justify-center gap-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2.5 sm:px-4 sm:py-3 text-xs sm:text-sm font-black text-white shadow-md shadow-blue-500/20 transition-all hover:brightness-110 active:scale-[0.97]"
                  >
                    👁️ LIHAT PROFIL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ==================================================
          POPUP / MODAL DETAIL SISWA (Diperbaiki Lebar & Tombol Closenya)
      ================================================== */}
      {selectedSiswa && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedSiswa(null);
            }
          }}
        >
          {/* max-w-2xl mengubah popup menjadi lebih ramping/compact di laptop */}
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* ==========================================
                HEADER POPUP
            ========================================== */}
            <div className="shrink-0 bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 p-4 sm:p-5 text-white">
              <div className="flex w-full items-start justify-between gap-3">
                {/* flex-1 dan min-w-0 agar teks tidak mendorong tombol close ke luar layar */}
                <div className="flex flex-1 min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-lg bg-white/20 text-xl sm:text-2xl backdrop-blur-sm">
                    👨‍🎓
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base sm:text-lg font-black">
                      {selectedSiswa.nama || "-"}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-1.5 sm:gap-2">
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold">
                        ID: {selectedSiswa.idSiswa || "-"}
                      </span>
                      <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] sm:text-[11px] font-bold">
                        📍 {selectedSiswa.tempatMagang || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* TOMBOL CLOSE: Lebih kontras dengan bg-black/25 dan ditaruh melayang tegas */}
                <button
                  onClick={() => setSelectedSiswa(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/25 text-sm font-black text-white transition-all hover:bg-black/40 hover:scale-105 active:scale-95"
                  aria-label="Tutup"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* ==========================================
                ISI POPUP
            ========================================== */}
            <div className="overflow-y-auto p-4 sm:p-5">
              <div className="space-y-4 sm:space-y-5">
                <Section icon="🏫" title="Data Sekolah & Magang">
                  <Info label="ID Siswa" value={selectedSiswa.idSiswa} />
                  <Info label="Nama Siswa" value={selectedSiswa.nama} />
                  <Info
                    label="Guru Pembimbing"
                    value={selectedSiswa.namaGuru}
                  />
                  <Info
                    label="Tempat Magang"
                    value={selectedSiswa.tempatMagang}
                  />
                </Section>

                <Section icon="👤" title="Data Pribadi">
                  <Info
                    label="Tempat Lahir"
                    value={selectedSiswa.tempatLahir}
                  />
                  <Info label="Tanggal Lahir" value={selectedSiswa.tglLahir} />
                  <Info label="Anak Ke" value={selectedSiswa.anakKe} />
                  <Info label="Alamat" value={selectedSiswa.alamat} full />
                  <Info
                    label="Transportasi"
                    value={selectedSiswa.transportasi}
                  />
                </Section>

                <Section icon="👨" title="Data Ayah">
                  <Info label="Nama Ayah" value={selectedSiswa.ayah} />
                  <Info
                    label="Pekerjaan Ayah"
                    value={selectedSiswa.pekerjaanAyah}
                  />
                  <Info label="Kontak Ayah" value={selectedSiswa.kontakAyah} />
                </Section>

                <Section icon="👩" title="Data Ibu">
                  <Info label="Nama Ibu" value={selectedSiswa.ibu} />
                  <Info
                    label="Pekerjaan Ibu"
                    value={selectedSiswa.pekerjaanIbu}
                  />
                  <Info label="Kontak Ibu" value={selectedSiswa.kontakIbu} />
                </Section>

                <Section icon="⭐" title="Profil, Hobi & Bakat">
                  <Info label="Hobi" value={selectedSiswa.hobi} />
                  <Info label="Cita-cita" value={selectedSiswa.citaCita} />
                  <Info
                    label="Bakat / Keahlian"
                    value={selectedSiswa.bakatKeahlian}
                  />
                </Section>

                <Section icon="📚" title="Minat & Pelajaran">
                  <Info
                    label="Pelajaran Disukai"
                    value={selectedSiswa.pelajaranDisukai}
                  />
                  <Info
                    label="Alasan Menyukai"
                    value={selectedSiswa.alasanDisukai}
                    full
                  />
                  <Info
                    label="Pelajaran Tidak Disukai"
                    value={selectedSiswa.pelajaranTidakDisukai}
                  />
                  <Info
                    label="Alasan Tidak Menyukai"
                    value={selectedSiswa.alasanTidakDisukai}
                    full
                  />
                </Section>

                <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-lg">🎯</span>
                    <h3 className="text-sm sm:text-base font-black text-amber-900">
                      Harapan Siswa di SMKN 1
                    </h3>
                  </div>
                  <p className="rounded-lg bg-white/70 p-3 sm:p-4 text-xs sm:text-sm font-semibold leading-relaxed text-slate-700">
                    {selectedSiswa.harapan || "-"}
                  </p>
                </div>
              </div>
            </div>

            {/* ==========================================
                FOOTER POPUP
            ========================================== */}
            <div className="shrink-0 border-t border-slate-200 bg-slate-50 p-3 sm:p-4">
              <button
                onClick={() => setSelectedSiswa(null)}
                className="w-full rounded-lg bg-slate-800 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white transition hover:bg-slate-700 active:scale-[0.98]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   COMPONENT SECTION
========================================================== */
function Section({ icon, title, children }) {
  return (
    <section>
      <div className="mb-2.5 sm:mb-3 flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm sm:text-base font-black text-slate-800">
          {title}
        </h3>
      </div>
      {/* Grid diset ke max 2 kolom (sm:grid-cols-2) karena lebar popup sudah kita kecilkan */}
      <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

/* ==========================================================
   COMPONENT INFO
========================================================== */
function Info({ label, value, full = false }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-slate-50/50 p-3 sm:p-3.5 ${
        full ? "sm:col-span-2" : ""
      }`}
    >
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="break-words text-xs sm:text-sm font-bold leading-relaxed text-slate-700">
        {value || "-"}
      </p>
    </div>
  );
}
