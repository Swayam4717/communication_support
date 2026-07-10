# Focus-Test Tester Install Guide

## Parent Web

1. Open the hosted parent web URL.
2. Select Parent Device.
3. Create a room.
4. Share the room code with the child device.
5. Use the History tab after answered sessions to reuse previous questions or save them as templates.
6. Add or remove answer options as needed. Keep at least two options.
7. Optional: choose a Speech sentence pattern before sending, such as `I want {option}`, `I feel {option}`, or `{option}`.
8. Optional: put the picture word in square brackets for better visuals, such as `play [soccer]`. The child sees `play soccer`, while visual generation searches for `soccer`.

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
3. Child taps Open message and should land directly on the active question/options screen if setup is complete.
4. Optional reminder check: child presses Home or leaves the app before answering. The app marks the unanswered session and should send another native overlay reminder asking the child to return.
5. Child answers by tapping an option or using Guided Speech Practice.
6. Child presses Send Answer.
7. Parent receives the answer in realtime.
8. Parent checks History.
9. Parent can tap Use again to reload a previous question/options into Create.
10. Parent can tap Save as template to keep a previous question/options in the Templates tab.

Guided Speech Practice notes:

- The child taps an option first.
- The app shows a generated phrase, such as `Say this: I want rice`.
- Speech patterns are always applied to the cleaned option label. For example, `I want to {option}` plus `play [soccer]` becomes `I want to play soccer`.
- Start speaking validates that selected option's phrase word by word.
- The app keeps listening through short pauses after Start speaking, until the child stops or the phrase is complete.
- The app shows high-contrast word progress and a clear feedback card such as `Let's try again / Start again: I want rice` or `Good / Ready to send`.
- If a spoken word is misheard or does not match the current word, the phrase restarts from the first word so the child repeats the full sentence.
- Speech practice does not auto-send. The child still presses Send Answer manually.
- For quiet testing, tap the `Say this: ...` phrase five times to reveal `Tester transcript`. It uses the same practice flow without using the microphone.
- Speech or typed testing does not replace the tapped selected option with a different option.

## Physical Device Validation

The hosted parent web app and installed Android child APK were validated together on a physical OnePlus Android device. The demo flow passed with the required Android permissions and background settings enabled.

Validated flows:

- Parent sends while the child app is open.
- Parent sends while the child phone is on the home screen.
- Parent sends while another app is open.
- Parent sends after lock/unlock.
- Parent sends after 2-minute and 5-minute lock tests.
- Child opens the message from the overlay.
- Overlay Open message should skip the intermediate child message screen and open the active question when child setup is already complete.
- If the child leaves the opened active question before answering, a data-only FCM overlay reminder can ask them to return.
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

The app cannot fully verify every OnePlus/OEM background setting automatically. Use `I've enabled this` after manually checking the Battery usage setting.

## Debugging Native Alerts

Native Android logs use the tag `FocusAlertDebug`. They trace FCM receipt, message type, room ID, lock state, overlay permission, overlay display, and deep-link launch.

```bash
adb logcat -s FocusAlertDebug
```

## Known Limitation: Long-Idle Android/FCM Delivery Delay

Android overlay reliability can vary by device/OEM battery settings. On the tested OnePlus device, alerts worked after required permissions and battery/background settings were enabled. After extended screen-off idle time, Android/OxygenOS may delay FCM data-message delivery. During that delay, no `FocusAlertDebug` logs appear because the app has not received the FCM message yet. When delivery occurs, the native overlay appears correctly. Future hardening may add a system notification fallback for long-idle/OEM-restricted states.

## Notes

- Locked-device notification behavior is future work.
- Exit-before-answer reminders use the same data-only native overlay path as parent alerts. They are sent when the child leaves an opened unanswered question and stop once the answer is sent.
- Guided Speech Practice validates the selected option's generated phrase and does not auto-send.
- Guided Speech Practice restarts the full sentence after a spoken mismatch and keeps listening through short pauses.
- Speech sentence patterns are parent-controlled. If no pattern is saved, the app falls back to `I want {option}`.
- Bracketed picture keywords affect visual lookup only. The child-facing label and speech practice use the cleaned label without brackets.
- If no reliable generated visual or Emoji API result is found, the option stays text-only. Testers can upload their own image if a visual is needed.
- Saved templates are local to the parent browser/device and are not room-specific.
- Uploaded personal/sensitive images should be avoided for pilot testing.
