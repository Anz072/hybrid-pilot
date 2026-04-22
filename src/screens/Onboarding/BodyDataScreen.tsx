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
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RulerIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import type {
  BodyData,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import {
  buildBirthdateIsoString,
  formatDateToYmd,
  getAgeToday,
  parseBirthdateValue,
} from "../../helpers";
import { formatGoalRateKg } from "./initialCalculations";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingTopBar from "./OnboardingTopBar";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<OnboardingParamList, "BodyData">;

const resolveInitialBirthdate = (value?: string): Date => {
  const parsed = parseBirthdateValue(value);
  if (parsed) {
    return parsed;
  }

  return new Date(1998, 0, 1);
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

  const openDatePicker = () => {
    setShowDatePicker(true);
  };

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
      goalRateKgPerWeek: route.params.goalRateKgPerWeek,
      bodyData,
      training: route.params.training,
      proteinFocus: route.params.proteinFocus,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(172, insets.bottom + 140) },
        ]}
        focusedInputBottomOffset={128}
      >
        <OnboardingTopBar
          onBack={() => navigation.goBack()}
          stepLabel="Body Data"
        />
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <RulerIcon size={22} color={appColors.sky700} weight="fill" />
            <Text style={styles.eyebrow}>Body Data</Text>
          </View>
          <Text style={styles.title}>Body basics</Text>
          <Text style={styles.subtitle}>
            Quick setup for a better TDEE estimate. We use your birthdate to
            calculate age automatically.
          </Text>
          {route.params.goalRateKgPerWeek != null ? (
            <Text style={styles.contextNote}>
              Target pace selected: {formatGoalRateKg(route.params.goalRateKgPerWeek)} kg per week.
            </Text>
          ) : null}
        </View>

        <View style={styles.formCard}>
          <View>
            <Text style={styles.sectionLabelx}>Birthdate</Text>
            <Pressable
              style={styles.input}
              onPress={openDatePicker}
            >
              <Text style={styles.birthdateText}>{formattedBirthdate}</Text>
            </Pressable>
            <Text style={styles.ageHint}>
              Age used for calculations: {derivedAge} years
            </Text>
            {showDatePicker ? (
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  value={selectedBirthdate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  maximumDate={maxBirthdate}
                  minimumDate={minBirthdate}
                  onChange={handleDateChange}
                />
                {Platform.OS === "ios" ? (
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    style={styles.pickerDoneButton}
                  >
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
          <View>
            <Text style={styles.sectionLabelx}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              placeholder="Height (cm)"
              placeholderTextColor={appColors.slate400}
            />
          </View>
          <View>
            <Text style={styles.sectionLabelx}>Weight (kg)</Text>
            <TextInput
              style={styles.input}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              placeholder="Weight (kg)"
              placeholderTextColor={appColors.slate400}
            />
          </View>
          <Text style={styles.sectionLabel}>Sex</Text>
          <View style={styles.sexRow}>
            {(["female", "male", "other"] as const).map((value) => (
              <Pressable
                key={value}
                style={({ pressed }) => [
                  styles.sexChip,
                  sex === value && styles.sexChipActive,
                  pressed && styles.sexChipPressed,
                ]}
                onPress={() => setSex(value)}
              >
                <Text
                  style={[
                    styles.sexChipText,
                    sex === value && styles.sexChipTextActive,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </KeyboardAwareScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 6 }]}>
        <OnboardingPrimaryButton label="Next" onPress={handleNext} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
  },
  footer: {
    paddingTop: 12,
  },
  bgOrbTop: {
    position: "absolute",
    top: -60,
    right: -42,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: appColors.blueSoftBg,
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -80,
    left: -60,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: appColors.foodEyebrowBg,
  },
  headerWrap: {
    marginTop: 18,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.sky800,
    backgroundColor: appColors.skySoftBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: appColors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: appColors.slate600,
  },
  contextNote: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: appColors.teal700,
    fontWeight: "700",
  },
  formCard: {
    backgroundColor: appColors.surfaceCanvasAlt,
    borderRadius: 8,
    padding: 14,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: appColors.lavenderBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: appColors.surfaceCanvasAlt,
    color: appColors.textPrimary,
    fontSize: 18,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  sectionLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: appColors.slate500,
  },
  sectionLabelx: {
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: appColors.slate500,
  },
  birthdateText: {
    color: appColors.textPrimary,
    fontSize: 18,
    letterSpacing: 0.5,
    fontWeight: "600",
  },
  ageHint: {
    marginTop: 8,
    marginLeft: 4,
    color: appColors.slate600,
    fontSize: 12,
    fontWeight: "700",
  },
  pickerWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: appColors.lavenderBorder,
    borderRadius: 8,
    paddingVertical: 8,
  },
  pickerDoneButton: {
    alignSelf: "flex-end",
    marginRight: 12,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pickerDoneText: {
    color: appColors.slate900,
    fontWeight: "700",
  },
  sexRow: {
    flexDirection: "row",
    gap: 8,
  },
  sexChip: {
    borderWidth: 1,
    borderColor: appColors.lavenderBorder,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: appColors.white,
  },
  sexChipActive: {
    backgroundColor: appColors.slate900,
    borderColor: appColors.textPrimary,
  },
  sexChipPressed: {
    opacity: 0.88,
  },
  sexChipText: {
    color: appColors.slate700,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  sexChipTextActive: {
    color: appColors.white,
  },
});

export default BodyDataScreen;
