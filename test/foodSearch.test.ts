import { describe, expect, it, vi } from "vitest";
import { toDbFoodItem, type ApiFood } from "../src/API/nouri/foodsApi";
import { fromDbFoodItem, searchFoodResults } from "../src/screens/Food/foodSearch";

vi.mock("../src/API/nouri/client", () => ({ apiRequest: vi.fn() }));

const externalFood: ApiFood = {
  id: null,
  ref: "usda:173944",
  name: "Bananas, raw",
  brand: null,
  barcode: null,
  imageUrl: null,
  source: "usda",
  providerLabel: "USDA",
  nutritionBasis: "100g",
  servingSizeValue: 100,
  servingSizeUnit: "g",
  quantityValue: null,
  quantityUnit: null,
  calories: 89,
  proteinG: 1.09,
  carbsG: 22.84,
  fatG: 0.33,
  alcoholG: null,
  verified: true,
  isComplete: true,
  isOwn: false,
};

describe("API food search identities", () => {
  it("keeps an external result unsaved so logging creates its catalogue entry first", async () => {
    const results = await searchFoodResults({
      query: "banana",
      getLocalRows: async () => [toDbFoodItem(externalFood)],
      includeLocalFood: true,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: "usda",
      sourceId: "173944",
      localId: null,
      localFood: null,
      key: "usda:173944:remote",
    });
  });

  it.each([42, -31, -1000000009])("preserves stored catalogue and library id %s", (id) => {
    const food = toDbFoodItem({ ...externalFood, id, ref: String(id) });
    expect(fromDbFoodItem(food, true)).toMatchObject({ localId: id, localFood: food });
    expect(fromDbFoodItem(food).localFood).toBeNull();
  });
});
