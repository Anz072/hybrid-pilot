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
  signInWithGoogleViaSupabase,
  upsertGoogleUserAccount,
  upsertSupabaseAuthUserAccount,
} from "../../API/supabase/googleAuth";

type LoginScreenProps = {
  onAuthenticated?: () => void | Promise<void>;
  onBackToOnboarding?: () => void;
};

type SubmissionMode = "email" | "google" | null;

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
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [signingIn, setSigningIn] = React.useState<SubmissionMode>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const isSigningIn = signingIn !== null;

  const finishWithUser = React.useCallback(
    async (user: Awaited<ReturnType<typeof upsertSupabaseAuthUserAccount>>) => {
      dispatch(setCurrentUser(user));
      await onAuthenticated?.();
    },
    [dispatch, onAuthenticated],
  );

  const handleEmailAuth = React.useCallback(async () => {
    if (isSigningIn) {
      return;
    }

    setSigningIn("email");
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

      const user = await upsertSupabaseAuthUserAccount(session.user, {
        allowCreate: false,
      });
      await finishWithUser(user);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not sign in.";

      setErrorMessage(message);
      Alert.alert("Sign-in failed", message);
    } finally {
      setSigningIn(null);
    }
  }, [email, finishWithUser, isSigningIn, password]);

  const handleGoogleSignIn = React.useCallback(async () => {
    if (isSigningIn) {
      return;
    }

    setSigningIn("google");
    setErrorMessage(null);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error(getSupabaseConfigError());
      }

      const session = await signInWithGoogleViaSupabase();

      if (!session?.user) {
        return;
      }

      const user = await upsertGoogleUserAccount(session.user, {
        allowCreate: false,
      });
      await finishWithUser(user);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not sign in with Google.";

      setErrorMessage(message);
      Alert.alert("Google sign-in failed", message);
    } finally {
      setSigningIn(null);
    }
  }, [finishWithUser, isSigningIn]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.body}>
          Use your existing Supabase email account, or continue with your
          Google-backed account in a build.
        </Text>

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          editable={!isSigningIn}
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
          editable={!isSigningIn}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          placeholder="Minimum 6 characters"
          placeholderTextColor={appColors.textMuted}
          style={styles.input}
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={() => {
            void handleEmailAuth();
          }}
        />

        <Pressable
          onPress={() => {
            void handleEmailAuth();
          }}
          disabled={isSigningIn}
          style={({ pressed }) => [
            styles.button,
            isSigningIn && styles.buttonDisabled,
            pressed && !isSigningIn && styles.pressed,
          ]}
        >
          {signingIn === "email" ? (
            <ActivityIndicator color={appColors.slate900} />
          ) : null}
          <Text style={styles.buttonText}>
            {signingIn === "email" ? "Signing in..." : "Sign in"}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            void handleGoogleSignIn();
          }}
          disabled={isSigningIn}
          style={({ pressed }) => [
            styles.googleButton,
            isSigningIn && styles.buttonDisabled,
            pressed && !isSigningIn && styles.pressed,
          ]}
        >
          {signingIn === "google" ? (
            <ActivityIndicator color={appColors.textPrimary} />
          ) : null}
          <Text style={styles.googleButtonText}>
            {signingIn === "google" ? "Signing in..." : "Continue with Google"}
          </Text>
        </Pressable>

        {onBackToOnboarding ? (
          <Pressable
            onPress={() => {
              onBackToOnboarding();
            }}
            disabled={isSigningIn}
            style={({ pressed }) => [
              styles.createAccountButton,
              isSigningIn && styles.buttonDisabled,
              pressed && !isSigningIn && styles.pressed,
            ]}
          >
            <Text style={styles.createAccountButtonText}>
              Back to onboarding
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
  orbTop: {
    position: "absolute",
    top: -70,
    right: -30,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: appColors.brand800,
  },
  orbBottom: {
    position: "absolute",
    bottom: -110,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: appColors.success700,
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
  googleButton: {
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
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...appTypography.button,
    color: appColors.slate900,
  },
  googleButtonText: {
    ...appTypography.button,
    color: appColors.textPrimary,
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
