import React, { useState } from "react";
import {
  ActivityIndicator,
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
  type LocalAccount,
} from "../../storage/localStore";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "../../API/supabase/client";
import {
  getGoogleDisplayName,
  signInWithGoogleViaSupabase,
} from "../../API/supabase/googleAuth";
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
import { appTypography } from "../../theme/typography";

type Props = NativeStackScreenProps<OnboardingParamList, "Account">;

const AccountScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [submissionMode, setSubmissionMode] = useState<
    "local" | "google" | null
  >(null);

  const normalizedEmail = email.trim();
  const isSaving = submissionMode !== null;
  const canCreateLocalAccount =
    displayName.trim().length > 0 && normalizedEmail.length > 0;

  const completeOnboardingAccount = async (account: LocalAccount) => {
    const onboarding = route.params.onboarding;
    const persistedAccount: LocalAccount = {
      ...account,
      birthdate: onboarding.bodyData.birthdate,
    };
    const nextUser = {
      id: 0,
      externalId: persistedAccount.id,
      provider: persistedAccount.provider,
      displayName: persistedAccount.displayName,
      createdAt: persistedAccount.createdAt,
      email: persistedAccount.email,
      birthdate: persistedAccount.birthdate,
      gender: onboarding.bodyData.sex,
      heightCm: onboarding.bodyData.heightCm,
      activityLevel: onboarding.activity,
      goal: onboarding.goal,
      trainingTypes: onboarding.training,
      calorieAllowance: onboarding.fuelPlan.calories,
      proteinG: onboarding.fuelPlan.protein,
      carbsG: onboarding.fuelPlan.carbs,
      fatG: onboarding.fuelPlan.fats,
    };

    await saveLocalAccount(persistedAccount);
    await saveOnboardingProfile(onboarding);
    await setOnboardingComplete(true);
    await DB.addUser(nextUser);

    const initialWeightDate = new Date();
    const initialWeightEntryId = `${persistedAccount.id}-initial-weight`;
    const initialWeightKg = onboarding.bodyData.weightKg;

    await DB.saveWeightEntry({
      id: initialWeightEntryId,
      userExternalId: persistedAccount.id,
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

    const savedUser = await DB.getUserByExternalId(persistedAccount.id);
    dispatch(setCurrentUser(savedUser ?? nextUser));

    navigation.push("Success", { onboarding });
  };

  const handleCreateLocalAccount = async () => {
    if (!canCreateLocalAccount || isSaving) {
      return;
    }

    if (!normalizedEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    setSubmissionMode("local");

    try {
      const account = buildLocalAccount({
        displayName: displayName.trim(),
        email: normalizedEmail,
        birthdate: route.params.onboarding.bodyData.birthdate,
      });

      await completeOnboardingAccount(account);
    } catch {
      Alert.alert("Could not save account", "Please try again.");
    } finally {
      setSubmissionMode(null);
    }
  };

  const handleCreateGoogleAccount = async () => {
    if (isSaving) {
      return;
    }

    setSubmissionMode("google");

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(getSupabaseConfigError());
      }

      const session = await signInWithGoogleViaSupabase();
      if (!session?.user) {
        return;
      }

      const googleEmail =
        session.user.email ??
        (normalizedEmail.length > 0 ? normalizedEmail : null);
      if (!googleEmail || !googleEmail.includes("@")) {
        throw new Error("Google did not return a valid email address.");
      }

      const account: LocalAccount = {
        id: session.user.id,
        provider: "google",
        displayName: getGoogleDisplayName(
          session.user,
          displayName.trim() || undefined,
        ),
        email: googleEmail,
        birthdate: route.params.onboarding.bodyData.birthdate,
        createdAt:
          typeof session.user.created_at === "string" &&
          session.user.created_at.length > 0
            ? session.user.created_at
            : new Date().toISOString(),
      };

      setDisplayName(account.displayName);
      setEmail(account.email ?? "");

      await completeOnboardingAccount(account);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not create your Google account.";

      Alert.alert("Google account failed", message);
    } finally {
      setSubmissionMode(null);
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
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Finish with a local account or use Google. Either way, this onboarding
          plan, including your birthdate from body data, is saved on this
          device.
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
                  bodyData: route.params.onboarding.bodyData,
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

          <OnboardingPrimaryButton
            label={
              submissionMode === "local" ? "Saving..." : "Create local account"
            }
            disabled={!canCreateLocalAccount || isSaving}
            style={styles.primaryButton}
            onPress={() => void handleCreateLocalAccount()}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable
            disabled={isSaving}
            onPress={() => {
              void handleCreateGoogleAccount();
            }}
            style={({ pressed }) => [
              styles.googleButton,
              isSaving && styles.googleButtonDisabled,
              pressed && !isSaving && styles.googleButtonPressed,
            ]}
          >
            {submissionMode === "google" ? (
              <ActivityIndicator color={appColors.foodPrimaryDark} />
            ) : null}
            <Text style={styles.googleButtonText}>
              {submissionMode === "google"
                ? "Connecting Google..."
                : "Create with Google"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
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
    color: appColors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: appColors.slate600,
    marginBottom: 14,
  },
  card: {
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
  primaryButton: {
    marginTop: 32,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: appColors.slate200,
  },
  dividerText: {
    ...appTypography.label,
    color: appColors.slate500,
  },
  googleHint: {
    ...appTypography.bodySmall,
    color: appColors.slate600,
    marginTop: 14,
    marginBottom: 12,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 9999,
    backgroundColor: appColors.revolutBlue,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonPressed: {
    opacity: 0.9,
  },
  googleButtonText: {
    ...appTypography.button,
    color: appColors.textPrimary,
  },
});

export default AccountScreen;
