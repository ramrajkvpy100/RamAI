import "server-only";

import { levelMeta, trackLabel } from "@/engine/levels";
import type { CaseDebrief, CaseState, FactGroup } from "@/engine/types";
import type { CaseSummary } from "@/lib/community";

const HISTORY: FactGroup[] = ["complaint", "hpi", "past", "medication", "allergy", "family", "social", "diet", "sexual", "obstetric", "systemic"];
const EXAM: FactGroup[] = ["general-exam", "systemic-exam", "local-exam"];
const VITAL_LABELS: Record<string, string> = { bp: "BP", hr: "Pulse", rr: "Resp. rate", temp: "Temp", spo2: "SpO₂", rbs: "Glucose", gcs: "GCS", pain: "Pain", urine: "Urine output", weight: "Weight" };
const VERDICT: Record<string, string> = { correct: "Diagnosed correctly", implied: "Recognised from the management", partial: "Partly diagnosed", incorrect: "Missed" };
const OUTCOME: Record<string, string> = { recovered: "Recovered", improving: "Improving", stable: "Stable", guarded: "Guarded", deteriorating: "Deteriorating", critical: "Critical", deceased: "Died" };

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * What a "Discuss this case" post shows: the case as the doctor met it — who the patient was,
 * what they said, what was found, measured, tested and given — so others can give their
 * opinion. Built on the server from the closed case, so it's the real case, not retyped.
 */
export function caseSummary(state: CaseState, debrief: CaseDebrief): CaseSummary {
  const p = state.patient;
  const country = state.country ?? "IN";
  const facts = (groups: FactGroup[], max: number) =>
    state.facts.filter((f) => groups.includes(f.group)).slice(0, max).map((f) => ({ label: cut(f.label, 60), value: cut(f.value, 280), ...(f.abnormal ? { abnormal: true } : {}) }));
  // What the patient (or whoever brought them) said first, before anything was asked.
  const opening = state.messages
    .filter((m) => m.at <= 0 && m.role !== "doctor" && m.text && !/^\(/.test(m.text))
    .map((m) => cut(m.text, 300))
    .slice(0, 3);
  const vitals = Object.entries(state.vitals)
    .filter(([k, t]) => t && VITAL_LABELS[k])
    .map(([k, t]) => {
      const first = t!.history[0] ?? t!.current;
      return { label: VITAL_LABELS[k]!, first: `${first.value}${first.unit ? ` ${first.unit}` : ""}`, last: `${t!.current.value}${t!.current.unit ? ` ${t!.current.unit}` : ""}`, ...(t!.current.flag && t!.current.flag !== "normal" && t!.current.flag !== "unknown" ? { abnormal: true } : {}) };
    });
  const investigations = state.investigations
    .filter((i) => i.status === "resulted")
    .slice(0, 14)
    .map((i) => {
      const rows = i.rows ?? [];
      const abnormal = rows.filter((r) => r.flag !== "normal" && r.flag !== "unknown");
      const shown = (abnormal.length ? abnormal : rows).slice(0, 8).map((r) => `${r.analyte} ${r.value}${r.unit ? ` ${r.unit}` : ""}${r.flag === "high" ? " ↑" : r.flag === "low" ? " ↓" : r.flag === "critical" ? " ‼" : ""}`);
      const findings = i.report ? cut(i.report, 400) : shown.length ? `${shown.join(", ")}${abnormal.length ? "" : " (normal)"}` : "Done";
      return { name: i.name, findings };
    });
  const management = [
    ...state.drugs.map((d) => cut(`${d.generic}${d.dose ? ` ${d.dose}` : ""} ${d.route}${d.mode === "prescribed" && d.frequency ? ` ${d.frequency}` : ""}${d.duration ? ` × ${d.duration}` : ""} (${d.mode})`, 120)),
    ...state.procedures.map((x) => cut(x.name, 120)),
  ].slice(0, 20);
  return {
    patient: `${p.age}-year-old ${p.sex.toLowerCase()}${p.occupation ? ` · ${p.occupation}` : ""}, ${p.city}`,
    setting: `${trackLabel(state.track, country)} · ${levelMeta(state.level, country).label}${debrief.specialty ? ` · ${debrief.specialty}` : ""}`,
    presentation: [cut(state.briefing, 300), ...opening].filter(Boolean),
    history: facts(HISTORY, 24),
    examination: facts(EXAM, 16),
    vitals,
    investigations,
    management,
    ...(state.workingDiagnosis ? { workingDiagnosis: cut(state.workingDiagnosis, 160) } : {}),
    differentials: state.differentials.slice(0, 6).map((d) => cut(d, 100)),
    answer: { diagnosis: debrief.diagnosis, verdict: VERDICT[debrief.verdict] ?? debrief.verdict, score: debrief.score.total, outcome: OUTCOME[debrief.finalStatus] ?? debrief.finalStatus },
  };
}
