import { describe, expect, it } from "vitest";
import type { ApiProtocolTrendPoint } from "../src/API/nouri/protocolTypes";
import { nearestTrendPoint, sampleTrendPoints, trendDatePosition } from "../src/screens/Protocols/trendChartGeometry";
import { trends } from "./fixtures/protocolTrends";

describe("Trends chart presentation", () => {
  it("bounds drawing work without changing source values or connecting across missing days", () => {
    const points: ApiProtocolTrendPoint[] = Array.from({ length: 10000 }, (_, i) => ({
      date: new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10),
      value: i === 5000 ? null : i === 5001 ? 900 : 100, recordedValue: i === 5000 ? null : 50,
      coverage: 4, isComplete: i !== 5000, sourceId: null,
    }));
    const before = structuredClone(points);
    const drawn = sampleTrendPoints(points);
    expect(drawn.length).toBeLessThanOrEqual(800);
    expect(drawn[0]?.index).toBe(0); expect(drawn.at(-1)?.index).toBe(9999);
    expect(drawn.some((point) => point.index === 5001 && point.value === 900)).toBe(true);
    expect(drawn.find((point) => point.index < 5000)?.segment).not.toBe(drawn.find((point) => point.index > 5000)?.segment);
    expect(points).toEqual(before);
    expect(nearestTrendPoint(points, trendDatePosition(points[1234]!.date))).toBe(1234);
  });
  it("keeps zero averages and makes gaps, edge dates and single points inspectable", () => {
    const points = [...trends.points, { ...trends.points[0]!, date: "2026-09-14", value: 0, recordedValue: 0 }];
    expect(sampleTrendPoints(points).map((point) => point.value)).toEqual([516, 166, 0]);
    expect(nearestTrendPoint(points, trendDatePosition("2026-09-09"))).toBe(2);
    expect(nearestTrendPoint(points, trendDatePosition("2020-01-01"))).toBe(0);
    expect(nearestTrendPoint(points, trendDatePosition("2030-01-01"))).toBe(5);
    expect(nearestTrendPoint([], 0)).toBe(-1);
    expect(nearestTrendPoint([points[0]!], 0)).toBe(0);
  });
});
