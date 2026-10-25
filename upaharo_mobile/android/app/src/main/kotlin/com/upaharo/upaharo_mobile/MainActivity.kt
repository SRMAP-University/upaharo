package com.upaharo.upaharo_mobile

import android.os.Build
import android.os.Bundle
import android.view.Display
import io.flutter.embedding.android.FlutterFragmentActivity

/// Truecaller OAuth SDK requires FragmentActivity (not plain Activity).
class MainActivity : FlutterFragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        applyHighestRefreshRate()
    }

    override fun onResume() {
        super.onResume()
        // ColorOS often drops third-party apps back to 60Hz after resume.
        applyHighestRefreshRate()
    }

    /// Keep the app on the panel's fastest mode so scroll does not step
    /// between 60Hz and 120Hz.
    private fun applyHighestRefreshRate() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        val currentDisplay: Display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            display ?: return
        } else {
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay
        }
        val best = currentDisplay.supportedModes.maxByOrNull { it.refreshRate } ?: return
        val params = window.attributes
        if (params.preferredDisplayModeId != best.modeId) {
            params.preferredDisplayModeId = best.modeId
            window.attributes = params
        }
    }
}
