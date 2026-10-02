import * as api from "../API/nouri/protocolsApi";
import { coalesce } from "../API/nouri/coalesce";
import { assertAuthSessionGeneration, getAuthSessionGeneration } from "../API/supabase/sessionScope";

// No settled data is retained. A successful write advances the pending-read
// key so refreshes cannot join a request that began before that write.
let revision = 0;
export const invalidateProtocolReads = (): void => { revision += 1; };
let metricRevision = 0;
export const invalidateProtocolMetricReads = (): void => { metricRevision += 1; };

export class ProtocolReadSupersededError extends Error {
  constructor() {
    super("Protocols changed while loading. Refresh to see the latest data.");
    this.name = "ProtocolReadSupersededError";
  }
}

const read = <A extends unknown[], T>(name: string, request: (userId: string, ...args: A) => Promise<T>, includesMetrics = false) =>
  (userId: string, ...args: A): Promise<T> => {
    const session = getAuthSessionGeneration();
    const startedAt = revision;
    const metricsAt = includesMetrics ? metricRevision : null;
    const key = JSON.stringify(["protocols", session, userId, startedAt, metricsAt, name, args]);
    return coalesce(key, async () => {
      const result = await request(userId, ...args);
      assertAuthSessionGeneration(session);
      if (revision !== startedAt || (includesMetrics && metricsAt !== metricRevision)) throw new ProtocolReadSupersededError();
      return result;
    });
  };

const write = <A extends unknown[], T>(request: (userId: string, ...args: A) => Promise<T>) =>
  async (userId: string, ...args: A): Promise<T> => {
    const result = await request(userId, ...args);
    invalidateProtocolReads();
    return result;
  };

// Bloodwork is part of Protocols and shares this transient account/generation
// boundary. Keep one invalidation mechanism, without a settled data cache.
export { read as readProtocolResource, write as writeProtocolResource };

export const listProtocolCompounds = read("compounds", api.listProtocolCompounds);
export const getProtocolCompound = read("compound", api.getProtocolCompound);
export const listProtocolCourses = read("courses", api.listProtocolCourses);
export const getProtocolCourse = read("course", api.getProtocolCourse);
export const getProtocolOccurrence = read("occurrence", api.getProtocolOccurrence);
export const getProtocolLog = read("log", api.getProtocolLog);
export const listProtocolLogs = read("logs", api.listProtocolLogs);
export const getProtocolSites = read("sites", api.getProtocolSites);
export const getProtocolNextDoses = read("nextDoses", api.getProtocolNextDoses);
export const getProtocolDay = read("day", api.getProtocolDay);
export const getProtocolHome = read("home", api.getProtocolHome);
export const getProtocolCalendar = read("calendar", api.getProtocolCalendar);
export const getProtocolAnnotations = read("annotations", api.getProtocolAnnotations);
export const getProtocolReminder = read("reminder",api.getProtocolReminder);
export const createProtocolReminder = write(api.createProtocolReminder);
export const editProtocolReminder = write(api.editProtocolReminder);
export const deleteProtocolReminder = write(api.deleteProtocolReminder);
export const getProtocolLevels = read("levels", api.getProtocolLevels);
export const getProtocolTrends = read("trends", api.getProtocolTrends, true);
// These POST projections are reads: no invalidation or accepted-write event.
export const previewProtocolSchedule = read("schedulePreview", api.previewProtocolSchedule);
export const previewProtocolTime = read("timePreview", api.previewProtocolTime);
export const compareProtocolLevels = read("compare", api.compareProtocolLevels);
export const previewProtocolLevels = read("levelsPreview", api.previewProtocolLevels);
export const createProtocolCourse = write(api.createProtocolCourse);
export const editProtocolDraft = write(api.editProtocolDraft);
export const startProtocolCourse = write(api.startProtocolCourse);
export const changeProtocolPhase = write(api.changeProtocolPhase);
export const endProtocolCourse = write(api.endProtocolCourse);
export const deleteProtocolCourse = write(api.deleteProtocolCourse);
export const deleteAllProtocolData = write(api.deleteAllProtocolData);
export const logProtocolOccurrence = write(api.logProtocolOccurrence);
export const createProtocolManualLog = write(api.createProtocolManualLog);
export const editProtocolLog = write(api.editProtocolLog);
export const deleteProtocolLog = write(api.deleteProtocolLog);
