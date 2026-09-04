import type { Session, User } from "@supabase/supabase-js";
import { DB } from "../../store/DB";
import type { DBUser } from "../../store/DB_TYPES";
import { setOnboardingComplete } from "../../storage/localStore";
import { resetCoalescedRequests } from "../nouri/coalesce";
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
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const signedOutUserId = session?.user?.id ?? null;
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  // Signing out drops the in-memory lists the previous user's screens were
  // holding, and detaches any request still in flight so its result cannot
  // resolve into the next user's screen. There is nothing on disk to clear: the
  // device never stored their foods, diary, weights or settings.
  clearAddFoodStaticListsCache();
  resetCoalescedRequests();

  if (signedOutUserId) {
    clearCachedHomeDashboardSummary(signedOutUserId);
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

  return "Nouri User";
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

  // The profile row is created by the `handle_new_user()` database trigger,
  // atomically with the auth user, so a signed-in user always has one. This
  // guard therefore no longer means "onboarding is incomplete" — it means the
  // session did not resolve (absent session, or an id that does not match the
  // token subject), which is why the message no longer blames onboarding.
  //
  // A genuinely missing profile row does not reach here at all: GET /v1/me
  // reports it as PROFILE_MISSING, a data-integrity fault, rather than letting
  // it masquerade as an authentication failure.
  if (!existingUser) {
    await getSupabaseClient().auth.signOut();
    throw new Error("Could not load your account. Please sign in again.");
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

  if (options.markOnboardingComplete !== false) {
    await setOnboardingComplete(true);
  }

  return resolvedUser;
};
