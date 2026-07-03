import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import {
  type DisplayPreferences,
  saveDisplayPreferences,
} from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { appColors } from "../../theme/colors";
import SettingsStackHeader from "./SettingsStackHeader";

type Props = NativeStackScreenProps<MoreParamList, "PreferencesScreen">;

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

type PreferenceRowProps<T extends string> = {
  title: string;
  description: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
};

const PreferenceRow = <T extends string>({
  title,
  description,
  value,
  options,
  onChange,
}: PreferenceRowProps<T>) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    <Text style={styles.cardText}>{description}</Text>
    <View style={styles.segmented}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && styles.segmentSelected,
              pressed && !selected && styles.segmentPressed,
            ]}
          >
            <Text
              style={[
                styles.segmentLabel,
                selected && styles.segmentLabelSelected,
              ]}
            >
              {option.label}
            </Text>
            {option.hint ? (
              <Text
                style={[
                  styles.segmentHint,
                  selected && styles.segmentHintSelected,
                ]}
              >
                {option.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  </View>
);

const PreferencesScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const preferences = useDisplayPreferences();

  const update = React.useCallback((patch: Partial<DisplayPreferences>) => {
    void saveDisplayPreferences(patch);
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SettingsStackHeader
          eyebrow="Preferences"
          onBack={() => navigation.goBack()}
          subtitle="Choose how weights, heights, and times are shown throughout the app. Your data is always stored the same way — only the display changes."
          title="Units & display"
        />

        <PreferenceRow
          title="Body weight"
          description="Used across the weight tab, dashboard, and goals."
          value={preferences.weightUnit}
          options={[
            { value: "kg", label: "Kilograms", hint: "kg" },
            { value: "lb", label: "Pounds", hint: "lb" },
          ]}
          onChange={(weightUnit) => update({ weightUnit })}
        />

        <PreferenceRow
          title="Height"
          description="Used in your profile and body data."
          value={preferences.heightUnit}
          options={[
            { value: "cm", label: "Centimeters", hint: "cm" },
            { value: "ft_in", label: "Feet & inches", hint: "ft/in" },
          ]}
          onChange={(heightUnit) => update({ heightUnit })}
        />

        <PreferenceRow
          title="Time format"
          description="Used for logged meal times and timestamps."
          value={preferences.timeFormat}
          options={[
            { value: "24h", label: "24-hour", hint: "13:30" },
            { value: "12h", label: "12-hour", hint: "1:30 PM" },
          ]}
          onChange={(timeFormat) => update({ timeFormat })}
        />

        <Text style={styles.footnote}>Changes save automatically.</Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: appColors.surfaceCanvas,
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    padding: 18,
    borderWidth: 1,
    borderColor: appColors.slate200,
    marginBottom: 14,
  },
  cardTitle: {
    color: appColors.slate800,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardText: {
    color: appColors.slate600,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  segmented: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: appColors.surfaceField,
    borderWidth: 1,
    borderColor: appColors.slate200,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 2,
  },
  segmentSelected: {
    backgroundColor: appColors.brand700,
    borderColor: appColors.brand700,
  },
  segmentPressed: {
    opacity: 0.9,
  },
  segmentLabel: {
    color: appColors.slate800,
    fontSize: 14,
    fontWeight: "800",
  },
  segmentLabelSelected: {
    color: appColors.white,
  },
  segmentHint: {
    color: appColors.slate500,
    fontSize: 11,
    fontWeight: "600",
  },
  segmentHintSelected: {
    color: appColors.white,
  },
  footnote: {
    color: appColors.slate500,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});

export default PreferencesScreen;
