/**
 * The clinical simulator — a deterministic state machine.
 *
 *   hidden state  +  ActionRecord  →  TurnEffect[]  (and a mutated hidden state)
 *
 * `HiddenState` is server-only. It is never serialised to the client; the
 * server rebuilds it by replaying the sealed action log, so every function in
 * this file must be deterministic for a given (definition, records) pair.
 */

import { LISTEN_SOURCE, listen, signsAbnormal, withoutSounds, type ListenPart } from "./auscultation";
import { catalogExam, catalogInvestigation, catalogMeasure, defaultVitals, flagVital, ROUTINE_VITALS, vitalDefinition } from "./catalog";
import type { ClinicalCaseDefinition, HazardDefinition, HazardStage, TherapeuticRule, Appropriateness } from "./case-definition";
import { formularyDrug, type FormularyDrug } from "./formulary";
import { canPerform, LEVELS } from "./levels";
import { doseMultiple, drugFeeling, kineticsFor, profileFor, withDrugEffects, type ActingDrug, type EffectKey, type Trouble } from "./pharmacology";
import { globalTriggers, hazardLibrary, morphineEquivalent } from "./physiology";
import { capitalise, describeSpan, hash, pick } from "./text";
import type {
  ActionRecord,
  Auscultation,
  CareSetting,
  DermSpec,
  DrugRoute,
  EcgSpec,
  EncounterStage,
  FactGroup,
  InvestigationCategory,
  LabRow,
  MediaAsset,
  MediaSpec,
  MessageRole,
  PatientStatus,
  PictureType,
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
  /** How many usual doses this was (1 = the usual dose). */
  multiple?: number;
  /** Minutes it was given over, when the order said. */
  overMin?: number;
  /** Its effects are played out by a toxicity hazard rather than the drug-effect layer. */
  toxic?: boolean;
  /** Vitals whose change the case itself wrote for this drug (scheduled, not added again) — "all" for the case's definitive treatment, whose response it wrote. */
  authored?: EffectKey[] | "all";
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
  /** What the stethoscope picked up each time the player listened — for the debrief, never for the encounter. */
  heard: { part: ListenPart; text: string; at: number }[];
  patientSays?: string;
  investigations: OrderedInvestigation[];
  invSeq: number;
  /** Tests requested that the facility could not perform. */
  unavailable: string[];
  drugs: GivenDrug[];
  /** Times each rule / "measure:x" / "drug:x" / "stop:x" token was executed. */
  actions: Record<string, number[]>;
  fluidMl: number;
  /** Changes a treatment brings, due when it has had time to act. */
  scheduled: { at: number; patches: VitalPatch[]; status?: PatientStatus }[];
  /** Treatments being watched: the nurse reports what changed once each has had time to act. */
  watches: Watch[];
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
    heard: [],
    investigations: [],
    invSeq: 0,
    unavailable: [],
    drugs: [],
    actions: {},
    fluidMl: 0,
    scheduled: [],
    watches: [],
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
/* Watching a treatment act                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A treatment given, and what the patient was like just before it. When its
 * checks fall due (the drug's onset, then its peak), whoever is with the
 * patient says what changed — unasked. Nobody has to ask "what happened?".
 */
export interface Watch {
  label: string;
  drugId?: string;
  /** When it went in. */
  at: number;
  /** When to look again (absolute minutes); the last one says "no change" if nothing moved. */
  checks: number[];
  reported: number;
  /** The vitals the nurse rechecks, as they were just before. */
  before: Partial<Record<VitalKey, string>>;
  status: PatientStatus;
}

const WATCH_NAMES: Partial<Record<VitalKey, string>> = { hr: "pulse", bp: "BP", rr: "breathing", spo2: "SpO₂", temp: "temperature", rbs: "sugar", gcs: "GCS", pain: "pain score", urine: "urine output" };
const WATCH_UNITS: Partial<Record<VitalKey, string>> = { hr: "/min", rr: "/min", spo2: "%", temp: " °F", rbs: " mg/dL", pain: "/10", urine: " mL/h" };
/** How much a reading has to move to be worth saying. */
const WATCH_MIN: Partial<Record<VitalKey, number>> = { hr: 4, bp: 6, rr: 2, spo2: 1, temp: 0.4, rbs: 15, gcs: 1, pain: 1, urine: 10 };

const EFFECT_VITAL: Record<EffectKey, VitalKey> = { hr: "hr", sbp: "bp", dbp: "bp", rr: "rr", spo2: "spo2", temp: "temp", rbs: "rbs", gcs: "gcs", pain: "pain", urine: "urine" };

function moved(key: VitalKey, from: string | undefined, to: string): boolean {
  if (from === undefined || from === to) return false;
  const a = from.split("/").map(parseFloat);
  const b = to.split("/").map(parseFloat);
  if (a.some((x) => !Number.isFinite(x)) || b.some((x) => !Number.isFinite(x))) return from !== to;
  return a.some((x, i) => Math.abs(x - (b[i] ?? x)) >= (WATCH_MIN[key] ?? 1));
}

/** Starts watching a treatment: which vitals to recheck (those already measured, and those it acts on) and when. */
function watch(hidden: HiddenState, w: { label: string; drugId?: string; at: number; checks: number[]; keys: VitalKey[] }) {
  const now = vitalsNow(hidden);
  const keys = [...new Set([...hidden.measured, ...w.keys])].filter((k) => k in WATCH_NAMES && now[k]?.value);
  const checks = [...new Set(w.checks.map((c) => Math.max(w.at, Math.round(c))))].sort((a, b) => a - b);
  hidden.watches.push({ label: w.label, drugId: w.drugId, at: w.at, checks, reported: 0, before: Object.fromEntries(keys.map((k) => [k, now[k].value])), status: hidden.status });
}

/** What changed since each watched treatment, for those whose time to look has come. */
function watchReports(def: ClinicalCaseDefinition, hidden: HiddenState): TurnEffect[] {
  if (hidden.closed || hidden.status === "deceased") return [];
  const fx: TurnEffect[] = [];
  const he = def.patient.sex === "Female" ? "she" : def.patient.sex === "Male" ? "he" : "they";
  const phone = def.track === "phone";
  for (const w of hidden.watches) {
    const due = w.checks.filter((c) => c <= hidden.clock).length;
    if (due <= w.reported) continue;
    w.reported = due;
    const last = due === w.checks.length;
    const now = vitalsNow(hidden);
    const changed = phone ? [] : (Object.keys(w.before) as VitalKey[]).filter((k) => moved(k, w.before[k], now[k].value));
    const acting = w.drugId ? actingDrugs(hidden).filter((d) => d.drugId === w.drugId && d.at === w.at) : [];
    const feel = acting.length ? drugFeeling(acting, troublesOf(def, hidden), hidden.clock) : undefined;
    const better = STATUS_RANK[hidden.status] < STATUS_RANK[w.status];
    const worse = STATUS_RANK[hidden.status] > STATUS_RANK[w.status];
    if (!changed.length && !feel && !better && !worse && !last) continue;
    const span = describeSpan(Math.max(1, hidden.clock - w.at));
    const parts = changed.map((k) => `${WATCH_NAMES[k]} ${w.before[k]} → ${now[k].value}${WATCH_UNITS[k] ?? ""}`);
    const course = better ? ` ${capitalise(he)} looks better.` : worse ? ` ${capitalise(he)} looks worse.` : "";
    const says = feel ? ` ${capitalise(he)} says: "${feel}"` : "";
    const text = parts.length || course || says
      ? `${span} after the ${w.label}:${parts.length ? ` ${parts.join(", ")}.` : ""}${course}${says}`
      : `${span} after the ${w.label} — no change in ${he === "they" ? "them" : he === "she" ? "her" : "him"} so far.`;
    if (changed.length) {
      for (const k of changed) if (!hidden.measured.includes(k)) hidden.measured.push(k);
      fx.push({ type: "vitals", readings: changed.map((k) => reading(hidden, k)) });
    }
    fx.push({ type: "message", role: phone ? "attendant" : "nurse", kind: "speech", text: text.replace(/\s+/g, " ").trim() });
  }
  return fx;
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
  def.opening.forEach((beat, i) => {
    fx.push({ type: "message", role: beat.role, kind: beat.kind, text: beat.text, media: openingMedia(i, beat.media) });
  });
  if (hidden.monitored) fx.push({ type: "monitoring", on: true, rhythm: monitorRhythm(def) });
  if (hidden.status !== "stable") fx.push({ type: "patient_status", status: hidden.status });
  return fx;
}

/* -------------------------------------------------------------------------- */
/* Small helpers                                                               */
/* -------------------------------------------------------------------------- */

/** The drugs given, as the effect layer reads them. */
function actingDrugs(hidden: HiddenState): ActingDrug[] {
  return hidden.drugs.map((d) => ({ drugId: d.drugId, at: d.at, route: d.route, mode: d.mode, multiple: d.multiple ?? 1, overMin: d.overMin, skip: d.toxic ? "all" : d.authored }));
}

/** The vitals as they are this minute: the patient's own course (the illness, the case's hazards) moved by every drug acting now. */
export function vitalsNow(hidden: HiddenState): Record<VitalKey, VitalPatch> {
  return hidden.status === "deceased" || hidden.drugs.length === 0 ? hidden.vitals : withDrugEffects(hidden.vitals, actingDrugs(hidden), hidden.clock);
}

/** A vital as shown to the player — remembered as shown, so the monitor only redraws what changed. */
function reading(hidden: HiddenState, key: VitalKey): VitalPatch {
  const v = vitalsNow(hidden)[key];
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

/** Halfway between a vital now and where a treatment takes it ("140/90" → "130/85"); null when it can't be read. */
function midway(from: VitalPatch | undefined, to: VitalPatch): VitalPatch | null {
  if (!from) return null;
  const nums = (s: string) => s.split("/").map((x) => parseFloat(x));
  const a = nums(from.value), b = nums(to.value);
  if (a.length !== b.length || a.some((x) => !Number.isFinite(x)) || b.some((x) => !Number.isFinite(x))) return null;
  const decimals = (to.value.split("/")[0]!.split(".")[1] ?? "").length;
  return { key: to.key, value: a.map((x, i) => ((x + b[i]!) / 2).toFixed(decimals)).join("/") };
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
 * The attached monitor: pulse, saturation and breathing are continuous, so
 * any change shows at once; the cuff measures blood pressure every 15 minutes
 * (a sudden turn of events shows its own readings as it happens).
 */
function monitorTick(hidden: HiddenState): TurnEffect[] {
  if (!hidden.monitored || hidden.status === "deceased") return [];
  const now = vitalsNow(hidden);
  const keys = (["hr", "spo2", "rr"] as VitalKey[]).filter((k) => hidden.shown[k] !== now[k].value);
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
          fx.push({ type: "investigation_resulted", instanceId: inv.instanceId, rows: inv.result.rows, report: inv.result.report, media: readableMedia(inv) });
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
      // A drug needs time to act: the response comes at its peak (an hour and a half at most); a procedure has taken its time already.
      const first = definitive.ids.find((id) => hidden.actions[id]?.[0] === givenAt);
      const drug = first ? hidden.drugs.find((d) => d.ruleId === first && d.mode === "given") : undefined;
      const fd = drug && formularyDrug(drug.drugId);
      const delay = def.guided || !fd ? 0 : Math.min(90, Math.max(drug!.overMin ?? 0, kineticsFor(fd, drug!.route).peak));
      events.push({
        at: givenAt + delay,
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

  // A treatment's effects, as they come on.
  for (const s of hidden.scheduled) {
    events.push({
      at: s.at, order: 2.5, interrupts: false,
      run: () => {
        hidden.scheduled = hidden.scheduled.filter((x) => x !== s);
        if (hidden.status === "deceased") return [];
        applyVitals(hidden, s.patches);
        if (!s.status || s.status === hidden.status) return [];
        hidden.status = s.status;
        return [{ type: "patient_status", status: s.status }];
      },
    });
  }

  // Hazard stages and recoveries — none once the patient has died.
  if (hidden.status === "deceased") return events;
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
            return applyStage(def, hidden, stage);
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
            return applyStage(def, hidden, capped);
          },
        });
      }
    }
  }
  return events;
}

function applyStage(def: ClinicalCaseDefinition, hidden: HiddenState, stage: HazardStage): TurnEffect[] {
  const fx: TurnEffect[] = [];
  const previous = hidden.status;
  // A patient turning critical in hospital goes on the monitor — the nurse sees to it, so every change shows from here.
  if (!hidden.monitored && stage.status === "critical" && !["OPD", "Teleconsult"].includes(hidden.setting) && def.track !== "phone") {
    hidden.monitored = true;
    fx.push({ type: "monitoring", on: true, rhythm: monitorRhythm(def) });
    fx.push({ type: "message", role: "nurse", kind: "action", text: "I've put the patient on the monitor, doctor." });
  }
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
    // A change is noticed through the nurse, the family or the monitor; the generic notice is only for when none of them says anything.
    if (worse && stage.status !== "deceased" && !stage.observation) fx.push({ type: "message", role: "system", kind: "status", text: "Patient status changed." });
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

/** Arms a hazard; its stages count from `from` (the moment a drug went in), or from now. */
function armHazard(def: ClinicalCaseDefinition, hidden: HiddenState, id: string, trigger: string, prescribed: boolean, from = hidden.clock) {
  if (hidden.hazards.some((h) => h.id === id)) return;
  const h = hazardLibrary(def).get(id);
  if (!h) return;
  const onset = prescribed ? h.prescribedOnsetMin ?? 0 : 0;
  hidden.hazards.push({ id, label: h.label, triggeredAt: from, armedAt: from + onset, trigger, stageIdx: -1, recoveryIdx: -1, died: false, responses: [] });
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
    case "identity:feeling": {
      // Too unwell to answer: the nurse says how they are, with what the monitor shows.
      if (hidden.status === "critical" || hidden.status === "deceased") {
        const he = def.patient.sex === "Female" ? "she" : def.patient.sex === "Male" ? "he" : "they";
        if (hidden.status === "deceased") return { text: `Doctor, ${he}'s gone — no pulse.`, role: "nurse" };
        const how = hidden.patientSays?.match(/^\((.+)\)$/)?.[1]?.replace(/\.$/, "").toLowerCase();
        const v = vitalsNow(hidden);
        const monitor = hidden.monitored ? ` Saturation ${v.spo2.value}, BP ${v.bp.value}, pulse ${v.hr.value}.` : "";
        return { text: `Doctor, ${he}'s critical${how ? ` — ${how}` : ""}.${monitor}`, role: "nurse" };
      }
      return { text: howDoYouFeel(def, hidden) || "(No response.)", role };
    }
    case "fallback:yesno": return { text: pick(YES_NO_FALLBACK, seed), role };
    default: return { text: pick(OPEN_FALLBACK, seed), role };
  }
}

/** What troubled the patient, from the case — so a drug's relief is mentioned only if it relieves something they had. */
function troublesOf(def: ClinicalCaseDefinition, hidden: HiddenState): Set<Trouble> {
  const text = [def.briefing, ...def.opening.map((o) => o.text), ...def.history.filter((h) => h.group === "complaint" || h.abnormal).map((h) => `${h.label} ${h.reply}`)].join(" ").toLowerCase();
  const out = new Set<Trouble>(["urine"]);
  if (/pain|ache|hurt|cramp|colic|burning|tender/.test(text)) out.add("pain");
  if (/fever|temperature|chills|rigor/.test(text) || parseFloat(hidden.vitals.temp.value) > 99.5) out.add("fever");
  if (/breath|wheez|cough|chest tight|gasp/.test(text) || parseFloat(hidden.vitals.rr.value) > 22) out.add("breathing");
  if (/vomit|nausea|retch|queasy/.test(text)) out.add("nausea");
  if (/itch|prurit|hives|urticaria/.test(text)) out.add("itch");
  return out;
}

function howDoYouFeel(def: ClinicalCaseDefinition, hidden: HiddenState): string {
  if (hidden.patientSays) return hidden.patientSays;
  // A drug acting on what troubled them is what they notice first — unless they're getting worse.
  if (STATUS_RANK[hidden.status] <= STATUS_RANK.guarded) {
    const relief = drugFeeling(actingDrugs(hidden), troublesOf(def, hidden), hidden.clock);
    if (relief) return relief;
  }
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
  const entry = def.history.find((h) => h.id === intent.targetId);
  const attendant = entry ? entry.speaker === "attendant" : intent.payload?.speaker === "attendant";
  const reply = generated ? { text: generated, role: attendant ? ("attendant" as const) : patientRole(def) } : getPatientResponse(def, hidden, intent, hash(record.id + index));
  fx.push({ type: "message", role: reply.role, kind: "speech", text: reply.text });

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
      fx.push({ type: "message", role: patientRole(ctx.def), kind: "speech", text: `About ${vitalsNow(hidden).pain.value} out of 10, doctor.` });
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
  let sounds: Auscultation[] | undefined;
  let stethoscope: ListenPart[] | undefined;
  const body = () => {
    const rhythm = monitorRhythm(def);
    const now = vitalsNow(hidden);
    return { hr: parseFloat(now.hr?.value ?? "") || 80, rr: parseFloat(now.rr?.value ?? "") || 16, irregular: rhythm === "afib" || /irregular/i.test(systemFinding(def, hidden, "cvs")) };
  };

  if (caseEntry) {
    label = caseEntry.label;
    finding = hidden.examOverrides[id] ?? caseEntry.finding;
    abnormal = !!caseEntry.abnormal || hidden.examOverrides[id] !== undefined;
    group = caseEntry.group;
    media = examMedia(id, caseEntry.media, caseEntry.label);
  } else if (cat) {
    label = cat.label;
    group = cat.group;
    if (hidden.examOverrides[id]) {
      finding = hidden.examOverrides[id]!;
      abnormal = true;
    } else if (cat.listen) {
      // The stethoscope, and nothing else: no words for what's heard — the player listens and decides.
      const parts: ListenPart[] = cat.listen === "all" ? ["heart", "lungs"] : [cat.listen];
      const now = body();
      const heard = parts.map((part) => {
        const source = LISTEN_SOURCE[part];
        hidden.exams[source] ??= hidden.clock;
        return listen(part, systemFinding(def, hidden, source), now);
      });
      for (const h of heard) hidden.heard.push({ part: h.part, text: h.text, at: hidden.clock });
      finding = parts.length > 1 ? "Stethoscope over the heart, then the chest — listen." : `Stethoscope over the ${parts[0] === "heart" ? "heart" : parts[0] === "lungs" ? "chest" : "abdomen"} — listen.`;
      abnormal = false;
      sounds = heard.map((h) => h.sound);
      stethoscope = parts;
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

  let factValue = caseEntry?.fact && !hidden.examOverrides[id] ? caseEntry.fact : finding;
  // A whole system's examination: what's seen and felt in words, what's heard only through the stethoscope.
  const part = SOUND_PART[id];
  if (part) {
    const heard = listen(part, finding, body());
    hidden.heard.push({ part, text: heard.text, at: hidden.clock });
    finding = withoutSounds(finding, part);
    factValue = withoutSounds(factValue, part);
    abnormal = abnormal && signsAbnormal(finding);
    sounds = [heard.sound];
    stethoscope = [part];
  }
  if (stethoscope) factValue = part ? factValue : "Listened with the stethoscope.";

  hidden.exams[id] ??= hidden.clock;
  fx.push({ type: "message", role: "system", kind: "finding", text: `${label} — ${finding}`, media, ...(stethoscope ? { stethoscope, sounds } : {}) });
  if (caseEntry?.patientReaction && !hidden.examOverrides[id]) {
    fx.push({ type: "message", role: patientRole(def), kind: "speech", text: caseEntry.patientReaction });
  }
  fx.push({ type: "fact", group, label, value: factValue, abnormal });
  fx.push({ type: "timeline", label: `${label} examined`, category: "exam" });
  ctx.stages.push("examination");
  return fx;
}

/* -------------------------------------------------------------------------- */
/* Pictures the doctor reads for themselves                                    */
/* -------------------------------------------------------------------------- */

/** What kind of picture a test makes — from its drawn spec, or its id and name. */
export function pictureTypeFor(id: string, name: string, spec?: MediaSpec): PictureType | null {
  if (spec && spec.kind !== "ecg" && spec.kind !== "derm") return spec.kind;
  const s = `${id} ${name}`.toLowerCase();
  if (/\b(usg|ultrasound|sonograph\w*|echo\w*|doppler|e?fast)\b/.test(s)) return "usg";
  if (/\b(mri|mrcp|mra)\b/.test(s)) return "mri";
  if (/\b(ct|cect|ncct|hrct|ctpa|cta)\b/.test(s)) return "ct";
  if (/\b(x-?ray|xray|cxr|axr|radiograph\w*|kub)\b/.test(s)) return "xray";
  if (/\bfundus|fundoscop/.test(s)) return "fundus";
  if (/\b(endoscop\w*|colonoscop\w*|ugie|ogd|bronchoscop\w*)\b/.test(s)) return "endoscopy";
  return null;
}

/**
 * A scan as the doctor receives it: a realistic picture drawn from this very
 * result (the case's own picture when it has one). The drawn spec stays as a
 * fallback; the report waits until they open it.
 */
function readableMedia(inv: OrderedInvestigation): MediaAsset | undefined {
  const media = inv.result.media;
  if (media?.ai || inv.category !== "imaging") return media;
  const type = pictureTypeFor(inv.defId, inv.name, media?.spec);
  if (!type) return media;
  const spec = media?.spec && media.spec.kind !== "ecg" && media.spec.kind !== "derm" ? media.spec : undefined;
  return { ...media, ai: { ref: `i-${inv.instanceId}`, type, view: spec?.view ?? inv.name }, alt: media?.alt ?? inv.name };
}

/** What the image model draws for an imaging result: exactly its report (or the drawn findings), for this patient. */
export function imagingPicture(def: ClinicalCaseDefinition, inv: OrderedInvestigation): { type: PictureType; view: string; describe: string } | null {
  const ai = readableMedia(inv)?.ai;
  if (!ai || ai.ref !== `i-${inv.instanceId}`) return null;
  const spec = inv.result.media?.spec;
  const drawn = spec && spec.kind !== "ecg" && spec.kind !== "derm" ? spec.features.filter((f) => f.id !== "normal").map((f) => `${f.id.replace(/-/g, " ")}${f.side ? ` (${f.side})` : ""}${f.severity ? `, ${["mild", "moderate", "severe"][f.severity - 1]}` : ""}`) : [];
  const findings = inv.result.report?.trim() || (drawn.length ? drawn.join("; ") : "A normal study: no abnormality.");
  return { type: ai.type, view: ai.view, describe: `${inv.name} of a ${def.patient.age}-year-old ${def.patient.sex.toLowerCase()}. It must show exactly this, and nothing else abnormal: ${findings}` };
}

/** A written case's skin finding, photographed: drawn from the examination's own words. Never the genitals or breasts. */
function examMedia(id: string, media: MediaAsset | undefined, label: string): MediaAsset | undefined {
  if (!media || media.ai || media.spec?.kind !== "derm" || id === "genital" || id === "breast") return media;
  return { ...media, ai: { ref: `e-${id}`, type: "photo", view: label } };
}

/** A written case's opening photograph (the nurse's picture at presentation): a real photograph, not a drawing. */
function openingMedia(index: number, media: MediaAsset | undefined): MediaAsset | undefined {
  if (!media || media.ai || media.spec?.kind !== "derm") return media;
  return { ...media, ai: { ref: `o-${index}`, type: "photo", view: media.caption ?? media.spec.site } };
}

/** What the image model draws (or a real image must show) for a written case's opening photograph. */
export function openingPicture(def: ClinicalCaseDefinition, ref: string): { type: PictureType; view: string; describe: string } | null {
  const index = Number(ref.slice(2));
  const beat = def.opening[index];
  if (!beat || !openingMedia(index, beat.media)?.ai) return null;
  const spec = beat.media!.spec as DermSpec;
  const lesions = spec.lesions.map((l) => `${l.count} ${l.morphology.replace(/-/g, " ")}${l.region ? ` (${l.region})` : ""}`).join(", ");
  const skinExam = def.exam.find((e) => e.media?.spec?.kind === "derm")?.finding;
  return {
    type: "photo",
    view: beat.media!.caption ?? spec.site,
    describe: `Close-up clinical photograph of the ${spec.site} of a ${def.patient.age}-year-old ${def.patient.sex.toLowerCase()} with ${SKIN[spec.phototype - 1]} skin (Fitzpatrick ${spec.phototype}), showing the typical appearance of ${def.truth.diagnosis}.${skinExam ? ` What it shows: ${skinExam}` : ""} Lesions: ${lesions}.`,
  };
}

const SKIN = ["very fair", "fair", "light brown", "brown", "dark brown", "deeply pigmented"] as const;

/** What the image model draws for a written case's skin photograph — once that examination has been done. */
export function examPicture(def: ClinicalCaseDefinition, hidden: HiddenState, ref: string): { type: PictureType; view: string; describe: string } | null {
  const id = ref.slice(2);
  const entry = def.exam.find((e) => e.id === id);
  if (!entry || hidden.exams[id] === undefined || !examMedia(id, entry.media, entry.label)?.ai) return null;
  const spec = entry.media!.spec as DermSpec;
  const lesions = spec.lesions.map((l) => `${l.count} ${l.morphology.replace(/-/g, " ")}${l.region ? ` (${l.region})` : ""}`).join(", ");
  return {
    type: "photo",
    view: `${entry.label} — ${spec.site}`,
    describe: `Close-up clinical photograph of the ${spec.site} of a ${def.patient.age}-year-old ${def.patient.sex.toLowerCase()} with ${SKIN[spec.phototype - 1]} skin (Fitzpatrick ${spec.phototype}). What it shows: ${hidden.examOverrides[id] ?? entry.finding} Lesions: ${lesions}.`,
  };
}

/** The system examinations whose findings include something the stethoscope picks up. */
const SOUND_PART: Partial<Record<string, ListenPart>> = { cvs: "heart", rs: "lungs", abdomen: "bowel" };

/** A system examination's finding as it stands now: a later stage's version, the case's own, or the normal one. */
export function systemFinding(def: ClinicalCaseDefinition, hidden: HiddenState, examId: string): string {
  return hidden.examOverrides[examId] ?? def.exam.find((e) => e.id === examId)?.finding ?? catalogExam(examId)?.finding ?? "";
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

/** "Result of the test?" — the results that are back (shown again), and anything still pending. */
function handleResults(ctx: TurnContext): TurnEffect[] {
  const { hidden } = ctx;
  const ordered = hidden.investigations;
  if (ordered.length === 0) return [{ type: "message", role: "system", kind: "status", text: "No tests have been ordered yet." }];
  const fx: TurnEffect[] = [];
  const ready = ordered.filter((i) => i.delivered).slice(-4);
  const pending = ordered.filter((i) => !i.delivered);
  if (ready.length > 0) {
    fx.push({ type: "message", role: "system", kind: "finding", text: ready.length === 1 ? `${ready[0]!.name} — result.` : `Results: ${ready.map((i) => i.name).join(", ")}.`, attachmentIds: ready.map((i) => i.instanceId) });
  }
  if (pending.length > 0) {
    const left = (i: OrderedInvestigation) => Math.max(1, Math.round(i.resultAt - hidden.clock));
    fx.push({ type: "message", role: "system", kind: "status", text: `Still pending: ${pending.map((i) => `${i.name} — about ${left(i)} min`).join(", ")}.` });
  }
  return fx;
}

/** Results arrive the moment a test is ordered — no waiting for the lab (a product decision). */
const INSTANT_RESULTS = true;

/** "Repeat the lipase", "check it again": a fresh sample, even when the test was only just done. */
const REPEAT_RE = /\b(repeat|again|recheck|re check|re do|redo|serial|another|once more|fresh sample)\b/i;
/** A test done this recently is shown again rather than sent twice (and charged twice). */
const RECENT_MIN = 30;

/** Analytes compared loosely: "S. lipase", "Serum lipase" and "Lipase" are one. */
const analyteKey = (s: string) => s.toLowerCase().replace(/^(?:serum|plasma|blood|s\.?)\s+/, "").replace(/[^a-z0-9]+/g, "");

/**
 * Values this patient already has for each analyte — from tests resulted in
 * this encounter (latest first), then the case's own results under other
 * tests' names (a "Lipase" row in its pancreatic panel). One patient, one value.
 */
function knownValues(def: ClinicalCaseDefinition, hidden: HiddenState): Map<string, LabRow> {
  const known = new Map<string, LabRow>();
  for (const inv of [...hidden.investigations].reverse()) for (const r of inv.result.rows ?? []) if (!known.has(analyteKey(r.analyte))) known.set(analyteKey(r.analyte), r);
  for (const inv of def.investigations) for (const r of inv.rows ?? []) if (!known.has(analyteKey(r.analyte))) known.set(analyteKey(r.analyte), r);
  return known;
}

/** What a test reports when the case has no word on it: the catalogue's normal result for this patient. */
function catalogueResult(def: ClinicalCaseDefinition, hidden: HiddenState, id: string): OrderedInvestigation["result"] {
  const cat = catalogInvestigation(id);
  return cat ? cat.normal({ patient: def.patient, hr: parseInt(vitalsNow(hidden).hr.value, 10) || 78, seed: hash(def.id + id) }) : {};
}

/**
 * What the case didn't write for a test about to be ordered: analytes it has
 * no value for anywhere, or a scan with no report. The model fills these in
 * before the turn runs, consistent with the patient (stored with the action,
 * so the case replays exactly); without it, the normal result stands.
 */
export function labGap(def: ClinicalCaseDefinition, hidden: HiddenState, id: string, phrase = ""): { id: string; name: string; analytes: LabRow[]; report: boolean } | null {
  const cat = catalogInvestigation(id);
  const override = def.investigations.find((i) => i.id === id);
  if (!cat && !override) return null;
  // Nothing to write for a test that won't be done: on the phone, beyond this facility, or just done.
  if (def.track === "phone" || !canPerform(def.level, id, { inCatalog: !!cat, minLevel: override?.minLevel })) return null;
  const prior = [...hidden.investigations].reverse().find((i) => i.defId === id);
  if (prior && !REPEAT_RE.test(phrase) && (!prior.delivered || hidden.clock - prior.resultAt < RECENT_MIN)) return null;
  const normal = catalogueResult(def, hidden, id);
  const name = override?.name ?? cat?.name ?? id;
  const written = new Set((override?.rows ?? []).map((r) => analyteKey(r.analyte)));
  const known = knownValues(def, hidden);
  const analytes = override?.report || override?.media ? [] : (normal.rows ?? []).filter((r) => !written.has(analyteKey(r.analyte)) && !known.has(analyteKey(r.analyte)));
  const report = !override && !!normal.report && !normal.rows?.length;
  return analytes.length || report ? { id, name, analytes, report } : null;
}

/** The model's values for what the case didn't write: `{ rows, report }`, kept on the action under `lab:<test>`. */
function generatedResult(record: ActionRecord, id: string): { rows?: LabRow[]; report?: string } | null {
  const raw = record.generated?.[`lab:${id}`];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { rows?: LabRow[]; report?: string };
  } catch {
    return null;
  }
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
      // Asked for the report in words: it's read out (a picture's report is otherwise behind "Show report").
      if (intent.payload?.report && existing.result.report) {
        return [{ type: "message", role: "system", kind: "finding", text: `${existing.name} report — ${existing.result.report}`, attachmentIds: [existing.instanceId] }];
      }
      return [{ type: "message", role: "system", kind: "finding", text: `${existing.name} — showing the result again.`, attachmentIds: [existing.instanceId] }];
    }
    if (existing) {
      return [{ type: "message", role: "system", kind: "status", text: `${existing.name} is still pending — about ${Math.max(1, Math.round(existing.resultAt - hidden.clock))} min.` }];
    }
  }

  const testName = override?.short ?? cat?.short ?? override?.name ?? id;

  // Just done: shown again, not sent (or charged) twice — unless the doctor asks for a repeat.
  const prior = [...hidden.investigations].reverse().find((i) => i.defId === id);
  if (prior && !REPEAT_RE.test(intent.phrase) && !intent.payload?.repeat) {
    if (!prior.delivered) return [{ type: "message", role: "system", kind: "status", text: `${prior.name} is already sent — about ${Math.max(1, Math.round(prior.resultAt - hidden.clock))} min.` }];
    const ago = Math.round(hidden.clock - prior.resultAt);
    if (ago < RECENT_MIN) {
      return [{ type: "message", role: "system", kind: "finding", text: `${prior.name} was done ${ago < 1 ? "just now" : `${ago} min ago`} — here it is again. Say "repeat ${prior.name.toLowerCase()}" for a fresh sample.`, attachmentIds: [prior.instanceId] }];
    }
  }

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
  const turnaround = INSTANT_RESULTS ? 0 : (override?.turnaroundMin ?? cat?.turnaroundMin ?? 30);
  const cost = override?.cost ?? cat?.cost ?? 0;

  // Result composition: catalogue default → values the patient already has → the model's, for what the case didn't write → case override → time phase → active hazard stage.
  let result: OrderedInvestigation["result"] = catalogueResult(def, hidden, id);
  const known = knownValues(def, hidden);
  const generated = generatedResult(ctx.record, id);
  const authored = new Map((override?.rows ?? []).map((r) => [analyteKey(r.analyte), r] as const));
  if (result.rows) {
    result = {
      ...result,
      rows: result.rows.map((r) => {
        const k = analyteKey(r.analyte);
        return authored.get(k) ?? known.get(k) ?? generated?.rows?.find((g) => analyteKey(g.analyte) === k) ?? r;
      }),
    };
  }
  if (!override && generated?.report) result = { ...result, report: generated.report };
  if (override && (override.rows || override.report || override.media)) {
    // The case's own rows lead; any analyte the panel reports that the case left out follows.
    const extra = (result.rows ?? []).filter((r) => !authored.has(analyteKey(r.analyte)));
    result = { rows: override.rows ? [...override.rows, ...(override.report || override.media ? [] : extra)] : result.rows, report: override.report ?? result.report, media: override.media ?? result.media };
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
    fx.push({ type: "message", role: "system", kind: "action", text: "Which medicine, dose and route?" });
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
  // When it went in: what it does counts from here, though giving it takes a few minutes.
  const startedAt = hidden.clock;
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
  // How much it is (ten litres is twenty bags) and how fast — the drug-effect layer and the toxicity hazards both read it.
  const weightKg = parseFloat(hidden.vitals.weight.value) || 60;
  const multiple = doseMultiple(drug, { amount, unit, volumeMl }, weightKg);
  const overMin = typeof p.overMin === "number" && p.overMin > 0 ? p.overMin : undefined;

  const given: GivenDrug = {
    drugId: drug.id, generic: drug.generic, brand: drug.brands[0], classes: drug.classes, at: hidden.clock,
    mode, route, dose, amount, unit, frequency, duration, volumeMl, multiple, overMin,
    authored: rule && def.rubric.definitiveTreatment?.ids.includes(rule.id) ? "all" : rule?.vitalsAfter?.flatMap((v): EffectKey[] => (v.key === "bp" ? ["sbp", "dbp"] : [v.key as EffectKey])),
    ruleId: rule?.id, appropriateness, doseError, frequencyError,
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
    const k = kineticsFor(drug, route);
    const full = Math.max(k.peak, overMinOf(p) ?? 0);
    fx.push({ type: "message", role: "system", kind: "action", text: `${drug.generic}${dose ? ` ${dose}` : ""} ${route} — ${verb}. ${k.onset <= minutes ? "Starting to act" : `Starts to act in about ${describeSpan(k.onset)}`}, full effect by about ${describeSpan(full)} — what changes will be reported.` });
  } else {
    fx.push({ type: "message", role: "system", kind: "action", text: `Prescribed — ${prescriptionLine({ generic: drug.generic, dose, route, frequency, duration })}` });
  }
  fx.push({ type: "timeline", label: `${drug.generic}${dose ? ` ${dose}` : ""} ${route} ${mode === "given" ? "given" : "prescribed"}`, category: "treatment" });
  for (const r of rule?.response ?? []) fx.push({ type: "message", role: r.role, kind: r.kind, text: r.text });

  // Consequences.
  const snap = {
    fluidMl: hidden.fluidMl,
    recentOpioidMme: hidden.drugs.filter((d) => d.classes.includes("opioid") && d.mode === "given" && hidden.clock - d.at <= 60).reduce((s, d) => s + morphineEquivalent(d.drugId, d.amount, d.unit), 0),
    rbs: parseFloat(vitalsNow(hidden).rbs.value) || 100,
    drugIds: hidden.drugs.map((d) => d.drugId),
    age: def.patient.age,
    recentFluidMl: hidden.drugs.filter((d) => d.classes.includes("fluid") && d.route === "IV" && d.mode === "given" && hidden.clock - d.at <= 60).reduce((s, d) => s + (d.volumeMl ?? 0), 0),
    arrested: hidden.status === "deceased",
  };
  const prescribed = mode === "prescribed";
  const triggered = globalTriggers(def, { drug, mode, route, frequency, amount, unit, volumeMl, multiple, overMin }, snap);
  for (const hz of triggered) armHazard(def, hidden, hz, label, prescribed, startedAt);
  // What this order does to the patient is now that hazard's course — not the drug's usual effect as well.
  if (triggered.length > 0) given.toxic = true;
  if (rule?.arms) {
    const h = hazardLibrary(def).get(rule.arms);
    const cond = h?.condition;
    const fluidOk = !cond?.minFluidMl || hidden.fluidMl > cond.minFluidMl;
    const freqOk = !cond?.frequencyAnyOf || (!!frequency && cond.frequencyAnyOf.some((f) => f.toLowerCase() === frequency.toLowerCase()));
    if (fluidOk && freqOk) armHazard(def, hidden, rule.arms, label, prescribed);
  }
  // What the case says this treatment does, once it has had time to act: partway by its onset, fully by its peak.
  // (The guided demo responds at once, as scripted.)
  if (def.guided || mode === "prescribed") {
    if (rule?.vitalsAfter) applyVitals(hidden, rule.vitalsAfter);
    if (rule?.statusAfter && STATUS_RANK[rule.statusAfter] !== STATUS_RANK[hidden.status]) {
      hidden.status = rule.statusAfter;
      fx.push({ type: "patient_status", status: rule.statusAfter });
    }
  } else if (rule?.vitalsAfter || rule?.statusAfter) {
    const k = kineticsFor(drug, route);
    const peak = Math.max(1, overMin ?? 0, k.peak);
    if (rule.vitalsAfter) {
      const halfway = rule.vitalsAfter.map((v) => midway(hidden.vitals[v.key], v)).filter((v): v is VitalPatch => v !== null);
      if (halfway.length) hidden.scheduled.push({ at: hidden.clock + Math.min(k.onset, peak), patches: halfway });
    }
    hidden.scheduled.push({ at: hidden.clock + peak, patches: rule.vitalsAfter ?? [], status: rule.statusAfter });
  }
  // Watched from when it went in: at its onset and its peak, what changed is said.
  if (mode === "given") {
    const k = kineticsFor(drug, route);
    const peak = Math.max(k.peak, overMin ?? 0);
    const acts = Object.keys(profileFor(drug)?.effects ?? {}).map((e) => EFFECT_VITAL[e as EffectKey]);
    const authored = (rule?.vitalsAfter ?? []).map((v) => v.key);
    watch(hidden, { label: `${drug.generic.toLowerCase()}${dose ? ` ${dose}` : ""} ${route}`, drugId: drug.id, at: startedAt, checks: [startedAt + Math.min(k.onset, peak), startedAt + peak], keys: [...acts, ...authored] });
    if (startedAt + peak > hidden.clock) fx.push({ type: "watching", label: drug.generic, until: startedAt + peak });
  }
  noteResponse(hidden, `${label} ${mode}`);
  evaluateRescues(def, hidden);
  ctx.stages.push("treatment");
  return fx;
}

const overMinOf = (p: Record<string, unknown>) => (typeof p.overMin === "number" && p.overMin > 0 ? p.overMin : undefined);

function handleRule(ctx: TurnContext, rule: TherapeuticRule, intent?: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const fx: TurnEffect[] = [];
  // A treatment the case says changes the patient: what changed is reported when it's done.
  if (rule.vitalsAfter?.length || rule.statusAfter) {
    watch(hidden, { label: rule.label.toLowerCase(), at: hidden.clock, checks: [hidden.clock], keys: (rule.vitalsAfter ?? []).map((v) => v.key) });
  }

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
      if (!rule.response?.length) fx.push({ type: "message", role: "system", kind: "action", text: `${rule.label} — done.` });
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
  // Routine orders are logged quietly; the nurse speaks up only when something's wrong.
  const actor: MessageRole = "system";

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
      watch(hidden, { label: m.id === "niv" ? "BiPAP" : "oxygen", at: hidden.clock, checks: [hidden.clock], keys: ["spo2"] });
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
        fx.push({ type: "message", role: "system", kind: "status", text: "CPR continued for 20 minutes per ACLS. No return of spontaneous circulation." });
      } else {
        fx.push({ type: "message", role: "system", kind: "action", text: "The patient has a pulse — CPR is not indicated." });
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
  const silent = intent.payload?.silent === true;
  if (!silent && elapsed >= 2 && !intent.payload?.untilResults) fx.push({ type: "message", role: "system", kind: "status", text: `${describeSpan(elapsed)} later` });
  fx.push(...advance.effects);
  if (!silent) fx.push({ type: "timeline", label: `Observed for ${describeSpan(elapsed)}`, category: "monitor" });
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

/** When nothing could make sense of an instruction (the model unreachable too), the nurse asks — never an error line. */
const NURSE_UNSURE = ["Sorry, doctor — what would you like me to do?", "Doctor, could you say that once more? I want to get it right."] as const;

/** A real-time tick: the clock running on its own, recorded so replays stay exact. */
export const isTick = (record: ActionRecord) => record.raw === "" && record.intents.length === 1 && record.intents[0]!.kind === "wait" && record.intents[0]!.payload?.silent === true;

const SIGNIFICANT: ResolvedIntent["kind"][] = ["history", "vitals", "exam", "investigation", "drug", "action", "followup", "reassess", "diagnosis", "differential", "wait"];

export function runTurn(def: ClinicalCaseDefinition, hidden: HiddenState, record: ActionRecord): TurnEffect[] {
  const fx: TurnEffect[] = [];
  const ctx: TurnContext = { def, hidden, record, sent: [], stages: [], notices: [] };
  const conversational = record.intents.some((i) => i.kind === "history" || i.kind === "greeting" || (i.kind === "unknown" && (i.payload?.question || i.payload?.speaker === "patient" || i.payload?.speaker === "attendant")));
  // A real-time tick has no words: time passes without the doctor saying anything.
  const tick = isTick(record);
  if (!tick) fx.push({ type: "message", role: "doctor", kind: conversational ? "speech" : "action", text: record.raw.trim() });

  if (hidden.closed) return fx;
  if (!tick && record.intents.some((i) => i.matched && SIGNIFICANT.includes(i.kind))) hidden.actionCount += 1;

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
      case "results":
        fx.push(...handleResults(ctx));
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
      case "unknown": {
        hidden.unrecognised += 1;
        // The model's answer, when it wrote one: whoever in the room would reply.
        const said = record.generated?.[String(index)];
        const speaker = intent.payload?.speaker;
        const role: MessageRole = speaker === "nurse" && def.track !== "phone" ? "nurse" : speaker === "attendant" ? "attendant" : patientRole(def);
        fx.push(
          intent.payload?.empty
            ? { type: "message", role: "system", kind: "status", text: "Type a full question or order — as you'd say it at the bedside." }
            : said
              ? { type: "message", role, kind: "speech", text: said }
              : intent.payload?.question || def.track === "phone"
                ? { type: "message", role: patientRole(def), kind: "speech", text: "Sorry, doctor — I didn't quite follow." }
                : { type: "message", role: "nurse", kind: "speech", text: pick(NURSE_UNSURE, hash(record.id + index)) },
        );
        break;
      }
    }
  });

  // One acknowledgement for everything sent to the lab or imaging this turn.
  if (ctx.sent.length > 0) {
    fx.push({ type: "timeline", label: `${ctx.sent.map((i) => i.name).join(", ")} ordered`, category: "investigation" });
    const quick = ctx.sent.filter((i) => i.resultAt - i.orderedAt <= 15 && (i.category === "bedside" || i.category === "ecg"));
    const slow = ctx.sent.filter((i) => !quick.includes(i));
    if (slow.length > 0 && !INSTANT_RESULTS) {
      fx.push({ type: "message", role: "system", kind: "action", text: `Sent — ${slow.map((i) => i.name).join(", ")}.` });
    }
    if (quick.length > 0 && !hidden.closed) {
      const until = Math.max(...quick.map((i) => i.resultAt));
      fx.push(...advanceClock(def, hidden, until, false).effects);
    }
  }

  // Fire anything that fell due this turn — including a response to treatment just given.
  if (!hidden.closed) fx.push(...catchUp(def, hidden));
  // Treatments whose time has come: what changed, said without being asked.
  if (!hidden.closed) fx.push(...watchReports(def, hidden));
  // The attached monitor shows where the patient is now.
  if (!hidden.closed) fx.push(...monitorTick(hidden));

  // Every message the doctor sends gets an answer from someone in the room.
  // (A "15 min later" divider marks time; it isn't an answer.)
  if (!tick && !hidden.closed && !fx.some((e, i) => i > 0 && e.type === "message" && !(e.kind === "status" && / later$/.test(e.text)))) fx.push(statusReply(def, hidden));

  const stage = ctx.stages[ctx.stages.length - 1];
  if (stage) fx.push({ type: "stage", stage });
  return fx;
}

/** After waiting (or anything that drew no other answer): how the patient is now, from the nurse or the patient. */
function statusReply(def: ClinicalCaseDefinition, hidden: HiddenState): TurnEffect {
  const he = def.patient.sex === "Female" ? "she" : def.patient.sex === "Male" ? "he" : "they";
  const nurse = def.track === "phone" ? "attendant" : "nurse";
  switch (hidden.status) {
    case "deceased":
      return { type: "message", role: "system", kind: "status", text: "The patient has died. End the case to review the encounter." };
    case "critical":
      return { type: "message", role: nurse, kind: "speech", text: hidden.patientSays?.startsWith("(") ? `Doctor, please come — ${he}'s critical. ${hidden.patientSays}` : `Doctor, please come quickly — ${he}'s critical.` };
    case "deteriorating":
      return { type: "message", role: nurse, kind: "speech", text: `Doctor, ${he}'s getting worse.${hidden.patientSays ? ` ${capitalise(he)} says: "${hidden.patientSays}"` : ""}` };
    default:
      return { type: "message", role: patientRole(def), kind: "speech", text: howDoYouFeel(def, hidden) || "I'm here, doctor." };
  }
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
