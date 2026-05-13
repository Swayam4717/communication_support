# Communication Support

A React Native + Expo prototype for calm, structured parent-child communication, with realtime sync and Android focus alerts.

---

# Project Purpose

This repository is building a two-device communication experience designed to support communication between parents and autistic children through calm, structured interaction.

The system works through a parent device and a child device:

* Parent creates a short question with visual answer options
* Child receives the prompt in realtime
* Child selects one answer visually
* Parent receives the selected answer immediately
* Android devices can trigger focus alerts and overlays to capture attention even while other applications are open

The core goal is to support low-pressure communication through structured visual interaction and attention support mechanisms.

---

# Current Features

* Realtime parent-child communication
* Dynamic room-code pairing
* Collision-safe room generation
* Firebase Firestore synchronization
* Android overlay attention alerts
* Firebase Cloud Messaging integration
* Persistent device setup using AsyncStorage
* Child connection status tracking
* Native Android attention routing
* Background Firebase messaging support

---

# Current Platform Support

| Feature                         | Android | iOS        |
| ------------------------------- | ------- | ---------- |
| Parent Mode                     | ✅       | ✅          |
| Child Mode                      | ✅       | ⚠️ Limited |
| Realtime Communication          | ✅       | ✅          |
| Overlay Attention Alerts        | ✅       | ❌          |
| Full Attention Capture          | ✅       | ❌          |
| Background Native Alert Routing | ✅       | ❌          |

---

# Repository Structure

* Active app: `focus-test/`
* Placeholder folders: `backend/`, `docs/`, `mobile-app/`
* Legacy file at root: `firebaseConfig.ts`

The active application currently lives entirely inside:

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

* Loads persisted `deviceRole` and `roomId` from AsyncStorage
* Handles first-time setup flow
* Routes user into Parent or Child mode
* Supports deep linking using:

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

## 2. Realtime Communication

In:

```text
focus-test/app/communicationHelpers.ts
```

Firebase app + Firestore are initialized from Expo environment variables.

Room structure:

```text
rooms/{roomId}
```

Flow:

```text
Parent sends session
→ Firestore updates
→ Child receives realtime update
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

## 3. Parent and Child UX

### Parent Screen

File:

```text
focus-test/app/ParentMode.tsx
```

Responsibilities:

* Create communication session
* Enter question/options
* Preview session
* Send session
* View child response
* View child connection status

### Child Screen

File:

```text
focus-test/app/ChildMode.tsx
```

Responsibilities:

* Wait for incoming session
* Display visual options
* Submit selected answer
* Show confirmation state

---

## 4. Native Android Focus Alert Module

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

* Determine device lock state
* Trigger overlays
* Prevent duplicate overlays
* Route attention behavior

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

## 5. Overlay Attention System

The Android implementation supports:

* Heads-up notifications
* Full Screen Intents
* Overlay alerts over external applications
* Wake/attention behavior
* Background Firebase message handling

Validated against:

* YouTube
* Browser
* Android settings
* External applications

The overlay currently covers approximately 80–90% of the device screen.

---

## 6. Dynamic Room Pairing

Parent devices automatically generate room codes.

Example:

```text
BLUE-48271
```

Features:

* Human-readable room codes
* Collision prevention
* Firestore uniqueness validation
* Persistent room storage

---

# Tech Stack

* Expo SDK 54
* React Native 0.81
* React 19
* TypeScript
* Expo Router
* Firebase Firestore
* Firebase Cloud Messaging
* Kotlin
* Android SDK
* Expo Native Modules API

---

# Setup

## Prerequisites

* Node.js 18+
* npm
* Android Studio + Android SDK
* Firebase project

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

---

# Recommended Testing Flow

1. Launch two devices/emulators
2. Parent creates room
3. Child joins same room
4. Parent sends session
5. Child receives overlay/notification
6. Child answers visually
7. Parent receives answer in realtime

---

# Android Alert / FCM Notes

* App scheme:

```text
focustest
```

* Overlay behavior depends on:

  * notification permission
  * draw-over-apps permission

* Development FCM sender utility:

```text
focus-test/fcm-sender/
```

⚠️ Firebase service account files must never be committed to version control.

---

# Known Limitations

* iOS does not support Android-style overlays
* Full attention capture currently Android-only
* UI is still prototype-level and unpolished
* Expo template files still exist in repository
* Root `firebaseConfig.ts` is legacy and should eventually be removed

---

# Planned Next Steps

* AI-generated visual answer options
* Accessibility-focused UI refinement
* Improved visual communication aids
* Better session history and analytics
* Multi-device real-world testing
* Improved onboarding flow
* Stronger overlay customization
* Production-ready backend security rules

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
