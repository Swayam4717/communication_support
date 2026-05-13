# Communication Support

A React Native + Expo prototype for calm, structured parent-child communication, with realtime sync and Android focus alerts.

## Project Purpose

This repository is building a two-device communication experience:

- Parent device creates a short question with visual answer options.
- Child device receives the prompt in realtime and selects one answer.
- Parent sees the selected answer immediately.
- Child Device can display a native Android focus alert when a new communication session arrives

The core goal is to support the calm, low-pressure communication through structured visual interaction and attention support mechanisms.

## Repository Structure

- Active app: `focus-test/` (Expo app, this is where current product work is happening)
- Placeholder/empty folders: `backend/`, `docs/`, `mobile-app/`
- Legacy file at root: `firebaseConfig.ts` (contains Firebase init, but active app uses env-based Firebase config inside `focus-test/app/communicationHelpers.ts`)

## Architecture overview

### 1. App shell and role flow

In `focus-test/app/CommunicationMvp.tsx`:

- Startup loads persisted `deviceRole` and `roomId` from AsyncStorage.
- First-time flow is: Welcome -> Device Setup -> Parent Mode or Child Mode.
- Device setup persists role + room code for later launches.
- Deep links with `focustest://?alert=child-alert` can force navigation to child flow.

### 2. Realtime communication

In `focus-test/app/communicationHelpers.ts`:

- Firebase app + Firestore are initialized from Expo public env vars.
- Room document path is `rooms/{roomId}`.
- Parent sends a `CommunicationSession` document.
- Child subscribes via Firestore `onSnapshot`.
- Child answer writes `selectedAnswer` and updates status to `answered`.

Session statuses in use: `idle`, `sent`, `answered`.

### 3. Parent and child UX

- Parent screen (`focus-test/app/ParentMode.tsx`):
  - Composes question + options.
  - Optional preview.
  - Sends session to Firestore.
  - Watches for child response.
- Child screen (`focus-test/app/ChildMode.tsx`):
  - Waits in `idle`.
  - Moves to `incoming` when a session arrives.
  - Enters `choice` and submits answer.
  - Shows `confirmation` after submit.

### 4. Native focus alert module

Local Expo module: `focus-test/modules/focus-alert` (linked via `file:modules/focus-alert`).

Android implementation includes:

- Firebase Messaging service (`FocusFirebaseMessagingService.kt`) to receive FCM data messages.
- Alert manager (`FocusAlertManager.kt`) to trigger overlay routing.
- Native module bridge (`FocusAlertModule.kt`) exposing methods to JS:
  - `triggerFocusAlert()`
  - `showTestNotification()`
  - `canDrawOverlays()`
  - `requestOverlayPermission()`
  - `getFcmToken()`

The app invokes this module from child and parent flows.

### 5. Test FCM sender utility

`focus-test/fcm-sender/sender.js` sends Firebase HTTP v1 messages using a service account.
This appears to be a development helper to trigger focus alerts on a device token.

⚠️ The Firebase service account JSON used by the HTTP v1 sender must never be committed to version control.

## Tech stack

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Expo Router
- Firebase Firestore (web SDK in app layer)
- Firebase Cloud Messaging (Android native layer)
- Local Expo native module (`focus-alert`)

## Setup

## Prerequisites

- Node.js 18+
- npm
- Android Studio + Android SDK (for native Android testing)
- A Firebase project

## Install

From the app folder:

```bash
cd focus-test
npm install
```

## Firebase env config

Create `focus-test/.env` from `focus-test/.env.example`:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Restart Expo after changing env values.

## Run

From `focus-test/`:

```bash
npm run start
```

For native module behavior (overlay/notifications), use a native build:

```bash
npm run android
```

## Recommended testing flow

1. Launch two app instances/devices.
2. Device A: choose Parent role and set room code (example: `demo-room`).
3. Device B: choose Child role with same room code.
4. Parent sends a session.
5. Child receives and submits answer.
6. Parent sees answer update in realtime.

## Android alert/FCM notes

- App scheme is `focustest` (configured in `focus-test/app.json`).
- Android permissions include notifications and overlay-related permissions.
- Native alert behavior depends on runtime permissions (notifications and draw-over-apps).
- Development FCM sender is under `focus-test/fcm-sender/`.

## Known gaps and cleanup opportunities

- Root README was previously outdated/duplicated (now replaced).
- `focus-test/modules/focus-alert/README.md` is still the Expo module template and does not describe actual implemented behavior.
- Template Expo screens still exist (for example `focus-test/app/modal.tsx` and `focus-test/app/(tabs)/explore.tsx`) while primary UX lives in `CommunicationMvp` flow.
- Root `firebaseConfig.ts` likely should be removed or clearly marked as legacy to avoid confusion.

## Useful commands

From `focus-test/`:

- `npm run start` - start Expo dev server
- `npm run android` - build/run Android native app
- `npm run ios` - build/run iOS native app (macOS only)
- `npm run web` - run web target
- `npm run lint` - run lint
