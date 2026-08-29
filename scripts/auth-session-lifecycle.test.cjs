require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

/**
 * Session-lifecycle tests for the Supabase auth client wrapper.
 *
 * `@supabase/supabase-js`, `expo-secure-store` and `react-native` are stubbed,
 * so this exercises our own wiring — SecureStore-backed persistence, the
 * AppState-driven refresh timer, and the single-flight refresh — rather than
 * re-testing the Supabase SDK.
 */

const CLIENT_PATH = require.resolve("../src/API/supabase/client.ts");

function loadClient({ refreshImpl, sessionValue } = {}) {
  delete require.cache[CLIENT_PATH];

  const store = new Map();
  const state = {
    autoRefreshStarts: 0,
    autoRefreshStops: 0,
    refreshCalls: 0,
    signOuts: 0,
    listeners: [],
    currentState: "active",
    store,
  };

  const auth = {
    startAutoRefresh: async () => {
      state.autoRefreshStarts += 1;
    },
    stopAutoRefresh: async () => {
      state.autoRefreshStops += 1;
    },
    refreshSession: async () => {
      state.refreshCalls += 1;
      return refreshImpl
        ? refreshImpl(state)
        : { data: { session: { access_token: `refreshed-${state.refreshCalls}` } }, error: null };
    },
    getSession: async () => ({
      data: { session: sessionValue === undefined ? { access_token: "stored" } : sessionValue },
      error: null,
    }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signOut: async () => {
      state.signOuts += 1;
      store.clear();
      return { error: null };
    },
  };

  const stubs = {
    "@supabase/supabase-js": { createClient: () => ({ auth }) },
    "expo-secure-store": {
      getItemAsync: async (k) => store.get(k) ?? null,
      setItemAsync: async (k, v) => void store.set(k, v),
      deleteItemAsync: async (k) => void store.delete(k),
    },
    "react-native": {
      get AppState() {
        return {
          get currentState() {
            return state.currentState;
          },
          addEventListener: (_evt, cb) => {
            state.listeners.push(cb);
            return { remove: () => {
              state.listeners = state.listeners.filter((l) => l !== cb);
            } };
          },
        };
      },
    },
  };

  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (parent && parent.filename === CLIENT_PATH && stubs[request]) return stubs[request];
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return { mod: require(CLIENT_PATH), state };
  } finally {
    Module._load = originalLoad;
  }
}

process.env.EXPO_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "local-publishable-key";

test("a persisted session is restored through SecureStore", async () => {
  const { mod } = loadClient();
  const session = await mod.getSupabaseSession();
  assert.equal(session.access_token, "stored");
});

test("no persisted session resolves to null rather than throwing", async () => {
  const { mod } = loadClient({ sessionValue: null });
  assert.equal(await mod.getSupabaseSession(), null);
});

test("a successful refresh returns the new access token", async () => {
  const { mod, state } = loadClient();
  assert.equal(await mod.refreshSupabaseSession(), "refreshed-1");
  assert.equal(state.refreshCalls, 1);
});

test("a failed refresh returns null instead of throwing", async () => {
  const { mod } = loadClient({
    refreshImpl: () => ({ data: { session: null }, error: { message: "invalid refresh token" } }),
  });
  assert.equal(await mod.refreshSupabaseSession(), null);
});

test("a throwing refresh returns null", async () => {
  const { mod } = loadClient({
    refreshImpl: () => {
      throw new Error("network down");
    },
  });
  assert.equal(await mod.refreshSupabaseSession(), null);
});

test("concurrent refreshes collapse into ONE network call", async () => {
  // Supabase rotates the refresh token on use, so a second concurrent refresh
  // would present a spent token and fail — signing the user out during what
  // should have been a silent recovery.
  let resolveRefresh;
  const gate = new Promise((r) => {
    resolveRefresh = r;
  });
  const { mod, state } = loadClient({
    refreshImpl: async () => {
      await gate;
      return { data: { session: { access_token: "single" } }, error: null };
    },
  });

  const all = Promise.all([
    mod.refreshSupabaseSession(),
    mod.refreshSupabaseSession(),
    mod.refreshSupabaseSession(),
  ]);
  resolveRefresh();
  const results = await all;

  assert.deepEqual(results, ["single", "single", "single"]);
  assert.equal(state.refreshCalls, 1, "three callers, one refresh");
});

test("a later refresh after the first settles starts a new call", async () => {
  const { mod, state } = loadClient();
  assert.equal(await mod.refreshSupabaseSession(), "refreshed-1");
  assert.equal(await mod.refreshSupabaseSession(), "refreshed-2");
  assert.equal(state.refreshCalls, 2, "single-flight must not cache a stale result");
});

test("foreground starts the refresh timer, background stops it", async () => {
  const { mod, state } = loadClient();
  const unsubscribe = mod.registerSupabaseAuthLifecycle();

  assert.equal(state.autoRefreshStarts, 1, "starts immediately when already active");

  state.listeners.forEach((l) => l("background"));
  assert.equal(state.autoRefreshStops, 1);

  state.listeners.forEach((l) => l("active"));
  assert.equal(state.autoRefreshStarts, 2, "restarted on return to foreground");

  state.listeners.forEach((l) => l("inactive"));
  assert.equal(state.autoRefreshStops, 2, "iOS 'inactive' also stops the timer");

  unsubscribe();
  assert.equal(state.listeners.length, 0, "unsubscribed");
  assert.equal(state.autoRefreshStops, 3, "timer stopped on teardown");
});

test("the lifecycle does not start the timer when the app launches backgrounded", async () => {
  const { mod, state } = loadClient();
  state.currentState = "background";
  mod.registerSupabaseAuthLifecycle();
  assert.equal(state.autoRefreshStarts, 0);
  assert.equal(state.autoRefreshStops, 1);
});

test("unsubscribing twice is safe", async () => {
  const { mod } = loadClient();
  const unsubscribe = mod.registerSupabaseAuthLifecycle();
  unsubscribe();
  assert.doesNotThrow(() => unsubscribe());
});

test("sign-out clears the persisted session", async () => {
  const { mod, state } = loadClient();
  state.store.set("dribsnis-auth", "some-session");
  await mod.getSupabaseClient().auth.signOut();
  assert.equal(state.store.size, 0);
  assert.equal(state.signOuts, 1);
});
