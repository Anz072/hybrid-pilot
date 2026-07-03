# Dribsnis

A personal calorie and nutrition tracker built with Expo SDK 54 and React Native. Log food from the USDA and Open Food Facts databases (or scan a barcode), track weight, and let the adaptive engine estimate your TDEE and calorie targets over time. State is managed with Redux Toolkit, stored locally in SQLite, and synced to Supabase.

## Prerequisites

- **Node.js 20+** and npm
- **Expo CLI** — used via `npx`, no global install needed
- For Android: **Android Studio** (with an emulator or a USB-connected device), the **Android SDK**, and a **JDK 17**
- A `.env` file with the API keys below

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your env file and fill in the keys
cp .env.example .env
```

Required environment variables (see [.env.example](.env.example)):

| Variable | Description |
| --- | --- |
| `EXPO_PUBLIC_USDA_API_KEY` | USDA FoodData Central API key ([get one](https://fdc.nal.usda.gov/api-key-signup.html)) |
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

The Supabase schema lives in [docs/supabase-schema.sql](docs/supabase-schema.sql).

## Run on Android (emulator or device)

Start an Android emulator from Android Studio, or connect a physical device with USB debugging enabled, then:

```bash
npm run android
```

This runs `expo run:android`, which generates the native Android project (if missing), builds a debug app, and installs it on the running emulator/device.

## Build a production APK locally

This builds the release APK on your machine with Gradle — no Expo cloud (EAS) involved.

```bash
npm run apk
```

This runs `expo prebuild -p android` to generate the native `android/` project, then `./gradlew assembleRelease` to produce the APK. The signed output lands at:

```
android/app/build/outputs/apk/release/app-release.apk
```

Install it on a connected device with `adb install <path-to-apk>`.

Notes:
- The build targets `arm64-v8a` only (smaller APK, covers modern devices). Drop the `-PreactNativeArchitectures` flag in the `apk`/`build:apk:local` scripts to build all ABIs.
- Release builds are signed with Expo's default debug keystore, which is fine for personal installs. For a distributable, store-ready build, configure your own release keystore in `android/app/build.gradle`.
- Already have the `android/` folder generated? Skip prebuild and run `npm run build:apk:local` directly.
- On **Windows**, use the scripts without the `./` prefix on `gradlew` (i.e. call `gradlew`).

## Other useful scripts

| Script | What it does |
| --- | --- |
| `npm start` | Start the Metro dev server |
| `npm run ios` | Build and run on an iOS simulator |
| `npm run typecheck` | Type-check with `tsc` |
| `npm test` | Type-check plus unit tests |
| `npm run build:aab:local` | Build a release `.aab` locally (for Play Store) |
| `npm run build:apk` | Build an APK via EAS cloud |
</content>
</invoke>
