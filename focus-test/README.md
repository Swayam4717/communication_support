# Focus-Test

Focus-Test is the active Expo React Native app for the Communication Support prototype. The full project overview, architecture notes, Firebase setup, testing flow, and current limitations live in the root repository README:

```text
../README.md
```

This app uses Firebase, a local Android native module, and `expo-speech-recognition`, so Expo Go is not enough for the full child-side attention-alert and speech-practice flow. Use a native Android build for those features.

Do not run `npm install` inside `modules/focus-alert`. Install dependencies from this folder only.

## Get Started

1. Install dependencies from this folder:

   ```bash
   npm install
   ```

2. Start Metro:

   ```bash
   npm run start
   ```

3. Build/run Android for native overlay, FCM, and speech recognition behavior:

   ```bash
   npm run android
   ```

## Firebase Setup

Create `.env` in this folder with the Expo public Firebase values:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...
```

Restart Expo after changing environment variables.

## Notes

- Parent Mode can run on web/browser for demos.
- Child attention alerts and Guided Speech Practice are Android-first.
- Hosted parent web + installed Android APK were physically validated on a OnePlus Android device with overlay, notifications, microphone, and battery/background usage allowed.
- Native Android alert logs use `FocusAlertDebug`; run `adb logcat -s FocusAlertDebug` while testing FCM/overlay delivery.
- After extended screen-off idle time, Android/OxygenOS may delay FCM data-message delivery. When delivery reaches the phone, the native overlay appears correctly.
- Saved templates are local-only through AsyncStorage.
- Uploaded option images should not include sensitive personal photos during pilot testing because current pilot Storage rules allow readable image URLs.
