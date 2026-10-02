import type { CreateProtocolCourseInput } from "../API/nouri/protocolTypes";
import type { CompositeScreenProps, NavigatorScreenParams } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

export type ProtocolTabsParamList = {
  // null explicitly follows today, including after midnight or a zone change.
  Today: { date?: string | null; courseId?: string } | undefined;
  Levels: { courseId?: string } | undefined;
  Trends: { section?: "metrics" | "bloodwork" } | undefined;
  Compounds: undefined;
};
export type ProtocolPrimaryScreenProps<Name extends keyof ProtocolTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<ProtocolTabsParamList, Name>, NativeStackScreenProps<ProtocolStackParamList>
>;

export type ProtocolStackParamList = {
  Root: NavigatorScreenParams<ProtocolTabsParamList> | undefined;
  BloodworkReminder: undefined;
  BloodworkEntry: { panelId?: string } | undefined;
  BloodworkPanel: { panelId: string };
  BiomarkerChart: { biomarkerId: string };
  Compare: { courseId: string };
  PreviewLevels: { configuration: CreateProtocolCourseInput };
  Calendar: { date: string; courseId?: string };
  CourseHistory: { courseId: string };
  Intro: undefined;
  AddCompound: undefined;
  CourseDetail: { courseId: string };
  EditCourse: { compoundId: string; courseId?: never } | { courseId: string; compoundId?: never };
  CompoundInfo: { compoundId: string };
};
