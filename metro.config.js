const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Work around package exports resolution issues with d3-* on Windows/Metro.
config.resolver.unstable_enablePackageExports = false;

const d3ZoomEntry = path.resolve(__dirname, "node_modules/d3-zoom/src/index.js");
const d3ShapeEntry = path.resolve(__dirname, "node_modules/d3-shape/src/index.js");

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "d3-zoom") {
    return { filePath: d3ZoomEntry, type: "sourceFile" };
  }

  if (moduleName === "d3-shape") {
    return { filePath: d3ShapeEntry, type: "sourceFile" };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
