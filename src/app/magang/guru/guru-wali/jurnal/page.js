"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession } from "../../../lib/auth";
import { getDataSiswaWali, saveJurnalGuruWali } from "../../../lib/api";

export default function JurnalGuruWaliPage() {
  const router = useRouter();
  console.log("🔥 JURNAL GURU WALI PAGE AKTIF");

  const [idGuru, setIdGuru] = useState("");
  const [namaGuru, setNamaGuru] = useState("");

  const [siswa, setSiswa] = useState([]);

  // Individu
  const [idSiswa, setIdSiswa] = useState("");
  const [namaSiswa, setNamaSiswa] = useState("");
  const [kelas, setKelas] = useState("");

  // Kelompok
  const [siswaKelompok, setSiswaKelompok] = useState([]);

  const [tanggal, setTanggal] = useState("");

  const [formatPertemuan, setFormatPertemuan] = useState("Individu");

  const [topik, setTopik] = useState("");
  const [tindakLanjut, setTindakLanjut] = useState("");
  const [keterangan, setKeterangan] = useState("");

  const [loadingSiswa, setLoadingSiswa] = useState(true);

  const [loading, setLoading] = useState(false);

  const [message, setMessage] = useState("");

  const [messageType, setMessageType] = useState("");

  // =====================================================
  // INIT
  // =====================================================

  useEffect(() => {
    console.log("🔥 USE EFFECT JURNAL BERJALAN");

    const session = getSession();

    console.log("🔥 SESSION:", session);

    if (!session) {
      setMessage("Sesi guru tidak ditemukan. Silakan login kembali.");

      setMessageType("error");
      setLoadingSiswa(false);

      return;
    }

    const id = session.idGuru || session.id || session.ID_GURU || "";

    console.log("🔥 ID GURU:", id);

    if (!id) {
      setMessage("ID guru tidak ditemukan pada sesi login.");

      setMessageType("error");
      setLoadingSiswa(false);

      return;
    }

    const idGuruFinal = String(id).trim();

    setIdGuru(idGuruFinal);

    loadSiswa(idGuruFinal);
  }, []);

  // =====================================================
  // LOAD SISWA WALI
  // =====================================================

  async function loadSiswa(idGuru) {
    console.log("🚀 LOAD SISWA GURU WALI:", idGuru);

    try {
      setLoadingSiswa(true);

      const result = await getDataSiswaWali(idGuru);

      console.log("📦 HASIL getDataSiswaWali:", result);

      if (result && result.success && Array.isArray(result.data)) {
        console.log("✅ JUMLAH SISWA:", result.data.length);

        setSiswa(result.data);

        // ------------------------------------------------
        // AMBIL NAMA GURU
        //
        // Data berasal dari:
        // SISWA -> NAMA_GURU
        //
        // Semua siswa wali seharusnya memiliki
        // nama guru yang sama.
        // ------------------------------------------------

        if (result.data.length > 0) {
          const namaGuruData = String(result.data[0].namaGuru || "").trim();

          setNamaGuru(namaGuruData);

          console.log("👨‍🏫 NAMA GURU:", namaGuruData);
        }

        // ------------------------------------------------
        // SIAPKAN DAFTAR KELOMPOK
        // ------------------------------------------------

        setSiswaKelompok(result.data);
      } else {
        setSiswa([]);

        setSiswaKelompok([]);

        setMessage(result?.message || "Data siswa wali tidak ditemukan.");

        setMessageType("error");
      }
    } catch (error) {
      console.error("❌ ERROR LOAD SISWA:", error);

      setMessage("Gagal mengambil data siswa.");

      setMessageType("error");
    } finally {
      setLoadingSiswa(false);
    }
  }

  // =====================================================
  // PARSE NAMA + KELAS
  // =====================================================

  function parseNamaKelas(namaLengkap) {
    const text = String(namaLengkap || "").trim();

    let nama = text;
    let kelasData = "";

    const match = text.match(/\s*\[([^\]]+)\]\s*$/);

    if (match) {
      kelasData = match[1].trim();

      nama = text.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
    }

    return {
      nama,
      kelas: kelasData,
    };
  }

  // =====================================================
  // PILIH SISWA INDIVIDU
  // =====================================================

  function handlePilihSiswa(e) {
    const id = e.target.value;

    console.log("👆 SISWA DIPILIH:", id);

    setIdSiswa(id);

    const data = siswa.find(
      (item) => String(item.idSiswa).trim() === String(id).trim(),
    );

    console.log("👨‍🎓 DATA SISWA TERPILIH:", data);

    if (!data) {
      setNamaSiswa("");
      setKelas("");

      return;
    }

    const hasil = parseNamaKelas(data.nama);

    setNamaSiswa(hasil.nama);

    setKelas(hasil.kelas);

    console.log("✅ HASIL SISWA:", {
      idSiswa: id,
      nama: hasil.nama,
      kelas: hasil.kelas,
    });
  }

  // =====================================================
  // GANTI FORMAT PERTEMUAN
  // =====================================================

  function handleFormatChange(e) {
    const format = e.target.value;

    setFormatPertemuan(format);

    // ---------------------------------------------------
    // JIKA KELOMPOK
    // SEMUA SISWA OTOMATIS DIPILIH
    // ---------------------------------------------------

    if (format === "Kelompok") {
      setSiswaKelompok([...siswa]);

      setIdSiswa("");

      setNamaSiswa("");

      setKelas("");
    } else {
      // -------------------------------------------------
      // KEMBALI KE INDIVIDU
      // -------------------------------------------------

      setSiswaKelompok([]);

      setIdSiswa("");

      setNamaSiswa("");

      setKelas("");
    }
  }

  // =====================================================
  // HAPUS SISWA DARI KELOMPOK
  // =====================================================

  function hapusSiswaKelompok(idSiswa) {
    console.log("❌ HAPUS DARI KELOMPOK:", idSiswa);

    setSiswaKelompok((prev) =>
      prev.filter(
        (item) => String(item.idSiswa).trim() !== String(idSiswa).trim(),
      ),
    );
  }

  // =====================================================
  // SIMPAN JURNAL
  // =====================================================

  async function handleSubmit(e) {
    e.preventDefault();

    setMessage("");
    setMessageType("");

    // ---------------------------------------------------
    // VALIDASI GURU
    // ---------------------------------------------------

    if (!idGuru) {
      setMessage("ID guru tidak ditemukan.");

      setMessageType("error");

      return;
    }

    // ---------------------------------------------------
    // VALIDASI FORMAT
    // ---------------------------------------------------

    if (formatPertemuan === "Individu") {
      if (!idSiswa) {
        setMessage("Silakan pilih siswa.");

        setMessageType("error");

        return;
      }
    } else {
      if (siswaKelompok.length === 0) {
        setMessage("Tidak ada siswa dalam kelompok.");

        setMessageType("error");

        return;
      }
    }

    // ---------------------------------------------------
    // VALIDASI TANGGAL
    // ---------------------------------------------------

    if (!tanggal) {
      setMessage("Tanggal pertemuan wajib diisi.");

      setMessageType("error");

      return;
    }

    // ---------------------------------------------------
    // VALIDASI TOPIK
    // ---------------------------------------------------

    if (!topik.trim()) {
      setMessage("Topik atau masalah wajib diisi.");

      setMessageType("error");

      return;
    }

    // ---------------------------------------------------
    // DATA YANG DIKIRIM
    // ---------------------------------------------------

    let data;

    if (formatPertemuan === "Individu") {
      data = {
        idGuru,

        idSiswa,

        tanggal,

        formatPertemuan,

        topik: topik.trim(),

        tindakLanjut: tindakLanjut.trim(),

        keterangan: keterangan.trim(),

        fotoUrl: "",

        fotoId: "",
      };
    } else {
      data = {
        idGuru,

        idSiswaList: siswaKelompok.map((item) => item.idSiswa),

        tanggal,

        formatPertemuan,

        topik: topik.trim(),

        tindakLanjut: tindakLanjut.trim(),

        keterangan: keterangan.trim(),

        fotoUrl: "",

        fotoId: "",
      };
    }

    console.log("📤 DATA JURNAL DIKIRIM:", data);

    // ---------------------------------------------------
    // SIMPAN
    // ---------------------------------------------------

    try {
      setLoading(true);

      const result = await saveJurnalGuruWali(data);

      console.log("📥 HASIL SIMPAN:", result);

      if (result?.success) {
        setMessage("✅ Jurnal berhasil disimpan.");

        setMessageType("success");

        // ------------------------------------------------
        // RESET FORM
        // ------------------------------------------------

        setTanggal("");

        setTopik("");

        setTindakLanjut("");

        setKeterangan("");

        setIdSiswa("");

        setNamaSiswa("");

        setKelas("");

        setFormatPertemuan("Individu");

        setSiswaKelompok([]);
      } else {
        setMessage(result?.message || "Jurnal gagal disimpan.");

        setMessageType("error");
      }
    } catch (error) {
      console.error("❌ ERROR SIMPAN:", error);

      setMessage("Terjadi kesalahan saat menyimpan jurnal.");

      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // TAMPILAN
  // =====================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        {/* HEADER */}

        <div
          style={{
            background: "linear-gradient(135deg,#2563eb,#0ea5e9)",
            color: "white",
            padding: "24px",
            borderRadius: "18px",
            marginBottom: "20px",
            position: "relative",
          }}
        >
          {/* TOMBOL KEMBALI */}
          <button
            type="button"
            onClick={() => router.push("/magang/guru/guru-wali")}
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              border: "1px solid rgba(255,255,255,0.35)",
              borderRadius: "10px",
              padding: "8px 14px",
              background: "rgba(255,255,255,0.12)",
              color: "white",
              fontSize: "13px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⬅️ Kembali
          </button>

          <h1
            style={{
              margin: 0,
              fontSize: "25px",
              paddingRight: "100px",
            }}
          >
            📘 Jurnal Guru Wali
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              opacity: 0.9,
              paddingRight: "100px",
            }}
          >
            Dokumentasi kegiatan dan pembinaan siswa wali
          </p>
        </div>

        {/* FORM */}

        <form
          onSubmit={handleSubmit}
          style={{
            background: "white",
            padding: "24px",
            borderRadius: "18px",
            boxShadow: "0 4px 18px rgba(0,0,0,0.06)",
          }}
        >
          {/* GURU WALI */}

          <div
            style={{
              marginBottom: "18px",
              fontSize: "13px",
              color: "#64748b",
            }}
          >
            <span>Guru Wali:</span>

            <strong
              style={{
                marginLeft: "6px",
                color: "#1e293b",
              }}
            >
              {namaGuru || "-"}
            </strong>
          </div>
          {/* FORMAT */}

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label>
              <strong>Format Pertemuan</strong>
            </label>

            <select
              value={formatPertemuan}
              onChange={handleFormatChange}
              style={inputStyle}
            >
              <option value="Individu">Individu</option>

              <option value="Kelompok">Kelompok</option>
            </select>
          </div>

          {/* =================================================
              INDIVIDU
          ================================================= */}

          {formatPertemuan === "Individu" && (
            <>
              {/* SISWA */}

              <div
                style={{
                  marginBottom: "18px",
                }}
              >
                <label>
                  <strong>Siswa</strong>
                </label>

                <select
                  value={idSiswa}
                  onChange={handlePilihSiswa}
                  disabled={loadingSiswa}
                  style={inputStyle}
                >
                  <option value="">
                    {loadingSiswa ? "Memuat siswa..." : "Pilih siswa"}
                  </option>

                  {siswa.map((item, index) => (
                    <option key={item.idSiswa || index} value={item.idSiswa}>
                      {parseNamaKelas(item.nama).nama}
                      {" ["}
                      {parseNamaKelas(item.nama).kelas}
                      {"]"}
                    </option>
                  ))}
                </select>
              </div>

              {/* IDENTITAS SISWA */}

              {idSiswa && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "12px",
                    marginBottom: "18px",
                  }}
                >
                  <div>
                    <label>
                      <strong>Nama</strong>
                    </label>

                    <input
                      value={namaSiswa}
                      readOnly
                      style={{
                        ...inputStyle,
                        background: "#f3f4f6",
                      }}
                    />
                  </div>

                  <div>
                    <label>
                      <strong>Kelas</strong>
                    </label>

                    <input
                      value={kelas}
                      readOnly
                      style={{
                        ...inputStyle,
                        background: "#f3f4f6",
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* =================================================
              KELOMPOK
          ================================================= */}

          {formatPertemuan === "Kelompok" && (
            <div
              style={{
                marginBottom: "20px",
              }}
            >
              <label>
                <strong>Siswa yang Mengikuti Pertemuan</strong>
              </label>

              <div
                style={{
                  marginTop: "8px",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  overflow: "hidden",
                }}
              >
                {siswaKelompok.length === 0 ? (
                  <div
                    style={{
                      padding: "18px",
                      color: "#64748b",
                      textAlign: "center",
                    }}
                  >
                    Tidak ada siswa.
                  </div>
                ) : (
                  siswaKelompok.map((item, index) => {
                    const identitas = parseNamaKelas(item.nama);

                    return (
                      <div
                        key={item.idSiswa || index}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "11px 13px",
                          borderBottom:
                            index < siswaKelompok.length - 1
                              ? "1px solid #e2e8f0"
                              : "none",
                        }}
                      >
                        <div
                          style={{
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "#1e293b",
                            }}
                          >
                            {identitas.nama}
                          </div>

                          <div
                            style={{
                              fontSize: "12px",
                              color: "#64748b",
                              marginTop: "2px",
                            }}
                          >
                            Kelas: {identitas.kelas || "-"}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => hapusSiswaKelompok(item.idSiswa)}
                          style={{
                            flexShrink: 0,
                            width: "34px",
                            height: "34px",
                            border: "none",
                            borderRadius: "50%",
                            background: "#fee2e2",
                            color: "#dc2626",
                            fontSize: "17px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                          title="Keluarkan siswa"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  fontSize: "13px",
                  color: "#64748b",
                }}
              >
                Total siswa:
                <strong
                  style={{
                    marginLeft: "5px",
                    color: "#2563eb",
                  }}
                >
                  {siswaKelompok.length}
                </strong>
              </div>
            </div>
          )}

          {/* TANGGAL */}

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label>
              <strong>Tanggal Pertemuan</strong>
            </label>

            <input
              type="date"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* TOPIK */}

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label>
              <strong>Topik / Masalah</strong>
            </label>

            <textarea
              value={topik}
              onChange={(e) => setTopik(e.target.value)}
              rows={4}
              placeholder="Tuliskan topik, masalah, atau pembahasan..."
              style={inputStyle}
            />
          </div>

          {/* TINDAK LANJUT */}

          <div
            style={{
              marginBottom: "18px",
            }}
          >
            <label>
              <strong>Tindak Lanjut</strong>
            </label>

            <textarea
              value={tindakLanjut}
              onChange={(e) => setTindakLanjut(e.target.value)}
              rows={4}
              placeholder="Tuliskan tindak lanjut..."
              style={inputStyle}
            />
          </div>

          {/* KETERANGAN */}

          <div
            style={{
              marginBottom: "22px",
            }}
          >
            <label>
              <strong>Keterangan</strong>
            </label>

            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={3}
              placeholder="Keterangan tambahan..."
              style={inputStyle}
            />
          </div>

          {/* PESAN */}

          {message && (
            <div
              style={{
                padding: "12px 14px",
                marginBottom: "18px",
                borderRadius: "10px",
                background: messageType === "success" ? "#dcfce7" : "#fee2e2",
                color: messageType === "success" ? "#166534" : "#991b1b",
              }}
            >
              {message}
            </div>
          )}

          {/* BUTTON */}

          <button
            type="submit"
            disabled={loading || loadingSiswa}
            style={{
              width: "100%",
              border: "none",
              borderRadius: "12px",
              padding: "14px",
              background: loading ? "#94a3b8" : "#2563eb",
              color: "white",
              fontSize: "16px",
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Menyimpan..." : "💾 Simpan Jurnal"}
          </button>
        </form>
      </div>
    </main>
  );
}

// =====================================================
// STYLE
// =====================================================

const inputStyle = {
  width: "100%",

  boxSizing: "border-box",

  padding: "11px 12px",

  marginTop: "6px",

  border: "1px solid #d1d5db",

  borderRadius: "10px",

  fontSize: "14px",

  outline: "none",

  fontFamily: "inherit",
};
