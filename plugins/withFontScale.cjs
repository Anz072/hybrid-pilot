const { AndroidConfig, withAndroidManifest, withMainActivity, withMainApplication } = require("expo/config-plugins");

// RN 0.81.5 has the Fabric font-scale invalidation path, but leaves it disabled
// in stable builds. Keep this compatibility fix reviewable across RN upgrades.
const reactNativeVersion = require("react-native/package.json").version;
const marker = "nouri-font-scale";

function insertOnce(source, anchor, contents) {
  if (source.includes(`// ${marker}`)) return source;
  if (source.split(anchor).length !== 2) throw new Error(`Cannot apply font-scale fix: expected one ${anchor}`);
  return source.replace(anchor, `${anchor}\n${contents}`);
}

module.exports = function withFontScale(config) {
  if (reactNativeVersion !== "0.81.5") {
    throw new Error("Review/remove withFontScale when upgrading React Native from 0.81.5.");
  }
  if (config.newArchEnabled !== true) throw new Error("Review the font-scale compatibility fix before disabling the new architecture.");
  config = withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const changes = new Set((activity.$["android:configChanges"] || "").split("|").filter(Boolean));
    changes.add("fontScale");
    activity.$["android:configChanges"] = [...changes].join("|");
    return mod;
  });
  config = withMainApplication(config, (mod) => {
    if (mod.modResults.language !== "kt") throw new Error("Android font-scale fix expects Kotlin MainApplication.");
    mod.modResults.contents = insertOnce(mod.modResults.contents, "    loadReactNative(this)", `    // ${marker}: before any React host/runtime is created.
    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      check(DefaultNewArchitectureEntryPoint.releaseLevel == ReleaseLevel.STABLE)
      val stable = com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsOverrides_RNOSS_Stable_Android(true, true, true)
      // loadReactNative installs stable flags itself. Replace that provider only
      // during bootstrap, preserving every flag except font-scale invalidation.
      val accessed = com.facebook.react.internal.featureflags.ReactNativeFeatureFlags.dangerouslyForceOverride(
        object : com.facebook.react.internal.featureflags.ReactNativeFeatureFlagsProvider by stable {
          override fun enableFontScaleChangesUpdatingLayout(): Boolean = true
        }
      )
      check(accessed?.contains("enableFontScaleChangesUpdatingLayout") != true) {
        "Font-scale flags must be configured before the React runtime starts."
      }
    }`);
    return mod;
  });
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") throw new Error("Android font-scale fix expects Kotlin MainActivity.");
    mod.modResults.contents = insertOnce(mod.modResults.contents, "class MainActivity : ReactActivity() {", `  // ${marker}: handle font changes without destroying navigation/form state.
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    super.onConfigurationChanged(newConfig)
    reactHost?.currentReactContext?.let { context ->
      com.facebook.react.uimanager.DisplayMetricsHolder.initDisplayMetrics(context)
      // DeviceInfo otherwise emits a new font scale only on host resume. A
      // foreground settings/configuration change may have no resume callback.
      context.emitDeviceEvent("didUpdateDimensions",
        com.facebook.react.uimanager.DisplayMetricsHolder.getDisplayMetricsWritableMap(newConfig.fontScale.toDouble()))
    }
    // Request the Fabric root itself: unchanged window dimensions can let
    // Android skip its onMeasure, leaving the old font-scale constraints.
    fun updateSurface(view: android.view.View) {
      if (view is com.facebook.react.runtime.ReactSurfaceView) {
        view.requestLayout()
      } else if (view is android.view.ViewGroup) {
        for (index in 0 until view.childCount) updateSurface(view.getChildAt(index))
      }
    }
    updateSurface(window.decorView)
  }
`);
    return mod;
  });
};
