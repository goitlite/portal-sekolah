"use client";

import { getExamData, checkToken } from "@/services/examService";
import { cekPesan, registerStudent, kunciSesiUjian } from "@/services/authService";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// HANYA UNTUK PENGUJIAN SEMENTARA. Nilai ini terlihat di bundle browser.
const PWA_TEST_BYPASS_PIN = "293031";

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

  const [pwaGateMode, setPwaGateMode] = useState("checking");
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [pwaPin, setPwaPin] = useState("");
  const [pwaGateMessage, setPwaGateMessage] = useState("");
  const [installStepsVisible, setInstallStepsVisible] = useState(false);

  useEffect(() => {
    function syncInstallPrompt() {
      const promptEvent = window.__portalDeferredInstallPrompt || null;
      if (promptEvent) setInstallPromptEvent(promptEvent);
    }
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      window.__portalDeferredInstallPrompt = event;
      setInstallPromptEvent(event);
    }

    syncInstallPrompt();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const classifyTimer = setTimeout(() => {
      const ua = navigator.userAgent;
      const isAndroid = /Android/i.test(ua);
      const isIOS =
        /iPad|iPhone|iPod/i.test(ua) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const pwaSessionGatePassed =
        sessionStorage.getItem("examPwaAccess") === "standalone";

      // Jangan minta deteksi ulang saat route kembali ke /exam dalam sesi PWA yang sudah lolos.
      // Otorisasi PIN perangkat juga disimpan tanpa menyimpan PIN mentah.
      if (
        isAndroid &&
        (pwaSessionGatePassed ||
          localStorage.getItem("examPwaPinAuthorized") === "true")
      ) {
        setPwaGateMode("allowed");
        return;
      }

      if (!isAndroid || isIOS) {
        setPwaGateMode("allowed");
        return;
      }

      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true;
      setPwaGateMode(standalone ? "standalone-check" : "browser");
    }, 0);

    return () => {
      clearTimeout(classifyTimer);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  async function installPwaFromExamGate() {
    if (!installPromptEvent) {
      setInstallStepsVisible(true);
      return;
    }
    try {
      const promptEvent = installPromptEvent;
      window.__portalDeferredInstallPrompt = null;
      setInstallPromptEvent(null);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setPwaGateMessage(
        choice.outcome === "accepted"
          ? "Pemasangan dimulai. Setelah selesai, buka Portal Sekolah dari ikon layar utama."
          : "Pemasangan belum dipilih. Ikuti panduan manual atau masukkan PIN uji.",
      );
      if (choice.outcome !== "accepted") setInstallStepsVisible(true);
    } catch (_) {
      setPwaGateMessage(
        "Dialog instal tidak tersedia. Ikuti panduan manual atau masukkan PIN uji.",
      );
      setInstallStepsVisible(true);
    }
  }

  function continueFromPwaGate() {
    if (pwaGateMode === "standalone-check") {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true;
      if (!standalone) {
        setPwaGateMessage(
          "PWA standalone belum terdeteksi. Buka aplikasi dari ikon layar utama.",
        );
        return;
      }
      sessionStorage.setItem("examPwaAccess", "standalone");
      setPwaGateMode("allowed");
      return;
    }

    if (pwaPin.trim() !== PWA_TEST_BYPASS_PIN) {
      setPwaGateMessage("PIN pengecualian tidak sesuai.");
      return;
    }
    sessionStorage.setItem("examPwaAccess", "testing-pin");
    localStorage.setItem("examPwaPinAuthorized", "true");
    setPwaGateMode("allowed");
  }

  // =========================
  // STATE SISWA
  // =========================
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");
  const [idSiswa, setIdSiswa] = useState("");
  const [pesan, setPesan] = useState("");

  // =========================
  // STATE DATA UJIAN
  // =========================
  const [examData, setExamData] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("cached_exam_data");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (_) {}
    }
    return [];
  });

  const [jenjang, setJenjang] = useState("");
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");

  const [token, setToken] = useState("");

  const [examLink, setExamLink] = useState("");

  const [loadingToken, setLoadingToken] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tokenModal, setTokenModal] = useState(false);
  const [tokenMessage, setTokenMessage] = useState("");

  useEffect(() => {
    if (pwaGateMode !== "allowed") return;
    enterFullscreen();
  }, [pwaGateMode]);

  // =========================
  // LOAD SESSION
  // =========================
  useEffect(() => {
    if (pwaGateMode !== "allowed") return;

    async function initSession() {
      let savedNama = localStorage.getItem("nama");
      let savedKelas = localStorage.getItem("kelas");
      let savedId = localStorage.getItem("id_siswa");

      // Jika belum ada di localStorage, ambil otomatis dari session login magang
      if (!savedNama) {
        try {
          const sessStr = localStorage.getItem("magang_session");
          if (sessStr) {
            const sess = JSON.parse(sessStr);
            if (sess && sess.nama) {
              const match = sess.nama.match(/(.+?)\s*\[(.*?)\]/);
              savedNama = match ? match[1].trim() : sess.nama.trim();
              if (!savedKelas) {
                savedKelas = (
                  match ? match[2].trim() : sess.kelas || ""
                ).trim();
              }
              savedId = sess.id ? String(sess.id).trim() : "";

              localStorage.setItem("nama", savedNama);
              if (savedKelas) localStorage.setItem("kelas", savedKelas);
              if (savedId) localStorage.setItem("id_siswa", savedId);
            }
          }
        } catch (e) {
          console.error("Gagal membaca session magang:", e);
        }
      }

      // =========================
      // VALIDASI KEYBOARD
      // =========================
      // Bersihkan flag lama agar siswa tidak terkunci permanen karena false positive
      sessionStorage.removeItem("keyboardSafe");

      // =========================
      // VALIDASI SESSION
      // =========================
      if (!savedNama) {
        router.push("/magang/login");
        return;
      }

      setNama(savedNama);
      if (savedKelas) setKelas(savedKelas);
      if (savedId) setIdSiswa(savedId);

      // Auto-register: pastikan nama+kelas tersimpan kembali di sheet
      // (berguna jika akun siswa pernah dihapus guru — ID tetap, nama/kelas dikosongkan)
      // Ini berjalan silent tanpa mengganggu alur ujian
      if (savedNama && savedId) {
        registerStudent({
          nama: savedNama,
          kelas: savedKelas || "",
          wa_siswa: savedId,
          wa_ortu: "-",
        }).catch(() => {});
      }
    }

    initSession();
  }, [pwaGateMode, router]);

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
  // LOAD DATA UJIAN DARI SPREADSHEET
  // =========================
  // =========================
  // LOAD DATA UJIAN DARI SPREADSHEET (MANUAL REFRESH)
  // =========================
  async function refreshExamData() {
    try {
      setRefreshing(true);
      const data = await getExamData();

      console.log("DATA UJIAN:", data);

      if (Array.isArray(data) && data.length > 0) {
        setExamData(data);
        localStorage.setItem("cached_exam_data", JSON.stringify(data));
        localStorage.setItem("cached_exam_data_time", Date.now().toString());

        const savedKelas = (localStorage.getItem("kelas") || "")
          .toUpperCase()
          .trim();
        if (savedKelas) {
          let detectedJenjang = "";
          if (savedKelas.startsWith("XII")) detectedJenjang = "XII";
          else if (savedKelas.startsWith("XI")) detectedJenjang = "XI";
          else if (savedKelas.startsWith("X")) detectedJenjang = "X";
          if (detectedJenjang) setJenjang(detectedJenjang);

          const match = data.find((item) => {
            if (!item?.kls) return false;
            const sheetKls = item.kls.toUpperCase().trim();
            return (
              sheetKls === savedKelas ||
              savedKelas.startsWith(sheetKls) ||
              sheetKls.startsWith(savedKelas)
            );
          });
          if (match) setSelectedKelas(match.kls);
        }

        setTokenMessage(
          "✅ Token & data ujian berhasil disegarkan dari spreadsheet!",
        );
        setTokenModal(true);
      } else {
        setTokenMessage("Gagal menyegarkan data. Periksa jaringan internet.");
        setTokenModal(true);
      }
    } catch (error) {
      console.log("Gagal load ujian:", error);
      setTokenMessage("Terjadi kendala saat membaca data ujian dari server.");
      setTokenModal(true);
    } finally {
      setRefreshing(false);
    }
  }

  // =========================
  // AUTO LOAD DATA UJIAN REALTIME
  // =========================
  useEffect(() => {
    if (pwaGateMode !== "allowed") return;

    let isMounted = true;
    const fetchExam = async () => {
      try {
        const data = await getExamData();
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setExamData(data);
          localStorage.setItem("cached_exam_data", JSON.stringify(data));
          localStorage.setItem("cached_exam_data_time", Date.now().toString());

          const savedKelas = (localStorage.getItem("kelas") || "")
            .toUpperCase()
            .trim();
          if (savedKelas) {
            let detectedJenjang = "";
            if (savedKelas.startsWith("XII")) detectedJenjang = "XII";
            else if (savedKelas.startsWith("XI")) detectedJenjang = "XI";
            else if (savedKelas.startsWith("X")) detectedJenjang = "X";
            if (detectedJenjang) setJenjang(detectedJenjang);

            const match = data.find((item) => {
              if (!item?.kls) return false;
              const sheetKls = item.kls.toUpperCase().trim();
              return (
                sheetKls === savedKelas ||
                savedKelas.startsWith(sheetKls) ||
                sheetKls.startsWith(savedKelas)
              );
            });
            if (match) setSelectedKelas(match.kls);
          }
        }
      } catch (err) {
        console.error("Gagal auto load ujian:", err);
      }
    };

    fetchExam();

    return () => {
      isMounted = false;
    };
  }, [pwaGateMode]);

  // ======================================
  // LIST JENJANG
  // ======================================
  const jenjangList = ["X", "XI", "XII"];

  // ======================================
  // FILTER KELAS
  // ======================================
  // ======================================
  // FILTER KELAS (SUDAH DIPERBAIKI ANTI BOCOR)
  // ======================================
  const kelasList = [
    ...new Set(
      examData
        .filter((item) => {
          if (!item?.kls || !jenjang) return false;

          const namaKelas = item.kls.toString().toUpperCase().trim();

          // Memastikan X tidak membocorkan XI atau XII
          // Cocok jika sama persis (misal: "X")
          // ATAU diikuti spasi (misal: "X TJKT")
          // ATAU diikuti strip (misal: "X-TJKT")
          return (
            namaKelas === jenjang ||
            namaKelas.startsWith(jenjang + " ") ||
            namaKelas.startsWith(jenjang + "-")
          );
        })
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
      setTokenMessage("Lengkapi data ujian (Kelas, Mapel, dan Token)");
      setTokenModal(true);

      setTimeout(() => {
        enterFullscreen();
      }, 300);

      return;
    }

    try {
      setLoadingToken(true);

      const cleanInputToken = token.trim().toUpperCase();

      // 1. Cek kecocokan token langsung dari data spreadsheet yang sudah terbaca
      const localMatch = examData.find((item) => {
        if (!item?.kls || !item?.mpl) return false;
        const kSheet = item.kls.toString().toUpperCase().trim();
        const mSheet = item.mpl.toString().toUpperCase().trim();
        return (
          kSheet === selectedKelas.toUpperCase().trim() &&
          mSheet === selectedMapel.toUpperCase().trim()
        );
      });

      let result = null;

      if (
        localMatch &&
        localMatch.token &&
        localMatch.token.toString().trim().toUpperCase() === cleanInputToken
      ) {
        result = {
          status: "success",
          link: localMatch.link || "",
          kodeKirim: localMatch.kodeKirim || "",
        };
      } else {
        result = await checkToken(selectedKelas, selectedMapel, token);
      }

      setLoadingToken(false);

      // TOKEN BENAR
      if (result.status === "success") {
        // ==========================================
        // KUNCI SESI PERANGKAT (1 NAMA 1 HP - ANTI JOKI)
        // ==========================================
        try {
          let devId = localStorage.getItem("exam_device_id");
          if (!devId) {
            devId = "dev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
            localStorage.setItem("exam_device_id", devId);
          }

          const lockRes = await kunciSesiUjian({
            nama,
            kelas: selectedKelas || kelas,
            idSiswa,
            mapel: selectedMapel,
            deviceId: devId,
          });

          if (lockRes && lockRes.status === "error") {
            setLoadingToken(false);
            setTokenMessage(
              lockRes.message ||
                "Akses ditolak: Akun Anda sedang aktif ujian di perangkat lain."
            );
            setTokenModal(true);

            setTimeout(() => {
              enterFullscreen();
            }, 300);
            return;
          }
        } catch (errLock) {
          console.warn("Gagal validasi kunci sesi:", errLock);
        }

        setExamLink(result.link);

        // SIMPAN LINK, KODE KIRIM, MAPEL & KELAS KE LOCALSTORAGE
        localStorage.setItem("examLink", result.link);
        localStorage.setItem("kodeKirim", result.kodeKirim || "");
        localStorage.setItem("selectedMapel", selectedMapel);
        localStorage.setItem("selectedKelas", selectedKelas);
        if (selectedKelas) {
          localStorage.setItem("kelas", selectedKelas);
        }

        // Langsung menuju ujian
        try {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          if (!isIOS) {
            await enterFullscreen();
          }
        } catch (err) {}

        router.push("/exam/start");
        return;
      } else {
        setExamLink("");

        setTokenMessage(result.message || "Token salah!");
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

  if (pwaGateMode !== "allowed") {
    const isCheckingPwa = pwaGateMode === "checking";
    const isStandaloneGate = pwaGateMode === "standalone-check";
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
        <section className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl sm:p-8">
          {isCheckingPwa ? (
            <div
              className="flex flex-col items-center gap-4 py-12"
              role="status"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
              <p className="text-sm text-slate-300">Memeriksa mode aplikasi…</p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="text-5xl" aria-hidden="true">
                  📲
                </div>
                <h1 className="mt-4 text-2xl font-black">
                  {isStandaloneGate
                    ? "Konfirmasi Aplikasi PWA"
                    : "Instal atau Buka PWA"}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">
                  {isStandaloneGate
                    ? "Tekan deteksi untuk memastikan portal dibuka dari aplikasi PWA standalone."
                    : "Ujian Android harus dibuka dari aplikasi Portal Sekolah. Tab Chrome biasa tidak dapat melanjutkan tanpa pengecualian pengawas."}
                </p>
              </div>

              {isStandaloneGate ? (
                <button
                  type="button"
                  onClick={continueFromPwaGate}
                  className="mt-6 w-full rounded-2xl bg-cyan-500 px-5 py-4 font-black text-slate-950 shadow-lg active:scale-[0.99]"
                >
                  Deteksi PWA dan Lanjutkan
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={installPwaFromExamGate}
                    className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-4 font-black text-slate-950 shadow-lg active:scale-[0.99]"
                  >
                    📲 Instal PWA Sekarang
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setInstallStepsVisible((visible) => !visible)
                    }
                    className="mt-4 w-full rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-bold text-white"
                  >
                    Cara instal / membuka aplikasi
                  </button>

                  {installStepsVisible && (
                    <ol className="mt-4 space-y-2 rounded-2xl bg-black/30 p-4 text-sm text-slate-200">
                      <li>1. Di Chrome, buka menu ⋮.</li>
                      <li>
                        2. Pilih <b>Install app</b> atau{" "}
                        <b>Tambahkan ke layar utama</b>.
                      </li>
                      <li>
                        3. Setelah dipasang, tutup tab dan buka ikon Portal
                        Sekolah.
                      </li>
                      <li>
                        4. Jika opsi instal tidak tersedia, minta PIN
                        pengecualian kepada pengawas.
                      </li>
                    </ol>
                  )}

                  <form
                    className="mt-6 border-t border-white/10 pt-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      continueFromPwaGate();
                    }}
                  >
                    <label
                      htmlFor="pwa-fallback-pin"
                      className="block text-sm font-bold text-slate-200"
                    >
                      PIN pengecualian pengawas (uji sementara)
                    </label>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="pwa-fallback-pin"
                        type="password"
                        value={pwaPin}
                        onChange={(event) => setPwaPin(event.target.value)}
                        autoComplete="one-time-code"
                        className="min-w-0 flex-1 rounded-xl border border-white/20 bg-slate-800 px-3 py-3 text-white outline-none focus:border-cyan-400"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-cyan-500 px-4 py-3 font-black text-slate-950"
                      >
                        Lanjut
                      </button>
                    </div>
                  </form>
                </>
              )}

              {pwaGateMessage && (
                <p
                  role="status"
                  className="mt-4 rounded-xl bg-amber-500/15 p-3 text-sm text-amber-200"
                >
                  {pwaGateMessage}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    );
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

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push("/magang/dashboard_siswa")}
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-3 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2"
                >
                  <span>←</span>
                  <span>Dashboard Siswa</span>
                </button>

                <div className="bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-4 rounded-2xl shadow-lg">
                  <p className="text-xs uppercase tracking-widest text-cyan-100">
                    Status
                  </p>

                  <p className="font-bold text-lg">Siap Ujian</p>
                </div>
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
                    <p className="text-slate-400 text-sm">ID Siswa</p>

                    <p className="font-bold text-lg">{idSiswa || "-"}</p>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                    <p className="text-slate-400 text-sm">Kelas</p>

                    <p className="font-bold text-lg">
                      {selectedKelas || kelas || "-"}
                    </p>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-8">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black mb-1">
                      Pilih Ujian
                    </h2>

                    <p className="text-slate-300 text-sm">
                      Pilih jenjang, kelas, mapel, lalu masukkan token ujian
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => refreshExamData()}
                    disabled={refreshing}
                    className="px-4 py-2.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs md:text-sm font-bold transition flex items-center gap-2 active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto shadow-sm"
                    title="Membaca ulang token dari spreadsheet"
                  >
                    <span className={refreshing ? "animate-spin" : ""}>🔄</span>
                    <span>{refreshing ? "Membaca..." : "Segarkan Token"}</span>
                  </button>
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

                  {/* CONTAINER INPUT TOKEN & TOMBOL MULAI UJIAN */}
                  <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => setToken(e.target.value.toUpperCase())}
                        disabled={loadingToken} // Mencegah input ganda saat loading
                        onKeyDown={async (e) => {
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (loadingToken) return;

                          // LANJUT UJIAN LANGSUNG DENGAN AMAN
                          handleCheckToken(true);
                        }}
                        autoCapitalize="characters"
                        autoCorrect="off"
                        spellCheck={false}
                        placeholder="Masukkan Token Ujian"
                        className="w-full bg-slate-900/70 border border-white/10 rounded-2xl p-4 pr-12 outline-none focus:border-cyan-400 transition text-white placeholder:text-slate-500 disabled:opacity-50 text-base md:text-lg font-bold tracking-widest uppercase"
                      />

                      {/* ANIMASI LOADING SPINNER */}
                      {loadingToken && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-400 border-t-transparent"></div>
                        </div>
                      )}
                    </div>

                    {/* TOMBOL MULAI UJIAN DI UJUNG KANAN INPUT TEXT */}
                    <button
                      type="button"
                      onClick={() => handleCheckToken(true)}
                      disabled={loadingToken || !token.trim()}
                      className="px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-95 text-white font-black text-sm md:text-base shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {loadingToken ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          <span>Memverifikasi...</span>
                        </>
                      ) : (
                        <>
                          <span>🚀 Mulai Ujian</span>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2.5}
                              d="M14 5l7 7m0 0l-7 7m7-7H3"
                            />
                          </svg>
                        </>
                      )}
                    </button>
                  </div>

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
