/** Subtle haptics where the phone supports them (Android, the app). A light tap for an action; a pattern for a win. */
const can = () => typeof navigator !== "undefined" && "vibrate" in navigator;

export function tap() {
  if (can()) try { navigator.vibrate(8); } catch {}
}

export function success() {
  if (can()) try { navigator.vibrate([12, 60, 18]); } catch {}
}

export function warn() {
  if (can()) try { navigator.vibrate([30, 40, 30]); } catch {}
}
