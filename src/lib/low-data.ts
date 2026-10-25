/** Low-data mode: pictures (AI drawings, portraits) load only when tapped. Remembered on this device. */
const KEY = "ramai.lowdata";

/** (The low-data switch was removed: pictures always load.) */
export function isLowData(): boolean {
  void KEY;
  return false;
}

export function setLowDataPref(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}

/**
 * A device to go easy on: the Android app (its WebView shares memory with the whole phone), a phone with 4 GB of
 * memory or less, few CPU cores, or the browser's data saver. No 3D, no endless decorative animation — so old and
 * low-end phones don't run out of memory (and the app isn't killed) or drain the battery.
 */
export function isLiteDevice(): boolean {
  try {
    const n = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const app = sessionStorage.getItem("ramai-android-app") === "1" || document.referrer.startsWith("android-app://com.ramai.app") || new URLSearchParams(location.search).get("source") === "android";
    return app || (n.deviceMemory ?? 8) <= 4 || (n.hardwareConcurrency ?? 8) <= 4 || !!n.connection?.saveData;
  } catch {
    return false;
  }
}
