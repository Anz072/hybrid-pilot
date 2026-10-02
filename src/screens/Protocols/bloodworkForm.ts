import type { BloodworkResultInput } from "../../API/nouri/bloodworkTypes";

/** Native decimal keyboards may use a comma. Preserve precision and trailing
 * zeros; no Number conversion, inequality coercion or client unit engine.
 */
export function labDecimal(text: string): string {
  const value = text.trim().replace(",", ".").replace(/^\./,"0.");
  if (!/^(?:0|[1-9]\d{0,29})(?:\.\d{1,12})?$/.test(value)) throw new Error("Enter a non-negative decimal, with up to 12 decimal places.");
  return value;
}
export function labResult(input: { biomarkerId: string; value: string; unit: string; low: string; high: string; referenceUnit: string }): BloodworkResultInput {
  const referenceLow = input.low.trim() ? labDecimal(input.low) : null;
  const referenceHigh = input.high.trim() ? labDecimal(input.high) : null;
  return { biomarkerId: input.biomarkerId,rawValue: labDecimal(input.value),rawUnit: input.unit,
    referenceLow,referenceHigh,referenceUnit: referenceLow !== null || referenceHigh !== null ? input.referenceUnit : null };
}
export function labRange(low: string | null, high: string | null, unit: string): string {
  return low !== null && high !== null ? `${low} – ${high} ${unit}` : low !== null ? `≥ ${low} ${unit}` : high !== null ? `≤ ${high} ${unit}` : "Not entered";
}
