import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { KeyboardTypeOptions } from "react-native";
import FoodScreenHeader from "./FoodScreenHeader";
import { appColors } from "../../theme/colors";

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
  slot,
}: FoodEntryFormProps) => {
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
      <FoodScreenHeader
        eyebrow={headerEyebrow}
        title={headerTitle}
        subtitle={headerSubtitle}
        onBack={onBack}
      />

      <View style={styles.heroCard}>
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

        <View style={styles.previewStrip}>
          <Text style={styles.previewValue}>{previewCaloriesText}</Text>
          <Text style={styles.previewText}>{previewSummaryText}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{detailsTitle}</Text>
        <Text style={styles.sectionSubtitle}>{detailsSubtitle}</Text>

        <Text style={styles.fieldLabel}>{amountLabel}</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={amountValue}
            onChangeText={onChangeAmount}
            keyboardType={amountKeyboardType}
            placeholder={amountPlaceholder}
            placeholderTextColor={appColors.foodPlaceholder}
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

        <Text style={[styles.fieldLabel, styles.fieldLabelSpacing]}>
          {labelFieldLabel}
        </Text>
        <TextInput
          style={styles.input}
          value={labelValue}
          onChangeText={onChangeLabel}
          placeholder={labelPlaceholder}
          placeholderTextColor={appColors.foodPlaceholder}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{previewTitle}</Text>
        <Text style={styles.sectionSubtitle}>{previewSubtitle}</Text>
        <View style={styles.nutritionGrid}>
          {nutritionItems.map((item) => (
            <View key={item.label} style={styles.nutritionCell}>
              <Text style={styles.nutritionLabel}>{item.label}</Text>
              <Text style={styles.nutritionValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

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
  heroCard: {
    backgroundColor: appColors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
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
  heroEyebrow: {
    alignSelf: "flex-start",
    color: appColors.foodPrimary,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  heroTitle: {
    color: appColors.foodText,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 3,
  },
  heroMeta: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  heroAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    backgroundColor: appColors.white,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  heroActionActive: {
    backgroundColor: appColors.foodPrimary,
    borderColor: appColors.foodPrimary,
  },
  heroActionText: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  heroActionTextActive: {
    color: appColors.white,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pillText: {
    color: appColors.foodPrimary,
    fontSize: 11,
    fontWeight: "800",
  },
  previewStrip: {
    borderRadius: 8,
    backgroundColor: appColors.foodPrimaryDark,
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
    color: appColors.foodPreviewText,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    backgroundColor: appColors.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: {
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 2,
  },
  sectionSubtitle: {
    color: appColors.foodMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  fieldLabel: {
    color: appColors.foodLabel,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  fieldLabelSpacing: {
    marginTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: appColors.foodText,
    fontSize: 14,
    fontWeight: "700",
  },
  unitPill: {
    borderRadius: 8,
    backgroundColor: appColors.foodPillBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  unitText: {
    color: appColors.foodPrimary,
    fontSize: 13,
    fontWeight: "800",
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    padding: 11,
  },
  slotIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.foodPillBg,
  },
  slotCopy: {
    flex: 1,
  },
  slotLabel: {
    color: appColors.foodLabel,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  slotValue: {
    color: appColors.foodText,
    fontSize: 15,
    fontWeight: "900",
  },
  slotAction: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  slotTrailing: {
    color: appColors.foodPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  nutritionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nutritionCell: {
    width: "47%",
    borderRadius: 8,
    backgroundColor: appColors.foodFieldBg,
    borderWidth: 1,
    borderColor: appColors.foodSoftBorder,
    padding: 10,
  },
  nutritionLabel: {
    color: appColors.foodLabel,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  nutritionValue: {
    color: appColors.foodText,
    fontSize: 16,
    fontWeight: "900",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: appColors.foodPrimaryDark,
    paddingVertical: 13,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: appColors.white,
    borderWidth: 1,
    borderColor: appColors.foodBorder,
    paddingVertical: 13,
  },
  secondaryButtonDanger: {
    borderColor: appColors.dangerBorder,
  },
  secondaryButtonText: {
    color: appColors.foodInk,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButtonTextDanger: {
    color: appColors.danger700,
  },
  disabled: {
    opacity: 0.58,
  },
  cardPressed: {
    opacity: 0.9,
  },
});

export default FoodEntryForm;
