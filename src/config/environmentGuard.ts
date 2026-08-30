// Guards against a half-local development setup.
//
// The dangerous combination is a LOCAL Supabase Auth paired with a REMOTE API,
// or the reverse: the app then signs in against one world and writes into
// another. Local tokens are issued by a local GoTrue with its own signing key,
// so they will not verify against a hosted API — but the failure surfaces as
// confusing 401s rather than "your environment is inconsistent". The reverse
// mix is worse: developing against a local API while authenticating against a
// real project means real user identities pointing at throwaway data.
//
// This is a development-time check. Production ships a single consistent set of
// values, and the check is skipped when everything is remote.

export type EndpointScope = "local" | "remote" | "unset";

/** Hosts that mean "this developer's machine or LAN". */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/** The alias an Android emulator uses to reach its host machine. */
const ANDROID_EMULATOR_HOST = "10.0.2.2";

const isPrivateLanAddress = (hostname: string): boolean => {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return false;
  const [a, b] = parts.map(Number) as [number, number, number, number];
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

export const classifyEndpoint = (raw: string | undefined): EndpointScope => {
  const value = raw?.trim();
  if (!value) return "unset";

  let hostname: string;
  try {
    // URL keeps the brackets around an IPv6 literal ("[::1]"), which would not
    // match a bare "::1" in the loopback set.
    hostname = new URL(value).hostname.replace(/^\[|\]$/g, "");
  } catch {
    return "unset";
  }

  if (LOOPBACK.has(hostname)) return "local";
  if (hostname === ANDROID_EMULATOR_HOST) return "local";
  if (isPrivateLanAddress(hostname)) return "local";
  if (hostname.endsWith(".local")) return "local";
  return "remote";
};

export interface EnvironmentDescription {
  supabase: EndpointScope;
  api: EndpointScope;
  mixed: boolean;
}

export const describeEnvironment = (
  env: { supabaseUrl?: string | undefined; apiBaseUrl?: string | undefined } = {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
  },
): EnvironmentDescription => {
  const supabase = classifyEndpoint(env.supabaseUrl);
  const api = classifyEndpoint(env.apiBaseUrl);
  // "unset" is a separate problem, reported elsewhere with a clearer message.
  const mixed =
    supabase !== "unset" && api !== "unset" && supabase !== api;
  return { supabase, api, mixed };
};

export const describeEnvironmentMismatch = (
  description: EnvironmentDescription,
): string =>
  [
    "Mixed local/remote configuration.",
    `  EXPO_PUBLIC_SUPABASE_URL  -> ${description.supabase}`,
    `  EXPO_PUBLIC_API_BASE_URL  -> ${description.api}`,
    "",
    "Both must point at the same world. A local Supabase signs tokens with its",
    "own key, so they will not verify against a deployed API; and running a local",
    "API while authenticating against a real project puts real identities on",
    "throwaway data.",
    "",
    "Set both to local (see .env.example) or both to your deployed environment.",
  ].join("\n");

/**
 * Called once at startup. Logs loudly rather than throwing: a developer with a
 * half-configured `.env` should be told plainly, not handed a crashed app with
 * no obvious cause.
 */
export const assertConsistentEnvironment = (): EnvironmentDescription => {
  const description = describeEnvironment();
  if (description.mixed) {
    console.error(`[nouri] ${describeEnvironmentMismatch(description)}`);
  }
  return description;
};
