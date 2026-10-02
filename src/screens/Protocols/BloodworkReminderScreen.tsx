import React from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ProtocolStackParamList } from "../../navigation/protocolTypes";
import { useAppSelector } from "../../store/hooks";
import BloodworkReminderSheet from "./BloodworkReminderSheet";
import { useProtocolClock } from "./useProtocolClock";

export default function BloodworkReminderScreen({ navigation }: NativeStackScreenProps<ProtocolStackParamList, "BloodworkReminder">) {
  const userId = useAppSelector((state) => state.user.currentUser?.externalId) ?? "";
  const { today } = useProtocolClock();
  return <BloodworkReminderSheet page userId={userId} date={today} onClose={() => navigation.goBack()} />;
}
