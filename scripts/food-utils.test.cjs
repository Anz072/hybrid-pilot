require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  buildFoodLoggedAt,
  formatFoodDateKey,
  parseFoodDateKey,
  resolveEntryMealSlot,
} = require("../src/screens/Food/foodUtils.ts");

test("food date keys round-trip in local time", () => {
  const key = "2026-03-29";
  assert.equal(formatFoodDateKey(parseFoodDateKey(key)), key);

  const loggedAt = new Date(buildFoodLoggedAt(key, 7, 45));
  assert.equal(formatFoodDateKey(loggedAt), key);
  assert.equal(loggedAt.getHours(), 7);
  assert.equal(loggedAt.getMinutes(), 45);
});

test("meal-slot resolution prefers labels and falls back to logged time", () => {
  assert.equal(
    resolveEntryMealSlot({
      mealType: "Lunch",
      loggedAt: buildFoodLoggedAt("2026-07-10", 7),
      createdAt: buildFoodLoggedAt("2026-07-10", 7),
    }),
    "lunch",
  );
  assert.equal(
    resolveEntryMealSlot({
      mealType: null,
      loggedAt: buildFoodLoggedAt("2026-07-10", 19),
      createdAt: buildFoodLoggedAt("2026-07-10", 7),
    }),
    "dinner",
  );
});
