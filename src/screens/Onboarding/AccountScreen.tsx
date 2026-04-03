import React, { useState } from "react";
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

type Props = NativeStackScreenProps<OnboardingParamList, "Account">;

const AccountScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const normalizedEmail = email.trim();
  const normalizedBirthdate = birthdate.trim();
  const canSubmit =
    displayName.trim().length > 0 &&
    normalizedEmail.length > 0 &&
    normalizedBirthdate.length > 0;

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
        calorieAllowance: route.params.onboarding.fuelPlan.calories,
        proteinG: route.params.onboarding.fuelPlan.protein,
        carbsG: route.params.onboarding.fuelPlan.carbs,
        fatG: route.params.onboarding.fuelPlan.fats,
      });

      const user = await DB.getUser();
      dispatch(setCurrentUser(user));

      navigation.navigate("Success", { onboarding: route.params.onboarding });
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
        <Text style={styles.eyebrow}>Final Step</Text>
        <Text style={styles.title}>Create local account</Text>
        <Text style={styles.subtitle}>Saved only on this device for now.</Text>

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
          <TextInput
            value={birthdate}
            onChangeText={setBirthdate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            style={styles.input}
          />

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (!canSubmit || isSaving) && styles.primaryButtonDisabled,
              pressed && canSubmit && !isSaving && styles.primaryButtonPressed,
            ]}
            disabled={!canSubmit || isSaving}
            onPress={() => void handleCreateLocalAccount()}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? "Saving..." : "Create local account"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.footnote}>Shabbat Shalom</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
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
    color: "#9A3412",
    backgroundColor: "#FFEDD5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  label: {
    marginTop: 12,
    marginBottom: 2,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#64748B",
  },
  input: {
    borderWidth: 1,
    borderColor: "#383838",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 16,
    letterSpacing: 0.2,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: "800",
    paddingVertical: 6,
  },
  footnote: {
    marginTop: 12,
    color: "#64748B",
    textAlign: "center",
  },
});

export default AccountScreen;
