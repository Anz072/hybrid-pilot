import { apiRequest } from "./client";

// Adaptive calorie recommendations.
//
// Only the data access lives behind the API. The 28-day TDEE analysis still
// runs on the device (src/engine/adaptiveCalories.ts); moving it needs a
// dual-run comparison against historical data before it can be trusted.

export type ApiRecommendationStatus =
  | "proposed" | "accepted" | "rejected" | "applied" | "superseded";

export type ApiRecommendation = {
  id: number;
  status: ApiRecommendationStatus;
  algorithmVersion: string;
  windowStart: string;
  windowEnd: string;
  confidence: "low" | "medium" | "high";
  currentBaseCalories: number | null;
  recommendedBaseCalories: number;
  estimatedTdee: number;
  recommendedDelta: number;
  avgLoggedCalories: number;
  completeDaysUsed: number;
  weighInsUsed: number;
  trendStartKg: number;
  trendEndKg: number;
  observedWeeklyChangeKg: number | null;
  reason: string;
  inputSummary: Record<string, unknown> | null;
  respondedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const listRecommendations = (options: {
  status?: ApiRecommendationStatus | null;
  limit?: number;
} = {}): Promise<{ recommendations: ApiRecommendation[] }> =>
  apiRequest("/v1/adaptive/recommendations", {
    query: { status: options.status ?? undefined, limit: options.limit },
  });

export const createRecommendation = (
  input: Record<string, unknown>,
): Promise<ApiRecommendation> =>
  apiRequest<ApiRecommendation>("/v1/adaptive/recommendations", {
    method: "POST",
    body: input,
  });

export const patchRecommendation = (
  id: number,
  patch: {
    status?: ApiRecommendationStatus;
    respondedAt?: string | null;
    appliedAt?: string | null;
  },
): Promise<ApiRecommendation> =>
  apiRequest<ApiRecommendation>(`/v1/adaptive/recommendations/${id}`, {
    method: "PATCH",
    body: patch,
  });
