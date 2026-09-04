// Time-of-day logic in the app reads the device clock rather than taking a
// timezone argument, so the conformance cases that pin meal slots and date keys
// are fixed to UTC. Setting it here, before any module loads, is what makes
// `new Date(...).getHours()` resolve the same way on every machine.
process.env.TZ = "UTC";

// The API client reads its base URL at call time from the environment. Tests
// that exercise it stub `fetch`, so this only has to be non-empty and obviously
// local.
process.env.EXPO_PUBLIC_API_BASE_URL ??= "http://127.0.0.1:8080";
process.env.EXPO_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= "local-publishable-key";
