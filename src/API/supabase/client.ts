import {
  createClient,
  type Session,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, type AppStateStatus } from "react-native";

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
  "Missing Supabase config. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the app's .env file.";

export const getSupabaseClient = () => {
  const { publishableKey, url } = readConfig();

  if (!url || !publishableKey) {
    throw new Error(getSupabaseConfigError());
  }

  if (!cachedClient) {
    cachedClient = createClient(url, publishableKey, {
      auth: {
        // Access tokens live one hour. Without this the app kept using a token
        // past its expiry and every request failed with AUTH_TOKEN_EXPIRED,
        // which is the most likely source of the "randomly logged out" reports:
        // nothing was wrong with the session, only with the access token.
        //
        // supabase-js refreshes on a timer that only runs while the app is in
        // the foreground, so it is paired with the AppState wiring below.
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: supabaseStorage,
        storageKey: SUPABASE_STORAGE_KEY,
      },
    });
  }

  return cachedClient;
};

/**
 * Starts and stops supabase-js's refresh timer with the app lifecycle.
 *
 * The timer is a JS interval, so it does not fire while the app is backgrounded
 * — and a timer that fires in the background would be refreshing a token
 * nothing is about to use. On foreground, `startAutoRefresh` refreshes
 * immediately if the token is stale, which is exactly the moment it matters:
 * the user has just come back and is about to make requests.
 *
 * Returns an unsubscribe function. Safe to call when Supabase is unconfigured.
 */
export const registerSupabaseAuthLifecycle = (): (() => void) => {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseClient();
  } catch {
    return () => {};
  }

  const apply = (state: AppStateStatus) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  };

  apply(AppState.currentState);
  const subscription = AppState.addEventListener("change", apply);

  return () => {
    subscription.remove();
    void supabase.auth.stopAutoRefresh();
  };
};

/**
 * Refreshes the session, collapsing concurrent callers onto one request.
 *
 * Several screens can be in flight at once, so an expired token typically
 * produces a burst of simultaneous 401s. Without single-flighting, each would
 * start its own refresh; because Supabase rotates the refresh token on every
 * use, the second and later calls would present an already-spent token and
 * fail, signing the user out during what should have been a silent recovery.
 *
 * Returns the new access token, or null when the session cannot be renewed —
 * which callers must treat as "genuinely signed out", not "try again".
 */
let inFlightRefresh: Promise<string | null> | null = null;

export const refreshSupabaseSession = async (): Promise<string | null> => {
  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        return null;
      }
      return data.session?.access_token ?? null;
    } catch {
      return null;
    } finally {
      // Cleared in a microtask so callers that awaited this promise all observe
      // the same result before a fresh refresh can start.
      queueMicrotask(() => {
        inFlightRefresh = null;
      });
    }
  })();

  return inFlightRefresh;
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
