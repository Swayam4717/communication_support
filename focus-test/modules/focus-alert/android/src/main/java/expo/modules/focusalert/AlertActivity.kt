package expo.modules.focusalert
import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Button

class AlertActivity: Activity(){
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
        }
        val title = TextView(this).apply {
            text = "Focus Alert"
            textSize = 32f
            gravity = Gravity.CENTER
        }

        val message = TextView(this).apply {
            text = "parent needs your response"
            textSize = 28f
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 32)
        }
        val closeButton = Button(this).apply {
            text = "I understand"
            setOnClickListener {
                finish()
            }
        }
        layout.addView(title)
        layout.addView(message)
        layout.addView(closeButton)

        setContentView(layout)
    }
}