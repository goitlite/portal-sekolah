// src/lib/webpush.js
// Singleton inisialisasi web-push agar VAPID hanya di-set sekali

import webpush from "web-push";

let initialized = false;

export function getWebPush() {
  if (!initialized) {
    webpush.setVapidDetails(
      process.env.VAPID_MAILTO,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY,
    );
    initialized = true;
  }
  return webpush;
}
