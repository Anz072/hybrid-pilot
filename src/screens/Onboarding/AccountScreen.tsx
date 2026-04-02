import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";
import {
  buildLocalAccount,
  saveLocalAccount,
  saveOnboardingProfile,
  setOnboardingComplete,
  type AuthProvider,
} from "../../storage/localStore";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import { DB } from "../../store/DB";

type Props = NativeStackScreenProps<OnboardingParamList, "Account">;

const AccountScreen = ({ navigation, route }: Props) => {
  const dispatch = useAppDispatch();

  const handleCreateLocalAccount = async (provider: AuthProvider) => {
    try {
      const account = buildLocalAccount(provider);
      await saveLocalAccount(account);
      await saveOnboardingProfile(route.params.onboarding);
      await setOnboardingComplete(true);

      await DB.addUser({
        externalId: account.id,
        provider: account.provider,
        displayName: account.displayName,
      });

      const user = await DB.getUser();
      dispatch(setCurrentUser(user));

      navigation.navigate("Success", { onboarding: route.params.onboarding });
    } catch {
      Alert.alert("Could not save account", "Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create local account</Text>
      <Text style={styles.subtitle}>
        Everything is stored only on this device for now.
      </Text>

      <TouchableOpacity
        style={styles.providerButton}
        onPress={() => void handleCreateLocalAccount("google")}
      >
        <Text style={styles.providerText}>Continue with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.providerButton}
        onPress={() => void handleCreateLocalAccount("apple")}
      >
        <Text style={styles.providerText}>Continue with Apple</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.providerButton}
        onPress={() => void handleCreateLocalAccount("email")}
      >
        <Text style={styles.providerText}>Continue with Email</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>
        No cloud sync yet. Local first, all gains.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 20,
  },
  providerButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginBottom: 10,
  },
  providerText: {
    color: "#0f172a",
    fontWeight: "700",
  },
  footnote: {
    marginTop: 10,
    color: "#64748b",
    textAlign: "center",
  },
});

export default AccountScreen;
