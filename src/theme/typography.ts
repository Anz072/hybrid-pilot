import type { TextStyle } from "react-native";

const tabularNums = ["tabular-nums"] as TextStyle["fontVariant"];

/**
 * Kitchen Ledger type system. Hierarchy is weight-led (400 / 500 / 600 / 700)
 * with three ink tiers doing the rest; display sizes take negative tracking
 * like the bold calorie line on a nutrition label. Dynamic numbers are
 * always tabular.
 */
export const appTypography = {
  display: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -0.9,
  } satisfies TextStyle,
  displayHero: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -0.9,
  } satisfies TextStyle,
  heroNumber: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontVariant: tabularNums,
  } satisfies TextStyle,
  screenTitle: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.4,
  } satisfies TextStyle,
  displaySection: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -0.4,
  } satisfies TextStyle,
  sectionTitleLarge: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.3,
  } satisfies TextStyle,
  displayCard: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.3,
  } satisfies TextStyle,
  sectionTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.2,
  } satisfies TextStyle,
  title: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    letterSpacing: -0.2,
  } satisfies TextStyle,
  cardTitle: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "700",
    letterSpacing: -0.1,
  } satisfies TextStyle,
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400",
    letterSpacing: 0,
  } satisfies TextStyle,
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: 0,
  } satisfies TextStyle,
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400",
    letterSpacing: 0,
  } satisfies TextStyle,
  bodySmallStrong: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0,
  } satisfies TextStyle,
  metadata: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: 0,
  } satisfies TextStyle,
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
    letterSpacing: 0,
  } satisfies TextStyle,
  eyebrow: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  } satisfies TextStyle,
  micro: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    letterSpacing: 0,
  } satisfies TextStyle,
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    letterSpacing: 0,
  } satisfies TextStyle,
  buttonSmall: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    letterSpacing: 0,
  } satisfies TextStyle,
  numberCalorieHero: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -0.6,
    fontVariant: tabularNums,
  } satisfies TextStyle,
  numberCalorieRow: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "600",
    textAlign: "right",
    fontVariant: tabularNums,
  } satisfies TextStyle,
  numberMacroSummary: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
    fontVariant: tabularNums,
  } satisfies TextStyle,
  numberMacroRow: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "right",
    fontVariant: tabularNums,
  } satisfies TextStyle,
  numberWeightHero: {
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "700",
    letterSpacing: -0.9,
    fontVariant: tabularNums,
  } satisfies TextStyle,
  numberWeightEntry: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    textAlign: "right",
    fontVariant: tabularNums,
  } satisfies TextStyle,
  numberTrendDelta: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
    fontVariant: tabularNums,
  } satisfies TextStyle,
  numberChartAxis: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "500",
    fontVariant: tabularNums,
  } satisfies TextStyle,
} as const;

export type AppTypographyRole = keyof typeof appTypography;
