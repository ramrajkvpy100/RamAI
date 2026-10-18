/** Low-data mode: pictures (AI drawings, portraits) load only when tapped. Remembered on this device. */
const KEY = "ramai.lowdata";

export function isLowData(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setLowDataPref(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}
