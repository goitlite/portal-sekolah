import assert from "node:assert/strict";
import test from "node:test";
import {
  buatPayloadSinkronAuditForm,
  deteksiJoki,
  parseTimestampMs,
} from "./auditAsesmenHelper.js";

test("parses Indonesian and US-formatted dates as the same UTC+7 timestamp", () => {
  const formTime = parseTimestampMs("14/11/2026 23:49:06");
  assert.equal(
    formTime,
    parseTimestampMs("11/14/2026 23:49:06"),
  );
  assert.equal(
    formTime - parseTimestampMs("2026-11-14T16:45:41.000Z"),
    205000,
  );
});

test("keeps an account with its own response as a time-based candidate", () => {
  const siswa = [
    {
      nama: "Budi",
      kelas: "XI TKJ 1",
      id_siswa: "budi-id",
      riwayat_sesi: [],
    },
    {
      nama: "Nico",
      kelas: "XI TKJ 1",
      id_siswa: "nico-id",
      riwayat_sesi: [
        { mapel: "Matematika", waktu: "2026-11-14T08:00:00+07:00" },
      ],
    },
  ];
  const responses = [
    {
      nama: "Budi",
      kelas: "XI TKJ 1",
      mapel: "Matematika",
      nilai: "90",
      timestamp: "2026-11-14T08:35:00+07:00",
      rowOrder: 3,
    },
    {
      nama: "Nico",
      kelas: "XI TKJ 1",
      mapel: "Matematika",
      nilai: "80",
      timestamp: "2026-11-14T08:10:00+07:00",
      rowOrder: 2,
    },
  ];

  const result = deteksiJoki(siswa, responses, "Matematika");
  const kasusBudi = result.kasus.find((kasus) => kasus.korban.nama === "Budi");

  assert.ok(kasusBudi);
  assert.equal(kasusBudi.pelaku.nama, "Nico");
  assert.equal(kasusBudi.tingkat, "mungkin");
  assert.equal(result.responTidakSah.size, 0);

  const payload = buatPayloadSinkronAuditForm(
    siswa,
    responses,
    "Matematika",
    result,
  );
  const auditBudi = payload.find((item) => item.id_siswa === "budi-id");
  assert.equal(auditBudi.nilai_form, "90");
  assert.match(auditBudi.ket_nilai, /^INDIKASI LOG - PERLU VERIFIKASI/);
});

test("does not flag a closer late login when the form-name owner has a valid session", () => {
  const siswa = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      id_siswa: "dianto-id",
      riwayat_sesi: [
        { mapel: "PKPJ 2026", waktu: "2026-11-14T23:18:00+07:00" },
      ],
    },
    {
      nama: "Bella Julianti",
      kelas: "XI TKJ 1",
      id_siswa: "bella-id",
      riwayat_sesi: [
        { mapel: "PKPJ 2026", waktu: "2026-11-14T23:45:00+07:00" },
      ],
    },
  ];
  const responses = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ 2026",
      nilai: "90",
      timestamp: "2026-11-14T23:47:00+07:00",
      rowOrder: 5,
    },
  ];

  const result = deteksiJoki(siswa, responses, "PKPJ 2026");
  assert.equal(result.kasus.length, 0);
});

test("reports a shared device as a supporting signal when both accounts have valid sessions", () => {
  const siswa = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      id_siswa: "dianto-id",
      riwayat_sesi: [
        {
          mapel: "PKPJ 2026",
          waktu: "2026-11-14T07:30:00+07:00",
          device: "shared-device",
        },
      ],
    },
    {
      nama: "Bella Julianti",
      kelas: "XI TKJ 1",
      id_siswa: "bella-id",
      riwayat_sesi: [
        {
          mapel: "PKPJ 2026",
          waktu: "2026-11-14T08:15:00+07:00",
          device: "shared-device",
        },
        {
          mapel: "PKPJ 2026",
          waktu: "2026-11-14T08:19:00+07:00",
          device: "another-device",
        },
      ],
    },
  ];
  const responses = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ 2026",
      nilai: "90",
      timestamp: "2026-11-14T08:20:00+07:00",
    },
  ];

  const result = deteksiJoki(siswa, responses, "PKPJ 2026");
  const [auditDianto] = buatPayloadSinkronAuditForm(
    siswa,
    responses,
    "PKPJ 2026",
    result,
  );
  const [kasus] = result.kasus;

  assert.ok(kasus);
  assert.equal(kasus.pelaku.nama, "Bella Julianti");
  assert.equal(kasus.jenisIndikasi, "perangkat_sama");
  assert.match(kasus.alasan, /device_id yang sama/);
  assert.match(auditDianto.ket_nilai, /indikasi device_id sama/);
});

test("applies the two-hour boundary inclusively and excludes older sessions", () => {
  const pemilik = {
    nama: "Dianto Maha",
    kelas: "XI TKJ 1",
    id_siswa: "dianto-id",
    riwayat_sesi: [
      { mapel: "PKPJ 2026", waktu: "2026-11-14T06:20:00+07:00" },
    ],
  };
  const kandidat = {
    nama: "Bella Julianti",
    kelas: "XI TKJ 1",
    id_siswa: "bella-id",
    riwayat_sesi: [
      { mapel: "PKPJ 2026", waktu: "2026-11-14T08:15:00+07:00" },
    ],
  };
  const responses = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ 2026",
      nilai: "90",
      timestamp: "2026-11-14T08:20:00+07:00",
    },
  ];

  assert.equal(
    deteksiJoki([pemilik, kandidat], responses, "PKPJ 2026").kasus.length,
    0,
  );
  const diLuarBatas = {
    ...pemilik,
    riwayat_sesi: [
      { mapel: "PKPJ 2026", waktu: "2026-11-14T06:19:59+07:00" },
    ],
  };
  const hasil = deteksiJoki(
    [diLuarBatas, kandidat],
    responses,
    "PKPJ 2026",
  );

  assert.equal(hasil.kasus.length, 1);
  assert.equal(hasil.kasus[0].pelaku.nama, "Bella Julianti");
});

test("uses active session metadata when the session log entry is missing", () => {
  const siswa = [
    {
      nama: "Budi",
      kelas: "XI TKJ 1",
      id_siswa: "budi-id",
      riwayat_sesi: [],
      status_sesi: "AKTIF",
      mapel_aktif: "Matematika",
    },
  ];
  const responses = [
    {
      nama: "Budi",
      kelas: "XI TKJ 1",
      mapel: "Matematika",
      nilai: "90",
      timestamp: "2026-11-14T08:15:00+07:00",
    },
  ];

  assert.equal(deteksiJoki(siswa, responses, "Matematika").kasus.length, 0);
});

test("keeps a very close alternate candidate despite active owner metadata", () => {
  const siswa = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      id_siswa: "dianto-id",
      riwayat_sesi: [],
      status_sesi: "AKTIF",
      mapel_aktif: "PKPJ 2026",
    },
    {
      nama: "Bella Julianti",
      kelas: "XI TKJ 1",
      id_siswa: "bella-id",
      riwayat_sesi: [
        { mapel: "PKPJ 2026", waktu: "14/11/2026 23:45:41" },
      ],
    },
  ];
  const responses = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ 2026",
      nilai: "17 / 100",
      timestamp: "14/11/2026 23:49:06",
      rowOrder: 6,
    },
  ];

  const result = deteksiJoki(siswa, responses, "PKPJ 2026");
  const kasusDianto = result.kasus.find(
    (kasus) => kasus.korban.nama === "Dianto Maha",
  );

  assert.ok(kasusDianto);
  assert.equal(kasusDianto.pelaku.nama, "Bella Julianti");
  assert.equal(kasusDianto.tingkat, "mungkin");
  assert.match(kasusDianto.alasan, /toleransi waktu/);
});

test("marks the summary when only a later response is indicated", () => {
  const siswa = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      id_siswa: "dianto-id",
      riwayat_sesi: [],
      status_sesi: "AKTIF",
      mapel_aktif: "PKPJ 2026",
    },
    {
      nama: "Bella Julianti",
      kelas: "XI TKJ 1",
      id_siswa: "bella-id",
      riwayat_sesi: [
        { mapel: "PKPJ 2026", waktu: "14/11/2026 23:45:41" },
      ],
    },
  ];
  const responses = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ 2026",
      nilai: "17 / 100",
      timestamp: "14/11/2026 22:33:04",
      rowOrder: 3,
    },
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ 2026",
      nilai: "17 / 100",
      timestamp: "14/11/2026 23:49:06",
      rowOrder: 6,
    },
  ];
  const hasilDeteksi = deteksiJoki(siswa, responses, "PKPJ 2026");
  const payload = buatPayloadSinkronAuditForm(
    siswa,
    responses,
    "",
    hasilDeteksi,
  );
  const auditDianto = payload.find((item) => item.id_siswa === "dianto-id");

  assert.equal(hasilDeteksi.kasus.length, 1);
  assert.equal(hasilDeteksi.kasus[0].pelaku.nama, "Bella Julianti");
  assert.equal(auditDianto.nilai_form, "17 / 100");
  assert.match(auditDianto.ket_nilai, /^INDIKASI LOG - PERLU VERIFIKASI/);
  assert.match(auditDianto.ket_nilai, /23:49:06/);
  assert.match(auditDianto.ket_nilai, /kandidat waktu: Bella Julianti/);
  assert.match(auditDianto.ket_nilai, /audit mencakup semua respon/);
});

test("still evaluates logs when a response spreadsheet is assigned to multiple subjects", () => {
  const siswa = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      id_siswa: "dianto-id",
      riwayat_sesi: [],
      status_sesi: "AKTIF",
      mapel_aktif: "PKPJ 2026",
    },
    {
      nama: "Bella Julianti",
      kelas: "XI TKJ 1",
      id_siswa: "bella-id",
      riwayat_sesi: [
        { mapel: "PKPJ 2026", waktu: "14/11/2026 23:45:41" },
      ],
    },
  ];
  const responses = [
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ 2026",
      nilai: "17 / 100",
      timestamp: "14/11/2026 23:49:06",
      rowOrder: 6,
      sumber: "shared-sheet",
    },
    {
      nama: "Dianto Maha",
      kelas: "XI TKJ 1",
      mapel: "PKPJ XI TJKT 1",
      nilai: "17 / 100",
      timestamp: "14/11/2026 23:49:06",
      rowOrder: 6,
      sumber: "shared-sheet",
    },
  ];

  const result = deteksiJoki(siswa, responses);
  const payload = buatPayloadSinkronAuditForm(
    siswa,
    responses,
    "",
    result,
  );
  const kasusDianto = result.kasus.find(
    (kasus) => kasus.korban.nama === "Dianto Maha",
  );
  const auditDianto = payload.find((item) => item.id_siswa === "dianto-id");

  assert.ok(kasusDianto);
  assert.equal(kasusDianto.pelaku.nama, "Bella Julianti");
  assert.match(kasusDianto.alasan, /mapel perlu diverifikasi/);
  assert.match(auditDianto.ket_nilai, /mapel perlu diverifikasi/);
  assert.match(result.catatan.join(" "), /dipakai beberapa mapel/);
});

test("sync payload keeps the earliest response and reports duplicate submissions", () => {
  const siswa = [
    {
      nama: "Budi",
      kelas: "XI TKJ 1",
      id_siswa: "budi-id",
    },
  ];
  const responses = [
    {
      nama: "Budi",
      kelas: "XI TKJ 1",
      mapel: "Matematika",
      nilai: "70",
      timestamp: "2026-11-14T08:30:00+07:00",
      rowOrder: 4,
    },
    {
      nama: "Budi",
      kelas: "XI TKJ 1",
      mapel: "Matematika",
      nilai: "85",
      timestamp: "2026-11-14T08:10:00+07:00",
      rowOrder: 2,
    },
  ];

  const [item] = buatPayloadSinkronAuditForm(
    siswa,
    responses,
    "Matematika",
  );

  assert.equal(item.nilai_form, "85");
  assert.equal(item.jumlah_respon, 2);
  assert.match(item.ket_nilai, /nilai yang ditampilkan respon pertama/);
});
