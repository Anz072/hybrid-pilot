import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProtocolSchedule } from "../src/domain/types";
import type { ApiProtocolCompoundDetail, ApiProtocolSites } from "../src/API/nouri/protocolTypes";
import * as api from "../src/API/nouri/protocolsApi";
import { trends } from "./fixtures/protocolTrends";
import { alice, compound, course, courseId, createInput, day, doseLog, levels, logId, logInput, now, occurrenceId, operationId } from "./fixtures/protocols";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../src/API/nouri/client", () => ({ apiRequest: request }));

// Load only the known sibling's pure provider schemas at test time. No schema
// copy, generator, production cross-repo import or extra runtime dependency.
type Parser = { parse: (value: unknown) => unknown };
let schema: Record<string, Parser>;
let levelSchema: Record<string, Parser>;
let pkSchema: Record<string, Parser>;
let trendsSchema: Record<string, Parser>;
const provider = new URL("../../nouri-api/", import.meta.url);
beforeAll(async () => {
  schema = await import(new URL("src/modules/protocols/schemas.ts", provider).href);
  levelSchema = await import(new URL("src/modules/protocols/levelsSchemas.ts", provider).href);
  pkSchema = await import(new URL("src/modules/protocols/pkSchemas.ts", provider).href);
  trendsSchema = await import(new URL("src/modules/protocols/trendsSchemas.ts", provider).href);
});
beforeEach(() => { request.mockReset(); });

describe("mobile Protocols contract against provider schemas and generated OpenAPI", () => {
  it("preserves opaque activity cursors instead of treating them as course IDs", async () => {
    const after = "v1." + Buffer.from(JSON.stringify({ at: now, rank: 0, startAt: course.startAt, id: courseId })).toString("base64url");
    const query = { order: "activity" as const, after, limit: 30 };
    expect(schema.coursePageQuerySchema!.parse(query)).toEqual(query);
    const page = { courses: [course], nextCursor: after };
    expect(schema.coursePageSchema!.parse(page)).toEqual(page);
    request.mockResolvedValueOnce(page);
    expect(await api.listProtocolCourses(alice, query)).toBe(page);
    expect(request).toHaveBeenCalledWith("/v1/protocols/courses", { query, expectedUserId: alice });
  });
  it("sends all six schedule variants without coercing decimals, anchors or slot identities", async () => {
    const slot = { key: "morning", time: "09:00", amount: "12.123456789012", unit: "mg" } as const;
    const schedules: ProtocolSchedule[] = [
      { kind: "daily", doses: [slot, { ...slot, key: "evening", time: "20:00", amount: "8.25" }] },
      { kind: "every_n_days", intervalDays: 3, anchorDate: "2026-09-09", doses: [slot] },
      { kind: "every_n_hours", intervalHours: 36, anchorAt: createInput.startAt, amount: slot.amount, unit: slot.unit },
      { kind: "specific_weekdays", days: [{ weekday: 0, doses: [slot] }, { weekday: 4, doses: [{ ...slot, key: "friday", amount: "7.5" }] }] },
      { kind: "one_time", at: createInput.startAt, amount: slot.amount, unit: slot.unit },
      { kind: "as_needed", amount: slot.amount, unit: slot.unit },
    ];
    for (const schedule of schedules) {
      const body = { ...createInput, schedule };
      request.mockResolvedValueOnce(course);
      expect(await api.createProtocolCourse(alice, body)).toBe(course);
      const [path, options] = request.mock.lastCall!;
      expect(path).toBe("/v1/protocols/courses");
      expect(options).toEqual({ method: "POST", expectedUserId: alice, body });
      expect(schema.createCourseSchema!.parse(JSON.parse(JSON.stringify(options.body)))).toEqual(body);
    }
  });

  it("retains all response fields, missing values and the planned/actual distinction", () => {
    const manual = { ...doseLog, occurrenceId: null, planned: null };
    const previewDay = { ...day, previewOccurrences: [{
      courseId, compound, phaseId: course.phases[0]!.id, slotKey: "morning", scheduledAt: "2027-08-01T06:00:00.000Z",
      amount: "12.123456789012", unit: "mg", route: "IM",
    }] };
    for (const [name, value] of [["courseSchema", course], ["doseLogSchema", doseLog], ["doseLogSchema", manual], ["daySchema", previewDay]] as const) {
      expect(schema[name]!.parse(JSON.parse(JSON.stringify(value)))).toEqual(value);
    }
    expect(levelSchema.levelsResponseSchema!.parse(levels)).toEqual(levels);
    expect(trendsSchema.trendsSchema!.parse(trends)).toEqual(trends);
    const unavailable = { ...levels, series: [{ ...levels.series[0], status: "unavailable", unavailableReason: "missing_model", points: [], currentValue: null, normalization: null, clearance: null }] };
    expect(levelSchema.levelsResponseSchema!.parse(unavailable)).toEqual(unavailable);
    const detail: ApiProtocolCompoundDetail = {
      ...compound, regulatoryNote: "Formulation-specific context", evidenceSources: [], unavailableReason: null, amountMeaning: "modeled_dose_equivalent",
      models: [{ id: "d0000000-0000-4000-8000-000000000001", key: "fixture", route: "IM", version: 1, publishedAt: now,
        definition: { modelType: "FIRST_ORDER_ABSORPTION_ELIMINATION", parameters: { doseUnit: "mg", decayHalfLifeHours: 60, halfLifeBasis: "apparent_terminal", bioavailability: 1, bioavailabilityBasis: "dose_equivalent_convention", absorption: { kind: "time_to_peak", hours: 24 } } },
        explanation: "Estimate", limitations: "Not measured serum levels", sources: [{ title: "Fixture citation", url: "https://example.org/evidence", accessedOn: "2026-09-10", evidence: "Fixture evidence" }] }],
    };
    expect(pkSchema.compoundDetailSchema!.parse(detail)).toEqual(detail);
  });

  it("uses the published methods, path parameters, query keys, bodies and response shapes", async () => {
    const openapi = JSON.parse(readFileSync(new URL("docs/api/openapi.json", provider), "utf8"));
    const command = { operationId, expectedRevision: 2 };
    const configuration = { timezone: createInput.timezone, route: createInput.route, schedule: createInput.schedule };
    const view = { range: "1M", metric: "relative", anchorAt: now } as const;
    const draft = { ...configuration, ...command, startAt: createInput.startAt, endAt: null };
    const phase = { ...configuration, ...command, effectiveDate: "2026-09-11", futureChanges: "keep" } as const;
    const end = { ...command, endDate: "2026-09-12", timezone: createInput.timezone };
    const editLog = { ...command, actual: { ...logInput.actual, siteCode: null } };
    const preview = { phases: course.phases, startAt: course.startAt, endAt: now };
    const timePreview = { date: "2026-03-08", time: "02:30", timezone: "America/New_York" };
    const compare = { ...view, courseId, configuration };
    const levelsPreview = { ...createInput, ...view };
    const page = { after: courseId, limit: 25 };
    const sites: ApiProtocolSites = { sites: [], recent: [], recentRoutes: [] };
    const trendQuery = { metric: trends.metric, range: trends.range, end: trends.end, tz: trends.timezone };
    expect(trendsSchema.trendsQuerySchema!.parse(trendQuery)).toEqual(trendQuery);
    const operations: Array<{ call: () => Promise<unknown>; path: string; method?: string; body?: unknown; parser?: Parser; query?: unknown; result: unknown }> = [
      { call: () => api.getProtocolTrends(alice, trendQuery), path: "/trends", query: trendQuery, result: trends },
      { call: () => api.getProtocolNextDoses(alice, [courseId]), path: "/next-doses", query: { courseIds: courseId }, result: { evaluatedAt: now, courses: [{ courseId, nextDose: null }] } },
      { call: () => api.previewProtocolTime(alice, timePreview), path: "/time-preview", method: "POST", body: timePreview, parser: schema.protocolTimePreviewSchema, result: { at: "2026-03-08T07:30:00.000Z", disambiguation: "gap_forward_fold_earlier" } },
      { call: () => api.listProtocolCompounds(alice), path: "/compounds", result: { compounds: [compound] } },
      { call: () => api.getProtocolCompound(alice, compound.id), path: `/compounds/${compound.id}`, result: { ...compound, regulatoryNote: "", evidenceSources: [], models: [], unavailableReason: "Fixture without a model", amountMeaning: "modeled_dose_equivalent" } },
      { call: () => api.listProtocolCourses(alice, page), path: "/courses", query: page, result: { courses: [course], nextCursor: courseId } },
      { call: () => api.getProtocolCourse(alice, courseId), path: `/courses/${courseId}`, result: course },
      { call: () => api.createProtocolCourse(alice, createInput), path: "/courses", method: "POST", body: createInput, parser: schema.createCourseSchema, result: course },
      { call: () => api.editProtocolDraft(alice, courseId, draft), path: `/courses/${courseId}`, method: "PATCH", body: draft, parser: schema.editDraftSchema, result: course },
      { call: () => api.startProtocolCourse(alice, courseId, command), path: `/courses/${courseId}/start`, method: "POST", body: command, parser: schema.courseCommandSchema, result: course },
      { call: () => api.changeProtocolPhase(alice, courseId, phase), path: `/courses/${courseId}/phases`, method: "POST", body: phase, parser: schema.changePhaseSchema, result: course },
      { call: () => api.endProtocolCourse(alice, courseId, end), path: `/courses/${courseId}/end`, method: "POST", body: end, parser: schema.endCourseSchema, result: course },
      { call: () => api.deleteProtocolCourse(alice, courseId), path: `/courses/${courseId}`, method: "DELETE", result: { deleted: true } },
      { call: () => api.deleteAllProtocolData(alice), path: "/data", method: "DELETE", result: { deleted: true } },
      { call: () => api.getProtocolOccurrence(alice, occurrenceId, "Europe/Vilnius"), path: `/occurrences/${occurrenceId}`, query: { tz: "Europe/Vilnius" }, result: day.occurrences[0] },
      { call: () => api.getProtocolLog(alice, doseLog.id), path: `/logs/${doseLog.id}`, result: doseLog },
      { call: () => api.logProtocolOccurrence(alice, occurrenceId, logInput), path: `/occurrences/${occurrenceId}/log`, method: "POST", body: logInput, parser: schema.createLogSchema, result: doseLog },
      { call: () => api.createProtocolManualLog(alice, courseId, logInput), path: `/courses/${courseId}/log`, method: "POST", body: logInput, parser: schema.createLogSchema, result: { ...doseLog, occurrenceId: null, planned: null } },
      { call: () => api.editProtocolLog(alice, logId, editLog), path: `/logs/${logId}`, method: "PATCH", body: editLog, parser: schema.editLogSchema, result: doseLog },
      { call: () => api.deleteProtocolLog(alice, logId), path: `/logs/${logId}`, method: "DELETE", result: { deleted: true } },
      { call: () => api.listProtocolLogs(alice, courseId, page), path: `/courses/${courseId}/logs`, query: page, result: { logs: [doseLog], nextCursor: null } },
      { call: () => api.getProtocolSites(alice), path: "/sites", result: sites },
      { call: () => api.getProtocolDay(alice, { date: day.date, tz: day.timezone }), path: "/day", query: { date: day.date, tz: day.timezone }, result: day },
      { call: () => api.getProtocolHome(alice, { date: day.date, tz: day.timezone }), path: "/home", query: { date: day.date, tz: day.timezone }, result: day },
      { call: () => api.getProtocolCalendar(alice, { start: day.date, end: day.date, tz: day.timezone }), path: "/calendar", query: { start: day.date, end: day.date, tz: day.timezone }, result: { days: [], timezone: day.timezone, coverage: [] } },
      { call: () => api.getProtocolAnnotations(alice, { start: day.date, end: day.date, tz: day.timezone }), path: "/annotations", query: { start: day.date, end: day.date, tz: day.timezone, courseIds: undefined }, result: { timezone: day.timezone, courses: [], events: [] } },
      { call: () => api.previewProtocolSchedule(alice, preview), path: "/schedule-preview", method: "POST", body: preview, parser: schema.schedulePreviewSchema, result: { occurrences: [], disambiguation: "gap_forward_fold_earlier" } },
      { call: () => api.getProtocolLevels(alice, { ...view, courseIds: [courseId] }), path: "/levels", query: { ...view, courseIds: courseId }, result: levels },
      { call: () => api.compareProtocolLevels(alice, compare), path: "/levels/compare", method: "POST", body: compare, parser: levelSchema.compareLevelsSchema, result: levels },
      { call: () => api.previewProtocolLevels(alice, levelsPreview), path: "/levels/preview", method: "POST", body: levelsPreview, parser: levelSchema.previewLevelsSchema, result: levels },
    ];
    for (const operation of operations) {
      request.mockResolvedValueOnce(operation.result);
      expect(await operation.call()).toBe(operation.result);
      const [url, options] = request.mock.lastCall!;
      expect(url).toBe(`/v1/protocols${operation.path}`);
      expect(options.expectedUserId).toBe(alice);
      expect(options.method ?? "GET").toBe(operation.method ?? "GET");
      expect(options.body).toEqual(operation.body);
      expect(options.query).toEqual(operation.query);
      if (operation.parser) expect(operation.parser.parse(JSON.parse(JSON.stringify(options.body)))).toEqual(operation.body);
      const route = url.replace(/\/[0-9a-f-]{36}(?=\/|$)/g, "/{id}");
      const contract = openapi.paths[route]?.[(operation.method ?? "GET").toLowerCase()];
      expect(contract, route).toBeDefined();
      expect(contract.security).toEqual([{ supabaseAccessToken: [] }]);
      const queryNames = contract.parameters?.filter((p: { in: string }) => p.in === "query").map((p: { name: string }) => p.name) ?? [];
      for (const key of Object.keys(operation.query ?? {})) expect(queryNames).toContain(key);
    }
    expect(new Set(operations.map((operation) => `/v1/protocols${operation.path}`.replace(/\/[0-9a-f-]{36}(?=\/|$)/g, "/{id}"))))
      .toEqual(new Set(Object.keys(openapi.paths).filter((path) => path.startsWith("/v1/protocols/"))));
  });
});
