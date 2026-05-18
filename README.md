# Communication Support

A React Native + Expo prototype for calm, structured parent-child communication, with realtime sync, visual answer cards, Firebase image storage, and Android focus alerts.

---

# Project Purpose

This repository is building a two-device communication experience designed to support communication between parents and autistic children through calm, structured interaction.

The system works through a parent device and a child device:

- Parent creates a short question with visual answer options
- Parent can add images to options using camera or gallery
- Child receives the prompt in realtime
- Child selects one answer visually
- Parent receives the selected answer immediately
- Android devices can trigger focus alerts and overlays to capture attention even while other applications are open

The core goal is to support low-pressure communication through structured visual interaction and attention support mechanisms.

---

# Current Features

- Realtime parent-child communication
- Dynamic room-code pairing
- Collision-safe room generation
- Invalid child room-code protection
- Firebase Firestore synchronization
- Firebase Storage image uploads
- Camera/gallery image picker for parent option cards
- Image-based child option cards
- Emoji fallback when images are missing or fail to load
- Quick session templates
- Android overlay attention alerts
- Firebase Cloud Messaging integration
- Persistent device setup using AsyncStorage
- Child connection status tracking
- Native Android attention routing
- Background Firebase messaging support
- Clear session support across Firestore and parent UI state
- Send button guard while images are uploading

---

# Current Platform Support

| Feature                         | Android | iOS        |
| ------------------------------- | ------- | ---------- |
| Parent Mode                     | Yes     | Yes        |
| Child Mode                      | Yes     | Limited    |
| Realtime Communication          | Yes     | Yes        |
| Image Picker                    | Yes     | Yes        |
| Firebase Storage Images         | Yes     | Yes        |
| Overlay Attention Alerts        | Yes     | No         |
| Full Attention Capture          | Yes     | No         |
| Background Native Alert Routing | Yes     | No         |

---

# Repository Structure

- Active app: `focus-test/`
- Placeholder folders: `backend/`, `docs/`, `mobile-app/`
- Legacy file at root: `firebaseConfig.ts`

The active application currently lives inside:

```text
focus-test/
```

---

# Architecture Overview

## 1. App Shell and Role Flow

In:

```text
focus-test/app/CommunicationMvp.tsx
```

The application:

- Loads persisted `deviceRole` and `roomId` from AsyncStorage
- Handles first-time setup flow
- Routes user into Parent or Child mode
- Stores draft question/options
- Applies quick templates
- Supports deep linking using:

```text
focustest://?alert=child-alert
```

Flow:

```text
Welcome
→ Device Setup
→ Parent or Child Mode
```

---

## 2. Device Setup and Room Pairing

In:

```text
focus-test/app/DeviceSetup.tsx
```

Parent devices generate a human-readable room code.

Example:

```text
BLUE-48271
```

Room pairing features:

- Parent creates the room
- Child joins using the parent room code
- Room-code collision prevention
- Firestore uniqueness validation
- Child cannot create a new room by mistyping a code
- Invalid child room codes show a “Room not found” message
- Setup is persisted using AsyncStorage

This prevents accidental creation of fake Firestore rooms from child-side typos.

---

## 3. Realtime Communication

In:

```text
focus-test/app/communicationHelpers.ts
```

Firebase app, Firestore, and Storage are initialized from Expo environment variables.

Room structure:

```text
rooms/{roomId}
```

Flow:

```text
Parent sends session
→ Firestore updates
→ Cloud Function sends FCM message
→ Android child receives attention alert
→ Child app receives realtime session update
→ Child submits answer
→ Parent receives answer instantly
```

Session statuses currently used:

```text
idle
sent
answered
```

---

## 4. Parent UX

File:

```text
focus-test/app/ParentMode.tsx
```

Responsibilities:

- Create communication sessions
- Enter question/options
- Apply quick templates
- Add or change option images
- Choose image source from camera or gallery
- Upload selected images to Firebase Storage
- Preview the session before sending
- Send session to child
- View child response
- View child connection status
- Clear active session

Current quick templates:

```text
Food
Feelings
Activities
Yes / No
```

Image flow:

```text
Parent taps Add image
→ Chooses camera or gallery
→ Image uploads to Firebase Storage
→ Download URL is stored as option.imageUrl
→ Parent preview shows image
→ Child receives image card
```

The Send button is disabled while an image upload is in progress to prevent incomplete sessions from being sent.

---

## 5. Child UX

File:

```text
focus-test/app/ChildMode.tsx
```

Responsibilities:

- Wait for incoming session
- Display calm visual option cards
- Show images when available
- Fall back to emojis when image is missing or fails
- Allow child to select one option
- Show a clear selected-state checkmark
- Submit selected answer
- Show confirmation state

Child option card behavior:

```text
If option.imageUrl works → show image
If option.imageUrl fails → show emoji fallback
If no imageUrl exists → show emoji fallback
```

---

## 6. Shared UI Components

Files:

```text
focus-test/app/communicationUI.tsx
focus-test/app/communicationCommon.tsx
```

Shared UI includes:

- Reusable option cards
- Image-ready card layout
- Compact parent preview cards
- Large child-facing cards
- Selected option checkmark
- Calm visual styling
- Shared screen layout styles

---

## 7. Native Android Focus Alert Module

Local Expo module:

```text
focus-test/modules/focus-alert
```

Android native components include:

### Firebase Messaging Service

```text
FocusFirebaseMessagingService.kt
```

Receives Firebase Cloud Messaging data messages.

### Alert Manager

```text
FocusAlertManager.kt
```

Responsibilities:

- Determine device lock state
- Trigger overlays
- Prevent duplicate overlays
- Route attention behavior

### Native Module Bridge

```text
FocusAlertModule.kt
```

Exposes native Android methods to React Native.

Available methods:

```text
triggerFocusAlert()
showTestNotification()
canDrawOverlays()
requestOverlayPermission()
getFcmToken()
```

---

## 8. Overlay Attention System

The Android implementation supports:

- Heads-up notifications
- Full Screen Intents
- Overlay alerts over external applications
- Wake/attention behavior
- Background Firebase message handling

Validated against:

- YouTube
- Browser
- Android settings
- External applications

The overlay currently covers approximately 80–90% of the device screen.

Architecture rule:

```text
FCM / native Android = attention capture
Firestore = session state synchronization
```

This avoids duplicate overlay triggers.

---

# Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Expo Router
- Expo Image Picker
- Firebase Firestore
- Firebase Storage
- Firebase Cloud Messaging
- Kotlin
- Android SDK
- Expo Native Modules API
- AsyncStorage

---

# Setup

## Prerequisites

- Node.js LTS recommended
- npm
- Android Studio + Android SDK
- Firebase project
- Firebase Firestore enabled
- Firebase Storage enabled
- Firebase Cloud Messaging configured

---

## Install

From app folder:

```bash
cd focus-test
npm install
```

---

## Firebase Environment Config

Create:

```text
focus-test/.env
```

Using:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Restart Expo after changing environment variables.

---

# Run

From:

```text
focus-test/
```

Run:

```bash
npm run start
```

For native Android overlay behavior:

```bash
npm run android
```

Because this project uses a custom native Android module, Expo Go is not enough for the full Android attention-capture behavior. Use a native Android build.

---

# Recommended Testing Flow

1. Launch the app
2. Reset setup if needed
3. Set one device/session as Parent
4. Parent creates a room code
5. Child enters the same room code
6. Test wrong child room code rejection
7. Parent selects a quick template
8. Parent adds an image using camera or gallery
9. Parent previews the session
10. Parent sends the session
11. Child receives overlay/notification
12. Child selects an option
13. Parent receives the answer in realtime
14. Parent clears the session

---

# Current Demo Flow

Suggested Monday demo flow:

```text
1. Show parent setup and generated room code
2. Show child joining the same room
3. Demonstrate invalid child room code rejection
4. Apply Food template
5. Add image using camera/gallery
6. Preview parent session
7. Send session
8. Show Android overlay/attention capture
9. Show child visual option cards
10. Select answer on child screen
11. Show parent receiving response
12. Clear session
```
## Cross-Platform Demo Flow

The current demo can be tested using a browser or iPhone as the parent device and an Android emulator as the child device.

This setup is useful because the parent side does not depend on Android-only attention-capture features. The Android-specific behavior is mainly needed on the child side for notifications, overlays, and focus alerts.

### Recommended Demo Setup

- Parent device: iPhone Safari or desktop browser
- Child device: Android emulator
- Backend: Firebase Firestore, Firebase Cloud Messaging, Firebase Storage

### Running the Android Child App

Run the Android app from the project folder:

```bash
cd D:\communication_support\focus-test
npx expo run:android
```

Set up the Android app as the child device and enter the room code created by the parent.

### Running the Web Parent App

Expo web development mode currently has issues with Metro/HMR in this project, so the web parent is tested using a production-style export.

```bash
cd D:\communication_support\focus-test
npx expo export --platform web
npx serve dist -l 3000
```

Open the local URL in a browser.

For iPhone testing, use the laptop’s Wi-Fi IPv4 address from:

```bash
ipconfig
```

Example:

```text
http://192.168.1.23:3000
```

Do not use the `192.168.56.x` address because that is usually a virtual adapter address and may not be reachable from the phone.

### Demo Flow

1. Open the parent web app on iPhone Safari or desktop browser.
2. Create or enter a parent room.
3. Open the Android emulator app as the child.
4. Enter the same room code on the child device.
5. Parent selects a quick template or types a question.
6. Parent adds images manually or uses Generate demo visuals.
7. Parent sends the session.
8. Android child receives the visual cards.
9. Child selects an option and sends the answer.
10. Parent receives the child’s response in realtime.
11. Parent clears the session and the room returns to idle.

### Current Cross-Platform Behavior

| Feature | Web Parent | Android Child |
|---|---:|---:|
| Room creation | Yes | Not needed |
| Room joining | Yes | Yes |
| Quick templates | Yes | Not needed |
| Manual image selection | Yes | Not needed |
| Generate demo visuals | Yes | Not needed |
| Send session | Yes | Not needed |
| Receive visual cards | Not needed | Yes |
| Select answer | Not needed | Yes |
| Realtime parent response | Yes | Not needed |
| Android attention overlay | Not applicable | Yes |

### Notes

- The parent flow works through the browser, including on iPhone Safari.
- The child flow is currently Android-first because attention capture depends on Android native behavior.
- Firebase Firestore is used for realtime session state.
- Firebase Storage is used for uploaded option images.
- Firebase Cloud Messaging and the native Android module handle child-side attention capture.
- The Generate demo visuals feature currently uses mock image URLs and is intended to be replaced later with a backend AI image generation pipeline.
---

# Android Alert / FCM Notes

- App scheme:

```text
focustest
```

- Overlay behavior depends on:

  - notification permission
  - draw-over-apps permission

- Development FCM sender utility:

```text
focus-test/fcm-sender/
```

Firebase service account files must never be committed to version control.

---

# Known Limitations

- iOS does not support Android-style overlays
- Full attention capture is currently Android-only
- iOS child flow would need a different attention strategy
- AI-generated images are not yet implemented
- Current authentication/security rules are prototype-level
- Expo template files still exist in repository
- Root `firebaseConfig.ts` is legacy and should eventually be removed
- More real-device testing is needed beyond emulator testing

---

# Planned Next Steps

- AI-generated visual answer options
- Backend/Cloud Function for secure AI image generation
- More communication templates
- Better child selected-state and confirmation polish
- Accessibility-focused UI refinement
- Improved parent/child connection status UI
- Better session history and analytics
- Multi-device real-world testing
- Improved onboarding flow
- Stronger overlay customization
- Production-ready Firestore and Storage security rules

---

# Useful Commands

From:

```text
focus-test/
```

Commands:

```bash
npm run start
npm run android
npm run ios
npm run web
npm run lint
```

If a new native Expo module is installed, rebuild the Android app:

```bash
npx expo run:android --clear
```

For a deeper Android rebuild:

```bash
cd android
.\gradlew clean
cd ..
npx expo run:android --clear
```