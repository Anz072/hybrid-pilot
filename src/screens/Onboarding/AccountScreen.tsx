import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "Account">;

const AccountScreen = ({ navigation, route }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Save your data</Text>
      <Text style={styles.subtitle}>Sync your plan and progress across devices in seconds.</Text>

      <TouchableOpacity style={styles.providerButton} onPress={() => navigation.navigate("Success", { fuelPlan: route.params.fuelPlan })}>
        <Text style={styles.providerText}>Continue with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.providerButton} onPress={() => navigation.navigate("Success", { fuelPlan: route.params.fuelPlan })}>
        <Text style={styles.providerText}>Continue with Apple</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.providerButton} onPress={() => navigation.navigate("Success", { fuelPlan: route.params.fuelPlan })}>
        <Text style={styles.providerText}>Continue with Email</Text>
      </TouchableOpacity>

      <Text style={styles.footnote}>No spam. Just gains.</Text>
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
