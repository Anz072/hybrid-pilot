import type {
  DBWeightEntry,
  WeightEntryGoal,
  WeightEntrySource,
} from "../../store/DB_TYPES";

export type WeightRangeKey = "1W" | "1M" | "3M" | "1Y";
export type WeightTimeOfDay = "all" | "morning" | "afternoon" | "evening" | "night";

export const WEIGHT_RANGE_LABELS: WeightRangeKey[] = ["1W", "1M", "3M", "1Y"];
export const DEFAULT_GOAL_BAND_KG = 0.3;
export const WEIGHT_SOURCE_OPTIONS: Array<WeightEntrySource | "all"> = [
  "all",
  "manual",
  "import",
  "smart_scale",
  "healthkit",
  "health_connect",
  "google_fit",
  "csv",
];
export const TIME_OF_DAY_OPTIONS: WeightTimeOfDay[] = [
  "all",
  "morning",
  "afternoon",
  "evening",
  "night",
];
export const PRESET_TAGS = ["morning", "fasted", "post-workout"] as const;

export const roundWeightKg = (value: number): number =>
  Math.round(value * 1000) / 1000;

export const formatWeightKg = (value: number): string => {
  const trimmed = value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return trimmed.includes(".") ? trimmed : `${trimmed}.0`;
};

export const parseLocalizedWeight = (value: string): number | null => {
  const normalized = value.replace(",", ".").trim();
  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundWeightKg(parsed) : null;
};

export const generateUuid = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

export const getZoneOffsetMinutes = (date: Date): number => -date.getTimezoneOffset();

export const toLocalIsoWithOffset = (date: Date): string => {
  const offsetMinutes = getZoneOffsetMinutes(date);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absoluteOffset / 60)).padStart(2, "0");
  const offsetMins = String(absoluteOffset % 60).padStart(2, "0");

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}${sign}${offsetHours}:${offsetMins}`;
};

export const parseDateOnly = (value: string): Date => {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

export const formatDateOnly = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

export const getRangeStartDate = (range: WeightRangeKey): Date => {
  const now = new Date();
  const next = new Date(now);

  if (range === "1W") {
    next.setDate(next.getDate() - 7);
    return next;
  }

  if (range === "1M") {
    next.setMonth(next.getMonth() - 1);
    return next;
  }

  if (range === "3M") {
    next.setMonth(next.getMonth() - 3);
    return next;
  }

  next.setFullYear(next.getFullYear() - 1);
  return next;
};

export const getLocalDateKey = (localIso: string): string => localIso.slice(0, 10);

export const formatLocalDateLabel = (localIso: string): string =>
  new Date(localIso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

export const formatLocalDateTimeLabel = (localIso: string): string =>
  new Date(localIso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const deriveTimeOfDay = (localIso: string): Exclude<WeightTimeOfDay, "all"> => {
  const hour = Number(localIso.slice(11, 13));

  if (hour >= 5 && hour < 12) {
    return "morning";
  }

  if (hour >= 12 && hour < 17) {
    return "afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "evening";
  }

  return "night";
};

export const getMinutesBetween = (leftIso: string, rightIso: string): number =>
  Math.abs(new Date(leftIso).getTime() - new Date(rightIso).getTime()) / 60000;

export const computeEmaSeries = (
  entries: DBWeightEntry[],
  smoothing = 0.35,
): Array<{ id: string; value: number }> => {
  const sorted = [...entries].sort(
    (left, right) =>
      new Date(left.measuredAt).getTime() - new Date(right.measuredAt).getTime(),
  );
  let previous: number | null = null;

  return sorted.map((entry) => {
    previous =
      previous == null
        ? entry.valueKg
        : entry.valueKg * smoothing + previous * (1 - smoothing);

    return {
      id: entry.id,
      value: roundWeightKg(previous),
    };
  });
};

export const computeMovingAverage = (
  entries: DBWeightEntry[],
  days: number,
): number | null => {
  if (entries.length === 0) {
    return null;
  }

  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const recent = entries.filter(
    (entry) => new Date(entry.measuredAt).getTime() >= cutoff,
  );

  if (recent.length === 0) {
    return null;
  }

  return roundWeightKg(
    recent.reduce((sum, entry) => sum + entry.valueKg, 0) / recent.length,
  );
};

export const computeGoalProgress = (
  currentWeightKg: number,
  startWeightKg: number,
  goal: WeightEntryGoal | null,
): number | null => {
  if (!goal) {
    return null;
  }

  const totalDelta = startWeightKg - goal.targetWeightKg;
  if (Math.abs(totalDelta) < 0.001) {
    return 100;
  }

  const completedDelta = startWeightKg - currentWeightKg;
  const percent = (completedDelta / totalDelta) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
};

export const computeWeeklyPaceToGoal = (
  currentWeightKg: number,
  goal: WeightEntryGoal | null,
): string | null => {
  if (!goal?.targetDate) {
    return null;
  }

  const targetDate = parseDateOnly(goal.targetDate);
  const now = new Date();
  const weeksRemaining =
    (targetDate.getTime() - now.getTime()) / (7 * 24 * 60 * 60 * 1000);

  if (!Number.isFinite(weeksRemaining) || weeksRemaining <= 0) {
    return null;
  }

  const weeklyDelta = Math.abs(goal.targetWeightKg - currentWeightKg) / weeksRemaining;
  return `~${formatWeightKg(roundWeightKg(weeklyDelta))} kg/week to hit by date`;
};

export const groupEntriesByLocalDate = (entries: DBWeightEntry[]) => {
  const grouped = new Map<string, DBWeightEntry[]>();

  for (const entry of entries) {
    const key = getLocalDateKey(entry.measuredAtLocalIso);
    const current = grouped.get(key) ?? [];
    current.push(entry);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries())
    .sort(
      (left, right) =>
        new Date(right[0]).getTime() - new Date(left[0]).getTime(),
    )
    .map(([key, items]) => ({
      title: formatLocalDateLabel(`${key}T12:00:00+00:00`),
      key,
      data: items.sort(
        (left, right) =>
          new Date(right.measuredAt).getTime() - new Date(left.measuredAt).getTime(),
      ),
    }));
};

export const filterEntriesByRange = (
  entries: DBWeightEntry[],
  range: WeightRangeKey,
): DBWeightEntry[] => {
  const start = getRangeStartDate(range).getTime();
  return entries.filter((entry) => new Date(entry.measuredAt).getTime() >= start);
};
