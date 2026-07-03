import { getDb, initDb } from "../storage/sqlite";

// Display-only preferences. These control how values are shown/entered, not how
// they are stored: weights are always persisted in kg, heights in cm, times in
// ISO. Conversion happens at the display/entry edge via the helpers below.

export type WeightUnit = "kg" | "lb";
export type HeightUnit = "cm" | "ft_in";
export type TimeFormat = "24h" | "12h";

export type DisplayPreferences = {
  weightUnit: WeightUnit;
  heightUnit: HeightUnit;
  timeFormat: TimeFormat;
};

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  weightUnit: "kg",
  heightUnit: "cm",
  timeFormat: "24h",
};

const STORAGE_KEY = "displayPreferences";
const KG_PER_LB = 0.45359237;
const LB_PER_KG = 1 / KG_PER_LB;
const CM_PER_INCH = 2.54;

// Synchronous snapshot so pure formatters can be used in any render path without
// awaiting storage. Hydrated once at startup by loadDisplayPreferences().
let currentPreferences: DisplayPreferences = { ...DEFAULT_DISPLAY_PREFERENCES };
let hydrated = false;

type Listener = (preferences: DisplayPreferences) => void;
const listeners = new Set<Listener>();

const normalize = (value: unknown): DisplayPreferences => {
  const source = (value ?? {}) as Partial<DisplayPreferences>;
  return {
    weightUnit: source.weightUnit === "lb" ? "lb" : "kg",
    heightUnit: source.heightUnit === "ft_in" ? "ft_in" : "cm",
    timeFormat: source.timeFormat === "12h" ? "12h" : "24h",
  };
};

const notify = () => {
  for (const listener of listeners) {
    listener(currentPreferences);
  }
};

export const getDisplayPreferencesSnapshot = (): DisplayPreferences =>
  currentPreferences;

export const isDisplayPreferencesHydrated = (): boolean => hydrated;

export const subscribeToDisplayPreferences = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const loadDisplayPreferences = async (): Promise<DisplayPreferences> => {
  try {
    await initDb();
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM app_kv WHERE key = ? LIMIT 1`,
      STORAGE_KEY,
    );

    if (row?.value) {
      currentPreferences = normalize(JSON.parse(row.value));
    }
  } catch {
    currentPreferences = { ...DEFAULT_DISPLAY_PREFERENCES };
  } finally {
    hydrated = true;
    notify();
  }

  return currentPreferences;
};

export const saveDisplayPreferences = async (
  patch: Partial<DisplayPreferences>,
): Promise<DisplayPreferences> => {
  currentPreferences = normalize({ ...currentPreferences, ...patch });
  notify();

  try {
    await initDb();
    const db = await getDb();
    await db.runAsync(
      `
      INSERT INTO app_kv (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
      STORAGE_KEY,
      JSON.stringify(currentPreferences),
    );
  } catch {
    // Best-effort persistence; the in-memory snapshot still reflects the choice.
  }

  return currentPreferences;
};

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export const weightUnitLabel = (
  unit: WeightUnit = currentPreferences.weightUnit,
): string => (unit === "lb" ? "lb" : "kg");

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

// Value only (no unit suffix), in the user's preferred unit.
export const formatWeightValue = (
  valueKg: number,
  unit: WeightUnit = currentPreferences.weightUnit,
): string => {
  const value = unit === "lb" ? kgToLb(valueKg) : valueKg;
  const trimmed = value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return trimmed.includes(".") ? trimmed : `${trimmed}.0`;
};

// Value + unit suffix, e.g. "80.5 kg" or "177.5 lb".
export const formatWeight = (
  valueKg: number,
  unit: WeightUnit = currentPreferences.weightUnit,
): string => `${formatWeightValue(valueKg, unit)} ${weightUnitLabel(unit)}`;

// Number in the display unit, used to seed editable inputs.
export const weightKgToDisplayNumber = (
  valueKg: number,
  unit: WeightUnit = currentPreferences.weightUnit,
): number => (unit === "lb" ? kgToLb(valueKg) : valueKg);

// Convert an entered display-unit number back to kg for storage.
export const displayNumberToWeightKg = (
  displayValue: number,
  unit: WeightUnit = currentPreferences.weightUnit,
): number => (unit === "lb" ? lbToKg(displayValue) : displayValue);

// ---------------------------------------------------------------------------
// Height
// ---------------------------------------------------------------------------

export const cmToFeetInches = (
  cm: number,
): { feet: number; inches: number } => {
  const totalInches = cm / CM_PER_INCH;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
};

export const feetInchesToCm = (feet: number, inches: number): number =>
  (feet * 12 + inches) * CM_PER_INCH;

export const formatHeight = (
  cm: number,
  unit: HeightUnit = currentPreferences.heightUnit,
): string => {
  if (unit === "ft_in") {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}'${inches}"`;
  }
  return `${Math.round(cm)} cm`;
};

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

export const formatTimeOfDay = (
  iso: string | number | Date,
  timeFormat: TimeFormat = currentPreferences.timeFormat,
): string =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: timeFormat === "12h" ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  });
