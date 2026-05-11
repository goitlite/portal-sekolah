"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { registerStudent } from "@/services/authService";

export default function LoginPage() {
  const router = useRouter();

  // =========================
  // STATE FORM
  // =========================
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");

  const [waSiswa, setWaSiswa] = useState("");
  const [waOrtu, setWaOrtu] = useState("");

  const [loading, setLoading] = useState(false);

  // =========================
  // HANDLE LOGIN
  // =========================
  const handleLogin = async (e) => {
    e.preventDefault();

    // VALIDASI
    if (!nama || !kelas || !waSiswa || !waOrtu) {
      alert("Lengkapi semua data");
      return;
    }

    setLoading(true);

    // KIRIM KE APPS SCRIPT
    const result = await registerStudent({
      nama,
      kelas,
      wa_siswa: waSiswa,
      wa_ortu: waOrtu,
    });

    setLoading(false);

    // BERHASIL
    if (result.status === "success" || result.status === "EXIST") {
      // SIMPAN SESSION
      localStorage.setItem("nama", nama);
      localStorage.setItem("kelas", kelas);

      // PINDAH KE HALAMAN EXAM
      router.push("/exam");
    } else {
      alert(result.message || "Gagal login");
    }
  };

  return (
    <main className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center p-5">
      {/* BACKGROUND EFFECT */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>

        <div className="absolute top-1/2 right-0 w-[450px] h-[450px] bg-cyan-500/10 rounded-full blur-3xl"></div>

        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"></div>
      </div>

      {/* CARD LOGIN */}
      <div className="relative z-10 w-full max-w-md">
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 backdrop-blur-md rounded-full px-5 py-2 mb-5">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>

            <span className="text-white text-sm tracking-wide font-medium">
              Portal Asesmen Digital
            </span>
          </div>

          <h1 className="text-4xl font-black text-white leading-tight">
            LOGIN
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              {" "}
              ASESMEN
            </span>
          </h1>

          <p className="text-gray-300 mt-4 text-sm md:text-base">
            Silahkan login untuk melanjutkan ke sistem ujian online
          </p>
        </div>

        {/* FORM */}
        <div className="bg-white/10 border border-white/10 backdrop-blur-2xl rounded-3xl shadow-2xl p-6 md:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* NAMA */}
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">
                Nama Siswa
              </label>

              <input
                type="text"
                placeholder="Masukkan nama lengkap"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                className="
                  w-full
                  bg-white/10
                  border
                  border-white/20
                  text-white
                  placeholder:text-gray-400
                  p-4
                  rounded-2xl
                  outline-none
                  focus:ring-2
                  focus:ring-cyan-400
                  focus:border-cyan-400
                  transition
                "
              />
            </div>

            {/* KELAS */}
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">
                Pilih Kelas
              </label>

              <select
                value={kelas}
                onChange={(e) => setKelas(e.target.value)}
                className="
                  w-full
                  bg-white/10
                  border
                  border-white/20
                  text-white
                  p-4
                  rounded-2xl
                  outline-none
                  focus:ring-2
                  focus:ring-cyan-400
                  focus:border-cyan-400
                  transition
                "
              >
                <option value="" className="text-black">
                  Pilih Kelas
                </option>

                <option className="text-black">X TJKT 1</option>
                <option className="text-black">X TJKT 2</option>

                <option className="text-black">XI TJKT 1</option>
                <option className="text-black">XI TJKT 2</option>

                <option className="text-black">XII TJKT 1</option>
                <option className="text-black">XII TJKT 2</option>

                <option className="text-black">X TPL</option>
                <option className="text-black">XI TPL</option>
                <option className="text-black">XII TPL</option>
              </select>
            </div>

            {/* WA SISWA */}
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">
                WhatsApp Siswa
              </label>

              <input
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={waSiswa}
                onChange={(e) => setWaSiswa(e.target.value)}
                className="
                  w-full
                  bg-white/10
                  border
                  border-white/20
                  text-white
                  placeholder:text-gray-400
                  p-4
                  rounded-2xl
                  outline-none
                  focus:ring-2
                  focus:ring-cyan-400
                  focus:border-cyan-400
                  transition
                "
              />
            </div>

            {/* WA ORTU */}
            <div>
              <label className="text-white text-sm font-semibold mb-2 block">
                WhatsApp Orang Tua
              </label>

              <input
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={waOrtu}
                onChange={(e) => setWaOrtu(e.target.value)}
                className="
                  w-full
                  bg-white/10
                  border
                  border-white/20
                  text-white
                  placeholder:text-gray-400
                  p-4
                  rounded-2xl
                  outline-none
                  focus:ring-2
                  focus:ring-cyan-400
                  focus:border-cyan-400
                  transition
                "
              />
            </div>

            {/* BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="
                w-full
                relative
                overflow-hidden
                bg-gradient-to-r
                from-blue-600
                to-cyan-500
                hover:from-blue-500
                hover:to-cyan-400
                text-white
                p-4
                rounded-2xl
                font-bold
                text-lg
                shadow-2xl
                transition-all
                duration-300
                hover:scale-[1.02]
                hover:shadow-cyan-500/30
                disabled:opacity-70
                disabled:cursor-not-allowed
              "
            >
              {loading ? "Memproses..." : "🚀 Masuk Sekarang"}
            </button>
          </form>

          {/* FOOTER */}
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">
              Sistem asesmen online modern • Aman • Responsif
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
