import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DBUser } from "../src/store/DB_TYPES";
import type { UserState } from "../src/store/userSlice";

/**
 * What the app believes about "who is signed in" when a load fails.
 *
 * With no device database, the profile can only come from the API. That makes
 * one distinction load-bearing that used to be harmless:
 *
 *   hydrate succeeded, found nobody  ->  signed out. Show the login screen.
 *   hydrate failed                   ->  we do not know. Show an error.
 *
 * `hydrated` carries that distinction, and the navigator's error-and-retry
 * screen is gated on it. When the rejected case set `hydrated: true`, the two
 * collapsed: an API outage rendered the welcome screen, telling a signed-in
 * user with a valid Supabase session that they had no account.
 *
 * `DB` is stubbed, so this exercises the reducer rather than the network.
 */

const getUser = vi.fn<() => Promise<DBUser | null>>();

vi.mock("../src/store/DB", () => ({
  DB: {
    getUser: () => getUser(),
  },
}));

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

const USER = {
  id: 1,
  externalId: "u-1",
  displayName: "Test",
  email: "t@example.test",
} as DBUser;

/** Drives the thunk through the reducer the way the store would. */
async function run(): Promise<UserState> {
  const mod = await import("../src/store/userSlice");
  const reducer = mod.default;

  let state = reducer(undefined, { type: "@@INIT" });

  // A minimal store: the thunk dispatches pending/fulfilled/rejected and this
  // folds each through the real reducer, which is the behaviour under test.
  // Typed loosely on purpose — recreating Redux's dispatch signature here would
  // test the type, not the reducer.
  const dispatch = ((action: { type: string }) => {
    state = reducer(state, action as Parameters<typeof reducer>[1]);
    return action;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  await mod.hydrateUserFromDb()(dispatch, () => ({}), undefined);
  return state;
}

describe("session hydration", () => {
  beforeEach(() => {
    getUser.mockReset();
  });

  it("a successful hydrate is hydrated, with the user", async () => {
    getUser.mockResolvedValue(USER);
    const state = await run();

    expect(state.hydrated).toBe(true);
    expect(state.status).toBe("idle");
    expect(state.currentUser?.externalId).toBe("u-1");
  });

  it("hydrating to nobody is still hydrated — that is a real answer", async () => {
    getUser.mockResolvedValue(null);
    const state = await run();

    expect(state.hydrated).toBe(true);
    expect(state.currentUser).toBeNull();
    expect(state.status).toBe("idle");
  });

  it("a failed hydrate is NOT hydrated, so an outage cannot read as signed out", async () => {
    getUser.mockRejectedValue(new Error("Could not reach the server."));
    const state = await run();

    expect(state.status).toBe("failed");
    expect(state.currentUser).toBeNull();
    expect(
      state.hydrated,
      "a failed load must not claim to know that there is no user",
    ).toBe(false);
    expect(state.error).toBe("Could not reach the server.");
  });

  it("the navigator's error screen is reachable from that state", () => {
    const src = readFileSync(
      path.join(ROOT, "src", "navigation", "AppNavigator.tsx"),
      "utf8",
    );
    // The guard and the failure state have to agree, or the error screen is
    // dead code and the app silently falls through to the signed-out stack.
    expect(src).toMatch(/if \(bootstrapError && !userHydrated\)/);
    expect(src).toMatch(/Could not start the app/);
  });
});
