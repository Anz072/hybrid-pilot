import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  buildBirthdateIsoString,
  getAgeToday,
  parseBirthdateValue,
} from "../../helpers";
import type { MoreParamList } from "../../navigation/MoreNavigator";
import type { DBUserGender } from "../../store/DB_TYPES";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { clearCurrentUser } from "../../store/userSlice";
import {
  cmToFeetInches,
  feetInchesToCm,
} from "../../preferences/displayPreferences";
import { useDisplayPreferences } from "../../preferences/usePreferences";
import { appColors } from "../../theme/colors";
import { AppButton, AppCard, AppInput, AppText, Chip } from "../../components/ui";
import { appSpacing } from "../../theme/tokens";
import SettingsStackHeader from "./SettingsStackHeader";
import { saveUserProfileChanges } from "./userSettingsActions";
import { signOutSupabaseSession } from "../../API/supabase/auth";

type Props = NativeStackScreenProps<MoreParamList, "ProfileSettingsScreen">;

const GENDER_OPTIONS: Array<{
  label: string;
  value: DBUserGender;
}> = [
  { label: "Not set", value: null },
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

const formatBirthdateInput = (value: string | null | undefined) =>
  value?.slice(0, 10) ?? "";

const normalizeText = (value: string) => value.trim();

const parseHeightValue = (value: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const seedFeetInches = (heightCm: number | null | undefined) => {
  if (heightCm == null) {
    return { feet: "", inches: "" };
  }
  const { feet, inches } = cmToFeetInches(heightCm);
  return { feet: String(feet), inches: String(inches) };
};

const ProfileSettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const { heightUnit } = useDisplayPreferences();
  const [displayName, setDisplayName] = React.useState(user?.displayName ?? "");
  const [birthdateValue, setBirthdateValue] = React.useState(
    formatBirthdateInput(user?.birthdate),
  );
  const [heightValue, setHeightValue] = React.useState(
    user?.heightCm != null ? String(user.heightCm) : "",
  );
  const [feetValue, setFeetValue] = React.useState(
    () => seedFeetInches(user?.heightCm).feet,
  );
  const [inchesValue, setInchesValue] = React.useState(
    () => seedFeetInches(user?.heightCm).inches,
  );
  const [selectedGender, setSelectedGender] = React.useState<DBUserGender>(
    user?.gender ?? null,
  );
  const [saving, setSaving] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setBirthdateValue(formatBirthdateInput(user?.birthdate));
    setHeightValue(user?.heightCm != null ? String(user.heightCm) : "");
    const seeded = seedFeetInches(user?.heightCm);
    setFeetValue(seeded.feet);
    setInchesValue(seeded.inches);
    setSelectedGender(user?.gender ?? null);
    setStatusMessage(null);
  }, [user?.birthdate, user?.displayName, user?.gender, user?.heightCm]);

  // Keep the canonical cm `heightValue` in sync when editing feet/inches.
  const handleFeetInchesChange = React.useCallback(
    (nextFeet: string, nextInches: string) => {
      setFeetValue(nextFeet);
      setInchesValue(nextInches);
      setStatusMessage(null);
      const feet = Number(nextFeet.trim());
      const inches = Number(nextInches.trim());
      if (
        (nextFeet.trim() === "" && nextInches.trim() === "") ||
        !Number.isFinite(feet) ||
        !Number.isFinite(inches)
      ) {
        setHeightValue(nextFeet.trim() === "" && nextInches.trim() === "" ? "" : heightValue);
        return;
      }
      setHeightValue(String(Math.round(feetInchesToCm(feet, inches))));
    },
    [heightValue],
  );

  const hasChanges = React.useMemo(() => {
    if (!user) {
      return false;
    }

    return (
      normalizeText(displayName) !== (user.displayName ?? "") ||
      birthdateValue.trim() !== formatBirthdateInput(user.birthdate) ||
      heightValue.trim() !== (user.heightCm != null ? String(user.heightCm) : "") ||
      selectedGender !== (user.gender ?? null)
    );
  }, [birthdateValue, displayName, heightValue, selectedGender, user]);

  const handleSave = React.useCallback(async () => {
    if (!user) {
      return;
    }

    const trimmedDisplayName = normalizeText(displayName);
    if (!trimmedDisplayName) {
      Alert.alert("Missing name", "Enter a display name before saving.");
      return;
    }

    const trimmedBirthdate = birthdateValue.trim();
    const parsedBirthdate = trimmedBirthdate
      ? parseBirthdateValue(trimmedBirthdate)
      : null;
    if (trimmedBirthdate && !parsedBirthdate) {
      Alert.alert(
        "Invalid birthdate",
        "Use the YYYY-MM-DD format, for example 1994-08-21.",
      );
      return;
    }

    if (parsedBirthdate) {
      const age = getAgeToday(parsedBirthdate);
      if (age < 13 || age > 100) {
        Alert.alert(
          "Check your birthdate",
          "Use a birthdate that makes you between 13 and 100 years old.",
        );
        return;
      }
    }

    const trimmedHeight = heightValue.trim();
    const parsedHeight = trimmedHeight ? parseHeightValue(trimmedHeight) : null;
    if (trimmedHeight && (parsedHeight == null || parsedHeight < 100 || parsedHeight > 260)) {
      Alert.alert(
        "Invalid height",
        heightUnit === "ft_in"
          ? "Enter a height between about 3'3\" and 8'6\", or leave it blank."
          : "Enter a height between 100 cm and 260 cm, or leave it blank.",
      );
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    try {
      await saveUserProfileChanges({
        dispatch,
        user,
        patch: {
          displayName: trimmedDisplayName,
          birthdate: parsedBirthdate ? buildBirthdateIsoString(parsedBirthdate) : null,
          heightCm: parsedHeight,
          gender: selectedGender,
        },
      });
      navigation.navigate("MoreMainScreen");
    } catch (error) {
      Alert.alert(
        "Could not save profile",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    birthdateValue,
    dispatch,
    displayName,
    heightUnit,
    heightValue,
    navigation,
    selectedGender,
    user,
  ]);

  const handleSignOut = React.useCallback(() => {
    if (signingOut) {
      return;
    }

    Alert.alert(
      "Sign out?",
      "You will return to the email sign-in screen. Your synced data will stay on your account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setSigningOut(true);
                await signOutSupabaseSession();
                dispatch(clearCurrentUser());
              } catch (error) {
                Alert.alert(
                  "Could not sign out",
                  error instanceof Error ? error.message : "Please try again.",
                );
              } finally {
                setSigningOut(false);
              }
            })();
          },
        },
      ],
    );
  }, [dispatch, signingOut]);

  return (
    <View style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.screen}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + 16,
              paddingBottom: insets.bottom + 28,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <SettingsStackHeader
            eyebrow="Account"
            onBack={() => navigation.goBack()}
            subtitle="Update the profile details that power your calorie planning, dashboard, and micronutrient targets."
            title="Profile & Account"
          />

          {!user ? (
            <AppCard style={styles.card}>
              <AppText variant="cardTitle">No active user</AppText>
              <AppText color="secondary" variant="bodySmall">
                Sign in to your account first before editing profile details.
              </AppText>
            </AppCard>
          ) : (
            <>
              <AppCard style={styles.card}>
                <AppText variant="cardTitle">Account & sync</AppText>
                <AppText color="coral" style={styles.accountValue} variant="sectionTitleLarge">
                  {user.email ?? "No email"}
                </AppText>
                <View style={styles.syncRow}>
                  <View
                    style={[
                      styles.syncDot,
                      user.provider === "local"
                        ? styles.syncDotLocal
                      : styles.syncDotOnline,
                    ]}
                  />
                  <AppText color="secondary" style={styles.syncText} variant="bodySmall">
                    {user.provider === "local"
                      ? "Local device account — data stays on this device and is not synced."
                      : "Signed in — your diary, weights, and settings sync to your account."}
                  </AppText>
                </View>
              </AppCard>

              <AppCard style={styles.card}>
                <AppText variant="cardTitle">Profile details</AppText>
                <AppText color="secondary" style={styles.sectionText} variant="bodySmall">
                  Keep these fields current so your recommendations stay aligned
                  with your body data.
                </AppText>

                <AppInput
                  label="Display name"
                  placeholder="Your name"
                  value={displayName}
                  onChangeText={(value) => {
                    setDisplayName(value);
                    setStatusMessage(null);
                  }}
                />

                <AppInput
                  containerStyle={styles.fieldSpacing}
                  label="Birthdate"
                  placeholder="YYYY-MM-DD"
                  value={birthdateValue}
                  onChangeText={(value) => {
                    setBirthdateValue(value);
                    setStatusMessage(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />

                <AppText color="secondary" style={styles.heightLabel} variant="eyebrow">
                  Height
                </AppText>
                {heightUnit === "ft_in" ? (
                  <View style={styles.inlineInputRow}>
                    <AppInput
                      containerStyle={styles.inlineInput}
                      placeholder="5"
                      value={feetValue}
                      onChangeText={(value) =>
                        handleFeetInchesChange(value, inchesValue)
                      }
                      keyboardType="number-pad"
                    />
                    <View style={styles.unitPill}>
                      <AppText color="coral" variant="label">ft</AppText>
                    </View>
                    <AppInput
                      containerStyle={styles.inlineInput}
                      placeholder="10"
                      value={inchesValue}
                      onChangeText={(value) =>
                        handleFeetInchesChange(feetValue, value)
                      }
                      keyboardType="number-pad"
                    />
                    <View style={styles.unitPill}>
                      <AppText color="coral" variant="label">in</AppText>
                    </View>
                  </View>
                ) : (
                  <View style={styles.inlineInputRow}>
                    <AppInput
                      containerStyle={styles.inlineInput}
                      placeholder="170"
                      value={heightValue}
                      onChangeText={(value) => {
                        setHeightValue(value);
                        setStatusMessage(null);
                      }}
                      keyboardType="decimal-pad"
                    />
                    <View style={styles.unitPill}>
                      <AppText color="coral" variant="label">cm</AppText>
                    </View>
                  </View>
                )}

                <AppText color="secondary" style={styles.fieldSpacing} variant="eyebrow">
                  Sex profile
                </AppText>
                <View style={styles.optionRow}>
                  {GENDER_OPTIONS.map((option) => {
                    const selected = selectedGender === option.value;

                    return (
                      <Chip
                        key={option.label}
                        onPress={() => {
                          setSelectedGender(option.value);
                          setStatusMessage(null);
                        }}
                        label={option.label}
                        selected={selected}
                      />
                    );
                  })}
                </View>

                <AppButton
                  onPress={() => {
                    void handleSave();
                  }}
                  disabled={saving || !hasChanges}
                  label={saving ? "Saving..." : "Save profile"}
                  style={styles.primaryButton}
                />

                <AppText color="secondary" style={styles.helperText} variant="metadata">
                  {statusMessage ??
                    "Birthdate, height, and sex profile affect calorie planning and micronutrient targets."}
                </AppText>
              </AppCard>

              <AppCard style={styles.card}>
                <AppText variant="cardTitle">Session</AppText>
                <AppText color="secondary" style={styles.sectionText} variant="bodySmall">
                  Signing out keeps your synced data safe and brings you back to
                  the login screen.
                </AppText>

                <AppButton
                  onPress={handleSignOut}
                  disabled={signingOut}
                  label={signingOut ? "Signing out..." : "Sign out"}
                  variant="danger"
                />
              </AppCard>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  accountValue: {
    marginBottom: appSpacing.xs,
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: appSpacing.xs,
    marginTop: appSpacing.xxs,
  },
  syncDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginTop: 5,
  },
  syncDotOnline: {
    backgroundColor: appColors.success700,
  },
  syncDotLocal: {
    backgroundColor: appColors.warning600,
  },
  syncText: {
    flex: 1,
  },
  sectionText: {
    marginBottom: appSpacing.md,
  },
  fieldSpacing: {
    marginTop: appSpacing.sm,
  },
  heightLabel: {
    marginTop: appSpacing.sm,
    marginBottom: 6,
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: appSpacing.xs,
  },
  inlineInput: {
    flex: 1,
  },
  unitPill: {
    borderRadius: 999,
    backgroundColor: appColors.actionPrimarySoft,
    paddingHorizontal: appSpacing.sm,
    paddingVertical: appSpacing.xs,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: appSpacing.xs,
  },
  primaryButton: {
    marginTop: appSpacing.gutter,
  },
  helperText: {
    marginTop: appSpacing.sm,
  },
});

export default ProfileSettingsScreen;
