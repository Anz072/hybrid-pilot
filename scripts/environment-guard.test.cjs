require("./register-ts.cjs");

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  classifyEndpoint,
  describeEnvironment,
} = require("../src/config/environmentGuard.ts");

test("loopback hosts are local", () => {
  for (const url of [
    "http://localhost:8080",
    "http://127.0.0.1:54321",
    "http://[::1]:8080",
    "http://0.0.0.0:8080",
  ]) {
    assert.equal(classifyEndpoint(url), "local", url);
  }
});

test("the Android emulator host alias is local", () => {
  // An emulator reaches the developer's machine at 10.0.2.2, never localhost.
  assert.equal(classifyEndpoint("http://10.0.2.2:8080"), "local");
});

test("private LAN addresses are local (physical device / Expo Go)", () => {
  for (const url of [
    "http://192.168.1.42:8080",
    "http://10.1.2.3:8080",
    "http://172.16.0.5:8080",
    "http://172.31.255.254:8080",
  ]) {
    assert.equal(classifyEndpoint(url), "local", url);
  }
});

test("public addresses outside the private ranges are remote", () => {
  for (const url of [
    "https://abcdef.supabase.co",
    "https://nouri-api-xyz.run.app",
    "http://172.32.0.1:8080", // just outside 172.16/12
    "http://11.0.0.1:8080",
  ]) {
    assert.equal(classifyEndpoint(url), "remote", url);
  }
});

test("missing or malformed values are 'unset', not silently local", () => {
  assert.equal(classifyEndpoint(undefined), "unset");
  assert.equal(classifyEndpoint(""), "unset");
  assert.equal(classifyEndpoint("   "), "unset");
  assert.equal(classifyEndpoint("not a url"), "unset");
});

test("all-local is consistent", () => {
  const d = describeEnvironment({
    supabaseUrl: "http://127.0.0.1:54321",
    apiBaseUrl: "http://127.0.0.1:8080",
  });
  assert.deepEqual(d, { supabase: "local", api: "local", mixed: false });
});

test("all-remote is consistent", () => {
  const d = describeEnvironment({
    supabaseUrl: "https://project.supabase.co",
    apiBaseUrl: "https://nouri-api.run.app",
  });
  assert.equal(d.mixed, false);
});

test("local Supabase with a deployed API is flagged", () => {
  // Local tokens are signed by a local GoTrue key, so a deployed API rejects
  // them. Without this the symptom is unexplained 401s.
  const d = describeEnvironment({
    supabaseUrl: "http://127.0.0.1:54321",
    apiBaseUrl: "https://nouri-api.run.app",
  });
  assert.equal(d.mixed, true);
});

test("a real Supabase project with a local API is flagged", () => {
  // The dangerous direction: real identities writing into throwaway local data.
  const d = describeEnvironment({
    supabaseUrl: "https://project.supabase.co",
    apiBaseUrl: "http://127.0.0.1:8080",
  });
  assert.equal(d.mixed, true);
});

test("an Expo Go LAN setup is not mistaken for a mix", () => {
  const d = describeEnvironment({
    supabaseUrl: "http://192.168.1.42:54321",
    apiBaseUrl: "http://192.168.1.42:8080",
  });
  assert.equal(d.mixed, false);
});

test("an unset value is not reported as a mix", () => {
  assert.equal(describeEnvironment({ supabaseUrl: "", apiBaseUrl: "http://127.0.0.1:8080" }).mixed, false);
});
