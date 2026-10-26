package com.ramai.app;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.UpdateAvailability;
import com.google.androidbrowserhelper.trusted.LauncherActivity;

/**
 * Opens RamAI — but first, if Google Play has a newer version, Play's own full-screen "Update" appears right here
 * (in-app update): it downloads and installs, and RamAI reopens updated. No uninstalling, no trip to the Play Store.
 * The check waits at most 2.5 s; with no update (or no Play, or offline) the app opens as usual.
 */
public class RamLauncherActivity extends LauncherActivity {
    private static final int UPDATE = 4021;
    private boolean launched;

    @Override
    protected boolean shouldLaunchImmediately() {
        return false;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Opening the app refreshes the progress and planner widgets.
        try { ProgressWidget.refreshAll(this); } catch (Exception ignored) { }
        if (savedInstanceState != null) { openApp(); return; }
        new Handler(Looper.getMainLooper()).postDelayed(this::openApp, 2500);
        try {
            AppUpdateManager updates = AppUpdateManagerFactory.create(this);
            updates.getAppUpdateInfo().addOnSuccessListener(info -> {
                boolean available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                    || info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS;
                if (!launched && available && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
                    launched = true; // Play's screen takes over; the app opens when it's done (or dismissed).
                    try {
                        updates.startUpdateFlowForResult(info, this, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build(), UPDATE);
                    } catch (Exception e) {
                        launched = false;
                        openApp();
                    }
                } else {
                    openApp();
                }
            }).addOnFailureListener(e -> openApp());
        } catch (Exception e) {
            openApp();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == UPDATE) {
            launched = false;
            openApp();
        }
    }

    private void openApp() {
        if (launched || isFinishing()) return;
        launched = true;
        launchTwa();
    }
}
