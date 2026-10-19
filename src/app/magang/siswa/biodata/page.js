"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  getBiodataSiswa,
  updateBiodataSiswa,
  uploadPhoto,
} from "../../lib/api";
import { getSession, isLoggedIn } from "../../lib/auth";

const generateUploadFileName = (prefix, id, ext) =>
  `${prefix}_${id}_${Date.now()}.${ext}`;

export default function BiodataSiswa() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadingIjazah, setUploadingIjazah] = useState(false);
  const [uploadingKk, setUploadingKk] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    fotoProfil: "",
    noHp: "",
    tempatLahir: "",
    tglLahir: "",
    ayah: "",
    pekerjaanAyah: "",
    kontakAyah: "",
    ibu: "",
    pekerjaanIbu: "",
    kontakIbu: "",
    anakKe: "",
    alamat: "",
    hobi: "",
    bakatKeahlian: "",
    transportasi: "",
    pelajaranDisukai: "",
    alasanDisukai: "",
    pelajaranTidakDisukai: "",
    alasanTidakDisukai: "",
    harapan: "",
    ijazahSmp: "",
    kartuKeluarga: "",
    totalNilai1: "",
    mapel1: "",
    nilaiRapor1: "",

    totalNilai2: "",
    mapel2: "",
    nilaiRapor2: "",

    totalNilai3: "",
    mapel3: "",
    nilaiRapor3: "",

    totalNilai4: "",
    mapel4: "",
    nilaiRapor4: "",

    nilaiRaporRata: "",
  });

  useEffect(() => {
    async function loadData() {
      if (!isLoggedIn()) return router.replace("/magang/login");
      const session = getSession();
      if (!session || session.role !== "siswa")
        return router.replace("/magang/login");

      setUser(session);
      try {
        const result = await getBiodataSiswa(session.id);
        if (result.success && result.data) {
          setForm({
            fotoProfil: result.data.fotoProfil || "",
            noHp: result.data.noHp || "",
            tempatLahir: result.data.tempatLahir || "",
            tglLahir: result.data.tglLahir || "",
            ayah: result.data.ayah || "",
            pekerjaanAyah: result.data.pekerjaanAyah || "",
            kontakAyah: result.data.kontakAyah || "",
            ibu: result.data.ibu || "",
            pekerjaanIbu: result.data.pekerjaanIbu || "",
            kontakIbu: result.data.kontakIbu || "",
            anakKe: result.data.anakKe || "",
            alamat: result.data.alamat || "",
            hobi: result.data.hobi || "",
            bakatKeahlian: result.data.bakatKeahlian || "",
            transportasi: result.data.transportasi || "",
            pelajaranDisukai: result.data.pelajaranDisukai || "",
            alasanDisukai: result.data.alasanDisukai || "",
            pelajaranTidakDisukai: result.data.pelajaranTidakDisukai || "",
            alasanTidakDisukai: result.data.alasanTidakDisukai || "",
            harapan: result.data.harapan || "",
            ijazahSmp: result.data.ijazahSmp || "",
            kartuKeluarga: result.data.kartuKeluarga || "",

            totalNilai1:
              result.data.totalNilai1 !== undefined &&
              result.data.totalNilai1 !== null
                ? String(result.data.totalNilai1)
                : "",
            mapel1:
              result.data.mapel1 !== undefined &&
              result.data.mapel1 !== null
                ? String(result.data.mapel1)
                : "",
            nilaiRapor1:
              result.data.nilaiRapor1 !== undefined &&
              result.data.nilaiRapor1 !== null
                ? String(result.data.nilaiRapor1)
                : "",

            totalNilai2:
              result.data.totalNilai2 !== undefined &&
              result.data.totalNilai2 !== null
                ? String(result.data.totalNilai2)
                : "",
            mapel2:
              result.data.mapel2 !== undefined &&
              result.data.mapel2 !== null
                ? String(result.data.mapel2)
                : "",
            nilaiRapor2:
              result.data.nilaiRapor2 !== undefined &&
              result.data.nilaiRapor2 !== null
                ? String(result.data.nilaiRapor2)
                : "",

            totalNilai3:
              result.data.totalNilai3 !== undefined &&
              result.data.totalNilai3 !== null
                ? String(result.data.totalNilai3)
                : "",
            mapel3:
              result.data.mapel3 !== undefined &&
              result.data.mapel3 !== null
                ? String(result.data.mapel3)
                : "",
            nilaiRapor3:
              result.data.nilaiRapor3 !== undefined &&
              result.data.nilaiRapor3 !== null
                ? String(result.data.nilaiRapor3)
                : "",

            totalNilai4:
              result.data.totalNilai4 !== undefined &&
              result.data.totalNilai4 !== null
                ? String(result.data.totalNilai4)
                : "",
            mapel4:
              result.data.mapel4 !== undefined &&
              result.data.mapel4 !== null
                ? String(result.data.mapel4)
                : "",
            nilaiRapor4:
              result.data.nilaiRapor4 !== undefined &&
              result.data.nilaiRapor4 !== null
                ? String(result.data.nilaiRapor4)
                : "",

            nilaiRaporRata:
              result.data.nilaiRaporRata !== undefined &&
              result.data.nilaiRaporRata !== null
                ? String(result.data.nilaiRaporRata)
                : "",
          });
        }
      } catch (err) {
        setError("Gagal mengambil data biodata.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [router]);

  // =====================================================
  // PERHITUNGAN RATA-RATA NILAI RAPOR (SEMESTER 1 - 4)
  // =====================================================
  // Hitung rata-rata per semester: Jumlah Seluruh Nilai ÷ Banyak Mapel
  function hitungRataSemester(total, mapel) {
    if (!total || !mapel) return "";
    const t = parseFloat(String(total).replace(",", "."));
    const m = parseFloat(String(mapel).replace(",", "."));
    if (isNaN(t) || isNaN(m) || m <= 0) return "";
    const avg = t / m;
    return Number.isInteger(avg) ? String(avg) : avg.toFixed(2);
  }

  // Hitung total rata-rata dari seluruh semester yang telah terhitung
  function hitungRataTotal(r1, r2, r3, r4) {
    const list = [r1, r2, r3, r4]
      .map((val) => {
        if (val === "" || val === null || val === undefined) return null;
        const num = parseFloat(String(val).replace(",", "."));
        return isNaN(num) ? null : num;
      })
      .filter((v) => v !== null);

    if (list.length === 0) return "";
    const total = list.reduce((acc, curr) => acc + curr, 0);
    const avg = total / list.length;
    return Number.isInteger(avg) ? String(avg) : avg.toFixed(2);
  }

  function handleNilaiRaporChange(e) {
    const { name, value } = e.target;
    setForm((prev) => {
      const updated = { ...prev, [name]: value };

      const r1 = hitungRataSemester(updated.totalNilai1, updated.mapel1);
      const r2 = hitungRataSemester(updated.totalNilai2, updated.mapel2);
      const r3 = hitungRataSemester(updated.totalNilai3, updated.mapel3);
      const r4 = hitungRataSemester(updated.totalNilai4, updated.mapel4);

      const rTotal = hitungRataTotal(r1, r2, r3, r4);

      return {
        ...updated,
        nilaiRapor1: r1,
        nilaiRapor2: r2,
        nilaiRapor3: r3,
        nilaiRapor4: r4,
        nilaiRaporRata: rTotal,
      };
    });
  }

  function handleChange(e) {
    const { name, value } = e.target;
    if (
      name.startsWith("totalNilai") ||
      name.startsWith("mapel") ||
      name.startsWith("nilaiRapor")
    ) {
      handleNilaiRaporChange(e);
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Fungsi untuk trigger klik input file tersembunyi
  function handleFotoClick() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  // Fungsi kompresi dan upload foto (Auto-Save ke Database)
  async function handleFotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFoto(true);
    setError("");

    try {
      // 1. Kompresi gambar dengan Canvas & Convert ke JPG (Otomatis 3:4)
      const compressedBase64 = await compressProfileImage(file);

      // 2. Upload ke Google Drive via API
      const fileName = generateUploadFileName("profil", user.id, "jpg");
      const result = await uploadPhoto(compressedBase64, fileName);

      if (result.success && result.data?.url) {
        const photoUrl = result.data.url;

        // 3. Update State Lokal
        setForm((prev) => ({ ...prev, fotoProfil: photoUrl }));

        // 4. OTOMATIS SIMPAN KE GOOGLE SHEETS (Auto Save)
        // Diperbarui agar lebih stabil dengan hanya mengirimkan id dan fotoProfil saja
        await updateBiodataSiswa({
          idSiswa: user.id,
          fotoProfil: photoUrl,
        });

        setMessage(
          "✅ Foto profil berhasil diupload & otomatis tersimpan ke database!",
        );
      } else {
        setError(result.message || "Gagal upload foto.");
      }
    } catch (err) {
      setError("Terjadi kesalahan saat memproses foto.");
    } finally {
      setUploadingFoto(false);
      e.target.value = null;
    }
  }

  // Helper fungsi untuk mengubah file PDF ke Base64 murni
  function getBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  }

  // =====================================================
  // UPLOAD DOKUMEN IJAZAH SMP
  // Support PDF + FOTO
  // =====================================================
  async function handleIjazahChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");

    try {
      const fileName = file.name || "";
      const extension = fileName.includes(".")
        ? fileName.split(".").pop().toLowerCase()
        : "";

      const allowedExtensions = ["jpg", "jpeg", "png", "pdf"];
      const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

      const validByExtension = allowedExtensions.includes(extension);
      const validByMime = allowedMimeTypes.includes(file.type);

      if (!validByExtension && !validByMime) {
        setError(
          "❌ Format tidak didukung. Silakan pilih file JPG, JPEG, PNG, atau PDF.",
        );
        e.target.value = "";
        return;
      }

      const isPDF = file.type === "application/pdf" || extension === "pdf";
      const isImage =
        file.type === "image/jpeg" ||
        file.type === "image/png" ||
        ["jpg", "jpeg", "png"].includes(extension);

      if (!isPDF && !isImage) {
        setError("❌ File tidak dikenali. Gunakan JPG, JPEG, PNG, atau PDF.");
        e.target.value = "";
        return;
      }

      if (isPDF && file.size > 10 * 1024 * 1024) {
        setError("❌ Ukuran PDF maksimal 10 MB.");
        e.target.value = "";
        return;
      }

      if (isImage && file.size > 5 * 1024 * 1024) {
        setError("❌ Ukuran foto maksimal 5 MB.");
        e.target.value = "";
        return;
      }

      setUploadingIjazah(true);

      let base64;
      let finalExtension;
      let mimeType;

      if (isPDF) {
        base64 = await getBase64(file);
        finalExtension = "pdf";
        mimeType = "application/pdf";
      } else {
        base64 = await compressDocumentImage(file, 900);
        finalExtension = "jpg";
        mimeType = "image/jpeg";
      }

      const uploadFileName = generateUploadFileName(
        "ijazah_smp",
        user.id,
        finalExtension,
      );

      console.log("UPLOAD DOKUMEN");
      console.log("Nama:", uploadFileName);
      console.log("MIME:", mimeType);
      console.log("Ukuran asli:", (file.size / 1024 / 1024).toFixed(2), "MB");

      const result = await uploadPhoto(base64, uploadFileName, mimeType);

      console.log("HASIL UPLOAD:", result);

      if (result?.success && result?.data?.url) {
        const fileUrl = result.data.url;

        setForm((prev) => ({
          ...prev,
          ijazahSmp: fileUrl,
        }));

        const saveResult = await updateBiodataSiswa({
          ...form,
          idSiswa: user.id,
          ijazahSmp: fileUrl,
        });

        console.log("HASIL SIMPAN BIODATA:", saveResult);

        if (saveResult?.success) {
          if (isPDF) {
            setMessage("✅ PDF berhasil diupload dan tersimpan otomatis.");
          } else {
            setMessage(
              "✅ Foto berhasil dikompres, diupload, dan tersimpan otomatis.",
            );
          }
        } else {
          setError(
            saveResult?.message ||
              "File berhasil diupload, tetapi URL gagal disimpan.",
          );
        }
      } else {
        setError(result?.message || "❌ Gagal mengupload dokumen.");
      }
    } catch (err) {
      console.error("ERROR UPLOAD DOKUMEN:", err);
      setError(
        "❌ Upload gagal. Pastikan file JPG, PNG, atau PDF dan coba lagi.",
      );
    } finally {
      setUploadingIjazah(false);
      e.target.value = "";
    }
  }

  // =====================================================
  // UPLOAD DOKUMEN KARTU KELUARGA (KK)
  // Support PDF + FOTO (sama dengan model dokumen TKA)
  // =====================================================
  async function handleKartuKeluargaChange(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    setError("");
    setMessage("");

    try {
      const fileName = file.name || "";
      const extension = fileName.includes(".")
        ? fileName.split(".").pop().toLowerCase()
        : "";

      const allowedExtensions = ["jpg", "jpeg", "png", "pdf"];
      const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];

      const validByExtension = allowedExtensions.includes(extension);
      const validByMime = allowedMimeTypes.includes(file.type);

      if (!validByExtension && !validByMime) {
        setError(
          "❌ Format tidak didukung. Silakan pilih file JPG, JPEG, PNG, atau PDF.",
        );
        e.target.value = "";
        return;
      }

      const isPDF = file.type === "application/pdf" || extension === "pdf";
      const isImage =
        file.type === "image/jpeg" ||
        file.type === "image/png" ||
        ["jpg", "jpeg", "png"].includes(extension);

      if (!isPDF && !isImage) {
        setError("❌ File tidak dikenali. Gunakan JPG, JPEG, PNG, atau PDF.");
        e.target.value = "";
        return;
      }

      if (isPDF && file.size > 10 * 1024 * 1024) {
        setError("❌ Ukuran PDF maksimal 10 MB.");
        e.target.value = "";
        return;
      }

      if (isImage && file.size > 5 * 1024 * 1024) {
        setError("❌ Ukuran foto maksimal 5 MB.");
        e.target.value = "";
        return;
      }

      setUploadingKk(true);

      let base64;
      let finalExtension;
      let mimeType;

      if (isPDF) {
        base64 = await getBase64(file);
        finalExtension = "pdf";
        mimeType = "application/pdf";
      } else {
        base64 = await compressDocumentImage(file, 900);
        finalExtension = "jpg";
        mimeType = "image/jpeg";
      }

      const uploadFileName = generateUploadFileName(
        "kartu_keluarga",
        user.id,
        finalExtension,
      );

      console.log("UPLOAD KARTU KELUARGA");
      console.log("Nama:", uploadFileName);
      console.log("MIME:", mimeType);
      console.log("Ukuran asli:", (file.size / 1024 / 1024).toFixed(2), "MB");

      const result = await uploadPhoto(base64, uploadFileName, mimeType);

      console.log("HASIL UPLOAD KK:", result);

      if (result?.success && result?.data?.url) {
        const fileUrl = result.data.url;

        setForm((prev) => ({
          ...prev,
          kartuKeluarga: fileUrl,
        }));

        const saveResult = await updateBiodataSiswa({
          ...form,
          idSiswa: user.id,
          kartuKeluarga: fileUrl,
        });

        console.log("HASIL SIMPAN BIODATA KK:", saveResult);

        if (saveResult?.success) {
          if (isPDF) {
            setMessage("✅ Kartu Keluarga (PDF) berhasil diupload dan tersimpan otomatis.");
          } else {
            setMessage(
              "✅ Kartu Keluarga (Foto) berhasil dikompres, diupload, dan tersimpan otomatis.",
            );
          }
        } else {
          setError(
            saveResult?.message ||
              "File Kartu Keluarga berhasil diupload, tetapi URL gagal disimpan.",
          );
        }
      } else {
        setError(result?.message || "❌ Gagal mengupload Kartu Keluarga.");
      }
    } catch (err) {
      console.error("ERROR UPLOAD KK:", err);
      setError(
        "❌ Upload Kartu Keluarga gagal. Pastikan file JPG, PNG, atau PDF dan coba lagi.",
      );
    } finally {
      setUploadingKk(false);
      e.target.value = "";
    }
  }

  // Helper fungsi untuk kompresi, crop otomatis portrait 3:4 dan resize
  // =====================================================
  // HELPER: Load gambar seefisien & seaman mungkin di semua HP
  // - createImageBitmap otomatis benerin EXIF orientation (penting
  //   untuk foto dari kamera iPhone/Android yang sering "terbalik").
  // - Fallback ke <img> untuk browser lama yang belum dukung penuh.
  // =====================================================
  async function loadImageSource(file) {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        });
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup: () => bitmap.close(),
        };
      } catch (err) {
        console.warn("createImageBitmap gagal, fallback ke <img>:", err);
      }
    }

    const objectUrl = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error("Gagal membaca gambar. File mungkin rusak."));
      el.src = objectUrl;
    });

    return {
      source: img,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      cleanup: () => URL.revokeObjectURL(objectUrl),
    };
  }

  // =====================================================
  // FUNGSI 1: KOMPRESI FOTO PROFIL
  // - WAJIB crop rasio 3:4 (potrait)
  // - Output SELALU tepat 900 x 1200 px, berapa pun ukuran crop-nya
  //   (canvas dipatok 900x1200, drawImage yang menyesuaikan skala)
  // - Kualitas JPEG diturunkan bertahap sampai muat batas ukuran
  // =====================================================
  function compressProfileImage(file, maxSizeKB = 900) {
    return new Promise((resolve, reject) => {
      (async () => {
        let cleanup;
        try {
          const {
            source: img,
            width: sourceWidth,
            height: sourceHeight,
            cleanup: c,
          } = await loadImageSource(file);
          cleanup = c;

          if (!sourceWidth || !sourceHeight) {
            throw new Error("Ukuran gambar tidak valid.");
          }

          const TARGET_RATIO = 3 / 4;
          const OUTPUT_WIDTH = 900;
          const OUTPUT_HEIGHT = 1200;
          const sourceRatio = sourceWidth / sourceHeight;

          let cropWidth, cropHeight, cropX, cropY;

          if (sourceRatio > TARGET_RATIO) {
            // Landscape / terlalu lebar -> potong kiri-kanan
            cropHeight = sourceHeight;
            cropWidth = Math.round(sourceHeight * TARGET_RATIO);
            cropX = Math.round((sourceWidth - cropWidth) / 2);
            cropY = 0;
          } else if (sourceRatio < TARGET_RATIO) {
            // Portrait terlalu tinggi -> potong atas-bawah
            cropWidth = sourceWidth;
            cropHeight = Math.round(sourceWidth / TARGET_RATIO);
            cropX = 0;
            cropY = Math.round((sourceHeight - cropHeight) / 2);
          } else {
            cropWidth = sourceWidth;
            cropHeight = sourceHeight;
            cropX = 0;
            cropY = 0;
          }

          // PENTING: canvas dipatok tetap 900x1200. drawImage otomatis
          // upscale/downscale crop ke ukuran ini -> hasil akhir SELALU
          // 900x1200 untuk semua siswa, tidak peduli ukuran foto asli.
          const canvas = document.createElement("canvas");
          canvas.width = OUTPUT_WIDTH;
          canvas.height = OUTPUT_HEIGHT;

          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("Browser tidak mendukung Canvas.");

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

          ctx.drawImage(
            img,
            cropX,
            cropY,
            cropWidth,
            cropHeight,
            0,
            0,
            OUTPUT_WIDTH,
            OUTPUT_HEIGHT,
          );

          let quality = 0.85;
          const minQuality = 0.35;
          const maxBytes = maxSizeKB * 1024;
          let dataUrl;

          while (true) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            const base64 = dataUrl.split(",")[1];
            const estimatedBytes = Math.ceil((base64.length * 3) / 4);

            console.log(
              "Foto profil:",
              `${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`,
              "Ukuran:",
              (estimatedBytes / 1024).toFixed(0),
              "KB",
              "Quality:",
              quality.toFixed(2),
            );

            if (estimatedBytes <= maxBytes || quality <= minQuality) break;
            quality -= 0.05;
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        } finally {
          if (cleanup) cleanup();
        }
      })();
    });
  }

  // =====================================================
  // FUNGSI 2: KOMPRESI DOKUMEN (Ijazah / Surat Pernyataan)
  // - TIDAK crop sama sekali, rasio asli 100% dipertahankan
  // - Hanya diperkecil kalau sisi terpanjang melebihi batas
  // - Kualitas JPEG diturunkan bertahap sampai muat batas ukuran
  // =====================================================
  function compressDocumentImage(file, maxSizeKB = 900) {
    return new Promise((resolve, reject) => {
      (async () => {
        let cleanup;
        try {
          const {
            source: img,
            width: srcW,
            height: srcH,
            cleanup: c,
          } = await loadImageSource(file);
          cleanup = c;

          if (!srcW || !srcH) {
            throw new Error("Ukuran gambar tidak valid.");
          }

          const MAX_DIMENSION = 1600; // cukup jelas dibaca, tidak boros
          let width = srcW;
          let height = srcH;

          if (width > height && width > MAX_DIMENSION) {
            height = Math.round(height * (MAX_DIMENSION / width));
            width = MAX_DIMENSION;
          } else if (height >= width && height > MAX_DIMENSION) {
            width = Math.round(width * (MAX_DIMENSION / height));
            height = MAX_DIMENSION;
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d", { alpha: false });
          if (!ctx) throw new Error("Browser tidak mendukung Canvas.");

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, width, height);

          // Tanpa crop -> gambar utuh, rasio asli dipertahankan
          ctx.drawImage(img, 0, 0, width, height);

          let quality = 0.85;
          const minQuality = 0.4; // dokumen tetap harus terbaca jelas
          const maxBytes = maxSizeKB * 1024;
          let dataUrl;

          while (true) {
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            const base64 = dataUrl.split(",")[1];
            const estimatedBytes = Math.ceil((base64.length * 3) / 4);

            console.log(
              "Dokumen foto:",
              `${width}x${height}`,
              "Ukuran:",
              (estimatedBytes / 1024).toFixed(0),
              "KB",
              "Quality:",
              quality.toFixed(2),
            );

            if (estimatedBytes <= maxBytes || quality <= minQuality) break;
            quality -= 0.05;
          }

          resolve(dataUrl);
        } catch (err) {
          reject(err);
        } finally {
          if (cleanup) cleanup();
        }
      })();
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await updateBiodataSiswa({
        idSiswa: user.id,
        fotoProfil: form.fotoProfil,
        noHp: form.noHp,
        tempatLahir: form.tempatLahir,
        tglLahir: form.tglLahir,
        ayah: form.ayah,
        pekerjaanAyah: form.pekerjaanAyah,
        kontakAyah: form.kontakAyah,
        ibu: form.ibu,
        pekerjaanIbu: form.pekerjaanIbu,
        kontakIbu: form.kontakIbu,
        anakKe: form.anakKe,
        alamat: form.alamat,
        hobi: form.hobi,
        bakatKeahlian: form.bakatKeahlian,
        transportasi: form.transportasi,
        pelajaranDisukai: form.pelajaranDisukai,
        alasanDisukai: form.alasanDisukai,
        pelajaranTidakDisukai: form.pelajaranTidakDisukai,
        alasanTidakDisukai: form.alasanTidakDisukai,
        harapan: form.harapan,
        ijazahSmp: form.ijazahSmp,
        kartuKeluarga: form.kartuKeluarga,
        totalNilai1: form.totalNilai1,
        mapel1: form.mapel1,
        nilaiRapor1: form.nilaiRapor1,

        totalNilai2: form.totalNilai2,
        mapel2: form.mapel2,
        nilaiRapor2: form.nilaiRapor2,

        totalNilai3: form.totalNilai3,
        mapel3: form.mapel3,
        nilaiRapor3: form.nilaiRapor3,

        totalNilai4: form.totalNilai4,
        mapel4: form.mapel4,
        nilaiRapor4: form.nilaiRapor4,

        nilaiRaporRata: form.nilaiRaporRata,
      });

      if (result.success) {
        setMessage("✅ Biodata berhasil disimpan.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setError(result.message || "Gagal menyimpan biodata.");
    } catch (err) {
      setError("Terjadi kesalahan saat menyimpan biodata.");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center font-bold">
        Memuat biodata...
      </main>
    );

  return (
    <main className="min-h-screen bg-slate-50 pb-12">
      <header className="sticky top-0 z-50 bg-blue-900 text-white shadow-md">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-black">👤 BIODATA SAYA</h1>
          </div>
          <button
            onClick={() => router.push("/magang/dashboard_siswa")}
            className="rounded bg-white/20 px-3 py-1 text-xs font-bold"
          >
            Kembali
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 mt-6">
        <div className="rounded-2xl bg-gradient-to-br from-blue-900 to-indigo-900 text-white p-5 shadow-lg relative">
          {/* ----- UI FOTO PROFIL (Tengah Atas) Tampilan 3:4 Portrait ----- */}
          <div className="flex justify-center -mt-12 mb-4">
            <div className="relative w-36 aspect-[3/4] rounded-xl border-4 border-indigo-900 bg-slate-200 shadow-xl overflow-hidden group">
              {form.fotoProfil ? (
                <>
                  <img
                    src={formatDriveUrl(form.fotoProfil)}
                    alt="Foto Profil"
                    className="w-full h-full object-cover"
                  />
                  <div
                    onClick={handleFotoClick}
                    className="absolute top-0 right-0 bg-black/40 hover:bg-black/60 text-white/80 text-[10px] font-bold px-2 py-1 rounded-bl-lg cursor-pointer transition-all"
                  >
                    Ganti
                  </div>
                </>
              ) : (
                <div
                  onClick={handleFotoClick}
                  className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-slate-300 transition-colors"
                >
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-[10px] font-bold text-slate-500 text-center px-2">
                    Klik Upload
                    <br />
                    Foto Latar Merah
                  </span>
                </div>
              )}

              {uploadingFoto && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                  <span className="text-xs font-black text-blue-800 animate-pulse">
                    Loading..
                  </span>
                </div>
              )}
            </div>
          </div>
          {/* ------------------------------------------ */}

          {/* Input File Tersembunyi */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFotoChange}
            className="hidden"
          />

          <p className="text-[10px] text-blue-300 font-bold uppercase tracking-wider text-center">
            Identitas Siswa
          </p>
          <h2 className="mt-1 text-xl font-black text-center">
            {user?.nama || "-"}
          </h2>
          <div className="mt-3 flex justify-center gap-4 text-xs font-medium text-blue-100">
            <span>ID: {user?.id}</span> | <span>📍 {user?.tempatMagang}</span>
          </div>
        </div>

        {message && (
          <div className="mt-4 rounded-xl bg-emerald-50 text-emerald-700 p-3 text-xs font-bold text-center">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 text-rose-700 p-3 text-xs font-bold text-center">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <Section title="📱 Data Siswa (Kontak & Lahir)">
            <Input
              label="No. HP / WhatsApp Pribadi"
              name="noHp"
              value={form.noHp}
              onChange={handleChange}
              placeholder="Contoh: 08123456789"
            />
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <Input
                label="Tempat Lahir"
                name="tempatLahir"
                value={form.tempatLahir}
                onChange={handleChange}
              />
              <Input
                label="Tanggal Lahir"
                name="tglLahir"
                value={form.tglLahir}
                onChange={handleChange}
                placeholder="DD/MM/YYYY"
              />
            </div>
          </Section>

          <Section title="🏠 Data Pribadi">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Anak Ke"
                name="anakKe"
                value={form.anakKe}
                onChange={handleChange}
              />
              <Input
                label="Transportasi ke Sekolah"
                name="transportasi"
                value={form.transportasi}
                onChange={handleChange}
              />
              <Input
                label="Hobi"
                name="hobi"
                value={form.hobi}
                onChange={handleChange}
              />
              <Textarea
                label="Bakat / Keahlian"
                name="bakatKeahlian"
                value={form.bakatKeahlian}
                onChange={handleChange}
                rows={1}
              />
            </div>
            <div className="mt-3">
              <Textarea
                label="Alamat Lengkap"
                name="alamat"
                value={form.alamat}
                onChange={handleChange}
                rows={2}
              />
            </div>
          </Section>

          <Section title="👨‍👩‍👦 Data Orang Tua">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400">
                  DATA AYAH/ WALI
                </p>
                <Input
                  label="Nama Ayah"
                  name="ayah"
                  value={form.ayah}
                  onChange={handleChange}
                />
                <Input
                  label="Pekerjaan"
                  name="pekerjaanAyah"
                  value={form.pekerjaanAyah}
                  onChange={handleChange}
                />
                <Input
                  label="Kontak"
                  name="kontakAyah"
                  value={form.kontakAyah}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                <p className="text-[10px] font-bold text-slate-400">
                  DATA IBU/ WALI
                </p>
                <Input
                  label="Nama Ibu"
                  name="ibu"
                  value={form.ibu}
                  onChange={handleChange}
                />
                <Input
                  label="Pekerjaan"
                  name="pekerjaanIbu"
                  value={form.pekerjaanIbu}
                  onChange={handleChange}
                />
                <Input
                  label="Kontak"
                  name="kontakIbu"
                  value={form.kontakIbu}
                  onChange={handleChange}
                />
              </div>
            </div>
          </Section>

          <Section title="📚 Minat Pelajaran & Harapan">
            <div className="grid sm:grid-cols-2 gap-3">
              <Input
                label="Pelajaran Disukai"
                name="pelajaranDisukai"
                value={form.pelajaranDisukai}
                onChange={handleChange}
              />
              <Input
                label="Alasan Menyukai"
                name="alasanDisukai"
                value={form.alasanDisukai}
                onChange={handleChange}
              />
              <Input
                label="Pelajaran Tidak Disukai"
                name="pelajaranTidakDisukai"
                value={form.pelajaranTidakDisukai}
                onChange={handleChange}
              />
              <Input
                label="Alasan Tidak Suka"
                name="alasanTidakDisukai"
                value={form.alasanTidakDisukai}
                onChange={handleChange}
              />
            </div>
            <div className="mt-4">
              <Textarea
                label="Harapan di SMKN 1 DAN CITA CITA KEDEPANNYA"
                name="harapan"
                value={form.harapan}
                onChange={handleChange}
                rows={3}
              />
            </div>
          </Section>

          {/* =================================================== */}
          {/* NILAI RAPOR (SEMESTER 1 - 4) */}
          {/* =================================================== */}
          <Section title="📊 Nilai Rapor (Semester 1 - 4)">
            <p className="text-xs text-slate-500 mb-4">
              Isi <strong>Jumlah Seluruh Nilai</strong> dan{" "}
              <strong>Banyak Mapel</strong> untuk masing-masing semester.
              Rata-rata setiap semester (Jumlah Nilai ÷ Banyak Mapel) dan
              rata-rata keseluruhan akan dihitung otomatis oleh sistem.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Semester 1 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all hover:border-blue-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-xs">
                        1
                      </span>
                      <span className="text-xs font-black uppercase text-slate-800">
                        Semester 1
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/70 border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-700 uppercase">
                        Rata-rata:
                      </span>
                      <span className="text-xs font-black text-blue-950">
                        {form.nilaiRapor1 || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Jumlah Seluruh Nilai
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        name="totalNilai1"
                        value={form.totalNilai1}
                        onChange={handleNilaiRaporChange}
                        placeholder="Contoh: 1150"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Banyak Mapel
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold text-sm">÷</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          name="mapel1"
                          value={form.mapel1}
                          onChange={handleNilaiRaporChange}
                          placeholder="Contoh: 14"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {form.totalNilai1 && form.mapel1 ? (
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200/90 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Perhitungan:</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {form.totalNilai1} ÷ {form.mapel1} ={" "}
                      <strong className="text-blue-700 font-bold">
                        {form.nilaiRapor1}
                      </strong>
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Card Semester 2 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all hover:border-blue-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-xs">
                        2
                      </span>
                      <span className="text-xs font-black uppercase text-slate-800">
                        Semester 2
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/70 border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-700 uppercase">
                        Rata-rata:
                      </span>
                      <span className="text-xs font-black text-blue-950">
                        {form.nilaiRapor2 || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Jumlah Seluruh Nilai
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        name="totalNilai2"
                        value={form.totalNilai2}
                        onChange={handleNilaiRaporChange}
                        placeholder="Contoh: 1160"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Banyak Mapel
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold text-sm">÷</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          name="mapel2"
                          value={form.mapel2}
                          onChange={handleNilaiRaporChange}
                          placeholder="Contoh: 14"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {form.totalNilai2 && form.mapel2 ? (
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200/90 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Perhitungan:</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {form.totalNilai2} ÷ {form.mapel2} ={" "}
                      <strong className="text-blue-700 font-bold">
                        {form.nilaiRapor2}
                      </strong>
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Card Semester 3 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all hover:border-blue-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-xs">
                        3
                      </span>
                      <span className="text-xs font-black uppercase text-slate-800">
                        Semester 3
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/70 border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-700 uppercase">
                        Rata-rata:
                      </span>
                      <span className="text-xs font-black text-blue-950">
                        {form.nilaiRapor3 || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Jumlah Seluruh Nilai
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        name="totalNilai3"
                        value={form.totalNilai3}
                        onChange={handleNilaiRaporChange}
                        placeholder="Contoh: 1180"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Banyak Mapel
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold text-sm">÷</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          name="mapel3"
                          value={form.mapel3}
                          onChange={handleNilaiRaporChange}
                          placeholder="Contoh: 14"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {form.totalNilai3 && form.mapel3 ? (
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200/90 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Perhitungan:</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {form.totalNilai3} ÷ {form.mapel3} ={" "}
                      <strong className="text-blue-700 font-bold">
                        {form.nilaiRapor3}
                      </strong>
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Card Semester 4 */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 transition-all hover:border-blue-300 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-xs">
                        4
                      </span>
                      <span className="text-xs font-black uppercase text-slate-800">
                        Semester 4
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100/70 border border-blue-200">
                      <span className="text-[10px] font-bold text-blue-700 uppercase">
                        Rata-rata:
                      </span>
                      <span className="text-xs font-black text-blue-950">
                        {form.nilaiRapor4 || "-"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Jumlah Seluruh Nilai
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        name="totalNilai4"
                        value={form.totalNilai4}
                        onChange={handleNilaiRaporChange}
                        placeholder="Contoh: 1200"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase text-slate-600 mb-1">
                        Banyak Mapel
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold text-sm">÷</span>
                        <input
                          type="number"
                          step="1"
                          min="1"
                          name="mapel4"
                          value={form.mapel4}
                          onChange={handleNilaiRaporChange}
                          placeholder="Contoh: 14"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {form.totalNilai4 && form.mapel4 ? (
                  <div className="mt-3 pt-2 border-t border-dashed border-slate-200/90 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Perhitungan:</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {form.totalNilai4} ÷ {form.mapel4} ={" "}
                      <strong className="text-blue-700 font-bold">
                        {form.nilaiRapor4}
                      </strong>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* HASIL TOTAL RATA-RATA CARD */}
            <div className="mt-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 via-indigo-50/60 to-blue-100/50 p-4 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <span className="text-xl">📈</span>
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase text-blue-950">
                      Rata-Rata Akhir Nilai Rapor (Semester 1 - 4)
                    </h3>
                    <p className="text-[11px] text-blue-700 font-medium">
                      {form.nilaiRaporRata
                        ? "Dihitung otomatis dari akumulasi rata-rata semester yang terisi"
                        : "Lengkapi jumlah seluruh nilai dan banyak mapel di atas"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-[10px] font-bold uppercase text-blue-600 sm:hidden">
                    Hasil:
                  </span>
                  <div className="min-w-[100px] text-center rounded-xl border border-blue-300 bg-white px-4 py-2 shadow-xs">
                    <span className="text-2xl font-black text-blue-900 tracking-tight">
                      {form.nilaiRaporRata || "-"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Section>

          {/* =================================================== */}
          {/* DOKUMEN PENDUKUNG (SURAT TKA & KARTU KELUARGA) */}
          {/* =================================================== */}
          <Section title="📄 Dokumen Pendukung">
            <p className="text-xs text-slate-500 mb-4">
              Silakan unggah dokumen persyaratan dalam format JPG, JPEG, PNG, atau PDF (Maks. 10 MB untuk PDF / 5 MB untuk foto).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* CARD 1: SURAT PERNYATAAN TKA */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📜</span>
                    <span className="text-xs font-black uppercase text-slate-800">
                      Upload Surat Pernyataan TKA
                    </span>
                  </div>
                  <label className="block w-full">
                    <span className="block normal-case text-[10px] text-slate-500 mb-2">
                      Scan atau foto Surat Pernyataan TKA
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={handleIjazahChange}
                      disabled={uploadingIjazah}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700 hover:file:bg-blue-200 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </label>

                  {uploadingIjazah && (
                    <div className="mt-3 text-xs font-bold text-blue-600 animate-pulse flex items-center gap-2">
                      ⏳ Sedang mengupload Surat Pernyataan TKA...
                    </div>
                  )}
                </div>

                {form.ijazahSmp && !uploadingIjazah && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <div>
                          <p className="text-xs font-black text-emerald-900">
                            Dokumen Terupload
                          </p>
                          <p className="text-[10px] text-emerald-600 font-medium">
                            Tersimpan di Google Drive
                          </p>
                        </div>
                      </div>

                      <a
                        href={form.ijazahSmp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 shrink-0 active:scale-95"
                      >
                        🔍 Lihat Dokumen
                      </a>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/70 flex items-center gap-1 text-[10px] text-emerald-800 overflow-hidden">
                      <span className="font-bold shrink-0">🔗 Link:</span>
                      <a
                        href={form.ijazahSmp}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline truncate text-blue-600 hover:text-blue-800"
                      >
                        {form.ijazahSmp}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* CARD 2: KARTU KELUARGA (KK) */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">👨‍👩‍👧‍👦</span>
                    <span className="text-xs font-black uppercase text-slate-800">
                      Upload Kartu Keluarga (KK)
                    </span>
                  </div>
                  <label className="block w-full">
                    <span className="block normal-case text-[10px] text-slate-500 mb-2">
                      Scan atau foto Kartu Keluarga asli / fotokopi legalisir
                    </span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                      onChange={handleKartuKeluargaChange}
                      disabled={uploadingKk}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-blue-100 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-blue-700 hover:file:bg-blue-200 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </label>

                  {uploadingKk && (
                    <div className="mt-3 text-xs font-bold text-blue-600 animate-pulse flex items-center gap-2">
                      ⏳ Sedang mengupload Kartu Keluarga...
                    </div>
                  )}
                </div>

                {form.kartuKeluarga && !uploadingKk && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">✅</span>
                        <div>
                          <p className="text-xs font-black text-emerald-900">
                            Dokumen Terupload
                          </p>
                          <p className="text-[10px] text-emerald-600 font-medium">
                            Tersimpan di Google Drive
                          </p>
                        </div>
                      </div>

                      <a
                        href={form.kartuKeluarga}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg shadow-xs transition-all flex items-center gap-1 shrink-0 active:scale-95"
                      >
                        🔍 Lihat Dokumen
                      </a>
                    </div>

                    <div className="pt-2 border-t border-emerald-200/70 flex items-center gap-1 text-[10px] text-emerald-800 overflow-hidden">
                      <span className="font-bold shrink-0">🔗 Link:</span>
                      <a
                        href={form.kartuKeluarga}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline truncate text-blue-600 hover:text-blue-800"
                      >
                        {form.kartuKeluarga}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <button
            type="submit"
            disabled={saving || uploadingFoto || uploadingIjazah || uploadingKk}
            className={`w-full rounded-xl text-white py-3.5 text-sm font-black shadow-md transition-all ${
              saving || uploadingFoto || uploadingIjazah || uploadingKk
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 active:scale-95"
            }`}
          >
            {saving
              ? "⏳ Menyimpan..."
              : uploadingFoto || uploadingIjazah || uploadingKk
                ? "⏳ Mengupload File..."
                : "💾 SIMPAN BIODATA"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
      <h2 className="text-sm font-black text-slate-800 border-b border-slate-100 pb-3 mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Input({ label, name, value, onChange, placeholder }) {
  return (
    <label className="block w-full">
      <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
        {label}
      </span>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500"
      />
    </label>
  );
}

function Textarea({ label, name, value, onChange, rows = 3 }) {
  return (
    <label className="block w-full">
      <span className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
        {label}
      </span>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-blue-500 resize-none"
      />
    </label>
  );
}

function formatDriveUrl(url) {
  if (!url) return "";

  let fileId = "";

  if (url.includes("/file/d/")) {
    fileId = url.split("/file/d/")[1].split("/")[0];
  } else if (url.includes("id=")) {
    fileId = url.split("id=")[1].split("&")[0];
  }

  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
  }

  return url;
}
