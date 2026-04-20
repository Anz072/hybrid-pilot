import type { ProteinFocus } from "../navigation/onboardingTypes";

export const DEFAULT_PROTEIN_FOCUS: ProteinFocus = "focused";

export const PROTEIN_FOCUS_MULTIPLIER: Record<ProteinFocus, number> = {
  mild: 1.3,
  moderate: 1.6,
  focused: 2,
  heavy: 2.6,
};

export const PROTEIN_FOCUS_OPTIONS: Array<{
  description: string;
  gramsPerKg: number;
  label: string;
  value: ProteinFocus;
}> = [
  {
    label: "Mild",
    value: "mild",
    gramsPerKg: 1.3,
    description: "A lighter protein target that leaves more room for carbs and fats.",
  },
  {
    label: "Moderate",
    value: "moderate",
    gramsPerKg: 1.6,
    description: "A balanced middle ground for recovery and everyday consistency.",
  },
  {
    label: "Focused",
    value: "focused",
    gramsPerKg: 2,
    description: "A higher-protein default for muscle retention and body-composition focus.",
  },
  {
    label: "Heavy",
    value: "heavy",
    gramsPerKg: 2.6,
    description: "A very high protein bias for aggressive retention and satiety priorities.",
  },
];

export const isProteinFocus = (value: string | null | undefined): value is ProteinFocus =>
  PROTEIN_FOCUS_OPTIONS.some((option) => option.value === value);

export const resolveProteinFocus = (
  value: string | null | undefined,
): ProteinFocus => (isProteinFocus(value) ? value : DEFAULT_PROTEIN_FOCUS);

export const getProteinFocusOption = (
  value: string | null | undefined,
) => {
  const resolved = resolveProteinFocus(value);
  return (
    PROTEIN_FOCUS_OPTIONS.find((option) => option.value === resolved) ??
    PROTEIN_FOCUS_OPTIONS[2]
  );
};

export const formatProteinFocusLabel = (
  value: string | null | undefined,
): string => getProteinFocusOption(value).label;

export const formatProteinFocusSummary = (
  value: string | null | undefined,
): string => {
  const option = getProteinFocusOption(value);
  return `${option.label} (${option.gramsPerKg} g/kg)`;
};
