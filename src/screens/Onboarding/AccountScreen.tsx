import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import {
  buildLocalAccount,
  saveLocalAccount,
  saveOnboardingProfile,
  setOnboardingComplete,
} from "../../storage/localStore";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import { DB } from "../../store/DB";

type Props = NativeStackScreenProps<OnboardingParamList, "Account">;

const AccountScreen = ({ navigation, route }: Props) => {
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

    const date = new Date(`${value}T00:00:00.000Z`);
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
        external_id: account.id,
        provider: account.provider,
        display_name: account.displayName,
        created_at: account.createdAt,
        email: account.email,
        birthdate: account.birthdate,
        gender: route.params.onboarding.bodyData.sex,
        height_cm: route.params.onboarding.bodyData.heightCm,
        activity_level: route.params.onboarding.activity,
        goal: route.params.onboarding.goal,
        calorieAllowance: route.params.onboarding.fuelPlan.calories,
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
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Create local account</Text>
        <Text style={styles.subtitle}>Saved only on this device for now.</Text>

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

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (!canSubmit || isSaving) && styles.primaryButtonDisabled,
          ]}
          disabled={!canSubmit || isSaving}
          onPress={() => void handleCreateLocalAccount()}
        >
          <Text style={styles.primaryText}>
            {isSaving ? "Saving..." : "Create local account"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.footnote}>Local first, all gains.</Text>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f8fafc",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: "#ffffff",
    color: "#0f172a",
  },
  primaryButton: {
    marginTop: 6,
    borderRadius: 10,
    paddingVertical: 14,
    backgroundColor: "#0f172a",
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  footnote: {
    marginTop: 12,
    color: "#64748b",
    textAlign: "center",
  },
});

export default AccountScreen;
