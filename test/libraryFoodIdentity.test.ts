import { describe, expect, it } from "vitest";
import {
  getCustomMealEditorId,
  getLibraryFoodIdentity,
} from "../src/domain/libraryFoodIdentity";

describe("library editor identity", () => {
  it("recognizes an API custom meal without legacy source metadata", () => {
    expect(
      getLibraryFoodIdentity({
        localId: -1000000042,
        source: "recipe",
        sourceId: null,
      }),
    ).toMatchObject({ kind: "custom_meal", id: 42 });
  });
  it("uses the same synthetic identity in search and the user's library", () => {
    expect(
      getLibraryFoodIdentity({ id: -31, source: "recipe", sourceId: null }),
    ).toMatchObject({ kind: "custom_recipe", id: 31 });
  });
  it("retains legacy meal and recipe identifiers", () => {
    expect(
      getLibraryFoodIdentity({ source: "recipe", sourceId: "meal:9" }),
    ).toEqual({ kind: "custom_meal", id: 9 });
    expect(
      getLibraryFoodIdentity({
        source: "recipe",
        rawPayload: '{"recipeId":8}',
      }),
    ).toEqual({ kind: "custom_recipe", id: 8 });
  });
  it("never turns absent, zero, or invalid identifiers into editor requests", () => {
    for (const sourceId of [null, "", "0", "-2", "NaN", "1.5", "meal:"]) {
      expect(getLibraryFoodIdentity({ source: "recipe", sourceId })).toBeNull();
    }
    expect(
      getLibraryFoodIdentity({ id: 42, source: "usda", sourceId: "42" }),
    ).toBeNull();
  });
});

it("keeps custom-meal editor ids synthetic so meal 1 cannot open catalogue food 1", () => {
  expect(getCustomMealEditorId({ id: -1000000001, source: "recipe" })).toBe(
    -1000000001,
  );
  expect(getCustomMealEditorId({ source: "recipe", sourceId: "meal:1" })).toBe(
    -1000000001,
  );
  expect(getCustomMealEditorId({ id: -1, source: "recipe" })).toBeNull();
});
