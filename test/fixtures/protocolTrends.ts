import type { ApiProtocolTrends } from "../../src/API/nouri/protocolTypes";
export const trends: ApiProtocolTrends = {
  metric: "calories", range: "1W", start: "2026-09-07", end: "2026-09-13", timezone: "Pacific/Honolulu",
  firstRecordedDate: "2026-09-01", datePolicy: "stored_local_date", unit: "kcal", aggregation: "complete_day_7_day_average",
  recordedDays: 3, eligibleDays: 2,
  points: [
    { date: "2026-09-07", value: 516, recordedValue: 332, coverage: 2, isComplete: true, sourceId: null },
    { date: "2026-09-08", value: 166, recordedValue: 0, coverage: 2, isComplete: true, sourceId: null },
    { date: "2026-09-09", value: null, recordedValue: 9000, coverage: 2, isComplete: false, sourceId: null },
    { date: "2026-09-10", value: null, recordedValue: null, coverage: 2, isComplete: false, sourceId: null },
    { date: "2026-09-13", value: null, recordedValue: null, coverage: 2, isComplete: false, sourceId: null },
  ],
};
