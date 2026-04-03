import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FireIcon, ShieldCheckIcon, TrendUpIcon } from "phosphor-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  GoalType,
  OnboardingParamList,
} from "../../navigation/onboardingTypes";
import OnboardingButton from "./onboardingButton";

type Props = NativeStackScreenProps<OnboardingParamList, "Goal">;

type GoalOption = {
  label: string;
  value: GoalType;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  bgColor: string;
  borderColor: string;
};

const GoalScreen = ({ navigation }: Props) => {
  const options: GoalOption[] = [
    {
      label: "Lose fat",
      value: "lose_fat",
      subtitle: "Slight calorie deficit with protein-first targets.",
      icon: <FireIcon size={36} color="#353535ad" weight="fill" />,
      accent: "#FCA5A5",
      bgColor: "#fca5a591",
      borderColor: "#383838",
    },
    {
      label: "Maintain",
      value: "maintain",
      subtitle: "Balanced intake to keep performance steady.",
      icon: <ShieldCheckIcon size={36} color="#353535ad" weight="fill" />,
      accent: "#7DD3FC",
      bgColor: "#7dd3fc91",
      borderColor: "#383838",
    },
    {
      label: "Build muscle",
      value: "build_muscle",
      subtitle: "Lean surplus and recovery-focused macro split.",
      icon: <TrendUpIcon size={36} color="#353535ad" weight="fill" />,
      accent: "#86EFAC",
      bgColor: "#86efac9a",
      borderColor: "#383838",
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.bgOrbTop} />
      <View style={styles.bgOrbBottom} />
      <View style={styles.headerWrap}>
        <Text style={styles.eyebrow}>Setup</Text>
        <Text style={styles.title}>What is your primary goal?</Text>
        <Text style={styles.subtitle}>
          Pick one to tune calories, macros, and training recommendations.
        </Text>
      </View>
      <View style={styles.optionsWrap}>
        {options.map((option) => (
          <View key={option.value}>
            <OnboardingButton
              label={option.label}
              subtitle={option.subtitle}
              value={option.value}
              dataToSend={{ goal: option.value }}
              borderColor={option.borderColor}
              navigation={navigation}
              icon={option.icon}
              navGoal="BodyData"
            />
          </View>
          // <Pressable
          //   key={option.value}
          //   onPress={() =>
          //     navigation.navigate("BodyData", { goal: option.value })
          //   }
          //   style={({ pressed }) => [
          //     styles.option2,
          //     pressed && styles.optionPressed,
          //     {
          //       borderColor: option.borderColor,
          //     },
          //   ]}
          // >
          //   <View style={styles.optionTextWrap2}>
          //     <Text style={styles.optionText2}>{option.label}</Text>
          //     <Text style={styles.optionSubtext2}>{option.subtitle}</Text>
          //   </View>
          // </Pressable>
        ))}
      </View>
      {/* <Pressable style={styles.option2}>
        <View style={styles.optionTextWrap2}>
          <Text style={styles.optionText2}>Lose Fat</Text>
          <Text style={styles.optionSubtext2}>
            Slight calorie deficit with protein-first targets.
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={{
          ...styles.option2,
          backgroundColor: "#7fffd491",
          borderColor: "#00ced1",
          marginTop: 24,
        }}
      >
        <View style={styles.optionTextWrap2}>
          <Text style={styles.optionText2}>Maintain</Text>
          <Text style={styles.optionSubtext2}>
            Balanced intake to keep performance steady.
          </Text>
        </View>
      </Pressable>
      <Pressable
        style={{
          ...styles.option2,
          marginTop: 24,
          backgroundColor: "#86efad9a",
          borderColor: "#22c55e",
        }}
      >
        <View style={styles.optionTextWrap2}>
          <Text style={styles.optionText2}>Build Muscle</Text>
          <Text style={styles.optionSubtext2}>
            Lean surplus and recovery-focused macro split.
          </Text>
        </View>
      </Pressable> */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 24,
    backgroundColor: "#F8FAFC",
  },
  bgOrbTop: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "#FFE4CC",
  },
  bgOrbBottom: {
    position: "absolute",
    bottom: -70,
    left: -50,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  headerWrap: {
    marginTop: 20,
    marginBottom: 22,
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
    marginBottom: 14,
  },
  title: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#475569",
  },
  optionsWrap: {
    gap: 12,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  optionPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },
  accentBar: {
    width: 5,
    alignSelf: "stretch",
    borderRadius: 999,
    marginRight: 10,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 3,
  },
  optionSubtext: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  optionTextWrap2: {
    flex: 1,
  },
  optionText2: {
    fontSize: 20,
    letterSpacing: 0.8,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 3,
    marginTop: 4,
  },
  optionSubtext2: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  option2: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 6,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderWidth: 1,
  },
});

export default GoalScreen;
