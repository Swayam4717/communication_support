package expo.modules.focusalert

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import android.app.PendingIntent
import android.content.Intent

class FocusAlertModule : Module() {

  override fun definition() = ModuleDefinition {

    Name("FocusAlert")

    Function("showTestNotification") {

      val channelId = "focus_alerts"

      val context = appContext.reactContext ?: return@Function null

      Toast.makeText(context, "Native function called", Toast.LENGTH_SHORT).show()

      val notificationManager =
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

      val channel = NotificationChannel(
        channelId,
        "Focus Alerts",
        NotificationManager.IMPORTANCE_HIGH
      )

      notificationManager.createNotificationChannel(channel)

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        if (
          ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS
          ) != PackageManager.PERMISSION_GRANTED
        ) {
          appContext.currentActivity?.requestPermissions(
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            1001
          )
          return@Function null
        }
      }

      val intent = Intent(
        Intent.ACTION_VIEW,
        android.net.Uri.parse("focustest://?alert=child-alert")
      ).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }

      val pendingIntent = PendingIntent.getActivity(
        context,
        0,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      val notification = NotificationCompat.Builder(context, channelId)
        .setContentTitle("Focus Alert")
        .setContentText("This is a native Android notification test.")
        .setSmallIcon(android.R.drawable.ic_dialog_alert)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .setContentIntent(pendingIntent)
        .setAutoCancel(true)
        .build()

      notificationManager.notify(1, notification)
    }

    View(FocusAlertView::class) {
      Prop("url") { view: FocusAlertView, url: URL ->
        view.webView.loadUrl(url.toString())
      }

      Events("onLoad")
    }
  }
}