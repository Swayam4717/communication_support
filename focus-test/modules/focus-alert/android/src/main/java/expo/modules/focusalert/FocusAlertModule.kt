package expo.modules.focusalert

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL

import android.Manifest
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessaging
import android.util.Log


class FocusAlertModule : Module() {

  private val channelId = "focus_alerts"
  private var activeOverlay: android.view.View? = null
  private fun openChildAlert(context: Context) {
    val intent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("focustest://?alert=child-alert")
    ).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }

    context.startActivity(intent)
  }

  private fun showNotification(context: Context) {
    val notificationManager =
      context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Focus Alerts",
        NotificationManager.IMPORTANCE_HIGH
      )
      notificationManager.createNotificationChannel(channel)
    }

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
        return
      }
    }

    val intent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("focustest://?alert=child-alert")
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
      .setContentText("Parent has sent you a message.")
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(pendingIntent)
      .setFullScreenIntent(pendingIntent, true)
      .setAutoCancel(true)
      .build()

    notificationManager.notify(1, notification)
  }

  private fun showOverlay(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      if (!Settings.canDrawOverlays(context)) {
        Toast.makeText(context, "Please grant overlay permission first", Toast.LENGTH_SHORT).show()
        return
      }
    }

    val windowManager =
      context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    
    if(activeOverlay != null){
      android.util.Log.d("FOCUS_ALERT", "Overlay already active, skipping creation")
      return
    }

    val layout = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(40, 40, 40, 40)
      setBackgroundColor(android.graphics.Color.WHITE)
    }

    val title = TextView(context).apply {
      text = "Focus Alert"
      textSize = 28f
      setTextColor(android.graphics.Color.BLACK)
      gravity = Gravity.CENTER
    }

    val message = TextView(context).apply {
      text = "Parent has sent you a message"
      textSize = 18f
      setTextColor(android.graphics.Color.BLACK)
      setPadding(0, 20, 0, 20)
      gravity = Gravity.CENTER
    }

    val openButton = Button(context).apply {
      text = "Open"
    }

    layout.addView(title)
    layout.addView(message)
    layout.addView(openButton)

    val overlayType =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        WindowManager.LayoutParams.TYPE_PHONE
      }

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      overlayType,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.CENTER
    }

    fun removeOverlay() {
      try {
        activeOverlay?.let{
          windowManager.removeView(it)
        }
      } catch (_: Exception) {
      }finally {
        activeOverlay = null
      }
    }

    openButton.setOnClickListener {
      removeOverlay()
      openChildAlert(context)
    }

    try {
      windowManager.addView(layout, params)
      activeOverlay = layout
    } catch (e: Exception) {
      Toast.makeText(context, "Error showing overlay: ${e.message}", Toast.LENGTH_SHORT).show()
    }
  }

  private fun isDeviceLocked(context: Context): Boolean {
    val keyguardManager =
      context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager

    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      keyguardManager.isKeyguardLocked || keyguardManager.isDeviceLocked
    } else {
      keyguardManager.isKeyguardLocked
    }
  }

  override fun definition() = ModuleDefinition {
    Name("FocusAlert")
    Function("getFcmToken") {
  FirebaseMessaging.getInstance().token
    .addOnCompleteListener { task ->
      if (!task.isSuccessful) {
        Log.d("FOCUS_FCM", "Fetching FCM token failed")
        
      } else{
        val token = task.result
        Log.d("FOCUS_FCM", "FCM TOKEN: $token")
      }
    }

  return@Function null
}
    Function("showTestNotification") {
      val context = appContext.reactContext ?: return@Function null
      Toast.makeText(context, "Native notification called", Toast.LENGTH_SHORT).show()
      showNotification(context)
      return@Function null
    }

    Function("canDrawOverlays") {
      val context = appContext.reactContext ?: return@Function false

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        return@Function Settings.canDrawOverlays(context)
      }

      return@Function true
    }

    Function("requestOverlayPermission") {
      val context = appContext.reactContext ?: return@Function null

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        context.startActivity(intent)
      }

      return@Function null
    }

    Function("showOverlayAlert") {
      val context = appContext.reactContext ?: return@Function null
      showOverlay(context)
      return@Function null
    }

    Function("triggerFocusAlert") {
  val context = appContext.reactContext ?: return@Function null

  
 
    val keyguardManager =
      context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager

    val isKeyguardLocked = keyguardManager.isKeyguardLocked

    val isDeviceLocked =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        keyguardManager.isDeviceLocked
      } else {
        false
      }

      android.util.Log.d(
        "FOCUS_ALERT",
        "Keyguard Locked: $isKeyguardLocked, Device Locked: $isDeviceLocked"
      )
    if (isKeyguardLocked || isDeviceLocked) {
      showNotification(context)
    } else {
      showOverlay(context)
    }
  return@Function null
}

    View(FocusAlertView::class) {
      Prop("url") { view: FocusAlertView, url: URL ->
        view.webView.loadUrl(url.toString())
      }

      Events("onLoad")
    }
  }
}