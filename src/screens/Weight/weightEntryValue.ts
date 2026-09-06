import {
  displayNumberToWeightKg,
  formatWeightValue,
  type WeightUnit,
} from "../../preferences/displayPreferences";
import { parseLocalizedWeight } from "./weightUtils";

/** Display rounding must not change the measurement when only notes or time change. */
export const resolveWeightEntryValueKg = (
  input: string,
  unit: WeightUnit,
  initialValueKg?: number,
): number | null => {
  const parsed = parseLocalizedWeight(input);
  if (parsed == null) return null;
  if (
    initialValueKg != null &&
    input === formatWeightValue(initialValueKg, unit)
  ) {
    return initialValueKg;
  }
  return displayNumberToWeightKg(parsed, unit);
};
