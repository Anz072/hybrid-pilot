import { describe, expect, it, vi } from "vitest";

/**
 * MANUAL end-to-end check of the token refresh contract.
 *
 * Skipped unless RUN_MANUAL_E2E is set. It needs a running local Supabase
 * stack and a running nouri-api, and it waits out a real token expiry, so it
 * takes over a minute — but it is *skipped*, not excluded, so `npm test` lists
 * it every time. A check that disappears from the output is a check nobody
 * remembers exists.
 *
 *   1. In nouri-api/supabase/config.toml set `jwt_expiry = 60`
 *   2. pnpm supabase stop && pnpm supabase start
 *   3. pnpm start:local            (nouri-api on :8080)
 *   4. RUN_MANUAL_E2E=1 npx vitest run test/manual/tokenRefreshE2E.test.ts
 *   5. restore `jwt_expiry = 3600`
 *
 * Everything is real except the session store: the API, the token, its expiry,
 * and the GoTrue refresh. Only `getSupabaseSession` is stubbed, because the app
 * persists sessions in SecureStore, which does not exist under Node.
 */

const AUTH = "http://127.0.0.1:54321/auth/v1";

interface LocalSession {
  access_token: string;
  refresh_token: string;
}

const session = {
  current: null as LocalSession | null,
  refreshCalls: 0,
};

const post = async (p: string, b: unknown): Promise<Record<string, string>> =>
  (await fetch(`${AUTH}${p}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(b),
  })).json() as Promise<Record<string, string>>;

vi.mock("../../src/API/supabase/client", () => ({
  SUPABASE_SESSION_REQUIRED_MESSAGE: "session required",
  getSupabaseSession: async () => session.current,
  refreshSupabaseSession: async () => {
    session.refreshCalls += 1;
    const next = await post("/token?grant_type=refresh_token", {
      refresh_token: session.current?.refresh_token,
    });
    if (!next.access_token) return null;
    session.current = {
      access_token: next.access_token,
      refresh_token: next.refresh_token!,
    };
    return next.access_token;
  },
}));

describe.skipIf(!process.env.RUN_MANUAL_E2E)("token refresh, end to end", () => {
  it(
    "expired token -> one refresh, one retry, write lands exactly once",
    async () => {
      const email = `e2e.${Date.now()}@nouri.test`;
      const signup = await post("/signup", {
        email,
        password: "E2ERefresh!Pass1",
        data: { name: "E2E" },
      });

      const claims = JSON.parse(
        Buffer.from(signup.access_token!.split(".")[1]!, "base64url").toString("utf8"),
      ) as { exp: number };
      const lifetime = claims.exp - Math.floor(Date.now() / 1000);

      session.current = {
        access_token: signup.access_token!,
        refresh_token: signup.refresh_token!,
      };
      session.refreshCalls = 0;

      const { apiRequest } = await import("../../src/API/nouri/client");

      // Works while the token is valid.
      const before = await apiRequest<{ profile: { email: string } }>("/v1/me");
      expect(before.profile.email).toBe(email);
      expect(session.refreshCalls).toBe(0);

      console.log(`  waiting ${lifetime + 8}s for the access token to genuinely expire...`);
      await new Promise((r) => setTimeout(r, (lifetime + 8) * 1000));

      // A MUTATION through the real client with a genuinely expired token.
      const id = `e2e-refresh-${Date.now()}`;
      const created = await apiRequest<{ id: string }>("/v1/weights", {
        method: "POST",
        body: {
          id,
          clientGeneratedId: id,
          measuredAt: new Date().toISOString(),
          measuredAtLocalIso: "2026-08-29T09:00:00",
          zoneOffsetMinutes: 0,
          valueKg: 81.2,
          valueOriginal: 81.2,
          source: "manual",
        },
      });

      expect(created.id, "the retry succeeded transparently").toBe(id);
      expect(session.refreshCalls, "exactly one refresh").toBe(1);

      // Exactly one row: the expired attempt wrote nothing, the retry wrote once.
      const list = await apiRequest<{ entries: { id: string }[] }>("/v1/weights");
      const rows = list.entries.filter((e) => e.id === id);
      expect(rows.length, "no double-write").toBe(1);
    },
    // The whole point is waiting out a real expiry.
    { timeout: 180_000 },
  );
});
