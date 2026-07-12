require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const { openFoodsAPI } = require("../src/API/OpenFoods/openFoodsEndpoints.ts");

test("OFF per-serving normalization uses serving quantity, not package quantity", () => {
  const normalized = openFoodsAPI.toFoodItemInput({
    code: "123",
    product: {
      code: "123",
      product_name: "Test bar",
      product_quantity: 300,
      product_quantity_unit: "g",
      serving_quantity: 30,
      serving_quantity_unit: "g",
      nutrition_data_per: "serving",
      nutriments: {
        "energy-kcal_serving": 120,
        proteins_serving: 3,
        carbohydrates_serving: 15,
        fat_serving: 5,
      },
    },
  });

  assert.equal(normalized.servingSizeValue, 30);
  assert.equal(normalized.servingSizeUnit, "g");
  assert.equal(normalized.calories, 120);
});

test("OFF unknown serving weight falls back to one serving without borrowing per-100g values", () => {
  const normalized = openFoodsAPI.toFoodItemInput({
    product: {
      product_name: "Unknown portion",
      product_quantity: 500,
      product_quantity_unit: "g",
      nutrition_data_per: "serving",
      nutriments: { "energy-kcal_100g": 250 },
    },
  });

  assert.equal(normalized.servingSizeValue, 1);
  assert.equal(normalized.servingSizeUnit, "serving");
  assert.equal(normalized.calories, 0);
});
