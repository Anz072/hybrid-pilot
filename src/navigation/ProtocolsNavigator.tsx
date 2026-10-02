import React from "react";
import { useNavigation } from "@react-navigation/native";
import { createNativeStackNavigator, type NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton, AppScreen, AppText, ErrorState, LoadingState, ScreenHeader } from "../components/ui";
import { DB } from "../store/DB";
import { useAppSelector } from "../store/hooks";
import { useReducedMotion } from "../theme/useReducedMotion";
import { useProtocolRead } from "../screens/Protocols/useProtocolRead";
import ProtocolIntroScreen from "../screens/Protocols/ProtocolIntroScreen";
import AddCompoundScreen from "../screens/Protocols/AddCompoundScreen";
import EditCourseScreen from "../screens/Protocols/EditCourseScreen";
import CourseDetailScreen from "../screens/Protocols/CourseDetailScreen";
import CompoundInfoScreen from "../screens/Protocols/CompoundInfoScreen";
import ProtocolCalendarScreen from "../screens/Protocols/ProtocolCalendarScreen";
import CourseHistoryScreen from "../screens/Protocols/CourseHistoryScreen";
import CompareScreen from "../screens/Protocols/CompareScreen";
import PreviewLevelsScreen from "../screens/Protocols/PreviewLevelsScreen";
import ProtocolsTabs from "./ProtocolsTabs";
import BloodworkReminderScreen from "../screens/Protocols/BloodworkReminderScreen";
import BloodworkEntryScreen from "../screens/Protocols/BloodworkEntryScreen";
import BloodworkPanelScreen from "../screens/Protocols/BloodworkPanelScreen";
import BiomarkerChartScreen from "../screens/Protocols/BiomarkerChartScreen";
import type { ProtocolStackParamList } from "./protocolTypes";
import type { RootStackParamList } from "./AppNavigator";

const Stack = createNativeStackNavigator<ProtocolStackParamList>();
export default function ProtocolsNavigator() {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const settings = useProtocolRead(userId, "protocol-availability", () => DB.getUserSettings(userId));
  const reduceMotion = useReducedMotion();
  if (!settings.data?.protocolsEnabled) return <AppScreen>
    <ScreenHeader title="Protocols" onBack={() => navigation.goBack()} />
    {settings.error ? <ErrorState title="Could not load Protocols" message={settings.error} action={<AppButton label="Try again" onPress={() => void settings.reload()} />} />
      : settings.loading ? <LoadingState title="Loading Protocols" /> : <><AppText>Protocol tracking is turned off. Your history is kept.</AppText><AppButton label="Protocol settings" onPress={() => navigation.navigate("ProtocolSettings")} /></>}
  </AppScreen>;
  return <Stack.Navigator initialRouteName="Root" screenOptions={{ headerShown: false, animation: reduceMotion ? "none" : "default" }}>
    <Stack.Screen name="Root" component={ProtocolsTabs} />
    <Stack.Screen name="BloodworkReminder" component={BloodworkReminderScreen} />
    <Stack.Screen name="BloodworkEntry" component={BloodworkEntryScreen} />
    <Stack.Screen name="BloodworkPanel" component={BloodworkPanelScreen} />
    <Stack.Screen name="BiomarkerChart" component={BiomarkerChartScreen} />
    <Stack.Screen name="Compare" component={CompareScreen} />
    <Stack.Screen name="PreviewLevels" component={PreviewLevelsScreen} />
    <Stack.Screen name="Calendar" component={ProtocolCalendarScreen} />
    <Stack.Screen name="CourseHistory" component={CourseHistoryScreen} />
    <Stack.Screen name="Intro" component={ProtocolIntroScreen} />
    <Stack.Screen name="AddCompound" component={AddCompoundScreen} />
    <Stack.Screen name="EditCourse" component={EditCourseScreen} />
    <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
    <Stack.Screen name="CompoundInfo" component={CompoundInfoScreen} />
  </Stack.Navigator>;
}
