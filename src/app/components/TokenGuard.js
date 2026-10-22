"use client";

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

export default function TokenGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const isRedirectingRef = useRef(false);

  // Reset flag redirect saat pengguna berada di halaman login
  useEffect(() => {
    if (pathname && pathname.includes("/login")) {
      isRedirectingRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    function handleSessionExpired(event) {
      // Debounce: abaikan jika sedang dalam proses redirect
      if (isRedirectingRef.current) {
        return;
      }

      // Jangan redirect jika pengguna sudah berada di halaman login
      if (pathname && pathname.includes("/login")) {
        return;
      }

      isRedirectingRef.current = true;

      console.warn(
        "[TokenGuard] Sesi token telah kedaluwarsa. Mengarahkan ke halaman login...",
        event?.detail,
      );

      // Bersihkan sesi aktif yang sudah expired
      // PENTING: Antrean offline, data cache, dan riwayat ID login TETAP AMAN
      try {
        localStorage.removeItem("magang_session");
      } catch (_) {}

      // Arahkan ke halaman login dengan parameter expired
      router.replace("/magang/login?expired=1");
    }

    if (typeof window !== "undefined") {
      window.addEventListener("magang:session-expired", handleSessionExpired);
      return () => {
        window.removeEventListener(
          "magang:session-expired",
          handleSessionExpired,
        );
      };
    }
  }, [router, pathname]);

  return null;
}
