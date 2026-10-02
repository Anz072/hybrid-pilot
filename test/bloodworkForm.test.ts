import { describe, expect, it } from "vitest";
import { labDecimal, labRange, labResult } from "../src/screens/Protocols/bloodworkForm";

describe("bloodwork entry preserves what the laboratory reported", () => {
  it("accepts decimal keyboard separators and preserves precision without floating-point conversion", () => {
    expect(labDecimal(" 530,000000000001 ")).toBe("530.000000000001");
    expect(labDecimal(",50")).toBe("0.50");
    expect(labDecimal("999999999999999999999999999999.123456789012")).toBe("999999999999999999999999999999.123456789012");
    for (const invalid of ["<5", "1,000.5", "NaN", "-1", "1e3", "0.1234567890123", ""]) expect(() => labDecimal(invalid)).toThrow();
  });
  it("keeps zero and one-sided bounds distinct from an absent reference range", () => {
    const input = { biomarkerId: "marker", value: "0.00", unit: "mg/dL", low: "0", high: " ", referenceUnit: "mg/dL" };
    expect(labResult(input)).toEqual({ biomarkerId: "marker", rawValue: "0.00", rawUnit: "mg/dL", referenceLow: "0", referenceHigh: null, referenceUnit: "mg/dL" });
    expect(labResult({ ...input, low: "" })).toMatchObject({ referenceLow: null, referenceHigh: null, referenceUnit: null });
    expect(labRange("0", null, "mg/dL")).toBe("≥ 0 mg/dL");
    expect(labRange(null, "0", "mg/dL")).toBe("≤ 0 mg/dL");
    expect(labRange(null, null, "mg/dL")).toBe("Not entered");
  });
});
