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

export type NouriBackup = {
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
}): NouriBackup => ({
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  exportedAt: input.exportedAt,
  user: input.user,
  settings: input.settings,
  weightGoal: input.weightGoal,
  weights: input.weights,
  foodLog: input.foodLog,
});

export const serializeBackup = (backup: NouriBackup): string =>
  JSON.stringify(backup, null, 2);

export type ParsedBackup =
  { ok: true; backup: NouriBackup } | { ok: false; error: string };

export const parseBackup = (raw: string): ParsedBackup => {
  if (raw.length > 10 * 1024 * 1024) {
    return { ok: false, error: "Choose a backup smaller than 10 MB." };
  }
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
      error: "This does not look like a Nouri backup file.",
    };
  }

  const candidate = parsed as Partial<NouriBackup>;
  if (candidate.version != null && candidate.version !== BACKUP_VERSION) {
    return { ok: false, error: "This backup version is not supported." };
  }
  const validDate = (value: unknown) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value));
  const weights = Array.isArray(candidate.weights) ? candidate.weights : [];
  if (
    weights.some(
      (entry) =>
        !entry ||
        typeof entry !== "object" ||
        typeof entry.id !== "string" ||
        !entry.id.trim() ||
        !Number.isFinite(entry.valueKg) ||
        entry.valueKg <= 0 ||
        !validDate(entry.measuredAt) ||
        !validDate(entry.measuredAtLocalIso) ||
        (entry.notes != null && typeof entry.notes !== "string") ||
        (entry.zoneOffsetMinutes != null &&
          (!Number.isInteger(entry.zoneOffsetMinutes) ||
            Math.abs(entry.zoneOffsetMinutes) > 840)),
    )
  ) {
    return {
      ok: false,
      error:
        "The backup contains an invalid weight entry. Nothing has been restored.",
    };
  }
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
      weights,
      foodLog: Array.isArray(candidate.foodLog) ? candidate.foodLog : [],
    },
  };
};

/** Keep full-history exports within the diary API's inclusive 400-day limit. */
export const loadFoodLogForExport = async (
  readRange: (start: string, end: string) => Promise<DBUserFoodLogEntry[]>,
  startDate: string,
  endDate: string,
): Promise<DBUserFoodLogEntry[]> => {
  const dayMs = 86_400_000;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end)
    throw new Error("Invalid export date range.");
  const windows: [string, string][] = [];
  const dateKey = (time: number) => new Date(time).toISOString().slice(0, 10);
  for (let cursor = start; cursor <= end; cursor += 400 * dayMs) {
    windows.push([
      dateKey(cursor),
      dateKey(Math.min(end, cursor + 399 * dayMs)),
    ]);
  }
  const entries: DBUserFoodLogEntry[] = [];
  // Bound concurrency; a failed window aborts export instead of sharing partial history.
  for (let index = 0; index < windows.length; index += 4) {
    const batch = await Promise.all(
      windows.slice(index, index + 4).map(([from, to]) => readRange(from, to)),
    );
    entries.push(...batch.flat());
  }
  return entries;
};
