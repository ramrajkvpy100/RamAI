package com.ramai.app;

import android.app.Activity;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.Toast;

/**
 * "Add widget" inside the app: the site opens ramai://widget?kind=focus|progress|ramai (with the progress widget's
 * read-only key), and this invisible screen asks the launcher to place that widget (Android 8+). Where the launcher
 * can't, it says how to add it by hand. Opening it again with a key also relinks an existing progress widget.
 */
public class PinWidgetActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Uri data = getIntent().getData();
        String kind = data != null ? data.getQueryParameter("kind") : null;
        String token = data != null ? data.getQueryParameter("t") : null;
        if (token != null && token.matches("[\\w-]{20,64}")) {
            getSharedPreferences("widget", MODE_PRIVATE).edit().putString("token", token).apply();
            ProgressWidget.refreshAll(this);
        }
        Class<? extends AppWidgetProvider> which = "focus".equals(kind) ? FocusWidget.class : "progress".equals(kind) ? ProgressWidget.class : RamWidget.class;
        boolean asked = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = getSystemService(AppWidgetManager.class);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                asked = manager.requestPinAppWidget(new ComponentName(this, which), null, null);
            }
        }
        if (!asked) Toast.makeText(this, "Touch and hold your home screen → Widgets → RamAI", Toast.LENGTH_LONG).show();
        finish();
    }
}
