package com.ramai.app;

import android.app.Notification;
import android.os.Build;

import com.google.androidbrowserhelper.trusted.DelegationService;

/** RamAI's notifications, as the app's own: the website address Chrome adds underneath is taken off. */
public class RamDelegationService extends DelegationService {
    @Override
    public boolean onNotifyNotificationWithChannel(String platformTag, int platformId, Notification notification, String channelName) {
        Notification clean = notification;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                Notification.Builder b = Notification.Builder.recoverBuilder(this, notification);
                b.setSubText(null);
                clean = b.build();
                clean.extras.remove(Notification.EXTRA_SUB_TEXT);
            } catch (RuntimeException e) {
                clean = notification;
            }
        }
        return super.onNotifyNotificationWithChannel(platformTag, platformId, clean, channelName);
    }
}
