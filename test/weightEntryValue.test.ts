import { describe, expect, it, vi } from "vitest";
vi.mock("../src/storage/kv", () => ({
  readJsonKv: vi.fn(),
  writeJsonKv: vi.fn(),
}));
import { resolveWeightEntryValueKg } from "../src/screens/Weight/weightEntryValue";

describe("weight entry display precision", () => {
  it("keeps the stored measurement when a kg editor only changes notes or time", () => {
    expect(resolveWeightEntryValueKg("81.14", "kg", 81.143)).toBe(81.143);
  });
  it("keeps the stored measurement when the rounded pounds display is unchanged", () => {
    expect(resolveWeightEntryValueKg("178.89", "lb", 81.143)).toBe(81.143);
  });
  it("converts an intentional numeric edit, including a decimal comma", () => {
    expect(resolveWeightEntryValueKg("82,5", "kg", 81.143)).toBe(82.5);
    expect(resolveWeightEntryValueKg("180", "lb", 81.143)).toBeCloseTo(
      81.6466266,
      6,
    );
  });
  it("rejects an empty or non-finite draft", () => {
    for (const input of ["", " ", "not a number", "Infinity"]) {
      expect(resolveWeightEntryValueKg(input, "kg", 81.143)).toBeNull();
    }
  });
});
