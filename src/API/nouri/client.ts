import {
  getSupabaseSession,
  SUPABASE_SESSION_REQUIRED_MESSAGE,
} from "../supabase/client";

// HTTP client for the Nouri backend.
//
// Auth stays with Supabase: the app signs in directly, then sends the resulting
// access token here as a Bearer credential. The API verifies it and derives the
// user id from the token subject, so nothing in a request body determines
// identity.

const DEFAULT_TIMEOUT_MS = 15_000;

export const NOURI_API_UNCONFIGURED_MESSAGE =
  "Missing API config. Set EXPO_PUBLIC_API_BASE_URL in the app's .env file.";

export type NouriApiErrorCode =
  | "AUTH_REQUIRED"
  | "AUTH_INVALID_TOKEN"
  | "AUTH_TOKEN_EXPIRED"
  | "AUTH_PROVIDER_NOT_ALLOWED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_FAILED"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "PROFILE_MISSING"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "NETWORK_ERROR";

export class NouriApiError extends Error {
  readonly code: NouriApiErrorCode;
  readonly status: number;
  readonly requestId: string | null;

  constructor(
    code: NouriApiErrorCode,
    message: string,
    status: number,
    requestId: string | null,
  ) {
    super(message);
    this.name = "NouriApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }

  // The API distinguishes an expired token from an invalid one so the app can
  // refresh and retry instead of signing the user out.
  get isExpiredToken(): boolean {
    return this.code === "AUTH_TOKEN_EXPIRED";
  }

  get isAuthFailure(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.code === "NOT_FOUND";
  }
}

const readBaseUrl = () =>
  process.env.EXPO_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "") ?? "";

export const isNouriApiConfigured = () => readBaseUrl().length > 0;

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  timeoutMs?: number;
};

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const base = readBaseUrl();
  if (!base) {
    throw new Error(NOURI_API_UNCONFIGURED_MESSAGE);
  }

  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) {
    return url;
  }

  const params = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return params.length > 0 ? `${url}?${params.join("&")}` : url;
};

type ErrorEnvelope = {
  error?: { code?: string; message?: string; requestId?: string };
};

export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const session = await getSupabaseSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new NouriApiError(
      "AUTH_REQUIRED",
      SUPABASE_SESSION_REQUIRED_MESSAGE,
      401,
      null,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? "GET",
      signal: controller.signal,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        ...(options.body === undefined
          ? {}
          : { "content-type": "application/json" }),
      },
      ...(options.body === undefined
        ? {}
        : { body: JSON.stringify(options.body) }),
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    throw new NouriApiError(
      "NETWORK_ERROR",
      aborted ? "The request timed out." : "Could not reach the server.",
      0,
      null,
    );
  } finally {
    clearTimeout(timeout);
  }

  const requestId = response.headers.get("x-request-id");

  if (response.status === 204) {
    return undefined as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const envelope = payload as ErrorEnvelope | null;
    throw new NouriApiError(
      (envelope?.error?.code as NouriApiErrorCode) ?? "INTERNAL_ERROR",
      envelope?.error?.message ?? "The request failed.",
      response.status,
      envelope?.error?.requestId ?? requestId,
    );
  }

  return payload as T;
};

// The device's IANA zone. The API needs it to reproduce the meal-slot grouping
// and copy-duplicate rules that used to run against the device clock.
export const getDeviceTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};
