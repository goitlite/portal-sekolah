// src/lib/webpush.js
// Inisialisasi web-push dengan dukungan Vercel Production & Fallback Keys

import webpush from "web-push";
import fs from "fs";
import path from "path";

let initialized = false;

// Kunci VAPID resmi proyek Portal Sekolah SMKN 1 Teluk Kuantan
const HARDCODED_PUB =
  "BD68J66JpkZS7Xe6-03zP6rlSRQ6f0WN00t4ycbyLIDNVmI9DfpqM-paeYaNoj14ujRNcgQojx2fTtZ-PzpWBTE";
const HARDCODED_PRIV = "-cnrETM-_M1VI8xqXte4OAASZf364aTr4xLNKaT-LwU";
const HARDCODED_MAILTO = "mailto:admin@smkn1teluk.sch.id";

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
    } catch (e) {}
  }

  // Gunakan kunci bawaan jika di Vercel belum diset di dashboard
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY =
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || HARDCODED_PUB;
  env.VAPID_PRIVATE_KEY = env.VAPID_PRIVATE_KEY || HARDCODED_PRIV;
  env.VAPID_MAILTO = env.VAPID_MAILTO || HARDCODED_MAILTO;

  return env;
}

export function getWebPush() {
  if (!initialized) {
    const env = loadEnvFallback();
    webpush.setVapidDetails(
      env.VAPID_MAILTO,
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY,
    );
    initialized = true;
  }
  return webpush;
}
