package com.ramai.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

/**
 * Daily progress: the streak, today's XP towards the goal, the rating and level, and a button to today's case.
 * Read with the doctor's read-only widget key (set when the widget was added from inside the app), every 30 minutes
 * and whenever the app asks; the last numbers stay shown while offline.
 */
public class ProgressWidget extends AppWidgetProvider {
    private static final String SITE = "https://ram-ai-liard.vercel.app";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                fetch(context);
                for (int id : ids) manager.updateAppWidget(id, views(context));
            } finally {
                pending.finish();
            }
        }).start();
    }

    static void refreshAll(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, ProgressWidget.class));
        new Thread(() -> {
            fetch(context);
            for (int id : ids) m.updateAppWidget(id, views(context));
        }).start();
    }

    /** Fetches the numbers into the widget's preferences (silently keeps the last ones on any failure). */
    private static void fetch(Context context) {
        SharedPreferences p = context.getSharedPreferences("widget", Context.MODE_PRIVATE);
        String token = p.getString("token", null);
        if (token == null) return;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(SITE + "/api/widget?t=" + URLEncoder.encode(token, "UTF-8")).openConnection();
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            if (c.getResponseCode() != 200) return;
            StringBuilder sb = new StringBuilder();
            try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream()))) {
                String line;
                while ((line = r.readLine()) != null) sb.append(line);
            }
            JSONObject j = new JSONObject(sb.toString());
            p.edit()
                .putInt("streak", j.optInt("streak"))
                .putInt("xp", j.optInt("xpToday"))
                .putInt("goal", Math.max(1, j.optInt("goal", 150)))
                .putInt("rating", j.optInt("rating", 1200))
                .putInt("cases", j.optInt("casesToday"))
                .putString("level", j.optString("level", ""))
                .putBoolean("linked", true)
                .apply();
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.disconnect();
        }
    }

    static RemoteViews views(Context context) {
        SharedPreferences p = context.getSharedPreferences("widget", Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_progress);
        int xp = p.getInt("xp", 0), goal = p.getInt("goal", 150);
        v.setTextViewText(R.id.progress_streak, "🔥 " + p.getInt("streak", 0));
        v.setTextViewText(R.id.progress_rating, String.valueOf(p.getInt("rating", 1200)));
        v.setTextViewText(R.id.progress_xp, xp >= goal ? "✓ Daily goal reached · " + xp + " XP" : xp + " / " + goal + " XP today");
        v.setProgressBar(R.id.progress_bar, 100, Math.min(100, Math.round(xp * 100f / goal)), false);
        int cases = p.getInt("cases", 0);
        String level = p.getString("level", "");
        v.setTextViewText(R.id.progress_level, !p.getBoolean("linked", false) ? "Add it from Home in the app to link" : level + (cases > 0 ? " · " + cases + (cases == 1 ? " case today" : " cases today") : ""));
        v.setOnClickPendingIntent(R.id.progress_root, FocusWidget.open(context, "/progress?source=android", 21));
        v.setOnClickPendingIntent(R.id.progress_case, FocusWidget.open(context, "/cases?source=android", 22));
        return v;
    }
}
