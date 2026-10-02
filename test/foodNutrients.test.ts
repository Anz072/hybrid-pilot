import { beforeEach, describe, expect, it, vi } from "vitest";
import { toDbFoodItem, type ApiFood } from "../src/API/nouri/foodsApi";
import { MICRONUTRIENT_TARGETS } from "../src/engine/micronutrients";
import { fromDbFoodItem } from "../src/screens/Food/foodSearch";
import { getFoodQuantityFactor } from "../src/screens/Food/foodUtils";
import { saveFoodItem, getFoodItemsByIds } from "../src/store/libraryStore";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("../src/API/nouri/client", () => ({ apiRequest }));

const apiFood: ApiFood = {
  id: null, ref: "usda:999", name: "Kiwi nutrient fixture", brand: null,
  barcode: null, imageUrl: null, source: "usda", providerLabel: "USDA",
  nutritionBasis: "100g", servingSizeValue: 100, servingSizeUnit: "g",
  quantityValue: null, quantityUnit: null, calories: 64, proteinG: 1.1,
  carbsG: 14, fatG: 0.4, alcoholG: null, verified: false, isComplete: false, isOwn: false,
  vitaminCMg: 92.7, vitaminDUg: 0, potassiumMg: 312, seleniumUg: 0.2,
  vitaminB12Ug: null, fiberG: 3,
};

beforeEach(() => apiRequest.mockReset());

describe("food micronutrient transport", () => {
  it("carries search nutrients into the save request and back into diary hydration", async () => {
    const result = fromDbFoodItem(toDbFoodItem(apiFood));
    expect(result).toMatchObject({ vitaminCMg: 92.7, vitaminDUg: 0, seleniumUg: 0.2 });
    apiRequest.mockResolvedValueOnce({ ...apiFood, id: 42, ref: "42" });
    expect(await saveFoodItem(result)).toBe(42);
    expect(apiRequest).toHaveBeenCalledWith("/v1/foods", {
      method: "POST",
      body: expect.objectContaining({ sourceId: "999", vitaminCMg: 92.7,
        vitaminDUg: 0, potassiumMg: 312, seleniumUg: 0.2, vitaminB12Ug: null, fiberG: 3 }),
    });

    apiRequest.mockResolvedValueOnce({ foods: [{ ...apiFood, id: 42, ref: "42" }] });
    const [food] = await getFoodItemsByIds([42]);
    const factor = getFoodQuantityFactor(food, 50);
    expect(food.vitaminCMg! * factor).toBeCloseTo(46.35);
    expect(food.potassiumMg! * factor).toBe(156);
    expect(food.vitaminDUg).toBe(0);
    expect(food.vitaminB12Ug).toBeNull();
  });

  it("preserves every displayed micronutrient and makes older API omissions explicitly unknown", () => {
    for (const key of Object.keys(MICRONUTRIENT_TARGETS.generic)) {
      expect(toDbFoodItem({ ...apiFood, [key]: 1.25 })).toHaveProperty(key, 1.25);
      expect(toDbFoodItem({ ...apiFood, [key]: undefined })).toHaveProperty(key, null);
    }
  });

  it("retains the nutrition basis when scaling per-serving micronutrients", () => {
    const food = toDbFoodItem({ ...apiFood, nutritionBasis: "serving",
      servingSizeValue: 25, servingSizeUnit: "g", vitaminCMg: 20 });
    expect(food.vitaminCMg! * getFoodQuantityFactor(food, 50)).toBe(40);
  });
});
