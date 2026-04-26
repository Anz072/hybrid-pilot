import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ShieldCheckIcon } from "phosphor-react-native";
import { useAppDispatch } from "../../store/hooks";
import { setCurrentUser } from "../../store/userSlice";
import { appColors } from "../../theme/colors";
import { appTypography } from "../../theme/typography";
import {
  getSupabaseConfigError,
  isSupabaseConfigured,
} from "../../API/supabase/client";
import {
  signInWithGoogleViaSupabase,
  upsertGoogleUserAccount,
} from "../../API/supabase/googleAuth";

type LoginScreenProps = {
  onAuthenticated?: () => void | Promise<void>;
};

const LoginScreen = ({ onAuthenticated }: LoginScreenProps) => {
  const dispatch = useAppDispatch();
  const [signingIn, setSigningIn] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleGoogleSignIn = React.useCallback(async () => {
    if (signingIn) {
      return;
    }

    setSigningIn(true);
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
      dispatch(setCurrentUser(user));
      await onAuthenticated?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Could not sign in with Google.";

      setErrorMessage(message);
      Alert.alert("Google sign-in failed", message);
    } finally {
      setSigningIn(false);
    }
  }, [dispatch, onAuthenticated, signingIn]);

  return (
    <View style={styles.screen}>
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />

      <View style={styles.card}>
        <Text style={styles.title}>Sign in with Google</Text>
        <Text style={styles.body}>
          Use your existing Google-backed Dribsnis account to restore your
          synced data.
        </Text>

        <Pressable
          onPress={() => {
            void handleGoogleSignIn();
          }}
          disabled={signingIn}
          style={({ pressed }) => [
            styles.button,
            signingIn && styles.buttonDisabled,
            pressed && !signingIn && styles.pressed,
          ]}
        >
          {signingIn ? (
            <ActivityIndicator color={appColors.slate900} />
          ) : null}
          <Text style={styles.buttonText}>
            {signingIn ? "Signing in..." : "Continue with Google"}
          </Text>
        </Pressable>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
      </View>
    </View>
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
    borderRadius: 32,
    borderWidth: 1,
    borderColor: appColors.borderSoft,
    padding: 24,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: appColors.slate50,
    marginBottom: 16,
  },
  eyebrow: {
    ...appTypography.label,
    color: appColors.textSecondary,
    marginBottom: 10,
  },
  title: {
    ...appTypography.displaySection,
    color: appColors.textPrimary,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 48,
  },
  body: {
    ...appTypography.body,
    color: appColors.textSecondary,
    marginBottom: 22,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 9999,
    backgroundColor: appColors.slate50,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    ...appTypography.button,
    color: appColors.slate900,
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

