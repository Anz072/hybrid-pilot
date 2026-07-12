import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";
import { appColors } from "./colors";
import { appTypography } from "./typography";
import { appBorders, appRadius, appSpacing, appStates, appSurfaces } from "./tokens";

type SharedStyleValue = ViewStyle | TextStyle | ImageStyle;

export const sharedStyleValues = {
  screen: {
    flex: 1,
    backgroundColor: appSurfaces.canvas,
  },
  content: {
    paddingHorizontal: appSpacing.gutter,
  },
  card: {
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    padding: appSpacing.md,
    marginBottom: appSpacing.md,
  },
  cardCompact: {
    backgroundColor: appSurfaces.card,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    padding: appSpacing.sm,
    marginBottom: appSpacing.md,
  },
  centerCard: {
    alignItems: "center",
    gap: appSpacing.xs,
    borderRadius: appRadius.md,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    backgroundColor: appSurfaces.card,
    padding: appSpacing.md,
  },
  centerText: {
    ...appTypography.metadata,
    color: appColors.textSecondary,
  },
  sectionTitle: {
    ...appTypography.cardTitle,
    color: appColors.textPrimary,
    marginBottom: appSpacing.xs,
  },
  sectionSubtitle: {
    ...appTypography.metadata,
    color: appColors.textSecondary,
    marginBottom: appSpacing.sm,
  },
  eyebrow: {
    alignSelf: "flex-start",
    ...appTypography.eyebrow,
    color: appColors.textMuted,
    marginBottom: appSpacing.xs,
  },
  sectionHead: {
    borderTopWidth: appBorders.ruleWidth,
    borderTopColor: appBorders.rule,
    paddingTop: appSpacing.sm,
    marginTop: appSpacing.xl,
  },
  hairlineRow: {
    borderBottomWidth: appBorders.width,
    borderBottomColor: appBorders.soft,
    paddingVertical: appSpacing.sm,
  },
  heroTitle: {
    ...appTypography.sectionTitle,
    color: appColors.textPrimary,
    marginBottom: appSpacing.xxs,
  },
  heroTitleLarge: {
    ...appTypography.sectionTitleLarge,
    color: appColors.textPrimary,
    marginBottom: appSpacing.xxs,
  },
  metaText: {
    ...appTypography.metadata,
    color: appColors.textSecondary,
  },
  fieldLabel: {
    ...appTypography.eyebrow,
    color: appColors.textSecondary,
    marginBottom: 6,
  },
  fieldLabelSpacing: {
    marginTop: appSpacing.sm,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  input: {
    flex: 1,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
    borderRadius: appRadius.sm,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: appColors.textPrimary,
    ...appTypography.bodySmall,
  },
  inputCompact: {
    flex: 1,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
    borderRadius: appRadius.sm,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 11,
    color: appColors.textPrimary,
    ...appTypography.bodySmall,
  },
  unitPill: {
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.ghost,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 11,
  },
  unitPillRound: {
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.ghost,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 11,
  },
  unitText: {
    ...appTypography.metadata,
    fontWeight: "500",
    color: appColors.actionPrimary,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appSpacing.xs,
    marginBottom: appSpacing.sm,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.card,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  pillText: {
    ...appTypography.label,
    color: appColors.textSecondary,
  },
  contextPillText: {
    ...appTypography.label,
    color: appColors.actionPrimary,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appSurfaces.ghost,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
  },
  iconButtonPrimary: {
    width: 44,
    height: 44,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.actionPrimary,
  },
  segmentedControl: {
    flexDirection: "row",
    gap: 6,
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    padding: appSpacing.xxs,
  },
  segmentedItem: {
    flex: 1,
    minHeight: 38,
    borderRadius: appRadius.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: appSpacing.sm,
  },
  segmentedItemActive: {
    backgroundColor: appColors.actionPrimary,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appSpacing.sm,
    borderRadius: appRadius.md,
    backgroundColor: appColors.surfaceCardAlt,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingHorizontal: 14,
    paddingVertical: appSpacing.sm,
  },
  skeletonLine: {
    height: 10,
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.ghostStrong,
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appSpacing.xs,
  },
  nutritionCell: {
    width: "47%",
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    padding: appSpacing.sm,
  },
  nutritionValue: {
    ...appTypography.numberMacroSummary,
    color: appColors.textPrimary,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: appSpacing.gutter,
    paddingTop: appSpacing.sm,
    gap: appSpacing.sm,
    backgroundColor: appSurfaces.card,
    borderTopWidth: appBorders.width,
    borderTopColor: appBorders.soft,
  },
  footerRow: {
    flexDirection: "row",
    gap: appSpacing.sm,
  },
  footerButton: {
    flex: 1,
  },
  buttonBase: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: appRadius.md,
    paddingVertical: 13,
    paddingHorizontal: appSpacing.md,
  },
  buttonWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: appSpacing.xs,
  },
  primaryButton: {
    backgroundColor: appColors.actionPrimary,
  },
  primaryButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.white,
  },
  lightPrimaryButton: {
    backgroundColor: appColors.success500,
    paddingVertical: 14,
  },
  lightPrimaryButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.textPrimary,
  },
  warningPrimaryButton: {
    backgroundColor: appColors.warning600,
    paddingVertical: 14,
  },
  warningPrimaryButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.textPrimary,
  },
  secondaryButton: {
    backgroundColor: appSurfaces.card,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.textPrimary,
  },
  outlineButton: {
    backgroundColor: appSurfaces.card,
    borderWidth: appBorders.width,
    borderColor: appBorders.strong,
  },
  outlineButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.textPrimary,
  },
  dangerButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.danger600,
  },
  dangerButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.danger700,
  },
  disabled: {
    opacity: appStates.disabledOpacity,
  },
  pressed: {
    opacity: appStates.pressedOpacity,
  },
} satisfies Record<string, SharedStyleValue>;

export const sharedStyles = StyleSheet.create(sharedStyleValues);
