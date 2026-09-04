import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NouriApiError as NouriApiErrorType } from "../src/API/nouri/client";

/**
 * Token-lifecycle tests for the Nouri API client.
 *
 * The client's collaborators (Supabase session + refresh, global fetch) are
 * replaced so the refresh-and-retry contract can be driven deterministically:
 * how many refreshes happen, how many retries, and what the caller finally
 * sees.
 *
 * The contract under test, established against a real expired token from a
 * local Supabase Auth service:
 *   - AUTH_TOKEN_EXPIRED  -> refresh once, retry once
 *   - AUTH_INVALID_TOKEN  -> never refresh
 *   - NETWORK_ERROR       -> never retry (the write may have landed)
 *   - failed refresh      -> AUTH_REQUIRED, the signed-out path
 */

const supabase = {
  calls: { refresh: 0, getSession: 0 },
  accessToken: "token-1" as string | null,
  refreshTo: "token-2" as string | null,
};

vi.mock("../src/API/supabase/client", () => ({
  SUPABASE_SESSION_REQUIRED_MESSAGE: "session required",
  getSupabaseSession: async () => {
    supabase.calls.getSession += 1;
    return supabase.accessToken === null ? null : { access_token: supabase.accessToken };
  },
  refreshSupabaseSession: async () => {
    supabase.calls.refresh += 1;
    return supabase.refreshTo;
  },
}));

interface QueuedResponse {
  status?: number;
  body?: unknown;
  throw?: Error;
}

interface SeenRequest {
  url: string;
  authorization: string | undefined;
  method: string | undefined;
}

const originalFetch = globalThis.fetch;

/** Queues responses; each fetch call consumes the next one. */
function makeFetch(responses: QueuedResponse[]): SeenRequest[] {
  const seen: SeenRequest[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    seen.push({ url: String(url), authorization: headers.authorization, method: init.method });

    const next = responses.shift();
    if (!next) throw new Error("fetch called more times than expected");
    if (next.throw) throw next.throw;

    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => "req-1" },
      json: async () => next.body ?? null,
    };
  }) as unknown as typeof globalThis.fetch;
  return seen;
}

/** A fresh client per test, so no state leaks between refresh scenarios. */
const loadClient = async () => {
  vi.resetModules();
  return import("../src/API/nouri/client");
};

const authError = (code: string): QueuedResponse => ({
  status: 401,
  body: { error: { code, message: code } },
});
const ok = (body: unknown): QueuedResponse => ({ status: 200, body });

/** The client warns on failure; silenced so the output stays readable. */
let warn: ReturnType<typeof vi.spyOn>;
let log: ReturnType<typeof vi.spyOn>;

describe("token lifecycle", () => {
  beforeEach(() => {
    supabase.calls = { refresh: 0, getSession: 0 };
    supabase.accessToken = "token-1";
    supabase.refreshTo = "token-2";
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    log.mockRestore();
  });

  afterAll(() => {
    globalThis.fetch = originalFetch;
  });

  it("makes one call and never refreshes for a valid request", async () => {
    const { apiRequest } = await loadClient();
    const seen = makeFetch([ok({ hello: "world" })]);

    expect(await apiRequest("/v1/me")).toEqual({ hello: "world" });
    expect(seen.length).toBe(1);
    expect(supabase.calls.refresh).toBe(0);
  });

  it("refreshes exactly once and retries exactly once on AUTH_TOKEN_EXPIRED", async () => {
    supabase.accessToken = "stale";
    supabase.refreshTo = "fresh";
    const { apiRequest } = await loadClient();
    const seen = makeFetch([authError("AUTH_TOKEN_EXPIRED"), ok({ recovered: true })]);

    expect(await apiRequest("/v1/me")).toEqual({ recovered: true });
    expect(supabase.calls.refresh, "exactly one refresh").toBe(1);
    expect(seen.length, "exactly one retry").toBe(2);
    expect(seen[0]?.authorization).toBe("Bearer stale");
    expect(seen[1]?.authorization, "retry uses the NEW token").toBe("Bearer fresh");
  });

  it("retries a mutation after expiry, carrying the same body", async () => {
    // Safe because AUTH_TOKEN_EXPIRED is raised before the route handler runs,
    // so the first attempt provably had no effect.
    supabase.accessToken = "stale";
    supabase.refreshTo = "fresh";
    const { apiRequest } = await loadClient();
    const seen = makeFetch([
      authError("AUTH_TOKEN_EXPIRED"),
      { status: 201, body: { id: "w1" } },
    ]);

    expect(
      await apiRequest("/v1/weights", { method: "POST", body: { valueKg: 80 } }),
    ).toEqual({ id: "w1" });
    expect(seen.length).toBe(2);
    expect(seen[1]?.method).toBe("POST");
  });

  it("does NOT refresh again on a second expiry", async () => {
    supabase.accessToken = "stale";
    supabase.refreshTo = "fresh";
    const { apiRequest, NouriApiError } = await loadClient();
    const seen = makeFetch([
      authError("AUTH_TOKEN_EXPIRED"),
      authError("AUTH_TOKEN_EXPIRED"),
    ]);

    const error = (await apiRequest("/v1/me").catch((e: unknown) => e)) as NouriApiErrorType;
    expect(error).toBeInstanceOf(NouriApiError);
    expect(error.code).toBe("AUTH_TOKEN_EXPIRED");
    expect(supabase.calls.refresh, "no second refresh — this is the loop guard").toBe(1);
    expect(seen.length, "no third request").toBe(2);
  });

  it("surfaces AUTH_REQUIRED when the refresh fails", async () => {
    supabase.accessToken = "stale";
    supabase.refreshTo = null;
    const { apiRequest, NouriApiError } = await loadClient();
    const seen = makeFetch([authError("AUTH_TOKEN_EXPIRED")]);

    const error = (await apiRequest("/v1/me").catch((e: unknown) => e)) as NouriApiErrorType;
    expect(error).toBeInstanceOf(NouriApiError);
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(error.isAuthFailure).toBe(true);
    expect(supabase.calls.refresh).toBe(1);
    expect(seen.length, "no retry when there is no new token").toBe(1);
  });

  it("never refreshes on AUTH_INVALID_TOKEN", async () => {
    // A malformed or tampered token cannot be fixed by refreshing, and retrying
    // it would be an infinite loop waiting to happen.
    const { apiRequest, NouriApiError } = await loadClient();
    const seen = makeFetch([authError("AUTH_INVALID_TOKEN")]);

    const error = (await apiRequest("/v1/me").catch((e: unknown) => e)) as NouriApiErrorType;
    expect(error).toBeInstanceOf(NouriApiError);
    expect(error.code).toBe("AUTH_INVALID_TOKEN");
    expect(supabase.calls.refresh).toBe(0);
    expect(seen.length).toBe(1);
  });

  it("never refreshes on AUTH_PROVIDER_NOT_ALLOWED", async () => {
    const { apiRequest } = await loadClient();
    makeFetch([authError("AUTH_PROVIDER_NOT_ALLOWED")]);

    await expect(apiRequest("/v1/me")).rejects.toThrow();
    expect(supabase.calls.refresh).toBe(0);
  });

  it("never retries a network failure, even on a mutation", async () => {
    // The request may have been processed and only the response lost. Replaying
    // it could double-write.
    const { apiRequest, NouriApiError } = await loadClient();
    const seen = makeFetch([{ throw: new Error("Network request failed") }]);

    const error = (await apiRequest("/v1/weights", {
      method: "POST",
      body: { valueKg: 80 },
    }).catch((e: unknown) => e)) as NouriApiErrorType;

    expect(error).toBeInstanceOf(NouriApiError);
    expect(error.code).toBe("NETWORK_ERROR");
    expect(supabase.calls.refresh).toBe(0);
    expect(seen.length, "no retry after an ambiguous failure").toBe(1);
  });

  it("fails fast without calling the network when there is no session", async () => {
    supabase.accessToken = null;
    const { apiRequest, NouriApiError } = await loadClient();
    const seen = makeFetch([]);

    const error = (await apiRequest("/v1/me").catch((e: unknown) => e)) as NouriApiErrorType;
    expect(error).toBeInstanceOf(NouriApiError);
    expect(error.code).toBe("AUTH_REQUIRED");
    expect(seen.length).toBe(0);
    expect(supabase.calls.refresh).toBe(0);
  });

  it("does not mistake a 500 for an auth problem", async () => {
    const { apiRequest } = await loadClient();
    makeFetch([{ status: 500, body: { error: { code: "INTERNAL_ERROR" } } }]);

    const error = (await apiRequest("/v1/me").catch((e: unknown) => e)) as NouriApiErrorType;
    expect(error.code).toBe("INTERNAL_ERROR");
    expect(supabase.calls.refresh).toBe(0);
  });

  it("delegates one refresh per expired request", async () => {
    // The client asks for a refresh per failing request; refreshSupabaseSession
    // is what collapses them onto one network call. This asserts the
    // delegation, so the single-flighting cannot be silently bypassed here.
    supabase.accessToken = "stale";
    supabase.refreshTo = "fresh";
    const { apiRequest } = await loadClient();
    makeFetch([
      authError("AUTH_TOKEN_EXPIRED"),
      authError("AUTH_TOKEN_EXPIRED"),
      ok({ n: 1 }),
      ok({ n: 2 }),
    ]);

    const results = await Promise.all([apiRequest("/v1/a"), apiRequest("/v1/b")]);
    expect(results.length).toBe(2);
    expect(supabase.calls.refresh, "delegated per request").toBe(2);
  });
});
