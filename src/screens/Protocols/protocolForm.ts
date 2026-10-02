import type { ProtocolDoseUnit, ProtocolPhaseConfiguration, ProtocolRoute, ProtocolSchedule } from "../../domain/types";
import type { ApiProtocolCourse, ApiProtocolTimePreview, ProtocolTimePreviewInput } from "../../API/nouri/protocolTypes";

export const protocolWeekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const protocolScheduleKinds: Array<{ value: ProtocolSchedule["kind"]; label: string }> = [
  { value: "daily", label: "Daily" }, { value: "every_n_days", label: "Every N days" },
  { value: "every_n_hours", label: "Every N hours" }, { value: "specific_weekdays", label: "Specific weekdays" },
  { value: "one_time", label: "One time" }, { value: "as_needed", label: "As needed" },
];
export type ProtocolDoseField = { key: string; time: string; amount: string; unit: ProtocolDoseUnit; weekday: number };
export type ProtocolConfigurationDraft = {
  timezone: string; route: ProtocolRoute; kind: ProtocolSchedule["kind"];
  interval: string; anchorDate: string; anchorTime: string;
  originalAnchor?: { at: string; date: string; time: string; timezone: string };
  doses: ProtocolDoseField[];
};

/** Presentation only. Civil dates and HH:mm values are resolved by the API. */
export const protocolDate = (at: string | Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(at));
  const value = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};
export const protocolClock = (at: string, timezone: string): string =>
  new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(at));
export const addProtocolDate = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
export const displayProtocolDate = (date: string): string =>
  new Intl.DateTimeFormat(undefined, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
export const displayProtocolInstant = (at: string, timezone: string, hour12: boolean): string =>
  new Intl.DateTimeFormat(undefined, { timeZone: timezone, year: protocolDate(at, timezone).slice(0, 4) !== protocolDate(new Date(), timezone).slice(0, 4) ? "numeric" : undefined,
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12 }).format(new Date(at));

export const configurationDraft = (configuration: ProtocolPhaseConfiguration | undefined, timezone: string, key: string): ProtocolConfigurationDraft => {
  const today = protocolDate(new Date(), timezone);
  if (!configuration) return { timezone, route: "IM", kind: "daily", interval: "", anchorDate: today, anchorTime: "08:00", doses: [{ key, time: "08:00", amount: "", unit: "mg", weekday: 0 }] };
  const { schedule } = configuration;
  const anchor = schedule.kind === "every_n_hours" ? schedule.anchorAt : schedule.kind === "one_time" ? schedule.at : null;
  return {
    timezone: configuration.timezone, route: configuration.route, kind: schedule.kind,
    interval: schedule.kind === "every_n_days" ? String(schedule.intervalDays) : schedule.kind === "every_n_hours" ? String(schedule.intervalHours) : "",
    anchorDate: schedule.kind === "every_n_days" ? schedule.anchorDate : anchor ? protocolDate(anchor, configuration.timezone) : today,
    anchorTime: anchor ? protocolClock(anchor, configuration.timezone) : "08:00",
    ...(anchor ? { originalAnchor: { at: anchor, date: protocolDate(anchor, configuration.timezone), time: protocolClock(anchor, configuration.timezone), timezone: configuration.timezone } } : {}),
    doses: schedule.kind === "specific_weekdays" ? schedule.days.flatMap((day) => day.doses.map((dose) => ({ ...dose, weekday: day.weekday })))
      : "doses" in schedule ? schedule.doses.map((dose) => ({ ...dose, weekday: 0 }))
        : [{ key, amount: schedule.amount, unit: schedule.unit, time: "08:00", weekday: 0 }],
  };
};

export const protocolFormError = (draft: ProtocolConfigurationDraft): string | null => {
  if (!draft.doses.length) return "Add at least one administration.";
  const doses = ["every_n_hours", "one_time", "as_needed"].includes(draft.kind) ? draft.doses.slice(0, 1) : draft.doses;
  for (const dose of doses) {
    if (!/^(?:0|[1-9]\d{0,29})(?:\.\d{1,12})?$/.test(dose.amount) || Number(dose.amount) <= 0) return "Enter a positive dose amount (up to 12 decimal places).";
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(dose.time)) return "Choose a time for every administration.";
  }
  if (draft.kind === "every_n_days" || draft.kind === "every_n_hours") {
    const max = draft.kind === "every_n_days" ? 7306 : 175344;
    if (!/^\d+$/.test(draft.interval) || Number(draft.interval) < 1 || Number(draft.interval) > max) return `Enter a whole-number interval from 1 to ${max.toLocaleString()}.`;
  }
  if (draft.kind === "specific_weekdays" && doses.some((dose) => dose.weekday < 0 || dose.weekday > 6)) return "Choose a weekday for every administration.";
  const dayCounts = new Map<number, number>();
  for (const dose of doses) {
    const day = draft.kind === "specific_weekdays" ? dose.weekday : 0;
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  if ([...dayCounts.values()].some((count) => count > 24)) return "Use at most 24 administrations per day.";
  return null;
};

export const resolveProtocolConfiguration = async (
  draft: ProtocolConfigurationDraft,
  resolve: (input: ProtocolTimePreviewInput) => Promise<ApiProtocolTimePreview>,
): Promise<ProtocolPhaseConfiguration> => {
  const error = protocolFormError(draft);
  if (error) throw new Error(error);
  const doses = draft.doses.map(({ key, time, amount, unit }) => ({ key, time, amount, unit }));
  const first = doses[0]!;
  const amount = { amount: first.amount, unit: first.unit };
  let schedule: ProtocolSchedule;
  switch (draft.kind) {
    case "daily": schedule = { kind: draft.kind, doses }; break;
    case "every_n_days": schedule = { kind: draft.kind, doses, intervalDays: Number(draft.interval), anchorDate: draft.anchorDate }; break;
    case "specific_weekdays": schedule = { kind: draft.kind, days: [...new Set(draft.doses.map((dose) => dose.weekday))].sort().map((weekday) => ({ weekday, doses: doses.filter((_dose, index) => draft.doses[index]!.weekday === weekday) })) }; break;
    case "as_needed": schedule = { kind: draft.kind, ...amount }; break;
    case "every_n_hours": case "one_time": {
      const original = draft.originalAnchor;
      const unchanged = original && original.date === draft.anchorDate && original.time === draft.anchorTime && original.timezone === draft.timezone;
      const at = unchanged ? original.at : (await resolve({ date: draft.anchorDate, time: draft.anchorTime, timezone: draft.timezone })).at;
      schedule = draft.kind === "one_time" ? { kind: draft.kind, at, ...amount } : { kind: draft.kind, anchorAt: at, intervalHours: Number(draft.interval), ...amount };
      break;
    }
  }
  return { timezone: draft.timezone, route: draft.route, schedule };
};

export const currentProtocolPhase = (course: ApiProtocolCourse, now = Date.now()) =>
  [...course.phases].reverse().find((phase) => Date.parse(phase.effectiveFrom) <= now
    && (!course.endAt || Date.parse(phase.effectiveFrom) < Date.parse(course.endAt))) ?? course.phases[0]!;
export const protocolCourseLabel = (course: ApiProtocolCourse, now = Date.now()): string =>
  course.status === "DRAFT" ? "Planned" : course.status === "ENDED" || (course.endAt && Date.parse(course.endAt) <= now) ? "History" : Date.parse(course.startAt) > now ? "Scheduled" : "Active";
export const protocolScheduleLabel = (schedule: ProtocolSchedule): string => {
  switch (schedule.kind) {
    case "daily": return "Daily";
    case "every_n_days": return `Every ${schedule.intervalDays} ${schedule.intervalDays === 1 ? "day" : "days"}`;
    case "every_n_hours": return `Every ${schedule.intervalHours} ${schedule.intervalHours === 1 ? "hour" : "hours"}`;
    case "specific_weekdays": return schedule.days.map((day) => protocolWeekdays[day.weekday]!.slice(0, 3)).join(", ");
    case "one_time": return "One time";
    case "as_needed": return "As needed";
  }
};
