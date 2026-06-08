# Communication Support

A React Native + Expo prototype for calm, structured parent-child communication, with realtime sync, visual answer cards, layered visual retrieval, Firebase image storage, AI fallback generation, saved parent templates, browser-friendly parent mode, and Android focus alerts.

---

# Project Purpose

This repository is building a two-device communication experience designed to support communication between parents and autistic children through calm, structured interaction.

The system works through a parent device and a child device:

- Parent creates a short question with visual answer options
- Parent can add images to options using camera or gallery
- Parent can generate visuals using a layered backend visual pipeline
- Parent can save frequently used question/option sets as reusable templates
- Child receives the prompt in realtime
- Child selects one answer visually
- Child can optionally practice saying one of the known answers using guided speech recognition
- Parent receives the selected answer immediately
- Android child devices can trigger focus alerts and overlays to capture attention even while other applications are open

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
- Built-in quick session templates
- Parent-saved custom templates
- Custom template naming
- Duplicate saved template names update the existing template instead of creating duplicates
- Recently used templates appear first
- Parent Mode Create / History / Templates tabs
- Templates tab for built-in and saved template management
- Browser-friendly centered Parent Mode layout for laptop/web use
- Android overlay attention alerts
- Firebase Cloud Messaging integration
- Child-side Guided Speech Practice with Android speech recognition
- Mock transcript fallback for guided speech matching tests
- Persistent device setup using AsyncStorage
- Child attention-alert readiness status
- Native Android attention routing
- Background Firebase messaging support
- Clear session support across Firestore and parent UI state
- Send button guard while images are uploading or visuals are generating
- Global visual retrieval cache using Firestore `visualCache`
- OpenSymbols AAC pictogram retrieval
- Commercial-safe symbol license filtering
- Emoji API fallback for simple/modern concepts
- Runware FLUX KLEIN 4B AI visual fallback
- Firebase Storage upload for AI-generated visuals
- Backend-only API key handling using Firebase Secrets
- Future customer-provided AI API key hook
- SVG visual support on native Android using WebView rendering
- Pilot-safer Firestore security rules
- Pilot-safer Firebase Storage security rules

---

# Current Platform Support

| Feature | Android | iOS | Web / Browser |
|---|---:|---:|---:|
| Parent Mode | Yes | Yes | Yes |
| Child Mode | Yes | Limited | Limited |
| Realtime Communication | Yes | Yes | Yes |
| Guided Speech Practice | Yes | Limited | No |
| Image Picker | Yes | Yes | Yes |
| Firebase Storage Images | Yes | Yes | Yes |
| Saved Templates | Yes | Yes | Yes |
| Overlay Attention Alerts | Yes | No | No |
| Full Attention Capture | Yes | No | No |
| Background Native Alert Routing | Yes | No | No |

---

# Repository Structure

- Active app: `focus-test/`
- Placeholder folders: `backend/`, `docs/`, `mobile-app/`
- Legacy file at root: `firebaseConfig.ts`
- Project-specific development guide: `focus-test/CODEX.md`

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
- Applies built-in quick templates
- Loads and persists saved custom templates
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
- Parent can copy the room code
- Child joins using the parent room code
- Room-code collision prevention
- Firestore uniqueness validation
- Child cannot create a new room by mistyping a code
- Invalid child room codes show a “Room not found” message
- Child setup checks Android overlay permission
- Child setup can open Android “Display over other apps” settings
- Child setup checks microphone permission for Guided Speech Practice
- Child FCM alert-token setup happens after child setup is completed
- Setup is persisted using AsyncStorage

This prevents accidental creation of fake Firestore rooms from child-side typos and makes child attention-alert and speech-practice readiness clearer during setup. Missing overlay, microphone, or alert-token readiness does not block in-app tap-to-answer.

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

Parent Mode is organized into three tabs:

```text
Create
History
Templates
```

### Create Tab

The Create tab is used to build and send a communication session.

Responsibilities:

- View attention-alert readiness status
- View the latest child response
- Enter question/options
- Apply built-in quick templates
- Apply recently used saved templates
- Add or change option images
- Choose image source from camera or gallery
- Upload selected images to Firebase Storage
- Generate visuals through the backend visual pipeline
- Remove unsuitable visuals from options
- Preview the session before sending
- Save the current question/options as a named custom template
- Send session to child
- Clear active session

Current built-in templates:

```text
Food
Feelings
Activities
Yes/No
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

The Send button is disabled while image upload or visual generation is in progress to prevent incomplete sessions from being sent. If sending or clearing a session fails, Parent Mode shows a clear retry message instead of failing silently.

### History Tab

The History tab shows recent child responses separately from the Create screen.

Each history item includes:

```text
Selected answer
Original question
Friendly timestamp
```

Timestamp display uses readable labels for recent responses, such as:

```text
Today, 3:45 pm
Yesterday, 1:20 pm
29th May, 3:45 pm
```

Recent response history is stored in Firestore under:

```text
rooms/{roomId}/history
```

This keeps the parent creation flow shorter and avoids making the main screen too long on mobile.

### Templates Tab

The Templates tab allows the parent to reuse common question/answer sets.

Supported behavior:

- View built-in templates
- View saved custom templates
- Save current question/options as a named template
- Apply saved templates
- Delete saved templates
- Recently used templates move to the top
- Duplicate template names update the existing template instead of creating clutter
- Create tab shows the most recently used saved templates for quick access
- “View all” opens the full Templates tab

Saved templates are currently stored locally using AsyncStorage. In a future production version, templates may be synced to authenticated parent accounts.

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
- Allow optional guided speech practice using the known answer labels
- Show a clear selected-state checkmark
- Submit selected answer
- Show a clear retry message if answer submission fails
- Show confirmation state

Child option card behavior:

```text
If option.imageUrl works → show image
If option.imageUrl fails → show emoji fallback
If no imageUrl exists → show emoji fallback if available
If no visual exists → show text-only option card
```

### Guided Speech Practice

Child Mode includes an optional Guided Speech Practice section during the choice stage.

The feature is designed as a support aid, not a separate answer-submission path:

```text
Child starts speaking
-> App shows live recognized transcript
-> Transcript is matched against known answer options
-> Matching option is selected
-> Child still presses Send Answer manually
```

Speech practice behavior:

- Uses `expo-speech-recognition`
- Requests microphone/speech permission when the child taps Start speaking
- Shows live recognized words when available
- Reuses the same option-matching logic as the mock transcript input
- Normalizes lowercase, punctuation, extra spaces, and simple singular/plural cases
- Prefers exact matches
- Allows contains matching only when one option clearly matches
- Does not auto-submit answers
- Keeps visual tap-to-answer fully usable
- Stops listening when leaving the choice stage or when a new session arrives
- Resets speech state for new incoming sessions
- Keeps manually tapped answers selected if unclear speech/noise is heard
- Shows a calm fallback message if microphone or speech recognition fails:

```text
Microphone is off. You can still tap an answer.
```

The mock transcript input currently remains visible as a development/testing fallback. It is useful for verifying the matching logic without speaking, but should likely be hidden or clearly marked before a polished stakeholder demo.

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
- Compact parent option rows
- Compact parent preview cards
- Large child-facing cards
- Selected option checkmark
- Create / History / Templates tab styles
- Saved template UI styles
- Guided Speech Practice UI styles
- Calm visual styling
- Shared screen layout styles

---

## 7. Visual Retrieval and AI Fallback Pipeline

The app uses a layered visual retrieval pipeline for option card visuals.

Current pipeline:

```text
Cache
→ OpenSymbols
→ Emoji API
→ Runware AI fallback
→ Mock fallback
```

The design is retrieval-first. AI generation is only used when cached visuals, OpenSymbols, and Emoji API do not provide a suitable result.

The backend validates visual generation requests before calling external services:

- `optionLabels` must be an array
- At least one non-empty option label is required
- Up to 4 option labels are processed
- Each option label must be 60 characters or shorter

### Global Visual Cache

Visual cache is stored in Firestore using:

```text
visualCache
```

Each cache entry may store:

- label
- imageUrl
- emoji
- source
- provider
- license
- licenseUrl
- author
- creation time
- last used time
- use count

This allows retrieved or generated visuals to be reused globally instead of being fetched or generated repeatedly.

### OpenSymbols Layer

OpenSymbols is used as the primary AAC-style pictogram source.

The backend filters symbol results to only allow commercially safer licenses such as:

- CC0
- CC BY
- CC BY-SA

Non-commercial or no-derivatives licenses are blocked.

OpenSymbols search is phrase-aware for short routines and avoids accepting weak connector/preposition words as the main visual concept. For example, labels such as `after bed` and `before bed` try the full phrase first, then meaningful candidates such as `bed` or `bedtime`; weak standalone matches like `after` or `before` are skipped so the pipeline can continue to Emoji API, Runware, or mock fallback instead of caching a poor symbol.

### Emoji API Layer

If OpenSymbols does not return a suitable visual, the app falls back to the Emoji API.

This layer is useful for simple concepts, common objects, emotions, apps, and device-related terms.

### Runware AI Fallback Layer

If both OpenSymbols and the Emoji API do not return a suitable visual, the backend calls Runware using `FLUX KLEIN 4B`.

Runware is used only from Firebase Cloud Functions. The API key is stored as a Firebase Secret and is never exposed to frontend code.

Runware calls are protected with a request timeout so a slow image-generation response does not hang the whole visual pipeline indefinitely.

Generated images are:

```text
Generated by Runware
→ downloaded by the backend
→ uploaded to Firebase Storage
→ saved into visualCache
→ reused in future sessions
```

This means each AI-generated visual only needs to be generated once, reducing long-term cost.

The backend also includes a placeholder hook for future customer-provided Runware/API keys. For now, this hook returns nothing and the system falls back to the company Firebase Secret key.

### Mock Fallback

If all previous layers fail, the system uses a default mock image fallback so the app can still return a usable visual response.

Mock fallback visuals are treated as a safety net and should not be considered the main visual source.

Mock fallback visuals are not permanently cached in `visualCache`, so temporary third-party failures do not poison future visual results.

---

## 8. Saved Templates

Saved templates allow parents to reuse common communication sessions.

Current behavior:

```text
Parent creates question/options
→ Parent taps Save template
→ Parent enters a template name
→ Template is saved locally
→ Template appears in Templates tab
→ Parent can reuse or delete it later
```

Saved templates are stored using AsyncStorage.

Template behavior:

- Custom template names are supported
- Duplicate names update the existing template
- Recently used templates move to the top
- Create tab shows the most recently used saved templates
- Templates tab shows the full saved template list
- Saved templates can be deleted from the Templates tab

This feature is intended to support repeated real-world routines such as:

```text
Dinner choices
Morning routine
Going out options
Calm-down choices
Feeling check-in
```

Future production work may sync saved templates to parent accounts once authentication is added.

---

## 9. Native Android Focus Alert Module

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

## 10. Overlay Attention System

The Android implementation supports:

- Overlay alerts over external applications
- Wake/attention behavior
- Background Firebase message handling
- Native Android lock-state detection
- Deep link routing into the child alert flow

Validated against:

- YouTube
- Browser
- Android settings
- External applications

Architecture rule:

```text
FCM / native Android = attention capture
Firestore = session state synchronization
```

This avoids duplicate overlay triggers.

Current main attention path:

```text
Child device unlocked
→ Child is using another app
→ Parent sends session
→ Android receives FCM data message
→ Native overlay appears
→ Child taps Open message
→ Child answers in app
```

Locked-device notification routing is not fully implemented yet and is lower priority because the primary use case is when the child is actively using the phone.

---

# Tech Stack

- Expo SDK 54
- React Native 0.81
- React 19
- TypeScript
- Expo Router
- Expo Image Picker
- Expo Clipboard
- Expo Speech Recognition
- React Native WebView
- Firebase Firestore
- Firebase Storage
- Firebase Cloud Functions
- Firebase Cloud Messaging
- Firebase Secret Manager
- Kotlin
- Android SDK
- Expo Native Modules API
- AsyncStorage
- OpenSymbols API
- Emoji API
- Runware AI API

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

## Firebase Cloud Function Secrets

The backend visual pipeline uses Firebase secrets for third-party API keys.

Required secrets:

```text
OPENSYMBOLS_SHARED_SECRET
EMOJI_API_KEY
RUNWARE_API_KEY
```

Set secrets using:

```bash
firebase functions:secrets:set OPENSYMBOLS_SHARED_SECRET
firebase functions:secrets:set EMOJI_API_KEY
firebase functions:secrets:set RUNWARE_API_KEY
```

Deploy the visual generation function only using:

```bash
firebase deploy --only functions:generateOptionVisuals
```

The Runware API key is backend-only and should never be stored in frontend code or committed to Git.

---

# Firebase Security Rules

The project includes pilot-safer Firestore and Storage rules.

Local rule files:

```text
focus-test/firebase.rules
focus-test/storage.rules
```

Configured in:

```text
focus-test/firebase.json
```

Note: `firebase.json` should point to the intended Firestore rules file before deploying rules. The current checked-in Firestore rules file is `firebase.rules`.

Current Firestore rule direction:

- Rooms remain accessible by valid room-code format for prototype/pilot use
- Room history follows room access
- `visualCache` is readable by clients
- Client writes to `visualCache` are blocked
- Unknown collections are denied by default

Current Storage rule direction:

- Parent-uploaded option images are limited to image file uploads
- Client update/delete access is blocked for uploaded option images
- AI-generated visuals are readable by clients
- Client writes to `generated_visuals` are blocked
- Unknown Storage paths are denied by default

These rules are safer than fully open development rules, but they are not final production rules. A production version should use Firebase Auth, parent/child ownership, and room membership checks.

Deploy rules with:

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

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
7. Parent selects a quick template, saved template, or enters custom options
8. Parent can add images manually or generate visuals through the backend visual pipeline
9. Parent previews the session
10. Parent sends the session
11. Child receives overlay/attention alert
12. Child sees the same visual cards as the parent
13. Child either taps an option or uses Guided Speech Practice to select one
14. Child presses Send Answer manually
15. Parent receives the answer in realtime
16. Parent checks the History tab
17. Parent clears the session

---

# Current Demo Flow

Suggested demo flow:

```text
1. Show parent setup and generated room code
2. Show child joining the same room
3. Demonstrate invalid child room code rejection
4. Apply Food template
5. Add image using camera/gallery
6. Generate visuals through the visual pipeline
7. Preview parent session
8. Save the session as a custom template
9. Send session
10. Show Android overlay/attention capture
11. Show child visual option cards
12. Demonstrate Guided Speech Practice selecting an answer, or tap a visual card as fallback
13. Press Send Answer manually on the child screen
14. Show parent receiving response
15. Show History tab
16. Show Templates tab
17. Clear session
```

---

# Cross-Platform Demo Flow

The current demo can be tested using a browser or iPhone as the parent device and an Android emulator as the child device.

This setup is useful because the parent side does not depend on Android-only attention-capture features. The Android-specific behavior is mainly needed on the child side for overlays and focus alerts.

## Recommended Demo Setup

- Parent device: iPhone Safari or desktop browser
- Child device: Android emulator
- Backend: Firebase Firestore, Firebase Cloud Messaging, Firebase Storage

## Running the Android Child App

Run the Android app from the project folder:

```bash
cd D:\communication_support\focus-test
npx expo run:android
```

Set up the Android app as the child device and enter the room code created by the parent.

## Running the Web Parent App

Expo web development mode has had Metro/HMR issues in this project, so the web parent is tested using a production-style export.

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

## Demo Flow

1. Open the parent web app on iPhone Safari or desktop browser.
2. Create or enter a parent room.
3. Open the Android emulator app as the child.
4. Enter the same room code on the child device.
5. Parent selects a quick template, saved template, or types a question.
6. Parent adds images manually or uses Generate visuals.
7. Parent sends the session.
8. Android child receives the visual cards and overlay attention alert.
9. Child selects an option and sends the answer.
10. Parent receives the child’s response in realtime.
11. Parent checks the History tab.
12. Parent clears the session and the room returns to idle.

## Current Cross-Platform Behavior

| Feature | Web Parent | Android Child |
|---|---:|---:|
| Room creation | Yes | Not needed |
| Room joining | Yes | Yes |
| Quick templates | Yes | Not needed |
| Saved templates | Yes | Not needed |
| Manual image selection | Yes | Not needed |
| Generate visuals | Yes | Not needed |
| Send session | Yes | Not needed |
| Receive visual cards | Not needed | Yes |
| Guided speech practice | Not needed | Yes |
| Select answer | Not needed | Yes |
| Realtime parent response | Yes | Not needed |
| Android attention overlay | Not applicable | Yes |

## Notes

- The parent flow works through the browser, including on iPhone Safari.
- Parent Mode uses a centered layout on browser/laptop so the UI does not stretch across the full screen.
- The child flow is currently Android-first because attention capture depends on Android native behavior.
- Firebase Firestore is used for realtime session state.
- Firebase Storage is used for uploaded option images and generated AI visuals.
- Firebase Cloud Messaging and the native Android module handle child-side attention capture.
- The Generate visuals feature uses a backend visual pipeline: OpenSymbols, Emoji API, Runware AI fallback, and mock fallback.
- Guided Speech Practice uses native Android speech recognition through `expo-speech-recognition`; it requires a native Android build, not Expo Go.

---

# Android Alert / FCM Notes

- App scheme:

```text
focustest
```

- Overlay behavior depends on:

  - draw-over-apps permission
  - app setup as child device
  - child FCM token being available

- Guided Speech Practice depends on:

  - microphone permission
  - Android speech recognition service availability
  - a native Android build

- Notification permission does not affect the main unlocked overlay route.
- Locked-device notification route is not fully implemented yet.

Development FCM sender utility:

```text
focus-test/fcm-sender/
```

Firebase service account files must never be committed to version control.

---

# Known Limitations

- iOS does not support Android-style overlays
- Full attention capture is currently Android-only
- iOS child flow would need a different attention strategy
- Locked-device notification route is not fully implemented; the main working attention path is unlocked-device overlay behavior
- AI fallback quality depends on prompt quality and model output consistency
- AI visuals are weaker for abstract concepts compared with concrete objects
- Some OpenSymbols results are SVG files, which require special native rendering support
- Guided Speech Practice currently remains a prototype feature
- Guided Speech Practice depends on Android speech recognition service availability and may vary by device/noise level
- Mock transcript input is still visible for development fallback and should be hidden or relabeled before a polished demo
- Current customer-provided API key support is only architecturally prepared, not exposed in the UI
- Current access model still relies mainly on room-code access
- Firestore and Storage rules are pilot-safer, but not fully production-authenticated
- Firebase Auth, parent/child accounts, and room ownership are not implemented yet
- Saved templates are currently stored locally using AsyncStorage and are not synced across devices
- Expo template files still exist in repository
- Root `firebaseConfig.ts` is legacy and should eventually be removed
- More real-device testing is needed beyond emulator testing

---

# Planned Next Steps

- Test the child flow on a real Android device
- Continue refining Guided Speech Practice UI and real-device behavior
- Continue improving Parent Mode mobile and browser layouts
- Add parent/child authentication and account support
- Design production parent-child room ownership model
- Sync saved templates to parent accounts in the future
- Improve visual consistency across OpenSymbols, emoji, and AI-generated images
- Add UI/admin support for customer-provided AI API keys
- Explore text simplification before AI image generation for abstract concepts
- Explore opt-in community visual library for reusable non-private visuals
- Improve onboarding flow for production use
- Add monitoring, cost controls, and AI generation usage tracking
- Prepare production-ready Firestore and Storage security rules with auth
- Perform multi-device real-world testing

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
