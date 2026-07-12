/**
 * Shared app color tokens — the "Kitchen Ledger" direction.
 * Ink on oat paper with a single lingonberry accent; every hue comes from
 * the kitchen (bran, wheat, olive oil, honey, garden greens, spring water).
 * Calories are set in ink, like the bold calorie line on a nutrition label.
 */
const palette = {
  white: "#FFFFFF",
  paper: "#F3EEE3",
  paperSoft: "#EDE6D6",
  milk: "#FCFAF4",
  milkToned: "#F6F1E6",
  bran: "#ECE5D6",
  branDeep: "#E1D6BF",
  sand: "#E4DCCA",
  sandDeep: "#CDC2A8",
  taupe: "#8B8170",
  ink: "#262019",
  inkSoft: "#5C5347",
  inkMuted: "#9A8F7E",
  lingonberryTint: "#F3DCD6",
  lingonberrySoft: "#D8A093",
  lingonberry: "#A63D2F",
  lingonberryDeep: "#872F24",
  redTint: "#F5DFD9",
  red: "#9B2C1F",
  redDeep: "#7C2015",
  gardenSoft: "#8FAE8B",
  garden: "#6F8F6C",
  gardenDeep: "#52734F",
  spring: "#5E8CA0",
  olive: "#77804B",
  russet: "#815334",
  wheat: "#B8862B",
  honeySoft: "#EAD7AC",
  honey: "#C08A2E",
  honeyDeep: "#8F6119",
} as const;

const neutral = {
  50: palette.paper,
  100: palette.paperSoft,
  200: palette.sand,
  300: palette.sand,
  400: palette.sandDeep,
  500: palette.taupe,
  600: palette.inkSoft,
  700: palette.inkSoft,
  800: palette.ink,
  900: palette.ink,
  950: palette.ink,
} as const;

const brand = {
  100: palette.lingonberryTint,
  200: palette.lingonberryTint,
  300: palette.lingonberrySoft,
  400: palette.lingonberrySoft,
  500: palette.lingonberry,
  600: palette.lingonberry,
  700: palette.lingonberryDeep,
  800: palette.ink,
  900: palette.ink,
} as const;

const success = {
  500: palette.gardenSoft,
  600: palette.garden,
  700: palette.gardenDeep,
} as const;

const warning = {
  300: palette.honeySoft,
  600: palette.honey,
  700: palette.honeyDeep,
  800: palette.honeyDeep,
  surface: palette.paperSoft,
  surfaceStrong: palette.branDeep,
} as const;

const danger = {
  100: palette.redTint,
  600: palette.red,
  700: palette.redDeep,
  800: palette.redDeep,
  text: palette.red,
  surface: palette.redTint,
  surfaceAlt: palette.redTint,
  border: palette.red,
} as const;

const grayScale = {
  50: palette.paper,
  100: palette.paperSoft,
  200: palette.sand,
  300: palette.sandDeep,
  400: palette.inkMuted,
  500: palette.inkSoft,
  600: palette.inkSoft,
  700: palette.ink,
  800: palette.ink,
  900: palette.ink,
} as const;

const surface = {
  canvas: palette.paper,
  canvasAlt: palette.paperSoft,
  base: palette.paper,
  card: palette.milk,
  cardAlt: palette.milkToned,
  cardRaised: palette.milk,
  field: palette.bran,
  fieldAlt: palette.branDeep,
  overlay: "rgba(20, 16, 10, 0.45)",
  ghost: "rgba(38, 32, 25, 0.05)",
  ghostStrong: "rgba(38, 32, 25, 0.10)",
} as const;

const text = {
  primary: palette.ink,
  secondary: palette.inkSoft,
  muted: palette.inkMuted,
} as const;

const border = {
  soft: palette.sand,
  strong: palette.sandDeep,
} as const;

export const gray = {
  50: grayScale[50],
  100: grayScale[100],
  200: grayScale[200],
  300: grayScale[300],
  400: grayScale[400],
  500: grayScale[500],
  600: grayScale[600],
  700: grayScale[700],
  800: grayScale[800],
  900: grayScale[900],
};

export const appColors = {
  white: palette.white,

  slate900: neutral[900],
  slate950: neutral[950],
  slate800: neutral[800],
  slate700: neutral[700],
  slate600: neutral[600],
  slate500: neutral[500],
  slate400: neutral[400],
  slate300: neutral[300],
  slate200: neutral[200],
  slate100: neutral[100],
  slate50: neutral[50],

  brand300: brand[300],
  brand400: brand[400],
  brand500: brand[500],
  brand600: brand[600],
  brand700: brand[700],
  brand800: brand[800],
  brand900: brand[900],

  gray900: grayScale[900],
  gray500: grayScale[500],

  warning800: warning[800],
  warning700: warning[700],
  warning600: warning[600],
  warning300: warning[300],

  success500: success[500],
  success600: success[600],
  success700: success[700],

  danger600: danger[600],
  danger700: danger[700],
  danger800: danger[800],

  surfaceCanvas: surface.canvas,
  surfaceCanvasAlt: surface.canvasAlt,
  surfaceBase: surface.base,
  surfaceCard: surface.card,
  surfaceCardAlt: surface.cardAlt,
  surfaceRaised: surface.cardRaised,
  surfaceField: surface.field,
  surfaceFieldAlt: surface.fieldAlt,
  surfaceOverlay: surface.overlay,
  surfaceGhost: surface.ghost,
  surfaceGhostStrong: surface.ghostStrong,

  textPrimary: text.primary,
  textSecondary: text.secondary,
  textMuted: text.muted,
  textDisabled: text.muted,

  borderSoft: border.soft,
  borderStrong: border.strong,

  dangerText: danger.text,
  dangerSoftBg: danger.surface,
  dangerSurface: danger.surfaceAlt,
  dangerBorder: danger.border,

  warningSurface: warning.surface,
  warningSurfaceStrong: warning.surfaceStrong,

  actionPrimary: brand[500],
  actionPrimaryPressed: brand[700],
  actionPrimarySoft: brand[100],
  actionPrimaryBorder: brand[300],

  statusSuccess: success[700],
  statusSuccessSoft: surface.cardAlt,
  statusWarning: warning[700],
  statusWarningSoft: warning.surface,
  statusError: danger[600],
  statusErrorSoft: danger.surface,

  // Macro aliases — food-native hues. Calories are ink: the boldest
  // black line on the label, not a brand decoration.
  calories: palette.ink,
  protein: palette.russet,
  carbs: palette.wheat,
  fat: palette.olive,
  water: palette.spring,
} as const;

export const appColorPrimitives = palette;

export type AppColorToken = keyof typeof appColors;
export type AppColorValue = (typeof appColors)[AppColorToken];
