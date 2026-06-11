# Focus-Test Tester Install Guide

## Parent Web

1. Open the hosted parent web URL.
2. Select Parent Device.
3. Create a room.
4. Share the room code with the child device.
5. Use the History tab after answered sessions to reuse previous questions or save them as templates.

## Child Android App

1. Install `focus-test-child-v1.apk` on an Android phone.
2. Open Focus-Test.
3. Select Child Device.
4. Enter the parent room code.
5. Enable overlay permission.
6. Enable microphone permission.
7. Confirm notifications are enabled.
8. In the child setup checklist, tap Open app settings for background activity.
9. On Android/OnePlus, go to Battery usage.
10. Set Focus-Test to Unrestricted battery usage or Allow background activity.
11. Return to Focus-Test and tap I've enabled this.
12. Continue to Child Mode.

## Test Flow

1. Parent sends a question with options.
2. Child receives the attention overlay.
3. Child opens the message.
4. Child answers by tapping an option or using Guided Speech Practice.
5. Child presses Send Answer.
6. Parent receives the answer in realtime.
7. Parent checks History.
8. Parent can tap Use again to reload a previous question/options into Create.
9. Parent can tap Save as template to keep a previous question/options in the Templates tab.

## Physical Device Validation

The hosted parent web app and installed Android child APK were validated together on a physical OnePlus Android device. The demo flow passed with the required Android permissions and background settings enabled.

Validated flows:

- Parent sends while the child app is open.
- Parent sends while the child phone is on the home screen.
- Parent sends while another app is open.
- Parent sends after lock/unlock.
- Parent sends after 2-minute and 5-minute lock tests.
- Child opens the message from the overlay.
- Child answers by tapping an option.
- Child answers using Guided Speech Practice.
- Parent receives child responses in realtime.

## Boss Demo Flow

1. Parent opens the hosted web app.
2. Child opens the installed Android APK and joins the room.
3. Parent sends a session.
4. Child receives and opens the native overlay alert.
5. Child answers by tapping or using Guided Speech Practice.
6. Child presses Send Answer.
7. Parent receives the answer in realtime.

Required phone settings:

- Display over other apps enabled.
- Notifications enabled.
- Microphone permission enabled.
- Background/battery usage unrestricted or allowed.
- Do not force-close the child app before testing.

For background activity setup, use the child setup `Open app settings` button. It opens the Focus-Test App Info/App Management page. From there, go to Battery usage, set Focus-Test to Unrestricted battery usage or Allow background activity, return to the app, and tap `I've enabled this`. This helps reduce delayed parent alerts after long idle, but Android/OEM idle behavior can still vary by device.

## Debugging Native Alerts

Native Android logs use the tag `FocusAlertDebug`. They trace FCM receipt, message type, room ID, lock state, overlay permission, overlay display, and deep-link launch.

```bash
adb logcat -s FocusAlertDebug
```

## Known Limitation: Long-Idle Android/FCM Delivery Delay

Android overlay reliability can vary by device/OEM battery settings. On the tested OnePlus device, alerts worked after required permissions and battery/background settings were enabled. After extended screen-off idle time, Android/OxygenOS may delay FCM data-message delivery. During that delay, no `FocusAlertDebug` logs appear because the app has not received the FCM message yet. When delivery occurs, the native overlay appears correctly. Future hardening may add a system notification fallback for long-idle/OEM-restricted states.

## Notes

- Locked-device notification behavior is future work.
- Guided Speech Practice selects an option but does not auto-send.
- Visual generation may use fallback/simple visuals; testers can keep them, remove them, or upload their own image.
- Saved templates are local to the parent browser/device.
- Uploaded personal/sensitive images should be avoided for pilot testing.
