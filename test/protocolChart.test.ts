import { describe, expect, it } from "vitest";
import type { ApiProtocolDoseMarker, ApiProtocolLevelPoint } from "../src/API/nouri/protocolTypes";
import { nearestProtocolChartTime, protocolChartValue } from "../src/screens/Protocols/protocolChart";

describe("Protocol chart readout uses rendered API values", () => {
  const points: ApiProtocolLevelPoint[] = [
    { at: "2026-09-10T00:00:00Z", amount: 2, relative: 10, segment: "actual" },
    { at: "2026-09-10T02:00:00Z", amount: 6, relative: 30, segment: "planned" },
  ];
  it("interpolates the displayed line without extrapolating beyond its data", () => {
    expect(protocolChartValue(points, Date.parse("2026-09-10T01:00:00Z"))).toEqual({ amount: 4, relative: 20 });
    expect(protocolChartValue(points, Date.parse(points[0]!.at))).toEqual({ amount: 2, relative: 10 });
    expect(protocolChartValue(points, Date.parse(points[1]!.at))).toEqual({ amount: 6, relative: 30 });
    expect(protocolChartValue(points, Date.parse("2026-09-09T23:59:59Z"))).toBeNull();
    expect(protocolChartValue([], Date.now())).toBeNull();
  });
  it("preserves zero and unavailable relative values instead of inventing a normalization", () => {
    const unnormalized = points.map((point) => ({ ...point, amount: 0, relative: null }));
    expect(protocolChartValue(unnormalized, Date.parse("2026-09-10T01:00:00Z"))).toEqual({ amount: 0, relative: null });
    expect(protocolChartValue([points[0]!, unnormalized[1]!], Date.parse("2026-09-10T01:00:00Z"))?.relative).toBeNull();
  });
  it("uses exact server event values between samples without adding simultaneous markers twice", () => {
    const at = "2026-09-10T01:00:00Z";
    const marker: ApiProtocolDoseMarker = { key: "dose", occurrenceId: null, at, amount: "105", unit: "mg", route: "IM", kind: "actual", level: { amount: 0, relative: 0 } };
    expect(protocolChartValue(points, Date.parse(at), [marker])).toEqual({ amount: 0, relative: 0 });
    const carried = { ...marker, level: { amount: 75, relative: null } };
    expect(protocolChartValue(points, Date.parse(at), [carried, { ...carried, key: "second" }])).toEqual({ amount: 75, relative: null });
    expect(protocolChartValue(points, Date.parse(points[1]!.at), [marker])).toEqual({ amount: 6, relative: 30 });
  });
  it("snaps to exact dose/phase times, with deterministic ties and endpoint bounds", () => {
    expect(nearestProtocolChartTime([10, 17, 30, 50], 17)).toBe(17);
    expect(nearestProtocolChartTime([10, 17, 30, 50], 40)).toBe(30);
    expect(nearestProtocolChartTime([10, 17, 30, 50], -2)).toBe(10);
    expect(nearestProtocolChartTime([10, 17, 30, 50], 99)).toBe(50);
  });
});
