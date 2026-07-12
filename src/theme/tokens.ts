import { appColors } from "./colors";

export const appSpacing = {
  none: 0,
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  gutter: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  hero: 40,
  major: 48,
} as const;

export const appRadius = {
  none: 0,
  xs: 4,
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const appBorders = {
  width: 1,
  /** The signature ledger rule — heavy ink bar that opens a section. */
  ruleWidth: 3,
  rule: appColors.textPrimary,
  soft: appColors.borderSoft,
  strong: appColors.borderStrong,
  focus: appColors.actionPrimary,
  selected: appColors.actionPrimaryBorder,
  error: appColors.statusError,
} as const;

export const appSurfaces = {
  canvas: appColors.surfaceCanvas,
  card: appColors.surfaceCard,
  soft: appColors.surfaceField,
  raised: appColors.surfaceRaised,
  ghost: appColors.surfaceGhost,
  ghostStrong: appColors.surfaceGhostStrong,
  overlay: appColors.surfaceOverlay,
} as const;

export const appStates = {
  pressedOpacity: 0.9,
  pressedScale: 0.97,
  disabledOpacity: 0.56,
  selectedFill: appColors.actionPrimarySoft,
  selectedBorder: appColors.actionPrimaryBorder,
  focusBorder: appColors.actionPrimary,
} as const;

export const appMotion = {
  pressMs: 140,
  stateMs: 180,
  modalMs: 260,
} as const;

export const appElevation = {
  overlay: {
    shadowColor: appColors.textPrimary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;
