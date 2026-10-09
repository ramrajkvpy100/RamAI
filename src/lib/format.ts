import type { CareSetting, PatientStatus, Specialty } from "@/engine/types";

export const caseLabel = (n: number) => `CASE ${String(n).padStart(3, "0")}`;

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export const xp = (n: number) => Math.round(n).toLocaleString("en-IN");

export function elapsed(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total >= 1440) {
    const d = Math.floor(total / 1440);
    const h = Math.floor((total % 1440) / 60);
    return `${d}d ${String(h).padStart(2, "0")}h`;
  }
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function clockAt(arrivalMinuteOfDay: number, at: number): string {
  const t = (((arrivalMinuteOfDay + at) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
}

export const SETTING_LABEL: Record<CareSetting, string> = {
  OPD: "OPD",
  IPD: "Ward",
  ER: "Emergency",
  ICU: "ICU",
  Ward: "Ward",
  Teleconsult: "Teleconsult",
};

export const STATUS_LABEL: Record<PatientStatus, string> = {
  stable: "Stable",
  guarded: "Guarded",
  deteriorating: "Deteriorating",
  critical: "Critical",
  improving: "Improving",
  recovered: "Recovered",
  deceased: "Deceased",
};

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

export const STATUS_TONE: Record<PatientStatus, Tone> = {
  stable: "neutral",
  guarded: "warning",
  deteriorating: "danger",
  critical: "danger",
  improving: "success",
  recovered: "success",
  deceased: "danger",
};

export const SPECIALTY_SHORT: Partial<Record<Specialty, string>> = {
  "Infectious Disease": "Infectious",
  Gastroenterology: "Gastro",
};

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
