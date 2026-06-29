# Focus-Test MVP v1

## Summary

Focus-Test is a structured parent-child communication MVP. A parent uses the hosted web app to send a simple question with known answer options, and a child uses the installed Android app to receive the message, open it from an attention overlay, and answer through visual choices or selected-option Guided Speech Practice.

This release is intended for controlled pilot/demo use.

## Main Validated Flows

- Parent sends a structured message from the hosted web app.
- Android child receives a native overlay alert.
- Child opens the message from the overlay directly into the active question screen when child setup is complete.
- If the child leaves an opened unanswered question, the app can send a data-only native overlay reminder to return.
- Child answers by tapping a visual option.
- Child answers using Guided Speech Practice for the selected option.
- Parent receives the child answer in realtime.

## Parent Features

- Parent Mode with Create, History, and Templates tabs.
- Saved templates that can be created, edited, used, and deleted.
- Optional speech sentence patterns, such as `I want {option}`, `I feel {option}`, or `{option}`.
- Template cards show their saved speech pattern.
- History items that can be reused or saved as templates.
- New history items can show the speech practice phrase when speech-pattern data is available.
- Visual answer options with generated visuals, manual uploads, remove visual, emoji fallback, and text fallback.
- Visual generation review messaging so parents know generated visuals are suggestions.

## Child Features

- Child device setup checklist.
- Overlay permission guidance for attention alerts.
- Microphone permission guidance for speech matching.
- Background activity/app settings shortcut for Android battery reliability.
- Tap-to-answer visual option flow.
- Compact child choice screen for Android phone testing.
- Exit-before-answer tracking and reminder overlay for opened unanswered questions.
- Guided Speech Practice after the child taps an option.
- Generated practice phrases from the parent speech pattern, with fallback to `I want {option}`.
- Ordered word progress with high-contrast word chips and a clear feedback card.
- Speech listening automatically restarts through short pauses during active practice.
- Spoken mismatches restart the full sentence from the first word with calm feedback.
- Hidden Tester transcript input revealed by tapping the `Say this: ...` phrase five times.
- Speech and tester transcript validation never auto-submit; Send Answer remains manual.

## Android Validation

The hosted parent web app and installed Android child APK were tested together on a physical OnePlus Android device.

Validated states:

- Child app open.
- Child phone on home screen.
- Another app open.
- Lock/unlock.
- 2-minute lock.
- 5-minute lock.

Required Android settings for reliable alert behavior:

- Display over other apps enabled.
- Notifications enabled.
- Microphone permission enabled.
- Background/battery usage unrestricted or allowed.
- Child app not force-closed before testing.

## Known Limitation

Android/OEM long-idle FCM delivery can vary by device battery and background restrictions. On the tested OnePlus device, alerts worked after the required permissions and background settings were enabled.

The current alert and exit-reminder paths keep data-only FCM because adding a notification payload broke the native overlay delivery path. Future hardening may revisit notification fallback behavior without weakening the overlay flow.

## Debugging

Native Android logs use this tag:

```text
FocusAlertDebug
```

Useful command:

```bash
adb logcat -s FocusAlertDebug
```

## APK

Current child APK path:

```text
focus-test/release-builds/focus-test-child-v1.apk
```
