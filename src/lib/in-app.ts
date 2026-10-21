"use client";

import { useEffect, useState } from "react";

/**
 * Is RamAI open inside the Android app (the Play Store's Trusted Web Activity)? There, Google Play's payments
 * policy forbids selling digital goods outside Play Billing — so Pro and gifts are neither offered nor linked to.
 *
 * The app opens with `?source=android` and an `android-app://com.ramai.app` referrer; the first page notes it for the
 * rest of that tab (sessionStorage: the app's own tab, never the user's Chrome tabs).
 */
const KEY = "ramai-android-app";

export function inAndroidApp(): boolean {
  try {
    if (document.referrer.startsWith("android-app://com.ramai.app") || new URLSearchParams(location.search).get("source") === "android") sessionStorage.setItem(KEY, "1");
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** False on the server and the first render, then whether this tab is the Android app. */
export function useInAndroidApp(): boolean {
  const [inApp, setInApp] = useState(false);
  useEffect(() => setInApp(inAndroidApp()), []);
  return inApp;
}
