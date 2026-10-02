import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveWeight } from "../src/API/nouri/weightApi";
import {
  getZoneOffsetMinutes,
  toLocalIsoWithOffset,
} from "../src/screens/Weight/weightUtils";

const { apiRequest } = vi.hoisted(() => ({ apiRequest: vi.fn() }));
vi.mock("../src/API/nouri/client", () => ({ apiRequest }));

// Mirrors nouri-api's localDateTimeSchema/OpenAPI request contract. The offset
// belongs in zoneOffsetMinutes, not in this local wall-clock field.
const API_LOCAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?$/;

const input = {
  id: "weight-fixture",
  clientGeneratedId: "weight-client-fixture",
  measuredAt: "2026-09-05T21:15:00.000Z",
  measuredAtLocalIso: "2026-09-06T00:15:00+03:00",
  zoneOffsetMinutes: 180,
  valueKg: 80.25,
  valueOriginal: 80.25,
  source: "manual",
  notes: null,
  deviceId: null,
};

beforeEach(() => {
  apiRequest.mockReset();
});

describe("weight save request contract", () => {
  it.each([
    ["2026-09-06T00:15:00+03:00", 180, "2026-09-06T00:15:00"],
    ["2026-09-06T23:45:00-07:00", -420, "2026-09-06T23:45:00"],
    ["2026-09-06T00:15:00+05:30", 330, "2026-09-06T00:15:00"],
    ["2026-09-06T23:45:00-03:30", -210, "2026-09-06T23:45:00"],
    ["2026-09-06T00:15:00.123Z", 0, "2026-09-06T00:15:00.123"],
    ["2026-09-06T00:15:00.123+03:00", 180, "2026-09-06T00:15:00.123"],
    ["2026-09-06T00:15:00", 180, "2026-09-06T00:15:00"],
  ])("preserves local date and time for %s", async (localIso, offset, expectedLocal) => {
    const request = {
      ...input,
      measuredAt: new Date(localIso === expectedLocal ? `${localIso}+03:00` : localIso).toISOString(),
      measuredAtLocalIso: localIso,
      zoneOffsetMinutes: offset,
    };

    await saveWeight(request);

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith("/v1/weights", {
      method: "POST",
      body: { ...request, measuredAtLocalIso: expectedLocal },
    });
    expect(expectedLocal).toMatch(API_LOCAL_TIMESTAMP);
    expect(request.measuredAtLocalIso).toBe(localIso);
  });

  it("accepts the timestamp produced by the weight modal and onboarding", async () => {
    const date = new Date(2026, 8, 6, 0, 15, 0);
    await saveWeight({
      ...input,
      measuredAt: date.toISOString(),
      measuredAtLocalIso: toLocalIsoWithOffset(date),
      zoneOffsetMinutes: getZoneOffsetMinutes(date),
    });

    expect(apiRequest.mock.calls[0]?.[1].body).toMatchObject({
      measuredAt: date.toISOString(),
      measuredAtLocalIso: "2026-09-06T00:15:00",
      zoneOffsetMinutes: getZoneOffsetMinutes(date),
    });
  });

  it("returns the server result and propagates failed saves", async () => {
    const accepted = { ...input, measuredAtLocalIso: "2026-09-06T00:15:00", version: 2 };
    apiRequest.mockResolvedValueOnce(accepted);
    expect(await saveWeight(input)).toBe(accepted);

    const error = new Error("Request validation failed.");
    apiRequest.mockRejectedValueOnce(error);
    await expect(saveWeight(input)).rejects.toBe(error);
  });
});
