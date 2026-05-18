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
  const [timeLeft, setTimeLeft] = useState(30 * 60);
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
  const [soalLocked, setSoalLocked] = useState(false);
  const [isModalPengaduanOpen, setIsModalPengaduanOpen] = useState(false);
  const [teksPengaduan, setTeksPengaduan] = useState("");
  const [isConfirmHapusOpen, setIsConfirmHapusOpen] = useState(false);
  const safeActionRef = useRef(false);

  const [browserBlocked, setBrowserBlocked] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);

  const [penaltyTime, setPenaltyTime] = useState(8 * 60);

  const [penaltyDone, setPenaltyDone] = useState(false);

  const [showPanduanModal, setShowPanduanModal] = useState(false);

  const [examStarted, setExamStarted] = useState(false);

  function isChromeBrowser() {
    const ua = navigator.userAgent;

    // WAJIB ADA CHROME
    const hasChrome = ua.includes("Chrome");

    // WAJIB BROWSER ASLI GOOGLE
    const isGoogleVendor =
      navigator.vendor && navigator.vendor.includes("Google");

    // BLOK SEMUA BROWSER TURUNAN
    const blockedBrowsers = [
      "Edg", // Microsoft Edge
      "OPR", // Opera
      "SamsungBrowser", // Samsung Internet
      "Firefox", // Firefox
      "CriOS", // Chrome iOS
      "FxiOS",
      "DuckDuckGo",
      "Brave",
      "Vivaldi",
      "YaBrowser",
    ];

    const isBlocked = blockedBrowsers.some((b) => ua.includes(b));

    return hasChrome && isGoogleVendor && !isBlocked;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  const fullscreenTimeout = useRef(null);
  const logoutRef = useRef(false);
  const iframeRef = useRef(null);
  const iframeContainerRef = useRef(null);
  // =========================
  // SAFE OVERLAY ENGINE
  // =========================

  const overlayRiskRef = useRef(0);

  const overlayTriggeredRef = useRef(false);

  const lastBlurAtRef = useRef(0);

  const lastViewportHeightRef = useRef(0);
  const blurTimeoutRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const focusTimeoutRef = useRef(null);
  const lastWidthRef = useRef(0);
  const lastHeightRef = useRef(0);
  const suspiciousResizeRef = useRef(0);
  const lastTouchRef = useRef(Date.now());
  const wakeLockRef = useRef(null);
  const freezeCheckRef = useRef(Date.now());

  const keyboardCountRef = useRef(0);

  const keyboardOpenedRef = useRef(false);

  // =========================
  // LOAD SESSION
  // =========================
  useEffect(() => {
    async function init() {
      // =========================
      // VALIDASI GOOGLE CHROME
      // =========================
      if (!isChromeBrowser()) {
        console.log("USER AGENT:", navigator.userAgent);
        console.log("VENDOR:", navigator.vendor);

        setBrowserBlocked(true);
        return;
      }

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

      const penaltyPassed = localStorage.getItem("penaltyPassed");

      // jika tidak sedang hukuman
      if (!(savedViolation >= 5 && !penaltyPassed)) {
        setShowPanduanModal(true);
      }

      // =========================
      // HUKUMAN SETELAH 4 PELANGGARAN
      // =========================
      if (savedViolation >= 5 && !penaltyPassed) {
        setPenaltyOpen(true);

        setShowPanduanModal(false);

        document.body.style.overflow = "hidden";
      }
      setViolations(savedViolation);

      const savedDraft = localStorage.getItem("draftAnswers");
      if (savedDraft) {
        setDraftAnswers(JSON.parse(savedDraft));
      }
      startSafeAction(2000);
    }

    const savedDraftMode = localStorage.getItem("draftMode");

    if (savedDraftMode) {
      setDraftMode(JSON.parse(savedDraftMode));
    }

    init();
  }, []);

  // =========================
  // TIMER HUKUMAN
  // =========================
  useEffect(() => {
    if (!penaltyOpen) return;

    if (penaltyDone) return;

    const interval = setInterval(() => {
      setPenaltyTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          setPenaltyDone(true);

          localStorage.setItem("penaltyPassed", "true");

          document.body.style.overflow = "auto";

          setPenaltyOpen(false);

          showModal("Waktu hukuman selesai.\n\nKlik OK untuk melanjutkan.");

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [penaltyOpen, penaltyDone]);

  function showModal(message) {
    setIgnoreFullscreen(true);
    setModalMessage(message);
    setModalOpen(true);
  }

  function startSafeAction(duration = 3000) {
    safeActionRef.current = true;

    setIgnoreFullscreen(true);

    setTimeout(() => {
      safeActionRef.current = false;

      setIgnoreFullscreen(false);
    }, duration);
  }

  function forceLogout(reason = "Pelanggaran ujian") {
    if (logoutRef.current) return;

    if (safeActionRef.current) return;

    const totalViolation = violations + 1;
    localStorage.setItem("violations", totalViolation.toString());
    setViolations(totalViolation);
    // reset hukuman agar muncul lagi
    if (totalViolation >= 5) {
      localStorage.removeItem("penaltyPassed");
    }

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
    if (!teksPengaduan.trim()) return;

    startSafeAction(5000);

    setLoadingPengaduan(true);

    try {
      const result = await kirimPengaduan(nama, kelas, teksPengaduan);

      setLoadingPengaduan(false);

      if (result.status === "success") {
        setTeksPengaduan("");

        setIsModalPengaduanOpen(false);

        setTimeout(() => {
          showModal("Laporan berhasil dikirim ke admin.");
        }, 300);
      } else {
        showModal(result.message || "Gagal kirim pengaduan");
      }
    } catch (err) {
      setLoadingPengaduan(false);

      showModal("Terjadi kesalahan jaringan.");
    }
  }

  function handleKeluar() {
    if (timeLeft > 0) {
      showModal(
        "⏱️ Anda tidak bisa keluar sampai waktu habis!\n\nTombol Keluar akan tersedia setelah 30 menit.",
      );
      return;
    }

    // 🔥 RESET PELANGGARAN SAAT KELUAR
    localStorage.removeItem("violations");
    localStorage.removeItem("penaltyPassed");
    localStorage.removeItem("draftAnswers");
    localStorage.removeItem("draftMode");

    setViolations(0);

    localStorage.removeItem("examLink");

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

  const handleHapusSemuaDraft = () => {
    setDraftAnswers({});
    setDraftMode({});
    localStorage.removeItem("draftAnswers");
    localStorage.removeItem("draftMode");
    setIsConfirmHapusOpen(false); // Tutup konfirmasi setelah hapus
    showModal("Semua draft jawaban telah dikosongkan.");
  };

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
    if (!examStarted) return;

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
  }, [examStarted]);

  // =========================
  // AUTO LOCK SOAL SETELAH 2 MENIT
  // =========================
  useEffect(() => {
    if (!examStarted) return;

    const lockTimer = setTimeout(
      () => {
        setSoalLocked(true);

        showModal(
          "🔒 Waktu pengisian data telah selesai.\n\n" +
            "Soal sekarang dikunci otomatis.\n\n" +
            "Silahkan kerjakan jawaban pada panel DRAFT di samping layar.\n\n" +
            "Setelah waktu asesmen 30 menit selesai:\n" +
            "1. Salin kembali jawaban draft ke Google Form\n" +
            "2. Periksa jawaban\n" +
            "3. Tekan tombol Kirim/Submit",
        );
      },
      1 * 60 * 1000,
    );

    return () => clearTimeout(lockTimer);
  }, [examStarted]);

  // =========================
  // KEYBOARD HANDLER - EFEKTIF & SEDERHANA
  // ========================
  useEffect(() => {
    function handleKeyDown(e) {
      // =========================
      // BLOCK ESC GLOBAL
      // =========================
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();

        // Jika modal terbuka → tutup modal SAJA
        if (modalOpen) {
          setModalOpen(false);

          setTimeout(async () => {
            try {
              if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
              }
            } catch (err) {}

            setIgnoreFullscreen(false);
          }, 300);

          return;
        }

        // Jika modal pengaduan terbuka
        if (isModalPengaduanOpen) {
          setIsModalPengaduanOpen(false);

          setTimeout(async () => {
            try {
              if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
              }
            } catch (err) {}

            setIgnoreFullscreen(false);
          }, 300);

          return;
        }

        // Jika confirm hapus terbuka
        if (isConfirmHapusOpen) {
          setIsConfirmHapusOpen(false);

          setTimeout(async () => {
            try {
              if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
              }
            } catch (err) {}

            setIgnoreFullscreen(false);
          }, 300);

          return;
        }

        // Jika tidak ada modal
        forceLogout("Tombol ESC terdeteksi");
        return;
      }

      // =========================
      // LANJUT LOGIC LAMA
      // =========================

      if (timeLeft <= 0 || !soalLocked) return;

      if (isModalPengaduanOpen && e.target.tagName === "TEXTAREA") {
        if (
          (e.ctrlKey || e.metaKey) &&
          ["c", "v"].includes(e.key.toLowerCase())
        ) {
          e.preventDefault();
        }

        return;
      }

      const isDangerous =
        e.key === "F12" ||
        e.key === "F11" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") ||
        (e.altKey && e.key === "Tab");

      if (isDangerous) {
        e.preventDefault();
        forceLogout("Akses terlarang terdeteksi!");
        return;
      }

      const allowedScroll = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];

      if (allowedScroll.includes(e.key)) return;

      e.preventDefault();
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [
    timeLeft,
    soalLocked,
    isModalPengaduanOpen,
    isConfirmHapusOpen,
    modalOpen,
  ]);

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
  // Ganti section ANTI SPLIT SCREEN dengan ini:

  // =========================
  // ANTI SPLIT SCREEN / FLOATING
  // SUPER STABIL
  // =========================
  useEffect(() => {
    lastWidthRef.current = window.innerWidth;
    lastHeightRef.current = window.innerHeight;
    lastViewportHeightRef.current = window.innerHeight;

    function triggerViolation(reason) {
      if (logoutRef.current) return;

      if (ignoreFullscreen) return;

      if (safeActionRef.current) return;

      forceLogout(reason);
    }
    // ======================
    // SAFE OVERLAY RISK
    // ======================

    function addOverlayRisk(score, reason) {
      if (logoutRef.current) return;

      if (ignoreFullscreen) return;

      if (safeActionRef.current) return;

      if (modalOpen || isModalPengaduanOpen || isConfirmHapusOpen) {
        return;
      }

      overlayRiskRef.current += score;

      console.log("[OVERLAY SCORE]", overlayRiskRef.current, reason);

      // auto limit
      if (overlayRiskRef.current < 0) {
        overlayRiskRef.current = 0;
      }

      // trigger hanya jika benar-benar tinggi
      if (overlayRiskRef.current >= 80 && !overlayTriggeredRef.current) {
        overlayTriggeredRef.current = true;

        triggerViolation("Floating apps / aktivitas mencurigakan terdeteksi");
      }
    }

    // ======================
    // BLUR - Deteksi fokus keluar dari window
    // ======================
    function handleBlur() {
      lastBlurAtRef.current = Date.now();
      clearTimeout(blurTimeoutRef.current);

      blurTimeoutRef.current = setTimeout(() => {
        if (!document.hasFocus()) {
          if (
            modalOpen ||
            isModalPengaduanOpen ||
            isConfirmHapusOpen ||
            safeActionRef.current
          ) {
            return;
          }

          triggerViolation("Aplikasi lain / floating window terdeteksi");
        }
      }, 1200);
    }

    // ======================
    // FOCUS - Deteksi ketika fokus kembali (cegah false positive iframe)
    // ======================
    function handleFocus() {
      clearTimeout(blurTimeoutRef.current);

      const blurDuration = Date.now() - lastBlurAtRef.current;

      // blur cukup lama = mencurigakan
      if (blurDuration > 1000 && blurDuration < 15000) {
        addOverlayRisk(20, "Long Blur");
      }
    }

    // ======================
    // VISIBILITY
    // ======================
    function handleVisibility() {
      if (document.hidden) {
        if (safeActionRef.current) return;
        addOverlayRisk(40, "Document Hidden");

        triggerViolation("Anda keluar dari halaman ujian");
      }
    }

    // ======================
    // RESIZE DETECTION
    // ======================
    function handleResize() {
      if (safeActionRef.current) return;

      if (modalOpen || isModalPengaduanOpen || isConfirmHapusOpen) {
        return;
      }
      clearTimeout(resizeTimeoutRef.current);

      resizeTimeoutRef.current = setTimeout(() => {
        const currentWidth = window.innerWidth;
        const currentHeight = window.innerHeight;

        const widthDiff = Math.abs(currentWidth - lastWidthRef.current);
        const heightDiff = Math.abs(currentHeight - lastHeightRef.current);

        lastWidthRef.current = currentWidth;
        lastHeightRef.current = currentHeight;

        if (widthDiff > 180 || heightDiff > 180) {
          suspiciousResizeRef.current++;

          if (suspiciousResizeRef.current >= 1) {
            triggerViolation("Split screen / floating mode terdeteksi");
          }
        }
      }, 800);
    }

    // ======================
    // ORIENTATION CHANGE
    // ======================
    function handleOrientation() {
      setTimeout(() => {
        const w = window.innerWidth;
        const h = window.innerHeight;

        if (w < screen.width * 0.7 || h < screen.height * 0.7) {
          triggerViolation("Mode layar tidak normal terdeteksi");
        }
      }, 1000);
    }

    // ======================
    // VISUAL VIEWPORT (Android)
    // ======================
    function handleViewport() {
      const currentHeight = window.innerHeight;

      const diff = Math.abs(currentHeight - lastViewportHeightRef.current);

      lastViewportHeightRef.current = currentHeight;

      // resize besar lebih mencurigakan
      if (diff > 160) {
        addOverlayRisk(20, "Large Viewport Resize");
      }
      if (!window.visualViewport) return;

      const viewportWidth = window.visualViewport.width;
      const viewportHeight = window.visualViewport.height;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;

      const widthRatio = viewportWidth / screenWidth;
      const heightRatio = viewportHeight / screenHeight;

      const keyboardOpen = Math.abs(window.innerHeight - viewportHeight) > 150;

      // ======================
      // RESET STATE
      // ======================

      if (!keyboardOpen) {
        keyboardOpenedRef.current = false;
      }

      // ======================
      // KEYBOARD DETECTOR
      // ======================

      if (keyboardOpen) {
        // izinkan modal pengaduan
        if (isModalPengaduanOpen) {
          return;
        }

        // cegah spam saat keyboard
        // masih terbuka
        if (keyboardOpenedRef.current) {
          return;
        }

        keyboardOpenedRef.current = true;

        keyboardCountRef.current++;

        console.log("KEYBOARD COUNT:", keyboardCountRef.current);

        // ======================
        // PERTAMA
        // ======================

        if (keyboardCountRef.current === 1) {
          showModal(
            "⚠️ Keyboard terdeteksi.\n\n" +
              "Keyboard tidak diperlukan saat ujian.\n\n" +
              "Sistem masih memberikan toleransi.",
          );

          return;
        }

        // ======================
        // KEDUA
        // ======================

        if (keyboardCountRef.current === 2) {
          showModal(
            "⚠️ Keyboard kembali terdeteksi.\n\n" +
              "Mohon tidak menggunakan keyboard selama ujian.\n\n" +
              "Pelanggaran berikutnya akan menyebabkan ujian dihentikan.",
          );

          return;
        }

        // ======================
        // KETIGA
        // ======================

        if (keyboardCountRef.current >= 3) {
          triggerViolation("Keyboard terdeteksi berulang kali");
        }
      }

      if (keyboardOpen) return;

      if (safeActionRef.current) return;

      if (widthRatio < 0.75 || heightRatio < 0.75) {
        triggerViolation("Floating window / split screen terdeteksi");
      }
    }

    // EVENT LISTENER
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus); // ← TAMBAH INI
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientation);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewport);
    }

    return () => {
      clearTimeout(blurTimeoutRef.current);
      clearTimeout(resizeTimeoutRef.current);

      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus); // ← TAMBAH INI
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientation);

      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewport);
      }
    };
  }, [ignoreFullscreen, violations]);

  // =========================
  // INPUT / KEYBOARD FOCUS DETECTOR
  // =========================

  useEffect(() => {
    function handleFocusIn(e) {
      if (logoutRef.current) return;

      // izinkan textarea pengaduan
      if (isModalPengaduanOpen) {
        return;
      }

      const tag = e.target.tagName;

      const isInput =
        tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable;

      if (!isInput) return;

      keyboardCountRef.current++;

      console.log("INPUT FOCUS:", keyboardCountRef.current);

      // pertama
      if (keyboardCountRef.current === 1) {
        showModal(
          "⚠️ Input keyboard terdeteksi.\n\n" +
            "Keyboard tidak diperlukan selama ujian.",
        );

        return;
      }

      // kedua
      if (keyboardCountRef.current === 2) {
        showModal(
          "⚠️ Keyboard kembali terdeteksi.\n\n" +
            "Pelanggaran berikutnya akan menghentikan ujian.",
        );

        return;
      }

      // ketiga
      triggerViolation("Aktivitas keyboard mencurigakan");
    }

    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      document.removeEventListener("focusin", handleFocusIn, true);
    };
  }, [isModalPengaduanOpen]);

  // =========================
  // SCREEN WAKE LOCK
  // AGAR LAYAR TETAP MENYALA
  // =========================
  useEffect(() => {
    async function enableWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");

          console.log("Wake Lock aktif");
        }
      } catch (err) {
        console.log("Wake Lock gagal:", err);
      }
    }

    enableWakeLock();

    // Android kadang melepas wake lock
    // saat pindah app / lockscreen
    async function handleVisibility() {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (err) {}
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);

      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, []);

  // =========================
  // =========================
  // DETEKSI TAB FREEZE
  // SUPER STABIL
  // =========================
  useEffect(() => {
    freezeCheckRef.current = Date.now();

    const interval = setInterval(() => {
      if (logoutRef.current) return;

      if (ignoreFullscreen) {
        freezeCheckRef.current = Date.now();
        return;
      }

      // abaikan saat modal aktif
      if (modalOpen || isModalPengaduanOpen || isConfirmHapusOpen) {
        freezeCheckRef.current = Date.now();
        return;
      }

      // abaikan safe action
      if (safeActionRef.current) {
        freezeCheckRef.current = Date.now();
        return;
      }

      // abaikan jika textarea sedang fokus
      const activeEl = document.activeElement;

      if (
        activeEl &&
        (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")
      ) {
        freezeCheckRef.current = Date.now();
        return;
      }

      const now = Date.now();

      const diff = now - freezeCheckRef.current;

      // naikkan threshold agar Android tidak false positive
      if (diff > 20000) {
        forceLogout("Aplikasi dibekukan / pindah aplikasi terdeteksi");
      }

      freezeCheckRef.current = now;
    }, 3000);

    return () => clearInterval(interval);
  }, [ignoreFullscreen, modalOpen, isModalPengaduanOpen, isConfirmHapusOpen]);

  // =========================
  // BLOCK LONG PRESS MOBILE
  // =========================
  useEffect(() => {
    function preventContextMenu(e) {
      e.preventDefault();
    }

    document.addEventListener("contextmenu", preventContextMenu);

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
    };
  }, []);

  const isTimeRunningOut = timeLeft > 0;
  // =========================
  // TOUCH HEARTBEAT DETECTION
  // =========================
  useEffect(() => {
    function updateTouch() {
      lastTouchRef.current = Date.now();
    }

    // Deteksi semua sentuhan user
    window.addEventListener("touchstart", updateTouch, true);

    window.addEventListener("touchmove", updateTouch, true);

    window.addEventListener("click", updateTouch, true);

    // Monitor kehilangan interaksi
    const interval = setInterval(() => {
      if (logoutRef.current) return;

      if (ignoreFullscreen) return;

      // jangan cek saat modal aktif
      if (modalOpen) return;

      if (isModalPengaduanOpen) return;

      if (isConfirmHapusOpen) return;

      const now = Date.now();

      const idleTime = now - lastTouchRef.current;

      // jika tidak fokus + tidak ada touch
      if (idleTime > 6000 && !document.hasFocus()) {
        forceLogout("Floating window / aplikasi lain terdeteksi");
      }
    }, 1500);

    return () => {
      clearInterval(interval);

      window.removeEventListener("touchstart", updateTouch, true);

      window.removeEventListener("touchmove", updateTouch, true);

      window.removeEventListener("click", updateTouch, true);
    };
  }, [ignoreFullscreen, modalOpen, isModalPengaduanOpen, isConfirmHapusOpen]);

  // =========================
  // BLOCK NON CHROME
  // =========================
  if (browserBlocked) {
    return (
      <main className="w-full h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200">
          {/* HEADER */}
          <div className="bg-gradient-to-r from-red-600 to-orange-500 p-6 text-center">
            <div className="text-5xl mb-3">⚠️</div>

            <h1 className="text-white text-2xl font-black uppercase tracking-wide">
              Browser Tidak Didukung
            </h1>

            <p className="text-orange-100 text-sm mt-2">
              Gunakan Google Chrome untuk memulai asesmen
            </p>
          </div>

          {/* CONTENT */}
          <div className="p-6 text-center">
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-5">
              <p className="text-gray-700 text-sm leading-relaxed">
                Sistem ujian hanya dapat dibuka menggunakan
                <span className="font-black text-orange-600">
                  {" "}
                  Google Chrome
                </span>{" "}
                agar keamanan asesmen berjalan dengan baik.
              </p>
            </div>

            <button
              onClick={() => {
                window.location.href = "https://www.google.com/chrome/";
              }}
              className="
              w-full
              py-3
              rounded-2xl
              bg-gradient-to-r
              from-orange-500
              to-red-500
              hover:from-orange-600
              hover:to-red-600
              text-white
              font-black
              shadow-lg
              transition
            "
            >
              Download Google Chrome
            </button>

            <p className="text-[11px] text-gray-400 mt-4">
              Android • Windows • Mac • Linux
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="w-full h-screen bg-gray-100 relative"
      style={{
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {/* MODAL HUKUMAN */}
      {penaltyOpen && (
        <div className="fixed inset-0 z-[999999] bg-black flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* HEADER */}
            <div className="bg-gradient-to-r from-red-600 to-orange-500 p-6 text-center">
              <div className="text-5xl mb-3">⚠️</div>

              <h1 className="text-white text-2xl font-black uppercase">
                Hukuman Pelanggaran
              </h1>

              <p className="text-red-100 text-sm mt-2">
                Anda terlalu banyak melakukan pelanggaran
              </p>
            </div>

            {/* CONTENT */}
            <div className="p-6 text-center">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5">
                <p className="text-gray-700 text-sm leading-relaxed">
                  Karena jumlah pelanggaran telah melewati batas aman, Anda
                  diwajibkan menunggu selama 8 menit sebelum dapat kembali
                  memulai asesmen.
                </p>
              </div>

              {/* TIMER */}
              <div className="bg-black rounded-3xl py-6 mb-5">
                <div className="text-red-500 text-xs font-bold tracking-[3px] mb-2">
                  WAKTU HUKUMAN
                </div>

                <div className="text-5xl font-black text-white font-mono">
                  {formatTime(penaltyTime)}
                </div>
              </div>

              <div className="text-[11px] text-gray-400">
                Tunggu hingga waktu selesai untuk melanjutkan ujian
              </div>
            </div>
          </div>
        </div>
      )}
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

                // setelah hukuman selesai
                if (!showPanduanModal && !examStarted) {
                  setShowPanduanModal(true);
                }

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

      <header
        className="
    fixed
    top-0
    left-0
    right-0
    h-[110px]
    z-[1000]
    shrink-0

    bg-gradient-to-r
    from-yellow-400
    via-amber-300
    to-yellow-500

    shadow-md
  "
      >
        {/* GARIS ATAS */}
        <div
          className="
      h-[2px]
      bg-gradient-to-r
      from-transparent
      via-yellow-100
      to-transparent
    "
        />

        <div className="relative px-3 md:px-5 py-2">
          {/* SOFT LIGHT */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="
          absolute
          -top-10
          right-0
          w-36
          h-36
          bg-white/20
          rounded-full
          blur-3xl
        "
            />
          </div>

          <div className="relative flex items-center justify-between gap-3">
            {/* KIRI */}
            <div className="min-w-0 flex-1">
              {/* BADGE */}
              <div className="flex items-center gap-2 flex-wrap">
                <div
                  className="
              px-2
              py-1

              rounded-lg

              bg-white/20
              backdrop-blur-md

              border
              border-white/30

              text-[8px]
              md:text-[9px]

              font-black
              tracking-[1.2px]

              text-yellow-950
            "
                >
                  CBT EXAM SYSTEM
                </div>

                {/* PELANGGARAN */}
                <div
                  className="
              px-2.5
              py-1

              rounded-lg

              bg-gradient-to-r
              from-red-600
              to-rose-500

              text-white

              text-[9px]
              md:text-[10px]

              font-black

              shadow-md
            "
                >
                  PELANGGARAN : {violations}
                </div>
              </div>

              {/* JUDUL */}
              <h1
                className="
            mt-1

            text-[13px]
            md:text-lg

            font-black

            uppercase

            tracking-wide

            text-yellow-950

            truncate
          "
              >
                ASESMEN SMKN 1 TELUK KUANTAN
              </h1>

              {/* IDENTITAS */}
              <div
                className="
            mt-1.5

            inline-flex
            items-center

            px-2.5
            py-1

            rounded-xl

            bg-white/15
            backdrop-blur-sm

            border
            border-white/20

            shadow-sm
          "
              >
                <p
                  className="
              text-[10px]
              md:text-xs

              font-bold

              tracking-wide

              text-yellow-950

              truncate
            "
                >
                  {nama} • {kelas}
                </p>
              </div>
            </div>

            {/* KANAN */}
            <div className="flex flex-col gap-2 shrink-0">
              {/* KELUAR */}
              <button
                onClick={handleKeluar}
                disabled={timeLeft > 0}
                className={`
    relative
    w-[120px] md:w-[160px]
    h-10 md:h-11

    rounded-xl

    text-[10px] md:text-[12px]
    font-black

    transition-all duration-200
    active:scale-95

    flex items-center justify-center
    text-center leading-tight

    shadow-lg

    ${
      timeLeft > 0
        ? `
          bg-gray-400
          text-gray-200
          cursor-not-allowed
        `
        : `
          bg-gradient-to-r from-red-600 via-red-500 to-rose-500
          text-white
          shadow-red-500/40
          hover:from-red-700 hover:to-rose-600
          animate-pulse
        `
    }
  `}
              >
                <span className="flex flex-col leading-none">
                  <span>Keluar</span>
                  <span className="text-[8px] md:text-[10px] opacity-90">
                    + Hapus Pelanggaran
                  </span>
                </span>

                {/* GLOW EFFECT */}
                {timeLeft <= 0 && (
                  <span className="absolute inset-0 rounded-xl bg-red-400 opacity-20 blur-md animate-ping"></span>
                )}
              </button>

              {/* PENGADUAN */}
              <button
                onClick={() => {
                  setIgnoreFullscreen(true);
                  setIsModalPengaduanOpen(true);
                }}
                className="
    relative

    w-[120px] md:w-[160px]
    h-10 md:h-11

    rounded-xl

    text-[10px] md:text-[12px]
    font-black

    flex items-center justify-center

    text-center leading-tight

    text-white

    bg-gradient-to-r
    from-orange-500 via-amber-400 to-orange-500

    hover:from-orange-600 hover:to-amber-500

    active:scale-95

    shadow-lg shadow-orange-500/30

    transition-all duration-200
  "
              >
                <span className="flex flex-col leading-none">
                  <span>Pengaduan</span>
                  <span className="text-[8px] md:text-[10px] opacity-90">
                    Laporkan Masalah
                  </span>
                </span>

                {/* glow halus */}
                <span className="absolute inset-0 rounded-xl bg-white/10 opacity-0 hover:opacity-100 transition"></span>
              </button>
            </div>
          </div>

          {/* PESAN ADMIN */}
          {pesan && (
            <div
              className="
          mt-2

          rounded-xl

          bg-gradient-to-r
          from-red-600
          to-rose-500

          px-3
          py-2

          text-white

          shadow-md
        "
            >
              <p
                className="
            text-[9px]
            md:text-[10px]

            font-black

            uppercase

            tracking-wide
          "
              >
                PESAN ADMIN
              </p>

              <p
                className="
            mt-1

            text-[11px]
            md:text-xs

            text-red-50

            leading-relaxed
          "
              >
                {pesan}
              </p>
            </div>
          )}
        </div>

        {/* GARIS BAWAH */}
        <div
          className="
      h-[1px]

      bg-gradient-to-r
      from-transparent
      via-yellow-900/30
      to-transparent
    "
        />
      </header>

      {/* IFRAME CONTAINER - SCROLL BERFUNGSI NORMAL */}
      <div
        ref={iframeContainerRef}
        className="
    absolute
    top-[110px]
    bottom-[80px]
    left-0
    right-0
    overflow-y-auto
    overflow-x-hidden
  "
        style={{
          WebkitOverflowScrolling: "touch",
          overscrollBehavior: "contain",
        }}
      >
        {examLink && (
          <iframe
            ref={iframeRef}
            src={examLink}
            className="w-full border-none"
            allowFullScreen
            style={{
              height: "30000px",
              pointerEvents: soalLocked && timeLeft > 0 ? "none" : "auto",
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
        <button
          onClick={() => setDraftMinimized(!draftMinimized)}
          className={`
    absolute
    top-1/2
    -translate-y-1/2
    -left-9

    bg-blue-700
    hover:bg-blue-800
    text-white

    rounded-l-xl
    rounded-r-md

    shadow-lg

    px-2
    py-3

    text-xs
    font-bold

    transition-all
  `}
        >
          {draftMinimized ? "▶" : "◀"}
        </button>

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

              {/* Tombol Hapus Data Baru */}
              <button
                onClick={() => {
                  setIgnoreFullscreen(true); // Pastikan ini true agar tidak logout
                  setIsConfirmHapusOpen(true);
                }}
                className="mt-1 mb-2 bg-red-100 hover:bg-red-200 text-red-600 text-[8px] md:text-[9px] font-bold py-1 px-2 rounded-lg border border-red-200"
              >
                🗑️ HAPUS
              </button>

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
        <div className="fixed bottom-0 left-0 right-0 h-[80px] bg-slate-900/95 backdrop-blur-md z-[999] border-t-4 border-red-600 flex items-center justify-between px-4 md:px-6 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
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
                🔒 Soal Dikunci
              </h4>
              <p className="text-gray-400 text-[9px] md:text-xs mt-1 uppercase tracking-tight font-medium truncate">
                Jawab di draft hingga waktu selesai
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
        <div className="fixed bottom-0 left-0 right-0 h-[80px] bg-gradient-to-r from-green-600 to-emerald-500 z-[999] border-t-4 border-green-300 flex items-center justify-between px-4 md:px-6 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
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
      {isModalPengaduanOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
            <div className="bg-orange-500 p-4 text-white text-center">
              <h3 className="font-bold text-lg">⚠️ FORM PENGADUAN</h3>
              <p className="text-[10px] opacity-80">
                Input keyboard hanya aktif di kotak ini
              </p>
            </div>
            <div className="p-5">
              <textarea
                autoFocus
                className="w-full h-32 p-3 border-2 border-gray-100 rounded-xl focus:border-orange-400 focus:outline-none text-gray-700 text-sm"
                placeholder="Tuliskan kendala Anda di sini..."
                value={teksPengaduan}
                onChange={(e) => setTeksPengaduan(e.target.value)}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setIsModalPengaduanOpen(false);
                    setIgnoreFullscreen(false);
                  }}
                  className="flex-1 py-2 font-bold text-gray-400 hover:text-gray-600"
                >
                  Batal
                </button>
                <button
                  onClick={handleKirimPengaduan}
                  disabled={loadingPengaduan || !teksPengaduan.trim()}
                  className="flex-1 py-2 rounded-xl font-bold text-white bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300"
                >
                  {loadingPengaduan ? "Proses..." : "Kirim Laporan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {isConfirmHapusOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xs rounded-2xl p-6 text-center shadow-2xl border-t-4 border-red-500">
            <h3 className="text-gray-800 font-bold mb-2">
              Hapus Semua Jawaban?
            </h3>
            <p className="text-gray-500 text-xs mb-6">
              Tindakan ini tidak bisa dibatalkan.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setIsConfirmHapusOpen(false)}
                className="flex-1 py-2 text-sm font-bold text-gray-400"
              >
                Batal
              </button>
              <button
                onClick={handleHapusSemuaDraft}
                className="flex-1 py-2 bg-red-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-200"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PANDUAN ASESMEN */}
      {showPanduanModal && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div
            className="
        w-full
        max-w-2xl

        bg-white

        rounded-3xl

        overflow-hidden

        shadow-[0_20px_80px_rgba(0,0,0,0.45)]

        border
        border-gray-200
      "
          >
            {/* HEADER */}
            <div
              className="
          bg-gradient-to-r
          from-blue-700
          via-cyan-600
          to-blue-800

          px-6
          py-5

          text-white
        "
            >
              <div className="flex items-center gap-4">
                <div
                  className="
              w-14
              h-14

              rounded-2xl

              bg-white/15

              flex
              items-center
              justify-center

              text-3xl
            "
                >
                  📝
                </div>

                <div>
                  <h2 className="text-2xl font-black uppercase tracking-wide">
                    Tata Cara Asesmen
                  </h2>

                  <p className="text-cyan-100 text-sm mt-1">
                    Bacalah petunjuk sebelum memulai ujian
                  </p>
                </div>
              </div>
            </div>

            {/* CONTENT */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                {/* STEP 1 */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                    1
                  </div>

                  <div>
                    <h3 className="font-black text-gray-800 text-lg">
                      Isi Data dan Jawaban Awal
                    </h3>

                    <p className="text-gray-600 leading-relaxed mt-1">
                      Setelah ujian dimulai, silahkan isi identitas dan jawaban
                      langsung pada Google Form selama
                      <span className="font-black text-blue-700">
                        {" "}
                        1 menit pertama
                      </span>
                      .
                    </p>
                  </div>
                </div>

                {/* STEP 2 */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-red-600 text-white flex items-center justify-center font-black">
                    2
                  </div>

                  <div>
                    <h3 className="font-black text-gray-800 text-lg">
                      Soal Akan Dikunci
                    </h3>

                    <p className="text-gray-600 leading-relaxed mt-1">
                      Setelah 1 menit, Google Form otomatis terkunci dan tidak
                      dapat disentuh lagi hingga waktu asesmen selesai.
                    </p>
                  </div>
                </div>

                {/* STEP 3 */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-green-600 text-white flex items-center justify-center font-black">
                    3
                  </div>

                  <div>
                    <h3 className="font-black text-gray-800 text-lg">
                      Gunakan Draft Jawaban
                    </h3>

                    <p className="text-gray-600 leading-relaxed mt-1">
                      Selama soal terkunci, silahkan jawab menggunakan panel
                      <span className="font-black text-green-700">
                        {" "}
                        Draft Jawaban
                      </span>{" "}
                      di samping layar.
                    </p>

                    <div className="mt-3 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 rounded bg-green-500"></div>
                        <span className="text-gray-700">
                          Klik 1x = Jawaban yakin
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 rounded bg-yellow-400"></div>
                        <span className="text-gray-700">
                          Klik 2x = Jawaban ragu-ragu
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-4 h-4 rounded bg-gray-300"></div>
                        <span className="text-gray-700">
                          Klik 3x = Menghapus jawaban
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* STEP 4 */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black">
                    4
                  </div>

                  <div>
                    <h3 className="font-black text-gray-800 text-lg">
                      Setelah 30 Menit
                    </h3>

                    <p className="text-gray-600 leading-relaxed mt-1">
                      Setelah timer mencapai 00:00:
                    </p>

                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                      <li>• Form akan aktif kembali</li>
                      <li>• Salin jawaban dari Draft ke Google Form</li>
                      <li>• Periksa kembali jawaban Anda</li>
                      <li>• Tekan tombol Kirim / Submit</li>
                    </ul>
                  </div>
                </div>

                {/* STEP 5 */}
                <div className="flex gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-500 text-white flex items-center justify-center font-black">
                    !
                  </div>

                  <div>
                    <h3 className="font-black text-gray-800 text-lg">
                      Peraturan Keamanan
                    </h3>

                    <ul className="mt-2 space-y-2 text-sm text-gray-700">
                      <li>• Jangan keluar dari fullscreen</li>
                      <li>• Jangan membuka aplikasi lain</li>
                      <li>• Jangan menggunakan split screen</li>
                      <li>• Jangan membuka developer tools</li>
                      <li>• Gunakan Google Chrome</li>
                      <li>• Pelanggaran akan tercatat otomatis</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* BUTTON */}
              <button
                onClick={() => {
                  setShowPanduanModal(false);

                  // mulai sistem ujian
                  setExamStarted(true);

                  setTimeout(() => {
                    setIgnoreFullscreen(false);
                  }, 500);
                }}
                className="
            mt-8
            w-full
            py-4
            rounded-2xl
            bg-gradient-to-r
            from-blue-600
            to-cyan-500
            hover:from-blue-700
            hover:to-cyan-600
            text-white
            font-black
            text-lg
            shadow-xl
            transition
          "
              >
                Saya Mengerti, Mulai Asesmen
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
