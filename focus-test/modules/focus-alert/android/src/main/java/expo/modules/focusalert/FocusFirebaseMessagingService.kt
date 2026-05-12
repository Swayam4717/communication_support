package expo.modules.focusalert

import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class FocusFirebaseMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("FOCUS_FCM", "FCM Received")
        Log.d("FOCUS_FCM", "Message data: ${remoteMessage.data}")
        Log.d("FOCUS_FCM", "Message From: ${remoteMessage.from}")

        FocusAlertManager.triggerFocusAlert(applicationContext)
    }
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FOCUS_FCM", "New FCM Token: $token")
    }
}