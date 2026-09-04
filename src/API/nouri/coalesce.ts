// In-flight request coalescing.
//
// Several screens issue the same request from more than one place at once: the
// diary's focus effect and its date-change effect both load the visible week;
// the add-food screen prefetches its lists while the screen it was opened from
// is still mounted and doing the same. Each of those was a second identical
// round trip, and — worse — two responses racing to set the same state.
//
// This is NOT a cache. Nothing is retained after the request settles: a second
// caller arriving one millisecond later gets a fresh request. It only ensures
// that callers who ask *while a request is already in flight* share that one
// request rather than starting another.
//
// The distinction matters because it is the whole reason this is allowed to
// exist at all. A cache would be a second copy of server data on the device,
// which is exactly what this app no longer has. Joining a request that has not
// answered yet is not a copy of anything.

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Runs `request` under `key`, or joins the one already running under it.
 *
 * The entry is removed when the promise settles — success or failure alike, so
 * a failed request is retried rather than a rejection being handed to every
 * later caller. Removal is by identity, not by key: a request left over from a
 * previous user settling late must not evict the live one.
 */
export const coalesce = <T>(key: string, request: () => Promise<T>): Promise<T> => {
  const existing = inFlight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = request().finally(() => {
    if (inFlight.get(key) === promise) {
      inFlight.delete(key);
    }
  });

  inFlight.set(key, promise);
  return promise;
};

/** True while a request is in flight under this key. Used by traces and tests. */
export const isCoalescing = (key: string): boolean => inFlight.has(key);

/**
 * Drops every in-flight entry, on sign-out.
 *
 * The promises themselves keep running — they cannot be cancelled — but they
 * are no longer reachable, so a request started by the previous user can never
 * resolve into the next user's screen. Their late `finally` finds a different
 * promise under the key, or none, and removes nothing.
 */
export const resetCoalescedRequests = (): void => {
  inFlight.clear();
};
