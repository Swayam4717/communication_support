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
import android.os.PowerManager
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

// JS bridge for notifications, overlays, and FCM token access.


class FocusAlertModule : Module() {

  private val debugTag = "FocusAlertDebug"
  private val channelId = "focus_alerts"
  private var activeOverlay: android.view.View? = null

  private fun startSettingsIntent(context: Context, intent: Intent): Boolean {
    return try {
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    } catch (error: Exception) {
      Log.w(debugTag, "Could not open settings intent: ${intent.action}", error)
      false
    }
  }

  private fun openAppSettings(context: Context): Boolean {
    return startSettingsIntent(
      context,
      Intent(
        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
        Uri.parse("package:${context.packageName}")
      )
    )
  }

  private fun openChildAlert(context: Context) {
    Log.d(debugTag, "Module launching child alert deep link")
    val intent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("focustest://?alert=child-alert")
    ).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }

    context.startActivity(intent)
    Log.d(debugTag, "Module child alert deep link launch requested")
  }

  private fun showNotification(context: Context) {
    Log.d(debugTag, "Module showNotification called")
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
        Log.w(debugTag, "Notification permission missing; requesting permission")
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
    Log.d(debugTag, "Module notification posted")
  }

  private fun showOverlay(context: Context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val canDrawOverlays = Settings.canDrawOverlays(context)
      Log.d(debugTag, "Module overlay permission check: canDrawOverlays=$canDrawOverlays")

      if (!canDrawOverlays) {
        Log.w(debugTag, "Module overlay not shown: overlay permission missing")
        Toast.makeText(context, "Please grant overlay permission first", Toast.LENGTH_SHORT).show()
        return
      }
    } else {
      Log.d(debugTag, "Module overlay permission check skipped: pre-Marshmallow")
    }

    val windowManager =
      context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    
    if(activeOverlay != null){
      Log.d(debugTag, "Module overlay not shown: overlay already active")
      return
    }

    Log.d(debugTag, "Module preparing overlay window")

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
          Log.d(debugTag, "Module overlay removed")
        }
      } catch (_: Exception) {
        Log.w(debugTag, "Module overlay removeView failed")
      }finally {
        activeOverlay = null
      }
    }

    openButton.setOnClickListener {
      Log.d(debugTag, "Module overlay Open tapped")
      removeOverlay()
      openChildAlert(context)
    }

    try {
      Log.d(debugTag, "Module attempting overlay addView")
      windowManager.addView(layout, params)
      activeOverlay = layout
      Log.d(debugTag, "Module overlay addView succeeded")
    } catch (e: Exception) {
      Log.w(debugTag, "Module overlay addView failed: ${e.message}", e)
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
   AsyncFunction("getFcmToken") { promise: expo.modules.kotlin.Promise ->
  Log.d(debugTag, "Module getFcmToken called")
  FirebaseMessaging.getInstance().token
    .addOnCompleteListener { task ->
      if (!task.isSuccessful) {
        Log.w(debugTag, "Module getFcmToken failed")
        promise.resolve(null)
      } else {
        val token = task.result
        Log.d(debugTag, "Module getFcmToken succeeded")
        promise.resolve(token)
      }
    }
}
    Function("showTestNotification") {
      val context = appContext.reactContext ?: return@Function null
      Log.d(debugTag, "Module showTestNotification called")
      Toast.makeText(context, "Native notification called", Toast.LENGTH_SHORT).show()
      showNotification(context)
      return@Function null
    }

    Function("canDrawOverlays") {
      val context = appContext.reactContext ?: return@Function false

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val canDrawOverlays = Settings.canDrawOverlays(context)
        Log.d(debugTag, "Module canDrawOverlays returned $canDrawOverlays")
        return@Function canDrawOverlays
      }

      Log.d(debugTag, "Module canDrawOverlays returned true for pre-Marshmallow")
      return@Function true
    }

    Function("requestOverlayPermission") {
      val context = appContext.reactContext ?: return@Function null

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        Log.d(debugTag, "Module opening overlay permission settings")
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:${context.packageName}")
        ).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        context.startActivity(intent)
      } else {
        Log.d(debugTag, "Module overlay permission request skipped: pre-Marshmallow")
      }

      return@Function null
    }

    Function("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@Function false

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        val powerManager =
          context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val ignoring =
          powerManager.isIgnoringBatteryOptimizations(context.packageName)
        Log.d(debugTag, "Module isIgnoringBatteryOptimizations returned $ignoring")
        return@Function ignoring
      }

      Log.d(debugTag, "Module isIgnoringBatteryOptimizations returned true for pre-Marshmallow")
      return@Function true
    }

    Function("openBatterySettings") {
      val context = appContext.reactContext ?: return@Function false
      Log.d(debugTag, "Module opening app settings for battery/background setup")
      return@Function openAppSettings(context)
    }

    Function("showOverlayAlert") {
      val context = appContext.reactContext ?: return@Function null
      Log.d(debugTag, "Module showOverlayAlert called")
      showOverlay(context)
      return@Function null
    }

    Function("triggerFocusAlert") {
  val context = appContext.reactContext ?: return@Function null

      Log.d(debugTag, "Module triggerFocusAlert called")

  
 
    val keyguardManager =
      context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager

    val isKeyguardLocked = keyguardManager.isKeyguardLocked

    val isDeviceLocked =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        keyguardManager.isDeviceLocked
      } else {
        false
      }

      Log.d(
        debugTag,
        "Keyguard Locked: $isKeyguardLocked, Device Locked: $isDeviceLocked"
      )
    if (isKeyguardLocked || isDeviceLocked) {
      Log.d(debugTag, "Module device locked; notification route selected")
      showNotification(context)
    } else {
      Log.d(debugTag, "Module device unlocked; overlay route selected")
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
