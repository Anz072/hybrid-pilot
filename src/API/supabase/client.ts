import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";

const SUPABASE_STORAGE_KEY = "dribsnis-auth";
export const SUPABASE_SESSION_REQUIRED_MESSAGE =
  "Your session is no longer valid. Please sign in with email and password again.";

const readConfig = () => ({
  publishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    "",
  url: process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "",
});

const isTransientAuthNetworkError = (message: string) =>
  /fetch failed|network request failed|network/i.test(message);

const isEmailPasswordSupabaseUser = (user: User): boolean => {
  const provider = user.app_metadata?.provider;
  return provider == null || provider === "email";
};

const supabaseStorage = {
  getItem: async (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },
  setItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
};

let cachedClient: SupabaseClient | null = null;

export const isSupabaseConfigured = () => {
  const { publishableKey, url } = readConfig();
  return url.length > 0 && publishableKey.length > 0;
};

export const getSupabaseConfigError = () =>
  "Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in dribsnis/.env.";

export const getSupabaseClient = () => {
  const { publishableKey, url } = readConfig();

  if (!url || !publishableKey) {
    throw new Error(getSupabaseConfigError());
  }

  if (!cachedClient) {
    cachedClient = createClient(url, publishableKey, {
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
        const cachedUser = await getSupabaseSessionUser();
        return cachedUser && isEmailPasswordSupabaseUser(cachedUser)
          ? cachedUser
          : null;
      }

      return null;
    }

    if (user && !isEmailPasswordSupabaseUser(user)) {
      await supabase.auth.signOut();
      return null;
    }

    return user ?? null;
  } catch (error) {
    if (error instanceof Error && isTransientAuthNetworkError(error.message)) {
      const cachedUser = await getSupabaseSessionUser();
      return cachedUser && isEmailPasswordSupabaseUser(cachedUser)
        ? cachedUser
        : null;
    }

    return null;
  }
};

export const requireSupabaseSessionUser = async (
  expectedUserId?: string | null,
): Promise<User> => {
  const sessionUser = await getSupabaseSessionUser();

  if (
    !sessionUser ||
    !isEmailPasswordSupabaseUser(sessionUser) ||
    (expectedUserId && sessionUser.id !== expectedUserId)
  ) {
    if (sessionUser && !isEmailPasswordSupabaseUser(sessionUser)) {
      await getSupabaseClient().auth.signOut();
    }

    throw new Error(SUPABASE_SESSION_REQUIRED_MESSAGE);
  }

  return sessionUser;
};
