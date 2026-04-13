import type { Session, User } from "@supabase/supabase-js";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { DB } from "../../store/DB";
import type { DBUser } from "../../store/DB_TYPES";
import {
  saveLocalAccount,
  setOnboardingComplete,
} from "../../storage/localStore";
import { getSupabaseClient } from "./client";

export const GOOGLE_AUTH_SCHEME = "hybridpilot";
export const GOOGLE_AUTH_PATH = "auth/callback";

export const getGoogleAuthRedirectUrl = () =>
  makeRedirectUri({
    scheme: GOOGLE_AUTH_SCHEME,
    path: GOOGLE_AUTH_PATH,
  });

const waitForDeepLink = (expectedPrefix: string, timeoutMs = 60000) =>
  new Promise<string>((resolve, reject) => {
    let done = false;

    const sub = Linking.addEventListener("url", ({ url }) => {
      if (done) return;
      if (url.startsWith(expectedPrefix)) {
        done = true;
        sub.remove();
        clearTimeout(timer);
        resolve(url);
      }
    });

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      sub.remove();
      reject(new Error("Timed out waiting for auth redirect."));
    }, timeoutMs);
  });

export const createSessionFromRedirectUrl = async (url: string) => {
  const supabase = getSupabaseClient();

  const { errorCode, params } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(errorCode);
  }

  const code = typeof params.code === "string" ? params.code : null;
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      throw error;
    }

    return data.session;
  }

  const accessToken =
    typeof params.access_token === "string" ? params.access_token : null;
  const refreshToken =
    typeof params.refresh_token === "string" ? params.refresh_token : null;

  if (accessToken && refreshToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      throw error;
    }

    return data.session;
  }

  throw new Error("No auth code or session tokens found in redirect URL.");
};

export const signInWithGoogleViaSupabase =
  async (): Promise<Session | null> => {
    const supabase = getSupabaseClient();
    const redirectTo = getGoogleAuthRedirectUrl();

    console.log("redirectUrix2:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error("Supabase did not return an OAuth URL.");
    }

    console.log("oauth data.url:", data.url);
    console.log("before openAuthSessionAsync");

    const deepLinkPromise = waitForDeepLink(`${GOOGLE_AUTH_SCHEME}://`);

    const browserPromise = WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo,
    );

    const winner = await Promise.race([
      browserPromise.then((result) => ({ kind: "browser" as const, result })),
      deepLinkPromise.then((url) => ({ kind: "link" as const, url })),
    ]);

    console.log("auth winner:", winner);

    if (winner.kind === "browser") {
      if (winner.result.type !== "success" || !winner.result.url) {
        return null;
      }
      return createSessionFromRedirectUrl(winner.result.url);
    }

    return createSessionFromRedirectUrl(winner.url);
  };

export const getGoogleDisplayName = (user: User, fallback?: string | null) => {
  const candidates = [
    user.user_metadata?.name,
    user.user_metadata?.full_name,
    user.user_metadata?.preferred_username,
    user.user_metadata?.given_name,
    fallback,
    user.email?.split("@")[0],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "Google User";
};

type UpsertGoogleUserToLocalDbOptions = {
  allowCreate?: boolean;
  markOnboardingComplete?: boolean;
  persistLocalAccount?: boolean;
};

export const upsertGoogleUserToLocalDb = async (
  user: User,
  options: UpsertGoogleUserToLocalDbOptions = {},
): Promise<DBUser> => {
  const existingUser = await DB.getUserByExternalId(user.id);
  const displayName = getGoogleDisplayName(user, existingUser?.displayName);

  if (!existingUser && options.allowCreate === false) {
    await getSupabaseClient().auth.signOut();
    throw new Error(
      "No local account exists for this Google sign-in yet. Finish onboarding first to create one.",
    );
  }

  const createdAt =
    typeof user.created_at === "string" && user.created_at.length > 0
      ? user.created_at
      : existingUser?.createdAt ?? new Date().toISOString();

  const nextUser: DBUser = existingUser
    ? {
        ...existingUser,
        provider: "google",
        displayName,
        email: user.email ?? existingUser.email,
      }
    : {
        id: 0,
        externalId: user.id,
        provider: "google",
        displayName,
        createdAt,
        email: user.email ?? null,
        birthdate: null,
        gender: null,
        heightCm: null,
        activityLevel: null,
        goal: null,
        trainingTypes: null,
        calorieAllowance: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
      };

  await DB.addUser(nextUser);

  const savedUser = await DB.getUserByExternalId(user.id);
  const resolvedUser = savedUser ?? nextUser;

  if (options.persistLocalAccount !== false) {
    await saveLocalAccount({
      id: resolvedUser.externalId,
      provider: "google",
      displayName: resolvedUser.displayName ?? displayName,
      email: resolvedUser.email,
      birthdate: resolvedUser.birthdate,
      createdAt: resolvedUser.createdAt,
    });
  }

  if (options.markOnboardingComplete !== false) {
    await setOnboardingComplete(true);
  }

  return resolvedUser;
};
