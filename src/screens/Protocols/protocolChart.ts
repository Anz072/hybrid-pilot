import type { ApiProtocolDoseMarker, ApiProtocolLevelPoint } from "../../API/nouri/protocolTypes";

/** Exact event values take priority over the sampled polyline. All PK is server-owned. */
export function protocolChartValue(points: ApiProtocolLevelPoint[], at: number, dosesAtTime: ApiProtocolDoseMarker[] = []) {
  const event = dosesAtTime.find((dose) => Date.parse(dose.at) === at);
  // Every simultaneous marker carries the same total for this course; do not sum them.
  if (event) return event.level;
  if (!points.length || at < Date.parse(points[0]!.at) || at > Date.parse(points.at(-1)!.at)) return null;
  let low = 0; let high = points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (Date.parse(points[middle]!.at) < at) low = middle + 1; else high = middle;
  }
  const right = points[low]!;
  if (Date.parse(right.at) === at || low === 0) return { amount: right.amount, relative: right.relative };
  const left = points[low - 1]!;
  const fraction = (at - Date.parse(left.at)) / (Date.parse(right.at) - Date.parse(left.at));
  return { amount: left.amount + (right.amount - left.amount) * fraction,
    relative: left.relative === null || right.relative === null ? null : left.relative + (right.relative - left.relative) * fraction };
}

export function nearestProtocolChartTime(times: number[], at: number): number {
  if (!times.length) return at;
  let low = 0; let high = times.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (times[middle]! < at) low = middle + 1; else high = middle;
  }
  return low > 0 && at - times[low - 1]! <= times[low]! - at ? times[low - 1]! : times[low]!;
}

export const protocolChartNumber = (value: number | null | undefined) => value == null ? "—"
  : value !== 0 && Math.abs(value) < 0.001 ? value.toExponential(2)
    : new Intl.NumberFormat(undefined, { maximumSignificantDigits: 4 }).format(value);
