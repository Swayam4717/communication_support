# Focus-Test Communication Support

Focus-Test is an Expo React Native + Firebase MVP for structured parent-child communication. It is built for a controlled pilot/demo where a parent uses a hosted web app to send simple visual communication sessions, and a child uses an installed Android app to answer through visual choices or guided speech practice.

The current validated attention path is the native Android overlay. Android/OEM battery behavior can still affect long-idle FCM delivery timing, so locked-device notification fallback remains future hardening.

---

# Current Status

- Parent web side is deployed through Firebase Hosting and has been tested successfully from the hosted URL.
- Child Android side has been built as a standalone release APK.
- The standalone APK opens without Metro, Expo dev server, or localhost.
- Hosted parent web app and installed Android child APK have been tested together successfully.
- The physical OnePlus Android boss/demo flow passed with required permissions and battery/background settings enabled.
- End-to-end flow has been verified:
  - parent creates or uses a room,
  - child joins the room,
  - child setup readiness checklist appears,
  - child grants/checks overlay and microphone permissions,
  - parent sends a session,
  - Android attention overlay appears on an active/unlocked child device,
  - child opens the message,
  - child answers by tapping an option or using Guided Speech Practice,
  - child manually presses Send Answer,
  - parent receives the answer in realtime,
  - history updates.

This is still an MVP/prototype for controlled pilot use, not a production-ready deployment.

Tester-facing install and run instructions are in:


[Tester Install Guide](docs/tester-install-guide.md)


---

# Physical Device Validation

The hosted parent web app and installed Android child APK were validated together on a physical OnePlus Android device. The boss/demo flow passed with the required Android permissions and background settings enabled.

Validated physical-device flows:

- Parent sends message while child app is open.
- Parent sends message while child phone is on the home screen.
- Parent sends message while another app is open.
- Parent sends message after lock/unlock.
- Parent sends message after a 2-minute lock.
- Parent sends message after a 5-minute lock.
- Child opens message from the overlay.
- Child replies by tapping an answer.
- Child replies using Guided Speech Practice.
- Parent receives child responses in realtime.

# Demo Flow

The tested demo path is:

1. Parent opens the hosted web app.
2. Child opens the installed Android APK and joins the room.
3. Parent sends a session from the web app.
4. Android child receives the native overlay alert.
5. Child opens the message from the overlay.
6. Child answers by tapping an option or using Guided Speech Practice.
7. Child manually presses Send Answer.
8. Parent receives the response in realtime.

# Required Android/OnePlus Settings

Required phone settings for successful Android alert behavior:

- Display over other apps enabled.
- Notifications enabled.
- Microphone permission enabled.
- Background/battery usage unrestricted or allowed.
- Do not force-close the child app before testing.

In child setup, use the `Open app settings` button for the background activity checklist item. On Android/OnePlus, this opens the Focus-Test App Info/App Management page. Go to Battery usage, set Focus-Test to Unrestricted battery usage or Allow background activity, return to Focus-Test, then tap `I've enabled this`. This helps reduce delayed parent alerts after long idle, although Android/OEM idle behavior can still vary by device.

The app does not claim to automatically verify every OEM-specific background setting. The checklist item combines Android's available battery optimization signal with a manual parent/tester acknowledgement because each Android manufacturer exposes these controls differently.

# Debugging Native Alerts

Native Android debug logs are available under the tag `FocusAlertDebug`. These logs trace FCM receipt, message type, room ID, lock state, overlay permission, overlay display, and deep-link launch.

Useful command:

```bash
adb logcat -s FocusAlertDebug
```

# Known Limitation: Long-Idle Android/FCM Delivery Delay

Android overlay reliability can vary by device/OEM battery settings. On the tested OnePlus device, alerts worked after required permissions and battery/background settings were enabled. After extended screen-off idle time, Android/OxygenOS may delay FCM data-message delivery. During that delay, no `FocusAlertDebug` logs appear because the app has not received the FCM message yet. When delivery occurs, the native overlay appears correctly. Future hardening may add a system notification fallback for long-idle/OEM-restricted states.


---

# Core Features

## Parent Features

- Parent-child room pairing with human-readable room codes.
- Parent Mode with Create, History, and Templates tabs.
- Session creation with a question and answer options.
- Optional speech sentence pattern for child practice, such as `I want {option}`, `I feel {option}`, or `{option}`.
- Visual answer options with generated visuals, uploaded images, emoji fallback, and text fallback.
- Manual image upload from camera/gallery.
- Remove visual option when a generated/uploaded visual is unsuitable.
- Visual generation gives clearer loading, fallback, and error feedback during testing.
- Parent alert readiness wording that refers to attention-alert readiness, not whether in-app answering works.
- Visible feedback when sending or clearing/resetting a session fails.
- Recent history with friendly timestamps, answer status, and clearer repeated-test actions.
- Recent history can show the speech practice phrase for answered sessions when the session saved a speech pattern.
- History items can be loaded back into Create with Use again.
- History items can be saved as local custom templates when their options are available.

## Saved Templates

- Saved parent templates.
- Create, edit, use, and delete saved templates.
- Template cards show their speech pattern, and templates can save an optional speech sentence pattern.
- Duplicate template-name handling.
- Recently used template behavior.
- Saved templates are local-only through AsyncStorage on the parent browser/device. They are not room-specific, so custom templates can remain visible after creating a new room on the same device.

## Child Features

- Child Mode tap-to-answer flow.
- Visual option cards with image, emoji, or text fallback.
- Child manually presses Send Answer.
- Visible feedback if child answer submission fails.
- Confirmation state after answer submission.

## Visual Generation

The backend visual pipeline uses:

```text
Firestore visualCache
-> OpenSymbols
-> Emoji API
-> Runware AI
-> fallback behavior
```

OpenSymbols search avoids weak connector/preposition matches for multi-word labels such as `after bed` and `before bed`, so weak words like `after` or `before` are not accepted as the main visual concept.

If the pipeline uses a simpler fallback visual, the parent UI treats it as usable but reviewable. Parents can keep the fallback, remove it, or upload their own image before sending.

API keys stay in Firebase backend secrets, not frontend code.

## Guided Speech Practice

- Implemented in Child Mode using `expo-speech-recognition`.
- Real Android speech recognition has been verified.
- The child taps an option first, then practises the generated speech phrase for that selected option.
- Speech phrases are generated from the parent speech pattern, such as `I want {option}` or `I feel {option}`. If no pattern exists, the app falls back to `I want {option}`.
- Simple option labels such as `Rice` become phrases like `I want rice`; complete phrases such as `I need help`, `Stop`, `Yes`, and `No` are used as-is.
- Speech recognition validates the selected option's practice phrase only. It no longer chooses between all options.
- The app tracks phrase progress in order, word by word. Later words are not accepted until earlier words are completed.
- A prominent feedback card shows calm next-step guidance such as `Try again / Say: want`, `Good / Now say: rice`, or `Good / Ready to send`.
- Child still manually presses Send Answer.
- Word-level feedback highlights completed, current, and pending words so the child/tester can see what to say next.
- A hidden `Tester transcript` input can be revealed by tapping the `Say this: ...` practice phrase five times. It uses the same ordered practice logic as microphone speech and is for quiet testing only.
- Speech or typed testing never changes the selected option and never auto-submits.

## Setup And Readiness

- Child setup checks/communicates overlay permission readiness.
- Child setup checks/communicates microphone permission readiness.
- Child setup/child room state communicates alert/FCM readiness.
- Missing overlay, microphone, or alert readiness does not block in-app tap-to-answer.
- Parent setup remains mostly focused on room creation/joining.

---

# Tech Stack

- Expo SDK 54
- React Native
- TypeScript
- Expo Router
- Firebase Firestore
- Firebase Storage
- Firebase Cloud Functions
- Firebase Hosting
- Firebase Cloud Messaging
- Kotlin native Android module
- `expo-speech-recognition`
- AsyncStorage
- OpenSymbols API
- Emoji API
- Runware AI

---

# Project Structure

Important files and folders:

```text
focus-test/app/CommunicationMvp.tsx
focus-test/app/DeviceSetup.tsx
focus-test/app/ParentMode.tsx
focus-test/app/ChildMode.tsx
focus-test/app/communicationHelpers.ts
focus-test/app/communicationCommon.tsx
focus-test/app/communicationUI.tsx
focus-test/functions/index.js
focus-test/firestore.rules
focus-test/storage.rules
focus-test/firebase.json
focus-test/modules/focus-alert/
```

Key responsibilities:

- `CommunicationMvp.tsx`: app shell, persisted setup, parent/child routing, saved templates.
- `DeviceSetup.tsx`: parent/child setup, room checks, child readiness checks.
- `ParentMode.tsx`: Create/History/Templates tabs, visual generation/upload, send/reset.
- `ChildMode.tsx`: child session state, tap-to-answer, Guided Speech Practice.
- `communicationHelpers.ts`: Firebase app, Firestore, Storage, session/history helpers.
- `communicationCommon.tsx`: shared styles.
- `communicationUI.tsx`: shared UI components.
- `functions/index.js`: FCM alert function and visual-generation pipeline.
- `modules/focus-alert/`: local Android native module for attention alerts.

---

# Local Development

From the app folder:

```bash
cd focus-test
npm install
npm run start
```

Run Android with a native build:

```bash
npx expo run:android
```

Expo Go is not enough for Android attention overlay, FCM alert routing, or native speech recognition. Use native/dev/release Android builds for child testing.

Do not run `npm install` inside `modules/focus-alert`. Install dependencies only from `focus-test/`.

---

# Parent Web Deployment

Firebase Hosting is used for the parent web app. `focus-test/firebase.json` is configured to serve `dist/` and rewrite routes to `/index.html` for the Expo Router single-page app.

Export the web app:

```bash
cd focus-test
npx expo export --platform web --clear
```

Preview locally if needed:

```bash
npx serve dist -l 3000
```

Deploy to Firebase Hosting:

```bash
firebase deploy --only hosting
```

Optional preview channel:

```bash
firebase hosting:channel:deploy internship-demo --expires 30d
```

Firebase Hosting public directory:

```text
dist/
```

Expected hosting config:

```json
"hosting": {
  "public": "dist",
  "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
  "rewrites": [{ "source": "**", "destination": "/index.html" }]
}
```

---

# Android APK Build

Build a standalone release APK on Windows PowerShell:

```powershell
cd D:\communication_support\focus-test
cd android
.\gradlew assembleRelease
```

Output:

```text
android/app/build/outputs/apk/release/app-release.apk
```

Install from the project root:

```powershell
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

If replacing an older/debug build fails, uninstall first:

```powershell
adb uninstall com.anonymous.focustest
adb install android/app/build/outputs/apk/release/app-release.apk
```

The APK should open without Metro, Expo dev server, or localhost.

---

# Firebase Deploy Commands

Deploy Cloud Functions:

```bash
firebase deploy --only functions
```

Deploy Firestore rules:

```bash
firebase deploy --only firestore:rules
```

Deploy Storage rules:

```bash
firebase deploy --only storage
```

Deploy Hosting:

```bash
firebase deploy --only hosting
```

Rules files:

```text
focus-test/firestore.rules
focus-test/storage.rules
```

Backend visual-generation secrets are managed through Firebase Secrets/environment:

```text
OPENSYMBOLS_SHARED_SECRET
EMOJI_API_KEY
RUNWARE_API_KEY
```

Frontend Firebase web config is read from `focus-test/.env` through `EXPO_PUBLIC_FIREBASE_*` variables.

---

# End-To-End Test Flow

For a shorter tester-facing version of this flow, use `docs/tester-install-guide.md`.

Use this checklist for the deployed parent + installed Android child flow:

1. Open the hosted parent URL.
2. Create or use a parent room.
3. Install/open the standalone Android child APK.
4. Join the same room on the child device.
5. Check the child setup readiness checklist.
6. Enable/check overlay permission.
7. Enable/check microphone permission.
8. Use `Open app settings` for the background activity checklist item.
9. On Android/OnePlus, go to Battery usage and set Focus-Test to Unrestricted battery usage or Allow background activity.
10. Return to Focus-Test and tap `I've enabled this`.
11. Parent sends a session.
12. Confirm the Android overlay appears on the active/unlocked child device.
13. Child opens the message.
14. Child taps an answer.
15. Child manually presses Send Answer.
16. Parent receives the answer in realtime.
17. Parent sends a second session.
18. Optional: choose or edit the parent speech sentence pattern before sending, such as `I want {option}`.
19. Child taps an answer and uses Guided Speech Practice.
20. Confirm the `Say this: ...` phrase appears for the selected option.
21. Confirm word progress and the feedback card update as the child speaks each word.
22. Confirm the app asks calmly for the current word again if a word is missed.
23. Optional: tap the `Say this: ...` phrase five times to reveal `Tester transcript` and test the same practice flow silently.
24. Child manually presses Send Answer.
25. Parent receives the answer in realtime.
26. Confirm History updates.
27. In History, use `Use again` to load a previous question/options into Create.
28. In History, use `Save as template` to save a previous question/options for the Templates tab.

---

# Known Limitations

- Android overlay reliability can vary by device/OEM battery settings. On the tested OnePlus device, alerts worked after required permissions and battery/background settings were enabled. After extended screen-off idle time, Android/OxygenOS may delay FCM data-message delivery. When delivery occurs, the native overlay appears correctly. Future hardening may add a system notification fallback for long-idle/OEM-restricted states.
- Locked-device notification behavior is future work and not production-ready.
- Saved templates are local-only through AsyncStorage and are shared across rooms on the same parent browser/device.
- Uploaded option images should avoid sensitive personal photos because pilot Storage rules allow readable image URLs.
- Production auth, room ownership, and account-based template sync are future work.
- iOS child attention-capture support is not implemented.
- Expo Go is not sufficient for child-side testing because the app uses native Android modules and native speech recognition.
- Speech recognition and word-level practice depend on Android speech service availability, parent speech-pattern wording, and real-world noise conditions.
- This is a controlled-pilot MVP, not a production security model.

---

# Developer Notes / Do Not Do

- Do not run `npm install` inside `modules/focus-alert`.
- Do not commit generated files such as:
  - `dist/`
  - `.firebase/`
  - `.apk`
  - `.aab`
  - `release-builds/`
  - `node_modules/`
- Do not commit Firebase service account files, secrets, or API keys.
- Do not expose Firebase/API secrets in frontend code.
- Do not expose the hidden tester transcript as a normal child-facing control; it is revealed only by tapping the practice phrase five times.
- Do not casually modify `ChildMode.tsx` speech state/reset logic; it has been stabilized after real-device testing.
- Keep speech phrase generation and text helpers in `communicationHelpers.ts` pure and testable where possible.
- Preserve the rule that speech/typed practice validates the selected option phrase and must not change the selected answer.
- Do not overclaim production readiness in demos or documentation. Use wording such as MVP, prototype, controlled pilot, and current reliable path.
