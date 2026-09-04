import { describe, expect, it } from "vitest";
import { classifyEndpoint, describeEnvironment } from "../src/config/environmentGuard";

describe("endpoint classification", () => {
  it("treats loopback hosts as local", () => {
    for (const url of [
      "http://localhost:8080",
      "http://127.0.0.1:54321",
      "http://[::1]:8080",
      "http://0.0.0.0:8080",
    ]) {
      expect(classifyEndpoint(url), url).toBe("local");
    }
  });

  it("treats the Android emulator host alias as local", () => {
    // An emulator reaches the developer's machine at 10.0.2.2, never localhost.
    expect(classifyEndpoint("http://10.0.2.2:8080")).toBe("local");
  });

  it("treats private LAN addresses as local (physical device / Expo Go)", () => {
    for (const url of [
      "http://192.168.1.42:8080",
      "http://10.1.2.3:8080",
      "http://172.16.0.5:8080",
      "http://172.31.255.254:8080",
    ]) {
      expect(classifyEndpoint(url), url).toBe("local");
    }
  });

  it("treats addresses outside the private ranges as remote", () => {
    for (const url of [
      "https://abcdef.supabase.co",
      "https://nouri-api-xyz.run.app",
      "http://172.32.0.1:8080", // just outside 172.16/12
      "http://11.0.0.1:8080",
    ]) {
      expect(classifyEndpoint(url), url).toBe("remote");
    }
  });

  it("reports missing or malformed values as unset, not silently local", () => {
    expect(classifyEndpoint(undefined)).toBe("unset");
    expect(classifyEndpoint("")).toBe("unset");
    expect(classifyEndpoint("   ")).toBe("unset");
    expect(classifyEndpoint("not a url")).toBe("unset");
  });
});

describe("environment description", () => {
  it("is consistent when everything is local", () => {
    expect(
      describeEnvironment({
        supabaseUrl: "http://127.0.0.1:54321",
        apiBaseUrl: "http://127.0.0.1:8080",
      }),
    ).toEqual({ supabase: "local", api: "local", mixed: false });
  });

  it("is consistent when everything is remote", () => {
    expect(
      describeEnvironment({
        supabaseUrl: "https://project.supabase.co",
        apiBaseUrl: "https://nouri-api.run.app",
      }).mixed,
    ).toBe(false);
  });

  it("flags a local Supabase with a deployed API", () => {
    // Local tokens are signed by a local GoTrue key, so a deployed API rejects
    // them. Without this the symptom is unexplained 401s.
    expect(
      describeEnvironment({
        supabaseUrl: "http://127.0.0.1:54321",
        apiBaseUrl: "https://nouri-api.run.app",
      }).mixed,
    ).toBe(true);
  });

  it("flags a real Supabase project with a local API", () => {
    // The dangerous direction: real identities writing into throwaway local data.
    expect(
      describeEnvironment({
        supabaseUrl: "https://project.supabase.co",
        apiBaseUrl: "http://127.0.0.1:8080",
      }).mixed,
    ).toBe(true);
  });

  it("does not mistake an Expo Go LAN setup for a mix", () => {
    expect(
      describeEnvironment({
        supabaseUrl: "http://192.168.1.42:54321",
        apiBaseUrl: "http://192.168.1.42:8080",
      }).mixed,
    ).toBe(false);
  });

  it("does not report an unset value as a mix", () => {
    expect(
      describeEnvironment({ supabaseUrl: "", apiBaseUrl: "http://127.0.0.1:8080" }).mixed,
    ).toBe(false);
  });
});
