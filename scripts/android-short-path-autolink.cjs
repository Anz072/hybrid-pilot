const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const appRoot = path.resolve(__dirname, "..");
const shortProjectRoot = path.resolve(
  process.env.ANDROID_SHORT_PROJECT_ROOT || "C:\\hp",
);

const cliArgs = [
  "expo-modules-autolinking",
  "react-native-config",
  "--json",
  "--platform",
  "android",
  "--project-root",
  appRoot,
];

const result =
  process.platform === "win32"
    ? spawnSync("cmd.exe", ["/d", "/s", "/c", `npx ${cliArgs.join(" ")}`], {
        cwd: appRoot,
        encoding: "utf8",
      })
    : spawnSync("npx", cliArgs, {
        cwd: appRoot,
        encoding: "utf8",
      });

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
  process.exit(result.status || 1);
}

const hasShortRoot =
  fs.existsSync(shortProjectRoot) &&
  fs.existsSync(path.join(shortProjectRoot, "package.json"));

if (!hasShortRoot) {
  process.stdout.write(result.stdout);
  process.exit(0);
}

const longRootWindows = appRoot;
const shortRootWindows = shortProjectRoot;
const longRootPosix = longRootWindows.replace(/\\/g, "/");
const shortRootPosix = shortRootWindows.replace(/\\/g, "/");

const rewriteStringPrefix = (value, sourcePrefix, targetPrefix) => {
  if (!value) {
    return null;
  }

  const normalizedValue = value.toLowerCase();
  const normalizedSourcePrefix = sourcePrefix.toLowerCase();

  if (!normalizedValue.startsWith(normalizedSourcePrefix)) {
    return null;
  }

  return targetPrefix + value.slice(sourcePrefix.length);
};

const rewriteValue = (value) => {
  if (typeof value === "string") {
    const rewrittenWindows = rewriteStringPrefix(
      value,
      longRootWindows,
      shortRootWindows,
    );

    if (rewrittenWindows) {
      return rewrittenWindows;
    }

    const rewrittenPosix = rewriteStringPrefix(
      value,
      longRootPosix,
      shortRootPosix,
    );

    if (rewrittenPosix) {
      return rewrittenPosix;
    }

    return value;
  }

  if (Array.isArray(value)) {
    return value.map(rewriteValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        rewriteValue(entryValue),
      ]),
    );
  }

  return value;
};

const parsed = JSON.parse(result.stdout);
const rewritten = rewriteValue(parsed);
process.stdout.write(JSON.stringify(rewritten));
