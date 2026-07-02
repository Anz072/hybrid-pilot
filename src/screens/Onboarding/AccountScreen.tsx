import React, { useState } from "react";
import {
  ActivityIndicator,
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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import {
  saveLocalAccount,
  saveOnboardingProfile,
  setOnboardingComplete,
  type LocalAccount,
} from "../../storage/localStore";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "../../API/supabase/client";
import { signUpWithEmailPassword } from "../../API/supabase/auth";
import { DB } from "../../store/DB";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import {
  generateUuid,
  getZoneOffsetMinutes,
  toLocalIsoWithOffset,
} from "../Weight/weightUtils";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingTopBar from "./OnboardingTopBar";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
  formatProteinFocusSummary,
  formatTrainingSummary,
} from "./onboardingSummary";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";

type Props = NativeStackScreenProps<OnboardingParamList, "Account">;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const validateEmailPassword = (email: string, password: string) => {
  if (!email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
};

const AccountScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isSaving = isSubmitting;

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
      goalStrategy: onboarding.goalStrategy,
      trainingTypes: onboarding.training,
      proteinFocus: onboarding.proteinFocus,
      calorieAllowance: onboarding.fuelPlan.calories,
      proteinG: onboarding.fuelPlan.protein,
      carbsG: onboarding.fuelPlan.carbs,
      fatG: onboarding.fuelPlan.fats,
    };

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

    await saveLocalAccount(persistedAccount);
    await saveOnboardingProfile(onboarding);
    await setOnboardingComplete(true);

    const savedUser = await DB.getUserByExternalId(persistedAccount.id);
    dispatch(setCurrentUser(savedUser ?? nextUser));

    navigation.push("Success", { onboarding });
  };

  const handleCreateEmailAccount = async () => {
    if (isSaving) {
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(getSupabaseConfigError());
      }

      const normalizedEmail = normalizeEmail(email);
      validateEmailPassword(normalizedEmail, password);

      const resolvedDisplayName =
        displayName.trim() || normalizedEmail.split("@")[0] || "Dribsnis User";
      const result = await signUpWithEmailPassword({
        displayName: resolvedDisplayName,
        email: normalizedEmail,
        password,
      });

      if (result.needsEmailConfirmation || !result.session?.user) {
        const message =
          "Check your email to confirm the account, then return and sign in.";
        setStatusMessage(message);
        Alert.alert("Check your email", message);
        return;
      }

      const account: LocalAccount = {
        id: result.session.user.id,
        provider: "email",
        displayName: resolvedDisplayName,
        email: result.session.user.email ?? normalizedEmail,
        birthdate: route.params.onboarding.bodyData.birthdate,
        createdAt:
          typeof result.session.user.created_at === "string" &&
          result.session.user.created_at.length > 0
            ? result.session.user.created_at
            : new Date().toISOString(),
      };

      setDisplayName(account.displayName);
      await completeOnboardingAccount(account);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not create your email account.";

      Alert.alert("Email account failed", message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      enabled
      style={styles.container}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
      >
        <OnboardingTopBar
          onBack={() => navigation.goBack()}
          stepLabel="Account"
        />
        <Text style={styles.eyebrow}>Final Step</Text>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Finish with a Supabase-backed email account so your plan, logs, and
          progress stay tied to one profile.
        </Text>

        <OnboardingReviewCard
          title="Review onboarding"
          items={[
            {
              label: "Goal",
              value: formatGoalSummary(
                route.params.onboarding.goal,
                route.params.onboarding.goalStrategy,
              ),
              onEdit: () => navigation.push("Goal"),
            },
            {
              label: "Body data",
              value: formatBodySummary(route.params.onboarding.bodyData),
              onEdit: () =>
                navigation.push("BodyData", {
                  goal: route.params.onboarding.goal,
                  goalStrategy: route.params.onboarding.goalStrategy,
                  bodyData: route.params.onboarding.bodyData,
                  training: route.params.onboarding.training,
                  proteinFocus: route.params.onboarding.proteinFocus,
                }),
            },
            {
              label: "Activity",
              value: formatActivitySummary(route.params.onboarding.activity),
              onEdit: () =>
                navigation.push("Activity", {
                  goal: route.params.onboarding.goal,
                  goalStrategy: route.params.onboarding.goalStrategy,
                  bodyData: route.params.onboarding.bodyData,
                  training: route.params.onboarding.training,
                  proteinFocus: route.params.onboarding.proteinFocus,
                }),
            },
            {
              label: "Training",
              value: formatTrainingSummary(route.params.onboarding.training),
              onEdit: () =>
                navigation.push("Training", {
                  goal: route.params.onboarding.goal,
                  goalStrategy: route.params.onboarding.goalStrategy,
                  bodyData: route.params.onboarding.bodyData,
                  activity: route.params.onboarding.activity,
                  training: route.params.onboarding.training,
                  proteinFocus: route.params.onboarding.proteinFocus,
                }),
            },
            {
              label: "Protein focus",
              value: formatProteinFocusSummary(
                route.params.onboarding.proteinFocus,
              ),
              onEdit: () =>
                navigation.push("ProteinFocus", {
                  goal: route.params.onboarding.goal,
                  goalStrategy: route.params.onboarding.goalStrategy,
                  bodyData: route.params.onboarding.bodyData,
                  activity: route.params.onboarding.activity,
                  training: route.params.onboarding.training,
                  proteinFocus: route.params.onboarding.proteinFocus,
                }),
            },
          ]}
        />

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={displayName}
            onChangeText={(value) => {
              setDisplayName(value);
              setStatusMessage(null);
            }}
            editable={!isSaving}
            placeholder="Your name"
            placeholderTextColor={appColors.textMuted}
            style={styles.input}
            returnKeyType="next"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              setStatusMessage(null);
            }}
            editable={!isSaving}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={appColors.textMuted}
            style={styles.input}
            textContentType="emailAddress"
            returnKeyType="next"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setStatusMessage(null);
            }}
            editable={!isSaving}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            placeholder="Minimum 6 characters"
            placeholderTextColor={appColors.textMuted}
            style={styles.input}
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => {
              void handleCreateEmailAccount();
            }}
          />

          <Pressable
            disabled={isSaving}
            onPress={() => {
              void handleCreateEmailAccount();
            }}
            style={({ pressed }) => [
              styles.emailButton,
              isSaving && styles.buttonDisabled,
              pressed && !isSaving && styles.buttonPressed,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color={appColors.slate900} />
            ) : null}
            <Text style={styles.emailButtonText}>
              {isSaving ? "Creating account..." : "Create account"}
            </Text>
          </Pressable>

          {statusMessage ? (
            <Text style={styles.statusText}>{statusMessage}</Text>
          ) : null}
        </View>
      </KeyboardAwareScrollView>
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
    color: appColors.brand500,
    backgroundColor: appColors.brand800,
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
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: appColors.slate100,
    color: appColors.slate800,
    fontSize: 16,
    letterSpacing: 0.2,
    fontWeight: "600",
  },
  emailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 8,
    backgroundColor: appColors.slate50,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginTop: 18,
  },
  emailButtonText: {
    ...appTypography.button,
    color: appColors.slate900,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  statusText: {
    ...appTypography.bodySmall,
    color: appColors.slate600,
    marginTop: 12,
  },
});

export default AccountScreen;
