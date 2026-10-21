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
