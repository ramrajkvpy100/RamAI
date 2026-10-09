/**
 * The clinical simulator — a deterministic state machine.
 *
 *   hidden state  +  ActionRecord  →  TurnEffect[]  (and a mutated hidden state)
 *
 * `HiddenState` is server-only. It is never serialised to the client; the
 * server rebuilds it by replaying the sealed action log, so every function in
 * this file must be deterministic for a given (definition, records) pair.
 */

import { catalogExam, catalogInvestigation, catalogMeasure, defaultVitals, flagVital, ROUTINE_VITALS, vitalDefinition } from "./catalog";
import type { ClinicalCaseDefinition, HazardDefinition, HazardStage, TherapeuticRule, Appropriateness } from "./case-definition";
import { formularyDrug, type FormularyDrug } from "./formulary";
import { canPerform, LEVELS } from "./levels";
import { globalTriggers, hazardLibrary, morphineEquivalent } from "./physiology";
import { capitalise, describeSpan, hash, pick } from "./text";
import type {
  ActionRecord,
  CareSetting,
  DrugRoute,
  EcgSpec,
  EncounterStage,
  FactGroup,
  InvestigationCategory,
  LabRow,
  MediaAsset,
  MessageRole,
  PatientStatus,
  ResolvedIntent,
  TurnEffect,
  VitalKey,
  VitalPatch,
} from "./types";

/* -------------------------------------------------------------------------- */
/* Hidden state                                                                */
/* -------------------------------------------------------------------------- */

export interface OrderedInvestigation {
  instanceId: string;
  defId: string;
  name: string;
  category: InvestigationCategory;
  orderedAt: number;
  resultAt: number;
  cost: number;
  delivered: boolean;
  result: { rows?: LabRow[]; report?: string; media?: MediaAsset };
  priority: "essential" | "useful" | "situational" | "unnecessary";
}

export interface GivenDrug {
  drugId: string;
  generic: string;
  brand?: string;
  classes: string[];
  at: number;
  mode: "given" | "prescribed";
  route: DrugRoute;
  dose?: string;
  amount?: number;
  unit?: string;
  frequency?: string;
  duration?: string;
  volumeMl?: number;
  ruleId?: string;
  appropriateness: Appropriateness;
  doseError: boolean;
  frequencyError: boolean;
}

export interface ArmedHazard {
  id: string;
  label: string;
  triggeredAt: number;
  /** Stage timings count from here. */
  armedAt: number;
  trigger: string;
  stageIdx: number;
  manifestedAt?: number;
  rescuedAt?: number;
  rescue?: "full" | "partial" | "too-late";
  recoveryIdx: number;
  died: boolean;
  /** Player actions taken after the hazard became visible. */
  responses: string[];
}

export interface HiddenState {
  clock: number;
  setting: CareSetting;
  status: PatientStatus;
  monitored: boolean;
  vitals: Record<VitalKey, VitalPatch>;
  /** The value last shown for each vital, so the monitor only redraws what moved. */
  shown: Partial<Record<VitalKey, string>>;
  /** When the blood pressure cuff last measured. */
  nibpAt?: number;
  measured: VitalKey[];
  history: Record<string, number>;
  exams: Record<string, number>;
  examOverrides: Record<string, string>;
  patientSays?: string;
  investigations: OrderedInvestigation[];
  invSeq: number;
  /** Tests requested that the facility could not perform. */
  unavailable: string[];
  drugs: GivenDrug[];
  /** Times each rule / "measure:x" / "drug:x" / "stop:x" token was executed. */
  actions: Record<string, number[]>;
  fluidMl: number;
  hazards: ArmedHazard[];
  /** Omission hazards already evaluated at their deadline. */
  omissionsChecked: string[];
  /** The improvement after definitive treatment has been applied. */
  treatmentResponded: boolean;
  diagnosis?: { text: string; at: number };
  differentials: string[];
  followUps: { at: number; days: number }[];
  reassessments: number[];
  counselling: string[];
  timelineKeys: string[];
  /** Player turns that contained at least one recognised clinical intent. */
  actionCount: number;
  unrecognised: number;
  discharged: boolean;
  closed: boolean;
  closedAt?: number;
  firstTreatmentAt?: number;
}

/** "district hospital", "GP surgery", "regional medical center" — as said mid-sentence. */
function facilityName(def: ClinicalCaseDefinition): string {
  if (def.facility) return def.facility.replace(/\b[A-Z][a-z]+/g, (w) => w.toLowerCase());
  return LEVELS[def.level].short === "Med College" ? "medical college" : LEVELS[def.level].label.toLowerCase();
}

export function createHiddenState(def: ClinicalCaseDefinition): HiddenState {
  const vitals = defaultVitals(def.patient);
  for (const [k, v] of Object.entries(def.baselineVitals)) {
    if (v) vitals[k as VitalKey] = { ...v, key: k as VitalKey };
  }
  return {
    clock: 0,
    setting: def.setting,
    status: def.initialStatus ?? "stable",
    monitored: def.setting === "ICU",
    vitals,
    shown: {},
    measured: [...(def.triageVitals ?? [])],
    history: {},
    exams: {},
    examOverrides: {},
    investigations: [],
    invSeq: 0,
    unavailable: [],
    drugs: [],
    actions: {},
    fluidMl: 0,
    hazards: [],
    omissionsChecked: [],
    treatmentResponded: false,
    differentials: [],
    followUps: [],
    reassessments: [],
    counselling: [],
    timelineKeys: [],
    actionCount: 0,
    unrecognised: 0,
    discharged: false,
    closed: false,
  };
}

/* -------------------------------------------------------------------------- */
/* Opening                                                                     */
/* -------------------------------------------------------------------------- */

export function openingEffects(def: ClinicalCaseDefinition, hidden: HiddenState): TurnEffect[] {
  const fx: TurnEffect[] = [
    { type: "timeline", label: def.track === "phone" ? "Call connected" : def.setting === "ER" ? "Patient arrived in the emergency department" : "Patient arrived", category: "arrival" },
  ];
  if (def.triageVitals?.length) {
    fx.push({ type: "vitals", readings: def.triageVitals.map((k) => reading(hidden, k)) });
    fx.push({ type: "timeline", label: "Triage vitals recorded", category: "monitor" });
  }
  for (const beat of def.opening) {
    fx.push({ type: "message", role: beat.role, kind: beat.kind, text: beat.text, media: beat.media });
  }
  if (hidden.monitored) fx.push({ type: "monitoring", on: true, rhythm: monitorRhythm(def) });
  if (hidden.status !== "stable") fx.push({ type: "patient_status", status: hidden.status });
  return fx;
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

/** A vital as shown to the player — remembered as shown, so the monitor only redraws what changed. */
function reading(hidden: HiddenState, key: VitalKey): VitalPatch {
  const v = hidden.vitals[key];
  const def = vitalDefinition(key);
  const { flag, numeric } = flagVital(key, v.value);
  hidden.shown[key] = v.value;
  if (key === "bp") hidden.nibpAt = hidden.clock;
  return { key, value: v.value, unit: def.unit, numeric, flag };
}


/** What a bedside monitor shows once attached: the rhythm of the case's own ECG, else sinus. */
function monitorRhythm(def: ClinicalCaseDefinition): EcgSpec["rhythm"] {
  const spec = def.investigations.find((i) => i.id === "ecg")?.media?.spec;
  return spec?.kind === "ecg" ? spec.rhythm : "sinus";
}

function record(hidden: HiddenState, token: string) {
  (hidden.actions[token] ??= []).push(hidden.clock);
}

function done(hidden: HiddenState, token: string, since = -Infinity): boolean {
  return (hidden.actions[token] ?? []).some((t) => t >= since);
}

/** Vital changes — from treatment, deterioration or recovery — take effect at once. */
function applyVitals(hidden: HiddenState, patches: VitalPatch[] | undefined) {
  for (const p of patches ?? []) hidden.vitals[p.key] = { ...p };
}

/** Responding to treatment: abnormal pulse, breathing and saturation settle partway back. BP and temperature stay case-specific. */
function settleVitals(hidden: HiddenState) {
  const patches: VitalPatch[] = [];
  const hr = parseFloat(hidden.vitals.hr.value);
  if (hr > 100) patches.push({ key: "hr", value: String(Math.max(96, Math.round(hr - Math.max(8, (hr - 90) * 0.4)))) });
  const rr = parseFloat(hidden.vitals.rr.value);
  if (rr > 20) patches.push({ key: "rr", value: String(Math.max(20, Math.round(rr - 4))) });
  const spo2 = parseFloat(hidden.vitals.spo2.value);
  if (spo2 > 0 && spo2 < 94) patches.push({ key: "spo2", value: String(Math.min(95, Math.round(spo2 + 2))) });
  applyVitals(hidden, patches);
}

const NIBP_CYCLE_MIN = 15;

/**
 * The attached monitor: any change shows at once, and the cuff also
 * re-measures blood pressure every 15 minutes as time passes.
 */
function monitorTick(hidden: HiddenState): TurnEffect[] {
  if (!hidden.monitored || hidden.status === "deceased") return [];
  const keys = (["hr", "spo2", "rr", "bp"] as VitalKey[]).filter((k) => hidden.shown[k] !== hidden.vitals[k].value);
  if (!keys.includes("bp") && (hidden.nibpAt === undefined || hidden.clock - hidden.nibpAt >= NIBP_CYCLE_MIN)) keys.push("bp");
  if (keys.length === 0) return [];
  for (const k of keys) if (!hidden.measured.includes(k)) hidden.measured.push(k);
  return [{ type: "vitals", readings: keys.map((k) => reading(hidden, k)) }];
}

/** How often the monitor is sampled across a stretch of time: every 5 minutes, sparser over hours and days. */
const sampleStep = (span: number) => (span <= 60 ? 5 : span <= 240 ? 15 : span <= 1440 ? 60 : 360);

/** Moves the clock forward to `to`; an attached monitor updates on the way. */
function passTime(hidden: HiddenState, to: number, step: number, effects: TurnEffect[]) {
  if (hidden.monitored && hidden.status !== "deceased") {
    for (let next = (Math.floor(hidden.clock / step) + 1) * step; next < to; next += step) {
      effects.push({ type: "advance_time", minutes: next - hidden.clock });
      hidden.clock = next;
      effects.push(...monitorTick(hidden));
    }
  }
  if (to > hidden.clock) {
    effects.push({ type: "advance_time", minutes: to - hidden.clock });
    hidden.clock = to;
  }
}

const STATUS_RANK: Record<PatientStatus, number> = {
  recovered: 0, improving: 1, stable: 2, guarded: 3, deteriorating: 4, critical: 5, deceased: 6,
};

function timelineOnce(hidden: HiddenState, key: string, effect: TurnEffect): TurnEffect[] {
  if (hidden.timelineKeys.includes(key)) return [];
  hidden.timelineKeys.push(key);
  return [effect];
}

function patientRole(def: ClinicalCaseDefinition): MessageRole {
  return def.patient.age < 12 ? "attendant" : "patient";
}

const ROUTE_WORD: Partial<Record<DrugRoute, string>> = { PO: "oral", IV: "IV", IM: "IM", SC: "SC", SL: "sublingual", PR: "rectal", TOP: "topical", INH: "inhaled", NEB: "nebulised", IN: "intranasal" };
const FREQ_WORD: Record<string, string> = { OD: "once daily", BD: "twice daily", TDS: "three times daily", QID: "four times daily", HS: "at night", SOS: "as needed", stat: "stat", "once weekly": "once weekly" };

/** Compact order text for the timeline: "Doxycycline 100 mg PO". */
function drugLabel(d: { generic: string; dose?: string; route: DrugRoute; frequency?: string; duration?: string }): string {
  return [d.generic, d.dose, d.route, d.frequency, d.duration ? `× ${d.duration}` : undefined].filter(Boolean).join(" ");
}

/** Readable prescription line: "Doxycycline · 100 mg · oral · once daily · 8 weeks". */
function prescriptionLine(d: { generic: string; dose?: string; route: DrugRoute; frequency?: string; duration?: string }): string {
  const freq = d.frequency ? FREQ_WORD[d.frequency] ?? d.frequency : undefined;
  return [d.generic, d.dose, ROUTE_WORD[d.route] ?? d.route, freq, d.duration].filter(Boolean).join(" · ");
}

/* -------------------------------------------------------------------------- */
/* Time, results and hazards                                                   */
/* -------------------------------------------------------------------------- */

interface ClockEvent {
  at: number;
  order: number;
  run: () => TurnEffect[];
  interrupts: boolean;
}

/**
 * Advances the sim clock to `target`, firing every event on the way:
 * result deliveries, hazard stages, recoveries and omission hazards.
 * When `interruptible`, the advance stops at the first interrupting event.
 */
export function advanceClock(
  def: ClinicalCaseDefinition,
  hidden: HiddenState,
  target: number,
  interruptible: boolean,
): { effects: TurnEffect[]; interrupted: boolean } {
  const effects: TurnEffect[] = [];
  const lib = hazardLibrary(def);
  const step = sampleStep(target - hidden.clock);
  let guard = 0;

  while (hidden.clock < target && guard++ < 200) {
    const events = pendingEvents(def, hidden, lib).filter((e) => e.at <= target).sort((a, b) => a.at - b.at || a.order - b.order);
    const next = events[0];
    if (!next) break;
    const at = Math.max(next.at, hidden.clock);
    if (at > hidden.clock) passTime(hidden, at, step, effects);
    // Fire every event at this instant together.
    const simultaneous = events.filter((e) => Math.max(e.at, hidden.clock) === at);
    let interrupt = false;
    for (const ev of simultaneous) {
      effects.push(...ev.run());
      if (ev.interrupts) interrupt = true;
    }
    if (interrupt && interruptible) return { effects, interrupted: true };
  }
  if (hidden.clock < target) passTime(hidden, target, step, effects);
  return { effects, interrupted: false };
}

function pendingEvents(def: ClinicalCaseDefinition, hidden: HiddenState, lib: Map<string, HazardDefinition>): ClockEvent[] {
  const events: ClockEvent[] = [];

  // Result deliveries, grouped per instant.
  const due = hidden.investigations.filter((i) => !i.delivered);
  const byTime = new Map<number, OrderedInvestigation[]>();
  for (const inv of due) byTime.set(inv.resultAt, [...(byTime.get(inv.resultAt) ?? []), inv]);
  for (const [at, list] of byTime) {
    events.push({
      at, order: 1, interrupts: false,
      run: () => {
        const fx: TurnEffect[] = [];
        for (const inv of list) {
          inv.delivered = true;
          fx.push({ type: "investigation_resulted", instanceId: inv.instanceId, rows: inv.result.rows, report: inv.result.report, media: inv.result.media });
        }
        fx.push({ type: "timeline", label: `${list.map((i) => i.name).join(", ")} resulted`, category: "investigation" });
        fx.push({
          type: "message", role: "system", kind: "finding",
          text: list.length === 1 ? `${list[0]!.name} — result available.` : `Results available: ${list.map((i) => i.name).join(", ")}.`,
          attachmentIds: list.map((i) => i.instanceId),
        });
        return fx;
      },
    });
  }

  // Omission hazards that arm themselves when the clock passes a deadline.
  for (const h of lib.values()) {
    if (!h.omission || hidden.omissionsChecked.includes(h.id) || hidden.hazards.some((a) => a.id === h.id)) continue;
    const { byMinute, preventedBy } = h.omission;
    events.push({
      at: byMinute, order: 0, interrupts: false,
      run: () => {
        hidden.omissionsChecked.push(h.id);
        if (preventedBy.some((tok) => (hidden.actions[tok] ?? []).some((t) => t <= byMinute))) return [];
        hidden.hazards.push({ id: h.id, label: h.label, triggeredAt: byMinute, armedAt: byMinute, trigger: "Definitive management not started in time", stageIdx: -1, recoveryIdx: -1, died: false, responses: [] });
        return [];
      },
    });
  }

  // Response to definitive treatment: a sick patient given the treatment that
  // actually treats the disease improves at once, unless something else is
  // going wrong. Referrals and advice don't count.
  const definitive = def.rubric.definitiveTreatment;
  if (definitive && !hidden.treatmentResponded) {
    const givenAt = definitive.ids
      .filter((id) => {
        const rule = def.therapeutics.find((t) => t.id === id);
        return !rule || (rule.kind !== "referral" && rule.kind !== "counsel");
      })
      .map((id) => hidden.actions[id]?.[0])
      .filter((t): t is number => t !== undefined)
      .sort((a, b) => a - b)[0];
    if (givenAt !== undefined) {
      events.push({
        at: givenAt,
        order: 4,
        interrupts: false,
        run: () => {
          hidden.treatmentResponded = true;
          const troubled = hidden.hazards.some((a) => a.manifestedAt !== undefined && !a.died && (a.rescuedAt === undefined || a.rescue === "too-late"));
          if (troubled || STATUS_RANK[hidden.status] <= STATUS_RANK.stable) return [];
          hidden.status = "improving";
          settleVitals(hidden);
          const response = def.onResponse;
          applyVitals(hidden, response?.vitals);
          for (const [examId, finding] of Object.entries(response?.examFindings ?? {})) if (finding) hidden.examOverrides[examId] = finding;
          if (response?.patientSays) hidden.patientSays = response.patientSays;
          return [
            { type: "patient_status", status: "improving" },
            { type: "timeline", label: "Responding to treatment", category: "status" },
            ...(response?.says ? [{ type: "message", role: patientRole(def), kind: "speech", text: response.says } as const] : []),
          ];
        },
      });
    }
  }

  // Hazard stages and recoveries.
  for (const armed of hidden.hazards) {
    const h = lib.get(armed.id);
    if (!h || armed.died) continue;
    if (armed.rescuedAt === undefined || armed.rescue === "too-late") {
      const stage = h.stages[armed.stageIdx + 1];
      if (stage) {
        events.push({
          at: armed.armedAt + stage.afterMin, order: 2, interrupts: stage.interrupts ?? true,
          run: () => {
            armed.stageIdx += 1;
            armed.manifestedAt ??= hidden.clock;
            if (stage.status === "deceased") armed.died = true;
            return applyStage(hidden, stage);
          },
        });
      }
    } else {
      const stage = h.recovery[armed.recoveryIdx + 1];
      if (stage) {
        events.push({
          at: armed.rescuedAt + stage.afterMin, order: 3, interrupts: false,
          run: () => {
            armed.recoveryIdx += 1;
            const capped: HazardStage = armed.rescue === "partial" && STATUS_RANK[stage.status] < STATUS_RANK.guarded ? { ...stage, status: "guarded" } : stage;
            return applyStage(hidden, capped);
          },
        });
      }
    }
  }
  return events;
}

function applyStage(hidden: HiddenState, stage: HazardStage): TurnEffect[] {
  const fx: TurnEffect[] = [];
  const previous = hidden.status;
  applyVitals(hidden, stage.vitals);
  for (const [examId, finding] of Object.entries(stage.examFindings ?? {})) {
    if (finding) hidden.examOverrides[examId] = finding;
  }
  if (stage.patientSays) hidden.patientSays = stage.patientSays;

  let triage = false;
  if (stage.setting && stage.setting !== hidden.setting) {
    hidden.setting = stage.setting;
    fx.push({ type: "setting", setting: stage.setting });
    fx.push({ type: "timeline", label: stage.setting === "ER" ? "Brought to the emergency department" : `Moved to ${stage.setting}`, category: "status" });
    triage = stage.setting === "ER";
  }

  const worse = STATUS_RANK[stage.status] > STATUS_RANK[previous];
  if (stage.status !== previous) {
    hidden.status = stage.status;
    fx.push({ type: "patient_status", status: stage.status, notice: "Patient status changed." });
    fx.push({ type: "timeline", label: stage.status === "deceased" ? "Patient died" : "Patient status changed", category: "status" });
    if (worse && stage.status !== "deceased") fx.push({ type: "message", role: "system", kind: "status", text: "Patient status changed." });
  }
  if (stage.observation) {
    fx.push({ type: "message", role: stage.observation.role, kind: stage.observation.role === "nurse" || stage.observation.role === "system" ? "status" : "speech", text: stage.observation.text });
  }

  // Monitored patients (and fresh ER arrivals, via triage) show vitals as they change.
  const visible = triage
    ? stage.vitals.map((v) => v.key)
    : hidden.monitored
      ? stage.vitals.map((v) => v.key).filter((k) => ["hr", "bp", "rr", "spo2"].includes(k))
      : [];
  if (visible.length > 0) {
    for (const k of visible) if (!hidden.measured.includes(k)) hidden.measured.push(k);
    fx.push({ type: "vitals", readings: visible.map((k) => reading(hidden, k)) });
  }
  if (stage.status === "deceased") {
    fx.push({ type: "message", role: "system", kind: "status", text: "The patient has died. End the case to review the encounter." });
  }
  return fx;
}

function armHazard(def: ClinicalCaseDefinition, hidden: HiddenState, id: string, trigger: string, prescribed: boolean) {
  if (hidden.hazards.some((h) => h.id === id)) return;
  const h = hazardLibrary(def).get(id);
  if (!h) return;
  const onset = prescribed ? h.prescribedOnsetMin ?? 0 : 0;
  hidden.hazards.push({ id, label: h.label, triggeredAt: hidden.clock, armedAt: hidden.clock + onset, trigger, stageIdx: -1, recoveryIdx: -1, died: false, responses: [] });
}

/** Marks hazards as rescued when their AND-of-ORs rescue condition is met. */
function evaluateRescues(def: ClinicalCaseDefinition, hidden: HiddenState) {
  const lib = hazardLibrary(def);
  for (const armed of hidden.hazards) {
    if (armed.rescuedAt !== undefined || armed.died) continue;
    const h = lib.get(armed.id);
    if (!h) continue;
    const satisfied = h.rescue.every((group) => group.some((tok) => done(hidden, tok, armed.triggeredAt)));
    if (!satisfied) continue;
    const elapsed = hidden.clock - armed.armedAt;
    armed.rescuedAt = hidden.clock;
    armed.rescue = elapsed <= h.fullRecoveryWindowMin ? "full" : elapsed <= h.lastRescueMin ? "partial" : "too-late";
    if (armed.rescue !== "too-late") hidden.patientSays = undefined;
  }
}

function noteResponse(hidden: HiddenState, label: string) {
  for (const h of hidden.hazards) {
    if (h.manifestedAt !== undefined && !h.died && (h.rescuedAt === undefined || hidden.clock <= h.rescuedAt)) {
      h.responses.push(`${describeSpan(Math.max(0, hidden.clock - h.manifestedAt))} after onset — ${label}`);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Patient speech                                                              */
/* -------------------------------------------------------------------------- */

const YES_NO_FALLBACK = ["No, doctor.", "No, nothing like that.", "Not that I've noticed.", "No, I don't think so."];
const OPEN_FALLBACK = ["I'm not sure, doctor.", "I don't really know, doctor.", "Hmm… I can't say, doctor."];

/** The patient's reply to a history intent. Exposed as part of the engine API. */
export function getPatientResponse(def: ClinicalCaseDefinition, hidden: HiddenState, intent: ResolvedIntent, seed: number): { text: string; role: MessageRole } {
  const role = patientRole(def);
  const id = intent.targetId ?? "";
  const entry = def.history.find((h) => h.id === id);
  if (entry) return { text: entry.reply, role: entry.speaker === "attendant" ? "attendant" : role };
  const p = def.patient;
  switch (id) {
    case "identity:age": return { text: role === "attendant" ? `${p.age === 1 ? "One year" : `${p.age} years`} old, doctor.` : `I'm ${p.age}, doctor.`, role };
    case "identity:occupation": return { text: p.occupation ? `${capitalise(p.occupation)}, doctor.` : "I'm at home these days, doctor.", role };
    case "identity:residence": return { text: `${p.city}, doctor.`, role };
    case "identity:name": return { text: p.name ? `${p.name}, doctor.` : "(The patient tells you their name.)", role };
    case "fallback:yesno": return { text: pick(YES_NO_FALLBACK, seed), role };
    default: return { text: pick(OPEN_FALLBACK, seed), role };
  }
}

function howDoYouFeel(def: ClinicalCaseDefinition, hidden: HiddenState): string {
  if (hidden.patientSays) return hidden.patientSays;
  switch (hidden.status) {
    case "improving":
    case "recovered": return "Better than before, doctor.";
    case "guarded": return "A little better, I think.";
    case "deteriorating": return "I'm feeling worse, doctor.";
    case "critical": return "(Too unwell to answer.)";
    case "deceased": return "";
    default: return "About the same, doctor.";
  }
}

/* -------------------------------------------------------------------------- */
/* Treatment quality (follow-up outcome & scoring)                             */
/* -------------------------------------------------------------------------- */

export type TreatmentQuality = "ideal" | "acceptable" | "harmful" | "untreated";

export function treatmentQuality(def: ClinicalCaseDefinition, hidden: HiddenState): TreatmentQuality {
  const harmfulRule = def.therapeutics.some((r) => (r.appropriateness === "harmful" || r.appropriateness === "dangerous") && done(hidden, r.id));
  const harmfulDrug = hidden.drugs.some((d) => d.appropriateness === "harmful" || d.appropriateness === "dangerous" || d.frequencyError);
  const unrescued = hidden.hazards.some((h) => h.rescue !== "full" && h.rescue !== "partial");
  if (harmfulRule || harmfulDrug || unrescued) return "harmful";
  const groups = def.rubric.idealTreatment;
  const satisfied = groups.filter((g) => g.some((id) => done(hidden, id))).length;
  if (groups.length > 0 && satisfied === groups.length) return "ideal";
  const acceptable = def.therapeutics.some((r) => r.appropriateness === "acceptable" && done(hidden, r.id));
  if (satisfied > 0 || acceptable) return "acceptable";
  return "untreated";
}

/* -------------------------------------------------------------------------- */
/* Intent handlers                                                             */
/* -------------------------------------------------------------------------- */

interface TurnContext {
  def: ClinicalCaseDefinition;
  hidden: HiddenState;
  record: ActionRecord;
  /** Investigations sent this turn, for a single acknowledgement line. */
  sent: OrderedInvestigation[];
  stages: EncounterStage[];
  /** One-off notices already shown this turn. */
  notices: string[];
}

const HISTORY_TIMELINE: Partial<Record<FactGroup, string>> = {
  complaint: "Chief complaint obtained",
  past: "Past history obtained",
  medication: "Medication history obtained",
  allergy: "Allergy history obtained",
  family: "Family history obtained",
  social: "Social history obtained",
  diet: "Dietary history obtained",
  sexual: "Sexual history obtained",
  obstetric: "Menstrual & obstetric history obtained",
};

function handleHistory(ctx: TurnContext, intent: ResolvedIntent, index: number): TurnEffect[] {
  const { def, hidden, record } = ctx;
  const fx: TurnEffect[] = [];
  hidden.clock += 1;
  fx.push({ type: "advance_time", minutes: 1 });
  const generated = record.generated?.[String(index)];
  const reply = generated ? { text: generated, role: patientRole(def) } : getPatientResponse(def, hidden, intent, hash(record.id + index));
  fx.push({ type: "message", role: reply.role, kind: "speech", text: reply.text });

  const entry = def.history.find((h) => h.id === intent.targetId);
  if (entry) {
    const first = hidden.history[entry.id] === undefined;
    if (first) hidden.history[entry.id] = hidden.clock;
    fx.push({ type: "fact", group: entry.group, label: entry.label, value: entry.fact ?? entry.reply, abnormal: entry.abnormal });
    if (first) {
      const label = HISTORY_TIMELINE[entry.group] ?? `${entry.label} ${entry.group === "systemic" ? "reviewed" : "assessed"}`;
      fx.push(...timelineOnce(hidden, `hx:${HISTORY_TIMELINE[entry.group] ? entry.group : entry.id}`, { type: "timeline", label, category: "history" }));
    }
  }
  ctx.stages.push("history");
  return fx;
}

function handleVitals(ctx: TurnContext, keysIn: VitalKey[], announce = true): TurnEffect[] {
  const { hidden, def } = ctx;
  let keys = keysIn;
  const fx0: TurnEffect[] = [];
  if (def.track === "phone") {
    const home = def.phoneVitals ?? [];
    const missing = keys.filter((k) => !home.includes(k));
    keys = keys.filter((k) => home.includes(k));
    if (missing.length > 0) {
      const devices = [home.some((k) => k === "bp" || k === "hr") && "a BP machine", home.includes("rbs") && "a sugar machine", home.includes("temp") && "a thermometer", home.includes("spo2") && "a finger oximeter"].filter(Boolean).join(" and ");
      fx0.push({ type: "message", role: "attendant", kind: "speech", text: keys.length ? `We only have ${devices} at home, doctor — I can't check the rest.` : devices ? `We only have ${devices} at home, doctor.` : "We don't have any machines at home, doctor." });
    }
    if (keys.length === 0) return fx0;
  }
  const unique = [...new Set(keys)];
  if (unique.includes("bmi")) unique.push("weight", "height");
  const ordered = [...new Set(unique)];
  const minutes = Math.min(4, ordered.reduce((s, k) => s + vitalDefinition(k).durationMin, 0));
  hidden.clock += minutes;
  const fx: TurnEffect[] = [...fx0, { type: "advance_time", minutes }];
  for (const k of ordered) if (!hidden.measured.includes(k)) hidden.measured.push(k);
  const readings = ordered.map((k) => reading(hidden, k));
  fx.push({ type: "vitals", readings });
  if (announce) {
    const painOnly = ordered.length === 1 && ordered[0] === "pain";
    if (def.track === "phone") {
      fx.push({ type: "message", role: "attendant", kind: "speech", text: `The machine shows ${readings.map((r) => `${vitalDefinition(r.key).label === "Pulse" ? "pulse" : vitalDefinition(r.key).label} ${r.value}`).join(", ")}.` });
    } else if (painOnly) {
      fx.push({ type: "message", role: patientRole(ctx.def), kind: "speech", text: `About ${hidden.vitals.pain.value} out of 10, doctor.` });
    } else {
      fx.push({ type: "message", role: "system", kind: "finding", text: readings.map((r) => `${vitalDefinition(r.key).label} ${r.value}${r.unit ? ` ${r.unit}` : ""}`).join("  ·  ") });
    }
  }
  const labels = ordered.map((k) => vitalDefinition(k).label);
  const label = labels.length > 2 ? "Vitals measured" : `${labels.join(" and ")} measured`;
  fx.push({ type: "timeline", label, category: "monitor" });
  ctx.stages.push("examination");
  return fx;
}

function handleExam(ctx: TurnContext, intent: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const fx: TurnEffect[] = [];
  if (def.track === "phone") {
    if (!ctx.notices.includes("no-exam")) {
      ctx.notices.push("no-exam");
      fx.push({ type: "message", role: "system", kind: "status", text: "You can't examine over the phone — ask the caller to describe it, or arrange to see the patient." });
    }
    return fx;
  }
  const id = intent.targetId ?? "generic";
  const caseEntry = def.exam.find((e) => e.id === id);
  const cat = catalogExam(id);
  const minutes = caseEntry?.durationMin ?? cat?.durationMin ?? 2;
  hidden.clock += minutes;
  fx.push({ type: "advance_time", minutes });

  let label: string;
  let finding: string;
  let abnormal = false;
  let group: FactGroup = "systemic-exam";
  let media: MediaAsset | undefined;

  if (caseEntry) {
    label = caseEntry.label;
    finding = hidden.examOverrides[id] ?? caseEntry.finding;
    abnormal = !!caseEntry.abnormal || hidden.examOverrides[id] !== undefined;
    group = caseEntry.group;
    media = caseEntry.media;
  } else if (cat) {
    label = cat.label;
    group = cat.group;
    if (hidden.examOverrides[id]) {
      finding = hidden.examOverrides[id]!;
      abnormal = true;
    } else if (cat.covers) {
      const parts: string[] = [];
      let anyAbnormal = false;
      for (const sub of cat.covers) {
        const o = def.exam.find((e) => e.id === sub);
        const override = hidden.examOverrides[sub];
        if (override) { parts.push(override); anyAbnormal = true; }
        else if (o) { parts.push(o.finding); if (o.abnormal) anyAbnormal = true; }
        else parts.push(catalogExam(sub)?.finding ?? "");
      }
      const sensorium = hidden.status === "critical" ? "Drowsy, responds to voice." : hidden.status === "deteriorating" ? "Conscious, anxious and uncomfortable." : "Conscious, oriented, comfortable at rest.";
      finding = [sensorium, ...parts.filter(Boolean)].join(" ");
      abnormal = anyAbnormal;
      for (const sub of cat.covers) hidden.exams[sub] ??= hidden.clock;
    } else {
      finding = cat.finding;
    }
  } else {
    label = "Examination";
    finding = "No abnormality detected on that examination.";
  }

  hidden.exams[id] ??= hidden.clock;
  fx.push({ type: "message", role: "system", kind: "finding", text: `${label} — ${finding}`, media });
  if (caseEntry?.patientReaction && !hidden.examOverrides[id]) {
    fx.push({ type: "message", role: patientRole(def), kind: "speech", text: caseEntry.patientReaction });
  }
  fx.push({ type: "fact", group, label, value: caseEntry?.fact && !hidden.examOverrides[id] ? caseEntry.fact : finding, abnormal });
  fx.push({ type: "timeline", label: `${label} examined`, category: "exam" });
  ctx.stages.push("examination");
  return fx;
}

function activeHazardStage(def: ClinicalCaseDefinition, hidden: HiddenState): HazardStage[] {
  const lib = hazardLibrary(def);
  const out: HazardStage[] = [];
  for (const a of hidden.hazards) {
    if (a.stageIdx < 0 || (a.rescuedAt !== undefined && a.rescue !== "too-late")) continue;
    const stage = lib.get(a.id)?.stages[a.stageIdx];
    if (stage) out.push(stage);
  }
  return out;
}

function handleInvestigation(ctx: TurnContext, intent: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const id = intent.targetId ?? "";
  const override = def.investigations.find((i) => i.id === id);
  const cat = catalogInvestigation(id);
  if (!override && !cat) return [];

  // "Show me the ECG again" — re-display an existing result rather than repeating the test.
  if (intent.payload?.reshow) {
    const existing = [...hidden.investigations].reverse().find((i) => i.defId === id);
    if (existing?.delivered) {
      return [{ type: "message", role: "system", kind: "finding", text: `${existing.name} — showing the result again.`, attachmentIds: [existing.instanceId] }];
    }
    if (existing) {
      return [{ type: "message", role: "system", kind: "status", text: `${existing.name} is still pending — about ${Math.max(1, Math.round(existing.resultAt - hidden.clock))} min.` }];
    }
  }

  const testName = override?.short ?? cat?.short ?? override?.name ?? id;
  if (def.track === "phone") {
    if (!ctx.notices.includes("no-tests")) {
      ctx.notices.push("no-tests");
      return [{ type: "message", role: "system", kind: "status", text: "Tests can't be done during a phone call — advise the caller where to go." }];
    }
    return [];
  }
  if (!canPerform(def.level, id, { inCatalog: !!cat, minLevel: override?.minLevel })) {
    hidden.unavailable.push(id);
    return [{ type: "message", role: "system", kind: "status", text: `${testName} isn't available at this ${facilityName(def)}. Decide clinically, or refer.` }];
  }

  const name = override?.short ?? cat?.short ?? override?.name ?? id;
  const category = override?.category ?? cat?.category ?? "lab";
  const turnaround = override?.turnaroundMin ?? cat?.turnaroundMin ?? 30;
  const cost = override?.cost ?? cat?.cost ?? 0;

  // Result composition: catalogue default → case override → time phase → active hazard stage.
  let result: OrderedInvestigation["result"] = cat ? cat.normal({ patient: def.patient, hr: parseInt(hidden.vitals.hr.value, 10) || 78, seed: hash(def.id + id) }) : {};
  if (override && (override.rows || override.report || override.media)) {
    result = { rows: override.rows ?? result.rows, report: override.report ?? result.report, media: override.media ?? result.media };
  }
  if (override?.noMedia) result = { ...result, media: undefined };
  const phase = [...(override?.phases ?? [])].filter((p) => p.fromMin <= hidden.clock).sort((a, b) => b.fromMin - a.fromMin)[0];
  if (phase) result = { rows: phase.rows ?? result.rows, report: phase.report ?? result.report, media: phase.media ?? result.media };
  for (const stage of activeHazardStage(def, hidden)) {
    const o = stage.investigations?.[id];
    if (o) result = { rows: o.rows ?? result.rows, report: o.report ?? result.report, media: o.media ?? result.media };
  }

  hidden.invSeq += 1;
  const inv: OrderedInvestigation = {
    instanceId: `inv-${hidden.invSeq}`,
    defId: id,
    name,
    category,
    orderedAt: hidden.clock,
    resultAt: hidden.clock + turnaround,
    cost,
    delivered: false,
    result,
    priority: override?.priority ?? "unnecessary",
  };
  hidden.investigations.push(inv);
  ctx.sent.push(inv);
  ctx.stages.push("investigation");
  return [{ type: "investigation_ordered", instanceId: inv.instanceId, defId: id, name, category, turnaroundMin: turnaround, cost }];
}

function findDrugRule(def: ClinicalCaseDefinition, drug: FormularyDrug): TherapeuticRule | undefined {
  const drugRules = def.therapeutics.filter((r) => r.kind === "drug");
  return (
    drugRules.find((r) => r.drugIds?.includes(drug.id)) ??
    drugRules.find((r) => r.drugClasses?.some((c) => drug.classes.includes(c as never)))
  );
}

/** A counselling rule about stopping / avoiding this drug, if the case has one. */
function findConcernRule(def: ClinicalCaseDefinition, drug: FormularyDrug | undefined): TherapeuticRule | undefined {
  if (!drug) return undefined;
  return def.therapeutics.find((r) => r.concernsDrugs?.some((x) => x === drug.id || drug.classes.includes(x as never)));
}

function handleDrug(ctx: TurnContext, intent: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const fx: TurnEffect[] = [];
  const drug = intent.targetId ? formularyDrug(intent.targetId) : undefined;
  if (!drug) {
    fx.push({ type: "message", role: hidden.setting === "OPD" ? "system" : "nurse", kind: "action", text: "Which medicine, dose and route?" });
    return fx;
  }
  const p = intent.payload ?? {};
  const mode = (p.mode as "given" | "prescribed") ?? "prescribed";
  if (def.track === "phone" && ["IV", "IM", "SC", "NEB"].includes(String(p.route ?? drug.route))) {
    fx.push({ type: "message", role: "attendant", kind: "speech", text: "Doctor, we can't give injections or drips at home." });
    return fx;
  }
  const route = (p.route as DrugRoute) ?? drug.route;
  const amount = typeof p.amount === "number" ? p.amount : undefined;
  const unit = typeof p.unit === "string" ? p.unit : undefined;
  const dose = (p.dose as string | undefined) ?? drug.dose;
  const frequency = (p.frequency as string | undefined) ?? (mode === "prescribed" ? drug.frequency : "stat");
  const duration = p.duration as string | undefined;
  const volumeMl = drug.fluid ? (typeof p.volumeMl === "number" ? p.volumeMl : drug.id === "prbc" ? 350 : 500) : undefined;

  const minutes = mode === "given" ? (route === "IV" || route === "IM" || route === "NEB" ? 3 : 1) : 1;
  hidden.clock += minutes;
  fx.push({ type: "advance_time", minutes });

  const rule = findDrugRule(def, drug);
  const appropriateness: Appropriateness = rule?.appropriateness ?? (drug.classes.includes("fluid") && mode === "given" ? "neutral" : "unnecessary");
  let doseError = false;
  if (rule?.doseRange && amount !== undefined && (!unit || unit === rule.doseRange.unit)) {
    doseError = amount < rule.doseRange.min || amount > rule.doseRange.max;
  }
  const frequencyError = !!(rule?.wrongFrequencies && frequency && rule.wrongFrequencies.some((f) => f.toLowerCase() === frequency.toLowerCase()));

  if (drug.fluid && route === "IV" && mode === "given") hidden.fluidMl += volumeMl ?? 0;

  const given: GivenDrug = {
    drugId: drug.id, generic: drug.generic, brand: drug.brands[0], classes: drug.classes, at: hidden.clock,
    mode, route, dose, amount, unit, frequency, duration, volumeMl, ruleId: rule?.id, appropriateness, doseError, frequencyError,
  };
  hidden.drugs.push(given);
  record(hidden, `drug:${drug.id}`);
  if (rule) record(hidden, rule.id);
  if (appropriateness !== "unnecessary" && appropriateness !== "neutral") hidden.firstTreatmentAt ??= hidden.clock;

  fx.push({ type: "drug", drug: { generic: drug.generic, brand: drug.brands[0], dose: dose ?? "", route, frequency, duration, mode } });
  const label = drugLabel({ generic: drug.generic, dose, route, frequency: mode === "prescribed" ? frequency : undefined, duration });
  if (mode === "given" && def.track === "phone") {
    const pronoun = def.patient.sex === "Female" ? "she's" : def.patient.sex === "Male" ? "he's" : "they're";
    fx.push({ type: "message", role: "attendant", kind: "speech", text: `Okay, doctor — ${pronoun} taking the ${drug.generic.toLowerCase()} now.` });
  } else if (mode === "given") {
    const verb = route === "IV" && drug.fluid ? "running" : route === "NEB" ? "nebulisation started" : "given";
    fx.push({ type: "message", role: "nurse", kind: "action", text: `${drug.generic}${dose ? ` ${dose}` : ""} ${route} — ${verb}.` });
  } else {
    fx.push({ type: "message", role: "system", kind: "action", text: `Prescribed — ${prescriptionLine({ generic: drug.generic, dose, route, frequency, duration })}` });
  }
  fx.push({ type: "timeline", label: `${drug.generic}${dose ? ` ${dose}` : ""} ${route} ${mode === "given" ? "given" : "prescribed"}`, category: "treatment" });
  for (const r of rule?.response ?? []) fx.push({ type: "message", role: r.role, kind: r.kind, text: r.text });

  // Consequences.
  const snap = {
    fluidMl: hidden.fluidMl,
    recentOpioidMme: hidden.drugs.filter((d) => d.classes.includes("opioid") && d.mode === "given" && hidden.clock - d.at <= 60).reduce((s, d) => s + morphineEquivalent(d.drugId, d.amount, d.unit), 0),
    rbs: parseFloat(hidden.vitals.rbs.value) || 100,
    drugIds: hidden.drugs.map((d) => d.drugId),
    age: def.patient.age,
  };
  const prescribed = mode === "prescribed";
  for (const hz of globalTriggers(def, { drug, mode, route, frequency, amount, unit, volumeMl }, snap)) {
    armHazard(def, hidden, hz, label, prescribed);
  }
  if (rule?.arms) {
    const h = hazardLibrary(def).get(rule.arms);
    const cond = h?.condition;
    const fluidOk = !cond?.minFluidMl || hidden.fluidMl > cond.minFluidMl;
    const freqOk = !cond?.frequencyAnyOf || (!!frequency && cond.frequencyAnyOf.some((f) => f.toLowerCase() === frequency.toLowerCase()));
    if (fluidOk && freqOk) armHazard(def, hidden, rule.arms, label, prescribed);
  }
  if (rule?.vitalsAfter) applyVitals(hidden, rule.vitalsAfter);
  if (rule?.statusAfter && STATUS_RANK[rule.statusAfter] !== STATUS_RANK[hidden.status]) {
    hidden.status = rule.statusAfter;
    fx.push({ type: "patient_status", status: rule.statusAfter });
  }
  noteResponse(hidden, `${label} ${mode}`);
  evaluateRescues(def, hidden);
  ctx.stages.push("treatment");
  return fx;
}

function handleRule(ctx: TurnContext, rule: TherapeuticRule, intent?: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const fx: TurnEffect[] = [];

  // A rule built on catalogue measures (monitor, admit, oxygen…) performs the measure itself,
  // then adds the case-specific consequences.
  if (rule.measureIds?.length) {
    record(hidden, rule.id);
    if (rule.appropriateness === "ideal" || rule.appropriateness === "acceptable") hidden.firstTreatmentAt ??= hidden.clock;
    for (const m of rule.measureIds) fx.push(...handleMeasure(ctx, m, intent ?? { kind: "action", targetId: `measure:${m}`, phrase: rule.label, matched: true }));
    if (rule.kind === "discharge") hidden.discharged = true;
    for (const r of rule.response ?? []) fx.push({ type: "message", role: r.role, kind: r.kind, text: r.text });
    if (rule.settingAfter && rule.settingAfter !== hidden.setting) {
      hidden.setting = rule.settingAfter;
      fx.push({ type: "setting", setting: rule.settingAfter });
    }
    if (rule.vitalsAfter) applyVitals(hidden, rule.vitalsAfter);
    if (rule.statusAfter && rule.statusAfter !== hidden.status) {
      hidden.status = rule.statusAfter;
      fx.push({ type: "patient_status", status: rule.statusAfter });
    }
    if (rule.arms) armHazard(def, hidden, rule.arms, rule.label, false);
    evaluateRescues(def, hidden);
    return fx;
  }

  const minutes = rule.durationMin ?? (rule.kind === "procedure" ? 45 : rule.kind === "counsel" ? 3 : 2);
  record(hidden, rule.id);
  for (const m of rule.measureIds ?? []) record(hidden, `measure:${m}`);
  hidden.clock += minutes;
  fx.push({ type: "advance_time", minutes });
  if (rule.appropriateness === "ideal" || rule.appropriateness === "acceptable") hidden.firstTreatmentAt ??= hidden.clock;

  switch (rule.kind) {
    case "procedure": {
      const complicated = rule.altNote && hidden.hazards.some((h) => h.id === rule.altNote!.ifHazard && h.manifestedAt !== undefined);
      const note = complicated ? rule.altNote!.note : rule.note;
      fx.push({ type: "procedure", name: rule.label, note });
      fx.push({ type: "message", role: "system", kind: "finding", text: note ? `${rule.label}. ${note}` : `${rule.label} — done.` });
      fx.push({ type: "timeline", label: `${rule.label} performed`, category: "procedure" });
      break;
    }
    case "counsel":
      hidden.counselling.push(rule.label);
      fx.push({ type: "timeline", label: `Counselled — ${rule.label.toLowerCase()}`, category: "treatment" });
      if (!rule.response?.length) fx.push({ type: "message", role: patientRole(def), kind: "speech", text: "Okay, doctor. I'll do that." });
      break;
    case "admit":
      fx.push({ type: "timeline", label: rule.label, category: "status" });
      if (!rule.response?.length) fx.push({ type: "message", role: "system", kind: "action", text: `${rule.label}.` });
      break;
    case "discharge":
      hidden.discharged = true;
      fx.push({ type: "timeline", label: rule.label, category: "status" });
      if (!rule.response?.length) fx.push({ type: "message", role: "system", kind: "action", text: `${rule.label}.` });
      break;
    case "referral":
      fx.push({ type: "timeline", label: rule.label, category: "treatment" });
      if (!rule.response?.length) fx.push({ type: "message", role: "system", kind: "action", text: `${rule.label} — referral sent.` });
      break;
    default:
      fx.push({ type: "timeline", label: rule.label, category: "treatment" });
      if (!rule.response?.length) fx.push({ type: "message", role: hidden.setting === "OPD" ? "system" : "nurse", kind: "action", text: `${rule.label} — done.` });
  }
  for (const r of rule.response ?? []) fx.push({ type: "message", role: r.role, kind: r.kind, text: r.text });
  if (rule.settingAfter && rule.settingAfter !== hidden.setting) {
    hidden.setting = rule.settingAfter;
    fx.push({ type: "setting", setting: rule.settingAfter });
  }
  if (rule.vitalsAfter) applyVitals(hidden, rule.vitalsAfter);
  if (rule.statusAfter && rule.statusAfter !== hidden.status) {
    hidden.status = rule.statusAfter;
    fx.push({ type: "patient_status", status: rule.statusAfter });
  }
  if (rule.arms) armHazard(def, hidden, rule.arms, rule.label, false);
  noteResponse(hidden, rule.label);
  evaluateRescues(def, hidden);
  ctx.stages.push("treatment");
  return fx;
}

function handleMeasure(ctx: TurnContext, measureId: string, intent: ResolvedIntent): TurnEffect[] {
  const { hidden } = ctx;
  const m = catalogMeasure(measureId);
  if (!m) return [];
  const fx: TurnEffect[] = [];
  record(hidden, `measure:${m.id}`);
  hidden.clock += m.durationMin;
  if (m.durationMin > 0) fx.push({ type: "advance_time", minutes: m.durationMin });
  const actor: MessageRole = hidden.setting === "OPD" ? "system" : "nurse";

  switch (m.id) {
    case "monitor": {
      if (!hidden.monitored) {
        hidden.monitored = true;
        fx.push({ type: "monitoring", on: true, rhythm: monitorRhythm(ctx.def) });
        fx.push({ type: "timeline", label: "Continuous monitoring started", category: "monitor" });
      }
      const keys: VitalKey[] = ["hr", "bp", "rr", "spo2"];
      for (const k of keys) if (!hidden.measured.includes(k)) hidden.measured.push(k);
      fx.push({ type: "vitals", readings: keys.map((k) => reading(hidden, k)) });
      fx.push({ type: "message", role: actor, kind: "action", text: "Multipara monitor attached — ECG, SpO₂ and NIBP." });
      break;
    }
    case "oxygen":
    case "niv": {
      const spo2 = parseFloat(hidden.vitals.spo2.value);
      const gain = m.id === "niv" ? 6 : 4;
      if (spo2 < 95 && spo2 > 0) applyVitals(hidden, [{ key: "spo2", value: String(Math.min(97, Math.round(spo2 + gain))) }]);
      fx.push({ type: "message", role: actor, kind: "action", text: m.id === "niv" ? "BiPAP started via full-face mask." : "Oxygen started via face mask at 6 L/min." });
      fx.push({ type: "timeline", label: m.label, category: "treatment" });
      break;
    }
    case "admit": {
      const icu = /\bicu|intensive\b/i.test(intent.phrase);
      const setting: CareSetting = icu ? "ICU" : "IPD";
      if (hidden.setting !== setting) {
        hidden.setting = setting;
        fx.push({ type: "setting", setting });
      }
      if (icu && !hidden.monitored) { hidden.monitored = true; fx.push({ type: "monitoring", on: true, rhythm: monitorRhythm(ctx.def) }); }
      fx.push({ type: "message", role: "system", kind: "action", text: icu ? "Admitted to the ICU." : "Admitted to the ward." });
      fx.push({ type: "timeline", label: icu ? "Admitted to ICU" : "Admitted", category: "status" });
      break;
    }
    case "discharge":
      hidden.discharged = true;
      fx.push({ type: "message", role: "system", kind: "action", text: "Discharged home." });
      fx.push({ type: "timeline", label: "Discharged", category: "status" });
      break;
    case "refer":
      fx.push({ type: "message", role: "system", kind: "action", text: "Referral sent." });
      fx.push({ type: "timeline", label: "Referral made", category: "treatment" });
      break;
    case "stop-drug": {
      const drugId = intent.payload?.drugId as string | undefined;
      const drug = drugId ? formularyDrug(drugId) : undefined;
      if (drugId) record(hidden, `stop:${drugId}`);
      const concern = findConcernRule(ctx.def, drug);
      if (concern) {
        fx.push(...handleRule(ctx, concern));
        break;
      }
      fx.push({ type: "message", role: actor, kind: "action", text: drug ? `${drug.generic} withheld.` : "Medication withheld." });
      fx.push({ type: "timeline", label: drug ? `${drug.generic} stopped` : "Medication stopped", category: "treatment" });
      break;
    }
    case "stop-fluids":
      fx.push({ type: "message", role: actor, kind: "action", text: "IV fluids stopped." });
      fx.push({ type: "timeline", label: "IV fluids stopped", category: "treatment" });
      break;
    case "cpr":
      if (hidden.status === "deceased") {
        fx.push({ type: "message", role: "nurse", kind: "status", text: "CPR continued for 20 minutes per ACLS. No return of spontaneous circulation." });
      } else {
        fx.push({ type: "message", role: "nurse", kind: "action", text: "The patient has a pulse — CPR is not indicated." });
      }
      fx.push({ type: "timeline", label: "Resuscitation", category: "procedure" });
      break;
    default:
      fx.push({ type: "message", role: actor, kind: "action", text: m.note });
      fx.push({ type: "timeline", label: m.label, category: m.kind === "procedure" ? "procedure" : "treatment" });
  }
  noteResponse(hidden, m.label);
  evaluateRescues(ctx.def, hidden);
  ctx.stages.push("treatment");
  return fx;
}

function handleAction(ctx: TurnContext, intent: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const id = intent.targetId ?? "";
  if (id.startsWith("measure:")) return handleMeasure(ctx, id.slice("measure:".length), intent);
  const rule = def.therapeutics.find((r) => r.id === id);
  if (rule) return handleRule(ctx, rule, intent);

  if (id === "counsel:avoid") {
    const avoidRule = findConcernRule(def, formularyDrug(String(intent.payload?.drugId ?? "")));
    if (avoidRule) return handleRule(ctx, avoidRule);
    hidden.clock += 1;
    hidden.counselling.push(intent.phrase);
    return [
      { type: "advance_time", minutes: 1 },
      { type: "message", role: patientRole(def), kind: "speech", text: "Okay, doctor. I'll avoid it." },
      { type: "timeline", label: "Counselled", category: "treatment" },
    ];
  }
  if (id === "counsel:generic") {
    hidden.clock += 3;
    hidden.counselling.push(intent.phrase);
    ctx.stages.push("treatment");
    return [
      { type: "advance_time", minutes: 3 },
      { type: "message", role: patientRole(def), kind: "speech", text: "Okay, doctor. I understand." },
      { type: "timeline", label: "Counselling", category: "treatment" },
    ];
  }
  // Unrecognised procedure — still executed, as ordered.
  hidden.clock += 20;
  record(hidden, "procedure:generic");
  ctx.stages.push("treatment");
  const name = capitalise(intent.phrase.replace(/^(please |kindly )?(perform|do|plan|schedule|arrange|proceed with|undergo)\s+(an?\s+)?/i, "").replace(/[.\s]+$/, ""));
  return [
    { type: "advance_time", minutes: 20 },
    { type: "procedure", name, note: "Performed as ordered." },
    { type: "message", role: "system", kind: "finding", text: `${name} — performed as ordered.` },
    { type: "timeline", label: `${name} performed`, category: "procedure" },
  ];
}

function handleFollowUp(ctx: TurnContext, days: number): TurnEffect[] {
  const { def, hidden } = ctx;
  const fx: TurnEffect[] = [];
  const span = days * 1440;
  hidden.followUps.push({ at: hidden.clock, days });
  fx.push({ type: "timeline", label: `Follow-up planned — ${describeSpan(span)}`, category: "followup" });
  fx.push({ type: "message", role: "system", kind: "action", text: `Follow-up booked in ${describeSpan(span)}.` });
  ctx.stages.push("followup");

  const advance = advanceClock(def, hidden, hidden.clock + span, true);
  fx.push(...advance.effects);
  if (advance.interrupted || hidden.status === "deceased") return fx;

  // The follow-up visit itself.
  const quality = treatmentQuality(def, hidden);
  const scenario = def.followUp.find((s) => s.when === quality) ?? def.followUp.find((s) => s.when === "any");
  const visitNo = hidden.followUps.length;
  if (hidden.setting !== "OPD" && def.setting === "OPD") {
    hidden.setting = "OPD";
    fx.push({ type: "setting", setting: "OPD" });
  }
  fx.push({ type: "message", role: "system", kind: "status", text: `Follow-up visit · ${describeSpan(span)} later` });
  fx.push({ type: "timeline", label: `Follow-up visit — ${describeSpan(span)}`, category: "followup" });
  if (scenario && visitNo === 1) {
    for (const line of scenario.lines) fx.push({ type: "message", role: line.role, kind: line.kind, text: line.text, media: line.media });
    applyVitals(hidden, scenario.vitals);
    for (const f of scenario.facts ?? []) fx.push({ type: "fact", group: f.group, label: f.label, value: f.value, abnormal: f.abnormal });
    if (scenario.status !== hidden.status) {
      hidden.status = scenario.status;
      fx.push({ type: "patient_status", status: scenario.status });
    }
  } else if (scenario) {
    fx.push({ type: "message", role: patientRole(def), kind: "speech", text: quality === "ideal" || quality === "acceptable" ? "I've continued everything as you said, doctor. It's about the same as last time." : "Honestly, doctor, it's no better." });
  }
  return fx;
}

function handleWait(ctx: TurnContext, intent: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  let minutes = typeof intent.payload?.minutes === "number" ? intent.payload.minutes : 15;
  if (intent.payload?.untilResults) {
    const pending = hidden.investigations.filter((i) => !i.delivered).map((i) => i.resultAt);
    if (pending.length === 0) {
      return [{ type: "message", role: "system", kind: "status", text: "No results are pending." }];
    }
    minutes = Math.max(1, Math.min(...pending) - hidden.clock);
  }
  const before = hidden.clock;
  const advance = advanceClock(def, hidden, hidden.clock + minutes, true);
  const elapsed = hidden.clock - before;
  const fx: TurnEffect[] = [];
  if (elapsed >= 2 && !intent.payload?.untilResults) fx.push({ type: "message", role: "system", kind: "status", text: `${describeSpan(elapsed)} later` });
  fx.push(...advance.effects);
  fx.push({ type: "timeline", label: `Observed for ${describeSpan(elapsed)}`, category: "monitor" });
  return fx;
}

function handleReassess(ctx: TurnContext): TurnEffect[] {
  const { def, hidden } = ctx;
  hidden.reassessments.push(hidden.clock);
  const keys = hidden.measured.filter((k) => !["height", "weight", "bmi"].includes(k));
  const fx = handleVitals(ctx, keys.length ? keys : ROUTINE_VITALS, true);
  const feel = howDoYouFeel(def, hidden);
  if (feel) fx.push({ type: "message", role: patientRole(def), kind: "speech", text: feel });
  fx.push({ type: "timeline", label: "Patient reassessed", category: "monitor" });
  noteResponse(hidden, "Reassessed");
  return fx;
}

/* -------------------------------------------------------------------------- */
/* Turn                                                                        */
/* -------------------------------------------------------------------------- */

const SIGNIFICANT: ResolvedIntent["kind"][] = ["history", "vitals", "exam", "investigation", "drug", "action", "followup", "reassess", "diagnosis", "differential", "wait"];

export function runTurn(def: ClinicalCaseDefinition, hidden: HiddenState, record: ActionRecord): TurnEffect[] {
  const fx: TurnEffect[] = [];
  const ctx: TurnContext = { def, hidden, record, sent: [], stages: [], notices: [] };
  const conversational = record.intents.some((i) => i.kind === "history" || i.kind === "greeting" || (i.kind === "unknown" && i.payload?.question));
  fx.push({ type: "message", role: "doctor", kind: conversational ? "speech" : "action", text: record.raw.trim() });

  if (hidden.closed) return fx;
  if (record.intents.some((i) => i.matched && SIGNIFICANT.includes(i.kind))) hidden.actionCount += 1;

  // Several vitals in one instruction are one measurement ("Check BP and RBS").
  const vitalKeys = record.intents.filter((i) => i.kind === "vitals").flatMap((i) => (i.targetId ?? "").split(",").filter(Boolean)) as VitalKey[];
  let vitalsDone = false;
  record.intents.forEach((intent, index) => {
    if (hidden.status === "deceased" && !["diagnosis", "differential", "close"].includes(intent.kind) && !(intent.kind === "action" && intent.targetId === "measure:cpr")) {
      if (!fx.some((e) => e.type === "message" && e.text.startsWith("The patient has died"))) {
        fx.push({ type: "message", role: "system", kind: "status", text: "The patient has died. End the case to review the encounter." });
      }
      return;
    }
    switch (intent.kind) {
      case "greeting":
        hidden.clock += 0.5;
        fx.push({ type: "advance_time", minutes: 0.5 });
        fx.push({ type: "message", role: patientRole(def), kind: "speech", text: pick(def.arrivalMinuteOfDay < 720 ? ["Good morning, doctor.", "Namaste, doctor."] : ["Namaste, doctor.", "Hello, doctor."], hash(record.id)) });
        break;
      case "history":
        fx.push(...handleHistory(ctx, intent, index));
        break;
      case "vitals":
        if (!vitalsDone) fx.push(...handleVitals(ctx, vitalKeys));
        vitalsDone = true;
        break;
      case "exam":
        fx.push(...handleExam(ctx, intent));
        break;
      case "investigation":
        fx.push(...handleInvestigation(ctx, intent));
        break;
      case "drug":
        fx.push(...handleDrug(ctx, intent));
        break;
      case "action":
        fx.push(...handleAction(ctx, intent));
        break;
      case "followup":
        fx.push(...handleFollowUp(ctx, typeof intent.payload?.days === "number" ? intent.payload.days : 7));
        break;
      case "wait":
        fx.push(...handleWait(ctx, intent));
        break;
      case "reassess":
        fx.push(...handleReassess(ctx));
        break;
      case "diagnosis": {
        const text = String(intent.payload?.text ?? "").trim();
        if (!text) break;
        hidden.diagnosis = { text, at: hidden.clock };
        fx.push({ type: "working_diagnosis", diagnosis: text });
        fx.push({ type: "message", role: "system", kind: "action", text: `Working diagnosis recorded — ${text}.` });
        fx.push({ type: "timeline", label: "Working diagnosis recorded", detail: text, category: "history" });
        ctx.stages.push("diagnosis");
        break;
      }
      case "differential": {
        const list = String(intent.payload?.text ?? "").split(";").map((x) => x.trim()).filter(Boolean);
        hidden.differentials = list;
        fx.push({ type: "working_diagnosis", differentials: list });
        fx.push({ type: "message", role: "system", kind: "action", text: `Differentials recorded — ${list.join(", ")}.` });
        fx.push({ type: "timeline", label: "Differentials recorded", category: "history" });
        ctx.stages.push("diagnosis");
        break;
      }
      case "close":
        hidden.closed = true;
        hidden.closedAt = hidden.clock;
        fx.push({ type: "timeline", label: "Case closed", category: "closure" });
        fx.push({ type: "case_status", status: "complete" });
        break;
      case "unknown":
        hidden.unrecognised += 1;
        fx.push(
          intent.payload?.question
            ? { type: "message", role: patientRole(def), kind: "speech", text: "Sorry, doctor — I didn't quite follow." }
            : { type: "message", role: "system", kind: "status", text: "Instruction not recognised. Rephrase it, or use the shortcuts under the message box." },
        );
        break;
    }
  });

  // One acknowledgement for everything sent to the lab or imaging this turn.
  if (ctx.sent.length > 0) {
    fx.push({ type: "timeline", label: `${ctx.sent.map((i) => i.name).join(", ")} ordered`, category: "investigation" });
    const quick = ctx.sent.filter((i) => i.resultAt - i.orderedAt <= 15 && (i.category === "bedside" || i.category === "ecg"));
    const slow = ctx.sent.filter((i) => !quick.includes(i));
    if (slow.length > 0) {
      fx.push({ type: "message", role: "system", kind: "action", text: `Sent — ${slow.map((i) => i.name).join(", ")}.` });
    }
    if (quick.length > 0 && !hidden.closed) {
      const until = Math.max(...quick.map((i) => i.resultAt));
      fx.push(...advanceClock(def, hidden, until, false).effects);
    }
  }

  // Fire anything that fell due this turn — including a response to treatment just given.
  if (!hidden.closed) fx.push(...catchUp(def, hidden));
  // The attached monitor shows where the patient is now.
  if (!hidden.closed) fx.push(...monitorTick(hidden));

  const stage = ctx.stages[ctx.stages.length - 1];
  if (stage) fx.push({ type: "stage", stage });
  return fx;
}

/** Fires events that fell due while a handler moved the clock forward. */
function catchUp(def: ClinicalCaseDefinition, hidden: HiddenState): TurnEffect[] {
  const target = hidden.clock;
  const effects: TurnEffect[] = [];
  const lib = hazardLibrary(def);
  let guard = 0;
  while (guard++ < 100) {
    const due = pendingEvents(def, hidden, lib).filter((e) => e.at <= target).sort((a, b) => a.at - b.at || a.order - b.order);
    const next = due[0];
    if (!next) break;
    const simultaneous = due.filter((e) => e.at === next.at);
    for (const ev of simultaneous) effects.push(...ev.run());
  }
  return effects;
}
