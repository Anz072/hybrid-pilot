import type { User } from "@supabase/supabase-js";
import type {
  GoalStrategy,
  ProteinFocus,
} from "../../navigation/onboardingTypes";
import { resolveGoalStrategy } from "../../engine/goalStrategy";
import type { DBUser, DBUserGender, DBUserProvider } from "../../store/DB_TYPES";
import { getSupabaseClient } from "./client";

const SUPABASE_PROFILES_TABLE = "profiles";

type RawSupabaseProfileRow = {
  id: string;
  display_name: string | null;
  email: string | null;
  birthdate: string | null;
  gender: string | null;
  height_cm: number | string | null;
  activity_level: string | null;
  goal: string | null;
  goal_strategy: string | null;
  training_types: unknown;
  protein_focus: string | null;
  calorie_allowance: number | string | null;
  protein_g: number | string | null;
  carbs_g: number | string | null;
  fat_g: number | string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type SupabaseProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
  birthdate: string | null;
  gender: DBUserGender;
  heightCm: number | null;
  activityLevel: string | null;
  goal: string | null;
  goalStrategy: GoalStrategy | null;
  trainingTypes: string[] | null;
  proteinFocus: ProteinFocus | null;
  calorieAllowance: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertSupabaseProfileInput = {
  id: string;
  displayName?: string | null;
  email?: string | null;
  birthdate?: string | null;
  gender?: DBUserGender;
  heightCm?: number | null;
  activityLevel?: string | null;
  goal?: string | null;
  goalStrategy?: GoalStrategy | null;
  trainingTypes?: string[] | null;
  proteinFocus?: ProteinFocus | null;
  calorieAllowance?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ToDbUserOptions = {
  localId?: number;
  provider?: DBUserProvider | string;
};

const normalizeOptionalText = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const parseNullableNumber = (value: unknown): number | null => {
  if (value == null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeGender = (value: unknown): DBUserGender => {
  if (value === "male" || value === "female" || value === "other") {
    return value;
  }

  return null;
};

const isProteinFocus = (value: unknown): value is ProteinFocus =>
  value === "mild" ||
  value === "moderate" ||
  value === "focused" ||
  value === "heavy";

const normalizeTrainingTypes = (value: unknown): string[] | null => {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return items.length > 0 ? items : null;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeTrainingTypes(parsed);
    } catch {
      return null;
    }
  }

  return null;
};

const toSupabaseProfile = (row: RawSupabaseProfileRow): SupabaseProfile => {
  const now = new Date().toISOString();

  return {
    id: row.id,
    displayName: normalizeOptionalText(row.display_name),
    email: normalizeOptionalText(row.email),
    birthdate: normalizeOptionalText(row.birthdate),
    gender: normalizeGender(row.gender),
    heightCm: parseNullableNumber(row.height_cm),
    activityLevel: normalizeOptionalText(row.activity_level),
    goal: normalizeOptionalText(row.goal),
    goalStrategy: resolveGoalStrategy(
      normalizeOptionalText(row.goal),
      normalizeOptionalText(row.goal_strategy),
    ),
    trainingTypes: normalizeTrainingTypes(row.training_types),
    proteinFocus: isProteinFocus(row.protein_focus) ? row.protein_focus : null,
    calorieAllowance: parseNullableNumber(row.calorie_allowance),
    proteinG: parseNullableNumber(row.protein_g),
    carbsG: parseNullableNumber(row.carbs_g),
    fatG: parseNullableNumber(row.fat_g),
    createdAt: normalizeOptionalText(row.created_at) ?? now,
    updatedAt: normalizeOptionalText(row.updated_at) ?? now,
  };
};

const toSupabaseProfileRow = (input: UpsertSupabaseProfileInput) => ({
  id: input.id,
  display_name: normalizeOptionalText(input.displayName),
  email: normalizeOptionalText(input.email),
  birthdate: normalizeOptionalText(input.birthdate),
  gender: input.gender ?? null,
  height_cm: input.heightCm ?? null,
  activity_level: normalizeOptionalText(input.activityLevel),
  goal: normalizeOptionalText(input.goal),
  goal_strategy: resolveGoalStrategy(input.goal, input.goalStrategy),
  training_types:
    input.trainingTypes && input.trainingTypes.length > 0
      ? input.trainingTypes.map((item) => item.trim()).filter(Boolean)
      : [],
  protein_focus: input.proteinFocus ?? null,
  calorie_allowance: input.calorieAllowance ?? null,
  protein_g: input.proteinG ?? null,
  carbs_g: input.carbsG ?? null,
  fat_g: input.fatG ?? null,
  created_at: normalizeOptionalText(input.createdAt) ?? undefined,
  updated_at: normalizeOptionalText(input.updatedAt) ?? new Date().toISOString(),
});

const requireAuthenticatedUser = async (): Promise<User> => {
  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!user) {
    throw new Error("No authenticated Supabase user is available.");
  }

  return user;
};

export const getSupabaseProfile = async (
  userId: string,
): Promise<SupabaseProfile | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(SUPABASE_PROFILES_TABLE)
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return toSupabaseProfile(data as RawSupabaseProfileRow);
};

export const getCurrentSupabaseProfile = async (): Promise<SupabaseProfile | null> => {
  const user = await requireAuthenticatedUser();
  return getSupabaseProfile(user.id);
};

export const upsertSupabaseProfile = async (
  input: UpsertSupabaseProfileInput,
): Promise<SupabaseProfile> => {
  const supabase = getSupabaseClient();
  const payload = toSupabaseProfileRow(input);
  const { data, error } = await supabase
    .from(SUPABASE_PROFILES_TABLE)
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toSupabaseProfile(data as RawSupabaseProfileRow);
};

export const upsertCurrentSupabaseProfile = async (
  input: Omit<UpsertSupabaseProfileInput, "id"> = {},
): Promise<SupabaseProfile> => {
  const user = await requireAuthenticatedUser();

  return upsertSupabaseProfile({
    id: user.id,
    email: input.email ?? user.email ?? null,
    ...input,
  });
};

export const buildSupabaseProfileInputFromDbUser = (
  user: DBUser,
): UpsertSupabaseProfileInput => ({
  id: user.externalId,
  displayName: user.displayName,
  email: user.email,
  birthdate: user.birthdate,
  gender: user.gender,
  heightCm: user.heightCm,
  activityLevel: user.activityLevel,
  goal: user.goal,
  goalStrategy: user.goalStrategy,
  trainingTypes: user.trainingTypes,
  proteinFocus: user.proteinFocus,
  calorieAllowance: user.calorieAllowance,
  proteinG: user.proteinG,
  carbsG: user.carbsG,
  fatG: user.fatG,
  createdAt: user.createdAt,
});

export const toDbUserFromSupabaseProfile = (
  profile: SupabaseProfile,
  options: ToDbUserOptions = {},
): DBUser => ({
  id: options.localId ?? 0,
  externalId: profile.id,
  provider: options.provider ?? "google",
  displayName: profile.displayName,
  createdAt: profile.createdAt,
  email: profile.email,
  birthdate: profile.birthdate,
  gender: profile.gender,
  heightCm: profile.heightCm,
  activityLevel: profile.activityLevel,
  goal: profile.goal,
  goalStrategy: profile.goalStrategy,
  trainingTypes: profile.trainingTypes,
  proteinFocus: profile.proteinFocus,
  calorieAllowance: profile.calorieAllowance,
  proteinG: profile.proteinG,
  carbsG: profile.carbsG,
  fatG: profile.fatG,
});
