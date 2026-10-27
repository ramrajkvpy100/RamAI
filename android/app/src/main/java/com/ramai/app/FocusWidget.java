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

/**
 * The focus timer on its own: a café-warm card — tap 25 or 50 to start, ■ to stop; the minutes count down in the
 * widget and a quiet notification says when it's done. Sessions finished today are counted.
 */
public class FocusWidget extends AppWidgetProvider {
    private static final String SITE = "https://ram-ai-liard.vercel.app";
    static final String START25 = "com.ramai.app.FOCUSW_25";
    static final String START50 = "com.ramai.app.FOCUSW_50";
    static final String STOP = "com.ramai.app.FOCUSW_STOP";
    static final String DONE = "com.ramai.app.FOCUSW_DONE";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String a = intent.getAction();
        SharedPreferences p = context.getSharedPreferences("focusw", Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (START25.equals(a) || START50.equals(a)) {
            int minutes = START50.equals(a) ? 50 : 25;
            long end = System.currentTimeMillis() + minutes * 60_000L;
            p.edit().putLong("ends", end).putInt("minutes", minutes).apply();
            if (am != null) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, end, broadcast(context, DONE, 19));
            refresh(context);
        } else if (STOP.equals(a)) {
            p.edit().remove("ends").apply();
            if (am != null) am.cancel(broadcast(context, DONE, 19));
            refresh(context);
        } else if (DONE.equals(a)) {
            int day = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
            int done = p.getInt("day", -1) == day ? p.getInt("done", 0) : 0;
            int minutes = p.getInt("minutes", 25);
            p.edit().remove("ends").putInt("day", day).putInt("done", done + 1).apply();
            notifyDone(context, minutes);
            refresh(context);
        }
    }

    private static void refresh(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        for (int id : m.getAppWidgetIds(new ComponentName(context, FocusWidget.class))) m.updateAppWidget(id, views(context));
    }

    static RemoteViews views(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_focus);
        SharedPreferences p = context.getSharedPreferences("focusw", Context.MODE_PRIVATE);
        long left = p.getLong("ends", 0) - System.currentTimeMillis();
        int day = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
        int done = p.getInt("day", -1) == day ? p.getInt("done", 0) : 0;
        v.setTextViewText(R.id.focus_today, done == 1 ? "1 session today" : done + " sessions today");
        boolean running = left > 0;
        v.setViewVisibility(R.id.focus_timer, running ? View.VISIBLE : View.GONE);
        v.setViewVisibility(R.id.focus_idle, running ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.focus_25, running ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.focus_50, running ? View.GONE : View.VISIBLE);
        v.setViewVisibility(R.id.focus_stop, running ? View.VISIBLE : View.GONE);
        v.setTextViewText(R.id.focus_label, running ? "FOCUSING · " + p.getInt("minutes", 25) : "FOCUS");
        if (running) {
            v.setChronometer(R.id.focus_timer, SystemClock.elapsedRealtime() + left, null, true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) v.setChronometerCountDown(R.id.focus_timer, true);
        }
        v.setOnClickPendingIntent(R.id.focus_25, broadcast(context, START25, 11));
        v.setOnClickPendingIntent(R.id.focus_50, broadcast(context, START50, 12));
        v.setOnClickPendingIntent(R.id.focus_stop, broadcast(context, STOP, 13));
        v.setOnClickPendingIntent(R.id.focus_cup, open(context, "/focus?source=android", 14));
        return v;
    }

    private static PendingIntent broadcast(Context context, String action, int code) {
        Intent i = new Intent(context, FocusWidget.class).setAction(action);
        return PendingIntent.getBroadcast(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static PendingIntent open(Context context, String path, int code) {
        // Straight to the app's own launcher (not "any app for this link"), which opens the page in the app.
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(SITE + path)).setClass(context, RamLauncherActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void notifyDone(Context context, int minutes) {
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) nm.createNotificationChannel(new NotificationChannel("focus", "Focus timer", NotificationManager.IMPORTANCE_DEFAULT));
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(context, "focus") : new Notification.Builder(context);
        String rest = minutes >= 50 ? "10" : "5";
        b.setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Focus complete ☕").setContentText(minutes + " minutes done — take a " + rest + "-minute break.").setAutoCancel(true).setContentIntent(open(context, "/focus?source=android", 15));
        try { nm.notify(26, b.build()); } catch (SecurityException ignored) { }
    }
}
