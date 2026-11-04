"use client";

import { useEffect, useRef, useState } from "react";
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
  const [nama, setNama] = useState("");
  const [kelas, setKelas] = useState("");
  const [idSiswa, setIdSiswa] = useState("");
  const [pesan, setPesan] = useState("");
  const lastDismissedPesanRef = useRef("");
  const lastExecutedCommandRef = useRef("");
  const lockTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);
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
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      setLockCountdown(null);

      // timer langsung habis
      setTimeLeft(0);

      // buka lock soal
      setSoalLocked(false);

      showModal(
        "✅ KUNCI WAKTU DIBUKA\n\n" +
          "Kode buka kunci waktu berhasil diverifikasi.\n" +
          "Soal dan formulir dapat dikerjakan dan dikirimkan.",
      );

      setShowEmergencyInput(false);

      setEmergencyCode("");

      return;
    }

    // KODE SALAH = PELANGGARAN
    setShowEmergencyInput(false);

    setEmergencyCode("");

    forceLogout("Kode buka kunci salah");
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
  const visibilityTimeoutRef = useRef(null);
  const [isWindowUnfocused, setIsWindowUnfocused] = useState(false);
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

  const keyboardTestRef = useRef(null);

  const keyboardGraceRef = useRef(true);

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

      startSafeAction(2000);
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
          setLockCountdown((prev) => (prev === null && !soalLocked ? 90 : prev));

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
    setIgnoreFullscreen(true);
    setModalMessage(message);
    setModalOpen(true);
  }

  function startSafeAction(duration = 3000) {
    safeActionRef.current = true;
    setIgnoreFullscreen(true);
    setIsWindowUnfocused(false);
    if (visibilityTimeoutRef.current) clearTimeout(visibilityTimeoutRef.current);
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);

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

    showModal(reason + "\nTotal pelanggaran: " + totalViolation);

    setTimeout(() => {
      localStorage.removeItem("examLink");
      router.push("/exam");
    }, 2000);
  }

  // [DIHAPUS] LIVE AUTO RESET PELANGGARAN (80 MENIT)
  // Reset pelanggaran hanya bisa dilakukan admin via pesan "HAPUS PELANGGARAN"

  // =========================
  // CEK PESAN REALTIME & COMMAND ADMIN (REC-1 & REC-2)
  // =========================
  useEffect(() => {
    if (!nama || !kelas) return;

    const interval = setInterval(async () => {
      try {
        const result = await cekPesan(nama, kelas);

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
              setExamStarted(true);
              setLockCountdown((prev) => (prev === null && !soalLocked ? 90 : prev));
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

          // 2. REC-1: Tampilkan pesan HANYA jika ada dan belum di-close oleh siswa
          if (isiPesan) {
            if (isiPesan !== lastDismissedPesanRef.current) {
              setPesan(isiPesan);
            }
          } else {
            // Jika pesan dihapus oleh guru/admin di server, kosongkan state & tracker
            lastDismissedPesanRef.current = "";
            lastExecutedCommandRef.current = "";
            setPesan("");
          }

          // 3. REC-2: PERINTAH BUKA KUNCI & MANAJEMEN VIA PESAN ADMIN (Hanya diproses 1x per perintah)
          const pesanUpper = isiPesan.toUpperCase();
          if (pesanUpper && lastExecutedCommandRef.current !== pesanUpper) {
            if (pesanUpper === "UJIAN DI RESET") {
              lastExecutedCommandRef.current = pesanUpper;
              showModal("Ujian telah direset oleh admin");
              setTimeout(() => {
                localStorage.removeItem("examLink");
                router.push("/exam");
              }, 2000);
            } else if (pesanUpper === "BUKA KUNCI") {
              lastExecutedCommandRef.current = pesanUpper;
              // Hentikan hitungan mundur auto-lock dan hapus notif
              if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              setLockCountdown(null);

              setTimeLeft(0);
              setSoalLocked(false);
              showModal(
                "✅ KUNCI WAKTU DIBUKA\n\n" +
                  "Pengawas / Guru telah membuka kunci ujian.\n" +
                  "Soal dan formulir sekarang dapat dikerjakan dan dikirimkan.",
              );
            } else if (pesanUpper === "HAPUS PELANGGARAN") {
              lastExecutedCommandRef.current = pesanUpper;
              setViolations(0);
              localStorage.setItem("violations", "0");
              localStorage.removeItem("violationStartTime");
              localStorage.removeItem("penaltyPassed");
              localStorage.removeItem("lastPenaltyServedAtViolation");
              setPenaltyOpen(false);
              setPenaltyDone(true);
              document.body.style.overflow = "auto";
              setShowPanduanModal(false);
              setExamStarted(true);
              setLockCountdown((prev) => (prev === null && !soalLocked ? 90 : prev));
              const currentId = idSiswa || localStorage.getItem("id_siswa") || "";
              catatPelanggaran(nama, kelas, currentId, 0);
              showModal(
                "✅ CATATAN PELANGGARAN DIRESET\n\n" +
                  "Semua catatan pelanggaran Anda telah direset menjadi 0 oleh admin.\n" +
                  "Waktu ujian dan pengerjaan soal telah dimulai kembali.",
              );
            } else if (pesanUpper === "KUNCI SOAL") {
              lastExecutedCommandRef.current = pesanUpper;
              setSoalLocked(true);
              showModal(
                "🔒 SOAL DIKUNCI\n\n" +
                  "Akses pengisian formulir soal telah dikunci oleh pengawas / admin.",
              );
            } else if (/^TAMBAH WAKTU \d+$/.test(pesanUpper)) {
              lastExecutedCommandRef.current = pesanUpper;
              const menit = parseInt(pesanUpper.replace("TAMBAH WAKTU ", "").trim()) || 0;
              if (menit > 0) {
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
    }, 5000);

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
    function handleFullscreenChange() {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      // Di iPhone, Fullscreen API standar HTML5 tidak didukung oleh Apple WebKit
      if (isIOS) return;

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
  // AUTO LOCK SOAL SETELAH 1 MENIT 30 DETIK + NOTIF COUNTDOWN
  // =========================
  useEffect(() => {
    if (!examStarted) return;

    // Bersihkan timer lama jika ada
    if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      setLockCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    lockTimerRef.current = setTimeout(
      () => {
        setLockCountdown(null);
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
      90 * 1000,
    );

    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
    };
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
        // MODAL DARURAT
        if (showEmergencyInput) {
          setShowEmergencyInput(false);

          setEmergencyCode("");

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
      const isDangerous =
        e.key === "F12" ||
        e.key === "F11" ||
        (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "u") ||
        (e.altKey && e.key === "Tab");

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
      if (showEmergencyInput && document.activeElement?.tagName === "INPUT") {
        return;
      }
      if (isModalPengaduanOpen && document.activeElement?.tagName === "TEXTAREA") {
        return;
      }

      // Selama soal dikunci (setelah 1m 30s), blokir semua input keyboard lainnya
      if (soalLocked && timeLeft > 0) {
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
    // BLUR - Deteksi fokus keluar dari window (Floating App / Notif / Panggilan)
    // ======================
    function handleBlur() {
      lastBlurAtRef.current = Date.now();
      clearTimeout(blurTimeoutRef.current);

      const isIframeFocused =
        iframeRef.current && document.activeElement === iframeRef.current;

      // Selisih waktu sejak sentuhan terakhir pada halaman ujian
      const touchAge = Date.now() - lastTouchRef.current;
      // Ketukan sah ke iframe selalu memicu touchstart tepat sebelum blur (< 400ms)
      const isLegitimateIframeTap = isIframeFocused && touchAge < 400;

      // Aktifkan blur anti-intip seketika jika BUKAN ketukan sah ke iframe dan bukan modal resmi
      if (
        !isLegitimateIframeTap &&
        !safeActionRef.current &&
        !modalOpen &&
        !isModalPengaduanOpen &&
        !isConfirmHapusOpen &&
        !showEmergencyInput
      ) {
        setIsWindowUnfocused(true);
        addOverlayRisk(35, "Window blur tanpa ketukan iframe");
      }

      blurTimeoutRef.current = setTimeout(() => {
        if (
          modalOpen ||
          isModalPengaduanOpen ||
          isConfirmHapusOpen ||
          showEmergencyInput ||
          safeActionRef.current
        ) {
          return;
        }

        // Cek apakah window benar-benar tidak fokus dan tidak ada interaksi di halaman ujian
        const idleSinceBlur = Date.now() - lastTouchRef.current;
        if (!document.hasFocus() && (!isIframeFocused || idleSinceBlur >= 2800)) {
          setSoalLocked(true);
          triggerViolation(
            "Aplikasi lain / floating window / panggilan tidak segera ditolak (> 3 detik)",
          );
        }
      }, 3000); // Toleransi ketat 3 detik
    }

    // ======================
    // FOCUS - Deteksi ketika fokus kembali (cegah false positive iframe & hilangkan blur)
    // ======================
    function handleFocus() {
      clearTimeout(blurTimeoutRef.current);
      clearTimeout(visibilityTimeoutRef.current);
      setIsWindowUnfocused(false);

      const blurDuration = Date.now() - lastBlurAtRef.current;

      // blur cukup lama = mencurigakan
      if (blurDuration > 1000 && blurDuration < 15000) {
        addOverlayRisk(20, "Long Blur");
      }
    }

    // ======================
    // VISIBILITY - Toleransi 10 Detik untuk Panggilan Masuk Layar Penuh
    // ======================
    function handleVisibility() {
      if (document.hidden) {
        if (safeActionRef.current) return;
        addOverlayRisk(40, "Document Hidden");

        // Langsung aktifkan efek blur anti-intip seketika
        setIsWindowUnfocused(true);

        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = setTimeout(() => {
          if (document.hidden) {
            triggerViolation("Anda meninggalkan halaman ujian (pindah aplikasi / panggilan tidak segera ditolak > 3 detik)");
          }
        }, 3000); // Toleransi ketat 3 detik (cukup untuk tolak panggilan, tidak cukup untuk contek)
      } else {
        // Panggilan ditolak / siswa kembali ke ujian dalam waktu < 3 detik
        clearTimeout(visibilityTimeoutRef.current);
        clearTimeout(blurTimeoutRef.current);
        setIsWindowUnfocused(false);
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
    // VISUAL VIEWPORT (Android) - DETEKSI DOCKED & FLOATING KEYBOARD
    // ======================
    function handleViewport() {
      const isIOS =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (typeof navigator !== "undefined" &&
          navigator.platform === "MacIntel" &&
          navigator.maxTouchPoints > 1);
      // Di iPhone keyboard selalu docked & tidak ada floating keyboard. Proteksi perpindahan aplikasi dihandle visibilitychange & pagehide
      if (isIOS) return;

      if (keyboardGraceRef.current) {
        return;
      }
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

      // Hitung penyusutan layar akibat keyboard android
      const keyboardDiff = window.innerHeight - viewportHeight;
      const widthShrink = viewportWidth < window.innerWidth * 0.94;

      // Klasifikasi jenis keyboard:
      // 1. Keyboard standar Android yang docked ke bawah (> 150px)
      const isDockedKeyboard = keyboardDiff > 150;
      // 2. Floating Keyboard Android (Keyboard Mengambang): penyusutan kecil 25px - 150px ATAU layar samping menyusut
      const isFloatingKeyboard =
        (keyboardDiff > 25 && keyboardDiff <= 150) ||
        (widthShrink && keyboardDiff > 10);
      const anyKeyboardOpen = isDockedKeyboard || isFloatingKeyboard;

      // ======================
      // KEYBOARD RESMI: HANYA DIIZINKAN PADA MODAL PENGADUAN & KODE DARURAT
      // ======================
      const isAllowedInput =
        isModalPengaduanOpen ||
        showEmergencyInput ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "INPUT";

      if (anyKeyboardOpen && isAllowedInput) {
        return;
      }

      // ======================
      // LOGIKA DETEKSI: KUNCI & CATAT PELANGGARAN JIKA KEYBOARD DIBUKA ILEGAL
      // ======================
      if (anyKeyboardOpen) {
        if (isAllowedInput) return;

        // Cegah spam alert berulang saat keyboard masih posisi terbuka
        if (keyboardOpenedRef.current) return;
        keyboardOpenedRef.current = true;

        if (isFloatingKeyboard) {
          // LANGSUNG KUNCI UJIAN PERMANEN
          setSoalLocked(true);
          showModal(
            "❌ Pelanggaran Berat: Terdeteksi penggunaan Floating Keyboard (Keyboard Mengambang) atau modifikasi tampilan layar standar. Akses ujian langsung dikunci!",
          );
          triggerViolation("Floating Keyboard terdeteksi di area ujian");
          return;
        } else {
          // Keyboard standar Android terbuka tanpa izin
          setSoalLocked(true);
          showModal(
            "❌ Pelanggaran: Membuka keyboard tidak diizinkan selama ujian berlangsung. Akses ujian langsung dikunci!",
          );
          triggerViolation("Membuka keyboard standar tanpa izin");
          return;
        }
      }

      // RESET STATE JIKA KEYBOARD DITUTUP
      if (!anyKeyboardOpen) {
        keyboardOpenedRef.current = false;
      }

      if (safeActionRef.current) return;

      // DETEKSI SPLIT SCREEN / FLOATING WINDOW APLIKASI LAIN
      if (widthRatio < 0.88 || heightRatio < 0.80) {
        setSoalLocked(true);
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
      if (isModalPengaduanOpen || showEmergencyInput) return;

      if (
        window.visualViewport.offsetTop > 15 ||
        window.visualViewport.pageTop > 15
      ) {
        setSoalLocked(true);
        showModal(
          "❌ Pelanggaran Berat: Terdeteksi pergeseran layar / Floating overlay. Akses ujian langsung dikunci!",
        );
        triggerViolation("Floating overlay / pergeseran layar terdeteksi");
      }
    }

    // Deteksi interupsi sentuhan oleh OS Android (misal ketika ada floating overlay / bubble yang menimpa)
    function handleTouchCancel() {
      if (safeActionRef.current) return;
      addOverlayRisk(35, "Touch Cancelled by System/Overlay");
    }

    // EVENT LISTENER
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus); // ← TAMBAH INI
    window.addEventListener("touchcancel", handleTouchCancel, true);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", () => {
      if (!safeActionRef.current) {
        triggerViolation("Anda meninggalkan halaman ujian");
      }
    });
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleOrientation);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleViewport);
      window.visualViewport.addEventListener("scroll", handleViewportScroll);
    }

    return () => {
      clearTimeout(blurTimeoutRef.current);
      clearTimeout(visibilityTimeoutRef.current);
      clearTimeout(resizeTimeoutRef.current);

      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus); // ← TAMBAH INI
      window.removeEventListener("touchcancel", handleTouchCancel, true);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleOrientation);

      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleViewport);
        window.visualViewport.removeEventListener("scroll", handleViewportScroll);
      }
    };
  }, [ignoreFullscreen, violations]);

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

      if (ignoreFullscreen) return;

      // jangan cek saat modal aktif
      if (modalOpen) return;

      if (isModalPengaduanOpen) return;

      if (isConfirmHapusOpen) return;

      const now = Date.now();

      const idleTime = now - lastTouchRef.current;

      // Jika window kehilangan fokus sistem dan tidak ada sentuhan selama > 8 detik (Floating App dibiarkan aktif)
      if (idleTime > 8000 && !document.hasFocus()) {
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

                  setEmergencyCode("");

                  setIgnoreFullscreen(false);
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
                if (!examStarted) {
                  setShowPanduanModal(false);
                  setExamStarted(true);
                  setLockCountdown((prev) => (prev === null && !soalLocked ? 90 : prev));
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
                  onTouchStart={() => {
                    emergencyPressTimer.current = setTimeout(() => {
                      setIgnoreFullscreen(true);

                      setShowEmergencyInput(true);
                    }, 2500);
                  }}
                  onTouchEnd={() => {
                    clearTimeout(emergencyPressTimer.current);
                  }}
                  onMouseDown={() => {
                    emergencyPressTimer.current = setTimeout(() => {
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
          max-w-xl
          relative
          rounded-xl
          bg-gradient-to-r
          from-red-600
          to-rose-500
          px-3
          py-2
          pr-8
          text-white
          shadow-md
        "
            >
              <button
                type="button"
                onClick={() => {
                  lastDismissedPesanRef.current = pesan;
                  setPesan("");
                }}
                className="absolute top-2 right-2 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold leading-none transition"
                title="Tutup Pesan"
              >
                ✕
              </button>
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

      {/* OVERLAY PERINGATAN SAAT WINDOW HILANG FOKUS / PANGGILAN MASUK (ANTI-INTIP) */}
      {isWindowUnfocused && (
        <div className="fixed inset-0 z-[99990] bg-slate-950/60 backdrop-blur-md flex flex-col items-center justify-center p-5 text-center text-white pointer-events-none select-none">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-2xl mb-2 shadow-lg">
            📞
          </div>
          <h3 className="text-sm sm:text-base font-black uppercase text-amber-300 tracking-wide">
            Layar Ujian Disamarkan
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-200 max-w-xs mt-1 leading-relaxed">
            Terdeteksi panggilan masuk atau perpindahan jendela. Segera tolak panggilan atau kembali ke aplikasi dalam{" "}
            <span className="font-bold text-amber-400 underline">3 detik</span> untuk melanjutkan ujian.
          </p>
        </div>
      )}

      {/* NOTIF COUNTDOWN SEBELUM SOAL DIKUNCI */}
      {lockCountdown !== null && (
        <div className="fixed top-[115px] left-1/2 -translate-x-1/2 z-[998] flex items-center gap-2 bg-amber-500 text-black text-xs font-black px-4 py-2 rounded-full shadow-xl border border-amber-300 animate-pulse pointer-events-none select-none whitespace-nowrap">
          ⏳ Soal dikunci dalam{" "}
          <span className="font-mono text-sm">
            {String(Math.floor(lockCountdown / 60)).padStart(2, "0")}:
            {String(lockCountdown % 60).padStart(2, "0")}
          </span>
          {" "}— isi identitas & jawaban sekarang!
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
                        1 menit 30 detik pertama
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
                      Setelah 1 menit 30 detik, Google Form otomatis terkunci dan tidak
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

                  // mulai sistem ujian & countdown 1 menit 30 detik
                  setLockCountdown(90);
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
