package com.ramai.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import java.util.Calendar;
import java.util.TimeZone;

/** Home-screen widget: today's daily case and one-tap ways into RamAI (a case, Skills Lab, the focus timer, exams). */
public class RamWidget extends AppWidgetProvider {
    private static final String SITE = "https://ram-ai-liard.vercel.app";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    static RemoteViews views(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_ramai);
        v.setTextViewText(R.id.widget_daily, "Daily case #" + dailyNumber());
        v.setOnClickPendingIntent(R.id.widget_root, open(context, "/?source=android", 0));
        v.setOnClickPendingIntent(R.id.widget_case, open(context, "/cases?source=android", 1));
        v.setOnClickPendingIntent(R.id.widget_skills, open(context, "/practice?source=android", 2));
        v.setOnClickPendingIntent(R.id.widget_focus, open(context, "/focus?source=android", 3));
        v.setOnClickPendingIntent(R.id.widget_exams, open(context, "/exams?source=android", 4));
        return v;
    }

    private static PendingIntent open(Context context, String path, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(SITE + path));
        i.setPackage(context.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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
