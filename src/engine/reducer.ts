/**
 * Pure reducer: folds `TurnEffect[]` into the player-visible `CaseState`.
 *
 * Isomorphic and dependency-light so the client can use it for optimistic
 * updates, and the server uses it to rebuild state during replay.
 */

import { flagVital, VITALS } from "./catalog";
import { formatClock } from "./text";
import type { CareLevel, CareSetting, CaseState, CaseTrack, PatientIdentity, Specialty, TurnEffect, VitalKey, VitalReading } from "./types";

export function createInitialState(init: {
  sessionId: string;
  caseNumber: number;
  briefing: string;
  track: CaseTrack;
  level: CareLevel;
  setting: CareSetting;
  patient: PatientIdentity;
  arrivalMinuteOfDay: number;
  specialty?: Specialty;
  guided?: boolean;
}): CaseState {
  return {
    sessionId: init.sessionId,
    caseNumber: init.caseNumber,
    briefing: init.briefing,
    specialty: init.specialty,
    track: init.track,
    level: init.level,
    setting: init.setting,
    patient: init.patient,
    status: "active",
    patientStatus: "stable",
    clock: 0,
    arrivalMinuteOfDay: init.arrivalMinuteOfDay,
    stage: "history",
    stagesTouched: [],
    messages: [],
    vitals: {},
    facts: [],
    investigations: [],
    drugs: [],
    procedures: [],
    timeline: [],
    differentials: [],
    monitored: false,
    statusHistory: [{ at: 0, status: "stable" }],
    ...(init.guided ? { guided: true } : {}),
    seq: 0,
  };
}

const vitalMeta = new Map(VITALS.map((v) => [v.key, v]));

export function applyEffects(input: CaseState, effects: readonly TurnEffect[]): CaseState {
  // Structural copy of the arrays we mutate; everything else is replaced.
  const s: CaseState = {
    ...input,
    messages: [...input.messages],
    vitals: { ...input.vitals },
    facts: [...input.facts],
    investigations: [...input.investigations],
    drugs: [...input.drugs],
    procedures: [...input.procedures],
    timeline: [...input.timeline],
    stagesTouched: [...input.stagesTouched],
    differentials: [...input.differentials],
    statusHistory: [...(input.statusHistory ?? [{ at: 0, status: input.patientStatus }])],
  };
  const id = (prefix: string) => `${prefix}${++s.seq}`;
  const at = () => Math.round(s.clock * 10) / 10;

  for (const e of effects) {
    switch (e.type) {
      case "message":
        s.messages.push({ id: id("m"), role: e.role, kind: e.kind, text: e.text, at: at(), media: e.media, attachmentIds: e.attachmentIds });
        break;

      case "vitals":
        for (const patch of e.readings) {
          const meta = vitalMeta.get(patch.key);
          const computed = flagVital(patch.key, patch.value);
          const reading: VitalReading = {
            key: patch.key,
            label: meta?.label ?? patch.key,
            value: patch.value,
            unit: patch.unit ?? meta?.unit,
            numeric: patch.numeric ?? computed.numeric,
            flag: patch.flag ?? computed.flag,
            at: at(),
          };
          const prev = s.vitals[patch.key as VitalKey];
          s.vitals[patch.key as VitalKey] = {
            current: reading,
            history: prev ? [...prev.history, prev.current].slice(-24) : [],
          };
        }
        break;

      case "fact": {
        const existing = s.facts.findIndex((f) => f.group === e.group && f.label === e.label);
        const fact = { id: existing >= 0 ? s.facts[existing]!.id : id("f"), group: e.group, label: e.label, value: e.value, abnormal: e.abnormal, at: at() };
        if (existing >= 0) s.facts[existing] = fact;
        else s.facts.push(fact);
        break;
      }

      case "investigation_ordered":
        s.investigations.push({
          id: e.instanceId,
          defId: e.defId,
          name: e.name,
          category: e.category,
          orderedAt: at(),
          resultAt: at() + e.turnaroundMin,
          status: "pending",
          cost: e.cost,
        });
        break;

      case "investigation_resulted": {
        const idx = s.investigations.findIndex((i) => i.id === e.instanceId);
        if (idx >= 0) {
          s.investigations[idx] = { ...s.investigations[idx]!, status: "resulted", resultAt: at(), rows: e.rows, media: e.media, report: e.report };
        }
        break;
      }

      case "drug":
        s.drugs.push({ id: id("d"), ...e.drug, at: at() });
        break;

      case "procedure":
        s.procedures.push({ id: id("p"), name: e.name, note: e.note, at: at() });
        break;

      case "patient_status": {
        s.patientStatus = e.status;
        const last = s.statusHistory[s.statusHistory.length - 1];
        // Several changes in the same minute collapse into the latest.
        if (last && last.at === at()) s.statusHistory[s.statusHistory.length - 1] = { at: last.at, status: e.status };
        else s.statusHistory.push({ at: at(), status: e.status });
        break;
      }

      case "timeline":
        s.timeline.push({
          id: id("t"),
          at: at(),
          clock: formatClock(s.arrivalMinuteOfDay, s.clock),
          day: Math.floor((s.arrivalMinuteOfDay + s.clock) / 1440),
          label: e.label,
          detail: e.detail,
          category: e.category,
        });
        break;

      case "advance_time":
        s.clock += e.minutes;
        break;

      case "stage":
        s.stage = e.stage;
        if (!s.stagesTouched.includes(e.stage)) s.stagesTouched.push(e.stage);
        break;

      case "case_status":
        s.status = e.status;
        break;

      case "setting":
        s.setting = e.setting;
        break;

      case "monitoring":
        s.monitored = e.on;
        if (e.rhythm) s.monitorRhythm = e.rhythm;
        break;

      case "working_diagnosis":
        if (e.diagnosis !== undefined) s.workingDiagnosis = e.diagnosis;
        if (e.differentials !== undefined) s.differentials = e.differentials;
        break;
    }
  }
  return s;
}
