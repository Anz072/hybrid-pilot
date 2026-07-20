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
  /** An open form section — content sits on the canvas; the section title carries the hierarchy. */
  card: {
    marginBottom: appSpacing.xl,
  },
  cardCompact: {
    marginBottom: appSpacing.xl,
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
    ...appTypography.sectionTitle,
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
  /** Editorial fields: soft fills with a transparent resting border (focus/error can color it without a layout jump). */
  input: {
    flex: 1,
    borderWidth: appBorders.width,
    borderColor: "transparent",
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: 14,
    paddingVertical: appSpacing.sm,
    color: appColors.textPrimary,
    ...appTypography.bodySmall,
  },
  inputCompact: {
    flex: 1,
    borderWidth: appBorders.width,
    borderColor: "transparent",
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
    color: appColors.textPrimary,
    ...appTypography.bodySmall,
  },
  unitPill: {
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 11,
  },
  unitPillRound: {
    borderRadius: appRadius.pill,
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: 11,
  },
  unitText: {
    ...appTypography.metadata,
    fontWeight: "500",
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
    backgroundColor: appSurfaces.canvas,
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
    paddingVertical: appSpacing.sm,
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
    backgroundColor: appColors.actionPrimary,
    paddingVertical: appSpacing.sm,
  },
  lightPrimaryButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.white,
  },
  warningPrimaryButtonText: {
    ...appTypography.buttonSmall,
    color: appColors.white,
  },
  secondaryButton: {
    backgroundColor: appSurfaces.soft,
    borderWidth: appBorders.width,
    borderColor: appBorders.soft,
    paddingVertical: appSpacing.sm,
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
