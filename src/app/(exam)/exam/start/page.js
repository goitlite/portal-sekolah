"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cekPesan,
  kirimPengaduan,
  catatPelanggaran,
  getPelanggaran,
} from "@/services/authService";

export default function StartExamPage() {
  const router = useRouter();

  const [examLink, setExamLink] = useState("");
  const [nama, setNama] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nama") || "";
    }
    return "";
  });
  const [kelas, setKelas] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kelas") || "";
    }
    return "";
  });
  const [idSiswa, setIdSiswa] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("id_siswa") || "";
    }
    return "";
  });
  const [pesan, setPesan] = useState("");
  const lastDismissedPesanRef = useRef("");
  const lastExecutedCommandRef = useRef("");
  const lockTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const [timeLeft, setTimeLeft] = useState(30 * 60);
  const timerExpiredRef = useRef(false);
  const [loadingPengaduan, setLoadingPengaduan] = useState(false);
  const [violations, setViolations] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [ignoreFullscreen, setIgnoreFullscreen] = useState(false);
  const ignoreFullscreenRef = useRef(false);
  useEffect(() => {
    ignoreFullscreenRef.current = ignoreFullscreen;
  }, [ignoreFullscreen]);
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
  const [pwaRequired, setPwaRequired] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [installFeedback, setInstallFeedback] = useState("");
  const [showManualInstallSteps, setShowManualInstallSteps] = useState(false);
  const [penaltyOpen, setPenaltyOpen] = useState(false);

  const [penaltyTime, setPenaltyTime] = useState(3 * 60);

  const [penaltyDone, setPenaltyDone] = useState(false);

  const [showScrollTop, setShowScrollTop] = useState(false);

  const [showPanduanModal, setShowPanduanModal] = useState(false);

  const [examStarted, setExamStarted] = useState(false);
  // Countdown detik sebelum soal dikunci (null = tidak aktif)
  const [lockCountdown, setLockCountdown] = useState(null);
  // =========================
  // EMERGENCY ACCESS
  // =========================
  const [showEmergencyInput, setShowEmergencyInput] = useState(false);

  const [emergencyCode, setEmergencyCode] = useState("");

  const emergencyPressTimer = useRef(null);

  // =========================
  // KONFIRMASI KELUAR (BACK / RECENT) & FLOATING TOAST NOTIFIKASI
  // =========================
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);
  const [securityToast, setSecurityToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const triggerSecurityToast = useCallback(
    (message, type = "warning", duration = 3000) => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setSecurityToast({ message, type });

      // Haptic feedback getar di smartphone Android (jika didukung)
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(type === "danger" ? [100, 50, 100] : 80);
        }
      } catch (e) {}

      toastTimeoutRef.current = setTimeout(() => {
        setSecurityToast(null);
      }, duration);
    },
    [],
  );

  const armHistoryTrap = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        const targetUrl =
          window.location.pathname + window.location.search + "#ujian";
        // Dua entri cadangan membuat satu Back yang melewati fullscreen
        // tetap tertahan di halaman ujian pada browser Android.
        window.history.pushState(
          { examTrap: true, time: Date.now() },
          "",
          targetUrl,
        );
        window.history.pushState(
          { examTrap: true, time: Date.now() },
          "",
          targetUrl,
        );
      }
    } catch (e) {}
  }, []);

  function isChromeBrowser() {
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (typeof navigator !== "undefined" &&
        navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1);

    // DUKUNGAN RESMI IPHONE / IOS (TETAP AMAN)
    if (isIOS) {
      // Izinkan Safari bawaan, Google Chrome iOS (CriOS), atau WebApp Standalone PWA
      const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
      const isChromeIOS = /CriOS/.test(ua);
      const isStandalone =
        window.navigator.standalone === true ||
        (typeof window !== "undefined" &&
          window.matchMedia("(display-mode: standalone)").matches);

      return isSafari || isChromeIOS || isStandalone;
    }

    // STRUKTUR ASLI ANDROID / DESKTOP (TIDAK BERUBAH SAMA SEKALI)
    // WAJIB ADA CHROMEE
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
      "UCBrowser",
      "MiuiBrowser",
      "HuaweiBrowser",
      "HeyTapBrowser",
      "OPPOBrowser",
    ];

    const isBlocked = blockedBrowsers.some((b) => ua.includes(b));
    const brands = navigator.userAgentData?.brands || [];
    const hasGoogleChromeBrand = brands.some((brand) => brand.brand === "Google Chrome");
    const hasChromiumBrandOnly = brands.some((brand) => brand.brand === "Chromium") && !hasGoogleChromeBrand;

    // Jika User-Agent Client Hints tersedia, wajib ada brand Google Chrome.
    // Ini menolak browser Chromium lain yang menyamarkan token Chrome di UA.
    const clientHintsAllow = brands.length > 0
      ? hasGoogleChromeBrand && !hasChromiumBrandOnly
      : hasChrome && isGoogleVendor && !isBlocked;

    return clientHintsAllow && hasChrome && isGoogleVendor && !isBlocked;
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  // =========================
  // EMERGENCY CODE / BUKA KUNCI WAKTU (KODE KIRIM)
  // =========================
  function handleEmergencySubmit() {
    const savedKodeKirim = (localStorage.getItem("kodeKirim") || "").trim();
    const inputCode = emergencyCode.trim();

    // KODE BENAR: hanya kodeKirim dari spreadsheet asesmen (kode darurat dihapus)
    const isCodeValid =
      savedKodeKirim !== "" &&
      inputCode.toLowerCase() === savedKodeKirim.toLowerCase();

    if (isCodeValid) {
      // Hentikan hitungan mundur auto-lock dan hapus notif
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      setLockCountdown(null);

      // timer langsung habis
      setTimeLeft(0);

      // buka lock soal
      setSoalLocked(false);
      soalLockedRef.current = false;

      // Tutup modal darurat SEBELUM showModal agar tidak ada dua modal sekaligus
      setShowEmergencyInput(false);
      showEmergencyInputRef.current = false;
      setEmergencyCode("");

      // Safe action 5 detik agar transisi dari modal ke layar utama aman
      startSafeAction(5000);

      showModal(
        "✅ KUNCI WAKTU DIBUKA\n\n" +
          "Kode buka kunci waktu berhasil diverifikasi.\n" +
          "Soal dan formulir dapat dikerjakan dan dikirimkan.",
      );

      return;
    }

    // KODE SALAH: Bukan pelanggaran! Sama seperti form pengaduan yang aman
    // Perpanjang safe action agar keyboard dismiss tidak dianggap pelanggaran
    startSafeAction(5000);
    showEmergencyInputRef.current = true;
    triggerSecurityToast(
      "❌ Kode buka kunci waktu tidak sesuai / salah. Silakan coba lagi.",
      "danger",
      4000,
    );
    setEmergencyCode("");
  }

  const fullscreenTimeout = useRef(null);
  const fullscreenReturnTimeoutRef = useRef(null);
  const fullscreenCountdownIntervalRef = useRef(null);
  const fullscreenWasActiveRef = useRef(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const logoutRef = useRef(false);
  const violationGraceTimerRef = useRef(null);
  const pendingViolationRef = useRef("");
  const iframeRef = useRef(null);
  const iframeContainerRef = useRef(null);
  // =========================
  // SAFE OVERLAY ENGINE
  // =========================

  const overlayRiskRef = useRef(0);

  const overlayTriggeredRef = useRef(false);

  const lastBlurAtRef = useRef(0);
  const lastHiddenAtRef = useRef(0);

  const lastViewportHeightRef = useRef(0);
  const blurTimeoutRef = useRef(null);
  const visibilityTimeoutRef = useRef(null);
  const [isWindowUnfocused, setIsWindowUnfocused] = useState(false);
  const [toleranceCountdown, setToleranceCountdown] = useState(null);
  const toleranceIntervalRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const focusTimeoutRef = useRef(null);
  const lastWidthRef = useRef(0);
  const lastHeightRef = useRef(0);
  const suspiciousResizeRef = useRef(0);
  const lastTouchRef = useRef(Date.now());
  const wakeLockRef = useRef(null);

  const keyboardCountRef = useRef(0);
  const keyboardOpenedRef = useRef(false);
  const keyboardTestRef = useRef(null);
  const keyboardGraceRef = useRef(true);

  // Ref untuk membaca soalLocked, penaltyOpen, dan panduan terbaru di dalam event handler (hindari stale closure)
  const soalLockedRef = useRef(false);
  useEffect(() => {
    soalLockedRef.current = soalLocked;
  }, [soalLocked]);

  // Ketika soal dikunci, keluarkan fokus dari Google Form iframe agar
  // keyboard/IME yang masih aktif tidak terus mengirim input ke form.
  useEffect(() => {
    if (!soalLocked) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    try {
      iframe.blur();
      iframe.contentWindow?.blur();
    } catch (_) {
      // contentWindow dapat dibatasi same-origin, iframe.blur tetap dicoba.
    }
  }, [soalLocked]);

  const penaltyOpenRef = useRef(false);
  useEffect(() => {
    penaltyOpenRef.current = penaltyOpen;
  }, [penaltyOpen]);

  const showPanduanModalRef = useRef(false);
  useEffect(() => {
    showPanduanModalRef.current = showPanduanModal;
  }, [showPanduanModal]);

  const examStartedRef = useRef(false);
  useEffect(() => {
    examStartedRef.current = examStarted;
  }, [examStarted]);

  const isModalPengaduanOpenRef = useRef(false);
  useEffect(() => {
    isModalPengaduanOpenRef.current = isModalPengaduanOpen;
  }, [isModalPengaduanOpen]);

  const showEmergencyInputRef = useRef(false);
  useEffect(() => {
    showEmergencyInputRef.current = showEmergencyInput;
  }, [showEmergencyInput]);

  // Ref untuk membaca modalOpen & isConfirmHapusOpen di dalam stale-closure event handler
  const modalOpenRef = useRef(false);
  useEffect(() => {
    modalOpenRef.current = modalOpen;
  }, [modalOpen]);

  const isConfirmHapusOpenRef = useRef(false);
  useEffect(() => {
    isConfirmHapusOpenRef.current = isConfirmHapusOpen;
  }, [isConfirmHapusOpen]);

  // Ref untuk membaca timeLeft & soalLocked terkini di dalam stale-closure event handler
  const timeLeftRef = useRef(30 * 60);
  useEffect(() => {
    timeLeftRef.current = timeLeft;
  }, [timeLeft]);

  // =========================
  // LOAD SESSION
  // =========================
  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    }
    function handleAppInstalled() {
      setDeferredInstallPrompt(null);
      setInstallFeedback(
        "PWA berhasil dipasang. Buka Portal Sekolah dari ikon di layar utama untuk mulai ujian.",
      );
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

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

      const isAndroid = /Android/i.test(navigator.userAgent);
      const isStandalonePwa =
        window.matchMedia("(display-mode: standalone)").matches ||
        navigator.standalone === true;
      if (isAndroid && !isStandalonePwa) {
        setPwaRequired(true);
        return;
      }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

      try {
        if (!isIOS && !document.fullscreenElement) {
          await document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (err) {}

      let savedLink = localStorage.getItem("examLink");
      let savedNama = localStorage.getItem("nama");
      let savedKelas = localStorage.getItem("kelas");
      let savedId = localStorage.getItem("id_siswa") || "";

      // Coba pulihkan dari session magang jika belum ada
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
              if (!savedId && (sess.id || sess.id_siswa)) {
                savedId = String(sess.id || sess.id_siswa).trim();
                localStorage.setItem("id_siswa", savedId);
              }
              localStorage.setItem("nama", savedNama);
              if (savedKelas) localStorage.setItem("kelas", savedKelas);
            }
          }
        } catch (e) {}
      }

      if (!savedNama) {
        router.push("/magang/login");
        return;
      }

      if (!savedLink) {
        router.push("/exam");
        return;
      }

      setExamLink(savedLink);
      setNama(savedNama);
      setKelas(savedKelas || "");
      if (savedId) setIdSiswa(savedId);

      // Ambil pelanggaran dari localStorage (reset hanya via admin / pesan HAPUS PELANGGARAN)
      let savedViolation = parseInt(localStorage.getItem("violations") || "0");

      // Ambil data pelanggaran tersimpan dari spreadsheet database (agar konsisten lintas perangkat)
      try {
        const remoteRes = await getPelanggaran(
          savedNama,
          savedKelas || "",
          savedId,
        );
        if (
          remoteRes &&
          remoteRes.status === "success" &&
          remoteRes.pelanggaran !== undefined
        ) {
          const remoteCount = parseInt(remoteRes.pelanggaran) || 0;
          // SINKRONISASI LENGKAP: Jika di database 0 (direset admin), hapus semua penanda hukuman!
          if (remoteCount === 0) {
            savedViolation = 0;
            localStorage.setItem("violations", "0");
            localStorage.removeItem("violationStartTime");
            localStorage.removeItem("penaltyPassed");
            localStorage.removeItem("lastPenaltyServedAtViolation");
          } else if (remoteCount !== savedViolation) {
            savedViolation = remoteCount;
            localStorage.setItem("violations", String(savedViolation));
          }
        }
      } catch (err) {
        console.error("Gagal sinkron pelanggaran dari database:", err);
      }

      // ==============================================================
      // HUKUMAN: SETIAP SETELAH 3 KALI PELANGGARAN -> HUKUMAN 3 MENIT
      // Kelipatan 3: 3, 6, 9, 12, ...
      // ==============================================================
      const lastPenaltyServed = parseInt(
        localStorage.getItem("lastPenaltyServedAtViolation") || "0",
      );
      const targetTier = Math.floor(savedViolation / 3) * 3;
      // HUKUMAN HANYA AKTIF JIKA savedViolation > 0 dan mencapai kelipatan 3
      const mustServePenalty =
        savedViolation > 0 && targetTier >= 3 && lastPenaltyServed < targetTier;

      if (mustServePenalty) {
        setPenaltyTime(3 * 60);
        setPenaltyDone(false);
        setPenaltyOpen(true);
        setShowPanduanModal(false);
        document.body.style.overflow = "hidden";
      } else {
        setPenaltyOpen(false);
        setPenaltyDone(true);
        document.body.style.overflow = "auto";
        setShowPanduanModal(true);
      }

      setViolations(savedViolation);

      const savedDraft = localStorage.getItem("draftAnswers");
      if (savedDraft) {
        setDraftAnswers(JSON.parse(savedDraft));
      }

      const savedDraftMode = localStorage.getItem("draftMode");
      if (savedDraftMode) {
        setDraftMode(JSON.parse(savedDraftMode));
      }

      startSafeAction(4000);
    }

    init();
  }, []);

  // =========================
  // TIMER HUKUMAN (3 MENIT)
  // =========================
  useEffect(() => {
    if (!penaltyOpen || penaltyDone || violations === 0) return;

    const interval = setInterval(() => {
      setPenaltyTime((prev) => {
        if (prev <= 1) {
          clearInterval(interval);

          setPenaltyDone(true);

          localStorage.setItem("penaltyPassed", "true");
          const curTier = Math.floor(violations / 3) * 3;
          localStorage.setItem(
            "lastPenaltyServedAtViolation",
            String(curTier > 0 ? curTier : 3),
          );

          document.body.style.overflow = "auto";

          setPenaltyOpen(false);
          setShowPanduanModal(false);
          setExamStarted(true);
          setLockCountdown((prev) =>
            prev === null && !soalLocked ? 50 : prev,
          );

          showModal(
            "Waktu hukuman 3 menit selesai.\n\nKlik OK untuk melanjutkan ujian.",
          );

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [penaltyOpen, penaltyDone, violations]);

  function showModal(message) {
    safeActionRef.current = true;
    setIgnoreFullscreen(true);
    setModalMessage(message);
    setModalOpen(true);
    modalOpenRef.current = true;

    // Timeout pengaman agar safeAction tidak macet jika modal ditutup
    setTimeout(() => {
      if (!modalOpenRef.current) {
        safeActionRef.current = false;
        setIgnoreFullscreen(false);
      }
    }, 4000);
  }

  function startSafeAction(duration = 3000) {
    safeActionRef.current = true;
    setIgnoreFullscreen(true);
    setIsWindowUnfocused(false);
    setToleranceCountdown(null);
    lastBlurAtRef.current = 0;
    lastHiddenAtRef.current = 0;
    if (toleranceIntervalRef.current) {
      clearInterval(toleranceIntervalRef.current);
      toleranceIntervalRef.current = null;
    }
    if (visibilityTimeoutRef.current)
      clearTimeout(visibilityTimeoutRef.current);
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);

    setTimeout(() => {
      safeActionRef.current = false;
      setIgnoreFullscreen(false);
    }, duration);
  }

  function forceLogout(reason = "Pelanggaran ujian") {
    if (logoutRef.current || safeActionRef.current) return;
    // Semua sumber pelanggaran masuk satu antrean: satu timer toleransi,
    // satu notifikasi yang diperbarui, dan satu pencatatan akhir.
    pendingViolationRef.current = reason;
    if (violationGraceTimerRef.current) return;
    triggerSecurityToast(
      `⚠️ ${reason}. Kembali ke ujian dalam 3 detik untuk membatalkan pelanggaran.`,
      "warning",
      3000,
    );
    violationGraceTimerRef.current = setTimeout(() => {
      violationGraceTimerRef.current = null;
      if (logoutRef.current || safeActionRef.current) {
        pendingViolationRef.current = "";
        return;
      }
      const finalReason = pendingViolationRef.current || reason;
      pendingViolationRef.current = "";
      logoutRef.current = true;

      const currentViolations = parseInt(
        localStorage.getItem("violations") || "0",
      );
      const totalViolation = currentViolations + 1;
      localStorage.setItem("violations", totalViolation.toString());
      setViolations(totalViolation);

      // Simpan waktu pelanggaran pertama kali jika belum ada
      if (!localStorage.getItem("violationStartTime")) {
        localStorage.setItem("violationStartTime", Date.now().toString());
      }
      // Setiap kelipatan 3 pelanggaran (3, 6, 9, 12, ...), hapus penanda agar hukuman 3 menit aktif
      if (totalViolation >= 3 && totalViolation % 3 === 0) {
        localStorage.removeItem("penaltyPassed");
      }

      // Catat ke spreadsheet database secara otomatis
      try {
        const currentId = idSiswa || localStorage.getItem("id_siswa") || "";
        catatPelanggaran(nama, kelas, currentId, totalViolation);
      } catch (e) {
        console.error("Gagal catat pelanggaran:", e);
      }

      showModal(finalReason + "\nTotal pelanggaran: " + totalViolation);

      setTimeout(() => {
        localStorage.removeItem("examLink");
        router.push("/exam");
      }, 2000);
    }, 3000);
  }

  // [DIHAPUS] LIVE AUTO RESET PELANGGARAN (80 MENIT)
  // Reset pelanggaran hanya bisa dilakukan admin via pesan "HAPUS PELANGGARAN"

  // =========================
  // CEK PESAN REALTIME & COMMAND ADMIN (REC-1 & REC-2)
  // =========================
  useEffect(() => {
    async function checkMessages() {
      try {
        const activeNama = localStorage.getItem("nama") || nama || "";
        const activeKelas =
          localStorage.getItem("kelas") ||
          localStorage.getItem("selectedKelas") ||
          kelas ||
          "";
        if (!activeNama) return;

        const result = await cekPesan(activeNama, activeKelas);

        if (result && result.status === "success") {
          const isiPesan = (result.pesan || "").trim();

          // 1. Sinkronisasi info pelanggaran terbaru dari database (bisa naik atau turun ke 0)
          if (result.pelanggaran !== undefined && result.pelanggaran !== null) {
            const remoteCount = parseInt(result.pelanggaran) || 0;
            if (remoteCount === 0) {
              setViolations(0);
              localStorage.setItem("violations", "0");
              localStorage.removeItem("violationStartTime");
              localStorage.removeItem("penaltyPassed");
              localStorage.removeItem("lastPenaltyServedAtViolation");
              setPenaltyOpen(false);
              setPenaltyDone(true);
              document.body.style.overflow = "auto";
              setShowPanduanModal(false);
              if (!examStartedRef.current) {
                setExamStarted(true);
              }
            } else {
              setViolations((prev) => {
                if (remoteCount !== prev) {
                  localStorage.setItem("violations", String(remoteCount));
                  return remoteCount;
                }
                return prev;
              });
            }
          }

          // 2. REC-1: Tampilkan pesan HANYA jika ada dan berbeda dari pesan yang ditutup siswa
          if (isiPesan) {
            if (isiPesan !== lastDismissedPesanRef.current) {
              setPesan(isiPesan);
            }
          } else {
            // Jika pesan dikosongkan oleh admin di server, reset tracker
            lastDismissedPesanRef.current = "";
            lastExecutedCommandRef.current = "";
            setPesan("");
          }

          // 3. REC-2: PERINTAH BUKA KUNCI & MANAJEMEN VIA PESAN ADMIN (fleksibel & responsif)
          const pesanUpper = isiPesan.toUpperCase();
          if (pesanUpper && lastExecutedCommandRef.current !== pesanUpper) {
            lastExecutedCommandRef.current = pesanUpper;
            if (pesanUpper === "UJIAN DI RESET" || pesanUpper === "RESET") {
              showModal("Ujian telah direset oleh admin");
              setTimeout(() => {
                localStorage.removeItem("examLink");
                router.push("/exam");
              }, 2000);
            } else if (
              pesanUpper.includes("BUKA") ||
              pesanUpper === "BUKA KUNCI"
            ) {
              // Hentikan hitungan mundur auto-lock dan hapus notif
              if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
              if (countdownIntervalRef.current)
                clearInterval(countdownIntervalRef.current);
              setLockCountdown(null);

              setTimeLeft(0);
              setSoalLocked(false);
              soalLockedRef.current = false;
              startSafeAction(5000);
              showModal(
                "✅ KUNCI WAKTU DIBUKA\n\n" +
                  "Pengawas / Guru telah membuka kunci ujian.\n" +
                  "Soal dan formulir sekarang dapat dikerjakan dan dikirimkan.",
              );
            } else if (
              pesanUpper.includes("HAPUS PELANGGARAN") ||
              pesanUpper === "CLEAR"
            ) {
              setViolations(0);
              localStorage.setItem("violations", "0");
              localStorage.removeItem("violationStartTime");
              localStorage.removeItem("penaltyPassed");
              localStorage.removeItem("lastPenaltyServedAtViolation");
              setPenaltyOpen(false);
              setPenaltyDone(true);
              document.body.style.overflow = "auto";
              setShowPanduanModal(false);
              if (!examStartedRef.current) {
                setExamStarted(true);
              }
              const currentId =
                idSiswa || localStorage.getItem("id_siswa") || "";
              catatPelanggaran(activeNama, activeKelas, currentId, 0);
              showModal(
                "✅ CATATAN PELANGGARAN DIRESET\n\n" +
                  "Semua catatan pelanggaran Anda telah direset menjadi 0 oleh admin.\n" +
                  "Waktu ujian dan pengerjaan soal telah dimulai kembali.",
              );
            } else if (pesanUpper === "KUNCI SOAL" || pesanUpper === "KUNCI") {
              setSoalLocked(true);
              soalLockedRef.current = true;
              showModal(
                "🔒 SOAL DIKUNCI\n\n" +
                  "Akses pengisian formulir soal telah dikunci oleh pengawas / admin.",
              );
            } else if (/TAMBAH WAKTU \d+/.test(pesanUpper)) {
              const match = pesanUpper.match(/TAMBAH WAKTU (\d+)/);
              const menit = match ? parseInt(match[1]) : 0;
              if (menit > 0) {
                timerExpiredRef.current = false;
                setTimeLeft((prev) => prev + menit * 60);
                showModal(
                  `⏱️ WAKTU DITAMBAH\n\n` +
                    `Waktu ujian Anda telah ditambah sebanyak ${menit} menit oleh pengawas / admin.`,
                );
              }
            }
          }
        }
      } catch (err) {
        console.error("Gagal cek pesan realtime:", err);
      }
    }

    checkMessages();
    const interval = setInterval(checkMessages, 3500);

    return () => clearInterval(interval);
  }, [nama, kelas, idSiswa]);

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

  // =========================
  // RESET SCROLL FORM KE PALING ATAS SETIAP HALAMAN BERPINDAH / SUBMIT
  // =========================
  function handleIframeLoad() {
    const scrollToTop = () => {
      if (iframeContainerRef.current) {
        iframeContainerRef.current.scrollTop = 0;
      }
      window.scrollTo(0, 0);
    };

    scrollToTop();
    setTimeout(scrollToTop, 100);
    setTimeout(scrollToTop, 300);
    setTimeout(scrollToTop, 600);
  }

  function handleKeluar() {
    if (timeLeft > 0) {
      showModal(
        "⏱️ Anda tidak bisa keluar sampai waktu habis!\n\nTombol Keluar akan tersedia setelah 30 menit.",
      );
      return;
    }

    // RESET SEMUA DATA SAAT KELUAR RESMI
    localStorage.removeItem("violations");
    localStorage.removeItem("violationStartTime");
    localStorage.removeItem("penaltyPassed");
    localStorage.removeItem("lastPenaltyServedAtViolation");
    localStorage.removeItem("draftAnswers");
    localStorage.removeItem("draftMode");

    setViolations(0);
    const currentId = idSiswa || localStorage.getItem("id_siswa") || "";
    catatPelanggaran(nama, kelas, currentId, 0);

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
    fullscreenWasActiveRef.current = Boolean(document.fullscreenElement);

    function handleFullscreenChange() {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      // Di iPhone, Fullscreen API standar HTML5 tidak didukung oleh Apple WebKit
      if (isIOS) return;

      clearTimeout(fullscreenTimeout.current);
      if (document.fullscreenElement) {
        fullscreenWasActiveRef.current = true;
        clearTimeout(fullscreenReturnTimeoutRef.current);
        clearInterval(fullscreenCountdownIntervalRef.current);
        setShowFullscreenPrompt(false);
        setToleranceCountdown(null);
        return;
      }
      // Jangan membuat prompt atau pelanggaran jika browser tidak pernah
      // berhasil masuk fullscreen (misalnya izin/API tidak tersedia).
      if (
        !fullscreenWasActiveRef.current ||
        typeof document.documentElement.requestFullscreen !== "function"
      ) {
        return;
      }
      if (logoutRef.current || document.fullscreenElement) return;
      setShowFullscreenPrompt(true);
      setToleranceCountdown(3);
      const startedAt = Date.now();
      clearInterval(fullscreenCountdownIntervalRef.current);
      fullscreenCountdownIntervalRef.current = setInterval(() => {
        const remaining = Math.max(
          0,
          3 - Math.floor((Date.now() - startedAt) / 1000),
        );
        setToleranceCountdown(remaining);
        if (remaining <= 0)
          clearInterval(fullscreenCountdownIntervalRef.current);
      }, 250);
      clearTimeout(fullscreenReturnTimeoutRef.current);
      fullscreenReturnTimeoutRef.current = setTimeout(() => {
        if (!document.fullscreenElement) {
          setShowFullscreenPrompt(false);
          forceLogout("Anda keluar dari fullscreen");
        }
      }, 3000);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      clearTimeout(fullscreenTimeout.current);
      clearTimeout(fullscreenReturnTimeoutRef.current);
      clearInterval(fullscreenCountdownIntervalRef.current);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // =========================
  // BLOK BACK BUTTON — KONSISTEN & STABIL PADA HP (POPSTATE TRAP)
  // =========================
  useEffect(() => {
    // Pasang trap awal (dua kali agar stack history selalu memiliki buffer cadangan)
    armHistoryTrap();

    // Re-arm history trap pada setiap sentuhan / klik user agar browser di HP tidak pernah melewati trap
    function handleUserInteraction() {
      try {
        if (
          typeof window !== "undefined" &&
          !window.location.hash.includes("ujian")
        ) {
          armHistoryTrap();
        }
      } catch (e) {}
    }

    window.addEventListener("touchstart", handleUserInteraction, {
      passive: true,
    });
    window.addEventListener("click", handleUserInteraction, { passive: true });

    function handleBackNavigation() {
      if (logoutRef.current) return;

      // Saat hukuman berlangsung, Back berarti keluar dari ujian tanpa
      // menambah pelanggaran. Jangan memasang ulang history trap pada kasus ini.
      if (penaltyOpenRef.current) {
        logoutRef.current = true;
        document.body.style.overflow = "auto";
        localStorage.removeItem("examLink");
        router.replace("/exam");
        return;
      }

      // Back dapat membuat browser keluar dari fullscreen sebelum dialog tampil.
      // Tandai transisi ini aman segera agar fullscreenchange tidak salah
      // mencatatnya sebagai pelanggaran dan notifikasi Back tetap konsisten.
      startSafeAction(3000);

      // Re-arm hash SEGERA agar back berikutnya selalu tertangkap lagi
      armHistoryTrap();
      // Sebagian browser Android mengirim popstate setelah animasi fullscreen.
      // Pasang ulang trap setelah event selesai agar stack tidak habis.
      setTimeout(armHistoryTrap, 0);

      const isIOS =
        /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isStandalonePwa =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        navigator.standalone === true;

      // In-app PWA sudah berjalan tanpa chrome browser. Di browser biasa,
      // satu Back dari fullscreen langsung menampilkan tombol pemulihan.
      if (
        !isIOS &&
        !isStandalonePwa &&
        !document.fullscreenElement &&
        typeof document.documentElement.requestFullscreen === "function"
      ) {
        setShowFullscreenPrompt(true);
        setToleranceCountdown(3);
        return;
      }

      // 1. Jika modal pengaduan terbuka, tekan back = tutup modal pengaduan dengan aman
      if (isModalPengaduanOpenRef.current) {
        setIsModalPengaduanOpen(false);
        setIgnoreFullscreen(false);
        startSafeAction(2000);
        triggerSecurityToast("ℹ️ Form pengaduan ditutup.", "info", 2000);
        return;
      }

      // 1b. Jika modal buka kunci waktu terbuka, tekan back = tutup modal darurat dengan aman
      if (showEmergencyInputRef.current) {
        setShowEmergencyInput(false);
        showEmergencyInputRef.current = false;
        setEmergencyCode("");
        setIgnoreFullscreen(false);
        startSafeAction(2000);
        triggerSecurityToast("ℹ️ Menu buka kunci waktu ditutup.", "info", 2000);
        return;
      }

      // Jika modal panduan aktif, beri toast peringatan
      if (showPanduanModalRef.current) {
        triggerSecurityToast(
          "⚠️ Anda berada di sesi asesmen. Selesaikan langkah pada layar.",
          "warning",
        );
        return;
      }

      // 3. Jika dialog konfirmasi sedang terbuka → tekan back lagi = tutup dialog & tetap di asesmen
      if (exitConfirmRef.current) {
        setShowExitConfirm(false);
        exitConfirmRef.current = false;
        overlayRiskRef.current = 0;
        overlayTriggeredRef.current = false;
        suspiciousResizeRef.current = 0;
        startSafeAction(2000);
        triggerSecurityToast("✅ Tetap melanjutkan asesmen.", "success", 2500);

        const isIOS =
          /iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (typeof navigator !== "undefined" &&
            navigator.platform === "MacIntel" &&
            navigator.maxTouchPoints > 1);
        if (!isIOS && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
        return;
      }

      // 4. Kondisi normal: Tampilkan notifikasi toast & dialog konfirmasi keluar
      triggerSecurityToast(
        "⚠️ Peringatan: Tombol Kembali / Back terdeteksi!",
        "warning",
        4000,
      );
      setIgnoreFullscreen(true);
      setShowExitConfirm(true);
      exitConfirmRef.current = true;
    }

    window.addEventListener("popstate", handleBackNavigation);
    return () => {
      window.removeEventListener("touchstart", handleUserInteraction);
      window.removeEventListener("click", handleUserInteraction);
      window.removeEventListener("popstate", handleBackNavigation);
    };
  }, [armHistoryTrap, router, triggerSecurityToast]);

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
          if (prev > 0 && !timerExpiredRef.current) {
            timerExpiredRef.current = true;
            showModal("⏰ Waktu ujian habis! Tombol Submit sekarang tersedia.");
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [examStarted]);

  // =========================
  // AUTO LOCK SOAL SETELAH 50 DETIK + NOTIF COUNTDOWN
  // =========================
  useEffect(() => {
    // Jika ujian belum mulai atau soal sudah terkunci, abaikan
    if (!examStarted || soalLocked) {
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      return;
    }

    // Hitung mundur berbasis wall-clock timestamp (tahan freeze browser/Android)
    const startTime = Date.now();
    const duration = 50 * 1000;

    const initCountdownTimer = setTimeout(() => {
      setLockCountdown(50);
    }, 0);

    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (countdownIntervalRef.current)
      clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      setLockCountdown(remaining);

      if (remaining <= 0) {
        if (countdownIntervalRef.current)
          clearInterval(countdownIntervalRef.current);
      }
    }, 1000);

    lockTimerRef.current = setTimeout(() => {
      setLockCountdown(null);
      setSoalLocked(true);
      soalLockedRef.current = true;

      showModal(
        "🔒 Waktu pengisian data telah selesai (50 detik).\n\n" +
          "Soal sekarang dikunci otomatis.\n\n" +
          "Silahkan kerjakan jawaban pada panel DRAFT di samping layar.\n\n" +
          "Setelah waktu asesmen 30 menit selesai:\n" +
          "1. Salin kembali jawaban draft ke Google Form\n" +
          "2. Periksa jawaban\n" +
          "3. Tekan tombol Kirim/Submit",
      );
    }, duration);

    return () => {
      clearTimeout(initCountdownTimer);
      if (countdownIntervalRef.current)
        clearInterval(countdownIntervalRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
      setLockCountdown(null);
    };
  }, [examStarted, soalLocked]);

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
          modalOpenRef.current = false;
          startSafeAction(2000);

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
        // MODAL DARURAT
        if (showEmergencyInputRef.current) {
          setShowEmergencyInput(false);
          showEmergencyInputRef.current = false;
          setEmergencyCode("");
          startSafeAction(2000);

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

      // ===============================================================
      // 1. BLOKIR MUTLAK TOMBOL BERBAHAYA KAPAN PUN (SEPANJANG UJIAN)
      //    Aktif baik sebelum 1m 30s maupun setelah Buka Kunci Waktu!
      // ===============================================================
      // Android tidak memiliki Developer Tools browser biasa; tombol/shortcut
      // pada keyboard eksternal tidak boleh mengganggu jalannya ujian.
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isDangerous =
        !isAndroid &&
        (e.key === "F12" ||
          e.key === "F11" ||
          (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
          ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") ||
          (e.altKey && e.key === "Tab"));

      if (isDangerous) {
        e.preventDefault();
        e.stopPropagation();
        forceLogout("Akses terlarang terdeteksi (F12/DevTools/Alt+Tab)!");
        return;
      }

      // ===============================================================
      // 2. BLOKIR SHORTCUT CONTEK: COPY, PASTE, CUT, SELECT-ALL, PRINT, SAVE
      // ===============================================================
      if (
        (e.ctrlKey || e.metaKey) &&
        ["c", "v", "x", "a", "p", "s"].includes(e.key.toLowerCase())
      ) {
        if (!isModalPengaduanOpen) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
      }

      // Tombol Scroll navigasi selalu diizinkan
      const allowedScroll = [
        "ArrowUp",
        "ArrowDown",
        "PageUp",
        "PageDown",
        "Home",
        "End",
      ];
      if (allowedScroll.includes(e.key)) return;

      // Izinkan ketik di modal darurat & modal pengaduan
      if (
        showEmergencyInputRef.current &&
        document.activeElement?.tagName === "INPUT"
      ) {
        return;
      }
      if (
        isModalPengaduanOpenRef.current &&
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Selama soal dikunci (setelah 50s), blokir semua input keyboard lainnya
      if (soalLockedRef.current) {
        e.preventDefault();
      }
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

      // Di HP (Android / iOS) outerHeight & innerHeight dinamis karena status/navigation bar
      const isMobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      if (isMobile) return;

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
    // ======================
    // GRACE PERIOD
    // AGAR TRANSISI DARI TOKEN
    // TIDAK TERDETEKSI
    // ======================

    keyboardGraceRef.current = true;

    setTimeout(() => {
      keyboardGraceRef.current = false;
    }, 4000);

    lastWidthRef.current = window.innerWidth;
    lastHeightRef.current = window.innerHeight;
    lastViewportHeightRef.current = window.innerHeight;

    function triggerViolation(reason) {
      if (logoutRef.current) return;

      if (safeActionRef.current) return;

      forceLogout(reason);
    }
    // ======================
    // SAFE OVERLAY RISK
    // ======================

    function addOverlayRisk(score, reason) {
      if (logoutRef.current) return;

      if (safeActionRef.current) return;

      if (
        modalOpenRef.current ||
        isModalPengaduanOpenRef.current ||
        isConfirmHapusOpenRef.current
      ) {
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
    // BLUR - Deteksi fokus keluar dari window (Toleransi Panggilan / Notif / Floating App / Kalkulator)
    // ======================
    function handleBlur() {
      // Jika ujian belum dimulai (panduan terbuka / hukuman aktif), abaikan
      if (
        !examStartedRef.current ||
        showPanduanModalRef.current ||
        penaltyOpenRef.current
      )
        return;
      if (logoutRef.current || safeActionRef.current) return;
      if (
        modalOpenRef.current ||
        isModalPengaduanOpenRef.current ||
        isConfirmHapusOpenRef.current ||
        showEmergencyInputRef.current
      )
        return;

      const isIframeFocused =
        iframeRef.current && document.activeElement === iframeRef.current;

      // Jika dokumen masih memegang fokus dan hanya berpindah ke iframe Google Form
      if (document.hasFocus() && isIframeFocused) {
        lastBlurAtRef.current = 0;
        return;
      }

      // Catat waktu blur seketika tanpa jeda (wall-clock timestamp instan)
      const blurTime = Date.now();
      if (!lastBlurAtRef.current) {
        lastBlurAtRef.current = blurTime;
      }

      // Tampilkan blur overlay & hitungan mundur 3 detik
      setIsWindowUnfocused(true);
      setToleranceCountdown(3);

      if (toleranceIntervalRef.current) {
        clearInterval(toleranceIntervalRef.current);
        toleranceIntervalRef.current = null;
      }
      toleranceIntervalRef.current = setInterval(() => {
        setToleranceCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (toleranceIntervalRef.current) {
              clearInterval(toleranceIntervalRef.current);
              toleranceIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      triggerSecurityToast(
        "🚨 Jendela ujian kehilangan fokus / Recent apps aktif! Sisa toleransi: 3 detik.",
        "danger",
        3000,
      );

      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = setTimeout(() => {
        if (
          !document.hasFocus() &&
          !safeActionRef.current &&
          !logoutRef.current
        ) {
          if (
            modalOpenRef.current ||
            isModalPengaduanOpenRef.current ||
            isConfirmHapusOpenRef.current ||
            showEmergencyInputRef.current
          )
            return;
          triggerViolation(
            "Aplikasi lain / floating window / kalkulator aktif > 3 detik",
          );
        }
      }, 3200); // Toleransi ketat 3.2 detik
    }

    // ======================
    // FOCUS - Deteksi ketika fokus kembali (cegah false positive iframe & hilangkan blur)
    // ======================
    function handleFocus() {
      if (toleranceIntervalRef.current) {
        clearInterval(toleranceIntervalRef.current);
        toleranceIntervalRef.current = null;
      }
      clearTimeout(blurTimeoutRef.current);
      clearTimeout(visibilityTimeoutRef.current);

      const now = Date.now();
      const blurDuration =
        lastBlurAtRef.current > 0 ? now - lastBlurAtRef.current : 0;
      const hiddenDuration =
        lastHiddenAtRef.current > 0 ? now - lastHiddenAtRef.current : 0;
      const awayDuration = Math.max(blurDuration, hiddenDuration);

      lastBlurAtRef.current = 0;
      lastHiddenAtRef.current = 0;

      setIsWindowUnfocused(false);
      setToleranceCountdown(null);

      // Jika user berada di luar fokus > 3.2 detik (misal membuka kalkulator / aplikasi lain)
      if (awayDuration > 3200) {
        forceLogout(
          `Jendela ujian ditinggalkan selama ${Math.round(awayDuration / 1000)} detik (batas toleransi 3 detik)`,
        );
        return;
      }

      // Jika kembali dalam toleransi sah (< 3.2 detik), reset total akumulasi risiko
      if (awayDuration <= 3200 && awayDuration > 300) {
        overlayRiskRef.current = 0;
        overlayTriggeredRef.current = false;
        suspiciousResizeRef.current = 0;
        triggerSecurityToast(
          "✅ Fokus kembali ke lembar ujian (Aman).",
          "success",
          2500,
        );
      }
    }

    // ======================
    // VISIBILITY - Toleransi 3 Detik (Panggilan) + Proteksi Tombol Recent / Tab Switch / Buka App Lain
    // ======================
    function handleVisibility() {
      // Jika ujian belum dimulai (panduan terbuka / hukuman aktif), abaikan
      if (
        !examStartedRef.current ||
        showPanduanModalRef.current ||
        penaltyOpenRef.current
      )
        return;

      if (document.hidden) {
        addOverlayRisk(40, "Document Hidden");

        const hiddenTime = Date.now();
        if (!lastHiddenAtRef.current) {
          lastHiddenAtRef.current = hiddenTime;
        }

        setIsWindowUnfocused(true);
        setToleranceCountdown(3);

        if (toleranceIntervalRef.current)
          clearInterval(toleranceIntervalRef.current);
        toleranceIntervalRef.current = setInterval(() => {
          setToleranceCountdown((prev) => {
            if (prev === null || prev <= 1) {
              if (toleranceIntervalRef.current)
                clearInterval(toleranceIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        triggerSecurityToast(
          "🚨 Meninggalkan aplikasi terdeteksi! Segera kembali dalam 3 detik.",
          "danger",
          3000,
        );

        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = setTimeout(() => {
          if (document.hidden) {
            triggerViolation(
              "Anda meninggalkan halaman ujian (pindah tab / aplikasi kalkulator / recent > 3 detik)",
            );
          }
        }, 3000); // Toleransi ketat 3 detik
      } else {
        if (toleranceIntervalRef.current)
          clearInterval(toleranceIntervalRef.current);
        clearTimeout(visibilityTimeoutRef.current);
        clearTimeout(blurTimeoutRef.current);

        const now = Date.now();
        const blurDuration =
          lastBlurAtRef.current > 0 ? now - lastBlurAtRef.current : 0;
        const hiddenDuration =
          lastHiddenAtRef.current > 0 ? now - lastHiddenAtRef.current : 0;
        const awayDuration = Math.max(blurDuration, hiddenDuration);

        lastHiddenAtRef.current = 0;
        lastBlurAtRef.current = 0;

        // CEK WALL-CLOCK TIMESTAMP: Jika siswa meninggalkan halaman ujian > 3.2 detik
        // (Browser membekukan timer setTimeout saat di background, sehingga wall-clock check ini mutlak!)
        if (awayDuration > 3200) {
          setIsWindowUnfocused(false);
          setToleranceCountdown(null);
          forceLogout(
            `Anda meninggalkan halaman ujian selama ${Math.round(awayDuration / 1000)} detik (batas toleransi 3 detik)`,
          );
          return;
        }

        // Siswa kembali ke ujian tepat waktu dalam toleransi < 3.2 detik
        setIsWindowUnfocused(false);
        setToleranceCountdown(null);

        // RESET TOTAL RISIKO & INDIKATOR CURIGA
        overlayRiskRef.current = 0;
        overlayTriggeredRef.current = false;
        suspiciousResizeRef.current = 0;

        // Reset exit confirm jika siswa kembali dari Recent
        if (exitConfirmRef.current) {
          setShowExitConfirm(false);
          exitConfirmRef.current = false;
        }

        // Pasang ulang history state agar tombol back tetap tertangkap setelah kembali dari Recent
        armHistoryTrap();

        // Tampilkan notifikasi peringatan bahwa Recent terdeteksi dan berhasil kembali tepat waktu
        triggerSecurityToast(
          "⚠️ Peringatan: Pindah Aplikasi terdeteksi! (Kembali tepat waktu: Aman).",
          "warning",
          3000,
        );

        // Beri jeda safeAction singkat (800ms) agar transisi animasi kembali tidak memicu false positive
        safeActionRef.current = true;
        setTimeout(() => {
          safeActionRef.current = false;
        }, 800);
      }
    }

    function handlePageHide() {
      if (!safeActionRef.current) {
        triggerViolation("Anda meninggalkan halaman ujian");
      }
    }

    // ======================
    // RESIZE DETECTION
    // ======================
    function handleResize() {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      // Di iPhone tidak ada fitur split-screen/floating apps; resize dinamis terjadi karena address bar Safari
      if (isIOS) return;

      if (safeActionRef.current) return;

      if (
        modalOpenRef.current ||
        isModalPengaduanOpenRef.current ||
        isConfirmHapusOpenRef.current
      ) {
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

          if (suspiciousResizeRef.current >= 2) {
            triggerViolation("Split screen / floating mode terdeteksi");
            suspiciousResizeRef.current = 0;
          }
        } else {
          suspiciousResizeRef.current = 0;
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
    // VISUAL VIEWPORT (Android) - DETEKSI DOCKED & FLOATING KEYBOARD
    // ======================
    function handleViewport() {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      // iOS memakai ukuran visual viewport untuk mengenali keyboard docked.
      if (isIOS) {
        if (!window.visualViewport) return;
        // Jangan menganggap keyboard untuk formulir pengaduan/kode darurat
        // atau transisi aman sebagai pelanggaran.
        if (
          keyboardGraceRef.current ||
          safeActionRef.current ||
          isModalPengaduanOpenRef.current ||
          showEmergencyInputRef.current ||
          modalOpenRef.current ||
          isConfirmHapusOpenRef.current ||
          document.activeElement?.tagName === "INPUT" ||
          document.activeElement?.tagName === "TEXTAREA"
        ) {
          return;
        }
        const iosKeyboardOpen =
          window.innerHeight - window.visualViewport.height > 120;
        if (!iosKeyboardOpen) {
          keyboardOpenedRef.current = false;
          return;
        }
        if (keyboardOpenedRef.current) return;
        keyboardOpenedRef.current = true;
        if (soalLockedRef.current) {
          forceLogout("Keyboard dibuka saat soal terkunci");
        }
        return;
      }

      if (keyboardGraceRef.current) {
        return;
      }

      // JIKA SEDANG DI DALAM MODAL RESMI (Pengaduan / Buka Kunci Waktu) ATAU SAFE ACTION:
      // Keyboard sepenuhnya aman dan diizinkan, sama seperti tombol pengaduan yang aman
      if (
        isModalPengaduanOpenRef.current ||
        showEmergencyInputRef.current ||
        safeActionRef.current ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "INPUT"
      ) {
        return;
      }

      if (!window.visualViewport) return;

      const viewportWidth = window.visualViewport.width;
      const viewportHeight = window.visualViewport.height;
      const currentHeight = window.innerHeight;
      lastViewportHeightRef.current = currentHeight;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const widthRatio = viewportWidth / screenWidth;
      const heightRatio = viewportHeight / screenHeight;
      const keyboardDiff = Math.max(
        currentHeight - viewportHeight,
        lastHeightRef.current > 0 ? lastHeightRef.current - viewportHeight : 0,
        lastHeightRef.current > 0 ? lastHeightRef.current - currentHeight : 0,
        screenHeight - viewportHeight - 60,
      );
      const widthShrink = viewportWidth < window.innerWidth * 0.9;
      const isDockedKeyboard = keyboardDiff > 100;
      const isFloatingKeyboard =
        (keyboardDiff > 25 && keyboardDiff <= 100) ||
        (widthShrink && keyboardDiff > 10);
      const anyKeyboardOpen = isDockedKeyboard || isFloatingKeyboard;

      // ======================
      // Keyboard tidak dihitung sebagai pelanggaran selama 50 detik pertama.
      // Setelah soal terkunci, keyboard yang terdeteksi menjadi satu pelanggaran.
      // ======================
      if (anyKeyboardOpen) {
        if (keyboardOpenedRef.current) return;
        keyboardOpenedRef.current = true;
        if (soalLockedRef.current) {
          forceLogout(
            isFloatingKeyboard
              ? "Floating Keyboard terdeteksi di area ujian"
              : "Membuka keyboard standar tanpa izin saat soal terkunci",
          );
          return;
        }
        return;
      }
      keyboardOpenedRef.current = false;

      if (safeActionRef.current) return;

      // DETEKSI SPLIT SCREEN / FLOATING WINDOW APLIKASI LAIN
      if (!anyKeyboardOpen && (widthRatio < 0.88 || heightRatio < 0.8)) {
        setSoalLocked(true);
        soalLockedRef.current = true;
        showModal(
          "❌ Pelanggaran Berat: Split screen atau Floating Window aplikasi lain terdeteksi. Akses ujian langsung dikunci!",
        );
        triggerViolation("Floating window / split screen terdeteksi");
      }
    }

    // Deteksi pergeseran viewport Android akibat floating overlay / floating keyboard
    function handleViewportScroll() {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      if (isIOS || keyboardGraceRef.current || safeActionRef.current) return;
      if (!window.visualViewport) return;
      if (
        isModalPengaduanOpenRef.current ||
        showEmergencyInputRef.current ||
        safeActionRef.current
      ) {
        return;
      }

      if (
        window.visualViewport.offsetTop > 15 ||
        window.visualViewport.pageTop > 15
      ) {
        setSoalLocked(true);
        soalLockedRef.current = true;
        showModal(
          "❌ Pelanggaran Berat: Terdeteksi pergeseran layar / Floating overlay. Akses ujian langsung dikunci!",
        );
        triggerViolation("Floating overlay / pergeseran layar terdeteksi");
      }
    }

    // Auto decay risiko overlay setiap 3 detik agar tidak terakumulasi secara permanen
    const decayInterval = setInterval(() => {
      if (overlayRiskRef.current > 0) {
        overlayRiskRef.current = Math.max(0, overlayRiskRef.current - 15);
      }
    }, 3000);

    // Watchdog pemeriksa fokus berkala (250ms)
    // Menjamin deteksi kehilangan fokus di semua browser/OS (Windows key, Start menu, taskbar, Alt+Tab, Split screen)
    // bahkan jika fokus sebelumnya berada di dalam iframe Google Form
    const focusWatchdog = setInterval(() => {
      if (logoutRef.current || safeActionRef.current) return;
      if (
        modalOpenRef.current ||
        isModalPengaduanOpenRef.current ||
        isConfirmHapusOpenRef.current ||
        showEmergencyInputRef.current
      )
        return;
      if (
        !examStartedRef.current ||
        showPanduanModalRef.current ||
        penaltyOpenRef.current
      )
        return;

      const hasFocus = document.hasFocus();

      if (!hasFocus) {
        // Jika belum tercatat blur, jalankan handleBlur
        if (!lastBlurAtRef.current) {
          handleBlur();
        } else {
          // Jika sudah tercatat blur dan melebihi batas toleransi 3.2 detik
          const awayTime = Date.now() - lastBlurAtRef.current;
          if (awayTime > 3200) {
            forceLogout(
              `Jendela ujian ditinggalkan selama ${Math.round(awayTime / 1000)} detik (batas toleransi 3 detik)`,
            );
          }
        }
      } else {
        // Jika fokus telah kembali ke halaman/iframe
        if (lastBlurAtRef.current > 0) {
          handleFocus();
        }
      }
    }, 250);

    // EVENT LISTENER
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientation);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewport);
      window.visualViewport.addEventListener("scroll", handleViewportScroll);
    }

    return () => {
      clearInterval(decayInterval);
      clearInterval(focusWatchdog);
      if (toleranceIntervalRef.current)
        clearInterval(toleranceIntervalRef.current);
      clearTimeout(blurTimeoutRef.current);
      clearTimeout(visibilityTimeoutRef.current);
      clearTimeout(resizeTimeoutRef.current);

      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientation);

      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewport);
        window.visualViewport.removeEventListener(
          "scroll",
          handleViewportScroll,
        );
      }
    };
  }, []);

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

  // [DIHAPUS] DETEKSI TAB FREEZE
  // Redundan dengan visibilitychange + blur + touch heartbeat.
  // Berpotensi false positive di HP lambat (GC pause > 20 detik).

  // =========================
  // BLOCK LONG PRESS MOBILE & CLIPBOARD CONTEK GLOBAL
  // =========================
  useEffect(() => {
    function preventContextMenu(e) {
      e.preventDefault();
    }

    function handleGlobalPaste(e) {
      if (isModalPengaduanOpen) return;
      e.preventDefault();
      e.stopPropagation();
      forceLogout("Aksi Paste / tempel teks dari clipboard terdeteksi!");
    }

    function handleGlobalCopy(e) {
      if (isModalPengaduanOpen) return;
      e.preventDefault();
      e.stopPropagation();
    }

    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("paste", handleGlobalPaste, true);
    document.addEventListener("copy", handleGlobalCopy, true);
    document.addEventListener("cut", handleGlobalCopy, true);

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("paste", handleGlobalPaste, true);
      document.removeEventListener("copy", handleGlobalCopy, true);
      document.removeEventListener("cut", handleGlobalCopy, true);
    };
  }, [isModalPengaduanOpen]);

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

      if (ignoreFullscreenRef.current) return;

      if (safeActionRef.current) return;

      // jangan cek saat modal aktif
      if (modalOpenRef.current) return;

      if (isModalPengaduanOpenRef.current) return;

      if (isConfirmHapusOpenRef.current) return;

      if (showEmergencyInputRef.current) return;

      // Jangan cek jika ujian belum dimulai atau panduan/hukuman terbuka
      if (
        !examStartedRef.current ||
        showPanduanModalRef.current ||
        penaltyOpenRef.current
      )
        return;

      const now = Date.now();

      const idleTime = now - lastTouchRef.current;
      const isIframeFocused =
        iframeRef.current && document.activeElement === iframeRef.current;

      // jika tidak fokus + tidak ada touch (dan siswa sedang tidak aktif mengisi form di iframe)
      if (idleTime > 6000 && !document.hasFocus() && !isIframeFocused) {
        forceLogout("Floating window / aplikasi lain terdeteksi");
      }
    }, 1500);

    return () => {
      clearInterval(interval);

      window.removeEventListener("touchstart", updateTouch, true);

      window.removeEventListener("touchmove", updateTouch, true);

      window.removeEventListener("click", updateTouch, true);
    };
  }, []);

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

  if (pwaRequired) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-5">
        <section className="w-full max-w-lg rounded-3xl border border-white/15 bg-slate-900 p-6 shadow-2xl sm:p-8">
          <div className="text-center">
            <div className="text-5xl" aria-hidden="true">📲</div>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">Ujian Dibuka dari PWA</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Untuk memulai ujian di Android, pasang Portal Sekolah lalu buka kembali dari ikon aplikasi di layar utama.
            </p>
          </div>

          {(!deferredInstallPrompt || showManualInstallSteps) && (
            <ol className="mt-5 space-y-3 rounded-2xl bg-black/30 p-4 text-left text-sm text-slate-200">
              <li><b>1.</b> Di Chrome, pilih menu ⋮ di kanan atas.</li>
              <li><b>2.</b> Pilih <b>Install app</b> atau <b>Add to Home screen</b>, lalu konfirmasi pemasangan.</li>
              <li><b>3.</b> Kembali ke layar utama dan buka ikon <b>Portal Sekolah</b>.</li>
              <li><b>4.</b> Masuk ke ujian kembali dari PWA tersebut.</li>
            </ol>
          )}

          {installFeedback && (
            <p role="status" className="mt-4 rounded-xl bg-emerald-500/15 p-3 text-sm text-emerald-200">
              {installFeedback}
            </p>
          )}

          {deferredInstallPrompt && (
            <button
              type="button"
              onClick={async () => {
              const promptEvent = deferredInstallPrompt;
              setDeferredInstallPrompt(null);
              try {
                await promptEvent.prompt();
                const choice = await promptEvent.userChoice;
                setInstallFeedback(
                  choice.outcome === "accepted"
                    ? "Pemasangan dimulai. Setelah selesai, buka aplikasi dari ikon layar utama."
                    : "Pemasangan belum dilakukan. Gunakan petunjuk instalasi di bawah. ",
                );
                if (choice.outcome !== "accepted") setShowManualInstallSteps(true);
              } catch (_) {
                setShowManualInstallSteps(true);
                setInstallFeedback("Gunakan menu ⋮ Chrome lalu pilih Install app atau Add to Home screen.");
              }
              }}
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 px-5 py-4 text-base font-black text-slate-950 shadow-lg active:scale-[0.99]"
            >
              📲 Instal Sekarang
            </button>
          )}
          <p className="mt-5 text-center text-xs text-slate-400">
            Jika PWA sudah terpasang, tutup tab ini lalu buka aplikasi dari ikonnya.
          </p>
        </section>
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
      {penaltyOpen && violations > 0 && (
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
                  Karena Anda telah melakukan pelanggaran ({violations}x), Anda
                  diwajibkan menunggu selama 3 menit sebelum dapat kembali
                  melanjutkan asesmen.
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
      {/* MODAL BUKA KUNCI WAKTU / DARURAT */}
      {showEmergencyInput && (
        <div className="fixed inset-0 z-[999999] bg-black/70 flex items-center justify-center p-5">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h2 className="text-2xl font-black text-amber-600 mb-2">
              BUKA KUNCI WAKTU
            </h2>

            <p className="text-gray-600 text-sm mb-4">
              Masukkan kode buka kunci waktu (kode kirim) dari pengawas ujian.
            </p>

            <input
              type="text"
              value={emergencyCode}
              onChange={(e) => setEmergencyCode(e.target.value)}
              className="
          w-full
          border
          border-gray-300
          rounded-2xl
          p-4
          outline-none
          focus:border-amber-500
          text-center
          font-bold
          text-lg
          tracking-wider
        "
              placeholder="Masukkan kode kirim"
              autoFocus
            />

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => {
                  setShowEmergencyInput(false);
                  showEmergencyInputRef.current = false;
                  setEmergencyCode("");
                  setIgnoreFullscreen(false);
                  startSafeAction(3000);
                }}
                className="
            py-3
            rounded-2xl
            bg-gray-200
            font-bold
            text-gray-700
          "
              >
                Batal
              </button>

              <button
                onClick={handleEmergencySubmit}
                className="
            py-3
            rounded-2xl
            bg-amber-600
            hover:bg-amber-700
            text-white
            font-bold
          "
              >
                Buka Kunci
              </button>
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

                // Setelah hukuman selesai atau pelanggaran direset, langsung aktifkan ujian
                if (!examStartedRef.current) {
                  setShowPanduanModal(false);
                  setExamStarted(true);
                }

                // Beri grace period 3 detik agar transisi layar setelah modal OK tidak memicu false positive
                // Juga reset logoutRef agar keamanan aktif kembali setelah modal pelanggaran ditutup
                logoutRef.current = false;
                startSafeAction(3000);
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
                  onTouchStart={() => {
                    emergencyPressTimer.current = setTimeout(() => {
                      startSafeAction(5000);
                      showEmergencyInputRef.current = true;
                      setIgnoreFullscreen(true);
                      setShowEmergencyInput(true);
                    }, 2500);
                  }}
                  onTouchEnd={() => {
                    clearTimeout(emergencyPressTimer.current);
                  }}
                  onMouseDown={() => {
                    emergencyPressTimer.current = setTimeout(() => {
                      startSafeAction(5000);
                      showEmergencyInputRef.current = true;
                      setIgnoreFullscreen(true);
                      setShowEmergencyInput(true);
                    }, 2500);
                  }}
                  onMouseUp={() => {
                    clearTimeout(emergencyPressTimer.current);
                  }}
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
                  startSafeAction(5000);
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
        onScroll={(e) => {
          const st = e.currentTarget.scrollTop;
          setShowScrollTop(st > 350);
        }}
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
          filter: isWindowUnfocused ? "blur(18px)" : "none",
          transition: "filter 0.2s ease-in-out",
        }}
      >
        {examLink && (
          <iframe
            ref={iframeRef}
            src={examLink}
            onLoad={handleIframeLoad}
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

      {/* OVERLAY PERINGATAN SAAT WINDOW HILANG FOKUS / PANGGILAN MASUK (ANTI-INTIP + HITUNGAN 3 DETIK) */}
      {showFullscreenPrompt && (
        <div className="fixed inset-0 z-[10000000] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-5 text-center text-white">
          <div className="w-full max-w-md rounded-3xl border border-white/20 bg-slate-900 p-7 shadow-2xl sm:p-10">
            <div className="mb-4 text-5xl" aria-hidden="true">
              ⛶
            </div>
            <h2 className="text-2xl font-black sm:text-3xl">
              Kembali ke Layar Penuh
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Tekan tombol di bawah untuk melanjutkan ujian dalam mode layar
              penuh.
            </p>
            <p className="mt-4 text-sm font-bold text-amber-300">
              Toleransi: {toleranceCountdown ?? 3} detik
            </p>
            <button
              type="button"
              className="mt-6 min-h-16 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-5 text-lg font-black text-white shadow-xl transition hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98]"
              onClick={async () => {
                startSafeAction(3000);
                try {
                  await document.documentElement.requestFullscreen();
                } catch (_) {
                  setShowFullscreenPrompt(true);
                }
              }}
            >
              ⛶ KEMBALI KE FULLSCREEN
            </button>
          </div>
        </div>
      )}

      {isWindowUnfocused && (
        <div className="fixed inset-0 z-[99990] bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-5 text-center text-white pointer-events-none select-none">
          <div className="w-16 h-16 rounded-3xl bg-red-600/30 border-2 border-red-500 flex items-center justify-center text-3xl mb-3 shadow-2xl animate-bounce">
            🚨
          </div>
          <h3 className="text-sm sm:text-base font-black uppercase text-red-400 tracking-wider">
            Layar Ujian Disamarkan
          </h3>
          <p className="text-xs text-slate-300 max-w-xs mt-1">
            Terdeteksi perpindahan tab, aplikasi lain, atau layar kehilangan
            fokus.
          </p>

          <div className="my-4 px-5 py-2.5 rounded-2xl bg-red-600/90 border border-red-400 shadow-2xl flex flex-col items-center justify-center">
            <span className="text-[10px] sm:text-xs font-bold text-red-100 uppercase tracking-widest">
              Sisa Waktu Kembali
            </span>
            <span className="text-3xl sm:text-4xl font-mono font-black text-white leading-tight">
              {toleranceCountdown !== null ? toleranceCountdown : 3} Detik
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-amber-300 font-bold max-w-xs">
            ⚠️ Segera kembali ke layar ujian sebelum waktu habis atau Anda
            otomatis dikeluarkan!
          </p>
        </div>
      )}

      {/* NOTIF COUNTDOWN SEBELUM SOAL DIKUNCI (HANYA AKTIF SAAT SOAL BELUM DIKUNCI) */}
      {!soalLocked &&
        examStarted &&
        lockCountdown !== null &&
        lockCountdown > 0 && (
          <div className="fixed top-[115px] left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 text-xs sm:text-sm font-black px-4 py-2 sm:px-5 sm:py-2.5 rounded-full shadow-2xl border-2 border-yellow-200 animate-pulse pointer-events-none select-none whitespace-nowrap">
            ⏳ Soal dikunci otomatis dalam{" "}
            <span className="font-mono text-sm sm:text-base font-extrabold px-2 py-0.5 rounded-lg bg-black text-yellow-300">
              {lockCountdown}s
            </span>{" "}
            — isi identitas & jawaban sekarang!
          </div>
        )}

      {/* PESAN DARI PENGAWAS / ADMIN (FLOATING BANNER SELALU TERLIHAT DI ATAS IFRAME) */}
      {pesan && (
        <div
          className={`fixed ${
            !soalLocked &&
            examStarted &&
            lockCountdown !== null &&
            lockCountdown > 0
              ? "top-[170px]"
              : "top-[115px]"
          } left-1/2 -translate-x-1/2 z-[9999] max-w-xl w-[94%] sm:w-[88%] rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 p-3 sm:p-4 text-white shadow-2xl border-2 border-red-300 backdrop-blur-md`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-2xl shrink-0">📢</span>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-red-200">
                  PESAN DARI PENGAWAS / ADMIN
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-bold text-white leading-relaxed break-words">
                  {pesan}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                lastDismissedPesanRef.current = pesan;
                setPesan("");
              }}
              className="shrink-0 text-white/80 hover:text-white bg-black/30 hover:bg-black/50 rounded-full w-6 h-6 flex items-center justify-center text-xs font-black leading-none transition"
              title="Tutup Pesan"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* TOMBOL CEPAT SCROLL KE PALING ATAS FORM */}
      {showScrollTop && (
        <button
          type="button"
          onClick={() => {
            if (iframeContainerRef.current) {
              iframeContainerRef.current.scrollTo({
                top: 0,
                behavior: "smooth",
              });
            }
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="fixed bottom-[95px] left-4 z-[999] bg-slate-900/90 hover:bg-slate-800 text-white font-extrabold text-xs px-3.5 py-2.5 rounded-2xl shadow-xl border border-white/20 flex items-center gap-1.5 transition-all active:scale-95 backdrop-blur-md cursor-pointer"
          title="Kembali ke bagian paling atas form"
        >
          <span>⬆️</span>
          <span className="hidden sm:inline">Paling Atas</span>
        </button>
      )}

      {/* FLOATING DRAFT */}
      <div
        className={`
          fixed
          top-[115px]
          bottom-[85px]
          z-[9999]
          flex
          flex-col
          justify-center
          pointer-events-none
          transition-all
          duration-300
          ease-in-out
          ${
            draftMinimized
              ? "right-0 w-[42px]"
              : "right-1.5 sm:right-3 md:right-4 w-[145px] sm:w-[165px] md:w-[195px]"
          }
        `}
      >
        {/* TOMBOL MINIMIZE / EXPAND */}
        <button
          type="button"
          onClick={() => setDraftMinimized(!draftMinimized)}
          className={`
            pointer-events-auto
            absolute
            top-1/2
            -translate-y-1/2
            ${
              draftMinimized
                ? "right-0 rounded-l-xl px-2 py-3"
                : "-left-9 rounded-l-xl rounded-r-md px-2 py-3"
            }
            bg-blue-700
            hover:bg-blue-800
            text-white
            shadow-lg
            text-xs
            font-bold
            transition-all
            z-20
          `}
          title={draftMinimized ? "Buka Draft Jawaban" : "Sembunyikan Draft"}
        >
          {draftMinimized ? "◀" : "▶"}
        </button>

        {/* KONTAINER DRAFT */}
        {!draftMinimized && (
          <div
            className="
              pointer-events-auto
              flex
              flex-col
              w-full
              max-h-full
              bg-white/95
              backdrop-blur-md
              border
              border-gray-300
              shadow-2xl
              rounded-2xl
              p-2 sm:p-2.5
              overflow-hidden
            "
          >
            {/* HEADER DRAFT (TETAP DI ATAS / TIDAK IKUT TER-SCROLL) */}
            <div className="shrink-0 flex items-center justify-between pb-1.5 mb-1.5 border-b border-gray-200">
              <div>
                <h3 className="font-extrabold text-[11px] md:text-xs text-blue-700 leading-tight">
                  DRAFT
                </h3>
                <p className="text-[8px] md:text-[9px] text-gray-500 leading-none mt-0.5">
                  1x Hijau • 2x Kuning
                </p>
              </div>

              {/* Tombol Hapus Data */}
              <button
                type="button"
                onClick={() => {
                  startSafeAction(3000);
                  setIgnoreFullscreen(true);
                  setIsConfirmHapusOpen(true);
                }}
                className="bg-red-100 hover:bg-red-200 text-red-600 text-[8px] md:text-[9px] font-bold py-1 px-2 rounded-lg border border-red-200 transition"
              >
                🗑️ HAPUS
              </button>
            </div>

            {/* DAFTAR SOAL YANG BISA DI-SCROLL */}
            <div
              className="
                flex-1
                overflow-y-auto
                overscroll-contain
                pr-1
                space-y-1.5
                scrollbar-thin
                scrollbar-thumb-blue-400
                scrollbar-track-gray-100
              "
              style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
              }}
            >
              {Array.from({ length: 50 }).map((_, index) => {
                const soalNo = index + 1;
                const answer = draftAnswers[soalNo];
                const mode = draftMode[soalNo];

                let bgColor = "bg-gray-100/90";
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
                      p-1.5
                      border
                      border-gray-200
                      shadow-sm
                      transition-all
                      ${bgColor}
                    `}
                  >
                    <div className="text-center text-[10px] md:text-xs font-black mb-1">
                      Soal {soalNo}
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      {["A", "B", "C", "D", "E"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleDraftChange(soalNo, option)}
                          className={`
                            h-7 sm:h-8
                            text-[10px] sm:text-xs
                            rounded-lg
                            font-bold
                            transition-all
                            active:scale-90
                            flex items-center justify-center
                            shadow-sm
                            ${
                              answer === option
                                ? mode === "ragu"
                                  ? "bg-amber-600 text-white shadow-amber-300 ring-2 ring-amber-700"
                                  : "bg-emerald-700 text-white shadow-emerald-400 ring-2 ring-emerald-800"
                                : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
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
        <div className="fixed bottom-0 left-0 right-0 h-[80px] bg-slate-900/95 backdrop-blur-md z-[999] border-t-4 border-red-600 flex items-center justify-between px-3 sm:px-4 md:px-6 shadow-[0_-15px_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 animate-ping bg-red-500 rounded-full opacity-25"></div>
              <div className="bg-red-600 p-1.5 sm:p-2 rounded-lg relative shadow-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6 text-white"
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
              <h4 className="text-white font-bold text-[11px] sm:text-xs md:text-base leading-none truncate uppercase">
                🔒 Soal Dikunci
              </h4>
              <p className="text-gray-400 text-[8px] sm:text-[9px] md:text-xs mt-1 uppercase tracking-tight font-medium truncate">
                Jawab di draft hingga waktu selesai
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* TOMBOL BUKA KUNCI WAKTU (RESPONSIF) */}
            <button
              onClick={() => {
                startSafeAction(5000);
                showEmergencyInputRef.current = true;
                setIgnoreFullscreen(true);
                setShowEmergencyInput(true);
              }}
              className="
                flex items-center gap-1 sm:gap-1.5
                px-2.5 sm:px-3.5 py-1.5 sm:py-2
                rounded-xl
                bg-gradient-to-r from-amber-500 to-yellow-500
                hover:from-amber-600 hover:to-yellow-600
                text-slate-950 font-black
                text-[10px] sm:text-xs md:text-sm
                shadow-lg hover:shadow-yellow-500/30
                border border-yellow-300/50
                transition-all active:scale-95
              "
              title="Buka Kunci Waktu / Masukkan Kode Kirim"
            >
              <span className="text-xs sm:text-sm">🔓</span>
              <span className="hidden sm:inline whitespace-nowrap">
                Buka Kunci Waktu
              </span>
              <span className="inline sm:hidden whitespace-nowrap">
                Buka Kunci
              </span>
            </button>

            <div className="text-right shrink-0 bg-black/40 px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/10 shadow-inner">
              <span className="text-[8px] sm:text-[9px] md:text-[10px] text-gray-400 block mb-0.5 font-bold tracking-widest leading-none">
                SISA WAKTU
              </span>
              <span className="text-lg sm:text-xl md:text-3xl font-mono font-black text-yellow-400 leading-none">
                {formatTime(timeLeft)}
              </span>
            </div>
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
                    startSafeAction(2000);
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
                onClick={() => {
                  setIsConfirmHapusOpen(false);
                  startSafeAction(2000);
                }}
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
                        50 detik pertama
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
                      Setelah 50 detik, Google Form otomatis terkunci dan tidak
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
                  showPanduanModalRef.current = false;
                  examStartedRef.current = true;

                  // Masuk mode fullscreen resmi dengan interaksi user gesture
                  const isIOS =
                    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                    (typeof navigator !== "undefined" &&
                      navigator.platform === "MacIntel" &&
                      navigator.maxTouchPoints > 1);
                  if (!isIOS && !document.fullscreenElement) {
                    document.documentElement
                      .requestFullscreen()
                      .catch(() => {});
                  }

                  // Pasang history trap dengan user gesture resmi agar Android Chrome mengunci tombol back
                  armHistoryTrap();

                  // mulai sistem ujian & countdown 50 detik
                  setLockCountdown(50);
                  setExamStarted(true);
                  triggerSecurityToast(
                    "✅ Asesmen dimulai. Sistem keamanan aktif.",
                    "success",
                    2500,
                  );

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

      {/* ============================================================
          MODAL KONFIRMASI KELUAR (Back / Recent)
          Muncul saat siswa menekan tombol Back secara tidak sengaja.
          Siswa harus memilih: "Tetap di Asesmen" atau "Keluar & Batalkan Ujian".
          ============================================================ */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center overflow-y-auto overscroll-contain p-5">
          <div className="my-auto max-h-[calc(100dvh-2.5rem)] overflow-y-auto bg-white rounded-3xl shadow-2xl max-w-sm w-full">
            {/* Header Peringatan */}
            <div className="bg-gradient-to-r from-red-600 to-orange-500 p-5 text-center">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-white text-xl font-black uppercase tracking-wide">
                Keluar dari Asesmen?
              </h2>
            </div>

            {/* Isi Pesan */}
            <div className="p-6 text-center">
              <p className="text-gray-700 text-sm leading-relaxed mb-1">
                Kamu menekan tombol <strong>Kembali / Back</strong>.
              </p>
              <p className="text-gray-700 text-sm leading-relaxed mb-5">
                Jika keluar sekarang, ujian akan{" "}
                <strong className="text-red-600">dibatalkan</strong> dan
                dianggap <strong className="text-red-600">pelanggaran</strong>.
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* TETAP DI UJIAN */}
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    exitConfirmRef.current = false;

                    // Reset semua skor risiko dan indikator resize mencurigakan
                    overlayRiskRef.current = 0;
                    overlayTriggeredRef.current = false;
                    suspiciousResizeRef.current = 0;

                    // Pasang state baru agar back berikutnya tetap tertangkap konsisten
                    armHistoryTrap();

                    // Beri grace period 2.5 detik untuk transisi fullscreen & layout settling
                    startSafeAction(2500);
                    triggerSecurityToast(
                      "✅ Pilihan Anda: Tetap di Asesmen.",
                      "success",
                      2500,
                    );

                    // Kembali fullscreen jika diperlukan
                    const isIOS =
                      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                      (navigator.platform === "MacIntel" &&
                        navigator.maxTouchPoints > 1);
                    if (!isIOS && !document.fullscreenElement) {
                      document.documentElement
                        .requestFullscreen()
                        .catch(() => {});
                    }
                  }}
                  className="py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm transition active:scale-95"
                >
                  ✅ Tetap di Asesmen
                </button>

                {/* KELUAR & BATALKAN */}
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    exitConfirmRef.current = false;
                    forceLogout("Keluar dari halaman ujian secara manual");
                  }}
                  className="py-3 rounded-2xl bg-red-100 hover:bg-red-200 text-red-700 font-black text-sm transition active:scale-95 border border-red-300"
                >
                  ❌ Keluar & Batalkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          FLOATING SECURITY TOAST NOTIFICATION
          Memberi tahu siswa secara visual setiap kali ada tombol Back,
          Recent, atau kehilangan fokus yang terdeteksi
          ============================================================ */}
      {securityToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999999] max-w-sm w-[92%] pointer-events-none transition-all duration-300 drop-shadow-2xl">
          <div
            className={`px-4 py-3.5 rounded-2xl shadow-2xl border-2 text-xs sm:text-sm font-black flex items-center gap-3 backdrop-blur-md ${
              securityToast.type === "danger"
                ? "bg-red-600 text-white border-red-300 shadow-red-950/60"
                : securityToast.type === "success"
                  ? "bg-emerald-600 text-white border-emerald-300 shadow-emerald-950/60"
                  : "bg-amber-400 text-slate-950 border-amber-200 shadow-amber-950/60"
            }`}
          >
            <span className="text-2xl shrink-0">
              {securityToast.type === "danger"
                ? "🚨"
                : securityToast.type === "success"
                  ? "✅"
                  : "⚠️"}
            </span>
            <span className="flex-1 leading-snug">{securityToast.message}</span>
          </div>
        </div>
      )}
    </main>
  );
}
