import React from "react";
import {
  ScrollView,
  StyleSheet,
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
import { AppCard, AppText, SegmentedControl } from "../../components/ui";
import { appSpacing } from "../../theme/tokens";
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
  <AppCard style={styles.card}>
    <AppText variant="cardTitle">{title}</AppText>
    <AppText color="secondary" style={styles.cardText} variant="bodySmall">
      {description}
    </AppText>
    <SegmentedControl options={options} onChange={onChange} value={value} />
  </AppCard>
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

        <AppText align="center" color="muted" style={styles.footnote} variant="metadata">
          Changes save automatically.
        </AppText>
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
    paddingHorizontal: appSpacing.gutter,
  },
  card: {
    marginBottom: appSpacing.md,
  },
  cardText: {
    marginBottom: appSpacing.md,
  },
  footnote: {
    marginTop: appSpacing.xxs,
  },
});

export default PreferencesScreen;
