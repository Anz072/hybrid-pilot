import { describe, expect, it, vi } from "vitest";



/**
 * A fresh module per test.
 *
 * `coalesce` holds its in-flight map at module scope — that is the whole point
 * of it, and is why two mounted screens can share one request. Tests therefore
 * have to start from an empty one, or the seventh test inherits the sixth
 * test's flights.
 */
const load = async () => {
  vi.resetModules();
  return import("../src/API/nouri/coalesce");
};

/** A promise plus the handles to settle it, so tests control timing exactly. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const expectEqual = (actual: unknown, expected: unknown, message?: string) =>
  expect(actual, message).toEqual(expected);
const expectRejects = (promise: Promise<unknown>, pattern: RegExp) =>
  expect(promise).rejects.toThrow(pattern);

describe("request coalescing", () => {
it("two callers during one flight share a single request", async () => {
  const { coalesce } = await load();
  const d = deferred();
  let calls = 0;

  const a = coalesce("k", () => {
    calls += 1;
    return d.promise;
  });
  const b = coalesce("k", () => {
    calls += 1;
    return d.promise;
  });

  expectEqual(calls, 1, "the second caller started its own request");
  d.resolve("value");
  expectEqual(await a, "value");
  expectEqual(await b, "value");
});

it("this is not a cache: a caller after settling gets a fresh request", async () => {
  const { coalesce } = await load();
  let calls = 0;
  const run = () => coalesce("k", async () => {
    calls += 1;
    return calls;
  });

  expectEqual(await run(), 1);
  expectEqual(await run(), 2, "the second call reused a settled result");
  expectEqual(calls, 2);
});

it("different keys never share", async () => {
  const { coalesce } = await load();
  const seen: string[] = [];
  await Promise.all([
    coalesce("a", async () => {
      seen.push("a");
    }),
    coalesce("b", async () => {
      seen.push("b");
    }),
  ]);
  expectEqual(seen.sort(), ["a", "b"]);
});

it("a failure is not handed to later callers", async () => {
  const { coalesce } = await load();
  let calls = 0;
  const run = () => coalesce("k", async () => {
    calls += 1;
    if (calls === 1) throw new Error("first fails");
    return "second succeeds";
  });

  await expectRejects(run(), /first fails/);
  // A retained rejection would make every later caller fail forever.
  expectEqual(await run(), "second succeeds");
});

it("both joiners see the same rejection", async () => {
  const { coalesce } = await load();
  const d = deferred();
  const a = coalesce("k", () => d.promise);
  const b = coalesce("k", () => d.promise);
  d.reject(new Error("boom"));
  await expectRejects(a, /boom/);
  await expectRejects(b, /boom/);
});

it("isCoalescing reports the flight, and stops at settle", async () => {
  const { coalesce, isCoalescing } = await load();
  const d = deferred();
  expectEqual(isCoalescing("k"), false);
  const p = coalesce("k", () => d.promise);
  expectEqual(isCoalescing("k"), true);
  d.resolve(1);
  await p;
  expectEqual(isCoalescing("k"), false);
});

it("sign-out detaches in-flight requests from the next user", async () => {
  const { coalesce, isCoalescing, resetCoalescedRequests } = await load();
  const first = deferred();
  const previousUser = coalesce("k", () => first.promise);

  resetCoalescedRequests();
  expectEqual(isCoalescing("k"), false, "a new caller could still join the old flight");

  // A caller after the reset must start its own request, not adopt the one the
  // previous user's screen left running.
  const second = deferred();
  const nextUser = coalesce("k", () => second.promise);

  first.resolve("previous user's data");
  second.resolve("next user's data");
  expectEqual(await previousUser, "previous user's data");
  expectEqual(await nextUser, "next user's data");
});

it("a settling pre-reset request does not evict the post-reset entry", async () => {
  const { coalesce, isCoalescing, resetCoalescedRequests } = await load();
  const first = deferred();
  const stale = coalesce("k", () => first.promise);

  resetCoalescedRequests();
  const second = deferred();
  const fresh = coalesce("k", () => second.promise);

  first.resolve("stale");
  await stale;
  // The stale cleanup must only remove its own entry, or the live request
  // silently loses its coalescing.
  expectEqual(isCoalescing("k"), true, "the live entry was evicted by a stale one");

  second.resolve("fresh");
  expectEqual(await fresh, "fresh");
});
});
