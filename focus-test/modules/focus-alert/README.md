# focus-alert

Local Expo native module used by Focus-Test for Android attention alerts.

This module is consumed from the app through:

```json
"focus-alert": "file:modules/focus-alert"
```

Do not run `npm install` inside this module folder. Install dependencies from `focus-test/` only. A nested `node_modules` here can introduce duplicate React Native/native module versions and cause confusing Android runtime or reload failures.

## Android Behavior

The module supports the current Android child attention path:

```text
FCM data message
-> FocusFirebaseMessagingService
-> FocusAlertManager
-> unlocked-device overlay
-> deep link back into the child app
```

The reliable demo path is active/unlocked Android overlay behavior. Locked-device notification routing exists as an experimental path and is not production-ready.

## JS Bridge Methods

The app currently uses these methods:

```text
getFcmToken()
canDrawOverlays()
requestOverlayPermission()
triggerFocusAlert()
showTestNotification()
showOverlayAlert()
```

## Files

- `android/src/main/java/expo/modules/focusalert/FocusAlertModule.kt`: JS bridge methods
- `android/src/main/java/expo/modules/focusalert/FocusAlertManager.kt`: overlay routing and duplicate-overlay guard
- `android/src/main/java/expo/modules/focusalert/FocusFirebaseMessagingService.kt`: receives FCM messages

## Testing Notes

- Overlay behavior requires Android `Display over other apps` permission.
- FCM alert behavior requires a real child FCM token.
- Expo Go is not enough for this module; use a native Android build.
