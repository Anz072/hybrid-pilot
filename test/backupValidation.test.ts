import { describe, expect, it } from "vitest";
import {
  loadFoodLogForExport,
  parseBackup,
} from "../src/screens/User_Settings/dataExportUtils";

const weight = {
  id: "test-weight",
  valueKg: 81.14,
  measuredAt: "2026-08-31T08:00:00.000Z",
  measuredAtLocalIso: "2026-08-31T11:00:00+03:00",
  zoneOffsetMinutes: 180,
};
const backup = (weights: unknown[], version = 1) =>
  JSON.stringify({ format: "dribsnis.backup", version, weights, foodLog: [] });

describe("backup import validation", () => {
  it("preserves weight precision and local measurement time", () => {
    const result = parseBackup(backup([weight]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.backup.weights[0]).toEqual(weight);
  });
  it("rejects invalid entries before any restore can start", () => {
    for (const entry of [
      null,
      { ...weight, id: null },
      { ...weight, valueKg: -1 },
      { ...weight, measuredAt: "invalid" },
      { ...weight, notes: {} },
      { ...weight, zoneOffsetMinutes: 10000 },
    ]) {
      expect(parseBackup(backup([weight, entry])).ok).toBe(false);
    }
  });
  it("rejects foreign files and unsupported versions", () => {
    expect(parseBackup("{}").ok).toBe(false);
    expect(parseBackup("not JSON").ok).toBe(false);
    expect(parseBackup(backup([weight], 99)).ok).toBe(false);
  });
});

describe("full-history backup retrieval", () => {
  it("covers leap years without gaps, overlaps or requests over 400 days", async () => {
    const calls: [string, string][] = [];
    await loadFoodLogForExport(
      async (from, to) => {
        calls.push([from, to]);
        return [];
      },
      "2023-01-01",
      "2026-09-05",
    );
    expect(calls[0][0]).toBe("2023-01-01");
    expect(calls.at(-1)?.[1]).toBe("2026-09-05");
    calls.forEach(([from, to], index) => {
      expect(
        (Date.parse(to) - Date.parse(from)) / 86400000 + 1,
      ).toBeLessThanOrEqual(400);
      if (index)
        expect(Date.parse(from) - Date.parse(calls[index - 1][1])).toBe(
          86400000,
        );
    });
  });
  it("does not export partial history if a request fails", async () => {
    await expect(
      loadFoodLogForExport(
        async () => {
          throw new Error("offline");
        },
        "2025-01-01",
        "2026-09-05",
      ),
    ).rejects.toThrow("offline");
  });
});
