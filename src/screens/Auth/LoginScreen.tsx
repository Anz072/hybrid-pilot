import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "../../API/supabase/client";
import {
  signInWithEmailPassword,
  signUpWithEmailPassword,
  upsertSupabaseAuthUserAccount,
} from "../../API/supabase/auth";

type LoginScreenProps = {
  onAuthenticated?: () => void | Promise<void>;
  onBackToOnboarding?: () => void;
};

type AuthMode = "signIn" | "register";
type SubmissionMode = AuthMode | null;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const validateEmailPassword = (email: string, password: string) => {
  if (!email.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }
};

const LoginScreen = ({
  onAuthenticated,
  onBackToOnboarding,
}: LoginScreenProps) => {
  const dispatch = useAppDispatch();
  const [authMode, setAuthMode] = React.useState<AuthMode>("signIn");
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [submitting, setSubmitting] = React.useState<SubmissionMode>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const isSubmitting = submitting !== null;

  const finishWithUser = React.useCallback(
    async (user: Awaited<ReturnType<typeof upsertSupabaseAuthUserAccount>>) => {
      dispatch(setCurrentUser(user));
      await onAuthenticated?.();
    },
    [dispatch, onAuthenticated],
  );

  const handleEmailSignIn = React.useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setSubmitting("signIn");
    setErrorMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(getSupabaseConfigError());
      }

      const normalizedEmail = normalizeEmail(email);
      validateEmailPassword(normalizedEmail, password);

      const session = await signInWithEmailPassword({
        email: normalizedEmail,
        password,
      });

      if (!session?.user) {
        const message = "Supabase did not return an active session.";
        setErrorMessage(message);
        throw new Error(message);
      }

      const user = await upsertSupabaseAuthUserAccount(session.user);
      await finishWithUser(user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not sign in.";

      setErrorMessage(message);
      Alert.alert("Sign-in failed", message);
    } finally {
      setSubmitting(null);
    }
  }, [email, finishWithUser, isSubmitting, password]);

  const handleEmailRegistration = React.useCallback(async () => {
    if (isSubmitting) {
      return;
    }

    setSubmitting("register");
    setErrorMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(getSupabaseConfigError());
      }

      const normalizedEmail = normalizeEmail(email);
      validateEmailPassword(normalizedEmail, password);
      const resolvedDisplayName =
        displayName.trim() || normalizedEmail.split("@")[0] || "Dribsnis User";

      const result = await signUpWithEmailPassword({
        displayName: resolvedDisplayName,
        email: normalizedEmail,
        password,
      });

      if (result.needsEmailConfirmation || !result.session?.user) {
        const message =
          "Check your email to confirm the account, then sign in here.";
        setErrorMessage(message);
        Alert.alert("Check your email", message);
        return;
      }

      const user = await upsertSupabaseAuthUserAccount(result.session.user, {
        allowCreate: true,
      });
      await finishWithUser(user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create account.";

      setErrorMessage(message);
      Alert.alert("Account creation failed", message);
    } finally {
      setSubmitting(null);
    }
  }, [displayName, email, finishWithUser, isSubmitting, password]);

  const handlePrimaryAction = React.useCallback(() => {
    if (authMode === "register") {
      void handleEmailRegistration();
      return;
    }

    void handleEmailSignIn();
  }, [authMode, handleEmailRegistration, handleEmailSignIn]);

  const primaryLabel =
    authMode === "register"
      ? submitting === "register"
        ? "Creating account..."
        : "Create account"
      : submitting === "signIn"
        ? "Signing in..."
        : "Sign in";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          {authMode === "register" ? "Create account" : "Sign in"}
        </Text>
        <Text style={styles.body}>
          Use your email and password to keep your food, weight, and nutrition
          profile synced.
        </Text>

        <View style={styles.modeSwitcher}>
          {(["signIn", "register"] as const).map((mode) => {
            const selected = authMode === mode;

            return (
              <Pressable
                key={mode}
                disabled={isSubmitting}
                onPress={() => {
                  setAuthMode(mode);
                  setErrorMessage(null);
                }}
                style={({ pressed }) => [
                  styles.modeTab,
                  selected && styles.modeTabSelected,
                  pressed && !isSubmitting && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    selected && styles.modeTabTextSelected,
                  ]}
                >
                  {mode === "signIn" ? "Sign in" : "Register"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {authMode === "register" ? (
          <>
            <Text style={styles.inputLabel}>Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              editable={!isSubmitting}
              placeholder="Your name"
              placeholderTextColor={appColors.textMuted}
              style={styles.input}
              textContentType="name"
              returnKeyType="next"
            />
          </>
        ) : null}

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          editable={!isSubmitting}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={appColors.textMuted}
          style={styles.input}
          textContentType="emailAddress"
          returnKeyType="next"
        />

        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          editable={!isSubmitting}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Minimum 6 characters"
          placeholderTextColor={appColors.textMuted}
          style={styles.input}
          textContentType={authMode === "register" ? "newPassword" : "password"}
          returnKeyType="done"
          onSubmitEditing={handlePrimaryAction}
        />

        <Pressable
          onPress={handlePrimaryAction}
          disabled={isSubmitting}
          style={({ pressed }) => [
            styles.button,
            isSubmitting && styles.buttonDisabled,
            pressed && !isSubmitting && styles.pressed,
          ]}
        >
          {submitting === authMode ? (
            <ActivityIndicator color={appColors.slate900} />
          ) : null}
          <Text style={styles.buttonText}>{primaryLabel}</Text>
        </Pressable>

        {onBackToOnboarding ? (
          <Pressable
            onPress={() => {
              onBackToOnboarding();
            }}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.createAccountButton,
              isSubmitting && styles.buttonDisabled,
              pressed && !isSubmitting && styles.pressed,
            ]}
          >
            <Text style={styles.createAccountButtonText}>
              Set up nutrition profile
            </Text>
          </Pressable>
        ) : null}

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: appColors.surfaceCanvas,
  },
  card: {
    backgroundColor: appColors.surfaceCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 22,
  },
  title: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
    fontSize: 24,
    textAlign: "center",
    marginBottom: 10,
  },
  body: {
    ...appTypography.bodySmall,
    color: appColors.textSecondary,
    textAlign: "center",
    marginBottom: 18,
  },
  modeSwitcher: {
    flexDirection: "row",
    backgroundColor: appColors.surfaceRaised,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 4,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    paddingVertical: 10,
  },
  modeTabSelected: {
    backgroundColor: appColors.surfaceCard,
  },
  modeTabText: {
    ...appTypography.label,
    color: appColors.textSecondary,
  },
  modeTabTextSelected: {
    color: appColors.textPrimary,
  },
  inputLabel: {
    ...appTypography.label,
    color: appColors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: appColors.surfaceField,
    color: appColors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 9999,
    backgroundColor: appColors.slate50,
    paddingHorizontal: 24,
    paddingVertical: 15,
    marginTop: 18,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...appTypography.button,
    color: appColors.slate900,
  },
  createAccountButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: appColors.borderStrong,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 10,
  },
  createAccountButtonText: {
    ...appTypography.button,
    color: appColors.textPrimary,
  },
  errorText: {
    ...appTypography.bodySmall,
    color: appColors.dangerText,
    marginTop: 14,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default LoginScreen;
