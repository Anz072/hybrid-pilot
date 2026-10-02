import { Platform, type ViewStyle } from "react-native";
import { appColors } from "./colors";

// Walk15 reference: settings 0/2, radius 8, opacity .08; metrics 0/1, radius 6, .06.
// Native box shadows avoid a new dependency. Older Android uses elevation.
const shadow = (offsetY: number, blurRadius: number, opacity: number, elevation: number): ViewStyle =>
  Platform.OS === "android" && Number(Platform.Version) < 28
    ? { elevation, shadowColor: "#000000" }
    : { boxShadow: [{ offsetX: 0, offsetY, blurRadius, color: `rgba(0, 0, 0, ${opacity})` }] };

export const appElevation = {
  none: { boxShadow: [], elevation: 0 } as ViewStyle,
  metric: shadow(1, 6, 0.06, 2),
  card: shadow(2, 8, 0.08, 3),
  hero: shadow(4, 16, 0.08, 4),
};

/** Reused by native list containers that cannot be wrapped in AppCard. */
export const appCardSurface: ViewStyle = {
  backgroundColor: appColors.surfaceCard,
  borderRadius: 12,
  ...appElevation.card,
};

export const appMetricSurface: ViewStyle = {
  backgroundColor: appColors.surfaceCard,
  borderRadius: 8,
  ...appElevation.metric,
};
