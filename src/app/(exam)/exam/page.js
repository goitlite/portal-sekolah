"use client";

import { getExamData, checkToken } from "@/services/examService";
import { cekPesan } from "@/services/authService";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ExamPage() {
  async function enterFullscreen() {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      // iPhone tidak support fullscreen normal
      if (isIOS) return;

      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.log("Fullscreen gagal");
    }
  }
  const router = useRouter();

  // =========================
  // STATE SISWA
  // =========================
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");
  const [pesan, setPesan] = useState("");

  // =========================
  // STATE DATA UJIAN
  // =========================
  const [examData, setExamData] = useState([]);

  const [jenjang, setJenjang] = useState("");
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");

  const [token, setToken] = useState("");

  const [examLink, setExamLink] = useState("");

  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenModal, setTokenModal] = useState(false);
  const [tokenMessage, setTokenMessage] = useState("");

  useEffect(() => {
    enterFullscreen();
  }, []);

  // =========================
  // LOAD SESSION
  // =========================
  useEffect(() => {
    const savedNama = localStorage.getItem("nama");
    const savedKelas = localStorage.getItem("kelas");
    const savedExamLink = localStorage.getItem("examLink");

    // =========================
    // VALIDASI KEYBOARD
    // =========================
    const keyboardSafe = sessionStorage.getItem("keyboardSafe");

    // PERBAIKAN: Hanya blokir jika sudah divalidasi dan terbukti TIDAK aman ("no")
    if (keyboardSafe === "no") {
      alert("Keyboard tidak valid.\nGunakan keyboard standar Android.");
      router.push("/"); // Diarahkan kembali ke login/awal, bukan /exam
      return;
    }

    // =========================
    // VALIDASI SESSION
    // =========================
    if (!savedNama || !savedKelas) {
      localStorage.clear();
      router.push("/");
      return;
    }

    setNama(savedNama);
    setKelas(savedKelas);
  }, [router]);

  // =========================
  // CEK PESAN ADMIN
  // =========================
  useEffect(() => {
    if (!nama || !kelas) return;

    const interval = setInterval(async () => {
      try {
        const result = await cekPesan(nama, kelas);

        if (result.status === "success") {
          const isiPesan = result.pesan || "";

          setPesan(isiPesan);

          // RESET UJIAN
          if (isiPesan.toUpperCase() === "UJIAN DI RESET") {
            alert("Ujian telah direset oleh admin");

            localStorage.removeItem("examLink");

            router.push("/exam");
          }
        }
      } catch (error) {
        console.log("Gagal cek pesan:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [nama, kelas, router]);

  // =========================
  // LOAD DATA UJIAN
  // =========================
  useEffect(() => {
    async function loadExam() {
      try {
        const data = await getExamData();

        console.log("DATA UJIAN:", data);

        // VALIDASI ARRAY
        if (Array.isArray(data)) {
          setExamData(data);
        } else {
          setExamData([]);
        }
      } catch (error) {
        console.log("Gagal load ujian:", error);

        setExamData([]);
      }
    }

    loadExam();
  }, []);

  // ======================================
  // LIST JENJANG
  // ======================================
  const jenjangList = ["X", "XI", "XII"];

  // ======================================
  // FILTER KELAS
  // ======================================
  const kelasList = [
    ...new Set(
      examData
        .filter(
          (item) =>
            item?.kls && item.kls.toString().toUpperCase().startsWith(jenjang),
        )
        .map((item) => item.kls),
    ),
  ];

  // ======================================
  // FILTER MAPEL
  // ======================================
  const mapelList = [
    ...new Set(
      examData
        .filter((item) => item?.kls === selectedKelas)
        .map((item) => item.mpl),
    ),
  ];

  // ======================================
  // CEK TOKEN
  // ======================================
  async function handleCheckToken(autoStart = false) {
    // VALIDASI
    if (!selectedKelas || !selectedMapel || !token) {
      setTokenMessage("Lengkapi data ujian");
      setTokenModal(true);

      setTimeout(() => {
        enterFullscreen();
      }, 300);

      return;
    }

    try {
      setLoadingToken(true);

      const result = await checkToken(selectedKelas, selectedMapel, token);

      setLoadingToken(false);

      // TOKEN BENAR
      if (result.status === "success") {
        setExamLink(result.link);

        // SIMPAN LINK
        localStorage.setItem("examLink", result.link);

        // AUTO START JIKA DARI ENTER
        if (autoStart) {
          try {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            // FULLSCREEN selain iPhone
            if (!isIOS) {
              await enterFullscreen();
            }
          } catch (err) {}

          router.push("/exam/start");

          return;
        }

        setTokenMessage("Token benar");
        setTokenModal(true);

        setTimeout(() => {
          enterFullscreen();
        }, 300);
      } else {
        setExamLink("");

        setTokenMessage(result.message || "Token salah");
        setTokenModal(true);

        setTimeout(() => {
          enterFullscreen();
        }, 300);
      }
    } catch (error) {
      setLoadingToken(false);

      setTokenMessage("Gagal terhubung ke server");
      setTokenModal(true);

      setTimeout(() => {
        enterFullscreen();
      }, 300);

      console.log(error);
    }
  }

  return (
    <>
      {tokenModal && (
        <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-blue-700 mb-4">
              INFORMASI
            </h2>

            <p className="text-gray-700 mb-6 whitespace-pre-line">
              {tokenMessage}
            </p>

            <button
              onClick={async () => {
                setTokenModal(false);

                setTimeout(async () => {
                  await enterFullscreen();
                }, 300);
              }}
              className="
    w-full
    py-3
    rounded-2xl
    bg-blue-600
    hover:bg-blue-700
    text-white
    font-bold
  "
            >
              OK
            </button>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white relative overflow-hidden">
        {/* BACKGROUND EFFECT */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-cyan-500/20 blur-3xl rounded-full"></div>

          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-blue-700/20 blur-3xl rounded-full"></div>
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 md:px-6 md:py-10">
          {/* HEADER */}
          <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 md:p-8 mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
              <div>
                <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                  Portal Asesmen
                </h1>

                <p className="text-slate-300 mt-3 text-sm md:text-base">
                  Sistem ujian digital sekolah modern
                </p>
              </div>

              <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 rounded-2xl shadow-lg">
                <p className="text-xs uppercase tracking-widest text-cyan-100">
                  Status
                </p>

                <p className="font-bold text-lg">Siap Ujian</p>
              </div>
            </div>
          </div>

          {/* PESERTA */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* KIRI */}
            <div className="lg:col-span-1 space-y-6">
              {/* DATA SISWA */}
              <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-2xl shadow-lg">
                    👨‍🎓
                  </div>

                  <div>
                    <h2 className="text-xl font-bold">Data Peserta</h2>

                    <p className="text-slate-300 text-sm">
                      Informasi siswa aktif
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-slate-400 text-sm">Nama</p>

                    <p className="font-bold text-lg break-words">{nama}</p>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-slate-400 text-sm">Kelas</p>

                    <p className="font-bold text-lg">{kelas}</p>
                  </div>
                </div>
              </div>

              {/* PESAN ADMIN */}
              {pesan && (
                <div className="bg-red-500/15 backdrop-blur-xl border border-red-400/30 rounded-3xl p-6 shadow-2xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-2xl bg-red-500 flex items-center justify-center shadow-lg">
                      ⚠️
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-red-200">
                        Pesan Admin
                      </h2>

                      <p className="text-red-100/80 text-sm">
                        Informasi terbaru
                      </p>
                    </div>
                  </div>

                  <p className="text-red-100 leading-relaxed">{pesan}</p>
                </div>
              )}
            </div>

            {/* KANAN */}
            <div className="lg:col-span-2">
              <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-6 md:p-8">
                <div className="mb-8">
                  <h2 className="text-2xl md:text-3xl font-black mb-2">
                    Pilih Ujian
                  </h2>

                  <p className="text-slate-300">
                    Pilih jenjang, kelas, mapel, lalu masukkan token ujian
                  </p>
                </div>

                <div className="grid gap-5">
                  {/* JENJANG */}
                  <div>
                    <label className="block mb-2 text-sm text-slate-300 font-semibold">
                      Jenjang
                    </label>

                    <select
                      value={jenjang}
                      onChange={(e) => {
                        setJenjang(e.target.value);

                        setSelectedKelas("");
                        setSelectedMapel("");
                        setToken("");
                        setExamLink("");
                      }}
                      className="w-full bg-slate-900/70 border border-white/10 rounded-2xl p-4 outline-none focus:border-cyan-400 transition text-white"
                    >
                      <option value="">Pilih Jenjang</option>

                      {jenjangList.map((j) => (
                        <option key={j}>{j}</option>
                      ))}
                    </select>
                  </div>

                  {/* KELAS */}
                  <div>
                    <label className="block mb-2 text-sm text-slate-300 font-semibold">
                      Kelas
                    </label>

                    <select
                      value={selectedKelas}
                      onChange={(e) => {
                        setSelectedKelas(e.target.value);

                        setSelectedMapel("");
                        setToken("");
                        setExamLink("");
                      }}
                      className="w-full bg-slate-900/70 border border-white/10 rounded-2xl p-4 outline-none focus:border-cyan-400 transition text-white"
                    >
                      <option value="">Pilih Kelas</option>

                      {kelasList.map((kls) => (
                        <option key={kls}>{kls}</option>
                      ))}
                    </select>
                  </div>

                  {/* MAPEL */}
                  <div>
                    <label className="block mb-2 text-sm text-slate-300 font-semibold">
                      Mata Pelajaran
                    </label>

                    <select
                      value={selectedMapel}
                      onChange={(e) => {
                        setSelectedMapel(e.target.value);

                        setToken("");
                        setExamLink("");
                      }}
                      className="w-full bg-slate-900/70 border border-white/10 rounded-2xl p-4 outline-none focus:border-cyan-400 transition text-white"
                    >
                      <option value="">Pilih Mapel</option>

                      {mapelList.map((mpl) => (
                        <option key={mpl}>{mpl}</option>
                      ))}
                    </select>
                  </div>

                  {/* TOKEN */}
                  <div>
                    <label className="block mb-2 text-sm text-slate-300 font-semibold">
                      Token Ujian
                    </label>

                    <input
                      type="text"
                      placeholder="Masukkan Token Ujian"
                      value={token}
                      onChange={(e) => setToken(e.target.value.toUpperCase())}
                      onKeyDown={async (e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();

                        if (loadingToken) return;

                        // =========================
                        // DETEKSI FLOATING KEYBOARD
                        // =========================
                        const isDesktop =
                          window.innerWidth > 900 &&
                          !/Android|iPhone|iPad|iPod/i.test(
                            navigator.userAgent,
                          );
                        let keyboardSafe = true;

                        if (!isDesktop && window.visualViewport) {
                          // 1. HAPUS setTimeout. Kita harus mengukur dimensi secara instan
                          // tepat saat tombol Enter dtekan, sewaktu keyboard masih terbuka penuh.
                          const viewport = window.visualViewport;
                          const diff = window.innerHeight - viewport.height;
                          const widthShrink =
                            viewport.width < window.innerWidth * 0.9;

                          console.log("KEYBOARD DIFF:", diff);

                          // =========================
                          // PERBAIKAN LOGIKA:
                          // Keyboard normal selalu memakan ruang layar besar (diff > 180).
                          // Jika ruang yang terpotong kurang dari 180 (misal 0 atau 100),
                          // itu PASTI floating keyboard atau keyboard fisik.
                          // =========================
                          const floatingLike = diff < 180 || widthShrink;

                          if (floatingLike) {
                            keyboardSafe = false;
                          }
                        }

                        // simpan status
                        sessionStorage.setItem(
                          "keyboardSafe",
                          keyboardSafe ? "yes" : "no",
                        );

                        // =========================
                        // BLOCK FLOATING
                        // =========================
                        if (!keyboardSafe) {
                          setTokenMessage(
                            "❌ Keyboard mengambang tidak diperbolehkan.\n\nGunakan keyboard standar Android.",
                          );
                          setTokenModal(true);
                          return;
                        }

                        // =========================
                        // LANJUT UJIAN
                        // =========================
                        handleCheckToken(true);
                      }}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      className="w-full bg-slate-900/70 border border-white/10 rounded-2xl p-4 outline-none focus:border-cyan-400 transition text-white placeholder:text-slate-500"
                    />
                  </div>

                  {/* BUTTON */}
                  <div className="grid sm:grid-cols-2 gap-4 pt-2"></div>

                  {/* INFO */}
                  <div className="bg-cyan-500/10 border border-cyan-400/20 rounded-2xl p-4 mt-2">
                    <p className="text-cyan-100 text-sm leading-relaxed">
                      Tekan <span className="font-bold">ENTER</span> setelah
                      memasukkan token untuk langsung masuk ujian otomatis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
