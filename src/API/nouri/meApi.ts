import { apiRequest } from "./client";

// Profile, settings and weight goal. One GET returns all three.

export type ApiProfile = {
  id: string;
  displayName: string | null;
  email: string | null;
  birthdate: string | null;
  gender: "male" | "female" | "other" | null;
  heightCm: number | null;
  activityLevel: string | null;
  goal: string | null;
  goalStrategy: string | null;
  trainingTypes: string[] | null;
  proteinFocus: string | null;
  calorieAllowance: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiSettings = {
  foodDiaryStartHour: number;
  foodDiaryEndHour: number;
  dailyCalorieOverrides: Array<number | null> | null;
  adaptiveCaloriesEnabled: boolean;
  adaptiveMode: "recommend" | "auto_apply";
  adaptiveLastCalculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiWeightGoal = {
  targetWeightKg: number;
  targetDate: string | null;
  goalBandKg: number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiMe = {
  profile: ApiProfile;
  settings: ApiSettings | null;
  weightGoal: ApiWeightGoal | null;
};

export const getMe = (): Promise<ApiMe> => apiRequest<ApiMe>("/v1/me");

export const patchProfile = (
  patch: Partial<Omit<ApiProfile, "id" | "email" | "createdAt" | "updatedAt">>,
): Promise<ApiProfile> =>
  apiRequest<ApiProfile>("/v1/me", { method: "PATCH", body: patch });

export const patchSettings = (
  patch: Partial<Omit<ApiSettings, "createdAt" | "updatedAt">>,
): Promise<ApiSettings> =>
  apiRequest<ApiSettings>("/v1/me/settings", { method: "PATCH", body: patch });

export const putWeightGoal = (input: {
  targetWeightKg: number;
  targetDate?: string | null;
  goalBandKg?: number | null;
}): Promise<ApiWeightGoal> =>
  apiRequest<ApiWeightGoal>("/v1/me/weight-goal", { method: "PUT", body: input });

export const deleteWeightGoal = (): Promise<{ deleted: true }> =>
  apiRequest("/v1/me/weight-goal", { method: "DELETE" });
