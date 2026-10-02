import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { localAuth, requireLocalBackend, type LocalSession } from "./localBackend";

let current: LocalSession | null = null;
vi.mock("../../src/API/supabase/client", () => ({
  SUPABASE_SESSION_REQUIRED_MESSAGE: "session required",
  getSupabaseSession: async () => current,
  getSupabaseSessionUser: async () => current?.user ?? null,
  refreshSupabaseSession: async () => {
    current = await localAuth("/token?grant_type=refresh_token", { refresh_token: current?.refresh_token });
    return current.access_token;
  },
}));

// Real mobile facade/store/client → loopback HTTP → JWT verification → UserDb
// → freshly migrated Supabase. Only SecureStore/session retrieval is replaced.
describe.skipIf(process.env.RUN_PROTOCOLS_E2E !== "1")("Protocols mobile data flow over real local HTTP", () => {
  it("round-trips courses, actual history, Levels, Compare and bloodwork with owned server values", async () => {
    requireLocalBackend();
    const { DB } = await import("../../src/store/DB");
    const { observeAuthIdentity } = await import("../../src/API/supabase/sessionScope");
    const a = await localAuth("/signup", { email: `protocol-a-${randomUUID()}@nouri.test`, password: "LocalIntegration!Pass1" });
    const b = await localAuth("/signup", { email: `protocol-b-${randomUUID()}@nouri.test`, password: "LocalIntegration!Pass1" });
    const switchTo = (session: LocalSession) => { current = session; observeAuthIdentity(session.user.id); };
    switchTo(a);
    const owner = a.user.id;
    const now = new Date();
    const date = (offset: number) => new Date(now.getTime() + offset * 86_400_000).toISOString().slice(0, 10);
    expect((await DB.getUser())?.externalId).toBe(owner);
    const settings = await DB.saveUserSettings({ userExternalId: owner, protocolsEnabled: true, protocolsIntroSeenAt: now.toISOString() });
    expect(settings?.protocolsEnabled).toBe(true);
    expect((await DB.getUserSettings(owner))?.protocolsIntroSeenAt).toBe(now.toISOString());
    const weightId = randomUUID();
    await DB.saveWeightEntry({ id: weightId, clientGeneratedId: weightId, userExternalId: owner,
      measuredAt: `${date(-1)}T10:00:00.000Z`, measuredAtLocalIso: `${date(-1)}T10:00:00`, zoneOffsetMinutes: 0,
      valueKg: 80.25, valueOriginal: 80.25, unitOriginal: "kg", source: "manual" });
    await DB.addQuickAddFoodLog({ userExternalId: owner, date: date(-1), calories: 2100, proteinG: 140, carbsG: 250, fatG: 60 });
    const nutritionQuery = { metric: "calories", range: "1W", end: date(0), tz: "UTC" } as const;
    expect((await DB.getProtocolTrends(owner, nutritionQuery)).points.find((point) => point.date === date(-1))).toMatchObject({ value: null, recordedValue: 2100, isComplete: false });
    await DB.saveDiaryDayStatus({ userExternalId: owner, date: date(-1), isComplete: true });
    const nutritionTrend = await DB.getProtocolTrends(owner, nutritionQuery);
    expect(nutritionTrend.points.find((point) => point.date === date(-1))).toMatchObject({ value: 2100, recordedValue: 2100, coverage: 1, isComplete: true });
    const weightQuery = { ...nutritionQuery, metric: "weight", range: "All" } as const;
    const weightTrend = await DB.getProtocolTrends(owner, weightQuery);
    expect(weightTrend.points).toEqual([{ date: date(-1), value: 80.25, recordedValue: 80.25, coverage: 1, isComplete: null, sourceId: weightId }]);
    const { compounds } = await DB.listProtocolCompounds(owner);
    const compound = compounds.find((item) => item.id === "c0000000-0000-4000-8000-000000000001")!;
    expect(compound).toBeDefined();
    expect((await DB.getProtocolCompound(owner, compound.id)).models.length).toBeGreaterThan(0);

    const draft = await DB.createProtocolCourse(owner, {
      id: randomUUID(), compoundId: compound.id, timezone: "UTC", route: "IM", startAt: `${date(-2)}T00:00:00.000Z`, endAt: null,
      schedule: { kind: "daily", doses: [{ key: "morning", time: "09:00", amount: "1.123456789012", unit: "mg" }] },
    });
    expect(draft.status).toBe("DRAFT");
    const preview = await DB.previewProtocolSchedule(owner, { phases: draft.phases, startAt: draft.startAt, endAt: `${date(1)}T00:00:00.000Z` });
    expect(preview.occurrences).toHaveLength(3);
    expect((await DB.listProtocolLogs(owner, draft.id)).logs).toEqual([]);
    const active = await DB.startProtocolCourse(owner, draft.id, { operationId: randomUUID(), expectedRevision: draft.revision });
    expect(active.status).toBe("ACTIVE");
    const next = await DB.getProtocolNextDoses(owner, [active.id]);
    expect(next.courses[0]?.nextDose?.occurrenceId).toBeTruthy();
    expect(next.courses[0]?.nextDose?.planned.amount).toBe("1.123456789012");
    const yesterday = await DB.getProtocolDay(owner, { date: date(-1), tz: "UTC" });
    const planned = yesterday.occurrences.find((item) => item.courseId === active.id)!;
    expect(planned.state).toBe("unlogged"); expect(planned.canLog).toBe(true);
    const logInput = { id: randomUUID(), actual: { at: `${date(-1)}T10:17:00.000Z`, amount: "0.987654321012", unit: "mg", route: "IM", siteCode: "left_delt" } } as const;
    const logged = await DB.logProtocolOccurrence(owner, planned.id, logInput);
    expect(logged.actual).toEqual(logInput.actual);
    expect(logged.planned).toEqual(planned.planned);
    expect(await DB.getProtocolLog(owner, logged.id)).toEqual(logged);
    expect(await DB.logProtocolOccurrence(owner, planned.id, logInput)).toEqual(logged);
    expect((await DB.getProtocolOccurrence(owner, planned.id, "UTC")).state).toBe("completed");
    expect((await DB.getProtocolSites(owner)).recent.some((site) => site.code === "left_delt")).toBe(true);

    const view = { range: "1M", metric: "relative" } as const;
    const levels = await DB.getProtocolLevels(owner, { courseIds: [active.id], ...view });
    expect(levels.series[0]?.status).toBe("ready");
    expect(levels.series[0]?.history.actualCount).toBe(1);
    expect(levels.series[0]?.doseMarkers.find((marker) => marker.amount === logged.actual.amount && marker.kind === "actual"))
      .toMatchObject({ level: { amount: 0, relative: 0 } }); // First Bateman administration, before any absorption.
    const configuration = { timezone: "UTC", route: "IM", schedule: { kind: "every_n_days", intervalDays: 3, anchorDate: date(0), doses: [{ key: "morning", time: "10:00", amount: "2.25", unit: "mg" }] } } as const;
    const before = await DB.getProtocolCourse(owner, active.id);
    const comparison = await DB.compareProtocolLevels(owner, { courseId: active.id, ...view, configuration: { ...configuration, schedule: { ...configuration.schedule, doses: [...configuration.schedule.doses] } } });
    expect(comparison.series).toHaveLength(2);
    expect(await DB.getProtocolCourse(owner, active.id)).toEqual(before);
    expect((await DB.listProtocolLogs(owner, active.id)).logs).toEqual([logged]);

    const changed = await DB.changeProtocolPhase(owner, active.id, {
      ...configuration, schedule: { ...configuration.schedule, doses: [...configuration.schedule.doses] },
      operationId: randomUUID(), expectedRevision: before.revision, effectiveDate: date(1), futureChanges: "keep",
    });
    expect(changed.phases).toHaveLength(2);
    expect((await DB.getProtocolOccurrence(owner, planned.id, "UTC")).planned).toEqual(planned.planned);
    const edited = await DB.editProtocolLog(owner, logged.id, { operationId: randomUUID(), expectedRevision: logged.revision, actual: { ...logged.actual, amount: "0.875", siteCode: null } });
    expect(edited.planned).toEqual(planned.planned); expect(edited.actual.amount).toBe("0.875");

    const { biomarkers } = await DB.listBiomarkers(owner);
    const marker = biomarkers.find((item) => item.slug === "testosterone-total")!;
    const bloodwork = await DB.createBloodworkPanel(owner, { id: randomUUID(),collectedOn: date(-1),labName: null,
      results: [{ biomarkerId: marker.id,rawValue: "530.000000000001",rawUnit: "ng/dL",referenceLow: "0",referenceHigh: "900",referenceUnit: "ng/dL" }] });
    expect(bloodwork.results[0]?.canonicalValue).toBe("18.3910000000000347");
    await DB.setBiomarkerDisplayUnit(owner,marker.id,"ng/dL");
    expect((await DB.getBloodworkPanel(owner,bloodwork.id)).results[0]?.display).toEqual({ value: "530.000000000001",unit: "ng/dL",referenceLow: "0",referenceHigh: "900" });
    const correctedPanel = await DB.editBloodworkPanel(owner,bloodwork.id,{ operationId: randomUUID(),expectedRevision: bloodwork.revision,labName: "Laboratory" });
    expect(correctedPanel.results[0]?.rawValue).toBe("530.000000000001");
    const markerHistory = await DB.getBloodworkHistory(owner, marker.id, { displayUnit: "ng/dL", limit: 1 });
    expect(markerHistory.results[0]).toMatchObject({ panelId: bloodwork.id, collectedOn: date(-1), display: { value: "530.000000000001", referenceLow: "0" } });
    const annotations = await DB.getProtocolAnnotations(owner, { start: date(-2), end: date(2), tz: "UTC", courseIds: [active.id] });
    expect(annotations.events.map((event) => event.kind)).toEqual(["start", "change"]);
    const reminder = await DB.createProtocolReminder(owner, { id: randomUUID(), title: "Bloodwork", scheduledAt: `${date(0)}T10:00:00.000Z`, timezone: "UTC" });
    expect((await DB.getProtocolDay(owner, { date: date(0), tz: "UTC" })).reminders).toEqual([reminder]);
    expect((await DB.getProtocolHome(owner, { date: date(0), tz: "UTC" })).reminders).toEqual([]);
    const correctedReminder = await DB.editProtocolReminder(owner, reminder.id, { operationId: randomUUID(), expectedRevision: reminder.revision, title: "Lab", scheduledAt: `${date(1)}T10:00:00.000Z`, timezone: "UTC" });
    expect((await DB.getProtocolDay(owner, { date: date(0), tz: "UTC" })).reminders).toEqual([]);

    switchTo(b);
    expect((await DB.getProtocolTrends(b.user.id, weightQuery)).points).toEqual([]);
    expect((await DB.getProtocolTrends(b.user.id, nutritionQuery)).points).toEqual([]);
    await expect(DB.getProtocolCourse(b.user.id, active.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(DB.getProtocolNextDoses(b.user.id, [active.id])).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(DB.getProtocolLog(b.user.id, logged.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(DB.getProtocolLevels(b.user.id, { courseIds: [active.id], ...view })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(DB.getBloodworkPanel(b.user.id,bloodwork.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(DB.deleteBloodworkPanel(b.user.id,bloodwork.id,correctedPanel.revision)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(DB.getProtocolReminder(b.user.id, reminder.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect((await DB.getBloodworkHistory(b.user.id, marker.id)).results).toEqual([]);
    await expect(DB.getProtocolAnnotations(b.user.id, { start: date(-2), end: date(2), tz: "UTC", courseIds: [active.id] })).rejects.toMatchObject({ code: "NOT_FOUND" });
    switchTo(a);
    await DB.deleteProtocolLog(owner, logged.id);
    expect((await DB.getProtocolOccurrence(owner, planned.id, "UTC")).state).toBe("unlogged");
    const ended = await DB.endProtocolCourse(owner, active.id, { operationId: randomUUID(), expectedRevision: changed.revision, endDate: date(0), timezone: "UTC" });
    expect(ended.endAt).toBe(`${date(1)}T00:00:00.000Z`);
    await DB.deleteProtocolCourse(owner, active.id);
    expect((await DB.listProtocolCourses(owner)).courses).toEqual([]);
    expect((await DB.listBloodworkPanels(owner)).panels[0]?.id).toBe(bloodwork.id);
    await DB.deleteBloodworkPanel(owner,bloodwork.id,correctedPanel.revision);
    expect((await DB.listBloodworkPanels(owner)).panels).toEqual([]);
    expect((await DB.getProtocolReminder(owner, reminder.id)).revision).toBe(correctedReminder.revision);
    await DB.deleteProtocolReminder(owner, reminder.id, correctedReminder.revision);
    expect((await DB.getProtocolDay(owner, { date: date(1), tz: "UTC" })).reminders).toEqual([]);
    expect((await DB.getUserSettings(owner))?.protocolsEnabled).toBe(true);
    expect(await DB.saveUserSettings({ userExternalId: owner, protocolsEnabled: false })).toMatchObject({ protocolsEnabled: false });
    await DB.createProtocolCourse(owner, { id: randomUUID(), compoundId: compound.id, startAt: draft.startAt, endAt: null, ...configuration, schedule: { ...configuration.schedule, doses: [...configuration.schedule.doses] } });
    await DB.createBloodworkPanel(owner, { id: randomUUID(), collectedOn: date(0), labName: null, results: [{ biomarkerId: marker.id, rawValue: "600.00", rawUnit: "ng/dL", referenceLow: null, referenceHigh: null, referenceUnit: null }] });
    await DB.createProtocolReminder(owner, { id: randomUUID(), title: "Bloodwork", scheduledAt: `${date(1)}T08:00:00.000Z`, timezone: "UTC" });
    expect(await DB.deleteAllProtocolData(owner)).toEqual({ deleted: true });
    expect((await DB.listProtocolCourses(owner)).courses).toEqual([]);
    expect((await DB.listBloodworkPanels(owner)).panels).toEqual([]);
    expect((await DB.getProtocolDay(owner, { date: date(1), tz: "UTC" })).reminders).toEqual([]);
    expect(await DB.getUserSettings(owner)).toMatchObject({ protocolsEnabled: false, protocolsIntroSeenAt: null });
    expect(await DB.getProtocolTrends(owner, weightQuery)).toEqual(weightTrend);
    expect(await DB.getProtocolTrends(owner, nutritionQuery)).toEqual(nutritionTrend);
  }, { timeout: 45_000 });
});
