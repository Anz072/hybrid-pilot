import React from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarBlankIcon, ChartLineIcon, ChartLineUpIcon, CaretLeftIcon, PlusIcon, CirclesThreeIcon } from "phosphor-react-native";
import { AppButton, AppSheet, AppText, IconButton } from "../components/ui";
import { appColors } from "../theme/colors";
import { appSpacing } from "../theme/tokens";
import { appTypography } from "../theme/typography";
import TodayScreen from "../screens/Protocols/TodayScreen";
import LevelsScreen from "../screens/Protocols/LevelsScreen";
import TrendsScreen from "../screens/Protocols/TrendsScreen";
import CompoundsScreen from "../screens/Protocols/CompoundsScreen";
import type { ProtocolStackParamList, ProtocolTabsParamList } from "./protocolTypes";

const Tabs = createBottomTabNavigator<ProtocolTabsParamList>();
const icons = { Today: CalendarBlankIcon, Levels: ChartLineIcon, Trends: ChartLineUpIcon, Compounds: CirclesThreeIcon };

export default function ProtocolsTabs({ navigation }: NativeStackScreenProps<ProtocolStackParamList, "Root">) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const [adding, setAdding] = React.useState(false);
  const open = (screen: "AddCompound" | "BloodworkEntry" | "BloodworkReminder") => {
    setAdding(false);
    navigation.navigate(screen);
  };
  return <View style={styles.root}>
    <View style={[styles.header, { paddingTop: insets.top + appSpacing.xs }]}>
      <IconButton accessibilityLabel="Back to Nouri" onPress={() => navigation.getParent()?.goBack()}><CaretLeftIcon size={24} color={appColors.textPrimary} /></IconButton>
      <AppText variant="screenTitle" style={styles.title}>Protocols</AppText>
      <IconButton accessibilityLabel="Add to Protocols" onPress={() => setAdding(true)}><PlusIcon size={26} color={appColors.accent} /></IconButton>
    </View>
    <Tabs.Navigator initialRouteName="Today" screenOptions={({ route }) => ({
      headerShown: false, tabBarActiveTintColor: appColors.accent, tabBarInactiveTintColor: appColors.textSecondary,
      tabBarLabelPosition: "below-icon",
      // React Navigation cannot infer its iOS tab announcement from a custom label.
      tabBarAccessibilityLabel: Platform.OS === "ios" ? `${route.name}, tab, ${Object.keys(icons).indexOf(route.name) + 1} of 4` : route.name,
      tabBarLabel: ({ focused, children }) => <AppText variant="label" color={focused ? appColors.accent : appColors.textSecondary} numberOfLines={2} style={styles.tabLabel}>{children}</AppText>,
      tabBarStyle: { backgroundColor: appColors.surfaceCard, borderTopColor: appColors.borderSoft, height: Math.max(68, 36 + 2 * appTypography.label.lineHeight * fontScale) + insets.bottom, paddingBottom: Math.max(insets.bottom, 8), paddingTop: 6 },
      tabBarIcon: ({ color, focused }) => { const Icon = icons[route.name]; return <Icon size={24} color={color} weight={focused ? "fill" : "regular"} />; },
    })}>
      <Tabs.Screen name="Today" component={TodayScreen} />
      <Tabs.Screen name="Levels" component={LevelsScreen} />
      <Tabs.Screen name="Trends" component={TrendsScreen} />
      <Tabs.Screen name="Compounds" component={CompoundsScreen} />
    </Tabs.Navigator>
    <AppSheet visible={adding} title="Add" onClose={() => setAdding(false)}>
      <View style={styles.actions}>
        <AppButton label="Compound" variant="secondary" onPress={() => open("AddCompound")} />
        <AppButton label="Bloodwork" variant="secondary" onPress={() => open("BloodworkEntry")} />
        <AppButton label="Bloodwork reminder" variant="secondary" onPress={() => open("BloodworkReminder")} />
      </View>
    </AppSheet>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: appColors.surfaceCanvas },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: appSpacing.gutter, paddingBottom: appSpacing.sm, gap: appSpacing.sm },
  title: { flex: 1 },
  tabLabel: { textAlign: "center" },
  actions: { gap: appSpacing.sm, paddingBottom: appSpacing.lg },
});
