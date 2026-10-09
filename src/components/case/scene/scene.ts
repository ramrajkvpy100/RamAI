import type { CaseState, VitalKey } from "@/engine/types";

/** Which bedside scene a case is played in. */
export type SceneKind = "monitor" | "opd" | "phone";

export function sceneFor(state: CaseState): SceneKind {
  if (state.track === "phone") return "phone";
  if (state.track === "emergency" || state.monitored || state.setting === "ER" || state.setting === "ICU") return "monitor";
  return "opd";
}

/** A measured vital as a number, or null when it hasn't been measured. */
export function vitalNumber(state: CaseState, key: VitalKey): number | null {
  const r = state.vitals[key]?.current;
  if (!r) return null;
  const n = r.numeric ?? parseFloat(r.value);
  return Number.isFinite(n) ? n : null;
}

export function systolic(state: CaseState): number | null {
  const m = state.vitals.bp?.current.value.match(/^(\d+)\s*\//);
  return m?.[1] ? Number(m[1]) : null;
}

/**
 * Monitor alarm level from measured values — the limits a bedside monitor
 * would alarm on, nothing more. Only while the monitor is attached.
 */
export function alarmLevel(state: CaseState): "high" | "medium" | null {
  if (!state.monitored || state.patientStatus === "deceased") return null;
  const hr = vitalNumber(state, "hr");
  const spo2 = vitalNumber(state, "spo2");
  const rr = vitalNumber(state, "rr");
  const sbp = systolic(state);
  if ((hr !== null && (hr < 40 || hr > 150)) || (spo2 !== null && spo2 < 85) || (sbp !== null && sbp < 80)) return "high";
  if ((hr !== null && (hr < 50 || hr > 130)) || (spo2 !== null && spo2 < 90) || (sbp !== null && sbp < 90) || (rr !== null && (rr > 30 || rr < 8))) return "medium";
  return null;
}

/** Which monitored parameters are outside alarm limits. */
export function alarmingKeys(state: CaseState): Set<VitalKey> {
  const out = new Set<VitalKey>();
  if (!state.monitored) return out;
  const hr = vitalNumber(state, "hr");
  const spo2 = vitalNumber(state, "spo2");
  const rr = vitalNumber(state, "rr");
  const sbp = systolic(state);
  if (hr !== null && (hr < 50 || hr > 130)) out.add("hr");
  if (spo2 !== null && spo2 < 90) out.add("spo2");
  if (sbp !== null && sbp < 90) out.add("bp");
  if (rr !== null && (rr > 30 || rr < 8)) out.add("rr");
  return out;
}

/** A stable, purely cosmetic OPD token number. */
export const tokenNumber = (state: CaseState) => 11 + ((state.caseNumber * 7 + state.arrivalMinuteOfDay) % 48);

export const monitorSince = (state: CaseState) => state.timeline.find((e) => e.label === "Continuous monitoring started")?.clock;
