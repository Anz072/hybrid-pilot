import type { Session, User } from "@supabase/supabase-js";
import { DB } from "../../store/DB";
import type { DBUser } from "../../store/DB_TYPES";
import {
  clearLocalAccount,
  saveLocalAccount,
  setOnboardingComplete,
} from "../../storage/localStore";
import { shouldUseExpoGoDevLocalStore } from "../../dev/expoGoDevAuth";
import { clearAddFoodStaticListsCache } from "../../screens/Food/addFoodStaticListsCache";
import { clearCachedHomeDashboardSummary } from "../../screens/Home/homeDashboardSummary";
import { getSupabaseClient } from "./client";

type EmailPasswordCredentials = {
  email: string;
  password: string;
};

type SignUpWithEmailPasswordInput = EmailPasswordCredentials & {
  displayName?: string | null;
};

export type SignUpWithEmailPasswordResult = {
  session: Session | null;
  user: User | null;
  needsEmailConfirmation: boolean;
};

type UpsertSupabaseAuthUserAccountOptions = {
  markOnboardingComplete?: boolean;
  persistLocalAccount?: boolean;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const getAuthProvider = (user: User): string | null => {
  const provider = user.app_metadata?.provider;
  return typeof provider === "string" ? provider : null;
};

const assertEmailPasswordUser = async (user: User): Promise<void> => {
  const provider = getAuthProvider(user);

  if (provider && provider !== "email") {
    await getSupabaseClient().auth.signOut();
    throw new Error(
      "This app now supports email and password accounts only. Sign in with an email account.",
    );
  }
};

export const signInWithEmailPassword = async ({
  email,
  password,
}: EmailPasswordCredentials): Promise<Session | null> => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) {
    throw error;
  }

  if (data.session?.user) {
    await assertEmailPasswordUser(data.session.user);
  }

  return data.session ?? null;
};

export const signUpWithEmailPassword = async ({
  displayName,
  email,
  password,
}: SignUpWithEmailPasswordInput): Promise<SignUpWithEmailPasswordResult> => {
  const supabase = getSupabaseClient();
  const normalizedDisplayName = displayName?.trim();
  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      data: normalizedDisplayName
        ? {
            full_name: normalizedDisplayName,
            name: normalizedDisplayName,
          }
        : undefined,
    },
  });

  if (error) {
    throw error;
  }

  if (data.session?.user) {
    await assertEmailPasswordUser(data.session.user);
  }

  return {
    session: data.session ?? null,
    user: data.user ?? data.session?.user ?? null,
    needsEmailConfirmation: Boolean(data.user && !data.session),
  };
};

export const signOutSupabaseSession = async (): Promise<void> => {
  if (await shouldUseExpoGoDevLocalStore()) {
    await clearLocalAccount();
    return;
  }

  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const signedOutUserId = session?.user?.id ?? null;
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  await clearLocalAccount();
  clearAddFoodStaticListsCache();

  if (signedOutUserId) {
    clearCachedHomeDashboardSummary(signedOutUserId);
    await DB.clearUserCache(signedOutUserId);
  }
};

export const getSupabaseAuthDisplayName = (
  user: User,
  fallback?: string | null,
) => {
  const candidates = [
    user.user_metadata?.name,
    user.user_metadata?.full_name,
    user.user_metadata?.preferred_username,
    fallback,
    user.email?.split("@")[0],
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return "Dribsnis User";
};

export const upsertSupabaseAuthUserAccount = async (
  user: User,
  options: UpsertSupabaseAuthUserAccountOptions = {},
): Promise<DBUser> => {
  await assertEmailPasswordUser(user);

  const existingUser = await DB.getUserByExternalId(user.id);
  const displayName = getSupabaseAuthDisplayName(
    user,
    existingUser?.displayName,
  );

  // App profiles are created by the final onboarding Account step, which
  // persists the complete nutrition profile. Authentication may update an
  // existing profile, but must never synthesize an incomplete one.
  if (!existingUser) {
    await getSupabaseClient().auth.signOut();
    throw new Error(
      "No app account exists for this email yet. Finish onboarding first to create one.",
    );
  }

  const createdAt =
    typeof user.created_at === "string" && user.created_at.length > 0
      ? user.created_at
      : existingUser?.createdAt ?? new Date().toISOString();

  const nextUser: DBUser = existingUser
    ? {
        ...existingUser,
        provider: "email",
        displayName,
        email: user.email ?? existingUser.email,
      }
    : {
        id: 0,
        externalId: user.id,
        provider: "email",
        displayName,
        createdAt,
        email: user.email ?? null,
        birthdate: null,
        gender: null,
        heightCm: null,
        activityLevel: null,
        goal: null,
        goalStrategy: null,
        trainingTypes: null,
        proteinFocus: null,
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
      provider: "email",
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
