import { apiRequest } from "./client";

// Adaptive calorie recommendations.
//
// The 28-day TDEE analysis runs on the server. `refreshAdaptive` below asks it
// to look at the caller's diary days, entries and weigh-ins and answer with
// what their calorie target should be — one request, where the app used to
// fetch a month of data and compute the answer itself.
//
// The app keeps its own copy of the engine for previews and for the weekly
// review screen, and the two are held equal by the shared conformance corpus
// plus a dual-run diff (test/adaptiveDualRun.test.ts). What the server says is
// what gets stored.

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

export type ApiAdaptiveRefreshResult = {
  status: "disabled" | "insufficient" | "unchanged" | "ready";
  reason: string;
  confidence: "low" | "medium" | "high" | null;
  estimatedTdee: number | null;
  recommendedBaseCalories: number | null;
  summary: Record<string, unknown> | null;
  recommendation: ApiRecommendation | null;
};

/**
 * Runs the engine server-side.
 *
 * `force` is the explicit "recalculate now" action. Without it an identical
 * open recommendation is left alone rather than superseded by a copy of itself,
 * which would reset the user's chance to respond to it.
 */
export const refreshAdaptive = (
  options: { force?: boolean } = {},
): Promise<ApiAdaptiveRefreshResult> =>
  apiRequest<ApiAdaptiveRefreshResult>("/v1/adaptive/refresh", {
    method: "POST",
    body: { force: options.force ?? false },
  });
