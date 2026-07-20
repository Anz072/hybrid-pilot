import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import { ArrowLeftIcon } from "phosphor-react-native";
import { appColors } from "../../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sharedStyleValues } from "../../theme/sharedStyles";
import { NumericText } from "../../components/ui";

export type FoodEntryFormHeroAction = {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
  onPress: () => void;
};

export type FoodEntryFormSlot = {
  actionLabel?: string;
  icon?: React.ReactNode;
  label: string;
  onPress?: () => void;
  trailingText?: string;
  value: string;
};

export type FoodEntryFormNutritionItem = {
  label: string;
  value: string;
};

export type FoodEntryFormSecondaryAction = {
  icon?: React.ReactNode;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger";
};

type FoodEntryFormProps = {
  amountKeyboardType?: KeyboardTypeOptions;
  amountLabel?: string;
  amountPlaceholder: string;
  amountUnit: string;
  amountValue: string;
  detailsSubtitle?: string;
  detailsTitle?: string;
  formError?: string | null;
  headerEyebrow: string;
  headerSubtitle?: string;
  headerTitle: string;
  heroAction?: FoodEntryFormHeroAction;
  heroEyebrow: string;
  heroMeta: string;
  heroTitle: string;
  labelFieldLabel?: string;
  labelPlaceholder: string;
  labelValue: string;
  nutritionItems: FoodEntryFormNutritionItem[];
  onBack: () => void;
  onChangeAmount: (value: string) => void;
  onAmountBlur?: () => void;
  onChangeLabel: (value: string) => void;
  onPrimaryAction: () => void;
  previewCaloriesText: string;
  previewSubtitle?: string;
  previewSummaryText: string;
  previewTitle?: string;
  primaryActionDisabled?: boolean;
  primaryActionIcon?: React.ReactNode;
  primaryActionLabel: string;
  secondaryAction?: FoodEntryFormSecondaryAction;
  showPrimaryAction?: boolean;
  slot: FoodEntryFormSlot;
};

const FoodEntryForm = ({
  amountKeyboardType = "default",
  amountLabel = "Amount",
  amountPlaceholder,
  amountUnit,
  amountValue,
  detailsSubtitle = "Set the amount and slot before saving this food.",
  detailsTitle = "Log Details",
  formError,
  headerEyebrow,
  headerSubtitle,
  headerTitle,
  heroAction,
  heroEyebrow,
  heroMeta,
  heroTitle,
  labelFieldLabel = "Optional label",
  labelPlaceholder,
  labelValue,
  nutritionItems,
  onBack,
  onChangeAmount,
  onAmountBlur,
  onChangeLabel,
  onPrimaryAction,
  previewCaloriesText,
  previewSubtitle = "Updates as you adjust the amount.",
  previewSummaryText,
  previewTitle = "Preview",
  primaryActionDisabled = false,
  primaryActionIcon,
  primaryActionLabel,
  secondaryAction,
  showPrimaryAction = true,
  slot,
}: FoodEntryFormProps) => {
  const insets = useSafeAreaInsets();
  const renderSlotContent = () => (
    <>
      {slot.icon ? <View style={styles.slotIcon}>{slot.icon}</View> : null}

      <View style={styles.slotCopy}>
        <Text style={styles.slotLabel}>{slot.label}</Text>
        <Text style={styles.slotValue}>{slot.value}</Text>
      </View>
      {slot.onPress ? (
        <Text style={styles.slotAction}>{slot.actionLabel ?? "Change"}</Text>
      ) : slot.trailingText ? (
        <Text style={styles.slotTrailing}>{slot.trailingText}</Text>
      ) : null}
    </>
  );

  return (
    <>
      <View style={[styles.cardX, { marginTop: insets.top + 14 }]}>
        <View style={styles.heroHeaderRow}>
          <Pressable
            accessibilityLabel="Go back"
            hitSlop={8}
            onPress={onBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.cardPressed,
            ]}
          >
            <ArrowLeftIcon
              size={18}
              color={appColors.textPrimary}
              weight="bold"
            />
          </Pressable>
          <View style={styles.heroHeaderCopy}>
            <Text style={styles.heroEyebrow}>{heroEyebrow}</Text>
            <Text style={styles.heroTitle}>{heroTitle}</Text>
            <Text style={styles.heroMeta}>{heroMeta}</Text>
          </View>
          {heroAction ? (
            <Pressable
              onPress={heroAction.onPress}
              style={({ pressed }) => [
                styles.heroAction,
                heroAction.active && styles.heroActionActive,
                pressed && styles.cardPressed,
              ]}
            >
              {heroAction.icon}
              <Text
                style={[
                  styles.heroActionText,
                  heroAction.active && styles.heroActionTextActive,
                ]}
              >
                {heroAction.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.sectionTitle}>{detailsTitle}</Text>

        <Text style={styles.fieldLabel}>{amountLabel}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={amountValue}
            onChangeText={onChangeAmount}
            onBlur={onAmountBlur}
            keyboardType={amountKeyboardType}
            placeholder={amountPlaceholder}
            placeholderTextColor={appColors.textMuted}
          />
          <View style={styles.unitPill}>
            <Text style={styles.unitText}>{amountUnit}</Text>
          </View>
        </View>

        <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
          {slot.label}
        </Text>
        {slot.onPress ? (
          <Pressable
            onPress={slot.onPress}
            style={({ pressed }) => [
              styles.slotRow,
              pressed && styles.cardPressed,
            ]}
          >
            {renderSlotContent()}
          </Pressable>
        ) : (
          <View style={styles.slotRow}>{renderSlotContent()}</View>
        )}
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{previewTitle}</Text>
        <View style={styles.nutritionGrid}>
          {nutritionItems.map((item) => (
            <View key={item.label} style={styles.nutritionCell}>
              <Text style={styles.nutritionLabel}>{item.label}</Text>
              <NumericText
                variant="numberMacroSummary"
                style={styles.nutritionValue}
              >
                {item.value}
              </NumericText>
            </View>
          ))}
        </View>
      </View>

      {showPrimaryAction ? (
        <Pressable
          onPress={onPrimaryAction}
          disabled={primaryActionDisabled}
          style={({ pressed }) => [
            styles.primaryButton,
            primaryActionDisabled && styles.disabled,
            pressed && !primaryActionDisabled && styles.cardPressed,
          ]}
        >
          {primaryActionIcon}
          <Text style={styles.primaryButtonText}>{primaryActionLabel}</Text>
        </Pressable>
      ) : null}

      {secondaryAction ? (
        <Pressable
          onPress={secondaryAction.onPress}
          style={({ pressed }) => [
            styles.secondaryButton,
            secondaryAction.tone === "danger" && styles.secondaryButtonDanger,
            pressed && styles.cardPressed,
          ]}
        >
          {secondaryAction.icon}
          <Text
            style={[
              styles.secondaryButtonText,
              secondaryAction.tone === "danger" &&
                styles.secondaryButtonTextDanger,
            ]}
          >
            {secondaryAction.label}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
};

const styles = StyleSheet.create({
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  heroHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: appColors.surfaceGhost,
    borderWidth: 1,
    borderColor: appColors.surfaceGhostStrong,
  },
  heroEyebrow: sharedStyleValues.eyebrow,
  heroTitle: sharedStyleValues.heroTitle,
  heroMeta: sharedStyleValues.metaText,
  heroAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    backgroundColor: appColors.surfaceField,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroActionActive: {
    backgroundColor: appColors.brand500,
    borderColor: appColors.brand500,
  },
  heroActionText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "600",
  },
  heroActionTextActive: {
    color: appColors.white,
  },
  cardX: sharedStyleValues.cardCompact,
  card: sharedStyleValues.cardCompact,
  sectionTitle: sharedStyleValues.sectionTitle,
  fieldLabel: sharedStyleValues.fieldLabel,
  fieldLabelSpacing: sharedStyleValues.fieldLabelSpacing,
  inputRow: sharedStyleValues.inputRow,
  input: {
    ...sharedStyleValues.inputCompact,
    fontVariant: ["tabular-nums"],
  },
  unitPill: sharedStyleValues.unitPill,
  unitText: sharedStyleValues.unitText,
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 10,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 12,
  },
  slotIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.surfaceGhost,
  },
  slotCopy: {
    flex: 1,
  },
  slotLabel: {
    color: appColors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  slotValue: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  slotAction: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "500",
  },
  slotTrailing: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "500",
  },
  formError: {
    color: appColors.danger700,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: 10,
  },
  nutritionGrid: sharedStyleValues.nutritionGrid,
  nutritionCell: sharedStyleValues.nutritionCell,
  nutritionLabel: {
    color: appColors.textSecondary,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  nutritionValue: sharedStyleValues.nutritionValue,
  primaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.buttonWithIcon,
    ...sharedStyleValues.primaryButton,
    marginBottom: 12,
  },
  primaryButtonText: sharedStyleValues.primaryButtonText,
  secondaryButton: {
    ...sharedStyleValues.buttonBase,
    ...sharedStyleValues.buttonWithIcon,
    ...sharedStyleValues.outlineButton,
  },
  secondaryButtonDanger: {
    ...sharedStyleValues.dangerButton,
    backgroundColor: appColors.surfaceCard,
  },
  secondaryButtonText: sharedStyleValues.outlineButtonText,
  secondaryButtonTextDanger: sharedStyleValues.dangerButtonText,
  disabled: sharedStyleValues.disabled,
  cardPressed: sharedStyleValues.pressed,
});

export default FoodEntryForm;
