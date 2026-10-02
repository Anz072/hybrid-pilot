import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// Resolve from this script so invocation from another directory is safe.
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (file) => readFileSync(resolve(root, file), "utf8");
const exists = (file) => existsSync(resolve(root, file));
const unquote = (value) => value.replace(/^(["'])(.*)\1$/, "$2");

function buildNumber(value, source) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${source} must be a positive integer build number; found ${JSON.stringify(value)}.`);
  }
  return Number(value);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((arg) => arg !== "--dry-run");
  const mode = positional[0];
  if (positional.length !== 1 || !["build", "patch", "minor", "major"].includes(mode)) {
    throw new Error("Usage: node scripts/bump-version.mjs <build|patch|minor|major> [--dry-run]");
  }
  if (["app.config.js", "app.config.ts", "app.config.mjs"].some(exists)) {
    throw new Error("Dynamic Expo config detected. Update this script to use it before bumping versions.");
  }

  const app = JSON.parse(read("app.json"));
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  const eas = exists("eas.json") ? JSON.parse(read("eas.json")) : null;
  const currentVersion = app.expo?.version;
  if (typeof currentVersion !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(currentVersion)) {
    throw new Error("app.json expo.version must be a stable major.minor.patch version.");
  }
  if (!lock.packages?.[""]) {
    throw new Error("package-lock.json must contain the root package entry (lockfile v2 or v3).");
  }
  const parts = currentVersion.split(".").map(Number);
  if (mode !== "build") {
    const index = { major: 0, minor: 1, patch: 2 }[mode];
    parts[index] += 1;
    parts.fill(0, index + 1);
  }
  if (!parts.every(Number.isSafeInteger)) throw new Error("Version exceeds safe integer precision.");
  const version = parts.join(".");
  const builds = [
    buildNumber(app.expo.android?.versionCode ?? 1, "app.json android.versionCode"),
    buildNumber(app.expo.ios?.buildNumber ?? "1", "app.json ios.buildNumber"),
  ];

  // Only Nouri's generated app files: never dependencies, Pods, or lockfile dependency versions.
  const nativeSpecs = [
    {
      file: "android/app/build.gradle",
      fields: [
        { kind: "build", pattern: /^([ \t]*versionCode[ \t]+)(\S+)([ \t]*(?:\/\/[^\r\n]*)?\r?)$/gm },
        { kind: "version", pattern: /^([ \t]*versionName[ \t]+)(["'][^"'\r\n]+["'])([ \t]*(?:\/\/[^\r\n]*)?\r?)$/gm },
      ],
    },
    {
      file: "ios/Nouri/Info.plist",
      fields: [
        { kind: "build", pattern: /(<key>CFBundleVersion<\/key>\s*<string>)([^<]+)(<\/string>)/g, variable: "$(CURRENT_PROJECT_VERSION)" },
        { kind: "version", pattern: /(<key>CFBundleShortVersionString<\/key>\s*<string>)([^<]+)(<\/string>)/g, variable: "$(MARKETING_VERSION)" },
      ],
    },
    {
      file: "ios/Nouri.xcodeproj/project.pbxproj",
      fields: [
        { kind: "build", pattern: /^([ \t]*CURRENT_PROJECT_VERSION = )([^;\r\n]+)(;[^\n]*)$/gm },
        { kind: "version", pattern: /^([ \t]*MARKETING_VERSION = )([^;\r\n]+)(;[^\n]*)$/gm },
      ],
    },
  ];
  const nativeFiles = nativeSpecs.filter(({ file }) => exists(file)).map((spec) => ({ ...spec, source: read(spec.file) }));
  for (const { file, source, fields } of nativeFiles) {
    for (const field of fields) {
      const matches = [...source.matchAll(field.pattern)];
      if (!matches.length) throw new Error(`Cannot locate ${field.kind} in ${file}; no files changed.`);
      for (const match of matches) {
        if (field.kind === "build" && match[2] !== field.variable) {
          builds.push(buildNumber(unquote(match[2]), file));
        }
      }
    }
  }
  // Keep both platforms aligned without lowering an existing native build number.
  const build = Math.max(...builds) + 1;
  if (build > 2_100_000_000) throw new Error("Next build exceeds Android's versionCode limit.");

  app.expo.version = version;
  app.expo.android = { ...app.expo.android, versionCode: build };
  app.expo.ios = { ...app.expo.ios, buildNumber: String(build) };
  pkg.version = lock.version = lock.packages[""].version = version;
  const changes = new Map([
    ["app.json", JSON.stringify(app, null, 2) + "\n"],
    ["package.json", JSON.stringify(pkg, null, 2) + "\n"],
    ["package-lock.json", JSON.stringify(lock, null, 2) + "\n"],
  ]);
  for (const { file, source, fields } of nativeFiles) {
    let updated = source;
    for (const field of fields) {
      updated = updated.replace(field.pattern, (match, prefix, old, suffix) => {
        // Preserve plist references to Xcode settings; those settings are updated above.
        if (old === field.variable) return match;
        const next = field.kind === "build" ? String(build) : version;
        const quote = /^["']/.test(old) ? old[0] : "";
        return `${prefix}${quote}${next}${quote}${suffix}`;
      });
    }
    changes.set(file, updated);
  }

  console.log(`${dryRun ? "Dry run" : "Bump"}: version ${currentVersion} → ${version}; local build ${Math.max(...builds)} → ${build}`);
  // All formats and values are validated before writing any files.
  for (const [file, content] of changes) {
    if (content === read(file)) continue;
    if (!dryRun) writeFileSync(resolve(root, file), content);
    console.log(`  ${dryRun ? "Would update" : "Updated"} ${file}`);
  }
  if (eas?.cli?.appVersionSource === "remote") {
    console.log("EAS uses remote build numbers; these local build IDs do not replace them. Cloud auto-increment settings are unchanged.");
  }
}

try {
  main();
} catch (error) {
  console.error(`Version bump failed: ${error.message}`);
  process.exitCode = 1;
}
