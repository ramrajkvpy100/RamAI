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
import { catalogExam, catalogInvestigation, catalogMeasure, defaultVitals, flagVital, ROUTINE_VITALS, saneBody, vitalDefinition, type CatalogInvestigation } from "./catalog";
import type { ClinicalCaseDefinition, HazardDefinition, HazardStage, TherapeuticRule, Appropriateness } from "./case-definition";
import { fluidOutcome, tierAt, volumeState, type FluidGiven } from "./fluids";
import { formularyDrug, type FormularyDrug } from "./formulary";
import { canPerform, LEVELS } from "./levels";
import { confirmQuestion, graveHazards, drugNeeds, orderReplies, drugQuestion, phoneDrugQuestion, imagingKind, imagingNeeds, imagingQuestion, oxygenDelivered, oxygenNeeds, oxygenQuestion, parseImaging, parseOxygen, regionById, usualOrder, type ImagingKind, type OrderNeed, type PendingOrder } from "./orders";
import { doseMultiple, drugFeeling, kineticsFor, profileFor, withDrugEffects, type ActingDrug, type EffectKey, type Trouble } from "./pharmacology";
import { arrivalVitals, COVERS, GLOBAL_HAZARD_IDS, globalTriggers, hazardLibrary, morphineEquivalent } from "./physiology";
import { saltGrams } from "./toxicity";
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
  /** IV fluid: the share of the patient's deficit it filled (0–1) — all it does for the circulation (fluids.ts). */
  benefit?: number;
  /** An infusion stopped part-way: when. */
  stoppedAt?: number;
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
  /** The orders that set it off ("drug:ns@12"), so what follows is put down to them. */
  orders?: string[];
  /** A complication of an order (the safety layer's), laid on top of the illness — not the illness's own course. */
  iatrogenic?: boolean;
  /** How far its stages have moved each vital (layered on the illness), so recovery takes back exactly that. */
  shifted?: Partial<Record<ShiftKey, number>>;
  /** The patient's status, findings and words before it began — what recovery returns to. */
  statusBefore?: PatientStatus;
  examBefore?: Record<string, string | null>;
  saysBefore?: string | null;
  /** A graver course of the same thing took over (more fluid on top of fluid): this one no longer runs. */
  superseded?: boolean;
}

type ShiftKey = "hr" | "sbp" | "dbp" | "rr" | "spo2" | "temp" | "gcs" | "rbs" | "urine";

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
  /** Orders given without what's needed to carry them out — asked about, waiting for the doctor's answer. */
  pendingOrders: PendingOrder[];
  /** When the patient responded to the definitive treatment, and to which order. */
  responded?: { at: number; order?: string };
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
  saneBody(def.patient, vitals);
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
    pendingOrders: [],
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
  /** The order this watches ("drug:ns@12"): complications it set off are its doing. */
  order?: string;
  /** Vitals the case says this treatment moves, and from when. */
  authored?: { keys: VitalKey[]; from: number };
  /** When it went in. */
  at: number;
  /** The drug as the effect layer has it (its own clock). */
  drugAt?: number;
  /** When to look again (absolute minutes); the last one says "no change" if nothing moved. */
  checks: number[];
  reported: number;
  /** The vitals the nurse rechecks, as they were just before (then as last told). */
  before: Partial<Record<VitalKey, string>>;
  status: PatientStatus;
  /** Something it did has been told. */
  told?: boolean;
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
function watch(hidden: HiddenState, w: { label: string; drugId?: string; drugAt?: number; order?: string; authored?: Watch["authored"]; at: number; checks: number[]; keys: VitalKey[] }) {
  const now = vitalsNow(hidden);
  const keys = [...new Set([...hidden.measured, ...w.keys])].filter((k) => k in WATCH_NAMES && now[k]?.value);
  const checks = [...new Set(w.checks.map((c) => Math.max(w.at, Math.round(c))))].sort((a, b) => a - b);
  hidden.watches.push({ label: w.label, drugId: w.drugId, drugAt: w.drugAt, order: w.order, authored: w.authored, at: w.at, checks, reported: 0, before: Object.fromEntries(keys.map((k) => [k, now[k].value])), status: hidden.status });
}

/** The key that ties a drug order to what it sets off: "drug:ns@12". */
const orderKey = (drugId: string, at: number) => `drug:${drugId}@${at}`;

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
    const drugAt = w.drugAt ?? w.at;
    const acting = w.drugId ? actingDrugs(hidden).filter((d) => d.drugId === w.drugId && d.at === drugAt) : [];
    const feel = acting.length ? drugFeeling(acting, troublesOf(def, hidden), hidden.clock) : undefined;
    const better = STATUS_RANK[hidden.status] < STATUS_RANK[w.status];
    const worse = STATUS_RANK[hidden.status] > STATUS_RANK[w.status];

    // What this treatment itself did — its own action, the complications it set off, what the case says
    // it does — kept apart from what the illness (or anything else) did meanwhile. Nothing is blamed on a
    // drug that didn't do it.
    const mine = new Set<VitalKey>();
    let mineCourse = false;
    if (w.drugId) {
      const without = withDrugEffects(hidden.vitals, actingDrugs(hidden).filter((d) => !(d.drugId === w.drugId && d.at === drugAt)), hidden.clock);
      for (const k of changed) if (moved(k, without[k]?.value, now[k].value)) mine.add(k);
    } else {
      // A measure (oxygen, a procedure) is looked at as it's done: what changed is its doing.
      for (const k of changed) mine.add(k);
      mineCourse = true;
    }
    if (w.order && hidden.hazards.some((a) => a.orders?.includes(w.order!) && a.manifestedAt !== undefined && a.manifestedAt >= w.at)) {
      for (const k of changed) mine.add(k);
      mineCourse = true;
    }
    if (w.authored && hidden.clock >= w.authored.from) for (const k of changed) if (w.authored.keys.includes(k)) mine.add(k);
    if (w.order && hidden.responded?.order === w.order) {
      for (const k of changed) mine.add(k);
      mineCourse = true;
    }
    const own = changed.filter((k) => mine.has(k));
    const other = changed.filter((k) => !mine.has(k));
    const moving = better || worse;
    if (!own.length && !feel && !(moving && mineCourse) && !last) continue;
    // Already told: the last look adds only what's new.
    if (last && w.told && !own.length && !feel && !moving && !other.length) continue;
    const span = describeSpan(Math.max(1, hidden.clock - w.at));
    const fmt = (k: VitalKey) => `${WATCH_NAMES[k]} ${w.before[k]} → ${now[k].value}${WATCH_UNITS[k] ?? ""}`;
    const course = moving && mineCourse ? ` ${capitalise(he)} looks ${better ? "better" : "worse"}.` : "";
    const says = feel ? ` ${capitalise(he)} says: "${feel}"` : "";
    const meanwhile = other.length || (moving && !mineCourse)
      ? ` Meanwhile${other.length ? ` ${other.map(fmt).join(", ")}` : ""}${moving && !mineCourse ? `${other.length ? " —" : ""} ${he} looks ${better ? "better" : "worse"}` : ""}.`
      : "";
    const text = own.length || course || says
      ? `${span} after the ${w.label}:${own.length ? ` ${own.map(fmt).join(", ")}.` : ""}${course}${says}${meanwhile}`
      : `${span} after the ${w.label} — no change from it so far.${meanwhile}`;
    if (changed.length) {
      for (const k of changed) if (!hidden.measured.includes(k)) hidden.measured.push(k);
      fx.push({ type: "vitals", readings: changed.map((k) => reading(hidden, k)) });
    }
    // The next look compares with now — nothing is told twice.
    for (const k of changed) w.before[k] = now[k].value;
    w.status = hidden.status;
    if (own.length || course || says) w.told = true;
    // An observation on the screen, not a nurse's report: what changed, and what the patient says.
    fx.push(phone ? { type: "message", role: "attendant", kind: "speech", text: text.replace(/\s+/g, " ").trim() } : { type: "message", role: "system", kind: "finding", text: text.replace(/\s+/g, " ").trim() });
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

/** The drugs given, as the effect layer reads them. An IV fluid acts by how much of the patient's deficit it filled — nothing, if they had none. */
function actingDrugs(hidden: HiddenState): ActingDrug[] {
  return hidden.drugs.map((d) => ({ drugId: d.drugId, at: d.at, route: d.route, mode: d.mode, multiple: d.benefit !== undefined ? d.benefit * 5 : d.multiple ?? 1, overMin: d.overMin, skip: d.toxic ? "all" : d.authored }));
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

/** A fact worth showing: words, not a stray "true" or "yes" from a model. */
const realFact = (f: string | undefined): f is string => !!f && !/^(?:true|false|yes|no|null|undefined|n\/a)$/i.test(f.trim());

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
          const troubled = hidden.hazards.some((a) => a.manifestedAt !== undefined && !a.died && !a.superseded && (a.rescuedAt === undefined || a.rescue === "too-late"));
          if (troubled || STATUS_RANK[hidden.status] <= STATUS_RANK.stable) return [];
          hidden.responded = { at: hidden.clock, order: drug ? orderKey(drug.drugId, drug.at) : undefined };
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
    if (!h || armed.died || armed.superseded) continue;
    if (armed.rescuedAt === undefined || armed.rescue === "too-late") {
      const stage = h.stages[armed.stageIdx + 1];
      if (stage) {
        events.push({
          at: armed.armedAt + stage.afterMin, order: 2, interrupts: stage.interrupts ?? true,
          run: () => {
            armed.stageIdx += 1;
            armed.manifestedAt ??= hidden.clock;
            if (stage.status === "deceased") armed.died = true;
            return applyStage(def, hidden, stage, armed);
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
            return applyStage(def, hidden, capped, armed, armed.recoveryIdx === h.recovery.length - 1 ? "last" : "partway");
          },
        });
      }
    }
  }
  return events;
}

const worseOf = (...statuses: PatientStatus[]): PatientStatus => statuses.reduce((a, b) => (STATUS_RANK[b] > STATUS_RANK[a] ? b : a));

/** Normal ranges: a complication makes a vital worse in its own direction — never better than the illness already has it. */
const ABNORMAL: Partial<Record<ShiftKey, [number, number]>> = { hr: [60, 100], sbp: [100, 140], rr: [12, 20], temp: [97, 99.5], rbs: [70, 180] };
const SHIFT_LIMITS: Record<ShiftKey, [number, number]> = { hr: [0, 250], sbp: [0, 280], dbp: [0, 180], rr: [0, 60], spo2: [0, 100], temp: [86, 108], gcs: [3, 15], rbs: [10, 900], urine: [0, 1500] };

/** Where a complication's stage takes a vital, given where the illness already has it. */
function worseValue(key: ShiftKey, current: number, stage: number): number {
  if (key === "spo2" || key === "gcs") return Math.min(current, stage);
  const range = ABNORMAL[key === "dbp" ? "sbp" : key];
  if (!range) return stage;
  const [lo, hi] = range;
  if (stage > hi && current > hi) return Math.max(current, stage);
  if (stage < lo && current < lo) return Math.min(current, stage);
  return stage;
}

const readNum = (hidden: HiddenState, key: ShiftKey): number | undefined => {
  if (key === "sbp" || key === "dbp") {
    const [s, d] = (hidden.vitals.bp?.value ?? "").split("/").map(parseFloat);
    const v = key === "sbp" ? s : d;
    return Number.isFinite(v) ? v : undefined;
  }
  const v = parseFloat(hidden.vitals[key]?.value ?? "");
  return Number.isFinite(v) ? v : undefined;
};

/** Sets one numeric vital (BP by its halves), recording how far it moved on the hazard's layer. */
function setNum(hidden: HiddenState, key: ShiftKey, value: number, armed?: ArmedHazard) {
  const [lo, hi] = SHIFT_LIMITS[key];
  const before = readNum(hidden, key);
  if (before === undefined) return;
  const v = Math.min(hi, Math.max(lo, value));
  if (key === "sbp" || key === "dbp") {
    const [s, d] = hidden.vitals.bp.value.split("/").map(parseFloat) as [number, number];
    const ns = key === "sbp" ? Math.round(v) : s;
    const nd = key === "dbp" ? Math.round(Math.min(v, ns - 10)) : Math.min(d, ns - 10);
    hidden.vitals.bp = { ...hidden.vitals.bp, value: ns <= 0 ? "0/0" : `${ns}/${Math.max(0, nd)}` };
  } else {
    hidden.vitals[key] = { ...hidden.vitals[key], value: key === "temp" ? v.toFixed(1) : String(Math.round(v)) };
  }
  const after = readNum(hidden, key) ?? before;
  if (armed?.shifted) armed.shifted[key] = (armed.shifted[key] ?? 0) + (after - before);
}

/** A complication's stage, laid on top of the illness: each vital no better than it already is, then the stage's shifts. */
function layerStage(hidden: HiddenState, armed: ArmedHazard, stage: HazardStage): VitalKey[] {
  const touched = new Set<VitalKey>();
  for (const v of stage.vitals) {
    if (v.key === "bp") {
      const [ss, sd] = v.value.split("/").map(parseFloat);
      const cs = readNum(hidden, "sbp"), cd = readNum(hidden, "dbp");
      if (ss === undefined || sd === undefined || cs === undefined || cd === undefined || !Number.isFinite(ss) || !Number.isFinite(sd)) continue;
      const ns = worseValue("sbp", cs, ss);
      // Diastolic follows the systolic's choice.
      const nd = ns === cs ? cd : sd;
      setNum(hidden, "sbp", ns, armed);
      setNum(hidden, "dbp", nd, armed);
      touched.add("bp");
    } else if (["hr", "rr", "spo2", "temp", "gcs", "rbs", "urine"].includes(v.key)) {
      const cur = readNum(hidden, v.key as ShiftKey);
      const target = parseFloat(v.value);
      if (cur === undefined || !Number.isFinite(target)) continue;
      setNum(hidden, v.key as ShiftKey, worseValue(v.key as ShiftKey, cur, target), armed);
      touched.add(v.key);
    } else {
      hidden.vitals[v.key] = { ...v };
      touched.add(v.key);
    }
  }
  for (const [k, d] of Object.entries(stage.shift ?? {}) as [ShiftKey, number][]) {
    const cur = readNum(hidden, k);
    if (cur === undefined) continue;
    setNum(hidden, k, cur + d, armed);
    touched.add(k === "sbp" || k === "dbp" ? "bp" : (k as VitalKey));
  }
  return [...touched];
}

/** Recovery from a complication takes back what it did — half on the way, all of it at the end — leaving the illness as it is. */
function undoLayer(hidden: HiddenState, armed: ArmedHazard, share: number): VitalKey[] {
  const touched = new Set<VitalKey>();
  for (const [k, d] of Object.entries(armed.shifted ?? {}) as [ShiftKey, number][]) {
    if (!d) continue;
    const cur = readNum(hidden, k);
    if (cur === undefined) continue;
    const back = d * share;
    const shifted = armed.shifted!;
    setNum(hidden, k, cur - back);
    shifted[k] = d - back;
    touched.add(k === "sbp" || k === "dbp" ? "bp" : (k as VitalKey));
  }
  return [...touched];
}

/** The worst status any other running complication or illness stage holds the patient at. */
function heldAt(def: ClinicalCaseDefinition, hidden: HiddenState, except: ArmedHazard): PatientStatus {
  const lib = hazardLibrary(def);
  let worst: PatientStatus = "improving";
  for (const a of hidden.hazards) {
    if (a === except || a.superseded || a.died || a.stageIdx < 0 || (a.rescuedAt !== undefined && a.rescue !== "too-late")) continue;
    const st = lib.get(a.id)?.stages[a.stageIdx]?.status;
    if (st) worst = worseOf(worst, st);
  }
  return worst;
}

function applyStage(def: ClinicalCaseDefinition, hidden: HiddenState, stage: HazardStage, armed?: ArmedHazard, recovering?: "partway" | "last"): TurnEffect[] {
  const fx: TurnEffect[] = [];
  const previous = hidden.status;
  // A complication of an order is laid on top of the illness: it never makes the patient better than the
  // illness already has them, and recovering from it returns them to where the illness has them now.
  const layered = !!armed?.iatrogenic && stage.status !== "deceased";
  const status: PatientStatus = !layered
    ? stage.status
    : recovering
      ? worseOf(stage.status, armed!.statusBefore ?? stage.status, heldAt(def, hidden, armed!))
      : worseOf(stage.status, previous);
  // A patient turning critical in hospital goes on the monitor — the nurse sees to it, so every change shows from here.
  if (!hidden.monitored && status === "critical" && !["OPD", "Teleconsult"].includes(hidden.setting) && def.track !== "phone") {
    hidden.monitored = true;
    fx.push({ type: "monitoring", on: true, rhythm: monitorRhythm(def) });
    fx.push({ type: "message", role: "system", kind: "action", text: "Patient put on the monitor." });
  }
  let touched: VitalKey[] = stage.vitals.map((v) => v.key);
  if (layered && recovering) {
    touched = undoLayer(hidden, armed!, recovering === "last" ? 1 : 0.5);
  } else if (layered) {
    touched = layerStage(hidden, armed!, stage);
  } else {
    applyVitals(hidden, stage.vitals);
    for (const [k, d] of Object.entries(stage.shift ?? {}) as [ShiftKey, number][]) {
      const cur = readNum(hidden, k);
      if (cur !== undefined) setNum(hidden, k, cur + d);
      touched.push(k === "sbp" || k === "dbp" ? "bp" : (k as VitalKey));
    }
  }
  if (layered && !recovering) {
    for (const [examId, finding] of Object.entries(stage.examFindings ?? {})) {
      if (!finding) continue;
      armed!.examBefore ??= {};
      if (!(examId in armed!.examBefore)) armed!.examBefore[examId] = hidden.examOverrides[examId] ?? null;
      hidden.examOverrides[examId] = finding;
    }
    if (stage.patientSays) {
      if (armed!.saysBefore === undefined) armed!.saysBefore = hidden.patientSays ?? null;
      hidden.patientSays = stage.patientSays;
    }
  } else if (layered && recovering === "last") {
    // Back to the illness's own findings and words.
    for (const [examId, before] of Object.entries(armed!.examBefore ?? {})) {
      if (before === null) delete hidden.examOverrides[examId];
      else hidden.examOverrides[examId] = before;
    }
    hidden.patientSays = armed!.saysBefore ?? undefined;
    if (STATUS_RANK[status] <= STATUS_RANK.guarded && stage.patientSays && armed!.saysBefore == null) hidden.patientSays = stage.patientSays;
  } else if (layered) {
    for (const [examId, finding] of Object.entries(stage.examFindings ?? {})) if (finding) hidden.examOverrides[examId] = finding;
    if (stage.patientSays && STATUS_RANK[status] <= STATUS_RANK.guarded) hidden.patientSays = stage.patientSays;
  } else {
    for (const [examId, finding] of Object.entries(stage.examFindings ?? {})) {
      if (finding) hidden.examOverrides[examId] = finding;
    }
    if (stage.patientSays) hidden.patientSays = stage.patientSays;
  }

  let triage = false;
  if (stage.setting && stage.setting !== hidden.setting) {
    hidden.setting = stage.setting;
    fx.push({ type: "setting", setting: stage.setting });
    fx.push({ type: "timeline", label: stage.setting === "ER" ? "Brought to the emergency department" : `Moved to ${stage.setting}`, category: "status" });
    triage = stage.setting === "ER";
  }

  const worse = STATUS_RANK[status] > STATUS_RANK[previous];
  if (status !== previous) {
    hidden.status = status;
    fx.push({ type: "patient_status", status, notice: "Patient status changed." });
    fx.push({ type: "timeline", label: status === "deceased" ? "Patient died" : "Patient status changed", category: "status" });
    // A change is noticed through the nurse, the family or the monitor; the generic notice is only for when none of them says anything.
    if (worse && status !== "deceased" && !stage.observation) fx.push({ type: "message", role: "system", kind: "status", text: "Patient status changed." });
  }
  if (stage.observation) {
    fx.push({ type: "message", role: stage.observation.role, kind: stage.observation.role === "nurse" || stage.observation.role === "system" ? "status" : "speech", text: stage.observation.text });
  }

  // Monitored patients (and fresh ER arrivals, via triage) show vitals as they change.
  const visible = triage
    ? touched
    : hidden.monitored
      ? touched.filter((k) => ["hr", "bp", "rr", "spo2"].includes(k))
      : [];
  if (visible.length > 0) {
    for (const k of visible) if (!hidden.measured.includes(k)) hidden.measured.push(k);
    fx.push({ type: "vitals", readings: visible.map((k) => reading(hidden, k)) });
  }
  if (status === "deceased") {
    fx.push({ type: "message", role: "system", kind: "status", text: "The patient has died. End the case to review the encounter." });
  }
  return fx;
}

/**
 * Arms a hazard; its stages count from `from` (the moment a drug went in), or from now. `order`: the
 * order that set it off, so what follows is put down to it.
 */
function armHazard(def: ClinicalCaseDefinition, hidden: HiddenState, id: string, trigger: string, prescribed: boolean, from = hidden.clock, order?: string) {
  const h = hazardLibrary(def).get(id);
  if (!h) return;
  const live = hidden.hazards.find((a) => a.id === id && !a.died && !a.superseded && a.rescuedAt === undefined);
  if (live) {
    // More of what is already doing harm: it moves on to its next stage now — a second push of adrenaline into VT brings VF.
    if (prescribed) return;
    const next = h.stages[live.stageIdx + 1];
    if (next) live.armedAt = Math.min(live.armedAt, hidden.clock - next.afterMin);
    live.trigger = `${live.trigger}; then ${trigger}`;
    if (order) (live.orders ??= []).push(order);
    return;
  }
  // Rescued before, and given again: it starts over.
  if (hidden.hazards.some((a) => a.id === id && (a.died || prescribed))) return;
  const onset = prescribed ? h.prescribedOnsetMin ?? 0 : 0;
  const armed: ArmedHazard = {
    id, label: h.label, triggeredAt: from, armedAt: from + onset, trigger, stageIdx: -1, recoveryIdx: -1, died: false, responses: [],
    orders: order ? [order] : [],
    iatrogenic: GLOBAL_HAZARD_IDS.has(id) && !def.hazards.some((x) => x.id === id),
    shifted: {},
    statusBefore: hidden.status,
  };
  // A graver course of the same thing takes over from a milder one still running — and inherits what it already did.
  for (const a of hidden.hazards) {
    if (!(COVERS[id] ?? []).includes(a.id) || a.died || a.superseded || a.rescuedAt !== undefined) continue;
    a.superseded = true;
    for (const [k, d] of Object.entries(a.shifted ?? {}) as [ShiftKey, number][]) armed.shifted![k] = (armed.shifted![k] ?? 0) + d;
    armed.examBefore = { ...(a.examBefore ?? {}), ...(armed.examBefore ?? {}) };
    if (a.saysBefore !== undefined) armed.saysBefore = a.saysBefore;
    if (a.statusBefore) armed.statusBefore = a.statusBefore;
    armed.orders = [...new Set([...(a.orders ?? []), ...(armed.orders ?? [])])];
  }
  hidden.hazards.push(armed);
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
  const unrescued = hidden.hazards.some((h) => !h.superseded && h.rescue !== "full" && h.rescue !== "partial");
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
  /** Orders asked about this turn (they wait for the doctor's answer). */
  asked: PendingOrder[];
  /** Orders the nurse queried last turn as dangerous: ordered again now, they're given. */
  challenged: string[];
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
    fx.push({ type: "fact", group: entry.group, label: entry.label, value: realFact(entry.fact) ? entry.fact! : entry.reply, abnormal: entry.abnormal });
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

  let factValue = realFact(caseEntry?.fact) && !hidden.examOverrides[id] ? caseEntry!.fact! : finding;
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
    if (a.superseded || a.stageIdx < 0 || (a.rescuedAt !== undefined && a.rescue !== "too-late")) continue;
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

/* -------------------------------------------------------------------------- */
/* Studies of a part: which X-ray, CT, ultrasound or MRI, and what's still to be said */
/* -------------------------------------------------------------------------- */

const STUDY_TURNAROUND: Record<ImagingKind, number> = { xray: 20, ct: 45, usg: 30, mri: 120 };
const STUDY_COST: Record<ImagingKind, number> = { xray: 400, ct: 4000, usg: 1000, mri: 7000 };
/** A facility that can do this catalogue study can do any study of that kind. */
const STUDY_BASE: Record<ImagingKind, string> = { xray: "cxr", ct: "ct-head", usg: "usg-abdomen", mri: "mri-brain" };
const KIND_NAME: Record<ImagingKind, string> = { xray: "X-ray", ct: "CT", usg: "USG", mri: "MRI" };
/** Orders that name only the kind of study ("an X-ray", "a CT"): the part is asked for. */
const GENERIC_STUDY = new Set<string>(["xray", "ct", "usg", "mri"]);
/** The parts the catalogue's studies are of. */
const CATALOG_PARTS: Record<string, string[]> = {
  cxr: ["chest"], hrct: ["chest"], "xray-abdomen": ["abdomen"], "usg-abdomen": ["abdomen", "pelvis", "kub"], "ct-abdomen": ["abdomen", "pelvis", "kub"],
  "ct-head": ["head"], "mri-brain": ["head"], "mri-spine": ["spine", "c-spine", "t-spine", "l-spine"],
};

/** A study of a part the catalogue doesn't list ("xray-knee", "ct-chest"): named and reported from the part. */
function partStudy(id: string): CatalogInvestigation | undefined {
  const m = id.match(/^(xray|ct|usg|mri)-(.+)$/);
  const region = m ? regionById(m[2]) : undefined;
  if (!m || !region) return undefined;
  const kind = m[1] as ImagingKind;
  const name = id === "ct-chest" ? "CECT chest" : `${KIND_NAME[kind]} ${region.label}`;
  return {
    id, name, short: name, category: "imaging", menu: "Imaging", match: [],
    turnaroundMin: STUDY_TURNAROUND[kind], cost: STUDY_COST[kind] + (id === "ct-chest" ? 1500 : 0),
    normal: () => ({ report: region.normal[kind] ?? `No abnormality in the ${region.label}.` }),
  };
}

/** A test in the catalogue, or a study of a part. */
const investigationEntry = (id: string): CatalogInvestigation | undefined => catalogInvestigation(id) ?? partStudy(id);

interface Study {
  id: string;
  kind: ImagingKind | null;
  needs: OrderNeed[];
  region?: string;
  side?: string;
  view?: string;
  contrast?: "plain" | "contrast";
}

const str = (x: unknown) => (typeof x === "string" ? x : "");

/** Which study an order is — and what it still needs said: the part, the view, contrast or not. */
function settleStudy(def: ClinicalCaseDefinition, idIn: string, phrase: string, payload: Record<string, unknown>): Study {
  const override = def.investigations.find((i) => i.id === idIn);
  const generic = GENERIC_STUDY.has(idIn);
  const kind = generic ? (idIn as ImagingKind) : imagingKind(idIn, override?.name ?? investigationEntry(idIn)?.name ?? "");
  if (!kind) return { id: idIn, kind: null, needs: [] };
  const said = parseImaging(`${phrase} ${str(payload.region)} ${str(payload.side)} ${str(payload.view)} ${str(payload.contrast)}`);
  const region = str(payload.region) || said.region || (CATALOG_PARTS[idIn]?.length === 1 ? CATALOG_PARTS[idIn]![0] : undefined);
  const needs = imagingNeeds(kind, idIn, override?.name ?? "", phrase, { ...(payload as Record<string, string>), ...(region ? { region } : {}) });
  const study: Study = { id: idIn, kind, needs, region, side: said.side, view: said.view, contrast: said.contrast };
  if (needs.length > 0 || !region) return study;
  if (generic || (CATALOG_PARTS[idIn] && !CATALOG_PARTS[idIn]!.includes(region))) study.id = studyOf(def, kind, region, said.contrast);
  else if (idIn === "hrct" && said.contrast === "contrast") study.id = "ct-chest";
  return study;
}

/** The study of a part: the case's own, the catalogue's, or one of that part. */
function studyOf(def: ClinicalCaseDefinition, kind: ImagingKind, region: string, contrast?: "plain" | "contrast"): string {
  const own = def.investigations.find((i) => imagingKind(i.id, i.name ?? "") === kind && parseImaging(`${i.name ?? ""} ${(i.match ?? []).join(" ")}`).region === region);
  if (own) return own.id;
  if (kind === "ct" && region === "chest") return contrast === "contrast" ? "ct-chest" : "hrct";
  return regionById(region)?.catalog?.[kind] ?? `${kind}-${region}`;
}

/** The study's name as the request reads: "Chest X-ray AP (portable)", "CECT abdomen & pelvis", "X-ray right knee AP & lateral". */
function studyName(study: Study, base: string): string {
  const { kind, region, view, contrast, side, id } = study;
  if (!kind) return base;
  if (id === "cxr") return `Chest X-ray ${view ?? "PA"}${view === "AP" ? " (portable)" : ""}`;
  if (id === "xray-abdomen") return `X-ray abdomen ${view ?? "erect"}`;
  if (id === "ct-head") return contrast === "contrast" ? "CECT head" : "NCCT head";
  if (id === "ct-abdomen") return region === "kub" ? "CT KUB (plain)" : contrast === "contrast" ? "CECT abdomen & pelvis" : "NCCT abdomen & pelvis";
  if (id === "hrct") return "HRCT chest";
  if (id === "ct-chest") return "CECT chest";
  if (id === "usg-abdomen") return region === "kub" ? "USG KUB" : region === "pelvis" ? "USG pelvis" : base;
  if (partStudy(id)) {
    const r = regionById(region);
    const what = kind === "ct" ? (contrast === "contrast" ? "CECT" : "NCCT") : KIND_NAME[kind];
    const sideWord = side === "both" ? "both " : side ? `${side} ` : "";
    return `${what} ${sideWord}${r?.label ?? region ?? ""}${kind === "xray" && view ? ` ${view}` : ""}`.replace(/\s+/g, " ").trim();
  }
  // The case's own study: its name, with the view added when the name doesn't carry one.
  return kind === "xray" && view && !/(view|pa|ap|lateral|erect|supine)/i.test(base) ? `${base} ${view}` : base;
}

/** What a test reports when the case has no word on it: the catalogue's normal result for this patient. */
function catalogueResult(def: ClinicalCaseDefinition, hidden: HiddenState, id: string): OrderedInvestigation["result"] {
  const cat = investigationEntry(id);
  return cat ? cat.normal({ patient: def.patient, hr: parseInt(vitalsNow(hidden).hr.value, 10) || 78, seed: hash(def.id + id) }) : {};
}

/**
 * What the case didn't write for a test about to be ordered: analytes it has
 * no value for anywhere, or a scan with no report. The model fills these in
 * before the turn runs, consistent with the patient (stored with the action,
 * so the case replays exactly); without it, the normal result stands.
 */
export function labGap(def: ClinicalCaseDefinition, hidden: HiddenState, idIn: string, phrase = "", payload: Record<string, unknown> = {}): { id: string; name: string; analytes: LabRow[]; report: boolean; adhoc?: boolean } | null {
  // A study still waiting for its part, view or contrast to be said isn't done yet.
  const study = settleStudy(def, idIn, phrase, payload);
  if (study.needs.length > 0 || GENERIC_STUDY.has(study.id) || idIn === "blood") return null;
  const id = study.id;
  const cat = investigationEntry(id);
  const override = def.investigations.find((i) => i.id === id);
  if (!cat && !override) return adhocTest(def, id) ? { id, name: adhocName(id), analytes: [], report: false, adhoc: true } : null;
  // Nothing to write for a test that won't be done: on the phone, beyond this facility, or just done.
  if (def.track === "phone" || !(def.unlimited || canPerform(def.level, partStudy(id) && study.kind ? STUDY_BASE[study.kind] : id, { inCatalog: !!cat, minLevel: override?.minLevel }))) return null;
  const prior = [...hidden.investigations].reverse().find((i) => i.defId === id);
  if (prior && !REPEAT_RE.test(phrase) && (!prior.delivered || hidden.clock - prior.resultAt < RECENT_MIN)) return null;
  const normal = catalogueResult(def, hidden, id);
  const name = studyName(study, override?.name ?? cat?.name ?? id);
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

/** "All resources": a test the catalogue doesn't have, named by the doctor ("adhoc:Anti-CCP antibodies"). */
const adhocTest = (def: ClinicalCaseDefinition, id: string) => !!def.unlimited && def.track !== "phone" && id.startsWith("adhoc:") && id.length > 7;
export const adhocName = (id: string) => id.slice(6).trim().slice(0, 60);

/** Sent like any other test; its result is what the lab wrote for this patient (kept on the action). */
function orderAdhoc(ctx: TurnContext, id: string): TurnEffect[] {
  const { hidden } = ctx;
  const name = adhocName(id);
  const prior = [...hidden.investigations].reverse().find((i) => i.defId === id);
  if (prior && !prior.delivered) return [{ type: "message", role: "system", kind: "status", text: `${prior.name} is already sent — about ${Math.max(1, Math.round(prior.resultAt - hidden.clock))} min.` }];
  const generated = generatedResult(ctx.record, id);
  const result: OrderedInvestigation["result"] = generated?.rows?.length || generated?.report ? { rows: generated.rows, report: generated.report } : { report: "Within normal limits." };
  const turnaround = INSTANT_RESULTS ? 0 : 60;
  hidden.invSeq += 1;
  const inv: OrderedInvestigation = { instanceId: `inv-${hidden.invSeq}`, defId: id, name, category: "lab", orderedAt: hidden.clock, resultAt: hidden.clock + turnaround, cost: 0, delivered: false, result, priority: "unnecessary" };
  hidden.investigations.push(inv);
  ctx.sent.push(inv);
  ctx.stages.push("investigation");
  return [{ type: "investigation_ordered", instanceId: inv.instanceId, defId: id, name, category: "lab", turnaroundMin: turnaround, cost: 0 }];
}

function handleInvestigation(ctx: TurnContext, intent: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const payload = intent.payload ?? {};
  const requested = intent.targetId ?? "";

  // "Send bloods": which ones?
  if (requested === "blood") {
    if (def.track === "phone") return [];
    return askAbout(ctx, { kind: "investigation", targetId: "blood", payload, phrase: intent.phrase, needs: ["tests"] }, `Which blood tests${askerRole(ctx, "test") === "system" ? "" : ", doctor"}?`, "test");
  }
  // "Show me the X-ray" — the last study of that kind.
  if (GENERIC_STUDY.has(requested) && payload.reshow) {
    const region = parseImaging(intent.phrase).region;
    const last = [...hidden.investigations].reverse().find((i) => imagingKind(i.defId, i.name) === requested && (!region || parseImaging(i.name).region === region || CATALOG_PARTS[i.defId]?.includes(region)));
    if (last?.delivered) {
      if (payload.report && last.result.report) return [{ type: "message", role: "system", kind: "finding", text: `${last.name} report — ${last.result.report}`, attachmentIds: [last.instanceId] }];
      return [{ type: "message", role: "system", kind: "finding", text: `${last.name} — showing the result again.`, attachmentIds: [last.instanceId] }];
    }
  }
  // An imaging order: which part, which view, contrast or not — asked when not said.
  const study = settleStudy(def, requested, intent.phrase, payload);
  if (study.needs.length > 0 && !payload.reshow && def.track !== "phone") {
    return askAbout(ctx, { kind: "investigation", targetId: requested, payload: { ...payload, ...(study.region ? { region: study.region } : {}) }, phrase: intent.phrase, needs: study.needs }, imagingQuestion(study.kind!, study.needs, { ...payload, ...(study.region ? { region: study.region } : {}) }, askerRole(ctx, "test") !== "system"), "test");
  }
  const id = study.id;
  const override = def.investigations.find((i) => i.id === id);
  const cat = investigationEntry(id);
  if (!override && !cat) return adhocTest(def, id) ? orderAdhoc(ctx, id) : [];

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
  if (!(def.unlimited || canPerform(def.level, partStudy(id) && study.kind ? STUDY_BASE[study.kind] : id, { inCatalog: !!cat, minLevel: override?.minLevel }))) {
    hidden.unavailable.push(id);
    return [{ type: "message", role: "system", kind: "status", text: `${testName} isn't available at this ${facilityName(def)}. Decide clinically, or refer.` }];
  }

  const name = study.kind ? studyName(study, override?.short ?? cat?.short ?? override?.name ?? id) : override?.short ?? cat?.short ?? override?.name ?? id;
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
  // The film as it was taken: an AP portable chest film can't judge the heart's size; a supine abdomen can't show fluid levels.
  if (id === "cxr" && study.view?.startsWith("AP")) {
    const spec = result.media?.spec;
    if (result.media && spec?.kind === "xray") result = { ...result, media: { ...result.media, spec: { ...spec, view: "AP" }, alt: "Anteroposterior portable chest radiograph.", caption: "AP portable · semi-erect" } };
    if (!override?.report && !generated?.report && !activeHazardStage(def, hidden).some((st) => st.investigations?.cxr)) {
      result = { ...result, report: "AP portable film. Trachea central. Heart size can't be judged reliably on an AP film; mediastinum within normal limits for the projection. Lung fields clear. Costophrenic angles sharp." };
    }
  }
  if (id === "xray-abdomen" && study.view?.includes("supine") && !override?.report && !generated?.report) {
    result = { ...result, report: "Supine film: normal bowel gas pattern. No dilated loops. (Air–fluid levels and free gas under the diaphragm need an erect film.)" };
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

/**
 * Who takes an order and asks about what it's missing: the nurse at the bedside, the relative on the
 * phone. A prescription, and an outpatient test request, are the doctor's own to complete.
 */
function askerRole(ctx: TurnContext, mode: "given" | "prescribed" | "test"): MessageRole {
  if (ctx.def.track === "phone") return "attendant";
  if (mode === "prescribed" || (mode === "test" && ["OPD", "Teleconsult"].includes(ctx.hidden.setting))) return "system";
  return "nurse";
}

/** Asks for an order's missing details; the order waits for the doctor's answer (one turn). */
function askAbout(ctx: TurnContext, pending: PendingOrder, question: string, mode: "given" | "prescribed" | "test"): TurnEffect[] {
  const role = askerRole(ctx, mode);
  ctx.hidden.pendingOrders = [...ctx.hidden.pendingOrders.filter((o) => !(o.kind === pending.kind && o.targetId === pending.targetId)), pending];
  ctx.asked.push(pending);
  ctx.stages.push("treatment");
  return [{ type: "message", role, kind: role === "system" ? "status" : "speech", text: question, replies: orderReplies(pending) }];
}

function handleDrug(ctx: TurnContext, intent: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const fx: TurnEffect[] = [];
  const drug = intent.targetId ? formularyDrug(intent.targetId) : undefined;
  if (!drug) {
    fx.push({ type: "message", role: "system", kind: "action", text: "Which medicine, dose and route?" });
    return fx;
  }
  const mode = (intent.payload?.mode as "given" | "prescribed") ?? "prescribed";
  if (def.track === "phone" && ["IV", "IM", "SC", "NEB"].includes(String(intent.payload?.route ?? drug.route))) {
    fx.push({ type: "message", role: "attendant", kind: "speech", text: "Doctor, we can't give injections or drips at home." });
    return fx;
  }
  // An order without what it takes to carry it out — the dose, the route, a drip's volume and rate, a
  // prescription's frequency and duration — is asked about, not guessed.
  const p = intent.payload?.usual === true ? usualOrder(drug, intent.payload, mode) : intent.payload ?? {};
  const needs = drugNeeds(drug, p, mode);
  if (needs.length > 0) {
    const question = def.track === "phone" ? phoneDrugQuestion(drug, needs) : drugQuestion(drug, needs, p, askerRole(ctx, mode) !== "system");
    return askAbout(ctx, { kind: "drug", targetId: drug.id, payload: { ...p, mode }, phrase: intent.phrase, needs }, question, mode);
  }
  const route = (p.route as DrugRoute) ?? drug.route;
  const amount = typeof p.amount === "number" ? p.amount : undefined;
  const unit = typeof p.unit === "string" ? p.unit : undefined;
  let dose = (p.dose as string | undefined) ?? drug.dose;
  const frequency = (p.frequency as string | undefined) ?? (mode === "prescribed" ? drug.frequency : "stat");
  const duration = p.duration as string | undefined;
  const volumeMl = drug.fluid ? (typeof p.volumeMl === "number" ? p.volumeMl : drug.id === "prbc" ? 350 * (typeof p.amount === "number" ? p.amount : 1) : 500) : undefined;
  // A drip at a rate: the bag runs over as long as that rate takes.
  const rateMlH = typeof p.rateMlH === "number" && p.rateMlH > 0 ? p.rateMlH : undefined;
  if (drug.fluid && volumeMl && typeof p.dose !== "string") dose = volumeMl >= 1000 ? `${+(volumeMl / 1000).toFixed(2)} L` : `${volumeMl} mL`;
  if (rateMlH) dose = `${dose ?? ""} at ${rateMlH} mL/h`.trim();

  // An order that could kill is queried once by the nurse, before it goes in — what it would do is worked
  // out on a copy of the case, and only if the doctor says so again does it happen. (Not in the guided
  // demo, nor on the phone: no nurse there.)
  const challenge =
    mode === "given" && !def.guided && def.track !== "phone" && p.confirmed !== true && !ctx.challenged.includes(drug.id) && !SURE_RE.test(ctx.record.raw)
      ? structuredClone(hidden)
      : undefined;

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

  // How much it is (ten litres is twenty bags) and how fast — the drug-effect layer and the toxicity hazards both read it.
  const weightKg = parseFloat(hidden.vitals.weight.value) || 60;
  const multiple = doseMultiple(drug, { amount, unit, volumeMl }, weightKg);
  // A drip "stat" or "fast" runs as fast as a pressure bag through a wide cannula allows (about 100 mL a minute) — not in one minute.
  const overMin = drug.fluid && rateMlH && volumeMl ? Math.round((volumeMl / rateMlH) * 60) : typeof p.overMin === "number" && p.overMin > 0 ? (drug.fluid && p.rapid === true ? Math.max(5, (volumeMl ?? 500) / 100) : p.overMin) : undefined;
  // IV fluid acts by what the patient needs: it fills a deficit (and helps), and beyond it, less what
  // the kidneys clear, it collects in the lungs.
  let fluid: ReturnType<typeof fluidOutcome> | undefined;
  if (drug.fluid && route === "IV" && mode === "given" && volumeMl) {
    const before: FluidGiven[] = hidden.drugs.filter((d) => formularyDrug(d.drugId)?.fluid && d.route === "IV" && d.mode === "given" && d.volumeMl).map((d) => ({ at: d.at, volumeMl: d.volumeMl!, drugId: d.drugId, overMin: d.overMin }));
    const saltLoaded = hidden.hazards.some((a) => (a.id === "salt-poisoning" || a.id.startsWith("fluid-")) && !a.died && !a.superseded && a.rescuedAt === undefined);
    fluid = fluidOutcome(volumeState(def, { ...arrivalVitals(def), weight: hidden.vitals.weight.value }, saltLoaded), before, { at: startedAt, volumeMl, drugId: drug.id, overMin });
    hidden.fluidMl += volumeMl;
  }

  const given: GivenDrug = {
    drugId: drug.id, generic: drug.generic, brand: drug.brands[0], classes: drug.classes, at: hidden.clock,
    mode, route, dose, amount, unit, frequency, duration, volumeMl, multiple, overMin, benefit: fluid?.benefit,
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
    const rate = drug.fluid && overMin && !rateMlH ? ` over ${describeSpan(overMin)}` : "";
    fx.push({ type: "message", role: "system", kind: "action", text: `${drug.generic}${dose ? ` ${dose}` : ""} ${route}${rate} — ${verb}. ${k.onset <= minutes ? "Starting to act" : `Starts to act in about ${describeSpan(k.onset)}`}, full effect by about ${describeSpan(full)} — what changes will be reported.` });
  } else {
    fx.push({ type: "message", role: "system", kind: "action", text: `Prescribed — ${prescriptionLine({ generic: drug.generic, dose, route, frequency, duration })}` });
  }
  fx.push({ type: "timeline", label: `${drug.generic}${dose ? ` ${dose}` : ""} ${route} ${mode === "given" ? "given" : "prescribed"}`, category: "treatment" });
  for (const r of rule?.response ?? []) fx.push({ type: "message", role: r.role, kind: r.kind, text: r.text });

  // Consequences.
  const salt = (d: { amount?: number; unit?: string; multiple?: number }) => saltGrams(d);
  const saltBefore = hidden.drugs.filter((d) => d.drugId === "table-salt" && d !== given).reduce((sum, d) => sum + salt(d), 0);
  const snap = {
    fluidMl: hidden.fluidMl,
    fluid: fluid ? { tier: fluid.tier, tierBefore: fluid.tierBefore, large: fluid.large } : undefined,
    salt: drug.id === "table-salt" ? { before: saltBefore, after: saltBefore + salt({ amount, unit, multiple }), weightKg } : undefined,
    recentOpioidMme: hidden.drugs.filter((d) => d.classes.includes("opioid") && d.mode === "given" && hidden.clock - d.at <= 60).reduce((s, d) => s + morphineEquivalent(d.drugId, d.amount, d.unit), 0),
    rbs: parseFloat(vitalsNow(hidden).rbs.value) || 100,
    drugIds: hidden.drugs.map((d) => d.drugId),
    age: def.patient.age,
    recentFluidMl: hidden.drugs.filter((d) => d.classes.includes("fluid") && d.route === "IV" && d.mode === "given" && hidden.clock - d.at <= 60).reduce((s, d) => s + (d.volumeMl ?? 0), 0),
    arrested: hidden.status === "deceased",
  };
  const prescribed = mode === "prescribed";
  const statusBefore = hidden.status;
  const order = orderKey(drug.id, given.at);
  const triggered = globalTriggers(def, { drug, mode, route, frequency, amount, unit, volumeMl, multiple, overMin }, snap);
  const grave = graveHazards(triggered);
  if (challenge && grave.length > 0) {
    for (const k of Object.keys(hidden)) delete (hidden as unknown as Record<string, unknown>)[k];
    Object.assign(hidden, challenge);
    const what = `${drug.generic.toLowerCase()}${dose ? ` ${dose}` : ""} ${route}${overMin && route === "IV" && !rateMlH ? ` over ${describeSpan(overMin)}` : ""}`;
    const question = confirmQuestion(what, grave, def.patient.sex);
    return askAbout(ctx, { kind: "confirm", targetId: drug.id, payload: { ...p, mode, question }, phrase: intent.phrase, needs: [] }, question, mode);
  }
  // Fluid overload starts when the infusion crosses into it, not when the bag is hung.
  for (const hz of triggered) armHazard(def, hidden, hz, label, prescribed, startedAt + (hz.startsWith("fluid-") ? fluid?.crossAfterMin ?? 0 : 0), order);
  // What this order does to the patient is now that hazard's course — not the drug's usual effect as well.
  // (A fluid still does what it does for a deficit, whatever it does to the lungs beyond it.)
  if (triggered.some((hz) => !hz.startsWith("fluid-"))) given.toxic = true;
  if (rule?.arms) {
    const h = hazardLibrary(def).get(rule.arms);
    const cond = h?.condition;
    const fluidOk = !cond?.minFluidMl || hidden.fluidMl > cond.minFluidMl;
    const freqOk = !cond?.frequencyAnyOf || (!!frequency && cond.frequencyAnyOf.some((f) => f.toLowerCase() === frequency.toLowerCase()));
    if (fluidOk && freqOk) armHazard(def, hidden, rule.arms, label, prescribed, hidden.clock, order);
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
    // A fluid that floods the lungs is watched where it shows: breathing and saturation.
    const lungs: VitalKey[] = fluid && fluid.tier > 0 ? ["rr", "spo2"] : [];
    const checks = [startedAt + Math.min(k.onset, peak), startedAt + peak];
    watch(hidden, {
      label: `${drug.generic.toLowerCase()}${dose ? ` ${dose}` : ""} ${route}${overMin && drug.fluid ? ` over ${describeSpan(overMin)}` : ""}`,
      drugId: drug.id, drugAt: given.at, order,
      authored: authored.length && !def.guided ? { keys: authored, from: hidden.clock + Math.min(k.onset, Math.max(1, overMin ?? 0, k.peak)) } : undefined,
      at: startedAt, checks, keys: [...acts, ...authored, ...lungs],
    });
    if (startedAt + peak > hidden.clock) fx.push({ type: "watching", label: drug.generic, until: startedAt + peak });
  }
  // A course prescribed: taken as if its time is up — and the patient says, in their own words, what it did.
  if (prescribed && !def.guided && def.track !== "phone") fx.push(...afterCourse(def, hidden, drug, duration, statusBefore));
  noteResponse(hidden, `${label} ${mode}`);
  evaluateRescues(def, hidden);
  ctx.stages.push("treatment");
  return fx;
}

/** After a prescribed course: what the patient noticed, if anything. */
function afterCourse(def: ClinicalCaseDefinition, hidden: HiddenState, drug: FormularyDrug, duration: string | undefined, before: PatientStatus): TurnEffect[] {
  const name = drug.generic.toLowerCase();
  const when = duration ? `After ${duration.replace(/^for\s+/i, "")} of ${name}` : `After taking the ${name}`;
  const feels = profileFor(drug)?.feels;
  const relief = feels && troublesOf(def, hidden).has(feels.when) ? feels.says : undefined;
  const now = hidden.status;
  let says: string;
  if (STATUS_RANK[now] > STATUS_RANK[before]) says = "It hasn't helped, doctor — if anything I feel worse.";
  else if (STATUS_RANK[now] < STATUS_RANK[before]) says = relief ? `${relief} I feel much better overall.` : "I feel much better, doctor.";
  else if (relief) says = `${relief} But the main problem is still there.`;
  else says = "No real change, doctor. I feel about the same.";
  return [
    { type: "message", role: "system", kind: "action", text: `${when} —` },
    { type: "message", role: patientRole(def), kind: "speech", text: says },
  ];
}

/** "I'm sure", "I know", "deliberately": said with the order, the nurse doesn't query it. */
const SURE_RE = /\b(?:i'?m sure|i am sure|i know(?: it'?s| that)?|deliberately|i insist|confirmed|as ordered)\b/i;

const overMinOf = (p: Record<string, unknown>) => (typeof p.overMin === "number" && p.overMin > 0 ? p.overMin : undefined);

function handleRule(ctx: TurnContext, rule: TherapeuticRule, intent?: ResolvedIntent): TurnEffect[] {
  const { def, hidden } = ctx;
  const fx: TurnEffect[] = [];
  // A treatment the case says changes the patient: what changed is reported when it's done.
  if (rule.vitalsAfter?.length || rule.statusAfter) {
    watch(hidden, { label: rule.label.toLowerCase(), at: hidden.clock, checks: [hidden.clock], keys: (rule.vitalsAfter ?? []).map((v) => v.key) });
  }

  // Oxygen without a device or flow is asked about before anything is done.
  if (rule.measureIds?.includes("oxygen") && intent) {
    const asked = askOxygen(ctx, intent, rule.id);
    if (asked) return asked;
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

/** Oxygen as ordered: the device and flow said (or asked for). */
function oxygenOrdered(intent: ResolvedIntent) {
  const p = intent.payload ?? {};
  return { ...parseOxygen(intent.phrase), ...(typeof p.device === "string" ? { device: p.device as ReturnType<typeof parseOxygen>["device"] } : {}), ...(typeof p.flowL === "number" ? { flowL: p.flowL } : {}), ...(typeof p.fio2 === "number" ? { fio2: p.fio2 } : {}) };
}

/** Oxygen without a device or flow: the nurse asks. Returns the question, or null when it can go on. */
function askOxygen(ctx: TurnContext, intent: ResolvedIntent, targetId: string): TurnEffect[] | null {
  if (ctx.def.track === "phone" || ctx.def.guided) return null;
  const o = oxygenOrdered(intent);
  const needs = oxygenNeeds(o);
  if (needs.length === 0) return null;
  return askAbout(ctx, { kind: "oxygen", targetId, payload: { ...(intent.payload ?? {}) }, phrase: intent.phrase, needs }, oxygenQuestion(o, needs, askerRole(ctx, "given") !== "system"), "given");
}

function handleMeasure(ctx: TurnContext, measureId: string, intent: ResolvedIntent): TurnEffect[] {
  const { hidden } = ctx;
  const m = catalogMeasure(measureId);
  if (!m) return [];
  if (m.id === "oxygen" && intent.targetId === "measure:oxygen") {
    const asked = askOxygen(ctx, intent, "measure:oxygen");
    if (asked) return asked;
  }
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
      const o2 = m.id === "oxygen" ? oxygenDelivered(oxygenOrdered(intent)) : undefined;
      watch(hidden, { label: m.id === "niv" ? "BiPAP" : `oxygen (${o2!.label})`, at: hidden.clock, checks: [hidden.clock], keys: ["spo2"] });
      const spo2 = parseFloat(hidden.vitals.spo2.value);
      // Saturation rises with the oxygen breathed (FiO₂) — less where blood is shunted past flooded or collapsed lung.
      const shunt = hidden.hazards.some((a) => !a.superseded && a.manifestedAt !== undefined && !a.died && a.rescuedAt === undefined);
      if (spo2 > 0 && spo2 < 96) {
        if (m.id === "niv") applyVitals(hidden, [{ key: "spo2", value: String(Math.min(97, Math.round(spo2 + 6))) }]);
        else {
          const reach = 1 - Math.exp(-(o2!.fio2 - 21) / 15);
          const gain = (99 - spo2) * reach * (shunt ? 0.45 : 0.85);
          applyVitals(hidden, [{ key: "spo2", value: String(Math.min(98, Math.round(spo2 + gain))) }]);
        }
      }
      fx.push({ type: "message", role: actor, kind: "action", text: m.id === "niv" ? "BiPAP started via full-face mask." : `Oxygen started — ${o2!.label}.` });
      fx.push({ type: "timeline", label: m.id === "niv" ? m.label : `Oxygen — ${o2!.label}`, category: "treatment" });
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
    case "stop-fluids": {
      // A drip stopped part-way has given only what ran in; what was still to come won't flood the lungs.
      const running = hidden.drugs.filter((d) => formularyDrug(d.drugId)?.fluid && d.route === "IV" && d.mode === "given" && d.volumeMl && d.stoppedAt === undefined && hidden.clock - d.at < Math.max(1, d.overMin ?? 15));
      for (const d of running) {
        const share = Math.max(0, hidden.clock - d.at) / Math.max(1, d.overMin ?? 15);
        d.volumeMl = Math.round(d.volumeMl! * share);
        if (d.benefit !== undefined) d.benefit *= share;
        d.overMin = Math.max(1, hidden.clock - d.at);
        d.stoppedAt = hidden.clock;
      }
      if (running.length > 0) {
        const lib = hazardLibrary(ctx.def);
        for (const a of hidden.hazards) {
          if (!a.id.startsWith("fluid-") || a.superseded || a.stageIdx >= 0) continue;
          const first = lib.get(a.id)?.stages[0];
          if (first && a.armedAt + first.afterMin > hidden.clock) a.superseded = true;
        }
        const state = volumeState(ctx.def, { ...arrivalVitals(ctx.def), weight: hidden.vitals.weight.value });
        const given: FluidGiven[] = hidden.drugs.filter((d) => formularyDrug(d.drugId)?.fluid && d.route === "IV" && d.mode === "given" && d.volumeMl).map((d) => ({ at: d.at, volumeMl: d.volumeMl!, drugId: d.drugId, overMin: d.overMin }));
        const tier = tierAt(state, given, hidden.clock);
        const live = hidden.hazards.some((a) => a.id.startsWith("fluid-") && !a.superseded && !a.died && a.rescuedAt === undefined);
        if (tier > 0 && !live) armHazard(ctx.def, hidden, tier === 3 ? "fluid-catastrophe" : tier === 2 ? "fluid-flood" : "fluid-overload", "IV fluid beyond the deficit", false, hidden.clock, running[0] ? orderKey(running[0].drugId, running[0].at) : undefined);
      }
      fx.push({ type: "message", role: actor, kind: "action", text: running.length ? `IV fluids stopped — ${running.map((d) => `${d.volumeMl} mL of the ${d.generic.toLowerCase()} had gone in`).join("; ")}.` : "IV fluids stopped." });
      fx.push({ type: "timeline", label: "IV fluids stopped", category: "treatment" });
      break;
    }
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
    // "Advise" alone: advise what? Asked, not taken as advice given.
    if (/^(?:please\s+)?(?:advise|advice|counsel|counselling|counseling|explain|educate|tell him|tell her|tell the patient|inform|instruct|recommend)[.!\s]*$/i.test(intent.phrase.trim())) {
      return [{ type: "message", role: def.track === "phone" ? "attendant" : "nurse", kind: "speech", text: "What would you like to advise, doctor?", replies: ["Advise rest and plenty of fluids", "Advise diet and lifestyle changes", "Advise when to come back", "Explain the warning signs"].map((text) => ({ text })) }];
    }
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
  const ctx: TurnContext = { def, hidden, record, sent: [], stages: [], notices: [], asked: [], challenged: [] };
  const conversational = record.intents.some((i) => i.kind === "history" || i.kind === "greeting" || (i.kind === "unknown" && (i.payload?.question || i.payload?.speaker === "patient" || i.payload?.speaker === "attendant")));
  // A real-time tick has no words: time passes without the doctor saying anything.
  const tick = isTick(record);
  if (!tick) fx.push({ type: "message", role: "doctor", kind: conversational ? "speech" : "action", text: record.raw.trim() });

  if (hidden.closed) return fx;
  if (!tick && record.intents.some((i) => i.matched && SIGNIFICANT.includes(i.kind))) hidden.actionCount += 1;
  // An order asked about waits for one answer: whatever the doctor says next, it doesn't wait longer
  // (unless they only said "ok" — then it's asked again). The clock running on its own doesn't count.
  if (!tick) ctx.challenged = (hidden.pendingOrders ?? []).filter((o) => o.kind === "confirm").map((o) => o.targetId);
  if (!tick && !record.intents.some((i) => i.payload?.keepPending === true)) hidden.pendingOrders = [];

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
                : def.track === "emergency"
                  ? { type: "message", role: "nurse", kind: "speech", text: pick(NURSE_UNSURE, hash(record.id + index)) }
                  : { type: "message", role: patientRole(def), kind: "speech", text: "Sorry, doctor — could you say that again?" },
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
    // What anyone can see — not a nurse's report. (On the phone, the relative says it.)
    case "critical":
      return def.track === "phone"
        ? { type: "message", role: nurse, kind: "speech", text: `Doctor, ${he}'s getting very bad!` }
        : { type: "message", role: "system", kind: "finding", text: `${capitalise(he)} is critical.${hidden.patientSays?.startsWith("(") ? ` ${hidden.patientSays.slice(1, -1)}` : ""}` };
    case "deteriorating":
      return def.track === "phone"
        ? { type: "message", role: nurse, kind: "speech", text: `Doctor, ${he}'s getting worse.` }
        : hidden.patientSays && !hidden.patientSays.startsWith("(")
          ? { type: "message", role: patientRole(def), kind: "speech", text: hidden.patientSays }
          : { type: "message", role: "system", kind: "finding", text: `${capitalise(he)} is getting worse.${hidden.patientSays ? ` ${hidden.patientSays.slice(1, -1)}` : ""}` };
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
