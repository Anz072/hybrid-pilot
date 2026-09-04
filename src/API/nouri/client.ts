import {
  getSupabaseSession,
  refreshSupabaseSession,
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

/**
 * A one-line, loggable description of a failed request.
 *
 * Deliberately carries only the code, the HTTP status and the request id — the
 * three things that let a failure be traced to a server-side log line. It never
 * carries a message body, a field value or a payload, because a client log is
 * not a place for a user's weight, diary or nutrition data.
 */
export const describeApiFailure = (error: unknown): string => {
  if (error instanceof NouriApiError) {
    return `${error.code} status=${error.status} requestId=${error.requestId ?? "none"}`;
  }
  return error instanceof Error ? error.name : "unknown";
};

/**
 * Path with identifiers removed: `/v1/diary/entries/42` -> `/v1/diary/entries/:id`.
 *
 * The endpoint is the useful half of a failure report. The id is not, and a
 * log line is a place things leak from, so it does not go in one.
 */
const routeOf = (path: string) =>
  path.replace(/\/\d+(?=\/|$)/g, "/:id").replace(/\/[0-9a-f-]{36}(?=\/|$)/gi, "/:uuid");

/**
 * Every request failure is reported here, once, from the one place that sees
 * all of them.
 *
 * Screens catch these to show their own copy — "Could not log food", "Please
 * try again" — and until now that copy was the *only* trace a failure left. The
 * cause was unrecoverable from the device: a 404 from a food id the backend
 * decoded wrong looked exactly like a 500, a timeout, or a validation error.
 *
 * Putting it here rather than in 45 catch blocks means a new screen cannot
 * forget it, and means the log line is built from fields the client controls
 * rather than from whatever a handler happened to pass along.
 */
const reportFailure = (method: string, path: string, error: unknown): void => {
  const line = `[nouri-api] ${method} ${routeOf(path)} failed: ${describeApiFailure(error)}`;

  // A 404 is frequently expected control flow here — several stores treat "not
  // found" as `null` and carry on — so it is recorded but does not raise a
  // warning. In a development build every `console.warn` becomes a full-screen
  // LogBox, and a diagnostic that interrupts the work is one people turn off.
  //
  // It is still written, because the reverse mistake is worse: the bug that
  // motivated all of this was a 404, from a food id the backend decoded wrong,
  // and it left no trace at all.
  if (error instanceof NouriApiError && error.isNotFound) {
    console.log(line);
    return;
  }

  console.warn(line);
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

const performRequest = async <T>(
  path: string,
  options: RequestOptions,
  accessToken: string,
): Promise<T> => {
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

/**
 * Sends a request, and on an expired access token refreshes once and retries
 * once.
 *
 * ## Why retrying a mutation is safe here
 *
 * `AUTH_TOKEN_EXPIRED` is produced by the API's `onRequest` hook, before body
 * parsing, validation or any route handler. A request rejected with that code
 * therefore had no effect on the server — verified end-to-end against a real
 * expired token: a POST that came back 401 wrote no row, and the same POST
 * succeeded after refresh. So this retry is not a gamble about whether the
 * write landed; the server has told us it did not.
 *
 * That reasoning does **not** extend to `NETWORK_ERROR`, where the request may
 * well have been processed and only the response was lost. Those are never
 * retried here — they surface to the caller, which relies on the existing
 * client-generated ids for idempotency if it chooses to retry.
 *
 * ## Loop safety
 *
 * At most one refresh and one retry per call. If the retry fails again — for
 * any reason, including another 401 — the error is thrown. A malformed or
 * tampered token yields `AUTH_INVALID_TOKEN`, not `AUTH_TOKEN_EXPIRED`, and so
 * never triggers a refresh at all. A failed refresh throws
 * `AUTH_REQUIRED`, the existing signed-out path.
 */
export const apiRequest = async <T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> => {
  const method = options.method ?? "GET";
  const session = await getSupabaseSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    const error = new NouriApiError(
      "AUTH_REQUIRED",
      SUPABASE_SESSION_REQUIRED_MESSAGE,
      401,
      null,
    );
    reportFailure(method, path, error);
    throw error;
  }

  try {
    return await performRequest<T>(path, options, accessToken);
  } catch (error) {
    if (!(error instanceof NouriApiError) || !error.isExpiredToken) {
      reportFailure(method, path, error);
      throw error;
    }

    // An expired token is not reported: it is the normal, expected prelude to a
    // refresh, and the retry below is what decides whether anything failed.

    // Single-flighted, so a burst of simultaneous 401s shares one refresh
    // rather than racing to spend the same rotating refresh token.
    const refreshedToken = await refreshSupabaseSession();

    if (!refreshedToken) {
      const authError = new NouriApiError(
        "AUTH_REQUIRED",
        SUPABASE_SESSION_REQUIRED_MESSAGE,
        401,
        error.requestId,
      );
      reportFailure(method, path, authError);
      throw authError;
    }

    // Exactly one retry. Whatever this throws propagates untouched — but is
    // reported, because by here the refresh has already had its chance.
    try {
      return await performRequest<T>(path, options, refreshedToken);
    } catch (retryError) {
      reportFailure(method, path, retryError);
      throw retryError;
    }
  }
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

