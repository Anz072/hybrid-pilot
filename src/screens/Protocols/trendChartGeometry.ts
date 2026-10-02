import type { ApiProtocolTrendPoint } from "../../API/nouri/protocolTypes";

type DrawPoint = { index: number; segment: number; value: number };

/** Reduce pixels only. Retain original indices and gap identities so sampling
 * cannot join measurements across an incomplete nutrition day. */
export function sampleTrendPoints(points: ApiProtocolTrendPoint[], budget = 800): DrawPoint[] {
  const valid: DrawPoint[] = [];
  let segment = 0;
  points.forEach((point, index) => {
    if (point.value === null) segment += 1;
    else valid.push({ index, segment, value: point.value });
  });
  if (valid.length <= budget) return valid;
  const buckets = Math.max(1, Math.floor(budget / 4));
  const sampled: DrawPoint[] = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const slice = valid.slice(Math.floor(bucket * valid.length / buckets), Math.floor((bucket + 1) * valid.length / buckets));
    const first = slice[0]!; const last = slice.at(-1)!;
    let min = first; let max = first;
    for (const point of slice) {
      if (point.value < min.value) min = point;
      if (point.value > max.value) max = point;
    }
    sampled.push(...[...new Set([first, min, max, last])].sort((a, b) => a.index - b.index));
  }
  return sampled;
}

export const trendDatePosition = (date: string): number => Date.parse(`${date}T12:00:00Z`);

export function nearestTrendPoint(points: ApiProtocolTrendPoint[], at: number): number {
  if (!points.length) return -1;
  let low = 0; let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (trendDatePosition(points[mid]!.date) < at) low = mid + 1;
    else high = mid;
  }
  return low > 0 && Math.abs(trendDatePosition(points[low - 1]!.date) - at) <= Math.abs(trendDatePosition(points[low]!.date) - at) ? low - 1 : low;
}
