// Route API Proxy Gambar untuk Google Drive (thumbnail foto wajah / profil)
// KEAMANAN: hanya domain Google yang diizinkan (cegah proxy terbuka / SSRF),
// hanya konten gambar, dan ukuran dibatasi.

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB
const ALLOWED_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "lh3.googleusercontent.com",
]);

function isAllowedHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  return ALLOWED_HOSTS.has(h) || h.endsWith(".googleusercontent.com");
}

// Ambil ID file Drive dari berbagai bentuk link
function extractDriveId(u) {
  const m1 = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/);
  if (m1) return m1[1];
  const id = u.searchParams.get("id");
  if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) return id;
  return "";
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl || targetUrl.length > 2048) {
    return new Response("Parameter url wajib diisi", { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (_) {
    return new Response("URL tidak valid", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    return new Response("Sumber gambar tidak diizinkan", { status: 400 });
  }

  try {
    // Normalisasi link Google Drive ke thumbnail jika memungkinkan
    let finalUrl = parsed.toString();
    if (parsed.hostname.endsWith("google.com")) {
      const fileId = extractDriveId(parsed);
      if (fileId) {
        finalUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w640`;
      }
    }

    const response = await fetch(finalUrl, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    // Drive me-redirect ke googleusercontent: pastikan tujuan akhir tetap domain Google
    try {
      if (response.url && !isAllowedHost(new URL(response.url).hostname)) {
        return new Response("Sumber gambar tidak diizinkan", { status: 400 });
      }
    } catch (_) {}

    if (!response.ok) {
      return new Response("Gagal mengambil gambar dari sumber", {
        status: response.status,
      });
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      return new Response("Sumber bukan gambar", { status: 415 });
    }

    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) {
      return new Response("Gambar terlalu besar", { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new Response("Gambar terlalu besar", { status: 413 });
    }

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Dipakai same-origin oleh aplikasi sendiri: tidak perlu CORS terbuka
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[image-proxy error]:", error);
    return new Response("Terjadi kesalahan saat memproses gambar", {
      status: 500,
    });
  }
}
