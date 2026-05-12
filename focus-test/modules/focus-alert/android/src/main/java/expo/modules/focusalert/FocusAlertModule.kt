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
import android.graphics.PixelFormat
import android.net.Uri
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

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
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(pendingIntent)
        .setFullScreenIntent(pendingIntent, true)
        .setAutoCancel(true)
        .build()

      notificationManager.notify(1, notification)
    }
    Function("canDrawOverlays"){
      val content = appContext.reactContext ?: return@Function false
      
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        return@Function Settings.canDrawOverlays(content)
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
    Function("showOverlayAlert"){
      val context = appContext.reactContext ?: return@Function null
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M){
        if(!Settings.canDrawOverlays(context)){
          Toast.makeText(context, "Please grant overlay permission first", Toast.LENGTH_SHORT).show()
          return@Function null
        }
      }
      val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
      val layout = LinearLayout(context).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(40, 40, 40, 40)
        setBackgroundColor(android.graphics.Color.WHITE)
      }
      val title = TextView(context).apply {
        text ="Focus Alert"
        textSize = 28f
        setTextColor(android.graphics.Color.BLACK)
      }
      val message = TextView(context).apply {
        text = "Parent has sent you a message"
        textSize = 18f
        setTextColor(android.graphics.Color.BLACK)
        setPadding(0, 20, 0, 20)
      }
      val openButton = Button(context).apply {
        text ="Open"

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
        WindowManager.LayoutParams.WRAP_CONTENT,
        overlayType,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
        PixelFormat.TRANSLUCENT
      ).apply {
        gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        y = 100
      }

      fun removeOverlay(){
        try{
          windowManager.removeView(layout)
        }catch (_:Exception){
        }
      }
      openButton.setOnClickListener {
        removeOverlay()
        val intent = Intent(
          Intent.ACTION_VIEW,
          android.net.Uri.parse("focustest://?alert=child-alert")
        ).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        context.startActivity(intent)
      }
      try{
        windowManager.addView(layout, params)
      }catch(e:Exception){
        Toast.makeText(context, "Error showing overlay: ${e.message}", Toast.LENGTH_SHORT).show()
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