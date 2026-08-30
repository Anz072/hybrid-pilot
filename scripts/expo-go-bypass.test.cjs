const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Locks down the Expo Go development bypass.
 *
 * In Expo Go dev mode the app runs entirely against local SQLite: no backend,
 * no Supabase, no network. That is enforced today by a guard at the top of each
 * store function — `resolveUserId()` returns null in dev mode, and every caller
 * short-circuits to its local implementation.
 *
 * Per-function guards are exactly the kind of invariant that grows a hole:
 * a new store function that forgets one would silently make HTTP requests in a
 * mode that is supposed to be offline, and nothing else would notice.
 *
 * This is static analysis over the source, so it needs no native modules and no
 * running stack. It fails when a new API-calling export appears without a
 * guard, or when a remote-only helper gains an unguarded caller.
 */

const ROOT = path.join(__dirname, "..");
const STORES = ["diaryStore", "userStore", "libraryStore", "foodSearchStore"];

const GUARDS = ["resolveUserId", "isExpoGoDevUserId", "shouldUseExpoGoDevLocalStore"];

/**
 * Helpers that deliberately talk to the backend unconditionally. Each is only
 * reachable from an already-guarded caller, which the final test verifies.
 * Adding to this list is a decision, not a formality.
 */
const REMOTE_ONLY_HELPERS = new Set(["getFoodByRefRemote"]);

const read = (store) => fs.readFileSync(path.join(ROOT, "src/store", `${store}.ts`), "utf8");

/** Names imported from the API client layer, excluding pure mappers/types. */
function apiFunctionNames(src) {
  const names = new Set();
  const re = /import\s*\{([^}]*)\}\s*from\s*"\.\.\/API\/nouri\/[^"]+"/gs;
  let m;
  while ((m = re.exec(src))) {
    for (let part of m.group ? [] : m[1].split(",")) {
      part = part.trim();
      if (!part || part.startsWith("type ")) continue;
      names.add(part.split(" as ").pop().trim());
    }
  }
  // `toDbFoodItem` and friends are mappers exported from the same module; they
  // perform no I/O, so they must not count as API calls.
  for (const mapper of ["toDbFoodItem", "toDbEntry", "toDbFood"]) names.delete(mapper);
  return names;
}

/** Every top-level `export const name = async (...) => { ... }` with its body. */
function exportedAsyncFunctions(src) {
  const out = [];
  const re = /^export const (\w+) = async \(/gm;
  let m;
  while ((m = re.exec(src))) {
    const arrow = src.indexOf("=> {", m.index);
    if (arrow === -1) continue;
    let depth = 0;
    let j = arrow + 3;
    for (; j < src.length; j += 1) {
      if (src[j] === "{") depth += 1;
      else if (src[j] === "}") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    out.push({ name: m[1], body: src.slice(arrow + 3, j + 1) });
  }
  return out;
}

function firstApiCall(body, apiNames) {
  let best = null;
  for (const name of apiNames) {
    const m = new RegExp(`\\b${name}\\s*\\(`).exec(body);
    if (m && (best === null || m.index < best.index)) best = { name, index: m.index };
  }
  return best;
}

function firstGuard(body) {
  let best = null;
  for (const g of GUARDS) {
    const m = new RegExp(`\\b${g}\\s*\\(`).exec(body);
    if (m && (best === null || m.index < best.index)) best = { name: g, index: m.index };
  }
  return best;
}

test("every store function that calls the API guards the Expo Go bypass first", () => {
  const unguarded = [];
  let checked = 0;

  for (const store of STORES) {
    const src = read(store);
    const apiNames = apiFunctionNames(src);
    // Cross-store remote helpers count as API calls too.
    for (const helper of REMOTE_ONLY_HELPERS) {
      if (new RegExp(`import\\s*\\{[^}]*\\b${helper}\\b`, "s").test(src)) apiNames.add(helper);
    }

    for (const fn of exportedAsyncFunctions(src)) {
      const api = firstApiCall(fn.body, apiNames);
      if (!api) continue;
      if (REMOTE_ONLY_HELPERS.has(fn.name)) continue; // asserted separately below
      checked += 1;
      const guard = firstGuard(fn.body);
      if (!guard || guard.index > api.index) {
        unguarded.push(`${store}.${fn.name} calls ${api.name} without a preceding guard`);
      }
    }
  }

  assert.ok(checked > 30, `expected to inspect many functions, saw ${checked}`);
  assert.deepEqual(unguarded, [], `\n${unguarded.join("\n")}\n`);
});

test("remote-only helpers are only ever called from guarded functions", () => {
  const violations = [];

  for (const store of STORES) {
    const src = read(store);
    for (const fn of exportedAsyncFunctions(src)) {
      for (const helper of REMOTE_ONLY_HELPERS) {
        if (fn.name === helper) continue;
        const call = new RegExp(`\\b${helper}\\s*\\(`).exec(fn.body);
        if (!call) continue;
        const guard = firstGuard(fn.body);
        if (!guard || guard.index > call.index) {
          violations.push(`${store}.${fn.name} calls ${helper} without a preceding guard`);
        }
      }
    }
  }

  assert.deepEqual(violations, [], `\n${violations.join("\n")}\n`);
});

test("the bypass is limited to Expo Go in development", () => {
  const src = fs.readFileSync(path.join(ROOT, "src/dev/expoGoDevAuth.ts"), "utf8");
  // Both conditions matter: __DEV__ alone would enable it in a dev-client or a
  // debug build talking to a real backend.
  assert.match(src, /__DEV__\s*&&\s*isRunningInExpoGo\(\)/);
  // A throw from isRunningInExpoGo must disable the bypass, not enable it.
  assert.match(src, /catch\s*\{\s*return false;/);
});

test("the dev bypass never reaches Supabase or the API client", () => {
  const src = fs.readFileSync(path.join(ROOT, "src/dev/expoGoDevAuth.ts"), "utf8");
  assert.ok(!/API\/nouri/.test(src), "dev bypass must not import the API client");
  assert.ok(!/API\/supabase/.test(src), "dev bypass must not import the Supabase client");
  assert.ok(!/supabase/i.test(src.replace(/^\s*(\/\/|\*).*$/gm, "")), "no Supabase usage");
});

test("local-API development and the Expo Go bypass stay separate mechanisms", () => {
  const guard = fs.readFileSync(path.join(ROOT, "src/config/environmentGuard.ts"), "utf8");
  const dev = fs.readFileSync(path.join(ROOT, "src/dev/expoGoDevAuth.ts"), "utf8");
  // Pointing EXPO_PUBLIC_* at localhost must not switch on the offline bypass,
  // and the bypass must not care what those URLs say. They are different modes.
  assert.ok(!/EXPO_GO_DEV|isRunningInExpoGo/.test(guard),
    "the environment guard must not know about the Expo Go bypass");
  assert.ok(!/EXPO_PUBLIC_/.test(dev),
    "the Expo Go bypass must not read endpoint configuration");
});

test("the dev user id is a constant, not a real Supabase uuid", () => {
  const src = fs.readFileSync(path.join(ROOT, "src/dev/expoGoDevAuth.ts"), "utf8");
  const m = /EXPO_GO_DEV_USER_ID = "([^"]+)"/.exec(src);
  assert.ok(m, "dev user id constant not found");
  // A uuid would collide with a real auth subject; a sentinel cannot.
  assert.ok(!/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(m[1]), `dev id looks like a uuid: ${m[1]}`);
});
