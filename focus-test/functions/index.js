const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

// Cloud Function that watches room updates and sends a push message when a new session is posted.

exports.sendFocusAlertOnSessionUpdate = onDocumentUpdated(
  "rooms/{roomId}",
  async (event) => {
    console.log("FUNCTION TRIGGERED");
    console.log("ROOM ID:", event.params.roomId);

    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    console.log("BEFORE:", JSON.stringify(before));
    console.log("AFTER:", JSON.stringify(after));

    if (!before || !after) {
      console.log("Missing before or after data");
      return;
    }

    const beforeStatus = before.status;
    const afterStatus = after.status;

    console.log("BEFORE STATUS:", beforeStatus);
    console.log("AFTER STATUS:", afterStatus);

    if (beforeStatus === afterStatus) {
      console.log("Status unchanged, skipping");
      return;
    }

    if (afterStatus !== "sent") {
      console.log("After status is not sent, skipping");
      return;
    }

    const childFcmToken = after.childFcmToken;

    console.log("CHILD TOKEN EXISTS:", !!childFcmToken);

    if (!childFcmToken) {
      console.log("No child FCM token found for room:", event.params.roomId);
      return;
    }

    const message = {
      token: childFcmToken,
      data: {
        type: "focus_alert",
        roomId: event.params.roomId,
        title: "New message",
        body: "A new communication session is ready",
      },
      android: {
        priority: "high",
      },
    };

    try {
      const response = await admin.messaging().send(message);
      console.log("Focus alert sent:", response);
    } catch (error) {
      console.error("Failed to send focus alert:", error);
    }
  }
);