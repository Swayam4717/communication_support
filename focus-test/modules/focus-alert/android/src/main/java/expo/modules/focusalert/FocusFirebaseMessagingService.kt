package expo.modules.focusalert

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

// Receives FCM data messages and forwards them into the native focus alert flow.

class FocusFirebaseMessagingService : FirebaseMessagingService() {
    private val debugTag = "FocusAlertDebug"

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)

        val data = remoteMessage.data
        val messageType = data["type"]
        val roomId = data["roomId"]

        Log.d(
            debugTag,
            "FCM received: keys=${data.keys.joinToString(",")}, type=$messageType, roomId=$roomId"
        )

        if (messageType == "focus_alert") {
            Log.d(debugTag, "FCM message type accepted: focus_alert")
        } else {
            Log.w(
                debugTag,
                "FCM message type missing/wrong: $messageType; continuing existing alert path"
            )
        }

        FocusAlertManager.triggerFocusAlert(applicationContext)
    }
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d(debugTag, "FCM token refreshed")
    }
}
