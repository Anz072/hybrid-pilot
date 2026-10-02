import { describe, expect, it, vi } from "vitest";
import { localAuth, requireLocalBackend, type LocalSession } from "./localBackend";

/**
 * MANUAL end-to-end check of the token refresh contract.
 *
 * Skipped unless RUN_MANUAL_E2E is set. It needs a running local Supabase
 * stack and a running nouri-api, and it waits out a real token expiry, so it
 * takes over a minute — but it is *skipped*, not excluded, so `npm test` lists
 * it every time. A check that disappears from the output is a check nobody
 * remembers exists.
 *
 * From nouri-api, run:
 *   node --experimental-strip-types scripts/test-mobile-protocols.ts
 * It owns a disposable local Supabase project with 60-second tokens and a
 * loopback API. It does not modify the ordinary development stack or config.
 *
 * Everything is real except the session store: the API, the token, its expiry,
 * and the GoTrue refresh. Only `getSupabaseSession` is stubbed, because the app
 * persists sessions in SecureStore, which does not exist under Node.
 */

const session = {
  current: null as LocalSession | null,
  refreshCalls: 0,
};

vi.mock("../../src/API/supabase/client", () => ({
  SUPABASE_SESSION_REQUIRED_MESSAGE: "session required",
  getSupabaseSession: async () => session.current,
  refreshSupabaseSession: async () => {
    session.refreshCalls += 1;
    const next = await localAuth("/token?grant_type=refresh_token", {
      refresh_token: session.current?.refresh_token,
    });
    if (!next.access_token) return null;
    session.current = next;
    return next.access_token;
  },
}));

describe.skipIf(!process.env.RUN_MANUAL_E2E)("token refresh, end to end", () => {
  it(
    "expired token -> one refresh, one retry, write lands exactly once",
    async () => {
      requireLocalBackend();
      const email = `e2e.${Date.now()}@nouri.test`;
      const signup = await localAuth("/signup", {
        email,
        password: "E2ERefresh!Pass1",
        data: { name: "E2E" },
      });

      const claims = JSON.parse(
        Buffer.from(signup.access_token!.split(".")[1]!, "base64url").toString("utf8"),
      ) as { exp: number };
      const lifetime = claims.exp - Math.floor(Date.now() / 1000);
      expect(lifetime).toBeGreaterThan(0);
      expect(lifetime).toBeLessThanOrEqual(60);

      session.current = signup;
      session.refreshCalls = 0;

      const { apiRequest } = await import("../../src/API/nouri/client");

      // Works while the token is valid.
      const before = await apiRequest<{ profile: { email: string } }>("/v1/me", { expectedUserId: signup.user.id });
      expect(before.profile.email).toBe(email);
      expect(session.refreshCalls).toBe(0);

      console.log(`  waiting ${lifetime + 8}s for the access token to genuinely expire...`);
      await new Promise((r) => setTimeout(r, (lifetime + 8) * 1000));

      // A MUTATION through the real client with a genuinely expired token.
      const id = `e2e-refresh-${Date.now()}`;
      const created = await apiRequest<{ id: string }>("/v1/weights", {
        method: "POST",
        expectedUserId: signup.user.id,
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
