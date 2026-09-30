// src/lib/webpush.js
// Inisialisasi web-push dengan dukungan fallback pembacaan .env.local

import webpush from "web-push";
import fs from "fs";
import path from "path";

let initialized = false;

function loadEnvFallback() {
  const env = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
    VAPID_MAILTO: process.env.VAPID_MAILTO,
  };

  if (!env.VAPID_PRIVATE_KEY || !env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    try {
      const envPath = path.join(process.cwd(), ".env.local");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        content.split(/\r?\n/).forEach((line) => {
          const parts = line.split("=");
          if (parts.length >= 2 && !line.trim().startsWith("#")) {
            const key = parts[0].trim();
            const val = parts.slice(1).join("=").trim();
            env[key] = val;
          }
        });
      }
    } catch (e) {
      console.warn("[webpush] Gagal membaca fallback .env.local:", e);
    }
  }

  return env;
}

export function getWebPush() {
  if (!initialized) {
    const env = loadEnvFallback();
    const mailto = env.VAPID_MAILTO || "mailto:admin@smkn1teluk.sch.id";
    const pubKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privKey = env.VAPID_PRIVATE_KEY;

    if (!pubKey || !privKey) {
      throw new Error(
        "VAPID Keys tidak ditemukan di environment variables ataupun .env.local",
      );
    }

    webpush.setVapidDetails(mailto, pubKey, privKey);
    initialized = true;
  }
  return webpush;
}
