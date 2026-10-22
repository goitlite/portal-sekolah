// Route API Proxy Gambar Bebas CORS untuk Google Drive / External Image
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new Response("Parameter url wajib diisi", { status: 400 });
  }

  try {
    // Normalisasi link Google Drive ke direct view/thumbnail jika perlu
    let finalUrl = targetUrl;
    if (finalUrl.includes("/file/d/")) {
      const fileId = finalUrl.split("/file/d/")[1].split("/")[0];
      finalUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w320`;
    } else if (finalUrl.includes("id=")) {
      const fileId = finalUrl.split("id=")[1].split("&")[0];
      finalUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w320`;
    }

    const response = await fetch(finalUrl, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return new Response("Gagal mengambil gambar dari sumber", {
        status: response.status,
      });
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await response.arrayBuffer();

    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[image-proxy error]:", error);
    return new Response("Terjadi kesalahan saat memproses gambar", {
      status: 500,
    });
  }
}

