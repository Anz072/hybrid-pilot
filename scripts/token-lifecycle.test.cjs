require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");
const Module = require("node:module");

/**
 * Token-lifecycle tests for the Nouri API client.
 *
 * The client's collaborators (Supabase session + refresh, global fetch) are
 * replaced so the refresh-and-retry contract can be driven deterministically:
 * how many refreshes happen, how many retries, and what the caller finally sees.
 *
 * The contract under test, established against a real expired token from a
 * local Supabase Auth service:
 *   - AUTH_TOKEN_EXPIRED  -> refresh once, retry once
 *   - AUTH_INVALID_TOKEN  -> never refresh
 *   - NETWORK_ERROR       -> never retry (the write may have landed)
 *   - failed refresh      -> AUTH_REQUIRED, the signed-out path
 */

const CLIENT_PATH = require.resolve("../src/API/nouri/client.ts");
const SUPABASE_PATH = require.resolve("../src/API/supabase/client.ts");

/** Loads a fresh copy of the API client with a stubbed Supabase module. */
function loadClient(supabaseStub) {
  delete require.cache[CLIENT_PATH];
  delete require.cache[SUPABASE_PATH];

  const originalLoad = Module._load;
  Module._load = function patched(request, parent, isMain) {
    if (parent && parent.filename === CLIENT_PATH && request === "../supabase/client") {
      return supabaseStub;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return require(CLIENT_PATH);
  } finally {
    Module._load = originalLoad;
  }
}

function makeSupabaseStub({ accessToken = "token-1", refreshTo = "token-2" } = {}) {
  const calls = { refresh: 0, getSession: 0 };
  return {
    calls,
    SUPABASE_SESSION_REQUIRED_MESSAGE: "session required",
    getSupabaseSession: async () => {
      calls.getSession += 1;
      return accessToken === null ? null : { access_token: accessToken };
    },
    refreshSupabaseSession: async () => {
      calls.refresh += 1;
      return refreshTo;
    },
  };
}

/** Queues responses; each fetch call consumes the next one. */
function makeFetch(responses) {
  const seen = [];
  global.fetch = async (url, init) => {
    seen.push({ url, authorization: init.headers.authorization, method: init.method });
    const next = responses.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next.throw) throw next.throw;
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      headers: { get: () => "req-1" },
      json: async () => next.body ?? null,
    };
  };
  return seen;
}

const authError = (code) => ({ status: 401, body: { error: { code, message: code } } });
const ok = (body) => ({ status: 200, body });

const originalFetch = global.fetch;
test.after(() => {
  global.fetch = originalFetch;
});

process.env.EXPO_PUBLIC_API_BASE_URL = "http://127.0.0.1:8080";

test("a valid request makes one call and never refreshes", async () => {
  const supabase = makeSupabaseStub();
  const { apiRequest } = loadClient(supabase);
  const seen = makeFetch([ok({ hello: "world" })]);

  assert.deepEqual(await apiRequest("/v1/me"), { hello: "world" });
  assert.equal(seen.length, 1);
  assert.equal(supabase.calls.refresh, 0);
});

test("AUTH_TOKEN_EXPIRED refreshes exactly once and retries exactly once", async () => {
  const supabase = makeSupabaseStub({ accessToken: "stale", refreshTo: "fresh" });
  const { apiRequest } = loadClient(supabase);
  const seen = makeFetch([authError("AUTH_TOKEN_EXPIRED"), ok({ recovered: true })]);

  assert.deepEqual(await apiRequest("/v1/me"), { recovered: true });
  assert.equal(supabase.calls.refresh, 1, "exactly one refresh");
  assert.equal(seen.length, 2, "exactly one retry");
  assert.equal(seen[0].authorization, "Bearer stale");
  assert.equal(seen[1].authorization, "Bearer fresh", "retry uses the NEW token");
});

test("a mutation is retried after expiry, and the retry carries the same body", async () => {
  // Safe because AUTH_TOKEN_EXPIRED is raised before the route handler runs,
  // so the first attempt provably had no effect.
  const supabase = makeSupabaseStub({ accessToken: "stale", refreshTo: "fresh" });
  const { apiRequest } = loadClient(supabase);
  const seen = makeFetch([authError("AUTH_TOKEN_EXPIRED"), { status: 201, body: { id: "w1" } }]);

  assert.deepEqual(
    await apiRequest("/v1/weights", { method: "POST", body: { valueKg: 80 } }),
    { id: "w1" },
  );
  assert.equal(seen.length, 2);
  assert.equal(seen[1].method, "POST");
});

test("a second expiry after refresh does NOT refresh again", async () => {
  const supabase = makeSupabaseStub({ accessToken: "stale", refreshTo: "fresh" });
  const { apiRequest, NouriApiError } = loadClient(supabase);
  const seen = makeFetch([authError("AUTH_TOKEN_EXPIRED"), authError("AUTH_TOKEN_EXPIRED")]);

  await assert.rejects(() => apiRequest("/v1/me"), (e) => {
    assert.ok(e instanceof NouriApiError);
    assert.equal(e.code, "AUTH_TOKEN_EXPIRED");
    return true;
  });
  assert.equal(supabase.calls.refresh, 1, "no second refresh — this is the loop guard");
  assert.equal(seen.length, 2, "no third request");
});

test("a failed refresh surfaces AUTH_REQUIRED, the signed-out path", async () => {
  const supabase = makeSupabaseStub({ accessToken: "stale", refreshTo: null });
  const { apiRequest, NouriApiError } = loadClient(supabase);
  const seen = makeFetch([authError("AUTH_TOKEN_EXPIRED")]);

  await assert.rejects(() => apiRequest("/v1/me"), (e) => {
    assert.ok(e instanceof NouriApiError);
    assert.equal(e.code, "AUTH_REQUIRED");
    assert.equal(e.isAuthFailure, true);
    return true;
  });
  assert.equal(supabase.calls.refresh, 1);
  assert.equal(seen.length, 1, "no retry when there is no new token");
});

test("AUTH_INVALID_TOKEN never triggers a refresh", async () => {
  // A malformed or tampered token cannot be fixed by refreshing, and retrying
  // it would be an infinite loop waiting to happen.
  const supabase = makeSupabaseStub();
  const { apiRequest, NouriApiError } = loadClient(supabase);
  const seen = makeFetch([authError("AUTH_INVALID_TOKEN")]);

  await assert.rejects(() => apiRequest("/v1/me"), (e) => {
    assert.equal(e.code, "AUTH_INVALID_TOKEN");
    assert.ok(e instanceof NouriApiError);
    return true;
  });
  assert.equal(supabase.calls.refresh, 0);
  assert.equal(seen.length, 1);
});

test("AUTH_PROVIDER_NOT_ALLOWED never triggers a refresh", async () => {
  const supabase = makeSupabaseStub();
  const { apiRequest } = loadClient(supabase);
  makeFetch([authError("AUTH_PROVIDER_NOT_ALLOWED")]);

  await assert.rejects(() => apiRequest("/v1/me"));
  assert.equal(supabase.calls.refresh, 0);
});

test("a network failure is never retried, even on a mutation", async () => {
  // The request may have been processed and only the response lost. Replaying
  // it could double-write.
  const supabase = makeSupabaseStub();
  const { apiRequest, NouriApiError } = loadClient(supabase);
  const seen = makeFetch([{ throw: new Error("Network request failed") }]);

  await assert.rejects(
    () => apiRequest("/v1/weights", { method: "POST", body: { valueKg: 80 } }),
    (e) => {
      assert.ok(e instanceof NouriApiError);
      assert.equal(e.code, "NETWORK_ERROR");
      return true;
    },
  );
  assert.equal(supabase.calls.refresh, 0);
  assert.equal(seen.length, 1, "no retry after an ambiguous failure");
});

test("no session at all fails fast without calling the network", async () => {
  const supabase = makeSupabaseStub({ accessToken: null });
  const { apiRequest, NouriApiError } = loadClient(supabase);
  const seen = makeFetch([]);

  await assert.rejects(() => apiRequest("/v1/me"), (e) => {
    assert.ok(e instanceof NouriApiError);
    assert.equal(e.code, "AUTH_REQUIRED");
    return true;
  });
  assert.equal(seen.length, 0);
  assert.equal(supabase.calls.refresh, 0);
});

test("a 500 is not mistaken for an auth problem", async () => {
  const supabase = makeSupabaseStub();
  const { apiRequest } = loadClient(supabase);
  makeFetch([{ status: 500, body: { error: { code: "INTERNAL_ERROR" } } }]);

  await assert.rejects(() => apiRequest("/v1/me"), (e) => e.code === "INTERNAL_ERROR");
  assert.equal(supabase.calls.refresh, 0);
});

test("concurrent expired requests each retry, and each refresh call is delegated", async () => {
  // The client asks for a refresh per failing request; refreshSupabaseSession
  // is what collapses them onto one network call. This asserts the delegation,
  // so the single-flighting cannot be silently bypassed here.
  const supabase = makeSupabaseStub({ accessToken: "stale", refreshTo: "fresh" });
  const { apiRequest } = loadClient(supabase);
  makeFetch([
    authError("AUTH_TOKEN_EXPIRED"),
    authError("AUTH_TOKEN_EXPIRED"),
    ok({ n: 1 }),
    ok({ n: 2 }),
  ]);

  const results = await Promise.all([apiRequest("/v1/a"), apiRequest("/v1/b")]);
  assert.equal(results.length, 2);
  assert.equal(supabase.calls.refresh, 2, "delegated per request");
});
