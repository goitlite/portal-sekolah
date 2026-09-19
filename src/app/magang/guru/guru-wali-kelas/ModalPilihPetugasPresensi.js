"use client";

import { useState, useEffect } from "react";
import { getPresensiWaliGrid, editWaliKelas } from "../../lib/api";
import {
  parseKeteranganWali,
  buildKeteranganWali,
  getPetugasFromWali,
  cachePetugasLocal,
} from "../../lib/petugasPresensiHelper";

export default function ModalPilihPetugasPresensi({
  isOpen,
  onClose,
  guru,
  wali,
  onPetugasUpdated,
}) {
  const [siswaList, setSiswaList] = useState([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [selectedIdSiswa, setSelectedIdSiswa] = useState("");
  const [saving, setSaving] = useState(false);
  const [petugasSekarang, setPetugasSekarang] = useState(null);

  useEffect(() => {
    if (isOpen && wali?.idWali && guru?.id) {
      const current = getPetugasFromWali(wali);
      setPetugasSekarang(current);
      setSelectedIdSiswa(current?.idSiswa || "");
      loadSiswaKelas();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, wali?.idWali, guru?.id]);

  async function loadSiswaKelas() {
    try {
      setLoadingSiswa(true);
      const result = await getPresensiWaliGrid(guru.id, wali.idWali);
      const rawSiswa = (result.success && result.data?.siswa) || [];
      const normalized = rawSiswa
        .map((s) => ({
          idSiswa: String(s.idSiswa || s.id || ""),
          nama: s.nama || s.namaSiswa || "",
          kelas: s.kelas || "",
        }))
        .sort((a, b) => a.nama.localeCompare(b.nama));
      setSiswaList(normalized);
    } catch (err) {
      console.error("Gagal mengambil siswa kelas:", err);
    } finally {
      setLoadingSiswa(false);
    }
  }

  async function handleSimpanPetugas() {
    if (!guru?.id || !wali?.idWali) return;

    setSaving(true);
    try {
      const { cleanText } = parseKeteranganWali(wali.keterangan || "");
      let targetNama = "";

      if (selectedIdSiswa) {
        const found = siswaList.find((s) => s.idSiswa === selectedIdSiswa);
        targetNama = found?.nama || "";
      }

      const newKeterangan = buildKeteranganWali(
        cleanText,
        selectedIdSiswa,
        targetNama,
      );

      const res = await editWaliKelas({
        idGuru: guru.id,
        idWali: wali.idWali,
        namaKelas: wali.namaKelas,
        keterangan: newKeterangan,
      });

      if (res.success) {
        const petugasData = selectedIdSiswa
          ? {
              idSiswa: selectedIdSiswa,
              namaSiswa: targetNama,
              idWali: wali.idWali,
              idGuru: guru.id,
              namaKelas: wali.namaKelas,
              kelas: wali.kelas,
            }
          : null;

        cachePetugasLocal(wali.idWali, petugasData);

        alert(
          selectedIdSiswa
            ? `✅ "${targetNama}" berhasil ditunjuk sebagai Petugas Presensi kelas ${wali.namaKelas}.`
            : `✅ Penunjukan petugas presensi untuk kelas ${wali.namaKelas} telah dicabut.`,
        );

        if (typeof onPetugasUpdated === "function") {
          onPetugasUpdated({
            ...wali,
            keterangan: newKeterangan,
            petugas: petugasData,
          });
        }

        onClose();
      } else {
        alert(res.message || "Gagal menyimpan petugas presensi.");
      }
    } catch (err) {
      console.error("Gagal simpan petugas:", err);
      alert("Terjadi kesalahan saat menyimpan petugas presensi.");
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen || !wali) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
        {/* Header Modal */}
        <div className="shrink-0 bg-gradient-to-r from-teal-800 via-teal-700 to-emerald-800 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">⭐</span>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight">
                  Pilih Petugas Presensi
                </h3>
                <p className="text-[11px] text-teal-100 font-medium">
                  Kelas: {wali.namaKelas}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/20 hover:bg-white/35 w-8 h-8 flex items-center justify-center text-xs font-black transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Konten Pemilihan Petugas */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50">
          {/* Status Petugas Saat Ini */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/70 p-3.5">
            <p className="text-[10px] font-black uppercase tracking-wider text-teal-800 mb-1">
              Petugas Saat Ini:
            </p>
            {petugasSekarang?.namaSiswa ? (
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                <div>
                  <p className="text-xs sm:text-sm font-black text-slate-800">
                    {petugasSekarang.namaSiswa}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold">
                    ID: {petugasSekarang.idSiswa}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold text-slate-500 italic">
                Belum ada siswa yang ditunjuk sebagai petugas.
              </p>
            )}
          </div>

          {/* Form Pilihan Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-700">
              Pilih Siswa dari Kelas Ini:
            </label>

            {loadingSiswa ? (
              <div className="rounded-xl border border-slate-300 bg-white p-3 text-center text-xs font-bold text-slate-400">
                Memuat daftar siswa kelas...
              </div>
            ) : (
              <select
                value={selectedIdSiswa}
                onChange={(e) => setSelectedIdSiswa(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 transition-all cursor-pointer shadow-sm"
              >
                <option value="" className="text-slate-500 font-bold">
                  -- Pilih Siswa Sebagai Petugas Presensi --
                </option>
                {siswaList.map((s) => (
                  <option
                    key={s.idSiswa}
                    value={s.idSiswa}
                    className="text-slate-800 font-medium"
                  >
                    {s.nama} {s.kelas ? `[${s.kelas}]` : ""} (ID: {s.idSiswa})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Info Ketentuan */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5 text-amber-900 text-[11px] leading-relaxed">
            <p className="font-black flex items-center gap-1">
              <span>💡</span> Ketentuan Petugas Presensi:
            </p>
            <ul className="list-disc pl-4 space-y-1 font-medium text-amber-800/90">
              <li>
                Siswa yang ditunjuk akan dapat mengisi presensi seluruh teman
                sekelasnya langsung dari <b>Dashboard Siswa</b> miliknya.
              </li>
              <li>
                Hanya dapat mengisi presensi <b>1 kali sehari</b> (terkunci pada
                hari ini).
              </li>
              <li>
                Status awal otomatis diset <b>Hadir semua</b>, siswa cukup
                mengubah yang Sakit, Izin, Alfa, atau Cabut.
              </li>
              <li>
                Siswa petugas <b>tidak bisa mengubah</b> data presensi yang
                sudah dikirim. Perubahan hanya bisa dilakukan oleh Bapak/Ibu
                Guru Wali Kelas.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3.5 flex items-center justify-between gap-3">
          {selectedIdSiswa ? (
            <button
              type="button"
              onClick={() => setSelectedIdSiswa("")}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 transition-colors"
            >
              Cabut Tugas
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 px-4 py-2.5 text-xs font-bold transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSimpanPetugas}
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:brightness-110 active:scale-95 text-white px-5 py-2.5 text-xs font-black shadow-md transition-all disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Simpan Petugas</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
