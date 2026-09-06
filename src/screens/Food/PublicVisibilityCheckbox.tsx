import React from "react";
import { Switch, View } from "react-native";
import { AppText } from "../../components/ui";
import { appColors } from "../../theme/colors";

const PublicVisibilityCheckbox = ({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (nextValue: boolean) => void;
}) => (
  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 56,
      gap: 16,
    }}
  >
    <View style={{ flex: 1 }}>
      <AppText variant="bodySmallStrong">Public</AppText>
      <AppText color="secondary" variant="metadata">
        Others can find and use this item.
      </AppText>
    </View>
    <Switch
      accessibilityLabel="Make this item public"
      thumbColor={appColors.white}
      value={checked}
      onValueChange={onChange}
      trackColor={{ true: appColors.actionPrimary }}
    />
  </View>
);
export default PublicVisibilityCheckbox;
