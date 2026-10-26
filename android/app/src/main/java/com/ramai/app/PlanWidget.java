package com.ramai.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;

/**
 * The planner on the home screen: today's most important task, the next three to-dos and habits done — read with
 * the same read-only key as the progress widget, every 30 minutes. Tap to open the planner.
 */
public class PlanWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                ProgressWidget.fetch(context);
                for (int id : ids) manager.updateAppWidget(id, views(context));
            } finally {
                pending.finish();
            }
        }).start();
    }

    static RemoteViews views(Context context) {
        SharedPreferences p = context.getSharedPreferences("widget", Context.MODE_PRIVATE);
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_plan);
        String mit = p.getString("mit", "");
        boolean linked = p.getBoolean("linked", false);
        v.setTextViewText(R.id.plan_mit, !linked ? "Add it from Home in the app to link" : mit.isEmpty() ? "Tap to set today's most important task" : (p.getBoolean("mitDone", false) ? "✓ " : "") + mit);
        int[] rows = { R.id.plan_todo1, R.id.plan_todo2, R.id.plan_todo3 };
        for (int k = 0; k < 3; k++) {
            String t = p.getString("todo" + k, "");
            v.setViewVisibility(rows[k], t.isEmpty() ? View.GONE : View.VISIBLE);
            v.setTextViewText(rows[k], "○  " + t);
        }
        int left = p.getInt("left", 0), habits = p.getInt("habits", 0), done = p.getInt("habitsDone", 0);
        String foot = (left > 3 ? "+" + (left - 3) + " more to-dos" : "") + (habits > 0 ? (left > 3 ? " · " : "") + "Habits " + done + "/" + habits : "");
        v.setTextViewText(R.id.plan_foot, foot);
        v.setOnClickPendingIntent(R.id.plan_root, FocusWidget.open(context, "/plan?source=android", 41));
        return v;
    }
}
