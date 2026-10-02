// Transport shapes mirror the API's authoritative Zod schemas/OpenAPI.
// test/protocolsApi.test.ts checks serialized fixtures with those schemas.
import type {
  ProtocolChartMetric, ProtocolChartRange, ProtocolCourseStatus, ProtocolDose,
  ProtocolDoseUnit, ProtocolPhase, ProtocolPhaseConfiguration, ProtocolRoute,
} from "../../domain/types";

export type ApiProtocolCompound = {
  id: string; slug: string; name: string;
  category: "testosterone" | "injectable_aas" | "incretin";
  doseUnits: ProtocolDoseUnit[]; routes: ProtocolRoute[]; active: boolean; description: string;
};
export type ApiProtocolCourse = {
  id: string; compound: ApiProtocolCompound; status: ProtocolCourseStatus;
  startAt: string; endAt: string | null; revision: number; materializedUntil: string | null;
  phases: ProtocolPhase[]; createdAt: string; updatedAt: string;
};
export type CreateProtocolCourseInput = ProtocolPhaseConfiguration & {
  id: string; compoundId: string; startAt: string; endAt: string | null;
};
export type ProtocolCommand = { operationId: string; expectedRevision: number };
export type EditProtocolDraftInput = ProtocolPhaseConfiguration & ProtocolCommand & { startAt: string; endAt: string | null };
export type ChangeProtocolPhaseInput = ProtocolPhaseConfiguration & ProtocolCommand & { effectiveDate: string; futureChanges: "keep" | "replace" };
export type EndProtocolCourseInput = ProtocolCommand & { endDate: string; timezone: string };
export type ProtocolSchedulePreviewInput = {
  phases: ProtocolPhase[]; startAt: string; endAt: string; courseEndAt?: string | null;
};
export type ProtocolTimePreviewInput = { date: string; time: string; timezone: string };
export type ApiProtocolTimePreview = { at: string; disambiguation: "gap_forward_fold_earlier" };
export type ApiProtocolPlannedSlot = ProtocolDose & { phaseId: string; slotKey: string; scheduledAt: string; route: ProtocolRoute };
export type ApiProtocolSchedulePreview = { occurrences: ApiProtocolPlannedSlot[]; disambiguation: "gap_forward_fold_earlier" };

export type ApiProtocolPlannedDose = ProtocolDose & { at: string; route: ProtocolRoute };
export type ApiProtocolActualDose = ApiProtocolPlannedDose & { siteCode: string | null };
export type CreateProtocolLogInput = { id: string; actual: ApiProtocolActualDose };
export type EditProtocolLogInput = ProtocolCommand & { actual: ApiProtocolActualDose };
export type ApiProtocolDoseLog = {
  id: string; courseId: string; phaseId: string; occurrenceId: string | null;
  planned: ApiProtocolPlannedDose | null; actual: ApiProtocolActualDose;
  revision: number; createdAt: string; updatedAt: string;
};
export type ApiProtocolOccurrence = {
  id: string; courseId: string; phaseId: string; compound: ApiProtocolCompound;
  timezone: string; planned: ApiProtocolPlannedDose; log: ApiProtocolDoseLog | null;
  state: "scheduled" | "overdue" | "unlogged" | "completed"; canLog: boolean;
};
export type ApiProtocolCalendarIndicator = { date: string; scheduled: number; completed: number; manual: number; preview: number; reminders?: number };
export type ApiProtocolCoverage = { courseId: string; materializedUntil: string | null };
export type ApiProtocolNextDose = { courseId: string; phaseId: string; occurrenceId: string | null; timezone: string; planned: ApiProtocolPlannedDose };
export type ApiProtocolNextDoses = { evaluatedAt: string; courses: Array<{ courseId: string; nextDose: ApiProtocolNextDose | null }> };
export type ApiProtocolDay = {
  reminders?: ApiProtocolReminder[];
  date: string; timezone: string; evaluatedAt: string;
  occurrences: ApiProtocolOccurrence[]; manualLogs: Array<ApiProtocolDoseLog & { compound: ApiProtocolCompound; timezone: string }>;
  previewOccurrences: Array<ApiProtocolPlannedSlot & { courseId: string; compound: ApiProtocolCompound }>;
  yesterdayUnlogged: number; week: ApiProtocolCalendarIndicator[];
  nextDose: ApiProtocolOccurrence | null; nextDosePreview: ApiProtocolNextDose | null; coverage: ApiProtocolCoverage[];
};
export type ApiProtocolCalendar = { days: ApiProtocolCalendarIndicator[]; timezone: string; coverage: ApiProtocolCoverage[] };
export type ApiProtocolSites = {
  sites: Array<{ code: string; label: string; route: ProtocolRoute }>;
  recent: Array<{ code: string; route: ProtocolRoute; lastUsedAt: string }>;
  recentRoutes: Array<{ route: ProtocolRoute; siteCode: string | null; lastUsedAt: string }>;
};
export type ProtocolPageQuery = { after?: string; limit?: number };
export type ProtocolCoursePageQuery = ProtocolPageQuery & { order?: "id" | "activity" };
export type ApiProtocolCoursePage = { courses: ApiProtocolCourse[]; nextCursor: string | null };
export type ApiProtocolLogPage = { logs: ApiProtocolDoseLog[]; nextCursor: string | null };
export type ProtocolDayQuery = { date: string; tz: string; courseId?: string };
export type ProtocolCalendarQuery = { start: string; end: string; tz: string; courseId?: string };

export type ApiProtocolPkSource = { title: string; url: string; accessedOn: string; evidence: string };
type PkParameters = {
  doseUnit: ProtocolDoseUnit; decayHalfLifeHours: number;
  halfLifeBasis: "systemic_elimination" | "apparent_terminal" | "depot_release";
  bioavailability: number; bioavailabilityBasis: "reported" | "dose_equivalent_convention";
};
export type ApiProtocolPkModel = {
  id: string; key: string; route: ProtocolRoute; version: number; publishedAt: string;
  definition:
    | { modelType: "ELIMINATION_ONLY"; parameters: PkParameters & { absorption: null } }
    | { modelType: "FIRST_ORDER_ABSORPTION_ELIMINATION"; parameters: PkParameters & { absorption: { kind: "half_life" | "time_to_peak"; hours: number } } };
  explanation: string; limitations: string; sources: ApiProtocolPkSource[];
};
export type ApiProtocolCompoundDetail = ApiProtocolCompound & {
  regulatoryNote: string; evidenceSources: ApiProtocolPkSource[]; models: ApiProtocolPkModel[];
  unavailableReason: string | null; amountMeaning: "modeled_dose_equivalent";
};
export type ProtocolLevelsView = { range: ProtocolChartRange; metric: ProtocolChartMetric; anchorAt?: string };
export type ProtocolLevelsQuery = ProtocolLevelsView & { courseIds: string[] };
export type CompareProtocolLevelsInput = ProtocolLevelsView & { courseId: string; configuration: ProtocolPhaseConfiguration };
export type PreviewProtocolLevelsInput = ProtocolLevelsView & CreateProtocolCourseInput;
export type ApiProtocolLevelPoint = { at: string; amount: number; relative: number | null; segment: "actual" | "planned" | "draft" };
export type ApiProtocolDoseMarker = ProtocolDose & {
  key: string; occurrenceId: string | null; at: string; route: ProtocolRoute; kind: "actual" | "planned" | "draft";
  level: { amount: number; relative: number | null };
};
export type ApiProtocolPhaseMarker = { kind: "start" | "change" | "end"; at: string; phaseId: string | null };
export type ApiProtocolNormalization = {
  referenceAmount: number | null; unit: ProtocolDoseUnit;
  method: "finite_timeline_peak" | "steady_state_peak" | "actual_history_peak" | "shared_comparison_peak" | "no_doses";
  tolerance: number; settlingResidualFraction: number | null;
};
export type ApiProtocolClearance = {
  status: "estimated" | "no_doses" | "not_reached";
  basis: "final_actual" | "final_planned" | "stopped_now" | "draft_preview";
  finalAdministrationAt: string | null; at: string | null; stoppedAt: string | null;
  referencePeakAmount: number | null; thresholdAmount: number | null;
  thresholdFraction: 0.05; reference: "peak_after_final_included_administration";
};
export type ApiProtocolLevelSeries = {
  key: string; courseId: string; compound: ApiProtocolCompound;
  courseStartAt: string; courseStartTimezone: string;
  mode: "actual_and_planned" | "draft_preview" | "comparison"; status: "ready" | "unavailable";
  unavailableReason: "missing_model" | "invalid_model" | "computation_limit" | "normalization_unavailable" | null;
  points: ApiProtocolLevelPoint[]; doseMarkers: ApiProtocolDoseMarker[]; phaseMarkers: ApiProtocolPhaseMarker[];
  models: ApiProtocolPkModel[]; amountMeaning: "modeled_dose_equivalent"; amountUnit: ProtocolDoseUnit;
  currentValue: { amount: number; relative: number | null } | null;
  normalization: ApiProtocolNormalization | null; clearance: ApiProtocolClearance | null;
  history: { actualCount: number; unloggedCount: number; coverageIncomplete: boolean };
};
export type ApiProtocolLevels = {
  evaluatedAt: string; startAt: string; endAt: string; range: ProtocolChartRange; metric: ProtocolChartMetric;
  splitAt: string; comparisonBranchAt: string | null; series: ApiProtocolLevelSeries[];
};
export type ApiProtocolAnnotations = {
  timezone: string;
  courses: Array<{ courseId: string; compoundId: string; name: string; startAt: string; endAt: string | null }>;
  events: Array<{ courseId: string; phaseId: string | null; kind: "start" | "change" | "end"; at: string; date: string }>;
};
export type ApiProtocolReminder = { id: string; title: string; scheduledAt: string; timezone: string; revision: number; createdAt: string; updatedAt: string };
export type CreateProtocolReminderInput = { id: string; title: string; scheduledAt: string; timezone: string };
export type EditProtocolReminderInput = Omit<CreateProtocolReminderInput,"id"> & { operationId: string; expectedRevision: number };

export type ProtocolTrendMetric = "weight" | "calories" | "protein" | "carbs" | "fat";
export type ProtocolTrendsQuery = { metric: ProtocolTrendMetric; range: ProtocolChartRange; end?: string; tz: string };
export type ApiProtocolTrendPoint = {
  date: string; value: number | null; recordedValue: number | null;
  coverage: number; isComplete: boolean | null; sourceId: string | null;
};
export type ApiProtocolTrends = {
  metric: ProtocolTrendMetric; range: ProtocolChartRange; start: string; end: string; timezone: string;
  firstRecordedDate: string | null; unit: "kg" | "kcal" | "g";
  aggregation: "measurement" | "complete_day_7_day_average"; datePolicy: "stored_local_date";
  recordedDays: number; eligibleDays: number; points: ApiProtocolTrendPoint[];
};
