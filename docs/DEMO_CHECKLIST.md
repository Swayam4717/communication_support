# Focus-Test Demo Checklist

Use this checklist when presenting or testing the Focus-Test MVP with the hosted parent web app and installed Android child APK.

## Pre-Demo Setup

- Confirm the parent web app URL is available.
- Confirm the Android child APK is installed on the test phone.
- Open the child app once before the demo.
- Create or reuse a parent room.
- Join the same room from the child device.
- Keep the child phone available for overlay and speech testing.

## Required Android Permissions/Settings

- Display over other apps enabled.
- Notifications enabled.
- Microphone permission enabled.
- Background/battery usage unrestricted or allowed.
- Do not force-close the child app before testing.

For background activity setup:

1. In the child setup checklist, tap Open app settings.
2. On Android/OnePlus, go to Battery usage.
3. Set Focus-Test to Unrestricted battery usage or Allow background activity.
4. Return to Focus-Test.
5. Tap I've enabled this if it is not `ready` already.

This helps reduce delayed parent alerts after long idle, but Android/OEM idle behavior can still vary by device.

The app cannot fully verify every OnePlus/OEM background setting automatically. Use I've enabled this after manually checking the Battery usage setting.

## Main Parent-To-Child Overlay Flow

1. Open the hosted parent web app.
2. Select Parent Device.
3. Create or enter the parent room.
4. Open the installed Android child app.
5. Select Child Device and join the same room.
6. From Parent Mode, create a question with answer options.
7. Send the question to the child.
8. Confirm the native Android overlay appears on the child phone.
9. Tap Open message on the overlay.
10. Confirm the child choice screen opens.

## Child Tap-To-Answer Flow

1. On the child phone, tap one answer option.
2. Confirm the selected option is visibly highlighted.
3. Tap Send Answer.
4. Confirm the child sees the answer-sent state.

## Guided Speech Practice Flow

1. Send a question with clear answer options.
2. On the child phone, use Try saying your answer.
3. Tap Start speaking.
4. Say one of the visible choices.
5. Confirm speech selects the matching option.
6. Tap Send Answer manually.

Speech selects an option but does not auto-submit.

## Parent Realtime Response Confirmation

- Confirm the parent web app updates with the child answer.
- Confirm the History tab shows the answered session.
- Optional: use Use again from History to reload the question/options.
- Optional: use Save as template from History to keep the question/options.

## Known Limitation

Android overlay reliability can vary by device/OEM battery settings. On the tested OnePlus device, alerts worked after required permissions and battery/background settings were enabled.

After extended screen-off idle time, Android/OxygenOS may delay FCM data-message delivery. During this delay, no native alert logs appear because the app has not received the FCM message yet. When delivery occurs, the native overlay appears correctly. Future hardening may add a system notification fallback for long-idle/OEM-restricted states.

## Native Debugging

Native Android debug logs use the tag:

```text
FocusAlertDebug
```

Useful command:

```bash
adb logcat -s FocusAlertDebug
```
