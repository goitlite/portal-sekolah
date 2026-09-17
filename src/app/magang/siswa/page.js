"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { getSiswaByGuru, deleteSiswa } from "../lib/api";
import { getSession, isLoggedIn } from "../lib/auth";

// --- KOMPONEN BADGE NAMA ---
const NamaBadge = ({ rawName }) => {
  if (!rawName) return null;

  const match = rawName.match(/(.+?)\s*\[(.*?)\]/);

  if (!match) {
    return <span className="text-slate-800">{rawName}</span>;
  }

  const namaSiswa = match[1].trim();
  const kelas = match[2].trim();

  let badgeClasses = "bg-blue-50 border-blue-200 text-blue-700";
  if (kelas === "TJKT 1") {
    badgeClasses = "bg-emerald-50 border-emerald-200 text-emerald-700";
  } else if (kelas === "TJKT 2") {
    badgeClasses = "bg-violet-50 border-violet-200 text-violet-700";
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-slate-800 leading-tight">{namaSiswa}</span>{" "}
      <span
        className={`inline-flex items-center px-1.5 py-0.5 sm:px-2 border rounded text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-sm ${badgeClasses}`}
      >
        {kelas}
      </span>
    </span>
  );
};

export default function DaftarSiswa() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [siswa, setSiswa] = useState([]);

  // TAMBAHAN: State untuk navigasi tampilan tab
  const [activeTab, setActiveTab] = useState("card");

  useEffect(() => {
    async function loadData() {
      if (!isLoggedIn()) {
        router.replace("/magang/login");
        return;
      }

      const session = getSession();

      if (!session || session.role !== "guru") {
        router.replace("/magang/login");
        return;
      }

      setUser(session);

      try {
        const result = await getSiswaByGuru(session.id);

        if (result.success) {
          // Mengurutkan data siswa secara alfabetis
          const sortedSiswa = [...result.data].sort((a, b) =>
            a.NAMA.localeCompare(b.NAMA, "id", { sensitivity: "base" }),
          );
          setSiswa(sortedSiswa);
        } else {
          alert(result.message);
        }
      } catch (err) {
        console.error(err);
        alert("Gagal mengambil data siswa.");
      }

      setLoading(false);
    }

    loadData();
  }, [router]);

  async function handleDelete(id) {
    const yakin = confirm("Apakah Anda yakin ingin menghapus siswa ini?");

    if (!yakin) return;

    try {
      const result = await deleteSiswa(id);

      if (result.success) {
        alert("Siswa berhasil dihapus.");
        setSiswa((prev) => prev.filter((item) => item.ID !== id));
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus siswa.");
    }
  }

  // TAMBAHAN: Fungsi untuk share ke WA (Hanya Teks)
  const handleShareWA = (item) => {
    const pesan = `*Data Siswa Magang*\n\nNama: ${item.NAMA}\nTempat Magang: ${item.TEMPAT_MAGANG}\nNomor ID Presensi: ${item.ID}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, "_blank");
  };

  // TAMBAHAN: Kelompokkan siswa berdasarkan Tempat Magang
  const groupedSiswa = siswa.reduce((acc, curr) => {
    const tempat = curr.TEMPAT_MAGANG || "Belum Ditentukan";
    if (!acc[tempat]) {
      acc[tempat] = [];
    }
    acc[tempat].push(curr);
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200 flex flex-col">
      {/* HEADER FIXED (Solid & Mirip Rekap) */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white shadow-lg border-b border-blue-700/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="bg-white/10 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl backdrop-blur-sm border border-white/20">
              <Image
                src="/logo.png"
                alt="Logo"
                width={36}
                height={36}
                className="object-contain sm:w-[44px] sm:h-[44px]"
              />
            </div>
            <div>
              <h1 className="text-sm sm:text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200">
                DAFTAR SISWA
              </h1>
              <p className="text-[10px] sm:text-xs font-medium text-blue-300 tracking-wide mt-0.5">
                Guru: {user?.nama || "Memuat..."}
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/magang/guru")}
            className="rounded-lg sm:rounded-xl bg-white/10 px-4 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white hover:text-blue-900 border border-white/30 transition-all shadow-sm"
          >
            Kembali
          </button>
        </div>
      </header>

      {/* KONTEN UTAMA */}
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* HEADER KONTEN & TOMBOL TAMBAH */}
        <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] sm:text-xs font-bold uppercase tracking-wider mb-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              Sistem Bimbingan
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              Data Siswa Magang
            </h2>
            <p className="mt-1 text-slate-500 font-medium text-sm">
              Total terdaftar:{" "}
              <span className="font-bold text-slate-700">
                {siswa.length} Siswa
              </span>
            </p>
          </div>

          <button
            onClick={() => router.push("/magang/tambah")}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:scale-105 flex items-center justify-center gap-2 w-full md:w-auto"
          >
            <span className="text-lg leading-none">+</span>
            <span>Tambah Siswa</span>
          </button>
        </div>

        {/* TAMBAHAN: Navigasi Tab */}
        {!loading && siswa.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 pb-4">
            <button
              onClick={() => setActiveTab("card")}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all border ${
                activeTab === "card"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              📱 Tampilan Kartu
            </button>
            <button
              onClick={() => setActiveTab("table")}
              className={`px-4 py-2 rounded-lg font-bold text-xs sm:text-sm transition-all border ${
                activeTab === "table"
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              📑 Tampilan Tabel (Sesuai Tempat Magang)
            </button>
          </div>
        )}

        {/* LOADING & KONDISI KOSONG */}
        {loading ? (
          <div className="mt-20 flex flex-col items-center justify-center text-slate-500">
            <div className="relative h-12 w-12 sm:h-14 sm:w-14">
              <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin"></div>
            </div>
            <p className="mt-4 font-semibold text-sm">Memuat data siswa...</p>
          </div>
        ) : siswa.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-slate-200 p-10 sm:p-16 text-center shadow-sm">
            <div className="text-5xl mb-4">📭</div>
            <h2 className="text-xl font-black text-slate-700">
              Belum Ada Siswa
            </h2>
            <p className="mt-2 text-slate-500 text-sm">
              Guru ini belum memiliki siswa magang di dalam sistem.
            </p>
          </div>
        ) : activeTab === "card" ? (
          /* GRID KARTU SISWA */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {siswa.map((item) => {
              const isRPL = item.NAMA.includes("TJKT 1");
              const isTKJ = item.NAMA.includes("TJKT 2");
              const accentColor = isRPL
                ? "bg-emerald-500"
                : isTKJ
                  ? "bg-violet-500"
                  : "bg-blue-500";

              return (
                <div
                  key={item.ID}
                  className="group flex flex-col bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-300 relative overflow-hidden h-full"
                >
                  {/* Garis Warna Aksen di Atas Kartu */}
                  <div
                    className={`absolute top-0 left-0 w-full h-1 ${accentColor}`}
                  ></div>

                  <h2 className="text-base sm:text-lg font-bold text-slate-800 flex flex-wrap items-center gap-1.5 mb-3">
                    <NamaBadge rawName={item.NAMA} />
                  </h2>

                  {/* Konten Kartu yang Lebih Kompak */}
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        ID Siswa
                      </p>
                      <p className="font-bold text-slate-700 text-xs">
                        {item.ID}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                      <p className="text-[9px] sm:text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                        Tempat Magang
                      </p>
                      <p className="font-semibold text-slate-700 text-xs leading-snug line-clamp-2">
                        {item.TEMPAT_MAGANG}
                      </p>
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="mt-auto flex gap-2 pt-3 border-t border-slate-100">
                    {/* TAMBAHAN: Tombol Share WA untuk Tampilan Kartu */}
                    <button
                      onClick={() => handleShareWA(item)}
                      className="flex items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
                      title="Bagikan ke WhatsApp"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </button>

                    <button
                      onClick={() => router.push(`/magang/edit/${item.ID}`)}
                      className="flex-1 rounded-lg bg-amber-50 border border-amber-200 py-2 text-xs font-bold text-amber-600 hover:bg-amber-500 hover:text-white transition-colors"
                    >
                      ✏ Edit
                    </button>

                    <button
                      onClick={() => handleDelete(item.ID)}
                      className="flex-1 rounded-lg bg-rose-50 border border-rose-200 py-2 text-xs font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition-colors"
                    >
                      🗑 Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* TAMBAHAN: TABEL SISWA BERDASARKAN TEMPAT MAGANG */
          <div className="space-y-6">
            {Object.entries(groupedSiswa)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([tempat, list]) => (
                <div
                  key={tempat}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
                >
                  <div className="bg-blue-50 border-b border-blue-200 px-4 py-3 sm:px-6 sm:py-4 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                      📍 {tempat}
                    </h3>
                    <span className="text-[10px] sm:text-xs font-bold bg-blue-200 text-blue-800 px-2.5 py-1 rounded-full">
                      {list.length} Siswa
                    </span>
                  </div>

                  {/* PENYESUAIAN PADA OVERFLOW DAN LEBAR KOLOM (table-fixed) */}
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[700px] table-fixed text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-center w-[8%]">
                            No
                          </th>
                          <th className="px-4 py-3 font-semibold text-left w-[42%]">
                            Nama Siswa
                          </th>
                          <th className="px-4 py-3 font-semibold text-center w-[25%]">
                            ID Presensi
                          </th>
                          <th className="px-4 py-3 font-semibold text-center w-[25%]">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {list.map((item, idx) => (
                          <tr
                            key={item.ID}
                            className="hover:bg-slate-50 transition-colors"
                          >
                            <td className="px-4 py-3 text-center text-slate-500 font-medium">
                              {idx + 1}
                            </td>
                            <td className="px-4 py-3 text-left truncate">
                              <NamaBadge rawName={item.NAMA} />
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-600">
                              {item.ID}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  onClick={() => handleShareWA(item)}
                                  className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-colors"
                                  title="Bagikan ke WhatsApp"
                                >
                                  <svg
                                    className="w-4 h-4"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() =>
                                    router.push(`/magang/edit/${item.ID}`)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-500 hover:text-white text-xs font-bold transition-colors"
                                >
                                  ✏ Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(item.ID)}
                                  className="px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white text-xs font-bold transition-colors"
                                >
                                  🗑 Hapus
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}
