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
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;

/**
 * The app's focus timer, kept by Android itself: the site opens ramai://focus?ends=<ms>&label=…
 * (or ?stop=1) and this sets a real alarm clock — exact, even with the phone locked or asleep. When it rings:
 * a vibration and a notification. Nothing is shown on screen while it's set.
 */
public class FocusAlarm extends BroadcastReceiver {
    static final String RING = "com.ramai.app.FOCUS_RING";
    private static final String CHANNEL = "focus-end";

    /**
     * Invisible: sets or clears the alarm, then closes. The first time, it asks to post notifications (Android 13+)
     * and, where Android needs it, to set exact alarms — so the end is on time even in deep sleep.
     */
    public static class Set extends Activity {
        @Override
        protected void onCreate(Bundle b) {
            super.onCreate(b);
            apply();
            android.content.SharedPreferences asked = getSharedPreferences("focus-alarm", MODE_PRIVATE);
            if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED && !asked.getBoolean("notif", false)) {
                asked.edit().putBoolean("notif", true).apply();
                requestPermissions(new String[] { android.Manifest.permission.POST_NOTIFICATIONS }, 1);
                return; // finishes in onRequestPermissionsResult
            }
            askExactOnce();
            done();
        }

        @Override
        public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
            askExactOnce();
            done();
        }

        private void askExactOnce() {
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            android.content.SharedPreferences asked = getSharedPreferences("focus-alarm", MODE_PRIVATE);
            if (Build.VERSION.SDK_INT >= 31 && am != null && !am.canScheduleExactAlarms() && !asked.getBoolean("exact", false)) {
                asked.edit().putBoolean("exact", true).apply();
                android.widget.Toast.makeText(this, "Allow RamAI to set alarms, so the focus timer rings on time when the phone is locked", android.widget.Toast.LENGTH_LONG).show();
                try {
                    startActivity(new Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
                } catch (Exception ignored) { }
            }
        }

        private void done() {
            finish();
            overridePendingTransition(0, 0);
        }

        private void apply() {
            Uri data = getIntent().getData();
            AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (am == null) return;
            PendingIntent ring = ring(this, data != null ? data.getQueryParameter("label") : null);
            am.cancel(ring);
            String ends = data != null ? data.getQueryParameter("ends") : null;
            if (ends == null || data.getQueryParameter("stop") != null) return;
            long at;
            try { at = Long.parseLong(ends); } catch (NumberFormatException e) { return; }
            if (at <= System.currentTimeMillis()) return;
            getSharedPreferences("focus-alarm", MODE_PRIVATE).edit().putLong("at", at).apply();
            schedule(this, am, at, ring);
        }
    }

    /** An exact alarm clock where allowed; otherwise the closest Android allows without asking (may be a little late in deep sleep). */
    static void schedule(Context c, AlarmManager am, long at, PendingIntent ring) {
        try {
            if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
                am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, FocusWidget.open(c, "/focus?source=android", 31)), ring);
                return;
            }
        } catch (SecurityException ignored) { }
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, ring);
    }

    static PendingIntent ring(Context c, String label) {
        Intent i = new Intent(c, FocusAlarm.class).setAction(RING);
        if (label != null) i.putExtra("label", label);
        return PendingIntent.getBroadcast(c, 30, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override
    public void onReceive(Context c, Intent intent) {
        if (!RING.equals(intent.getAction())) return;
        long[] pattern = {0, 400, 200, 400, 200, 700};
        Vibrator v = (Vibrator) c.getSystemService(Context.VIBRATOR_SERVICE);
        if (v != null) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(pattern, -1));
            else v.vibrate(pattern, -1);
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, "Focus timer ends", NotificationManager.IMPORTANCE_HIGH);
            ch.enableVibration(true);
            ch.setVibrationPattern(pattern);
            ch.setSound(android.provider.Settings.System.DEFAULT_NOTIFICATION_URI, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());
            nm.createNotificationChannel(ch);
        }
        String label = intent.getStringExtra("label");
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ? new Notification.Builder(c, CHANNEL) : new Notification.Builder(c);
        b.setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(label != null && !label.isEmpty() ? label : "Time's up ☕")
            .setContentText("Your focus time is over — open RamAI for what's next.")
            .setCategory(Notification.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(FocusWidget.open(c, "/focus?source=android", 32));
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) b.setVibrate(pattern).setPriority(Notification.PRIORITY_HIGH);
        try { nm.notify(27, b.build()); } catch (SecurityException ignored) { }
    }
}
