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
7. Continue to Child Mode.

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

## Notes

- The reliable attention path is when the child phone is active/unlocked.
- Locked-device notification behavior is future work.
- Guided Speech Practice selects an option but does not auto-send.
- Visual generation may use fallback/simple visuals; testers can keep them, remove them, or upload their own image.
- Saved templates are local to the parent browser/device.
- Uploaded personal/sensitive images should be avoided for pilot testing.
