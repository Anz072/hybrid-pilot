import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDb, initDb } from "../../storage/sqlite";

const SUPABASE_APP_KV_PREFIX = "supabase:";
const SUPABASE_STORAGE_KEY = "hybridpilot-auth";

const readConfig = () => ({
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "",
});

const buildStorageKey = (key: string) => `${SUPABASE_APP_KV_PREFIX}${key}`;

const supabaseStorage = {
  getItem: async (key: string) => {
    await initDb();
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_kv WHERE key = ? LIMIT 1`,
      buildStorageKey(key),
    );

    return row?.value ?? null;
  },
  removeItem: async (key: string) => {
    await initDb();
    const db = await getDb();
    await db.runAsync(
      `DELETE FROM app_kv WHERE key = ?`,
      buildStorageKey(key),
    );
  },
  setItem: async (key: string, value: string) => {
    await initDb();
    const db = await getDb();
    await db.runAsync(
      `
      INSERT INTO app_kv (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      buildStorageKey(key),
      value,
    );
  },
};

let cachedClient: SupabaseClient | null = null;

export const isSupabaseConfigured = () => {
  const { anonKey, url } = readConfig();
  return url.length > 0 && anonKey.length > 0;
};

export const getSupabaseConfigError = () =>
  "Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in hybrid-pilot/.env.";

export const getSupabaseClient = () => {
  const { anonKey, url } = readConfig();

  if (!url || !anonKey) {
    throw new Error(getSupabaseConfigError());
  }

  if (!cachedClient) {
    cachedClient = createClient(url, anonKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
        storage: supabaseStorage,
        storageKey: SUPABASE_STORAGE_KEY,
      },
    });
  }

  return cachedClient;
};
