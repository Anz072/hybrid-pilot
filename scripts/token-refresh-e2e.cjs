/**
 * MANUAL end-to-end check of the token refresh contract.
 *
 * Deliberately named so it is NOT picked up by `npm test` (`scripts/*.test.cjs`):
 * it needs a running local Supabase stack and a running nouri-api, and it waits
 * out a real token expiry, so it takes over a minute.
 *
 *   1. In nouri-api/supabase/config.toml set `jwt_expiry = 60`
 *   2. pnpm supabase stop && pnpm supabase start
 *   3. pnpm start:local          (nouri-api on :8080)
 *   4. node --test scripts/token-refresh-e2e.cjs
 *   5. restore `jwt_expiry = 3600`
 *
 * Everything is real except the session store: the API, the token, its expiry,
 * and the GoTrue refresh. Only `getSupabaseSession` is stubbed, because the
 * app persists sessions in SecureStore, which does not exist under Node.
 */

require("./register-ts.cjs");
const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

// End-to-end: the REAL apiRequest, the REAL local API, a REAL expired token,
// and a REAL GoTrue refresh. Only the Supabase session accessor is stubbed,
// because the app's session store is SecureStore.
const AUTH = "http://127.0.0.1:54321/auth/v1";
process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:8080";

const CLIENT_PATH = require.resolve(
  "../src/API/nouri/client.ts",
);

const post = async (p, b) =>
  (await fetch(`${AUTH}${p}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b),
  })).json();

test("expired token -> one refresh, one retry, write lands exactly once", async () => {
  const email = `e2e.${Date.now()}@nouri.test`;
  const session = await post("/signup", { email, password: "E2ERefresh!Pass1", data: { name: "E2E" } });
  const lifetime =
    JSON.parse(Buffer.from(session.access_token.split(".")[1], "base64url")).exp -
    Math.floor(Date.now() / 1000);

  let current = { access_token: session.access_token, refresh_token: session.refresh_token };
  const calls = { refresh: 0 };

  const supabaseStub = {
    SUPABASE_SESSION_REQUIRED_MESSAGE: "session required",
    getSupabaseSession: async () => current,
    refreshSupabaseSession: async () => {
      calls.refresh += 1;
      const next = await post("/token?grant_type=refresh_token", { refresh_token: current.refresh_token });
      if (!next.access_token) return null;
      current = { access_token: next.access_token, refresh_token: next.refresh_token };
      return next.access_token;
    },
  };

  delete require.cache[CLIENT_PATH];
  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (parent && parent.filename === CLIENT_PATH && request === "../supabase/client") return supabaseStub;
    return originalLoad.call(this, request, parent, isMain);
  };
  let apiRequest;
  try { ({ apiRequest } = require(CLIENT_PATH)); } finally { Module._load = originalLoad; }

  // Works while valid.
  const before = await apiRequest("/v1/me");
  assert.equal(before.profile.email, email);
  assert.equal(calls.refresh, 0);

  console.log(`  waiting ${lifetime + 8}s for the access token to genuinely expire...`);
  await new Promise((r) => setTimeout(r, (lifetime + 8) * 1000));

  // A MUTATION through the real client with a genuinely expired token.
  const id = `e2e-refresh-${Date.now()}`;
  const created = await apiRequest("/v1/weights", {
    method: "POST",
    body: {
      id, clientGeneratedId: id, measuredAt: new Date().toISOString(),
      measuredAtLocalIso: "2026-08-29T09:00:00", zoneOffsetMinutes: 0,
      valueKg: 81.2, valueOriginal: 81.2, source: "manual",
    },
  });

  assert.equal(created.id, id, "the retry succeeded transparently");
  assert.equal(calls.refresh, 1, "exactly one refresh");

  // Exactly one row: the expired attempt wrote nothing, the retry wrote once.
  const list = await apiRequest("/v1/weights");
  const rows = (list.entries ?? list).filter((e) => e.id === id);
  assert.equal(rows.length, 1, "no double-write");
  console.log("  refreshes:", calls.refresh, "| rows written:", rows.length);
});
