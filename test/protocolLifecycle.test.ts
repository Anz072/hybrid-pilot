import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppDataChangeEvent } from "../src/store/dataChangeEvents";
import { alice, bob, course, courseId, createInput, day, doseLog, levels, logInput, now, occurrenceId } from "./fixtures/protocols";
import { bloodworkInput,bloodworkPanel } from "./fixtures/bloodwork";
import { trends } from "./fixtures/protocolTrends";

const auth = vi.hoisted(() => ({ userId: "", token: "initial", refresh: vi.fn<() => Promise<string | null>>() }));
vi.mock("../src/API/supabase/client", () => ({
  SUPABASE_SESSION_REQUIRED_MESSAGE: "session required",
  getSupabaseSession: async () => auth.userId ? { access_token: auth.token, user: { id: auth.userId } } : null,
  getSupabaseSessionUser: async () => auth.userId ? { id: auth.userId } : null,
  refreshSupabaseSession: () => auth.refresh(),
}));
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const load = async () => {
  const [{ DB }, events, scope] = await Promise.all([
    import("../src/store/DB"), import("../src/store/dataChangeEvents"), import("../src/API/supabase/sessionScope"),
  ]);
  scope.observeAuthIdentity(alice);
  const seen: AppDataChangeEvent[] = [];
  events.subscribeToAppDataChanges((event) => seen.push(event));
  const switchTo = (id: string | null) => {
    auth.userId = id ?? ""; auth.token = id ?? "signed-out";
    scope.observeAuthIdentity(id, id === null);
  };
  return { DB, seen, switchTo };
};

beforeEach(() => {
  vi.resetModules();
  auth.userId = alice; auth.token = "initial"; auth.refresh.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Protocols facade → store → authenticated HTTP lifecycle", () => {
  it("refreshes Trends after accepted diary completion and weight changes without invalidating Levels", async () => {
    const { DB, seen, switchTo } = await load();
    const trendGate = deferred<Response>(); const levelsGate = deferred<Response>();
    const fetch = vi.fn().mockReturnValueOnce(trendGate.promise).mockReturnValueOnce(levelsGate.promise)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response({ date: trends.start, isComplete: true, completedAt: now }))
      .mockResolvedValueOnce(response(trends));
    vi.stubGlobal("fetch", fetch);
    const query = { metric: trends.metric, range: trends.range, end: trends.end, tz: trends.timezone };
    const previous = DB.getProtocolTrends(alice, query).catch((error: Error) => error);
    const unchangedLevels = DB.getProtocolLevels(alice, { courseIds: [courseId], range: "1M", metric: "relative" });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await expect(DB.saveDiaryDayStatus({ userExternalId: alice, date: trends.start, isComplete: true })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(seen).toEqual([]);
    await DB.saveDiaryDayStatus({ userExternalId: alice, date: trends.start, isComplete: true });
    expect(seen).toEqual([{ kind: "food_log", userExternalId: alice, date: trends.start, foodEntryId: undefined }]);
    expect(await DB.getProtocolTrends(alice, query)).toEqual(trends);
    trendGate.resolve(response(trends)); expect(await previous).toMatchObject({ name: "ProtocolReadSupersededError" });
    levelsGate.resolve(response(levels)); expect(await unchangedLevels).toEqual(levels);
    const weightGate = deferred<Response>(); fetch.mockReturnValueOnce(weightGate.promise).mockResolvedValueOnce(response({ deleted: true }));
    const oldWeight = DB.getProtocolTrends(alice, { ...query, metric: "weight" }).catch((error: Error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(6));
    await DB.clearAllWeightData(alice);
    weightGate.resolve(response(trends)); expect(await oldWeight).toMatchObject({ name: "ProtocolReadSupersededError" });
    expect(seen.at(-1)).toEqual({ kind: "weight", userExternalId: alice });
    switchTo(bob);
    await expect(DB.getProtocolTrends(alice, query)).rejects.toMatchObject({ name: "SessionChangedError" });
    expect(fetch).toHaveBeenCalledTimes(7);
  });
  it("clears pending bloodwork reads and refreshes settings only after whole-feature deletion succeeds", async () => {
    const { DB, seen, switchTo } = await load();
    const pending = deferred<Response>();
    const fetch = vi.fn().mockReturnValueOnce(pending.promise).mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(response({ deleted: true }));
    vi.stubGlobal("fetch", fetch);
    const previous = DB.getBloodworkPanel(alice, bloodworkPanel.id).catch((error: Error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await expect(DB.deleteAllProtocolData(alice)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(seen).toEqual([]);
    expect(await DB.deleteAllProtocolData(alice)).toEqual({ deleted: true });
    expect(seen).toEqual([{ kind: "settings", userExternalId: alice }]);
    pending.resolve(response(bloodworkPanel)); expect(await previous).toMatchObject({ name: "ProtocolReadSupersededError" });
    switchTo(bob);
    await expect(DB.deleteAllProtocolData(alice)).rejects.toMatchObject({ name: "SessionChangedError" });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("invalidates calendar reads only after accepted reminder saves and keeps failed commands retryable", async () => {
    const { DB, seen, switchTo } = await load();
    const input = { id: courseId, title: "Bloodwork", scheduledAt: now, timezone: "UTC" };
    const reminder = { ...input, revision: 1, createdAt: now, updatedAt: now };
    const oldRead = deferred<Response>();
    const fetch = vi.fn().mockReturnValueOnce(oldRead.promise).mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(response(reminder, 201)).mockResolvedValueOnce(response({ ...day, reminders: [reminder] }));
    vi.stubGlobal("fetch", fetch);
    const previous = DB.getProtocolDay(alice, { date: day.date, tz: day.timezone }).catch((error: Error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await expect(DB.createProtocolReminder(alice, input)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(seen).toEqual([]);
    expect(await DB.createProtocolReminder(alice, input)).toEqual(reminder);
    expect(fetch.mock.calls[1]![1].body).toBe(fetch.mock.calls[2]![1].body);
    expect(seen).toEqual([{ kind: "protocols", userExternalId: alice }]);
    expect((await DB.getProtocolDay(alice, { date: day.date, tz: day.timezone })).reminders).toEqual([reminder]);
    oldRead.resolve(response(day)); expect(await previous).toMatchObject({ name: "ProtocolReadSupersededError" });
    switchTo(bob);
    await expect(DB.getProtocolReminder(alice, reminder.id)).rejects.toMatchObject({ name: "SessionChangedError" });
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("refreshes bloodwork only after accepted writes and rejects a stale or old-account response", async () => {
    const { DB,seen,switchTo } = await load();
    const gate = deferred<Response>();
    const fetch = vi.fn().mockReturnValueOnce(gate.promise).mockResolvedValueOnce(response(bloodworkPanel,201)).mockResolvedValueOnce(response(bloodworkPanel));
    vi.stubGlobal("fetch",fetch);
    const old = DB.getBloodworkPanel(alice,bloodworkPanel.id).catch((error: Error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(seen).toEqual([]);
    expect(await DB.createBloodworkPanel(alice,bloodworkInput)).toEqual(bloodworkPanel);
    expect(seen).toEqual([{ kind: "bloodwork",userExternalId: alice }]);
    expect(await DB.getBloodworkPanel(alice,bloodworkPanel.id)).toEqual(bloodworkPanel);
    gate.resolve(response(bloodworkPanel));
    expect(await old).toMatchObject({ name: "ProtocolReadSupersededError" });
    switchTo(bob);
    await expect(DB.createBloodworkPanel(alice,bloodworkInput)).rejects.toMatchObject({ name: "SessionChangedError" });
    expect(fetch).toHaveBeenCalledTimes(3); expect(seen).toHaveLength(1);
  });
  it("shares only pending reads and separates date, zone, selection and account", async () => {
    const { DB, switchTo } = await load();
    const gate = deferred<Response>();
    const fetch = vi.fn().mockImplementation(() => gate.promise);
    vi.stubGlobal("fetch", fetch);
    // Separate Response instances are needed when two independent reads consume JSON.
    fetch.mockImplementation(async () => (await gate.promise).clone());
    const query = { date: day.date, tz: day.timezone };
    const first = DB.getProtocolDay(alice, query);
    const joined = DB.getProtocolDay(alice, query);
    expect(first).toBe(joined);
    const otherDate = DB.getProtocolDay(alice, { ...query, date: "2026-09-09" });
    const otherZone = DB.getProtocolDay(alice, { ...query, tz: "UTC" });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    gate.resolve(response(day));
    await Promise.all([first, joined, otherDate, otherZone]);
    await DB.getProtocolDay(alice, query);
    expect(fetch).toHaveBeenCalledTimes(4);
    await DB.getProtocolLevels(alice, { courseIds: [courseId], range: "1M", metric: "relative" });
    await DB.getProtocolLevels(alice, { courseIds: [courseId], range: "1W", metric: "relative" });
    switchTo(bob);
    await DB.getProtocolDay(bob, query);
    expect(fetch).toHaveBeenCalledTimes(7);
  });

  it("emits only accepted writes, prevents old read reuse, and preserves planned versus actual decimals", async () => {
    const { DB, seen } = await load();
    const oldRead = deferred<Response>(); const write = deferred<Response>();
    const fetch = vi.fn().mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(write.promise).mockResolvedValueOnce(response(day));
    vi.stubGlobal("fetch", fetch);
    const query = { date: day.date, tz: day.timezone };
    const previous = DB.getProtocolDay(alice, query).catch((error: Error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const saved = DB.logProtocolOccurrence(alice, occurrenceId, logInput);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(seen).toEqual([]);
    write.resolve(response(doseLog, 201));
    expect(await saved).toEqual(doseLog);
    expect(seen).toEqual([{ kind: "protocols", userExternalId: alice }]);
    expect(await DB.getProtocolDay(alice, query)).toEqual(day);
    oldRead.resolve(response({ ...day, occurrences: [] }));
    expect(await previous).toMatchObject({ name: "ProtocolReadSupersededError" });
    const sent = JSON.parse(fetch.mock.calls[1]![1].body);
    expect(sent).toEqual(logInput);
    expect(sent.actual.amount).toBe("11.987654321012");
    expect(doseLog.planned?.amount).toBe("12.123456789012");
  });

  it("retains the original command on response loss, never retries automatically, and surfaces conflicts", async () => {
    const { DB, seen } = await load();
    const input = structuredClone(createInput);
    const fetch = vi.fn().mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(response(course, 201))
      .mockResolvedValueOnce(response({ error: { code: "CONFLICT", message: "Changed elsewhere" } }, 409));
    vi.stubGlobal("fetch", fetch);
    await expect(DB.createProtocolCourse(alice, input)).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(fetch).toHaveBeenCalledTimes(1); expect(seen).toEqual([]);
    expect(await DB.createProtocolCourse(alice, input)).toEqual(course);
    expect(fetch.mock.calls[0]![1].body).toBe(fetch.mock.calls[1]![1].body);
    expect(input).toEqual(createInput);
    await expect(DB.createProtocolCourse(alice, input)).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    expect(seen).toHaveLength(1);
  });

  it("rejects another account before a create, after a pending response, and across A → B → A", async () => {
    const { DB, seen, switchTo } = await load();
    const first = deferred<Response>(); const second = deferred<Response>();
    const fetch = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    vi.stubGlobal("fetch", fetch);
    switchTo(bob);
    await expect(DB.createProtocolCourse(alice, createInput)).rejects.toMatchObject({ name: "SessionChangedError" });
    expect(fetch).not.toHaveBeenCalled();
    switchTo(alice);
    const save = DB.createProtocolCourse(alice, createInput).catch((error: Error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    switchTo(bob); first.resolve(response(course, 201));
    expect(await save).toMatchObject({ name: "SessionChangedError" });
    switchTo(alice);
    const read = DB.getProtocolCourse(alice, courseId).catch((error: Error) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    switchTo(null); switchTo(alice); second.resolve(response(course));
    expect(await read).toMatchObject({ name: "SessionChangedError" });
    expect(seen).toEqual([]);
  });

  it("retries expired-token writes once with the checked account and never with a replacement account", async () => {
    const { DB, seen, switchTo } = await load();
    const expired = () => response({ error: { code: "AUTH_TOKEN_EXPIRED" } }, 401);
    const fetch = vi.fn().mockResolvedValueOnce(expired()).mockResolvedValueOnce(response(course, 201)).mockResolvedValueOnce(expired());
    vi.stubGlobal("fetch", fetch);
    auth.refresh.mockImplementationOnce(async () => { auth.token = "renewed"; return auth.token; });
    expect(await DB.createProtocolCourse(alice, createInput)).toEqual(course);
    expect(fetch.mock.calls[1]![1].headers.authorization).toBe("Bearer renewed");
    auth.refresh.mockImplementationOnce(async () => { switchTo(bob); return auth.token; });
    await expect(DB.createProtocolCourse(alice, createInput)).rejects.toMatchObject({ name: "SessionChangedError" });
    expect(fetch).toHaveBeenCalledTimes(3); expect(seen).toHaveLength(1);
  });

  it("keeps settings server-owned and emits no write events for previews or Compare", async () => {
    const { DB, seen } = await load();
    const settings = {
      protocolsEnabled: true, protocolsIntroSeenAt: now, foodDiaryStartHour: 6, foodDiaryEndHour: 22,
      dailyCalorieOverrides: null, adaptiveCaloriesEnabled: false, adaptiveMode: "recommend", adaptiveLastCalculatedAt: null,
      createdAt: now, updatedAt: now,
    };
    const fetch = vi.fn().mockResolvedValueOnce(response(settings))
      .mockResolvedValueOnce(response(levels)).mockResolvedValueOnce(response(levels))
      .mockResolvedValueOnce(response({ occurrences: [], disambiguation: "gap_forward_fold_earlier" }))
      .mockRejectedValueOnce(new Error("outage"));
    vi.stubGlobal("fetch", fetch);
    const saved = await DB.saveUserSettings({ userExternalId: alice, protocolsEnabled: true, protocolsIntroSeenAt: now });
    expect(saved).toMatchObject({ userExternalId: alice, protocolsEnabled: true, protocolsIntroSeenAt: now });
    expect(JSON.parse(fetch.mock.calls[0]![1].body)).toEqual({ protocolsEnabled: true, protocolsIntroSeenAt: now });
    expect(seen).toEqual([{ kind: "settings", userExternalId: alice }]);
    const view = { range: "1M", metric: "relative" } as const;
    await DB.previewProtocolLevels(alice, { ...createInput, ...view });
    await DB.compareProtocolLevels(alice, { courseId, configuration: { timezone: createInput.timezone, route: createInput.route, schedule: createInput.schedule }, ...view });
    await DB.previewProtocolSchedule(alice, { phases: course.phases, startAt: course.startAt, endAt: now });
    expect(seen).toHaveLength(1);
    await expect(DB.saveUserSettings({ userExternalId: alice, protocolsEnabled: false })).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(seen).toHaveLength(1);
  });
});
