export type DiaryPerfReason =
  | "initial-focus"
  | "focus"
  | "date-select"
  | "week-change"
  | "resume"
  | "retry"
  | "post-mutation"
  | "weekly-review";

export type DiaryPerfVisit = "first" | "repeat";
export type DiaryPerfOutcome = "success" | "failed" | "obsolete";
export type DiaryPerfRequestSource =
  | "logical"
  | "sqlite"
  | "supabase"
  | "background-supabase";

type DiaryPerfStep = {
  count: number;
  totalMs: number;
  maxMs: number;
};

export type DiaryPerfTrace = {
  id: string;
  reason: DiaryPerfReason;
  fromDate: string;
  toDate: string;
  visit: DiaryPerfVisit;
  startedAt: number;
  usefulAtMs: number | null;
  steps: Record<string, DiaryPerfStep>;
  requestCounts: Record<string, number>;
  cachePaths: Record<string, string>;
  rowCounts: Record<string, number>;
  renderCount: number;
  renderTotalMs: number;
  renderMaxMs: number;
  finished: boolean;
};

let traceSequence = 0;

const now = () =>
  typeof globalThis.performance?.now === "function"
    ? globalThis.performance.now()
    : Date.now();

const roundMs = (value: number) => Math.round(value * 10) / 10;

const emit = (event: string, payload: Record<string, unknown>) => {
  console.info(`[diary-perf] ${JSON.stringify({ event, ...payload })}`);
};

export const startDiaryTrace = (input: {
  reason: DiaryPerfReason;
  fromDate: string;
  toDate: string;
  visit: DiaryPerfVisit;
}): DiaryPerfTrace => {
  traceSequence += 1;
  const trace: DiaryPerfTrace = {
    id: `diary-${Date.now()}-${traceSequence}`,
    reason: input.reason,
    fromDate: input.fromDate,
    toDate: input.toDate,
    visit: input.visit,
    startedAt: now(),
    usefulAtMs: null,
    steps: {},
    requestCounts: {},
    cachePaths: {},
    rowCounts: {},
    renderCount: 0,
    renderTotalMs: 0,
    renderMaxMs: 0,
    finished: false,
  };

  emit("trace-start", {
    traceId: trace.id,
    reason: trace.reason,
    fromDate: trace.fromDate,
    toDate: trace.toDate,
    visit: trace.visit,
  });
  return trace;
};

const addStep = (trace: DiaryPerfTrace, name: string, durationMs: number) => {
  const current = trace.steps[name] ?? { count: 0, totalMs: 0, maxMs: 0 };
  trace.steps[name] = {
    count: current.count + 1,
    totalMs: current.totalMs + durationMs,
    maxMs: Math.max(current.maxMs, durationMs),
  };
};

export const measureDiaryStep = async <T>(
  trace: DiaryPerfTrace | null | undefined,
  name: string,
  operation: () => Promise<T> | T,
): Promise<T> => {
  if (!trace) {
    return operation();
  }

  const startedAt = now();
  try {
    return await operation();
  } finally {
    addStep(trace, name, now() - startedAt);
  }
};

export const measureDiaryRequest = async <T>(
  trace: DiaryPerfTrace | null | undefined,
  operationName: string,
  source: DiaryPerfRequestSource,
  operation: () => Promise<T>,
): Promise<T> => {
  if (!trace) {
    return operation();
  }

  const requestKey = `${source}:${operationName}`;
  trace.requestCounts[requestKey] = (trace.requestCounts[requestKey] ?? 0) + 1;
  const startedAt = now();

  try {
    const result = await operation();
    const durationMs = now() - startedAt;
    addStep(trace, `request.${requestKey}`, durationMs);
    emit("request", {
      traceId: trace.id,
      operation: operationName,
      source,
      durationMs: roundMs(durationMs),
      outcome: "success",
    });
    return result;
  } catch (error) {
    const durationMs = now() - startedAt;
    addStep(trace, `request.${requestKey}`, durationMs);
    emit("request", {
      traceId: trace.id,
      operation: operationName,
      source,
      durationMs: roundMs(durationMs),
      outcome: "failed",
    });
    throw error;
  }
};

export const recordDiaryCachePath = (
  trace: DiaryPerfTrace | null | undefined,
  operationName: string,
  cachePath: string,
) => {
  if (trace) {
    trace.cachePaths[operationName] = cachePath;
  }
};

export const recordDiaryRows = (
  trace: DiaryPerfTrace | null | undefined,
  operationName: string,
  count: number,
) => {
  if (trace) {
    trace.rowCounts[operationName] = count;
  }
};

export const recordDiaryRender = (
  trace: DiaryPerfTrace | null | undefined,
  actualDurationMs: number,
) => {
  if (!trace || trace.finished) {
    return;
  }

  trace.renderCount += 1;
  trace.renderTotalMs += actualDurationMs;
  trace.renderMaxMs = Math.max(trace.renderMaxMs, actualDurationMs);
};

export const markDiaryUseful = (trace: DiaryPerfTrace) => {
  if (trace.finished || trace.usefulAtMs != null) {
    return;
  }

  trace.usefulAtMs = now() - trace.startedAt;
  emit("useful-content", {
    traceId: trace.id,
    durationMs: roundMs(trace.usefulAtMs),
  });
};

export const finishDiaryTrace = (
  trace: DiaryPerfTrace | null | undefined,
  outcome: DiaryPerfOutcome,
) => {
  if (!trace || trace.finished) {
    return;
  }

  trace.finished = true;
  const totalMs = now() - trace.startedAt;
  const steps = Object.fromEntries(
    Object.entries(trace.steps).map(([name, step]) => [
      name,
      {
        count: step.count,
        totalMs: roundMs(step.totalMs),
        maxMs: roundMs(step.maxMs),
      },
    ]),
  );

  emit("trace-summary", {
    traceId: trace.id,
    reason: trace.reason,
    fromDate: trace.fromDate,
    toDate: trace.toDate,
    visit: trace.visit,
    outcome,
    totalMs: roundMs(totalMs),
    usefulContentMs:
      trace.usefulAtMs == null ? null : roundMs(trace.usefulAtMs),
    requestCounts: trace.requestCounts,
    cachePaths: trace.cachePaths,
    rowCounts: trace.rowCounts,
    render: {
      count: trace.renderCount,
      totalMs: roundMs(trace.renderTotalMs),
      maxMs: roundMs(trace.renderMaxMs),
    },
    steps,
  });
};
