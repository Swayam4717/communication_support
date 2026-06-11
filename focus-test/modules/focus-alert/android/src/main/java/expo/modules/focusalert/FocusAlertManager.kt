package expo.modules.focusalert

import android.app.KeyguardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

// Owns the overlay and unlock-path logic for the native alert experience.

object FocusAlertManager {

  private const val debugTag = "FocusAlertDebug"
  private var activeOverlay: android.view.View? = null

  fun triggerFocusAlert(context: Context) {
    Log.d(debugTag, "Manager triggerFocusAlert called")

    Handler(Looper.getMainLooper()).post {
      val keyguardManager =
        context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      val powerManager =
        context.getSystemService(Context.POWER_SERVICE) as PowerManager
      val isKeyguardLocked = keyguardManager.isKeyguardLocked
      val isDeviceLocked =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          keyguardManager.isDeviceLocked
        } else {
          false
        }
      val isInteractive =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT_WATCH) {
          powerManager.isInteractive
        } else {
          @Suppress("DEPRECATION")
          powerManager.isScreenOn
        }
      val lockedForAlert = isDeviceLocked(context)

      Log.d(
        debugTag,
        "Lock state: keyguardLocked=$isKeyguardLocked, deviceLocked=$isDeviceLocked, interactive=$isInteractive, lockedForAlert=$lockedForAlert"
      )
      if (lockedForAlert) {
        Log.d(debugTag, "Device locked; overlay not shown, notification route placeholder")
        Log.d(debugTag, "Device locked route selected")
        // Notification route later
      } else {
        Log.d(debugTag, "Device unlocked; attempting overlay route")
        Log.d(debugTag, "Device unlocked route selected")
        showOverlay(context.applicationContext)
      }
    }
  }

  private fun openChildAlert(context: Context) {
    Log.d(debugTag, "Launching child alert deep link")
    val intent = Intent(
      Intent.ACTION_VIEW,
      Uri.parse("focustest://?alert=child-alert")
    ).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }

    context.startActivity(intent)
    Log.d(debugTag, "Child alert deep link launch requested")
  }

  private fun dp(context: Context, value: Int): Int {
    return (value * context.resources.displayMetrics.density).toInt()
  }

  private fun roundedBackground(
    color: Int,
    radius: Float,
    strokeColor: Int? = null,
    strokeWidth: Int = 0
  ): GradientDrawable {
    return GradientDrawable().apply {
      shape = GradientDrawable.RECTANGLE
      cornerRadius = radius
      setColor(color)

      if (strokeColor != null && strokeWidth > 0) {
        setStroke(strokeWidth, strokeColor)
      }
    }
  }

  private fun showOverlay(context: Context) {
    if (activeOverlay != null) {
      Log.d(debugTag, "Overlay not shown: overlay already active")
      return
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val canDrawOverlays = Settings.canDrawOverlays(context)
      Log.d(debugTag, "Overlay permission check: canDrawOverlays=$canDrawOverlays")

      if (!canDrawOverlays) {
        Log.w(debugTag, "Overlay not shown: overlay permission missing")
        return
      }
    } else {
      Log.d(debugTag, "Overlay permission check skipped: pre-Marshmallow")
    }

    val windowManager =
      context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

    Log.d(debugTag, "Preparing overlay window")

    val rootLayout = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(context, 28), dp(context, 28), dp(context, 28), dp(context, 28))
      setBackgroundColor(Color.parseColor("#F7EFE7"))
      isClickable = true
    }

    val card = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setPadding(dp(context, 26), dp(context, 28), dp(context, 26), dp(context, 26))
      background = roundedBackground(
        color = Color.WHITE,
        radius = dp(context, 24).toFloat(),
        strokeColor = Color.parseColor("#E8D8C8"),
        strokeWidth = dp(context, 1)
      )
      isClickable = true
    }

    val title = TextView(context).apply {
      text = "New message"
      textSize = 28f
      setTextColor(Color.parseColor("#3B2F2A"))
      gravity = Gravity.CENTER
      typeface = Typeface.DEFAULT_BOLD
      includeFontPadding = false
    }

    val titleParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply {
      bottomMargin = dp(context, 16)
    }

    val message = TextView(context).apply {
      text = "Someone wants to talk with you.\nTap below to answer."
      textSize = 18f
      setTextColor(Color.parseColor("#6B5A50"))
      gravity = Gravity.CENTER
      setLineSpacing(dp(context, 3).toFloat(), 1.0f)
    }

    val messageParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    ).apply {
      bottomMargin = dp(context, 26)
    }

    val openButton = Button(context).apply {
      text = "Open message"
      textSize = 18f
      setTextColor(Color.WHITE)
      typeface = Typeface.DEFAULT_BOLD
      background = roundedBackground(
        color = Color.parseColor("#B9824F"),
        radius = dp(context, 16).toFloat()
      )
      setPadding(dp(context, 20), dp(context, 10), dp(context, 20), dp(context, 10))
      isAllCaps = false
    }

    val buttonParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      dp(context, 56)
    )

    card.addView(title, titleParams)
    card.addView(message, messageParams)
    card.addView(openButton, buttonParams)

    val cardParams = LinearLayout.LayoutParams(
      LinearLayout.LayoutParams.MATCH_PARENT,
      LinearLayout.LayoutParams.WRAP_CONTENT
    )

    rootLayout.addView(card, cardParams)

    val overlayType =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        WindowManager.LayoutParams.TYPE_PHONE
      }

    val flags =
      WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN

    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      overlayType,
      flags,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.CENTER
    }

    fun removeOverlay() {
      try {
        activeOverlay?.let {
          windowManager.removeView(it)
          Log.d(debugTag, "Overlay removed")
        }
      } catch (_: Exception) {
        Log.w(debugTag, "Overlay removeView failed")
      } finally {
        activeOverlay = null
      }
    }

    openButton.setOnClickListener {
      Log.d(debugTag, "Overlay Open message tapped")
      removeOverlay()

      Handler(Looper.getMainLooper()).postDelayed({
        openChildAlert(context)
      }, 150)
    }

    try {
      Log.d(debugTag, "Attempting overlay addView")
      windowManager.addView(rootLayout, params)
      activeOverlay = rootLayout
      Log.d(debugTag, "Overlay addView succeeded")
    } catch (e: Exception) {
      activeOverlay = null
      Log.w(debugTag, "Overlay addView failed: ${e.message}", e)
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
