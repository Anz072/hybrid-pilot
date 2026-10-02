# Dribsnis

A personal calorie and nutrition tracker built with Expo SDK 54 and React Native. Log food from the USDA and Open Food Facts databases (or scan a barcode), track weight, and let the adaptive engine estimate your TDEE and calorie targets over time. State is managed with Redux Toolkit and cached locally in SQLite. The calorie diary and food search are served by the Nouri backend; authentication remains directly with Supabase.

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
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL (used for Auth) |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase publishable key (public by design) |
| `EXPO_PUBLIC_API_BASE_URL` | Nouri backend base URL (see the `nouri-api` repo) |

Expo embeds these values in the APK when it builds the JavaScript bundle.
For a deployed backend, set `EXPO_PUBLIC_API_BASE_URL` to the service's HTTPS
base URL (without `/v1`), then rebuild and reinstall the APK after changes.
For EAS builds, configure the same variables in the selected EAS environment;
the Git-ignored local `.env` is not uploaded by default.

The USDA API key is no longer shipped in the app. Food search, barcode lookup and
the calorie diary are served by the Nouri backend, which holds those credentials
server-side.

Supabase and the API must point at the **same** environment — both local, or both
deployed. The app checks this on startup in development and logs a clear error if
they disagree, because the symptom otherwise is unexplained 401s: a local Supabase
signs tokens with its own key, which a deployed API will not accept.

### Running against a fully local stack

```bash
cd ../nouri-api
pnpm supabase start          # Postgres, Auth, Studio  (Docker)
pnpm supabase status -o env  # prints the publishable key
pnpm start:local             # the API on :8080
```

Then set the mobile env to match. **The host depends on where the app runs**, so
there is no single correct value — this is why it is configuration rather than a
constant, and why no developer's address belongs in committed source:

| Running on | Host to use | Why |
| --- | --- | --- |
| iOS Simulator | `127.0.0.1` | shares the host's network namespace |
| Android Emulator | `10.0.2.2` | `127.0.0.1` is the emulator itself; `10.0.2.2` is the host machine |
| Physical device / Expo Go | your machine's LAN IP | the device is a separate host on the network |

Find the LAN address with `ipconfig getifaddr en0` on macOS. For a physical
device the API must also listen beyond loopback — `HOST=0.0.0.0` is already the
default in `nouri-api`.

```bash
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321      # or 10.0.2.2 / <lan-ip>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<from supabase status>
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:8080       # same host as above
```

The backend enforces the other half of this: it refuses to start if
`SUPABASE_JWT_ISSUER` is a local Auth service while `DATABASE_URL` points
somewhere remote, so a locally minted token can never reach a real database.

The Supabase schema lives in the `nouri-api` repository, under
`supabase/migrations/`.

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

## Bump the app version or build number

Run a bump before creating a new local release:

```bash
npm run bump:build              # Keep 1.0.3; increment Android/iOS build IDs
npm run bump:patch              # 1.0.3 → 1.0.4, and increment build IDs
npm run bump:minor              # 1.0.3 → 1.1.0, and increment build IDs
npm run bump:major              # 1.0.3 → 2.0.0, and increment build IDs
npm run bump:patch -- --dry-run  # Preview without changing files
```

`app.json` is the source for the public version. The script synchronizes
`package.json`, both root version entries in `package-lock.json`, Expo's
`android.versionCode` / `ios.buildNumber`, and any existing generated Nouri
Android Gradle, iOS Info.plist, and Xcode project version settings. Both local
build IDs become one greater than the highest existing local build ID; they
are never reset by a version bump. Build IDs must be positive integers.

Missing native projects are skipped; the next Expo prebuild uses the updated
`app.json`. The script does not build the app, create Git commits/tags, or bump
dependency versions. Review and commit the changed tracked version files.

EAS currently uses **remote** build numbers (`eas.json`), with production
auto-increment enabled. These commands update the public version used by EAS,
but local build IDs do not override EAS's remote counters or change its
auto-increment behavior.

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
