# Dribsnis

Expo SDK 54 app for personal iPhone and Android installs.

## Mac local build

### Prerequisites

- Xcode 17+
- CocoaPods
- Android Studio
- Node.js and npm

Open Xcode once after installing it so the iOS tools finish setting themselves up.

### Setup

```bash
git clone <your-repo-url>
cd dribsnis
cp .env.example .env
npm install
```

Fill `.env` with the same values you use locally now.

## Run on iPhone from a Mac

This repo does not commit `ios/`. That is intentional. Expo will generate it on macOS.

### Development build

```bash
npm run prebuild:ios
npm run ios:device
```

This is the best path for active development, but it is not the most "normal app" experience because it is a debug build.

If Xcode prompts for signing:

- Open the generated workspace inside `ios/`
- Select the app target
- Go to `Signing & Capabilities`
- Choose your Apple ID team
- If the bundle identifier is already taken, change `expo.ios.bundleIdentifier` in `app.json` to something unique for your device build, then run `npm run prebuild:ios:clean`

After the first native build, start Metro with:

```bash
npm run start:dev-client
```

### Standalone-style iPhone app

If you want the app to behave more like a normal installed app and launch without Metro running on your Mac:

1. Run `npm run prebuild:ios`
2. If signing is already working, run `npm run ios:release:device`
3. If signing is not set up yet, open the generated `ios` workspace in Xcode
4. Select your iPhone as the run destination
5. In `Signing & Capabilities`, choose your Apple ID team
6. After that, run `npm run ios:release:device`

That produces a local release-style build for your device with the JavaScript bundled into the app.

## Run on Android from a Mac

Start an Android emulator in Android Studio or connect a physical Android device with USB debugging enabled, then run:

```bash
npm run android
```

## Notes

- The app uses the custom URL scheme `dribsnis`
- Google auth redirect is `dribsnis://auth/callback`
- If you reuse the current Supabase project, make sure that redirect is allowed there
- `app.json` already includes matching Android package and iOS bundle identifier values for local native generation
