"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cekPesan, kirimPengaduan } from "@/services/authService";

export default function StartExamPage() {
  const router = useRouter();

  const [examLink, setExamLink] = useState("");
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");
  const [pesan, setPesan] = useState("");
  const [showPengaduan, setShowPengaduan] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45 * 60);
  const [isiPengaduan, setIsiPengaduan] = useState("");
  const [loadingPengaduan, setLoadingPengaduan] = useState(false);
  const [violations, setViolations] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [ignoreFullscreen, setIgnoreFullscreen] = useState(false);
  const [draftAnswers, setDraftAnswers] = useState({});
  const [draftMode, setDraftMode] = useState({});
  const [draftMinimized, setDraftMinimized] = useState(false);
  const [windowFocused, setWindowFocused] = useState(true);
  const [overlayDetected, setOverlayDetected] = useState(false);

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const fullscreenTimeout = useRef(null);
  const logoutRef = useRef(false);
  const iframeRef = useRef(null);
  const iframeContainerRef = useRef(null);
  const blurTimeoutRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const focusTimeoutRef = useRef(null);

  // =========================
  // LOAD SESSION
  // =========================
  useEffect(() => {
    async function init() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      try {
        if (!isIOS && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (err) {}

      const savedLink = localStorage.getItem("examLink");
      const savedNama = localStorage.getItem("nama");
      const savedKelas = localStorage.getItem("kelas");

      if (!savedNama || !savedKelas) {
        router.push("/login");
        return;
      }

      if (!savedLink) {
        router.push("/exam");
        return;
      }

      setExamLink(savedLink);
      setNama(savedNama);
      setKelas(savedKelas);

      const savedViolation = parseInt(
        localStorage.getItem("violations") || "0",
      );
      setViolations(savedViolation);

      const savedDraft = localStorage.getItem("draftAnswers");
      if (savedDraft) {
        setDraftAnswers(JSON.parse(savedDraft));
      }
    }

    const savedDraftMode = localStorage.getItem("draftMode");

    if (savedDraftMode) {
      setDraftMode(JSON.parse(savedDraftMode));
    }

    init();
  }, []);

  function showModal(message) {
    setIgnoreFullscreen(true);
    setModalMessage(message);
    setModalOpen(true);
  }

  function forceLogout(reason = "Pelanggaran ujian") {
    if (logoutRef.current) return;
    logoutRef.current = true;

    const totalViolation = violations + 1;
    localStorage.setItem("violations", totalViolation.toString());
    setViolations(totalViolation);

    showModal(reason + "\nTotal pelanggaran: " + totalViolation);

    setTimeout(() => {
      localStorage.removeItem("examLink");
      router.push("/exam");
    }, 2000);
  }

  // =========================
  // CEK PESAN REALTIME
  // =========================
  useEffect(() => {
    if (!nama || !kelas) return;

    const interval = setInterval(async () => {
      const result = await cekPesan(nama, kelas);

      if (result.status === "success") {
        const isiPesan = result.pesan || "";
        setPesan(isiPesan);

        if (isiPesan.toUpperCase() === "UJIAN DI RESET") {
          showModal("Ujian telah direset oleh admin");
          setTimeout(() => {
            localStorage.removeItem("examLink");
            router.push("/exam");
          }, 2000);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [nama, kelas]);

  // =========================
  // KIRIM PENGADUAN
  // =========================
  async function handleKirimPengaduan() {
    if (!isiPengaduan) {
      showModal("Isi pengaduan kosong");
      return;
    }

    setLoadingPengaduan(true);
    const result = await kirimPengaduan(nama, kelas, isiPengaduan);
    setLoadingPengaduan(false);

    if (result.status === "success") {
      showModal(result.message);
      setIsiPengaduan("");
      setShowPengaduan(false);
    } else {
      showModal(result.message || "Gagal kirim pengaduan");
    }
  }

  function handleKeluar() {
    if (timeLeft > 0) {
      showModal(
        "⏱️ Anda tidak bisa keluar sampai waktu habis!\n\nTombol Keluar akan tersedia setelah 45 menit.",
      );
      return;
    }

    localStorage.removeItem("examLink");
    localStorage.removeItem("draftAnswers");
    router.push("/exam");
  }

  function handleDraftChange(soalNo, answer) {
    const currentAnswer = draftAnswers[soalNo];
    const currentMode = draftMode[soalNo];

    // JIKA JAWABAN SAMA
    if (currentAnswer === answer) {
      // KLIK KE-2 = RAGU
      if (currentMode === "yakin") {
        const updatedMode = {
          ...draftMode,
          [soalNo]: "ragu",
        };

        setDraftMode(updatedMode);

        localStorage.setItem("draftMode", JSON.stringify(updatedMode));

        return;
      }

      // KLIK KE-3 = HAPUS
      if (currentMode === "ragu") {
        const updatedAnswers = { ...draftAnswers };
        const updatedMode = { ...draftMode };

        delete updatedAnswers[soalNo];
        delete updatedMode[soalNo];

        setDraftAnswers(updatedAnswers);
        setDraftMode(updatedMode);

        localStorage.setItem("draftAnswers", JSON.stringify(updatedAnswers));

        localStorage.setItem("draftMode", JSON.stringify(updatedMode));

        return;
      }
    }

    // KLIK PERTAMA
    const updatedAnswers = {
      ...draftAnswers,
      [soalNo]: answer,
    };

    const updatedMode = {
      ...draftMode,
      [soalNo]: "yakin",
    };

    setDraftAnswers(updatedAnswers);
    setDraftMode(updatedMode);

    localStorage.setItem("draftAnswers", JSON.stringify(updatedAnswers));

    localStorage.setItem("draftMode", JSON.stringify(updatedMode));
  }

  // =========================
  // DETEKSI FULLSCREEN
  // =========================
  useEffect(() => {
    function handleFullscreenChange() {
      clearTimeout(fullscreenTimeout.current);
      fullscreenTimeout.current = setTimeout(() => {
        if (logoutRef.current) return;
        if (ignoreFullscreen) return;
        if (!document.fullscreenElement) {
          forceLogout("Anda keluar dari fullscreen");
        }
      }, 1000);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      clearTimeout(fullscreenTimeout.current);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [ignoreFullscreen, violations]);

  // =========================
  // BLOK BACK BUTTON
  // =========================
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);

    function handlePopState() {
      if (logoutRef.current) return;
      window.history.pushState(null, "", window.location.href);
      forceLogout("Tombol back terdeteksi");
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // =========================
  // BLOK REFRESH
  // =========================
  useEffect(() => {
    function handleBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // =========================
  // COUNTDOWN TIMER
  // =========================
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          showModal("⏰ Waktu ujian habis! Tombol Submit sekarang tersedia.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // =========================
  // KEYBOARD HANDLER - EFEKTIF & SEDERHANA
  // =========================
  useEffect(() => {
    function handleKeyDown(e) {
      // JIKA WAKTU HABIS, IZINKAN SEMUA
      if (timeLeft <= 0) {
        return;
      }

      // JIKA INPUT PENGADUAN, IZINKAN INPUT TEXT SAJA
      if (e.target.closest(".pengaduan-input")) {
        // BLOK COPY PASTE
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
          e.preventDefault();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
          e.preventDefault();
          return;
        }
        // IZINKAN YANG LAIN UNTUK INPUT TEXT
        return;
      }

      // ============ BLOK DEVELOPER TOOLS ============
      if (
        e.key === "F12" ||
        e.key === "F11" ||
        (e.ctrlKey && e.shiftKey && e.key === "I") ||
        (e.ctrlKey && e.shiftKey && e.key === "J") ||
        (e.ctrlKey && e.shiftKey && e.key === "C") ||
        ((e.ctrlKey || e.metaKey) && e.key === "u") ||
        (e.altKey && e.key === "Tab")
      ) {
        e.preventDefault();
        forceLogout("Developer tools atau perpindahan tab terdeteksi");
        return;
      }

      // ============ IZINKAN TOMBOL SCROLL NAVIGATION ============
      const allowedScrollKeys = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];

      if (allowedScrollKeys.includes(e.key)) {
        // ✅ IZINKAN - JANGAN PREVENTDEFAULT
        return;
      }

      // ============ BLOK SEMUA KEYBOARD LAINNYA ============
      // Ini akan memblok: Enter, Space, Tab, Arrow Left/Right, Character input, dll
      e.preventDefault();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [timeLeft, violations]);

  // =========================
  // DETEKSI DEVTOOLS
  // =========================
  useEffect(() => {
    const threshold = 160;
    const interval = setInterval(() => {
      if (logoutRef.current) return;

      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;

      if (widthGap > threshold || heightGap > threshold) {
        forceLogout("Developer tools terbuka");
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [violations]);

  // =========================
  // ANTI OVERLAY STABIL
  // PC + ANDROID + IPHONE
  // =========================
  useEffect(() => {
    function handleBlur() {
      if (logoutRef.current) return;
      if (ignoreFullscreen) return;

      clearTimeout(blurTimeoutRef.current);

      blurTimeoutRef.current = setTimeout(() => {
        // Jika halaman masih tidak fokus
        if (!document.hasFocus()) {
          setOverlayDetected(true);

          forceLogout("Aplikasi lain / overlay / split screen terdeteksi");
        }
      }, 1800); // Delay agar tidak false detect
    }

    function handleFocus() {
      clearTimeout(blurTimeoutRef.current);

      setWindowFocused(true);

      setTimeout(() => {
        setOverlayDetected(false);
      }, 300);
    }

    function handleResize() {
      if (logoutRef.current) return;
      if (ignoreFullscreen) return;

      clearTimeout(resizeTimeoutRef.current);

      resizeTimeoutRef.current = setTimeout(() => {
        const widthDiff = Math.abs(window.outerWidth - window.innerWidth);

        const heightDiff = Math.abs(window.outerHeight - window.innerHeight);

        // Desktop split screen / floating app
        if (widthDiff > 250 || heightDiff > 250) {
          forceLogout("Split screen atau overlay terdeteksi");
        }
      }, 1500);
    }

    function handleVisibility() {
      if (logoutRef.current) return;
      if (ignoreFullscreen) return;

      if (document.hidden) {
        forceLogout("Anda keluar dari halaman ujian");
      }
    }

    // EVENT
    window.addEventListener("blur", handleBlur);

    window.addEventListener("focus", handleFocus);

    window.addEventListener("resize", handleResize);

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(blurTimeoutRef.current);

      clearTimeout(resizeTimeoutRef.current);

      clearTimeout(focusTimeoutRef.current);

      window.removeEventListener("blur", handleBlur);

      window.removeEventListener("focus", handleFocus);

      window.removeEventListener("resize", handleResize);

      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [ignoreFullscreen, violations]);

  const isTimeRunningOut = timeLeft > 0;

  return (
    <main className="w-full min-h-[100dvh] flex flex-col bg-gray-100 overflow-hidden">
      {/* MODAL INFO */}
      {modalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-5">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-blue-700 mb-4">Informasi</h2>
            <p className="text-gray-700 whitespace-pre-line mb-6">
              {modalMessage}
            </p>
            <button
              onClick={() => {
                setModalOpen(false);
                setTimeout(() => {
                  setIgnoreFullscreen(false);
                }, 500);
              }}
              className="w-full bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white shadow-md border-b p-4">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div>
            <h1 className="text-xl font-bold text-blue-700">Ujian Online</h1>
            <p className="text-sm text-gray-600">
              {nama} | {kelas}
            </p>
            <p className="text-sm text-red-600 font-semibold">
              Total Pelanggaran: {violations}
            </p>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowPengaduan(!showPengaduan)}
              className="bg-orange-500 text-white px-4 py-2 rounded-xl hover:bg-orange-600 transition"
            >
              Pengaduan
            </button>

            <button
              onClick={handleKeluar}
              className={`text-white px-4 py-2 rounded-xl transition font-semibold ${
                timeLeft > 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600 hover:bg-red-700"
              }`}
              disabled={timeLeft > 0}
              title={
                timeLeft > 0 ? "Keluar hanya tersedia setelah waktu habis" : ""
              }
            >
              Keluar
            </button>
          </div>
        </div>

        {pesan && (
          <div className="mt-3 bg-red-100 border border-red-300 text-red-700 rounded-xl p-3">
            <p className="font-bold">Pesan Admin</p>
            <p>{pesan}</p>
          </div>
        )}

        {showPengaduan && (
          <div className="mt-3 flex gap-2 flex-wrap">
            <input
              type="text"
              placeholder="Tulis pengaduan..."
              value={isiPengaduan}
              onChange={(e) => setIsiPengaduan(e.target.value)}
              className="border p-3 rounded-xl flex-1 pengaduan-input"
            />

            <button
              onClick={handleKirimPengaduan}
              disabled={loadingPengaduan}
              className="bg-blue-600 text-white px-4 rounded-xl hover:bg-blue-700 transition"
            >
              {loadingPengaduan ? "Mengirim..." : "Kirim"}
            </button>
          </div>
        )}
      </div>

      {/* IFRAME CONTAINER - SCROLL BERFUNGSI NORMAL */}
      <div
        ref={iframeContainerRef}
        className="flex-1 relative overflow-y-scroll overflow-x-hidden"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        {examLink && (
          <iframe
            ref={iframeRef}
            src={examLink}
            className="w-full border-none"
            allowFullScreen
            style={{
              height: "5000px",
              pointerEvents: isTimeRunningOut ? "none" : "auto",
            }}
          />
        )}

        {/* OVERLAY BLOCKER - BLOK CLICK TAPI IZINKAN SCROLL */}
      </div>

      {/* FLOATING DRAFT */}
      <div
        className={`
    fixed
    top-1/2
    -translate-y-1/2
    z-[999]
    transition-all
    duration-300
    ease-in-out
    ${
      draftMinimized
        ? "right-0 w-[42px]"
        : "right-2 md:right-4 w-[78px] md:w-[110px]"
    }
  `}
      >
        {/* TOMBOL MINIMIZE / EXPAND */}
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setDraftMinimized(!draftMinimized)}
            className="
        bg-blue-700
        hover:bg-blue-800
        text-white
        rounded-l-xl
        rounded-r-md
        shadow-lg
        px-2
        py-2
        text-xs
        font-bold
      "
          >
            {draftMinimized ? "◀" : "▶"}
          </button>
        </div>

        {/* KONTAINER DRAFT */}
        {!draftMinimized && (
          <div
            className="
        bg-white/95
        backdrop-blur-md
        border
        border-gray-300
        shadow-2xl
        rounded-2xl
        p-2
        max-h-[65vh]
        overflow-y-auto
      "
          >
            <div className="text-center mb-2">
              <h3 className="font-bold text-[10px] md:text-xs text-blue-700">
                DRAFT
              </h3>

              <p className="text-[8px] md:text-[10px] text-gray-500">
                1x Hijau
              </p>

              <p className="text-[8px] md:text-[10px] text-gray-500">
                2x Kuning
              </p>
            </div>

            <div className="grid grid-cols-1 gap-1">
              {Array.from({ length: 50 }).map((_, index) => {
                const soalNo = index + 1;

                const answer = draftAnswers[soalNo];

                const mode = draftMode[soalNo];

                let bgColor = "bg-gray-200";

                if (mode === "yakin") {
                  bgColor = "bg-green-500 text-white";
                }

                if (mode === "ragu") {
                  bgColor = "bg-yellow-400 text-black";
                }

                return (
                  <div
                    key={soalNo}
                    className={`
                rounded-xl
                p-1
                border
                border-gray-300
                ${bgColor}
              `}
                  >
                    <div className="text-center text-[10px] md:text-xs font-bold mb-1">
                      {soalNo}
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      {["A", "B", "C", "D", "E"].map((option) => (
                        <button
                          key={option}
                          onClick={() => handleDraftChange(soalNo, option)}
                          className={`
                      text-[9px]
                      md:text-[10px]
                      rounded
                      py-1
                      font-bold
                      transition
                      ${
                        answer === option
                          ? mode === "ragu"
                            ? "bg-yellow-600 text-white"
                            : "bg-green-700 text-white"
                          : "bg-white text-gray-700"
                      }
                    `}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TIMER LOCK */}
      {isTimeRunningOut && (
        <div className="relative h-[80px] bg-slate-900/95 backdrop-blur-md z-[999] border-t-4 border-red-600 flex items-center justify-between px-4 md:px-6 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="relative shrink-0">
              <div className="absolute inset-0 animate-ping bg-red-500 rounded-full opacity-25"></div>
              <div className="bg-red-600 p-2 rounded-lg relative shadow-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 md:h-6 md:w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
            </div>

            <div className="overflow-hidden">
              <h4 className="text-white font-bold text-xs md:text-base leading-none truncate uppercase">
                🔒 Tombol Kirim Dikunci
              </h4>
              <p className="text-gray-400 text-[9px] md:text-xs mt-1 uppercase tracking-tight font-medium truncate">
                Selesaikan soal sampai waktu habis
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 bg-black/40 px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
            <span className="text-[9px] md:text-[10px] text-gray-400 block mb-0.5 font-bold tracking-widest">
              SISA WAKTU
            </span>
            <span className="text-xl md:text-3xl font-mono font-black text-yellow-400 leading-none">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
      )}

      {/* SUCCESS MESSAGE */}
      {!isTimeRunningOut && (
        <div className="relative h-[80px] bg-gradient-to-r from-green-600 to-emerald-500 z-[999] border-t-4 border-green-300 flex items-center justify-between px-4 md:px-6 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="bg-green-400 p-2 rounded-lg shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 md:h-6 md:w-6 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            </div>

            <div className="overflow-hidden">
              <h4 className="text-white font-bold text-xs md:text-base leading-none truncate uppercase">
                ✅ Tombol Kirim Siap Diklik
              </h4>
              <p className="text-green-100 text-[9px] md:text-xs mt-1 uppercase tracking-tight font-medium truncate">
                Waktu ujian habis - silahkan klik Submit
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 bg-white/20 px-3 py-1.5 rounded-xl border border-white/30 shadow-inner">
            <span className="text-[9px] md:text-[10px] text-green-100 block mb-0.5 font-bold tracking-widest">
              WAKTU HABIS
            </span>
            <span className="text-xl md:text-3xl font-mono font-black text-white leading-none">
              00:00
            </span>
          </div>
        </div>
      )}
    </main>
  );
}
