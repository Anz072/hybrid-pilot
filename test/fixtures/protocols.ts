import type {
  ApiProtocolCompound, ApiProtocolCourse, ApiProtocolDay, ApiProtocolDoseLog,
  ApiProtocolLevels, CreateProtocolCourseInput, CreateProtocolLogInput,
} from "../../src/API/nouri/protocolTypes";

export const alice = "a0000000-0000-4000-8000-000000000001";
export const bob = "b0000000-0000-4000-8000-000000000001";
export const courseId = "a0000000-0000-4000-8000-000000000002";
export const phaseId = "a0000000-0000-4000-8000-000000000003";
export const occurrenceId = "a0000000-0000-4000-8000-000000000004";
export const logId = "a0000000-0000-4000-8000-000000000005";
export const operationId = "a0000000-0000-4000-8000-000000000006";
export const now = "2026-09-10T12:00:00.000Z";
export const compound: ApiProtocolCompound = {
  id: "c0000000-0000-4000-8000-000000000001", slug: "testosterone-enanthate", name: "Testosterone Enanthate",
  category: "testosterone", doseUnits: ["mg", "mcg"], routes: ["IM"], active: true, description: "Fixture",
};
export const createInput: CreateProtocolCourseInput = {
  id: courseId, compoundId: compound.id, startAt: "2026-09-09T06:00:00.000Z", endAt: null,
  timezone: "Europe/Vilnius", route: "IM",
  schedule: { kind: "daily", doses: [{ key: "morning", time: "09:00", amount: "12.123456789012", unit: "mg" }] },
};
export const course: ApiProtocolCourse = {
  id: courseId, compound, status: "ACTIVE", startAt: createInput.startAt, endAt: null,
  revision: 2, materializedUntil: "2027-01-08T12:00:00.000Z",
  phases: [{ id: phaseId, effectiveFrom: createInput.startAt, timezone: createInput.timezone, route: createInput.route, schedule: createInput.schedule }],
  createdAt: now, updatedAt: now,
};
export const logInput: CreateProtocolLogInput = {
  id: logId, actual: { at: "2026-09-10T10:17:00.000Z", amount: "11.987654321012", unit: "mg", route: "IM", siteCode: "left_delt" },
};
export const doseLog: ApiProtocolDoseLog = {
  id: logId, courseId, phaseId, occurrenceId,
  planned: { at: "2026-09-10T06:00:00.000Z", amount: "12.123456789012", unit: "mg", route: "IM" },
  actual: logInput.actual, revision: 1, createdAt: now, updatedAt: now,
};
export const day: ApiProtocolDay = {
  date: "2026-09-10", timezone: "Europe/Vilnius", evaluatedAt: now,
  occurrences: [{ id: occurrenceId, courseId, phaseId, compound, timezone: "Europe/Vilnius", planned: doseLog.planned!, log: doseLog, state: "completed", canLog: false }],
  manualLogs: [], previewOccurrences: [], reminders: [], yesterdayUnlogged: 1, week: [], nextDose: null, nextDosePreview: null,
  coverage: [{ courseId, materializedUntil: course.materializedUntil }],
};
export const levels: ApiProtocolLevels = {
  evaluatedAt: now, startAt: "2026-09-01T12:00:00.000Z", endAt: "2026-10-01T12:00:00.000Z",
  range: "1M", metric: "relative", splitAt: now, comparisonBranchAt: null,
  series: [{
    key: courseId, courseId, compound, mode: "actual_and_planned", status: "ready", unavailableReason: null,
    courseStartAt: course.startAt, courseStartTimezone: createInput.timezone,
    points: [{ at: now, amount: 1.125, relative: 4.5, segment: "actual" }, { at: "2026-09-11T12:00:00.000Z", amount: 2.25, relative: 9, segment: "planned" }],
    doseMarkers: [{ at: logInput.actual.at, amount: logInput.actual.amount, unit: logInput.actual.unit, route: logInput.actual.route, key: logId, occurrenceId, kind: "actual", level: { amount: 0, relative: 0 } }],
    phaseMarkers: [{ kind: "start", at: createInput.startAt, phaseId }], models: [], amountMeaning: "modeled_dose_equivalent", amountUnit: "mg",
    currentValue: { amount: 1.125, relative: 4.5 },
    normalization: { referenceAmount: 25, unit: "mg", method: "steady_state_peak", tolerance: 0.000001, settlingResidualFraction: 0 },
    clearance: { status: "estimated", basis: "stopped_now", finalAdministrationAt: logInput.actual.at, at: "2026-09-22T12:00:00.000Z", stoppedAt: now,
      referencePeakAmount: 5, thresholdAmount: 0.25, thresholdFraction: 0.05, reference: "peak_after_final_included_administration" },
    history: { actualCount: 1, unloggedCount: 1, coverageIncomplete: true },
  }],
};
