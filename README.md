# Communication Support — Expo Prototype

Lightweight React Native + Expo prototype that demonstrates a calm parent/child communication flow.
Summary
- Project uses Expo + React Native with the Expo Router. The working app lives in the `focus-test` folder.
- Main app component: `focus-test/app/CommunicationMvp.tsx` (exported via `focus-test/app/index.tsx`).
- Local native module: `modules/focus-alert` — used by the app via a file dependency declared in `focus-test/package.json`.

Quick Links
- App entry: [focus-test/app/CommunicationMvp.tsx](focus-test/app/CommunicationMvp.tsx#L1-L20)
- App root re-export: [focus-test/app/index.tsx](focus-test/app/index.tsx#L1)
- Expo config: [focus-test/app.json](focus-test/app.json#L1-L40)
- Package manifest: [focus-test/package.json](focus-test/package.json#L1-L20)
- Native module: [focus-test/modules/focus-alert](focus-test/modules/focus-alert/README.md#L1-L10)

Project structure (high level)
- `focus-test/` — the Expo app (app code, config, assets).
- `focus-test/app/` — React code using file-based routing; main UI components and screens live here.
- `focus-test/modules/focus-alert/` — local Expo module providing native notifications (Android/iOS code under `android/` and `ios/`).

How the app starts
- Runtime entry (in `focus-test/package.json`) uses `expo-router/entry` which mounts the router.
- The router's root page re-exports the main component from `focus-test/app/CommunicationMvp.tsx`.

Quick start (development)
Prerequisites: Node.js, npm (or yarn), and Expo CLI if you use some dev-client flows.

1. Install dependencies
2. Configure Firebase
- Copy `.env.example` to `.env` at `focus-test/.env` and populate `EXPO_PUBLIC_FIREBASE_*` values.

3. Start the Expo dev server
4. Run on a device/emulator

```bash
# Open with Expo Go (limited) or use a dev client for native modules
npx expo start           # then press 'a' (Android), 'i' (iOS) in the terminal UI
# OR for a native dev-client (recommended for `focus-alert` native features)
npx expo run:android
npx expo run:ios
```

Notes on the native module (`focus-alert`)
- The native module is included as a local package in `focus-test/package.json` (`"focus-alert": "file:modules/focus-alert"`).
- Android Java/Kotlin module entry is under `focus-test/modules/focus-alert/android/src/...` (see `FocusAlertModule.kt`).
- The app includes a small test button in the Parent screen that calls `FocusAlert.showTestNotification()` to trigger the native notification path.
- To exercise native behavior on Android/iOS, build the app either with `npx expo run:android` / `npx expo run:ios` or use a custom development client (`expo-dev-client`).

Linting & types

```bash
# TypeScript checks
npx tsc --noEmit

# Lint
npm run lint
```

Useful scripts
- `npm run start` — starts the Expo dev server (`expo start`).
- `npm run android` — `expo run:android` (build + install to device/emulator).
- `npm run ios` — `expo run:ios` (macOS only).
- `npm run reset-project` — helper that reinitializes the sample app into `app-example` and gives a blank `app` to start from scratch.

Contributing & notes
- Follow the existing patterns in `focus-test/app/` when adding screens or helpers. The app expects an initial Welcome → Setup flow which persists `deviceRole` and `roomId` in `AsyncStorage`.
- Firestore helpers and room-based syncing are implemented in `focus-test/app/communicationHelpers.ts`.
- If you change native code in `modules/focus-alert`, reinstall node modules and perform a fresh native build (or use a dev client).

If you'd like, I can also:
- Add a short `DEVELOPMENT.md` with step-by-step contributor instructions.
- Update `focus-test/README.md` to include the native module notes and the test button location.
# Communication Support — Expo Prototype

Lightweight React Native + Expo prototype for a calm parent/child communication flow.

Where to look
- `focus-test/app/CommunicationMvp.tsx` — app entry (now small), imports below.
- `focus-test/app/communicationHelpers.ts` — shared types, constants, and session helpers.
- `focus-test/app/communicationCommon.tsx` — shared styles and some UI wiring.
- `focus-test/app/communicationUI.tsx` — small UI components (`OptionCard`, `Header`).
- `focus-test/app/ParentMode.tsx` — Parent builder UI + keyboard-aware behavior.
- `focus-test/app/ChildMode.tsx` — Child flow (incoming → choice → confirmation).

Quick start
- Install deps and start Expo (dev server):

```bash
npx expo install
npx expo start
# then press `i` (iOS) or `a` (Android) in the dev tools
```

- Run TypeScript checks:

```bash
npx tsc --noEmit
```

Recent notes
- The large `CommunicationMvp` implementation was split into helpers and UI files to improve maintainability.
- Parent mode includes keyboard avoidance and auto-scroll for focused inputs (uses `onLayout` caching).

Changelog (since the pre-welcome-screen commit)
- Added a first-time Welcome screen and flow to introduce the app before device setup.
- Implemented persistent device setup using `AsyncStorage` so each device remembers its role (`parent` or `child`) and `roomId` across launches.
- Added `DeviceSetup` two-step wizard for role selection and room code entry.
- Wired Firestore realtime syncing with `onSnapshot` and room-based documents (all Firestore helpers now accept a `roomId` parameter).
- Migrated Firebase config to use `EXPO_PUBLIC_` env vars and removed risky cross-root imports; added `.env.example` template.
- Fixed Firestore data issues (removed sending `undefined` fields) and improved error handling for missing env vars.
- Created a redesigned Parent UI (merged into `ParentMode.tsx`) with improved layout and added corresponding styles in `focus-test/app/communicationCommon.tsx`.
- Child mode remains lightweight and unchanged in behavior, receiving sessions in realtime and submitting answers.
- Improved preview behavior so the preview shows the live draft (not the last-sent session).
- Small UX polish and bugfixes (reset flow, session reset, and style collisions resolved).

Files touched (high level)
- focus-test/app/WelcomeScreen.tsx
- focus-test/app/DeviceSetup.tsx
- focus-test/app/ParentMode.tsx
- focus-test/app/ChildMode.tsx
- focus-test/app/CommunicationMvp.tsx
- focus-test/app/communicationHelpers.ts
- focus-test/app/communicationCommon.tsx
- focus-test/.env.example

Quick test & commit steps
1. Run the Expo dev server and open two devices/emulators (one Parent, one Child):

```bash
npx expo start
# open on devices/emulators from the dev tools (press 'a' or 'i')
```

2. On first launch, follow the Welcome -> Setup flow to choose Parent/Child and enter a room code (e.g. `demo-room`).
3. On the Parent device: compose a question, edit options, preview, then "Send to Child".
4. On the Child device: receive the session in realtime and submit an answer; Parent should see the response live.
5. When ready, commit the changes



