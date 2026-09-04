import { describe, expect, it } from "vitest";
import {
  buildFoodLoggedAt,
  formatFoodDateKey,
  parseFoodDateKey,
  resolveEntryMealSlot,
} from "../src/screens/Food/foodUtils";

describe("food date keys and meal slots", () => {
  it("date keys round-trip in local time", () => {
    const key = "2026-03-29";
    expect(formatFoodDateKey(parseFoodDateKey(key))).toBe(key);

    const loggedAt = new Date(buildFoodLoggedAt(key, 7, 45));
    expect(formatFoodDateKey(loggedAt)).toBe(key);
    expect(loggedAt.getHours()).toBe(7);
    expect(loggedAt.getMinutes()).toBe(45);
  });

  it("meal-slot resolution prefers the label and falls back to logged time", () => {
    expect(
      resolveEntryMealSlot({
        mealType: "Lunch",
        loggedAt: buildFoodLoggedAt("2026-07-10", 7),
        createdAt: buildFoodLoggedAt("2026-07-10", 7),
      }),
    ).toBe("lunch");

    expect(
      resolveEntryMealSlot({
        mealType: null,
        loggedAt: buildFoodLoggedAt("2026-07-10", 19),
        createdAt: buildFoodLoggedAt("2026-07-10", 7),
      }),
    ).toBe("dinner");
  });
});
