import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Session-lifecycle tests for the Supabase auth client wrapper.
 *
 * `@supabase/supabase-js`, `expo-secure-store` and `react-native` are stubbed,
 * so this exercises our own wiring — SecureStore-backed persistence, the
 * AppState-driven refresh timer, and the single-flight refresh — rather than
 * re-testing the Supabase SDK.
 */

type AppStateListener = (state: string) => void;

interface RefreshResult {
  data: { session: { access_token: string } | null };
  error: { message: string } | null;
}

/** Everything the stubs record, readable from each test. */
const harness = {
  store: new Map<string, string>(),
  autoRefreshStarts: 0,
  autoRefreshStops: 0,
  refreshCalls: 0,
  signOuts: 0,
  listeners: [] as AppStateListener[],
  currentState: "active",
  sessionValue: undefined as { access_token: string } | null | undefined,
  refreshImpl: undefined as (() => RefreshResult | Promise<RefreshResult>) | undefined,
};

const reset = () => {
  harness.store.clear();
  harness.autoRefreshStarts = 0;
  harness.autoRefreshStops = 0;
  harness.refreshCalls = 0;
  harness.signOuts = 0;
  harness.listeners = [];
  harness.currentState = "active";
  harness.sessionValue = undefined;
  harness.refreshImpl = undefined;
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: {
      startAutoRefresh: async () => {
        harness.autoRefreshStarts += 1;
      },
      stopAutoRefresh: async () => {
        harness.autoRefreshStops += 1;
      },
      refreshSession: async () => {
        harness.refreshCalls += 1;
        return harness.refreshImpl
          ? harness.refreshImpl()
          : {
              data: { session: { access_token: `refreshed-${harness.refreshCalls}` } },
              error: null,
            };
      },
      getSession: async () => ({
        data: {
          session:
            harness.sessionValue === undefined
              ? { access_token: "stored" }
              : harness.sessionValue,
        },
        error: null,
      }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signOut: async () => {
        harness.signOuts += 1;
        harness.store.clear();
        return { error: null };
      },
    },
  }),
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: async (k: string) => harness.store.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    harness.store.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    harness.store.delete(k);
  },
}));

vi.mock("react-native", () => ({
  AppState: {
    get currentState() {
      return harness.currentState;
    },
    addEventListener: (_event: string, cb: AppStateListener) => {
      harness.listeners.push(cb);
      return {
        remove: () => {
          harness.listeners = harness.listeners.filter((l) => l !== cb);
        },
      };
    },
  },
}));

/** A fresh module per test: the client holds its single-flight promise at module scope. */
const loadClient = async () => {
  vi.resetModules();
  return import("../src/API/supabase/client");
};

describe("supabase session lifecycle", () => {
  beforeEach(reset);

  it("restores a persisted session through SecureStore", async () => {
    const mod = await loadClient();
    expect((await mod.getSupabaseSession())?.access_token).toBe("stored");
  });

  it("resolves to null rather than throwing when there is no session", async () => {
    harness.sessionValue = null;
    const mod = await loadClient();
    expect(await mod.getSupabaseSession()).toBeNull();
  });

  it("returns the new access token after a successful refresh", async () => {
    const mod = await loadClient();
    expect(await mod.refreshSupabaseSession()).toBe("refreshed-1");
    expect(harness.refreshCalls).toBe(1);
  });

  it("returns null instead of throwing when the refresh is rejected", async () => {
    harness.refreshImpl = () => ({
      data: { session: null },
      error: { message: "invalid refresh token" },
    });
    const mod = await loadClient();
    expect(await mod.refreshSupabaseSession()).toBeNull();
  });

  it("returns null when the refresh itself throws", async () => {
    harness.refreshImpl = () => {
      throw new Error("network down");
    };
    const mod = await loadClient();
    expect(await mod.refreshSupabaseSession()).toBeNull();
  });

  it("collapses concurrent refreshes into ONE network call", async () => {
    // Supabase rotates the refresh token on use, so a second concurrent refresh
    // would present a spent token and fail — signing the user out during what
    // should have been a silent recovery.
    let openGate!: () => void;
    const gate = new Promise<void>((r) => {
      openGate = r;
    });
    harness.refreshImpl = async () => {
      await gate;
      return { data: { session: { access_token: "single" } }, error: null };
    };

    const mod = await loadClient();
    const all = Promise.all([
      mod.refreshSupabaseSession(),
      mod.refreshSupabaseSession(),
      mod.refreshSupabaseSession(),
    ]);
    openGate();

    expect(await all).toEqual(["single", "single", "single"]);
    expect(harness.refreshCalls, "three callers, one refresh").toBe(1);
  });

  it("starts a new call for a refresh after the first settles", async () => {
    const mod = await loadClient();
    expect(await mod.refreshSupabaseSession()).toBe("refreshed-1");
    expect(await mod.refreshSupabaseSession()).toBe("refreshed-2");
    expect(harness.refreshCalls, "single-flight must not cache a stale result").toBe(2);
  });

  it("starts the refresh timer on foreground and stops it on background", async () => {
    const mod = await loadClient();
    const unsubscribe = mod.registerSupabaseAuthLifecycle();

    expect(harness.autoRefreshStarts, "starts immediately when already active").toBe(1);

    harness.listeners.forEach((l) => l("background"));
    expect(harness.autoRefreshStops).toBe(1);

    harness.listeners.forEach((l) => l("active"));
    expect(harness.autoRefreshStarts, "restarted on return to foreground").toBe(2);

    harness.listeners.forEach((l) => l("inactive"));
    expect(harness.autoRefreshStops, "iOS 'inactive' also stops the timer").toBe(2);

    unsubscribe();
    expect(harness.listeners.length, "unsubscribed").toBe(0);
    expect(harness.autoRefreshStops, "timer stopped on teardown").toBe(3);
  });

  it("does not start the timer when the app launches backgrounded", async () => {
    harness.currentState = "background";
    const mod = await loadClient();
    mod.registerSupabaseAuthLifecycle();

    expect(harness.autoRefreshStarts).toBe(0);
    expect(harness.autoRefreshStops).toBe(1);
  });

  it("is safe to unsubscribe twice", async () => {
    const mod = await loadClient();
    const unsubscribe = mod.registerSupabaseAuthLifecycle();
    unsubscribe();
    expect(() => unsubscribe()).not.toThrow();
  });

  it("clears the persisted session on sign-out", async () => {
    const mod = await loadClient();
    harness.store.set("dribsnis-auth", "some-session");
    await mod.getSupabaseClient().auth.signOut();

    expect(harness.store.size).toBe(0);
    expect(harness.signOuts).toBe(1);
  });
});
