import React from "react";
import {
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
import type {
  BodyData,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";

type Props = NativeStackScreenProps<OnboardingParamList, "BodyData">;

const BodyDataScreen = ({ navigation, route }: Props) => {
  const insets = useSafeAreaInsets();
  const [age, setAge] = React.useState("25");
  const [heightCm, setHeightCm] = React.useState("168");
  const [weightKg, setWeightKg] = React.useState("77");
  const [sex, setSex] = React.useState<BodyData["sex"]>("female");

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />

      <View style={styles.content}>
        <View style={styles.headerWrap}>
          <View style={styles.headerRow}>
            <RulerIcon size={22} color="#0369A1" weight="fill" />
            <Text style={styles.eyebrow}>Body Data</Text>
          </View>
          <Text style={styles.title}>Body basics</Text>
          <Text style={styles.subtitle}>
            Quick setup for a better TDEE estimate.
          </Text>
        </View>

        <View style={styles.formCard}>
          <View>
            <Text style={styles.sectionLabelx}>Age</Text>
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              placeholder="Age"
              placeholderTextColor="#94A3B8"
            />
          </View>
          <View>
            <Text style={styles.sectionLabelx}>Height (cm)</Text>
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              placeholder="Height (cm)"
              placeholderTextColor="#94A3B8"
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
              placeholderTextColor="#94A3B8"
            />
          </View>
          <Text style={styles.sectionLabel}>Sex</Text>
          <View style={styles.sexRow}>
            {(["female", "male"] as const).map((value) => (
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
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 6 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>Next</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    backgroundColor: "#F8FAFC",
  },
  content: {
    flex: 1,
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
    backgroundColor: "#DBEAFE",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -80,
    left: -60,
    width: 210,
    height: 210,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
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
    color: "#075985",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#383838",
    borderRadius: 6,
    padding: 14,
    gap: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#383838",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
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
    color: "#64748B",
  },
  sectionLabelx: {
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 4,
    fontSize: 10,
    fontWeight: "500",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#64748B",
  },
  sexRow: {
    flexDirection: "row",
    gap: 8,
  },
  sexChip: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  sexChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  sexChipPressed: {
    opacity: 0.88,
  },
  sexChipText: {
    color: "#334155",
    fontWeight: "700",
    textTransform: "capitalize",
  },
  sexChipTextActive: {
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "#0F172A",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: "800",
    paddingVertical: 6,
  },
});

export default BodyDataScreen;
