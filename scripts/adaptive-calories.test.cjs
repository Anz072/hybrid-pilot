require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const { buildAdaptiveWindow } = require("../src/engine/adaptiveCalories.ts");

test("adaptive intake uses quantity-scaled logged calories", () => {
  const date = "2026-07-09";
  const summary = buildAdaptiveWindow({
    asOf: new Date("2026-07-10T12:00:00"),
    windowDays: 7,
    diaryDays: [
      {
        userExternalId: "user-1",
        date,
        isComplete: true,
        completedAt: `${date}T20:00:00.000Z`,
        createdAt: `${date}T20:00:00.000Z`,
        updatedAt: `${date}T20:00:00.000Z`,
      },
    ],
    entries: [
      {
        date,
        entrySource: "food_item",
        quantityG: 250,
        servingSize: 100,
        calories: 200,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
      },
    ],
    weightEntries: [],
  });

  assert.equal(summary.avgLoggedCalories, 500);
  assert.equal(summary.totalEntriesUsed, 1);
});
