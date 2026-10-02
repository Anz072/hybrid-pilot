import { apiRequest } from "./client";
import type * as T from "./protocolTypes";

const root = "/v1/protocols";
const idPath = (collection: string, id: string) => `${root}/${collection}/${encodeURIComponent(id)}`;

export const previewProtocolTime = (userId: string, body: T.ProtocolTimePreviewInput): Promise<T.ApiProtocolTimePreview> =>
  apiRequest(`${root}/time-preview`, { method: "POST", body, expectedUserId: userId });

// expectedUserId stays in client options: only the verified JWT owns records.
// Stable create/operation IDs come from the form and survive a manual retry.
export const listProtocolCompounds = (userId: string): Promise<{ compounds: T.ApiProtocolCompound[] }> =>
  apiRequest(`${root}/compounds`, { expectedUserId: userId });
export const getProtocolCompound = (userId: string, id: string): Promise<T.ApiProtocolCompoundDetail> =>
  apiRequest(idPath("compounds", id), { expectedUserId: userId });
export const previewProtocolSchedule = (userId: string, body: T.ProtocolSchedulePreviewInput): Promise<T.ApiProtocolSchedulePreview> =>
  apiRequest(`${root}/schedule-preview`, { method: "POST", body, expectedUserId: userId });
export const listProtocolCourses = (userId: string, query: T.ProtocolCoursePageQuery = {}): Promise<T.ApiProtocolCoursePage> =>
  apiRequest(`${root}/courses`, { query, expectedUserId: userId });
export const getProtocolCourse = (userId: string, id: string): Promise<T.ApiProtocolCourse> =>
  apiRequest(idPath("courses", id), { expectedUserId: userId });
export const createProtocolCourse = (userId: string, body: T.CreateProtocolCourseInput): Promise<T.ApiProtocolCourse> =>
  apiRequest(`${root}/courses`, { method: "POST", body, expectedUserId: userId });
export const editProtocolDraft = (userId: string, id: string, body: T.EditProtocolDraftInput): Promise<T.ApiProtocolCourse> =>
  apiRequest(idPath("courses", id), { method: "PATCH", body, expectedUserId: userId });
export const startProtocolCourse = (userId: string, id: string, body: T.ProtocolCommand): Promise<T.ApiProtocolCourse> =>
  apiRequest(`${idPath("courses", id)}/start`, { method: "POST", body, expectedUserId: userId });
export const changeProtocolPhase = (userId: string, id: string, body: T.ChangeProtocolPhaseInput): Promise<T.ApiProtocolCourse> =>
  apiRequest(`${idPath("courses", id)}/phases`, { method: "POST", body, expectedUserId: userId });
export const endProtocolCourse = (userId: string, id: string, body: T.EndProtocolCourseInput): Promise<T.ApiProtocolCourse> =>
  apiRequest(`${idPath("courses", id)}/end`, { method: "POST", body, expectedUserId: userId });
export const deleteProtocolCourse = (userId: string, id: string): Promise<{ deleted: true }> =>
  apiRequest(idPath("courses", id), { method: "DELETE", expectedUserId: userId });
export const getProtocolOccurrence = (userId: string, id: string, tz: string): Promise<T.ApiProtocolOccurrence> =>
  apiRequest(idPath("occurrences", id), { query: { tz }, expectedUserId: userId });
export const logProtocolOccurrence = (userId: string, id: string, body: T.CreateProtocolLogInput): Promise<T.ApiProtocolDoseLog> =>
  apiRequest(`${idPath("occurrences", id)}/log`, { method: "POST", body, expectedUserId: userId });
export const createProtocolManualLog = (userId: string, id: string, body: T.CreateProtocolLogInput): Promise<T.ApiProtocolDoseLog> =>
  apiRequest(`${idPath("courses", id)}/log`, { method: "POST", body, expectedUserId: userId });
export const editProtocolLog = (userId: string, id: string, body: T.EditProtocolLogInput): Promise<T.ApiProtocolDoseLog> =>
  apiRequest(idPath("logs", id), { method: "PATCH", body, expectedUserId: userId });
export const getProtocolLog = (userId: string, id: string): Promise<T.ApiProtocolDoseLog> =>
  apiRequest(idPath("logs", id), { expectedUserId: userId });
export const deleteProtocolLog = (userId: string, id: string): Promise<{ deleted: true }> =>
  apiRequest(idPath("logs", id), { method: "DELETE", expectedUserId: userId });
export const listProtocolLogs = (userId: string, id: string, query: T.ProtocolPageQuery = {}): Promise<T.ApiProtocolLogPage> =>
  apiRequest(`${idPath("courses", id)}/logs`, { query, expectedUserId: userId });
export const getProtocolSites = (userId: string): Promise<T.ApiProtocolSites> =>
  apiRequest(`${root}/sites`, { expectedUserId: userId });
export const getProtocolNextDoses = (userId: string, courseIds: string[]): Promise<T.ApiProtocolNextDoses> =>
  apiRequest(`${root}/next-doses`, { query: { courseIds: courseIds.join(",") }, expectedUserId: userId });
export const getProtocolDay = (userId: string, query: T.ProtocolDayQuery): Promise<T.ApiProtocolDay> =>
  apiRequest(`${root}/day`, { query, expectedUserId: userId });
export const getProtocolHome = (userId: string, query: T.ProtocolDayQuery): Promise<T.ApiProtocolDay> =>
  apiRequest(`${root}/home`, { query, expectedUserId: userId });
export const getProtocolCalendar = (userId: string, query: T.ProtocolCalendarQuery): Promise<T.ApiProtocolCalendar> =>
  apiRequest(`${root}/calendar`, { query, expectedUserId: userId });
export const getProtocolLevels = (userId: string, query: T.ProtocolLevelsQuery): Promise<T.ApiProtocolLevels> =>
  apiRequest(`${root}/levels`, { query: { ...query, courseIds: query.courseIds.join(",") }, expectedUserId: userId });
export const compareProtocolLevels = (userId: string, body: T.CompareProtocolLevelsInput): Promise<T.ApiProtocolLevels> =>
  apiRequest(`${root}/levels/compare`, { method: "POST", body, expectedUserId: userId });
export const previewProtocolLevels = (userId: string, body: T.PreviewProtocolLevelsInput): Promise<T.ApiProtocolLevels> =>
  apiRequest(`${root}/levels/preview`, { method: "POST", body, expectedUserId: userId });
export const getProtocolAnnotations = (userId: string,query: { start: string; end: string; tz: string; courseIds?: string[] }): Promise<T.ApiProtocolAnnotations> =>
  apiRequest("/v1/protocols/annotations",{ query: { ...query,courseIds: query.courseIds?.join(",") },expectedUserId: userId });
export const getProtocolReminder = (userId: string,id: string): Promise<T.ApiProtocolReminder> =>
  apiRequest(`/v1/protocol-reminders/${encodeURIComponent(id)}`,{ expectedUserId: userId });
export const createProtocolReminder = (userId: string,body: T.CreateProtocolReminderInput): Promise<T.ApiProtocolReminder> =>
  apiRequest("/v1/protocol-reminders",{ method: "POST",body,expectedUserId: userId });
export const editProtocolReminder = (userId: string,id: string,body: T.EditProtocolReminderInput): Promise<T.ApiProtocolReminder> =>
  apiRequest(`/v1/protocol-reminders/${encodeURIComponent(id)}`,{ method: "PATCH",body,expectedUserId: userId });
export const deleteProtocolReminder = (userId: string,id: string,expectedRevision: number): Promise<{ deleted: true }> =>
  apiRequest(`/v1/protocol-reminders/${encodeURIComponent(id)}`,{ method: "DELETE",query: { expectedRevision },expectedUserId: userId });
export const deleteAllProtocolData = (userId: string): Promise<{ deleted: true }> =>
  apiRequest(`${root}/data`, { method: "DELETE", expectedUserId: userId });
export const getProtocolTrends = (userId: string, query: T.ProtocolTrendsQuery): Promise<T.ApiProtocolTrends> =>
  apiRequest(`${root}/trends`, { query, expectedUserId: userId });
