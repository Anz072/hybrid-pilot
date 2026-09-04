import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Every request failure leaves exactly one diagnostic, and that diagnostic
 * carries nothing it should not.
 *
 * Screens catch API errors to show their own copy — "Could not log food",
 * "Please try again" — and for 45 call sites that copy was the *only* trace a
 * failure left. A 404 caused by a food id the backend decoded wrong was
 * indistinguishable, from the device, from a 500, a timeout or a validation
 * error. Reporting it in the client covers all of them at once and cannot be
 * forgotten by a new screen.
 *
 * The line carries code, HTTP status, request id and the *route* — never a
 * message body, a field value, an identifier or a payload.
 */

interface QueuedResponse {
  status?: number;
  requestId?: string;
  body?: unknown;
  networkError?: boolean;
}

const supabase = {
  session: { access_token: "token" } as { access_token: string } | null,
  refreshed: "token-2" as string | null,
  refreshCalls: 0,
};

vi.mock("../src/API/supabase/client", () => ({
  SUPABASE_SESSION_REQUIRED_MESSAGE: "Sign in to continue.",
  getSupabaseSession: async () => supabase.session,
  refreshSupabaseSession: async () => {
    supabase.refreshCalls += 1;
    return supabase.refreshed;
  },
}));

const originalFetch = globalThis.fetch;

async function loadClient({
  session = { access_token: "token" } as { access_token: string } | null,
  responses = [] as QueuedResponse[],
  refreshed = "token-2" as string | null,
} = {}) {
  vi.resetModules();
  supabase.session = session;
  supabase.refreshed = refreshed;
  supabase.refreshCalls = 0;

  // Both channels are captured: a 404 is recorded without raising a warning,
  // because in a dev build every console.warn becomes a full-screen LogBox and
  // an expected "not found" must not interrupt the work.
  const warnings: string[] = [];
  const logs: string[] = [];
  vi.spyOn(console, "warn").mockImplementation((line: unknown) => {
    warnings.push(String(line));
  });
  vi.spyOn(console, "log").mockImplementation((line: unknown) => {
    logs.push(String(line));
  });

  const queue = [...responses];
  const state = { fetches: [] as { url: string; method: string }[] };
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    state.fetches.push({ url: String(url), method: init?.method ?? "GET" });
    const next = queue.shift();
    if (!next) throw new Error("no queued response");
    if (next.networkError) throw new Error("network down");

    const status = next.status ?? 200;
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: { get: (k: string) => (k === "x-request-id" ? (next.requestId ?? null) : null) },
      json: async () => next.body ?? null,
    };
  }) as unknown as typeof globalThis.fetch;

  return {
    mod: await import("../src/API/nouri/client"),
    state: {
      get fetches() {
        return state.fetches;
      },
      get refreshCalls() {
        return supabase.refreshCalls;
      },
    },
    warnings,
    logs,
    /** Everything the client reported, on either channel. */
    get reported() {
      return [...warnings, ...logs];
    },
  };
}

const expectEqual = (actual: unknown, expected: unknown, message?: string) =>
  expect(actual, message).toEqual(expected);
const expectOk = (value: unknown, message?: string) =>
  expect(Boolean(value), message).toBe(true);
const expectMatch = (value: string | undefined, pattern: RegExp, message?: string) =>
  expect(value ?? "", message).toMatch(pattern);
const expectRejects = (promise: Promise<unknown>, pattern?: RegExp) =>
  pattern ? expect(promise).rejects.toThrow(pattern) : expect(promise).rejects.toThrow();

describe("api failure reporting", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it("a 4xx is reported once, with code, status, request id and route", async () => {
  const h = await loadClient({
  responses: [{ status: 404, requestId: "req-1", body: { error: { code: "NOT_FOUND", message: "Food could not be found." } } }],
  });
  await expectRejects(h.mod.apiRequest("/v1/foods/9000000006"), /Food could not be found/);
  expectEqual(h.warnings, [], "an expected 404 must not raise a dev warning overlay");
  expectEqual(h.logs.length, 1, `expected one line, got ${h.logs.length}`);
  const line = h.logs[0];
  expectMatch(line, /NOT_FOUND/);
  expectMatch(line, /status=404/);
  expectMatch(line, /requestId=req-1/);
  expectMatch(line, /GET \/v1\/foods\/:id/, "the identifier was not normalized out of the route");
});

  it("the report never carries the server's message or the request body", async () => {
  const h = await loadClient({
  responses: [
    {
      status: 422,
      requestId: "req-2",
      body: { error: { code: "VALIDATION_FAILED", message: "valueKg must be at most 500" } },
    },
  ],
  });
  await expectRejects(
    h.mod.apiRequest("/v1/weights", { method: "POST", body: { valueKg: 9999, notes: "secret note" } }),
  );
  const line = h.reported.join("\n");
  expectOk(!/9999/.test(line), "a submitted value reached the log");
  expectOk(!/secret note/.test(line), "a note body reached the log");
  expectOk(!/must be at most/.test(line), "the server message reached the log");
  expectMatch(line, /VALIDATION_FAILED status=422/);
});

  it("a uuid in the path is normalized too", async () => {
  const h = await loadClient({
  responses: [{ status: 500, body: { error: { code: "INTERNAL_ERROR" } } }],
  });
  await expectRejects(
    h.mod.apiRequest("/v1/weights/2f1c4c6e-1a4b-4a55-9f2f-1b7a9c2d3e4f", { method: "DELETE" }),
  );
  expectMatch(h.reported[0], /DELETE \/v1\/weights\/:uuid/);
});

  it("a network failure is reported", async () => {
  const h = await loadClient({ responses: [{ networkError: true }] });
  await expectRejects(h.mod.apiRequest("/v1/me"), /Could not reach the server/);
  expectEqual(h.warnings.length, 1);
  expectMatch(h.warnings[0], /NETWORK_ERROR status=0/);
});

  it("no session is reported without touching the network", async () => {
  const h = await loadClient({ session: null });
  await expectRejects(h.mod.apiRequest("/v1/me"), /Sign in to continue/);
  expectEqual(h.state.fetches.length, 0);
  expectMatch(h.warnings[0], /AUTH_REQUIRED status=401/);
});

  it("an expired token that refreshes and succeeds reports NOTHING", async () => {
  const h = await loadClient({
  responses: [
    { status: 401, body: { error: { code: "AUTH_TOKEN_EXPIRED" } } },
    { status: 200, body: { ok: true } },
  ],
  });
  expectEqual(await h.mod.apiRequest("/v1/me"), { ok: true });
  expectEqual(h.state.refreshCalls, 1);
  // The refresh is the normal path, not a failure. Logging it would train
  // everyone to ignore these lines.
  expectEqual(h.reported, []);
});

  it("an expired token whose retry also fails reports once, not twice", async () => {
  const h = await loadClient({
  responses: [
    { status: 401, body: { error: { code: "AUTH_TOKEN_EXPIRED" } } },
    { status: 500, requestId: "req-3", body: { error: { code: "INTERNAL_ERROR" } } },
  ],
  });
  await expectRejects(h.mod.apiRequest("/v1/me"));
  expectEqual(h.warnings.length, 1, `expected one line, got ${h.warnings.length}:\n${h.warnings.join("\n")}`);
  expectMatch(h.warnings[0], /INTERNAL_ERROR status=500 requestId=req-3/);
});

  it("a failed refresh reports AUTH_REQUIRED once", async () => {
  const h = await loadClient({
  responses: [{ status: 401, body: { error: { code: "AUTH_TOKEN_EXPIRED" } } }],
  refreshed: null,
  });
  await expectRejects(h.mod.apiRequest("/v1/me"), /Sign in to continue/);
  expectEqual(h.warnings.length, 1);
  expectMatch(h.warnings[0], /AUTH_REQUIRED status=401/);
});

  it("a successful request reports nothing", async () => {
  const h = await loadClient({ responses: [{ status: 200, body: { ok: true } }] });
  expectEqual(await h.mod.apiRequest("/v1/me"), { ok: true });
  expectEqual(h.reported, []);
});
});
