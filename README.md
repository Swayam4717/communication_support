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
5. When ready, commit the changes:



