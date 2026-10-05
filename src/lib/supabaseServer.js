// src/lib/supabaseServer.js
// Supabase Client Helper dengan dukungan Vercel Environment Variables & Fallback

import { createClient } from "@supabase/supabase-js";

// Kredensial default proyek Portal Sekolah SMKN 1 Teluk Kuantan
const DEFAULT_SUPABASE_URL = "https://dfcmetnhmbxqxcpteern.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "sb_publishable_daqM10azr3KARRr8p2kUMQ__k6KI95L";

let supabaseInstance = null;

export function getSupabaseServerClient() {
  if (supabaseInstance) return supabaseInstance;

  let rawUrl = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  ).trim();

  // Normalisasi URL Supabase jika ada akhiran /rest/v1 atau trailing slash
  const url = rawUrl.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");

  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  ).trim();

  if (!url || !key) {
    console.warn(
      "[Supabase] Kredensial Supabase belum terkonfigurasi di environment variables.",
    );
    return null;
  }

  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}
