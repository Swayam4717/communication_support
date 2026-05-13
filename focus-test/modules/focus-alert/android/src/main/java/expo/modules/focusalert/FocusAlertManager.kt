package expo.modules.focusalert

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.os.Handler
import android.os.Looper

// Owns the overlay and unlock-path logic for the native alert experience.


object FocusAlertManager {

  private var activeOverlay: android.view.View? = null

  fun triggerFocusAlert(context: Context) {
    Log.d("FOCUS_ALERT", "triggerFocusAlert called from manager")

    Handler(Looper.getMainLooper()).post {
        if (isDeviceLocked(context)) {
            Log.d("FOCUS_ALERT", "Device locked → notification route")
            // Notification route later
        } else {
            Log.d("FOCUS_ALERT", "Device unlocked → overlay route")
            showOverlay(context.applicationContext)
        }
    }
  }

  private fun openChildAlert(context: Context) {
    val intent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("focustest://?alert=child-alert")
    ).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }

    context.startActivity(intent)
  }

  private fun showOverlay(context: Context) {
    if (activeOverlay != null) {
      Log.d("FOCUS_ALERT", "Overlay already active, ignoring duplicate")
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      if (!Settings.canDrawOverlays(context)) {
        Log.d("FOCUS_ALERT", "Overlay permission not granted, cannot show alert")
        return
      }
    }

    val windowManager =
      context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

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
        activeOverlay?.let {
          windowManager.removeView(it)
        }
      } catch (_: Exception) {
      } finally {
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
      Log.d("FOCUS_ALERT", "Overlay shown from manager")
    } catch (e: Exception) {
      activeOverlay = null
      Log.d("FOCUS_ALERT", "Error showing overlay: ${e.message}")
      
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
}