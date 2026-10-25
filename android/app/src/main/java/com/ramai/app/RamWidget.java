package com.ramai.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;

import java.util.Calendar;
import java.util.TimeZone;

/**
 * Home-screen widget: today's daily case, quick links — and a focus timer that runs right in the widget
 * (tap ☕ 25 to start, tap again to stop; a quiet notification when it's done).
 */
public class RamWidget extends AppWidgetProvider {
    private static final String SITE = "https://ram-ai-liard.vercel.app";
    private static final String TOGGLE = "com.ramai.app.FOCUS_TOGGLE";
    private static final String DONE = "com.ramai.app.FOCUS_DONE";
    private static final long FOCUS_MS = 25L * 60_000L;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        SharedPreferences p = context.getSharedPreferences("focus", Context.MODE_PRIVATE);
        if (TOGGLE.equals(intent.getAction())) {
            long ends = p.getLong("ends", 0);
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (ends > System.currentTimeMillis()) {
                p.edit().remove("ends").apply();
                if (am != null) am.cancel(broadcast(context, DONE, 9));
            } else {
                long end = System.currentTimeMillis() + FOCUS_MS;
                p.edit().putLong("ends", end).apply();
                if (am != null) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, broadcast(context, DONE, 9));
            }
            refresh(context);
        } else if (DONE.equals(intent.getAction())) {
            p.edit().remove("ends").putInt("doneToday", p.getInt("doneToday", 0) + 1).apply();
            notifyDone(context);
            refresh(context);
        }
    }

    private static void refresh(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, RamWidget.class));
        for (int id : ids) m.updateAppWidget(id, views(context));
    }

    static RemoteViews views(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_ramai);
        v.setTextViewText(R.id.widget_daily, "Daily case #" + dailyNumber());
        long ends = context.getSharedPreferences("focus", Context.MODE_PRIVATE).getLong("ends", 0);
        long left = ends - System.currentTimeMillis();
        if (left > 0) {
            v.setViewVisibility(R.id.widget_timer, View.VISIBLE);
            v.setChronometer(R.id.widget_timer, SystemClock.elapsedRealtime() + left, null, true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) v.setChronometerCountDown(R.id.widget_timer, true);
            v.setTextViewText(R.id.widget_focus, "■ Stop");
        } else {
            v.setViewVisibility(R.id.widget_timer, View.GONE);
            v.setTextViewText(R.id.widget_focus, "☕ 25");
        }
        v.setOnClickPendingIntent(R.id.widget_root, open(context, "/?source=android", 0));
        v.setOnClickPendingIntent(R.id.widget_case, open(context, "/cases?source=android", 1));
        v.setOnClickPendingIntent(R.id.widget_skills, open(context, "/practice?source=android", 2));
        v.setOnClickPendingIntent(R.id.widget_focus, broadcast(context, TOGGLE, 3));
        v.setOnClickPendingIntent(R.id.widget_exams, open(context, "/exams?source=android", 4));
        return v;
    }

    private static PendingIntent broadcast(Context context, String action, int code) {
        Intent i = new Intent(context, RamWidget.class).setAction(action);
        return PendingIntent.getBroadcast(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent open(Context context, String path, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(SITE + path));
        i.setPackage(context.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void notifyDone(Context context) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) nm.createNotificationChannel(new NotificationChannel("focus", "Focus timer", NotificationManager.IMPORTANCE_DEFAULT));
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(context, "focus") : new Notification.Builder(context);
        b.setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Focus complete ☕").setContentText("25 minutes done — take a 5-minute break.").setAutoCancel(true).setContentIntent(open(context, "/focus?source=android", 5));
        try { nm.notify(25, b.build()); } catch (SecurityException ignored) { }
    }

    /** The same number the site shows: days since 10 Oct 2026 (India time), plus one. */
    static long dailyNumber() {
        Calendar ist = Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"));
        Calendar epoch = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        epoch.clear();
        epoch.set(2026, Calendar.OCTOBER, 10);
        Calendar today = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        today.clear();
        today.set(ist.get(Calendar.YEAR), ist.get(Calendar.MONTH), ist.get(Calendar.DAY_OF_MONTH));
        return Math.round((today.getTimeInMillis() - epoch.getTimeInMillis()) / 86400000.0) + 1;
    }
}
