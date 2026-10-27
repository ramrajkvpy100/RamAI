package com.ramai.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;

/**
 * The planner on the home screen: what to do next, today's most important task, the open to-dos and the habits still
 * to do — each ticked off right on the widget (it's saved to the planner at once). Refreshes every 15 minutes, when
 * the app opens, and with ↻. Tap the title to open the planner.
 */
public class PlanWidget extends AppWidgetProvider {
    private static final String SITE = "https://ram-ai-liard.vercel.app";
    static final String TICK = "com.ramai.app.PLAN_TICK";
    static final String REFRESH = "com.ramai.app.PLAN_REFRESH";
    private static final int[] ROWS = { R.id.plan_row1, R.id.plan_row2, R.id.plan_row3, R.id.plan_row4, R.id.plan_row5, R.id.plan_row6 };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
        schedule(context);
        refreshInBackground(context, goAsync());
    }

    @Override
    public void onEnabled(Context context) {
        schedule(context);
    }

    @Override
    public void onDisabled(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(broadcast(context, REFRESH, 900, null));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (REFRESH.equals(action)) {
            refreshInBackground(context, goAsync());
        } else if (TICK.equals(action) && intent.getData() != null) {
            Uri u = intent.getData();
            String kind = u.getQueryParameter("kind"), id = u.getQueryParameter("id");
            // Shown ticked at once; then saved and the widget re-read from the planner.
            markLocally(context, kind, id);
            updateAll(context);
            final PendingResult pending = goAsync();
            new Thread(() -> {
                try {
                    tick(context, kind, id);
                    ProgressWidget.fetch(context);
                    updateAll(context);
                } finally {
                    pending.finish();
                }
            }).start();
        }
    }

    private static void refreshInBackground(Context context, PendingResult pending) {
        new Thread(() -> {
            try {
                ProgressWidget.fetch(context);
                updateAll(context);
            } finally {
                pending.finish();
            }
        }).start();
    }

    static void updateAll(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        for (int id : m.getAppWidgetIds(new ComponentName(context, PlanWidget.class))) m.updateAppWidget(id, views(context));
    }

    /** Every 15 minutes (inexact, so it costs almost no battery), while a planner widget is on the home screen. */
    static void schedule(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.setInexactRepeating(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + 15 * 60_000L, AlarmManager.INTERVAL_FIFTEEN_MINUTES, broadcast(context, REFRESH, 900, null));
    }

    /** While the app is open the planner may change: re-read it 2, 6 and 12 minutes later (only if a widget exists). */
    static void soon(Context context) {
        if (AppWidgetManager.getInstance(context).getAppWidgetIds(new ComponentName(context, PlanWidget.class)).length == 0) return;
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        int[] mins = { 2, 6, 12 };
        for (int k = 0; k < mins.length; k++) am.set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + mins[k] * 60_000L, broadcast(context, REFRESH, 901 + k, null));
    }

    private static PendingIntent broadcast(Context c, String action, int code, Uri data) {
        Intent i = new Intent(c, PlanWidget.class).setAction(action);
        if (data != null) i.setData(data);
        return PendingIntent.getBroadcast(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static String today() {
        return new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(new java.util.Date());
    }

    /** Saves the tick to the planner (the widget key can only do this). */
    private static void tick(Context context, String kind, String id) {
        String token = context.getSharedPreferences("widget", Context.MODE_PRIVATE).getString("token", null);
        if (token == null || kind == null) return;
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(SITE + "/api/widget?t=" + URLEncoder.encode(token, "UTF-8") + "&d=" + today() + "&kind=" + kind + "&id=" + URLEncoder.encode(id == null ? "" : id, "UTF-8")).openConnection();
            c.setRequestMethod("POST");
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.getResponseCode();
        } catch (Exception ignored) {
        } finally {
            if (c != null) c.disconnect();
        }
    }

    /** The ticked item drops off the widget straight away (before the planner answers). */
    private static void markLocally(Context context, String kind, String id) {
        SharedPreferences p = context.getSharedPreferences("widget", Context.MODE_PRIVATE);
        SharedPreferences.Editor e = p.edit();
        try {
            if ("mit".equals(kind)) e.putBoolean("mitDone", !p.getBoolean("mitDone", false));
            String key = "todo".equals(kind) ? "open" : "habit".equals(kind) ? "habitsLeft" : null;
            if (key != null) {
                JSONArray a = new JSONArray(p.getString(key, "[]")), b = new JSONArray();
                for (int k = 0; k < a.length(); k++) if (!a.getJSONObject(k).optString("id").equals(id)) b.put(a.getJSONObject(k));
                e.putString(key, b.toString());
            }
            if ("mit".equals(kind) || key != null) {
                boolean undo = "mit".equals(kind) && p.getBoolean("mitDone", false);
                e.putInt("done", Math.max(0, p.getInt("done", 0) + (undo ? -1 : 1)));
            }
            // The most important task just ticked: point at the next thing straight away.
            if ("mit".equals(kind) && !p.getBoolean("mitDone", false)) {
                JSONArray open = new JSONArray(p.getString("open", "[]")), habits = new JSONArray(p.getString("habitsLeft", "[]"));
                e.putString("next", open.length() > 0 ? "Next: " + open.getJSONObject(0).optString("text") : habits.length() > 0 ? "Habit: " + habits.getJSONObject(0).optString("name") : "All done for today 🎉");
            }
        } catch (Exception ignored) { }
        e.apply();
    }

    static RemoteViews views(Context context) {
        SharedPreferences p = context.getSharedPreferences("widget", Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_plan);
        boolean linked = p.getBoolean("linked", false);
        String mit = p.getString("mit", "");
        boolean mitDone = p.getBoolean("mitDone", false);
        int done = p.getInt("done", 0), total = p.getInt("total", 0);

        v.setTextViewText(R.id.plan_count, total > 0 ? Math.min(done, total) + " / " + total + " done" : "");
        v.setProgressBar(R.id.plan_bar, 100, total > 0 ? Math.min(100, Math.round(done * 100f / total)) : 0, false);
        String next = p.getString("next", "");
        v.setTextViewText(R.id.plan_next, !linked ? "Add the widget from Home in the app to link it" : next.isEmpty() ? "Tap to plan your day" : next);

        // Today's most important task: tap to tick.
        if (linked && !mit.isEmpty()) {
            v.setViewVisibility(R.id.plan_mit, View.VISIBLE);
            v.setTextViewText(R.id.plan_mit, (mitDone ? "✅  " : "⭐  ") + mit);
            v.setOnClickPendingIntent(R.id.plan_mit, broadcast(context, TICK, 700, Uri.parse("ramai://tick?kind=mit&id=mit")));
        } else {
            v.setViewVisibility(R.id.plan_mit, View.GONE);
        }

        // The open to-dos, then the habits still to do — each row ticks itself off.
        int row = 0;
        try {
            JSONArray open = new JSONArray(p.getString("open", "[]"));
            for (int k = 0; k < open.length() && row < ROWS.length; k++, row++) {
                JSONObject t = open.getJSONObject(k);
                v.setViewVisibility(ROWS[row], View.VISIBLE);
                v.setTextViewText(ROWS[row], "○  " + t.optString("text"));
                v.setOnClickPendingIntent(ROWS[row], broadcast(context, TICK, 710 + row, Uri.parse("ramai://tick?kind=todo&id=" + Uri.encode(t.optString("id")))));
            }
            JSONArray habits = new JSONArray(p.getString("habitsLeft", "[]"));
            for (int k = 0; k < habits.length() && row < ROWS.length; k++, row++) {
                JSONObject h = habits.getJSONObject(k);
                v.setViewVisibility(ROWS[row], View.VISIBLE);
                v.setTextViewText(ROWS[row], "🔁  " + h.optString("name"));
                v.setOnClickPendingIntent(ROWS[row], broadcast(context, TICK, 710 + row, Uri.parse("ramai://tick?kind=habit&id=" + Uri.encode(h.optString("id")))));
            }
        } catch (Exception ignored) { }
        for (; row < ROWS.length; row++) v.setViewVisibility(ROWS[row], View.GONE);

        long at = p.getLong("fetchedAt", 0);
        v.setTextViewText(R.id.plan_foot, at > 0 ? "Tap a line to tick it · updated " + new java.text.SimpleDateFormat("h:mm a", java.util.Locale.getDefault()).format(new java.util.Date(at)) : "Tap a line to tick it");

        v.setOnClickPendingIntent(R.id.plan_refresh, broadcast(context, REFRESH, 701, null));
        v.setOnClickPendingIntent(R.id.plan_title, FocusWidget.open(context, "/plan?source=android", 41));
        v.setOnClickPendingIntent(R.id.plan_next, FocusWidget.open(context, "/plan?source=android", 42));
        return v;
    }
}
