import { describe, expect, it } from "vitest";
import {
  buildFoodLogDuplicateKey,
  getFoodLogCopyPreview,
  getFoodLogEntriesToCopy,
  toFoodLogDuplicateShape,
} from "../src/store/foodLogCopyUtils";
import type { DBUserFoodLogEntry } from "../src/store/DB_TYPES";

const baseEntry = (
  overrides: Partial<DBUserFoodLogEntry> = {},
): DBUserFoodLogEntry => ({
  id: 1,
  userExternalId: "user-1",
  foodId: 10,
  date: "2026-05-16",
  loggedAt: "2026-05-16T07:30:00.000Z",
  quantityG: 100,
  mealType: null,
  createdAt: "2026-05-16T07:30:00.000Z",
  entrySource: "food_item",
  foodName: "Greek yogurt",
  servingSize: 100,
  servingUnit: "g",
  calories: 120,
  proteinG: 15,
  carbsG: 8,
  fatG: 3,
  alcoholG: null,
  systemCalculatedCalories: null,
  isEnergyManuallySet: false,
  quickAddName: null,
  ...overrides,
});

describe("copy a diary day", () => {
  it("duplicate keys preserve timestamp seconds", () => {
    // Second-precision matters: two entries a second apart are two meals, and
    // truncating to the minute would silently swallow one of them.
    const first = baseEntry({ loggedAt: "2026-05-16T07:30:01.000Z" });
    const second = baseEntry({ loggedAt: "2026-05-17T07:30:02.000Z" });

    // Through the same adapter the copy path uses, so the test exercises the
    // real composition rather than a shape assembled by hand.
    expect(buildFoodLogDuplicateKey(toFoodLogDuplicateShape(first))).not.toBe(
      buildFoodLogDuplicateKey(toFoodLogDuplicateShape(second)),
    );
  });

  it("the preview skips entries the destination already has", () => {
    const source = [
      baseEntry({ id: 1 }),
      baseEntry({
        id: 2,
        foodId: 11,
        foodName: "Banana",
        loggedAt: "2026-05-16T08:00:00.000Z",
        createdAt: "2026-05-16T08:00:00.000Z",
      }),
    ];
    const destination = [baseEntry({ id: 3, date: "2026-05-17" })];

    expect(getFoodLogCopyPreview(source, destination)).toEqual({
      sourceCount: 2,
      destinationCount: 1,
      copiedCount: 1,
      skippedDuplicates: 1,
    });
  });

  it("entries-to-copy preserves non-duplicate source order", () => {
    const duplicate = baseEntry({ id: 1 });
    const copyable = baseEntry({
      id: 2,
      foodId: 11,
      foodName: "Banana",
      loggedAt: "2026-05-16T08:00:00.000Z",
      createdAt: "2026-05-16T08:00:00.000Z",
    });
    const destination = [baseEntry({ id: 3, date: "2026-05-17" })];

    expect(getFoodLogEntriesToCopy([duplicate, copyable], destination)).toEqual([copyable]);
  });

  it("quick-add keys include the macro shape and the manual-energy flag", () => {
    // Two quick adds identical except for whether the user typed the calories
    // are different entries: one is a measurement, the other a derivation.
    const quickAdd = baseEntry({
      id: -1,
      foodId: null,
      entrySource: "quick_add",
      foodName: "Quick Add",
      quickAddName: "Coffee",
      quantityG: 1,
      servingSize: 1,
      servingUnit: "entry",
      calories: 90,
      proteinG: 0,
      carbsG: 12,
      fatG: 4,
      systemCalculatedCalories: 84,
      isEnergyManuallySet: true,
    });
    const differentEnergyMode = { ...quickAdd, id: -2, isEnergyManuallySet: false };

    expect(getFoodLogCopyPreview([quickAdd], [differentEnergyMode])).toEqual({
      sourceCount: 1,
      destinationCount: 1,
      copiedCount: 1,
      skippedDuplicates: 0,
    });
  });
});
