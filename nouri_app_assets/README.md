# Nouri app icon package

Selected design: option 5 — capital **N** with a pink calorie/gauge arc.

## Expo / React Native

Copy `assets/images/` into the same location in your project, then merge
`app.json-snippet.json` into your existing Expo config.

Primary files:

- `icon.png` — general 1024×1024 app icon
- `ios-icon.png` — opaque, full-bleed iOS icon
- `android-icon.png` — legacy Android icon
- `adaptive-icon.png` — transparent Android adaptive foreground
- `adaptive-background.png` — adaptive background layer
- `monochrome-icon.png` — Android themed icon layer
- `splash-icon.png` — transparent splash-screen mark
- `favicon.png` — web favicon
- `notification-icon.png` — optional Android notification icon

## Transparent brand files

- `brand/nouri-mark-transparent.svg`
- `brand/nouri-mark-transparent-2048.png`
- `brand/nouri-rounded-preview-transparent.png`

## Store files

- `store/app-store-icon-1024.png`
- `store/google-play-icon-512.png`

## Native projects

- `native-ios/AppIcon.appiconset/` contains a complete standard iOS icon set.
- `native-android/` contains launcher, adaptive, and notification density exports.

## Important

The transparent files are used for the Android adaptive foreground, splash
screen, notification icon, and general branding. The iOS app icon is
deliberately opaque and full-bleed so it can be accepted and masked correctly
by iOS.
