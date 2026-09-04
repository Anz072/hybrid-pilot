import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Which way the dependencies point.
 *
 * The app has three kinds of module and they are not peers:
 *
 *   src/domain/   the domain's vocabulary and its pure rules. Knows nothing
 *                 about transport, storage, navigation or React.
 *   src/engine/   calculations over that vocabulary. Same constraint.
 *   src/store/    the API-backed data access screens call.
 *
 * `src/domain/` and `src/engine/nutrition.ts` are the modules the shared
 * conformance corpus runs against, alongside their counterparts in nouri-api.
 * That only works while they stay portable: a domain rule that imports a screen
 * type, a navigator, or the API client cannot be compared to anything.
 *
 * The vocabulary used to live in `src/store/DB_TYPES.ts` — a file named after a
 * device database that no longer exists — so the pure modules imported their
 * own vocabulary from the storage layer. These tests are what stop that
 * returning.
 */

const ROOT = path.resolve(fileURLToPath(import.meta.url), "../..");

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(path.relative(ROOT, full));
    }
  };
  walk(path.join(ROOT, dir));
  return out;
}

/** Every module specifier a file imports from. */
function importsOf(rel: string): string[] {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
}

const FORBIDDEN_FOR_PURE_MODULES = [
  { pattern: /(^|\/)store\//, why: "data access" },
  { pattern: /(^|\/)API\//, why: "transport" },
  { pattern: /(^|\/)screens\//, why: "a screen" },
  { pattern: /(^|\/)navigation\//, why: "navigation" },
  { pattern: /(^|\/)storage\//, why: "device storage" },
  { pattern: /^react(-native)?$/, why: "React" },
  { pattern: /^expo/, why: "an Expo module" },
];

describe("domain purity", () => {
  it("src/domain imports nothing from storage, transport, screens or React", () => {
    const violations: string[] = [];

    for (const file of filesUnder("src/domain")) {
      for (const spec of importsOf(file)) {
        const rule = FORBIDDEN_FOR_PURE_MODULES.find((r) => r.pattern.test(spec));
        if (rule) violations.push(`${file} imports ${rule.why}: ${spec}`);
      }
    }

    expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
  });

  it("the nutrition engine states its own inputs rather than borrowing stored records", () => {
    // `src/engine/nutrition.ts` is pinned against nouri-api by the conformance
    // corpus. It has to describe the fields it reads, not `Pick` them off a
    // record shape that only exists on this side.
    const src = readFileSync(path.join(ROOT, "src/engine/nutrition.ts"), "utf8");

    expect(src).not.toMatch(/DB_TYPES/);
    expect(src).toMatch(/export type FoodServingFields = \{/);
    expect(src).toMatch(/export type LoggedNutritionEntry = \{/);
  });

  it("the domain vocabulary lives in src/domain, not in the storage layer", () => {
    const vocabulary = readFileSync(path.join(ROOT, "src/domain/types.ts"), "utf8");
    for (const name of [
      "NutritionBasis",
      "UserFoodLogSource",
      "WeightEntrySource",
      "FoodSource",
      "RecipeBuildMethod",
      "AdaptiveCalorieMode",
    ]) {
      expect(vocabulary, `${name} should be defined in src/domain/types.ts`).toMatch(
        new RegExp(`export type ${name}\\b`),
      );
    }

    // And DB_TYPES re-exports them, so the ~45 existing importers keep working.
    // Deleting the re-export is a decision, not an accident.
    const dbTypes = readFileSync(path.join(ROOT, "src/store/DB_TYPES.ts"), "utf8");
    expect(dbTypes).toMatch(/from "\.\.\/domain\/types"/);
    expect(dbTypes).not.toMatch(/^export type NutritionBasis =/m);
  });
});

describe("test suite hygiene", () => {
  it("no test file is left behind in scripts/", () => {
    // The suite moved to vitest under test/. A stray `.test.cjs` would be run
    // by nothing and would rot silently.
    const stragglers = readdirSync(path.join(ROOT, "scripts")).filter((f) =>
      f.endsWith(".test.cjs"),
    );
    expect(stragglers).toEqual([]);
  });
});
