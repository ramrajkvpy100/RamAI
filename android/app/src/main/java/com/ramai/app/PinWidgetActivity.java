package com.ramai.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

/**
 * "Add widget" inside the app: the site opens ramai://widget, and this invisible screen asks the launcher to place
 * RamAI's widget on the home screen (Android 8+). Where the launcher can't, it says how to add it by hand.
 */
public class PinWidgetActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean asked = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = getSystemService(AppWidgetManager.class);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                asked = manager.requestPinAppWidget(new ComponentName(this, RamWidget.class), null, null);
            }
        }
        if (!asked) {
            Toast.makeText(this, "Touch and hold your home screen → Widgets → RamAI", Toast.LENGTH_LONG).show();
        }
        finish();
    }
}
