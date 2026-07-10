"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { login } from "../lib/api";
import { saveSession } from "../lib/auth";

export default function LoginMagang() {
  const router = useRouter();

  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();

    if (!id.trim()) {
      alert("Masukkan ID.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(id);

      console.log("HASIL LOGIN :", result);
      console.log("DATA LOGIN :", result.data);

      if (!result.success) {
        alert(result.message);
        return;
      }

      if (!result.data) {
        alert("Data login tidak diterima dari server.");
        return;
      }

      // Simpan hanya data user
      saveSession(result.data);

      // Redirect sesuai role
      switch (result.data.role) {
        case "admin":
          router.replace("/magang/admin");
          return;

        case "guru":
          router.replace("/magang/guru");
          return;

        case "siswa":
          router.replace("/magang/siswa");
          return;

        default:
          alert("Role tidak dikenali : " + result.data.role);
          return;
      }
    } catch (err) {
      console.error(err);
      alert("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-[32px] bg-white shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-b from-amber-400 via-amber-500 to-amber-600 p-8 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-2xl bg-white">
            <Image src="/logo.png" width={70} height={70} alt="Logo" priority />
          </div>

          <h1
            className="text-xl font-black text-white"
            style={{
              WebkitTextStroke: "1px #020617",
            }}
          >
            LOGIN PRESENSI MAGANG
          </h1>

          <p className="mt-2 text-xs font-semibold text-blue-950 uppercase">
            SMKN 1 TELUK KUANTAN
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-6 p-8">
          <div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">
              ID Pengguna
            </label>

            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={id}
              onChange={(e) => setId(e.target.value.replace(/\D/g, ""))}
              placeholder="Masukkan ID"
              className="w-full rounded-xl border border-slate-300 px-4 py-4 text-center text-2xl font-bold tracking-[6px] outline-none transition focus:border-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 py-4 font-black uppercase text-slate-900 transition hover:brightness-110 disabled:opacity-50"
          >
            {loading ? "MEMPROSES..." : "MASUK KE SISTEM"}
          </button>
        </form>

        <div className="border-t bg-slate-50 p-4 text-center">
          <p className="text-xs text-slate-500">
            Login menggunakan ID yang diberikan Admin atau Guru Pembimbing.
          </p>
        </div>
      </div>
    </main>
  );
}
