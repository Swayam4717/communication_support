package expo.modules.focusalert

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.URL

import android.Manifest
import android.app.KeyguardManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.media.AudioManager
import android.media.ToneGenerator
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.PixelFormat
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.os.bundleOf
import com.google.firebase.messaging.FirebaseMessaging
import android.util.Log
import java.util.Locale

// JS bridge for notifications, overlays, and FCM token access.


class FocusAlertModule : Module() {

  private val debugTag = "FocusAlertDebug"
  private val channelId = "focus_alerts"
  private val androidSpeechTag = "AndroidSpeechDebug"
  private var activeOverlay: android.view.View? = null
  private var practiceTts: TextToSpeech? = null
  private var speechRecognizer: SpeechRecognizer? = null
  private var isAndroidSpeechListening = false
  private var isAndroidSpeechStarting = false
  private var shouldKeepAndroidSpeechListening = false
  private var androidSpeechRestartRunnable: Runnable? = null
  private val androidSpeechRestartDelayMs = 150L

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

  private fun playPracticeTone(kind: String) {
    try {
      val toneType = when (kind) {
        "success" -> ToneGenerator.TONE_PROP_ACK
        "try" -> ToneGenerator.TONE_PROP_NACK
        else -> ToneGenerator.TONE_PROP_BEEP
      }
      val durationMs = when (kind) {
        "success" -> 180
        "try" -> 160
        else -> 120
      }
      val toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 60)
      toneGenerator.startTone(toneType, durationMs)
      Handler(Looper.getMainLooper()).postDelayed({
        toneGenerator.release()
      }, durationMs.toLong() + 80L)
      Log.d(debugTag, "Module practice sound played: $kind")
    } catch (error: Exception) {
      Log.w(debugTag, "Module practice sound failed: $kind", error)
    }
  }

  private fun speakPracticePhrase(context: Context, phrase: String, promise: expo.modules.kotlin.Promise) {
    val cleanPhrase = phrase.trim()

    if (cleanPhrase.isBlank()) {
      promise.resolve(false)
      return
    }

    Handler(Looper.getMainLooper()).post {
      var didResolve = false

      fun resolveOnce(value: Boolean) {
        if (!didResolve) {
          didResolve = true
          promise.resolve(value)
        }
      }

      fun speakWith(engine: TextToSpeech) {
        val utteranceId = "focus-practice-${System.currentTimeMillis()}"

        engine.language = Locale.US
        engine.setSpeechRate(0.75f)
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
          override fun onStart(id: String?) {
            Log.d(debugTag, "Module practice TTS started")
          }

          override fun onDone(id: String?) {
            if (id == utteranceId) {
              Log.d(debugTag, "Module practice TTS finished")
              resolveOnce(true)
            }
          }

          @Deprecated("Deprecated in Java")
          override fun onError(id: String?) {
            if (id == utteranceId) {
              Log.w(debugTag, "Module practice TTS failed")
              resolveOnce(false)
            }
          }

          override fun onError(id: String?, errorCode: Int) {
            if (id == utteranceId) {
              Log.w(debugTag, "Module practice TTS failed: $errorCode")
              resolveOnce(false)
            }
          }
        })

        engine.stop()
        val result = engine.speak(cleanPhrase, TextToSpeech.QUEUE_FLUSH, null, utteranceId)

        if (result == TextToSpeech.ERROR) {
          Log.w(debugTag, "Module practice TTS speak returned error")
          resolveOnce(false)
        }
      }

      val existingEngine = practiceTts

      if (existingEngine != null) {
        speakWith(existingEngine)
        return@post
      }

      practiceTts = TextToSpeech(context.applicationContext) { status ->
        val engine = practiceTts

        if (status != TextToSpeech.SUCCESS || engine == null) {
          Log.w(debugTag, "Module practice TTS unavailable")
          resolveOnce(false)
          return@TextToSpeech
        }

        speakWith(engine)
      }
    }
  }

  private fun stopPracticeSpeech() {
    try {
      practiceTts?.stop()
      Log.d(debugTag, "Module practice TTS stopped")
    } catch (error: Exception) {
      Log.w(debugTag, "Module practice TTS stop failed", error)
    }
  }

  private fun emitAndroidSpeechError(message: String, code: Int? = null) {
    val payload =
      if (code != null) {
        bundleOf("message" to message, "code" to code)
      } else {
        bundleOf("message" to message)
      }
    sendEvent("androidSpeechError", payload)
  }

  private fun getSpeechResults(results: android.os.Bundle?): List<String> {
    return results
      ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      ?.filter { it.isNotBlank() }
      ?: emptyList()
  }

  private fun emitAndroidSpeechResult(eventName: String, results: android.os.Bundle?) {
    val speechResults = getSpeechResults(results)
    val transcript = speechResults.firstOrNull()?.trim().orEmpty()

    if (transcript.isBlank()) {
      return
    }

    sendEvent(
      eventName,
      bundleOf(
        "transcript" to transcript,
        "results" to ArrayList(speechResults)
      )
    )
  }

  private fun clearAndroidSpeechRestart() {
    val restartRunnable = androidSpeechRestartRunnable

    if (restartRunnable != null) {
      Handler(Looper.getMainLooper()).removeCallbacks(restartRunnable)
      androidSpeechRestartRunnable = null
    }
  }

  private fun isRecoverableAndroidSpeechError(error: Int): Boolean {
    return error == SpeechRecognizer.ERROR_NO_MATCH ||
      error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT ||
      error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY
  }

  private fun scheduleAndroidSpeechRestart(context: Context, reason: String) {
    clearAndroidSpeechRestart()

    if (!shouldKeepAndroidSpeechListening) {
      Log.d(androidSpeechTag, "stopped by JS, not restarting after $reason")
      return
    }

    Log.d(androidSpeechTag, "$reason, restarting in ${androidSpeechRestartDelayMs}ms")
    val appContext = context.applicationContext
    val restartRunnable = Runnable {
      androidSpeechRestartRunnable = null

      if (!shouldKeepAndroidSpeechListening) {
        Log.d(androidSpeechTag, "stopped by JS, not restarting")
        return@Runnable
      }

      if (isAndroidSpeechListening || isAndroidSpeechStarting) {
        Log.d(androidSpeechTag, "restart skipped; recognizer already active")
        return@Runnable
      }

      Log.d(androidSpeechTag, "restart actually called")
      startAndroidSpeechRecognitionOnMain(appContext)
    }

    androidSpeechRestartRunnable = restartRunnable
    Handler(Looper.getMainLooper()).postDelayed(
      restartRunnable,
      androidSpeechRestartDelayMs
    )
  }

  private fun ensureSpeechRecognizer(context: Context): SpeechRecognizer? {
    val existingRecognizer = speechRecognizer

    if (existingRecognizer != null) {
      return existingRecognizer
    }

    if (!SpeechRecognizer.isRecognitionAvailable(context)) {
      Log.w(androidSpeechTag, "SpeechRecognizer is not available")
      emitAndroidSpeechError("Android speech recognition is not available")
      return null
    }

    val appContext = context.applicationContext
    val recognizer = SpeechRecognizer.createSpeechRecognizer(appContext)
    recognizer.setRecognitionListener(object : RecognitionListener {
      override fun onReadyForSpeech(params: android.os.Bundle?) {
        Log.d(androidSpeechTag, "onReadyForSpeech")
        isAndroidSpeechStarting = false
        isAndroidSpeechListening = true
        sendEvent("androidSpeechReady", bundleOf("ready" to true))
      }

      override fun onBeginningOfSpeech() {
        Log.d(androidSpeechTag, "onBeginningOfSpeech")
        sendEvent("androidSpeechBeginning", bundleOf("started" to true))
      }

      override fun onRmsChanged(rmsdB: Float) = Unit

      override fun onBufferReceived(buffer: ByteArray?) = Unit

      override fun onEndOfSpeech() {
        Log.d(androidSpeechTag, "onEndOfSpeech")
        isAndroidSpeechStarting = false
        isAndroidSpeechListening = false
        sendEvent("androidSpeechEnd", bundleOf("ended" to true))
        scheduleAndroidSpeechRestart(appContext, "end of speech")
      }

      override fun onError(error: Int) {
        Log.w(androidSpeechTag, "onError: $error")
        isAndroidSpeechStarting = false
        isAndroidSpeechListening = false
        sendEvent(
          "androidSpeechError",
          bundleOf("code" to error, "message" to "Android speech recognition error: $error")
        )
        sendEvent("androidSpeechEnd", bundleOf("ended" to true))

        if (isRecoverableAndroidSpeechError(error)) {
          scheduleAndroidSpeechRestart(appContext, "recoverable error")
        } else {
          shouldKeepAndroidSpeechListening = false
          Log.w(androidSpeechTag, "fatal error, continuous listening stopped")
        }
      }

      override fun onResults(results: android.os.Bundle?) {
        Log.d(androidSpeechTag, "onResults")
        isAndroidSpeechStarting = false
        isAndroidSpeechListening = false
        emitAndroidSpeechResult("androidSpeechFinalResult", results)
        sendEvent("androidSpeechEnd", bundleOf("ended" to true))
        scheduleAndroidSpeechRestart(appContext, "final result")
      }

      override fun onPartialResults(partialResults: android.os.Bundle?) {
        Log.d(androidSpeechTag, "onPartialResults")
        emitAndroidSpeechResult("androidSpeechPartialResult", partialResults)
      }

      override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit
    })

    speechRecognizer = recognizer
    return recognizer
  }

  private fun startAndroidSpeechRecognitionOnMain(context: Context) {
    if (
      ActivityCompat.checkSelfPermission(
        context,
        Manifest.permission.RECORD_AUDIO
      ) != PackageManager.PERMISSION_GRANTED
    ) {
      Log.w(androidSpeechTag, "RECORD_AUDIO permission missing")
      shouldKeepAndroidSpeechListening = false
      isAndroidSpeechStarting = false
      isAndroidSpeechListening = false
      emitAndroidSpeechError("Microphone permission is missing")
      return
    }

    if (isAndroidSpeechListening || isAndroidSpeechStarting) {
      Log.d(androidSpeechTag, "continuous start ignored; recognizer already active")
      return
    }

    val recognizer = ensureSpeechRecognizer(context) ?: run {
      shouldKeepAndroidSpeechListening = false
      isAndroidSpeechStarting = false
      isAndroidSpeechListening = false
      return
    }

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(
        RecognizerIntent.EXTRA_LANGUAGE_MODEL,
        RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
      )
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
    }

    try {
      Log.d(androidSpeechTag, "continuous start")
      isAndroidSpeechStarting = true
      isAndroidSpeechListening = false
      recognizer.startListening(intent)
    } catch (error: Exception) {
      Log.w(androidSpeechTag, "startListening failed", error)
      isAndroidSpeechStarting = false
      isAndroidSpeechListening = false
      emitAndroidSpeechError("Could not start Android speech recognition")

      if (shouldKeepAndroidSpeechListening) {
        scheduleAndroidSpeechRestart(context, "start failure")
      }
    }
  }

  private fun startAndroidSpeechRecognition(context: Context) {
    Handler(Looper.getMainLooper()).post {
      shouldKeepAndroidSpeechListening = true
      clearAndroidSpeechRestart()
      startAndroidSpeechRecognitionOnMain(context.applicationContext)
    }
  }

  private fun stopAndroidSpeechRecognition() {
    Handler(Looper.getMainLooper()).post {
      shouldKeepAndroidSpeechListening = false
      clearAndroidSpeechRestart()
      try {
        speechRecognizer?.stopListening()
        Log.d(androidSpeechTag, "stopListening requested")
      } catch (error: Exception) {
        Log.w(androidSpeechTag, "stopListening failed", error)
      } finally {
        isAndroidSpeechStarting = false
        isAndroidSpeechListening = false
      }
    }
  }

  private fun cancelAndroidSpeechRecognition() {
    Handler(Looper.getMainLooper()).post {
      shouldKeepAndroidSpeechListening = false
      clearAndroidSpeechRestart()
      try {
        speechRecognizer?.cancel()
        Log.d(androidSpeechTag, "cancel requested")
      } catch (error: Exception) {
        Log.w(androidSpeechTag, "cancel failed", error)
      } finally {
        isAndroidSpeechStarting = false
        isAndroidSpeechListening = false
      }
    }
  }

  private fun destroyAndroidSpeechRecognition() {
    Handler(Looper.getMainLooper()).post {
      shouldKeepAndroidSpeechListening = false
      clearAndroidSpeechRestart()
      try {
        speechRecognizer?.destroy()
        Log.d(androidSpeechTag, "destroy requested")
      } catch (error: Exception) {
        Log.w(androidSpeechTag, "destroy failed", error)
      } finally {
        speechRecognizer = null
        isAndroidSpeechStarting = false
        isAndroidSpeechListening = false
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("FocusAlert")
    Events(
      "androidSpeechReady",
      "androidSpeechBeginning",
      "androidSpeechPartialResult",
      "androidSpeechFinalResult",
      "androidSpeechError",
      "androidSpeechEnd"
    )
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

    Function("playPracticeSound") { kind: String ->
      playPracticeTone(kind)
      return@Function null
    }

    AsyncFunction("speakPracticePhrase") { phrase: String, promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      Log.d(debugTag, "Module speakPracticePhrase called")
      speakPracticePhrase(context, phrase, promise)
    }

    Function("stopPracticeSpeech") {
      stopPracticeSpeech()
      return@Function null
    }

    AsyncFunction("startAndroidSpeechRecognition") { promise: expo.modules.kotlin.Promise ->
      val context = appContext.reactContext
      if (context == null) {
        Log.w(androidSpeechTag, "Cannot start speech recognition: React context unavailable")
        promise.resolve(null)
        return@AsyncFunction
      }

      startAndroidSpeechRecognition(context)
      promise.resolve(null)
    }

    AsyncFunction("stopAndroidSpeechRecognition") { promise: expo.modules.kotlin.Promise ->
      stopAndroidSpeechRecognition()
      promise.resolve(null)
    }

    AsyncFunction("cancelAndroidSpeechRecognition") { promise: expo.modules.kotlin.Promise ->
      cancelAndroidSpeechRecognition()
      promise.resolve(null)
    }

    AsyncFunction("destroyAndroidSpeechRecognition") { promise: expo.modules.kotlin.Promise ->
      destroyAndroidSpeechRecognition()
      promise.resolve(null)
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
