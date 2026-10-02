import { describe, expect, it } from "vitest";
import { getProgressRingState } from "../src/components/ui/progressRingModel";

describe("calorie ring presentation", () => {
  it("shows an empty arc for a day with no food", () => {
    expect(getProgressRingState(0, 2000)).toEqual({ value: 0, target: 2000, progress: 0, remaining: 2000 });
  });
  it("represents partial and exactly completed targets", () => {
    expect(getProgressRingState(1500, 2000)).toMatchObject({ progress: 0.75, remaining: 500 });
    expect(getProgressRingState(2000, 2000)).toMatchObject({ progress: 1, remaining: 0 });
  });
  it("caps the arc without discarding over-target calories", () => {
    expect(getProgressRingState(2350, 2000)).toEqual({ value: 2350, target: 2000, progress: 1, remaining: -350 });
  });
  it.each([null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("does not invent progress for an invalid target %s", target => {
    expect(getProgressRingState(500, target)).toEqual({ value: 500, target: null, progress: 0, remaining: null });
  });
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -500])("keeps invalid totals out of SVG geometry: %s", value => {
    expect(getProgressRingState(value, 2000)).toMatchObject({ value: 0, progress: 0, remaining: 2000 });
  });
  it("rounds only the displayed remainder", () => {
    const state = getProgressRingState(1500.4, 2000);
    expect(state).toMatchObject({ value: 1500.4, remaining: 500 });
    expect(state.progress).toBeCloseTo(0.7502, 8);
  });
});
