import { getFirstUser, upsertUser } from "./userRepository";
import { addWeightLog, getRecentWeightLogs } from "./weightRepository";
import type { DBUserRow } from "./DB_TYPES";

export * from "./DB_TYPES";

const toUserRow = (
  input: Partial<DBUserRow> & Record<string, unknown>,
): DBUserRow => {
  const now = new Date().toISOString();

  return {
    id: Number(input.id ?? 0),
    external_id: String(input.external_id ?? input.externalId ?? ""),
    provider: String(input.provider ?? "local"),
    display_name: (input.display_name ?? input.displayName ?? null) as
      | string
      | null,
    created_at: String(input.created_at ?? input.createdAt ?? now),
    email: (input.email ?? null) as string | null,
    birthdate: (input.birthdate ?? null) as string | null,
    gender: (input.gender ?? null) as string | null,
    height_cm: (input.height_cm ?? input.heightCm ?? null) as number | null,
    activity_level: (input.activity_level ?? input.activityLevel ?? null) as
      | string
      | null,
    goal: (input.goal ?? null) as string | null,
    calorieAllowance: (input.calorieAllowance ?? null) as number | null,
  };
};

export const DB = {
  getRecentWeightLogs: getRecentWeightLogs,
  addWeightLog: addWeightLog,
  getUser: getFirstUser,
  addUser: (input: Partial<DBUserRow> & Record<string, unknown>) =>
    upsertUser(toUserRow(input)),
};
