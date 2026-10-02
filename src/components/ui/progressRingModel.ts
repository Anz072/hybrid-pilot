/** Presentation-only normalization; calorie targets and totals remain server-owned. */
export const getProgressRingState = (value: number, target: number | null) => {
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const safeTarget = target != null && Number.isFinite(target) && target > 0 ? target : null;
  return {
    value: safeValue,
    target: safeTarget,
    progress: safeTarget == null ? 0 : Math.min(1, safeValue / safeTarget),
    remaining: safeTarget == null ? null : Math.round(safeTarget - safeValue),
  };
};
