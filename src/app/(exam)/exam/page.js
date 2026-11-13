"use client";

import { getExamData, checkToken } from "@/services/examService";
import {
  cekPesan,
  kirimPengaduan,
  registerStudent,
  kunciSesiUjian,
} from "@/services/authService";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// HANYA UNTUK PENGUJIAN SEMENTARA. Nilai ini terlihat di bundle browser.
const PWA_TEST_BYPASS_PIN = "293031";

export default function ExamPage() {
  async function enterFullscreen() {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) return;

      if (
        !document.fullscreenElement &&
        typeof document.documentElement?.requestFullscreen === "function"
      ) {
        await document.documentElement.requestFullscreen().catch(() => {});
      }
    } catch (_) {}
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
      // Jalankan dari klik siswa agar browser masih mengizinkan fullscreen.
      void enterFullscreen();
      sessionStorage.setItem("examPwaAccess", "standalone");
      setPwaGateMode("allowed");
      return;
    }

    if (pwaPin.trim() !== PWA_TEST_BYPASS_PIN) {
      setPwaGateMessage("PIN pengecualian tidak sesuai.");
      return;
    }
    // Aktivasi harus terjadi langsung dari tombol PIN, bukan dari effect.
    void enterFullscreen();
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

  // true hanya setelah daftar ujian berhasil diambil dari server pada sesi ini.
  // Cache localStorage bisa usang (sesi sudah disembunyikan admin), jadi tidak boleh dipakai sebagai dasar lolos token.
  const examSegarRef = useRef(false);

  // Hasil ujian terakhir milik siswa ini (sumber sama dengan nilai di Pantau Asesmen)
  const [hasilUjian, setHasilUjian] = useState({
    loading: false,
    terakhir: null,
    hasil: [],
    error: "",
    diag: null,
  });
  const [selectedKelas, setSelectedKelas] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");

  const [token, setToken] = useState("");

  const [examLink, setExamLink] = useState("");

  const [loadingToken, setLoadingToken] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tokenModal, setTokenModal] = useState(false);
  const [tokenMessage, setTokenMessage] = useState("");
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintText, setComplaintText] = useState("");
  const [complaintError, setComplaintError] = useState("");
  const [complaintLoading, setComplaintLoading] = useState(false);
  const [complaintNotice, setComplaintNotice] = useState("");

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

      if (
        Array.isArray(data) &&
        data.length === 0 &&
        typeof navigator !== "undefined" &&
        navigator.onLine
      ) {
        // Semua sesi sedang disembunyikan admin: kosongkan daftar & cache agar tidak ada sesi usang
        examSegarRef.current = true;
        setExamData([]);
        setSelectedMapel("");
        try {
          localStorage.removeItem("cached_exam_data");
        } catch (_) {}
        setTokenMessage(
          "Belum ada sesi ujian yang dibuka. Tunggu sesuai jadwal ujian.",
        );
        setTokenModal(true);
      } else if (Array.isArray(data) && data.length > 0) {
        examSegarRef.current = true;
        setExamData(data);
        setSelectedMapel((prev) =>
          data.some((it) => it?.kls === selectedKelas && it?.mpl === prev)
            ? prev
            : "",
        );
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
        if (
          Array.isArray(data) &&
          data.length === 0 &&
          typeof navigator !== "undefined" &&
          navigator.onLine
        ) {
          examSegarRef.current = true;
          setExamData([]);
          setSelectedMapel("");
          try {
            localStorage.removeItem("cached_exam_data");
          } catch (_) {}
        } else if (Array.isArray(data) && data.length > 0) {
          examSegarRef.current = true;
          setExamData(data);
          setSelectedMapel((prev) =>
            prev && !data.some((it) => it?.mpl === prev) ? "" : prev,
          );
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

    // Auto refresh: saat halaman dibuka kembali/fokus & berkala selama halaman terlihat
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") fetchExam();
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    window.addEventListener("focus", saatTerlihat);
    const timer = setInterval(saatTerlihat, 30000);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", saatTerlihat);
      window.removeEventListener("focus", saatTerlihat);
      clearInterval(timer);
    };
  }, [pwaGateMode]);

  // =========================
  // HASIL UJIAN TERAKHIR SISWA (auto refresh)
  // =========================
  useEffect(() => {
    if (pwaGateMode !== "allowed" || !nama) return;
    let aktif = true;
    const muatHasil = async () => {
      try {
        setHasilUjian((p) => ({ ...p, loading: true }));
        const qs = new URLSearchParams({
          nama,
          kelas: kelas || "",
          id: idSiswa || "",
        });
        const res = await fetch(`/api/exam/nilai-saya?${qs.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!aktif) return;
        if (json.status === "success") {
          setHasilUjian({
            loading: false,
            terakhir: json.terakhir || null,
            hasil: json.hasil || [],
            error: "",
            diag: json.diag || null,
          });
        } else {
          // Gagal: pertahankan hasil sebelumnya, tampilkan pesan singkat
          setHasilUjian((p) => ({
            ...p,
            loading: false,
            error: json.message || "Gagal memuat hasil",
          }));
        }
      } catch (err) {
        if (aktif)
          setHasilUjian((p) => ({
            ...p,
            loading: false,
            error: "Gagal memuat hasil",
          }));
      }
    };
    muatHasil();
    const saatTerlihat = () => {
      if (document.visibilityState === "visible") muatHasil();
    };
    document.addEventListener("visibilitychange", saatTerlihat);
    const timer = setInterval(saatTerlihat, 60000);
    return () => {
      aktif = false;
      document.removeEventListener("visibilitychange", saatTerlihat);
      clearInterval(timer);
    };
  }, [pwaGateMode, nama, kelas, idSiswa]);

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
          if (item?.tampil === false) return false;
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
        .filter((item) => item?.kls === selectedKelas && item?.tampil !== false)
        .map((item) => item.mpl),
    ),
  ];

  // ======================================
  // CEK TOKEN
  // ======================================
  async function handleCheckToken(autoStart = false) {
    // Meminta fullscreen sebelum validasi/jaringan agar permintaan masih
    // berada dalam aktivasi pengguna; browser menolak permintaan tertunda.
    void enterFullscreen();

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
      const localMatch = !examSegarRef.current
        ? null
        : examData.find((item) => {
            if (!item?.kls || !item?.mpl || item?.tampil === false)
              return false;
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
            devId =
              "dev_" +
              Date.now() +
              "_" +
              Math.random().toString(36).slice(2, 9);
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
                "Akses ditolak: Akun Anda sedang aktif ujian di perangkat lain.",
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

  async function handleSubmitComplaint() {
    const message = complaintText.trim();
    if (!message || complaintLoading) return;
    if (!nama) {
      setComplaintError(
        "Identitas peserta belum siap. Tunggu sebentar lalu coba lagi.",
      );
      return;
    }

    setComplaintLoading(true);
    setComplaintError("");
    try {
      const result = await kirimPengaduan(nama, kelas, message);
      if (result?.status === "success") {
        setComplaintText("");
        setComplaintOpen(false);
        setComplaintNotice("Pengaduan berhasil dikirim kepada pengawas.");
        window.setTimeout(() => setComplaintNotice(""), 4500);
      } else {
        setComplaintError(
          result?.message || "Pengaduan belum berhasil dikirim. Coba lagi.",
        );
      }
    } catch (_) {
      setComplaintError("Koneksi bermasalah. Periksa internet lalu coba lagi.");
    } finally {
      setComplaintLoading(false);
    }
  }

  if (pwaGateMode !== "allowed") {
    const isCheckingPwa = pwaGateMode === "checking";
    const isStandaloneGate = pwaGateMode === "standalone-check";
    return (
      <main className="min-h-screen bg-gradient-to-br from-yellow-300 via-amber-200 to-white text-slate-800 flex items-center justify-center p-4 sm:p-6">
        <section className="w-full max-w-lg rounded-3xl border border-amber-200/90 bg-white/95 backdrop-blur-xl p-6 shadow-2xl sm:p-8">
          {isCheckingPwa ? (
            <div
              className="flex flex-col items-center gap-4 py-12"
              role="status"
            >
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
              <p className="text-sm font-semibold text-slate-600">
                Memeriksa mode aplikasi…
              </p>
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-200 flex items-center justify-center text-4xl mx-auto shadow-md">
                  📲
                </div>
                <h1 className="mt-4 text-2xl font-black text-slate-900">
                  {isStandaloneGate
                    ? "Konfirmasi Aplikasi PWA"
                    : "Instal atau Buka PWA"}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {isStandaloneGate
                    ? "Tekan deteksi untuk memastikan portal dibuka dari aplikasi PWA standalone."
                    : "Ujian Android harus dibuka dari aplikasi Portal Sekolah. Tab Chrome biasa tidak dapat melanjutkan tanpa pengecualian pengawas."}
                </p>
              </div>

              {isStandaloneGate ? (
                <button
                  type="button"
                  onClick={continueFromPwaGate}
                  className="mt-6 w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-4 font-black text-white shadow-lg shadow-blue-600/20 active:scale-[0.99] transition cursor-pointer"
                >
                  Deteksi PWA dan Lanjutkan
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={installPwaFromExamGate}
                    className="mt-6 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 px-5 py-4 font-black text-white shadow-lg shadow-orange-500/25 active:scale-[0.99] transition cursor-pointer"
                  >
                    📲 Instal PWA Sekarang
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setInstallStepsVisible((visible) => !visible)
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-5 py-3 font-bold text-slate-700 transition"
                  >
                    Cara instal / membuka aplikasi
                  </button>

                  {installStepsVisible && (
                    <ol className="mt-4 space-y-2 rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-700">
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
                    className="mt-6 border-t border-slate-200 pt-5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      continueFromPwaGate();
                    }}
                  >
                    <label
                      htmlFor="pwa-fallback-pin"
                      className="block text-sm font-bold text-slate-700"
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
                        className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-slate-900 outline-none focus:border-blue-600 focus:bg-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 font-black text-white transition"
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
                  className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 font-semibold"
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
        <div className="fixed inset-0 z-[99999] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200/90 rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center relative overflow-hidden">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-2xl mx-auto mb-3 shadow-md">
              ℹ️
            </div>
            <h2 className="text-xl font-black text-slate-900 mb-2 tracking-tight">
              Informasi Asesmen
            </h2>

            <p className="text-slate-600 text-xs sm:text-sm mb-5 whitespace-pre-line leading-relaxed">
              {tokenMessage}
            </p>

            <button
              onClick={async () => {
                setTokenModal(false);
                setTimeout(async () => {
                  await enterFullscreen();
                }, 300);
              }}
              className="w-full py-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white font-black text-sm transition shadow-lg shadow-blue-600/20 cursor-pointer"
            >
              Mengerti & Lanjutkan
            </button>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-gradient-to-br from-yellow-300 via-amber-200 to-white text-slate-900 relative overflow-hidden flex flex-col justify-start">
        {/* BACKGROUND GLOW DECORATIONS */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-yellow-400/40 blur-[130px] rounded-full" />
          <div className="absolute top-1/3 -right-32 w-96 h-96 bg-amber-300/35 blur-[130px] rounded-full" />
          <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-white/70 blur-[130px] rounded-full" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto w-full px-3.5 py-4 sm:px-6 sm:py-6 flex flex-col gap-3 sm:gap-4">
          {/* HEADER TOOLBAR: SEIMBANG, KOMPAK & CERAH */}
          <header className="bg-white/95 backdrop-blur-2xl border border-amber-200/90 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-xl shadow-amber-950/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* BRANDING */}
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-xl sm:text-2xl shadow-md shadow-amber-500/25 shrink-0 border border-amber-300/50 text-slate-950">
                  📝
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-black tracking-tight bg-gradient-to-r from-amber-950 via-yellow-900 to-slate-900 bg-clip-text text-transparent leading-none">
                    Portal Asesmen
                  </h1>
                  <p className="text-[11px] sm:text-xs text-amber-900/80 mt-1 flex items-center gap-1.5 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                    <span className="text-emerald-700 font-bold">Online</span> •
                    Ujian Digital Siswa
                  </p>
                </div>
              </div>

              {/* STATUS BADGE UNTUK MOBILE */}
              <div className="sm:hidden px-2.5 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black uppercase tracking-wider">
                Siap
              </div>
            </div>

            {/* ACTION BUTTONS GROUP: SEIMBANG & ERGONOMIS */}
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0">
              {/* TOMBOL REFRESH DATA TOKEN */}
              <button
                type="button"
                onClick={() => refreshExamData()}
                disabled={refreshing}
                className="flex-1 sm:flex-initial h-11 sm:h-10 px-3 rounded-xl bg-amber-100/80 hover:bg-amber-100 border border-amber-300/90 text-amber-950 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm whitespace-nowrap"
                title="Membaca ulang data ujian & token dari server"
              >
                <span
                  className={refreshing ? "animate-spin text-sm" : "text-sm"}
                >
                  🔄
                </span>
                <span>{refreshing ? "Memuat..." : "Segarkan"}</span>
              </button>

              {/* TOMBOL BANTUAN / PENGADUAN */}
              <button
                type="button"
                onClick={() => {
                  setComplaintError("");
                  setComplaintOpen(true);
                }}
                className="flex-1 sm:flex-initial h-11 sm:h-10 px-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-black transition flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-orange-500/20 cursor-pointer whitespace-nowrap"
                title="Laporkan kendala ujian ke pengawas"
              >
                <span>💬</span>
                <span>Bantuan</span>
              </button>

              {/* TOMBOL DASHBOARD SISWA */}
              <button
                type="button"
                onClick={() => router.push("/magang/dashboard_siswa")}
                className="flex-1 sm:flex-initial h-11 sm:h-10 px-3 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-slate-800 text-xs font-bold transition flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer whitespace-nowrap shadow-sm"
                title="Kembali ke Dashboard Siswa"
              >
                <span>←</span>
                <span>Dashboard</span>
              </button>
            </div>
          </header>

          {/* PESAN DARI ADMIN (JIKA ADA) - MERAH CERAH */}
          {pesan && (
            <div className="bg-gradient-to-r from-red-600 via-rose-500 to-red-600 border-2 border-red-300 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl shadow-red-500/25 flex items-center gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                📢
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-yellow-200">
                  PESAN DARI PENGAWAS
                </p>
                <p className="text-xs sm:text-sm font-black text-white leading-relaxed break-words mt-0.5">
                  {pesan}
                </p>
              </div>
            </div>
          )}

          {/* IDENTITAS SISWA: BERSIH, TERANG & KOMPAK */}
          <div className="bg-white/95 backdrop-blur-xl border border-amber-200/90 rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-lg shadow-amber-950/5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              {/* NAMA & AVATAR */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600 flex items-center justify-center text-xl shadow-md border border-amber-200 shrink-0 text-slate-950">
                  🎓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                      Peserta Ujian
                    </span>
                  </div>
                  <h2
                    className="text-sm sm:text-base font-black text-slate-900 truncate mt-0.5"
                    title={nama}
                  >
                    {nama || "Memuat peserta..."}
                  </h2>
                </div>
              </div>

              {/* PILLS IDENTITAS (KELAS & ID SISWA) */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                  <span className="text-amber-800/80 font-medium">Kelas:</span>
                  <span className="font-black text-amber-950">
                    {selectedKelas || kelas || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-yellow-50 border border-yellow-200 text-xs">
                  <span className="text-amber-800/80 font-medium">ID:</span>
                  <span className="font-black text-amber-950">
                    {idSiswa || "-"}
                  </span>
                </div>
                <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold">
                  <span>🔒</span>
                  <span>1 Siswa 1 HP</span>
                </div>
              </div>
            </div>
          </div>

          {/* HASIL UJIAN TERAKHIR SISWA */}
          <div className="bg-white/95 border border-emerald-200 rounded-2xl p-3.5 sm:p-4 shadow-lg shadow-emerald-950/5">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>📈</span>
                <span>Hasil Ujian Terakhir</span>
              </h3>
              {hasilUjian.loading && (
                <span className="text-[10px] text-slate-400 animate-pulse">
                  memperbarui...
                </span>
              )}
            </div>
            {hasilUjian.terakhir ? (
              <>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-black text-emerald-900 truncate">
                      {hasilUjian.terakhir.mapel}
                    </p>
                    <p className="text-[10px] text-emerald-800/80 font-mono">
                      {hasilUjian.terakhir.timestamp || "-"}
                    </p>
                  </div>
                  <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono whitespace-nowrap">
                    {hasilUjian.terakhir.nilai}
                  </span>
                </div>
                {hasilUjian.hasil.length > 1 && (
                  <ul className="mt-2 space-y-1">
                    {hasilUjian.hasil.slice(1, 6).map((h, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between text-[11px] text-slate-700 px-1"
                      >
                        <span className="truncate pr-2">{h.mapel}</span>
                        <span className="font-mono font-bold text-slate-800 whitespace-nowrap">
                          {h.nilai}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-[11px] text-slate-500">
                {hasilUjian.error
                  ? `⚠️ ${hasilUjian.error}`
                  : "Belum ada hasil ujian yang tercatat atas nama Anda."}
                {!hasilUjian.error && hasilUjian.diag && (
                  <span className="block text-[9px] text-slate-400 mt-0.5">
                    Server membaca {hasilUjian.diag.dibaca} respon,{" "}
                    {hasilUjian.diag.cocok} cocok dengan nama Anda
                    {hasilUjian.diag.sebagian > 0
                      ? ` (${hasilUjian.diag.sebagian} respon memuat sebagian kata nama Anda)`
                      : ""}
                    {hasilUjian.diag.namaDicari
                      ? ` • dicari: "${hasilUjian.diag.namaDicari}"`
                      : ""}
                    .
                  </span>
                )}
              </p>
            )}
          </div>

          {/* CARD PILIH UJIAN & FORM: CANTIK, BERSIH, TERANG, KOMPAK */}
          <div className="bg-white/95 backdrop-blur-2xl border border-amber-200/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-amber-950/10 relative overflow-hidden">
            {/* CORNER ACCENT GRADIENT */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-amber-300/20 blur-2xl rounded-full pointer-events-none" />

            <div className="flex items-center gap-2.5 mb-3.5 sm:mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-900 font-black text-sm">
                ✍️
              </div>
              <div>
                <h3 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  Formulir Akses Soal
                </h3>
                <p className="text-[11px] sm:text-xs text-amber-900/70">
                  Lengkapi jenjang, kelas, mata pelajaran, dan masukkan token
                </p>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {/* DROPDOWN GRID: JENJANG & KELAS BERSANDINGAN UNTUK HEMAT RUANG PADA HP */}
              <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                {/* JENJANG */}
                <div>
                  <label className="block mb-1 text-xs sm:text-sm text-slate-800 font-bold flex items-center gap-1">
                    <span>🏛️</span>
                    <span>Jenjang</span>
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
                    className="w-full bg-amber-50/40 hover:bg-white border border-amber-200 focus:border-amber-500 focus:bg-white rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3.5 outline-none transition text-slate-900 text-xs sm:text-sm font-semibold appearance-none cursor-pointer focus:ring-4 focus:ring-amber-400/20"
                  >
                    <option value="">Pilih Jenjang</option>
                    {jenjangList.map((j) => (
                      <option key={j} value={j}>
                        Tingkat {j}
                      </option>
                    ))}
                  </select>
                </div>

                {/* KELAS */}
                <div>
                  <label className="block mb-1 text-xs sm:text-sm text-slate-800 font-bold flex items-center gap-1">
                    <span>🏫</span>
                    <span>Kelas</span>
                  </label>
                  <select
                    value={selectedKelas}
                    onChange={(e) => {
                      setSelectedKelas(e.target.value);
                      setSelectedMapel("");
                      setToken("");
                      setExamLink("");
                    }}
                    disabled={!jenjang}
                    className="w-full bg-amber-50/40 hover:bg-white border border-amber-200 focus:border-amber-500 focus:bg-white rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3.5 outline-none transition text-slate-900 text-xs sm:text-sm font-semibold appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:ring-4 focus:ring-amber-400/20"
                  >
                    <option value="">
                      {jenjang ? "Pilih Kelas" : "Pilih Jenjang Dahulu"}
                    </option>
                    {kelasList.map((kls) => (
                      <option key={kls} value={kls}>
                        {kls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* MATA PELAJARAN */}
              <div>
                <label className="block mb-1 text-xs sm:text-sm text-slate-800 font-bold flex items-center gap-1">
                  <span>📚</span>
                  <span>Mata Pelajaran Ujian</span>
                </label>
                <select
                  value={selectedMapel}
                  onChange={(e) => {
                    setSelectedMapel(e.target.value);
                    setToken("");
                    setExamLink("");
                  }}
                  disabled={!selectedKelas}
                  className="w-full bg-amber-50/40 hover:bg-white border border-amber-200 focus:border-amber-500 focus:bg-white rounded-xl sm:rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3.5 outline-none transition text-slate-900 text-xs sm:text-sm font-semibold appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:ring-4 focus:ring-amber-400/20"
                >
                  <option value="">
                    {selectedKelas
                      ? mapelList.length > 0
                        ? "Pilih Mata Pelajaran"
                        : "Tidak ada jadwal ujian untuk kelas ini"
                      : "Pilih Kelas Dahulu"}
                  </option>
                  {mapelList.map((mpl) => (
                    <option key={mpl} value={mpl}>
                      {mpl}
                    </option>
                  ))}
                </select>
              </div>

              {/* TOKEN & ACTION TOMBOL MULAI UJIAN */}
              <div className="pt-1.5">
                <label className="block mb-1 text-xs sm:text-sm text-amber-900 font-bold flex items-center gap-1.5">
                  <span>🔑</span>
                  <span>Token Ujian (Diberikan Pengawas)</span>
                </label>

                <div className="flex flex-col sm:flex-row items-stretch gap-2.5 sm:gap-3">
                  {/* INPUT TOKEN */}
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => setToken(e.target.value.toUpperCase())}
                      disabled={loadingToken}
                      onKeyDown={async (e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        if (loadingToken) return;
                        handleCheckToken(true);
                      }}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="CONTOH: ABC123"
                      className="w-full h-12 sm:h-14 bg-amber-50/50 hover:bg-white border-2 border-amber-300 focus:border-amber-600 focus:bg-white rounded-xl sm:rounded-2xl px-4 outline-none transition text-slate-950 placeholder:text-slate-400 disabled:opacity-50 text-base sm:text-xl font-black tracking-widest uppercase font-mono focus:ring-4 focus:ring-amber-400/25"
                    />

                    {loadingToken && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-amber-600 border-t-transparent" />
                      </div>
                    )}
                  </div>

                  {/* TOMBOL MULAI UJIAN: HIJAU CERAH */}
                  <button
                    type="button"
                    onClick={() => handleCheckToken(true)}
                    disabled={loadingToken || !token.trim() || !selectedMapel}
                    className="h-12 sm:h-14 px-6 sm:px-8 rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-green-500 active:scale-95 text-white font-black text-sm sm:text-base shadow-xl shadow-green-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none shrink-0 border border-green-300/40"
                  >
                    {loadingToken ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
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
              </div>

              {/* TIPS CEPAT */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 flex items-start gap-2">
                <span className="text-amber-700 text-sm shrink-0 mt-0.5">
                  💡
                </span>
                <p className="text-amber-900 text-[11px] sm:text-xs leading-relaxed">
                  Setelah memasukkan token, Anda dapat langsung menekan tombol{" "}
                  <span className="font-extrabold text-amber-950">Enter</span>{" "}
                  pada keyboard atau klik{" "}
                  <span className="font-extrabold text-amber-950">
                    Mulai Ujian
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {complaintNotice && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-[100002] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-200/20 bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-2xl"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            ✓
          </span>
          <span className="flex-1">{complaintNotice}</span>
          <button
            type="button"
            aria-label="Tutup notifikasi"
            onClick={() => setComplaintNotice("")}
            className="rounded-lg px-2 py-1 text-white/70 hover:bg-white/10 hover:text-white"
          >
            ×
          </button>
        </div>
      )}

      {complaintOpen && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="exam-page-complaint-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/60 bg-white shadow-[0_28px_90px_-24px_rgba(0,0,0,0.7)]"
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-orange-500 to-amber-400 px-5 py-5 text-white sm:px-7 sm:py-6">
              <div
                aria-hidden="true"
                className="absolute -right-8 -top-12 h-36 w-36 rounded-full border-[18px] border-white/10"
              />
              <div className="relative flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/25 bg-white/15 shadow-inner">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6"
                  >
                    <path
                      d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H6l-3 2v-6.1A7.5 7.5 0 1 1 20 11.5Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M8 10h8M8 14h5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="exam-page-complaint-title"
                    className="text-lg font-black tracking-tight sm:text-xl"
                  >
                    Bantuan & Pengaduan
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed text-orange-50 sm:text-sm">
                    Laporkan kendala sebelum memulai ujian. Pengawas akan
                    menerima pesan beserta identitas Anda.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Tutup form pengaduan"
                  onClick={() => setComplaintOpen(false)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-black/10 text-lg font-bold text-white/90 transition hover:bg-black/20"
                >
                  ×
                </button>
              </div>
              <div className="relative mt-4 flex flex-wrap gap-2 text-[10px] font-semibold sm:text-xs">
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1">
                  {nama || "Memuat peserta…"}
                </span>
                <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1">
                  {kelas || "Kelas belum tersedia"}
                </span>
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <label
                htmlFor="exam-page-complaint-message"
                className="mb-2 block text-sm font-bold text-slate-800"
              >
                Ceritakan kendala yang Anda alami
              </label>
              <textarea
                id="exam-page-complaint-message"
                autoFocus
                value={complaintText}
                onChange={(event) => {
                  setComplaintText(event.target.value);
                  if (complaintError) setComplaintError("");
                }}
                placeholder="Contoh: token tidak dapat diverifikasi atau data ujian tidak tampil..."
                className="h-36 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-400 focus:bg-white focus:ring-4 focus:ring-orange-100"
              />
              {complaintError ? (
                <p
                  role="alert"
                  className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
                >
                  {complaintError}
                </p>
              ) : (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Gunakan untuk kendala yang berkaitan dengan portal atau ujian.
                </p>
              )}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  disabled={complaintLoading}
                  onClick={() => setComplaintOpen(false)}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-[0.99] disabled:opacity-50 sm:min-w-28"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={complaintLoading || !complaintText.trim()}
                  onClick={handleSubmitComplaint}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 px-5 py-3 text-sm font-extrabold text-white shadow-lg shadow-orange-200 transition hover:from-orange-700 hover:to-amber-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none sm:min-w-40"
                >
                  {complaintLoading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      Kirim ke Pengawas <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
