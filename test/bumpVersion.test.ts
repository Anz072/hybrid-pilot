import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const roots: string[] = [];
const script = resolve("scripts/bump-version.mjs");
const nativePaths = ["android/app/build.gradle", "ios/Nouri/Info.plist", "ios/Nouri.xcodeproj/project.pbxproj"];

function write(root: string, file: string, content: string) {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), content);
}

const read = (root: string, file: string) => readFileSync(join(root, file), "utf8");
const json = (root: string, file: string) => JSON.parse(read(root, file));

function fixture(native = false) {
  const root = mkdtempSync(join(tmpdir(), "nouri-version-test-"));
  roots.push(root);
  mkdirSync(join(root, "scripts"));
  copyFileSync(script, join(root, "scripts/bump-version.mjs"));
  write(root, "app.json", JSON.stringify({ expo: { name: "Nouri", version: "1.2.3", ios: { bundleIdentifier: "com.dribsnis.app" }, android: { package: "com.dribsnis.app" } } }));
  write(root, "package.json", JSON.stringify({ name: "nouri", version: "1.2.2", dependencies: { example: "1.2.3" } }));
  write(root, "package-lock.json", JSON.stringify({ version: "1.2.2", lockfileVersion: 3, packages: { "": { name: "nouri", version: "1.2.2" }, "node_modules/example": { version: "1.2.3", integrity: "keep-me" } } }));
  write(root, "eas.json", JSON.stringify({ cli: { appVersionSource: "remote" }, build: { production: { autoIncrement: true } } }));
  if (native) {
    write(root, nativePaths[0], 'android {\n  defaultConfig {\n    applicationId "com.dribsnis.app"\n    versionCode 5 // keep this comment\n    versionName "1.2.2"\n  }\n}\n');
    write(root, nativePaths[1], '<plist><dict>\n<key>CFBundleVersion</key>\n<string>7</string>\n<key>CFBundleShortVersionString</key>\n<string>1.2.2</string>\n<key>CFBundleIdentifier</key><string>com.dribsnis.app</string>\n</dict></plist>\n');
    write(root, nativePaths[2], '  CURRENT_PROJECT_VERSION = 9;\n  MARKETING_VERSION = 1.0;\n  CURRENT_PROJECT_VERSION = "9";\n  MARKETING_VERSION = "1.0";\n  PRODUCT_BUNDLE_IDENTIFIER = com.dribsnis.app;\n');
  }
  return root;
}

function run(root: string, ...args: string[]) {
  // A different cwd verifies that the script only touches its own project.
  return spawnSync(process.execPath, [join(root, "scripts/bump-version.mjs"), ...args], { cwd: tmpdir(), encoding: "utf8" });
}

function snapshot(root: string) {
  return Object.fromEntries(["app.json", "package.json", "package-lock.json", "eas.json", ...nativePaths]
    .filter((file) => existsSync(join(root, file))).map((file) => [file, read(root, file)]));
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("version bump CLI", () => {
  it("bumps a fresh checkout and repairs root version drift without touching dependencies or EAS", () => {
    const root = fixture();
    const eas = read(root, "eas.json");
    const result = run(root, "build");
    expect(result.status, result.stderr).toBe(0);
    expect(json(root, "app.json").expo).toMatchObject({ version: "1.2.3", android: { versionCode: 2, package: "com.dribsnis.app" }, ios: { buildNumber: "2", bundleIdentifier: "com.dribsnis.app" } });
    expect(json(root, "package.json")).toMatchObject({ version: "1.2.3", dependencies: { example: "1.2.3" } });
    expect(json(root, "package-lock.json")).toMatchObject({ version: "1.2.3", packages: { "": { version: "1.2.3" }, "node_modules/example": { version: "1.2.3", integrity: "keep-me" } } });
    expect(read(root, "eas.json")).toBe(eas);
    expect(result.stdout).toContain("EAS uses remote build numbers");
    expect(existsSync(join(root, "android"))).toBe(false);
    expect(existsSync(join(root, "ios"))).toBe(false);
    expect(run(root, "build").status).toBe(0);
    expect(json(root, "app.json").expo.android.versionCode).toBe(3);
  });

  it.each([ ["patch", "1.2.4"], ["minor", "1.3.0"], ["major", "2.0.0"] ])("bumps %s and synchronizes all native configurations above the highest existing build", (mode, version) => {
    const root = fixture(true);
    const result = run(root, mode);
    expect(result.status, result.stderr).toBe(0);
    expect(json(root, "app.json").expo).toMatchObject({ version, android: { versionCode: 10 }, ios: { buildNumber: "10" } });
    expect(json(root, "package.json").version).toBe(version);
    const lock = json(root, "package-lock.json");
    expect(lock.version).toBe(version);
    expect(lock.packages[""].version).toBe(version);
    expect(lock.packages["node_modules/example"].version).toBe("1.2.3");
    expect(read(root, nativePaths[0])).toContain(`versionCode 10 // keep this comment\n    versionName "${version}"`);
    expect(read(root, nativePaths[1])).toContain("<string>10</string>");
    expect(read(root, nativePaths[1])).toContain(`<string>${version}</string>`);
    expect(read(root, nativePaths[2])).toContain(`CURRENT_PROJECT_VERSION = 10;\n  MARKETING_VERSION = ${version};\n  CURRENT_PROJECT_VERSION = "10";\n  MARKETING_VERSION = "${version}";`);
  });

  it("preserves Xcode plist variables and Windows line endings", () => {
    const root = fixture(true);
    write(root, nativePaths[1], read(root, nativePaths[1]).replace("<string>7</string>", "<string>$(CURRENT_PROJECT_VERSION)</string>").replace("<string>1.2.2</string>", "<string>$(MARKETING_VERSION)</string>"));
    const plist = read(root, nativePaths[1]);
    for (const file of [nativePaths[0], nativePaths[2]]) write(root, file, read(root, file).replace(/\n/g, "\r\n"));
    const result = run(root, "patch");
    expect(result.status, result.stderr).toBe(0);
    expect(read(root, nativePaths[1])).toBe(plist);
    expect(read(root, nativePaths[0])).toContain('versionCode 10 // keep this comment\r\n    versionName "1.2.4"\r\n');
    expect(read(root, nativePaths[2])).toContain("CURRENT_PROJECT_VERSION = 10;\r\n");
  });

  it("previews the same changes without writing any files", () => {
    const root = fixture(true);
    const before = snapshot(root);
    const result = run(root, "patch", "--dry-run");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("version 1.2.3 → 1.2.4; local build 9 → 10");
    expect(result.stdout).toContain("Would update ios/Nouri.xcodeproj/project.pbxproj");
    expect(snapshot(root)).toEqual(before);
  });

  it.each(["buildNumberFromEnv", "2100000000"])("rejects an unsupported or exhausted native build (%s) before writing", (value) => {
    const root = fixture(true);
    write(root, nativePaths[0], read(root, nativePaths[0]).replace("versionCode 5", `versionCode ${value}`));
    const before = snapshot(root);
    const result = run(root, "patch");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Version bump failed:");
    expect(snapshot(root)).toEqual(before);
  });

  it("rejects unknown arguments without bumping", () => {
    const root = fixture();
    const before = snapshot(root);
    expect(run(root, "build", "--typo").status).toBe(1);
    expect(snapshot(root)).toEqual(before);
  });
});
