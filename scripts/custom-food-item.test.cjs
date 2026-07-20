require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildCustomFoodItemInput,
  parseOptionalNutrient,
} = require("../src/screens/Food/customFoodItem.ts");

const validDraft = {
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

test("custom food build produces a per-100g catalog payload", () => {
  const result = buildCustomFoodItemInput({
    ...validDraft,
    brand: "  Fage  ",
    barcode: " 4770123456782 ",
  });

  assert.equal(result.error, undefined);
  assert.equal(result.input.source, "custom");
  assert.equal(result.input.sourceId, null);
  assert.equal(result.input.name, "Greek yogurt 2%");
  assert.equal(result.input.brand, "Fage");
  assert.equal(result.input.barcode, "4770123456782");
  assert.equal(result.input.nutritionBasis, "100g");
  assert.equal(result.input.servingSizeValue, 100);
  assert.equal(result.input.servingSizeUnit, "g");
  assert.equal(result.input.verified, false);
  assert.equal(result.input.isComplete, true);
  assert.equal(result.input.fiberG, null);
});

test("100ml basis stores a 100 ml serving", () => {
  const result = buildCustomFoodItemInput({ ...validDraft, basis: "100ml" });

  assert.equal(result.input.nutritionBasis, "100ml");
  assert.equal(result.input.servingSizeValue, 100);
  assert.equal(result.input.servingSizeUnit, "ml");
});

test("serving basis keeps the entered serving size and localized decimals", () => {
  const result = buildCustomFoodItemInput({
    ...validDraft,
    basis: "serving",
    servingValue: "1,5",
    servingUnit: " piece ",
  });

  assert.equal(result.input.nutritionBasis, "serving");
  assert.equal(result.input.servingSizeValue, 1.5);
  assert.equal(result.input.servingSizeUnit, "piece");
});

test("serving basis falls back to a 'serving' unit and rejects bad sizes", () => {
  const fallback = buildCustomFoodItemInput({
    ...validDraft,
    basis: "serving",
    servingUnit: "   ",
  });
  assert.equal(fallback.input.servingSizeUnit, "serving");

  const zero = buildCustomFoodItemInput({
    ...validDraft,
    basis: "serving",
    servingValue: "0",
  });
  assert.equal(zero.input, undefined);
  assert.match(zero.error, /positive serving size/i);

  const junk = buildCustomFoodItemInput({
    ...validDraft,
    basis: "serving",
    servingValue: "abc",
  });
  assert.match(junk.error, /positive serving size/i);
});

test("name, calories, and macro validation reject bad drafts", () => {
  assert.match(
    buildCustomFoodItemInput({ ...validDraft, name: "   " }).error,
    /food name/i,
  );
  assert.match(
    buildCustomFoodItemInput({ ...validDraft, calories: 0 }).error,
    /positive calories/i,
  );
  assert.match(
    buildCustomFoodItemInput({ ...validDraft, calories: Number.NaN }).error,
    /positive calories/i,
  );
  assert.match(
    buildCustomFoodItemInput({ ...validDraft, fatG: -1 }).error,
    /cannot be negative/i,
  );
});

test("zero macros are allowed when calories are positive", () => {
  const result = buildCustomFoodItemInput({
    ...validDraft,
    calories: 40,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.input.calories, 40);
});

test("optional nutrients parse to null, numbers, or a validation error", () => {
  assert.equal(parseOptionalNutrient(""), null);
  assert.equal(parseOptionalNutrient("  "), null);
  assert.equal(parseOptionalNutrient("1,5"), 1.5);
  assert.ok(Number.isNaN(parseOptionalNutrient("-2")));
  assert.ok(Number.isNaN(parseOptionalNutrient("abc")));

  const result = buildCustomFoodItemInput({
    ...validDraft,
    fiber: "3",
    sugar: "4,5",
    saturatedFat: "",
    salt: "0",
  });
  assert.equal(result.input.fiberG, 3);
  assert.equal(result.input.sugarG, 4.5);
  assert.equal(result.input.fatSaturatedG, null);
  assert.equal(result.input.saltG, 0);

  const invalid = buildCustomFoodItemInput({ ...validDraft, sugar: "-1" });
  assert.match(invalid.error, /optional nutrients/i);
});

test("blank barcode and brand normalize to null", () => {
  const result = buildCustomFoodItemInput({
    ...validDraft,
    barcode: "   ",
    brand: "  ",
  });

  assert.equal(result.input.barcode, null);
  assert.equal(result.input.brand, null);
});

test("barcode input keeps digits only and validates the check digit", () => {
  const formatted = buildCustomFoodItemInput({
    ...validDraft,
    barcode: "477-0123-45678-2",
  });
  assert.equal(formatted.error, undefined);
  assert.equal(formatted.input.barcode, "4770123456782");

  const upcA = buildCustomFoodItemInput({
    ...validDraft,
    barcode: "737628064502",
  });
  assert.equal(upcA.error, undefined);
  assert.equal(upcA.input.barcode, "737628064502");

  const badCheckDigit = buildCustomFoodItemInput({
    ...validDraft,
    barcode: "4770123456789",
  });
  assert.equal(badCheckDigit.input, undefined);
  assert.match(badCheckDigit.error, /valid EAN, UPC, or GTIN/i);

  const tooShort = buildCustomFoodItemInput({ ...validDraft, barcode: "123" });
  assert.match(tooShort.error, /valid EAN, UPC, or GTIN/i);
});
