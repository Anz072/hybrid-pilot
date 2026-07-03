import type {
  DBUser,
  DBUserFoodLogEntry,
  DBUserSettings,
  DBWeightEntry,
  WeightEntryGoal,
} from "../../store/DB_TYPES";
import { calculateLoggedNutrition } from "../Food/foodUtils";

export const BACKUP_FORMAT = "dribsnis.backup";
export const BACKUP_VERSION = 1;

export type DribsnisBackup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  user: DBUser | null;
  settings: DBUserSettings | null;
  weightGoal: WeightEntryGoal | null;
  weights: DBWeightEntry[];
  foodLog: DBUserFoodLogEntry[];
};

const csvCell = (value: unknown): string => {
  if (value == null) {
    return "";
  }
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const toCsv = (headers: string[], rows: unknown[][]): string =>
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");

export const buildWeightsCsv = (entries: DBWeightEntry[]): string =>
  toCsv(
    ["measured_at_local", "value_kg", "source", "notes"],
    entries.map((entry) => [
      entry.measuredAtLocalIso,
      entry.valueKg,
      entry.source,
      entry.notes ?? "",
    ]),
  );

export const buildFoodLogCsv = (entries: DBUserFoodLogEntry[]): string =>
  toCsv(
    [
      "date",
      "logged_at",
      "meal",
      "name",
      "source",
      "quantity_g",
      "calories",
      "protein_g",
      "carbs_g",
      "fat_g",
    ],
    entries.map((entry) => {
      const nutrition = calculateLoggedNutrition(entry);
      return [
        entry.date,
        entry.loggedAt ?? entry.createdAt,
        entry.mealType ?? "",
        entry.foodName,
        entry.entrySource,
        entry.entrySource === "quick_add" ? "" : entry.quantityG,
        nutrition.calories,
        nutrition.proteinG,
        nutrition.carbsG,
        nutrition.fatG,
      ];
    }),
  );

export const buildBackup = (input: {
  user: DBUser | null;
  settings: DBUserSettings | null;
  weightGoal: WeightEntryGoal | null;
  weights: DBWeightEntry[];
  foodLog: DBUserFoodLogEntry[];
  exportedAt: string;
}): DribsnisBackup => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: input.exportedAt,
  user: input.user,
  settings: input.settings,
  weightGoal: input.weightGoal,
  weights: input.weights,
  foodLog: input.foodLog,
});

export const serializeBackup = (backup: DribsnisBackup): string =>
  JSON.stringify(backup, null, 2);

export type ParsedBackup =
  | { ok: true; backup: DribsnisBackup }
  | { ok: false; error: string };

export const parseBackup = (raw: string): ParsedBackup => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "That is not valid JSON." };
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { format?: unknown }).format !== BACKUP_FORMAT
  ) {
    return {
      ok: false,
      error: "This does not look like a Dribsnis backup file.",
    };
  }

  const candidate = parsed as Partial<DribsnisBackup>;
  return {
    ok: true,
    backup: {
      format: BACKUP_FORMAT,
      version: typeof candidate.version === "number" ? candidate.version : 1,
      exportedAt:
        typeof candidate.exportedAt === "string" ? candidate.exportedAt : "",
      user: candidate.user ?? null,
      settings: candidate.settings ?? null,
      weightGoal: candidate.weightGoal ?? null,
      weights: Array.isArray(candidate.weights) ? candidate.weights : [],
      foodLog: Array.isArray(candidate.foodLog) ? candidate.foodLog : [],
    },
  };
};
