import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import { getDb, initDb } from "../../storage/sqlite";

const SUPABASE_APP_KV_PREFIX = "supabase:";
const SUPABASE_STORAGE_KEY = "hybridpilot-auth";
export const SUPABASE_SESSION_REQUIRED_MESSAGE =
  "Your session is no longer valid. Please sign in with Google again.";

const readConfig = () => ({
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "",
});

const buildStorageKey = (key: string) => `${SUPABASE_APP_KV_PREFIX}${key}`;
const isTransientAuthNetworkError = (message: string) =>
  /fetch failed|network request failed|network/i.test(message);

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

export const getSupabaseSession = async (): Promise<Session | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return null;
    }

    return session ?? null;
  } catch {
    return null;
  }
};

export const getSupabaseSessionUser = async (): Promise<User | null> => {
  const session = await getSupabaseSession();
  return session?.user ?? null;
};

export const getValidatedSupabaseSessionUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      if (isTransientAuthNetworkError(error.message)) {
        return getSupabaseSessionUser();
      }

      return null;
    }

    return user ?? null;
  } catch (error) {
    if (error instanceof Error && isTransientAuthNetworkError(error.message)) {
      return getSupabaseSessionUser();
    }

    return null;
  }
};

export const requireSupabaseSessionUser = async (
  expectedUserId?: string | null,
): Promise<User> => {
  const sessionUser = await getSupabaseSessionUser();

  if (!sessionUser || (expectedUserId && sessionUser.id !== expectedUserId)) {
    throw new Error(SUPABASE_SESSION_REQUIRED_MESSAGE);
  }

  return sessionUser;
};
