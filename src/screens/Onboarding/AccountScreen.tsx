import React, { useMemo, useState } from "react";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import {
  buildLocalAccount,
  saveLocalAccount,
  saveOnboardingProfile,
  setOnboardingComplete,
} from "../../storage/localStore";
import { DB } from "../../store/DB";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import {
  generateUuid,
  getZoneOffsetMinutes,
  toLocalIsoWithOffset,
} from "../Weight/weightUtils";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingTopBar from "./OnboardingTopBar";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
  formatTrainingSummary,
} from "./onboardingSummary";
import { appColors } from "../../theme/colors";

type Props = NativeStackScreenProps<OnboardingParamList, "Account">;

const formatDateToYmd = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const AccountScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [selectedBirthdate, setSelectedBirthdate] = useState(
    new Date(1998, 0, 1),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const normalizedEmail = email.trim();
  const normalizedBirthdate = birthdate.trim();
  const canSubmit =
    displayName.trim().length > 0 &&
    normalizedEmail.length > 0 &&
    normalizedBirthdate.length > 0;

  const minBirthdate = useMemo(() => new Date(1900, 0, 1), []);
  const maxBirthdate = useMemo(() => new Date(), []);

  const parseBirthdateToIso = (value: string): string | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const date = new Date(value + "T00:00:00.000Z");
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString();
  };

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
    setBirthdate(formatDateToYmd(date));
  };

  const handleCreateLocalAccount = async () => {
    if (!canSubmit || isSaving) {
      return;
    }

    const parsedBirthdate = parseBirthdateToIso(normalizedBirthdate);
    if (!parsedBirthdate) {
      Alert.alert("Invalid birthdate", "Use format YYYY-MM-DD.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    setIsSaving(true);

    try {
      const account = buildLocalAccount({
        displayName: displayName.trim(),
        email: normalizedEmail,
        birthdate: parsedBirthdate,
      });

      await saveLocalAccount(account);
      await saveOnboardingProfile(route.params.onboarding);
      await setOnboardingComplete(true);

      await DB.addUser({
        id: 0,
        externalId: account.id,
        provider: account.provider,
        displayName: account.displayName,
        createdAt: account.createdAt,
        email: account.email,
        birthdate: account.birthdate,
        gender: route.params.onboarding.bodyData.sex,
        heightCm: route.params.onboarding.bodyData.heightCm,
        activityLevel: route.params.onboarding.activity,
        goal: route.params.onboarding.goal,
        trainingTypes: route.params.onboarding.training,
        calorieAllowance: route.params.onboarding.fuelPlan.calories,
        proteinG: route.params.onboarding.fuelPlan.protein,
        carbsG: route.params.onboarding.fuelPlan.carbs,
        fatG: route.params.onboarding.fuelPlan.fats,
      });

      const initialWeightDate = new Date();
      const initialWeightEntryId = `${account.id}-initial-weight`;
      const initialWeightKg = route.params.onboarding.bodyData.weightKg;

      await DB.saveWeightEntry({
        id: initialWeightEntryId,
        userExternalId: account.id,
        measuredAt: initialWeightDate.toISOString(),
        measuredAtLocalIso: toLocalIsoWithOffset(initialWeightDate),
        zoneOffsetMinutes: getZoneOffsetMinutes(initialWeightDate),
        valueKg: initialWeightKg,
        valueOriginal: initialWeightKg,
        unitOriginal: "kg",
        source: "manual",
        notes: null,
        clientGeneratedId: initialWeightEntryId,
        deviceId: generateUuid(),
      });

      const user = await DB.getUser();
      dispatch(setCurrentUser(user));

      navigation.push("Success", { onboarding: route.params.onboarding });
    } catch {
      Alert.alert("Could not save account", "Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      enabled
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <OnboardingTopBar
          onBack={() => navigation.goBack()}
          stepLabel="Account"
        />
        <Text style={styles.eyebrow}>Final Step</Text>
        <Text style={styles.title}>Create local account</Text>
        <Text style={styles.subtitle}>
          Saved only on this device for now so your onboarding progress stays local.
        </Text>

        <OnboardingReviewCard
          title="Review onboarding"
          items={[
            {
              label: "Goal",
              value: formatGoalSummary(
                route.params.onboarding.goal,
                route.params.onboarding.goalRateKgPerWeek,
              ),
              onEdit: () => navigation.push("Goal"),
            },
            {
              label: "Body data",
              value: formatBodySummary(route.params.onboarding.bodyData),
              onEdit: () =>
                navigation.push("BodyData", {
                  goal: route.params.onboarding.goal,
                  goalRateKgPerWeek: route.params.onboarding.goalRateKgPerWeek,
                }),
            },
            {
              label: "Activity",
              value: formatActivitySummary(route.params.onboarding.activity),
              onEdit: () =>
                navigation.push("Activity", {
                  goal: route.params.onboarding.goal,
                  goalRateKgPerWeek: route.params.onboarding.goalRateKgPerWeek,
                  bodyData: route.params.onboarding.bodyData,
                }),
            },
            {
              label: "Training",
              value: formatTrainingSummary(route.params.onboarding.training),
              onEdit: () =>
                navigation.push("Training", {
                  goal: route.params.onboarding.goal,
                  goalRateKgPerWeek: route.params.onboarding.goalRateKgPerWeek,
                  bodyData: route.params.onboarding.bodyData,
                  activity: route.params.onboarding.activity,
                  training: route.params.onboarding.training,
                }),
            },
          ]}
        />

        <View style={styles.card}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your display name"
            autoCapitalize="words"
            style={styles.input}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@email.com"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Text style={styles.label}>Birthdate</Text>
          <Pressable onPress={openDatePicker} style={styles.input}>
            <Text
              style={
                birthdate ? styles.birthdateText : styles.birthdatePlaceholder
              }
            >
              {birthdate || "Select your birthdate"}
            </Text>
          </Pressable>

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

          <OnboardingPrimaryButton
            label={isSaving ? "Saving..." : "Create local account"}
            disabled={!canSubmit || isSaving}
            style={styles.primaryButton}
            onPress={() => void handleCreateLocalAccount()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.slate50,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 36,
    paddingBottom: 26,
    flexGrow: 1,
  },
  eyebrow: {
    alignSelf: "flex-start",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: appColors.foodPrimary,
    backgroundColor: appColors.foodEyebrowBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: appColors.slate900,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: appColors.slate600,
    marginBottom: 14,
  },
  card: {
    backgroundColor: appColors.white,
    borderRadius: 6,
    padding: 16,
  },
  label: {
    marginTop: 12,
    marginBottom: 2,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: appColors.slate500,
  },
  input: {
    borderWidth: 1,
    borderColor: appColors.charcoal,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: appColors.white,
    color: appColors.slate900,
    fontSize: 16,
    letterSpacing: 0.2,
    fontWeight: "600",
  },
  birthdateText: {
    color: appColors.slate900,
    fontSize: 16,
    fontWeight: "600",
  },
  birthdatePlaceholder: {
    color: appColors.slate400,
    fontSize: 16,
    fontWeight: "600",
  },
  pickerWrap: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: appColors.slate200,
    borderRadius: 12,
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
  primaryButton: {
    marginTop: 48,
  },
});

export default AccountScreen;
