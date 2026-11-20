import { NextResponse } from "next/server";

// Cache in-memory: cleanFormUrl -> { entryNama, entryKelas, entryId }
const formEntryCache = new Map();

async function getFormEntries(formUrl) {
  if (formEntryCache.has(formUrl)) {
    return formEntryCache.get(formUrl);
  }

  try {
    const res = await fetch(formUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;
    const html = await res.text();
    const match = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(.*?);\s*<\/script>/);
    if (!match) return null;

    const parsed = JSON.parse(match[1]);
    const items = parsed[1]?.[1] || [];

    let entryNama = null;
    let entryKelas = null;
    let entryId = null;

    for (const it of items) {
      const title = String(it[1] || "").trim().toLowerCase();
      const entry = it[4]?.[0]?.[0];
      if (!entry) continue;

      if (!entryNama && (title.includes("nama") || title.includes("[nama]"))) {
        entryNama = String(entry);
      } else if (
        !entryKelas &&
        (title.includes("kelas") || title.includes("[kelas]") || title.includes("rombel"))
      ) {
        entryKelas = String(entry);
      } else if (
        !entryId &&
        (title.includes("id") || title.includes("[id]") || title.includes("nisn") || title.includes("nis"))
      ) {
        entryId = String(entry);
      }
    }

    const mapping = { entryNama, entryKelas, entryId };
    formEntryCache.set(formUrl, mapping);
    return mapping;
  } catch (err) {
    console.warn("[resolve-form] Gagal auto-detect form:", err);
    return null;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { link, nama, kelas, idSiswa } = body || {};

    if (!link || typeof link !== "string") {
      return NextResponse.json({ success: false, url: link || "" });
    }

    // 1. Jika link sudah memiliki placeholder [NAMA], [KELAS], [ID] atau %5BNAMA%5D dst
    if (
      link.includes("[NAMA]") || link.includes("[KELAS]") || link.includes("[ID]") ||
      link.includes("%5BNAMA%5D") || link.includes("%5BKELAS%5D") || link.includes("%5BID%5D") ||
      link.includes("%5Bnama%5D") || link.includes("%5Bkelas%5D") || link.includes("%5Bid%5D")
    ) {
      let finalUrl = link;
      if (idSiswa) finalUrl = finalUrl.replace(/(\[ID\]|%5BID%5D)/gi, encodeURIComponent(idSiswa));
      if (nama) finalUrl = finalUrl.replace(/(\[NAMA\]|%5BNAMA%5D)/gi, encodeURIComponent(nama));
      if (kelas) finalUrl = finalUrl.replace(/(\[KELAS\]|%5BKELAS%5D)/gi, encodeURIComponent(kelas));
      return NextResponse.json({ success: true, url: finalUrl });
    }

    // 2. Keamanan ketat: Hanya terima URL HTTPS resmi dari docs.google.com/forms
    let parsedUrl;
    try {
      parsedUrl = new URL(link);
    } catch {
      return NextResponse.json({ success: true, url: link });
    }

    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "docs.google.com" ||
      !parsedUrl.pathname.startsWith("/forms/")
    ) {
      return NextResponse.json({ success: true, url: link });
    }

    // Jika sudah memiliki parameter entry resmi dari guru, biarkan apa adanya
    if (link.includes("entry.")) {
      return NextResponse.json({ success: true, url: link });
    }

    // 3. Deteksi otomatis kolom form dari HTML Google Forms
    const cleanUrl = link.split("?")[0];
    const mapping = await getFormEntries(cleanUrl);

    if (!mapping || (!mapping.entryNama && !mapping.entryKelas && !mapping.entryId)) {
      return NextResponse.json({ success: true, url: link });
    }

    const urlObj = new URL(cleanUrl);
    urlObj.searchParams.set("usp", "pp_url");
    if (mapping.entryId && idSiswa) {
      urlObj.searchParams.set(`entry.${mapping.entryId}`, idSiswa);
    }
    if (mapping.entryNama && nama) {
      urlObj.searchParams.set(`entry.${mapping.entryNama}`, nama);
    }
    if (mapping.entryKelas && kelas) {
      urlObj.searchParams.set(`entry.${mapping.entryKelas}`, kelas);
    }

    return NextResponse.json({ success: true, url: urlObj.toString() });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message, url: "" });
  }
}
