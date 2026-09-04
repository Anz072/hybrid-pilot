import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Locks down the single-source-of-truth rule.
 *
 * Supabase PostgreSQL, reached only through nouri-api, is the one place
 * application data lives. The device holds no copy of any of it: no cache, no
 * mirror, no offline queue, no "local user". Anything the device does keep —
 * whether onboarding finished, the profile draft collected before an account
 * exists, display preferences — is state the server has no column for and could
 * not answer.
 *
 * This replaces scripts/expo-go-bypass.test.cjs, which guarded the opposite
 * arrangement: a development mode that ran entirely against local SQLite. That
 * mode is gone, and test 6 below keeps it gone.
 *
 * All of this is static analysis over the source. It needs no native modules,
 * no simulator and no running stack, so it runs in `npm test` alongside
 * everything else.
 */

/**
 * Thin shims so the assertions below keep reading as statements of fact with a
 * message attached, rather than as chained matcher calls. `expect`'s optional
 * second argument carries the message into the failure output.
 */
const expectEqual = (actual: unknown, expected: unknown, message?: string) =>
  expect(actual, message).toEqual(expected);
const expectOk = (value: unknown, message?: string) =>
  expect(Boolean(value), message).toBe(true);
const expectMatch = (value: string, pattern: RegExp, message?: string) =>
  expect(value, message).toMatch(pattern);

describe("remote-only storage", () => {
const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");
const STORES = ["diaryStore", "userStore", "libraryStore", "foodSearchStore"];

const read = (rel: string): string => readFileSync(path.join(ROOT, rel), "utf8");
const exists = (rel: string): boolean => existsSync(path.join(ROOT, rel));

/** Source lines with comments and string literals stripped, for honest matching. */
const code = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');

/** Every .ts/.tsx file under src/. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(path.relative(ROOT, full));
    }
  };
  walk(path.join(ROOT, "src"));
  return out;
}

/**
 * Every top-level `export const name = async (...) => ...`, with its body.
 *
 * Both forms matter. A concise body — `async (...) => copyDay(to, from)` — is
 * the shape a one-call wrapper naturally takes, and skipping to the next `{`
 * would silently attribute the *following* function's body to it.
 */
interface ExportedFunction {
  name: string;
  body: string;
}

function exportedAsyncFunctions(src: string): ExportedFunction[] {
  const out: ExportedFunction[] = [];
  const re = /^export const (\w+) = async \(/gm;
  let m;
  while ((m = re.exec(src))) {
    // Walk the parameter list to its closing paren, then find this
    // declaration's own `=>`.
    let depth = 0;
    let i = src.indexOf("(", m.index + `export const ${m[1]} = async `.length);
    for (; i < src.length; i += 1) {
      if (src[i] === "(") depth += 1;
      else if (src[i] === ")") {
        depth -= 1;
        if (depth === 0) break;
      }
    }
    const arrow = src.indexOf("=>", i);
    if (arrow === -1) continue;

    const after = src.slice(arrow + 2);
    const braceOffset = after.search(/\S/);
    if (after[braceOffset] === "{") {
      const start = arrow + 2 + braceOffset;
      let d = 0;
      let j = start;
      for (; j < src.length; j += 1) {
        if (src[j] === "{") d += 1;
        else if (src[j] === "}") {
          d -= 1;
          if (d === 0) break;
        }
      }
      out.push({ name: m[1], body: src.slice(start, j + 1) });
    } else {
      // Concise body: everything up to the terminating `;` at column 0-ish.
      const end = src.indexOf(";\n", arrow);
      out.push({ name: m[1], body: src.slice(arrow + 2, end === -1 ? src.length : end) });
    }
  }
  return out;
}

/** Names imported from the API transport layer, excluding pure mappers and types. */
function apiFunctionNames(src: string): Set<string> {
  const names = new Set<string>();
  const re = /import\s*\{([^}]*)\}\s*from\s*"\.\.\/API\/[^"]+"/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    for (const raw of (m[1] ?? "").split(",")) {
      const part = raw.trim();
      if (!part || part.startsWith("type ")) continue;
      const name = part.split(" as ").pop()?.trim();
      if (name) names.add(name);
    }
  }
  // Exported from the same modules but perform no I/O.
  for (const mapper of ["toDbFoodItem", "toDbEntry", "toDbFood", "toDbEntries", "toDbStatus"]) {
    names.delete(mapper);
  }
  return names;
}

// ---------------------------------------------------------------------------
// 1. The SQLite dependency is gone
// ---------------------------------------------------------------------------

it("expo-sqlite is not a dependency, a plugin, or imported anywhere", () => {
  const pkg = JSON.parse(read("package.json"));
  expectOk(
    !("expo-sqlite" in { ...pkg.dependencies, ...pkg.devDependencies }),
    "expo-sqlite is still declared in package.json",
  );

  const app = JSON.parse(read("app.json"));
  const plugins: string[] = (app.expo?.plugins ?? []).map((p: string | string[]) =>
    Array.isArray(p) ? p[0] : p,
  );
  expectOk(!plugins.includes("expo-sqlite"), "expo-sqlite is still an Expo plugin");

  const importers = sourceFiles().filter((f) => /expo-sqlite/.test(read(f)));
  expectEqual(importers, [], `still importing expo-sqlite:\n${importers.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 2. The local database subsystem is gone, not merely unused
// ---------------------------------------------------------------------------

it("no local database or repository module survives", () => {
  const removed = [
    "src/storage/sqlite.ts",
    "src/store/cacheRepository.ts",
    "src/store/foodLogRepository.ts",
    "src/store/foodRepository.ts",
    "src/store/recipeRepository.ts",
    "src/store/userRepository.ts",
    "src/store/userSettingsRepository.ts",
    "src/store/weightRepository.ts",
  ];
  const surviving = removed.filter(exists);
  expectEqual(
    surviving,
    [],
    `a dormant local data layer is still present:\n${surviving.join("\n")}`,
  );

  // And nothing new has taken their place.
  const repos = sourceFiles().filter((f) => /[Rr]epository\.tsx?$/.test(f));
  expectEqual(repos, [], `unexpected repository module:\n${repos.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 3. The stores talk to the API and to nothing else
// ---------------------------------------------------------------------------

it("stores import no local persistence", () => {
  const violations = [];
  for (const store of STORES) {
    const src = code(read(`src/store/${store}.ts`));
    for (const m of src.matchAll(/from\s+"([^"]+)"/g)) {
      const spec = m[1];
      if (/Repository|storage\/sqlite|storage\/kv|storage\/localStore|expo-sqlite/.test(spec)) {
        violations.push(`${store} imports ${spec}`);
      }
    }
  }
  expectEqual(violations, [], `\n${violations.join("\n")}\n`);
});

// ---------------------------------------------------------------------------
// 4. Every domain read is a request
// ---------------------------------------------------------------------------

it("every exported store function reaches the API", () => {
  const localOnly = [];
  let checked = 0;

  for (const store of STORES) {
    const src = read(`src/store/${store}.ts`);
    const apiNames = apiFunctionNames(src);
    // Store-to-store helpers that are themselves API-backed.
    for (const helper of ["getFoodByRefRemote", "getDiaryDay", "getDiaryRange"]) {
      if (new RegExp(`\\b${helper}\\b`).test(src)) apiNames.add(helper);
    }
    // Same-module callers count too: a thin wrapper over an API-backed export
    // is still a request.
    for (const fn of exportedAsyncFunctions(src)) apiNames.add(fn.name);

    for (const fn of exportedAsyncFunctions(src)) {
      // `deleteFoodItem` exists to throw: the shared catalogue is insert-only.
      if (fn.name === "deleteFoodItem") continue;
      checked += 1;
      const callsApi = [...apiNames].some(
        (name) => name !== fn.name && new RegExp(`\\b${name}\\s*\\(`).test(fn.body),
      );
      if (!callsApi) localOnly.push(`${store}.${fn.name} returns without calling the API`);
    }
  }

  expectOk(checked > 25, `expected to inspect many functions, saw ${checked}`);
  expectEqual(localOnly, [], `\n${localOnly.join("\n")}\n`);
});

// ---------------------------------------------------------------------------
// 5. A failed write fails
// ---------------------------------------------------------------------------

it("no store function reports success it did not get", () => {
  // The weight path used to write locally, mark the row `sync_error` on
  // rejection, and return it as though it had saved. The only failure a store
  // may absorb is 404 on a delete, where the caller's intent is already true.
  const violations = [];

  for (const store of STORES) {
    const src = code(read(`src/store/${store}.ts`));
    for (const m of src.matchAll(/catch\s*\((\w+)\)\s*\{([\s\S]*?)\n  \}/g)) {
      const body = m[2];
      const rethrows = /throw\s+\w/.test(body);
      const notFoundOnly = /isNotFound/.test(body);
      if (!rethrows && !notFoundOnly) {
        violations.push(`${store}: catch block neither rethrows nor is 404-scoped`);
      }
    }
  }

  const anySyncState = sourceFiles().filter((f) =>
    /sync_error|syncStatus|pendingSync|mutationQueue|outbox/.test(code(read(f))),
  );

  expectEqual(violations, [], `\n${violations.join("\n")}\n`);
  expectEqual(anySyncState, [], `offline sync state reappeared:\n${anySyncState.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 6. The Expo Go local-store bypass stays gone
// ---------------------------------------------------------------------------

it("no development mode runs against local storage", () => {
  expectOk(!exists("src/dev/expoGoDevAuth.ts"), "the Expo Go local-store bypass is back");

  const offenders = sourceFiles().filter((f) =>
    /isRunningInExpoGo|shouldUseExpoGoDevLocalStore|EXPO_GO_DEV_USER_ID|isExpoGoDevUserId/.test(
      code(read(f)),
    ),
  );
  expectEqual(offenders, [], `bypass references remain:\n${offenders.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 7. What the device keeps is an allow-list
// ---------------------------------------------------------------------------

it("device storage holds only non-domain keys", () => {
  const src = read("src/storage/localStore.ts");
  const keys = [...src.matchAll(/^const KEY_\w+ = "([^"]+)";$/gm)].map((m) => m[1]);

  expectEqual(
    keys.sort(),
    [
      "adaptiveRecommendationSeen",
      "foodSearchSectionState",
      "foodTrackingPreferences",
      "onboardingComplete",
      "onboardingProfile",
    ],
    "the device storage allow-list changed",
  );

  // Plus display preferences, which live in their own module.
  const display = read("src/preferences/displayPreferences.ts");
  expectMatch(display, /const STORAGE_KEY = "displayPreferences";/);

  // A local identity record is not one of them.
  const identity = sourceFiles().filter((f) =>
    /\bLocalAccount\b|saveLocalAccount|getLocalAccount/.test(code(read(f))),
  );
  expectEqual(identity, [], `device-local account record is back:\n${identity.join("\n")}`);
});

// ---------------------------------------------------------------------------
// 8. Session hints are memory-only
// ---------------------------------------------------------------------------

it("shortcut recents and recent searches never touch storage", () => {
  const src = read("src/storage/localStore.ts");

  for (const fn of ["saveShortcutRecents", "saveFoodRecentSearches"]) {
    const start = src.indexOf(`export const ${fn} = `);
    expectOk(start !== -1, `${fn} not found`);
    const body = src.slice(start, src.indexOf("\n};", start));
    expectOk(
      !/writeKv|writeJsonKv|AsyncStorage/.test(body),
      `${fn} persists to device storage`,
    );
  }

  for (const fn of ["getShortcutRecents", "getFoodRecentSearches"]) {
    const start = src.indexOf(`export const ${fn} = `);
    expectOk(start !== -1, `${fn} not found`);
    const body = src.slice(start, src.indexOf(";\n", start));
    expectOk(!/readKv|readJsonKv/.test(body), `${fn} reads from device storage`);
  }
});

// ---------------------------------------------------------------------------
// 9. Device storage has exactly two callers
// ---------------------------------------------------------------------------

it("only the two preference modules reach device storage", () => {
  const allowed = new Set([
    "src/storage/kv.ts",
    "src/storage/localStore.ts",
    "src/preferences/displayPreferences.ts",
  ]);

  const callers = sourceFiles().filter(
    (f) => !allowed.has(f) && /storage\/kv"|async-storage/.test(read(f)),
  );
  expectEqual(callers, [], `device storage reached directly from:\n${callers.join("\n")}`);

  // And the KV module itself stores strings, not rows: no SQL, no schema.
  const kv = code(read("src/storage/kv.ts"));
  expectOk(!/CREATE TABLE|SELECT |INSERT INTO|migrat/i.test(kv), "kv.ts grew a schema");
});

// ---------------------------------------------------------------------------
// 10. Sign-out has nothing on disk to clear
// ---------------------------------------------------------------------------

it("sign-out clears memory only, and DB exposes no cache API", () => {
  const auth = code(read("src/API/supabase/auth.ts"));
  expectOk(
    !/clearUserCache|clearPublicFoodCache|cacheRepository|resetDb/.test(auth),
    "sign-out still clears an on-device data store",
  );

  const db = code(read("src/store/DB.ts"));
  for (const name of [
    "getCachedBarcodeLookup",
    "saveCachedBarcodeMiss",
    "getCacheHealth",
    "clearUserCache",
    "clearPublicFoodCache",
  ]) {
    expectOk(!new RegExp(`\\b${name}\\b`).test(db), `DB still exposes ${name}`);
  }
});

});
