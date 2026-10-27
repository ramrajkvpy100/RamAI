package com.ramai.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import java.util.Calendar;

/**
 * The daily reminder, kept by Android itself (no web push needed): the site opens ramai://remind?hour=19 to turn it
 * on at that hour of the phone's own time, or ramai://remind?off=1 to turn it off. It survives restarts.
 */
public class DailyReminder extends BroadcastReceiver {
    static final String RING = "com.ramai.app.REMIND_RING";
    private static final String CHANNEL = "daily-reminder";
    private static final String PREFS = "daily-reminder";

    /** Invisible: saves the choice, asks to post notifications the first time (Android 13+), then closes. */
    public static class Set extends Activity {
        @Override
        protected void onCreate(Bundle b) {
            super.onCreate(b);
            Uri data = getIntent().getData();
            SharedPreferences p = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (data != null && data.getQueryParameter("off") != null) {
                p.edit().putInt("hour", -1).apply();
            } else {
                int hour = 19;
                try { hour = Integer.parseInt(data != null && data.getQueryParameter("hour") != null ? data.getQueryParameter("hour") : "19"); } catch (NumberFormatException ignored) { }
                p.edit().putInt("hour", Math.max(6, Math.min(23, hour))).apply();
            }
            schedule(this);
            if (p.getInt("hour", -1) >= 0 && Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[] { android.Manifest.permission.POST_NOTIFICATIONS }, 2);
                return; // finishes in onRequestPermissionsResult
            }
            done();
        }

        @Override
        public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
            done();
        }

        private void done() {
            finish();
            overridePendingTransition(0, 0);
        }
    }

    /** After a restart or an app update: set again. */
    public static class Boot extends BroadcastReceiver {
        @Override
        public void onReceive(Context c, Intent intent) {
            schedule(c);
        }
    }

    static PendingIntent ring(Context c) {
        return PendingIntent.getBroadcast(c, 40, new Intent(c, DailyReminder.class).setAction(RING), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** The next time the chosen hour comes round (or nothing, when it's off). */
    static void schedule(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent ring = ring(c);
        am.cancel(ring);
        int hour = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getInt("hour", -1);
        if (hour < 0) return;
        Calendar at = Calendar.getInstance();
        at.set(Calendar.HOUR_OF_DAY, hour);
        at.set(Calendar.MINUTE, 0);
        at.set(Calendar.SECOND, 0);
        at.set(Calendar.MILLISECOND, 0);
        if (at.getTimeInMillis() <= System.currentTimeMillis() + 60_000) at.add(Calendar.DAY_OF_YEAR, 1);
        // On the hour where Android allows exact alarms (the focus timer asks for that); otherwise within 15 minutes.
        try {
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.getTimeInMillis(), ring);
                return;
            }
        } catch (SecurityException ignored) { }
        am.setWindow(AlarmManager.RTC_WAKEUP, at.getTimeInMillis(), 15 * 60_000L, ring);
    }

    private static final String[][] LINES = {
        { "Today's patients are waiting 🩺", "One case keeps your streak alive — it takes 5 minutes." },
        { "Your ward round is due 🏥", "A new patient is in the queue. Can you find the diagnosis?" },
        { "Keep the streak going 🔥", "One case, a few flashcards — tomorrow-you will thank you." },
        { "Time for a quick case ⏱️", "Five minutes of thinking like a doctor, every day." },
    };

    @Override
    public void onReceive(Context c, Intent intent) {
        if (!RING.equals(intent.getAction())) return;
        schedule(c); // tomorrow's
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Daily reminder", NotificationManager.IMPORTANCE_DEFAULT));
        String[] line = LINES[Calendar.getInstance().get(Calendar.DAY_OF_YEAR) % LINES.length];
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(line[0])
            .setContentText(line[1])
            .setAutoCancel(true)
            .setContentIntent(FocusWidget.open(c, "/?source=android", 41));
        try { nm.notify(41, b.build()); } catch (SecurityException ignored) { }
    }
}
