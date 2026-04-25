import React from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { appColors } from "../../theme/colors";
import SettingsStackHeader from "./SettingsStackHeader";
import { saveUserProfileChanges } from "./userSettingsActions";
import { signOutSupabaseSession } from "../../API/supabase/googleAuth";

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

const formatProviderLabel = (provider: string | null | undefined) => {
  if (provider === "google") {
    return "Google";
  }

  if (!provider) {
    return "Account";
  }

  return provider.charAt(0).toUpperCase() + provider.slice(1);
};

const parseHeightValue = (value: string) => {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
};

const ProfileSettingsScreen = ({ navigation }: Props) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.user.currentUser);
  const [displayName, setDisplayName] = React.useState(user?.displayName ?? "");
  const [birthdateValue, setBirthdateValue] = React.useState(
    formatBirthdateInput(user?.birthdate),
  );
  const [heightValue, setHeightValue] = React.useState(
    user?.heightCm != null ? String(user.heightCm) : "",
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
    setSelectedGender(user?.gender ?? null);
    setStatusMessage(null);
  }, [user?.birthdate, user?.displayName, user?.gender, user?.heightCm]);

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
        "Enter a height between 100 cm and 260 cm, or leave it blank.",
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
      "You will return to the Google sign-in screen. Your synced data will stay on your account.",
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
  }, [signingOut]);

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

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
            <View style={styles.card}>
              <Text style={styles.cardTitle}>No active user</Text>
              <Text style={styles.cardText}>
                Sign in to your account first before editing profile details.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Synced account</Text>
                <Text style={styles.accountValue}>{user.email ?? "No email"}</Text>
                <Text style={styles.cardText}>
                  Signed in with {formatProviderLabel(user.provider)}.
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Profile details</Text>
                <Text style={styles.sectionText}>
                  Keep these fields current so your recommendations stay aligned
                  with your body data.
                </Text>

                <Text style={styles.fieldLabel}>Display name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Your name"
                  placeholderTextColor={appColors.slate200}
                  value={displayName}
                  onChangeText={(value) => {
                    setDisplayName(value);
                    setStatusMessage(null);
                  }}
                />

                <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
                  Birthdate
                </Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={appColors.slate200}
                  value={birthdateValue}
                  onChangeText={(value) => {
                    setBirthdateValue(value);
                    setStatusMessage(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="numbers-and-punctuation"
                />

                <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
                  Height
                </Text>
                <View style={styles.inlineInputRow}>
                  <TextInput
                    style={[styles.textInput, styles.inlineInput]}
                    placeholder="170"
                    placeholderTextColor={appColors.slate200}
                    value={heightValue}
                    onChangeText={(value) => {
                      setHeightValue(value);
                      setStatusMessage(null);
                    }}
                    keyboardType="decimal-pad"
                  />
                  <View style={styles.unitPill}>
                    <Text style={styles.unitPillText}>cm</Text>
                  </View>
                </View>

                <Text style={[styles.fieldLabel, styles.fieldSpacing]}>
                  Sex profile
                </Text>
                <View style={styles.optionRow}>
                  {GENDER_OPTIONS.map((option) => {
                    const selected = selectedGender === option.value;

                    return (
                      <Pressable
                        key={option.label}
                        onPress={() => {
                          setSelectedGender(option.value);
                          setStatusMessage(null);
                        }}
                        style={({ pressed }) => [
                          styles.optionChip,
                          selected && styles.optionChipSelected,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            selected && styles.optionChipTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  onPress={() => {
                    void handleSave();
                  }}
                  disabled={saving || !hasChanges}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (saving || !hasChanges) && styles.disabled,
                    pressed && !saving && hasChanges && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {saving ? "Saving..." : "Save profile"}
                  </Text>
                </Pressable>

                <Text style={styles.helperText}>
                  {statusMessage ??
                    "Birthdate, height, and sex profile affect calorie planning and micronutrient targets."}
                </Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Session</Text>
                <Text style={styles.sectionText}>
                  Signing out keeps your synced data safe and brings you back to
                  the login screen.
                </Text>

                <Pressable
                  onPress={handleSignOut}
                  disabled={signingOut}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    styles.signOutButton,
                    signingOut && styles.disabled,
                    pressed && !signingOut && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.signOutButtonText}>
                    {signingOut ? "Signing out..." : "Sign out"}
                  </Text>
                </Pressable>
              </View>
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
    paddingHorizontal: 20,
  },
  orbTop: {
    position: "absolute",
    top: -82,
    right: -54,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  orbBottom: {
    position: "absolute",
    left: -74,
    bottom: -88,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.success700,
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
    color: appColors.white,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 6,
  },
  cardText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 19,
  },
  accountValue: {
    color: appColors.brand700,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionTitle: {
    color: appColors.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  sectionText: {
    color: appColors.slate200,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  fieldLabel: {
    color: appColors.slate200,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  fieldSpacing: {
    marginTop: 12,
  },
  textInput: {
    borderRadius: 8,
    backgroundColor: appColors.surfaceRaised,
    borderWidth: 1,
    borderColor: appColors.slate100,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: appColors.white,
    fontSize: 14,
    fontWeight: "700",
  },
  inlineInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inlineInput: {
    flex: 1,
  },
  unitPill: {
    borderRadius: 999,
    backgroundColor: appColors.brand800,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  unitPillText: {
    color: appColors.brand700,
    fontSize: 12,
    fontWeight: "800",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionChip: {
    borderRadius: 999,
    backgroundColor: appColors.surfaceRaised,
    borderWidth: 1,
    borderColor: appColors.slate100,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionChipSelected: {
    backgroundColor: appColors.brand800,
    borderColor: appColors.brand500,
  },
  optionChipText: {
    color: appColors.white,
    fontSize: 12,
    fontWeight: "800",
  },
  optionChipTextSelected: {
    color: appColors.brand700,
  },
  primaryButton: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: appColors.brand700,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: appColors.white,
    fontSize: 13,
    fontWeight: "800",
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  signOutButton: {
    backgroundColor: appColors.dangerSurface,
    borderColor: appColors.danger600,
  },
  signOutButtonText: {
    color: appColors.danger700,
    fontSize: 13,
    fontWeight: "800",
  },
  helperText: {
    color: appColors.slate200,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  buttonPressed: {
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default ProfileSettingsScreen;

