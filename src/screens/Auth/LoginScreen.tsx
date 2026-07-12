import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import {
  AppButton,
  AppCard,
  AppInput,
  AppText,
} from "../../components/ui";
import {
  signInWithEmailPassword,
  upsertSupabaseAuthUserAccount,
} from "../../API/supabase/auth";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "../../API/supabase/client";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import { appColors } from "../../theme/colors";
import { appSpacing, appSurfaces } from "../../theme/tokens";

type LoginScreenProps = {
  onAuthenticated?: () => void | Promise<void>;
  onBackToOnboarding?: () => void;
};

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
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

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

    setIsSubmitting(true);
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
      setIsSubmitting(false);
    }
  }, [email, finishWithUser, isSubmitting, password]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <AppCard style={styles.card}>
        <AppText align="center" variant="sectionTitleLarge">
          Sign in
        </AppText>
        <AppText align="center" color="secondary" variant="bodySmall">
          Sign in to an account created after completing your nutrition profile.
        </AppText>

        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="you@example.com"
          returnKeyType="next"
          textContentType="emailAddress"
          value={email}
        />

        <AppInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isSubmitting}
          label="Password"
          onChangeText={setPassword}
          onSubmitEditing={() => void handleEmailSignIn()}
          placeholder="Minimum 6 characters"
          returnKeyType="done"
          secureTextEntry
          textContentType="password"
          value={password}
        />

        <AppButton
          disabled={isSubmitting}
          icon={isSubmitting ? <ActivityIndicator color={appColors.white} /> : undefined}
          label={isSubmitting ? "Signing in..." : "Sign in"}
          onPress={() => void handleEmailSignIn()}
        />

        {onBackToOnboarding ? (
          <AppButton
            disabled={isSubmitting}
            label="Create an account"
            onPress={onBackToOnboarding}
            variant="secondary"
          />
        ) : null}

        {errorMessage ? (
          <AppText color="error" variant="bodySmall">
            {errorMessage}
          </AppText>
        ) : null}
      </AppCard>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: appSpacing.gutter,
    backgroundColor: appSurfaces.canvas,
  },
  card: {
    gap: appSpacing.md,
  },
});

export default LoginScreen;
