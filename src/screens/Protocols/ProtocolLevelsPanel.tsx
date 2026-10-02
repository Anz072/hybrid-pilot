import React from "react";
import { View } from "react-native";
import { AppButton, AppCard, AppText, ErrorState, LoadingState, SegmentedControl } from "../../components/ui";
import type { ApiProtocolLevels } from "../../API/nouri/protocolTypes";
import type { ProtocolChartMetric, ProtocolChartRange } from "../../domain/types";
import { displayProtocolInstant } from "./protocolForm";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import ProtocolTimelineChart from "./ProtocolTimelineChart";
import { protocolStyles as styles } from "./protocolStyles";

export default function ProtocolLevelsPanel({ data, loading, error, retry, range, metric, relativeOnly, onRange, onMetric, onWindow, onInfo, timezone, labels }: {
  data?: ApiProtocolLevels; loading: boolean; error: string | null; retry: () => void;
  range: ProtocolChartRange; metric: ProtocolChartMetric; relativeOnly: boolean;
  onRange: (range: ProtocolChartRange) => void; onMetric: (metric: ProtocolChartMetric) => void;
  onWindow: (anchorAt: string | undefined) => void; onInfo: (compoundId: string) => void;
  timezone: string; labels?: Record<string, string>;
}) {
  const { timeFormat } = useDisplayPreferences();
  const format = (at: string) => displayProtocolInstant(at, timezone, timeFormat === "12h");
  const shift = (direction: -1 | 1) => {
    if (!data) return;
    const start = Date.parse(data.startAt); const end = Date.parse(data.endAt);
    onWindow(new Date((start + end) / 2 + direction * (end - start) * 0.75).toISOString());
  };
  return <View style={styles.stack}>
    <SegmentedControl value={range} onChange={onRange} options={(["1W", "1M", "3M", "All"] as const).map((value) => ({ value, label: value }))} />
    <SegmentedControl value={relativeOnly ? "relative" : metric} disabled={relativeOnly} onChange={onMetric}
      options={[{ value: "relative", label: "Relative %" }, { value: "amount", label: "Amount remaining" }]} />
    {relativeOnly ? <AppText variant="bodySmall" color="secondary">{data?.comparisonBranchAt ? "Current and Compare use Relative % with one shared reference scale." : "Overlays use Relative %. Each course keeps its own scale; unrelated compounds are never added together."}</AppText> : null}
    {range !== "All" ? <View style={styles.row}>
      <AppButton label="Earlier" variant="ghost" disabled={!data || loading} onPress={() => shift(-1)} />
      <AppButton label="Default window" variant="ghost" onPress={() => onWindow(undefined)} />
      <AppButton label="Later" variant="ghost" disabled={!data || loading} onPress={() => shift(1)} />
    </View> : null}
    {error ? <ErrorState title="Estimated Levels aren't available right now" message={error} action={<AppButton label="Try again" onPress={retry} />} /> : null}
    {loading ? <LoadingState title="Calculating estimated levels" /> : null}
    <AppCard><ProtocolTimelineChart data={data} timezone={timezone} labels={labels} /></AppCard>
    {data?.comparisonBranchAt ? <AppText variant="bodySmall" color="secondary">Comparison begins {format(data.comparisonBranchAt)}. Both curves use the same reference scale. Closing Compare discards the hypothetical configuration.</AppText> : null}
    {data?.series.some((series) => series.history.coverageIncomplete) ? <AppText variant="bodySmall" color="secondary">This estimate uses your logged past doses. Some earlier scheduled doses are unlogged, so the current estimate may be incomplete.</AppText> : null}
    <AppText variant="bodySmall" color="secondary">These are modeled dose-equivalent estimates, not measured blood levels. Changing the range does not redefine 100%.</AppText>
    {data?.series.map((series) => <AppCard key={series.key} style={styles.card}>
      <AppText variant="bodyStrong">{data.comparisonBranchAt ? series.mode === "comparison" ? "Compare" : "Current" : labels?.[series.courseId] ?? series.compound.name}</AppText>
      {series.status === "unavailable" ? <AppText color="secondary">{series.unavailableReason === "missing_model" ? "Estimated Levels aren't available for this compound and route yet." : "This estimate could not be calculated for the selected history. Try a shorter range or fewer courses."} Logging remains available.</AppText> : null}
      {series.clearance ? <>
        <AppText variant="bodyStrong">{series.clearance.basis === "stopped_now" ? "If dosing stopped now · Estimated 95% clearance" : "Estimated 95% clearance"}</AppText>
        <AppText color="secondary">{series.clearance.status === "estimated" && series.clearance.at ? format(series.clearance.at)
          : series.clearance.status === "no_doses" ? "No included administrations" : "Not reached within the calculation window"}</AppText>
        <AppText variant="bodySmall" color="secondary">{series.clearance.basis === "final_actual" ? "Based on the final recorded administration." : series.clearance.basis === "final_planned" ? "Based on the final projected administration." : series.clearance.basis === "draft_preview" ? "Hypothetical draft estimate." : "Based on recorded administrations through now."} The threshold is 5% of the modeled peak after the final included administration.</AppText>
      </> : null}
      {series.models.length ? <AppText variant="bodySmall" color="secondary">Models · {series.models.map((model) => model.key).join(", ")}</AppText> : null}
      <AppButton label="Compound info and model sources" variant="ghost" onPress={() => onInfo(series.compound.id)} />
    </AppCard>)}
  </View>;
}
