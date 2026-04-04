import { View, StyleSheet, Pressable, Text } from "react-native";

export type OnboardingButtonProps = {
  label: string;
  subtitle: string;
  value: string;
  valueKey?: string;
  borderColor: string;
  navigation?: {
    push?: (...args: any[]) => void;
    navigate?: (...args: any[]) => void;
  };
  navGoal: string;
  dataToSend: any;
  icon?: any;
};

const OnboardingButton = (props: OnboardingButtonProps) => {
  const params = props.valueKey
    ? { ...props.dataToSend, [props.valueKey]: props.value }
    : props.dataToSend;

  return (
    <Pressable
      onPress={() =>
        props.navigation?.push
          ? props.navigation.push(props.navGoal, params)
          : props.navigation?.navigate?.(props.navGoal, params)
      }
      style={({ pressed }) => [
        styles.option2,
        pressed && styles.optionPressed,
        {
          borderColor: props.borderColor,
        },
      ]}
    >
      <View style={styles.button}>
        <View style={{ maxWidth: "80%" }}>
          <Text style={styles.optionText2}>{props.label}</Text>
          <Text style={styles.optionSubtext2}>{props.subtitle}</Text>
        </View>
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "flex-end" }}
        >
          {props.icon && <View style={styles.iconBadge}>{props.icon}</View>}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    maxWidth: "100%",
  },
  optionPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.95,
  },
  iconBadge: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
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

export default OnboardingButton;
