import { apiRequest } from "./client";

export type ApiWeightEntry = {
  id: string;
  measuredAt: string;
  measuredAtLocalIso: string;
  measuredDayLocal: string;
  zoneOffsetMinutes: number;
  valueKg: number;
  valueOriginal: number;
  unitOriginal: "kg";
  source: string;
  notes: string | null;
  clientGeneratedId: string;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
};

export const listWeights = (options: {
  start?: string;
  end?: string;
  includeDeleted?: boolean;
  limit?: number;
} = {}): Promise<{ entries: ApiWeightEntry[] }> =>
  apiRequest("/v1/weights", {
    query: {
      start: options.start,
      end: options.end,
      includeDeleted: options.includeDeleted ? "true" : undefined,
      limit: options.limit,
    },
  });

export const saveWeight = (input: {
  id: string;
  clientGeneratedId: string;
  measuredAt: string;
  measuredAtLocalIso: string;
  zoneOffsetMinutes: number;
  valueKg: number;
  valueOriginal: number;
  source: string;
  notes?: string | null;
  deviceId?: string | null;
}): Promise<ApiWeightEntry> =>
  apiRequest<ApiWeightEntry>("/v1/weights", { method: "POST", body: input });

export const deleteWeight = (id: string): Promise<ApiWeightEntry> =>
  apiRequest<ApiWeightEntry>(`/v1/weights/${id}`, { method: "DELETE" });

export const clearAllWeights = (): Promise<{ deleted: true }> =>
  apiRequest("/v1/weights", { method: "DELETE" });
