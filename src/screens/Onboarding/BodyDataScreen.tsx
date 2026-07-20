import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
  Chip,
  NumericText,
} from "../../components/ui";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { formatGoalStrategyMeta } from "../../engine/goalStrategy";
import {
  buildBirthdateIsoString,
  formatDateToYmd,
  getAgeToday,
  parseBirthdateValue,
} from "../../helpers";
import type {
  BodyData,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import { appBorders, appRadius, appSpacing, appSurfaces } from "../../theme/tokens";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingTopBar from "./OnboardingTopBar";
import { onboardingStepProgress } from "./OnboardingStepScreen";

type Props = NativeStackScreenProps<OnboardingParamList, "BodyData">;

const resolveInitialBirthdate = (value?: string): Date => {
  const parsed = parseBirthdateValue(value);
  return parsed ?? new Date(1998, 0, 1);
};

const BodyDataScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const [selectedBirthdate, setSelectedBirthdate] = React.useState<Date>(() =>
    resolveInitialBirthdate(route.params.bodyData?.birthdate),
  );
  const [heightCm, setHeightCm] = React.useState(
    route.params.bodyData ? String(route.params.bodyData.heightCm) : "168",
  );
  const [weightKg, setWeightKg] = React.useState(
    route.params.bodyData ? String(route.params.bodyData.weightKg) : "77",
  );
  const [sex, setSex] = React.useState<BodyData["sex"]>(
    route.params.bodyData?.sex ?? "female",
  );
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const minBirthdate = React.useMemo(() => new Date(1900, 0, 1), []);
  const maxBirthdate = React.useMemo(() => new Date(), []);
  const formattedBirthdate = React.useMemo(
    () => formatDateToYmd(selectedBirthdate),
    [selectedBirthdate],
  );
  const derivedAge = React.useMemo(
    () => getAgeToday(selectedBirthdate),
    [selectedBirthdate],
  );

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type !== "set" || !date) {
      return;
    }

    setSelectedBirthdate(date);
  };

  const handleNext = () => {
    const parsedHeight = Number(heightCm);
    const parsedWeight = Number(weightKg);

    if (!Number.isFinite(derivedAge) || derivedAge < 13 || derivedAge > 100) {
      Alert.alert(
        "Check your birthdate",
        "Select a birthdate that makes you between 13 and 100 years old.",
      );
      return;
    }

    if (!Number.isFinite(parsedHeight) || parsedHeight < 120 || parsedHeight > 250) {
      Alert.alert("Check your height", "Enter a height between 120 and 250 cm.");
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight < 35 || parsedWeight > 300) {
      Alert.alert("Check your weight", "Enter a weight between 35 and 300 kg.");
      return;
    }

    const bodyData: BodyData = {
      birthdate: buildBirthdateIsoString(selectedBirthdate),
      heightCm: parsedHeight,
      weightKg: parsedWeight,
      sex,
    };

    navigation.push("Activity", {
      goal: route.params.goal,
      goalStrategy: route.params.goalStrategy,
      bodyData,
      training: route.params.training,
      proteinFocus: route.params.proteinFocus,
    });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      style={styles.screen}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + appSpacing.md,
            paddingBottom: Math.max(172, insets.bottom + 140),
          },
        ]}
        focusedInputBottomOffset={128}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingTopBar
          onBack={() => navigation.goBack()}
          progress={onboardingStepProgress(4)}
          stepLabel="Body Data"
        />
        <View style={styles.header}>
          <AppText color="coral" variant="eyebrow">
            Body Data
          </AppText>
          <AppText variant="sectionTitleLarge">Body basics</AppText>
          <AppText color="secondary" variant="bodySmall">
            Quick setup for a better TDEE estimate. We use your birthdate to
            calculate age automatically.
          </AppText>
          <AppText color="success" style={styles.contextNote} variant="metadata">
            Selected approach:{" "}
            {formatGoalStrategyMeta(route.params.goal, route.params.goalStrategy)}.
          </AppText>
        </View>

        <AppCard style={styles.formCard} variant="soft">
          <View>
            <AppText color="secondary" variant="eyebrow">
              Birthdate
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDatePicker(true)}
              style={({ pressed }) => [
                styles.dateButton,
                pressed && styles.pressed,
              ]}
            >
              <NumericText style={styles.inputValue} variant="numberWeightEntry">
                {formattedBirthdate}
              </NumericText>
            </Pressable>
            <AppText color="secondary" style={styles.hint} variant="metadata">
              Age used for calculations: {derivedAge} years
            </AppText>
            {showDatePicker ? (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={maxBirthdate}
                  minimumDate={minBirthdate}
                  mode="date"
                  onChange={handleDateChange}
                  value={selectedBirthdate}
                />
                {Platform.OS === "ios" ? (
                  <AppButton
                    label="Done"
                    onPress={() => setShowDatePicker(false)}
                    size="sm"
                    style={styles.pickerDoneButton}
                    variant="secondary"
                  />
                ) : null}
              </View>
            ) : null}
          </View>

          <AppInput
            keyboardType="numeric"
            label="Height (cm)"
            onChangeText={setHeightCm}
            placeholder="Height (cm)"
            value={heightCm}
          />
          <AppInput
            keyboardType="numeric"
            label="Weight (kg)"
            onChangeText={setWeightKg}
            placeholder="Weight (kg)"
            value={weightKg}
          />

          <View style={styles.sexGroup}>
            <AppText color="secondary" variant="eyebrow">
              Sex
            </AppText>
            <View style={styles.sexRow}>
              {(["female", "male", "other"] as const).map((value) => (
                <Chip
                  key={value}
                  label={value}
                  onPress={() => setSex(value)}
                  selected={sex === value}
                  style={styles.sexChip}
                />
              ))}
            </View>
          </View>
        </AppCard>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + appSpacing.xs }]}>
        <OnboardingPrimaryButton label="Next" onPress={handleNext} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appSurfaces.canvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: appSpacing.gutter,
  },
  header: {
    gap: appSpacing.xs,
    marginBottom: appSpacing.xl,
  },
  contextNote: {
    marginTop: appSpacing.xxs,
  },
  formCard: {
    gap: appSpacing.md,
  },
  dateButton: {
    minHeight: 48,
    justifyContent: "center",
    borderWidth: appBorders.width,
    borderColor: "transparent",
    borderRadius: appRadius.md,
    backgroundColor: appSurfaces.soft,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: appSpacing.xs,
  },
  inputValue: {
    ...appTypography.bodyStrong,
    textAlign: "left",
  },
  hint: {
    marginTop: appSpacing.xs,
  },
  pickerWrap: {
    marginTop: appSpacing.xs,
    borderWidth: appBorders.width,
    borderColor: appColors.borderSoft,
    borderRadius: appRadius.md,
    padding: appSpacing.xs,
  },
  pickerDoneButton: {
    alignSelf: "flex-end",
    marginTop: appSpacing.xs,
  },
  sexGroup: {
    gap: appSpacing.xs,
  },
  sexRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appSpacing.xs,
  },
  sexChip: {
    minWidth: 84,
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: appSpacing.gutter,
    paddingTop: appSpacing.sm,
    backgroundColor: appColors.surfaceCard,
    borderTopWidth: appBorders.width,
    borderTopColor: appColors.borderSoft,
  },
  pressed: {
    opacity: 0.9,
  },
});

export default BodyDataScreen;
