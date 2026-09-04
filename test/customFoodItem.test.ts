import { describe, expect, it } from "vitest";
import {
  buildCustomFoodItemInput,
  parseOptionalNutrient,
  type CustomFoodItemBuildResult,
  type CustomFoodItemDraft,
} from "../src/screens/Food/customFoodItem";
import type { SaveFoodItemInput } from "../src/store/DB_TYPES";

/**
 * Narrows a build result to its success case.
 *
 * The result is a union — `{ input }` or `{ error }` — and reading `.input`
 * through the union is what the untyped version of this file did silently. A
 * build that unexpectedly failed now says so here, naming the error, instead of
 * throwing "cannot read property of undefined" ten assertions later.
 */
const builtInput = (result: CustomFoodItemBuildResult): SaveFoodItemInput => {
  expect(result.error, "expected a valid draft to build").toBeUndefined();
  if (!result.input) throw new Error("unreachable: assertion above failed");
  return result.input;
};

const expectEqual = (actual: unknown, expected: unknown, message?: string) =>
  expect(actual, message).toEqual(expected);
const expectOk = (value: unknown, message?: string) =>
  expect(Boolean(value), message).toBe(true);
/**
 * The error a rejected draft produced.
 *
 * Undefined here means the build *succeeded* when the test expected it to fail
 * — a distinct failure from "the message was wrong", and worth saying so.
 */
const expectMatch = (value: string | undefined, pattern: RegExp) => {
  expect(value, "expected the draft to be rejected").toBeTypeOf("string");
  expect(value ?? "").toMatch(pattern);
};

const validDraft: CustomFoodItemDraft = {
  name: "Greek yogurt 2%",
  brand: "",
  barcode: null,
  basis: "100g",
  servingValue: "1",
  servingUnit: "serving",
  calories: 60,
  proteinG: 10,
  carbsG: 4,
  fatG: 2,
  fiber: "",
  sugar: "",
  saturatedFat: "",
  salt: "",
};

describe("custom food item", () => {
it("custom food build produces a per-100g catalog payload", () => {
  const result = buildCustomFoodItemInput({
    ...validDraft,
    brand: "  Fage  ",
    barcode: " 4770123456782 ",
  });

  const input = builtInput(result);
  expectEqual(input.source, "custom");
  expectEqual(input.sourceId, null);
  expectEqual(input.name, "Greek yogurt 2%");
  expectEqual(input.brand, "Fage");
  expectEqual(input.barcode, "4770123456782");
  expectEqual(input.nutritionBasis, "100g");
  expectEqual(input.servingSizeValue, 100);
  expectEqual(input.servingSizeUnit, "g");
  expectEqual(input.verified, false);
  expectEqual(input.isComplete, true);
  expectEqual(input.fiberG, null);
});

it("100ml basis stores a 100 ml serving", () => {
  const input = builtInput(buildCustomFoodItemInput({ ...validDraft, basis: "100ml" }));

  expectEqual(input.nutritionBasis, "100ml");
  expectEqual(input.servingSizeValue, 100);
  expectEqual(input.servingSizeUnit, "ml");
});

it("serving basis keeps the entered serving size and localized decimals", () => {
  const input = builtInput(
    buildCustomFoodItemInput({
      ...validDraft,
      basis: "serving",
      servingValue: "1,5",
      servingUnit: " piece ",
    }),
  );

  expectEqual(input.nutritionBasis, "serving");
  expectEqual(input.servingSizeValue, 1.5);
  expectEqual(input.servingSizeUnit, "piece");
});

it("serving basis falls back to a 'serving' unit and rejects bad sizes", () => {
  const fallback = builtInput(
    buildCustomFoodItemInput({ ...validDraft, basis: "serving", servingUnit: "   " }),
  );
  expectEqual(fallback.servingSizeUnit, "serving");

  const zero = buildCustomFoodItemInput({
    ...validDraft,
    basis: "serving",
    servingValue: "0",
  });
  expectEqual(zero.input, undefined);
  expectMatch(zero.error, /positive serving size/i);

  const junk = buildCustomFoodItemInput({
    ...validDraft,
    basis: "serving",
    servingValue: "abc",
  });
  expectMatch(junk.error, /positive serving size/i);
});

it("name, calories, and macro validation reject bad drafts", () => {
  expectMatch(
    buildCustomFoodItemInput({ ...validDraft, name: "   " }).error,
    /food name/i,
  );
  expectMatch(
    buildCustomFoodItemInput({ ...validDraft, calories: 0 }).error,
    /positive calories/i,
  );
  expectMatch(
    buildCustomFoodItemInput({ ...validDraft, calories: Number.NaN }).error,
    /positive calories/i,
  );
  expectMatch(
    buildCustomFoodItemInput({ ...validDraft, fatG: -1 }).error,
    /cannot be negative/i,
  );
});

it("zero macros are allowed when calories are positive", () => {
  const result = buildCustomFoodItemInput({
    ...validDraft,
    calories: 40,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });

  const input = builtInput(result);
  expectEqual(input.calories, 40);
});

it("optional nutrients parse to null, numbers, or a validation error", () => {
  expectEqual(parseOptionalNutrient(""), null);
  expectEqual(parseOptionalNutrient("  "), null);
  expectEqual(parseOptionalNutrient("1,5"), 1.5);
  expectOk(Number.isNaN(parseOptionalNutrient("-2")));
  expectOk(Number.isNaN(parseOptionalNutrient("abc")));

  const input = builtInput(buildCustomFoodItemInput({
    ...validDraft,
    fiber: "3",
    sugar: "4,5",
    saturatedFat: "",
    salt: "0",
  }));
  expectEqual(input.fiberG, 3);
  expectEqual(input.sugarG, 4.5);
  expectEqual(input.fatSaturatedG, null);
  expectEqual(input.saltG, 0);

  const invalid = buildCustomFoodItemInput({ ...validDraft, sugar: "-1" });
  expectMatch(invalid.error, /optional nutrients/i);
});

it("blank barcode and brand normalize to null", () => {
  const input = builtInput(buildCustomFoodItemInput({
    ...validDraft,
    barcode: "   ",
    brand: "  ",
  }));

  expectEqual(input.barcode, null);
  expectEqual(input.brand, null);
});

it("barcode input keeps digits only and validates the check digit", () => {
  const formatted = builtInput(
    buildCustomFoodItemInput({ ...validDraft, barcode: "477-0123-45678-2" }),
  );
  expectEqual(formatted.barcode, "4770123456782");

  const upcA = builtInput(
    buildCustomFoodItemInput({ ...validDraft, barcode: "737628064502" }),
  );
  expectEqual(upcA.barcode, "737628064502");

  const badCheckDigit = buildCustomFoodItemInput({
    ...validDraft,
    barcode: "4770123456789",
  });
  expectEqual(badCheckDigit.input, undefined);
  expectMatch(badCheckDigit.error, /valid EAN, UPC, or GTIN/i);

  const tooShort = buildCustomFoodItemInput({ ...validDraft, barcode: "123" });
  expectMatch(tooShort.error, /valid EAN, UPC, or GTIN/i);
});
});
