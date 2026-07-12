import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppInput, AppText } from "../../components/ui";
import {
  signUpWithEmailPassword,
} from "../../API/supabase/auth";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "../../API/supabase/client";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import { DB } from "../../store/DB";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import {
  saveLocalAccount,
  saveOnboardingProfile,
  setOnboardingComplete,
  type LocalAccount,
} from "../../storage/localStore";
import { appColors } from "../../theme/colors";
import { appBorders, appSpacing, appSurfaces } from "../../theme/tokens";
import {
  generateUuid,
  getZoneOffsetMinutes,
  toLocalIsoWithOffset,
} from "../Weight/weightUtils";
import OnboardingPrimaryButton from "./OnboardingPrimaryButton";
import OnboardingReviewCard from "./OnboardingReviewCard";
import OnboardingTopBar from "./OnboardingTopBar";
import { onboardingStepProgress } from "./OnboardingStepScreen";
import {
  formatActivitySummary,
  formatBodySummary,
  formatGoalSummary,
  formatProteinFocusSummary,
  formatTrainingSummary,
} from "./onboardingSummary";

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
      enabled
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      style={styles.screen}
    >
      <KeyboardAwareScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + appSpacing.md,
            paddingBottom: insets.bottom + appSpacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingTopBar
          onBack={() => navigation.goBack()}
          progress={onboardingStepProgress(9)}
          stepLabel="Account"
        />
        <View style={styles.header}>
          <AppText color="coral" variant="eyebrow">
            Final Step
          </AppText>
          <AppText variant="sectionTitleLarge">Create your account</AppText>
          <AppText color="secondary" variant="bodySmall">
            Finish with a Supabase-backed email account so your plan, logs, and
            progress stay tied to one profile.
          </AppText>
        </View>

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

        <AppCard style={styles.formCard}>
          <AppInput
            editable={!isSaving}
            label="Name"
            onChangeText={(value) => {
              setDisplayName(value);
              setStatusMessage(null);
            }}
            placeholder="Your name"
            returnKeyType="next"
            value={displayName}
          />
          <AppInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSaving}
            keyboardType="email-address"
            label="Email"
            onChangeText={(value) => {
              setEmail(value);
              setStatusMessage(null);
            }}
            placeholder="you@example.com"
            returnKeyType="next"
            textContentType="emailAddress"
            value={email}
          />
          <AppInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSaving}
            label="Password"
            onChangeText={(value) => {
              setPassword(value);
              setStatusMessage(null);
            }}
            onSubmitEditing={() => {
              void handleCreateEmailAccount();
            }}
            placeholder="Minimum 6 characters"
            returnKeyType="done"
            secureTextEntry
            textContentType="newPassword"
            value={password}
          />

          <AppButton
            disabled={isSaving}
            icon={isSaving ? <ActivityIndicator color={appColors.white} /> : undefined}
            label={isSaving ? "Creating account..." : "Create account"}
            onPress={() => {
              void handleCreateEmailAccount();
            }}
          />

          {statusMessage ? (
            <AppText color="secondary" variant="bodySmall">
              {statusMessage}
            </AppText>
          ) : null}
        </AppCard>
      </KeyboardAwareScrollView>
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
  formCard: {
    gap: appSpacing.md,
    marginBottom: appSpacing.md,
    borderWidth: appBorders.width,
    borderColor: appColors.borderSoft,
  },
});

export default AccountScreen;
