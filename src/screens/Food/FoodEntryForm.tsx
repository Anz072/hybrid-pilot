import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import { appColors } from "../../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { sharedStyleValues } from "../../theme/sharedStyles";

export type FoodEntryFormPill = {
  key: string;
  label: string;
  icon?: React.ReactNode;
};

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
  heroPills: FoodEntryFormPill[];
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
  heroPills,
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
        {heroPills.length > 0 ? (
          <View style={styles.pillRow}>
            {heroPills.map((pill) => (
              <View key={pill.key} style={styles.pill}>
                {pill.icon}
                <Text style={styles.pillText}>{pill.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
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
              <Text style={styles.nutritionValue}>{item.value}</Text>
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
  heroCard: sharedStyleValues.cardCompact,
  heroHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
  },
  heroHeaderCopy: {
    flex: 1,
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
    borderColor: appColors.borderStrong,
    backgroundColor: appColors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroActionActive: {
    backgroundColor: appColors.brand500,
    borderColor: appColors.brand500,
  },
  heroActionText: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  heroActionTextActive: {
    color: appColors.white,
  },
  pillRow: sharedStyleValues.pillRow,
  pill: sharedStyleValues.pill,
  pillText: sharedStyleValues.pillText,
  previewStrip: {
    borderRadius: 8,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  previewValue: {
    color: appColors.white,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 2,
  },
  previewText: {
    color: appColors.brand300,
    fontSize: 12,
    lineHeight: 16,
  },
  cardX: sharedStyleValues.cardCompact,
  card: sharedStyleValues.cardCompact,
  sectionTitle: sharedStyleValues.sectionTitle,
  sectionSubtitle: sharedStyleValues.sectionSubtitle,
  fieldLabel: sharedStyleValues.fieldLabel,
  fieldLabelSpacing: sharedStyleValues.fieldLabelSpacing,
  inputRow: sharedStyleValues.inputRow,
  input: sharedStyleValues.inputCompact,
  unitPill: sharedStyleValues.unitPill,
  unitText: sharedStyleValues.unitText,
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    padding: 11,
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
    color: appColors.slate300,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  slotValue: {
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "900",
  },
  slotAction: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  slotTrailing: {
    color: appColors.brand500,
    fontSize: 12,
    fontWeight: "800",
  },
  formError: {
    color: appColors.danger700,
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 17,
    marginTop: 10,
  },
  nutritionGrid: sharedStyleValues.nutritionGrid,
  nutritionCell: sharedStyleValues.nutritionCell,
  nutritionLabel: {
    color: appColors.slate600,
    fontSize: 8,
    fontWeight: "800",
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

