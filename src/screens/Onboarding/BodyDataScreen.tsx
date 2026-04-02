import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BodyData, OnboardingParamList } from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "BodyData">;

const BodyDataScreen = ({ navigation, route }: Props) => {
  const [age, setAge] = React.useState("29");
  const [heightCm, setHeightCm] = React.useState("178");
  const [weightKg, setWeightKg] = React.useState("84");
  const [sex, setSex] = React.useState<BodyData["sex"]>("male");

  const handleNext = () => {
    const bodyData: BodyData = {
      age: Number(age) || 0,
      heightCm: Number(heightCm) || 0,
      weightKg: Number(weightKg) || 0,
      sex,
    };

    navigation.navigate("Activity", { goal: route.params.goal, bodyData });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Body basics</Text>
      <Text style={styles.subtitle}>Quick setup for a better TDEE estimate.</Text>

      <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" placeholder="Age" />
      <TextInput
        style={styles.input}
        value={heightCm}
        onChangeText={setHeightCm}
        keyboardType="numeric"
        placeholder="Height (cm)"
      />
      <TextInput
        style={styles.input}
        value={weightKg}
        onChangeText={setWeightKg}
        keyboardType="numeric"
        placeholder="Weight (kg)"
      />

      <View style={styles.sexRow}>
        {(["female", "male", "other"] as const).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.sexChip, sex === value && styles.sexChipActive]}
            onPress={() => setSex(value)}
          >
            <Text style={[styles.sexChipText, sex === value && styles.sexChipTextActive]}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.button} onPress={handleNext}>
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: "#ffffff",
  },
  title: {
    marginTop: 40,
    fontSize: 30,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: "#475569",
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  sexRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  sexChip: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sexChipActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  sexChipText: {
    color: "#334155",
    fontWeight: "600",
    textTransform: "capitalize",
  },
  sexChipTextActive: {
    color: "#ffffff",
  },
  button: {
    marginTop: "auto",
    backgroundColor: "#f97316",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});

export default BodyDataScreen;
